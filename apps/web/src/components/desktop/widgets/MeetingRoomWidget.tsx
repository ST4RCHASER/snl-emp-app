import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  tokens,
  Button,
  Tooltip,
  Spinner,
  Badge,
} from "@fluentui/react-components";
import {
  Dismiss16Regular,
  Settings16Regular,
  ChevronDown16Regular,
  ChevronUp16Regular,
  People16Regular,
  Person16Regular,
  Clock16Regular,
  ArrowClockwise16Regular,
} from "@fluentui/react-icons";
import type { MeetingRoomWidget as MeetingRoomWidgetType } from "@/stores/widgetStore";
import { calendarQueries, type RoomEvent } from "@/api/queries/calendar";

interface MeetingRoomWidgetProps {
  widget: MeetingRoomWidgetType;
  onUpdate: (updates: Partial<MeetingRoomWidgetType>) => void;
  onRemove: () => void;
  onDragEnd: (position: { x: number; y: number }) => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function EventCard({ event, label }: { event: RoomEvent; label: string }) {
  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.1)",
        borderRadius: 8,
        padding: "8px 10px",
        marginTop: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          opacity: 0.7,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          marginBottom: 4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {event.summary}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 11,
          opacity: 0.8,
        }}
      >
        <Clock16Regular style={{ width: 12, height: 12, flexShrink: 0 }} />
        <span>
          {formatTime(event.start)} - {formatTime(event.end)}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 11,
          opacity: 0.8,
          marginTop: 4,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Person16Regular style={{ width: 12, height: 12, flexShrink: 0 }} />
          {event.organizer}
        </span>
        {event.attendeesCount > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <People16Regular style={{ width: 12, height: 12, flexShrink: 0 }} />
            {event.attendeesCount}{" "}
            {event.attendeesCount === 1 ? "person" : "people"}
          </span>
        )}
      </div>
    </div>
  );
}

