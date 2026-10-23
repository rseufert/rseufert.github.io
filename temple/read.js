/* temple/read.js: the reading room.
   /temple/read/#slug fetches /temple/texts/slug.txt, a Project Gutenberg
   file kept whole (header, text, licence), takes the text between the
   START and END markers, and sets it as pages: a blank line is a paragraph,
   a wrapped paragraph is joined, a paragraph of short lines (verse, a
   table of contents, a list) keeps its lines, and a short line in capitals
   on its own is a heading. The manifest temple/texts/index.json has each
   text's title, edition and Gutenberg number. The room remembers how far
   you were in each text (localStorage temple-read) and goes back there. */
(function () {
    "use strict";
    var body = document.getElementById("read-body"), titleOut = document.getElementById("read-title"), editionOut = document.getElementById("read-edition");
    var sourceOut = document.getElementById("read-source"), foot = document.getElementById("read-foot"), hint = document.getElementById("read-hint");
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
        var paras = inner.split(/\n[ \t]*\n+/), out = [], n = 0;
        for (var i = 0; i < paras.length; i++) {
            var p = paras[i].replace(/^\n+|\n+$/g, "");
            if (!p.trim()) continue;
            var lines = p.split("\n"), trimmed = lines.map(function (l) { return l.replace(/\s+$/, ""); });
            var longest = Math.max.apply(null, trimmed.map(function (l) { return l.length; }));
            var caps = lines.length <= 2 && longest < 80 && longest >= 4 && /[A-Z]/.test(p) && p === p.toUpperCase() && !/^\s*[IVXLC]+\.?$/.test(p.trim()) || /^(CHAPTER|BOOK|PART|SECTION|LECTURE|TREATISE|STANZA|SERMON|DIALOGUE|ENNEAD|LETTER)\b/i.test(p.trim()) && lines.length <= 2 && longest < 80;
            var indented = trimmed.filter(function (l) { return /^\s{2,}/.test(l); }).length;
            var verse = lines.length >= 2 && (longest < 60 || indented >= lines.length / 2) && trimmed.every(function (l) { return l.length < 78; });
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
    });
    window.addEventListener("hashchange", function () { location.reload(); });
    load(slugOf());
})();
