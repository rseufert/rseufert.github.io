/* The home page's dashboard section (index.html, #dashboard): one of the
   dashboard's numbers, the Willamette at the Morrison Bridge (USGS) as its
   level, which way it is heading, and a two-day sparkline. Plain SVG, so the
   home page does not load D3 for one small line; the dashboard page has the
   rest, and this is the home page's only request to another host. */
(function () {
    "use strict";

    var TZ = "America/Los_Angeles";
    var NS = "http://www.w3.org/2000/svg";

    function when(d) {
        return new Date(d).toLocaleString("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", minute: "2-digit" });
    }
    function feet(v) { return (v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + " ft"; }

    function getJSON(url) {
        var ctl = new AbortController();
        var timer = setTimeout(function () { ctl.abort(); }, 30000);
        return fetch(url, { signal: ctl.signal }).then(function (r) {
            clearTimeout(timer);
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
        });
    }

    // Rising or falling: the level now against an hour ago.
    function trend(points) {
        var last = points[points.length - 1], t = last.x - 36e5, before = points[0];
        for (var i = points.length - 1; i >= 0; i--) { if (points[i].x <= t) { before = points[i]; break; } }
        var d = last.y - before.y;
        return Math.abs(d) < 0.05 ? "steady" : d > 0 ? "rising" : "falling";
    }

    // A sparkline in the faint ink, with one reading (the latest, or now) as
    // an accent dot, an optional reference line, and a readout under it that
    // follows the pointer or the arrow keys.
    //   opts: { label, fmt, resting, mark (index), ref: { y } }
    function sparkline(tile, points, opts) {
        var box = tile.querySelector(".spark");
        var readout = tile.querySelector(".readout");
        var w = 240, h = 44, pad = 5;
        var x0 = points[0].x, x1 = points[points.length - 1].x;
        var ys = points.map(function (p) { return p.y; });
        if (opts.ref) ys.push(opts.ref.y);
        var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
        var sx = function (x) { return pad + (x - x0) / (x1 - x0 || 1) * (w - 2 * pad); };
        var sy = function (y) { return h - pad - (y - lo) / (hi - lo || 1) * (h - 2 * pad); };
        var svg = document.createElementNS(NS, "svg");
        svg.setAttribute("viewBox", "0 0 " + w + " " + h);
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("tabindex", "0");
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", opts.label + ". Use the arrow keys to read it.");
        function line(cls, d) {
            var n = document.createElementNS(NS, cls === "cross" ? "line" : "path");
            n.setAttribute("class", cls);
            if (d) n.setAttribute("d", d);
            n.setAttribute("vector-effect", "non-scaling-stroke");
            svg.appendChild(n);
            return n;
        }
        if (opts.ref) line("ref", "M0," + sy(opts.ref.y).toFixed(1) + "H" + w);
        line("line", points.map(function (p, i) { return (i ? "L" : "M") + sx(p.x).toFixed(1) + "," + sy(p.y).toFixed(1); }).join(""));
        var cross = line("cross");
        cross.setAttribute("y1", 0); cross.setAttribute("y2", h);
        cross.style.display = "none";
        box.textContent = "";
        box.appendChild(svg);
        // The dots are HTML, so they stay round however the line is stretched.
        function dot(cls) {
            var d = document.createElement("span");
            d.className = "dot " + cls;
            box.appendChild(d);
            return d;
        }
        var markAt = opts.mark === undefined ? points.length - 1 : opts.mark;
        var end = dot("end"), hover = dot("hover");
        function place(d, p) {
            d.style.left = (sx(p.x) / w * 100) + "%";
            d.style.top = (sy(p.y) / h * 100) + "%";
        }
        place(end, points[markAt]);
        hover.style.display = "none";
        readout.textContent = opts.resting;
        var index = markAt;
        function show(i) {
            index = Math.max(0, Math.min(points.length - 1, i));
            var p = points[index];
            cross.setAttribute("x1", sx(p.x)); cross.setAttribute("x2", sx(p.x));
            cross.style.display = "";
            place(hover, p);
            hover.style.display = "";
            readout.textContent = when(p.x) + " · " + opts.fmt(p.y);
        }
        function hide() { cross.style.display = "none"; hover.style.display = "none"; readout.textContent = opts.resting; }
        svg.addEventListener("pointermove", function (ev) {
            var r = svg.getBoundingClientRect();
            var t = x0 + ((ev.clientX - r.left) / r.width * w - pad) / (w - 2 * pad) * (x1 - x0);
            var best = 0;
            for (var i = 1; i < points.length; i++) { if (Math.abs(points[i].x - t) < Math.abs(points[best].x - t)) best = i; }
            show(best);
        });
        svg.addEventListener("pointerleave", hide);
        svg.addEventListener("focus", function () { show(index); });
        svg.addEventListener("blur", hide);
        svg.addEventListener("keydown", function (ev) {
            var step = ev.shiftKey ? 12 : 1;
            if (ev.key === "ArrowLeft") show(index - step);
            else if (ev.key === "ArrowRight") show(index + step);
            else if (ev.key === "Escape") hide();
            else return;
            ev.preventDefault();
        });
    }

    function fill(id, value, note) {
        var tile = document.getElementById(id);
        tile.querySelector(".value").textContent = value;
        var n = tile.querySelector(".note");
        n.textContent = "";
        if (note instanceof Node) n.appendChild(note); else n.textContent = note;
        return tile;
    }
    function fail(id, who) {
        fill(id, "—", who + " didn't answer just now");
        var t = document.getElementById(id);
        ["spark", "readout"].forEach(function (c) { var n = t.querySelector("." + c); if (n) n.textContent = ""; });
    }
    function lowHigh(points, fmt) {
        var ys = points.map(function (p) { return p.y; });
        return "low " + fmt(Math.min.apply(null, ys)) + ", high " + fmt(Math.max.apply(null, ys));
    }

    // USGS gauge height at the Morrison Bridge, every 15 minutes, and the

    getJSON("https://waterservices.usgs.gov/nwis/iv/?format=json&sites=14211720&parameterCd=00060,00065&period=P2D")
        .then(function (j) {
            var series = {};
            j.value.timeSeries.forEach(function (ts) {
                var nodata = ts.variable.noDataValue;
                series[ts.variable.variableCode[0].value] = ts.values[0].value
                    .map(function (v) { return { x: +new Date(v.dateTime), y: +v.value }; })
                    .filter(function (p) { return p.y !== nodata && !isNaN(p.y); });
            });
            var stage = series["00065"] || [], flow = series["00060"] || [];
            if (stage.length < 2) throw new Error("no readings");
            var now = stage[stage.length - 1];
            var dir = flow.length ? (flow[flow.length - 1].y < 0 ? " · running upstream on the tide" : " · running downstream") : "";
            var tile = fill("river-willamette", feet(now.y), trend(stage) + dir + " · " + when(now.x));
            sparkline(tile, stage, { label: "Willamette gauge height over two days: " + lowHigh(stage, feet), fmt: feet,
                                     resting: "the past two days · " + lowHigh(stage, feet) });
        }).catch(function () { fail("river-willamette", "USGS"); });

})();
