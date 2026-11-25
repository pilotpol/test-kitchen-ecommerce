import "server-only";

import { Pool, type QueryResultRow } from "pg";

/**
 * The application's own PostgreSQL database.
 *
 * DATABASE_URL is written by the platform at deploy time: one login and one
 * schema per application, with a fresh password on every deploy, so nothing
 * here (and nothing in the repository) holds a credential. The login's
 * search_path is its own schema, so `CREATE TABLE notes (...)` lands there and
 * another application's tables are not visible at all.
 *
 * Server-side only. Import it from route handlers and server components, never
 * from a "use client" file.
 *
 * Create tables idempotently (CREATE TABLE IF NOT EXISTS) on first use, or in a
 * small migrate step at start-up; there is no separate migration runner.
 */

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set: the platform sets it when the app is deployed");
  }
  // Small on purpose: the database login allows ten connections per app.
  pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 });
  return pool;
}

/** Parameterised query. Always pass values as `params`, never inside `text`. */
export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(text, params);
  return result.rows;
}
