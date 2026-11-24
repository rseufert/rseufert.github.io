# Golf

The cabinet in the corner of the bar, the one with the trackball worn smooth:
nine holes in phosphor, a new course every day, and a swing that is a pull
back and a push through. Drawn the way the backrooms are, out of doors.

| file | what |
| --- | --- |
| `golf.js` | the whole game: the course, the ball, the swing, the drawing, the sound |
| `index.html`, `golf.css` | the page and its stylesheet |
| `golf.png`, `share.jpg` | the home tile and the share image, captured from the game |

## Drawing

The backrooms' engine on a plain 2D canvas. Every patch of ground is a quad
in world space; each frame gathers the quads within the fog (`FOG`, 270
yards) and in front of the camera, sorts them far to near together with the
trees, the pin and the ball, transforms them into camera space (yaw, then a
real pitch, since a golf camera looks down), clips them against the near
plane, projects them, fills them black and strokes them in their colour.
Filling black is what keeps the far side of a hill behind it. The stroke
fades with distance, and a second, wide, faint stroke is the glow, which
switches itself off when frames take more than 18 ms. Scanlines and a
vignette are CSS on the stage.

The ground is a coarse grid (`COARSE`, 6 yards) over the whole hole, and a
fine one (`FINE`, 2 yards) over the green and its surrounds, where the coarse
cells are left out. Colours: tee white, fairway green, rough and trees darker,
the green brighter and yellower, sand gold with a few grains, water blue and
shimmering. Trees are two crossed triangles on a trunk, turned to face you.
At dusk: a low sun on a fixed bearing, a haze on the horizon, stars.

## Holes

`generate(seed, n)` is deterministic. The seed is the date (`YYYYMMDD`), so
everyone has the same course today, and `#seed=N` in the address plays any
other. The par is 36: five fours, two threes and two fives, shuffled by the
seed. A hole is a quadratic curve from the tee to the green, bent by a
dogleg: par 3s 135 to 215 yards, par 4s 335 to 445, par 5s 470 to 560. Every
point on the ground is classified by its distance from that curve: fairway
(14 to 21 yards either side, from a little past the tee), rough 30 to 42
yards beyond that, then 16 yards of trees, then out of bounds; and anything 40 yards past the
green is out too. The green is an ellipse turned to face the approach, with
the pin somewhere in it.

The height is two octaves of value noise (14 yards over 110, 2.4 over 34),
then cut: the tee is a flat platform, the green a tilted plane (1 to 2.6
yards in a hundred) with a little roll in it, blended into the ground round
it, bunkers are bowls a yard deep, and water is flat at its own level. Sand
goes where a drive lands and beside the green; water, on some holes, is a
creek across the line or a pond beside it. The course is named for a corner
of Portland.

About two holes in three also have a shape of their own (`shape`, from a
generator of its own, so the rest of the hole is as it was): **a carry**, a
creek across the line 9 to 23 yards short of the green, so the approach has
to fly it; **an elevated tee**, 7 to 15 yards above the ground in front, the
box sloping down to it over 26 yards; **a split fairway**, a strip of rough
with a bunker in it down the middle where a drive lands (par 4s and 5s); or
**a tucked pin**, a bunker in front of the green and the pin in the front
half behind it. The flyover names the shape.

Each hole also has a bearing on the compass (`H.bearing`, again from its own
generator): the hole is laid out up its own axis and turned by it, so the
airport's wind, the low sun and Mt Hood all come round with it, and a
crosswind on one hole is a headwind on the next. The flyover says which way
the hole plays.

## The ball

Yards and seconds, gravity 10.7. Each club has a carry at full power from a
good lie and a loft; its launch speed is found once, by bisection, so that
the carry on flat ground with no wind is the club's number (driver 245, down
to the sand wedge at 78). Power scales the carry, and the lie takes some off
(rough 85%, trees 62%, sand 70%, the sand wedge 92% out of sand: `takeOf`,
which the strike, the HUD and the advice all use). In the air there is a
little drag; lift from the backspin (`LIFT`, in proportion to the speed over
the ground, dying away over five seconds), so a drive climbs to about 33
yards and comes down at near 40 degrees; the wind (0.075 yards/s² for every
mile an hour, the whole time it is up: a 10 mph crosswind moves a drive or
an iron 11 to 13 yards); and the curve: a hook or slice pushes sideways, at
up to 7 yards/s², fading over five seconds. The trees are in the way: a ball
that flies into a canopy (a cone like the one drawn) is knocked down to
three tenths of its speed and turned a little, and one that hits a trunk
comes back (`canopy`); the turn is fixed by the tree, so a forecast and the
shot agree.

