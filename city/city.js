// The overworld of rickseufert.com (city/index.html).
//
// The site as a city, in wireframe, laid out from the date: every part of
// it is a building you can walk up to and enter. The arena is a stadium
// with a live match on the scoreboard, the Julia set is the river, the
// dashboard is a weather station on a hill, the blog is a row of mailboxes,
// the backrooms are a manhole, rickbot runs the helpdesk kiosk on the
// plaza, Dick Dank is on at the venue, and the mocks are the towers. The
// streets are named in the elves' script, which drifts back into English
// while you stand still. It rebuilds itself at midnight. The sky is the
// real one over Portland at the real time (city/sky.js), so the Dipper
// wheels round Polaris as the night goes on, and T runs the clock fast to
// watch it. People stand about with errands that send you to the rest of
// the site and check, when you come back, that you went; others just
// talk. Pigeons scatter, rats run the curb, bats and fireflies come out
// at night, a dolphin jumps in the river, a deer grazes the hill at dawn.
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
    var unfillButton = document.getElementById("city-unfill");
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
    // The sky's clock: now, or the hour the address asks for, plus however
    // far the time-lapse (T) has run it on.
    var LAT = 45.52, LON = -122.68;        // Portland, where the dashboard looks
    var lapse = false, lapsed = 0;
    function skyDate() {
        var d = new Date();
        if (forcedHour !== null) { d.setHours(Math.floor(forcedHour), Math.round((forcedHour % 1) * 60), 0, 0); }
        if (lapsed) d = new Date(d.getTime() + lapsed * 3600000);
        return d;
    }
    function hourNow() { var d = skyDate(); return d.getHours() + d.getMinutes() / 60; }

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
        // Baby, asleep in a doorway on a far block.
        var far = blocks.slice(builders.length).filter(function (b) { return Math.abs(b.i - plaza.i) + Math.abs(b.j - plaza.j) >= 4; });
        var bb = far[Math.floor(rand() * far.length)] || blocks[blocks.length - 1], bo = origin(bb.i, bb.j);
        npc(bo.x + 1.5 + Math.floor(rand() * (BLOCK - 3)), bo.z - 1.5, "baby", "cat", "#ff8c1a", {
            ask: "baby: ...mrp. (asleep. then awake. then: oh, it is you. nugget sent you. baby will go home when baby is ready, which is now, as it happens.)",
            wait: "", thanks: "", after: "baby: (gone home, in baby's own time.)"
        });
        Q.flags.babyAt = null;
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
        fauna();
        npc(hole.x - 4, hole.z + 3, "the sysadmin", "cap", "#ffb000", { idle: [
            "the sysadmin: DO NOT REBOOT WITHOUT ROOT TOKEN. seriously.",
            "the sysadmin: the hum is 60 hertz. it was 60 hertz in 2016. we have a ticket.",
            "the sysadmin: someone keeps going down there and coming back thirty seconds short. we have a ticket for that too.",
            "the sysadmin: the cron runs at 04:17. be here at 04:17 and you'll meet it. it's not friendly. it's punctual. press T if you can't wait."
        ] });
        npc(hole.x + 6, hole.z - 4, "the cron job", "cap", "#8d8d98", { when: function (h) { return h >= 4 && h < 4.6; }, idle: [
            "the cron job: 04:17. i run. i save the sky. i commit to sky-data. i go. you are in the way.",
            "the cron job: every night. nobody watches. tonight someone watched. it changes nothing. i run.",
            "the cron job: in a minute i will not be here and you will not be able to prove i was. that is the job."
        ] });
        npc(hole.x + 4, hole.z + 3, "the ghost", "ghost", "#8fe7ff", {
            ask: "the ghost: i left something down there. not an object. the last thirty seconds. go under, let it find you, and leave your ghost in the halls. then come back and tell me we are two.",
            wait: "the ghost: nothing left yet. it has to find you first. that part is not hard.",
            thanks: "the ghost: two of us now, walking the same thirty seconds, on the same seed. it is company. it is not good company. it is company.",
            after: "the ghost: still walking. we both are."
        });
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
        npc(cx + 11, cz - 11, "josh allen", "big", "#ffffff", { idle: [
            "josh allen: i am not in that photo.",
            "josh allen: the alt text says i am. i don't argue with alt text. i don't agree with it either.",
            "josh allen: where would you rather be than right here, right now. that's marv. i'm just standing here.",
            "josh allen: the hurdle was fine. the table was not reinforced. that is the point of the table."
        ] });
        npc(cx - 11, cz - 11, "the mayor", "cap", "#ffffff", { idle: [
            "the mayor: pop. 1. that's me. i'm also the census.",
            "the mayor: the city is rebuilt at midnight by a seed. i am re-elected at midnight by the same seed. it has never gone the other way. i have never asked why.",
            "the mayor: the key to the city is a localStorage key. i'm not supposed to say that.",
            "the mayor: the river is the julia. the fountain is the julia. the strip under the menu is the julia. we have one julia and we are proud of her."
        ] });
        npc(cx - 9, cz + 3, "a tourist", "cap", "#8d8d98", { idle: [
            "a tourist: is this the dashboard? i'm looking for the dashboard.",
            "a tourist: someone said the backrooms were under here. i've been looking for a stairs.",
            "a tourist: the signs are in some kind of... i stood still and it fixed itself. is that a feature?",
            "a tourist: i came for the mock SAP. i'm staying for the heron.",
            "a tourist: the mayor said pop. 1 and then counted himself twice."
        ] });
        npc(cx + 9, cz + 2, "the mime", "ghost", "julia", { idle: [
            "the mime: every direction is the same direction, smaller.",
            "the mime: c = -0.7269 + 0.1889i. please don't zoom too far.",
            "the mime: the strip under the menu is me. the river is me. the fountain is me. i am very tired.",
            "the mime: (says nothing. is a mime. the colours change anyway.)"
        ] });
        npc(cx + 7, cz - 5, "a machine elf", "elf", "#ff3d9a", { idle: [
            "a machine elf: a tuesday. a chord. the feeling of a page that has finished loading. no refunds.",
            "a machine elf: we came through the strip. it is drafty. we stay for the hum.",
            "a machine elf: the palette is not for sale. it is for escaping. ask the helpdesk, after it stops lying.",
            "a machine elf: everything is normal. nothing is normal. both are on sale."
        ] });
        npc(cx + 4, cz + 8, "the intern", "cap", "#00e5ff", {
            ask: "the intern: the helpdesk says everything is normal. it is a render. ask it enough questions, five is enough, and it will tell you what it is. go and catch it. then come back.",
            wait: "the intern: it has not cracked yet. keep asking. anything. the fifth answer is the one.",
            thanks: "the intern: it told you. machine elves. i have been saying this since i started. nobody listens to the intern.",
            after: "the intern: told you."
        });
        npc(cx - 6, cz - 4, "the elf", "elf", "#c288ff", {
            ask: "the elf: it is drafty between dimensions and the halls under the plaza are warmer. go under. the manhole is in a far street. let it find you, or find the way down. then come back and tell me how far it goes. it does not go anywhere. that is the joke.",
            wait: "the elf: you have not been under. the manhole. a far street. the readout at the bottom of the page will know.",
            thanks: "the elf: you went under and came back up, which most of us do not. the palette is yours when you escape the other place. ask the helpdesk.",
            after: "the elf: cold. still cold."
        });
        // The town sign at the south gate.
        var sx = cx + 8, sz = o.z - 2.5;
        poly([[sx - 3, 1.6, sz], [sx + 3, 1.6, sz], [sx + 3, 3.8, sz], [sx - 3, 3.8, sz]], { closed: true, col: "#ffffff" });
        pole(sx - 2.6, sz, 1.6, { col: "#ffffff" }); pole(sx + 2.6, sz, 1.6, { col: "#ffffff" });
        label("RICKSEUFERT.COM", sx, 3.35, sz - 0.02, 0.5, "#ffffff");
        var popSign = label("EST. 2016 · POP. 1 · REBUILT AT MIDNIGHT", sx, 2.75, sz - 0.02, 0.28, "#ffffff");
        anims.push({ sign: popSign });
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
        npc(cx - 7, cz - r - 3, "rammer", "tank", "#ff5a2e", { idle: [
            "RAMMER: i beat heron. heron beat circler 44 of 60 and everyone made a fuss. i beat heron. nobody wrote that down.",
            "RAMMER: my whole plan is: be where you are. it works more than you'd think.",
            "RAMMER: dodger keeps calling what it does a strategy. it's a direction.",
            "RAMMER: the sand is the groundskeeper's problem. the walls are mine. the walls hurt with the square of the speed, and i have never once slowed down."
        ] });
        npc(cx + 6, cz - r - 3, "the groundskeeper", "rake", "#ffd27a", {
            ask: "the groundskeeper: sand everywhere. ten tanks and not one of them sweeps. write one in the arena and keep it in a slot, any name, and come and tell me. it will be the first thing anyone here has saved.",
            wait: "the groundskeeper: no slot yet. the editor is through the gate. save as... is under the fight button.",
            thanks: "the groundskeeper: a tank with a name. it will lose, they all lose, but it is kept. that is more than i can say for the sand.",
            after: "the groundskeeper: still kept. still sand."
        });
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
        npc(x + 3, z + 27.5, "the idoc", "doc", "#c9d2dc", { idle: [
            "the idoc: status 51. error. i have been status 51 since 1998. do you know what that is like. it is like being a letter nobody opens, except the letter is also a table.",
            "the idoc: they say i will be posted. they say that in the vault. the vault is cold and the saying is warm and that is all the posting i get.",
            "the idoc: ORDERS05. that is my type. you would not understand. it is a kind of blood.",
            "the idoc: if you see a BAPI, do not tell it where i am."
        ] });
        npc(x + 27, z + 4.5, "a 997", "doc", "#c9d2dc", { idle: [
            "the 997: received. thank you.",
            "the 997: i acknowledge you. that is all i do. it is enough.",
            "the 997: AK1. AK9. A. accepted. i have never rejected anything in my life and i am tired.",
            "the 997: an 850 came through here an hour ago, folded into a plane. it wanted to be sent somewhere. don't we all."
        ] });
        npc(x + 10, z + 13, "the clerk", "cap", "#c9d2dc", {
            ask: "the clerk: the vault is cold and the idocs will not post themselves. go and look at one of the mocks, any of them, sap, edi, the bank, the invoices, and tell me what it does. i have worked here nine years and nobody has said.",
            wait: "the clerk: you have not been. the doors are right there. the towers have pages.",
            thanks: "the clerk: so that is what we do. mocks. for testing. without a license. i am going to need a minute.",
            after: "the clerk: still here. still cold. thank you for telling me."
        });
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
        npc(cx - 5, cz + 6, "the astronomer", "scope", "#8fe7ff", {
            ask: "the astronomer: the sky up there is the real one, for portland, for now. polaris is 45 degrees up in the north because that is our latitude, and it does not move, because the earth turns about it. everything else goes round it, fifteen degrees an hour. press T and run the clock a full day round. then come back and tell me the dipper came home.",
            wait: "the astronomer: not a full turn yet. T runs it, T stops it. look north. the dipper's bowl points at polaris the whole way round.",
            thanks: "the astronomer: a full day and it is back where it was, minus four minutes, which is why winter has orion and summer has the scorpion. the names stay on now if you press C. go and look at something else, i will be here.",
            after: "the astronomer: still turning. always will. press C for the names."
        , then: function () { namesOn = true; } });
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
        npc(cx - 8, cz - 7, "the dolphin", "dolphin", "#ffffff", { idle: [
            "the dolphin: i found your thoughts. they are mostly about lunch.",
            "the dolphin: 433.92 megahertz. that was your garage. i did not open it. i could have.",
            "the dolphin: six apps and one buzzer. people say it sounds exactly as good as a piezo. it does.",
            "the dolphin: they wheel me out here for the tourists. the river is right there. nobody asks."
        ] });
        npc(cx + 6, cz - 7, "nugget", "cat", "#ff8c1a", {
            ask: "nugget: mrow. (baby is lost. baby is always lost. baby is somewhere in this city, probably on a step, probably asleep. find baby and tell baby to come home.)",
            wait: "nugget: mrow? (not found yet. try the far blocks. baby likes a doorway.)",
            thanks: "nugget: prrrr. (baby is home. baby was never not home, in baby's view. yulia will feed us both.)",
            after: "nugget: mrow. (fed.)"
        });
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
        npc(cx + (n + 1) / 2 * 4, cz - 1, "the postman", "cap", "#b6ff3a", {
            ask: "the postman: mail is answered in order of arrival and 2016 is next. these boxes are the posts. read one, any one, the whole thing, and come and tell me what it said. nobody reads the letters. they read the subject line.",
            wait: "the postman: the whole post. the mailboxes open. a post is a page.",
            thanks: "the postman: you read one. the direct debit one is my favourite; a payment that came back is a letter that came back. anyway. the queue is shorter by nothing.",
            after: "the postman: 2016 is still next."
        });
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
        npc(cx - 10, cz - 7, "the roadie", "cap", "#c288ff", { idle: [
            "the roadie: one. one. one. check. one.",
            "the roadie: one player open at a time. took a surprising amount of work. the other players have to close. they don't want to.",
            "the roadie: dick dank is in. he is always in. the loop is the set. the set is the loop.",
            "the roadie: the waveform on the wall is a mountain range you could hike if you had the time. nobody has the time. that's the song."
        ] });
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
        npc(cx - 8, cz - 3, "the usher", "cap", "#ff3d9a", { idle: [
            "the usher: the film is four minutes long and loops. people stay for hours. i don't say anything. it's the plasma.",
            "the usher: the scroller greets everyone. it greeted you. you were in there between the heron and josh allen.",
            "the usher: no, the trainer options don't work. F1 unlimited cookies. there are no cookies. that's the trainer.",
            "the usher: tomorrow's tune is in C sharp phrygian. i've heard it. it's fine. i've heard all of them. they're all fine."
        ] });
        npc(cx + 8, cz - 3, "the projectionist", "cap", "#ff3d9a", {
            ask: "the projectionist: tonight's tune has not been heard. it was written at midnight by a seed and nobody has pressed fire. go in, press it, let it play. then come back and hum it. you will not be able to.",
            wait: "the projectionist: not tonight's. the fire button is on the intro's stage, and the sound has to be on.",
            thanks: "the projectionist: that was it. tune #" + today() + ". by tomorrow it will be gone and there will be another, and that one nobody will hear either, unless.",
            after: "the projectionist: tomorrow's will be different. come back."
        });
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
        var tc = -SIZE / 2 + STREET / 2 + gaugeAt * PITCH;
        npc(tc - 2.2, (river.z0 + river.z1) / 2, "the tide", "ghost", "julia", { idle: [
            "the tide: i run upstream twice a day. at portland. on the tide. nobody believes a river runs backwards, and then it does, and they look at the gauge.",
            "the tide: the heron thinks i am the river. i am what the river does when the ocean asks.",
            "the tide: 7.2 feet and rising, which it will be forever now. that's the dungeon's number. mine is on the dashboard.",
            "the tide: the dolphin on the trolley belongs in here. tell them."
        ] });
        var hn = npc(hx, river.z0 - 2.5, "the heron", "ghost", "#8fe7ff", {
            ask: "the heron: i have watched this gauge for nine years and i cannot read. go to the dashboard, the station on the hill, and read me the willamette. the number in feet. then come back and say it.",
            wait: "the heron: you have not been to the dashboard. the hill. the door at the station.",
            thanks: "the heron: you went. i will tell you what it says now; i had it all along, i only wanted company.",
            after: "the heron: still watching.", then: sayGauge
        });
        hn.polys.forEach(function (p) { p.pts = []; });   // the heron in the water is the heron; this one is the door
        labels.pop();
    }

    // ---- the people and their errands --------------------------------------------
    // Each is a figure with something to ask. The errand sends you somewhere
    // else on the site, and when you come back they check: the pages you
    // have been to (chat.js keeps footprints), the backrooms' record, the
    // ghosts, the arena's slots, the intro's tune, rickbot's dungeon. Done is
    // kept in localStorage under city-quests. Run every one and the town's
    // population goes up by one and the elves name a star after you.
    var Q = { active: {}, done: {}, flags: {} };
    try { var q0 = JSON.parse(localStorage.getItem("city-quests")); if (q0 && q0.done) Q = { active: q0.active || {}, done: q0.done || {}, flags: q0.flags || {} }; } catch (e) { /* fresh */ }
    function saveQ() { try { localStorage.setItem("city-quests", JSON.stringify(Q)); } catch (e) { /* a visit's worth */ } }
    function stored(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
    function footprints() { return stored("footprints") || []; }
    function went(re) { return footprints().some(function (p) { return re.test(p); }); }
    var showLog = false;
    var QUESTS = [
        { id: "gauge", who: "the heron", title: "read the gauge", check: function () { return went(/^\/dashboard\/?$/); } },
        { id: "fall", who: "the elf", title: "go under", check: function () { var b = stored("backrooms"); return !!(b && (b.deaths > 0 || b.best > 0)); } },
        { id: "tank", who: "the groundskeeper", title: "keep a tank", check: function () { var t = stored("arena-tanks"); return !!(t && (Array.isArray(t) ? t.length : Object.keys(t).length)); } },
        { id: "tune", who: "the projectionist", title: "hear today's tune", check: function () { var v = null; try { v = localStorage.getItem("intro-played"); } catch (e) { v = null; } return v === String(today()); } },
        { id: "post", who: "the postman", title: "read a letter", check: function () { return went(/^\/blog\/20/); } },
        { id: "ghost", who: "the ghost", title: "leave a ghost", check: function () { var g = stored("backrooms-ghosts"); return !!(g && g.length); } },
        { id: "cat", who: "nugget", title: "find baby", check: function () { return !!Q.flags.baby; } },
        { id: "mocks", who: "the clerk", title: "see a mock", check: function () { return went(/^\/(mock-sap|mock-edi|mock-bank|mock-einvoice)\//); } },
        { id: "lie", who: "the intern", title: "catch the helpdesk lying", check: function () { var r = stored("rickbot"); return !!(r && r.room); } },
        { id: "turn", who: "the astronomer", title: "watch the sky turn", check: function () { return (Q.flags.lapsed || 0) >= 24; } }
    ];
    function doneCount() { return QUESTS.filter(function (q) { return Q.done[q.id]; }).length; }
    function allDone() { return doneCount() === QUESTS.length; }
    var npcs = [];
    // A figure in a few lines: a person, a cat, a ghost, an elf, with a prop.
    function figure(kind, x, z, col) {
        var P = [], c = col || "#ffffff";
        function L(pts, o) { P.push(poly(pts, Object.assign({ col: c }, o || {}))); }
        if (kind === "cat") {
            L([[x - 0.35, 0.25, z], [x + 0.35, 0.25, z]]); L([[x + 0.35, 0.25, z], [x + 0.5, 0.45, z], [x + 0.6, 0.35, z]]); L([[x - 0.35, 0.25, z], [x - 0.55, 0.5, z]]);
            L([[x + 0.38, 0.35, z], [x + 0.62, 0.35, z], [x + 0.62, 0.58, z], [x + 0.55, 0.52, z], [x + 0.45, 0.52, z], [x + 0.38, 0.58, z]], { closed: true });
            L([[x - 0.25, 0.25, z], [x - 0.25, 0, z]]); L([[x + 0.25, 0.25, z], [x + 0.25, 0, z]]);
            return P;
        }
        var h = kind === "elf" ? 1.1 : kind === "ghost" ? 1.5 : 1.75, y0 = kind === "ghost" ? 0.3 : 0;
        L([[x, y0 + h * 0.15, z], [x, y0 + h * 0.8, z]]);
        L([[x - 0.12, y0 + h * 0.8, z], [x + 0.12, y0 + h * 0.8, z], [x + 0.12, y0 + h, z], [x - 0.12, y0 + h, z]], { closed: true });
        L([[x, y0 + h * 0.72, z], [x + 0.25, y0 + h * 0.45, z]]); L([[x, y0 + h * 0.72, z], [x - 0.25, y0 + h * 0.45, z]]);
        if (kind === "ghost") L([[x - 0.2, y0 + h * 0.15, z], [x - 0.1, y0, z], [x, y0 + h * 0.1, z], [x + 0.1, y0, z], [x + 0.2, y0 + h * 0.15, z]]);
        else { L([[x, y0 + h * 0.15, z], [x + 0.15, 0, z]]); L([[x, y0 + h * 0.15, z], [x - 0.15, 0, z]]); }
        if (kind === "cap") L([[x - 0.16, y0 + h, z], [x + 0.2, y0 + h, z], [x + 0.2, y0 + h + 0.05, z]]);
        if (kind === "rake") { L([[x + 0.25, y0 + h * 0.45, z], [x + 0.45, 0, z]]); L([[x + 0.3, 0.05, z], [x + 0.6, 0.05, z]]); }
        if (kind === "scope") { L([[x + 0.25, y0 + h * 0.45, z], [x + 0.9, y0 + h * 0.9, z]]); L([[x + 0.6, 0, z], [x + 0.55, y0 + h * 0.65, z]]); L([[x + 0.5, 0, z], [x + 0.55, y0 + h * 0.65, z]]); }
        if (kind === "elf") L([[x - 0.12, y0 + h, z], [x, y0 + h + 0.35, z], [x + 0.12, y0 + h, z]]);
        if (kind === "big") { L([[x - 0.16, y0 + h, z], [x + 0.2, y0 + h, z], [x + 0.2, y0 + h + 0.05, z]]); L([[x - 0.3, y0 + h * 0.72, z], [x + 0.3, y0 + h * 0.72, z]]); }
        return P;
    }
    // Things that talk but are not people: a document, a tank, a dolphin.
    function thing(kind, x, z, col) {
        var P = [], c = col || "#ffffff";
        function L(pts, o) { P.push(poly(pts, Object.assign({ col: c }, o || {}))); }
        if (kind === "doc") {
            L([[x - 0.35, 0.2, z], [x + 0.35, 0.2, z], [x + 0.35, 1.2, z], [x - 0.35, 1.2, z]], { closed: true });
            [0.4, 0.6, 0.8, 1.0].forEach(function (y) { L([[x - 0.25, y, z - 0.01], [x + (y === 1.0 ? 0.05 : 0.25), y, z - 0.01]]); });
            L([[x - 0.15, 0.2, z], [x - 0.2, 0, z]]); L([[x + 0.15, 0.2, z], [x + 0.2, 0, z]]);
        }
        if (kind === "tank") {
            L([[x - 0.6, 0.1, z - 0.4], [x + 0.6, 0.1, z - 0.4], [x + 0.6, 0.5, z - 0.4], [x - 0.6, 0.5, z - 0.4]], { closed: true });
            L([[x - 0.6, 0.1, z + 0.4], [x + 0.6, 0.1, z + 0.4], [x + 0.6, 0.5, z + 0.4], [x - 0.6, 0.5, z + 0.4]], { closed: true });
            L([[x - 0.6, 0.5, z - 0.4], [x - 0.6, 0.5, z + 0.4]]); L([[x + 0.6, 0.5, z - 0.4], [x + 0.6, 0.5, z + 0.4]]);
            L([[x - 0.3, 0.5, z - 0.2], [x + 0.3, 0.5, z - 0.2], [x + 0.3, 0.85, z - 0.2], [x - 0.3, 0.85, z - 0.2]], { closed: true });
            L([[x, 0.7, z - 0.2], [x, 0.7, z - 1.1]]);
        }
        if (kind === "dolphin") {
            L([[x - 0.9, 0.5, z], [x - 0.4, 0.75, z], [x + 0.2, 0.8, z], [x + 0.8, 0.6, z], [x + 1.1, 0.45, z]]);
            L([[x - 0.9, 0.5, z], [x - 0.4, 0.35, z], [x + 0.2, 0.3, z], [x + 0.8, 0.4, z], [x + 1.1, 0.45, z]]);
            L([[x - 0.1, 0.8, z], [x + 0.1, 1.15, z], [x + 0.3, 0.78, z]]);
            L([[x - 0.9, 0.5, z], [x - 1.2, 0.8, z]]); L([[x - 0.9, 0.5, z], [x - 1.2, 0.25, z]]);
            L([[x - 1.2, 0, z], [x - 1.2, 0.5, z], [x + 1.1, 0.5, z], [x + 1.1, 0, z]], { col: "#5a6a7a" });   // the trolley it is wheeled about on
        }
        return P;
    }
    function npc(x, z, name, kind, col, lines) {
        var isThing = /^(doc|tank|dolphin)$/.test(kind);
        var n = { name: name, x: x, z: z, kind: kind, col: col, lines: lines, polys: isThing ? thing(kind, x, z, col) : figure(kind, x, z, col), quest: QUESTS.filter(function (q) { return q.who === name; })[0] || null, said: 0 };
        var lift = ground(x, z);                                   // the hill, under the astronomer
        if (lift) n.polys.forEach(function (p) { p.pts.forEach(function (q) { q[1] += lift; }); });
        n.label = label(name.toUpperCase(), x, (kind === "cat" ? 0.95 : kind === "doc" || kind === "tank" ? 1.5 : kind === "dolphin" ? 1.6 : kind === "big" ? 2.4 : 2.15) + lift, z, 0.22, col);
        n.door = door(x, z, name, "", "npc", 2.4); n.door.npc = n;
        if (lines.when) { n.when = lines.when; anims.push({ visitor: n }); }
        npcs.push(n);
        if (kind === "ghost" || kind === "elf") anims.push({ bob: n, base: n.polys.map(function (p) { return p.pts.map(function (q) { return q.slice(); }); }) });
        return n;
    }
    // What they say: before, while, when you are back, and after.
    function talk(n) {
        var q = n.quest, L = n.lines;
        if (n.name === "baby") { if (!Q.flags.baby) { Q.flags.baby = true; saveQ(); say(L.ask, 8); } else say(L.after, 5); return; }
        if (!q) {
            // No errand, only things to say, in turn.
            var idle = Array.isArray(L.idle) ? L.idle[n.said % L.idle.length] : L.idle;
            n.said++;
            say(idle, 7);
            return;
        }
        if (Q.done[q.id]) { say(L.after, 6); return; }
        if (!Q.active[q.id]) { Q.active[q.id] = true; saveQ(); say(L.ask, 9); return; }
        if (!q.check()) { say(L.wait, 7); return; }
        Q.done[q.id] = true; saveQ();
        say(L.thanks, 9);
        if (audio) audio.enter();
        if (L.then) L.then();
        if (allDone() && !Q.flags.star) { Q.flags.star = true; saveQ(); setTimeout(function () { say("that was the last one. the sign says POP. 2 now. and the elves have named a star after you, up by polaris, so it never sets. press C.", 12); }, 9000); }
    }
    function sayGauge() {
        fetch("https://waterservices.usgs.gov/nwis/iv/?format=json&sites=14211720&parameterCd=00065&period=P1D")
            .then(function (r) { return r.json(); })
            .then(function (j) { var v = j.value.timeSeries[0].values[0].value; var last = v[v.length - 1]; say("the heron: " + (+last.value).toFixed(2) + " feet at the morrison bridge. " + (+last.value > 8 ? "rising, probably. everything is." : "it has been higher. everything has."), 8); })
            .catch(function () { say("the heron: the gauge is quiet. it does that.", 5); });
    }

    // ---- the fauna ----------------------------------------------------------------
    // Pigeons on the plaza that scatter, rats on the curb by the manhole,
    // bats round the lamps and fireflies by the river at night, crows on
    // a roof by day, a dolphin that jumps the river now and then, a deer on
    // the hill at dawn and dusk that runs if you come close, and a raccoon
    // on a mailbox after dark. Each is a polyline rebuilt every frame.
    var critters = [];
    function critter(type, x, z, o) {
        var c = Object.assign({ type: type, x: x, z: z, y: 0, hx: x, hz: z, t: Math.random() * 10, a: Math.random() * 6.28, state: 0, poly: poly([], { col: (o && o.col) || "#aab4c0" }) }, o || {});
        critters.push(c);
        return c;
    }
    function fauna() {
        var o = origin(plaza.i, plaza.j), cx = o.x + BLOCK / 2, cz = o.z + BLOCK / 2, k;
        for (k = 0; k < 7; k++) critter("pigeon", cx - 8 + rand() * 16, cz - 12 + rand() * 6);
        for (k = 0; k < 3; k++) critter("rat", hole.x - 6 + k * 4, hole.z + 5 - 0.3, { col: "#8d8d98" });
        [[o.x + 2, o.z + 2], [o.x + BLOCK - 2, o.z + BLOCK - 2]].forEach(function (p) { for (k = 0; k < 2; k++) critter("bat", p[0], p[1], { col: "#8d8d98" }); });
        for (k = 0; k < 18; k++) critter("firefly", -SIZE / 2 + 20 + rand() * (SIZE - 40), river.z0 - 6 + rand() * (river.z1 - river.z0 + 12), { col: "#b6ff3a" });
        critter("dolphin", river.heron.x + 10, (river.z0 + river.z1) / 2, { col: "#ffffff" });
        var roof = boxes.filter(function (b) { return b.h > 12 && b.h < 30 && !b.name; })[Math.floor(rand() * 5)] || boxes[0];
        for (k = 0; k < 3; k++) critter("crow", roof.x + 1 + k * 2, roof.z + 0.5, { y: roof.y0 + roof.h, col: "#333a44", roof: roof });
        var dash = anims.filter(function (a) { return a.cups; })[0];
        if (dash) critter("deer", dash.x - 7, dash.z + 4, { col: "#d9c2a0" });
        var mb = boxes.filter(function (b) { return b.y0 === 1.2; })[0];
        if (mb) critter("raccoon", mb.x + b0(mb), mb.z + mb.d / 2, { y: 1.8, col: "#8d8d98" });
        function b0(b) { return b.w / 2; }
    }
    function updateFauna(dt) {
        var dark = sunAlt() < -4, dusk = sunAlt() > -8 && sunAlt() < 12;
        critters.forEach(function (c) {
            c.t += dt;
            var d = Math.hypot(c.x - cam.x, c.z - cam.z);
            if (d > FOG) { c.poly.pts = []; return; }
            FAUNA[c.type](c, dt, d, dark, dusk);
        });
    }
    function seg(P, a, b) { P.push(a, b); }
    var FAUNA = {
        pigeon: function (c, dt, d) {
            if (c.state === 0) {                                          // walking about, pecking
                if (Math.random() < dt * 0.5) c.a += (Math.random() - 0.5) * 2;
                c.x += Math.cos(c.a) * dt * 0.6; c.z += Math.sin(c.a) * dt * 0.6;
                if (Math.hypot(c.x - c.hx, c.z - c.hz) > 9) c.a += Math.PI;
                if (d < 4) { c.state = 1; c.t = 0; c.a = Math.atan2(c.z - cam.z, c.x - cam.x) + (Math.random() - 0.5); if (audio) audio.flap(); }
            } else {                                                      // up, away, and down somewhere else
                c.x += Math.cos(c.a) * dt * 6; c.z += Math.sin(c.a) * dt * 6;
                c.y = Math.sin(Math.min(1, c.t / 2.5) * Math.PI) * 4;
                if (c.t > 2.5) { c.state = 0; c.y = 0; c.hx = c.x; c.hz = c.z; }
            }
            var P = [], x = c.x, y = c.y, z = c.z, ca = Math.cos(c.a), sa = Math.sin(c.a), peck = c.state ? 0 : Math.max(0, Math.sin(c.t * 6)) * 0.06;
            seg(P, [x - ca * 0.15, y + 0.12, z - sa * 0.15], [x + ca * 0.12, y + 0.2 - peck, z + sa * 0.12]);
            seg(P, [x + ca * 0.12, y + 0.2 - peck, z + sa * 0.12], [x + ca * 0.2, y + 0.16 - peck, z + sa * 0.2]);
            var flap = c.state ? Math.sin(c.t * 20) * 0.25 : 0.02;
            seg(P, [x, y + 0.15, z], [x - sa * 0.25, y + 0.15 + flap, z + ca * 0.25]); seg(P, [x, y + 0.15, z], [x + sa * 0.25, y + 0.15 + flap, z - ca * 0.25]);
            if (!c.state) { seg(P, [x, y + 0.1, z], [x, y, z]); }
            c.poly.pts = P; c.poly.closed = false; c.poly.pairs = true;
        },
        rat: function (c, dt) {
            if (c.state === 0 && Math.random() < dt * 0.4) { c.state = 1; c.dir = Math.random() < 0.5 ? -1 : 1; c.t = 0; }
            if (c.state === 1) { c.x += c.dir * dt * 4; if (c.t > 1.2 + Math.random()) c.state = 0; if (Math.abs(c.x - c.hx) > 6) c.dir *= -1; }
            var P = [], x = c.x, z = c.z, wig = c.state ? Math.sin(c.t * 25) * 0.04 : 0;
            seg(P, [x - 0.2, 0.08, z], [x + 0.2, 0.1, z + wig]); seg(P, [x + 0.2, 0.1, z + wig], [x + 0.3, 0.06, z + wig]);
            seg(P, [x - 0.2, 0.08, z], [x - 0.55, 0.02, z - wig * 2]);
            c.poly.pts = P; c.poly.pairs = true;
        },
        bat: function (c, dt, d, dark) {
            if (!dark || REDUCED) { c.poly.pts = []; return; }
            var t = c.t * 1.7, x = c.hx + Math.sin(t) * 3 + Math.sin(t * 2.3) * 1.2, z = c.hz + Math.cos(t * 0.9) * 3 + Math.cos(t * 2.1), y = 5 + Math.sin(t * 1.3) * 1.2;
            var P = [], w = 0.35, f = Math.sin(c.t * 18) * 0.2;
            seg(P, [x - w, y + f, z], [x, y - 0.05, z]); seg(P, [x, y - 0.05, z], [x + w, y + f, z]);
            c.poly.pts = P; c.poly.pairs = true;
        },
        firefly: function (c, dt, d, dark) {
            if (!dark) { c.poly.pts = []; return; }
            var on = Math.sin(c.t * 2 + c.a * 7) > 0.55;
            c.x += Math.sin(c.t * 0.7 + c.a) * dt * 0.4; c.z += Math.cos(c.t * 0.5 + c.a) * dt * 0.4;
            var y = 0.5 + Math.sin(c.t * 0.9 + c.a) * 0.4;
            c.poly.pts = on ? [[c.x, y, c.z], [c.x + 0.05, y + 0.05, c.z]] : [];
            c.poly.pairs = true; c.poly.width = 2;
        },
        dolphin: function (c, dt) {
            var period = 11, u = c.t % period;
            if (u > 1.6) { c.poly.pts = []; return; }
            var k = u / 1.6, x = c.hx - 4 + k * 8, y = Math.sin(k * Math.PI) * 2.2 - 0.3, z = c.hz, ang = Math.cos(k * Math.PI) * 0.9;
            var P = [], ca = Math.cos(ang), sa = Math.sin(ang);
            function B(u, v) { return [x + u * ca - v * sa, y + u * sa + v * ca, z]; }
            seg(P, B(-1, 0), B(-0.4, 0.22)); seg(P, B(-0.4, 0.22), B(0.3, 0.25)); seg(P, B(0.3, 0.25), B(1.0, 0.05)); seg(P, B(1.0, 0.05), B(1.3, 0));
            seg(P, B(-1, 0), B(-0.4, -0.18)); seg(P, B(-0.4, -0.18), B(0.3, -0.2)); seg(P, B(0.3, -0.2), B(1.0, -0.05)); seg(P, B(1.0, -0.05), B(1.3, 0));
            seg(P, B(-0.1, 0.25), B(0.05, 0.6)); seg(P, B(0.05, 0.6), B(0.3, 0.25)); seg(P, B(-1, 0), B(-1.3, 0.3)); seg(P, B(-1, 0), B(-1.3, -0.3));
            c.poly.pts = P; c.poly.pairs = true;
        },
        crow: function (c, dt, d, dark) {
            if (dark) { c.poly.pts = []; return; }
            if (Math.random() < dt * 0.15) { c.hop = 0.3; }
            c.hop = Math.max(0, (c.hop || 0) - dt);
            var y = c.y + Math.sin(c.hop * 10) * 0.15, x = c.x, z = c.z, P = [];
            seg(P, [x - 0.25, y + 0.15, z], [x + 0.15, y + 0.3, z]); seg(P, [x + 0.15, y + 0.3, z], [x + 0.3, y + 0.25, z]); seg(P, [x - 0.25, y + 0.15, z], [x - 0.4, y + 0.3, z]);
            seg(P, [x, y + 0.15, z], [x, y, z]);
            c.poly.pts = P; c.poly.pairs = true;
        },
        deer: function (c, dt, d, dark, dusk) {
            if (!dusk || c.gone) { c.poly.pts = []; if (!dusk) c.gone = false; return; }
            if (d < 7 && !c.fled) { c.fled = true; c.t = 0; c.a = Math.atan2(c.z - cam.z, c.x - cam.x); }
            if (c.fled) { c.x += Math.cos(c.a) * dt * 9; c.z += Math.sin(c.a) * dt * 9; if (c.t > 2.5) { c.gone = true; c.fled = false; c.x = c.hx; c.z = c.hz; } }
            var y = ground(c.x, c.z), x = c.x, z = c.z, P = [], head = c.fled ? 1.1 : (Math.sin(c.t * 0.6) > 0.3 ? 1.1 : 0.55), run = c.fled ? Math.sin(c.t * 12) * 0.2 : 0;
            seg(P, [x - 0.5, y + 0.8, z], [x + 0.5, y + 0.85, z]); seg(P, [x + 0.5, y + 0.85, z], [x + 0.75, y + head, z]); seg(P, [x + 0.75, y + head, z], [x + 0.95, y + head - 0.05, z]);
            seg(P, [x + 0.7, y + head + 0.05, z], [x + 0.65, y + head + 0.3, z]); seg(P, [x + 0.78, y + head + 0.05, z], [x + 0.85, y + head + 0.3, z]);
            seg(P, [x - 0.4, y + 0.8, z], [x - 0.45 - run, y, z]); seg(P, [x - 0.3, y + 0.8, z], [x - 0.25 + run, y, z]); seg(P, [x + 0.3, y + 0.85, z], [x + 0.25 - run, y, z]); seg(P, [x + 0.45, y + 0.85, z], [x + 0.5 + run, y, z]);
            seg(P, [x - 0.5, y + 0.8, z], [x - 0.65, y + 0.7, z]);
            c.poly.pts = P; c.poly.pairs = true;
        },
        raccoon: function (c, dt, d, dark) {
            if (!dark) { c.poly.pts = []; return; }
            var x = c.x, y = c.y, z = c.z, P = [], turn = Math.sin(c.t * 0.4) * 0.1;
            seg(P, [x - 0.35, y + 0.05, z], [x - 0.2, y + 0.3, z]); seg(P, [x - 0.2, y + 0.3, z], [x + 0.2, y + 0.3, z]); seg(P, [x + 0.2, y + 0.3, z], [x + 0.35 + turn, y + 0.15, z]);
            seg(P, [x + 0.25, y + 0.3, z], [x + 0.2, y + 0.42, z]); seg(P, [x + 0.35, y + 0.3, z], [x + 0.38, y + 0.42, z]);
            seg(P, [x - 0.35, y + 0.05, z], [x - 0.7, y + 0.25, z]); seg(P, [x - 0.55, y + 0.16, z], [x - 0.6, y + 0.3, z]); seg(P, [x - 0.45, y + 0.1, z], [x - 0.5, y + 0.24, z]);
            seg(P, [x + 0.26, y + 0.24, z - 0.02], [x + 0.28, y + 0.26, z - 0.02]); seg(P, [x + 0.33, y + 0.24, z - 0.02], [x + 0.35, y + 0.26, z - 0.02]);
            c.poly.pts = P; c.poly.pairs = true;
        }
    };

    // ---- the state -------------------------------------------------------------
    var cam = { x: 0, z: 0, y: EYE, yaw: 0, pitch: 0, fx: 0, fz: 1, rx: 1, rz: 0, cp: 1, sp: 0 };
    var PITCH_DOWN = -1.0, PITCH_UP = 1.45;
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
        doors.forEach(function (d) { if (d.hidden) return; var dd = Math.hypot(d.x - cam.x, d.z - cam.z); if (dd < d.r && dd < best) { best = dd; nearDoor = d; } });
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
        if (d.kind === "npc") { talk(d.npc); return; }
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
        var dx = x - cam.x, dz = z - cam.z, dy = y - cam.y;
        var cz = dx * cam.fx + dz * cam.fz;
        out.x = dx * cam.rx + dz * cam.rz;
        out.y = dy * cam.cp - cz * cam.sp;              // the pitch: a true turn, so you can look straight up
        out.z = dy * cam.sp + cz * cam.cp;
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
    function sy(p) { return H / 2 - f * p.y / p.z; }
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

    // Separate segments: every two points a line.
    function strokePairs(pts) {
        var any = false;
        ctx.beginPath();
        for (var i = 0; i + 1 < pts.length; i += 2) {
            var a = toCam(pts[i][0], pts[i][1], pts[i][2], {}), b = toCam(pts[i + 1][0], pts[i + 1][1], pts[i + 1][2], {});
            if (a.z < NEAR && b.z < NEAR) continue;
            if (a.z < NEAR || b.z < NEAR) { var t = (NEAR - a.z) / (b.z - a.z), m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR }; if (a.z < NEAR) a = m; else b = m; }
            ctx.moveTo(sx(a), sy(a)); ctx.lineTo(sx(b), sy(b)); any = true;
        }
        return any;
    }

    // ---- gathering and drawing -----------------------------------------------------
    var items = [];
    function item(d, draw) { items.push({ d: d, draw: draw }); }
    function night() { return SKY ? SKY.sun.alt < -6 * D : (function () { var h = hourNow(); return h < 6 || h >= 19; }()); }
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
            if (!pl.pts.length || pl.hidden) continue;
            var c0 = pl.pts[0], cx = c0[0], cz = c0[2];
            if (!inView(cx, cz, 20)) continue;
            (function (pl) {
                var d = Math.hypot(pl.pts[0][0] - cam.x, pl.pts[0][2] - cam.z);
                item(d, function () {
                    var a = fade(d); if (a <= 0.01) return;
                    if (pl.wall) { ctx.fillStyle = "#000"; ctx.globalAlpha = 1; if (strokePath(pl.pts, true)) ctx.fill(); }
                    ctx.strokeStyle = colorOf(pl.col); ctx.globalAlpha = a; ctx.lineWidth = pl.width;
                    if (pl.pairs) { if (strokePairs(pl.pts)) ctx.stroke(); }
                    else if (strokePath(pl.pts, pl.closed)) ctx.stroke();
                });
            }(pl));
        }
        for (i = 0; i < labels.length; i++) {
            var l = labels[i];
            if (l.hidden || !inView(l.x, l.z, 2)) continue;
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
        ctx.font = Math.min(px, size < 0.3 ? 18 : 64) + "px " + MONO;      // small signs stay small up close
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
    // The sky is the real one (city/sky.js): the stars where they are over
    // Portland at the clock's time, so Polaris stands 45.5° up in the north
    // and the Dipper goes round it, fifteen degrees an hour.
    var SKY = null, namesOn = false;
    function sunAlt() { return SKY ? SKY.sun.alt / D : (night() ? -30 : 40); }
    function skyColours(a) {
        // Keyframes by the Sun's altitude in degrees: top, horizon, line colour.
        var K = [[-90, "#03040c", "#0a0d2a", "#dfe6ee"], [-14, "#03040c", "#0a0d2a", "#dfe6ee"], [-9, "#06071c", "#1a1040", "#dfe6ee"], [-5, "#141038", "#7a1a5a", "#ffe3f0"],
            [-1.5, "#1a0c30", "#ff5a2e", "#ffe3d0"], [1.5, "#283a6c", "#ffb080", "#ffffff"], [8, "#0b1d3f", "#2a5c9c", "#ffffff"], [30, "#0d2452", "#3a74b8", "#ffffff"], [90, "#0d2452", "#3a74b8", "#ffffff"]];
        for (var i = 1; i < K.length; i++) if (a <= K[i][0]) {
            var t = (a - K[i - 1][0]) / (K[i][0] - K[i - 1][0]);
            return { top: mixHex(K[i - 1][1], K[i][1], t), low: mixHex(K[i - 1][2], K[i][2], t), line: mixHex(K[i - 1][3], K[i][3], t) };
        }
        return { top: "#0d2452", low: "#3a74b8", line: "#ffffff" };
    }
    function mixHex(a, b, t) {
        var out = "#";
        for (var i = 1; i < 7; i += 2) { var x = parseInt(a.substr(i, 2), 16), y = parseInt(b.substr(i, 2), 16), v = Math.round(x + (y - x) * t); out += (v < 16 ? "0" : "") + v.toString(16); }
        return out;
    }
    var D = Math.PI / 180;
    // A direction in the sky (x east, y up, z north) to the screen, or null behind you.
    function skyPoint(x, y, z) {
        var p = toCam(cam.x + x * 5000, cam.y + y * 5000, cam.z + z * 5000, {});
        if (p.z < 1) return null;
        return { x: sx(p), y: sy(p) };
    }
    function sky() {
        var c = skyColours(sunAlt());
        var g = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon));
        g.addColorStop(0, c.top); g.addColorStop(1, c.low);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, Math.max(0, horizon));
        ctx.fillStyle = "#000"; ctx.fillRect(0, Math.max(0, horizon), W, H);
        if (!SKY) return;
        var vis = Math.max(0, Math.min(1, (-sunAlt() - 3) / 9));        // the stars come out through twilight
        if (vis > 0.01) {
            var showNames = namesOn || still > 1.0 || mode === "pause";
            var pts = SKY.stars.map(function (st) { return st.alt > -0.02 ? skyPoint(st.x, st.y, st.z) : null; });
            ctx.strokeStyle = "#8fe7ff"; ctx.lineWidth = 0.8; ctx.globalAlpha = vis * 0.32;
            ctx.beginPath();
            SKY.lines.forEach(function (l) { var a = pts[l[0]], b = pts[l[1]]; if (!a || !b) return; ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); });
            ctx.stroke();
            // The pointers: Merak through Dubhe, five times over, to Polaris.
            var merak = pts[1], dubhe = pts[0], polaris = pts[7];
            if (showNames && merak && dubhe && polaris) {
                ctx.setLineDash([3, 5]); ctx.globalAlpha = vis * 0.5; ctx.beginPath(); ctx.moveTo(dubhe.x, dubhe.y); ctx.lineTo(polaris.x, polaris.y); ctx.stroke(); ctx.setLineDash([]);
            }
            ctx.fillStyle = "#fff";
            SKY.stars.forEach(function (st, i) {
                var p = pts[i]; if (!p) return;
                var size = st.mag < 0.5 ? 3.5 : st.mag < 1.6 ? 2.5 : st.mag < 3 ? 2 : 1.5;
                var a = Math.max(0.4, 1 - (st.mag + 1.5) / 6) * vis;
                if (!REDUCED && st.mag > 1) a *= 0.8 + 0.2 * Math.sin(clock * 4 + i);
                ctx.globalAlpha = a;
                if (st.name === "M31") { ctx.fillStyle = "#c9b8ff"; ctx.fillRect(p.x - 2, p.y - 1, 5, 3); ctx.fillStyle = "#fff"; return; }
                ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
            });
            if (polaris) {
                ctx.globalAlpha = vis * 0.7; ctx.strokeStyle = "#fff"; ctx.lineWidth = 0.8;
                ctx.beginPath(); ctx.arc(polaris.x, polaris.y, 5, 0, Math.PI * 2); ctx.stroke();
                ctx.font = "9px " + MONO; ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
                ctx.fillText("POLARIS · " + LAT.toFixed(1) + "° UP, ALWAYS", polaris.x + 9, polaris.y);
            }
            if (showNames) {
                ctx.font = "10px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                Object.keys(SKY.cons).forEach(function (k) {
                    var cn = SKY.cons[k]; if (cn.alt < 0.03) return;
                    var p = skyPoint(cn.x, cn.y, cn.z); if (!p || p.x < 0 || p.x > W || p.y < 0 || p.y > horizon) return;
                    ctx.globalAlpha = vis * 0.55; ctx.fillStyle = "#8fe7ff"; ctx.fillText(cn.name, p.x, p.y);
                });
                if (Q.flags.star) { var yp = skyPoint.apply(null, yourStar()); if (yp) { ctx.globalAlpha = vis; ctx.fillStyle = "#ff3d9a"; ctx.fillRect(yp.x - 1.5, yp.y - 1.5, 3, 3); ctx.font = "9px " + MONO; ctx.textAlign = "left"; ctx.fillText("YOU", yp.x + 6, yp.y); } }
            }
            ctx.globalAlpha = 1;
        }
        // The Sun and the Moon, where the hour has them.
        var su = SKY.sun, mo = SKY.moon;
        if (su.alt > -0.02) {
            var sp = skyPoint(Math.cos(su.alt) * Math.sin(su.az), Math.sin(su.alt), Math.cos(su.alt) * Math.cos(su.az));
            if (sp) { ctx.strokeStyle = "#fff3b0"; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.arc(sp.x, sp.y, 18, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 0.25; ctx.fillStyle = "#fff3b0"; ctx.fill(); ctx.globalAlpha = 1; }
        }
        if (mo.alt > -0.02) {
            var mp = skyPoint(Math.cos(mo.alt) * Math.sin(mo.az), Math.sin(mo.alt), Math.cos(mo.alt) * Math.cos(mo.az));
            if (mp) moonDisc(mp.x, mp.y, 13, mo.phase, Math.max(0.35, vis));
        }
    }
    // The Moon's phase: the lit half, then an ellipse that is the terminator.
    function moonDisc(x, y, r, phase, a) {
        var k = Math.cos(phase * Math.PI * 2), waxing = phase < 0.5;
        ctx.save(); ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = "#1a1c2a"; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
        ctx.fillStyle = "#e9eefb";
        ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !waxing); ctx.fill();
        ctx.fillStyle = k < 0 ? "#e9eefb" : "#1a1c2a";
        ctx.beginPath(); ctx.ellipse(x, y, r * Math.abs(k), r, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "#e9eefb"; ctx.lineWidth = 0.8; ctx.globalAlpha = a * 0.7; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // The star they name after you, once every errand is run: near the pole, so it never sets on you.
    function yourStar() { var p = CitySky.altaz(2.53, 85.5, SKY.lst, LAT); return [Math.cos(p.alt) * Math.sin(p.az), Math.sin(p.alt), Math.cos(p.alt) * Math.cos(p.az)]; }
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
        var c = skyColours(sunAlt());
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        horizon = H / 2 + f * Math.tan(cam.pitch);
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
        var pop = allDone() ? 2 : 1;
        ctx.fillText("RICKSEUFERT.COM · POP. " + pop + " · " + (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm + (lapse ? " ▸▸" : "") + (lapsed ? " (+" + Math.round(lapsed) + "h)" : "") + (seed === today() ? "" : " · SEED " + seed), 14, 12);
        ctx.fillText("ERRANDS " + doneCount() + "/" + QUESTS.length + (TOUCH ? "" : " · Q"), 14, 28);
        minimap();
        if (showLog) questLog(col);
        if (nearDoor && mode === "play" && nearDoor.kind !== "hole") {
            ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.font = (W < 500 ? 12 : 14) + "px " + MONO; ctx.fillStyle = "#fff";
            ctx.fillText((nearDoor.kind === "chat" || nearDoor.kind === "npc" ? "talk to " : "enter ") + nearDoor.name + (TOUCH ? "" : " · press E"), W / 2, H - 40);
        }
        if (msg.text && clock < msg.until) {
            var shown = Math.min(msg.text.length, Math.floor((clock - msg.at) * 32));
            ctx.textAlign = "left"; ctx.textBaseline = "bottom"; ctx.font = (W < 500 ? 12 : 14) + "px " + MONO; ctx.fillStyle = col;
            wrap(msg.text.slice(0, shown) + (shown < msg.text.length ? "_" : ""), 14, H - 14, W - 28);
        }
        ctx.globalAlpha = 1;
    }
    function questLog(col) {
        var w = Math.min(W - 28, 420), x = 14, y = 46, lh = 16, h = 10 + (QUESTS.length + 1) * lh;
        ctx.globalAlpha = 0.75; ctx.fillStyle = "#000"; ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 0.9; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.font = "11px " + MONO; ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillStyle = col;
        ctx.fillText("ERRANDS, OPTIONAL. EVERY ONE SENDS YOU SOMEWHERE ELSE ON THE SITE.", x + 8, y + 6);
        QUESTS.forEach(function (q, i) {
            var st = Q.done[q.id] ? "done" : Q.active[q.id] ? (q.check() ? "ready: go back" : "on it") : "ask " + q.who;
            ctx.fillStyle = Q.done[q.id] ? "#b6ff3a" : Q.active[q.id] ? "#fff" : "#8d8d98";
            ctx.fillText((Q.done[q.id] ? "x " : Q.active[q.id] ? "> " : "· ") + q.title + " — " + st, x + 8, y + 6 + (i + 1) * lh);
        });
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
        updateFauna(dt);
        anims.forEach(function (a) {
            if (a.cups) {
                var t = clock * 4, pts = [], top = 14, x = a.x, z = a.z;
                for (var k = 0; k < 3; k++) { var ang = t + k * Math.PI * 2 / 3; pts.push([x, top, z], [x + Math.cos(ang) * 1.2, top, z + Math.sin(ang) * 1.2]); }
                a.cups.pts = pts; a.cups.closed = false;
                a.light.col = Math.floor(clock * 2) % 2 ? "#ff3d9a" : "#550020";
            }
            if (a.marquee) a.marquee.col = ["#ffffff", "#ff3d9a", "#ffe9a0"][Math.floor(clock * 3) % 3];
            if (a.visitor) {
                var here = a.visitor.when(hourNow(), sunAlt());
                a.visitor.polys.forEach(function (p) { p.hidden = !here; }); a.visitor.label.hidden = !here; a.visitor.door.hidden = !here;
            }
            if (a.bob) {
                var dy = a.bob.kind === "ghost" ? Math.sin(clock * 1.3) * 0.12 : (REDUCED ? 0 : (Math.random() - 0.5) * 0.03);
                a.bob.polys.forEach(function (p, i) { p.pts = a.base[i].map(function (q) { return [q[0], q[1] + dy, q[2]]; }); });
            }
            if (a.sign) a.sign.text = "EST. 2016 · POP. " + (allDone() ? 2 : 1) + " · REBUILT AT MIDNIGHT";
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
        cam.cp = Math.cos(cam.pitch); cam.sp = Math.sin(cam.pitch);
        if (lapse && mode === "play") { lapsed += dt * 0.75; Q.flags.lapsed = (Q.flags.lapsed || 0) + dt * 0.75; if (Math.floor(lapsed) !== Math.floor(lapsed - dt * 0.75)) saveQ(); }
        SKY = window.CitySky ? CitySky.compute(skyDate(), LAT, LON) : null;
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
        if (e.code === "KeyT" && mode === "play") { lapse = !lapse; say(lapse ? "the clock runs: an hour every second and a bit. watch the north. the dipper goes round polaris and never sets; orion rises in the east and sets in the west. T again to stop." : "the clock stops at " + Math.round(lapsed) + " hours on.", 8); return; }
        if (e.code === "KeyC") { namesOn = !namesOn; say(namesOn ? "the constellations are named. stand still and they are anyway." : "the names are off.", 4); return; }
        if (e.code === "KeyQ") { showLog = !showLog; return; }
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
        cam.pitch = Math.max(PITCH_DOWN, Math.min(PITCH_UP, cam.pitch - e.movementY * 0.0022));
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
        else { cam.yaw += (e.clientX - t.x) * 0.006; cam.pitch = Math.max(PITCH_DOWN, Math.min(PITCH_UP, cam.pitch - (e.clientY - t.y) * 0.004)); t.x = e.clientX; t.y = e.clientY; still = 0; }
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
        var how = TOUCH ? "left thumb walks, right thumb looks; a button appears at a door or a person." : "wasd or arrows walk, the mouse looks, shift runs, E enters a door or talks, T runs the clock, C names the stars, Q is the errands, esc pauses.";
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
            flap: function () { burst(0.06, 0.14, 1400, "bandpass"); setTimeout(function () { burst(0.06, 0.1, 1400, "bandpass"); }, 90); setTimeout(function () { burst(0.05, 0.07, 1400, "bandpass"); }, 180); },
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
        state: function () { return { mode: mode, cam: cam, doors: doors, boxes: boxes, spawn: spawn, hole: hole, river: river, arena: arena, match: match, nearDoor: nearDoor, items: items.length, still: still, seed: seed, sky: SKY, npcs: npcs, quests: Q, lapsed: lapsed, critters: critters }; },
        talk: talk, lapse: function (on) { lapse = on; }, names: function (on) { namesOn = on; },
        begin: begin, enter: enter, render: function () { gather(); render(); }
    };
})();
