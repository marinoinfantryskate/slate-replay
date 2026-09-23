# Slate Replay

A daily MLB betting-read game. Every day everyone gets the same slate of three real historical
games — team and starter stats as of that morning, the real closing odds, outcomes hidden. You
have five minutes to pick the moneyline and total for each game, then the box scores are revealed
and you get a Wordle-style share string.

```
Slate Replay #12  4/6  ⏱ 2:13
🟩🟨🟩
```

This is the v1 scope of the MVP spec: Daily Mode, Tier 1 info, moneyline + total, reveal, share,
streaks. Practice Mode, the Tier 2 "sweep", personal stats, and CLV are v2.

## Run it locally

Requires Node 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. No database setup: locally the app uses an embedded Postgres (PGlite)
stored in `.pglite/`. Delete that folder to reset all players.

To test the auto-lock without waiting five minutes: `SLATE_TIMER_SECONDS=20 npm run dev`.

```bash
npm test        # grading, share string, slate seeding, day rollover, pool sanity checks
npm run lint
```

## How it works

| Piece | Where |
| --- | --- |
| Data pipeline (Retrosheet + odds → eligible game pool) | `scripts/ingest.py` → `data/pool/{season}.json` |
| Deterministic daily slate (date-seeded PRNG, frozen on first request) | `src/lib/slate.ts`, `src/server/daily.ts` |
| Grading, per-game emoji, share string | `src/lib/grade.ts` |
| Server-side 5:00 timer, auto-lock, streaks | `src/server/daily.ts` |
| API | `src/app/api/daily/*` |
| UI | `src/components/*` |
| Database schema (users, daily_slates, entries, picks) | `src/db/schema.ts`, migrations in `drizzle/` |

**No outcome leakage.** Every pre-game stat is computed from games strictly before the game date.
Before the reveal, the API sends no game id, no exact date, and no result — only the month and
year, teams, park, stats, and odds.

**Timer is per account, server-side.** Opening the slate stamps `started_at`; refreshing or
switching devices keeps the same deadline. Picks save on every tap, so when time runs out the
server locks whatever is selected. Unpicked markets count as misses.

**Accounts.** v1 uses an anonymous account in an httpOnly cookie (no sign-up). Magic-link auth can
attach an email to the same user row later.

### Decisions on the spec's open questions (§9)

- **CLV:** not shown in v1. Daily Mode shows the closing line, so there's no movement to compare
  against. Opening lines are already ingested (`odds.open`) and `picks.clv` exists for v2.
- **Share grid:** one emoji per game. 🟩 = right on every graded market, 🟨 = right on one,
  ⬛ = none. Score is correct / graded picks (6 per slate).
- **Whole-number totals:** landing exactly on the number is a push — void, not counted either way
  (shown as ⬜ only if both markets in a game push).
- **Weather:** Retrosheet's game info includes temperature, sky, and wind, so it's shown on the card.

## Data

`data/pool/2019.json` is committed (2,262 eligible 2019 regular-season games), so the app runs
without downloading anything. To rebuild it or add seasons:

```bash
python3 -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
# put these in data/raw/ (ignored by git):
#   GL2019.TXT           from https://www.retrosheet.org/gamelogs/gl2019.zip
#   2019gameinfo.csv,
#   2019pitching.csv     from https://www.retrosheet.org/downloads/2019/2019csvs.zip
#   mlb-odds-2019.xlsx   from the Sportsbook Review odds archive
npm run ingest -- 2019
```

A game is eligible if it's a completed regular-season game (no suspensions/forfeits), both teams
have played at least 10 games, and it has a matched closing moneyline and total whose final score
agrees with Retrosheet's. The app loads every `data/pool/*.json`; past daily slates are stored in
the database, so adding seasons never changes an earlier day's games.

## Deploying

Any Node host plus Postgres works. For example Vercel + Neon/Supabase: set `DATABASE_URL` and
`NEXT_PUBLIC_SITE_URL`; migrations run automatically on first request.

## Attribution

The information used here was obtained free of charge from and is copyrighted by Retrosheet.
Interested parties may contact Retrosheet at [www.retrosheet.org](https://www.retrosheet.org).
Historical odds from the Sportsbook Review archive.
