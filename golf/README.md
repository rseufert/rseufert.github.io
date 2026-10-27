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

## The ball

Yards and seconds, gravity 10.7. Each club has a carry at full power from a
good lie and a loft; its launch speed is found once, by bisection, so that
the carry on flat ground with no wind is the club's number (driver 245, down
to the sand wedge at 78). Power scales the carry, and the lie takes some off
(rough 85%, trees 62%, sand 70%, the sand wedge 92% out of sand). In the air
there is a little drag, the wind (0.2 yards/s² for every mile an hour, the
whole time it is up), and the curve: a hook or slice pushes sideways, at up to
7 yards/s², fading over five seconds. On the ground, a bounce reflects off
the slope with the surface's restitution and grip, and backspin takes speed
off the first bounce on a green, enough to check it or draw it back. Once
down, it rolls: the slope pulls it at 5/7 of g along the gradient (a rolling
ball), and the surface holds it back (green 0.55 yards/s², fairway 1.6,
rough 4.2, sand 12). It drops if it reaches the cup slower than 1.9 yards a
second and lips out if it is not much faster. Water and out of bounds cost a
stroke: water drops it on dry ground on the near side, out of bounds puts it
back where it was hit. Ten strokes and it is picked up.

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
backspin. The camera goes behind the ball and follows it; a flyover shows
each hole first (`v` shows it again); on the green the camera comes lower and
closer, the distance is in feet, and little marks drift downhill across the
green.

## The wind off the river

Every hole runs north, tee to green, so a compass wind means something:
the latest observation at Portland's airport (api.weather.gov, station
KPDX, no key, CORS open) is fetched when the page loads and when a round
begins, turned from the direction it blows from to the direction it goes,
and laid over every hole's seeded wind (`applyWind`); the HUD marks it PDX
with the compass point. If the fetch fails the holes keep the wind they
grew with. `Golf.wind` is the observation; `Golf.calm()` puts the seeded
wind back.

## Sound

WebAudio, behind the sound toggle and built on the first click, with
`js/unmute.js` for iPhones: a breeze that rises with the wind, the swoosh and
crack of a full swing, the tick of a putt, a thud or a hiss on landing, a
splash, the rattle of the cup, and a crowd for anything under par.

## Controls and state

Drag down and flick up to swing; arrows aim (shift for fine) and choose the
club; `v` flies the hole; `esc` pauses; on a phone there are buttons for aim,
club and the flyover, and a drag across the sky aims. The club is chosen for
you after each shot, the longest that does not overshoot. Best rounds per
course, and the sound setting, are in `localStorage` under `golf`.
`window.Golf` exposes the generator, the ball and a few levers for poking at
in the console, including `Golf.settle()`, which runs a shot to rest at once,
and `Golf.hud(false)`, for a clean picture. The keyboard is the game's only
while the stage is on screen. A light tick on the swing meter marks the
power that reaches the pin with the chosen club, and the aim's ring sits
at the pin when a full swing would fly past it.

## Elsewhere on the site

The city has a links block: one hole in miniature, a clubhouse whose door
is `/golf/`, and the pro, whose errand is a finished round (`localStorage`
`golf.rounds`). The paper's sport page prints the course of the day with
its pars (the names and the par shuffle are mirrored there, by the same
seed) and your best on it. Rickbot answers "golf".
