// The arena's presets (js/arena-engine.js has the dialect): six tanks, each
// a lesson, and the starter that loads into the editor. They are strings so
// the page can show them and node can fight them (tools/arena_test.js).
(function (root, factory) {
    if (typeof module === "object" && module.exports) module.exports = factory();
    else root.ArenaRobots = factory();
}(typeof self !== "undefined" ? self : this, function () {
    "use strict";
    var robots = {};

    robots.sentry = [
        "#name SENTRY",
        "#config scanner=4 weapon=4 armor=2 engine=0 heatsinks=2",
        "; Sits where it was put and spins its scanner. Fires at whatever it",
        "; sees, corrected by where in the arc it saw it. The classic first robot:",
        "; read SENTRY, then write your own.",
        "  opo arc, 8            ; the scanner sees 8 degrees either side",
        ":look",
        "  ipo scan, ax          ; ax = range to the nearest enemy in the arc, 0 for none",
        "  cmp ax, 0",
        "  je turn",
        "  ipo accuracy, bx      ; bx = where in the arc, -2..2",
        "  opo fire, bx          ; fire, nudged by that much",
        "  jmp look",
        ":turn",
        "  opo rotate, 11        ; swing the turret on",
        "  jmp look"
    ].join("\n");

    robots.circler = [
        "#name CIRCLER",
        "#config scanner=3 weapon=2 armor=2 engine=4 heatsinks=1",
        "; Drives hard and turns away from walls, so it ends up circling the",
        "; arena. The turret keeps its own heading (int @keepshift) and sweeps",
        "; while the body does the driving.",
        "  mov ax, 1",
        "  int @keepshift",
        "  opo arc, 12",
        "  opo throttle, 100",
        ":drive",
        "  int @locate           ; ax = x, bx = y",
        "  cmp ax, 120",
        "  jl bounce",
        "  cmp ax, 880",
        "  jg bounce",
        "  cmp bx, 120",
        "  jl bounce",
        "  cmp bx, 880",
        "  jg bounce",
        "  jmp look",
        ":bounce",
        "  opo steer, 25         ; turn, and keep turning until clear",
        ":look",
        "  ipo scan, ax",
        "  cmp ax, 0",
        "  je sweep",
        "  ipo accuracy, bx",
        "  opo fire, bx",
        "  jmp drive",
        ":sweep",
        "  opo rotate, 16",
        "  jmp drive"
    ].join("\n");

    robots.rammer = [
        "#name RAMMER",
        "#config scanner=2 weapon=3 armor=4 engine=3 heatsinks=0",
        "; Points its whole body at the nearest thing it can see and drives into",
        "; it, firing on the way. Armor over heatsinks: it does not plan on a",
        "; long life, only a loud one.",
        "  opo arc, 32",
        "  opo aim, 0            ; turret straight ahead",
        ":hunt",
        "  ipo scan, ax",
        "  cmp ax, 0",
        "  je wander",
        "  ipo accuracy, bx",
        "  mov cx, bx",
        "  mpy cx, 8             ; a quarter of the arc per notch",
        "  opo steer, cx         ; turn the body onto it",
        "  opo throttle, 100",
        "  opo fire, bx",
        "  jmp hunt",
        ":wander",
        "  opo throttle, 40",
        "  opo steer, 9",
        "  jmp hunt"
    ].join("\n");

    robots.sniper = [
        "#name SNIPER",
        "#config scanner=5 weapon=5 armor=1 engine=1 heatsinks=0",
        "; A narrow arc and a slow sweep. Fires only when the target is dead",
        "; centre, so every shot counts, which it has to: no heatsinks and no",
        "; armor to speak of. Backs off from anything that gets close.",
        "  opo arc, 2",
        ":sweep",
        "  ipo scan, ax",
        "  cmp ax, 0",
        "  je next",
        "  ipo accuracy, bx",
        "  cmp bx, 0",
        "  jne nudge",
        "  opo fire, 0",
        "  jmp sweep",
        ":nudge",
        "  opo rotate, bx        ; walk the turret onto it",
        "  jmp sweep",
        ":next",
        "  opo rotate, 3",
        "  ipo radar, cx         ; cx = range to the nearest enemy, any direction",
        "  cmp cx, 200",
        "  jg hold",
        "  opo throttle, -50     ; too close: back away",
        "  jmp sweep",
        ":hold",
        "  opo throttle, 0",
        "  jmp sweep"
    ].join("\n");

    robots.dodger = [
        "#name DODGER",
        "#config scanner=3 weapon=2 armor=2 engine=4 heatsinks=1",
        "; Scans and fires like anyone, but keeps an eye on its own damage. The",
        "; moment it goes up, it turns somewhere random and runs for a bit.",
        "  opo arc, 10",
        "  mov cx, 0             ; cx = damage last seen",
        ":main",
        "  ipo damage, ax",
        "  cmp ax, cx",
        "  jg flinch",
        "  ipo scan, ax",
        "  cmp ax, 0",
        "  je turn",
        "  ipo accuracy, bx",
        "  opo fire, bx",
        "  jmp main",
        ":turn",
        "  opo rotate, 13",
        "  jmp main",
        ":flinch",
        "  mov cx, ax",
        "  ipo random, bx",
        "  mod bx, 180",
        "  sub bx, 90            ; somewhere between -90 and 89",
        "  opo steer, bx",
        "  opo throttle, 100",
        "  mov dx, 60            ; for sixty passes",
        ":run",
        "  ipo scan, ax",
        "  cmp ax, 0",
        "  je skip",
        "  ipo accuracy, bx",
        "  opo fire, bx",
        ":skip",
        "  sub dx, 1",
        "  cmp dx, 0",
        "  jg run",
        "  opo throttle, 0",
        "  jmp main"
    ].join("\n");

    robots.brick = [
        "#name BRICK",
        "#config scanner=0 weapon=0 armor=5 engine=5 heatsinks=2",
        "; The one that is wrong on purpose. It puts everything into armor and",
        "; engine, floors it, and never looks where it is going; the walls do",
        "; the rest. It is here so you can see what walls cost, and because",
        "; somebody always writes this one first.",
        "  opo throttle, 100",
        ":go",
        "  ipo heat, ax          ; checks its heat, which never changes",
        "  jmp go"
    ].join("\n");

    var starter = [
        "#name YOURS",
        "#config scanner=3 weapon=3 armor=2 engine=2 heatsinks=2",
        "; Your tank. Twelve points to spend above, five instructions a tick",
        "; below. Talk to the tank through ports: opo writes, ipo reads.",
        ";",
        ";   read   scan (range in the arc, 0 for none)  accuracy (-2..2)  radar",
        ";          heat  damage  compass  speedo  tofs  theading  random",
        ";   write  throttle (-75..100)  steer (turn by)  rotate (turret by)",
        ";          aim (turret offset)  fire (-4..4)  arc (1..64)  overburn",
        ";",
        "; int @locate puts x, y in ax, bx; int @keepshift (ax=1) lets the",
        "; turret keep its heading while you turn. HELP below has the rest.",
        "",
        "  opo arc, 8",
        ":look",
        "  ipo scan, ax",
        "  cmp ax, 0",
        "  je turn",
        "  ipo accuracy, bx",
        "  opo fire, bx",
        "  jmp look",
        ":turn",
        "  opo rotate, 11",
        "  jmp look"
    ].join("\n");

    return { robots: robots, order: ["sentry", "circler", "rammer", "sniper", "dodger", "brick"], starter: starter };
}));
