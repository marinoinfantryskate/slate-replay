// Shape of one game in data/pool/{season}.json (written by scripts/ingest.py).

export type WL = { w: number; l: number };

export type Team = { code: string; abbr: string; name: string; division: string };

export type Starter = {
  id: string;
  name: string;
  throws: "L" | "R" | null;
  gs: number;
  w: number;
  l: number;
  ip: string;
  era: number | null;
  whip: number | null;
  k9: number | null;
  last3: { ip: string; er: number; k: number }[];
};

export type TeamPre = {
  games: number;
  record: WL;
  last10: WL;
  homeRecord: WL;
  roadRecord: WL;
  streak: string;
  rpg: number;
  rapg: number;
  starter: Starter;
};

export type Conditions =
  | { dome: true }
  | { dome: false; temp: number | null; sky: string | null; windDir: string | null; windMph: number | null };

export type StarterLine = { ip: string; h: number; er: number; bb: number; k: number };

export type TeamResult = { r: number; h: number; e: number; line: (number | null)[] };

export type Game = {
  id: string;
  date: string; // YYYY-MM-DD
  season: number;
  dayNight: "day" | "night";
  divisional: boolean;
  away: Team;
  home: Team;
  park: { id: string; name: string };
  conditions: Conditions | null;
  pre: { away: TeamPre; home: TeamPre };
  odds: {
    source: string;
    ml: { away: number; home: number };
    total: { line: number; over: number; under: number };
    runLine: { away: number; awayOdds: number; home: number; homeOdds: number };
    open: { mlAway: number | null; mlHome: number | null; total: number | null };
  };
  result: {
    away: TeamResult;
    home: TeamResult;
    decisions: { wp: string | null; lp: string | null; sv: string | null };
    starters: { away: StarterLine | null; home: StarterLine | null };
  };
};

export type Market = "moneyline" | "total";
export type MoneylineSelection = "away" | "home";
export type TotalSelection = "over" | "under";
export type Selection = MoneylineSelection | TotalSelection;
export type Outcome = "win" | "loss" | "push" | "no_pick";

export const MARKETS: Market[] = ["moneyline", "total"];

export function isValidSelection(market: Market, selection: string): selection is Selection {
  return market === "moneyline"
    ? selection === "away" || selection === "home"
    : selection === "over" || selection === "under";
}
