import { useState, useMemo } from "react";
import { Input, tokens } from "@fluentui/react-components";
import {
  Search24Regular,
  Dismiss24Regular,
  Person24Regular,
  People24Regular,
  PeopleTeam24Regular,
  Calendar24Regular,
  CalendarLtr24Regular,
  CalendarPerson24Regular,
  CalendarClock24Regular,
  ChatWarning24Regular,
  Chat24Regular,
  Settings24Regular,
  Megaphone24Regular,
  Note24Regular,
  Clock24Regular,
  DocumentSearch24Regular,
  Video24Regular,
} from "@fluentui/react-icons";
import type { AppDefinition } from "../apps/registry";

const getIcon = (iconName: string, size: number = 1.0): React.ReactNode => {
  // Base icon size is 28px for drawer, scale it
  const iconSize = Math.round(28 * size);
  const iconStyle = { width: iconSize, height: iconSize };
  const iconMap: Record<string, React.ReactNode> = {
    People: <People24Regular style={iconStyle} />,
    PeopleTeam: <PeopleTeam24Regular style={iconStyle} />,
    Calendar: <Calendar24Regular style={iconStyle} />,
    CalendarLtr: <CalendarLtr24Regular style={iconStyle} />,
    CalendarPerson: <CalendarPerson24Regular style={iconStyle} />,
    CalendarClock: <CalendarClock24Regular style={iconStyle} />,
    ChatWarning: <ChatWarning24Regular style={iconStyle} />,
    Chat: <Chat24Regular style={iconStyle} />,
    Settings: <Settings24Regular style={iconStyle} />,
    Person: <Person24Regular style={iconStyle} />,
    Megaphone: <Megaphone24Regular style={iconStyle} />,
    Note: <Note24Regular style={iconStyle} />,
    Clock: <Clock24Regular style={iconStyle} />,
    DocumentSearch: <DocumentSearch24Regular style={iconStyle} />,
    Video: <Video24Regular style={iconStyle} />,
  };
  return iconMap[iconName] || <Person24Regular style={iconStyle} />;
};

interface AppDrawerProps {
  apps: AppDefinition[];
  onOpenApp: (appId: string) => void;
  onAddShortcut: (appId: string) => void;
  onClose: () => void;
  iconSize?: number;
}

