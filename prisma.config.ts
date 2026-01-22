import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "prisma/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from root
config({ path: resolve(__dirname, ".env") });

export default defineConfig({
  earlyAccess: true,
  schema: resolve(__dirname, "prisma/schema.prisma"),
});
