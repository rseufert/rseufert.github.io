// rickbot: the site's chatbot, which is an easter egg.
//
// A [chat] tab in the corner opens a small window where rickbot, a virtual
// assistant, answers a question or two about the site. On the third it
// breaks off: your reality has been hacked by extradimensional machine
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
    tab.textContent = "chat";
    tab.setAttribute("aria-label", "chat with rickbot");
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
        var wait = still ? 250 : Math.min(2600, 500 + 22 * m.text.length);
        setTimeout(function () {
            typing.remove();
            line(m.text, m.cls);
            if (m.then) m.then();
            next();
        }, wait);
    }

    // ---- the assistant ----------------------------------------------------
    var ANSWERS = [
        [/xyzzy|plugh|wake up|machine elves|elves/, null],
        [/\b(mocks?|sap|edi|banks?|invoices?|einvoic\w*|acme|treasury|pip|apis?)\b/, "the mocks are fake SAP, EDI, bank and e-invoicing systems you can run yourself: pip install, point your code at them, no license, no VPN, no trading partner. each one has a page under projects with its features and a film or two."],
        [/\b(flippers?|zero|rolodex|sub-?ghz|apps?)\b/, "six Flipper Zero apps, on the home page under flipper. the rolodex is the one people ask about, and the one people should ask about is the timer."],
        [/\b(dashboard|weather|river|willamette|sky|portland)\b/, "the dashboard reads sixteen APIs about portland and the sky every time you load it. the willamette is on the home page too, just the one number. /dashboard/"],
        [/\b(music|dick dank|song|songs|soundcloud|youtube|film|films|video|media)\b/, "rick records as Dick Dank. the media page has the tracks and the films, and only one player open at a time, which took a surprising amount of work. /media/"],
        [/\b(julia|strip|fractal|zoom|mandelbrot)\b/, "the strip under the menu is a Julia set, zooming. the whole page is at /julia/. the walk it takes was charted in Julia, the language, which rick thinks is funny. please do not zoom too far."],
        [/\b(blog|post|posts|rss|atom)\b/, "the blog is at /blog/, with an atom feed. the latest post is about testing an SAP-to-EDI integration without either of the real things."],
        [/\b(resume|cv|hire|job|work|contact|email)\b/, "there is a resume on the site and a github in the footer. for anything else, the email is on the resume. i am not allowed to make promises on rick's behalf, which is the only rule i have been given."],
        [/\b(who|what) are you\b|\brickbot\b|\bbot\b|\bai\b|\bhuman\b/, "i'm rickbot, a virtual assistant. i am a normal chatbot on a normal website, and i can help with the mocks, the flipper apps, the dashboard, or the music."],
        [/\b(hi|hello|hey|yo|sup|howdy|hola|morning|evening)\b/, "hi! what can i help you with? i know about the mocks, the flipper apps, the dashboard and the music."],
        [/\b(help|\?)/, "i can help with: the mocks (sap, edi, bank, e-invoicing), the flipper apps, the dashboard, the music, the blog, the julia strip. ask me anything about those."],
        [/\b(thanks|thank you|ty|cheers)\b/, "you're welcome! anything else?"],
        [/\b(guest ?book|high ?scores?|sign)\b/, "the guest book is for whoever has escaped. i don't know what that means either. i'm a normal chatbot."],
        [/\b(bye|goodbye|later|quit|exit|close)\b/, "bye! the x closes the window. i'll be here."]
    ];
    function answer(text) {
        var t = text.toLowerCase();
        for (var i = 0; i < ANSWERS.length; i++) {
            if (ANSWERS[i][0].test(t)) return ANSWERS[i][1];
        }
        return "hmm, i'm not sure i can help with that. i can help with the mocks, the flipper apps, the dashboard, or the music.";
    }
    function hello() {
        later("hi! i'm rickbot, rick's virtual assistant. i can help with the mocks, the flipper apps, the dashboard or the music. what can i do for you today?");
    }
    function reveal(fromAnswer) {
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
            desc: "Five bracketed doors stand in a row, monospace, lowercase. [projects] is west. [dashboard] is north. [flipper] is east. [media] is up a short ladder. [blog] is closed for renovations, which it has been saying since 2019.",
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
            desc: "A small room with one terminal. The prompt reads  reality#  and waits. A sticky note on the monitor: DO NOT REBOOT WITHOUT ROOT TOKEN. Beneath it, in a different hand: seriously.",
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
            desc: "Six small apps roost here like dolphins with opinions. One is a rolodex. One is a timer. One is sniffing sub-GHz, and it has found your thoughts, and they are mostly about lunch.",
            exits: { w: "nav" },
            ways: "The menu is west."
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
        if (words.indexOf("note") >= 0 || words.indexOf("sticky") >= 0) { line(S.room === "dev" ? "DO NOT REBOOT WITHOUT ROOT TOKEN. seriously." : "No note here."); return; }
        if (words.indexOf("reader") >= 0 || words.indexOf("door") >= 0) { line(S.room === "loft" ? "An RFID reader, 125 kHz, the cheap kind. It would open for the right card, or for something that could pretend to be one." : "You see nothing special."); return; }
        if (words.indexOf("elves") >= 0 || words.indexOf("elf") >= 0) { line(S.room === "bazaar" ? "Self-transforming, machine, elves. Also cold. One of them is wearing a scarf made of a scarf." : "No elves here. You'd know."); return; }
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
    function map() {
        var m = [
            "            [river]                [bazaar]-[julia]",
            "               |                      |",
            "            [dash]                 [loft]",
            "               |                      :",
            " [/dev]-[bank]-[corridor]-[vault]-[menu]-[nest]",
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
            // The strip and the photo on the home page hear this (js/julia-set.js, js/hero.js).
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
            case "help": case "?": case "commands": return line("Verbs the old parser knows: LOOK, EXAMINE thing, TAKE thing, DROP thing, INVENTORY, GO north (or just N, S, E, W, U, D, OUT), USE thing, GIVE thing, TALK, MAP, HINT, SCORE, RESET. And one or two it won't admit to.", "sys");
            case "hint": case "hints": case "clue": return hint();
            case "map": return map();
            case "guestbook": case "book": case "scores": case "highscores": return guestbook();
            case "sign": return sign();
            case "score": return line("Your score is " + (S.inv.length + (S.flags.gate ? 1 : 0) + (S.flags.rfid ? 1 : 0) + (S.flags.traded ? 2 : 0)) + " of 8, in " + S.moves + " moves, with " + S.deaths + " death" + (S.deaths === 1 ? "" : "s") + ". This gives you the rank of Junior Integration Specialist.", "sys");
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
    form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var text = input.value.trim();
        input.value = "";
        if (!text || busy) return;
        you(text);
        var t = text.toLowerCase();
        if (S.stage === "dungeon" && t !== "reset") S.flags.resetting = 0;
        if (S.stage === "bot") {
            if (/xyzzy|plugh|wake up|elves|elf/.test(t)) return reveal(null);
            if (t === "reset") return reset();
            S.turns++;
            save();
            if (S.turns >= 3) return reveal(answer(text));
            return later(answer(text));
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
