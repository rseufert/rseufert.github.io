/* The home page's dashboard section (index.html, #dashboard): the two rivers
   and the mountains, right now. Plain SVG, so the home page does not load D3
   for a few small lines; the dashboard page has the rest.

   Rivers: the Willamette at the Morrison Bridge (USGS) and the Columbia at
   Vancouver (NOAA), each as its level, which way it is heading, and a
   two-day sparkline. Mountains: the ten Cascade volcanoes' USGS alert
   levels, and Mount Hood's freezing level for the week ahead against its
   summit, with its earthquakes and snow. Sky: the next asteroid flybys
   (NASA JPL, saved nightly) and the planetary K index (NOAA) against Kp 7.
   Each tile fails on its own. */
(function () {
    "use strict";

    var TZ = "America/Los_Angeles";
    var DAY = 864e5;
    var NS = "http://www.w3.org/2000/svg";
    var FT = 3.28084;
    var HOOD = { lat: 45.374, lon: -121.695, summitFt: Math.round(3426 * 3.28084) };

    function when(d) {
        return new Date(d).toLocaleString("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", minute: "2-digit" });
    }
    function feet(v) { return (v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + " ft"; }
    function bigFeet(v) { return Math.round(v).toLocaleString("en-US") + " ft"; }

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
        ["spark", "readout", "volcano-list"].forEach(function (c) { var n = t.querySelector("." + c); if (n) n.textContent = ""; });
    }
    function lowHigh(points, fmt) {
        var ys = points.map(function (p) { return p.y; });
        return "low " + fmt(Math.min.apply(null, ys)) + ", high " + fmt(Math.max.apply(null, ys));
    }

    /* ---- rivers ---------------------------------------------------------- */

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
            var tile = fill("river-willamette", feet(now.y), trend(stage) + dir + " · " + when(now.x));
            sparkline(tile, stage, { label: "Willamette gauge height over two days: " + lowHigh(stage, feet), fmt: feet,
                                     resting: "the past two days · " + lowHigh(stage, feet) });
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
            var tile = fill("river-columbia", feet(now.y), trend(pts) + " · " + when(now.x));
            sparkline(tile, pts, { label: "Columbia water level over two days: " + lowHigh(pts, feet), fmt: feet,
                                   resting: "the past two days · " + lowHigh(pts, feet) });
        }).catch(function () { fail("river-columbia", "NOAA"); });

    /* ---- mountains ------------------------------------------------------- */

    // The ten Cascade volcanoes USGS watches, north to south, by its codes.
    var VOLCANOES = [
        ["wa2", "Baker"], ["wa3", "Glacier Peak"], ["wa6", "Rainier"], ["wa4", "St. Helens"], ["wa1", "Adams"],
        ["or12", "Hood"], ["or13", "Jefferson"], ["or20", "Three Sisters"], ["or15", "Newberry"], ["or4", "Crater Lake"]
    ];
    // USGS's alert levels as status colours, always beside the level's name.
    var ALERTS = { NORMAL: ["normal", "status-good"], ADVISORY: ["advisory", "status-warning"],
                   WATCH: ["watch", "status-serious"], WARNING: ["warning", "status-critical"] };

    getJSON("https://volcanoes.usgs.gov/hans-public/api/volcano/getMonitoredVolcanoes")
        .then(function (list) {
            var by = {};
            list.forEach(function (v) { by[v.volcano_cd] = v.alert_level; });
            var raised = 0;
            var ul = document.createElement("ul");
            VOLCANOES.forEach(function (v) {
                var a = ALERTS[by[v[0]]] || [(by[v[0]] || "unassigned").toLowerCase(), "status-none"];
                if (by[v[0]] && by[v[0]] !== "NORMAL") raised++;
                var li = document.createElement("li");
                var d = document.createElement("span");
                d.className = "status-dot " + a[1];
                li.appendChild(d);
                li.appendChild(document.createTextNode(v[1]));
                if (a[0] !== "normal") {
                    var s = document.createElement("strong");
                    s.textContent = " " + a[0];
                    li.appendChild(s);
                }
                ul.appendChild(li);
            });
            var tile = fill("mountain-volcanoes", raised ? raised + " raised" : "all normal",
                raised ? "Washington, then Oregon, north to south" : "green on all ten: Washington, then Oregon, north to south");
            var box = tile.querySelector(".volcano-list");
            box.textContent = "";
            box.appendChild(ul);
        }).catch(function () { fail("mountain-volcanoes", "USGS"); });

    // Mount Hood: the freezing level for the week ahead (Open-Meteo), with the
    // past 30 days' earthquakes (USGS) and the snow at the Test Site (SNOTEL)
    // in the note, each left out if its source is slow or down.
    var iso = function (d) { return d.toISOString().slice(0, 10); };
    var hoodQuakes = getJSON("https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=" + HOOD.lat +
        "&longitude=" + HOOD.lon + "&maxradiuskm=20&starttime=" + new Date(Date.now() - 30 * DAY).toISOString().slice(0, 19))
        .then(function (j) { return j.features.length; }, function () { return null; });
    var hoodSnow = getJSON("https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data?stationTriplets=651:OR:SNTL&elements=SNWD&duration=DAILY" +
        "&beginDate=" + iso(new Date(Date.now() - 7 * DAY)) + "&endDate=" + iso(new Date()))
        .then(function (j) {
            var v = j[0].data[0].values.filter(function (x) { return x.value !== null && x.value !== undefined; });
            return v.length ? v[v.length - 1].value : null;
        }, function () { return null; });
    getJSON("https://api.open-meteo.com/v1/forecast?latitude=" + HOOD.lat + "&longitude=" + HOOD.lon +
        "&hourly=freezing_level_height&forecast_days=7&timezone=GMT")
        .then(function (j) {
            var pts = j.hourly.time.map(function (t, i) {
                var v = j.hourly.freezing_level_height[i];
                return { x: Date.parse(t + ":00Z"), y: v === null ? null : v * FT };
            }).filter(function (p) { return p.y !== null; });
            var nowAt = 0, now = Date.now();
            pts.forEach(function (p, i) { if (Math.abs(p.x - now) < Math.abs(pts[nowAt].x - now)) nowAt = i; });
            var ahead = pts.slice(nowAt);
            if (ahead.length < 2) throw new Error("no forecast");
            var low = ahead.reduce(function (a, p) { return p.y < a.y ? p : a; }, ahead[0]);
            return Promise.all([hoodQuakes, hoodSnow]).then(function (more) {
                var cur = ahead[0];
                var note = (cur.y < HOOD.summitFt ? "freezing below" : "freezing above") + " the " + bigFeet(HOOD.summitFt) + " summit";
                if (more[0] !== null) note += " · " + more[0] + (more[0] === 1 ? " earthquake" : " earthquakes") + " in 30 days";
                if (more[1] !== null) note += " · " + more[1] + " in of snow at 5,380 ft";
                var tile = fill("mountain-hood", bigFeet(cur.y), note);
                sparkline(tile, ahead, {
                    label: "Freezing level over Mount Hood for the week ahead, against the summit; lowest " + bigFeet(low.y),
                    fmt: bigFeet, mark: 0, ref: { y: HOOD.summitFt },
                    resting: "the week ahead; the line across is the summit · lowest " + bigFeet(low.y) + ", " +
                        new Date(low.x).toLocaleString("en-US", { timeZone: TZ, weekday: "short" })
                });
            });
        }).catch(function () { fail("mountain-hood", "Open-Meteo"); });

    /* ---- sky ------------------------------------------------------------- */

    // The next asteroid flybys, from the nightly copy of NASA JPL's
    // close-approach data (the sky-data branch, as the dashboard reads it;
    // the copy on master if that fails).
    var LD_AU = 384400 / 149597870.7;
    var MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    function jplTime(cd) {  // "2026-Oct-14 05:34", UTC
        var m = /^(\d+)-(\w+)-(\d+) (\d+):(\d+)$/.exec(cd);
        return m ? Date.UTC(+m[1], MONTHS[m[2]], +m[3], +m[4], +m[5]) : NaN;
    }
    function across(h) {  // estimated diameter for a typical 14% reflectivity
        var metres = 1329 / Math.sqrt(0.14) * Math.pow(10, -h / 5) * 1000;
        return metres >= 1000 ? (metres / 1000).toPrecision(2) + " km" : Math.round(metres) + " m";
    }
    function shortWhen(t) {
        return new Date(t).toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    }
    getJSON("https://raw.githubusercontent.com/rseufert/rseufert.github.io/sky-data/sky.json")
        .catch(function () { return getJSON("/data/sky.json"); })
        .then(function (sky) {
            var f = sky.approaches.fields;
            var col = function (k) { return f.indexOf(k); };
            var now = Date.now();
            var next = sky.approaches.data.map(function (r) {
                return { name: r[col("des")], t: jplTime(r[col("cd")]), ld: +r[col("dist")] / LD_AU, h: +r[col("h")] };
            }).filter(function (a) { return a.t >= now; }).sort(function (a, b) { return a.t - b.t; });
            if (!next.length) throw new Error("no flybys ahead");
            var a = next[0];
            var tile = fill("sky-asteroids", a.name, shortWhen(a.t) + " · " + a.ld.toFixed(1) + " lunar distances" +
                (a.ld < 1 ? ", inside the Moon's orbit" : "") + " · about " + across(a.h) + " across");
            var ul = document.createElement("ul");
            // The next four after it; the first is the tile's headline.
            next.slice(1, 5).forEach(function (n) {
                var li = document.createElement("li");
                var s = document.createElement("strong");
                s.textContent = n.name;
                li.appendChild(s);
                li.appendChild(document.createTextNode(" " + shortWhen(n.t) + " · " + n.ld.toFixed(1) + " LD" + (n.ld < 1 ? ", inside the Moon" : "")));
                ul.appendChild(li);
            });
            var box = tile.querySelector(".flyby-list");
            box.textContent = "";
            box.appendChild(ul);
        }).catch(function () { fail("sky-asteroids", "NASA JPL's data"); });

    // NOAA's planetary K index: the past three days and its forecast for the
    // next three, against Kp 7, where a storm can bring the aurora to Oregon.
    getJSON("https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json")
        .then(function (rows) {
            var since = Date.now() - 3 * DAY;
            var pts = rows.map(function (r) {
                return { x: Date.parse(r.time_tag + "Z"), y: +r.kp, predicted: r.observed === "predicted" };
            }).filter(function (p) { return !isNaN(p.y) && p.x >= since; });
            var seen = pts.filter(function (p) { return !p.predicted; });
            if (!seen.length || pts.length < 2) throw new Error("no readings");
            var cur = seen[seen.length - 1];
            var peak = pts.filter(function (p) { return p.predicted; }).reduce(function (m, p) { return !m || p.y > m.y ? p : m; }, null);
            var kp = function (v) { return "Kp " + (Math.round(v * 100) / 100); };
            var state = cur.y >= 5 ? "G" + Math.min(5, Math.floor(cur.y) - 4) + " storm" : cur.y >= 4 ? "active" : "quiet";
            var tile = fill("sky-kp", kp(cur.y), state + (peak ? " · forecast peak " + kp(peak.y) : "") +
                " · the aurora reaches Portland in a strong storm, around Kp 7");
            sparkline(tile, pts, {
                label: "Planetary K index for the past three days and NOAA's forecast for the next three, against Kp 7",
                fmt: kp, mark: pts.indexOf(cur), ref: { y: 7 },
                resting: "three days back, three ahead; the line across is Kp 7"
            });
        }).catch(function () { fail("sky-kp", "NOAA"); });
})();