On the ground, a bounce reflects off the slope with the surface's
restitution and grip, and backspin takes speed off the first bounce: on the
fairway or the fringe it checks (`CHECK`), on a green it can stop or draw
back. Once down, it rolls: the slope pulls it at 5/7 of g along the gradient
(a rolling ball), and the surface holds it back (green 0.55 yards/s²,
fairway 1.9, rough 4.2, sand 12). Full and true on a flat fairway, the
driver carries 245 and finishes about 273, a 7 iron 152 and 159, and the
wedges stop where they land. A putt drops if it reaches the cup slower than
1.5 yards a second (`CUP_ROLL`, a putt that would run about two yards past)
and lips out if it is not much faster; a chip or a full shot running up has
to be slower than 0.9 (`CUP_RUN`), and one coming down out of the air
slower than 4 along the ground (`CUP_AIR`). A ball that stops within a foot
of the hole on the green is tapped in for a stroke (`GIMME`). Water and out
of bounds cost a stroke: water drops it on dry ground on the near side, out
of bounds puts it back where it was hit. Ten strokes and it is picked up.

In the rain, which is when the airport says it is raining (or `#rain`),
every grass holds a landing ball more and slows a rolling one, the green
most (`WET`), and rain streaks down the screen with the wind.

`move(b, dt, sim)` is one step of a ball, the one in play or a copy, and
says what ended the shot if something did (in from the air, in the cup,
water, out of bounds, stopped); `step` acts on it for the real ball, with
the sounds and the notes, and the copy never lips out at random.

## The advice

Everything the game tells you about a shot comes from running it.
`forecast(power)` launches a copy of the ball from the lie with the club and
the aim (`launch`, the same function the strike uses) and steps it with
`move` until it stops, at the game's own step of 1/240 s so that a landing on
the edge of two surfaces goes the same way in both: wind, slope, lift, trees,
bounces, the cup. It gives
the path, where it first comes down, where it stops, how far that is along
the aim, and what ended it; it is cached by everything that moves it, and by
the power. `solveNeed()` bisects on it for the power that stops the ball at
the pin, or a foot past it with a putter, so the light tick on the meter
allows for run, wind, elevation and slope. When nothing reaches the pin and a
full shot only finds the branches, the tick is instead the power that goes
furthest (`punch`), which is the punch under them. `advise()` keeps the answer and
works it out again when something changes, no oftener than eight times a
second. The aim line is the forecast's track along the ground at the tick's
power (or at the power being swung), with a cross where it comes down and a
ring where it stops, in the water's blue or the flag's red if that is how it
ends. A putt shows only the first few yards of its line, fading, so the
break is a hint and the rest is the read; the HUD gives the putt's aim in
inches left or right of the cup. The club is chosen as each shot stops
(`pickClub`): the shortest whose full shot, forecast from here along the
aim, reaches the pin, or else the one that goes furthest; under the trees,
the one whose punch goes furthest.

The bot that checked this (eight courses, 72 holes, the game's own aim, club
and tick, straight): full shots stop within half a yard of the forecast;
every putt inside three feet goes in; a perfect bot in calm air goes round
about eight under, one with 8% error in its power about level, and with the
seeded wind about three over.

## The swing

