import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Avatar,
  Badge,
  Spinner,
  tokens,
  Tab,
  TabList,
  Switch,
  Input,
} from "@fluentui/react-components";
import {
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Calendar24Regular,
  CalendarWeekNumbers24Regular,
  CalendarMonth24Regular,
  Clock16Regular,
  Dismiss24Regular,
  Location20Regular,
  Video20Regular,
  People20Regular,
  CheckmarkCircle16Filled,
  DismissCircle16Filled,
  QuestionCircle16Filled,
  Circle16Regular,
  Open16Regular,
  Search24Regular,
  Person24Regular,
} from "@fluentui/react-icons";
import {
  calendarQueries,
  type CalendarEvent,
  type CalendarEventAttendee,
  type Holiday,
} from "@/api/queries/calendar";
import { workLogQueries, type WorkLog } from "@/api/queries/worklogs";
import { employeeQueries } from "@/api/queries/employees";
import {
  reservationQueries,
  type Reservation,
} from "@/api/queries/reservations";
import {
  useWindowProps,
  useUpdateWindowProps,
  useUpdateWindowTitle,
} from "@/components/desktop/WindowContext";
import {
  preferencesQueries,
  useUpdatePreferences,
  type TeamCalendarSettings,
} from "@/api/queries/preferences";

type ViewMode = "day" | "week" | "month";

export interface TeamCalendarProps {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeAvatar?: string | null;
}

const DAYS_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
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

// Color palette for events
const EVENT_COLORS: Record<string, string> = {
  "1": "#7986cb",
  "2": "#33b679",
  "3": "#8e24aa",
  "4": "#e67c73",
  "5": "#f6bf26",
  "6": "#f4511e",
  "7": "#039be5",
  "8": "#616161",
  "9": "#3f51b5",
  "10": "#0b8043",
  "11": "#d50000",
};

function getEventColor(colorId?: string): string {
  if (colorId && EVENT_COLORS[colorId]) {
    return EVENT_COLORS[colorId];
  }
  return "#15803d"; // default green
}

// Helper to format date in local timezone as YYYY-MM-DD
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Helper to extract YYYY-MM-DD from any date value (string, Date, or ISO string)
function getDateKey(dateValue: unknown): string {
  if (!dateValue) return "";
  if (typeof dateValue === "string") {
    return dateValue.split("T")[0];
  }
  if (dateValue instanceof Date) {
    return formatLocalDate(dateValue);
  }
  try {
    return formatLocalDate(new Date(dateValue as string | number));
  } catch {
    return "";
  }
}

