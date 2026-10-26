/* temple/monas.js: Dee's Monas Hieroglyphica, drawn.
   The construction of Theorem XXIII is drawn on the big canvas in the order
   Dee gives it, with his letters, and can be drawn again with a tap; the
   small canvases by the theorems carry the figures the 1564 printing set in
   the margins, redrawn in the temple's line. The measure AB is the unit of
   everything; up the page is the Moon, down is the Ram. One script, no
   library; the page reads without it. */
(function () {
    "use strict";
    var SERIF = 'Georgia, "Times New Roman", serif';
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace';
    var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var INK = "#7cf5c8", DIM = "#2a5a4a", FAINT = "#163a2e", PAPER = "#020705";
    var DPR = Math.min(2, window.devicePixelRatio || 1);

    // ---- primitives, on whatever context is current ----------------------------
    var ctx;
    function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
    function dot(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    function line(pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); }
    function arc(x, y, r, a0, a1) { ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke(); }
    function text(t, x, y, size, font, align) { ctx.font = size + "px " + (font || SERIF); ctx.textAlign = align || "center"; ctx.textBaseline = "middle"; ctx.fillText(t, x, y); }
    function ink(col, w) { ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round"; }

    // ---- the Monad, from the measure u, about A at the origin; y runs down ------
    // Points of Theorem XXIII: B is a measure up the line from A, I two more
    // (the Sun's centre), R where the Sun's circle cuts the line, K a measure
    // past R (the Moon's centre); C three measures down (the Ram's point), D
    // and E two measures each side; F and P the Moon's horns, O and Q the
    // Ram's ends, M and N its centres, L, H and G the tops of the arcs.
    function P(u) {
        return { A: [0, 0], B: [0, -u], I: [0, -3 * u], R: [0, -5 * u], K: [0, -6 * u], C: [0, 3 * u], D: [-2 * u, 0], E: [2 * u, 0],
            F: [-2 * u, -6 * u], L: [0, -4 * u], Pp: [2 * u, -6 * u], O: [-2 * u, 3 * u], Q: [2 * u, 3 * u], M: [-u, 3 * u], N: [u, 3 * u], H: [-u, 2 * u], G: [u, 2 * u] };
    }
    function serif(x, y, u, vertical) { if (vertical) line([[x, y - u * 0.3], [x, y + u * 0.3]]); else line([[x - u * 0.3, y], [x + u * 0.3, y]]); }
    function sun(u, p) { circle(p.I[0], p.I[1], 2 * u); dot(p.I[0], p.I[1], Math.max(1.2, u * 0.12)); }
    function moon(u, p, horns) {
        arc(p.K[0], p.K[1], 2 * u, 0, Math.PI);                                      // the half-circle FLP, a bowl
        if (horns) { arc(p.K[0], p.K[1] + u * 0.25, 2 * u, 0.1, Math.PI - 0.1); }      // the second arc, a quarter-measure toward R
    }
    function cross(u, p, wide) {
        line([p.B, p.C]); line([p.D, p.E]);
        serif(p.D[0], p.D[1], u, true); serif(p.E[0], p.E[1], u, true); serif(p.C[0], p.C[1], u, false);
        if (wide) {                                                                   // the parallels, an eighth of a measure out
            var w = u * 0.125;
            ctx.save(); ctx.globalAlpha *= 0.55;
            line([[-w, p.B[1]], [-w, p.C[1]]]); line([[w, p.B[1]], [w, p.C[1]]]);
            line([[p.D[0], -w], [p.E[0], -w]]); line([[p.D[0], w], [p.E[0], w]]);
            ctx.restore();
        }
    }
    function ram(u, p, second) {
        arc(p.M[0], p.M[1], u, Math.PI, Math.PI * 2); arc(p.N[0], p.N[1], u, Math.PI, Math.PI * 2);   // CHO and CGQ, two arches
        if (second) { ctx.save(); ctx.globalAlpha *= 0.55; arc(p.M[0], p.M[1] - u / 6, u, Math.PI + 0.12, Math.PI * 2 - 0.12); arc(p.N[0], p.N[1] - u / 6, u, Math.PI + 0.12, Math.PI * 2 - 0.12); ctx.restore(); }
    }
    function monad(u, opts) {
        opts = opts || {};
        var p = P(u);
        if (!opts.noRam) ram(u, p, opts.ornament);
        cross(u, p, opts.ornament);
        sun(u, p);
        if (opts.ornament) { ctx.save(); ctx.globalAlpha *= 0.55; circle(p.I[0], p.I[1], 2.2 * u); ctx.restore(); }
        moon(u, p, opts.ornament);
    }

    // ---- the planets, cut from the figure (Theorems XII and XIII) ---------------
    function crossSmall(x, y, u) { line([[x, y - u], [x, y + u]]); line([[x - u * 0.8, y], [x + u * 0.8, y]]); }
    function saturn(x, y, u) { crossSmall(x, y - u * 0.6, u * 0.7); arc(x + u * 0.1, y + u * 0.55, u * 0.5, -Math.PI * 0.9, Math.PI * 0.35); }
    function jupiter(x, y, u) { arc(x - u * 0.55, y - u * 0.45, u * 0.5, Math.PI, Math.PI * 1.75); line([[x - u * 0.55 + u * 0.5 * Math.cos(Math.PI * 1.75), y - u * 0.45 + u * 0.5 * Math.sin(Math.PI * 1.75)], [x - u * 0.9, y + u * 0.35]]); line([[x - u * 1.2, y + u * 0.35], [x + u * 0.6, y + u * 0.35]]); line([[x + u * 0.25, y - u * 0.9], [x + u * 0.25, y + u * 1]]); }
    function mercury(x, y, u) { arc(x, y - u * 0.75, u * 0.45, Math.PI * 0.1, Math.PI * 0.9); circle(x, y - u * 0.05, u * 0.5); line([[x, y + u * 0.45], [x, y + u * 1.25]]); line([[x - u * 0.45, y + u * 0.85], [x + u * 0.45, y + u * 0.85]]); }
    function mercuryLunar(x, y, u) { crossSmall(x, y + u * 0.3, u * 0.7); line([[x - u * 0.6, y - u * 0.6], [x + u * 0.6, y - u * 0.6]]); line([[x - u * 0.45, y - u * 0.95], [x - u * 0.45, y - u * 0.6]]); line([[x + u * 0.45, y - u * 0.95], [x + u * 0.45, y - u * 0.6]]); }
    function mars(x, y, u) { circle(x - u * 0.35, y, u * 0.5); dot(x - u * 0.35, y, u * 0.06); line([[x + u * 0.15, y], [x + u * 1.05, y]]); arc(x + u * 0.9, y - u * 0.35, u * 0.3, Math.PI * 0.5, Math.PI * 1.5); }
    function venus(x, y, u) { circle(x, y - u * 0.35, u * 0.5); dot(x, y - u * 0.35, u * 0.06); line([[x, y + u * 0.15], [x, y + u * 1.15]]); line([[x - u * 0.5, y + u * 0.65], [x + u * 0.5, y + u * 0.65]]); }
    function aries(x, y, u) { arc(x - u * 0.5, y, u * 0.5, Math.PI, Math.PI * 2); arc(x + u * 0.5, y, u * 0.5, Math.PI, Math.PI * 2); }
    function taurus(x, y, u) { arc(x, y - u * 0.75, u * 0.45, Math.PI * 0.08, Math.PI * 0.92); circle(x, y + u * 0.15, u * 0.55); dot(x, y + u * 0.15, u * 0.06); }
    function sol(x, y, u) { circle(x, y, u); dot(x, y, Math.max(1.2, u * 0.12)); }
    function luna(x, y, u, down) { if (down) arc(x, y, u, Math.PI, Math.PI * 2); else arc(x, y, u, 0, Math.PI); }

    // ---- the small figures, one a theorem, in a box of half-size s ---------------
    var FIG = {
        1: function (s) { dot(-s * 0.62, s * 0.1, s * 0.06); line([[-s * 0.3, s * 0.55], [s * 0.1, -s * 0.5]]); circle(s * 0.5, s * 0.05, s * 0.38); },
        2: function (s) { dot(0, 0, s * 0.07); ctx.save(); ctx.setLineDash([s * 0.05, s * 0.08]); line([[0, 0], [s * 0.72, 0]]); circle(0, 0, s * 0.72); ctx.restore(); },
        3: function (s) { sol(0, 0, s * 0.62); ctx.save(); ctx.globalAlpha *= 0.5; ctx.setLineDash([s * 0.04, s * 0.09]); circle(0, 0, s * 0.3); circle(0, 0, s * 0.46); ctx.restore(); },
        4: function (s) { luna(0, -s * 0.38, s * 0.5); sol(0, s * 0.22, s * 0.48); },
        5: function (s) { var p = P(s * 0.17); ctx.translate(0, s * 0.62); sun(s * 0.17, p); moon(s * 0.17, p, true); ctx.save(); ctx.globalAlpha *= 0.5; text("1", s * 0.75, -s * 1.15, s * 0.3, MONO); ctx.restore(); },
        6: function (s) { line([[0, -s * 0.72], [0, s * 0.72]]); line([[-s * 0.72, 0], [s * 0.72, 0]]); dot(0, 0, s * 0.08); ctx.save(); ctx.globalAlpha *= 0.6; text("3", -s * 0.82, -s * 0.82, s * 0.26, MONO); text("4", s * 0.82, s * 0.82, s * 0.26, MONO); text("7", s * 0.82, -s * 0.82, s * 0.26, MONO); text("8", -s * 0.82, s * 0.82, s * 0.26, MONO); ctx.restore(); },
        7: function (s) { var r = s * 0.78; [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(function (d) { line([[0, 0], [d[0] * r, d[1] * r]]); line([[d[0] * r - (d[0] ? d[0] * s * 0.18 : s * 0.14), d[1] * r - (d[1] ? d[1] * s * 0.18 : s * 0.14)], [d[0] * r, d[1] * r], [d[0] * r - (d[0] ? d[0] * s * 0.18 : -s * 0.14), d[1] * r - (d[1] ? d[1] * s * 0.18 : -s * 0.14)]]); }); dot(0, 0, s * 0.06); for (var i = 1; i < 4; i++) { ctx.save(); ctx.globalAlpha *= 0.35; dot(0, -r * i / 4, s * 0.03); dot(0, r * i / 4, s * 0.03); dot(-r * i / 4, 0, s * 0.03); dot(r * i / 4, 0, s * 0.03); ctx.restore(); } },
        8: function (s) { for (var row = 0; row < 4; row++) for (var k = 0; k <= row; k++) dot(-s * 0.82 + (k - row / 2) * s * 0.22, -s * 0.5 + row * s * 0.3, s * 0.045); line([[s * 0.15, -s * 0.5], [s * 0.85, s * 0.5]]); line([[s * 0.85, -s * 0.5], [s * 0.15, s * 0.5]]); ctx.save(); ctx.globalAlpha *= 0.6; text("10", s * 0.5, s * 0.8, s * 0.26, MONO); ctx.restore(); },
        9: function (s) { ctx.translate(0, s * 0.3); monad(s * 0.16, { noRam: true }); },
        10: function (s) { aries(0, s * 0.15, s * 0.7); ctx.save(); ctx.globalAlpha *= 0.5; line([[0, s * 0.15], [0, -s * 0.55]]); ctx.restore(); },
        11: function (s) { for (var i = 0; i < 24; i++) { var a = i / 24 * Math.PI * 2, r0 = s * 0.9, r1 = i % 6 ? s * 0.82 : s * 0.74; ctx.save(); ctx.globalAlpha *= i % 6 ? 0.5 : 1; line([[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * r1, Math.sin(a) * r1]]); ctx.restore(); } aries(0, s * 0.1, s * 0.5); dot(0, s * 0.1, s * 0.05); },
        12: function (s) { saturn(-s * 0.6, 0, s * 0.42); jupiter(0, 0, s * 0.42); mercuryLunar(s * 0.62, 0, s * 0.42); },
        13: function (s) { mars(-s * 0.68, -s * 0.05, s * 0.4); venus(0, -s * 0.05, s * 0.42); mercury(s * 0.62, -s * 0.05, s * 0.4); },
        14: function (s) { sol(-s * 0.42, -s * 0.42, s * 0.3); luna(s * 0.42, -s * 0.42, s * 0.3); ctx.save(); ctx.globalAlpha *= 0.6; for (var i = -3; i <= 3; i++) line([[i * s * 0.22, s * 0.25], [i * s * 0.22, s * 0.75]]); ctx.restore(); line([[-s * 0.8, s * 0.25], [s * 0.8, s * 0.25]]); line([[-s * 0.8, s * 0.75], [s * 0.8, s * 0.75]]); },
        15: function (s) { taurus(-s * 0.45, s * 0.05, s * 0.5); ctx.save(); ctx.globalAlpha *= 0.6; text("ου", s * 0.5, -s * 0.3, s * 0.44); text("α α", s * 0.5, s * 0.35, s * 0.34); ctx.restore(); },
        16: function (s) { line([[-s * 0.55, -s * 0.7], [-s * 0.55, s * 0.7]]); line([[-s * 1.0, 0], [-s * 0.1, 0]]); ctx.save(); ctx.setLineDash([s * 0.05, s * 0.07]); ctx.globalAlpha *= 0.6; line([[-s * 1.05, -s * 0.72], [-s * 0.05, s * 0.72]]); ctx.restore(); line([[s * 0.25, -s * 0.62], [s * 0.45, -s * 0.12], [s * 0.65, -s * 0.62]]); line([[s * 0.25, s * 0.62], [s * 0.45, s * 0.12], [s * 0.65, s * 0.62]]); line([[s * 0.95, -s * 0.62], [s * 0.95, -s * 0.12], [s * 1.0, -s * 0.12]]); ctx.save(); ctx.globalAlpha *= 0.6; text("V", s * 0.45, -s * 0.85, s * 0.22, MONO); text("Λ", s * 0.45, s * 0.9, s * 0.22, MONO); text("L", s * 0.95, s * 0.2, s * 0.22, MONO); ctx.restore(); },
        17: function (s) { line([[0, -s * 0.75], [0, s * 0.75]]); line([[-s * 0.75, 0], [s * 0.75, 0]]); text("L", -s * 0.45, -s * 0.4, s * 0.34); text("V", s * 0.45, -s * 0.4, s * 0.34); text("X", s * 0.45, s * 0.45, s * 0.34); ctx.save(); ctx.globalAlpha *= 0.6; text("252", -s * 0.45, s * 0.45, s * 0.26, MONO); ctx.restore(); },
        18: function (s) { ctx.save(); ctx.translate(0, s * 0.05); for (var i = 5; i >= 1; i--) { ctx.beginPath(); ctx.ellipse(0, i * s * 0.02, s * 0.16 * i, s * 0.2 * i, 0, 0, Math.PI * 2); ctx.globalAlpha = i === 5 ? 1 : 0.45; ctx.stroke(); } ctx.globalAlpha = 1; dot(0, 0, s * 0.07); luna(0, -s * 0.55, s * 0.38); ctx.restore(); },
        19: function (s) { sol(-s * 0.4, -s * 0.55, s * 0.26); luna(s * 0.4, -s * 0.55, s * 0.26); ctx.save(); ctx.globalAlpha *= 0.5; ctx.setLineDash([s * 0.04, s * 0.08]); for (var i = -1; i <= 1; i += 2) { line([[-s * 0.4 + i * s * 0.12, -s * 0.25], [-s * 0.4 + i * s * 0.25, s * 0.3]]); line([[s * 0.4 + i * s * 0.12, -s * 0.25], [s * 0.4 + i * s * 0.25, s * 0.3]]); } ctx.restore(); [-0.75, -0.25, 0.25, 0.75].forEach(function (x) { line([[x * s - s * 0.2, s * 0.55], [x * s + s * 0.2, s * 0.55]]); }); },
        20: function (s) { line([[-s * 0.55, -s * 0.6], [-s * 0.55, s * 0.6]]); line([[-s * 1.1, 0], [0, 0]]); dot(-s * 0.55, 0, s * 0.07); var g = s * 0.14, x = s * 0.55; line([[x, -s * 0.6], [x, -g]]); line([[x, g], [x, s * 0.6]]); line([[x - s * 0.55, 0], [x - g, 0]]); line([[x + g, 0], [x + s * 0.55, 0]]); ctx.save(); ctx.globalAlpha *= 0.6; text("A", -s * 0.55, s * 0.85, s * 0.24, MONO); text("B", x, s * 0.85, s * 0.24, MONO); ctx.restore(); },
        21: function (s) { aries(-s * 0.6, -s * 0.5, s * 0.36); crossSmall(-s * 0.6, 0, s * 0.3); sol(0.05 * s, -s * 0.1, s * 0.3); luna(s * 0.65, -s * 0.1, s * 0.3, true); ctx.save(); ctx.globalAlpha *= 0.6; text("B", -s * 0.6, s * 0.75, s * 0.24, MONO); text("D", 0.05 * s, s * 0.75, s * 0.24, MONO); text("C", s * 0.65, s * 0.75, s * 0.24, MONO); ctx.restore(); },
        22: function (s) { text("α", -s * 0.6, -s * 0.38, s * 0.62); text("λ", s * 0.5, -s * 0.38, s * 0.62); text("δ", -s * 0.6, s * 0.45, s * 0.62); text("ω", s * 0.5, s * 0.45, s * 0.62); ctx.save(); ctx.globalAlpha *= 0.45; luna(-s * 0.6, -s * 0.9, s * 0.2); sol(-s * 0.6, -s * 0.9, s * 0.08); ctx.restore(); },
        23: function (s) { ctx.translate(0, s * 0.3); monad(s * 0.14, { ornament: true }); ctx.save(); ctx.globalAlpha *= 0.6; text("9", s * 0.75, -s * 0.6, s * 0.26, MONO); ctx.restore(); },
        24: function (s) { for (var i = 0; i < 24; i++) { var a = i / 24 * Math.PI * 2; ctx.save(); ctx.globalAlpha *= i % 6 ? 0.45 : 1; line([[Math.cos(a) * s * 0.92, Math.sin(a) * s * 0.92], [Math.cos(a) * s * 0.82, Math.sin(a) * s * 0.82]]); ctx.restore(); } ctx.translate(0, s * 0.2); monad(s * 0.1); }
    };

    function fit(canvas) {
        var w = canvas.clientWidth || 120, h = canvas.clientHeight || w;
        if (canvas.width !== Math.round(w * DPR) || canvas.height !== Math.round(h * DPR)) { canvas.width = Math.round(w * DPR); canvas.height = Math.round(h * DPR); }
        return { w: w, h: h };
    }
    function drawFig(canvas) {
        var n = +canvas.getAttribute("data-fig"); if (!FIG[n]) return;
        var g = fit(canvas); ctx = canvas.getContext("2d");
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = PAPER; ctx.fillRect(0, 0, g.w, g.h);
        ctx.save(); ctx.translate(g.w / 2, g.h / 2);
        ink(INK, 1.4); ctx.shadowColor = INK; ctx.shadowBlur = 6;
        FIG[n](Math.min(g.w, g.h) * 0.42);
        ctx.restore();
    }
    var figs = document.querySelectorAll("canvas.fig");
    for (var i = 0; i < figs.length; i++) drawFig(figs[i]);

    // ---- the construction of Theorem XXIII, drawn in order ----------------------
    var stage = document.getElementById("monas-stage");
    if (!stage) return;
    var sctx = stage.getContext("2d"), t0 = null, done = false;
    // Each step: a duration in seconds, and what it draws at progress k (0..1).
    function steps(u, p) {
        function partial(a, b, k) { return [[a[0], a[1]], [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]]; }
        return [
            { t: 0.5, d: function (k) { ctx.save(); ctx.globalAlpha *= k; dot(p.A[0], p.A[1], u * 0.1); ctx.restore(); } },                       // A
            { t: 0.9, d: function (k) { line(partial(p.C, p.K, k)); } },                                                                         // CAK
            { t: 0.7, d: function (k) { line(partial(p.D, p.E, k)); } },                                                                         // DAE
            { t: 0.4, d: function (k) { ctx.save(); ctx.globalAlpha *= k; dot(p.B[0], p.B[1], u * 0.1); ctx.restore(); } },                       // B, the measure
            { t: 0.5, d: function (k) { ctx.save(); ctx.globalAlpha *= k; serif(p.D[0], p.D[1], u, true); serif(p.E[0], p.E[1], u, true); serif(p.C[0], p.C[1], u, false); ctx.restore(); } },
            { t: 0.4, d: function (k) { ctx.save(); ctx.globalAlpha *= k; dot(p.I[0], p.I[1], u * 0.12); ctx.restore(); } },                      // I
            { t: 1.0, d: function (k) { arc(p.I[0], p.I[1], 2 * u, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * k); } },                              // the Sun
            { t: 0.4, d: function (k) { ctx.save(); ctx.globalAlpha *= k; dot(p.R[0], p.R[1], u * 0.08); dot(p.K[0], p.K[1], u * 0.08); ctx.restore(); } },   // R, K
            { t: 0.5, d: function (k) { line(partial(p.F, p.Pp, k)); } },                                                                        // PFK
            { t: 0.9, d: function (k) { arc(p.K[0], p.K[1], 2 * u, 0, Math.PI * k); } },                                                          // the Moon, FLP
            { t: 0.4, d: function (k) { ctx.save(); ctx.globalAlpha *= k; dot(p.M[0], p.M[1], u * 0.08); dot(p.N[0], p.N[1], u * 0.08); line([p.O, p.Q]); ctx.restore(); } },   // OCQ, M, N
            { t: 0.9, d: function (k) { arc(p.M[0], p.M[1], u, Math.PI, Math.PI + Math.PI * k); arc(p.N[0], p.N[1], u, Math.PI * 2, Math.PI * 2 - Math.PI * k); } },   // the Ram
            { t: 1.2, d: function (k) { ctx.save(); ctx.globalAlpha *= 0.55 * k; circle(p.I[0], p.I[1], 2.2 * u); arc(p.K[0], p.K[1] + u * 0.25, 2 * u, 0.1, Math.PI - 0.1); arc(p.M[0], p.M[1] - u / 6, u, Math.PI + 0.12, Math.PI * 2 - 0.12); arc(p.N[0], p.N[1] - u / 6, u, Math.PI + 0.12, Math.PI * 2 - 0.12); var w = u * 0.125; line([[-w, p.B[1]], [-w, p.C[1]]]); line([[w, p.B[1]], [w, p.C[1]]]); line([[p.D[0], -w], [p.E[0], -w]]); line([[p.D[0], w], [p.E[0], w]]); ctx.restore(); } }   // the ornaments
        ];
    }
    function letters(u, p, k) {
        ctx.save(); ctx.globalAlpha *= k; ctx.fillStyle = INK; ctx.shadowBlur = 0;
        var o = u * 0.45, size = Math.max(11, u * 0.5);
        var L = { A: [o, o * 0.9], B: [o, 0], C: [0, o * 1.8], D: [-o * 0.2, o * 0.9], E: [o * 0.2, o * 0.9], I: [o, 0], R: [o, 0], K: [-o * 0.9, -o * 0.4], F: [-o * 0.5, -o * 0.6], Pp: [o * 0.5, -o * 0.6], L: [o, o * 0.3], O: [-o * 0.6, 0], Q: [o * 0.6, 0], M: [0, o * 0.9], N: [0, o * 0.9], H: [-o * 0.5, -o * 0.6], G: [o * 0.5, -o * 0.6] };
        Object.keys(L).forEach(function (n) { var q = p[n]; text(n === "Pp" ? "P" : n, q[0] + L[n][0], q[1] + L[n][1], size, SERIF); });
        ctx.restore();
    }
    function scale(u, p, k) {
        // The measure, shown once: AB, with the nine measures of CK ticked.
        ctx.save(); ctx.globalAlpha *= 0.45 * k; ink(DIM, 1);
        var x = p.E[0] + u * 1.4;
        line([[x, p.C[1]], [x, p.K[1]]]);
        for (var i = 0; i <= 9; i++) line([[x - u * 0.15, p.C[1] - i * u], [x + u * 0.15, p.C[1] - i * u]]);
        ctx.fillStyle = DIM; text("AB", x + u * 0.5, p.A[1] - u * 0.5, Math.max(10, u * 0.4), MONO, "left");
        text("9 AB", x + u * 0.5, (p.C[1] + p.K[1]) / 2, Math.max(10, u * 0.4), MONO, "left");
        ctx.restore();
    }
    function frameAt(elapsed) {
        var g = fit(stage); ctx = sctx;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = PAPER; ctx.fillRect(0, 0, g.w, g.h);
        var u = Math.min(g.h / 11.5, g.w / 8), p = P(u);
        ctx.save(); ctx.translate(g.w / 2, g.h * 0.5 + u * 1.3);
        // the guide lines, faint, under everything
        ctx.save(); ink(FAINT, 1); ctx.setLineDash([3, 5]); line([[p.C[0], p.C[1] + u], [p.K[0], p.K[1] - u * 1.4]]); line([[p.D[0] - u * 0.8, 0], [p.E[0] + u * 0.8, 0]]); ctx.restore();
        ink(INK, Math.max(1.5, u * 0.07)); ctx.shadowColor = INK; ctx.shadowBlur = Math.min(12, u * 0.3);
        var S = steps(u, p), t = elapsed, all = true;
        for (var i = 0; i < S.length; i++) {
            if (t <= 0) { all = false; break; }
            var k = Math.min(1, t / S[i].t);
            S[i].d(k);
            if (k < 1) all = false;
            t -= S[i].t;
        }
        var lk = all ? Math.min(1, t / 0.8) : 0;
        if (lk > 0) { letters(u, p, lk); scale(u, p, lk); }
        ctx.restore();
        return all && lk >= 1;
    }
    function total() { var s = steps(1, P(1)), t = 0.8; s.forEach(function (x) { t += x.t; }); return t; }
    function start() { t0 = null; done = false; requestAnimationFrame(tick); }
    function tick(now) {
        if (t0 === null) t0 = now;
        var elapsed = REDUCED ? total() : (now - t0) / 1000;
        done = frameAt(elapsed);
        if (!done) requestAnimationFrame(tick);
    }
    stage.addEventListener("click", function () { if (done) start(); });
    addEventListener("resize", function () { if (done) frameAt(total()); for (var i = 0; i < figs.length; i++) drawFig(figs[i]); });
    // Start when it comes into view, so the drawing is seen from its first line.
    if ("IntersectionObserver" in window) {
        var seen = false, io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting && !seen) { seen = true; start(); io.disconnect(); } }); }, { threshold: 0.3 });
        frameAt(0); io.observe(stage);
    } else start();

    window.Monas = { points: P, monad: monad, redraw: start };
})();
