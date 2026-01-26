import { create } from "zustand";

export type SnapZone =
  | "left"
  | "right"
  | "top"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | null;

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
  // Snap state
  snapZone: SnapZone;
  // Store pre-snap position and size for restore
  preSnapState?: {
    position: { x: number; y: number };
    size: { width: number; height: number };
  };
  // Virtual desktop this window belongs to
  desktopId: string;
}

interface AppSizeMemory {
  [appId: string]: { width: number; height: number };
}

// Serializable window state for database storage (excludes runtime-only fields)
export interface SerializableWindowState {
  id: string;
  appId: string;
  title: string;
  isMinimized: boolean;
  isMaximized: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  desktopId: string;
  snapZone: SnapZone;
  preSnapState?: {
    position: { x: number; y: number };
    size: { width: number; height: number };
  };
  // App-specific props that should persist across reloads
  props?: Record<string, unknown>;
}

interface WindowStore {
  windows: WindowState[];
  activeWindowId: string | null;
  maxZIndex: number;
  appSizes: AppSizeMemory; // Remember last size for each app
  isLoaded: boolean;

  // Load state from preferences
  loadFromPreferences: (
    windowStates: SerializableWindowState[] | null,
    appSizes: AppSizeMemory | null,
  ) => void;
  // Get serializable state for saving
  getSerializableState: () => {
    windowStates: SerializableWindowState[];
    appSizes: AppSizeMemory;
  };

  openWindow: (
    appId: string,
    title: string,
    defaultSize?: { width: number; height: number },
    props?: Record<string, unknown>,
    forceNew?: boolean,
    desktopId?: string,
  ) => string;
  moveWindowToDesktop: (windowId: string, desktopId: string) => void;
  getWindowsForDesktop: (desktopId: string) => WindowState[];
  closeWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  maximizeWindow: (windowId: string) => void;
  restoreWindow: (windowId: string) => void;
  focusWindow: (windowId: string) => void;
  refreshWindow: (windowId: string) => void;
  updateWindowProps: (windowId: string, props: Record<string, unknown>) => void;
  updateWindowTitle: (windowId: string, title: string) => void;
  updatePosition: (
    windowId: string,
    position: { x: number; y: number },
  ) => void;
  updateSize: (
    windowId: string,
    size: { width: number; height: number },
  ) => void;
  constrainWindowsToScreen: () => void;
  snapWindow: (windowId: string, zone: SnapZone) => void;
  unSnapWindow: (windowId: string) => void;
}

