# rseufert.github.io

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

The projects page shows films recorded by mock-films: looping GIFs, each in a
`<figure class="film">`. A visitor whose system asks for less motion gets the
film's final frame instead, a PNG named after the GIF. To add a film, put the
GIF in `blog/`, copy the markup of an existing one, and write its still:

```bash
python3 tools/film_stills.py           # write any still that is missing or stale
python3 tools/film_stills.py --check   # what CI runs
```
