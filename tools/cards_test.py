#!/usr/bin/env python3
"""Try tools/cards.py on good cards and doctored ones.

    python3 tools/cards_test.py

Checks that the check word comes out the same as the game's (checkWord in
golf/golf.js, run with node if there is one), that first and second
generation cards are read, that a card changed by hand or carrying numbers
no round could have had is thrown out, and that the clubhouse's records go
to the oldest card with the best number. Touches nothing and asks the
network nothing.
"""
import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("cards", ROOT / "tools" / "cards.py")
cards = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cards)

failed = []


def check(name, ok):
    print(("pass  " if ok else "FAIL  ") + name)
    if not ok:
        failed.append(name)


def signed(core):
    return core + ":" + cards.check_word(core)


def body(line):
    return "course: somewhere\n\n```\n" + line + "\n```\n\nPosted from the game."


# The check word, against the game's own.
lines = ["gc2:20261111:35:3,5,4,3,6,3,4,4,3:-:d305,p22,n62,f5,g5,u12:RIK", "gc2:777:37:4,4,4,4,4,4,4,4,5:sq4,hood6:-:-", "x"]
if shutil.which("node"):
    js = (ROOT / "golf" / "golf.js").read_text()
    fn = js[js.index("    function checkWord(str) {"):js.index("    function cardLine()")]
    out = subprocess.run(["node", "-e", fn + "\nprocess.stdout.write(JSON.stringify(" + json.dumps(lines) + ".map(checkWord)))"],
                         capture_output=True, text=True, check=True)
    check("the check word is the game's", json.loads(out.stdout) == [cards.check_word(x) for x in lines])
else:
    print("skip  the check word against the game's: no node here")

GOOD = "gc2:20261111:35:3,5,4,3,6,3,4,4,3:-:d305,p22,n62,f5,g5,u12:RIK"
for name, text, want in [
    ("a first generation card is still a card", "gc1:4242:35:3,5,4,3,6,3,4,4,3:-", True),
    ("a second generation card", signed(GOOD), True),
    ("one with no numbers and no initials", signed("gc2:777:37:4,4,4,4,4,4,4,4,5:sq4,hood6:-:-"), True),
    ("a number changed by hand", signed(GOOD).replace("d305", "d399"), False),
    ("a hole changed by hand", signed(GOOD).replace(":35:3,5", ":34:2,5"), False),
    ("no check word", GOOD, False),
    ("a 500 yard drive, signed", signed(GOOD.replace("d305", "d500")), False),
    ("eight fairways, signed", signed(GOOD.replace("f5", "f8")), False),
    ("fairways without greens and putts", signed("gc2:20261111:35:3,5,4,3,6,3,4,4,3:-:f5:RIK"), False),
    ("putts on a round with a hole picked up", signed("gc2:20261111:42:10,5,4,3,6,3,4,4,3:-:f5,g5,u12:RIK"), False),
    ("more putts than strokes", signed(GOOD.replace("u12", "u40")), False),
    ("a letter twice", signed("gc2:20261111:35:3,5,4,3,6,3,4,4,3:-:d300,d310:RIK"), False),
    ("initials in lower case", signed(GOOD.replace(":RIK", ":rik")), False),
    ("a total that does not add up", signed(GOOD.replace(":35:", ":36:")), False),
    ("two lines in the block", signed(GOOD) + "\n" + signed(GOOD), False),
]:
    check(name, (cards.card(body(text)) is not None) == want)


def posted(line, by, when, n):
    c = cards.card(body(line if line.startswith("gc1") else signed(line)))
    c.update(by=by, when=when[:10], url=f"https://github.com/{cards.REPO}/issues/{n}", posted=when)
    return c


held = cards.records([
    posted("gc2:20261111:35:3,5,4,3,6,3,4,4,3:-:d305,p22,n62,f5,g5,u12:RIK", "rick", "2026-11-11T10:00:00Z", 1),
    posted("gc2:20261111:35:3,5,4,3,6,3,4,4,3:-:d305,p30,f6,g5,u12:ZAK", "zack", "2026-11-11T11:00:00Z", 2),
    posted("gc2:20261112:33:3,4,4,3,4,3,4,4,4:-:d290,o41,n40,f4,g8,u11:-", "dash", "2026-11-12T09:00:00Z", 3),
    posted("gc1:4242:31:3,3,4,3,4,3,4,4,3:-", "old", "2026-11-10T09:00:00Z", 4),
])
for key, v, by in [("drive", 305, "rick"), ("putt", 30, "zack"), ("holeOut", 41, "dash"), ("pin", 40, "dash"), ("round", 31, "old"),
                   ("fairways", 6, "zack"), ("greens", 8, "dash"), ("putts", 11, "dash")]:
    check(f"the record for {key} is {v}, by {by}", key in held and held[key]["v"] == v and held[key]["by"] == by)
check("a drive matched later does not take the record", held["drive"]["initials"] == "RIK")

print("all passed" if not failed else f"{len(failed)} failed")
sys.exit(1 if failed else 0)
