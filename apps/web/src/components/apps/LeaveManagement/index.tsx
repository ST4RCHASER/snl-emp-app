import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Tab,
  TabList,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Badge,
  Button,
  Spinner,
  Field,
  Input,
  Textarea,
  Select,
  Checkbox,
  Card,
  CardHeader,
  tokens,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Switch,
  Tooltip,
} from "@fluentui/react-components";
import {
  Add24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  ArrowLeft24Regular,
  Calendar24Regular,
  CalendarMonth24Regular,
  Edit24Regular,
  Delete24Regular,
  Settings24Regular,
  People24Regular,
  ChevronLeft24Regular,
  ChevronRight24Regular,
  TextBulletListLtr24Regular,
} from "@fluentui/react-icons";
import {
  leaveQueries,
  useCreateLeave,
  useApproveLeave,
  useCancelLeave,
} from "@/api/queries/leaves";
import {
  leaveTypeQueries,
  useCreateLeaveType,
  useUpdateLeaveType,
  useDeleteLeaveType,
  useSeedLeaveTypes,
  type LeaveTypeConfig,
  type Gender,
} from "@/api/queries/leave-types";
import {
  leaveBalanceQueries,
  useSetEmployeeBalance,
  type LeaveBalance,
} from "@/api/queries/leave-balances";
import { logAction } from "@/api/queries/audit";
import { calendarQueries, type Holiday } from "@/api/queries/calendar";
import { useAuth } from "@/auth/provider";
import { useWindowRefresh } from "@/components/desktop/WindowContext";
import { useMobile } from "@/hooks/useMobile";
import { api } from "@/api/client";
import {
  preferencesQueries,
  useUpdatePreferences,
  type LeaveManagementSettings,
} from "@/api/queries/preferences";