export function MeetingRoomWidget({
  widget,
  onUpdate,
  onRemove,
  onDragEnd,
}: MeetingRoomWidgetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(widget.position);
  const [showSettings, setShowSettings] = useState(false);
  const [countdown, setCountdown] = useState<string>("");
  const elementRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const currentPosRef = useRef(widget.position);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    ...calendarQueries.roomEvents(widget.roomType),
    refetchInterval: 60 * 1000, // Auto-refresh every 1 minute
  });

  // Update countdown timer
  useEffect(() => {
    const updateCountdown = () => {
      if (!data) return;

      const now = new Date();

      if (data.currentMeeting) {
        // Show time remaining in current meeting
        const end = new Date(data.currentMeeting.end);
        const remaining = end.getTime() - now.getTime();
        setCountdown(formatCountdown(remaining));
      } else if (data.nextMeeting) {
        // Show time until next meeting (only if within 1 hour)
        const start = new Date(data.nextMeeting.start);
        const until = start.getTime() - now.getTime();
        if (until <= 60 * 60 * 1000 * 8) {
          // Within 1 hour
          setCountdown(formatCountdown(until));
        } else {
          setCountdown("");
        }
      } else {
        setCountdown("");
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [data]);

  useEffect(() => {
    if (!isDragging) {
      setPosition(widget.position);
      currentPosRef.current = widget.position;
    }
  }, [widget.position, isDragging]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;
      if ((e.target as HTMLElement).closest(".settings-panel")) return;
      if ((e.target as HTMLElement).closest(".events-list")) return;

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
    },
    [onDragEnd],
  );

  const isExpanded = widget.expanded || false;
  const isOccupied = data?.isOccupied || false;
  const roomName =
    data?.roomName ||
    (widget.roomType === "inner" ? "Inner Room" : "Outer Room");

  return (
    <div
      ref={elementRef}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: isExpanded ? 300 : 260,
        background: isOccupied
          ? "linear-gradient(135deg, rgba(200, 50, 50, 0.85), rgba(150, 30, 30, 0.9))"
          : "linear-gradient(135deg, rgba(50, 150, 80, 0.85), rgba(30, 120, 60, 0.9))",
        backdropFilter: "blur(10px)",
        borderRadius: 12,
        boxShadow: isDragging
          ? "0 8px 24px rgba(0, 0, 0, 0.4)"
          : "0 2px 8px rgba(0, 0, 0, 0.2)",
        cursor: isDragging ? "grabbing" : "grab",
        zIndex: isDragging ? 1000 : 100,
        display: "flex",
        flexDirection: "column",
        padding: "12px 14px",
        transition: isDragging ? "none" : "box-shadow 0.2s, background 0.3s",
        userSelect: "none",
        color: "white",
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Room Name & Status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>
          {roomName}
        </div>
        <Badge
          appearance="filled"
          color={isOccupied ? "danger" : "success"}
          style={{ fontSize: 10, whiteSpace: "nowrap" }}
        >
          {isOccupied ? "IN USE" : "FREE"}
        </Badge>
      </div>

      {/* Controls - positioned after header to be on top */}
      <div
        style={{
          position: "absolute",
          top: 4,
          right: 4,
          display: "flex",
          gap: 2,
          opacity: 0.6,
          zIndex: 10,
        }}
      >
        <Tooltip content="Refresh" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={
              <ArrowClockwise16Regular
                style={{
                  color: "white",
                  animation: isFetching ? "spin 1s linear infinite" : undefined,
                }}
              />
            }
            onClick={() => refetch()}
            disabled={isFetching}
            style={{ minWidth: 22, height: 22, padding: 2 }}
          />
        </Tooltip>
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

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
          <Spinner size="small" />
        </div>
      ) : error ? (
        <div
          style={{
            fontSize: 12,
            opacity: 0.8,
            textAlign: "center",
            padding: 8,
          }}
        >
          Unable to load room status
        </div>
      ) : (
        <>
          {/* Countdown */}
          {countdown && (
            <div
              style={{
                fontSize: 28,
                fontWeight: 300,
                textAlign: "center",
                fontFamily: "system-ui, -apple-system, sans-serif",
                letterSpacing: -1,
              }}
            >
              {countdown}
            </div>
          )}

          {/* Current/Next meeting info */}
          {data?.currentMeeting ? (
            <EventCard event={data.currentMeeting} label="Current Meeting" />
          ) : data?.nextMeeting ? (
            <EventCard event={data.nextMeeting} label="Next Meeting" />
          ) : (
            <div
              style={{
                textAlign: "center",
                fontSize: 13,
                opacity: 0.8,
                padding: "12px 0",
              }}
            >
              No meetings scheduled today
            </div>
          )}

          {/* Expand/Collapse Button */}
          {data?.events && data.events.length > 0 && (
            <Button
              appearance="subtle"
              size="small"
              icon={
                isExpanded ? (
                  <ChevronUp16Regular style={{ color: "white" }} />
                ) : (
                  <ChevronDown16Regular style={{ color: "white" }} />
                )
              }
              onClick={() => onUpdate({ expanded: !isExpanded })}
              style={{
                marginTop: 8,
                color: "white",
                opacity: 0.8,
                width: "100%",
              }}
            >
              {isExpanded
                ? "Hide schedule"
                : `View all ${data.events.length} events`}
            </Button>
          )}

          {/* Expanded Events List */}
          {isExpanded && data?.events && data.events.length > 0 && (
            <div
              className="events-list"
              style={{
                marginTop: 8,
                maxHeight: 200,
                overflowY: "auto",
                cursor: "default",
              }}
            >
              {data.events.map((event) => (
                <div
                  key={event.id}
                  style={{
                    background: "rgba(255, 255, 255, 0.1)",
                    borderRadius: 6,
                    padding: "6px 8px",
                    marginBottom: 4,
                    fontSize: 11,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {event.summary}
                  </div>
                  <div style={{ opacity: 0.8, marginTop: 2 }}>
                    {formatTime(event.start)} - {formatTime(event.end)}
                    {event.attendeesCount > 0 &&
                      ` (${event.attendeesCount} people)`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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
            zIndex: 10,
          }}
        >
          <div style={{ fontWeight: 500, marginBottom: 8 }}>Select Room</div>
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
              type="radio"
              name={`room-${widget.id}`}
              checked={widget.roomType === "inner"}
              onChange={() => onUpdate({ roomType: "inner" })}
            />
            Inner Room
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
              type="radio"
              name={`room-${widget.id}`}
              checked={widget.roomType === "outer"}
              onChange={() => onUpdate({ roomType: "outer" })}
            />
            Outer Room
          </label>
        </div>
      )}
    </div>
  );
}
