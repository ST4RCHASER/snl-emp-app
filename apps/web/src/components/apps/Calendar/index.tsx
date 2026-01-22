import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Spinner,
  Badge,
  tokens,
  makeStyles,
  mergeClasses,
} from "@fluentui/react-components";
import {
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Open16Regular,
  Location16Regular,
  Clock16Regular,
} from "@fluentui/react-icons";
import { calendarQueries, type CalendarEvent } from "@/api/queries/calendar";
import { useWindowRefresh } from "@/components/desktop/WindowContext";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 0",
    marginBottom: "8px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  monthNav: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  monthTitle: {
    fontWeight: 600,
    fontSize: "16px",
    minWidth: "150px",
    textAlign: "center",
  },
  content: {
    flex: 1,
    overflow: "auto",
    minHeight: 0,
  },
  eventList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  eventCard: {
    padding: "10px 12px",
    borderRadius: "6px",
    backgroundColor: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: "pointer",
    transition: "background-color 0.1s, border-color 0.1s",
    "&:hover": {
      backgroundColor: tokens.colorNeutralBackground2Hover,
    },
  },
  eventCardOngoing: {
    backgroundColor: tokens.colorBrandBackground2,
    borderLeftColor: tokens.colorBrandStroke1,
    borderRightColor: tokens.colorBrandStroke1,
    borderTopColor: tokens.colorBrandStroke1,
    borderBottomColor: tokens.colorBrandStroke1,
    "&:hover": {
      backgroundColor: tokens.colorBrandBackground2Hover,
    },
  },
  eventHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "2px",
  },
  eventTitle: {
    fontWeight: 500,
    fontSize: "13px",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  eventMeta: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
  },
  dateGroup: {
    marginBottom: "20px",
  },
  dateHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
    position: "sticky",
    top: 0,
    backgroundColor: tokens.colorNeutralBackground1,
    padding: "4px 0",
    zIndex: 1,
  },
  dateHeaderLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  dateHeaderText: {
    fontWeight: 600,
    fontSize: "13px",
    color: tokens.colorNeutralForeground2,
  },
  dateHeaderTextToday: {
    color: tokens.colorBrandForeground1,
  },
  dateHeaderLocation: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
    maxWidth: "200px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  todayBadge: {
    fontSize: "10px",
  },
  eventsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: tokens.colorNeutralForeground3,
    gap: "8px",
    textAlign: "center",
    padding: "20px",
  },
  errorState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: tokens.colorPaletteRedForeground1,
    gap: "12px",
    textAlign: "center",
    padding: "20px",
  },
  allDay: {
    fontSize: "11px",
  },
  ongoingBadge: {
    fontSize: "10px",
    marginLeft: "auto",
  },
});

function formatTime(dateTime?: string, date?: string): string | undefined {
  if (date) {
    return "All day";
  }
  if (dateTime) {
    return new Date(dateTime).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return undefined;
}

function formatDateRange(event: CalendarEvent): string {
  const start = event.start.dateTime || event.start.date;
  const end = event.end.dateTime || event.end.date;

  if (event.start.date) {
    return "All day";
  }

  if (start && end) {
    const startTime = formatTime(event.start.dateTime, event.start.date);
    const endTime = formatTime(event.end.dateTime, event.end.date);
    return `${startTime} - ${endTime}`;
  }

  return "";
}

function getEventDate(event: CalendarEvent): Date {
  const dateStr = event.start.dateTime || event.start.date;
  return dateStr ? new Date(dateStr) : new Date();
}

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isEventOngoing(event: CalendarEvent, eventDate: Date): boolean {
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if the event date is today first
  const eventDay = new Date(eventDate);
  eventDay.setHours(0, 0, 0, 0);

  if (eventDay.getTime() !== today.getTime()) {
    return false; // Only show "Now" for today's events
  }

  // For all-day events on today
  if (event.start.date) {
    return true; // All-day event on today is considered ongoing
  }

  // For timed events
  if (event.start.dateTime && event.end.dateTime) {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    return now >= start && now <= end;
  }

  return false;
}

// Check if event is a "working location" type (all-day event named "Office" or similar)
function isWorkingLocation(event: CalendarEvent): boolean {
  if (!event.start.date) return false; // Must be all-day
  const title = (event.summary || "").toLowerCase();
  return (
    title === "office" ||
    title === "home" ||
    title === "wfh" ||
    title === "work from home" ||
    title.includes("working location")
  );
}

interface GroupedEvents {
  dateKey: string;
  displayDate: string;
  date: Date;
  events: CalendarEvent[];
  workingLocation?: CalendarEvent;
}

function groupEventsByDate(events: CalendarEvent[]): GroupedEvents[] {
  const groups = new Map<
    string,
    {
      displayDate: string;
      date: Date;
      events: CalendarEvent[];
      workingLocation?: CalendarEvent;
    }
  >();

  events.forEach((event) => {
    const date = getEventDate(event);
    const dateKey = getDateKey(date);
    const displayDate = date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        displayDate,
        date,
        events: [],
        workingLocation: undefined,
      });
    }

    const group = groups.get(dateKey)!;

    // Check if this is a working location event
    if (isWorkingLocation(event)) {
      group.workingLocation = event;
    } else {
      group.events.push(event);
    }
  });

  return Array.from(groups.entries()).map(([dateKey, data]) => ({
    dateKey,
    ...data,
  }));
}

