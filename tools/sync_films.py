#!/usr/bin/env python3
"""Bring the site's films up to date with mock-films' index.

mock-films keeps an index of its finished films, docs/films/index.json, and
that index is the source of truth: which films exist, the sha256 of each
GIF's current cut, and the alt text and caption the mock-films team wrote for
it. This compares the site's pages against a local clone of mock-films and
says what differs; with --apply it makes them match.

Each mock has a page of its own (mock-sap/index.html, ...) with all its films,
and the home page shows the first of them again. "The page" below is whichever
pages show the film: a re-text or a withdrawal is made on each.

    git clone https://github.com/rseufert/mock-films ../mock-films
    python3 tools/sync_films.py                   # report only
    python3 tools/sync_films.py --apply           # copy, rewrite, add, remove
    python3 tools/sync_films.py --films DIR       # a clone somewhere else

What --apply does, per film in the index:

    finished, not on the page   added to the page of its first mock: first
                                film above the description, others after
                                the features list. The home page is left
                                as it is; which film leads there is a choice
    finished, a different hash  the new cut copied into blog/
    finished, different text    the alt text and caption replaced, as written
    finished, other poster_ms   the still retaken at that moment (none: the end)
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
BLOG = os.path.join(ROOT, "blog")
NAME = re.compile(r"[a-z0-9_]+\Z")

FIGURE = re.compile(r'\n?([ \t]*)<figure class="film">.*?</figure>', re.S)
SRC = re.compile(r'<a class="play" href="/blog/([a-z0-9_]+)\.gif"')
PLAY = re.compile(r'<a class="play" [^>]*>')
POSTER = re.compile(r' data-poster-ms="(\d+)"')
ALT = re.compile(r'(<img[^>]*\balt=")([^"]*)(")')
# The line under every caption, after the mock-films team's own words.
TAG = "<span>drawn by mock-films from a real run</span>"
CAPTION = re.compile(r"(<figcaption>)(.*?)( %s</figcaption>)" % re.escape(TAG), re.S)
PROJECT = re.compile(r'<div class="project">\s*<h3><a href="[^"]*">([^<]+)</a></h3>.*?'
                     r"</div><!-- /\.project -->", re.S)


def attr(text):
    """Text for a double-quoted attribute; apostrophes stay as they are."""
    return html.escape(text, quote=False).replace('"', "&quot;")


def play_tag(name, poster_ms):
    """The link that plays a film; data-poster-ms names the still's moment."""
    return '<a class="play" href="/blog/%s.gif"%s title="play the film">' % (
        name, ' data-poster-ms="%d"' % poster_ms if poster_ms is not None else "")


def figure(name, alt, caption, width, height, indent, lazy, poster_ms=None):
    i = indent
    img = '<img src="/blog/%s.png" width="%d" height="%d"%s alt="%s">' % (
        name, width, height, ' loading="lazy"' if lazy else "", attr(alt))
    return "".join([
        "\n%s<figure class=\"film\">\n" % i,
        "%s\t%s%s</a>\n" % (i, play_tag(name, poster_ms), img),
        "%s\t<figcaption>%s %s</figcaption>\n" % (i, html.escape(caption, quote=False), TAG),
        "%s</figure>" % i,
    ])


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
        poster_ms = film.get("poster_ms")
        if poster_ms is not None and (not isinstance(poster_ms, int) or poster_ms < 0):
            sys.exit("index.json: %s has poster_ms %r, not a time in ms; stopping"
                     % (name, poster_ms))
        if film["status"] == "finished":
            gif = os.path.join(films_dir, film["path"])
            if sha256(gif) != film["sha256"]:
                sys.exit("index.json: %s says sha256 %s, but %s is %s; is the clone "
                         "behind?" % (name, film["sha256"][:12], film["path"],
                                      sha256(gif)[:12]))
    return films


