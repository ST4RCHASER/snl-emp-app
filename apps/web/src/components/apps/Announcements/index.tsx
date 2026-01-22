import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Spinner,
  Field,
  Input,
  Badge,
  Switch,
  tokens,
} from "@fluentui/react-components";
import {
  Add24Regular,
  Edit24Regular,
  Delete24Regular,
  ArrowUp24Regular,
  ArrowDown24Regular,
  ArrowLeft24Regular,
  Checkmark24Regular,
} from "@fluentui/react-icons";
import {
  announcementQueries,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
  useReorderAnnouncements,
  useMarkAnnouncementRead,
  useMarkAllAnnouncementsRead,
} from "@/api/queries/announcements";
import { useAuth } from "@/auth/provider";
import { RichTextEditor } from "./RichTextEditor";
import { useWindowRefresh } from "@/components/desktop/WindowContext";

type ViewMode = "list" | "create" | "edit";

interface Announcement {
  id: string;
  title: string;
  content: string;
  images: string[] | null;
  order: number;
  isActive: boolean;
  isRead: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function Announcements() {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);
  const { user } = useAuth();
  const userRole = (user as { role?: string } | undefined)?.role;
  const isHR = userRole === "HR" || userRole === "DEVELOPER";

  // Refresh data when window refresh button is clicked
  const queryKeys = useMemo(() => [["announcements"]], []);
  useWindowRefresh(queryKeys);

  const { data: announcementsData, isLoading } = useQuery(
    announcementQueries.all,
  );
  const announcements = announcementsData as Announcement[] | undefined;

  const createAnnouncement = useCreateAnnouncement();
  const updateAnnouncement = useUpdateAnnouncement();
  const deleteAnnouncement = useDeleteAnnouncement();
  const reorderAnnouncements = useReorderAnnouncements();
  const markRead = useMarkAnnouncementRead();
  const markAllRead = useMarkAllAnnouncementsRead();

  const [form, setForm] = useState({
    title: "",
    content: "",
    isActive: true,
  });

  // Auto-select first announcement for non-HR users and mark as read
  useEffect(() => {
    if (
      !isHR &&
      announcements &&
      announcements.length > 0 &&
      !selectedAnnouncement
    ) {
      const firstAnnouncement = announcements[0];
      setSelectedAnnouncement(firstAnnouncement);
      // Mark the first announcement as read since it's displayed
      if (!firstAnnouncement.isRead) {
        markRead.mutate(firstAnnouncement.id);
      }
    }
  }, [announcements, isHR, selectedAnnouncement]);

  const handleCreate = async () => {
    const newAnnouncement = await createAnnouncement.mutateAsync({
      title: form.title,
      content: form.content,
    });
    setViewMode("list");
    setForm({ title: "", content: "", isActive: true });
    // Select the newly created announcement
    if (newAnnouncement && "id" in newAnnouncement) {
      setSelectedAnnouncement(newAnnouncement as unknown as Announcement);
    }
  };

  const handleUpdate = async () => {
    if (!editingAnnouncement) return;
    const updatedAnnouncement = await updateAnnouncement.mutateAsync({
      id: editingAnnouncement.id,
      title: form.title,
      content: form.content,
      isActive: form.isActive,
    });
    setViewMode("list");
    setEditingAnnouncement(null);
    setForm({ title: "", content: "", isActive: true });
    // Update selected announcement with new data
    if (updatedAnnouncement && "id" in updatedAnnouncement) {
      setSelectedAnnouncement(updatedAnnouncement as unknown as Announcement);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    await deleteAnnouncement.mutateAsync(id);
    if (selectedAnnouncement?.id === id) {
      setSelectedAnnouncement(null);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (!announcements || index === 0) return;
    const newOrder = [...announcements];
    [newOrder[index - 1], newOrder[index]] = [
      newOrder[index],
      newOrder[index - 1],
    ];
    await reorderAnnouncements.mutateAsync(newOrder.map((a) => ({ id: a.id })));
  };

  const handleMoveDown = async (index: number) => {
    if (!announcements || index === announcements.length - 1) return;
    const newOrder = [...announcements];
    [newOrder[index], newOrder[index + 1]] = [
      newOrder[index + 1],
      newOrder[index],
    ];
    await reorderAnnouncements.mutateAsync(newOrder.map((a) => ({ id: a.id })));
  };

  const startEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setForm({
      title: announcement.title,
      content: announcement.content,
      isActive: announcement.isActive,
    });
    setViewMode("edit");
  };

  const handleSelectAnnouncement = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    if (!isHR) {
      markRead.mutate(announcement.id);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spinner size="large" label="Loading..." />
      </div>
    );
  }

  // Create/Edit form for HR
  if (viewMode === "create" || viewMode === "edit") {
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
            onClick={() => {
              setViewMode("list");
              setEditingAnnouncement(null);
              setForm({ title: "", content: "", isActive: true });
            }}
          />
          <h3 style={{ margin: 0, fontWeight: 600 }}>
            {viewMode === "create"
              ? "Create Announcement"
              : "Edit Announcement"}
          </h3>
        </div>

        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(_, d) => setForm((f) => ({ ...f, title: d.value }))}
                placeholder="Announcement title"
              />
            </Field>

            <Field label="Content">
              <RichTextEditor
                value={form.content}
                onChange={(content) => setForm((f) => ({ ...f, content }))}
                placeholder="Write your announcement content here..."
              />
            </Field>

