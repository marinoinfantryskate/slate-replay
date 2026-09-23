import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb, schema } from "@/db";

// v1 identity is an anonymous account bound to a long-lived cookie (no sign-up, Wordle-style).
// Magic-link auth can later attach an email to the same users row.
const COOKIE = "sr_uid";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type User = typeof schema.users.$inferSelect;

export async function currentUser(): Promise<User | null> {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id || !UUID_RE.test(id)) return null;
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  return user ?? null;
}

/** Only callable from Route Handlers / Server Functions (sets a cookie). */
export async function currentOrNewUser(): Promise<User> {
  const existing = await currentUser();
  if (existing) return existing;
  const db = await getDb();
  const [user] = await db.insert(schema.users).values({}).returning();
  (await cookies()).set(COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 400,
    path: "/",
  });
  return user;
}
