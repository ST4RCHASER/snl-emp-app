import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../client";

export const announcementQueries = {
  all: queryOptions({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await api.api.announcements.get();
      if (error) throw error;
      return data;
    },
  }),

  unread: queryOptions({
    queryKey: ["announcements", "unread"],
    queryFn: async () => {
      const { data, error } = await api.api.announcements.unread.get();
      if (error) throw error;
      return data;
    },
  }),
};

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title: string;
      content: string;
      images?: string[];
    }) => {
      const { data: result, error } = await api.api.announcements.post(data);
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      content?: string;
      images?: string[];
      isActive?: boolean;
    }) => {
      const { data: result, error } = await api.api
        .announcements({ id })
        .put(data);
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.announcements({ id }).delete();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useReorderAnnouncements() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orders: { id: string }[]) => {
      const { data, error } = await api.api.announcements.reorder.put({
        orders,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useMarkAnnouncementRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.announcements({ id }).read.post();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate both to update unread count and isRead flags
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useMarkAllAnnouncementsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await api.api.announcements["read-all"].post();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate both to update unread count and isRead flags
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}
