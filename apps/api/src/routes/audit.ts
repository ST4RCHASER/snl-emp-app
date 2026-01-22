import { Elysia, t } from "elysia";
import { prisma } from "@snl-emp/db";
import { authPlugin } from "../auth/plugin.js";
import type { User } from "../auth/index.js";

// Helper to check if user is a developer
function isDeveloper(user: User | null): boolean {
  return user?.role === "DEVELOPER";
}

export const auditRoutes = new Elysia({ prefix: "/api/audit" })
  .use(authPlugin)

  // Get action logs (DEVELOPER only)
  .get(
    "/actions",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!isDeveloper(user)) {
        set.status = 403;
        return { message: "Forbidden: Developer role required" };
      }

      const { page = 1, limit = 50, category, action, userId, search } = query;
      const skip = (page - 1) * limit;

      const where: {
        category?: string;
        action?: string;
        userId?: string;
        OR?: Array<
          | { description?: { contains: string; mode: "insensitive" } }
          | { action?: { contains: string; mode: "insensitive" } }
        >;
      } = {};

      if (category) where.category = category;
      if (action) where.action = action;
      if (userId) where.userId = userId;
      if (search) {
        where.OR = [
          { description: { contains: search, mode: "insensitive" } },
          { action: { contains: search, mode: "insensitive" } },
        ];
      }

      const [logs, total] = await Promise.all([
        prisma.actionLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.actionLog.count({ where }),
      ]);

      // Get user details for logs
      const userIds = [
        ...new Set(logs.map((log) => log.userId).filter(Boolean)),
      ] as string[];
      const users =
        userIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, email: true, image: true },
            })
          : [];

      const userMap = new Map(users.map((u) => [u.id, u]));

      const logsWithUser = logs.map((log) => ({
        ...log,
        user: log.userId ? userMap.get(log.userId) || null : null,
      }));

      return {
        logs: logsWithUser,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1, default: 1 })),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 50 })),
        category: t.Optional(t.String()),
        action: t.Optional(t.String()),
        userId: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Audit"],
        summary: "Get action logs (Developer only)",
      },
    },
  )

  // Get API logs (DEVELOPER only)
  .get(
    "/api-logs",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!isDeveloper(user)) {
        set.status = 403;
        return { message: "Forbidden: Developer role required" };
      }

      const {
        page = 1,
        limit = 50,
        method,
        path,
        statusCode,
        userId,
        search,
      } = query;
      const skip = (page - 1) * limit;

      const where: {
        method?: string;
        path?: { contains: string };
        statusCode?: number;
        userId?: string;
        OR?: Array<
          | { path?: { contains: string; mode: "insensitive" } }
          | { error?: { contains: string; mode: "insensitive" } }
        >;
      } = {};

      if (method) where.method = method;
      if (path) where.path = { contains: path };
      if (statusCode) where.statusCode = statusCode;
      if (userId) where.userId = userId;
      if (search) {
        where.OR = [
          { path: { contains: search, mode: "insensitive" } },
          { error: { contains: search, mode: "insensitive" } },
        ];
      }

      const [logs, total] = await Promise.all([
        prisma.apiLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.apiLog.count({ where }),
      ]);

      // Get user details for logs
      const userIds = [
        ...new Set(logs.map((log) => log.userId).filter(Boolean)),
      ] as string[];
      const users =
        userIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, email: true, image: true },
            })
          : [];

      const userMap = new Map(users.map((u) => [u.id, u]));

      const logsWithUser = logs.map((log) => ({
        ...log,
        user: log.userId ? userMap.get(log.userId) || null : null,
      }));

      return {
        logs: logsWithUser,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
    {
      query: t.Object({
        page: t.Optional(t.Number({ minimum: 1, default: 1 })),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 50 })),
        method: t.Optional(t.String()),
        path: t.Optional(t.String()),
        statusCode: t.Optional(t.Number()),
        userId: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Audit"],
        summary: "Get API logs (Developer only)",
      },
    },
  )

  // Log an action (from frontend)
  .post(
    "/actions",
    async ({ body, user, set, request }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const log = await prisma.actionLog.create({
        data: {
          userId: user.id,
          action: body.action,
          category: body.category,
          description: body.description,
          metadata: body.metadata,
          ipAddress:
            request.headers.get("x-forwarded-for") ||
            request.headers.get("x-real-ip") ||
            undefined,
          userAgent: request.headers.get("user-agent") || undefined,
        },
      });

      return log;
    },
    {
      body: t.Object({
        action: t.String(),
        category: t.String(),
        description: t.Optional(t.String()),
        metadata: t.Optional(t.Any()),
      }),
      detail: {
        tags: ["Audit"],
        summary: "Log a user action",
      },
    },
  )

  // Get action log stats (DEVELOPER only)
  .get(
    "/stats",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!isDeveloper(user)) {
        set.status = 403;
        return { message: "Forbidden: Developer role required" };
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today);
      thisWeek.setDate(thisWeek.getDate() - 7);

      const [
        totalActions,
        totalApiLogs,
        actionsToday,
        apiLogsToday,
        actionsThisWeek,
        apiLogsThisWeek,
        errorCount,
        topActions,
        topEndpoints,
      ] = await Promise.all([
        prisma.actionLog.count(),
        prisma.apiLog.count(),
        prisma.actionLog.count({ where: { createdAt: { gte: today } } }),
        prisma.apiLog.count({ where: { createdAt: { gte: today } } }),
        prisma.actionLog.count({ where: { createdAt: { gte: thisWeek } } }),
        prisma.apiLog.count({ where: { createdAt: { gte: thisWeek } } }),
        prisma.apiLog.count({ where: { statusCode: { gte: 400 } } }),
        prisma.actionLog.groupBy({
          by: ["action"],
          _count: { action: true },
          orderBy: { _count: { action: "desc" } },
          take: 10,
        }),
        prisma.apiLog.groupBy({
          by: ["path"],
          _count: { path: true },
          orderBy: { _count: { path: "desc" } },
          take: 10,
        }),
      ]);

      return {
        totalActions,
        totalApiLogs,
        actionsToday,
        apiLogsToday,
        actionsThisWeek,
        apiLogsThisWeek,
        errorCount,
        topActions: topActions.map((a) => ({
          action: a.action,
          count: a._count.action,
        })),
        topEndpoints: topEndpoints.map((e) => ({
          path: e.path,
          count: e._count.path,
        })),
      };
    },
    {
      detail: {
        tags: ["Audit"],
        summary: "Get audit log statistics (Developer only)",
      },
    },
  );
