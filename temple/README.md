# Temple

A nave of gnostic signs and a library of public-domain esoteric texts. The
temple is a block of the [city](../city/) and this is the inside of it.

| file | what |
| --- | --- |
| `temple.js` | the nave: the signs drawn as line art, the turning ring, the choosing, the drone |
| `index.html` | the page: the signs with their explanations as a `<dl>`, and the library as five shelves of links |
| `temple.css` | the stylesheet; the layout links it after the site's bones |
| `temple.png`, `share.jpg` | the home tile and the share image, captured from the canvas |

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

Five shelves, fifty-five books, as plain HTML: the gnostics; the hermetica
and the Platonists; the kabbalah, the grimoires and the alchemists; the
mystics; the east, Egypt and the theosophists. Each is a link to a complete
copy elsewhere, Project Gutenberg where it has one, otherwise the Gnostic
Society Library, the Esoteric Archives, New Advent, the Internet Archive or
the Internet Sacred Text Archive, with the edition in the faint ink and one
line of shelf note. Every text is in the public domain in the United States
(the translations are the Victorian and Edwardian ones: Mead, Mathers,
Legge, Budge, Taylor, Müller, the Ante-Nicene Fathers); the Nag Hammadi
codices are not on the shelf because their English translations are not,
and the page says so. Nothing is hosted here. Every link was checked when
the shelf was built.

## Poking

`window.Temple` exposes `state()`, `select(i)`, and `step(ms)` for
hand-stepped frames.
