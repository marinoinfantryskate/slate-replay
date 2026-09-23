"""
Build the eligible game pool for one season.

Inputs (data/raw/):
  GL{season}.TXT            Retrosheet game log (161 fields, no header)
  {season}gameinfo.csv      Retrosheet per-game info (gametype, weather, suspensions)
  {season}pitching.csv      Retrosheet per-game pitcher lines (for starter ERA/WHIP)
  mlb-odds-{season}.xlsx    Sportsbook Review archive (open + closing lines)

Output:
  data/pool/{season}.json   list of games with pre-game stats (as of the day before),
                            closing odds, and the actual result.

Every pre-game stat is computed from games with date < game date, so nothing about the
game (or anything after it) can leak into the info shown before the reveal.

Usage: .venv/bin/python scripts/ingest.py 2019
"""

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "pool"

MIN_TEAM_GAMES = 10  # skip early-season games where records are meaningless

# Sportsbook Review team code -> Retrosheet team code
SBR_TO_RETRO = {
    "ARI": "ARI", "ATL": "ATL", "BAL": "BAL", "BOS": "BOS", "CIN": "CIN", "CLE": "CLE",
    "COL": "COL", "CUB": "CHN", "CWS": "CHA", "DET": "DET", "HOU": "HOU", "KAN": "KCA",
    "LAA": "ANA", "LAD": "LAN", "MIA": "MIA", "MIL": "MIL", "MIN": "MIN", "NYM": "NYN",
    "NYY": "NYA", "OAK": "OAK", "PHI": "PHI", "PIT": "PIT", "SDG": "SDN", "SEA": "SEA",
    "SFO": "SFN", "STL": "SLN", "TAM": "TBA", "TEX": "TEX", "TOR": "TOR", "WAS": "WAS",
}

# Retrosheet code -> (display abbr, name, division)
TEAMS = {
    "ANA": ("LAA", "Los Angeles Angels", "AL West"),
    "ARI": ("ARI", "Arizona Diamondbacks", "NL West"),
    "ATL": ("ATL", "Atlanta Braves", "NL East"),
    "BAL": ("BAL", "Baltimore Orioles", "AL East"),
    "BOS": ("BOS", "Boston Red Sox", "AL East"),
    "CHA": ("CWS", "Chicago White Sox", "AL Central"),
    "CHN": ("CHC", "Chicago Cubs", "NL Central"),
    "CIN": ("CIN", "Cincinnati Reds", "NL Central"),
    "CLE": ("CLE", "Cleveland Indians", "AL Central"),
    "COL": ("COL", "Colorado Rockies", "NL West"),
    "DET": ("DET", "Detroit Tigers", "AL Central"),
    "HOU": ("HOU", "Houston Astros", "AL West"),
    "KCA": ("KC", "Kansas City Royals", "AL Central"),
    "LAN": ("LAD", "Los Angeles Dodgers", "NL West"),
    "MIA": ("MIA", "Miami Marlins", "NL East"),
    "MIL": ("MIL", "Milwaukee Brewers", "NL Central"),
    "MIN": ("MIN", "Minnesota Twins", "AL Central"),
    "NYA": ("NYY", "New York Yankees", "AL East"),
    "NYN": ("NYM", "New York Mets", "NL East"),
    "OAK": ("OAK", "Oakland Athletics", "AL West"),
    "PHI": ("PHI", "Philadelphia Phillies", "NL East"),
    "PIT": ("PIT", "Pittsburgh Pirates", "NL Central"),
    "SDN": ("SD", "San Diego Padres", "NL West"),
    "SEA": ("SEA", "Seattle Mariners", "AL West"),
    "SFN": ("SF", "San Francisco Giants", "NL West"),
    "SLN": ("STL", "St. Louis Cardinals", "NL Central"),
    "TBA": ("TB", "Tampa Bay Rays", "AL East"),
    "TEX": ("TEX", "Texas Rangers", "AL West"),
    "TOR": ("TOR", "Toronto Blue Jays", "AL East"),
    "WAS": ("WSH", "Washington Nationals", "NL East"),
}

