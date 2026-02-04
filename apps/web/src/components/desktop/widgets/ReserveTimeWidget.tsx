import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  tokens,
  Button,
  Tooltip,
  Spinner,
  Avatar,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
} from "@fluentui/react-components";
import {
  Dismiss16Regular,
  ChevronLeft16Regular,
  ChevronRight16Regular,
  ArrowClockwise16Regular,
  Clock16Regular,
  Person16Regular,
} from "@fluentui/react-icons";
import type { ReserveTimeWidget as ReserveTimeWidgetType } from "@/stores/widgetStore";
import {
  reservationQueries,
  type Reservation,
} from "@/api/queries/reservations";
import { settingsQueries } from "@/api/queries/settings";
import { employeeQueries } from "@/api/queries/employees";

interface ReserveTimeWidgetProps {
  widget: ReserveTimeWidgetType;
  onUpdate: (updates: Partial<ReserveTimeWidgetType>) => void;
  onRemove: () => void;
  onDragEnd: (position: { x: number; y: number }) => void;
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

interface TimeSlot {
  name: string;
  hours: number;
  avatar?: string;
  isOwner: boolean;
  reservation?: Reservation;
}

export function ReserveTimeWidget({
  widget,
  onRemove,
  onDragEnd,
}: ReserveTimeWidgetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(widget.position);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const currentPosRef = useRef(widget.position);

  const dateStr = formatLocalDate(currentDate);

  // Get settings for work hours per day
  const { data: settings } = useQuery(settingsQueries.global);
  const workHoursPerDay =
    (settings as { workHoursPerDay?: number } | undefined)?.workHoursPerDay ??
    8;

  // Get current employee info (to get their manager)
  const { data: myProfile } = useQuery(employeeQueries.me);

  // Fetch my time reservations for the date
  const {
    data: reservations,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    ...reservationQueries.myTime(dateStr, dateStr),
    refetchInterval: 60 * 1000,
  });

