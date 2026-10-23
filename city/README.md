# City

The overworld: the site as a wireframe city, laid out from the date. Every
part of the site is a building you can walk up to and enter.

| file | what |
| --- | --- |
| `city.js` | the whole thing: the layout, the landmarks, the people and their errands, the renderer, the sound |
| `sky.js` | the real sky: a catalogue of ~170 stars in 25 constellations with their lines, and the arithmetic that places them, the Sun and the Moon over Portland at a moment |
| `index.html`, `city.css` | the page and its stylesheet; the page also loads the arena's engine and presets for the scoreboard |
| `city.png`, `share.jpg` | the home tile and the share image, captured from the canvas |

## The town

Seven blocks square, blocks of 28 with streets of 10 between, the plaza in
the middle. The landmarks take the other blocks by a shuffle seeded with
the date (`#seed=N` asks for another day's): the arena (an octagon of
walls, floodlights, a scoreboard), the mocks (SAP Tower, the EDI corridor,
the mock bank with its columns, UBL, ACME Treasury, each with its own
door), the dashboard (a hill of contour rings that lifts you, a station, a
mast with a blinking light and an anemometer), the Flipper nest (with a
Flipper the size of a car parked outside), the blog (a mailbox a post, from
`site.posts`), the loft (a marquee for Dick Dank, speaker stacks), kulture
kudasai (a skeleton in the window), the intro (a cinema with tonight's
tune on the marquee), and the temple (three steps, a colonnade, a pediment
with the ouroboros, the Monad over the door, a dome of rings; the door is
`/temple/`). The rest are offices of seeded sizes, some named from
the site's lore, with windows lit at random after dark. The river runs
along one east-west street, with a bridge at every crossing, the USGS gauge
on one of them, and a heron that lifts a foot now and then. A manhole in a
far street is the way to the backrooms: step on it and you fall. The plaza
has the fountain (a Julia set, which is to say it goes round), the helpdesk
kiosk where rickbot is in, lamps, and the town sign by the south gate,
where you start.

Every landmark has a door: within reach, the screen names it and E (or the
button, on a phone) enters, with a fade; the helpdesk opens rickbot's
window instead; the manhole takes you without asking. Street signs stand
at every corner in the elves' script, three strokes a letter drawn by the
seed, and give way to English a letter at a time once you have stood still
for most of a second.

## The sky

`sky.js` keeps the brighter stars of 25 constellations (name, right
ascension in hours, declination in degrees, magnitude, J2000) and the lines
a chart draws between them. `compute(date, lat, lon)` turns the moment into
local sidereal time (from the Julian date: GMST = 18.697374558 +
24.06570982441908 · days since J2000, plus the longitude in hours) and each
star's hour angle into altitude and azimuth, and returns unit directions
(x east, y up, z north), the constellation centroids with a line of lore
each, the Sun (mean longitude and anomaly, two terms of the equation of
centre, then ecliptic to equatorial) and the Moon (the largest terms of
its longitude and latitude, and its phase from the elongation), both good
to about a degree. The city computes it every frame for Portland
(45.52° N, 122.68° W) at the clock's time, `#hour=N` on today's date if the
address says so, plus however far the time-lapse has run.

The city draws the sky's gradient from the Sun's altitude (keyframes at
−14°, −9°, −5°, −1.5°, 1.5°, 8° and 30°), the stars fading in between −3°
and −12° with sizes by magnitude, the lines faint, Polaris ringed and
labelled with the latitude, the Merak–Dubhe pointer line dashed to
Polaris when the names are on, constellation names at the centroids when
you stand still or press C, M31 as a smudge, the Sun as a disc and the
Moon with its phase (the lit half, then an ellipse for the terminator).
The camera now pitches properly (a rotation, not a shear) from −57° to
+83°, so you can look nearly straight up. T runs the clock at an hour
every 1.3 seconds and shows the offset in the corner.

The mechanics the page explains: the Earth turns about an axis that points
near Polaris, so Polaris stands still at an altitude equal to the latitude
and everything wheels round it anticlockwise at 15° an hour; stars within
the latitude of the pole (the Dipper, the Little Dipper, Cassiopeia,
Cepheus, Draco) never set from here; the sidereal day is four minutes
short of the solar one, so each night's sky is four minutes ahead of the
last and the seasons have their own constellations; the pole drifts over
26,000 years (Thuban was the pole star, Vega will be).

