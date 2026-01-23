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
  ChatWarning24Regular,
  Chat24Regular,
  Settings24Regular,
  Megaphone24Regular,
  Note24Regular,
  Clock24Regular,
  DocumentSearch24Regular,
} from "@fluentui/react-icons";
import type { AppDefinition } from "../apps/registry";

const iconMap: Record<string, React.ReactNode> = {
  People: <People24Regular />,
  PeopleTeam: <PeopleTeam24Regular />,
  Calendar: <Calendar24Regular />,
  CalendarLtr: <CalendarLtr24Regular />,
  CalendarPerson: <CalendarPerson24Regular />,
  ChatWarning: <ChatWarning24Regular />,
  Chat: <Chat24Regular />,
  Settings: <Settings24Regular />,
  Person: <Person24Regular />,
  Megaphone: <Megaphone24Regular />,
  Note: <Note24Regular />,
  Clock: <Clock24Regular />,
  DocumentSearch: <DocumentSearch24Regular />,
};

interface AppDrawerProps {
  apps: AppDefinition[];
  onOpenApp: (appId: string) => void;
  onAddShortcut: (appId: string) => void;
  onClose: () => void;
}

export function AppDrawer({
  apps,
  onOpenApp,
  onAddShortcut,
  onClose,
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
          gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
          gap: 24,
          width: "100%",
          maxWidth: 900,
          overflow: "auto",
          padding: "0 20px",
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
                padding: 12,
                cursor: "pointer",
                borderRadius: 12,
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
                  width: 56,
                  height: 56,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: tokens.colorNeutralBackground1,
                  borderRadius: 14,
                  marginBottom: 8,
                  fontSize: 28,
                  color: tokens.colorNeutralForeground1,
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                }}
              >
                {iconMap[app.icon] || <Person24Regular />}
              </div>
              {/* Name */}
              <span
                style={{
                  fontSize: 12,
                  color: "white",
                  textAlign: "center",
                  maxWidth: 90,
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
