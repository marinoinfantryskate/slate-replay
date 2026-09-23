import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Game } from "./types";

const POOL_DIR = path.join(process.cwd(), "data", "pool");

let cache: { list: Game[]; byId: Map<string, Game> } | null = null;

/** All eligible games across every ingested season, in a stable order (by id). */
function load() {
  if (cache) return cache;
  const files = fs.readdirSync(POOL_DIR).filter((f) => f.endsWith(".json")).sort();
  const list = files
    .flatMap((f) => JSON.parse(fs.readFileSync(path.join(POOL_DIR, f), "utf8")) as Game[])
    .sort((a, b) => a.id.localeCompare(b.id));
  cache = { list, byId: new Map(list.map((g) => [g.id, g])) };
  return cache;
}

export function getPool(): Game[] {
  return load().list;
}

export function getGame(id: string): Game {
  const g = load().byId.get(id);
  if (!g) throw new Error(`Game ${id} missing from pool`);
  return g;
}
