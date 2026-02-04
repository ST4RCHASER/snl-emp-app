import { Elysia, t } from "elysia";
import { prisma } from "@snl-emp/db";
import { authPlugin } from "../auth/plugin.js";

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

// Helper to create audit log
async function createAuditLog(
  workLogId: string,
  action: "CREATED" | "UPDATED" | "DELETED",
  userId: string,
  userName: string | null,
  oldValues?: object | null,
  newValues?: object | null,
) {
  await prisma.workLogAudit.create({
    data: {
      workLogId,
      action,
      userId,
      userName,
      oldValues: oldValues || undefined,
      newValues: newValues || undefined,
    },
  });
}

export const workLogRoutes = new Elysia({ prefix: "/api/worklogs" })
  .use(authPlugin)

  // Get work logs for current user (with optional date range)
  .get(
    "/",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const whereClause: {
        employeeId: string;
        date?: { gte?: Date; lte?: Date };
      } = {
        employeeId: employee.id,
      };

      // Parse date filters
      if (query.startDate || query.endDate) {
        whereClause.date = {};
        if (query.startDate) {
          whereClause.date.gte = new Date(query.startDate);
        }
        if (query.endDate) {
          whereClause.date.lte = new Date(query.endDate);
        }
      }

      const logs = await prisma.workLog.findMany({
        where: whereClause,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: {
          auditLogs: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      return logs;
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
      }),
      detail: {
        tags: ["WorkLogs"],
        summary: "Get work logs for current user",
      },
    },
  )

  // Get work logs summary for a date range (total hours per day)
  // Only count non-deleted logs
  .get(
    "/summary",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date();
      const endDate = query.endDate ? new Date(query.endDate) : new Date();

      // Get all non-deleted logs in date range
      const logs = await prisma.workLog.findMany({
        where: {
          employeeId: employee.id,
          isDeleted: false,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          date: true,
          hours: true,
        },
      });

      // Aggregate by date
      const summary: Record<string, number> = {};
      logs.forEach((log: { date: Date; hours: number }) => {
        const dateKey = log.date.toISOString().split("T")[0];
        summary[dateKey] = (summary[dateKey] || 0) + log.hours;
      });

      return summary;
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
      }),
      detail: {
        tags: ["WorkLogs"],
        summary: "Get work hours summary per day",
      },
    },
  )

  // Create work log
  .post(
    "/",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const log = await prisma.workLog.create({
        data: {
          employeeId: employee.id,
          title: body.title,
          description: body.description,
          hours: body.hours,
          date: new Date(body.date),
          createdById: user.id,
        },
        include: {
          auditLogs: true,
        },
      });

      // Create audit log
      await createAuditLog(log.id, "CREATED", user.id, user.name, null, {
        title: body.title,
        description: body.description,
        hours: body.hours,
        date: body.date,
      });

      // Refetch to include audit log
      const logWithAudit = await prisma.workLog.findUnique({
        where: { id: log.id },
        include: { auditLogs: { orderBy: { createdAt: "asc" } } },
      });

      return logWithAudit;
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 200 }),
        description: t.Optional(t.String({ maxLength: 5000 })),
        hours: t.Number({ minimum: 0.25, maximum: 24 }),
        date: t.String(), // ISO date string
      }),
      detail: {
        tags: ["WorkLogs"],
        summary: "Create work log entry",
      },
    },
  )

  // Update work log
  .put(
    "/:id",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      // Check ownership
      const existing = await prisma.workLog.findUnique({
        where: { id },
      });

      if (!existing) {
        set.status = 404;
        return { message: "Work log not found" };
      }

      if (existing.isDeleted) {
        set.status = 400;
        return { message: "Cannot edit a deleted work log" };
      }

      // Only owner or manager can edit
      const isOwner = existing.employeeId === employee.id;
      const isManager = user.role === "MANAGEMENT" || user.role === "DEVELOPER";

      if (!isOwner && !isManager) {
        set.status = 403;
        return { message: "Forbidden" };
      }

      // Store old values for audit
      const oldValues = {
        title: existing.title,
        description: existing.description,
        hours: existing.hours,
        date: existing.date.toISOString().split("T")[0],
      };

      const log = await prisma.workLog.update({
        where: { id },
        data: {
          title: body.title,
          description: body.description,
          hours: body.hours,
          date: new Date(body.date),
        },
      });

      // Create audit log
      await createAuditLog(log.id, "UPDATED", user.id, user.name, oldValues, {
        title: body.title,
        description: body.description,
        hours: body.hours,
        date: body.date,
      });

      // Return with audit logs
      const logWithAudit = await prisma.workLog.findUnique({
        where: { id: log.id },
        include: { auditLogs: { orderBy: { createdAt: "asc" } } },
      });

      return logWithAudit;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 200 }),
        description: t.Optional(t.String({ maxLength: 5000 })),
        hours: t.Number({ minimum: 0.25, maximum: 24 }),
        date: t.String(),
      }),
      detail: {
        tags: ["WorkLogs"],
        summary: "Update work log entry",
      },
    },
  )

  // Delete work log (soft delete)
  .delete(
    "/:id",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const existing = await prisma.workLog.findUnique({
        where: { id },
      });

      if (!existing) {
        set.status = 404;
        return { message: "Work log not found" };
      }

      if (existing.isDeleted) {
        set.status = 400;
        return { message: "Work log already deleted" };
      }

      // Only owner or manager can delete
      const isOwner = existing.employeeId === employee.id;
      const isManager = user.role === "MANAGEMENT" || user.role === "DEVELOPER";

      if (!isOwner && !isManager) {
        set.status = 403;
        return { message: "Forbidden" };
      }

      // Soft delete
      await prisma.workLog.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedById: user.id,
        },
      });

      // Create audit log
      await createAuditLog(
        id,
        "DELETED",
        user.id,
        user.name,
        {
          title: existing.title,
          description: existing.description,
          hours: existing.hours,
          date: existing.date.toISOString().split("T")[0],
        },
        null,
      );

      return { message: "Deleted" };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["WorkLogs"],
        summary: "Delete work log entry (soft delete)",
      },
    },
  )

  // Get audit history for a work log
  .get(
    "/:id/audit",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const workLog = await prisma.workLog.findUnique({
        where: { id },
        include: {
          employee: true,
        },
      });

      if (!workLog) {
        set.status = 404;
        return { message: "Work log not found" };
      }

      // Check access - owner or manager
      const isOwner = workLog.employeeId === employee.id;
      const isManager = user.role === "MANAGEMENT" || user.role === "DEVELOPER";

      if (!isOwner && !isManager) {
        set.status = 403;
        return { message: "Forbidden" };
      }

      const auditLogs = await prisma.workLogAudit.findMany({
        where: { workLogId: id },
        orderBy: { createdAt: "asc" },
      });

      return auditLogs;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["WorkLogs"],
        summary: "Get audit history for a work log",
      },
    },
  )

  // ==================== MANAGEMENT ENDPOINTS ====================

  // Get team members (for managers)
  .get(
    "/team",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (user.role !== "MANAGEMENT" && user.role !== "DEVELOPER") {
        set.status = 403;
        return { message: "Forbidden: Management role required" };
      }

      const manager = await getOrCreateEmployee(user.id);

      // Get employees managed by this manager
      const managedEmployees = await prisma.employeeManagement.findMany({
        where: { managerId: manager.id },
        include: {
          employee: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
        },
      });

      return managedEmployees.map((m: { employee: unknown }) => m.employee);
    },
    {
      detail: {
        tags: ["WorkLogs"],
        summary: "Get team members for manager",
      },
    },
  )

  // Get work logs for a specific employee (for managers)
  .get(
    "/team/:employeeId",
    async ({ params: { employeeId }, query, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (user.role !== "MANAGEMENT" && user.role !== "DEVELOPER") {
        set.status = 403;
        return { message: "Forbidden: Management role required" };
      }

      const manager = await getOrCreateEmployee(user.id);

      // Check if this employee is managed by the current user
      const isManaging = await prisma.employeeManagement.findFirst({
        where: {
          managerId: manager.id,
          employeeId: employeeId,
        },
      });

      // Developer can see all, Management only their team
      if (!isManaging && user.role !== "DEVELOPER") {
        set.status = 403;
        return { message: "Not authorized to view this employee" };
      }

      const whereClause: {
        employeeId: string;
        date?: { gte?: Date; lte?: Date };
      } = {
        employeeId,
      };

      if (query.startDate || query.endDate) {
        whereClause.date = {};
        if (query.startDate) {
          whereClause.date.gte = new Date(query.startDate);
        }
        if (query.endDate) {
          whereClause.date.lte = new Date(query.endDate);
        }
      }

      const logs = await prisma.workLog.findMany({
        where: whereClause,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: {
          auditLogs: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      return logs;
    },
    {
      params: t.Object({
        employeeId: t.String(),
      }),
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
      }),
      detail: {
        tags: ["WorkLogs"],
        summary: "Get work logs for a team member",
      },
    },
  )

  // Get team summary (hours per employee per day)
  // Only count non-deleted logs
  .get(
    "/team/summary",
    async ({ query, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (user.role !== "MANAGEMENT" && user.role !== "DEVELOPER") {
        set.status = 403;
        return { message: "Forbidden: Management role required" };
      }

      const manager = await getOrCreateEmployee(user.id);

      // Get team members
      let employeeIds: string[];

      if (user.role === "DEVELOPER") {
        // Developer can see all employees
        const allEmployees = await prisma.employee.findMany({
          select: { id: true },
        });
        employeeIds = allEmployees.map((e: { id: string }) => e.id);
      } else {
        const managedEmployees = await prisma.employeeManagement.findMany({
          where: { managerId: manager.id },
          select: { employeeId: true },
        });
        employeeIds = managedEmployees.map(
          (m: { employeeId: string }) => m.employeeId,
        );
      }

      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date();
      const endDate = query.endDate ? new Date(query.endDate) : new Date();

      // Get all non-deleted logs for team in date range
      const logs = await prisma.workLog.findMany({
        where: {
          employeeId: { in: employeeIds },
          isDeleted: false,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          employeeId: true,
          date: true,
          hours: true,
        },
      });

      // Aggregate by employee and date
      const summary: Record<string, Record<string, number>> = {};
      logs.forEach((log: { employeeId: string; date: Date; hours: number }) => {
        const dateKey = log.date.toISOString().split("T")[0];
        if (!summary[log.employeeId]) {
          summary[log.employeeId] = {};
        }
        summary[log.employeeId][dateKey] =
          (summary[log.employeeId][dateKey] || 0) + log.hours;
      });

      return summary;
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
      }),
      detail: {
        tags: ["WorkLogs"],
        summary: "Get team work hours summary",
      },
    },
  )

  // Create work log for a team member (manager only)
  .post(
    "/team/:employeeId",
    async ({ params: { employeeId }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (user.role !== "MANAGEMENT" && user.role !== "DEVELOPER") {
        set.status = 403;
        return { message: "Forbidden: Management role required" };
      }

      const manager = await getOrCreateEmployee(user.id);

      // Check if this employee is managed by the current user
      const isManaging = await prisma.employeeManagement.findFirst({
        where: {
          managerId: manager.id,
          employeeId: employeeId,
        },
      });

      if (!isManaging && user.role !== "DEVELOPER") {
        set.status = 403;
        return { message: "Not authorized to add work for this employee" };
      }

      // Verify employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        set.status = 404;
        return { message: "Employee not found" };
      }

      const log = await prisma.workLog.create({
        data: {
          employeeId: employeeId,
          title: body.title,
          description: body.description,
          hours: body.hours,
          date: new Date(body.date),
          createdById: user.id, // Track that manager created this
        },
      });

      // Create audit log
      await createAuditLog(log.id, "CREATED", user.id, user.name, null, {
        title: body.title,
        description: body.description,
        hours: body.hours,
        date: body.date,
      });

      // Return with audit logs
      const logWithAudit = await prisma.workLog.findUnique({
        where: { id: log.id },
        include: { auditLogs: { orderBy: { createdAt: "asc" } } },
      });

      return logWithAudit;
    },
    {
      params: t.Object({
        employeeId: t.String(),
      }),
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 200 }),
        description: t.Optional(t.String({ maxLength: 5000 })),
        hours: t.Number({ minimum: 0.25, maximum: 24 }),
        date: t.String(),
      }),
      detail: {
        tags: ["WorkLogs"],
        summary: "Create work log for a team member",
      },
    },
  );
