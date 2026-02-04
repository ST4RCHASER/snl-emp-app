import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  tokens,
  Button,
  Tooltip,
  Spinner,
  Input,
  Textarea,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Field,
} from "@fluentui/react-components";
import {
  Dismiss16Regular,
  ChevronLeft16Regular,
  ChevronRight16Regular,
  Add16Regular,
  Edit16Regular,
  Delete16Regular,
  ArrowClockwise16Regular,
} from "@fluentui/react-icons";
import type { WorkLogWidget as WorkLogWidgetType } from "@/stores/widgetStore";
import {
  workLogQueries,
  useCreateWorkLog,
  useUpdateWorkLog,
  useDeleteWorkLog,
  type WorkLog,
} from "@/api/queries/worklogs";
import { settingsQueries } from "@/api/queries/settings";

interface WorkLogWidgetProps {
  widget: WorkLogWidgetType;
  onUpdate: (updates: Partial<WorkLogWidgetType>) => void;
  onRemove: () => void;
  onDragEnd: (position: { x: number; y: number }) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function WorkLogWidget({
  widget,
  onRemove,
  onDragEnd,
}: WorkLogWidgetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(widget.position);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showDialog, setShowDialog] = useState(false);
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null);
  const [form, setForm] = useState({ title: "", description: "", hours: 1 });
  const elementRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const currentPosRef = useRef(widget.position);
  const queryClient = useQueryClient();

  const dateStr = formatLocalDate(currentDate);

  // Get settings for work hours per day
  const { data: settings } = useQuery(settingsQueries.global);
  const workHoursPerDay = (settings as { workHoursPerDay?: number } | undefined)?.workHoursPerDay ?? 8;

  // Fetch work logs for the current date
  const { data: workLogs, isLoading, refetch, isFetching } = useQuery({
    ...workLogQueries.list(dateStr, dateStr),
    refetchInterval: 60 * 1000,
  });

  const createWorkLog = useCreateWorkLog();
  const updateWorkLog = useUpdateWorkLog();
  const deleteWorkLog = useDeleteWorkLog();

  // Calculate total hours
  const totalHours = useMemo(() => {
    if (!workLogs) return 0;
    return workLogs.reduce((sum, log) => sum + log.hours, 0);
  }, [workLogs]);

  const progressPercent = Math.min((totalHours / workHoursPerDay) * 100, 100);

  useEffect(() => {
    if (!isDragging) {
      setPosition(widget.position);
      currentPosRef.current = widget.position;
    }
  }, [widget.position, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return;
    if ((e.target as HTMLElement).closest(".worklog-item")) return;

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

  const handleOpenCreate = () => {
    setEditingLog(null);
    setForm({ title: "", description: "", hours: 1 });
    setShowDialog(true);
  };

  const handleOpenEdit = (log: WorkLog) => {
    setEditingLog(log);
    setForm({
      title: log.title,
      description: log.description || "",
      hours: log.hours,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (editingLog) {
      await updateWorkLog.mutateAsync({
        id: editingLog.id,
        title: form.title,
        description: form.description || undefined,
        hours: form.hours,
        date: dateStr,
      });
    } else {
      await createWorkLog.mutateAsync({
        title: form.title,
        description: form.description || undefined,
        hours: form.hours,
        date: dateStr,
      });
    }
    setShowDialog(false);
    queryClient.invalidateQueries({ queryKey: ["worklogs"] });
  };

  const handleDelete = async (id: string) => {
    await deleteWorkLog.mutateAsync(id);
    queryClient.invalidateQueries({ queryKey: ["worklogs"] });
  };

  const isToday = currentDate.toDateString() === new Date().toDateString();

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
                {DAYS[currentDate.getDay()]} {currentDate.getDate()}/{currentDate.getMonth() + 1}
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
            <Tooltip content="Add Work Log" relationship="label">
              <Button
                appearance="subtle"
                size="small"
                icon={<Add16Regular />}
                onClick={handleOpenCreate}
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

        {/* Progress Bar */}
        <div style={{ padding: "8px 10px", borderBottom: `1px solid ${tokens.colorNeutralStroke2}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: tokens.colorNeutralForeground3 }}>
              Total Hours
            </span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>
              {totalHours.toFixed(1)} / {workHoursPerDay}h
            </span>
          </div>
          <div
            style={{
              height: 6,
              background: tokens.colorNeutralBackground4,
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPercent}%`,
                background:
                  progressPercent >= 100
                    ? tokens.colorPaletteGreenBackground3
                    : tokens.colorBrandBackground,
                borderRadius: 3,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        {/* Work Logs List */}
        <div style={{ padding: "8px 10px", maxHeight: 180, overflow: "auto" }}>
          {isLoading ? (
            <div style={{ textAlign: "center", padding: 16 }}>
              <Spinner size="tiny" />
            </div>
          ) : workLogs && workLogs.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {workLogs.map((log) => (
                <div
                  key={log.id}
                  className="worklog-item"
                  style={{
                    padding: "6px 8px",
                    background: tokens.colorNeutralBackground3,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
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
                      {log.title}
                    </div>
                    <div style={{ fontSize: 10, color: tokens.colorNeutralForeground3 }}>
                      {log.hours}h
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Edit16Regular />}
                      onClick={() => handleOpenEdit(log)}
                      style={{ minWidth: 20, height: 20, padding: 2 }}
                    />
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Delete16Regular />}
                      onClick={() => handleDelete(log.id)}
                      style={{
                        minWidth: 20,
                        height: 20,
                        padding: 2,
                        color: tokens.colorPaletteRedForeground1,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: 16,
                color: tokens.colorNeutralForeground3,
                fontSize: 12,
              }}
            >
              No work logs for this day
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(_, d) => !d.open && setShowDialog(false)}>
        <DialogSurface style={{ maxWidth: 360 }}>
          <DialogBody>
            <DialogTitle>{editingLog ? "Edit Work Log" : "Add Work Log"}</DialogTitle>
            <DialogContent>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field label="Title" required>
                  <Input
                    value={form.title}
                    onChange={(_, d) => setForm((f) => ({ ...f, title: d.value }))}
                    placeholder="What did you work on?"
                  />
                </Field>
                <Field label="Hours" required>
                  <Input
                    type="number"
                    min={0.5}
                    max={24}
                    step={0.5}
                    value={form.hours.toString()}
                    onChange={(_, d) =>
                      setForm((f) => ({ ...f, hours: parseFloat(d.value) || 0 }))
                    }
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    value={form.description}
                    onChange={(_, d) => setForm((f) => ({ ...f, description: d.value }))}
                    placeholder="Optional details..."
                    rows={2}
                  />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleSave}
                disabled={!form.title || form.hours <= 0 || createWorkLog.isPending || updateWorkLog.isPending}
              >
                {createWorkLog.isPending || updateWorkLog.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
