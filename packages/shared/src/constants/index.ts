export const ROLES = {
  EMPLOYEE: "EMPLOYEE",
  HR: "HR",
  MANAGEMENT: "MANAGEMENT",
  ADMIN: "ADMIN",
  DEVELOPER: "DEVELOPER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const LEAVE_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type LeaveStatus = (typeof LEAVE_STATUS)[keyof typeof LEAVE_STATUS];

export const COMPLAINT_STATUS = {
  UNREAD: "UNREAD",
  READ: "READ",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
} as const;

export type ComplaintStatus =
  (typeof COMPLAINT_STATUS)[keyof typeof COMPLAINT_STATUS];

export const HALF_DAY_TYPE = {
  MORNING: "morning",
  AFTERNOON: "afternoon",
} as const;

export type HalfDayType = (typeof HALF_DAY_TYPE)[keyof typeof HALF_DAY_TYPE];

// Role hierarchy for access control
// ADMIN has same level as DEVELOPER but without audit log access
export const ROLE_HIERARCHY: Record<Role, number> = {
  EMPLOYEE: 1,
  HR: 2,
  MANAGEMENT: 2,
  ADMIN: 99,
  DEVELOPER: 99,
};

// Check if a role can perform actions on another role
export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  if (actorRole === "DEVELOPER" || actorRole === "ADMIN") return true;
  return ROLE_HIERARCHY[actorRole] > ROLE_HIERARCHY[targetRole];
}

// Check if user has one of the required roles
export function hasRole(userRole: Role, requiredRoles: Role[]): boolean {
  // DEVELOPER and ADMIN bypass role checks (except DEVELOPER-only features)
  if (userRole === "DEVELOPER" || userRole === "ADMIN") return true;
  return requiredRoles.includes(userRole);
}
