import { useState, useEffect } from "react";
import {
  Avatar,
  Button,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Tooltip,
  tokens,
} from "@fluentui/react-components";
import {
  Person24Regular,
  SignOut24Regular,
  Calendar24Regular,
  CalendarLtr24Regular,
  CalendarPerson24Regular,
  CalendarClock24Regular,
  People24Regular,
  PeopleTeam24Regular,
  ChatWarning24Regular,
  Chat24Regular,
  Settings24Regular,
  Megaphone24Regular,
  Note24Regular,
  Clock24Regular,
  DocumentSearch24Regular,
  Video24Regular,
  Dismiss20Regular,
  Subtract20Regular,
  Maximize20Regular,
  Square20Regular,
  Apps24Regular,
  ArrowUp16Regular,
  ArrowDown16Regular,
  PlugDisconnected16Regular,
} from "@fluentui/react-icons";
import { useWindowStore, type WindowState } from "@/stores/windowStore";
import { useDesktopStore } from "@/stores/desktopStore";
import { useAuth } from "@/auth/provider";
import { signOut } from "@/auth/client";
import { DesktopSwitcher } from "./DesktopSwitcher";
import { useServerStatus } from "@/hooks/useServerStatus";

const getIcon = (appId: string, size: number = 1.0): React.ReactNode => {
  // Base icon size is 24px, scale it with the size multiplier
  const iconSize = Math.round(24 * size);
  const iconStyle = { width: iconSize, height: iconSize };
  const iconMap: Record<string, React.ReactNode> = {
    announcements: <Megaphone24Regular style={iconStyle} />,
    "employee-directory": <People24Regular style={iconStyle} />,
    "leave-management": <Calendar24Regular style={iconStyle} />,
    complaints: <ChatWarning24Regular style={iconStyle} />,
    "complaint-chat": <Chat24Regular style={iconStyle} />,
    settings: <Settings24Regular style={iconStyle} />,
    profile: <Person24Regular style={iconStyle} />,
    calendar: <CalendarLtr24Regular style={iconStyle} />,
    notes: <Note24Regular style={iconStyle} />,
    "work-hours": <Clock24Regular style={iconStyle} />,
    "work-logs": <Clock24Regular style={iconStyle} />,
    "team-dashboard": <PeopleTeam24Regular style={iconStyle} />,
    "team-worklog": <PeopleTeam24Regular style={iconStyle} />,
    "team-calendar": <CalendarPerson24Regular style={iconStyle} />,
    "resource-reservation": <CalendarClock24Regular style={iconStyle} />,
    "audit-logs": <DocumentSearch24Regular style={iconStyle} />,
    youtube: <Video24Regular style={iconStyle} />,
  };

  if (appId.startsWith("complaint-chat-")) {
    return <Chat24Regular style={iconStyle} />;
  }

  return iconMap[appId] || <Person24Regular style={iconStyle} />;
};

// Custom icon component for team calendar with employee avatar overlay
function TeamCalendarIcon({
  avatar,
  name,
  size = 1.0,
}: {
  avatar?: string;
  name?: string;
  size?: number;
}) {
  const iconSize = Math.round(24 * size);
  // Map to nearest valid Fluent UI avatar size
  const getAvatarSize = (
    s: number,
  ): 16 | 20 | 24 | 28 | 32 | 36 | 40 | 48 | 56 | 64 | 72 | 96 | 120 | 128 => {
    const targetSize = Math.round(20 * s);
    const validSizes = [
      16, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96, 120, 128,
    ] as const;
    return validSizes.reduce((prev, curr) =>
      Math.abs(curr - targetSize) < Math.abs(prev - targetSize) ? curr : prev,
    );
  };
  return (
    <div style={{ position: "relative", width: iconSize, height: iconSize }}>
      <CalendarLtr24Regular style={{ width: iconSize, height: iconSize }} />
      <Avatar
        size={getAvatarSize(size)}
        name={name || "Employee"}
        image={{ src: avatar || undefined }}
        style={{
          position: "absolute",
          bottom: -4 * size,
          right: -4 * size,
          border: `${Math.max(1, Math.round(2 * size))}px solid ${tokens.colorNeutralBackground2}`,
        }}
      />
    </div>
  );
}

interface TaskbarProps {
  onOpenDrawer?: () => void;
  isDrawerOpen?: boolean;
  isSyncing?: boolean;
  isLoading?: boolean;
  taskbarSize?: number;
}

