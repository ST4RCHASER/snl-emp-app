import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Spinner,
  Field,
  Textarea,
  Select,
  tokens,
  Avatar,
  Tooltip,
} from "@fluentui/react-components";
import {
  Send24Regular,
  Person24Regular,
  PersonSupport24Regular,
  Attach24Regular,
  Dismiss16Regular,
  Document24Regular,
  ArrowDownload24Regular,
} from "@fluentui/react-icons";
import {
  complaintQueries,
  useUpdateComplaintStatus,
  useSendComplaintMessage,
  useUploadFile,
  type ComplaintMessage,
  type ComplaintStatus,
} from "@/api/queries/complaints";
import { useAuth } from "@/auth/provider";
import { useWindowProps } from "@/components/desktop/WindowContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const MAX_FILE_SIZE = 9 * 1024 * 1024; // 9MB

interface ComplaintChatProps {
  complaintId: string;
  isHR: boolean;
}

interface PendingAttachment {
  file: File;
  previewUrl?: string;
  isImage: boolean;
}

// Hook for SSE connection
function useComplaintSSE(
  complaintId: string,
  currentUserId: string | undefined,
  enabled: boolean,
  onMessage: (msg: ComplaintMessage) => void,
  onStatusChange: (status: ComplaintStatus) => void,
) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;

      const url = `${API_URL}/api/complaints/${complaintId}/stream`;
      const eventSource = new EventSource(url, { withCredentials: true });
      eventSourceRef.current = eventSource;

      eventSource.addEventListener("message", (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);

          // Skip messages from the current user - they already have optimistic update
          if (data.userId === currentUserId) {
            return;
          }

          const msg: ComplaintMessage = {
            id: data.id,
            content: data.content,
            isFromHR: data.isFromHR,
            isSelf: false,
            senderName: data.isFromHR ? "HR Staff" : "Anonymous Employee",
            attachmentUrl: data.attachmentUrl,
            attachmentName: data.attachmentName,
            attachmentType: data.attachmentType,
            attachmentSize: data.attachmentSize,
            createdAt: data.createdAt,
          };
          onMessage(msg);
        } catch (e) {
          console.error("Failed to parse SSE message:", e);
        }
      });

      eventSource.addEventListener("status", (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          onStatusChange(data.status);
        } catch (e) {
          console.error("Failed to parse SSE status:", e);
        }
      });

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;

        if (isMounted) {
          reconnectTimeoutRef.current = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [complaintId, currentUserId, enabled, onMessage, onStatusChange]);
}

export default function ComplaintChat() {
  const { user } = useAuth();
  const windowProps = useWindowProps<ComplaintChatProps>();
  const complaintId = windowProps?.complaintId;
  const userRole = (user as { role?: string } | undefined)?.role;
  const isHR =
    windowProps?.isHR ?? (userRole === "HR" || userRole === "DEVELOPER");

  if (!complaintId) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        No complaint selected
      </div>
    );
  }

  return (
    <ComplaintChatView
      complaintId={complaintId}
      isHR={isHR}
      userId={user?.id}
    />
  );
}