PARKS = {
    "ANA01": "Angel Stadium", "ARL02": "Globe Life Park", "ATL03": "SunTrust Park",
    "BAL12": "Oriole Park at Camden Yards", "BOS07": "Fenway Park", "CHI11": "Wrigley Field",
    "CHI12": "Guaranteed Rate Field", "CIN09": "Great American Ball Park",
    "CLE08": "Progressive Field", "DEN02": "Coors Field", "DET05": "Comerica Park",
    "HOU03": "Minute Maid Park", "KAN06": "Kauffman Stadium", "LOS03": "Dodger Stadium",
    "MIA02": "Marlins Park", "MIL06": "Miller Park", "MIN04": "Target Field",
    "NYC20": "Citi Field", "NYC21": "Yankee Stadium", "OAK01": "Oakland Coliseum",
    "PHI13": "Citizens Bank Park", "PHO01": "Chase Field", "PIT08": "PNC Park",
    "SAN02": "Petco Park", "SEA03": "T-Mobile Park", "SFO03": "Oracle Park",
    "STL10": "Busch Stadium", "STP01": "Tropicana Field", "TOR02": "Rogers Centre",
    "WAS11": "Nationals Park", "TOK01": "Tokyo Dome", "LON01": "London Stadium",
    "MNT01": "Estadio de Béisbol Monterrey", "WIL02": "BB&T Ballpark (Williamsport)",
}

# Retrosheet game log columns we use (1-based field numbers from the Retrosheet guide)
GL_FIELDS = {
    1: "date", 2: "game_num", 4: "vis", 7: "home", 10: "vis_r", 11: "home_r",
    13: "daynight", 14: "completion", 15: "forfeit", 17: "park",
    20: "vis_line", 21: "home_line", 23: "vis_h", 46: "vis_e", 51: "home_h", 74: "home_e",
    95: "wp_name", 97: "lp_name", 99: "sv_name",
    102: "vis_sp_id", 103: "vis_sp_name", 104: "home_sp_id", 105: "home_sp_name",
}


def load_gamelog(season):
    gl = pd.read_csv(RAW / f"GL{season}.TXT", header=None, dtype=str, keep_default_na=False)
    gl = gl[[i - 1 for i in GL_FIELDS]]
    gl.columns = list(GL_FIELDS.values())
    for c in ["vis_r", "home_r", "vis_h", "vis_e", "home_h", "home_e"]:
        gl[c] = gl[c].astype(int)
    # Retrosheet gid: HOME + yyyymmdd + game number
    gl["gid"] = gl["home"] + gl["date"] + gl["game_num"]
    return gl


def parse_line_score(s):
    """'005130000' -> [0,0,5,1,3,0,0,0,0]; '(10)' marks a double-digit inning, 'x' an unplayed half."""
    out = []
    for tok in re.findall(r"\(\d+\)|\d|x", s):
        out.append(None if tok == "x" else int(tok.strip("()")))
    return out


def num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if pd.isna(f) else f


def load_odds(season):
    """Returns {(yyyymmdd, vis_retro, home_retro): [game odds in listing order]}."""
    df = pd.read_excel(RAW / f"mlb-odds-{season}.xlsx")
    df.columns = [
        "date", "rot", "vh", "team", "pitcher", *[f"i{i}" for i in range(1, 10)], "final",
        "open", "close", "rl", "rl_odds", "open_ou", "open_ou_odds", "close_ou", "close_ou_odds",
    ]
    rows = df.to_dict("records")
    games = defaultdict(list)
    for a, b in zip(rows[0::2], rows[1::2]):
        # Rows come in pairs: visitor (odd rot #) then home. 'N' = neutral site, same order.
        mmdd = int(a["date"])
        date = f"{season}{mmdd:04d}"
        ta, tb = SBR_TO_RETRO.get(a["team"]), SBR_TO_RETRO.get(b["team"])
        if not ta or not tb or int(b["date"]) != mmdd:
            continue
        games[(date, ta, tb)].append({
            "vis_final": num(a["final"]), "home_final": num(b["final"]),
            "vis_throws": str(a["pitcher"])[-1:], "home_throws": str(b["pitcher"])[-1:],
            "ml_vis": num(a["close"]), "ml_home": num(b["close"]),
            "open_ml_vis": num(a["open"]), "open_ml_home": num(b["open"]),
            "rl_vis": num(a["rl"]), "rl_vis_odds": num(a["rl_odds"]),
            "rl_home": num(b["rl"]), "rl_home_odds": num(b["rl_odds"]),
            "total": num(a["close_ou"]), "total_check": num(b["close_ou"]),
            # SBR lists the over price on the first row and the under price on the second.
            "over": num(a["close_ou_odds"]), "under": num(b["close_ou_odds"]),
            "open_total": num(a["open_ou"]),
        })
    return games


def valid_american(x):
    return x is not None and abs(x) >= 100 and abs(x) < 5000


