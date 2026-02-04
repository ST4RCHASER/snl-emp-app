import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  tokens,
  Button,
  Tooltip,
  Spinner,
  Avatar,
} from "@fluentui/react-components";
import {
  Dismiss16Regular,
  ChevronLeft16Regular,
  ChevronRight16Regular,
  ArrowClockwise16Regular,
  CalendarPerson16Regular,
} from "@fluentui/react-icons";
import type { LeaveWidget as LeaveWidgetType } from "@/stores/widgetStore";
import { leaveQueries } from "@/api/queries/leaves";

interface LeaveWidgetProps {
  widget: LeaveWidgetType;
  onUpdate: (updates: Partial<LeaveWidgetType>) => void;
  onRemove: () => void;
  onDragEnd: (position: { x: number; y: number }) => void;
}

interface LeaveData {
  id: string;
  employeeId: string;
  leaveTypeConfig: {
    id: string;
    name: string;
    code: string;
    color: string | null;
  };
  startDate: string;
  endDate: string;
  status: string;
  isHalfDay: boolean;
  halfDayType?: "morning" | "afternoon" | null;
  employee: {
    id: string;
    fullName: string | null;
    avatar: string | null;
    user: { name: string | null; email: string; image: string | null };
  };
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function LeaveWidget({ widget, onRemove, onDragEnd }: LeaveWidgetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(widget.position);
  const [currentDate, setCurrentDate] = useState(new Date());
  const elementRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const currentPosRef = useRef(widget.position);

  const dateStr = formatLocalDate(currentDate);

  // Fetch all leaves (HR view)
  const {
    data: leavesData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    ...leaveQueries.all("all"),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Filter leaves for the current date (approved only)
  const todayLeaves = useMemo(() => {
    if (!leavesData || !Array.isArray(leavesData)) return [];
    const leaves = leavesData as unknown as LeaveData[];

    return leaves.filter((leave) => {
      if (leave.status !== "APPROVED") return false;

      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);
      const checkDate = new Date(dateStr);

      // Set times to midnight for proper date comparison
      leaveStart.setHours(0, 0, 0, 0);
      leaveEnd.setHours(0, 0, 0, 0);
      checkDate.setHours(0, 0, 0, 0);

      return checkDate >= leaveStart && checkDate <= leaveEnd;
    });
  }, [leavesData, dateStr]);

  useEffect(() => {
    if (!isDragging) {
      setPosition(widget.position);
      currentPosRef.current = widget.position;
    }
  }, [widget.position, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;

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

  const navigateDay = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + delta);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getEmployeeName = (leave: LeaveData) => {
    return (
      leave.employee.fullName ||
      leave.employee.user.name ||
      leave.employee.user.email
    );
  };

  const getEmployeeAvatar = (leave: LeaveData) => {
    return leave.employee.avatar || leave.employee.user.image || undefined;
  };

  const isToday = currentDate.toDateString() === new Date().toDateString();

  return (
    <div
      ref={elementRef}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: 240,
        background: tokens.colorNeutralBackground1,
        borderRadius: 8,
        boxShadow: isDragging
          ? "0 8px 24px rgba(0, 0, 0, 0.3)"
          : "0 2px 8px rgba(0, 0, 0, 0.15)",
        cursor: isDragging ? "grabbing" : "default",
        zIndex: isDragging ? 100 : 0,
        display: "flex",
        flexDirection: "column",
        transition: isDragging ? "none" : "box-shadow 0.2s",
        userSelect: "none",
        overflow: "hidden",
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 8px",
          borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
          cursor: "grab",
          background: tokens.colorNeutralBackground2,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Button
            appearance="subtle"
            size="small"
            icon={<ChevronLeft16Regular />}
            onClick={() => navigateDay(-1)}
            style={{ minWidth: 24, height: 24, padding: 2 }}
          />
          <Tooltip content="Go to today" relationship="label">
            <Button
              appearance={isToday ? "primary" : "subtle"}
              size="small"
              onClick={goToToday}
              style={{
                minWidth: "auto",
                height: 24,
                padding: "0 8px",
                fontSize: 11,
              }}
            >
              {DAYS[currentDate.getDay()]} {currentDate.getDate()}{" "}
              {MONTHS[currentDate.getMonth()]}
            </Button>
          </Tooltip>
          <Button
            appearance="subtle"
            size="small"
            icon={<ChevronRight16Regular />}
            onClick={() => navigateDay(1)}
            style={{ minWidth: 24, height: 24, padding: 2 }}
          />
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          <Tooltip content="Refresh" relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={<ArrowClockwise16Regular />}
              onClick={() => refetch()}
              disabled={isFetching}
              style={{
                minWidth: 24,
                height: 24,
                padding: 2,
                animation: isFetching ? "spin 1s linear infinite" : undefined,
              }}
            />
          </Tooltip>
          <Tooltip content="Remove" relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={<Dismiss16Regular />}
              onClick={onRemove}
              style={{ minWidth: 24, height: 24, padding: 2 }}
            />
          </Tooltip>
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          padding: "8px 10px",
          borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <CalendarPerson16Regular
          style={{ color: tokens.colorBrandForeground1 }}
        />
        <span style={{ fontSize: 12, fontWeight: 600 }}>Who's on Leave</span>
        {todayLeaves.length > 0 && (
          <span
            style={{
              fontSize: 10,
              background: tokens.colorPaletteRedBackground2,
              color: tokens.colorPaletteRedForeground1,
              padding: "1px 6px",
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            {todayLeaves.length}
          </span>
        )}
      </div>

      {/* Leave List */}
      <div style={{ padding: "8px 10px", maxHeight: 200, overflow: "auto" }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 16 }}>
            <Spinner size="tiny" />
          </div>
        ) : todayLeaves.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todayLeaves.map((leave) => (
              <div
                key={leave.id}
                style={{
                  padding: "6px 8px",
                  background: tokens.colorNeutralBackground3,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderLeft: `3px solid ${leave.leaveTypeConfig.color || tokens.colorBrandBackground}`,
                }}
              >
                <Avatar
                  image={{ src: getEmployeeAvatar(leave) }}
                  name={getEmployeeName(leave)}
                  size={28}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {getEmployeeName(leave)}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: tokens.colorNeutralForeground3,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        color:
                          leave.leaveTypeConfig.color ||
                          tokens.colorBrandForeground1,
                        fontWeight: 500,
                      }}
                    >
                      {leave.leaveTypeConfig.name}
                    </span>
                    {leave.isHalfDay && (
                      <span style={{ color: tokens.colorNeutralForeground4 }}>
                        ({leave.halfDayType === "morning" ? "AM" : "PM"})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: 20,
              color: tokens.colorNeutralForeground3,
              fontSize: 12,
            }}
          >
            <div style={{ marginBottom: 4 }}>No one on leave</div>
            <div style={{ fontSize: 10 }}>Everyone is working!</div>
          </div>
        )}
      </div>
    </div>
  );
}