export function Taskbar({
  onOpenDrawer,
  isDrawerOpen,
  isSyncing,
  isLoading,
  taskbarSize = 1.0,
}: TaskbarProps) {
  const windows = useWindowStore((s) => s.windows);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const maximizeWindow = useWindowStore((s) => s.maximizeWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const activeDesktopId = useDesktopStore((s) => s.activeDesktopId);
  const { user } = useAuth();

  // Server connection status
  const { isConnected, retry: retryConnection } = useServerStatus();

  // Filter windows for the active desktop
  const desktopWindows = windows.filter((w) => w.desktopId === activeDesktopId);

  // Current time state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const [contextMenu, setContextMenu] = useState<{
    windowId: string;
    x: number;
    y: number;
  } | null>(null);

  const handleTaskbarClick = (window: WindowState) => {
    if (window.isMinimized) {
      // If minimized, restore and focus
      restoreWindow(window.id);
    } else if (window.isFocused) {
      // If already focused, minimize it
      minimizeWindow(window.id);
    } else {
      // If not focused, bring to front
      focusWindow(window.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, windowId: string) => {
    e.preventDefault();
    setContextMenu({
      windowId,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const getContextWindow = () => {
    if (!contextMenu) return null;
    return windows.find((w) => w.id === contextMenu.windowId);
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.reload();
  };

  const contextWindow = getContextWindow();

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: `${3 * taskbarSize}rem`,
          background: tokens.colorNeutralBackground2,
          borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          padding: `0 ${1 * taskbarSize}rem`,
          gap: `${0.5 * taskbarSize}rem`,
          zIndex: 9999,
        }}
      >
        {/* Start/App Drawer Button */}
        <Tooltip content="All Apps" relationship="label">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: `${2.5 * taskbarSize}rem`,
              height: `${2.5 * taskbarSize}rem`,
              borderRadius: `${0.5 * taskbarSize}rem`,
              cursor: "pointer",
              transition: "background 0.2s",
              background: isDrawerOpen
                ? tokens.colorBrandBackground
                : "transparent",
              color: isDrawerOpen ? "white" : tokens.colorNeutralForeground1,
              fontSize: `${1.25 * taskbarSize}rem`,
            }}
            onClick={onOpenDrawer}
            onMouseEnter={(e) => {
              if (!isDrawerOpen) {
                e.currentTarget.style.background =
                  tokens.colorNeutralBackground1Hover;
              }
            }}
            onMouseLeave={(e) => {
              if (!isDrawerOpen) {
                e.currentTarget.style.background = "transparent";
              }
            }}
          >
            <Apps24Regular
              style={{
                width: Math.round(24 * taskbarSize),
                height: Math.round(24 * taskbarSize),
              }}
            />
          </div>
        </Tooltip>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: `${1.5 * taskbarSize}rem`,
            background: tokens.colorNeutralStroke1,
            marginRight: `${0.25 * taskbarSize}rem`,
          }}
        />

        <div
          style={{ display: "flex", gap: `${0.25 * taskbarSize}rem`, flex: 1 }}
        >
          {desktopWindows.map((win) => (
            <Tooltip key={win.id} content={win.title} relationship="label">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: `${2.5 * taskbarSize}rem`,
                  height: `${2.5 * taskbarSize}rem`,
                  borderRadius: `${0.5 * taskbarSize}rem`,
                  cursor: "pointer",
                  transition: "background 0.2s",
                  background: win.isFocused
                    ? tokens.colorNeutralBackground1Pressed
                    : "transparent",
                  opacity: win.isMinimized ? 0.6 : 1,
                  color: tokens.colorNeutralForeground1,
                  fontSize: `${1.25 * taskbarSize}rem`,
                }}
                onClick={() => handleTaskbarClick(win)}
                onContextMenu={(e) => handleContextMenu(e, win.id)}
                onMouseEnter={(e) => {
                  if (!win.isFocused) {
                    e.currentTarget.style.background =
                      tokens.colorNeutralBackground1Hover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!win.isFocused) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {win.appId === "team-calendar" ? (
                  <TeamCalendarIcon
                    avatar={win.props?.employeeAvatar as string | undefined}
                    name={win.props?.employeeName as string | undefined}
                    size={taskbarSize}
                  />
                ) : (
                  getIcon(win.appId, taskbarSize)
                )}
              </div>
            </Tooltip>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: `${0.75 * taskbarSize}rem`,
          }}
        >
          {/* Desktop Switcher */}
          <DesktopSwitcher taskbarSize={taskbarSize} />

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: `${1.5 * taskbarSize}rem`,
              background: tokens.colorNeutralStroke1,
            }}
          />

          {/* Status Indicators */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: `${0.25 * taskbarSize}rem`,
            }}
          >
            {/* Connection Status */}
            {!isConnected && (
              <Tooltip
                content="Disconnected - Click to retry"
                relationship="label"
              >
                <div
                  onClick={retryConnection}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: `${1.5 * taskbarSize}rem`,
                    height: `${1.5 * taskbarSize}rem`,
                    borderRadius: `${0.25 * taskbarSize}rem`,
                    cursor: "pointer",
                    color: tokens.colorPaletteRedForeground1,
                    animation: "pulse 2s ease-in-out infinite",
                  }}
                >
                  <PlugDisconnected16Regular />
                </div>
              </Tooltip>
            )}

            {/* Sync Indicator - Upload */}
            {isSyncing && (
              <Tooltip content="Saving..." relationship="label">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: `${1.5 * taskbarSize}rem`,
                    height: `${1.5 * taskbarSize}rem`,
                    borderRadius: `${0.25 * taskbarSize}rem`,
                    color: tokens.colorBrandForeground1,
                    animation: "pulse 1s ease-in-out infinite",
                  }}
                >
                  <ArrowUp16Regular />
                </div>
              </Tooltip>
            )}

            {/* Sync Indicator - Download */}
            {isLoading && !isSyncing && (
              <Tooltip content="Loading..." relationship="label">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: `${1.5 * taskbarSize}rem`,
                    height: `${1.5 * taskbarSize}rem`,
                    borderRadius: `${0.25 * taskbarSize}rem`,
                    color: tokens.colorBrandForeground1,
                    animation: "pulse 1s ease-in-out infinite",
                  }}
                >
                  <ArrowDown16Regular />
                </div>
              </Tooltip>
            )}
          </div>

          <span
            style={{
              color: tokens.colorNeutralForeground1,
              fontSize: `${0.75 * taskbarSize}rem`,
            }}
          >
            {currentTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>

          <Menu>
            <MenuTrigger disableButtonEnhancement>
              <Button
                appearance="subtle"
                style={{ padding: 0, minWidth: "auto" }}
              >
                <Avatar
                  name={user?.name || user?.email || "User"}
                  image={{ src: user?.image || undefined }}
                  size={32}
                  color="colorful"
                />
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItem disabled style={{ opacity: 1 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {user?.name || "User"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: tokens.colorNeutralForeground3,
                      }}
                    >
                      {user?.email}
                    </div>
                    <div
                      style={{
                        fontSize: "0.6875rem",
                        color: tokens.colorBrandForeground1,
                        textTransform: "uppercase",
                        marginTop: "0.25rem",
                      }}
                    >
                      {(user as { role?: string } | undefined)?.role ||
                        "EMPLOYEE"}
                    </div>
                  </div>
                </MenuItem>
                <MenuItem icon={<SignOut24Regular />} onClick={handleSignOut}>
                  Sign Out
                </MenuItem>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
      </div>

      {/* Context Menu for Window */}
      {contextMenu && contextWindow && (
        <>
          {/* Backdrop to close menu */}
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
          {/* Context Menu */}
          <div
            style={{
              position: "fixed",
              left: contextMenu.x,
              top: "auto",
              bottom: "3.5rem",
              background: tokens.colorNeutralBackground1,
              borderRadius: "0.5rem",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
              border: `1px solid ${tokens.colorNeutralStroke1}`,
              zIndex: 10001,
              minWidth: "10rem",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "0.5rem 0.75rem",
                borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
                fontSize: "0.75rem",
                fontWeight: 600,
                color: tokens.colorNeutralForeground2,
              }}
            >
              {contextWindow.title}
            </div>
            <div style={{ padding: "0.25rem" }}>
              {contextWindow.isMinimized ? (
                <button
                  onClick={() => {
                    restoreWindow(contextWindow.id);
                    handleCloseContextMenu();
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
                    color: tokens.colorNeutralForeground1,
                    borderRadius: "0.25rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      tokens.colorNeutralBackground1Hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Subtract20Regular />
                  Restore
                </button>
              ) : (
                <button
                  onClick={() => {
                    minimizeWindow(contextWindow.id);
                    handleCloseContextMenu();
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
                    color: tokens.colorNeutralForeground1,
                    borderRadius: "0.25rem",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      tokens.colorNeutralBackground1Hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Subtract20Regular />
                  Minimize
                </button>
              )}

              <button
                onClick={() => {
                  maximizeWindow(contextWindow.id);
                  handleCloseContextMenu();
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
                  color: tokens.colorNeutralForeground1,
                  borderRadius: "0.25rem",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    tokens.colorNeutralBackground1Hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {contextWindow.isMaximized ? (
                  <Square20Regular />
                ) : (
                  <Maximize20Regular />
                )}
                {contextWindow.isMaximized ? "Restore Size" : "Maximize"}
              </button>

              <div
                style={{
                  height: "1px",
                  background: tokens.colorNeutralStroke1,
                  margin: "0.25rem 0",
                }}
              />

              <button
                onClick={() => {
                  closeWindow(contextWindow.id);
                  handleCloseContextMenu();
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
                  color: tokens.colorPaletteRedForeground1,
                  borderRadius: "0.25rem",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    tokens.colorNeutralBackground1Hover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <Dismiss20Regular />
                Close
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
