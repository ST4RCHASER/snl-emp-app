import { tokens } from "@fluentui/react-components";
import {
  Image24Regular,
  Note24Regular,
  CalendarLtr24Regular,
  Clock24Regular,
  ChevronRight20Regular,
  ConferenceRoom24Regular,
  Briefcase24Regular,
  CalendarPerson24Regular,
  PersonClock24Regular,
} from "@fluentui/react-icons";
import { useState } from "react";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onOpenSettings: (initialSection?: string) => void;
  onAddStickyNote: () => void;
  onAddCalendar: () => void;
  onAddClock: () => void;
  onAddMeetingRoom: () => void;
  onAddWorkLog: () => void;
  onAddLeave: () => void;
  onAddReserveTime: () => void;
}

export function DesktopContextMenu({
  x,
  y,
  onClose,
  onOpenSettings,
  onAddStickyNote,
  onAddCalendar,
  onAddClock,
  onAddMeetingRoom,
  onAddWorkLog,
  onAddLeave,
  onAddReserveTime,
}: ContextMenuProps) {
  const [widgetsSubmenuOpen, setWidgetsSubmenuOpen] = useState(false);

  // Adjust position to keep menu within viewport
  const menuWidth = 200;
  const menuHeight = 120;
  const submenuWidth = 180;

  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 60);

  // Submenu position
  const submenuX = adjustedX + menuWidth - 4;
  const submenuY = adjustedY + 36;
  const submenuFlipLeft = submenuX + submenuWidth > window.innerWidth - 10;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9998,
        }}
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      {/* Context Menu */}
      <div
        style={{
          position: "fixed",
          left: adjustedX,
          top: adjustedY,
          background: tokens.colorNeutralBackground1,
          borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
          border: `1px solid ${tokens.colorNeutralStroke1}`,
          zIndex: 9999,
          minWidth: menuWidth,
          overflow: "hidden",
          padding: "4px 0",
        }}
      >
        {/* Change Wallpaper */}
        <MenuItem
          icon={<Image24Regular />}
          label="Change Wallpaper"
          onClick={() => {
            onOpenSettings("wallpaper");
            onClose();
          }}
        />

        {/* Widgets Submenu */}
        <div
          style={{ position: "relative" }}
          onMouseEnter={() => setWidgetsSubmenuOpen(true)}
          onMouseLeave={() => setWidgetsSubmenuOpen(false)}
        >
          <MenuItem
            icon={<Note24Regular />}
            label="Add Widget"
            hasSubmenu
            onClick={() => setWidgetsSubmenuOpen(!widgetsSubmenuOpen)}
          />

          {/* Widgets Submenu */}
          {widgetsSubmenuOpen && (
            <div
              style={{
                position: "fixed",
                left: submenuFlipLeft ? adjustedX - submenuWidth + 4 : submenuX,
                top: submenuY,
                background: tokens.colorNeutralBackground1,
                borderRadius: 8,
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
                border: `1px solid ${tokens.colorNeutralStroke1}`,
                zIndex: 10000,
                minWidth: submenuWidth,
                overflow: "hidden",
                padding: "4px 0",
              }}
            >
              <MenuItem
                icon={<Note24Regular />}
                label="Sticky Note"
                onClick={() => {
                  onAddStickyNote();
                  onClose();
                }}
              />
              <MenuItem
                icon={<CalendarLtr24Regular />}
                label="Calendar"
                onClick={() => {
                  onAddCalendar();
                  onClose();
                }}
              />
              <MenuItem
                icon={<Clock24Regular />}
                label="Digital Clock"
                onClick={() => {
                  onAddClock();
                  onClose();
                }}
              />
              <MenuItem
                icon={<ConferenceRoom24Regular />}
                label="Meeting Room"
                onClick={() => {
                  onAddMeetingRoom();
                  onClose();
                }}
              />
              <MenuItem
                icon={<Briefcase24Regular />}
                label="Work Log"
                onClick={() => {
                  onAddWorkLog();
                  onClose();
                }}
              />
              <MenuItem
                icon={<CalendarPerson24Regular />}
                label="Who's on Leave"
                onClick={() => {
                  onAddLeave();
                  onClose();
                }}
              />
              <MenuItem
                icon={<PersonClock24Regular />}
                label="My Reserved Time"
                onClick={() => {
                  onAddReserveTime();
                  onClose();
                }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  hasSubmenu,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  hasSubmenu?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "8px 12px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontSize: 13,
        color: tokens.colorNeutralForeground1,
        textAlign: "left",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = tokens.colorNeutralBackground1Hover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span style={{ display: "flex", fontSize: 18 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {hasSubmenu && <ChevronRight20Regular style={{ opacity: 0.6 }} />}
    </button>
  );
}
