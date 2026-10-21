# Julia

The strip under the menu on every page, and the page you get by clicking it:
a Julia set, drawn by the visitor's graphics card, zooming for ever.

| file | what |
| --- | --- |
| `julia-set.js` | the strip: WebGL, loaded by the layout on every page |
| `julia-set.json` | the walk the strip takes, charted by `tools/julia_set.jl` |
| `index.html`, `julia.js`, `julia.css` | the page: the same set, steerable |
| `share.jpg` | the share image |

## The strip

Every point *c* of the plane names a Julia set: the *z* that never escape
under *z* → *z*² + *c*. The strip picks a *c* just outside the Mandelbrot set,
where the picture is richest, and zooms into one of the set's fixed points
while *c* walks slowly back and forth along an arc round the set.

The zoom is a pullback: rather than rendering an ever-smaller window, the
shader maps the window through the fixed point's local coordinate,
`w = a² + λ^(1-p)·s₀u + (1-p)(s₀u)²`, so the view stays sharp at any depth and
one cycle (`CYCLE`, 40 s) joins seamlessly to the next. The walk itself is in
`julia-set.json`: a list of legs with a *c*, a fixed point, its multiplier and
a dwell. `tools/julia_set.jl` charts it: it follows an equipotential just
outside the set (Newton's method on the Böttcher coordinate, with the step
kept under 1/2^N so it cannot hop sheets) from the cusp at θ = 0 to just
short of the needle at θ ≈ 0.43, tracks a fixed point along it, scores each
view by how much of the strip is near the set (escape time ≥ 8), and gives
the rich stretches most of the time: the dwell goes as richness squared, 1800 s
each way.

Each visit starts somewhere along the walk at random, in one of six palettes,
and keeps both in `sessionStorage` (`julia`), so the strip is at the same place
on every page and different next time. It listens for the chat's `elves` event
and wears the elves' palette once `localStorage.elf` is set. A visitor who asked
for less motion gets a still frame. Its CSS (`a.julia`, `canvas.julia`) is in
`css/main.css`, because the layout owns the strip.

```bash
julia tools/julia_set.jl            # recharts julia-set.json; no packages needed
```

## The page

`julia.js` draws the same set full width and lets you steer. A drag moves *c*,
by less the deeper you are zoomed (the step is scaled by `gain()`, the view's
height over the home view's, so the picture changes at the same rate on screen
at any depth). Scrolling or pinching zooms. A click pins the set; letting go
puts *c* and the view in the address (`#c=…&v=…`) so the link brings it back.
Left alone for 20 s it wanders the strip's walk on its own clock. The small
map is the Mandelbrot set; click or drag on it to put *c* anywhere.
