import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../client";
import { logAction } from "./audit";

export interface Resource {
  id: string;
  employeeId: string;
  name: string;
  avatar: string | null;
  department: string | null;
  position: string | null;
  managers: Array<{
    id: string;
    name: string;
    avatar: string | null;
  }>;
}

export interface Reservation {
  id: string;
  resourceEmployeeId: string;
  resourceOwnerId: string;
  requesterId: string;
  date: string;
  hours: number;
  title: string;
  description: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  respondedAt: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  resourceEmployee: {
    id: string;
    fullName: string | null;
    avatar: string | null;
    user: { name: string | null; email: string; image: string | null };
  };
  resourceOwner: {
    id: string;
    fullName: string | null;
    avatar: string | null;
    user: { name: string | null; email: string; image: string | null };
  };
  requester: {
    id: string;
    fullName: string | null;
    avatar: string | null;
    user: { name: string | null; email: string; image: string | null };
  };
}

export const reservationQueries = {
  resources: queryOptions({
    queryKey: ["reservations", "resources"],
    queryFn: async () => {
      const { data, error } = await api.api.reservations.resources.get();
      if (error) throw error;
      return data as Resource[];
    },
  }),

  resourceReservations: (
    resourceId: string,
    startDate?: string,
    endDate?: string,
  ) =>
    queryOptions({
      queryKey: ["reservations", "resource", resourceId, startDate, endDate],
      queryFn: async () => {
        const { data, error } = await api.api.reservations
          .resource({
            resourceId,
          })
          .get({
            query: { startDate, endDate },
          });
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error("Unexpected response");
        return data as unknown as Reservation[];
      },
      enabled: !!resourceId,
    }),

  myTeam: (status?: string) =>
    queryOptions({
      queryKey: ["reservations", "my-team", status],
      queryFn: async () => {
        const { data, error } = await api.api.reservations["my-team"].get({
          query: { status },
        });
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error("Unexpected response");
        return data as unknown as Reservation[];
      },
    }),

  myRequests: queryOptions({
    queryKey: ["reservations", "my-requests"],
    queryFn: async () => {
      const { data, error } = await api.api.reservations["my-requests"].get();
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Unexpected response");
      return data as unknown as Reservation[];
    },
  }),

  myTime: (startDate?: string, endDate?: string) =>
    queryOptions({
      queryKey: ["reservations", "my-time", startDate, endDate],
      queryFn: async () => {
        const { data, error } = await api.api.reservations["my-time"].get({
          query: { startDate, endDate },
        });
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error("Unexpected response");
        return data as unknown as Reservation[];
      },
    }),
};

export function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      resourceEmployeeId: string;
      date: string;
      hours: number;
      title: string;
      description?: string;
    }) => {
      const { data, error } = await api.api.reservations.post(input);
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      logAction("create_reservation", "form", "Created reservation request", {
        resourceEmployeeId: variables.resourceEmployeeId,
        date: variables.date,
        hours: variables.hours,
      });
    },
  });
}

export function useRespondReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      approved: boolean;
      comment?: string;
    }) => {
      const { data, error } = await api.api
        .reservations({ id: input.id })
        .respond.post({
          approved: input.approved,
          comment: input.comment,
        });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      logAction(
        variables.approved ? "approve_reservation" : "reject_reservation",
        "form",
        `${variables.approved ? "Approved" : "Rejected"} reservation request`,
        { id: variables.id },
      );
    },
  });
}

export function useUpdateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      hours: number;
      title: string;
      description?: string;
    }) => {
      const { data, error } = await api.api.reservations({ id: input.id }).put({
        hours: input.hours,
        title: input.title,
        description: input.description,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      logAction("update_reservation", "form", "Updated reservation request", {
        id: variables.id,
        hours: variables.hours,
      });
    },
  });
}

export function useCancelReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.reservations({ id }).delete();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      logAction("cancel_reservation", "form", "Cancelled reservation request", {
        id,
      });
    },
  });
}
