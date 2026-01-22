import { useState, useRef, useEffect } from "react";
import { tokens, Button, Tooltip } from "@fluentui/react-components";
import { Dismiss16Regular, Settings16Regular } from "@fluentui/react-icons";
import type { ClockWidget as ClockWidgetType } from "@/stores/widgetStore";

interface ClockWidgetProps {
  widget: ClockWidgetType;
  onUpdate: (updates: Partial<ClockWidgetType>) => void;
  onRemove: () => void;
  onDragEnd: (position: { x: number; y: number }) => void;
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function ClockWidget({
  widget,
  onUpdate,
  onRemove,
  onDragEnd,
}: ClockWidgetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(widget.position);
  const [time, setTime] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const currentPosRef = useRef(widget.position);

  // Update time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isDragging) {
      setPosition(widget.position);
      currentPosRef.current = widget.position;
    }
  }, [widget.position, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    if ((e.target as HTMLElement).closest(".settings-panel")) return;

    const rect = elementRef.current?.getBoundingClientRect();
    if (!rect) return;

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - startPosRef.current.x);
      const deltaY = Math.abs(moveEvent.clientY - startPosRef.current.y);

      if (deltaX > 5 || deltaY > 5) {
        hasDraggedRef.current = true;
        setIsDragging(true);
        setShowSettings(false);
      }

      if (hasDraggedRef.current) {
        const desktopRect = document
          .querySelector(".desktop")
          ?.getBoundingClientRect();
        if (!desktopRect) return;

        const newX = moveEvent.clientX - desktopRect.left - offsetX;
        const newY = moveEvent.clientY - desktopRect.top - offsetY;

        const newPos = { x: newX, y: newY };
        setPosition(newPos);
        currentPosRef.current = newPos;
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      if (hasDraggedRef.current) {
        setIsDragging(false);
        onDragEnd(currentPosRef.current);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const formatTime = () => {
    let hours = time.getHours();
    const minutes = time.getMinutes().toString().padStart(2, "0");
    const seconds = time.getSeconds().toString().padStart(2, "0");
    let period = "";

    if (!widget.is24Hour) {
      period = hours >= 12 ? " PM" : " AM";
      hours = hours % 12 || 12;
    }

    const timeStr = widget.showSeconds
      ? `${hours.toString().padStart(2, "0")}:${minutes}:${seconds}`
      : `${hours.toString().padStart(2, "0")}:${minutes}`;

    return timeStr + period;
  };

  const formatDate = () => {
    return `${DAYS[time.getDay()]}, ${MONTHS[time.getMonth()]} ${time.getDate()}, ${time.getFullYear()}`;
  };

  return (
    <div
      ref={elementRef}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        minWidth: 160,
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(10px)",
        borderRadius: 12,
        boxShadow: isDragging
          ? "0 8px 24px rgba(0, 0, 0, 0.4)"
          : "0 2px 8px rgba(0, 0, 0, 0.2)",
        cursor: isDragging ? "grabbing" : "grab",
        zIndex: isDragging ? 1000 : 100,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 16px",
        transition: isDragging ? "none" : "box-shadow 0.2s",
        userSelect: "none",
        color: "white",
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Controls */}
      <div
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          display: "flex",
          gap: 2,
          opacity: 0.6,
        }}
      >
        <Tooltip content="Settings" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<Settings16Regular style={{ color: "white" }} />}
            onClick={() => setShowSettings(!showSettings)}
            style={{ minWidth: 22, height: 22, padding: 2 }}
          />
        </Tooltip>
        <Tooltip content="Remove" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<Dismiss16Regular style={{ color: "white" }} />}
            onClick={onRemove}
            style={{ minWidth: 22, height: 22, padding: 2 }}
          />
        </Tooltip>
      </div>

      {/* Time */}
      <div
        style={{
          fontSize: 36,
          fontWeight: 300,
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: -1,
          marginTop: 4,
        }}
      >
        {formatTime()}
      </div>

      {/* Date */}
      {widget.showDate !== false && (
        <div
          style={{
            fontSize: 12,
            opacity: 0.8,
            marginTop: 2,
          }}
        >
          {formatDate()}
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div
          className="settings-panel"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 8,
            background: tokens.colorNeutralBackground1,
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
            padding: 8,
            color: tokens.colorNeutralForeground1,
            fontSize: 12,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 0",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={widget.showSeconds || false}
              onChange={(e) => onUpdate({ showSeconds: e.target.checked })}
            />
            Show seconds
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 0",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={widget.showDate !== false}
              onChange={(e) => onUpdate({ showDate: e.target.checked })}
            />
            Show date
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 0",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={widget.is24Hour || false}
              onChange={(e) => onUpdate({ is24Hour: e.target.checked })}
            />
            24-hour format
          </label>
        </div>
      )}
    </div>
  );
}
