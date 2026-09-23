export function formatAmerican(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

/** Implied win probability of American odds (includes the book's vig). */
export function impliedProb(odds: number): number {
  return odds < 0 ? -odds / (-odds + 100) : 100 / (odds + 100);
}
