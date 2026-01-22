import { z } from "zod";
import {
  ROLES,
  LEAVE_STATUS,
  LEAVE_TYPE,
  COMPLAINT_STATUS,
  HALF_DAY_TYPE,
} from "../constants/index.js";

// ==================== Auth Types ====================

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  role: z.enum([ROLES.EMPLOYEE, ROLES.HR, ROLES.MANAGEMENT, ROLES.DEVELOPER]),
  createdAt: z.date(),
  updatedAt: z.date(),
  banned: z.boolean(),
});

export type User = z.infer<typeof userSchema>;

// ==================== Employee Types ====================

export const employeeSchema = z.object({
  id: z.string(),
  userId: z.string(),
  employeeId: z.string(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  avatar: z.string().nullable(),
  phone: z.string().nullable(),
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  department: z.string().nullable(),
  position: z.string().nullable(),
  salary: z.number().nullable(),
  hireDate: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Employee = z.infer<typeof employeeSchema>;

export const employeeUpdateSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  avatar: z.string().url().optional(),
  phone: z.string().max(20).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  position: z.string().max(100).optional(),
  salary: z.number().positive().optional(),
  hireDate: z.string().datetime().optional(),
});

export type EmployeeUpdate = z.infer<typeof employeeUpdateSchema>;

// ==================== Leave Types ====================

export const leaveRequestSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  type: z.enum([
    LEAVE_TYPE.ANNUAL,
    LEAVE_TYPE.SICK,
    LEAVE_TYPE.PERSONAL,
    LEAVE_TYPE.UNPAID,
    LEAVE_TYPE.OTHER,
  ]),
  reason: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  isHalfDay: z.boolean(),
  halfDayType: z.enum([HALF_DAY_TYPE.MORNING, HALF_DAY_TYPE.AFTERNOON]).nullable(),
  status: z.enum([
    LEAVE_STATUS.PENDING,
    LEAVE_STATUS.APPROVED,
    LEAVE_STATUS.REJECTED,
    LEAVE_STATUS.CANCELLED,
  ]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type LeaveRequest = z.infer<typeof leaveRequestSchema>;

export const leaveRequestCreateSchema = z
  .object({
    type: z.enum([
      LEAVE_TYPE.ANNUAL,
      LEAVE_TYPE.SICK,
      LEAVE_TYPE.PERSONAL,
      LEAVE_TYPE.UNPAID,
      LEAVE_TYPE.OTHER,
    ]),
    reason: z.string().min(1).max(500),
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
    isHalfDay: z.boolean().default(false),
    halfDayType: z
      .enum([HALF_DAY_TYPE.MORNING, HALF_DAY_TYPE.AFTERNOON])
      .optional(),
  })
  .refine(
    (data) => {
      if (data.isHalfDay && !data.halfDayType) {
        return false;
      }
      return true;
    },
    { message: "Half day type is required when isHalfDay is true" }
  )
  .refine(
    (data) => {
      return new Date(data.startDate) <= new Date(data.endDate);
    },
    { message: "Start date must be before or equal to end date" }
  );

export type LeaveRequestCreate = z.infer<typeof leaveRequestCreateSchema>;

export const leaveApprovalSchema = z.object({
  approved: z.boolean(),
  comment: z.string().max(500).optional(),
});

export type LeaveApproval = z.infer<typeof leaveApprovalSchema>;

// ==================== Complaint Types ====================

export const complaintSchema = z.object({
  id: z.string(),
  employeeId: z.string(),
  subject: z.string(),
  description: z.string(),
  status: z.enum([
    COMPLAINT_STATUS.UNREAD,
    COMPLAINT_STATUS.READ,
    COMPLAINT_STATUS.IN_PROGRESS,
    COMPLAINT_STATUS.DONE,
  ]),
  response: z.string().nullable(),
  respondedBy: z.string().nullable(),
  respondedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Complaint = z.infer<typeof complaintSchema>;

export const complaintCreateSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
});

export type ComplaintCreate = z.infer<typeof complaintCreateSchema>;

export const complaintStatusUpdateSchema = z.object({
  status: z.enum([
    COMPLAINT_STATUS.UNREAD,
    COMPLAINT_STATUS.READ,
    COMPLAINT_STATUS.IN_PROGRESS,
    COMPLAINT_STATUS.DONE,
  ]),
  response: z.string().max(5000).optional(),
});

export type ComplaintStatusUpdate = z.infer<typeof complaintStatusUpdateSchema>;

// ==================== Settings Types ====================

export const globalSettingsSchema = z.object({
  id: z.string(),
  maxConsecutiveLeaveDays: z.number().int().positive(),
  maxAnnualLeaveDays: z.number().int().positive(),
  maxSickLeaveDays: z.number().int().positive(),
  maxPersonalLeaveDays: z.number().int().positive(),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  updatedAt: z.date(),
});

export type GlobalSettings = z.infer<typeof globalSettingsSchema>;

export const globalSettingsUpdateSchema = z.object({
  maxConsecutiveLeaveDays: z.number().int().positive().optional(),
  maxAnnualLeaveDays: z.number().int().positive().optional(),
  maxSickLeaveDays: z.number().int().positive().optional(),
  maxPersonalLeaveDays: z.number().int().positive().optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
});

export type GlobalSettingsUpdate = z.infer<typeof globalSettingsUpdateSchema>;
