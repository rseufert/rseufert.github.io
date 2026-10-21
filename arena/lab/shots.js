#!/usr/bin/env node
// Each of a tank's first shots, taken apart: how far the turret was from
// the target's bearing, the lead it applied, the lead it needed (the exact
// intercept of the target's motion), the error, two memory cells (27 and
// 22, the lead and the rate in the tanks that keep them there), and the
// turret offset and speeds. A hook on the engine's
// fire reads the aim at the moment of the shot. For finding out why a tank
// misses.
//
//     node arena/lab/shots.js arena/lab/lap.txt circler 1 20
//     node arena/lab/shots.js rick dodger 3                  # a preset's name works too
var fs = require("fs"), path = require("path");
var A = require(path.join(__dirname, "..", "arena-engine.js"));
var R = require(path.join(__dirname, "..", "arena-robots.js"));
var tank = process.argv[2] || "heron", src = /\.txt$/.test(tank) ? fs.readFileSync(tank, "utf8") : R.robots[tank], opp = process.argv[3] || "dodger", seed = +(process.argv[4] || 1), n = +(process.argv[5] || 15);
var m = new A.Match([{ source: src }, { source: /\.txt$/.test(opp) ? fs.readFileSync(opp, "utf8") : R.robots[opp] }], { seed: seed });
var me = m.robots[0], him = m.robots[1], hx = him.x, hy = him.y, vx = 0, vy = 0, count = 0;
var fire = m.fire.bind(m);
m.fire = function (r, adjust) {
    if (r === me && r.cooldown <= 0 && !r.down && count < n) {
        count++;
        var aim = A.norm(r.heading + r.turret + adjust * r.arc / 4);
        var bearing = A.norm(Math.atan2(him.y - me.y, him.x - me.x) * 180 / Math.PI), range = Math.hypot(him.x - me.x, him.y - me.y);
        var T = range / 50;
        for (var k = 0; k < 4; k++) T = Math.hypot(him.x + vx * T - me.x, him.y + vy * T - me.y) / 50;
        var ideal = A.norm(Math.atan2(him.y + vy * T - me.y, him.x + vx * T - me.x) * 180 / Math.PI);
        console.log("t" + String(m.tick).padStart(4) + " range " + range.toFixed(0).padStart(4) + " aim-bearing " + A.diff(aim, bearing).toFixed(1).padStart(6) + " needed " + A.diff(ideal, bearing).toFixed(1).padStart(6) + " err " + A.diff(aim, ideal).toFixed(1).padStart(6) + "  m27 " + me.mem[27] + " m22 " + me.mem[22] + " tofs " + Math.round(me.turret) + " my v " + me.speed.toFixed(1) + " his v " + Math.hypot(vx, vy).toFixed(1));
    }
    return fire(r, adjust);
};
while (!m.over && count < n) { vx = him.x - hx; vy = him.y - hy; hx = him.x; hy = him.y; m.update(); }
