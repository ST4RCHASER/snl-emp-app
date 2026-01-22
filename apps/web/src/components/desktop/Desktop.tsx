import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWindowStore } from "@/stores/windowStore";
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
import { MobileAppDrawer } from "./MobileAppDrawer";
import {
  StickyNoteWidget,
  CalendarWidget,
  ClockWidget,
  MeetingRoomWidget,
} from "./widgets";
import {
  preferencesQueries,
  useUpdatePreferences,
  type BackgroundFit,
  type IconPositions,
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

  const { data: preferences } = useQuery(preferencesQueries.user);
  const { data: unreadStatus } = useQuery(announcementQueries.unread);
  const systemIsDark = useSystemTheme();
  const updatePreferences = useUpdatePreferences();

  // Cast preferences to typed version
  const prefs = preferences as
    | {
        theme?: string;
        backgroundImage?: string | null;
        backgroundFit?: string;
        backgroundColor?: string;
        guiScale?: number;
        iconPositions?: IconPositions;
        widgets?: Widget[];
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
  const iconPositions = (prefs?.iconPositions as IconPositions) || {};

  // Constrain icon positions on screen resize/reload (avoid overlaps)
  const hasConstrainedIconsRef = useRef(false);
  useEffect(() => {
    if (prefs && !hasConstrainedIconsRef.current) {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const taskbarHeight = 48;
      const gridSize = 90; // Base grid size (unscaled)
      const margin = 10;
      const minVisible = 40;

      // Calculate max grid columns and rows
      const maxCols = Math.max(
        1,
        Math.floor((screenWidth - margin) / (gridSize * guiScale)),
      );
      const maxRows = Math.max(
        1,
        Math.floor(
          (screenHeight - taskbarHeight - margin) / (gridSize * guiScale),
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

      // Process ALL available apps, not just those with saved positions
      availableApps.forEach((app, index) => {
        const appId = app.id;
        const savedPos = iconPositions[appId];

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

          newPositions[appId] = {
            x: col * gridSize + margin,
            y: row * gridSize + margin,
          };
          needsUpdate = true;
        } else {
          // Position is valid, mark as occupied
          occupiedCells.add(cellKey);
          if (savedPos) {
            newPositions[appId] = savedPos;
          }
          // If no saved position and not overlapping, don't save (use default)
        }
      });

      if (needsUpdate) {
        updatePreferences.mutate({ iconPositions: newPositions });
      }
      hasConstrainedIconsRef.current = true;
    }
  }, [prefs, iconPositions, guiScale, updatePreferences, availableApps]);

  // On mobile, show the app drawer instead of the desktop
  if (isMobile) {
    return <MobileAppDrawer backgroundImage={backgroundImage} />;
  }

  // Grid settings for icon snapping - scale with GUI
  const BASE_GRID_SIZE = 90;
  const BASE_ICON_MARGIN = 10;
  const GRID_SIZE = BASE_GRID_SIZE * guiScale;
  const ICON_MARGIN = BASE_ICON_MARGIN * guiScale;

  // Calculate grid position for snapping
  const snapToGrid = useCallback(
    (x: number, y: number) => {
      const snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE + ICON_MARGIN;
      const snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE + ICON_MARGIN;
      return { x: snappedX, y: snappedY };
    },
    [GRID_SIZE, ICON_MARGIN],
  );

  // Get position for an app icon
  const getIconPosition = useCallback(
    (appId: string, index: number) => {
      if (iconPositions[appId]) {
        // Scale stored positions by GUI scale
        return {
          x: iconPositions[appId].x * guiScale,
          y: iconPositions[appId].y * guiScale,
        };
      }
      // Default grid position
      return {
        x: ICON_MARGIN,
        y: index * GRID_SIZE + ICON_MARGIN,
      };
    },
    [iconPositions, GRID_SIZE, ICON_MARGIN, guiScale],
  );

  // Handle icon drag end
  const handleIconDragEnd = useCallback(
    (appId: string, x: number, y: number) => {
      const snapped = snapToGrid(x, y);
      // Save positions in unscaled form so they work across different scales
      const unscaledPosition = {
        x: snapped.x / guiScale,
        y: snapped.y / guiScale,
      };
      const newPositions = {
        ...iconPositions,
        [appId]: unscaledPosition,
      };
      updatePreferences.mutate({ iconPositions: newPositions });
    },
    [iconPositions, snapToGrid, updatePreferences, guiScale],
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
      openWindow(appId, app.name, app.defaultSize, undefined, forceNew);
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
      className="desktop"
      style={{
        ...getBackgroundStyle(),
        backgroundColor: getDesktopBgColor(),
        paddingBottom: "3rem", // Account for taskbar height (rem-based for scaling)
      }}
      onContextMenu={handleContextMenu}
    >
      {/* Desktop Icons */}
      {availableApps.map((app, index) => {
        const pos = getIconPosition(app.id, index);
        return (
          <AppIcon
            key={app.id}
            app={app}
            position={pos}
            onClick={() => handleOpenApp(app.id, true)}
            onDragEnd={(x, y) => handleIconDragEnd(app.id, x, y)}
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
        />
      )}

      {/* Windows */}
      {windows.map((win) => {
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
          >
            <WindowContext.Provider
              value={{ refreshKey: win.refreshKey, windowProps: win.props }}
            >
              <AppComponent />
            </WindowContext.Provider>
          </Window>
        );
      })}

      {/* Taskbar */}
      <Taskbar />
    </div>
  );
}
