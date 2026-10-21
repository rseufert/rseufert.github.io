// The arena page (arena/index.html): draws a match from arena/arena-engine.js
// on a canvas, keeps the score, shows the selected tank's registers, and
// draws what the engine does not keep (trails, flashes, the feed), and
// runs the editor: assemble the visitor's tank, fight the ticked presets
// and the tanks sent in, save to named slots in localStorage (and the last
// edit, always), export and import a file, share by link (#r=, the
// program; #preset=, one of the presets; #sent=, one sent in), load one to
// read, and send yours in through the gauntlet (arena/arena-gauntlet.js).
(function () {
    "use strict";
    var A = window.Arena, R = window.ArenaRobots, G = window.ArenaGauntlet;
    var canvas = document.getElementById("arena-canvas"), ctx = canvas.getContext("2d");
    var $ = function (id) { return document.getElementById(id); };
    var scoreEl = $("arena-score"), statusEl = $("arena-status"), debugEl = $("arena-debug"), rosterEl = $("arena-roster");
    var source = $("arena-source"), gutter = $("arena-gutter"), errorsEl = $("arena-errors");
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var COLORS = ["#00e5ff", "#ff0050", "#ffd400", "#7cff5a", "#ff8c1a", "#c77dff"];
    var match = null, playing = false, raf = 0, selected = 0, flash = 0;

    // ---- the roster -------------------------------------------------------
    var picked = {}, programs = {}, order = [];
    function enlist(key, text, about, on, hash, listEl, meta, link) {
        programs[key] = text; order.push(key); picked[key] = on;
        var li = document.createElement("li");
        var box = document.createElement("input");
        box.type = "checkbox"; box.checked = on; box.id = "arena-pick-" + key;
        box.addEventListener("change", function () { picked[key] = box.checked; });
        var label = document.createElement("label");
        label.htmlFor = box.id;
        label.textContent = " " + key.toUpperCase() + " ";
        var aboutEl = document.createElement("span");
        aboutEl.className = "about";
        aboutEl.textContent = about;
        li.appendChild(box); li.appendChild(label);
        if (meta) { var m = document.createElement("span"); m.className = "meta"; m.textContent = meta; li.appendChild(m); }
        li.appendChild(aboutEl);
        var read = document.createElement("a");
        read.href = hash; read.textContent = "read";
        read.addEventListener("click", function (ev) { ev.preventDefault(); load(text); history.replaceState(null, "", hash); source.focus(); });
        li.appendChild(document.createTextNode(" ")); li.appendChild(read);
        if (link) { var a = document.createElement("a"); a.href = link; a.textContent = "issue"; a.rel = "noopener"; li.appendChild(document.createTextNode(" \u00b7 ")); li.appendChild(a); }
        listEl.appendChild(li);
    }
    // A tank's description is the comment block at the top of its program.
    function preamble(text) {
        var out = [];
        text.split("\n").forEach(function (l) { if (l.charAt(0) === ";") out.push(l.replace(/^;\s*/, "")); });
        return out.join(" ");
    }
    R.groups.forEach(function (g) {
        var h = document.createElement("h3"), p = document.createElement("p"), ul = document.createElement("ul");
        h.textContent = g.name; p.className = "lede"; p.textContent = g.about;
        rosterEl.appendChild(h); rosterEl.appendChild(p); rosterEl.appendChild(ul);
        g.tanks.forEach(function (n) { enlist(n, R.robots[n], preamble(R.robots[n]), order.length < 3, "#preset=" + n, ul); });
    });

    // The ones sent in: open issues on the repo titled "tank:", each refought
    // through the gauntlet by a workflow and listed in tanks.json on the
    // sky-data branch (tools/tanks.py); the copy on master is the fallback.
    var sentEl = $("arena-sent"), wantSent = null;
    function sent(list) {
        sentEl.innerHTML = "";
        var good = list.filter(function (t) {
            return t && typeof t.name === "string" && G.NAME.test(t.name) && typeof t.source === "string" && t.source.length <= G.MAX_SOURCE && !R.robots[t.name.toLowerCase()];
        });
        if (!good.length) {
            var li = document.createElement("li"); li.className = "none";
            li.textContent = "nobody's yet. the bar is " + G.BAR + " of " + R.order.length * G.SEEDS.length + ".";
            sentEl.appendChild(li);
            return;
        }
        good.forEach(function (t) {
            var key = t.name.toLowerCase();
            if (programs[key]) return;
            enlist(key, t.source, preamble(t.source), false, "#sent=" + key, sentEl, t.wins + " of " + t.of + ", by " + String(t.by || "?").slice(0, 40), /^https:\/\/github\.com\//.test(t.url || "") ? t.url : null);
            if (wantSent === key) { load(t.source); wantSent = null; }
        });
    }
    function fetchSent() {
        fetch("https://raw.githubusercontent.com/rseufert/rseufert.github.io/sky-data/tanks.json", { cache: "no-cache" })
            .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
            .catch(function () { return fetch("/data/tanks.json").then(function (r) { return r.json(); }); })
            .then(function (j) { sent((j && j.tanks) || []); }, function () { sentEl.textContent = "couldn't load them just now."; });
    }
    fetchSent();

    // ---- the editor -------------------------------------------------------
    function lines() {
        var n = source.value.split("\n").length, out = [];
        for (var i = 1; i <= n; i++) out.push(i);
        gutter.textContent = out.join("\n");
    }
    function load(text) { source.value = text; lines(); errorsEl.textContent = ""; }
    var autosave = 0;
    source.addEventListener("input", function () { lines(); clearTimeout(autosave); autosave = setTimeout(function () { store(AUTOSAVE, source.value); }, 400); });
    source.addEventListener("scroll", function () { gutter.scrollTop = source.scrollTop; });
    source.addEventListener("keydown", function (ev) {
        if (ev.key === "Tab") {   // two spaces, as the presets have it
            ev.preventDefault();
            var s = source.selectionStart, e = source.selectionEnd;
            source.value = source.value.slice(0, s) + "  " + source.value.slice(e);
            source.selectionStart = source.selectionEnd = s + 2;
            lines();
        }
    });
    var AUTOSAVE = "arena-robot", SLOTS = "arena-tanks";
    function fetchStore(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function store(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
    function programName() { var m = /^#name\s+(\S+)/mi.exec(source.value); return m ? m[1].toUpperCase() : ""; }
    // Named slots, in this browser. The last edit is kept too, under AUTOSAVE.
    var slotsEl = $("arena-slots");
    function slots() { try { return JSON.parse(fetchStore(SLOTS)) || {}; } catch (e) { return {}; } }
    function listSlots() {
        var s = slots(), names = Object.keys(s).sort();
        slotsEl.innerHTML = "";
        var head = document.createElement("option");
        head.value = ""; head.textContent = names.length ? "saved tanks (" + names.length + ")" : "no saved tanks";
        slotsEl.appendChild(head);
        names.forEach(function (n) { var o = document.createElement("option"); o.value = n; o.textContent = n; slotsEl.appendChild(o); });
        $("arena-delete").disabled = !names.length;
    }
    $("arena-save").addEventListener("click", function () {
        var name = prompt("save as", slotsEl.value || programName() || "MY-TANK");
        if (name === null) return;
        name = name.trim().slice(0, 24);
        if (!name) return;
        var s = slots(); s[name] = source.value;
        if (store(SLOTS, JSON.stringify(s))) { listSlots(); slotsEl.value = name; statusEl.textContent = "saved as " + name + ", in this browser."; }
        else statusEl.textContent = "no storage to save to; export a file, or use the share link.";
    });
    slotsEl.addEventListener("change", function () {
        var s = slots();
        if (!slotsEl.value || s[slotsEl.value] === undefined) return;
        load(s[slotsEl.value]); history.replaceState(null, "", location.pathname);
        statusEl.textContent = slotsEl.value + " loaded.";
    });
    $("arena-delete").addEventListener("click", function () {
        var n = slotsEl.value;
        if (!n) { statusEl.textContent = "pick a saved tank first."; return; }
        if (!confirm("delete " + n + "?")) return;
        var s = slots(); delete s[n]; store(SLOTS, JSON.stringify(s)); listSlots();
        statusEl.textContent = n + " deleted.";
    });
    listSlots();
    // A file, to keep or to pass around.
    $("arena-export").addEventListener("click", function () {
        var name = (programName() || "tank").toLowerCase() + ".txt";
        var a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([source.value], { type: "text/plain" })); a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        statusEl.textContent = name + " is on its way to your downloads.";
    });
    var fileEl = $("arena-file");
    $("arena-import").addEventListener("click", function () { fileEl.click(); });
    fileEl.addEventListener("change", function () {
        var f = fileEl.files[0];
        if (!f) return;
        if (f.size > 64000) { statusEl.textContent = "that file is too big to be a tank."; fileEl.value = ""; return; }
        var rd = new FileReader();
        rd.onload = function () { load(String(rd.result)); history.replaceState(null, "", location.pathname); statusEl.textContent = f.name + " loaded."; };
        rd.readAsText(f);
        fileEl.value = "";
    });
    $("arena-share").addEventListener("click", function () {
        var hash = "#r=" + btoa(unescape(encodeURIComponent(source.value)));
        history.replaceState(null, "", hash);
        var url = location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(function () { statusEl.textContent = "link copied: it carries your tank."; }, function () { statusEl.textContent = "the link in the address bar carries your tank."; });
        } else statusEl.textContent = "the link in the address bar carries your tank.";
    });
    $("arena-starter").addEventListener("click", function () { load(R.starter); history.replaceState(null, "", location.pathname); });
    // Sending it in: the gauntlet here first, a duel a turn so the page keeps
    // up; if it passes, a link to a prefilled issue, which the workflow
    // refights before listing.
    var running = null;
    $("arena-send").addEventListener("click", function () {
        if (running) return;
        var g = G.start(source.value);
        if (g.over) { errorsEl.textContent = g.errors.join("\n"); statusEl.textContent = "it can't go in yet. see below."; return; }
        errorsEl.textContent = "";
        running = g;
        $("arena-send").disabled = true;
        (function turn() {
            g.step();
            statusEl.textContent = "the gauntlet: " + g.done + " of " + g.total + " duels, " + g.wins + " won.";
            if (!g.over) { setTimeout(turn, 0); return; }
            running = null;
            $("arena-send").disabled = false;
            if (g.ok) offer(g);
            else statusEl.textContent = g.name + " won " + g.wins + " of " + g.total + (g.faults.length ? ", and faulted (" + g.faults[0] + ")" : "") + ". it needs " + G.BAR + " without a fault to be listed.";
        })();
    });
    function offer(g) {
        var body = "record: " + g.wins + " of " + g.total + " duels against the presets, seeds " + G.SEEDS[0] + " to " + G.SEEDS[G.SEEDS.length - 1] + "\n\n```asm\n" + source.value.replace(/```/g, "'''") + "\n```\n\nSent from rickseufert.com/arena/. Keep the program in the code block as it is; a workflow refights it through the gauntlet and lists it among the tanks sent in if it wins " + G.BAR + " without a fault. Closing the issue takes it out.";
        var title = "tank: " + g.name;
        var full = "https://github.com/rseufert/rseufert.github.io/issues/new?title=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(body);
        var short = full.length > 7000;      // too long for an address: the body goes by the clipboard
        statusEl.textContent = g.name + " won " + g.wins + " of " + g.total + ". it qualifies: ";
        var a = document.createElement("a");
        a.href = short ? "https://github.com/rseufert/rseufert.github.io/issues/new?title=" + encodeURIComponent(title) : full;
        a.target = "_blank"; a.rel = "noopener";
        a.textContent = short ? "open the issue and paste (the body is copied as you click)" : "send it in as an issue on github";
        if (short) a.addEventListener("click", function () { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(body); });
        statusEl.appendChild(a);
        statusEl.appendChild(document.createTextNode(". a workflow refights it and lists it, under your github name."));
    }
    function recall() {
        var m = /[#&]r=([A-Za-z0-9+/=]+)/.exec(location.hash);
        if (m) { try { load(decodeURIComponent(escape(atob(m[1])))); return; } catch (e) { /* not ours */ } }
        var p = /[#&]preset=(\w+)/.exec(location.hash);
        if (p && R.robots[p[1]]) { load(R.robots[p[1]]); return; }
        var w = /[#&]sent=([\w-]+)/.exec(location.hash);
        if (w) wantSent = w[1].toLowerCase();          // loaded once the list arrives
        load(fetchStore(AUTOSAVE) || R.starter);
    }

    // ---- the match --------------------------------------------------------
    function start() {
        var asm = A.assemble(source.value);
        if (asm.errors.length) {
            errorsEl.textContent = asm.errors.slice(0, 6).join("\n");
            statusEl.textContent = "it doesn't assemble. see below.";
            return;
        }
        errorsEl.textContent = "";
        var entries = [{ source: source.value, name: asm.name || "YOURS" }];
        order.forEach(function (n) { if (picked[n]) entries.push({ source: programs[n] }); });
        if (entries.length < 2) { statusEl.textContent = "pick at least one opponent."; return; }
        var seed = parseInt($("arena-seed").value, 10) || 1;
        try { match = new A.Match(entries, { seed: seed }); } catch (e) { statusEl.textContent = String(e.message); return; }
        fought = { entries: entries, seed: seed };
        arm(match);
        selected = 0;
        slow = 0; after = 0; frames = 0;
        scrub.max = 0; scrub.value = 0;
        statusEl.textContent = "fight.";
        play(true);
    }
    var fought = null, slow = 0, after = 0, frames = 0, scrubbing = false;
    // The scrubber: a seeded match is the same every time, so any tick can
    // be had again by fighting it over from the start, which takes no time.
    var scrub = $("arena-scrub");
    function rebuild(tick) {
        if (!fought) return;
        playing = false; $("arena-pause").textContent = "resume";
        match = new A.Match(fought.entries, { seed: fought.seed });
        arm(match);
        scrubbing = true;
        for (var i = 0; i < tick && !match.over; i++) step();
        scrubbing = false;
        FX.feed.forEach(function (f, n) { f.t = n < FX.feed.length - 1 ? 250 : 0; });
        slow = 0; after = match.over ? 90 : 0;
        draw();
    }
    scrub.addEventListener("input", function () { rebuild(parseInt(scrub.value, 10) || 0); });
    function play(on) {
        playing = on;
        $("arena-pause").textContent = on ? "pause" : "resume";
        if (on && !raf) raf = requestAnimationFrame(frame);
        if (!on) draw();
    }
    function frame() {
        raf = 0;
        if (!match) return;
        frames++;
        var n = parseInt($("arena-speed").value, 10) || 1;
        if (playing && !match.over) {
            if (slow > 0) { slow--; if (frames % 4 === 0) step(); }     // a kill, slowly
            else for (var i = 0; i < n && !match.over; i++) step();
            scrub.max = match.tick; scrub.value = match.tick;
        }
        draw();
        if (match.over) {
            if (playing) {
                playing = false;
                $("arena-pause").textContent = "resume";
                statusEl.textContent = match.winner ? match.winner.name + " wins, after " + Math.round(match.tick / 60) + " seconds." : "nobody wins. everybody burned.";
                after = 120;
            }
            if (after > 0) { after--; raf = requestAnimationFrame(frame); }
            return;
        }
        if (playing) raf = requestAnimationFrame(frame);
    }
    $("arena-fight").addEventListener("click", start);
    $("arena-assemble").addEventListener("click", function () { start(); canvas.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "nearest" }); });
    $("arena-pause").addEventListener("click", function () { if (match && !match.over) play(!playing); });
    $("arena-step").addEventListener("click", function () { if (match && !match.over) { playing = false; $("arena-pause").textContent = "resume"; step(); draw(); } });

    // ---- effects: what the engine does not keep but the eye wants -------------
    // Trails, muzzle flashes, hit flashes and shakes, floating damage, sparks
    // off the walls, a feed of what the engine logged. Recorded as the match
    // steps (step), aged as frames are drawn (draw), so they look the same at
    // any speed.
    var FX = null;
    function arm(m) {
        FX = { trails: [], muzzle: [], flash: [], floats: [], sparks: [], debris: [], scorch: [], walls: [], feed: [], logSeen: 0, shots: [], winner: 0 };
        m.robots.forEach(function (r) { FX.trails.push([]); FX.muzzle.push(0); FX.flash.push(0); FX.shots.push(0); });
        var hurt = m.hurt.bind(m);
        m.hurt = function (r, amount, by, how) {
            var before = r.armor;
            hurt(r, amount, by, how);
            if (scrubbing) { if (before > 0 && r.armor <= 0) FX.scorch.push({ x: r.x, y: r.y }); return; }
            var lost = Math.round(before - Math.max(0, r.armor));
            if (lost > 0 && how !== "wore out") FX.floats.push({ x: r.x, y: r.y - 30, text: "-" + lost, c: how === "burned up" ? "#ff5a2e" : "#ffffff", t: 0 });
            if (how === "shot" || how === "rammed") { FX.flash[r.id] = 8; sound(how === "shot" ? "hit" : "ram"); }
            if (how === "drove into a wall") { sparks(r.x, r.y, 14, "#ffd27a"); FX.walls.push({ x: r.x, y: r.y, t: 0 }); sound("wall"); }
            if (how === "rammed") sparks(r.x, r.y, 4, "#ffffff");
            if (before > 0 && r.armor <= 0) die(r);
        };
    }
    // A death: debris, a scorch mark that stays, a moment of slow motion.
    function die(r) {
        var c = COLORS[r.id % COLORS.length];
        FX.scorch.push({ x: r.x, y: r.y });
        for (var i = 0; i < 14; i++) {
            var a = Math.random() * 2 * Math.PI, v = 1.5 + Math.random() * 6;
            FX.debris.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, rot: Math.random() * 6.3, spin: (Math.random() - 0.5) * 0.5, w: 4 + Math.random() * 10, h: 3 + Math.random() * 5, c: i % 3 ? c : "#55555f", t: 0, life: 40 + Math.random() * 50 });
        }
        sparks(r.x, r.y, 24, "#ffd27a");
        if (match.alive().length > 1) slow = 70;
        sound("kill");
    }
    function sparks(x, y, n, c) {
        for (var i = 0; i < n; i++) {
            var a = Math.random() * 2 * Math.PI, v = 2 + Math.random() * 5;
            FX.sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: c, t: 0, life: 10 + Math.random() * 12 });
        }
    }
    // One engine tick, with the effects it leaves recorded.
    function step() {
        match.update();
        match.robots.forEach(function (r, i) {
            if (r.alive) { var tr = FX.trails[i]; tr.push(r.x, r.y); if (tr.length > 240) tr.splice(0, 2); }
            if (r.shots > FX.shots[i]) { FX.shots[i] = r.shots; if (!scrubbing) { FX.muzzle[i] = 5; sound("shot"); } }
        });
        while (FX.logSeen < match.log.length) FX.feed.push({ text: match.log[FX.logSeen++].replace(/^tick \d+: /, ""), t: 0 });
    }
    // Age the frame-timed effects by one drawn frame.
    function age() {
        var i;
        for (i = 0; i < FX.muzzle.length; i++) { if (FX.muzzle[i] > 0) FX.muzzle[i]--; if (FX.flash[i] > 0) FX.flash[i]--; }
        FX.floats.forEach(function (f) { f.t++; f.y -= 0.9; });
        FX.floats = FX.floats.filter(function (f) { return f.t < 50; });
        FX.sparks.forEach(function (p) { p.t++; p.x += p.vx; p.y += p.vy; p.vx *= 0.88; p.vy *= 0.88; });
        FX.sparks = FX.sparks.filter(function (p) { return p.t < p.life; });
        FX.feed.forEach(function (f) { f.t++; });
        FX.feed = FX.feed.filter(function (f) { return f.t < 360; });
        if (FX.feed.length > 5) FX.feed.splice(0, FX.feed.length - 5);
        FX.debris.forEach(function (d) { d.t++; d.x += d.vx; d.y += d.vy; d.vx *= 0.93; d.vy *= 0.93; d.rot += d.spin; d.spin *= 0.95; });
        FX.debris = FX.debris.filter(function (d) { return d.t < d.life; });
        FX.walls.forEach(function (w) { w.t++; });
        FX.walls = FX.walls.filter(function (w) { return w.t < 30; });
        if (match.over) FX.winner++;
        budget = 3;
    }

    // ---- sound, behind a toggle: shots, hits, walls, kills, the heat ----
    var audio = null, budget = 3, soundOn = false;
    try { soundOn = localStorage.getItem("arena-sound") === "1"; } catch (e) { soundOn = false; }
    var soundButton = $("arena-sound");
    soundButton.setAttribute("aria-pressed", soundOn ? "true" : "false");
    soundButton.addEventListener("click", function () {
        soundOn = !soundOn;
        soundButton.setAttribute("aria-pressed", soundOn ? "true" : "false");
        try { localStorage.setItem("arena-sound", soundOn ? "1" : "0"); } catch (e) { /* no storage */ }
        if (soundOn && !audio) audio = makeAudio();
        if (audio && audio.ac.state === "suspended") audio.ac.resume();
    });
    function makeAudio() {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        var ac = new AC(), master = ac.createGain();
        if (window.Unmute) Unmute(ac);
        master.gain.value = 0.5; master.connect(ac.destination);
        var noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), data = noise.getChannelData(0);
        for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        function burst(len, gain, freq, type) {
            var s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
            s.buffer = noise; f.type = type || "lowpass"; f.frequency.value = freq;
            g.gain.setValueAtTime(gain, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + len);
            s.connect(f); f.connect(g); g.connect(master); s.start(); s.stop(ac.currentTime + len);
        }
        function tone(type, from, to, len, gain) {
            var o = ac.createOscillator(), g = ac.createGain();
            o.type = type; o.frequency.setValueAtTime(from, ac.currentTime); o.frequency.exponentialRampToValueAtTime(to, ac.currentTime + len);
            g.gain.setValueAtTime(gain, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + len);
            o.connect(g); g.connect(master); o.start(); o.stop(ac.currentTime + len + 0.05);
        }
        // the heat: a whine that rises with the selected tank's heat
        var whine = ac.createOscillator(), wg = ac.createGain();
        whine.type = "sine"; whine.frequency.value = 400; wg.gain.value = 0; whine.connect(wg); wg.connect(master); whine.start();
        return {
            ac: ac,
            shot: function () { burst(0.08, 0.35, 1800, "highpass"); tone("square", 220, 90, 0.06, 0.08); },
            hit: function () { burst(0.12, 0.3, 500); tone("sine", 140, 60, 0.12, 0.25); },
            ram: function () { burst(0.06, 0.15, 900, "bandpass"); },
            wall: function () { burst(0.15, 0.3, 2500, "bandpass"); tone("triangle", 800, 200, 0.12, 0.1); },
            kill: function () { burst(0.7, 0.8, 400); tone("sawtooth", 160, 30, 0.6, 0.3); },
            heat: function (h) { wg.gain.setTargetAtTime(h > 150 ? Math.min(0.06, (h - 150) / 4000) : 0, ac.currentTime, 0.1); whine.frequency.setTargetAtTime(300 + h * 2.5, ac.currentTime, 0.1); }
        };
    }
    function sound(kind) {
        if (!soundOn || !audio || scrubbing || budget <= 0) return;
        budget--;
        audio[kind]();
    }

    // ---- drawing ----------------------------------------------------------
    function fit() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * dpr);
        if (canvas.width !== w) { canvas.width = w; canvas.height = w; scan = null; }
    }
    var MONO = "Menlo, Consolas, monospace";
    // The camera: the whole field, the selected tank, or whatever is left
    // of the fight, framed. It eases toward where it is going.
    var cam = { x: 500, y: 500, z: 1 }, cameraEl = $("arena-camera"), scan = null;
    function aim() {
        var want = { x: 500, y: 500, z: 1 }, mode = cameraEl.value;
        if (match && mode === "follow") {
            var r = match.robots[selected];
            if (r && r.alive) want = { x: r.x, y: r.y, z: 2.4 };
        } else if (match && mode === "frame") {
            var alive = match.alive(), x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
            alive.forEach(function (r) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x); y1 = Math.max(y1, r.y); });
            if (alive.length) {
                var w = Math.max(x1 - x0, y1 - y0) + 320;
                want = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: Math.max(1, Math.min(2.6, 1000 / w)) };
            }
        }
        var e = still ? 1 : 0.08;
        cam.x += (want.x - cam.x) * e; cam.y += (want.y - cam.y) * e; cam.z += (want.z - cam.z) * e;
    }
    function world(ctx2, k) { ctx2.setTransform(k * cam.z, 0, 0, k * cam.z, k * (500 - cam.z * cam.x), k * (500 - cam.z * cam.y)); }
    function toScreen(x, y, k) { return { x: k * (500 + cam.z * (x - cam.x)), y: k * (500 + cam.z * (y - cam.y)) }; }
    function draw() {
        fit();
        var k = canvas.width / A.SIZE, dpr = canvas.width / canvas.clientWidth, W = canvas.width;
        aim();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#060608";
        ctx.fillRect(0, 0, W, W);
        world(ctx, k);
        // the field
        ctx.fillStyle = "#0b0b10";
        ctx.fillRect(0, 0, A.SIZE, A.SIZE);
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1 / (k * cam.z);
        for (var g = 100; g < A.SIZE; g += 100) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, A.SIZE); ctx.moveTo(0, g); ctx.lineTo(A.SIZE, g); ctx.stroke(); }
        ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 3;
        ctx.strokeRect(1.5, 1.5, A.SIZE - 3, A.SIZE - 3);
        if (!match) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            ctx.font = "22px " + MONO;
            ctx.textAlign = "center";
            ctx.fillText("the arena", W / dpr / 2, W / dpr / 2 - 8);
            ctx.font = "13px " + MONO;
            ctx.fillText("1000 × 1000. walls hurt.", W / dpr / 2, W / dpr / 2 + 16);
            score();
            return;
        }
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        // the walls lit where they were hit
        FX.walls.forEach(function (w) {
            var a = 1 - w.t / 30, len = 90;
            ctx.strokeStyle = "rgba(255, 210, 120, " + (0.8 * a) + ")"; ctx.lineWidth = 6;
            ctx.beginPath();
            if (w.x < 40) { ctx.moveTo(2, w.y - len); ctx.lineTo(2, w.y + len); }
            else if (w.x > A.SIZE - 40) { ctx.moveTo(A.SIZE - 2, w.y - len); ctx.lineTo(A.SIZE - 2, w.y + len); }
            else if (w.y < 40) { ctx.moveTo(w.x - len, 2); ctx.lineTo(w.x + len, 2); }
            else { ctx.moveTo(w.x - len, A.SIZE - 2); ctx.lineTo(w.x + len, A.SIZE - 2); }
            ctx.stroke();
        });
        // what burned
        FX.scorch.forEach(function (m) {
            var grad = ctx.createRadialGradient(m.x, m.y, 4, m.x, m.y, 48);
            grad.addColorStop(0, "rgba(0,0,0,0.85)"); grad.addColorStop(0.6, "rgba(20,12,8,0.5)"); grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(m.x, m.y, 48, 0, 2 * Math.PI); ctx.fill();
        });
        // where each has been
        match.robots.forEach(function (r, i) {
            var tr = FX.trails[i], c = COLORS[i % COLORS.length], n = tr.length / 2;
            if (n < 2) return;
            ctx.lineWidth = 3;
            for (var p = 1; p < n; p += 4) {
                var q = Math.min(n - 1, p + 4), a = (p / n) * (r.alive ? 0.45 : 0.2);
                ctx.strokeStyle = hex(c, a);
                ctx.beginPath(); ctx.moveTo(tr[2 * (p - 1)], tr[2 * (p - 1) + 1]);
                for (var m = p; m <= q; m++) ctx.lineTo(tr[2 * m], tr[2 * m + 1]);
                ctx.stroke();
            }
        });
        // what each can see
        match.robots.forEach(function (r, i) {
            var c = COLORS[i % COLORS.length];
            if (r.alive && r.lastScan && r.scanAge < 16) {
                var s = r.lastScan, a0 = (s.heading - s.arc) * Math.PI / 180, a1 = (s.heading + s.arc) * Math.PI / 180, fade = 1 - r.scanAge / 16;
                ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.arc(r.x, r.y, Math.min(s.range, 1500), a0, a1); ctx.closePath();
                ctx.fillStyle = hex(c, (s.hit ? 0.2 : 0.05) * fade); ctx.fill();
                if (s.hit) { ctx.strokeStyle = hex(c, 0.45 * fade); ctx.lineWidth = 1.5; ctx.stroke(); }
            }
        });
        // the tanks, and the wrecks
        match.robots.forEach(function (r, i) {
            var c = COLORS[i % COLORS.length], flash = FX.flash[i] > 0;
            var x = r.x + (flash ? (Math.random() - 0.5) * 7 : 0), y = r.y + (flash ? (Math.random() - 0.5) * 7 : 0);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(r.heading * Math.PI / 180);
            if (!r.alive) {                                    // a wreck: the hull broken in two, dark
                ctx.fillStyle = "#2c2c33";
                ctx.rotate(0.25); ctx.fillRect(-17, -12, 16, 24);
                ctx.rotate(-0.6); ctx.fillRect(3, -11, 14, 22);
                ctx.fillStyle = "#1a1a1f"; ctx.fillRect(-17, -12, 16, 4); ctx.fillRect(3, 7, 14, 4);
                ctx.restore();
                ctx.fillStyle = "#55555f"; ctx.font = "15px " + MONO; ctx.textAlign = "center";
                ctx.fillText(r.name, x, y - 32);
                return;
            }
            var hull = flash ? "#ffffff" : warm(c, r.heat / 475);
            if (r.down) hull = hex(c, 0.45);
            ctx.fillStyle = hull;
            ctx.fillRect(-17, -12, 34, 24);                   // the hull
            ctx.fillStyle = "#0b0b10";
            ctx.fillRect(-17, -12, 34, 4); ctx.fillRect(-17, 8, 34, 4);   // tracks
            ctx.restore();
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate((r.heading + r.turret) * Math.PI / 180);
            ctx.strokeStyle = r.down ? hex(c, 0.5) : "#ffffff"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(28, 0); ctx.stroke();
            if (FX.muzzle[i] > 0) {                            // the flash at the barrel
                var fl = FX.muzzle[i] / 5;
                ctx.fillStyle = "rgba(255, 240, 180, " + (0.9 * fl) + ")";
                ctx.beginPath(); ctx.arc(30, 0, 6 + 10 * (1 - fl), 0, 2 * Math.PI); ctx.fill();
            }
            ctx.restore();
            // armor, as an arc; heat warms the hull
            ctx.lineWidth = 3;
            ctx.strokeStyle = "rgba(255,255,255,0.12)";
            ctx.beginPath(); ctx.arc(x, y, 25, 0, 2 * Math.PI); ctx.stroke();
            ctx.strokeStyle = r.armor > 30 ? hex(c, 0.9) : "#ff0050";
            ctx.beginPath(); ctx.arc(x, y, 25, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * Math.max(0, r.armor) / 100); ctx.stroke();
            ctx.fillStyle = hex(c, 0.9);
            ctx.font = "15px " + MONO;
            ctx.textAlign = "center";
            ctx.fillText(r.name, x, y - 32);
            if (r.down) { ctx.fillStyle = "#ff0050"; ctx.font = "11px " + MONO; ctx.fillText("overheated", x, y + 42); }
            if (i === selected) { ctx.strokeStyle = hex(c, 0.5); ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(x, y, 34, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]); }
        });
        // missiles: a streak with a hot head
        match.missiles.forEach(function (m) {
            var c = COLORS[m.owner % COLORS.length], dx = Math.cos(m.h * Math.PI / 180), dy = Math.sin(m.h * Math.PI / 180);
            var grad = ctx.createLinearGradient(m.x - dx * 70, m.y - dy * 70, m.x, m.y);
            grad.addColorStop(0, hex(c, 0)); grad.addColorStop(1, hex(c, 0.9));
            ctx.strokeStyle = grad; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.moveTo(m.x - dx * 70, m.y - dy * 70); ctx.lineTo(m.x, m.y); ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.beginPath(); ctx.arc(m.x, m.y, 3.5, 0, 2 * Math.PI); ctx.fill();
        });
        match.bursts.forEach(function (b) {
            var t = b.t / 18;
            ctx.strokeStyle = "rgba(255, 200, 80, " + (1 - t) + ")"; ctx.lineWidth = b.size > 20 ? 4 : 2;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.size * (0.3 + t), 0, 2 * Math.PI); ctx.stroke();
            if (b.size > 20) { ctx.fillStyle = "rgba(255, 120, 40, " + (0.5 * (1 - t)) + ")"; ctx.beginPath(); ctx.arc(b.x, b.y, b.size * t * 1.6, 0, 2 * Math.PI); ctx.fill(); }
        });
        FX.debris.forEach(function (d) {
            ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot);
            ctx.globalAlpha = 1 - d.t / d.life; ctx.fillStyle = d.c; ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
            ctx.restore();
        });
        FX.sparks.forEach(function (p) {
            ctx.strokeStyle = p.c; ctx.globalAlpha = 1 - p.t / p.life; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2); ctx.stroke();
        });
        ctx.globalAlpha = 1;
        // ---- the overlay, in screen pixels ----
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        var S = W / dpr;
        ctx.font = "bold 13px " + MONO; ctx.textAlign = "center";
        FX.floats.forEach(function (f) {
            var p = toScreen(f.x, f.y, k / dpr);
            ctx.globalAlpha = f.t < 35 ? 1 : 1 - (f.t - 35) / 15;
            ctx.fillStyle = f.c; ctx.fillText(f.text, p.x, p.y);
        });
        ctx.globalAlpha = 1;
        // a vignette, and the lines of an old screen
        var vg = ctx.createRadialGradient(S / 2, S / 2, S * 0.45, S / 2, S / 2, S * 0.78);
        vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.55)");
        ctx.fillStyle = vg; ctx.fillRect(0, 0, S, S);
        if (!scan) {
            var sc = document.createElement("canvas"); sc.width = 1; sc.height = 3;
            var c2 = sc.getContext("2d"); c2.fillStyle = "rgba(0,0,0,0.18)"; c2.fillRect(0, 2, 1, 1);
            scan = ctx.createPattern(sc, "repeat");
        }
        ctx.fillStyle = scan; ctx.fillRect(0, 0, S, S);
        if (slow > 0) { ctx.fillStyle = "rgba(255,255,255," + (0.05 * slow / 70) + ")"; ctx.fillRect(0, 0, S, S); }
        // the feed, and the clock
        ctx.font = "11px " + MONO; ctx.textAlign = "left";
        FX.feed.forEach(function (f, n) {
            ctx.fillStyle = "rgba(255,255,255," + (f.t < 300 ? 0.75 : 0.75 * (1 - (f.t - 300) / 60)) + ")";
            ctx.fillText(f.text, 10, 18 + n * 15);
        });
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "10px " + MONO;
        ctx.fillText("tick " + match.tick + "  seed " + match.seed + (slow > 0 ? "  slow" : ""), 8, S - 8);
        if (match.over) {                                      // the winner, large, and the rest in the dark
            var w = Math.min(1, FX.winner / 25);
            ctx.fillStyle = "rgba(0,0,0," + (0.45 * w) + ")"; ctx.fillRect(0, 0, S, S);
            ctx.textAlign = "center"; ctx.globalAlpha = w;
            if (match.winner) {
                ctx.fillStyle = COLORS[match.winner.id % COLORS.length]; ctx.font = "bold " + Math.round(S / 9) + "px " + MONO;
                ctx.fillText(match.winner.name, S / 2, S / 2 + S / 40);
                ctx.fillStyle = "#ffffff"; ctx.font = "13px " + MONO;
                ctx.fillText("wins, after " + Math.round(match.tick / 60) + " seconds", S / 2, S / 2 + S / 12);
            } else {
                ctx.fillStyle = "#ffffff"; ctx.font = "bold " + Math.round(S / 14) + "px " + MONO;
                ctx.fillText("nobody", S / 2, S / 2);
            }
            ctx.globalAlpha = 1;
        }
        if (audio && soundOn) { var sel = match.robots[selected]; audio.heat(sel && sel.alive ? sel.heat : 0); }
        age();
        score();
        debug();
    }
    // A colour warmed toward red by t (0..1): the hull as the heat climbs.
    function warm(c, t) {
        t = Math.max(0, Math.min(1, t));
        var r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
        return "rgb(" + Math.round(r + (255 - r) * t) + "," + Math.round(g * (1 - t) + 40 * t) + "," + Math.round(b * (1 - t) + 30 * t) + ")";
    }
    function hex(c, a) {
        return "rgba(" + parseInt(c.slice(1, 3), 16) + "," + parseInt(c.slice(3, 5), 16) + "," + parseInt(c.slice(5, 7), 16) + "," + a + ")";
    }
    function score() {
        if (!match) { scoreEl.innerHTML = ""; return; }
        if (scoreEl.childNodes.length !== match.robots.length) {
            scoreEl.innerHTML = "";
            match.robots.forEach(function (r, i) {
                var li = document.createElement("li");
                li.innerHTML = '<button type="button" class="pick"><span class="swatch"></span><span class="name"></span></button>' +
                    '<span class="bar armor"><span></span></span><span class="bar heat"><span></span></span><span class="state"></span>';
                li.querySelector(".swatch").style.background = COLORS[i % COLORS.length];
                li.querySelector(".pick").addEventListener("click", function () { selected = i; draw(); });
                scoreEl.appendChild(li);
            });
        }
        match.robots.forEach(function (r, i) {
            var li = scoreEl.childNodes[i];
            li.className = (r.alive ? "" : "dead") + (i === selected ? " selected" : "");
            li.querySelector(".name").textContent = r.name;
            li.querySelector(".armor span").style.width = Math.max(0, r.armor) + "%";
            li.querySelector(".heat span").style.width = Math.min(100, r.heat / 5) + "%";
            li.querySelector(".state").textContent = !r.alive ? (r.killedBy ? r.killedBy : "dead") : r.down ? "overheated" : (r.kills ? r.kills + " kill" + (r.kills === 1 ? "" : "s") : "");
        });
    }
    function debug() {
        var r = match && match.robots[selected];
        if (!r) { debugEl.hidden = true; return; }
        debugEl.hidden = false;
        var ins = r.program[r.ip];
        debugEl.textContent =
            r.name + (r.alive ? "" : "  (destroyed)") + "\n" +
            "ax " + r.regs[0] + "  bx " + r.regs[1] + "  cx " + r.regs[2] + "  dx " + r.regs[3] + "  cmp " + r.cmpv + "\n" +
            "line " + (ins ? ins.line + "  " + ins.text : "-") + "\n" +
            "heading " + Math.round(r.heading) + "  turret +" + Math.round(r.turret) + "  arc " + r.arc + "  speed " + r.speed.toFixed(1) + "  throttle " + r.throttle + "\n" +
            "armor " + Math.round(r.armor) + "  heat " + Math.round(r.heat) + (r.overburn ? "  overburn" : "") + "  shots " + r.shots + "  x " + Math.round(r.x) + " y " + Math.round(r.y) +
            (r.errors.length ? "\nfaults: " + r.errors.slice(-2).join(" | ") : "");
    }
    canvas.addEventListener("click", function (ev) {
        if (!match) return;
        var rect = canvas.getBoundingClientRect(), sx = (ev.clientX - rect.left) / rect.width * A.SIZE, sy = (ev.clientY - rect.top) / rect.height * A.SIZE;
        var x = (sx - 500) / cam.z + cam.x, y = (sy - 500) / cam.z + cam.y;
        var best = 0, bestD = Infinity;
        match.robots.forEach(function (r, i) { var d = Math.hypot(r.x - x, r.y - y); if (d < bestD) { bestD = d; best = i; } });
        selected = best;
        draw();
    });
    window.addEventListener("resize", draw);
    cameraEl.addEventListener("change", draw);

    recall();
    draw();
    // For poking at from the console: the running match, and a redraw.
    window.ArenaPage = { match: function () { return match; }, draw: draw, step: step, start: start, select: function (i) { selected = i; draw(); } };
})();
