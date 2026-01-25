import { useState, useRef, useEffect } from "react";
import { Button, Tooltip, tokens, Input } from "@fluentui/react-components";
import {
  Add16Regular,
  Dismiss16Regular,
  Desktop24Regular,
  Checkmark16Regular,
  Edit16Regular,
} from "@fluentui/react-icons";
import { useDesktopStore, type VirtualDesktop } from "@/stores/desktopStore";
import { useWindowStore } from "@/stores/windowStore";

interface DesktopSwitcherProps {
  taskbarSize?: number;
}

export function DesktopSwitcher({ taskbarSize = 1.0 }: DesktopSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  const desktops = useDesktopStore((s) => s.desktops);
  const activeDesktopId = useDesktopStore((s) => s.activeDesktopId);
  const setActiveDesktop = useDesktopStore((s) => s.setActiveDesktop);
  const addDesktop = useDesktopStore((s) => s.addDesktop);
  const removeDesktop = useDesktopStore((s) => s.removeDesktop);
  const renameDesktop = useDesktopStore((s) => s.renameDesktop);

  const windows = useWindowStore((s) => s.windows);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setEditingId(null);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const getWindowCountForDesktop = (desktopId: string) => {
    return windows.filter((w) => w.desktopId === desktopId && !w.isMinimized)
      .length;
  };

  const handleSwitchDesktop = (desktopId: string) => {
    setActiveDesktop(desktopId);
    setIsOpen(false);
  };

  const handleAddDesktop = () => {
    const newId = addDesktop();
    setActiveDesktop(newId);
  };

  const handleStartEdit = (desktop: VirtualDesktop) => {
    setEditingId(desktop.id);
    setEditName(desktop.name);
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim()) {
      renameDesktop(editingId, editName.trim());
    }
    setEditingId(null);
    setEditName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditName("");
    }
  };

  const activeDesktop = desktops.find((d) => d.id === activeDesktopId);

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      {/* Trigger Button */}
      <Tooltip content="Virtual Desktops" relationship="label">
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: `${0.375 * taskbarSize}rem`,
            padding: `${0.25 * taskbarSize}rem ${0.5 * taskbarSize}rem`,
            borderRadius: `${0.375 * taskbarSize}rem`,
            cursor: "pointer",
            background: isOpen
              ? tokens.colorNeutralBackground1Pressed
              : "transparent",
            color: tokens.colorNeutralForeground1,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            if (!isOpen) {
              e.currentTarget.style.background =
                tokens.colorNeutralBackground1Hover;
            }
          }}
          onMouseLeave={(e) => {
            if (!isOpen) {
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          <Desktop24Regular style={{ fontSize: `${1.25 * taskbarSize}rem` }} />
          <span
            style={{ fontSize: `${0.75 * taskbarSize}rem`, fontWeight: 500 }}
          >
            {activeDesktop?.name || "Desktop 1"}
          </span>
        </div>
      </Tooltip>

      {/* Desktop Switcher Panel */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            right: 0,
            marginBottom: "0.5rem",
            background: tokens.colorNeutralBackground1,
            borderRadius: "0.5rem",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
            border: `1px solid ${tokens.colorNeutralStroke1}`,
            minWidth: "16rem",
            overflow: "hidden",
            zIndex: 10002,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0.75rem",
              borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>
              Virtual Desktops
            </span>
            <Tooltip content="New Desktop" relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<Add16Regular />}
                onClick={handleAddDesktop}
              />
            </Tooltip>
          </div>

          {/* Desktop List */}
          <div style={{ maxHeight: "20rem", overflow: "auto" }}>
            {desktops
              .sort((a, b) => a.order - b.order)
              .map((desktop) => {
                const isActive = desktop.id === activeDesktopId;
                const windowCount = getWindowCountForDesktop(desktop.id);
                const isEditing = editingId === desktop.id;

                return (
                  <div
                    key={desktop.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "0.5rem 0.75rem",
                      gap: "0.5rem",
                      background: isActive
                        ? tokens.colorBrandBackground2
                        : "transparent",
                      cursor: isEditing ? "default" : "pointer",
                      transition: "background 0.15s",
                    }}
                    onClick={() =>
                      !isEditing && handleSwitchDesktop(desktop.id)
                    }
                    onMouseEnter={(e) => {
                      if (!isActive && !isEditing) {
                        e.currentTarget.style.background =
                          tokens.colorNeutralBackground1Hover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive && !isEditing) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {/* Desktop Preview */}
                    <div
                      style={{
                        width: "3rem",
                        height: "2rem",
                        borderRadius: "0.25rem",
                        background: tokens.colorNeutralBackground3,
                        border: isActive
                          ? `2px solid ${tokens.colorBrandStroke1}`
                          : `1px solid ${tokens.colorNeutralStroke1}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.625rem",
                        color: tokens.colorNeutralForeground3,
                        flexShrink: 0,
                      }}
                    >
                      {windowCount > 0 ? `${windowCount}` : ""}
                    </div>

                    {/* Desktop Name */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <Input
                          size="small"
                          value={editName}
                          onChange={(_, data) => setEditName(data.value)}
                          onKeyDown={handleKeyDown}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: "100%" }}
                        />
                      ) : (
                        <div
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: isActive ? 600 : 400,
                            color: tokens.colorNeutralForeground1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {desktop.name}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div
                      style={{
                        display: "flex",
                        gap: "0.125rem",
                        opacity: 0.7,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isEditing ? (
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<Checkmark16Regular />}
                          onClick={handleSaveEdit}
                          style={{ minWidth: "1.5rem", padding: "0.125rem" }}
                        />
                      ) : (
                        <Tooltip content="Rename" relationship="label">
                          <Button
                            appearance="subtle"
                            size="small"
                            icon={<Edit16Regular />}
                            onClick={() => handleStartEdit(desktop)}
                            style={{ minWidth: "1.5rem", padding: "0.125rem" }}
                          />
                        </Tooltip>
                      )}
                      {desktops.length > 1 && desktop.id !== "desktop-1" && (
                        <Tooltip content="Remove" relationship="label">
                          <Button
                            appearance="subtle"
                            size="small"
                            icon={<Dismiss16Regular />}
                            onClick={() => removeDesktop(desktop.id)}
                            style={{
                              minWidth: "1.5rem",
                              padding: "0.125rem",
                              color: tokens.colorPaletteRedForeground1,
                            }}
                          />
                        </Tooltip>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Keyboard Shortcuts Hint */}
          <div
            style={{
              padding: "0.5rem 0.75rem",
              borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
              fontSize: "0.6875rem",
              color: tokens.colorNeutralForeground3,
            }}
          >
            Tip: Create multiple desktops to organize your windows
          </div>
        </div>
      )}
    </div>
  );
}