def odds_ok(o):
    return (
        valid_american(o["ml_vis"]) and valid_american(o["ml_home"])
        and o["total"] is not None and 4 <= o["total"] <= 20 and o["total"] == o["total_check"]
        and valid_american(o["over"]) and valid_american(o["under"])
    )


def team_split(games, team):
    w = sum(1 for g in games if g["rf"] > g["ra"])
    return {"w": w, "l": len(games) - w}


def team_pre(team_games, team, date, is_home):
    prior = [g for g in team_games[team] if g["date"] < date]
    if not prior:
        return None
    last10 = prior[-10:]
    streak_char = "W" if prior[-1]["rf"] > prior[-1]["ra"] else "L"
    n = 0
    for g in reversed(prior):
        if ("W" if g["rf"] > g["ra"] else "L") != streak_char:
            break
        n += 1
    games = len(prior)
    return {
        "games": games,
        "record": team_split(prior, team),
        "last10": team_split(last10, team),
        "homeRecord": team_split([g for g in prior if g["home"]], team),
        "roadRecord": team_split([g for g in prior if not g["home"]], team),
        "streak": f"{streak_char}{n}",
        "rpg": round(sum(g["rf"] for g in prior) / games, 2),
        "rapg": round(sum(g["ra"] for g in prior) / games, 2),
    }


def pitcher_pre(pitch_by_id, pid, name, throws, date):
    prior = [p for p in pitch_by_id.get(pid, []) if p["date"] < date]
    starts = [p for p in prior if p["gs"]]
    outs = sum(p["outs"] for p in prior)
    er = sum(p["er"] for p in prior)
    h = sum(p["h"] for p in prior)
    bb = sum(p["bb"] for p in prior)
    k = sum(p["k"] for p in prior)
    ip = outs / 3
    return {
        "id": pid,
        "name": name,
        "throws": throws if throws in ("L", "R") else None,
        "gs": len(starts),
        "w": sum(p["w"] for p in prior),
        "l": sum(p["l"] for p in prior),
        "ip": f"{outs // 3}.{outs % 3}",
        "era": round(er * 9 / ip, 2) if outs else None,
        "whip": round((h + bb) / ip, 2) if outs else None,
        "k9": round(k * 9 / ip, 1) if outs else None,
        "last3": [
            {"ip": f"{p['outs'] // 3}.{p['outs'] % 3}", "er": p["er"], "k": p["k"]}
            for p in starts[-3:]
        ],
    }


def conditions(info):
    if info is None:
        return None
    sky = info.get("sky") or "unknown"
    if sky == "dome":
        return {"dome": True}
    temp = info.get("temp")
    wind = info.get("windspeed")
    return {
        "dome": False,
        "temp": int(temp) if temp not in (None, "", "0") and not pd.isna(temp) else None,
        "sky": None if sky == "unknown" else sky,
        "windDir": None if info.get("winddir") in (None, "unknown") else info["winddir"],
        "windMph": int(wind) if wind not in (None, "") and not pd.isna(wind) and int(wind) > 0 else None,
    }


