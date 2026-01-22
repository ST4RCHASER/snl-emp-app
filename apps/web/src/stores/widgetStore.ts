import { create } from "zustand";

export type WidgetType = "sticky-note" | "calendar" | "clock" | "meeting-room";

export type CalendarStyle = "month" | "week" | "agenda";

export interface BaseWidget {
  id: string;
  type: WidgetType;
  position: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface StickyNoteWidget extends BaseWidget {
  type: "sticky-note";
  content: string;
  color: string;
}

export interface CalendarWidget extends BaseWidget {
  type: "calendar";
  style: CalendarStyle;
}

export interface ClockWidget extends BaseWidget {
  type: "clock";
  showSeconds?: boolean;
  showDate?: boolean;
  is24Hour?: boolean;
}

export type MeetingRoomType = "inner" | "outer";

export interface MeetingRoomWidget extends BaseWidget {
  type: "meeting-room";
  roomType: MeetingRoomType;
  expanded?: boolean;
}

export type Widget =
  | StickyNoteWidget
  | CalendarWidget
  | ClockWidget
  | MeetingRoomWidget;

interface WidgetStore {
  widgets: Widget[];
  setWidgets: (widgets: Widget[]) => void;
  addWidget: (widget: Widget) => void;
  updateWidget: (id: string, updates: Partial<Widget>) => void;
  removeWidget: (id: string) => void;
  updateWidgetPosition: (
    id: string,
    position: { x: number; y: number },
  ) => void;
  constrainWidgetsToScreen: () => void;
}

export const useWidgetStore = create<WidgetStore>((set) => ({
  widgets: [],

  setWidgets: (widgets) => set({ widgets }),

  addWidget: (widget) =>
    set((state) => ({ widgets: [...state.widgets, widget] })),

  updateWidget: (id, updates) =>
    set((state) => ({
      widgets: state.widgets.map((w) =>
        w.id === id ? ({ ...w, ...updates } as Widget) : w,
      ),
    })),

  removeWidget: (id) =>
    set((state) => ({
      widgets: state.widgets.filter((w) => w.id !== id),
    })),

  updateWidgetPosition: (id, position) =>
    set((state) => ({
      widgets: state.widgets.map((w) => (w.id === id ? { ...w, position } : w)),
    })),

  constrainWidgetsToScreen: () => {
    if (typeof window === "undefined") return;

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const taskbarHeight = 48;
    const minVisiblePortion = 50;

    set((state) => ({
      widgets: state.widgets.map((w) => {
        const widgetWidth = w.size?.width || 200;
        const widgetHeight = w.size?.height || 150;

        let newX = w.position.x;
        let newY = w.position.y;
        let needsUpdate = false;

        // Check if widget is too far right
        if (w.position.x > screenWidth - minVisiblePortion) {
          newX = screenWidth - widgetWidth - 20;
          needsUpdate = true;
        }

        // Check if widget is too far left
        if (w.position.x + widgetWidth < minVisiblePortion) {
          newX = 20;
          needsUpdate = true;
        }

        // Check if widget is too far down
        if (w.position.y > screenHeight - taskbarHeight - minVisiblePortion) {
          newY = screenHeight - taskbarHeight - widgetHeight - 20;
          needsUpdate = true;
        }

        // Check if widget is too far up
        if (w.position.y < 0) {
          newY = 20;
          needsUpdate = true;
        }

        if (needsUpdate) {
          return { ...w, position: { x: newX, y: newY } };
        }
        return w;
      }),
    }));
  },
}));

// Helper to generate unique widget ID
export function generateWidgetId(): string {
  return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Default colors for sticky notes
export const STICKY_NOTE_COLORS = [
  "#fff9c4", // Yellow
  "#ffccbc", // Orange/Peach
  "#f8bbd9", // Pink
  "#e1bee7", // Purple
  "#c5cae9", // Indigo
  "#bbdefb", // Blue
  "#b2dfdb", // Teal
  "#c8e6c9", // Green
];
