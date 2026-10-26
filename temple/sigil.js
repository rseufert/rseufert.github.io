/* temple/sigil.js: the sigil press.
   Austin Osman Spare's method, 1913, done by machine: write the wish, strike
   the vowels and every letter that repeats, bind what is left into one
   shape, charge it, destroy it, forget it. The letters are drawn from stroke
   skeletons and composed by a rule seeded from the wish itself, so a wish
   always gives the same sigil. Hold the sigil to charge it; when the charge
   is full it burns off the canvas. Nothing is stored and nothing is sent:
   no cookie, no localStorage, no request. One script, no library. */
(function () {
    "use strict";
    var canvas = document.getElementById("sigil-stage");
    if (!canvas) return;
    var ctx = canvas.getContext("2d"), stage = canvas.parentNode;
    var form = document.getElementById("sigil-form"), wishIn = document.getElementById("sigil-wish");
    var lettersOut = document.getElementById("sigil-letters"), hint = document.getElementById("sigil-hint"), soundBtn = document.getElementById("sigil-sound");
    var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var TOUCH = window.matchMedia && matchMedia("(hover: none) and (pointer: coarse)").matches;
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace';
    var INK = "#7cf5c8", DIM = "#2a5a4a", PAPER = "#020705", DPR = Math.min(2, window.devicePixelRatio || 1);
    var W = 0, H = 0;
    function resize() { var r = stage.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); }

    // ---- the letters, as strokes in a box from -1 to 1, y down -------------------
    function arcPts(cx, cy, r, a0, a1) {
        var pts = [], n = Math.max(6, Math.round(Math.abs(a1 - a0) / 15));
        for (var i = 0; i <= n; i++) { var a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
        return pts;
    }
    var GLYPH = {
        A: [[[-1, 1], [0, -1], [1, 1]], [[-0.5, 0.2], [0.5, 0.2]]],
        B: [[[-0.7, -1], [-0.7, 1]], arcPts(-0.7, -0.5, 0.5, -90, 90), arcPts(-0.7, 0.5, 0.5, -90, 90)],
        C: [arcPts(0, 0, 1, 40, 320)],
        D: [[[-0.7, -1], [-0.7, 1]], arcPts(-0.7, 0, 1, -90, 90)],
        E: [[[0.8, -1], [-0.8, -1], [-0.8, 1], [0.8, 1]], [[-0.8, 0], [0.5, 0]]],
        F: [[[0.8, -1], [-0.8, -1], [-0.8, 1]], [[-0.8, 0], [0.5, 0]]],
        G: [arcPts(0, 0, 1, 40, 360), [[1, 0], [0.1, 0]]],
        H: [[[-0.8, -1], [-0.8, 1]], [[0.8, -1], [0.8, 1]], [[-0.8, 0], [0.8, 0]]],
        I: [[[0, -1], [0, 1]]],
        J: [[[0.5, -1], [0.5, 0.4]], arcPts(0, 0.4, 0.5, 0, 180)],
        K: [[[-0.8, -1], [-0.8, 1]], [[0.8, -1], [-0.8, 0.1]], [[-0.3, -0.3], [0.8, 1]]],
        L: [[[-0.8, -1], [-0.8, 1], [0.8, 1]]],
        M: [[[-1, 1], [-1, -1], [0, 0.2], [1, -1], [1, 1]]],
        N: [[[-0.8, 1], [-0.8, -1], [0.8, 1], [0.8, -1]]],
        O: [arcPts(0, 0, 1, 0, 360)],
        P: [[[-0.7, 1], [-0.7, -1]], arcPts(-0.7, -0.5, 0.5, -90, 90)],
        Q: [arcPts(0, 0, 1, 0, 360), [[0.4, 0.4], [1.1, 1.1]]],
        R: [[[-0.7, 1], [-0.7, -1]], arcPts(-0.7, -0.5, 0.5, -90, 90), [[-0.4, 0], [0.8, 1]]],
        S: [arcPts(0, -0.5, 0.5, -30, -270), arcPts(0, 0.5, 0.5, -90, 150)],
        T: [[[-0.9, -1], [0.9, -1]], [[0, -1], [0, 1]]],
        U: [[[-0.8, -1], [-0.8, 0.3]], arcPts(0, 0.3, 0.8, 180, 0), [[0.8, 0.3], [0.8, -1]]],
        V: [[[-1, -1], [0, 1], [1, -1]]],
        W: [[[-1, -1], [-0.5, 1], [0, -0.2], [0.5, 1], [1, -1]]],
        X: [[[-1, -1], [1, 1]], [[1, -1], [-1, 1]]],
        Y: [[[-1, -1], [0, 0], [1, -1]], [[0, 0], [0, 1]]],
        Z: [[[-0.9, -1], [0.9, -1], [-0.9, 1], [0.9, 1]]]
    };

    // ---- the wish, reduced; the sigil, composed ----------------------------------
    function reduce(wish) {
        var seen = {}, out = [];
        wish.toUpperCase().replace(/[^A-Z]/g, "").split("").forEach(function (c) { if (!seen[c]) { seen[c] = 1; out.push(c); } });
        var cons = out.filter(function (c) { return !/[AEIOU]/.test(c); });
        return cons.length ? cons : out;                      // a wish of nothing but vowels keeps them
    }
    function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function compose(letters, wish) {
        // Each letter turned to one of the eight directions (a little off), scaled,
        // flipped sometimes, and set a little off the centre, so the strokes cross
        // and share lines; then the binding: a ring round a long wish, a bar under a short one.
        var r = mulberry32(hash(wish.toUpperCase().replace(/[^A-Z]/g, ""))), strokes = [];
        letters.forEach(function (c) {
            var g = GLYPH[c]; if (!g) return;
            var rot = Math.floor(r() * 8) * Math.PI / 4 + (r() - 0.5) * 0.25, s = 0.5 + r() * 0.4, dx = (r() - 0.5) * 0.5, dy = (r() - 0.5) * 0.5, flip = r() < 0.4 ? -1 : 1;
            var cs = Math.cos(rot), sn = Math.sin(rot);
            g.forEach(function (poly) { strokes.push(poly.map(function (p) { var x = p[0] * flip * s, y = p[1] * s; return [cs * x - sn * y + dx, sn * x + cs * y + dy]; })); });
        });
        if (letters.length >= 4) strokes.push(arcPts(0, 0, 1.18, 0, 360));
        else strokes.push([[-1.1, 1.0], [1.1, 1.0]]);
        return strokes;
    }

    // ---- state ---------------------------------------------------------------------
    var sigil = null, charge = 0, charging = false, burn = -1, ash = [], said = "", lastFrame = 0;
    function make(wish) {
        var letters = reduce(wish);
        if (!letters.length) { hint.textContent = "a wish needs letters."; return; }
        sigil = compose(letters, wish); charge = 0; burn = -1; ash = []; said = "";
        lettersOut.textContent = letters.join(" ");
        hint.textContent = (TOUCH ? "hold the sigil to charge it" : "hold the mouse on the sigil, or the space bar, to charge it") + ". when it goes white it burns, and that is the end of it. then forget the wish.";
        if (TOUCH) wishIn.blur();
        stage.scrollIntoView({ block: "nearest" });
    }
    function burnt() {
        sigil = null; ash = []; charge = 0; burn = -1;
        said = "it is done. forget it.";
        wishIn.value = ""; lettersOut.textContent = "";
        hint.textContent = "nothing was kept. write another, or go.";
        if (audio) audio.set(0);
    }
    function ignite() {
        burn = 0; ash = [];
        var s = Math.min(W, H) * 0.34;
        sigil.forEach(function (poly) {
            poly.forEach(function (p, i) {
                if (i % 2) return;
                var a = Math.atan2(p[1], p[0]) + (Math.random() - 0.5), v = 20 + Math.random() * 60;
                ash.push({ x: p[0] * s, y: p[1] * s, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30 - Math.random() * 40, life: 0.6 + Math.random() * 0.9 });
            });
        });
        if (audio && soundOn) audio.snap();
    }

    // ---- drawing -------------------------------------------------------------------
    function draw(dt) {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(W / 2, H / 2);
        var s = Math.min(W, H) * 0.34;
        if (!sigil) {
            ctx.fillStyle = DIM; ctx.font = "14px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(said || "the press is empty.", 0, 0);
            ctx.restore(); return;
        }
        var k = charge, b = burn;
        var col = b >= 0 ? "rgba(255,255,255," + (1 - b) + ")" : INK;
        var glow = b >= 0 ? 40 * (1 - b) : 6 + k * 34, width = b >= 0 ? 2.6 : 1.6 + k * 2.2;
        var jitter = REDUCED || b >= 0 ? 0 : k * k * 3;
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.shadowColor = b >= 0 ? "#ffffff" : INK; ctx.shadowBlur = glow;
        sigil.forEach(function (poly) {
            ctx.beginPath();
            poly.forEach(function (p, i) { var x = p[0] * s + (Math.random() - 0.5) * jitter, y = p[1] * s + (Math.random() - 0.5) * jitter; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
            ctx.stroke();
        });
        ctx.beginPath(); ctx.arc(0, 0, 2.2 + k * 2, 0, Math.PI * 2); ctx.fill();
        if (b < 0 && k > 0) {
            // the charge, as a ring filling clockwise from the top
            ctx.save(); ctx.globalAlpha = 0.35 + k * 0.5; ctx.lineWidth = 1.2; ctx.shadowBlur = 0;
            ctx.beginPath(); ctx.arc(0, 0, s * 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke(); ctx.restore();
        }
        if (b >= 0) {
            ctx.shadowBlur = 0;
            ash.forEach(function (p) {
                if (p.life <= 0) return;
                p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt; p.life -= dt;
                ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
                ctx.fillStyle = p.life > 0.5 ? "#ffffff" : INK;
                ctx.fillRect(p.x, p.y, 1.5, 1.5);
            });
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }
    function frame(now) {
        requestAnimationFrame(frame);
        var dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000 || 0)); lastFrame = now;
        if (sigil && burn < 0) {
            if (charging) charge = Math.min(1, charge + dt / (REDUCED ? 2 : 4));
            else charge = Math.max(0, charge - dt / 2);
            if (audio && soundOn) audio.set(charge);
            if (charge >= 1) ignite();
        } else if (burn >= 0) {
            burn += dt / 1.6;
            if (burn >= 1) burnt();
        }
        draw(dt);
    }

    // ---- hands ---------------------------------------------------------------------
    form.addEventListener("submit", function (e) { e.preventDefault(); make(wishIn.value); });
    canvas.addEventListener("pointerdown", function (e) { if (!sigil || burn >= 0) return; charging = true; try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* a fake pointer */ } e.preventDefault(); if (audio) audio.wake(); });
    function release() { charging = false; }
    canvas.addEventListener("pointerup", release); canvas.addEventListener("pointercancel", release); canvas.addEventListener("lostpointercapture", release);
    addEventListener("keydown", function (e) { if (e.code === "Space" && e.target !== wishIn && sigil && burn < 0) { charging = true; e.preventDefault(); if (audio) audio.wake(); } });
    addEventListener("keyup", function (e) { if (e.code === "Space") charging = false; });
    addEventListener("blur", release);

    // ---- a tone, rising with the charge, behind a button; off unless asked --------
    var audio = null, soundOn = false;
    function makeAudio() {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
        var ac = new AC(); if (window.Unmute) window.Unmute(ac);
        var o = ac.createOscillator(), g = ac.createGain(), o2 = ac.createOscillator(), g2 = ac.createGain();
        o.type = "sine"; o.frequency.value = TOUCH ? 330 : 110; g.gain.value = 0; o.connect(g); g.connect(ac.destination); o.start();
        o2.type = "triangle"; o2.frequency.value = (TOUCH ? 330 : 110) * 1.5; g2.gain.value = 0; o2.connect(g2); g2.connect(ac.destination); o2.start();
        return {
            wake: function () { if (ac.state === "suspended") ac.resume(); },
            set: function (k) {
                var base = TOUCH ? 330 : 110, f = base * Math.pow(2, k * 2);
                o.frequency.setTargetAtTime(f, ac.currentTime, 0.05); o2.frequency.setTargetAtTime(f * 1.5, ac.currentTime, 0.05);
                g.gain.setTargetAtTime(k * (TOUCH ? 0.3 : 0.18), ac.currentTime, 0.05); g2.gain.setTargetAtTime(k * k * (TOUCH ? 0.12 : 0.06), ac.currentTime, 0.05);
            },
            snap: function () {
                var n = ac.createBufferSource(), buf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate), d = buf.getChannelData(0);
                for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2);
                var ng = ac.createGain(); ng.gain.value = TOUCH ? 0.5 : 0.3; n.buffer = buf; n.connect(ng); ng.connect(ac.destination); n.start();
                g.gain.setTargetAtTime(0, ac.currentTime, 0.02); g2.gain.setTargetAtTime(0, ac.currentTime, 0.02);
            }
        };
    }
    if (soundBtn) soundBtn.addEventListener("click", function () {
        soundOn = !soundOn;
        if (soundOn && !audio) audio = makeAudio();
        if (audio) { if (soundOn) audio.wake(); else audio.set(0); }
        soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    });

    addEventListener("resize", resize);
    resize();
    requestAnimationFrame(frame);
    window.Sigil = { reduce: reduce, compose: compose, make: make, state: function () { return { sigil: sigil, charge: charge, burn: burn, said: said }; } };
})();
