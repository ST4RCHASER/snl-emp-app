import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { tokens, Button, Tooltip, Spinner } from "@fluentui/react-components";
import {
  Dismiss16Regular,
  ChevronLeft16Regular,
  ChevronRight16Regular,
  Grid16Regular,
  CalendarLtr16Regular,
  List16Regular,
  ArrowClockwise16Regular,
} from "@fluentui/react-icons";
import type {
  CalendarWidget as CalendarWidgetType,
  CalendarStyle,
} from "@/stores/widgetStore";
import {
  calendarQueries,
  type CalendarEvent,
  type Holiday,
} from "@/api/queries/calendar";

interface CalendarWidgetProps {
  widget: CalendarWidgetType;
  onUpdate: (updates: Partial<CalendarWidgetType>) => void;
  onRemove: () => void;
  onDragEnd: (position: { x: number; y: number }) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

export function CalendarWidget({
  widget,
  onUpdate,
  onRemove,
  onDragEnd,
}: CalendarWidgetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(widget.position);
  const [currentDate, setCurrentDate] = useState(new Date());
  const elementRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const currentPosRef = useRef(widget.position);

  const today = new Date();

  // Calculate time range for fetching events (current month + buffer)
  const { timeMin, timeMax } = useMemo(() => {
    const start = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    const end = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      7,
    );
    return {
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
    };
  }, [currentDate]);

  // Fetch calendar events with auto-refresh every minute
  const {
    data: eventsData,
    isLoading: eventsLoading,
    refetch,
    isFetching,
  } = useQuery({
    ...calendarQueries.events(timeMin, timeMax),
    refetchInterval: 60 * 1000, // Auto-refresh every 1 minute
  });

  // Fetch holidays
  const { data: holidaysData } = useQuery(
    calendarQueries.holidays(timeMin, timeMax),
  );

  const events = eventsData?.events || [];
  const holidays = holidaysData?.holidays || [];

