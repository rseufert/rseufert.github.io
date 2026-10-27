#!/usr/bin/env python3
"""Compile the clubhouse board from the cards posted as issues into cards.json.

A round of golf (golf/golf.js) ends with a card, and the page offers to post
it to the board, which opens a prefilled issue on this repo titled
"card: TOTAL on COURSE (SEED)" with the card in a fenced code block. This
script reads the open issues with that title, checks each card is a card and
nothing else, works out the course's par from the seed the way the game does,
keeps each player's best on each course, and writes them newest first; a
workflow runs it when an issue changes and commits the result to the sky-data
branch, where the page reads it (.github/workflows/cards.yml). Closing an
issue takes its card off the board.

    python3 tools/cards.py               # write data/cards.json
    python3 tools/cards.py --out FILE    # write FILE instead

A card is  gc1:SEED:TOTAL:H1,H2,...,H9:FLAGS  where SEED is the course (the
date, YYYYMMDD, or any number up to seven figures for a course picked by
hand), each H is strokes on a hole from 1 to 10 (10 is a pick-up), TOTAL is
their sum, and FLAGS is a comma-separated list of things that happened,
like sq4 (sasquatch seen on hole 4) or hood6 (Mt Hood erupted on hole 6),
or a dash for nothing. Nothing in an issue is evaluated; a line that is not
that shape is left out. GITHUB_TOKEN, if set, is used for the API.
"""
import argparse
import datetime
import json
import os
import re
import urllib.request
from pathlib import Path

REPO = "rseufert/rseufert.github.io"
OUT = Path(__file__).resolve().parent.parent / "data" / "cards.json"
PREFIX = "card:"
CARD = re.compile(r"^gc1:(\d{1,8}):(\d{1,2}):((?:\d{1,2},){8}\d{1,2}):(-|(?:(?:sq|hood|ace)\d(?:,(?:sq|hood|ace)\d)*))$")
MOST = 1000
# The same names and the same par shuffle as golf/golf.js, so the board can say the course and the par.
NAMES = ["Forest Park", "Willamette Bend", "Mount Tabor", "Burnside Links", "Sauvie Island", "Tryon Creek",
         "Rocky Butte", "Pittock Heights", "Laurelhurst", "Johnson Creek", "Powell Butte", "Kelley Point"]
M = 0xFFFFFFFF


def imul(a, b):
    return (a * b) & M


def rng(seed):
    """mulberry32, as the game has it, every step kept to 32 bits."""
    state = [seed & M]

    def r():
        state[0] = (state[0] + 0x6D2B79F5) & M
        t = state[0]
        t = imul(t ^ (t >> 15), t | 1)
        t ^= (t + imul(t ^ (t >> 7), t | 61)) & M
        t &= M
        return ((t ^ (t >> 14)) & M) / 4294967296

    return r


def pars_of(seed):
    pars = [4, 4, 3, 5, 4, 3, 4, 5, 4]
    order = rng(seed * 31 + 5)
    for i in range(len(pars) - 1, 0, -1):
        j = int(order() * (i + 1))
        pars[i], pars[j] = pars[j], pars[i]
    return pars


def issues():
    out, page = [], 1
    while True:
        req = urllib.request.Request(
            f"https://api.github.com/repos/{REPO}/issues?state=open&per_page=100&page={page}",
            headers={"Accept": "application/vnd.github+json", "User-Agent": "rickseufert.com golf"})
        if os.environ.get("GITHUB_TOKEN"):
            req.add_header("Authorization", "Bearer " + os.environ["GITHUB_TOKEN"])
        with urllib.request.urlopen(req, timeout=60) as r:
            batch = json.load(r)
        out += [i for i in batch if "pull_request" not in i]
        if len(batch) < 100:
            return out
        page += 1


def card(body):
    """The first fenced code block, if it is one card line and nothing else."""
    m = re.search(r"```[^\n]*\n(.*?)\n```", body or "", re.S)
    if not m:
        return None
    line = m.group(1).strip()
    c = CARD.match(line)
    if not c:
        return None
    seed, total = int(c.group(1)), int(c.group(2))
    holes = [int(h) for h in c.group(3).split(",")]
    if any(h < 1 or h > 10 for h in holes) or sum(holes) != total:
        return None
    flags = [] if c.group(4) == "-" else c.group(4).split(",")
    pars = pars_of(seed)
    return {"seed": seed, "course": NAMES[seed % len(NAMES)], "total": total, "par": sum(pars), "toPar": total - sum(pars),
            "holes": holes, "pars": pars, "flags": flags, "line": line}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--pars", type=int, help="print the pars of a seed and stop")
    args = ap.parse_args()
    if args.pars is not None:
        print(NAMES[args.pars % len(NAMES)], pars_of(args.pars))
        return
    posted = [i for i in issues() if i["title"].lower().startswith(PREFIX)]
    posted.sort(key=lambda i: i["created_at"], reverse=True)
    cards, best = [], {}
    for issue in posted:
        c = card(issue.get("body"))
        if not c:
            print(f"#{issue['number']}: not a card; skipped")
            continue
        key = (issue["user"]["login"], c["seed"])
        c.update(by=issue["user"]["login"], when=issue["created_at"][:10], url=issue["html_url"])
        if key in best and best[key]["total"] <= c["total"]:
            print(f"#{issue['number']}: {c['by']} has a better card on {c['seed']}; skipped")
            continue
        if key in best:
            cards.remove(best[key])
        best[key] = c
        cards.append(c)
        print(f"#{issue['number']}: {c['by']} {c['total']} ({c['toPar']:+d}) on {c['course']} {c['seed']}")
    cards.sort(key=lambda c: c["when"], reverse=True)
    cards = cards[:MOST]
    board = {
        "about": f"The clubhouse board: the open issues on {REPO} titled 'card:', each a round of nine on a course of the day, a player's best on each course, newest first, read by tools/cards.py. An honour system, like the one in the clubhouse.",
        "updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cards": cards,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(board, indent=1, ensure_ascii=False) + "\n")
    print(f"{len(cards)} cards of {len(posted)} posted; wrote {args.out}")


if __name__ == "__main__":
    main()
