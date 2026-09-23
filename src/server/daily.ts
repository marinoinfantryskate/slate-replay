import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema, type DB } from "@/db";
import { addDays, dayNumber, LOCK_GRACE_MS, slateDateFor } from "@/lib/day";
import { gradePick, isGraded, oddsFor, shareText } from "@/lib/grade";
import { getGame, getPool } from "@/lib/pool";
import { dailySeed, drawSlate } from "@/lib/slate";
import { MARKETS, type Market, type Outcome, type Selection } from "@/lib/types";
import { publicGame, revealedGame, type PickView } from "@/lib/view";
import type { User } from "./user";

type Entry = typeof schema.entries.$inferSelect;

/** 5:00 per spec. SLATE_TIMER_SECONDS exists only to test the auto-lock locally. */
const TIMER_MS = Number(process.env.SLATE_TIMER_SECONDS || 300) * 1000;
type PickRow = typeof schema.picks.$inferSelect;

export class GameError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function ensureSlate(db: DB, date: string): Promise<string[]> {
  const [existing] = await db.select().from(schema.dailySlates).where(eq(schema.dailySlates.date, date));
  if (existing) return existing.gameIds;
  const seed = dailySeed(date);
  const gameIds = drawSlate(getPool(), seed).map((g) => g.id);
  await db.insert(schema.dailySlates).values({ date, gameIds, seed }).onConflictDoNothing();
  const [row] = await db.select().from(schema.dailySlates).where(eq(schema.dailySlates.date, date));
  return row.gameIds;
}

async function findEntry(db: DB, userId: string, date: string): Promise<Entry | undefined> {
  const [entry] = await db
    .select()
    .from(schema.entries)
    .where(
      and(eq(schema.entries.userId, userId), eq(schema.entries.slateDate, date), eq(schema.entries.mode, "daily")),
    );
  return entry;
}

function deadlineOf(entry: Entry): number {
  return entry.startedAt.getTime() + TIMER_MS;
}

/** Lock an entry exactly once: grade every market (unpicked => no_pick) and update the streak. */
async function lockEntry(db: DB, entry: Entry, reason: "submit" | "timer", gameIds: string[]) {
  const submittedAt = reason === "timer" ? new Date(deadlineOf(entry)) : new Date();
  await db.transaction(async (tx) => {
    const claimed = await tx
      .update(schema.entries)
      .set({ locked: true, submittedAt, lockReason: reason })
      .where(and(eq(schema.entries.id, entry.id), eq(schema.entries.locked, false)))
      .returning();
    if (claimed.length === 0) return; // someone else locked it first

    const existing = await tx.select().from(schema.picks).where(eq(schema.picks.entryId, entry.id));
    let picksCount = 0;
    let correct = 0;
    for (const gameId of gameIds) {
      const game = getGame(gameId);
      for (const market of MARKETS) {
        const row = existing.find((p) => p.gameId === gameId && p.market === market);
        const outcome = gradePick(game, market, (row?.selection as Selection | null) ?? null);
        if (isGraded(outcome)) picksCount++;
        if (outcome === "win") correct++;
        if (row) {
          await tx.update(schema.picks).set({ outcome }).where(eq(schema.picks.id, row.id));
        } else {
          await tx.insert(schema.picks).values({ entryId: entry.id, gameId, market, selection: null, outcome });
        }
      }
    }

    const date = entry.slateDate!;
    const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, entry.userId));
    const streak =
      user.lastPlayedDate === date
        ? user.currentStreak
        : user.lastPlayedDate === addDays(date, -1)
          ? user.currentStreak + 1
          : 1;
    await tx
      .update(schema.users)
      .set({
        currentStreak: streak,
        longestStreak: Math.max(user.longestStreak, streak),
        lastPlayedDate: date,
        lifetimePicks: sql`${schema.users.lifetimePicks} + ${picksCount}`,
        lifetimeCorrect: sql`${schema.users.lifetimeCorrect} + ${correct}`,
      })
      .where(eq(schema.users.id, entry.userId));
  });
}

async function lockIfExpired(db: DB, entry: Entry, gameIds: string[]): Promise<Entry> {
  if (entry.locked || Date.now() < deadlineOf(entry) + LOCK_GRACE_MS) return entry;
  await lockEntry(db, entry, "timer", gameIds);
  return (await findEntry(db, entry.userId, entry.slateDate!))!;
}

