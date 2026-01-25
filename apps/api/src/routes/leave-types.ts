import { Elysia, t } from "elysia";
import { prisma } from "@snl-emp/db";
import { authPlugin } from "../auth/plugin.js";
import { canManageEmployees, isDeveloper, isHR } from "../middleware/rbac.js";

export const leaveTypeRoutes = new Elysia({ prefix: "/api/leave-types" })
  .use(authPlugin)

  // List all active leave types (for all authenticated users)
  .get(
    "/",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const includeInactive =
        query.includeInactive === "true" &&
        (isHR(user) || isDeveloper(user));

      const leaveTypes = await prisma.leaveTypeConfig.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: { order: "asc" },
      });

      return leaveTypes;
    },
    {
      query: t.Object({
        includeInactive: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Leave Types"],
        summary: "List all leave types",
      },
    },
  )

  // Get single leave type
  .get(
    "/:id",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const leaveType = await prisma.leaveTypeConfig.findUnique({
        where: { id },
      });

      if (!leaveType) {
        set.status = 404;
        return { message: "Leave type not found" };
      }

      return leaveType;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Leave Types"],
        summary: "Get leave type by ID",
      },
    },
  )

  // Create leave type (HR only)
  .post(
    "/",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!canManageEmployees(user)) {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      // Check for duplicate code
      const existingCode = await prisma.leaveTypeConfig.findUnique({
        where: { code: body.code.toUpperCase() },
      });

      if (existingCode) {
        set.status = 400;
        return { message: "Leave type code already exists" };
      }

      // Get next order number
      const maxOrder = await prisma.leaveTypeConfig.aggregate({
        _max: { order: true },
      });

      const leaveType = await prisma.leaveTypeConfig.create({
        data: {
          name: body.name,
          code: body.code.toUpperCase(),
          description: body.description,
          defaultBalance: body.defaultBalance ?? 0,
          isUnlimited: body.isUnlimited ?? false,
          isPaid: body.isPaid ?? true,
          allowHalfDay: body.allowHalfDay ?? true,
          allowCarryover: body.allowCarryover ?? false,
          carryoverMax: body.carryoverMax ?? 0,
          requiresApproval: body.requiresApproval ?? true,
          color: body.color,
          icon: body.icon,
          order: (maxOrder._max.order ?? 0) + 1,
        },
      });

      return leaveType;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        code: t.String({ minLength: 1, maxLength: 20 }),
        description: t.Optional(t.String({ maxLength: 500 })),
        defaultBalance: t.Optional(t.Number({ minimum: 0 })),
        isUnlimited: t.Optional(t.Boolean()),
        isPaid: t.Optional(t.Boolean()),
        allowHalfDay: t.Optional(t.Boolean()),
        allowCarryover: t.Optional(t.Boolean()),
        carryoverMax: t.Optional(t.Number({ minimum: 0 })),
        requiresApproval: t.Optional(t.Boolean()),
        color: t.Optional(t.String()),
        icon: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Leave Types"],
        summary: "Create leave type",
      },
    },
  )

  // Update leave type (HR only)
  .patch(
    "/:id",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!canManageEmployees(user)) {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      const existing = await prisma.leaveTypeConfig.findUnique({
        where: { id },
      });

      if (!existing) {
        set.status = 404;
        return { message: "Leave type not found" };
      }

      // Check for duplicate code if code is being changed
      if (body.code && body.code.toUpperCase() !== existing.code) {
        const existingCode = await prisma.leaveTypeConfig.findUnique({
          where: { code: body.code.toUpperCase() },
        });

        if (existingCode) {
          set.status = 400;
          return { message: "Leave type code already exists" };
        }
      }

      const leaveType = await prisma.leaveTypeConfig.update({
        where: { id },
        data: {
          ...(body.name && { name: body.name }),
          ...(body.code && { code: body.code.toUpperCase() }),
          ...(body.description !== undefined && {
            description: body.description,
          }),
          ...(body.defaultBalance !== undefined && {
            defaultBalance: body.defaultBalance,
          }),
          ...(body.isUnlimited !== undefined && {
            isUnlimited: body.isUnlimited,
          }),
          ...(body.isPaid !== undefined && { isPaid: body.isPaid }),
          ...(body.allowHalfDay !== undefined && {
            allowHalfDay: body.allowHalfDay,
          }),
          ...(body.allowCarryover !== undefined && {
            allowCarryover: body.allowCarryover,
          }),
          ...(body.carryoverMax !== undefined && {
            carryoverMax: body.carryoverMax,
          }),
          ...(body.requiresApproval !== undefined && {
            requiresApproval: body.requiresApproval,
          }),
          ...(body.color !== undefined && { color: body.color }),
          ...(body.icon !== undefined && { icon: body.icon }),
          ...(body.order !== undefined && { order: body.order }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
      });

      return leaveType;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        code: t.Optional(t.String({ minLength: 1, maxLength: 20 })),
        description: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
        defaultBalance: t.Optional(t.Number({ minimum: 0 })),
        isUnlimited: t.Optional(t.Boolean()),
        isPaid: t.Optional(t.Boolean()),
        allowHalfDay: t.Optional(t.Boolean()),
        allowCarryover: t.Optional(t.Boolean()),
        carryoverMax: t.Optional(t.Number({ minimum: 0 })),
        requiresApproval: t.Optional(t.Boolean()),
        color: t.Optional(t.Nullable(t.String())),
        icon: t.Optional(t.Nullable(t.String())),
        order: t.Optional(t.Number()),
        isActive: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ["Leave Types"],
        summary: "Update leave type",
      },
    },
  )

  // Delete (soft) leave type (HR only)
  .delete(
    "/:id",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!canManageEmployees(user)) {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      const existing = await prisma.leaveTypeConfig.findUnique({
        where: { id },
      });

      if (!existing) {
        set.status = 404;
        return { message: "Leave type not found" };
      }

      // Soft delete by setting isActive to false
      await prisma.leaveTypeConfig.update({
        where: { id },
        data: { isActive: false },
      });

      return { message: "Leave type deactivated" };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Leave Types"],
        summary: "Delete (deactivate) leave type",
      },
    },
  )

  // Reorder leave types (HR only)
  .post(
    "/reorder",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!canManageEmployees(user)) {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      // Update order for each leave type
      await Promise.all(
        body.items.map((item, index) =>
          prisma.leaveTypeConfig.update({
            where: { id: item.id },
            data: { order: index },
          }),
        ),
      );

      return { message: "Leave types reordered" };
    },
    {
      body: t.Object({
        items: t.Array(
          t.Object({
            id: t.String(),
          }),
        ),
      }),
      detail: {
        tags: ["Leave Types"],
        summary: "Reorder leave types",
      },
    },
  )

  // Seed default leave types (HR only) - for initial setup
  .post(
    "/seed",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!canManageEmployees(user)) {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      // Check if leave types already exist
      const existingCount = await prisma.leaveTypeConfig.count();
      if (existingCount > 0) {
        set.status = 400;
        return { message: "Leave types already seeded" };
      }

      // Get global settings for defaults
      const settings = await prisma.globalSettings.findUnique({
        where: { id: "global" },
      });

      const defaultLeaveTypes = [
        {
          name: "Annual Leave",
          code: "ANNUAL",
          description: "Paid annual vacation days",
          defaultBalance: settings?.maxAnnualLeaveDays ?? 10,
          isPaid: true,
          allowHalfDay: true,
          allowCarryover: true,
          carryoverMax: settings?.annualLeaveCarryoverMax ?? 3,
          requiresApproval: true,
          color: "#0078d4",
          order: 0,
        },
        {
          name: "Sick Leave",
          code: "SICK",
          description: "Paid sick leave for illness or medical appointments",
          defaultBalance: settings?.maxSickLeaveDays ?? 30,
          isPaid: true,
          allowHalfDay: true,
          allowCarryover: false,
          requiresApproval: true,
          color: "#d13438",
          order: 1,
        },
        {
          name: "Personal Leave",
          code: "PERSONAL",
          description: "Paid personal days for personal matters",
          defaultBalance: settings?.maxPersonalLeaveDays ?? 7,
          isPaid: true,
          allowHalfDay: true,
          allowCarryover: false,
          requiresApproval: true,
          color: "#8764b8",
          order: 2,
        },
        {
          name: "Birthday Leave",
          code: "BIRTHDAY",
          description: "Paid day off on your birthday",
          defaultBalance: settings?.maxBirthdayLeaveDays ?? 1,
          isPaid: true,
          allowHalfDay: false,
          allowCarryover: false,
          requiresApproval: true,
          color: "#ff8c00",
          order: 3,
        },
        {
          name: "Unpaid Leave",
          code: "UNPAID",
          description: "Unpaid leave of absence",
          defaultBalance: 0,
          isUnlimited: true,
          isPaid: false,
          allowHalfDay: true,
          allowCarryover: false,
          requiresApproval: true,
          color: "#69797e",
          order: 4,
        },
        {
          name: "Other",
          code: "OTHER",
          description: "Other leave types",
          defaultBalance: 0,
          isUnlimited: true,
          isPaid: false,
          allowHalfDay: true,
          allowCarryover: false,
          requiresApproval: true,
          color: "#107c10",
          order: 5,
        },
      ];

      await prisma.leaveTypeConfig.createMany({
        data: defaultLeaveTypes,
      });

      const created = await prisma.leaveTypeConfig.findMany({
        orderBy: { order: "asc" },
      });

      return created;
    },
    {
      detail: {
        tags: ["Leave Types"],
        summary: "Seed default leave types",
      },
    },
  );
