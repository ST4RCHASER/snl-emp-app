import { Elysia, t } from "elysia";
import { prisma } from "@snl-emp/db";
import { authPlugin } from "../auth/plugin.js";
import { canManageEmployees } from "../middleware/rbac.js";

export const employeeRoutes = new Elysia({ prefix: "/api/employees" })
  .use(authPlugin)

  // List all employees
  .get(
    "/",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employees = await prisma.employee.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return employees;
    },
    {
      detail: {
        tags: ["Employees"],
        summary: "List all employees",
      },
    },
  )

  // Get current user's employee profile
  .get(
    "/me",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await prisma.employee.findFirst({
        where: { userId: user.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              role: true,
            },
          },
          managementLeads: {
            include: {
              manager: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      name: true,
                      image: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!employee) {
        set.status = 404;
        return { message: "Employee profile not found" };
      }

      return employee;
    },
    {
      detail: {
        tags: ["Employees"],
        summary: "Get current user's employee profile",
      },
    },
  )

  // Update current user's profile (personal info only)
  .put(
    "/me",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await prisma.employee.findFirst({
        where: { userId: user.id },
      });

      if (!employee) {
        set.status = 404;
        return { message: "Employee profile not found" };
      }

      const updated = await prisma.employee.update({
        where: { id: employee.id },
        data: {
          fullName: body.fullName,
          nickname: body.nickname,
          phone: body.phone,
          dateOfBirth: body.dateOfBirth
            ? new Date(body.dateOfBirth)
            : undefined,
          gender: body.gender,
          addressLine1: body.addressLine1,
          addressLine2: body.addressLine2,
          city: body.city,
          state: body.state,
          postalCode: body.postalCode,
          country: body.country,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              role: true,
            },
          },
        },
      });

      return updated;
    },
    {
      body: t.Object({
        fullName: t.Optional(t.String()),
        nickname: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        dateOfBirth: t.Optional(t.String()),
        gender: t.Optional(
          t.Union([
            t.Literal("MALE"),
            t.Literal("FEMALE"),
            t.Literal("OTHER"),
            t.Null(),
          ]),
        ),
        addressLine1: t.Optional(t.String()),
        addressLine2: t.Optional(t.String()),
        city: t.Optional(t.String()),
        state: t.Optional(t.String()),
        postalCode: t.Optional(t.String()),
        country: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Employees"],
        summary: "Update current user's profile (personal info only)",
      },
    },
  )

  // Get current user's team members (employees they manage)
  .get(
    "/my-team",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      // Get current user's employee record
      const currentEmployee = await prisma.employee.findFirst({
        where: { userId: user.id },
      });

      if (!currentEmployee) {
        set.status = 404;
        return { message: "Employee profile not found" };
      }

      // Get employees managed by the current user
      const managedEmployees = await prisma.employeeManagement.findMany({
        where: { managerId: currentEmployee.id },
        include: {
          employee: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  image: true,
                  role: true,
                },
              },
            },
          },
        },
      });

      return managedEmployees.map((em) => em.employee);
    },
    {
      detail: {
        tags: ["Employees"],
        summary: "Get current user's team members (employees they manage)",
      },
    },
  )

  // Get single employee
  .get(
    "/:id",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await prisma.employee.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              role: true,
            },
          },
          managementLeads: {
            include: {
              manager: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      name: true,
                      image: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!employee) {
        set.status = 404;
        return { message: "Employee not found" };
      }

      return employee;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Employees"],
        summary: "Get employee by ID",
      },
    },
  )

  // Update employee (HR/DEVELOPER only)
  .put(
    "/:id",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!canManageEmployees(user)) {
        set.status = 403;
        return { message: "Forbidden: HR or Developer role required" };
      }

      const employee = await prisma.employee.findUnique({ where: { id } });
      if (!employee) {
        set.status = 404;
        return { message: "Employee not found" };
      }

      const updated = await prisma.employee.update({
        where: { id },
        data: {
          ...body,
          hireDate: body.hireDate ? new Date(body.hireDate) : undefined,
          startWorkDate: body.startWorkDate
            ? new Date(body.startWorkDate)
            : undefined,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
              role: true,
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
        fullName: t.Optional(t.String()),
        nickname: t.Optional(t.String()),
        avatar: t.Optional(t.String()),
        phone: t.Optional(t.String()),
        dateOfBirth: t.Optional(t.String()),
        gender: t.Optional(
          t.Union([
            t.Literal("MALE"),
            t.Literal("FEMALE"),
            t.Literal("OTHER"),
            t.Null(),
          ]),
        ),
        addressLine1: t.Optional(t.String()),
        addressLine2: t.Optional(t.String()),
        city: t.Optional(t.String()),
        state: t.Optional(t.String()),
        postalCode: t.Optional(t.String()),
        country: t.Optional(t.String()),
        department: t.Optional(t.String()),
        position: t.Optional(t.String()),
        salary: t.Optional(t.Number()),
        hireDate: t.Optional(t.String()),
        startWorkDate: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Employees"],
        summary: "Update employee (HR/Developer only)",
      },
    },
  )

  // Get employee's managers
  .get(
    "/:id/managers",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const employee = await prisma.employee.findUnique({
        where: { id },
        include: {
          managementLeads: {
            include: {
              manager: {
                include: {
                  user: {
                    select: {
                      id: true,
                      email: true,
                      name: true,
                      image: true,
                      role: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!employee) {
        set.status = 404;
        return { message: "Employee not found" };
      }

      return employee.managementLeads.map(
        (ml: { manager: unknown }) => ml.manager,
      );
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Employees"],
        summary: "Get employee's managers",
      },
    },
  )

  // Assign managers to employee (HR/DEVELOPER only)
  .put(
    "/:id/managers",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!canManageEmployees(user)) {
        set.status = 403;
        return { message: "Forbidden: HR or Developer role required" };
      }

      const employee = await prisma.employee.findUnique({ where: { id } });
      if (!employee) {
        set.status = 404;
        return { message: "Employee not found" };
      }

      // Verify all manager IDs exist and have MANAGEMENT role
      const managers = await prisma.employee.findMany({
        where: {
          id: { in: body.managerIds },
          user: { role: { in: ["MANAGEMENT", "DEVELOPER"] } },
        },
      });

      if (managers.length !== body.managerIds.length) {
        set.status = 400;
        return {
          message:
            "Some manager IDs are invalid or users don't have management role",
        };
      }

      // Delete existing assignments and create new ones
      await prisma.$transaction([
        prisma.employeeManagement.deleteMany({
          where: { employeeId: id },
        }),
        prisma.employeeManagement.createMany({
          data: body.managerIds.map((managerId) => ({
            employeeId: id,
            managerId,
          })),
        }),
      ]);

      return { message: "Managers assigned successfully" };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        managerIds: t.Array(t.String()),
      }),
      detail: {
        tags: ["Employees"],
        summary: "Assign managers to employee (HR/Developer only)",
      },
    },
  )

  // Update user role (ADMIN and DEVELOPER only)
  .put(
    "/:id/role",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      // Only ADMIN and DEVELOPER can change roles
      if (user.role !== "ADMIN" && user.role !== "DEVELOPER") {
        set.status = 403;
        return { message: "Forbidden: Admin or Developer role required" };
      }

      // ADMIN cannot assign DEVELOPER role
      if (user.role === "ADMIN" && body.role === "DEVELOPER") {
        set.status = 403;
        return {
          message: "Forbidden: Only Developer can assign Developer role",
        };
      }

      const employee = await prisma.employee.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!employee) {
        set.status = 404;
        return { message: "Employee not found" };
      }

      // Prevent changing own role
      if (employee.userId === user.id) {
        set.status = 400;
        return { message: "Cannot change your own role" };
      }

      // Update user role
      await prisma.user.update({
        where: { id: employee.userId },
        data: { role: body.role },
      });

      return { message: "Role updated successfully", role: body.role };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        role: t.Union([
          t.Literal("EMPLOYEE"),
          t.Literal("HR"),
          t.Literal("MANAGEMENT"),
          t.Literal("ADMIN"),
          t.Literal("DEVELOPER"),
        ]),
      }),
      detail: {
        tags: ["Employees"],
        summary: "Update user role (Admin/Developer only)",
      },
    },
  );
