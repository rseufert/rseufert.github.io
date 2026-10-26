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
| `enochian/index.html`, `enochian.js` | the angelic alphabet: Dee's twenty-one letters redrawn from his hand, a keyboard for them, right to left |
| `talisman/index.html`, `talisman.js` | the talisman press: Agrippa's seven planetary squares with the sigils of their intelligences and spirits traced, and a name traced by his Latin numeration |
| `sigil/index.html`, `sigil.js` | the sigil press: a wish reduced and bound into one sign after Spare, charged by holding, burned when charged, nothing kept |
| `monas/index.html`, `monas.js` | Dee's Monas Hieroglyphica: the figure constructed from its measure, and the twenty-four theorems in plain words with their figures |

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
`tools/shelf.py`. The Great Table is not here yet; Dee's book of the
angels' names (Tabula bonorum angelorum, at the Esoteric Archives) gives
every letter of it by name, and rebuilding the grid from them is the next
piece.

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
