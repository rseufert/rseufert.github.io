# City

The overworld: the site as a wireframe city, laid out from the date. Every
part of the site is a building you can walk up to and enter.

| file | what |
| --- | --- |
| `city.js` | the whole thing: the layout, the landmarks, the renderer, the sky, the sound |
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
kudasai (a skeleton in the window), and the intro (a cinema with tonight's
tune on the marquee). The rest are offices of seeded sizes, some named from
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

Constants at the top: `EYE` 1.7, `FOV` 75°, `WALK` 7 and `RUN` 12 a second,
`FOG` 80. Collision is against the boxes, the river except on the bridges,
the arena's wall except at the gate, and the edge of the world.

## Sound

Behind a toggle kept in `localStorage` under `city-sound`: wind (looped
noise through a wandering lowpass), footsteps, the river louder as you
near it, a 60 Hz hum rising over the manhole, a murmur near the arena, a
rising sweep on entering and a falling one on falling in.

## Poking

`window.City` exposes `state()`, `step(ms)` for hand-stepped frames,
`begin`, `enter` and `render`.