function formatTime(dateTime?: string): string {
  if (!dateTime) return "";
  const date = new Date(dateTime);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isWorkingLocation(event: CalendarEvent): boolean {
  if (!event.start.date) return false;
  const title = (event.summary || "").toLowerCase();
  return (
    title === "office" ||
    title === "home" ||
    title === "wfh" ||
    title === "work from home" ||
    title.includes("working location")
  );
}

// Response status icon component
function ResponseStatusIcon({
  status,
}: {
  status?: CalendarEventAttendee["responseStatus"];
}) {
  switch (status) {
    case "accepted":
      return <CheckmarkCircle16Filled style={{ color: "#5b21b6" }} />;
    case "declined":
      return <DismissCircle16Filled style={{ color: "#ef4444" }} />;
    case "tentative":
      return <QuestionCircle16Filled style={{ color: "#f59e0b" }} />;
    default:
      return (
        <Circle16Regular style={{ color: tokens.colorNeutralForeground4 }} />
      );
  }
}

// Event Detail Popup Component (floating popover)
function EventDetailPopup({
  event,
  position,
  containerRect,
  onClose,
}: {
  event: CalendarEvent;
  position: { x: number; y: number };
  containerRect: DOMRect | null;
  onClose: () => void;
}) {
  const isAllDay = !!event.start.date;
  const startDate = new Date(event.start.dateTime || event.start.date || "");
  const endDate = new Date(event.end.dateTime || event.end.date || "");

  // Calculate popup position relative to container
  const popupWidth = 380;
  const popupMaxHeight = 500;
  const padding = 16;

  // Convert viewport coordinates to container-relative coordinates
  const containerLeft = containerRect?.left || 0;
  const containerTop = containerRect?.top || 0;
  const containerWidth = containerRect?.width || window.innerWidth;
  const containerHeight = containerRect?.height || window.innerHeight;

  let left = position.x - containerLeft;
  let top = position.y - containerTop;

  // Adjust if would go off right edge of container
  if (left + popupWidth + padding > containerWidth) {
    left = left - popupWidth - 10;
  }

  // Adjust if would go off bottom edge of container
  if (top + popupMaxHeight + padding > containerHeight) {
    top = Math.max(padding, containerHeight - popupMaxHeight - padding);
  }

  // Ensure not off left or top edge
  left = Math.max(padding, left);
  top = Math.max(padding, top);

  // Format date/time
  const formatDateTime = () => {
    if (isAllDay) {
      const start = startDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      // Check if multi-day
      const dayDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (dayDiff > 1) {
        const end = new Date(endDate);
        end.setDate(end.getDate() - 1); // All-day events end date is exclusive
        return `${start} - ${end.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
      }
      return start;
    }

    const dateStr = startDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    const startTime = startDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    const endTime = endDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${dateStr} · ${startTime} - ${endTime}`;
  };

  // Get video call link
  const videoLink =
    event.hangoutLink ||
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")
      ?.uri;

  // Filter attendees (exclude resources)
  const attendees = (event.attendees || []).filter((a) => !a.resource);
  const organizer = attendees.find((a) => a.organizer) || event.organizer;
  const otherAttendees = attendees.filter((a) => !a.organizer);

  // Count response statuses
  const acceptedCount = attendees.filter(
    (a) => a.responseStatus === "accepted",
  ).length;
  const declinedCount = attendees.filter(
    (a) => a.responseStatus === "declined",
  ).length;
  const awaitingCount = attendees.filter(
    (a) => a.responseStatus === "needsAction" || !a.responseStatus,
  ).length;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
        }}
        onClick={onClose}
      />
      {/* Floating Popover */}
      <div
        style={{
          position: "absolute",
          top,
          left,
          width: popupWidth,
          maxHeight: popupMaxHeight,
          background: tokens.colorNeutralBackground1,
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          border: `1px solid ${tokens.colorNeutralStroke1}`,
          zIndex: 1001,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "8px 8px 0",
            gap: 4,
          }}
        >
          {event.htmlLink && (
            <Button
              appearance="subtle"
              size="small"
              icon={<Open16Regular />}
              as="a"
              href={event.htmlLink}
              target="_blank"
              title="Open in Google Calendar"
            />
          )}
          <Button
            appearance="subtle"
            size="small"
            icon={<Dismiss24Regular />}
            onClick={onClose}
          />
        </div>

        {/* Content */}
        <div style={{ padding: "0 20px 20px", overflow: "auto" }}>
          {/* Title */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                background: getEventColor(event.colorId),
                flexShrink: 0,
                marginTop: 6,
              }}
            />
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 500,
                lineHeight: 1.3,
              }}
            >
              {event.summary || "(No title)"}
            </h2>
          </div>

          {/* Date/Time */}
          <div
            style={{
              fontSize: 14,
              color: tokens.colorNeutralForeground2,
              marginBottom: 20,
              paddingLeft: 28,
            }}
          >
            {formatDateTime()}
          </div>

          {/* Video call link */}
          {videoLink && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <Video20Regular style={{ color: tokens.colorBrandForeground1 }} />
              <a
                href={videoLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: tokens.colorBrandForeground1,
                  textDecoration: "none",
                  fontSize: 14,
                }}
              >
                {event.conferenceData?.conferenceSolution?.name ||
                  "Join video call"}
              </a>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <Location20Regular
                style={{
                  color: tokens.colorNeutralForeground3,
                  flexShrink: 0,
                  marginTop: 2,
                }}
              />
              <span
                style={{ fontSize: 14, color: tokens.colorNeutralForeground2 }}
              >
                {event.location}
              </span>
            </div>
          )}

          {/* Attendees */}
          {attendees.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <People20Regular
                  style={{ color: tokens.colorNeutralForeground3 }}
                />
                <div>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    {attendees.length} guests
                  </span>
                  <div
                    style={{
                      fontSize: 12,
                      color: tokens.colorNeutralForeground3,
                    }}
                  >
                    {acceptedCount > 0 && `${acceptedCount} yes`}
                    {declinedCount > 0 && `, ${declinedCount} no`}
                    {awaitingCount > 0 && `, ${awaitingCount} awaiting`}
                  </div>
                </div>
              </div>

              {/* Attendee list - scrollable */}
              <div
                style={{
                  paddingLeft: 32,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxHeight: 200,
                  overflow: "auto",
                }}
              >
                {/* Organizer first */}
                {organizer && (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <Avatar
                        size={28}
                        name={
                          organizer.displayName ||
                          organizer.email ||
                          "Organizer"
                        }
                      />
                      <div
                        style={{
                          position: "absolute",
                          bottom: -2,
                          right: -2,
                          background: tokens.colorNeutralBackground1,
                          borderRadius: "50%",
                        }}
                      >
                        <ResponseStatusIcon
                          status={
                            (organizer as CalendarEventAttendee).responseStatus
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>
                        {organizer.displayName || organizer.email}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: tokens.colorNeutralForeground3,
                        }}
                      >
                        Organizer
                      </div>
                    </div>
                  </div>
                )}

                {/* All other attendees */}
                {otherAttendees.map((attendee, idx) => (
                  <div
                    key={idx}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <Avatar
                        size={28}
                        name={attendee.displayName || attendee.email || "Guest"}
                      />
                      <div
                        style={{
                          position: "absolute",
                          bottom: -2,
                          right: -2,
                          background: tokens.colorNeutralBackground1,
                          borderRadius: "50%",
                        }}
                      >
                        <ResponseStatusIcon status={attendee.responseStatus} />
                      </div>
                    </div>
                    <div style={{ fontSize: 13 }}>
                      {attendee.displayName || attendee.email}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 14,
                  color: tokens.colorNeutralForeground2,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: 200,
                  overflow: "auto",
                  background: tokens.colorNeutralBackground2,
                  padding: 12,
                  borderRadius: 8,
                }}
                dangerouslySetInnerHTML={{
                  __html: event.description
                    .replace(/\n/g, "<br>")
                    .replace(
                      /(https?:\/\/[^\s<]+)/g,
                      '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: ' +
                        tokens.colorBrandForeground1 +
                        '">$1</a>',
                    ),
                }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Work Log Detail Popup Component (floating popover)
function WorkLogDetailPopup({
  workLogs,
  date,
  position,
  containerRect,
  onClose,
}: {
  workLogs: WorkLog[];
  date: Date;
  position: { x: number; y: number };
  containerRect: DOMRect | null;
  onClose: () => void;
}) {
  const totalHours = workLogs.reduce((sum, w) => sum + w.hours, 0);

  // Calculate popup position relative to container
  const popupWidth = 350;
  const popupMaxHeight = 400;
  const padding = 16;

  // Convert viewport coordinates to container-relative coordinates
  const containerLeft = containerRect?.left || 0;
  const containerTop = containerRect?.top || 0;
  const containerWidth = containerRect?.width || window.innerWidth;
  const containerHeight = containerRect?.height || window.innerHeight;

  let left = position.x - containerLeft;
  let top = position.y - containerTop;

  // Adjust if would go off right edge of container
  if (left + popupWidth + padding > containerWidth) {
    left = left - popupWidth - 10;
  }

  // Adjust if would go off bottom edge of container
  if (top + popupMaxHeight + padding > containerHeight) {
    top = Math.max(padding, containerHeight - popupMaxHeight - padding);
  }

  // Ensure not off left or top edge
  left = Math.max(padding, left);
  top = Math.max(padding, top);

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
        }}
        onClick={onClose}
      />
      {/* Floating Popover */}
      <div
        style={{
          position: "absolute",
          top,
          left,
          width: popupWidth,
          maxHeight: popupMaxHeight,
          background: tokens.colorNeutralBackground1,
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          border: `1px solid ${tokens.colorNeutralStroke1}`,
          zIndex: 1001,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Clock16Regular style={{ color: "#5b21b6" }} />
            <span style={{ fontWeight: 600 }}>Work Logged</span>
          </div>
          <Button
            appearance="subtle"
            size="small"
            icon={<Dismiss24Regular />}
            onClick={onClose}
          />
        </div>

        {/* Content */}
        <div style={{ padding: 16, overflow: "auto" }}>
          {/* Date */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{ fontSize: 14, color: tokens.colorNeutralForeground2 }}
            >
              {date.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#5b21b6" }}>
              {totalHours} hours total
            </div>
          </div>

          {/* Work logs list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {workLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: 12,
                  background: tokens.colorNeutralBackground2,
                  borderRadius: 8,
                  borderLeft: "4px solid #5b21b6",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    {log.title}
                  </div>
                  <Badge
                    appearance="filled"
                    style={{ background: "#5b21b6", color: "white" }}
                  >
                    {log.hours}h
                  </Badge>
                </div>
                {log.description && (
                  <div
                    style={{
                      fontSize: 12,
                      color: tokens.colorNeutralForeground3,
                      marginTop: 4,
                    }}
                  >
                    {log.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// Reservation Detail Popup Component (floating popover)
function ReservationDetailPopup({
  reservations,
  date,
  position,
  containerRect,
  onClose,
}: {
  reservations: Reservation[];
  date: Date;
  position: { x: number; y: number };
  containerRect: DOMRect | null;
  onClose: () => void;
}) {
  const totalHours = reservations.reduce((sum, r) => sum + r.hours, 0);

  // Calculate popup position relative to container
  const popupWidth = 350;
  const popupMaxHeight = 400;
  const padding = 16;

  const containerLeft = containerRect?.left || 0;
  const containerTop = containerRect?.top || 0;
  const containerWidth = containerRect?.width || window.innerWidth;
  const containerHeight = containerRect?.height || window.innerHeight;

  let left = position.x - containerLeft;
  let top = position.y - containerTop;

  if (left + popupWidth + padding > containerWidth) {
    left = left - popupWidth - 10;
  }
  if (top + popupMaxHeight + padding > containerHeight) {
    top = Math.max(padding, containerHeight - popupMaxHeight - padding);
  }
  left = Math.max(padding, left);
  top = Math.max(padding, top);

  const getRequesterName = (r: Reservation) =>
    r.requester.fullName || r.requester.user.name || r.requester.user.email;
  const getRequesterAvatar = (r: Reservation) =>
    r.requester.avatar || r.requester.user.image;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1000,
        }}
        onClick={onClose}
      />
      {/* Floating Popover */}
      <div
        style={{
          position: "absolute",
          top,
          left,
          width: popupWidth,
          maxHeight: popupMaxHeight,
          background: tokens.colorNeutralBackground1,
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          border: `1px solid ${tokens.colorNeutralStroke1}`,
          zIndex: 1001,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 16px",
            borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <People20Regular style={{ color: "#b45309" }} />
            <span style={{ fontWeight: 600 }}>Reservations</span>
          </div>
          <Button
            appearance="subtle"
            size="small"
            icon={<Dismiss24Regular />}
            onClick={onClose}
          />
        </div>

        {/* Content */}
        <div style={{ padding: 16, overflow: "auto" }}>
          {/* Date */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{ fontSize: 14, color: tokens.colorNeutralForeground2 }}
            >
              {date.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, color: "#b45309" }}>
              {totalHours} hours reserved
            </div>
          </div>

          {/* Reservations list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reservations.map((res) => (
              <div
                key={res.id}
                style={{
                  padding: 12,
                  background: tokens.colorNeutralBackground2,
                  borderRadius: 8,
                  borderLeft: "4px solid #b45309",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    {res.title}
                  </div>
                  <Badge
                    appearance="filled"
                    style={{ background: "#b45309", color: "white" }}
                  >
                    {res.hours}h
                  </Badge>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    color: tokens.colorNeutralForeground3,
                  }}
                >
                  <Avatar
                    size={20}
                    name={getRequesterName(res)}
                    image={{ src: getRequesterAvatar(res) || undefined }}
                  />
                  <span>Reserved by {getRequesterName(res)}</span>
                </div>
                {res.description && (
                  <div
                    style={{
                      fontSize: 12,
                      color: tokens.colorNeutralForeground3,
                      marginTop: 8,
                    }}
                  >
                    {res.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function TeamCalendar() {
  const windowProps = useWindowProps<TeamCalendarProps>();
  const updateWindowProps = useUpdateWindowProps();
  const updateWindowTitle = useUpdateWindowTitle();
  const containerRef = useRef<HTMLDivElement>(null);

  const [employeeSearch, setEmployeeSearch] = useState("");

  // Get employee from window props (persisted across reloads)
  const employeeId = windowProps?.employeeId;
  const employeeName = windowProps?.employeeName || "Employee";
  const employeeEmail = windowProps?.employeeEmail || "";
  const employeeAvatar = windowProps?.employeeAvatar;

  // Function to select an employee and persist to window props
  const selectEmployee = (employee: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  }) => {
    updateWindowProps({
      employeeId: employee.id,
      employeeName: employee.name,
      employeeEmail: employee.email,
      employeeAvatar: employee.avatar,
    });
    // Update window title to show selected employee
    updateWindowTitle(`${employee.name}'s Calendar`);
  };

  // Function to clear selection
  const clearSelection = () => {
    updateWindowProps({
      employeeId: undefined,
      employeeName: undefined,
      employeeEmail: undefined,
      employeeAvatar: undefined,
    });
    setEmployeeSearch("");
    // Reset window title
    updateWindowTitle("Team Calendar");
  };
  // Load preferences
  const { data: preferences } = useQuery(preferencesQueries.user);
  const updatePreferences = useUpdatePreferences();
  const calendarSettings = (
    preferences as { teamCalendarSettings?: TeamCalendarSettings } | undefined
  )?.teamCalendarSettings;

  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showEvents, setShowEvents] = useState(true);
  const [showWorkLogs, setShowWorkLogs] = useState(true);
  const [showReservations, setShowReservations] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load settings from preferences once
  useEffect(() => {
    if (calendarSettings && !settingsLoaded) {
      if (calendarSettings.showEvents !== undefined)
        setShowEvents(calendarSettings.showEvents);
      if (calendarSettings.showWorkLogs !== undefined)
        setShowWorkLogs(calendarSettings.showWorkLogs);
      if (calendarSettings.showReservations !== undefined)
        setShowReservations(calendarSettings.showReservations);
      if (calendarSettings.viewMode) setViewMode(calendarSettings.viewMode);
      setSettingsLoaded(true);
    }
  }, [calendarSettings, settingsLoaded]);

  // Save settings to database
  const saveSettings = useCallback(
    (settings: TeamCalendarSettings) => {
      updatePreferences.mutate({
        teamCalendarSettings: {
          ...calendarSettings,
          ...settings,
        },
      });
    },
    [updatePreferences, calendarSettings],
  );

  // Handlers that save to database
  const handleShowEventsChange = useCallback(
    (checked: boolean) => {
      setShowEvents(checked);
      saveSettings({ showEvents: checked });
    },
    [saveSettings],
  );

  const handleShowWorkLogsChange = useCallback(
    (checked: boolean) => {
      setShowWorkLogs(checked);
      saveSettings({ showWorkLogs: checked });
    },
    [saveSettings],
  );

  const handleShowReservationsChange = useCallback(
    (checked: boolean) => {
      setShowReservations(checked);
      saveSettings({ showReservations: checked });
    },
    [saveSettings],
  );

  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      saveSettings({ viewMode: mode });
    },
    [saveSettings],
  );

  const [selectedEvent, setSelectedEvent] = useState<{
    event: CalendarEvent;
    position: { x: number; y: number };
  } | null>(null);
  const [selectedWorkLogs, setSelectedWorkLogs] = useState<{
    logs: WorkLog[];
    date: Date;
    position: { x: number; y: number };
  } | null>(null);
  const [selectedReservations, setSelectedReservations] = useState<{
    reservations: Reservation[];
    date: Date;
    position: { x: number; y: number };
  } | null>(null);

  // Get container rect for popup positioning
  const getContainerRect = () =>
    containerRef.current?.getBoundingClientRect() || null;

  // Calculate date range based on view mode
  const { startDate, endDate } = useMemo(() => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);

    if (viewMode === "day") {
      // Just the selected day
    } else if (viewMode === "week") {
      const day = start.getDay();
      const diff = start.getDate() - day;
      start.setDate(diff);
      end.setDate(diff + 6);
    } else {
      // Month view - include buffer days
      start.setDate(1);
      // Get first day of month, then go back to Sunday
      const firstDayOfMonth = new Date(start);
      const dayOfWeek = firstDayOfMonth.getDay();
      start.setDate(1 - dayOfWeek);

      // End of month + remaining days to Saturday
      end.setMonth(end.getMonth() + 1);
      end.setDate(0); // Last day of month
      const lastDayOfWeek = end.getDay();
      end.setDate(end.getDate() + (6 - lastDayOfWeek));
    }

    return {
      startDate: new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate(),
      ).toISOString(),
      endDate: new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate(),
        23,
        59,
        59,
      ).toISOString(),
    };
  }, [selectedDate, viewMode]);

  // Fetch calendar events
  const {
    data: calendarData,
    isLoading: loadingEvents,
    error: eventsError,
  } = useQuery({
    ...calendarQueries.teamMemberEvents(employeeId || "", startDate, endDate),
    enabled: showEvents && !!employeeId,
  });

  // Fetch work logs
  const { data: workLogs = [], isLoading: loadingWorkLogs } = useQuery({
    ...workLogQueries.teamMemberLogs(
      employeeId || "",
      startDate.split("T")[0],
      endDate.split("T")[0],
    ),
    enabled: showWorkLogs && !!employeeId,
  });

  // Fetch holidays
  const { data: holidaysData } = useQuery(
    calendarQueries.holidays(startDate, endDate),
  );
  const holidays = holidaysData?.holidays || [];

  // Fetch reservations for this employee
  const { data: reservations = [] } = useQuery({
    ...reservationQueries.resourceReservations(
      employeeId || "",
      startDate.split("T")[0],
      endDate.split("T")[0],
    ),
    enabled: showReservations && !!employeeId,
  });

  const events = calendarData?.events || [];

  // Filter out working location events
  const calendarEvents = events.filter((e) => !isWorkingLocation(e));
  const workingLocations = events.filter((e) => isWorkingLocation(e));

  // Get working location for a date
  const getWorkingLocation = (date: Date): CalendarEvent | undefined => {
    const dateStr = date.toDateString();
    return workingLocations.find((e) => {
      const eventDate = new Date(e.start.date || e.start.dateTime || "");
      return eventDate.toDateString() === dateStr;
    });
  };

  // Get holidays for a date
  const getHolidaysForDate = (date: Date): Holiday[] => {
    const dateStr = date.toDateString();
    return holidays.filter((h) => {
      const holidayDate = new Date(h.start);
      return holidayDate.toDateString() === dateStr;
    });
  };

  // Get events for a date
  const getEventsForDate = (date: Date): CalendarEvent[] => {
    const dateStr = date.toDateString();
    return calendarEvents.filter((e) => {
      const eventStart = e.start.dateTime || e.start.date;
      if (!eventStart) return false;
      const eventDate = new Date(eventStart);
      return eventDate.toDateString() === dateStr;
    });
  };

  // Get work logs for a date
  const getWorkLogsForDate = (date: Date): WorkLog[] => {
    const dateStr = formatLocalDate(date);
    return workLogs.filter((w) => {
      const logDate = getDateKey(w.date);
      return logDate === dateStr && !w.isDeleted;
    });
  };

  // Get reservations for a date (only approved ones)
  const getReservationsForDate = (date: Date): Reservation[] => {
    const dateStr = formatLocalDate(date);
    return reservations.filter((r) => {
      const resDate = getDateKey(r.date);
      return resDate === dateStr && r.status === "APPROVED";
    });
  };

  const navigate = (direction: number) => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      if (viewMode === "day") {
        newDate.setDate(newDate.getDate() + direction);
      } else if (viewMode === "week") {
        newDate.setDate(newDate.getDate() + direction * 7);
      } else {
        newDate.setMonth(newDate.getMonth() + direction);
      }
      return newDate;
    });
  };

  const goToToday = () => setSelectedDate(new Date());

  const getTitle = () => {
    if (viewMode === "month") {
      return `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
    } else if (viewMode === "week") {
      const start = new Date(selectedDate);
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    } else {
      return selectedDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    }
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  // Get week number
  const getWeekNumber = (date: Date): number => {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  };

  // Render month view
  const renderMonthView = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const startDay = firstDayOfMonth.getDay();
    const daysInMonth = lastDayOfMonth.getDate();

    // Build weeks array
    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];

    // Add days from previous month
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      currentWeek.push(d);
    }

    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(new Date(year, month, day));
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Add days from next month
    if (currentWeek.length > 0) {
      let nextDay = 1;
      while (currentWeek.length < 7) {
        currentWeek.push(new Date(year, month + 1, nextDay++));
      }
      weeks.push(currentWeek);
    }

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* Day headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "40px repeat(7, 1fr)",
            borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
            flexShrink: 0,
          }}
        >
          <div style={{ padding: 8 }}></div>
          {DAYS_SHORT.map((day) => (
            <div
              key={day}
              style={{
                padding: "8px 4px",
                textAlign: "center",
                fontWeight: 600,
                fontSize: 12,
                color: tokens.colorNeutralForeground3,
                borderLeft: `1px solid ${tokens.colorNeutralStroke1}`,
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {weeks.map((week, weekIdx) => (
            <div
              key={weekIdx}
              style={{
                display: "grid",
                gridTemplateColumns: "40px repeat(7, 1fr)",
                minHeight: 120,
                borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
              }}
            >
              {/* Week number */}
              <div
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  color: tokens.colorNeutralForeground4,
                  borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "center",
                }}
              >
                {getWeekNumber(week[0])}
              </div>

              {/* Days */}
              {week.map((date, dayIdx) => {
                const isCurrentMonth = date.getMonth() === month;
                const dayEvents = showEvents ? getEventsForDate(date) : [];
                const dayWorkLogs = showWorkLogs
                  ? getWorkLogsForDate(date)
                  : [];
                const dayReservations = showReservations
                  ? getReservationsForDate(date)
                  : [];
                const dayHolidays = getHolidaysForDate(date);
                const workingLoc = showEvents
                  ? getWorkingLocation(date)
                  : undefined;
                const isTodayDate = isToday(date);
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                return (
                  <div
                    key={dayIdx}
                    style={{
                      padding: 4,
                      borderLeft: `1px solid ${tokens.colorNeutralStroke1}`,
                      background: !isCurrentMonth
                        ? tokens.colorNeutralBackground2
                        : dayHolidays.length > 0
                          ? "rgba(220, 38, 38, 0.08)"
                          : isWeekend
                            ? tokens.colorNeutralBackground1Hover
                            : undefined,
                      cursor: "pointer",
                      overflow: "hidden",
                    }}
                    onClick={() => {
                      setSelectedDate(date);
                      handleViewModeChange("day");
                    }}
                  >
                    {/* Date header */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          fontSize: 13,
                          fontWeight: isTodayDate ? 600 : 400,
                          background: isTodayDate
                            ? tokens.colorBrandBackground
                            : undefined,
                          color: isTodayDate
                            ? "white"
                            : !isCurrentMonth
                              ? tokens.colorNeutralForeground4
                              : dayHolidays.length > 0
                                ? "#dc2626"
                                : undefined,
                        }}
                      >
                        {date.getDate()}
                      </span>
                      {workingLoc && (
                        <Badge
                          size="small"
                          style={{
                            fontSize: 9,
                            padding: "0 4px",
                            background: workingLoc.summary
                              ?.toLowerCase()
                              .includes("office")
                              ? "#0891b2"
                              : "#0d9488",
                            color: "white",
                          }}
                        >
                          {workingLoc.summary}
                        </Badge>
                      )}
                    </div>

                    {/* Holiday */}
                    {dayHolidays.length > 0 && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#dc2626",
                          fontWeight: 500,
                          marginBottom: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {dayHolidays[0].summary}
                      </div>
                    )}

                    {/* Events */}
                    {dayEvents.slice(0, 4).map((event) => (
                      <div
                        key={event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent({
                            event,
                            position: { x: e.clientX, y: e.clientY },
                          });
                        }}
                        style={{
                          fontSize: 11,
                          padding: "2px 4px",
                          marginBottom: 2,
                          borderRadius: 3,
                          background: getEventColor(event.colorId),
                          color: "white",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                        }}
                      >
                        {event.start.dateTime && (
                          <span style={{ opacity: 0.9 }}>
                            {formatTime(event.start.dateTime)}{" "}
                          </span>
                        )}
                        {event.summary || "(No title)"}
                      </div>
                    ))}

                    {/* Work logs indicator */}
                    {dayWorkLogs.length > 0 && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWorkLogs({
                            logs: dayWorkLogs,
                            date,
                            position: { x: e.clientX, y: e.clientY },
                          });
                        }}
                        style={{
                          fontSize: 10,
                          padding: "2px 4px",
                          marginBottom: 2,
                          borderRadius: 3,
                          background: "#5b21b6",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          cursor: "pointer",
                          overflow: "hidden",
                        }}
                      >
                        <Clock16Regular
                          style={{ fontSize: 10, flexShrink: 0 }}
                        />
                        <span style={{ fontWeight: 500 }}>
                          {dayWorkLogs.reduce((sum, w) => sum + w.hours, 0)}h
                        </span>
                        {dayWorkLogs.length === 1 && (
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {dayWorkLogs[0].title}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Reservations indicator */}
                    {dayReservations.length > 0 && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReservations({
                            reservations: dayReservations,
                            date,
                            position: { x: e.clientX, y: e.clientY },
                          });
                        }}
                        style={{
                          fontSize: 10,
                          padding: "2px 4px",
                          marginBottom: 2,
                          borderRadius: 3,
                          background: "#b45309",
                          color: "white",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          cursor: "pointer",
                          overflow: "hidden",
                        }}
                      >
                        {dayReservations.slice(0, 2).map((res) => (
                          <div
                            key={res.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            <Avatar
                              size={16}
                              name={
                                res.requester.fullName ||
                                res.requester.user.name ||
                                res.requester.user.email
                              }
                              image={{
                                src:
                                  res.requester.avatar ||
                                  res.requester.user.image ||
                                  undefined,
                              }}
                            />
                            <span
                              style={{
                                maxWidth: 60,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {res.title}
                            </span>
                          </div>
                        ))}
                        <span style={{ fontWeight: 500 }}>
                          {dayReservations.reduce((sum, r) => sum + r.hours, 0)}
                          h
                        </span>
                        {dayReservations.length > 2 && (
                          <span>+{dayReservations.length - 2}</span>
                        )}
                      </div>
                    )}

                    {dayEvents.length > 4 && (
                      <div
                        style={{
                          fontSize: 10,
                          color: tokens.colorNeutralForeground3,
                          paddingLeft: 4,
                        }}
                      >
                        +{dayEvents.length - 4} more
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render week view
  const renderWeekView = () => {
    const start = new Date(selectedDate);
    const day = start.getDay();
    start.setDate(start.getDate() - day);

    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      weekDays.push(d);
    }

    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px repeat(7, 1fr)",
            borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: 8,
              fontSize: 10,
              color: tokens.colorNeutralForeground4,
            }}
          >
            GMT+07
          </div>
          {weekDays.map((date, idx) => {
            const isTodayDate = isToday(date);
            const workingLoc = showEvents
              ? getWorkingLocation(date)
              : undefined;
            const dayHolidays = getHolidaysForDate(date);
            const dayWorkLogs = showWorkLogs ? getWorkLogsForDate(date) : [];
            const dayReservations = showReservations
              ? getReservationsForDate(date)
              : [];
            const totalWorkHours = dayWorkLogs.reduce(
              (sum, w) => sum + w.hours,
              0,
            );
            const totalReservationHours = dayReservations.reduce(
              (sum, r) => sum + r.hours,
              0,
            );

            return (
              <div
                key={idx}
                style={{
                  padding: 8,
                  textAlign: "center",
                  borderLeft: `1px solid ${tokens.colorNeutralStroke1}`,
                  background:
                    dayHolidays.length > 0
                      ? "rgba(220, 38, 38, 0.05)"
                      : undefined,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: tokens.colorNeutralForeground3,
                  }}
                >
                  {DAYS_SHORT[date.getDay()]}
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: isTodayDate ? 600 : 400,
                    width: 40,
                    height: 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto",
                    borderRadius: "50%",
                    border: isTodayDate
                      ? `2px solid ${tokens.colorBrandBackground}`
                      : "2px solid transparent",
                    color: dayHolidays.length > 0 ? "#dc2626" : undefined,
                  }}
                >
                  {date.getDate()}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    marginTop: 4,
                  }}
                >
                  {workingLoc && (
                    <Badge
                      size="small"
                      style={{
                        fontSize: 9,
                        background: workingLoc.summary
                          ?.toLowerCase()
                          .includes("office")
                          ? "#0891b2"
                          : "#0d9488",
                        color: "white",
                      }}
                    >
                      {workingLoc.summary}
                    </Badge>
                  )}
                  {totalWorkHours > 0 && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedWorkLogs({
                          logs: dayWorkLogs,
                          date,
                          position: { x: e.clientX, y: e.clientY },
                        });
                      }}
                      style={{
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#5b21b6",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        cursor: "pointer",
                      }}
                    >
                      <Clock16Regular style={{ fontSize: 10 }} />
                      {totalWorkHours}h
                    </div>
                  )}
                  {totalReservationHours > 0 && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReservations({
                          reservations: dayReservations,
                          date,
                          position: { x: e.clientX, y: e.clientY },
                        });
                      }}
                      style={{
                        fontSize: 9,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "#b45309",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        cursor: "pointer",
                        flexWrap: "wrap",
                      }}
                    >
                      {dayReservations.slice(0, 2).map((res) => (
                        <div
                          key={res.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <Avatar
                            size={16}
                            name={
                              res.requester.fullName ||
                              res.requester.user.name ||
                              res.requester.user.email
                            }
                            image={{
                              src:
                                res.requester.avatar ||
                                res.requester.user.image ||
                                undefined,
                            }}
                          />
                          <span
                            style={{
                              maxWidth: 50,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {res.title}
                          </span>
                        </div>
                      ))}
                      {totalReservationHours}h
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{ position: "relative" }}>
            {hours.map((hour) => (
              <div
                key={hour}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px repeat(7, 1fr)",
                  height: 48,
                  borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                }}
              >
                <div
                  style={{
                    padding: "2px 8px",
                    fontSize: 10,
                    color: tokens.colorNeutralForeground4,
                    textAlign: "right",
                  }}
                >
                  {hour.toString().padStart(2, "0")}:00
                </div>
                {weekDays.map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      borderLeft: `1px solid ${tokens.colorNeutralStroke2}`,
                    }}
                  />
                ))}
              </div>
            ))}

            {/* Render events on grid */}
            {showEvents &&
              weekDays.map((date, dayIdx) => {
                const dayEvents = getEventsForDate(date).filter(
                  (e) => e.start.dateTime,
                );

                return dayEvents.map((event) => {
                  const startTime = new Date(event.start.dateTime!);
                  const endTime = new Date(
                    event.end.dateTime || event.end.date || "",
                  );
                  const startHour =
                    startTime.getHours() + startTime.getMinutes() / 60;
                  const endHour =
                    endTime.getHours() + endTime.getMinutes() / 60;
                  const duration = Math.max(endHour - startHour, 0.5);

                  return (
                    <div
                      key={event.id}
                      onClick={(e) =>
                        setSelectedEvent({
                          event,
                          position: { x: e.clientX, y: e.clientY },
                        })
                      }
                      style={{
                        position: "absolute",
                        top: startHour * 48,
                        left: `calc(60px + ${dayIdx} * ((100% - 60px) / 7) + 2px)`,
                        width: `calc((100% - 60px) / 7 - 4px)`,
                        height: duration * 48 - 2,
                        background: getEventColor(event.colorId),
                        borderRadius: 4,
                        padding: 4,
                        fontSize: 11,
                        color: "white",
                        overflow: "hidden",
                        cursor: "pointer",
                        zIndex: 1,
                      }}
                    >
                      <div style={{ fontWeight: 500 }}>
                        {event.summary || "(No title)"}
                      </div>
                      <div style={{ fontSize: 10, opacity: 0.9 }}>
                        {formatTime(event.start.dateTime)} -{" "}
                        {formatTime(event.end.dateTime)}
                      </div>
                    </div>
                  );
                });
              })}
          </div>
        </div>
      </div>
    );
  };

  // Render day view
  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayEvents = showEvents
      ? getEventsForDate(selectedDate).filter((e) => e.start.dateTime)
      : [];
    const dayWorkLogs = showWorkLogs ? getWorkLogsForDate(selectedDate) : [];
    const dayReservations = showReservations
      ? getReservationsForDate(selectedDate)
      : [];
    const workingLoc = showEvents
      ? getWorkingLocation(selectedDate)
      : undefined;
    const dayHolidays = getHolidaysForDate(selectedDate);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 16,
            borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
            background:
              dayHolidays.length > 0 ? "rgba(220, 38, 38, 0.05)" : undefined,
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{ fontSize: 11, color: tokens.colorNeutralForeground3 }}
            >
              {DAYS_SHORT[selectedDate.getDay()]}
            </div>
            <div style={{ fontSize: 32, fontWeight: 600 }}>
              {selectedDate.getDate()}
            </div>
            {dayHolidays.length > 0 && (
              <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 500 }}>
                {dayHolidays[0].summary}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13 }}>{employeeName}</span>
            {workingLoc && (
              <Badge
                size="small"
                style={{
                  background: workingLoc.summary
                    ?.toLowerCase()
                    .includes("office")
                    ? "#0891b2"
                    : "#0d9488",
                  color: "white",
                }}
              >
                {workingLoc.summary}
              </Badge>
            )}
            <Avatar
              size={32}
              name={employeeName}
              image={{ src: employeeAvatar || undefined }}
            />
          </div>
        </div>

        {/* Work logs summary */}
        {dayWorkLogs.length > 0 && (
          <div
            onClick={(e) => {
              setSelectedWorkLogs({
                logs: dayWorkLogs,
                date: selectedDate,
                position: { x: e.clientX, y: e.clientY },
              });
            }}
            style={{
              padding: 12,
              borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
              background: tokens.colorNeutralBackground2,
              flexShrink: 0,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Clock16Regular style={{ color: "#5b21b6" }} />
              <span style={{ color: "#5b21b6" }}>
                Work Logged: {dayWorkLogs.reduce((sum, w) => sum + w.hours, 0)}h
              </span>
            </div>
            {dayWorkLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  fontSize: 11,
                  padding: 4,
                  marginBottom: 4,
                  background: tokens.colorNeutralBackground1,
                  borderRadius: 4,
                  borderLeft: "3px solid #5b21b6",
                }}
              >
                <span style={{ fontWeight: 500 }}>{log.title}</span>
                <span style={{ color: tokens.colorNeutralForeground3 }}>
                  {" "}
                  - {log.hours}h
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Reservations summary */}
        {dayReservations.length > 0 && (
          <div
            onClick={(e) => {
              setSelectedReservations({
                reservations: dayReservations,
                date: selectedDate,
                position: { x: e.clientX, y: e.clientY },
              });
            }}
            style={{
              padding: 12,
              borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
              background: tokens.colorNeutralBackground2,
              flexShrink: 0,
              cursor: "pointer",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <People20Regular style={{ color: "#b45309" }} />
              <span style={{ color: "#b45309" }}>
                Reserved: {dayReservations.reduce((sum, r) => sum + r.hours, 0)}
                h
              </span>
            </div>
            {dayReservations.map((res) => (
              <div
                key={res.id}
                style={{
                  fontSize: 11,
                  padding: 4,
                  marginBottom: 4,
                  background: tokens.colorNeutralBackground1,
                  borderRadius: 4,
                  borderLeft: "3px solid #b45309",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Avatar
                  size={20}
                  name={
                    res.requester.fullName ||
                    res.requester.user.name ||
                    res.requester.user.email
                  }
                  image={{
                    src:
                      res.requester.avatar ||
                      res.requester.user.image ||
                      undefined,
                  }}
                />
                <span style={{ fontWeight: 500 }}>{res.title}</span>
                <span style={{ color: tokens.colorNeutralForeground3 }}>
                  - {res.hours}h
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Time grid */}
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "60px 1fr" }}>
            <div style={{ position: "relative" }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  style={{
                    height: 48,
                    padding: "2px 8px",
                    fontSize: 10,
                    color: tokens.colorNeutralForeground4,
                    textAlign: "right",
                    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                  }}
                >
                  {hour.toString().padStart(2, "0")}:00
                </div>
              ))}
            </div>
            <div style={{ position: "relative" }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  style={{
                    height: 48,
                    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                    borderLeft: `1px solid ${tokens.colorNeutralStroke1}`,
                  }}
                />
              ))}

              {/* Events */}
              {dayEvents.map((event) => {
                const startTime = new Date(event.start.dateTime!);
                const endTime = new Date(
                  event.end.dateTime || event.end.date || "",
                );
                const startHour =
                  startTime.getHours() + startTime.getMinutes() / 60;
                const endHour = endTime.getHours() + endTime.getMinutes() / 60;
                const duration = Math.max(endHour - startHour, 0.5);

                return (
                  <div
                    key={event.id}
                    onClick={(e) =>
                      setSelectedEvent({
                        event,
                        position: { x: e.clientX, y: e.clientY },
                      })
                    }
                    style={{
                      position: "absolute",
                      top: startHour * 48,
                      left: 4,
                      right: 4,
                      height: duration * 48 - 2,
                      background: getEventColor(event.colorId),
                      borderRadius: 4,
                      padding: 8,
                      color: "white",
                      overflow: "hidden",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 500, fontSize: 13 }}>
                      {event.summary || "(No title)"}
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.9 }}>
                      {formatTime(event.start.dateTime)} -{" "}
                      {formatTime(event.end.dateTime)}
                    </div>
                    {event.location && (
                      <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
                        {event.location}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const isLoading = loadingEvents || loadingWorkLogs;

  // Fetch employees list for selection
  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    ...employeeQueries.all,
    enabled: !employeeId,
  });

  // Ensure employees is always an array
  const employees = Array.isArray(employeesData) ? employeesData : [];

  // Filter employees based on search
  const filteredEmployees = useMemo(() => {
    if (!employeeSearch.trim()) return employees;
    const search = employeeSearch.toLowerCase();
    return employees.filter((emp) => {
      const name = emp.fullName || emp.user.name || "";
      const email = emp.user.email;
      return (
        name.toLowerCase().includes(search) ||
        email.toLowerCase().includes(search)
      );
    });
  }, [employees, employeeSearch]);

  // Show employee selection when no employee is selected
  if (!employeeId) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
            flexShrink: 0,
          }}
        >
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 600 }}>
            Team Calendar
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: tokens.colorNeutralForeground3,
            }}
          >
            Select an employee to view their calendar
          </p>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 20px", flexShrink: 0 }}>
          <Input
            placeholder="Search employees..."
            value={employeeSearch}
            onChange={(_, d) => setEmployeeSearch(d.value)}
            contentBefore={<Search24Regular />}
            style={{ width: "100%" }}
          />
        </div>

        {/* Employee List */}
        <div style={{ flex: 1, overflow: "auto", padding: "0 20px 20px" }}>
          {loadingEmployees ? (
            <div
              style={{ display: "flex", justifyContent: "center", padding: 40 }}
            >
              <Spinner label="Loading employees..." />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: tokens.colorNeutralForeground3,
              }}
            >
              {employeeSearch ? "No employees found" : "No employees available"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {filteredEmployees.map((emp) => {
                const name = emp.fullName || emp.user.name || emp.user.email;
                const avatar = emp.avatar || emp.user.image;

                return (
                  <Button
                    key={emp.id}
                    appearance="subtle"
                    style={{
                      justifyContent: "flex-start",
                      padding: "12px 16px",
                      height: "auto",
                    }}
                    onClick={() => {
                      selectEmployee({
                        id: emp.id,
                        name,
                        email: emp.user.email,
                        avatar,
                      });
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <Avatar
                        size={40}
                        name={name}
                        image={{ src: avatar || undefined }}
                      />
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>
                          {name}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: tokens.colorNeutralForeground3,
                          }}
                        >
                          {emp.user.email}
                        </div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar
            size={36}
            name={employeeName}
            image={{ src: employeeAvatar || undefined }}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              {employeeName}'s Calendar
            </div>
            <div
              style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}
            >
              {employeeEmail}
            </div>
          </div>
        </div>
        {/* Show change button to allow selecting a different employee */}
        {employeeId && (
          <Button
            appearance="subtle"
            icon={<Person24Regular />}
            onClick={clearSelection}
          >
            Change
          </Button>
        )}
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
          flexShrink: 0,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            appearance="subtle"
            icon={<ChevronLeft24Regular />}
            onClick={() => navigate(-1)}
          />
          <Button appearance="secondary" size="small" onClick={goToToday}>
            Today
          </Button>
          <Button
            appearance="subtle"
            icon={<ChevronRight24Regular />}
            onClick={() => navigate(1)}
          />
          <span style={{ fontWeight: 500, minWidth: 160, marginLeft: 8 }}>
            {getTitle()}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Switch
              checked={showEvents}
              onChange={(_, d) => handleShowEventsChange(d.checked)}
              label="Events"
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Switch
              checked={showWorkLogs}
              onChange={(_, d) => handleShowWorkLogsChange(d.checked)}
              label="Work Logs"
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Switch
              checked={showReservations}
              onChange={(_, d) => handleShowReservationsChange(d.checked)}
              label="Reservations"
            />
          </div>

          <TabList
            selectedValue={viewMode}
            onTabSelect={(_, d) => handleViewModeChange(d.value as ViewMode)}
            size="small"
          >
            <Tab value="day" icon={<Calendar24Regular />}>
              Day
            </Tab>
            <Tab value="week" icon={<CalendarWeekNumbers24Regular />}>
              Week
            </Tab>
            <Tab value="month" icon={<CalendarMonth24Regular />}>
              Month
            </Tab>
          </TabList>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {isLoading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <Spinner size="large" label="Loading calendar..." />
          </div>
        ) : eventsError && showEvents ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: tokens.colorPaletteRedForeground1,
              gap: 8,
            }}
          >
            <span>Failed to load calendar events</span>
            <span
              style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}
            >
              {eventsError instanceof Error
                ? eventsError.message
                : "Unknown error"}
            </span>
          </div>
        ) : (
          <>
            {viewMode === "month" && renderMonthView()}
            {viewMode === "week" && renderWeekView()}
            {viewMode === "day" && renderDayView()}
          </>
        )}
      </div>

      {/* Event Detail Popup */}
      {selectedEvent && (
        <EventDetailPopup
          event={selectedEvent.event}
          position={selectedEvent.position}
          containerRect={getContainerRect()}
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {/* Work Log Detail Popup */}
      {selectedWorkLogs && (
        <WorkLogDetailPopup
          workLogs={selectedWorkLogs.logs}
          date={selectedWorkLogs.date}
          position={selectedWorkLogs.position}
          containerRect={getContainerRect()}
          onClose={() => setSelectedWorkLogs(null)}
        />
      )}

      {/* Reservation Detail Popup */}
      {selectedReservations && (
        <ReservationDetailPopup
          reservations={selectedReservations.reservations}
          date={selectedReservations.date}
          position={selectedReservations.position}
          containerRect={getContainerRect()}
          onClose={() => setSelectedReservations(null)}
        />
      )}
    </div>
  );
}
