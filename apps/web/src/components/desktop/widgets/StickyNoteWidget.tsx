import { useState, useRef, useEffect } from "react";
import { tokens, Button, Tooltip } from "@fluentui/react-components";
import { Dismiss16Regular, Color16Regular } from "@fluentui/react-icons";
import type { StickyNoteWidget as StickyNoteWidgetType } from "@/stores/widgetStore";
import { STICKY_NOTE_COLORS } from "@/stores/widgetStore";

interface StickyNoteWidgetProps {
  widget: StickyNoteWidgetType;
  onUpdate: (updates: Partial<StickyNoteWidgetType>) => void;
  onRemove: () => void;
  onDragEnd: (position: { x: number; y: number }) => void;
}

export function StickyNoteWidget({
  widget,
  onUpdate,
  onRemove,
  onDragEnd,
}: StickyNoteWidgetProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState(widget.position);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasDraggedRef = useRef(false);
  const currentPosRef = useRef(widget.position);

  // Sync position when widget updates
  useEffect(() => {
    if (!isDragging) {
      setPosition(widget.position);
      currentPosRef.current = widget.position;
    }
  }, [widget.position, isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
    if ((e.target as HTMLElement).closest("button")) return;

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

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate({ content: e.target.value });
  };

  const handleColorChange = (color: string) => {
    onUpdate({ color });
    setShowColorPicker(false);
  };

  // Determine text color based on background
  const getTextColor = () => {
    // For light sticky note colors, use dark text
    return "#333333";
  };

  return (
    <div
      ref={elementRef}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        width: 200,
        minHeight: 180,
        background: widget.color,
        borderRadius: 4,
        boxShadow: isDragging
          ? "0 8px 24px rgba(0, 0, 0, 0.3)"
          : "0 2px 8px rgba(0, 0, 0, 0.2)",
        cursor: isDragging ? "grabbing" : "default",
        zIndex: isDragging ? 1000 : 100,
        display: "flex",
        flexDirection: "column",
        transition: isDragging ? "none" : "box-shadow 0.2s",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 6px",
          borderBottom: `1px solid rgba(0, 0, 0, 0.1)`,
          cursor: "grab",
        }}
      >
        <div style={{ display: "flex", gap: 2 }}>
          <Tooltip content="Change Color" relationship="label">
            <Button
              appearance="subtle"
              size="small"
              icon={<Color16Regular />}
              onClick={() => setShowColorPicker(!showColorPicker)}
              style={{
                minWidth: 24,
                height: 24,
                padding: 2,
                color: getTextColor(),
              }}
            />
          </Tooltip>
        </div>
        <Tooltip content="Remove" relationship="label">
          <Button
            appearance="subtle"
            size="small"
            icon={<Dismiss16Regular />}
            onClick={onRemove}
            style={{
              minWidth: 24,
              height: 24,
              padding: 2,
              color: getTextColor(),
            }}
          />
        </Tooltip>
      </div>

      {/* Color Picker */}
      {showColorPicker && (
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 4,
            background: tokens.colorNeutralBackground1,
            borderRadius: 6,
            padding: 6,
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            width: 120,
            zIndex: 1001,
          }}
        >
          {STICKY_NOTE_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              style={{
                width: 24,
                height: 24,
                borderRadius: 4,
                border:
                  color === widget.color
                    ? "2px solid #333"
                    : "1px solid rgba(0,0,0,0.2)",
                background: color,
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <textarea
        ref={textareaRef}
        value={widget.content}
        onChange={handleContentChange}
        placeholder="Write a note..."
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          resize: "none",
          padding: 10,
          background: "transparent",
          color: getTextColor(),
          fontSize: 13,
          lineHeight: 1.5,
          fontFamily: "inherit",
          minHeight: 140,
        }}
      />
    </div>
  );
}
