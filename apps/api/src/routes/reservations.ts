import { Elysia, t } from "elysia";
import { prisma } from "@snl-emp/db";
import { authPlugin } from "../auth/plugin.js";
import { isManagement, isDeveloper } from "../middleware/rbac.js";

// Helper to get or create employee profile
async function getOrCreateEmployee(userId: string) {
  let employee = await prisma.employee.findUnique({
    where: { userId },
    include: {
      user: { select: { name: true, email: true, image: true } },
    },
  });

  if (!employee) {
    const count = await prisma.employee.count();
    employee = await prisma.employee.create({
      data: {
        userId,
        employeeId: `EMP-${String(count + 1).padStart(5, "0")}`,
      },
      include: {
        user: { select: { name: true, email: true, image: true } },
      },
    });
  }

  return employee;
}

export const reservationRoutes = new Elysia({ prefix: "/api/reservations" })
  .use(authPlugin)

  // Get all team members available for reservation (employees under managers)
  .get(
    "/resources",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!isManagement(user) && !isDeveloper(user)) {
        set.status = 403;
        return { message: "Forbidden: Management role required" };
      }

      // Get all employees who have a manager (are resources)
      const resources = await prisma.employee.findMany({
        where: {
          managementLeads: {
            some: {}, // Has at least one manager
          },
        },
        include: {
          user: { select: { name: true, email: true, image: true } },
          managementLeads: {
            include: {
              manager: {
                include: {
                  user: { select: { name: true, email: true, image: true } },
                },
              },
            },
          },
        },
        orderBy: [{ fullName: "asc" }, { user: { name: "asc" } }],
      });

      return resources.map(
        (emp: {
          id: string;
          employeeId: string;
          fullName: string | null;
          avatar: string | null;
          department: string | null;
          position: string | null;
          user: { name: string | null; email: string; image: string | null };
          managementLeads: Array<{
            manager: {
              id: string;
              fullName: string | null;
              avatar: string | null;
              user: {
                name: string | null;
                email: string;
                image: string | null;
              };
            };
          }>;
        }) => ({
          id: emp.id,
          employeeId: emp.employeeId,
          name: emp.fullName || emp.user.name || emp.user.email,
          avatar: emp.avatar || emp.user.image,
          department: emp.department,
          position: emp.position,
          managers: emp.managementLeads.map((ml) => ({
            id: ml.manager.id,
            name:
              ml.manager.fullName ||
              ml.manager.user.name ||
              ml.manager.user.email,
            avatar: ml.manager.avatar || ml.manager.user.image,
          })),
        }),
      );
    },
    {
      detail: {
        tags: ["Reservations"],
        summary: "Get all available resources (employees with managers)",
      },
    },
  )

  // Get reservations for a resource in a date range
  .get(
    "/resource/:resourceId",
    async ({ params: { resourceId }, query, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!isManagement(user) && !isDeveloper(user)) {
        set.status = 403;
        return { message: "Forbidden: Management role required" };
      }

      const startDate = query.startDate
        ? new Date(query.startDate)
        : new Date();
      const endDate = query.endDate
        ? new Date(query.endDate)
        : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

      const reservations = await prisma.resourceReservation.findMany({
        where: {
          resourceEmployeeId: resourceId,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          resourceEmployee: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
          resourceOwner: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
          requester: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
        },
        orderBy: { date: "asc" },
      });

      return reservations;
    },
    {
      params: t.Object({
        resourceId: t.String(),
      }),
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Reservations"],
        summary: "Get reservations for a resource",
      },
    },
  )

  // Get my team's reservations (as resource owner - for approval)
  .get(
    "/my-team",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!isManagement(user) && !isDeveloper(user)) {
        set.status = 403;
        return { message: "Forbidden: Management role required" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const statusFilter = query.status || undefined;

      const reservations = await prisma.resourceReservation.findMany({
        where: {
          resourceOwnerId: employee.id,
          ...(statusFilter && {
            status: statusFilter as
              | "PENDING"
              | "APPROVED"
              | "REJECTED"
              | "CANCELLED",
          }),
        },
        include: {
          resourceEmployee: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
          requester: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
        },
        orderBy: [{ status: "asc" }, { date: "asc" }],
      });

      return reservations;
    },
    {
      query: t.Object({
        status: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Reservations"],
        summary: "Get reservations for my team (as resource owner)",
      },
    },
  )

  // Get reservations where I am the resource (my time being reserved by others)
  .get(
    "/my-time",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const startDate = query.startDate ? new Date(query.startDate) : undefined;
      const endDate = query.endDate ? new Date(query.endDate) : undefined;

      const reservations = await prisma.resourceReservation.findMany({
        where: {
          resourceEmployeeId: employee.id,
          status: "APPROVED",
          ...(startDate &&
            endDate && {
              date: {
                gte: startDate,
                lte: endDate,
              },
            }),
          ...(startDate &&
            !endDate && {
              date: {
                gte: startDate,
              },
            }),
        },
        include: {
          resourceOwner: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
          requester: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
        },
        orderBy: { date: "asc" },
      });

      return reservations;
    },
    {
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Reservations"],
        summary: "Get reservations where I am the resource",
      },
    },
  )

  // Get my requests (as requester)
  .get(
    "/my-requests",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!isManagement(user) && !isDeveloper(user)) {
        set.status = 403;
        return { message: "Forbidden: Management role required" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const reservations = await prisma.resourceReservation.findMany({
        where: {
          requesterId: employee.id,
        },
        include: {
          resourceEmployee: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
          resourceOwner: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
        },
        orderBy: [{ status: "asc" }, { date: "asc" }],
      });

      return reservations;
    },
    {
      detail: {
        tags: ["Reservations"],
        summary: "Get my reservation requests",
      },
    },
  )

  // Create a reservation request
  .post(
    "/",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!isManagement(user) && !isDeveloper(user)) {
        set.status = 403;
        return { message: "Forbidden: Management role required" };
      }

      const requester = await getOrCreateEmployee(user.id);

      // Get the resource employee and their manager
      const resource = await prisma.employee.findUnique({
        where: { id: body.resourceEmployeeId },
        include: {
          managementLeads: {
            include: { manager: true },
          },
        },
      });

      if (!resource) {
        set.status = 404;
        return { message: "Resource employee not found" };
      }

      if (resource.managementLeads.length === 0) {
        set.status = 400;
        return { message: "Resource employee has no manager" };
      }

      // Get the first manager as the resource owner
      const resourceOwner = resource.managementLeads[0].manager;

      // Check if requester is trying to reserve their own team member
      if (resourceOwner.id === requester.id) {
        set.status = 400;
        return { message: "Cannot reserve your own team member" };
      }

      // Get settings
      const settings = await prisma.globalSettings.findUnique({
        where: { id: "global" },
      });
      const requiresApproval = settings?.reservationRequiresApproval ?? true;

      // Auto-approve if approval is not required
      const initialStatus = requiresApproval ? "PENDING" : "APPROVED";

      const reservation = await prisma.resourceReservation.create({
        data: {
          resourceEmployeeId: body.resourceEmployeeId,
          resourceOwnerId: resourceOwner.id,
          requesterId: requester.id,
          date: new Date(body.date),
          hours: body.hours,
          title: body.title,
          description: body.description,
          status: initialStatus,
          ...(initialStatus === "APPROVED" && { respondedAt: new Date() }),
        },
        include: {
          resourceEmployee: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
          resourceOwner: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
          requester: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
        },
      });

      return reservation;
    },
    {
      body: t.Object({
        resourceEmployeeId: t.String(),
        date: t.String(),
        hours: t.Number({ minimum: 0.5, maximum: 24 }),
        title: t.String({ minLength: 1, maxLength: 200 }),
        description: t.Optional(t.String({ maxLength: 1000 })),
      }),
      detail: {
        tags: ["Reservations"],
        summary: "Create a reservation request",
      },
    },
  )

  // Update a reservation (requester or resource owner can edit anytime)
  .put(
    "/:id",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const reservation = await prisma.resourceReservation.findUnique({
        where: { id },
        include: {
          resourceEmployee: true,
        },
      });

      if (!reservation) {
        set.status = 404;
        return { message: "Reservation not found" };
      }

      const isRequester = reservation.requesterId === employee.id;
      const isResourceOwner = reservation.resourceEmployeeId === employee.id;

      // Only requester or resource owner can edit
      if (!isRequester && !isResourceOwner && !isDeveloper(user)) {
        set.status = 403;
        return {
          message:
            "Only the requester or resource owner can edit this reservation",
        };
      }

      const updatedReservation = await prisma.resourceReservation.update({
        where: { id },
        data: {
          hours: body.hours,
          title: body.title,
          description: body.description,
        },
        include: {
          resourceEmployee: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
          resourceOwner: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
          requester: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
        },
      });

      return updatedReservation;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        hours: t.Number({ minimum: 0.5, maximum: 24 }),
        title: t.String({ minLength: 1, maxLength: 200 }),
        description: t.Optional(t.String({ maxLength: 1000 })),
      }),
      detail: {
        tags: ["Reservations"],
        summary: "Update a reservation (requester only)",
      },
    },
  )

  // Approve or reject a reservation (resource owner only)
  .post(
    "/:id/respond",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!isManagement(user) && !isDeveloper(user)) {
        set.status = 403;
        return { message: "Forbidden: Management role required" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const reservation = await prisma.resourceReservation.findUnique({
        where: { id },
      });

      if (!reservation) {
        set.status = 404;
        return { message: "Reservation not found" };
      }

      // Only resource owner can respond
      if (reservation.resourceOwnerId !== employee.id && !isDeveloper(user)) {
        set.status = 403;
        return {
          message: "Only the resource owner can respond to this reservation",
        };
      }

      if (reservation.status !== "PENDING") {
        set.status = 400;
        return { message: "Reservation is not pending" };
      }

      const updatedReservation = await prisma.resourceReservation.update({
        where: { id },
        data: {
          status: body.approved ? "APPROVED" : "REJECTED",
          comment: body.comment,
          respondedAt: new Date(),
        },
        include: {
          resourceEmployee: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
          resourceOwner: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
          requester: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
        },
      });

      return updatedReservation;
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
        tags: ["Reservations"],
        summary: "Approve or reject a reservation",
      },
    },
  )

  // Cancel a reservation (requester only)
  .delete(
    "/:id",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await getOrCreateEmployee(user.id);

      const reservation = await prisma.resourceReservation.findUnique({
        where: { id },
      });

      if (!reservation) {
        set.status = 404;
        return { message: "Reservation not found" };
      }

      // Only requester can cancel
      if (reservation.requesterId !== employee.id && !isDeveloper(user)) {
        set.status = 403;
        return { message: "Only the requester can cancel this reservation" };
      }

      if (reservation.status === "CANCELLED") {
        set.status = 400;
        return { message: "Reservation is already cancelled" };
      }

      await prisma.resourceReservation.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      return { message: "Reservation cancelled" };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Reservations"],
        summary: "Cancel a reservation",
      },
    },
  );
