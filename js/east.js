/* js/east.js: the Chinese calendar, as much of it as the pages need.
   The ten heavenly stems and twelve earthly branches, which pair off in
   a cycle of sixty and count the years, the months, the days and the
   double-hours; the twelve animals that ride the branches and the five
   elements that ride the stems; the lunar months, found from the new
   moons of js/zodiac.js's ephemeris by the rule the almanac uses (the
   month holding the winter solstice is the eleventh; when thirteen
   months fall between two solstices, the first with no principal solar
   term is the leap month); the New Year, which begins the first month;
   and the four pillars of any moment. Days are China's civil days
   (UTC+8), as the almanac counts them. No dependencies beyond
   window.Zodiac; window.East. */
(function () {
    "use strict";
    var Z = window.Zodiac, DAY = 864e5, CN = 8 * 3600e3;
    var STEMS = [
        { c: "甲", pinyin: "jiǎ", element: "Wood", yang: true }, { c: "乙", pinyin: "yǐ", element: "Wood", yang: false },
        { c: "丙", pinyin: "bǐng", element: "Fire", yang: true }, { c: "丁", pinyin: "dīng", element: "Fire", yang: false },
        { c: "戊", pinyin: "wù", element: "Earth", yang: true }, { c: "己", pinyin: "jǐ", element: "Earth", yang: false },
        { c: "庚", pinyin: "gēng", element: "Metal", yang: true }, { c: "辛", pinyin: "xīn", element: "Metal", yang: false },
        { c: "壬", pinyin: "rén", element: "Water", yang: true }, { c: "癸", pinyin: "guǐ", element: "Water", yang: false }
    ];
    var BRANCHES = [
        { c: "子", pinyin: "zǐ", animal: "Rat", hours: "23–1", element: "Water", direction: "north" },
        { c: "丑", pinyin: "chǒu", animal: "Ox", hours: "1–3", element: "Earth", direction: "north-north-east" },
        { c: "寅", pinyin: "yín", animal: "Tiger", hours: "3–5", element: "Wood", direction: "east-north-east" },
        { c: "卯", pinyin: "mǎo", animal: "Rabbit", hours: "5–7", element: "Wood", direction: "east" },
        { c: "辰", pinyin: "chén", animal: "Dragon", hours: "7–9", element: "Earth", direction: "east-south-east" },
        { c: "巳", pinyin: "sì", animal: "Snake", hours: "9–11", element: "Fire", direction: "south-south-east" },
        { c: "午", pinyin: "wǔ", animal: "Horse", hours: "11–13", element: "Fire", direction: "south" },
        { c: "未", pinyin: "wèi", animal: "Goat", hours: "13–15", element: "Earth", direction: "south-south-west" },
        { c: "申", pinyin: "shēn", animal: "Monkey", hours: "15–17", element: "Metal", direction: "west-south-west" },
        { c: "酉", pinyin: "yǒu", animal: "Rooster", hours: "17–19", element: "Metal", direction: "west" },
        { c: "戌", pinyin: "xū", animal: "Dog", hours: "19–21", element: "Earth", direction: "west-north-west" },
        { c: "亥", pinyin: "hài", animal: "Pig", hours: "21–23", element: "Water", direction: "north-north-west" }
    ];
    var ELEMENTS = { Wood: { c: "木", colour: "green", planet: "Jupiter", season: "spring" }, Fire: { c: "火", colour: "red", planet: "Mars", season: "summer" }, Earth: { c: "土", colour: "yellow", planet: "Saturn", season: "the turn of the seasons" }, Metal: { c: "金", colour: "white", planet: "Venus", season: "autumn" }, Water: { c: "水", colour: "black", planet: "Mercury", season: "winter" } };
    var TRINES = [["Rat", "Dragon", "Monkey"], ["Ox", "Snake", "Rooster"], ["Tiger", "Horse", "Dog"], ["Rabbit", "Goat", "Pig"]];
    function mod(a, n) { return ((a % n) + n) % n; }
    function pillar(i) { var s = STEMS[mod(i, 10)], b = BRANCHES[mod(i, 12)]; return { index: mod(i, 60), stem: s, branch: b, name: s.c + b.c, pinyin: s.pinyin + " " + b.pinyin, element: s.element, yang: s.yang, animal: b.animal }; }

    // ---- the sky: new moons and the Sun's stations, by the ephemeris ----------------------------------
    function sunLon(t) { return Z.longitudes(new Date(t)).Sun.lon; }
    function elong(t) { var l = Z.longitudes(new Date(t)); return Z.rev(l.Moon.lon - l.Sun.lon); }
    function cnDay(t) { return Math.floor((t + CN) / DAY); }                       // the civil day in China, as a day number
    function civil(dn) { var u = new Date(dn * DAY); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()); }   // that calendar day, at local midnight
    function newMoons(from, to) {
        var out = [], step = 6 * 3600e3, prev = elong(from);
        for (var t = from + step; t <= to; t += step) {
            var e = elong(t);
            if (prev > 300 && e < 60) { var a = t - step, b = t; for (var k = 0; k < 30; k++) { var m = (a + b) / 2; if (elong(m) > 300) a = m; else b = m; } out.push((a + b) / 2); }
            prev = e;
        }
        return out;
    }
    function sunAt(lon, near) {   // the moment the Sun reaches lon, within twenty days of near
        var a = near - 20 * DAY, b = near + 20 * DAY;
        for (var k = 0; k < 40; k++) { var m = (a + b) / 2; if (Z.rev(sunLon(m) - lon + 180) - 180 < 0) a = m; else b = m; }
        return (a + b) / 2;
    }
    function solstice(year) { return sunAt(270, Date.UTC(year, 11, 21)); }
    // The lunar months from the eleventh month before the year to the eleventh month in it, numbered, the leap month marked.
    var monthCache = {};
    function months(year) {
        if (monthCache[year]) return monthCache[year];
        var s0 = solstice(year - 1), s1 = solstice(year);
        var moons = newMoons(s0 - 40 * DAY, s1 + 40 * DAY).map(cnDay);
        var i0 = -1, i1 = -1;
        moons.forEach(function (d, i) { if (d <= cnDay(s0)) i0 = i; if (d <= cnDay(s1)) i1 = i; });
        var leap = i1 - i0 === 13, out = [], n = 11, found = false;
        for (var i = i0; i < moons.length - 1; i++) {
            var start = moons[i], end = moons[i + 1], hasTerm = false;
            for (var k = 0; k < 12; k++) { var mid = (start + 15) * DAY - CN, t = sunAt(k * 30, mid), d = cnDay(t); if (d >= start && d < end && Math.abs(t - mid) < 40 * DAY) hasTerm = true; }
            var isLeap = false;
            if (i > i0) { if (leap && !found && !hasTerm) { isLeap = true; found = true; } else n = n % 12 + 1; }
            out.push({ start: start, end: end, n: n, leap: isLeap, startDate: civil(start) });
        }
        return (monthCache[year] = out);
    }
    function newYear(year) { return months(year).filter(function (m) { return m.n === 1 && !m.leap; })[0].startDate; }
    // ---- the pillars -----------------------------------------------------------------------------------
    function yearOf(date) {
        date = date || new Date();
        var y = date.getFullYear(), ny = newYear(y);
        if (date < ny) { y -= 1; ny = newYear(y); }
        var p = pillar(y - 4);
        p.year = y; p.from = ny; p.to = newYear(y + 1);
        return p;
    }
    // The almanac's year for the pillars changes at the start of spring, the Sun at 315°, not at the New Year's new moon.
    function solarYearOf(date) {
        date = date || new Date();
        var y = date.getFullYear(), spring = new Date(sunAt(315, Date.UTC(y, 1, 4)));
        if (date < spring) { y -= 1; spring = new Date(sunAt(315, Date.UTC(y, 1, 4))); }
        var p = pillar(y - 4); p.year = y; p.from = spring; return p;
    }
    function monthOf(date) {   // the solar month of the pillars: the tiger's begins when the Sun reaches 315°, the spring's start
        date = date || new Date();
        var lon = sunLon(date.getTime()), k = Math.floor(Z.rev(lon - 315) / 30), branch = mod(k + 2, 12);
        var yearStem = solarYearOf(date).stem, ys = STEMS.indexOf(yearStem);
        var stem = mod((ys % 5) * 2 + 2 + k, 10);
        var p = pillar(0); p.stem = STEMS[stem]; p.branch = BRANCHES[branch]; p.name = p.stem.c + p.branch.c; p.pinyin = p.stem.pinyin + " " + p.branch.pinyin; p.element = p.stem.element; p.yang = p.stem.yang; p.animal = p.branch.animal; p.index = null;
        return p;
    }
    function dayOf(date) {   // the civil day where the date is read, by the local clock; 2000 Jan 1 was 戊午
        date = date || new Date();
        var local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()), jdn = Math.floor(local / DAY) + 2440588;
        if (date.getHours() >= 23) jdn += 1;                                           // the rat's hour belongs to the next day
        return pillar(jdn + 49);
    }
    function hourOf(date) {
        date = date || new Date();
        var h = date.getHours(), branch = Math.floor(((h + 1) % 24) / 2), ds = STEMS.indexOf(dayOf(date).stem);
        var p = pillar((ds % 5) * 2 + branch); p.branch = BRANCHES[branch]; p.name = p.stem.c + p.branch.c; p.pinyin = p.stem.pinyin + " " + p.branch.pinyin; p.animal = p.branch.animal; p.index = null;
        return p;
    }
    function pillars(date) { date = date || new Date(); return { date: date, year: solarYearOf(date), lunarYear: yearOf(date), month: monthOf(date), day: dayOf(date), hour: hourOf(date) }; }
    // The lunar date: the month and day of the month the date falls in.
    function lunar(date) {
        date = date || new Date();
        var y = yearOf(date).year, ms = months(y + 1).concat(months(y)), d = cnDay(date.getTime());
        var m = ms.filter(function (x) { return d >= x.start && d < x.end; })[0];
        return m ? { month: m.n, leap: m.leap, day: d - m.start + 1, length: m.end - m.start } : null;
    }
    window.East = { STEMS: STEMS, BRANCHES: BRANCHES, ELEMENTS: ELEMENTS, TRINES: TRINES, pillar: pillar, months: months, newYear: newYear, newMoons: newMoons, sunAt: sunAt, yearOf: yearOf, solarYearOf: solarYearOf, monthOf: monthOf, dayOf: dayOf, hourOf: hourOf, pillars: pillars, lunar: lunar };
})();
