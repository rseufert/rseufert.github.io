/* temple/enochian.js: the angelic alphabet.
   The twenty-one letters Dee and Kelley received in 1583, as Dee drew them
   in Sloane 3188 with their names and their Latin values, redrawn here as
   stroke skeletons in the temple's line: approximately, after his hand,
   which was quick. Type and the canvas writes it in the letters, right to
   left as Dee's tables are written, or left to right if you ask; tap a
   letter in the table for its name. Nothing stored or sent. One script. */
(function () {
    "use strict";
    var canvas = document.getElementById("enochian-stage");
    if (!canvas) return;
    var ctx = canvas.getContext("2d"), stage = canvas.parentNode;
    var input = document.getElementById("enochian-text"), tableOut = document.getElementById("enochian-table"), nameOut = document.getElementById("enochian-name");
    var dirBtn = document.getElementById("enochian-dir"), saveLink = document.getElementById("enochian-save");
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace';
    var INK = "#7cf5c8", DIM = "#2a5a4a", FAINT = "#163a2e", PAPER = "#020705", DPR = Math.min(2, window.devicePixelRatio || 1);

    // The letters in Dee's order, each a few strokes in a box from -1 to 1, y down.
    function arcPts(cx, cy, r, a0, a1) { var p = [], n = 10; for (var i = 0; i <= n; i++) { var a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; }
    var LETTERS = [
        { name: "Pa", latin: "B", s: [[[-0.9, -0.7], [-0.3, 0.9], [0.4, -0.5]], [[0.4, -0.5], [0.9, -0.9], [0.9, -0.3], [0.5, -0.1]]] },
        { name: "Veh", latin: "C", s: [[[-0.4, -0.9], [-0.4, 0.9]], [[-0.4, 0.1], [0.5, -0.8]], [[-0.1, -0.2], [0.7, 0.8]]] },
        { name: "Ged", latin: "G", s: [[[-0.9, -0.8], [-0.7, 0.5], [0.0, 0.9], [0.7, 0.5], [0.9, -0.2]], [[0.9, -0.2], [0.6, -0.9]]] },
        { name: "Gal", latin: "D", s: [[[-0.8, -0.5], [0.9, 0.9]], [[0.7, -0.9], [-0.1, 0.2], [-0.9, -0.1]]] },
        { name: "Or", latin: "F", s: [[[-0.9, -0.8], [0.9, -0.8], [0.1, 0.9]], [[-0.3, 0.1], [0.7, 0.1]], [[-0.9, -0.8], [-0.9, -0.3]]] },
        { name: "Un", latin: "A", s: [[[-0.9, -0.9], [0.9, 0.9]], [[0.9, -0.9], [-0.9, 0.9]], [[-0.9, -0.9], [-0.5, -0.9], [-0.5, -0.4]]] },
        { name: "Graph", latin: "E", s: [[[-0.9, -0.9], [0.9, -0.9], [0.9, 0.9]], [[-0.3, -0.9], [-0.3, 0.4], [-0.6, 0.4]]] },
        { name: "Tal", latin: "M", s: [[[-0.7, -0.9], [-0.7, 0.3], [0.5, 0.3]], [[0.5, -0.9], [0.5, 0.9]]] },
        { name: "Gon", latin: "I", s: [[[-0.8, -0.7], [0.8, -0.7], [0.1, 0.1], [-0.8, 0.1]], [[-0.8, 0.1], [0.7, 0.9]]] },
        { name: "Na", latin: "H", s: [[[-0.9, 0.3], [-0.6, -0.4], [-0.2, 0.3], [0.2, -0.4], [0.6, 0.3], [0.9, -0.2]]] },
        { name: "Ur", latin: "L", s: [[[-0.8, -0.9], [0.8, -0.9]], [[0, -0.9], [0, 0.9]], [[-0.8, 0.9], [0.8, 0.9]], [[-0.5, 0], [0.5, 0]]] },
        { name: "Mals", latin: "P", s: [[[-0.9, 0.9], [-0.9, 0.1]].concat(arcPts(0, 0.1, 0.9, 180, 360)).concat([[0.9, 0.9]])] },
        { name: "Ger", latin: "Q", s: [[[-0.9, -0.5], [-0.5, 0.8], [0.4, 0.8], [0.9, -0.5]], [[-0.9, -0.5], [-0.6, -0.9]]] },
        { name: "Drux", latin: "N", s: [[[0.9, -0.9], [-0.5, -0.9], [-0.5, 0.9], [0.9, 0.9]], [[-0.5, 0], [0.5, 0]]] },
        { name: "Pal", latin: "X", s: [[[-0.8, 0.9], [-0.8, -0.9], [0.9, -0.9]], [[-0.8, 0.1], [0.4, 0.1]]] },
        { name: "Med", latin: "O", s: [[[-0.4, 0.9], [0.9, 0.9]], [[-0.4, 0.9], [-0.4, -0.5]].concat(arcPts(-0.1, -0.5, 0.3, 180, 360)).concat([[0.2, -0.2]])] },
        { name: "Don", latin: "R", s: [arcPts(0.1, 0, 0.9, 40, 320)] },
        { name: "Ceph", latin: "Z", s: [[[-0.6, 0.9], [-0.6, -0.9]], [[-0.6, -0.7]].concat(arcPts(-0.1, -0.2, 0.5, 270, 450)).concat([[-0.6, 0.3]])] },
        { name: "Van", latin: "U", s: [[[-0.9, -0.8], [0.9, 0.8]], [[0.9, -0.8], [-0.9, 0.8]], [[0.9, -0.8], [0.9, -0.3]]] },
        { name: "Fam", latin: "S", s: [[[-0.7, -0.9], [0.7, -0.9], [0.0, 0.9]], [[0.7, -0.9], [0.9, -0.5]]] },
        { name: "Gisg", latin: "T", s: [[[-0.9, 0.0], [-0.5, -0.5], [-0.1, 0.0], [0.3, 0.5], [0.9, 0.0]], [[0.9, 0.0], [0.9, 0.5]]] }
    ];
    // Latin to the letter: Dee's values, with the usual doublings; letters without one are skipped.
    var BY = {};
    LETTERS.forEach(function (l, i) { BY[l.latin] = i; });
    var ALIAS = { K: "C", Y: "I", J: "I", V: "U", W: "U" };
    function lettersOf(text) {
        var out = [];
        text.toUpperCase().split("").forEach(function (ch) {
            if (ch === " ") { out.push(null); return; }
            var k = ALIAS[ch] || ch;
            if (BY[k] != null) out.push(BY[k]);
        });
        return out;
    }

    var rtl = true, W = 0, H = 0;
    function resize() { var r = stage.getBoundingClientRect(); W = Math.round(r.width); H = Math.round(r.height); canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); draw(); }
    function glyph(i, x, y, s, col, width) {
        var L = LETTERS[i];
        ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.lineWidth = width; ctx.lineCap = "round"; ctx.lineJoin = "round";
        L.s.forEach(function (poly) { ctx.beginPath(); poly.forEach(function (p, k) { if (k) ctx.lineTo(p[0] * s, p[1] * s); else ctx.moveTo(p[0] * s, p[1] * s); }); ctx.stroke(); });
        ctx.restore();
    }
    function draw() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
        var seq = lettersOf(input ? input.value : ""), pad = 18;
        if (!seq.length) {
            ctx.fillStyle = DIM; ctx.font = "14px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(rtl ? "type, and it is written right to left, as dee's tables are." : "type, and it is written left to right.", W / 2, H / 2);
            return;
        }
        // lay the letters out in lines that fit, each letter a cell; a space is a half cell
        var cell = Math.min(56, Math.max(26, (W - pad * 2) / 14)), lines = [[]], width = 0;
        seq.forEach(function (i) { var w = i == null ? cell * 0.5 : cell; if (width + w > W - pad * 2 && lines[lines.length - 1].length) { lines.push([]); width = 0; } lines[lines.length - 1].push(i); width += w; });
        var lh = cell * 1.5, y0 = H / 2 - (lines.length - 1) * lh / 2;
        ctx.shadowColor = INK; ctx.shadowBlur = 8;
        lines.forEach(function (line, li) {
            var w = 0; line.forEach(function (i) { w += i == null ? cell * 0.5 : cell; });
            var x = rtl ? W / 2 + w / 2 : W / 2 - w / 2;
            line.forEach(function (i) {
                var cw = i == null ? cell * 0.5 : cell;
                if (rtl) x -= cw;
                if (i != null) glyph(i, x + cw / 2, y0 + li * lh, cell * 0.38, INK, Math.max(1.6, cell * 0.06));
                if (!rtl) x += cw;
            });
        });
        ctx.shadowBlur = 0;
        if (saveLink) { try { saveLink.href = canvas.toDataURL("image/png"); } catch (e) { saveLink.hidden = true; } }
    }
    // the table of the alphabet: a small canvas a letter
    if (tableOut) {
        LETTERS.forEach(function (L, i) {
            var b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", L.name + ", " + L.latin);
            var c = document.createElement("canvas"); c.width = 72 * DPR; c.height = 72 * DPR; c.style.width = "72px"; c.style.height = "72px";
            var g = c.getContext("2d"); g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = PAPER; g.fillRect(0, 0, 72, 72);
            var keep = ctx; ctx = g; glyph(i, 36, 32, 20, INK, 1.8); ctx = keep;
            var cap = document.createElement("span"); cap.textContent = L.latin.toLowerCase() + " · " + L.name.toLowerCase();
            b.appendChild(c); b.appendChild(cap);
            b.addEventListener("click", function () { if (nameOut) nameOut.textContent = L.name + ": Dee's " + L.latin + (ALIAS_NOTE[L.latin] || "") + ". the " + ordinal(i + 1) + " of the twenty-one, in the order he received them."; if (input) { input.value += L.latin.toLowerCase(); draw(); } });
            tableOut.appendChild(b);
        });
    }
    var ALIAS_NOTE = { C: " (and K)", I: " (and Y, J)", U: " (and V, W)" };
    function ordinal(n) { return n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"); }
    if (input) input.addEventListener("input", draw);
    if (dirBtn) dirBtn.addEventListener("click", function () { rtl = !rtl; dirBtn.textContent = rtl ? "right to left" : "left to right"; dirBtn.setAttribute("aria-pressed", String(rtl)); draw(); });
    addEventListener("resize", resize);
    resize();
    window.Enochian = { LETTERS: LETTERS, lettersOf: lettersOf, draw: draw };
})();
