# The lab

Not on the roster. What was tried on the way to HERON, and to the RICK
that stayed as it was, kept here because it is discussable and because the
next tank may want it.

| file | what |
| --- | --- |
| `lap.txt` | a tank that shoots a circling target where it was a lap ago; aims right, fires too slowly |
| `rules.js` | the offline test that found that rule: four ways to aim at a recorded CIRCLER, scored |
| `circlerq.txt` | CIRCLER with its gun removed, for recording its path and testing aim in peace |
| `shots.js` | a tank's first shots taken apart: turret error, lead applied, lead needed |
| `rick-*.txt` | RICK with one lesson from HERON each; each measured worse than RICK |

## What CIRCLER actually does

Not what its name suggests at first. It drives straight for a hundred
ticks or two, and whenever it is within 120 of a wall it queues 25
degrees of steering a pass. The queue outruns the body's eight degrees a
tick and never drains, so after the first corner it is turning at the
limit for good: a circle of 40 pixels' radius, 45 ticks a lap, at full
speed, with its turret (keepshift) still on you and re-reading the scan
every shot. Sometimes the circle meets the wall and it jitters there at
walking pace instead. No linear lead hits a tank on a 45-tick circle when
the missile takes nine ticks to arrive. `rules.js` shows it:

```
linear         turning 19%   straight 98%
current        turning 21%   straight 93%
centre         turning 30%   straight 91%
period         turning 98%   straight 91%
```

The period rule is "aim where it was 45 ticks before the shot lands".
`lap.txt` does that, with the shots paced so that "a shot ago" is that
moment, and it lands within two degrees. It still lost to the real
CIRCLER, because a pass that scans, converts to field coordinates, keeps
the orbit and does the sums takes 30 to 40 ticks at five instructions a
tick, which is too slow to keep the turret on a target that moves 80
pixels a lap and too slow to trip its own circling test before CIRCLER has
done its damage. HERON, which only dodges and leads linearly from further
away, wins three in four. The way to finish LAP: a sampling loop that
scans and fires and nothing else, every eight ticks, with the sums done in
the gaps between.

## Two things the engine taught, the hard way

`and`, `add` and `sub` do not set the compare flag; only `cmp` does. A
`jne` after an `and` tests whatever the last `cmp` left. Both `and ax, 7`
pass counters and a `sub [26], 1` countdown bit me.

`int @timer` writes `bx` as well as `ax` (the high half of the tick).

## Using it

```bash
node arena/lab/rules.js                                  # the aiming rules against a recorded CIRCLER
node arena/lab/shots.js arena/lab/lap.txt circler 2 20   # LAP's first twenty shots, taken apart
node arena/arena_lab.js arena/lab/lap.txt circler 20     # LAP against CIRCLER over twenty seeds
```
