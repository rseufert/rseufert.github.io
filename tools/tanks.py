#!/usr/bin/env python3
"""Compile the tanks sent in to the arena from the repo's issues into data/tanks.json.

A visitor whose tank gets through the gauntlet (arena/arena-gauntlet.js) is
offered to send it in, which opens a prefilled issue on this repo titled
"tank: NAME" with the program in a fenced code block. This script reads the
open issues with that title, takes each program out of its block, refights
it through the gauntlet in node, and lists the ones that pass, best record
first; a workflow runs it when an issue changes and commits the result to
the sky-data branch, where the arena page reads it
(.github/workflows/tanks.yml). Closing an issue takes a tank out.

    python3 tools/tanks.py               # write data/tanks.json
    python3 tools/tanks.py --out FILE    # write FILE instead

The programs run only inside the arena's interpreter, which is bounded;
nothing in an issue is evaluated as anything else. GITHUB_TOKEN, if set, is
used for the API.
"""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

REPO = "rseufert/rseufert.github.io"
ROOT = Path(__file__).resolve().parent.parent
GAUNTLET = ROOT / "arena" / "arena-gauntlet.js"
OUT = ROOT / "data" / "tanks.json"
PREFIX = "tank:"
MOST = 30


def issues():
    out, page = [], 1
    while True:
        req = urllib.request.Request(
            f"https://api.github.com/repos/{REPO}/issues?state=open&per_page=100&page={page}",
            headers={"Accept": "application/vnd.github+json", "User-Agent": "rickseufert.com arena"})
        if os.environ.get("GITHUB_TOKEN"):
            req.add_header("Authorization", "Bearer " + os.environ["GITHUB_TOKEN"])
        with urllib.request.urlopen(req, timeout=60) as r:
            batch = json.load(r)
        out += [i for i in batch if "pull_request" not in i]
        if len(batch) < 100:
            return out
        page += 1


def program(body):
    """The first fenced code block in the body, as written."""
    m = re.search(r"```[^\n]*\n(.*?)\n```", body or "", re.S)
    return m.group(1).replace("\r\n", "\n") if m else None


def gauntlet(source):
    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as f:
        f.write(source)
        path = f.name
    try:
        done = subprocess.run(["node", str(GAUNTLET), path], capture_output=True, text=True, timeout=300)
    finally:
        os.unlink(path)
    if done.returncode != 0:
        print("  the gauntlet failed to run:", done.stderr.strip()[:200], file=sys.stderr)
        return None
    return json.loads(done.stdout)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()
    sent = [i for i in issues() if i["title"].lower().startswith(PREFIX)]
    tanks = {}
    for issue in sent:
        source = program(issue.get("body"))
        if not source:
            print(f"#{issue['number']}: no program in a code block; skipped")
            continue
        result = gauntlet(source)
        if not result:
            continue
        if not result["ok"]:
            why = result["errors"] or result["faults"] or [f"won {result['wins']} of {result['of']}"]
            print(f"#{issue['number']} {result.get('name') or issue['title']}: not listed ({why[0]})")
            continue
        entry = {
            "name": result["name"],
            "wins": result["wins"],
            "of": result["of"],
            "beaten": result["beaten"],
            "by": issue["user"]["login"],
            "when": issue["created_at"][:10],
            "url": issue["html_url"],
            "source": source,
        }
        # One tank a name: the better record keeps it, the earlier on a tie.
        old = tanks.get(entry["name"])
        if not old or (entry["wins"], -len(entry["when"]), old["when"]) > (old["wins"], -len(old["when"]), entry["when"]):
            tanks[entry["name"]] = entry
        print(f"#{issue['number']} {entry['name']}: {entry['wins']} of {entry['of']}")
    listed = sorted(tanks.values(), key=lambda t: (-t["wins"], t["when"]))[:MOST]
    book = {
        "about": f"Tanks sent in to the arena that got through the gauntlet: the open issues on {REPO} titled 'tank:', each refought by tools/tanks.py, best record first.",
        "updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "tanks": listed,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(book, indent=1, ensure_ascii=False) + "\n")
    print(f"{len(listed)} listed of {len(sent)} sent; wrote {args.out}")


if __name__ == "__main__":
    main()
