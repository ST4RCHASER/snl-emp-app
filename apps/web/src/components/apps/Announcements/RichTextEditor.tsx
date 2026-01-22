import { useRef, useCallback, useEffect } from "react";
import { Button, Tooltip, Spinner, tokens } from "@fluentui/react-components";
import {
  TextBold24Regular,
  TextItalic24Regular,
  TextUnderline24Regular,
  TextStrikethrough24Regular,
  TextBulletList24Regular,
  TextNumberListLtr24Regular,
  Link24Regular,
  Image24Regular,
  TextAlignLeft24Regular,
  TextAlignCenter24Regular,
  TextAlignRight24Regular,
  Code24Regular,
  ArrowUndo24Regular,
  ArrowRedo24Regular,
  TextT24Regular,
} from "@fluentui/react-icons";
import { useState } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const isInitializedRef = useRef(false);

  // Only set innerHTML on initial mount, not on every value change
  useEffect(() => {
    if (editorRef.current && !isInitializedRef.current) {
      editorRef.current.innerHTML = value;
      isInitializedRef.current = true;
    }
  }, [value]);

  // Reset initialization flag when value is cleared externally
  useEffect(() => {
    if (value === "" && editorRef.current) {
      editorRef.current.innerHTML = "";
      isInitializedRef.current = true;
    }
  }, [value]);

  const execCommand = useCallback(
    (command: string, commandValue?: string) => {
      document.execCommand(command, false, commandValue);
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    },
    [onChange],
  );

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const insertLink = useCallback(() => {
    const url = prompt("Enter URL:");
    if (url) {
      document.execCommand("createLink", false, url);
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    }
  }, [onChange]);

  const uploadImage = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("uploadType", "0");
        formData.append("file", file, file.name);

        const response = await fetch("https://up.m1r.ai/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = await response.json();
        // Response format: { url: "https://m1r.ai/xxxxx.ext" }
        const imageUrl = data.url;

        if (imageUrl) {
          editorRef.current?.focus();
          document.execCommand("insertImage", false, imageUrl);

          if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
          }
        } else {
          throw new Error("No URL in response");
        }
      } catch (error) {
        console.error("Image upload failed:", error);
        alert("Failed to upload image. Please try again.");
      } finally {
        setIsUploading(false);
      }
    },
    [onChange],
  );

  const handleImageClick = useCallback(() => {
    if (!isUploading) {
      fileInputRef.current?.click();
    }
  }, [isUploading]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        uploadImage(file);
        // Reset input so the same file can be selected again
        e.target.value = "";
      }
    },
    [uploadImage],
  );

  const formatBlock = useCallback(
    (tag: string) => {
      document.execCommand("formatBlock", false, tag);
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
    },
    [onChange],
  );

  const handleToolbarMouseDown = useCallback((e: React.MouseEvent) => {
    // Prevent toolbar from stealing focus from editor
    e.preventDefault();
  }, []);

  const ToolbarButton = ({
    icon,
    tooltip,
    onClick,
    label,
    disabled,
  }: {
    icon?: React.ReactNode;
    tooltip: string;
    onClick: () => void;
    label?: string;
    disabled?: boolean;
  }) => (
    <Tooltip content={tooltip} relationship="label">
      <Button
        appearance="subtle"
        size="small"
        icon={icon}
        onClick={onClick}
        disabled={disabled}
        style={{
          minWidth: label ? "auto" : 32,
          padding: label ? "4px 8px" : 4,
          fontSize: label ? 12 : undefined,
          fontWeight: label ? 600 : undefined,
        }}
      >
        {label}
      </Button>
    </Tooltip>
  );

  const ToolbarDivider = () => (
    <div
      style={{
        width: 1,
        height: 24,
        background: tokens.colorNeutralStroke2,
        margin: "0 4px",
      }}
    />
  );

  return (
    <div
      style={{
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Toolbar */}
      <div
        onMouseDown={handleToolbarMouseDown}
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 2,
          padding: "6px 8px",
          background: tokens.colorNeutralBackground3,
          borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        }}
      >
        {/* Undo/Redo */}
        <ToolbarButton
          icon={<ArrowUndo24Regular />}
          tooltip="Undo (Ctrl+Z)"
          onClick={() => execCommand("undo")}
        />
        <ToolbarButton
          icon={<ArrowRedo24Regular />}
          tooltip="Redo (Ctrl+Y)"
          onClick={() => execCommand("redo")}
        />

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarButton
          label="H1"
          tooltip="Heading 1"
          onClick={() => formatBlock("h1")}
        />
        <ToolbarButton
          label="H2"
          tooltip="Heading 2"
          onClick={() => formatBlock("h2")}
        />
        <ToolbarButton
          label="H3"
          tooltip="Heading 3"
          onClick={() => formatBlock("h3")}
        />
        <ToolbarButton
          icon={<TextT24Regular />}
          tooltip="Normal text"
          onClick={() => formatBlock("p")}
        />

        <ToolbarDivider />

        {/* Text Formatting */}
        <ToolbarButton
          icon={<TextBold24Regular />}
          tooltip="Bold (Ctrl+B)"
          onClick={() => execCommand("bold")}
        />
        <ToolbarButton
          icon={<TextItalic24Regular />}
          tooltip="Italic (Ctrl+I)"
          onClick={() => execCommand("italic")}
        />
        <ToolbarButton
          icon={<TextUnderline24Regular />}
          tooltip="Underline (Ctrl+U)"
          onClick={() => execCommand("underline")}
        />
        <ToolbarButton
          icon={<TextStrikethrough24Regular />}
          tooltip="Strikethrough"
          onClick={() => execCommand("strikeThrough")}
        />

        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarButton
          icon={<TextAlignLeft24Regular />}
          tooltip="Align Left"
          onClick={() => execCommand("justifyLeft")}
        />
        <ToolbarButton
          icon={<TextAlignCenter24Regular />}
          tooltip="Align Center"
          onClick={() => execCommand("justifyCenter")}
        />
        <ToolbarButton
          icon={<TextAlignRight24Regular />}
          tooltip="Align Right"
          onClick={() => execCommand("justifyRight")}
        />

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          icon={<TextBulletList24Regular />}
          tooltip="Bullet List"
          onClick={() => execCommand("insertUnorderedList")}
        />
        <ToolbarButton
          icon={<TextNumberListLtr24Regular />}
          tooltip="Numbered List"
          onClick={() => execCommand("insertOrderedList")}
        />

        <ToolbarDivider />

        {/* Quote & Code */}
        <ToolbarButton
          label="Quote"
          tooltip="Block Quote"
          onClick={() => formatBlock("blockquote")}
        />
        <ToolbarButton
          icon={<Code24Regular />}
          tooltip="Code Block"
          onClick={() => formatBlock("pre")}
        />

        <ToolbarDivider />

        {/* Insert */}
        <ToolbarButton
          icon={<Link24Regular />}
          tooltip="Insert Link"
          onClick={insertLink}
        />
        <ToolbarButton
          icon={isUploading ? <Spinner size="tiny" /> : <Image24Regular />}
          tooltip="Upload Image"
          onClick={handleImageClick}
          disabled={isUploading}
        />
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        suppressContentEditableWarning
        style={{
          minHeight: 250,
          maxHeight: 400,
          overflow: "auto",
          padding: 16,
          outline: "none",
          fontSize: 14,
          lineHeight: 1.6,
        }}
        data-placeholder={placeholder}
      />

      {/* Styles for placeholder and content */}
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: ${tokens.colorNeutralForeground4};
          pointer-events: none;
        }
        [contenteditable] h1 {
          font-size: 1.75em;
          font-weight: 600;
          margin: 0.5em 0;
        }
        [contenteditable] h2 {
          font-size: 1.5em;
          font-weight: 600;
          margin: 0.5em 0;
        }
        [contenteditable] h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin: 0.5em 0;
        }
        [contenteditable] blockquote {
          border-left: 3px solid ${tokens.colorBrandStroke1};
          margin: 1em 0;
          padding: 0.5em 1em;
          background: ${tokens.colorNeutralBackground3};
        }
        [contenteditable] pre {
          background: ${tokens.colorNeutralBackground3};
          padding: 1em;
          border-radius: 4px;
          font-family: monospace;
          overflow-x: auto;
        }
        [contenteditable] ul, [contenteditable] ol {
          margin: 0.5em 0;
          padding-left: 1.5em;
        }
        [contenteditable] a {
          color: ${tokens.colorBrandForeground1};
          text-decoration: underline;
        }
        [contenteditable] img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 0.5em 0;
        }
      `}</style>
    </div>
  );
}
