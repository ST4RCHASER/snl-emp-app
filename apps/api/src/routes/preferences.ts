import { Elysia, t } from "elysia";
import { prisma } from "@snl-emp/db";
import { authPlugin } from "../auth/plugin.js";

export const preferencesRoutes = new Elysia({ prefix: "/api/preferences" })
  .use(authPlugin)

  // Get user preferences
  .get(
    "/",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      let preferences = await prisma.userPreferences.findUnique({
        where: { userId: user.id },
      });

      if (!preferences) {
        preferences = await prisma.userPreferences.create({
          data: {
            userId: user.id,
          },
        });
      }

      return preferences;
    },
    {
      detail: {
        tags: ["Preferences"],
        summary: "Get user preferences",
      },
    },
  )

  // Update user preferences
  .put(
    "/",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      // Handle JSON fields properly for Prisma
      const updateData = {
        ...body,
        iconPositions:
          body.iconPositions === null ? { set: null } : body.iconPositions,
        widgets: body.widgets === null ? { set: null } : body.widgets,
        desktopShortcuts:
          body.desktopShortcuts === null
            ? { set: null }
            : body.desktopShortcuts,
        virtualDesktops:
          body.virtualDesktops === null ? { set: null } : body.virtualDesktops,
        windowStates:
          body.windowStates === null ? { set: null } : body.windowStates,
        appSizes: body.appSizes === null ? { set: null } : body.appSizes,
        teamCalendarSettings:
          body.teamCalendarSettings === null
            ? { set: null }
            : body.teamCalendarSettings,
        resourceReservationSettings:
          body.resourceReservationSettings === null
            ? { set: null }
            : body.resourceReservationSettings,
        leaveManagementSettings:
          body.leaveManagementSettings === null
            ? { set: null }
            : body.leaveManagementSettings,
      };

      const preferences = await prisma.userPreferences.upsert({
        where: { userId: user.id },
        update: updateData,
        create: {
          userId: user.id,
          ...body,
          iconPositions: body.iconPositions ?? undefined,
          widgets: body.widgets ?? undefined,
          desktopShortcuts: body.desktopShortcuts ?? undefined,
          virtualDesktops: body.virtualDesktops ?? undefined,
          windowStates: body.windowStates ?? undefined,
          appSizes: body.appSizes ?? undefined,
          teamCalendarSettings: body.teamCalendarSettings ?? undefined,
          resourceReservationSettings:
            body.resourceReservationSettings ?? undefined,
          leaveManagementSettings: body.leaveManagementSettings ?? undefined,
        },
      });

      return preferences;
    },
    {
      body: t.Object({
        theme: t.Optional(
          t.Union([t.Literal("system"), t.Literal("light"), t.Literal("dark")]),
        ),
        accentColor: t.Optional(t.String()),
        backgroundImage: t.Optional(t.Union([t.String(), t.Null()])),
        backgroundFit: t.Optional(
          t.Union([
            t.Literal("cover"),
            t.Literal("contain"),
            t.Literal("fill"),
            t.Literal("center"),
          ]),
        ),
        backgroundColor: t.Optional(t.String()),
        guiScale: t.Optional(t.Number()),
        desktopIconSize: t.Optional(t.Number()),
        taskbarSize: t.Optional(t.Number()),
        appDrawerIconSize: t.Optional(t.Number()),
        iconPositions: t.Optional(
          t.Union([
            t.Record(
              t.String(),
              t.Object({
                x: t.Number(),
                y: t.Number(),
              }),
            ),
            t.Null(),
          ]),
        ),
        widgets: t.Optional(t.Union([t.Array(t.Any()), t.Null()])),
        desktopShortcuts: t.Optional(
          t.Union([
            // New format: array of {id, appId} objects
            t.Array(
              t.Object({
                id: t.String(),
                appId: t.String(),
              }),
            ),
            // Old format: array of strings (for backwards compatibility)
            t.Array(t.String()),
            t.Null(),
          ]),
        ),
        // Virtual desktops and window state
        virtualDesktops: t.Optional(
          t.Union([
            t.Array(
              t.Object({
                id: t.String(),
                name: t.String(),
                order: t.Number(),
              }),
            ),
            t.Null(),
          ]),
        ),
        activeDesktopId: t.Optional(t.Union([t.String(), t.Null()])),
        windowStates: t.Optional(t.Union([t.Array(t.Any()), t.Null()])),
        appSizes: t.Optional(
          t.Union([
            t.Record(
              t.String(),
              t.Object({
                width: t.Number(),
                height: t.Number(),
              }),
            ),
            t.Null(),
          ]),
        ),
        teamCalendarSettings: t.Optional(
          t.Union([
            t.Object({
              showEvents: t.Optional(t.Boolean()),
              showWorkLogs: t.Optional(t.Boolean()),
              showReservations: t.Optional(t.Boolean()),
              viewMode: t.Optional(
                t.Union([
                  t.Literal("day"),
                  t.Literal("week"),
                  t.Literal("month"),
                ]),
              ),
            }),
            t.Null(),
          ]),
        ),
        resourceReservationSettings: t.Optional(
          t.Union([
            t.Object({
              viewMode: t.Optional(
                t.Union([
                  t.Literal("day"),
                  t.Literal("week"),
                  t.Literal("month"),
                ]),
              ),
              selectedResourceId: t.Optional(t.Union([t.String(), t.Null()])),
              activeTab: t.Optional(t.String()),
            }),
            t.Null(),
          ]),
        ),
        leaveManagementSettings: t.Optional(
          t.Union([
            t.Object({
              activeTab: t.Optional(t.String()),
              pendingViewMode: t.Optional(
                t.Union([t.Literal("list"), t.Literal("calendar")]),
              ),
              allLeavesViewMode: t.Optional(
                t.Union([t.Literal("list"), t.Literal("calendar")]),
              ),
              selectedEmployeeId: t.Optional(t.Union([t.String(), t.Null()])),
              selectedEmployeeName: t.Optional(t.Union([t.String(), t.Null()])),
            }),
            t.Null(),
          ]),
        ),
      }),
      detail: {
        tags: ["Preferences"],
        summary: "Update user preferences",
      },
    },
  )

  // Upload background image
  .post(
    "/background",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const { file } = body;

      // Upload to up.m1r.ai
      const formData = new FormData();
      formData.append("uploadType", "0");
      formData.append("file", file);

      const response = await fetch("https://up.m1r.ai/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        set.status = 500;
        return { message: "Failed to upload image" };
      }

      const result = await response.json();
      const imageUrl = result.url;

      // Update user preferences with new background
      const preferences = await prisma.userPreferences.upsert({
        where: { userId: user.id },
        update: { backgroundImage: imageUrl },
        create: {
          userId: user.id,
          backgroundImage: imageUrl,
        },
      });

      return { url: imageUrl, preferences };
    },
    {
      body: t.Object({
        file: t.File(),
      }),
      detail: {
        tags: ["Preferences"],
        summary: "Upload background image",
      },
    },
  );
