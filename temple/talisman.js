/* temple/talisman.js: the talisman press.
   Agrippa's seven planetary squares (Three Books of Occult Philosophy,
   II.22): Saturn's three by three up to the Moon's nine by nine, every
   row, column and diagonal summing alike. On each the old sigils were
   traced by numbering a name's Hebrew letters and joining the cells in
   order; the intelligence and the spirit of each planet are drawn that
   way here, and a name of yours by Agrippa's Latin numeration (II.20).
   The square shown first is the planetary hour's, if js/hours.js is in.
   Nothing is stored or sent. One script, no library. */
(function () {
    "use strict";
    var canvas = document.getElementById("talisman-stage");
    if (!canvas) return;
    var ctx = canvas.getContext("2d"), stage = canvas.parentNode;
    var planetsOut = document.getElementById("talisman-planets"), nameIn = document.getElementById("talisman-name");
    var saveLink = document.getElementById("talisman-save"), capOut = document.getElementById("talisman-caption");
    var toggles = { intelligence: document.getElementById("talisman-int"), spirit: document.getElementById("talisman-spirit"), name: document.getElementById("talisman-trace") };
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace', SERIF = 'Georgia, "Times New Roman", serif';
    var INK = "#7cf5c8", DIM = "#2a5a4a", FAINT = "#163a2e", AMBER = "#ffb000", PAPER = "#020705", DPR = Math.min(2, window.devicePixelRatio || 1);

    // ---- the squares, as Agrippa printed them -----------------------------------
    var KAMEA = {
        Saturn: [[4, 9, 2], [3, 5, 7], [8, 1, 6]],
        Jupiter: [[4, 14, 15, 1], [9, 7, 6, 12], [5, 11, 10, 8], [16, 2, 3, 13]],
        Mars: [[11, 24, 7, 20, 3], [4, 12, 25, 8, 16], [17, 5, 13, 21, 9], [10, 18, 1, 14, 22], [23, 6, 19, 2, 15]],
        Sun: [[6, 32, 3, 34, 35, 1], [7, 11, 27, 28, 8, 30], [19, 14, 16, 15, 23, 24], [18, 20, 22, 21, 17, 13], [25, 29, 10, 9, 26, 12], [36, 5, 33, 4, 2, 31]],
        Venus: [[22, 47, 16, 41, 10, 35, 4], [5, 23, 48, 17, 42, 11, 29], [30, 6, 24, 49, 18, 36, 12], [13, 31, 7, 25, 43, 19, 37], [38, 14, 32, 1, 26, 44, 20], [21, 39, 8, 33, 2, 27, 45], [46, 15, 40, 9, 34, 3, 28]],
        Mercury: [[8, 58, 59, 5, 4, 62, 63, 1], [49, 15, 14, 52, 53, 11, 10, 56], [41, 23, 22, 44, 45, 19, 18, 48], [32, 34, 35, 29, 28, 38, 39, 25], [40, 26, 27, 37, 36, 30, 31, 33], [17, 47, 46, 20, 21, 43, 42, 24], [9, 55, 54, 12, 13, 51, 50, 16], [64, 2, 3, 61, 60, 6, 7, 57]],
        Moon: [[37, 78, 29, 70, 21, 62, 13, 54, 5], [6, 38, 79, 30, 71, 22, 63, 14, 46], [47, 7, 39, 80, 31, 72, 23, 55, 15], [16, 48, 8, 40, 81, 32, 64, 24, 56], [57, 17, 49, 9, 41, 73, 33, 65, 25], [26, 58, 18, 50, 1, 42, 74, 34, 66], [67, 27, 59, 10, 51, 2, 43, 75, 35], [36, 68, 19, 60, 11, 52, 3, 44, 76], [77, 28, 69, 20, 61, 12, 53, 4, 45]]
    };
    var ORDER = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"];
    var SIGN = { Saturn: "♄", Jupiter: "♃", Mars: "♂", Sun: "☉", Venus: "♀", Mercury: "☿", Moon: "☽" };
    var METAL = { Saturn: "lead", Jupiter: "tin", Mars: "iron", Sun: "gold", Venus: "copper", Mercury: "quicksilver", Moon: "silver" };
    // The names, as Hebrew letter values, which is how the sigils were drawn:
    // the intelligence's number is a row's sum (or the square's side squared,
    // for Venus), the spirit's the whole square's. The Moon's intelligence of
    // intelligences has a name of five words; its spirit Chasmodai is traced instead.
    var NAMES = {
        Saturn: { intelligence: ["Agiel", "אגיאל", [1, 3, 10, 1, 30]], spirit: ["Zazel", "זאזל", [7, 1, 7, 30]] },
        Jupiter: { intelligence: ["Yophiel", "יהפיאל", [10, 5, 80, 10, 1, 30]], spirit: ["Hismael", "הסמאל", [5, 60, 40, 1, 30]] },
        Mars: { intelligence: ["Graphiel", "גראפיאל", [3, 200, 1, 80, 10, 1, 30]], spirit: ["Bartzabel", "ברצבאל", [2, 200, 90, 2, 1, 30]] },
        Sun: { intelligence: ["Nakhiel", "נכיאל", [50, 20, 10, 1, 30]], spirit: ["Sorath", "סורת", [60, 6, 200, 400]] },
        Venus: { intelligence: ["Hagiel", "הגיאל", [5, 3, 10, 1, 30]], spirit: ["Kedemel", "קדמאל", [100, 4, 40, 1, 30]] },
        Mercury: { intelligence: ["Tiriel", "טיריאל", [9, 10, 200, 10, 1, 30]], spirit: ["Taphthartharath", "תפתרתרת", [400, 80, 400, 200, 400, 200, 400]] },
        Moon: { intelligence: null, spirit: ["Chasmodai", "חשמודאי", [8, 300, 40, 6, 4, 1, 10]] }
    };
    // Agrippa's Latin numeration (II.20): the consonant I and V counted apart; W taken as the consonant V.
    var LATIN = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, K: 10, L: 20, M: 30, N: 40, O: 50, P: 60, Q: 70, R: 80, S: 90, T: 100, V: 200, X: 300, Y: 400, Z: 500, J: 600, U: 200, W: 700 };
    function latin(name) { return name.toUpperCase().replace(/[^A-Z]/g, "").split("").map(function (c) { return LATIN[c] || 0; }).filter(function (v) { return v; }); }
    function sum(a) { return a.reduce(function (s, v) { return s + v; }, 0); }
    // Every square is checked when the page loads: rows, columns, both diagonals, and the numbers 1 to n squared once each.
    function magic(sq) {
        var n = sq.length, want = sum(sq[0]), seen = {}, d1 = 0, d2 = 0;
        for (var i = 0; i < n; i++) {
            var row = 0, col = 0;
            for (var j = 0; j < n; j++) { row += sq[i][j]; col += sq[j][i]; seen[sq[i][j]] = (seen[sq[i][j]] || 0) + 1; }
            if (row !== want || col !== want) return false;
            d1 += sq[i][i]; d2 += sq[i][n - 1 - i];
        }
        if (d1 !== want || d2 !== want) return false;
        for (var v = 1; v <= n * n; v++) if (seen[v] !== 1) return false;
        return true;
    }
    var BROKEN = ORDER.filter(function (p) { return !magic(KAMEA[p]); });
    if (BROKEN.length && window.console) console.warn("talisman: squares with wrong sums: " + BROKEN.join(", "));

    // A number's cell: a value past the square is read with its last figure dropped until it fits.
    function cellOf(sq, v) {
        var n = sq.length;
        while (v > n * n) v = Math.floor(v / 10);
        if (v < 1) return null;
        for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (sq[r][c] === v) return [c, r];
        return null;
    }

    // ---- state ---------------------------------------------------------------------
    var planet = "Sun", show = { intelligence: true, spirit: false, name: true }, W = 0;
    function resize() { var r = stage.getBoundingClientRect(); W = Math.round(r.width); canvas.width = Math.round(W * DPR); canvas.height = Math.round(W * DPR); draw(); }

    function trace(sq, values, col, dash, width, cell, x0, y0) {
        var pts = [], last = null;
        values.forEach(function (v) { var c = cellOf(sq, v); if (!c) return; if (last && last[0] === c[0] && last[1] === c[1]) { pts.push({ x: x0 + (c[0] + 0.5) * cell, y: y0 + (c[1] + 0.5) * cell, loop: true }); return; } pts.push({ x: x0 + (c[0] + 0.5) * cell, y: y0 + (c[1] + 0.5) * cell }); last = c; });
        if (!pts.length) return;
        ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.shadowColor = col; ctx.shadowBlur = Math.min(10, cell * 0.18); ctx.setLineDash(dash ? [Math.min(12, cell * 0.14), Math.min(9, cell * 0.1)] : []);
        ctx.beginPath(); ctx.arc(pts[0].x, pts[0].y, cell * 0.12, 0, Math.PI * 2); ctx.stroke();              // the start: a ring
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (var i = 1; i < pts.length; i++) {
            if (pts[i].loop) { ctx.stroke(); ctx.beginPath(); ctx.arc(pts[i].x + cell * 0.1, pts[i].y - cell * 0.1, cell * 0.1, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); continue; }
            ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
        if (pts.length > 1) {                                                                               // the end: a bar across the way
            var a = pts[pts.length - 1], b = pts[pts.length - 2], dx = a.x - b.x, dy = a.y - b.y, L = Math.hypot(dx, dy) || 1;
            ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(a.x - dy / L * cell * 0.16, a.y + dx / L * cell * 0.16); ctx.lineTo(a.x + dy / L * cell * 0.16, a.y - dx / L * cell * 0.16); ctx.stroke();
        }
        ctx.restore();
    }
    function draw() {
        var sq = KAMEA[planet], n = sq.length;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, W);
        var pad = W * 0.09, side = W - pad * 2, cell = side / n, x0 = pad, y0 = pad;
        // the ring, the sign, the metal
        ctx.save(); ctx.strokeStyle = FAINT; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.arc(W / 2, W / 2, side / 2 * Math.SQRT2 + pad * 0.35, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        ctx.fillStyle = DIM; ctx.font = (pad * 0.5) + "px " + SERIF; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(SIGN[planet], W / 2, pad * 0.45);
        ctx.font = (pad * 0.28) + "px " + MONO; ctx.fillText(planet.toUpperCase() + " · " + n + " × " + n + " · " + sum(sq[0]) + " · " + sum([].concat.apply([], sq)), W / 2, W - pad * 0.45);
        // the grid
        ctx.strokeStyle = DIM; ctx.lineWidth = 1;
        for (var i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(x0 + i * cell, y0); ctx.lineTo(x0 + i * cell, y0 + side); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + side, y0 + i * cell); ctx.stroke(); }
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.strokeRect(x0, y0, side, side);
        // the numbers
        ctx.fillStyle = INK; ctx.globalAlpha = 0.8; ctx.font = Math.max(9, cell * 0.32) + "px " + MONO;
        for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) ctx.fillText(String(sq[r][c]), x0 + (c + 0.5) * cell, y0 + (r + 0.5) * cell);
        ctx.globalAlpha = 1;
        // the traces
        var N = NAMES[planet];
        var wide = Math.max(1.6, Math.min(3.2, cell * 0.06));
        if (show.intelligence && N.intelligence) trace(sq, N.intelligence[2], INK, false, wide, cell, x0, y0);
        if (show.spirit && N.spirit) trace(sq, N.spirit[2], INK, true, wide * 0.85, cell, x0, y0);
        var who = nameIn ? nameIn.value : "";
        if (show.name && who && latin(who).length) trace(sq, latin(who), AMBER, false, wide, cell, x0, y0);
        caption(who);
        if (saveLink) { try { saveLink.href = canvas.toDataURL("image/png"); saveLink.download = "talisman-" + planet.toLowerCase() + ".png"; } catch (e) { saveLink.hidden = true; } }
    }
    function caption(who) {
        if (!capOut) return;
        var sq = KAMEA[planet], n = sq.length, N = NAMES[planet], bits = [];
        bits.push("the square of " + planet + ", " + n + " by " + n + ": every row, column and diagonal " + sum(sq[0]) + ", the whole " + sum([].concat.apply([], sq)) + "; the metal is " + METAL[planet] + ".");
        if (show.intelligence && N.intelligence) bits.push("Solid: " + N.intelligence[0] + ", " + N.intelligence[1] + ", the intelligence, " + sum(N.intelligence[2]) + ".");
        if (show.intelligence && !N.intelligence) bits.push("The Moon's intelligence of intelligences has a name of five words and is not traced here.");
        if (show.spirit && N.spirit) bits.push("Dashed: " + N.spirit[0] + ", " + N.spirit[1] + ", the spirit, " + sum(N.spirit[2]) + ".");
        if (show.name && who && latin(who).length) bits.push("In the other ink: " + who.replace(/[<>&]/g, "") + ", " + latin(who).join(" + ") + " = " + sum(latin(who)) + " by Agrippa's Latin numeration, each number read on the square with its last figure dropped until it fits.");
        if (BROKEN.indexOf(planet) >= 0) bits.push("This square's sums do not agree, which is the transcriber's fault and not Agrippa's; tell the sysadmin.");
        capOut.textContent = bits.join(" ");
    }

    // ---- hands ---------------------------------------------------------------------
    function choose(p) {
        planet = p;
        if (planetsOut) planetsOut.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.planet === p)); });
        draw();
    }
    if (planetsOut) {
        planetsOut.innerHTML = ORDER.map(function (p) { return "<button type=\"button\" data-planet=\"" + p + "\" aria-pressed=\"false\">" + SIGN[p] + " " + p.toLowerCase() + "</button>"; }).join(" ");
        planetsOut.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) choose(b.dataset.planet); });
    }
    Object.keys(toggles).forEach(function (k) {
        var b = toggles[k]; if (!b) return;
        b.setAttribute("aria-pressed", String(show[k]));
        b.addEventListener("click", function () { show[k] = !show[k]; b.setAttribute("aria-pressed", String(show[k])); draw(); });
    });
    if (nameIn) nameIn.addEventListener("input", draw);
    addEventListener("resize", resize);
    // The hour's planet first, if the hours are in; the Sun otherwise.
    var h = window.Hours && window.Hours.now();
    planet = h ? h.planet : "Sun";
    resize(); choose(planet);
    window.Talisman = { KAMEA: KAMEA, NAMES: NAMES, latin: latin, cellOf: cellOf, choose: choose, draw: draw };
})();
