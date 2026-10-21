#!/usr/bin/env node
// Fight the arena's presets headlessly (arena/arena-engine.js, arena/arena-robots.js):
// every preset assembles, every pairing ends, nobody faults, and the
// six-way match has a winner. Prints a table of who beats whom.
//
//     node arena/arena_test.js
var path = require("path");
var A = require(path.join(__dirname, "arena-engine.js"));
var R = require(path.join(__dirname, "arena-robots.js"));
var G = require(path.join(__dirname, "arena-gauntlet.js"));
var bad = 0;
function fail(msg) { console.error("FAIL " + msg); bad++; }

var names = R.order;
names.concat(["starter"]).forEach(function (n) {
    var asm = A.assemble(n === "starter" ? R.starter : R.robots[n]);
    if (asm.errors.length) fail(n + ": " + asm.errors.join("; "));
});

var wins = {}, ticks = [];
names.forEach(function (a) { wins[a] = 0; });
names.forEach(function (a) {
    names.forEach(function (b) {
        if (a >= b) return;
        for (var seed = 1; seed <= 4; seed++) {
            var m = new A.Match([{ source: R.robots[a] }, { source: R.robots[b] }], { seed: seed });
            m.run(30000);
            if (!m.over) fail(a + " v " + b + " seed " + seed + " never ended");
            m.robots.forEach(function (r) { if (r.errors.length) fail(r.name + " faulted: " + r.errors[0]); });
            if (m.winner) wins[m.winner.name.toLowerCase()]++;
            ticks.push(m.tick);
        }
    });
});
var six = new A.Match(names.map(function (n) { return { source: R.robots[n] }; }), { seed: 7 });
six.run(30000);
if (!six.over || !six.winner) fail("the six-way match has no winner");

// The gauntlet: a preset's program under another name gets through; the
// starter, a preset's name, and a program that does not assemble do not.
var josh = G.run(R.robots.josh.replace(/^#name\s+\S+/m, "#name VISITOR"));
if (!josh.ok) fail("JOSH under another name did not get through the gauntlet: " + josh.wins + " of " + josh.total);
var starter = G.run(R.starter.replace(/^#name\s+\S+/m, "#name VISITOR"));
if (starter.ok) fail("the starter got through the gauntlet");
if (!G.run(R.robots.josh).errors.length) fail("a preset's name was allowed through the gauntlet");
if (!G.run("#name X\nmov ax, ").errors.length) fail("a program that does not assemble was allowed through the gauntlet");
console.log("the gauntlet: JOSH " + josh.wins + " of " + josh.total + ", the starter " + starter.wins + " of " + starter.total + ", the bar " + G.BAR);

console.log("pairings, 4 seeds each: wins");
names.forEach(function (n) { console.log("  " + n.padEnd(8) + String(wins[n]).padStart(3)); });
ticks.sort(function (x, y) { return x - y; });
console.log("match length in ticks: shortest " + ticks[0] + ", median " + ticks[ticks.length >> 1] + ", longest " + ticks[ticks.length - 1] + " (60 ticks a second)");
console.log("six-way, seed 7: " + six.winner.name + " in " + six.tick + " ticks; " + six.log.slice(0, 3).join(" / "));
if (bad) { console.error(bad + " failure" + (bad === 1 ? "" : "s")); process.exit(1); }
console.log("ok");
