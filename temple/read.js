/* temple/read.js: the reading room.
   /temple/read/#slug fetches /temple/texts/slug.txt, a Project Gutenberg
   file kept whole (header, text, licence), takes the text between the
   START and END markers, and sets it as pages: a blank line is a paragraph,
   a wrapped paragraph is joined, a paragraph of short lines (verse, a
   table of contents, a list, numbered verses) keeps its lines, a short
   line in capitals on its own, or before a rule of underscores, or numbered
   with a roman numeral, is a heading, and a rule is dropped. The manifest temple/texts/index.json has each
   text's title, edition and Gutenberg number. The room remembers how far
   you were in each text (localStorage temple-read) and goes back there. */
(function () {
    "use strict";
    var body = document.getElementById("read-body"), titleOut = document.getElementById("read-title"), editionOut = document.getElementById("read-edition");
    var sourceOut = document.getElementById("read-source"), foot = document.getElementById("read-foot"), hint = document.getElementById("read-bar");
    var aloudBtn = document.getElementById("read-aloud");
    if (!body) return;
    var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function slugOf() {
        var h = (location.hash || "").replace(/^#/, "");
        if (!h) { var m = /[?&]t=([a-z0-9-]+)/.exec(location.search); h = m ? m[1] : ""; }
        return /^[a-z0-9-]+$/.test(h) ? h : "";
    }
    var marks = { START: /^\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/m, END: /^\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG EBOOK.*$/m };
    function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function setPages(text) {
        var a = marks.START.exec(text), b = marks.END.exec(text);
        var inner = text.slice(a ? a.index + a[0].length : 0, b ? b.index : text.length).replace(/\r/g, "");
        var paras = inner.split(/\n[ \t]*\n+/).map(function (p) { return p.replace(/^\n+|\n+$/g, ""); }).filter(function (p) { return p.trim(); }), out = [], n = 0;
        function isRule(p) { return /^[\s_\-=*]{6,}$/.test(p); }
        for (var i = 0; i < paras.length; i++) {
            var p = paras[i], hadRule = false;
            // a line of underscores is a rule, not text; CCEL puts one right under a heading
            var lines = p.split("\n").filter(function (l) { if (isRule(l)) { hadRule = true; return false; } return true; });
            if (!lines.length) continue;
            p = lines.join("\n");
            var trimmed = lines.map(function (l) { return l.replace(/\s+$/, ""); });
            var longest = Math.max.apply(null, trimmed.map(function (l) { return l.length; }));
            var caps = lines.length <= 2 && longest < 80 && longest >= 4 && /[A-Z]/.test(p) && p === p.toUpperCase() && !/^\s*[IVXLC]+\.?$/.test(p.trim()) || /^(CHAPTER|BOOK|PART|SECTION|LECTURE|TREATISE|STANZA|SERMON|DIALOGUE|ENNEAD|LETTER)\b/i.test(p.trim()) && (lines.length <= 2 && longest < 80 || lines.length <= 4 && p.length < 320 && /^[A-Z][a-z]+ [IVXLC\d]+\.?(--|\.|:)/.test(p.trim()));   // a chapter with its argument, wrapped
            // a short line on its own before a rule (CCEL's way), or numbered with a roman numeral, is a heading too
            if (!caps && lines.length === 1 && longest < 120 && !/^\s*\[\d+\]/.test(p) && (hadRule || isRule(paras[i + 1] || "") || /^[IVXLC]+\.\s+\S/.test(p.trim()))) caps = true;   // a footnote before a rule is not one
            var indented = trimmed.filter(function (l) { return /^\s{2,}/.test(l); }).length;
            var numbered = trimmed.filter(function (l) { return /^\s*\d+[a-z]?\s?\)/.test(l); }).length;
            var verse = lines.length >= 2 && (longest < 60 || indented >= lines.length / 2 || numbered >= lines.length / 2) && (numbered >= lines.length / 2 || trimmed.every(function (l) { return l.length < 78; }));
            if (caps) out.push("<h2>" + esc(trimmed.join(" ").replace(/\s+/g, " ").trim()) + "</h2>");
            else if (verse) out.push("<p class=\"verse\">" + trimmed.map(function (l) { return esc(l.replace(/^\s+/, function (sp) { return " ".repeat(Math.min(12, sp.length)); })); }).join("<br>") + "</p>");
            else out.push("<p>" + esc(trimmed.map(function (l) { return l.trim(); }).join(" ")) + "</p>");
            n++;
        }
        body.innerHTML = out.join("\n");
        return n;
    }
    function remember(slug) {
        var store = {};
        try { store = JSON.parse(localStorage.getItem("temple-read")) || {}; } catch (e) { store = {}; }
        var tick = null;
        window.addEventListener("scroll", function () {
            if (tick) return;
            tick = setTimeout(function () {
                tick = null;
                var max = document.documentElement.scrollHeight - innerHeight;
                store[slug] = max > 0 ? Math.round(scrollY / max * 10000) / 10000 : 0;
                try { localStorage.setItem("temple-read", JSON.stringify(store)); } catch (e) { /* a visit's worth */ }
            }, 400);
        }, { passive: true });
        return store[slug] || 0;
    }
    function load(slug) {
        if (!slug) return;
        var m = { title: slug, edition: "", gutenberg: 0 };
        fetch("/temple/texts/index.json").then(function (r) { return r.json(); }).catch(function () { return {}; }).then(function (manifest) {
            m = manifest[slug] || m;
            document.title = m.title + " · the reading room";
            titleOut.textContent = m.title;
            editionOut.textContent = m.edition || "";
            var vols = Object.keys(manifest).filter(function (k) { return manifest[k].shelf === m.shelf && k !== slug; }).sort();
            var scan = m.archive ? "· a scan at the Internet Archive, <a href=\"https://archive.org/details/" + m.archive + "\">" + esc(m.archive) + "</a>" + (m.scan && m.scan.year ? ", " + esc(m.scan.year) : "") + "; the OCR, uncorrected · " : "";
            var hand = m.source ? "· the text at <a href=\"" + esc(m.source) + "\">" + esc(m.host || "its source") + "</a> · " : "";
            sourceOut.innerHTML = (m.gutenberg ? "· Project Gutenberg <a href=\"https://www.gutenberg.org/ebooks/" + m.gutenberg + "\">#" + m.gutenberg + "</a> · " : scan || hand || "· ") +
                "<a href=\"/temple/texts/" + slug + ".txt\">the file</a>" +
                (m.shelf ? " · <a href=\"/temple/#lib-" + m.shelf + "\">its shelf</a>" : "") +
                (vols.length ? " · " + vols.map(function (k) { return "<a href=\"/temple/read/#" + k + "\">" + esc(manifest[k].title) + "</a>"; }).join(", ") : "");
            return fetch("/temple/texts/" + slug + ".txt");
        }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }).then(function (text) {
            var n = setPages(text);
            if (hint) hint.hidden = false;
            foot.innerHTML = n + " paragraphs. " + (m.ocr
                ? "This is the OCR text of a public-domain scan at the Internet Archive, read by a machine and not corrected by anyone, so a letter is wrong here and there and the Greek is mostly lost; the scan itself, with the pages, is <a href=\"https://archive.org/details/" + esc(m.archive) + "\">there</a>, and the text file is <a href=\"/temple/texts/" + slug + ".txt\">here</a>."
                : m.free ? "This text is not public domain but is free to copy by its author's word (the shelf note says whose); taken from <a href=\"" + esc(m.source) + "\">" + esc(m.host || "its source") + "</a> and kept here as a plain file, <a href=\"/temple/texts/" + slug + ".txt\">this one</a>."
                : m.source ? "This is a public-domain translation, the text taken from <a href=\"" + esc(m.source) + "\">" + esc(m.host || "its source") + "</a> and kept here as a plain file, <a href=\"/temple/texts/" + slug + ".txt\">this one</a>."
                : "This is a Project Gutenberg eBook, in the public domain in the United States; the file it was set from, with the licence, is <a href=\"/temple/texts/" + slug + ".txt\">here</a>, whole.") +
                " The shelf is <a href=\"/temple/#library\">the library</a>.";
            var at = remember(slug);
            if (at > 0.005) {
                var max = document.documentElement.scrollHeight - innerHeight;
                window.scrollTo(0, Math.round(at * max));
                editionOut.textContent += (editionOut.textContent ? " · " : "") + "picked up where you were, " + Math.round(at * 100) + "% in";
            }
        }).catch(function (e) {
            titleOut.textContent = "Not on the shelf";
            body.innerHTML = "<p>There is no text called <code>" + esc(slug) + "</code> here. <a href=\"/temple/#library\">The shelves</a> have what there is.</p>";
        });
    }
    document.addEventListener("keydown", function (ev) {
        if (ev.target && /^(input|textarea|select)$/i.test(ev.target.tagName)) return;
        var k = ev.key, step = innerHeight * 0.85, b = REDUCED ? "auto" : "smooth";
        if (k === "j") window.scrollBy({ top: step, behavior: b });
        else if (k === "k") window.scrollBy({ top: -step, behavior: b });
        else if (k === "t") window.scrollTo({ top: 0, behavior: b });
        else if (k === "r" || k === "R") aloud();
    });

    // ---- the librarian reads aloud ----------------------------------------------------
    // The browser's own voice, the flattest one it has, from the paragraph at the
    // top of the screen onward, each paragraph marked as it is read and kept in
    // view; R or the button starts it and stops it.
    var synth = window.speechSynthesis, reading = null;
    function voice() {
        if (!synth) return null;
        var vs = synth.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
        var pick = vs.filter(function (v) { return /daniel|alex|arthur|google uk english male|microsoft (george|ryan)/i.test(v.name); })[0] || vs.filter(function (v) { return /GB/i.test(v.lang); })[0] || vs[0];
        return pick || null;
    }
    function mark(el) {
        var old = body.querySelector(".aloud");
        if (old) old.classList.remove("aloud");
        if (!el) return;
        el.classList.add("aloud");
        var r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > innerHeight * 0.9) el.scrollIntoView({ block: "center", behavior: REDUCED ? "auto" : "smooth" });
    }
    function stopAloud() {
        reading = null;
        if (synth) synth.cancel();
        mark(null);
        if (aloudBtn) { aloudBtn.setAttribute("aria-pressed", "false"); aloudBtn.textContent = "read aloud"; }
    }
    function speakFrom(el) {
        if (!el) { stopAloud(); return; }
        var text = el.textContent.replace(/\s+/g, " ").trim();
        if (!text) { speakFrom(el.nextElementSibling); return; }
        var u = new SpeechSynthesisUtterance(text), v = voice();
        if (v) u.voice = v;
        u.rate = 0.92; u.pitch = 0.72; u.volume = 1;
        reading = u;
        mark(el);
        u.onend = function () { if (reading === u) speakFrom(el.nextElementSibling); };
        u.onerror = function () { if (reading === u) stopAloud(); };
        synth.speak(u);
    }
    function aloud() {
        if (!synth || !body.children.length) return;
        if (reading) { stopAloud(); return; }
        // the paragraph nearest the top third of the screen
        var at = innerHeight * 0.3, best = body.children[0], bd = 1e9;
        for (var i = 0; i < body.children.length; i++) { var d = Math.abs(body.children[i].getBoundingClientRect().top - at); if (d < bd) { bd = d; best = body.children[i]; } }
        synth.cancel();
        if (aloudBtn) { aloudBtn.setAttribute("aria-pressed", "true"); aloudBtn.textContent = "stop reading"; }
        speakFrom(best);
    }
    if (aloudBtn) {
        aloudBtn.hidden = !synth;
        aloudBtn.addEventListener("click", aloud);
    }
    window.addEventListener("pagehide", stopAloud);
    window.addEventListener("beforeunload", stopAloud);
    window.addEventListener("hashchange", function () { location.reload(); });
    load(slugOf());
})();
