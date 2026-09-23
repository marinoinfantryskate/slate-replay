import { seededRandom } from "./rng";
import type { Game } from "./types";

export const SLATE_SIZE = 3;

/**
 * Deterministically draw a slate from the eligible pool. Same date + same pool => same games.
 * No team appears twice in a slate, so the games feel distinct.
 */
export function drawSlate(pool: Game[], seed: string, size = SLATE_SIZE): Game[] {
  const rand = seededRandom(seed);
  const picked: Game[] = [];
  const teams = new Set<string>();
  const used = new Set<number>();
  let attempts = 0;
  while (picked.length < size && attempts < 10_000) {
    attempts++;
    const i = Math.floor(rand() * pool.length);
    if (used.has(i)) continue;
    used.add(i);
    const g = pool[i];
    if (teams.has(g.away.code) || teams.has(g.home.code)) continue;
    teams.add(g.away.code);
    teams.add(g.home.code);
    picked.push(g);
  }
  if (picked.length < size) throw new Error("Pool too small to draw a slate");
  return picked;
}

export function dailySeed(date: string): string {
  return `slate-replay:daily:${date}`;
}
