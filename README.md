# rseufert.github.io

Each of the site's toys is a folder of its own, with a README that says how it
works, so a piece can be read and discussed on its own:

| folder | what | notes |
| --- | --- | --- |
| [`julia/`](julia/) | the Julia set strip under the menu, and the page to steer it | [README](julia/README.md) |
| [`chat/`](chat/) | rickbot, the chat in the corner that becomes a dungeon | [README](chat/README.md) |
| [`arena/`](arena/) | an homage to AT-Robots: tanks in a small assembly dialect | [README](arena/README.md) |
| [`backrooms/`](backrooms/) | a wireframe under the site, levels grown from a seed, ghosts of whoever it found | [README](backrooms/README.md) |
| [`intro/`](intro/) | a cracktro: plasma, stars, copper bars, a 3D logo, a scroller, a chiptune from the date | [README](intro/README.md) |
| [`city/`](city/) | the site as a wireframe city laid out from the date; every part of it a door | [README](city/README.md) |
| [`temple/`](temple/) | a nave of sixteen gnostic signs round the Monad, explained, and a library of public-domain esoteric texts | [README](temple/README.md) |
| [`dashboard/`](dashboard/) | public data feeds, drawn with D3 | [README](dashboard/README.md) |

`css/main.css` is the site's bones; a toy's stylesheet sits in its folder and
the page names it in its front matter (`css:`), which the layout links after
the bones. `js/` holds only what the site shares: the films, the hero photo's
dream, the home page's one dashboard tile. The code is MIT; the posts and
pictures are not (see the licence note at the end).

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

`dashboard/index.html` draws public data feeds with D3 (`dashboard/dashboard.js`):
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
visitor's graphics card (`julia/julia-set.js`, WebGL) and zooming for ever into
one of its fixed points while the parameter walks back and forth along an
arc round the Mandelbrot set. The arc is charted in Julia: `tools/julia_set.jl`
traces an equipotential just outside the set from its cusp to just short of
its needle, follows a fixed point along it, scores how much of each view is
near the set, and writes `julia/julia-set.json`, which is all the page needs. Each visit starts somewhere along the walk at random, in
one of a few palettes, and keeps both for the visit, so the strip is at the
same place on every page but different next time; it holds still for a
visitor who asked for less motion, and is a link to `julia/`, the same set
writ large and steerable (`julia/julia.js`): a drag moves c, scrolling
zooms, letting go puts c and the view in the address, a click pins the set,
and left alone it wanders the same walk. Change a constant at the top of the script and rerun it:

```bash
julia tools/julia_set.jl            # writes julia/julia-set.json; no packages
```

The [chat] tab in the corner of every page is rickbot (`chat/chat.js`), a
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
dialect, pick opponents from ten presets, and watch them fight.
`arena/arena-engine.js` is the assembler and the simulation, with no page in
it, so it runs in the browser (`arena/arena.js` draws it), in node and in
rickbot's dungeon, where FIGHT in the arena room borrows a preset;
`arena/arena-robots.js` holds the presets, Rick's Rogues (the tanks written to beat them) and the starter. The dialect, the
ports and the rules are at the foot of the page and the top of the engine.
A visitor's tank is kept in named slots in the browser, as a file, or in a
share link, and can be sent in: the gauntlet (`arena/arena-gauntlet.js`)
duels it against every preset, and if it wins 27 of 40 it goes in as an
issue titled `tank: NAME`, which `tanks.yml` refights with `tools/tanks.py`
and lists in `tanks.json` on the `sky-data` branch for the page to show.

```bash
node arena/arena_test.js      # every preset assembles and every pairing ends; who beats whom
```

`js/unmute.js` is what an iPhone needs before Web Audio is heard (a
moment of silence through an audio element, so the ringer switch does not
mute the page, and a resume on return); the backrooms, the city, the intro
and the arena load it.

`backrooms/` is a wireframe under the site: levels grown from a seed, a hum
at 60 Hz, and something that only moves while you are not looking. Whoever
it finds leaves a ghost, their last thirty seconds, which walks the same
seed and level again for them and for whoever comes next. A ghost lives in
the browser until it is left, which opens an issue titled `ghost: level L of
seed S`; `ghosts.yml` compiles the open ones with `tools/ghosts.py` into
`ghosts.json` on the `sky-data` branch, with `data/ghosts.json` on `master`
as the fallback. Close an issue to lay one to rest.

`intro/` is a cracktro, the screen that played before a cracked game loaded:
a plasma, a starfield, copper bars, the logo extruded and turning, a sine
scroller greeting every part of the site, and a four-channel chiptune on
WebAudio composed from a seed that is the date, so there is a new tune at
midnight. One script on a 480-pixel canvas scaled up without smoothing.

`city/` is the overworld: the site as a wireframe city, drawn the way the
backrooms are drawn but out of doors, with every part of the site a
building to enter. The arena is a stadium whose scoreboard runs a live
match in the arena's own engine, the Julia set is the river, the dashboard
a weather station on a hill, the blog a row of mailboxes (one a post, from
`site.posts`), the backrooms a manhole, the mocks the towers, and rickbot
the helpdesk. Street signs are in the elves' script until you stand still.
The layout is shuffled from the date. The sky is the real one over Portland
at the real time (`city/sky.js`: ~170 stars in 25 constellations, the Sun
and the Moon, placed from the sidereal time), with a time-lapse to watch
the Dipper go round Polaris, and ten people with optional errands that
send you to the rest of the site and check, when you come back, that you
went (`chat/chat.js` keeps footprints of the pages visited, in the browser
only).

`temple/` is a block of the city and a page of its own: sixteen gnostic signs
(Abraxas, the ouroboros, ΙΑΩ, Chnoubis, the Ophite diagram, the Pleroma, Horos,
the vesica, the Tetraktys, the hexagram, the Tree, the Mandaean drabsha, Dee's
Monad, the pearl and the serpent, the Ogdoad, the tria prima) drawn as line art
in a turning ring round the Monad, each explained from its sources when chosen,
and behind them a library: fifty-odd gnostic, hermetic, kabbalistic, magical
and mystical texts in their public-domain translations. Fifty of them
are kept in `temple/texts/`, the Project Gutenberg files whole and, for the
rest, the OCR text of a public-domain scan at the Internet Archive
(`tools/shelf.py` fetches both and points the shelf at them), and read in
`temple/read/`, which sets a text as pages and remembers your place; five
link out. The shelf notes
are the site's.

## Licence

The [MIT licence](LICENSE) applies to the code in this repository: the scripts,
stylesheets, page templates, tools and workflows, including the toys (the
Julia strip and page, rickbot, the arena, the backrooms, the intro, the city, the temple, the dashboard).

It does not apply to the content. The blog posts, the resume, the photographs
and other images, the films and the music references are copyright Rick
Seufert, all rights reserved, unless a file says otherwise. Third-party
material belongs to its owners: D3 and topojson-client carry their own
licences (dashboard/), the Natural Earth coastlines are public domain, and
the photograph of Josh Allen on the home page is not mine to license.
