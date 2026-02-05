import { Elysia, t } from "elysia";
import { prisma, LeaveStatus } from "@snl-emp/db";
import { authPlugin } from "../auth/plugin.js";
import { canApproveLeaves } from "../middleware/rbac.js";

// Helper to get or create employee profile
async function getOrCreateEmployee(userId: string) {
  let employee = await prisma.employee.findUnique({
    where: { userId },
    include: { managementLeads: true },
  });

  if (!employee) {
    const count = await prisma.employee.count();
    employee = await prisma.employee.create({
      data: {
        userId,
        employeeId: `EMP-${String(count + 1).padStart(5, "0")}`,
      },
      include: { managementLeads: true },
    });
  }

  return employee;
}

export const leaveRoutes = new Elysia({ prefix: "/api/leaves" })
  .use(authPlugin)

  // List leave requests
  .get(
    "/",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const isManager =
        user.role === "MANAGEMENT" ||
        user.role === "ADMIN" ||
        user.role === "DEVELOPER";
      const isHR =
        user.role === "HR" ||
        user.role === "ADMIN" ||
        user.role === "DEVELOPER";

      let whereClause: Record<string, unknown> = {};

      if (query.view === "pending-approval" && isManager) {
        whereClause = {
          approvals: {
            some: {
              approverId: employee.id,
              approved: null,
            },
          },
          status: "PENDING",
        };
      } else if (query.view === "all" && isHR) {
        whereClause = {};
      } else {
        whereClause = { employeeId: employee.id };
      }

      const leaves = await prisma.leaveRequest.findMany({
        where: whereClause,
        include: {
          employee: {
            include: {
              user: {
                select: { name: true, email: true, image: true },
              },
            },
          },
          leaveTypeConfig: true,
          approvals: {
            include: {
              approver: {
                include: {
                  user: {
                    select: { name: true, email: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return leaves;
    },
    {
      query: t.Object({
        view: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Leaves"],
        summary: "List leave requests",
      },
    },
  )

  // Get leave balance (deprecated - use /api/leave-balances/my instead)
  .get(
    "/balance",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);
      const currentYear = new Date().getFullYear();

      // Get all employee's leave balances for current year
      const balances = await prisma.employeeLeaveBalance.findMany({
        where: {
          employeeId: employee.id,
          year: currentYear,
        },
        include: {
          leaveType: true,
        },
      });

      // Get all active, non-deleted leave types
      const leaveTypes = await prisma.leaveTypeConfig.findMany({
        where: { isActive: true, isDeleted: false },
        orderBy: { order: "asc" },
      });

      // Build response with balances for each leave type
      const result: Record<
        string,
        {
          used: number;
          max: number;
          remaining: number;
          isUnlimited: boolean;
          name: string;
          color: string | null;
        }
      > = {};

      for (const leaveType of leaveTypes) {
        const balance = balances.find(
          (b: { leaveTypeId: string }) => b.leaveTypeId === leaveType.id,
        );
        const totalBalance =
          (balance?.balance ?? leaveType.defaultBalance) +
          (balance?.carriedOver ?? 0) +
          (balance?.adjustment ?? 0);
        const used = balance?.used ?? 0;

        result[leaveType.code.toLowerCase()] = {
          used,
          max: leaveType.isUnlimited ? -1 : totalBalance,
          remaining: leaveType.isUnlimited ? -1 : totalBalance - used,
          isUnlimited: leaveType.isUnlimited,
          name: leaveType.name,
          color: leaveType.color,
        };
      }

      return result;
    },
    {
      detail: {
        tags: ["Leaves"],
        summary: "Get leave balance (deprecated)",
      },
    },
  )

  // Create leave request
  .post(
    "/",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const startDate = new Date(body.startDate);
      const endDate = new Date(body.endDate);

      if (startDate > endDate) {
        set.status = 400;
        return { message: "Start date must be before end date" };
      }

      const settings = await prisma.globalSettings.findUnique({
        where: { id: "global" },
      });

      const daysDiff =
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;
      if (daysDiff > (settings?.maxConsecutiveLeaveDays ?? 14)) {
        set.status = 400;
        return {
          message: `Cannot request more than ${settings?.maxConsecutiveLeaveDays ?? 14} consecutive days`,
        };
      }

      // Look up the leave type config by code
      const leaveTypeConfig = await prisma.leaveTypeConfig.findUnique({
        where: { code: body.type },
      });

      if (!leaveTypeConfig) {
        set.status = 400;
        return { message: `Invalid leave type: ${body.type}` };
      }

      // Check required work days eligibility
      if (
        leaveTypeConfig.requiredWorkDays &&
        leaveTypeConfig.requiredWorkDays > 0
      ) {
        // Get employee's start work date
        const employeeDetails = await prisma.employee.findUnique({
          where: { id: employee.id },
          select: { startWorkDate: true },
        });

        if (!employeeDetails?.startWorkDate) {
          set.status = 400;
          return {
            message: `Cannot request ${leaveTypeConfig.name}: Your start work date is not set. Please contact HR to update your profile.`,
          };
        }

        // Calculate days worked
        const today = new Date();
        const startWorkDate = new Date(employeeDetails.startWorkDate);
        const daysWorked = Math.floor(
          (today.getTime() - startWorkDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysWorked < leaveTypeConfig.requiredWorkDays) {
          set.status = 400;
          return {
            message: `Cannot request ${leaveTypeConfig.name}: You need to work at least ${leaveTypeConfig.requiredWorkDays} days before using this leave type. You have worked ${daysWorked} days.`,
          };
        }
      }

      // Check for overlapping leave requests (pending or approved)
      const overlappingLeaves = await prisma.leaveRequest.findMany({
        where: {
          employeeId: employee.id,
          status: { in: ["PENDING", "APPROVED"] },
          OR: [
            // New request starts during existing leave
            {
              startDate: { lte: endDate },
              endDate: { gte: startDate },
            },
          ],
        },
        include: {
          leaveTypeConfig: true,
        },
      });

      if (overlappingLeaves.length > 0) {
        const existingLeave = overlappingLeaves[0];
        const existingStart = new Date(
          existingLeave.startDate,
        ).toLocaleDateString();
        const existingEnd = new Date(
          existingLeave.endDate,
        ).toLocaleDateString();
        set.status = 400;
        return {
          message: `You already have a ${existingLeave.status.toLowerCase()} ${existingLeave.leaveTypeConfig.name} request for ${existingStart} - ${existingEnd}. Please cancel or wait for rejection before requesting leave for overlapping dates.`,
        };
      }

      const leaveRequest = await prisma.leaveRequest.create({
        data: {
          employeeId: employee.id,
          leaveTypeConfigId: leaveTypeConfig.id,
          reason: body.reason,
          startDate,
          endDate,
          isHalfDay: body.isHalfDay ?? false,
          halfDayType: body.halfDayType,
          approvals: {
            create: employee.managementLeads.map(
              (ml: { managerId: string }) => ({
                approverId: ml.managerId,
              }),
            ),
          },
        },
        include: {
          leaveTypeConfig: true,
          approvals: {
            include: {
              approver: {
                include: {
                  user: { select: { name: true, email: true } },
                },
              },
            },
          },
        },
      });

      return leaveRequest;
    },
    {
      body: t.Object({
        type: t.String({ minLength: 1 }), // Now accepts any leave type code
        reason: t.String({ minLength: 1, maxLength: 500 }),
        startDate: t.String(),
        endDate: t.String(),
        isHalfDay: t.Optional(t.Boolean()),
        halfDayType: t.Optional(
          t.Union([t.Literal("morning"), t.Literal("afternoon")]),
        ),
      }),
      detail: {
        tags: ["Leaves"],
        summary: "Create leave request",
      },
    },
  )

  // Get single leave request
  .get(
    "/:id",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const leave = await prisma.leaveRequest.findUnique({
        where: { id },
        include: {
          employee: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
          leaveTypeConfig: true,
          approvals: {
            include: {
              approver: {
                include: {
                  user: { select: { name: true, email: true } },
                },
              },
            },
          },
        },
      });

      if (!leave) {
        set.status = 404;
        return { message: "Leave request not found" };
      }

      return leave;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Leaves"],
        summary: "Get leave request by ID",
      },
    },
  )

  // Cancel leave request (owner only)
  .delete(
    "/:id",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const leave = await prisma.leaveRequest.findUnique({
        where: { id },
      });

      if (!leave) {
        set.status = 404;
        return { message: "Leave request not found" };
      }

      // Allow: owner, HR, ADMIN, or DEVELOPER to cancel
      const canCancel =
        leave.employeeId === employee.id ||
        user.role === "HR" ||
        user.role === "ADMIN" ||
        user.role === "DEVELOPER";

      if (!canCancel) {
        set.status = 403;
        return { message: "Can only cancel your own leave requests" };
      }

      if (leave.status !== "PENDING" && leave.status !== "APPROVED") {
        set.status = 400;
        return {
          message: "Can only cancel pending or approved leave requests",
        };
      }

      await prisma.leaveRequest.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      return { message: "Leave request cancelled" };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Leaves"],
        summary: "Cancel leave request",
      },
    },
  )

  // Approve/reject leave request (manager only)
  .post(
    "/:id/approve",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!canApproveLeaves(user)) {
        set.status = 403;
        return { message: "Forbidden: Management role required" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const leave = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { approvals: true },
      });

      if (!leave) {
        set.status = 404;
        return { message: "Leave request not found" };
      }

      if (leave.status !== "PENDING") {
        set.status = 400;
        return { message: "Leave request is not pending" };
      }

      const approval = leave.approvals.find(
        (a: { approverId: string }) => a.approverId === employee.id,
      );

      // HR and DEVELOPER can approve/reject directly without being in the approvals list
      const canDirectApprove = user.role === "DEVELOPER" || user.role === "HR";

      if (!approval && !canDirectApprove) {
        set.status = 403;
        return { message: "You are not an approver for this leave request" };
      }

      if (approval) {
        // Update the approval record if the user is in the approvals list
        await prisma.leaveApproval.update({
          where: { id: approval.id },
          data: {
            approved: body.approved,
            comment: body.comment,
            respondedAt: new Date(),
          },
        });
      }

      // HR/DEVELOPER can directly approve/reject - update status immediately
      if (canDirectApprove) {
        const newStatus: LeaveStatus = body.approved ? "APPROVED" : "REJECTED";
        await prisma.leaveRequest.update({
          where: { id },
          data: { status: newStatus },
        });

        // Also mark all pending approvals as responded
        await prisma.leaveApproval.updateMany({
          where: {
            leaveRequestId: id,
            approved: null,
          },
          data: {
            approved: body.approved,
            respondedAt: new Date(),
          },
        });

        return {
          message: body.approved ? "Leave approved" : "Leave rejected",
          status: newStatus,
        };
      }

      // For regular managers (not HR/DEVELOPER), check if all approvers have responded
      const updatedLeave = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { approvals: true },
      });

      const allResponded = updatedLeave?.approvals.every(
        (a: { approved: boolean | null }) => a.approved !== null,
      );
      const anyRejected = updatedLeave?.approvals.some(
        (a: { approved: boolean | null }) => a.approved === false,
      );
      const allApproved = updatedLeave?.approvals.every(
        (a: { approved: boolean | null }) => a.approved === true,
      );

      let newStatus: LeaveStatus = "PENDING";
      if (anyRejected) {
        newStatus = "REJECTED";
      } else if (allApproved && allResponded) {
        newStatus = "APPROVED";
      }

      if (newStatus !== "PENDING") {
        await prisma.leaveRequest.update({
          where: { id },
          data: { status: newStatus },
        });
      }

      return {
        message: body.approved ? "Leave approved" : "Leave rejected",
        status: newStatus,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        approved: t.Boolean(),
        comment: t.Optional(t.String({ maxLength: 500 })),
      }),
      detail: {
        tags: ["Leaves"],
        summary: "Approve or reject leave request",
      },
    },
  );
