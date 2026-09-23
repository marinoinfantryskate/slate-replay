"use client";

import { useState } from "react";
import { formatAmerican, impliedProb } from "@/lib/odds";
import type { Market, Selection, Starter, TeamPre, WL } from "@/lib/types";
import type { PublicGame } from "@/lib/view";
import { useDesign } from "./design";

const WIND: Record<string, string> = {
  tocf: "out to CF",
  tolf: "out to LF",
  torf: "out to RF",
  fromcf: "in from CF",
  fromlf: "in from LF",
  fromrf: "in from RF",
  ltor: "left to right",
  rtol: "right to left",
};

export function conditionsText(c: PublicGame["conditions"]): string {
  if (!c) return "Conditions unknown";
  if (c.dome) return "Roof closed";
  const parts: string[] = [];
  if (c.temp != null) parts.push(`${c.temp}°`);
  if (c.sky) parts.push(c.sky);
  if (c.windMph) parts.push(`wind ${c.windMph} mph${c.windDir && WIND[c.windDir] ? ` ${WIND[c.windDir]}` : ""}`);
  return parts.length ? parts.join(", ") : "Conditions unknown";
}

const wl = (r: WL) => `${r.w}-${r.l}`;
const pct = (r: WL) => (r.w + r.l ? r.w / (r.w + r.l) : 0.5);

function metaLine(game: PublicGame) {
  return `${game.when} · ${game.dayNight === "day" ? "Day" : "Night"}${game.divisional ? " · Division game" : ""}`;
}

export function MatchupHeader({ game }: { game: PublicGame }) {
  const design = useDesign();
  if (design.teams === "full") {
    return (
      <div className="px-4 pt-5">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{metaLine(game)}</div>
        <h2 className="mt-2 font-display text-[1.7rem] font-semibold leading-[1.1] tracking-tight">
          {game.away.name} <span className="font-normal italic text-muted">at</span> {game.home.name}
        </h2>
        <div className="mt-2 text-sm text-muted">
          {game.park.name} · {conditionsText(game.conditions)}
        </div>
      </div>
    );
  }
  return (
    <div className="px-4 pt-4">
      <div className="text-xs text-muted">{metaLine(game)}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <TeamName abbr={game.away.abbr} name={game.away.name} />
        <span className="pb-1 text-muted">@</span>
        <TeamName abbr={game.home.abbr} name={game.home.name} right />
      </div>
      <div className="mt-2 text-xs text-muted">
        {game.park.name} · {conditionsText(game.conditions)}
      </div>
    </div>
  );
}

function TeamName({ abbr, name, right }: { abbr: string; name: string; right?: boolean }) {
  return (
    <div className={`min-w-0 flex-1 ${right ? "text-right" : ""}`}>
      <div className="font-display text-3xl font-bold leading-none tracking-tight">{abbr}</div>
      <div className="mt-1 truncate text-xs text-muted">{name}</div>
    </div>
  );
}

type Props = {
  game: PublicGame;
  disabled: boolean;
  selection: (m: Market) => Selection | null;
  onPick: (m: Market, s: Selection) => void;
};

export default function GameCard(props: Props) {
  const design = useDesign();
  if (design.layout === "compact") return <TicketRow {...props} />;

  const slip = <PickSlip {...props} />;
  return (
    <article className="card overflow-hidden rounded-[var(--radius)] border border-line bg-panel">
      <MatchupHeader game={props.game} />
      {design.odds === "top" && <div className="mt-4 border-t border-line bg-panel-2/60 px-4 py-3">{slip}</div>}
      <Tier1 away={props.game.pre.away} home={props.game.pre.home} bars={design.stats === "bars"} />
      {design.odds === "bottom" && <div className="border-t border-line bg-panel-2/60 px-4 py-3">{slip}</div>}
      <p className="px-4 pb-3 pt-1 text-[11px] text-muted">Closing line · {props.game.odds.source}</p>
    </article>
  );
}

