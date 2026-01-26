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
  DialogTrigger,
  Tab,
  TabList,
  Card,
  Tooltip,
} from "@fluentui/react-components";
import {
  Add24Regular,
  Calendar24Regular,
  Clock24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Person24Regular,
  CalendarWeekNumbers24Regular,
  CalendarMonth24Regular,
  Warning16Regular,
  Edit24Regular,
  Delete24Regular,
  History24Regular,
} from "@fluentui/react-icons";
import {
  workLogQueries,
  useCreateTeamWorkLog,
  useUpdateWorkLog,
  useDeleteWorkLog,
  type TeamMember,
  type WorkLog,
  type WorkLogAudit,
} from "@/api/queries/worklogs";
import { settingsQueries } from "@/api/queries/settings";
import { calendarQueries, type Holiday } from "@/api/queries/calendar";
import { useWindowStore } from "@/stores/windowStore";

type ViewMode = "day" | "week" | "month";
type DialogViewMode = "day" | "week" | "month";

// Helper to format date as YYYY-MM-DD in local timezone (avoid UTC conversion issues)
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Helper to parse YYYY-MM-DD string as local date
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export default function TeamDashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<TeamMember | null>(
    null,
  );
  const [selectedCellDate, setSelectedCellDate] = useState<string | null>(null);
  const openWindow = useWindowStore((s) => s.openWindow);

  // Fetch team members
  const { data: teamMembers = [], isLoading: loadingTeam } = useQuery(
    workLogQueries.team(),
  );

  // Fetch settings for work hours per day
  const { data: settings } = useQuery(settingsQueries.global);
  const workHoursPerDay =
    (settings as { workHoursPerDay?: number })?.workHoursPerDay ?? 8;

  // Calculate date range based on view mode
  const { startDate, endDate, dateLabels } = useMemo(() => {
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
      dateLabels: labels,
    };
  }, [selectedDate, viewMode]);

  // Fetch team summary
  const { data: teamSummary = {}, isLoading: loadingSummary } = useQuery(
    workLogQueries.teamSummary(startDate, endDate),
  );

  // Fetch holidays for the current date range
  const { data: holidaysData } = useQuery(
    calendarQueries.holidays(
      new Date(startDate).toISOString(),
      new Date(endDate + "T23:59:59").toISOString(),
    ),
  );
  const holidays = holidaysData?.holidays || [];

  // Get holidays for a specific date
  const getHolidaysForDate = (date: Date): Holiday[] => {
    const dateStr = date.toDateString();
    return holidays.filter((holiday) => {
      const holidayDate = new Date(holiday.start);
      return holidayDate.toDateString() === dateStr;
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

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Get color based on hours worked - overtime shows as red/warning
  const getHeatColor = (hours: number) => {
    if (hours === 0) return tokens.colorNeutralBackground4; // No work - dark/neutral
    const percentage = hours / workHoursPerDay;

    // Overtime - increasingly red
    if (percentage >= 2) return "#7f1d1d"; // Very very very overtime (200%+) - darkest red
    if (percentage >= 1.75) return "#991b1b"; // Very very overtime (175%+)
    if (percentage >= 1.5) return "#b91c1c"; // Very overtime (150%+)
    if (percentage >= 1.25) return "#dc2626"; // Overtime (125%+)
    if (percentage >= 1) return "#ef4444"; // Full day / slight overtime (100%+) - red

    // Normal work - green shades
    if (percentage >= 0.75) return "#22c55e"; // Good progress (75-100%) - green
    if (percentage >= 0.5) return "#4ade80"; // Half day (50-75%) - light green
    if (percentage >= 0.25) return "#86efac"; // Some work (25-50%) - lighter green
    return "#bbf7d0"; // Minimal work (<25%) - very light green
  };

  // Check if hours indicate overtime
  const isOvertime = (hours: number) => hours > workHoursPerDay;
  const getOvertimeLevel = (hours: number) => {
    const percentage = hours / workHoursPerDay;
    if (percentage >= 2) return 3; // Critical
    if (percentage >= 1.5) return 2; // High
    if (percentage >= 1.25) return 1; // Warning
    return 0; // Normal
  };

  const getDisplayName = (member: TeamMember) => {
    return (
      member.nickname ||
      member.fullName ||
      member.user.name ||
      member.user.email.split("@")[0]
    );
  };

  const openEmployeeCalendar = (member: TeamMember) => {
    const displayName = getDisplayName(member);
    openWindow(
      "team-calendar",
      `${displayName}'s Calendar`,
      { width: 900, height: 650 },
      {
        employeeId: member.id,
        employeeName: displayName,
        employeeEmail: member.user.email,
        employeeAvatar: member.avatar || member.user.image,
      },
      true, // forceNew - allow multiple employee calendars
    );
  };

  if (loadingTeam) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spinner size="large" label="Loading team..." />
      </div>
    );
  }

  if (teamMembers.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          padding: 40,
          textAlign: "center",
          color: tokens.colorNeutralForeground3,
        }}
      >
        <Person24Regular
          style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}
        />
        <h3 style={{ margin: 0, marginBottom: 8 }}>No Team Members</h3>
        <p style={{ margin: 0 }}>
          You don't have any employees assigned to your team yet.
        </p>
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
          padding: 16,
          borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
          Team Worklog
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TabList
            selectedValue={viewMode}
            onTabSelect={(_, d) => setViewMode(d.value as ViewMode)}
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

      {/* Navigation */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
          flexShrink: 0,
        }}
      >
        <Button
          appearance="subtle"
          icon={<ChevronLeft24Regular />}
          onClick={() => navigate(-1)}
        />
        <Button appearance="secondary" onClick={goToToday}>
          Today
        </Button>
        <span style={{ minWidth: 200, textAlign: "center", fontWeight: 500 }}>
          {viewMode === "month"
            ? selectedDate.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })
            : viewMode === "week"
              ? `${dateLabels[0]?.date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })} - ${dateLabels[
                  dateLabels.length - 1
                ]?.date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}`
              : selectedDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
        </span>
        <Button
          appearance="subtle"
          icon={<ChevronRight24Regular />}
          onClick={() => navigate(1)}
        />
      </div>

      {/* Heatmap Table */}
      <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
        {loadingSummary ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spinner size="medium" label="Loading data..." />
          </div>
        ) : (
          <div style={{ minWidth: viewMode === "month" ? 900 : "auto" }}>
            {/* Header Row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `200px repeat(${dateLabels.length}, 1fr)`,
                gap: 2,
                marginBottom: 2,
                position: "sticky",
                top: 0,
                background: tokens.colorNeutralBackground1,
                zIndex: 1,
              }}
            >
              <div
                style={{
                  padding: 8,
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Employee
              </div>
              {dateLabels.map(({ date, label, isWeekend }) => {
                const dayHolidays = getHolidaysForDate(date);
                const isHoliday = dayHolidays.length > 0;
                return (
                  <Tooltip
                    key={date.toISOString()}
                    content={isHoliday ? dayHolidays[0].summary : ""}
                    relationship="label"
                    visible={isHoliday ? undefined : false}
                  >
                    <div
                      style={{
                        padding: 8,
                        textAlign: "center",
                        fontWeight: isHoliday ? 600 : 500,
                        fontSize: 11,
                        color: isHoliday
                          ? "#dc2626"
                          : isWeekend
                            ? tokens.colorNeutralForeground3
                            : undefined,
                        background: isHoliday
                          ? "rgba(220, 38, 38, 0.1)"
                          : undefined,
                        borderRadius: 4,
                      }}
                    >
                      {label}
                    </div>
                  </Tooltip>
                );
              })}
            </div>

            {/* Employee Rows */}
            {teamMembers.map((member) => {
              const employeeSummary = teamSummary[member.id] || {};

              // Calculate total hours and overtime for the period
              const totalHours = Object.values(employeeSummary).reduce(
                (sum, h) => sum + h,
                0,
              );
              const workingDays = dateLabels.filter((d) => !d.isWeekend).length;
              const expectedHours = workingDays * workHoursPerDay;
              const totalOvertime = totalHours - expectedHours;
              const hasOvertime = totalOvertime > 0;
              const overtimeDays = Object.values(employeeSummary).filter(
                (h) => h > workHoursPerDay,
              ).length;

              return (
                <div
                  key={member.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: `200px repeat(${dateLabels.length}, 1fr)`,
                    gap: 2,
                    marginBottom: 2,
                  }}
                >
                  {/* Employee Info */}
                  <Tooltip
                    content="Click to view calendar"
                    relationship="label"
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: 8,
                        background: hasOvertime
                          ? "rgba(239, 68, 68, 0.15)"
                          : tokens.colorNeutralBackground3,
                        borderRadius: 4,
                        borderLeft: hasOvertime
                          ? "3px solid #ef4444"
                          : "3px solid transparent",
                        cursor: "pointer",
                        transition: "background 0.1s",
                      }}
                      onClick={() => openEmployeeCalendar(member)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = hasOvertime
                          ? "rgba(239, 68, 68, 0.25)"
                          : tokens.colorNeutralBackground3Hover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = hasOvertime
                          ? "rgba(239, 68, 68, 0.15)"
                          : tokens.colorNeutralBackground3;
                      }}
                    >
                      <div style={{ position: "relative" }}>
                        <Avatar
                          size={28}
                          name={getDisplayName(member)}
                          image={{
                            src:
                              member.avatar || member.user.image || undefined,
                          }}
                        />
                        {hasOvertime && (
                          <div
                            style={{
                              position: "absolute",
                              top: -4,
                              right: -4,
                              background: "#ef4444",
                              borderRadius: "50%",
                              width: 16,
                              height: 16,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Warning16Regular
                              style={{ color: "#fff", fontSize: 10 }}
                            />
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 500,
                            fontSize: 13,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {getDisplayName(member)}
                          {hasOvertime && (
                            <Tooltip
                              content={`${overtimeDays} day(s) with overtime this period. Total: +${totalOvertime.toFixed(1)}h over expected.`}
                              relationship="label"
                            >
                              <Badge
                                size="small"
                                color="danger"
                                style={{ fontSize: 9, padding: "0 4px" }}
                              >
                                +{totalOvertime.toFixed(0)}h
                              </Badge>
                            </Tooltip>
                          )}
                        </div>
                        {member.position && (
                          <div
                            style={{
                              fontSize: 11,
                              color: tokens.colorNeutralForeground3,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {member.position}
                          </div>
                        )}
                      </div>
                    </div>
                  </Tooltip>

                  {/* Day Cells */}
                  {dateLabels.map(({ date, isWeekend }) => {
                    const dateKey = formatLocalDate(date);
                    const hours = employeeSummary[dateKey] || 0;
                    const overtime = isOvertime(hours);
                    const overtimeLevel = getOvertimeLevel(hours);
                    const overtimeHours = hours - workHoursPerDay;
                    const dayHolidays = getHolidaysForDate(date);
                    const isHoliday = dayHolidays.length > 0;

                    return (
                      <Tooltip
                        key={dateKey}
                        content={
                          <div>
                            <div>{getDisplayName(member)}</div>
                            <div>
                              {date.toLocaleDateString("en-US", {
                                weekday: "long",
                                month: "short",
                                day: "numeric",
                              })}
                            </div>
                            {isHoliday && (
                              <div
                                style={{
                                  color: "#fca5a5",
                                  fontWeight: 600,
                                  marginBottom: 4,
                                }}
                              >
                                {dayHolidays[0].summary}
                              </div>
                            )}
                            <div style={{ fontWeight: 600 }}>
                              {hours} / {workHoursPerDay} hours
                            </div>
                            {overtime && (
                              <div
                                style={{
                                  color: "#fca5a5",
                                  fontWeight: 600,
                                  marginTop: 4,
                                }}
                              >
                                {overtimeLevel >= 3
                                  ? "CRITICAL OVERTIME"
                                  : overtimeLevel >= 2
                                    ? "HIGH OVERTIME"
                                    : "OVERTIME"}{" "}
                                (+{overtimeHours.toFixed(1)}h)
                              </div>
                            )}
                          </div>
                        }
                        relationship="label"
                      >
                        <div
                          onClick={() => {
                            setSelectedEmployee(member);
                            setSelectedCellDate(dateKey);
                          }}
                          style={{
                            background:
                              isWeekend || isHoliday
                                ? isHoliday
                                  ? "rgba(220, 38, 38, 0.15)"
                                  : tokens.colorNeutralBackground2
                                : getHeatColor(hours),
                            padding: 4,
                            borderRadius: 4,
                            textAlign: "center",
                            cursor: "pointer",
                            minHeight: 36,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: hours > 0 ? 600 : 400,
                            color:
                              hours >= workHoursPerDay * 0.5 || overtime
                                ? "#fff"
                                : hours > 0
                                  ? "#166534"
                                  : undefined,
                            transition: "transform 0.1s",
                            position: "relative",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.05)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                          }}
                        >
                          {isWeekend ? (
                            <span style={{ opacity: 0.3 }}>OFF</span>
                          ) : isHoliday ? (
                            hours > 0 ? (
                              <span style={{ color: "#dc2626" }}>{hours}h</span>
                            ) : (
                              <span style={{ opacity: 0.5, color: "#dc2626" }}>
                                HOL
                              </span>
                            )
                          ) : hours > 0 ? (
                            <>
                              {overtime && (
                                <Warning16Regular
                                  style={{
                                    color: "#fef08a",
                                    marginBottom: 2,
                                  }}
                                />
                              )}
                              <span>{hours}h</span>
                            </>
                          ) : (
                            "-"
                          )}
                        </div>
                      </Tooltip>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 11,
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{ color: tokens.colorNeutralForeground3, fontWeight: 500 }}
        >
          Legend:
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 14,
              height: 14,
              background: tokens.colorNeutralBackground4,
              borderRadius: 2,
              border: `1px solid ${tokens.colorNeutralStroke1}`,
            }}
          />
          <span>None</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 14,
              height: 14,
              background: "#bbf7d0",
              borderRadius: 2,
            }}
          />
          <span>&lt;25%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 14,
              height: 14,
              background: "#86efac",
              borderRadius: 2,
            }}
          />
          <span>25-50%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 14,
              height: 14,
              background: "#4ade80",
              borderRadius: 2,
            }}
          />
          <span>50-75%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 14,
              height: 14,
              background: "#22c55e",
              borderRadius: 2,
            }}
          />
          <span>75-100%</span>
        </div>
        <div
          style={{
            height: 16,
            width: 1,
            background: tokens.colorNeutralStroke2,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 14,
              height: 14,
              background: "#ef4444",
              borderRadius: 2,
            }}
          />
          <span>100%+</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 14,
              height: 14,
              background: "#dc2626",
              borderRadius: 2,
            }}
          />
          <span>125%+</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 14,
              height: 14,
              background: "#b91c1c",
              borderRadius: 2,
            }}
          />
          <span>150%+</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 14,
              height: 14,
              background: "#991b1b",
              borderRadius: 2,
            }}
          />
          <span>175%+</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 14,
              height: 14,
              background: "#7f1d1d",
              borderRadius: 2,
            }}
          />
          <span>200%+</span>
        </div>
        <div
          style={{
            height: 16,
            width: 1,
            background: tokens.colorNeutralStroke2,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Warning16Regular style={{ color: "#fef08a" }} />
          <span>Overtime</span>
        </div>
        <div
          style={{
            height: 16,
            width: 1,
            background: tokens.colorNeutralStroke2,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 14,
              height: 14,
              background: "rgba(220, 38, 38, 0.15)",
              borderRadius: 2,
              border: "1px solid #dc2626",
            }}
          />
          <span>Holiday</span>
        </div>
      </div>

      {/* Employee Detail Dialog */}
      {selectedEmployee && selectedCellDate && (
        <EmployeeDetailDialog
          employee={selectedEmployee}
          clickedDate={selectedCellDate}
          workHoursPerDay={workHoursPerDay}
          onClose={() => {
            setSelectedEmployee(null);
            setSelectedCellDate(null);
          }}
        />
      )}
    </div>
  );
}

