#!/usr/bin/env python3
"""Bring the site's films up to date with the indexes of the repos that draw them.

Each source below keeps an index of its finished films, docs/films/index.json,
in mock-films' layout, and that index is the source of truth: which films
exist, the sha256 of each GIF's current cut, and the alt text and caption its
team wrote for it. This compares the site's pages against a local clone of
each source and says what differs; with --apply it makes them match.

Every film's caption ends with a line naming the source that drew it ("drawn
by mock-films from a real run"), and that line is how a film on the page is
matched to its index: a film is held only to its own source's index, so one
source's films are never reported as missing from another's.

Each mock has a page of its own (mock-sap/index.html, ...) with all its films,
and the home page shows the first of them again. "The page" below is whichever
pages show the film: a re-text or a withdrawal is made on each.

    git clone https://github.com/rseufert/mock-films ../mock-films
    git clone https://github.com/rseufert/acme-treasury ../acme-treasury
    python3 tools/sync_films.py                   # report only
    python3 tools/sync_films.py --apply           # copy, rewrite, add, remove
    python3 tools/sync_films.py --source acme-treasury     # one source only
    python3 tools/sync_films.py --clone mock-films=DIR     # a clone somewhere else

A source with no clone is skipped and said so, and its films are left as they
are.

What --apply does, per film in the index:

    finished, not on the page   added to the page of its first mock, or of
                                the source's own project: first film above
                                the description, others after the features
                                list. The home page is left as it is; which
                                film leads there is a choice
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

Two sources may not use the same name: every film's GIF and still share blog/.
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

# The repos whose films the site shows. `project` is the name in the <h3> of
# the page a new film goes on; None places a film by its mocks, as mock-films'
# films are, since each is a film of a mock.
SOURCES = {
    "mock-films": {"project": None},
    "acme-treasury": {"project": "acme-treasury"},
}

FIGURE = re.compile(r'\n?([ \t]*)<figure class="film">.*?</figure>', re.S)
SRC = re.compile(r'<a class="play" href="/blog/([a-z0-9_]+)\.gif"')
PLAY = re.compile(r'<a class="play" [^>]*>')
POSTER = re.compile(r' data-poster-ms="(\d+)"')
ALT = re.compile(r'(<img[^>]*\balt=")([^"]*)(")')
# The line under every caption, after the source's own words, naming it.
CAPTION = re.compile(r"(<figcaption>)(.*?)( <span>drawn by ([a-z0-9-]+) from a real run</span>"
                     r"</figcaption>)", re.S)


def tag(source):
    return "<span>drawn by %s from a real run</span>" % source


# The home page's section on the mocks working together, for a film of several.
TOGETHER = re.compile(r'<div class="project" id="together">.*?</div><!-- /\.project -->', re.S)
PROJECT = re.compile(r'<div class="project">\s*<h3><a href="[^"]*">([^<]+)</a></h3>.*?'
                     r"</div><!-- /\.project -->", re.S)


def attr(text):
    """Text for a double-quoted attribute; apostrophes stay as they are."""
    return html.escape(text, quote=False).replace('"', "&quot;")


def play_tag(name, poster_ms):
    """The link that plays a film; data-poster-ms names the still's moment."""
    return '<a class="play" href="/blog/%s.gif"%s title="play the film">' % (
        name, ' data-poster-ms="%d"' % poster_ms if poster_ms is not None else "")


