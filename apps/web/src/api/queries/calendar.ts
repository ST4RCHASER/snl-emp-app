import { queryOptions } from "@tanstack/react-query";
import { api } from "../client";

export interface CalendarEventAttendee {
  email?: string;
  displayName?: string;
  responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
  organizer?: boolean;
  self?: boolean;
  resource?: boolean;
}

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
  // Additional fields from Google Calendar API
  recurrence?: string[];
  recurringEventId?: string;
  organizer?: {
    email?: string;
    displayName?: string;
    self?: boolean;
  };
  creator?: {
    email?: string;
    displayName?: string;
    self?: boolean;
  };
  attendees?: CalendarEventAttendee[];
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
      label?: string;
    }>;
    conferenceSolution?: {
      name: string;
      iconUri?: string;
    };
  };
  visibility?: "default" | "public" | "private" | "confidential";
  transparency?: "opaque" | "transparent";
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

export interface Holiday {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  isAllDay: boolean;
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

  holidays: (timeMin?: string, timeMax?: string) =>
    queryOptions({
      queryKey: ["calendar", "holidays", timeMin, timeMax],
      queryFn: async () => {
        const { data, error } = await api.api.calendar.holidays.get({
          query: { timeMin, timeMax },
        });
        if (error) throw error;
        return data as { holidays: Holiday[] };
      },
      staleTime: 60 * 60 * 1000, // 1 hour - holidays don't change often
    }),

  teamMemberEvents: (employeeId: string, timeMin?: string, timeMax?: string) =>
    queryOptions({
      queryKey: ["calendar", "team-member", employeeId, timeMin, timeMax],
      queryFn: async () => {
        const { data, error } = await api.api.calendar["team-member"]({
          employeeId,
        }).get({
          query: { timeMin, timeMax },
        });
        if (error) throw error;
        return data as {
          employee: {
            id: string;
            fullName: string | null;
            nickname: string | null;
            email: string;
            avatar: string | null;
          };
          events: CalendarEvent[];
        };
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    }),
};
