import { Elysia, t } from "elysia";
import { prisma } from "@snl-emp/db";
import { authPlugin } from "../auth/plugin.js";

export const calendarRoutes = new Elysia({ prefix: "/api/calendar" })
  .use(authPlugin)

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
