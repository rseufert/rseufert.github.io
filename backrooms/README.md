# Backrooms

You noclipped out of the site. Under it there is only wireframe: rooms that
go on, a drop ceiling, a hum at 60 Hz, notes on the walls, and something tall
that walks when you are not looking. Find the way down. There is no bottom.

| file | what |
| --- | --- |
| `backrooms.js` | the whole game: the generator, the renderer, the stalker, the sound |
| `index.html`, `backrooms.css` | the page and its stylesheet |
| `backrooms.png`, `share.jpg` | the home tile and the share image, captured from the game |
| `../tools/ghosts.py`, `../.github/workflows/ghosts.yml` | the ghosts sent in, compiled from issues to `ghosts.json` on the `sky-data` branch |

## Drawing

Vector graphics on a plain 2D canvas, the way the arcades did them before
pixels were cheap. Every wall, floor tile and ceiling tile is a quad in world
space. Each frame gathers the quads within the fog radius, sorts them far to
near, transforms them into camera space, clips them against the near plane,
projects them, fills them black and strokes them in phosphor: a painter's
algorithm, which is how a wireframe keeps what is behind a wall behind it. The
stroke fades with distance (the fog), the lights flicker, and deeper down
they black out. A second, wide, faint stroke is the glow; it switches itself
off when a frame takes more than 18 ms. Scanlines and a vignette are CSS on
the stage. When it is close, slices of the frame are copied sideways.

Constants at the top: `NEAR` 0.06, `EYE` 0.42 (ceilings start at 0.8), `FOV`
78°, `WALK` 2 and `RUN` 3.3 cells a second. The focal length is the longer of
the horizontal and a 70° vertical, so a phone in portrait gets a narrower
view rather than a taller one.

## Levels

`generate(seed, level)` is deterministic, so a level is the same each time
you fall into it, and `#seed=N&level=M` in the address reproduces one. The
grid is 16 + 3·level cells a side, up to 44. Rooms are dropped until they
overlap (the backrooms are not architecture), joined by L-shaped corridors
with a few extra for loops, pillars grow on a 3-cell grid where there is room,
nooks open off the sides, and whatever the start cannot reach is filled back
in. The way down is a cell among the farthest 15%. Each level is a semitone
lower in the hum and a colour further along (amber, acid, cyan, magenta, red,
violet, white); from level 3 ceilings vary room to room and a lintel is drawn
where they step; from level 8 the odd hall is tall. Notes are placed on walls
at least four steps from the start, from a list of site lore. The fog radius
is 11 − 0.6·level, no less than 4.5.

## It

A tall stooped figure in a few white lines, red up close, with static where a
face would be; it flickers when far. It walks the breadth-first distance field
toward you while you are not looking and freezes while you are (within
9 − 0.6·level cells, no less than 3; beyond that it keeps coming even in view).
Speed is 1.4 + 0.22·level cells a second, up to 3, so from level 4 it outpaces
a walk. There are 1 + level/2 of them, up to 5. One that falls far behind, or
goes unseen for 25 s at a distance, is somewhere nearer now. Within 0.45 cells
it has you: FOUND, and back to the start of the level with it somewhere new.

## Ghosts

Whoever it finds leaves a ghost. While you play, the camera's position and
yaw are recorded ten times a second and the last thirty seconds kept; FOUND
packs them into one line, `bk1:SEED:LEVEL:HZ:DATA`, six URL-safe base64
characters a sample (x and z in 64ths of a cell, yaw in 4096ths of a turn),
and stores it in `localStorage` under `backrooms-ghosts` (the newest forty).
Entering a level gathers the ghosts of that seed and level, yours first and
then the ones sent in, eight at most, and each walks its half minute again
from a staggered start, loops after twenty seconds of rest, and is drawn as
a pale blue figure in nine lines with legs that swing with the distance it
has walked; where it ends, a cross on the floor and `found here · who`. They
are occluded like the figures are, by line of sight. The first one you see
on a level gets a line of text and a tick.

