# Temple

A nave of gnostic signs and a library of public-domain esoteric texts. The
temple is a block of the [city](../city/) and this is the inside of it.

| file | what |
| --- | --- |
| `temple.js` | the nave: the signs drawn as line art, the turning ring, the choosing, the drone |
| `index.html` | the page: the signs with their explanations as a `<dl>`, and the library as five shelves of links |
| `temple.css` | the stylesheet; the layout links it after the site's bones |
| `temple.png`, `share.jpg` | the home tile and the share image, captured from the canvas |
| `texts/` | the library's Project Gutenberg texts, kept here whole (header, text, licence), one `.txt` a book, and `index.json`, the manifest |
| `read/index.html`, `read.js` | the reading room: a text set as pages, with the place remembered |
| `table/index.html`, `table.js`, `table.json` | the Great Table of the Watchtowers, rebuilt cell by cell from Dee's book of the angels' names, walkable, with each cell naming whose it is |
| `enochian/index.html`, `enochian.js` | the angelic alphabet: Dee's twenty-one letters redrawn from his hand, a keyboard for them, right to left |
| `talisman/index.html`, `talisman.js` | the talisman press: Agrippa's seven planetary squares with the sigils of their intelligences and spirits traced, and a name traced by his Latin numeration |
| `sigil/index.html`, `sigil.js` | the sigil press: a wish reduced and bound into one sign after Spare, charged by holding, burned when charged, nothing kept |
| `monas/index.html`, `monas.js` | Dee's Monas Hieroglyphica: the figure constructed from its measure, and the twenty-four theorems in plain words with their figures |
| `tarot/index.html`, `tarot.js` | the cards: the seventy-eight drawn as line art from Waite's descriptions, with Book T's letters, planets, signs and decans on them; Waite's one, three and the cross, with his meanings |
| `zodiac/index.html`, `zodiac.js` | the wheel: the zodiac as a chart with the planets placed by `js/zodiac.js`, the Moon's phase, the ascendant over Portland, and each decan numbered with its card |
| `lenormand/index.html`, `lenormand.js` | the Lenormand: the thirty-six cards of the Game of Hope as emblems with their insets; three, nine and the Grand Tableau, read by neighbours and houses |
| `changes/index.html`, `changes.js` | the changes: the I Ching cast by the stalks' odds or coins, drawn with its moving lines, read from the Chinese text with plain glosses of the Judgments |
| `animals/index.html`, `animals.js` | the animals: the Chinese zodiac as a wheel, the year and the hour by `js/east.js`, the four pillars of a moment or a birth |
| `ouroboros/poem.js`, `ouroboros/index.html`, `ouroboros.js` | the ouroboros: a poem that is a quine, four quatrains in a comment inside a function that returns its own text (`Function.prototype.toString`, exact since ES2019) wrapped in the call that runs it; the page shows `poem.js` (`include_relative`, so there is one copy), runs it, types out the answer and compares it, letter for letter |
| `neck/index.html`, `neck.js` | the neck: a fretboard with every note on it in any tuning, a scale and a chord lit over it with the chord's shapes found and strummed, your own tunings, scales and chords kept in the browser, and Case's tone scale putting a sign, a trump and a colour on each note, so the sky (`Zodiac.sky()`) is a chord and the hour (`Hours.now()`) a key; a capo, a chord named from the frets put down, a microphone tuner (Yin, nothing kept), and the whole setting in the address (`#key=E&scale=minor&chord=m7&on=A&tuning=D2-A2-D3-G3-B3-E4&capo=2`, `&note=E` to explain one note), which is how the cards, the wheel (`Zodiac.tone()`, `Zodiac.toneLink()`) and rickbot send a note there |

## The cards