export const useWindowStore = create<WindowStore>()((set, get) => ({
  windows: [],
  activeWindowId: null,
  isLoaded: false,

  loadFromPreferences: (windowStates, appSizes) => {
    if (windowStates && Array.isArray(windowStates)) {
      // Restore windows from saved state
      const restoredWindows: WindowState[] = windowStates.map((ws, index) => ({
        ...ws,
        isFocused: index === windowStates.length - 1,
        zIndex: index + 1,
        animationState: "idle" as const,
        refreshKey: 0,
        // Restore props from saved state
        props: ws.props,
      }));

      const maxZ = restoredWindows.length;
      const activeId =
        restoredWindows.length > 0
          ? restoredWindows[restoredWindows.length - 1].id
          : null;

      set({
        windows: restoredWindows,
        activeWindowId: activeId,
        maxZIndex: maxZ,
        appSizes: appSizes || {},
        isLoaded: true,
      });
    } else {
      set({
        windows: [],
        activeWindowId: null,
        maxZIndex: 0,
        appSizes: appSizes || {},
        isLoaded: true,
      });
    }
  },

  getSerializableState: () => {
    const { windows, appSizes } = get();
    const windowStates: SerializableWindowState[] = windows.map((w) => ({
      id: w.id,
      appId: w.appId,
      title: w.title,
      isMinimized: w.isMinimized,
      isMaximized: w.isMaximized,
      position: w.position,
      size: w.size,
      desktopId: w.desktopId,
      snapZone: w.snapZone,
      preSnapState: w.preSnapState,
      // Include props for apps that need to persist state
      props: w.props,
    }));
    return { windowStates, appSizes };
  },
  maxZIndex: 0,
  appSizes: {},

  openWindow: (
    appId,
    title,
    defaultSize = { width: 800, height: 600 },
    props,
    forceNew = false,
    desktopId = "desktop-1",
  ) => {
    // Check if window with same appId already exists (unless forceNew is true)
    if (!forceNew) {
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
          snapZone: null,
          desktopId,
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
    const win = get().windows.find((w) => w.id === windowId);
    if (!win) return;

    // If window is maximized or snapped, restore it
    if (win.isMaximized || win.snapZone) {
      set((state) => ({
        windows: state.windows.map((w) =>
          w.id === windowId
            ? {
                ...w,
                animationState: "maximizing" as const,
                isMaximized: false,
                snapZone: null,
                // Restore pre-snap state if available
                position: w.preSnapState?.position || w.position,
                size: w.preSnapState?.size || w.size,
                preSnapState: undefined,
              }
            : w,
        ),
      }));
    } else {
      // Maximize the window
      set((state) => ({
        windows: state.windows.map((w) =>
          w.id === windowId
            ? {
                ...w,
                animationState: "maximizing" as const,
                isMaximized: true,
                snapZone: null,
                // Save current state for restore
                preSnapState: {
                  position: w.position,
                  size: w.size,
                },
              }
            : w,
        ),
      }));
    }

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

  updateWindowProps: (windowId, props) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === windowId ? { ...w, props: { ...w.props, ...props } } : w,
      ),
    }));
  },

  updateWindowTitle: (windowId, title) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === windowId ? { ...w, title } : w,
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

  constrainWindowsToScreen: () => {
    if (typeof window === "undefined") return;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const taskbarHeight = 48; // Height of taskbar
    const minVisiblePortion = 100; // At least 100px of window should be visible

    set((state) => ({
      windows: state.windows.map((w) => {
        // Skip maximized or snapped windows
        if (w.isMaximized || w.snapZone) return w;

        let newX = w.position.x;
        let newY = w.position.y;
        let needsUpdate = false;

        // Check if window is too far right (left edge beyond screen)
        if (w.position.x > screenWidth - minVisiblePortion) {
          newX = Math.max(0, screenWidth - minVisiblePortion);
          needsUpdate = true;
        }

        // Check if window is too far left (right edge beyond screen)
        if (w.position.x + w.size.width < minVisiblePortion) {
          newX = minVisiblePortion - w.size.width;
          needsUpdate = true;
        }

        // Check if window is too far down (top edge beyond screen minus taskbar)
        if (w.position.y > screenHeight - taskbarHeight - minVisiblePortion) {
          newY = Math.max(0, screenHeight - taskbarHeight - minVisiblePortion);
          needsUpdate = true;
        }

        // Check if window is too far up (bottom edge beyond top of screen)
        if (w.position.y + w.size.height < minVisiblePortion) {
          newY = minVisiblePortion - w.size.height;
          needsUpdate = true;
        }

        // Also constrain window size if it's larger than screen
        let newWidth = w.size.width;
        let newHeight = w.size.height;

        if (w.size.width > screenWidth) {
          newWidth = screenWidth - 40;
          newX = 20;
          needsUpdate = true;
        }

        if (w.size.height > screenHeight - taskbarHeight) {
          newHeight = screenHeight - taskbarHeight - 40;
          newY = 20;
          needsUpdate = true;
        }

        if (needsUpdate) {
          return {
            ...w,
            position: { x: newX, y: newY },
            size: { width: newWidth, height: newHeight },
          };
        }

        return w;
      }),
    }));
  },

  snapWindow: (windowId, zone) => {
    if (typeof window === "undefined") return;

    const win = get().windows.find((w) => w.id === windowId);
    if (!win) return;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const taskbarHeight = 48;
    const availableHeight = screenHeight - taskbarHeight;

    // Calculate snap position and size based on zone
    let snapPosition: { x: number; y: number };
    let snapSize: { width: number; height: number };

    switch (zone) {
      case "left":
        snapPosition = { x: 0, y: 0 };
        snapSize = { width: screenWidth / 2, height: availableHeight };
        break;
      case "right":
        snapPosition = { x: screenWidth / 2, y: 0 };
        snapSize = { width: screenWidth / 2, height: availableHeight };
        break;
      case "top":
        // Top snaps to maximize
        snapPosition = { x: 0, y: 0 };
        snapSize = { width: screenWidth, height: availableHeight };
        break;
      case "top-left":
        snapPosition = { x: 0, y: 0 };
        snapSize = { width: screenWidth / 2, height: availableHeight / 2 };
        break;
      case "top-right":
        snapPosition = { x: screenWidth / 2, y: 0 };
        snapSize = { width: screenWidth / 2, height: availableHeight / 2 };
        break;
      case "bottom-left":
        snapPosition = { x: 0, y: availableHeight / 2 };
        snapSize = { width: screenWidth / 2, height: availableHeight / 2 };
        break;
      case "bottom-right":
        snapPosition = { x: screenWidth / 2, y: availableHeight / 2 };
        snapSize = { width: screenWidth / 2, height: availableHeight / 2 };
        break;
      default:
        return;
    }

    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              snapZone: zone,
              isMaximized: zone === "top",
              // Save pre-snap state if not already snapped
              preSnapState: w.preSnapState || {
                position: w.position,
                size: w.size,
              },
              position: snapPosition,
              size: snapSize,
            }
          : w,
      ),
    }));
  },

  unSnapWindow: (windowId) => {
    const win = get().windows.find((w) => w.id === windowId);
    if (!win || !win.snapZone) return;

    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === windowId
          ? {
              ...w,
              snapZone: null,
              isMaximized: false,
              // Restore pre-snap state if available
              position: w.preSnapState?.position || w.position,
              size: w.preSnapState?.size || w.size,
              preSnapState: undefined,
            }
          : w,
      ),
    }));
  },

  moveWindowToDesktop: (windowId, desktopId) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === windowId ? { ...w, desktopId } : w,
      ),
    }));
  },

  getWindowsForDesktop: (desktopId) => {
    return get().windows.filter((w) => w.desktopId === desktopId);
  },
}));
