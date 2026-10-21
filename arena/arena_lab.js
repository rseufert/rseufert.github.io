#!/usr/bin/env node
// Take one tank against one opponent apart, headlessly: wins, how long,
// how much it moved and crossed the other's line of sight, its hit rate
// and aim error (each shot against the ideal intercept, by a hook on the
// engine's fire), and the other's hit rate on it. For tuning a tank.
//
//     node arena/arena_lab.js tank.txt circler 20        # a file, or a preset's name, against a preset or a file
//     node arena/arena_lab.js josh circler 20 20          # seeds 21 to 40
var fs = require("fs");
var path = require("path");
var A = require(path.join(__dirname, "arena-engine.js"));
var R = require(path.join(__dirname, "arena-robots.js"));
var tank = process.argv[2] || "heron", src = /\.txt$/.test(tank) ? fs.readFileSync(tank, "utf8") : R.robots[tank], opp = process.argv[3] || "circler", seeds = +(process.argv[4] || 10), offset = +(process.argv[5] || 0);
var crossTicks = 0, rangeSum = 0, deaths = {}, still = [], moving = [], myShots = 0, myHits = 0, hisShots = 0, hisHits = 0, hisHitRange = [], hisHitMyV = [], wins = 0, ticksList = [], moveTicks = 0, totalTicks = 0, armorLeft = 0;
function med(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[a.length >> 1] : 0; }
for (var seed = 1 + offset; seed <= seeds + offset; seed++) {
    var m = new A.Match([{ source: src }, { source: /\.txt$/.test(opp) ? fs.readFileSync(opp, "utf8") : R.robots[opp] }], { seed: seed });
    var me = m.robots[0], him = m.robots[1], hx = him.x, hy = him.y, vx = 0, vy = 0;
    var hurt = m.hurt.bind(m), fire = m.fire.bind(m);
    m.hurt = function (r, amount, by, how) {
        if (how === "shot") {
            if (r === him) myHits++;
            if (r === me) { hisHits++; hisHitRange.push(Math.hypot(him.x - me.x, him.y - me.y)); hisHitMyV.push(me.speed); }
        }
        return hurt(r, amount, by, how);
    };
    m.fire = function (r, adjust) {
        if (r === me && r.cooldown <= 0 && !r.down) {
            var aim = A.norm(r.heading + r.turret + adjust * r.arc / 4), range = Math.hypot(him.x - me.x, him.y - me.y), T = range / 50;
            for (var k = 0; k < 4; k++) T = Math.hypot(him.x + vx * T - me.x, him.y + vy * T - me.y) / 50;
            var ideal = A.norm(Math.atan2(him.y + vy * T - me.y, him.x + vx * T - me.x) * 180 / Math.PI);
            (me.speed > 0.1 ? moving : still).push(Math.abs(A.diff(aim, ideal)));
        }
        return fire(r, adjust);
    };
    while (!m.over) {
        vx = him.x - hx; vy = him.y - hy; hx = him.x; hy = him.y;
        var mv = me.speed;
        m.update();
        totalTicks++; if (mv > 0.1) moveTicks++;
        var tof = A.diff(Math.atan2(him.y - me.y, him.x - me.x) * 180 / Math.PI, me.heading); if (mv > 3 && Math.abs(Math.sin(tof * Math.PI / 180)) > 0.7) crossTicks++; rangeSum += Math.hypot(him.x - me.x, him.y - me.y);
    }
    var k = me.alive ? 'alive' : me.killedBy; deaths[k] = (deaths[k] || 0) + 1;
    myShots += me.shots; hisShots += him.shots; if (m.winner === me) wins++; ticksList.push(m.tick); armorLeft += me.armor;
}
console.log(opp + ": wins " + wins + "/" + seeds + ", median ticks " + med(ticksList) + ", my armor left avg " + (armorLeft / seeds).toFixed(0) + ", moving " + (100 * moveTicks / totalTicks).toFixed(0) + "% of the time, crossing its line at speed " + (100 * crossTicks / totalTicks).toFixed(0) + "%, mean range " + (rangeSum / totalTicks).toFixed(0) + ", I end " + JSON.stringify(deaths));
console.log("  my shots " + myShots + " hits " + myHits + " (" + (100 * myHits / Math.max(1, myShots)).toFixed(0) + "%); aim |err| median still " + med(still).toFixed(1) + " (n=" + still.length + ") moving " + med(moving).toFixed(1) + " (n=" + moving.length + ")");
console.log("  his shots " + hisShots + " hits " + hisHits + " (" + (100 * hisHits / Math.max(1, hisShots)).toFixed(0) + "%); his hits at range median " + med(hisHitRange).toFixed(0) + ", while I moved " + (100 * hisHitMyV.filter(function (v) { return v > 0.1; }).length / Math.max(1, hisHitMyV.length)).toFixed(0) + "%");