`tarot/` draws the seventy-eight cards on a canvas, each from a few
strokes in a card space two units wide and 3.4 tall (`pen`, with a small
vocabulary: figure, crown, wings, flame, hills, cloud, wave, zig, star,
rays): the trumps as emblems after Waite's descriptions of Smith's
pictures (`TRUMP`, twenty-two functions), the pips laid out as the old
packs lay them (`PIPS`) with the suit's emblem (`wand`, `cup`, `sword`,
`pentacle`), the court as figures (`court`: a Page standing, a Knight
mounted, a Queen and a King enthroned). Nothing is traced from the deck.
The deck list comes from `Zodiac.deck()` and each card is decorated with
Book T's attribution: the trumps' letters and planets, signs or elements
(`TRUMP_OF`); each two to ten's decan (`Z.decan` of the sign with the
suit's element and the rank's quality, so the title and ruler come from
the one table); each Knight, Queen and King's thirty degrees (the last
decan of one sign and the first two of the next, Waite's Knight being the
order's Knight and his King its Prince). `about(card)` prints that and
whether the Sun, the Moon or a planet stands there at the moment
(`Zodiac.sky()`), and for a planet's trump whether it is the hour's
(`Hours.now()`). The spreads are Waite's: one card, three, and his Celtic
cross, whose significator is the card the Sun stands in and whose ten
places are described in his words (`SPREADS.cross[].say`). Shuffles use
`crypto.getRandomValues`; a third of the cards fall reversed when the
button is lit. `WAITE` is his divinatory meanings, upright and reversed,
extracted from the shelf's copy of the Pictorial Key by the session's
cleaning script. The gallery under the spread is seventy-eight small
canvases; `#card-<slug>` on the address shows one card large, which is how
the wheel's links arrive. Nothing is stored.

## The wheel

