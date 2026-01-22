import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../client";

export const preferencesQueries = {
  user: queryOptions({
    queryKey: ["preferences"],
    queryFn: async () => {
      const { data, error } = await api.api.preferences.get();
      if (error) throw error;
      return data;
    },
  }),
};

import type { Widget } from "@/stores/widgetStore";

export type BackgroundFit = "cover" | "contain" | "fill" | "center";
export type IconPositions = Record<string, { x: number; y: number }>;
export type WidgetsData = Widget[];

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      theme?: "system" | "light" | "dark";
      accentColor?: string;
      backgroundImage?: string | null;
      backgroundFit?: BackgroundFit;
      backgroundColor?: string;
      guiScale?: number;
      iconPositions?: IconPositions | null;
      widgets?: WidgetsData | null;
    }) => {
      const { data: result, error } = await api.api.preferences.put(data);
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
  });
}

export function useUploadBackground() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const { data, error } = await api.api.preferences.background.post({
        file,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
  });
}
