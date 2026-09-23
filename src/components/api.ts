import type { DailyState } from "@/server/daily";
import type { Market, Selection } from "@/lib/types";

export type { DailyState };
export type PlayingState = Extract<DailyState, { status: "playing" }>;
export type LockedState = Extract<DailyState, { status: "locked" }>;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init, headers: { "content-type": "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status });
  return body as T;
}

export const api = {
  state: () => call<DailyState>("/api/daily"),
  start: () => call<DailyState>("/api/daily/start", { method: "POST" }),
  submit: () => call<DailyState>("/api/daily/submit", { method: "POST" }),
  testReset: () => call<DailyState>("/api/test/reset", { method: "POST" }),
  testDay: (move: "next" | "today") =>
    call<DailyState>("/api/test/day", { method: "POST", body: JSON.stringify({ move }) }),
  pick: (slot: number, market: Market, selection: Selection | null) =>
    call<{ ok: true }>("/api/daily/pick", { method: "PUT", body: JSON.stringify({ slot, market, selection }) }),
};
