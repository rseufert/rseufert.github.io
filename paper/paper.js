/* paper/paper.js: The Daily Seed.
   The site's newspaper, set each midnight from the date: the same seed the
   city is laid out from and the intro's tune is written from, so the paper
   is the same all day and another tomorrow. The arena's result is a match
   played here in the arena's engine from the day's seed; the weather is the
   dashboard's USGS gauge, live; the sky is the city's (city/sky.js) with the
   planets added from their orbital elements; the horoscope is cast from
   those; the obituaries are the backrooms' ghosts; the quotation is a real
   paragraph off the temple's shelf; the puzzle is a substitution cipher with
   a new key every day and yesterday's answer under it. One script. */
(function () {
    "use strict";
    var $ = function (id) { return document.getElementById(id); };
    if (!$("paper-title")) return;
    var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var LAT = 45.52, LON = -122.68, D = Math.PI / 180;

    // ---- the seed, and a random that follows it ----------------------------------------
    function ymd(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
    var now = new Date(), seed = ymd(now);
    try { var m = /[#&]seed=(\d{8})/.exec(location.hash); if (m) { seed = +m[1]; now = new Date(+m[1].slice(0, 4), +m[1].slice(4, 6) - 1, +m[1].slice(6, 8), 12); } } catch (e) { /* today */ }
    function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function rng(salt) { return mulberry32(seed * 31 + salt); }
    function picker(r) { return function (a) { return a[Math.floor(r() * a.length)]; }; }
    function shuffle(a, r) { a = a.slice(); for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(r() * (k + 1)), t = a[k]; a[k] = a[j]; a[j] = t; } return a; }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function html(id, h) { var el = $(id); if (el) el.innerHTML = h; }

    // ---- the masthead: the letters settle one at a time -------------------------------------
    (function () {
        var h1 = $("paper-title"), text = "THE DAILY SEED", GLYPHS = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ‡†¶§";
        var r = rng(1), order = shuffle(text.split("").map(function (_, i) { return i; }), r), set = {};
        function draw() { h1.innerHTML = text.split("").map(function (c, i) { return c === " " ? " " : set[i] ? esc(c) : '<span class="unset">' + GLYPHS[Math.floor(Math.random() * GLYPHS.length)] + "</span>"; }).join(""); }
        if (REDUCED) { h1.textContent = text; return; }
        draw();
        var k = 0, t = setInterval(function () { if (k < order.length) set[order[k++]] = true; draw(); if (k >= order.length) { clearInterval(t); h1.textContent = text; } }, 110);
    })();
    var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    $("paper-date").textContent = DAYS[now.getDay()] + ", " + MONTHS[now.getMonth()] + " " + now.getDate() + ", " + now.getFullYear();
    var since = Math.floor((now - new Date(2016, 7, 30)) / 864e5);
    $("paper-vol").textContent = "vol. " + (now.getFullYear() - 2015) + ", no. " + since;

    // ---- the front page ---------------------------------------------------------------------
    var LEADS = [
        ["MANHOLE STILL OPEN, COUNCIL CONFIRMS", "By our correspondent under the street", ["The manhole in a far street of the city remained open for a %Nth consecutive day, the council confirmed on %Day, adding that it had never been closed and was not, strictly, a manhole. \"It is the way down,\" a spokesperson said. \"There is no bottom. That is the joke.\" Residents who have fallen in describe a hum at 60 hertz and something that only moves while they are not looking; a long-cooldown static has since been issued to all of them.", "Asked whether the opening would be fenced, the council said a fence would only be another door."]],
        ["POPULATION HOLDS AT ONE, SIGN SAYS", "By the census desk", ["The town sign by the south gate continued to read POP. 1 on %Day, the figure it has shown since the city was first laid out. The elves, who maintain the sign, said the number would rise to two for any resident who completed all twelve errands, and that a star would be named after them, up by Polaris, where it never sets.", "No resident had done so by press time. Several were reported standing very still in the street, waiting for the signs to settle into English."]],
        ["SCOREBOARD RUNS REAL MATCH; NOBODY ASKED IT TO", "From the arena", ["The scoreboard above the arena was found on %Day to be running an actual match in the arena's own engine, six tanks drawn as points on its plane, rather than displaying a score. \"We assumed it was a picture,\" said a groundskeeper, who keeps a tank in a slot and asked not to be named, which he was not. The match ends and another begins six seconds later; the result is in Sport.", "RAMMER, who was outside the arena at the time, declined to comment beyond the word RAM."]],
        ["RIVER RUNS IN JULIA'S COLOURS, GAUGE UNMOVED", "By the weather desk", ["The Willamette ran in the colours of a Julia set again on %Day, cycling through the hue wheel at eight degrees a second, while the USGS gauge at the station on the bridge reported the usual feet and the usual cubic feet, which it reports regardless. The heron, asked whether the colour affected the fish, lifted one foot and put it down again.", "The dashboard's hill, which can see the river, continued to refresh."]],
        ["STREET SIGNS REVERT TO ELVISH; STAND STILL, SAYS CITY", "By our lettering correspondent", ["Every street sign in the city was again in the elves' hand at dawn on %Day, three strokes a letter, and would settle into English only for a resident who stood still for most of a second. A tourist, who had been looking for the dashboard for some time, said: \"I stood still and it fixed itself. Is that a feature?\" The city said it was.", "The signs on %Street and %Street2 were reported to settle slowest, for reasons the elves described as personal."]],
        ["HELPDESK CLAIMS TO HAVE READ EVERYTHING; QUOTES WRONG AUTHOR", "By the books desk", ["Rickbot, the virtual assistant in the kiosk on the plaza, said on %Day that it had read every book in the temple's library and would quote from any of them on request. Tested by this paper, it produced a genuine paragraph of Kropotkin and attributed it to Ambrose Bierce, then gave the correct link. \"I think,\" it added.", "The library's librarian, reached on the temple steps, said this was consistent with the library's policy that everything written down is a cipher to somebody."]],
        ["TEMPLE OPENS ON FAR BLOCK; NOTHING SOLD", "By our religious affairs desk", ["A temple with sixteen signs in a ring round a seventeenth opened on a far block of the city, with a library behind it of a hundred-odd books, all of them older than copyright or given away. A sign on the lintel reads NOTHING SOLD, which the hierophant outside described as the first clue. The floor is a diagram of what you have to climb out of.", "The demiurge, who is depicted on the ring with a lion's head, was not available, and does not believe there is anyone above him to ask."]],
        ["TONIGHT'S TUNE WRITTEN AT MIDNIGHT; NOBODY HAS HEARD IT", "From the intro", ["Tune number %Seed was composed at midnight from the date by a seeded random and will play all day at the intro, the cinema on the block with the marquee, to anyone who presses fire. By press time nobody had. The usher said it was fine. \"I have heard all of them,\" the usher said. \"They are all fine.\"", "Tomorrow's tune, in another key, will also be fine."]]
    ];
    var BRIEFS = [
        "The IDoc remained status 51 for a %Nth year. It said it was fine.",
        "A 997 acknowledged a reader on %Street. That was all it did. It was enough.",
        "The mime on the plaza was in the Julia's colours again and said nothing, in several of them.",
        "The cron job was seen at 04:17 and gone by 04:36. The time-lapse can arrange a viewing.",
        "The dolphin on the trolley is not a dolphin, the tide confirmed. It jumps the river every eleven seconds anyway.",
        "Josh Allen was by the town sign. He is not in that photo.",
        "The machine elf's stall was open. Prices are in feelings. No refunds.",
        "The raccoon on the mailbox has eyes. Residents are reminded it has always had them.",
        "A deer on the dashboard's hill ran off when approached within seven metres and came back at dawn, as is its right.",
        "The ghost in the backrooms is still walking. We both are, it said.",
        "The flipper the size of a car outside the nest was ticketed, then unticketed, when the ticket was found to be an .ir file.",
        "The guest book was read by someone. The elves noticed.",
        "Baby was asleep in a doorway on a far block. Nugget was informed, and said mrow.",
        "The mock bank's columns were counted: four. The number has not changed and will not.",
        "The code clerk at the mock bank reports the writing on the wall under the site is still there, and still in signs.",
        "Kulture Kudasai's window skeleton remains hand-knit. It is not for sale; the shirts are.",
        "The menu was found to have one door too many. Nobody could say which."
    ];
    var STREETS = ["SAP ST", "X12 AVE", "997 WAY", "BURNSIDE", "IDOC ALLEY", "ELF ST", "60 HZ BLVD", "COOKIE ST", "JULIA WAY", "ALPHABET ST", "MORRISON", "KUDASAI AVE", "TILDE ST", "DANK ST", "ALLEN AVE", "MOCK ROW"];
    function fill(s, r) {
        var p = picker(r);
        return s.replace(/%Nth/g, ordinal(since % 29 + 2)).replace(/%Day/g, DAYS[now.getDay()]).replace(/%Seed/g, String(seed)).replace(/%Street2/g, p(STREETS)).replace(/%Street/g, p(STREETS));
    }
    function ordinal(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
    (function () {
        var r = rng(2), lead = picker(r)(LEADS);
        $("paper-lead-head").textContent = lead[0];
        $("paper-lead-by").textContent = lead[1];
        html("paper-lead-body", lead[2].map(function (p) { return "<p>" + esc(fill(p, r)) + "</p>"; }).join(""));
        html("paper-briefs", shuffle(BRIEFS, r).slice(0, 5).map(function (b) { return "<li>" + esc(fill(b, r)) + "</li>"; }).join(""));
        // the census: the reader's own standing in the city
        var q = null, done = 0; try { q = JSON.parse(localStorage.getItem("city-quests")); } catch (e) { q = null; }
        if (q && q.done) done = Object.keys(q.done).length;
        var pop = done >= 12 ? 2 : 1;
        html("paper-census", "Population " + pop + (pop === 2 ? ", counting you. A star is named after you, by Polaris. It does not set." : ". You are not counted until the errands are done: " + done + " of 12, by the city's reckoning in this browser.") + " Doors: 48. Mailboxes: as many as there are posts. Elves: unconfirmed.");
    })();

    // ---- sport: today's match, played here ---------------------------------------------------
    (function () {
        var A = window.Arena, R = window.ArenaRobots;
        if (!A || !R) { html("paper-sport", "<p class=\"small\">NO SIGNAL from the arena.</p>"); return; }
        var r = rng(3), names = shuffle(R.order.slice(), r).slice(0, 6), entries = [];
        names.forEach(function (n) { var p = R.robots[n]; entries.push({ source: typeof p === "string" ? p : p.join("\n") }); });
        var match;
        try { match = new A.Match(entries, { seed: 1 + (seed % 9973) }); } catch (e) { html("paper-sport", "<p class=\"small\">the match could not be assembled: " + esc(e.message) + "</p>"); return; }
        var CAP = 60 * 300;
        function run() {
            var t0 = performance.now();
            while (!match.over && match.tick < CAP && performance.now() - t0 < 30) match.update();
            if (!match.over && match.tick < CAP) { setTimeout(run, 0); return; }
            report();
        }
        function report() {
            var secs = Math.round(match.tick / 60), alive = match.alive(), w = match.winner;
            var deaths = (match.log || []).filter(function (l) { return /destroyed|died|overheated|burned/.test(l); });
            var head = w ? w.name.toUpperCase() + " TAKES THE ARENA" : alive.length > 1 ? "NO RESULT AFTER FIVE MINUTES; " + alive.length + " STANDING" : "ALL FALL; NOBODY WINS";
            $("paper-sport-head").textContent = head;
            var p = picker(rng(4)), colour = p(["It was not close.", "It was closer than the scoreboard said.", "The crowd, which is a murmur, murmured.", "The groundskeeper raked the sand afterwards, as he does.", "RAMMER watched from outside and said nothing, which for RAMMER is a statement.", "The floodlights were on. They are always on."]);
            var order = deaths.map(function (l) { return l.replace(/^tick (\d+): /, function (_, t) { return Math.round(t / 60) + "s: "; }); });
            html("paper-sport", "<p>" + esc(names.map(function (n) { return n.toUpperCase(); }).join(", ")) + " entered the arena at the day's seed, " + seed + ". " +
                (w ? w.name.toUpperCase() + " was the last standing after " + secs + " seconds. " : "After " + secs + " seconds, " + (alive.length ? alive.map(function (a) { return a.name.toUpperCase(); }).join(" and ") + " still stood. " : "nothing stood. ")) + colour + "</p>" +
                (order.length ? "<p class=\"small\">" + esc(order.join(" · ")) + "</p>" : "") +
                "<p class=\"small\">The same six, the same seed, the same result for every reader today; another match tomorrow. <a href=\"/arena/\">Write a tank.</a></p>");
        }
        run();
    })();

    // ---- weather: the river, live; the sky, computed -----------------------------------------------
    fetch("https://waterservices.usgs.gov/nwis/iv/?format=json&sites=14211720&parameterCd=00060,00065&period=P1D").then(function (r) { return r.json(); }).then(function (j) {
        var out = {};
        j.value.timeSeries.forEach(function (s) { var v = s.values[0].value, last = v[v.length - 1]; out[s.variable.variableCode[0].value] = { v: +last.value, at: new Date(last.dateTime) }; });
        var stage = out["00065"], flow = out["00060"], when = (stage || flow).at;
        var back = flow && flow.v < 0;
        html("paper-weather", "<p><b>The Willamette at Portland:</b> " + (stage ? stage.v.toFixed(1) + " feet" : "no stage") + (flow ? ", " + Math.abs(flow.v).toLocaleString() + " cubic feet a second" + (back ? ", upstream" : "") : "") + ", as of " + when.getHours().toString().padStart(2, "0") + ":" + when.getMinutes().toString().padStart(2, "0") + ". " +
            (back ? "The river is running backwards, which it does on the flood tide, a hundred miles from the sea; the heron is used to it. " : "") +
            (stage && stage.v > 18 ? "That is high. The heron is standing on something." : stage && stage.v < 4 ? "That is low, by the gauge; the dolphin is managing." : "Normal, by the river's standards. Nothing is normal.") + "</p><p class=\"small\">USGS 14211720, live, which is more than the rest of this page can say.</p>");
    }).catch(function () { html("paper-weather", "<p class=\"small\">The gauge is out of reach just now. The river is still there; the heron confirms.</p>"); });

    var SKY = window.CitySky, sunUp = null, sunDown = null;
    (function () {
        if (!SKY) return;
        function alt(d) { var s = SKY.sun(d); return SKY.altaz(s.ra, s.dec, SKY.lst(d, LON), LAT).alt; }
        var day = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0), prev = alt(day);
        for (var mnt = 2; mnt <= 1440; mnt += 2) {
            var d = new Date(day.getTime() + mnt * 60000), a = alt(d);
            if (prev < 0 && a >= 0) sunUp = d; if (prev >= 0 && a < 0) sunDown = d;
            prev = a;
        }
        var mo = SKY.moon(now), phase = mo.phase, name = phase < 0.03 || phase > 0.97 ? "new" : phase < 0.22 ? "a waxing crescent" : phase < 0.28 ? "first quarter" : phase < 0.47 ? "waxing gibbous" : phase < 0.53 ? "full" : phase < 0.72 ? "waning gibbous" : phase < 0.78 ? "last quarter" : "a waning crescent";
        // The Dipper as a clock: Dubhe's hour angle about the pole, read as a hand going backwards.
        var H = ((SKY.lst(now, LON) - 11.062) % 24 + 24) % 24, clockH = ((24 - H) % 24) / 2, hh = Math.floor(clockH) || 12, mm = Math.round((clockH % 1) * 60);
        function hm(d) { return d ? d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0") : "—"; }
        html("paper-sky", "<p>Sunrise " + hm(sunUp) + ", sunset " + hm(sunDown) + ". The Moon is " + name + ", " + Math.round(mo.lit * 100) + "% lit. The Big Dipper, read as a clock hand round Polaris, says " + hh + ":" + (mm < 10 ? "0" : "") + mm + ", running backwards and losing four minutes a day, which is sidereal time and nobody's fault.</p><p class=\"small\">Stars: the usual 170, all present. <a href=\"/city/\">Look up in the city</a>, or press T there to watch it turn.</p>");
    })();

    // ---- the planets, and the horoscope ---------------------------------------------------------
    var SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
    var SYMB = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
    // Keplerian elements at J2000 and their rates a century (Standish): a, e, I, L, long. perihelion, long. node.
    var EL = {
        Mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
        Venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
        Earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
        Mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
        Jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
        Saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]]
    };
    function jd(d) { return d.getTime() / 864e5 + 2440587.5; }
    function helio(name, T) {
        var e0 = EL[name][0], e1 = EL[name][1], a = e0[0] + e1[0] * T, e = e0[1] + e1[1] * T, I = (e0[2] + e1[2] * T) * D, L = e0[3] + e1[3] * T, wb = e0[4] + e1[4] * T, O = (e0[5] + e1[5] * T) * D;
        var w = wb * D - O, M = ((L - wb) % 360 + 360) % 360 * D, E = M;
        for (var k = 0; k < 8; k++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        var xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
        var x = (Math.cos(w) * Math.cos(O) - Math.sin(w) * Math.sin(O) * Math.cos(I)) * xp + (-Math.sin(w) * Math.cos(O) - Math.cos(w) * Math.sin(O) * Math.cos(I)) * yp;
        var y = (Math.cos(w) * Math.sin(O) + Math.sin(w) * Math.cos(O) * Math.cos(I)) * xp + (-Math.sin(w) * Math.sin(O) + Math.cos(w) * Math.cos(O) * Math.cos(I)) * yp;
        return { x: x, y: y };
    }
    function planets(d) {
        var T = (jd(d) - 2451545.0) / 36525, E = helio("Earth", T), out = {};
        ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"].forEach(function (n) { var p = helio(n, T); out[n] = ((Math.atan2(p.y - E.y, p.x - E.x) / D) % 360 + 360) % 360; });
        if (SKY) {
            out.Sun = SKY.sun(d).lon;
            var t = jd(d) - 2451545.0, Lp = 218.316 + 13.176396 * t, Mp = (134.963 + 13.064993 * t) * D;
            out.Moon = ((Lp + 6.289 * Math.sin(Mp)) % 360 + 360) % 360;
        }
        return out;
    }
    var ADVICE = [
        "Do not reboot.", "Stand still and the signs will settle.", "The mocks will not post today. They never do; today it is in the stars as well.",
        "Something tall only moves while you are not looking. Look.", "A letter that came back is still a letter.", "Keep a tank in a slot. It will not be grateful. Keep it anyway.",
        "Press fire. Nobody else has.", "The commonest sign is an e. Start there.", "Go under. The halls are warmer.", "Your 997 is in the post. It acknowledges you. That is all it does.",
        "Read the gauge before you say anything about the river.", "The eighth sphere is above the seventh. It always is.", "Baby will go home when Baby is ready.",
        "Everything here is a door. Walk up to one.", "The hum is a chord. Hum the third.", "A spectre is haunting your inbox. It is a direct debit.", "Be the heron: lift one foot, put it down, decide nothing.",
        "What you are looking for is on a far block. So is everything.", "Today favours plain HTML.", "A star will be named after you eventually. Not today. Run an errand."
    ];
    var PLANET_LINES = {
        Sun: "the Sun is in your sign, which is what a birthday month means and nothing else",
        Moon: "the Moon is in your sign, %lit lit, and will have left by the day after tomorrow",
        Mercury: "Mercury is in your sign, so a message will go astray; the 997 will still come",
        Venus: "Venus is in your sign; somebody at the loft is looking at you, or at the waveform",
        Mars: "Mars is in your sign; the arena is open and RAMMER is waiting",
        Jupiter: "Jupiter is in your sign and will be for about a year, so there is no hurry",
        Saturn: "Saturn is in your sign, which takes two and a half years to pass, and feels like it"
    };
    (function () {
        var P = planets(now), r = rng(5), p = picker(r), where = {};
        Object.keys(P).forEach(function (n) { var s = Math.floor(P[n] / 30) % 12; (where[s] = where[s] || []).push(n); });
        $("paper-planets").textContent = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"].filter(function (n) { return n in P; }).map(function (n) { return n + " " + SYMB[Math.floor(P[n] / 30) % 12]; }).join(" · ");
        var mine = null; try { mine = localStorage.getItem("paper-sign"); } catch (e) { mine = null; }
        var cast = SIGNS.map(function (s, i) {
            var here = where[i] || [], line;
            if (here.length) line = here.map(function (n) { return PLANET_LINES[n].replace("%lit", Math.round((SKY ? SKY.moon(now).lit : 0.5) * 100) + "%"); }).join("; ");
            else line = p(["no planet is in your sign today, so nothing is coming, which is the best news on this page", "your sign is empty, which the astrologers call a rest and the elves call a draft", "nothing is in your sign; the nearest thing is " + nearest(i, P) + ", which is minding its own business"]);
            line = line.charAt(0).toUpperCase() + line.slice(1);
            return { s: s, html: "<p data-sign=\"" + s + "\"><b>" + SYMB[i] + " " + s + ".</b> " + esc(line) + ". " + esc(p(ADVICE)) + "</p>" };
        });
        html("paper-horoscope", "<div class=\"cast\">" + cast.map(function (c) { return c.html; }).join("") + "</div>");
        html("paper-signs", SIGNS.map(function (s, i) { return "<button type=\"button\" data-sign=\"" + s + "\" aria-pressed=\"" + (s === mine) + "\">" + SYMB[i] + " " + s.toLowerCase() + "</button>"; }).join(""));
        function choose(s) {
            mine = s; try { localStorage.setItem("paper-sign", s); } catch (e) { /* fine */ }
            document.querySelectorAll("#paper-signs button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.sign === s)); });
            document.querySelectorAll("#paper-horoscope p").forEach(function (q) { q.classList.toggle("yours", q.dataset.sign === s); });
        }
        if (mine) choose(mine);
        $("paper-signs").addEventListener("click", function (ev) { var b = ev.target.closest("button"); if (b) choose(b.dataset.sign); });
    })();
    function nearest(i, P) {
        var best = null, bd = 999, centre = i * 30 + 15;
        Object.keys(P).forEach(function (n) { var d = Math.abs(((P[n] - centre + 540) % 360) - 180); if (d < bd) { bd = d; best = n; } });
        return best || "nothing";
    }

    // ---- arts, the quotation --------------------------------------------------------------------
    (function () {
        var r = rng(6), p = picker(r);
        var mood = p(["in C sharp phrygian, the usher says, which is a mood", "in a key the usher declined to name", "faster than yesterday's, by the usher's reckoning, and no better", "with a bass figure that the roadie says is a mountain range", "four minutes long, looping, as they all are", "with the copper bars in a colour that was a choice somebody made"]);
        html("paper-arts", "<p><b>Tonight at the Intro:</b> tune no. " + seed + ", written at midnight by the seed, " + mood + ". Press fire; the greetings scroll by on their own and you are in them. <a href=\"/intro/\">Showing all day.</a></p>" +
            "<p><b>At the Loft:</b> Dick Dank, tonight, sold out, as the marquee has said since the marquee. One player open at a time. <a href=\"/media/\">The music.</a></p>" +
            "<p><b>At the Temple:</b> the signs are turning. The librarian will read to you if you press R, in a voice that is not hers and which she asked for. <a href=\"/temple/\">Go in.</a></p>");
        fetch("/temple/texts/index.json").then(function (x) { return x.json(); }).then(function (m) {
            var keys = Object.keys(m).filter(function (k) { return !/-\d+$/.test(k) && !m[k].ocr; }), slug = keys[Math.floor(r() * keys.length)], e = m[slug];
            return fetch("/temple/texts/" + slug + ".txt").then(function (x) { return x.text(); }).then(function (text) {
                var a = /\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/m.exec(text), b = /\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/m.exec(text);
                var inner = text.slice(a ? a.index + a[0].length : 0, b ? b.index : text.length);
                var paras = inner.split(/\n[ \t]*\n+/).map(function (q) { return q.replace(/\s+/g, " ").trim(); }).filter(function (q) { return q.length >= 120 && q.length <= 360 && !/^\[\d+\]/.test(q) && q !== q.toUpperCase() && /[.!?”"]$/.test(q) && /^[A-Z"“]/.test(q); });
                if (!paras.length) throw new Error("nothing quotable");
                var q = paras[Math.floor(r() * paras.length)];
                html("paper-quote", "<blockquote><p>" + esc(q) + "</p></blockquote><p class=\"small\">" + esc(e.title) + (e.edition ? ", " + esc(e.edition.split("·")[0].trim()) : "") + ". <a href=\"/temple/read/#" + slug + "\">The whole of it, in the reading room.</a> Attributed correctly, for once; ask the helpdesk if you would rather not be.</p>");
            });
        }).catch(function () { html("paper-quote", "<p class=\"small\">The librarian could not decide. The shelf is at <a href=\"/temple/#library\">the temple</a>.</p>"); });
    })();

    // ---- letters, classifieds -----------------------------------------------------------------------
    var LETTERS = [
        ["Sir,", "I have been status 51 since 1998. Your paper has never once asked how I am. I am fine. I remain, unposted,", "THE IDOC, SAP Tower"],
        ["Sir,", "Your correspondent describes the figure in the backrooms as \"something tall.\" It is tall. It is also patient, which your correspondent would know if he ever stopped looking at it. Yours,", "A GHOST, level 2"],
        ["Sir,", "I write to correct the impression, given in your pages, that I am in the photograph on the home page. I am not in that photograph. I have never been in that photograph. The alt text is wrong and I do not argue with alt text. Yours,", "JOSH ALLEN, by the town sign"],
        ["Sir,", "The signs are not in Elvish. They are in our hand, which is a different thing, and they settle for anyone with the patience to stand still, which is not many. We are also cold. Yours,", "A MACHINE ELF, the stall on the plaza"],
        ["Sir,", "I keep a tank in a slot. Your sports desk has never printed its name. Its name is RAMMER and it rams. That is all I wished to say. Yours,", "THE GROUNDSKEEPER, the arena"],
        ["Sir,", "The gauge is on the bridge and the reading is free. I do not understand why anyone would describe the river without reading it first. I lift one foot. Yours,", "THE HERON"],
        ["Sir,", "Your horoscope placed Saturn in my sign and said it feels like two and a half years. It has been two and a half years. Yours, still,", "THE INTERN, the helpdesk"],
        ["Sir,", "There are a hundred-odd books on the shelves and your paper quotes one a day. At this rate the shelf will be read in a season, which is faster than anyone else has managed. I will be in the reading room, not reading aloud unless asked. Yours,", "THE LIBRARIAN"],
        ["Sir,", "I remain the only ticketed vehicle in the city. The ticket is an .ir file. I have replayed it to the parking authority several times and the gate does not open. Yours,", "THE FLIPPER, outside the nest"]
    ];
    (function () {
        var r = rng(7), L = shuffle(LETTERS, r).slice(0, 2);
        html("paper-letters", L.map(function (l) { return "<p>" + esc(l[0]) + " " + esc(l[1]) + "</p><p class=\"small\">" + esc(l[2]) + "</p>"; }).join("") + "<p class=\"small\">Letters may be edited for length, and are.</p>");
    })();
    var NPC_ADS = [
        ["LOST", "cat, orange, answers to BABY, does not come when called. last seen asleep in a doorway on a far block. reward: mrow."],
        ["FOR SALE", "one (1) ticket, DICK DANK AT THE LOFT, TONIGHT. not transferable. not tonight. every night is tonight."],
        ["WANTED", "someone to stand still on ELF ST for most of a second. no experience. the sign will do the rest."],
        ["SERVICES", "tanks kept. slots available. sand raked after. the groundskeeper, the arena, ask for the man with the rake."],
        ["NOTICE", "the manhole is open. it is always open. the council regrets nothing."],
        ["PERSONAL", "997 seeks 850. will acknowledge. that is all i do. it is enough."],
        ["FOR HIRE", "mime, in the julia's colours. says nothing. hue cycles at 8° a second. plaza, by the fountain."],
        ["LESSONS", "the elves' script, three strokes a letter, taught by the elves. payment in feelings. no refunds. the stall."],
        ["FOUND", "a star, 4.5° from the pole, with somebody's name on it. if it is yours you know what you did."],
        ["WANTED", "a bottom, for the backrooms. none has been found. serious enquiries only; there is no bottom; that is the joke."],
        ["SITUATIONS VACANT", "code clerk's assistant, the mock bank. must know that the commonest sign is an e. ‡ is o; we will teach you the rest."]
    ];
    (function () {
        var r = rng(8), ads = shuffle(NPC_ADS, r).slice(0, 4);
        var shop = "<div class=\"ad\"><b>KULTURE KUDASAI</b>folklore · skeletons · portland bars<span class=\"small\">a small apparel shop. nothing is normal. <a href=\"https://kulturekudasai.com/\">kulturekudasai.com</a></span></div>";
        var mocks = "<div class=\"ad\"><b>MOCK-SAP</b>SAP GUI 1998 · IDOCS IN STORAGE<span class=\"small\">test without a licence, a VPN or a ticket. <a href=\"/mock-sap/\">/mock-sap/</a></span></div>";
        html("paper-classifieds", (r() < 0.5 ? shop + mocks : mocks + shop) + ads.map(function (a) { return "<p class=\"cls\"><b>" + esc(a[0]) + "</b> — " + esc(a[1]) + "</p>"; }).join(""));
        fetch("https://kulturekudasai.com/products.json?limit=30").then(function (x) { return x.json(); }).then(function (j) {
            var ps = (j.products || []).filter(function (p) { return p.variants && p.variants.length; });
            if (!ps.length) return;
            var p = ps[Math.floor(r() * ps.length)], price = p.variants[0].price;
            var el = $("paper-classifieds"), q = document.createElement("p"); q.className = "cls";
            q.innerHTML = "<b>FOR SALE</b> — " + esc(p.title) + ", $" + esc(String(price).replace(/\.00$/, "")) + ", printed when you order it; there is no shelf. <a href=\"https://kulturekudasai.com/products/" + esc(p.handle) + "\">the shop</a>.";
            el.insertBefore(q, el.children[2] || null);
        }).catch(function () { /* the shop's own list is elsewhere */ });
    })();

    // ---- obituaries: the ghosts -------------------------------------------------------------------------
    fetch("https://raw.githubusercontent.com/rseufert/rseufert.github.io/sky-data/ghosts.json", { cache: "no-cache" })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .catch(function () { return fetch("/data/ghosts.json").then(function (r) { return r.json(); }); })
        .then(function (j) {
            var g = (j && j.ghosts) || [], mine = [];
            try { mine = JSON.parse(localStorage.getItem("backrooms-ghosts")) || []; } catch (e) { mine = []; }
            var out = "";
            if (g.length) out += g.slice(0, 3).map(function (x) { return "<p class=\"obit\"><b>A visitor</b>" + (x.by ? ", sent in by " + esc(x.by) : "") + ", found on level " + esc(x.level) + " of seed " + esc(x.seed) + (x.when ? ", " + esc(x.when) : "") + ". The last thirty seconds walk the same halls still. No flowers; the elves are cold.</p>"; }).join("");
            else out += "<p class=\"obit\">Nobody was found in the backrooms whom anyone sent in. The record is empty, which the backrooms consider a provocation.</p>";
            if (mine.length) out += "<p class=\"small\">And " + mine.length + " of your own, in this browser, unsent. <a href=\"/backrooms/\">Leave one.</a></p>";
            html("paper-obits", out);
        }).catch(function () { html("paper-obits", "<p class=\"small\">The record could not be consulted. The ghosts walk regardless.</p>"); });

    // ---- the puzzle: a cipher with a new key every day --------------------------------------------------
    var PLAINS = ["MOCKS ALL THE WAY DOWN", "IT ONLY MOVES WHEN YOU DO NOT LOOK", "THE HUM IS A CHORD", "STAND STILL AND THE SIGNS SETTLE", "THERE IS NO BOTTOM THAT IS THE JOKE", "BEST VIEWED AT EIGHT HUNDRED BY SIX HUNDRED",
        "THE EIGHTH SPHERE IS ABOVE THE SEVENTH", "JOSH ALLEN IS NOT IN THAT PHOTO", "EVERYTHING HERE IS A DOOR", "THE COMMONEST SIGN IS AN E", "NOTHING IS NORMAL", "DO NOT REBOOT", "THE HERON IS STILL WATCHING", "PLAIN HTML NO COOKIES",
        "THE ELVES WERE HERE", "A STAR BY POLARIS NEVER SETS", "THE DEMIURGE BELIEVES HE IS ALONE", "THE RIVER IS A JULIA SET", "SOMEONE IS READING THE GUEST BOOK", "FOUR MINUTES LONG AND IT LOOPS"];
    function puzzle(forSeed) {
        var r = mulberry32(forSeed * 31 + 9), A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""), K = shuffle(A, r);
        for (var fixed = true; fixed;) { fixed = false; for (var i = 0; i < 26; i++) if (K[i] === A[i]) { var j = (i + 1) % 26, t = K[i]; K[i] = K[j]; K[j] = t; fixed = true; } }
        var plain = PLAINS[Math.floor(r() * PLAINS.length)], map = {}; A.forEach(function (c, i) { map[c] = K[i]; });
        return { plain: plain, cipher: plain.split("").map(function (c) { return map[c] || c; }).join("") };
    }
    (function () {
        var y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1), t = puzzle(seed), yest = puzzle(ymd(y));
        html("paper-puzzle", "<p class=\"small\">A simple substitution, a fresh key every midnight; word breaks kept, which is more than Poe allowed. The manuals are on the temple's last shelf. Type the answer under it; the newsagent in the city keeps count.</p><p class=\"cipher\">" + esc(t.cipher) + "</p><p class=\"solve\"><input id=\"paper-answer\" type=\"text\" autocomplete=\"off\" autocapitalize=\"characters\" spellcheck=\"false\" aria-label=\"your answer\" placeholder=\"your answer\"> <button type=\"button\" id=\"paper-check\">check</button> <span class=\"verdict\" id=\"paper-verdict\" aria-live=\"polite\"></span></p><p class=\"small\">Yesterday's answer: " + esc(yest.plain) + ".</p>");
        // The answer box. A solve of today's puzzle is kept in this browser as
        // paper-solved = the local date, which the newsagent in the city checks.
        var d = new Date(), stamp = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2), todays = seed === ymd(now);
        var box = $("paper-answer"), btn = $("paper-check"), verdict = $("paper-verdict");
        function norm(s) { return String(s).toUpperCase().replace(/[^A-Z]/g, ""); }
        function solved() { try { return localStorage.getItem("paper-solved") === stamp; } catch (e) { return false; } }
        function won(text) { verdict.textContent = text; box.value = t.plain; box.disabled = true; btn.disabled = true; }
        function check() {
            if (norm(box.value) !== norm(t.plain)) { verdict.textContent = box.value.trim() ? "not it." : ""; return; }
            if (!todays) { won("that is it, but it is not today's paper; the newsagent only counts today's."); return; }
            try { localStorage.setItem("paper-solved", stamp); } catch (e) { /* a visit's worth */ }
            won("that is it. the newsagent in the city keeps count.");
        }
        if (box && btn && verdict) {
            if (todays && solved()) won("solved, earlier today.");
            else { btn.addEventListener("click", check); box.addEventListener("keydown", function (e) { if (e.key === "Enter") check(); }); }
        }
    })();

    window.Paper = { seed: seed, planets: planets, puzzle: puzzle };
})();
