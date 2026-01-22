import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";
import pg from "pg";

const connectionString = process.env.DATABASE_URL!;

const pool = new pg.Pool({
  connectionString,
  max: 10, // Maximum number of connections
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout after 10 seconds if can't connect
});

// Handle pool errors
pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
});

const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "./generated/prisma/client.js";
export type { PrismaClient };
