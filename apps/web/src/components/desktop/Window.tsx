import { Suspense, type ReactNode, useMemo, useState, useEffect } from "react";
import { Rnd } from "react-rnd";
import { Button, Spinner, tokens } from "@fluentui/react-components";
import {
  Dismiss20Regular,
  Maximize20Regular,
  Subtract20Regular,
  SquareMultiple20Regular,
  ArrowClockwise20Regular,
} from "@fluentui/react-icons";
import type { WindowState } from "@/stores/windowStore";

interface WindowProps {
  window: WindowState;
  children: ReactNode;
  guiScale?: number;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onRefresh: () => void;
  onFocus: () => void;
  onDragStop: (position: { x: number; y: number }) => void;
  onResizeStop: (size: { width: number; height: number }) => void;
}

export function Window({
  window,
  children,
  guiScale = 1.0,
  onClose,
  onMinimize,
  onMaximize,
  onRefresh,
  onFocus,
  onDragStop,
  onResizeStop,
}: WindowProps) {
  // Track if this is a fresh mount for opening animation
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    const timer = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  // Calculate animation styles for the inner container (not Rnd wrapper)
  // Must be called before any early returns to satisfy React hooks rules
  const innerAnimationStyle = useMemo(() => {
    const baseTransition =
      "opacity 0.15s ease-out, transform 0.15s ease-out, box-shadow 0.2s ease";

    // Opening animation: start small/transparent, animate to full
    if (window.animationState === "opening") {
      if (!mounted) {
        // Initial state before animation
        return {
          opacity: 0,
          transform: "scale(0.95)",
          transition: "none",
        };
      }
      // Animate to visible
      return {
        opacity: 1,
        transform: "scale(1)",
        transition: baseTransition,
      };
    }

    switch (window.animationState) {
      case "closing":
        // Fade out and shrink - window is being closed/destroyed
        return {
          opacity: 0,
          transform: "scale(0.9)",
          transition: baseTransition,
          pointerEvents: "none" as const,
        };
      case "minimizing":
        // Slide down toward taskbar - window is being minimized
        return {
          opacity: 0,
          transform: "translateY(20px)",
          transition: baseTransition,
          pointerEvents: "none" as const,
        };
      case "restoring":
        // Slide up from taskbar - window is being restored
        return {
          opacity: 1,
          transform: "translateY(0)",
          transition: baseTransition,
        };
      case "maximizing":
        return {
          opacity: 1,
          transform: "scale(1)",
          transition: baseTransition,
        };
      default:
        return {
          opacity: 1,
          transform: "scale(1) translateY(0)",
          transition: baseTransition,
        };
    }
  }, [window.animationState, mounted]);

  // Don't render if minimized (but wait for animation to complete)
  if (window.isMinimized && window.animationState !== "minimizing") return null;

  const maxPosition = { x: 0, y: 0 };

  // Apply GUI scale to window size
  const scaledSize = {
    width: window.size.width * guiScale,
    height: window.size.height * guiScale,
  };
  const scaledMinWidth = 400 * guiScale;
  const scaledMinHeight = 300 * guiScale;
  const taskbarHeight = 48 * guiScale;

  return (
    <Rnd
      position={window.isMaximized ? maxPosition : window.position}
      size={
        window.isMaximized
          ? { width: "100vw", height: `calc(100vh - ${taskbarHeight}px)` }
          : scaledSize
      }
      style={{
        zIndex: window.zIndex,
        ...(window.isMaximized && {
          width: "100%",
          height: `calc(100vh - ${taskbarHeight}px)`,
          position: "fixed",
          top: 0,
          left: 0,
        }),
      }}
      minWidth={scaledMinWidth}
      minHeight={scaledMinHeight}
      disableDragging={window.isMaximized}
      enableResizing={!window.isMaximized}
      onDragStop={(_e, d) => onDragStop({ x: d.x, y: d.y })}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        onResizeStop({
          width: parseInt(ref.style.width) / guiScale,
          height: parseInt(ref.style.height) / guiScale,
        });
        onDragStop({ x: position.x, y: position.y });
      }}
      onMouseDown={onFocus}
      dragHandleClassName="window-drag-handle"
    >
      <div
        onContextMenu={(e) => e.stopPropagation()}
        style={{
          width: window.isMaximized ? "100vw" : "100%",
          height: window.isMaximized
            ? `calc(100vh - ${taskbarHeight}px)`
            : "100%",
          boxShadow: window.isFocused
            ? "0 0.5rem 2rem rgba(0, 0, 0, 0.4)"
            : "0 0.25rem 1rem rgba(0, 0, 0, 0.2)",
          border: window.isFocused
            ? `1px solid ${tokens.colorBrandStroke1}`
            : `1px solid ${tokens.colorNeutralStroke1}`,
          background: tokens.colorNeutralBackground1,
          borderRadius: window.isMaximized ? "0" : "0.5rem",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          ...innerAnimationStyle,
        }}
      >
        <div
          className="window-drag-handle"
          style={{
            background: tokens.colorNeutralBackground3,
            padding: "0.5rem 0.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "move",
            userSelect: "none",
            borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
          }}
        >
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: tokens.colorNeutralForeground1,
            }}
          >
            {window.title}
          </span>
          <div style={{ display: "flex", gap: "0.375rem" }}>
            <Button
              appearance="subtle"
              size="small"
              icon={<ArrowClockwise20Regular />}
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              style={{ minWidth: "1.75rem", padding: "0.25rem" }}
              title="Reload"
            />
            <Button
              appearance="subtle"
              size="small"
              icon={<Subtract20Regular />}
              onClick={(e) => {
                e.stopPropagation();
                onMinimize();
              }}
              style={{ minWidth: "1.75rem", padding: "0.25rem" }}
            />
            <Button
              appearance="subtle"
              size="small"
              icon={
                window.isMaximized ? (
                  <SquareMultiple20Regular />
                ) : (
                  <Maximize20Regular />
                )
              }
              onClick={(e) => {
                e.stopPropagation();
                onMaximize();
              }}
              style={{ minWidth: "1.75rem", padding: "0.25rem" }}
            />
            <Button
              appearance="subtle"
              size="small"
              icon={<Dismiss20Regular />}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              style={{ minWidth: "1.75rem", padding: "0.25rem" }}
            />
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
          <Suspense
            fallback={
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                <Spinner size="medium" label="Loading..." />
              </div>
            }
          >
            {children}
          </Suspense>
        </div>
      </div>
    </Rnd>
  );
}
