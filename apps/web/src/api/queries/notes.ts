import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../client";

export const noteQueries = {
  all: (folderId?: string) =>
    queryOptions({
      queryKey: ["notes", { folderId }],
      queryFn: async () => {
        const { data, error } = await api.api.notes.get({
          query: folderId ? { folderId } : {},
        });
        if (error) throw error;
        return data;
      },
    }),

  detail: (id: string) =>
    queryOptions({
      queryKey: ["notes", id],
      queryFn: async () => {
        const { data, error } = await api.api.notes({ id }).get();
        if (error) throw error;
        return data;
      },
      enabled: !!id,
    }),

  folders: queryOptions({
    queryKey: ["notes", "folders"],
    queryFn: async () => {
      const { data, error } = await api.api.notes.folders.list.get();
      if (error) throw error;
      return data;
    },
  }),
};

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title?: string;
      content?: string;
      preview?: string;
      isPinned?: boolean;
      color?: string;
      folderId?: string;
    }) => {
      const { data: result, error } = await api.api.notes.post(data);
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      content?: string;
      preview?: string;
      isPinned?: boolean;
      color?: string;
      folderId?: string | null;
    }) => {
      const { data: result, error } = await api.api.notes({ id }).put(data);
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      queryClient.invalidateQueries({ queryKey: ["notes", variables.id] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.notes({ id }).delete();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}

// Folder mutations
export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; color?: string; icon?: string }) => {
      const { data: result, error } = await api.api.notes.folders.post(data);
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", "folders"] });
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      color?: string;
      icon?: string;
    }) => {
      const { data: result, error } = await api.api.notes.folders({ id }).put(data);
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", "folders"] });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await api.api.notes.folders({ id }).delete();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", "folders"] });
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });
}