function PickSlip({ game, disabled, selection, onPick }: Props) {
  const { ml, total } = game.odds;
  return (
    <div className="space-y-2">
      <MarketRow label="Moneyline">
        <PickButton active={selection("moneyline") === "away"} disabled={disabled} onClick={() => onPick("moneyline", "away")} top={game.away.abbr} odds={ml.away} />
        <PickButton active={selection("moneyline") === "home"} disabled={disabled} onClick={() => onPick("moneyline", "home")} top={game.home.abbr} odds={ml.home} />
      </MarketRow>
      <MarketRow label={`Total ${total.line}`}>
        <PickButton active={selection("total") === "over"} disabled={disabled} onClick={() => onPick("total", "over")} top={`Over ${total.line}`} odds={total.over} />
        <PickButton active={selection("total") === "under"} disabled={disabled} onClick={() => onPick("total", "under")} top={`Under ${total.line}`} odds={total.under} />
      </MarketRow>
    </div>
  );
}

/** Bet Ticket design: a dense row per game, picks inline, stats behind a tap. */
function TicketRow({ game, disabled, selection, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const { ml, total } = game.odds;
  return (
    <article className="card border border-line bg-panel px-4 py-3">
      <div className="flex items-baseline justify-between text-[11px] uppercase tracking-wider text-muted">
        <span>{metaLine(game)}</span>
        <span>#{game.slot + 1}</span>
      </div>
      <div className="mt-1 text-lg font-semibold">
        {game.away.abbr} @ {game.home.abbr}
      </div>
      <div className="text-[11px] text-muted">
        {game.pre.away.starter.name} vs {game.pre.home.starter.name} · {game.park.name}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <PickButton small active={selection("moneyline") === "away"} disabled={disabled} onClick={() => onPick("moneyline", "away")} top={game.away.abbr} odds={ml.away} />
        <PickButton small active={selection("moneyline") === "home"} disabled={disabled} onClick={() => onPick("moneyline", "home")} top={game.home.abbr} odds={ml.home} />
        <PickButton small active={selection("total") === "over"} disabled={disabled} onClick={() => onPick("total", "over")} top={`O ${total.line}`} odds={total.over} />
        <PickButton small active={selection("total") === "under"} disabled={disabled} onClick={() => onPick("total", "under")} top={`U ${total.line}`} odds={total.under} />
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-2 w-full border-t border-line pt-2 text-left text-xs text-muted"
      >
        {open ? "− Hide the numbers" : "+ Show the numbers"}
      </button>
      {open && (
        <div className="-mx-4">
          <div className="px-4 pt-1 text-[11px] text-muted">{conditionsText(game.conditions)}</div>
          <Tier1 away={game.pre.away} home={game.pre.home} bars={false} />
        </div>
      )}
    </article>
  );
}

function MarketRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr_1fr] items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </div>
  );
}

function PickButton(props: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  top: string;
  odds: number;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-pressed={props.active}
      aria-label={`${props.top} ${formatAmerican(props.odds)}`}
      className={`rounded-[var(--radius-sm)] border text-center transition disabled:cursor-not-allowed ${
        props.small ? "px-1 py-1.5" : "px-2 py-2"
      } ${
        props.active
          ? "border-accent bg-accent text-accent-ink"
          : "border-line bg-panel hover:border-muted disabled:opacity-60"
      }`}
    >
      <div className={`font-display font-semibold ${props.small ? "text-xs" : "text-sm"}`}>{props.top}</div>
      <div className={`font-mono tnum ${props.small ? "text-[11px]" : "text-xs"}`}>
        {formatAmerican(props.odds)}
        {!props.small && (
          <span className={props.active ? "opacity-70" : "text-muted"}> · {Math.round(impliedProb(props.odds) * 100)}%</span>
        )}
      </div>
    </button>
  );
}

function Tier1({ away, home, bars }: { away: TeamPre; home: TeamPre; bars: boolean }) {
  return (
    <div className="px-4 py-3">
      {bars ? <StatBars away={away} home={home} /> : <StatTable away={away} home={home} />}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <StarterBox s={away.starter} />
        <StarterBox s={home.starter} right />
      </div>
    </div>
  );
}

