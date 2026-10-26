/* js/hours.js: the planetary hours.
   The old timing: the day runs from sunrise to sunrise and is cut into
   twenty-four unequal hours, twelve from sunrise to sunset and twelve from
   sunset to sunrise, so a winter day-hour is short and its night-hour long.
   Each hour belongs to a planet, in the Chaldean order, slowest first:
   Saturn, Jupiter, Mars, the Sun, Venus, Mercury, the Moon, round and
   round. The first hour of the day belongs to the day's planet (Sunday the
   Sun's, Monday the Moon's, and so on), which is why the week is in the
   order it is: twenty-four hours on from the Sun lands on the Moon.
   Sunrise and sunset are NOAA's equations, good to a minute or so, for
   Portland unless told otherwise. No dependencies; window.Hours. */
(function () {
    "use strict";
    var PLANETS = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"];     // the Chaldean order
    var SIGNS = { Saturn: "♄", Jupiter: "♃", Mars: "♂", Sun: "☉", Venus: "♀", Mercury: "☿", Moon: "☽" };
    var DAYS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn"];         // Sunday first
    var LAT = 45.52, LON = -122.68, D = Math.PI / 180;

    // Sunrise and sunset, as Dates, for the civil day the date falls on.
    function sun(date, lat, lon) {
        lat = lat == null ? LAT : lat; lon = lon == null ? LON : lon;
        var y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
        var n = Math.round((new Date(y, m, d) - new Date(y, 0, 1)) / 864e5) + 1;
        var leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0, g = 2 * Math.PI / (leap ? 366 : 365) * (n - 1 + 0.5);
        var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
        var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
        var cosHa = Math.cos(90.833 * D) / (Math.cos(lat * D) * Math.cos(decl)) - Math.tan(lat * D) * Math.tan(decl);
        if (cosHa > 1 || cosHa < -1) return null;                                     // no rising or setting today: the poles
        var ha = Math.acos(cosHa) / D;
        var rise = 720 - 4 * (lon + ha) - eq, set = 720 - 4 * (lon - ha) - eq;        // minutes after UTC midnight
        var midnight = Date.UTC(y, m, d);
        return { rise: new Date(midnight + rise * 60000), set: new Date(midnight + set * 60000) };
    }
    // The planetary day the moment falls in: its ruler, its sunrise and sunset, and its twenty-four hours.
    function day(date, lat, lon) {
        date = date || new Date();
        var civil = new Date(date.getFullYear(), date.getMonth(), date.getDate()), t = sun(civil, lat, lon);
        if (t && date < t.rise) { civil = new Date(civil.getFullYear(), civil.getMonth(), civil.getDate() - 1); t = sun(civil, lat, lon); }   // before sunrise it is still yesterday
        if (!t) return null;
        var next = sun(new Date(civil.getFullYear(), civil.getMonth(), civil.getDate() + 1), lat, lon);
        if (!next) return null;
        var ruler = DAYS[civil.getDay()], k = PLANETS.indexOf(ruler), hours = [];
        var dayLen = (t.set - t.rise) / 12, nightLen = (next.rise - t.set) / 12;
        for (var i = 0; i < 24; i++) {
            var p = PLANETS[(k + i) % 7];
            hours.push({
                n: i + 1, planet: p, sign: SIGNS[p], day: i < 12, ruler: ruler,
                start: i < 12 ? new Date(t.rise.getTime() + i * dayLen) : new Date(t.set.getTime() + (i - 12) * nightLen),
                end: i < 12 ? new Date(t.rise.getTime() + (i + 1) * dayLen) : new Date(t.set.getTime() + (i - 11) * nightLen)
            });
        }
        return { date: civil, ruler: ruler, sunrise: t.rise, sunset: t.set, nextSunrise: next.rise, hours: hours };
    }
    // The hour it is now (or at the date given).
    function now(date, lat, lon) {
        date = date || new Date();
        var d = day(date, lat, lon);
        if (!d) return null;
        for (var i = 0; i < 24; i++) if (date >= d.hours[i].start && date < d.hours[i].end) return d.hours[i];
        return null;
    }
    function after(planet) { return PLANETS[(PLANETS.indexOf(planet) + 1) % 7]; }
    function hm(d) { return d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes(); }
    window.Hours = { PLANETS: PLANETS, SIGNS: SIGNS, DAYS: DAYS, sun: sun, day: day, now: now, after: after, hm: hm };
})();
