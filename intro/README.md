# Intro

A cracktro for the site: the screen a group put in front of a cracked game
in 1989, with the elves' name on it. A plasma, a starfield, copper bars, the
logo extruded and turning, a scroller on a sine wave greeting everyone, and
a chiptune written from the date.

| file | what |
| --- | --- |
| `intro.js` | the whole thing: the stroke font, the effects, the tracker and the composer |
| `index.html`, `intro.css` | the page and its stylesheet |
| `intro.png`, `share.jpg` | the home tile and the share image, captured from the canvas |

## Drawing

A 480 by 270 canvas, scaled to the page with `image-rendering: pixelated`,
so the pixels are the size they used to be, and scanlines in CSS over it.
Each frame, back to front: the plasma (four sines summed over a 120 by 68
grid into an `ImageData`, through a 256-entry cosine palette the seed
chose, drawn dim and smoothed up to size), the stars (160 points flying at
you), the copper bars (five bands of thirteen graded scanlines sliding on
sines), the logo, a line of small text, the scroller, and the tracker
readout.

The font is strokes on a 4 by 6 grid, `FONT`, one string a glyph, for
A to Z, the digits and some punctuation. The scroller draws it at four
pixels a unit along a sine, 110 pixels a second (40 with reduced motion,
and a shallower wave). The logo is the same glyphs for RICK at eleven
pixels a unit, each stroke point doubled front and back fourteen apart,
with edges between; it swings about all three axes rather than spinning,
so it mostly faces you, and is projected with a focal length of 260 at a
distance of 300. Both are stroked twice, wide and faint for the glow and
thin for the line, in a hue that cycles.

## The tune

`compose(seed)` draws, from a seeded random: a key, a scale (minor,
dorian, harmonic minor or phrygian), a four-chord progression from a short
list of the ones that always worked, a tempo of 125 to 154, two four-bar
melodies as walks over the scale with a rhythm of ones, twos and fours and
a rest now and then, landing on a chord tone at most bars, a bass figure,
a kick pattern, and whether the hats are eighths or sixteenths. The order
is AABABBAB over the progression.

The player schedules a row (a sixteenth) at a time, 150 ms ahead of the
AudioContext clock on a 30 ms timer, which is how a tracker stays in time
in a browser: a pulse lead (two square waves, the second 8 cents sharp),
a triangle bass, the chord's three notes played one after another within
each row (the arpeggio a three-voice chip used to pretend to a fourth),
a kick (a sine falling from 160 to 42 Hz), a snare (noise through a
bandpass) and hats (noise through a highpass). Everything passes through
a compressor. The rows scheduled are kept so the corner can show the one
playing, as a tracker showed it: row, lead, bass, arp, drums.

The seed is the local date as YYYYMMDD, so the tune is the same for
everyone all day; `#tune=N` asks for another, as do the N key and the
button, and M mutes, F fills the screen. Sound starts on the first click,
as browsers require, and the preference is kept in `localStorage` under
`intro-sound`. `window.Intro` exposes `frame`, `size`, `compose` and `song`
for poking at in the console.
