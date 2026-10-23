# The Daily Seed

The site's newspaper, set each midnight from the date: the same seed the
[city](../city/) is laid out from and the [intro](../intro/)'s tune is
written from, so the paper is the same all day and another tomorrow;
`#seed=YYYYMMDD` in the address asks for another day's.

| file | what |
| --- | --- |
| `paper.js` | the whole paper: the seed, the stories, the match, the weather, the sky and the planets, the horoscope, the letters, the classifieds, the obituaries, the quotation, the puzzle |
| `index.html`, `paper.css` | the page (a broadsheet: masthead, rules, columns) and its stylesheet; the page also loads the arena's engine and presets and the city's sky |
| `paper.png`, `share.jpg` | the home tile and the share image |

## What is in it

**The masthead** settles from runes to letters, one at a time, in an order
the seed decides (not under `prefers-reduced-motion`). The dateline counts
volumes from 2016 and numbers from the site's first post.

**The lead and the briefs** are drawn by the seed from pools written in the
city's voice, with the day, a street and the issue number filled in. The
census is the reader's own standing: population 2 once the twelve errands
are done in this browser.

**Sport** plays a real match: six of the arena's ten presets, shuffled by the
seed, in `Arena.Match` with the seed as the engine's seed, ticked to the end
in slices of 30 ms so the page stays live, then reported: the winner, the
seconds, the order of the fallen from the engine's log, one line of colour.
The same six, the same seed, the same result for everyone that day.

**Weather** is the USGS gauge on the Willamette at Portland (14211720), the
stage and the flow and the time, live, as the dashboard reads it. **The sky**
is `CitySky`: sunrise and sunset by scanning the Sun's altitude through the
day, the Moon's phase, and the Big Dipper read as a clock hand round
Polaris, from Dubhe's hour angle, going backwards and losing four minutes a
day, which is sidereal time.

**The horoscope** is cast from where the planets are: Mercury, Venus, Mars,
Jupiter and Saturn from their Keplerian elements at J2000 and the rates a
century (Standish), Kepler's equation solved by Newton, heliocentric
positions turned geocentric, to about a degree, which is enough for a sign;
the Sun and Moon from the sky's own formulae. Each sign gets the planets in
it, or a line about being empty and which planet is nearest, and a piece of
the paper's advice. The reader's sign is a row of buttons and is remembered
(`paper-sign`).

**Letters** are two of nine from the city's people; **classifieds** are two
house advertisements and four of the people's notices, and one real product
from the shop if its public list answers. **Obituaries** are the backrooms'
ghosts (`ghosts.json` on the `sky-data` branch, the copy on master as the
fallback), the three newest, and a count of the reader's own unsent ones.
**The quotation** is a real paragraph, chosen by the seed, from one of the
library's non-OCR texts, correctly attributed. **The puzzle** is a
monoalphabetic substitution of a sentence from the site, the key shuffled
by the seed with no letter mapping to itself, word breaks kept, and
yesterday's answer under it.

## Poking

`window.Paper` exposes `seed`, `planets(date)` (ecliptic longitudes in
degrees) and `puzzle(seed)`.
