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
};
