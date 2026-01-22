import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../client";

export const settingsQueries = {
  global: queryOptions({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await api.api.settings.get();
      if (error) throw error;
      return data;
    },
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
