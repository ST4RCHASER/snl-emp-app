import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../client";

export interface MaintenanceStatus {
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
}

export const settingsQueries = {
  global: queryOptions({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await api.api.settings.get();
      if (error) throw error;
      return data;
    },
  }),

  maintenance: queryOptions({
    queryKey: ["settings", "maintenance"],
    queryFn: async () => {
      const { data, error } = await api.api.settings.maintenance.get();
      if (error) throw error;
      return data as MaintenanceStatus;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  }),
};

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      maxConsecutiveLeaveDays?: number;
      maxAnnualLeaveDays?: number;
      maxSickLeaveDays?: number;
      maxPersonalLeaveDays?: number;
      fiscalYearStartMonth?: number;
      workHoursPerDay?: number;
      complaintChatEnabled?: boolean;
      reservationRequiresApproval?: boolean;
    }) => {
      const { data: result, error } = await api.api.settings.put(data);
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function useUpdateMaintenanceMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      maintenanceMode: boolean;
      maintenanceMessage?: string | null;
    }) => {
      const { data: result, error } =
        await api.api.settings.maintenance.put(data);
      if (error) throw error;
      return result as MaintenanceStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "maintenance"] });
    },
  });
}
