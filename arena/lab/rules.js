#!/usr/bin/env node
// Which aiming rule hits a tank going round in circles? Records a quiet
// CIRCLER's path (circlerq.txt, CIRCLER with its gun removed), then from a
// fixed shooter at the middle fires every 13 ticks by each rule and counts
// the hits, separately for the ticks when the target was turning at the
// limit and when it was running straight. The rules: lead it linearly;
// aim at where it is; aim at the centre of its last 45 ticks; aim at
// where it was a lap (45 ticks) before the shot lands. The last one hits
// 98% of the time while it circles, which is what arena/lab/lap.txt does.
//
//     node arena/lab/rules.js
var fs = require("fs"), path = require("path"), A = require(path.join(__dirname, "..", "arena-engine.js"));
var q = fs.readFileSync(path.join(__dirname, "circlerq.txt"), "utf8");
var SX = 500, SY = 500, LAT = 4, results = {};
["linear", "current", "centre", "period"].forEach(function (r) { results[r] = { T: [0, 0], S: [0, 0] }; });
for (var seed = 1; seed <= 8; seed++) {
    var m = new A.Match([{ source: q }, { source: q }], { seed: seed }), him = m.robots[0], path = [];
    for (var t = 0; t < 3000; t++) { m.update(); path.push({ x: him.x, y: him.y, h: him.heading }); }
    function hit(t0, ang) { // a missile from the shooter at tick t0 along ang: does it pass within 18 of the tank
        var dx = Math.cos(ang * Math.PI / 180) * 10, dy = Math.sin(ang * Math.PI / 180) * 10, x = SX, y = SY;
        for (var k = 1; k < 150 && t0 + Math.floor(k / 5) < path.length; k++) { x += dx; y += dy; var p = path[t0 + Math.floor(k / 5)]; if (Math.hypot(p.x - x, p.y - y) < 18) return true; if (x < 0 || y < 0 || x > 1000 || y > 1000) return false; }
        return false;
    }
    for (var t0 = 200; t0 < 2900; t0 += 13) {
        var p = path[t0], ts = t0 - LAT, ps = path[ts];                                  // the shot is decided from a scan LAT ticks earlier
        var r = Math.hypot(ps.x - SX, ps.y - SY), T = Math.round(r / 50);
        var turning = Math.abs(A.diff(path[t0].h, path[t0 - 1].h)) > 7.5 ? "T" : "S";
        var v = { x: ps.x - path[ts - 1].x, y: ps.y - path[ts - 1].y };
        var aims = {
            linear: Math.atan2(ps.y + v.y * (T + LAT) - SY, ps.x + v.x * (T + LAT) - SX),
            current: Math.atan2(ps.y - SY, ps.x - SX),
            centre: (function () { var cx = 0, cy = 0; for (var k = 0; k < 45; k++) { cx += path[ts - k].x; cy += path[ts - k].y; } return Math.atan2(cy / 45 - SY, cx / 45 - SX); })(),
            period: (function () { var o = path[ts - (45 - T - LAT)]; return Math.atan2(o.y - SY, o.x - SX); })()
        };
        Object.keys(aims).forEach(function (rule) { var res = results[rule][turning]; res[1]++; if (hit(t0, aims[rule] * 180 / Math.PI)) res[0]++; });
    }
}
Object.keys(results).forEach(function (rule) { var r = results[rule]; console.log(rule.padEnd(14) + " turning " + (100 * r.T[0] / r.T[1]).toFixed(0) + "% of " + r.T[1] + "   straight " + (100 * r.S[0] / r.S[1]).toFixed(0) + "% of " + r.S[1]); });
