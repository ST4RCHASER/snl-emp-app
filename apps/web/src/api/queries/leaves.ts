import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";

export const leaveQueries = {
  all: (view?: string) =>
    queryOptions({
      queryKey: ["leaves", { view }],
      queryFn: async () => {
        const { data, error } = await api.api.leaves.get({ query: { view } });
        if (error) throw error;
        return data;
      },
    }),

  detail: (id: string) =>
    queryOptions({
      queryKey: ["leaves", id],
      queryFn: async () => {
        const { data, error } = await api.api.leaves({ id }).get();
        if (error) throw error;
        return data;
      },
    }),

  balance: queryOptions({
    queryKey: ["leaves", "balance"],
    queryFn: async () => {
      const { data, error } = await api.api.leaves.balance.get();
      if (error) throw error;
      return data;
    },
  }),
};

export function useCreateLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      type: "ANNUAL" | "SICK" | "PERSONAL" | "UNPAID" | "OTHER";
      reason: string;
      startDate: string;
      endDate: string;
      isHalfDay?: boolean;
      halfDayType?: "morning" | "afternoon";
    }) => {
      const { data: result, error } = await api.api.leaves.post(data);
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaves", "balance"] });
    },
  });
}

export function useCancelLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.leaves({ id }).delete();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaves", "balance"] });
    },
  });
}

export function useApproveLeave() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      approved,
      comment,
    }: {
      id: string;
      approved: boolean;
      comment?: string;
    }) => {
      const { data, error } = await api.api.leaves({ id }).approve.post({ approved, comment });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaves", id] });
    },
  });
}