Press on the course and pull down, then push up. How far down (against a
reach of 36% of the stage's height) is the most the shot can have; how fast
the push is, against a flick of 2.2 stage heights a second, decides how much
of that you get. How far the push leans off vertical is the hook or slice,
and past full power every bit of lean is multiplied. The putter is only how
far back. The keyboard is three presses of space: start the needle, set the
power on the way up, and stop it on the line on the way down. A press in the
top 28% of the stage turns the aim instead.

While the ball is in the air there is a budget of lean (the arcade's spin
after the strike): drag or the arrows to bend it left or right, down for
backspin. A flyover shows each hole first (`v` shows it again); on the green
the distance is in feet, and little marks drift downhill across the green.

## The camera

One smoothed follow target (`follow`), eased frame-rate independently, and a
target for it from whichever camera the moment calls for (`cameraTarget`). A
target is a place, a heading, and either a pitch or a point to frame: the
pitch that puts that point at a given height in the picture (`pitchFor`) is
worked out from where the camera has got to, not where it is going, so the
ball stays where it is put while the camera is still moving.

- **Address.** Seven yards behind the ball and 2.6 up (4.5 and 2.2 for a
  putt), facing the aim. The ball sits at 0.78 of the frame's height, and the
  pitch leans toward the ground some way ahead only as far as keeps the ball
  between 0.70 and 0.84. If the ground between would hide it (`sightline`,
  which stops a third of a yard short so the ball's own lie does not count),
  the camera is raised, then pulled in, never more than three yards higher
  or nearer than two and a half (`unblock`).
- **Watch.** A full shot is watched from where you stood for its first 0.9
  seconds, the camera turning to keep the ball in the middle as it climbs.
- **Chase.** Then behind it, 13 yards back, and low: two yards over the ground
  plus under half the ball's height, so near the top of a drive the camera is
  under the ball and the arc is seen against the sky.
- **Land.** Past the apex, the ball's flight is run on ahead without it
  (`predictLanding`, the same steps as `fly`), and the camera cuts to 16
  yards beyond where it will come down and six to one side, low, looking
  back, so the bounce and the roll come at you. Only for a carry of 50 yards
  or more with most of a second to go, and only where it can see the spot. If
  the ball runs at the camera or past it, it goes back behind; when the ball
  stops, it holds most of a second and cuts to the lie.
- **Putt.** Above and behind, five yards back and three up, so the slope
  the ball is rolling on is in the picture.
- **Penalties.** Water or out of bounds holds on the spot for 0.9 seconds
  with the note on the screen, then cuts to the drop.

The next aim and club are chosen as the ball stops (`nextShot`), so the
camera makes one move from the shot to the lie, not two. While lining up,
`q` and `e` (or two fingers dragged sideways) turn the head, and `r` (or the
green pad) stands 12 yards beyond the pin looking back at the ball; both snap
back. With `prefers-reduced-motion` the hole is not flown (a cut to the tee,
and `v` is a still), the title camera holds still, a full shot is watched
from where you stood the whole way, and the mountain does not shake it.

The ball is sorted in front of the patch of ground it sits on (most of a
coarse cell nearer than its distance), since sorted by its centre that patch
is often nearer than the ball and would be painted over it; ground really
between the ball and the eye still hides it.

`Golf.cam`, `Golf.follow` and `Golf.shotCam` are the camera's state,
`Golf.tick(ms)` runs the game on by hand and draws it, `Golf.holeTo(n)` and
`Golf.put(x, z)` set a hole and a lie, `Golf.framing()` says where the ball
is in the picture (as fractions of the width and height) and whether the
ground hides it, and `Golf.predict()` is where the ball in the air will land.
So a camera change can be measured rather than eyeballed:

```js
Golf.start(); Golf.holeTo(0); Golf.put(10, 120); Golf.tick(33); Golf.framing()
```

## The wind off the river

Each hole is turned on the compass by its bearing, so a compass wind
means something different on each: the latest observation at Portland's
airport (api.weather.gov, station KPDX, no key, CORS open) is fetched when
the page loads and when a round begins, turned from the direction it blows
from to the direction it goes and then by the hole's bearing, and laid over
every hole's seeded wind (`applyWind`); the HUD marks it PDX with the
compass point. The same observation says when it is raining at the airport
(its description, or a present-weather code of rain, drizzle or showers),
and then it rains on the course, and the HUD says RAIN; the observation is
read again at the start of each round, so the rain stops when it stops at the
airport. If the fetch fails
the holes keep the wind they grew with, and it is dry. `Golf.wind` is the
observation; `Golf.calm()` puts the seeded wind back.

## Sound

WebAudio, behind the sound toggle and built on the first click, with
`js/unmute.js` for iPhones: a breeze that rises with the wind, the swoosh and
crack of a full swing, the tick of a putt, a thud or a hiss on landing, a
rustle of leaves when the trees catch it, a splash, the rattle of the cup,
and a crowd for anything under par.

## Controls and state

Drag down and flick up to swing; arrows aim (shift for fine) and choose the
club; `v` flies the hole; hold `q` or `e` to look round and `r` to look back
from the green; `esc` pauses; on a phone there are buttons for aim, club, the
flyover and the view from the green, a drag across the sky aims, and two
fingers dragged sideways look round. The club is chosen for
you as each shot stops, the shortest whose full shot reaches the pin. Best rounds per
course, the cabinet's records and the sound setting are in `localStorage` under `golf`.
`window.Golf` exposes the generator, the ball and a few levers for poking at
in the console, including `Golf.settle()`, which runs a shot to rest at once,
and `Golf.hud(false)`, for a clean picture. The keyboard is the game's only
while the stage is on screen. A light tick on the swing meter marks the
power that reaches the pin with the chosen club (see the advice, above).

On a phone the aim pads turn the aim 0.01 radians a tap for a full shot
(about two and a half yards at a driver's distance) and 0.006 for a putt,
and held down they repeat, faster the longer they are held; a drag across
the sky is still the finest. A putt's backswing counts from 8 pixels, a full
swing's from 18, so the gentlest putt is a short one even on a short stage.

The round in progress is kept as each shot stops, in `localStorage` under
`golf-round`: the course, the hole, the strokes, the card, the hole's
numbers and the lie. Come back to the same course (a reload, a phone that
dropped the tab) and the title says where the round is, and "play on" puts
the ball back where it was, or "start from the first tee" drops it and begins
the course again. It is forgotten when the card is shown, and replaced when
another round begins.

The card has a row of putts and a line of the round's numbers: fairways hit
off the tee on the par 4s and 5s, greens in regulation (a hole out from off
the green counts only if it was in par − 2), putts, penalties,
the longest drive, and holes out from off the green (`summary`). The line
goes into the post to the board too, outside the code block, which is as it
was.

More levers: `Golf.forecast(p)` and `Golf.need()` are the advice,
`Golf.scores`, `Golf.strokes` and `Golf.stats` the score as it stands,
`Golf.rain(on)`, `Golf.bearing` and `Golf.shape` the day and the hole, and
`Golf.kept()` and `Golf.forget()` the round kept.

## The cabinet's records

The record board, the way the cabinet in the bar kept one (`RECORDS`). Four
are single shots, weighed as they happen: the longest drive (a tee shot on a
par 4 or 5 that stops on the fairway, the fringe or the green, as the cabinet
had it), the longest putt to drop from on the green, the longest hole out
from off it, and the tee shot nearest the pin on a par 3 (the first stroke,
stopping on the green; a tap-in does not count as a putt, and an ace is not
"near"). Five are for a whole round, weighed when the ninth hole is in
(`roundRecords`): the best round, the most birdies (anything under par), the
fairways hit of seven, the greens hit of nine, and the fewest putts; the last
three want every hole's numbers and no hole picked up. All in whole yards,
feet, inches and strokes, so a record is beaten by one of those and never
tied.

Each has a house record that came with the cabinet, with the initials of
whoever set it (the sasquatch, the heron, the elves, rickbot, Rick, Josh
Allen, the airport, the mountain) and a year in the nineties. They were set
from a bot that plays a little unevenly: about what the best of four or five
rounds does, so one falls now and then and not all at once. `tryRecord(key,
v)` keeps a number that beats what stands, in `localStorage` under `golf`
(`records`: the number, the initials in use, the course, the hole, the day,
the seed), and for a shot puts NEW CABINET RECORD on the screen for five
seconds with a cheer. The card at the end of a round lists the ones that fell
in it, and the records button shows the whole board over the game, paused,
with the house's initials in blue and yours in green; the button again puts
it away. Initials are three letters or figures, given on the board; until
there are any a record is held by YOU, and the first ones given take those.
Under the board, the cabinet's counts: rounds, holes in one, eagles, birdies
(`career`), and how often the trees and the mountain have had something to
say. `Golf.records` is the board, `Golf.record(key, v)` offers it a number,
`Golf.initials("RIK")` sets the initials. Nothing is sent anywhere; the
clubhouse's records, below, are the shared ones, and the board's second view.

## The clubhouse board

The web 0.9 way, like the guest book and the ghosts. When a round is done
the veil offers "post your card", which opens an issue on the repo titled
`card: TOTAL on COURSE (SEED)` with the card in a fenced code block, one
line (`cardLine`): `gc2:SEED:TOTAL:H1,...,H9:FLAGS:STATS:INITIALS:CHECK`.
The flags are what happened: `sq4`, sasquatch seen on hole 4; `hood6`, Mt
Hood erupted on hole 6; `ace3`, a hole in one. The stats are the round's
numbers, a letter and a figure each, only the ones there are: `d` the
longest drive that found the short grass, `p` the longest putt to drop (in
feet), `o` the longest hole out, `n` nearest the pin (in inches), and `f`,
`g`, `u` the fairways, greens and putts, which a round with a hole picked up
does not carry. Each hole keeps its own best shots with its other numbers
(`fwd`, `holed`, `out`, `pin` in `stats`), so they come through a reload
with the kept round. The initials are the ones in use, or a dash; given at
the card, they go on it. The last field is a check word over the rest
(`checkWord`, FNV-1a with a phrase on the end), so a number changed by hand
no longer adds up; it is no secret, the source being public, which makes it
a lock on the door of an honour system and no more. The first generation,
`gc1:SEED:TOTAL:H1,...,H9:FLAGS`, is still read.

`tools/cards.py` reads the open issues with that title, checks each line is
a card and nothing else (nine holes of 1 to 10 that add to the total, a
check word that matches, numbers a round could have had: no more fairways
than par fours and fives, no 500 yard drive), and, with a token, asks who
last edited each issue: a card whose issue was last edited by someone other
than its author is left out, since it is no longer that player's card. It
works out the course and the par from the seed with the game's own shuffle
(mulberry32, ported), keeps each player's best on each course, takes the
best of each kind among every card as the clubhouse's records (oldest first,
so a record stands until it is beaten and not matched; the best round and
the most birdies from any card, the rest from second-generation ones), and
writes `cards.json` with both; `tools/cards_test.py` tries it on good cards
and doctored ones and checks its check word against the game's; `.github/workflows/cards.yml` runs it on
issue events and once a day and commits it to the `sky-data` branch. The
page fetches it once (`fetchBoard`), shows the course's top ten with your
place among them under your card, and the best anywhere; "the board" in
the bar shows it mid-round, paused. The records board's second view, THE
CLUBHOUSE, lists the shared records with the initials from the card and the
name it was posted under, which links to the card; and the post button says
when the round just played would take any of them (`wouldTake`). Closing an issue takes a card down. An
honour system, like the one in the clubhouse.

## Something in the trees, and the mountain

Some holes (one in five), a while after you reach them (eight to fifty
seconds, while you are lining up), something tall walks out of the trees
on one side of the hole, a quarter to two thirds of the way along, pauses,
and goes back (`creatures`, `sasquatch`): a broad dark figure drawn with
the trees' billboarding, 2.7 yards tall, arms swinging, two wood-knocks when
it steps out. On the screen and inside the fog for a second in all and it
counts: `sq<hole>` goes on the card and `golf.squatch` in `localStorage`
goes up. `Golf.squatch()` calls it.

Mt Hood stands on the horizon east by south (`HOOD.bearing`, 1.95 rad
from north, turned by each hole's bearing), a silhouette with a snow line, drawn in `sky()`.
Once a round, if at all (six in a hundred a hole, or `#hood` on the
address for the first hole), it erupts: a glow at the summit, a column of
puffs leaning with the wind and growing for forty seconds, lightning in
the column, ash drifting down the screen with the wind for a few minutes,
the camera shaking for the first seven seconds, a rumble under everything
(`audio.rumble`), and `hood<hole>` on the card. `Golf.hood()` calls it.

## The muzak

The clubhouse speaker, optional (the muzak button, kept in `localStorage`)
and apart from the game's own sounds, on its own bus to the output through
a low-pass and a compressor. `makeMuzak` schedules a bar at a time, half a
second ahead: four chords twice (`CHORDS`, electric piano voicings; `ROOTS`
under them) at 71 to the bar with swung eighths, a whole tone flat; the
piano on the one, the and of two and sometimes the four (sine plus a quiet
octave triangle plus a tine click, with a slow wow and a fast flutter on
every pitch); a bass on the root and fifth that steps to the next root
when it feels like it; kick, a brushed snare behind the beat, hats on the
eighths with an open one now and then; a vibraphone phrase from the
pentatonic every other bar; a bed of crackle and a pop or two a bar.

## Elsewhere on the site

The city has a links block: one hole in miniature, a clubhouse whose door
is `/golf/`, and the pro, whose errand is a finished round (`localStorage`
`golf.rounds`). The paper's sport page prints the course of the day with
its pars (the names and the par shuffle are mirrored there, by the same
seed) and your best on it. Rickbot answers "golf", and says how many times the
mountain has gone up on your watch.
