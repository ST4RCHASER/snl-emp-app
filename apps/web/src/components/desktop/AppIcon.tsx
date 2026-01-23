import { useState, useRef } from "react";
import { tokens } from "@fluentui/react-components";
import {
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

interface AppIconProps {
  app: AppDefinition;
  position: { x: number; y: number };
  onClick: () => void;
  onDragEnd: (x: number, y: number) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart?: () => void;
  onDragCancel?: () => void;
}

// Distance threshold to differentiate click from drag (in pixels)
const DRAG_THRESHOLD = 5;

export function AppIcon({
  app,
  position,
  onClick,
  onDragEnd,
  onContextMenu,
  onDragStart,
  onDragCancel,
}: AppIconProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [currentPos, setCurrentPos] = useState(position);
  const elementRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const justDroppedRef = useRef(false);

  // Update position when props change (e.g., after saving to DB)
  // But don't update if we just dropped - wait for server to confirm
  if (
    !isDragging &&
    !justDroppedRef.current &&
    (currentPos.x !== position.x || currentPos.y !== position.y)
  ) {
    setCurrentPos(position);
  }

  // Reset justDropped flag when position props match current position (server confirmed)
  if (
    justDroppedRef.current &&
    Math.abs(currentPos.x - position.x) < 5 &&
    Math.abs(currentPos.y - position.y) < 5
  ) {
    justDroppedRef.current = false;
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click

    const rect = elementRef.current?.getBoundingClientRect();
    if (!rect) return;

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Check if we've moved enough to be considered a drag
      const deltaX = Math.abs(moveEvent.clientX - startPosRef.current.x);
      const deltaY = Math.abs(moveEvent.clientY - startPosRef.current.y);

      if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
        if (!hasDraggedRef.current) {
          hasDraggedRef.current = true;
          setIsDragging(true);
          onDragStart?.();
        }
      }

      if (hasDraggedRef.current) {
        const desktopRect = document
          .querySelector(".desktop")
          ?.getBoundingClientRect();
        if (!desktopRect) return;

        const newX = moveEvent.clientX - desktopRect.left - offsetX;
        const newY = moveEvent.clientY - desktopRect.top - offsetY;

        // Clamp to desktop bounds
        const clampedX = Math.max(0, Math.min(newX, desktopRect.width - 80));
        const clampedY = Math.max(0, Math.min(newY, desktopRect.height - 100));

        setCurrentPos({ x: clampedX, y: clampedY });
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      if (hasDraggedRef.current) {
        // It was a drag - save the new position
        setIsDragging(false);
        onDragCancel?.(); // Notify parent that dragging ended
        const desktopRect = document
          .querySelector(".desktop")
          ?.getBoundingClientRect();
        if (desktopRect) {
          const rect = elementRef.current?.getBoundingClientRect();
          if (rect) {
            const finalX = rect.left - desktopRect.left;
            const finalY = rect.top - desktopRect.top;

            // Snap to grid locally (90px grid, 10px margin)
            const gridSize = 90;
            const margin = 10;
            const snappedX = Math.round(finalX / gridSize) * gridSize + margin;
            const snappedY = Math.round(finalY / gridSize) * gridSize + margin;

            // Update local position to snapped position immediately
            setCurrentPos({ x: snappedX, y: snappedY });
            justDroppedRef.current = true; // Prevent snap-back until server confirms

            onDragEnd(snappedX, snappedY);
          }
        }
      } else {
        // It was a click - open the app
        onClick();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      ref={elementRef}
      style={{
        position: "absolute",
        left: currentPos.x,
        top: currentPos.y,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "5rem",
        padding: "0.5rem",
        cursor: isDragging ? "grabbing" : "pointer",
        borderRadius: "0.5rem",
        transition: isDragging ? "none" : "left 0.2s, top 0.2s",
        userSelect: "none",
        zIndex: isDragging ? 1000 : 1,
        opacity: isDragging ? 0.8 : 1,
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={onContextMenu}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
    >
      <div
        style={{
          width: "3rem",
          height: "3rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: tokens.colorNeutralBackground1,
          borderRadius: "0.75rem",
          marginBottom: "0.25rem",
          color: tokens.colorNeutralForeground1,
          boxShadow: isDragging
            ? "0 4px 12px rgba(0, 0, 0, 0.3)"
            : "0 1px 3px rgba(0, 0, 0, 0.2)",
          fontSize: "1.75rem",
        }}
      >
        {iconMap[app.icon] || <Person24Regular />}
      </div>
      <span
        style={{
          fontSize: "0.6875rem",
          color: "white",
          textAlign: "center",
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.5)",
          maxWidth: "4.375rem",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {app.name}
      </span>
    </div>
  );
}
