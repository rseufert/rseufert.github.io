# Arena

An homage to AT-Robots, the DOS game of 1992: write a tank in a small assembly
dialect, pick opponents from the presets, and watch them fight.

| file | what |
| --- | --- |
| `arena-engine.js` | the assembler and the simulation; no page in it, so it runs in the browser, in node and in rickbot's dungeon (UMD) |
| `arena-robots.js` | the nine presets and the starter |
| `arena.js` | the page: the canvas, the score panel, the debug view, the editor, saving and sharing |
| `index.html`, `arena.css` | the page and its stylesheet; the dialect reference is at the foot of the page |
| `arena_test.js` | the headless test, `node arena/arena_test.js` |
| `arena.png`, `share.jpg` | the home tile and the share image |

## The dialect

Registers `ax bx cx dx`, memory `[n]`, labels `:name`, `#name` and `#config`
lines, and the usual `mov add sub mpy div cmp jmp jls jgr je jne call ret`
plus `ipo`/`opo` for ports and `int` for interrupts. Ports 1–20 include throttle,
steer, rotate, scan arc, scan (7), accuracy (8, kept until the next scan),
fire (15, with an adjust of −4..4 in quarter-arcs), heat, armor and speed. A
`#config` line spends points across scanner, weapon, armor, engine and
heatsinks; each level is a factor of 1 + 0.15·level on that trait.

## The rules

The field is 1000 by 1000, tanks have a radius of 15, each runs 5 instructions
a tick, and a match ends at 12 000 ticks. Missiles fly at 50 a tick with a
spread of ±0.75°, 8 ticks between shots, 15 heat a shot; cooling is
0.5 + 0.3·heatsinks a tick, a tank shuts down at 475 heat (and wakes under
350) and burns at 500. Hitting a wall costs speed²/2 armor; ramming costs 2
every 6 ticks of contact; after tick 3600 everyone wears out by 1 armor every
30 ticks, so a match always ends. Random numbers come from a seeded
generator, so a seed replays a match.

## The presets

SENTRY (stands and scans), CIRCLER (orbits and fires), RAMMER (charges),
SNIPER (long scans, overburn), DODGER (sidesteps and stops before walls),
BRICK (wrong on purpose, lasts anyway), RICK (learns: measures its opponents'
drift and lead, and runs a bandit over sitting and driving in 300-tick
spells), JOSH (hurdles: a tight scan-fire loop with stand-and-dash footwork,
tuned to beat RICK and split CIRCLER), DICE (rolls: a random move or shot
each pass). The balance is measured headlessly; `arena_test.js` prints who
beats whom over several seeds.

## Sharing

The editor saves to `localStorage` (`arena-robot`); `#preset=name` loads a
preset into it, and the share button puts your tank in the address as
`#r=` base64.
