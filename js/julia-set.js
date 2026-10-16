// The strip under the menu is a Julia set, drawn by the graphics card and
// zooming for ever into one of its fixed points while c, the parameter,
// walks back and forth along an arc round the Mandelbrot set. The arc, and
// the fixed point to zoom into, come from js/julia-set.json, charted by
// tools/julia_set.jl.
//
// The endless zoom: a Julia set is its own image under z -> z^2 + c, so the
// view near a repelling fixed point a looks the same after being pulled
// back through the map, only smaller by lambda = 2a and turned by its
// argument. Each cycle pulls the window back once: the pixel u is sent to
// w = a^2 + lambda^(1-p) s0 u + (1-p) (s0 u)^2, a square at p = 0 and the
// pullback at p = 1, and the iteration starts at w + c, which is what z^2 + c
// makes of either square root of w. Colours shift by one iteration over the
// cycle, so the last frame is the first and the zoom never ends.
//
// Each visit starts somewhere along the walk at random, where the walk
// lingers most likely, in one of a few palettes, and keeps both for the
// visit, so the strip is at the same place on every page but a different
// one next time. A visitor who asked for less motion gets one still frame.
// The strip is a link to /julia/, the same set writ large and steerable.
(function () {
    "use strict";
    var canvas = document.querySelector("canvas.julia");
    if (!canvas) return;
    var gl = canvas.getContext("webgl", {
        alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power"
    });
    var ok = gl && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision >= 23;
    var gone = function () { (canvas.parentNode.tagName === "A" ? canvas.parentNode : canvas).remove(); };
    if (!ok) { gone(); return; }

    var MAXIT = 200;
    var CYCLE = 40;       // seconds per pullback: a slow drift inwards
    var frag = [
        "precision highp float;",
        "uniform vec2 uRes, uC, uA, uLam;",
        "uniform float uS0, uP, uHue;",
        "uniform vec3 uPa, uPb, uPc, uPd;",
        "vec2 mul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }",
        "vec3 pal(float t) { return uPa + uPb * cos(6.2832 * (uPc * t + uPd)); }",
        "void main() {",
        "  vec2 u = uS0 * (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);",
        "  vec2 w = mul(uA, uA) + mul(uLam, u) + (1.0 - uP) * mul(u, u);",
        "  vec2 z = w + uC;",
        "  float n = 1.0, m = dot(z, z);",
        "  for (int i = 0; i < " + MAXIT + "; i++) {",
        "    if (m > 256.0) break;",
        "    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + uC;",
        "    m = dot(z, z); n += 1.0;",
        "  }",
        "  if (m <= 256.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }",
        "  float nu = n - log2(log2(m)) - uP;",
        "  float t = 0.55 * sqrt(max(nu, 0.0)) + uHue;",
        "  vec3 col = pal(t) * (0.35 + 0.65 * smoothstep(0.0, 6.0, nu));",
        "  gl_FragColor = vec4(col, 1.0);",
        "}"
    ].join("\n");
    var vert = "attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }";

    function shader(type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
    }
    var prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, vert));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var p = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ["uRes", "uC", "uA", "uLam", "uS0", "uP", "uHue", "uPa", "uPb", "uPc", "uPd"].forEach(function (name) {
        U[name] = gl.getUniformLocation(prog, name);
    });

    // Palettes, as cosine waves: a + b cos(2 pi (c t + d)), one wave per channel.
    var PALETTES = [
        [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 1.0], [0.00, 0.33, 0.67]],   // rainbow
        [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 0.5], [0.80, 0.90, 0.30]],   // cyan, magenta, acid green
        [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 0.7, 0.4], [0.00, 0.15, 0.20]],   // fire
        [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [2.0, 1.0, 0.0], [0.50, 0.20, 0.25]],   // violet and gold
        [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [2.0, 1.0, 1.0], [0.00, 0.25, 0.25]],   // neon pink and teal
        [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 1.0], [0.00, 0.10, 0.20]]    // sunset
    ];
    // A seventh, the machine elves', for whoever got them home (js/chat.js).
    var ELF = [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 1.0], [0.30, 0.65, 0.15]];
    try { if (localStorage.getItem("elf")) PALETTES.push(ELF); } catch (e) { /* no storage */ }

    function fit() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w; canvas.height = h;
            gl.viewport(0, 0, w, h);
        }
    }

    // The walk: each row of the chart is c, the fixed point a and how long to
    // linger there on the way to the next. The argument of lambda = 2a is
    // unwrapped along the arc so the turning never jumps.
    var legs, total, s0;
    function lay(chart) {
        s0 = chart.s0;
        legs = [];
        var at = 0, arg = 0, last = null;
        chart.samples.forEach(function (row) {
            var raw = Math.atan2(row[3], row[2]);
            if (last !== null) {
                var d = raw - last;
                if (d > Math.PI) d -= 2 * Math.PI;
                if (d < -Math.PI) d += 2 * Math.PI;
                arg += d;
            } else {
                arg = raw;
            }
            last = raw;
            legs.push({ c: [row[0], row[1]], a: [row[2], row[3]], arg: arg, at: at, dwell: row[4] });
            at += row[4];
        });
        total = at - legs[legs.length - 1].dwell;   // the last point is where the walk turns
    }

    function lerp(x, y, f) { return x + (y - x) * f; }

    // Where the walk is at clock time t, in seconds: out along the arc, then back.
    function where(t) {
        var s = t % (2 * total);
        if (s > total) s = 2 * total - s;
        var lo = 0, hi = legs.length - 2;
        while (lo < hi) {
            var mid = (lo + hi + 1) >> 1;
            if (legs[mid].at <= s) lo = mid; else hi = mid - 1;
        }
        var from = legs[lo], to = legs[lo + 1];
        var f = Math.min((s - from.at) / from.dwell, 1);
        return {
            c: [lerp(from.c[0], to.c[0], f), lerp(from.c[1], to.c[1], f)],
            a: [lerp(from.a[0], to.a[0], f), lerp(from.a[1], to.a[1], f)],
            arg: lerp(from.arg, to.arg, f)
        };
    }

    // The visit's start along the walk and its palette, kept for the visit.
    var visit;
    function choose() {
        try { visit = JSON.parse(sessionStorage.getItem("julia")); } catch (e) { visit = null; }
        if (!visit || typeof visit.start !== "number" || !PALETTES[visit.palette]) {
            visit = { start: Math.random() * 2 * total, palette: Math.floor(Math.random() * PALETTES.length) };
            try { sessionStorage.setItem("julia", JSON.stringify(visit)); } catch (e) { /* no storage: a fresh pick each page */ }
        }
        wear(visit.palette);
    }
    function wear(i) {
        var pal = PALETTES[i];
        gl.uniform3fv(U.uPa, pal[0]);
        gl.uniform3fv(U.uPb, pal[1]);
        gl.uniform3fv(U.uPc, pal[2]);
        gl.uniform3fv(U.uPd, pal[3]);
    }
    // The moment the elves go home (js/chat.js), the strip puts on their palette.
    window.addEventListener("elves", function () {
        if (PALETTES.length < 7) PALETTES.push(ELF);
        if (!visit) return;
        visit.palette = 6;
        try { sessionStorage.setItem("julia", JSON.stringify(visit)); } catch (e) { /* no storage */ }
        wear(6);
        if (!playing) draw(clock());
        var link = canvas.parentNode;
        if (!still && link && link.classList) {
            link.classList.add("glitching");
            setTimeout(function () { link.classList.remove("glitching"); }, 1500);
        }
    });

    function draw(t) {
        fit();
        t += visit.start;
        var w = where(t);
        var phase = (t / CYCLE) % 1;
        var mag = Math.pow(2 * Math.hypot(w.a[0], w.a[1]), 1 - phase), ang = w.arg * (1 - phase);
        gl.uniform2f(U.uRes, canvas.width, canvas.height);
        gl.uniform2f(U.uC, w.c[0], w.c[1]);
        gl.uniform2f(U.uA, w.a[0], w.a[1]);
        gl.uniform2f(U.uLam, mag * Math.cos(ang), mag * Math.sin(ang));
        gl.uniform1f(U.uS0, s0);
        gl.uniform1f(U.uP, phase);
        gl.uniform1f(U.uHue, (t / 300) % 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var playing = false, seen = true, raf = 0;
    // Seconds since the strip was first switched on.
    var EPOCH = Date.UTC(2026, 9, 16) / 1000;
    function clock() { return Date.now() / 1000 - EPOCH; }
    function frame() {
        raf = 0;
        if (!playing || !seen) return;
        draw(clock());
        raf = requestAnimationFrame(frame);
    }
    function play(on) {
        playing = on;
        if (on && !raf) raf = requestAnimationFrame(frame);
    }

    fetch("/js/julia-set.json").then(function (r) { return r.json(); }).then(function (chart) {
        lay(chart);
        choose();
        if ("IntersectionObserver" in window) {
            new IntersectionObserver(function (entries) {
                seen = entries[0].isIntersecting;
                if (seen && playing && !raf) raf = requestAnimationFrame(frame);
            }).observe(canvas);
        }
        window.addEventListener("resize", function () { if (!playing) draw(clock()); });
        if (still) { draw(clock()); play(false); } else play(true);
    }, gone);
})();
