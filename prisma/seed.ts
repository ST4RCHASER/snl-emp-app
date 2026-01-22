import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../packages/db/src/generated/prisma/client.js";
import pg from "pg";

const connectionString = process.env.DATABASE_URL!;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Create default global settings
  await prisma.globalSettings.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      maxConsecutiveLeaveDays: 14,
      maxAnnualLeaveDays: 21,
      maxSickLeaveDays: 10,
      maxPersonalLeaveDays: 5,
      fiscalYearStartMonth: 1,
    },
  });

  console.log("✅ Global settings created");

  // Note: Users will be created through Google OAuth login
  // After first login, you can manually update a user's role to DEVELOPER via:
  // UPDATE users SET role = 'DEVELOPER' WHERE email = 'your-email@example.com';

  console.log("🎉 Seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