def main(season):
    gl = load_gamelog(season)
    odds = load_odds(season)
    info = pd.read_csv(RAW / f"{season}gameinfo.csv", dtype=str, keep_default_na=False)
    info = {r["gid"]: r for r in info.to_dict("records")}

    pitching = pd.read_csv(RAW / f"{season}pitching.csv", dtype=str, keep_default_na=False)
    pitching = pitching[(pitching["stattype"] == "value") & (pitching["gametype"] == "regular")]
    pitch_by_id = defaultdict(list)
    pitch_by_gid = defaultdict(dict)
    for r in pitching.to_dict("records"):
        line = {
            "date": r["date"], "gs": r["p_gs"] == "1",
            "outs": int(r["p_ipouts"] or 0), "er": int(r["p_er"] or 0), "h": int(r["p_h"] or 0),
            "bb": int(r["p_w"] or 0), "k": int(r["p_k"] or 0),
            "w": 1 if r["wp"] == "1" else 0, "l": 1 if r["lp"] == "1" else 0,
        }
        pitch_by_id[r["id"]].append(line)
        pitch_by_gid[r["gid"]][r["id"]] = line
    for lines in pitch_by_id.values():
        lines.sort(key=lambda p: p["date"])

    team_games = defaultdict(list)
    for g in gl.sort_values(["date", "game_num"]).to_dict("records"):
        team_games[g["vis"]].append({"date": g["date"], "home": False, "rf": g["vis_r"], "ra": g["home_r"]})
        team_games[g["home"]].append({"date": g["date"], "home": True, "rf": g["home_r"], "ra": g["vis_r"]})

    dropped = defaultdict(int)
    pool = []
    odds_used = set()
    for g in gl.sort_values(["date", "game_num"]).to_dict("records"):
        gi = info.get(g["gid"])
        key = (g["date"], g["vis"], g["home"])
        if gi is None or gi["gametype"] != "regular":
            dropped["not regular season"] += 1
            continue
        if g["completion"] or g["forfeit"] or gi.get("suspend"):
            dropped["suspended/completed later/forfeit"] += 1
            continue
        if g["vis"] not in TEAMS or g["home"] not in TEAMS:
            dropped["unknown team"] += 1
            continue

        # Doubleheaders: both games share a (date, teams) key and the two sources don't always
        # list them in the same order, so pair each game with an unused listing whose final matches.
        candidates = odds.get(key, [])
        if not candidates:
            dropped["no odds record"] += 1
            continue
        o = next(
            (c for c in candidates
             if id(c) not in odds_used and c["vis_final"] == g["vis_r"] and c["home_final"] == g["home_r"]),
            None,
        )
        if o is None:
            dropped["odds final score mismatch"] += 1
            continue
        odds_used.add(id(o))
        if not odds_ok(o):
            dropped["incomplete odds"] += 1
            continue

        away_pre = team_pre(team_games, g["vis"], g["date"], False)
        home_pre = team_pre(team_games, g["home"], g["date"], True)
        if not away_pre or not home_pre or min(away_pre["games"], home_pre["games"]) < MIN_TEAM_GAMES:
            dropped["too early in season"] += 1
            continue

        box = pitch_by_gid.get(g["gid"], {})

        def team(code):
            abbr, name, div = TEAMS[code]
            return {"code": code, "abbr": abbr, "name": name, "division": div}

        def starter_line(pid):
            p = box.get(pid)
            if not p:
                return None
            return {"ip": f"{p['outs'] // 3}.{p['outs'] % 3}", "h": p["h"], "er": p["er"], "bb": p["bb"], "k": p["k"]}

        pool.append({
            "id": g["gid"],
            "date": f"{g['date'][:4]}-{g['date'][4:6]}-{g['date'][6:]}",
            "season": int(season),
            "dayNight": "day" if g["daynight"] == "D" else "night",
            "divisional": TEAMS[g["vis"]][2] == TEAMS[g["home"]][2],
            "away": team(g["vis"]),
            "home": team(g["home"]),
            "park": {"id": g["park"], "name": PARKS.get(g["park"], g["park"])},
            "conditions": conditions(gi),
            "pre": {
                "away": {**away_pre, "starter": pitcher_pre(pitch_by_id, g["vis_sp_id"], g["vis_sp_name"], o["vis_throws"], g["date"])},
                "home": {**home_pre, "starter": pitcher_pre(pitch_by_id, g["home_sp_id"], g["home_sp_name"], o["home_throws"], g["date"])},
            },
            "odds": {
                "source": "Sportsbook Review archive",
                "ml": {"away": int(o["ml_vis"]), "home": int(o["ml_home"])},
                "total": {"line": o["total"], "over": int(o["over"]), "under": int(o["under"])},
                "runLine": {
                    "away": o["rl_vis"], "awayOdds": o["rl_vis_odds"],
                    "home": o["rl_home"], "homeOdds": o["rl_home_odds"],
                },
                # Kept for CLV in a later version; Daily Mode shows only the closing line.
                "open": {"mlAway": o["open_ml_vis"], "mlHome": o["open_ml_home"], "total": o["open_total"]},
            },
            "result": {
                "away": {"r": g["vis_r"], "h": g["vis_h"], "e": g["vis_e"], "line": parse_line_score(g["vis_line"])},
                "home": {"r": g["home_r"], "h": g["home_h"], "e": g["home_e"], "line": parse_line_score(g["home_line"])},
                "decisions": {k: (g[f"{k}_name"] if g[f"{k}_name"] not in ("", "(none)") else None) for k in ("wp", "lp", "sv")},
                "starters": {"away": starter_line(g["vis_sp_id"]), "home": starter_line(g["home_sp_id"])},
            },
        })

    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{season}.json"
    out.write_text(json.dumps(pool, separators=(",", ":")))
    print(f"{season}: {len(gl)} games in log -> {len(pool)} eligible -> {out.relative_to(ROOT)}")
    for reason, n in sorted(dropped.items(), key=lambda kv: -kv[1]):
        print(f"  dropped {n:5d}  {reason}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "2019")