function StatTable({ away, home }: { away: TeamPre; home: TeamPre }) {
  const rows: [string, string, string][] = [
    ["Record", wl(away.record), wl(home.record)],
    ["Last 10", wl(away.last10), wl(home.last10)],
    ["Road / Home", wl(away.roadRecord), wl(home.homeRecord)],
    ["Streak", away.streak, home.streak],
    ["Runs / G", away.rpg.toFixed(2), home.rpg.toFixed(2)],
    ["Allowed / G", away.rapg.toFixed(2), home.rapg.toFixed(2)],
  ];
  return (
    <table className="stat-table w-full text-sm">
      <tbody>
        {rows.map(([label, a, h]) => (
          <tr key={label} className="border-b border-line/50 last:border-0">
            <td className="py-1.5 font-mono tnum">{a}</td>
            <td className="py-1.5 text-center text-xs text-muted">{label}</td>
            <td className="py-1.5 text-right font-mono tnum">{h}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Head-to-head bars: each side's share of the bar is its relative edge on that stat. */
function StatBars({ away, home }: { away: TeamPre; home: TeamPre }) {
  const rows: { label: string; a: string; h: string; share: number }[] = [
    { label: "Win %", a: wl(away.record), h: wl(home.record), share: pct(away.record) / (pct(away.record) + pct(home.record)) },
    { label: "Last 10", a: wl(away.last10), h: wl(home.last10), share: pct(away.last10) / (pct(away.last10) + pct(home.last10) || 1) },
    { label: "Road / Home", a: wl(away.roadRecord), h: wl(home.homeRecord), share: pct(away.roadRecord) / (pct(away.roadRecord) + pct(home.homeRecord) || 1) },
    { label: "Runs / G", a: away.rpg.toFixed(2), h: home.rpg.toFixed(2), share: away.rpg / (away.rpg + home.rpg) },
    // Fewer runs allowed is better, so invert.
    { label: "Allowed / G", a: away.rapg.toFixed(2), h: home.rapg.toFixed(2), share: home.rapg / (away.rapg + home.rapg) },
  ];
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between text-sm">
            <span className={`font-mono tnum ${r.share > 0.5 ? "font-semibold" : "text-muted"}`}>{r.a}</span>
            <span className="text-[11px] uppercase tracking-wide text-muted">{r.label}</span>
            <span className={`font-mono tnum ${r.share < 0.5 ? "font-semibold" : "text-muted"}`}>{r.h}</span>
          </div>
          <div className="mt-1 flex h-1.5 gap-0.5 overflow-hidden rounded-full">
            <div className={r.share >= 0.5 ? "bg-accent" : "bg-line"} style={{ width: `${r.share * 100}%` }} />
            <div className={r.share <= 0.5 ? "bg-accent" : "bg-line"} style={{ width: `${(1 - r.share) * 100}%` }} />
          </div>
        </div>
      ))}
      <div className="flex justify-between text-xs">
        <span className="text-muted">Streak {away.streak}</span>
        <span className="text-muted">Streak {home.streak}</span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-sm font-semibold tnum">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}

function StarterBox({ s, right }: { s: Starter; right?: boolean }) {
  const stat = (v: number | null, digits: number) => (v == null ? "—" : v.toFixed(digits));
  return (
    <div className={`rounded-[var(--radius-sm)] bg-panel-2 p-2.5 ${right ? "text-right" : ""}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted">Starter</div>
      <div className="truncate font-display text-sm font-semibold">
        {s.name}
        {s.throws && <span className="font-normal text-muted"> ({s.throws})</span>}
      </div>
      {s.era == null ? (
        <div className="mt-1 text-xs text-muted">No innings yet this season</div>
      ) : (
        <>
          <div className="mt-2 grid grid-cols-3 gap-1">
            <Stat label="ERA" value={stat(s.era, 2)} />
            <Stat label="WHIP" value={stat(s.whip, 2)} />
            <Stat label="K/9" value={stat(s.k9, 1)} />
          </div>
          <div className="mt-1.5 font-mono text-[11px] tnum text-muted">
            <div>
              {s.w}-{s.l} in {s.gs} GS
            </div>
            <div>{s.ip} IP</div>
          </div>
          {s.last3.length > 0 && (
            <div className="mt-2 border-t border-line pt-2">
              <div className="text-[10px] uppercase tracking-wide text-muted">Recent starts · IP/ER/K</div>
              <div className={`mt-1 flex flex-wrap gap-1 ${right ? "justify-end" : ""}`}>
                {s.last3.map((x, i) => (
                  <span key={i} className="rounded-[var(--radius-sm)] bg-panel px-1.5 py-0.5 font-mono text-[11px] tnum">
                    {x.ip}/{x.er}/{x.k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
