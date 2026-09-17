import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
let pool: Pool | undefined;
let database: ReturnType<typeof drizzle<typeof schema>> | undefined;
export function getDatabase() {
  if (database) return database;
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      "Database is not configured. Add DATABASE_URL to .env.local, then run bun run db:migrate.",
    );
  pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
    statement_timeout: 20000,
    idle_in_transaction_session_timeout: 30000,
    keepAlive: true,
  });
  pool.on("error", () => {
    console.warn(
      "An idle PostgreSQL connection closed; the pool will reconnect.",
    );
  });
  database = drizzle(pool, { schema });
  return database;
}
export async function closeDatabase() {
  await pool?.end();
  database = undefined;
  pool = undefined;
}