export function AppDrawer({
  apps,
  onOpenApp,
  onAddShortcut,
  onClose,
  iconSize = 1.0,
}: AppDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [draggedApp, setDraggedApp] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    appId: string;
  } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return apps;
    const query = searchQuery.toLowerCase();
    return apps.filter((app) => app.name.toLowerCase().includes(query));
  }, [apps, searchQuery]);

  const handleAppClick = (appId: string) => {
    onOpenApp(appId);
    onClose();
  };

  const handleDragStart = (e: React.DragEvent, appId: string) => {
    setDraggedApp(appId);
    e.dataTransfer.setData("application/x-app-id", appId);
    e.dataTransfer.effectAllowed = "copy";
    // Close drawer after a short delay so user can drop on desktop
    setTimeout(() => {
      onClose();
    }, 100);
  };

  const handleDragEnd = () => {
    setDraggedApp(null);
    setIsDraggingOver(false);
  };

  const handleDropZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDraggingOver(true);
  };

  const handleDropZoneDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDropZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData("application/x-app-id");
    if (appId) {
      onAddShortcut(appId);
      // Close drawer so user can see the new icon on desktop
      onClose();
    }
    setDraggedApp(null);
    setIsDraggingOver(false);
  };

  const handleContextMenu = (e: React.MouseEvent, appId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, appId });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 48, // Above taskbar
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(20px)",
        zIndex: 9998,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "60px 40px 40px",
        animation: "fadeIn 0.2s ease-out",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "transparent",
          border: "none",
          color: "rgba(255, 255, 255, 0.7)",
          cursor: "pointer",
          padding: 8,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <Dismiss24Regular />
      </button>

      {/* Search bar */}
      <div style={{ width: "100%", maxWidth: 300, marginBottom: 40 }}>
        <Input
          placeholder="Search"
          value={searchQuery}
          onChange={(_, data) => setSearchQuery(data.value)}
          contentBefore={
            <Search24Regular
              style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: 16 }}
            />
          }
          style={{
            width: "100%",
            background: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: 8,
          }}
          autoFocus
        />
      </div>

      {/* App grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(${100 * iconSize}px, 1fr))`,
          gap: 24 * iconSize,
          width: "100%",
          maxWidth: 900,
          overflowX: "hidden",
          overflowY: "auto",
          padding: `${10 * iconSize}px 20px`,
        }}
      >
        {filteredApps.map((app) => {
          return (
            <div
              key={app.id}
              draggable
              onDragStart={(e) => handleDragStart(e, app.id)}
              onDragEnd={handleDragEnd}
              onClick={() => handleAppClick(app.id)}
              onContextMenu={(e) => handleContextMenu(e, app.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: 12 * iconSize,
                cursor: "pointer",
                borderRadius: 12 * iconSize,
                transition: "background 0.15s, transform 0.15s",
                opacity: draggedApp === app.id ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.transform = "scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: 56 * iconSize,
                  height: 56 * iconSize,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: tokens.colorNeutralBackground1,
                  borderRadius: 14 * iconSize,
                  marginBottom: 8 * iconSize,
                  fontSize: 28 * iconSize,
                  color: tokens.colorNeutralForeground1,
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                }}
              >
                {getIcon(app.icon, iconSize)}
              </div>
              {/* Name */}
              <span
                style={{
                  fontSize: 12 * iconSize,
                  color: "white",
                  textAlign: "center",
                  maxWidth: 90 * iconSize,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
                }}
              >
                {app.name}
              </span>
            </div>
          );
        })}
      </div>

      {filteredApps.length === 0 && (
        <div
          style={{
            color: "rgba(255, 255, 255, 0.5)",
            fontSize: 14,
            marginTop: 40,
          }}
        >
          No apps found matching "{searchQuery}"
        </div>
      )}

      {/* Drop Zone / Hint */}
      <div
        onDragOver={handleDropZoneDragOver}
        onDragLeave={handleDropZoneDragLeave}
        onDrop={handleDropZoneDrop}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: draggedApp ? 80 : 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isDraggingOver
            ? "rgba(99, 102, 241, 0.3)"
            : draggedApp
              ? "rgba(255, 255, 255, 0.1)"
              : "transparent",
          borderTop: isDraggingOver
            ? "2px dashed rgba(99, 102, 241, 0.8)"
            : draggedApp
              ? "2px dashed rgba(255, 255, 255, 0.3)"
              : "none",
          transition: "all 0.2s ease",
        }}
      >
        <span
          style={{
            color: isDraggingOver
              ? "rgba(255, 255, 255, 0.9)"
              : "rgba(255, 255, 255, 0.4)",
            fontSize: draggedApp ? 14 : 12,
            fontWeight: isDraggingOver ? 600 : 400,
          }}
        >
          {draggedApp
            ? isDraggingOver
              ? "Drop to add to Desktop"
              : "Drag here to add to Desktop"
            : "Drag apps here to add to Desktop • Right-click for options"}
        </span>
      </div>

      {/* Context Menu */}
      {contextMenu && (
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
            onClick={handleCloseContextMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              handleCloseContextMenu();
            }}
          />
          <div
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: contextMenu.y,
              background: tokens.colorNeutralBackground1,
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
              border: `1px solid ${tokens.colorNeutralStroke1}`,
              zIndex: 10001,
              minWidth: 160,
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => {
                handleAppClick(contextMenu.appId);
                handleCloseContextMenu();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "10px 14px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 14,
                color: tokens.colorNeutralForeground1,
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  tokens.colorNeutralBackground1Hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Open
            </button>
            <button
              onClick={() => {
                onAddShortcut(contextMenu.appId);
                handleCloseContextMenu();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "10px 14px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 14,
                color: tokens.colorNeutralForeground1,
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  tokens.colorNeutralBackground1Hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Add to Desktop
            </button>
          </div>
        </>
      )}

      <style>
        {`
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}
      </style>
    </div>
  );
}
