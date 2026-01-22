import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Spinner,
  Input,
  tokens,
  Tooltip,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Field,
} from "@fluentui/react-components";
import {
  Add24Regular,
  Delete24Regular,
  Folder24Regular,
  FolderAdd24Regular,
  Pin24Regular,
  PinOff24Regular,
  Search24Regular,
  MoreVertical24Regular,
  Edit24Regular,
  NoteAdd24Regular,
  Document24Regular,
} from "@fluentui/react-icons";
import {
  noteQueries,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
} from "@/api/queries/notes";
import { useWindowRefresh } from "@/components/desktop/WindowContext";
import { RichTextEditor } from "./RichTextEditor";

interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  preview: string | null;
  isPinned: boolean;
  isLocked: boolean;
  lockHash: string | null;
  color: string | null;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  folder: Folder | null;
}

interface Folder {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  icon: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { notes: number };
}

type SidebarView = "all" | "folder";

export default function Notes() {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [sidebarView, setSidebarView] = useState<SidebarView>("all");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Queries
  const { data: notes, isLoading: notesLoading } = useQuery(
    noteQueries.all(
      sidebarView === "folder" ? selectedFolderId || undefined : undefined,
    ),
  );
  const { data: folders, isLoading: foldersLoading } = useQuery(
    noteQueries.folders,
  );

  // Mutations
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();

  // Refresh data when window refresh button is clicked
  const queryKeys = useMemo(() => [["notes"], ["notes", "folders"]], []);
  useWindowRefresh(queryKeys);

  // Filter notes by search query
  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    const notesList = notes as Note[];
    if (!searchQuery) return notesList;
    const query = searchQuery.toLowerCase();
    return notesList.filter(
      (note) =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query),
    );
  }, [notes, searchQuery]);

  // Auto-save note content with debounce
  const handleNoteChange = useCallback(
    (field: "title" | "content", value: string) => {
      if (!selectedNote) return;

      // Update local state immediately
      setSelectedNote((prev) => {
        if (!prev) return null;
        return { ...prev, [field]: value };
      });

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Save after 500ms of no changes
      saveTimeoutRef.current = setTimeout(() => {
        const preview =
          field === "content"
            ? value.replace(/<[^>]+>/g, "").substring(0, 100)
            : undefined;

        updateNote.mutate({
          id: selectedNote.id,
          [field]: value,
          ...(preview !== undefined ? { preview } : {}),
        });
      }, 500);
    },
    [selectedNote, updateNote],
  );

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleCreateNote = async () => {
    const newNote = await createNote.mutateAsync({
      title: "",
      content: "",
      folderId:
        sidebarView === "folder" ? selectedFolderId || undefined : undefined,
    });
    if (newNote && "id" in newNote) {
      setSelectedNote(newNote as Note);
    }
  };

  const handleDeleteNote = async () => {
    if (!selectedNote) return;
    if (!confirm("Are you sure you want to delete this note?")) return;
    await deleteNote.mutateAsync(selectedNote.id);
    setSelectedNote(null);
  };

  const handleTogglePin = async () => {
    if (!selectedNote) return;
    await updateNote.mutateAsync({
      id: selectedNote.id,
      isPinned: !selectedNote.isPinned,
    });
    setSelectedNote((prev) =>
      prev ? { ...prev, isPinned: !prev.isPinned } : null,
    );
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    await createFolder.mutateAsync({ name: newFolderName.trim() });
    setNewFolderName("");
    setIsCreatingFolder(false);
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !editFolderName.trim()) return;
    await updateFolder.mutateAsync({
      id: editingFolder.id,
      name: editFolderName.trim(),
    });
    setEditingFolder(null);
    setEditFolderName("");
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (
      !confirm("Delete this folder? Notes inside will be moved to All Notes.")
    )
      return;
    await deleteFolder.mutateAsync(folderId);
    if (selectedFolderId === folderId) {
      setSelectedFolderId(null);
      setSidebarView("all");
    }
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    if (!selectedNote) return;
    await updateNote.mutateAsync({
      id: selectedNote.id,
      folderId,
    });
    setSelectedNote((prev) => (prev ? { ...prev, folderId } : null));
  };

  const isLoading = notesLoading || foldersLoading;

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <Spinner size="large" label="Loading..." />
      </div>
    );
  }

  const foldersList = (folders || []) as Folder[];
  const allNotesCount = (notes as Note[])?.length || 0;

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        background: tokens.colorNeutralBackground2,
      }}
    >
      {/* Left Sidebar - Folders */}
      <div
        style={{
          width: 180,
          background: tokens.colorNeutralBackground3,
          borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Folders Header */}
        <div
          style={{
            padding: "12px 12px 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: 12,
              color: tokens.colorNeutralForeground3,
              textTransform: "uppercase",
            }}
          >
            Folders
          </span>
          <Tooltip content="New Folder" relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={<FolderAdd24Regular />}
              onClick={() => setIsCreatingFolder(true)}
              style={{ minWidth: 24, padding: 2 }}
            />
          </Tooltip>
        </div>

        {/* Folder List */}
        <div style={{ flex: 1, overflow: "auto", padding: "0 8px" }}>
          {/* All Notes */}
          <div
            onClick={() => {
              setSidebarView("all");
              setSelectedFolderId(null);
            }}
            style={{
              padding: "8px 10px",
              cursor: "pointer",
              borderRadius: 6,
              marginBottom: 2,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background:
                sidebarView === "all"
                  ? tokens.colorNeutralBackground1Selected
                  : "transparent",
            }}
          >
            <Document24Regular style={{ fontSize: 18 }} />
            <span style={{ flex: 1, fontSize: 13 }}>All Notes</span>
            <span
              style={{ fontSize: 11, color: tokens.colorNeutralForeground3 }}
            >
              {allNotesCount}
            </span>
          </div>

          {/* Custom Folders */}
          {foldersList.map((folder) => (
            <div
              key={folder.id}
              onClick={() => {
                setSidebarView("folder");
                setSelectedFolderId(folder.id);
              }}
              style={{
                padding: "8px 10px",
                cursor: "pointer",
                borderRadius: 6,
                marginBottom: 2,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background:
                  sidebarView === "folder" && selectedFolderId === folder.id
                    ? tokens.colorNeutralBackground1Selected
                    : "transparent",
              }}
            >
              <Folder24Regular
                style={{
                  fontSize: 18,
                  color: folder.color || tokens.colorNeutralForeground1,
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {folder.name}
              </span>
              <span
                style={{ fontSize: 11, color: tokens.colorNeutralForeground3 }}
              >
                {folder._count?.notes || 0}
              </span>
              <Menu>
                <MenuTrigger disableButtonEnhancement>
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<MoreVertical24Regular />}
                    onClick={(e) => e.stopPropagation()}
                    style={{ minWidth: 20, padding: 2, opacity: 0.6 }}
                  />
                </MenuTrigger>
                <MenuPopover>
                  <MenuList>
                    <MenuItem
                      icon={<Edit24Regular />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFolder(folder);
                        setEditFolderName(folder.name);
                      }}
                    >
                      Rename
                    </MenuItem>
                    <MenuItem
                      icon={<Delete24Regular />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder.id);
                      }}
                    >
                      Delete
                    </MenuItem>
                  </MenuList>
                </MenuPopover>
              </Menu>
            </div>
          ))}
        </div>
      </div>

      {/* Middle - Notes List */}
      <div
        style={{
          width: 250,
          borderRight: `1px solid ${tokens.colorNeutralStroke1}`,
          display: "flex",
          flexDirection: "column",
          background: tokens.colorNeutralBackground1,
        }}
      >
        {/* Search + New Note */}
        <div
          style={{
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Input
              contentBefore={<Search24Regular />}
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(_, d) => setSearchQuery(d.value)}
              style={{ flex: 1 }}
              size="small"
            />
            <Tooltip content="New Note" relationship="label">
              <Button
                appearance="primary"
                size="small"
                icon={<NoteAdd24Regular />}
                onClick={handleCreateNote}
                disabled={createNote.isPending}
              />
            </Tooltip>
          </div>
        </div>

        {/* Notes List */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {filteredNotes.length > 0 ? (
            filteredNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => setSelectedNote(note)}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
                  background:
                    selectedNote?.id === note.id
                      ? tokens.colorNeutralBackground1Selected
                      : "transparent",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  {note.isPinned && (
                    <Pin24Regular
                      style={{
                        fontSize: 14,
                        color: tokens.colorBrandForeground1,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {note.title || "Untitled"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: tokens.colorNeutralForeground3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginBottom: 4,
                  }}
                >
                  {note.preview || "No additional text"}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: tokens.colorNeutralForeground4,
                  }}
                >
                  {new Date(note.updatedAt).toLocaleDateString()}
                </div>
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
              {searchQuery ? "No notes found" : "No notes yet"}
            </div>
          )}
        </div>
      </div>

      {/* Right - Note Editor */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: tokens.colorNeutralBackground1,
        }}
      >
        {selectedNote ? (
          <>
            {/* Note Toolbar */}
            <div
              style={{
                padding: "8px 16px",
                borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: tokens.colorNeutralBackground2,
              }}
            >
              <div
                style={{ fontSize: 11, color: tokens.colorNeutralForeground3 }}
              >
                {updateNote.isPending
                  ? "Saving..."
                  : `Updated ${new Date(selectedNote.updatedAt).toLocaleString()}`}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <Tooltip
                  content={selectedNote.isPinned ? "Unpin" : "Pin"}
                  relationship="label"
                >
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={
                      selectedNote.isPinned ? (
                        <PinOff24Regular />
                      ) : (
                        <Pin24Regular />
                      )
                    }
                    onClick={handleTogglePin}
                  />
                </Tooltip>
                <Menu>
                  <MenuTrigger disableButtonEnhancement>
                    <Button
                      appearance="subtle"
                      size="small"
                      icon={<Folder24Regular />}
                    />
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem
                        onClick={() => handleMoveToFolder(null)}
                        disabled={!selectedNote.folderId}
                      >
                        Remove from folder
                      </MenuItem>
                      {foldersList.map((folder) => (
                        <MenuItem
                          key={folder.id}
                          onClick={() => handleMoveToFolder(folder.id)}
                          disabled={selectedNote.folderId === folder.id}
                        >
                          {folder.name}
                        </MenuItem>
                      ))}
                    </MenuList>
                  </MenuPopover>
                </Menu>
                <Tooltip content="Delete" relationship="label">
                  <Button
                    appearance="subtle"
                    size="small"
                    icon={<Delete24Regular />}
                    onClick={handleDeleteNote}
                  />
                </Tooltip>
              </div>
            </div>

            {/* Note Content */}
            <div
              style={{
                flex: 1,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Title Input */}
              <input
                type="text"
                value={selectedNote.title}
                onChange={(e) => handleNoteChange("title", e.target.value)}
                placeholder="Title"
                style={{
                  border: "none",
                  outline: "none",
                  fontSize: 24,
                  fontWeight: 600,
                  padding: "16px 16px 8px",
                  background: "transparent",
                  width: "100%",
                  color: tokens.colorNeutralForeground1,
                }}
              />

              {/* Rich Text Editor */}
              <div style={{ flex: 1, padding: "0 16px 16px" }}>
                <RichTextEditor
                  value={selectedNote.content}
                  onChange={(content) => handleNoteChange("content", content)}
                  placeholder="Start writing..."
                />
              </div>
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: tokens.colorNeutralForeground3,
              gap: 12,
            }}
          >
            <Document24Regular style={{ fontSize: 48, opacity: 0.5 }} />
            <span>Select a note or create a new one</span>
            <Button
              appearance="primary"
              icon={<Add24Regular />}
              onClick={handleCreateNote}
              disabled={createNote.isPending}
            >
              New Note
            </Button>
          </div>
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog
        open={isCreatingFolder}
        onOpenChange={(_, d) => setIsCreatingFolder(d.open)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>New Folder</DialogTitle>
            <DialogContent>
              <Field label="Folder name">
                <Input
                  value={newFolderName}
                  onChange={(_, d) => setNewFolderName(d.value)}
                  placeholder="Enter folder name"
                  autoFocus
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setIsCreatingFolder(false)}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || createFolder.isPending}
              >
                Create
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog
        open={!!editingFolder}
        onOpenChange={(_, d) => !d.open && setEditingFolder(null)}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogContent>
              <Field label="Folder name">
                <Input
                  value={editFolderName}
                  onChange={(_, d) => setEditFolderName(d.value)}
                  placeholder="Enter folder name"
                  autoFocus
                />
              </Field>
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setEditingFolder(null)}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                onClick={handleUpdateFolder}
                disabled={!editFolderName.trim() || updateFolder.isPending}
              >
                Rename
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
