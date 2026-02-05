import { prisma } from "@snl-emp/db";

// Cache maintenance status to avoid hitting DB on every request
let maintenanceCache: {
  enabled: boolean;
  message: string | null;
  lastCheck: number;
} = {
  enabled: false,
  message: null,
  lastCheck: 0,
};

const CACHE_TTL = 5000; // 5 seconds cache

export async function getMaintenanceStatus() {
  const now = Date.now();

  // Return cached value if still valid
  if (now - maintenanceCache.lastCheck < CACHE_TTL) {
    return maintenanceCache;
  }

  // Fetch from database
  const settings = await prisma.globalSettings.findUnique({
    where: { id: "global" },
    select: {
      maintenanceMode: true,
      maintenanceMessage: true,
    },
  });

  maintenanceCache = {
    enabled: settings?.maintenanceMode ?? false,
    message: settings?.maintenanceMessage ?? null,
    lastCheck: now,
  };

  return maintenanceCache;
}

// Paths that should bypass maintenance mode check
const BYPASS_PATHS = [
  "/api/auth", // Auth endpoints (for login)
  "/api/settings/maintenance", // Maintenance status check
  "/health", // Health check
  "/swagger", // Swagger docs
];

export function shouldBypassMaintenance(path: string): boolean {
  return BYPASS_PATHS.some((bypass) => path.startsWith(bypass));
}

export function isDeveloperRole(role: string | null | undefined): boolean {
  return role === "DEVELOPER";
}
