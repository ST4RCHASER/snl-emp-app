import { Elysia } from "elysia";
import { auth, type Session, type User } from "./index.js";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export const betterAuthView = new Elysia({ name: "better-auth-view" })
  // Handle OPTIONS preflight requests for auth routes
  .options("/api/auth/*", ({ set }) => {
    set.headers["Access-Control-Allow-Origin"] = FRONTEND_URL;
    set.headers["Access-Control-Allow-Methods"] =
      "GET, POST, PUT, DELETE, PATCH, OPTIONS";
    set.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    set.headers["Access-Control-Allow-Credentials"] = "true";
    set.status = 204;
    return "";
  })
  .all("/api/auth/*", async ({ request, set }) => {
    const response = await auth.handler(request);

    // Copy CORS headers to the response
    set.headers["Access-Control-Allow-Origin"] = FRONTEND_URL;
    set.headers["Access-Control-Allow-Credentials"] = "true";

    return response;
  });

export const authPlugin = new Elysia({ name: "auth-plugin" })
  .use(betterAuthView)
  .derive({ as: "scoped" }, async ({ request }) => {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    return {
      session: session?.session ?? null,
      user: (session?.user as User | undefined) ?? null,
    };
  })
  .macro(({ onBeforeHandle }) => ({
    auth(enabled: boolean) {
      if (!enabled) return;
      onBeforeHandle(
        (
          ctx: Record<string, unknown> & {
            session: Session | null;
            user: User | null;
            error: (status: number, body: { message: string }) => Response;
          },
        ) => {
          if (!ctx.session || !ctx.user) {
            return ctx.error(401, { message: "Unauthorized" });
          }
        },
      );
    },
    roles(allowedRoles: string[]) {
      if (!allowedRoles || allowedRoles.length === 0) return;
      onBeforeHandle(
        (
          ctx: Record<string, unknown> & {
            user: User | null;
            error: (status: number, body: { message: string }) => Response;
          },
        ) => {
          if (!ctx.user) {
            return ctx.error(401, { message: "Unauthorized" });
          }

          const userRole = ctx.user.role || "EMPLOYEE";

          // DEVELOPER can access everything
          if (userRole === "DEVELOPER") {
            return;
          }

          if (!allowedRoles.includes(userRole)) {
            return ctx.error(403, {
              message: "Forbidden: Insufficient permissions",
            });
          }
        },
      );
    },
  }));

export type AuthPlugin = typeof authPlugin;
