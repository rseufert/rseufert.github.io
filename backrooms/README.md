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
you fall into it, and `#seed=N&level=M` in the address reproduces one (read
again when the address changes). The grid is 22 + 2·level cells a side, and
keeps growing to 64 at level 21. Rooms are dropped until they overlap (the
backrooms are not architecture) and stop once about 30% of the grid is open
(a little less below level 10), so a deeper level stays a maze rather than
dissolving into one hall: about 40% open at every depth, where it was 67% at
level 30. They are joined by L-shaped corridors with a few extra for loops
(six at most), pillars grow on a 3-cell grid where there is room, nooks open
off the sides, and whatever the start cannot reach is filled back in. The way
down is a cell among the farthest 15%, and on level 0 at least sixteen steps
off, past the fog, so the figure and a note come first (23 on average; it was
15). Each level is a semitone lower in the hum and a colour further along
(amber, acid, cyan, magenta, red, violet, white, then a hue a level); from
level 3 ceilings vary room to room and a lintel is drawn where they step;
from level 8 the odd hall is tall. The fog radius is 11 − 0.6·level, no less
than 4.5.

From level 7, every fourth level is a kind of its own (`kindOf`), in turn:
**dark** (7, 19, …), the fog at 2.4 cells and only the way down lit, seen from
across the floor; **corridor** (11, 23, …), one long maze of one-wide halls
cut by a backtracking walk with a very few loops (27 cells a side, three
figures); and **moving** (15, 27, …), where the way down goes somewhere else,
far from you and out of sight, every forty seconds.

Notes are placed on walls at least four steps from the start. On levels 0 to 3
they come from the site's lore; from 4 from a list for lower down; from 9
from one for the deepest; and on every level a few are written from your own
record (how often it has found you, your best time here, the ghosts on this
seed, the deepest you have been). The one that says how far the way down is
tells the truth.

## It

A tall stooped figure in a few white lines, red up close, with static where a
face would be; it flickers when far. It walks the breadth-first distance field
toward you while you are not looking and freezes while you are (within
9 − 0.6·level cells, no less than 3; beyond that it keeps coming even in view).
Speed is 1.4 + 0.22·level cells a second, up to 3, so from level 4 it outpaces
a walk. There are 1 + level/2 of them, up to 5, and from level 12 one more
every six levels, up to 8. One that falls far behind, or goes unseen for 25 s
at a distance, is somewhere nearer now (and if there is nowhere out of sight
to put it, it stays where it was).

**Running is a choice.** A run (3.3) lasts `BREATH` (8) seconds from full,
comes back in `RECOVER` (8) walking or five standing, and once it is gone you
walk at 1.6 until it is half back; a bar under the chalk shows it while it is
not full. And a run is heard: for `HEARD` (2.5) seconds after, any figure
within `HEAR` (16) steps comes at up to 1.3 times its pace, never faster than
a run, and does not lose interest. From level 4 some of them sprint (one, and
a second from level 14): 3.8 down a straight hall, faster than you, and a
stop of nearly half a second at every corner.

Within 0.45 cells it has you: FOUND, and back to the start of the level with
it somewhere new, the level's clock still running and your chalk and static
as you left them. The third time on one level, it takes you back up one.

**The stand-off.** Watched, it is only a body: it finds you at 0.22 cells
rather than 0.45, so in a one-wide corridor you can edge past one you are
looking at, against the wall. Stared at for `STARE` (10) seconds while it is
held, it looks away first, walks off for two seconds, and is then somewhere
else out of sight, behind you (further from the way down than you are).

## Ghosts

Whoever it finds leaves a ghost. While you play, the camera's position and
yaw are recorded ten times a second and the last thirty seconds kept; FOUND
packs them into one line, `bk2:SEED:LEVEL:HZ:DATA`, six URL-safe base64
characters a sample (x and z in 64ths of a cell, yaw in 4096ths of a turn;
`bk2` is the generation of the levels, and `bk1` ghosts, walked on the levels
as they were before November 2026, are neither replayed nor read in),
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
seconds; `CHALK` (3) pieces a level, fresh each new level (not after FOUND).
In `stalk`, a thing whose next step would take it inside a circle it is not
already in stops where it is and picks its path again next frame, so it
paces the edge. Drawn within reach of one (`CHALK_R` + 1.2), it backs away
for two seconds and goes elsewhere, behind you, which is the other way out of
a stand-off. The circle is drawn with `poly` on the floor, white, fading over
its last four seconds, and counted in the HUD under the level; when it wears
off it leaves a faint ring for the rest of the level (`marks`), a trail in
the fog if you want one. The grimoires' rule as a cooldown: it works if you
draw it before it reaches you and stay inside.

