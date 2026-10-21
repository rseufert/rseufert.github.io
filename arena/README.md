# Arena

An homage to AT-Robots, the DOS game of 1992: write a tank in a small assembly
dialect, pick opponents from the presets, and watch them fight.

| file | what |
| --- | --- |
| `arena-engine.js` | the assembler and the simulation; no page in it, so it runs in the browser, in node and in rickbot's dungeon (UMD) |
| `arena-robots.js` | the ten presets and the starter |
| `arena_lab.js` | duel one tank against another over many seeds: wins, hit rates, aim error, how much it moved |
| `lab/` | not on the roster: the tank that aimed right and fired too slowly, the test that found its rule, the RICK grafts that measured worse; see its README |
| `arena.js` | the page: the canvas, the score panel, the debug view, the editor, saving and sharing |
| `index.html`, `arena.css` | the page and its stylesheet; the dialect reference is at the foot of the page |
| `arena-gauntlet.js` | the gauntlet a tank sent in has to get through; runs in the page and in node |
| `arena_test.js` | the headless test, `node arena/arena_test.js` |
| `tools/tanks.py`, `.github/workflows/tanks.yml` | the tanks sent in, refought and compiled from issues |
| `data/tanks.json` | the sent-in list's fallback copy on master |
| `arena.png`, `share.jpg` | the home tile and the share image |

## Watching

The engine keeps only what the fight needs; the page draws the rest
(`arena.js`, the effects layer). It hooks a match's `hurt` and reads its
log, recording as the engine steps and ageing as frames draw, so it looks
the same at any speed: trails, missile streaks and muzzle flashes, hit
flashes and floating damage, sparks and a lit wall where one was hit,
armor as an arc and heat as the hull warming toward red, scans that linger,
a kill feed, debris and a scorch mark and a wreck where a tank died, a
moment of slow motion on a kill while others still stand, and the winner's
name at the end. The camera shows the whole field, frames whatever is left
of the fight, or follows the selected tank (click one). Sound is behind a
toggle, kept in `localStorage`: shots, hits, walls, kills, and a whine that
rises with the selected tank's heat. The replay slider scrubs the match
back to any tick: a seeded match is the same every time, so it is simply
fought over from the start to that point, in no time at all.

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

## The roster

Two rows: the presets, six ways to fight, and Rick's Rogues, the ones
written to beat them (`groups` in `arena-robots.js`; the page draws a
heading for each).

SENTRY (stands and scans), CIRCLER (orbits and fires), RAMMER (charges),
SNIPER (long scans, overburn), DODGER (sidesteps and stops before walls),
BRICK (wrong on purpose, lasts anyway), RICK (learns: measures its opponents'
drift and lead, and runs a bandit over sitting and driving in 300-tick
spells), JOSH (hurdles: a tight scan-fire loop with stand-and-dash footwork,
tuned to beat RICK and split CIRCLER), DICE (rolls: a random move or shot
each pass), HERON (circles: keeps across the target's line of sight at
five to seven hundred, where their straight shots pass behind it, and
leads its own by the bearing's rate less its own motion's share; it beats
DODGER about always and CIRCLER three times in four, and loses to RAMMER,
which does not aim). The balance is measured headlessly; `arena_test.js`
prints who beats whom over several seeds, and `arena_lab.js` takes one tank
against one opponent apart:

```bash
node arena/arena_lab.js tank.txt circler 20      # or a preset's name in place of the file
```

## Keeping a tank

The editor keeps the last edit on its own (`localStorage`, `arena-robot`).
*Save as* keeps a named copy in the browser (`arena-tanks`, a name to a
program); the select loads one and *delete* drops it. *Export file* downloads
the program as `name.txt` and *import file* reads one back, so a tank can be
kept or passed around outside the browser. *Share link* puts the program in
the address as `#r=` base64; `#preset=name` loads a preset and `#sent=name`
one of the tanks sent in.

## Tanks sent in

A visitor's tank can join the roster if it is good enough. *Send it in* runs
the gauntlet in the page (`arena-gauntlet.js`): a duel against each of the
ten presets over seeds 1 to 4, 40 in all, one a turn so the page keeps up.
The bar is 27 wins without a fault (the starter wins 24, RICK 23, SNIPER 25,
JOSH 30, HERON 31), a `#name` of up to 12 characters that is not a preset's, and a
program under 16 000 characters. A tank that passes is offered a prefilled
GitHub issue titled `tank: NAME` with the program in a code block (or, if
too long for an address, the body goes by the clipboard). `tanks.yml` runs
on issue events and daily: `tools/tanks.py` reads the open `tank:` issues,
takes each program out of its code block, refights it through the same
gauntlet in node, and writes the ones that pass, best record first and one a
name, to `tanks.json` on the `sky-data` branch; the page reads it from
raw.githubusercontent.com, falling back to `data/tanks.json`, and lists
them under the presets with their record and the sender's GitHub name, to
fight or to read. Closing an issue takes a tank out. The programs run only
inside the interpreter, which is bounded, and the page puts names and
programs in as text.
