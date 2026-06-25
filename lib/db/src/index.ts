import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Cloud databases (Neon, Railway Postgres, etc.) require SSL.
// rejectUnauthorized: false avoids cert chain issues across cloud providers.
const isCloudDb =
  connectionString.includes("sslmode=require") ||
  connectionString.includes(".neon.tech");

export const pool = new Pool({
  connectionString,
  ssl: isCloudDb ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
