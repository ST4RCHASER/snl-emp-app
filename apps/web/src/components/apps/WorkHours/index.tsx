import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Input,
  Textarea,
  Field,
  Spinner,
  tokens,
  Card,
  Badge,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Tooltip,
} from "@fluentui/react-components";
import {
  Add24Regular,
  Calendar24Regular,
  Clock24Regular,
  Delete24Regular,
  Edit24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
  Warning16Regular,
  History24Regular,
  Person24Regular,
} from "@fluentui/react-icons";
import {
  workLogQueries,
  useCreateWorkLog,
  useUpdateWorkLog,
  useDeleteWorkLog,
  type WorkLog,
  type WorkLogAudit,
} from "@/api/queries/worklogs";
import { logAction } from "@/api/queries/audit";
import { settingsQueries } from "@/api/queries/settings";
import { useMobile } from "@/hooks/useMobile";

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
    // Already a string - just take the date part
    return dateValue.split("T")[0];
  }
  if (dateValue instanceof Date) {
    return formatLocalDate(dateValue);
  }
  // Try to parse as date
  try {
    return formatLocalDate(new Date(dateValue as string | number));
  } catch {
    return "";
  }
}

export default function WorkHours() {
  const isMobile = useMobile();

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return formatLocalDate(today);
  });

  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });

  // Get the week range
  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [currentWeekStart]);

  const startDate = formatLocalDate(weekDates[0]);
  const endDate = formatLocalDate(weekDates[6]);

  // Fetch work logs for the week
  const { data: workLogs = [], isLoading } = useQuery(
    workLogQueries.list(startDate, endDate),
  );

  // Fetch settings for work hours per day
  const { data: settings } = useQuery(settingsQueries.global);
  const workHoursPerDay =
    (settings as { workHoursPerDay?: number })?.workHoursPerDay ?? 8;

  // Group logs by date
  const logsByDate = useMemo(() => {
    const grouped: Record<string, WorkLog[]> = {};
    workLogs.forEach((log) => {
      const dateKey = getDateKey(log.date);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(log);
    });
    return grouped;
  }, [workLogs]);

  // Calculate total hours per day (exclude deleted logs)
  const hoursPerDay = useMemo(() => {
    const hours: Record<string, number> = {};
    workLogs.forEach((log) => {
      if (log.isDeleted) return; // Don't count deleted logs
      const dateKey = getDateKey(log.date);
      hours[dateKey] = (hours[dateKey] || 0) + log.hours;
    });
    return hours;
  }, [workLogs]);

  const navigateWeek = (direction: number) => {
    setCurrentWeekStart((prev) => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + direction * 7);
      return newDate;
    });
    logAction(
      "navigate_week",
      "navigation",
      `Navigated ${direction > 0 ? "next" : "previous"} week in Work Logs`,
    );
  };

  const goToToday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(today.setDate(diff)));
    setSelectedDate(formatLocalDate(new Date()));
    logAction(
      "go_to_today",
      "navigation",
      "Navigated to current week in Work Logs",
    );
  };

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    logAction(
      "select_date",
      "navigation",
      `Selected date ${dateStr} in Work Logs`,
      { date: dateStr },
    );
  };

  const selectedDateLogs = logsByDate[selectedDate] || [];
  const selectedDateHours = hoursPerDay[selectedDate] || 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: isMobile ? 12 : 16,
        gap: isMobile ? 12 : 16,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "space-between",
          gap: isMobile ? 12 : 0,
        }}
      >
        <h2
          style={{ margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 600 }}
        >
          Work Logs
        </h2>
        <AddWorkLogDialog date={selectedDate} isMobile={isMobile} />
      </div>

      {/* Week Navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 8 : 12,
          justifyContent: "center",
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}
      >
        <Button
          appearance="subtle"
          icon={<ChevronLeft24Regular />}
          onClick={() => navigateWeek(-1)}
          size={isMobile ? "small" : "medium"}
        />
        <Button
          appearance="secondary"
          onClick={goToToday}
          size={isMobile ? "small" : "medium"}
        >
          Today
        </Button>
        <span
          style={{
            minWidth: isMobile ? "auto" : 200,
            textAlign: "center",
            fontWeight: 500,
            fontSize: isMobile ? 13 : 14,
          }}
        >
          {weekDates[0].toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}{" "}
          -{" "}
          {weekDates[6].toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <Button
          appearance="subtle"
          icon={<ChevronRight24Regular />}
          onClick={() => navigateWeek(1)}
          size={isMobile ? "small" : "medium"}
        />
      </div>

      {/* Week Calendar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile
            ? "repeat(7, minmax(44px, 1fr))"
            : "repeat(7, 1fr)",
          gap: isMobile ? 4 : 8,
          overflowX: isMobile ? "auto" : "visible",
          paddingBottom: isMobile ? 4 : 0,
        }}
      >
        {weekDates.map((date) => {
          const dateKey = formatLocalDate(date);
          const hours = hoursPerDay[dateKey] || 0;
          const isSelected = dateKey === selectedDate;
          const isToday = dateKey === formatLocalDate(new Date());
          const percentage = Math.min((hours / workHoursPerDay) * 100, 100);
          const isOvertime = hours > workHoursPerDay;
          const overtimePercentage = hours / workHoursPerDay;

          // Get progress bar color - matches badge: yellow for under, green for full, red for overtime
          const getProgressColor = () => {
            if (hours === 0) return "transparent";
            // Overtime - red shades
            if (overtimePercentage >= 2) return "#7f1d1d"; // 200%+
            if (overtimePercentage >= 1.5) return "#b91c1c"; // 150%+
            if (overtimePercentage >= 1.25) return "#dc2626"; // 125%+
            if (overtimePercentage > 1) return "#ef4444"; // >100% overtime
            // Full day - green
            if (overtimePercentage >= 1) return "#22c55e"; // 100% exactly
            // Under target - yellow/orange shades
            if (overtimePercentage >= 0.75) return "#eab308"; // 75-100% - yellow
            if (overtimePercentage >= 0.5) return "#f59e0b"; // 50-75% - amber
            return "#fb923c"; // <50% - orange
          };

          return (
            <div
              key={dateKey}
              onClick={() => handleSelectDate(dateKey)}
              style={{
                padding: isMobile ? 8 : 12,
                borderRadius: isMobile ? 6 : 8,
                cursor: "pointer",
                background: isSelected
                  ? isOvertime
                    ? "#dc2626"
                    : tokens.colorBrandBackground
                  : tokens.colorNeutralBackground3,
                color: isSelected
                  ? tokens.colorNeutralForegroundOnBrand
                  : undefined,
                border: isToday
                  ? `2px solid ${tokens.colorBrandForeground1}`
                  : isOvertime && !isSelected
                    ? "2px solid #ef4444"
                    : "2px solid transparent",
                textAlign: "center",
                transition: "all 0.15s",
                minWidth: isMobile ? 44 : "auto",
              }}
            >
              <div style={{ fontSize: isMobile ? 10 : 11, opacity: 0.7 }}>
                {date.toLocaleDateString("en-US", {
                  weekday: isMobile ? "narrow" : "short",
                })}
              </div>
              <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 600 }}>
                {date.getDate()}
              </div>
              <div
                style={{
                  marginTop: isMobile ? 4 : 8,
                  height: isMobile ? 3 : 4,
                  background: isSelected
                    ? "rgba(255,255,255,0.3)"
                    : tokens.colorNeutralBackground5,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${percentage}%`,
                    background: getProgressColor(),
                    transition: "width 0.3s",
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: isMobile ? 10 : 11,
                  marginTop: isMobile ? 2 : 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                {isOvertime && !isMobile && (
                  <Warning16Regular
                    style={{
                      color: isSelected ? "#fef08a" : "#ef4444",
                      fontSize: 12,
                    }}
                  />
                )}
                {hours > 0 ? `${hours}h` : "-"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Day Details */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            marginBottom: 12,
            gap: isMobile ? 8 : 0,
          }}
        >
          <h3
            style={{ margin: 0, fontSize: isMobile ? 14 : 16, fontWeight: 600 }}
          >
            {new Date(selectedDate).toLocaleDateString("en-US", {
              weekday: isMobile ? "short" : "long",
              month: isMobile ? "short" : "long",
              day: "numeric",
            })}
          </h3>
          <Badge
            color={
              selectedDateHours > workHoursPerDay
                ? "danger"
                : selectedDateHours >= workHoursPerDay
                  ? "success"
                  : selectedDateHours > 0
                    ? "warning"
                    : "informative"
            }
            icon={
              selectedDateHours > workHoursPerDay ? (
                <Warning16Regular />
              ) : undefined
            }
          >
            {selectedDateHours} / {workHoursPerDay} hours
            {selectedDateHours > workHoursPerDay &&
              ` (+${(selectedDateHours - workHoursPerDay).toFixed(1)}h overtime)`}
          </Badge>
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spinner size="medium" label="Loading..." />
          </div>
        ) : selectedDateLogs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: tokens.colorNeutralForeground3,
            }}
          >
            No work logged for this day.
            <br />
            <AddWorkLogDialog date={selectedDate} trigger="link" />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {selectedDateLogs.map((log) => (
              <WorkLogCard key={log.id} log={log} isMobile={isMobile} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkLogCard({ log, isMobile }: { log: WorkLog; isMobile: boolean }) {
  const deleteLog = useDeleteWorkLog();
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const isDeleted = log.isDeleted;

  return (
    <Card
      style={{
        padding: 12,
        opacity: isDeleted ? 0.6 : 1,
        background: isDeleted ? tokens.colorNeutralBackground4 : undefined,
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
              marginBottom: 4,
              textDecoration: isDeleted ? "line-through" : undefined,
              color: isDeleted ? tokens.colorNeutralForeground3 : undefined,
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
          {log.description && (
            <div
              style={{
                fontSize: 13,
                color: tokens.colorNeutralForeground3,
                whiteSpace: "pre-wrap",
                textDecoration: isDeleted ? "line-through" : undefined,
              }}
            >
              {log.description}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge
            appearance="outline"
            icon={<Clock24Regular />}
            style={{
              textDecoration: isDeleted ? "line-through" : undefined,
            }}
          >
            {log.hours}h
          </Badge>
          {/* Audit History Button */}
          <AuditHistoryDialog
            log={log}
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            isMobile={isMobile}
          />
          {/* Only show edit/delete if not already deleted */}
          {!isDeleted && (
            <>
              <EditWorkLogDialog
                log={log}
                open={editOpen}
                onOpenChange={setEditOpen}
                isMobile={isMobile}
              />
              <Button
                appearance="subtle"
                size="small"
                icon={<Delete24Regular />}
                onClick={() => {
                  if (confirm("Delete this work log?")) {
                    deleteLog.mutate(log.id);
                  }
                }}
              />
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function AddWorkLogDialog({
  date,
  trigger = "button",
  isMobile = false,
}: {
  date: string;
  trigger?: "button" | "link";
  isMobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("1");
  const [selectedDate, setSelectedDate] = useState(date);

  const createLog = useCreateWorkLog();

  const handleSubmit = async () => {
    if (!title.trim() || !hours) return;

    await createLog.mutateAsync({
      title: title.trim(),
      description: description.trim() || undefined,
      hours: parseFloat(hours),
      date: selectedDate,
    });

    setTitle("");
    setDescription("");
    setHours("1");
    setOpen(false);
  };

  // Update selected date when prop changes
  useState(() => {
    setSelectedDate(date);
  });

  return (
    <Dialog open={open} onOpenChange={(_, d) => setOpen(d.open)}>
      <DialogTrigger disableButtonEnhancement>
        {trigger === "button" ? (
          <Button
            appearance="primary"
            icon={<Add24Regular />}
            style={isMobile ? { width: "100%" } : undefined}
          >
            Add Work
          </Button>
        ) : (
          <Button appearance="transparent" style={{ marginTop: 8 }}>
            Add your first entry
          </Button>
        )}
      </DialogTrigger>
      <DialogSurface
        style={
          isMobile ? { maxWidth: "calc(100vw - 32px)", margin: 16 } : undefined
        }
      >
        <DialogBody>
          <DialogTitle>Add Work Log</DialogTitle>
          <DialogContent
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <Field label="Title" required>
              <Input
                value={title}
                onChange={(_, d) => setTitle(d.value)}
                placeholder="What did you work on?"
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={description}
                onChange={(_, d) => setDescription(d.value)}
                placeholder="Add details about your work..."
                rows={3}
              />
            </Field>
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? 12 : 16,
              }}
            >
              <Field label="Hours" required style={{ flex: 1 }}>
                <Input
                  type="number"
                  value={hours}
                  onChange={(_, d) => setHours(d.value)}
                  min={0.25}
                  max={24}
                  step={0.25}
                  contentBefore={<Clock24Regular />}
                />
              </Field>
              <Field label="Date" required style={{ flex: 1 }}>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(_, d) => setSelectedDate(d.value)}
                  contentBefore={<Calendar24Regular />}
                />
              </Field>
            </div>
          </DialogContent>
          <DialogActions
            style={isMobile ? { flexDirection: "column", gap: 8 } : undefined}
          >
            <Button
              appearance="secondary"
              onClick={() => setOpen(false)}
              style={isMobile ? { width: "100%" } : undefined}
            >
              Cancel
            </Button>
            <Button
              appearance="primary"
              onClick={handleSubmit}
              disabled={!title.trim() || !hours || createLog.isPending}
              style={isMobile ? { width: "100%" } : undefined}
            >
              {createLog.isPending ? "Adding..." : "Add"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function EditWorkLogDialog({
  log,
  open,
  onOpenChange,
  isMobile,
}: {
  log: WorkLog;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
}) {
  const [title, setTitle] = useState(log.title);
  const [description, setDescription] = useState(log.description || "");
  const [hours, setHours] = useState(String(log.hours));
  const [date, setDate] = useState(getDateKey(log.date));

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

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => onOpenChange(d.open)}>
      <DialogTrigger disableButtonEnhancement>
        <Button appearance="subtle" size="small" icon={<Edit24Regular />} />
      </DialogTrigger>
      <DialogSurface
        style={
          isMobile ? { maxWidth: "calc(100vw - 32px)", margin: 16 } : undefined
        }
      >
        <DialogBody>
          <DialogTitle>Edit Work Log</DialogTitle>
          <DialogContent
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <Field label="Title" required>
              <Input
                value={title}
                onChange={(_, d) => setTitle(d.value)}
                placeholder="What did you work on?"
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={description}
                onChange={(_, d) => setDescription(d.value)}
                placeholder="Add details about your work..."
                rows={3}
              />
            </Field>
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: isMobile ? 12 : 16,
              }}
            >
              <Field label="Hours" required style={{ flex: 1 }}>
                <Input
                  type="number"
                  value={hours}
                  onChange={(_, d) => setHours(d.value)}
                  min={0.25}
                  max={24}
                  step={0.25}
                  contentBefore={<Clock24Regular />}
                />
              </Field>
              <Field label="Date" required style={{ flex: 1 }}>
                <Input
                  type="date"
                  value={date}
                  onChange={(_, d) => setDate(d.value)}
                  contentBefore={<Calendar24Regular />}
                />
              </Field>
            </div>
          </DialogContent>
          <DialogActions
            style={isMobile ? { flexDirection: "column", gap: 8 } : undefined}
          >
            <Button
              appearance="secondary"
              onClick={() => onOpenChange(false)}
              style={isMobile ? { width: "100%" } : undefined}
            >
              Cancel
            </Button>
            <Button
              appearance="primary"
              onClick={handleSubmit}
              disabled={!title.trim() || !hours || updateLog.isPending}
              style={isMobile ? { width: "100%" } : undefined}
            >
              {updateLog.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

function AuditHistoryDialog({
  log,
  open,
  onOpenChange,
  isMobile,
}: {
  log: WorkLog;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
}) {
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
    if (audit.action === "CREATED") {
      return null;
    }

    if (audit.action === "DELETED") {
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
      changes.push(`Date changed`);
    }

    return changes.length > 0 ? changes : null;
  };

  return (
    <Dialog open={open} onOpenChange={(_, d) => onOpenChange(d.open)}>
      <DialogTrigger disableButtonEnhancement>
        <Tooltip content="View history" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<History24Regular />}
          />
        </Tooltip>
      </DialogTrigger>
      <DialogSurface
        style={
          isMobile ? { maxWidth: "calc(100vw - 32px)", margin: 16 } : undefined
        }
      >
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
            <Button appearance="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
