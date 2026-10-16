#!/usr/bin/env julia
# Chart the walk the strip under the site's menu takes (js/julia-set.js).
#
# The strip is a Julia set, drawn by the visitor's graphics card, zooming
# for ever into one of its fixed points while the parameter c walks a loop
# around the Mandelbrot set. This script, in Julia, works out the loop and
# writes it to js/julia-set.json; the page only has to follow it.
#
# The loop is an equipotential of the Mandelbrot set: every c on it has the
# same potential G(c) = log R, so each one is the same small distance outside
# the set, where its Julia set is a cloud of dust that has only just come
# apart and still shows every spiral and filament. The script finds it by
# Newton's method on z_N(c) = (R e^{2πiθ})^{2^N} - the Böttcher coordinate,
# which turns the outside of the set into the outside of a disc - starting
# far out, where the equipotential is nearly a circle, and following it in.
#
# For each c it tracks the fixed point α = (1 - sqrt(1 - 4c)) / 2 by
# continuity. Going once round the loop swaps the two fixed points, so the
# page walks the loop twice, once with α and once with 1 - α, and the strip
# never repeats itself within twelve minutes. Each view is scored by how much
# there is to see - the entropy of the escape times in the strip's window -
# and the page lingers where it is rich and hurries past where it is plain.
#
#     julia tools/julia_set.jl          # writes js/julia-set.json
#
# No packages. The JSON is written by hand.

const R = 1.01          # potential level; 1 is the set itself
const SAMPLES = 540     # points on the loop
const S0 = 0.11         # half the window's height, in the plane, before the zoom
const ASPECT = 8.7      # the strip's width over its height
const MAXIT = 200       # same as the shader
const TOTAL = 720.0     # seconds for both laps
const OUT = joinpath(@__DIR__, "..", "js", "julia-set.json")

# z_N(c) and dz_N/dc, from z_0 = c, so z_N is the Böttcher coordinate to the 2^N.
function orbit(c, N)
    z = c; dz = one(c)
    for _ in 1:N
        dz = 2z * dz + 1
        z = z * z + c
    end
    z, dz
end

# A depth N at which (R e^{iθ})^{2^N} is big enough to be outside everything
# and small enough to compute: |W| of about ten thousand.
depth(R) = max(1, floor(Int, log2(log(1e4) / log(R))))

target(R, θ, N) = R^(2^N) * cis(2π * mod(θ * 2^N, 1))

function newton(c, W, N)
    for _ in 1:80
        z, dz = orbit(c, N)
        step = (z - W) / dz
        c -= step
        abs(step) < 1e-14 && return c, true
    end
    c, false
end

# From c at angle θa, find the point at θb. z_N(c) = W has 2^N solutions,
# one per turn of θ 2^N, and Newton converges to the nearest, so the step
# between Newton solves has to be a fraction of a turn.
function follow(c, θa, θb, R, N)
    m = ceil(Int, (θb - θa) * 2^N / 0.2)
    for k in 1:m
        θ = θa + (θb - θa) * k / m
        c2, ok = newton(c, target(R, θ, N), N)
        (ok && abs(c2 - c) < 0.03) || error("lost the equipotential near θ = $θ")
        c = c2
    end
    c
end

function equipotential(R, n)
    # Walk in from R = 4, where c ≈ R e^{iθ}, to the level we want, at θ = 0.
    c = 4.0 + 0.0im
    r = 4.0
    while r > R
        r = max(R, r * 0.97)
        c, ok = newton(c, target(r, 0.0, depth(r)), depth(r))
        ok || error("lost the equipotential walking in at R = $r")
    end
    N = depth(R)
    θs = (0:n-1) ./ n
    cs = [c]
    for i in 2:n
        push!(cs, follow(cs[end], θs[i-1], θs[i], R, N))
    end
    back = follow(cs[end], θs[end], 1.0, R, N)
    abs(back - cs[1]) < 1e-9 || error("the loop does not close: $(abs(back - cs[1]))")
    cs
end

# The potential of c, to check the loop: log|z_n| / 2^n once the orbit is far out.
function potential(c)
    z = c
    for n in 1:200
        z = z * z + c
        abs(z) > 1e8 && return log(abs(z)) / 2^n
    end
    0.0
end

# The fixed point nearest the last one; the other is 1 - α.
function fixed_points(cs)
    as = ComplexF64[]
    for c in cs
        a = (1 - sqrt(1 - 4c)) / 2
        if !isempty(as) && abs(a - as[end]) > abs(1 - a - as[end])
            a = 1 - a
        end
        push!(as, a)
    end
    as
end

# How much there is to see in the strip's window around a: the entropy, in
# bits, of the escape times of a grid of points the shape of the strip.
function richness(c, a; w=348, h=40)
    counts = zeros(Int, MAXIT + 1)
    for j in 1:h, i in 1:w
        u = complex(((i - 0.5) / w * 2 - 1) * ASPECT, (j - 0.5) / h * 2 - 1)
        z = a + S0 * u
        n = 0
        while n < MAXIT && abs2(z) < 256
            z = z * z + c
            n += 1
        end
        counts[n + 1] += 1
    end
    -sum(p * log2(p) for p in counts ./ (w * h) if p > 0)
end

function main()
    cs = equipotential(R, SAMPLES)
    G = potential.(cs)
    worst = maximum(abs.(G .- log(R)))
    worst < 1e-6 || error("potential off by $worst")
    as = fixed_points(cs)
    abs(as[end] - (1 - as[1])) < abs(as[end] - as[1]) || error("the fixed points did not swap")
    ra = [richness(c, a) for (c, a) in zip(cs, as)]
    rb = [richness(c, 1 - a) for (c, a) in zip(cs, as)]
    # Dwell goes with the cube of the richness, so the plain views pass quickly.
    weight = vcat(ra, rb) .^ 3
    dwell = weight ./ sum(weight) .* TOTAL
    da, db = dwell[1:SAMPLES], dwell[SAMPLES+1:end]

    f(x) = string(round(x, digits=7))
    rows = [string("[", join(f.([real(c), imag(c), real(a), imag(a)]), ","), ",",
                   join(string.(round.([x, y], digits=4)), ","), "]")
            for (c, a, x, y) in zip(cs, as, da, db)]
    open(OUT, "w") do io
        println(io, "{\"about\": \"c round an equipotential of the Mandelbrot set at R = $R, ",
                "with the fixed point alpha of z^2 + c followed by continuity; ",
                "each row is c, alpha and the seconds to linger there with alpha and with 1 - alpha. ",
                "Written by tools/julia_set.jl.\",")
        println(io, " \"R\": $R, \"s0\": $S0, \"maxit\": $MAXIT,")
        println(io, " \"samples\": [")
        println(io, join("  " .* rows, ",\n"))
        println(io, " ]}")
    end
    println("$(SAMPLES) points on the equipotential at R = $R; potential off by at most $(round(worst, sigdigits=2))")
    println("richness with alpha: $(round(minimum(ra), digits=2)) to $(round(maximum(ra), digits=2)) bits; ",
            "with 1 - alpha: $(round(minimum(rb), digits=2)) to $(round(maximum(rb), digits=2))")
    println("dwell: $(round(minimum(dwell), digits=2)) to $(round(maximum(dwell), digits=2)) s per point, $(TOTAL) s in all")
    println("wrote $(relpath(OUT))")
end

main()
