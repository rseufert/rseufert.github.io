// The Julia page: the set under the menu, writ large and steerable.
//
// The picture is the Julia set of c, drawn by the graphics card: each pixel
// runs its own orbit of z -> z^2 + c and is coloured by how long it takes
// to escape, black if it never does. Dragging the picture moves c with
// the pointer, so the set morphs as you pull, and stays where you let go;
// the small map is the Mandelbrot set, c's own plane, and dragging on it
// picks c there. Scrolling or pinching zooms the picture; a click or tap
// with no drag pins the set, so it never wanders off; keys do the same
// (p palette, r start over, arrows nudge c, space pins).
//
// The deeper the zoom, the less of c's plane a view can stand to cross:
// a change that redraws a few lobes at home sweeps everything away at a
// hundred times. So c moves in step with the zoom: the pointer, the
// arrows and the wander all move it slower by the same factor the picture
// is magnified.
//
// Left alone for a while, unless pinned, c eases onto the walk the strip
// follows (js/julia-set.json, charted by tools/julia_set.jl) and wanders
// along it. The palette is the visit's, shared with the strip through
// sessionStorage, and changing it here changes the strip on the other
// pages too. Letting go of a view puts c and the zoom in the address, so
// the link brings it back.
(function () {
    "use strict";
    var stage = document.getElementById("julia-stage");
    var map = document.getElementById("julia-map");
    var readout = document.getElementById("julia-c");
    var buttons = {
        pin: document.getElementById("julia-pin"),
        palette: document.getElementById("julia-palette"),
        reset: document.getElementById("julia-reset")
    };
    if (!stage) return;
    var gl = stage.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false });
    var ok = gl && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision >= 23;
    if (!ok) {
        readout.textContent = "this page needs WebGL, which this browser does not have";
        return;
    }

    var MAXIT = 300;
    var frag = [
        "precision highp float;",
        "uniform vec2 uRes, uC, uCenter;",
        "uniform float uH, uHue;",
        "uniform vec3 uPa, uPb, uPc, uPd;",
        "vec3 pal(float t) { return uPa + uPb * cos(6.2832 * (uPc * t + uPd)); }",
        "void main() {",
        "  vec2 u = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);",
        "  vec2 z = uCenter + uH * u;",
        "  float n = 0.0, m = dot(z, z);",
        "  for (int i = 0; i < " + MAXIT + "; i++) {",
        "    if (m > 256.0) break;",
        "    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + uC;",
        "    m = dot(z, z); n += 1.0;",
        "  }",
        "  if (m <= 256.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }",
        "  float nu = n - log2(log2(m));",
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
    ["uRes", "uC", "uCenter", "uH", "uHue", "uPa", "uPb", "uPc", "uPd"].forEach(function (name) {
        U[name] = gl.getUniformLocation(prog, name);
    });

    // Palettes, as cosine waves: a + b cos(2 pi (c t + d)). The same six as the strip.
    var PALETTES = [
        [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 1.0], [0.00, 0.33, 0.67]],
        [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 0.5], [0.80, 0.90, 0.30]],
        [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 0.7, 0.4], [0.00, 0.15, 0.20]],
        [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [2.0, 1.0, 0.0], [0.50, 0.20, 0.25]],
        [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [2.0, 1.0, 1.0], [0.00, 0.25, 0.25]],
        [[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 1.0], [0.00, 0.10, 0.20]]
    ];
    // A seventh, the machine elves', for whoever got them home (js/chat.js).
    try { if (localStorage.getItem("elf")) PALETTES.push([[0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 1.0], [0.30, 0.65, 0.15]]); } catch (e) { /* no storage */ }
    var visit;
    try { visit = JSON.parse(sessionStorage.getItem("julia")); } catch (e) { visit = null; }
    if (!visit || typeof visit.start !== "number" || !PALETTES[visit.palette]) {
        visit = { start: Math.random() * 3600, palette: Math.floor(Math.random() * PALETTES.length) };
    }
    function keep() {
        try { sessionStorage.setItem("julia", JSON.stringify(visit)); } catch (e) { /* no storage */ }
    }
    function palette(i) {
        visit.palette = (i + PALETTES.length) % PALETTES.length;
        keep();
        var pal = PALETTES[visit.palette];
        gl.uniform3fv(U.uPa, pal[0]);
        gl.uniform3fv(U.uPb, pal[1]);
        gl.uniform3fv(U.uPc, pal[2]);
        gl.uniform3fv(U.uPd, pal[3]);
    }
    palette(visit.palette);

    // The state: c, where c is easing to, the view, and whether it is pinned.
    var HOME = { cx: 0, cy: 0, h: 1.3 };
    var c = [0, 0], target = [0, 0], view = { cx: 0, cy: 0, h: 1.3 };
    var pinned = false, lastInput = -1e9, wandering = false;
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var IDLE = 20;   // seconds without input before c wanders off, unless pinned

    // The map's window on c's plane, and the stage's: the stage is also a
    // map, so moving over it steers c.
    var PLANE = { x0: -2.2, x1: 0.8, y0: -1.25, y1: 1.25 };
    function planeAt(el, ev) {
        var r = el.getBoundingClientRect();
        var x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
        return [PLANE.x0 + (PLANE.x1 - PLANE.x0) * Math.min(Math.max(x, 0), 1),
                PLANE.y1 - (PLANE.y1 - PLANE.y0) * Math.min(Math.max(y, 0), 1)];
    }
    // How far the pointer moved, in c's plane, slowed by the zoom.
    function planeStep(el, ev, prev) {
        var r = el.getBoundingClientRect(), g = gain();
        return [(ev.clientX - prev.clientX) / r.width * (PLANE.x1 - PLANE.x0) * g,
                -(ev.clientY - prev.clientY) / r.height * (PLANE.y1 - PLANE.y0) * g];
    }
    // The factor c moves by: one at home, a tenth at ten times.
    function gain() { return Math.min(view.h / HOME.h, 1); }
    function nudge(dx, dy, now) {
        steer([Math.min(Math.max(target[0] + dx, PLANE.x0), PLANE.x1),
               Math.min(Math.max(target[1] + dy, PLANE.y0), PLANE.y1)], now);
    }
    // Where the pointer is in the Julia set's plane, for zooming about it.
    function viewAt(ev) {
        var r = stage.getBoundingClientRect();
        var u = ((ev.clientX - r.left) / r.width * 2 - 1) * (r.width / r.height);
        var v = 1 - (ev.clientY - r.top) / r.height * 2;
        return [view.cx + view.h * u, view.cy + view.h * v];
    }

    function steer(to, now) {
        target = to;
        lastInput = now;
        wandering = false;
    }
    function pin(on) {
        pinned = on;
        stage.classList.toggle("pinned", on);
        buttons.pin.setAttribute("aria-pressed", on ? "true" : "false");
        buttons.pin.textContent = on ? "pinned" : "pin";
        lastInput = clock();
        wandering = false;
        if (on) remember();
    }

    // Pointer: a drag steers, letting go leaves the set there, a click or
    // tap with no drag pins it, a second finger pinches to zoom.
    var pointers = {}, pinch = null, moved = false;
    stage.addEventListener("pointermove", function (ev) {
        if (!(ev.pointerId in pointers)) return;
        var from = pointers[ev.pointerId];
        pointers[ev.pointerId] = ev;
        moved = true;
        var ids = Object.keys(pointers);
        if (ids.length >= 2) {
            var a = pointers[ids[0]], b = pointers[ids[1]];
            var d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
            var mid = { clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 };
            if (pinch) zoom(pinch / d, mid);
            pinch = d;
            lastInput = clock();
            return;
        }
        if (ids.length === 1) {
            var d = planeStep(stage, ev, from);
            nudge(d[0], d[1], clock());
        }
    });
    stage.addEventListener("pointerdown", function (ev) {
        if (ev.button > 0) return;
        pointers[ev.pointerId] = ev;
        moved = false;
        stage.classList.add("dragging");
        stage.setPointerCapture(ev.pointerId);
    });
    function lift(ev) {
        var was = ev.pointerId in pointers;
        delete pointers[ev.pointerId];
        if (Object.keys(pointers).length < 2) pinch = null;
        if (!Object.keys(pointers).length) stage.classList.remove("dragging");
        if (!was) return;
        lastInput = clock();
        if (ev.type === "pointerup" && !moved) pin(!pinned);
        else remember();
    }
    stage.addEventListener("pointerup", lift);
    stage.addEventListener("pointercancel", lift);
    stage.addEventListener("wheel", function (ev) {
        ev.preventDefault();
        zoom(Math.exp(ev.deltaY * (ev.deltaMode === 1 ? 0.05 : 0.002)), ev);
        lastInput = clock();
        remember();
    }, { passive: false });
    function zoom(factor, ev) {
        var at = viewAt(ev);
        var h = Math.min(Math.max(view.h * factor, 0.0002), 2.5);
        factor = h / view.h;
        view.cx = at[0] + (view.cx - at[0]) * factor;
        view.cy = at[1] + (view.cy - at[1]) * factor;
        view.h = h;
    }

    // The map: a click or a drag picks c there.
    map.addEventListener("pointerdown", function (ev) {
        if (ev.button > 0) return;
        map.setPointerCapture(ev.pointerId);
        steer(planeAt(map, ev), clock());
        map.dragging = true;
    });
    map.addEventListener("pointermove", function (ev) { if (map.dragging) steer(planeAt(map, ev), clock()); });
    function mapUp() { if (map.dragging) { map.dragging = false; lastInput = clock(); remember(); } }
    map.addEventListener("pointerup", mapUp);
    map.addEventListener("pointercancel", mapUp);

    buttons.pin.addEventListener("click", function () { pin(!pinned); });
    buttons.palette.addEventListener("click", function () { palette(visit.palette + 1); });
    buttons.reset.addEventListener("click", reset);
    document.addEventListener("keydown", function (ev) {
        if (ev.target.tagName === "INPUT" || ev.target.tagName === "TEXTAREA" || ev.metaKey || ev.ctrlKey || ev.altKey) return;
        var step = 0.004 * gain(), now = clock(), k = ev.key;
        if (k === "p") palette(visit.palette + 1);
        else if (k === "r") reset();
        else if (k === " " || k === "h") pin(!pinned);
        else if (k === "+" || k === "=") zoom(1 / 1.3, centre());
        else if (k === "-" || k === "_") zoom(1.3, centre());
        else if (k === "ArrowLeft") nudge(-step, 0, now);
        else if (k === "ArrowRight") nudge(step, 0, now);
        else if (k === "ArrowUp") nudge(0, step, now);
        else if (k === "ArrowDown") nudge(0, -step, now);
        else return;
        ev.preventDefault();
        if (k[0] === "A" || k === "+" || k === "=" || k === "-" || k === "_") remember();
    });
    function centre() {
        var r = stage.getBoundingClientRect();
        return { clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
    }
    function reset() {
        view = { cx: HOME.cx, cy: HOME.cy, h: HOME.h };
        pin(false);
        lastInput = -1e9;
        if (history.replaceState) history.replaceState(null, "", location.pathname);
    }

    // The address holds c and the view once the visitor has set them, until
    // the set wanders off again.
    var remembered = 0;
    function remember() {
        if (!history.replaceState) return;
        clearTimeout(remembered);
        remembered = setTimeout(function () {
            if (wandering) return;
            var hash = "#c=" + target[0].toFixed(6) + "," + target[1].toFixed(6);
            if (view.h !== HOME.h || view.cx || view.cy) {
                hash += "&v=" + view.cx.toFixed(6) + "," + view.cy.toFixed(6) + "," + view.h.toPrecision(4);
            }
            history.replaceState(null, "", hash);
        }, 300);
    }
    function recall() {
        var m = /c=(-?[\d.]+),(-?[\d.]+)/.exec(location.hash);
        if (!m) return false;
        c = target = [+m[1], +m[2]];
        var v = /v=(-?[\d.]+),(-?[\d.]+),([\d.e-]+)/.exec(location.hash);
        if (v) view = { cx: +v[1], cy: +v[2], h: Math.min(Math.max(+v[3], 0.0002), 2.5) };
        pin(true);
        return true;
    }

    // The walk, for wandering: the same chart the strip follows.
    var legs = null, total = 0;
    function lay(chart) {
        legs = [];
        var at = 0;
        chart.samples.forEach(function (row) {
            legs.push({ c: [row[0], row[1]], at: at, dwell: row[4] });
            at += row[4];
        });
        total = at - legs[legs.length - 1].dwell;
    }
    function walk(t) {
        var s = t % (2 * total);
        if (s > total) s = 2 * total - s;
        var lo = 0, hi = legs.length - 2;
        while (lo < hi) {
            var mid = (lo + hi + 1) >> 1;
            if (legs[mid].at <= s) lo = mid; else hi = mid - 1;
        }
        var from = legs[lo], to = legs[lo + 1], f = Math.min((s - from.at) / from.dwell, 1);
        return [from.c[0] + (to.c[0] - from.c[0]) * f, from.c[1] + (to.c[1] - from.c[1]) * f];
    }

    // The map: the Mandelbrot set, drawn once, and a dot for c.
    var mctx = map.getContext("2d"), mimage = null;
    function drawMap() {
        var w = map.width, h = map.height, img = mctx.createImageData(w, h);
        for (var j = 0; j < h; j++) {
            for (var i = 0; i < w; i++) {
                var cr = PLANE.x0 + (PLANE.x1 - PLANE.x0) * (i + 0.5) / w;
                var ci = PLANE.y1 - (PLANE.y1 - PLANE.y0) * (j + 0.5) / h;
                var zr = 0, zi = 0, n = 0;
                while (n < 80 && zr * zr + zi * zi < 4) {
                    var t = zr * zr - zi * zi + cr;
                    zi = 2 * zr * zi + ci; zr = t; n++;
                }
                var k = (j * w + i) * 4, v = n === 80 ? 24 : 60 + Math.min(n, 30) * 5;
                img.data[k] = v; img.data[k + 1] = v; img.data[k + 2] = v; img.data[k + 3] = 255;
            }
        }
        mimage = img;
    }
    function dot() {
        mctx.putImageData(mimage, 0, 0);
        var x = (c[0] - PLANE.x0) / (PLANE.x1 - PLANE.x0) * map.width;
        var y = (PLANE.y1 - c[1]) / (PLANE.y1 - PLANE.y0) * map.height;
        mctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#0ff";
        mctx.lineWidth = 1.5;
        mctx.beginPath();
        mctx.arc(x, y, 4, 0, 2 * Math.PI);
        mctx.stroke();
    }

    // Drawing. The canvas follows its CSS size at the device's pixel ratio,
    // capped, and drops to one pixel per CSS pixel if frames come slow.
    var scale = Math.min(window.devicePixelRatio || 1, 1.5), slow = 0;
    function fit() {
        var w = Math.round(stage.clientWidth * scale), h = Math.round(stage.clientHeight * scale);
        if (stage.width !== w || stage.height !== h) {
            stage.width = w; stage.height = h;
            gl.viewport(0, 0, w, h);
        }
    }
    var EPOCH = Date.UTC(2026, 9, 16) / 1000;
    function clock() { return Date.now() / 1000 - EPOCH; }
    // The wander keeps its own clock, which runs slower the deeper the zoom.
    var last = null, walkT = null;
    function draw(now) {
        var dt = last === null ? 0 : Math.min(now - last, 0.1);
        last = now;
        if (!pinned && !wandering && legs && now - lastInput > IDLE && !still) {
            wandering = true;
            if (walkT === null) walkT = visit.start + now;
            if (history.replaceState && location.hash) history.replaceState(null, "", location.pathname);
        }
        if (wandering) {
            walkT += dt * gain();
            target = walk(walkT);
        }
        var rate = wandering ? 0.6 : 10;
        var f = still ? 1 : 1 - Math.exp(-rate * dt);
        c[0] += (target[0] - c[0]) * f;
        c[1] += (target[1] - c[1]) * f;
        fit();
        gl.uniform2f(U.uRes, stage.width, stage.height);
        gl.uniform2f(U.uC, c[0], c[1]);
        gl.uniform2f(U.uCenter, view.cx, view.cy);
        gl.uniform1f(U.uH, view.h);
        gl.uniform1f(U.uHue, still ? 0 : (now / 300) % 1);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        readout.textContent = "c = " + c[0].toFixed(4) + (c[1] < 0 ? " − " : " + ") + Math.abs(c[1]).toFixed(4) + "i" +
            (view.h !== HOME.h ? "   ×" + (HOME.h / view.h).toPrecision(3) : "");
        dot();
    }

    var seen = true, raf = 0, frames = 0, since = 0;
    function frame(ms) {
        raf = 0;
        if (!seen) return;
        var t0 = performance.now();
        draw(clock());
        if (scale > 1) {
            since += performance.now() - t0;
            if (++frames === 30) {
                if (since / 30 > 24) { scale = 1; slow++; }
                frames = 0; since = 0;
            }
        }
        raf = requestAnimationFrame(frame);
    }
    if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
            seen = entries[0].isIntersecting;
            if (seen && !raf) raf = requestAnimationFrame(frame);
        }).observe(stage);
    }

    drawMap();
    if (!recall()) {
        c = target = [-0.7269, 0.1889];
    }
    fetch("/js/julia-set.json").then(function (r) { return r.json(); }).then(lay, function () { legs = null; });
    raf = requestAnimationFrame(frame);
})();
