// Golf on rickseufert.com (golf/index.html).
//
// Nine holes in phosphor, a course of the day grown from the date: tee,
// fairway, rough, sand, water, a green with a tilt to it and a flag on a
// pin. The swing is the arcade cabinet's trackball, done with a mouse or a
// thumb: pull back for the backswing, push forward to hit, and the straighter
// the push the straighter the ball. While it is in the air you can still lean
// on it, a little: left and right bend it, back pulls it up on the green.
//
// Drawn the way the backrooms are drawn: every patch of ground is a quad in
// world space, filled black and stroked in its colour, painted from far to
// near, which is how a wireframe keeps the far side of a hill behind it.
// No WebGL, no libraries. Distances are in yards, time in seconds.
(function () {
    "use strict";
    var canvas = document.getElementById("golf-stage");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var stage = canvas.parentNode;
    var veil = document.getElementById("golf-veil");
    var veilText = document.getElementById("golf-veil-text");
    var veilCard = document.getElementById("golf-veil-card");
    var go = document.getElementById("golf-go");
    var soundButton = document.getElementById("golf-sound");
    var fullButton = document.getElementById("golf-full");
    var unfillButton = document.getElementById("golf-unfill");
    var newButton = document.getElementById("golf-new");
    var scoreOut = document.getElementById("golf-score");
    var pads = document.getElementById("golf-pads");
    var boardButton = document.getElementById("golf-board"), muzakButton = document.getElementById("golf-muzak"), postLink = document.getElementById("golf-post"), veilBoard = document.getElementById("golf-veil-board");
    var RAW = "https://raw.githubusercontent.com/rseufert/rseufert.github.io/sky-data/";

    var KEY = "golf";
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace';
    var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var TOUCH = window.matchMedia && matchMedia("(hover: none) and (pointer: coarse)").matches;

    var NEAR = 0.3;            // the near plane, in yards
    var FOV = 64 * Math.PI / 180;
    var FOG = 270;             // yards; the far lines fade to nothing here
    var G = 10.7;              // gravity, in yards a second a second
    var COARSE = 6;            // the ground's grid, in yards
    var FINE = 2;              // the green's grid
    var CUP = 0.075;           // the cup's radius, a little generous, as arcades are
    var HOLES = 9;
    var WIND_ACC = 0.2;        // yards/s² of push per mile an hour
    var SIDE_ACC = 7;          // how hard a full hook or slice bends
    var PUTT_MAX = 6.2;        // yards a second at full putt: about 33 yards on a flat green

    // Clubs: what each carries at full power from a good lie, and its loft.
    var CLUBS = [
        { id: "DR", name: "driver", carry: 245, loft: 12 },
        { id: "3W", name: "3 wood", carry: 220, loft: 15 },
        { id: "3I", name: "3 iron", carry: 195, loft: 20 },
        { id: "5I", name: "5 iron", carry: 175, loft: 26 },
        { id: "7I", name: "7 iron", carry: 152, loft: 33 },
        { id: "9I", name: "9 iron", carry: 128, loft: 41 },
        { id: "PW", name: "pitching wedge", carry: 105, loft: 47 },
        { id: "SW", name: "sand wedge", carry: 78, loft: 56 },
        { id: "PT", name: "putter", carry: 0, loft: 0 }
    ];
    var PUTTER = CLUBS.length - 1;

    // What each lie does: how much of a full shot it lets out, bounce, grab, and roll.
    var LIE = {
        tee:     { label: "tee",     take: 1.00, bounce: 0.38, grab: 0.18, roll: 1.6 },
        fairway: { label: "fairway", take: 1.00, bounce: 0.36, grab: 0.20, roll: 1.6 },
        fringe:  { label: "fringe",  take: 0.97, bounce: 0.30, grab: 0.25, roll: 1.2 },
        green:   { label: "green",   take: 1.00, bounce: 0.26, grab: 0.30, roll: 0.55 },
        rough:   { label: "rough",   take: 0.85, bounce: 0.22, grab: 0.45, roll: 4.2 },
        deep:    { label: "trees",   take: 0.62, bounce: 0.16, grab: 0.60, roll: 7.0 },
        sand:    { label: "sand",    take: 0.70, bounce: 0.05, grab: 0.88, roll: 12 },
        water:   { label: "water",   take: 0,    bounce: 0,    grab: 1,    roll: 99 },
        ob:      { label: "out of bounds", take: 0, bounce: 0.2, grab: 0.5, roll: 6 }
    };
    var INK = {
        tee: "#e8ffe0", fairway: "#4dff7a", fringe: "#86ec6a", green: "#bfff6e", rough: "#22a64a",
        deep: "#15702f", sand: "#ffd36b", water: "#46b4ff", ob: "#0d4a20", tree: "#35d06c",
        flag: "#ff4646", pole: "#f2f2f2", ball: "#ffffff", gold: "#ffcc33", aim: "#ffcc33"
    };
    var NAMES = ["Forest Park", "Willamette Bend", "Mount Tabor", "Burnside Links", "Sauvie Island",
        "Tryon Creek", "Rocky Butte", "Pittock Heights", "Laurelhurst", "Johnson Creek", "Powell Butte",
        "Kelley Point"];

    // ---- the record --------------------------------------------------------
    var saved = load();
    function load() {
        var s = null;
        try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
        s = s || {};
        return { sound: s.sound !== false, muzak: !!s.muzak, best: s.best || {}, rounds: s.rounds || 0, squatch: s.squatch || 0, hood: s.hood || 0 };
    }
    function save() { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* a visit's worth */ } }

    // The course of the day comes from the date, so everyone plays the same
    // nine today; #seed=N plays any other.
    function today() {
        var d = new Date();
        return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    }
    function hashSeed() {
        var m = /seed=(\d+)/.exec(location.hash);
        return m ? +m[1] : 0;
    }

    // ---- randomness and noise ---------------------------------------------
    function rng(seed) {
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            var t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function lattice(ix, iz, s) {
        var h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(s, 2246822519);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    function noise(x, z, s) {
        var ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
        var u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
        var a = lattice(ix, iz, s), b = lattice(ix + 1, iz, s), c = lattice(ix, iz + 1, s), d = lattice(ix + 1, iz + 1, s);
        return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v - 0.5;
    }
    function fbm(x, z, s) {
        return noise(x, z, s) + 0.5 * noise(x * 2.03, z * 2.03, s + 17) + 0.25 * noise(x * 4.1, z * 4.1, s + 31);
    }

    // ---- the course --------------------------------------------------------
    // generate(seed, n) is deterministic: hole n of seed s is the same hole
    // every time. A hole is a bent line from the tee to the green, and every
    // patch of ground is classified by how far it is from that line.
    function generate(seed, n) {
        var r = rng(seed * 7919 + n * 104729 + 1), i;
        var par = parsOf(seed)[n];
        var len = par === 3 ? 135 + r() * 80 : par === 4 ? 335 + r() * 110 : 470 + r() * 90;
        var bend = par === 3 ? (r() - 0.5) * 16 : (r() < 0.5 ? -1 : 1) * (18 + r() * (par === 5 ? 50 : 38));
        var gx = (r() - 0.5) * (par === 3 ? 20 : 40) + bend * 0.5;
        var H = { seed: seed, n: n, par: par, s: Math.floor(r() * 100000) };
        H.p0 = { x: 0, z: 0 };
        H.p1 = { x: bend, z: len * (0.5 + r() * 0.15) };
        H.p2 = { x: gx, z: len };
        // The centre line, sampled.
        H.line = [];
        for (i = 0; i <= 80; i++) {
            var u = i / 80, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
            H.line.push({ x: a * H.p0.x + b * H.p1.x + c * H.p2.x, z: a * H.p0.z + b * H.p1.z + c * H.p2.z, t: u });
        }
        H.length = 0;
        for (i = 1; i < H.line.length; i++) H.length += Math.hypot(H.line[i].x - H.line[i - 1].x, H.line[i].z - H.line[i - 1].z);
        H.fw = 14 + r() * 7;                                         // fairway half width
        H.fwStart = par === 3 ? 0.62 : 0.12 + r() * 0.06;            // where the fairway begins, as a fraction of the line
        H.cw = H.fw + 30 + r() * 12;                                 // rough out to here
        H.ob = H.cw + 16;                                            // trees, then out of bounds
        // The green: an ellipse at the end of the line, turned to face the approach.
        var e = H.line[H.line.length - 1], pe = H.line[H.line.length - 5];
        H.gdir = Math.atan2(e.x - pe.x, e.z - pe.z);
        H.green = { x: e.x, z: e.z, rx: 12 + r() * 6, rz: 13 + r() * 7 };
        var pa = r() * Math.PI * 2, pr = 0.25 + r() * 0.45;
        H.pin = { x: H.green.x + Math.cos(pa) * H.green.rx * pr, z: H.green.z + Math.sin(pa) * H.green.rz * pr };
        var sa = r() * Math.PI * 2, sm = 0.01 + r() * 0.016;
        H.tilt = { x: Math.cos(sa) * sm, z: Math.sin(sa) * sm };       // the green's slope, yards per yard
        // Sand: one or two where a drive lands, one or two by the green.
        H.bunkers = [];
        if (par > 3) {
            var land = Math.min(0.85, 245 / H.length), k = 1 + (r() < 0.5 ? 1 : 0);
            for (i = 0; i < k; i++) {
                var q = pointAt(H, land + (r() - 0.5) * 0.08), side = r() < 0.5 ? -1 : 1;
                H.bunkers.push({ x: q.x + q.nx * side * (H.fw + 3 + r() * 6), z: q.z + q.nz * side * (H.fw + 3 + r() * 6), r: 6 + r() * 4 });
            }
        }
        var gb = 1 + Math.floor(r() * 2);
        for (i = 0; i < gb; i++) {
            var ga = H.gdir + Math.PI * (0.35 + r() * 0.9) * (r() < 0.5 ? -1 : 1);
            var gr = Math.max(H.green.rx, H.green.rz) + 4;
            H.bunkers.push({ x: H.green.x + Math.sin(ga) * gr, z: H.green.z + Math.cos(ga) * gr, r: 5 + r() * 3 });
        }
        // Water: a creek across the line, or a pond beside it, or neither.
        H.water = null;
        var w = r();
        if (par > 3 && w < 0.35) {
            var ct = 0.32 + r() * 0.22, cp = pointAt(H, ct);
            H.water = { kind: "creek", x: cp.x, z: cp.z, nx: cp.nx, nz: cp.nz, w: 6 + r() * 4, wob: r() * 10 };
        } else if (w < 0.7) {
            var pt = par === 3 ? 0.55 + r() * 0.3 : 0.45 + r() * 0.4, pp = pointAt(H, pt), ps = r() < 0.5 ? -1 : 1, off = H.fw + 10 + r() * 14;
            H.water = { kind: "pond", x: pp.x + pp.nx * ps * off, z: pp.z + pp.nz * ps * off, r: 14 + r() * 12 };
        }
        // The ground's own lie, before the course is cut into it.
        H.waterLevel = H.water ? rawHeight(H, H.water.x, H.water.z) - 0.6 : -99;
        H.greenBase = rawHeight(H, H.green.x, H.green.z) + 0.4;
        H.teeBase = rawHeight(H, 0, -4) + 0.5;
        // Trees in the rough's far edge and beyond.
        H.trees = [];
        var tr = rng(H.s + 77);
        for (i = 0; i < 260; i++) {
            var tt = -0.05 + tr() * 1.1, tp = pointAt(H, Math.max(0, Math.min(1, tt))), ts = tr() < 0.5 ? -1 : 1;
            var tdst = H.cw - 6 + tr() * (H.ob - H.cw + 24);
            var tx = tp.x + tp.nx * ts * tdst, tz = tp.z + tp.nz * ts * tdst + (tt < 0 ? tt * H.length : tt > 1 ? (tt - 1) * H.length : 0);
            var kind = classify(H, tx, tz);
            if (kind !== "rough" && kind !== "deep" && kind !== "ob") continue;
            H.trees.push({ x: tx, z: tz, h: 8 + tr() * 8, r: 2.5 + tr() * 2.5 });
            if (H.trees.length >= 120) break;
        }
        H.wind = { mph: Math.round(r() * 16), dir: r() * Math.PI * 2 };
        H.name = NAMES[seed % NAMES.length];
        build(H);
        return H;
    }
    // Par 36: five fours, two threes and two fives, in an order from the seed.
    function parsOf(seed) {
        var pars = [4, 4, 3, 5, 4, 3, 4, 5, 4], order = rng(seed * 31 + 5);
        for (var i = pars.length - 1; i > 0; i--) { var j = Math.floor(order() * (i + 1)), t = pars[i]; pars[i] = pars[j]; pars[j] = t; }
        return pars;
    }
    function pointAt(H, t) {
        var f = Math.max(0, Math.min(1, t)) * (H.line.length - 1), i = Math.min(H.line.length - 2, Math.floor(f)), a = H.line[i], b = H.line[i + 1], u = f - i;
        var dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
        return { x: a.x + dx * u, z: a.z + dz * u, nx: dz / l, nz: -dx / l, dx: dx / l, dz: dz / l };
    }
    // Distance from the centre line, and how far along it.
    function along(H, x, z) {
        var best = Infinity, bt = 0;
        for (var i = 0; i < H.line.length - 1; i++) {
            var a = H.line[i], b = H.line[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
            var u = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
            var px = a.x + dx * u - x, pz = a.z + dz * u - z, d = px * px + pz * pz;
            if (d < best) { best = d; bt = (i + u) / (H.line.length - 1); }
        }
        return { d: Math.sqrt(best), t: bt };
    }
    function inGreen(H, x, z, grow) {
        var c = Math.cos(H.gdir), s = Math.sin(H.gdir), dx = x - H.green.x, dz = z - H.green.z;
        var lx = dx * c - dz * s, lz = dx * s + dz * c;
        var g = grow || 1;
        return (lx * lx) / (H.green.rx * H.green.rx * g * g) + (lz * lz) / (H.green.rz * H.green.rz * g * g) <= 1;
    }
    function inWater(H, x, z) {
        var W = H.water;
        if (!W) return false;
        if (W.kind === "pond") {
            var a = Math.atan2(z - W.z, x - W.x), rr = W.r * (1 + 0.18 * Math.sin(a * 3 + W.r) + 0.1 * Math.sin(a * 5));
            return Math.hypot(x - W.x, z - W.z) < rr;
        }
        // A creek: a band across the hole, wandering a little.
        var dx = x - W.x, dz = z - W.z, acrossT = dx * W.nx + dz * W.nz, alongT = dx * -W.nz + dz * W.nx;
        return Math.abs(alongT - Math.sin(acrossT / 18 + W.wob) * 4) < W.w / 2;
    }
    function classify(H, x, z) {
        if (inWater(H, x, z)) return "water";
        for (var i = 0; i < H.bunkers.length; i++) {
            var b = H.bunkers[i], a = Math.atan2(z - b.z, x - b.x);
            if (Math.hypot(x - b.x, z - b.z) < b.r * (1 + 0.2 * Math.sin(a * 2 + b.r))) return "sand";
        }
        if (inGreen(H, x, z, 1)) return "green";
        if (inGreen(H, x, z, 1.28)) return "fringe";
        if (Math.abs(x) < 6 && z > -12 && z < 4) return "tee";
        var p = along(H, x, z);
        var beyond = Math.hypot(x - H.p2.x, z - H.p2.z);
        if (p.t > 0.995 && beyond > Math.max(H.green.rx, H.green.rz) + 40) return "ob";
        if (z < -20) return "ob";
        if (p.d < H.fw * (p.t > 0.9 ? 0.8 : 1) && p.t >= H.fwStart) return "fairway";
        if (p.d < H.cw) return "rough";
        if (p.d < H.ob) return "deep";
        return "ob";
    }
    function rawHeight(H, x, z) {
        return fbm(x / 110, z / 110, H.s) * 14 + fbm(x / 34, z / 34, H.s + 3) * 2.4;
    }
    // The ground, as the ball and the eye find it.
    function height(H, x, z) {
        var h = rawHeight(H, x, z);
        // The tee box is a flat platform.
        var td = Math.max(Math.abs(x) - 6, z - 4, -12 - z);
        if (td < 6) { var tk = Math.max(0, Math.min(1, td / 6)); h = H.teeBase * (1 - tk) + h * tk; }
        // The green is a tilted plane with a little roll in it, blended into the ground round it.
        var gd = greenDist(H, x, z);
        if (gd < 1.6) {
            var plane = H.greenBase + H.tilt.x * (x - H.green.x) + H.tilt.z * (z - H.green.z) + fbm(x / 9, z / 9, H.s + 9) * 0.22;
            var gk = gd <= 1 ? 0 : (gd - 1) / 0.6;
            gk = gk * gk * (3 - 2 * gk);
            h = plane * (1 - gk) + h * gk;
        }
        // Bunkers are bowls.
        for (var i = 0; i < H.bunkers.length; i++) {
            var b = H.bunkers[i], d = Math.hypot(x - b.x, z - b.z) / (b.r * 1.15);
            if (d < 1) h -= 1.1 * (1 - d * d);
        }
        if (H.water && inWater(H, x, z)) h = Math.min(h, H.waterLevel);
        return h;
    }
    function greenDist(H, x, z) {
        var c = Math.cos(H.gdir), s = Math.sin(H.gdir), dx = x - H.green.x, dz = z - H.green.z;
        var lx = dx * c - dz * s, lz = dx * s + dz * c;
        return Math.sqrt((lx * lx) / (H.green.rx * H.green.rx) + (lz * lz) / (H.green.rz * H.green.rz));
    }
    function normal(H, x, z) {
        var e = 0.25, hx = (height(H, x + e, z) - height(H, x - e, z)) / (2 * e), hz = (height(H, x, z + e) - height(H, x, z - e)) / (2 * e);
        var l = Math.hypot(hx, 1, hz);
        return { x: -hx / l, y: 1 / l, z: -hz / l, gx: hx, gz: hz };
    }

    // The ground as quads: a coarse grid over the whole hole, and a fine one over the green.
    function build(H) {
        var minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity, i;
        for (i = 0; i < H.line.length; i++) {
            minx = Math.min(minx, H.line[i].x); maxx = Math.max(maxx, H.line[i].x);
            minz = Math.min(minz, H.line[i].z); maxz = Math.max(maxz, H.line[i].z);
        }
        var pad = H.ob + 12;
        H.box = { x0: Math.floor((minx - pad) / COARSE) * COARSE, x1: Math.ceil((maxx + pad) / COARSE) * COARSE, z0: -36, z1: Math.ceil((maxz + 60) / COARSE) * COARSE };
        H.cells = [];
        var gr = Math.max(H.green.rx, H.green.rz) * 1.4 + 4;
        H.fineBox = { x0: Math.floor((H.green.x - gr) / COARSE) * COARSE, x1: Math.ceil((H.green.x + gr) / COARSE) * COARSE, z0: Math.floor((H.green.z - gr) / COARSE) * COARSE, z1: Math.ceil((H.green.z + gr) / COARSE) * COARSE };
        grid(H, H.box, COARSE, H.cells, H.fineBox);
        H.fine = [];
        grid(H, H.fineBox, FINE, H.fine, null);
        map(H);
    }
    function grid(H, box, step, out, hole) {
        var nx = Math.round((box.x1 - box.x0) / step), nz = Math.round((box.z1 - box.z0) / step), x, z;
        var hs = [];
        for (z = 0; z <= nz; z++) for (x = 0; x <= nx; x++) hs.push(height(H, box.x0 + x * step, box.z0 + z * step));
        for (z = 0; z < nz; z++) {
            for (x = 0; x < nx; x++) {
                var x0 = box.x0 + x * step, z0 = box.z0 + z * step, cx = x0 + step / 2, cz = z0 + step / 2;
                if (hole && cx > hole.x0 && cx < hole.x1 && cz > hole.z0 && cz < hole.z1) continue;
                var kind = classify(H, cx, cz);
                var i0 = z * (nx + 1) + x;
                out.push({
                    kind: kind, cx: cx, cz: cz, cy: (hs[i0] + hs[i0 + 1] + hs[i0 + nx + 1] + hs[i0 + nx + 2]) / 4,
                    p: [[x0, hs[i0], z0], [x0 + step, hs[i0 + 1], z0], [x0 + step, hs[i0 + nx + 2], z0 + step], [x0, hs[i0 + nx + 1], z0 + step]]
                });
            }
        }
    }
    // The hole from above, drawn once, for the corner of the screen.
    function map(H) {
        var c = document.createElement("canvas"), b = H.box, sx = (b.x1 - b.x0), sz = (b.z1 - b.z0);
        var scale = Math.min(96 / sx, 170 / sz);
        c.width = Math.ceil(sx * scale) + 8; c.height = Math.ceil(sz * scale) + 8;
        var m = c.getContext("2d");
        function px(x) { return 4 + (x - b.x0) * scale; }
        function pz(z) { return c.height - 4 - (z - b.z0) * scale; }
        var all = H.cells.concat(H.fine);
        for (var i = 0; i < all.length; i++) {
            var q = all[i];
            if (q.kind === "ob") continue;
            var s = (q.p[1][0] - q.p[0][0]) * scale;
            m.fillStyle = INK[q.kind];
            m.globalAlpha = q.kind === "rough" ? 0.22 : q.kind === "deep" ? 0.12 : 0.75;
            m.fillRect(px(q.p[0][0]), pz(q.p[0][2]) - s, s + 0.5, s + 0.5);
        }
        H.mapCanvas = c; H.mapPx = px; H.mapPz = pz;
    }

    // ---- the wind off the river ------------------------------------------------
    // Every hole here runs north, tee to green, so a compass wind means
    // something: the latest observation at the airport (api.weather.gov,
    // KPDX, no key) blows across the course of the day when it can be had,
    // and the HUD says so. Otherwise each hole keeps the wind it grew with.
    var live = null;
    function fetchWind() {
        if (!window.fetch) return;
        fetch("https://api.weather.gov/stations/KPDX/observations/latest", { headers: { Accept: "application/geo+json" } })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) {
                var p = j && j.properties; if (!p || p.windSpeed == null || p.windSpeed.value == null) return;
                var kmh = p.windSpeed.value, from = p.windDirection && p.windDirection.value;
                if (/km_h/.test(p.windSpeed.unitCode || "")) kmh = kmh; else if (/m_s/.test(p.windSpeed.unitCode || "")) kmh *= 3.6; else if (/kn/.test(p.windSpeed.unitCode || "")) kmh *= 1.852;
                var mph = Math.round(kmh * 0.621371);
                // the game's direction is where the wind goes, from north round by east; the airport's is where it comes from
                live = { mph: mph, dir: from == null ? 0 : ((from + 180) % 360) * Math.PI / 180, from: from, when: p.timestamp ? new Date(p.timestamp) : null };
                if (mph === 0 || from == null) live.dir = 0;
                if (hole) applyWind(hole);
                if (audio && hole) audio.wind(hole.wind.mph);
            }).catch(function () { /* the course keeps its own wind */ });
    }
    function applyWind(H) { if (live) { H.wind = { mph: live.mph, dir: live.dir, live: true }; } }
    function compass(deg) { return ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"][Math.round(deg / 22.5) % 16]; }

    // ---- state -------------------------------------------------------------
    var W = 0, Hpx = 0, DPR = 1, f = 1, slow = false;
    var seed = hashSeed() || today();
    var hole = null, holeNo = 0, scores = [], strokes = 0;
    var mode = "title", modeClock = 0, clock = 0;
    var cam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, cy: 1, sy: 0, cp: 1, sp: 0 };
    var ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rolling: false, lie: "tee", side: 0, back: 0, from: null, flight: 0, lastDry: null, bounces: 0 };
    var aim = 0, club = 0, message = "", messageClock = 0, shotNote = "";
    var swing = null;          // a gesture in progress
    var meter = null;          // the keyboard's three presses
    var english = 0;           // what is left of the lean you may put on a ball in the air
    var trail = [];
    var paused = false;
    var showHud = true;        // Golf.hud(false) in the console, for a clean picture
    var flags = [];            // what happened this round: sq4, hood6
    var holeClock = 0;         // seconds on this hole
    var squatch = null, squatchAt = -1;        // something in the trees
    var HOOD = { bearing: 1.95, erupting: false, t: 0, at: -1, erupted: false, hole: 0, ash: [] };   // the mountain, east by south

    function startRound() {
        holeNo = 0; scores = []; flags = [];
        HOOD.erupting = false; HOOD.erupted = false; HOOD.t = 0; HOOD.ash = [];
        startHole();
    }
    function startHole() {
        hole = generate(seed, holeNo);
        applyWind(hole);
        holeClock = 0; squatch = null;
        // Something in the trees, some holes, a while in; and the mountain, once a round if at all (#hood asks for it).
        squatchAt = Math.random() < 0.2 ? 8 + Math.random() * 45 : -1;
        HOOD.at = !HOOD.erupted && (Math.random() < 0.06 || (/\bhood\b/.test(location.hash) && holeNo === 0)) ? 4 + Math.random() * 25 : -1;
        strokes = 0;
        ball.x = 0; ball.z = 0; ball.y = height(hole, 0, 0); ball.lie = "tee";
        ball.vx = ball.vy = ball.vz = 0; ball.rolling = false;
        trail = [];
        aim = aimAtPin();
        club = pickClub();
        mode = "flyover"; modeClock = 0;
        message = "HOLE " + (holeNo + 1) + "  PAR " + hole.par + "  " + Math.round(yardsToPin()) + " YDS"; messageClock = 0;
        updateScore();
    }
    function aimAtPin() {
        // Aim at the pin if it is in reach, else down the middle of the hole.
        var dp = yardsToPin();
        var reach = CLUBS[0].carry * 1.05;
        if (dp <= reach) return Math.atan2(hole.pin.x - ball.x, hole.pin.z - ball.z);
        var a = along(hole, ball.x, ball.z), t = a.t, step = 0.005;
        while (t < 1) {
            t += step;
            var p = pointAt(hole, t);
            if (Math.hypot(p.x - ball.x, p.z - ball.z) >= reach * 0.9) return Math.atan2(p.x - ball.x, p.z - ball.z);
        }
        return Math.atan2(hole.pin.x - ball.x, hole.pin.z - ball.z);
    }
    function yardsToPin() { return Math.hypot(hole.pin.x - ball.x, hole.pin.z - ball.z); }
    function pickClub() {
        if (ball.lie === "green") return PUTTER;
        var d = yardsToPin(), take = LIE[ball.lie] ? LIE[ball.lie].take || 1 : 1;
        if (ball.lie === "fringe" && d < 14) return PUTTER;
        for (var i = PUTTER - 1; i >= 0; i--) {
            if (ball.lie !== "tee" && i === 0 && PUTTER > 1) continue;     // the driver only off a tee
            if (CLUBS[i].carry * take >= d * 0.92) return i;
        }
        return ball.lie === "tee" ? 0 : 1;
    }

    // ---- the swing ---------------------------------------------------------
    // A full club: v chosen so that the carry on flat ground with no wind is
    // the club's number, found once by trying.
    var launchSpeed = CLUBS.map(function (c) {
        if (!c.carry) return 0;
        var lo = 20, hi = 160;
        for (var k = 0; k < 30; k++) {
            var mid = (lo + hi) / 2;
            if (carryOf(mid, c.loft) < c.carry) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
    });
    function carryOf(v, loftDeg) {
        var a = loftDeg * Math.PI / 180, x = 0, y = 0, vx = v * Math.cos(a), vy = v * Math.sin(a), dt = 1 / 120;
        for (var t = 0; t < 20; t += dt) {
            var k = 0.0016 * Math.hypot(vx, vy);
            vx -= vx * k * dt; vy -= vy * k * dt; vy -= G * dt;
            x += vx * dt; y += vy * dt;
            if (y < 0 && vy < 0) return x;
        }
        return x;
    }
    function strike(power, side) {
        var c = CLUBS[club];
        ball.from = { x: ball.x, y: ball.y, z: ball.z, lie: ball.lie };
        ball.lastDry = { x: ball.x, z: ball.z };
        strokes++;
        updateScore();
        if (club === PUTTER) {
            var v = Math.max(0.05, power) * PUTT_MAX * (ball.lie === "green" ? 1 : 1.25);
            var push = side * 0.06;
            ball.vx = v * Math.sin(aim + push); ball.vz = v * Math.cos(aim + push); ball.vy = 0;
            ball.rolling = true; ball.side = 0; ball.back = 0;
            if (audio) audio.putt(power);
        } else {
            var take = LIE[ball.lie].take || 1;
            if (c.id === "SW" && ball.lie === "sand") take = 0.92;
            var p = Math.max(0.05, power);
            var over = Math.max(0, p - 1);
            var v0 = launchSpeed[club] * Math.sqrt(Math.min(1.1, p) * take);
            var loft = c.loft * Math.PI / 180 * (ball.lie === "rough" || ball.lie === "deep" ? 0.9 : 1);
            var s = side * (1 + over * 8);
            var dir = aim + s * 0.035;                         // a push or a pull at the start
            var h = v0 * Math.cos(loft);
            ball.vx = h * Math.sin(dir); ball.vz = h * Math.cos(dir); ball.vy = v0 * Math.sin(loft);
            ball.rolling = false; ball.side = s; ball.back = 0.25 + (c.loft / 56) * 0.35;
            if (audio) audio.thwack(p);
        }
        ball.flight = 0; ball.bounces = 0; ball.lipped = false;
        english = club === PUTTER ? 0 : 1;
        trail = [];
        mode = "flight"; modeClock = 0;
        shotNote = "";
    }

    // ---- the ball in the world ---------------------------------------------
    function step(dt) {
        ball.flight += dt;
        if (!ball.rolling) {
            // In the air: gravity, a little drag, the wind, and the curve.
            var sp = Math.hypot(ball.vx, ball.vy, ball.vz), k = 0.0016 * sp;
            ball.vx -= ball.vx * k * dt; ball.vy -= ball.vy * k * dt; ball.vz -= ball.vz * k * dt;
            ball.vy -= G * dt;
            var wa = hole.wind.mph * WIND_ACC;
            ball.vx += Math.sin(hole.wind.dir) * wa * dt; ball.vz += Math.cos(hole.wind.dir) * wa * dt;
            var hs = Math.hypot(ball.vx, ball.vz) || 1, curve = ball.side * SIDE_ACC * Math.max(0, 1 - ball.flight / 5);
            var rx = ball.vz / hs, rz = -ball.vx / hs;                  // to the right of the flight
            ball.vx += rx * curve * dt; ball.vz += rz * curve * dt;
            ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
            if (inCup() && ball.vy < 0 && ball.y < height(hole, ball.x, ball.z) + 0.3 && Math.hypot(ball.vx, ball.vz) < 9) return holed(true);
            var gh = height(hole, ball.x, ball.z);
            if (ball.y <= gh) contact(gh);
            else if (classify(hole, ball.x, ball.z) !== "water") ball.lastDry = { x: ball.x, z: ball.z };
        } else {
            roll(dt);
        }
        if (ball.x < hole.box.x0 || ball.x > hole.box.x1 || ball.z < hole.box.z0 || ball.z > hole.box.z1) return outOfBounds();
    }
    function inCup() { return Math.hypot(ball.x - hole.pin.x, ball.z - hole.pin.z) < CUP; }
    function contact(gh) {
        var kind = classify(hole, ball.x, ball.z);
        ball.y = gh;
        if (kind === "water") return splash();
        if (kind === "ob") return outOfBounds();
        var L = LIE[kind], n = normal(hole, ball.x, ball.z);
        var vn = ball.vx * n.x + ball.vy * n.y + ball.vz * n.z;
        if (audio && ball.bounces === 0) audio.land(kind, Math.min(1, -vn / 20));
        if (vn < -2.2 && kind !== "sand") {
            // A bounce: off the slope, losing some to the ground and some to its grip.
            var tx = ball.vx - vn * n.x, ty = ball.vy - vn * n.y, tz = ball.vz - vn * n.z;
            var keep = 1 - L.grab;
            if (ball.bounces === 0 && (kind === "green" || kind === "fringe" || kind === "fairway")) keep -= ball.back * (kind === "green" ? 1.7 : 0.9);
            ball.vx = tx * keep - vn * L.bounce * n.x; ball.vy = ty * keep - vn * L.bounce * n.y; ball.vz = tz * keep - vn * L.bounce * n.z;
            ball.y = gh + 0.01;
            ball.bounces++;
            ball.side *= 0.3;
        } else {
            // Down for good: it rolls from here, if it rolls at all.
            var keep2 = kind === "sand" ? 0.04 : 1 - L.grab * 0.7;
            if (ball.bounces === 0 && kind === "green") keep2 -= ball.back * 1.2;
            ball.vx = (ball.vx - vn * n.x) * keep2; ball.vz = (ball.vz - vn * n.z) * keep2; ball.vy = 0;
            ball.rolling = true;
        }
    }
    function roll(dt) {
        var kind = classify(hole, ball.x, ball.z);
        if (kind === "water") return splash();
        if (kind === "ob") return outOfBounds();
        var L = LIE[kind], n = normal(hole, ball.x, ball.z);
        var sp = Math.hypot(ball.vx, ball.vz);
        // Downhill pull of a rolling ball (5/7 of g along the slope), and the grass holding it back.
        var ax = -G * (5 / 7) * n.gx, az = -G * (5 / 7) * n.gz;
        var pull = Math.hypot(ax, az);
        if (sp < 0.08 && pull < L.roll * 0.9) { stop(); return; }
        if (sp > 0) { ax -= ball.vx / sp * L.roll; az -= ball.vz / sp * L.roll; }
        var nvx = ball.vx + ax * dt, nvz = ball.vz + az * dt;
        if (sp > 0 && nvx * ball.vx + nvz * ball.vz < 0 && pull < L.roll) { stop(); return; }
        ball.vx = nvx; ball.vz = nvz;
        ball.x += ball.vx * dt; ball.z += ball.vz * dt;
        ball.y = height(hole, ball.x, ball.z);
        if (kind !== "water") ball.lastDry = { x: ball.x, z: ball.z };
        // The cup: slow enough and it drops; too fast and it lips out.
        var d = Math.hypot(ball.x - hole.pin.x, ball.z - hole.pin.z);
        if (d < CUP) {
            var v = Math.hypot(ball.vx, ball.vz);
            if (v < 1.9) return holed(false);
            if (v < 3.2 && !ball.lipped) {
                ball.lipped = true;
                var turn = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), c = Math.cos(turn), s = Math.sin(turn);
                var vx = ball.vx * c - ball.vz * s, vz = ball.vx * s + ball.vz * c;
                ball.vx = vx * 0.55; ball.vz = vz * 0.55;
                if (audio) audio.lip();
                note("LIP OUT");
            }
        } else if (d > CUP * 3) ball.lipped = false;
        if (ball.flight > 40) stop();
    }
    function stop() {
        ball.vx = ball.vy = ball.vz = 0; ball.rolling = false;
        ball.lie = classify(hole, ball.x, ball.z);
        ball.y = height(hole, ball.x, ball.z);
        mode = "rest"; modeClock = 0;
        var c = CLUBS[club];
        if (ball.from && c.carry) {
            var dist = Math.hypot(ball.x - ball.from.x, ball.z - ball.from.z);
            shotNote = Math.round(dist) + " YDS · " + LIE[ball.lie].label.toUpperCase();
        } else shotNote = LIE[ball.lie].label.toUpperCase();
        if (strokes >= 10) {
            note("PICKED UP");
            finishHole(10);
        }
    }
    function splash() {
        if (audio) audio.splash();
        note("WATER · +1");
        strokes++;
        var d = ball.lastDry || ball.from;
        // Drop on dry ground on the near side of where it went in.
        var bx = d.x, bz = d.z, back = Math.atan2(ball.from.x - bx, ball.from.z - bz);
        for (var k = 0; k < 40 && (classify(hole, bx, bz) === "water" || classify(hole, bx, bz) === "ob"); k++) { bx += Math.sin(back) * 1.5; bz += Math.cos(back) * 1.5; }
        place(bx, bz);
    }
    function outOfBounds() {
        if (audio) audio.thud();
        note("OUT OF BOUNDS · +1");
        strokes++;
        place(ball.from.x, ball.from.z);
    }
    function place(x, z) {
        ball.x = x; ball.z = z; ball.y = height(hole, x, z);
        ball.vx = ball.vy = ball.vz = 0; ball.rolling = false;
        ball.lie = classify(hole, x, z);
        updateScore();
        mode = "rest"; modeClock = 0; shotNote = LIE[ball.lie].label.toUpperCase();
        if (strokes >= 10) { note("PICKED UP"); finishHole(10); }
    }
    function holed(dunk) {
        ball.x = hole.pin.x; ball.z = hole.pin.z; ball.y = height(hole, ball.x, ball.z) - 0.1;
        ball.vx = ball.vy = ball.vz = 0; ball.rolling = false;
        if (audio) audio.cup(dunk);
        finishHole(strokes);
    }
    function finishHole(n) {
        scores[holeNo] = n;
        var diff = n - hole.par;
        if (n === 1) flag("ace" + (holeNo + 1));
        var word = n === 1 ? "HOLE IN ONE" : diff <= -3 ? "ALBATROSS" : diff === -2 ? "EAGLE" : diff === -1 ? "BIRDIE" : diff === 0 ? "PAR" : diff === 1 ? "BOGEY" : diff === 2 ? "DOUBLE BOGEY" : "+" + diff;
        if (n >= 10 && diff > 2) word = "PICKED UP";
        message = word; messageClock = 0;
        if (audio && diff < 0) audio.cheer(-diff);
        mode = "holed"; modeClock = 0;
        updateScore();
    }
    function note(t) { message = t; messageClock = 0; }
    function flag(f) { if (flags.indexOf(f) < 0) flags.push(f); }
    function total() { var s = 0; for (var i = 0; i < scores.length; i++) s += scores[i] || 0; return s; }
    function parSoFar() { var p = 0, pars = parsOf(seed); for (var i = 0; i < scores.length; i++) if (scores[i] != null) p += pars[i]; return p; }
    function toPar(n) { return n === 0 ? "E" : n > 0 ? "+" + n : String(n); }
    function updateScore() {
        if (!hole) { scoreOut.textContent = ""; return; }
        var done = scores.filter(function (s) { return s; }).length;
        scoreOut.textContent = hole.name + " · hole " + (holeNo + 1) + " of " + HOLES + (done ? " · " + toPar(total() - parSoFar()) : "");
    }
    function card() {
        var rows = "<table class=\"card\"><tr><th>hole</th>", r2 = "<tr><th>par</th>", r3 = "<tr><th>you</th>", i, p = 0, pars = parsOf(seed);
        for (i = 0; i < HOLES; i++) {
            var hp = pars[i]; p += hp;
            rows += "<td>" + (i + 1) + "</td>";
            r2 += "<td>" + hp + "</td>";
            var s = scores[i], cls = s == null ? "" : s < hp ? " class=\"under\"" : s > hp ? " class=\"over\"" : "";
            r3 += "<td" + cls + ">" + (s == null ? "" : s) + "</td>";
        }
        var t = total();
        rows += "<td>out</td></tr>"; r2 += "<td>" + p + "</td></tr>"; r3 += "<td>" + t + "</td></tr>";
        return rows + r2 + r3 + "</table>";
    }
    function endRound() {
        var t = total(), p = parSoFar(), best = saved.best[seed];
        var newBest = best == null || t < best;
        if (newBest) saved.best[seed] = t;
        saved.rounds++;
        var keys = Object.keys(saved.best);
        if (keys.length > 60) delete saved.best[keys.sort()[0]];
        save();
        mode = "card";
        veil.hidden = false;
        veilText.textContent = hole.name + ": " + t + " (" + toPar(t - p) + ")" + (newBest ? (best == null ? ", your first round on this course." : ", your best here.") : ". Your best here is " + best + ".") + happened();
        veilCard.innerHTML = card();
        veilCard.hidden = false;
        go.textContent = "play again";
        if (postLink) {
            var line = "gc1:" + seed + ":" + t + ":" + scores.map(function (x) { return x || 10; }).join(",") + ":" + (flags.length ? flags.join(",") : "-");
            var body = "course: " + hole.name + "\nseed: " + seed + "\ntotal: " + t + " (" + toPar(t - p) + ")\nholes: " + scores.join(" ") + "\n\n```\n" + line + "\n```\n\nPosted from rickseufert.com/golf/#seed=" + seed + ". Keep the code block as it is; a workflow reads open issues titled \"card:\" onto the clubhouse board, a player's best on each course. It is an honour system, like the one in the clubhouse. Closing the issue takes the card down.";
            postLink.href = "https://github.com/rseufert/rseufert.github.io/issues/new?title=" + encodeURIComponent("card: " + t + " on " + hole.name + " (" + seed + ")") + "&body=" + encodeURIComponent(body);
            postLink.hidden = false;
        }
        showBoard(seed, t);
    }
    function happened() {
        var bits = flags.map(function (f) { var m = /^(sq|hood|ace)(\d)$/.exec(f); return !m ? "" : m[1] === "sq" ? "Something tall crossed the trees on hole " + m[2] + "." : m[1] === "hood" ? "Mt Hood erupted on hole " + m[2] + "." : "A hole in one at the " + m[2] + "th."; });
        return bits.length ? " " + bits.join(" ") : "";
    }

    // ---- the clubhouse board ------------------------------------------------
    // The cards posted as issues, compiled onto the sky-data branch by
    // tools/cards.py: each player's best on each course. Fetched once, shown
    // under the card at the end of a round and from the bar.
    var board = null;
    function fetchBoard() {
        if (!window.fetch) return;
        fetch(RAW + "cards.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { if (j && j.cards) { board = j.cards; if (!veil.hidden && veilBoard && !veilBoard.hidden) showBoard(seed); } }).catch(function () { board = null; });
    }
    function esc(x) { return String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function boardHtml(forSeed, mine) {
        if (!board) return "<p class=\"small\">the board has not come down from the clubhouse; it is read from the sky-data branch, once.</p>";
        var here = board.filter(function (c) { return c.seed === forSeed; }).sort(function (a, b) { return a.total - b.total || (a.when < b.when ? -1 : 1); });
        var name = NAMES[forSeed % NAMES.length], out = "<h3>THE BOARD · " + esc(name.toUpperCase()) + (forSeed === today() ? " · TODAY" : " · " + forSeed) + "</h3>";
        if (!here.length) out += "<p class=\"small\">nobody has posted a card on this course" + (mine != null ? "; yours would be the first" : "") + ". an honour system, like the one in the clubhouse.</p>";
        else {
            out += "<table class=\"board\">";
            here.slice(0, 10).forEach(function (c, i) { out += "<tr><td>" + (i + 1) + "</td><th>" + esc(c.by) + "</th><td>" + c.total + "</td><td class=\"" + (c.toPar < 0 ? "under" : c.toPar > 0 ? "over" : "") + "\">" + toPar(c.toPar) + "</td><td class=\"flags\">" + c.flags.map(function (f) { return /^sq/.test(f) ? "<span title=\"sasquatch, hole " + f.slice(2) + "\">S</span>" : /^hood/.test(f) ? "<span title=\"mt hood erupted, hole " + f.slice(4) + "\">▲</span>" : /^ace/.test(f) ? "<span title=\"a hole in one\">1</span>" : ""; }).join(" ") + "</td><td class=\"when\">" + esc(c.when) + "</td></tr>"; });
            out += "</table>";
            if (mine != null) { var place = here.filter(function (c) { return c.total < mine; }).length + 1; out += "<p class=\"small\">your " + mine + " would stand " + place + (place === 1 ? "st" : place === 2 ? "nd" : place === 3 ? "rd" : "th") + " of " + (here.length + 1) + ", if you post it.</p>"; }
        }
        var anywhere = board.slice().sort(function (a, b) { return a.toPar - b.toPar || a.total - b.total; }).slice(0, 5);
        if (anywhere.length) out += "<p class=\"small\">best anywhere: " + anywhere.map(function (c) { return esc(c.by) + " " + toPar(c.toPar) + " on " + esc(c.course); }).join(" · ") + ".</p>";
        return out;
    }
    function showBoard(forSeed, mine) {
        if (!veilBoard) return;
        veilBoard.innerHTML = boardHtml(forSeed, mine);
        veilBoard.hidden = false;
    }
    function openBoard() {   // from the bar: the board over the game, paused
        if (mode !== "title" && mode !== "card" && !paused) { paused = true; go.textContent = "play on"; veilText.textContent = "paused on " + hole.name + ", hole " + (holeNo + 1) + "."; veilCard.innerHTML = card(); veilCard.hidden = false; }
        veil.hidden = false;
        showBoard(seed, mode === "card" ? total() : null);
    }

    // ---- input -------------------------------------------------------------
    // The trackball, with a mouse or a thumb: press, pull back, push forward.
    // How far back sets the most the shot can have; how fast forward decides
    // how much of it you get; how crooked forward bends it.
    function pointerDown(e) {
        if (mode === "title" || mode === "card") return;
        if (mode === "flyover") { endFlyover(); return; }
        if (mode === "holed" && modeClock > 0.6) { nextHole(); return; }
        if (mode === "rest") { if (modeClock > 0.3) readyToHit(); return; }
        if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* a pointer already gone */ } }
        if (mode === "flight") { swing = { id: e.pointerId, x: e.clientX, y: e.clientY, lean: true }; return; }
        if (mode !== "aim") return;
        var r = canvas.getBoundingClientRect();
        if (e.clientY - r.top < Hpx * 0.28) { swing = { id: e.pointerId, x: e.clientX, y: e.clientY, aiming: true, a0: aim }; return; }
        swing = { id: e.pointerId, x0: e.clientX, y0: e.clientY, back: 0, phase: "back", pts: [{ x: e.clientX, y: e.clientY, t: performance.now() }] };
        meter = null;
    }
    function pointerMove(e) {
        if (!swing || e.pointerId !== swing.id) return;
        if (swing.aiming) { aim = swing.a0 + (e.clientX - swing.x) * 0.004; return; }
        if (swing.lean) {
            // A lean on a ball in the air, from a budget of one.
            if (english <= 0) return;
            var dx = (e.clientX - swing.x) / (Hpx * 0.5), dy = (e.clientY - swing.y) / (Hpx * 0.5);
            var use = Math.min(english, Math.abs(dx) + Math.abs(dy));
            if (use > 0) {
                ball.side += dx * 0.9; ball.back += dy * 0.8;
                ball.side = Math.max(-1.6, Math.min(1.6, ball.side)); ball.back = Math.max(-0.4, Math.min(1.1, ball.back));
                english -= use;
            }
            swing.x = e.clientX; swing.y = e.clientY;
            return;
        }
        var now = performance.now();
        swing.pts.push({ x: e.clientX, y: e.clientY, t: now });
        if (swing.pts.length > 40) swing.pts.shift();
        var down = e.clientY - swing.y0;
        if (swing.phase === "back") {
            if (down > swing.back) swing.back = down;
            if (swing.back > 18 && down < swing.back - 24) { swing.phase = "fwd"; swing.fx = e.clientX; swing.fy = e.clientY; swing.ft = now; swing.from = swing.pts[swing.pts.length - 1]; }
        }
        if (swing.phase === "fwd" && e.clientY < swing.y0 - 6) release();
    }
    function pointerUp(e) {
        if (!swing || e.pointerId !== swing.id) return;
        if (swing.phase === "fwd") release(); else swing = null;
    }
    function release() {
        var s = swing; swing = null;
        var pts = s.pts, a = pts[Math.max(0, pts.length - 6)], b = pts[pts.length - 1];
        var dt = Math.max(8, b.t - a.t) / 1000, speed = (a.y - b.y) / dt;          // pixels a second, upward
        var reach = backReach();
        var backFrac = Math.min(1.1, s.back / reach);
        var p;
        if (club === PUTTER) p = backFrac;
        else p = backFrac * Math.max(0.45, Math.min(1.08, speed / (Hpx * 2.2)));
        // Crooked: how far the push leaned off straight up.
        var fx = s.from || a, ang = Math.atan2(b.x - fx.x, (fx.y - b.y) || 1);
        var side = Math.max(-1, Math.min(1, ang / 0.32));
        if (Math.abs(side) < 0.08) side = 0;
        strike(p, side);
    }
    function backReach() { return Math.max(90, Hpx * 0.36); }
    function readyToHit() {
        if (mode !== "rest") return;
        aim = aimAtPin();
        club = pickClub();
        mode = "aim"; modeClock = 0;
    }
    function nextHole() {
        if (holeNo + 1 >= HOLES) return endRound();
        holeNo++;
        startHole();
    }
    function endFlyover() { mode = "aim"; modeClock = 0; }

    // The keyboard: arrows aim and choose the club; space is three presses,
    // start, power, and where the needle stops on the line.
    var keys = {};
    function keyDown(e) {
        var k = e.key;
        if (mode === "title" || mode === "card") return;
        if (k === "Escape") { togglePause(); return; }
        if (paused) return;
        if (k === " " || k === "Enter") {
            e.preventDefault();
            if (mode === "flyover") return endFlyover();
            if (mode === "holed" && modeClock > 0.6) return nextHole();
            if (mode === "rest") return readyToHit();
            if (mode !== "aim") return;
            if (!meter) meter = { phase: 1, v: 0, dir: 1, power: 0 };
            else if (meter.phase === 1) { meter.power = meter.v; meter.phase = 2; meter.dir = -1; }
            else if (meter.phase === 2) { var side = Math.max(-1, Math.min(1, meter.v / 0.09)); var pw = meter.power; meter = null; strike(pw, Math.abs(side) < 0.12 ? 0 : side); }
            return;
        }
        if (k === "ArrowLeft" || k === "ArrowRight" || k === "a" || k === "d" || k === "ArrowUp" || k === "ArrowDown" || k === "w" || k === "s") e.preventDefault();
        if (mode === "aim" && !meter) {
            if (k === "ArrowUp" || k === "w") club = Math.max(0, club - 1);
            if (k === "ArrowDown" || k === "s") club = Math.min(PUTTER, club + 1);
            if (k === "v" || k === "V") { mode = "flyover"; modeClock = 0; }
        }
        keys[k] = true;
    }
    function keyUp(e) { keys[e.key] = false; }
    function keyAim(dt) {
        var turn = (keys.ArrowLeft || keys.a ? -1 : 0) + (keys.ArrowRight || keys.d ? 1 : 0);
        if (!turn) return;
        if (mode === "aim" && !meter) aim += turn * dt * (club === PUTTER ? 0.25 : 0.6) * (keys.Shift ? 0.25 : 1);
        if (mode === "flight" && english > 0) { var use = Math.min(english, dt * 0.9); ball.side += turn * use * 1.4; english -= use; }
    }
    function togglePause() {
        if (mode === "title" || mode === "card") return;
        paused = !paused;
        veil.hidden = !paused;
        veilText.textContent = "paused on " + hole.name + ", hole " + (holeNo + 1) + ".";
        veilCard.innerHTML = card(); veilCard.hidden = false;
        if (veilBoard) veilBoard.hidden = true;
        go.textContent = "play on";
    }

    // ---- the camera --------------------------------------------------------
    function setCam(x, y, z, yaw, pitch) {
        cam.x = x; cam.y = y; cam.z = z; cam.yaw = yaw; cam.pitch = pitch;
        cam.sy = Math.sin(yaw); cam.cy = Math.cos(yaw); cam.sp = Math.sin(pitch); cam.cp = Math.cos(pitch);
    }
    var follow = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, ready: false };
    function placeCamera(dt) {
        var tx, ty, tz, tyaw, tpitch;
        if (mode === "title") {
            var w = (clock / 9) % 1, a0 = pointAt(hole, w), a1 = pointAt(hole, Math.min(1, w + 0.15));
            tx = a0.x - a0.dx * 20 + Math.sin(clock * 0.3) * 8; tz = a0.z - a0.dz * 20; ty = height(hole, a0.x, a0.z) + 30;
            setCam(tx, ty, tz, Math.atan2(a1.x - tx, a1.z - tz), Math.atan2(ty - height(hole, a1.x, a1.z), Math.hypot(a1.x - tx, a1.z - tz)));
            follow.ready = false;
            return;
        }
        if (mode === "flyover") {
            var u = Math.min(1, modeClock / 5), e = u * u * (3 - 2 * u);
            var p = pointAt(hole, Math.min(1, e * 1.02)), q = pointAt(hole, Math.min(1, e + 0.18));
            var gh = height(hole, p.x, p.z);
            tx = p.x - p.dx * 30; tz = p.z - p.dz * 30; ty = gh + 42 - e * 24;
            tyaw = Math.atan2(q.x - tx, q.z - tz);
            tpitch = Math.atan2(ty - height(hole, q.x, q.z), Math.hypot(q.x - tx, q.z - tz));
            setCam(tx, ty, tz, tyaw, tpitch); follow.ready = false;
            if (modeClock > 5.4) endFlyover();
            return;
        }
        var gy = height(hole, ball.x, ball.z);
        if (mode === "flight") {
            var hs = Math.hypot(ball.vx, ball.vz);
            var dir = hs > 0.5 ? Math.atan2(ball.vx, ball.vz) : follow.yaw;
            var back = ball.rolling ? 6 : 13;
            tyaw = dir;
            tx = ball.x - Math.sin(dir) * back; tz = ball.z - Math.cos(dir) * back;
            ty = Math.max(height(hole, tx, tz) + 2, ball.y + (ball.rolling ? 2.6 : 4));
            tpitch = Math.atan2(ty - ball.y, back) * 0.8;
        } else {
            var putt = club === PUTTER || ball.lie === "green";
            var dist = putt ? 4.5 : 7, up = putt ? 2.2 : 2.6;
            tyaw = aim;
            tx = ball.x - Math.sin(aim) * dist; tz = ball.z - Math.cos(aim) * dist;
            ty = Math.max(gy, height(hole, tx, tz)) + up;
            var look = putt ? Math.min(20, yardsToPin() + 3) : 60;
            var ahead = height(hole, ball.x + Math.sin(aim) * look, ball.z + Math.cos(aim) * look);
            tpitch = Math.atan2(ty - ahead, look + dist) + (putt ? 0.06 : 0.02);
        }
        if (!follow.ready) { follow.x = tx; follow.y = ty; follow.z = tz; follow.yaw = tyaw; follow.pitch = tpitch; follow.ready = true; }
        var k = 1 - Math.exp(-dt * (mode === "flight" ? 4.5 : 6));
        follow.x += (tx - follow.x) * k; follow.y += (ty - follow.y) * k; follow.z += (tz - follow.z) * k;
        var dy = tyaw - follow.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
        follow.yaw += dy * k; follow.pitch += (tpitch - follow.pitch) * k;
        var shake = HOOD.erupting && HOOD.t < 7 ? (7 - HOOD.t) / 7 * 0.004 : 0;
        setCam(follow.x, follow.y, follow.z, follow.yaw + (shake ? (Math.random() - 0.5) * shake * 4 : 0), follow.pitch + (shake ? (Math.random() - 0.5) * shake : 0));
    }
    function toCam(x, y, z, out) {
        var dx = x - cam.x, dy = y - cam.y, dz = z - cam.z;
        var rx = dx * cam.cy - dz * cam.sy, fz = dx * cam.sy + dz * cam.cy;
        out.x = rx; out.y = dy * cam.cp + fz * cam.sp; out.z = fz * cam.cp - dy * cam.sp;
        return out;
    }
    function clipNear(pts) {
        var out = [];
        for (var i = 0; i < pts.length; i++) {
            var a = pts[i], b = pts[(i + 1) % pts.length], ain = a.z >= NEAR, bin = b.z >= NEAR;
            if (ain) out.push(a);
            if (ain !== bin) {
                var t = (NEAR - a.z) / (b.z - a.z);
                out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR });
            }
        }
        return out;
    }
    function fade(d) {
        var a = 1 - d / FOG;
        if (a <= 0) return 0;
        if (a > 1) a = 1;
        return a * a * (3 - 2 * a);
    }

    // ---- something in the trees, and the mountain --------------------------------
    // Some holes, a while after you reach them, something tall walks out of the
    // trees on one side of the hole, far enough off to be a doubt, and back in.
    // Seen for a second and it goes on the card. Mt Hood stands east by south
    // on the horizon all day; once a round, if at all, it goes up.
    function creatures(dt) {
        if (squatchAt > 0 && !squatch && holeClock > squatchAt && (mode === "aim" || mode === "rest")) {
            // a spot at the tree line, ahead and to one side, that can be seen from where you stand; a few tries, then never mind
            var a = along(hole, ball.x, ball.z), eye = { x: cam.x, y: cam.y, z: cam.z };
            for (var k = 0; k < 8 && !squatch; k++) {
                var t = Math.min(0.92, a.t + 0.05 + Math.random() * 0.2), p = pointAt(hole, t), side = Math.random() < 0.5 ? -1 : 1, off = hole.cw - 3;
                var sx = p.x + p.nx * side * off, sz = p.z + p.nz * side * off;
                if (!clearLine(eye, sx, height(hole, sx, sz) + 1.6, sz)) continue;
                squatch = { x: sx, z: sz, dx: -p.nx * side * 1.3, dz: -p.nz * side * 1.3, t: 0, dur: 10 + Math.random() * 4, seen: 0, hole: holeNo + 1 };
                if (audio) audio.knock();
            }
            squatchAt = -1;
        }
        if (squatch) {
            squatch.t += dt;
            var walk = squatch.t < squatch.dur * 0.5 ? 1 : -1;        // out of the trees, a pause, and back
            if (squatch.t > squatch.dur * 0.4 && squatch.t < squatch.dur * 0.6) walk = 0;
            squatch.x += squatch.dx * walk * dt; squatch.z += squatch.dz * walk * dt;
            if (squatch.t > squatch.dur) squatch = null;
        }
        if (HOOD.at > 0 && holeClock > HOOD.at && !HOOD.erupting) {
            HOOD.erupting = true; HOOD.erupted = true; HOOD.t = 0; HOOD.hole = holeNo + 1; HOOD.at = -1;
            flag("hood" + HOOD.hole); saved.hood++; save();
            note("MT HOOD");
            if (audio) audio.rumble(90);
        }
        if (HOOD.erupting) {
            HOOD.t += dt;
            // ash, drifting down the screen with the wind, for as long as it goes
            if (HOOD.t < 240 && Math.random() < dt * (HOOD.t < 100 ? 40 : 10)) HOOD.ash.push({ x: Math.random() * W, y: -4, v: 12 + Math.random() * 20, w: (Math.random() - 0.5) * 30, s: 1 + Math.random() * 1.6, a: 0.3 + Math.random() * 0.5 });
            for (var i = HOOD.ash.length - 1; i >= 0; i--) { var f = HOOD.ash[i]; f.y += f.v * dt; f.x += (f.w + Math.sin(clock * 2 + f.y * 0.02) * 10) * dt; if (f.y > Hpx + 4) HOOD.ash.splice(i, 1); }
            if (HOOD.t > 600) { HOOD.erupting = false; HOOD.ash = []; }
        }
    }
    // Whether the ground stays under the line from the eye to a point: a sample every few yards.
    function clearLine(eye, x, y, z) {
        var n = 24;
        for (var i = 1; i < n; i++) { var u = i / n, px = eye.x + (x - eye.x) * u, pz = eye.z + (z - eye.z) * u, py = eye.y + (y - eye.y) * u; if (height(hole, px, pz) > py - 0.2) return false; }
        return true;
    }
    function sasquatch(it) {
        var q = squatch, a = fade(it.d); if (!q || a <= 0.02) return;
        var y = height(hole, q.x, q.z), h = 2.7, ang = Math.atan2(cam.x - q.x, cam.z - q.z), rx = Math.cos(ang), rz = -Math.sin(ang);
        var sw = Math.sin(q.t * 4.2) * 0.35, arm = Math.sin(q.t * 4.2 + Math.PI) * 0.4;
        function P(u, v) { return [q.x + rx * u, y + v, q.z + rz * u]; }
        a = Math.max(a, 0.7);
        ctx.strokeStyle = "#d9c391"; ctx.lineWidth = 1.8; ctx.globalAlpha = a; ctx.shadowColor = "#d9c391"; ctx.shadowBlur = 6;
        poly3([P(-0.55, h * 0.3), P(-0.62, h * 0.72), P(-0.32, h * 0.86), P(0.32, h * 0.86), P(0.62, h * 0.72), P(0.55, h * 0.3), P(0.3, h * 0.3), P(-0.3, h * 0.3)], "#000");   // the torso, broad
        poly3([P(-0.2, h * 0.86), P(-0.26, h), P(0.26, h), P(0.2, h * 0.86)], "#000");                                                                                          // the head, no neck to speak of
        ctx.globalAlpha = a * 0.7;
        poly3([P(-0.62, h * 0.72), P(-0.9 + arm * 0.3, h * 0.35), P(-0.8 + arm * 0.5, h * 0.1)], null);                                                                      // the arms, long
        poly3([P(0.62, h * 0.72), P(0.9 - arm * 0.3, h * 0.35), P(0.8 - arm * 0.5, h * 0.1)], null);
        poly3([P(-0.3, h * 0.3), P(-0.35 + sw * 0.5, 0.02)], null); poly3([P(0.3, h * 0.3), P(0.35 - sw * 0.5, 0.02)], null);                                                 // the legs
        ctx.shadowBlur = 0;
        // seen: on the screen, in the fog, for a second in all
        var c = toCam(q.x, y + h / 2, q.z, { x: 0, y: 0, z: 0 });
        if (c.z > NEAR && Math.abs(c.x) < c.z * (W / 2 / f) && it.d < FOG * 0.8) {
            q.seen += frameDt;
            if (q.seen > 1 && !q.counted) { q.counted = true; flag("sq" + q.hole); saved.squatch++; save(); }
        }
    }
    function mountain(hz) {
        var rel = Math.atan2(Math.sin(HOOD.bearing - cam.yaw), Math.cos(HOOD.bearing - cam.yaw));
        if (Math.abs(rel) > 1.25) return;
        var sx = W / 2 + f * Math.tan(rel), w = f * 0.2, h = f * 0.075, top = hz - h;
        ctx.globalAlpha = 0.95; ctx.strokeStyle = "#7f8fd8"; ctx.lineWidth = 1.2; ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.moveTo(sx - w, hz); ctx.lineTo(sx - w * 0.42, hz - h * 0.62); ctx.lineTo(sx - w * 0.12, top + h * 0.04); ctx.lineTo(sx, top); ctx.lineTo(sx + w * 0.14, top + h * 0.12); ctx.lineTo(sx + w * 0.45, hz - h * 0.6); ctx.lineTo(sx + w, hz); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = "#c9d7ff"; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(sx - w * 0.2, top + h * 0.3); ctx.lineTo(sx - w * 0.05, top + h * 0.12); ctx.lineTo(sx + w * 0.08, top + h * 0.28); ctx.stroke();   // the snow line
        if (!HOOD.erupting) return;
        var t = HOOD.t, grow = Math.min(1, t / 40), tail = t > 150 ? Math.max(0.25, 1 - (t - 150) / 450) : 1;
        // the glow at the summit, and the plume: a column of puffs leaning with the wind, higher as it goes
        ctx.globalAlpha = 0.55 * Math.min(1, t / 3) * tail; ctx.fillStyle = "#ff5a1f";
        ctx.beginPath(); ctx.ellipse(sx, top + h * 0.05, w * 0.12, h * 0.1, 0, 0, Math.PI * 2); ctx.fill();
        var lean = Math.sin(hole.wind.dir - cam.yaw) * 0.6, n = Math.floor(16 * grow);
        for (var i = 0; i < n; i++) {
            var u = i / 16, py = top - u * h * 4.5 * grow, px = sx + lean * u * h * 2.2 + Math.sin(clock * 0.7 + i * 1.7) * h * 0.15 * u, r = h * (0.12 + u * 0.55) * (0.8 + 0.2 * Math.sin(clock + i));
            ctx.globalAlpha = (0.6 - u * 0.35) * tail; ctx.strokeStyle = i < 3 ? "#ff8a4a" : "#b4b4c4"; ctx.fillStyle = "#000"; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        if (t < 150 && Math.random() < 0.025) {   // lightning in the column
            ctx.globalAlpha = 0.9; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.beginPath();
            var lx = sx + lean * h * 1.5, ly = top - h * 2.5; ctx.moveTo(lx, ly);
            for (var k = 0; k < 6; k++) { lx += (Math.random() - 0.5) * h * 0.6; ly += h * 0.35; ctx.lineTo(lx, ly); }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
    function ashfall() {
        if (!HOOD.ash.length) return;
        ctx.fillStyle = "#b9b9c4";
        for (var i = 0; i < HOOD.ash.length; i++) { var fl = HOOD.ash[i]; ctx.globalAlpha = fl.a; ctx.fillRect(fl.x, fl.y, fl.s, fl.s); }
        ctx.globalAlpha = 1;
    }

    // ---- drawing -----------------------------------------------------------
    function resize() {
        DPR = Math.min(devicePixelRatio || 1, 2);
        W = stage.clientWidth; Hpx = stage.clientHeight;
        canvas.width = Math.round(W * DPR); canvas.height = Math.round(Hpx * DPR);
        f = Math.max((W / 2) / Math.tan(FOV / 2), (Hpx / 2) / Math.tan(30 * Math.PI / 180));
    }
    var items = [];
    function gather() {
        items.length = 0;
        var cells = hole.cells, i, tmp = { x: 0, y: 0, z: 0 };
        function addCells(list, step) {
            for (var j = 0; j < list.length; j++) {
                var q = list[j];
                var d = Math.hypot(q.cx - cam.x, q.cz - cam.z);
                if (d > FOG + step) continue;
                toCam(q.cx, q.cy, q.cz, tmp);
                if (tmp.z < -step * 1.5) continue;
                if (tmp.z > 0 && Math.abs(tmp.x) > tmp.z * (W / 2 / f) + step * 1.5 + 4) continue;
                items.push({ q: q, d: Math.hypot(d, q.cy - cam.y) });
            }
        }
        addCells(cells, COARSE);
        addCells(hole.fine, FINE);
        for (i = 0; i < hole.trees.length; i++) {
            var t = hole.trees[i], td = Math.hypot(t.x - cam.x, t.z - cam.z);
            if (td > FOG) continue;
            toCam(t.x, 0, t.z, tmp);
            if (tmp.z < 0) continue;
            items.push({ tree: t, d: td });
        }
        var pd = Math.hypot(hole.pin.x - cam.x, hole.pin.z - cam.z);
        items.push({ pin: true, d: pd - 0.5 });
        if (mode !== "holed") items.push({ ball: true, d: Math.hypot(ball.x - cam.x, ball.z - cam.z, ball.y - cam.y) - 0.3 });
        items.push({ teeMarks: true, d: Math.hypot(0 - cam.x, -1 - cam.z) });
        items.sort(function (a, b) { return b.d - a.d; });
    }
    function project(p) { return { x: W / 2 + f * p.x / p.z, y: Hpx / 2 - f * p.y / p.z }; }
    function render() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, Hpx);
        if (!hole) return;
        sky();
        var tmp = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
        var glow = !slow;
        ctx.lineJoin = "round";
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (it.tree) { tree(it.tree, fade(it.d)); continue; }
            if (it.pin) { pin(fade(it.d)); continue; }
            if (it.ball) { drawBall(); continue; }
            if (it.teeMarks) { teeMarks(fade(it.d)); continue; }
            var q = it.q, a = fade(it.d);
            if (a <= 0.01) continue;
            for (var k = 0; k < 4; k++) toCam(q.p[k][0], q.p[k][1], q.p[k][2], tmp[k]);
            if (tmp[0].z < NEAR && tmp[1].z < NEAR && tmp[2].z < NEAR && tmp[3].z < NEAR) continue;
            var pts = clipNear(tmp);
            if (pts.length < 3) continue;
            ctx.beginPath();
            var left = Infinity, right = -Infinity, top = Infinity;
            for (k = 0; k < pts.length; k++) {
                var sx = W / 2 + f * pts[k].x / pts[k].z, sy = Hpx / 2 - f * pts[k].y / pts[k].z;
                if (sx < left) left = sx; if (sx > right) right = sx; if (sy < top) top = sy;
                if (k) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
            }
            if (right < 0 || left > W || top > Hpx) continue;
            ctx.closePath();
            ctx.fillStyle = "#000";
            ctx.fill();
            var kind = q.kind, col = INK[kind];
            if (kind === "water") a *= 0.55 + 0.25 * Math.sin(clock * 2 + q.cx * 0.3 + q.cz * 0.2);
            var w = kind === "ob" ? 0.18 : kind === "deep" ? 0.32 : kind === "rough" ? 0.5 : kind === "green" ? 1 : 0.85;
            ctx.strokeStyle = col;
            if (glow && kind !== "ob" && kind !== "deep") { ctx.globalAlpha = a * w * 0.2; ctx.lineWidth = 3; ctx.stroke(); }
            ctx.globalAlpha = a * w; ctx.lineWidth = 0.6 + 0.8 * a; ctx.stroke();
            if (kind === "sand" && a > 0.25) stipple(q, a);
        }
        ctx.globalAlpha = 1;
        if (mode === "aim" || mode === "rest") { aimLine(); if (club === PUTTER || ball.lie === "green") slopes(); }
        if (squatch) { var sd = Math.hypot(squatch.x - cam.x, squatch.z - cam.z); if (clearLine(cam, squatch.x, height(hole, squatch.x, squatch.z) + 1.4, squatch.z)) sasquatch({ d: sd }); }
        if (mode === "flight") tracer();
        ashfall();
        if (mode !== "title" && showHud) hud();
        ctx.globalAlpha = 1;
    }
    function sky() {
        var hz = Hpx / 2 - f * Math.tan(cam.pitch);
        var g = ctx.createLinearGradient(0, hz - 90, 0, hz + 4);
        g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(40,90,160,0.28)");
        ctx.fillStyle = g; ctx.fillRect(0, hz - 90, W, 94);
        ctx.strokeStyle = "#3a6fb0"; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, hz); ctx.lineTo(W, hz); ctx.stroke();
        mountain(hz);
        // A low sun, and some stars above the haze: the course at dusk.
        var rel = Math.atan2(Math.sin(0.9 - cam.yaw), Math.cos(0.9 - cam.yaw)), sx = W / 2 + f * Math.tan(rel);
        if (Math.abs(rel) < 1.1 && sx > -40 && sx < W + 40) {
            ctx.globalAlpha = 0.85; ctx.strokeStyle = INK.gold;
            ctx.beginPath(); ctx.arc(sx, hz - 22, 14, Math.PI, 0); ctx.stroke();
            for (var r = 1; r <= 3; r++) { ctx.globalAlpha = 0.3 / r; ctx.beginPath(); ctx.arc(sx, hz - 22, 14 + r * 7, Math.PI, 0); ctx.stroke(); }
        }
        ctx.fillStyle = "#c9d7ff";
        for (var i = 0; i < 60; i++) {
            var x = ((lattice(i, 1, 7) * 2 * Math.PI - cam.yaw) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
            if (Math.abs(x) > 1.2) continue;
            var y = hz - 40 - lattice(i, 2, 7) * Hpx * 0.6;
            ctx.globalAlpha = 0.2 + 0.5 * lattice(i, 3, 7);
            ctx.fillRect(W / 2 + f * Math.tan(x), y, 1.2, 1.2);
        }
        ctx.globalAlpha = 1;
    }
    function stipple(q, a) {
        ctx.fillStyle = INK.sand; ctx.globalAlpha = a * 0.6;
        var tmp = { x: 0, y: 0, z: 0 };
        for (var i = 0; i < 3; i++) {
            var x = q.p[0][0] + lattice(q.cx * 3 + i, q.cz, 5) * (q.p[1][0] - q.p[0][0]), z = q.p[0][2] + lattice(q.cx, q.cz * 3 + i, 6) * (q.p[3][2] - q.p[0][2]);
            toCam(x, height(hole, x, z), z, tmp);
            if (tmp.z < NEAR) continue;
            var s = project(tmp);
            ctx.fillRect(s.x, s.y, 1.5, 1.5);
        }
    }
    function line3(ax, ay, az, bx, by, bz) {
        var a = toCam(ax, ay, az, { x: 0, y: 0, z: 0 }), b = toCam(bx, by, bz, { x: 0, y: 0, z: 0 });
        if (a.z < NEAR && b.z < NEAR) return;
        if (a.z < NEAR || b.z < NEAR) {
            var t = (NEAR - a.z) / (b.z - a.z), m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR };
            if (a.z < NEAR) a = m; else b = m;
        }
        var pa = project(a), pb = project(b);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
    }
    function poly3(pts, fill) {
        var cp = [], i;
        for (i = 0; i < pts.length; i++) cp.push(toCam(pts[i][0], pts[i][1], pts[i][2], { x: 0, y: 0, z: 0 }));
        cp = clipNear(cp);
        if (cp.length < 2) return;
        ctx.beginPath();
        for (i = 0; i < cp.length; i++) { var p = project(cp[i]); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        ctx.stroke();
    }
    // A tree: two crossed triangles on a trunk, filled black so it hides what is behind it.
    function tree(t, a) {
        if (a <= 0.01) return;
        var y = height(hole, t.x, t.z);
        var ang = Math.atan2(cam.x - t.x, cam.z - t.z), cx = Math.cos(ang) * t.r, cz = -Math.sin(ang) * t.r;
        ctx.strokeStyle = INK.tree; ctx.lineWidth = 1; ctx.globalAlpha = a * 0.85;
        poly3([[t.x - cx, y + t.h * 0.25, t.z - cz], [t.x + cx, y + t.h * 0.25, t.z + cz], [t.x, y + t.h, t.z]], "#000");
        poly3([[t.x - cx * 0.75, y + t.h * 0.55, t.z - cz * 0.75], [t.x + cx * 0.75, y + t.h * 0.55, t.z + cz * 0.75], [t.x, y + t.h * 1.12, t.z]], "#000");
        ctx.globalAlpha = a * 0.6;
        line3(t.x, y, t.z, t.x, y + t.h * 0.25, t.z);
    }
    function pin(a) {
        var x = hole.pin.x, z = hole.pin.z, y = height(hole, x, z);
        ctx.globalAlpha = Math.max(0.35, a); ctx.lineWidth = 1.4;
        ctx.strokeStyle = INK.pole;
        var cup = [];
        for (var i = 0; i < 12; i++) cup.push([x + Math.cos(i / 12 * 2 * Math.PI) * CUP * 1.6, y + 0.01, z + Math.sin(i / 12 * 2 * Math.PI) * CUP * 1.6]);
        poly3(cup, "#000");
        if (mode === "holed") return;
        line3(x, y, z, x, y + 2.4, z);
        var wave = Math.sin(clock * 3) * 0.12, wd = hole.wind.dir, wl = 0.6 + Math.min(0.5, hole.wind.mph / 30);
        var fx = Math.sin(wd) * wl, fz = Math.cos(wd) * wl;
        ctx.strokeStyle = INK.flag;
        poly3([[x, y + 2.4, z], [x + fx + wave * fz, y + 2.15, z + fz - wave * fx], [x, y + 1.9, z]], "rgba(255,70,70,0.35)");
    }
    function teeMarks(a) {
        ctx.globalAlpha = a; ctx.strokeStyle = INK.tee; ctx.lineWidth = 1.2;
        for (var s = -1; s <= 1; s += 2) {
            var x = s * 3, z = 1.5, y = height(hole, x, z);
            line3(x - 0.2, y, z, x, y + 0.35, z); line3(x + 0.2, y, z, x, y + 0.35, z);
        }
    }
    function drawBall() {
        var gy = height(hole, ball.x, ball.z);
        var c = toCam(ball.x, ball.y + 0.06, ball.z, { x: 0, y: 0, z: 0 });
        if (c.z < NEAR) return;
        var p = project(c), r = Math.max(1.6, f * 0.05 / c.z);
        // Its shadow, straight down, so you can tell how high it is.
        if (ball.y - gy > 0.15) {
            var s = toCam(ball.x, gy + 0.02, ball.z, { x: 0, y: 0, z: 0 });
            if (s.z > NEAR) { var ps = project(s); ctx.globalAlpha = 0.5; ctx.fillStyle = "#88a"; ctx.beginPath(); ctx.ellipse(ps.x, ps.y, r * 1.2, r * 0.5, 0, 0, 2 * Math.PI); ctx.fill(); }
        }
        ctx.globalAlpha = 0.35; ctx.fillStyle = INK.ball;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 2.4, 0, 2 * Math.PI); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 2 * Math.PI); ctx.fill();
    }
    // Where this club goes from here if hit full and true, and the line to it.
    // How much of this club reaches the pin from here: for the tick on the meter, and the ring.
    function powerToPin() {
        if (club === PUTTER) return Math.min(1.1, Math.sqrt(2 * LIE[ball.lie].roll * yardsToPin()) / (PUTT_MAX * (ball.lie === "green" ? 1 : 1.25)));
        var full = CLUBS[club].carry * (LIE[ball.lie].take || 1);
        return Math.min(1.1, yardsToPin() / full);
    }
    function aimLine() {
        var putt = club === PUTTER;
        var reach = putt ? Math.min(yardsToPin(), 34) : CLUBS[club].carry * (LIE[ball.lie].take || 1) * Math.min(1, powerToPin());
        if (meter && meter.phase >= 2 && !putt) reach *= Math.min(1.1, meter.power);
        if (swing && swing.phase && !putt) reach *= Math.min(1.1, swing.back / backReach());
        if (swing && swing.phase && putt) reach = rollFor(Math.min(1.1, swing.back / backReach()));
        var tx = ball.x + Math.sin(aim) * reach, tz = ball.z + Math.cos(aim) * reach;
        ctx.strokeStyle = INK.aim; ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 6]);
        var n = 24, prev = null;
        for (var i = 0; i <= n; i++) {
            var u = i / n, x = ball.x + (tx - ball.x) * u, z = ball.z + (tz - ball.z) * u;
            var y = height(hole, x, z) + (putt ? 0.04 : Math.sin(u * Math.PI) * reach * 0.12 * Math.tan(CLUBS[club].loft * Math.PI / 180) * 1.6);
            ctx.globalAlpha = 0.85 * (1 - u * 0.5);
            if (prev) line3(prev[0], prev[1], prev[2], x, y, z);
            prev = [x, y, z];
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.9 + 0.1 * Math.sin(clock * 5);
        var ring = [], rr = putt ? 0.5 : Math.max(2, reach * 0.04);
        for (i = 0; i < 20; i++) { var a = i / 20 * 2 * Math.PI, rx = tx + Math.cos(a) * rr, rz = tz + Math.sin(a) * rr; ring.push([rx, height(hole, rx, rz) + 0.05, rz]); }
        poly3(ring, null);
    }
    function rollFor(p) {
        var v = Math.max(0.05, p) * PUTT_MAX * (ball.lie === "green" ? 1 : 1.25), r = LIE[ball.lie].roll;
        return v * v / (2 * r);
    }
    // On the green: which way it falls, as little marks drifting downhill.
    function slopes() {
        var g = hole.green, step = 2;
        ctx.strokeStyle = INK.green; ctx.lineWidth = 1;
        for (var x = g.x - g.rx * 1.2; x <= g.x + g.rx * 1.2; x += step) {
            for (var z = g.z - g.rz * 1.2; z <= g.z + g.rz * 1.2; z += step) {
                if (!inGreen(hole, x, z, 1)) continue;
                var n = normal(hole, x, z), m = Math.hypot(n.gx, n.gz);
                if (m < 0.004) continue;
                var ux = -n.gx / m, uz = -n.gz / m, ph = ((clock * 0.8 + lattice(Math.round(x), Math.round(z), 9)) % 1);
                var len = Math.min(1.2, m * 30);
                var sx = x + ux * ph * step * 0.8, sz = z + uz * ph * step * 0.8;
                ctx.globalAlpha = 0.6 * Math.sin(ph * Math.PI);
                line3(sx, height(hole, sx, sz) + 0.03, sz, sx + ux * len, height(hole, sx + ux * len, sz + uz * len) + 0.03, sz + uz * len);
            }
        }
    }
    function tracer() {
        trail.push([ball.x, ball.y + 0.06, ball.z]);
        if (trail.length > 160) trail.shift();
        ctx.strokeStyle = INK.ball; ctx.lineWidth = 1;
        for (var i = 1; i < trail.length; i += 1) {
            ctx.globalAlpha = 0.5 * i / trail.length;
            line3(trail[i - 1][0], trail[i - 1][1], trail[i - 1][2], trail[i][0], trail[i][1], trail[i][2]);
        }
    }

    // ---- the heads-up display ---------------------------------------------
    function text(s, x, y, size, col, align, alpha) {
        ctx.font = size + "px " + MONO;
        ctx.textAlign = align || "left"; ctx.textBaseline = "top";
        ctx.globalAlpha = alpha == null ? 1 : alpha;
        ctx.fillStyle = "#000";
        ctx.fillText(s, x + 1, y + 1);
        ctx.fillStyle = col;
        ctx.fillText(s, x, y);
    }
    function hud() {
        var small = W < 560, fs = small ? 11 : 13, pad = 12, gold = INK.gold;
        text("HOLE " + (holeNo + 1) + "  PAR " + hole.par, pad, pad, fs + 2, gold);
        text("STROKE " + (strokes + (mode === "aim" || mode === "rest" ? 1 : 0)) + (scores.length ? "  " + toPar(total() - parSoFar()) : ""), pad, pad + fs + 8, fs, "#e9e9f0");
        var dp = yardsToPin(), onGreen = ball.lie === "green" || club === PUTTER;
        var dTxt = onGreen ? Math.round(dp * 3) + " FT" : Math.round(dp) + " YDS";
        var elev = height(hole, hole.pin.x, hole.pin.z) - height(hole, ball.x, ball.z);
        text("TO PIN " + dTxt + (Math.abs(elev) >= 1 && !onGreen ? (elev > 0 ? "  ▲" : "  ▼") + Math.abs(Math.round(elev)) : ""), pad, pad + 2 * fs + 14, fs, "#e9e9f0");
        text("LIE " + LIE[ball.lie].label.toUpperCase(), pad, pad + 3 * fs + 20, fs, INK[ball.lie] || "#e9e9f0");
        // The wind, an arrow drawn relative to where you are looking.
        var wx = W - pad - 34, wy = pad + 30, a = hole.wind.dir - cam.yaw;
        ctx.globalAlpha = 0.9; ctx.strokeStyle = "#8fe7ff"; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(wx, wy, 22, 0, 2 * Math.PI); ctx.stroke();
        if (hole.wind.mph) {
            var ex = wx + Math.sin(a) * 17, ey = wy - Math.cos(a) * 17, bx = wx - Math.sin(a) * 17, by = wy + Math.cos(a) * 17;
            ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey);
            ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.sin(a - 0.5) * 7, ey + Math.cos(a - 0.5) * 7);
            ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.sin(a + 0.5) * 7, ey + Math.cos(a + 0.5) * 7); ctx.stroke();
        }
        text(hole.wind.mph ? hole.wind.mph + " MPH" : "CALM", wx, wy + 26, fs - 1, "#8fe7ff", "center");
        if (hole.wind.live) text("PDX" + (live && live.from != null && hole.wind.mph ? " · " + compass(live.from) : ""), wx, wy + 26 + fs, fs - 3, "#8fe7ff", "center", 0.8);
        // The club, bottom left.
        var c = CLUBS[club], by2 = Hpx - pad - fs - 4;
        if (mode === "aim" || mode === "rest") {
            text(c.id + "  " + c.name.toUpperCase() + (c.carry ? "  " + Math.round(c.carry * (LIE[ball.lie].take || 1)) + " YDS" : ""), pad, by2, fs + 1, gold);
            if (!TOUCH) text("▲▼ club  ◀▶ aim  space swing", pad, by2 - fs - 6, fs - 2, "#7d7d88");
        }
        if (mode === "flight" && english > 0 && !ball.rolling && club !== PUTTER) text("LEAN ◀ ▶ ▼  " + Math.round(english * 100) + "%", pad, by2, fs, "#8fe7ff", "left", 0.8);
        // The swing meter, on the right.
        var mx = W - pad - 16, mh = Math.min(200, Hpx * 0.42), my = Hpx - pad - mh - 4;
        if (mode === "aim") {
            ctx.globalAlpha = 0.85; ctx.strokeStyle = gold; ctx.lineWidth = 1;
            ctx.strokeRect(mx, my, 12, mh);
            var zero = my + mh * (1 / 1.25);
            ctx.beginPath(); ctx.moveTo(mx - 5, zero); ctx.lineTo(mx + 17, zero); ctx.stroke();
            var full = my + mh * (1 - 1 / 1.25 * 1);
            ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(mx - 3, full); ctx.lineTo(mx + 15, full); ctx.stroke();
            // the tick: the power that reaches the pin with this club, if it is less than all of it
            var need = powerToPin();
            if (need < 0.995) { var ny = zero - (zero - full) * need; ctx.globalAlpha = 0.9; ctx.strokeStyle = "#8fe7ff"; ctx.beginPath(); ctx.moveTo(mx - 6, ny); ctx.lineTo(mx + 18, ny); ctx.stroke(); ctx.strokeStyle = gold; }
            var v = null;
            if (meter) v = meter.phase === 1 ? meter.v : meter.v;
            else if (swing && swing.phase) v = Math.min(1.1, swing.back / backReach());
            if (meter && meter.phase === 2) {
                ctx.globalAlpha = 0.9; ctx.fillStyle = gold;
                var py = zero - (zero - full) * meter.power;
                ctx.fillRect(mx, py, 12, zero - py);
                ctx.fillStyle = "#fff"; ctx.fillRect(mx - 4, zero - (zero - full) * meter.v - 1, 20, 2);
            } else if (v != null) {
                ctx.globalAlpha = 0.9; ctx.fillStyle = v > 1 ? INK.flag : gold;
                var top = zero - (zero - full) * v;
                ctx.fillRect(mx, top, 12, zero - top);
            }
            if (club === PUTTER && swing && swing.phase) text(Math.round(rollFor(Math.min(1.1, swing.back / backReach())) * 3) + " FT", mx - 8, my - fs - 6, fs, gold, "right");
        }
        // The hole from above.
        if (hole.mapCanvas && !small) minimap();
        else if (hole.mapCanvas && small && (mode === "aim" || mode === "rest")) minimap(0.7);
        // Messages.
        if (message && messageClock < (mode === "holed" ? 99 : 2.6)) {
            var big = mode === "holed" ? (small ? 30 : 46) : (small ? 18 : 24);
            var al = Math.min(1, messageClock * 4) * (mode === "holed" ? 1 : Math.min(1, (2.6 - messageClock) * 2));
            text(message, W / 2, Hpx * 0.3, big, mode === "holed" ? gold : "#ffffff", "center", al);
            if (mode === "holed") {
                text("in " + strokes + (strokes === 1 ? " stroke" : " strokes") + " · total " + toPar(total() - parSoFar()), W / 2, Hpx * 0.3 + big + 10, fs + 1, "#e9e9f0", "center", al);
                if (modeClock > 0.8) text(holeNo + 1 >= HOLES ? "click for the card" : "click for the next hole", W / 2, Hpx * 0.3 + big + 34, fs, "#7d7d88", "center", al);
            }
        }
        if (mode === "rest" && shotNote) text(shotNote, W / 2, Hpx * 0.22, fs + 3, "#ffffff", "center", Math.min(1, modeClock * 3));
        if (mode === "rest" && modeClock > 0.6) text(TOUCH ? "tap to line up" : "click or space to line up", W / 2, Hpx * 0.22 + fs + 12, fs - 1, "#7d7d88", "center");
        if (mode === "flyover") text(hole.name.toUpperCase() + " · HOLE " + (holeNo + 1), W / 2, Hpx - 46, fs + 2, gold, "center", Math.min(1, modeClock * 2));
        if (mode === "aim" && !swing && !meter && modeClock < 4 && strokes === 0 && holeNo === 0) {
            var tip = small ? ["drag down, then flick up to swing", TOUCH ? "drag the sky to aim" : "or space three times"] : [TOUCH ? "drag down, then flick up to swing · drag the sky to aim" : "drag down, then flick up to swing · or space three times"];
            for (var ti = 0; ti < tip.length; ti++) text(tip[ti], W / 2, Hpx * 0.42 + ti * (fs + 6), fs, "#e9e9f0", "center", Math.min(1, (4 - modeClock)));
        }
        ctx.globalAlpha = 1;
    }
    function minimap(scale) {
        var m = hole.mapCanvas, s = scale || 1, w = m.width * s, h = m.height * s, x = W - 12 - w, y = 92;
        if (y + h > Hpx - 200) return;
        ctx.globalAlpha = 0.85; ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
        ctx.drawImage(m, x, y, w, h);
        var px = function (v) { return x + (hole.mapPx(v) * s); }, pz = function (v) { return y + (hole.mapPz(v) * s); };
        ctx.globalAlpha = 1; ctx.fillStyle = INK.flag; ctx.fillRect(px(hole.pin.x) - 1.5, pz(hole.pin.z) - 1.5, 3, 3);
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(px(ball.x), pz(ball.z), 2.2, 0, 2 * Math.PI); ctx.fill();
        if (mode === "aim") {
            var reach = club === PUTTER ? Math.min(yardsToPin(), 30) : CLUBS[club].carry;
            ctx.strokeStyle = INK.aim; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(px(ball.x), pz(ball.z)); ctx.lineTo(px(ball.x + Math.sin(aim) * reach), pz(ball.z + Math.cos(aim) * reach)); ctx.stroke();
        }
    }

    // ---- sound -------------------------------------------------------------
    var audio = null;
    function makeAudio() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        var ac = new AC();
        if (window.Unmute) window.Unmute(ac);
        var master = ac.createGain(); master.gain.value = saved.sound ? (TOUCH ? 0.9 : 0.6) : 0; master.connect(ac.destination);
        var buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        function noise(t0, dur, type, freq, q, gain, sweep) {
            var src = ac.createBufferSource(); src.buffer = buf;
            var fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, t0); fl.Q.value = q || 1;
            if (sweep) fl.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
            var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            src.connect(fl); fl.connect(g); g.connect(master);
            src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
        }
        function tone(t0, dur, type, freq, gain, to) {
            var o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
            if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
            var g = ac.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
        }
        // A breeze under it all, louder with more wind.
        var wsrc = ac.createBufferSource(); wsrc.buffer = buf; wsrc.loop = true;
        var wf = ac.createBiquadFilter(); wf.type = "lowpass"; wf.frequency.value = TOUCH ? 900 : 350;
        var wg = ac.createGain(); wg.gain.value = 0;
        wsrc.connect(wf); wf.connect(wg); wg.connect(master); wsrc.start();
        return {
            ac: ac,
            set: function (on) { master.gain.setTargetAtTime(on ? (TOUCH ? 0.9 : 0.6) : 0, ac.currentTime, 0.05); },
            wind: function (mph) { wg.gain.setTargetAtTime(0.02 + mph * 0.006, ac.currentTime, 0.5); },
            thwack: function (p) {
                var t = ac.currentTime;
                noise(t, 0.28, "bandpass", 600, 0.7, 0.25 * p, 2400);
                tone(t + 0.02, 0.05, "square", 1700, 0.22);
                noise(t + 0.02, 0.06, "highpass", 2500, 0.8, 0.5);
            },
            putt: function (p) { var t = ac.currentTime; tone(t, 0.06, "triangle", 1250, 0.15 + p * 0.15); noise(t, 0.03, "highpass", 3000, 1, 0.2); },
            land: function (kind, v) {
                var t = ac.currentTime;
                if (kind === "sand") return noise(t, 0.35, "lowpass", 900, 0.6, 0.25 + v * 0.3);
                noise(t, 0.12, "lowpass", kind === "green" ? 500 : 300, 1, 0.3 + v * 0.5);
                tone(t, 0.1, "sine", 110, 0.15 + v * 0.3, 60);
            },
            splash: function () { var t = ac.currentTime; noise(t, 0.7, "lowpass", 2400, 0.8, 0.6, 300); noise(t + 0.1, 0.5, "bandpass", 1200, 2, 0.2, 500); },
            thud: function () { var t = ac.currentTime; tone(t, 0.25, "sine", 140, 0.4, 50); },
            lip: function () { var t = ac.currentTime; tone(t, 0.05, "triangle", 2100, 0.2); tone(t + 0.07, 0.05, "triangle", 1800, 0.14); },
            cup: function (dunk) {
                var t = ac.currentTime;
                [2400, 1900, 2600, 2100].forEach(function (fq, i) { tone(t + i * 0.06, 0.07, "triangle", fq, 0.18 - i * 0.03); });
                if (dunk) noise(t, 0.2, "bandpass", 900, 1, 0.3);
            },
            knock: function () { var t = ac.currentTime; tone(t, 0.12, "sine", 180, 0.25, 120); tone(t + 0.42, 0.12, "sine", 170, 0.2, 110); },
            rumble: function (secs) {
                var t = ac.currentTime;
                var src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
                var fl = ac.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 70; fl.Q.value = 0.8;
                var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 4); g.gain.setValueAtTime(0.9, t + secs * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + secs);
                src.connect(fl); fl.connect(g); g.connect(master); src.start(t); src.stop(t + secs + 0.1);
                var o = ac.createOscillator(); o.type = "sine"; o.frequency.value = 27; var og = ac.createGain(); og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.5, t + 3); og.gain.exponentialRampToValueAtTime(0.0001, t + secs * 0.7);
                o.connect(og); og.connect(master); o.start(t); o.stop(t + secs);
            },
            cheer: function (n) {
                var t = ac.currentTime + 0.3, dur = 1.6 + n * 0.6;
                noise(t, dur, "bandpass", 1400, 0.5, 0.18 + n * 0.08);
                for (var i = 0; i < 30 * n; i++) noise(t + Math.random() * dur * 0.8, 0.03, "bandpass", 1500 + Math.random() * 1500, 2, 0.1 + Math.random() * 0.15);
            }
        };
    }
    function ensureAudio() {
        if (!audio) audio = makeAudio();
        if (audio && audio.ac.state !== "running") { try { audio.ac.resume(); } catch (e) { /* later */ } }
        if (audio && saved.muzak && !muzak) muzak = makeMuzak(audio.ac);
    }
    // ---- the muzak ------------------------------------------------------------
    // The clubhouse speaker: a slow four-chord loop on an electric piano with
    // the tape running a little uneven, a bass that walks when it feels like
    // it, brushed drums behind the beat, a vibraphone that has an idea every
    // other bar, and the crackle of a record that has been on all afternoon.
    // Generated here, nothing fetched; optional, and apart from the game's
    // own sounds. Pitched a whole tone flat, as the genre requires.
    var muzak = null;
    function makeMuzak(ac) {
        var bus = ac.createGain(); bus.gain.value = 0;
        var warm = ac.createBiquadFilter(); warm.type = "lowpass"; warm.frequency.value = 3600; warm.Q.value = 0.5;
        var comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.3;
        bus.connect(warm); warm.connect(comp); comp.connect(ac.destination);
        bus.gain.setTargetAtTime(0.5, ac.currentTime, 2);
        // the tape: one slow wobble on every pitched thing
        var lfo = ac.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.37; var wow = ac.createGain(); wow.gain.value = 7; lfo.connect(wow); lfo.start();
        var flutter = ac.createOscillator(); flutter.type = "sine"; flutter.frequency.value = 5.3; var fg = ac.createGain(); fg.gain.value = 1.5; flutter.connect(fg); flutter.start();
        var TRANSPOSE = -2, BPM = 71, BEAT = 60 / BPM, SWING = 0.14;
        function hz(midi) { return 440 * Math.pow(2, (midi + TRANSPOSE - 69) / 12); }
        var noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), nd = noiseBuf.getChannelData(0);
        for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        // the loop: four chords, twice, with a turn at the end; bass roots under them
        var CHORDS = [[57, 60, 64, 67], [60, 62, 65, 69], [58, 62, 65, 69], [58, 64, 67, 69], [55, 60, 64, 67], [60, 62, 65, 69], [57, 62, 65, 69], [58, 64, 67, 71]];
        var ROOTS = [41, 38, 43, 36, 45, 38, 46, 36];
        var PENTA = [65, 67, 69, 72, 74, 77, 79, 81];
        function rhodes(midi, t, dur, vel) {
            var fq = hz(midi), g = ac.createGain();
            g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.015); g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.6); g.gain.setTargetAtTime(0.0001, t + dur, 0.12);
            var o1 = ac.createOscillator(); o1.type = "sine"; o1.frequency.value = fq;
            var o2 = ac.createOscillator(); o2.type = "triangle"; o2.frequency.value = fq * 2; var g2 = ac.createGain(); g2.gain.value = 0.12;
            var tine = ac.createOscillator(); tine.type = "sine"; tine.frequency.value = fq * 4; var tg = ac.createGain(); tg.gain.setValueAtTime(vel * 0.3, t); tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
            wow.connect(o1.detune); wow.connect(o2.detune); fg.connect(o1.detune);
            o1.connect(g); o2.connect(g2); g2.connect(g); tine.connect(tg); tg.connect(g); g.connect(bus);
            o1.start(t); o2.start(t); tine.start(t); o1.stop(t + dur + 0.8); o2.stop(t + dur + 0.8); tine.stop(t + 0.1);
        }
        function bass(midi, t, dur, vel) {
            var o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = hz(midi); wow.connect(o.detune);
            var fl = ac.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = 420;
            var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.02); g.gain.setTargetAtTime(0.0001, t + dur * 0.8, 0.08);
            o.connect(fl); fl.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.4);
        }
        function vibes(midi, t, dur, vel) {
            var o = ac.createOscillator(); o.type = "sine"; o.frequency.value = hz(midi);
            var vib = ac.createOscillator(); vib.frequency.value = 4.6; var vg = ac.createGain(); vg.gain.value = 9; vib.connect(vg); vg.connect(o.detune); wow.connect(o.detune);
            var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g); g.connect(bus); o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
        }
        function hiss(t, dur, type, freq, q, vel, to) {
            var src = ac.createBufferSource(); src.buffer = noiseBuf;
            var fl = ac.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(freq, t); fl.Q.value = q; if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
            var g = ac.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            src.connect(fl); fl.connect(g); g.connect(bus); src.start(t, Math.random()); src.stop(t + dur + 0.05);
        }
        function kick(t, vel) { var o = ac.createOscillator(); o.type = "sine"; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.09); var g = ac.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.4); }
        function snare(t, vel) { hiss(t, 0.16, "bandpass", 1600, 0.9, vel); var o = ac.createOscillator(); o.type = "triangle"; o.frequency.value = 185; var g = ac.createGain(); g.gain.setValueAtTime(vel * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.1); }
        function hat(t, vel, open) { hiss(t, open ? 0.3 : 0.05, "highpass", 7500, 1, vel); }
        // the record: a bed of crackle, and a pop now and then
        var crackle = ac.createBufferSource(); crackle.buffer = noiseBuf; crackle.loop = true;
        var cf = ac.createBiquadFilter(); cf.type = "lowpass"; cf.frequency.value = 2200; var cg = ac.createGain(); cg.gain.value = 0.014;
        crackle.connect(cf); cf.connect(cg); cg.connect(bus); crackle.start();
        var bar = 0, nextBar = ac.currentTime + 0.1, timer = null;
        function scheduleBar(t0) {
            var ch = CHORDS[bar % 8], root = ROOTS[bar % 8], b = BEAT, sw = b * 0.5 + b * SWING, i;
            function at(beat) { return t0 + beat * b + (Math.random() - 0.5) * 0.012; }
            // the piano: on the one, the and of two, and sometimes the four
            ch.forEach(function (m, k) { rhodes(m, at(0) + k * 0.012, b * 1.6, 0.11 + Math.random() * 0.03); });
            ch.forEach(function (m, k) { rhodes(m, t0 + b + sw + k * 0.01, b * 1.1, 0.07 + Math.random() * 0.03); });
            if (Math.random() < 0.5) ch.slice(1).forEach(function (m, k) { rhodes(m, at(3) + k * 0.01, b * 0.8, 0.06); });
            // the bass: root, fifth, and a step up to the next root on the and of four when it feels like it
            bass(root, at(0), b * 1.7, 0.33); bass(root + 7, at(2), b * 1.2, 0.26);
            if (Math.random() < 0.55) bass(ROOTS[(bar + 1) % 8] + (Math.random() < 0.5 ? -1 : 1), t0 + 3 * b + sw, b * 0.45, 0.22);
            // the drums, behind the beat
            kick(at(0) + 0.01, 0.55); kick(at(2) + 0.02, 0.45); if (Math.random() < 0.3) kick(t0 + 1 * b + sw, 0.3);
            snare(at(1) + 0.028, 0.16); snare(at(3) + 0.03, 0.18);
            for (i = 0; i < 8; i++) { var tt = t0 + Math.floor(i / 2) * b + (i % 2 ? sw : 0); hat(tt + 0.01, i % 2 ? 0.05 + Math.random() * 0.03 : 0.08 + Math.random() * 0.03, i === 7 && Math.random() < 0.35); }
            // the vibes, an idea every other bar
            if (bar % 2 === 1 && Math.random() < 0.7) {
                var n = 3 + Math.floor(Math.random() * 3), start = Math.floor(Math.random() * 4) * 0.5, idx = Math.floor(Math.random() * PENTA.length);
                for (i = 0; i < n; i++) { idx = Math.max(0, Math.min(PENTA.length - 1, idx + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.7 ? 1 : 2))); var beat = start + i * (Math.random() < 0.3 ? 1 : 0.5); if (beat >= 4) break; vibes(PENTA[idx], t0 + Math.floor(beat) * b + (beat % 1 ? sw : 0), b * (0.6 + Math.random() * 0.8), 0.07 + Math.random() * 0.03); }
            }
            if (Math.random() < 0.6) hiss(t0 + Math.random() * 4 * b, 0.02, "highpass", 2500, 1, 0.08 + Math.random() * 0.1);   // a pop
        }
        function tick() { while (nextBar < ac.currentTime + 0.5) { scheduleBar(nextBar); nextBar += 4 * BEAT; bar++; } }
        timer = setInterval(tick, 120); tick();
        return {
            stop: function () { bus.gain.setTargetAtTime(0, ac.currentTime, 0.5); clearInterval(timer); setTimeout(function () { try { crackle.stop(); lfo.stop(); flutter.stop(); bus.disconnect(); } catch (e) { /* gone */ } }, 3000); },
            set: function (v) { bus.gain.setTargetAtTime(v, ac.currentTime, 0.5); }
        };
    }

    // ---- the loop ----------------------------------------------------------
    var last = 0, slowFrames = 0, frameDt = 1 / 60;
    function frame(now) {
        requestAnimationFrame(frame);
        var dt = Math.min(0.05, (now - (last || now)) / 1000);
        last = now; frameDt = dt;
        if (!hole) { render(); return; }
        if (paused) return;
        clock += dt; modeClock += dt; messageClock += dt; holeClock += dt;
        keyAim(dt);
        creatures(dt);
        if (meter) {
            if (meter.phase === 1) { meter.v += meter.dir * dt / 0.95; if (meter.v >= 1.1) { meter.v = 1.1; meter.dir = -1; } if (meter.v < 0) { meter = null; } }
            else if (meter.phase === 2) { meter.v -= dt / 0.95; if (meter.v < -0.2) { var pw = meter.power; meter = null; strike(pw, -1); } }
        }
        if (mode === "flight") {
            var n = Math.ceil(dt / (1 / 240));
            for (var i = 0; i < n && mode === "flight"; i++) step(dt / n);
        }
        if (mode === "holed" && modeClock > 6 && holeNo + 1 < HOLES) nextHole();
        placeCamera(dt);
        var t0 = performance.now();
        gather();
        render();
        var took = performance.now() - t0;
        slowFrames = took > 18 ? Math.min(30, slowFrames + 1) : Math.max(0, slowFrames - 1);
        slow = slowFrames > 10;
    }

    // ---- the page ----------------------------------------------------------
    function begin() {
        ensureAudio();
        if (!live) fetchWind();
        if (audio) audio.wind(0);
        veil.hidden = true; veilCard.hidden = true;
        if (veilBoard) veilBoard.hidden = true; if (postLink) postLink.hidden = true;
        if (paused) { paused = false; return; }
        if (mode === "card" || mode === "title") startRound();
        if (audio) audio.wind(hole.wind.mph);
    }
    go.addEventListener("click", begin);
    soundButton.addEventListener("click", function () {
        saved.sound = !saved.sound; save();
        soundButton.setAttribute("aria-pressed", saved.sound ? "true" : "false");
        ensureAudio();
        if (audio) audio.set(saved.sound);
    });
    soundButton.setAttribute("aria-pressed", saved.sound ? "true" : "false");
    if (muzakButton) {
        muzakButton.setAttribute("aria-pressed", saved.muzak ? "true" : "false");
        muzakButton.addEventListener("click", function () {
            saved.muzak = !saved.muzak; save();
            muzakButton.setAttribute("aria-pressed", saved.muzak ? "true" : "false");
            ensureAudio();
            if (!saved.muzak && muzak) { muzak.stop(); muzak = null; }
        });
    }
    if (boardButton) boardButton.addEventListener("click", openBoard);
    newButton.addEventListener("click", function () {
        seed = 1 + Math.floor(Math.random() * 999999);
        history.replaceState(null, "", "#seed=" + seed);
        paused = false; veil.hidden = true; veilCard.hidden = true;
        if (veilBoard) veilBoard.hidden = true; if (postLink) postLink.hidden = true;
        ensureAudio();
        startRound();
        if (audio) audio.wind(hole.wind.mph);
    });
    function fill(on) {
        stage.classList.toggle("filled", on);
        document.body.classList.toggle("filled", on);
        unfillButton.hidden = !on;
        setTimeout(resize, 50);
    }
    fullButton.addEventListener("click", function () {
        if (stage.requestFullscreen && !TOUCH) stage.requestFullscreen().catch(function () { fill(true); });
        else if (stage.webkitRequestFullscreen && !TOUCH) stage.webkitRequestFullscreen();
        else fill(true);
    });
    unfillButton.addEventListener("click", function () { fill(false); });
    if (pads) {
        pads.addEventListener("click", function (e) {
            var b = e.target.closest("button");
            if (!b || mode !== "aim" || meter || swing) return;
            var act = b.getAttribute("data-act");
            if (act === "up") club = Math.max(0, club - 1);
            if (act === "down") club = Math.min(PUTTER, club + 1);
            if (act === "left") aim -= club === PUTTER ? 0.006 : 0.04;
            if (act === "right") aim += club === PUTTER ? 0.006 : 0.04;
            if (act === "view") { mode = "flyover"; modeClock = 0; }
        });
    }
    canvas.addEventListener("pointerdown", function (e) { ensureAudio(); pointerDown(e); });
    canvas.addEventListener("pointermove", pointerMove);
    canvas.addEventListener("pointerup", pointerUp);
    canvas.addEventListener("pointercancel", function () { swing = null; });
    window.addEventListener("keydown", function (e) {
        if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
        if (!stageInView()) return;
        keyDown(e);
    });
    window.addEventListener("keyup", keyUp);
    function stageInView() { var r = stage.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }
    window.addEventListener("resize", resize);
    window.addEventListener("hashchange", function () { var s = hashSeed() || today(); if (s !== seed) { seed = s; if (mode !== "title") startRound(); } });
    document.addEventListener("fullscreenchange", function () { setTimeout(resize, 50); });

    resize();
    // Behind the title, the first hole, flown over and over.
    hole = generate(seed, 0);
    fetchWind(); fetchBoard();
    ball.x = 0; ball.z = 0; ball.y = height(hole, 0, 0); ball.lie = "tee";
    aim = aimAtPin();
    veilText.textContent = "the course of the day: " + hole.name + ", nine holes" + (seed !== today() ? " (seed " + seed + ")" : "") + "." + (saved.best[seed] != null ? " Your best here is " + saved.best[seed] + "." : "");
    requestAnimationFrame(frame);

    // For poking at in the console.
    window.Golf = {
        generate: generate, height: function (x, z) { return height(hole, x, z); }, classify: function (x, z) { return classify(hole, x, z); },
        get hole() { return hole; }, get ball() { return ball; }, get mode() { return mode; }, get seed() { return seed; },
        strike: function (p, s) { if (mode !== "aim") readyToHit(); strike(p, s || 0); },
        aim: function (a) { if (a != null) aim = a; return aim; }, club: function (c) { if (c != null) club = c; return club; },
        start: begin, clubs: CLUBS, scores: scores, launchSpeed: launchSpeed, rollFor: rollFor,
        settle: function () { for (var n = 0; mode === "flight" && n < 240 * 90; n++) step(1 / 240); return mode; },
        next: function () { if (mode === "holed") nextHole(); }, pick: pickClub, toPin: yardsToPin,
        hud: function (on) { showHud = on !== false; },
        get wind() { return live; }, calm: function () { live = null; if (hole) hole.wind = generate(seed, holeNo).wind; },
        board: function (cards) { if (cards) board = cards; return board; }, openBoard: openBoard, get flags() { return flags; },
        squatch: function (now) { squatchAt = now ? 0.001 : holeClock + 0.5; if (now) holeClock = Math.max(holeClock, 1); }, hood: function () { HOOD.at = holeClock + 0.5; HOOD.erupted = false; }, get mountain() { return HOOD; }, get creature() { return squatch; }, get muzak() { return muzak; },
        where: function () { if (!squatch) return null; var y = height(hole, squatch.x, squatch.z), c = toCam(squatch.x, y + 1.3, squatch.z, { x: 0, y: 0, z: 0 }); return { cam: [cam.x, cam.y, cam.z, cam.yaw, cam.pitch], c: c, screen: c.z > NEAR ? project(c) : null, clear: clearLine(cam, squatch.x, y + 1.4, squatch.z), W: W, H: Hpx, ground: y }; }
    };
})();
