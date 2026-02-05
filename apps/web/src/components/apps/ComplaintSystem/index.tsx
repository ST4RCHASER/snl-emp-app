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
  tokens,
  Switch,
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Card,
} from "@fluentui/react-components";
import {
  Add24Regular,
  Chat24Regular,
  ArrowLeft24Regular,
  Eye24Regular,
  Checkmark24Regular,
  Calendar24Regular,
} from "@fluentui/react-icons";
import {
  complaintQueries,
  useCreateComplaint,
  useUpdateComplaintResponse,
  useUpdateComplaintStatus,
  type ComplaintStatus,
} from "@/api/queries/complaints";
import { logAction } from "@/api/queries/audit";
import { settingsQueries } from "@/api/queries/settings";
import { useAuth } from "@/auth/provider";
import { useWindowRefresh } from "@/components/desktop/WindowContext";
import { useWindowStore } from "@/stores/windowStore";
import { getAppById } from "../registry";
import { useMobile } from "@/hooks/useMobile";

type ViewMode = "list" | "create";

interface ComplaintData {
  id: string;
  subject: string;
  description: string;
  status: string;
  isAnonymous?: boolean;
  hrResponse?: string | null;
  createdAt: string;
  employee?: {
    fullName?: string | null;
    nickname?: string | null;
    user?: { name?: string | null; email?: string };
  };
}

