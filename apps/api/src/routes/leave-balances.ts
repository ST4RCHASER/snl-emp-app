import { Elysia, t } from "elysia";
import {
  prisma,
  LeaveTypeConfig,
  EmployeeLeaveBalance,
  LeaveRequest,
} from "@snl-emp/db";
import { authPlugin } from "../auth/plugin.js";
import { canManageEmployees, isDeveloper } from "../middleware/rbac.js";

type LeaveRequestWithConfig = LeaveRequest & {
  leaveTypeConfig: LeaveTypeConfig | null;
};

type EmployeeBalanceWithType = EmployeeLeaveBalance & {
  leaveType: LeaveTypeConfig;
};

// Helper to get or create employee profile
async function getOrCreateEmployee(userId: string) {
  let employee = await prisma.employee.findUnique({
    where: { userId },
  });

  if (!employee) {
    const count = await prisma.employee.count();
    employee = await prisma.employee.create({
      data: {
        userId,
        employeeId: `EMP-${String(count + 1).padStart(5, "0")}`,
      },
    });
  }

  return employee;
}

export const leaveBalanceRoutes = new Elysia({ prefix: "/api/leave-balances" })
  .use(authPlugin)

  // Get leave balances for current user (new system)
  .get(
    "/my",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);
      const year = query.year ? parseInt(query.year) : new Date().getFullYear();

      // Get all active leave types
      const leaveTypes = await prisma.leaveTypeConfig.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
      });

      // Get employee-specific balances
      const employeeBalances = await prisma.employeeLeaveBalance.findMany({
        where: {
          employeeId: employee.id,
          year,
        },
        include: {
          leaveType: true,
        },
      });

      // Get used leave counts for this year
      const usedLeaves = await prisma.leaveRequest.findMany({
        where: {
          employeeId: employee.id,
          status: "APPROVED",
          startDate: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1),
          },
        },
        include: {
          leaveTypeConfig: true,
        },
      });

      // Calculate used days per leave type
      const usedByType: Record<string, number> = {};
      usedLeaves.forEach((leave: LeaveRequestWithConfig) => {
        const typeId = leave.leaveTypeConfigId;
        const days = leave.isHalfDay
          ? 0.5
          : Math.ceil(
              (new Date(leave.endDate).getTime() -
                new Date(leave.startDate).getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1;

        usedByType[typeId] = (usedByType[typeId] || 0) + days;
      });

      // Build balance result
      const balances = leaveTypes.map((leaveType: LeaveTypeConfig) => {
        const employeeBalance = employeeBalances.find(
          (eb: EmployeeBalanceWithType) => eb.leaveTypeId === leaveType.id,
        );

        // Calculate total balance (default + custom adjustments + carryover)
        const baseBalance =
          employeeBalance?.balance ?? leaveType.defaultBalance;
        const carriedOver = employeeBalance?.carriedOver ?? 0;
        const adjustment = employeeBalance?.adjustment ?? 0;
        const totalBalance = baseBalance + carriedOver + adjustment;

        const used = usedByType[leaveType.id] || 0;

        return {
          leaveType,
          balance: baseBalance,
          carriedOver,
          adjustment,
          totalBalance,
          used,
          remaining: leaveType.isUnlimited ? null : totalBalance - used,
          notes: employeeBalance?.notes,
          year,
        };
      });

      return balances;
    },
    {
      query: t.Object({
        year: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Leave Balances"],
        summary: "Get current user leave balances",
      },
    },
  )

  // Get leave balances for a specific employee (HR only)
  .get(
    "/employee/:employeeId",
    async ({ params: { employeeId }, user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      // Check if requesting own data or has HR permissions
      const currentEmployee = await getOrCreateEmployee(user.id);
      if (
        currentEmployee.id !== employeeId &&
        !canManageEmployees(user) &&
        !isDeveloper(user)
      ) {
        set.status = 403;
        return { message: "Forbidden: Can only view own balances" };
      }

      const year = query.year ? parseInt(query.year) : new Date().getFullYear();

      // Get all active leave types
      const leaveTypes = await prisma.leaveTypeConfig.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
      });

      // Get employee-specific balances
      const employeeBalances = await prisma.employeeLeaveBalance.findMany({
        where: {
          employeeId,
          year,
        },
        include: {
          leaveType: true,
        },
      });

      // Get used leave counts for this year
      const usedLeaves = await prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: "APPROVED",
          startDate: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1),
          },
        },
        include: {
          leaveTypeConfig: true,
        },
      });

      // Calculate used days per leave type
      const usedByType: Record<string, number> = {};
      usedLeaves.forEach((leave: LeaveRequestWithConfig) => {
        const typeId = leave.leaveTypeConfigId;
        const days = leave.isHalfDay
          ? 0.5
          : Math.ceil(
              (new Date(leave.endDate).getTime() -
                new Date(leave.startDate).getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1;

        usedByType[typeId] = (usedByType[typeId] || 0) + days;
      });

      // Build balance result
      const balances = leaveTypes.map((leaveType: LeaveTypeConfig) => {
        const employeeBalance = employeeBalances.find(
          (eb: EmployeeBalanceWithType) => eb.leaveTypeId === leaveType.id,
        );

        const baseBalance =
          employeeBalance?.balance ?? leaveType.defaultBalance;
        const carriedOver = employeeBalance?.carriedOver ?? 0;
        const adjustment = employeeBalance?.adjustment ?? 0;
        const totalBalance = baseBalance + carriedOver + adjustment;

        const used = usedByType[leaveType.id] || 0;

        return {
          leaveType,
          balance: baseBalance,
          carriedOver,
          adjustment,
          totalBalance,
          used,
          remaining: leaveType.isUnlimited ? null : totalBalance - used,
          notes: employeeBalance?.notes,
          year,
        };
      });

      return balances;
    },
    {
      params: t.Object({
        employeeId: t.String(),
      }),
      query: t.Object({
        year: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Leave Balances"],
        summary: "Get leave balances for an employee",
      },
    },
  )

  // Set/update employee leave balance (HR only)
  .post(
    "/employee/:employeeId",
    async ({ params: { employeeId }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!canManageEmployees(user)) {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      // Verify employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        set.status = 404;
        return { message: "Employee not found" };
      }

      // Verify leave type exists
      const leaveType = await prisma.leaveTypeConfig.findUnique({
        where: { id: body.leaveTypeId },
      });

      if (!leaveType) {
        set.status = 404;
        return { message: "Leave type not found" };
      }

      const year = body.year ?? new Date().getFullYear();

      // Upsert the balance
      const balance = await prisma.employeeLeaveBalance.upsert({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId: body.leaveTypeId,
            year,
          },
        },
        create: {
          employeeId,
          leaveTypeId: body.leaveTypeId,
          year,
          balance: body.balance ?? leaveType.defaultBalance,
          carriedOver: body.carriedOver ?? 0,
          adjustment: body.adjustment ?? 0,
          notes: body.notes,
        },
        update: {
          ...(body.balance !== undefined && { balance: body.balance }),
          ...(body.carriedOver !== undefined && {
            carriedOver: body.carriedOver,
          }),
          ...(body.adjustment !== undefined && { adjustment: body.adjustment }),
          ...(body.notes !== undefined && { notes: body.notes }),
        },
        include: {
          leaveType: true,
          employee: {
            include: {
              user: {
                select: { name: true, email: true },
              },
            },
          },
        },
      });

      return balance;
    },
    {
      params: t.Object({
        employeeId: t.String(),
      }),
      body: t.Object({
        leaveTypeId: t.String(),
        year: t.Optional(t.Number()),
        balance: t.Optional(t.Number({ minimum: 0 })),
        carriedOver: t.Optional(t.Number({ minimum: 0 })),
        adjustment: t.Optional(t.Number()), // Can be negative
        notes: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
      }),
      detail: {
        tags: ["Leave Balances"],
        summary: "Set employee leave balance",
      },
    },
  )

  // Bulk set balances for a leave type (HR only)
  // Useful for setting defaults for all employees at once
  .post(
    "/bulk",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!canManageEmployees(user)) {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      // Verify leave type exists
      const leaveType = await prisma.leaveTypeConfig.findUnique({
        where: { id: body.leaveTypeId },
      });

      if (!leaveType) {
        set.status = 404;
        return { message: "Leave type not found" };
      }

      const year = body.year ?? new Date().getFullYear();

      // Get all employees
      const employees = await prisma.employee.findMany({
        select: { id: true },
      });

      // Create balances for all employees
      const results = await Promise.all(
        employees.map((emp: { id: string }) =>
          prisma.employeeLeaveBalance.upsert({
            where: {
              employeeId_leaveTypeId_year: {
                employeeId: emp.id,
                leaveTypeId: body.leaveTypeId,
                year,
              },
            },
            create: {
              employeeId: emp.id,
              leaveTypeId: body.leaveTypeId,
              year,
              balance: body.balance ?? leaveType.defaultBalance,
              carriedOver: 0,
              adjustment: 0,
            },
            update: body.overwrite
              ? {
                  balance: body.balance ?? leaveType.defaultBalance,
                }
              : {},
          }),
        ),
      );

      return {
        message: `Updated balances for ${results.length} employees`,
        count: results.length,
      };
    },
    {
      body: t.Object({
        leaveTypeId: t.String(),
        year: t.Optional(t.Number()),
        balance: t.Optional(t.Number({ minimum: 0 })),
        overwrite: t.Optional(t.Boolean()), // If true, overwrite existing balances
      }),
      detail: {
        tags: ["Leave Balances"],
        summary: "Bulk set leave balances for all employees",
      },
    },
  )

  // Delete employee balance (reset to default) - HR only
  .delete(
    "/employee/:employeeId/:leaveTypeId",
    async ({ params: { employeeId, leaveTypeId }, user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!canManageEmployees(user)) {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      const year = query.year ? parseInt(query.year) : new Date().getFullYear();

      const existing = await prisma.employeeLeaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId,
            year,
          },
        },
      });

      if (!existing) {
        set.status = 404;
        return { message: "Balance record not found" };
      }

      await prisma.employeeLeaveBalance.delete({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId,
            leaveTypeId,
            year,
          },
        },
      });

      return { message: "Balance reset to default" };
    },
    {
      params: t.Object({
        employeeId: t.String(),
        leaveTypeId: t.String(),
      }),
      query: t.Object({
        year: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Leave Balances"],
        summary: "Delete employee leave balance (reset to default)",
      },
    },
  );
