#!/usr/bin/env python3
"""Compile the clubhouse board from the cards posted as issues into cards.json.

A round of golf (golf/golf.js) ends with a card, and the page offers to post
it to the board, which opens a prefilled issue on this repo titled
"card: TOTAL on COURSE (SEED)" with the card in a fenced code block. This
script reads the open issues with that title, checks each card is a card and
nothing else, works out the course's par from the seed the way the game does,
keeps each player's best on each course, and writes them newest first, with
the clubhouse's records: the best of each kind among every card posted. A
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
or a dash for nothing. The second generation carries the round's numbers too:

    gc2:SEED:TOTAL:H1,...,H9:FLAGS:STATS:INITIALS:CHECK

STATS is a comma-separated list of a letter and a number, each at most once,
or a dash: d the longest drive that found the short grass, in yards; p the
longest putt to drop, in feet; o the longest hole out from off the green, in
yards; n the tee shot nearest the pin on a par three, in inches; f fairways
hit, g greens hit and u putts, which a round with a hole picked up does not
carry. INITIALS is one to three capitals or figures, or a dash. CHECK is a
check word over everything before it (FNV-1a with a phrase on the end, in
base 36, as golf/golf.js makes it), so a number changed by hand no longer
adds up. It is not a secret, since the game's source is public: an honour
system with a lock on the door. A number outside what the course allows
(more fairways than there are par fours and fives, a 500 yard drive) throws
the card out.

An issue's body can be edited after it is posted, by its author or by anyone
with write access to the repo. With a token, each issue's last editor is read
(GraphQL), and a card whose issue was last edited by someone other than its
author is left out: it is no longer that player's card. Without a token the
check is skipped and the output says so.

Nothing in an issue is evaluated; a line that is not one of those shapes is
left out. GITHUB_TOKEN, if set, is used for the API.
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
CARD2 = re.compile(r"^(gc2:(\d{1,8}):(\d{1,2}):((?:\d{1,2},){8}\d{1,2}):(-|(?:(?:sq|hood|ace)\d(?:,(?:sq|hood|ace)\d)*))"
                   r":(-|[dponfgu]\d{1,4}(?:,[dponfgu]\d{1,4})*):(-|[A-Z0-9]{1,3})):([0-9a-z]{1,7})$")
MOST = 1000
# What a number on a card may be: the most a course allows, with room to spare.
LIMITS = {"d": (1, 450), "p": (1, 120), "o": (1, 450), "n": (1, 1400), "f": (0, 7), "g": (0, 9), "u": (0, 90)}
# The records, as the game's board has them: the key, the card's letter (or what is worked out from the holes), and whether less is better.
RECORDS = [("drive", "d", False), ("putt", "p", False), ("holeOut", "o", False), ("pin", "n", True),
           ("round", "total", True), ("birdies", "birdies", False), ("fairways", "f", False), ("greens", "g", False), ("putts", "u", True)]
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


def check_word(text):
    """FNV-1a over the line and a phrase, in base 36: the same as checkWord in golf/golf.js."""
    h = 0x811C9DC5
    for ch in (text + "|the trackball worn smooth").encode("ascii", "replace"):    # a card line is ASCII, or it is not a card
        h = imul(h ^ ch, 0x01000193)
    digits, out = "0123456789abcdefghijklmnopqrstuvwxyz", ""
    while True:
        out = digits[h % 36] + out
        h //= 36
        if not h:
            return out


def editors():
    """Who wrote and who last edited each open issue, by number; None without a token (GraphQL wants one)."""
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        return None
    owner, name = REPO.split("/")
    query = ("query($owner:String!,$name:String!,$after:String){repository(owner:$owner,name:$name){"
             "issues(states:OPEN,first:100,after:$after){pageInfo{hasNextPage endCursor}"
             "nodes{number lastEditedAt author{login} editor{login}}}}}")
    out, after = {}, None
    while True:
        req = urllib.request.Request(
            "https://api.github.com/graphql",
            data=json.dumps({"query": query, "variables": {"owner": owner, "name": name, "after": after}}).encode(),
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json", "User-Agent": "rickseufert.com golf"})
        with urllib.request.urlopen(req, timeout=60) as r:
            reply = json.load(r)
        if reply.get("errors"):
            raise SystemExit(f"could not read who edited the issues: {reply['errors']}")
        page = reply["data"]["repository"]["issues"]
        for n in page["nodes"]:
            out[n["number"]] = {"author": (n.get("author") or {}).get("login"), "editor": (n.get("editor") or {}).get("login"),
                                "edited": n.get("lastEditedAt")}
        if not page["pageInfo"]["hasNextPage"]:
            return out
        after = page["pageInfo"]["endCursor"]


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
    c, stats, initials, v = CARD.match(line), {}, "", 1
    if not c:
        c2 = CARD2.match(line)
        if not c2 or check_word(c2.group(1)) != c2.group(8):
            return None
        c, v = re.match(r"^gc2:(\d+):(\d+):([\d,]+):([^:]+):", line), 2
        if c2.group(6) != "-":
            for bit in c2.group(6).split(","):
                if bit[0] in stats:
                    return None                       # a letter twice
                stats[bit[0]] = int(bit[1:])
        initials = "" if c2.group(7) == "-" else c2.group(7)
    seed, total = int(c.group(1)), int(c.group(2))
    holes = [int(h) for h in c.group(3).split(",")]
    if any(h < 1 or h > 10 for h in holes) or sum(holes) != total:
        return None
    flags = [] if c.group(4) == "-" else c.group(4).split(",")
    pars = pars_of(seed)
    # The numbers have to be ones the round could have had.
    if any(not LIMITS[k][0] <= n <= LIMITS[k][1] for k, n in stats.items()):
        return None
    if any(k in stats for k in "fgu") and (10 in holes or not all(k in stats for k in "fgu")):
        return None                                   # a picked-up hole carries none of the three; else all of them
    if stats.get("u", 0) > total or ("n" in stats and 3 not in pars):
        return None
    out = {"seed": seed, "course": NAMES[seed % len(NAMES)], "total": total, "par": sum(pars), "toPar": total - sum(pars),
           "holes": holes, "pars": pars, "flags": flags, "line": line, "v": v}
    if v == 2:
        out.update(stats=stats, initials=initials)
    return out


def records(cards):
    """The best of each kind among the cards, oldest first, so a record stands until it is beaten, not matched."""
    best = {}
    for c in sorted(cards, key=lambda c: (c["posted"], c["url"])):
        numbers = dict(c.get("stats") or {}, total=c["total"], birdies=sum(1 for h, p in zip(c["holes"], c["pars"]) if h < p))
        for key, field, lower in RECORDS:
            if field not in numbers:
                continue
            n = numbers[field]
            if n == 0 and field != "u":
                continue                              # nought of something is not a record
            if key in best and (n >= best[key]["v"] if lower else n <= best[key]["v"]):
                continue
            best[key] = {"v": n, "by": c["by"], "initials": c.get("initials", ""), "course": c["course"], "seed": c["seed"],
                         "when": c["when"], "url": c["url"]}
    return best


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
    edits = editors()
    if edits is None:
        print("no GITHUB_TOKEN: who last edited each issue was not checked")
    cards, best, every = [], {}, []
    for issue in posted:
        e = (edits or {}).get(issue["number"])
        if e and e["editor"] and e["editor"] != e["author"]:
            print(f"#{issue['number']}: last edited by {e['editor']}, not by {e['author']} who posted it; skipped")
            continue
        c = card(issue.get("body"))
        if not c:
            print(f"#{issue['number']}: not a card; skipped")
            continue
        key = (issue["user"]["login"], c["seed"])
        c.update(by=issue["user"]["login"], when=issue["created_at"][:10], url=issue["html_url"], posted=issue["created_at"])
        every.append(c)
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
    held = records(every)
    for key, r in held.items():
        print(f"record: {key} {r['v']} by {r['by']} on {r['course']} {r['seed']}")
    for c in every:
        c.pop("posted", None)
    board = {
        "about": f"The clubhouse board: the open issues on {REPO} titled 'card:', each a round of nine on a course of the day, a player's best on each course, newest first, read by tools/cards.py. An honour system, like the one in the clubhouse.",
        "updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "cards": cards,
        "records": held,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(board, indent=1, ensure_ascii=False) + "\n")
    print(f"{len(cards)} cards of {len(posted)} posted, {len(held)} records; wrote {args.out}")


if __name__ == "__main__":
    main()
