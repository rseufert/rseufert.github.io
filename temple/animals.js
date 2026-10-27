/* temple/animals.js: the animals.
   The twelve earthly branches round a wheel, each with its animal drawn
   in the temple's line, its double-hour and its compass point; the ten
   stems with their elements; the year we are in, named as the almanac
   names it (a stem and a branch, an element and an animal), with the
   New Year it began at by js/east.js's reckoning from the new moons;
   the hour's animal, with a hand that moves; the four pillars of this
   minute, and of any birth you give it. Nothing is stored or sent. One
   script, no library. */
(function () {
    "use strict";
    var E = window.East, canvas = document.getElementById("animals-stage");
    if (!E || !canvas) return;
    var ctx = canvas.getContext("2d"), stage = canvas.parentNode;
    var readOut = document.getElementById("animals-reading"), cellOut = document.getElementById("animals-cell"), bornIn = document.getElementById("animals-born"), bornOut = document.getElementById("animals-you"), cycleOut = document.getElementById("animals-cycle");
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace', HAN = '"Songti SC", "Noto Serif CJK SC", "SimSun", "PingFang SC", "Hiragino Sans", serif';
    var INK = "#7cf5c8", DIM = "#2a5a4a", FAINT = "#163a2e", AMBER = "#ffb000", PAPER = "#020705", DPR = Math.min(2, window.devicePixelRatio || 1);
    var ELEMENT_INK = { Wood: "#7cf5c8", Fire: "#ffb000", Earth: "#d8c27a", Metal: "#cfd8dc", Water: "#7f8cff" };
    var W = 0, now = null, chosen = null, spots = [];

    // ---- a pen for a unit box, and the twelve animals as a few strokes each -----------------------
    function pen(c, cx, cy, s, col, w) {
        var p = { X: function (x) { return cx + x * s; }, Y: function (y) { return cy + y * s; },
            set: function () { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round"; },
            line: function (pts) { p.set(); c.beginPath(); pts.forEach(function (q, i) { c[i ? "lineTo" : "moveTo"](p.X(q[0]), p.Y(q[1])); }); c.stroke(); return p; },
            circle: function (x, y, r, fill) { p.set(); c.beginPath(); c.arc(p.X(x), p.Y(y), r * s, 0, Math.PI * 2); if (fill) c.fill(); else c.stroke(); return p; },
            ellipse: function (x, y, rx, ry, rot) { p.set(); c.beginPath(); c.ellipse(p.X(x), p.Y(y), rx * s, ry * s, rot || 0, 0, Math.PI * 2); c.stroke(); return p; },
            arc: function (x, y, r, a0, a1) { p.set(); c.beginPath(); c.arc(p.X(x), p.Y(y), r * s, a0 * Math.PI / 180, a1 * Math.PI / 180); c.stroke(); return p; } };
        return p;
    }
    var ANIMAL = {
        Rat: function (p) { p.ellipse(0.05, 0.15, 0.5, 0.3); p.circle(-0.6, 0.0, 0.2); p.circle(-0.68, -0.22, 0.08); p.circle(-0.5, -0.22, 0.08); p.circle(-0.78, 0.02, 0.03, true); p.line([[0.55, 0.15], [0.8, -0.1], [0.95, 0.3]]); p.line([[-0.2, 0.45], [-0.2, 0.6]]); p.line([[0.3, 0.45], [0.3, 0.6]]); },
        Ox: function (p) { p.ellipse(0.1, 0.15, 0.6, 0.35); p.circle(-0.65, -0.1, 0.22); p.arc(-0.8, -0.3, 0.18, 180, 320); p.arc(-0.5, -0.3, 0.18, 220, 360); [-0.3, -0.05, 0.3, 0.55].forEach(function (x) { p.line([[x, 0.45], [x, 0.75]]); }); p.line([[0.7, 0.2], [0.85, 0.6]]); },
        Tiger: function (p) { p.ellipse(0.05, 0.15, 0.6, 0.32); p.circle(-0.62, -0.05, 0.24); p.line([[-0.8, -0.25], [-0.72, -0.4], [-0.62, -0.25]]); p.line([[-0.45, -0.25], [-0.5, -0.4], [-0.58, -0.25]]); [-0.3, -0.1, 0.1, 0.3].forEach(function (x) { p.line([[x, -0.1], [x + 0.05, 0.1]]); }); [-0.3, 0.3].forEach(function (x) { p.line([[x, 0.45], [x, 0.75]]); }); p.line([[0.6, 0.0], [0.9, -0.3], [1.0, -0.1]]); },
        Rabbit: function (p) { p.ellipse(0.1, 0.25, 0.45, 0.3); p.circle(-0.45, 0.0, 0.2); p.line([[-0.55, -0.18], [-0.65, -0.75]]); p.line([[-0.42, -0.18], [-0.4, -0.75]]); p.line([[-0.55, -0.18], [-0.65, -0.75]]); p.circle(0.55, 0.15, 0.08); p.line([[-0.1, 0.5], [-0.1, 0.65]]); p.line([[0.3, 0.5], [0.3, 0.65]]); },
        Dragon: function (p) { var pts = []; for (var i = 0; i <= 40; i++) { var t = i / 40; pts.push([-0.9 + t * 1.8, Math.sin(t * Math.PI * 2.5) * 0.3]); } p.line(pts); p.circle(-0.95, -0.05, 0.14); p.line([[-1.05, -0.15], [-1.2, -0.35]]); p.line([[-0.88, -0.17], [-0.8, -0.4]]); p.line([[-1.05, 0.05], [-1.25, 0.12]]); p.line([[-1.05, 0.02], [-1.25, -0.02]]); [-0.5, 0.0, 0.5].forEach(function (x) { p.line([[x, 0.1], [x - 0.1, 0.45]]); p.line([[x, 0.1], [x + 0.1, 0.45]]); }); },
        Snake: function (p) { var pts = []; for (var i = 0; i <= 40; i++) { var t = i / 40; pts.push([-0.9 + t * 1.8, Math.sin(t * Math.PI * 3) * 0.3]); } p.line(pts); p.circle(0.95, 0.0, 0.1); p.line([[1.05, 0.0], [1.2, -0.05]]); p.line([[1.05, 0.0], [1.2, 0.05]]); },
        Horse: function (p) { p.ellipse(0.05, 0.15, 0.55, 0.3); p.line([[0.5, 0.0], [0.75, -0.5]]); p.ellipse(0.82, -0.56, 0.16, 0.09, -0.6); p.line([[0.55, -0.1], [0.72, -0.45]]); [-0.35, -0.15, 0.2, 0.4].forEach(function (x, i) { p.line([[x, 0.42], [x + (i % 2 ? 0.05 : -0.05), 0.8]]); }); p.line([[-0.55, 0.1], [-0.85, 0.45]]); p.line([[-0.5, 0.05], [-0.8, 0.5]]); },
        Goat: function (p) { p.ellipse(0.05, 0.2, 0.5, 0.3); p.circle(-0.55, -0.1, 0.2); p.arc(-0.65, -0.35, 0.15, 180, 360); p.arc(-0.45, -0.35, 0.15, 180, 360); p.line([[-0.6, 0.1], [-0.6, 0.3]]); [-0.3, -0.1, 0.2, 0.4].forEach(function (x) { p.line([[x, 0.48], [x, 0.8]]); }); p.line([[0.55, 0.1], [0.7, 0.0]]); },
        Monkey: function (p) { p.circle(0.0, 0.1, 0.35); p.circle(0.0, -0.45, 0.22); p.circle(-0.22, -0.5, 0.07); p.circle(0.22, -0.5, 0.07); p.line([[-0.3, 0.0], [-0.65, -0.35]]); p.line([[0.3, 0.0], [0.65, -0.35]]); p.line([[-0.2, 0.42], [-0.3, 0.8]]); p.line([[0.2, 0.42], [0.3, 0.8]]); p.arc(0.65, 0.45, 0.3, 180, 420); },
        Rooster: function (p) { p.ellipse(0.0, 0.15, 0.4, 0.3); p.circle(-0.45, -0.3, 0.16); p.line([[-0.5, -0.46], [-0.45, -0.65], [-0.38, -0.5], [-0.3, -0.65], [-0.3, -0.46]]); p.line([[-0.6, -0.28], [-0.78, -0.22]]); p.line([[-0.52, -0.15], [-0.5, -0.02]]); p.line([[0.35, 0.0], [0.7, -0.55]]); p.line([[0.38, 0.1], [0.85, -0.3]]); p.line([[-0.1, 0.45], [-0.1, 0.8]]); p.line([[0.15, 0.45], [0.15, 0.8]]); },
        Dog: function (p) { p.ellipse(0.05, 0.15, 0.5, 0.3); p.circle(-0.55, -0.15, 0.22); p.line([[-0.7, -0.3], [-0.78, 0.05]]); p.line([[-0.38, -0.3], [-0.3, 0.0]]); p.circle(-0.76, -0.12, 0.04, true); [-0.3, -0.1, 0.25, 0.45].forEach(function (x) { p.line([[x, 0.42], [x, 0.75]]); }); p.arc(0.62, 0.0, 0.2, 90, 330); },
        Pig: function (p) { p.ellipse(0.05, 0.15, 0.55, 0.35); p.circle(-0.6, 0.05, 0.22); p.ellipse(-0.8, 0.1, 0.1, 0.07); p.line([[-0.7, -0.15], [-0.72, -0.35], [-0.58, -0.2]]); p.line([[-0.48, -0.17], [-0.4, -0.35], [-0.36, -0.15]]); [-0.3, -0.1, 0.25, 0.45].forEach(function (x) { p.line([[x, 0.48], [x, 0.72]]); }); p.arc(0.65, 0.05, 0.1, 180, 480); }
    };
    // ---- the wheel ---------------------------------------------------------------------------
    function resize() { var r = stage.getBoundingClientRect(); W = Math.round(r.width); canvas.width = Math.round(W * DPR); canvas.height = Math.round(W * DPR); draw(); }
    function angleOf(i) { return -Math.PI / 2 + i * Math.PI / 6; }            // the rat north, at the top; round with the clock
    function draw() {
        now = E.pillars(new Date());
        var R = W * 0.46, c = W / 2;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, W);
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = DIM; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(c, c, R * 0.58, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(c, c, R * 0.3, 0, Math.PI * 2); ctx.stroke();
        spots = [];
        E.BRANCHES.forEach(function (b, i) {
            var a0 = angleOf(i) - Math.PI / 12, a1 = angleOf(i) + Math.PI / 12, a = angleOf(i);
            ctx.strokeStyle = FAINT; ctx.beginPath(); ctx.moveTo(c + Math.cos(a0) * R * 0.3, c + Math.sin(a0) * R * 0.3); ctx.lineTo(c + Math.cos(a0) * R, c + Math.sin(a0) * R); ctx.stroke();
            var isYear = b.animal === now.lunarYear.animal, isHour = b.animal === now.hour.animal, hot = chosen === i;
            var col = hot ? AMBER : isYear ? AMBER : isHour ? INK : DIM;
            // the animal, drawn in the outer ring
            var ax = c + Math.cos(a) * R * 0.8, ay = c + Math.sin(a) * R * 0.8, s = R * 0.085;
            ctx.save(); ctx.translate(ax, ay); ctx.rotate(a + Math.PI / 2); ctx.translate(-ax, -ay);
            ANIMAL[b.animal](pen(ctx, ax, ay, s, col, Math.max(1, s * 0.12)));
            ctx.restore();
            // the character in the middle ring
            ctx.fillStyle = col; ctx.font = (R * 0.1) + "px " + HAN; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(b.c, c + Math.cos(a) * R * 0.45, c + Math.sin(a) * R * 0.45);
            ctx.fillStyle = FAINT; ctx.font = (R * 0.035) + "px " + MONO; ctx.fillText(b.hours, c + Math.cos(a) * R * 0.64, c + Math.sin(a) * R * 0.64);
            spots.push({ x: ax, y: ay, i: i });
        });
        // the hour hand: the double-hour we are in, with the minute's progress through it
        var d = now.date, h = d.getHours() + d.getMinutes() / 60, slot = Math.floor(((h + 1) % 24) / 2), frac = (((h + 1) % 24) - slot * 2) / 2;
        var ha = angleOf(slot) - Math.PI / 12 + frac * Math.PI / 6;
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.shadowColor = INK; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(ha) * R * 0.56, c + Math.sin(ha) * R * 0.56); ctx.stroke(); ctx.shadowBlur = 0;
        // the year in the middle
        ctx.fillStyle = ELEMENT_INK[now.lunarYear.element]; ctx.font = (R * 0.16) + "px " + HAN; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(now.lunarYear.name, c, c - R * 0.04);
        ctx.fillStyle = DIM; ctx.font = (R * 0.045) + "px " + MONO; ctx.fillText(now.lunarYear.element.toLowerCase() + " " + now.lunarYear.animal.toLowerCase() + " · " + now.lunarYear.year, c, c + R * 0.1);
        ctx.fillText(now.hour.name + " · the " + now.hour.animal.toLowerCase() + "'s hour", c, c + R * 0.18);
        ctx.fillStyle = FAINT; ctx.font = (R * 0.035) + "px " + MONO; ctx.fillText("north at the top · the hours round with the clock", c, W - R * 0.03 - 8);
    }
    // ---- the reading -------------------------------------------------------------------------
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function dstr(d) { return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
    function pill(p, what) { return "<b>" + esc(p.name) + "</b> <span class=\"py\">" + esc(p.pinyin) + "</span>, " + esc(p.yang ? "yang" : "yin") + " " + esc(p.element) + " " + esc(p.animal) + (what ? " · " + what : ""); }
    function reading() {
        if (!readOut || !now) return;
        var y = now.lunarYear, l = E.lunar(now.date), e = E.ELEMENTS[y.element], out = [];
        out.push("<p class=\"angles\">The year is " + pill(y) + ": it began on " + esc(dstr(y.from)) + " with the New Year's new moon and ends on " + esc(dstr(new Date(y.to.getTime() - 864e5))) + "; the " + esc(y.element.toLowerCase()) + " is " + esc(e.c) + ", whose colour is " + esc(e.colour) + " and whose planet is " + esc(e.planet) + "." + (y.name === "丙午" ? " A fire horse year, the sixtieth: the one Japan feared for its daughters in 1966, when births fell by a quarter, and the first since." : "") + (l ? " By the moon it is the " + ord(l.day) + " day of the " + (l.leap ? "leap " : "") + ord(l.month) + " month." : "") + "</p>");
        out.push("<ul>");
        out.push("<li>" + pill(now.year, "the year pillar, which the almanac turns at the start of spring, " + esc(dstr(now.year.from))) + "</li>");
        out.push("<li>" + pill(now.month, "the month pillar, by the Sun's station") + "</li>");
        out.push("<li>" + pill(now.day, "the day pillar") + "</li>");
        out.push("<li>" + pill(now.hour, "the hour: the " + esc(now.hour.animal.toLowerCase()) + "'s, " + esc(now.hour.branch.hours).replace("–", " to ") + " by the clock") + "</li>");
        out.push("</ul>");
        readOut.innerHTML = out.join("");
    }
    function ord(n) { return n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"); }
    function tell(i) {
        chosen = i; draw();
        if (!cellOut) return;
        if (i == null) { cellOut.innerHTML = ""; return; }
        var b = E.BRANCHES[i], trine = E.TRINES.filter(function (t) { return t.indexOf(b.animal) >= 0; })[0].filter(function (a) { return a !== b.animal; });
        var years = []; for (var y = 1924 + i; y <= 2044; y += 12) years.push(y + " " + E.pillar(y - 4).element.toLowerCase());
        cellOut.innerHTML = "<b>" + esc(b.c) + " " + esc(b.pinyin) + ", the " + esc(b.animal.toLowerCase()) + "</b>: the " + ord(i + 1) + " branch, " + esc(b.element.toLowerCase()) + ", " + esc(b.direction) + "; the double-hour from " + esc(b.hours).replace("–", " to ") + "; at ease with the " + esc(trine[0].toLowerCase()) + " and the " + esc(trine[1].toLowerCase()) + ", at odds with the " + esc(E.BRANCHES[(i + 6) % 12].animal.toLowerCase()) + " opposite. Its years: " + years.join(", ") + ".";
    }
    // ---- your pillars ------------------------------------------------------------------------
    function born() {
        if (!bornIn || !bornOut) return;
        if (!bornIn.value) { bornOut.innerHTML = ""; return; }
        var d = new Date(bornIn.value); if (isNaN(d)) return;
        var timed = /T\d\d:\d\d/.test(bornIn.value), p = E.pillars(d), y = p.lunarYear, trine = E.TRINES.filter(function (t) { return t.indexOf(y.animal) >= 0; })[0].filter(function (a) { return a !== y.animal; });
        var out = "<p class=\"angles\">Born in the year " + pill(y) + ", which began on " + esc(dstr(y.from)) + (d < new Date(p.year.from) && d >= y.from ? " (the almanac's year pillar, which turns at the start of spring, still reads " + esc(p.year.name) + ")" : d >= new Date(p.year.from) && d < y.from ? "" : "") + ". " + (y.name === "丙午" ? "A fire horse. " : "") + "Your trine is the " + esc(trine[0].toLowerCase()) + " and the " + esc(trine[1].toLowerCase()) + "; the " + esc(E.BRANCHES[(E.BRANCHES.indexOf(y.branch) + 6) % 12].animal.toLowerCase()) + " stands opposite.</p>";
        out += "<ul><li>" + pill(p.year, "year") + "</li><li>" + pill(p.month, "month") + "</li><li>" + pill(p.day, "day") + "</li>" + (timed ? "<li>" + pill(p.hour, "hour") + "</li>" : "<li>the hour pillar wants the time of day</li>") + "</ul>";
        var l = E.lunar(d); if (l) out += "<p class=\"gloss\">By the moon, the " + ord(l.day) + " day of the " + (l.leap ? "leap " : "") + ord(l.month) + " month.</p>";
        bornOut.innerHTML = out;
    }
    // ---- the cycle of sixty, as years --------------------------------------------------------
    function cycle() {
        if (!cycleOut) return;
        var out = [];
        for (var y = 1984; y < 2044; y++) { var p = E.pillar(y - 4); out.push("<li" + (y === now.lunarYear.year ? " class=\"now\"" : "") + "><span class=\"han\">" + p.name + "</span> " + y + " <span class=\"what\" style=\"color:" + ELEMENT_INK[p.element] + "\">" + p.element.toLowerCase() + " " + p.animal.toLowerCase() + "</span></li>"); }
        cycleOut.innerHTML = out.join("");
    }
    canvas.addEventListener("click", function (e) {
        var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, hit = null, best = W * 0.09;
        spots.forEach(function (s) { var d = Math.hypot(s.x - x, s.y - y); if (d < best) { best = d; hit = s.i; } });
        if (hit == null) { var dx = x - W / 2, dy = y - W / 2, rad = Math.hypot(dx, dy); if (rad > W * 0.14 && rad < W * 0.46) hit = ((Math.round((Math.atan2(dy, dx) + Math.PI / 2) / (Math.PI / 6)) % 12) + 12) % 12; }
        tell(hit);
    });
    if (bornIn) bornIn.addEventListener("input", born);
    addEventListener("resize", resize);
    resize(); reading(); cycle();
    setInterval(function () { draw(); reading(); }, 30000);
    window.Animals = { draw: draw, tell: tell, ANIMAL: ANIMAL };
})();
