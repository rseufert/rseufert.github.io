/* temple/daimon.js: the daimon.
   The guardian spirit the old astrologers found in a birth chart. Give
   the page a moment and a place and it erects the figure with js/zodiac.js,
   finds the five hylegiacal places (the Sun, the Moon, the ascendant, the
   Lot of Fortune and the syzygy before the birth), weighs every planet's
   dignities over them the way Ibn Ezra did (house 5, exaltation 4,
   triplicity 3, term 2, face 1) to find the lord of the geniture, which
   Porphyry called the lady of the nativity and Agrippa the daimon of the
   nativity, and then spells the genius's name by Agrippa's rule (Three
   Books, III.26): the twenty-two Hebrew letters cast round the zodiac a
   degree each, and the letters that fall on the five places read off in
   order with El on the end. The wheel draws the five places on the ring
   of letters and joins them, which is the name as a sigil. Nothing is
   stored or sent; the figure lives in the address so it can be kept. */
(function () {
    "use strict";
    var Z = window.Zodiac, canvas = document.getElementById("daimon-stage");
    if (!Z || !canvas) return;
    var ctx = canvas.getContext("2d"), stage = canvas.parentNode;
    var whenIn = document.getElementById("daimon-when"), zoneIn = document.getElementById("daimon-zone"), latIn = document.getElementById("daimon-lat"), lonIn = document.getElementById("daimon-lon");
    var hereBtn = document.getElementById("daimon-here"), nowBtn = document.getElementById("daimon-now");
    var readOut = document.getElementById("daimon-reading"), tableOut = document.getElementById("daimon-table"), nameOut = document.getElementById("daimon-name"), saveLink = document.getElementById("daimon-save");
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace', SERIF = 'Georgia, "Times New Roman", serif', HEBREW = '"SBL Hebrew", "Times New Roman", "Arial Hebrew", serif';
    var INK = "#7cf5c8", DIM = "#2a5a4a", FAINT = "#163a2e", AMBER = "#ffb000", PALE = "#ffe9b0", PAPER = "#020705", DPR = Math.min(2, window.devicePixelRatio || 1);
    var ELEMENT_INK = { Fire: "#ffb000", Earth: "#7cf5c8", Air: "#9ad0ff", Water: "#7f8cff" };
    var D = Math.PI / 180, W = 0, fig = null;
    var SEVEN = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"];

    // ---- the tables -----------------------------------------------------------------------------------
    // The Dorothean triplicity rulers: by day, by night, and the one who shares.
    var TRIPLICITY = { Fire: ["Sun", "Jupiter", "Saturn"], Earth: ["Venus", "Moon", "Mars"], Air: ["Saturn", "Mercury", "Jupiter"], Water: ["Venus", "Mars", "Moon"] };
    // The Egyptian terms, as Ptolemy gives them (Tetrabiblos I.21): each planet to the degree its term ends at.
    var TERMS = [
        [["Jupiter", 6], ["Venus", 12], ["Mercury", 20], ["Mars", 25], ["Saturn", 30]],
        [["Venus", 8], ["Mercury", 14], ["Jupiter", 22], ["Saturn", 27], ["Mars", 30]],
        [["Mercury", 6], ["Jupiter", 12], ["Venus", 17], ["Mars", 24], ["Saturn", 30]],
        [["Mars", 7], ["Venus", 13], ["Mercury", 19], ["Jupiter", 26], ["Saturn", 30]],
        [["Jupiter", 6], ["Venus", 11], ["Saturn", 18], ["Mercury", 24], ["Mars", 30]],
        [["Mercury", 7], ["Venus", 17], ["Jupiter", 21], ["Mars", 28], ["Saturn", 30]],
        [["Saturn", 6], ["Mercury", 14], ["Jupiter", 21], ["Venus", 28], ["Mars", 30]],
        [["Mars", 7], ["Venus", 11], ["Mercury", 19], ["Jupiter", 24], ["Saturn", 30]],
        [["Jupiter", 12], ["Venus", 17], ["Mercury", 21], ["Saturn", 26], ["Mars", 30]],
        [["Mercury", 7], ["Jupiter", 14], ["Venus", 22], ["Saturn", 26], ["Mars", 30]],
        [["Mercury", 7], ["Venus", 13], ["Jupiter", 20], ["Mars", 25], ["Saturn", 30]],
        [["Venus", 12], ["Jupiter", 16], ["Mercury", 19], ["Mars", 28], ["Saturn", 30]]
    ];
    var POINTS = { house: 5, exaltation: 4, triplicity: 3, term: 2, face: 1 };
    // The twenty-two letters, each with the sound it lends a name.
    var HEB = [["א", "Aleph", "a"], ["ב", "Beth", "b"], ["ג", "Gimel", "g"], ["ד", "Daleth", "d"], ["ה", "He", "h"], ["ו", "Vav", "v"], ["ז", "Zayin", "z"], ["ח", "Cheth", "ch"],
        ["ט", "Teth", "t"], ["י", "Yod", "i"], ["כ", "Kaph", "k"], ["ל", "Lamed", "l"], ["מ", "Mem", "m"], ["נ", "Nun", "n"], ["ס", "Samekh", "s"], ["ע", "Ayin", "o"],
        ["פ", "Pe", "p"], ["צ", "Tzaddi", "tz"], ["ק", "Qoph", "q"], ["ר", "Resh", "r"], ["ש", "Shin", "sh"], ["ת", "Tav", "th"]];

    function the(name) { return name === "Sun" || name === "Moon" ? "the " + name : name; }
    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function slug(name) { return "card-" + name.toLowerCase().replace(/[^a-z]+/g, "-"); }
    function term(lon) { var p = Z.signOf(lon), t = TERMS[p.index]; for (var i = 0; i < t.length; i++) if (p.deg < t[i][1]) return t[i][0]; return t[4][0]; }
    // Every dignity a degree gives, and to whom.
    function dignities(lon, day) {
        var s = Z.signOf(lon).sign, out = [{ planet: s.ruler, kind: "house" }];
        if (s.exalted) out.push({ planet: s.exalted, kind: "exaltation" });
        out.push({ planet: TRIPLICITY[s.element][day ? 0 : 1], kind: "triplicity" });
        out.push({ planet: term(lon), kind: "term" });
        out.push({ planet: Z.decan(lon).ruler, kind: "face" });
        out.forEach(function (d) { d.points = POINTS[d.kind]; });
        return out;
    }

    // ---- the figure -----------------------------------------------------------------------------------
    function elong(t) { var L = Z.longitudes(t); return Z.rev(L.Moon.lon - L.Sun.lon); }
    // The new or full Moon before the birth: stepped back six hours at a time until the elongation crosses, then bisected.
    function syzygy(date, day) {
        var t1 = date.getTime(), f1 = Math.sin(elong(new Date(t1)) * D), t0 = t1, f0 = f1, step = 6 * 3600e3;
        for (var i = 0; i < 140; i++) { t0 = t1 - step; f0 = Math.sin(elong(new Date(t0)) * D); if (f0 === 0 || f0 * f1 < 0) break; t1 = t0; f1 = f0; }
        for (var k = 0; k < 40; k++) { var tm = (t0 + t1) / 2, fm = Math.sin(elong(new Date(tm)) * D); if (fm * f0 <= 0) { t1 = tm; f1 = fm; } else { t0 = tm; f0 = fm; } }
        var when = new Date((t0 + t1) / 2), L = Z.longitudes(when), full = Math.cos(elong(when) * D) < 0;
        return { when: when, full: full, lon: full ? (day ? L.Sun.lon : L.Moon.lon) : L.Sun.lon };
    }
    function figure(date, lat, lon) {
        var sky = Z.sky(date, lat, lon), by = {};
        sky.bodies.forEach(function (b) { by[b.name] = b; });
        var asc = sky.asc.lon, sun = by.Sun.lon, moon = by.Moon.lon;
        var day = Z.rev(sun - asc) > 180;                           // the Sun above the horizon: a day birth
        var fortune = day ? Z.rev(asc + moon - sun) : Z.rev(asc + sun - moon);
        var spirit = day ? Z.rev(asc + sun - moon) : Z.rev(asc + moon - sun);
        var syz = syzygy(date, day);
        var places = [
            { key: "Sun", name: "the Sun", glyph: "☉", lon: sun }, { key: "Moon", name: "the Moon", glyph: "☽", lon: moon },
            { key: "Asc", name: "the ascendant", glyph: "ASC", lon: asc }, { key: "Fortune", name: "the Lot of Fortune", glyph: "⊗", lon: fortune },
            { key: "Syzygy", name: "the " + (syz.full ? "full" : "new") + " Moon before", glyph: syz.full ? "☍" : "☌", lon: syz.lon }
        ];
        if (!day) places.splice(0, 2, places[1], places[0]);        // by night the Moon leads
        var score = {}; SEVEN.forEach(function (p) { score[p] = 0; });
        places.forEach(function (p) {
            p.dignities = dignities(p.lon, day);
            p.cells = {}; SEVEN.forEach(function (q) { p.cells[q] = []; });
            p.dignities.forEach(function (d) { p.cells[d.planet].push(d); score[d.planet] += d.points; });
            var best = null; SEVEN.forEach(function (q) { var s = p.cells[q].reduce(function (a, d) { return a + d.points; }, 0); if (!best || s > best.s) best = { planet: q, s: s }; });
            p.almuten = best.planet;
        });
        var ranked = SEVEN.slice().sort(function (a, b) { return score[b] - score[a] || SEVEN.indexOf(a) - SEVEN.indexOf(b); });
        var lord = ranked[0], tied = ranked.filter(function (p) { return score[p] === score[lord] && p !== lord; });
        // Firmicus's other way: the planet whose house the Moon goes into next.
        var next = Z.SIGNS[(Z.signOf(moon).index + 1) % 12].ruler;
        // The names. The good genius: the letters at the five places, cast from the first of Aries.
        var good = places.map(function (p) { return Math.floor(p.lon) % 22; });
        // Its contrary: the opposite points, the letters cast backward from the last degree of Pisces.
        var evil = places.map(function (p) { return (359 - Math.floor(Z.rev(p.lon + 180))) % 22; });
        // The Hebrews' way: the almutens of the five places, in order of their dignity, the letters cast from the ascendant.
        var almutens = []; places.forEach(function (p) { if (almutens.indexOf(p.almuten) < 0) almutens.push(p.almuten); });
        almutens.sort(function (a, b) { return score[b] - score[a] || SEVEN.indexOf(a) - SEVEN.indexOf(b); });
        var hebrews = almutens.map(function (p) { return Math.floor(Z.rev(by[p].lon - asc)) % 22; });
        return { date: date, lat: lat, lon: lon, sky: sky, by: by, day: day, asc: asc, mc: sky.mc.lon, fortune: fortune, spirit: spirit, syz: syz, places: places,
            score: score, ranked: ranked, lord: lord, tied: tied, next: next, almutens: almutens,
            names: { good: spell(good), evil: spell(evil), hebrews: spell(hebrews) }, letters: { good: good, evil: evil, hebrews: hebrews } };
    }
    // Letters into a name: a vowel between consonants that have none, and El on the end, as Agrippa says the custom is.
    function spell(idx) {
        var heb = "", rom = "", vowelLast = true;
        idx.forEach(function (i, k) { var s = HEB[i][2], v = /^[aio]$/.test(s); heb += HEB[i][0]; if (k && !vowelLast && !v) rom += "a"; rom += s; vowelLast = v; });
        return { heb: heb + "אל", rom: cap(rom + (vowelLast ? "el" : "ael")), letters: idx.map(function (i) { return HEB[i][1]; }) };
    }

    // ---- the moment and the place -----------------------------------------------------------------------
    function localOffset(d) { return -d.getTimezoneOffset() / 60; }
    function stamp(d, zone) { var t = new Date(d.getTime() + zone * 3600e3); return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate()) + "T" + pad(t.getUTCHours()) + ":" + pad(t.getUTCMinutes()); }
    function readInputs() {
        var now = new Date(), zone = zoneIn && zoneIn.value !== "" ? parseFloat(zoneIn.value) : localOffset(now);
        var date = now;
        if (whenIn && whenIn.value) { var m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)/.exec(whenIn.value); if (m) date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - zone * 3600e3); }
        var lat = latIn && latIn.value !== "" ? parseFloat(latIn.value) : 45.52, lon = lonIn && lonIn.value !== "" ? parseFloat(lonIn.value) : -122.68;
        if (!isFinite(lat) || Math.abs(lat) > 89) lat = 45.52; if (!isFinite(lon) || Math.abs(lon) > 180) lon = -122.68;
        return { date: date, zone: zone, lat: lat, lon: lon, live: !(whenIn && whenIn.value) };
    }
    function fillInputs(date, zone, lat, lon) {
        if (whenIn) whenIn.value = stamp(date, zone); if (zoneIn) zoneIn.value = String(zone);
        if (latIn) latIn.value = String(Math.round(lat * 100) / 100); if (lonIn) lonIn.value = String(Math.round(lon * 100) / 100);
    }
    function keep(inp) { // the figure in the address, so it can be kept or sent, and nothing else is
        if (!history.replaceState) return;
        var h = inp.live ? "" : "#when=" + stamp(inp.date, inp.zone) + "&zone=" + inp.zone + "&lat=" + Math.round(inp.lat * 100) / 100 + "&lon=" + Math.round(inp.lon * 100) / 100;
        history.replaceState(null, "", location.pathname + location.search + h);
    }
    function fromHash() {
        var q = {}; location.hash.slice(1).split("&").forEach(function (kv) { var p = kv.split("="); if (p[0]) q[p[0]] = decodeURIComponent(p[1] || ""); });
        if (!q.when) return false;
        if (whenIn) whenIn.value = q.when; if (zoneIn && q.zone) zoneIn.value = q.zone; if (latIn && q.lat) latIn.value = q.lat; if (lonIn && q.lon) lonIn.value = q.lon;
        return true;
    }

    // ---- the drawing ----------------------------------------------------------------------------------
    function angle(lon) { return Math.PI - (lon - fig.asc) * D; }
    function at(lon, r) { var a = angle(lon); return [W / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r]; }
    function lotMark(p, r, spirit) {
        ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        if (spirit) { ctx.moveTo(p[0], p[1] - r); ctx.lineTo(p[0], p[1] + r); }
        else { var k = r * 0.7071; ctx.moveTo(p[0] - k, p[1] - k); ctx.lineTo(p[0] + k, p[1] + k); ctx.moveTo(p[0] + k, p[1] - k); ctx.lineTo(p[0] - k, p[1] + k); }
        ctx.stroke();
    }
    function draw() {
        var R = W * 0.44, c = [W / 2, W / 2], i;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, W);
        ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        // the ring of letters: the alphabet goes round sixteen times and eight letters over, a degree each, from the first of Aries
        for (i = 0; i < 360; i += 22) {
            ctx.fillStyle = (i / 22) % 2 ? FAINT : "#0d2620"; ctx.globalAlpha = 0.9;
            ctx.beginPath(); ctx.arc(c[0], c[1], R, angle(i), angle(Math.min(360, i + 22)), true); ctx.arc(c[0], c[1], R * 0.9, angle(Math.min(360, i + 22)), angle(i), false); ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = 1;
        for (i = 0; i < 360; i++) {
            var p0 = at(i, R * 0.9), p1 = at(i, R * (i % 30 === 0 ? 1 : i % 10 === 0 ? 0.95 : 0.92));
            ctx.strokeStyle = i % 30 === 0 ? INK : i % 10 === 0 ? DIM : "#1d3a32"; ctx.lineWidth = i % 30 === 0 ? 1.5 : 1;
            ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke();
        }
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(c[0], c[1], R, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = DIM; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c[0], c[1], R * 0.9, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(c[0], c[1], R * 0.74, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(c[0], c[1], R * 0.4, 0, Math.PI * 2); ctx.stroke();
        // the signs
        Z.SIGNS.forEach(function (s, k) {
            var p = at(k * 30 + 15, R * 0.82);
            ctx.fillStyle = ELEMENT_INK[s.element]; ctx.globalAlpha = 0.85; ctx.font = (R * 0.085) + "px " + SERIF; ctx.fillText(s.glyph, p[0], p[1]); ctx.globalAlpha = 1;
            var q0 = at(k * 30, R * 0.74), q1 = at(k * 30, R * 0.9);
            ctx.strokeStyle = FAINT; ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.stroke();
        });
        // the horizon and the meridian
        ctx.strokeStyle = DIM; ctx.setLineDash([4, 6]);
        var h0 = at(fig.asc, R * 0.74), h1 = at(fig.asc + 180, R * 0.74), m0 = at(fig.mc, R * 0.74), m1 = at(fig.mc + 180, R * 0.74);
        ctx.beginPath(); ctx.moveTo(h0[0], h0[1]); ctx.lineTo(h1[0], h1[1]); ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = DIM; ctx.font = (R * 0.045) + "px " + MONO; ctx.fillText("ASC", h0[0] - R * 0.07, h0[1] - R * 0.04); ctx.fillText("MC", m0[0] + R * 0.06, m0[1] + R * 0.04);
        // the seven, and the two lots
        SEVEN.forEach(function (name) {
            var b = fig.by[name], p = at(b.lon, R * 0.6), hot = name === fig.lord;
            ctx.fillStyle = hot ? AMBER : INK; ctx.font = (hot ? R * 0.11 : R * 0.085) + "px " + SERIF; ctx.fillText(b.glyph, p[0], p[1]);
            if (b.retrograde) { ctx.fillStyle = DIM; ctx.font = (R * 0.035) + "px " + MONO; ctx.fillText("R", p[0] + R * 0.05, p[1] - R * 0.045); }
            var t0 = at(b.lon, R * 0.72), t1 = at(b.lon, R * 0.74); ctx.strokeStyle = hot ? AMBER : INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]); ctx.stroke();
        });
        ctx.strokeStyle = INK; ctx.lineWidth = 1.2; lotMark(at(fig.fortune, R * 0.6), R * 0.03, false);
        ctx.strokeStyle = AMBER; lotMark(at(fig.spirit, R * 0.6), R * 0.03, true);
        ctx.fillStyle = DIM; ctx.font = (R * 0.035) + "px " + MONO; var sp = at(fig.spirit, R * 0.52); ctx.fillText("SPIRIT", sp[0], sp[1]);
        // the five places on the ring of letters, their letters, and the name traced through them
        var pts = fig.places.map(function (p) { return at(p.lon, R * 0.95); });
        ctx.strokeStyle = AMBER; ctx.lineWidth = 1.5; ctx.shadowColor = AMBER; ctx.shadowBlur = 8; ctx.globalAlpha = 0.9;
        ctx.beginPath(); pts.forEach(function (p, k) { if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke();
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], R * 0.022, 0, Math.PI * 2); ctx.stroke();       // the name begins with a ring
        var e = pts[pts.length - 1], ep = pts[pts.length - 2], ea = Math.atan2(e[1] - ep[1], e[0] - ep[0]) + Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(e[0] + Math.cos(ea) * R * 0.025, e[1] + Math.sin(ea) * R * 0.025); ctx.lineTo(e[0] - Math.cos(ea) * R * 0.025, e[1] - Math.sin(ea) * R * 0.025); ctx.stroke();   // and ends with a bar
        fig.places.forEach(function (p, k) {
            var q = pts[k];
            ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(q[0], q[1], R * 0.012, 0, Math.PI * 2); ctx.fill();
            var lp = at(p.lon, R * 1.08); ctx.fillStyle = PALE; ctx.font = (R * 0.075) + "px " + HEBREW; ctx.fillText(HEB[fig.letters.good[k]][0], lp[0], lp[1]);
            ctx.fillStyle = DIM; ctx.font = (R * 0.032) + "px " + MONO; var gl = at(p.lon, R * 0.87); ctx.fillText(p.glyph, gl[0], gl[1]);
        });
        // the lord of the geniture in the middle, and the name
        var lord = fig.by[fig.lord];
        ctx.fillStyle = AMBER; ctx.font = (R * 0.26) + "px " + SERIF; ctx.fillText(lord.glyph, c[0], c[1] - R * 0.08);
        ctx.fillStyle = PALE; ctx.font = (R * 0.11) + "px " + HEBREW; ctx.fillText(fig.names.good.heb, c[0], c[1] + R * 0.14);
        ctx.fillStyle = INK; ctx.font = (R * 0.045) + "px " + MONO; ctx.fillText(fig.names.good.rom.toUpperCase(), c[0], c[1] + R * 0.25);
        ctx.fillStyle = DIM; ctx.font = (R * 0.032) + "px " + MONO; ctx.fillText((fig.day ? "A DAY BIRTH" : "A NIGHT BIRTH") + " · " + the(fig.lord).toUpperCase() + " RULES", c[0], c[1] + R * 0.32);
        if (saveLink) { try { saveLink.href = canvas.toDataURL("image/png"); } catch (err) { saveLink.hidden = true; } }
    }
    function resize() { var r = stage.getBoundingClientRect(); W = Math.round(r.width); canvas.width = Math.round(W * DPR); canvas.height = Math.round(W * DPR); if (fig) draw(); }

    // ---- the reading ----------------------------------------------------------------------------------
    function when(d, zone) { var t = new Date(d.getTime() + zone * 3600e3); return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate()) + " " + pad(t.getUTCHours()) + ":" + pad(t.getUTCMinutes()); }
    function cardLink(lon) { var d = Z.decan(lon); return "<a href=\"/temple/tarot/#" + slug(d.card) + "\">" + esc(d.card) + "</a>"; }
    function trumpLink(planet) { var t = Z.PLANETS[planet].trump; return "<a href=\"/temple/tarot/#" + slug(t) + "\">" + esc(t) + "</a>"; }
    function noteLink(planet) { return Z.tone && Z.tone(planet) != null ? "<a href=\"" + Z.toneLink(Z.tone(planet)) + "\">" + Z.NOTES[Z.tone(planet)] + "</a>" : ""; }
    function placeLine(p) {
        var d = p.dignities.map(function (x) { return x.kind + " " + the(x.planet); });
        return "<li><b>" + esc(p.glyph === "ASC" ? "ASC" : p.glyph) + " " + esc(cap(p.name)) + "</b> at " + esc(Z.fmt(p.lon)) + (p.key === "Syzygy" ? ", on " + esc(when(fig.syz.when, inputs.zone)) : "")
            + ": " + d.join(", ") + "; the place's almuten is " + esc(the(p.almuten)) + ", and its letter " + HEB[fig.letters.good[fig.places.indexOf(p)]][1] + ".</li>";
    }
    var inputs = null;
    function reading() {
        if (!readOut) return;
        var f = fig, L = f.by[f.lord], out = [];
        out.push("<p class=\"angles\">" + (f.day ? "A day birth" : "A night birth") + ", " + esc(when(f.date, inputs.zone)) + " at " + (inputs.zone >= 0 ? "+" : "") + inputs.zone + " from UTC, latitude " + f.lat + ", longitude " + f.lon
            + ". The ascendant " + esc(Z.fmt(f.asc)) + ", the midheaven " + esc(Z.fmt(f.mc)) + "; the Lot of Fortune " + esc(Z.fmt(f.fortune)) + " and the Lot of Spirit, the daimon's own lot, " + esc(Z.fmt(f.spirit))
            + ", in " + esc(Z.signOf(f.spirit).sign.ruler === "Sun" || Z.signOf(f.spirit).sign.ruler === "Moon" ? "the " + Z.signOf(f.spirit).sign.ruler + "'s" : Z.signOf(f.spirit).sign.ruler + "'s") + " sign and the decan of " + cardLink(f.spirit) + ".</p>");
        out.push("<h3>The five places</h3><ul>" + f.places.map(placeLine).join("") + "</ul>");
        out.push("<h3>The lord of the geniture</h3><p><b>" + esc(L.glyph + " " + the(f.lord).replace(/^the /, "The ")) + "</b>, with " + f.score[f.lord] + " points over the five places"
            + (f.tied.length ? ", tied with " + f.tied.map(the).join(" and ") + ", which the old rule breaks by the planet's own condition in the chart; here the Chaldean order breaks it" : "")
            + ". This is what Porphyry called the lady of the nativity and Agrippa the daimon of the nativity: the planet whose spirit the chart is most in debt to. "
            + esc(cap(the(f.lord))) + " stands at " + esc(Z.fmt(L.lon)) + (L.retrograde ? ", retrograde" : "") + ", in the decan of " + cardLink(L.lon) + "; its own trump is " + trumpLink(f.lord) + ", its letter " + esc(Z.PLANETS[f.lord].letter)
            + (noteLink(f.lord) ? ", its note " + noteLink(f.lord) : "") + ". Firmicus Maternus allowed another way, the planet whose house the Moon enters next: that is " + esc(the(f.next)) + ".</p>");
        var n = f.names;
        out.push("<h3>The name</h3><p>By Agrippa's rule the twenty-two letters are cast round the zodiac a degree each from the first of Aries, Aleph at the first degree, and the letters that fall on the five places, taken in their order, "
            + "make the name of the good genius, with El on the end: <b class=\"heb\" lang=\"he\">" + n.good.heb + "</b>, " + n.good.letters.join(" ") + ", which may be said <b>" + esc(n.good.rom) + "</b>. "
            + "The Hebrews, he says, took instead the almutens of the places, " + f.almutens.map(the).join(", ") + ", in order of their dignity, and cast the letters from the degree of the ascendant: <b class=\"heb\" lang=\"he\">" + n.hebrews.heb + "</b>, " + esc(n.hebrews.rom) + ". "
            + "And the contrary spirit, which he gives for completeness and not for use, is read from the points opposite the five, the letters cast backward from the last degree of Pisces: <span class=\"heb\" lang=\"he\">" + n.evil.heb + "</span>, " + esc(n.evil.rom)
            + ". The wheel joins the five places on the ring of letters, which is the first name drawn as a sigil.</p>");
        readOut.innerHTML = out.join("");
        if (nameOut) nameOut.innerHTML = "<span class=\"heb\" lang=\"he\">" + n.good.heb + "</span> <span class=\"rom\">" + esc(n.good.rom) + "</span> <span class=\"lord\">· " + esc(L.glyph) + " " + esc(the(f.lord)) + "</span>";
        table();
    }
    function table() {
        if (!tableOut) return;
        var f = fig, head = "<tr><th>planet</th>" + f.places.map(function (p) { return "<th title=\"" + esc(p.name) + "\">" + esc(p.glyph) + "</th>"; }).join("") + "<th>all</th></tr>";
        var rows = f.ranked.map(function (q) {
            var cells = f.places.map(function (p) { var ds = p.cells[q], s = ds.reduce(function (a, d) { return a + d.points; }, 0); return "<td title=\"" + esc(ds.map(function (d) { return d.kind; }).join(", ") || "nothing") + "\">" + (s || "·") + "</td>"; }).join("");
            return "<tr" + (q === f.lord ? " class=\"lord\"" : "") + "><th>" + esc(f.by[q].glyph + " " + the(q)) + "</th>" + cells + "<td>" + f.score[q] + "</td></tr>";
        }).join("");
        tableOut.innerHTML = "<table class=\"almuten\"><caption>house 5 · exaltation 4 · triplicity 3 · term 2 · face 1, over " + f.places.map(function (p) { return p.glyph; }).join(" ") + "</caption>" + head + rows + "</table>";
    }

    // ---- hands ----------------------------------------------------------------------------------------
    function refresh() {
        inputs = readInputs();
        fig = figure(inputs.date, inputs.lat, inputs.lon);
        keep(inputs); draw(); reading();
    }
    [whenIn, zoneIn, latIn, lonIn].forEach(function (el) { if (el) el.addEventListener("change", refresh); });
    if (nowBtn) nowBtn.addEventListener("click", function () { var now = new Date(); fillInputs(now, localOffset(now), inputs ? inputs.lat : 45.52, inputs ? inputs.lon : -122.68); refresh(); });
    if (hereBtn) hereBtn.addEventListener("click", function () {
        if (!navigator.geolocation) { hereBtn.textContent = "no way to ask"; return; }
        hereBtn.textContent = "asking…";
        navigator.geolocation.getCurrentPosition(function (pos) { if (latIn) latIn.value = String(Math.round(pos.coords.latitude * 100) / 100); if (lonIn) lonIn.value = String(Math.round(pos.coords.longitude * 100) / 100); hereBtn.textContent = "where I am"; refresh(); },
            function () { hereBtn.textContent = "not told"; setTimeout(function () { hereBtn.textContent = "where I am"; }, 2500); }, { timeout: 8000 });
    });
    addEventListener("resize", resize);
    if (!fromHash()) { var now = new Date(); fillInputs(now, localOffset(now), 45.52, -122.68); }
    else if (zoneIn && zoneIn.value === "") zoneIn.value = String(localOffset(new Date()));
    refresh(); resize();
    window.Daimon = { figure: figure, dignities: dignities, term: term, syzygy: syzygy, spell: spell, HEB: HEB, TERMS: TERMS, TRIPLICITY: TRIPLICITY, get fig() { return fig; } };
})();
