import { useState, useMemo } from "react";
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
  Edit24Regular,
  Delete24Regular,
  Settings24Regular,
  People24Regular,
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
} from "@/api/queries/leave-types";
import {
  leaveBalanceQueries,
  useSetEmployeeBalance,
  type LeaveBalance,
} from "@/api/queries/leave-balances";
import { logAction } from "@/api/queries/audit";
import { useAuth } from "@/auth/provider";
import { useWindowRefresh } from "@/components/desktop/WindowContext";
import { useMobile } from "@/hooks/useMobile";
import { api } from "@/api/client";

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
  const { user } = useAuth();
  const isMobile = useMobile();

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    logAction(
      "switch_tab",
      "navigation",
      `Switched to ${tab} tab in Leave Management`,
      { tab },
    );
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
  const isManager = userRole === "MANAGEMENT" || userRole === "DEVELOPER";
  const isHR = userRole === "HR" || userRole === "DEVELOPER";

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
  const { data: myBalances } = useQuery(leaveBalanceQueries.my());

  const createLeave = useCreateLeave();
  const approveLeave = useApproveLeave();
  const cancelLeave = useCancelLeave();

  const [form, setForm] = useState({
    type: "" as string,
    reason: "",
    startDate: "",
    endDate: "",
    isHalfDay: false,
    halfDayType: "morning" as const,
  });

  // Get active leave types for the form
  const activeLeaveTypes = useMemo(
    () => leaveTypes?.filter((lt) => lt.isActive) || [],
    [leaveTypes],
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
      {/* Leave Balance Cards - Now dynamic */}
      {myBalances && myBalances.length > 0 && (
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

        {activeTab !== "leave-types" && activeTab !== "employee-balances" && (
          <Button
            appearance="primary"
            icon={<Add24Regular />}
            onClick={handleOpenCreateForm}
          >
            Request Leave
          </Button>
        )}
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
            onSelectEmployee={setSelectedEmployee}
            showDialog={showBalanceDialog}
            onCloseDialog={() => setShowBalanceDialog(false)}
            onOpenDialog={() => setShowBalanceDialog(true)}
            isMobile={isMobile}
          />
        )}

        {/* Leave Requests List */}
        {activeTab !== "leave-types" &&
          activeTab !== "employee-balances" &&
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

                  {leave.status === "PENDING" && activeTab === "my-leaves" && (
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Dismiss24Regular />}
                      onClick={() => cancelLeave.mutate(leave.id)}
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
                      {leave.status === "PENDING" &&
                        activeTab === "my-leaves" && (
                          <Button
                            appearance="subtle"
                            size="small"
                            icon={<Dismiss24Regular />}
                            onClick={() => cancelLeave.mutate(leave.id)}
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

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to deactivate this leave type?")) {
      await deleteLeaveType.mutateAsync(id);
    }
  };

  const handleSeed = async () => {
    if (
      confirm(
        "This will create default leave types (Annual, Sick, Personal, Birthday, Unpaid, Other). Continue?",
      )
    ) {
      await seedLeaveTypes.mutateAsync();
    }
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
              onClick={handleSeed}
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
                    {lt.isActive && (
                      <Tooltip content="Deactivate" relationship="label">
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<Delete24Regular />}
                          onClick={() => handleDelete(lt.id)}
                        />
                      </Tooltip>
                    )}
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
