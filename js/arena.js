// The arena page (arena/index.html): draws a match from js/arena-engine.js
// on a canvas, keeps the score, shows the selected tank's registers, and
// runs the editor: assemble the visitor's tank, fight the ticked presets,
// save to localStorage, share by link (#r=, the program; #preset=, one of
// the presets), and load a preset to read.
(function () {
    "use strict";
    var A = window.Arena, R = window.ArenaRobots;
    var canvas = document.getElementById("arena-canvas"), ctx = canvas.getContext("2d");
    var $ = function (id) { return document.getElementById(id); };
    var scoreEl = $("arena-score"), statusEl = $("arena-status"), debugEl = $("arena-debug"), rosterEl = $("arena-roster");
    var source = $("arena-source"), gutter = $("arena-gutter"), errorsEl = $("arena-errors");
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var COLORS = ["#00e5ff", "#ff0050", "#ffd400", "#7cff5a", "#ff8c1a", "#c77dff"];
    var match = null, playing = false, raf = 0, selected = 0, flash = 0;

    // ---- the roster -------------------------------------------------------
    var picked = {};
    R.order.forEach(function (n, i) {
        picked[n] = i < 3;
        var li = document.createElement("li");
        var box = document.createElement("input");
        box.type = "checkbox"; box.checked = picked[n]; box.id = "arena-pick-" + n;
        box.addEventListener("change", function () { picked[n] = box.checked; });
        var label = document.createElement("label");
        label.htmlFor = box.id;
        label.textContent = " " + n.toUpperCase() + " ";
        var about = document.createElement("span");
        about.className = "about";
        // Its description is the comment block at the top of its program.
        var preamble = [];
        R.robots[n].split("\n").forEach(function (l) { if (l.charAt(0) === ";") preamble.push(l.replace(/^;\s*/, "")); });
        about.textContent = preamble.join(" ");
        var read = document.createElement("a");
        read.href = "#preset=" + n; read.textContent = "read";
        read.addEventListener("click", function (ev) { ev.preventDefault(); load(R.robots[n]); history.replaceState(null, "", "#preset=" + n); source.focus(); });
        li.appendChild(box); li.appendChild(label); li.appendChild(about); li.appendChild(document.createTextNode(" ")); li.appendChild(read);
        rosterEl.appendChild(li);
    });

    // ---- the editor -------------------------------------------------------
    function lines() {
        var n = source.value.split("\n").length, out = [];
        for (var i = 1; i <= n; i++) out.push(i);
        gutter.textContent = out.join("\n");
    }
    function load(text) { source.value = text; lines(); errorsEl.textContent = ""; }
    source.addEventListener("input", lines);
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
    function saved() { try { return localStorage.getItem("arena-robot"); } catch (e) { return null; } }
    $("arena-save").addEventListener("click", function () {
        try { localStorage.setItem("arena-robot", source.value); statusEl.textContent = "saved, in this browser."; } catch (e) { statusEl.textContent = "no storage to save to; use the share link."; }
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
    function recall() {
        var m = /[#&]r=([A-Za-z0-9+/=]+)/.exec(location.hash);
        if (m) { try { load(decodeURIComponent(escape(atob(m[1])))); return; } catch (e) { /* not ours */ } }
        var p = /[#&]preset=(\w+)/.exec(location.hash);
        if (p && R.robots[p[1]]) { load(R.robots[p[1]]); return; }
        load(saved() || R.starter);
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
        R.order.forEach(function (n) { if (picked[n]) entries.push({ source: R.robots[n] }); });
        if (entries.length < 2) { statusEl.textContent = "pick at least one opponent."; return; }
        var seed = parseInt($("arena-seed").value, 10) || 1;
        try { match = new A.Match(entries, { seed: seed }); } catch (e) { statusEl.textContent = String(e.message); return; }
        selected = 0;
        statusEl.textContent = "fight.";
        play(true);
    }
    function play(on) {
        playing = on;
        $("arena-pause").textContent = on ? "pause" : "resume";
        if (on && !raf) raf = requestAnimationFrame(frame);
        if (!on) draw();
    }
    function frame() {
        raf = 0;
        if (!match) return;
        var n = parseInt($("arena-speed").value, 10) || 1;
        if (playing) for (var i = 0; i < n && !match.over; i++) match.update();
        draw();
        if (match.over) {
            playing = false;
            $("arena-pause").textContent = "resume";
            statusEl.textContent = match.winner ? match.winner.name + " wins, after " + Math.round(match.tick / 60) + " seconds." : "nobody wins. everybody burned.";
            return;
        }
        if (playing) raf = requestAnimationFrame(frame);
    }
    $("arena-fight").addEventListener("click", start);
    $("arena-assemble").addEventListener("click", function () { start(); canvas.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "nearest" }); });
    $("arena-pause").addEventListener("click", function () { if (match && !match.over) play(!playing); });
    $("arena-step").addEventListener("click", function () { if (match && !match.over) { playing = false; $("arena-pause").textContent = "resume"; match.update(); draw(); } });

    // ---- drawing ----------------------------------------------------------
    function fit() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.round(canvas.clientWidth * dpr);
        if (canvas.width !== w) { canvas.width = w; canvas.height = w; }
    }
    function draw() {
        fit();
        var k = canvas.width / A.SIZE;
        ctx.setTransform(k, 0, 0, k, 0, 0);
        ctx.fillStyle = "#0b0b10";
        ctx.fillRect(0, 0, A.SIZE, A.SIZE);
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1 / k;
        for (var g = 100; g < A.SIZE; g += 100) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, A.SIZE); ctx.moveTo(0, g); ctx.lineTo(A.SIZE, g); ctx.stroke(); }
        if (!match) {
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            ctx.font = "28px Menlo, Consolas, monospace";
            ctx.textAlign = "center";
            ctx.fillText("the arena", A.SIZE / 2, A.SIZE / 2 - 10);
            ctx.font = "16px Menlo, Consolas, monospace";
            ctx.fillText("1000 × 1000. walls hurt.", A.SIZE / 2, A.SIZE / 2 + 22);
            score();
            return;
        }
        match.robots.forEach(function (r, i) {
            var c = COLORS[i % COLORS.length];
            // scan wedge
            if (r.alive && r.lastScan && r.scanAge < 2) {
                var s = r.lastScan, a0 = (s.heading - s.arc) * Math.PI / 180, a1 = (s.heading + s.arc) * Math.PI / 180;
                ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.arc(r.x, r.y, Math.min(s.range, 1500), a0, a1); ctx.closePath();
                ctx.fillStyle = s.hit ? hex(c, 0.28) : hex(c, 0.1); ctx.fill();
            }
            ctx.save();
            ctx.translate(r.x, r.y);
            ctx.rotate(r.heading * Math.PI / 180);
            ctx.fillStyle = r.alive ? (r.down ? hex(c, 0.45) : c) : "#3a3a44";
            ctx.fillRect(-17, -12, 34, 24);                   // the hull
            ctx.fillStyle = r.alive ? "#0b0b10" : "#222";
            ctx.fillRect(-17, -12, 34, 4); ctx.fillRect(-17, 8, 34, 4);   // tracks
            ctx.restore();
            if (r.alive) {
                ctx.save();
                ctx.translate(r.x, r.y);
                ctx.rotate((r.heading + r.turret) * Math.PI / 180);
                ctx.strokeStyle = r.down ? hex(c, 0.5) : "#ffffff"; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(28, 0); ctx.stroke();
                ctx.restore();
            }
            ctx.fillStyle = r.alive ? hex(c, 0.9) : "#55555f";
            ctx.font = "15px Menlo, Consolas, monospace";
            ctx.textAlign = "center";
            ctx.fillText(r.name, r.x, r.y - 24);
            if (i === selected && r.alive) { ctx.strokeStyle = hex(c, 0.5); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(r.x, r.y, 30, 0, 2 * Math.PI); ctx.stroke(); }
        });
        match.missiles.forEach(function (m) {
            var c = COLORS[m.owner % COLORS.length], dx = Math.cos(m.h * Math.PI / 180), dy = Math.sin(m.h * Math.PI / 180);
            ctx.strokeStyle = hex(c, 0.6); ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(m.x - dx * 26, m.y - dy * 26); ctx.lineTo(m.x, m.y); ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(m.x - 3, m.y - 3, 6, 6);
        });
        match.bursts.forEach(function (b) {
            var t = b.t / 18;
            ctx.strokeStyle = "rgba(255, 200, 80, " + (1 - t) + ")"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(b.x, b.y, b.size * (0.3 + t), 0, 2 * Math.PI); ctx.stroke();
        });
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "12px Menlo, Consolas, monospace";
        ctx.textAlign = "left";
        ctx.fillText("tick " + match.tick + "  seed " + match.seed, 10, A.SIZE - 10);
        score();
        debug();
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
        var rect = canvas.getBoundingClientRect(), x = (ev.clientX - rect.left) / rect.width * A.SIZE, y = (ev.clientY - rect.top) / rect.height * A.SIZE;
        var best = 0, bestD = Infinity;
        match.robots.forEach(function (r, i) { var d = Math.hypot(r.x - x, r.y - y); if (d < bestD) { bestD = d; best = i; } });
        selected = best;
        draw();
    });
    window.addEventListener("resize", draw);

    recall();
    draw();
    // For poking at from the console: the running match, and a redraw.
    window.ArenaPage = { match: function () { return match; }, draw: draw, start: start, select: function (i) { selected = i; draw(); } };
})();