`zodiac/` draws the chart: the ascendant on the left, longitudes going
against the clock (`angle(lon) = π − (lon − asc)`), the sign band with
the glyphs coloured by element, degree ticks, the decan band with each
decan's card number, the horizon and meridian when the wheel stands as
the sky does (a button turns it to Aries first), the planets on an inner
ring nudged inward when within eight degrees of one another, the Moon in
the middle lit by its elongation, and a stamp of the moment. The reading
under it lists every body with its decan and card (linked into the deck),
the planet's own trump, rulership or exaltation, and the hour's trump; a
tap on a planet or a sign writes its line in the cell. A
`datetime-local` input sets another moment (the horizon stays
Portland's); "now" ticks every thirty seconds. The table of the signs is
generated, with this year's decan dates from `Zodiac.decanDates`.

`js/zodiac.js` is the shared table and the ephemeris, no dependencies:
`SIGNS` (element, quality, ruler, exaltation, Book T's trump and letter),
`PLANETS` (glyph, trump, letter), the decan rulers from Mars at the first
of Aries in the Chaldean order descending, Book T's titles of the small
cards, `decan(lon)` (sign, ruler, card, title, court), and `sky(date, lat,
lon)`: Paul Schlyter's low-precision method, mean elements and Kepler's
equation for the Sun, the Moon, Mercury to Neptune, with the Moon's,
Jupiter's, Saturn's and Uranus's main perturbations, the mean node,
retrograde by comparing with a day later, the Moon's phase from the
elongation, and the ascendant and midheaven from the sidereal time. It
was checked against the J2000 positions and the sky of October 2026 (the
full Moon in Taurus, Venus and Mercury retrograde) to the degree; it is a
wheel, not a navigator's almanac.

## The Lenormand

`lenormand/` draws the thirty-six cards (`CARDS`: name, the playing card
the old packs inset, a few words, a line; `EMBLEM`: one small drawing
each in a unit box) and lays them three in a line, nine in a square or all
thirty-six in the Grand Tableau, four rows of nine. The reading is the
pack's grammar rather than a fortune: for three, the middle card as the
noun and its neighbours as adjectives; for nine, the rows, columns and
corners about the middle; for the tableau, where the Man or the Woman fell
(a button chooses), the eight cards touching, the first and last cards and
the corners, the cards that fell in their own houses (the n-th card of the
pack in the n-th place), the distance of the cards that matter most, and
every card named by the house it landed in. A tap on a laid card prints
its line. The gallery is the pack in order; `#card-fox` shows one.

## The changes

`changes/` casts the I Ching. `KW` is the sixty-four hexagrams in King
Wen's order as six bits from the bottom (checked, in the session, against
the line labels of the Chinese text, which name every line nine or six);
`TEXT` is the Chinese from the Gutenberg Yijing (`texts/yijing.txt`),
parsed by a script in the session: name, Judgment, Image, six lines and the
seventh text of the first two; `NAMES` gives pinyin, Legge's spelling and
a plain gloss of the name, and `JUDGE` a plain gloss of each Judgment,
this site's own and kept close to the Chinese and to Legge. Casting is by
the stalks' odds (`yarrow`: 1, 5, 7, 3 in sixteen for 6, 7, 8, 9), by
three coins (`coins`), or six typed numbers. The canvas draws the hexagram
with its moving lines marked (a ring on an old nine, a cross on an old
six, in the other ink) and the hexagram it becomes beside it, with the
trigrams named; the reading gives the Judgment and the Image in Chinese,
the gloss, each moving line's Chinese with the old rule for which to
weigh (`principal`), the second hexagram's Judgment, and the nuclear,
opposite and inverse hexagrams, linked; `#hex-23` shows one unmoving.
Legge's 1882 translation is on the shelf as OCR (`SCANS["yiking"]`).

## The animals

`animals/` draws the twelve branches round a wheel, the rat at the top and
the hours round with the clock, each with its animal (`ANIMAL`: twelve
small drawings) and double-hour, the hand of the current double-hour, and
the year's name in the middle; a tap on a branch gives its element,
direction, trine, opposite and years. `js/east.js` does the calendar:
stems, branches and the cycle of sixty (`pillar(i)`); new moons and the
Sun's stations by bisection on the ephemeris; the lunar months by the
almanac's rule (the month holding the December solstice is the eleventh;
thirteen months between solstices means a leap month, the first without a
principal term), so `newYear(y)` agrees with the almanac for every year
checked from 1930 to 2034, the leap years 2015, 2033 and 2034 included;
`yearOf` (the popular year, from the New Year), `solarYearOf` (the
almanac's year pillar, from the start of spring at 315°), `monthOf` (by
the Sun's station, stem by the year's), `dayOf` (counted from 2000 Jan 1,
戊午, the rat's hour belonging to the next day) and `hourOf`; `pillars()`
gives all four and `lunar()` the month and day of the moon. The page
prints the pillars of now and of any birth entered, and the cycle of sixty
as years.

## The angelic alphabet

`enochian/` draws the twenty-one letters of 1583 as stroke skeletons
(`LETTERS`, in Dee's order with their names and Latin values, sketched from
the alphabet page of Sloane 3188 as the Esoteric Archives reproduce it, not
from any printed font). Type and the canvas writes the text in them, right
to left as Dee's tables are written (a button turns it round), k written
with Veh, y and j with Gon, v and w with Van, as Dee did; the table of the
letters is a row of small canvases that name themselves and type
themselves. "Save as an image" is the canvas as a PNG; nothing is stored.
The nineteen Keys are a hand-made text on the shelf, `texts/keys.txt`:
Casaubon's English of 1659 and the Equinox's spelled-out angelic of 1912,
taken from the Internet Archive's copy of Liber Chanokh with the ritual
matter and the modern notes cut, and registered through `HAND` in
`tools/shelf.py`. The Great Table is `table/`, below.

## The Great Table

`table/` draws the four Watchtowers of 1584/1587 round the black cross and
lets you walk them with the arrow keys or tap a cell; `table.json` holds
the grids, rebuilt by a script in the session from Dee's *Tabula bonorum
angelorum invocationes* (Sloane 3191, as the Esoteric Archives transcribe
it): the three Names of God along the middle row, read off the two
horizontal Seniors; the four vertical Seniors up and down the two centre
columns; in each of the four angles the six-letter Calvary name down the
third column, the five-letter name across the second row, the kerubic
letters on the first row either side of the upright, and the sixteen
servients on rows three to six. Every cell is filled exactly once with no
two names disagreeing, and the eight cells round each centre spell the
King, which is the check; the alternate spellings Dee gives with the
cross's letter inserted agree too, bar his own V/U and one West reading he
marked doubtful (OBGOTA/AABCO, TOCA), taken as first written. Quarters
are Dee's; the element beside each is the later orders' attribution (they
swapped his South and North). `whose(t, r, c)` names every name a cell
belongs to; "in Dee's letters" draws the cells with the alphabet's strokes
(`window.EnochianLetters`, exported by `enochian.js`).

## The talisman press

`talisman/` draws Agrippa's seven kameas (`KAMEA`, as he printed them in
*De occulta philosophia* II.22, checked for their sums by a test) and traces
on them, the old way, the names of each planet's intelligence (solid) and
spirit (dashed): the Hebrew letter values of each name (`NAMES`; the
intelligence sums to a row, the spirit to the whole square) are read as
cells and joined in order, a ring at the start and a bar at the end, a number
too big for the square read with its last figure dropped until it fits. A
name typed in is traced the same way in amber by Agrippa's Latin numeration
(`LATIN`, II.20). The Moon's intelligence of intelligences, five words long,
is not traced. The planet shown first is the planetary hour's (`js/hours.js`),
and "save as an image" is the canvas as a PNG. Nothing is stored or sent.
`window.Talisman` exposes the squares, the names and the drawing.

## The sigil press