## The people

Eleven figures (a person in nine lines with a cap, a rake or a telescope, a
cat, a ghost, an elf), each a door of kind `npc` that talks instead of
entering, each with an errand that sends you elsewhere on the site, all
optional. `QUESTS` holds each with a `check()` that reads what the rest of
the site leaves in `localStorage`: `footprints` (chat.js now records every
path visited, 80 at most, in this browser only), `backrooms` (found or
gone down), `backrooms-ghosts`, `arena-tanks`, `intro-played` (the intro
now writes today's seed when the tune starts), `rickbot` (a room means
the hack happened), and the city's own flags (Baby found, the clock run
24 hours). Progress is in `city-quests`. Talking offers, then waits, then
thanks and runs `then` (the heron fetches the live USGS reading; the
astronomer turns the names on; the hierophant at the temple only wants you
to have been in). Q is the log. All eleven done: the sign and
the HUD read POP. 2 and a magenta star labelled YOU appears 4.5° from the
pole, so it never sets.

## The talkers and the fauna

Fifteen more figures have no errand, only `idle` lines said in turn: the
IDoc and the 997 (a `doc` figure, a sheet with lines), RAMMER (a `tank`),
the dolphin (on a trolley), the tide, Josh Allen (`big`), the mayor, a
tourist, the mime (in the Julia's colours), a machine elf, the usher, the
roadie, the sysadmin, the librarian at the temple, and the cron job, which has a `when(hour, sunAlt)`
and is only there from 04:00 to 04:36; the time-lapse brings it round.
Hidden things carry a `hidden` flag that the gatherer, the labels and the
doors respect.

`critters` are polylines rebuilt every frame by `FAUNA[type]`, drawn as
separate segments (`pairs`): seven pigeons walking and pecking on the
plaza that fly off when you come within four metres (a flap of filtered
noise) and land where they end up; three rats running the curb by the
manhole; four bats on summed sines round two plaza lamps and eighteen
fireflies blinking by the river, both only when the Sun is 4° under; three
crows hopping on a mid-height roof by day; a dolphin that arcs out of the
river for 1.6 s every 11 s near the heron; a deer on the hill when the Sun
is between −8° and 12°, grazing and looking up, that runs off if you come
within seven metres and comes back at the next dawn; and a raccoon with
two bright eyes on a mailbox after dark.

## Drawing

As the backrooms: quads filled black and stroked, painted back to front.
Each frame gathers what is within the fog (80) and the view: the walls of
each box that face you, cut into bays of 4 and floors of 3.2 when within
55, a roof outline, the polylines (poles, rails, rings, the heron, the
cups), the labels (billboard text sized by distance), the street signs and
the scoreboard, each with its distance, sorted far to near. The ground
grid (5s, within 60), the curbs, the centre lines and the river are drawn
first, under everything; long street lines are drawn in pieces so each can
fade on its own. The sky is a gradient between keyframes by the hour
(`#hour=N` forces one), with stars after dark, a sun by day and a moon by
night at the azimuth and height the hour gives them. The scoreboard is a
real match in the arena's engine, six presets drawn as points on the
board's plane, ticked sixty a second, with another match six seconds after
the end; without the engine it reads NO SIGNAL.

Constants at the top: `EYE` 1.7, `FOV` 75°, `WALK` 7 and `RUN` 12 a second, `LAT` and `LON` for the sky,
`FOG` 80. Collision is against the boxes, the river except on the bridges,
the arena's wall except at the gate, and the edge of the world.

## Sound

Behind a toggle kept in `localStorage` under `city-sound`: wind (looped
noise through a wandering lowpass), footsteps, the river louder as you
near it, a 60 Hz hum rising over the manhole, a murmur near the arena, a
rising sweep on entering and a falling one on falling in. On a touch screen
the wind, the water and the hum are let through brighter and the steps
higher, for a phone's speaker, and the master is louder; `js/unmute.js`
does what an iPhone needs before Web Audio is heard.

## Poking

`window.City` exposes `state()`, `step(ms)` for hand-stepped frames,
`begin`, `enter` and `render`.
