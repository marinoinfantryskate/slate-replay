"use client";

import { useState } from "react";
import { formatClock, gradeGame, scoreOf } from "@/lib/grade";
import { formatAmerican } from "@/lib/odds";
import type { Market, Outcome } from "@/lib/types";
import type { PickView, RevealedGame } from "@/lib/view";
import type { LockedState } from "./api";
import { conditionsText } from "./GameCard";

const BADGE: Record<Outcome, { text: string; cls: string }> = {
  win: { text: "Win", cls: "bg-good/15 text-good" },
  loss: { text: "Loss", cls: "bg-bad/15 text-bad" },
  push: { text: "Push · void", cls: "bg-panel-2 text-muted" },
  no_pick: { text: "No pick", cls: "bg-bad/10 text-bad" },
};

const GRID: Record<ReturnType<typeof gradeGame>, string> = { all: "🟩", some: "🟨", none: "⬛", void: "⬜" };

export default function Reveal({ state }: { state: LockedState }) {
  const outcome = (slot: number, m: Market): Outcome =>
    state.picks.find((p) => p.slot === slot && p.market === m)?.outcome ?? "no_pick";
  const all = state.games.flatMap((g) => [outcome(g.slot, "moneyline"), outcome(g.slot, "total")]);
  const { correct, graded } = scoreOf(all);

  return (
    <section className="mt-2">
      <div className="card rounded-[var(--radius)] border border-line bg-panel p-5 text-center">
        <div className="text-sm text-muted">
          {state.lockReason === "timer" ? "Time ran out — picks locked" : `Locked with ${formatClock(state.timeLeftMs)} left`}
        </div>
        <div className="mt-1 font-display text-6xl font-bold tnum">
          {correct}/{graded}
        </div>
        <div className="mt-2 text-3xl tracking-widest" aria-label="Results by game">
          {state.games.map((g) => GRID[gradeGame([outcome(g.slot, "moneyline"), outcome(g.slot, "total")])]).join("")}
        </div>
        <ShareButton text={state.share} />
        <p className="mt-3 text-xs text-muted">Next slate at midnight ET. 🔥 {state.streak.current}-day streak.</p>
      </div>

      <div className="mt-4 space-y-4">
        {state.games.map((g) => (
          <GameResult key={g.slot} game={g} picks={state.picks.filter((p) => p.slot === g.slot)} />
        ))}
      </div>
    </section>
  );
}

function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // fall through to copy (user cancelled or share unsupported)
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <>
      <pre className="mx-auto mt-4 w-fit whitespace-pre-wrap rounded-[var(--radius-sm)] bg-panel-2 px-3 py-2 text-left font-mono text-xs text-muted">
        {text}
      </pre>
      <button onClick={share} className="mt-3 w-full rounded-[var(--radius)] bg-accent py-3 font-semibold text-accent-ink">
        {copied ? "Copied!" : "Share result"}
      </button>
    </>
  );
}

function longDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function GameResult({ game, picks }: { game: RevealedGame; picks: PickView[] }) {
  const { away, home } = game.result;
  const innings = Math.max(away.line.length, home.line.length);
  const pick = (m: Market) => picks.find((p) => p.market === m);
  const runs = away.r + home.r;

  const pickLabel = (m: Market) => {
    const p = pick(m);
    if (!p?.selection) return "—";
    if (m === "moneyline") {
      const team = p.selection === "away" ? game.away.abbr : game.home.abbr;
      return `${team} ${formatAmerican(p.selection === "away" ? game.odds.ml.away : game.odds.ml.home)}`;
    }
    const price = p.selection === "over" ? game.odds.total.over : game.odds.total.under;
    return `${p.selection === "over" ? "Over" : "Under"} ${game.odds.total.line} (${formatAmerican(price)})`;
  };

  return (
    <article className="card overflow-hidden rounded-[var(--radius)] border border-line bg-panel">
      <div className="px-4 pt-4">
        <div className="text-xs text-muted">
          {longDate(game.date)} · {game.park.name} · {conditionsText(game.conditions)}
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full font-mono text-sm tnum">
            <thead>
              <tr className="text-xs text-muted">
                <th className="py-1 text-left font-normal" />
                {Array.from({ length: innings }, (_, i) => (
                  <th key={i} className="w-6 py-1 text-center font-normal">
                    {i + 1}
                  </th>
                ))}
                <th className="w-8 py-1 text-center font-semibold text-fg">R</th>
                <th className="w-8 py-1 text-center font-normal">H</th>
                <th className="w-8 py-1 text-center font-normal">E</th>
              </tr>
            </thead>
            <tbody>
              {(["away", "home"] as const).map((side) => {
                const t = game.result[side];
                const won = side === "away" ? away.r > home.r : home.r > away.r;
                return (
                  <tr key={side} className={won ? "" : "text-muted"}>
                    <td className="py-1 pr-2 font-display font-semibold">{game[side].abbr}</td>
                    {Array.from({ length: innings }, (_, i) => (
                      <td key={i} className="py-1 text-center">
                        {t.line[i] ?? "x"}
                      </td>
                    ))}
                    <td className="py-1 text-center font-bold">{t.r}</td>
                    <td className="py-1 text-center">{t.h}</td>
                    <td className="py-1 text-center">{t.e}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-3 space-y-2 border-t border-line bg-panel-2/60 px-4 py-3">
        {(["moneyline", "total"] as const).map((m) => {
          const o = pick(m)?.outcome ?? "no_pick";
          return (
            <div key={m} className="flex items-center justify-between gap-2 text-sm">
              <div>
                <span className="text-xs uppercase tracking-wide text-muted">{m === "moneyline" ? "Moneyline" : "Total"}</span>{" "}
                <span className="font-medium">{pickLabel(m)}</span>
                {m === "total" && <span className="text-xs text-muted"> · {runs} runs</span>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[o].cls}`}>{BADGE[o].text}</span>
            </div>
          );
        })}
      </div>

      <div className="space-y-1 px-4 py-3 text-xs">
        {(["away", "home"] as const).map((side) => {
          const line = game.result.starters[side];
          return (
            <div key={side} className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate">
                <span className="text-muted">{game[side].abbr}</span>{" "}
                <span className="font-semibold">{game.pre[side].starter.name}</span>
              </span>
              <span className="shrink-0 font-mono tnum text-muted">
                {line ? `${line.ip} IP ${line.h} H ${line.er} ER ${line.bb} BB ${line.k} K` : "—"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="px-4 pb-3 text-[11px] text-muted">
        {[
          game.result.decisions.wp && `W: ${game.result.decisions.wp}`,
          game.result.decisions.lp && `L: ${game.result.decisions.lp}`,
          game.result.decisions.sv && `SV: ${game.result.decisions.sv}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </div>
    </article>
  );
}
