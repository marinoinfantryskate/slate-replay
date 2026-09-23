import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Historical games + odds are immutable and live in data/pool/*.json (see scripts/ingest.py);
// the database only holds per-player state and the frozen daily slates.

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  /** Slate date (YYYY-MM-DD) of the last daily entry this user locked. */
  lastPlayedDate: text("last_played_date"),
  lifetimePicks: integer("lifetime_picks").notNull().default(0),
  lifetimeCorrect: integer("lifetime_correct").notNull().default(0),
});

export const dailySlates = pgTable("daily_slates", {
  // Frozen on first request so adding seasons to the pool never changes a past day's slate.
  date: text("date").primaryKey(),
  gameIds: jsonb("game_ids").$type<string[]>().notNull(),
  seed: text("seed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    slateDate: text("slate_date"), // null for practice sessions
    mode: text("mode", { enum: ["daily", "practice"] }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    locked: boolean("locked").notNull().default(false),
    lockReason: text("lock_reason", { enum: ["submit", "timer"] }),
  },
  (t) => [uniqueIndex("entries_user_daily").on(t.userId, t.slateDate, t.mode)],
);

export const picks = pgTable(
  "picks",
  {
    id: serial("id").primaryKey(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id),
    gameId: text("game_id").notNull(),
    market: text("market", { enum: ["moneyline", "total"] }).notNull(),
    selection: text("selection", { enum: ["away", "home", "over", "under"] }),
    oddsAtPick: integer("odds_at_pick"),
    /** The total's line at pick time (null for moneyline). */
    line: real("line"),
    outcome: text("outcome", { enum: ["win", "loss", "push", "no_pick"] }),
    /** Closing-line value; null until opening-line data is used (spec §9). */
    clv: real("clv"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("picks_entry_game_market").on(t.entryId, t.gameId, t.market)],
);
