import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../client";

export interface WorkLogAudit {
  id: string;
  workLogId: string;
  action: "CREATED" | "UPDATED" | "DELETED";
  userId: string;
  userName?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  createdAt: string;
}

export interface WorkLog {
  id: string;
  employeeId: string;
  title: string;
  description?: string | null;
  hours: number;
  date: string;
  createdById: string;
  isDeleted: boolean;
  deletedAt?: string | null;
  deletedById?: string | null;
  createdAt: string;
  updatedAt: string;
  auditLogs?: WorkLogAudit[];
}

export interface TeamMember {
  id: string;
  userId: string;
  employeeId: string;
  fullName?: string | null;
  nickname?: string | null;
  avatar?: string | null;
  department?: string | null;
  position?: string | null;
  user: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
  };
}

export const workLogQueries = {
  // Get own work logs
  list: (startDate?: string, endDate?: string) =>
    queryOptions({
      queryKey: ["worklogs", { startDate, endDate }],
      queryFn: async () => {
        const { data, error } = await api.api.worklogs.get({
          query: { startDate, endDate },
        });
        if (error) throw error;
        return data as unknown as WorkLog[];
      },
    }),

  // Get own summary
  summary: (startDate?: string, endDate?: string) =>
    queryOptions({
      queryKey: ["worklogs", "summary", { startDate, endDate }],
      queryFn: async () => {
        const { data, error } = await api.api.worklogs.summary.get({
          query: { startDate, endDate },
        });
        if (error) throw error;
        return data as Record<string, number>;
      },
    }),

  // Get team members (for managers)
  team: () =>
    queryOptions({
      queryKey: ["worklogs", "team"],
      queryFn: async () => {
        const { data, error } = await api.api.worklogs.team.get();
        if (error) throw error;
        return data as TeamMember[];
      },
    }),

  // Get team member's work logs
  teamMemberLogs: (employeeId: string, startDate?: string, endDate?: string) =>
    queryOptions({
      queryKey: ["worklogs", "team", employeeId, { startDate, endDate }],
      queryFn: async () => {
        const { data, error } = await api.api.worklogs
          .team({ employeeId })
          .get({ query: { startDate, endDate } });
        if (error) throw error;
        return data as unknown as WorkLog[];
      },
      enabled: !!employeeId,
    }),

  // Get team summary
  teamSummary: (startDate?: string, endDate?: string) =>
    queryOptions({
      queryKey: ["worklogs", "team", "summary", { startDate, endDate }],
      queryFn: async () => {
        const { data, error } = await api.api.worklogs.team.summary.get({
          query: { startDate, endDate },
        });
        if (error) throw error;
        return data as Record<string, Record<string, number>>;
      },
    }),
};

export function useCreateWorkLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      hours: number;
      date: string;
    }) => {
      const { data: result, error } = await api.api.worklogs.post(data);
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worklogs"] });
    },
  });
}

export function useUpdateWorkLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      title: string;
      description?: string;
      hours: number;
      date: string;
    }) => {
      const { data: result, error } = await api.api.worklogs({ id }).put(data);
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worklogs"] });
    },
  });
}

export function useDeleteWorkLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.worklogs({ id }).delete();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worklogs"] });
    },
  });
}

export function useCreateTeamWorkLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employeeId,
      ...data
    }: {
      employeeId: string;
      title: string;
      description?: string;
      hours: number;
      date: string;
    }) => {
      const { data: result, error } = await api.api.worklogs
        .team({ employeeId })
        .post(data);
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worklogs"] });
    },
  });
}
