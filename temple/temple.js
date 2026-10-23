/* temple/temple.js: the nave of the temple.
   A ring of sixteen signs round a seventeenth, the Monad, drawn as line art
   on a canvas and turning, slowly, the way the heavens were said to. Point
   at one, or tap it, or walk round with the arrow keys, and it comes to the
   middle with what it means beside it. The signs and their explanations are
   the page's own list (the <dl> under the canvas), read from the DOM, so
   the text is in one place and the page says the same thing without
   scripts. Beneath the ring, faintly, is the floor: the Ophite diagram as
   Origen described it, the only gnostic chart that survives, in words.
   One script, no library. */
(function () {
    "use strict";
    var canvas = document.getElementById("temple-stage");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var stage = document.getElementById("temple-room");
    var nameOut = document.getElementById("temple-name"), textOut = document.getElementById("temple-text"), shelfOut = document.getElementById("temple-shelf");
    var soundBtn = document.getElementById("temple-sound"), fullBtn = document.getElementById("temple-full"), unfillBtn = document.getElementById("temple-unfill");
    var SERIF = 'Georgia, "Times New Roman", serif';
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace';
    var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var TOUCH = window.matchMedia && matchMedia("(hover: none) and (pointer: coarse)").matches;
    var INK = "#7cf5c8", DIM = "#2a5a4a", FAINT = "#163a2e";

    // ---- the signs, from the page ---------------------------------------------
    var SIGNS = [];
    (function () {
        var dl = document.getElementById("temple-signs");
        if (!dl) return;
        var dts = dl.querySelectorAll("dt");
        for (var i = 0; i < dts.length; i++) {
            var dt = dts[i], dd = dt.nextElementSibling;
            SIGNS.push({ id: dt.id.replace(/^sign-/, ""), name: dt.textContent, html: dd ? dd.innerHTML : "", shelf: dt.getAttribute("data-shelf") || "" });
        }
    })();
    var RING = SIGNS.length - 1;     // the Monad is first and stands in the middle

    // ---- the drawings --------------------------------------------------------
    // Each draws one sign in a box of half-size s about the origin, upright,
    // in the current stroke. t is the clock, for the little that moves.
    function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
    function dot(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    function line(pts, closed) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); if (closed) ctx.closePath(); ctx.stroke(); }
    function arc(x, y, r, a0, a1) { ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke(); }
    function glyph(text, x, y, size, font) { ctx.font = size + "px " + (font || SERIF); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y); }
    var DRAW = {
        monad: function (s) { circle(0, 0, s * 0.9); dot(0, 0, s * 0.09); },
        ouroboros: function (s, t) {
            var r = s * 0.82, w = s * 0.13, a0 = -Math.PI / 2 + 0.55, a1 = a0 + Math.PI * 2 - 0.75;
            arc(0, 0, r - w, a0, a1); arc(0, 0, r + w, a0, a1);
            // scales: ticks across the body, crawling along it
            var step = 0.22, off = REDUCED ? 0 : (t * 0.15) % step;
            for (var a = a0 + off; a < a1 - 0.1; a += step) {
                var c = Math.cos(a), sn = Math.sin(a);
                line([[c * (r - w), sn * (r - w)], [Math.cos(a + 0.09) * r, Math.sin(a + 0.09) * r], [c * (r + w), sn * (r + w)]]);
            }
            // the head, at the end of the body, biting the tail
            var hx = Math.cos(a1) * r, hy = Math.sin(a1) * r, tx = -Math.sin(a1), ty = Math.cos(a1);
            line([[hx - tx * w * 0.2 + Math.cos(a1) * w * 1.2, hy - ty * w * 0.2 + Math.sin(a1) * w * 1.2], [hx + tx * w * 2.6, hy + ty * w * 2.6], [hx - Math.cos(a1) * w * 1.2, hy - Math.sin(a1) * w * 1.2]], true);
            dot(hx + tx * w * 0.9 + Math.cos(a1) * w * 0.4, hy + ty * w * 0.9 + Math.sin(a1) * w * 0.4, w * 0.22);
            // the tail, thinning into the mouth
            line([[Math.cos(a0) * r, Math.sin(a0) * r], [Math.cos(a0 - 0.5) * r * 0.98, Math.sin(a0 - 0.5) * r * 0.98]]);
            ctx.save(); ctx.font = (s * 0.26) + "px " + SERIF; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("ἓν τὸ πᾶν", 0, 0); ctx.restore();
        },
        abraxas: function (s) {
            // the cock's head
            circle(0, -s * 0.62, s * 0.17);
            line([[s * 0.15, -s * 0.64], [s * 0.36, -s * 0.58], [s * 0.15, -s * 0.54]], true);                   // beak
            line([[-s * 0.1, -s * 0.78], [-s * 0.04, -s * 0.94], [s * 0.02, -s * 0.78], [s * 0.08, -s * 0.94], [s * 0.12, -s * 0.78]]);   // comb
            line([[s * 0.1, -s * 0.47], [s * 0.1, -s * 0.36]]);                                               // wattle
            dot(s * 0.05, -s * 0.65, s * 0.025);
            // the body in armour
            line([[-s * 0.22, -s * 0.42], [s * 0.22, -s * 0.42], [s * 0.26, s * 0.05], [-s * 0.26, s * 0.05]], true);
            line([[-s * 0.2, -s * 0.26], [s * 0.2, -s * 0.26]]); line([[-s * 0.22, -s * 0.1], [s * 0.22, -s * 0.1]]);
            // the shield, on the left arm, and the whip in the right hand
            line([[-s * 0.22, -s * 0.36], [-s * 0.5, -s * 0.2]]); circle(-s * 0.58, -s * 0.12, s * 0.2); dot(-s * 0.58, -s * 0.12, s * 0.03);
            line([[s * 0.22, -s * 0.36], [s * 0.5, -s * 0.5]]);
            line([[s * 0.5, -s * 0.5], [s * 0.62, -s * 0.72], [s * 0.56, -s * 0.84], [s * 0.72, -s * 0.96]]);
            // the serpent legs
            line([[-s * 0.14, s * 0.05], [-s * 0.28, s * 0.3], [-s * 0.12, s * 0.5], [-s * 0.34, s * 0.7], [-s * 0.2, s * 0.9]]);
            line([[-s * 0.2, s * 0.9], [-s * 0.34, s * 0.96], [-s * 0.24, s * 0.82]], true);
            line([[s * 0.14, s * 0.05], [s * 0.28, s * 0.3], [s * 0.12, s * 0.5], [s * 0.34, s * 0.7], [s * 0.2, s * 0.9]]);
            line([[s * 0.2, s * 0.9], [s * 0.34, s * 0.96], [s * 0.24, s * 0.82]], true);
        },
        iao: function (s) {
            glyph("ΙΑΩ", 0, s * 0.02, s * 0.9);
            var V = ["Α", "Ε", "Η", "Ι", "Ο", "Υ", "Ω"];
            for (var i = 0; i < 7; i++) { var a = -Math.PI / 2 + i / 7 * Math.PI * 2; glyph(V[i], Math.cos(a) * s * 0.8, Math.sin(a) * s * 0.8, s * 0.26); }
            ctx.save(); ctx.setLineDash([s * 0.04, s * 0.08]); circle(0, 0, s * 0.8); ctx.restore();
        },
        chnoubis: function (s, t) {
            // the body, an S from the foot to the head
            ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.9); ctx.bezierCurveTo(s * 0.6, s * 0.7, -s * 0.7, s * 0.1, s * 0.1, -s * 0.3); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-s * 0.5, s * 0.9); ctx.bezierCurveTo(s * 0.5, s * 0.55, -s * 0.55, s * 0.05, s * 0.0, -s * 0.36); ctx.stroke();
            // the lion's head, and seven rays
            circle(s * 0.05, -s * 0.5, s * 0.2);
            line([[-s * 0.05, -s * 0.46], [s * 0.05, -s * 0.52], [s * 0.15, -s * 0.46]]);
            dot(-s * 0.03, -s * 0.56, s * 0.025); dot(s * 0.12, -s * 0.56, s * 0.025);
            for (var i = 0; i < 7; i++) {
                var a = Math.PI + (i + 0.5) / 7 * Math.PI, f = REDUCED ? 1 : 0.85 + 0.15 * Math.sin(t * 2 + i);
                line([[s * 0.05 + Math.cos(a) * s * 0.26, -s * 0.5 + Math.sin(a) * s * 0.26], [s * 0.05 + Math.cos(a) * s * 0.5 * f, -s * 0.5 + Math.sin(a) * s * 0.5 * f]]);
            }
            // the sign: three S's with a bar through them
            for (var k = -1; k <= 1; k++) {
                ctx.beginPath(); ctx.moveTo(s * 0.5 + k * s * 0.17 + s * 0.05, s * 0.45); ctx.bezierCurveTo(s * 0.5 + k * s * 0.17 - s * 0.1, s * 0.5, s * 0.5 + k * s * 0.17 + s * 0.1, s * 0.6, s * 0.5 + k * s * 0.17 - s * 0.05, s * 0.65); ctx.stroke();
            }
            line([[s * 0.2, s * 0.55], [s * 0.82, s * 0.55]]);
        },
        ophite: function (s) {
            ctx.save(); ctx.setLineDash([s * 0.06, s * 0.05]); circle(0, 0, s * 0.95); ctx.restore();
            line([[s * 0.0, -s * 0.95], [s * 0.1, -s * 1.02], [s * 0.02, -s * 0.86]], true);          // Leviathan's head
            for (var i = 0; i < 7; i++) { var a = -Math.PI / 2 + i / 7 * Math.PI * 2; circle(Math.cos(a) * s * 0.64, Math.sin(a) * s * 0.64, s * 0.16); }
            circle(0, 0, s * 0.36);
            circle(-s * 0.11, 0, s * 0.16); circle(s * 0.11, 0, s * 0.16);
        },
        pleroma: function (s) {
            dot(0, 0, s * 0.05);
            var rings = [[8, 0.3], [10, 0.58], [12, 0.88]], n = 0;
            rings.forEach(function (rg) {
                var k = rg[0], r = s * rg[1];
                for (var i = 0; i < k; i++) {
                    var a = -Math.PI / 2 + i / k * Math.PI * 2, rr = r;
                    n++;
                    if (n === 30) rr = r * 1.12;                                     // Sophia, leaning out
                    dot(Math.cos(a) * rr, Math.sin(a) * rr, s * 0.035);
                    if (i % 2 === 0) { var b = -Math.PI / 2 + (i + 1) / k * Math.PI * 2; line([[Math.cos(a) * rr, Math.sin(a) * rr], [Math.cos(b) * r, Math.sin(b) * r]]); }
                }
            });
        },
        horos: function (s) {
            circle(0, 0, s * 0.68);
            line([[0, -s * 0.95], [0, s * 0.95]]); line([[-s * 0.95, 0], [s * 0.95, 0]]);
            ctx.save(); ctx.setLineDash([s * 0.03, s * 0.07]); line([[s * 0.48, s * 0.48], [s * 0.82, s * 0.82]]); ctx.restore();
            dot(s * 0.86, s * 0.86, s * 0.05);
        },
        vesica: function (s) {
            var r = s * 0.62, d = s * 0.31;
            circle(-d, 0, r); circle(d, 0, r);
            for (var x = -d + s * 0.06; x < d; x += s * 0.07) {
                var y1 = Math.sqrt(Math.max(0, r * r - (x + d) * (x + d))), y2 = Math.sqrt(Math.max(0, r * r - (x - d) * (x - d))), y = Math.min(y1, y2);
                line([[x, -y], [x, y]]);
            }
        },
        tetraktys: function (s) {
            for (var row = 0; row < 4; row++) for (var i = 0; i <= row; i++) dot((i - row / 2) * s * 0.44, -s * 0.6 + row * s * 0.4, s * 0.07);
            ctx.save(); ctx.globalAlpha *= 0.4; line([[0, -s * 0.78], [s * 0.86, s * 0.74], [-s * 0.86, s * 0.74]], true); ctx.restore();
        },
        hexagram: function (s) {
            var r = s * 0.88;
            line([[0, -r], [r * 0.866, r * 0.5], [-r * 0.866, r * 0.5]], true);
            ctx.save(); ctx.setLineDash([s * 0.08, s * 0.06]); line([[0, r], [r * 0.866, -r * 0.5], [-r * 0.866, -r * 0.5]], true); ctx.restore();
            line([[-s * 0.3, 0], [s * 0.3, 0]]);
        },
        tree: function (s) {
            var P = [[0, -1], [0.6, -0.72], [-0.6, -0.72], [0.6, -0.2], [-0.6, -0.2], [0, 0.06], [0.6, 0.4], [-0.6, 0.4], [0, 0.66], [0, 1]];
            var E = [[0, 1], [0, 2], [0, 5], [1, 2], [1, 3], [1, 5], [2, 4], [2, 5], [3, 4], [3, 5], [3, 6], [4, 5], [4, 7], [5, 6], [5, 7], [5, 8], [6, 7], [6, 8], [6, 9], [7, 8], [7, 9], [8, 9]];
            var k = s * 0.82, r = s * 0.1;
            E.forEach(function (e) {
                var a = P[e[0]], b = P[e[1]], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
                line([[(a[0] + ux * r / k) * k, (a[1] + uy * r / k) * k], [(b[0] - ux * r / k) * k, (b[1] - uy * r / k) * k]]);
            });
            P.forEach(function (p, i) { circle(p[0] * k, p[1] * k, r); if (i === 0 || i === 9) dot(p[0] * k, p[1] * k, r * 0.3); });
        },
        drabsha: function (s) {
            line([[0, -s * 0.98], [0, s * 0.98]]); line([[-s * 0.72, -s * 0.42], [s * 0.72, -s * 0.42]]);
            // the cloth, hanging from the crossbar either side of the staff
            [-1, 1].forEach(function (k) {
                line([[k * s * 0.7, -s * 0.42], [k * s * 0.66, s * 0.4], [k * s * 0.56, s * 0.3], [k * s * 0.46, s * 0.42], [k * s * 0.36, s * 0.32], [k * s * 0.26, s * 0.44], [k * s * 0.16, s * 0.34], [k * s * 0.08, s * 0.42], [k * s * 0.08, -s * 0.42]]);
                line([[k * s * 0.4, -s * 0.42], [k * s * 0.44, s * 0.2]]);
            });
            ctx.save(); ctx.setLineDash([s * 0.05, s * 0.05]); circle(0, -s * 0.42, s * 0.22); ctx.restore();   // the myrtle
        },
        dee: function (s) {
            circle(0, -s * 0.1, s * 0.3); dot(0, -s * 0.1, s * 0.05);                    // the Sun
            arc(0, -s * 0.62, s * 0.3, Math.PI * 0.18, Math.PI * 0.82);                  // the Moon's horns
            line([[0, s * 0.2], [0, s * 0.78]]); line([[-s * 0.32, s * 0.45], [s * 0.32, s * 0.45]]);   // the cross of the elements
            arc(-s * 0.19, s * 0.95, s * 0.19, Math.PI, Math.PI * 2); arc(s * 0.19, s * 0.95, s * 0.19, Math.PI, Math.PI * 2);   // Aries, fire
        },
        pearl: function (s, t) {
            ctx.beginPath();
            var turns = 2.3, N = 140, a, r;
            for (var i = 0; i <= N; i++) { a = i / N * turns * Math.PI * 2; r = s * 0.16 + s * 0.72 * i / N; if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
            ctx.stroke();
            var hx = Math.cos(a) * r, hy = Math.sin(a) * r, tx = -Math.sin(a), ty = Math.cos(a);
            line([[hx - tx * s * 0.09 - Math.cos(a) * s * 0.02, hy - ty * s * 0.09 - Math.sin(a) * s * 0.02], [hx + tx * s * 0.26, hy + ty * s * 0.26], [hx - tx * s * 0.02 + Math.cos(a) * s * 0.1, hy - ty * s * 0.02 + Math.sin(a) * s * 0.1]], true);
            var g = REDUCED ? 1 : 0.8 + 0.2 * Math.sin(t * 1.5);
            ctx.save(); ctx.globalAlpha *= g; dot(0, 0, s * 0.08); ctx.restore(); circle(0, 0, s * 0.12);
        },
        ogdoad: function (s) {
            for (var i = 1; i <= 7; i++) arc(0, s * 0.72, s * (0.1 + i * 0.1), Math.PI, Math.PI * 2);
            ctx.save(); ctx.setLineDash([s * 0.03, s * 0.06]); arc(0, s * 0.72, s * 0.98, Math.PI, Math.PI * 2); ctx.restore();
            for (var k = 0; k < 9; k++) { var a = Math.PI + (k + 0.5) / 9 * Math.PI; dot(Math.cos(a) * s * 0.98, s * 0.72 + Math.sin(a) * s * 0.98, s * 0.035); }
            dot(0, s * 0.72, s * 0.04);
        },
        tria: function (s) {
            // sulphur: a triangle on a cross
            line([[-s * 0.62, -s * 0.72], [-s * 0.42, -s * 0.36], [-s * 0.82, -s * 0.36]], true); line([[-s * 0.62, -s * 0.36], [-s * 0.62, s * 0.3]]); line([[-s * 0.8, s * 0.0], [-s * 0.44, s * 0.0]]);
            // mercury: a crescent on a circle on a cross
            arc(0, -s * 0.76, s * 0.18, Math.PI * 0.15, Math.PI * 0.85); circle(0, -s * 0.36, s * 0.2); line([[0, -s * 0.16], [0, s * 0.3]]); line([[-s * 0.18, s * 0.06], [s * 0.18, s * 0.06]]);
            // salt: a circle with a bar
            circle(s * 0.62, -s * 0.2, s * 0.3); line([[s * 0.32, -s * 0.2], [s * 0.92, -s * 0.2]]);
            glyph("🜍", -s * 0.62, s * 0.7, s * 0.22, MONO); glyph("☿", 0, s * 0.7, s * 0.22, MONO); glyph("🜔", s * 0.62, s * 0.7, s * 0.22, MONO);
        }
    };

    // ---- the room ------------------------------------------------------------
    var W = 0, H = 0, DPR = 1, clock = 0, lastFrame = 0, selected = 0, hover = -1, turn = 0;
    function resize() {
        DPR = Math.min(2, window.devicePixelRatio || 1);
        var r = canvas.getBoundingClientRect();
        W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
        canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    function geometry() {
        var m = Math.min(W, H), wide = W > H * 1.25;
        return { cx: wide ? W * 0.5 : W * 0.5, cy: H * 0.5, R: m * (wide ? 0.4 : 0.38), s: m * 0.075, big: m * 0.2 };
    }
    function ringAngle(i, g) { return turn - Math.PI / 2 + (i - 1) / RING * Math.PI * 2; }
    function drawSign(sign, s, t, col, width, glow) {
        if (!sign || !DRAW[sign.id]) return;
        ctx.save();
        ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
        if (glow) { ctx.shadowColor = col; ctx.shadowBlur = s * 0.35; }
        DRAW[sign.id](s, t);
        ctx.restore();
    }
    function render() {
        var g = geometry(), t = clock;
        ctx.fillStyle = "#020705"; ctx.fillRect(0, 0, W, H);
        // the floor: Origen's circles, faint
        ctx.save(); ctx.translate(g.cx, g.cy);
        ctx.strokeStyle = FAINT; ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]); circle(0, 0, g.R * 1.22); ctx.setLineDash([]);
        circle(0, 0, g.R * 0.55); circle(0, 0, g.R * 0.62);
        for (var i = 0; i < 7; i++) { var a = turn * 0.5 - Math.PI / 2 + i / 7 * Math.PI * 2; circle(Math.cos(a) * g.R * 0.82, Math.sin(a) * g.R * 0.82, g.R * 0.13); }
        for (i = 1; i <= RING; i++) { var b = ringAngle(i, g); line([[Math.cos(b) * g.R * 0.62, Math.sin(b) * g.R * 0.62], [Math.cos(b) * (g.R - g.s * 1.3), Math.sin(b) * (g.R - g.s * 1.3)]]); }
        ctx.restore();
        // the ring
        for (i = 1; i <= RING; i++) {
            var ang = ringAngle(i, g), x = g.cx + Math.cos(ang) * g.R, y = g.cy + Math.sin(ang) * g.R;
            var on = i === selected, near = i === hover;
            ctx.save(); ctx.translate(x, y);
            if (on) { ctx.strokeStyle = DIM; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); circle(0, 0, g.s * 1.25); ctx.setLineDash([]); }
            drawSign(SIGNS[i], g.s, t, on ? INK : near ? "#bfffe6" : "#5ad2a4", near || on ? 1.6 : 1.1, near);
            ctx.restore();
        }
        // the middle: the chosen sign, large
        ctx.save(); ctx.translate(g.cx, g.cy);
        drawSign(SIGNS[selected], g.big, t, INK, 2.2, true);
        ctx.restore();
        // the name, under it
        ctx.fillStyle = INK; ctx.globalAlpha = 0.85;
        ctx.font = Math.max(11, Math.round(g.s * 0.34)) + "px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        ctx.fillText(SIGNS[selected] ? SIGNS[selected].name.toLowerCase() : "", g.cx, g.cy + g.big * 1.35);
        ctx.globalAlpha = 1;
    }
    function frame(now, manual) {
        if (!manual) requestAnimationFrame(frame);
        var dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000 || 0));
        lastFrame = now; clock += dt;
        if (!REDUCED) turn += dt * 0.035;
        if (!manual && document.hidden) return;
        render();
    }

    // ---- choosing ---------------------------------------------------------------
    function select(i) {
        if (i < 0 || i >= SIGNS.length) return;
        selected = i;
        var sign = SIGNS[i];
        if (nameOut) nameOut.textContent = sign.name;
        if (textOut) textOut.innerHTML = sign.html;
        if (shelfOut) {
            shelfOut.innerHTML = "";
            if (sign.shelf) {
                var a = document.getElementById(sign.shelf.replace(/^#/, "")), link = document.createElement("a");
                link.href = sign.shelf; link.textContent = a ? (a.querySelector("a") || a).textContent : "the shelf";
                shelfOut.appendChild(document.createTextNode("on the shelf: ")); shelfOut.appendChild(link);
            }
        }
        // The address carries the sign, unless it points at a shelf (#lib-...), which is left alone.
        try { var h0 = location.hash.replace(/^#/, ""); if (!h0 || SIGNS.some(function (x) { return x.id === h0; })) history.replaceState(null, "", "#" + sign.id); } catch (e) { /* fine */ }
        if (audio) audio.ping(i);
    }
    function at(px, py) {
        var g = geometry(), dx = px - g.cx, dy = py - g.cy, d = Math.hypot(dx, dy);
        if (d < g.big * 1.1) return 0;
        if (Math.abs(d - g.R) > g.s * 1.5) return -1;
        var a = Math.atan2(dy, dx), best = -1, bd = 9;
        for (var i = 1; i <= RING; i++) { var b = ringAngle(i, g), e = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))); if (e < bd) { bd = e; best = i; } }
        return bd < Math.PI / RING ? best : -1;
    }
    function pos(ev) { var r = canvas.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; }
    canvas.addEventListener("pointermove", function (ev) { if (TOUCH) return; var p = pos(ev); hover = at(p[0], p[1]); canvas.style.cursor = hover >= 0 ? "pointer" : "default"; });
    canvas.addEventListener("pointerleave", function () { hover = -1; });
    canvas.addEventListener("click", function (ev) {
        var p = pos(ev), i = at(p[0], p[1]);
        if (i >= 0) select(i);
        else if (TOUCH) select((selected + 1) % SIGNS.length);
    });
    document.addEventListener("keydown", function (ev) {
        if (ev.target && /^(input|textarea|select)$/i.test(ev.target.tagName)) return;
        var k = ev.key;
        if (k === "ArrowRight" || k === "ArrowDown") { select((selected + 1) % SIGNS.length); ev.preventDefault(); }
        else if (k === "ArrowLeft" || k === "ArrowUp") { select((selected + SIGNS.length - 1) % SIGNS.length); ev.preventDefault(); }
        else if (k === "Home" || k === "0") select(0);
        else if (k === "f" || k === "F") fullscreen();
        else if (k === "m" || k === "M") toggleSound();
        else if (k === "Escape" && stage && stage.classList.contains("filled")) fill(false);
    });
    // The list under the canvas: a sign's name is a button for it too.
    (function () {
        var dl = document.getElementById("temple-signs");
        if (!dl) return;
        dl.addEventListener("click", function (ev) {
            var dt = ev.target.closest && ev.target.closest("dt");
            if (!dt) return;
            for (var i = 0; i < SIGNS.length; i++) if ("sign-" + SIGNS[i].id === dt.id) { select(i); if (stage) stage.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" }); }
        });
    })();

    // ---- fullscreen, with the iPhone fallback ----------------------------------------
    function fill(on) {
        if (!stage) return;
        stage.classList.toggle("filled", on); document.body.classList.toggle("filled", on);
        if (unfillBtn) unfillBtn.hidden = !on;
        resize();
    }
    function fullscreen() {
        if (!stage) return;
        if (document.fullscreenElement) { document.exitFullscreen(); return; }
        if (stage.classList.contains("filled")) { fill(false); return; }
        if (stage.requestFullscreen) stage.requestFullscreen().catch(function () { fill(true); });
        else fill(true);
    }
    if (fullBtn) fullBtn.addEventListener("click", fullscreen);
    if (unfillBtn) unfillBtn.addEventListener("click", function () { fill(false); });
    document.addEventListener("fullscreenchange", resize);

    // ---- a drone, behind a toggle -----------------------------------------------
    var audio = null, soundOn = false;
    try { soundOn = localStorage.getItem("temple-sound") === "on"; } catch (e) { soundOn = false; }
    function makeAudio() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        var ac = new AC();
        if (window.Unmute) window.Unmute(ac);
        var master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
        var lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = TOUCH ? 1400 : 700; lp.connect(master);
        var base = TOUCH ? 220 : 110;
        [1, 1.5, 2.0, 3.0].forEach(function (m, i) {
            var o = ac.createOscillator(), g = ac.createGain();
            o.type = i === 0 ? "triangle" : "sine"; o.frequency.value = base * m; o.detune.value = (i % 2 ? 4 : -3);
            g.gain.value = [0.5, 0.22, 0.12, 0.05][i]; o.connect(g); g.connect(lp); o.start();
            var lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.05 + i * 0.03; lg.gain.value = g.gain.value * 0.4; lfo.connect(lg); lg.connect(g.gain); lfo.start();
        });
        return {
            ac: ac, master: master,
            on: function () { if (ac.state === "suspended") ac.resume(); master.gain.setTargetAtTime(TOUCH ? 0.5 : 0.3, ac.currentTime, 1.5); },
            off: function () { master.gain.setTargetAtTime(0, ac.currentTime, 0.4); },
            ping: function (i) {
                if (!soundOn) return;
                var o = ac.createOscillator(), g = ac.createGain();
                o.type = "sine"; o.frequency.value = (TOUCH ? 660 : 440) * Math.pow(2, (i % 7) / 12);
                g.gain.value = 0; g.gain.setTargetAtTime(0.12, ac.currentTime, 0.01); g.gain.setTargetAtTime(0, ac.currentTime + 0.08, 0.25);
                o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime + 1.2);
            }
        };
    }
    function toggleSound() {
        soundOn = !soundOn;
        try { localStorage.setItem("temple-sound", soundOn ? "on" : "off"); } catch (e) { /* a visit's worth */ }
        if (soundOn) { if (!audio) audio = makeAudio(); if (audio) audio.on(); }
        else if (audio) audio.off();
        if (soundBtn) soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    }
    if (soundBtn) {
        soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
        soundBtn.addEventListener("click", toggleSound);
    }
    // The drone waits for a touch, as browsers insist; the first tap anywhere starts it if it is on.
    function firstTouch() { if (soundOn && !audio) { audio = makeAudio(); if (audio) audio.on(); } document.removeEventListener("pointerdown", firstTouch); }
    document.addEventListener("pointerdown", firstTouch);

    // ---- go -------------------------------------------------------------------------
    window.addEventListener("resize", resize);
    resize();
    var want = 0;
    try { var h = location.hash.replace(/^#/, ""); for (var i = 0; i < SIGNS.length; i++) if (SIGNS[i].id === h) want = i; } catch (e) { want = 0; }
    select(want);
    requestAnimationFrame(frame);
    window.Temple = {
        step: function (ms) { frame(lastFrame + (ms || 16), true); },
        select: select,
        state: function () { return { selected: selected, hover: hover, signs: SIGNS.map(function (s) { return s.id; }), turn: turn, sound: soundOn }; }
    };
})();
