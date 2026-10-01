#!/usr/bin/env python3
"""Bring the projects page's films up to date with mock-films' index.

mock-films keeps an index of its finished films, docs/films/index.json, and
that index is the source of truth: which films exist, the sha256 of each
GIF's current cut, and the alt text and caption the mock-films team wrote for
it. This compares the page against a local clone of mock-films and says what
differs; with --apply it makes the page match.

    git clone https://github.com/rseufert/mock-films ../mock-films
    python3 tools/sync_films.py                   # report only
    python3 tools/sync_films.py --apply           # copy, rewrite, add, remove
    python3 tools/sync_films.py --films DIR       # a clone somewhere else

What --apply does, per film in the index:

    finished, not on the page   added under the project of its first mock
    finished, a different hash  the new cut copied into blog/
    finished, different text    the alt text and caption replaced, as written
    withdrawn, on the page      its figure, GIF and still removed

and then writes the stills, through film_stills. A film on the page that the
index does not list is reported and left alone: it may be a rename, and a
rename is a decision for a person, not for this script.

The alt text and caption are used exactly as the index has them. Some films
show a failure the capture script asked a mock to produce, and the text says
so; rewording it here could lose that.

mock-films is private, so CI cannot run this; film_stills --check is what CI
holds the page to once a sync is committed.
"""
import argparse
import hashlib
import html
import json
import os
import re
import shutil
import sys

import film_stills

ROOT = film_stills.ROOT
PAGE = film_stills.PAGE
BLOG = os.path.join(ROOT, "blog")
NAME = re.compile(r"[a-z0-9_]+\Z")

FIGURE = re.compile(r'\n?([ \t]*)<figure class="film">.*?</figure>', re.S)
SRC = re.compile(r'<img[^>]*\bsrc="/blog/([a-z0-9_]+)\.gif"')
ALT = re.compile(r'(<img[^>]*\balt=")([^"]*)(")')
# The line under every caption, after the mock-films team's own words.
TAG = "<span>drawn by mock-films from a real run</span>"
CAPTION = re.compile(r"(<figcaption>)(.*?)( %s</figcaption>)" % re.escape(TAG), re.S)
PROJECT = re.compile(r'<div class="project">\s*<h3><a href="[^"]*">([^<]+)</a></h3>.*?'
                     r"</div><!-- /\.project -->", re.S)


def attr(text):
    """Text for a double-quoted attribute; apostrophes stay as they are."""
    return html.escape(text, quote=False).replace('"', "&quot;")


def figure(name, alt, caption, width, height, indent, lazy):
    i = indent
    return ("\n%s<figure class=\"film\">\n"
            "%s\t<picture>\n"
            "%s\t\t<source media=\"(prefers-reduced-motion: reduce)\" srcset=\"/blog/%s.png\">\n"
            "%s\t\t<img src=\"/blog/%s.gif\" width=\"%d\" height=\"%d\"%s alt=\"%s\">\n"
            "%s\t</picture>\n"
            "%s\t<figcaption>%s " + TAG + "</figcaption>\n"
            "%s</figure>") % (i, i, i, name, i, name, width, height,
                              ' loading="lazy"' if lazy else "", attr(alt),
                              i, i, html.escape(caption, quote=False), i)


def sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def load_index(films_dir):
    path = os.path.join(films_dir, "docs", "films", "index.json")
    with open(path, encoding="utf-8") as f:
        films = json.load(f)["films"]
    for film in films:
        name = film["name"]
        # The site's file names come from `name`, so it has to be the GIF's
        # own name; an entry that breaks that is a question, not a guess.
        if not NAME.match(name) or os.path.basename(film["path"]) != name + ".gif":
            sys.exit("index.json: %r does not name its GIF (%s); stopping"
                     % (name, film["path"]))
        if film["status"] == "finished":
            gif = os.path.join(films_dir, film["path"])
            if sha256(gif) != film["sha256"]:
                sys.exit("index.json: %s says sha256 %s, but %s is %s; is the clone "
                         "behind?" % (name, film["sha256"][:12], film["path"],
                                      sha256(gif)[:12]))
    return films


