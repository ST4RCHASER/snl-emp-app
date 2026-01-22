import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  isMinimized: boolean;
  isMaximized: boolean;
  isFocused: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  // Animation states
  animationState:
    | "idle"
    | "opening"
    | "closing"
    | "minimizing"
    | "restoring"
    | "maximizing";
  // Key to force remount/refresh the app component
  refreshKey: number;
  // Optional props to pass to the app component
  props?: Record<string, unknown>;
}

interface AppSizeMemory {
  [appId: string]: { width: number; height: number };
}

interface WindowStore {
  windows: WindowState[];
  activeWindowId: string | null;
  maxZIndex: number;
  appSizes: AppSizeMemory; // Remember last size for each app

  openWindow: (
    appId: string,
    title: string,
    defaultSize?: { width: number; height: number },
    props?: Record<string, unknown>,
  ) => string;
  closeWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  maximizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;
  focusWindow: (windowId: string) => void;
  refreshWindow: (windowId: string) => void;
  updatePosition: (
    windowId: string,
    position: { x: number; y: number },
  ) => void;
  updateSize: (
    windowId: string,
    size: { width: number; height: number },
  ) => void;
}

export const useWindowStore = create<WindowStore>()(
  persist(
    (set, get) => ({
      windows: [],
      activeWindowId: null,
      maxZIndex: 0,
      appSizes: {},

      openWindow: (
        appId,
        title,
        defaultSize = { width: 800, height: 600 },
        props,
      ) => {
        // Check if window with same appId already exists
        const existingWindow = get().windows.find((w) => w.appId === appId);
        if (existingWindow) {
          // Focus and restore if minimized
          get().focusWindow(existingWindow.id);
          if (existingWindow.isMinimized) {
            get().restoreWindow(existingWindow.id);
          }
          // Update props if provided (e.g., to navigate to a specific section)
          if (props) {
            set((state) => ({
              windows: state.windows.map((w) =>
                w.id === existingWindow.id ? { ...w, props } : w,
              ),
            }));
          }
          return existingWindow.id;
        }

        const id = `${appId}-${Date.now()}`;
        const newZIndex = get().maxZIndex + 1;
        const windowCount = get().windows.length;

        // Calculate position with cascade effect
        const baseX = 50 + (windowCount % 5) * 30;
        const baseY = 50 + (windowCount % 5) * 30;

        // Use remembered size for this app, or default size
        const rememberedSize = get().appSizes[appId];
        const size = rememberedSize || defaultSize;

        set((state) => ({
          windows: [
            ...state.windows.map((w) => ({ ...w, isFocused: false })),
            {
              id,
              appId,
              title,
              isMinimized: false,
              isMaximized: false,
              isFocused: true,
              position: { x: baseX, y: baseY },
              size,
              zIndex: newZIndex,
              animationState: "opening",
              refreshKey: 0,
              props,
            },
          ],
          activeWindowId: id,
          maxZIndex: newZIndex,
        }));

        // Reset animation state after opening animation completes
        setTimeout(() => {
          set((state) => ({
            windows: state.windows.map((w) =>
              w.id === id ? { ...w, animationState: "idle" as const } : w,
            ),
          }));
        }, 150);

        return id;
      },

      closeWindow: (windowId) => {
        // Start closing animation
        set((state) => ({
          windows: state.windows.map((w) =>
            w.id === windowId
              ? { ...w, animationState: "closing" as const, isFocused: false }
              : w,
          ),
        }));

        // After animation completes, remove the window
        setTimeout(() => {
          set((state) => {
            const newWindows = state.windows.filter((w) => w.id !== windowId);
            const newActiveId =
              state.activeWindowId === windowId
                ? (newWindows[newWindows.length - 1]?.id ?? null)
                : state.activeWindowId;

            return {
              windows: newWindows.map((w) => ({
                ...w,
                isFocused: w.id === newActiveId,
              })),
              activeWindowId: newActiveId,
            };
          });
        }, 150);
      },

      minimizeWindow: (windowId) => {
        // Start minimizing animation
        set((state) => ({
          windows: state.windows.map((w) =>
            w.id === windowId
              ? {
                  ...w,
                  animationState: "minimizing" as const,
                  isFocused: false,
                }
              : w,
          ),
        }));

        // After animation completes, set isMinimized
        setTimeout(() => {
          set((state) => {
            const newWindows = state.windows.map((w) =>
              w.id === windowId
                ? { ...w, isMinimized: true, animationState: "idle" as const }
                : w,
            );

            // Find next window to focus
            const visibleWindows = newWindows.filter((w) => !w.isMinimized);
            const nextActiveId =
              visibleWindows.length > 0
                ? visibleWindows.reduce((prev, curr) =>
                    curr.zIndex > prev.zIndex ? curr : prev,
                  ).id
                : null;

            return {
              windows: newWindows.map((w) => ({
                ...w,
                isFocused: w.id === nextActiveId,
              })),
              activeWindowId: nextActiveId,
            };
          });
        }, 150); // Match animation duration
      },

      maximizeWindow: (windowId) => {
        const window = get().windows.find((w) => w.id === windowId);
        if (!window) return;

        // Start maximizing animation
        set((state) => ({
          windows: state.windows.map((w) =>
            w.id === windowId
              ? {
                  ...w,
                  animationState: "maximizing" as const,
                  isMaximized: !w.isMaximized,
                }
              : w,
          ),
        }));

        // Reset animation state after animation completes
        setTimeout(() => {
          set((state) => ({
            windows: state.windows.map((w) =>
              w.id === windowId ? { ...w, animationState: "idle" as const } : w,
            ),
          }));
        }, 200); // Match animation duration
      },

      restoreWindow: (windowId) => {
        const newZIndex = get().maxZIndex + 1;

        // First, make window visible with restoring animation
        set((state) => ({
          windows: state.windows.map((w) =>
            w.id === windowId
              ? {
                  ...w,
                  isMinimized: false,
                  isFocused: true,
                  zIndex: newZIndex,
                  animationState: "restoring" as const,
                }
              : { ...w, isFocused: false },
          ),
          activeWindowId: windowId,
          maxZIndex: newZIndex,
        }));

        // Reset animation state after animation completes
        setTimeout(() => {
          set((state) => ({
            windows: state.windows.map((w) =>
              w.id === windowId ? { ...w, animationState: "idle" as const } : w,
            ),
          }));
        }, 150); // Match animation duration
      },

      focusWindow: (windowId) => {
        const window = get().windows.find((w) => w.id === windowId);
        if (!window || window.isFocused) return;

        const newZIndex = get().maxZIndex + 1;

        set((state) => ({
          windows: state.windows.map((w) =>
            w.id === windowId
              ? { ...w, isFocused: true, zIndex: newZIndex }
              : { ...w, isFocused: false },
          ),
          activeWindowId: windowId,
          maxZIndex: newZIndex,
        }));
      },

      refreshWindow: (windowId) => {
        set((state) => ({
          windows: state.windows.map((w) =>
            w.id === windowId ? { ...w, refreshKey: w.refreshKey + 1 } : w,
          ),
        }));
      },

      updatePosition: (windowId, position) => {
        set((state) => ({
          windows: state.windows.map((w) =>
            w.id === windowId ? { ...w, position } : w,
          ),
        }));
      },

      updateSize: (windowId, size) => {
        const window = get().windows.find((w) => w.id === windowId);
        if (!window) return;

        set((state) => ({
          windows: state.windows.map((w) =>
            w.id === windowId ? { ...w, size } : w,
          ),
          // Remember the size for this app
          appSizes: {
            ...state.appSizes,
            [window.appId]: size,
          },
        }));
      },
    }),
    {
      name: "window-store",
      partialize: (state) => ({
        windows: state.windows,
        activeWindowId: state.activeWindowId,
        maxZIndex: state.maxZIndex,
        appSizes: state.appSizes,
      }),
    },
  ),
);
