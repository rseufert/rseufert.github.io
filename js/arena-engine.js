// The arena (arena/index.html): an homage to AT-Robots, Ed Toton's DOS game
// of 1992, in which you wrote a tank in a small assembly language and watched
// it fight. This is the assembler and the simulation, with no page in it, so
// the same file runs the match in the browser (js/arena.js draws it), in node
// (tools/arena_test.js) and in rickbot's dungeon (js/chat.js).
//
// The dialect is in the spirit of AT-Robots 2, not a copy of it. A robot is
// lines of   op a, b   with registers ax bx cx dx, numbers, memory [n] or
// [ax], and labels (:name). It talks to its tank through ports, opo to
// write and ipo to read, numbered as AT-Robots numbered them and also named:
//
//   read   1 speedo  2 heat  3 compass  4 tofs (turret offset)  5 theading
//          6 damage  7 scan (range to the nearest enemy in the scanner's arc,
//          0 for none)  8 accuracy (-2..2, where in the arc it was)  9 radar
//          (range to the nearest enemy, any direction)  10 random
//   write 11 throttle (-75..100)  12 rotate (turn the turret by)  13 aim
//          (set the turret offset)  14 steer (turn the body by)  15 fire
//          (with an adjustment of -4..4 arcs; firing with the accuracy you
//          just read is the classic)  17 arc (the scanner's half-angle,
//          1..64)  18 overburn (1 or 0)  20 shutdown (the heat to shut down at)
//
// and interrupts (int n): 0 destruct, 1 reset, 2 locate (ax, bx = x, y),
// 3 keepshift (ax: the turret keeps its heading when the body turns),
// 4 overburn (ax), 5 id (ax), 6 timer (ax), 7 angle (ax, bx = a point;
// ax = the heading to it), 10 game (ax = robots alive, bx = tick),
// 12 collisions (ax), 13 reset collisions, 18 kills (ax).
//
// A #config line spends up to twelve points on scanner, weapon, armor,
// engine and heatsinks, 0 to 5 each. A #name line names the tank.
//
// The arena is 1000 by 1000. Each tick every tank runs five instructions
// (delay n costs n), then moves; heat from firing and overburn is shed by
// the heatsinks, a tank at 475 shuts down until it cools, and at 500 it
// burns. Missiles fly straight and miss. Walls hurt in proportion to speed.
// The match ends with one tank standing, or on the time limit, on armor.
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.Arena = factory();
}(typeof self !== "undefined" ? self : this, function () {
    "use strict";

    var SIZE = 1000, RADIUS = 15, CYCLES = 5, MAX_TICKS = 18000;
    var REGS = { ax: 0, bx: 1, cx: 2, dx: 3 };
    var PORTS = {
        speedo: 1, heat: 2, compass: 3, tofs: 4, theading: 5, damage: 6, scan: 7, accuracy: 8, radar: 9, random: 10,
        throttle: 11, rotate: 12, aim: 13, steer: 14, fire: 15, arc: 17, overburn: 18, shutdown: 20
    };
    var INTS = { destruct: 0, reset: 1, locate: 2, keepshift: 3, overburn: 4, id: 5, timer: 6, angle: 7, game: 10, collisions: 12, resetcol: 13, kills: 18 };
    // op: [operands, cycles]
    var OPS = {
        mov: [2, 1], add: [2, 1], sub: [2, 1], mpy: [2, 2], div: [2, 2], mod: [2, 2], and: [2, 1], or: [2, 1], xor: [2, 1],
        not: [1, 1], neg: [1, 1], xchg: [2, 1], cmp: [2, 1],
        jmp: [1, 1], je: [1, 1], jz: [1, 1], jne: [1, 1], jnz: [1, 1], jg: [1, 1], jgr: [1, 1], jl: [1, 1], jls: [1, 1], jge: [1, 1], jle: [1, 1],
        call: [1, 1], ret: [0, 1], push: [1, 1], pop: [1, 1], "do": [1, 1], loop: [1, 1],
        delay: [1, 0], nop: [0, 1], err: [1, 1], opo: [2, 1], ipo: [2, 1], "int": [1, 2]
    };
    var CONFIG = ["scanner", "weapon", "armor", "engine", "heatsinks"];

    // ---- the assembler ----------------------------------------------------
    function operand(tok, labels, errors, lineNo) {
        var t = tok.toLowerCase();
        if (t in REGS) return { t: "reg", r: REGS[t] };
        var m = /^\[(.+)\]$/.exec(t);
        if (m) {
            if (m[1] in REGS) return { t: "memr", r: REGS[m[1]] };
            if (/^-?\d+$/.test(m[1])) return { t: "mem", a: parseInt(m[1], 10) };
            errors.push("line " + lineNo + ": bad address " + tok);
            return { t: "imm", v: 0 };
        }
        if (/^-?(0x[0-9a-f]+|\d+)$/.test(t)) return { t: "imm", v: parseInt(t, t.indexOf("0x") >= 0 ? 16 : 10) | 0 };
        if (t in PORTS) return { t: "imm", v: PORTS[t], name: t };
        if (t.charAt(0) === "@" && t.slice(1) in INTS) return { t: "imm", v: INTS[t.slice(1)], name: t };
        if (labels.hasOwnProperty(t)) return { t: "imm", v: labels[t], name: t };
        errors.push("line " + lineNo + ": i don't know what " + tok + " is");
        return { t: "imm", v: 0 };
    }

    function assemble(source) {
        var lines = String(source).split(/\r?\n/), errors = [], program = [], labels = {}, name = null;
        var config = { scanner: 2, weapon: 2, armor: 2, engine: 2, heatsinks: 2 }, configured = false;
        // First pass: labels and directives.
        var pending = [];
        lines.forEach(function (raw, i) {
            var lineNo = i + 1, text = raw.replace(/;.*$/, "").trim();
            if (!text) return;
            if (text.charAt(0) === "#") {
                var d = /^#(\w+)\s*(.*)$/.exec(text);
                if (!d) { errors.push("line " + lineNo + ": bad directive"); return; }
                if (d[1] === "name") name = d[2].trim().slice(0, 12) || null;
                else if (d[1] === "config") {
                    configured = true;
                    d[2].split(/[\s,]+/).filter(Boolean).forEach(function (kv) {
                        var p = /^(\w+)\s*=\s*(\d+)$/.exec(kv);
                        if (!p || CONFIG.indexOf(p[1]) < 0) { errors.push("line " + lineNo + ": config takes scanner, weapon, armor, engine and heatsinks, not " + kv); return; }
                        var v = parseInt(p[2], 10);
                        if (v > 5) errors.push("line " + lineNo + ": " + p[1] + " goes up to 5");
                        config[p[1]] = Math.min(v, 5);
                    });
                } else errors.push("line " + lineNo + ": unknown directive #" + d[1]);
                return;
            }
            var lab = /^:(\w+)$/.exec(text) || /^(\w+):$/.exec(text);
            if (lab) {
                var l = lab[1].toLowerCase();
                if (l in labels) errors.push("line " + lineNo + ": label " + lab[1] + " twice");
                labels[l] = program.length + pending.length;
                return;
            }
            pending.push([text, lineNo]);
        });
        if (configured) {
            var spent = CONFIG.reduce(function (n, k) { return n + config[k]; }, 0);
            if (spent > 12) errors.push("config spends " + spent + " points; there are 12");
        }
        // Second pass: instructions.
        pending.forEach(function (p) {
            var text = p[0], lineNo = p[1];
            var m = /^(\w+)\s*(.*)$/.exec(text);
            var op = m[1].toLowerCase(), args = m[2] ? m[2].split(",").map(function (s) { return s.trim(); }).filter(Boolean) : [];
            if (!(op in OPS)) { errors.push("line " + lineNo + ": unknown instruction " + m[1]); return; }
            if (args.length !== OPS[op][0]) { errors.push("line " + lineNo + ": " + op + " takes " + OPS[op][0] + " operand" + (OPS[op][0] === 1 ? "" : "s")); return; }
            var ins = { op: op, line: lineNo, text: text, cost: OPS[op][1] };
            if (args[0] !== undefined) ins.a = operand(args[0], labels, errors, lineNo);
            if (args[1] !== undefined) ins.b = operand(args[1], labels, errors, lineNo);
            var writes = { mov: 1, add: 1, sub: 1, mpy: 1, div: 1, mod: 1, and: 1, or: 1, xor: 1, not: 1, neg: 1, xchg: 1, pop: 1 };
            if (writes[op] && ins.a.t === "imm") errors.push("line " + lineNo + ": " + op + " can't write to " + args[0]);
            if (op === "ipo" && ins.b.t === "imm") errors.push("line " + lineNo + ": ipo needs somewhere to put the reading, like ax");
            if (op === "xchg" && ins.b.t === "imm") errors.push("line " + lineNo + ": xchg swaps two places");
            program.push(ins);
        });
        if (!program.length && !errors.length) errors.push("nothing to run");
        return { name: name, config: config, program: program, errors: errors, source: String(source) };
    }

    // ---- the tank ---------------------------------------------------------
    function Robot(id, asm, name) {
        this.id = id;
        this.name = (name || asm.name || "ROBOT " + (id + 1)).toUpperCase();
        this.program = asm.program;
        this.config = asm.config;
        this.source = asm.source;
        this.regs = [0, 0, 0, 0];
        this.mem = new Int32Array(1024);
        this.stack = [];
        this.ip = 0; this.cmpv = 0; this.loopc = 0; this.wait = 0;
        this.x = 0; this.y = 0; this.heading = 0; this.speed = 0; this.throttle = 0; this.steerq = 0;
        this.turret = 0; this.keepshift = false; this.arc = 8; this.overburn = false;
        this.armor = 100; this.heat = 0; this.shutdownAt = 475; this.down = false; this.alive = true;
        this.kills = 0; this.collisions = 0; this.shots = 0; this.hitsTaken = 0; this.cooldown = 0;
        this.errors = []; this.lastScan = null; this.scanAge = 99; this.killedBy = null; this.diedAt = null;
    }
    Robot.prototype.factor = function (k) { return 1 + 0.15 * this.config[k]; };

    // ---- the match --------------------------------------------------------
    function mulberry(seed) {
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) >>> 0;
            var t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function norm(a) { a %= 360; return a < 0 ? a + 360 : a; }
    function diff(a, b) { var d = norm(a - b); return d > 180 ? d - 360 : d; }   // signed, -180..180
    var RAD = Math.PI / 180;

    function Match(entries, options) {
        options = options || {};
        this.seed = options.seed === undefined ? 1 : options.seed;
        this.rand = mulberry(this.seed);
        this.maxTicks = options.maxTicks || MAX_TICKS;
        this.tick = 0; this.over = false; this.winner = null; this.log = [];
        this.missiles = []; this.bursts = [];
        var self = this;
        this.robots = entries.map(function (e, i) {
            var asm = e.program ? e : assemble(e.source);
            if (asm.errors.length) throw new Error((e.name || asm.name || "robot " + (i + 1)) + ": " + asm.errors[0]);
            var r = new Robot(i, asm, e.name);
            // A spot of its own: on a ring, in order, with a nudge.
            var ang = (i / entries.length) * 2 * Math.PI + self.rand() * 0.5;
            r.x = SIZE / 2 + Math.cos(ang) * 350 + (self.rand() - 0.5) * 60;
            r.y = SIZE / 2 + Math.sin(ang) * 350 + (self.rand() - 0.5) * 60;
            r.heading = Math.floor(self.rand() * 360);
            return r;
        });
    }

    Match.prototype.alive = function () { return this.robots.filter(function (r) { return r.alive; }); };

    // One instruction. Returns its cost in cycles.
    Match.prototype.step = function (r) {
        var ins = r.program[r.ip];
        if (!ins) { r.ip = 0; ins = r.program[0]; }
        var self = this;
        function read(o) {
            if (o.t === "reg") return r.regs[o.r];
            if (o.t === "imm") return o.v;
            var a = o.t === "mem" ? o.a : r.regs[o.r];
            if (a < 0 || a >= 1024) { fault("memory " + a + " is off the end"); return 0; }
            return r.mem[a];
        }
        function write(o, v) {
            v |= 0;
            if (o.t === "reg") { r.regs[o.r] = v; return; }
            if (o.t === "imm") return;
            var a = o.t === "mem" ? o.a : r.regs[o.r];
            if (a < 0 || a >= 1024) { fault("memory " + a + " is off the end"); return; }
            r.mem[a] = v;
        }
        function fault(msg) { if (r.errors.length < 20) r.errors.push("tick " + self.tick + ", line " + ins.line + ": " + msg); }
        var a, b, next = r.ip + 1;
        switch (ins.op) {
            case "mov": write(ins.a, read(ins.b)); break;
            case "add": write(ins.a, read(ins.a) + read(ins.b)); break;
            case "sub": write(ins.a, read(ins.a) - read(ins.b)); break;
            case "mpy": write(ins.a, read(ins.a) * read(ins.b)); break;
            case "div": b = read(ins.b); if (b === 0) { fault("divide by zero"); write(ins.a, 0); } else write(ins.a, Math.trunc(read(ins.a) / b)); break;
            case "mod": b = read(ins.b); if (b === 0) { fault("mod by zero"); write(ins.a, 0); } else write(ins.a, read(ins.a) % b); break;
            case "and": write(ins.a, read(ins.a) & read(ins.b)); break;
            case "or": write(ins.a, read(ins.a) | read(ins.b)); break;
            case "xor": write(ins.a, read(ins.a) ^ read(ins.b)); break;
            case "not": write(ins.a, ~read(ins.a)); break;
            case "neg": write(ins.a, -read(ins.a)); break;
            case "xchg": a = read(ins.a); write(ins.a, read(ins.b)); write(ins.b, a); break;
            case "cmp": r.cmpv = read(ins.a) - read(ins.b); break;
            case "jmp": next = read(ins.a); break;
            case "je": case "jz": if (r.cmpv === 0) next = read(ins.a); break;
            case "jne": case "jnz": if (r.cmpv !== 0) next = read(ins.a); break;
            case "jg": case "jgr": if (r.cmpv > 0) next = read(ins.a); break;
            case "jl": case "jls": if (r.cmpv < 0) next = read(ins.a); break;
            case "jge": if (r.cmpv >= 0) next = read(ins.a); break;
            case "jle": if (r.cmpv <= 0) next = read(ins.a); break;
            case "call": if (r.stack.length >= 64) fault("stack overflow"); else { r.stack.push(next); next = read(ins.a); } break;
            case "ret": if (!r.stack.length) fault("ret with nothing to return to"); else next = r.stack.pop(); break;
            case "push": if (r.stack.length >= 64) fault("stack overflow"); else r.stack.push(read(ins.a)); break;
            case "pop": if (!r.stack.length) fault("pop from an empty stack"); else write(ins.a, r.stack.pop()); break;
            case "do": r.loopc = read(ins.a); break;
            case "loop": if (--r.loopc > 0) next = read(ins.a); break;
            case "delay": r.wait = Math.max(0, read(ins.a)); break;
            case "nop": break;
            case "err": fault("err " + read(ins.a)); break;
            case "opo": this.opo(r, read(ins.a), read(ins.b)); break;
            case "ipo": write(ins.b, this.ipo(r, read(ins.a))); break;
            case "int": this.interrupt(r, read(ins.a)); break;
        }
        if (next < 0 || next >= r.program.length) { fault("jumped off the program"); next = 0; }
        r.ip = next;
        return ins.cost;
    };

    Match.prototype.opo = function (r, port, v) {
        switch (port) {
            case 11: r.throttle = Math.max(-75, Math.min(100, v)); break;
            case 12: r.turret = norm(r.turret + v); break;
            case 13: r.turret = norm(v); break;
            case 14: r.steerq += v; break;
            case 15: this.fire(r, Math.max(-4, Math.min(4, v))); break;
            case 17: r.arc = Math.max(1, Math.min(64, v)); break;
            case 18: r.overburn = v !== 0; break;
            case 20: r.shutdownAt = Math.max(100, Math.min(500, v)); break;
        }
    };
    Match.prototype.ipo = function (r, port) {
        switch (port) {
            case 1: return Math.round(r.speed / this.maxSpeed(r) * 100);
            case 2: return Math.round(r.heat);
            case 3: return Math.round(r.heading) % 360;
            case 4: return Math.round(r.turret);
            case 5: return Math.round(norm(r.heading + r.turret));
            case 6: return Math.round(100 - r.armor);
            case 7: return this.scan(r);
            case 8: return r.lastScan && r.scanAge === 0 ? r.lastScan.accuracy : 0;
            case 9: return this.radar(r);
            case 10: return Math.floor(this.rand() * 65536);
            default: return 0;
        }
    };
    Match.prototype.interrupt = function (r, n) {
        switch (n) {
            case 0: this.kill(r, null, "self-destruct"); break;
            case 1: r.ip = -1; r.regs = [0, 0, 0, 0]; r.stack = []; r.cmpv = 0; r.loopc = 0; break;
            case 2: r.regs[0] = Math.round(r.x); r.regs[1] = Math.round(r.y); break;
            case 3: r.keepshift = r.regs[0] !== 0; break;
            case 4: r.overburn = r.regs[0] !== 0; break;
            case 5: r.regs[0] = r.id; break;
            case 6: r.regs[0] = this.tick & 0xffff; r.regs[1] = this.tick >>> 16; break;
            case 7: r.regs[0] = Math.round(norm(Math.atan2(r.regs[1] - r.y, r.regs[0] - r.x) / RAD)); break;
            case 10: r.regs[0] = this.alive().length; r.regs[1] = this.tick; break;
            case 12: r.regs[0] = r.collisions; break;
            case 13: r.collisions = 0; break;
            case 18: r.regs[0] = r.kills; break;
        }
    };

    Match.prototype.maxSpeed = function (r) { return 4 * r.factor("engine") * (r.overburn ? 1.3 : 1); };
    Match.prototype.scanRange = function (r) { return 500 * r.factor("scanner"); };

    // The scanner: the nearest other tank within the arc, and where in it.
    Match.prototype.scan = function (r) {
        var aim = norm(r.heading + r.turret), range = this.scanRange(r), best = null, bestD = Infinity;
        this.robots.forEach(function (o) {
            if (o === r || !o.alive) return;
            var dx = o.x - r.x, dy = o.y - r.y, d = Math.sqrt(dx * dx + dy * dy);
            if (d > range) return;
            var off = diff(Math.atan2(dy, dx) / RAD, aim);
            if (Math.abs(off) <= r.arc && d < bestD) { bestD = d; best = { d: d, off: off }; }
        });
        var acc = best ? Math.max(-2, Math.min(2, Math.round(best.off / r.arc * 2))) : 0;
        r.lastScan = { heading: aim, arc: r.arc, range: range, hit: !!best, accuracy: acc, dist: best ? best.d : 0 };
        r.scanAge = 0;
        return best ? Math.round(best.d) : 0;
    };
    Match.prototype.radar = function (r) {
        var bestD = 0;
        this.robots.forEach(function (o) {
            if (o === r || !o.alive) return;
            var d = Math.hypot(o.x - r.x, o.y - r.y);
            if (!bestD || d < bestD) bestD = d;
        });
        return Math.round(bestD);
    };
    // A shot every eight ticks at most, a little wild, and warm.
    Match.prototype.fire = function (r, adjust) {
        if (r.cooldown > 0 || r.down) return;
        r.cooldown = 8;
        r.shots++;
        var spread = (this.rand() - 0.5) * 3;
        var h = norm(r.heading + r.turret + adjust * r.arc / 4 + spread);
        r.heat += 15 * (r.overburn ? 1.5 : 1);
        this.missiles.push({ x: r.x, y: r.y, h: h, owner: r.id, speed: 30 * (r.overburn ? 1.25 : 1), range: 1500,
            damage: 8 * r.factor("weapon") * (r.overburn ? 1.3 : 1) });
    };
    Match.prototype.kill = function (r, by, how) {
        if (!r.alive) return;
        r.alive = false; r.armor = 0; r.diedAt = this.tick; r.killedBy = by ? by.name : how;
        this.bursts.push({ x: r.x, y: r.y, t: 0, size: 40 });
        if (by && by !== r) by.kills++;
        this.log.push("tick " + this.tick + ": " + r.name + (by ? " destroyed by " + by.name : " " + how));
    };
    Match.prototype.hurt = function (r, amount, by, how) {
        if (!r.alive) return;
        r.armor -= amount / r.factor("armor");
        r.hitsTaken++;
        if (r.armor <= 0) this.kill(r, by, how);
    };

    // One tick: every tank thinks, then everything moves.
    Match.prototype.update = function () {
        if (this.over) return;
        var self = this, alive = this.alive();
        alive.forEach(function (r) {
            if (r.cooldown > 0) r.cooldown--;
            r.scanAge++;
            if (r.down) return;
            var cycles = CYCLES;
            while (cycles > 0 && r.alive) {
                if (r.wait > 0) { var w = Math.min(r.wait, cycles); r.wait -= w; cycles -= w; continue; }
                cycles -= self.step(r);
            }
        });
        alive.forEach(function (r) {
            if (!r.alive) return;
            // heat
            r.heat += r.overburn ? 0.6 : 0;
            r.heat = Math.max(0, r.heat - (0.5 + 0.3 * r.config.heatsinks));
            if (r.heat >= 500) { r.heat = 500; self.hurt(r, 1, null, "burned up"); }
            if (!r.down && r.heat >= r.shutdownAt) { r.down = true; self.log.push("tick " + self.tick + ": " + r.name + " shut down, overheated"); }
            if (r.down && r.heat < r.shutdownAt - 125) r.down = false;
            // steering, with inertia
            var turn = Math.max(-8, Math.min(8, r.steerq));
            if (r.down) turn = 0;
            r.steerq -= turn;
            r.heading = norm(r.heading + turn);
            if (r.keepshift) r.turret = norm(r.turret - turn);
            // speed toward the throttle
            var want = (r.down ? 0 : r.throttle / 100) * self.maxSpeed(r), accel = 0.25 * r.factor("engine");
            if (r.speed < want) r.speed = Math.min(want, r.speed + accel);
            else if (r.speed > want) r.speed = Math.max(want, r.speed - accel * 2);
            r.x += Math.cos(r.heading * RAD) * r.speed;
            r.y += Math.sin(r.heading * RAD) * r.speed;
            // walls
            var hit = false;
            if (r.x < RADIUS) { r.x = RADIUS; hit = true; }
            if (r.x > SIZE - RADIUS) { r.x = SIZE - RADIUS; hit = true; }
            if (r.y < RADIUS) { r.y = RADIUS; hit = true; }
            if (r.y > SIZE - RADIUS) { r.y = SIZE - RADIUS; hit = true; }
            if (hit) {
                if (Math.abs(r.speed) > 1) { self.hurt(r, Math.abs(r.speed), null, "drove into a wall"); r.collisions++; self.bursts.push({ x: r.x, y: r.y, t: 0, size: 10 }); }
                r.speed = 0;
            }
        });
        // tank on tank
        for (var i = 0; i < alive.length; i++) for (var j = i + 1; j < alive.length; j++) {
            var a = alive[i], b = alive[j];
            if (!a.alive || !b.alive) continue;
            var dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
            if (d < 2 * RADIUS && d > 0) {
                var push = (2 * RADIUS - d) / 2;
                a.x -= dx / d * push; a.y -= dy / d * push; b.x += dx / d * push; b.y += dy / d * push;
                a.speed *= 0.5; b.speed *= 0.5; a.collisions++; b.collisions++;
                self.hurt(a, 1, b, "rammed"); self.hurt(b, 1, a, "rammed");
            }
        }
        // missiles
        this.missiles = this.missiles.filter(function (m) {
            var steps = 4, dx = Math.cos(m.h * RAD) * m.speed / steps, dy = Math.sin(m.h * RAD) * m.speed / steps;
            for (var s = 0; s < steps; s++) {
                m.x += dx; m.y += dy; m.range -= m.speed / steps;
                if (m.x < 0 || m.y < 0 || m.x > SIZE || m.y > SIZE || m.range <= 0) { self.bursts.push({ x: m.x, y: m.y, t: 0, size: 6 }); return false; }
                for (var k = 0; k < self.robots.length; k++) {
                    var r = self.robots[k];
                    if (!r.alive || r.id === m.owner) continue;
                    if (Math.hypot(r.x - m.x, r.y - m.y) < RADIUS + 3) {
                        self.bursts.push({ x: m.x, y: m.y, t: 0, size: 16 });
                        self.hurt(r, m.damage, self.robots[m.owner], "shot");
                        return false;
                    }
                }
            }
            return true;
        });
        this.bursts = this.bursts.filter(function (b) { return ++b.t < 18; });
        this.tick++;
        var left = this.alive();
        if (left.length <= 1 || this.tick >= this.maxTicks) {
            this.over = true;
            if (left.length === 1) this.winner = left[0];
            else if (left.length > 1) this.winner = left.slice().sort(function (p, q) { return q.armor - p.armor; })[0];
            else this.winner = null;
            this.log.push("tick " + this.tick + ": " + (this.winner ? this.winner.name + " wins" : "nobody wins"));
        }
    };
    Match.prototype.run = function (ticks) {
        for (var i = 0; i < ticks && !this.over; i++) this.update();
        return this.over;
    };

    return { SIZE: SIZE, RADIUS: RADIUS, PORTS: PORTS, INTS: INTS, OPS: OPS, assemble: assemble, Match: Match, norm: norm, diff: diff };
}));