export default function LeaveManagement() {
  const [activeTab, setActiveTab] = useState<string>("my-leaves");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showLeaveTypeDialog, setShowLeaveTypeDialog] = useState(false);
  const [editingLeaveType, setEditingLeaveType] =
    useState<LeaveTypeConfig | null>(null);
  const [showBalanceDialog, setShowBalanceDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState<{
    id: string;
    type: string;
  } | null>(null);
  const [pendingViewMode, setPendingViewMode] = useState<"list" | "calendar">(
    "list",
  );
  const [allLeavesViewMode, setAllLeavesViewMode] = useState<
    "list" | "calendar"
  >("list");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const { user } = useAuth();
  const isMobile = useMobile();

  // Load preferences
  const { data: preferences } = useQuery(preferencesQueries.user);
  const updatePreferences = useUpdatePreferences();
  const leaveSettings = (
    preferences as
      | { leaveManagementSettings?: LeaveManagementSettings }
      | undefined
  )?.leaveManagementSettings;

  // Load settings from database when preferences are fetched
  useEffect(() => {
    if (leaveSettings && !settingsLoaded) {
      if (leaveSettings.activeTab) setActiveTab(leaveSettings.activeTab);
      if (leaveSettings.pendingViewMode)
        setPendingViewMode(leaveSettings.pendingViewMode);
      if (leaveSettings.allLeavesViewMode)
        setAllLeavesViewMode(leaveSettings.allLeavesViewMode);
      if (
        leaveSettings.selectedEmployeeId &&
        leaveSettings.selectedEmployeeName
      )
        setSelectedEmployee({
          id: leaveSettings.selectedEmployeeId,
          name: leaveSettings.selectedEmployeeName,
        });
      setSettingsLoaded(true);
    }
  }, [leaveSettings, settingsLoaded]);

  // Save settings to database
  const saveSettings = useCallback(
    (settings: LeaveManagementSettings) => {
      updatePreferences.mutate({
        leaveManagementSettings: {
          activeTab: leaveSettings?.activeTab,
          pendingViewMode: leaveSettings?.pendingViewMode,
          allLeavesViewMode: leaveSettings?.allLeavesViewMode,
          selectedEmployeeId: leaveSettings?.selectedEmployeeId,
          selectedEmployeeName: leaveSettings?.selectedEmployeeName,
          ...settings,
        },
      });
    },
    [updatePreferences, leaveSettings],
  );

  // Handler for selecting an employee (saves to preferences)
  const handleSelectEmployee = useCallback(
    (emp: { id: string; name: string } | null) => {
      setSelectedEmployee(emp);
      saveSettings({
        selectedEmployeeId: emp?.id ?? null,
        selectedEmployeeName: emp?.name ?? null,
      });
    },
    [saveSettings],
  );

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    saveSettings({ activeTab: tab });
    logAction(
      "switch_tab",
      "navigation",
      `Switched to ${tab} tab in Leave Management`,
      { tab },
    );
  };

  const handlePendingViewModeChange = (mode: "list" | "calendar") => {
    setPendingViewMode(mode);
    saveSettings({ pendingViewMode: mode });
  };

  const handleAllLeavesViewModeChange = (mode: "list" | "calendar") => {
    setAllLeavesViewMode(mode);
    saveSettings({ allLeavesViewMode: mode });
  };

  const handleOpenCreateForm = () => {
    setShowCreateForm(true);
    logAction(
      "open_leave_form",
      "navigation",
      "Opened create leave request form",
    );
  };

  const userRole = (user as { role?: string } | undefined)?.role;
  const isManager =
    userRole === "MANAGEMENT" ||
    userRole === "ADMIN" ||
    userRole === "DEVELOPER";
  const isHR =
    userRole === "HR" || userRole === "ADMIN" || userRole === "DEVELOPER";

  const view =
    activeTab === "pending-approval"
      ? "pending-approval"
      : activeTab === "all"
        ? "all"
        : undefined;

  // Refresh data when window refresh button is clicked
  const queryKeys = useMemo(
    () => [["leaves"], ["leave-types"], ["leave-balances"]],
    [],
  );
  useWindowRefresh(queryKeys);

  const { data: leavesData, isLoading } = useQuery(leaveQueries.all(view));
  const leaves = leavesData as
    | Array<{
        id: string;
        leaveTypeConfig: {
          id: string;
          name: string;
          code: string;
          color: string | null;
        };
        reason: string;
        startDate: string;
        endDate: string;
        status: string;
        isHalfDay: boolean;
        employee: { user: { name: string | null; email: string } };
      }>
    | undefined;

  // New queries for leave types and balances
  const { data: leaveTypes, isLoading: loadingTypes } = useQuery(
    leaveTypeQueries.all(isHR),
  );
  const { data: eligibleLeaveTypes } = useQuery(leaveTypeQueries.eligible());
  const { data: myBalances } = useQuery(leaveBalanceQueries.my());

  const createLeave = useCreateLeave();
  const approveLeave = useApproveLeave();
  const cancelLeave = useCancelLeave();

  const handleCancelLeave = async () => {
    if (!cancelConfirm) return;
    await cancelLeave.mutateAsync(cancelConfirm.id);
    setCancelConfirm(null);
  };

  const [form, setForm] = useState({
    type: "" as string,
    reason: "",
    startDate: "",
    endDate: "",
    isHalfDay: false,
    halfDayType: "morning" as const,
  });

  // Get active leave types for the form (use eligible types for the dropdown)
  const activeLeaveTypes = useMemo(
    () => eligibleLeaveTypes || [],
    [eligibleLeaveTypes],
  );

  // Get selected leave type config
  const selectedLeaveType = useMemo(
    () => activeLeaveTypes.find((lt) => lt.code === form.type),
    [activeLeaveTypes, form.type],
  );

  // Get balance for selected leave type
  const selectedBalance = useMemo(
    () => myBalances?.find((b) => b.leaveType.code === form.type),
    [myBalances, form.type],
  );

  const handleCreate = async () => {
    await createLeave.mutateAsync({
      ...form,
      halfDayType: form.isHalfDay ? form.halfDayType : undefined,
    });
    setShowCreateForm(false);
    setForm({
      type: activeLeaveTypes[0]?.code || "ANNUAL",
      reason: "",
      startDate: "",
      endDate: "",
      isHalfDay: false,
      halfDayType: "morning",
    });
  };

  // Set default type when leave types load
  useMemo(() => {
    if (activeLeaveTypes.length > 0 && !form.type) {
      setForm((f) => ({ ...f, type: activeLeaveTypes[0].code }));
    }
  }, [activeLeaveTypes, form.type]);

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

  if (isLoading || loadingTypes) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spinner size="large" label="Loading..." />
      </div>
    );
  }

  // Show create form
  if (showCreateForm) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
            paddingBottom: 16,
          }}
        >
          <Button
            appearance="subtle"
            icon={<ArrowLeft24Regular />}
            onClick={() => setShowCreateForm(false)}
          />
          <h3 style={{ margin: 0, fontWeight: 600 }}>Request Leave</h3>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              maxWidth: isMobile ? "100%" : 400,
            }}
          >
            <Field label="Leave Type">
              <Select
                value={form.type}
                onChange={(_, d) =>
                  setForm((f) => ({
                    ...f,
                    type: d.value,
                    isHalfDay: false, // Reset half day when type changes
                  }))
                }
              >
                {activeLeaveTypes.length > 0 ? (
                  activeLeaveTypes.map((lt) => (
                    <option key={lt.id} value={lt.code}>
                      {lt.name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="ANNUAL">Annual</option>
                    <option value="SICK">Sick</option>
                    <option value="PERSONAL">Personal</option>
                    <option value="BIRTHDAY">Birthday</option>
                    <option value="UNPAID">Unpaid</option>
                    <option value="OTHER">Other</option>
                  </>
                )}
              </Select>
            </Field>
            {/* Show balance info for selected leave type */}
            {selectedBalance && !selectedLeaveType?.isUnlimited && (
              <Card
                size="small"
                style={{
                  borderLeft: selectedLeaveType?.color
                    ? `3px solid ${selectedLeaveType.color}`
                    : undefined,
                }}
              >
                <CardHeader
                  header={
                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                      Available Balance
                    </span>
                  }
                  description={
                    <span style={{ fontSize: 14 }}>
                      {selectedBalance.remaining} /{" "}
                      {selectedBalance.totalBalance} days remaining
                    </span>
                  }
                />
              </Card>
            )}
            <Field label="Start Date">
              <Input
                type="date"
                value={form.startDate}
                onChange={(_, d) =>
                  setForm((f) => ({ ...f, startDate: d.value }))
                }
              />
            </Field>
            <Field label="End Date">
              <Input
                type="date"
                value={form.endDate}
                onChange={(_, d) =>
                  setForm((f) => ({ ...f, endDate: d.value }))
                }
              />
            </Field>
            {/* Only show half-day option if leave type allows it */}
            {(selectedLeaveType?.allowHalfDay ?? true) && (
              <>
                <Checkbox
                  checked={form.isHalfDay}
                  onChange={(_, d) =>
                    setForm((f) => ({ ...f, isHalfDay: !!d.checked }))
                  }
                  label="Half day"
                />
                {form.isHalfDay && (
                  <Field label="Half Day Type">
                    <Select
                      value={form.halfDayType}
                      onChange={(_, d) =>
                        setForm((f) => ({
                          ...f,
                          halfDayType: d.value as typeof form.halfDayType,
                        }))
                      }
                    >
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                    </Select>
                  </Field>
                )}
              </>
            )}
            <Field label="Reason">
              <Textarea
                value={form.reason}
                onChange={(_, d) => setForm((f) => ({ ...f, reason: d.value }))}
                placeholder="Enter reason for leave..."
                rows={3}
              />
            </Field>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
            paddingTop: 16,
          }}
        >
          <Button
            appearance="secondary"
            onClick={() => setShowCreateForm(false)}
          >
            Cancel
          </Button>
          <Button
            appearance="primary"
            onClick={handleCreate}
            disabled={
              !form.reason ||
              !form.startDate ||
              !form.endDate ||
              createLeave.isPending
            }
          >
            {createLeave.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 16,
      }}
    >
      {/* Leave Balance Cards - Only show on My Leaves tab */}
      {activeTab === "my-leaves" && myBalances && myBalances.length > 0 && (
        <div
          style={{ display: "flex", gap: isMobile ? 8 : 12, flexWrap: "wrap" }}
        >
          {myBalances
            .filter((b) => b.leaveType.isActive)
            .slice(0, 4)
            .map((balance) => (
              <Card
                key={balance.leaveType.id}
                size="small"
                style={{
                  flex: "1 1 auto",
                  minWidth: isMobile ? "calc(50% - 4px)" : 120,
                  borderLeft: balance.leaveType.color
                    ? `3px solid ${balance.leaveType.color}`
                    : undefined,
                }}
              >
                <CardHeader
                  header={
                    <span
                      style={{ fontWeight: 600, fontSize: isMobile ? 12 : 14 }}
                    >
                      {balance.leaveType.name}
                    </span>
                  }
                  description={
                    balance.leaveType.isUnlimited
                      ? "Unlimited"
                      : `${balance.remaining ?? 0} / ${balance.totalBalance}`
                  }
                />
              </Card>
            ))}
        </div>
      )}

      {/* Tabs and Actions */}
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          alignItems: isMobile ? "stretch" : "center",
          gap: isMobile ? 12 : 0,
        }}
      >
        <TabList
          selectedValue={activeTab}
          onTabSelect={(_, d) => handleTabChange(d.value as string)}
          size={isMobile ? "small" : "medium"}
        >
          <Tab value="my-leaves">My Leaves</Tab>
          {isManager && (
            <Tab value="pending-approval">
              {isMobile ? "Pending" : "Pending Approval"}
            </Tab>
          )}
          {isHR && <Tab value="all">All Leaves</Tab>}
          {isHR && (
            <Tab value="leave-types" icon={<Settings24Regular />}>
              {isMobile ? "Types" : "Leave Types"}
            </Tab>
          )}
          {isHR && (
            <Tab value="employee-balances" icon={<People24Regular />}>
              {isMobile ? "Balances" : "Employee Balances"}
            </Tab>
          )}
        </TabList>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {activeTab === "pending-approval" && isManager && (
            <>
              <Button
                appearance={
                  pendingViewMode === "list" ? "primary" : "secondary"
                }
                size="small"
                icon={<TextBulletListLtr24Regular />}
                onClick={() => handlePendingViewModeChange("list")}
              >
                List
              </Button>
              <Button
                appearance={
                  pendingViewMode === "calendar" ? "primary" : "secondary"
                }
                size="small"
                icon={<CalendarMonth24Regular />}
                onClick={() => handlePendingViewModeChange("calendar")}
              >
                Calendar
              </Button>
            </>
          )}
          {activeTab === "all" && isHR && (
            <>
              <Button
                appearance={
                  allLeavesViewMode === "list" ? "primary" : "secondary"
                }
                size="small"
                icon={<TextBulletListLtr24Regular />}
                onClick={() => handleAllLeavesViewModeChange("list")}
              >
                List
              </Button>
              <Button
                appearance={
                  allLeavesViewMode === "calendar" ? "primary" : "secondary"
                }
                size="small"
                icon={<CalendarMonth24Regular />}
                onClick={() => handleAllLeavesViewModeChange("calendar")}
              >
                Calendar
              </Button>
            </>
          )}
          {activeTab === "my-leaves" && (
            <Button
              appearance="primary"
              icon={<Add24Regular />}
              onClick={handleOpenCreateForm}
            >
              Request Leave
            </Button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* Leave Types Management */}
        {activeTab === "leave-types" && (
          <LeaveTypesManagement
            leaveTypes={leaveTypes || []}
            onBack={() => setActiveTab("my-leaves")}
            onEdit={(lt) => {
              setEditingLeaveType(lt);
              setShowLeaveTypeDialog(true);
            }}
            onAdd={() => {
              setEditingLeaveType(null);
              setShowLeaveTypeDialog(true);
            }}
            showDialog={showLeaveTypeDialog}
            editingType={editingLeaveType}
            onCloseDialog={() => {
              setShowLeaveTypeDialog(false);
              setEditingLeaveType(null);
            }}
            isMobile={isMobile}
          />
        )}

        {/* Employee Balances Management */}
        {activeTab === "employee-balances" && (
          <EmployeeBalancesManagement
            leaveTypes={leaveTypes?.filter((lt) => lt.isActive) || []}
            onBack={() => setActiveTab("my-leaves")}
            selectedEmployee={selectedEmployee}
            onSelectEmployee={handleSelectEmployee}
            showDialog={showBalanceDialog}
            onCloseDialog={() => setShowBalanceDialog(false)}
            onOpenDialog={() => setShowBalanceDialog(true)}
            isMobile={isMobile}
          />
        )}

        {/* Calendar View for All Leaves (HR) */}
        {activeTab === "all" && allLeavesViewMode === "calendar" && isHR && (
          <LeaveCalendarView isMobile={isMobile} />
        )}

        {/* Calendar View for pending-approval (Manager's team only) */}
        {activeTab === "pending-approval" &&
          pendingViewMode === "calendar" &&
          isManager && <LeaveCalendarView isMobile={isMobile} teamOnly />}

        {/* Leave Requests List */}
        {activeTab !== "leave-types" &&
          activeTab !== "employee-balances" &&
          !(
            activeTab === "pending-approval" && pendingViewMode === "calendar"
          ) &&
          !(activeTab === "all" && allLeavesViewMode === "calendar") &&
          (isMobile ? (
            // Mobile Card View
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {leaves?.map((leave) => (
                <Card key={leave.id} style={{ padding: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Badge
                        appearance="outline"
                        style={{
                          borderColor:
                            leave.leaveTypeConfig?.color || undefined,
                          color: leave.leaveTypeConfig?.color || undefined,
                        }}
                      >
                        {leave.leaveTypeConfig?.name || "Unknown"}
                      </Badge>
                      {leave.isHalfDay && (
                        <Badge appearance="tint" color="informative">
                          Half Day
                        </Badge>
                      )}
                    </div>
                    {getStatusBadge(leave.status)}
                  </div>

                  {activeTab !== "my-leaves" && (
                    <div
                      style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}
                    >
                      {leave.employee.user.name || leave.employee.user.email}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      color: tokens.colorNeutralForeground2,
                      marginBottom: 4,
                    }}
                  >
                    <Calendar24Regular style={{ fontSize: 16 }} />
                    {new Date(leave.startDate).toLocaleDateString()} -{" "}
                    {new Date(leave.endDate).toLocaleDateString()}
                  </div>

                  {leave.reason && (
                    <div
                      style={{
                        fontSize: 13,
                        color: tokens.colorNeutralForeground3,
                        marginBottom: 8,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {leave.reason}
                    </div>
                  )}

                  {(leave.status === "PENDING" ||
                    leave.status === "APPROVED") &&
                    activeTab === "my-leaves" && (
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<Dismiss24Regular />}
                        onClick={() =>
                          setCancelConfirm({
                            id: leave.id,
                            type: leave.leaveTypeConfig?.name || "Leave",
                          })
                        }
                        style={{ marginTop: 4 }}
                      >
                        Cancel Request
                      </Button>
                    )}
                  {leave.status === "PENDING" &&
                    activeTab === "pending-approval" && (
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <Button
                          appearance="primary"
                          size="small"
                          icon={<Checkmark24Regular />}
                          onClick={() =>
                            approveLeave.mutate({
                              id: leave.id,
                              approved: true,
                            })
                          }
                          style={{ flex: 1 }}
                        >
                          Approve
                        </Button>
                        <Button
                          appearance="secondary"
                          size="small"
                          icon={<Dismiss24Regular />}
                          onClick={() =>
                            approveLeave.mutate({
                              id: leave.id,
                              approved: false,
                            })
                          }
                          style={{ flex: 1 }}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                </Card>
              ))}
            </div>
          ) : (
            // Desktop Table View
            <Table>
              <TableHeader>
                <TableRow>
                  {activeTab !== "my-leaves" && (
                    <TableHeaderCell>Employee</TableHeaderCell>
                  )}
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Dates</TableHeaderCell>
                  <TableHeaderCell>Reason</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaves?.map((leave) => (
                  <TableRow key={leave.id}>
                    {activeTab !== "my-leaves" && (
                      <TableCell>
                        {leave.employee.user.name || leave.employee.user.email}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge
                        appearance="outline"
                        style={{
                          borderColor:
                            leave.leaveTypeConfig?.color || undefined,
                          color: leave.leaveTypeConfig?.color || undefined,
                        }}
                      >
                        {leave.leaveTypeConfig?.name || "Unknown"}
                      </Badge>
                      {leave.isHalfDay && (
                        <Badge
                          appearance="tint"
                          color="informative"
                          style={{ marginLeft: 4 }}
                        >
                          Half Day
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(leave.startDate).toLocaleDateString()} -{" "}
                      {new Date(leave.endDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell
                      style={{
                        maxWidth: 200,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {leave.reason}
                    </TableCell>
                    <TableCell>{getStatusBadge(leave.status)}</TableCell>
                    <TableCell>
                      {(leave.status === "PENDING" ||
                        leave.status === "APPROVED") &&
                        activeTab === "my-leaves" && (
                          <Button
                            appearance="subtle"
                            size="small"
                            icon={<Dismiss24Regular />}
                            onClick={() =>
                              setCancelConfirm({
                                id: leave.id,
                                type: leave.leaveTypeConfig?.name || "Leave",
                              })
                            }
                          >
                            Cancel
                          </Button>
                        )}
                      {leave.status === "PENDING" &&
                        activeTab === "pending-approval" && (
                          <div style={{ display: "flex", gap: 4 }}>
                            <Button
                              appearance="subtle"
                              size="small"
                              icon={<Checkmark24Regular />}
                              onClick={() =>
                                approveLeave.mutate({
                                  id: leave.id,
                                  approved: true,
                                })
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              appearance="subtle"
                              size="small"
                              icon={<Dismiss24Regular />}
                              onClick={() =>
                                approveLeave.mutate({
                                  id: leave.id,
                                  approved: false,
                                })
                              }
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}

        {activeTab !== "leave-types" &&
          activeTab !== "employee-balances" &&
          !(activeTab === "all" && allLeavesViewMode === "calendar") &&
          !(
            activeTab === "pending-approval" && pendingViewMode === "calendar"
          ) &&
          leaves?.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: tokens.colorNeutralForeground3,
              }}
            >
              No leave requests found
            </div>
          )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog
        open={!!cancelConfirm}
        onOpenChange={(_, d) => !d.open && setCancelConfirm(null)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Cancel Leave Request</DialogTitle>
            <DialogContent>
              Are you sure you want to cancel this {cancelConfirm?.type}{" "}
              request? This action cannot be undone.
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setCancelConfirm(null)}
              >
                No, Keep It
              </Button>
              <Button
                appearance="primary"
                onClick={handleCancelLeave}
                disabled={cancelLeave.isPending}
                style={{ backgroundColor: tokens.colorPaletteRedBackground3 }}
              >
                {cancelLeave.isPending ? "Cancelling..." : "Yes, Cancel Leave"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

// Leave Calendar View Component
function LeaveCalendarView({
  isMobile,
  teamOnly = false,
}: {
  isMobile: boolean;
  teamOnly?: boolean;
}) {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [employees, setEmployees] = useState<
    Array<{
      id: string;
      fullName: string | null;
      avatar: string | null;
      user: { name: string | null; email: string; image: string | null };
    }>
  >([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [selectedLeave, setSelectedLeave] = useState<{
    id: string;
    employeeId: string;
    employeeName: string;
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
    reason?: string;
  } | null>(null);

  const userRole = (user as { role?: string } | undefined)?.role;
  const canApprove =
    userRole === "MANAGEMENT" ||
    userRole === "HR" ||
    userRole === "ADMIN" ||
    userRole === "DEVELOPER";

  const approveLeave = useApproveLeave();
  const cancelLeave = useCancelLeave();

  // Fetch employees (all or team only based on prop)
  useMemo(() => {
    const fetchEmployees = async () => {
      try {
        if (teamOnly) {
          // Fetch only team members (employees managed by current user)
          const { data, error } = await api.api.employees["my-team"].get();
          if (error) throw error;
          setEmployees(
            (data as Array<{
              id: string;
              fullName: string | null;
              avatar: string | null;
              user: {
                name: string | null;
                email: string;
                image: string | null;
              };
            }>) || [],
          );
        } else {
          // Fetch all employees
          const { data, error } = await api.api.employees.get();
          if (error) throw error;
          setEmployees(
            (data as Array<{
              id: string;
              fullName: string | null;
              avatar: string | null;
              user: {
                name: string | null;
                email: string;
                image: string | null;
              };
            }>) || [],
          );
        }
      } catch (e) {
        console.error("Failed to fetch employees:", e);
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, [teamOnly]);

  // Calculate month date range
  const { startDateISO, endDateISO, daysInMonth } = useMemo(() => {
    const start = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1,
    );
    const end = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0,
      23,
      59,
      59,
    );
    const days: Date[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    return {
      startDateISO: start.toISOString(),
      endDateISO: end.toISOString(),
      daysInMonth: days,
    };
  }, [currentMonth]);

  // Fetch all leaves for the month - use standard query so it gets invalidated properly
  const { data: leavesData, isLoading: loadingLeaves } = useQuery(
    leaveQueries.all("all"),
  );
  const allLeaves = leavesData as
    | Array<{
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
        halfDayType: "morning" | "afternoon" | null;
        reason: string;
      }>
    | undefined;

  // Fetch holidays for the month
  const { data: holidaysData } = useQuery(
    calendarQueries.holidays(startDateISO, endDateISO),
  );

  // Helper to format date as YYYY-MM-DD in local timezone
  const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Build holiday map (date -> holiday)
  const holidayMap = useMemo(() => {
    const map: Record<string, Holiday> = {};
    if (!holidaysData?.holidays) return map;

    holidaysData.holidays.forEach((holiday) => {
      const holidayStart = new Date(holiday.start);
      const holidayEnd = new Date(holiday.end);

      for (
        let d = new Date(holidayStart);
        d <= holidayEnd;
        d.setDate(d.getDate() + 1)
      ) {
        const dateKey = formatDateKey(d);
        map[dateKey] = holiday;
      }
    });

    return map;
  }, [holidaysData]);

  // Filter leaves for the current month and approved/pending status
  const monthLeaves = useMemo(() => {
    if (!allLeaves) return [];
    return allLeaves.filter((leave) => {
      if (leave.status !== "APPROVED" && leave.status !== "PENDING")
        return false;
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);
      const monthStart = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        1,
      );
      const monthEnd = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        0,
      );
      return leaveStart <= monthEnd && leaveEnd >= monthStart;
    });
  }, [allLeaves, currentMonth]);

  // Build a map of employee -> date -> leaves
  const leaveMap = useMemo(() => {
    const map: Record<string, Record<string, typeof monthLeaves>> = {};

    monthLeaves.forEach((leave) => {
      if (!map[leave.employeeId]) {
        map[leave.employeeId] = {};
      }

      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);

      for (
        let d = new Date(leaveStart);
        d <= leaveEnd;
        d.setDate(d.getDate() + 1)
      ) {
        const dateKey = formatDateKey(d);
        if (!map[leave.employeeId][dateKey]) {
          map[leave.employeeId][dateKey] = [];
        }
        map[leave.employeeId][dateKey].push(leave);
      }
    });

    return map;
  }, [monthLeaves]);

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + (direction === "next" ? 1 : -1));
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const getEmployeeName = (emp: {
    fullName: string | null;
    user: { name: string | null; email: string };
  }) => {
    return emp.fullName || emp.user.name || emp.user.email;
  };

  if (loadingEmployees || loadingLeaves) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spinner size="large" label="Loading calendar..." />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 12,
      }}
    >
      {/* Month Navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            appearance="subtle"
            icon={<ChevronLeft24Regular />}
            onClick={() => navigateMonth("prev")}
          />
          <Button appearance="outline" onClick={goToToday}>
            Today
          </Button>
          <Button
            appearance="subtle"
            icon={<ChevronRight24Regular />}
            onClick={() => navigateMonth("next")}
          />
          <span style={{ fontWeight: 600, marginLeft: 8 }}>
            {currentMonth.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
        <div style={{ fontSize: 12, color: tokens.colorNeutralForeground3 }}>
          {employees.length} employees
        </div>
      </div>

      {/* Calendar Grid */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          border: `1px solid ${tokens.colorNeutralStroke1}`,
          borderRadius: 8,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile
              ? `120px repeat(${daysInMonth.length}, 40px)`
              : `180px repeat(${daysInMonth.length}, minmax(28px, 1fr))`,
            minWidth: isMobile ? "fit-content" : undefined,
          }}
        >
          {/* Header Row - Days */}
          <div
            style={{
              position: "sticky",
              left: 0,
              top: 0,
              background: tokens.colorNeutralBackground3,
              padding: "8px 12px",
              fontWeight: 600,
              fontSize: 12,
              borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
              borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
              zIndex: 3,
            }}
          >
            Employee
          </div>
          {daysInMonth.map((day) => {
            const dateKey = formatDateKey(day);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            const isToday = day.toDateString() === new Date().toDateString();
            const holiday = holidayMap[dateKey];
            const isHoliday = !!holiday;

            return (
              <Tooltip
                key={dateKey}
                content={holiday?.summary || ""}
                relationship="label"
                visible={isHoliday ? undefined : false}
              >
                <div
                  style={{
                    position: "sticky",
                    top: 0,
                    background: isHoliday
                      ? tokens.colorPaletteRedBackground1
                      : isWeekend
                        ? tokens.colorNeutralBackground4
                        : tokens.colorNeutralBackground3,
                    padding: "4px 2px",
                    textAlign: "center",
                    fontSize: 11,
                    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
                    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
                    zIndex: 2,
                  }}
                >
                  <div
                    style={{
                      fontWeight: isToday ? 700 : 400,
                      color: isToday
                        ? tokens.colorBrandForeground1
                        : isHoliday
                          ? tokens.colorPaletteRedForeground1
                          : isWeekend
                            ? tokens.colorNeutralForeground4
                            : tokens.colorNeutralForeground1,
                    }}
                  >
                    {day.getDate()}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      color: isHoliday
                        ? tokens.colorPaletteRedForeground2
                        : tokens.colorNeutralForeground4,
                    }}
                  >
                    {day
                      .toLocaleDateString("en-US", { weekday: "short" })
                      .charAt(0)}
                  </div>
                </div>
              </Tooltip>
            );
          })}

          {/* Employee Rows */}
          {employees.map((emp) => (
            <>
              {/* Employee Name Cell */}
              <div
                key={`emp-${emp.id}`}
                style={{
                  position: "sticky",
                  left: 0,
                  background: tokens.colorNeutralBackground1,
                  padding: "6px 12px",
                  fontSize: 13,
                  borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                  borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  zIndex: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: tokens.colorNeutralBackground4,
                    backgroundImage:
                      emp.avatar || emp.user.image
                        ? `url(${emp.avatar || emp.user.image})`
                        : undefined,
                    backgroundSize: "cover",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {getEmployeeName(emp)}
                </span>
              </div>

              {/* Day Cells */}
              {daysInMonth.map((day) => {
                const dateKey = formatDateKey(day);
                const dayLeaves = leaveMap[emp.id]?.[dateKey] || [];
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const isToday =
                  day.toDateString() === new Date().toDateString();
                const isHoliday = !!holidayMap[dateKey];

                return (
                  <div
                    key={`${emp.id}-${dateKey}`}
                    style={{
                      background: isHoliday
                        ? tokens.colorPaletteRedBackground1
                        : isWeekend
                          ? tokens.colorNeutralBackground3
                          : tokens.colorNeutralBackground1,
                      borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                      borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
                      padding: 2,
                      minHeight: 32,
                      position: "relative",
                      outline: isToday
                        ? `2px solid ${tokens.colorBrandStroke1}`
                        : undefined,
                      outlineOffset: -2,
                    }}
                  >
                    {dayLeaves.length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 2,
                          display: "flex",
                          flexDirection: "column",
                          gap: 2,
                        }}
                      >
                        {dayLeaves.map((leave, idx) => {
                          const isPending = leave.status === "PENDING";
                          const isHalfDay = leave.isHalfDay;
                          const isMorning = leave.halfDayType === "morning";
                          const baseColor =
                            leave.leaveTypeConfig.color ||
                            tokens.colorPaletteBlueBorderActive;

                          const handleClick = () => {
                            setSelectedLeave({
                              ...leave,
                              employeeName: getEmployeeName(emp),
                            });
                          };

                          return (
                            <Tooltip
                              key={`${leave.id}-${idx}`}
                              content={`${leave.leaveTypeConfig.name}${isPending ? " (Pending)" : ""}${isHalfDay ? ` (${isMorning ? "Morning" : "Afternoon"})` : ""} - Click to view`}
                              relationship="label"
                            >
                              <div
                                onClick={handleClick}
                                style={{
                                  width: isHalfDay ? "50%" : "100%",
                                  marginLeft:
                                    isHalfDay && !isMorning ? "50%" : undefined,
                                  flex: 1,
                                  minHeight: 8,
                                  borderRadius: 2,
                                  background: isPending
                                    ? `repeating-linear-gradient(
                                        45deg,
                                        ${baseColor},
                                        ${baseColor} 2px,
                                        transparent 2px,
                                        transparent 4px
                                      )`
                                    : baseColor,
                                  border: isPending
                                    ? `1px solid ${baseColor}`
                                    : undefined,
                                  boxSizing: "border-box",
                                  cursor: "pointer",
                                }}
                              />
                            </Tooltip>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          padding: "8px 0",
          fontSize: 12,
        }}
      >
        {Array.from(
          new Set(monthLeaves.map((l) => JSON.stringify(l.leaveTypeConfig))),
        )
          .map((s) => JSON.parse(s) as { name: string; color: string | null })
          .map((lt) => (
            <div
              key={lt.name}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  background: lt.color || tokens.colorPaletteBlueBorderActive,
                }}
              />
              <span>{lt.name}</span>
            </div>
          ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: `repeating-linear-gradient(
                45deg,
                ${tokens.colorNeutralForeground3},
                ${tokens.colorNeutralForeground3} 2px,
                transparent 2px,
                transparent 4px
              )`,
              border: `1px solid ${tokens.colorNeutralForeground3}`,
            }}
          />
          <span style={{ color: tokens.colorNeutralForeground3 }}>
            Pending approval
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 6,
              height: 12,
              borderRadius: 2,
              background: tokens.colorNeutralForeground3,
            }}
          />
          <span style={{ color: tokens.colorNeutralForeground3 }}>
            Half day
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              background: tokens.colorPaletteRedBackground1,
              border: `1px solid ${tokens.colorPaletteRedBorder1}`,
            }}
          />
          <span style={{ color: tokens.colorNeutralForeground3 }}>Holiday</span>
        </div>
      </div>

      {/* Leave Details Dialog */}
      <Dialog
        open={!!selectedLeave}
        onOpenChange={(_, d) => !d.open && setSelectedLeave(null)}
      >
        <DialogSurface style={{ maxWidth: 400 }}>
          <DialogBody>
            <DialogTitle
              action={
                <Button
                  appearance="subtle"
                  icon={<Dismiss24Regular />}
                  onClick={() => setSelectedLeave(null)}
                />
              }
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background:
                      selectedLeave?.leaveTypeConfig.color ||
                      tokens.colorPaletteBlueBorderActive,
                  }}
                />
                {selectedLeave?.leaveTypeConfig.name}
                {selectedLeave?.isHalfDay && (
                  <Badge color="informative" size="small">
                    Half Day
                  </Badge>
                )}
              </div>
            </DialogTitle>
            <DialogContent>
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
                    Employee
                  </div>
                  <div style={{ fontWeight: 500 }}>
                    {selectedLeave?.employeeName}
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
                    Period
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <Calendar24Regular style={{ fontSize: 16 }} />
                    {selectedLeave &&
                      new Date(
                        selectedLeave.startDate,
                      ).toLocaleDateString()}{" "}
                    -{" "}
                    {selectedLeave &&
                      new Date(selectedLeave.endDate).toLocaleDateString()}
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
                    Status
                  </div>
                  <Badge
                    color={
                      selectedLeave?.status === "APPROVED"
                        ? "success"
                        : selectedLeave?.status === "PENDING"
                          ? "warning"
                          : "informative"
                    }
                  >
                    {selectedLeave?.status}
                  </Badge>
                </div>

                {selectedLeave?.reason && (
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: tokens.colorNeutralForeground3,
                        marginBottom: 4,
                      }}
                    >
                      Reason
                    </div>
                    <div
                      style={{
                        padding: 8,
                        background: tokens.colorNeutralBackground3,
                        borderRadius: 4,
                        fontSize: 13,
                      }}
                    >
                      {selectedLeave.reason}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
            {((selectedLeave?.status === "PENDING" && canApprove) ||
              ((selectedLeave?.status === "PENDING" ||
                selectedLeave?.status === "APPROVED") &&
                canApprove)) && (
              <DialogActions style={{ gap: 8, justifyContent: "flex-end" }}>
                {selectedLeave?.status === "PENDING" && canApprove && (
                  <>
                    <Button
                      appearance="primary"
                      icon={<Checkmark24Regular />}
                      onClick={() => {
                        if (selectedLeave) {
                          approveLeave.mutate(
                            { id: selectedLeave.id, approved: true },
                            {
                              onSuccess: () => setSelectedLeave(null),
                              onError: (err) => {
                                console.error("Approve error:", err);
                                alert(
                                  `Failed to approve: ${err instanceof Error ? err.message : "Unknown error"}`,
                                );
                              },
                            },
                          );
                        }
                      }}
                      disabled={approveLeave.isPending}
                    >
                      Approve
                    </Button>
                    <Button
                      appearance="secondary"
                      icon={<Dismiss24Regular />}
                      onClick={() => {
                        if (selectedLeave) {
                          approveLeave.mutate(
                            { id: selectedLeave.id, approved: false },
                            {
                              onSuccess: () => setSelectedLeave(null),
                              onError: (err) => {
                                console.error("Reject error:", err);
                                alert(
                                  `Failed to reject: ${err instanceof Error ? err.message : "Unknown error"}`,
                                );
                              },
                            },
                          );
                        }
                      }}
                      disabled={approveLeave.isPending}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {(selectedLeave?.status === "PENDING" ||
                  selectedLeave?.status === "APPROVED") &&
                  canApprove && (
                    <Button
                      appearance="subtle"
                      icon={<Delete24Regular />}
                      onClick={() => {
                        if (selectedLeave) {
                          cancelLeave.mutate(selectedLeave.id, {
                            onSuccess: () => setSelectedLeave(null),
                          });
                        }
                      }}
                      disabled={cancelLeave.isPending}
                      style={{ color: tokens.colorPaletteRedForeground1 }}
                    >
                      Cancel
                    </Button>
                  )}
              </DialogActions>
            )}
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

// Leave Types Management Component
function LeaveTypesManagement({
  leaveTypes,
  onEdit,
  onAdd,
  showDialog,
  editingType,
  onCloseDialog,
  isMobile,
}: {
  leaveTypes: LeaveTypeConfig[];
  onBack: () => void;
  onEdit: (lt: LeaveTypeConfig) => void;
  onAdd: () => void;
  showDialog: boolean;
  editingType: LeaveTypeConfig | null;
  onCloseDialog: () => void;
  isMobile: boolean;
}) {
  const createLeaveType = useCreateLeaveType();
  const updateLeaveType = useUpdateLeaveType();
  const deleteLeaveType = useDeleteLeaveType();
  const seedLeaveTypes = useSeedLeaveTypes();

  const [typeForm, setTypeForm] = useState({
    name: "",
    code: "",
    description: "",
    defaultBalance: 0,
    isUnlimited: false,
    isPaid: true,
    allowHalfDay: true,
    allowCarryover: false,
    carryoverMax: 0,
    requiresApproval: true,
    requiredWorkDays: null as number | null,
    allowedGender: null as Gender,
    color: "#0078d4",
    isActive: true,
  });

  // Reset form when dialog opens
  useMemo(() => {
    if (showDialog) {
      if (editingType) {
        setTypeForm({
          name: editingType.name,
          code: editingType.code,
          description: editingType.description || "",
          defaultBalance: editingType.defaultBalance,
          isUnlimited: editingType.isUnlimited,
          isPaid: editingType.isPaid,
          allowHalfDay: editingType.allowHalfDay,
          allowCarryover: editingType.allowCarryover,
          carryoverMax: editingType.carryoverMax,
          requiresApproval: editingType.requiresApproval,
          requiredWorkDays: editingType.requiredWorkDays,
          allowedGender: editingType.allowedGender,
          color: editingType.color || "#0078d4",
          isActive: editingType.isActive,
        });
      } else {
        setTypeForm({
          name: "",
          code: "",
          description: "",
          defaultBalance: 0,
          isUnlimited: false,
          isPaid: true,
          allowHalfDay: true,
          allowCarryover: false,
          carryoverMax: 0,
          requiresApproval: true,
          requiredWorkDays: null,
          allowedGender: null,
          color: "#0078d4",
          isActive: true,
        });
      }
    }
  }, [showDialog, editingType]);

  const handleSave = async () => {
    if (editingType) {
      await updateLeaveType.mutateAsync({
        id: editingType.id,
        ...typeForm,
        description: typeForm.description || null,
      });
    } else {
      await createLeaveType.mutateAsync(typeForm);
    }
    onCloseDialog();
  };

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);

  const handleDelete = async () => {
    if (deleteConfirm) {
      await deleteLeaveType.mutateAsync(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const handleSeed = async () => {
    await seedLeaveTypes.mutateAsync();
    setShowSeedConfirm(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, fontWeight: 600 }}>
          Leave Types Configuration
        </h3>
        <div style={{ display: "flex", gap: 8 }}>
          {leaveTypes.length === 0 && (
            <Button
              appearance="secondary"
              onClick={() => setShowSeedConfirm(true)}
              disabled={seedLeaveTypes.isPending}
            >
              {seedLeaveTypes.isPending ? "Seeding..." : "Seed Defaults"}
            </Button>
          )}
          <Button appearance="primary" icon={<Add24Regular />} onClick={onAdd}>
            Add Leave Type
          </Button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Default Balance</TableHeaderCell>
              <TableHeaderCell>Options</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveTypes.map((lt) => (
              <TableRow key={lt.id}>
                <TableCell>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    {lt.color && (
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 2,
                          background: lt.color,
                        }}
                      />
                    )}
                    {lt.name}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge appearance="outline">{lt.code}</Badge>
                </TableCell>
                <TableCell>
                  {lt.isUnlimited ? (
                    <Badge color="informative">Unlimited</Badge>
                  ) : (
                    `${lt.defaultBalance} days`
                  )}
                </TableCell>
                <TableCell>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {lt.isPaid && (
                      <Badge color="success" size="small">
                        Paid
                      </Badge>
                    )}
                    {lt.allowHalfDay && (
                      <Badge color="informative" size="small">
                        Half-day
                      </Badge>
                    )}
                    {lt.allowCarryover && (
                      <Badge color="warning" size="small">
                        Carryover
                      </Badge>
                    )}
                    {lt.requiredWorkDays && (
                      <Badge color="severe" size="small">
                        {lt.requiredWorkDays}d min
                      </Badge>
                    )}
                    {lt.allowedGender && (
                      <Badge color="brand" size="small">
                        {lt.allowedGender === "MALE"
                          ? "Male"
                          : lt.allowedGender === "FEMALE"
                            ? "Female"
                            : "Other"}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge color={lt.isActive ? "success" : "danger"}>
                    {lt.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Tooltip content="Edit" relationship="label">
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<Edit24Regular />}
                        onClick={() => onEdit(lt)}
                      />
                    </Tooltip>
                    <Tooltip content="Delete" relationship="label">
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<Delete24Regular />}
                        onClick={() => setDeleteConfirm(lt.id)}
                      />
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {leaveTypes.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: tokens.colorNeutralForeground3,
            }}
          >
            No leave types configured. Click "Seed Defaults" to create standard
            leave types.
          </div>
        )}
      </div>

      {/* Leave Type Dialog */}
      <Dialog
        open={showDialog}
        onOpenChange={(_, d) => !d.open && onCloseDialog()}
      >
        <DialogSurface style={{ maxWidth: 500 }}>
          <DialogBody>
            <DialogTitle>
              {editingType ? "Edit Leave Type" : "Add Leave Type"}
            </DialogTitle>
            <DialogContent>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <Field label="Name" required>
                    <Input
                      value={typeForm.name}
                      onChange={(_, d) =>
                        setTypeForm((f) => ({ ...f, name: d.value }))
                      }
                      placeholder="e.g., Annual Leave"
                    />
                  </Field>
                  <Field label="Code" required>
                    <Input
                      value={typeForm.code}
                      onChange={(_, d) =>
                        setTypeForm((f) => ({
                          ...f,
                          code: d.value.toUpperCase(),
                        }))
                      }
                      placeholder="e.g., ANNUAL"
                      disabled={!!editingType}
                    />
                  </Field>
                </div>

                <Field label="Description">
                  <Textarea
                    value={typeForm.description}
                    onChange={(_, d) =>
                      setTypeForm((f) => ({ ...f, description: d.value }))
                    }
                    placeholder="Optional description..."
                    rows={2}
                  />
                </Field>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <Field label="Default Balance (days)">
                    <Input
                      type="number"
                      value={typeForm.defaultBalance.toString()}
                      onChange={(_, d) =>
                        setTypeForm((f) => ({
                          ...f,
                          defaultBalance: parseInt(d.value) || 0,
                        }))
                      }
                      disabled={typeForm.isUnlimited}
                    />
                  </Field>
                  <Field label="Color">
                    <input
                      type="color"
                      value={typeForm.color}
                      onChange={(e) =>
                        setTypeForm((f) => ({ ...f, color: e.target.value }))
                      }
                      style={{
                        width: "100%",
                        height: 32,
                        padding: 2,
                        border: `1px solid ${tokens.colorNeutralStroke1}`,
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    />
                  </Field>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <Switch
                    checked={typeForm.isUnlimited}
                    onChange={(_, d) =>
                      setTypeForm((f) => ({ ...f, isUnlimited: d.checked }))
                    }
                    label="Unlimited (no balance tracking)"
                  />
                  <Switch
                    checked={typeForm.isPaid}
                    onChange={(_, d) =>
                      setTypeForm((f) => ({ ...f, isPaid: d.checked }))
                    }
                    label="Paid leave"
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <Switch
                    checked={typeForm.allowHalfDay}
                    onChange={(_, d) =>
                      setTypeForm((f) => ({ ...f, allowHalfDay: d.checked }))
                    }
                    label="Allow half-day requests"
                  />
                  <Switch
                    checked={typeForm.requiresApproval}
                    onChange={(_, d) =>
                      setTypeForm((f) => ({
                        ...f,
                        requiresApproval: d.checked,
                      }))
                    }
                    label="Requires manager approval"
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <Field
                    label="Required Work Days"
                    hint="Minimum days employee must work before using this leave type"
                  >
                    <Input
                      type="number"
                      value={typeForm.requiredWorkDays?.toString() || ""}
                      onChange={(_, d) =>
                        setTypeForm((f) => ({
                          ...f,
                          requiredWorkDays: d.value ? parseInt(d.value) : null,
                        }))
                      }
                      placeholder="e.g., 60"
                    />
                  </Field>
                  <Field
                    label="Allowed Gender"
                    hint="Leave empty to allow all genders"
                  >
                    <Select
                      value={typeForm.allowedGender || ""}
                      onChange={(_, d) =>
                        setTypeForm((f) => ({
                          ...f,
                          allowedGender: (d.value as Gender) || null,
                        }))
                      }
                    >
                      <option value="">All Genders</option>
                      <option value="MALE">Male Only</option>
                      <option value="FEMALE">Female Only</option>
                      <option value="OTHER">Other Only</option>
                    </Select>
                  </Field>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <Switch
                    checked={typeForm.allowCarryover}
                    onChange={(_, d) =>
                      setTypeForm((f) => ({ ...f, allowCarryover: d.checked }))
                    }
                    label="Allow carryover to next year"
                  />
                  {typeForm.allowCarryover && (
                    <Field label="Max carryover days">
                      <Input
                        type="number"
                        value={typeForm.carryoverMax.toString()}
                        onChange={(_, d) =>
                          setTypeForm((f) => ({
                            ...f,
                            carryoverMax: parseInt(d.value) || 0,
                          }))
                        }
                      />
                    </Field>
                  )}
                </div>

                {editingType && (
                  <Switch
                    checked={typeForm.isActive}
                    onChange={(_, d) =>
                      setTypeForm((f) => ({ ...f, isActive: d.checked }))
                    }
                    label="Active"
                  />
                )}
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={onCloseDialog}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleSave}
                disabled={
                  !typeForm.name ||
                  !typeForm.code ||
                  createLeaveType.isPending ||
                  updateLeaveType.isPending
                }
              >
                {createLeaveType.isPending || updateLeaveType.isPending
                  ? "Saving..."
                  : "Save"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(_, d) => !d.open && setDeleteConfirm(null)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete Leave Type</DialogTitle>
            <DialogContent>
              Are you sure you want to delete this leave type? This action
              cannot be undone.
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleDelete}
                disabled={deleteLeaveType.isPending}
                style={{ backgroundColor: tokens.colorPaletteRedBackground3 }}
              >
                {deleteLeaveType.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Seed Confirmation Dialog */}
      <Dialog
        open={showSeedConfirm}
        onOpenChange={(_, d) => !d.open && setShowSeedConfirm(false)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Seed Default Leave Types</DialogTitle>
            <DialogContent>
              This will create default leave types (Annual, Sick, Personal,
              Birthday, Unpaid, Other). Continue?
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setShowSeedConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleSeed}
                disabled={seedLeaveTypes.isPending}
              >
                {seedLeaveTypes.isPending ? "Creating..." : "Create Defaults"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

// Employee Balances Management Component
function EmployeeBalancesManagement({
  selectedEmployee,
  onSelectEmployee,
  isMobile,
}: {
  leaveTypes: LeaveTypeConfig[];
  onBack: () => void;
  selectedEmployee: { id: string; name: string } | null;
  onSelectEmployee: (emp: { id: string; name: string } | null) => void;
  showDialog: boolean;
  onCloseDialog: () => void;
  onOpenDialog: () => void;
  isMobile: boolean;
}) {
  const [employees, setEmployees] = useState<
    Array<{
      id: string;
      fullName: string | null;
      user: { name: string | null; email: string };
    }>
  >([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [editingBalance, setEditingBalance] = useState<{
    leaveTypeId: string;
    balance: number;
    adjustment: number;
    notes: string;
  } | null>(null);

  const setEmployeeBalance = useSetEmployeeBalance();

  // Fetch employees
  useMemo(() => {
    const fetchEmployees = async () => {
      try {
        const { data, error } = await api.api.employees.get();
        if (error) throw error;
        setEmployees(
          (data as Array<{
            id: string;
            fullName: string | null;
            user: { name: string | null; email: string };
          }>) || [],
        );
      } catch (e) {
        console.error("Failed to fetch employees:", e);
      } finally {
        setLoadingEmployees(false);
      }
    };
    fetchEmployees();
  }, []);

  const { data: employeeBalances, isLoading: loadingBalances } = useQuery({
    ...leaveBalanceQueries.employee(selectedEmployee?.id || ""),
    enabled: !!selectedEmployee,
  });

  const handleSaveBalance = async () => {
    if (!selectedEmployee || !editingBalance) return;

    await setEmployeeBalance.mutateAsync({
      employeeId: selectedEmployee.id,
      leaveTypeId: editingBalance.leaveTypeId,
      balance: editingBalance.balance,
      adjustment: editingBalance.adjustment,
      notes: editingBalance.notes || null,
    });
    setEditingBalance(null);
  };

  if (loadingEmployees) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spinner size="large" label="Loading employees..." />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        gap: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, fontWeight: 600 }}>Employee Leave Balances</h3>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: 16,
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* Employee List */}
        <div
          style={{
            width: isMobile ? "100%" : 250,
            borderRight: isMobile
              ? "none"
              : `1px solid ${tokens.colorNeutralStroke1}`,
            borderBottom: isMobile
              ? `1px solid ${tokens.colorNeutralStroke1}`
              : "none",
            paddingRight: isMobile ? 0 : 16,
            paddingBottom: isMobile ? 16 : 0,
            overflow: "auto",
            maxHeight: isMobile ? 200 : "100%",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: tokens.colorNeutralForeground3,
              marginBottom: 8,
            }}
          >
            SELECT EMPLOYEE
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {employees.map((emp) => (
              <Button
                key={emp.id}
                appearance={
                  selectedEmployee?.id === emp.id ? "primary" : "subtle"
                }
                onClick={() =>
                  onSelectEmployee({
                    id: emp.id,
                    name: emp.fullName || emp.user.name || emp.user.email,
                  })
                }
                style={{
                  justifyContent: "flex-start",
                  textAlign: "left",
                }}
              >
                {emp.fullName || emp.user.name || emp.user.email}
              </Button>
            ))}
          </div>
        </div>

        {/* Balance Details */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {selectedEmployee ? (
            loadingBalances ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: 40,
                }}
              >
                <Spinner label="Loading balances..." />
              </div>
            ) : (
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    marginBottom: 16,
                  }}
                >
                  {selectedEmployee.name}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>Leave Type</TableHeaderCell>
                      <TableHeaderCell>Balance</TableHeaderCell>
                      <TableHeaderCell>Adjustment</TableHeaderCell>
                      <TableHeaderCell>Used</TableHeaderCell>
                      <TableHeaderCell>Remaining</TableHeaderCell>
                      <TableHeaderCell>Actions</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeBalances?.map((balance: LeaveBalance) => (
                      <TableRow key={balance.leaveType.id}>
                        <TableCell>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            {balance.leaveType.color && (
                              <div
                                style={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: 2,
                                  background: balance.leaveType.color,
                                }}
                              />
                            )}
                            {balance.leaveType.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {balance.leaveType.isUnlimited
                            ? "-"
                            : balance.balance}
                        </TableCell>
                        <TableCell>
                          {balance.leaveType.isUnlimited ? (
                            "-"
                          ) : balance.adjustment !== 0 ? (
                            <Badge
                              color={
                                balance.adjustment > 0 ? "success" : "danger"
                              }
                            >
                              {balance.adjustment > 0 ? "+" : ""}
                              {balance.adjustment}
                            </Badge>
                          ) : (
                            "0"
                          )}
                        </TableCell>
                        <TableCell>
                          {balance.leaveType.isUnlimited ? "-" : balance.used}
                        </TableCell>
                        <TableCell>
                          {balance.leaveType.isUnlimited ? (
                            <Badge color="informative">Unlimited</Badge>
                          ) : (
                            <span
                              style={{
                                color:
                                  (balance.remaining ?? 0) <= 0
                                    ? tokens.colorPaletteRedForeground1
                                    : undefined,
                              }}
                            >
                              {balance.remaining}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {!balance.leaveType.isUnlimited && (
                            <Button
                              appearance="subtle"
                              size="small"
                              icon={<Edit24Regular />}
                              onClick={() =>
                                setEditingBalance({
                                  leaveTypeId: balance.leaveType.id,
                                  balance: balance.balance,
                                  adjustment: balance.adjustment,
                                  notes: balance.notes || "",
                                })
                              }
                            >
                              Edit
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: tokens.colorNeutralForeground3,
              }}
            >
              Select an employee to view their leave balances
            </div>
          )}
        </div>
      </div>

      {/* Edit Balance Dialog */}
      <Dialog
        open={!!editingBalance}
        onOpenChange={(_, d) => !d.open && setEditingBalance(null)}
      >
        <DialogSurface style={{ maxWidth: 400 }}>
          <DialogBody>
            <DialogTitle>Edit Leave Balance</DialogTitle>
            <DialogContent>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <Field label="Base Balance (days)">
                  <Input
                    type="number"
                    value={editingBalance?.balance.toString() || "0"}
                    onChange={(_, d) =>
                      setEditingBalance((f) =>
                        f ? { ...f, balance: parseInt(d.value) || 0 } : null,
                      )
                    }
                  />
                </Field>
                <Field label="Adjustment (+/- days)">
                  <Input
                    type="number"
                    value={editingBalance?.adjustment.toString() || "0"}
                    onChange={(_, d) =>
                      setEditingBalance((f) =>
                        f ? { ...f, adjustment: parseInt(d.value) || 0 } : null,
                      )
                    }
                  />
                </Field>
                <Field label="Notes">
                  <Textarea
                    value={editingBalance?.notes || ""}
                    onChange={(_, d) =>
                      setEditingBalance((f) =>
                        f ? { ...f, notes: d.value } : null,
                      )
                    }
                    placeholder="Optional notes..."
                    rows={2}
                  />
                </Field>
              </div>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setEditingBalance(null)}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleSaveBalance}
                disabled={setEmployeeBalance.isPending}
              >
                {setEmployeeBalance.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
