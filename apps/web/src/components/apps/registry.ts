import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { Role } from "@snl-emp/shared";

export interface AppDefinition {
  id: string;
  name: string;
  icon: string;
  component: LazyExoticComponent<ComponentType>;
  defaultSize: { width: number; height: number };
  roles?: Role[];
}

export const appRegistry: AppDefinition[] = [
  {
    id: "announcements",
    name: "Announcements",
    icon: "Megaphone",
    component: lazy(() => import("./Announcements")),
    defaultSize: { width: 800, height: 550 },
  },
  {
    id: "employee-directory",
    name: "Employee Directory",
    icon: "People",
    component: lazy(() => import("./EmployeeDirectory")),
    defaultSize: { width: 900, height: 600 },
  },
  {
    id: "leave-management",
    name: "Leave Management",
    icon: "Calendar",
    component: lazy(() => import("./LeaveManagement")),
    defaultSize: { width: 850, height: 600 },
  },
  {
    id: "complaints",
    name: "Complaints",
    icon: "ChatWarning",
    component: lazy(() => import("./ComplaintSystem")),
    defaultSize: { width: 800, height: 550 },
  },
  {
    id: "complaint-chat",
    name: "Complaint Chat",
    icon: "Chat",
    component: lazy(() => import("./ComplaintChat")),
    defaultSize: { width: 450, height: 550 },
  },
  {
    id: "settings",
    name: "Settings",
    icon: "Settings",
    component: lazy(() => import("./Settings")),
    defaultSize: { width: 600, height: 500 },
  },
  {
    id: "profile",
    name: "My Profile",
    icon: "Person",
    component: lazy(() => import("./Profile")),
    defaultSize: { width: 650, height: 550 },
  },
  {
    id: "calendar",
    name: "Calendar",
    icon: "CalendarLtr",
    component: lazy(() => import("./Calendar")),
    defaultSize: { width: 450, height: 500 },
  },
  {
    id: "notes",
    name: "Notes",
    icon: "Note",
    component: lazy(() => import("./Notes")),
    defaultSize: { width: 900, height: 600 },
  },
  {
    id: "work-logs",
    name: "Work Logs",
    icon: "Clock",
    component: lazy(() => import("./WorkHours")),
    defaultSize: { width: 700, height: 550 },
  },
  {
    id: "team-dashboard",
    name: "Team Dashboard",
    icon: "PeopleTeam",
    component: lazy(() => import("./TeamDashboard")),
    defaultSize: { width: 1000, height: 650 },
    roles: ["MANAGEMENT", "DEVELOPER"],
  },
  {
    id: "audit-logs",
    name: "Audit Logs",
    icon: "DocumentSearch",
    component: lazy(() => import("./AuditLogs")),
    defaultSize: { width: 950, height: 650 },
    roles: ["DEVELOPER"],
  },
  {
    id: "youtube",
    name: "iframe test / youtube",
    icon: "Video",
    component: lazy(() => import("./YouTube")),
    defaultSize: { width: 800, height: 550 },
    roles: ["DEVELOPER"],
  },
  {
    id: "team-calendar",
    name: "Team Calendar",
    icon: "CalendarPerson",
    component: lazy(() => import("./TeamCalendar")),
    defaultSize: { width: 900, height: 650 },
    roles: ["MANAGEMENT", "DEVELOPER"],
  },
];

export function getAppById(appId: string): AppDefinition | undefined {
  return appRegistry.find((app) => app.id === appId);
}

export function getAppsForRole(role: Role): AppDefinition[] {
  return appRegistry.filter((app) => {
    if (!app.roles) return true;
    if (role === "DEVELOPER") return true;
    return app.roles.includes(role);
  });
}
