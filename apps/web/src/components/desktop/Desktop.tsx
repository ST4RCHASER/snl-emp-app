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
import { StickyNoteWidget, CalendarWidget, ClockWidget } from "./widgets";
import {
  preferencesQueries,
  useUpdatePreferences,
  type BackgroundFit,
  type IconPositions,
} from "@/api/queries/preferences";
import { announcementQueries } from "@/api/queries/announcements";
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

  // Widget store
  const widgets = useWidgetStore((s) => s.widgets);
  const setWidgets = useWidgetStore((s) => s.setWidgets);
  const addWidget = useWidgetStore((s) => s.addWidget);
  const updateWidget = useWidgetStore((s) => s.updateWidget);
  const removeWidget = useWidgetStore((s) => s.removeWidget);
  const updateWidgetPosition = useWidgetStore((s) => s.updateWidgetPosition);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const { data: preferences } = useQuery(preferencesQueries.user);
  const { data: unreadStatus } = useQuery(announcementQueries.unread);
  const systemIsDark = useSystemTheme();
  const updatePreferences = useUpdatePreferences();

  // Track if widgets have been loaded from preferences
  const widgetsLoadedRef = useRef(false);

  const userRole = (user?.role as Role) || "EMPLOYEE";
  const availableApps = getAppsForRole(userRole);

  // Track if we've already auto-launched announcements this session
  const hasAutoLaunchedRef = useRef(false);

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
    if (preferences && !widgetsLoadedRef.current) {
      const savedWidgets = (preferences as { widgets?: Widget[] }).widgets;
      if (savedWidgets && Array.isArray(savedWidgets)) {
        setWidgets(savedWidgets);
      }
      widgetsLoadedRef.current = true;
    }
  }, [preferences, setWidgets]);

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
  const themeSetting = preferences?.theme;
  const _isDarkMode =
    themeSetting === "light"
      ? false
      : themeSetting === "dark"
        ? true
        : systemIsDark;
  void _isDarkMode; // Reserved for future theme support
  const backgroundImage = preferences?.backgroundImage || DEFAULT_WALLPAPER;
  const userHasCustomWallpaper = !!preferences?.backgroundImage;
  const backgroundFit =
    (preferences?.backgroundFit as BackgroundFit) || "cover";
  const backgroundColor = preferences?.backgroundColor || "#1a1a1a";
  const guiScale = preferences?.guiScale || 1.0;
  const iconPositions = (preferences?.iconPositions as IconPositions) || {};

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
    // Only open context menu when clicking on the desktop background
    if ((e.target as HTMLElement).closest(".desktop") === e.currentTarget) {
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

  const handleOpenApp = (appId: string) => {
    const app = getAppById(appId);
    if (app) {
      openWindow(appId, app.name, app.defaultSize);
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
            onClick={() => handleOpenApp(app.id)}
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
