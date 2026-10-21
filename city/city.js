// The overworld of rickseufert.com (city/index.html).
//
// The site as a city, in wireframe, laid out from the date: every part of
// it is a building you can walk up to and enter. The arena is a stadium
// with a live match on the scoreboard, the Julia set is the river, the
// dashboard is a weather station on a hill, the blog is a row of mailboxes,
// the backrooms are a manhole, rickbot runs the helpdesk kiosk on the
// plaza, Dick Dank is on at the venue, and the mocks are the towers. The
// streets are named in the elves' script, which drifts back into English
// while you stand still. It rebuilds itself at midnight.
//
// Drawn the way the backrooms are drawn: quads filled black and stroked,
// painted back to front, on a plain canvas. No WebGL, no libraries. The
// arena's own engine runs the match on the scoreboard if it loaded.
(function () {
    "use strict";
    var canvas = document.getElementById("city-stage");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var stage = canvas.parentNode;
    var veil = document.getElementById("city-veil");
    var veilText = document.getElementById("city-veil-text");
    var go = document.getElementById("city-go");
    var soundButton = document.getElementById("city-sound");
    var fullButton = document.getElementById("city-full");
    var enterButton = document.getElementById("city-enter");
    var whereOut = document.getElementById("city-where");

    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace';
    var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var TOUCH = window.matchMedia && matchMedia("(hover: none) and (pointer: coarse)").matches;
    var ELF = false;
    try { ELF = !!localStorage.getItem("elf"); } catch (e) { /* no storage */ }

    var NEAR = 0.1, EYE = 1.7, FOV = 75 * Math.PI / 180, FOG = 80, WALK = 7, RUN = 12;
    var N = 7, BLOCK = 28, STREET = 10, PITCH = BLOCK + STREET, SIZE = N * PITCH + STREET;

    // ---- the day --------------------------------------------------------------
    function today() { var d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
    var seed = (function () { var m = /seed=(\d+)/.exec(location.hash); return m ? +m[1] : today(); }());
    var forcedHour = (function () { var m = /hour=(\d+(\.\d+)?)/.exec(location.hash); return m ? +m[1] : null; }());
    function hourNow() { if (forcedHour !== null) return forcedHour; var d = new Date(); return d.getHours() + d.getMinutes() / 60; }

    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function hash(a, b, c) {
        var h = Math.imul((a | 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((b | 0) + 0x1234567, 0xC2B2AE35) ^ Math.imul((c | 0) + 7, 0x27D4EB2F);
        h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12;
        return (h >>> 0) / 4294967296;
    }
    var rand = mulberry32(seed);
    function pick(a) { return a[Math.floor(rand() * a.length)]; }

    // ---- the scene -------------------------------------------------------------
    var boxes = [], flats = [], polys = [], labels = [], doors = [], signs = [], anims = [];
    var plaza = { i: 3, j: 3 }, river = null, hole = null, arena = null, spawn = null;
    function origin(i, j) { return { x: -SIZE / 2 + STREET + i * PITCH, z: -SIZE / 2 + STREET + j * PITCH }; }
    // A box: x, z its south-west corner on the ground, w east, d north, h up, y0 its base.
    function box(x, z, w, d, h, o) {
        o = o || {};
        var b = { x: x, z: z, w: w, d: d, h: h, y0: o.y0 || 0, col: o.col || null, solid: o.solid !== false, lit: o.lit !== false, name: o.name || null, id: boxes.length };
        boxes.push(b);
        if (o.label) label(o.label, x + w / 2, b.y0 + h + 1.2, z + d / 2, 0.9, o.col);
        return b;
    }
    function flat(pts, o) { o = o || {}; flats.push({ pts: pts, closed: !!o.closed, col: o.col || null, dash: o.dash || 0, y: o.y || 0.01 }); }
    function poly(pts, o) { o = o || {}; var p = { pts: pts, col: o.col || null, width: o.width || 1, closed: !!o.closed }; polys.push(p); return p; }
    function label(text, x, y, z, size, col, o) { var l = { text: text, x: x, y: y, z: z, size: size || 0.8, col: col || null, elf: !!(o && o.elf), align: (o && o.align) || "center" }; labels.push(l); return l; }
    function door(x, z, name, link, kind, r) { var d = { x: x, z: z, name: name, link: link, kind: kind || "link", r: r || 2.4 }; doors.push(d); return d; }
    function ring(cx, cz, r, n, o) { var pts = []; for (var i = 0; i < n; i++) pts.push([cx + Math.cos(i / n * Math.PI * 2) * r, cz + Math.sin(i / n * Math.PI * 2) * r]); flat(pts, Object.assign({ closed: true }, o || {})); }
    function pole(x, z, h, o) { return poly([[x, 0, z], [x, h, z]], o); }

    var LORE = ["NO COOKIES", "EST. 2016", "PLAIN HTML", "SAP GUI 1998", "997 ACCEPTED", "ISA*00*", "TILDE SEPARATED", "IDOC STORAGE", "PAIN.001", "MT940", "X12", "UBL", "CRON 04:17", "60 HZ",
        "VAN MAILBOX", "LOADING...", "BEST VIEWED AT 800X600", "DO NOT REBOOT", "MOCKS ALL THE WAY DOWN", "THE ELVES WERE HERE", "SEVENTEEN", "WIDE RIGHT", "NETSCAPE NAVIGATOR", "GUEST BOOK", "404"];
    var EW = ["SAP ST", "X12 AVE", "997 WAY", "BURNSIDE", "IDOC ALLEY", "ELF ST", "60 HZ BLVD", "COOKIE ST"];
    var NS = ["JULIA WAY", "ALPHABET ST", "MORRISON", "KUDASAI AVE", "TILDE ST", "DANK ST", "ALLEN AVE", "MOCK ROW"];
    var POSTS = (window.CityPosts && window.CityPosts.length) ? window.CityPosts : [{ title: "rick seufert site launched", url: "/blog/" }];

    function build() {
        var blocks = [];
        for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) if (!(i === plaza.i && j === plaza.j)) blocks.push({ i: i, j: j });
        for (var k = blocks.length - 1; k > 0; k--) { var m = Math.floor(rand() * (k + 1)), t = blocks[k]; blocks[k] = blocks[m]; blocks[m] = t; }
        // The river runs along one east-west street, not the plaza's.
        var row = pick([1, 2, 5, 6]);
        river = { z0: origin(0, row).z - STREET, z1: origin(0, row).z, row: row };
        var builders = [theArena, theMocks, theDashboard, theFlipper, theBlog, theVenue, theShop, theCinema];
        builders.forEach(function (fn, n) { var b = blocks[n], o = origin(b.i, b.j); fn(o.x, o.z, b); });
        blocks.slice(builders.length).forEach(function (b) { var o = origin(b.i, b.j); filler(o.x, o.z, b); });
        thePlaza();
        // Curbs round every block, and the streets' centre lines.
        for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
            var o = origin(i, j);
            flat([[o.x, o.z], [o.x + BLOCK, o.z], [o.x + BLOCK, o.z + BLOCK], [o.x, o.z + BLOCK]], { closed: true, col: "#5a6a7a" });
        }
        for (i = 0; i <= N; i++) {
            var c = -SIZE / 2 + STREET / 2 + i * PITCH;
            flat([[c, -SIZE / 2], [c, SIZE / 2]], { dash: 3, col: "#4a5a6a" });
            if (i !== river.row) flat([[-SIZE / 2, c], [SIZE / 2, c]], { dash: 3, col: "#4a5a6a" });
        }
        theRiver();
        // Street signs at every corner, in the elves' hand.
        for (j = 0; j <= N; j++) for (i = 0; i <= N; i++) {
            var sx = -SIZE / 2 + STREET + i * PITCH - 1, sz = -SIZE / 2 + STREET + j * PITCH - 1;
            if (j === river.row) continue;
            pole(sx, sz, 2.8, { col: "#6a7a8a" });
            signs.push({ x: sx, z: sz, lines: [EW[j % EW.length], NS[i % NS.length]] });
        }
        // The manhole, in a street away from the plaza.
        var hi = pick([0, 1, 5, 6]), hj = pick([0, 1, 5, 6]);
        hole = { x: -SIZE / 2 + STREET / 2 + hi * PITCH + 2, z: -SIZE / 2 + STREET / 2 + hj * PITCH - 2 };
        ring(hole.x, hole.z, 0.9, 16, { col: "#ffb000" }); ring(hole.x, hole.z, 0.6, 12, { col: "#ffb000" });
        flat([[hole.x - 0.6, hole.z], [hole.x + 0.6, hole.z]], { col: "#ffb000" }); flat([[hole.x, hole.z - 0.6], [hole.x, hole.z + 0.6]], { col: "#ffb000" });
        label("NOCLIP", hole.x, 0.5, hole.z, 0.35, "#ffb000");
        door(hole.x, hole.z, "the backrooms", "/backrooms/", "hole", 0.9);
        // Lamp posts along the river and at the plaza.
        spawn = { x: origin(plaza.i, plaza.j).x + BLOCK / 2 - 2, z: origin(plaza.i, plaza.j).z - STREET - 6, yaw: 0.15 };
    }
    function filler(x, z, b) {
        var n = 1 + Math.floor(rand() * 3), used = [];
        for (var k = 0; k < n; k++) {
            var w = 6 + Math.floor(rand() * 10), d = 6 + Math.floor(rand() * 10), h = 5 + Math.floor(rand() * rand() * 42);
            var bx = x + 1 + Math.floor(rand() * (BLOCK - w - 2)), bz = z + 1 + Math.floor(rand() * (BLOCK - d - 2)), ok = true;
            used.forEach(function (u) { if (bx < u.x + u.w + 1 && bx + w + 1 > u.x && bz < u.z + u.d + 1 && bz + d + 1 > u.z) ok = false; });
            if (!ok) continue;
            used.push({ x: bx, z: bz, w: w, d: d });
            box(bx, bz, w, d, h, { label: rand() < 0.35 ? pick(LORE) : null, col: h > 30 ? "#c9d2dc" : null });
        }
    }
    function thePlaza() {
        var o = origin(plaza.i, plaza.j), cx = o.x + BLOCK / 2, cz = o.z + BLOCK / 2;
        // The fountain is a Julia set, which is to say it goes round.
        [5, 3.5, 2].forEach(function (r) { ring(cx, cz, r, 24, { col: "julia" }); });
        anims.push({ fountain: true, x: cx, z: cz });
        // The helpdesk, with rickbot in it.
        box(cx - 1.5, cz + 7, 3, 3, 3, { col: "#00e5ff", label: "HELPDESK" });
        label("RICKBOT IS IN", cx, 2.2, cz + 7 - 0.05, 0.3, "#00e5ff");
        door(cx, cz + 6, "the helpdesk", "chat", "chat", 2.2);
        // The town sign at the south gate.
        var sx = cx + 8, sz = o.z - 2.5;
        poly([[sx - 3, 1.6, sz], [sx + 3, 1.6, sz], [sx + 3, 3.8, sz], [sx - 3, 3.8, sz]], { closed: true, col: "#ffffff" });
        pole(sx - 2.6, sz, 1.6, { col: "#ffffff" }); pole(sx + 2.6, sz, 1.6, { col: "#ffffff" });
        label("RICKSEUFERT.COM", sx, 3.35, sz - 0.02, 0.5, "#ffffff");
        label("EST. 2016 · POP. 1 · REBUILT AT MIDNIGHT", sx, 2.75, sz - 0.02, 0.28, "#ffffff");
        label("PLAIN HTML · NO COOKIES · ELVES", sx, 2.2, sz - 0.02, 0.28, "#ffffff");
        // Lamps at the corners.
        [[o.x + 2, o.z + 2], [o.x + BLOCK - 2, o.z + 2], [o.x + 2, o.z + BLOCK - 2], [o.x + BLOCK - 2, o.z + BLOCK - 2]].forEach(function (p) {
            pole(p[0], p[1], 4.5, { col: "#8a9aaa" });
            poly([[p[0] - 0.3, 4.5, p[1] - 0.3], [p[0] + 0.3, 4.5, p[1] - 0.3], [p[0] + 0.3, 4.5, p[1] + 0.3], [p[0] - 0.3, 4.5, p[1] + 0.3]], { closed: true, col: "#ffe9a0" });
        });
    }
    function theArena(x, z) {
        var cx = x + BLOCK / 2, cz = z + BLOCK / 2, r = 12;
        // Eight walls round the sand, a gap at the south, floodlights at the corners.
        for (var i = 0; i < 8; i++) {
            if (i === 6) continue;                                   // the gate
            var a0 = (i + 0.5) / 8 * Math.PI * 2, a1 = (i + 1.5) / 8 * Math.PI * 2;
            poly([[cx + Math.cos(a0) * r, 0, cz + Math.sin(a0) * r], [cx + Math.cos(a1) * r, 0, cz + Math.sin(a1) * r], [cx + Math.cos(a1) * r, 5, cz + Math.sin(a1) * r], [cx + Math.cos(a0) * r, 5, cz + Math.sin(a0) * r]], { closed: true, col: "#ffd27a", wall: true });
        }
        [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(function (s) {
            var px = cx + s[0] * 13, pz = cz + s[1] * 13;
            pole(px, pz, 16, { col: "#ffd27a" });
            poly([[px - 1, 16, pz], [px + 1, 16, pz], [px + 1, 17.5, pz], [px - 1, 17.5, pz]], { closed: true, col: "#ffffff" });
        });
        // The scoreboard, facing the gate; the match is drawn on it each frame.
        var bx = cx, bz = cz + 11, bw = 16, bh = 9, by = 6;
        poly([[bx - bw / 2, by, bz], [bx + bw / 2, by, bz], [bx + bw / 2, by + bh, bz], [bx - bw / 2, by + bh, bz]], { closed: true, col: "#ffd27a", wall: true });
        pole(bx - bw / 2 + 1, bz + 0.3, by, { col: "#ffd27a" }); pole(bx + bw / 2 - 1, bz + 0.3, by, { col: "#ffd27a" });
        arena = { x: bx - bw / 2, y: by, z: bz - 0.05, w: bw, h: bh, cx: cx, cz: cz };
        label("THE ARENA", cx, by + bh + 1.4, bz, 1.1, "#ffd27a");
        door(cx, cz - r - 1.5, "the arena", "/arena/", "link", 3);
    }
    function theMocks(x, z) {
        box(x + 1, z + 15, 11, 11, 36, { col: "#c9d2dc", label: "SAP TOWER" });
        label("IDOCS SLEEP HERE", x + 6.5, 20, z + 15 - 0.05, 0.4, "#c9d2dc");
        door(x + 6.5, z + 13.5, "mock-sap", "/mock-sap/");
        box(x + 1, z + 2, 24, 5, 6, { col: "#c9d2dc", label: "THE EDI CORRIDOR" });
        label("ISA*00*          *00*          *ZZ*ACME", x + 13, 3, z + 2 - 0.05, 0.3, "#c9d2dc");
        door(x + 13, z + 0.5, "mock-edi", "/mock-edi/");
        box(x + 15, z + 15, 11, 11, 14, { col: "#c9d2dc", label: "THE MOCK BANK" });
        for (var k = 0; k < 4; k++) pole(x + 16.5 + k * 2.6, z + 14.4, 6, { col: "#c9d2dc" });
        door(x + 20.5, z + 13.5, "mock-bank", "/mock-bank/");
        box(x + 1, z + 9, 8, 4, 22, { col: "#c9d2dc", label: "UBL" });
        door(x + 5, z + 7.5, "mock-einvoice", "/mock-einvoice/");
        box(x + 20, z + 9, 6, 4, 8, { col: "#c9d2dc", label: "ACME TREASURY" });
        door(x + 23, z + 7.5, "acme-treasury", "/acme-treasury/");
    }
    function theDashboard(x, z) {
        var cx = x + BLOCK / 2, cz = z + BLOCK / 2;
        // A hill of contour rings, a station on top, a mast with a light and an anemometer.
        [[12, 0], [9, 0.9], [6, 1.8], [3.5, 2.6]].forEach(function (c) {
            var pts = []; for (var i = 0; i < 28; i++) pts.push([cx + Math.cos(i / 28 * Math.PI * 2) * c[0], c[1], cz + Math.sin(i / 28 * Math.PI * 2) * c[0]]);
            poly(pts, { closed: true, col: "#8fe7ff" });
        });
        box(cx - 2, cz - 2, 4, 4, 2.6, { y0: 3, col: "#8fe7ff", label: "THE DASHBOARD" });
        label("16 APIS · STILL REFRESHING", cx, 4.6, cz - 2 - 0.05, 0.28, "#8fe7ff");
        pole(cx + 1.2, cz + 1.2, 14, { col: "#8fe7ff" });
        var cups = poly([], { col: "#ffffff" }), light = poly([[cx + 1.0, 14, cz + 1.2], [cx + 1.4, 14, cz + 1.2]], { col: "#ff3d9a", width: 3 });
        anims.push({ cups: cups, light: light, x: cx + 1.2, z: cz + 1.2 });
        door(cx, cz - 4, "the dashboard", "/dashboard/", "link", 2.6);
    }
    function theFlipper(x, z) {
        var cx = x + BLOCK / 2, cz = z + BLOCK / 2;
        box(cx - 6, cz - 3, 12, 7, 5, { col: "#ff8c1a", label: "THE FLIPPER NEST" });
        // A Flipper the size of a car, parked outside: the screen and the d-pad.
        box(cx - 4, cz - 9, 8, 3, 2.2, { col: "#ff8c1a" });
        poly([[cx - 3.2, 1.2, cz - 9.05], [cx + 0.6, 1.2, cz - 9.05], [cx + 0.6, 2.0, cz - 9.05], [cx - 3.2, 2.0, cz - 9.05]], { closed: true, col: "#ffffff" });
        for (var k = 1; k < 4; k++) poly([[cx - 3.2, 1.2 + k * 0.2, cz - 9.06], [cx + 0.6, 1.2 + k * 0.2, cz - 9.06]], { col: "#ffd9b0" });
        label("DOLPHIN", cx - 1.3, 1.6, cz - 9.07, 0.22, "#ff8c1a");
        var dp = []; for (var i = 0; i < 12; i++) dp.push([cx + 2.4 + Math.cos(i / 12 * Math.PI * 2) * 0.6, 1.6 + Math.sin(i / 12 * Math.PI * 2) * 0.6, cz - 9.05]);
        poly(dp, { closed: true, col: "#ffffff" });
        label("SIX APPS · 128X64 · ONE BUZZER", cx, 3.3, cz - 3 - 0.05, 0.3, "#ff8c1a");
        door(cx, cz - 4.5, "the flipper nest", "/#flipper", "link", 2.6);
    }
    function theBlog(x, z) {
        var cx = x + BLOCK / 2, cz = z + 4, n = Math.min(POSTS.length, 6);
        label("THE BLOG", cx, 4.2, cz + 2, 1.0, "#b6ff3a");
        label("MAIL IS ANSWERED IN ORDER OF ARRIVAL. 2016 IS NEXT.", cx, 3.3, cz + 2, 0.28, "#b6ff3a");
        for (var i = 0; i < n; i++) {
            var px = cx + (i - (n - 1) / 2) * 4;
            pole(px, cz, 1.2, { col: "#b6ff3a" });
            box(px - 0.45, cz - 0.35, 0.9, 0.7, 0.6, { y0: 1.2, col: "#b6ff3a", lit: false });
            poly([[px + 0.45, 1.5, cz], [px + 0.9, 1.5, cz], [px + 0.9, 1.9, cz], [px + 0.45, 1.9, cz]], { closed: true, col: "#ff3d9a" });
            var t = POSTS[i].title.toUpperCase(); if (t.length > 26) t = t.slice(0, 25) + "…";
            label(t, px, 2.4, cz, 0.22, "#b6ff3a");
            door(px, cz - 1.2, POSTS[i].title, POSTS[i].url, "link", 1.4);
        }
    }
    function theVenue(x, z) {
        var cx = x + BLOCK / 2, cz = z + BLOCK / 2;
        box(cx - 8, cz - 4, 16, 11, 9, { col: "#c288ff", label: "THE LOFT" });
        box(cx - 7, cz - 5.2, 14, 1.2, 2, { y0: 5, col: "#c288ff", lit: false });
        var marq = label("DICK DANK · TONIGHT · SOLD OUT", cx, 6, cz - 5.25, 0.42, "#ffffff");
        anims.push({ marquee: marq });
        [[-6.5, 0], [6.5, 0]].forEach(function (s) { for (var k = 0; k < 3; k++) box(cx + s[0] - 0.7, cz - 6.2, 1.4, 1.1, 1.1, { y0: k * 1.15, col: "#c288ff", lit: false }); });
        label("ONE PLAYER OPEN AT A TIME", cx, 3.6, cz - 4 - 0.05, 0.3, "#c288ff");
        door(cx, cz - 6.5, "the media loft", "/media/", "link", 2.6);
    }
    function theShop(x, z) {
        var cx = x + BLOCK / 2, cz = z + 8;
        box(cx - 5, cz, 10, 8, 5, { col: "#ff5a2e", label: "KULTURE KUDASAI" });
        label("FOLKLORE · SKELETONS · PORTLAND BARS", cx, 3.9, cz - 0.05, 0.28, "#ff5a2e");
        // A skeleton in the window, hand-knit.
        var sx = cx + 2.5, sz = cz - 0.08;
        poly([[sx, 1.0, sz], [sx, 2.3, sz]], { col: "#ffffff" });
        poly([[sx - 0.25, 2.3, sz], [sx + 0.25, 2.3, sz], [sx + 0.25, 2.8, sz], [sx - 0.25, 2.8, sz]], { closed: true, col: "#ffffff" });
        [1.6, 1.85, 2.1].forEach(function (y) { poly([[sx - 0.35, y, sz], [sx + 0.35, y, sz]], { col: "#ffffff" }); });
        poly([[sx - 0.5, 1.3, sz], [sx, 2.2, sz], [sx + 0.5, 1.3, sz]], { col: "#ffffff" });
        poly([[sx - 0.3, 0.2, sz], [sx, 1.0, sz], [sx + 0.3, 0.2, sz]], { col: "#ffffff" });
        door(cx, cz - 1.5, "kulture kudasai", "https://kulturekudasai.com/", "external", 2.4);
    }
    function theCinema(x, z) {
        var cx = x + BLOCK / 2, cz = z + 6;
        box(cx - 6, cz, 12, 10, 9, { col: "#ff3d9a", label: "THE INTRO" });
        box(cx - 5.5, cz - 1.2, 11, 1.2, 1.8, { y0: 5.2, col: "#ff3d9a", lit: false });
        label("NOW PLAYING: TUNE #" + today() + " · PRESS FIRE", cx, 6.1, cz - 1.25, 0.34, "#ffffff");
        label("CRACKED BY THE ELVES", cx, 3.6, cz - 0.05, 0.3, "#ff3d9a");
        door(cx, cz - 2.5, "the intro", "/intro/", "link", 2.6);
    }
    function theRiver() {
        // Seven lines of water across the whole city, drawn afresh each frame
        // (they move), bridges where the streets cross, a gauge on one, a heron.
        anims.push({ river: true });
        var gaugeAt = pick([1, 2, 4, 5]);
        for (var i = 0; i <= N; i++) {
            var c = -SIZE / 2 + STREET / 2 + i * PITCH, z0 = river.z0 - 0.5, z1 = river.z1 + 0.5;
            poly([[c - 3, 0.6, z0], [c + 3, 0.6, z0], [c + 3, 0.6, z1], [c - 3, 0.6, z1]], { closed: true, col: "#8a9aaa" });
            poly([[c - 3, 1.6, z0], [c - 3, 1.6, z1]], { col: "#8a9aaa" }); poly([[c + 3, 1.6, z0], [c + 3, 1.6, z1]], { col: "#8a9aaa" });
            for (var k = 0; k <= 4; k++) { poly([[c - 3, 0.6, z0 + k * (z1 - z0) / 4], [c - 3, 1.6, z0 + k * (z1 - z0) / 4]], { col: "#8a9aaa" }); poly([[c + 3, 0.6, z0 + k * (z1 - z0) / 4], [c + 3, 1.6, z0 + k * (z1 - z0) / 4]], { col: "#8a9aaa" }); }
            if (i === gaugeAt) {
                pole(c + 3.2, (z0 + z1) / 2, 3.2, { col: "#8fe7ff" });
                label("USGS 14211720", c + 3.2, 3.0, (z0 + z1) / 2, 0.3, "#8fe7ff");
                label("THE WILLAMETTE, OR THE JULIA. BOTH.", c + 3.2, 2.5, (z0 + z1) / 2, 0.24, "#8fe7ff");
                door(c + 3.2, (z0 + z1) / 2 - 1, "the gauge", "/dashboard/#river-willamette", "link", 1.6);
            }
        }
        var hx = -SIZE / 2 + STREET / 2 + pick([0, 1, 2, 3, 4, 5, 6]) * PITCH + PITCH / 2 + 4, hz = river.z0 + 3;
        river.heron = { x: hx, z: hz };
        label("THE HERON IS STILL WATCHING", hx, 2.6, hz, 0.24, "#8fe7ff");
        anims.push({ heron: poly([], { col: "#ffffff" }), x: hx, z: hz });
    }

    // ---- the state -------------------------------------------------------------
    var cam = { x: 0, z: 0, y: EYE, yaw: 0, pitch: 0, fx: 0, fz: 1, rx: 1, rz: 0 };
    var mode = "title";          // title, play, pause, enter, fall
    var keys = {}, stick = { x: 0, y: 0 };
    var clock = 0, modeClock = 0, lastFrame = 0, still = 0, stepClock = 0, slow = 0, hue = 0;
    var msg = { text: "", at: 0, until: 0 }, nearDoor = null, going = null;
    var W = 0, H = 0, DPR = 1, f = 0;
    var match = null, matchClock = 0, A = window.Arena, R = window.ArenaRobots;

    function blocked(x, z) {
        if (Math.abs(x) > SIZE / 2 - 1 || Math.abs(z) > SIZE / 2 - 1) return true;
        for (var i = 0; i < boxes.length; i++) {
            var b = boxes[i];
            if (b.solid && b.y0 < EYE && x > b.x - 0.4 && x < b.x + b.w + 0.4 && z > b.z - 0.4 && z < b.z + b.d + 0.4) return true;
        }
        if (z > river.z0 - 0.2 && z < river.z1 + 0.2) {               // the water, unless a bridge
            var onBridge = false;
            for (i = 0; i <= N; i++) { var c = -SIZE / 2 + STREET / 2 + i * PITCH; if (Math.abs(x - c) < 2.8) onBridge = true; }
            if (!onBridge) return true;
        }
        if (arena && Math.hypot(x - arena.cx, z - arena.cz) > 11.4 && Math.hypot(x - arena.cx, z - arena.cz) < 12.6 && !(z < arena.cz - 8 && Math.abs(x - arena.cx) < 4.6)) return true;
        return false;
    }
    function move(dt) {
        var fwd = 0, side = 0, turn = 0;
        if (keys.KeyW || keys.ArrowUp) fwd += 1;
        if (keys.KeyS || keys.ArrowDown) fwd -= 1;
        if (keys.KeyA || keys.KeyQ) side -= 1;
        if (keys.KeyD || keys.KeyE) side += 1;
        if (keys.ArrowLeft) turn -= 1;
        if (keys.ArrowRight) turn += 1;
        fwd += -stick.y; side += stick.x;
        var run = keys.ShiftLeft || keys.ShiftRight || Math.hypot(stick.x, stick.y) > 0.9;
        cam.yaw += turn * 2.0 * dt;
        var m = Math.hypot(fwd, side);
        if (m > 1) { fwd /= m; side /= m; }
        var v = (run ? RUN : WALK) * dt;
        var dx = (cam.fx * fwd + cam.rx * side) * v, dz = (cam.fz * fwd + cam.rz * side) * v;
        if (!blocked(cam.x + dx, cam.z)) cam.x += dx;
        if (!blocked(cam.x, cam.z + dz)) cam.z += dz;
        if (m > 0.1 || turn) still = 0; else still += dt;
        if (m > 0.1) {
            stepClock += dt * (run ? 1.7 : 1);
            if (stepClock > 0.5) { stepClock = 0; if (audio) audio.step(run); }
        }
        cam.y = EYE + (m > 0.1 ? Math.sin(clock * (run ? 14 : 9)) * 0.03 : 0) + ground(cam.x, cam.z);
        // Doors: the nearest within reach.
        nearDoor = null;
        var best = 99;
        doors.forEach(function (d) { var dd = Math.hypot(d.x - cam.x, d.z - cam.z); if (dd < d.r && dd < best) { best = dd; nearDoor = d; } });
        if (nearDoor && nearDoor.kind === "hole") fall();
        if (enterButton) enterButton.hidden = !(nearDoor && TOUCH);
    }
    // The hill under the dashboard lifts you.
    function ground(x, z) {
        var lift = 0;
        anims.forEach(function (a) { if (a.cups) { var d = Math.hypot(x - a.x, z - a.z); if (d < 12) lift = Math.max(lift, (1 - d / 12) * 3.2); } });
        return lift;
    }
    function enter(d) {
        if (!d || mode !== "play") return;
        if (d.kind === "chat") {
            var tab = document.querySelector(".chat-tab");
            if (tab) tab.click();
            say("rickbot is in. the window is in the corner of the page.", 5);
            if (audio) audio.enter();
            return;
        }
        mode = "enter"; modeClock = 0; going = d; keys = {}; stick.x = stick.y = 0;
        if (document.exitPointerLock) document.exitPointerLock();
        if (audio) audio.enter();
    }
    function fall() {
        if (mode !== "play") return;
        mode = "fall"; modeClock = 0; going = nearDoor; keys = {}; stick.x = stick.y = 0;
        if (document.exitPointerLock) document.exitPointerLock();
        if (audio) audio.fall();
    }
    function say(text, seconds) { msg.text = text; msg.at = clock; msg.until = clock + seconds + text.length / 32; }

    // ---- projection --------------------------------------------------------------
    function resize() {
        DPR = Math.min(devicePixelRatio || 1, 2);
        W = stage.clientWidth; H = stage.clientHeight;
        canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
        f = Math.max((W / 2) / Math.tan(FOV / 2), (H / 2) / Math.tan(32 * Math.PI / 180));
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
            if (ain !== bin) { var t = (NEAR - a.z) / (b.z - a.z); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR }); }
        }
        return out;
    }
    var horizon = 0;
    function sx(p) { return W / 2 + f * p.x / p.z; }
    function sy(p) { return horizon - f * p.y / p.z; }
    function fade(d) { var a = 1 - d / FOG; if (a <= 0) return 0; if (a > 1) a = 1; return a * a * (3 - 2 * a); }
    function inView(x, z, r) {
        var dx = x - cam.x, dz = z - cam.z, d = Math.hypot(dx, dz);
        if (d > FOG + r) return false;
        if (d < r + 2) return true;
        var ang = Math.atan2(dx, dz) - cam.yaw;
        ang = Math.atan2(Math.sin(ang), Math.cos(ang));
        return Math.abs(ang) < FOV / 2 + Math.atan2(r, d) + 0.1;
    }
    function strokePath(pts3, closed) {
        // pts3: [[x,y,z]...] in the world. Open paths are clipped segment by segment.
        var cp = [], i;
        for (i = 0; i < pts3.length; i++) cp.push(toCam(pts3[i][0], pts3[i][1], pts3[i][2], { x: 0, y: 0, z: 0 }));
        ctx.beginPath();
        var any = false;
        if (closed) {
            var c = clipNear(cp);
            if (c.length < 2) return false;
            for (i = 0; i < c.length; i++) { if (i) ctx.lineTo(sx(c[i]), sy(c[i])); else ctx.moveTo(sx(c[i]), sy(c[i])); }
            ctx.closePath(); any = true;
        } else {
            for (i = 1; i < cp.length; i++) {
                var a = cp[i - 1], b = cp[i];
                if (a.z < NEAR && b.z < NEAR) continue;
                if (a.z < NEAR || b.z < NEAR) { var t = (NEAR - a.z) / (b.z - a.z), m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR }; if (a.z < NEAR) a = m; else b = m; }
                ctx.moveTo(sx(a), sy(a)); ctx.lineTo(sx(b), sy(b)); any = true;
            }
        }
        return any;
    }

    // ---- gathering and drawing -----------------------------------------------------
    var items = [];
    function item(d, draw) { items.push({ d: d, draw: draw }); }
    function night() { var h = hourNow(); return h < 6 || h >= 19; }
    function colorOf(c) { return c === "julia" ? "hsl(" + ((hue + clock * 30) % 360).toFixed(0) + ", 100%, 65%)" : c || "#dfe6ee"; }
    function gather() {
        items.length = 0;
        var isNight = night(), i;
        // Boxes: walls that face you, in panels when near.
        for (i = 0; i < boxes.length; i++) {
            var b = boxes[i], bx = b.x + b.w / 2, bz = b.z + b.d / 2;
            if (!inView(bx, bz, Math.max(b.w, b.d))) continue;
            var dist = Math.hypot(bx - cam.x, bz - cam.z);
            if (dist > FOG) continue;
            var walls = [
                { ax: b.x, az: b.z, bx: b.x + b.w, bz: b.z, nx: 0, nz: -1 },          // south
                { ax: b.x + b.w, az: b.z, bx: b.x + b.w, bz: b.z + b.d, nx: 1, nz: 0 },    // east
                { ax: b.x + b.w, az: b.z + b.d, bx: b.x, bz: b.z + b.d, nx: 0, nz: 1 },    // north
                { ax: b.x, az: b.z + b.d, bx: b.x, bz: b.z, nx: -1, nz: 0 }             // west
            ];
            var panels = dist < 55 && b.h > 4 && b.w > 3;
            for (var k = 0; k < 4; k++) {
                var w = walls[k], mx = (w.ax + w.bx) / 2, mz = (w.az + w.bz) / 2;
                if ((cam.x - mx) * w.nx + (cam.z - mz) * w.nz <= 0) continue;        // its back is to you
                var len = Math.hypot(w.bx - w.ax, w.bz - w.az), ux = (w.bx - w.ax) / len, uz = (w.bz - w.az) / len;
                var bays = panels ? Math.max(1, Math.round(len / 4)) : 1, floors = panels ? Math.max(1, Math.round(b.h / 3.2)) : 1;
                for (var p = 0; p < bays; p++) for (var q = 0; q < floors; q++) {
                    var x0 = w.ax + ux * len * p / bays, z0 = w.az + uz * len * p / bays, x1 = w.ax + ux * len * (p + 1) / bays, z1 = w.az + uz * len * (p + 1) / bays;
                    var y0 = b.y0 + b.h * q / floors, y1 = b.y0 + b.h * (q + 1) / floors;
                    var lit = isNight && b.lit && panels && hash(b.id, k * 97 + p, q) < 0.28;
                    (function (x0, z0, x1, z1, y0, y1, lit, col) {
                        var d = Math.hypot((x0 + x1) / 2 - cam.x, (z0 + z1) / 2 - cam.z, (y0 + y1) / 2 - cam.y);
                        item(d, function () { quad([[x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]], d, col, lit); });
                    }(x0, z0, x1, z1, y0, y1, lit, b.col));
                }
            }
            // The roof's outline, so a tall thing has a top.
            (function (b) {
                var d = Math.hypot(bx - cam.x, bz - cam.z, b.y0 + b.h - cam.y);
                item(d - 0.01, function () { ctx.strokeStyle = colorOf(b.col); ctx.globalAlpha = fade(d) * 0.6; ctx.lineWidth = 1; if (strokePath([[b.x, b.y0 + b.h, b.z], [b.x + b.w, b.y0 + b.h, b.z], [b.x + b.w, b.y0 + b.h, b.z + b.d], [b.x, b.y0 + b.h, b.z + b.d]], true)) ctx.stroke(); });
            }(b));
        }
        for (i = 0; i < polys.length; i++) {
            var pl = polys[i];
            if (!pl.pts.length) continue;
            var c0 = pl.pts[0], cx = c0[0], cz = c0[2];
            if (!inView(cx, cz, 20)) continue;
            (function (pl) {
                var d = Math.hypot(pl.pts[0][0] - cam.x, pl.pts[0][2] - cam.z);
                item(d, function () {
                    var a = fade(d); if (a <= 0.01) return;
                    if (pl.wall) { ctx.fillStyle = "#000"; ctx.globalAlpha = 1; if (strokePath(pl.pts, true)) ctx.fill(); }
                    ctx.strokeStyle = colorOf(pl.col); ctx.globalAlpha = a; ctx.lineWidth = pl.width;
                    if (strokePath(pl.pts, pl.closed)) ctx.stroke();
                });
            }(pl));
        }
        for (i = 0; i < labels.length; i++) {
            var l = labels[i];
            if (!inView(l.x, l.z, 2)) continue;
            (function (l) {
                var d = Math.hypot(l.x - cam.x, l.z - cam.z);
                if (d > FOG * 0.6) return;
                // Sorted a little nearer than it is, so the wall it names does not cover it.
                item(d - 6, function () { ctx.globalAlpha = fade(d); text3(l.text, l.x, l.y, l.z, l.size, colorOf(l.col)); });
            }(l));
        }
        for (i = 0; i < signs.length; i++) {
            var s = signs[i];
            if (!inView(s.x, s.z, 2)) continue;
            (function (s) {
                var d = Math.hypot(s.x - cam.x, s.z - cam.z);
                if (d > 40) return;
                item(d - 0.02, function () { ctx.globalAlpha = fade(d); elfText(s.lines[0], s.x, 2.65, s.z, 0.26); elfText(s.lines[1], s.x, 2.3, s.z, 0.26); });
            }(s));
        }
        if (arena && inView(arena.x + arena.w / 2, arena.z, 10)) {
            (function () { var d = Math.hypot(arena.x + arena.w / 2 - cam.x, arena.z - cam.z, arena.y + 4 - cam.y); item(d - 0.03, function () { scoreboard(d); }); }());
        }
        items.sort(function (a, b) { return b.d - a.d; });
    }
    function quad(p, d, col, lit) {
        var a = fade(d);
        if (a <= 0.01) return;
        var cp = [toCam(p[0][0], p[0][1], p[0][2], {}), toCam(p[1][0], p[1][1], p[1][2], {}), toCam(p[2][0], p[2][1], p[2][2], {}), toCam(p[3][0], p[3][1], p[3][2], {})];
        if (cp[0].z < NEAR && cp[1].z < NEAR && cp[2].z < NEAR && cp[3].z < NEAR) return;
        var pts = clipNear(cp);
        if (pts.length < 3) return;
        ctx.beginPath();
        var left = Infinity, right = -Infinity;
        for (var k = 0; k < pts.length; k++) { var x = sx(pts[k]), y = sy(pts[k]); if (x < left) left = x; if (x > right) right = x; if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        if (right < 0 || left > W) return;
        ctx.closePath();
        ctx.globalAlpha = 1; ctx.fillStyle = "#000"; ctx.fill();
        if (lit) { ctx.globalAlpha = a * 0.2; ctx.fillStyle = "#ffd27a"; ctx.fill(); }
        ctx.strokeStyle = colorOf(col); ctx.globalAlpha = a; ctx.lineWidth = 0.6 + 0.8 * a;
        ctx.stroke();
    }
    function text3(text, x, y, z, size, col, align) {
        var p = toCam(x, y, z, {});
        if (p.z < NEAR) return;
        var px = f * size / p.z;
        if (px < 4) return;
        ctx.font = Math.min(px, 64) + "px " + MONO;
        ctx.fillStyle = col; ctx.textAlign = align || "center"; ctx.textBaseline = "middle";
        ctx.fillText(text, sx(p), sy(p));
    }
    // The elves' script: a glyph per letter, three strokes each, drawn by the
    // seed, which gives way to the letter itself while you stand still.
    var ELFGLYPH = {};
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("").forEach(function (ch, i) {
        var r = mulberry32(seed * 31 + i), g = [];
        for (var k = 0; k < 3; k++) g.push([r(), r(), r(), r()]);
        ELFGLYPH[ch] = g;
    });
    function elfText(text, x, y, z, size) {
        var p = toCam(x, y, z, {});
        if (p.z < NEAR) return;
        var px = f * size / p.z;
        if (px < 4) return;
        px = Math.min(px, 40);
        var adv = px * 0.62, x0 = sx(p) - text.length * adv / 2, y0 = sy(p);
        var resolved = still > 0.8 ? Math.floor((still - 0.8) * 9) : 0;
        ctx.font = px + "px " + MONO; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ctx.fillStyle = "#b6ff3a"; ctx.strokeStyle = "#b6ff3a"; ctx.lineWidth = 1;
        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i), cx = x0 + i * adv;
            if (ch === " ") continue;
            if (i < resolved || !ELFGLYPH[ch]) { ctx.fillText(ch, cx, y0); continue; }
            var g = ELFGLYPH[ch];
            ctx.beginPath();
            for (var k = 0; k < 3; k++) { ctx.moveTo(cx + g[k][0] * adv, y0 - px / 2 + g[k][1] * px); ctx.lineTo(cx + g[k][2] * adv, y0 - px / 2 + g[k][3] * px); }
            ctx.stroke();
        }
    }
    // The scoreboard: the match in the arena's own engine, drawn as points
    // on the board's plane, so it stands in the world like the rest.
    function scoreboard(d) {
        var a = fade(d);
        if (a <= 0.01) return;
        var bx = arena.x, by = arena.y, bz = arena.z, bw = arena.w, bh = arena.h;
        function at(mx, my) { return [bx + mx / 1000 * bw, by + bh - my / 1000 * bh, bz]; }
        if (!match) { ctx.globalAlpha = a; text3("NO SIGNAL", bx + bw / 2, by + bh / 2, bz, 0.8, "#ffd27a"); return; }
        ctx.globalAlpha = a; ctx.lineWidth = 1;
        match.robots.forEach(function (r, i) {
            var c = ["#ff5a2e", "#00e5ff", "#b6ff3a", "#ffb000", "#ff3d9a", "#c288ff"][i % 6];
            ctx.strokeStyle = r.alive ? c : "#555";
            var p = at(r.x, r.y), h = r.heading * Math.PI / 180;
            if (strokePath([[p[0] - 0.25, p[1] - 0.25, p[2]], [p[0] + 0.25, p[1] - 0.25, p[2]], [p[0] + 0.25, p[1] + 0.25, p[2]], [p[0] - 0.25, p[1] + 0.25, p[2]]], true)) ctx.stroke();
            if (r.alive && strokePath([[p[0], p[1], p[2]], [p[0] + Math.cos(h) * 0.6, p[1] - Math.sin(h) * 0.6, p[2]]], false)) ctx.stroke();
        });
        ctx.strokeStyle = "#ffffff";
        match.missiles.forEach(function (m) { var p = at(m.x, m.y); if (strokePath([[p[0] - 0.08, p[1], p[2]], [p[0] + 0.08, p[1], p[2]]], false)) ctx.stroke(); });
        var alive = match.robots.filter(function (r) { return r.alive; });
        text3((match.over ? (match.winner ? match.winner.name + " WINS" : "DRAW") : alive.length + " STANDING") + " · TICK " + match.tick, bx + bw / 2, by + bh + 0.6, bz, 0.4, "#ffd27a");
    }
    function newMatch() {
        if (!A || !R) return;
        var names = R.order.slice(), entries = [];
        for (var k = names.length - 1; k > 0; k--) { var m = Math.floor(Math.random() * (k + 1)), t = names[k]; names[k] = names[m]; names[m] = t; }
        names.slice(0, 6).forEach(function (n) { var p = R.robots[n]; entries.push({ source: typeof p === "string" ? p : p.join("\n") }); });
        try { match = new A.Match(entries, { seed: 1 + Math.floor(Math.random() * 9999) }); } catch (e) { match = null; }
        matchClock = 0;
    }

    // ---- the sky and the ground --------------------------------------------------
    var STARS = [];
    for (var st = 0; st < 220; st++) STARS.push([Math.random() * Math.PI * 2, 0.05 + Math.random() * 1.2, Math.random()]);
    function skyColours(h) {
        // Keyframes by hour: top, horizon, line colour.
        var K = [[0, "#03040c", "#0a0d2a", "#dfe6ee"], [5, "#03040c", "#0a0d2a", "#dfe6ee"], [6.5, "#141038", "#d1006b", "#ffe3f0"], [8, "#0b1d3f", "#2a5c9c", "#ffffff"],
            [12, "#0d2452", "#3a74b8", "#ffffff"], [17, "#0b1d3f", "#2a5c9c", "#ffffff"], [18.5, "#1a0c30", "#ff5a2e", "#ffe3d0"], [20, "#05061a", "#1a1040", "#dfe6ee"], [24, "#03040c", "#0a0d2a", "#dfe6ee"]];
        for (var i = 1; i < K.length; i++) if (h <= K[i][0]) {
            var t = (h - K[i - 1][0]) / (K[i][0] - K[i - 1][0]);
            return { top: mixHex(K[i - 1][1], K[i][1], t), low: mixHex(K[i - 1][2], K[i][2], t), line: mixHex(K[i - 1][3], K[i][3], t), t: t };
        }
        return { top: "#03040c", low: "#0a0d2a", line: "#dfe6ee" };
    }
    function mixHex(a, b, t) {
        var out = "#";
        for (var i = 1; i < 7; i += 2) { var x = parseInt(a.substr(i, 2), 16), y = parseInt(b.substr(i, 2), 16), v = Math.round(x + (y - x) * t); out += (v < 16 ? "0" : "") + v.toString(16); }
        return out;
    }
    function sky() {
        var h = hourNow(), c = skyColours(h);
        var g = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon));
        g.addColorStop(0, c.top); g.addColorStop(1, c.low);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, Math.max(0, horizon));
        ctx.fillStyle = "#000"; ctx.fillRect(0, Math.max(0, horizon), W, H);
        // Stars at night, the sun by day, the moon after dark: each at an azimuth and height by the hour.
        var dark = h < 6 || h >= 19;
        if (dark && !REDUCED || dark) {
            ctx.fillStyle = "#fff";
            STARS.forEach(function (s) {
                var ang = Math.atan2(Math.sin(s[0] - cam.yaw), Math.cos(s[0] - cam.yaw));
                if (Math.abs(ang) > FOV / 2 + 0.2) return;
                var x = W / 2 + f * Math.tan(ang), y = horizon - f * Math.tan(s[1]);
                if (y < 0) return;
                ctx.globalAlpha = 0.3 + 0.7 * s[2] * (REDUCED ? 1 : 0.7 + 0.3 * Math.sin(clock * 3 + s[0] * 50));
                ctx.fillRect(x, y, s[2] > 0.8 ? 2 : 1, s[2] > 0.8 ? 2 : 1);
            });
            ctx.globalAlpha = 1;
        }
        var az = (h / 24) * Math.PI * 2 + Math.PI, el = Math.sin((h - 6) / 12 * Math.PI) * 1.1;   // the sun: east at 6, high at noon
        var body = dark ? { az: az + Math.PI, el: -el, col: "#e9eefb", r: 14 } : { az: az, el: el, col: "#fff3b0", r: 18 };
        var ang = Math.atan2(Math.sin(body.az - cam.yaw), Math.cos(body.az - cam.yaw));
        if (body.el > 0.02 && Math.abs(ang) < FOV / 2 + 0.3) {
            var x = W / 2 + f * Math.tan(ang), y = horizon - f * Math.tan(body.el);
            ctx.strokeStyle = body.col; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.arc(x, y, body.r, 0, Math.PI * 2); ctx.stroke();
            if (dark) { ctx.beginPath(); ctx.arc(x - 5, y - 2, body.r * 0.8, 0, Math.PI * 2); ctx.stroke(); }
            ctx.globalAlpha = 1;
        }
    }
    function groundGrid(lineCol) {
        // A grid of 5s within the fog, each tile's edges faded by their distance.
        var G = 5, R = 60, x0 = Math.floor((cam.x - R) / G) * G, x1 = cam.x + R, z0 = Math.floor((cam.z - R) / G) * G, z1 = cam.z + R;
        ctx.strokeStyle = lineCol; ctx.lineWidth = 0.8;
        for (var x = x0; x <= x1; x += G) for (var z = z0; z <= z1; z += G) {
            var d = Math.hypot(x + G / 2 - cam.x, z + G / 2 - cam.z);
            if (d > R) continue;
            var a = fade(d * 1.3) * 0.28;
            if (a < 0.01) continue;
            ctx.globalAlpha = a; ctx.beginPath();
            if (strokePath([[x, 0, z], [x + G, 0, z]], false)) ctx.stroke();
            ctx.beginPath();
            if (strokePath([[x, 0, z], [x, 0, z + G]], false)) ctx.stroke();
        }
        // Curbs and centre lines, the river's edges.
        for (var i = 0; i < flats.length; i++) {
            var fl = flats[i];
            var mx = 0, mz = 0; fl.pts.forEach(function (p) { mx += p[0] / fl.pts.length; mz += p[1] / fl.pts.length; });
            var long = fl.pts.length === 2 && Math.hypot(fl.pts[1][0] - fl.pts[0][0], fl.pts[1][1] - fl.pts[0][1]) > 60;
            if (!long && !inView(mx, mz, 30)) continue;
            var pts3 = fl.pts.map(function (p) { return [p[0], fl.y, p[1]]; });
            ctx.strokeStyle = colorOf(fl.col); ctx.lineWidth = 1;
            if (long) {
                // Long street lines: in pieces, each faded on its own.
                var ax = fl.pts[0][0], az = fl.pts[0][1], bx = fl.pts[1][0], bz = fl.pts[1][1], len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 6);
                for (var k = 0; k < n; k++) {
                    if (fl.dash && k % 2) continue;
                    var px = ax + (bx - ax) * k / n, pz = az + (bz - az) * k / n, qx = ax + (bx - ax) * (k + 1) / n, qz = az + (bz - az) * (k + 1) / n;
                    var dd = Math.hypot((px + qx) / 2 - cam.x, (pz + qz) / 2 - cam.z);
                    if (dd > R) continue;
                    ctx.globalAlpha = fade(dd * 1.2) * 0.7; ctx.beginPath();
                    if (strokePath([[px, fl.y, pz], [qx, fl.y, qz]], false)) ctx.stroke();
                }
            } else {
                var d2 = Math.hypot(mx - cam.x, mz - cam.z);
                ctx.globalAlpha = fade(d2) * 0.8; ctx.beginPath();
                if (strokePath(pts3, fl.closed)) ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;
    }
    function water() {
        // Seven lines of river, each a wave, in the Julia's colours, with the bridges' shadows left to the bridges.
        if (!river) return;
        var z0 = river.z0, z1 = river.z1, R = 70;
        for (var k = 0; k < 7; k++) {
            var z = z0 + (z1 - z0) * (k + 0.5) / 7, x0 = Math.max(-SIZE / 2, Math.floor((cam.x - R) / 2) * 2), x1 = Math.min(SIZE / 2, cam.x + R);
            var pts = [];
            for (var x = x0; x <= x1; x += 2) pts.push([x, 0.02, z + Math.sin(x * 0.4 + clock * 1.2 + k) * 0.5]);
            if (pts.length < 2) continue;
            ctx.strokeStyle = "hsl(" + ((hue + clock * 30 + k * 12) % 360).toFixed(0) + ", 100%, 60%)";
            ctx.globalAlpha = fade(Math.abs(z - cam.z) * 1.2) * 0.8; ctx.lineWidth = 1;
            ctx.beginPath(); if (strokePath(pts, false)) ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
    function render() {
        var c = skyColours(hourNow());
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        horizon = H / 2 + cam.pitch * f;
        sky();
        if (mode === "title") { ctx.globalAlpha = 1; return; }
        ctx.lineJoin = "round";
        groundGrid(c.line);
        water();
        for (var i = 0; i < items.length; i++) items[i].draw();
        ctx.globalAlpha = 1;
        hud(c.line);
        if (mode === "enter") { ctx.fillStyle = "#000"; ctx.globalAlpha = Math.min(1, modeClock * 1.6); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
        if (mode === "fall") { ctx.fillStyle = "#000"; ctx.globalAlpha = Math.min(1, Math.max(0, modeClock - 0.5) * 1.5); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    }
    function hud(col) {
        ctx.font = "12px " + MONO; ctx.fillStyle = col; ctx.textBaseline = "top"; ctx.globalAlpha = 0.85;
        ctx.textAlign = "left";
        var h = hourNow(), hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
        ctx.fillText("RICKSEUFERT.COM · POP. 1 · " + (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm + (seed === today() ? "" : " · SEED " + seed), 14, 12);
        minimap();
        if (nearDoor && mode === "play" && nearDoor.kind !== "hole") {
            ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.font = (W < 500 ? 12 : 14) + "px " + MONO; ctx.fillStyle = "#fff";
            ctx.fillText((nearDoor.kind === "chat" ? "talk to " : "enter ") + nearDoor.name + (TOUCH ? "" : " · press E"), W / 2, H - 40);
        }
        if (msg.text && clock < msg.until) {
            var shown = Math.min(msg.text.length, Math.floor((clock - msg.at) * 32));
            ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.font = (W < 500 ? 12 : 14) + "px " + MONO; ctx.fillStyle = col;
            wrap(msg.text.slice(0, shown) + (shown < msg.text.length ? "_" : ""), 14, H - 14, W - 28);
        }
        ctx.globalAlpha = 1;
    }
    function wrap(text, x, bottom, width) {
        var words = text.split(" "), lines = [], cur = "";
        words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > width && cur) { lines.push(cur); cur = w; } else cur = t; });
        lines.push(cur);
        lines.reverse().forEach(function (l, i) { ctx.fillText(l, x, bottom - i * 18); });
    }
    function minimap() {
        var S = W < 500 ? 70 : 96, mx = W - S - 12, my = 12, k = S / SIZE;
        ctx.globalAlpha = 0.5; ctx.fillStyle = "#000"; ctx.fillRect(mx, my, S, S);
        ctx.globalAlpha = 0.6; ctx.strokeStyle = "#5a6a7a"; ctx.lineWidth = 1;
        for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) { var o = origin(i, j); ctx.strokeRect(mx + (o.x + SIZE / 2) * k, my + (o.z + SIZE / 2) * k, BLOCK * k, BLOCK * k); }
        if (river) { ctx.fillStyle = "hsl(" + ((hue + clock * 30) % 360).toFixed(0) + ", 100%, 60%)"; ctx.fillRect(mx, my + (river.z0 + SIZE / 2) * k, S, (river.z1 - river.z0) * k); }
        ctx.globalAlpha = 0.9; ctx.font = "8px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        doors.forEach(function (d) {
            if (d.kind === "hole") { ctx.fillStyle = "#ffb000"; ctx.fillText("o", mx + (d.x + SIZE / 2) * k, my + (d.z + SIZE / 2) * k); return; }
            if (/^(mock-|acme|the gauge)/.test(d.name) || d.link.indexOf("/blog/20") === 0) return;
            ctx.fillStyle = "#fff"; ctx.fillText(d.name.replace(/^the /, "").charAt(0).toUpperCase(), mx + (d.x + SIZE / 2) * k, my + (d.z + SIZE / 2) * k);
        });
        var px = mx + (cam.x + SIZE / 2) * k, py = my + (cam.z + SIZE / 2) * k;
        ctx.strokeStyle = "#00e5ff"; ctx.beginPath();
        ctx.moveTo(px + Math.sin(cam.yaw) * 5, py + Math.cos(cam.yaw) * 5); ctx.lineTo(px + Math.sin(cam.yaw + 2.5) * 3, py + Math.cos(cam.yaw + 2.5) * 3); ctx.lineTo(px + Math.sin(cam.yaw - 2.5) * 3, py + Math.cos(cam.yaw - 2.5) * 3); ctx.closePath(); ctx.stroke();
        ctx.globalAlpha = 1;
    }

    // ---- the things that move -------------------------------------------------------
    function animate(dt) {
        hue = (hue + dt * 8) % 360;
        anims.forEach(function (a) {
            if (a.cups) {
                var t = clock * 4, pts = [], top = 14, x = a.x, z = a.z;
                for (var k = 0; k < 3; k++) { var ang = t + k * Math.PI * 2 / 3; pts.push([x, top, z], [x + Math.cos(ang) * 1.2, top, z + Math.sin(ang) * 1.2]); }
                a.cups.pts = pts; a.cups.closed = false;
                a.light.col = Math.floor(clock * 2) % 2 ? "#ff3d9a" : "#550020";
            }
            if (a.marquee) a.marquee.col = ["#ffffff", "#ff3d9a", "#ffe9a0"][Math.floor(clock * 3) % 3];
            if (a.heron) {
                // Tall, thin, patient; it lifts a foot now and then.
                var hx = a.x, hz = a.z, lift = Math.max(0, Math.sin(clock * 0.5)) * 0.3, bob = Math.sin(clock * 0.7) * 0.03;
                a.heron.pts = [[hx, 0.2, hz], [hx, 1.2, hz], [hx + 0.1, 1.5 + bob, hz], [hx + 0.05, 1.75 + bob, hz], [hx + 0.35, 1.7 + bob, hz], [hx, 1.75 + bob, hz], [hx, 1.2, hz], [hx + 0.3, 1.0, hz], [hx, 0.9, hz], [hx + 0.1, lift, hz]];
                a.heron.closed = false;
            }
        });
        if (match) {
            matchClock += dt;
            if (!match.over) { for (var i = 0; i < Math.round(dt * 60); i++) if (!match.over) match.update(); }
            else if (matchClock > 6) newMatch();
        } else if (A && R && clock > 1) newMatch();
    }
    // ---- the loop ----------------------------------------------------------------
    function frame(now, manual) {
        if (!manual) requestAnimationFrame(frame);
        var dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000 || 0));
        var t0 = performance.now();
        lastFrame = now;
        clock += dt; modeClock += dt;
        if (mode === "play") {
            cam.fx = Math.sin(cam.yaw); cam.fz = Math.cos(cam.yaw); cam.rx = Math.cos(cam.yaw); cam.rz = -Math.sin(cam.yaw);
            move(dt);
            if (audio) audio.where(cam, hole, river, arena);
        } else if (mode === "enter" && modeClock > 0.8) {
            location.href = going.link;
            mode = "gone";
        } else if (mode === "fall") {
            cam.y = EYE - modeClock * modeClock * 3; cam.yaw += dt * 1.5; cam.pitch = Math.min(0.9, cam.pitch + dt);
            if (modeClock > 1.4) { location.href = going.link; mode = "gone"; }
        }
        if (mode !== "title" && mode !== "gone") animate(dt);
        cam.fx = Math.sin(cam.yaw); cam.fz = Math.cos(cam.yaw); cam.rx = Math.cos(cam.yaw); cam.rz = -Math.sin(cam.yaw);
        if (mode !== "title" && mode !== "gone") { gather(); render(); } else if (mode === "title") render();
        var took = performance.now() - t0;
        slow = took > 18 ? Math.min(slow + 1, 30) : Math.max(slow - 1, 0);
    }

    // ---- input -----------------------------------------------------------------------
    addEventListener("keydown", function (e) {
        if (mode === "title" || mode === "pause") return;
        if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
        if (e.code === "Escape") return;
        if ((e.code === "KeyE" || e.code === "Enter") && mode === "play" && nearDoor) { enter(nearDoor); e.preventDefault(); return; }
        keys[e.code] = true;
        if (/^(Arrow|Key[WASDQE]|Shift)/.test(e.code)) e.preventDefault();
    });
    addEventListener("keyup", function (e) { keys[e.code] = false; });
    addEventListener("blur", function () { keys = {}; });
    var locked = false, lockable = !!canvas.requestPointerLock;
    function lock() {
        if (TOUCH || locked || !lockable) return;
        try { var p = canvas.requestPointerLock(); if (p && p.catch) p.catch(function () { lockable = false; }); } catch (e) { lockable = false; }
    }
    canvas.addEventListener("click", function () { if (mode === "play") lock(); });
    document.addEventListener("pointerlockchange", function () {
        locked = document.pointerLockElement === canvas;
        if (!locked && mode === "play") pause("paused. click to walk on.");
    });
    addEventListener("mousemove", function (e) {
        if (!locked || mode !== "play") return;
        cam.yaw += e.movementX * 0.0022;
        cam.pitch = Math.max(-0.6, Math.min(0.6, cam.pitch - e.movementY * 0.0022));
        if (Math.abs(e.movementX) + Math.abs(e.movementY) > 2) still = 0;
    });
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
        if (t.side === "walk") { stick.x = Math.max(-1, Math.min(1, (e.clientX - t.x) / 50)); stick.y = Math.max(-1, Math.min(1, (e.clientY - t.y) / 50)); }
        else { cam.yaw += (e.clientX - t.x) * 0.006; cam.pitch = Math.max(-0.6, Math.min(0.6, cam.pitch - (e.clientY - t.y) * 0.004)); t.x = e.clientX; t.y = e.clientY; still = 0; }
        e.preventDefault();
    });
    function endTouch(e) { var t = touches[e.pointerId]; if (!t) return; if (t.side === "walk") stick.x = stick.y = 0; delete touches[e.pointerId]; }
    canvas.addEventListener("pointerup", endTouch);
    canvas.addEventListener("pointercancel", endTouch);
    if (enterButton) enterButton.addEventListener("click", function () { enter(nearDoor); });
    document.addEventListener("visibilitychange", function () { if (document.hidden && mode === "play") pause("paused. the city goes on without you."); });

    // ---- the veil ------------------------------------------------------------------------
    function pause(text) {
        mode = "pause"; keys = {}; stick.x = stick.y = 0;
        veilText.textContent = text; go.textContent = "walk on"; veil.hidden = false;
        if (audio) audio.quiet(true);
    }
    function begin() {
        if (!audio && soundOn) audio = makeAudio();
        if (audio) audio.quiet(false);
        if (mode === "title") {
            cam.x = spawn.x; cam.z = spawn.z; cam.yaw = spawn.yaw; cam.pitch = 0;
            say("the site, from the street. everything here is a door. walk up to one.", 7);
        }
        mode = "play"; modeClock = 0; veil.hidden = true;
        lock();
    }
    go.addEventListener("click", begin);
    fullButton.addEventListener("click", function () { if (document.fullscreenElement) document.exitFullscreen(); else if (stage.requestFullscreen) stage.requestFullscreen(); });
    var soundOn = true;
    try { soundOn = localStorage.getItem("city-sound") !== "0"; } catch (e) { /* on */ }
    soundButton.addEventListener("click", function () {
        soundOn = !soundOn;
        try { localStorage.setItem("city-sound", soundOn ? "1" : "0"); } catch (e) { /* a visit's worth */ }
        soundButton.setAttribute("aria-pressed", soundOn ? "true" : "false");
        if (soundOn && !audio) audio = makeAudio();
        if (audio) audio.quiet(!soundOn || mode !== "play");
    });
    soundButton.setAttribute("aria-pressed", soundOn ? "true" : "false");
    function title() {
        var how = TOUCH ? "left thumb walks, right thumb looks; a button appears at a door." : "wasd or arrows walk, the mouse looks, shift runs, E enters a door, esc pauses.";
        veilText.textContent = "the site, as a city, laid out from today's date. " + how;
        go.textContent = "walk";
        veil.hidden = false;
    }

    // ---- sound: wind, steps, the river, the hum under the manhole, the crowd ----------
    var audio = null;
    function makeAudio() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        var ac = new AC(), master = ac.createGain();
        master.gain.value = 0; master.connect(ac.destination);
        var noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), data = noise.getChannelData(0);
        for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        function loop(freq, gain, type) {
            var s = ac.createBufferSource(), g = ac.createGain(), fl = ac.createBiquadFilter();
            s.buffer = noise; s.loop = true; fl.type = type || "lowpass"; fl.frequency.value = freq; g.gain.value = gain;
            s.connect(fl); fl.connect(g); g.connect(master); s.start();
            return { g: g, f: fl };
        }
        var wind = loop(380, 0.08), lfo = ac.createOscillator(), lg = ac.createGain();
        lfo.frequency.value = 0.07; lg.gain.value = 220; lfo.connect(lg); lg.connect(wind.f.frequency); lfo.start();
        var water = loop(900, 0), crowd = loop(700, 0, "bandpass");
        var hum = ac.createOscillator(), hg = ac.createGain(), hl = ac.createBiquadFilter();
        hum.type = "sawtooth"; hum.frequency.value = 60; hl.type = "lowpass"; hl.frequency.value = 180; hg.gain.value = 0;
        hum.connect(hl); hl.connect(hg); hg.connect(master); hum.start();
        function burst(len, gain, freq, type) {
            var s = ac.createBufferSource(), g = ac.createGain(), fl = ac.createBiquadFilter();
            s.buffer = noise; fl.type = type || "lowpass"; fl.frequency.value = freq;
            g.gain.setValueAtTime(gain, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + len);
            s.connect(fl); fl.connect(g); g.connect(master); s.start(); s.stop(ac.currentTime + len);
        }
        return {
            quiet: function (q) {
                if (ac.state === "suspended") ac.resume();
                master.gain.cancelScheduledValues(ac.currentTime);
                master.gain.linearRampToValueAtTime(q ? 0 : 0.6, ac.currentTime + 0.4);
            },
            where: function (cam, hole, river, arena) {
                var dr = river ? Math.max(0, Math.min(Math.abs(cam.z - river.z0), Math.abs(cam.z - river.z1), cam.z > river.z0 && cam.z < river.z1 ? 0 : 99)) : 99;
                water.g.gain.setTargetAtTime(Math.max(0, 1 - dr / 30) * 0.12, ac.currentTime, 0.2);
                var dh = hole ? Math.hypot(cam.x - hole.x, cam.z - hole.z) : 99;
                hg.gain.setTargetAtTime(Math.max(0, 1 - dh / 14) * 0.2, ac.currentTime, 0.2);
                var da = arena ? Math.hypot(cam.x - arena.cx, cam.z - arena.cz) : 99;
                crowd.g.gain.setTargetAtTime(Math.max(0, 1 - da / 50) * 0.05 * (0.7 + 0.3 * Math.sin(clock * 2)), ac.currentTime, 0.2);
            },
            step: function (run) { burst(0.08, run ? 0.2 : 0.13, 500); },
            enter: function () { var o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.setValueAtTime(220, ac.currentTime); o.frequency.exponentialRampToValueAtTime(880, ac.currentTime + 0.5); g.gain.setValueAtTime(0.2, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.7); o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime + 0.75); },
            fall: function () { var o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.setValueAtTime(240, ac.currentTime); o.frequency.exponentialRampToValueAtTime(30, ac.currentTime + 1.3); g.gain.setValueAtTime(0.25, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 1.5); o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime + 1.6); burst(1.4, 0.2, 500); }
        };
    }

    // ---- go ---------------------------------------------------------------------------------
    build();
    resize();
    addEventListener("resize", resize);
    document.addEventListener("fullscreenchange", function () { setTimeout(resize, 50); });
    if (whereOut) whereOut.textContent = (seed === today() ? "today's city" : "the city of " + seed) + " · " + doors.length + " doors";
    title();
    requestAnimationFrame(frame);
    window.City = {
        step: function (ms) { frame(lastFrame + ms, true); },
        state: function () { return { mode: mode, cam: cam, doors: doors, boxes: boxes, spawn: spawn, hole: hole, river: river, arena: arena, match: match, nearDoor: nearDoor, items: items.length, still: still, seed: seed }; },
        begin: begin, enter: enter, render: function () { gather(); render(); }
    };
})();
