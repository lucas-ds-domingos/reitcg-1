import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada. Copie .env.example para .env.");

export default defineConfig({
  out: "./drizzle-neon",
  schema: "./db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
});
