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
} from "@fluentui/react-components";
import {
  Add24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  ArrowLeft24Regular,
  Calendar24Regular,
} from "@fluentui/react-icons";
import {
  leaveQueries,
  useCreateLeave,
  useApproveLeave,
  useCancelLeave,
} from "@/api/queries/leaves";
import { logAction } from "@/api/queries/audit";
import { useAuth } from "@/auth/provider";
import { useWindowRefresh } from "@/components/desktop/WindowContext";
import { useMobile } from "@/hooks/useMobile";

export default function LeaveManagement() {
  const [activeTab, setActiveTab] = useState<string>("my-leaves");
  const [showCreateForm, setShowCreateForm] = useState(false);
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
  const queryKeys = useMemo(() => [["leaves"]], []);
  useWindowRefresh(queryKeys);

  const { data: leavesData, isLoading } = useQuery(leaveQueries.all(view));
  const leaves = leavesData as
    | Array<{
        id: string;
        type: string;
        reason: string;
        startDate: string;
        endDate: string;
        status: string;
        isHalfDay: boolean;
        employee: { user: { name: string | null; email: string } };
      }>
    | undefined;
  const { data: balance } = useQuery(leaveQueries.balance);

  const createLeave = useCreateLeave();
  const approveLeave = useApproveLeave();
  const cancelLeave = useCancelLeave();

  const [form, setForm] = useState({
    type: "ANNUAL" as const,
    reason: "",
    startDate: "",
    endDate: "",
    isHalfDay: false,
    halfDayType: "morning" as const,
  });

  const handleCreate = async () => {
    await createLeave.mutateAsync({
      ...form,
      halfDayType: form.isHalfDay ? form.halfDayType : undefined,
    });
    setShowCreateForm(false);
    setForm({
      type: "ANNUAL",
      reason: "",
      startDate: "",
      endDate: "",
      isHalfDay: false,
      halfDayType: "morning",
    });
  };

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

  if (isLoading) {
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
                    type: d.value as typeof form.type,
                  }))
                }
              >
                <option value="PERSONAL">Personal</option>
                <option value="ANNUAL">Annual</option>
                <option value="SICK">Sick</option>
                <option value="BIRTHDAY">Birthday</option>
                <option value="UNPAID">Unpaid</option>
                <option value="OTHER">Other</option>
              </Select>
            </Field>
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
      {/* Leave Balance Cards */}
      {balance && (
        <div
          style={{ display: "flex", gap: isMobile ? 8 : 12, flexWrap: "wrap" }}
        >
          <Card
            size="small"
            style={{
              flex: "1 1 auto",
              minWidth: isMobile ? "calc(50% - 4px)" : 120,
            }}
          >
            <CardHeader
              header={
                <span style={{ fontWeight: 600, fontSize: isMobile ? 12 : 14 }}>
                  Personal
                </span>
              }
              description={`${balance.personal?.remaining ?? 0} / ${balance.personal?.max ?? 0}`}
            />
          </Card>
          <Card
            size="small"
            style={{
              flex: "1 1 auto",
              minWidth: isMobile ? "calc(50% - 4px)" : 120,
            }}
          >
            <CardHeader
              header={
                <span style={{ fontWeight: 600, fontSize: isMobile ? 12 : 14 }}>
                  Annual
                </span>
              }
              description={`${balance.annual?.remaining ?? 0} / ${balance.annual?.max ?? 0}`}
            />
          </Card>
          <Card
            size="small"
            style={{
              flex: "1 1 auto",
              minWidth: isMobile ? "calc(50% - 4px)" : 120,
            }}
          >
            <CardHeader
              header={
                <span style={{ fontWeight: 600, fontSize: isMobile ? 12 : 14 }}>
                  Sick
                </span>
              }
              description={`${balance.sick?.remaining ?? 0} / ${balance.sick?.max ?? 0}`}
            />
          </Card>
          <Card
            size="small"
            style={{
              flex: "1 1 auto",
              minWidth: isMobile ? "calc(50% - 4px)" : 120,
            }}
          >
            <CardHeader
              header={
                <span style={{ fontWeight: 600, fontSize: isMobile ? 12 : 14 }}>
                  Birthday
                </span>
              }
              description={`${balance.birthday?.remaining ?? 1} / ${balance.birthday?.max ?? 1}`}
            />
          </Card>
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
        </TabList>

        <Button
          appearance="primary"
          icon={<Add24Regular />}
          onClick={handleOpenCreateForm}
        >
          Request Leave
        </Button>
      </div>

      {/* Leave Table (Desktop) / Cards (Mobile) */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {isMobile ? (
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
                    <Badge appearance="outline">{leave.type}</Badge>
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
                          approveLeave.mutate({ id: leave.id, approved: true })
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
                          approveLeave.mutate({ id: leave.id, approved: false })
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
                    <Badge appearance="outline">{leave.type}</Badge>
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
        )}

        {leaves?.length === 0 && (
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
