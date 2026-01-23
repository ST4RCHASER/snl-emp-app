import { Elysia, t } from "elysia";
import { prisma } from "@snl-emp/db";
import { authPlugin } from "../auth/plugin.js";

// Meeting room IDs
const ROOM_IDS = {
  inner: "c_1887472gl1bvkjsok2o218lns0ip4@resource.calendar.google.com",
  outer: "c_1882cla4qjt9shoclkd8b11drdmno@resource.calendar.google.com",
} as const;

// Company holidays calendar ID
const COMPANY_HOLIDAYS_CALENDAR_ID =
  "c_439fbc0ed0e37a719d970d9a129873597a09de3306f07cc017b331c25d64ce43@group.calendar.google.com";

const ROOM_NAMES = {
  inner: "Inner Room",
  outer: "Outer Room",
} as const;

// Type for Google Calendar event
interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  organizer?: { email?: string; displayName?: string };
  creator?: { email?: string; displayName?: string };
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
    resource?: boolean;
  }>;
  location?: string;
}

export const calendarRoutes = new Elysia({ prefix: "/api/calendar" })
  .use(authPlugin)

  // Get meeting room events by looking up the user's calendar
  .get(
    "/room-events",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const roomType = query.roomType as "inner" | "outer";
      const roomId = ROOM_IDS[roomType];
      const roomName = ROOM_NAMES[roomType];

      if (!roomId) {
        set.status = 400;
        return { message: "Invalid room type. Use 'inner' or 'outer'" };
      }

      // Get the user's Google account to retrieve access token
      const account = await prisma.account.findFirst({
        where: {
          userId: user.id,
          providerId: "google",
        },
      });

      if (!account || !account.accessToken) {
        set.status = 400;
        return { message: "Google account not linked or no access token" };
      }

      // Calculate time range for today
      const now = new Date();
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );
      const endOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      );

      const timeMin = startOfDay.toISOString();
      const timeMax = endOfDay.toISOString();

      // Helper to fetch calendar events from a specific calendar
      const fetchCalendarEvents = async (
        accessToken: string,
        calendarId: string,
      ) => {
        return fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
            new URLSearchParams({
              timeMin,
              timeMax,
              singleEvents: "true",
              orderBy: "startTime",
              maxResults: "100",
            }),
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
      };

      try {
        // Check if token is expired or will expire soon
        const tokenExpiry = account.accessTokenExpiresAt;
        const isTokenExpiringSoon =
          tokenExpiry &&
          new Date(tokenExpiry).getTime() < Date.now() + 5 * 60 * 1000;

        let currentAccessToken = account.accessToken;

        // Proactively refresh if token is expiring soon
        if (isTokenExpiringSoon && account.refreshToken) {
          const refreshed = await refreshAccessToken(account.refreshToken);
          if (refreshed) {
            await prisma.account.update({
              where: { id: account.id },
              data: {
                accessToken: refreshed.access_token,
                ...(refreshed.expires_in && {
                  accessTokenExpiresAt: new Date(
                    Date.now() + refreshed.expires_in * 1000,
                  ),
                }),
              },
            });
            currentAccessToken = refreshed.access_token;
          }
        }

        // Fetch events from the room's calendar directly
        let response = await fetchCalendarEvents(currentAccessToken, roomId);

        // If we get a 401, try to refresh the token
        if (response.status === 401 && account.refreshToken) {
          const refreshed = await refreshAccessToken(account.refreshToken);
          if (refreshed) {
            await prisma.account.update({
              where: { id: account.id },
              data: {
                accessToken: refreshed.access_token,
                ...(refreshed.expires_in && {
                  accessTokenExpiresAt: new Date(
                    Date.now() + refreshed.expires_in * 1000,
                  ),
                }),
              },
            });
            currentAccessToken = refreshed.access_token;
            response = await fetchCalendarEvents(currentAccessToken, roomId);
          } else {
            set.status = 401;
            return { message: "Session expired. Please sign in again." };
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Google Calendar API error for room:", errorData);

          if (response.status === 404) {
            set.status = 404;
            return { message: "Room calendar not found or not accessible" };
          }

          set.status = response.status;
          return {
            message: errorData.error?.message || "Failed to fetch room events",
          };
        }

        const roomData = await response.json();
        const roomEvents = (roomData.items || []) as GoogleCalendarEvent[];

        // Process each room event: get organizer email, fetch their calendar, find matching event
        const processedEvents: Array<{
          id: string;
          summary: string;
          start: string;
          end: string;
          organizer: string;
          attendeesCount: number;
        }> = [];

        // Cache for organizer calendars to avoid duplicate fetches
        const organizerCalendarCache = new Map<string, GoogleCalendarEvent[]>();

        for (const roomEvent of roomEvents) {
          const startTime =
            roomEvent.start?.dateTime || roomEvent.start?.date || "";
          const endTime = roomEvent.end?.dateTime || roomEvent.end?.date || "";

          // Get organizer email from room event (the person who booked the room)
          const organizerEmail =
            roomEvent.organizer?.email || roomEvent.creator?.email;

          // Skip if organizer is the room itself or no organizer
          if (!organizerEmail || organizerEmail.includes("resource.calendar")) {
            processedEvents.push({
              id: roomEvent.id,
              summary: roomEvent.summary || "Busy",
              start: startTime,
              end: endTime,
              organizer: "Reserved",
              attendeesCount: 1,
            });
            continue;
          }

          // Fetch organizer's calendar (use cache if available)
          let organizerEvents = organizerCalendarCache.get(organizerEmail);

          if (!organizerEvents) {
            try {
              const orgResponse = await fetchCalendarEvents(
                currentAccessToken,
                organizerEmail,
              );
              if (orgResponse.ok) {
                const orgData = await orgResponse.json();
                organizerEvents = (orgData.items ||
                  []) as GoogleCalendarEvent[];
                organizerCalendarCache.set(organizerEmail, organizerEvents);
              }
            } catch (err) {
              // If we can't access organizer's calendar, fall back to room event data
              console.log(`Cannot access calendar for ${organizerEmail}`);
            }
          }

          // Find matching event in organizer's calendar by time
          let matchedEvent: GoogleCalendarEvent | undefined;
          if (organizerEvents) {
            matchedEvent = organizerEvents.find((orgEvent) => {
              const orgStart =
                orgEvent.start?.dateTime || orgEvent.start?.date || "";
              const orgEnd = orgEvent.end?.dateTime || orgEvent.end?.date || "";
              return orgStart === startTime && orgEnd === endTime;
            });
          }

          // Use matched event details or fall back to room event
          const sourceEvent = matchedEvent || roomEvent;

          // Get organizer name
          let organizerName = organizerEmail.split("@")[0];
          if (sourceEvent.creator?.displayName) {
            organizerName = sourceEvent.creator.displayName;
          } else if (sourceEvent.organizer?.displayName) {
            organizerName = sourceEvent.organizer.displayName;
          }

          // Count attendees (exclude resources)
          const attendeesCount = (sourceEvent.attendees || []).filter(
            (a) => !a.resource && !a.email?.includes("resource.calendar"),
          ).length;

          processedEvents.push({
            id: roomEvent.id,
            summary: sourceEvent.summary || "Meeting",
            start: startTime,
            end: endTime,
            organizer: organizerName,
            attendeesCount: Math.max(attendeesCount, 1),
          });
        }

        // Sort by start time
        const events = processedEvents.sort(
          (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
        );

        // Determine current status
        const currentTime = new Date();
        let currentMeeting = null;
        let nextMeeting = null;

        for (const event of events) {
          const start = new Date(event.start);
          const end = new Date(event.end);

          if (currentTime >= start && currentTime < end) {
            currentMeeting = event;
          } else if (currentTime < start && !nextMeeting) {
            nextMeeting = event;
          }
        }

        return {
          roomType,
          roomName,
          events,
          currentMeeting,
          nextMeeting,
          isOccupied: !!currentMeeting,
        };
      } catch (error) {
        console.error("Room Calendar API error:", error);
        set.status = 500;
        return { message: "Failed to fetch room events" };
      }
    },
    {
      query: t.Object({
        roomType: t.String(),
      }),
      detail: {
        tags: ["Calendar"],
        summary: "Get meeting room events for today",
      },
    },
  )

  // Get calendar events from Google Calendar
  .get(
    "/events",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      // Get the user's Google account to retrieve access token
      const account = await prisma.account.findFirst({
        where: {
          userId: user.id,
          providerId: "google",
        },
      });

      if (!account || !account.accessToken) {
        set.status = 400;
        return { message: "Google account not linked or no access token" };
      }

      // Calculate time range
      const timeMin = query.timeMin || new Date().toISOString();
      const timeMax =
        query.timeMax ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now

      // Helper to fetch calendar events
      const fetchCalendarEvents = async (accessToken: string) => {
        return fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            new URLSearchParams({
              timeMin,
              timeMax,
              singleEvents: "true",
              orderBy: "startTime",
              maxResults: "50",
            }),
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
      };

      try {
        // Check if token is expired or will expire soon (within 5 minutes)
        const tokenExpiry = account.accessTokenExpiresAt;
        const isTokenExpiringSoon =
          tokenExpiry &&
          new Date(tokenExpiry).getTime() < Date.now() + 5 * 60 * 1000;

        let currentAccessToken = account.accessToken;

        // Proactively refresh if token is expiring soon
        if (isTokenExpiringSoon && account.refreshToken) {
          console.log("Access token expiring soon, proactively refreshing...");
          const refreshed = await refreshAccessToken(account.refreshToken);
          if (refreshed) {
            await prisma.account.update({
              where: { id: account.id },
              data: {
                accessToken: refreshed.access_token,
                ...(refreshed.expires_in && {
                  accessTokenExpiresAt: new Date(
                    Date.now() + refreshed.expires_in * 1000,
                  ),
                }),
              },
            });
            currentAccessToken = refreshed.access_token;
            console.log("Proactive token refresh successful");
          }
        }

        // Fetch events from Google Calendar API
        let response = await fetchCalendarEvents(currentAccessToken);

        // If we get a 401, try to refresh the token
        if (response.status === 401 && account.refreshToken) {
          console.log("Got 401 from Calendar API, attempting token refresh...");
          const refreshed = await refreshAccessToken(account.refreshToken);

          if (refreshed) {
            // Update the access token in database
            await prisma.account.update({
              where: { id: account.id },
              data: {
                accessToken: refreshed.access_token,
                ...(refreshed.expires_in && {
                  accessTokenExpiresAt: new Date(
                    Date.now() + refreshed.expires_in * 1000,
                  ),
                }),
              },
            });
            console.log("Token refresh successful, retrying request...");

            // Retry the request with new token
            response = await fetchCalendarEvents(refreshed.access_token);
          } else {
            console.error(
              "Token refresh failed - user needs to re-authenticate",
            );
            set.status = 401;
            return {
              message:
                "Session expired. Please sign out and sign in again to reconnect your Google account.",
            };
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Google Calendar API error:", errorData);

          if (response.status === 401) {
            set.status = 401;
            return {
              message:
                "Session expired. Please sign out and sign in again to reconnect your Google account.",
            };
          }

          set.status = response.status;
          return {
            message:
              errorData.error?.message || "Failed to fetch calendar events",
          };
        }

        const data = await response.json();
        return { events: data.items || [] };
      } catch (error) {
        console.error("Calendar API error:", error);
        set.status = 500;
        return { message: "Failed to fetch calendar events" };
      }
    },
    {
      query: t.Object({
        timeMin: t.Optional(t.String()),
        timeMax: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Calendar"],
        summary: "Get calendar events from Google Calendar",
      },
    },
  )

  // Get company holidays
  .get(
    "/holidays",
    async ({ user, set, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      // Get the user's Google account to retrieve access token
      const account = await prisma.account.findFirst({
        where: {
          userId: user.id,
          providerId: "google",
        },
      });

      if (!account || !account.accessToken) {
        set.status = 400;
        return { message: "Google account not linked or no access token" };
      }

      // Calculate time range
      const timeMin = query.timeMin || new Date().toISOString();
      const timeMax =
        query.timeMax ||
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year from now

      // Helper to fetch holidays
      const fetchHolidays = async (accessToken: string) => {
        return fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(COMPANY_HOLIDAYS_CALENDAR_ID)}/events?` +
            new URLSearchParams({
              timeMin,
              timeMax,
              singleEvents: "true",
              orderBy: "startTime",
              maxResults: "100",
            }),
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
      };

      try {
        // Check if token is expired or will expire soon
        const tokenExpiry = account.accessTokenExpiresAt;
        const isTokenExpiringSoon =
          tokenExpiry &&
          new Date(tokenExpiry).getTime() < Date.now() + 5 * 60 * 1000;

        let currentAccessToken = account.accessToken;

        // Proactively refresh if token is expiring soon
        if (isTokenExpiringSoon && account.refreshToken) {
          const refreshed = await refreshAccessToken(account.refreshToken);
          if (refreshed) {
            await prisma.account.update({
              where: { id: account.id },
              data: {
                accessToken: refreshed.access_token,
                ...(refreshed.expires_in && {
                  accessTokenExpiresAt: new Date(
                    Date.now() + refreshed.expires_in * 1000,
                  ),
                }),
              },
            });
            currentAccessToken = refreshed.access_token;
          }
        }

        // Fetch holidays
        let response = await fetchHolidays(currentAccessToken);

        // If we get a 401, try to refresh the token
        if (response.status === 401 && account.refreshToken) {
          const refreshed = await refreshAccessToken(account.refreshToken);
          if (refreshed) {
            await prisma.account.update({
              where: { id: account.id },
              data: {
                accessToken: refreshed.access_token,
                ...(refreshed.expires_in && {
                  accessTokenExpiresAt: new Date(
                    Date.now() + refreshed.expires_in * 1000,
                  ),
                }),
              },
            });
            currentAccessToken = refreshed.access_token;
            response = await fetchHolidays(currentAccessToken);
          } else {
            set.status = 401;
            return { message: "Session expired. Please sign in again." };
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Google Calendar API error for holidays:", errorData);

          if (response.status === 404) {
            // Calendar not found or not accessible - return empty array
            return { holidays: [] };
          }

          set.status = response.status;
          return {
            message: errorData.error?.message || "Failed to fetch holidays",
          };
        }

        const data = await response.json();
        const holidays = (data.items || []).map(
          (event: GoogleCalendarEvent) => ({
            id: event.id,
            summary: event.summary || "Holiday",
            description: event.description || undefined,
            start: event.start?.dateTime || event.start?.date || "",
            end: event.end?.dateTime || event.end?.date || "",
            isAllDay: !!event.start?.date,
          }),
        );

        return { holidays };
      } catch (error) {
        console.error("Holidays API error:", error);
        set.status = 500;
        return { message: "Failed to fetch holidays" };
      }
    },
    {
      query: t.Object({
        timeMin: t.Optional(t.String()),
        timeMax: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Calendar"],
        summary: "Get company holidays from shared calendar",
      },
    },
  )

  // Get team member's calendar events (for managers)
  .get(
    "/team-member/:employeeId",
    async ({ user, set, params, query }) => {
      if (!user) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      const { employeeId } = params;

      // Get the requesting user's employee record to check if they're a manager
      const requestingEmployee = await prisma.employee.findUnique({
        where: { userId: user.id },
      });

      if (!requestingEmployee) {
        set.status = 403;
        return { message: "Employee record not found" };
      }

      // Get the target employee
      const targetEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              image: true,
            },
          },
        },
      });

      if (!targetEmployee) {
        set.status = 404;
        return { message: "Team member not found" };
      }

      // Check if the requesting user is the manager of this employee
      const isManager = await prisma.employeeManagement.findFirst({
        where: {
          employeeId: targetEmployee.id,
          managerId: requestingEmployee.id,
        },
      });

      if (!isManager) {
        // Also allow if user has HR or DEVELOPER role
        if (user.role !== "HR" && user.role !== "DEVELOPER") {
          set.status = 403;
          return {
            message: "You can only view calendars of your team members",
          };
        }
      }

      // Get the target employee's Google account
      const account = await prisma.account.findFirst({
        where: {
          userId: targetEmployee.userId,
          providerId: "google",
        },
      });

      if (!account || !account.accessToken) {
        set.status = 400;
        return { message: "Team member has not linked their Google account" };
      }

      // Calculate time range
      const timeMin = query.timeMin || new Date().toISOString();
      const timeMax =
        query.timeMax ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Helper to fetch calendar events
      const fetchCalendarEvents = async (accessToken: string) => {
        return fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
            new URLSearchParams({
              timeMin,
              timeMax,
              singleEvents: "true",
              orderBy: "startTime",
              maxResults: "250",
            }),
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );
      };

      try {
        // Check if token is expired or will expire soon
        const tokenExpiry = account.accessTokenExpiresAt;
        const isTokenExpiringSoon =
          tokenExpiry &&
          new Date(tokenExpiry).getTime() < Date.now() + 5 * 60 * 1000;

        let currentAccessToken = account.accessToken;

        // Proactively refresh if token is expiring soon
        if (isTokenExpiringSoon && account.refreshToken) {
          const refreshed = await refreshAccessToken(account.refreshToken);
          if (refreshed) {
            await prisma.account.update({
              where: { id: account.id },
              data: {
                accessToken: refreshed.access_token,
                ...(refreshed.expires_in && {
                  accessTokenExpiresAt: new Date(
                    Date.now() + refreshed.expires_in * 1000,
                  ),
                }),
              },
            });
            currentAccessToken = refreshed.access_token;
          }
        }

        // Fetch events
        let response = await fetchCalendarEvents(currentAccessToken);

        // If we get a 401, try to refresh the token
        if (response.status === 401 && account.refreshToken) {
          const refreshed = await refreshAccessToken(account.refreshToken);
          if (refreshed) {
            await prisma.account.update({
              where: { id: account.id },
              data: {
                accessToken: refreshed.access_token,
                ...(refreshed.expires_in && {
                  accessTokenExpiresAt: new Date(
                    Date.now() + refreshed.expires_in * 1000,
                  ),
                }),
              },
            });
            currentAccessToken = refreshed.access_token;
            response = await fetchCalendarEvents(currentAccessToken);
          } else {
            set.status = 401;
            return { message: "Team member's session expired" };
          }
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error(
            "Google Calendar API error for team member:",
            errorData,
          );
          set.status = response.status;
          return {
            message:
              errorData.error?.message || "Failed to fetch calendar events",
          };
        }

        const data = await response.json();
        return {
          employee: {
            id: targetEmployee.id,
            fullName: targetEmployee.fullName,
            nickname: targetEmployee.nickname,
            email: targetEmployee.user.email,
            avatar: targetEmployee.avatar || targetEmployee.user.image,
          },
          events: data.items || [],
        };
      } catch (error) {
        console.error("Team member calendar API error:", error);
        set.status = 500;
        return { message: "Failed to fetch calendar events" };
      }
    },
    {
      params: t.Object({
        employeeId: t.String(),
      }),
      query: t.Object({
        timeMin: t.Optional(t.String()),
        timeMax: t.Optional(t.String()),
      }),
      detail: {
        tags: ["Calendar"],
        summary: "Get team member's calendar events (for managers)",
      },
    },
  );

// Helper function to refresh access token
async function refreshAccessToken(
  refreshToken: string,
): Promise<{ access_token: string; expires_in?: number } | null> {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(
        "Token refresh successful, new token expires in:",
        data.expires_in,
        "seconds",
      );
      return data;
    }

    const errorData = await response.json().catch(() => ({}));
    console.error("Token refresh failed:", errorData);
    return null;
  } catch (error) {
    console.error("Token refresh error:", error);
    return null;
  }
}
