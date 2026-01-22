import { queryOptions, useMutation } from "@tanstack/react-query";
import { api } from "../client";

export interface LogUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface ActionLog {
  id: string;
  userId: string | null;
  action: string;
  category: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  createdAt: string;
  user: LogUser | null;
}

export interface ApiLog {
  id: string;
  userId: string | null;
  method: string;
  path: string;
  query: Record<string, unknown> | null;
  body: Record<string, unknown> | null;
  headers: Record<string, unknown> | null;
  statusCode: number;
  responseTime: number;
  responseSize: number | null;
  error: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  createdAt: string;
  user: LogUser | null;
}

export interface PaginatedResponse<T> {
  logs: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditStats {
  totalActions: number;
  totalApiLogs: number;
  actionsToday: number;
  apiLogsToday: number;
  actionsThisWeek: number;
  apiLogsThisWeek: number;
  errorCount: number;
  topActions: Array<{ action: string; count: number }>;
  topEndpoints: Array<{ path: string; count: number }>;
}

export interface ActionLogFilters {
  page?: number;
  limit?: number;
  category?: string;
  action?: string;
  userId?: string;
  search?: string;
}

export interface ApiLogFilters {
  page?: number;
  limit?: number;
  method?: string;
  path?: string;
  statusCode?: number;
  userId?: string;
  search?: string;
}

export const auditQueries = {
  actionLogs: (filters: ActionLogFilters = {}) =>
    queryOptions({
      queryKey: ["audit", "actions", filters],
      queryFn: async () => {
        const { data, error } = await api.api.audit.actions.get({
          query: filters,
        });
        if (error) throw error;
        return data as unknown as PaginatedResponse<ActionLog>;
      },
    }),

  apiLogs: (filters: ApiLogFilters = {}) =>
    queryOptions({
      queryKey: ["audit", "api-logs", filters],
      queryFn: async () => {
        const { data, error } = await api.api.audit["api-logs"].get({
          query: filters,
        });
        if (error) throw error;
        return data as unknown as PaginatedResponse<ApiLog>;
      },
    }),

  stats: queryOptions({
    queryKey: ["audit", "stats"],
    queryFn: async () => {
      const { data, error } = await api.api.audit.stats.get();
      if (error) throw error;
      return data as AuditStats;
    },
  }),
};

// Hook to log user actions
export function useLogAction() {
  return useMutation({
    mutationFn: async (params: {
      action: string;
      category: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const { data, error } = await api.api.audit.actions.post(params);
      if (error) throw error;
      return data;
    },
  });
}

// Create a simple logger function for convenience
export const logAction = async (
  action: string,
  category: string,
  description?: string,
  metadata?: Record<string, unknown>,
) => {
  try {
    await api.api.audit.actions.post({
      action,
      category,
      description,
      metadata,
    });
  } catch (err) {
    // Silently fail - we don't want logging to break the app
    console.error("Failed to log action:", err);
  }
};
