# rseufert.github.io

The home page is an index: each mock in brief with one film, the worked
examples as a list, the Flipper apps as tiles. The rest is a page each:
`mock-sap/`, `mock-edi/` and `mock-bank/` carry a mock's features and all its
films, `examples/index.html` the worked examples in full, and
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
[mock-films](https://github.com/rseufert/mock-films): looping GIFs, each in a
`<figure class="film">`. The page shows each film's final frame, a PNG named
after the GIF, and plays the GIF on demand (`js/films.js`): on a click with a
mouse, and on a touch screen when the film is most of the way into view, one
at a time, unless the visitor asked for less motion or to save data. A film is
shown at exactly 800 px wherever the window has room, since its pixel type is
only sharp at 800; a project leads with one film and puts the rest after its
features list. The home page shows each mock's first film again.

mock-films' `docs/films/index.json` is the source of truth for which films
exist, each one's current cut, and its alt text and caption, which are used as
written. With a clone of mock-films beside this repo:

```bash
python3 tools/sync_films.py            # what differs from the index
python3 tools/sync_films.py --apply    # add, re-cut, re-text, withdraw; write the stills
```

A film's still is its last frame unless the index gives a `poster_ms`; the
page carries it as `data-poster-ms` on the film's link, and the still is the
frame showing at that moment. A new film goes on the page of its first mock,
and the home page is left as it is; a film of several mocks goes in the home
page's section on the mocks together (`id="together"`) instead. A re-text, a new still or a withdrawal is
made on every page that shows the film. A film on a page that
the index does not list is reported and left alone. mock-films is private, so
CI does not run the sync; it runs the still check:

```bash
python3 tools/film_stills.py           # write any still that is missing or stale
python3 tools/film_stills.py --check   # what CI runs
```