## Static and root

F (or the button on a phone) is static: for `FUZZ` (4) seconds the
stalkers stop, stop finding, and are drawn as noise where they stood, so
you can walk through one that blocks the only corridor; then `COOL` (45)
seconds before it works again, reset on each new level as the chalk is.
The bottom right of the HUD shows ready, the countdown, or the seconds left.
A burst of highpassed noise plays.

` is root: a session above the floor. Mode `root` stops the stalkers and
the clock, keeps the ghosts walking, and shows the level from overhead:
open cells outlined, the exit pulsing, the stalkers as red crosses, every
ghost as a dot with its trail and its name, and you as an arrow where you
were standing. Tab climbs into a ghost: the camera takes its recorded
position and yaw, so you watch its last thirty seconds from its own
eyes, with a marker where you stand; tab again for the next, then back to
the map. ` leaves and puts you back. Without the root token (the elves'
palette in `localStorage`, from escaping rickbot's dungeon) a session
lasts twenty seconds, cannot be opened again for a minute, and the map
shows the way down only once you have seen it yourself. There is no server, so nobody is watched live; the
recordings, all at once, are the superuser's view.

## Sound

WebAudio, built on the first click and behind the sound toggle: the hum is a
60 Hz sawtooth through a slowly wandering lowpass, a 120 Hz sine and a
60.7 Hz sine beating against it, dropping a semitone a level; footsteps are
filtered noise; the beating 60.7 Hz sine beats faster the nearer you are to
the way down (`audio.way`, by its distance field); a 38 Hz drone and a
wavering 1.87 kHz whine rise as it nears;
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
Progress (seed, level, deepest, times found, sound, the best time on each
level, and the descent under way) is in `localStorage` under `backrooms`, and
the ghosts under `backrooms-ghosts`; rickbot reads both. "start over" asks
first: a second press within four seconds means it.

## Finding the way, and the record

A draft runs along the floor toward the way down: a dozen faint motes near
your feet, each drifting from its cell to the neighbour one step nearer
(`drift`, `draft`, on the way down's own distance field). The hum beats
faster as you get close.

The clock in the corner is the level's, and it keeps running through FOUND.
The way down records it: your best on each seed and level is kept, shown
under the clock, and said on the drop screen. A descent is timed from the top
of level 0 of a seed, through every FOUND, to wherever it gets, and shown
under that; on each drop the *post your descent* link offers it as an issue
titled `descent: level L in M:SS (seed S)` with one line,
`bd1:SEED:LEVEL:SECONDS:FOUND`. A descent ends if an address jumps it to a
level it did not walk to. `tools/ghosts.py` reads those too (level 1 to 60, at
least five seconds a level), keeps each
person's deepest then quickest on each seed (a hundred in all) as `descents`
in `ghosts.json`, and the title says the deepest three on the seed you are on.

`window.Backrooms` exposes the generator and the state for poking at in the
console, and levers to measure a change with: `Backrooms.tick(ms)` runs the
game on (a thirtieth of a second a step) and draws once; `Backrooms.enter(level,
seed)` begins a level at once; `Backrooms.press(code, down)` holds a key;
`useStatic`, `useChalk`, `visible(x, z)` and `toExit(x, z)`.

## The wall with the signs

One note on level 0 of every seed is not words but signs, `?800?48480.(‡2‡?650-525‡?4`:
a substitution in the key from Poe's Gold-Bug (5 a, 2 b, - d, 8 e, 1 f, 3 g, 4 h, 6 i,
0 l, 9 m, * n, ‡ o, . p, ( r, ; s, ? t, ¶ u, ] v, † y), run together as Poe ran his,
which reads TELL THE HELP ROBOT IALDABAOTH. The code clerk in the city asks for it,
the manuals for breaking it are on the temple's eighth shelf beside the story, and
saying the name to rickbot completes the errand.