def figure(source, name, alt, caption, width, height, indent, lazy, poster_ms=None):
    i = indent
    img = '<img src="/blog/%s.png" width="%d" height="%d"%s alt="%s">' % (
        name, width, height, ' loading="lazy"' if lazy else "", attr(alt))
    return "".join([
        "\n%s<figure class=\"film\">\n" % i,
        "%s\t%s%s</a>\n" % (i, play_tag(name, poster_ms), img),
        "%s\t<figcaption>%s %s</figcaption>\n" % (i, html.escape(caption, quote=False), tag(source)),
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


def on_pages(pages, source):
    """name -> the (alt, caption, poster_ms) of each copy of the source's film,
    one per page that shows it."""
    found = {}
    for path, page in pages.items():
        for m in FIGURE.finditer(page):
            block = m.group(0)
            name = SRC.search(block).group(1)
            caption = CAPTION.search(block)
            if not caption:
                sys.exit("%s: %s has no line saying what drew it; stopping" % (path, name))
            if caption.group(4) != source:
                continue
            poster = POSTER.search(PLAY.search(block).group(0))
            found.setdefault(name, []).append(
                (html.unescape(ALT.search(block).group(2)),
                 html.unescape(caption.group(2)),
                 int(poster.group(1)) if poster else None))
    return found


def owners(pages):
    """The sources the page's films name, so a film can only be from one."""
    return {CAPTION.search(m.group(0)).group(4)
            for page in pages.values() for m in FIGURE.finditer(page)
            if CAPTION.search(m.group(0))}


def plan(films, pages, source):
    shown = on_pages(pages, source)
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


def apply(changes, films_dir, pages, source):
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
        project_name = SOURCES[source]["project"]
        if kind == "add" and project_name is None and len(film["mocks"]) > 1:
            # A film of several mocks belongs to none of their pages; it goes
            # in the home page's section on them together, after any already there.
            path = film_stills.pages()[0]
            page = pages[path]
            project = TOGETHER.search(page)
            if not project:
                sys.exit("%s: a film of %s, and %s has no section on the mocks together"
                         % (name, ", ".join(film["mocks"]), path))
            block = project.group(0)
            figures = list(FIGURE.finditer(block))
            at = figures[-1].end() if figures else block.index("</h3>") + len("</h3>")
            first = FIGURE.search(page)
            lazy = first is not None and first.start() < project.start() + at
            new = figure(source, name, film["alt"], film["caption"], film.get("width", 800),
                         film.get("height", 450), "\t\t", lazy, film.get("poster_ms"))
            pages[path] = page[:project.start() + at] + new + page[project.start() + at:]
        elif kind == "add":
            mock = project_name or film["mocks"][0]
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
            new = figure(source, name, film["alt"], film["caption"], film.get("width", 800),
                         film.get("height", 450), indent, lazy, film.get("poster_ms"))
            pages[path] = page[:project.start() + at] + new + page[project.start() + at:]
    return pages


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--clone", action="append", default=[], metavar="SOURCE=DIR",
                        help="where a source's clone is (default: beside this repo, by its name)")
    parser.add_argument("--films", metavar="DIR", help="the same as --clone mock-films=DIR")
    parser.add_argument("--source", choices=sorted(SOURCES), action="append",
                        help="only this source (default: every source)")
    parser.add_argument("--apply", action="store_true", help="make the page match the index")
    args = parser.parse_args()

    clones = {name: os.path.join(os.path.dirname(ROOT), name) for name in SOURCES}
    if args.films:
        clones["mock-films"] = args.films
    for pair in args.clone:
        name, _, path = pair.partition("=")
        if name not in SOURCES or not path:
            parser.error("--clone %s: expected SOURCE=DIR, SOURCE one of %s"
                         % (pair, ", ".join(sorted(SOURCES))))
        clones[name] = path

    pages = {}
    for path in film_stills.pages():
        with open(path, encoding="utf-8") as f:
            pages[path] = f.read()
    before = dict(pages)
    strangers = owners(pages) - set(SOURCES)
    if strangers:
        sys.exit("films on the page are drawn by %s, which is not a source here; stopping"
                 % ", ".join(sorted(strangers)))

    indexes = {}
    for source in args.source or sorted(SOURCES):
        if not os.path.isfile(os.path.join(clones[source], "docs", "films", "index.json")):
            print("%-8s %s: no clone at %s; its films are left as they are"
                  % ("skipped", source, clones[source]))
            continue
        indexes[source] = load_index(clones[source])
    if not indexes:
        print("no source's index was found, so nothing was checked")
        return 2
    # Every film's GIF and still are blog/NAME, whichever source drew it.
    for source, films in indexes.items():
        for film in films:
            for other, theirs in list(indexes.items()) + [
                    (o, [{"name": n} for n in on_pages(pages, o)]) for o in SOURCES]:
                if other != source and film["name"] in {f["name"] for f in theirs}:
                    sys.exit("%s is a film of both %s and %s; a name can only be one "
                             "film's, stopping" % (film["name"], source, other))

    differs = False
    for source, films in indexes.items():
        changes, unknown = plan(films, pages, source)
        for kind, film in changes:
            print("%-8s %s  (%s)" % (kind, film["name"], source))
        for name in unknown:
            print("%-8s %s  (%s): on the page, not in the index; left alone"
                  % ("unknown", name, source))
        if not changes:
            print("%s: the page matches the index (%d film(s))"
                  % (source, sum(f["status"] == "finished" for f in films)))
        differs = differs or bool(changes)
        if args.apply:
            pages = apply(changes, clones[source], pages, source)
    if not args.apply:
        return 1 if differs else 0

    for path, page in pages.items():
        if page != before[path]:
            with open(path, "w", encoding="utf-8") as f:
                f.write(page)
    return film_stills.main([])


if __name__ == "__main__":
    sys.exit(main())
