import { Elysia, t } from "elysia";
import { prisma } from "@snl-emp/db";
import { authPlugin } from "../auth/plugin.js";

export const announcementRoutes = new Elysia({ prefix: "/api/announcements" })
  .use(authPlugin)

  // List all active announcements (for all users)
  .get(
    "/",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const isHR =
        user.role === "HR" ||
        user.role === "ADMIN" ||
        user.role === "DEVELOPER";

      const announcements = await prisma.announcement.findMany({
        where: isHR ? {} : { isActive: true },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      });

      // Get user's read receipts
      const readReceipts = await prisma.announcementRead.findMany({
        where: {
          userId: user.id,
          announcementId: {
            in: announcements.map((a: { id: string }) => a.id),
          },
        },
      });

      const readMap = new Map(
        readReceipts.map((r: { announcementId: string; readAt: Date }) => [
          r.announcementId,
          r.readAt,
        ]),
      );

      // Add isRead flag to each announcement
      const announcementsWithReadStatus = announcements.map(
        (announcement: { id: string; updatedAt: Date }) => {
          const readAt = readMap.get(announcement.id);
          const isRead = readAt ? readAt >= announcement.updatedAt : false;
          return {
            ...announcement,
            isRead,
          };
        },
      );

      return announcementsWithReadStatus;
    },
    {
      detail: {
        tags: ["Announcements"],
        summary: "List all announcements",
      },
    },
  )

  // Check for unread announcements (for auto-launch)
  .get(
    "/unread",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      // Get all active announcements
      const announcements = await prisma.announcement.findMany({
        where: { isActive: true },
        select: { id: true, updatedAt: true },
      });

      if (announcements.length === 0) {
        return { hasUnread: false, unreadCount: 0 };
      }

      // Get user's read receipts
      const readReceipts = await prisma.announcementRead.findMany({
        where: {
          userId: user.id,
          announcementId: {
            in: announcements.map((a: { id: string }) => a.id),
          },
        },
      });

      const readMap = new Map(
        readReceipts.map((r: { announcementId: string; readAt: Date }) => [
          r.announcementId,
          r.readAt,
        ]),
      );

      // Check for unread or updated announcements
      let unreadCount = 0;
      for (const announcement of announcements) {
        const readAt = readMap.get(announcement.id);
        if (!readAt || readAt < announcement.updatedAt) {
          unreadCount++;
        }
      }

      return {
        hasUnread: unreadCount > 0,
        unreadCount,
      };
    },
    {
      detail: {
        tags: ["Announcements"],
        summary: "Check for unread announcements",
      },
    },
  )

  // Mark announcement as read
  .post(
    "/:id/read",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const announcement = await prisma.announcement.findUnique({
        where: { id },
      });

      if (!announcement) {
        set.status = 404;
        return { message: "Announcement not found" };
      }

      // Upsert read receipt
      await prisma.announcementRead.upsert({
        where: {
          announcementId_userId: {
            announcementId: id,
            userId: user.id,
          },
        },
        create: {
          announcementId: id,
          userId: user.id,
        },
        update: {
          readAt: new Date(),
        },
      });

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Announcements"],
        summary: "Mark announcement as read",
      },
    },
  )

  // Mark all announcements as read
  .post(
    "/read-all",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const announcements = await prisma.announcement.findMany({
        where: { isActive: true },
        select: { id: true },
      });

      // Create read receipts for all announcements
      await Promise.all(
        announcements.map((announcement: { id: string }) =>
          prisma.announcementRead.upsert({
            where: {
              announcementId_userId: {
                announcementId: announcement.id,
                userId: user.id,
              },
            },
            create: {
              announcementId: announcement.id,
              userId: user.id,
            },
            update: {
              readAt: new Date(),
            },
          }),
        ),
      );

      return { success: true };
    },
    {
      detail: {
        tags: ["Announcements"],
        summary: "Mark all announcements as read",
      },
    },
  )

  // Create announcement (HR only)
  .post(
    "/",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (user.role !== "HR" && user.role !== "DEVELOPER") {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      // Shift all existing announcements down by 1 to make room at the top
      await prisma.announcement.updateMany({
        data: {
          order: { increment: 1 },
        },
      });

      // Create new announcement at the top (order 0)
      const announcement = await prisma.announcement.create({
        data: {
          title: body.title,
          content: body.content,
          images: body.images || [],
          order: 0,
          createdBy: user.id,
        },
      });

      // Return with isRead flag (creator has read it)
      return { ...announcement, isRead: true };
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 200 }),
        content: t.String({ minLength: 1 }),
        images: t.Optional(t.Array(t.String())),
      }),
      detail: {
        tags: ["Announcements"],
        summary: "Create announcement (HR only)",
      },
    },
  )

  // Update announcement (HR only)
  .put(
    "/:id",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (user.role !== "HR" && user.role !== "DEVELOPER") {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      const announcement = await prisma.announcement.findUnique({
        where: { id },
      });

      if (!announcement) {
        set.status = 404;
        return { message: "Announcement not found" };
      }

      const updated = await prisma.announcement.update({
        where: { id },
        data: {
          title: body.title,
          content: body.content,
          images: body.images,
          isActive: body.isActive,
        },
      });

      // Return with isRead flag (editor has read it)
      return { ...updated, isRead: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        content: t.Optional(t.String({ minLength: 1 })),
        images: t.Optional(t.Array(t.String())),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ["Announcements"],
        summary: "Update announcement (HR only)",
      },
    },
  )

  // Reorder announcements (HR only)
  .put(
    "/reorder",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (user.role !== "HR" && user.role !== "DEVELOPER") {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      // Update order for each announcement
      await Promise.all(
        body.orders.map((item, index) =>
          prisma.announcement.update({
            where: { id: item.id },
            data: { order: index },
          }),
        ),
      );

      return { success: true };
    },
    {
      body: t.Object({
        orders: t.Array(
          t.Object({
            id: t.String(),
          }),
        ),
      }),
      detail: {
        tags: ["Announcements"],
        summary: "Reorder announcements (HR only)",
      },
    },
  )

  // Delete announcement (HR only)
  .delete(
    "/:id",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (user.role !== "HR" && user.role !== "DEVELOPER") {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      const announcement = await prisma.announcement.findUnique({
        where: { id },
      });

      if (!announcement) {
        set.status = 404;
        return { message: "Announcement not found" };
      }

      await prisma.announcement.delete({
        where: { id },
      });

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Announcements"],
        summary: "Delete announcement (HR only)",
      },
    },
  );