  // Calculate time slots for the day
  const timeSlots = useMemo((): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    let reservedHours = 0;

    if (reservations && reservations.length > 0) {
      // Add reservation slots
      reservations.forEach((res) => {
        const requesterName =
          res.requester.fullName ||
          res.requester.user.name ||
          res.requester.user.email;
        const requesterAvatar =
          res.requester.avatar || res.requester.user.image || undefined;

        slots.push({
          name: requesterName,
          hours: res.hours,
          avatar: requesterAvatar,
          isOwner: false,
          reservation: res,
        });
        reservedHours += res.hours;
      });
    }

    // Add remaining hours for owner (manager who owns this employee's time)
    const ownerHours = Math.max(0, workHoursPerDay - reservedHours);
    if (ownerHours > 0 && myProfile) {
      // Get owner (manager) info from managementLeads
      const profile = myProfile as {
        fullName?: string | null;
        avatar?: string | null;
        user?: { name?: string | null; image?: string | null };
        managementLeads?: Array<{
          manager: {
            fullName?: string | null;
            avatar?: string | null;
            user: { name?: string | null; image?: string | null };
          };
        }>;
      };

      let ownerName = "Unassigned";
      let ownerAvatar: string | undefined;

      // Get the first manager as the "owner" of this employee's time
      if (profile.managementLeads && profile.managementLeads.length > 0) {
        const manager = profile.managementLeads[0].manager;
        ownerName = manager.fullName || manager.user?.name || "Manager";
        ownerAvatar = manager.avatar || manager.user?.image || undefined;
      }

      slots.unshift({
        name: ownerName,
        hours: ownerHours,
        avatar: ownerAvatar,
        isOwner: true,
      });
    }

    return slots;
  }, [reservations, workHoursPerDay, myProfile]);

  // Calculate total reserved vs available
  const totalReserved = useMemo(() => {
    if (!reservations) return 0;
    return reservations.reduce((sum, res) => sum + res.hours, 0);
  }, [reservations]);

  useEffect(() => {
    if (!isDragging) {
      setPosition(widget.position);
      currentPosRef.current = widget.position;
    }
  }, [widget.position, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    if ((e.target as HTMLElement).closest(".time-slot")) return;

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

  const isToday = currentDate.toDateString() === new Date().toDateString();

  // Generate colors for different requesters
  const getSlotColor = (index: number, isOwner: boolean) => {
    if (isOwner) return tokens.colorBrandBackground;
    const colors = [
      tokens.colorPalettePurpleBackground2,
      tokens.colorPaletteTealBackground2,
      tokens.colorPaletteMarigoldBackground2,
      tokens.colorPalettePinkBackground2,
      tokens.colorPaletteSeafoamBackground2,
    ];
    return colors[index % colors.length];
  };

  return (
    <>
      <div
        ref={elementRef}
        style={{
          position: "absolute",
          left: position.x,
          top: position.y,
          width: 260,
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
          <Clock16Regular style={{ color: tokens.colorBrandForeground1 }} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>My Time Today</span>
          <span
            style={{
              fontSize: 10,
              color: tokens.colorNeutralForeground3,
              marginLeft: "auto",
            }}
          >
            {totalReserved}h / {workHoursPerDay}h reserved
          </span>
        </div>

        {/* Progress Bar */}
        <div style={{ padding: "8px 10px" }}>
          <div
            style={{
              height: 20,
              background: tokens.colorNeutralBackground4,
              borderRadius: 4,
              overflow: "hidden",
              display: "flex",
            }}
          >
            {isLoading ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Spinner size="tiny" />
              </div>
            ) : (
              timeSlots.map((slot, idx) => {
                const widthPercent = (slot.hours / workHoursPerDay) * 100;
                return (
                  <Tooltip
                    key={idx}
                    content={`${slot.name}: ${slot.hours}h${slot.isOwner ? " (Available)" : ""}`}
                    relationship="label"
                  >
                    <div
                      className="time-slot"
                      onClick={() =>
                        slot.reservation &&
                        setSelectedReservation(slot.reservation)
                      }
                      style={{
                        width: `${widthPercent}%`,
                        height: "100%",
                        background: getSlotColor(idx, slot.isOwner),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: slot.reservation ? "pointer" : "default",
                        borderRight:
                          idx < timeSlots.length - 1
                            ? `1px solid ${tokens.colorNeutralBackground1}`
                            : undefined,
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (slot.reservation)
                          e.currentTarget.style.opacity = "0.8";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = "1";
                      }}
                    >
                      {widthPercent >= 15 && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "white",
                            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
                          }}
                        >
                          {slot.hours}h
                        </span>
                      )}
                    </div>
                  </Tooltip>
                );
              })
            )}
          </div>
        </div>

        {/* Time Slots List */}
        <div
          style={{ padding: "0 10px 10px", maxHeight: 140, overflow: "auto" }}
        >
          {isLoading ? null : timeSlots.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {timeSlots.map((slot, idx) => (
                <div
                  key={idx}
                  className="time-slot"
                  onClick={() =>
                    slot.reservation && setSelectedReservation(slot.reservation)
                  }
                  style={{
                    padding: "4px 8px",
                    background: tokens.colorNeutralBackground3,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderLeft: `3px solid ${getSlotColor(idx, slot.isOwner)}`,
                    cursor: slot.reservation ? "pointer" : "default",
                  }}
                >
                  <Avatar
                    image={{ src: slot.avatar }}
                    name={slot.name}
                    size={20}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {slot.name}
                      {slot.isOwner && (
                        <span
                          style={{
                            color: tokens.colorNeutralForeground3,
                            fontWeight: 400,
                          }}
                        >
                          {" "}
                          (Owner)
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: tokens.colorNeutralForeground2,
                    }}
                  >
                    {slot.hours}h
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: 12,
                color: tokens.colorNeutralForeground3,
                fontSize: 11,
              }}
            >
              <Person16Regular style={{ marginBottom: 4 }} />
              <div>All {workHoursPerDay}h available to owner</div>
            </div>
          )}
        </div>
      </div>

      {/* Reservation Details Dialog */}
      <Dialog
        open={!!selectedReservation}
        onOpenChange={(_, d) => !d.open && setSelectedReservation(null)}
      >
        <DialogSurface style={{ maxWidth: 360 }}>
          <DialogBody>
            <DialogTitle
              action={
                <Button
                  appearance="subtle"
                  icon={<Dismiss16Regular />}
                  onClick={() => setSelectedReservation(null)}
                />
              }
            >
              Reservation Details
            </DialogTitle>
            <DialogContent>
              {selectedReservation && (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: tokens.colorNeutralForeground3,
                        marginBottom: 4,
                      }}
                    >
                      Title
                    </div>
                    <div style={{ fontWeight: 500 }}>
                      {selectedReservation.title}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: tokens.colorNeutralForeground3,
                        marginBottom: 4,
                      }}
                    >
                      Requested By
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <Avatar
                        image={{
                          src:
                            selectedReservation.requester.avatar ||
                            selectedReservation.requester.user.image ||
                            undefined,
                        }}
                        name={
                          selectedReservation.requester.fullName ||
                          selectedReservation.requester.user.name ||
                          selectedReservation.requester.user.email
                        }
                        size={24}
                      />
                      <span>
                        {selectedReservation.requester.fullName ||
                          selectedReservation.requester.user.name ||
                          selectedReservation.requester.user.email}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: tokens.colorNeutralForeground3,
                        marginBottom: 4,
                      }}
                    >
                      Hours
                    </div>
                    <div style={{ fontWeight: 500 }}>
                      {selectedReservation.hours} hours
                    </div>
                  </div>

                  {selectedReservation.description && (
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: tokens.colorNeutralForeground3,
                          marginBottom: 4,
                        }}
                      >
                        Description
                      </div>
                      <div
                        style={{
                          padding: 8,
                          background: tokens.colorNeutralBackground3,
                          borderRadius: 4,
                          fontSize: 13,
                        }}
                      >
                        {selectedReservation.description}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