function ComplaintChatView({
  complaintId,
  isHR,
  userId,
}: {
  complaintId: string;
  isHR: boolean;
  userId?: string;
}) {
  const queryClient = useQueryClient();
  const { data: complaint, isLoading } = useQuery(
    complaintQueries.detail(complaintId),
  );
  const updateStatus = useUpdateComplaintStatus();
  const sendMessage = useSendComplaintMessage();
  const uploadFile = useUploadFile();

  const [messageInput, setMessageInput] = useState("");
  const [statusForm, setStatusForm] = useState<ComplaintStatus>("BACKLOG");
  const [localMessages, setLocalMessages] = useState<ComplaintMessage[]>([]);
  const [localStatus, setLocalStatus] = useState<ComplaintStatus | null>(null);
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Use ref for pending IDs to avoid race conditions with SSE (synchronous access)
  const pendingMessageIdsRef = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update status form when complaint loads and clear local state
  const complaintDataKey =
    complaint && "id" in complaint
      ? `${complaint.id}-${(complaint as unknown as { messages?: ComplaintMessage[] }).messages?.length || 0}`
      : null;

  useEffect(() => {
    if (complaint && "status" in complaint) {
      setStatusForm(complaint.status as ComplaintStatus);
      setLocalStatus(null);
      setLocalMessages([]);
    }
  }, [complaintDataKey]);

  // Handle incoming SSE message
  const handleSSEMessage = useCallback((msg: ComplaintMessage) => {
    // Check ref synchronously to avoid race conditions
    if (pendingMessageIdsRef.current.has(msg.id)) {
      pendingMessageIdsRef.current.delete(msg.id);
      return;
    }

    setLocalMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  }, []);

  // Handle incoming SSE status change
  const handleSSEStatusChange = useCallback((status: ComplaintStatus) => {
    setLocalStatus(status);
    setStatusForm(status);
  }, []);

  // Connect to SSE
  useComplaintSSE(
    complaintId,
    userId,
    !!complaint,
    handleSSEMessage,
    handleSSEStatusChange,
  );

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [complaint, localMessages]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
    };
  }, [pendingAttachment]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert("File size exceeds 9MB limit");
      return;
    }

    const isImage = file.type.startsWith("image/");
    const previewUrl = isImage ? URL.createObjectURL(file) : undefined;

    setPendingAttachment({ file, previewUrl, isImage });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clearAttachment = () => {
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }
    setPendingAttachment(null);
  };

  const handleSendMessage = async () => {
    const hasContent = messageInput.trim();
    const hasAttachment = pendingAttachment;

    if (!hasContent && !hasAttachment) return;

    const content = messageInput.trim();
    setMessageInput("");

    const tempId = `temp-${Date.now()}`;
    let attachmentData: {
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentType?: string;
      attachmentSize?: number;
    } = {};

    // Upload attachment if present
    if (pendingAttachment) {
      setIsUploading(true);
      try {
        const uploadResult = await uploadFile.mutateAsync(
          pendingAttachment.file,
        );
        if (uploadResult && "url" in uploadResult) {
          attachmentData = {
            attachmentUrl: uploadResult.url,
            attachmentName: pendingAttachment.file.name,
            attachmentType: pendingAttachment.file.type,
            attachmentSize: pendingAttachment.file.size,
          };
        }
      } catch (error) {
        console.error("Upload failed:", error);
        alert("Failed to upload file");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
      clearAttachment();
    }

    const optimisticMsg: ComplaintMessage = {
      id: tempId,
      content: content || "",
      isFromHR: isHR,
      isSelf: true,
      senderName: "You",
      ...attachmentData,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, optimisticMsg]);

    const result = await sendMessage.mutateAsync({
      complaintId,
      content: content || "",
      ...attachmentData,
    });

    if (result && "id" in result) {
      const resultId = result.id as string;
      // Add to pending ref FIRST (synchronous) to prevent SSE from adding duplicate
      pendingMessageIdsRef.current.add(resultId);
      // Then update the temp ID to real ID
      setLocalMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...optimisticMsg, id: resultId } : m,
        ),
      );
    }
  };

  const handleUpdateStatus = async () => {
    if (!complaint || !("id" in complaint)) return;
    await updateStatus.mutateAsync({
      id: complaint.id,
      status: statusForm,
    });
    queryClient.invalidateQueries({ queryKey: ["complaints", complaintId] });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spinner size="medium" label="Loading..." />
      </div>
    );
  }

  if (!complaint || !("id" in complaint)) {
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        Complaint not found
      </div>
    );
  }

  const serverMessages = (
    (
      complaint as {
        messages?: Array<
          Omit<ComplaintMessage, "createdAt"> & { createdAt: Date | string }
        >;
      }
    ).messages || []
  ).map((m) => ({
    ...m,
    createdAt:
      typeof m.createdAt === "string" ? m.createdAt : m.createdAt.toISOString(),
  })) as ComplaintMessage[];
  const allMessages = [
    ...serverMessages,
    ...localMessages.filter(
      (lm) => !serverMessages.some((sm) => sm.id === lm.id),
    ),
  ].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const currentStatus = localStatus || (complaint.status as ComplaintStatus);

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

  const canSend =
    (messageInput.trim() || pendingAttachment) &&
    !sendMessage.isPending &&
    !isUploading;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: 16,
        gap: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
          paddingBottom: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: 16 }}>
            {complaint.subject}
          </h3>
          <div
            style={{
              fontSize: 12,
              color: tokens.colorNeutralForeground3,
            }}
          >
            {isHR ? "Anonymous Employee" : "My Complaint"}
          </div>
        </div>
        {getStatusBadge(currentStatus)}
      </div>

      {/* Description */}
      <div
        style={{
          padding: "12px 0",
          borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: tokens.colorNeutralForeground3,
            marginBottom: 6,
          }}
        >
          Original Complaint
        </div>
        <div
          style={{
            whiteSpace: "pre-wrap",
            background: tokens.colorNeutralBackground3,
            padding: 12,
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          {complaint.description}
        </div>
      </div>

      {/* Chat Messages */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px 0",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {allMessages.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: tokens.colorNeutralForeground3,
              padding: 20,
              fontSize: 13,
            }}
          >
            No messages yet. Start the conversation below.
          </div>
        ) : (
          allMessages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Status control (HR only) */}
      {isHR && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 0",
            borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
            flexShrink: 0,
          }}
        >
          <Field label="Status" style={{ flex: 1, margin: 0 }}>
            <Select
              value={statusForm}
              onChange={(_, d) => setStatusForm(d.value as ComplaintStatus)}
              size="small"
            >
              <option value="BACKLOG">Backlog</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
            </Select>
          </Field>
          <Button
            appearance="secondary"
            size="small"
            onClick={handleUpdateStatus}
            disabled={updateStatus.isPending || statusForm === currentStatus}
          >
            {updateStatus.isPending ? "..." : "Update"}
          </Button>
        </div>
      )}

      {/* Attachment Preview */}
      {pendingAttachment && (
        <div
          style={{
            padding: "8px 0",
            borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: tokens.colorNeutralBackground3,
              padding: 8,
              borderRadius: 8,
            }}
          >
            {pendingAttachment.isImage && pendingAttachment.previewUrl ? (
              <img
                src={pendingAttachment.previewUrl}
                alt="Preview"
                style={{
                  width: 48,
                  height: 48,
                  objectFit: "cover",
                  borderRadius: 4,
                }}
              />
            ) : (
              <Document24Regular />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {pendingAttachment.file.name}
              </div>
              <div
                style={{ fontSize: 11, color: tokens.colorNeutralForeground3 }}
              >
                {formatFileSize(pendingAttachment.file.size)}
              </div>
            </div>
            <Button
              appearance="subtle"
              size="small"
              icon={<Dismiss16Regular />}
              onClick={clearAttachment}
            />
          </div>
        </div>
      )}

      {/* Message Input */}
      <div
        style={{
          display: "flex",
          gap: 8,
          paddingTop: 12,
          borderTop: pendingAttachment
            ? "none"
            : `1px solid ${tokens.colorNeutralStroke1}`,
          flexShrink: 0,
          alignItems: "flex-end",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: "none" }}
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        />
        <Tooltip content="Attach file (max 9MB)" relationship="label">
          <Button
            appearance="subtle"
            icon={<Attach24Regular />}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          />
        </Tooltip>
        <Textarea
          value={messageInput}
          onChange={(_, d) => setMessageInput(d.value)}
          placeholder="Type your message..."
          rows={2}
          style={{ flex: 1 }}
          onKeyDown={handleKeyDown}
        />
        <Button
          appearance="primary"
          icon={isUploading ? <Spinner size="tiny" /> : <Send24Regular />}
          onClick={handleSendMessage}
          disabled={!canSend}
        />
      </div>
    </div>
  );
}

