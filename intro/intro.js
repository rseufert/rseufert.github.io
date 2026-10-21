// The intro (intro/index.html): a cracktro for rickseufert.com.
//
// Before a cracked game loaded, in 1989, there was this: a plasma, a
// starfield, copper bars, a logo turning in three dimensions, a scroller
// on a sine wave greeting everyone the group knew, and a chiptune, all on
// a machine with less memory than this comment. The site has one now. The
// machine elves cracked it; the original was supplied by Rick.
//
// Everything is drawn on a small canvas (480 by 270) scaled up without
// smoothing, so the pixels are the size they used to be. The logo and the
// scroller use a stroke font kept here as line segments, the logo extruded
// and rotated and projected by hand. The tune is a four-channel tracker on
// WebAudio: a pulse lead, a triangle bass, a chord arpeggiated the fast
// way, and drums made of noise and a falling sine, in a song written from
// a seed, which is the date, so there is a new one at midnight and the
// same one all day. #tune=N asks for another. No libraries.
(function () {
    "use strict";
    var canvas = document.getElementById("intro-stage");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var stage = canvas.parentNode;
    var veil = document.getElementById("intro-veil");
    var go = document.getElementById("intro-go");
    var soundButton = document.getElementById("intro-sound");
    var fullButton = document.getElementById("intro-full");
    var nextButton = document.getElementById("intro-next");
    var tuneOut = document.getElementById("intro-tune");
    var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace';

    var W = 480, H = 270;
    canvas.width = W; canvas.height = H;

    // ---- random ------------------------------------------------------------
    function mulberry32(a) {
        return function () {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }
    function today() {
        var d = new Date();
        return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    }
    var tune = (function () {
        var m = /tune=(\d+)/.exec(location.hash);
        return m ? +m[1] % 100000000 : today();
    }());

    // ---- the stroke font ---------------------------------------------------
    // Each glyph is strokes on a 4 by 6 grid, x then y, the baseline at 6.
    var FONT = {
        A: "0,6 0,2 2,0 4,2 4,6|0,4 4,4", B: "0,6 0,0 3,0 4,1 4,2 3,3 0,3|3,3 4,4 4,5 3,6 0,6", C: "4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5",
        D: "0,6 0,0 3,0 4,1 4,5 3,6 0,6", E: "4,0 0,0 0,6 4,6|0,3 3,3", F: "4,0 0,0 0,6|0,3 3,3", G: "4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3 2,3",
        H: "0,0 0,6|4,0 4,6|0,3 4,3", I: "1,0 3,0|2,0 2,6|1,6 3,6", J: "4,0 4,5 3,6 1,6 0,5", K: "0,0 0,6|4,0 0,3 4,6", L: "0,0 0,6 4,6",
        M: "0,6 0,0 2,3 4,0 4,6", N: "0,6 0,0 4,6 4,0", O: "1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0", P: "0,6 0,0 3,0 4,1 4,2 3,3 0,3",
        Q: "1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0|2,4 4,6", R: "0,6 0,0 3,0 4,1 4,2 3,3 0,3|2,3 4,6", S: "4,1 3,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 1,6 0,5",
        T: "0,0 4,0|2,0 2,6", U: "0,0 0,5 1,6 3,6 4,5 4,0", V: "0,0 2,6 4,0", W: "0,0 0,6 2,3 4,6 4,0", X: "0,0 4,6|4,0 0,6", Y: "0,0 2,3 4,0|2,3 2,6", Z: "0,0 4,0 0,6 4,6",
        "0": "1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0|0,5 4,1", "1": "1,1 2,0 2,6|1,6 3,6", "2": "0,1 1,0 3,0 4,1 4,2 0,6 4,6", "3": "0,0 4,0 2,2 4,4 4,5 3,6 1,6 0,5",
        "4": "3,6 3,0 0,4 4,4", "5": "4,0 0,0 0,3 3,3 4,4 4,5 3,6 1,6 0,5", "6": "4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,4 3,3 0,3", "7": "0,0 4,0 1,6",
        "8": "1,0 3,0 4,1 4,2 3,3 1,3 0,2 0,1 1,0|1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3", "9": "4,3 1,3 0,2 0,1 1,0 3,0 4,1 4,5 3,6 1,6 0,5",
        ".": "2,5 2,6", ",": "2,5 2,6 1,7", ":": "2,1 2,2|2,4 2,5", "!": "2,0 2,4|2,5 2,6", "?": "0,1 1,0 3,0 4,1 4,2 2,3 2,4|2,5 2,6", "'": "2,0 2,1",
        "-": "1,3 3,3", "/": "0,6 4,0", "(": "3,0 1,2 1,4 3,6", ")": "1,0 3,2 3,4 1,6", "+": "2,1 2,5|0,3 4,3", "#": "1,0 1,6|3,0 3,6|0,2 4,2|0,4 4,4",
        "*": "2,0 2,6|0,1 4,5|4,1 0,5", "=": "0,2 4,2|0,4 4,4", "<": "4,0 0,3 4,6", ">": "0,0 4,3 0,6", "_": "0,6 4,6", "%": "0,0 1,0 1,1 0,1 0,0|4,6 0,0|3,5 4,5 4,6 3,6 3,5",
        " ": ""
    };
    var GLYPHS = {};
    Object.keys(FONT).forEach(function (ch) {
        GLYPHS[ch] = FONT[ch] ? FONT[ch].split("|").map(function (s) {
            return s.split(" ").map(function (p) { var q = p.split(","); return [+q[0], +q[1]]; });
        }) : [];
    });
    function glyph(ch) { return GLYPHS[ch] || GLYPHS["?"]; }
    // Draw text with the stroke font: x, y the top-left, s the pixel size
    // of one grid unit; dy(i) lifts each letter (the scroller's wave).
    function strokeText(text, x, y, s, dy) {
        ctx.beginPath();
        for (var i = 0; i < text.length; i++) {
            var g = glyph(text.charAt(i)), ox = x + i * 6 * s, oy = y + (dy ? dy(i, ox) : 0);
            if (ox > W + 6 * s) break;
            if (ox < -6 * s) continue;
            for (var k = 0; k < g.length; k++) {
                var st = g[k];
                ctx.moveTo(ox + st[0][0] * s, oy + st[0][1] * s);
                for (var j = 1; j < st.length; j++) ctx.lineTo(ox + st[j][0] * s, oy + st[j][1] * s);
            }
        }
        ctx.stroke();
    }

    // ---- the scene ---------------------------------------------------------
    var clock = 0, lastFrame = 0, running = false, frames = 0;
    var seedRand = mulberry32(tune);

    // The plasma: sums of sines over a small grid, through a palette that
    // the seed chose, drawn dim so the rest can sit on it.
    var PW = 120, PH = 68;
    var plasma = document.createElement("canvas"); plasma.width = PW; plasma.height = PH;
    var pctx = plasma.getContext("2d"), pimg = pctx.createImageData(PW, PH);
    var palette = (function () {
        var a = [0.5, 0.5, 0.5], b = [0.5, 0.5, 0.5], c = [1, 1, 1], d = [seedRand(), seedRand() * 0.5 + 0.1, seedRand() * 0.5 + 0.4];
        var p = new Uint8ClampedArray(256 * 3);
        for (var i = 0; i < 256; i++) for (var k = 0; k < 3; k++) p[i * 3 + k] = 255 * (a[k] + b[k] * Math.cos(6.2832 * (c[k] * i / 256 + d[k])));
        return p;
    }());
    function drawPlasma(t) {
        var data = pimg.data, i = 0;
        var s1 = Math.sin(t * 0.7) * 10, s2 = Math.cos(t * 0.5) * 10;
        for (var y = 0; y < PH; y++) {
            for (var x = 0; x < PW; x++) {
                var v = Math.sin(x / 11 + t) + Math.sin((y + s1) / 7 - t * 0.8) + Math.sin((x + y + s2) / 13) + Math.sin(Math.hypot(x - PW / 2 - s2, y - PH / 2 + s1) / 9 - t);
                var k = ((v + 4) / 8 * 255 + t * 20) & 255;
                data[i++] = palette[k * 3] * 0.36; data[i++] = palette[k * 3 + 1] * 0.36; data[i++] = palette[k * 3 + 2] * 0.36; data[i++] = 255;
            }
        }
        pctx.putImageData(pimg, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(plasma, 0, 0, W, H);
        ctx.imageSmoothingEnabled = false;
    }

    // The stars: flying at you.
    var stars = [];
    for (var si = 0; si < 160; si++) stars.push({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z: Math.random() });
    function drawStars(dt) {
        ctx.fillStyle = "#fff";
        stars.forEach(function (s) {
            s.z -= dt * 0.35;
            if (s.z <= 0.02) { s.x = Math.random() * 2 - 1; s.y = Math.random() * 2 - 1; s.z = 1; }
            var k = 0.5 / s.z, x = W / 2 + s.x * k * W * 0.5, y = H / 2 + s.y * k * H * 0.5;
            if (x < 0 || y < 0 || x >= W || y >= H) return;
            var b = 1 - s.z;
            ctx.globalAlpha = b * b;
            ctx.fillRect(x | 0, y | 0, b > 0.7 ? 2 : 1, b > 0.7 ? 2 : 1);
        });
        ctx.globalAlpha = 1;
    }

    // Copper bars: a few bands of graded colour sliding on sines, behind
    // the logo, as the Amiga's copper did between lines.
    var BARS = [[255, 60, 160], [60, 220, 255], [255, 200, 40], [120, 255, 80], [200, 120, 255]];
    function drawBars(t) {
        BARS.forEach(function (c, i) {
            var y = H / 2 + Math.sin(t * (0.9 + i * 0.13) + i * 1.3) * 70;
            for (var k = -6; k <= 6; k++) {
                var b = 1 - Math.abs(k) / 7;
                ctx.fillStyle = "rgb(" + (c[0] * b | 0) + "," + (c[1] * b | 0) + "," + (c[2] * b | 0) + ")";
                ctx.fillRect(0, (y + k) | 0, W, 1);
            }
        });
    }

    // The logo: RICK, extruded and turning. Each stroke of each glyph is
    // drawn at the front and the back, and the ends joined, so the letters
    // read as solid from any side, which they are not.
    var LOGO = (function () {
        var text = "RICK", s = 11, depth = 14, pts = [], segs = [];
        var width = text.length * 6 * s - 2 * s;
        for (var i = 0; i < text.length; i++) {
            var g = glyph(text.charAt(i)), ox = i * 6 * s - width / 2;
            g.forEach(function (st) {
                var ids = [];
                st.forEach(function (p) {
                    var f = pts.length;
                    pts.push([ox + p[0] * s, (p[1] - 3) * s, -depth / 2], [ox + p[0] * s, (p[1] - 3) * s, depth / 2]);
                    ids.push(f);
                    segs.push([f, f + 1]);                      // the edge between front and back
                });
                for (var j = 1; j < ids.length; j++) { segs.push([ids[j - 1], ids[j]]); segs.push([ids[j - 1] + 1, ids[j] + 1]); }
            });
        }
        return { pts: pts, segs: segs };
    }());
    function drawLogo(t, col) {
        // It swings rather than spins, so it mostly faces you and reads.
        var ay = Math.sin(t * 0.8) * 1.0, ax = Math.sin(t * 0.53) * 0.4, az = Math.sin(t * 0.31) * 0.18;
        var cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax), cz = Math.cos(az), sz = Math.sin(az);
        var f = 260, zoom = 1 + 0.08 * Math.sin(t * 1.7), out = [];
        var oy = H * 0.38 + Math.sin(t * 1.1) * 10;
        for (var i = 0; i < LOGO.pts.length; i++) {
            var p = LOGO.pts[i], x = p[0] * zoom, y = p[1] * zoom, z = p[2] * zoom;
            var x1 = x * cy + z * sy, z1 = -x * sy + z * cy;              // about y
            var y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;             // about x
            var x3 = x1 * cz - y2 * sz, y3 = x1 * sz + y2 * cz;           // about z
            var d = 300 + z2, k = f / d;
            out.push([W / 2 + x3 * k, oy + y3 * k, z2]);
        }
        ctx.strokeStyle = col; ctx.lineJoin = "round";
        ctx.globalAlpha = 0.28; ctx.lineWidth = 5;
        path(out);
        ctx.globalAlpha = 1; ctx.lineWidth = 1.5;
        path(out);
        function path(o) {
            ctx.beginPath();
            LOGO.segs.forEach(function (s) { ctx.moveTo(o[s[0]][0], o[s[0]][1]); ctx.lineTo(o[s[1]][0], o[s[1]][1]); });
            ctx.stroke();
        }
    }

    // The scroller: one long line, on a sine, in the stroke font.
    var GREETS = "   WELCOME TO RICKSEUFERT.COM      CRACKED BY THE MACHINE ELVES IN 2016 ... ORIGINAL SUPPLIED BY RICK ... 100% PLAIN HTML, 0% COOKIES, 1 TRACKER ..." +
        "      PRESS N FOR ANOTHER TUNE, M FOR SILENCE, F FOR THE WHOLE SCREEN ...      GREETINGS FLY OUT TO:   THE DASHBOARD (STILL REFRESHING) ... THE WILLAMETTE AT THE MORRISON BRIDGE ... THE FLIPPER NEST ..." +
        " SENTRY, CIRCLER, RAMMER, SNIPER, DODGER AND BRICK ... RICK, JOSH, DICE AND HERON ... THE BACKROOMS, AND EVERYONE STILL WALKING DOWN THERE ... JULIA, BOTH OF THEM ... RICKBOT, WHO IS FINE ..." +
        " DICK DANK ... KULTURE KUDASAI ... THE SAP VAULT, WHICH IS COLD ... THE EDI CORRIDOR, CHANTING SINCE 1979 ... AND JOSH ALLEN, WHO IS NOT IN THAT PHOTO ..." +
        "      TRAINER OPTIONS:  F1 UNLIMITED COOKIES (THERE ARE NONE)   F2 INFINITE LIVES (BACKROOMS ONLY)   F3 SKIP TO THE BLOG ..." +
        "      THIS IS TUNE #" + tune + ". IT WAS WRITTEN AT MIDNIGHT BY A SEED. TOMORROW'S WILL BE DIFFERENT, AND ALSO NOT VERY GOOD ...      BEST VIEWED AT 800X600 IN NETSCAPE NAVIGATOR ...      WRAPPING ...      ";
    var scrollX = 0;
    function drawScroller(dt, t, col) {
        var s = 4, adv = 6 * s, total = GREETS.length * adv;
        scrollX += dt * (REDUCED ? 40 : 110);
        if (scrollX > total) scrollX -= total;
        var first = Math.floor(scrollX / adv), x0 = -(scrollX % adv) + 8;
        var text = "";
        for (var i = 0; i < Math.ceil(W / adv) + 2; i++) text += GREETS.charAt((first + i) % GREETS.length);
        ctx.strokeStyle = col; ctx.lineJoin = "round";
        var wave = function (i, ox) { return Math.sin(ox * 0.018 + t * 3) * (REDUCED ? 4 : 16); };
        ctx.globalAlpha = 0.3; ctx.lineWidth = 5;
        strokeText(text, x0, H - 52, s, wave);
        ctx.globalAlpha = 1; ctx.lineWidth = 1.5;
        strokeText(text, x0, H - 52, s, wave);
    }

    // The tracker's readout: the row the tune is on, as a tracker showed it.
    var NAMES = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];
    function noteName(n) { return n == null ? "---" : NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1); }
    function drawTracker(col) {
        var rows = song ? song.shown() : null;
        ctx.font = "8px " + MONO; ctx.textBaseline = "top"; ctx.textAlign = "left";
        ctx.fillStyle = col; ctx.globalAlpha = 0.9;
        ctx.fillText("TUNE #" + tune + "  " + (song ? song.bpm + " BPM  " + song.key : "SILENT"), 8, 8);
        if (!rows) { ctx.globalAlpha = 1; return; }
        ctx.textAlign = "right";
        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            ctx.globalAlpha = i === rows.length - 1 ? 1 : 0.45;
            ctx.fillText((r.row < 10 ? "0" : "") + r.row + " " + noteName(r.lead) + " " + noteName(r.bass) + " " + noteName(r.arp) + " " + r.drum, W - 8, 8 + i * 10);
        }
        ctx.globalAlpha = 1;
    }

    function hue(t) { return "hsl(" + ((t * 40) % 360).toFixed(0) + ", 100%, 70%)"; }
    function frame(now) {
        if (running) requestAnimationFrame(frame);
        var dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000 || 0));
        lastFrame = now;
        clock += dt; frames++;
        var t = clock;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
        drawPlasma(t * (REDUCED ? 0.3 : 1));
        drawStars(REDUCED ? dt * 0.3 : dt);
        drawBars(REDUCED ? t * 0.3 : t);
        drawLogo(REDUCED ? t * 0.3 : t, hue(t + 3));
        ctx.font = "8px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.8;
        ctx.fillText("S E U F E R T . C O M", W / 2, H * 0.38 + 58);
        ctx.globalAlpha = 1;
        drawScroller(dt, t, hue(t));
        drawTracker(hue(t + 6));
    }

    // ---- the tune ----------------------------------------------------------
    // A song from a seed: a key, a scale, a progression, a tempo, two
    // melodies and a bass figure, all drawn by the seeded random, so the
    // date's tune is the same for everyone all day. Rows are sixteenths.
    var SCALES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], harmonic: [0, 2, 3, 5, 7, 8, 11], phrygian: [0, 1, 3, 5, 7, 8, 10] };
    var PROGS = [[0, 5, 2, 6], [0, 6, 5, 6], [0, 3, 5, 4], [0, 2, 6, 3], [0, 4, 5, 3], [0, 5, 3, 4], [0, 0, 5, 6]];
    var KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    function compose(seed) {
        var rand = mulberry32(seed ^ 0x5EED), pick = function (a) { return a[Math.floor(rand() * a.length)]; };
        var scaleName = pick(Object.keys(SCALES)), scale = SCALES[scaleName];
        var root = Math.floor(rand() * 12), prog = pick(PROGS), bpm = 125 + Math.floor(rand() * 30);
        var base = 48 + root;                                   // the tonic, a MIDI note near C3
        function degree(d, oct) { return base + 12 * (oct + Math.floor(d / 7)) + scale[((d % 7) + 7) % 7]; }
        function chord(d) { return [degree(d, 0), degree(d + 2, 0), degree(d + 4, 0)]; }
        // A melody: 64 rows, a walk over the scale with a rhythm of ones, twos and fours.
        function melody(bars) {
            var rows = [], d = 7 + Math.floor(rand() * 5), i = 0;
            while (i < bars * 16) {
                var len = pick([1, 1, 2, 2, 2, 4]), rest = rand() < 0.18;
                if (i % 16 === 0 && rand() < 0.6) d = 7 + prog[(i / 16) % prog.length] + pick([0, 2, 4]);   // land on a chord tone
                else d += pick([-2, -1, -1, 0, 1, 1, 2, 3, -3]);
                if (d < 4) d += 4; if (d > 15) d -= 4;
                rows.push(rest ? null : degree(d, 0));
                for (var k = 1; k < len && i + k < bars * 16; k++) rows.push(undefined);   // held
                i += len;
            }
            return rows.slice(0, bars * 16);
        }
        var bassFig = pick([[0, 3, 6, 8, 11, 14], [0, 2, 4, 6, 8, 10, 12, 14], [0, 6, 8, 14], [0, 4, 8, 12, 15], [0, 3, 6, 10, 12]]);
        var kicks = pick([[0, 8], [0, 6, 8], [0, 8, 10], [0, 4, 8, 12], [0, 7, 8]]), snares = [4, 12], hats = rand() < 0.5 ? 2 : 1;
        var arpRate = pick([2, 3, 3]);
        return {
            bpm: bpm, key: KEYS[root] + " " + scaleName, prog: prog, chord: chord, root: root,
            melodies: [melody(4), melody(4)], bassFig: bassFig, kicks: kicks, snares: snares, hats: hats, arpRate: arpRate,
            order: [0, 0, 1, 0, 1, 1, 0, 1]
        };
    }

    var song = null, audio = null;
    function makeAudio() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        var ac = new AC(), master = ac.createGain();
        master.gain.value = 0.33;
        var comp = ac.createDynamicsCompressor();
        comp.threshold.value = -18; comp.ratio.value = 4;
        master.connect(comp); comp.connect(ac.destination);
        var noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), data = noise.getChannelData(0);
        for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        function hz(n) { return 440 * Math.pow(2, (n - 69) / 12); }
        function tone(type, note, at, len, gain, slide) {
            var o = ac.createOscillator(), g = ac.createGain();
            o.type = type; o.frequency.setValueAtTime(hz(note), at);
            if (slide) o.frequency.exponentialRampToValueAtTime(hz(note + slide), at + len);
            g.gain.setValueAtTime(0.0001, at);
            g.gain.exponentialRampToValueAtTime(gain, at + 0.006);
            g.gain.exponentialRampToValueAtTime(gain * 0.6, at + Math.min(len * 0.5, 0.08));
            g.gain.setValueAtTime(gain * 0.6, at + len - 0.01);
            g.gain.exponentialRampToValueAtTime(0.0001, at + len + 0.02);
            o.connect(g); g.connect(master); o.start(at); o.stop(at + len + 0.03);
        }
        function burst(at, len, gain, freq, type) {
            var s = ac.createBufferSource(), g = ac.createGain(), fl = ac.createBiquadFilter();
            s.buffer = noise; fl.type = type; fl.frequency.value = freq;
            g.gain.setValueAtTime(gain, at); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
            s.connect(fl); fl.connect(g); g.connect(master); s.start(at); s.stop(at + len);
        }
        function kick(at) {
            var o = ac.createOscillator(), g = ac.createGain();
            o.frequency.setValueAtTime(160, at); o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
            g.gain.setValueAtTime(0.9, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
            o.connect(g); g.connect(master); o.start(at); o.stop(at + 0.17);
        }
        return {
            ac: ac, master: master, tone: tone, burst: burst, kick: kick,
            quiet: function (q) {
                if (ac.state === "suspended") ac.resume();
                master.gain.cancelScheduledValues(ac.currentTime);
                master.gain.linearRampToValueAtTime(q ? 0 : 0.33, ac.currentTime + 0.3);
            }
        };
    }
    // The player: schedules a row at a time a little ahead of the clock,
    // and keeps what it scheduled so the screen can show the row playing.
    function play(seed) {
        var s = compose(seed), rowLen = 60 / s.bpm / 4, row = 0, next = audio.ac.currentTime + 0.1, timer = null, done = [];
        function schedule(r, at) {
            var bar = Math.floor(r / 16), patt = s.order[Math.floor(bar / 4) % s.order.length], mel = s.melodies[patt];
            var ch = s.chord(s.prog[bar % s.prog.length]), inRow = r % 16, inPatt = r % 64;
            var shown = { row: inRow, lead: null, bass: null, arp: null, drum: "..." };
            var lead = mel[inPatt];
            if (lead !== undefined) {
                if (lead !== null) {
                    var len = 1; while (inPatt + len < 64 && mel[inPatt + len] === undefined) len++;
                    audio.tone("square", lead, at, rowLen * len * 0.9, 0.09);
                    audio.tone("square", lead + 0.08, at, rowLen * len * 0.9, 0.05);     // a second voice, a little sharp
                    shown.lead = lead;
                }
            }
            if (s.bassFig.indexOf(inRow) >= 0) {
                var bn = ch[0] - 24 + (inRow % 8 === 6 && bar % 2 ? 12 : 0);
                audio.tone("triangle", bn, at, rowLen * 1.6, 0.26);
                shown.bass = bn;
            }
            for (var k = 0; k < s.arpRate; k++) {                         // the chord, one note at a time, quickly
                var an = ch[(r * s.arpRate + k) % 3] + 12;
                audio.tone("square", an, at + k * rowLen / s.arpRate, rowLen / s.arpRate * 0.95, 0.035);
                if (!k) shown.arp = an;
            }
            var d = "";
            if (s.kicks.indexOf(inRow) >= 0 || (bar % 4 === 3 && inRow === 14)) { audio.kick(at); d += "K"; }
            if (s.snares.indexOf(inRow) >= 0) { audio.burst(at, 0.13, 0.5, 1800, "bandpass"); d += "S"; }
            if (inRow % s.hats === 0) { audio.burst(at, inRow % 4 === 2 ? 0.07 : 0.03, inRow % 4 === 2 ? 0.2 : 0.12, 7000, "highpass"); d += "h"; }
            shown.drum = (d + "...").slice(0, 3);
            done.push({ at: at, shown: shown });
            if (done.length > 40) done.splice(0, done.length - 40);
        }
        function tick() {
            while (next < audio.ac.currentTime + 0.15) { schedule(row, next); next += rowLen; row++; }
        }
        timer = setInterval(tick, 30);
        tick();
        return {
            bpm: s.bpm, key: s.key,
            shown: function () {
                var now = audio.ac.currentTime, i = done.length - 1;
                while (i > 0 && done[i].at > now) i--;
                var out = [];
                for (var k = i - 8; k <= i; k++) out.push(done[k] ? done[k].shown : { row: 0, lead: null, bass: null, arp: null, drum: "..." });
                return out;
            },
            stop: function () { clearInterval(timer); }
        };
    }

    // ---- controls ----------------------------------------------------------
    var soundOn = true;
    try { soundOn = localStorage.getItem("intro-sound") !== "0"; } catch (e) { /* on */ }
    function begin() {
        veil.hidden = true;
        if (!running) { running = true; lastFrame = performance.now(); requestAnimationFrame(frame); }
        if (soundOn && !audio) audio = makeAudio();
        if (audio && !song) song = play(tune);
        if (audio) audio.quiet(!soundOn);
    }
    function retune(n) {
        tune = n % 100000000;
        seedRand = mulberry32(tune);
        if (song) { song.stop(); song = audio ? play(tune) : null; }
        GREETS = GREETS.replace(/TUNE #\d+/, "TUNE #" + tune);
        if (tuneOut) tuneOut.textContent = "tune #" + tune + (tune === today() ? " (today's)" : "");
        try { history.replaceState(null, "", tune === today() ? location.pathname : "#tune=" + tune); } catch (e) { /* no history */ }
    }
    function setSound(on) {
        soundOn = on;
        try { localStorage.setItem("intro-sound", on ? "1" : "0"); } catch (e) { /* a visit's worth */ }
        soundButton.setAttribute("aria-pressed", on ? "true" : "false");
        if (on && running && !audio) { audio = makeAudio(); if (audio) song = play(tune); }
        if (audio) audio.quiet(!on);
    }
    go.addEventListener("click", begin);
    soundButton.addEventListener("click", function () { setSound(!soundOn); });
    soundButton.setAttribute("aria-pressed", soundOn ? "true" : "false");
    nextButton.addEventListener("click", function () { retune(1 + Math.floor(Math.random() * 99999999)); });
    fullButton.addEventListener("click", function () {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (stage.requestFullscreen) stage.requestFullscreen();
    });
    addEventListener("keydown", function (e) {
        if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
        if (!running) { if (e.code === "Space" || e.code === "Enter") { begin(); e.preventDefault(); } return; }
        if (e.code === "KeyM") setSound(!soundOn);
        if (e.code === "KeyN") retune(1 + Math.floor(Math.random() * 99999999));
        if (e.code === "KeyF") fullButton.click();
    });
    document.addEventListener("visibilitychange", function () { if (audio) audio.quiet(document.hidden || !soundOn); });
    if (tuneOut) tuneOut.textContent = "tune #" + tune + (tune === today() ? " (today's)" : "");

    // A still, so the stage is not black before the first click.
    frame(0);
    window.Intro = {
        frame: function (ms) { frame(lastFrame + ms); },
        size: function (w, h) { W = canvas.width = w; H = canvas.height = h; },
        compose: compose, tune: function () { return tune; }, song: function () { return song; }
    };
})();