function pickViews(rows: PickRow[], gameIds: string[], withOutcome: boolean): PickView[] {
  return rows.map((p) => ({
    slot: gameIds.indexOf(p.gameId),
    market: p.market,
    selection: p.selection,
    ...(withOutcome && p.outcome ? { outcome: p.outcome } : {}),
  }));
}

function streakView(user: User | null, today: string) {
  if (!user) return { current: 0, longest: 0 };
  const alive = user.lastPlayedDate === today || user.lastPlayedDate === addDays(today, -1);
  return { current: alive ? user.currentStreak : 0, longest: user.longestStreak };
}

export async function dailyState(user: User | null, siteUrl?: string) {
  const db = await getDb();
  const date = slateDateFor();
  const base = { day: dayNumber(date), date, gameCount: 0 };
  const gameIds = await ensureSlate(db, date);
  base.gameCount = gameIds.length;

  let entry = user ? await findEntry(db, user.id, date) : undefined;
  if (!user || !entry) return { ...base, status: "new" as const, streak: streakView(user, date) };

  entry = await lockIfExpired(db, entry, gameIds);
  const rows = await db.select().from(schema.picks).where(eq(schema.picks.entryId, entry.id));
  // Re-read the user: locking may have just changed the streak.
  const [fresh] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
  const streak = streakView(fresh, date);

  if (!entry.locked) {
    return {
      ...base,
      status: "playing" as const,
      streak,
      deadline: deadlineOf(entry),
      timerMs: TIMER_MS,
      serverNow: Date.now(),
      games: gameIds.map((id, slot) => publicGame(getGame(id), slot)),
      picks: pickViews(rows, gameIds, false),
    };
  }

  const timeLeftMs = Math.max(0, deadlineOf(entry) - entry.submittedAt!.getTime());
  const outcomesByGame = gameIds.map((id) =>
    MARKETS.map((m) => (rows.find((p) => p.gameId === id && p.market === m)?.outcome ?? "no_pick") as Outcome),
  );
  return {
    ...base,
    status: "locked" as const,
    streak,
    lockReason: entry.lockReason,
    timeLeftMs,
    games: gameIds.map((id, slot) => revealedGame(getGame(id), slot)),
    picks: pickViews(rows, gameIds, true),
    share: shareText({ day: base.day, games: outcomesByGame, timeLeftMs, url: siteUrl }),
  };
}

export type DailyState = Awaited<ReturnType<typeof dailyState>>;

export async function startDaily(user: User) {
  const db = await getDb();
  const date = slateDateFor();
  await ensureSlate(db, date);
  // Idempotent: a second start (refresh, other device) keeps the original started_at.
  await db
    .insert(schema.entries)
    .values({ userId: user.id, slateDate: date, mode: "daily" })
    .onConflictDoNothing();
}

async function openEntry(db: DB, user: User) {
  const date = slateDateFor();
  const gameIds = await ensureSlate(db, date);
  const entry = await findEntry(db, user.id, date);
  if (!entry) throw new GameError("No slate started today", 409);
  const current = await lockIfExpired(db, entry, gameIds);
  if (current.locked) throw new GameError("Entry is locked", 409);
  return { entry: current, gameIds };
}

export async function setDailyPick(user: User, slot: number, market: Market, selection: Selection | null) {
  const db = await getDb();
  const { entry, gameIds } = await openEntry(db, user);
  const gameId = gameIds[slot];
  if (!gameId) throw new GameError("Unknown game", 400);
  const game = getGame(gameId);
  const values = {
    selection,
    oddsAtPick: selection ? oddsFor(game, market, selection) : null,
    line: market === "total" ? game.odds.total.line : null,
    updatedAt: new Date(),
  };
  await db
    .insert(schema.picks)
    .values({ entryId: entry.id, gameId, market, ...values })
    .onConflictDoUpdate({ target: [schema.picks.entryId, schema.picks.gameId, schema.picks.market], set: values });
}

export async function submitDaily(user: User) {
  const db = await getDb();
  const { entry, gameIds } = await openEntry(db, user);
  await lockEntry(db, entry, "submit", gameIds);
}
