import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { authPlugin } from "./auth/plugin.js";
import {
  employeeRoutes,
  leaveRoutes,
  complaintRoutes,
  settingsRoutes,
  calendarRoutes,
  preferencesRoutes,
  announcementRoutes,
  notesRoutes,
  uploadRoutes,
  workLogRoutes,
} from "./routes/index.js";

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
  .use(authPlugin)
  .use(employeeRoutes)
  .use(leaveRoutes)
  .use(complaintRoutes)
  .use(settingsRoutes)
  .use(calendarRoutes)
  .use(preferencesRoutes)
  .use(announcementRoutes)
  .use(notesRoutes)
  .use(uploadRoutes)
  .use(workLogRoutes)
  .get("/", () => ({
    message: "SNL Employee Management API",
    version: "1.0.0",
  }))
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

export type App = typeof app;