function EmployeeDetailDialog({
  employee,
  clickedDate,
  workHoursPerDay,
  onClose,
}: {
  employee: TeamMember;
  clickedDate: string;
  workHoursPerDay: number;
  onClose: () => void;
}) {
  const [dialogViewMode, setDialogViewMode] = useState<DialogViewMode>("day");
  const [addingWork, setAddingWork] = useState(false);
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null);

  const deleteLog = useDeleteWorkLog();

  // Calculate date range based on dialog view mode
  const { queryStartDate, queryEndDate, displayTitle } = useMemo(() => {
    // Parse date string as local date (not UTC) to avoid timezone issues
    const clickedDateObj = parseLocalDate(clickedDate);

    if (dialogViewMode === "day") {
      return {
        queryStartDate: clickedDate,
        queryEndDate: clickedDate,
        displayTitle: clickedDateObj.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      };
    } else if (dialogViewMode === "week") {
      const dayOfWeek = clickedDateObj.getDay();
      const diff =
        clickedDateObj.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const weekStart = new Date(clickedDateObj);
      weekStart.setDate(diff);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      return {
        queryStartDate: formatLocalDate(weekStart),
        queryEndDate: formatLocalDate(weekEnd),
        displayTitle: `${weekStart.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })} - ${weekEnd.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`,
      };
    } else {
      // month
      const year = clickedDateObj.getFullYear();
      const month = clickedDateObj.getMonth();
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);

      return {
        queryStartDate: formatLocalDate(monthStart),
        queryEndDate: formatLocalDate(monthEnd),
        displayTitle: clickedDateObj.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
      };
    }
  }, [clickedDate, dialogViewMode]);

  // Fetch employee's work logs
  const { data: logs = [], isLoading } = useQuery(
    workLogQueries.teamMemberLogs(employee.id, queryStartDate, queryEndDate),
  );

  const getDisplayName = () => {
    return (
      employee.nickname ||
      employee.fullName ||
      employee.user.name ||
      employee.user.email.split("@")[0]
    );
  };

  // Exclude deleted logs from total hours
  const totalHours = logs
    .filter((log) => !log.isDeleted)
    .reduce((sum, log) => sum + log.hours, 0);

  const handleDelete = async (logId: string) => {
    if (confirm("Delete this work log?")) {
      await deleteLog.mutateAsync(logId);
    }
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface style={{ maxWidth: 650 }}>
        <DialogBody>
          <DialogTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar
                size={40}
                name={getDisplayName()}
                image={{
                  src: employee.avatar || employee.user.image || undefined,
                }}
              />
              <div>
                <div>{getDisplayName()}</div>
                {employee.position && (
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: tokens.colorNeutralForeground3,
                    }}
                  >
                    {employee.position}
                  </div>
                )}
              </div>
            </div>
          </DialogTitle>
          <DialogContent>
            {/* View Mode Tabs */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <TabList
                selectedValue={dialogViewMode}
                onTabSelect={(_, d) =>
                  setDialogViewMode(d.value as DialogViewMode)
                }
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
              <Button
                appearance="primary"
                icon={<Add24Regular />}
                size="small"
                onClick={() => setAddingWork(true)}
              >
                Add Work
              </Button>
            </div>

            {/* Date Range Display */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
                padding: "8px 12px",
                background: tokens.colorNeutralBackground3,
                borderRadius: 6,
              }}
            >
              <span style={{ fontWeight: 500 }}>{displayTitle}</span>
              <Badge
                color={
                  totalHours >
                  workHoursPerDay *
                    (dialogViewMode === "day"
                      ? 1
                      : dialogViewMode === "week"
                        ? 5
                        : 20)
                    ? "danger"
                    : totalHours > 0
                      ? "success"
                      : "informative"
                }
                size="large"
              >
                Total: {totalHours} hours
              </Badge>
            </div>

            {isLoading ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <Spinner size="small" />
              </div>
            ) : logs.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 20,
                  color: tokens.colorNeutralForeground3,
                }}
              >
                No work logged for this {dialogViewMode}.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxHeight: 300,
                  overflow: "auto",
                }}
              >
                {logs.map((log) => {
                  const isDeleted = log.isDeleted;
                  return (
                    <Card
                      key={log.id}
                      style={{
                        padding: 12,
                        opacity: isDeleted ? 0.6 : 1,
                        background: isDeleted
                          ? tokens.colorNeutralBackground4
                          : undefined,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              marginBottom: 2,
                              textDecoration: isDeleted
                                ? "line-through"
                                : undefined,
                              color: isDeleted
                                ? tokens.colorNeutralForeground3
                                : undefined,
                            }}
                          >
                            {log.title}
                            {isDeleted && (
                              <Badge
                                appearance="filled"
                                color="danger"
                                size="small"
                                style={{ marginLeft: 8 }}
                              >
                                Deleted
                              </Badge>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: tokens.colorNeutralForeground3,
                              textDecoration: isDeleted
                                ? "line-through"
                                : undefined,
                            }}
                          >
                            {new Date(log.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </div>
                          {log.description && (
                            <div
                              style={{
                                fontSize: 12,
                                color: tokens.colorNeutralForeground2,
                                marginTop: 4,
                                textDecoration: isDeleted
                                  ? "line-through"
                                  : undefined,
                              }}
                            >
                              {log.description}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Badge
                            appearance="outline"
                            icon={<Clock24Regular />}
                            style={{
                              textDecoration: isDeleted
                                ? "line-through"
                                : undefined,
                            }}
                          >
                            {log.hours}h
                          </Badge>
                          <TeamAuditHistoryDialog log={log} />
                          {!isDeleted && (
                            <>
                              <Button
                                appearance="subtle"
                                size="small"
                                icon={<Edit24Regular />}
                                onClick={() => setEditingLog(log)}
                              />
                              <Button
                                appearance="subtle"
                                size="small"
                                icon={<Delete24Regular />}
                                onClick={() => handleDelete(log.id)}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {addingWork && (
              <AddWorkForEmployeeForm
                employee={employee}
                defaultDate={clickedDate}
                onClose={() => setAddingWork(false)}
              />
            )}

            {editingLog && (
              <EditWorkForEmployeeForm
                log={editingLog}
                onClose={() => setEditingLog(null)}
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function AddWorkForEmployeeForm({
  employee,
  defaultDate,
  onClose,
}: {
  employee: TeamMember;
  defaultDate?: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("1");
  const [date, setDate] = useState(defaultDate || formatLocalDate(new Date()));

  const createLog = useCreateTeamWorkLog();

  const handleSubmit = async () => {
    if (!title.trim() || !hours) return;

    await createLog.mutateAsync({
      employeeId: employee.id,
      title: title.trim(),
      description: description.trim() || undefined,
      hours: parseFloat(hours),
      date,
    });

    onClose();
  };

  return (
    <Card style={{ marginTop: 16, padding: 16 }}>
      <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>
        Add Work for{" "}
        {employee.nickname ||
          employee.fullName ||
          employee.user.name ||
          "Employee"}
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Title" required>
          <Input
            value={title}
            onChange={(_, d) => setTitle(d.value)}
            placeholder="What was worked on?"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(_, d) => setDescription(d.value)}
            placeholder="Add details..."
            rows={2}
          />
        </Field>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Hours" required style={{ flex: 1 }}>
            <Input
              type="number"
              value={hours}
              onChange={(_, d) => setHours(d.value)}
              min={0.25}
              max={24}
              step={0.25}
            />
          </Field>
          <Field label="Date" required style={{ flex: 1 }}>
            <Input
              type="date"
              value={date}
              onChange={(_, d) => setDate(d.value)}
            />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button appearance="secondary" size="small" onClick={onClose}>
            Cancel
          </Button>
          <Button
            appearance="primary"
            size="small"
            onClick={handleSubmit}
            disabled={!title.trim() || !hours || createLog.isPending}
          >
            {createLog.isPending ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function EditWorkForEmployeeForm({
  log,
  onClose,
}: {
  log: WorkLog;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(log.title);
  const [description, setDescription] = useState(log.description || "");
  const [hours, setHours] = useState(String(log.hours));
  const [date, setDate] = useState(formatLocalDate(new Date(log.date)));

  const updateLog = useUpdateWorkLog();

  const handleSubmit = async () => {
    if (!title.trim() || !hours) return;

    await updateLog.mutateAsync({
      id: log.id,
      title: title.trim(),
      description: description.trim() || undefined,
      hours: parseFloat(hours),
      date,
    });

    onClose();
  };

  return (
    <Card style={{ marginTop: 16, padding: 16 }}>
      <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>Edit Work Log</h4>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Title" required>
          <Input
            value={title}
            onChange={(_, d) => setTitle(d.value)}
            placeholder="What was worked on?"
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(_, d) => setDescription(d.value)}
            placeholder="Add details..."
            rows={2}
          />
        </Field>
        <div style={{ display: "flex", gap: 12 }}>
          <Field label="Hours" required style={{ flex: 1 }}>
            <Input
              type="number"
              value={hours}
              onChange={(_, d) => setHours(d.value)}
              min={0.25}
              max={24}
              step={0.25}
            />
          </Field>
          <Field label="Date" required style={{ flex: 1 }}>
            <Input
              type="date"
              value={date}
              onChange={(_, d) => setDate(d.value)}
            />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button appearance="secondary" size="small" onClick={onClose}>
            Cancel
          </Button>
          <Button
            appearance="primary"
            size="small"
            onClick={handleSubmit}
            disabled={!title.trim() || !hours || updateLog.isPending}
          >
            {updateLog.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function TeamAuditHistoryDialog({ log }: { log: WorkLog }) {
  const [open, setOpen] = useState(false);
  const auditLogs = log.auditLogs || [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getActionColor = (action: WorkLogAudit["action"]) => {
    switch (action) {
      case "CREATED":
        return "success";
      case "UPDATED":
        return "warning";
      case "DELETED":
        return "danger";
      default:
        return "informative";
    }
  };

  const getActionLabel = (action: WorkLogAudit["action"]) => {
    switch (action) {
      case "CREATED":
        return "Created";
      case "UPDATED":
        return "Edited";
      case "DELETED":
        return "Deleted";
      default:
        return action;
    }
  };

  const formatChanges = (audit: WorkLogAudit) => {
    if (audit.action === "CREATED" || audit.action === "DELETED") {
      return null;
    }

    const oldVals = audit.oldValues || {};
    const newVals = audit.newValues || {};
    const changes: string[] = [];

    if (oldVals.title !== newVals.title) {
      changes.push(`Title: "${oldVals.title}" → "${newVals.title}"`);
    }
    if (oldVals.hours !== newVals.hours) {
      changes.push(`Hours: ${oldVals.hours}h → ${newVals.hours}h`);
    }
    if (oldVals.description !== newVals.description) {
      changes.push("Description updated");
    }
    if (oldVals.date !== newVals.date) {
      changes.push("Date changed");
    }

    return changes.length > 0 ? changes : null;
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => setOpen(d.open)}>
      <DialogTrigger disableButtonEnhancement>
        <Tooltip content="View history" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<History24Regular />}
          />
        </Tooltip>
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Audit History</DialogTitle>
          <DialogContent>
            <div style={{ marginBottom: 16 }}>
              <strong>{log.title}</strong>
              {log.isDeleted && (
                <Badge
                  appearance="filled"
                  color="danger"
                  size="small"
                  style={{ marginLeft: 8 }}
                >
                  Deleted
                </Badge>
              )}
            </div>

            {auditLogs.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 20,
                  color: tokens.colorNeutralForeground3,
                }}
              >
                No audit history available
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  maxHeight: 400,
                  overflow: "auto",
                }}
              >
                {auditLogs.map((audit) => {
                  const changes = formatChanges(audit);
                  return (
                    <div
                      key={audit.id}
                      style={{
                        padding: 12,
                        background: tokens.colorNeutralBackground3,
                        borderRadius: 8,
                        borderLeft: `4px solid ${
                          audit.action === "CREATED"
                            ? "#22c55e"
                            : audit.action === "UPDATED"
                              ? "#eab308"
                              : "#ef4444"
                        }`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <Badge
                          appearance="filled"
                          color={getActionColor(audit.action)}
                          size="small"
                        >
                          {getActionLabel(audit.action)}
                        </Badge>
                        <span
                          style={{
                            fontSize: 12,
                            color: tokens.colorNeutralForeground3,
                          }}
                        >
                          {formatDate(audit.createdAt)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: 13,
                        }}
                      >
                        <Person24Regular
                          style={{
                            fontSize: 16,
                            color: tokens.colorNeutralForeground3,
                          }}
                        />
                        <span>{audit.userName || "Unknown user"}</span>
                      </div>
                      {changes && (
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 12,
                            color: tokens.colorNeutralForeground3,
                          }}
                        >
                          {changes.map((change, i) => (
                            <div key={i}>• {change}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
