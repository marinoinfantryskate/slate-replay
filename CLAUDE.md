@AGENTS.md

# Slate Replay

Daily MLB betting-read game (Next.js 16 App Router + Drizzle/Postgres). See README.md for the
architecture map and the product decisions already made.

- Commands: `npm run dev`, `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run ingest -- <season>`.
- Historical games/odds are static JSON in `data/pool/`; the DB only holds player state and frozen daily slates.
- Never send game id, exact date, or result to the client before an entry is locked (`src/lib/view.ts`).
- Schema changes: edit `src/db/schema.ts`, then `npm run db:generate` and commit the new `drizzle/` migration.
