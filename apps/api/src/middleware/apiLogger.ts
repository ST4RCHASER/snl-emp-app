import { prisma } from "@snl-emp/db";

// Sanitize headers - only keep useful ones
function sanitizeHeaders(headers: Headers): Record<string, string> {
  const keepHeaders = [
    "content-type",
    "accept",
    "user-agent",
    "origin",
    "referer",
  ];
  const result: Record<string, string> = {};

  headers.forEach((value, key) => {
    if (keepHeaders.includes(key.toLowerCase())) {
      result[key] = value;
    }
  });

  return result;
}

// Helper to check if path should be skipped
function shouldSkipPath(path: string): boolean {
  return (
    path === "/health" ||
    path === "/" ||
    path.startsWith("/swagger") ||
    path.startsWith("/api/audit") ||
    path.startsWith("/api/auth")
  );
}

// Log API request to database
export function logApiRequest(
  request: Request,
  set: { status?: number | string },
  startTime?: number,
  userId?: string,
) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (shouldSkipPath(path)) {
    return;
  }

  const responseTime = startTime ? Date.now() - startTime : 0;
  const statusCode = typeof set.status === "number" ? set.status : 200;

  // Parse query params
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  // Fire and forget - log to database asynchronously
  prisma.apiLog
    .create({
      data: {
        userId,
        method: request.method,
        path,
        query: Object.keys(query).length > 0 ? query : undefined,
        headers: sanitizeHeaders(request.headers),
        statusCode,
        responseTime,
        ipAddress:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    })
    .catch((err) => {
      console.error("[API Logger] Failed to log:", err);
    });
}
