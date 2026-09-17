import { config } from "dotenv";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { getDatabase, closeDatabase } from "../src/db/client";
config({ path: ".env.local", quiet: true });
try {
  await migrate(getDatabase(), { migrationsFolder: "./drizzle" });
  console.log("PostgreSQL schema migrations applied.");
} catch {
  console.error(
    "Database migration failed. Check DATABASE_URL and Neon connectivity. No credentials are printed.",
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