`sigil/` is Spare's method by machine. `reduce` strikes the vowels and the
repeats (a wish of nothing but vowels keeps them); `compose` draws each
remaining letter from a stroke skeleton (`GLYPH`, 26 letters as polylines
in a box from -1 to 1), turns it to one of the eight directions, scales,
sometimes flips and offsets it by a PRNG seeded from a hash of the wish, so
a wish always gives the same sigil, and binds the set with a ring (four
letters or more) or a bar. Holding the canvas (pointer capture, or the
space bar) fills a charge in four seconds, drawn as a ring; at full charge
the strokes go white and scatter as ash, then the press clears the wish,
the letters and the canvas. Nothing touches localStorage or the network;
the only state is in the closure. Sound is a sine and a triangle a fifth
up, rising two octaves with the charge, and a burst of noise at the burn,
behind a button that is off by default. `window.Sigil` exposes `reduce`,
`compose`, `make` and the state.

## The Monas

`monas/` is the one book on the shelves that is drawn rather than kept.
Dee's Latin of 1564 is public domain; the English translations in print
(Hamilton-Jones 1947, Josten 1964, Burns and Turner 2021) are not, so the
page quotes none of them. It gives, in the site's own words, a short account
of each of the twenty-four theorems, with the marginal figures of the 1564
printing redrawn in the temple's line (`FIG` in `monas.js`, one function a
theorem), and on the big canvas the construction of Theorem XXIII drawn in
Dee's order from the one measure AB: the cross of one, three, two and two
measures, the Sun's circle of radius two on I, the Moon's half-circle on K,
the Ram's two half-circles on M and N, the ornaments last, then the letters.
The orientation (the crescent cupping the top of the Sun's circle with the
horns up; the Ram as two arches joined under the foot of the cross) is
checked against the Wellcome copy's scans on Wikimedia Commons. A tap draws
it again; `window.Monas` exposes the points and the drawing.

## The nave

Sixteen signs in a ring round a seventeenth, the Monad, on a canvas, turning
at 0.035 radians a second (not at all under `prefers-reduced-motion`).
Point at one, tap it, or walk round with the arrow keys, and it is drawn
large in the middle with its name under it, and its explanation appears in
the panel beneath the canvas with a link to the book on the shelf it comes
from. The names in the list under the canvas are buttons for the same thing,
and the sign chosen is in the address (`#abraxas`), so a sign can be linked.
On a phone, a tap on the canvas away from the ring goes to the next sign.

`DRAW` holds one function a sign, each drawing in a box of half-size `s`
about the origin with the primitives `circle`, `dot`, `line`, `arc` and
`glyph`; nothing is traced from a gem or a manuscript, each is drawn from
its description. The signs and their text are read from the page's own
`<dl id="temple-signs">` (the `dt` id after `sign-` is the drawing's key,
`data-shelf` the library entry), so the text is in one place and the page
says the same thing without scripts. The floor under the ring is Origen's
Ophite diagram, faint: the outer ring of the Leviathan, seven circles for
the archons, and the two in the middle.

The signs: the Monad, the ouroboros (with *hen to pan* inside it), Abraxas,
ΙΑΩ ringed by the seven vowels, Chnoubis with his seven rays and the SSS
sign, the Ophite diagram, the Pleroma (thirty dots in fifteen pairs, the
thirtieth leaning out), Horos (the cross-limit, with Sophia's passion fallen
outside), the vesica piscis, the Tetraktys, the hexagram, the Tree of the
ten sephiroth and twenty-two paths, the Mandaean drabsha, Dee's Hieroglyphic
Monad, the pearl in the serpent's coils, the Ogdoad (seven arcs and a
starred eighth), and the tria prima.

Sound is a drone behind a toggle kept in `localStorage` under
`temple-sound`: four oscillators on a root, a fifth, an octave and a twelfth
through a lowpass, each with its own slow tremolo, and a short sine ping in
a mode when a sign is chosen. The root follows the planetary hour
(`js/hours.js`): one note a planet up the scale in the Chaldean order,
Saturn on the root, the Moon a semitone under the octave, retuned over two
seconds when the hour turns; the bar names the hour and when it ends. On a
touch screen the root is an octave up and the filter open, for a phone's speaker; `js/unmute.js` does what an
iPhone needs. F is the whole screen, with the pinned-stage fallback where
there is no Fullscreen API.

## The menu

Every room of the temple carries the same line at the top, from
`_includes/temple-nav.html`: the nave, the library, the reading room, and
the presses (sigil, talisman, alphabet, the Great Table, the Monas), the
stars (the wheel, the cards, the Lenormand) and the east (the changes, the
animals), the current one marked with `aria-current`. Pages include it with
`{% include temple-nav.html active="sigil" %}`.

## Tracing

