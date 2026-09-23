import "server-only";
import path from "node:path";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

// Production: DATABASE_URL points at Postgres. Local dev: an embedded Postgres (PGlite)
// stored in .pglite/, so there's nothing to install.
async function connect(): Promise<DB> {
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return db;
  }
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Connect a Postgres database (e.g. Neon) to this Vercel project.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const db = drizzle(new PGlite(path.join(process.cwd(), ".pglite")), { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as DB;
}

const g = globalThis as unknown as { __srDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  // Cached on globalThis so dev hot-reloads don't open a second PGlite on the same directory.
  g.__srDb ??= connect().catch((err) => {
    g.__srDb = undefined;
    throw err;
  });
  return g.__srDb;
}

export { schema };
