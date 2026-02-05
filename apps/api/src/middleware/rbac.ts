import type { Session } from "../auth/index.js";
import { hasRole, type Role } from "@snl-emp/shared";

export function requireRoles(
  user: Session["user"] | null,
  roles: Role[],
): boolean {
  if (!user) return false;
  const userRole = (user.role as Role) || "EMPLOYEE";
  return hasRole(userRole, roles);
}

export function isDeveloper(user: Session["user"] | null): boolean {
  if (!user) return false;
  return user.role === "DEVELOPER";
}

export function isAdmin(user: Session["user"] | null): boolean {
  if (!user) return false;
  return user.role === "ADMIN" || user.role === "DEVELOPER";
}

export function isHR(user: Session["user"] | null): boolean {
  if (!user) return false;
  return (
    user.role === "HR" || user.role === "ADMIN" || user.role === "DEVELOPER"
  );
}

export function isManagement(user: Session["user"] | null): boolean {
  if (!user) return false;
  return (
    user.role === "MANAGEMENT" ||
    user.role === "ADMIN" ||
    user.role === "DEVELOPER"
  );
}

export function canManageEmployees(user: Session["user"] | null): boolean {
  return isHR(user);
}

export function canApproveLeaves(user: Session["user"] | null): boolean {
  return isManagement(user) || isHR(user);
}

export function canManageComplaints(user: Session["user"] | null): boolean {
  return isHR(user);
}

export function canManageSettings(user: Session["user"] | null): boolean {
  return isHR(user);
}
