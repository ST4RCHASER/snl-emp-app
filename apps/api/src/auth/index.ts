import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { prisma } from "@snl-emp/db";

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
      secure: false, // Set to true in production with HTTPS
    },
  },
});

export type Session = typeof auth.$Infer.Session;