export default function Calendar() {
  const styles = useStyles();
  const contentRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  const [currentYear, setCurrentYear] = useState(() =>
    new Date().getFullYear(),
  );
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());

  // Refresh data when window refresh button is clicked
  const queryKeys = useMemo(() => [["calendar"]], []);
  useWindowRefresh(queryKeys);

  // Calculate time range for current month view
  const timeMin = new Date(currentYear, currentMonth, 1).toISOString();
  const timeMax = new Date(
    currentYear,
    currentMonth + 1,
    0,
    23,
    59,
    59,
  ).toISOString();

  const { data, isLoading, error, refetch } = useQuery(
    calendarQueries.events(timeMin, timeMax),
  );

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleToday = () => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();

    // If already on today's month, just scroll to today
    if (currentYear === todayYear && currentMonth === todayMonth) {
      scrollToToday();
    } else {
      // Navigate to today's month first
      setCurrentYear(todayYear);
      setCurrentMonth(todayMonth);
    }
  };

  const scrollToToday = () => {
    if (todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "auto", block: "start" });
    }
  };

  // Scroll to today when data loads and we're on today's month
  useEffect(() => {
    const today = new Date();
    if (
      currentYear === today.getFullYear() &&
      currentMonth === today.getMonth() &&
      data?.events
    ) {
      // Small delay to ensure DOM is ready
      setTimeout(scrollToToday, 100);
    }
  }, [data, currentYear, currentMonth]);

  const handleEventClick = (event: CalendarEvent) => {
    if (event.htmlLink) {
      window.open(event.htmlLink, "_blank", "noopener,noreferrer");
    }
  };

  const monthLabel = new Date(currentYear, currentMonth, 1).toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric",
    },
  );

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Spinner size="medium" />
          <span>Loading calendar events...</span>
        </div>
      </div>
    );
  }

  if (error) {
    let errorMessage = "Failed to load calendar";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "object" && error !== null) {
      const errObj = error as {
        message?: string;
        value?: { message?: string };
      };
      errorMessage =
        errObj.message || errObj.value?.message || JSON.stringify(error);
    }
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <span>Failed to load calendar events</span>
          <span
            style={{ fontSize: "12px", color: tokens.colorNeutralForeground3 }}
          >
            {errorMessage}
          </span>
          <Button
            appearance="primary"
            size="small"
            onClick={() => refetch()}
            style={{ marginTop: 12 }}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const events = data?.events || [];
  const groupedEvents = groupEventsByDate(events);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.monthNav}>
          <Button
            appearance="subtle"
            icon={<ChevronLeft24Regular />}
            onClick={handlePrevMonth}
            size="small"
          />
          <span className={styles.monthTitle}>{monthLabel}</span>
          <Button
            appearance="subtle"
            icon={<ChevronRight24Regular />}
            onClick={handleNextMonth}
            size="small"
          />
        </div>
        <Button appearance="secondary" size="small" onClick={handleToday}>
          Today
        </Button>
      </div>

      <div className={styles.content} ref={contentRef}>
        {events.length === 0 ? (
          <div className={styles.emptyState}>
            <span>No events this month</span>
          </div>
        ) : (
          <div className={styles.eventList}>
            {groupedEvents.map((group) => {
              const isTodayGroup = isToday(group.date);
              return (
                <div
                  key={group.dateKey}
                  className={styles.dateGroup}
                  ref={isTodayGroup ? todayRef : undefined}
                >
                  <div className={styles.dateHeaderRow}>
                    <div className={styles.dateHeaderLeft}>
                      <span
                        className={mergeClasses(
                          styles.dateHeaderText,
                          isTodayGroup && styles.dateHeaderTextToday,
                        )}
                      >
                        {group.displayDate}
                      </span>
                      {isTodayGroup && (
                        <Badge
                          appearance="filled"
                          color="brand"
                          size="small"
                          className={styles.todayBadge}
                        >
                          Today
                        </Badge>
                      )}
                    </div>
                    {group.workingLocation && (
                      <div
                        className={styles.dateHeaderLocation}
                        title={group.workingLocation.summary || ""}
                      >
                        <Location16Regular />
                        <span>{group.workingLocation.summary}</span>
                      </div>
                    )}
                  </div>

                  {group.events.length > 0 ? (
                    <div className={styles.eventsContainer}>
                      {group.events.map((event) => {
                        const ongoing = isEventOngoing(event, group.date);
                        return (
                          <div
                            key={event.id}
                            className={mergeClasses(
                              styles.eventCard,
                              ongoing && styles.eventCardOngoing,
                            )}
                            onClick={() => handleEventClick(event)}
                          >
                            <div className={styles.eventHeader}>
                              <span className={styles.eventTitle}>
                                {event.summary || "(No title)"}
                              </span>
                              {ongoing && (
                                <Badge
                                  appearance="filled"
                                  color="success"
                                  size="small"
                                  className={styles.ongoingBadge}
                                >
                                  Now
                                </Badge>
                              )}
                              {event.htmlLink && !ongoing && (
                                <Open16Regular
                                  style={{
                                    color: tokens.colorNeutralForeground3,
                                  }}
                                />
                              )}
                            </div>
                            <div className={styles.eventMeta}>
                              <Clock16Regular />
                              <span>
                                {event.start.date ? (
                                  <Badge
                                    appearance="outline"
                                    size="small"
                                    className={styles.allDay}
                                  >
                                    All day
                                  </Badge>
                                ) : (
                                  formatDateRange(event)
                                )}
                              </span>
                              {event.location && (
                                <>
                                  <span
                                    style={{
                                      margin: "0 4px",
                                      color: tokens.colorNeutralForeground4,
                                    }}
                                  >
                                    •
                                  </span>
                                  <span
                                    title={event.location}
                                    style={{
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                      maxWidth: "150px",
                                    }}
                                  >
                                    {event.location}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: "12px",
                        color: tokens.colorNeutralForeground4,
                        fontStyle: "italic",
                        padding: "4px 0",
                      }}
                    >
                      No events
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