function ChatMessage({ message }: { message: ComplaintMessage }) {
  const isSelf = message.isSelf;
  const hasAttachment = message.attachmentUrl;
  const isImage = message.attachmentType?.startsWith("image/");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isSelf ? "row-reverse" : "row",
        gap: 8,
        alignItems: "flex-start",
      }}
    >
      <Avatar
        size={32}
        icon={
          message.isFromHR ? <PersonSupport24Regular /> : <Person24Regular />
        }
        color={message.isFromHR ? "brand" : "neutral"}
      />

      <div
        style={{
          maxWidth: "70%",
          display: "flex",
          flexDirection: "column",
          alignItems: isSelf ? "flex-end" : "flex-start",
        }}
      >
        <div
          style={{
            fontSize: 11,
            color: tokens.colorNeutralForeground3,
            marginBottom: 4,
            paddingLeft: isSelf ? 0 : 8,
            paddingRight: isSelf ? 8 : 0,
          }}
        >
          {message.senderName}
        </div>

        <div
          style={{
            background: isSelf
              ? tokens.colorBrandBackground
              : tokens.colorNeutralBackground3,
            color: isSelf
              ? tokens.colorNeutralForegroundOnBrand
              : tokens.colorNeutralForeground1,
            padding: "8px 12px",
            borderRadius: 12,
            borderTopRightRadius: isSelf ? 4 : 12,
            borderTopLeftRadius: isSelf ? 12 : 4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 13,
          }}
        >
          {/* Attachment */}
          {hasAttachment && (
            <div style={{ marginBottom: message.content ? 8 : 0 }}>
              {isImage ? (
                <a
                  href={message.attachmentUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img
                    src={message.attachmentUrl!}
                    alt={message.attachmentName || "Image"}
                    style={{
                      maxWidth: "100%",
                      maxHeight: 200,
                      borderRadius: 8,
                      display: "block",
                    }}
                  />
                </a>
              ) : (
                <a
                  href={message.attachmentUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: 8,
                    background: isSelf
                      ? "rgba(255,255,255,0.1)"
                      : tokens.colorNeutralBackground1,
                    borderRadius: 8,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <Document24Regular />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 12,
                      }}
                    >
                      {message.attachmentName || "File"}
                    </div>
                    {message.attachmentSize && (
                      <div style={{ fontSize: 10, opacity: 0.7 }}>
                        {formatFileSize(message.attachmentSize)}
                      </div>
                    )}
                  </div>
                  <ArrowDownload24Regular />
                </a>
              )}
            </div>
          )}

          {/* Text content */}
          {message.content}
        </div>

        <div
          style={{
            fontSize: 10,
            color: tokens.colorNeutralForeground4,
            marginTop: 4,
            paddingLeft: isSelf ? 0 : 8,
            paddingRight: isSelf ? 8 : 0,
          }}
        >
          {new Date(message.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
