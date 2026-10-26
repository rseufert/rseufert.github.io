/* temple/table.js: the Great Table of the Watchtowers.
   Four tablets of twelve by thirteen letters, East, South, West and North,
   with the black cross (the Tablet of Union) between them: the table the
   angels gave Dee and Kelley at Cracow in June 1584 and reformed in April
   1587. Every letter here is rebuilt from the names Dee drew out of the
   table in his Tabula bonorum angelorum (the three Names of God along the
   middle row, the King in the centre, the six Seniors along the arms of the
   great cross, and in each of the four angles the Calvary cross's two
   names, the four kerubic letters above its arm and the sixteen servients
   below), checked so that every name reads back. The data is table.json;
   the letters can be shown in Dee's own characters. Walk it with the arrow
   keys or tap a cell, and the page says whose letter it is. One script. */
(function () {
    "use strict";
    var canvas = document.getElementById("table-stage");
    if (!canvas) return;
    var ctx = canvas.getContext("2d"), stage = canvas.parentNode;
    var views = document.getElementById("table-views"), cellOut = document.getElementById("table-cell"), glyphBtn = document.getElementById("table-glyphs");
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace';
    var INK = "#7cf5c8", MID = "#5ad2a4", DIM = "#2a5a4a", FAINT = "#163a2e", AMBER = "#ffb000", PAPER = "#020705", DPR = Math.min(2, window.devicePixelRatio || 1);
    var DATA = null, view = (window.innerWidth < 700) ? 0 : -1, glyphs = false, cur = { t: 0, r: 6, c: 5 }, W = 0, H = 0;
    var ANGLE = ["Air", "Water", "Earth", "Fire"], ANGLE_AT = [[0, 0], [0, 7], [7, 0], [7, 7]];

    // ---- what a cell is ----------------------------------------------------------
    function whose(t, r, c) {
        var T = DATA.tablets[t], out = [], ch = T.grid[r][c];
        if (r === 6) {
            var k = c < 3 ? 0 : c < 7 ? 1 : 2;
            out.push("in " + T.god[k] + ", the " + ["three", "four", "five"][k] + "-letter Name of God along the middle row (" + T.god.join(" ") + ")");
            if (c <= 6) out.push("in " + T.seniors[0] + ", the Senior read leftward from the centre");
            if (c >= 5) out.push("in " + T.seniors[3] + ", the Senior read rightward from the centre");
        }
        if (c === 5 && r <= 6) out.push("in " + T.seniors[1] + ", the Senior read upward on the left column of the cross");
        if (c === 6 && r <= 6) out.push("in " + T.seniors[2] + ", the Senior read upward on the right column of the cross");
        if (c === 6 && r >= 6) out.push("in " + T.seniors[4] + ", the Senior read downward on the right column of the cross");
        if (c === 5 && r >= 6) out.push("in " + T.seniors[5] + ", the Senior read downward on the left column of the cross");
        if ((r >= 5 && r <= 7 && (c === 5 || c === 6)) || (r === 6 && (c === 4 || c === 7))) out.push("one of the eight letters round the centre that spell the King, " + T.king + (T.king.length < 8 ? " (" + T.king + "H or L, Dee writes it both ways)" : ""));
        for (var a = 0; a < 4; a++) {
            var r0 = ANGLE_AT[a][0], c0 = ANGLE_AT[a][1], A = T.angles[a];
            if (r < r0 || r > r0 + 5 || c < c0 || c > c0 + 4) continue;
            var lr = r - r0, lc = c - c0, where = "the " + ANGLE[a] + " angle of the " + T.element + " tablet";
            if (lc === 2) out.push("in " + A.six + ", the six-letter name down the Calvary cross of " + where);
            if (lr === 1) out.push("in " + A.five + ", the five-letter name across the Calvary cross of " + where);
            if (lr === 0 && lc !== 2) out.push("a kerubic letter of " + where + ": " + A.kerub.toUpperCase() + ", which Dee heads with the black cross's " + A.union + " as " + A.union + A.kerub.toUpperCase() + ", and turns to make the four kerubs " + rotations(A.kerub).join(", "));
            if (lr >= 2 && lc !== 2) { var s = A.servients[lr - 2]; out.push("in " + s.toUpperCase() + ", a servient angel of " + where + " (with the cross's letter, " + (s.slice(0, 2) + A.six[lr] + s.slice(2)).toUpperCase() + ")"); }
        }
        return { ch: ch, parts: out };
    }
    function rotations(s) { var r = []; for (var i = 0; i < 4; i++) r.push((s.slice(i) + s.slice(0, i)).toUpperCase()); return r; }
    function kindOf(t, r, c) {
        if (r === 6 || c === 5 || c === 6) return "cross";
        for (var a = 0; a < 4; a++) { var r0 = ANGLE_AT[a][0], c0 = ANGLE_AT[a][1]; if (r >= r0 && r <= r0 + 5 && c >= c0 && c <= c0 + 4) { var lr = r - r0, lc = c - c0; if (lc === 2 || lr === 1) return "calvary"; if (lr === 0) return "kerub"; return "servient"; } }
        return "servient";
    }

    // ---- drawing -------------------------------------------------------------------
    function resize() { var r = stage.getBoundingClientRect(); W = Math.round(r.width); H = Math.round(r.height); canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); draw(); }
    function layout() {
        // the whole table is 25 by 27 cells (two tablets and the cross each way); one tablet is 12 by 13
        var cols = view < 0 ? 25 : 12, rows = view < 0 ? 27 : 13, cell = Math.min(W / cols, H / rows), x0 = (W - cell * cols) / 2, y0 = (H - cell * rows) / 2;
        return { cell: cell, x0: x0, y0: y0, cols: cols, rows: rows };
    }
    function cellAt(t, r, c, L) {
        var ox = 0, oy = 0;
        if (view < 0) { ox = (t === 1 || t === 3) ? 13 : 0; oy = (t === 2 || t === 3) ? 14 : 0; }
        return { x: L.x0 + (c + ox) * L.cell, y: L.y0 + (r + oy) * L.cell };
    }
    function letter(ch, x, y, size, col) {
        var E = window.EnochianLetters;
        if (glyphs && E) {
            var k = ch === "K" ? "C" : ch === "Y" || ch === "J" ? "I" : ch === "V" || ch === "W" ? "U" : ch;
            for (var i = 0; i < E.length; i++) if (E[i].latin === k) {
                ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, size * 0.08); ctx.lineCap = "round"; ctx.lineJoin = "round";
                E[i].s.forEach(function (poly) { ctx.beginPath(); poly.forEach(function (p, j) { if (j) ctx.lineTo(p[0] * size * 0.42, p[1] * size * 0.42); else ctx.moveTo(p[0] * size * 0.42, p[1] * size * 0.42); }); ctx.stroke(); });
                ctx.restore(); return;
            }
        }
        ctx.fillStyle = col; ctx.font = Math.max(7, size * 0.6) + "px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(ch, x, y + size * 0.03);
    }
    function draw() {
        if (!DATA) return;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
        var L = layout(), tabs = view < 0 ? [0, 1, 2, 3] : [view];
        // the black cross: the Tablet of Union, between the four
        if (view < 0) {
            ctx.fillStyle = "#000"; ctx.fillRect(L.x0 + 12 * L.cell, L.y0, L.cell, 27 * L.cell); ctx.fillRect(L.x0, L.y0 + 13 * L.cell, 25 * L.cell, L.cell);
            ctx.strokeStyle = DIM; ctx.lineWidth = 1; ctx.strokeRect(L.x0 + 12 * L.cell, L.y0, L.cell, 27 * L.cell); ctx.strokeRect(L.x0, L.y0 + 13 * L.cell, 25 * L.cell, L.cell);
            // EXARP HCOMA NANTA BITOM down the upright, read in the usual way
            DATA.union.forEach(function (w, i) { for (var k = 0; k < 5; k++) letter(w[k], L.x0 + 12.5 * L.cell, L.y0 + (i * 6 + k + 1.5) * L.cell + (i >= 2 ? L.cell : 0), L.cell, MID); });
            ctx.fillStyle = DIM; ctx.font = Math.max(8, L.cell * 0.55) + "px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText("E X A R P · H C O M A · N A N T A · B I T O M", L.x0 + 12.5 * L.cell, L.y0 + 13.5 * L.cell);
        }
        tabs.forEach(function (t) {
            var T = DATA.tablets[t];
            for (var r = 0; r < 13; r++) for (var c = 0; c < 12; c++) {
                var p = cellAt(t, r, c, L), kind = kindOf(t, r, c), on = (cur.t === t && cur.r === r && cur.c === c);
                ctx.strokeStyle = FAINT; ctx.lineWidth = 1; ctx.strokeRect(p.x + 0.5, p.y + 0.5, L.cell - 1, L.cell - 1);
                if (kind === "cross") { ctx.fillStyle = "rgba(124,245,200,0.07)"; ctx.fillRect(p.x, p.y, L.cell, L.cell); }
                else if (kind === "calvary") { ctx.fillStyle = "rgba(124,245,200,0.035)"; ctx.fillRect(p.x, p.y, L.cell, L.cell); }
                if (on) { ctx.save(); ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.shadowColor = AMBER; ctx.shadowBlur = 8; ctx.strokeRect(p.x + 1, p.y + 1, L.cell - 2, L.cell - 2); ctx.restore(); }
                letter(T.grid[r][c], p.x + L.cell / 2, p.y + L.cell / 2, L.cell, on ? AMBER : kind === "cross" ? INK : kind === "calvary" ? MID : kind === "kerub" ? "#8fe7c0" : "#4f9f84");
            }
            // the quarter, in the corner
            var q = cellAt(t, 0, 0, L); ctx.fillStyle = DIM; ctx.font = Math.max(8, L.cell * 0.5) + "px " + MONO; ctx.textAlign = "left"; ctx.textBaseline = "bottom";
            if (view >= 0) ctx.fillText(T.quarter.toUpperCase() + " · " + T.element.toUpperCase(), q.x, q.y - 2);
        });
        tell();
    }
    function tell() {
        if (!cellOut || !DATA) return;
        var T = DATA.tablets[cur.t], w = whose(cur.t, cur.r, cur.c), E = window.EnochianLetters, name = "";
        if (E) { var k = w.ch === "V" ? "U" : w.ch === "K" ? "C" : w.ch === "Y" ? "I" : w.ch; for (var i = 0; i < E.length; i++) if (E[i].latin === k) name = E[i].name; }
        cellOut.innerHTML = "<b>" + T.quarter + ", " + T.element.toLowerCase() + "</b> · row " + (cur.r + 1) + ", column " + (cur.c + 1) + " · the letter <b>" + w.ch + "</b>" + (name ? " (" + name + ")" : "") + ". " + (w.parts.length ? w.parts.map(function (p) { return p.charAt(0).toUpperCase() + p.slice(1); }).join("; ") + "." : "");
    }

    // ---- hands ---------------------------------------------------------------------
    function pick(ev) {
        var r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top, L = layout();
        var gc = Math.floor((x - L.x0) / L.cell), gr = Math.floor((y - L.y0) / L.cell);
        if (gc < 0 || gr < 0 || gc >= L.cols || gr >= L.rows) return;
        if (view >= 0) { cur = { t: view, r: gr, c: gc }; draw(); return; }
        if (gc === 12 || gr === 13) return;
        var t = (gc > 12 ? 1 : 0) + (gr > 13 ? 2 : 0);
        cur = { t: t, r: gr > 13 ? gr - 14 : gr, c: gc > 12 ? gc - 13 : gc }; draw();
    }
    canvas.addEventListener("click", pick);
    document.addEventListener("keydown", function (ev) {
        if (ev.target && /^(input|textarea|select)$/i.test(ev.target.tagName)) return;
        var k = ev.key, moved = true;
        if (k === "ArrowLeft") { if (cur.c > 0) cur.c--; else if (view < 0 && (cur.t === 1 || cur.t === 3)) { cur.t--; cur.c = 11; } }
        else if (k === "ArrowRight") { if (cur.c < 11) cur.c++; else if (view < 0 && (cur.t === 0 || cur.t === 2)) { cur.t++; cur.c = 0; } }
        else if (k === "ArrowUp") { if (cur.r > 0) cur.r--; else if (view < 0 && cur.t >= 2) { cur.t -= 2; cur.r = 12; } }
        else if (k === "ArrowDown") { if (cur.r < 12) cur.r++; else if (view < 0 && cur.t < 2) { cur.t += 2; cur.r = 0; } }
        else moved = false;
        if (moved) { ev.preventDefault(); if (view >= 0) view = cur.t; draw(); }
    });
    function setView(v) {
        view = v; stage.classList.toggle("one", v >= 0);
        if (v >= 0) cur.t = v;
        if (views) views.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(+b.dataset.view === v)); });
        resize();
    }
    if (views) views.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) setView(+b.dataset.view); });
    if (glyphBtn) glyphBtn.addEventListener("click", function () { glyphs = !glyphs; glyphBtn.setAttribute("aria-pressed", String(glyphs)); draw(); });
    addEventListener("resize", resize);
    fetch("/temple/table.json").then(function (r) { return r.json(); }).then(function (d) {
        DATA = d;
        if (views) views.innerHTML = "<button type=\"button\" data-view=\"-1\">the whole table</button> " + d.tablets.map(function (T, i) { return "<button type=\"button\" data-view=\"" + i + "\">" + T.quarter.toLowerCase() + " · " + T.element.toLowerCase() + "</button>"; }).join(" ");
        setView(view);
        window.GreatTable = { data: d, whose: whose, go: function (t, r, c) { cur = { t: t, r: r, c: c }; draw(); } };
    }).catch(function () { if (cellOut) cellOut.textContent = "the table did not load."; });
})();
