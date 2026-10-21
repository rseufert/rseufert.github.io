#!/usr/bin/env python3
"""Compile the guest book from the repo's issues into data/guestbook.json.

Whoever escapes rickbot's dungeon (chat/chat.js) is offered the guest book,
web 0.9 style. Signing opens a prefilled issue on this repo titled
"guestbook: NAME", with the run's numbers and a message in the body. This
script reads the open issues with that title, keeps the fields it knows,
trims them, and writes them newest first; a workflow runs it when an issue
changes and commits the result to the sky-data branch, where the page reads
it (.github/workflows/guestbook.yml). Closing an issue takes its entry out.

    python3 tools/guestbook.py               # write data/guestbook.json
    python3 tools/guestbook.py --out FILE    # write FILE instead

GITHUB_TOKEN, if set, is used for the API; without it the public rate limit
is plenty for a guest book.
"""
import argparse
import datetime
import json
import os
import re
import sys
import urllib.request
from pathlib import Path

REPO = "rseufert/rseufert.github.io"
# The house always goes first.
HOUSE = {
    "name": "RICK",
    "score": 69420000,
    "moves": None,
    "deaths": None,
    "time": None,
    "message": "the house always wins. sign below.",
    "by": "rseufert",
    "when": "2016-08-30",
    "url": "https://rickseufert.com/",
}
OUT = Path(__file__).resolve().parent.parent / "data" / "guestbook.json"
PREFIX = "guestbook:"
FIELDS = {"name": 40, "moves": 6, "deaths": 6, "time": 12, "message": 280}


def issues():
    out, page = [], 1
    while True:
        req = urllib.request.Request(
            f"https://api.github.com/repos/{REPO}/issues?state=open&per_page=100&page={page}",
            headers={"Accept": "application/vnd.github+json", "User-Agent": "rickseufert.com guest book"})
        if os.environ.get("GITHUB_TOKEN"):
            req.add_header("Authorization", "Bearer " + os.environ["GITHUB_TOKEN"])
        with urllib.request.urlopen(req, timeout=60) as r:
            batch = json.load(r)
        out += [i for i in batch if "pull_request" not in i]
        if len(batch) < 100:
            return out
        page += 1


def clean(text, limit):
    text = re.sub(r"\s+", " ", text or "").strip()
    text = re.sub(r"https?://\S+", "", text).strip()     # no links in a guest book
    return text[:limit]


def entry(issue):
    """The body is key: value lines up to a line of dashes; the message may run on."""
    fields, key = {}, None
    for raw in (issue.get("body") or "").splitlines():
        line = raw.rstrip()
        if line.strip().startswith("--"):
            break
        m = re.match(r"^(\w+):\s*(.*)$", line)
        if m and m.group(1).lower() in FIELDS:
            key = m.group(1).lower()
            fields[key] = m.group(2)
        elif key == "message" and line.strip():
            fields[key] += " " + line.strip()
    name = clean(fields.get("name") or issue["title"][len(PREFIX):], FIELDS["name"])
    if not name:
        return None
    def number(k):
        m = re.search(r"\d+", fields.get(k, ""))
        return int(m.group()) if m else None
    return {
        "name": name,
        "moves": number("moves"),
        "deaths": number("deaths"),
        "time": clean(fields.get("time"), FIELDS["time"]) or None,
        "message": clean(fields.get("message"), FIELDS["message"]) or None,
        "by": issue["user"]["login"],
        "when": issue["created_at"][:10],
        "url": issue["html_url"],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=OUT)
    args = ap.parse_args()
    signed = [i for i in issues() if i["title"].lower().startswith(PREFIX)]
    entries = [e for e in (entry(i) for i in signed) if e]
    entries.sort(key=lambda e: e["when"], reverse=True)
    entries.insert(0, HOUSE)
    book = {
        "about": f"Who has escaped rickbot's dungeon and signed: the house, then the open issues on {REPO} titled 'guestbook:', newest first. Written by tools/guestbook.py.",
        "updated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "entries": entries,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(book, indent=1, ensure_ascii=False) + "\n")
    print(f"{len(entries) - 1} signed, plus the house; wrote {args.out}")


if __name__ == "__main__":
    main()
