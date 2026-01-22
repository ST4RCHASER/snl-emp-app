import { useRef, useCallback, useEffect, useState } from "react";
import { Button, Tooltip, Spinner, tokens } from "@fluentui/react-components";
import {
  TextBold24Regular,
  TextItalic24Regular,
  TextUnderline24Regular,
  TextBulletList24Regular,
  TextNumberListLtr24Regular,
  Link24Regular,
  Image24Regular,
  Code24Regular,
  TextT24Regular,
  CheckboxChecked24Regular,
} from "@fluentui/react-icons";

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
  const lastValueRef = useRef(value);

  // Only set innerHTML on initial mount or when value changes externally
  useEffect(() => {
    if (editorRef.current) {
      if (!isInitializedRef.current) {
        editorRef.current.innerHTML = value;
        isInitializedRef.current = true;
        lastValueRef.current = value;
      } else if (
        value !== lastValueRef.current &&
        value !== editorRef.current.innerHTML
      ) {
        // Value changed externally (e.g., switching notes)
        editorRef.current.innerHTML = value;
        lastValueRef.current = value;
      }
    }
  }, [value]);

  const execCommand = useCallback(
    (command: string, commandValue?: string) => {
      document.execCommand(command, false, commandValue);
      if (editorRef.current) {
        const newValue = editorRef.current.innerHTML;
        lastValueRef.current = newValue;
        onChange(newValue);
      }
    },
    [onChange],
  );

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      const newValue = editorRef.current.innerHTML;
      lastValueRef.current = newValue;
      onChange(newValue);
    }
  }, [onChange]);

  const insertLink = useCallback(() => {
    const url = prompt("Enter URL:");
    if (url) {
      document.execCommand("createLink", false, url);
      if (editorRef.current) {
        const newValue = editorRef.current.innerHTML;
        lastValueRef.current = newValue;
        onChange(newValue);
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
        const imageUrl = data.url;

        if (imageUrl) {
          editorRef.current?.focus();
          document.execCommand("insertImage", false, imageUrl);

          if (editorRef.current) {
            const newValue = editorRef.current.innerHTML;
            lastValueRef.current = newValue;
            onChange(newValue);
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
        e.target.value = "";
      }
    },
    [uploadImage],
  );

  const formatBlock = useCallback(
    (tag: string) => {
      document.execCommand("formatBlock", false, tag);
      if (editorRef.current) {
        const newValue = editorRef.current.innerHTML;
        lastValueRef.current = newValue;
        onChange(newValue);
      }
    },
    [onChange],
  );

  const insertChecklist = useCallback(() => {
    const checkbox =
      '<div style="display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;"><input type="checkbox" style="margin-top: 3px;" /><span>Task item</span></div>';
    document.execCommand("insertHTML", false, checkbox);
    if (editorRef.current) {
      const newValue = editorRef.current.innerHTML;
      lastValueRef.current = newValue;
      onChange(newValue);
    }
  }, [onChange]);

  const handleToolbarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const ToolbarButton = ({
    icon,
    tooltip,
    onClick,
    disabled,
  }: {
    icon: JSX.Element;
    tooltip: string;
    onClick: () => void;
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
          minWidth: 28,
          height: 28,
          padding: 4,
        }}
      />
    </Tooltip>
  );

  const ToolbarDivider = () => (
    <div
      style={{
        width: 1,
        height: 20,
        background: tokens.colorNeutralStroke2,
        margin: "0 4px",
      }}
    />
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      {/* Hidden file input */}
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
          padding: "4px 8px",
          background: tokens.colorNeutralBackground3,
          borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        }}
      >
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

        <ToolbarDivider />

        <ToolbarButton
          icon={<TextT24Regular />}
          tooltip="Heading"
          onClick={() => formatBlock("h2")}
        />
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
        <ToolbarButton
          icon={<CheckboxChecked24Regular />}
          tooltip="Checklist"
          onClick={insertChecklist}
        />

        <ToolbarDivider />

        <ToolbarButton
          icon={<Code24Regular />}
          tooltip="Code"
          onClick={() => formatBlock("pre")}
        />
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
          flex: 1,
          overflow: "auto",
          padding: 12,
          outline: "none",
          fontSize: 14,
          lineHeight: 1.6,
          minHeight: 200,
        }}
        data-placeholder={placeholder}
      />

      {/* Styles */}
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: ${tokens.colorNeutralForeground4};
          pointer-events: none;
        }
        [contenteditable] h1 {
          font-size: 1.5em;
          font-weight: 600;
          margin: 0.5em 0;
        }
        [contenteditable] h2 {
          font-size: 1.25em;
          font-weight: 600;
          margin: 0.5em 0;
        }
        [contenteditable] h3 {
          font-size: 1.1em;
          font-weight: 600;
          margin: 0.5em 0;
        }
        [contenteditable] pre {
          background: ${tokens.colorNeutralBackground3};
          padding: 0.75em;
          border-radius: 4px;
          font-family: monospace;
          font-size: 13px;
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
        [contenteditable] input[type="checkbox"] {
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
