import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { authPlugin } from "./auth/plugin.js";
import { logApiRequest } from "./middleware/apiLogger.js";
import {
  employeeRoutes,
  leaveRoutes,
  leaveTypeRoutes,
  leaveBalanceRoutes,
  complaintRoutes,
  settingsRoutes,
  calendarRoutes,
  preferencesRoutes,
  announcementRoutes,
  notesRoutes,
  uploadRoutes,
  workLogRoutes,
  auditRoutes,
  reservationRoutes,
} from "./routes/index.js";

// Store request start times
const requestTimes = new WeakMap<Request, number>();

export const app = new Elysia()
  .use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    }),
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: "SNL Employee Management API",
          version: "1.0.0",
          description: "API for employee management system",
        },
        tags: [
          { name: "Auth", description: "Authentication endpoints" },
          { name: "Employees", description: "Employee management" },
          { name: "Leaves", description: "Leave request management" },
          { name: "Complaints", description: "Complaint system" },
          { name: "Settings", description: "Global settings" },
          { name: "Calendar", description: "Google Calendar integration" },
          { name: "Preferences", description: "User preferences" },
          { name: "Announcements", description: "Announcement system" },
          { name: "Notes", description: "Personal notes" },
        ],
      },
    }),
  )
  // Global request timing - must be before auth
  .onRequest(({ request }) => {
    requestTimes.set(request, Date.now());
  })
  // Auth plugin - derives user from session
  .use(authPlugin)
  // Global API logging after response - now has access to user
  .onAfterHandle((ctx) => {
    const { request, set } = ctx;
    const user = (ctx as unknown as { user?: { id: string } | null }).user;
    const startTime = requestTimes.get(request);
    logApiRequest(request, set, startTime, user?.id);
  })
  .use(employeeRoutes)
  .use(leaveRoutes)
  .use(leaveTypeRoutes)
  .use(leaveBalanceRoutes)
  .use(complaintRoutes)
  .use(settingsRoutes)
  .use(calendarRoutes)
  .use(preferencesRoutes)
  .use(announcementRoutes)
  .use(notesRoutes)
  .use(uploadRoutes)
  .use(workLogRoutes)
  .use(auditRoutes)
  .use(reservationRoutes)
  .get("/", () => ({
    message: "SNL Employee Management API",
    version: "1.0.0",
  }))
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

export type App = typeof app;
