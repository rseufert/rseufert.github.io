/* temple/neck.js: the neck.
   A fretboard with every note on it, in any tuning: standard by default,
   the common others to choose, each string turned a semitone at a time,
   and your own kept. A scale over it (C major to start; the modes, the
   minors, the pentatonics, the symmetrical and the exotic ones, or your
   own from twelve toggles), a chord over that (the common ones, the
   scale's own, or your own), with shapes for the chord found on the neck
   and played. The temple's part is Paul Foster Case's tone scale, which
   lays the twelve notes on the twelve signs from C at Aries, the planets
   and the three elements on the notes of their trumps, each with its
   colour: so a note is a sign, a trump and a letter, and the sky this
   minute (js/zodiac.js) is a chord, and the planetary hour (js/hours.js)
   a key. Your tunings, scales, chords and settings are kept in this
   browser (localStorage temple-neck) and nowhere else. One script, no
   library. */
(function () {
    "use strict";
    var canvas = document.getElementById("neck-stage");
    if (!canvas) return;
    var ctx = canvas.getContext("2d"), stage = canvas.parentNode;
    var Z = window.Zodiac, H = window.Hours;
    var $ = function (id) { return document.getElementById(id); };
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace', HEB = '"SBL Hebrew", "Arial Hebrew", "Times New Roman", serif';
    var INK = "#7cf5c8", DIM = "#2a5a4a", FAINT = "#1f4a3c", AMBER = "#ffb000", PAPER = "#020705", BOARD = "#06120d", STRING = "#4d7d6a";
    var DPR = Math.min(2, window.devicePixelRatio || 1);

    // ---- notes and spelling --------------------------------------------------------------------------
    var LETTERS = ["C", "D", "E", "F", "G", "A", "B"], NAT = [0, 2, 4, 5, 7, 9, 11];
    var SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
    var FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
    var INT = ["1", "♭2", "2", "♭3", "3", "4", "♭5", "5", "♭6", "6", "♭7", "7"];
    function mod(a, n) { return ((a % n) + n) % n; }
    function acc(a) { return a === 0 ? "" : a > 0 ? "♯♯".slice(0, a) : "♭♭".slice(0, -a); }
    // A formula's label ("♭3", "♯11", "♭♭7") to its semitones above the root and its degree.
    function parse(label) {
        var m = /^([♭♯b#]*)(\d+)$/.exec(label.trim());
        if (!m) return null;
        var a = 0; for (var i = 0; i < m[1].length; i++) a += (m[1][i] === "♭" || m[1][i] === "b") ? -1 : 1;
        var n = parseInt(m[2], 10), k = (n - 1) % 7;
        return { label: label.trim(), deg: n, step: k, semis: NAT[k] + 12 * Math.floor((n - 1) / 7) + a };
    }
    function formula(str) { return str.split(/\s+/).map(parse).filter(Boolean); }
    function letterOf(name) { return LETTERS.indexOf(name[0]); }
    // Spell a set of formula tones over a root spelled as `rootName`: each degree takes the next letter.
    function spell(rootName, tones) {
        var L = letterOf(rootName), r = mod(NAT[L] + (rootName.length > 1 ? (rootName[1] === "♯" ? rootName.length - 1 : -(rootName.length - 1)) : 0), 12);
        return tones.map(function (t) {
            var letter = (L + t.step) % 7, pc = mod(r + t.semis, 12), a = mod(pc - NAT[letter] + 6, 12) - 6;
            return { pc: pc, name: Math.abs(a) > 2 ? null : LETTERS[letter] + acc(a) };
        });
    }
    function accidentals(sp) { return sp.reduce(function (n, s) { return n + (s.name ? s.name.length - 1 : 9); }, 0); }
    // The better spelling of a root and set: whichever of the sharp and flat names writes fewer accidentals.
    function bestSpelling(pc, tones, pref) {
        var a = spell(SHARP[pc], tones), b = spell(FLAT[pc], tones);
        if (pref === "sharps") return { root: SHARP[pc], notes: a };
        if (pref === "flats") return { root: FLAT[pc], notes: b };
        var na = accidentals(a), nb = accidentals(b);
        if (na < nb || (na === nb && [10, 3, 8, 1].indexOf(pc) < 0)) return { root: SHARP[pc], notes: a };
        return { root: FLAT[pc], notes: b };
    }

    // ---- the tables --------------------------------------------------------------------------------
    var TUNINGS = [
        ["Standard", [40, 45, 50, 55, 59, 64]], ["Half step down", [39, 44, 49, 54, 58, 63]], ["Whole step down", [38, 43, 48, 53, 57, 62]],
        ["Drop D", [38, 45, 50, 55, 59, 64]], ["Double drop D", [38, 45, 50, 55, 59, 62]], ["Drop C", [36, 43, 48, 53, 57, 62]],
        ["DADGAD", [38, 45, 50, 55, 57, 62]], ["Open D", [38, 45, 50, 54, 57, 62]], ["Open D minor", [38, 45, 50, 53, 57, 62]],
        ["Open G", [38, 43, 50, 55, 59, 62]], ["Open E", [40, 47, 52, 56, 59, 64]], ["Open A", [40, 45, 52, 57, 61, 64]],
        ["Open C", [36, 43, 48, 55, 60, 64]], ["All fourths", [40, 45, 50, 55, 60, 65]], ["New standard (Fripp)", [36, 43, 50, 57, 64, 67]],
        ["Seven-string", [35, 40, 45, 50, 55, 59, 64]], ["Baritone", [35, 40, 45, 50, 54, 59]],
        ["Bass, four", [28, 33, 38, 43]], ["Bass, five", [23, 28, 33, 38, 43]], ["Ukulele", [67, 60, 64, 69]], ["Mandolin", [55, 62, 69, 76]]
    ];
    var SCALES = [
        ["the modes", [["major", "Major (Ionian)", "1 2 3 4 5 6 7"], ["dorian", "Dorian", "1 2 ♭3 4 5 6 ♭7"], ["phrygian", "Phrygian", "1 ♭2 ♭3 4 5 ♭6 ♭7"],
            ["lydian", "Lydian", "1 2 3 ♯4 5 6 7"], ["mixolydian", "Mixolydian", "1 2 3 4 5 6 ♭7"], ["minor", "Natural minor (Aeolian)", "1 2 ♭3 4 5 ♭6 ♭7"],
            ["locrian", "Locrian", "1 ♭2 ♭3 4 ♭5 ♭6 ♭7"]]],
        ["the minors and their modes", [["harmonic", "Harmonic minor", "1 2 ♭3 4 5 ♭6 7"], ["melodic", "Melodic minor", "1 2 ♭3 4 5 6 7"],
            ["phrygdom", "Phrygian dominant", "1 ♭2 3 4 5 ♭6 ♭7"], ["lyddom", "Lydian dominant", "1 2 3 ♯4 5 6 ♭7"], ["altered", "Altered", "1 ♭2 ♯2 3 ♭5 ♭6 ♭7"]]],
        ["pentatonic and blues", [["majpent", "Major pentatonic", "1 2 3 5 6"], ["minpent", "Minor pentatonic", "1 ♭3 4 5 ♭7"],
            ["blues", "Blues", "1 ♭3 4 ♭5 5 ♭7"], ["majblues", "Major blues", "1 2 ♭3 3 5 6"], ["bebop", "Bebop dominant", "1 2 3 4 5 6 ♭7 7"]]],
        ["symmetrical", [["whole", "Whole tone", "1 2 3 ♯4 ♯5 ♭7"], ["hw", "Diminished (half-whole)", "1 ♭2 ♭3 3 ♯4 5 6 ♭7"],
            ["wh", "Diminished (whole-half)", "1 2 ♭3 4 ♭5 ♭6 6 7"], ["chromatic", "Chromatic", "1 ♭2 2 ♭3 3 4 ♭5 5 ♭6 6 ♭7 7"]]],
        ["further off", [["dblharm", "Double harmonic", "1 ♭2 3 4 5 ♭6 7"], ["hungarian", "Hungarian minor", "1 2 ♭3 ♯4 5 ♭6 7"],
            ["neapolitan", "Neapolitan minor", "1 ♭2 ♭3 4 5 ♭6 7"], ["hirajoshi", "Hirajōshi", "1 2 ♭3 5 ♭6"], ["insen", "In sen", "1 ♭2 4 5 ♭7"]]]
    ];
    var CHORDS = [
        ["triads", [["maj", "", "major", "1 3 5"], ["min", "m", "minor", "1 ♭3 5"], ["dim", "°", "diminished", "1 ♭3 ♭5"], ["aug", "+", "augmented", "1 3 ♯5"],
            ["sus2", "sus2", "suspended second", "1 2 5"], ["sus4", "sus4", "suspended fourth", "1 4 5"], ["five", "5", "power chord", "1 5"]]],
        ["sixths and sevenths", [["six", "6", "sixth", "1 3 5 6"], ["m6", "m6", "minor sixth", "1 ♭3 5 6"], ["dom7", "7", "dominant seventh", "1 3 5 ♭7"],
            ["maj7", "maj7", "major seventh", "1 3 5 7"], ["m7", "m7", "minor seventh", "1 ♭3 5 ♭7"], ["mmaj7", "m(maj7)", "minor major seventh", "1 ♭3 5 7"],
            ["m7b5", "m7♭5", "half-diminished", "1 ♭3 ♭5 ♭7"], ["dim7", "°7", "diminished seventh", "1 ♭3 ♭5 ♭♭7"], ["sev4", "7sus4", "seventh, suspended fourth", "1 4 5 ♭7"],
            ["aug7", "7♯5", "augmented seventh", "1 3 ♯5 ♭7"], ["sev5", "7♭5", "seventh, flat fifth", "1 3 ♭5 ♭7"]]],
        ["added and extended", [["add9", "add9", "added ninth", "1 3 5 9"], ["madd9", "m(add9)", "minor, added ninth", "1 ♭3 5 9"], ["sixnine", "6/9", "six-nine", "1 3 5 6 9"],
            ["nine", "9", "ninth", "1 3 5 ♭7 9"], ["maj9", "maj9", "major ninth", "1 3 5 7 9"], ["m9", "m9", "minor ninth", "1 ♭3 5 ♭7 9"],
            ["eleven", "11", "eleventh", "1 3 5 ♭7 9 11"], ["m11", "m11", "minor eleventh", "1 ♭3 5 ♭7 9 11"], ["thirteen", "13", "thirteenth", "1 3 5 ♭7 9 13"],
            ["sevfl9", "7♭9", "seventh, flat ninth", "1 3 5 ♭7 ♭9"], ["sevsh9", "7♯9", "seventh, sharp ninth", "1 3 5 ♭7 ♯9"]]]
    ];
    var SCALE = {}, CHORD = {};
    SCALES.forEach(function (g) { g[1].forEach(function (s) { SCALE[s[0]] = { id: s[0], name: s[1], f: s[2] }; }); });
    CHORDS.forEach(function (g) { g[1].forEach(function (c) { CHORD[c[0]] = { id: c[0], sym: c[1], name: c[2], f: c[3] }; }); });

    // Case's tone scale: the chromatic scale laid on the zodiac from C at Aries, and the planets and elements on the notes of their trumps.
    var COLOUR = [["red", "#ff4a3d"], ["red-orange", "#ff6f2a"], ["orange", "#ff9a1f"], ["orange-yellow", "#ffc21a"], ["yellow", "#ffe82e"], ["yellow-green", "#b9e83a"],
        ["green", "#3ed47a"], ["green-blue", "#2ccdb4"], ["blue", "#4f8dff"], ["blue-violet", "#8a7dff"], ["violet", "#b06cff"], ["violet-red", "#ee4fa6"]];
    var PLANET_NOTE = { Mars: 0, Sun: 2, Mercury: 4, Venus: 6, Moon: 8, Saturn: 9, Jupiter: 10 };
    var ELEMENT_NOTE = { Fire: 0, Air: 4, Water: 8 };
    var ELEMENT_GLYPH = { Fire: "△", Air: "🜁", Water: "▽" };
    var HEBREW = { Aleph: "א", Beth: "ב", Gimel: "ג", Daleth: "ד", Heh: "ה", Vav: "ו", Zayin: "ז", Cheth: "ח", Teth: "ט", Yod: "י", Kaph: "כ", Lamed: "ל",
        Mem: "מ", Nun: "נ", Samekh: "ס", Ayin: "ע", Peh: "פ", Tzaddi: "צ", Qoph: "ק", Resh: "ר", Shin: "ש", Tav: "ת" };
    var SIGNS = Z ? Z.SIGNS : [];
    function slug(card) { return "card-" + card.toLowerCase().replace(/[^a-z]+/g, "-"); }
    function cardLink(card) { return "<a href=\"/temple/tarot/#" + slug(card) + "\">" + card + "</a>"; }
    // Everything that stands on a note: its sign, and any planet or element.
    function onNote(pc) {
        var out = [];
        if (SIGNS[pc]) out.push({ glyph: SIGNS[pc].glyph, name: SIGNS[pc].name, trump: SIGNS[pc].trump, letter: SIGNS[pc].letter });
        Object.keys(PLANET_NOTE).forEach(function (p) { if (PLANET_NOTE[p] === pc && Z) out.push({ glyph: Z.PLANETS[p].glyph, name: p === "Sun" || p === "Moon" ? "the " + p : p, trump: Z.PLANETS[p].trump, letter: Z.PLANETS[p].letter }); });
        Object.keys(ELEMENT_NOTE).forEach(function (e) { if (ELEMENT_NOTE[e] === pc && Z) out.push({ glyph: ELEMENT_GLYPH[e], name: e, trump: Z.ELEMENTS[e].trump, letter: Z.ELEMENTS[e].letter }); });
        return out;
    }

    // ---- the state, kept in this browser --------------------------------------------------------------
    var KEY = "temple-neck";
    var S = { tuning: TUNINGS[0][1].slice(), tuningName: "Standard", frets: 22, root: 0, scale: "major", chordRoot: null, chord: null,
        labels: "names", colours: false, spelling: "auto", flip: false, faint: true, mine: { tunings: {}, scales: {}, chords: {} } };
    try { var saved = JSON.parse(localStorage.getItem(KEY)); if (saved && typeof saved === "object") Object.keys(S).forEach(function (k) { if (saved[k] !== undefined) S[k] = saved[k]; }); } catch (e) { /* a fresh neck */ }
    ["tunings", "scales", "chords"].forEach(function (k) { if (!S.mine || typeof S.mine !== "object") S.mine = {}; if (!S.mine[k]) S.mine[k] = {}; });
    if (!Array.isArray(S.tuning) || !S.tuning.length) S.tuning = TUNINGS[0][1].slice();
    var sky = null;   // the sky's chord, when asked for: not kept
    if (S.chord === "sky") { S.chord = null; S.chordRoot = null; }
    function keep() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* a visit's worth */ } }

    function scaleDef(id) { var k = String(id).slice(5);
        return SCALE[id] || (id.indexOf("mine:") === 0 && S.mine.scales[k] && { id: id, name: k, f: S.mine.scales[k], mine: true }) || SCALE.major; }
    function chordDef(id) {
        if (!id) return null;
        if (id === "sky" && sky) return sky;
        var k = String(id).slice(5);
        return CHORD[id] || (id.indexOf("mine:") === 0 && S.mine.chords[k] && { id: id, sym: " " + k, name: k, f: S.mine.chords[k], mine: true }) || null;
    }
    // What is lit: the scale spelled, the chord spelled, each a map from pitch class to name and label.
    var view = null;
    function compute() {
        var sd = scaleDef(S.scale), st = formula(sd.f), sp = bestSpelling(S.root, st, S.spelling);
        var scale = {}; st.forEach(function (t, i) {
            var pc = sp.notes[i].pc; if (scale[pc]) return;
            scale[pc] = { name: sp.notes[i].name, label: t.label, deg: i };
        });
        var usesFlats = S.spelling === "flats" || (S.spelling === "auto" && (sp.root.indexOf("♭") > 0 || Object.keys(scale).some(function (pc) { return (scale[pc].name || "").indexOf("♭") > 0; })));
        var names = (usesFlats ? FLAT : SHARP).slice();
        Object.keys(scale).forEach(function (pc) { if (scale[pc].name) names[pc] = scale[pc].name; });
        var cd = chordDef(S.chord), chord = null, chordName = "";
        if (cd) {
            var cr = S.chordRoot == null ? S.root : S.chordRoot, ct = formula(cd.f);
            var crName = scale[cr] && scale[cr].name ? scale[cr].name : names[cr];
            var csp = spell(crName, ct); chord = {};
            ct.forEach(function (t, i) { var pc = csp[i].pc; if (!chord[pc]) chord[pc] = { name: cd.id === "sky" ? names[pc] : csp[i].name || names[pc], label: t.label, root: t.semis === 0 }; });
            chordName = cd.id === "sky" ? "the sky" : crName + cd.sym;
        }
        view = { sd: sd, st: st, rootName: sp.root, scale: scale, names: names, cd: cd, chord: chord, chordName: chordName,
            chordRoot: S.chordRoot == null ? S.root : S.chordRoot };
        shapesFound = cd ? findShapes() : [];
        if (shapeAt >= shapesFound.length) shapeAt = 0;
    }

    // ---- the neck's geometry -----------------------------------------------------------------------
    var G = null, hover = null, sounding = {}, shapesFound = [], shapeAt = 0;
    function along(k, N) { return 0.45 * (k / N) + 0.55 * (1 - Math.pow(2, -k / 12)) / (1 - Math.pow(2, -N / 12)); }
    function layout() {
        var w = stage.clientWidth || 800, n = S.tuning.length, N = S.frets, vertical = w < 640, g = {};
        g.w = w; g.n = n; g.N = N; g.vertical = vertical;
        if (!vertical) {
            g.gap = Math.max(24, Math.min(34, 300 / n));
            g.label = 46; g.open = 34; g.padT = 12; g.padB = 30;
            g.boardA = g.label + g.open; g.boardB = w - 12;
            g.across0 = g.padT; g.across1 = g.padT + n * g.gap;
            g.h = g.across1 + g.padB;
        } else {
            g.gap = Math.max(30, Math.min(48, (w - 64) / n));
            var bw = g.gap * n; g.across0 = Math.round((w - bw) / 2) + 10; g.across1 = g.across0 + bw;
            g.label = 26; g.open = 34; g.boardA = g.label + g.open; g.boardB = g.boardA + N * 40; g.h = g.boardB + 14;
        }
        g.line = function (k) { return g.boardA + along(k, N) * (g.boardB - g.boardA); };
        g.mid = function (f) { return f === 0 ? g.boardA - g.open / 2 : (g.line(f - 1) + g.line(f)) / 2; };
        // string i counts from the lowest; across the board the highest is on top, or on the right when the neck stands up
        g.str = function (i) { return vertical ? g.across0 + g.gap / 2 + i * g.gap : g.across0 + g.gap / 2 + (n - 1 - i) * g.gap; };
        g.xy = function (a, c) {   // along-the-neck and across-the-neck to the page
            if (vertical) return { x: c, y: a };
            return { x: S.flip ? w - a : a, y: c };
        };
        g.pos = function (i, f) { return g.xy(g.mid(f), g.str(i)); };
        var narrow = g.line(N) - g.line(N - 1);
        g.r = Math.max(7, Math.min(13, Math.min(g.gap, narrow + 6) * 0.4));
        return g;
    }
    function resize() {
        G = layout();
        canvas.style.height = G.h + "px";
        canvas.width = Math.round(G.w * DPR); canvas.height = Math.round(G.h * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        draw();
    }

    // ---- drawing -----------------------------------------------------------------------------------
    function labelFor(pc, midi) {
        var c = view.chord && view.chord[pc], s = view.scale[pc], name = (c && c.name) || (s && s.name) || view.names[pc];
        switch (S.labels) {
            case "pitch": return name + (Math.floor(midi / 12) - 1);
            case "intervals": return c ? c.label : s ? s.label : INT[mod(pc - S.root, 12)];
            case "signs": return SIGNS[pc] ? SIGNS[pc].glyph : name;
            case "letters": return SIGNS[pc] ? HEBREW[SIGNS[pc].letter] : name;
            default: return name;
        }
    }
    function rectAlong(a0, a1, c0, c1, fill) {
        var p = G.xy(a0, c0), q = G.xy(a1, c1);
        ctx.fillStyle = fill; ctx.fillRect(Math.min(p.x, q.x), Math.min(p.y, q.y), Math.abs(q.x - p.x), Math.abs(q.y - p.y));
    }
    function lineAlong(a0, c0, a1, c1, col, w) {
        var p = G.xy(a0, c0), q = G.xy(a1, c1);
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
    function draw() {
        if (!G || !view) return;
        var n = G.n, N = G.N, W = G.w;
        ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, G.h);
        rectAlong(G.boardA, G.line(N), G.across0, G.across1, BOARD);
        // inlays and their numbers
        var midAcross = (G.across0 + G.across1) / 2;
        ctx.font = "11px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (var f = 1; f <= N; f++) {
            var m = G.mid(f), dbl = f % 12 === 0, dot = [3, 5, 7, 9].indexOf(f % 12) >= 0 || dbl;
            if (dot) {
                ctx.fillStyle = "#0e2a20";
                var off = dbl ? G.gap * (n > 2 ? 1 : 0.3) : 0;
                [-off, off].forEach(function (o, j) { if (!dbl && j) return; var p = G.xy(m, midAcross + o); ctx.beginPath(); ctx.arc(p.x, p.y, G.r * 0.55, 0, Math.PI * 2); ctx.fill(); });
            }
            if (dot || f === 1) {
                ctx.fillStyle = dot ? "#5f8f7c" : FAINT;
                var t = G.vertical ? G.xy(m, G.across0 - 16) : G.xy(m, G.across1 + 15);
                ctx.fillText(String(f), t.x, t.y);
            }
        }
        // frets, the nut, the strings
        for (f = 1; f <= N; f++) lineAlong(G.line(f), G.across0, G.line(f), G.across1, f === 12 || f === 24 ? "#3d6e5c" : DIM, 1.5);
        lineAlong(G.boardA, G.across0 - 1, G.boardA, G.across1 + 1, INK, 4);
        for (var i = 0; i < n; i++) {
            var c = G.str(i), thick = 0.8 + 1.6 * (1 - (S.tuning[i] - 23) / 60);
            lineAlong(G.boardA - G.open, c, G.line(N), c, STRING, Math.max(0.7, Math.min(2.6, thick)));
            var pc = mod(S.tuning[i], 12), lp = G.xy(G.boardA - G.open - (G.vertical ? 14 : 22), c);
            ctx.fillStyle = view.scale[pc] ? INK : "#5f8f7c"; ctx.font = "12px " + MONO;
            ctx.fillText(view.names[pc] + (Math.floor(S.tuning[i] / 12) - 1), lp.x, lp.y);
        }
        // the notes
        var shape = shapesFound[shapeAt] || null;
        for (i = 0; i < n; i++) for (f = 0; f <= N; f++) drawNote(i, f, shape);
        // muted strings in the shape
        if (shape) shape.forEach(function (fr, i) {
            if (fr !== null) return;
            var p = G.pos(i, 0); ctx.strokeStyle = "#ff6a5a"; ctx.lineWidth = 1.5; var k = G.r * 0.5;
            ctx.beginPath(); ctx.moveTo(p.x - k, p.y - k); ctx.lineTo(p.x + k, p.y + k); ctx.moveTo(p.x + k, p.y - k); ctx.lineTo(p.x - k, p.y + k); ctx.stroke();
        });
    }
    function drawNote(i, f, shape) {
        var midi = S.tuning[i] + f, pc = mod(midi, 12), p = G.pos(i, f), r = G.r;
        var inChord = view.chord && view.chord[pc], inScale = view.scale[pc];
        var isRoot = view.chord ? inChord && inChord.root : pc === S.root;
        var inShape = shape && shape[i] === f, muted = shape && shape[i] === null;
        var lit = view.chord ? inChord : inScale;
        var text = labelFor(pc, midi), col = S.colours ? COLOUR[pc][1] : isRoot ? AMBER : INK;
        var key = i + ":" + f, hot = sounding[key] || (hover && hover.i === i && hover.f === f);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        var fontPx = S.labels === "letters" ? Math.round(r * 1.25) : text.length > 3 ? Math.round(r * 0.78) : Math.round(r * 0.95);
        var font = (S.labels === "letters" ? fontPx + "px " + HEB : fontPx + "px " + MONO);
        if (shape && view.chord) {   // with a shape up, the shape is lit and the rest of the chord steps back
            if (inShape) drawDot(p, r, col, true, text, font, hot);
            else if (lit) drawDot(p, r * 0.8, S.colours ? COLOUR[pc][1] : DIM, false, text, font, hot, true);
            else if (S.faint && !muted) faintText(p, text, font, hot);
            return;
        }
        if (lit) drawDot(p, r, col, view.chord || isRoot || S.colours, text, font, hot);
        else if (view.chord && inScale) drawDot(p, r * 0.85, S.colours ? COLOUR[pc][1] : DIM, false, text, font, hot, true);
        else if (S.faint) faintText(p, text, font, hot);
        else if (hot) faintText(p, text, font, true);
    }
    function drawDot(p, r, col, filled, text, font, hot, quiet) {
        ctx.save();
        if (hot) { ctx.shadowColor = col; ctx.shadowBlur = 14; }
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        if (filled) { ctx.fillStyle = col; ctx.fill(); }
        else { ctx.fillStyle = PAPER; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = quiet ? 1 : 1.6; ctx.stroke(); }
        ctx.restore();
        ctx.font = font; ctx.fillStyle = filled ? PAPER : quiet ? (S.colours ? col : "#6fa592") : col;
        ctx.fillText(text, p.x, p.y + 0.5);
        if (hot) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2); ctx.stroke(); }
    }
    function faintText(p, text, font, hot) {
        ctx.font = font; ctx.fillStyle = hot ? INK : "#2c5c4b"; ctx.fillText(text, p.x, p.y + 0.5);
        if (hot) { ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, G.r, 0, Math.PI * 2); ctx.stroke(); }
    }

    // ---- shapes: where a chord falls under four fingers -----------------------------------------------
    function findShapes() {
        var n = S.tuning.length, N = S.frets, chord = view.chord, rootPc = view.chordRoot;
        if (!chord || n > 8 || n < 3) return [];
        var pcs = Object.keys(chord).map(Number), fifth = mod(rootPc + 7, 12), need = pcs.length;
        var minSound = Math.min(n, Math.max(3, n - 2, Math.min(need, n))), seen = {}, out = [];
        for (var start = 1; start <= Math.max(1, N - 3); start++) {
            var cand = S.tuning.map(function (t) {
                var list = []; if (start <= 3 && chord[mod(t, 12)]) list.push(0);   // open strings only in the open position
                for (var f = start; f <= Math.min(N, start + 3); f++) if (chord[mod(t + f, 12)]) list.push(f);
                return list;
            });
            (function walk(i, acc, sounding) {
                if (i === n) {
                    if (sounding < minSound) return;
                    var have = {}, fretted = [], bass = null;
                    acc.forEach(function (f, j) { if (f === null) return; var pc = mod(S.tuning[j] + f, 12); have[pc] = 1; if (bass === null) bass = pc; if (f > 0) fretted.push(f); });
                    if (bass !== rootPc) return;
                    var missing = pcs.filter(function (pc) { return !have[pc]; });
                    if (missing.length > (need >= 4 && missing[0] === fifth ? 1 : 0)) return;
                    if (fretted.length > 4) {   // more than four fretted notes needs a barre at the lowest fret
                        var lo = Math.min.apply(null, fretted), atLo = fretted.filter(function (f) { return f === lo; }).length;
                        if (atLo < 2 || fretted.length - atLo + 1 > 4) return;
                    }
                    var k = acc.map(function (f) { return f === null ? "x" : f; }).join(" ");
                    if (seen[k]) return; seen[k] = 1;
                    var lowest = fretted.length ? Math.min.apply(null, fretted) : 0;
                    var mutes = acc.filter(function (f) { return f === null; }).length;
                    var opens = acc.filter(function (f) { return f === 0; }).length;   // past the third fret an open string is a stretch: a barre is the plainer shape
                    out.push({ frets: acc.slice(), at: lowest, score: mutes * 3 + missing.length * 2 + fretted.length * 0.5 + lowest * 0.05 + (lowest >= 3 ? opens * 0.6 : 0) });
                    return;
                }
                // mutes only on the bass side: once a string sounds, the rest above it sound
                if (sounding === 0) { acc.push(null); walk(i + 1, acc, 0); acc.pop(); }
                cand[i].forEach(function (f) { acc.push(f); walk(i + 1, acc, sounding + 1); acc.pop(); });
            })(0, [], 0);
        }
        // the best shape at each position, low to high
        var best = {};
        out.forEach(function (s) { if (!best[s.at] || s.score < best[s.at].score) best[s.at] = s; });
        return Object.keys(best).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return best[k].frets; }).slice(0, 14);
    }
    function shapeText(shape) { return shape.map(function (f) { return f === null ? "x" : f; }).join(shape.some(function (f) { return f !== null && f > 9; }) ? " " : ""); }

    // ---- sound: a plucked string, Karplus and Strong's ------------------------------------------------
    var AC = null, BUF = {};
    function audio() {
        if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; AC = new C(); }
        if (AC.state === "suspended") AC.resume();
        return AC;
    }
    function buffer(midi) {
        if (BUF[midi]) return BUF[midi];
        var sr = AC.sampleRate, freq = 440 * Math.pow(2, (midi - 69) / 12), len = Math.round(sr * 2.4), b = AC.createBuffer(1, len, sr), d = b.getChannelData(0);
        var period = Math.max(2, Math.round(sr / freq)), ring = new Float32Array(period), decay = 0.994 + 0.005 * Math.max(0, 1 - freq / 900);
        for (var i = 0; i < period; i++) ring[i] = Math.random() * 2 - 1;
        for (i = 1; i < period; i++) ring[i] = (ring[i] + ring[i - 1]) / 2;
        for (i = 0; i < len; i++) { var j = i % period; d[i] = ring[j]; ring[j] = decay * 0.5 * (ring[j] + ring[(j + 1) % period]); }
        return (BUF[midi] = b);
    }
    function pluck(midi, delay, key) {
        var a = audio(); if (!a) return;
        var src = a.createBufferSource(), g = a.createGain(), lp = a.createBiquadFilter(), t = a.currentTime + (delay || 0);
        src.buffer = buffer(midi); lp.type = "lowpass"; lp.frequency.value = 3800; g.gain.value = 0.28;
        src.connect(lp); lp.connect(g); g.connect(a.destination); src.start(t);
        if (key) {
            setTimeout(function () { sounding[key] = (sounding[key] || 0) + 1; draw(); }, (delay || 0) * 1000);
            setTimeout(function () { sounding[key]--; if (!sounding[key]) delete sounding[key]; draw(); }, (delay || 0) * 1000 + 450);
        }
    }

    // ---- what a note is ------------------------------------------------------------------------------
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; }); }
    function describe(i, f) {
        var midi = S.tuning[i] + f, pc = mod(midi, 12), name = labelForName(pc), hz = 440 * Math.pow(2, (midi - 69) / 12);
        var where = "string " + (S.tuning.length - i) + ", " + (f === 0 ? "open" : "fret " + f);
        var role = [];
        if (view.chord && view.chord[pc]) role.push("the " + view.chord[pc].label + " of " + view.chordName);
        if (view.scale[pc]) role.push("the " + view.scale[pc].label + " of " + view.rootName + " " + view.sd.name.toLowerCase());
        else role.push("not in " + view.rootName + " " + view.sd.name.toLowerCase());
        var temple = onNote(pc).map(function (o) { return "<b>" + o.glyph + " " + esc(o.name) + "</b>, " + cardLink(o.trump) + " (" + HEBREW[o.letter] + " " + o.letter + ")"; });
        return "<b>" + esc(name) + (Math.floor(midi / 12) - 1) + "</b> · " + hz.toFixed(1) + " Hz · " + where + " · " + esc(role.join("; ")) +
            (temple.length ? "<br>" + temple.join(" · ") + " · " + COLOUR[pc][0] : "");
    }
    function labelForName(pc) { var c = view.chord && view.chord[pc], s = view.scale[pc]; return (c && c.name) || (s && s.name) || view.names[pc]; }

    // ---- the controls --------------------------------------------------------------------------------
    var cell = $("neck-cell"), reading = $("neck-reading");
    function option(sel, value, text, selected) { var o = document.createElement("option"); o.value = value; o.textContent = text; if (selected) o.selected = true; sel.appendChild(o); return o; }
    function group(sel, label) { var g = document.createElement("optgroup"); g.label = label; sel.appendChild(g); return g; }
    function fillTunings() {
        var sel = $("neck-tuning"); sel.innerHTML = "";
        var match = tuningMatch();
        TUNINGS.forEach(function (t) { option(sel, "b:" + t[0], t[0] + " · " + t[1].map(function (m) { return SHARP[mod(m, 12)]; }).join(" "), match === "b:" + t[0]); });
        var mine = Object.keys(S.mine.tunings);
        if (mine.length) { var g = group(sel, "yours"); mine.forEach(function (k) { option(g, "m:" + k, k + " · " + S.mine.tunings[k].map(function (m) { return SHARP[mod(m, 12)]; }).join(" "), match === "m:" + k); }); }
        if (!match) option(sel, "", "as you have it · " + S.tuning.map(function (m) { return SHARP[mod(m, 12)]; }).join(" "), true);
        $("neck-tuning-forget").hidden = !(match && match.indexOf("m:") === 0);
    }
    function tuningMatch() {
        var k = S.tuning.join(",");
        if (S.tuningName && S.mine.tunings[S.tuningName] && S.mine.tunings[S.tuningName].join(",") === k) return "m:" + S.tuningName;
        for (var i = 0; i < TUNINGS.length; i++) if (TUNINGS[i][1].join(",") === k) return "b:" + TUNINGS[i][0];
        for (var m in S.mine.tunings) if (S.mine.tunings[m].join(",") === k) return "m:" + m;
        return "";
    }
    function fillStrings() {
        var box = $("neck-strings"); box.innerHTML = "";
        for (var i = S.tuning.length - 1; i >= 0; i--) (function (i) {
            var d = document.createElement("span"); d.className = "string";
            var down = document.createElement("button"), up = document.createElement("button"), name = document.createElement("span");
            down.type = up.type = "button"; down.textContent = "−"; up.textContent = "+";
            down.setAttribute("aria-label", "string " + (S.tuning.length - i) + " down a semitone"); up.setAttribute("aria-label", "string " + (S.tuning.length - i) + " up a semitone");
            name.textContent = view.names[mod(S.tuning[i], 12)] + (Math.floor(S.tuning[i] / 12) - 1);
            down.onclick = function () { retune(i, -1); }; up.onclick = function () { retune(i, 1); };
            d.appendChild(down); d.appendChild(name); d.appendChild(up); box.appendChild(d);
        })(i);
    }
    function retune(i, by) {
        var m = S.tuning[i] + by; if (m < 16 || m > 88) return;
        S.tuning[i] = m; S.tuningName = ""; changed(); pluck(m, 0, i + ":0");
    }
    function fillRoots(sel, value, withScaleRoot) {
        sel.innerHTML = "";
        if (withScaleRoot) option(sel, "", "the scale's root", value == null);
        for (var pc = 0; pc < 12; pc++) option(sel, pc, SHARP[pc] === FLAT[pc] ? SHARP[pc] : SHARP[pc] + " / " + FLAT[pc], value === pc);
    }
    function fillScales() {
        var sel = $("neck-scale"); sel.innerHTML = "";
        SCALES.forEach(function (g) { var og = group(sel, g[0]); g[1].forEach(function (s) { option(og, s[0], s[1], S.scale === s[0]); }); });
        var mine = Object.keys(S.mine.scales); if (mine.length) { var og = group(sel, "yours"); mine.forEach(function (k) { option(og, "mine:" + k, k, S.scale === "mine:" + k); }); }
        $("neck-scale-forget").hidden = !view.sd.mine;
    }
    function fillChords() {
        var sel = $("neck-chord"); sel.innerHTML = "";
        option(sel, "", "no chord, the scale alone", !S.chord);
        if (sky) option(sel, "sky", "the sky this minute", S.chord === "sky");
        CHORDS.forEach(function (g) { var og = group(sel, g[0]); g[1].forEach(function (c) { option(og, c[0], (c[1] ? c[1] + " · " : "") + c[2], S.chord === c[0]); }); });
        var mine = Object.keys(S.mine.chords); if (mine.length) { var og = group(sel, "yours"); mine.forEach(function (k) { option(og, "mine:" + k, k, S.chord === "mine:" + k); }); }
        $("neck-chord-forget").hidden = !(view.cd && view.cd.mine);
    }
    // The twelve toggles for making your own: they show what is lit, and change it.
    function fillBuilder(id, active, onChange) {
        var box = $(id); box.innerHTML = "";
        for (var s = 0; s < 12; s++) (function (s) {
            var b = document.createElement("button"); b.type = "button"; b.textContent = s === 0 ? "1" : INT[s];
            b.setAttribute("aria-pressed", active[s] ? "true" : "false");
            if (s === 0) b.disabled = true;
            b.onclick = function () { active[s] = !active[s]; onChange(active); };
            box.appendChild(b);
        })(s);
    }
    function semisOf(f) { var a = {}; formula(f).forEach(function (t) { a[mod(t.semis, 12)] = true; }); return a; }
    function fromToggles(a) { var out = []; for (var s = 0; s < 12; s++) if (a[s] || s === 0) out.push(INT[s]); return out.join(" "); }
    // the scale's own chords: thirds stacked on each degree, when the scale has seven notes
    function diatonic() {
        var box = $("neck-diatonic"); box.innerHTML = "";
        var st = view.st; if (st.length !== 7) { box.innerHTML = "<span class=\"hint\">the scale's own chords are for scales of seven notes</span>"; return; }
        var ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii"];
        [3, 4].forEach(function (size) {
            var row = document.createElement("div"); row.className = "row";
            for (var d = 0; d < 7; d++) {
                var rootSemi = mod(st[d].semis, 12), ints = [];
                for (var k = 0; k < size; k++) ints.push(mod(st[(d + 2 * k) % 7].semis - rootSemi, 12));
                var key = ints.join(","), found = null;
                Object.keys(CHORD).forEach(function (id) { if (!found && formula(CHORD[id].f).map(function (t) { return mod(t.semis, 12); }).join(",") === key && formula(CHORD[id].f).length === size) found = id; });
                var pc = mod(S.root + rootSemi, 12), nm = (view.scale[pc] && view.scale[pc].name) || view.names[pc];
                var major = ints[1] === 4, numeral = major ? ROMAN[d].toUpperCase() : ROMAN[d];
                var b = document.createElement("button"); b.type = "button";
                b.innerHTML = "<span class=\"num\">" + numeral + "</span> " + esc(nm + (found ? CHORD[found].sym : "?"));
                if (!found) b.disabled = true;
                b.setAttribute("aria-pressed", found && S.chord === found && view.chordRoot === pc ? "true" : "false");
                (function (pc, found) { b.onclick = function () { S.chord = found; S.chordRoot = pc; changed(); strum(); }; })(pc, found);
                row.appendChild(b);
            }
            box.appendChild(row);
        });
    }
    function fillReading() {
        var out = [], sd = view.sd, st = view.st;
        var names = st.map(function (t) { var pc = mod(S.root + t.semis, 12); return view.scale[pc].name || view.names[pc]; });
        var steps = st.map(function (t, i) { var nx = i + 1 < st.length ? st[i + 1].semis : 12; var d = nx - t.semis; return d === 1 ? "H" : d === 2 ? "W" : d === 3 ? "W+H" : d + ""; });
        out.push("<div class=\"card-read\"><h3>" + esc(view.rootName + " " + sd.name.toLowerCase()) + "</h3><p>" + esc(names.join(" ")) + "</p><p class=\"gd\">" + esc(st.map(function (t) { return t.label; }).join(" ")) + " · steps " + esc(steps.join(" ")) + "</p></div>");
        if (view.chord) {
            var ct = formula(view.cd.f), cn = ct.map(function (t) { var pc = mod(view.chordRoot + t.semis, 12); return view.chord[pc].name; });
            var sh = shapesFound[shapeAt];
            out.push("<div class=\"card-read\"><h3>" + esc(view.chordName) + "</h3><p>" + esc(cn.join(" ")) + "</p><p class=\"gd\">" + esc(ct.map(function (t) { return t.label; }).join(" ")) +
                (view.cd.id === "sky" ? "" : " · " + esc(view.cd.name)) + (sh ? " · shape " + esc(shapeText(sh)) : "") + "</p></div>");
        }
        // the temple: what stands on each lit note
        var lit = view.chord ? Object.keys(view.chord).map(Number) : st.map(function (t) { return mod(S.root + t.semis, 12); });
        var seen = {}, lis = [];
        lit.forEach(function (pc) {
            if (seen[pc]) return; seen[pc] = 1;
            var nm = labelForName(pc), here = onNote(pc).map(function (o) { return o.glyph + " " + esc(o.name) + ", " + cardLink(o.trump) + " " + HEBREW[o.letter]; });
            var planets = sky ? sky.bodies.filter(function (b) { return b.pc === pc; }).map(function (b) { return b.glyph + " " + b.name.toLowerCase() + " is there now"; }) : [];
            lis.push("<li><b><span class=\"swatch\" style=\"background:" + COLOUR[pc][1] + "\"></span>" + esc(nm) + "</b> " + here.join(" · ") + " · " + COLOUR[pc][0] + (planets.length ? " · <b>" + esc(planets.join(", ")) + "</b>" : "") + "</li>");
        });
        out.push("<div class=\"card-read\"><h3>in the temple</h3><ul>" + lis.join("") + "</ul></div>");
        reading.innerHTML = out.join("");
    }
    function fillHour() {
        var out = $("neck-hour"); if (!out) return;
        var bits = [];
        if (Z) {
            var sun = Z.sky(new Date(), 45.52, -122.68).bodies.filter(function (b) { return b.name === "Sun"; })[0];
            if (sun) bits.push("☉ in " + sun.sign.sign.glyph + " " + sun.sign.sign.name + ", " + SHARP[sun.sign.index]);
        }
        var h = H && H.now();
        if (h) bits.push("the hour is " + H.SIGNS[h.planet] + " " + h.planet + "'s, " + SHARP[PLANET_NOTE[h.planet]]);
        out.textContent = bits.join(" · ");
    }

    var scaleToggles = {}, chordToggles = {};
    function changed(keepShape) {
        compute(); if (!keepShape) shapeAt = 0;
        keep(); fillTunings(); fillStrings(); fillScales(); fillChords();
        fillRoots($("neck-root"), S.root); fillRoots($("neck-chord-root"), S.chordRoot, true);
        $("neck-chord-root").disabled = !S.chord || S.chord === "sky";
        $("neck-labels").value = S.labels; $("neck-frets").value = String(S.frets); $("neck-spelling").value = S.spelling;
        $("neck-colours").setAttribute("aria-pressed", S.colours ? "true" : "false");
        $("neck-faint").setAttribute("aria-pressed", S.faint ? "true" : "false");
        $("neck-flip").setAttribute("aria-pressed", S.flip ? "true" : "false");
        scaleToggles = semisOf(view.sd.f); fillBuilder("neck-scale-build", scaleToggles, function (a) { mineFrom("scales", a); });
        chordToggles = view.cd ? semisOf(view.cd.f) : { 0: true }; fillBuilder("neck-chord-build", chordToggles, function (a) { mineFrom("chords", a); });
        var shapeBox = $("neck-shapes");
        shapeBox.hidden = !view.chord;
        $("neck-shape-at").textContent = shapesFound.length ? "shape " + (shapeAt + 1) + " of " + shapesFound.length + ": " + shapeText(shapesFound[shapeAt]) : view.chord ? "no shape under four fingers" : "";
        diatonic(); fillReading(); resize();
    }
    // A toggle pressed: the set as it now stands, unnamed until kept.
    function mineFrom(kind, a) {
        var f = fromToggles(a);
        if (kind === "scales") { S.mine.scales["(unkept)"] = f; S.scale = "mine:(unkept)"; }
        else { S.mine.chords["(unkept)"] = f; S.chord = "mine:(unkept)"; }
        changed();
    }
    function keepAs(kind, inputId) {
        var name = $(inputId).value.trim().slice(0, 40); if (!name) { $(inputId).focus(); return; }
        if (kind === "tunings") { S.mine.tunings[name] = S.tuning.slice(); S.tuningName = name; }
        if (kind === "scales") { S.mine.scales[name] = view.sd.f; delete S.mine.scales["(unkept)"]; S.scale = "mine:" + name; }
        if (kind === "chords") { if (!view.cd) return; S.mine.chords[name] = view.cd.f; delete S.mine.chords["(unkept)"]; S.chord = "mine:" + name; }
        $(inputId).value = ""; changed();
    }
    function forget(kind) {
        if (kind === "tunings") { var m = tuningMatch(); if (m.indexOf("m:") === 0) delete S.mine.tunings[m.slice(2)]; S.tuningName = ""; }
        if (kind === "scales" && view.sd.mine) { delete S.mine.scales[S.scale.slice(5)]; S.scale = "major"; }
        if (kind === "chords" && view.cd && view.cd.mine) { delete S.mine.chords[S.chord.slice(5)]; S.chord = null; }
        changed();
    }
    function strum() {
        var sh = shapesFound[shapeAt];
        if (sh) { var k = 0; sh.forEach(function (f, i) { if (f !== null) pluck(S.tuning[i] + f, 0.045 * k++, i + ":" + f); }); return; }
        if (!view.chord) return;
        var base = S.tuning[0] + mod(view.chordRoot - S.tuning[0], 12);
        formula(view.cd.f).forEach(function (t, k) { pluck(base + t.semis, 0.07 * k); });
    }
    function playScale() {
        var base = S.tuning[0] + mod(S.root - S.tuning[0], 12), notes = view.st.map(function (t) { return base + t.semis; }).concat([base + 12]);
        notes.forEach(function (m, k) {
            // light it where it falls lowest on the neck
            var at = null; for (var i = 0; i < S.tuning.length && !at; i++) { var f = m - S.tuning[i]; if (f >= 0 && f <= Math.min(S.frets, 4)) at = i + ":" + f; }
            for (i = 0; i < S.tuning.length && !at; i++) { f = m - S.tuning[i]; if (f >= 0 && f <= S.frets) at = i + ":" + f; }
            pluck(m, 0.26 * k, at);
        });
    }
    // The sky as a chord: each of the seven where it stands, its sign's note, rooted on the Sun's.
    function skyChord() {
        if (!Z) return;
        var bodies = Z.sky(new Date(), 45.52, -122.68).bodies.filter(function (b) { return PLANET_NOTE[b.name] !== undefined; })
            .map(function (b) { return { name: b.name, glyph: b.glyph, sign: b.sign.sign, pc: b.sign.index }; });
        var sun = bodies.filter(function (b) { return b.name === "Sun"; })[0], have = {};
        bodies.forEach(function (b) { have[mod(b.pc - sun.pc, 12)] = true; });
        sky = { id: "sky", sym: "", name: "the sky", f: fromToggles(have), bodies: bodies };
        S.chord = "sky"; S.chordRoot = sun.pc;
        var lines = bodies.map(function (b) { return b.glyph + " " + b.name + " in " + b.sign.glyph + " " + b.sign.name + ", " + SHARP[b.pc]; });
        cell.innerHTML = "<b>the sky this minute, over Portland</b>: " + esc(lines.join(" · "));
        changed(); strum();
    }
    function hourKey() {
        var h = H && H.now(); if (!h) return;
        S.root = PLANET_NOTE[h.planet]; S.chordRoot = null; if (S.chord === "sky") S.chord = null;
        cell.innerHTML = "<b>the hour is " + esc(h.planet) + "'s</b> (" + H.hm(h.start) + " to " + H.hm(h.end) + "): its trump is " + cardLink(Z.PLANETS[h.planet].trump) + ", whose note is " + SHARP[S.root] + "; the scale is set there";
        changed(); playScale();
    }

    // ---- wiring ------------------------------------------------------------------------------------------
    $("neck-tuning").onchange = function () {
        var v = this.value; if (!v) return;
        var t = v.indexOf("b:") === 0 ? TUNINGS.filter(function (x) { return x[0] === v.slice(2); })[0][1] : S.mine.tunings[v.slice(2)];
        S.tuning = t.slice(); S.tuningName = v.slice(2); changed();
    };
    $("neck-add-low").onclick = function () { if (S.tuning.length < 10) { S.tuning.unshift(Math.max(16, S.tuning[0] - 5)); S.tuningName = ""; changed(); } };
    $("neck-add-high").onclick = function () { if (S.tuning.length < 10) { S.tuning.push(Math.min(88, S.tuning[S.tuning.length - 1] + 5)); S.tuningName = ""; changed(); } };
    $("neck-drop-low").onclick = function () { if (S.tuning.length > 1) { S.tuning.shift(); S.tuningName = ""; changed(); } };
    $("neck-drop-high").onclick = function () { if (S.tuning.length > 1) { S.tuning.pop(); S.tuningName = ""; changed(); } };
    $("neck-tuning-keep").onclick = function () { keepAs("tunings", "neck-tuning-name"); };
    $("neck-tuning-forget").onclick = function () { forget("tunings"); };
    $("neck-root").onchange = function () { S.root = +this.value; if (S.chord === "sky") S.chord = null; changed(); };
    $("neck-scale").onchange = function () { S.scale = this.value; changed(); };
    $("neck-scale-keep").onclick = function () { keepAs("scales", "neck-scale-name"); };
    $("neck-scale-forget").onclick = function () { forget("scales"); };
    $("neck-chord").onchange = function () { S.chord = this.value || null; if (!S.chord) S.chordRoot = null; changed(); if (S.chord) strum(); };
    $("neck-chord-root").onchange = function () { S.chordRoot = this.value === "" ? null : +this.value; changed(); strum(); };
    $("neck-chord-keep").onclick = function () { keepAs("chords", "neck-chord-name"); };
    $("neck-chord-forget").onclick = function () { forget("chords"); };
    $("neck-shape-prev").onclick = function () { if (shapesFound.length) { shapeAt = mod(shapeAt - 1, shapesFound.length); changed(true); strum(); } };
    $("neck-shape-next").onclick = function () { if (shapesFound.length) { shapeAt = mod(shapeAt + 1, shapesFound.length); changed(true); strum(); } };
    $("neck-strum").onclick = strum;
    $("neck-play").onclick = playScale;
    $("neck-labels").onchange = function () { S.labels = this.value; changed(true); };
    $("neck-frets").onchange = function () { S.frets = +this.value; changed(); };
    $("neck-spelling").onchange = function () { S.spelling = this.value; changed(true); };
    $("neck-colours").onclick = function () { S.colours = !S.colours; changed(true); };
    $("neck-faint").onclick = function () { S.faint = !S.faint; changed(true); };
    $("neck-flip").onclick = function () { S.flip = !S.flip; changed(true); };
    $("neck-sky").onclick = skyChord;
    $("neck-hour-key").onclick = hourKey;
    $("neck-reset").onclick = function () {
        var mine = S.mine;
        S = { tuning: TUNINGS[0][1].slice(), tuningName: "Standard", frets: 22, root: 0, scale: "major", chordRoot: null, chord: null,
            labels: "names", colours: false, spelling: "auto", flip: false, faint: true, mine: mine };
        sky = null; changed();
    };
    ["neck-tuning-name", "neck-scale-name", "neck-chord-name"].forEach(function (id, k) {
        $(id).addEventListener("keydown", function (e) { if (e.key === "Enter") keepAs(["tunings", "scales", "chords"][k], id); });
    });

    function hit(e) {
        var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, best = null, bd = Infinity;
        for (var i = 0; i < G.n; i++) for (var f = 0; f <= G.N; f++) {
            var p = G.pos(i, f), d = Math.hypot(p.x - x, p.y - y);
            if (d < bd) { bd = d; best = { i: i, f: f }; }
        }
        return bd < Math.max(G.r * 1.6, G.gap * 0.55) ? best : null;
    }
    canvas.addEventListener("pointermove", function (e) {
        if (e.pointerType === "touch") return;
        var h = hit(e);
        if ((h && hover && h.i === hover.i && h.f === hover.f) || (!h && !hover)) return;
        hover = h; canvas.style.cursor = h ? "pointer" : "default";
        if (h) cell.innerHTML = describe(h.i, h.f);
        draw();
    });
    canvas.addEventListener("pointerleave", function () { hover = null; draw(); });
    canvas.addEventListener("click", function (e) {
        var h = hit(e); if (!h) return;
        cell.innerHTML = describe(h.i, h.f);
        pluck(S.tuning[h.i] + h.f, 0, h.i + ":" + h.f);
    });
    var rt = null;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 80); });

    compute(); changed(); fillHour();
    setInterval(fillHour, 60000);
    window.Neck = { state: function () { return JSON.parse(JSON.stringify(S)); }, view: function () { return view; }, shapes: function () { return shapesFound; }, spell: spell, formula: formula };
})();
