# Dashboard

Public data, live, drawn with D3: Portland's weather, air, rivers, bikes and
earthquakes; the Cascade volcanoes and Mount Hood's snow; what is passing
overhead; the Treasury's books.

| file | what |
| --- | --- |
| `dashboard.js` | every panel: the fetches, the parsing, the charts |
| `index.html`, `dashboard.css` | the page and its stylesheet (`.dash`); the river tiles' CSS (`.rivers`) is in `css/main.css` because the home page shares it |
| `d3.v7.min.js`, `topojson-client.min.js` | vendored, so the page loads no code from anywhere else; their own licences apply |
| `js/home-dashboard.js` | the home page's one tile, in plain SVG, so the home page loads no D3 |
| `data/land-110m.json`, `data/sky.json` | the Natural Earth coastlines; the sky data's fallback copy |
| `tools/sky_data.py`, `.github/workflows/sky-data.yml` | the nightly sky data, committed to the `sky-data` branch |

Each figure is fetched by the visitor's browser from its source's own API
when the page loads, and fails on its own: a source that is down says so in
its box and leaves the rest alone. Names and places from the feeds go in as
text, never as HTML. NASA JPL's API does not answer a browser on another
site, so `sky-data.yml` saves its close approaches and fireballs every night;
`master` is protected, so it commits to the `sky-data` branch and the page
reads `sky.json` from there, falling back to `data/sky.json`.

Charts use the site's own ink: a single series wears the accent, context
the faint grey, and the four central banks four categorical colours, stepped
for light and dark and checked for colour-blind separation. Text never wears
a series colour; a key beside it carries the identity.

```bash
python3 tools/sky_data.py           # write data/sky.json
python3 tools/sky_data.py --check   # fetch and validate, write nothing
```
