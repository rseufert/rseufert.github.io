# rseufert.github.io

The home page is an index: one film, the purchase that crosses all three
mocks, then each project as a tile, the dashboard as one of its numbers, the
Willamette right now (`js/home-dashboard.js`, plain SVG, so the home page
loads no D3 and asks one other host), and the Flipper apps as tiles.
The rest is a page each: `mock-sap/`, `mock-edi/`, `mock-bank/` and
`mock-einvoice/` carry a mock's
features and all its films, `examples/index.html` the worked examples in full, and
`flipper/index.html` the apps in full.

The [SAP-to-EDI post](https://rickseufert.com/blog/2026/09/24/testing-an-sap-to-edi-integration)
links to the two worked examples under `examples/`, so this repo carries a copy
of each. The authoritative copy lives in the repo of the mock the example is
*not* testing — `po_bridge` in [mock-edi](https://github.com/rseufert/mock-edi),
`invoice_check` in [mock-sap](https://github.com/rseufert/mock-sap) — because
that is where CI runs it against the other mock. To check the copies here
against those, or to refresh them:

```bash
python3 tools/check_examples.py
python3 tools/check_examples.py --update
```

Those pages show films recorded by
[mock-films](https://github.com/rseufert/mock-films), and the acme-treasury
page films drawn by [acme-treasury](https://github.com/rseufert/acme-treasury)
itself: looping GIFs, each in a
`<figure class="film">`. The page shows each film's final frame, a PNG named
after the GIF, and plays the GIF on demand (`js/films.js`): on a click with a
mouse, and on a touch screen when the film is most of the way into view, one
at a time, unless the visitor asked for less motion or to save data. A film is
shown at exactly 800 px wherever the window has room, since its pixel type is
only sharp at 800; a project leads with one film and puts the rest after its
features list. A blog post may show the film it is about, and the home page
shows the film of the mocks together; the tools keep every copy in step.

Each source keeps `docs/films/index.json` in mock-films' layout, and that
index is the source of truth for which of its films exist, each one's current
cut, and its alt text and caption, which are used as written. A film's caption
ends with the line naming its source ("drawn by mock-films from a real run"),
and that is how a film on the page is matched to its index: each source is
held only to its own. The sources are listed in `SOURCES` in
`tools/sync_films.py`. With clones beside this repo:

```bash
python3 tools/sync_films.py            # what differs from each index
python3 tools/sync_films.py --apply    # add, re-cut, re-text, withdraw; write the stills
python3 tools/sync_films.py --source acme-treasury --clone acme-treasury=DIR
```

A source with no clone is skipped, and its films are left as they are. Two
sources may not use the same film name, since every GIF and still is in
`blog/`.

A film's still is its last frame unless the index gives a `poster_ms`; the
page carries it as `data-poster-ms` on the film's link, and the still is the
frame showing at that moment. A new mock-films film goes on the page of its
first mock, and the home page is left as it is; a film of several mocks goes
in the home page's section on the mocks together (`id="together"`) instead. A
new acme-treasury film goes on the acme-treasury page, whichever mocks it
shows. A re-text, a new still or a withdrawal is made on every page that shows
the film. A film on a page that its index does not list is reported and left
alone. mock-films is private, so CI does not run the sync for its films.
acme-treasury is public, so every Monday `acme-treasury-films.yml` runs the
report for it: while the site is behind, it keeps one issue open with each
week's report, and closes it once the site matches. Either way the sync itself
is run by hand. On every push and pull request, CI runs the still check:

```bash
python3 tools/film_stills.py           # write any still that is missing or stale
python3 tools/film_stills.py --check   # what CI runs
```

`dashboard/index.html` draws public data feeds with D3 (`js/dashboard.js`):
Portland's weather, air, rivers, bikes and earthquakes; the Cascade
volcanoes' alert levels and earthquakes, and Mount Hood's freezing level,
snow and avalanche danger; asteroids, fireballs, space weather and NASA's
natural events; and the Treasury's debt, cash and borrowing costs. Each figure is fetched by the visitor's browser from
its source's own API when the page loads, and fails on its own if that source
is down. D3, the TopoJSON reader and the Natural Earth coastlines
(`data/land-110m.json`) are kept in the repo, so the page loads no code from
anywhere else. NASA JPL's API does not answer a browser on another site, so
its close approaches and fireballs are saved by `sky-data.yml` every night.
`master` is protected, so the workflow commits them to the `sky-data` branch
instead, and the page reads `sky.json` from there through
raw.githubusercontent.com. `data/sky.json` on `master` is the copy it falls
back to; refresh it by hand when you like:

```bash
python3 tools/sky_data.py           # write data/sky.json
python3 tools/sky_data.py --check   # fetch and validate, write nothing
```

The strip under the menu on every page is a Julia set, drawn by the
visitor's graphics card (`js/julia-set.js`, WebGL) and zooming for ever into
one of its fixed points while the parameter walks back and forth along an
arc round the Mandelbrot set. The arc is charted in Julia: `tools/julia_set.jl`
traces an equipotential just outside the set from its cusp to just short of
its needle, follows a fixed point along it, scores how much of each view is
near the set, and writes `js/julia-set.json`, which is all the page needs. Each visit starts somewhere along the walk at random, in
one of a few palettes, and keeps both for the visit, so the strip is at the
same place on every page but different next time; it holds still for a
visitor who asked for less motion, and is a link to `julia/`, the same set
writ large and steerable (`js/julia.js`): a drag moves c, scrolling
zooms, letting go puts c and the view in the address, a click pins the set,
and left alone it wanders the same walk. Change a constant at the top of the script and rerun it:

```bash
julia tools/julia_set.jl            # writes js/julia-set.json; no packages
```

The [chat] tab in the corner of every page is rickbot (`js/chat.js`), a
virtual assistant that answers a question or two about the site and then
confesses: reality has been hacked by extradimensional machine elves, who
came through the strip, and the window becomes a text adventure in the old
style through a dungeon made of the site. Escaping reboots reality, puts
the elves' palette on the strip, dreams the home page's photo through a
Julia set (`js/hero.js`), and ends on a high score table and the guest
book. The table is local; the guest book is shared, web 0.9 style: SIGN
opens a prefilled issue on this repo titled `guestbook: NAME`, and
`guestbook.yml` compiles the open ones into `guestbook.json` on the
`sky-data` branch (`tools/guestbook.py`), where the chat reads it;
`data/guestbook.json` on `master` is the fallback. Close an issue to take
an entry out. The rest runs in the page; the conversation is kept in
localStorage, and RESET starts over.

`arena/` is an homage to AT-Robots: write a tank in a small assembly
dialect, pick opponents from six presets, and watch them fight.
`js/arena-engine.js` is the assembler and the simulation, with no page in
it, so it runs in the browser (`js/arena.js` draws it), in node and in
rickbot's dungeon, where FIGHT in the arena room borrows a preset;
`js/arena-robots.js` holds the presets and the starter. The dialect, the
ports and the rules are at the foot of the page and the top of the engine.

```bash
node tools/arena_test.js      # every preset assembles and every pairing ends; who beats whom
```