Seeds come from a dozen (`FLOORS`), so that visitors share floors; `#seed=`
takes any number. The *leave your ghost* link opens a prefilled issue titled
`ghost: level L of seed S` with the line in a code block; `ghosts.yml` runs
`tools/ghosts.py`, which keeps the open ones that match the shape, newest
first, twenty a floor and four hundred in all, and commits `ghosts.json` to
the `sky-data` branch, which the page fetches with `data/ghosts.json` on
master as the fallback. Closing the issue lays the ghost to rest. Nothing in
an issue is evaluated; a line that is not a ghost is left out.

## Chalk

C (or the button on a phone) draws a circle of chalk, radius `CHALK_R`
(1.3 cells), on the floor round where you stand, for `CHALK_TIME` (20)
seconds; `CHALK` (3) pieces a level, fresh each level. In `stalk`, a thing
whose next step would take it inside a circle it is not already in stops
where it is and picks its path again next frame, so it paces the edge. The
circle is drawn with `poly` on the floor, white, fading over its last four
seconds, and counted in the HUD under the level. The grimoires' rule as a
cooldown: it works if you draw it before it reaches you and stay inside.

## Static and root

F (or the button on a phone) is static: for `FUZZ` (4) seconds the
stalkers stop, stop finding, and are drawn as noise where they stood, so
you can walk through one that blocks the only corridor; then `COOL` (45)
seconds before it works again. The bottom right of the HUD shows ready,
the countdown, or the seconds left. A burst of highpassed noise plays.

` is root: a session above the floor. Mode `root` stops the stalkers and
the clock, keeps the ghosts walking, and shows the level from overhead:
open cells outlined, the exit pulsing, the stalkers as red crosses, every
ghost as a dot with its trail and its name, and you as an arrow where you
were standing. Tab climbs into a ghost: the camera takes its recorded
position and yaw, so you watch its last thirty seconds from its own
eyes, with a marker where you stand; tab again for the next, then back to
the map. ` leaves and puts you back. Without the root token (the elves'
palette in `localStorage`, from escaping rickbot's dungeon) a session
lasts twenty seconds. There is no server, so nobody is watched live; the
recordings, all at once, are the superuser's view.

## Sound

WebAudio, built on the first click and behind the sound toggle: the hum is a
60 Hz sawtooth through a slowly wandering lowpass, a 120 Hz sine and a
60.7 Hz sine beating against it, dropping a semitone a level; footsteps are
filtered noise; a 38 Hz drone and a wavering 1.87 kHz whine rise as it nears;
the fall is a sine sweep down, the catch a sawtooth sweep and a burst. On a
touch screen the mix is for a phone's speaker, which carries little under
300 Hz: the hum's lowpass opens to 700 Hz with a third harmonic added, the
steps go up to 1.2 kHz and the master to 0.9. `js/unmute.js` plays a
moment of silence through an audio element and resumes the context on
return, which is what an iPhone needs to let Web Audio through its ringer
switch and its locks.

## Controls and state

WASD or arrows walk, the mouse looks under pointer lock (click the stage;
drag to look where the lock is refused), shift runs, esc pauses; on a touch
screen the left thumb walks, the right looks, and a button in the top left
corner pauses (it also shows where the lock is refused). The pause veil has
settings: how far the view turns per mouse or thumb movement (`look`), how far
the left thumb travels to walk flat out (`walk`), both multiples of the stock
feel, invert look, and left-handed, which swaps the thumbs. They are kept in
`localStorage` under `controls`, which the city reads too. Fullscreen on the
stage.
Progress (seed, level, deepest, times found, sound) is in `localStorage` under
`backrooms`, and the ghosts under `backrooms-ghosts`; rickbot reads both. `window.Backrooms` exposes the generator and
the state for poking at in the console.

## The wall with the signs

One note on level 0 of every seed is not words but signs, `?800?48480.(‡2‡?650-525‡?4`:
a substitution in the key from Poe's Gold-Bug (5 a, 2 b, - d, 8 e, 1 f, 3 g, 4 h, 6 i,
0 l, 9 m, * n, ‡ o, . p, ( r, ; s, ? t, ¶ u, ] v, † y), run together as Poe ran his,
which reads TELL THE HELP ROBOT IALDABAOTH. The code clerk in the city asks for it,
the manuals for breaking it are on the temple's eighth shelf beside the story, and
saying the name to rickbot completes the errand.
