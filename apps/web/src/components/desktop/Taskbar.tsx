import { useState } from "react";
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
  People24Regular,
  PeopleTeam24Regular,
  ChatWarning24Regular,
  Chat24Regular,
  Settings24Regular,
  Megaphone24Regular,
  Note24Regular,
  Clock24Regular,
  DocumentSearch24Regular,
  Dismiss20Regular,
  Subtract20Regular,
  Maximize20Regular,
  Square20Regular,
} from "@fluentui/react-icons";
import { useWindowStore, type WindowState } from "@/stores/windowStore";
import { useAuth } from "@/auth/provider";
import { signOut } from "@/auth/client";

const iconMap: Record<string, React.ReactNode> = {
  announcements: <Megaphone24Regular />,
  "employee-directory": <People24Regular />,
  "leave-management": <Calendar24Regular />,
  complaints: <ChatWarning24Regular />,
  "complaint-chat": <Chat24Regular />,
  settings: <Settings24Regular />,
  profile: <Person24Regular />,
  calendar: <CalendarLtr24Regular />,
  notes: <Note24Regular />,
  "work-hours": <Clock24Regular />,
  "team-dashboard": <PeopleTeam24Regular />,
  "audit-logs": <DocumentSearch24Regular />,
};

export function Taskbar() {
  const windows = useWindowStore((s) => s.windows);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const restoreWindow = useWindowStore((s) => s.restoreWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const maximizeWindow = useWindowStore((s) => s.maximizeWindow);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const { user } = useAuth();

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
          height: "3rem",
          background: tokens.colorNeutralBackground2,
          borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          padding: "0 1rem",
          gap: "0.5rem",
          zIndex: 9999,
        }}
      >
        <div style={{ display: "flex", gap: "0.25rem", flex: 1 }}>
          {windows.map((win) => (
            <Tooltip key={win.id} content={win.title} relationship="label">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "2.5rem",
                  height: "2.5rem",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  transition: "background 0.2s",
                  background: win.isFocused
                    ? tokens.colorNeutralBackground1Pressed
                    : "transparent",
                  opacity: win.isMinimized ? 0.6 : 1,
                  color: tokens.colorNeutralForeground1,
                  fontSize: "1.25rem",
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
                {iconMap[win.appId] ||
                  (win.appId.startsWith("complaint-chat-") ? (
                    <Chat24Regular />
                  ) : (
                    <Person24Regular />
                  ))}
              </div>
            </Tooltip>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{
              color: tokens.colorNeutralForeground1,
              fontSize: "0.75rem",
            }}
          >
            {new Date().toLocaleTimeString([], {
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