T (or the trace button) turns the nave from taps to a drawn line. Draw a
pentagram, one line, five points, back to the start, and the page reads it
with a $1-style matcher (`norm`: resample to 64 points, scale to a unit box,
centre; no rotation step, since here the rotation is the point) against the
ten ideal strokes (`pent(s, d)`: five starting points, two directions). Which
point it began at and which way it went is the whole difference in the old
pentagram ritual: toward an element's point invokes it, away banishes it;
top is spirit, then clockwise water, fire, earth, air. The quarter is the
stroke's centroid relative to the centre: right east, bottom south, left
west, top north. The banishing pentagram of the quarter's element (east air,
south fire, west water, north earth) keeps the quarter, drawn small at that
edge; the banishing pentagram of air is also the invoking pentagram of
water and the page says so. All four kept and the ring stands still and
the drone drops a fifth (`audio.drop`) for a minute. Nothing is stored.

## The library

Eight shelves, a hundred-odd books, as plain HTML: the gnostics; the
hermetica and the Platonists; the kabbalah, the grimoires and the
alchemists; the mystics; the east, Egypt and the theosophists; and then the
conspiracies, the hollow earth and the damned; the radicals and the
dystopias; and the machine, from Lovelace's notes to the Jargon File. Each is a link to a complete
copy elsewhere, Project Gutenberg where it has one, otherwise the Gnostic
Society Library, the Esoteric Archives, New Advent, the Internet Archive or
the Internet Sacred Text Archive, with the edition in the faint ink and one
line of shelf note, and a mark before the title for what the entry is
(`tools/shelf.py` writes it from the manifest: ● kept here whole, ◐ a
scan's OCR, ◆ made here, ○ a link out), with ☆ on the dozen "where to
start" picks listed above the shelves, which the manifest carries as
`pick` for the reading room and rickbot. Every text is in the public domain in the United States
(the translations are the Victorian and Edwardian ones: Mead, Mathers,
Legge, Budge, Taylor, Müller, the Ante-Nicene Fathers); the Nag Hammadi
codices are not on the shelf because their English translations are not,
and the page says so. Nothing is hosted here. Every link was checked when
the shelf was built.

The Gutenberg books are also kept here: `tools/shelf.py` reads the shelf,
fetches each Gutenberg link's plain-text file whole into `texts/<slug>.txt`
(a later volume as `<slug>-2.txt`), writes `texts/index.json` (title,
edition, Gutenberg number, shelf), and rewrites the shelf so the book's own
link opens the reading room at `/temple/read/#slug` with the Gutenberg page
kept beside it in the meta. For the books that are not on Gutenberg, `SCANS` in the tool names a
public-domain scan at the Internet Archive (the edition the shelf names,
one item a volume), and the tool fetches the item's OCR text, cleans it a
little (hyphens at line ends joined, double spaces closed, page numbers and
running heads dropped) and marks it in the manifest as OCR, uncorrected,
which the reading room says. `FREE` names the texts that are not public domain but
free to copy by their authors' word (the Jargon File, the GNU Manifesto,
Barlow, two RFCs, the Mentor, Nechayev's transcription), fetched as text
with the HTML stripped and marked so in the manifest and the reading room.
A file put at `texts/<slug>.txt` by hand (from
the book's own link, or from the address `HAND` gives for it, when the
text came from elsewhere) is kept as it is and recorded with its source.
Run it again and it fetches only what is missing; `--refetch` takes
everything again. Fifty-five texts, about 30 MB; Dee's Monad, which is
mostly figures, stays a link.

## The reading room

`read.js` takes the text between the Gutenberg START and END markers and
sets it as pages: a blank line is a paragraph, a wrapped paragraph is
joined, a paragraph of short, indented or numbered lines (verse, a
contents list, the Tablet's verses) keeps its lines, a rule of underscores
is dropped, and a heading is a short line in capitals on its own, a
chapter line with its argument, a line numbered with a roman numeral, or
a short line before a rule, which is how the Ethereal Library marks them. The
manifest gives the title, the edition and the source; the other volumes of
the same book are linked at the top. How far you were in each text is kept
in `localStorage` under `temple-read` and the room goes back there. J and K
are a screen down and up, T the top. R, or the button, has the browser's
own voice read aloud from the paragraph at the top of the screen, the
flattest English voice it has, each paragraph marked and kept in view as it
is read; R again stops it. Without scripts the files themselves are at
`/temple/texts/`.

## Poking

`window.Temple` exposes `state()`, `select(i)`, and `step(ms)` for
hand-stepped frames.
