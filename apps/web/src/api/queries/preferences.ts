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
import type { VirtualDesktop } from "@/stores/desktopStore";
import type { SerializableWindowState } from "@/stores/windowStore";

export type BackgroundFit = "cover" | "contain" | "fill" | "center";
export type IconPositions = Record<string, { x: number; y: number }>;
export type WidgetsData = Widget[];
export type ShortcutItem = { id: string; appId: string };
export type DesktopShortcuts = ShortcutItem[]; // Array of shortcut objects
export type AppSizes = Record<string, { width: number; height: number }>;

export interface PreferencesUpdateData {
  theme?: "system" | "light" | "dark";
  accentColor?: string;
  backgroundImage?: string | null;
  backgroundFit?: BackgroundFit;
  backgroundColor?: string;
  guiScale?: number;
  desktopIconSize?: number;
  taskbarSize?: number;
  appDrawerIconSize?: number;
  iconPositions?: IconPositions | null;
  widgets?: WidgetsData | null;
  desktopShortcuts?: DesktopShortcuts | null;
  // Virtual desktops and window state
  virtualDesktops?: VirtualDesktop[] | null;
  activeDesktopId?: string | null;
  windowStates?: SerializableWindowState[] | null;
  appSizes?: AppSizes | null;
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PreferencesUpdateData) => {
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