def on_page(page):
    """name -> (alt, caption) for each film on the page."""
    found = {}
    for m in FIGURE.finditer(page):
        block = m.group(0)
        name = SRC.search(block).group(1)
        found[name] = (html.unescape(ALT.search(block).group(2)),
                       html.unescape(CAPTION.search(block).group(2)))
    return found


def plan(films, page):
    shown = on_page(page)
    listed = {f["name"] for f in films}
    changes = []
    for film in films:
        name = film["name"]
        if film["status"] == "withdrawn":
            if name in shown:
                changes.append(("withdraw", film))
            continue
        if film["status"] != "finished":
            continue
        if name not in shown:
            changes.append(("add", film))
            continue
        gif = os.path.join(BLOG, name + ".gif")
        if not os.path.exists(gif) or sha256(gif) != film["sha256"]:
            changes.append(("recut", film))
        if shown[name] != (film["alt"], film["caption"]):
            changes.append(("retext", film))
    unknown = sorted(set(shown) - listed)
    return changes, unknown


def apply(changes, films_dir, page):
    for kind, film in changes:
        name = film["name"]
        if kind in ("add", "recut"):
            shutil.copyfile(os.path.join(films_dir, film["path"]),
                            os.path.join(BLOG, name + ".gif"))
        if kind == "retext":
            def retext(m, film=film):
                block = m.group(0)
                if SRC.search(block).group(1) != film["name"]:
                    return block
                block = ALT.sub(lambda a: a.group(1) + attr(film["alt"]) + a.group(3),
                                block, count=1)
                return CAPTION.sub(lambda c: c.group(1) + html.escape(film["caption"], quote=False)
                                   + c.group(3), block, count=1)
            page = FIGURE.sub(retext, page)
        if kind == "withdraw":
            page = FIGURE.sub(lambda m: "" if SRC.search(m.group(0)).group(1) == name
                              else m.group(0), page)
            for ext in (".gif", ".png"):
                path = os.path.join(BLOG, name + ext)
                if os.path.exists(path):
                    os.remove(path)
        if kind == "add":
            mock = film["mocks"][0]
            projects = [m for m in PROJECT.finditer(page) if m.group(1) == mock]
            if not projects:
                sys.exit("%s: no project on the page for %s" % (name, mock))
            project = projects[0]
            block = project.group(0)
            figures = list(FIGURE.finditer(block))
            if figures:
                at = figures[-1].end()
                indent = figures[-1].group(1)
            else:
                at = block.index("</h3>") + len("</h3>")
                indent = "\t\t"
            # Only the first film on the page loads eagerly; it is above the fold.
            lazy = FIGURE.search(page).start() < project.start() + at
            new = figure(name, film["alt"], film["caption"], film.get("width", 800),
                         film.get("height", 450), indent, lazy)
            page = page[:project.start() + at] + new + page[project.start() + at:]
    return page


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--films", default=os.path.join(os.path.dirname(ROOT), "mock-films"),
                        help="a clone of rseufert/mock-films (default: beside this repo)")
    parser.add_argument("--apply", action="store_true", help="make the page match the index")
    args = parser.parse_args()

    films = load_index(args.films)
    with open(PAGE, encoding="utf-8") as f:
        page = f.read()
    changes, unknown = plan(films, page)

    for kind, film in changes:
        print("%-8s %s" % (kind, film["name"]))
    for name in unknown:
        print("%-8s %s: on the page, not in the index; left alone" % ("unknown", name))
    if not changes:
        print("the page matches the index (%d film(s))" % sum(f["status"] == "finished"
                                                              for f in films))
    if not args.apply:
        return 1 if changes else 0

    page = apply(changes, args.films, page)
    with open(PAGE, "w", encoding="utf-8") as f:
        f.write(page)
    return film_stills.main([])


if __name__ == "__main__":
    sys.exit(main())