export default function ComplaintSystem() {
  // All hooks must be called unconditionally at the top
  const [activeTab, setActiveTab] = useState<string>("my-complaints");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedComplaint, setSelectedComplaint] =
    useState<ComplaintData | null>(null);
  const [form, setForm] = useState({
    subject: "",
    description: "",
    isAnonymous: true,
  });

  const { user } = useAuth();
  const openWindow = useWindowStore((s) => s.openWindow);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    logAction(
      "switch_tab",
      "navigation",
      `Switched to ${tab} tab in Complaints`,
      { tab },
    );
  };

  const handleOpenCreateForm = () => {
    setViewMode("create");
    logAction(
      "open_complaint_form",
      "navigation",
      "Opened create complaint form",
    );
  };

  const handleViewComplaint = (complaint: ComplaintData) => {
    setSelectedComplaint(complaint);
    logAction("view_complaint", "navigation", "Viewed complaint details", {
      complaintId: complaint.id,
    });
  };
  const isMobile = useMobile();

  const userRole = (user as { role?: string } | undefined)?.role;
  const isHR =
    userRole === "HR" || userRole === "ADMIN" || userRole === "DEVELOPER";

  // Refresh data when window refresh button is clicked
  const queryKeys = useMemo(() => [["complaints"], ["settings"]], []);
  useWindowRefresh(queryKeys);

  // Fetch settings to check if chat is enabled - must be before complaints query
  const { data: settings } = useQuery(settingsQueries.global);
  const chatEnabled =
    (settings as { complaintChatEnabled?: boolean })?.complaintChatEnabled ??
    true;

  const view = activeTab === "all" ? "all" : undefined;
  const { data: complaintsData, isLoading } = useQuery(
    complaintQueries.all(view),
  );
  const complaints = complaintsData as ComplaintData[] | undefined;

  const createComplaint = useCreateComplaint();
  const updateResponse = useUpdateComplaintResponse();
  const updateStatus = useUpdateComplaintStatus();

  const handleCreate = async () => {
    await createComplaint.mutateAsync(form);
    setViewMode("list");
    setForm({ subject: "", description: "", isAnonymous: true });
  };

  const handleOpenChat = (complaintId: string, subject: string) => {
    const chatApp = getAppById("complaint-chat");
    if (chatApp) {
      openWindow(
        `complaint-chat-${complaintId}`,
        `Chat: ${subject.slice(0, 30)}${subject.length > 30 ? "..." : ""}`,
        chatApp.defaultSize,
        { complaintId, isHR: isHR && activeTab === "all" },
      );
    }
  };

  const getStatusBadge = (status: string) => {
    const colorMap: Record<string, "informative" | "warning" | "success"> = {
      BACKLOG: "informative",
      IN_PROGRESS: "warning",
      DONE: "success",
    };
    return (
      <Badge color={colorMap[status] || "informative"}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spinner size="large" label="Loading..." />
      </div>
    );
  }

  // Create complaint form
  if (viewMode === "create") {
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
            onClick={() => setViewMode("list")}
          />
          <h3 style={{ margin: 0, fontWeight: 600 }}>Submit Complaint</h3>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              maxWidth: isMobile ? "100%" : 500,
            }}
          >
            <Field label="Subject">
              <Input
                value={form.subject}
                onChange={(_, d) =>
                  setForm((f) => ({ ...f, subject: d.value }))
                }
                placeholder="Brief summary of your complaint"
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={form.description}
                onChange={(_, d) =>
                  setForm((f) => ({ ...f, description: d.value }))
                }
                placeholder="Provide details about your complaint..."
                rows={6}
              />
            </Field>
            <Card style={{ padding: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    Submit Anonymously
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: tokens.colorNeutralForeground3,
                    }}
                  >
                    {form.isAnonymous
                      ? "Your identity will be hidden from HR"
                      : "HR will see your name and details"}
                  </div>
                </div>
                <Switch
                  checked={form.isAnonymous}
                  onChange={(_, d) =>
                    setForm((f) => ({ ...f, isAnonymous: d.checked }))
                  }
                />
              </div>
            </Card>
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
          <Button appearance="secondary" onClick={() => setViewMode("list")}>
            Cancel
          </Button>
          <Button
            appearance="primary"
            onClick={handleCreate}
            disabled={
              !form.subject || !form.description || createComplaint.isPending
            }
          >
            {createComplaint.isPending ? "Submitting..." : "Submit"}
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
          <Tab value="my-complaints">My Complaints</Tab>
          {isHR && <Tab value="all">All Complaints</Tab>}
        </TabList>

        <Button
          appearance="primary"
          icon={<Add24Regular />}
          onClick={handleOpenCreateForm}
        >
          Submit Complaint
        </Button>
      </div>

      {/* Complaints Table (Desktop) / Cards (Mobile) */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {isMobile ? (
          // Mobile Card View
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {complaints?.map((c) => {
              const getEmployeeName = (): React.ReactNode => {
                if (c.isAnonymous !== false) {
                  return (
                    <span style={{ fontStyle: "italic", opacity: 0.7 }}>
                      Anonymous
                    </span>
                  );
                }
                return (
                  c.employee?.nickname ||
                  c.employee?.fullName ||
                  c.employee?.user?.name ||
                  c.employee?.user?.email?.split("@")[0] ||
                  "Unknown"
                );
              };

              return (
                <Card key={c.id} style={{ padding: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 500, flex: 1, marginRight: 8 }}>
                      {c.subject}
                    </div>
                    {getStatusBadge(c.status)}
                  </div>

                  {activeTab === "all" && (
                    <div
                      style={{
                        fontSize: 12,
                        color: tokens.colorNeutralForeground2,
                        marginBottom: 4,
                      }}
                    >
                      {getEmployeeName()}
                    </div>
                  )}

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
                    {c.description}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: tokens.colorNeutralForeground3,
                      marginBottom: 8,
                    }}
                  >
                    <Calendar24Regular style={{ fontSize: 14 }} />
                    {new Date(c.createdAt).toLocaleDateString()}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <Button
                      appearance="secondary"
                      size="small"
                      icon={<Eye24Regular />}
                      onClick={() => handleViewComplaint(c)}
                      style={{ flex: 1 }}
                    >
                      View
                    </Button>
                    {chatEnabled && (
                      <Button
                        appearance="secondary"
                        size="small"
                        icon={<Chat24Regular />}
                        onClick={() => handleOpenChat(c.id, c.subject)}
                        style={{ flex: 1 }}
                      >
                        Chat
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          // Desktop Table View
          <Table>
            <TableHeader>
              <TableRow>
                {activeTab === "all" && (
                  <TableHeaderCell>Employee</TableHeaderCell>
                )}
                <TableHeaderCell>Subject</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Submitted</TableHeaderCell>
                <TableHeaderCell>Actions</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {complaints?.map((c) => {
                const getEmployeeName = (): React.ReactNode => {
                  if (c.isAnonymous !== false) {
                    return (
                      <span style={{ fontStyle: "italic", opacity: 0.7 }}>
                        Anonymous
                      </span>
                    );
                  }
                  return (
                    c.employee?.nickname ||
                    c.employee?.fullName ||
                    c.employee?.user?.name ||
                    c.employee?.user?.email?.split("@")[0] ||
                    "Unknown"
                  );
                };

                const employeeName = getEmployeeName();

                return (
                  <TableRow key={c.id}>
                    {activeTab === "all" && (
                      <TableCell>{employeeName}</TableCell>
                    )}
                    <TableCell>
                      <div style={{ fontWeight: 500 }}>{c.subject}</div>
                      <div
                        style={{
                          fontSize: 12,
                          color: tokens.colorNeutralForeground3,
                          maxWidth: 300,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.description}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(c.status)}</TableCell>
                    <TableCell>
                      {new Date(c.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div style={{ display: "flex", gap: 4 }}>
                        {/* View/Respond button - always show */}
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<Eye24Regular />}
                          onClick={() => handleViewComplaint(c)}
                        >
                          View
                        </Button>
                        {/* Chat button - only if chat is enabled */}
                        {chatEnabled && (
                          <Button
                            appearance="subtle"
                            size="small"
                            icon={<Chat24Regular />}
                            onClick={() => handleOpenChat(c.id, c.subject)}
                          >
                            Chat
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {complaints?.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: 40,
              color: tokens.colorNeutralForeground3,
            }}
          >
            No complaints found
          </div>
        )}
      </div>

      {/* Complaint Detail Dialog */}
      {selectedComplaint && (
        <ComplaintDetailDialog
          complaint={selectedComplaint}
          isHR={isHR && activeTab === "all"}
          chatEnabled={chatEnabled}
          isMobile={isMobile}
          onClose={() => setSelectedComplaint(null)}
          onOpenChat={handleOpenChat}
          onUpdateResponse={async (id, response) => {
            await updateResponse.mutateAsync({ id, response });
          }}
          onUpdateStatus={async (id, status) => {
            await updateStatus.mutateAsync({ id, status });
          }}
          isUpdating={updateResponse.isPending || updateStatus.isPending}
        />
      )}
    </div>
  );
}

// Complaint Detail Dialog component
function ComplaintDetailDialog({
  complaint,
  isHR,
  chatEnabled,
  isMobile,
  onClose,
  onOpenChat,
  onUpdateResponse,
  onUpdateStatus,
  isUpdating,
}: {
  complaint: ComplaintData;
  isHR: boolean;
  chatEnabled: boolean;
  isMobile: boolean;
  onClose: () => void;
  onOpenChat: (id: string, subject: string) => void;
  onUpdateResponse: (id: string, response: string) => Promise<void>;
  onUpdateStatus: (id: string, status: ComplaintStatus) => Promise<void>;
  isUpdating: boolean;
}) {
  const [response, setResponse] = useState(complaint.hrResponse || "");
  const [status, setStatus] = useState<ComplaintStatus>(
    complaint.status as ComplaintStatus,
  );

  const handleSaveResponse = async () => {
    await onUpdateResponse(complaint.id, response);
  };

  const handleUpdateStatus = async (newStatus: ComplaintStatus) => {
    setStatus(newStatus);
    await onUpdateStatus(complaint.id, newStatus);
  };

  return (
    <Dialog open onOpenChange={(_, d) => !d.open && onClose()}>
      <DialogSurface
        style={
          isMobile
            ? { maxWidth: "calc(100vw - 32px)", margin: 16 }
            : { maxWidth: 600 }
        }
      >
        <DialogBody>
          <DialogTitle>{complaint.subject}</DialogTitle>
          <DialogContent>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Status */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    color: tokens.colorNeutralForeground3,
                  }}
                >
                  Submitted:{" "}
                  {new Date(complaint.createdAt).toLocaleDateString()}
                </span>
                <Badge
                  color={
                    status === "DONE"
                      ? "success"
                      : status === "IN_PROGRESS"
                        ? "warning"
                        : "informative"
                  }
                >
                  {status.replace("_", " ")}
                </Badge>
              </div>

              {/* Description */}
              <Card style={{ padding: 16 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: tokens.colorNeutralForeground2,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {complaint.description}
                </div>
              </Card>

              {/* HR Response Section - only show if chat is disabled OR if there's already a response */}
              {(!chatEnabled || complaint.hrResponse) && (
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    HR Response
                    {complaint.hrResponse && (
                      <Checkmark24Regular
                        style={{ color: tokens.colorPaletteGreenForeground1 }}
                      />
                    )}
                  </div>
                  {isHR && !chatEnabled ? (
                    <Textarea
                      value={response}
                      onChange={(_, d) => setResponse(d.value)}
                      placeholder="Enter your response to this complaint..."
                      rows={4}
                      style={{ width: "100%" }}
                    />
                  ) : (
                    <Card
                      style={{
                        padding: 16,
                        background: tokens.colorNeutralBackground3,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          whiteSpace: "pre-wrap",
                          color: complaint.hrResponse
                            ? undefined
                            : tokens.colorNeutralForeground3,
                          fontStyle: complaint.hrResponse
                            ? undefined
                            : "italic",
                        }}
                      >
                        {complaint.hrResponse || "No response yet"}
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* Status Update - HR only */}
              {isHR && (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    Update Status
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: isMobile ? "wrap" : "nowrap",
                    }}
                  >
                    <Button
                      appearance={
                        status === "BACKLOG" ? "primary" : "secondary"
                      }
                      size="small"
                      onClick={() => handleUpdateStatus("BACKLOG")}
                      disabled={isUpdating}
                      style={isMobile ? { flex: "1 1 auto" } : undefined}
                    >
                      Backlog
                    </Button>
                    <Button
                      appearance={
                        status === "IN_PROGRESS" ? "primary" : "secondary"
                      }
                      size="small"
                      onClick={() => handleUpdateStatus("IN_PROGRESS")}
                      disabled={isUpdating}
                      style={isMobile ? { flex: "1 1 auto" } : undefined}
                    >
                      In Progress
                    </Button>
                    <Button
                      appearance={status === "DONE" ? "primary" : "secondary"}
                      size="small"
                      onClick={() => handleUpdateStatus("DONE")}
                      disabled={isUpdating}
                      style={isMobile ? { flex: "1 1 auto" } : undefined}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
          <DialogActions
            style={isMobile ? { flexDirection: "column", gap: 8 } : undefined}
          >
            {chatEnabled && (
              <Button
                appearance="secondary"
                icon={<Chat24Regular />}
                onClick={() => {
                  onClose();
                  onOpenChat(complaint.id, complaint.subject);
                }}
                style={isMobile ? { width: "100%" } : undefined}
              >
                Open Chat
              </Button>
            )}
            {isHR && !chatEnabled && (
              <Button
                appearance="primary"
                onClick={handleSaveResponse}
                disabled={isUpdating || !response.trim()}
                style={isMobile ? { width: "100%" } : undefined}
              >
                {isUpdating ? "Saving..." : "Save Response"}
              </Button>
            )}
            <Button
              appearance="secondary"
              onClick={onClose}
              style={isMobile ? { width: "100%" } : undefined}
            >
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
