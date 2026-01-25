import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../client";
import { logAction } from "./audit";

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
      type: string; // Leave type code (e.g., "ANNUAL", "SICK", or custom codes)
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
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaves", "balance"] });
      logAction(
        "submit_leave",
        "form",
        `Submitted ${variables.type} leave request`,
        {
          type: variables.type,
          startDate: variables.startDate,
          endDate: variables.endDate,
        },
      );
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
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaves", "balance"] });
      logAction("cancel_leave", "form", "Cancelled leave request", {
        leaveId: id,
      });
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
      const { data, error } = await api.api
        .leaves({ id })
        .approve.post({ approved, comment });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id, approved }) => {
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leaves", id] });
      logAction(
        approved ? "approve_leave" : "reject_leave",
        "form",
        approved ? "Approved leave request" : "Rejected leave request",
        { leaveId: id },
      );
    },
  });
}
