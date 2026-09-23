import type { Game, Market, Outcome, Selection } from "./types";

export function gradePick(game: Game, market: Market, selection: Selection | null): Outcome {
  if (!selection) return "no_pick";
  const { away, home } = game.result;
  if (market === "moneyline") {
    // Baseball has no ties in the regular season; the eligible pool excludes unfinished games.
    const winner = away.r > home.r ? "away" : "home";
    return selection === winner ? "win" : "loss";
  }
  const runs = away.r + home.r;
  const line = game.odds.total.line;
  if (runs === line) return "push"; // only possible on whole-number totals; the pick is void
  const actual = runs > line ? "over" : "under";
  return selection === actual ? "win" : "loss";
}

/** Odds the player took for a selection (Daily Mode always shows the closing line). */
export function oddsFor(game: Game, market: Market, selection: Selection): number {
  if (market === "moneyline") return selection === "away" ? game.odds.ml.away : game.odds.ml.home;
  return selection === "over" ? game.odds.total.over : game.odds.total.under;
}

/** Pushes are void: they don't count toward the score in either direction. */
export function isGraded(o: Outcome): boolean {
  return o !== "push";
}

export type GameGrade = "all" | "some" | "none" | "void";

/**
 * One emoji per game. Right on every graded market -> all; right on some -> some; none -> none.
 * A pushed market is ignored; a game where every market pushed is void.
 */
export function gradeGame(outcomes: Outcome[]): GameGrade {
  const graded = outcomes.filter(isGraded);
  if (graded.length === 0) return "void";
  const wins = graded.filter((o) => o === "win").length;
  if (wins === graded.length) return "all";
  return wins > 0 ? "some" : "none";
}

const EMOJI: Record<GameGrade, string> = { all: "🟩", some: "🟨", none: "⬛", void: "⬜" };

export function scoreOf(outcomes: Outcome[]): { correct: number; graded: number } {
  const graded = outcomes.filter(isGraded);
  return { correct: graded.filter((o) => o === "win").length, graded: graded.length };
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function shareText(opts: {
  day: number;
  games: Outcome[][];
  timeLeftMs: number;
  url?: string;
}): string {
  const all = opts.games.flat();
  const { correct, graded } = scoreOf(all);
  const grid = opts.games.map((g) => EMOJI[gradeGame(g)]).join("");
  const perfect = graded > 0 && correct === graded ? " ✅" : "";
  const lines = [`Slate Replay #${opts.day}  ${correct}/${graded}${perfect}  ⏱ ${formatClock(opts.timeLeftMs)}`, grid];
  if (opts.url) lines.push(opts.url);
  return lines.join("\n");
}
