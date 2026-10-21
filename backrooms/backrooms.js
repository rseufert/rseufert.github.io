// The backrooms of rickseufert.com (backrooms/index.html).
//
// You noclipped out of the site. Under it there is only wireframe: rooms
// that go on, a drop ceiling, a hum at 60 Hz, and something that walks
// when you are not looking. Every level is grown from a seed, so a level
// is the same each time you fall into it, and the next one is bigger,
// lower and redder. There is no bottom. Whoever it finds leaves a ghost:
// their last thirty seconds, walking the same halls for whoever comes next.
//
// Drawn as vectors on a plain canvas: each wall, floor and ceiling tile
// is a quad filled black and stroked in phosphor, painted back to front,
// which is how a wireframe keeps its secrets. No WebGL, no libraries.
(function () {
    "use strict";
    var canvas = document.getElementById("backrooms-stage");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var stage = canvas.parentNode;
    var veil = document.getElementById("backrooms-veil");
    var veilText = document.getElementById("backrooms-veil-text");
    var go = document.getElementById("backrooms-go");
    var soundButton = document.getElementById("backrooms-sound");
    var fullButton = document.getElementById("backrooms-full");
    var unfillButton = document.getElementById("backrooms-unfill");
    var resetButton = document.getElementById("backrooms-reset");
    var ghostLink = document.getElementById("backrooms-ghost");
    var depthOut = document.getElementById("backrooms-depth");

    var KEY = "backrooms";
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace';
    var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var TOUCH = window.matchMedia && matchMedia("(hover: none) and (pointer: coarse)").matches;
    var ELF = false;
    try { ELF = !!localStorage.getItem("elf"); } catch (e) { /* no storage */ }

    var NEAR = 0.06;      // the near plane, in cells
    var EYE = 0.42;       // eye height; ceilings start at 0.8
    var FOV = 78 * Math.PI / 180;
    var RADIUS = 0.2;     // how wide you are
    var WALK = 2.0, RUN = 3.3;

    // ---- the record --------------------------------------------------------
    // Seeds come from a dozen, so that visitors share floors and meet each
    // other's ghosts; #seed= in the address takes any number.
    var FLOORS = 12;
    function freshSeed() { return 1 + Math.floor(Math.random() * FLOORS); }
    var saved = load();
    function load() {
        var s = null;
        try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { s = null; }
        if (!s || typeof s.seed !== "number") s = { seed: freshSeed(), level: 0, best: 0, deaths: 0, sound: 1 };
        var m = /seed=(\d+)/.exec(location.hash), l = /level=(\d+)/.exec(location.hash);
        if (m) s.seed = +m[1];
        if (l) s.level = Math.min(+l[1], 60);
        return s;
    }
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* a visit's worth */ }
        if (depthOut) {
            var n = ghostCount();
            depthOut.textContent = "seed " + saved.seed + " · level " + saved.level + " · deepest " + saved.best + " · found " + saved.deaths + " time" + (saved.deaths === 1 ? "" : "s") + (n ? " · " + n + " ghost" + (n === 1 ? "" : "s") + " on this seed" : "");
        }
    }

    // ---- random ------------------------------------------------------------
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function mix(seed, level) {
        var h = (seed ^ 0x9E3779B9) >>> 0;
        h = Math.imul(h ^ Math.imul(level + 1, 0x85EBCA6B), 0xC2B2AE35);
        h ^= h >>> 13;
        return h >>> 0;
    }

    // ---- the levels --------------------------------------------------------
    var NOTES = [
        "the elves were here", "no cookies. no exits.", "RICK WAS HERE 69,420,000", "DO NOT REBOOT",
        "you are 6'13\" from the way down", "the dashboard is still refreshing", "this is level 0 of 0",
        "sap is a kind of blood", "the flipper found your thoughts", "404: you", "mocks all the way down",
        "the hum is a chord", "it only moves when you don't", "check the tab title", "someone is reading the guest book",
        "c = -0.7269 + 0.1889i", "the ceiling is a floor for something", "turn around", "plain html", "reality# _",
        "best viewed at 800x600", "the heron is still watching", "don't run. run.", "it is not a dolphin",
        "the menu has one door too many", "there is no bottom. that is the joke", "josh allen can see you",
        "the elves are cold", "kulture kudasai", "you have been here before"
    ];
    var ARRIVALS = [
        "level 0. you noclipped out of rickseufert.com. the hum is 60 hz. find the way down.",
        "level 1. the ceiling is lower. so is the hum.",
        "level 2. the elves have been here. they left notes.",
        "level 3. the walls remember you now.",
        "level 4. it is faster than you are. you can still run.",
        "level 5. no cookies. no exits. only the way down."
    ];
    var DEEPER = [
        "level %. deeper.", "level %. the dashboard is still refreshing, somewhere above you.",
        "level %. you have been here before.", "level %. the tab is still waving.",
        "level %. there is no bottom. that is the joke.", "level %. the hum has found a chord.",
        "level %. it knows the way down too."
    ];
    var PALETTE = ["#ffb000", "#b6ff3a", "#00e5ff", "#ff3d9a", "#ff5a2e", "#c288ff", "#ffffff"];

    function generate(seed, level) {
        var rand = mulberry32(mix(seed, level));
        var n = Math.min(16 + level * 3, 44);
        var grid = new Uint8Array(n * n);     // 1 solid, 0 open
        var height = new Float32Array(n * n);
        var i, j, x, z;
        for (i = 0; i < n * n; i++) { grid[i] = 1; height[i] = 0.8; }
        function at(x, z) { return (x < 0 || z < 0 || x >= n || z >= n) ? 1 : grid[z * n + x]; }
        function open(x, z, h) { if (x > 0 && z > 0 && x < n - 1 && z < n - 1) { grid[z * n + x] = 0; height[z * n + x] = h; } }

        // Rooms, overlapping on purpose: the backrooms are not architecture.
        var rooms = [], tries = 6 + level * 2, big = level < 3 ? 5 : 8;
        for (i = 0; i < tries; i++) {
            var w = 2 + Math.floor(rand() * big), d = 2 + Math.floor(rand() * big);
            var rx = 1 + Math.floor(rand() * (n - w - 2)), rz = 1 + Math.floor(rand() * (n - d - 2));
            var h = level < 3 ? 0.8 : 0.6 + rand() * 0.5;
            if (level >= 8 && rand() < 0.15) h = 1.6;      // a hall, for the echo
            for (z = rz; z < rz + d; z++) for (x = rx; x < rx + w; x++) open(x, z, h);
            rooms.push({ x: rx + Math.floor(w / 2), z: rz + Math.floor(d / 2) });
        }
        // Corridors between them, L-shaped, and a few extra so it loops.
        function corridor(a, b) {
            var wide = rand() < 0.3 ? 2 : 1, h = 0.7;
            var x0 = a.x, z0 = a.z, x1 = b.x, z1 = b.z, k;
            if (rand() < 0.5) {
                for (x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (k = 0; k < wide; k++) if (at(x, z0 + k)) open(x, z0 + k, h);
                for (z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (k = 0; k < wide; k++) if (at(x1 + k, z)) open(x1 + k, z, h);
            } else {
                for (z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) for (k = 0; k < wide; k++) if (at(x0 + k, z)) open(x0 + k, z, h);
                for (x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (k = 0; k < wide; k++) if (at(x, z1 + k)) open(x, z1 + k, h);
            }
        }
        for (i = 1; i < rooms.length; i++) corridor(rooms[i - 1], rooms[i]);
        for (i = 0; i < 1 + level; i++) corridor(rooms[Math.floor(rand() * rooms.length)], rooms[Math.floor(rand() * rooms.length)]);
        // Pillars, on a grid, where there is room: the columns of the place.
        for (z = 2; z < n - 2; z++) for (x = 2; x < n - 2; x++) {
            if (x % 3 !== 1 || z % 3 !== 1 || rand() > 0.6) continue;
            var clear = true;
            for (j = -1; j <= 1 && clear; j++) for (i = -1; i <= 1; i++) if (at(x + i, z + j)) { clear = false; break; }
            if (clear) grid[z * n + x] = 1;
        }
        // Nooks: a few cells opened off the sides, for standing in.
        for (i = 0; i < n * n * 0.03; i++) {
            x = 1 + Math.floor(rand() * (n - 2)); z = 1 + Math.floor(rand() * (n - 2));
            if (at(x, z) && !(at(x - 1, z) && at(x + 1, z) && at(x, z - 1) && at(x, z + 1))) open(x, z, 0.65);
        }
        // Keep only what the start can reach; the rest was never there.
        var start = rooms[0];
        grid[start.z * n + start.x] = 0;                 // a pillar may have grown there
        var dist = field(grid, n, start.x, start.z);
        var far = [], reach = [];
        for (i = 0; i < n * n; i++) {
            if (!grid[i] && dist[i] < 0) grid[i] = 1;
            if (dist[i] >= 0) reach.push(i);
        }
        var maxd = 0;
        reach.forEach(function (c) { if (dist[c] > maxd) maxd = dist[c]; });
        reach.forEach(function (c) { if (dist[c] >= maxd * 0.85) far.push(c); });
        var ex = far[Math.floor(rand() * far.length)];
        var exit = { x: ex % n, z: Math.floor(ex / n) };
        // Notes on the walls, where someone stood.
        var notes = [], used = {}, want = Math.min(4 + level, 12), pool = NOTES.slice();
        for (i = 0; i < 400 && notes.length < want; i++) {
            var c = reach[Math.floor(rand() * reach.length)];
            x = c % n; z = Math.floor(c / n);
            if (dist[c] < 4 || used[c] || c === ex) continue;
            var faces = [];
            if (at(x, z - 1)) faces.push(0); if (at(x + 1, z)) faces.push(1); if (at(x, z + 1)) faces.push(2); if (at(x - 1, z)) faces.push(3);
            if (!faces.length) continue;
            used[c] = 1;
            notes.push({ x: x, z: z, face: faces[Math.floor(rand() * faces.length)], text: pool.splice(Math.floor(rand() * pool.length), 1)[0], seen: false });
        }
        return { n: n, grid: grid, height: height, start: start, exit: exit, dist: dist, reach: reach, notes: notes, level: level, rand: rand };
    }
    // Breadth-first distances over open cells, -1 where you cannot get.
    function field(grid, n, sx, sz) {
        var d = new Int32Array(n * n), q = [sz * n + sx], i;
        for (i = 0; i < d.length; i++) d[i] = -1;
        d[q[0]] = 0;
        for (i = 0; i < q.length; i++) {
            var c = q[i], x = c % n, z = (c - x) / n, v = d[c] + 1;
            if (x > 0 && !grid[c - 1] && d[c - 1] < 0) { d[c - 1] = v; q.push(c - 1); }
            if (x < n - 1 && !grid[c + 1] && d[c + 1] < 0) { d[c + 1] = v; q.push(c + 1); }
            if (z > 0 && !grid[c - n] && d[c - n] < 0) { d[c - n] = v; q.push(c - n); }
            if (z < n - 1 && !grid[c + n] && d[c + n] < 0) { d[c + n] = v; q.push(c + n); }
        }
        return d;
    }

    // ---- the state ---------------------------------------------------------
    var L = null;                 // the level
    var cam = { x: 0, z: 0, y: EYE, yaw: 0, pitch: 0, fx: 0, fz: 1, rx: 1, rz: 0 };
    var mode = "title";           // title, play, pause, found, drop
    var things = [];              // what walks here
    var keys = {};
    var msg = { text: "", at: 0, until: 0 };
    var clock = 0, levelClock = 0, modeClock = 0, flicker = 1, blackout = 0, lastFrame = 0, slow = 0;
    var playerField = null, fieldAt = -1;
    var sawExit = false, sawThing = false, stepClock = 0, near = 0, hue = 0;
    var W = 0, H = 0, DPR = 1, f = 0;

    function fogRadius() { return Math.max(4.5, 11 - L.level * 0.6); }
    function color() {
        if (ELF) return "hsl(" + hue.toFixed(0) + ", 100%, 65%)";
        return PALETTE[Math.min(L.level, PALETTE.length - 1)];
    }
    function cellAt(x, z) {
        x = Math.floor(x); z = Math.floor(z);
        return (x < 0 || z < 0 || x >= L.n || z >= L.n) ? 1 : L.grid[z * L.n + x];
    }
    function heightAt(x, z) { return L.height[Math.floor(z) * L.n + Math.floor(x)]; }

    function enter(level, again) {
        L = generate(saved.seed, level);
        cam.x = L.start.x + 0.5; cam.z = L.start.z + 0.5; cam.pitch = 0;
        cam.yaw = L.rand() * Math.PI * 2;
        things = [];
        var count = Math.min(1 + Math.floor(level / 2), 5);
        for (var i = 0; i < count; i++) spawn(10 + i * 3, 18 + i * 3);
        sawExit = false; sawThing = false; sawGhost = false; levelClock = 0; fieldAt = -1;
        rec = []; recClock = 0;
        saved.level = level;
        if (level > saved.best) saved.best = level;
        save();
        haunt();
        var text = level < ARRIVALS.length ? ARRIVALS[level] : DEEPER[(level * 7 + saved.seed) % DEEPER.length].replace("%", level);
        say(again ? "the start again. it is somewhere else now. so is the way down, probably not." : text, 7);
        if (audio) audio.level(level);
    }
    function spawn(lo, hi) {
        // Somewhere between lo and hi steps from the player, out of sight.
        var px = Math.floor(cam.x), pz = Math.floor(cam.z);
        var d = field(L.grid, L.n, px, pz), pick = [], i;
        for (i = 0; i < d.length; i++) if (d[i] >= lo && d[i] <= hi) pick.push(i);
        if (!pick.length) for (i = 0; i < d.length; i++) if (d[i] >= 6) pick.push(i);
        if (!pick.length) return;
        var c, x, z, best = null;
        for (i = 0; i < 60; i++) {
            c = pick[Math.floor(Math.random() * pick.length)]; x = c % L.n + 0.5; z = Math.floor(c / L.n) + 0.5;
            if (visible(x, z)) continue;
            var far = Math.hypot(x - cam.x, z - cam.z) >= Math.min(7, fogRadius() * 0.7);
            if (far) { best = [x, z]; break; }
            if (!best) best = [x, z];
        }
        if (!best) return;
        things.push({ x: best[0], z: best[1], tx: best[0], tz: best[1], seen: false, unseenFor: 0, wobble: Math.random() * 7 });
    }

    // ---- lines of sight ----------------------------------------------------
    function visible(x, z) {
        var dx = x - cam.x, dz = z - cam.z, d = Math.hypot(dx, dz);
        if (d > fogRadius() + 1) return false;
        var ang = Math.atan2(dx, dz) - cam.yaw;
        ang = Math.atan2(Math.sin(ang), Math.cos(ang));
        if (Math.abs(ang) > FOV / 2 + 0.08) return false;
        var steps = Math.ceil(d / 0.08);
        for (var i = 1; i < steps; i++) {
            var t = i / steps;
            if (cellAt(cam.x + dx * t, cam.z + dz * t)) return false;
        }
        return true;
    }

    // ---- the ones that walk ------------------------------------------------
    function stalk(dt) {
        var px = Math.floor(cam.x), pz = Math.floor(cam.z), key = pz * L.n + px;
        if (key !== fieldAt) { playerField = field(L.grid, L.n, px, pz); fieldAt = key; }
        var freeze = Math.max(3, 9 - L.level * 0.6);
        var speed = Math.min(1.4 + L.level * 0.22, 3.0);
        near = 99;
        things.slice().forEach(function (t) {
            var dx = cam.x - t.x, dz = cam.z - t.z, d = Math.hypot(dx, dz);
            if (d < near) near = d;
            var seen = visible(t.x, t.z);
            if (seen) {
                if (!t.seen) { say(sawThing ? "closer." : "something is standing at the end of the hall. it was not there before.", 5); sawThing = true; }
                t.unseenFor = 0;
            } else t.unseenFor += dt;
            t.seen = seen;
            if (d < 0.45 && mode === "play") { found(); return; }
            if (seen && d < freeze) return;            // it does not move while you watch
            // Far off, or forgotten: it is somewhere nearer, now.
            var c = Math.floor(t.z) * L.n + Math.floor(t.x);
            if (playerField[c] > 24 || (t.unseenFor > 25 && playerField[c] > 12)) {
                things.splice(things.indexOf(t), 1); spawn(7, 12); return;
            }
            // Walk the distance field down toward the player.
            if (Math.hypot(t.tx - t.x, t.tz - t.z) < 0.05) {
                var x = Math.floor(t.x), z = Math.floor(t.z), best = playerField[c], bx = x, bz = z;
                [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (s) {
                    var nx = x + s[0], nz = z + s[1];
                    if (nx < 0 || nz < 0 || nx >= L.n || nz >= L.n) return;
                    var v = playerField[nz * L.n + nx];
                    if (v >= 0 && (v < best || (v === best && Math.random() < 0.3))) { best = v; bx = nx; bz = nz; }
                });
                t.tx = bx + 0.5; t.tz = bz + 0.5;
            }
            var mx = t.tx - t.x, mz = t.tz - t.z, m = Math.hypot(mx, mz);
            if (m > 0) { var step = Math.min(m, speed * dt); t.x += mx / m * step; t.z += mz / m * step; }
        });
    }
    function found() {
        mode = "found"; modeClock = 0;
        keepGhost();
        saved.deaths++; save();
        if (audio) audio.found();
        say("", 0);
    }

    // ---- ghosts ------------------------------------------------------------
    // Whoever it finds leaves a ghost: their last thirty seconds, ten
    // positions a second, kept in this browser for this seed and level, and
    // sent in if they choose, as an issue titled "ghost:" that a workflow
    // compiles into ghosts.json on the sky-data branch (tools/ghosts.py). On
    // the same seed and level the ghosts walk that half minute again, and
    // again, and are found where they were found. They cannot see you. It
    // cannot see them.
    var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    var HZ = 10, KEEP = 30 * HZ, GKEY = "backrooms-ghosts", MOST = 8;
    var rec = [], recClock = 0, ghosts = [], book = null, lastGhost = null, sawGhost = false;
    function enc(v) { v = Math.max(0, Math.min(4095, Math.round(v))); return B64.charAt(v >> 6) + B64.charAt(v & 63); }
    function dec(s, i) { return B64.indexOf(s.charAt(i)) * 64 + B64.indexOf(s.charAt(i + 1)); }
    // A ghost is one line: bk1:seed:level:hz: then six characters a sample,
    // x and z in 64ths of a cell and the yaw in 4096ths of a turn.
    function pack(samples, seed, level) {
        var s = "bk1:" + seed + ":" + level + ":" + HZ + ":";
        for (var i = 0; i < samples.length; i += 3) {
            var yaw = samples[i + 2] % (Math.PI * 2);
            if (yaw < 0) yaw += Math.PI * 2;
            s += enc(samples[i] * 64) + enc(samples[i + 1] * 64) + enc(yaw / (Math.PI * 2) * 4095);
        }
        return s;
    }
    function unpack(path) {
        var m = /^bk1:(\d{1,7}):(\d{1,2}):(\d{1,2}):([A-Za-z0-9_-]{18,1800})$/.exec(path || "");
        if (!m || m[4].length % 6) return null;
        var pts = [], d = m[4];
        for (var i = 0; i < d.length; i += 6) pts.push([dec(d, i) / 64, dec(d, i + 2) / 64, dec(d, i + 4) / 4095 * Math.PI * 2]);
        return { seed: +m[1], level: +m[2], hz: +m[3] || HZ, pts: pts };
    }
    function record(dt) {
        recClock += dt;
        if (recClock < 1 / HZ) return;
        recClock -= 1 / HZ;
        rec.push(cam.x, cam.z, cam.yaw);
        if (rec.length > KEEP * 3) rec.splice(0, rec.length - KEEP * 3);
    }
    function localGhosts() {
        var g = [];
        try { g = JSON.parse(localStorage.getItem(GKEY)) || []; } catch (e) { g = []; }
        return Array.isArray(g) ? g : [];
    }
    function allGhosts() { return localGhosts().concat(book && book.ghosts || []); }
    function ghostCount() {
        var seen = {}, n = 0;
        allGhosts().forEach(function (g) { if (g && g.seed === saved.seed && !seen[g.path]) { seen[g.path] = 1; n++; } });
        return n;
    }
    function keepGhost() {
        if (rec.length < 3 * HZ * 3) return;                   // under three seconds is not a ghost
        var ghost = { seed: saved.seed, level: L.level, when: new Date().toISOString().slice(0, 10), path: pack(rec, saved.seed, L.level), mine: true };
        var g = localGhosts();
        g.unshift(ghost);
        try { localStorage.setItem(GKEY, JSON.stringify(g.slice(0, 40))); } catch (e) { /* a visit's worth */ }
        offer(ghost);
    }
    function offer(ghost) {
        lastGhost = ghost;
        if (!ghostLink) return;
        var body = "seed: " + ghost.seed + "\nlevel: " + ghost.level + "\nfound: " + ghost.when + "\n\n```\n" + ghost.path + "\n```\n\nLeft from rickseufert.com/backrooms/#seed=" + ghost.seed + "&level=" + ghost.level + ": the last thirty seconds before it found me. Keep the code block as it is; a workflow reads open issues titled \"ghost:\" into the backrooms, where whoever walks this seed and level will meet it. Closing the issue lays it to rest.";
        ghostLink.href = "https://github.com/rseufert/rseufert.github.io/issues/new?title=" + encodeURIComponent("ghost: level " + ghost.level + " of seed " + ghost.seed) + "&body=" + encodeURIComponent(body);
        ghostLink.textContent = "leave your ghost (level " + ghost.level + ")";
        ghostLink.hidden = false;
    }
    function haunt() {
        // The ghosts of this seed and level: yours first, then the ones sent in.
        ghosts = [];
        var seen = {};
        allGhosts().forEach(function (g) {
            if (!g || ghosts.length >= MOST || g.seed !== saved.seed || g.level !== L.level || seen[g.path]) return;
            var u = unpack(g.path);
            if (!u || u.seed !== g.seed || u.level !== g.level) return;
            seen[g.path] = 1;                                    // yours, once it is sent in, is one ghost
            ghosts.push({ pts: u.pts, hz: u.hz, t: -2 - ghosts.length * 1.5, rest: 0, by: g.by || null, mine: !!g.mine, seen: false, walked: 0, x: u.pts[0][0], z: u.pts[0][1], yaw: u.pts[0][2], done: false, lift: 0.22 + 0.07 * (ghosts.length % 4) });
        });
    }
    function walk(dt) {
        ghosts.forEach(function (g) {
            if (g.done) {
                g.rest += dt;
                if (g.rest > 20) { g.done = false; g.t = -1; g.rest = 0; g.x = g.pts[0][0]; g.z = g.pts[0][1]; }
                return;
            }
            g.t += dt;
            if (g.t < 0) return;
            var k = g.t * g.hz, n = g.pts.length - 1;
            if (k >= n) {
                g.done = true; g.x = g.pts[n][0]; g.z = g.pts[n][1];
                if (audio && g.seen && visible(g.x, g.z)) audio.tick();
                return;
            }
            var i = Math.floor(k), fr = k - i, a = g.pts[i], b = g.pts[i + 1];
            var x = a[0] + (b[0] - a[0]) * fr, z = a[1] + (b[1] - a[1]) * fr;
            g.walked += Math.hypot(x - g.x, z - g.z); g.x = x; g.z = z;
            var dy = Math.atan2(Math.sin(b[2] - a[2]), Math.cos(b[2] - a[2]));
            g.yaw = a[2] + dy * fr;
            if (!g.seen && visible(g.x, g.z) && Math.hypot(g.x - cam.x, g.z - cam.z) < fogRadius() * 0.8) {
                g.seen = true;
                if (!sawGhost) { sawGhost = true; say(g.mine ? "that is you. that was you. it is still walking." : "someone was here before you. they are still here, a little.", 6); }
                if (audio) audio.tick();
            }
        });
    }

    // ---- moving ------------------------------------------------------------
    var stick = { x: 0, y: 0 };       // the touch joystick, -1..1
    function move(dt) {
        var fwd = 0, side = 0, turn = 0;
        if (keys.KeyW || keys.ArrowUp) fwd += 1;
        if (keys.KeyS || keys.ArrowDown) fwd -= 1;
        if (keys.KeyA) side -= 1;
        if (keys.KeyD) side += 1;
        if (keys.ArrowLeft) turn -= 1;
        if (keys.ArrowRight) turn += 1;
        if (keys.KeyQ) side -= 1;
        if (keys.KeyE) side += 1;
        fwd += -stick.y; side += stick.x;
        var run = keys.ShiftLeft || keys.ShiftRight || Math.hypot(stick.x, stick.y) > 0.9;
        cam.yaw += turn * 2.2 * dt;
        var m = Math.hypot(fwd, side);
        if (m > 1) { fwd /= m; side /= m; }
        var v = (run ? RUN : WALK) * dt;
        var dx = (cam.fx * fwd + cam.rx * side) * v, dz = (cam.fz * fwd + cam.rz * side) * v;
        if (!blocked(cam.x + dx, cam.z)) cam.x += dx;
        if (!blocked(cam.x, cam.z + dz)) cam.z += dz;
        if (m > 0.1) {
            stepClock += dt * (run ? 1.7 : 1);
            if (stepClock > 0.5) { stepClock = 0; if (audio) audio.step(run); }
        }
        cam.y = EYE + (m > 0.1 ? Math.sin(clock * (run ? 14 : 9)) * 0.012 : 0);
        if (Math.floor(cam.x) === L.exit.x && Math.floor(cam.z) === L.exit.z) drop();
    }
    function blocked(x, z) {
        return cellAt(x - RADIUS, z - RADIUS) || cellAt(x + RADIUS, z - RADIUS) || cellAt(x - RADIUS, z + RADIUS) || cellAt(x + RADIUS, z + RADIUS);
    }
    function drop() {
        mode = "drop"; modeClock = 0;
        if (audio) audio.drop();
    }

    // ---- drawing -----------------------------------------------------------
    function resize() {
        DPR = Math.min(devicePixelRatio || 1, 2);
        W = stage.clientWidth; H = stage.clientHeight;
        canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
        f = Math.max((W / 2) / Math.tan(FOV / 2), (H / 2) / Math.tan(35 * Math.PI / 180));   // portrait: narrower, not taller
    }
    function toCam(x, y, z, out) {
        var dx = x - cam.x, dz = z - cam.z;
        out.x = dx * cam.rx + dz * cam.rz; out.y = y - cam.y; out.z = dx * cam.fx + dz * cam.fz;
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
        var a = 1 - d / fogRadius();
        if (a <= 0) return 0;
        if (a > 1) a = 1;
        return a * a * (3 - 2 * a);
    }
    var quads = [];
    function quad(kind, d, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
        quads.push({ kind: kind, d: d, p: [[ax, ay, az], [bx, by, bz], [cx, cy, cz], [dx, dy, dz]] });
    }
    function gather() {
        quads.length = 0;
        var R = Math.ceil(fogRadius()), px = Math.floor(cam.x), pz = Math.floor(cam.z), n = L.n;
        var tmp = { x: 0, y: 0, z: 0 };
        for (var z = Math.max(0, pz - R); z <= Math.min(n - 1, pz + R); z++) {
            for (var x = Math.max(0, px - R); x <= Math.min(n - 1, px + R); x++) {
                var c = z * n + x;
                if (L.grid[c]) continue;
                var cx = x + 0.5, cz = z + 0.5;
                toCam(cx, 0, cz, tmp);
                if (tmp.z < -1.2) continue;                       // behind you
                var h = L.height[c];
                var dd = Math.hypot(cx - cam.x, cz - cam.z);
                if (dd > fogRadius() + 0.7) continue;
                var isExit = (x === L.exit.x && z === L.exit.z);
                quad(isExit ? "exit" : "floor", Math.hypot(dd, cam.y), x, 0, z, x + 1, 0, z, x + 1, 0, z + 1, x, 0, z + 1);
                quad("ceil", Math.hypot(dd, h - cam.y), x, h, z, x + 1, h, z, x + 1, h, z + 1, x, h, z + 1);
                // Walls face the open cell; a step between ceilings gets a lintel.
                wall(x, z, h, x, z - 1, x, 0, z, x + 1, 0, z, x + 1, h, z, x, h, z);         // north
                wall(x, z, h, x + 1, z, x + 1, 0, z, x + 1, 0, z + 1, x + 1, h, z + 1, x + 1, h, z); // east
                wall(x, z, h, x, z + 1, x + 1, 0, z + 1, x, 0, z + 1, x, h, z + 1, x + 1, h, z + 1); // south
                wall(x, z, h, x - 1, z, x, 0, z + 1, x, 0, z, x, h, z, x, h, z + 1);         // west
            }
        }
        quads.sort(function (a, b) { return b.d - a.d; });
    }
    function wall(x, z, h, nx, nz, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
        var solid = cellAt(nx + 0.5, nz + 0.5);
        var lo = 0;
        if (!solid) {
            var hn = heightAt(nx + 0.5, nz + 0.5);
            if (hn >= h - 0.01) return;
            lo = hn;                                             // only the lintel
        }
        var mx = (ax + bx) / 2, mz = (az + bz) / 2, my = (lo + h) / 2;
        var d = Math.hypot(mx - cam.x, mz - cam.z, my - cam.y);
        quad(solid ? "wall" : "lintel", d, ax, lo, az, bx, lo, bz, cx, cy, cz, dx, dy, dz);
    }
    function render() {
        var col = color();
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, W, H);
        if (mode === "title") return;
        var horizon = H / 2 + cam.pitch * f;
        var glow = !slow;
        var tmp = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }];
        var bright = flicker * (blackout > 0 ? 0.08 : 1);
        ctx.lineJoin = "round";
        for (var i = 0; i < quads.length; i++) {
            var q = quads[i], a = fade(q.d) * bright;
            if (a <= 0.01) continue;
            for (var k = 0; k < 4; k++) toCam(q.p[k][0], q.p[k][1], q.p[k][2], tmp[k]);
            if (tmp[0].z < NEAR && tmp[1].z < NEAR && tmp[2].z < NEAR && tmp[3].z < NEAR) continue;
            var pts = clipNear(tmp);
            if (pts.length < 3) continue;
            ctx.beginPath();
            var left = Infinity, right = -Infinity;
            for (k = 0; k < pts.length; k++) {
                var sx = W / 2 + f * pts[k].x / pts[k].z, sy = horizon - f * pts[k].y / pts[k].z;
                if (sx < left) left = sx; if (sx > right) right = sx;
                if (k) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
            }
            if (right < 0 || left > W) continue;
            ctx.closePath();
            ctx.fillStyle = "#000";
            ctx.fill();
            ctx.strokeStyle = col;
            if (q.kind === "exit") {
                var pulse = 0.5 + 0.5 * Math.sin(clock * 4);
                ctx.globalAlpha = a; ctx.lineWidth = 2; ctx.stroke();
                exitBox(q, horizon, a * (0.4 + 0.6 * pulse), col);
                continue;
            }
            if (q.kind === "ceil" || q.kind === "floor") a *= 0.55;
            if (glow) { ctx.globalAlpha = a * 0.22; ctx.lineWidth = 3.2; ctx.stroke(); }
            ctx.globalAlpha = a; ctx.lineWidth = 0.7 + 0.9 * a; ctx.stroke();
        }
        ctx.globalAlpha = 1;
        notes(horizon, col, bright);
        figures(horizon, bright);
        apparitions(horizon, bright);
        hud(col);
        if (near < 3 && !REDUCED && mode === "play") glitch((3 - near) / 3);
        if (mode === "found") foundScreen();
        if (mode === "drop") dropScreen();
        ctx.globalAlpha = 1;
    }
    // The way down: a hatched pit with a column of light above it.
    function exitBox(q, horizon, a, col) {
        var x = q.p[0][0], z = q.p[0][2], h = heightAt(x + 0.5, z + 0.5), k;
        ctx.globalAlpha = a; ctx.lineWidth = 1;
        for (k = 1; k <= 3; k++) {
            var in_ = k * 0.12;
            poly([[x + in_, 0, z + in_], [x + 1 - in_, 0, z + in_], [x + 1 - in_, 0, z + 1 - in_], [x + in_, 0, z + 1 - in_]], horizon, true);
        }
        ctx.globalAlpha = a * 0.35;
        [[x, z], [x + 1, z], [x + 1, z + 1], [x, z + 1]].forEach(function (c) { segment(c[0], 0, c[1], c[0], h, c[1], horizon); });
        ctx.globalAlpha = a;
        label("NOCLIP", x + 0.5, h * 0.55, z + 0.5, horizon, col, 0.09);
    }
    function poly(p, horizon, close) {
        var pts = [], i;
        for (i = 0; i < p.length; i++) pts.push(toCam(p[i][0], p[i][1], p[i][2], { x: 0, y: 0, z: 0 }));
        pts = clipNear(pts);
        if (pts.length < 2) return;
        ctx.beginPath();
        for (i = 0; i < pts.length; i++) {
            var sx = W / 2 + f * pts[i].x / pts[i].z, sy = horizon - f * pts[i].y / pts[i].z;
            if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
        }
        if (close) ctx.closePath();
        ctx.stroke();
    }
    function segment(ax, ay, az, bx, by, bz, horizon) {
        var a = toCam(ax, ay, az, { x: 0, y: 0, z: 0 }), b = toCam(bx, by, bz, { x: 0, y: 0, z: 0 });
        if (a.z < NEAR && b.z < NEAR) return;
        if (a.z < NEAR || b.z < NEAR) {
            var t = (NEAR - a.z) / (b.z - a.z), m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR };
            if (a.z < NEAR) a = m; else b = m;
        }
        ctx.beginPath();
        ctx.moveTo(W / 2 + f * a.x / a.z, horizon - f * a.y / a.z);
        ctx.lineTo(W / 2 + f * b.x / b.z, horizon - f * b.y / b.z);
        ctx.stroke();
    }
    function label(text, x, y, z, horizon, col, size) {
        var p = toCam(x, y, z, { x: 0, y: 0, z: 0 });
        if (p.z < NEAR) return;
        var px = f * size / p.z;
        if (px < 5) return;
        ctx.font = Math.min(px, 48) + "px " + MONO;
        ctx.fillStyle = col;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(text, W / 2 + f * p.x / p.z, horizon - f * p.y / p.z);
    }
    // Notes on the walls, read when you are near enough.
    function notes(horizon, col, bright) {
        var dirs = [[0.5, 0.03], [0.97, 0.5], [0.5, 0.97], [0.03, 0.5]];
        L.notes.forEach(function (nt) {
            var x = nt.x + dirs[nt.face][0], z = nt.z + dirs[nt.face][1];
            var d = Math.hypot(x - cam.x, z - cam.z);
            if (d > fogRadius() * 0.7 || !visible(x, z)) return;
            var a = fade(d) * bright;
            if (d < 2.2 && !nt.seen) { nt.seen = true; if (audio) audio.tick(); }
            ctx.globalAlpha = a;
            label(nt.text, x, 0.5, z, horizon, d < 2.2 ? "#fff" : col, 0.06);
        });
        ctx.globalAlpha = 1;
    }
    // The figures: tall, thin, stooped under the ceiling, drawn as a few
    // lines facing you, with static where a face would be.
    function figures(horizon, bright) {
        things.forEach(function (t) {
            var d = Math.hypot(t.x - cam.x, t.z - cam.z);
            if (d > fogRadius() || !visible(t.x, t.z)) return;
            var a = Math.min(1, fade(d) * 1.6) * bright;
            if (!REDUCED && d > 3 && Math.random() < 0.12) return;           // it flickers, far off
            var h = Math.min(heightAt(t.x, t.z) - 0.04, 0.95), rx = cam.rx, rz = cam.rz;
            var j = REDUCED ? 0 : 0.004 * (1 + 3 / (d + 0.5));
            function P(u, v) { return [t.x + rx * u + (Math.random() - 0.5) * j, v, t.z + rz * u + (Math.random() - 0.5) * j]; }
            var wob = Math.sin(clock * 1.3 + t.wobble) * 0.02;
            var lines = [
                [P(0, 0.12), P(0, h * 0.78)],                                   // spine
                [P(0, h * 0.78), P(0.06 + wob, h * 0.92)], [P(0.06 + wob, h * 0.92), P(0.1 + wob, h * 0.84)], [P(0.1 + wob, h * 0.84), P(0.03, h * 0.8)], // the head, stooped
                [P(0, h * 0.7), P(0.11, h * 0.25)], [P(0, h * 0.7), P(-0.11, h * 0.25)],  // arms, long
                [P(0, 0.12), P(0.05, 0)], [P(0, 0.12), P(-0.05, 0)]            // legs
            ];
            ctx.strokeStyle = d < 2 ? "#ff2a2a" : "#ffffff";
            ctx.lineWidth = 1.2;
            ctx.globalAlpha = a * 0.3; ctx.lineWidth = 3.5;
            lines.forEach(function (s) { segment(s[0][0], s[0][1], s[0][2], s[1][0], s[1][1], s[1][2], horizon); });
            ctx.globalAlpha = a; ctx.lineWidth = 1.2;
            lines.forEach(function (s) { segment(s[0][0], s[0][1], s[0][2], s[1][0], s[1][1], s[1][2], horizon); });
            if (!REDUCED) for (var k = 0; k < 5; k++) {                         // static where the face is
                var u = (Math.random() - 0.5) * 0.08, v = h * 0.84 + (Math.random() - 0.5) * 0.08;
                segment(t.x + rx * u + 0.05, v, t.z + rz * u + 0.05, t.x + rx * (u + 0.03) + 0.05, v, t.z + rz * (u + 0.03) + 0.05, horizon);
            }
        });
        ctx.globalAlpha = 1;
    }
    // The ghosts: a person in a few lines, see-through, pale blue, walking
    // its last half minute with the legs it had; where it ends, a cross on
    // the floor and who it was.
    function apparitions(horizon, bright) {
        ghosts.forEach(function (g) {
            if (g.t < 0) return;
            var d = Math.hypot(g.x - cam.x, g.z - cam.z);
            if (d > fogRadius() || !visible(g.x, g.z)) return;
            var a = fade(d) * bright * 0.75;
            ctx.strokeStyle = "#8fe7ff";
            if (g.done) {
                ctx.lineWidth = 1.5; ctx.globalAlpha = a * (0.7 + 0.3 * Math.sin(clock * 2 + g.walked));
                segment(g.x - 0.22, 0.004, g.z - 0.22, g.x + 0.22, 0.004, g.z + 0.22, horizon);
                segment(g.x - 0.22, 0.004, g.z + 0.22, g.x + 0.22, 0.004, g.z - 0.22, horizon);
                ctx.globalAlpha = a * 0.9;
                label(g.mine ? "you were found here" : "found here" + (g.by ? " · " + g.by : ""), g.x, g.lift, g.z, horizon, "#8fe7ff", 0.045);
                return;
            }
            if (!REDUCED) a *= 0.7 + 0.3 * Math.random();        // it is not quite there
            var rx = cam.rx, rz = cam.rz, h = 0.62, swing = Math.sin(g.walked * 7) * 0.07;
            function P(u, v) { return [g.x + rx * u, v, g.z + rz * u]; }
            var lines = [
                [P(0, 0.16), P(0, h * 0.8)],                                                                   // body
                [P(-0.045, h * 0.8), P(0.045, h * 0.8)], [P(0.045, h * 0.8), P(0.045, h)], [P(0.045, h), P(-0.045, h)], [P(-0.045, h), P(-0.045, h * 0.8)], // head
                [P(0, h * 0.72), P(0.09, h * 0.45 + swing)], [P(0, h * 0.72), P(-0.09, h * 0.45 - swing)],   // arms
                [P(0, 0.16), P(0.06 + swing, 0)], [P(0, 0.16), P(-0.06 - swing, 0)]                            // legs
            ];
            ctx.globalAlpha = a * 0.25; ctx.lineWidth = 3;
            lines.forEach(function (s) { segment(s[0][0], s[0][1], s[0][2], s[1][0], s[1][1], s[1][2], horizon); });
            ctx.globalAlpha = a; ctx.lineWidth = 1;
            lines.forEach(function (s) { segment(s[0][0], s[0][1], s[0][2], s[1][0], s[1][1], s[1][2], horizon); });
        });
        ctx.globalAlpha = 1;
    }
    function hud(col) {
        ctx.font = "12px " + MONO; ctx.fillStyle = col; ctx.textBaseline = "top";
        ctx.globalAlpha = 0.85;
        ctx.textAlign = "left";
        ctx.fillText("LEVEL " + L.level, 14, 12);
        ctx.textAlign = "right";
        var s = Math.floor(levelClock), m = Math.floor(s / 60);
        ctx.fillText((m < 10 ? "0" : "") + m + ":" + (s % 60 < 10 ? "0" : "") + s % 60, W - 14, 12);
        if (msg.text && clock < msg.until) {
            var shown = Math.min(msg.text.length, Math.floor((clock - msg.at) * 32));
            ctx.textAlign = "left"; ctx.textBaseline = "bottom";
            ctx.font = (W < 500 ? 12 : 14) + "px " + MONO;
            wrap(msg.text.slice(0, shown) + (shown < msg.text.length ? "_" : ""), 14, H - 14, W - 28);
        }
        ctx.globalAlpha = 1;
    }
    function wrap(text, x, bottom, width) {
        var words = text.split(" "), lines = [], cur = "";
        words.forEach(function (w) {
            var t = cur ? cur + " " + w : w;
            if (ctx.measureText(t).width > width && cur) { lines.push(cur); cur = w; } else cur = t;
        });
        lines.push(cur);
        lines.reverse().forEach(function (l, i) { ctx.fillText(l, x, bottom - i * 18); });
    }
    function glitch(k) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        var w = canvas.width, h = canvas.height, slices = Math.ceil(k * 6);
        for (var i = 0; i < slices; i++) {
            var y = Math.floor(Math.random() * h), sh = 4 + Math.floor(Math.random() * 30 * k), dx = Math.round((Math.random() - 0.5) * 40 * k * DPR);
            ctx.drawImage(canvas, 0, y, w, sh, dx, y, w, sh);
        }
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    function foundScreen() {
        var t = modeClock;
        if (!REDUCED) glitch(Math.min(1, t * 2));
        ctx.globalAlpha = Math.min(1, t * 3) * (0.6 + 0.4 * Math.random());
        ctx.fillStyle = "#ff2a2a"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = "bold " + Math.min(72, W / 7) + "px " + MONO;
        ctx.fillText("FOUND", W / 2, H / 2);
        ctx.font = "13px " + MONO; ctx.fillStyle = "#fff";
        ctx.fillText("it puts you back at the start. it does not put you back the same.", W / 2, H / 2 + 50);
        if (lastGhost && lastGhost.level === L.level && t > 0.8) ctx.fillText("your last thirty seconds stay here, walking.", W / 2, H / 2 + 72);
        ctx.globalAlpha = 1;
    }
    function dropScreen() {
        var t = modeClock;
        ctx.fillStyle = "#000"; ctx.globalAlpha = Math.min(1, t * 1.2); ctx.fillRect(0, 0, W, H);
        if (t > 0.9) {
            ctx.globalAlpha = Math.min(1, (t - 0.9) * 2);
            ctx.fillStyle = color(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.font = Math.min(40, W / 10) + "px " + MONO;
            ctx.fillText("LEVEL " + (L.level + 1), W / 2, H / 2);
        }
        ctx.globalAlpha = 1;
    }
    function say(text, seconds) { msg.text = text; msg.at = clock; msg.until = clock + seconds + text.length / 32; }

    // ---- the loop ----------------------------------------------------------
    function frame(now) {
        requestAnimationFrame(frame);
        var dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000 || 0));
        var t0 = performance.now();
        lastFrame = now;
        clock += dt; modeClock += dt;
        if (ELF) hue = (hue + dt * 12) % 360;
        if (mode === "play") {
            levelClock += dt;
            cam.fx = Math.sin(cam.yaw); cam.fz = Math.cos(cam.yaw); cam.rx = Math.cos(cam.yaw); cam.rz = -Math.sin(cam.yaw);
            move(dt);
            stalk(dt);
            record(dt);
            walk(dt);
            // The lights are old.
            if (!REDUCED) {
                if (blackout > 0) blackout -= dt;
                else if (Math.random() < dt * (0.25 + L.level * 0.05)) flicker = 0.35 + Math.random() * 0.4;
                else flicker += (1 - flicker) * Math.min(1, dt * 18);
                if (L.level >= 3 && Math.random() < dt * 0.02) blackout = 0.15 + Math.random() * 0.3;
            }
            if (audio) audio.near(near, L.level);
            if (!sawExit && visible(L.exit.x + 0.5, L.exit.z + 0.5)) { sawExit = true; say("there. the way down.", 4); }
        } else if (mode === "found" && modeClock > 2.4) {
            enter(L.level, true);                 // back to the start; it has moved
            mode = "play";
        } else if (mode === "drop" && modeClock > 2.2) {
            enter(L.level + 1);
            mode = "play";
        }
        cam.fx = Math.sin(cam.yaw); cam.fz = Math.cos(cam.yaw); cam.rx = Math.cos(cam.yaw); cam.rz = -Math.sin(cam.yaw);
        if (mode !== "title") { gather(); render(); }
        var took = performance.now() - t0;
        slow = took > 18 ? Math.min(slow + 1, 30) : Math.max(slow - 1, 0);   // drop the glow when the frame is slow
    }

    // ---- input -------------------------------------------------------------
    addEventListener("keydown", function (e) {
        if (mode === "title" || mode === "pause") return;
        if (e.code === "Escape") return;
        keys[e.code] = true;
        if (/^(Arrow|Key[WASDQE]|Shift)/.test(e.code)) e.preventDefault();
    });
    addEventListener("keyup", function (e) { keys[e.code] = false; });
    addEventListener("blur", function () { keys = {}; });

    var locked = false, lockable = !!canvas.requestPointerLock;
    function lock() {
        if (TOUCH || locked || !lockable) return;
        try {
            var p = canvas.requestPointerLock();
            if (p && p.catch) p.catch(function () { lockable = false; });
        } catch (e) { lockable = false; }
    }
    canvas.addEventListener("click", function () { if (mode === "play") lock(); });
    document.addEventListener("pointerlockchange", function () {
        locked = document.pointerLockElement === canvas;
        if (!locked && mode === "play") pause("paused. click to go on.");
    });
    addEventListener("mousemove", function (e) {
        if (!locked || mode !== "play") return;
        cam.yaw += e.movementX * 0.0022;
        cam.pitch = Math.max(-0.5, Math.min(0.5, cam.pitch - e.movementY * 0.0022));
    });
    // Touch: the left thumb walks, the right thumb looks.
    var touches = {};
    canvas.addEventListener("pointerdown", function (e) {
        if (mode !== "play" || locked) return;
        if (e.pointerType !== "touch" && e.button !== 0) return;
        var r = canvas.getBoundingClientRect();
        touches[e.pointerId] = { x: e.clientX, y: e.clientY, side: e.pointerType === "touch" && e.clientX - r.left < r.width / 2 ? "walk" : "look" };
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    canvas.addEventListener("pointermove", function (e) {
        var t = touches[e.pointerId];
        if (!t) return;
        if (t.side === "walk") {
            stick.x = Math.max(-1, Math.min(1, (e.clientX - t.x) / 50));
            stick.y = Math.max(-1, Math.min(1, (e.clientY - t.y) / 50));
        } else {
            cam.yaw += (e.clientX - t.x) * 0.006;
            cam.pitch = Math.max(-0.5, Math.min(0.5, cam.pitch - (e.clientY - t.y) * 0.004));
            t.x = e.clientX; t.y = e.clientY;
        }
        e.preventDefault();
    });
    function endTouch(e) {
        var t = touches[e.pointerId];
        if (!t) return;
        if (t.side === "walk") stick.x = stick.y = 0;
        delete touches[e.pointerId];
    }
    canvas.addEventListener("pointerup", endTouch);
    canvas.addEventListener("pointercancel", endTouch);
    document.addEventListener("visibilitychange", function () { if (document.hidden && mode === "play") pause("paused. the hum goes on without you."); });

    // ---- the veil: title, pause --------------------------------------------
    function pause(text) {
        mode = "pause"; keys = {}; stick.x = stick.y = 0;
        veilText.textContent = text;
        go.textContent = "go on";
        veil.hidden = false;
        if (audio) audio.quiet(true);
    }
    function begin() {
        if (!audio && saved.sound) audio = makeAudio();
        if (audio) { audio.quiet(false); audio.level(L ? L.level : saved.level); }
        if (mode === "title") enter(saved.level);
        mode = "play"; modeClock = 0;
        veil.hidden = true;
        lock();
    }
    go.addEventListener("click", begin);
    resetButton.addEventListener("click", function () {
        saved.seed = freshSeed(); saved.level = 0; save();
        if (document.exitPointerLock) document.exitPointerLock();
        mode = "title"; things = [];
        title();
    });
    // Fullscreen, or the nearest thing: iPhones have no Fullscreen API for
    // anything but video (Safari and Chrome alike), so there the stage is
    // pinned over the page instead, with a button to let it go.
    function filled() { return stage.classList.contains("filled"); }
    function fill(on) {
        stage.classList.toggle("filled", on);
        document.body.classList.toggle("filled", on);
        if (unfillButton) unfillButton.hidden = !on;
        fullButton.setAttribute("aria-pressed", on ? "true" : "false");
        setTimeout(resize, 50);
    }
    function fullscreen() {
        if (document.fullscreenElement) { document.exitFullscreen(); return; }
        if (filled()) { fill(false); return; }
        if (stage.requestFullscreen) {
            var p = stage.requestFullscreen();
            if (p && p.catch) p.catch(function () { fill(true); });
            return;
        }
        fill(true);
    }
    fullButton.addEventListener("click", fullscreen);
    if (unfillButton) unfillButton.addEventListener("click", function () { fill(false); });
    addEventListener("keydown", function (e) { if (e.code === "Escape" && filled()) fill(false); });
    soundButton.addEventListener("click", function () {
        saved.sound = saved.sound ? 0 : 1; save();
        soundButton.setAttribute("aria-pressed", saved.sound ? "true" : "false");
        if (!saved.sound && audio) { audio.quiet(true); }
        if (saved.sound && !audio) audio = makeAudio();
        if (saved.sound && audio && mode === "play") { audio.quiet(false); audio.level(L.level); }
    });
    soundButton.setAttribute("aria-pressed", saved.sound ? "true" : "false");
    function title() {
        var how = TOUCH ? "left thumb walks, right thumb looks." : "wasd or arrows walk, the mouse looks, shift runs, esc pauses.";
        veilText.textContent = (saved.level ? "you fell to level " + saved.level + " last time. it is still there. " : "you noclipped out of rickseufert.com. ") + how + " find the way down. do not let it reach you.";
        go.textContent = saved.level ? "go back down" : "noclip";
        veil.hidden = false;
        if (audio) audio.quiet(true);
    }

    // ---- sound: the hum, the steps, the thing ------------------------------
    var audio = null;
    function makeAudio() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        var ac = new AC(), master = ac.createGain();
        master.gain.value = 0; master.connect(ac.destination);
        if (window.Unmute) Unmute(ac);
        // A phone's speaker carries nothing much under 300 Hz, so on a touch
        // screen the hum is let through brighter, with a harmonic, and the
        // steps are higher, and everything is louder.
        var PHONE = TOUCH, LOUD = PHONE ? 0.9 : 0.6;
        function osc(type, freq, gain, dest) {
            var o = ac.createOscillator(), g = ac.createGain();
            o.type = type; o.frequency.value = freq; g.gain.value = gain;
            o.connect(g); g.connect(dest || master); o.start();
            return { o: o, g: g };
        }
        var lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = PHONE ? 700 : 220; lp.connect(master);
        var hum1 = osc("sawtooth", 60, PHONE ? 0.07 : 0.05, lp), hum2 = osc("sine", 120, PHONE ? 0.04 : 0.02), hum3 = osc("sine", 60.7, 0.025), hum4 = osc("sine", 180, PHONE ? 0.03 : 0);
        var lfo = osc("sine", 0.11, 60, null); lfo.g.disconnect(); lfo.g.connect(lp.frequency);
        var thing = osc("sine", 38, 0), whine = osc("sine", 1870, 0), wlfo = osc("sine", 6, 9, null);
        wlfo.g.disconnect(); wlfo.g.connect(whine.o.frequency);
        var noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), data = noise.getChannelData(0);
        for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        function burst(len, gain, freq, type) {
            var s = ac.createBufferSource(), g = ac.createGain(), fl = ac.createBiquadFilter();
            s.buffer = noise; fl.type = type || "lowpass"; fl.frequency.value = freq;
            g.gain.setValueAtTime(gain, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + len);
            s.connect(fl); fl.connect(g); g.connect(master); s.start(); s.stop(ac.currentTime + len);
        }
        var quietNow = true, base = 60;
        return {
            quiet: function (q) {
                quietNow = q;
                if (ac.state === "suspended") ac.resume();
                master.gain.cancelScheduledValues(ac.currentTime);
                master.gain.setValueAtTime(master.gain.value, ac.currentTime);
                master.gain.linearRampToValueAtTime(q ? 0 : LOUD, ac.currentTime + 0.4);
            },
            level: function (level) {
                base = 60 * Math.pow(2, -level / 12);          // a semitone lower each level
                var t = ac.currentTime + 1.5;
                hum1.o.frequency.exponentialRampToValueAtTime(base, t);
                hum2.o.frequency.exponentialRampToValueAtTime(base * 2, t);
                hum3.o.frequency.exponentialRampToValueAtTime(base * 1.012, t);
                hum4.o.frequency.exponentialRampToValueAtTime(base * 3, t);
            },
            near: function (d, level) {
                var k = Math.max(0, 1 - d / 8); k *= k;
                thing.g.gain.setTargetAtTime(k * 0.35, ac.currentTime, 0.1);
                whine.g.gain.setTargetAtTime(k * 0.012, ac.currentTime, 0.1);
            },
            step: function (run) { burst(0.09, run ? 0.25 : 0.16, PHONE ? 1200 : 320); },
            tick: function () { burst(0.04, 0.12, 4000, "bandpass"); },
            found: function () {
                burst(1.2, 0.7, 1200);
                var o = osc("sawtooth", 420, 0.3);
                o.o.frequency.exponentialRampToValueAtTime(28, ac.currentTime + 1.4);
                o.g.gain.setValueAtTime(0.3, ac.currentTime); o.g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1.6);
                o.o.stop(ac.currentTime + 1.7);
            },
            drop: function () {
                var o = osc("sine", 180, 0.25);
                o.o.frequency.exponentialRampToValueAtTime(30, ac.currentTime + 1.6);
                o.g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 2);
                o.o.stop(ac.currentTime + 2.1);
                burst(1.8, 0.2, 500);
            }
        };
    }

    // ---- go ----------------------------------------------------------------
    // The ghosts sent in, from the sky-data branch, with the copy on master
    // as the fallback; the page is whole without them.
    fetch("https://raw.githubusercontent.com/rseufert/rseufert.github.io/sky-data/ghosts.json", { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .catch(function () { return fetch("/data/ghosts.json").then(function (r) { return r.json(); }); })
        .then(function (b) {
            if (!b || !Array.isArray(b.ghosts)) return;
            book = b;
            if (L && mode !== "title") haunt();
            save();
        })
        .catch(function () { /* unhaunted */ });
    if (localGhosts().length) offer(localGhosts()[0]);
    resize();
    addEventListener("resize", resize);
    document.addEventListener("fullscreenchange", function () { setTimeout(resize, 50); });
    save();
    title();
    requestAnimationFrame(frame);
    window.Backrooms = { generate: generate, field: field, pack: pack, unpack: unpack, state: function () { return { mode: mode, cam: cam, level: L, things: things, ghosts: ghosts, msg: msg, clock: clock, saved: saved }; }, render: function () { gather(); render(); } };
})();
