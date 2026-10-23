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
a mode when a sign is chosen. On a touch screen the root is an octave up
and the filter open, for a phone's speaker; `js/unmute.js` does what an
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
line of shelf note. Every text is in the public domain in the United States
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
are a screen down and up, T the top. Without scripts the files themselves
are at `/temple/texts/`.

## Poking

`window.Temple` exposes `state()`, `select(i)`, and `step(ms)` for
hand-stepped frames.
