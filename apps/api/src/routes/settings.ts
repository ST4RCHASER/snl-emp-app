import { Elysia, t } from "elysia";
import { prisma } from "@snl-emp/db";
import { authPlugin } from "../auth/plugin.js";
import { canManageSettings, isDeveloper } from "../middleware/rbac.js";

export const settingsRoutes = new Elysia({ prefix: "/api/settings" })
  .use(authPlugin)

  // Get global settings
  .get(
    "/",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      let settings = await prisma.globalSettings.findUnique({
        where: { id: "global" },
      });

      if (!settings) {
        settings = await prisma.globalSettings.create({
          data: {
            id: "global",
          },
        });
      }

      return settings;
    },
    {
      detail: {
        tags: ["Settings"],
        summary: "Get global settings",
      },
    },
  )

  // Update global settings (HR/DEVELOPER only)
  .put(
    "/",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!canManageSettings(user)) {
        set.status = 403;
        return { message: "Forbidden: HR role required" };
      }

      const settings = await prisma.globalSettings.upsert({
        where: { id: "global" },
        update: body,
        create: {
          id: "global",
          ...body,
        },
      });

      return settings;
    },
    {
      body: t.Object({
        maxConsecutiveLeaveDays: t.Optional(t.Number({ minimum: 1 })),
        maxAnnualLeaveDays: t.Optional(t.Number({ minimum: 0 })),
        maxSickLeaveDays: t.Optional(t.Number({ minimum: 0 })),
        maxPersonalLeaveDays: t.Optional(t.Number({ minimum: 0 })),
        maxBirthdayLeaveDays: t.Optional(t.Number({ minimum: 0 })),
        annualLeaveCarryoverMax: t.Optional(t.Number({ minimum: 0 })),
        fiscalYearStartMonth: t.Optional(t.Number({ minimum: 1, maximum: 12 })),
        workHoursPerDay: t.Optional(t.Number({ minimum: 1, maximum: 24 })),
        complaintChatEnabled: t.Optional(t.Boolean()),
        reservationRequiresApproval: t.Optional(t.Boolean()),
      }),
      detail: {
        tags: ["Settings"],
        summary: "Update global settings (HR only)",
      },
    },
  )

  // Get maintenance mode status (public, no auth required for checking)
  .get(
    "/maintenance",
    async () => {
      const settings = await prisma.globalSettings.findUnique({
        where: { id: "global" },
        select: {
          maintenanceMode: true,
          maintenanceMessage: true,
        },
      });

      return {
        maintenanceMode: settings?.maintenanceMode ?? false,
        maintenanceMessage: settings?.maintenanceMessage ?? null,
      };
    },
    {
      detail: {
        tags: ["Settings"],
        summary: "Get maintenance mode status",
      },
    },
  )

  // Toggle maintenance mode (DEVELOPER only)
  .put(
    "/maintenance",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      if (!isDeveloper(user)) {
        set.status = 403;
        return { message: "Forbidden: Developer role required" };
      }

      const settings = await prisma.globalSettings.upsert({
        where: { id: "global" },
        update: {
          maintenanceMode: body.maintenanceMode,
          maintenanceMessage: body.maintenanceMessage,
        },
        create: {
          id: "global",
          maintenanceMode: body.maintenanceMode,
          maintenanceMessage: body.maintenanceMessage,
        },
      });

      return {
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
      };
    },
    {
      body: t.Object({
        maintenanceMode: t.Boolean(),
        maintenanceMessage: t.Optional(
          t.Nullable(t.String({ maxLength: 500 })),
        ),
      }),
      detail: {
        tags: ["Settings"],
        summary: "Toggle maintenance mode (Developer only)",
      },
    },
  );
