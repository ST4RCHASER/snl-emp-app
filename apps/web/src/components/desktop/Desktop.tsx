import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { tokens } from "@fluentui/react-components";
import {
  useWindowStore,
  type SerializableWindowState,
} from "@/stores/windowStore";
import { useDesktopStore, type VirtualDesktop } from "@/stores/desktopStore";
import {
  useWidgetStore,
  generateWidgetId,
  STICKY_NOTE_COLORS,
  type Widget,
} from "@/stores/widgetStore";
import { getAppById, getAppsForRole } from "../apps/registry";
import { useAuth } from "@/auth/provider";
import { Window } from "./Window";
import { Taskbar } from "./Taskbar";
import { AppIcon } from "./AppIcon";
import { WindowContext } from "./WindowContext";
import { DesktopContextMenu } from "./DesktopContextMenu";
import { AppDrawer } from "./AppDrawer";
import { MobileAppDrawer } from "./MobileAppDrawer";
import {
  StickyNoteWidget,
  CalendarWidget,
  ClockWidget,
  MeetingRoomWidget,
  WorkLogWidget,
  LeaveWidget,
  ReserveTimeWidget,
} from "./widgets";
import {
  preferencesQueries,
  useUpdatePreferences,
  type BackgroundFit,
  type IconPositions,
  type DesktopShortcuts,
  type AppSizes,
} from "@/api/queries/preferences";
import { announcementQueries } from "@/api/queries/announcements";
import { logAction } from "@/api/queries/audit";
import { useSystemTheme } from "@/hooks/useSystemTheme";
import { useMobile } from "@/hooks/useMobile";
import type { Role } from "@snl-emp/shared";

const DEFAULT_WALLPAPER = "https://m1r.ai/W9nZp.jpg";

