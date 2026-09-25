#!/usr/bin/env python3
"""Check that this site's copies of the worked examples match their repos.

The SAP-to-EDI post links to files under /examples/, so the site carries its
own copy of each one.  The authoritative copy lives in the repo of the mock
the example is *not* testing: po_bridge in mock-edi, invoice_check in
mock-sap.  Each repo's CI runs its example against the other mock, so the
repo copies are the tested ones; these are a transcription, and nothing
stopped them drifting until this script existed.

    python3 tools/check_examples.py            # compare, and diff what differs
    python3 tools/check_examples.py --update    # fetch the repo copy over ours

Note that this compares against the tip of each repo's default branch, which
moves on its own.  A run that passes today can fail tomorrow with nothing
changed here -- that failure is the point, and --update is the fix.

Standard library only, like the projects it checks.
"""
import argparse
import difflib
import sys
import urllib.error
import urllib.request

RAW = "https://raw.githubusercontent.com/rseufert/%s/%s/%s"
BRANCH = "main"

# site path -> (repo, path within that repo)
COPIES = {
    "examples/po-bridge/po_bridge.py":
        ("mock-edi", "examples/po_bridge.py"),
    "examples/po-bridge/test_po_bridge.py":
        ("mock-edi", "examples/test_po_bridge.py"),
    "examples/invoice-check/invoice_check.py":
        ("mock-sap", "examples/invoice_check.py"),
    "examples/invoice-check/test_invoice_check.py":
        ("mock-sap", "examples/test_invoice_check.py"),
}


def fetch(repo, path):
    url = RAW % (repo, BRANCH, path)
    with urllib.request.urlopen(url, timeout=30) as response:
        return response.read().decode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--update", action="store_true",
                        help="overwrite the site's copies with the repo's")
    args = parser.parse_args()

    problems = []
    updated = []
    for local, (repo, remote) in sorted(COPIES.items()):
        try:
            theirs = fetch(repo, remote)
        except (urllib.error.URLError, urllib.error.HTTPError) as exc:
            # Say which file could not be checked rather than passing quietly.
            problems.append("%s: could not read %s/%s (%s)"
                            % (local, repo, remote, exc))
            continue

        try:
            with open(local, encoding="utf-8") as handle:
                ours = handle.read()
        except IOError as exc:
            problems.append("%s: %s" % (local, exc))
            continue

        if ours == theirs:
            continue

        if args.update:
            with open(local, "w", encoding="utf-8") as handle:
                handle.write(theirs)
            updated.append("%s <- %s/%s" % (local, repo, remote))
            continue

        problems.append("%s has drifted from %s/%s@%s:\n%s"
                        % (local, repo, remote, BRANCH, "".join(
                            difflib.unified_diff(
                                theirs.splitlines(keepends=True),
                                ours.splitlines(keepends=True),
                                fromfile="%s/%s" % (repo, remote),
                                tofile=local))))

    for line in updated:
        print("updated %s" % line)
    if problems:
        for problem in problems:
            print(problem, file=sys.stderr)
        print("\n%d of %d example copies need attention. `python3 "
              "tools/check_examples.py --update` takes the repo's version."
              % (len(problems), len(COPIES)), file=sys.stderr)
        return 1

    if not updated:
        print("All %d example copies match their repos." % len(COPIES))
    return 0


if __name__ == "__main__":
    sys.exit(main())
