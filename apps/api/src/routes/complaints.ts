import { Elysia, t } from "elysia";
import { prisma } from "@snl-emp/db";
import { authPlugin } from "../auth/plugin.js";
import { canManageComplaints } from "../middleware/rbac.js";

// Helper to get or create employee profile
async function getOrCreateEmployee(userId: string) {
  let employee = await prisma.employee.findUnique({
    where: { userId },
  });

  if (!employee) {
    // Auto-create employee profile
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

// Store for SSE subscribers per complaint
interface SSESubscriber {
  send: (data: string) => boolean; // returns false if failed
  cleanup: () => void;
}

const complaintSubscribers = new Map<string, Set<SSESubscriber>>();

// Broadcast message to all subscribers of a complaint
function broadcastToComplaint(
  complaintId: string,
  event: string,
  data: unknown,
) {
  const subscribers = complaintSubscribers.get(complaintId);
  if (subscribers) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const toRemove: SSESubscriber[] = [];

    subscribers.forEach((sub) => {
      const success = sub.send(message);
      if (!success) {
        toRemove.push(sub);
      }
    });

    // Clean up failed connections
    toRemove.forEach((sub) => {
      sub.cleanup();
      subscribers.delete(sub);
    });

    if (subscribers.size === 0) {
      complaintSubscribers.delete(complaintId);
    }
  }
}

export const complaintRoutes = new Elysia({ prefix: "/api/complaints" })
  .use(authPlugin)

  // List complaints
  .get(
    "/",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const isHR = user.role === "HR" || user.role === "DEVELOPER";

      let whereClause: Record<string, unknown> = {};

      if (query.view === "all" && isHR) {
        whereClause = {};
      } else {
        whereClause = { employeeId: employee.id };
      }

      if (query.status) {
        whereClause.status = query.status;
      }

      const complaints = await prisma.complaint.findMany({
        where: whereClause,
        include: {
          employee: {
            include: {
              user: {
                select: { name: true, email: true, image: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return complaints;
    },
    {
      query: t.Object({
        view: t.Optional(t.String()),
        status: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Complaints"],
        summary: "List complaints",
      },
    },
  )

  // Create complaint
  .post(
    "/",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const complaint = await prisma.complaint.create({
        data: {
          employeeId: employee.id,
          subject: body.subject,
          description: body.description,
          isAnonymous: body.isAnonymous ?? true,
        },
        include: {
          employee: {
            include: {
              user: {
                select: { name: true, email: true },
              },
            },
          },
        },
      });

      return complaint;
    },
    {
      body: t.Object({
        subject: t.String({ minLength: 1, maxLength: 200 }),
        description: t.String({ minLength: 1, maxLength: 5000 }),
        isAnonymous: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ["Complaints"],
        summary: "Create complaint",
      },
    },
  )

  // Get single complaint with messages
  .get(
    "/:id",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const complaint = await prisma.complaint.findUnique({
        where: { id },
        include: {
          employee: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!complaint) {
        set.status = 404;
        return { message: "Complaint not found" };
      }

      const isOwner = complaint.employeeId === employee.id;
      const isHR = user.role === "HR" || user.role === "DEVELOPER";

      if (!isOwner && !isHR) {
        set.status = 403;
        return { message: "Forbidden" };
      }

      // Build a map of userId to anonymous name for privacy
      const userIdToAnonName = new Map<string, string>();
      let anonIndex = 0;

      // Collect unique user IDs from messages
      const uniqueUserIds = new Set<string>();
      complaint.messages.forEach((msg) => uniqueUserIds.add(msg.userId));
      uniqueUserIds.add(complaint.employee.userId);

      // Assign anonymous names
      uniqueUserIds.forEach((uid) => {
        if (uid === complaint.employee.userId) {
          userIdToAnonName.set(uid, "Anonymous Employee");
        } else {
          userIdToAnonName.set(uid, `HR Staff ${anonIndex + 1}`);
          anonIndex++;
        }
      });

      // Transform messages with anonymized sender info
      const messagesWithSender = complaint.messages.map((msg) => {
        const isSelf = msg.userId === user.id;
        let senderName: string;

        if (isSelf) {
          senderName = "You";
        } else if (isHR) {
          if (msg.userId === complaint.employee.userId) {
            senderName = "Anonymous Employee";
          } else {
            senderName = userIdToAnonName.get(msg.userId) || "HR Staff";
          }
        } else {
          if (msg.isFromHR) {
            senderName = "HR Staff";
          } else {
            senderName = "You";
          }
        }

        return {
          id: msg.id,
          content: msg.content,
          isFromHR: msg.isFromHR,
          isSelf,
          senderName,
          attachmentUrl: msg.attachmentUrl,
          attachmentName: msg.attachmentName,
          attachmentType: msg.attachmentType,
          attachmentSize: msg.attachmentSize,
          createdAt: msg.createdAt,
        };
      });

      return {
        ...complaint,
        messages: messagesWithSender,
        employee: isHR
          ? {
              ...complaint.employee,
              user: {
                ...complaint.employee.user,
                name: "Anonymous Employee",
                email: "anonymous@company.com",
                image: null,
              },
            }
          : complaint.employee,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Complaints"],
        summary: "Get complaint by ID with messages",
      },
    },
  )

  // SSE endpoint for real-time messages
  .get(
    "/:id/stream",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);
      const isHR = user.role === "HR" || user.role === "DEVELOPER";

      const complaint = await prisma.complaint.findUnique({
        where: { id },
        include: { employee: true },
      });

      if (!complaint) {
        set.status = 404;
        return { message: "Complaint not found" };
      }

      const isOwner = complaint.employeeId === employee.id;
      if (!isOwner && !isHR) {
        set.status = 403;
        return { message: "Forbidden" };
      }

      // Track if stream is still open
      let isOpen = true;
      let pingInterval: ReturnType<typeof setInterval> | null = null;
      let subscriber: SSESubscriber | null = null;

      // Return SSE stream
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();

          const send = (data: string): boolean => {
            if (!isOpen) return false;
            try {
              controller.enqueue(encoder.encode(data));
              return true;
            } catch {
              isOpen = false;
              return false;
            }
          };

          const cleanup = () => {
            isOpen = false;
            if (pingInterval) {
              clearInterval(pingInterval);
              pingInterval = null;
            }
          };

          // Send initial connection message
          send(`event: connected\ndata: {"complaintId":"${id}"}\n\n`);

          // Create subscriber
          subscriber = { send, cleanup };

          // Add to subscribers
          if (!complaintSubscribers.has(id)) {
            complaintSubscribers.set(id, new Set());
          }
          complaintSubscribers.get(id)!.add(subscriber);

          // Keep-alive ping every 30 seconds
          pingInterval = setInterval(() => {
            if (!send(`: ping\n\n`)) {
              cleanup();
            }
          }, 30000);
        },
        cancel() {
          // Stream was cancelled by client
          isOpen = false;
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
          if (subscriber) {
            const subscribers = complaintSubscribers.get(id);
            if (subscribers) {
              subscribers.delete(subscriber);
              if (subscribers.size === 0) {
                complaintSubscribers.delete(id);
              }
            }
          }
        },
      });

      // Return Response object directly with proper headers
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin":
            process.env.FRONTEND_URL || "http://localhost:5173",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Complaints"],
        summary: "SSE stream for real-time complaint messages",
      },
    },
  )

  // Update complaint status (HR/DEVELOPER only)
  .put(
    "/:id/status",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!canManageComplaints(user)) {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      const complaint = await prisma.complaint.findUnique({
        where: { id },
      });

      if (!complaint) {
        set.status = 404;
        return { message: "Complaint not found" };
      }

      const updated = await prisma.complaint.update({
        where: { id },
        data: {
          status: body.status,
        },
        include: {
          employee: {
            include: {
              user: {
                select: { name: true, email: true },
              },
            },
          },
        },
      });

      // Broadcast status update to SSE subscribers
      broadcastToComplaint(id, "status", { status: body.status });

      return updated;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        status: t.Union([
          t.Literal("BACKLOG"),
          t.Literal("IN_PROGRESS"),
          t.Literal("DONE"),
        ]),
      }),
      detail: {
        tags: ["Complaints"],
        summary: "Update complaint status (HR only)",
      },
    },
  )

  // Update HR response (HR/DEVELOPER only) - used when chat is disabled
  .put(
    "/:id/response",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!canManageComplaints(user)) {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      const complaint = await prisma.complaint.findUnique({
        where: { id },
      });

      if (!complaint) {
        set.status = 404;
        return { message: "Complaint not found" };
      }

      const updated = await prisma.complaint.update({
        where: { id },
        data: {
          hrResponse: body.response,
          hrRespondedBy: user.id,
          hrRespondedAt: new Date(),
        },
        include: {
          employee: {
            include: {
              user: {
                select: { name: true, email: true },
              },
            },
          },
        },
      });

      return updated;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        response: t.String({ maxLength: 5000 }),
      }),
      detail: {
        tags: ["Complaints"],
        summary: "Update HR response (HR only)",
      },
    },
  )

  // Post a message to a complaint thread
  .post(
    "/:id/messages",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);
      const isHR = user.role === "HR" || user.role === "DEVELOPER";

      const complaint = await prisma.complaint.findUnique({
        where: { id },
        include: {
          employee: true,
        },
      });

      if (!complaint) {
        set.status = 404;
        return { message: "Complaint not found" };
      }

      const isOwner = complaint.employeeId === employee.id;

      if (!isOwner && !isHR) {
        set.status = 403;
        return { message: "Forbidden" };
      }

      // Create the message
      const message = await prisma.complaintMessage.create({
        data: {
          complaintId: id,
          userId: user.id,
          content: body.content,
          isFromHR: isHR,
          attachmentUrl: body.attachmentUrl,
          attachmentName: body.attachmentName,
          attachmentType: body.attachmentType,
          attachmentSize: body.attachmentSize,
        },
      });

      // Broadcast to SSE subscribers (for other users watching)
      // They will see their own appropriate sender name based on their view
      broadcastToComplaint(id, "message", {
        id: message.id,
        content: message.content,
        isFromHR: message.isFromHR,
        userId: message.userId,
        attachmentUrl: message.attachmentUrl,
        attachmentName: message.attachmentName,
        attachmentType: message.attachmentType,
        attachmentSize: message.attachmentSize,
        createdAt: message.createdAt,
      });

      return {
        id: message.id,
        content: message.content,
        isFromHR: message.isFromHR,
        isSelf: true,
        senderName: "You",
        attachmentUrl: message.attachmentUrl,
        attachmentName: message.attachmentName,
        attachmentType: message.attachmentType,
        attachmentSize: message.attachmentSize,
        createdAt: message.createdAt,
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        content: t.String({ maxLength: 5000 }),
        attachmentUrl: t.Optional(t.String()),
        attachmentName: t.Optional(t.String()),
        attachmentType: t.Optional(t.String()),
        attachmentSize: t.Optional(t.Number()),
      }),
      detail: {
        tags: ["Complaints"],
        summary: "Post a message to complaint thread",
      },
    },
  );
