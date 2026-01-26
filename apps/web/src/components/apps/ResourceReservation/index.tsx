import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Input,
  Textarea,
  Field,
  Spinner,
  tokens,
  Avatar,
  Badge,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Tab,
  TabList,
  Tooltip,
} from "@fluentui/react-components";
import {
  ChevronLeft24Regular,
  ChevronRight24Regular,
  CalendarWeekNumbers24Regular,
  CalendarMonth24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  Clock24Regular,
  Person24Regular,
} from "@fluentui/react-icons";
import {
  reservationQueries,
  useCreateReservation,
  useRespondReservation,
  useCancelReservation,
  type Resource,
  type Reservation,
} from "@/api/queries/reservations";
import { settingsQueries } from "@/api/queries/settings";
import { calendarQueries, type Holiday } from "@/api/queries/calendar";
import { useWindowRefresh } from "@/components/desktop/WindowContext";
import { logAction } from "@/api/queries/audit";

type ViewMode = "day" | "week" | "month";

// Helper to format date as YYYY-MM-DD in local timezone
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper to extract YYYY-MM-DD from any date value (string, Date, or ISO string)
const getDateKey = (dateValue: unknown): string => {
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
};

export default function ResourceReservation() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState<string>("calendar");
  const [selectedResource, setSelectedResource] = useState<Resource | null>(
    null,
  );
  const [reservationDialog, setReservationDialog] = useState<{
    date: string;
    resource: Resource;
  } | null>(null);
  const [reservationForm, setReservationForm] = useState({
    hours: 8,
    title: "",
    description: "",
  });

  // Refresh data when window refresh button is clicked
  const queryKeys = useMemo(() => [["reservations"], ["settings"]], []);
  useWindowRefresh(queryKeys);

  // Fetch resources (employees with managers)
  const { data: resources = [], isLoading: loadingResources } = useQuery(
    reservationQueries.resources,
  );

  // Fetch settings for work hours per day
  const { data: settings } = useQuery(settingsQueries.global);
  const workHoursPerDay =
    (settings as { workHoursPerDay?: number })?.workHoursPerDay ?? 8;

  // Calculate date range based on view mode
  const { startDate, endDate, startDateISO, endDateISO, dateLabels } =
    useMemo(() => {
      const start = new Date(selectedDate);
      const end = new Date(selectedDate);
      const labels: { date: Date; label: string; isWeekend: boolean }[] = [];

      if (viewMode === "day") {
        labels.push({
          date: new Date(start),
          label: start.toLocaleDateString("en-US", {
            weekday: "short",
            day: "numeric",
          }),
          isWeekend: start.getDay() === 0 || start.getDay() === 6,
        });
      } else if (viewMode === "week") {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        end.setDate(diff + 6);

        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          labels.push({
            date: d,
            label: d.toLocaleDateString("en-US", {
              weekday: "short",
              day: "numeric",
            }),
            isWeekend: d.getDay() === 0 || d.getDay() === 6,
          });
        }
      } else {
        // Month view
        start.setDate(1);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);

        const daysInMonth = end.getDate();
        for (let i = 1; i <= daysInMonth; i++) {
          const d = new Date(start);
          d.setDate(i);
          labels.push({
            date: d,
            label: String(i),
            isWeekend: d.getDay() === 0 || d.getDay() === 6,
          });
        }
      }

      return {
        startDate: formatLocalDate(start),
        endDate: formatLocalDate(end),
        // ISO format for calendar API (holidays)
        startDateISO: new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate(),
        ).toISOString(),
        endDateISO: new Date(
          end.getFullYear(),
          end.getMonth(),
          end.getDate(),
          23,
          59,
          59,
        ).toISOString(),
        dateLabels: labels,
      };
    }, [selectedDate, viewMode]);

  // Fetch reservations for selected resource
  const { data: resourceReservations = [] } = useQuery(
    reservationQueries.resourceReservations(
      selectedResource?.id || "",
      startDate,
      endDate,
    ),
  );

  // Fetch my team reservations (for approval)
  const { data: myTeamReservations = [], isLoading: loadingMyTeam } = useQuery(
    reservationQueries.myTeam(),
  );

  // Fetch my requests
  const { data: myRequests = [], isLoading: loadingMyRequests } = useQuery(
    reservationQueries.myRequests,
  );

  // Fetch holidays (using ISO format dates)
  const { data: holidaysData } = useQuery(
    calendarQueries.holidays(startDateISO, endDateISO),
  );
  const holidays = holidaysData?.holidays || [];

  const createReservation = useCreateReservation();
  const respondReservation = useRespondReservation();
  const cancelReservation = useCancelReservation();

  // Build reservation map by resource and date
  const reservationMap = useMemo(() => {
    const map: Record<string, Record<string, Reservation[]>> = {};

    // Initialize map for all resources
    resources.forEach((resource) => {
      map[resource.id] = {};
    });

    // Group reservations by resource and date
    resourceReservations.forEach((reservation) => {
      const resourceId = reservation.resourceEmployeeId;
      const dateKey = getDateKey(reservation.date);

      if (!map[resourceId]) {
        map[resourceId] = {};
      }
      if (!map[resourceId][dateKey]) {
        map[resourceId][dateKey] = [];
      }
      map[resourceId][dateKey].push(reservation);
    });

    return map;
  }, [resources, resourceReservations]);

  // Build holiday map
  const holidayMap = useMemo(() => {
    const map: Record<string, Holiday> = {};
    if (Array.isArray(holidays)) {
      holidays.forEach((h: Holiday) => {
        if (!h || !h.start) return;
        const dateKey = getDateKey(h.start);
        if (dateKey) {
          map[dateKey] = h;
        }
      });
    }
    return map;
  }, [holidays]);

  const navigateDate = (direction: "prev" | "next") => {
    const newDate = new Date(selectedDate);
    if (viewMode === "day") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 1 : -1));
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
    }
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    logAction("switch_tab", "navigation", `Switched to ${tab} tab`, { tab });
  };

  const handleCellClick = (resource: Resource, date: Date) => {
    const dateStr = formatLocalDate(date);
    setReservationDialog({ date: dateStr, resource });
    setReservationForm({
      hours: workHoursPerDay,
      title: "",
      description: "",
    });
  };

  const handleCreateReservation = async () => {
    if (!reservationDialog) return;

    await createReservation.mutateAsync({
      resourceEmployeeId: reservationDialog.resource.id,
      date: reservationDialog.date,
      hours: reservationForm.hours,
      title: reservationForm.title,
      description: reservationForm.description || undefined,
    });

    setReservationDialog(null);
  };

  const pendingApprovals = myTeamReservations.filter(
    (r) => r.status === "PENDING",
  );

  const getStatusBadge = (status: string) => {
    const colorMap: Record<
      string,
      "warning" | "success" | "danger" | "informative"
    > = {
      PENDING: "warning",
      APPROVED: "success",
      REJECTED: "danger",
      CANCELLED: "informative",
    };
    return <Badge color={colorMap[status] || "informative"}>{status}</Badge>;
  };

  const getEmployeeName = (emp: {
    fullName: string | null;
    user: { name: string | null; email: string };
  }) => {
    return emp.fullName || emp.user.name || emp.user.email;
  };

  const getEmployeeAvatar = (emp: {
    avatar: string | null;
    user: { image: string | null };
  }) => {
    return emp.avatar || emp.user.image || undefined;
  };

  if (loadingResources) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spinner size="large" label="Loading resources..." />
      </div>
    );
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
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
          Resource Reservation
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TabList
            selectedValue={activeTab}
            onTabSelect={(_, d) => handleTabChange(d.value as string)}
            size="small"
          >
            <Tab value="calendar">Calendar</Tab>
            <Tab value="approvals">
              Approvals
              {pendingApprovals.length > 0 && (
                <Badge color="danger" size="small" style={{ marginLeft: 4 }}>
                  {pendingApprovals.length}
                </Badge>
              )}
            </Tab>
            <Tab value="my-requests">My Requests</Tab>
          </TabList>
        </div>
      </div>

      {activeTab === "calendar" && (
        <>
          {/* Calendar Controls */}
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
                onClick={() => navigateDate("prev")}
              />
              <Button appearance="outline" onClick={goToToday}>
                Today
              </Button>
              <Button
                appearance="subtle"
                icon={<ChevronRight24Regular />}
                onClick={() => navigateDate("next")}
              />
              <span style={{ fontWeight: 600, marginLeft: 8 }}>
                {viewMode === "month"
                  ? selectedDate.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })
                  : `${dateLabels[0]?.date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })} - ${dateLabels[
                      dateLabels.length - 1
                    ]?.date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}`}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <TabList
                selectedValue={viewMode}
                onTabSelect={(_, d) => setViewMode(d.value as ViewMode)}
                size="small"
              >
                <Tab value="week" icon={<CalendarWeekNumbers24Regular />}>
                  Week
                </Tab>
                <Tab value="month" icon={<CalendarMonth24Regular />}>
                  Month
                </Tab>
              </TabList>
            </div>
          </div>

          {/* Resource Selector */}
          <div
            style={{
              padding: "8px 16px",
              borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{ fontSize: 13, color: tokens.colorNeutralForeground3 }}
            >
              Select Resource:
            </span>
            {resources.map((resource) => (
              <Button
                key={resource.id}
                appearance={
                  selectedResource?.id === resource.id ? "primary" : "subtle"
                }
                size="small"
                onClick={() => setSelectedResource(resource)}
                icon={
                  <Avatar
                    image={{ src: resource.avatar || undefined }}
                    name={resource.name}
                    size={20}
                  />
                }
              >
                {resource.name}
              </Button>
            ))}
          </div>

          {/* Calendar Grid */}
          {selectedResource ? (
            <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    viewMode === "month"
                      ? "repeat(7, 1fr)"
                      : `repeat(${dateLabels.length}, 1fr)`,
                  gap: 4,
                }}
              >
                {/* Day headers for month view */}
                {viewMode === "month" && (
                  <>
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (day) => (
                        <div
                          key={day}
                          style={{
                            padding: 8,
                            textAlign: "center",
                            fontWeight: 600,
                            fontSize: 12,
                            color: tokens.colorNeutralForeground3,
                          }}
                        >
                          {day}
                        </div>
                      ),
                    )}
                  </>
                )}

                {/* Date headers for week view */}
                {viewMode === "week" &&
                  dateLabels.map(({ label, isWeekend }) => (
                    <div
                      key={label}
                      style={{
                        padding: 8,
                        textAlign: "center",
                        fontWeight: 600,
                        fontSize: 12,
                        color: isWeekend
                          ? tokens.colorNeutralForeground4
                          : tokens.colorNeutralForeground1,
                        background: isWeekend
                          ? tokens.colorNeutralBackground3
                          : undefined,
                        borderRadius: 4,
                      }}
                    >
                      {label}
                    </div>
                  ))}

                {/* Empty cells for month view alignment */}
                {viewMode === "month" &&
                  (() => {
                    const firstDay = dateLabels[0]?.date.getDay() || 0;
                    const offset = firstDay === 0 ? 6 : firstDay - 1;
                    return Array.from({ length: offset }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ));
                  })()}

                {/* Date cells */}
                {dateLabels.map(({ date, label, isWeekend }) => {
                  const dateStr = formatLocalDate(date);
                  const dayReservations =
                    reservationMap[selectedResource.id]?.[dateStr] || [];
                  const approvedReservations = dayReservations.filter(
                    (r) => r.status === "APPROVED",
                  );
                  const pendingReservations = dayReservations.filter(
                    (r) => r.status === "PENDING",
                  );
                  const totalReservedHours = [
                    ...approvedReservations,
                    ...pendingReservations,
                  ].reduce((sum, r) => sum + r.hours, 0);
                  const availableHours = workHoursPerDay - totalReservedHours;
                  const holiday = holidayMap[dateStr];
                  const isToday = formatLocalDate(new Date()) === dateStr;

                  return (
                    <div
                      key={dateStr}
                      onClick={() => {
                        if (!holiday && availableHours > 0) {
                          handleCellClick(selectedResource, date);
                        }
                      }}
                      style={{
                        minHeight: viewMode === "month" ? 80 : 120,
                        padding: 8,
                        border: `1px solid ${
                          isToday
                            ? tokens.colorBrandStroke1
                            : tokens.colorNeutralStroke1
                        }`,
                        borderRadius: 4,
                        background: holiday
                          ? tokens.colorPaletteRedBackground1
                          : isWeekend
                            ? tokens.colorNeutralBackground3
                            : tokens.colorNeutralBackground1,
                        cursor:
                          holiday || availableHours <= 0
                            ? "default"
                            : "pointer",
                        position: "relative",
                      }}
                    >
                      {/* Date label for month view */}
                      {viewMode === "month" && (
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: isToday ? 700 : 400,
                            color: isToday
                              ? tokens.colorBrandForeground1
                              : tokens.colorNeutralForeground1,
                            marginBottom: 4,
                          }}
                        >
                          {label}
                        </div>
                      )}

                      {/* Holiday indicator */}
                      {holiday && (
                        <div
                          style={{
                            fontSize: 10,
                            color: tokens.colorPaletteRedForeground1,
                            marginBottom: 4,
                          }}
                        >
                          {holiday.summary}
                        </div>
                      )}

                      {/* Available hours */}
                      {!holiday && (
                        <div
                          style={{
                            fontSize: 10,
                            color:
                              availableHours <= 0
                                ? tokens.colorPaletteRedForeground1
                                : tokens.colorNeutralForeground3,
                            marginBottom: 4,
                          }}
                        >
                          {availableHours > 0
                            ? `${availableHours}h available`
                            : "Fully booked"}
                        </div>
                      )}

                      {/* Hours progress bar */}
                      {!holiday && totalReservedHours > 0 && (
                        <div
                          style={{
                            height: 4,
                            background: tokens.colorNeutralBackground4,
                            borderRadius: 2,
                            marginBottom: 4,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${(totalReservedHours / workHoursPerDay) * 100}%`,
                              background: tokens.colorPaletteGreenBackground3,
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      )}

                      {/* Reservations - show all avatars */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 2,
                        }}
                      >
                        {[...approvedReservations, ...pendingReservations].map(
                          (res) => (
                            <Tooltip
                              key={res.id}
                              content={`${res.status === "PENDING" ? "[PENDING] " : ""}${getEmployeeName(res.requester)} - ${res.title} (${res.hours}h)`}
                              relationship="description"
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 2,
                                  padding: "2px 4px",
                                  background:
                                    res.status === "PENDING"
                                      ? tokens.colorPaletteYellowBackground1
                                      : tokens.colorPaletteGreenBackground1,
                                  borderRadius: 4,
                                  fontSize: 10,
                                  opacity: res.status === "PENDING" ? 0.8 : 1,
                                }}
                              >
                                <Avatar
                                  image={{
                                    src: getEmployeeAvatar(res.requester),
                                  }}
                                  name={getEmployeeName(res.requester)}
                                  size={16}
                                />
                                <span>{res.hours}h</span>
                              </div>
                            </Tooltip>
                          ),
                        )}
                      </div>

                      {/* Owner avatar when no reservations */}
                      {dayReservations.length === 0 &&
                        !holiday &&
                        selectedResource.managers[0] && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: 8,
                              right: 8,
                              opacity: 0.5,
                            }}
                          >
                            <Tooltip
                              content={`Owner: ${selectedResource.managers[0].name}`}
                              relationship="description"
                            >
                              <Avatar
                                image={{
                                  src:
                                    selectedResource.managers[0].avatar ||
                                    undefined,
                                }}
                                name={selectedResource.managers[0].name}
                                size={24}
                              />
                            </Tooltip>
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: tokens.colorNeutralForeground3,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <Person24Regular
                  style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}
                />
                <div>Select a resource to view their availability</div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Approvals Tab */}
      {activeTab === "approvals" && (
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          <h3 style={{ margin: "0 0 16px", fontWeight: 600 }}>
            Pending Approvals
          </h3>
          {loadingMyTeam ? (
            <Spinner label="Loading..." />
          ) : pendingApprovals.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: tokens.colorNeutralForeground3,
              }}
            >
              No pending approvals
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {pendingApprovals.map((reservation) => (
                <div
                  key={reservation.id}
                  style={{
                    padding: 16,
                    border: `1px solid ${tokens.colorNeutralStroke1}`,
                    borderRadius: 8,
                    background: tokens.colorNeutralBackground1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 16,
                          marginBottom: 4,
                        }}
                      >
                        {reservation.title}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: tokens.colorNeutralForeground3,
                        }}
                      >
                        {reservation.description}
                      </div>
                    </div>
                    {getStatusBadge(reservation.status)}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      fontSize: 13,
                      marginBottom: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Avatar
                        image={{
                          src: getEmployeeAvatar(reservation.requester),
                        }}
                        name={getEmployeeName(reservation.requester)}
                        size={20}
                      />
                      <span>
                        Requested by:{" "}
                        <strong>
                          {getEmployeeName(reservation.requester)}
                        </strong>
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Avatar
                        image={{
                          src: getEmployeeAvatar(reservation.resourceEmployee),
                        }}
                        name={getEmployeeName(reservation.resourceEmployee)}
                        size={20}
                      />
                      <span>
                        Resource:{" "}
                        <strong>
                          {getEmployeeName(reservation.resourceEmployee)}
                        </strong>
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Clock24Regular style={{ fontSize: 16 }} />
                      <span>{reservation.hours} hours</span>
                    </div>
                    <div>
                      Date:{" "}
                      <strong>
                        {new Date(reservation.date).toLocaleDateString()}
                      </strong>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      appearance="primary"
                      icon={<Checkmark24Regular />}
                      onClick={() =>
                        respondReservation.mutate({
                          id: reservation.id,
                          approved: true,
                        })
                      }
                      disabled={respondReservation.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      appearance="secondary"
                      icon={<Dismiss24Regular />}
                      onClick={() =>
                        respondReservation.mutate({
                          id: reservation.id,
                          approved: false,
                        })
                      }
                      disabled={respondReservation.isPending}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Past reservations */}
          {myTeamReservations.filter((r) => r.status !== "PENDING").length >
            0 && (
            <>
              <h3 style={{ margin: "24px 0 16px", fontWeight: 600 }}>
                Past Reservations
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {myTeamReservations
                  .filter((r) => r.status !== "PENDING")
                  .map((reservation) => (
                    <div
                      key={reservation.id}
                      style={{
                        padding: 12,
                        border: `1px solid ${tokens.colorNeutralStroke1}`,
                        borderRadius: 8,
                        background: tokens.colorNeutralBackground2,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 500 }}>
                          {reservation.title}
                        </span>
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 12,
                            color: tokens.colorNeutralForeground3,
                          }}
                        >
                          {getEmployeeName(reservation.resourceEmployee)} -{" "}
                          {new Date(reservation.date).toLocaleDateString()}
                        </span>
                      </div>
                      {getStatusBadge(reservation.status)}
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* My Requests Tab */}
      {activeTab === "my-requests" && (
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          <h3 style={{ margin: "0 0 16px", fontWeight: 600 }}>My Requests</h3>
          {loadingMyRequests ? (
            <Spinner label="Loading..." />
          ) : myRequests.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: tokens.colorNeutralForeground3,
              }}
            >
              No reservation requests
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {myRequests.map((reservation) => (
                <div
                  key={reservation.id}
                  style={{
                    padding: 16,
                    border: `1px solid ${tokens.colorNeutralStroke1}`,
                    borderRadius: 8,
                    background: tokens.colorNeutralBackground1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 16,
                          marginBottom: 4,
                        }}
                      >
                        {reservation.title}
                      </div>
                      {reservation.description && (
                        <div
                          style={{
                            fontSize: 13,
                            color: tokens.colorNeutralForeground3,
                          }}
                        >
                          {reservation.description}
                        </div>
                      )}
                    </div>
                    {getStatusBadge(reservation.status)}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      fontSize: 13,
                      marginBottom: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Avatar
                        image={{
                          src: getEmployeeAvatar(reservation.resourceEmployee),
                        }}
                        name={getEmployeeName(reservation.resourceEmployee)}
                        size={20}
                      />
                      <span>
                        Resource:{" "}
                        <strong>
                          {getEmployeeName(reservation.resourceEmployee)}
                        </strong>
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Avatar
                        image={{
                          src: getEmployeeAvatar(reservation.resourceOwner),
                        }}
                        name={getEmployeeName(reservation.resourceOwner)}
                        size={20}
                      />
                      <span>
                        Owner:{" "}
                        <strong>
                          {getEmployeeName(reservation.resourceOwner)}
                        </strong>
                      </span>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Clock24Regular style={{ fontSize: 16 }} />
                      <span>{reservation.hours} hours</span>
                    </div>
                    <div>
                      Date:{" "}
                      <strong>
                        {new Date(reservation.date).toLocaleDateString()}
                      </strong>
                    </div>
                  </div>

                  {(reservation.status === "PENDING" ||
                    reservation.status === "APPROVED") && (
                    <Button
                      appearance="subtle"
                      icon={<Dismiss24Regular />}
                      onClick={() => cancelReservation.mutate(reservation.id)}
                      disabled={cancelReservation.isPending}
                    >
                      Cancel
                    </Button>
                  )}

                  {reservation.comment && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 8,
                        background: tokens.colorNeutralBackground3,
                        borderRadius: 4,
                        fontSize: 13,
                      }}
                    >
                      <strong>Response:</strong> {reservation.comment}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Reservation Dialog */}
      <Dialog
        open={!!reservationDialog}
        onOpenChange={(_, d) => !d.open && setReservationDialog(null)}
      >
        <DialogSurface style={{ maxWidth: 450 }}>
          <DialogBody>
            <DialogTitle>Reserve Resource</DialogTitle>
            <DialogContent>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    padding: 12,
                    background: tokens.colorNeutralBackground3,
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <Avatar
                      image={{
                        src: reservationDialog?.resource.avatar || undefined,
                      }}
                      name={reservationDialog?.resource.name}
                      size={32}
                    />
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {reservationDialog?.resource.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: tokens.colorNeutralForeground3,
                        }}
                      >
                        {new Date(
                          reservationDialog?.date || "",
                        ).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <Field label="Hours" required>
                  <Input
                    type="number"
                    min={0.5}
                    max={workHoursPerDay}
                    step={0.5}
                    value={reservationForm.hours.toString()}
                    onChange={(_, d) =>
                      setReservationForm((f) => ({
                        ...f,
                        hours: parseFloat(d.value) || 0,
                      }))
                    }
                  />
                  <span
                    style={{
                      fontSize: 12,
                      color: tokens.colorNeutralForeground3,
                    }}
                  >
                    Max {workHoursPerDay} hours per day
                  </span>
                </Field>

                <Field label="Title" required>
                  <Input
                    value={reservationForm.title}
                    onChange={(_, d) =>
                      setReservationForm((f) => ({ ...f, title: d.value }))
                    }
                    placeholder="e.g., Project Alpha development"
                  />
                </Field>

                <Field label="Description">
                  <Textarea
                    value={reservationForm.description}
                    onChange={(_, d) =>
                      setReservationForm((f) => ({
                        ...f,
                        description: d.value,
                      }))
                    }
                    placeholder="Optional details about the reservation..."
                    rows={3}
                  />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setReservationDialog(null)}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleCreateReservation}
                disabled={
                  !reservationForm.title ||
                  reservationForm.hours <= 0 ||
                  createReservation.isPending
                }
              >
                {createReservation.isPending
                  ? "Submitting..."
                  : "Submit Request"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
