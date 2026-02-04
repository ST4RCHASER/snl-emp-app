import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import { prisma } from "@snl-emp/db";

// Helper to log auth actions
async function logAuthAction(
  userId: string | undefined,
  action: string,
  description: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await prisma.actionLog.create({
      data: {
        userId,
        action,
        category: "auth",
        description,
        metadata: metadata as Parameters<
          typeof prisma.actionLog.create
        >[0]["data"]["metadata"],
      },
    });
  } catch (err) {
    console.error("Failed to log auth action:", err);
  }
}

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: false, // Only Google SSO
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectURI: `${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/api/auth/callback/google`,
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/calendar.readonly",
      ],
      accessType: "offline",
      prompt: "consent", // Always show consent to ensure refresh token is provided
    },
  },

  plugins: [
    admin({
      defaultRole: "EMPLOYEE",
    }),
  ],

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "EMPLOYEE",
        input: false,
      },
    },
  },

  trustedOrigins: [FRONTEND_URL],

  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  },

  // Hooks for logging auth events
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      // Log sign-in events
      if (ctx.path === "/sign-in/social" || ctx.path.startsWith("/callback/")) {
        const newSession = ctx.context?.newSession;
        if (newSession?.user?.id) {
          await logAuthAction(
            newSession.user.id,
            "sign_in",
            "User signed in via Google SSO",
            { provider: "google" },
          );
        }
      }
      // Log sign-out events
      if (ctx.path === "/sign-out") {
        const session = ctx.context?.session;
        if (session?.user?.id) {
          await logAuthAction(session.user.id, "sign_out", "User signed out");
        }
      }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;

// Extended user type that includes the role field
export type User = Session["user"] & {
  role?: string | null;
};