  // Get events for a specific date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = date.toDateString();
    return events.filter((event) => {
      const eventStart = event.start.dateTime || event.start.date;
      if (!eventStart) return false;
      const eventDate = new Date(eventStart);
      return eventDate.toDateString() === dateStr;
    });
  };

  // Get holidays for a specific date
  const getHolidaysForDate = (date: Date): Holiday[] => {
    const dateStr = date.toDateString();
    return holidays.filter((holiday) => {
      const holidayDate = new Date(holiday.start);
      return holidayDate.toDateString() === dateStr;
    });
  };

  // Get today's events
  const todayEvents = useMemo(() => getEventsForDate(today), [events, today]);
  const todayHolidays = useMemo(
    () => getHolidaysForDate(today),
    [holidays, today],
  );

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

  const navigateMonth = (delta: number) => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1),
    );
  };

  const changeStyle = (style: CalendarStyle) => {
    onUpdate({ style });
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const getWeekDays = () => {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      return date;
    });
  };

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} style={{ width: 28, height: 28 }} />);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const isTodayDate = isToday(day);
      const dateForDay = new Date(year, month, day);
      const dayEvents = getEventsForDate(dateForDay);
      const dayHolidays = getHolidaysForDate(dateForDay);
      const hasEvents = dayEvents.length > 0;
      const isHoliday = dayHolidays.length > 0;

      days.push(
        <Tooltip
          key={day}
          content={
            isHoliday ? dayHolidays.map((h) => h.summary).join(", ") : ""
          }
          relationship="label"
          visible={isHoliday ? undefined : false}
        >
          <div
            style={{
              width: 28,
              height: 28,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              borderRadius: "50%",
              background: isTodayDate
                ? tokens.colorBrandBackground
                : isHoliday
                  ? tokens.colorPaletteRedBackground2
                  : "transparent",
              color: isTodayDate
                ? "white"
                : isHoliday
                  ? tokens.colorPaletteRedForeground1
                  : tokens.colorNeutralForeground1,
              fontWeight: isTodayDate || isHoliday ? 600 : 400,
              position: "relative",
            }}
          >
            {day}
            {hasEvents && (
              <div
                style={{
                  position: "absolute",
                  bottom: 2,
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: isTodayDate
                    ? "white"
                    : tokens.colorBrandBackground,
                }}
              />
            )}
          </div>
        </Tooltip>,
      );
    }

    return (
      <div style={{ padding: "8px 10px" }}>
        {/* Day headers */}
        <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
          {DAYS.map((day) => (
            <div
              key={day}
              style={{
                width: 28,
                textAlign: "center",
                fontSize: 10,
                color: tokens.colorNeutralForeground3,
                fontWeight: 500,
              }}
            >
              {day}
            </div>
          ))}
        </div>
        {/* Days grid */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>{days}</div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekDays = getWeekDays();

    return (
      <div style={{ padding: "8px 10px" }}>
        {weekDays.map((date, i) => {
          const isCurrentDay = date.toDateString() === today.toDateString();
          const dayEvents = getEventsForDate(date);
          const dayHolidays = getHolidaysForDate(date);
          const isHoliday = dayHolidays.length > 0;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "6px 8px",
                borderRadius: 6,
                background: isCurrentDay
                  ? tokens.colorBrandBackground
                  : isHoliday
                    ? tokens.colorPaletteRedBackground2
                    : "transparent",
                marginBottom: 2,
              }}
            >
              <span
                style={{
                  width: 40,
                  fontSize: 11,
                  color: isCurrentDay
                    ? "white"
                    : isHoliday
                      ? tokens.colorPaletteRedForeground1
                      : tokens.colorNeutralForeground3,
                }}
              >
                {DAYS[date.getDay()]}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: isCurrentDay || isHoliday ? 600 : 400,
                  color: isCurrentDay
                    ? "white"
                    : isHoliday
                      ? tokens.colorPaletteRedForeground1
                      : tokens.colorNeutralForeground1,
                  minWidth: 20,
                }}
              >
                {date.getDate()}
              </span>
              {isHoliday ? (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 10,
                    color: tokens.colorPaletteRedForeground1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    fontWeight: 500,
                  }}
                >
                  {dayHolidays[0].summary}
                </span>
              ) : dayEvents.length > 0 ? (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 10,
                    color: isCurrentDay
                      ? "rgba(255,255,255,0.8)"
                      : tokens.colorNeutralForeground3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {dayEvents.length} event{dayEvents.length > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  const formatEventTime = (event: CalendarEvent) => {
    const startTime = event.start.dateTime;
    if (!startTime) return "All day";
    const date = new Date(startTime);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderAgendaView = () => {
    return (
      <div style={{ padding: "12px 14px" }}>
        <div
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: tokens.colorNeutralForeground1,
            lineHeight: 1,
          }}
        >
          {today.getDate()}
        </div>
        <div
          style={{
            fontSize: 14,
            color: tokens.colorNeutralForeground2,
            marginTop: 4,
          }}
        >
          {DAYS[today.getDay()]}, {MONTHS[today.getMonth()]}
        </div>
        <div
          style={{
            fontSize: 12,
            color: tokens.colorNeutralForeground3,
            marginTop: 2,
          }}
        >
          {today.getFullYear()}
        </div>
        {/* Show holiday banner if today is a holiday */}
        {todayHolidays.length > 0 && (
          <div
            style={{
              marginTop: 8,
              padding: "6px 8px",
              background: tokens.colorPaletteRedBackground2,
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              color: tokens.colorPaletteRedForeground1,
            }}
          >
            {todayHolidays.map((h) => h.summary).join(", ")}
          </div>
        )}
        <div
          style={{
            marginTop: 12,
            borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
            paddingTop: 8,
            maxHeight: 150,
            overflow: "auto",
          }}
        >
          {eventsLoading ? (
            <div style={{ textAlign: "center", padding: 8 }}>
              <Spinner size="tiny" />
            </div>
          ) : todayEvents.length > 0 ? (
            todayEvents.map((event) => (
              <div
                key={event.id}
                style={{
                  padding: "4px 0",
                  borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: tokens.colorBrandForeground1,
                    fontWeight: 500,
                  }}
                >
                  {formatEventTime(event)}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: tokens.colorNeutralForeground1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {event.summary || "No title"}
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                fontSize: 12,
                color: tokens.colorNeutralForeground3,
                textAlign: "center",
                padding: 8,
              }}
            >
              No events today
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={elementRef}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: widget.style === "agenda" ? 200 : 230,
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
          {widget.style === "month" && (
            <>
              <Button
                appearance="subtle"
                size="small"
                icon={<ChevronLeft16Regular />}
                onClick={() => navigateMonth(-1)}
                style={{ minWidth: 24, height: 24, padding: 2 }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  minWidth: 90,
                  textAlign: "center",
                }}
              >
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <Button
                appearance="subtle"
                size="small"
                icon={<ChevronRight16Regular />}
                onClick={() => navigateMonth(1)}
                style={{ minWidth: 24, height: 24, padding: 2 }}
              />
            </>
          )}
          {widget.style !== "month" && (
            <span style={{ fontSize: 12, fontWeight: 500 }}>
              {widget.style === "week" ? "This Week" : "Today"}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          <Tooltip content="Month" relationship="label">
            <Button
              appearance={widget.style === "month" ? "primary" : "subtle"}
              size="small"
              icon={<Grid16Regular />}
              onClick={() => changeStyle("month")}
              style={{ minWidth: 24, height: 24, padding: 2 }}
            />
          </Tooltip>
          <Tooltip content="Week" relationship="label">
            <Button
              appearance={widget.style === "week" ? "primary" : "subtle"}
              size="small"
              icon={<CalendarLtr16Regular />}
              onClick={() => changeStyle("week")}
              style={{ minWidth: 24, height: 24, padding: 2 }}
            />
          </Tooltip>
          <Tooltip content="Agenda" relationship="label">
            <Button
              appearance={widget.style === "agenda" ? "primary" : "subtle"}
              size="small"
              icon={<List16Regular />}
              onClick={() => changeStyle("agenda")}
              style={{ minWidth: 24, height: 24, padding: 2 }}
            />
          </Tooltip>
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

      {/* Content */}
      {widget.style === "month" && renderMonthView()}
      {widget.style === "week" && renderWeekView()}
      {widget.style === "agenda" && renderAgendaView()}
    </div>
  );
}
