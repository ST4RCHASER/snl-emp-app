import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../client";
import { logAction } from "./audit";

export interface LeaveTypeConfig {
  id: string;
  name: string;
  code: string;
  description: string | null;
  defaultBalance: number;
  isUnlimited: boolean;
  isPaid: boolean;
  allowHalfDay: boolean;
  allowCarryover: boolean;
  carryoverMax: number;
  requiresApproval: boolean;
  color: string | null;
  icon: string | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const leaveTypeQueries = {
  all: (includeInactive?: boolean) =>
    queryOptions({
      queryKey: ["leave-types", { includeInactive }],
      queryFn: async () => {
        const { data, error } = await api.api["leave-types"].get({
          query: { includeInactive: includeInactive ? "true" : undefined },
        });
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error("Unexpected response");
        return data as unknown as LeaveTypeConfig[];
      },
    }),

  detail: (id: string) =>
    queryOptions({
      queryKey: ["leave-types", id],
      queryFn: async () => {
        const { data, error } = await api.api["leave-types"]({ id }).get();
        if (error) throw error;
        if (!data || typeof data !== "object")
          throw new Error("Unexpected response");
        return data as unknown as LeaveTypeConfig;
      },
      enabled: !!id,
    }),
};

export function useCreateLeaveType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      code: string;
      description?: string;
      defaultBalance?: number;
      isUnlimited?: boolean;
      isPaid?: boolean;
      allowHalfDay?: boolean;
      allowCarryover?: boolean;
      carryoverMax?: number;
      requiresApproval?: boolean;
      color?: string;
      icon?: string;
    }) => {
      const { data: result, error } = await api.api["leave-types"].post(data);
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      logAction(
        "create_leave_type",
        "form",
        `Created leave type: ${variables.name}`,
        {
          name: variables.name,
          code: variables.code,
        },
      );
    },
  });
}

export function useUpdateLeaveType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      code?: string;
      description?: string | null;
      defaultBalance?: number;
      isUnlimited?: boolean;
      isPaid?: boolean;
      allowHalfDay?: boolean;
      allowCarryover?: boolean;
      carryoverMax?: number;
      requiresApproval?: boolean;
      color?: string | null;
      icon?: string | null;
      order?: number;
      isActive?: boolean;
    }) => {
      const { data: result, error } = await api.api["leave-types"]({
        id,
      }).patch(data);
      if (error) throw error;
      return result;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      queryClient.invalidateQueries({ queryKey: ["leave-types", id] });
      logAction("update_leave_type", "form", "Updated leave type", {
        leaveTypeId: id,
      });
    },
  });
}

export function useDeleteLeaveType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api["leave-types"]({ id }).delete();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      logAction("delete_leave_type", "form", "Deactivated leave type", {
        leaveTypeId: id,
      });
    },
  });
}

export function useReorderLeaveTypes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id: string }[]) => {
      const { data, error } = await api.api["leave-types"].reorder.post({
        items,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      logAction("reorder_leave_types", "form", "Reordered leave types");
    },
  });
}

export function useSeedLeaveTypes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await api.api["leave-types"].seed.post();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-types"] });
      logAction("seed_leave_types", "form", "Seeded default leave types");
    },
  });
}
