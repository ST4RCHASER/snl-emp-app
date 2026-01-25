import { tokens } from "@fluentui/react-components";
import type { SnapZone } from "@/stores/windowStore";

interface SnapPreviewProps {
  zone: SnapZone;
  taskbarHeight?: number;
}

export function SnapPreview({ zone, taskbarHeight = 48 }: SnapPreviewProps) {
  if (!zone) return null;

  const getStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "fixed",
      background: tokens.colorBrandBackground,
      opacity: 0.3,
      borderRadius: 8,
      transition: "all 0.15s ease-out",
      pointerEvents: "none",
      zIndex: 9998,
    };

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const availableHeight = screenHeight - taskbarHeight;

    switch (zone) {
      case "left":
        return {
          ...base,
          left: 4,
          top: 4,
          width: screenWidth / 2 - 8,
          height: availableHeight - 8,
        };
      case "right":
        return {
          ...base,
          left: screenWidth / 2 + 4,
          top: 4,
          width: screenWidth / 2 - 8,
          height: availableHeight - 8,
        };
      case "top":
        return {
          ...base,
          left: 4,
          top: 4,
          width: screenWidth - 8,
          height: availableHeight - 8,
        };
      case "top-left":
        return {
          ...base,
          left: 4,
          top: 4,
          width: screenWidth / 2 - 8,
          height: availableHeight / 2 - 6,
        };
      case "top-right":
        return {
          ...base,
          left: screenWidth / 2 + 4,
          top: 4,
          width: screenWidth / 2 - 8,
          height: availableHeight / 2 - 6,
        };
      case "bottom-left":
        return {
          ...base,
          left: 4,
          top: availableHeight / 2 + 2,
          width: screenWidth / 2 - 8,
          height: availableHeight / 2 - 6,
        };
      case "bottom-right":
        return {
          ...base,
          left: screenWidth / 2 + 4,
          top: availableHeight / 2 + 2,
          width: screenWidth / 2 - 8,
          height: availableHeight / 2 - 6,
        };
      default:
        return { ...base, display: "none" };
    }
  };

  return <div style={getStyle()} />;
}

// Helper function to detect snap zone from cursor position
export function detectSnapZone(
  x: number,
  y: number,
  taskbarHeight: number = 48
): SnapZone {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const edgeThreshold = 20; // pixels from edge to trigger snap
  const cornerThreshold = 60; // pixels from corner for corner snaps

  const availableHeight = screenHeight - taskbarHeight;

  // Check corners first (they take priority)
  const isNearLeft = x <= cornerThreshold;
  const isNearRight = x >= screenWidth - cornerThreshold;
  const isNearTop = y <= cornerThreshold;
  const isNearBottom = y >= availableHeight - cornerThreshold && y < availableHeight;

  // Corner snaps
  if (isNearLeft && isNearTop) return "top-left";
  if (isNearRight && isNearTop) return "top-right";
  if (isNearLeft && isNearBottom) return "bottom-left";
  if (isNearRight && isNearBottom) return "bottom-right";

  // Edge snaps
  if (x <= edgeThreshold) return "left";
  if (x >= screenWidth - edgeThreshold) return "right";
  if (y <= edgeThreshold) return "top";

  return null;
}
