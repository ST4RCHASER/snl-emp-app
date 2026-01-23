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
