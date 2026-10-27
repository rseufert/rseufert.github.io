/* temple/lenormand.js: the Lenormand.
   The thirty-six cards of the petit Lenormand, drawn as small emblems
   in the temple's line, each with the playing card inset the old packs
   printed on it; laid three in a line, nine in a square, or all
   thirty-six in the Grand Tableau, and read the way the cards are read:
   by neighbours, by the significator's surroundings, by the houses.
   The pack is the Game of Hope of 1799, Nuremberg, a race game, which
   took Mlle Lenormand's name after she died. The meanings are the plain
   ones and this site's words. Shuffled with the browser's random
   numbers; nothing stored or sent. One script, no library. */
(function () {
    "use strict";
    var canvas = document.getElementById("lenormand-stage");
    if (!canvas) return;
    var ctx = canvas.getContext("2d"), stage = canvas.parentNode;
    var readOut = document.getElementById("lenormand-reading"), deckOut = document.getElementById("lenormand-deck"), saveLink = document.getElementById("lenormand-save"), againBtn = document.getElementById("lenormand-again");
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace', SERIF = 'Georgia, "Times New Roman", serif';
    var INK = "#7cf5c8", DIM = "#2a5a4a", FAINT = "#163a2e", AMBER = "#ffb000", PAPER = "#020705", DPR = Math.min(2, window.devicePixelRatio || 1);
    // The thirty-six: name, the inset card, a few words, and a line.
    var CARDS = [
        ["Rider", "9♥", "news, a visitor, what is on its way", "Something is coming toward you, and quickly: news, a message, a person on a horse."],
        ["Clover", "6♦", "a small luck, brief and green", "A small piece of luck, light and soon over; take it while it is there."],
        ["Ship", "10♠", "a journey, distance, trade", "Travel, distance, something from far off; the merchant's card, and longing."],
        ["House", "K♥", "home, family, what is settled", "The house and those in it; what is solid, settled and your own."],
        ["Tree", "7♥", "health, slow growth, roots", "The body and its health; what grows slowly and lasts; roots."],
        ["Clouds", "K♣", "confusion, trouble passing", "Trouble and confusion, which pass as weather does; the dark side is the bad side."],
        ["Snake", "Q♣", "a rival, a detour, cunning", "A woman who is not your friend, or a long way round; cleverness, and what it costs."],
        ["Coffin", "9♦", "an end, a box closed", "An ending, an illness, a thing put away; what is over is over."],
        ["Bouquet", "Q♠", "a gift, pleasure, courtesy", "A present, an invitation, a kindness; something pleasant for its own sake."],
        ["Scythe", "J♦", "a cut, sudden, the harvest", "A sudden cut: an accident, a decision, a harvest. Where the blade points matters."],
        ["Whip", "J♣", "strife, repetition, argument", "Quarrels and repetition: the same argument, the same exercise, again."],
        ["Birds", "7♦", "talk, nerves, a pair", "Chatter and worry, gossip, a couple talking it over; small anxieties."],
        ["Child", "J♠", "a child, a start, something small", "A child, or a beginning; something small, new and not yet much."],
        ["Fox", "9♣", "cunning, work, a false friend", "Cunning: someone working an angle, or you working for a living; look twice."],
        ["Bear", "10♣", "strength, money, a mother, an official", "Power and appetite: money, a boss, a mother; someone large who means well or not."],
        ["Stars", "6♥", "hope, clarity, many", "Hope and a clear night; guidance, plans, a great many of something."],
        ["Stork", "Q♥", "change, a move, a birth", "A change for the better: a move, a birth, a return in spring."],
        ["Dog", "10♥", "a friend, loyalty", "A friend who stays; loyalty, and someone you can trust."],
        ["Tower", "6♠", "authority, the state, alone, a long time", "Authority and institutions; a long time, a long view, and standing alone."],
        ["Garden", "8♠", "the public, society, a gathering", "People in numbers: society, a party, the public, a meeting place."],
        ["Mountain", "8♣", "an obstacle, delay, an enemy", "Something in the way, large and slow to move; an enemy, a delay, a hard climb."],
        ["Crossroads", "Q♦", "a choice, two ways", "A choice between ways; more than one path, and a decision owed."],
        ["Mice", "7♣", "loss, theft, wear", "Loss by small degrees: theft, decay, worry that gnaws."],
        ["Heart", "J♥", "love", "Love, plainly; the heart, and what it is set on."],
        ["Ring", "A♣", "a bond, a contract, a circle", "A bond: marriage, a contract, a promise, a circle that closes."],
        ["Book", "10♦", "a secret, learning", "A secret, or study; what is not yet known, or is known only to a few."],
        ["Letter", "7♠", "a document, the written word", "Something written: a letter, a paper, a message that can be read again."],
        ["Man", "A♥", "the man asking, or his", "The man who asks, or the man in the asker's life; the cards around him are his."],
        ["Woman", "A♠", "the woman asking, or hers", "The woman who asks, or the woman in the asker's life; the cards around her are hers."],
        ["Lily", "K♠", "age, peace, virtue, winter", "Peace and age; a long life, virtue, winter, sometimes sex, depending on who you read."],
        ["Sun", "A♦", "success, warmth, energy", "Success and light; energy, warmth, a good outcome."],
        ["Moon", "8♥", "honour, reputation, feeling, a month", "Reputation and honour; feeling, dreams, recognition, the space of a month."],
        ["Key", "8♦", "certainty, an opening, yes", "The answer is yes; a key that fits, a door that opens, something sure."],
        ["Fish", "K♦", "money, plenty, flow, business", "Money in motion: business, plenty, things that come in and go out like water."],
        ["Anchor", "9♠", "stability, work, holding fast", "Holding fast: steady work, a long engagement, safe harbour, and the sea it sits in."],
        ["Cross", "6♣", "burden, fate, grief, the end", "A burden, a grief, a fate; the last card of the pack, and the end of a matter."]
    ].map(function (c, i) { return { n: i + 1, name: c[0], inset: c[1], words: c[2], line: c[3], slug: "card-" + c[0].toLowerCase() }; });
    var BY = {}; CARDS.forEach(function (c) { BY[c.name] = c; BY[c.slug] = c; BY[c.n] = c; });

    // ---- a pen for a unit box, y down -------------------------------------------------------------
    function pen(c, cx, cy, s, col, w) {
        var p = { X: function (x) { return cx + x * s; }, Y: function (y) { return cy + y * s; },
            set: function () { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = w; c.lineCap = "round"; c.lineJoin = "round"; },
            line: function (pts) { p.set(); c.beginPath(); pts.forEach(function (q, i) { c[i ? "lineTo" : "moveTo"](p.X(q[0]), p.Y(q[1])); }); c.stroke(); return p; },
            poly: function (pts) { p.set(); c.beginPath(); pts.forEach(function (q, i) { c[i ? "lineTo" : "moveTo"](p.X(q[0]), p.Y(q[1])); }); c.closePath(); c.stroke(); return p; },
            circle: function (x, y, r, fill) { p.set(); c.beginPath(); c.arc(p.X(x), p.Y(y), r * s, 0, Math.PI * 2); if (fill) c.fill(); else c.stroke(); return p; },
            ellipse: function (x, y, rx, ry, rot) { p.set(); c.beginPath(); c.ellipse(p.X(x), p.Y(y), rx * s, ry * s, rot || 0, 0, Math.PI * 2); c.stroke(); return p; },
            arc: function (x, y, r, a0, a1) { p.set(); c.beginPath(); c.arc(p.X(x), p.Y(y), r * s, a0 * Math.PI / 180, a1 * Math.PI / 180); c.stroke(); return p; },
            star: function (x, y, r, n) { var pts = []; for (var i = 0; i < n * 2; i++) { var a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * 0.45 : r; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } return p.poly(pts); },
            rays: function (x, y, r0, r1, n) { for (var i = 0; i < n; i++) { var a = i * 2 * Math.PI / n; p.line([[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]]); } return p; },
            wave: function (x0, x1, y, amp, n) { var pts = [], N = n * 8; for (var i = 0; i <= N; i++) { var t = i / N; pts.push([x0 + (x1 - x0) * t, y + Math.sin(t * n * Math.PI * 2) * amp]); } return p.line(pts); },
            figure: function (x, y, h, skirt) { var r = h * 0.1; p.circle(x, y - h / 2 + r, r); p.line([[x, y - h / 2 + 2 * r], [x, y + h * 0.1]]); p.line([[x - h * 0.2, y - h * 0.1], [x, y - h * 0.25], [x + h * 0.2, y - h * 0.1]]); if (skirt) p.poly([[x - h * 0.22, y + h / 2], [x, y + h * 0.1], [x + h * 0.22, y + h / 2]]); else { p.line([[x, y + h * 0.1], [x - h * 0.15, y + h / 2]]); p.line([[x, y + h * 0.1], [x + h * 0.15, y + h / 2]]); } return p; },
            horse: function (x, y, s2) { p.ellipse(x, y, s2 * 0.5, s2 * 0.25); p.line([[x + s2 * 0.4, y - s2 * 0.1], [x + s2 * 0.7, y - s2 * 0.5]]); p.ellipse(x + s2 * 0.78, y - s2 * 0.55, s2 * 0.15, s2 * 0.08, -0.6); [-0.35, -0.15, 0.2, 0.4].forEach(function (k, i) { p.line([[x + k * s2, y + s2 * 0.22], [x + k * s2 + (i % 2 ? 0.06 : -0.06) * s2, y + s2 * 0.65]]); }); p.line([[x - s2 * 0.5, y - s2 * 0.05], [x - s2 * 0.8, y + s2 * 0.35]]); return p; },
            tree: function (x, y, s2) { p.line([[x, y + s2 * 0.6], [x, y - s2 * 0.1]]); p.circle(x, y - s2 * 0.35, s2 * 0.3); p.circle(x - s2 * 0.25, y - s2 * 0.15, s2 * 0.22); p.circle(x + s2 * 0.25, y - s2 * 0.15, s2 * 0.22); return p; },
            bird: function (x, y, s2) { p.line([[x - s2, y], [x - s2 * 0.5, y - s2 * 0.5], [x, y], [x + s2 * 0.5, y - s2 * 0.5], [x + s2, y]]); return p; } };
        return p;
    }
    var EMBLEM = [
        function (p) { p.horse(0, 0.2, 1.1); p.line([[0, 0.0], [0, -0.55]]); p.circle(0, -0.68, 0.12); p.line([[0, -0.3], [0.45, -0.55]]); },
        function (p) { p.line([[0, 0.9], [0, 0.1]]); p.circle(-0.3, -0.1, 0.3); p.circle(0.3, -0.1, 0.3); p.circle(0, -0.6, 0.3); },
        function (p) { p.line([[-0.8, 0.3], [-0.6, 0.65], [0.6, 0.65], [0.8, 0.3]]); p.line([[-0.8, 0.3], [0.8, 0.3]]); p.line([[0, 0.3], [0, -0.85]]); p.poly([[0, -0.8], [0.6, -0.1], [0, -0.1]]); p.poly([[-0.05, -0.7], [-0.5, -0.05], [-0.05, -0.05]]); p.wave(-1, 1, 0.85, 0.05, 3); },
        function (p) { p.poly([[-0.6, 0.0], [0.6, 0.0], [0.6, 0.8], [-0.6, 0.8]]); p.poly([[-0.75, 0.0], [0, -0.75], [0.75, 0.0]]); p.poly([[-0.15, 0.8], [0.15, 0.8], [0.15, 0.35], [-0.15, 0.35]]); p.poly([[0.25, 0.2], [0.45, 0.2], [0.45, 0.4], [0.25, 0.4]]); p.line([[0.35, -0.6], [0.35, -0.35]]); },
        function (p) { p.tree(0, 0, 1.3); p.line([[0, 0.8], [-0.35, 1.0]]); p.line([[0, 0.8], [0.35, 1.0]]); },
        function (p) { p.arc(-0.3, 0.1, 0.4, 180, 360); p.arc(0.35, 0.0, 0.5, 180, 360); p.arc(0.0, 0.3, 0.3, 0, 180); p.line([[-0.7, 0.1], [-0.7, 0.3]]); p.line([[0.85, 0.0], [0.85, 0.3]]); p.line([[-0.7, 0.3], [-0.3, 0.3]]); p.line([[0.3, 0.3], [0.85, 0.3]]); [[0.4, -0.3], [0.55, -0.1], [0.7, -0.25], [0.5, 0.1]].forEach(function (q) { p.line([[q[0], q[1]], [q[0] + 0.1, q[1] + 0.08]]); }); },
        function (p) { var pts = []; for (var i = 0; i <= 40; i++) { var t = i / 40; pts.push([-0.8 + t * 1.6, Math.sin(t * Math.PI * 3) * 0.35]); } p.line(pts); p.circle(0.9, 0.0, 0.12); p.line([[1.0, 0.0], [1.15, -0.06]]); p.line([[1.0, 0.0], [1.15, 0.06]]); },
        function (p) { p.poly([[-0.5, -0.4], [0.5, -0.4], [0.7, 0.0], [0.5, 0.8], [-0.5, 0.8], [-0.7, 0.0]]); p.line([[0, -0.2], [0, 0.5]]); p.line([[-0.25, 0.05], [0.25, 0.05]]); },
        function (p) { [[-0.4, -0.5], [0, -0.7], [0.4, -0.5], [-0.2, -0.25], [0.2, -0.25]].forEach(function (q) { p.line([[0, 0.9], [q[0], q[1]]]); p.circle(q[0], q[1], 0.14); }); p.line([[-0.3, 0.6], [0.3, 0.7]]); },
        function (p) { p.line([[0.5, 0.95], [0.3, -0.6]]); p.arc(-0.1, -0.1, 0.65, 200, 320); p.line([[0.1, 0.3], [0.5, 0.35]]); },
        function (p) { p.line([[-0.6, 0.9], [0.3, -0.6]]); p.line([[0.3, -0.6], [0.6, -0.9]]); p.line([[0.3, -0.6], [0.7, -0.75]]); p.line([[0.3, -0.6], [0.75, -0.55]]); p.line([[0.6, 0.9], [-0.3, -0.6]]); p.line([[-0.3, -0.6], [-0.6, -0.9]]); p.line([[-0.3, -0.6], [-0.7, -0.75]]); p.line([[-0.3, -0.6], [-0.75, -0.55]]); },
        function (p) { p.line([[-0.9, 0.5], [0.9, 0.5]]); p.ellipse(-0.4, 0.3, 0.22, 0.15); p.circle(-0.6, 0.1, 0.1); p.ellipse(0.4, 0.3, 0.22, 0.15); p.circle(0.6, 0.1, 0.1); p.line([[-0.7, 0.1], [-0.85, 0.12]]); p.line([[0.7, 0.1], [0.85, 0.12]]); },
        function (p) { p.figure(0, 0.1, 1.2); p.circle(0.5, 0.6, 0.18); },
        function (p) { p.ellipse(0.0, 0.2, 0.55, 0.28); p.circle(-0.6, -0.05, 0.2); p.line([[-0.75, -0.2], [-0.8, -0.5], [-0.6, -0.25]]); p.line([[-0.45, -0.2], [-0.4, -0.5], [-0.3, -0.25]]); [-0.3, 0.3].forEach(function (x) { p.line([[x, 0.45], [x, 0.75]]); }); p.ellipse(0.75, 0.15, 0.3, 0.14, 0.5); },
        function (p) { p.ellipse(0, 0.2, 0.5, 0.6); p.circle(0, -0.55, 0.3); p.circle(-0.25, -0.78, 0.1); p.circle(0.25, -0.78, 0.1); p.line([[-0.5, 0.0], [-0.8, 0.3]]); p.line([[0.5, 0.0], [0.8, 0.3]]); p.line([[-0.2, 0.8], [-0.2, 0.95]]); p.line([[0.2, 0.8], [0.2, 0.95]]); },
        function (p) { p.star(0, -0.2, 0.4, 6); [[-0.7, -0.7], [0.7, -0.6], [-0.6, 0.5], [0.6, 0.6], [0.0, 0.8], [0.8, 0.0], [-0.85, -0.1]].forEach(function (q) { p.star(q[0], q[1], 0.14, 5); }); },
        function (p) { p.ellipse(0.1, -0.1, 0.4, 0.25); p.line([[-0.3, -0.2], [-0.5, -0.7]]); p.circle(-0.55, -0.8, 0.1); p.line([[-0.65, -0.8], [-1.0, -0.72]]); p.line([[0.1, 0.15], [0.1, 0.9]]); p.line([[0.15, 0.15], [0.3, 0.5]]); p.line([[0.4, -0.2], [0.9, -0.4]]); },
        function (p) { p.ellipse(0.1, 0.3, 0.45, 0.3); p.circle(-0.45, -0.1, 0.22); p.line([[-0.6, -0.25], [-0.7, 0.1]]); p.line([[-0.3, -0.25], [-0.22, 0.05]]); p.line([[0.1, 0.6], [0.1, 0.9]]); p.line([[0.4, 0.6], [0.4, 0.9]]); p.arc(0.62, 0.1, 0.2, 90, 330); },
        function (p) { p.poly([[-0.35, 1.0], [0.35, 1.0], [0.35, -0.6], [-0.35, -0.6]]); p.line([[-0.45, -0.6], [-0.45, -0.85], [-0.25, -0.85], [-0.25, -0.7], [-0.1, -0.7], [-0.1, -0.85], [0.1, -0.85], [0.1, -0.7], [0.25, -0.7], [0.25, -0.85], [0.45, -0.85], [0.45, -0.6]]); [[-0.1, -0.3], [-0.1, 0.1], [-0.1, 0.5]].forEach(function (q) { p.poly([[q[0], q[1]], [q[0] + 0.2, q[1]], [q[0] + 0.2, q[1] + 0.25], [q[0], q[1] + 0.25]]); }); },
        function (p) { p.arc(0, 0.5, 0.35, 180, 360); p.line([[-0.35, 0.5], [0.35, 0.5]]); p.line([[0, 0.15], [0, -0.3]]); p.line([[-0.2, -0.3], [0.2, -0.3]]); p.line([[-0.15, -0.3], [-0.25, -0.6]]); p.line([[0.15, -0.3], [0.25, -0.6]]); p.tree(-0.7, 0.0, 0.7); p.tree(0.7, 0.0, 0.7); p.line([[-1, 0.9], [1, 0.9]]); },
        function (p) { p.line([[-1, 0.8], [-0.5, -0.2], [-0.2, 0.3], [0.2, -0.8], [0.6, -0.1], [1, 0.8]]); p.line([[0.05, -0.45], [0.2, -0.8], [0.35, -0.5]]); },
        function (p) { p.line([[0, 1.0], [0, 0.2]]); p.line([[0, 0.2], [-0.6, -0.8]]); p.line([[0, 0.2], [0.6, -0.8]]); p.line([[0.1, -0.3], [0.1, -0.9]]); p.poly([[0.1, -0.9], [0.5, -0.9], [0.5, -0.7], [0.1, -0.7]]); p.poly([[0.1, -0.65], [-0.3, -0.65], [-0.3, -0.45], [0.1, -0.45]]); },
        function (p) { [[-0.4, 0.2], [0.35, 0.45]].forEach(function (q) { p.ellipse(q[0], q[1], 0.3, 0.17); p.circle(q[0] - 0.33, q[1] - 0.08, 0.1); p.circle(q[0] - 0.36, q[1] - 0.2, 0.05); p.line([[q[0] + 0.3, q[1]], [q[0] + 0.65, q[1] - 0.2]]); }); },
        function (p) { p.arc(-0.35, -0.2, 0.4, 180, 360); p.arc(0.35, -0.2, 0.4, 180, 360); p.line([[-0.75, -0.2], [0, 0.75], [0.75, -0.2]]); },
        function (p) { p.circle(0, 0.1, 0.6); p.circle(0, 0.1, 0.45); p.poly([[-0.2, -0.5], [0, -0.75], [0.2, -0.5], [0, -0.3]]); },
        function (p) { p.line([[0, -0.5], [0, 0.6]]); p.line([[0, -0.5], [-0.8, -0.6], [-0.8, 0.5], [0, 0.6]]); p.line([[0, -0.5], [0.8, -0.6], [0.8, 0.5], [0, 0.6]]); [-0.3, -0.1, 0.1, 0.3].forEach(function (y) { p.line([[-0.65, y - 0.05], [-0.15, y]]); p.line([[0.15, y], [0.65, y - 0.05]]); }); },
        function (p) { p.poly([[-0.8, -0.5], [0.8, -0.5], [0.8, 0.5], [-0.8, 0.5]]); p.line([[-0.8, -0.5], [0, 0.1], [0.8, -0.5]]); p.circle(0, 0.1, 0.08); },
        function (p) { p.figure(0, 0.05, 1.5); p.line([[-0.25, -0.65], [0.25, -0.65]]); p.poly([[-0.17, -0.65], [-0.15, -0.9], [0.15, -0.9], [0.17, -0.65]]); },
        function (p) { p.figure(0, 0.05, 1.5, true); p.arc(0, -0.65, 0.2, 180, 360); },
        function (p) { p.line([[0, 0.9], [0, -0.1]]); p.line([[0, -0.1], [-0.5, -0.8], [-0.1, -0.3]]); p.line([[0, -0.1], [0.5, -0.8], [0.1, -0.3]]); p.line([[0, -0.1], [0, -0.85]]); p.line([[-0.2, 0.3], [-0.6, 0.1]]); p.line([[0.2, 0.45], [0.6, 0.25]]); },
        function (p) { p.circle(0, 0, 0.4); p.rays(0, 0, 0.5, 0.8, 12); },
        function (p) { p.arc(0, 0, 0.6, 50, 310); p.arc(0.25, 0, 0.5, 60, 300); p.star(0.6, -0.55, 0.1, 5); p.star(0.75, 0.1, 0.08, 5); },
        function (p) { p.circle(-0.4, -0.3, 0.3); p.circle(-0.4, -0.3, 0.12); p.line([[-0.15, -0.1], [0.75, 0.8]]); p.line([[0.55, 0.6], [0.75, 0.4]]); p.line([[0.4, 0.45], [0.6, 0.25]]); },
        function (p) { [[-0.1, -0.3, 1], [0.1, 0.35, -1]].forEach(function (q) { p.ellipse(q[0], q[1], 0.55, 0.22); p.line([[q[0] + 0.5 * q[2], q[1]], [q[0] + 0.8 * q[2], q[1] - 0.25]]); p.line([[q[0] + 0.5 * q[2], q[1]], [q[0] + 0.8 * q[2], q[1] + 0.25]]); p.circle(q[0] - 0.35 * q[2], q[1] - 0.05, 0.04, true); }); },
        function (p) { p.circle(0, -0.75, 0.15); p.line([[0, -0.6], [0, 0.7]]); p.line([[-0.4, -0.35], [0.4, -0.35]]); p.arc(0, 0.2, 0.6, 20, 160); p.line([[-0.56, 0.4], [-0.7, 0.25]]); p.line([[0.56, 0.4], [0.7, 0.25]]); },
        function (p) { p.line([[0, -0.9], [0, 0.9]]); p.line([[-0.5, -0.35], [0.5, -0.35]]); p.line([[-0.3, 0.9], [0.3, 0.9]]); }
    ];
    // ---- a card at (cx, cy), h tall ---------------------------------------------------------------
    function drawCard(c, card, cx, cy, h, col, dim) {
        var w = h / 1.5, s = w * 0.5;
        c.save(); c.translate(cx, cy);
        c.fillStyle = PAPER; c.fillRect(-w / 2, -h / 2, w, h);
        c.strokeStyle = col || INK; c.lineWidth = Math.max(1, s * 0.03); c.strokeRect(-w / 2, -h / 2, w, h);
        var p = pen(c, 0, h * 0.02, s * 0.62, col || INK, Math.max(1, Math.min(2, s * 0.04)));
        EMBLEM[card.n - 1](p);
        c.fillStyle = dim || DIM; c.font = Math.max(7, s * 0.18) + "px " + MONO; c.textAlign = "left"; c.textBaseline = "top";
        c.fillText(String(card.n), -w / 2 + s * 0.1, -h / 2 + s * 0.08);
        c.textAlign = "right"; c.fillStyle = /♥|♦/.test(card.inset) ? AMBER : (dim || DIM); c.font = Math.max(7, s * 0.18) + "px " + SERIF; c.fillText(card.inset, w / 2 - s * 0.1, -h / 2 + s * 0.08);
        c.fillStyle = col || INK; c.font = Math.max(6, Math.min(s * 0.17, w * 0.9 / Math.max(5, card.name.length) * 1.6)) + "px " + MONO; c.textAlign = "center"; c.textBaseline = "bottom"; c.fillText(card.name.toUpperCase(), 0, h / 2 - s * 0.1);
        c.restore();
    }
    // ---- spreads ----------------------------------------------------------------------------------
    var spread = "three", hand = [], who = "Woman", W = 0, H = 0, cells = [];
    function random(n) { var a = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(a); return a[0] % n; }
    function shuffle() { var d = CARDS.slice(); for (var i = d.length - 1; i > 0; i--) { var j = random(i + 1), t = d[i]; d[i] = d[j]; d[j] = t; } return d; }
    function deal() {
        var d = shuffle(), n = spread === "three" ? 3 : spread === "nine" ? 9 : 36;
        hand = d.slice(0, n);
        if (location.hash) history.replaceState(null, "", location.pathname + location.search);
        draw(); reading();
    }
    function show(card) { spread = "one"; hand = [card]; pressed(); draw(); reading(); }
    function grid() { return spread === "three" ? [3, 1] : spread === "nine" ? [3, 3] : spread === "tableau" ? [9, 4] : [1, 1]; }
    function resize() { var r = stage.getBoundingClientRect(); W = Math.round(r.width); H = Math.round(r.height); canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); draw(); }
    function draw() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
        var g = grid(), cols = g[0], rows = g[1], pad = 6;
        var cw = Math.min((W - pad * (cols + 1)) / cols, (H - pad * (rows + 1)) / rows / 1.5), ch = cw * 1.5;
        var x0 = (W - (cw * cols + pad * (cols - 1))) / 2 + cw / 2, y0 = (H - (ch * rows + pad * (rows - 1))) / 2 + ch / 2;
        cells = [];
        hand.forEach(function (card, i) {
            var cx = x0 + (i % cols) * (cw + pad), cy = y0 + Math.floor(i / cols) * (ch + pad);
            var sig = spread === "tableau" && card.name === who, own = spread === "tableau" && card.n === i + 1;
            drawCard(ctx, card, cx, cy, ch, sig ? AMBER : INK, own ? AMBER : DIM);
            cells.push({ x: cx, y: cy, w: cw, h: ch, card: card, i: i });
        });
        if (saveLink) { try { saveLink.href = canvas.toDataURL("image/png"); } catch (e) { saveLink.hidden = true; } }
    }
    // ---- reading ----------------------------------------------------------------------------------
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function nm(c) { return "<b>" + esc(c.name) + "</b>"; }
    function pair(a, b) { return nm(a) + " with " + nm(b) + ": " + esc(a.words) + ", of the kind of " + esc(b.words) + "."; }
    function reading() {
        if (!readOut) return;
        var out = [];
        if (spread === "one") { var c = hand[0]; out.push("<h3>" + c.n + ". " + esc(c.name) + " · " + esc(c.inset) + "</h3><p>" + esc(c.line) + "</p><p class=\"gd\">In the Grand Tableau its house is the " + esc(ordinal(c.n)) + " place; a card that falls there is read in its light.</p>"); }
        if (spread === "three") {
            out.push("<h3>" + hand.map(function (c) { return esc(c.name); }).join(" · ") + "</h3>");
            out.push("<p>" + hand.map(function (c) { return nm(c) + ", " + esc(c.words); }).join("; ") + ".</p>");
            out.push("<p class=\"gd\">The middle card is the matter; the first leans on it from before, the last from after: " + pair(hand[1], hand[0]) + " " + pair(hand[1], hand[2]) + "</p>");
        }
        if (spread === "nine") {
            out.push("<h3>" + esc(hand[4].name) + ", in the middle</h3>");
            out.push("<p>" + nm(hand[4]) + " is the heart of it: " + esc(hand[4].line) + "</p>");
            out.push("<p class=\"gd\">Above it, what is on the mind: " + [hand[0], hand[1], hand[2]].map(function (c) { return nm(c) + ", " + esc(c.words); }).join("; ") + ". Below, what holds it up: " + [hand[6], hand[7], hand[8]].map(function (c) { return nm(c) + ", " + esc(c.words); }).join("; ") + ". The middle row is the matter as it goes, from " + nm(hand[3]) + " through " + nm(hand[4]) + " to " + nm(hand[5]) + ". The corners, " + nm(hand[0]) + ", " + nm(hand[2]) + ", " + nm(hand[6]) + " and " + nm(hand[8]) + ", frame it; the diagonals cross at the middle card.</p>");
        }
        if (spread === "tableau") {
            var sig = BY[who], pos = hand.indexOf(sig), r = Math.floor(pos / 9), col = pos % 9, near = [], far = [];
            var around = function (dr, dc) { var rr = r + dr, cc = col + dc; return rr >= 0 && rr < 4 && cc >= 0 && cc < 9 ? hand[rr * 9 + cc] : null; };
            out.push("<h3>The Grand Tableau, read for the " + esc(who.toLowerCase()) + "</h3>");
            out.push("<p>" + nm(sig) + " lies in the " + ordinal(pos + 1) + " place, the house of the " + esc(CARDS[pos].name) + (col < 3 ? ", toward the left, with most of the cards before " + (who === "Man" ? "him" : "her") : col > 5 ? ", toward the right, with most of the cards behind " + (who === "Man" ? "him" : "her") : ", in the middle") + (r === 0 ? ", on the top row, with everything weighing from below" : r === 3 ? ", on the bottom row, with everything on " + (who === "Man" ? "his" : "her") + " mind" : "") + ".</p>");
            var touching = [["above", around(-1, 0)], ["below", around(1, 0)], ["behind", around(0, -1)], ["before", around(0, 1)], ["above and behind", around(-1, -1)], ["above and before", around(-1, 1)], ["below and behind", around(1, -1)], ["below and before", around(1, 1)]].filter(function (t) { return t[1]; });
            out.push("<p class=\"gd\">Touching " + (who === "Man" ? "him" : "her") + ": " + touching.map(function (t) { return nm(t[1]) + " " + t[0] + ", " + esc(t[1].words); }).join("; ") + ".</p>");
            var own = hand.map(function (c, i) { return c.n === i + 1 ? c : null; }).filter(Boolean);
            out.push("<p class=\"gd\">The first card, " + nm(hand[0]) + ", is the theme; the last, " + nm(hand[35]) + ", the outcome; the corners " + nm(hand[0]) + ", " + nm(hand[8]) + ", " + nm(hand[27]) + " and " + nm(hand[35]) + " frame the whole." + (own.length > 1 ? " In their own houses: " + own.map(nm).join(", ") + ", which speak plainly." : own.length ? " In its own house: " + nm(own[0]) + ", which speaks plainly." : " No card fell in its own house.") + "</p>");
            var keys = ["Heart", "Ring", "Key", "Fish", "Anchor", "Cross", "Sun", "Coffin", "Scythe"].map(function (n) { var c = BY[n], p = hand.indexOf(c), d = Math.max(Math.abs(Math.floor(p / 9) - r), Math.abs(p % 9 - col)); return nm(c) + " " + (d <= 1 ? "touching" : d === 2 ? "near" : d <= 4 ? "some way off" : "far") + ", in the house of the " + esc(CARDS[p].name); });
            out.push("<p class=\"gd\">The cards that matter most, by their distance: " + keys.join("; ") + ".</p>");
            out.push("<p class=\"gd\">Every card by its house: " + hand.map(function (c, i) { return esc(c.name) + " in the " + esc(CARDS[i].name) + "'s"; }).join("; ") + ".</p>");
        }
        readOut.innerHTML = out.join("");
    }
    function ordinal(n) { return n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"); }
    // ---- the deck, small --------------------------------------------------------------------------
    function gallery() {
        if (!deckOut) return;
        var frag = document.createDocumentFragment();
        CARDS.forEach(function (card) {
            var b = document.createElement("button"); b.type = "button"; b.dataset.slug = card.slug; b.setAttribute("aria-label", card.n + " " + card.name); b.id = "pick-" + card.slug;
            var c = document.createElement("canvas"), cw = 64, ch = 96; c.width = cw * DPR; c.height = ch * DPR; c.style.width = cw + "px"; c.style.height = ch + "px";
            var g = c.getContext("2d"); g.setTransform(DPR, 0, 0, DPR, 0, 0); drawCard(g, card, cw / 2, ch / 2, ch - 2, INK);
            b.appendChild(c); frag.appendChild(b);
        });
        deckOut.appendChild(frag);
        deckOut.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; show(BY[b.dataset.slug]); history.replaceState(null, "", "#" + b.dataset.slug); stage.scrollIntoView({ behavior: "smooth", block: "start" }); });
    }
    // ---- hands ------------------------------------------------------------------------------------
    var spreadBtns = document.querySelectorAll("[data-spread]"), whoBtns = document.querySelectorAll("[data-who]");
    function pressed() { spreadBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.spread === spread)); }); whoBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.who === who)); }); }
    spreadBtns.forEach(function (b) { b.addEventListener("click", function () { spread = b.dataset.spread; pressed(); deal(); }); });
    whoBtns.forEach(function (b) { b.addEventListener("click", function () { who = b.dataset.who; pressed(); draw(); reading(); }); });
    if (againBtn) againBtn.addEventListener("click", deal);
    canvas.addEventListener("click", function (e) {
        var r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        var hit = cells.filter(function (c) { return Math.abs(x - c.x) < c.w / 2 && Math.abs(y - c.y) < c.h / 2; })[0];
        if (hit && readOut) { var c = hit.card; readOut.insertAdjacentHTML("afterbegin", "<p class=\"tap\">" + nm(c) + ", " + c.n + ", " + esc(c.inset) + (spread === "tableau" ? ", in the house of the " + esc(CARDS[hit.i].name) : "") + ": " + esc(c.line) + "</p>"); var old = readOut.querySelectorAll(".tap"); if (old.length > 1) old[old.length - 1].remove(); }
    });
    addEventListener("resize", resize);
    gallery();
    var asked = BY[(location.hash || "").slice(1)];
    resize();
    if (asked) show(asked); else { pressed(); deal(); }
    window.Lenormand = { CARDS: CARDS, drawCard: drawCard, deal: deal, show: show, spread: function (s) { spread = s; pressed(); deal(); } };
})();