def on_pages(pages):
    """name -> the (alt, caption, poster_ms) of each copy of the film, one per
    page that shows it."""
    found = {}
    for page in pages.values():
        for m in FIGURE.finditer(page):
            block = m.group(0)
            name = SRC.search(block).group(1)
            poster = POSTER.search(PLAY.search(block).group(0))
            found.setdefault(name, []).append(
                (html.unescape(ALT.search(block).group(2)),
                 html.unescape(CAPTION.search(block).group(2)),
                 int(poster.group(1)) if poster else None))
    return found


def plan(films, pages):
    shown = on_pages(pages)
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
        if any(copy[:2] != (film["alt"], film["caption"]) for copy in shown[name]):
            changes.append(("retext", film))
        # The still's moment can change with nothing else: same GIF, same hash.
        if any(copy[2] != film.get("poster_ms") for copy in shown[name]):
            changes.append(("repost", film))
    unknown = sorted(set(shown) - listed)
    return changes, unknown


def apply(changes, films_dir, pages):
    def everywhere(change):
        for path in pages:
            pages[path] = FIGURE.sub(change, pages[path])

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
            everywhere(retext)
        if kind == "repost":
            everywhere(lambda m, film=film: m.group(0) if SRC.search(m.group(0)).group(1)
                       != film["name"] else PLAY.sub(
                           lambda a: play_tag(film["name"], film.get("poster_ms")),
                           m.group(0), count=1))
        if kind == "withdraw":
            everywhere(lambda m: "" if SRC.search(m.group(0)).group(1) == name
                       else m.group(0))
            for ext in (".gif", ".png"):
                path = os.path.join(BLOG, name + ext)
                if os.path.exists(path):
                    os.remove(path)
        if kind == "add":
            mock = film["mocks"][0]
            # The mock's own page is the one with its features list; the home
            # page has the mock in brief, with one film and no list.
            projects = [(path, m) for path, page in pages.items()
                        for m in PROJECT.finditer(page)
                        if m.group(1) == mock and '<ul class="features">' in m.group(0)]
            if not projects:
                sys.exit("%s: no page with a features list for %s" % (name, mock))
            path, project = projects[0]
            page = pages[path]
            block = project.group(0)
            # A project leads with one film, before what it is; any others
            # follow its features list, so the description is not pushed down.
            features = block.index("</ul>", block.index('<ul class="features">')) + len("</ul>")
            figures = list(FIGURE.finditer(block))
            later = [f for f in figures if f.start() >= features]
            indent = figures[0].group(1) if figures else "\t\t"
            if later:
                at = later[-1].end()
            elif figures:
                at = features
            else:
                at = block.index("</h3>") + len("</h3>")
            # Only the first film on the page loads eagerly; it is above the fold.
            # A mock's own page may have no film yet, and then this is the first.
            first = FIGURE.search(page)
            lazy = first is not None and first.start() < project.start() + at
            new = figure(name, film["alt"], film["caption"], film.get("width", 800),
                         film.get("height", 450), indent, lazy, film.get("poster_ms"))
            pages[path] = page[:project.start() + at] + new + page[project.start() + at:]
    return pages


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--films", default=os.path.join(os.path.dirname(ROOT), "mock-films"),
                        help="a clone of rseufert/mock-films (default: beside this repo)")
    parser.add_argument("--apply", action="store_true", help="make the page match the index")
    args = parser.parse_args()

    films = load_index(args.films)
    pages = {}
    for path in film_stills.pages():
        with open(path, encoding="utf-8") as f:
            pages[path] = f.read()
    before = dict(pages)
    changes, unknown = plan(films, pages)

    for kind, film in changes:
        print("%-8s %s" % (kind, film["name"]))
    for name in unknown:
        print("%-8s %s: on the page, not in the index; left alone" % ("unknown", name))
    if not changes:
        print("the page matches the index (%d film(s))" % sum(f["status"] == "finished"
                                                              for f in films))
    if not args.apply:
        return 1 if changes else 0

    pages = apply(changes, args.films, pages)
    for path, page in pages.items():
        if page != before[path]:
            with open(path, "w", encoding="utf-8") as f:
                f.write(page)
    return film_stills.main([])


if __name__ == "__main__":
    sys.exit(main())
