import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../client";
import { logAction } from "./audit";
import type { LeaveTypeConfig } from "./leave-types";

export interface LeaveBalance {
  leaveType: LeaveTypeConfig;
  balance: number;
  carriedOver: number;
  adjustment: number;
  totalBalance: number;
  used: number;
  remaining: number | null;
  notes: string | null;
  year: number;
}

export const leaveBalanceQueries = {
  my: (year?: number) =>
    queryOptions({
      queryKey: ["leave-balances", "my", { year }],
      queryFn: async () => {
        const { data, error } = await api.api["leave-balances"].my.get({
          query: { year: year?.toString() },
        });
        if (error) throw error;
        return data as LeaveBalance[];
      },
    }),

  employee: (employeeId: string, year?: number) =>
    queryOptions({
      queryKey: ["leave-balances", "employee", employeeId, { year }],
      queryFn: async () => {
        const { data, error } = await api.api["leave-balances"]
          .employee({ employeeId })
          .get({ query: { year: year?.toString() } });
        if (error) throw error;
        return data as LeaveBalance[];
      },
      enabled: !!employeeId,
    }),
};

export function useSetEmployeeBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employeeId,
      leaveTypeId,
      year,
      balance,
      carriedOver,
      adjustment,
      notes,
    }: {
      employeeId: string;
      leaveTypeId: string;
      year?: number;
      balance?: number;
      carriedOver?: number;
      adjustment?: number;
      notes?: string | null;
    }) => {
      const { data, error } = await api.api["leave-balances"]
        .employee({ employeeId })
        .post({
          leaveTypeId,
          year,
          balance,
          carriedOver,
          adjustment,
          notes,
        });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { employeeId }) => {
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances", "employee", employeeId] });
      logAction("set_leave_balance", "form", "Updated employee leave balance", { employeeId });
    },
  });
}

export function useBulkSetBalances() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leaveTypeId,
      year,
      balance,
      overwrite,
    }: {
      leaveTypeId: string;
      year?: number;
      balance?: number;
      overwrite?: boolean;
    }) => {
      const { data, error } = await api.api["leave-balances"].bulk.post({
        leaveTypeId,
        year,
        balance,
        overwrite,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
      logAction("bulk_set_balances", "form", "Bulk updated leave balances");
    },
  });
}

export function useResetEmployeeBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employeeId,
      leaveTypeId,
      year,
    }: {
      employeeId: string;
      leaveTypeId: string;
      year?: number;
    }) => {
      const { data, error } = await api.api["leave-balances"]
        .employee({ employeeId })({ leaveTypeId })
        .delete({ query: { year: year?.toString() } });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { employeeId }) => {
      queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balances", "employee", employeeId] });
      logAction("reset_leave_balance", "form", "Reset employee leave balance to default", { employeeId });
    },
  });
}
