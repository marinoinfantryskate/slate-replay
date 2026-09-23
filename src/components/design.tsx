"use client";

import { useSyncExternalStore } from "react";
import { DESIGN_STORAGE_KEY as STORAGE_KEY } from "@/lib/design-boot";

// Five candidate designs, switchable live while testing. Colors/fonts/radii come from CSS tokens
// in globals.css ([data-design=...]); the flags below drive the structural differences.

export type Design = {
  id: string;
  name: string;
  blurb: string;
  /** card: one big card per game. compact: ticket rows, stats behind a tap. */
  layout: "card" | "compact";
  /** table: side-by-side numbers. bars: comparison bars. */
  stats: "table" | "bars";
  /** Where the pick buttons sit relative to the stats. */
  odds: "top" | "bottom";
  /** Team labels in the matchup header. */
  teams: "abbr" | "full";
};

export const DESIGNS: Design[] = [
  { id: "sportsbook", name: "Sportsbook", blurb: "Dark app, green slip", layout: "card", stats: "table", odds: "top", teams: "abbr" },
  { id: "scorebook", name: "Scorebook", blurb: "Vintage paper scorecard", layout: "card", stats: "table", odds: "bottom", teams: "abbr" },
  { id: "broadcast", name: "Broadcast", blurb: "TV scoreboard, stat bars", layout: "card", stats: "bars", odds: "top", teams: "abbr" },
  { id: "editorial", name: "Editorial", blurb: "Clean white magazine", layout: "card", stats: "bars", odds: "bottom", teams: "full" },
  { id: "ticket", name: "Ticket", blurb: "Compact receipt rows", layout: "compact", stats: "table", odds: "top", teams: "abbr" },
];

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => document.documentElement.dataset.design ?? DESIGNS[0].id;
const getServerSnapshot = () => DESIGNS[0].id;

export function setDesign(id: string) {
  document.documentElement.dataset.design = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage blocked: the choice just won't persist
  }
  listeners.forEach((l) => l());
}

export function useDesign(): Design {
  const id = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return DESIGNS.find((d) => d.id === id) ?? DESIGNS[0];
}

export function DesignSwitcher() {
  const current = useDesign();
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-panel/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur">
      <div className="mx-auto max-w-xl">
        <div className="mb-1.5 flex items-baseline justify-between text-[11px] text-muted">
          <span>Design preview</span>
          <span>{current.blurb}</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {DESIGNS.map((d, i) => (
            <button
              key={d.id}
              onClick={() => setDesign(d.id)}
              aria-pressed={d.id === current.id}
              className={`rounded-[var(--radius-sm)] border px-1 py-1.5 text-[11px] font-semibold leading-tight ${
                d.id === current.id ? "border-accent bg-accent text-accent-ink" : "border-line text-fg"
              }`}
            >
              <span className="block opacity-60">{i + 1}</span>
              {d.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