export function Desktop() {
  const { user } = useAuth();
  const isMobile = useMobile();

  const windows = useWindowStore((s) => s.windows);
  const openWindow = useWindowStore((s) => s.openWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const maximizeWindow = useWindowStore((s) => s.maximizeWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const refreshWindow = useWindowStore((s) => s.refreshWindow);
  const updatePosition = useWindowStore((s) => s.updatePosition);
  const updateSize = useWindowStore((s) => s.updateSize);
  const constrainWindowsToScreen = useWindowStore(
    (s) => s.constrainWindowsToScreen,
  );
  const snapWindow = useWindowStore((s) => s.snapWindow);
  const unSnapWindow = useWindowStore((s) => s.unSnapWindow);

  // Desktop store
  const activeDesktopId = useDesktopStore((s) => s.activeDesktopId);
  const desktops = useDesktopStore((s) => s.desktops);
  const isDesktopStoreLoaded = useDesktopStore((s) => s.isLoaded);
  const loadDesktopFromPreferences = useDesktopStore(
    (s) => s.loadFromPreferences,
  );
  const getDesktopState = useDesktopStore((s) => s.getState);

  // Window store loading
  const isWindowStoreLoaded = useWindowStore((s) => s.isLoaded);
  const loadWindowFromPreferences = useWindowStore(
    (s) => s.loadFromPreferences,
  );
  const getWindowSerializableState = useWindowStore(
    (s) => s.getSerializableState,
  );

  // Filter windows for the active desktop
  const desktopWindows = windows.filter((w) => w.desktopId === activeDesktopId);

  // Widget store
  const widgets = useWidgetStore((s) => s.widgets);
  const setWidgets = useWidgetStore((s) => s.setWidgets);
  const addWidget = useWidgetStore((s) => s.addWidget);
  const updateWidget = useWidgetStore((s) => s.updateWidget);
  const removeWidget = useWidgetStore((s) => s.removeWidget);
  const updateWidgetPosition = useWidgetStore((s) => s.updateWidgetPosition);
  const constrainWidgetsToScreen = useWidgetStore(
    (s) => s.constrainWidgetsToScreen,
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // App drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Icon dragging state (to show grid overlay)
  const [isIconDragging, setIsIconDragging] = useState(false);

  // Icon context menu state (for right-click on desktop icons)
  const [iconContextMenu, setIconContextMenu] = useState<{
    x: number;
    y: number;
    shortcutId: string;
    appId: string;
  } | null>(null);

  // Marquee selection state
  const [marquee, setMarquee] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [selectedIcons, setSelectedIcons] = useState<Set<string>>(new Set());
  const desktopRef = useRef<HTMLDivElement>(null);
  const justFinishedMarqueeRef = useRef(false);

  const { data: preferences, isFetching: isPreferencesFetching } = useQuery(
    preferencesQueries.user,
  );
  const { data: unreadStatus } = useQuery(announcementQueries.unread);
  const systemIsDark = useSystemTheme();
  const updatePreferences = useUpdatePreferences();

  // Sync indicator states
  const isSyncing = updatePreferences.isPending;
  const isLoading = isPreferencesFetching;

  // Cast preferences to typed version
  const prefs = preferences as
    | {
        theme?: string;
        backgroundImage?: string | null;
        backgroundFit?: string;
        backgroundColor?: string;
        guiScale?: number;
        desktopIconSize?: number;
        taskbarSize?: number;
        appDrawerIconSize?: number;
        iconPositions?: IconPositions;
        widgets?: Widget[];
        desktopShortcuts?: DesktopShortcuts;
        virtualDesktops?: VirtualDesktop[];
        activeDesktopId?: string;
        windowStates?: SerializableWindowState[];
        appSizes?: AppSizes;
      }
    | undefined;

  // Track if widgets have been loaded from preferences
  const widgetsLoadedRef = useRef(false);

  const userRole =
    ((user as { role?: string } | undefined)?.role as Role) || "EMPLOYEE";
  const availableApps = getAppsForRole(userRole);

  // Track if we've already auto-launched announcements this session
  const hasAutoLaunchedRef = useRef(false);

  // Constrain windows to screen on initial load
  const hasConstrainedRef = useRef(false);
  useEffect(() => {
    if (!hasConstrainedRef.current && windows.length > 0) {
      // Small delay to ensure window dimensions are available
      const timer = setTimeout(() => {
        constrainWindowsToScreen();
        hasConstrainedRef.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [windows.length, constrainWindowsToScreen]);

  // Auto-launch announcements app if there are unread announcements
  useEffect(() => {
    if (
      unreadStatus?.hasUnread &&
      !hasAutoLaunchedRef.current &&
      userRole !== "HR" &&
      userRole !== "DEVELOPER"
    ) {
      hasAutoLaunchedRef.current = true;
      const announcementsApp = getAppById("announcements");
      if (announcementsApp) {
        openWindow(
          "announcements",
          announcementsApp.name,
          announcementsApp.defaultSize,
        );
      }
    }
  }, [unreadStatus?.hasUnread, userRole, openWindow]);

  // Load widgets from preferences
  useEffect(() => {
    if (prefs && !widgetsLoadedRef.current) {
      const savedWidgets = prefs.widgets;
      if (savedWidgets && Array.isArray(savedWidgets)) {
        setWidgets(savedWidgets);
      }
      widgetsLoadedRef.current = true;
    }
  }, [prefs, setWidgets]);

  // Load desktop and window state from preferences
  const desktopStateLoadedRef = useRef(false);
  useEffect(() => {
    if (prefs && !desktopStateLoadedRef.current) {
      // Load desktop state
      loadDesktopFromPreferences(
        prefs.virtualDesktops || null,
        prefs.activeDesktopId || null,
      );
      // Load window state
      loadWindowFromPreferences(
        prefs.windowStates || null,
        prefs.appSizes || null,
      );
      desktopStateLoadedRef.current = true;
    }
  }, [prefs, loadDesktopFromPreferences, loadWindowFromPreferences]);

  // Debounced save for window and desktop state changes
  const saveStateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedStateRef = useRef<string>("");

  const saveDesktopAndWindowState = useCallback(() => {
    if (!isDesktopStoreLoaded || !isWindowStoreLoaded) return;

    const desktopState = getDesktopState();
    const windowState = getWindowSerializableState();

    // Create a serialized version to compare
    const currentState = JSON.stringify({
      virtualDesktops: desktopState.desktops,
      activeDesktopId: desktopState.activeDesktopId,
      windowStates: windowState.windowStates,
      appSizes: windowState.appSizes,
    });

    // Only save if state actually changed
    if (currentState === lastSavedStateRef.current) return;

    if (saveStateTimeoutRef.current) {
      clearTimeout(saveStateTimeoutRef.current);
    }

    saveStateTimeoutRef.current = setTimeout(() => {
      lastSavedStateRef.current = currentState;
      updatePreferences.mutate({
        virtualDesktops: desktopState.desktops,
        activeDesktopId: desktopState.activeDesktopId,
        windowStates: windowState.windowStates,
        appSizes: windowState.appSizes,
      });
    }, 1000); // Debounce for 1 second
  }, [
    isDesktopStoreLoaded,
    isWindowStoreLoaded,
    getDesktopState,
    getWindowSerializableState,
    updatePreferences,
  ]);

  // Save state whenever windows or desktops change
  useEffect(() => {
    if (isDesktopStoreLoaded && isWindowStoreLoaded) {
      saveDesktopAndWindowState();
    }
  }, [
    windows,
    desktops,
    activeDesktopId,
    isDesktopStoreLoaded,
    isWindowStoreLoaded,
    saveDesktopAndWindowState,
  ]);

  // Constrain widgets to screen after they are loaded
  const hasConstrainedWidgetsRef = useRef(false);
  useEffect(() => {
    if (
      widgetsLoadedRef.current &&
      !hasConstrainedWidgetsRef.current &&
      widgets.length > 0
    ) {
      const timer = setTimeout(() => {
        constrainWidgetsToScreen();
        hasConstrainedWidgetsRef.current = true;
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [widgets.length, constrainWidgetsToScreen]);

  // Save widgets to preferences (debounced)
  const saveWidgetsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveWidgets = useCallback(
    (widgetsToSave: Widget[]) => {
      if (saveWidgetsTimeoutRef.current) {
        clearTimeout(saveWidgetsTimeoutRef.current);
      }
      saveWidgetsTimeoutRef.current = setTimeout(() => {
        updatePreferences.mutate({ widgets: widgetsToSave });
      }, 500);
    },
    [updatePreferences],
  );

  // Determine if dark mode based on preference (reserved for future use)
  const themeSetting = prefs?.theme;
  const _isDarkMode =
    themeSetting === "light"
      ? false
      : themeSetting === "dark"
        ? true
        : systemIsDark;
  void _isDarkMode; // Reserved for future theme support
  const backgroundImage = prefs?.backgroundImage || DEFAULT_WALLPAPER;
  const userHasCustomWallpaper = !!prefs?.backgroundImage;
  const backgroundFit = (prefs?.backgroundFit as BackgroundFit) || "cover";
  const backgroundColor = prefs?.backgroundColor || "#1a1a1a";
  const guiScale = prefs?.guiScale || 1.0;
  const desktopIconSize = prefs?.desktopIconSize || 1.0;
  const taskbarSize = prefs?.taskbarSize || 1.0;
  const appDrawerIconSize = prefs?.appDrawerIconSize || 1.0;
  const iconPositions = (prefs?.iconPositions as IconPositions) || {};

  // Desktop shortcuts - default to some common apps if not set
  // Each shortcut has a unique id and an appId
  type ShortcutItem = { id: string; appId: string };
  const defaultShortcuts: ShortcutItem[] = [
    { id: "default-profile", appId: "profile" },
    { id: "default-announcements", appId: "announcements" },
    { id: "default-leave", appId: "leave-management" },
    { id: "default-work", appId: "work-hours" },
  ];

  // Handle both old format (string[]) and new format (ShortcutItem[])
  // Cast to unknown first since the database returns Json? type
  const rawShortcuts = prefs?.desktopShortcuts as unknown;
  const desktopShortcuts: ShortcutItem[] = rawShortcuts
    ? Array.isArray(rawShortcuts) && rawShortcuts.length > 0
      ? typeof rawShortcuts[0] === "string"
        ? // Old format: convert string[] to ShortcutItem[]
          (rawShortcuts as string[]).map((appId, idx) => ({
            id: `migrated-${idx}-${appId}`,
            appId,
          }))
        : // New format: use as-is
          (rawShortcuts as ShortcutItem[])
      : defaultShortcuts
    : defaultShortcuts;

  // Map shortcuts to apps with their unique shortcut id
  const shortcutApps = desktopShortcuts
    .map((shortcut) => {
      const app = availableApps.find((a) => a.id === shortcut.appId);
      return app ? { ...app, shortcutId: shortcut.id } : null;
    })
    .filter((app): app is NonNullable<typeof app> => app !== null);

  // Constrain icon positions on screen resize/reload (avoid overlaps)
  const hasConstrainedIconsRef = useRef(false);
  useEffect(() => {
    if (prefs && !hasConstrainedIconsRef.current) {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const taskbarHeight = 48 * taskbarSize;
      const gridSize = 90; // Base grid size (unscaled)
      const margin = 10;
      const minVisible = 40;

      // Calculate max grid columns and rows (using desktopIconSize for grid scaling)
      const maxCols = Math.max(
        1,
        Math.floor((screenWidth - margin) / (gridSize * desktopIconSize)),
      );
      const maxRows = Math.max(
        1,
        Math.floor(
          (screenHeight - taskbarHeight - margin) /
            (gridSize * desktopIconSize),
        ),
      );

      let needsUpdate = false;
      const newPositions: IconPositions = {};
      const occupiedCells = new Set<string>();

      // Helper to get grid cell key
      const getCellKey = (col: number, row: number) => `${col},${row}`;

      // Helper to find nearest free cell
      const findFreeCell = (
        preferredCol: number,
        preferredRow: number,
      ): { col: number; row: number } => {
        // Clamp preferred to valid range
        const clampedCol = Math.max(0, Math.min(maxCols - 1, preferredCol));
        const clampedRow = Math.max(0, Math.min(maxRows - 1, preferredRow));

        // Try clamped position first
        if (!occupiedCells.has(getCellKey(clampedCol, clampedRow))) {
          return { col: clampedCol, row: clampedRow };
        }

        // Search in expanding rings around preferred position
        for (
          let radius = 1;
          radius < Math.max(maxCols, maxRows) * 2;
          radius++
        ) {
          for (let dc = -radius; dc <= radius; dc++) {
            for (let dr = -radius; dr <= radius; dr++) {
              if (Math.abs(dc) !== radius && Math.abs(dr) !== radius) continue;
              const col = clampedCol + dc;
              const row = clampedRow + dr;
              if (
                col >= 0 &&
                col < maxCols &&
                row >= 0 &&
                row < maxRows &&
                !occupiedCells.has(getCellKey(col, row))
              ) {
                return { col, row };
              }
            }
          }
        }

        // Fallback: find any free cell
        for (let col = 0; col < maxCols; col++) {
          for (let row = 0; row < maxRows; row++) {
            if (!occupiedCells.has(getCellKey(col, row))) {
              return { col, row };
            }
          }
        }

        return { col: 0, row: 0 };
      };

      // Process shortcut apps only (apps shown on desktop)
      shortcutApps.forEach((app, index) => {
        const shortcutId = app.shortcutId;
        const savedPos = iconPositions[shortcutId];

        // Get current position (saved or default)
        let currentX: number;
        let currentY: number;
        if (savedPos) {
          currentX = savedPos.x;
          currentY = savedPos.y;
        } else {
          // Default position: first column, stacked vertically
          currentX = margin;
          currentY = index * gridSize + margin;
        }

        const scaledX = currentX * guiScale;
        const scaledY = currentY * guiScale;

        // Calculate current grid cell
        const currentCol = Math.round(currentX / gridSize);
        const currentRow = Math.round(currentY / gridSize);

        // Check if icon is out of bounds or cell is already occupied
        const isOutOfBounds =
          scaledX > screenWidth - minVisible ||
          scaledY > screenHeight - taskbarHeight - minVisible ||
          scaledX < 0 ||
          scaledY < 0;

        const cellKey = getCellKey(currentCol, currentRow);
        const isOverlapping = occupiedCells.has(cellKey);

        if (isOutOfBounds || isOverlapping) {
          // Find a free cell
          const { col, row } = findFreeCell(currentCol, currentRow);
          occupiedCells.add(getCellKey(col, row));

          newPositions[shortcutId] = {
            x: col * gridSize + margin,
            y: row * gridSize + margin,
          };
          needsUpdate = true;
        } else {
          // Position is valid, mark as occupied
          occupiedCells.add(cellKey);
          if (savedPos) {
            newPositions[shortcutId] = savedPos;
          }
          // If no saved position and not overlapping, don't save (use default)
        }
      });

      if (needsUpdate) {
        updatePreferences.mutate({ iconPositions: newPositions });
      }
      hasConstrainedIconsRef.current = true;
    }
  }, [
    prefs,
    iconPositions,
    desktopIconSize,
    taskbarSize,
    updatePreferences,
    shortcutApps,
  ]);

  // On mobile, show the app drawer instead of the desktop
  if (isMobile) {
    return <MobileAppDrawer backgroundImage={backgroundImage} />;
  }

  // Grid settings for icon snapping
  // BASE values are used for storage (always stored at 1.0 scale)
  // SCALED values are used for display
  const BASE_GRID_SIZE = 90;
  const BASE_ICON_MARGIN = 10;
  const GRID_SIZE = BASE_GRID_SIZE * desktopIconSize;
  const ICON_MARGIN = BASE_ICON_MARGIN * desktopIconSize;

  // Calculate grid position for snapping (returns scaled position)
  const snapToGrid = useCallback(
    (x: number, y: number) => {
      // Calculate which grid cell to snap to
      const snappedCol = Math.round((x - ICON_MARGIN) / GRID_SIZE);
      const snappedRow = Math.round((y - ICON_MARGIN) / GRID_SIZE);
      // Ensure non-negative
      const clampedCol = Math.max(0, snappedCol);
      const clampedRow = Math.max(0, snappedRow);
      const snappedX = clampedCol * GRID_SIZE + ICON_MARGIN;
      const snappedY = clampedRow * GRID_SIZE + ICON_MARGIN;
      return { x: snappedX, y: snappedY };
    },
    [GRID_SIZE, ICON_MARGIN],
  );

  // Get position for an app icon (returns scaled position for display)
  const getIconPosition = useCallback(
    (shortcutId: string, index: number) => {
      const savedPos = iconPositions[shortcutId];
      if (savedPos) {
        // Saved positions are stored at base scale (1.0), scale them for display
        const scaledX = savedPos.x * desktopIconSize;
        const scaledY = savedPos.y * desktopIconSize;

        // Validate that position is within reasonable bounds
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        if (
          scaledX >= 0 &&
          scaledX < screenWidth - 40 &&
          scaledY >= 0 &&
          scaledY < screenHeight - 88
        ) {
          return { x: scaledX, y: scaledY };
        }
      }
      // Default grid position (first column, stacked by index) - already scaled
      return {
        x: ICON_MARGIN,
        y: index * GRID_SIZE + ICON_MARGIN,
      };
    },
    [iconPositions, GRID_SIZE, ICON_MARGIN, desktopIconSize],
  );

  // Handle icon drag end
  const handleIconDragEnd = useCallback(
    (shortcutId: string, x: number, y: number) => {
      // Snap the dragged position to grid (x, y are in scaled units)
      const snapped = snapToGrid(x, y);
      // Convert back to base scale (1.0) for storage
      const unscaledPosition = {
        x: snapped.x / desktopIconSize,
        y: snapped.y / desktopIconSize,
      };
      const newPositions = {
        ...iconPositions,
        [shortcutId]: unscaledPosition,
      };
      updatePreferences.mutate({ iconPositions: newPositions });
    },
    [iconPositions, snapToGrid, updatePreferences, desktopIconSize],
  );

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // Only open context menu when clicking directly on the desktop background
    // Not when clicking on windows, icons, or widgets
    if (e.target === e.currentTarget) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Marquee selection handlers
  const handleDesktopMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start marquee on left click directly on desktop background
    if (e.button !== 0 || e.target !== e.currentTarget) return;

    const rect = desktopRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMarquee({ startX: x, startY: y, currentX: x, currentY: y });
    setSelectedIcons(new Set()); // Clear previous selection
  }, []);

  const handleDesktopMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!marquee) return;

      const rect = desktopRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setMarquee((prev) =>
        prev ? { ...prev, currentX: x, currentY: y } : null,
      );

      // Calculate marquee bounds
      const left = Math.min(marquee.startX, x);
      const top = Math.min(marquee.startY, y);
      const right = Math.max(marquee.startX, x);
      const bottom = Math.max(marquee.startY, y);

      // Check which icons intersect with marquee
      const newSelected = new Set<string>();
      shortcutApps.forEach((app, index) => {
        const pos = getIconPosition(app.shortcutId, index);
        const iconWidth = 5 * 16 * desktopIconSize; // containerWidth in pixels
        const iconHeight = 5 * 16 * desktopIconSize; // approximate height

        // Check intersection
        const iconLeft = pos.x;
        const iconTop = pos.y;
        const iconRight = pos.x + iconWidth;
        const iconBottom = pos.y + iconHeight;

        if (
          iconLeft < right &&
          iconRight > left &&
          iconTop < bottom &&
          iconBottom > top
        ) {
          newSelected.add(app.shortcutId);
        }
      });

      setSelectedIcons(newSelected);
    },
    [marquee, shortcutApps, getIconPosition, desktopIconSize],
  );

  const handleDesktopMouseUp = useCallback(() => {
    if (marquee) {
      // Mark that we just finished a marquee drag to prevent click from clearing selection
      justFinishedMarqueeRef.current = true;
      // Reset the flag after a short delay (after the click event fires)
      setTimeout(() => {
        justFinishedMarqueeRef.current = false;
      }, 0);
    }
    setMarquee(null);
  }, [marquee]);

  // Clear selection when clicking on empty desktop area
  const handleDesktopClick = useCallback((e: React.MouseEvent) => {
    // Don't clear selection if we just finished a marquee drag
    if (justFinishedMarqueeRef.current) {
      return;
    }
    if (e.target === e.currentTarget) {
      setSelectedIcons(new Set());
    }
  }, []);

  // Widget handlers
  const handleAddStickyNote = useCallback(() => {
    const newWidget = {
      id: generateWidgetId(),
      type: "sticky-note" as const,
      position: { x: contextMenu?.x || 100, y: contextMenu?.y || 100 },
      content: "",
      color:
        STICKY_NOTE_COLORS[
          Math.floor(Math.random() * STICKY_NOTE_COLORS.length)
        ],
    };
    addWidget(newWidget);
    saveWidgets([...widgets, newWidget]);
  }, [addWidget, contextMenu, saveWidgets, widgets]);

  const handleAddCalendar = useCallback(() => {
    const newWidget = {
      id: generateWidgetId(),
      type: "calendar" as const,
      position: { x: contextMenu?.x || 100, y: contextMenu?.y || 100 },
      style: "month" as const,
    };
    addWidget(newWidget);
    saveWidgets([...widgets, newWidget]);
  }, [addWidget, contextMenu, saveWidgets, widgets]);

  const handleAddClock = useCallback(() => {
    const newWidget = {
      id: generateWidgetId(),
      type: "clock" as const,
      position: { x: contextMenu?.x || 100, y: contextMenu?.y || 100 },
      showSeconds: false,
      showDate: true,
      is24Hour: false,
    };
    addWidget(newWidget);
    saveWidgets([...widgets, newWidget]);
  }, [addWidget, contextMenu, saveWidgets, widgets]);

  const handleAddMeetingRoom = useCallback(() => {
    const newWidget = {
      id: generateWidgetId(),
      type: "meeting-room" as const,
      position: { x: contextMenu?.x || 100, y: contextMenu?.y || 100 },
      roomType: "inner" as const,
      expanded: false,
    };
    addWidget(newWidget);
    saveWidgets([...widgets, newWidget]);
  }, [addWidget, contextMenu, saveWidgets, widgets]);

  const handleAddWorkLog = useCallback(() => {
    const newWidget = {
      id: generateWidgetId(),
      type: "worklog" as const,
      position: { x: contextMenu?.x || 100, y: contextMenu?.y || 100 },
    };
    addWidget(newWidget);
    saveWidgets([...widgets, newWidget]);
  }, [addWidget, contextMenu, saveWidgets, widgets]);

  const handleAddLeave = useCallback(() => {
    const newWidget = {
      id: generateWidgetId(),
      type: "leave" as const,
      position: { x: contextMenu?.x || 100, y: contextMenu?.y || 100 },
    };
    addWidget(newWidget);
    saveWidgets([...widgets, newWidget]);
  }, [addWidget, contextMenu, saveWidgets, widgets]);

  const handleAddReserveTime = useCallback(() => {
    const newWidget = {
      id: generateWidgetId(),
      type: "reserve-time" as const,
      position: { x: contextMenu?.x || 100, y: contextMenu?.y || 100 },
    };
    addWidget(newWidget);
    saveWidgets([...widgets, newWidget]);
  }, [addWidget, contextMenu, saveWidgets, widgets]);

  const handleWidgetUpdate = useCallback(
    (id: string, updates: Partial<Widget>) => {
      updateWidget(id, updates);
      const updatedWidgets = widgets.map((w) =>
        w.id === id ? ({ ...w, ...updates } as Widget) : w,
      );
      saveWidgets(updatedWidgets);
    },
    [updateWidget, widgets, saveWidgets],
  );

  const handleWidgetRemove = useCallback(
    (id: string) => {
      removeWidget(id);
      const updatedWidgets = widgets.filter((w) => w.id !== id);
      saveWidgets(updatedWidgets);
    },
    [removeWidget, widgets, saveWidgets],
  );

  const handleWidgetDragEnd = useCallback(
    (id: string, position: { x: number; y: number }) => {
      updateWidgetPosition(id, position);
      const updatedWidgets = widgets.map((w) =>
        w.id === id ? ({ ...w, position } as Widget) : w,
      );
      saveWidgets(updatedWidgets);
    },
    [updateWidgetPosition, widgets, saveWidgets],
  );

  const handleOpenSettings = useCallback(
    (initialSection?: string) => {
      const settingsApp = getAppById("settings");
      if (settingsApp) {
        openWindow(
          "settings",
          settingsApp.name,
          settingsApp.defaultSize,
          initialSection ? { initialSection } : undefined,
        );
      }
    },
    [openWindow],
  );

  // Add shortcut to desktop
  const handleAddShortcut = useCallback(
    (appId: string) => {
      // Generate unique shortcut ID
      const shortcutId = `shortcut-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Add the shortcut with unique ID
      // Don't set position - let the default positioning handle it based on index
      const newShortcut = { id: shortcutId, appId };
      const newShortcuts = [...desktopShortcuts, newShortcut];

      updatePreferences.mutate({
        desktopShortcuts: newShortcuts,
      });
    },
    [desktopShortcuts, updatePreferences],
  );

  // Remove shortcut from desktop
  const handleRemoveShortcut = useCallback(
    (shortcutId: string) => {
      const newShortcuts = desktopShortcuts.filter((s) => s.id !== shortcutId);
      // Also remove icon position
      const newPositions = { ...iconPositions };
      delete newPositions[shortcutId];
      updatePreferences.mutate({
        desktopShortcuts: newShortcuts,
        iconPositions: newPositions,
      });
    },
    [desktopShortcuts, iconPositions, updatePreferences],
  );

  // Handle icon right-click
  const handleIconContextMenu = useCallback(
    (e: React.MouseEvent, shortcutId: string, appId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setIconContextMenu({ x: e.clientX, y: e.clientY, shortcutId, appId });
    },
    [],
  );

  const handleCloseIconContextMenu = useCallback(() => {
    setIconContextMenu(null);
  }, []);

  // Handle drag and drop from drawer to desktop
  const handleDesktopDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const appId = e.dataTransfer.getData("application/x-app-id");
      if (appId) {
        // Generate unique shortcut ID
        const shortcutId = `shortcut-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Calculate position from drop location
        const desktopRect = (
          e.currentTarget as HTMLElement
        ).getBoundingClientRect();
        const dropX = e.clientX - desktopRect.left;
        const dropY = e.clientY - desktopRect.top;
        const snapped = snapToGrid(dropX, dropY);
        const unscaledPosition = {
          x: snapped.x / desktopIconSize,
          y: snapped.y / desktopIconSize,
        };

        // Add shortcut and position in single update
        const newShortcut = { id: shortcutId, appId };
        const newShortcuts = [...desktopShortcuts, newShortcut];
        const newPositions = {
          ...iconPositions,
          [shortcutId]: unscaledPosition,
        };
        updatePreferences.mutate({
          desktopShortcuts: newShortcuts,
          iconPositions: newPositions,
        });
      }
    },
    [
      desktopShortcuts,
      iconPositions,
      updatePreferences,
      snapToGrid,
      desktopIconSize,
    ],
  );

  const handleDesktopDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // Get background style based on fit setting
  const getBackgroundStyle = () => {
    const baseStyle = {
      backgroundImage: `url(${backgroundImage})`,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat" as const,
    };

    // For default wallpaper or cover mode, always use cover
    if (!userHasCustomWallpaper) {
      return {
        ...baseStyle,
        backgroundSize: "cover",
      };
    }

    switch (backgroundFit) {
      case "cover":
        return {
          ...baseStyle,
          backgroundSize: "cover",
        };
      case "contain":
        return {
          ...baseStyle,
          backgroundSize: "contain",
          backgroundColor: backgroundColor,
        };
      case "fill":
        return {
          ...baseStyle,
          backgroundSize: "100% 100%",
        };
      case "center":
        return {
          ...baseStyle,
          backgroundSize: "auto",
          backgroundColor: backgroundColor,
        };
      default:
        return {
          ...baseStyle,
          backgroundSize: "cover",
        };
    }
  };

  const handleOpenApp = (appId: string, forceNew: boolean = false) => {
    const app = getAppById(appId);
    if (app) {
      openWindow(
        appId,
        app.name,
        app.defaultSize,
        undefined,
        forceNew,
        activeDesktopId,
      );
      // Log the app open action
      logAction("open_app", "app", `Opened ${app.name}`, {
        appId,
        appName: app.name,
      });
    }
  };

  // Determine background color
  const getDesktopBgColor = () => {
    // For contain/center modes with custom wallpaper, use user's chosen background color
    if (
      userHasCustomWallpaper &&
      (backgroundFit === "contain" || backgroundFit === "center")
    ) {
      return backgroundColor;
    }
    // For cover/fill or default wallpaper, no background color needed
    return undefined;
  };

  return (
    <div
      ref={desktopRef}
      className="desktop"
      style={{
        ...getBackgroundStyle(),
        backgroundColor: getDesktopBgColor(),
        paddingBottom: `${3 * taskbarSize}rem`, // Account for taskbar height (scales with taskbar size)
        userSelect: marquee ? "none" : "auto", // Prevent text selection during marquee drag
      }}
      onContextMenu={handleContextMenu}
      onMouseDown={handleDesktopMouseDown}
      onMouseMove={handleDesktopMouseMove}
      onMouseUp={handleDesktopMouseUp}
      onMouseLeave={handleDesktopMouseUp}
      onClick={handleDesktopClick}
      onDrop={handleDesktopDrop}
      onDragOver={handleDesktopDragOver}
    >
      {/* Grid overlay when dragging icons */}
      {isIconDragging && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 48 * taskbarSize, // Above taskbar (scales with taskbar size)
            pointerEvents: "none",
            zIndex: 0,
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            backgroundPosition: `${ICON_MARGIN}px ${ICON_MARGIN}px`,
          }}
        >
          {/* Highlight cells */}
          {Array.from({ length: Math.ceil(window.innerWidth / GRID_SIZE) }).map(
            (_, col) =>
              Array.from({
                length: Math.ceil(
                  (window.innerHeight - 48 * taskbarSize) / GRID_SIZE,
                ),
              }).map((_, row) => (
                <div
                  key={`${col}-${row}`}
                  style={{
                    position: "absolute",
                    left: col * GRID_SIZE + ICON_MARGIN,
                    top: row * GRID_SIZE + ICON_MARGIN,
                    width: GRID_SIZE - 2,
                    height: GRID_SIZE - 2,
                    border: "1px dashed rgba(255,255,255,0.15)",
                    borderRadius: 4,
                  }}
                />
              )),
          )}
        </div>
      )}

      {/* Marquee selection rectangle - below windows (z-index 0) */}
      {marquee && (
        <div
          style={{
            position: "absolute",
            left: Math.min(marquee.startX, marquee.currentX),
            top: Math.min(marquee.startY, marquee.currentY),
            width: Math.abs(marquee.currentX - marquee.startX),
            height: Math.abs(marquee.currentY - marquee.startY),
            border: `1px solid ${tokens.colorBrandBackground}`,
            background: `color-mix(in srgb, ${tokens.colorBrandBackground} 20%, transparent)`,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}

      {/* Desktop Icons - only shortcuts */}
      {shortcutApps.map((app, index) => {
        const pos = getIconPosition(app.shortcutId, index);
        return (
          <AppIcon
            key={app.shortcutId}
            app={app}
            position={pos}
            iconSize={desktopIconSize}
            isSelected={selectedIcons.has(app.shortcutId)}
            onClick={() => handleOpenApp(app.id, true)}
            onDragEnd={(x, y) => handleIconDragEnd(app.shortcutId, x, y)}
            onContextMenu={(e) =>
              handleIconContextMenu(e, app.shortcutId, app.id)
            }
            onDragStart={() => setIsIconDragging(true)}
            onDragCancel={() => setIsIconDragging(false)}
          />
        );
      })}

      {/* Widgets */}
      {widgets.map((widget) => {
        if (widget.type === "sticky-note") {
          return (
            <StickyNoteWidget
              key={widget.id}
              widget={widget}
              onUpdate={(updates) => handleWidgetUpdate(widget.id, updates)}
              onRemove={() => handleWidgetRemove(widget.id)}
              onDragEnd={(pos) => handleWidgetDragEnd(widget.id, pos)}
            />
          );
        }
        if (widget.type === "calendar") {
          return (
            <CalendarWidget
              key={widget.id}
              widget={widget}
              onUpdate={(updates) => handleWidgetUpdate(widget.id, updates)}
              onRemove={() => handleWidgetRemove(widget.id)}
              onDragEnd={(pos) => handleWidgetDragEnd(widget.id, pos)}
            />
          );
        }
        if (widget.type === "clock") {
          return (
            <ClockWidget
              key={widget.id}
              widget={widget}
              onUpdate={(updates) => handleWidgetUpdate(widget.id, updates)}
              onRemove={() => handleWidgetRemove(widget.id)}
              onDragEnd={(pos) => handleWidgetDragEnd(widget.id, pos)}
            />
          );
        }
        if (widget.type === "meeting-room") {
          return (
            <MeetingRoomWidget
              key={widget.id}
              widget={widget}
              onUpdate={(updates) => handleWidgetUpdate(widget.id, updates)}
              onRemove={() => handleWidgetRemove(widget.id)}
              onDragEnd={(pos) => handleWidgetDragEnd(widget.id, pos)}
            />
          );
        }
        if (widget.type === "worklog") {
          return (
            <WorkLogWidget
              key={widget.id}
              widget={widget}
              onUpdate={(updates) => handleWidgetUpdate(widget.id, updates)}
              onRemove={() => handleWidgetRemove(widget.id)}
              onDragEnd={(pos) => handleWidgetDragEnd(widget.id, pos)}
            />
          );
        }
        if (widget.type === "leave") {
          return (
            <LeaveWidget
              key={widget.id}
              widget={widget}
              onUpdate={(updates) => handleWidgetUpdate(widget.id, updates)}
              onRemove={() => handleWidgetRemove(widget.id)}
              onDragEnd={(pos) => handleWidgetDragEnd(widget.id, pos)}
            />
          );
        }
        if (widget.type === "reserve-time") {
          return (
            <ReserveTimeWidget
              key={widget.id}
              widget={widget}
              onUpdate={(updates) => handleWidgetUpdate(widget.id, updates)}
              onRemove={() => handleWidgetRemove(widget.id)}
              onDragEnd={(pos) => handleWidgetDragEnd(widget.id, pos)}
            />
          );
        }
        return null;
      })}

      {/* Context Menu */}
      {contextMenu && (
        <DesktopContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onOpenSettings={handleOpenSettings}
          onAddStickyNote={handleAddStickyNote}
          onAddCalendar={handleAddCalendar}
          onAddClock={handleAddClock}
          onAddMeetingRoom={handleAddMeetingRoom}
          onAddWorkLog={handleAddWorkLog}
          onAddLeave={handleAddLeave}
          onAddReserveTime={handleAddReserveTime}
        />
      )}

      {/* Windows */}
      {desktopWindows.map((win) => {
        // Handle dynamic app IDs like "complaint-chat-{id}" -> "complaint-chat"
        const baseAppId = win.appId.startsWith("complaint-chat-")
          ? "complaint-chat"
          : win.appId;
        const app = getAppById(baseAppId);
        if (!app) return null;

        const AppComponent = app.component;

        return (
          <Window
            key={win.id}
            window={win}
            guiScale={guiScale}
            onClose={() => closeWindow(win.id)}
            onMinimize={() => minimizeWindow(win.id)}
            onMaximize={() => maximizeWindow(win.id)}
            onRefresh={() => refreshWindow(win.id)}
            onFocus={() => focusWindow(win.id)}
            onDragStop={(pos) => updatePosition(win.id, pos)}
            onResizeStop={(size) => updateSize(win.id, size)}
            onSnap={(zone) => snapWindow(win.id, zone)}
            onUnSnap={() => unSnapWindow(win.id)}
          >
            <WindowContext.Provider
              value={{
                windowId: win.id,
                refreshKey: win.refreshKey,
                windowProps: win.props,
              }}
            >
              <AppComponent />
            </WindowContext.Provider>
          </Window>
        );
      })}

      {/* Taskbar */}
      <Taskbar
        onOpenDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
        isDrawerOpen={isDrawerOpen}
        isSyncing={isSyncing}
        isLoading={isLoading}
        taskbarSize={taskbarSize}
      />

      {/* App Drawer */}
      {isDrawerOpen && (
        <AppDrawer
          apps={availableApps}
          onOpenApp={(appId) => handleOpenApp(appId, true)}
          onAddShortcut={handleAddShortcut}
          onClose={() => setIsDrawerOpen(false)}
          iconSize={appDrawerIconSize}
        />
      )}

      {/* Icon Context Menu (right-click on desktop icon) */}
      {iconContextMenu && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10000,
            }}
            onClick={handleCloseIconContextMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              handleCloseIconContextMenu();
            }}
          />
          <div
            style={{
              position: "fixed",
              left: iconContextMenu.x,
              top: iconContextMenu.y,
              background: "var(--colorNeutralBackground1)",
              borderRadius: "0.5rem",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
              border: "1px solid var(--colorNeutralStroke1)",
              zIndex: 10001,
              minWidth: "10rem",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => {
                // If the right-clicked icon is part of selection, open all selected icons
                if (
                  selectedIcons.has(iconContextMenu.shortcutId) &&
                  selectedIcons.size > 1
                ) {
                  const selectedShortcuts = desktopShortcuts.filter((s) =>
                    selectedIcons.has(s.id),
                  );
                  selectedShortcuts.forEach((s) =>
                    handleOpenApp(s.appId, true),
                  );
                  setSelectedIcons(new Set());
                } else {
                  handleOpenApp(iconContextMenu.appId, true);
                }
                handleCloseIconContextMenu();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "0.875rem",
                color: "var(--colorNeutralForeground1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "var(--colorNeutralBackground1Hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Open
              {selectedIcons.has(iconContextMenu.shortcutId) &&
              selectedIcons.size > 1
                ? ` (${selectedIcons.size})`
                : ""}
            </button>
            <div
              style={{
                height: "1px",
                background: "var(--colorNeutralStroke1)",
                margin: "0.25rem 0",
              }}
            />
            <button
              onClick={() => {
                // If the right-clicked icon is part of selection, remove all selected icons
                if (
                  selectedIcons.has(iconContextMenu.shortcutId) &&
                  selectedIcons.size > 1
                ) {
                  const newShortcuts = desktopShortcuts.filter(
                    (s) => !selectedIcons.has(s.id),
                  );
                  const newPositions = { ...iconPositions };
                  selectedIcons.forEach((id) => delete newPositions[id]);
                  updatePreferences.mutate({
                    desktopShortcuts: newShortcuts,
                    iconPositions: newPositions,
                  });
                  setSelectedIcons(new Set());
                } else {
                  handleRemoveShortcut(iconContextMenu.shortcutId);
                }
                handleCloseIconContextMenu();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                width: "100%",
                padding: "0.5rem 0.75rem",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "0.875rem",
                color: "var(--colorPaletteRedForeground1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "var(--colorNeutralBackground1Hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Remove from Desktop
              {selectedIcons.has(iconContextMenu.shortcutId) &&
              selectedIcons.size > 1
                ? ` (${selectedIcons.size})`
                : ""}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
