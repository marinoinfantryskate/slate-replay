"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Market, Selection } from "@/lib/types";
import type { PickView } from "@/lib/view";
import { api, type DailyState, type PlayingState } from "./api";
import GameCard from "./GameCard";
import Reveal from "./Reveal";
import { formatClock } from "@/lib/grade";

export default function DailyApp() {
  const [state, setState] = useState<DailyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (p: Promise<DailyState> = api.state()) => {
    try {
      setState(await p);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .state()
      .then((s) => alive && setState(s))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const start = async () => {
    setBusy(true);
    await load(api.start());
    setBusy(false);
  };

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-24">
      <Header state={state} />
      {error && (
        <div className="mt-4 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}{" "}
          <button className="underline" onClick={() => load()}>
            Retry
          </button>
        </div>
      )}
      {!state && !error && <p className="mt-16 text-center text-muted">Loading today&apos;s slate…</p>}
      {state?.status === "new" && <Home state={state} onStart={start} busy={busy} />}
      {state?.status === "playing" && <Play state={state} onLocked={load} />}
      {state?.status === "locked" && <Reveal state={state} />}
      <footer className="mt-12 text-center text-[11px] leading-relaxed text-muted">
        The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested
        parties may contact Retrosheet at{" "}
        <a className="underline" href="https://www.retrosheet.org">
          www.retrosheet.org
        </a>
        . Historical odds: Sportsbook Review archive. For entertainment and practice only; no real money.
      </footer>
    </main>
  );
}

function Header({ state }: { state: DailyState | null }) {
  return (
    <header className="flex items-center justify-between py-4">
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold tracking-tight">Slate Replay</span>
        {state && <span className="font-mono text-sm text-muted">#{state.day}</span>}
      </div>
      {state && (
        <div className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm" title="Days played in a row">
          <span aria-hidden>🔥</span>
          <span className="font-mono tnum">{state.streak.current}</span>
          <span className="text-muted">streak</span>
        </div>
      )}
    </header>
  );
}

function Home({ state, onStart, busy }: { state: DailyState; onStart: () => void; busy: boolean }) {
  return (
    <section className="mt-6">
      <h1 className="text-3xl font-bold leading-tight tracking-tight">
        {state.gameCount} real games.
        <br />
        Real closing odds.
        <br />
        <span className="text-accent">Five minutes.</span>
      </h1>
      <p className="mt-4 text-muted">
        Every day, everyone gets the same slate of historical MLB games — stats as of that morning, outcomes
        hidden. Pick the moneyline and the total for each game, then see what actually happened.
      </p>
      <ul className="mt-6 space-y-2 text-sm">
        <Rule n="1">The 5:00 clock starts when you open the slate and keeps running if you leave.</Rule>
        <Rule n="2">When it hits zero, whatever you&apos;ve picked is locked in. Unpicked = miss.</Rule>
        <Rule n="3">One attempt a day. Your streak counts days played, not days won.</Rule>
      </ul>
      <button
        onClick={onStart}
        disabled={busy}
        className="mt-8 w-full rounded-xl bg-accent py-4 text-lg font-semibold text-accent-ink transition active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? "Opening…" : "Play today’s slate"}
      </button>
      <p className="mt-3 text-center text-xs text-muted">No money, no sign-up. Practice mode is coming next.</p>
    </section>
  );
}

function Rule({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-panel-2 font-mono text-xs text-muted">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function useCountdown(deadline: number, serverNow: number) {
  const [left, setLeft] = useState(deadline - serverNow);
  useEffect(() => {
    // Correct for clock skew between this device and the server.
    const offset = serverNow - Date.now();
    const id = setInterval(() => setLeft(deadline - (Date.now() + offset)), 250);
    return () => clearInterval(id);
  }, [deadline, serverNow]);
  return Math.max(0, left);
}

function Play({ state, onLocked }: { state: PlayingState; onLocked: (p: Promise<DailyState>) => void }) {
  const [picks, setPicks] = useState<PickView[]>(state.picks);
  const [submitting, setSubmitting] = useState(false);
  const left = useCountdown(state.deadline, state.serverNow);
  const expired = left <= 0;
  const firedExpiry = useRef(false);

  useEffect(() => {
    if (!expired || firedExpiry.current) return;
    firedExpiry.current = true;
    // The server locks the entry itself once the deadline (plus a short grace) passes.
    const id = setTimeout(() => onLocked(api.state()), 1800);
    return () => clearTimeout(id);
  }, [expired, onLocked]);

  const selectionFor = (slot: number, market: Market) =>
    picks.find((p) => p.slot === slot && p.market === market)?.selection ?? null;

  const choose = async (slot: number, market: Market, selection: Selection) => {
    if (expired || submitting) return;
    const next = selectionFor(slot, market) === selection ? null : selection; // tap again to clear
    setPicks((ps) => [...ps.filter((p) => !(p.slot === slot && p.market === market)), { slot, market, selection: next }]);
    try {
      await api.pick(slot, market, next);
    } catch (e) {
      if ((e as { status?: number }).status === 409) onLocked(api.state());
    }
  };

  const made = picks.filter((p) => p.selection).length;
  const total = state.games.length * 2;
  const urgent = left < 60_000;

  const submit = async () => {
    setSubmitting(true);
    onLocked(api.submit());
  };

  return (
    <section>
      <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div
            className={`font-mono text-3xl font-semibold tnum ${expired ? "text-bad" : urgent ? "text-warn" : ""}`}
            aria-live="off"
          >
            {formatClock(left)}
          </div>
          <div className="text-right text-sm text-muted">
            <span className="font-mono tnum text-fg">
              {made}/{total}
            </span>{" "}
            picks
          </div>
          <button
            onClick={submit}
            disabled={submitting || expired}
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
          >
            {expired ? "Locking…" : submitting ? "Locking…" : "Lock in"}
          </button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded bg-panel-2">
          <div
            className={`h-full ${urgent ? "bg-warn" : "bg-accent"}`}
            style={{ width: `${(left / state.timerMs) * 100}%`, transition: "width 250ms linear" }}
          />
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {state.games.map((g) => (
          <GameCard
            key={g.slot}
            game={g}
            disabled={expired || submitting}
            selection={(m) => selectionFor(g.slot, m)}
            onPick={(m, s) => choose(g.slot, m, s)}
          />
        ))}
      </div>
    </section>
  );
}
