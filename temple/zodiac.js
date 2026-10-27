/* temple/zodiac.js: the wheel.
   The zodiac drawn as the astrologers draw it, the ascendant on the left
   and the signs going round against the clock, with the planets where
   js/zodiac.js puts them at the moment given (now, by default, and
   ticking), the Moon's phase in the middle, the horizon and the meridian
   across it, and the thirty-six decans ticked on the rim, each of which
   is a card of the tarot in the Golden Dawn's order; the reading under it
   says where everything stands and whose card it is. Tap a planet or a
   sign for more. The horizon is Portland's unless the page is told
   otherwise; nothing is stored or sent. One script, no library. */
(function () {
    "use strict";
    var Z = window.Zodiac, canvas = document.getElementById("zodiac-stage");
    if (!Z || !canvas) return;
    var ctx = canvas.getContext("2d"), stage = canvas.parentNode;
    var whenIn = document.getElementById("zodiac-when"), nowBtn = document.getElementById("zodiac-now"), turnBtn = document.getElementById("zodiac-turn");
    var readOut = document.getElementById("zodiac-reading"), cellOut = document.getElementById("zodiac-cell"), tableOut = document.getElementById("zodiac-table"), saveLink = document.getElementById("zodiac-save");
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace', SERIF = 'Georgia, "Times New Roman", serif';
    var INK = "#7cf5c8", DIM = "#2a5a4a", FAINT = "#163a2e", AMBER = "#ffb000", PAPER = "#020705", DPR = Math.min(2, window.devicePixelRatio || 1);
    var D = Math.PI / 180, W = 0, sky = null, live = true, standing = true, chosen = null, spots = [];
    var LAT = 45.52, LON = -122.68;
    var ELEMENT_INK = { Fire: "#ffb000", Earth: "#7cf5c8", Air: "#9ad0ff", Water: "#7f8cff" };

    function moment() { return live || !whenIn || !whenIn.value ? new Date() : new Date(whenIn.value); }
    function compute() { sky = Z.sky(moment(), LAT, LON); }
    function resize() { var r = stage.getBoundingClientRect(); W = Math.round(r.width); canvas.width = Math.round(W * DPR); canvas.height = Math.round(W * DPR); draw(); }
    function ref() { return standing ? sky.asc.lon : 0; }
    function angle(lon) { return Math.PI - (lon - ref()) * D; }
    function at(lon, r) { var a = angle(lon); return [W / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r]; }
    function slug(name) { return "card-" + name.toLowerCase().replace(/[^a-z]+/g, "-"); }
    function the(name) { return name === "Sun" || name === "Moon" ? "the " + name : name; }

    function draw() {
        if (!sky) compute();
        var R = W * 0.47, c = [W / 2, W / 2];
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, W);
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        // the rim: the signs, the decans, the degrees
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(c[0], c[1], R, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = DIM; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c[0], c[1], R * 0.86, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(c[0], c[1], R * 0.8, 0, Math.PI * 2); ctx.stroke();
        for (var g = 0; g < 360; g += 5) {
            var len = g % 30 === 0 ? 0.2 : g % 10 === 0 ? 0.06 : 0.03, p0 = at(g, R * 0.8), p1 = at(g, R * (0.8 + len));
            ctx.strokeStyle = g % 30 === 0 ? INK : g % 10 === 0 ? DIM : FAINT; ctx.lineWidth = g % 30 === 0 ? 1.5 : 1;
            ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
        }
        Z.SIGNS.forEach(function (s, i) {
            var p = at(i * 30 + 15, R * 0.93), hot = chosen && chosen.kind === "sign" && chosen.index === i;
            ctx.fillStyle = hot ? AMBER : ELEMENT_INK[s.element]; ctx.globalAlpha = hot ? 1 : 0.85; ctx.font = (R * 0.085) + "px " + SERIF; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(s.glyph, p[0], p[1]); ctx.globalAlpha = 1;
            // the decans' cards, as small numbers on the decan band
            for (var k = 0; k < 3; k++) {
                var d = Z.decan(i * 30 + k * 10), q = at(i * 30 + k * 10 + 5, R * 0.83);
                ctx.fillStyle = FAINT; ctx.font = (R * 0.03) + "px " + MONO; ctx.fillText(d.card.split(" ")[0].replace("Two", "2").replace("Three", "3").replace("Four", "4").replace("Five", "5").replace("Six", "6").replace("Seven", "7").replace("Eight", "8").replace("Nine", "9").replace("Ten", "10"), q[0], q[1]);
            }
        });
        // the horizon and the meridian, when the wheel stands as the sky does
        if (standing) {
            ctx.strokeStyle = DIM; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
            var a1 = at(sky.asc.lon, R * 0.78), a2 = at(sky.asc.lon + 180, R * 0.78), m1 = at(sky.mc.lon, R * 0.78), m2 = at(sky.mc.lon + 180, R * 0.78);
            ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(a2[0], a2[1]); ctx.moveTo(m1[0], m1[1]); ctx.lineTo(m2[0], m2[1]); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = DIM; ctx.font = (R * 0.04) + "px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            var la = at(sky.asc.lon, R * 0.72), lm = at(sky.mc.lon, R * 0.72);
            ctx.fillText("ASC", la[0], la[1]); ctx.fillText("MC", lm[0], lm[1]);
        }
        // the planets, nudged inward when they crowd
        spots = [];
        var bodies = sky.bodies.slice().sort(function (a, b) { return a.lon - b.lon; }), ring = [];
        bodies.forEach(function (b) {
            var r = 0.64, tries = 0;
            while (tries < 4 && ring.some(function (o) { return Math.abs(o.r - r) < 0.01 && Math.min(Z.rev(o.lon - b.lon), Z.rev(b.lon - o.lon)) < 8; })) { r -= 0.085; tries++; }
            ring.push({ lon: b.lon, r: r }); b.r = r;
        });
        bodies.forEach(function (b) {
            var p = at(b.lon, R * b.r), tick0 = at(b.lon, R * 0.78), tick1 = at(b.lon, R * 0.8), later = b.name === "Uranus" || b.name === "Neptune" || b.name === "Node";
            var hot = chosen && chosen.kind === "body" && chosen.name === b.name;
            ctx.strokeStyle = later ? FAINT : DIM; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(tick0[0], tick0[1]); ctx.lineTo(tick1[0], tick1[1]); ctx.stroke();
            ctx.fillStyle = hot ? AMBER : later ? DIM : INK; ctx.font = (later ? R * 0.07 : R * 0.09) + "px " + SERIF; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            if (!later) { ctx.shadowColor = INK; ctx.shadowBlur = 6; }
            ctx.fillText(b.glyph, p[0], p[1]); ctx.shadowBlur = 0;
            if (b.retrograde && b.name !== "Node") { ctx.font = (R * 0.035) + "px " + MONO; ctx.fillText("℞", p[0] + R * 0.05, p[1] + R * 0.04); }
            spots.push({ x: p[0], y: p[1], body: b });
        });
        // the Moon in the middle, lit as it is
        var r = R * 0.13, e = sky.elongation * D, waxing = sky.elongation < 180;
        ctx.save(); ctx.translate(c[0], c[1]);
        ctx.strokeStyle = DIM; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = INK; ctx.globalAlpha = 0.55; ctx.beginPath();
        var side = waxing ? 1 : -1;   // the lit limb is toward the Sun: right when waxing, left when waning, for the north
        ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, side < 0); ctx.ellipse(0, 0, Math.abs(Math.cos(e)) * r, r, 0, Math.PI / 2, -Math.PI / 2, (Math.cos(e) > 0) === (side > 0)); ctx.fill();
        ctx.globalAlpha = 1; ctx.restore();
        ctx.fillStyle = DIM; ctx.font = (R * 0.035) + "px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(sky.phase, c[0], c[1] + r + R * 0.05);
        var t = sky.date, stamp = t.getFullYear() + "-" + pad(t.getMonth() + 1) + "-" + pad(t.getDate()) + " " + pad(t.getHours()) + ":" + pad(t.getMinutes()) + (standing ? " · portland's horizon" : " · aries first");
        ctx.fillText(stamp, c[0], W - R * 0.03 - 8);
        if (saveLink) { try { saveLink.href = canvas.toDataURL("image/png"); } catch (err) { saveLink.hidden = true; } }
    }
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function cardLink(d) { return "<a href=\"/temple/tarot/#" + slug(d.card) + "\">" + esc(d.card) + "</a>, " + esc(d.title); }
    function line(b) {
        var d = b.decan, s = b.sign.sign;
        var t = "<b>" + b.glyph + " " + esc(the(b.name).replace(/^the /, "The ")) + "</b> at " + esc(Z.fmt(b.lon)) + (b.retrograde ? ", retrograde" : "") + (b.name === "Moon" ? ", " + sky.phase : "")
            + ": the " + ["first", "second", "third"][d.n - 1] + " decan, " + d.ruler + "'s, which is " + cardLink(d) + ".";
        if (b.trump) t += " Its own trump is <a href=\"/temple/tarot/#" + slug(b.trump) + "\">" + esc(b.trump) + "</a>";
        if (b.trump && s.ruler === b.name) t += "; it rules " + s.name;
        else if (b.trump && s.exalted === b.name) t += "; it is exalted in " + s.name;
        if (b.trump) t += ".";
        if (b.trump && Z.tone && Z.tone(b.name) != null) t += " Its note is <a href=\"" + Z.toneLink(Z.tone(b.name)) + "\">" + Z.NOTES[Z.tone(b.name)] + "</a>.";
        if (b.name === "Node") t = "<b>☊ The Node</b>, the dragon's head, at " + esc(Z.fmt(b.lon)) + ", moving backward; its tail opposite, at " + esc(Z.fmt(b.lon + 180)) + ". The geomancers' two figures are named for them.";
        if (b.name === "Uranus" || b.name === "Neptune") t = "<b>" + b.glyph + " " + b.name + "</b> at " + esc(Z.fmt(b.lon)) + (b.retrograde ? ", retrograde" : "") + ", in " + cardLink(d) + "; a later planet, with no trump of its own.";
        return t;
    }
    function reading() {
        if (!readOut) return;
        var out = [], h = window.Hours && window.Hours.now(moment());
        out.push("<p class=\"angles\">Rising at " + esc(standing || true ? "Portland" : "") + ", the ascendant, " + esc(Z.fmt(sky.asc.lon)) + ", which is " + cardLink(sky.asc.decan) + "; culminating, the midheaven, " + esc(Z.fmt(sky.mc.lon)) + ", " + cardLink(sky.mc.decan) + "."
            + (h ? " The hour is " + esc(the(h.planet)) + "'s, until " + esc(window.Hours.hm(h.end)) + "; its trump is <a href=\"/temple/tarot/#" + slug(Z.PLANETS[h.planet].trump) + "\">" + esc(Z.PLANETS[h.planet].trump) + "</a>." : "") + "</p>");
        out.push("<ul>" + sky.bodies.map(function (b) { return "<li>" + line(b) + "</li>"; }).join("") + "</ul>");
        readOut.innerHTML = out.join("");
    }
    function tell(what) {
        chosen = what; draw();
        if (!cellOut) return;
        if (!what) { cellOut.innerHTML = ""; return; }
        if (what.kind === "body") { cellOut.innerHTML = line(what.body); return; }
        var s = Z.SIGNS[what.index], decans = [0, 1, 2].map(function (k) { return Z.decan(what.index * 30 + k * 10); });
        var there = sky.bodies.filter(function (b) { return b.name !== "Node" && b.sign.index === what.index; }).map(function (b) { return the(b.name); });
        cellOut.innerHTML = "<b>" + s.glyph + " " + s.name + "</b>, " + s.quality + " " + s.element + ", ruled by " + esc(the(s.ruler)) + (s.exalted ? ", where " + esc(the(s.exalted)) + " is exalted" : "") + "; the letter " + s.letter + " and the trump <a href=\"/temple/tarot/#" + slug(s.trump) + "\">" + esc(s.trump) + "</a>; " + s.body + ". "
            + "Its decans: " + decans.map(function (d) { return d.ruler + ", " + cardLink(d); }).join("; ") + "."
            + (Z.tone ? " Its note is <a href=\"" + Z.toneLink(what.index) + "\">" + Z.NOTES[what.index] + "</a>, " + Z.TONE_COLOURS[what.index] + "." : "") + (there.length ? " " + there.join(" and ").replace(/^the/, "The") + (there.length > 1 ? " are" : " is") + " there now." : "");
    }
    // ---- the table of the signs, under the wheel ---------------------------------------------------
    function table() {
        if (!tableOut) return;
        var dates = Z.decanDates(new Date().getFullYear()), MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        function when(i) { var a = dates[i], b = dates[(i + 1) % 36]; return a && b ? MON[a.getUTCMonth()] + " " + a.getUTCDate() + "–" + MON[b.getUTCMonth()] + " " + b.getUTCDate() : ""; }
        tableOut.innerHTML = Z.SIGNS.map(function (s, i) {
            var decans = [0, 1, 2].map(function (k) { var d = Z.decan(i * 30 + k * 10); return "<li>" + esc(d.ruler) + " · " + cardLink(d) + " <span class=\"when\">" + when(d.index) + "</span></li>"; }).join("");
            return "<li id=\"sign-" + s.name.toLowerCase() + "\"><h3><span class=\"glyph\" style=\"color:" + ELEMENT_INK[s.element] + "\">" + s.glyph + "</span> " + s.name + "</h3><p>" + s.quality + " " + s.element + " · ruled by " + esc(the(s.ruler)) + (s.exalted ? " · " + esc(the(s.exalted)) + " exalted" : "") + " · " + s.letter + " · <a href=\"/temple/tarot/#" + slug(s.trump) + "\">" + esc(s.trump) + "</a> · " + s.body + "</p><ol class=\"decans\">" + decans + "</ol></li>";
        }).join("");
    }
    // ---- hands -------------------------------------------------------------------------------------
    canvas.addEventListener("click", function (e) {
        var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, R = W * 0.47;
        var hit = null, best = 22;
        spots.forEach(function (s) { var d = Math.hypot(s.x - x, s.y - y); if (d < best) { best = d; hit = s; } });
        if (hit) return tell({ kind: "body", name: hit.body.name, body: hit.body });
        var dx = x - W / 2, dy = y - W / 2, rad = Math.hypot(dx, dy);
        if (rad > R * 0.8 && rad < R * 1.02) { var lon = Z.rev(ref() + (Math.PI - Math.atan2(dy, dx)) / D); return tell({ kind: "sign", index: Math.floor(lon / 30) }); }
        tell(null);
    });
    function refresh() { compute(); draw(); reading(); if (chosen) tell(chosen); }
    if (whenIn) whenIn.addEventListener("input", function () { live = !whenIn.value; if (nowBtn) nowBtn.setAttribute("aria-pressed", String(live)); refresh(); });
    if (nowBtn) { nowBtn.setAttribute("aria-pressed", "true"); nowBtn.addEventListener("click", function () { live = true; if (whenIn) whenIn.value = ""; nowBtn.setAttribute("aria-pressed", "true"); refresh(); }); }
    if (turnBtn) { turnBtn.setAttribute("aria-pressed", String(standing)); turnBtn.addEventListener("click", function () { standing = !standing; turnBtn.setAttribute("aria-pressed", String(standing)); turnBtn.textContent = standing ? "as the sky stands" : "aries first"; draw(); }); }
    addEventListener("resize", resize);
    compute(); resize(); reading(); table();
    setInterval(function () { if (live) refresh(); }, 30000);
    window.Wheel = { sky: function () { return sky; }, draw: draw, tell: tell, refresh: refresh };
})();
