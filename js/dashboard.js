/* The dashboard (dashboard/index.html): public data feeds, drawn with D3.
   Each panel asks its source's own API when the page loads, and each figure
   fails on its own: a source that is down says so in its own box and leaves
   the rest of the page alone. Names and places from the feeds are inserted
   with textContent, never as HTML. */
(function () {
    "use strict";

    var FISCAL = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service";
    var BIS = "https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0";
    var GBFS = "https://gbfs.lyft.com/gbfs/2.3/pdx/en";
    var PDX = { lat: 45.52, lon: -122.68, tz: "America/Los_Angeles" };

    var parseDay = d3.timeParse("%Y-%m-%d");
    var parseMonth = d3.timeParse("%Y-%m");
    var parseLocal = d3.timeParse("%Y-%m-%dT%H:%M");
    var fmtDay = d3.timeFormat("%b %-d, %Y");
    var fmtMonth = d3.timeFormat("%b %Y");
    var fmtWeekday = d3.timeFormat("%a %b %-d");
    var fmtHour = d3.timeFormat("%a %-I %p");
    var penny = d3.format("$,.2f");
    var comma = d3.format(",");

    // $40.30 trillion / $872.5 billion: words, not SI letters (d3's "G" is not "billion").
    function dollars(v, digits) {
        var a = Math.abs(v), d = digits === undefined ? 2 : digits;
        if (a >= 1e12) return "$" + (v / 1e12).toFixed(d) + " trillion";
        if (a >= 1e9) return "$" + (v / 1e9).toFixed(1) + " billion";
        if (a >= 1e6) return "$" + (v / 1e6).toFixed(1) + " million";
        return penny(v);
    }
    function dollarsTick(v) {
        if (Math.abs(v) >= 1e12) return "$" + d3.format(".3~")(v / 1e12) + "T";
        if (Math.abs(v) >= 1e9) return "$" + d3.format(",.4~")(v / 1e9) + "B";
        return "$" + d3.format(",")(v);
    }
    function pct(v) { return d3.format(".2f")(v) + "%"; }
    function pctTick(v) { return d3.format(".3~")(v) + "%"; }

    /* ---- fetching -------------------------------------------------------- */

    function getJSON(url, init) {
        var ctl = new AbortController();
        var timer = setTimeout(function () { ctl.abort(); }, 45000);
        return fetch(url, Object.assign({ signal: ctl.signal }, init || {})).then(function (r) {
            clearTimeout(timer);
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r;
        });
    }
    // Fiscal Data's query language: fields=, filter=field:op:value,..., sort=, page[size]=
    function fiscal(path, params) {
        var q = Object.keys(params).map(function (k) {
            return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
        }).join("&");
        return getJSON(FISCAL + path + "?" + q).then(function (r) { return r.json(); })
            .then(function (j) { return j.data; });
    }

    /* ---- small pieces of DOM --------------------------------------------- */

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    }
    function setStat(id, value, note) {
        var s = document.getElementById(id);
        s.querySelector(".value").textContent = value;
        var n = s.querySelector(".note");
        n.textContent = "";
        if (note instanceof Node) n.appendChild(note); else n.textContent = note || "";
        s.classList.remove("failed");
    }
    function failStat(id) {
        var s = document.getElementById(id);
        s.querySelector(".value").textContent = "—";
        s.querySelector(".note").textContent = "source didn't answer";
        s.classList.add("failed");
    }
    function figure(id) {
        var f = document.getElementById(id);
        return { root: f, plot: f.querySelector(".plot"), legend: f.querySelector(".legend"), table: f.querySelector(".table div") };
    }
    function loading(fig) {
        fig.plot.textContent = "";
        fig.plot.appendChild(el("p", "state", "loading…"));
    }
    function failed(fig, err, retry) {
        fig.plot.textContent = "";
        var p = el("p", "state failed", "couldn't reach the source (" + (err && err.message || "error") + "). ");
        var b = el("button", "retry", "try again");
        b.type = "button";
        b.addEventListener("click", retry);
        p.appendChild(b);
        fig.plot.appendChild(p);
        if (window.console) console.warn(fig.root.id, err);
    }
    function legend(fig, items) {
        fig.legend.textContent = "";
        items.forEach(function (it) {
            // The key wears the series colour; the words stay in the page's ink.
            var i = el("span", "item");
            i.appendChild(el("span", "key " + (it.shape || "line") + (it.dashed ? " dashed" : "") + " " + it.cls));
            i.appendChild(document.createTextNode(it.name));
            fig.legend.appendChild(i);
        });
    }
    function table(fig, columns, rows, note) {
        var t = el("table");
        var tr = el("tr");
        columns.forEach(function (c) { tr.appendChild(el("th", c.num ? "num" : "", c.name)); });
        var thead = el("thead"); thead.appendChild(tr); t.appendChild(thead);
        var tbody = el("tbody");
        rows.forEach(function (r) {
            var row = el("tr");
            columns.forEach(function (c) { row.appendChild(el("td", c.num ? "num" : "", c.value(r))); });
            tbody.appendChild(row);
        });
        t.appendChild(tbody);
        fig.table.textContent = "";
        if (note) fig.table.appendChild(el("p", "note", note));
        fig.table.appendChild(t);
    }
    // The last row of each month, for a table that would otherwise be thousands long.
    function monthly(points) {
        return d3.groups(points, function (p) { return d3.timeMonth(p.x); })
            .map(function (g) { return g[1][g[1].length - 1]; });
    }

    // Charts redraw at their container's width; one observer serves them all.
    var drawers = new Map();
    var observer = new ResizeObserver(function (entries) {
        entries.forEach(function (e) {
            var f = drawers.get(e.target);
            if (f && e.contentRect.width !== f.width) { f.width = e.contentRect.width; f.draw(); }
        });
    });
    function onWidth(fig, draw) {
        var entry = { width: fig.plot.clientWidth, draw: draw };
        drawers.set(fig.plot, entry);
        observer.observe(fig.plot);
        draw();
    }

    /* ---- tooltip --------------------------------------------------------- */

    // One tooltip per plot. Values lead and labels follow; each row is keyed
    // with a short stroke of its series colour.
    function tooltip(plot) {
        var tip = el("div", "tip");
        tip.setAttribute("role", "status");
        plot.appendChild(tip);
        return {
            show: function (x, y, title, rows) {
                tip.textContent = "";
                tip.appendChild(el("div", "when", title));
                rows.forEach(function (r) {
                    var row = el("div", "row");
                    if (r.cls) row.appendChild(el("span", "key line" + (r.dashed ? " dashed" : "") + " " + r.cls));
                    row.appendChild(el("strong", "", r.value));
                    if (r.name) row.appendChild(el("span", "name", r.name));
                    tip.appendChild(row);
                });
                tip.style.display = "block";
                var w = plot.clientWidth, tw = tip.offsetWidth, th = tip.offsetHeight;
                var left = x + 14 + tw > w ? x - 14 - tw : x + 14;
                tip.style.left = Math.max(0, left) + "px";
                tip.style.top = Math.max(0, y - th - 10) + "px";
            },
            hide: function () { tip.style.display = "none"; }
        };
    }

    /* ---- line chart ------------------------------------------------------ */

    // cfg.series: [{name, cls, points: [{x: Date, y}], forecastFrom?: Date}]
    // The first series sets the crosshair's stops. End labels sit to the
    // right; when they would collide they are spread apart and joined to
    // their line by a leader.
    function lineChart(fig, cfg) {
        var series = cfg.series;
        var primary = series[0].points;
        var height = cfg.height || 260;
        onWidth(fig, function () {
            var width = fig.plot.clientWidth;
            if (!width) return;
            var labelW = cfg.endLabels ? (width < 520 ? 74 : 104) : 12;
            var m = { top: 12, right: labelW, bottom: 28, left: cfg.leftMargin || 56 };
            var all = [].concat.apply([], series.map(function (s) { return s.points; }));
            var x = d3.scaleTime().domain(cfg.xDomain || d3.extent(all, function (p) { return p.x; }))
                .range([m.left, width - m.right]);
            var yExt = d3.extent(all, function (p) { return p.y; });
            if (cfg.yMin !== undefined) yExt[0] = Math.min(cfg.yMin, yExt[0]);
            if (cfg.yMax !== undefined) yExt[1] = Math.max(cfg.yMax, yExt[1]);
            var pad = (yExt[1] - yExt[0]) * 0.06 || 1;
            var y = d3.scaleLinear()
                .domain([cfg.yMin !== undefined ? yExt[0] : yExt[0] - pad, yExt[1] + pad]).nice()
                .range([height - m.bottom, m.top]);

            fig.plot.textContent = "";
            var svg = d3.select(fig.plot).append("svg")
                .attr("viewBox", [0, 0, width, height]).attr("width", width).attr("height", height)
                .attr("tabindex", 0).attr("role", "img")
                .attr("aria-label", cfg.label + ". Use the arrow keys to read values; the table below has them all.");
            var tip = tooltip(fig.plot);

            // Background bands (the AQI categories), labelled at the right.
            if (cfg.bands) {
                var b = svg.append("g").attr("class", "bands");
                cfg.bands.forEach(function (band) {
                    var y0 = y(Math.min(band.to, y.domain()[1])), y1 = y(Math.max(band.from, y.domain()[0]));
                    if (y1 - y0 <= 0) return;
                    b.append("rect").attr("class", "band " + band.cls)
                        .attr("x", m.left).attr("width", width - m.right - m.left)
                        .attr("y", y0).attr("height", y1 - y0);
                    var narrow = width < 520;
                    if (y1 - y0 >= (narrow ? 16 : 12)) {
                        b.append("text").attr("class", "band-label" + (narrow ? " inside" : ""))
                            .attr("x", narrow ? m.left + 6 : width - m.right + 6)
                            .attr("y", narrow ? y0 + 11 : (y0 + y1) / 2).attr("dy", narrow ? 0 : "0.32em")
                            .text(band.name);
                    }
                });
            }

            svg.append("g").attr("class", "grid")
                .attr("transform", "translate(" + m.left + ",0)")
                .call(d3.axisLeft(y).ticks(5).tickSize(-(width - m.left - m.right)).tickFormat(""));
            svg.append("g").attr("class", "axis y")
                .attr("transform", "translate(" + m.left + ",0)")
                .call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(8).tickFormat(cfg.yTick));
            svg.append("g").attr("class", "axis x")
                .attr("transform", "translate(0," + (height - m.bottom) + ")")
                .call(d3.axisBottom(x).ticks(cfg.xTicks || Math.max(2, Math.floor((width - m.left - m.right) / 90)))
                    .tickSize(0).tickPadding(10).tickFormat(cfg.xTick || null));

            if (cfg.now) {
                svg.append("line").attr("class", "now")
                    .attr("x1", x(cfg.now)).attr("x2", x(cfg.now))
                    .attr("y1", m.top).attr("y2", height - m.bottom);
                svg.append("text").attr("class", "now-label")
                    .attr("x", x(cfg.now) + 4).attr("y", m.top + 10).text("now");
            }
            // A zero line that means something (the river standing still), named on both sides.
            if (cfg.zero) {
                svg.append("line").attr("class", "zero")
                    .attr("x1", m.left).attr("x2", width - m.right).attr("y1", y(0)).attr("y2", y(0));
                svg.append("text").attr("class", "zero-label").attr("x", m.left + 6).attr("y", m.top + 10).text(cfg.zero.above);
                svg.append("text").attr("class", "zero-label").attr("x", m.left + 6).attr("y", height - m.bottom - 8).text(cfg.zero.below);
            }

            var line = d3.line().x(function (p) { return x(p.x); }).y(function (p) { return y(p.y); })
                .defined(function (p) { return p.y !== null && !isNaN(p.y); });
            series.forEach(function (s) {
                var g = svg.append("g").attr("class", "series " + s.cls);
                var past = s.forecastFrom ? s.points.filter(function (p) { return p.x <= s.forecastFrom; }) : s.points;
                var ahead = s.forecastFrom ? s.points.filter(function (p) { return p.x >= s.forecastFrom; }) : [];
                if (cfg.area && !s.forecastFrom) {
                    g.append("path").attr("class", "area")
                        .attr("d", d3.area().x(function (p) { return x(p.x); }).y0(y(y.domain()[0])).y1(function (p) { return y(p.y); })(s.points));
                }
                g.append("path").attr("class", "line").attr("d", line(past));
                if (ahead.length) g.append("path").attr("class", "line forecast").attr("d", line(ahead));
            });

            // End labels, spread so none overlap.
            if (cfg.endLabels) {
                var ends = series.map(function (s) {
                    var last = s.points.filter(function (p) { return p.y !== null; }).pop();
                    return { s: s, p: last, y0: y(last.y), y: y(last.y) };
                }).sort(function (a, b) { return a.y0 - b.y0; });
                var gap = 15;
                for (var i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + gap);
                var overflow = ends.length ? ends[ends.length - 1].y - (height - m.bottom) : 0;
                if (overflow > 0) {
                    ends[ends.length - 1].y -= overflow;
                    for (var j = ends.length - 2; j >= 0; j--) ends[j].y = Math.min(ends[j].y, ends[j + 1].y - gap);
                }
                var lg = svg.append("g").attr("class", "end-labels");
                ends.forEach(function (e) {
                    var x0 = x(e.p.x);
                    lg.append("circle").attr("class", "end-dot " + e.s.cls).attr("cx", x0).attr("cy", e.y0).attr("r", 4);
                    if (Math.abs(e.y - e.y0) > 2) {
                        lg.append("path").attr("class", "leader " + e.s.cls)
                            .attr("d", "M" + (x0 + 5) + "," + e.y0 + "L" + (x0 + 12) + "," + e.y + "L" + (x0 + 16) + "," + e.y);
                    }
                    var t = lg.append("text").attr("class", "end-label").attr("x", x0 + 18).attr("y", e.y).attr("dy", "0.32em");
                    t.append("tspan").attr("class", "v").text(cfg.endValue(e.p.y));
                    if (e.s.short) t.append("tspan").attr("class", "n").attr("dx", 5).text(e.s.short);
                });
            }

            // Crosshair: a hairline that snaps to the nearest stop, and one
            // readout for every series at that date.
            var cross = svg.append("g").attr("class", "cross").style("display", "none");
            cross.append("line").attr("y1", m.top).attr("y2", height - m.bottom);
            var dots = series.map(function (s) {
                return cross.append("circle").attr("class", "cross-dot " + s.cls).attr("r", 4);
            });
            var bis = d3.bisector(function (p) { return p.x; }).center;
            var index = primary.length - 1;
            function show(i) {
                index = Math.max(0, Math.min(primary.length - 1, i));
                var at = primary[index].x, px = x(at);
                cross.style("display", null);
                cross.select("line").attr("x1", px).attr("x2", px);
                var rows = [], topY = height;
                series.forEach(function (s, k) {
                    var p = s.points[bis(s.points, at)];
                    var near = p && Math.abs(p.x - at) <= (cfg.tolerance || 864e5 * 20) && p.y !== null;
                    dots[k].style("display", near ? null : "none");
                    if (!near) return;
                    dots[k].attr("cx", x(p.x)).attr("cy", y(p.y));
                    topY = Math.min(topY, y(p.y));
                    rows.push({ cls: s.cls, value: cfg.value(p.y, p), name: series.length > 1 ? s.name : (cfg.extra ? cfg.extra(p) : ""), dashed: s.forecastFrom && p.x > s.forecastFrom });
                });
                tip.show(px, topY, cfg.when(at), rows);
            }
            function hide() { cross.style("display", "none"); tip.hide(); }
            svg.append("rect").attr("class", "hit")
                .attr("x", m.left).attr("y", m.top)
                .attr("width", width - m.left - m.right).attr("height", height - m.top - m.bottom)
                .on("pointermove", function (ev) { show(bis(primary, x.invert(d3.pointer(ev)[0]))); })
                .on("pointerleave", hide);
            keyboard(svg, function () { return index; }, show, hide, primary.length);
        });
    }

    // Arrow keys step through the stops; focus shows the latest one.
    function keyboard(svg, get, show, hide, n) {
        svg.on("focus", function () { show(get()); })
            .on("blur", hide)
            .on("keydown", function (ev) {
                var step = ev.shiftKey ? 10 : 1;
                if (ev.key === "ArrowLeft") show(get() - step);
                else if (ev.key === "ArrowRight") show(get() + step);
                else if (ev.key === "Home") show(0);
                else if (ev.key === "End") show(n - 1);
                else if (ev.key === "Escape") hide();
                else return;
                ev.preventDefault();
            });
    }

    /* ---- Treasury -------------------------------------------------------- */

    function loadDebt() {
        var fig = figure("chart-debt");
        loading(fig);
        fiscal("/v2/accounting/od/debt_to_penny", {
            fields: "record_date,tot_pub_debt_out_amt,debt_held_public_amt,intragov_hold_amt",
            filter: "record_date:gte:2021-01-01",
            sort: "record_date",
            "page[size]": 5000
        }).then(function (rows) {
            var pts = rows.map(function (r) {
                return { x: parseDay(r.record_date), y: +r.tot_pub_debt_out_amt, pub: +r.debt_held_public_amt, intra: +r.intragov_hold_amt };
            });
            var last = pts[pts.length - 1];
            var yearAgo = pts[d3.bisector(function (p) { return p.x; }).left(pts, d3.timeYear.offset(last.x, -1))];
            var change = last.y - yearAgo.y;
            var perDay = change / ((last.x - yearAgo.x) / 864e5);

            var hero = document.getElementById("debt-hero");
            hero.querySelector(".value").textContent = penny(last.y);
            hero.querySelector(".note").textContent = "as of " + fmtDay(last.x) + " · " +
                (change >= 0 ? "up " : "down ") + dollars(Math.abs(change)) + " in a year, about " +
                dollars(Math.abs(perDay)) + " a day";
            setStat("stat-public", dollars(last.pub), Math.round(100 * last.pub / last.y) + "% of the total");
            setStat("stat-intragov", dollars(last.intra), "Social Security, Medicare and other trust funds");

            lineChart(fig, {
                label: "Total public debt outstanding, each business day since 2021",
                series: [{ name: "Total public debt", cls: "s-accent", points: pts }],
                area: true, endLabels: true,
                yTick: dollarsTick, xTick: d3.timeFormat("%Y"),
                endValue: function (v) { return "$" + (v / 1e12).toFixed(2) + "T"; },
                value: function (v) { return penny(v); },
                when: fmtDay, tolerance: 864e5 * 5
            });
            table(fig, [
                { name: "Month", value: function (p) { return fmtMonth(p.x); } },
                { name: "Last business day", value: function (p) { return fmtDay(p.x); } },
                { name: "Total public debt", num: true, value: function (p) { return penny(p.y); } }
            ], monthly(pts).reverse(), "The last business day of each month, newest first.");
        }).catch(function (e) {
            failed(fig, e, loadDebt);
            document.querySelector("#debt-hero .value").textContent = "—";
            document.querySelector("#debt-hero .note").textContent = "Treasury Fiscal Data didn't answer";
            failStat("stat-public"); failStat("stat-intragov");
        });
    }

    function loadCash() {
        var fig = figure("chart-tga");
        loading(fig);
        fiscal("/v1/accounting/dts/operating_cash_balance", {
            fields: "record_date,open_today_bal",
            // The closing balance is filed under open_today_bal: the DTS
            // table's columns are "today", "this month" and "this fiscal year".
            filter: "account_type:eq:Treasury General Account (TGA) Closing Balance,record_date:gte:" +
                d3.timeFormat("%Y-%m-%d")(d3.timeYear.offset(new Date(), -1)),
            sort: "record_date",
            "page[size]": 1000
        }).then(function (rows) {
            var pts = rows.map(function (r) { return { x: parseDay(r.record_date), y: +r.open_today_bal * 1e6 }; });
            var last = pts[pts.length - 1];
            var lo = d3.least(pts, function (p) { return p.y; }), hi = d3.greatest(pts, function (p) { return p.y; });
            setStat("stat-tga", dollars(last.y), "closing balance, " + fmtDay(last.x));
            lineChart(fig, {
                label: "The Treasury General Account's closing balance, each business day for the past year",
                series: [{ name: "Closing balance", cls: "s-accent", points: pts }],
                area: true, endLabels: true, yMin: 0,
                yTick: dollarsTick, xTick: d3.timeFormat("%b"),
                endValue: function (v) { return "$" + d3.format(",.0f")(v / 1e9) + "B"; },
                value: function (v) { return dollars(v); },
                when: fmtDay, tolerance: 864e5 * 5
            });
            table(fig, [
                { name: "Day", value: function (p) { return fmtDay(p.x); } },
                { name: "Closing balance", num: true, value: function (p) { return dollars(p.y); } }
            ], pts.slice().reverse(), "Every business day, newest first. The year's low was " +
                dollars(lo.y) + " on " + fmtDay(lo.x) + "; the high was " + dollars(hi.y) + " on " + fmtDay(hi.x) + ".");
        }).catch(function (e) { failed(fig, e, loadCash); failStat("stat-tga"); });
    }

    // Policy rates for the four banks, monthly, as CSV with the attributes left out.
    var BANKS = [
        { code: "US", name: "Federal Reserve", short: "Fed", cls: "s-1" },
        { code: "XM", name: "European Central Bank", short: "ECB", cls: "s-2" },
        { code: "GB", name: "Bank of England", short: "BoE", cls: "s-3" },
        { code: "JP", name: "Bank of Japan", short: "BoJ", cls: "s-4" }
    ];
    function bisRates() {
        return getJSON(BIS + "/M." + BANKS.map(function (b) { return b.code; }).join("+") +
            "?startPeriod=2015-01&detail=dataonly", { headers: { Accept: "application/vnd.sdmx.data+csv;version=1.0.0" } })
            .then(function (r) { return r.text(); })
            .then(function (text) {
                var byArea = d3.group(d3.csvParse(text), function (r) { return r.REF_AREA; });
                return BANKS.map(function (b) {
                    return Object.assign({}, b, {
                        points: (byArea.get(b.code) || []).map(function (r) {
                            return { x: parseMonth(r.TIME_PERIOD), y: r.OBS_VALUE === "" ? null : +r.OBS_VALUE };
                        }).sort(function (p, q) { return p.x - q.x; })
                    });
                });
            });
    }

    function loadRates() {
        var cost = figure("chart-cost"), banks = figure("chart-banks");
        loading(cost); loading(banks);
        var bis = bisRates();
        var avg = fiscal("/v2/accounting/od/avg_interest_rates", {
            fields: "record_date,avg_interest_rate_amt",
            filter: "security_desc:eq:Total Marketable,record_date:gte:2015-01-01",
            sort: "record_date",
            "page[size]": 1000
        }).then(function (rows) {
            // Month-end records, moved to the first of the month to line up with the BIS months.
            return rows.map(function (r) { return { x: d3.timeMonth(parseDay(r.record_date)), y: +r.avg_interest_rate_amt }; });
        });

        avg.then(function (pts) {
            var last = pts[pts.length - 1], yearAgo = pts[pts.length - 13];
            var bp = Math.round((last.y - yearAgo.y) * 100);
            setStat("stat-rate", pct(last.y), fmtMonth(last.x) + " · " + (bp === 0 ? "unchanged" : (bp > 0 ? "up " : "down ") + Math.abs(bp) + " basis points") + " in a year");
        }).catch(function () { failStat("stat-rate"); });

        Promise.all([avg, bis]).then(function (res) {
            var pts = res[0], fed = res[1][0].points;
            legend(cost, [
                { name: "Average rate on the Treasury's marketable debt", cls: "s-accent" },
                { name: "Fed policy rate (middle of the target range)", cls: "s-context" }
            ]);
            lineChart(cost, {
                label: "The average interest rate on the Treasury's marketable debt and the Fed's policy rate, monthly since 2015",
                series: [
                    { name: "Treasury pays", short: "paid", cls: "s-accent", points: pts },
                    { name: "Fed rate", short: "Fed", cls: "s-context", points: fed }
                ],
                endLabels: true, yMin: 0,
                yTick: pctTick, xTick: d3.timeFormat("%Y"),
                endValue: pct, value: pct, when: fmtMonth
            });
            var fedBy = new Map(fed.map(function (p) { return [+p.x, p.y]; }));
            table(cost, [
                { name: "Month", value: function (p) { return fmtMonth(p.x); } },
                { name: "Treasury's average rate", num: true, value: function (p) { return pct(p.y); } },
                { name: "Fed policy rate", num: true, value: function (p) { var v = fedBy.get(+p.x); return v === undefined || v === null ? "—" : pct(v); } }
            ], pts.slice().reverse(), "Newest first.");
        }).catch(function (e) { failed(cost, e, loadRates); });

        bis.then(function (series) {
            legend(banks, series.map(function (s) { return { name: s.name, cls: s.cls }; }));
            lineChart(banks, {
                label: "Policy rates of the Federal Reserve, European Central Bank, Bank of England and Bank of Japan, monthly since 2015",
                series: series,
                endLabels: true,
                yTick: pctTick, xTick: d3.timeFormat("%Y"),
                endValue: pct, value: pct, when: fmtMonth
            });
            var months = series[0].points;
            var maps = series.map(function (s) { return new Map(s.points.map(function (p) { return [+p.x, p.y]; })); });
            table(banks, [{ name: "Month", value: function (p) { return fmtMonth(p.x); } }].concat(series.map(function (s, k) {
                return { name: s.short, num: true, value: function (p) { var v = maps[k].get(+p.x); return v === undefined || v === null ? "—" : pct(v); } };
            })), months.slice().reverse(), "End-of-month policy rates, newest first.");
        }).catch(function (e) { failed(banks, e, loadRates); });
    }

    /* ---- Portland -------------------------------------------------------- */

    // WMO weather codes, as Open-Meteo reports them.
    function weatherWords(code) {
        if (code === 0) return "clear";
        if (code === 1) return "mostly clear";
        if (code === 2) return "partly cloudy";
        if (code === 3) return "overcast";
        if (code === 45 || code === 48) return "fog";
        if (code >= 51 && code <= 57) return "drizzle";
        if (code >= 61 && code <= 67) return "rain";
        if (code >= 71 && code <= 77) return "snow";
        if (code >= 80 && code <= 82) return "showers";
        if (code === 85 || code === 86) return "snow showers";
        if (code >= 95) return "thunderstorms";
        return "";
    }

    function loadWeather() {
        var fig = figure("chart-temp");
        loading(fig);
        var url = "https://api.open-meteo.com/v1/forecast?latitude=" + PDX.lat + "&longitude=" + PDX.lon +
            "&current=temperature_2m,weather_code,wind_speed_10m" +
            "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,weather_code" +
            "&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch" +
            "&timezone=" + encodeURIComponent(PDX.tz) + "&past_days=7&forecast_days=8";
        getJSON(url).then(function (r) { return r.json(); }).then(function (j) {
            var c = j.current;
            setStat("stat-weather", Math.round(c.temperature_2m) + "°F",
                [weatherWords(c.weather_code), "wind " + Math.round(c.wind_speed_10m) + " mph"].filter(Boolean).join(" · "));
            var today = d3.timeDay(parseLocal(c.time));
            var days = j.daily.time.map(function (t, i) {
                return {
                    x: parseDay(t), hi: j.daily.temperature_2m_max[i], lo: j.daily.temperature_2m_min[i],
                    rainChance: j.daily.precipitation_probability_max[i], rain: j.daily.precipitation_sum[i],
                    words: weatherWords(j.daily.weather_code[i])
                };
            }).filter(function (d) { return d.hi !== null && d.lo !== null; });
            days.forEach(function (d) { d.when = +d.x < +today ? "past" : +d.x === +today ? "today" : "ahead"; });
            legend(fig, [
                { name: "past week", cls: "s-context", shape: "bar" },
                { name: "today and the forecast", cls: "s-accent", shape: "bar" }
            ]);
            rangeChart(fig, days, today);
            table(fig, [
                { name: "Day", value: function (d) { return fmtWeekday(d.x) + (d.when === "today" ? " (today)" : ""); } },
                { name: "High", num: true, value: function (d) { return Math.round(d.hi) + "°"; } },
                { name: "Low", num: true, value: function (d) { return Math.round(d.lo) + "°"; } },
                { name: "Rain", num: true, value: function (d) { return d.when === "past" ? d.rain.toFixed(2) + " in" : (d.rainChance === null ? "—" : d.rainChance + "% chance"); } },
                { name: "Sky", value: function (d) { return d.words; } }
            ], days, "Past days show the rain that fell; the forecast shows the chance of rain.");
        }).catch(function (e) { failed(fig, e, loadWeather); failStat("stat-weather"); });
    }

    // Each day is a column from its low to its high: rounded at both ends, as
    // neither end is a baseline.
    function rangeChart(fig, days, today) {
        var height = 240;
        onWidth(fig, function () {
            var width = fig.plot.clientWidth;
            if (!width) return;
            var m = { top: 22, right: 12, bottom: 30, left: 44 };
            var x = d3.scaleBand().domain(days.map(function (d) { return +d.x; }))
                .range([m.left, width - m.right]).paddingInner(0.2);
            var y = d3.scaleLinear()
                .domain([d3.min(days, function (d) { return d.lo; }) - 4, d3.max(days, function (d) { return d.hi; }) + 4]).nice()
                .range([height - m.bottom, m.top]);
            var bw = Math.min(24, x.bandwidth());
            fig.plot.textContent = "";
            var svg = d3.select(fig.plot).append("svg")
                .attr("viewBox", [0, 0, width, height]).attr("width", width).attr("height", height)
                .attr("tabindex", 0).attr("role", "img")
                .attr("aria-label", "Daily high and low temperatures in Portland, the past week and the week ahead. Use the arrow keys to read each day; the table below has them all.");
            var tip = tooltip(fig.plot);
            svg.append("g").attr("class", "grid").attr("transform", "translate(" + m.left + ",0)")
                .call(d3.axisLeft(y).ticks(5).tickSize(-(width - m.left - m.right)).tickFormat(""));
            svg.append("g").attr("class", "axis y").attr("transform", "translate(" + m.left + ",0)")
                .call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(8).tickFormat(function (v) { return v + "°"; }));
            var every = width < 520 ? 2 : 1;
            var todayAt = days.findIndex(function (d) { return +d.x === +today; });
            svg.append("g").attr("class", "axis x").attr("transform", "translate(0," + (height - m.bottom) + ")")
                .call(d3.axisBottom(x).tickSize(0).tickPadding(10).tickFormat(function (v, i) {
                    var d = new Date(v);
                    if (+d === +today) return "today";
                    return (i - todayAt) % every ? "" : d3.timeFormat(width < 520 ? "%-d" : "%a %-d")(d);
                }));
            var cols = svg.append("g").selectAll("g").data(days).join("g")
                .attr("class", function (d) { return "day " + (d.when === "past" ? "s-context" : "s-accent") + (d.when === "today" ? " today" : ""); });
            cols.append("rect").attr("class", "bar")
                .attr("x", function (d) { return x(+d.x) + (x.bandwidth() - bw) / 2; }).attr("width", bw)
                .attr("y", function (d) { return y(d.hi); })
                .attr("height", function (d) { return Math.max(bw, y(d.lo) - y(d.hi)); })
                .attr("rx", Math.min(4, bw / 2));
            // Today's high and low are labelled; the axis and the table carry the rest.
            var t = days.filter(function (d) { return d.when === "today"; })[0];
            if (t) {
                var cx = x(+t.x) + x.bandwidth() / 2;
                svg.append("text").attr("class", "end-label").attr("text-anchor", "middle")
                    .attr("x", cx).attr("y", y(t.hi) - 6).text(Math.round(t.hi) + "°");
                svg.append("text").attr("class", "end-label").attr("text-anchor", "middle")
                    .attr("x", cx).attr("y", y(t.lo) + 15).text(Math.round(t.lo) + "°");
            }
            var index = days.indexOf(t) >= 0 ? days.indexOf(t) : days.length - 1;
            function show(i) {
                index = Math.max(0, Math.min(days.length - 1, i));
                var d = days[index];
                cols.classed("hover", function (e) { return e === d; });
                tip.show(x(+d.x) + x.bandwidth() / 2, y(d.hi), fmtWeekday(d.x) + (d.when === "today" ? " (today)" : d.when === "ahead" ? " (forecast)" : ""), [
                    { cls: d.when === "past" ? "s-context" : "s-accent", value: Math.round(d.hi) + "° / " + Math.round(d.lo) + "°", name: "high / low" },
                    { value: d.when === "past" ? d.rain.toFixed(2) + " in" : (d.rainChance === null ? "—" : d.rainChance + "%"), name: d.when === "past" ? "of rain" : "chance of rain" },
                    { value: d.words, name: "" }
                ]);
            }
            function hide() { cols.classed("hover", false); tip.hide(); }
            // The whole column is the hit target, not just the painted bar.
            cols.append("rect").attr("class", "hit")
                .attr("x", function (d) { return x(+d.x) - x.step() * x.paddingInner() / 2; }).attr("width", x.step())
                .attr("y", m.top).attr("height", height - m.top - m.bottom)
                .on("pointerenter", function (ev, d) { show(days.indexOf(d)); })
                .on("pointerleave", hide);
            keyboard(svg, function () { return index; }, show, hide, days.length);
        });
    }

    // The EPA's AQI categories, worn as background bands with their own labels.
    var AQI = [
        { from: 0, to: 50, name: "good", cls: "aqi-good" },
        { from: 50, to: 100, name: "moderate", cls: "aqi-moderate" },
        { from: 100, to: 150, name: "unhealthy for some", cls: "aqi-usg" },
        { from: 150, to: 200, name: "unhealthy", cls: "aqi-unhealthy" },
        { from: 200, to: 300, name: "very unhealthy", cls: "aqi-very" },
        { from: 300, to: 500, name: "hazardous", cls: "aqi-hazardous" }
    ];
    function aqiBand(v) { return AQI.filter(function (b) { return v <= b.to; })[0] || AQI[AQI.length - 1]; }

    function loadAir() {
        var fig = figure("chart-air");
        loading(fig);
        var url = "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=" + PDX.lat + "&longitude=" + PDX.lon +
            "&current=us_aqi,pm2_5&hourly=us_aqi,pm2_5&timezone=" + encodeURIComponent(PDX.tz) + "&past_days=3&forecast_days=4";
        getJSON(url).then(function (r) { return r.json(); }).then(function (j) {
            var now = parseLocal(j.current.time);
            var band = aqiBand(j.current.us_aqi);
            var note = el("span");
            note.appendChild(el("span", "status-dot " + band.cls));
            note.appendChild(document.createTextNode(band.name + " · PM2.5 " + d3.format(".1f")(j.current.pm2_5) + " µg/m³"));
            setStat("stat-air", "AQI " + j.current.us_aqi, note);
            var pts = j.hourly.time.map(function (t, i) {
                return { x: parseLocal(t), y: j.hourly.us_aqi[i], pm: j.hourly.pm2_5[i] };
            }).filter(function (p) { return p.y !== null && p.x <= d3.timeHour.offset(now, 72); });
            legend(fig, [
                { name: "measured by the model", cls: "s-accent" },
                { name: "forecast", cls: "s-accent", dashed: true }
            ]);
            var top = d3.max(pts, function (p) { return p.y; });
            lineChart(fig, {
                label: "US air quality index in Portland, hourly, the past three days and the next three",
                series: [{ name: "US AQI", cls: "s-accent", points: pts, forecastFrom: now }],
                bands: AQI, yMin: 0, yMax: aqiBand(Math.max(top, 60)).to, now: now, endLabels: true, leftMargin: 40,
                yTick: d3.format("d"), xTick: d3.timeFormat("%a"), xTicks: d3.timeDay,
                endValue: function () { return ""; },
                value: function (v) { return "AQI " + v; },
                extra: function (p) { return aqiBand(p.y).name + " · PM2.5 " + d3.format(".1f")(p.pm); },
                when: fmtHour, tolerance: 36e5
            });
            table(fig, [
                { name: "Hour", value: function (p) { return fmtHour(p.x) + (p.x > now ? " (forecast)" : ""); } },
                { name: "US AQI", num: true, value: function (p) { return p.y; } },
                { name: "Category", value: function (p) { return aqiBand(p.y).name; } },
                { name: "PM2.5 (µg/m³)", num: true, value: function (p) { return p.pm === null ? "—" : d3.format(".1f")(p.pm); } }
            ], pts.filter(function (p, i) { return i % 3 === 0; }), "Every third hour, Portland time.");
        }).catch(function (e) { failed(fig, e, loadAir); failStat("stat-air"); });
    }

    // A few places, so the dots have somewhere to be. Approximate centres.
    var PLACES = [
        { name: "downtown", lat: 45.5165, lon: -122.6795 },
        { name: "Pearl", lat: 45.5300, lon: -122.6845 },
        { name: "Lloyd", lat: 45.5320, lon: -122.6560 },
        { name: "Alberta", lat: 45.5590, lon: -122.6440 },
        { name: "Hawthorne", lat: 45.5120, lon: -122.6250 },
        { name: "Sellwood", lat: 45.4655, lon: -122.6525 },
        { name: "St. Johns", lat: 45.5900, lon: -122.7535 }
    ];

    function loadBikes() {
        var fig = figure("chart-bikes");
        loading(fig);
        Promise.all(["station_information", "station_status", "free_bike_status"].map(function (f) {
            return getJSON(GBFS + "/" + f + ".json").then(function (r) { return r.json(); });
        })).then(function (res) {
            var status = new Map(res[1].data.stations.map(function (s) { return [s.station_id, s]; }));
            var stations = res[0].data.stations.map(function (s) {
                var st = status.get(s.station_id) || {};
                return { name: s.name, lat: s.lat, lon: s.lon, capacity: s.capacity, bikes: st.num_bikes_available || 0, docks: st.num_docks_available || 0, renting: st.is_renting === 1 };
            }).filter(function (s) { return s.renting; });
            var free = res[2].data.bikes.filter(function (b) { return !b.is_disabled && !b.is_reserved; });
            var atStations = d3.sum(stations, function (s) { return s.bikes; });
            setStat("stat-bikes", comma(atStations + free.length), comma(free.length) + " parked anywhere, " + comma(atStations) + " at " + stations.length + " stations");
            legend(fig, [
                { name: "a bike parked anywhere", cls: "s-accent", shape: "dot" },
                { name: "a station, sized by the bikes in it", cls: "s-station", shape: "ring" }
            ]);
            bikeMap(fig, stations, free);
            table(fig, [
                { name: "Station", value: function (s) { return s.name; } },
                { name: "Bikes", num: true, value: function (s) { return s.bikes; } },
                { name: "Free docks", num: true, value: function (s) { return s.docks; } }
            ], stations.slice().sort(function (a, b) { return b.bikes - a.bikes || d3.ascending(a.name, b.name); }),
                "Stations that are renting, most bikes first. The " + comma(free.length) + " bikes parked away from a station are on the map only.");
        }).catch(function (e) { failed(fig, e, loadBikes); failStat("stat-bikes"); });
    }

    function bikeMap(fig, stations, free) {
        // Fit to the stations, with room around them; a bike ridden far out
        // of town is left off rather than shrinking the city to fit it.
        var box = {
            type: "MultiPoint",
            coordinates: stations.map(function (s) { return [s.lon, s.lat]; })
        };
        onWidth(fig, function () {
            var width = fig.plot.clientWidth;
            if (!width) return;
            var height = Math.round(Math.min(560, Math.max(360, width * 0.8)));
            var proj = d3.geoMercator().fitExtent([[16, 16], [width - 16, height - 16]], box);
            var r = d3.scaleSqrt().domain([0, d3.max(stations, function (s) { return s.bikes; }) || 1]).range([2, width < 520 ? 7 : 10]);
            fig.plot.textContent = "";
            var svg = d3.select(fig.plot).append("svg")
                .attr("viewBox", [0, 0, width, height]).attr("width", width).attr("height", height)
                .attr("tabindex", 0).attr("role", "img")
                .attr("aria-label", "Map of every BIKETOWN bike in Portland right now, and every station sized by its bikes. Use the arrow keys to step through stations; the table below lists them.");
            var tip = tooltip(fig.plot);
            var inside = free.filter(function (b) {
                var p = proj([b.lon, b.lat]);
                return p[0] >= 0 && p[0] <= width && p[1] >= 0 && p[1] <= height;
            });
            svg.append("g").attr("class", "free s-accent").selectAll("circle").data(inside).join("circle")
                .attr("cx", function (b) { return proj([b.lon, b.lat])[0]; })
                .attr("cy", function (b) { return proj([b.lon, b.lat])[1]; })
                .attr("r", width < 520 ? 1.6 : 2);
            var sorted = stations.slice().sort(function (a, b) { return b.bikes - a.bikes; });
            var rings = svg.append("g").attr("class", "stations s-station").selectAll("circle").data(sorted).join("circle")
                .attr("cx", function (s) { return proj([s.lon, s.lat])[0]; })
                .attr("cy", function (s) { return proj([s.lon, s.lat])[1]; })
                .attr("r", function (s) { return r(s.bikes); });
            svg.append("g").attr("class", "places").selectAll("text").data(PLACES).join("text")
                .attr("x", function (p) { return proj([p.lon, p.lat])[0]; })
                .attr("y", function (p) { return proj([p.lon, p.lat])[1]; })
                .attr("text-anchor", "middle").text(function (p) { return p.name; });
            // Nearest station to the pointer, within 24px: nobody has to land on a 2px ring.
            var pos = sorted.map(function (s) { return proj([s.lon, s.lat]); });
            var delaunay = d3.Delaunay.from(pos);
            var index = 0;
            function show(i) {
                index = (i + sorted.length) % sorted.length;
                var s = sorted[index], p = pos[index];
                rings.classed("hover", function (d) { return d === s; });
                tip.show(p[0], p[1] - r(s.bikes), s.name, [
                    { cls: "s-station", value: s.bikes + (s.bikes === 1 ? " bike" : " bikes"), name: "" },
                    { value: s.docks + (s.docks === 1 ? " free dock" : " free docks"), name: "" }
                ]);
            }
            function hide() { rings.classed("hover", false); tip.hide(); }
            svg.on("pointermove", function (ev) {
                var p = d3.pointer(ev), i = delaunay.find(p[0], p[1]);
                if (Math.hypot(pos[i][0] - p[0], pos[i][1] - p[1]) <= 24) show(i); else hide();
            }).on("pointerleave", hide);
            keyboard(svg, function () { return index; }, show, hide, sorted.length);
        });
    }

    function km(lat1, lon1, lat2, lon2) {
        var rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLon = (lon2 - lon1) * rad;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function loadQuakes() {
        var fig = figure("chart-quakes");
        loading(fig);
        var start = d3.timeDay.offset(new Date(), -30);
        var url = "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time-asc&minmagnitude=1" +
            "&latitude=" + PDX.lat + "&longitude=" + PDX.lon + "&maxradiuskm=400&starttime=" + start.toISOString().slice(0, 19);
        getJSON(url).then(function (r) { return r.json(); }).then(function (j) {
            var quakes = j.features.filter(function (f) { return f.properties.mag !== null; }).map(function (f) {
                var c = f.geometry.coordinates;
                return { x: new Date(f.properties.time), mag: f.properties.mag, place: f.properties.place || "unnamed place", depth: c[2], away: km(PDX.lat, PDX.lon, c[1], c[0]), url: f.properties.url };
            });
            var big = d3.greatest(quakes, function (q) { return q.mag; });
            setStat("stat-quakes", comma(quakes.length), big ? "largest M" + big.mag.toFixed(1) + ", " + big.place : "none above magnitude 1");
            quakeChart(fig, quakes, start, big);
            table(fig, [
                { name: "When (Portland time)", value: function (q) { return q.x.toLocaleString("en-US", { timeZone: PDX.tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); } },
                { name: "Magnitude", num: true, value: function (q) { return q.mag.toFixed(1); } },
                { name: "Where", value: function (q) { return q.place; } },
                { name: "From Portland", num: true, value: function (q) { return Math.round(q.away) + " km"; } },
                { name: "Depth", num: true, value: function (q) { return d3.format(".1f")(q.depth) + " km"; } }
            ], quakes.slice().sort(function (a, b) { return b.mag - a.mag || b.x - a.x; }), "Largest first.");
        }).catch(function (e) { failed(fig, e, loadQuakes); failStat("stat-quakes"); });
    }

    function quakeChart(fig, quakes, start, big) {
        var height = 240;
        onWidth(fig, function () {
            var width = fig.plot.clientWidth;
            if (!width) return;
            var m = { top: 24, right: 16, bottom: 28, left: 40 };
            var x = d3.scaleTime().domain([start, new Date()]).range([m.left, width - m.right]);
            var y = d3.scaleLinear().domain([1, Math.max(4, Math.ceil(d3.max(quakes, function (q) { return q.mag; }) || 4))])
                .range([height - m.bottom, m.top]);
            // Area grows with magnitude, so a 4 reads as much bigger than a 2.
            var r = function (mag) { return 4 + Math.max(0, mag - 1) * 2.2; };
            fig.plot.textContent = "";
            var svg = d3.select(fig.plot).append("svg")
                .attr("viewBox", [0, 0, width, height]).attr("width", width).attr("height", height)
                .attr("tabindex", 0).attr("role", "img")
                .attr("aria-label", "Earthquakes within 400 km of Portland in the past 30 days, by time and magnitude. Use the arrow keys to step through them; the table below lists them all.");
            var tip = tooltip(fig.plot);
            svg.append("g").attr("class", "grid").attr("transform", "translate(" + m.left + ",0)")
                .call(d3.axisLeft(y).ticks(y.domain()[1] - 1).tickSize(-(width - m.left - m.right)).tickFormat(""));
            svg.append("g").attr("class", "axis y").attr("transform", "translate(" + m.left + ",0)")
                .call(d3.axisLeft(y).ticks(y.domain()[1] - 1).tickSize(0).tickPadding(8).tickFormat(function (v) { return "M" + v; }));
            svg.append("g").attr("class", "axis x").attr("transform", "translate(0," + (height - m.bottom) + ")")
                .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(width / 110))).tickSize(0).tickPadding(10).tickFormat(d3.timeFormat("%b %-d")));
            var order = quakes.slice().sort(function (a, b) { return a.mag - b.mag; });  // small ones underneath
            var dots = svg.append("g").attr("class", "quakes s-accent").selectAll("circle").data(order).join("circle")
                .attr("cx", function (q) { return x(q.x); }).attr("cy", function (q) { return y(q.mag); })
                .attr("r", function (q) { return r(q.mag); });
            // The largest is labelled on whichever side has room; with room on
            // neither, just its magnitude (the tooltip and table have the place).
            if (big) {
                var bx = x(big.x), gap = r(big.mag) + 6;
                var label = svg.append("text").attr("class", "end-label").attr("y", y(big.mag)).attr("dy", "0.32em")
                    .text("M" + big.mag.toFixed(1) + ", " + big.place);
                var tw = label.node().getComputedTextLength();
                var right = width - m.right - (bx + gap), left = bx - gap - m.left;
                if (tw > right && tw > left) label.text("M" + big.mag.toFixed(1));
                var onLeft = tw > right && left > right;
                label.attr("text-anchor", onLeft ? "end" : "start").attr("x", bx + (onLeft ? -gap : gap));
            }
            var byTime = quakes.slice().sort(function (a, b) { return a.x - b.x; });
            var pos = byTime.map(function (q) { return [x(q.x), y(q.mag)]; });
            var delaunay = d3.Delaunay.from(pos);
            var index = byTime.length - 1;
            function show(i) {
                if (!byTime.length) return;
                index = Math.max(0, Math.min(byTime.length - 1, i));
                var q = byTime[index];
                dots.classed("hover", function (d) { return d === q; });
                tip.show(pos[index][0], pos[index][1] - r(q.mag), q.place, [
                    { cls: "s-accent", value: "M" + q.mag.toFixed(1), name: q.x.toLocaleString("en-US", { timeZone: PDX.tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) },
                    { value: Math.round(q.away) + " km", name: "from Portland, " + d3.format(".0f")(q.depth) + " km deep" }
                ]);
            }
            function hide() { dots.classed("hover", false); tip.hide(); }
            svg.on("pointermove", function (ev) {
                if (!byTime.length) return;
                var p = d3.pointer(ev), i = delaunay.find(p[0], p[1]);
                if (Math.hypot(pos[i][0] - p[0], pos[i][1] - p[1]) <= 24) show(i); else hide();
            }).on("pointerleave", hide);
            keyboard(svg, function () { return index; }, show, hide, byTime.length);
        });
    }

    /* ---- Portland's rivers and alerts ------------------------------------ */

    var parseUTC = d3.utcParse("%Y-%m-%d %H:%M");
    var fmtWhen = function (d) {
        return d.toLocaleString("en-US", { timeZone: PDX.tz, weekday: "short", hour: "numeric", minute: "2-digit" });
    };

    // USGS reports the Willamette's flow at Portland as negative when the
    // tide is pushing it upstream.
    function loadWillamette() {
        var fig = figure("chart-willamette");
        loading(fig);
        getJSON("https://waterservices.usgs.gov/nwis/iv/?format=json&sites=14211720&parameterCd=00060,00065&period=P3D")
            .then(function (r) { return r.json(); }).then(function (j) {
                var byCode = {};
                j.value.timeSeries.forEach(function (ts) {
                    var nodata = ts.variable.noDataValue;
                    byCode[ts.variable.variableCode[0].value] = ts.values[0].value
                        .map(function (v) { return { x: new Date(v.dateTime), y: +v.value }; })
                        .filter(function (p) { return p.y !== nodata && !isNaN(p.y); });
                });
                var flow = byCode["00060"] || [], stage = byCode["00065"] || [];
                if (!flow.length) throw new Error("no flow readings");
                var now = flow[flow.length - 1];
                var up = flow.filter(function (p) { return p.y < 0; }).length / flow.length;
                setStat("stat-river", comma(Math.abs(now.y)) + " ft³/s",
                    (now.y < 0 ? "flowing upstream" : "flowing downstream") +
                    (stage.length ? " · " + stage[stage.length - 1].y.toFixed(1) + " ft at the gauge" : "") +
                    " · " + fmtWhen(now.x));
                lineChart(fig, {
                    label: "Flow of the Willamette River at Portland every 15 minutes for three days; below zero it is flowing upstream",
                    series: [{ name: "Flow", cls: "s-accent", points: flow }],
                    endLabels: true, zero: { above: "↑ downstream, to the Columbia", below: "↓ upstream, pushed by the tide" },
                    yTick: function (v) { return d3.format(",")(v / 1000) + "k"; }, xTick: d3.timeFormat("%a"), xTicks: d3.timeDay,
                    endValue: function (v) { return d3.format(",.1f")(v / 1000) + "k"; },
                    value: function (v) { return comma(Math.abs(v)) + " ft³/s"; },
                    extra: function (p) { return p.y < 0 ? "upstream" : "downstream"; },
                    when: fmtWhen, tolerance: 18e5
                });
                table(fig, [
                    { name: "Time (Portland)", value: function (p) { return fmtWhen(p.x); } },
                    { name: "Flow (ft³/s)", num: true, value: function (p) { return comma(p.y); } },
                    { name: "Direction", value: function (p) { return p.y < 0 ? "upstream" : "downstream"; } }
                ], flow.filter(function (p, i) { return i % 4 === 0; }).reverse(),
                    "Hourly, newest first; negative flow is upstream. Over these three days it ran upstream " + Math.round(up * 100) + "% of the time.");
            }).catch(function (e) { failed(fig, e, loadWillamette); failStat("stat-river"); });
    }

    function loadColumbia() {
        var fig = figure("chart-columbia");
        loading(fig);
        var base = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=9440083&datum=MLLW&units=english&time_zone=gmt&format=json&application=rickseufert.com";
        var from = d3.utcFormat("%Y%m%d %H:%M")(d3.utcHour.offset(new Date(), -72));
        Promise.all([
            getJSON(base + "&product=water_level&date=recent").then(function (r) { return r.json(); }),
            getJSON(base + "&product=predictions&interval=30&begin_date=" + encodeURIComponent(from) + "&range=120").then(function (r) { return r.json(); })
        ]).then(function (res) {
            if (res[0].error || res[1].error) throw new Error((res[0].error || res[1].error).message);
            var observed = res[0].data.map(function (d) { return { x: parseUTC(d.t), y: d.v === "" ? null : +d.v }; })
                .filter(function (p) { return p.y !== null; });
            var predicted = res[1].predictions.map(function (d) { return { x: parseUTC(d.t), y: +d.v }; });
            var now = observed[observed.length - 1].x;
            legend(fig, [
                { name: "measured", cls: "s-accent" },
                { name: "the tide tables' prediction", cls: "s-context" }
            ]);
            lineChart(fig, {
                label: "Columbia River water level at Vancouver, measured for three days and predicted for two more",
                // The prediction runs past now, so its points are the crosshair's stops.
                series: [
                    { name: "predicted", short: "tide", cls: "s-context", points: predicted },
                    { name: "measured", short: "now", cls: "s-accent", points: observed }
                ],
                now: now, endLabels: true,
                yTick: function (v) { return d3.format(".1f")(v) + " ft"; }, xTick: d3.timeFormat("%a"), xTicks: d3.timeDay,
                endValue: function (v) { return d3.format(".1f")(v) + " ft"; },
                value: function (v) { return d3.format(".2f")(v) + " ft"; },
                when: fmtWhen, tolerance: 18e5
            });
            var obsBy = new Map(observed.map(function (p) { return [+p.x, p.y]; }));
            table(fig, [
                { name: "Time (Portland)", value: function (p) { return fmtWhen(p.x); } },
                { name: "Predicted", num: true, value: function (p) { return d3.format(".2f")(p.y) + " ft"; } },
                { name: "Measured", num: true, value: function (p) { var v = obsBy.get(+p.x); return v === undefined ? "—" : d3.format(".2f")(v) + " ft"; } }
            ], predicted.filter(function (p, i) { return i % 2 === 0; }), "Hourly. Measured levels are shown where a reading falls on the hour.");
        }).catch(function (e) { failed(fig, e, loadColumbia); });
    }

    // A banner only when the National Weather Service has something active for downtown.
    function loadAlerts() {
        getJSON("https://api.weather.gov/alerts/active?point=" + PDX.lat + "," + PDX.lon, { headers: { Accept: "application/geo+json" } })
            .then(function (r) { return r.json(); }).then(function (j) {
                var box = document.getElementById("nws-alerts");
                box.textContent = "";
                if (!j.features.length) { box.hidden = true; return; }
                j.features.forEach(function (f) {
                    var a = f.properties;
                    var row = el("p", "alert");
                    row.appendChild(el("strong", "", a.event));
                    row.appendChild(document.createTextNode(" " + (a.headline || "")));
                    box.appendChild(row);
                });
                var src = el("p", "source");
                var link = el("a", "", "National Weather Service");
                link.href = "https://forecast.weather.gov/MapClick.php?lat=" + PDX.lat + "&lon=" + PDX.lon;
                src.appendChild(document.createTextNode("active alerts from the "));
                src.appendChild(link);
                box.appendChild(src);
                box.hidden = false;
            }).catch(function (e) { if (window.console) console.warn("alerts", e); });
    }

    /* ---- Sky ------------------------------------------------------------- */

    var AU_KM = 149597870.7, LD_AU = 384400 / AU_KM;
    var parseJPL = d3.utcParse("%Y-%b-%d %H:%M");
    var parseFireball = d3.utcParse("%Y-%m-%d %H:%M:%S");
    // Diameter from absolute magnitude H for a given albedo (Pravec & Harris 2007).
    function diameterM(h, albedo) { return 1329 / Math.sqrt(albedo) * Math.pow(10, -h / 5) * 1000; }
    function metres(v) { return v >= 1000 ? d3.format(".2~")(v / 1000) + " km" : d3.format(".2~r")(v) + " m"; }

    // The nightly copy lives on the sky-data branch (master is protected, so
    // the workflow cannot commit there); GitHub's raw file server answers
    // browsers on any site. The copy on master is the fallback.
    var sky = getJSON("https://raw.githubusercontent.com/rseufert/rseufert.github.io/sky-data/sky.json")
        .then(function (r) { return r.json(); })
        .catch(function () { return getJSON("/data/sky.json").then(function (r) { return r.json(); }); });

    function loadAsteroids() {
        var fig = figure("chart-asteroids");
        loading(fig);
        sky.then(function (s) {
            var f = s.approaches.fields;
            var rows = s.approaches.data.map(function (r) {
                var o = {}; f.forEach(function (k, i) { o[k] = r[i]; }); return o;
            }).map(function (o) {
                var h = +o.h;
                return { name: o.des, x: parseJPL(o.cd), ld: +o.dist / LD_AU, km: +o.dist * AU_KM, v: +o.v_rel, h: h,
                         d: diameterM(h, 0.14), dLo: diameterM(h, 0.25), dHi: diameterM(h, 0.05) };
            });
            var now = new Date();
            var ahead = rows.filter(function (r) { return r.x >= now; });
            var next = ahead[0];
            if (next) {
                setStat("stat-flyby", next.name, next.x.toLocaleString("en-US", { timeZone: PDX.tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) +
                    " · " + comma(Math.round(next.km / 1000) * 1000) + " km (" + d3.format(".2~")(next.ld) + " lunar distances) · about " + metres(next.d) + " across");
            } else failStat("stat-flyby");
            var inside = ahead.filter(function (r) { return r.ld < 1; });
            var closest = d3.least(inside, function (r) { return r.ld; });
            setStat("stat-moon", comma(inside.length), closest ? "closest " + closest.name + ", " + comma(Math.round(closest.km / 1000) * 1000) + " km, " + fmtWeekday(closest.x) : "none known yet");
            legend(fig, [{ name: "an asteroid, sized by its estimated diameter", cls: "s-accent", shape: "dot" }]);
            asteroidChart(fig, rows, now, s.fetched);
            table(fig, [
                { name: "Asteroid", value: function (r) { return r.name; } },
                { name: "Closest approach (UTC)", value: function (r) { return d3.utcFormat("%b %-d, %H:%M")(r.x); } },
                { name: "Distance", num: true, value: function (r) { return comma(Math.round(r.km)) + " km"; } },
                { name: "Lunar distances", num: true, value: function (r) { return d3.format(".2f")(r.ld); } },
                { name: "Speed", num: true, value: function (r) { return d3.format(".1f")(r.v) + " km/s"; } },
                { name: "Estimated size", num: true, value: function (r) { return metres(r.dLo) + "–" + metres(r.dHi); } }
            ], rows, "Saved from JPL at " + s.fetched + ". Sizes span reflectivities from 25% (smaller) to 5% (larger).");
        }).catch(function (e) { failed(fig, e, loadAsteroids); failStat("stat-flyby"); failStat("stat-moon"); });
    }

    function asteroidChart(fig, rows, now, fetched) {
        var height = 280;
        onWidth(fig, function () {
            var width = fig.plot.clientWidth;
            if (!width) return;
            var m = { top: 26, right: 16, bottom: 28, left: 44 };
            var x = d3.scaleTime().domain(d3.extent(rows, function (r) { return r.x; })).nice(d3.timeWeek)
                .range([m.left, width - m.right]);
            var y = d3.scaleLinear().domain([0, 20]).range([height - m.bottom, m.top]);
            var r = d3.scaleSqrt().domain([0, d3.max(rows, function (d) { return d.d; })]).range([4, width < 520 ? 10 : 14]);
            fig.plot.textContent = "";
            var svg = d3.select(fig.plot).append("svg")
                .attr("viewBox", [0, 0, width, height]).attr("width", width).attr("height", height)
                .attr("tabindex", 0).attr("role", "img")
                .attr("aria-label", "Asteroid close approaches to Earth, by date and distance in lunar distances. Use the arrow keys to step through them; the table below lists them all.");
            var tip = tooltip(fig.plot);
            svg.append("g").attr("class", "grid").attr("transform", "translate(" + m.left + ",0)")
                .call(d3.axisLeft(y).ticks(4).tickSize(-(width - m.left - m.right)).tickFormat(""));
            svg.append("g").attr("class", "axis y").attr("transform", "translate(" + m.left + ",0)")
                .call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(8).tickFormat(function (v) { return v + " LD"; }));
            svg.append("g").attr("class", "axis x").attr("transform", "translate(0," + (height - m.bottom) + ")")
                .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(width / 110))).tickSize(0).tickPadding(10).tickFormat(d3.timeFormat("%b %-d")));
            // The Moon's distance, for scale.
            svg.append("line").attr("class", "zero").attr("x1", m.left).attr("x2", width - m.right).attr("y1", y(1)).attr("y2", y(1));
            svg.append("text").attr("class", "zero-label").attr("text-anchor", "end").attr("x", width - m.right - 4).attr("y", y(1) - 6).text("the Moon");
            if (now >= x.domain()[0] && now <= x.domain()[1]) {
                svg.append("line").attr("class", "now").attr("x1", x(now)).attr("x2", x(now)).attr("y1", m.top).attr("y2", height - m.bottom);
                svg.append("text").attr("class", "now-label").attr("x", x(now) + 4).attr("y", m.top + 10).text("now");
            }
            var order = rows.slice().sort(function (a, b) { return b.d - a.d; });  // small ones on top
            var dots = svg.append("g").attr("class", "quakes s-accent").selectAll("circle").data(order).join("circle")
                .attr("cx", function (d) { return x(d.x); }).attr("cy", function (d) { return y(d.ld); })
                .attr("r", function (d) { return r(d.d); });
            var byTime = rows.slice();
            var pos = byTime.map(function (d) { return [x(d.x), y(d.ld)]; });
            var delaunay = d3.Delaunay.from(pos);
            var index = Math.max(0, d3.bisector(function (d) { return d.x; }).left(byTime, now));
            function show(i) {
                index = Math.max(0, Math.min(byTime.length - 1, i));
                var d = byTime[index];
                dots.classed("hover", function (e) { return e === d; });
                tip.show(pos[index][0], pos[index][1] - r(d.d), d.name + (d.x < now ? " (passed)" : ""), [
                    { cls: "s-accent", value: d3.format(".2~f")(d.ld) + " LD", name: comma(Math.round(d.km / 1000) * 1000) + " km" },
                    { value: d.x.toLocaleString("en-US", { timeZone: PDX.tz, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }), name: "Portland time" },
                    { value: metres(d.dLo) + "–" + metres(d.dHi), name: "across, at " + d3.format(".1f")(d.v) + " km/s" }
                ]);
            }
            function hide() { dots.classed("hover", false); tip.hide(); }
            svg.on("pointermove", function (ev) {
                var p = d3.pointer(ev), i = delaunay.find(p[0], p[1]);
                if (Math.hypot(pos[i][0] - p[0], pos[i][1] - p[1]) <= 24) show(i); else hide();
            }).on("pointerleave", hide);
            keyboard(svg, function () { return index; }, show, hide, byTime.length);
        });
    }

    // NOAA's storm scale starts at Kp 5 (G1); by G3 (Kp 7) the aurora can
    // reach as far south as Oregon.
    var G_SCALE = [{ kp: 5, name: "G1 minor storm" }, { kp: 7, name: "G3 strong: aurora may reach Oregon" }, { kp: 9, name: "G5 extreme" }];

    function loadKp() {
        var fig = figure("chart-kp");
        loading(fig);
        getJSON("https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json")
            .then(function (r) { return r.json(); }).then(function (rows) {
                var bars = rows.map(function (r) {
                    return { x: d3.isoParse(r.time_tag + "Z"), kp: +r.kp, kind: r.observed, scale: r.noaa_scale };
                }).filter(function (b) { return !isNaN(b.kp); });
                var latest = bars.filter(function (b) { return b.kind !== "predicted"; }).pop();
                var peak = d3.greatest(bars.filter(function (b) { return b.kind === "predicted"; }), function (b) { return b.kp; });
                var g = latest.kp >= 5 ? "G" + Math.min(5, Math.floor(latest.kp) - 4) + " storm" : latest.kp >= 4 ? "active" : "quiet";
                setStat("stat-kp", "Kp " + d3.format(".2~f")(latest.kp), g + " · " + (peak ? "forecast peak Kp " + d3.format(".2~f")(peak.kp) : "") +
                    " · seeing the aurora from Portland takes a strong storm, around Kp 7");
                legend(fig, [
                    { name: "observed", cls: "s-accent", shape: "bar" },
                    { name: "forecast", cls: "s-context", shape: "bar" }
                ]);
                kpChart(fig, bars);
                table(fig, [
                    { name: "Three hours from (UTC)", value: function (b) { return d3.utcFormat("%b %-d, %H:%M")(b.x); } },
                    { name: "Kp", num: true, value: function (b) { return d3.format(".2f")(b.kp); } },
                    { name: "", value: function (b) { return b.kind + (b.scale ? " · " + b.scale : ""); } }
                ], bars.slice().reverse(), "Newest first.");
            }).catch(function (e) { failed(fig, e, loadKp); failStat("stat-kp"); });
    }

    function kpChart(fig, bars) {
        var height = 220;
        onWidth(fig, function () {
            var width = fig.plot.clientWidth;
            if (!width) return;
            var m = { top: 14, right: 12, bottom: 28, left: 36 };
            var x = d3.scaleBand().domain(bars.map(function (b) { return +b.x; })).range([m.left, width - m.right]).paddingInner(0.25);
            var y = d3.scaleLinear().domain([0, 9]).range([height - m.bottom, m.top]);
            var bw = Math.min(24, x.bandwidth());
            fig.plot.textContent = "";
            var svg = d3.select(fig.plot).append("svg")
                .attr("viewBox", [0, 0, width, height]).attr("width", width).attr("height", height)
                .attr("tabindex", 0).attr("role", "img")
                .attr("aria-label", "Planetary K index every three hours, observed for the past week and forecast for three days. Use the arrow keys to read each period; the table below has them all.");
            var tip = tooltip(fig.plot);
            svg.append("g").attr("class", "grid").attr("transform", "translate(" + m.left + ",0)")
                .call(d3.axisLeft(y).ticks(9).tickSize(-(width - m.left - m.right)).tickFormat(""));
            svg.append("g").attr("class", "axis y").attr("transform", "translate(" + m.left + ",0)")
                .call(d3.axisLeft(y).ticks(9).tickSize(0).tickPadding(8));
            var days = bars.filter(function (b) { return b.x.getUTCHours() === 0; });
            svg.append("g").attr("class", "axis x").attr("transform", "translate(0," + (height - m.bottom) + ")")
                .call(d3.axisBottom(x).tickValues(days.filter(function (b, i) { return width >= 520 || i % 2 === 0; }).map(function (b) { return +b.x; }))
                    .tickSize(0).tickPadding(10).tickFormat(function (v) { return d3.utcFormat("%b %-d")(new Date(v)); }));
            G_SCALE.forEach(function (gs) {
                svg.append("line").attr("class", "zero").attr("x1", m.left).attr("x2", width - m.right).attr("y1", y(gs.kp)).attr("y2", y(gs.kp));
                svg.append("text").attr("class", "zero-label").attr("x", m.left + 6).attr("y", y(gs.kp) - 5).text(gs.name);
            });
            // Square at the baseline, a 4px round at the top.
            var r = Math.min(4, bw / 2);
            function bar(b) {
                var x0 = x(+b.x) + (x.bandwidth() - bw) / 2, y0 = y(0), y1 = Math.min(y(b.kp), y0 - r);
                return "M" + x0 + "," + y0 + "V" + (y1 + r) + "Q" + x0 + "," + y1 + " " + (x0 + r) + "," + y1 +
                    "H" + (x0 + bw - r) + "Q" + (x0 + bw) + "," + y1 + " " + (x0 + bw) + "," + (y1 + r) + "V" + y0 + "Z";
            }
            var cols = svg.append("g").selectAll("g").data(bars).join("g")
                .attr("class", function (b) { return "day " + (b.kind === "predicted" ? "s-context" : "s-accent"); });
            cols.append("path").attr("class", "bar").attr("d", bar);
            var index = bars.length - 1;
            bars.forEach(function (b, i) { if (b.kind !== "predicted") index = i; });
            function show(i) {
                index = Math.max(0, Math.min(bars.length - 1, i));
                var b = bars[index];
                cols.classed("hover", function (e) { return e === b; });
                tip.show(x(+b.x) + x.bandwidth() / 2, y(b.kp), d3.utcFormat("%b %-d, %H:%M UTC")(b.x), [
                    { cls: b.kind === "predicted" ? "s-context" : "s-accent", value: "Kp " + d3.format(".2~f")(b.kp), name: b.kind + (b.scale ? " · " + b.scale : "") }
                ]);
            }
            function hide() { cols.classed("hover", false); tip.hide(); }
            cols.append("rect").attr("class", "hit")
                .attr("x", function (b) { return x(+b.x) - x.step() * x.paddingInner() / 2; }).attr("width", x.step())
                .attr("y", m.top).attr("height", height - m.top - m.bottom)
                .on("pointerenter", function (ev, b) { show(bars.indexOf(b)); })
                .on("pointerleave", hide);
            keyboard(svg, function () { return index; }, show, hide, bars.length);
        });
    }

    // Three kinds get a colour each (the most a map can keep apart); the
    // rest share the context grey.
    var KINDS = [
        { id: "wildfires", name: "wildfires", cls: "s-2" },
        { id: "severeStorms", name: "severe storms", cls: "s-1" },
        { id: "volcanoes", name: "volcanoes", cls: "s-3" }
    ];
    function kindOf(ev) {
        var id = ev.categories[0] && ev.categories[0].id;
        return KINDS.filter(function (k) { return k.id === id; })[0] || { id: "other", name: (ev.categories[0] && ev.categories[0].title || "other").toLowerCase(), cls: "s-context", other: true };
    }

    function loadEvents() {
        var fig = figure("chart-events");
        loading(fig);
        Promise.all([
            getJSON("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30").then(function (r) { return r.json(); }),
            getJSON("/data/land-110m.json").then(function (r) { return r.json(); })
        ]).then(function (res) {
            var events = res[0].events.map(function (ev) {
                var g = ev.geometry[ev.geometry.length - 1];
                var where = g.type === "Point" ? g.coordinates : d3.geoCentroid({ type: g.type, coordinates: g.coordinates });
                return { title: ev.title, kind: kindOf(ev), lon: where[0], lat: where[1], date: new Date(g.date),
                         size: g.magnitudeValue ? comma(g.magnitudeValue) + " " + g.magnitudeUnit : "", link: ev.sources[0] && ev.sources[0].url };
            });
            var counts = d3.rollup(events, function (v) { return v.length; }, function (e) { return e.kind.name; });
            var top = Array.from(counts).sort(function (a, b) { return b[1] - a[1]; });
            setStat("stat-events", comma(events.length), top.map(function (t) { return comma(t[1]) + " " + t[0]; }).join(", "));
            var present = KINDS.filter(function (k) { return events.some(function (e) { return e.kind.id === k.id; }); });
            var items = present.map(function (k) { return { name: k.name, cls: k.cls, shape: "dot" }; });
            if (events.some(function (e) { return e.kind.other; })) items.push({ name: "everything else (sea ice, floods, dust…)", cls: "s-context", shape: "dot" });
            legend(fig, items);
            eventMap(fig, events, topojson.feature(res[1], res[1].objects.land));
            table(fig, [
                { name: "Event", value: function (e) { return e.title; } },
                { name: "Kind", value: function (e) { return e.kind.name; } },
                { name: "Last reported", value: function (e) { return fmtDay(e.date); } },
                { name: "Size", num: true, value: function (e) { return e.size || "—"; } }
            ], events.slice().sort(function (a, b) { return b.date - a.date; }), "Newest report first. Each event is placed where it was last reported.");
        }).catch(function (e) { failed(fig, e, loadEvents); failStat("stat-events"); });
    }

    function eventMap(fig, events, land) {
        onWidth(fig, function () {
            var width = fig.plot.clientWidth;
            if (!width) return;
            var proj = d3.geoEqualEarth().fitWidth(width, { type: "Sphere" });
            var path = d3.geoPath(proj);
            var height = Math.ceil(path.bounds({ type: "Sphere" })[1][1]);
            fig.plot.textContent = "";
            var svg = d3.select(fig.plot).append("svg")
                .attr("viewBox", [0, 0, width, height]).attr("width", width).attr("height", height)
                .attr("tabindex", 0).attr("role", "img")
                .attr("aria-label", "World map of the natural events NASA is tracking. Use the arrow keys to step through them; the table below lists them all.");
            var tip = tooltip(fig.plot);
            svg.append("path").attr("class", "sphere").attr("d", path({ type: "Sphere" }));
            svg.append("path").attr("class", "land").attr("d", path(land));
            var pdx = proj([PDX.lon, PDX.lat]);
            svg.append("circle").attr("class", "home").attr("cx", pdx[0]).attr("cy", pdx[1]).attr("r", 5);
            svg.append("text").attr("class", "place-label").attr("x", pdx[0] - 8).attr("y", pdx[1] + 4).attr("text-anchor", "end").text("Portland");
            var pos = events.map(function (e) { return proj([e.lon, e.lat]); });
            var rr = width < 520 ? 4 : 5;
            var dots = svg.append("g").attr("class", "events").selectAll("circle").data(events).join("circle")
                .attr("class", function (e) { return e.kind.cls; })
                .attr("cx", function (e, i) { return pos[i][0]; }).attr("cy", function (e, i) { return pos[i][1]; })
                .attr("r", rr);
            var delaunay = d3.Delaunay.from(pos);
            var index = 0;
            function show(i) {
                index = (i + events.length) % events.length;
                var e = events[index];
                dots.classed("hover", function (d) { return d === e; });
                tip.show(pos[index][0], pos[index][1] - rr, e.title, [
                    { cls: e.kind.cls, value: e.kind.name, name: "" },
                    { value: fmtDay(e.date), name: e.size ? "last reported · " + e.size : "last reported" }
                ]);
            }
            function hide() { dots.classed("hover", false); tip.hide(); }
            svg.on("pointermove", function (ev) {
                if (!events.length) return;
                var p = d3.pointer(ev), i = delaunay.find(p[0], p[1]);
                if (Math.hypot(pos[i][0] - p[0], pos[i][1] - p[1]) <= 24) show(i); else hide();
            }).on("pointerleave", hide);
            keyboard(svg, function () { return index; }, show, hide, events.length);
        });
    }

    function loadFireballs() {
        var fig = figure("chart-fireballs");
        loading(fig);
        sky.then(function (s) {
            var f = s.fireballs.fields;
            var balls = s.fireballs.data.map(function (r) {
                var o = {}; f.forEach(function (k, i) { o[k] = r[i]; }); return o;
            }).map(function (o) {
                return { x: parseFireball(o.date), kt: +o["impact-e"], lat: o.lat === null ? null : (+o.lat) * (o["lat-dir"] === "S" ? -1 : 1),
                         lon: o.lon === null ? null : (+o.lon) * (o["lon-dir"] === "W" ? -1 : 1), alt: o.alt, vel: o.vel };
            }).filter(function (b) { return b.x && b.kt > 0; }).sort(function (a, b) { return a.x - b.x; });
            fireballChart(fig, balls);
            table(fig, [
                { name: "When (UTC)", value: function (b) { return d3.utcFormat("%b %-d, %Y %H:%M")(b.x); } },
                { name: "Impact energy", num: true, value: function (b) { return d3.format(".2~f")(b.kt) + " kt"; } },
                { name: "Where", value: function (b) { return b.lat === null ? "—" : Math.abs(b.lat).toFixed(1) + "°" + (b.lat < 0 ? "S" : "N") + " " + Math.abs(b.lon).toFixed(1) + "°" + (b.lon < 0 ? "W" : "E"); } },
                { name: "Altitude", num: true, value: function (b) { return b.alt ? b.alt + " km" : "—"; } },
                { name: "Speed", num: true, value: function (b) { return b.vel ? b.vel + " km/s" : "—"; } }
            ], balls.slice().reverse(), "Newest first. A kiloton is the energy of 1,000 tonnes of TNT. Saved from JPL at " + s.fetched + ".");
        }).catch(function (e) { failed(fig, e, loadFireballs); });
    }

    function fireballChart(fig, balls) {
        var height = 220;
        onWidth(fig, function () {
            var width = fig.plot.clientWidth;
            if (!width) return;
            var m = { top: 20, right: 16, bottom: 28, left: 52 };
            var x = d3.scaleTime().domain([d3.timeYear.offset(new Date(), -1), new Date()]).range([m.left, width - m.right]);
            var y = d3.scaleLog().domain([0.05, Math.max(10, d3.max(balls, function (b) { return b.kt; }) || 10)]).nice().range([height - m.bottom, m.top]).clamp(true);
            fig.plot.textContent = "";
            var svg = d3.select(fig.plot).append("svg")
                .attr("viewBox", [0, 0, width, height]).attr("width", width).attr("height", height)
                .attr("tabindex", 0).attr("role", "img")
                .attr("aria-label", "Fireballs over the past year by estimated impact energy in kilotons, on a log scale. Use the arrow keys to step through them; the table below lists them all.");
            var tip = tooltip(fig.plot);
            var ticks = y.ticks().filter(function (v) { return [0.1, 1, 10, 100, 1000].indexOf(v) >= 0; });
            svg.append("g").attr("class", "grid").attr("transform", "translate(" + m.left + ",0)")
                .call(d3.axisLeft(y).tickValues(ticks).tickSize(-(width - m.left - m.right)).tickFormat(""));
            svg.append("g").attr("class", "axis y").attr("transform", "translate(" + m.left + ",0)")
                .call(d3.axisLeft(y).tickValues(ticks).tickSize(0).tickPadding(8).tickFormat(function (v) { return d3.format("~")(v) + " kt"; }));
            svg.append("g").attr("class", "axis x").attr("transform", "translate(0," + (height - m.bottom) + ")")
                .call(d3.axisBottom(x).ticks(Math.max(2, Math.floor(width / 90))).tickSize(0).tickPadding(10).tickFormat(d3.timeFormat("%b")));
            var dots = svg.append("g").attr("class", "quakes s-accent").selectAll("circle").data(balls).join("circle")
                .attr("cx", function (b) { return x(b.x); }).attr("cy", function (b) { return y(b.kt); }).attr("r", 5);
            var big = d3.greatest(balls, function (b) { return b.kt; });
            if (big) {
                var bx = x(big.x), onLeft = bx > width * 0.6;
                svg.append("text").attr("class", "end-label").attr("text-anchor", onLeft ? "end" : "start")
                    .attr("x", bx + (onLeft ? -10 : 10)).attr("y", y(big.kt)).attr("dy", "0.32em")
                    .text(d3.format(".2~f")(big.kt) + " kt, " + d3.timeFormat("%b %-d")(big.x));
            }
            var pos = balls.map(function (b) { return [x(b.x), y(b.kt)]; });
            var delaunay = balls.length ? d3.Delaunay.from(pos) : null;
            var index = balls.length - 1;
            function show(i) {
                if (!balls.length) return;
                index = Math.max(0, Math.min(balls.length - 1, i));
                var b = balls[index];
                dots.classed("hover", function (d) { return d === b; });
                tip.show(pos[index][0], pos[index][1] - 5, d3.utcFormat("%b %-d, %Y %H:%M UTC")(b.x), [
                    { cls: "s-accent", value: d3.format(".2~f")(b.kt) + " kt", name: "estimated impact energy" },
                    { value: b.lat === null ? "location not given" : Math.abs(b.lat).toFixed(1) + "°" + (b.lat < 0 ? "S" : "N") + " " + Math.abs(b.lon).toFixed(1) + "°" + (b.lon < 0 ? "W" : "E"), name: b.alt ? b.alt + " km up" : "" }
                ]);
            }
            function hide() { dots.classed("hover", false); tip.hide(); }
            svg.on("pointermove", function (ev) {
                if (!delaunay) return;
                var p = d3.pointer(ev), i = delaunay.find(p[0], p[1]);
                if (Math.hypot(pos[i][0] - p[0], pos[i][1] - p[1]) <= 24) show(i); else hide();
            }).on("pointerleave", hide);
            keyboard(svg, function () { return index; }, show, hide, balls.length);
        });
    }

    loadDebt();
    loadCash();
    loadRates();
    loadAlerts();
    loadWeather();
    loadAir();
    loadWillamette();
    loadColumbia();
    loadBikes();
    loadQuakes();
    loadAsteroids();
    loadKp();
    loadEvents();
    loadFireballs();
})();
