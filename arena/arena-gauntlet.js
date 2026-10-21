// The gauntlet (arena/arena-gauntlet.js): what a tank sent in has to get
// through before it is listed with the others. It duels every preset over
// a few seeds; it is in if it wins at least BAR of those without a fault.
// The page runs it before offering to send a tank in (arena/arena.js), and
// the workflow runs it again, in node, on every tank that arrives as an
// issue (tools/tanks.py), so the list cannot be talked into anything.
//
//     node arena/arena-gauntlet.js tank.txt     # prints the result as JSON
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory(require("./arena-engine.js"), require("./arena-robots.js"));
    else root.ArenaGauntlet = factory(root.Arena, root.ArenaRobots);
}(this, function (A, R) {
    "use strict";
    var SEEDS = [1, 2, 3, 4];
    var BAR = 27;                 // of 40: two duels in three; the starter wins 24, RICK 23, JOSH 30, HERON 31
    var MAX_SOURCE = 16000;
    var NAME = /^[A-Z0-9][A-Z0-9_-]{0,11}$/;

    // Start a run: g.step() fights one duel, so a page can keep drawing
    // between them; g.over says when it is done and g.ok whether it is in.
    function start(source) {
        var g = { total: R.order.length * SEEDS.length, done: 0, wins: 0, beaten: {}, faults: [], errors: [], name: null, ok: false, over: false, bar: BAR };
        if (typeof source !== "string" || source.length > MAX_SOURCE) { g.errors.push("the program is longer than " + MAX_SOURCE + " characters"); g.over = true; return g; }
        var asm = A.assemble(source);
        if (asm.errors.length) { g.errors = asm.errors.slice(0, 6); g.over = true; return g; }
        g.name = String(asm.name || "").toUpperCase();
        if (!NAME.test(g.name)) { g.errors.push("it needs a #name of up to 12 letters, digits, _ or -"); g.over = true; return g; }
        if (R.robots[g.name.toLowerCase()]) { g.errors.push("that name is a preset's; pick your own"); g.over = true; return g; }
        var plan = [];
        R.order.forEach(function (n) { SEEDS.forEach(function (s) { plan.push([n, s]); }); });
        g.step = function () {
            if (g.over) return g;
            var p = plan[g.done];
            var m = new A.Match([{ source: source, name: g.name }, { source: R.robots[p[0]] }], { seed: p[1] });
            m.run(30000);
            var me = m.robots[0];
            if (me.errors.length) g.faults.push(p[0] + " seed " + p[1] + ": " + me.errors[0]);
            if (m.winner === me) { g.wins++; g.beaten[p[0]] = (g.beaten[p[0]] || 0) + 1; }
            g.done++;
            if (g.done >= plan.length) { g.over = true; g.ok = g.wins >= BAR && !g.faults.length; }
            return g;
        };
        return g;
    }
    function run(source) { var g = start(source); while (!g.over) g.step(); return g; }
    function summary(g) {
        return { name: g.name, ok: g.ok, wins: g.wins, of: g.total, bar: BAR, beaten: g.beaten, faults: g.faults, errors: g.errors };
    }
    return { start: start, run: run, summary: summary, BAR: BAR, SEEDS: SEEDS, NAME: NAME, MAX_SOURCE: MAX_SOURCE };
}));
if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
    var text = require("fs").readFileSync(process.argv[2], "utf8");
    console.log(JSON.stringify(module.exports.summary(module.exports.run(text))));
}
