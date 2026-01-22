import { queryOptions } from "@tanstack/react-query";
import { api } from "../client";

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink?: string;
  status?: string;
  colorId?: string;
}

export interface RoomEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  organizer: string;
  attendeesCount: number;
}

export interface RoomEventsResponse {
  roomType: "inner" | "outer";
  roomName: string;
  events: RoomEvent[];
  currentMeeting: RoomEvent | null;
  nextMeeting: RoomEvent | null;
  isOccupied: boolean;
}

export const calendarQueries = {
  events: (timeMin?: string, timeMax?: string) =>
    queryOptions({
      queryKey: ["calendar", "events", timeMin, timeMax],
      queryFn: async () => {
        const { data, error } = await api.api.calendar.events.get({
          query: { timeMin, timeMax },
        });
        if (error) throw error;
        return data as { events: CalendarEvent[] };
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),

  roomEvents: (roomType: "inner" | "outer") =>
    queryOptions({
      queryKey: ["calendar", "room-events", roomType],
      queryFn: async () => {
        const { data, error } = await api.api.calendar["room-events"].get({
          query: { roomType },
        });
        if (error) throw error;
        return data as RoomEventsResponse;
      },
      staleTime: 30 * 1000, // 30 seconds - refresh frequently for room status
      refetchInterval: 60 * 1000, // Auto-refetch every minute
    }),
};
