/* The home page's two rivers (index.html, #rivers): the Willamette at the
   Morrison Bridge (USGS) and the Columbia at Vancouver (NOAA), each as its
   level now, which way it is heading, and a two-day sparkline. Plain SVG, so
   the home page does not load D3 for two lines; the dashboard has the rest. */
(function () {
    "use strict";

    var TZ = "America/Los_Angeles";
    var DAY = 864e5;
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

    // A sparkline in the faint ink with the latest reading as an accent dot,
    // and a readout under it that follows the pointer (or the arrow keys).
    function sparkline(tile, points, label) {
        var box = tile.querySelector(".spark");
        var readout = tile.querySelector(".readout");
        var w = 240, h = 44, pad = 5;
        var x0 = points[0].x, x1 = points[points.length - 1].x;
        var ys = points.map(function (p) { return p.y; });
        var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);
        var sx = function (x) { return pad + (x - x0) / (x1 - x0 || 1) * (w - 2 * pad); };
        var sy = function (y) { return h - pad - (y - lo) / (hi - lo || 1) * (h - 2 * pad); };
        var svg = document.createElementNS(NS, "svg");
        svg.setAttribute("viewBox", "0 0 " + w + " " + h);
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("tabindex", "0");
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", label + " over two days: low " + feet(lo) + ", high " + feet(hi) + ". Use the arrow keys to read it.");
        var line = document.createElementNS(NS, "path");
        line.setAttribute("class", "line");
        line.setAttribute("d", points.map(function (p, i) { return (i ? "L" : "M") + sx(p.x).toFixed(1) + "," + sy(p.y).toFixed(1); }).join(""));
        line.setAttribute("vector-effect", "non-scaling-stroke");
        svg.appendChild(line);
        var cross = document.createElementNS(NS, "line");
        cross.setAttribute("class", "cross");
        cross.setAttribute("y1", 0); cross.setAttribute("y2", h);
        cross.setAttribute("vector-effect", "non-scaling-stroke");
        cross.style.display = "none";
        svg.appendChild(cross);
        box.textContent = "";
        box.appendChild(svg);
        // The dots are HTML, so they stay round however the line is stretched.
        function dot(cls) {
            var d = document.createElement("span");
            d.className = "dot " + cls;
            box.appendChild(d);
            return d;
        }
        var end = dot("end"), hover = dot("hover");
        function place(d, p) {
            d.style.left = (sx(p.x) / w * 100) + "%";
            d.style.top = (sy(p.y) / h * 100) + "%";
        }
        place(end, points[points.length - 1]);
        hover.style.display = "none";
        var resting = "the past two days · low " + feet(lo) + ", high " + feet(hi);
        readout.textContent = resting;
        var index = points.length - 1;
        function show(i) {
            index = Math.max(0, Math.min(points.length - 1, i));
            var p = points[index];
            cross.setAttribute("x1", sx(p.x)); cross.setAttribute("x2", sx(p.x));
            cross.style.display = "";
            place(hover, p);
            hover.style.display = "";
            readout.textContent = when(p.x) + " · " + feet(p.y);
        }
        function hide() { cross.style.display = "none"; hover.style.display = "none"; readout.textContent = resting; }
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
        tile.querySelector(".note").textContent = note;
        return tile;
    }
    function fail(id, who) {
        fill(id, "—", who + " didn't answer just now");
        document.getElementById(id).querySelector(".spark").textContent = "";
        document.getElementById(id).querySelector(".readout").textContent = "";
    }

    // USGS gauge height at the Morrison Bridge, every 15 minutes, and the
    // flow, which goes negative when the tide pushes the river upstream.
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
            var tile = fill("river-willamette", feet(now.y), trend(stage) + dir + " · " + when(new Date(now.x)));
            sparkline(tile, stage, "Willamette gauge height");
        }).catch(function () { fail("river-willamette", "USGS"); });

    // NOAA's water level at Vancouver, every six minutes, in feet above mean lower low water.
    getJSON("https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=9440083&product=water_level&datum=MLLW&date=recent&units=english&time_zone=gmt&format=json&application=rickseufert.com")
        .then(function (j) {
            if (j.error) throw new Error(j.error.message);
            var pts = j.data.filter(function (d) { return d.v !== ""; }).map(function (d) {
                return { x: Date.parse(d.t.replace(" ", "T") + "Z"), y: +d.v };
            });
            if (pts.length < 2) throw new Error("no readings");
            var since = pts[pts.length - 1].x - 2 * DAY;
            pts = pts.filter(function (p) { return p.x >= since; });
            var now = pts[pts.length - 1];
            var tile = fill("river-columbia", feet(now.y), trend(pts) + " · " + when(new Date(now.x)));
            sparkline(tile, pts, "Columbia water level");
        }).catch(function () { fail("river-columbia", "NOAA"); });
})();
