// What the client is allowed to see. Before the reveal: no game id, exact date, or result,
// since any of those would let a player look the outcome up.

import type { Game, Market, Outcome, Selection } from "./types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function publicGame(game: Game, slot: number) {
  const month = MONTHS[Number(game.date.slice(5, 7)) - 1];
  return {
    slot,
    when: `${month} ${game.season}`,
    dayNight: game.dayNight,
    divisional: game.divisional,
    away: game.away,
    home: game.home,
    park: game.park,
    conditions: game.conditions,
    pre: game.pre,
    odds: { ml: game.odds.ml, total: game.odds.total, source: game.odds.source },
  };
}

export type PublicGame = ReturnType<typeof publicGame>;

export function revealedGame(game: Game, slot: number) {
  return { ...publicGame(game, slot), date: game.date, result: game.result };
}

export type RevealedGame = ReturnType<typeof revealedGame>;

export type PickView = { slot: number; market: Market; selection: Selection | null; outcome?: Outcome };
