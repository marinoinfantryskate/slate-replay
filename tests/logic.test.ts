import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { addDays, dayNumber, slateDateFor } from "@/lib/day";
import { gradeGame, gradePick, scoreOf, shareText } from "@/lib/grade";
import { dailySeed, drawSlate } from "@/lib/slate";
import type { Game } from "@/lib/types";

function game(awayR: number, homeR: number, total: number): Game {
  return {
    result: { away: { r: awayR }, home: { r: homeR } },
    odds: { ml: { away: 120, home: -130 }, total: { line: total, over: -110, under: -110 } },
  } as unknown as Game;
}

describe("gradePick", () => {
  it("grades the moneyline on the winner", () => {
    expect(gradePick(game(5, 3, 8.5), "moneyline", "away")).toBe("win");
    expect(gradePick(game(5, 3, 8.5), "moneyline", "home")).toBe("loss");
  });
  it("grades totals over/under the line", () => {
    expect(gradePick(game(5, 4, 8.5), "total", "over")).toBe("win");
    expect(gradePick(game(5, 3, 8.5), "total", "over")).toBe("loss");
    expect(gradePick(game(5, 3, 8.5), "total", "under")).toBe("win");
  });
  it("pushes when a whole-number total lands exactly", () => {
    expect(gradePick(game(5, 3, 8), "total", "over")).toBe("push");
    expect(gradePick(game(5, 3, 8), "total", "under")).toBe("push");
  });
  it("scores a missing pick as no_pick", () => {
    expect(gradePick(game(5, 3, 8), "moneyline", null)).toBe("no_pick");
  });
});

describe("scoring and share string", () => {
  it("ignores pushes and counts no_pick as a miss", () => {
    expect(scoreOf(["win", "push", "no_pick", "loss"])).toEqual({ correct: 1, graded: 3 });
  });
  it("rolls each game into one emoji", () => {
    expect(gradeGame(["win", "win"])).toBe("all");
    expect(gradeGame(["win", "loss"])).toBe("some");
    expect(gradeGame(["loss", "no_pick"])).toBe("none");
    expect(gradeGame(["win", "push"])).toBe("all");
    expect(gradeGame(["push", "push"])).toBe("void");
  });
  it("formats the share text", () => {
    const text = shareText({
      day: 142,
      games: [["win", "win"], ["win", "loss"], ["loss", "no_pick"]],
      timeLeftMs: 227_000,
    });
    expect(text).toBe("Slate Replay #142  3/6  ⏱ 3:47\n🟩🟨⬛");
  });
  it("adds a check mark on a perfect slate", () => {
    expect(shareText({ day: 1, games: [["win", "win"]], timeLeftMs: 0 })).toContain("2/2 ✅");
  });
});

describe("days", () => {
  it("numbers days from the epoch", () => {
    expect(dayNumber("2026-09-22")).toBe(1);
    expect(dayNumber("2026-10-22")).toBe(31);
    expect(dayNumber("2027-03-14")).toBe(dayNumber("2027-03-13") + 1); // across DST
  });
  it("rolls over at midnight Eastern", () => {
    expect(slateDateFor(new Date("2026-09-23T03:59:00Z"))).toBe("2026-09-22");
    expect(slateDateFor(new Date("2026-09-23T04:00:00Z"))).toBe("2026-09-23");
  });
  it("adds days across month ends", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("drawSlate", () => {
  const pool = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/pool/2019.json"), "utf8")) as Game[];

  it("is deterministic for a date", () => {
    const a = drawSlate(pool, dailySeed("2026-09-22")).map((g) => g.id);
    const b = drawSlate(pool, dailySeed("2026-09-22")).map((g) => g.id);
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
  });
  it("varies by date and never repeats a team", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const slate = drawSlate(pool, dailySeed(addDays("2026-09-22", i)));
      seen.add(slate.map((g) => g.id).join());
      const teams = slate.flatMap((g) => [g.away.code, g.home.code]);
      expect(new Set(teams).size).toBe(teams.length);
    }
    expect(seen.size).toBe(60);
  });
});

describe("pool data", () => {
  const pool = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/pool/2019.json"), "utf8")) as Game[];
  it("only shows stats from before the game (records never include the game itself)", () => {
    for (const g of pool) {
      for (const side of ["away", "home"] as const) {
        const pre = g.pre[side];
        expect(pre.record.w + pre.record.l).toBe(pre.games);
        expect(pre.games).toBeGreaterThanOrEqual(10);
      }
    }
  });
  it("has usable odds for every game", () => {
    for (const g of pool) {
      expect(Math.abs(g.odds.ml.away)).toBeGreaterThanOrEqual(100);
      expect(g.odds.total.line).toBeGreaterThan(0);
      expect(g.result.away.r).not.toBe(g.result.home.r);
    }
  });
});
