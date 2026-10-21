#!/usr/bin/env python3
"""Compile the ghosts left in the backrooms from the repo's issues into data/ghosts.json.

Whoever the backrooms (backrooms/backrooms.js) find leaves a ghost: their
last thirty seconds, ten positions a second, packed into one line. The page
keeps it in the browser and offers to leave it, which opens a prefilled issue
on this repo titled "ghost: level L of seed S" with the line in a fenced code
block. This script reads the open issues with that title, checks each line
is a ghost and nothing else, and writes them newest first, a few hundred at
most and twenty a floor; a workflow runs it when an issue changes and
commits the result to the sky-data branch, where the page reads it
(.github/workflows/ghosts.yml). Closing an issue lays its ghost to rest.

    python3 tools/ghosts.py               # write data/ghosts.json
    python3 tools/ghosts.py --out FILE    # write FILE instead

A ghost is  bk1:SEED:LEVEL:HZ:DATA  where DATA is six URL-safe base64
characters a sample: x and z in 64ths of a cell, then the yaw in 4096ths of
a turn. Nothing in an issue is evaluated; a line that is not that shape is
left out. GITHUB_TOKEN, if set, is used for the API.
"""
import argparse
import datetime
import json
import os
import re
import urllib.request
from collections import Counter
from pathlib import Path

REPO = "rseufert/rseufert.github.io"
OUT = Path(__file__).resolve().parent.parent / "data" / "ghosts.json"
PREFIX = "ghost:"
GHOST = re.compile(r"^bk1:(\d{1,7}):(\d{1,2}):(\d{1,2}):([A-Za-z0-9_-]{18,1800})$")
MOST = 400          # in all
A_FLOOR = 20        # on one seed and level


def issues():
    out, page = [], 1
    while True:
        req = urllib.request.Request(
            f"https://api.github.com/repos/{REPO}/issues?state=open&per_page=100&page={page}",
            headers={"Accept": "application/vnd.github+json", "User-Agent": "rickseufert.com backrooms"})
        if os.environ.get("GITHUB_TOKEN"):
            req.add_header("Authorization", "Bearer " + os.environ["GITHUB_TOKEN"])
        with urllib.request.urlopen(req, timeout=60) as r:
            batch = json.load(r)
        out += [i for i in batch if "pull_request" not in i]
        if len(batch) < 100:
            return out
        page += 1


def ghost(body):
    """The first fenced code block, if it is one ghost line and nothing else."""
    m = re.search(r"```[^\n]*\n(.*?)\n```", body or "", re.S)
    if not m:
        return None
    line = m.group(1).strip()
    g = GHOST.match(line)
    if not g or len(g.group(4)) % 6:
        return None
    return {"seed": int(g.group(1)), "level": int(g.group(2)), "path": line}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()
    left = [i for i in issues() if i["title"].lower().startswith(PREFIX)]
    left.sort(key=lambda i: i["created_at"], reverse=True)
    ghosts, floors = [], Counter()
    for issue in left:
        g = ghost(issue.get("body"))
        if not g:
            print(f"#{issue['number']}: not a ghost; skipped")
            continue
        floor = (g["seed"], g["level"])
        if floors[floor] >= A_FLOOR:
            print(f"#{issue['number']}: floor {floor} is full; skipped")
            continue
        floors[floor] += 1
        g.update(by=issue["user"]["login"], when=issue["created_at"][:10], url=issue["html_url"])
        ghosts.append(g)
        print(f"#{issue['number']}: seed {g['seed']} level {g['level']}, {len(g['path']) // 6} samples")
    ghosts = ghosts[:MOST]
    book = {
        "about": f"Ghosts left in the backrooms: the open issues on {REPO} titled 'ghost:', each a last thirty seconds on a seed and level, newest first, read by tools/ghosts.py.",
        "updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "ghosts": ghosts,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(book, indent=1, ensure_ascii=False) + "\n")
    print(f"{len(ghosts)} ghosts of {len(left)} left; wrote {args.out}")


if __name__ == "__main__":
    main()