            {viewMode === "edit" && (
              <Field label="Active">
                <Switch
                  checked={form.isActive}
                  onChange={(_, d) =>
                    setForm((f) => ({ ...f, isActive: d.checked }))
                  }
                  label={
                    form.isActive
                      ? "Visible to employees"
                      : "Hidden from employees"
                  }
                />
              </Field>
            )}
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
            onClick={() => {
              setViewMode("list");
              setEditingAnnouncement(null);
              setForm({ title: "", content: "", isActive: true });
            }}
          >
            Cancel
          </Button>
          <Button
            appearance="primary"
            onClick={viewMode === "create" ? handleCreate : handleUpdate}
            disabled={
              !form.title ||
              !form.content ||
              createAnnouncement.isPending ||
              updateAnnouncement.isPending
            }
          >
            {createAnnouncement.isPending || updateAnnouncement.isPending
              ? "Saving..."
              : viewMode === "create"
                ? "Create"
                : "Save Changes"}
          </Button>
        </div>
      </div>
    );
  }

  // Main list view with sidebar
  return (
    <div style={{ display: "flex", height: "100%", gap: 0 }}>
      {/* Left Sidebar - Announcement List */}
      <div
        style={{
          width: 280,
          borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontWeight: 600 }}>Announcements</span>
          {isHR && (
            <Button
              appearance="primary"
              size="small"
              icon={<Add24Regular />}
              onClick={() => setViewMode("create")}
            >
              New
            </Button>
          )}
        </div>

        {/* Mark all as read button */}
        {!isHR && announcements && announcements.some((a) => !a.isRead) && (
          <div
            style={{
              padding: "8px 16px",
              borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
            }}
          >
            <Button
              appearance="subtle"
              size="small"
              icon={<Checkmark24Regular />}
              onClick={() => markAllRead.mutate()}
              style={{ width: "100%" }}
            >
              Mark all as read
            </Button>
          </div>
        )}

        {/* Announcement List */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {announcements?.length ? (
            announcements.map((announcement, index) => (
              <div
                key={announcement.id}
                onClick={() => handleSelectAnnouncement(announcement)}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                  background:
                    selectedAnnouncement?.id === announcement.id
                      ? tokens.colorNeutralBackground1Selected
                      : "transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {/* Unread indicator dot */}
                {!announcement.isRead && (
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: tokens.colorBrandBackground,
                      flexShrink: 0,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: announcement.isRead ? 500 : 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    {announcement.title}
                    {!announcement.isActive && (
                      <Badge appearance="outline" size="small" color="warning">
                        Hidden
                      </Badge>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: tokens.colorNeutralForeground3,
                    }}
                  >
                    {new Date(announcement.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                {isHR && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<ArrowUp24Regular />}
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveUp(index);
                      }}
                      style={{ minWidth: 24, padding: 2 }}
                    />
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<ArrowDown24Regular />}
                      disabled={index === announcements.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveDown(index);
                      }}
                      style={{ minWidth: 24, padding: 2 }}
                    />
                  </div>
                )}
              </div>
            ))
          ) : (
            <div
              style={{
                padding: 24,
                textAlign: "center",
                color: tokens.colorNeutralForeground3,
              }}
            >
              No announcements
            </div>
          )}
        </div>
      </div>

      {/* Right Content - Announcement Detail */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {selectedAnnouncement ? (
          <>
            {/* Header */}
            <div
              style={{
                padding: "16px 24px",
                borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontWeight: 600 }}>
                  {selectedAnnouncement.title}
                </h2>
                <div
                  style={{
                    fontSize: 12,
                    color: tokens.colorNeutralForeground3,
                    marginTop: 4,
                  }}
                >
                  Updated:{" "}
                  {new Date(selectedAnnouncement.updatedAt).toLocaleString()}
                </div>
              </div>
              {isHR && (
                <div style={{ display: "flex", gap: 8 }}>
                  <Button
                    appearance="secondary"
                    icon={<Edit24Regular />}
                    onClick={() => startEdit(selectedAnnouncement)}
                  >
                    Edit
                  </Button>
                  <Button
                    appearance="secondary"
                    icon={<Delete24Regular />}
                    onClick={() => handleDelete(selectedAnnouncement.id)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
              <div
                className="announcement-content"
                style={{
                  lineHeight: 1.6,
                  fontSize: 14,
                }}
                dangerouslySetInnerHTML={{
                  __html: selectedAnnouncement.content,
                }}
              />
              <style>{`
                .announcement-content h1 {
                  font-size: 1.75em;
                  font-weight: 600;
                  margin: 0.5em 0;
                }
                .announcement-content h2 {
                  font-size: 1.5em;
                  font-weight: 600;
                  margin: 0.5em 0;
                }
                .announcement-content h3 {
                  font-size: 1.25em;
                  font-weight: 600;
                  margin: 0.5em 0;
                }
                .announcement-content blockquote {
                  border-left: 3px solid ${tokens.colorBrandStroke1};
                  margin: 1em 0;
                  padding: 0.5em 1em;
                  background: ${tokens.colorNeutralBackground3};
                }
                .announcement-content pre {
                  background: ${tokens.colorNeutralBackground3};
                  padding: 1em;
                  border-radius: 4px;
                  font-family: monospace;
                  overflow-x: auto;
                }
                .announcement-content ul, .announcement-content ol {
                  margin: 0.5em 0;
                  padding-left: 1.5em;
                }
                .announcement-content a {
                  color: ${tokens.colorBrandForeground1};
                  text-decoration: underline;
                }
                .announcement-content img {
                  max-width: 100%;
                  height: auto;
                  border-radius: 4px;
                  margin: 0.5em 0;
                }
              `}</style>
            </div>
          </>
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
            Select an announcement to view
          </div>
        )}
      </div>
    </div>
  );
}
