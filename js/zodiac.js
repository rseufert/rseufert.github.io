/* js/zodiac.js: the zodiac, and where the planets stand in it.
   The twelve signs with their elements, qualities and rulers; the
   thirty-six decans, ten degrees each, with the planet the old order
   gave each (the Chaldean order descending from Mars at the first of
   Aries) and the small card of the tarot the Golden Dawn laid on it in
   Book T (the twos, threes and fours on the cardinal signs, the fives,
   sixes and sevens on the fixed, the eights, nines and tens on the
   mutable, the suit by the sign's element); the trumps the same order
   gave the signs and the planets; and an ephemeris, Paul Schlyter's
   low-precision one (mean orbital elements and the main perturbations,
   good to a degree or so, better for the Sun), for the seven old
   planets, the two later ones, and the Moon's node, with the ascendant
   and midheaven for Portland unless told otherwise. No dependencies;
   window.Zodiac. */
(function () {
    "use strict";
    var D = Math.PI / 180;
    function rev(x) { x = x % 360; return x < 0 ? x + 360 : x; }
    var SIGNS = [
        { name: "Aries", glyph: "♈\uFE0E", element: "Fire", quality: "cardinal", ruler: "Mars", exalted: "Sun", trump: "The Emperor", letter: "Heh", body: "the head" },
        { name: "Taurus", glyph: "♉\uFE0E", element: "Earth", quality: "fixed", ruler: "Venus", exalted: "Moon", trump: "The Hierophant", letter: "Vav", body: "the neck" },
        { name: "Gemini", glyph: "♊\uFE0E", element: "Air", quality: "mutable", ruler: "Mercury", exalted: null, trump: "The Lovers", letter: "Zayin", body: "the arms" },
        { name: "Cancer", glyph: "♋\uFE0E", element: "Water", quality: "cardinal", ruler: "Moon", exalted: "Jupiter", trump: "The Chariot", letter: "Cheth", body: "the breast" },
        { name: "Leo", glyph: "♌\uFE0E", element: "Fire", quality: "fixed", ruler: "Sun", exalted: null, trump: "Strength", letter: "Teth", body: "the heart" },
        { name: "Virgo", glyph: "♍\uFE0E", element: "Earth", quality: "mutable", ruler: "Mercury", exalted: "Mercury", trump: "The Hermit", letter: "Yod", body: "the belly" },
        { name: "Libra", glyph: "♎\uFE0E", element: "Air", quality: "cardinal", ruler: "Venus", exalted: "Saturn", trump: "Justice", letter: "Lamed", body: "the reins" },
        { name: "Scorpio", glyph: "♏\uFE0E", element: "Water", quality: "fixed", ruler: "Mars", exalted: null, trump: "Death", letter: "Nun", body: "the secrets" },
        { name: "Sagittarius", glyph: "♐\uFE0E", element: "Fire", quality: "mutable", ruler: "Jupiter", exalted: null, trump: "Temperance", letter: "Samekh", body: "the thighs" },
        { name: "Capricorn", glyph: "♑\uFE0E", element: "Earth", quality: "cardinal", ruler: "Saturn", exalted: "Mars", trump: "The Devil", letter: "Ayin", body: "the knees" },
        { name: "Aquarius", glyph: "♒\uFE0E", element: "Air", quality: "fixed", ruler: "Saturn", exalted: null, trump: "The Star", letter: "Tzaddi", body: "the shins" },
        { name: "Pisces", glyph: "♓\uFE0E", element: "Water", quality: "mutable", ruler: "Jupiter", exalted: "Venus", trump: "The Moon", letter: "Qoph", body: "the feet" }
    ];
    var PLANETS = {   // the seven, their trumps and letters by the same order; the two later ones have none
        Saturn: { glyph: "♄", trump: "The World", letter: "Tav" }, Jupiter: { glyph: "♃", trump: "Wheel of Fortune", letter: "Kaph" },
        Mars: { glyph: "♂", trump: "The Tower", letter: "Peh" }, Sun: { glyph: "☉", trump: "The Sun", letter: "Resh" },
        Venus: { glyph: "♀", trump: "The Empress", letter: "Daleth" }, Mercury: { glyph: "☿", trump: "The Magician", letter: "Beth" },
        Moon: { glyph: "☽", trump: "The High Priestess", letter: "Gimel" }, Uranus: { glyph: "♅" }, Neptune: { glyph: "♆" }, Node: { glyph: "☊" }
    };
    var ELEMENTS = { Fire: { suit: "Wands", trump: "Judgement", letter: "Shin" }, Water: { suit: "Cups", trump: "The Hanged Man", letter: "Mem" }, Air: { suit: "Swords", trump: "The Fool", letter: "Aleph" }, Earth: { suit: "Pentacles" } };
    var DECAN_RULERS = ["Mars", "Sun", "Venus", "Mercury", "Moon", "Saturn", "Jupiter"];   // from the first of Aries, the Chaldean order descending
    var RANKS = ["Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
    var QUALITY = ["cardinal", "fixed", "mutable"];
    // Book T's titles of the small cards, the Lord of each.
    var TITLES = {
        Wands: ["Dominion", "Established Strength", "Perfected Work", "Strife", "Victory", "Valour", "Swiftness", "Great Strength", "Oppression"],
        Cups: ["Love", "Abundance", "Blended Pleasure", "Loss in Pleasure", "Pleasure", "Illusionary Success", "Abandoned Success", "Material Happiness", "Perfected Success"],
        Swords: ["Peace Restored", "Sorrow", "Rest from Strife", "Defeat", "Earned Success", "Unstable Effort", "Shortened Force", "Despair and Cruelty", "Ruin"],
        Pentacles: ["Harmonious Change", "Material Works", "Earthly Power", "Material Trouble", "Material Success", "Success Unfulfilled", "Prudence", "Material Gain", "Wealth"]
    };
    // The court by Book T, in Waite's names: his Knight is the order's Knight (the fire of the suit), his King its Prince (the air),
    // his Page its Princess (the earth). Each Queen, King and Knight rules thirty degrees, the last decan of one sign and the first two of the next.
    var COURT = { cardinal: "Queen", fixed: "King", mutable: "Knight" };
    function signOf(lon) { lon = rev(lon); var s = Math.floor(lon / 30); return { sign: SIGNS[s], index: s, deg: lon - s * 30 }; }
    function decan(lon) {
        lon = rev(lon);
        var d = Math.floor(lon / 10), s = Math.floor(d / 3), k = d % 3, sign = SIGNS[s];
        var n = QUALITY.indexOf(sign.quality) * 3 + k, suit = ELEMENTS[sign.element].suit;
        var cs = k === 2 ? (s + 1) % 12 : s, csign = SIGNS[cs];
        return { index: d, sign: sign, n: k + 1, from: d * 10, to: d * 10 + 10, ruler: DECAN_RULERS[d % 7],
            card: RANKS[n] + " of " + suit, title: TITLES[suit][n], court: COURT[csign.quality] + " of " + ELEMENTS[csign.element].suit };
    }
    function fmt(lon) { var p = signOf(lon), d = Math.floor(p.deg), m = Math.floor((p.deg - d) * 60); return d + "°" + (m < 10 ? "0" : "") + m + "′ " + p.sign.name; }

    // ---- the ephemeris (Schlyter): d is days from 2000 Jan 0.0 -----------------------
    function days(date) { return (date.getTime() - Date.UTC(1999, 11, 31)) / 864e5; }
    var EL = {
        Sun: function (d) { return { N: 0, i: 0, w: 282.9404 + 4.70935e-5 * d, a: 1, e: 0.016709 - 1.151e-9 * d, M: 356.0470 + 0.9856002585 * d }; },
        Moon: function (d) { return { N: 125.1228 - 0.0529538083 * d, i: 5.1454, w: 318.0634 + 0.1643573223 * d, a: 60.2666, e: 0.054900, M: 115.3654 + 13.0649929509 * d }; },
        Mercury: function (d) { return { N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5.00e-8 * d, w: 29.1241 + 1.01444e-5 * d, a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d }; },
        Venus: function (d) { return { N: 76.6799 + 2.46590e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.8910 + 1.38374e-5 * d, a: 0.723330, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d }; },
        Mars: function (d) { return { N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d, a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d }; },
        Jupiter: function (d) { return { N: 100.4542 + 2.76854e-5 * d, i: 1.3030 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d, a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.8950 + 0.0830853001 * d }; },
        Saturn: function (d) { return { N: 113.6634 + 2.38980e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d, a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.9670 + 0.0334442282 * d }; },
        Uranus: function (d) { return { N: 74.0005 + 1.3978e-5 * d, i: 0.7733 + 1.9e-8 * d, w: 96.6612 + 3.0565e-5 * d, a: 19.18171 - 1.55e-8 * d, e: 0.047318 + 7.45e-9 * d, M: 142.5905 + 0.011725806 * d }; },
        Neptune: function (d) { return { N: 131.7806 + 3.0173e-5 * d, i: 1.7700 - 2.55e-7 * d, w: 272.8461 - 6.027e-6 * d, a: 30.05826 + 3.313e-8 * d, e: 0.008606 + 2.15e-9 * d, M: 260.2471 + 0.005995147 * d }; }
    };
    var ORDER = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];
    function sin(x) { return Math.sin(x * D); } function cos(x) { return Math.cos(x * D); }
    function kepler(M, e) {
        var E = M + e / D * sin(M) * (1 + e * cos(M));
        for (var k = 0; k < 12; k++) { var E1 = E - (E - e / D * sin(E) - M) / (1 - e * cos(E)); if (Math.abs(E1 - E) < 1e-6) return E1; E = E1; }
        return E;
    }
    // Position from elements: in the plane of the ecliptic, about the body the elements are referred to (the Sun, or the Earth for the Moon and the Sun itself).
    function place(el) {
        var E = kepler(rev(el.M), el.e), xv = el.a * (cos(E) - el.e), yv = el.a * Math.sqrt(1 - el.e * el.e) * sin(E);
        var v = Math.atan2(yv, xv) / D, r = Math.hypot(xv, yv), vw = v + el.w;
        return { x: r * (cos(el.N) * cos(vw) - sin(el.N) * sin(vw) * cos(el.i)), y: r * (sin(el.N) * cos(vw) + cos(el.N) * sin(vw) * cos(el.i)), z: r * sin(vw) * sin(el.i), r: r };
    }
    function lonlat(p) { return { lon: rev(Math.atan2(p.y, p.x) / D), lat: Math.atan2(p.z, Math.hypot(p.x, p.y)) / D, r: Math.hypot(p.x, p.y, p.z) }; }
    function fromLonLat(l) { return { x: l.r * cos(l.lon) * cos(l.lat), y: l.r * sin(l.lon) * cos(l.lat), z: l.r * sin(l.lat) }; }
    // Geocentric ecliptic longitudes of everything, at the moment given.
    function longitudes(date) {
        var d = days(date), es = EL.Sun(d), sun = place(es), out = {};
        var Ms = rev(es.M), Mm, Mj = rev(EL.Jupiter(d).M), Msa = rev(EL.Saturn(d).M), Mu = rev(EL.Uranus(d).M);
        ORDER.forEach(function (name) {
            var el = EL[name](d), p = place(el), l = lonlat(p);
            if (name === "Sun") { out[name] = { lon: l.lon, lat: 0, r: l.r }; return; }
            if (name === "Moon") {
                Mm = rev(el.M);
                var Ls = rev(Ms + es.w), Lm = rev(Mm + el.w + el.N), Dm = rev(Lm - Ls), F = rev(Lm - el.N);
                l.lon += -1.274 * sin(Mm - 2 * Dm) + 0.658 * sin(2 * Dm) - 0.186 * sin(Ms) - 0.059 * sin(2 * Mm - 2 * Dm) - 0.057 * sin(Mm - 2 * Dm + Ms)
                    + 0.053 * sin(Mm + 2 * Dm) + 0.046 * sin(2 * Dm - Ms) + 0.041 * sin(Mm - Ms) - 0.035 * sin(Dm) - 0.031 * sin(Mm + Ms) - 0.015 * sin(2 * F - 2 * Dm) + 0.011 * sin(Mm - 4 * Dm);
                l.lat += -0.173 * sin(F - 2 * Dm) - 0.055 * sin(Mm - F - 2 * Dm) - 0.046 * sin(Mm + F - 2 * Dm) + 0.033 * sin(F + 2 * Dm) + 0.017 * sin(2 * Mm + F);
                out[name] = { lon: rev(l.lon), lat: l.lat, r: l.r }; return;
            }
            if (name === "Jupiter") l.lon += -0.332 * sin(2 * Mj - 5 * Msa - 67.6) - 0.056 * sin(2 * Mj - 2 * Msa + 21) + 0.042 * sin(3 * Mj - 5 * Msa + 21) - 0.036 * sin(Mj - 2 * Msa) + 0.022 * cos(Mj - Msa) + 0.023 * sin(2 * Mj - 3 * Msa + 52) - 0.016 * sin(Mj - 5 * Msa - 69);
            if (name === "Saturn") { l.lon += 0.812 * sin(2 * Mj - 5 * Msa - 67.6) - 0.229 * cos(2 * Mj - 4 * Msa - 2) + 0.119 * sin(Mj - 2 * Msa - 3) + 0.046 * sin(2 * Mj - 6 * Msa - 69) + 0.014 * sin(Mj - 3 * Msa + 32); l.lat += -0.020 * cos(2 * Mj - 4 * Msa - 2) + 0.018 * sin(2 * Mj - 6 * Msa - 49); }
            if (name === "Uranus") l.lon += 0.040 * sin(Msa - 2 * Mu + 6) + 0.035 * sin(Msa - 3 * Mu + 33) - 0.015 * sin(Mj - Mu + 20);
            var h = fromLonLat(l), g = lonlat({ x: h.x + sun.x, y: h.y + sun.y, z: h.z });
            out[name] = { lon: g.lon, lat: g.lat, r: g.r };
        });
        out.Node = { lon: rev(EL.Moon(d).N), lat: 0 };
        return out;
    }
    // The sky at a moment: each body with its longitude, sign, decan and card, retrograde or not; the Moon's phase; the angles.
    function sky(date, lat, lon) {
        date = date || new Date(); lat = lat == null ? 45.52 : lat; lon = lon == null ? -122.68 : lon;
        var now = longitudes(date), later = longitudes(new Date(date.getTime() + 864e5)), bodies = [];
        ORDER.concat(["Node"]).forEach(function (name) {
            var l = now[name].lon, step = rev(later[name].lon - l);
            bodies.push({ name: name, glyph: PLANETS[name].glyph, lon: l, lat: now[name].lat, sign: signOf(l), decan: decan(l),
                retrograde: name !== "Sun" && name !== "Moon" && (name === "Node" ? step < 180 : step > 180), trump: PLANETS[name].trump || null, speed: name === "Node" ? -rev(-step) : (step > 180 ? step - 360 : step) });
        });
        var elong = rev(now.Moon.lon - now.Sun.lon);
        var phases = ["new", "waxing crescent", "first quarter", "waxing gibbous", "full", "waning gibbous", "last quarter", "waning crescent"];
        var phase = phases[Math.floor(((elong + 22.5) % 360) / 45)];
        // sidereal time and the angles: the ascendant and the midheaven
        var d = days(date), es = EL.Sun(d), Ls = rev(es.M + es.w);
        var ut = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
        var gmst = rev(Ls + 180 + ut * 15), lst = rev(gmst + lon), ecl = 23.4393 - 3.563e-7 * d;
        var asc = rev(Math.atan2(cos(lst), -(sin(lst) * cos(ecl) + Math.tan(lat * D) * sin(ecl))) / D);
        var mc = rev(Math.atan2(sin(lst), cos(lst) * cos(ecl)) / D);
        return { date: date, lat: lat, lon: lon, bodies: bodies, phase: phase, elongation: elong, lst: lst,
            asc: { lon: asc, sign: signOf(asc), decan: decan(asc) }, mc: { lon: mc, sign: signOf(mc), decan: decan(mc) } };
    }
    // The days the Sun enters each decan in a year, by stepping the ephemeris a day at a time: for the cards' dates.
    function decanDates(year) {
        var out = [], last = null;
        for (var n = 0; n < 367; n++) {
            var t = new Date(Date.UTC(year, 0, 1 + n, 12)), l = longitudes(t).Sun.lon, d = Math.floor(l / 10);
            if (last !== null && d !== last) out[d] = t;
            last = d;
        }
        return out;
    }
    // The seventy-eight, in order, each with what the order laid on it: for anyone who wants the list without the deck.
    function deck() {
        var trumps = ["The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor", "The Hierophant", "The Lovers", "The Chariot", "Strength", "The Hermit", "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance", "The Devil", "The Tower", "The Star", "The Moon", "The Sun", "Judgement", "The World"];
        var cards = trumps.map(function (n, i) { return { name: n, trump: i }; });
        ["Wands", "Cups", "Swords", "Pentacles"].forEach(function (suit) {
            cards.push({ name: "Ace of " + suit, suit: suit, rank: 1 });
            RANKS.forEach(function (r, i) { cards.push({ name: r + " of " + suit, suit: suit, rank: i + 2, title: TITLES[suit][i] }); });
            ["Page", "Knight", "Queen", "King"].forEach(function (c, i) { cards.push({ name: c + " of " + suit, suit: suit, rank: 11 + i, court: c }); });
        });
        return cards;
    }
    window.Zodiac = { SIGNS: SIGNS, PLANETS: PLANETS, ELEMENTS: ELEMENTS, TITLES: TITLES, RANKS: RANKS, DECAN_RULERS: DECAN_RULERS, ORDER: ORDER,
        signOf: signOf, decan: decan, fmt: fmt, longitudes: longitudes, sky: sky, decanDates: decanDates, deck: deck, rev: rev };
})();
