import { Elysia, t } from "elysia";
import { authPlugin } from "../auth/plugin.js";

const MAX_FILE_SIZE = 9 * 1024 * 1024; // 9MB
const M1R_UPLOAD_URL = "https://up.m1r.ai/upload";

// Allowed file types
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

export const uploadRoutes = new Elysia({ prefix: "/api/upload" })
  .use(authPlugin)

  // Upload file to m1r.ai
  .post(
    "/",
    async ({ body, user, set }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const { file } = body;

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        set.status = 400;
        return { message: "File size exceeds 9MB limit" };
      }

      // Check file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        set.status = 400;
        return { message: "File type not allowed" };
      }

      try {
        // Create FormData for up.m1r.ai upload
        const formData = new FormData();
        formData.append("uploadType", "0");
        formData.append("file", file, file.name);

        // Upload to up.m1r.ai
        const response = await fetch(M1R_UPLOAD_URL, {
          method: "POST",
          headers: {
            Accept: "application/json, text/plain, */*",
          },
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("m1r.ai upload failed:", errorText);
          set.status = 500;
          return { message: "Upload failed" };
        }

        const result = await response.json();

        // up.m1r.ai returns the URL in the response
        return {
          url: result.url,
          name: file.name,
          type: file.type,
          size: file.size,
          isImage: ALLOWED_IMAGE_TYPES.includes(file.type),
        };
      } catch (error) {
        console.error("Upload error:", error);
        set.status = 500;
        return { message: "Upload failed" };
      }
    },
    {
      body: t.Object({
        file: t.File({
          maxSize: MAX_FILE_SIZE,
        }),
      }),
      detail: {
        tags: ["Upload"],
        summary: "Upload file to m1r.ai",
      },
    },
  );
