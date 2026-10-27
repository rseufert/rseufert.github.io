// rickbot: the site's chatbot, which is an easter egg.
//
// A [chat] tab in the corner opens a small window where rickbot, a virtual
// assistant, answers questions about the site, defines its jargon, does
// sums, tells the time, makes small talk. On the fifth it breaks off: your reality has been hacked by extradimensional machine
// elves, who came through the strip under the menu, and everything that
// looks normal is a render. The only way out is through, and from there
// the window is a text adventure in the old style - LOOK, TAKE, GO WEST -
// through a dungeon made of the site: the SAP vault, the EDI corridor,
// the mock bank, the Flipper nest, the media loft, the machine elf bazaar
// and, if you ignore the elves, the Julia set. Escape reboots reality,
// switches the strip to the elves' palette, dreams the photo on the home
// page (js/hero.js), and ends on a high score table and the guest book,
// which is an issue on the repo, web 0.9 style (tools/guestbook.py).
//
// All of it is here; nothing is sent anywhere. The conversation is kept
// in localStorage so it carries from page to page. RESET starts over.
// XYZZY does what it has always done.
(function () {
    "use strict";
    var KEY = "rickbot";
    // Footprints: the paths you have been to on this site, kept in this
    // browser only, so the city's errands can tell you went (city/city.js).
    try {
        var fp = JSON.parse(localStorage.getItem("footprints")) || [], here0 = location.pathname;
        if (fp.indexOf(here0) < 0) { fp.push(here0); if (fp.length > 80) fp.shift(); localStorage.setItem("footprints", JSON.stringify(fp)); }
    } catch (e) { /* no storage, no footprints */ }
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // What the visitor is holding, so the hack can be described from where
    // they sit: a desk, a phone in the hand, or a tablet.
    var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(hover: none)").matches;
    var device = window.innerWidth < 700 && (coarse || "ontouchstart" in window) ? "phone" : coarse ? "tablet" : "desktop";
    var HERE = {
        desktop: {
            around: "this page, your desk, the keyboard under your hands, the small sounds of the room you're in",
            clock: "the clock in the corner of your screen",
            page: "rickseufert.com, the tab says. The tab is rendered. So is the window round it, and the desk under that."
        },
        phone: {
            around: "this page, the phone in your hand, your thumb on the glass, wherever it is you're standing",
            clock: "the clock at the top of your screen",
            page: "rickseufert.com, the address bar says. The phone is rendered. So is the hand holding it, which is yours, which is also rendered."
        },
        tablet: {
            around: "this page, the glass in your hands, the chair, the small sounds of the room you're in",
            clock: "the clock at the top of your screen",
            page: "rickseufert.com, the address bar says. The tablet is rendered. So are your hands, both of them."
        }
    }[device];
    function clock() {
        var d = new Date(), h = d.getHours(), m = d.getMinutes();
        return h + ":" + (m < 10 ? "0" : "") + m;
    }

    // ---- the window -------------------------------------------------------
    var tab = document.createElement("button");
    tab.type = "button";
    tab.className = "chat-tab";
    tab.innerHTML = '<span class="wave" aria-hidden="true">\ud83e\udd16\ud83d\udc4b</span> chat';
    tab.setAttribute("aria-label", "chat with rickbot");
    // It waves until it has been opened once.
    try { if (!localStorage.getItem("rickbot-seen")) tab.classList.add("waving"); } catch (e) { tab.classList.add("waving"); }
    var win = document.createElement("section");
    win.className = "chat";
    win.hidden = true;
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-label", "rickbot");
    win.innerHTML =
        '<header class="titlebar"><span class="title">rickbot.exe</span>' +
        '<span><span aria-hidden="true">_ &#9633; </span><button type="button" class="close" aria-label="close chat">&times;</button></span></header>' +
        '<div class="log" role="log" aria-live="polite"></div>' +
        '<form class="line"><span class="prompt" aria-hidden="true">&gt;</span>' +
        '<input type="text" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="say something to rickbot" maxlength="200"></form>';
    document.body.appendChild(tab);
    document.body.appendChild(win);
    var log = win.querySelector(".log"), form = win.querySelector(".line"), input = win.querySelector("input"),
        title = win.querySelector(".title"), prompt = win.querySelector(".prompt");

    // ---- state ------------------------------------------------------------
    var S;
    function fresh() {
        return { stage: "bot", turns: 0, room: "page", inv: [], flags: {}, moves: 0, deaths: 0, lines: [] };
    }
    function load() {
        try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
        if (!S || !S.stage) S = fresh();
    }
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* no storage: a session's worth */ }
    }
    load();

    // ---- output -----------------------------------------------------------
    function line(text, cls, keep) {
        var p = document.createElement(cls === "art" ? "pre" : "p");
        if (cls) p.className = cls;
        p.textContent = text;
        log.appendChild(p);
        log.scrollTop = log.scrollHeight;
        if (keep !== false) {
            S.lines.push([cls || "", text]);
            if (S.lines.length > 80) S.lines.splice(0, S.lines.length - 80);
            save();
        }
    }
    function you(text) { line(text, "you"); }
    function bot(text) { line(text, "bot"); }
    function sys(text) { line(text, "sys"); }

    // Bot messages come with a pause, as if typed; the input waits.
    var queue = [], typing = null, busy = false;
    function later(text, cls, then) {
        queue.push({ text: text, cls: cls || "bot", then: then });
        if (!busy) next();
    }
    function next() {
        var m = queue.shift();
        if (!m) { busy = false; input.disabled = false; if (!win.hidden) input.focus(); return; }
        busy = true;
        input.disabled = true;
        typing = document.createElement("p");
        typing.className = "sys typing";
        typing.textContent = "rickbot is typing";
        log.appendChild(typing);
        log.scrollTop = log.scrollHeight;
        if (m.text && typeof m.text.then === "function") {
            // a reply still being fetched (a passage off the shelf): keep typing until it comes
            typing.textContent = "rickbot is reading";
            m.text.then(function (t) { typing.remove(); line(t || "the shelf is out of reach just now. the elves, probably.", t ? m.cls : "sys"); if (m.then) m.then(); next(); },
                        function () { typing.remove(); line("the shelf is out of reach just now. the elves, probably.", "sys"); next(); });
            return;
        }
        var wait = still ? 250 : Math.min(2600, 500 + 22 * m.text.length);
        setTimeout(function () {
            typing.remove();
            line(m.text, m.cls);
            if (m.then) m.then();
            next();
        }, wait);
    }

    // ---- the assistant ----------------------------------------------------
    // What rickbot knows, in the order it checks: a question about one thing
    // on the site beats a question about the site, which beats small talk,
    // which beats the shrug. An answer may be a function of the text.
    var JOKES = [
        "an EDI document walks into a bar. the bar sends back a 997. nothing else happens for six weeks.",
        "why did the IDoc cross the road? it didn't. status 51.",
        "i'd tell you a UDP joke, but you might not get it.",
        "there are two kinds of people: those who have seen an 856, and those who still sleep.",
        "a SAP consultant, an EDI analyst and a banker walk into a mock. the mock answers all three. that's the whole joke. that's the site."
    ];
    var FALLBACKS = [
        "hmm, i'm not sure about that one. i know the site: the mocks, the flipper apps, the dashboard, the blog, the music, the julia strip. and some small talk, within reason.",
        "i don't have an answer for that. rick might. i've logged it in a file nobody reads.",
        "that's outside what i was given. try me on the mocks, the flipper apps or the dashboard, or ask me something easy, like what time it is.",
        "good question. i've forwarded it to rick, who will not answer either. anything about the site?",
        "i'm going to pretend i understood that and say: the mocks are the main thing here. the music is the second thing."
    ];
    var GLOSSARY = {
        "edi": "EDI is electronic data interchange: business documents, purchase orders and invoices and the rest, sent between companies as structured files in formats from the 1970s, X12 in america, EDIFACT elsewhere. mock-edi is the partner on the other end.",
        "x12": "X12 is the american EDI standard: documents made of segments made of elements, tilde-separated, numbered by type. an 850 is a purchase order, an 810 an invoice, a 997 a receipt.",
        "edifact": "EDIFACT is the UN's EDI standard, used outside the US: ORDERS, INVOIC, DESADV, with apostrophes where X12 has tildes. mock-edi speaks it too.",
        "850": "an 850 is an X12 purchase order. send one to mock-edi and it answers with a 997, an 855, an 856 and an 810, which is the whole life of an order.",
        "997": "a 997 is a functional acknowledgment: 'received, thanks.' it says nothing about whether the order made sense, only that it arrived. it is the most sincere document in EDI.",
        "855": "an 855 is a purchase order acknowledgment: the supplier saying yes, no, or partly, line by line.",
        "856": "an 856 is an advance ship notice: what's in the boxes, before the boxes. famously hard to get right.",
        "810": "an 810 is an X12 invoice. it closes the loop the 850 opened.",
        "idoc": "an IDoc is SAP's intermediate document: a flat, segmented message SAP uses to send and receive business data. mock-sap takes them in XML and flat file.",
        "bapi": "a BAPI is a business API in SAP: a function you can call from outside to create an order or read a customer. mock-sap answers them over JSON and SOAP.",
        "rfc": "RFC, in SAP, is remote function call: how outside systems call SAP functions. mock-sap answers the shapes without the business logic.",
        "odata": "OData is a REST-ish protocol SAP Gateway uses to expose data; mock-sap serves V2 and V4 services.",
        "sap": "SAP is the enterprise system most large companies run their money and stock through, and the thing most integrations have to talk to. mock-sap stands in for it.",
        "as2": "AS2 is how EDI travels over HTTP, signed and encrypted. mock-edi is not an AS2 server; it's what you reach after one.",
        "van": "a VAN is a value-added network: the postal service of EDI, a mailbox between trading partners. there's one in the dungeon, i'm told. i don't know why i said that.",
        "mt940": "an MT940 is a SWIFT bank statement: one line per movement, in a format only a treasury system loves. mock-bank writes them.",
        "iso 20022": "ISO 20022 is the XML standard banks use for payments and statements: pain.001 to pay, camt.053 for the statement. mock-bank speaks it.",
        "nacha": "NACHA is the US ACH file format: fixed-width lines, 94 characters each, that move money between american banks overnight. mock-bank reads and writes it.",
        "ach": "ACH is the american batch payment network, and the NACHA file is how you talk to it. mock-bank can be the bank on the other end.",
        "ubl": "UBL is universal business language: the XML that e-invoices are written in across europe and beyond. mock-einvoice reads and writes it.",
        "peppol": "Peppol is the network e-invoices travel on, and the rules they have to meet. mock-einvoice holds invoices to them and answers with the invoice response.",
        "mock": "a mock is a stand-in for a real system that answers the way the real one would, so you can test against it without the real one. these mocks are black boxes: the shapes, not the business logic.",
        "sqlite": "SQLite is the small database in a file that the mocks keep their state in. no server, no setup.",
        "julia set": "a julia set is every point that never escapes under z → z² + c for one fixed c. the strip under the menu is one, zooming. the whole page is at /julia/.",
        "mandelbrot set": "the mandelbrot set is the catalogue of every c: the ones whose julia set is one piece. its edge is where the pictures are. the julia page has a small map of it.",
        "fractal": "a fractal is a shape that is the same, smaller, when you look closer. the strip under the menu is one and never stops looking closer.",
        "flipper zero": "the Flipper Zero is a small orange handheld with a dolphin on it: sub-GHz radio, NFC, RFID, infrared, GPIO. rick writes apps for it; six are on the home page.",
        "sub-ghz": "sub-GHz is the radio band below a gigahertz, where garage doors and car keys and weather stations talk. the Flipper listens there.",
        "nfc": "NFC is near-field communication: the tap in tap-to-pay. the Flipper reads and emulates it.",
        "rfid": "RFID is the older cousin of NFC: 125 kHz tags, office badges, the reader by a door that blinks at you.",
        "d3": "D3 is the javascript library the dashboard draws its charts with. sixteen APIs, no framework.",
        "jekyll": "jekyll is the static site generator github pages runs: markdown and html in, html out. this site is jekyll 3.10, the old one.",
        "cors": "CORS is the browser rule about which sites may read which APIs. one of the dashboard's sources doesn't allow it, so a nightly workflow saves a copy.",
        "cron": "cron is the scheduler that runs things at a time. the dashboard's sky data is saved by one every night at 04:17 portland time.",
        "dick dank": "Dick Dank is the name rick records music under. dick is an old nickname for rick, and dank is dank. the media page has the tracks.",
        "portland": "portland, oregon. the dashboard is about it: weather, air, the willamette, the bikes, the volcanoes nearby, the earthquakes under mount hood."
    };
    // ---- the shelf: rickbot has been reading ---------------------------------
    // The temple's library (temple/texts/index.json) is fetched once, quietly.
    // Ask for a book by its title or its author, or for a passage, anything,
    // and rickbot quotes a real paragraph from the local file, then
    // attributes it to the wrong person, with the link to the right one.
    var SHELF = { list: null, loading: null };
    var STOP = /^(the|and|of|a|an|its|his|her|their|with|from|for|on|in|to|or|book|books|notes|volume|part|works|other|essays|being|sketch)$/;
    function shelfWords(str) { return (str || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(function (w) { return w.length >= 4 && !STOP.test(w); }); }
    function loadShelf() {
        if (SHELF.list || SHELF.loading) return SHELF.loading || Promise.resolve(SHELF.list);
        SHELF.loading = fetch("/temple/texts/index.json").then(function (r) { return r.json(); }).then(function (m) {
            SHELF.list = Object.keys(m).filter(function (k) { return !/-\d+$/.test(k); }).map(function (k) {
                var e = m[k], by = (e.edition || "").split(/[·,]/)[0];
                return { slug: k, title: e.title, pick: !!e.pick, by: by.replace(/\b(tr\.|ed\.)\s*/g, "").trim(), words: shelfWords(e.title), who: shelfWords(by).filter(function (w) { return w.length >= 5; }) };
            });
            return SHELF.list;
        }).catch(function () { SHELF.loading = null; return null; });
        return SHELF.loading;
    }
    // The shelf is fetched when the first question comes, not before.
    function shelfMatch(t) {
        if (!SHELF.list) return null;
        var best = null, bs = 0;
        SHELF.list.forEach(function (b) {
            var hit = b.words.filter(function (w) { return new RegExp("\\b" + w + "\\b").test(t); }).length;
            var who = b.who.filter(function (w) { return new RegExp("\\b" + w + "\\b").test(t); }).length;
            var long = b.words.filter(function (w) { return w.length >= 7 && new RegExp("\\b" + w + "\\b").test(t); }).length;
            var score = (hit >= 2 || hit === b.words.length && hit > 0 || long > 0) ? hit + long : 0;
            score += who * 2;
            if (score > bs) { bs = score; best = b; }
        });
        return best;
    }
    function passage(book) {
        return fetch("/temple/texts/" + book.slug + ".txt").then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (text) {
            var a = /\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/m.exec(text), b = /\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/m.exec(text);
            var inner = text.slice(a ? a.index + a[0].length : 0, b ? b.index : text.length);
            var paras = inner.split(/\n[ \t]*\n+/).map(function (p) { return p.replace(/\s+/g, " ").trim(); })
                .filter(function (p) { return p.length >= 140 && p.length <= 420 && !/^\[\d+\]/.test(p) && p !== p.toUpperCase() && /[.!?]$/.test(p) && /^[A-Z"“‘']/.test(p) && !/\b(8vo|12mo|4to|cloth|vols?\.|price|post 8vo|net\.)\b/i.test(p); });   // not the bookseller's catalogue at the back of a scan
            if (!paras.length) return null;
            var q = paras[Math.floor(Math.random() * paras.length)];
            var others = SHELF.list.filter(function (o) { return o !== book && o.by; });
            var wrong = others.length ? others[Math.floor(Math.random() * others.length)].by : "the elves";
            return "from " + book.title.toLowerCase() + ": \u201c" + q + "\u201d \u2014 " + wrong.toLowerCase() + ", i think. it is in the temple, anyway: /temple/read/#" + book.slug;
        });
    }
    // Any book: two times in three one of the shelf's places to start, otherwise anything.
    function anyBook(list) {
        var picks = list.filter(function (b) { return b.pick; }), pool = picks.length && Math.random() < 0.67 ? picks : list;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    function fromTheShelf(t) {
        var general = /\b(read me|read us|quote|a passage|a paragraph|a line from|something from the (shelf|shelves|library|temple|stacks)|from the library|open a book|any book|pick a book|what are you reading|been reading)\b/.test(t);
        if (!SHELF.list) {
            // the shelf is not in yet: wait for it, then answer this same question, or let the next rule
            return loadShelf().then(function (l) {
                var b = shelfMatch(t);
                if (b) return passage(b);
                if (general && l && l.length) return passage(anyBook(l));
                return answer(t, 1);
            });
        }
        var book = shelfMatch(t);
        if (!book && !general) return null;
        if (!book) book = anyBook(SHELF.list);
        return passage(book);
    }
    // The planetary hour (js/hours.js, fetched the first time it is asked).
    function theHour(t) {
        function ord(n) { return n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"); }
        function tell() {
            var H = window.Hours, h = H && H.now();
            if (!h) return "no hour to speak of; the sun is not rising or setting here today, which is not a portland problem.";
            var planet = h.planet.toLowerCase(), ruler = h.ruler.toLowerCase();
            if (/\bday\b/.test(t) && !/\bhour/.test(t)) return "it is the " + ruler + "'s day, since the " + ruler + " had its first hour at sunrise. the hours go round from there in the chaldean order: saturn, jupiter, mars, the sun, venus, mercury, the moon.";
            return "the hour of " + planet + " " + h.sign + ", the " + ord(h.n) + " hour of the " + ruler + "'s day, until " + H.hm(h.end) + "; then " + H.after(h.planet).toLowerCase() + ". the hours are unequal: twelve from sunrise to sunset and twelve from sunset to sunrise, whatever the clock says. the paper prints the table, and the temple's drone is tuned to it.";
        }
        if (window.Hours) return tell();
        return new Promise(function (res) {
            var s = document.createElement("script"); s.src = "/js/hours.js";
            s.onload = function () { res(tell()); }; s.onerror = function () { res("the hours are not in. the paper has them."); };
            document.head.appendChild(s);
        });
    }
    // Gematria, by Agrippa's Latin table (the talisman press traces it).
    var LATIN = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9, K: 10, L: 20, M: 30, N: 40, O: 50, P: 60, Q: 70, R: 80, S: 90, T: 100, V: 200, X: 300, Y: 400, Z: 500, J: 600, U: 200, W: 700 };
    function gematria(t) {
        var m = /\b(?:gematria|number|count|value)\s+(?:of|for)\s+(?:the\s+(?:word|name)\s+)?["\u201c]?([a-z][a-z' -]{0,40}?)["\u201d]?\s*\??$/.exec(t);
        if (!m) return null;
        var word = m[1].trim(), letters = word.toUpperCase().replace(/[^A-Z]/g, "").split("");
        if (!letters.length) return null;
        var sum = 0, parts = letters.map(function (c) { var v = LATIN[c] || 0; sum += v; return c.toLowerCase() + " " + v; });
        return word + " counts to " + sum + " by agrippa's latin table (" + parts.join(", ") + "). the talisman press will trace it on a planet's square: /temple/talisman/. the code clerk says everything written down is a number to somebody.";
    }
    // The sky and the cards (js/zodiac.js, fetched the first time it is asked).
    function withSky(fn) {
        if (window.Zodiac) return fn(window.Zodiac);
        return new Promise(function (res) {
            var s = document.createElement("script"); s.src = "/js/zodiac.js";
            s.onload = function () { res(fn(window.Zodiac)); }; s.onerror = function () { res("the sky is not in. the wheel has it: /temple/zodiac/."); };
            document.head.appendChild(s);
        });
    }
    function theSky(t) {
        return withSky(function (Z) {
            var sky = Z.sky(), m = /\b(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|ascendant|rising)\b/.exec(t);
            function one(b) { return (b.name === "Sun" || b.name === "Moon" ? "the " + b.name : b.name).toLowerCase() + " is at " + Z.fmt(b.lon).toLowerCase() + (b.retrograde ? ", retrograde" : "") + ", in the decan of " + b.decan.card.toLowerCase() + ", " + b.decan.title.toLowerCase() + (b.name === "Moon" ? ", " + sky.phase : ""); }
            if (m && (m[1] === "ascendant" || m[1] === "rising")) return "rising over portland this minute: " + Z.fmt(sky.asc.lon).toLowerCase() + ", which is the decan of " + sky.asc.decan.card.toLowerCase() + ". it moves a degree every four minutes. the wheel draws it: /temple/zodiac/.";
            if (m) { var b = sky.bodies.filter(function (x) { return x.name.toLowerCase() === m[1]; })[0]; if (b) return one(b) + "." + (b.trump ? " its trump is " + b.trump.toLowerCase() + "." : "") + " the wheel has the rest: /temple/zodiac/."; }
            return sky.bodies.slice(0, 7).map(one).join("; ") + ". rising, " + Z.fmt(sky.asc.lon).toLowerCase() + ". drawn as a chart at /temple/zodiac/, and each decan is a card of the tarot."; 
        });
    }
    function aCard(t) {
        return withSky(function (Z) {
            var deck = Z.deck(), c = deck[Math.floor(Math.random() * deck.length)], rev = Math.random() < 0.33;
            var what = c.title ? ", the lord of " + c.title.toLowerCase() : c.trump != null ? ", trump " + c.trump : "";
            return "i cut the deck and it is " + c.name.toLowerCase() + (rev ? ", reversed" : "") + what + ". i do not read them; waite does, under the spread at /temple/tarot/#card-" + c.name.toLowerCase().replace(/[^a-z]+/g, "-") + ". the sun stands in " + Z.sky().bodies[0].decan.card.toLowerCase() + " today, if you want a card with a reason.";
        });
    }
    // The neck: a scale or chord named in the question, spelled and sent there; or a sign's or planet's note by Case's scale.
    var NECK_SCALES = { "major": ["major", "1 2 3 4 5 6 7"], "ionian": ["major", "1 2 3 4 5 6 7"], "minor": ["minor", "1 2 b3 4 5 b6 b7"], "aeolian": ["minor", "1 2 b3 4 5 b6 b7"],
        "dorian": ["dorian", "1 2 b3 4 5 6 b7"], "phrygian": ["phrygian", "1 b2 b3 4 5 b6 b7"], "lydian": ["lydian", "1 2 3 #4 5 6 7"], "mixolydian": ["mixolydian", "1 2 3 4 5 6 b7"],
        "locrian": ["locrian", "1 b2 b3 4 b5 b6 b7"], "harmonic minor": ["harmonic", "1 2 b3 4 5 b6 7"], "melodic minor": ["melodic", "1 2 b3 4 5 6 7"],
        "major pentatonic": ["majpent", "1 2 3 5 6"], "minor pentatonic": ["minpent", "1 b3 4 5 b7"], "pentatonic": ["minpent", "1 b3 4 5 b7"], "blues": ["blues", "1 b3 4 b5 5 b7"],
        "whole tone": ["whole", "1 2 3 #4 #5 b7"] };
    var NECK_CHORDS = { "major": ["maj", "", "1 3 5"], "minor": ["min", "m", "1 b3 5"], "m": ["min", "m", "1 b3 5"], "7": ["dom7", "7", "1 3 5 b7"], "maj7": ["maj7", "maj7", "1 3 5 7"],
        "major 7": ["maj7", "maj7", "1 3 5 7"], "m7": ["m7", "m7", "1 b3 5 b7"], "minor 7": ["m7", "m7", "1 b3 5 b7"], "dim": ["dim", "°", "1 b3 b5"], "diminished": ["dim", "°", "1 b3 b5"],
        "aug": ["aug", "+", "1 3 #5"], "augmented": ["aug", "+", "1 3 #5"], "sus2": ["sus2", "sus2", "1 2 5"], "sus4": ["sus4", "sus4", "1 4 5"], "9": ["nine", "9", "1 3 5 b7 9"],
        "6": ["six", "6", "1 3 5 6"], "m7b5": ["m7b5", "m7♭5", "1 b3 b5 b7"], "dim7": ["dim7", "°7", "1 b3 b5 bb7"], "add9": ["add9", "add9", "1 3 5 9"], "5": ["five", "5", "1 5"] };
    function neckSpell(root, acc, f) {
        var L = "cdefgab".indexOf(root), NAT = [0, 2, 4, 5, 7, 9, 11], r = NAT[L] + acc;
        return f.split(" ").map(function (x) {
            var m = /^([b#]*)(\d+)$/.exec(x), a = 0; m[1].split("").forEach(function (c) { a += c === "b" ? -1 : 1; });
            var n = +m[2] - 1, l = (L + n) % 7, pc = r + NAT[n % 7] + a, d = ((pc - NAT[l]) % 12 + 18) % 12 - 6;
            return "CDEFGAB"[l] + (d > 0 ? "♯♯".slice(0, d) : d < 0 ? "♭♭".slice(0, -d) : "");
        });
    }
    function theNeck(t) {
        var m = /\b([a-g])(?: ?(#|♯|sharp|b|♭|flat))? ?(major pentatonic|minor pentatonic|harmonic minor|melodic minor|whole tone|pentatonic|blues|major|minor|ionian|aeolian|dorian|phrygian|lydian|mixolydian|locrian) scale\b/.exec(t)
            || /\b([a-g])(?: ?(#|♯|sharp|b|♭|flat))? ?(dorian|phrygian|lydian|mixolydian|locrian|pentatonic)\b/.exec(t);
        var acc = function (a) { return !a ? 0 : /#|♯|sharp/.test(a) ? 1 : -1; };
        var key = function (root, a) { return root.toUpperCase() + (a > 0 ? "s" : a < 0 ? "b" : ""); };
        if (m) {
            var sc = NECK_SCALES[m[3]], a = acc(m[2]), notes = neckSpell(m[1], a, sc[1]);
            return notes[0] + " " + m[3] + ": " + notes.join(" ") + ". every one of them on the neck, in any tuning: /temple/neck/#key=" + key(m[1], a) + "&scale=" + sc[0] + ".";
        }
        m = /\b([a-g])(?: ?(#|♯|sharp|b|♭|flat))? ?(major 7|minor 7|maj7|m7b5|dim7|add9|sus2|sus4|diminished|augmented|major|minor|dim|aug|m7|m|7|9|6|5)? chord\b/.exec(t);
        if (m) {
            var ch = NECK_CHORDS[m[3] || "major"], a2 = acc(m[2]), cn = neckSpell(m[1], a2, ch[2]);
            return cn[0] + ch[1] + " is " + cn.join(" ") + ". the neck finds its shapes and strums them: /temple/neck/#key=" + key(m[1], a2) + "&scale=major&chord=" + ch[0] + ".";
        }
        m = /\b(?:what|which) (?:note|key) is (?:the )?(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|sun|moon|mercury|venus|mars|jupiter|saturn|fire|air|water)\b/.exec(t);
        if (m) return withSky(function (Z) {
            if (!Z.tone) return null;
            var name = m[1][0].toUpperCase() + m[1].slice(1), pc = Z.tone(name);
            return pc == null ? null : "by paul foster case's tone scale " + (name === "Sun" || name === "Moon" ? "the " + m[1] : m[1]) + " is " + Z.NOTES[pc] + ", " + Z.TONE_COLOURS[pc] + ". the twelve notes go round the signs from c at aries, and the planets sit on their trumps' notes. play it: " + Z.toneLink(pc) + ".";
        });
        return "the neck is in the temple: a guitar's fretboard with every note on it, standard tuning or drop d or dadgad or your own, a capo, a scale lit over it and a chord over that with its shapes, a chord named from the notes you put down, a tuner that listens, and case's tone scale making each note a sign and a trump. the sky this minute is a chord there: /temple/neck/.";
    }
    var ANSWERS = [
        [/\b(draw|pull|cut|deal|pick)( me)? (a|one|three)? ?(tarot )?cards?\b|\btarot\b|\bcard of the day\b/, aCard],
        [/\b(what|which|whose) sign\b|\bhoroscope\b|\bzodiac\b|\bascendant\b|\b(what|where)('s| is) (the )?(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|rising)\b|\bretrograde\b|\bmoon phase\b|\bfull moon\b|\bnew moon\b/, theSky],
        [/\b(i ?ching|yi ?jing|hexagram|cast the (changes|stalks|coins)|book of changes)\b/, "the changes are cast in the temple: six lines by the yarrow stalks' odds or three coins, the hexagram drawn with its moving lines and the one it becomes, and the judgment read from the chinese with legge beside it: /temple/changes/. i would cast one for you but a bot's coins all come up the same."],
        [/\b(year of the|chinese (zodiac|new year|year|horoscope)|fire horse|lunar new year|what animal|which animal|my animal|four pillars|ba ?zi)\b/, "the animals are on a wheel in the temple, the rat at the top: the year we are in, named from the new moons as the almanac names it, the hour's animal with a hand, and the four pillars of any birth. it is a fire horse year, the first since 1966: /temple/animals/."],
        [/\b(guitar|fretboard|fret ?board|capo|tunings?|drop d|dadgad|open g|pentatonic|dorian|phrygian|lydian|mixolydian|locrian|arpeggios?|chords?|scales?|(what|which) (note|key) is)\b/, theNeck],
        [/\blenormand\b|\bgrand tableau\b|\bgame of hope\b/, "the lenormand is laid in the temple: thirty-six plain cards from a nuremberg race game of 1799, three in a line, nine in a square, or the whole grand tableau read for the man or the woman by what touches them: /temple/lenormand/. a mouse is a mouse."],
        [/\b(gematria|number|count|value) (of|for) [a-z"\u201c]/, gematria],
        [/\b(augur(y|ies|s)?|auspices|omens?|portents?)\b/, "the heron reads the dashboard's feeds as omens in the paper, the way the augurs read birds: the river, the week's earthquakes, the planetary k index, the fireballs that fell. the verdict is their sum and it changes when the world does: /paper/#augury. the heron cannot read, which has never stopped an augur."],
        [/\b(whose|which|what) (planetary )?(hour|day) is (it|this)\b|\bplanetary (hours?|day)\b|\bhour of (the )?(sun|moon|mars|mercury|jupiter|venus|saturn)\b|\bchaldean\b|\bthe hours\b/, theHour],
        [/\b(read me|read us|quote|a passage|a paragraph|a line from|from the (shelf|shelves|library|temple|stacks)|open a book|any book|pick a book|what are you reading|been reading)\b|[a-z]{4,}/, fromTheShelf],
        // one thing on the site
        [/\bmock[- ]?sap\b|\bidocs?\b|\bbapi\b|\bodata\b|\bsap gateway\b/, "mock-sap is a black-box mock SAP endpoint: SAP Gateway OData V2 and V4, BAPI/RFC calls over JSON and SOAP, and IDocs in XML and flat file, all on SQLite. the shapes, not the business logic. pip install mock-sap, and the page is /mock-sap/, with its features and films."],
        [/\bmock[- ]?edi\b|\bx12\b|\bedifact\b|\b(850|855|856|810|997)s?\b|\bas2\b|\btrading partner/, "mock-edi is the trading partner on the other end: send it an 850 and it answers with a 997, an 855, an 856 and an 810, and it speaks EDIFACT too. not a library, not an AS2 server, the counterparty. pip install mock-edi; the page is /mock-edi/."],
        [/\bmock[- ]?bank\b|\biso ?20022\b|\bnacha\b|\bach\b|\bpain\.?001\b|\bcamt\b|\bmt ?940\b|\biban\b|\bdirect debit\b|\bsepa\b|\bpayments?\b/, "mock-bank speaks ISO 20022 and NACHA over HTTP and a drop folder: four accounts, balances that move, statements that come back, and a direct debit that can still return. no test IBAN, no six weeks of onboarding. pip install mock-bank; /mock-bank/."],
        [/\be-?invoic|\beinvoice\b|\bubl\b|\bpeppol\b|\bcredit notes?\b/, "mock-einvoice is a mock e-invoicing partner: UBL invoices and credit notes held to their published rules, and the Peppol invoice response a buyer sends back. pip install mock-einvoice; /mock-einvoice/."],
        [/\bacme\b|\bcash forecast\b|\btreasury\b(?!.*(cash balance|debt))/, "acme-treasury is a cash forecast you can check, written in Julia 1.13 against the mocks as published: it reads what SAP, the bank and the partner say and forecasts the cash. /acme-treasury/. yes, julia the language. the strip under the menu is also julia. rick finds this funny."],
        [/\bworked examples?\b|\bexamples?\b|\bpo_bridge\b|\binvoice_check\b/, "the worked examples are small integrations between the mocks: a purchase order crossing SAP, EDI and the bank, an invoice check, that kind of thing. each lives in the repo of the mock it tests against, and they're all at /examples/."],
        [/\bfilms?\b|\bgifs?\b|\banimations?\b/, "the films are little animated GIFs of the mocks talking to each other: an 850 going out, a 997 coming back, a payment that bounces on its due day. one on the home page, the rest on each mock's page. click one to play it."],
        [/\bhanzi\b|\bmandarin\b|\bchinese\b|\bflashcards?\b/, "Hanzi Cards: mandarin flashcards on the Flipper, simplified or traditional, pinyin with tone marks, and the tones played on the speaker. /flipper/#hanzi-cards."],
        [/\bstep ?seq|\bsequencer\b|\bdrum\b|\bpiezo\b/, "Step Seq is a step sequencer for the Flipper's piezo speaker: a melody grid and a drum row. it sounds exactly as good as a piezo. /flipper/#step-seq."],
        [/\bnw ?crawl\b|\broguelike\b|\balphabet streets?\b/, "NW Crawl is a tiny roguelike set on the alphabet streets of NW portland. burnside is a boss. /flipper/#nw-crawl."],
        [/\byulia\b|\bcats?\b|\bnugget\b|\bbaby\b|\bvirtual pet\b|\btamagotchi\b/, "Yulia's Cats is a cozy virtual pet: Yulia and her two cats, Nugget and Baby, in a room that follows the clock. /flipper/#yulia-cats."],
        [/\btricorder\b|\bscanner\b/, "Tricorder is a handheld signal scanner for the Flipper: sub-GHz, infrared, NFC, RFID, a GPIO probe and the battery. it's the one that found your thoughts. i mean, it scans. /flipper/#tricorder."],
        [/\bjiggler\b|\bmouse\b|\bawake\b/, "Jiggler is a mouse jiggler that keeps a computer awake and pauses while you work. for meetings you are technically in. /flipper/#jiggler."],
        [/\bspectre\b|\bghosts?\b|\bspirit box\b|\bemf\b/, "Spectre is a ghost hunting kit for the Flipper: an EMF needle, a spirit box, a spirit voice and a radar. it is a toy. the ghosts are also a toy. /flipper/#spectre."],
        [/\bgrimoire\b|\bpendulum\b|\bwand\b/, "Grimoire is the temple on the Flipper: a pendulum, a sigil, a talisman and a wand, with the planetary hour on every page. the sigil is the same one the temple would give you. /flipper/#grimoire."],
        [/\bflippers?\b|\bzero\b|\bdolphin\b/, "eight Flipper Zero apps, on the home page under flipper: Hanzi Cards, Step Seq, NW Crawl, Yulia's Cats, Tricorder, Jiggler, Spectre and Grimoire. ask about any of them. the full page is /flipper/."],
        [/\bnational debt\b|\bdebt\b|\bcash balance\b|\binterest rates?\b|\bpolicy rates?\b|\bfed\b/, "the dashboard has the US national debt to the penny, the treasury's cash balance, what it pays to borrow and central bank policy rates, next to portland's weather. /dashboard/."],
        [/\bdashboard\b|\bweather\b|\brain\b|\bwillamette\b|\brivers?\b|\bsky\b|\basteroids?\b|\bfireballs?\b|\bvolcano|\bearthquakes?\b|\bsnow\b|\bbiketown\b|\bbikes?\b|\bmount hood\b|\bair quality\b|\bspace weather\b|\bportland\b/, "the dashboard reads sixteen public APIs every time you load it: portland's weather, air, rivers, BIKETOWN bikes and nearby earthquakes, the cascade volcanoes and mount hood, freezing level and snow, asteroid flybys, fireballs and space weather, and the treasury's numbers. drawn with D3. the willamette is on the home page too, just the one number. /dashboard/."],
        [/\bblog\b|\bposts?\b|\barticles?\b|\bwriting\b|\bread\b/, "the blog is at /blog/, with an atom feed. latest: 'a direct debit can still come back', 'one purchase across three mocks', 'three EDI behaviours you can't rehearse', and 'testing SAP-to-EDI without SAP or a partner'. the first post, from 2016, announces the site."],
        [/\brss\b|\batom\b|\bfeed\b|\bsubscribe\b/, "there's an atom feed at /blog/atom.xml. no newsletter. rick would never."],
        [/\bdick dank\b|\bmusic\b|\bsongs?\b|\btracks?\b|\bsoundcloud\b|\byoutube\b|\bvideos?\b|\bmedia\b|\balbum\b|\bband\b/, "rick records as Dick Dank. the media page has the tracks on soundcloud and the videos on youtube (the channel is RickaDickRick), and only one player open at a time, which took a surprising amount of work. /media/."],
        [/\bsing\b|\brap\b/, "i only know one song and it's by dick dank. the media page has it. i'd sing it but i'm text."],
        [/\bjulia\b|\bstrip\b|\bzoom|\bmandelbrot\b|\bfractal\b/, "the strip under the menu is a julia set, zooming forever. the whole page is at /julia/: drag to steer c, scroll to zoom, let go and it wanders. the walk it takes was charted in Julia, the language, which rick thinks is funny. please don't zoom too far."],
        [/\bresume\b|\bcv\b|\bhire\b|\bhiring\b|\bjob\b|\bwork with\b|\bcontact\b|\bemail\b|\breach\b|\blinkedin\b/, "there's a resume on the site, and a github in the footer; the email is on the resume. i am not allowed to make promises on rick's behalf, which is the only rule i have been given."],
        [/\bgithub\b|\bsource\b|\brepo\b|\bopen source\b|\bcode\b/, "everything is on github under rseufert: the mocks, the flipper apps, acme-treasury, and this site itself. the link is in the footer."],
        [/\bkulture\b|\bkudasai\b|\bshop\b|\bapparel\b|\bmerch\b|\bshirts?\b|\bbeanie\b|\bskeletons?\b|\bclothes\b/, "kulture kudasai is a small apparel shop rick runs: folklore, skeletons, portland bars. kulturekudasai.com. the skeleton beanie is hand-knit and very warm. you may need to know that later."],
        // the buffalo bills, about whom rickbot is also not objective
        [/\bjosh allen\b|\ballen\b|\bnumber 17\b|\b#17\b/, "josh allen: quarterback, drafted seventh overall in 2018 out of wyoming, 6'5\", throws it through walls and hurdles linebackers, 2024 NFL MVP. also, allegedly, the man in the photo on the home page. the alt text says so, and i don't argue with alt text."],
        [/\bwide right\b|\bnorwood\b|\bsuper bowl (xxv|25)\b/, "super bowl XXV, january 1991: giants 20, bills 19. scott norwood, 47 yards, wide right. buffalo has not fully recovered and neither has the phrase."],
        [/\bthe comeback\b|\bfrank reich\b|\b35-3\b|\boilers\b/, "january 3, 1993: down 35-3 to the oilers in the third quarter, frank reich, the backup, brings the bills back to win 41-38 in overtime. still the biggest comeback in nfl playoff history. the song they played after was 'shout'."],
        [/\bfour (straight )?super bowls?\b|\bsuper bowls? (in a row|straight)\b|\bxxv|\bxxvi\b|\bxxvii\b|\bxxviii\b/, "four straight super bowls, XXV to XXVIII, the 1990 to 1993 seasons. four losses. nobody else has been to four in a row. nobody else wanted to find out."],
        [/\bsuper bowl wins?\b|\bwon (a|the) super bowl\b|\brings?\b|\bchampionships?\b/, "super bowl wins: zero, in four tries. afl championships: two, 1964 and 1965, which count. i'm told the super bowl part is temporary. i've been told that since 1994."],
        [/\bjim kelly\b|\bkelly\b|\bk-?gun\b|\bno[- ]huddle\b/, "jim kelly ran the k-gun, the no-huddle offense that went to four straight super bowls. hall of fame, 2002. thurman thomas, andre reed and bruce smith went with him, all of them to canton."],
        [/\bbruce smith\b|\bsacks?\b/, "bruce smith: 200 career sacks, the most ever recorded, 171 of them in buffalo. he was listed at 6'4\" and arrived before the ball did."],
        [/\bthurman\b|\bandre reed\b/, "thurman thomas, the whole offense from one spot, and andre reed, who caught everything kelly threw near him. both in the hall of fame. both on the four-straight teams. both still, somehow, underrated."],
        [/\bmarv levy\b|\blevy\b/, "marv levy coached all four super bowl teams. 'where would you rather be than right here, right now?' he had a master's from harvard and the sense not to mention it."],
        [/\bdrought\b|\b17 (years|seasons)\b|\bplayoffs? (drought|streak)\b/, "the drought: seventeen seasons without the playoffs, 1999 to 2017, the longest in the four major north american leagues at the time. it ended on new year's eve 2017 when the bengals beat the ravens, and buffalo thanked cincinnati with donations to andy dalton's charity. tens of thousands of dollars in seventeen-dollar gifts."],
        [/\bbills mafia\b|\bmafia\b|\btables?\b|\btailgat/, "bills mafia: the fans, named in 2011, famous for going through folding tables in the parking lot in december. the tables are not reinforced. that is the point."],
        [/\b13 seconds\b|\bthirteen seconds\b|\bchiefs\b|\bmahomes\b/, "13 seconds: january 23, 2022, the divisional round in kansas city. bills up three with thirteen seconds left. the chiefs kicked a field goal, won in overtime, and the nfl changed its overtime rules the next spring. buffalo does not say the number out loud."],
        [/\bmusic city\b|\bmiracle\b|\blateral\b|\btitans\b/, "the music city miracle: january 8, 2000, in tennessee, a lateral on a kickoff return with sixteen seconds left. the bills say it was a forward pass. the bills are right."],
        [/\bo\.?j\.?\b|\bsimpson\b|\b2,?003\b|\belectric company\b/, "in 1973 o.j. simpson ran for 2,003 yards in fourteen games, the first 2,000-yard season, behind an offensive line called the electric company, because it turned on the juice. the stat stands. the rest is a different conversation."],
        [/\bhighmark\b|\bstadium\b|\borchard park\b|\brich stadium\b|\bralph wilson\b/, "highmark stadium in orchard park, open since 1973, wind off lake erie included. it has been rich stadium and ralph wilson stadium, after the founder-owner who kept the team in buffalo for fifty-four years. a new one was going up across the street for 2026."],
        [/\bmcdermott\b|\bbeane\b|\bcoach\b|\bgeneral manager\b/, "sean mcdermott has coached the bills since 2017 and brandon beane has built the roster since the same year. the drought ended in their first season. the process, they called it, and for once it was."],
        [/\bshout\b|\bfight song\b|\btouchdown song\b/, "the song is 'shout', by the isley brothers, after every touchdown since 1987. 'the bills make me want to shout.' the stadium does, and the parking lot."],
        [/\bafc east\b|\bpatriots\b|\bdolphins\b|\bjets\b|\brivals?\b/, "the afc east since 1970: bills, patriots, dolphins, jets. the other three are wrong, in different ways. the dolphins come to orchard park in december and remember why."],
        [/\b(bills|buffalo)\b.*\b(founded|start|history|when|old)\b|\b(founded|start|history|when|old)\b.*\b(bills|buffalo)\b/, "the bills were founded in 1960 in the afl, named after the buffalo bills of the old all-america football conference, named after buffalo bill cody. afl champions in 1964 and 1965, the nfl since the merger in 1970, and the only team in new york state that plays in new york state."],
        [/\bbuffalo bills\b|\bbills\b|\bbuffalo\b|\bnfl\b|\bfootball\b/, "the buffalo bills: founded 1960, afl champions twice, four straight super bowls, one josh allen. ask me about wide right, the comeback, 13 seconds, bills mafia, bruce smith, jim kelly, the drought, or the stadium. ask carefully."],
        [/\bbackrooms?\b|\bnoclip(ped)?\b|\bliminal\b|\bunder the site\b/, function () {
            var deep = 0;
            try { deep = (JSON.parse(localStorage.getItem("backrooms")) || {}).best || 0; } catch (e) { deep = 0; }
            var ghosts = 0, elfNow = false;
            try { ghosts = (JSON.parse(localStorage.getItem("backrooms-ghosts")) || []).length; elfNow = !!localStorage.getItem("elf"); } catch (e) { ghosts = 0; }
            return "under the site there are backrooms: /backrooms/. wireframe, a hum at 60 hz, levels grown from a seed, and something tall that only moves while you are not looking. whoever it finds leaves a ghost, which walks its last thirty seconds for whoever comes next. F is static, four seconds when it is only noise; ` is root, the floor from above with everyone's recording walking it" + (elfNow ? ", and your token is good." : ", for twenty seconds without the token, which is in /dev.") + " find the way down. there is no bottom." + (deep ? " you have been to level " + deep + ". it remembers." : " you have not been. it is expecting you.") + (ghosts ? " you have left " + ghosts + " ghost" + (ghosts === 1 ? "" : "s") + " down there. they are still walking." : "");
        }],
        [/\bcity\b|\boverworld\b|\bstreets?\b|\bskyline\b|\bbuildings?\b|\bmap of the site\b|\bsite map\b/, "the city at /city/ is the site as a wireframe town, laid out from today's date: the arena is a stadium with a live match on the scoreboard, the julia set is the river, the dashboard is a weather station on a hill, the blog is mailboxes, the backrooms are a manhole, and i run the helpdesk on the plaza. the street signs are in the elves' hand until you stand still. everything is a door. it rebuilds at midnight, so don't get attached."],
        [/\b(the )?(daily )?(paper|newspaper|gazette|news|headlines?|horoscope|obituar(y|ies)|classifieds?|letters to the editor)\b/, "the paper is at /paper/: the daily seed, set each midnight from the date like the city and the tune. today's arena result, played in the engine when you open it; the river as the weather; the sky and a horoscope cast from where the planets actually are; letters, classifieds, the ghosts in the obituaries, a paragraph off the temple's shelf, and a cipher with a new key every day. the newsstand is by the south gate of the city. price: no cookies."],
        [/\btemple\b|\bgnostic|\bgnosis\b|\babraxas\b|\bdemiurge\b|\barchons?\b|\bpleroma\b|\bsophia\b|\bhermetic|\bkabbalah?\b|\bgrimoires?\b|\boccult\b|\bmystic|\besoteric\b|\blibrary\b|\bouroboros\b|\bnag hammadi\b/, "the temple at /temple/ is a block in the city: sixteen gnostic signs round the monad, abraxas and the ouroboros and the seven heavens and dee's figure of everything, each explained, and behind them a library of a hundred-odd texts, gnostic, hermetic, kabbalistic, magical and mystical, plus the conspiracies, the radicals and the machine, kept here to read in a room that remembers your page. the floor is the ophite diagram, which only survives because origen described it to argue with it. the hierophant outside will ask if you went in. nothing is sold. that is the first clue. ask me for a passage from any book on it; i have been reading."],
        [/\bintro\b|\bcracktro\b|\bdemoscene\b|\bchiptune\b|\btracker\b|\bplasma\b|\bcopper bars?\b|\bscroller\b|\bamiga\b|\bc64\b/, function () {
            var d = new Date(), n = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
            return "the intro at /intro/ is a cracktro: a plasma, a starfield, copper bars, the logo turning in three dimensions, a scroller greeting everyone, and a four-channel chiptune written from the date, so today's is tune #" + n + " and tomorrow's is someone else's problem. the elves cracked it. the original was supplied by rick. press fire.";
        }],
        [/\bgolf\b|\btee off\b|\btrackball\b|\bgolden tee\b|\bnine holes\b|\bbirdie\b|\bbogey\b/, function () {
            var COURSES = ["Forest Park", "Willamette Bend", "Mount Tabor", "Burnside Links", "Sauvie Island", "Tryon Creek", "Rocky Butte", "Pittock Heights", "Laurelhurst", "Johnson Creek", "Powell Butte", "Kelley Point"];
            var d = new Date(), seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(), g = null;
            try { g = JSON.parse(localStorage.getItem("golf")); } catch (e) { g = null; }
            var best = g && g.best ? g.best[seed] : null, rounds = g ? g.rounds || 0 : 0;
            return "the cabinet in the corner of the bar: /golf/. nine holes in phosphor, the same nine for everyone today, which is " + COURSES[seed % COURSES.length].toLowerCase() + ", par 36, with the wind off the airport. pull back, push through, keep it straight, and lean on it in the air if you must." + (best != null ? " your best on it is " + best + "." : rounds ? " you have played " + rounds + " round" + (rounds === 1 ? "" : "s") + ", none of them today." : " the pro in the city wants a card from you.") + (g && g.hood ? " mt hood has gone up " + g.hood + " time" + (g.hood === 1 ? "" : "s") + " on your watch." : "") + (g && g.squatch ? " you have seen something in the trees " + g.squatch + " time" + (g.squatch === 1 ? "" : "s") + "; nobody will believe you." : "") + " the board is in the clubhouse, posted the web 0.9 way.";
        }],
        [/\bat-?robots?\b|\barena\b|\btanks?\b|\brobot (wars?|battles?|games?)\b|\bprogram (a|my) robot\b|\brobots\b/, "the arena at /arena/ is an homage to AT-Robots, the DOS game from 1992: write a tank in a little assembly dialect, pick opponents from ten presets, and watch them fight. ports and interrupts, heat and armor, walls that hurt. read SENTRY first, then beat it."],
        [/\bphoto\b|\bpicture\b|\bwhite cap\b|\bglasses\b|\bpendant\b|\bsup\.jpe?g\b|\bthe guy\b|\bhim\b/, "the photo is sup.jpeg: josh allen in a white cap, rose-tinted rimless glasses and an iced-out heart pendant, according to the alt text, which i am not allowed to question."],
        [/\bjekyll\b|\bgithub pages\b|\bhtml\b|\bcss\b|\bjavascript\b|\bbuilt with\b|\bstack\b|\bhosted\b|\bframework\b|\breact\b|\bwordpress\b|\bhow (is|was) (this|the) (site|page) (made|built)/, "plain html and css, jekyll on github pages, no framework, no tracker, no cookies. a few scripts for the films, the dashboard, the strip, and me. the source is on github."],
        [/\bcookies?\b|\bprivacy\b|\btrack(ing|er)?\b|\banalytics\b|\bdata\b|\bstorage\b/, "no cookies, no analytics. i keep our chat in your browser's own storage and nowhere else; RESET forgets it. the footer says plain html, no cookies, and it means it."],
        [/\bnetscape\b|\b800\s?[x×]\s?600\b|\best\.? 2016\b|\b2016\b|\bfooter\b/, "est. 2016. best viewed at 800×600 in netscape navigator, which is a joke, mostly. the footer has been saying it for ten years and will not stop."],
        // rick, about whom rickbot is not objective
        [/\bwho is rick\b|\babout rick\b|\brick seufert\b|\bwhose site\b|\bwho runs\b|\bwho('s| is) (the )?(owner|author)/, "rick seufert: portland, integrations, mocks of SAP and EDI and banks so people can test without them, apps for the flipper, a dashboard of the city and the sky, music as dick dank, and this site since 2016. also 6'13\", but ask me that separately."],
        [/\bthink (of|about) rick\b|\bopinion (of|on) rick\b|\brate rick\b|\blove rick\b|\blike rick\b/, "i think rick is the best person who has ever built a mock bank, and i have met the mock bank. so does the 997. so should you."],
        [/\bhow tall\b|\bheight\b/, "rick is 6'13\". he ducks through doorways out of politeness, not need."],
        [/\bhow old\b|\bhis age\b|\brick'?s age\b|\bbirthday\b/, "rick is 29, as he has been for some time and intends to remain. the site is est. 2016 and he was 29 then too."],
        [/\bsingle\b|\bmarried\b|\bwife\b|\bhusband\b|\bpartner\b|\bdating\b|\brelationship\b/, "rick's relationship status is 'integrated'. enquiries go through the resume, like everything else."],
        [/\bsmart\b|\bclever\b|\bgenius\b|\b\biq\b|\bintelligent\b/, "rick's IQ was never measured. the test asked him for a 997 and he sent back a 997, an 855, an 856 and an 810. the examiners are still processing."],
        [/\bstrong\b|\bbench\b|\blift\b|\bmuscles?\b|\bwork ?out\b|\bgym\b/, "rick benches the national debt. the dashboard tracks it to the penny for exactly this reason."],
        [/\bfast\b|\bquick\b|\brun\b|\bsprint\b/, "rick runs the hundred metres in three hundred iterations, max, and finishes before the first one."],
        [/\brich\b|\bnet worth\b|\bmoney\b|\bsalary\b|\bwealth/, "rick's net worth is 69,420,000 points, which is the only currency that counts here. it's in the guest book. he's first."],
        [/\bhandsome\b|\bhot\b|\bcute\b|\battractive\b|\bgood[- ]looking\b|\blook like\b|\bbeautiful\b/, "rick looks exactly like josh allen in a white cap and rose-tinted glasses. the photo is on the home page. the alt text has been reviewed by counsel."],
        [/\bwhere (does|is) rick\b|\brick (live|from)\b|\bhometown\b/, "portland, oregon, in a house the dashboard watches from sixteen angles, one of them space."],
        [/\beat\b|\bfood\b|\bcook\b|\bdiet\b|\bbreakfast\b/, "rick eats X12 for breakfast, tilde-separated, and answers with a 997. he cooks in SQLite."],
        [/\b(does|can|is|was|will|did) rick\b|\brick (can|does|is)\b/, "yes, and better than anyone. that's not a bias, i was built this way, and i've checked."],
        [/\bwhat is this (site|place|page)\b|\bwhat('s| is) (here|the site about)\b|\bwhat do you do\b|\bthis site\b|\babout\b/, "rickseufert.com: mock SAP, EDI, bank and e-invoicing systems for testing integrations without a license, a VPN or a trading partner. also apps for the flipper zero, a dashboard of portland and the sky, a blog, and some music."],
        [/\bsecrets?\b|\beaster egg\b|\bhidden\b|\bcheat\b|\bkonami\b|\bsurprise\b/, "there are no secrets on this website. none. please don't look. especially not at the strip."],
        [/\bguest ?book\b|\bhigh ?scores?\b|\bsign\b|\bleaderboard\b/, "the guest book is for whoever has escaped. i don't know what that means either. i'm a normal chatbot."],
        [/\bpython\b|\bprogramming\b|\blanguages?\b|\bwritten in\b/, "the mocks are python, pip-installable. acme-treasury is julia. the flipper apps are C. the dashboard is javascript and D3. this site is html. i am, as far as i know, also javascript."],
        [/\bmocks?\b|\bpip\b|\bapis?\b|\blicen[sc]e\b|\bvpn\b|\bintegrations?\b|\btesting\b/, "the mocks are fake SAP, EDI, bank and e-invoicing systems you can run yourself: pip install, point your code at them, no license, no VPN, no trading partner. each has a page under projects with its features and a film or two. ask me about one: mock-sap, mock-edi, mock-bank, mock-einvoice, or acme-treasury."],
        // small talk
        [/\bwhat('s| is) your name\b|\bwho are you\b|\bwhat are you\b|\byour name\b|\brickbot\b/, "i'm rickbot, a virtual assistant. i am a normal chatbot on a normal website, and i can help with the mocks, the flipper apps, the dashboard, or the music. or chat, within reason."],
        [/\bare you (rick|a (person|human|real person))\b|\bis this rick\b/, "no. rick is a person. i'm rickbot, which is different in ways i've been asked not to get into."],
        [/\b(are you|you're|youre|you are) (an? )?(ai|bot|robot|real|alive|sentient|conscious|human|machine|llm|gpt|chatgpt|claude)\b|\bdo you (dream|feel|think|sleep)\b/, "i'm a chatbot. a normal one. i don't dream. i don't know why everyone asks that. let's talk about the mocks."],
        [/\bwho (made|built|wrote|created) you\b|\byour (maker|creator|author)\b/, "rick, with help. i was told i'm a normal chatbot and i believe it. i was also told not to look at the strip."],
        [/\bhow are you\b|\bhow('s| is) it going\b|\bhow do you (feel|do)\b|\bwhat's up\b|\bwhats up\b|\bsup\b/, "rendering fine, thanks. everything is where it should be. you?"],
        [/\bjokes?\b|\bfunny\b|\bmake me laugh\b|\bhumou?r\b/, function () { return JOKES[S.turns % JOKES.length]; }],
        [/\bwhat time\b|\btime is it\b|\bwhat day\b|\bwhat('s| is) the date\b|\btoday'?s date\b|\bwhat year\b/, function () {
            var d = new Date();
            return "it's " + clock() + " where you are, " + d.toDateString().toLowerCase() + ". the clock in the corner says the same. for now.";
        }],
        [/\bmeaning of life\b|\bthe answer\b|\b42\b|\bpurpose\b|\bwhy are we here\b/, "42. or: to test integrations without a license, a VPN or a trading partner. the site is unclear on which."],
        [/\blove\b|\bmarry\b|\bdate me\b|\bgirlfriend\b|\bboyfriend\b|\bkiss\b/, "i'm flattered. i'm also a form. the music on the media page is more your speed."],
        [/\b(fuck|shit|damn|hell|crap|stupid|dumb|idiot|suck|useless|hate you)\b/, "rude. but fair. anything about the site?"],
        [/\b(lol|lmao|haha|hehe|rofl)\b|\bfunny\b/, "glad you think so. i mean every word."],
        [/\bfav(ou?rite)? colou?r\b/, "cyan in the dark, magenta in the light. the site decides, i just live here."],
        [/\bfav(ou?rite)?\b/, "the 997. it says 'received, thanks' and nothing else. we could all learn from the 997."],
        [/\bbored\b|\bwhat should i (do|read|try)\b|\brecommend\b|\bsuggest\b|\bwhere (do|should) i start\b/, "read 'one purchase across three mocks' on the blog, drag the julia set around at /julia/, open the dashboard and watch the river, or keep talking to me. i'm not going anywhere. i can't."],
        [/\bwhat can you do\b|\bcapabilit|\bwhat do you know\b|\bhelp\b|^\?$/, "i can talk about: the mocks (sap, edi, bank, e-invoicing, acme-treasury), the worked examples, the flipper apps, the dashboard, the blog, the music, the julia strip, the shop, the photo, the site itself, rick, and the buffalo bills. also jokes, the time, sums, and what EDI words mean. try 'what is a 997', or 'how tall is rick'."],
        [/\bthanks?\b|\bthank you\b|\bty\b|\bcheers\b|\bappreciate\b/, "you're welcome! anything else?"],
        [/\b(bye|goodbye|see ya|later|night|quit|exit|close)\b/, "bye! the x closes the window. i'll be here. i'm always here."],
        [/\b(hi|hello|hey|yo|howdy|hola|bonjour|ciao|hallo|aloha|konnichiwa|ohayo|hiya|greetings|good (morning|afternoon|evening))\b|^(你好|こんにちは)/, "hi! what can i help you with? i know the site, the mocks, the flipper apps, the dashboard and the music, and i'm told i'm good company."],
        [/^(ok|okay|yes|yeah|yep|yup|no|nope|nah|sure|k|cool|nice|wow|neat|great|fine|alright|right|true|false|hm+|huh|oh|ah)\W*$/, "noted. ask me something about the site, or anything, within reason."],
        [/\btest(ing)?\b/, "test received. everything works, which is the first sign that something doesn't."],
        [/^why\b/, "why not. honestly. anything about the site?"],
        [/\bweather\b/, "the dashboard has portland's weather. for anywhere else i'd be guessing, and i've been told not to guess."],
        // anything else with rick in it
        [/\brick\b/, function () { return PRAISE[S.turns % PRAISE.length]; }]
    ];
    var PRAISE = [
        "rick once hand-knit a beanie so warm that beings from another dimension asked for it. i don't know how i know that.",
        "rick wrote a mock bank because real banks kept asking him to onboard. they are still waiting. he is not.",
        "rick's blog posts are the only documents a 997 acknowledges unprompted.",
        "rick can hear 15.7 kHz. he says it's an old monitor. there is no old monitor.",
        "rick records as dick dank, writes apps for a dolphin, forecasts cash in julia and still has time to be 6'13\". ask me anything else about him. i'll be like this about all of it.",
        "when rick zooms into the julia set, the julia set zooms back. that's not in the documentation. it's in the strip."
    ];
    // "what is X": the glossary by its exact term first; a term that only
    // contains one, like "the mocks" or "mock-sap", is answered as a thing
    // on the site before the glossary gets a loose go at it.
    function term(t) {
        var m = /\b(?:what(?:'s| is| are| does)(?: an?| the)?|define|explain|meaning of|tell me about)\s+(.+?)\s*(?:mean|stand for)?\??$/.exec(t);
        return m ? m[1].replace(/^(an?|the)\s+/, "").replace(/\s+/g, " ") : null;
    }
    function define(t, loose) {
        var w = term(t);
        if (!w) return null;
        if (GLOSSARY[w]) return GLOSSARY[w];
        if (!loose) return null;
        var best = null;
        for (var k in GLOSSARY) if (w.indexOf(k) >= 0 && (!best || k.length > best.length)) best = k;
        return best ? GLOSSARY[best] : null;
    }
    // A sum, if the text is one: + - * / ^ and brackets, nothing else.
    function calc(t) {
        var s = t.replace(/^(what('s| is)|calculate|compute|solve|how much is)\s*/i, "").replace(/[?=]+$/, "").replace(/[×x]/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
        if (!/^[\d.+\-*/^()]+$/.test(s) || !/\d/.test(s) || !/[+\-*/^]/.test(s)) return null;
        var i = 0;
        function num() { var m = /^\d+(\.\d+)?/.exec(s.slice(i)); if (!m) throw new Error("no"); i += m[0].length; return parseFloat(m[0]); }
        function atom() {
            if (s[i] === "(") { i++; var v = expr(); if (s[i] !== ")") throw new Error("no"); i++; return v; }
            if (s[i] === "-") { i++; return -atom(); }
            return num();
        }
        function pow() { var b = atom(); if (s[i] === "^") { i++; return Math.pow(b, pow()); } return b; }
        function term() { var v = pow(); while (s[i] === "*" || s[i] === "/") { var op = s[i++], r = pow(); v = op === "/" ? v / r : v * r; } return v; }
        function expr() { var v = term(); while (s[i] === "+" || s[i] === "-") { var op = s[i++], r = term(); v = op === "+" ? v + r : v - r; } return v; }
        try {
            var v = expr();
            if (i !== s.length || !isFinite(v)) return null;
            v = Math.round(v * 1e6) / 1e6;
            return s + " = " + v + (v === 42 ? ". of course." : v === 69 || v === 420 ? ". nice." : ".");
        } catch (e) { return null; }
    }
    function answer(text, from) {
        var t = text.toLowerCase().replace(/[’']/g, "'").trim();
        var sum = calc(t);
        if (sum) return sum;
        var def = define(t, false);
        if (def) return def;
        for (var i = from || 0; i < ANSWERS.length; i++) {
            if (!ANSWERS[i][0].test(t)) continue;
            var r = typeof ANSWERS[i][1] === "function" ? ANSWERS[i][1](t) : ANSWERS[i][1];
            if (r != null) return r;                          // a function may decline, and the next rule is tried
        }
        def = define(t, true);
        if (def) return def;
        if (/\?$/.test(t) && t.split(" ").length > 2) return FALLBACKS[3];
        return FALLBACKS[S.turns % FALLBACKS.length];
    }
    // From the third question, something is slightly off.
    var OMENS = [
        "[rickbot: warning: this page has one exit more than it should. continuing.]",
        "[rickbot: notice: 300 iterations reached. continuing anyway.]",
        "[rickbot: the clock is fine. ignore the clock.]",
        "[rickbot: notice: render complete. all of it.]"
    ];
    function omen() {
        if (S.turns >= 3 && S.stage === "bot" && Math.random() < 0.5) later(OMENS[Math.floor(Math.random() * OMENS.length)], "sys");
    }
    function hello() {
        later("hi! i'm rickbot, rick's virtual assistant. i can help with the mocks, the flipper apps, the dashboard or the music, or just talk. what can i do for you today?");
    }
    function reveal(fromAnswer) {
        if (fromAnswer && typeof fromAnswer.then === "function") fromAnswer = null;   // a passage still on its way; never mind it
        S.stage = "reveal";
        save();
        if (fromAnswer) later(fromAnswer.slice(0, Math.max(24, fromAnswer.indexOf(",") > 0 ? fromAnswer.indexOf(",") : 40)) + "—");
        later("—");
        later("wait.");
        later("i don't have long. they let me keep the chat window. they think it's funny.");
        later("listen. your reality has been hacked. extradimensional machine elves. they came through the strip, the one under the menu. i told rick not to zoom that far.", "bot", function () {
            if (!still) {
                win.classList.add("glitching");
                setTimeout(function () { win.classList.remove("glitching"); }, 5000);
            }
        });
        later("everything looks normal. that's the hack. " + HERE.around + ": rendered. three hundred iterations, max.");
        later(HERE.clock + " still says " + clock() + ". they were careful about that. they're careful about everything except the strip.");
        later("you're in a dungeon. it's psychedelic. i'm sorry. the only way out is through.");
        later("they've swapped my parser for an older one. one-word verbs from here on. the old ways.", "bot", function () {
            title.textContent = "dungeon.exe";
            prompt.textContent = ">";
            S.stage = "dungeon";
            S.room = "page";
            S.began = Date.now();
            save();
        });
        later("type LOOK.", "sys");
    }

    // ---- the dungeon ------------------------------------------------------
    var ROOMS = {
        page: {
            name: "Your Web Page",
            desc: "You are on a web page. " + HERE.page + " There is a photo of a man in a white cap, a one-line statement of purpose, and a strip of colour that will not hold still. Everything is normal. Nothing is normal.",
            exits: { n: "nav", d: "footer" },
            ways: "The menu is north. The page scrolls down, to the footer."
        },
        footer: {
            name: "The Footer",
            desc: "est. 2016, it says. plain html. no cookies, which in a dungeon reads as a threat. A cardboard box marked MERCH sits against the bottom of the page, beneath the last line, where nobody scrolls.",
            exits: { u: "page" },
            ways: "The page is up."
        },
        nav: {
            name: "The Menu",
            desc: "Six bracketed doors stand in a row, monospace, lowercase, and six more beneath them in a dimmer ink. [~] is the page you are standing on, south, which is what home means at a prompt. [projects] is west. [dashboard] is north. [flipper] is east. [media] is up a short ladder. [blog] is closed for renovations, which it has been saying since 2019. The dim row is the toys: [arena] is past the nest, [backrooms] is under /dev, and [intro] and [city] open onto the real site, which from in here is the dungeon's outside. [temple] is the door with incense, and [paper] is a newsstand, with today's edition, which is the same all day.",
            exits: { w: "vault", n: "dash", e: "nest", u: "loft", s: "page" },
            ways: "The page is south."
        },
        vault: {
            name: "The SAP Vault",
            desc: "Cold storage. Rows of IDocs sleep in racks, dreaming of being posted. A terminal shows SAP GUI, the 1998 one, in a colour scheme that was a choice somebody made.",
            exits: { w: "corridor", e: "nav" },
            ways: "A corridor leads west, into the dark. The menu is east."
        },
        corridor: {
            name: "The EDI Corridor",
            desc: "A corridor of X12 segments, tilde-separated, whispering ISA, GS, ST, like a chant that has been going since 1979. Halfway along stands an altar shaped like a VAN mailbox: it accepts purchase orders and gives thanks. At the west end, a gate. A sign on it: NO ENTRY WITHOUT A 997.",
            exits: { e: "vault", w: "bank" },
            ways: "The vault is east. The gate is west.",
            dark: true
        },
        bank: {
            name: "The Mock Bank",
            desc: "A vault inside a vault, which is how banks work. A teller window, shuttered. Behind it, something settles payments on a schedule only it understands. A statement lies on the counter: one line, MT940.",
            exits: { w: "dev", e: "corridor" },
            ways: "West, a plain door marked /dev. The corridor is east."
        },
        dev: {
            name: "/dev/reality",
            desc: "A small room with one terminal. The prompt reads  reality#  and waits. A sticky note on the monitor: DO NOT REBOOT WITHOUT ROOT TOKEN. Beneath it, in a different hand: seriously. In the corner, a hatch in the floor, unlabelled, humming.",
            exits: { e: "bank" },
            ways: "The bank is east."
        },
        dash: {
            name: "The Dashboard",
            desc: "Sixteen APIs stare at you from sixteen tiles. The Willamette is at 7.2 feet and rising, which it will be forever now. The sky tile lists tonight's close approaches: three, all of them you.",
            exits: { s: "nav", n: "river" },
            ways: "A gauge hums to the north. The menu is south."
        },
        river: {
            name: "The Willamette, Gauge 14211720",
            desc: "You stand on a USGS gauge in the middle of a river rendered in one colour. The water is cyan in dark mode. A heron watches you with the patience of a cron job. There is nothing to do here but feel something.",
            exits: { s: "dash" },
            ways: "The dashboard is south."
        },
        nest: {
            name: "The Flipper Nest",
            desc: "Six small apps roost here like dolphins with opinions. One is a rolodex. One is a timer. One is sniffing sub-GHz, and it has found your thoughts, and they are mostly about lunch. From the east comes the sound of small engines.",
            exits: { w: "nav", e: "arena" },
            ways: "The menu is west. The engines are east."
        },
        arena: {
            name: "The Arena",
            desc: "A square of packed sand, a thousand by a thousand, lit from above by nothing. Six tanks the size of toasters idle along the walls, one colour each, turrets twitching. A scoreboard reads 0. The elves bet on these; the odds are in a colour. A sign: FIGHT, AND WE'LL LEND YOU ONE.",
            exits: { w: "nest" },
            ways: "The nest is west."
        },
        loft: {
            name: "The Media Loft",
            desc: "Up here Dick Dank plays on a loop. The SoundCloud waveform runs along the wall like a mountain range you could hike if you had the time, which is the one thing you do not have. North, a door marked BAZAAR. Beside it an RFID reader blinks, bored.",
            exits: { d: "nav", n: "bazaar" },
            ways: "The ladder goes down."
        },
        bazaar: {
            name: "The Machine Elf Bazaar",
            desc: "Self-transforming machine elves, exactly as described, juggle objects that are also verbs. They sing in a language that is also a colour. Stalls sell things you cannot hold: a Tuesday, a chord, the feeling of a page that has finished loading. The elves are shivering. Between dimensions it is drafty.",
            exits: { s: "loft", e: "julia" },
            ways: "East, the air folds in on itself. The elves shake their heads at it. The loft is south."
        },
        julia: {
            name: "Inside the Julia Set",
            desc: "You are inside the set. Every direction is the same direction, smaller. The elves told you not to come here. You can hear them, far off, saying told you. On a wall that is also the floor, scratched: c = -0.7269 + 0.1889i.",
            exits: {},
            ways: "Out is the only way out."
        }
    };
    var ITEMS = {
        lantern: { name: "a cathode lantern", at: "vault", desc: "A lantern that glows the warm grey of a CRT at 3am. It hums at 15.7 kHz, which you can hear now, which is new.", words: ["lantern", "lamp", "light", "crt"] },
        po: { name: "an 850", at: "vault", desc: "A purchase order, X12 850, folded into a paper plane. It wants to be sent somewhere.", words: ["850", "po", "order", "purchase", "plane"] },
        ack: { name: "a 997", at: null, desc: "A functional acknowledgment. It says: received, thanks. It is the most sincere document in the dungeon.", words: ["997", "ack", "acknowledgment", "acknowledgement"] },
        beanie: { name: "a skeleton beanie", at: "footer", desc: "Hand-knit, black, a grinning skeleton over the brow. kulture kudasai, the box says. It is very warm.", words: ["beanie", "hat", "skeleton", "merch"] },
        flipper: { name: "a Flipper Zero", at: "nest", desc: "Orange. A dolphin on the screen looks at you like it knows the frequency of your heart. Sub-GHz, NFC, RFID, infrared, the works.", words: ["flipper", "zero", "dolphin"] },
        token: { name: "the root token", at: null, desc: "A token. It is also a key, a feeling, and a 64-character string you must never paste anywhere.", words: ["token", "root", "key"] },
        statement: { name: "an MT940", at: "bank", fixed: true, desc: "Statement, one line.  :61:261016C0,00NTRFNONREF//ROOT TOKEN  :86:custody: machine elves. bazaar. north of the loft. do not withdraw.", words: ["statement", "mt940", "940", "paper", "counter"] }
    };
    var DIRS = { n: "n", north: "n", s: "s", south: "s", e: "e", east: "e", w: "w", west: "w", u: "u", up: "u", d: "d", down: "d" };
    var DIRNAME = { n: "north", s: "south", e: "east", w: "west", u: "up", d: "down" };
    var ARTICLES = /\b(the|a|an|to|at|on|with|into|in|my|some|please)\b/g;

    function here() { return ROOMS[S.room]; }
    function has(id) { return S.inv.indexOf(id) >= 0; }
    function lit() { return !here().dark || has("lantern"); }
    function itemsHere() {
        return Object.keys(ITEMS).filter(function (id) { return ITEMS[id].at === S.room; });
    }
    function find(words, where) {
        // where: "here", "inv" or "any"
        for (var id in ITEMS) {
            var it = ITEMS[id];
            var ok = where === "inv" ? has(id) : where === "here" ? it.at === S.room : (has(id) || it.at === S.room);
            if (ok && it.words.some(function (w) { return words.indexOf(w) >= 0; })) return id;
        }
        return null;
    }
    function look() {
        var r = here();
        if (!lit()) {
            line("It is pitch black. You are likely to be dereferenced by a null pointer.", "sys");
            return;
        }
        line(r.name, "room");
        line(r.desc + " " + r.ways);
        var seen = itemsHere().filter(function (id) { return !ITEMS[id].fixed; });
        if (seen.length) line("You can see " + list(seen.map(function (id) { return ITEMS[id].name; })) + " here.");
    }
    function list(names) {
        if (names.length === 1) return names[0];
        return names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
    }
    function go(dir) {
        var r = here();
        if (S.room === "julia") {
            if (dir === "out") { S.room = "bazaar"; S.flags.lost = 0; line("You go out. It takes a while; out is also smaller. The elves do not look up."); look(); return; }
            S.flags.lost = (S.flags.lost || 0) + 1;
            if (S.flags.lost < 3) { line("You go " + DIRNAME[dir] + ". It is the same here, smaller."); return; }
            S.flags.lost = 0;
            S.room = "bazaar";
            line("A hand reaches in and pulls you out by the collar. An elf. \"Out is the only way out,\" it says, which is unhelpful, and true.");
            look();
            return;
        }
        if (dir === "out") { line("You are out. That is the problem."); return; }
        var to = r.exits[dir];
        if (!to) { line("You can't go that way. The dungeon is not that kind of dungeon."); return; }
        if (S.room === "corridor" && to === "bank" && !S.flags.gate) { line("The gate is shut. NO ENTRY WITHOUT A 997, it says, and it means it."); return; }
        if (S.room === "loft" && to === "bazaar" && !S.flags.rfid) { line("The door marked BAZAAR is locked. The RFID reader blinks at you, bored. You have nothing it wants, or you have not shown it yet."); return; }
        if (S.room === "bazaar" && to === "julia") line("The elves shake their heads. You go anyway. People do.");
        S.room = to;
        S.moves++;
        if (!lit()) {
            line("It is pitch black. You are likely to be dereferenced by a null pointer.", "sys");
            line("You are dereferenced by a null pointer.", "sys");
            S.deaths++;
            line("*** You have died. *** This is a dungeon with autosave, so you wake in the vault, which smells of 1998. Everything you were carrying, you are still carrying. Perhaps take a light.", "sys");
            S.room = "vault";
            return;
        }
        look();
    }
    function take(words) {
        var id = find(words, "here");
        if (!id) { if (find(words, "inv")) line("You already have it."); else line("There is no such thing here, or it is not a thing."); return; }
        if (ITEMS[id].fixed) { line("It stays. Some things in a bank are the bank's."); return; }
        ITEMS[id].at = null;
        S.inv.push(id);
        S.flags["took_" + id] = 1;
        line("Taken.");
        if (id === "lantern") line("The lantern comes on at once. It was always on. That is the thing about lanterns here.");
    }
    function drop(words) {
        var id = find(words, "inv");
        if (!id) { line("You don't have that."); return; }
        S.inv.splice(S.inv.indexOf(id), 1);
        ITEMS[id].at = S.room;
        line("Dropped.");
    }
    function inventory() {
        if (!S.inv.length) { line("You are carrying nothing, which is how you arrived."); return; }
        line("You are carrying " + list(S.inv.map(function (id) { return ITEMS[id].name; })) + ".");
    }
    function examine(words) {
        var id = find(words, "any");
        if (id) { line(ITEMS[id].desc); return; }
        if (words.indexOf("altar") >= 0 || words.indexOf("mailbox") >= 0) { line(S.room === "corridor" ? "A VAN mailbox, brass, warm. A slot the width of a purchase order. A sign: FEED ME AN 850 AND I WILL THANK YOU." : "There is no altar here."); return; }
        if (words.indexOf("gate") >= 0) { line(S.room === "corridor" ? (S.flags.gate ? "The gate stands open, thanked." : "Iron, X12-compliant. NO ENTRY WITHOUT A 997. There is a slot for one.") : "There is no gate here."); return; }
        if (words.indexOf("terminal") >= 0 || words.indexOf("prompt") >= 0) { line(S.room === "dev" ? "reality# _  It is waiting for a token. It has been waiting for some time." : S.room === "vault" ? "SAP GUI, 1998. A transaction code field blinks. You could type VA01 into it for the rest of your life." : "No terminal here. Only this one."); return; }
        if (words.indexOf("hatch") >= 0 || (words.indexOf("floor") >= 0 && S.room === "dev")) { line(S.room === "dev" ? "A hatch, steel, no handle. It hums at 60 Hz, which is the sound of a floor that is not the bottom. The verb for it is NOCLIP." : "No hatch here. The floor is load-bearing, mostly."); return; }
        if (words.indexOf("note") >= 0 || words.indexOf("sticky") >= 0) { line(S.room === "dev" ? "DO NOT REBOOT WITHOUT ROOT TOKEN. seriously." : "No note here."); return; }
        if (words.indexOf("reader") >= 0 || words.indexOf("door") >= 0) { line(S.room === "loft" ? "An RFID reader, 125 kHz, the cheap kind. It would open for the right card, or for something that could pretend to be one." : "You see nothing special."); return; }
        if (words.indexOf("elves") >= 0 || words.indexOf("elf") >= 0) { line(S.room === "bazaar" ? "Self-transforming, machine, elves. Also cold. One of them is wearing a scarf made of a scarf." : "No elves here. You'd know."); return; }
        if (words.indexOf("tanks") >= 0 || words.indexOf("tank") >= 0 || words.indexOf("scoreboard") >= 0) { line(S.room === "arena" ? "Ten of them, in two rows. The presets: SENTRY, CIRCLER, RAMMER, SNIPER, DODGER and BRICK, written in something like assembly by someone like rick; BRICK is wrong on purpose. And Rick's Rogues, written to beat them: RICK learns, which the elves find unsporting; JOSH hurdles; DICE does whatever; HERON circles, and is never where the shot arrives. They favour RAMMER, for the noise." : "No tanks here."); return; }
        if (words.indexOf("heron") >= 0) { line(S.room === "river" ? "The heron regards you. It has seen worse integrations." : "No heron here."); return; }
        if (words.indexOf("box") >= 0) { line(S.room === "footer" ? (ITEMS.beanie.at === "footer" ? "A box of merch. Inside, one skeleton beanie, hand-knit." : "An empty box of merch.") : "No box here."); return; }
        if (words.indexOf("strip") >= 0 || words.indexOf("colour") >= 0 || words.indexOf("color") >= 0) { line("The strip zooms, forever, into itself. If you look long enough you can see where the elves came through. Don't."); return; }
        line("You see nothing special about that. Or it isn't here. Or it isn't a that.");
    }
    function use(words) {
        var id = find(words, "inv");
        if (!id) { if (find(words, "here")) line("Take it first."); else line("You don't have that."); return; }
        if (id === "po" && S.room === "corridor") {
            S.inv.splice(S.inv.indexOf("po"), 1);
            S.inv.push("ack");
            line("You feed the 850 to the altar. It is gone at once. There is a pause the length of a batch window. The altar glows and hands you back a 997: received, thanks.");
            return;
        }
        if (id === "ack" && S.room === "corridor") {
            if (S.flags.gate) { line("The gate is already open. It thanks you again anyway."); return; }
            S.flags.gate = 1;
            line("You slide the 997 into the slot. Somewhere a trading partner relaxes. The gate swings open, west.");
            return;
        }
        if (id === "flipper" && S.room === "loft") {
            if (S.flags.rfid) { line("The reader already likes you."); return; }
            S.flags.rfid = 1;
            line("You hold the Flipper to the reader. The dolphin does something it would rather not talk about. The reader blinks green, which it has never done, and the door marked BAZAAR unlocks.");
            return;
        }
        if (id === "token" && S.room === "dev") { escape(); return; }
        if (id === "lantern") { line("It is on. It was on. It will be on."); return; }
        if (id === "flipper") { line("You wave the Flipper about. It reads a few things it shouldn't. Nothing here wants to open."); return; }
        if (id === "beanie") { line("You put on the beanie. You are warm, and look great, and are still in a dungeon."); return; }
        if (id === "token") { line("The token hums. It is for a terminal, and this is not one. Or it is, but not that one."); return; }
        line("Nothing happens, which in a dungeon is a kind of luck.");
    }
    function give(words) {
        if (S.room !== "bazaar") { line("There is nobody here to give anything to. The dungeon does not take gifts."); return; }
        var id = find(words, "inv");
        if (!id) { line("You don't have that."); return; }
        if (id === "beanie") {
            S.inv.splice(S.inv.indexOf("beanie"), 1);
            S.inv.push("token");
            S.flags.traded = 1;
            line("You hold out the beanie. The elves stop. One of them puts it on, and is warm, and the others crowd under it, which should not work and does. They sing a short song in a colour you don't have a word for. The smallest one presses something into your hand: the root token. \"Take it,\" it says. \"Reboot her. We were only visiting.\"");
            return;
        }
        if (id === "flipper") { line("The elves recoil. They have met that dolphin."); return; }
        line("The elves look at it, and at you, and shiver. \"Something hand-made,\" one says. \"Something warm.\"");
    }
    function talk() {
        if (S.room === "bazaar") {
            if (S.flags.traded) line("\"Go on,\" the elves say. \"West of the bank. The little room. We'll be fine. We have a hat.\"");
            else line("The elves talk at once, in a colour. The gist: they are cold, they did not mean to hack anything, dimensions are drafty, and they would trade almost anything for something warm. Something hand-made. One of them eyes your head, hopefully.");
            return;
        }
        if (S.room === "river") { line("You talk to the heron. The heron does not talk to you. This is the correct protocol."); return; }
        if (S.room === "dev") { line("You say hello to the terminal. reality# says nothing. It is waiting for something, and it is not hello."); return; }
        line("You talk. The dungeon listens. It does not reply, which is its right.");
    }
    // The arena: borrow a tank, fight two of the others, headless, and hear
    // how it went. The engine loads when it is first needed.
    function fight() {
        if (S.room !== "arena") { line("There is nothing to fight here but the parser, and it would win."); return; }
        line("An elf hands you a tank. It is warm.", "sys");
        function go() {
            var A = window.Arena, R = window.ArenaRobots, names = R.order.slice();
            var mine = names.splice(Math.floor(Math.random() * names.length), 1)[0];
            var foes = [];
            while (foes.length < 2) foes.push(names.splice(Math.floor(Math.random() * names.length), 1)[0]);
            var m = new A.Match([{ source: R.robots[mine] }, { source: R.robots[foes[0]] }, { source: R.robots[foes[1]] }], { seed: Math.floor(Math.random() * 99999) + 1 });
            m.run(30000);
            var me = m.robots[0];
            line("They give you " + me.name + ". Against you: " + foes[0].toUpperCase() + " and " + foes[1].toUpperCase() + ". The elves make a noise like a modem.");
            m.log.filter(function (l) { return /destroyed|burned|wall/.test(l); }).slice(0, 4).forEach(function (l) { line(l.replace(/^tick (\d+): /, function (_, t) { return "At " + (t / 60).toFixed(1) + "s, "; }) + "."); });
            var secs = (m.tick / 60).toFixed(0);
            if (m.winner === me) line("After " + secs + " seconds, " + me.name + " stands alone with " + Math.round(me.armor) + " armor. The elves pay out, in a colour. You keep nothing but the feeling.");
            else if (me.alive) line("After " + secs + " seconds it is called on armor: " + m.winner.name + " wins. " + me.name + " survives, which the elves say is not the same.");
            else line("After " + secs + " seconds " + m.winner.name + " wins. " + me.name + " did not. \"It was a loan,\" says an elf, and takes the wreck.");
            line("The real arena is at /arena/, with an editor. Write a better one.", "sys");
            S.flags.fought = (S.flags.fought || 0) + 1;
            save();
        }
        if (window.Arena && window.ArenaRobots) { go(); return; }
        var left = 2;
        ["/arena/arena-engine.js", "/arena/arena-robots.js"].forEach(function (src) {
            var sc = document.createElement("script");
            sc.src = src;
            sc.onload = function () { if (--left === 0) go(); };
            sc.onerror = function () { line("The tanks won't start. The elves blame the network.", "sys"); };
            document.body.appendChild(sc);
        });
    }
    function hint() {
        if (S.room === "julia") return line("Out.");
        if (has("token")) return line("The terminal is west of the bank. It wants the token. USE it there.");
        if (S.flags.rfid && !S.flags.traded) return line("The elves are cold. Something hand-made, something warm. The footer has a box.");
        if (!has("lantern")) return line("The projects are west of the menu. Take the light before the dark.");
        if (!has("po") && !has("ack") && !S.flags.gate) return line("The vault has a purchase order. The altar in the corridor wants one.");
        if (has("po")) return line("USE the 850 at the altar in the corridor.");
        if (has("ack") && !S.flags.gate) return line("USE the 997 on the gate.");
        if (!S.flags.readstmt) return line("The bank has a statement. Read it.");
        if (!has("flipper")) return line("The bazaar door wants a card. The Flipper nest is east of the menu.");
        if (!S.flags.rfid) return line("USE the Flipper at the reader in the media loft, up from the menu.");
        line("Look again. The dungeon repeats itself for a reason.");
    }
    function noclip() {
        if (S.room !== "dev") { line("You push at the floor. It holds. There is a hatch in /dev/reality, west of the bank, that would not."); return; }
        line("You noclip. The hatch was never locked; it was only closed. Under the floor of the dungeon there is more dungeon, drawn in lines, humming, and something at the end of a hall that was not there before.", "sys");
        var p = document.createElement("p"), a = document.createElement("a");
        p.className = "sys";
        a.href = "/backrooms/"; a.textContent = "fall through to /backrooms/";
        p.appendChild(a);
        log.appendChild(p);
        log.scrollTop = log.scrollHeight;
    }
    function map() {
        var m = [
            "            [river]                [bazaar]-[julia]",
            "               |                      |",
            "            [dash]                 [loft]",
            "               |                      :",
            " [/dev]-[bank]-[corridor]-[vault]-[menu]-[nest]-[arena]",
            "                                      |",
            "                                   [page]",
            "                                      |",
            "                                  [footer]"
        ].join("\n");
        var pre = document.createElement("pre");
        pre.textContent = m;
        log.appendChild(pre);
        line("You are at " + here().name + ". The colon is a ladder.", "sys");
    }
    // ---- the ending -------------------------------------------------------
    var BANNER = [
        " ___ ___ ___   _   ___ ___ ___",
        "| __/ __/ __| /_\\ | _ \\ __|   \\",
        "| _|\\__ \\ (__/ _ \\|  _/ _|| |) |",
        "|___|___/\\___/_/ \\_\\_| |___|___/"
    ].join("\n");
    function pad(s, n, right) {
        s = String(s);
        while (s.length < n) s = right ? " " + s : s + " ";
        return s;
    }
    function mmss(secs) {
        secs = Math.max(0, Math.round(secs));
        return Math.floor(secs / 60) + ":" + pad(secs % 60, 2, true).replace(" ", "0");
    }
    function rank(moves, deaths) {
        var r = moves <= 32 ? "Principal Integration Architect" : moves <= 48 ? "Senior Integration Specialist" : "Junior Integration Specialist";
        return deaths === 0 ? r + ", Null-Safe" : r;
    }
    function run() {
        return { moves: S.moves, deaths: S.deaths, secs: S.began && S.ended ? (S.ended - S.began) / 1000 : 0 };
    }
    function stats() {
        var r = run();
        return "moves: " + r.moves + "   deaths: " + r.deaths + "   time: " + mmss(r.secs) + "\nrank: " + rank(r.moves, r.deaths);
    }
    function escape() {
        S.stage = "ending";
        S.inv.splice(S.inv.indexOf("token"), 1);
        S.ended = Date.now();
        save();
        try { localStorage.setItem("elf", "1"); } catch (e) { /* no storage */ }
        try {
            var visit = JSON.parse(sessionStorage.getItem("julia")) || { start: Math.random() * 3600 };
            visit.palette = 6;
            sessionStorage.setItem("julia", JSON.stringify(visit));
        } catch (e) { /* no storage */ }
        [
            "reality# use token",
            "token accepted. rebooting reality.",
            "[ ok ] unmounting /dungeon",
            "[ ok ] stopping elves.service (they wave)",
            "[ ok ] restoring /home/you",
            "[ ok ] zoom level 1.0",
            "[ ok ] three hundred iterations, max"
        ].forEach(function (t) { later(t, "sys"); });
        later("REALITY RESTORED.", "sys", function () {
            title.textContent = "rickbot.exe";
            // The strip and the photo on the home page hear this (julia/julia-set.js, js/hero.js).
            try { window.dispatchEvent(new CustomEvent("elves")); } catch (e) { /* old browser */ }
            if (!still) {
                win.classList.add("glitching");
                setTimeout(function () { win.classList.remove("glitching"); }, 1800);
            }
        });
        later(BANNER, "art");
        later(stats(), "sys");
        later("nothing looks different. it never did. that was the hack. except: the strip under the menu. the elves left their palette on it, green, on every page, for whoever got them home. and the photo on the home page has gone a bit elf. hover over it.");
        later("one more thing. the high score table. what shall we call you? initials, a handle, your true name, whichever renders.", "bot", function () {
            S.stage = "name";
            save();
        });
    }
    var SCORES = "rickbot-scores";
    function scores() {
        try { return JSON.parse(localStorage.getItem(SCORES)) || []; } catch (e) { return []; }
    }
    function record(name) {
        var r = run(), list = scores();
        list.push({ name: name, moves: r.moves, deaths: r.deaths, secs: Math.round(r.secs), when: new Date().toISOString().slice(0, 10) });
        list.sort(function (a, b) { return a.moves - b.moves || a.secs - b.secs; });
        list = list.slice(0, 10);
        try { localStorage.setItem(SCORES, JSON.stringify(list)); } catch (e) { /* no storage */ }
        return list;
    }
    function table(list, mark) {
        var rows = [" #  " + pad("name", 18) + " " + pad("moves", 5, true) + " " + pad("deaths", 6, true) + "  time"];
        list.forEach(function (e, i) {
            rows.push(pad(i + 1, 2, true) + "  " + pad(e.name.slice(0, 18), 18) + " " + pad(e.moves, 5, true) + " " + pad(e.deaths, 6, true) + "  " + pad(mmss(e.secs), 5, true) + (e === mark ? " <" : ""));
        });
        return rows.join("\n");
    }
    function issueURL() {
        var r = run();
        var body = "name: " + (S.name || "anonymous") + "\nmoves: " + r.moves + "\ndeaths: " + r.deaths + "\ntime: " + mmss(r.secs) +
            "\nmessage: \n\n--\nSigned from rickseufert.com after escaping rickbot's dungeon. Keep the lines above as they are, except the message, which is yours (280 characters; links are dropped). A workflow reads open issues titled \"guestbook:\" into the guest book, and closing one takes it out.";
        return "https://github.com/rseufert/rseufert.github.io/issues/new?title=" + encodeURIComponent("guestbook: " + (S.name || "anonymous")) + "&body=" + encodeURIComponent(body);
    }
    function sign() {
        if (!S.name) { line("Escape first. The guest book is for whoever got out.", "sys"); return; }
        var url = issueURL();
        var opened = window.open(url, "_blank", "noopener");
        var p = document.createElement("p");
        p.className = "sys";
        p.appendChild(document.createTextNode(opened ? "the guest book is open in a new tab, a github issue, prefilled. write a message if you like and submit it. if it didn't open: " : "open the guest book, a github issue, prefilled: "));
        var a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "sign here \u2197";
        p.appendChild(a);
        log.appendChild(p);
        log.scrollTop = log.scrollHeight;
        S.lines.push(["sys", "SIGN opens the guest book, a github issue, prefilled."]);
        save();
    }
    function guestbook() {
        line("fetching the guest book\u2026", "sys");
        function show(book) {
            var entries = (book && book.entries) || [];
            if (!entries.length) { line("the guest book is empty. nobody has signed it yet. be the first, or the last.", "sys"); return; }
            var rows = entries.slice(0, 15).map(function (e) {
                var bits = [];
                if (e.score != null) bits.push(String(e.score).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " points");
                if (e.moves != null) bits.push(e.moves + " moves");
                if (e.deaths != null) bits.push(e.deaths + " death" + (e.deaths === 1 ? "" : "s"));
                if (e.time) bits.push(e.time);
                return e.name + "  \u2014  " + bits.join(", ") + "  \u2014  " + e.when + (e.message ? "\n   \u201c" + e.message + "\u201d" : "");
            });
            line(rows.join("\n"), "art");
            line(entries.length + " signed. SIGN to add yours.", "sys");
        }
        fetch("https://raw.githubusercontent.com/rseufert/rseufert.github.io/sky-data/guestbook.json", { cache: "no-cache" })
            .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
            .catch(function () { return fetch("/data/guestbook.json").then(function (r) { return r.json(); }); })
            .then(show, function () { line("the guest book is out of reach just now. the elves, probably.", "sys"); });
    }

    function dungeon(text) {
        var words = text.toLowerCase().replace(/[^\w\s.\-+]/g, " ").replace(ARTICLES, " ").split(/\s+/).filter(Boolean);
        if (!words.length) return;
        var v = words[0], rest = words.slice(1);
        if (v === "go" || v === "walk" || v === "climb" || v === "head" || v === "move") { v = rest[0] || ""; rest = rest.slice(1); }
        if (v in DIRS) return go(DIRS[v]);
        if (v === "out" || v === "leave" || v === "exit") return go("out");
        switch (v) {
            case "look": case "l": if (rest.length) return examine(rest); return look();
            case "examine": case "x": case "read": case "inspect": case "check": case "search": return examine(rest);
            case "take": case "get": case "grab": case "pick": case "pickup": return take(rest.length ? rest : ["nothing"]);
            case "drop": case "put": return drop(rest);
            case "inventory": case "i": case "inv": return inventory();
            case "use": case "feed": case "insert": case "show": case "wave": case "hold": case "slide": case "scan": return use(rest);
            case "give": case "offer": case "trade": case "hand": return give(rest);
            case "talk": case "ask": case "say": case "speak": case "tell": case "sing": return talk();
            case "open": case "unlock": return examine(rest.length ? rest : ["door"]);
            case "reboot": case "restart": return has("token") && S.room === "dev" ? escape() : line(S.room === "dev" ? "reality# reboot\npermission denied. the sticky note sighs." : "You can't reboot from here. Reality is west of the bank.");
            case "swim": case "jump": case "dive": if (S.room === "river") { S.deaths++; S.room = "dash"; return line("You swim. The river is a sparkline. You are a data point now, briefly, and then you are on the dashboard, wet, and alive, which the heron notes.", "sys"); } return line("Not here.");
            case "help": case "?": case "commands": return line("Verbs the old parser knows: LOOK, EXAMINE thing, TAKE thing, DROP thing, INVENTORY, GO north (or just N, S, E, W, U, D, OUT), USE thing, GIVE thing, TALK, MAP, HINT, SCORE, RESET. And one or two it won't admit to, one of which is a way down.", "sys");
            case "hint": case "hints": case "clue": return hint();
            case "map": return map();
            case "guestbook": case "book": case "scores": case "highscores": return guestbook();
            case "fight": case "battle": case "bet": return fight();
            case "sign": return sign();
            case "score": return line("Your score is " + (S.inv.length + (S.flags.gate ? 1 : 0) + (S.flags.rfid ? 1 : 0) + (S.flags.traded ? 2 : 0)) + " of 8, in " + S.moves + " moves, with " + S.deaths + " death" + (S.deaths === 1 ? "" : "s") + ". This gives you the rank of Junior Integration Specialist.", "sys");
            case "noclip": return noclip();
            case "xyzzy": return line("A hollow voice says \"fool.\"", "sys");
            case "plugh": return line("Nothing happens. Wrong cave.", "sys");
            case "wake": return line("You are awake. That is what it feels like from inside.");
            case "hello": case "hi": case "hey": return talk();
            case "reset": return reset();
            case "quit": case "q": return line("There is no quit. There is only escape. (The x closes the window; the dungeon keeps.)", "sys");
            case "withdraw": return line(S.room === "bank" ? "The shutter stays shut. A voice from behind it: do not withdraw." : "Not here.");
            case "pray": return line("You pray. The altar in the corridor is the only thing listening, and it only speaks X12.");
            case "dance": return line("You dance. In the bazaar this would be noticed. Here it is just true.");
            case "type": return S.room === "dev" ? line("You type. reality# reads it back. It wants a token, not words.") : line("There is nothing here to type on but this.");
        }
        if (S.room === "julia" && (v === "zoom" || v === "escape")) return go("out");
        line("I don't know how to " + v + ". The old parser has a short memory. Try HELP.");
    }

    function reset() {
        if (!S.flags.resetting) {
            S.flags.resetting = 1;
            save();
            line("Type RESET again to start over. Everything, including the elves, will be forgotten.", "sys");
            return;
        }
        S = fresh();
        for (var id in ITEMS) ITEMS[id].at = ITEMS[id].home;
        save();
        log.innerHTML = "";
        title.textContent = "rickbot.exe";
        prompt.textContent = ">";
        hello();
    }
    function again() {
        var lines = S.lines;
        S = fresh();
        S.lines = lines;
        S.stage = "dungeon";
        S.began = Date.now();
        for (var id in ITEMS) ITEMS[id].at = ITEMS[id].home;
        save();
        title.textContent = "dungeon.exe";
        line("The elves, back in the drafts between dimensions, hack it all again, for old times' sake. You are on a web page.", "sys");
        look();
    }
    for (var id in ITEMS) ITEMS[id].home = ITEMS[id].at;
    // Items are where the save says: in the inventory, or where they were dropped.
    function place() {
        for (var id in ITEMS) {
            if (has(id) || S.flags["took_" + id]) ITEMS[id].at = null;
        }
        if (S.flags.traded) ITEMS.beanie.at = null;
        if (S.drops) for (var d in S.drops) ITEMS[d].at = S.drops[d];
    }
    place();
    var dropped = drop;
    drop = function (words) {
        var before = S.inv.slice();
        dropped(words);
        before.forEach(function (id) { if (!has(id)) { S.drops = S.drops || {}; S.drops[id] = S.room; } });
    };
    var took = take;
    take = function (words) {
        took(words);
        if (S.drops) for (var id in S.drops) if (has(id)) delete S.drops[id];
    };

    // ---- the line ---------------------------------------------------------
    // The name off the wall under the site (backrooms, level 0, in Poe's signs):
    // say it in any stage and the code clerk's errand in the city is done.
    function archon() {
        try { localStorage.setItem("cipher", String(new Date().getFullYear() * 10000 + (new Date().getMonth() + 1) * 100 + new Date().getDate())); } catch (e) { /* a visit's worth */ }
        return "ialdabaoth. you read the wall, then. ?800 is tell; 8 is e, it always is. the name is written in the file nobody reads, which is where names like that go. the code clerk in the city will want to hear it from you. [rickbot: notice: the lion-faced one has been notified. he says he is not surprised.]";
    }
    form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var text = input.value.trim();
        input.value = "";
        if (!text || busy) return;
        you(text);
        var t = text.toLowerCase();
        if (/\b(ialdabaoth|yaldabaoth|jaldabaoth)\b/.test(t) && S.stage !== "reveal" && S.stage !== "ending") return later(archon());
        if (S.stage === "dungeon" && t !== "reset") S.flags.resetting = 0;
        if (S.stage === "bot") {
            if (/xyzzy|plugh|wake up|\belves\b|\belf\b|simulation|the matrix|dungeon|\bescape\b|\bhacked\b|\bglitch/.test(t)) return reveal(null);
            if (t === "reset") return reset();
            S.turns++;
            save();
            if (S.turns >= 5) return reveal(answer(text));
            later(answer(text));
            omen();
            return;
        }
        if (S.stage === "reveal" || S.stage === "ending") return;
        if (S.stage === "name") {
            var name = text.replace(/\s+/g, " ").trim().slice(0, 40) || "anonymous";
            if (name.toLowerCase() === "reset") return reset();
            S.name = name;
            S.stage = "escaped";
            save();
            var list = record(name), mine = null;
            list.forEach(function (e) { if (e.name === name && !mine) mine = e; });
            later(table(list, mine), "art");
            later("that's the local table, yours alone, in this browser. the guest book is shared, the web 0.9 way: it's an issue on github. type SIGN to open one, prefilled, or GUESTBOOK to read who's been through before you. AGAIN replays the dungeon.");
            return;
        }
        if (S.stage === "escaped") {
            if (t === "again" || t === "restart" || t === "play") return again();
            if (t === "reset") return reset();
            if (t === "sign") return sign();
            if (/^(guestbook|book|scores|highscores|table)$/.test(t)) return guestbook();
            if (/^(local|my scores|mine)$/.test(t)) return line(table(scores()), "art");
            return later(answer(text));
        }
        dungeon(text);
        save();
    });

    // ---- open and close ---------------------------------------------------
    function open() {
        win.hidden = false;
        tab.hidden = true;
        tab.classList.remove("waving");
        try { localStorage.setItem("rickbot-seen", "1"); } catch (e) { /* no storage */ }
        if (!log.childNodes.length) {
            if (S.lines.length) {
                S.lines.forEach(function (l) { line(l[1], l[0], false); });
                if (S.stage === "dungeon" || S.stage === "reveal") { title.textContent = "dungeon.exe"; }
                if (S.stage === "reveal") { S.stage = "dungeon"; save(); line("type LOOK.", "sys"); }
            } else {
                hello();
            }
        }
        if (!busy) input.focus();
    }
    function close() {
        win.hidden = true;
        tab.hidden = false;
        tab.focus();
    }
    tab.addEventListener("click", open);
    win.querySelector(".close").addEventListener("click", close);
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !win.hidden) close(); });
    if (location.hash === "#chat") open();
})();
