import { Elysia, t } from "elysia";
import { prisma } from "@snl-emp/db";
import { authPlugin } from "../auth/plugin.js";

export const notesRoutes = new Elysia({ prefix: "/api/notes" })
  .use(authPlugin)

  // List all notes for current user
  .get(
    "/",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const notes = await prisma.note.findMany({
        where: {
          userId: user.id,
          ...(query.folderId ? { folderId: query.folderId } : {}),
        },
        orderBy: [
          { isPinned: "desc" },
          { updatedAt: "desc" },
        ],
        include: {
          folder: true,
        },
      });

      return notes;
    },
    {
      query: t.Object({
        folderId: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Notes"],
        summary: "List all notes for current user",
      },
    },
  )

  // Get single note
  .get(
    "/:id",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const note = await prisma.note.findFirst({
        where: {
          id,
          userId: user.id,
        },
        include: {
          folder: true,
        },
      });

      if (!note) {
        set.status = 404;
        return { message: "Note not found" };
      }

      return note;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Notes"],
        summary: "Get note by ID",
      },
    },
  )

  // Create note
  .post(
    "/",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const note = await prisma.note.create({
        data: {
          userId: user.id,
          title: body.title || "",
          content: body.content || "",
          preview: body.preview || "",
          isPinned: body.isPinned || false,
          color: body.color,
          folderId: body.folderId,
        },
        include: {
          folder: true,
        },
      });

      return note;
    },
    {
      body: t.Object({
        title: t.Optional(t.String()),
        content: t.Optional(t.String()),
        preview: t.Optional(t.String()),
        isPinned: t.Optional(t.Boolean()),
        color: t.Optional(t.String()),
        folderId: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Notes"],
        summary: "Create a new note",
      },
    },
  )

  // Update note
  .put(
    "/:id",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const existing = await prisma.note.findFirst({
        where: { id, userId: user.id },
      });

      if (!existing) {
        set.status = 404;
        return { message: "Note not found" };
      }

      const note = await prisma.note.update({
        where: { id },
        data: {
          title: body.title,
          content: body.content,
          preview: body.preview,
          isPinned: body.isPinned,
          color: body.color,
          folderId: body.folderId,
        },
        include: {
          folder: true,
        },
      });

      return note;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        title: t.Optional(t.String()),
        content: t.Optional(t.String()),
        preview: t.Optional(t.String()),
        isPinned: t.Optional(t.Boolean()),
        color: t.Optional(t.String()),
        folderId: t.Optional(t.Nullable(t.String())),
      }),
      detail: {
        tags: ["Notes"],
        summary: "Update a note",
      },
    },
  )

  // Delete note
  .delete(
    "/:id",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const existing = await prisma.note.findFirst({
        where: { id, userId: user.id },
      });

      if (!existing) {
        set.status = 404;
        return { message: "Note not found" };
      }

      await prisma.note.delete({ where: { id } });

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Notes"],
        summary: "Delete a note",
      },
    },
  )

  // ==================== FOLDERS ====================

  // List all folders
  .get(
    "/folders/list",
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const folders = await prisma.noteFolder.findMany({
        where: { userId: user.id },
        orderBy: { name: "asc" },
        include: {
          _count: {
            select: { notes: true },
          },
        },
      });

      return folders;
    },
    {
      detail: {
        tags: ["Notes"],
        summary: "List all folders",
      },
    },
  )

  // Create folder
  .post(
    "/folders",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const folder = await prisma.noteFolder.create({
        data: {
          userId: user.id,
          name: body.name,
          color: body.color,
          icon: body.icon,
        },
      });

      return folder;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        color: t.Optional(t.String()),
        icon: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Notes"],
        summary: "Create a new folder",
      },
    },
  )

  // Update folder
  .put(
    "/folders/:id",
    async ({ params: { id }, body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const existing = await prisma.noteFolder.findFirst({
        where: { id, userId: user.id },
      });

      if (!existing) {
        set.status = 404;
        return { message: "Folder not found" };
      }

      const folder = await prisma.noteFolder.update({
        where: { id },
        data: {
          name: body.name,
          color: body.color,
          icon: body.icon,
        },
      });

      return folder;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        color: t.Optional(t.String()),
        icon: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Notes"],
        summary: "Update a folder",
      },
    },
  )

  // Delete folder
  .delete(
    "/folders/:id",
    async ({ params: { id }, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const existing = await prisma.noteFolder.findFirst({
        where: { id, userId: user.id },
      });

      if (!existing) {
        set.status = 404;
        return { message: "Folder not found" };
      }

      // Notes will have folderId set to null due to onDelete: SetNull
      await prisma.noteFolder.delete({ where: { id } });

      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        tags: ["Notes"],
        summary: "Delete a folder",
      },
    },
  );
