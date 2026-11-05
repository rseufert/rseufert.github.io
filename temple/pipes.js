/* temple/pipes.js: the twelve sovereign hexagrams and the twelve pipes.
   The Han calendar gives each month a hexagram, the yang lines rising
   from the bottom after the winter solstice (Return, 24, one whole line)
   to the fourth month (Heaven, 1, all six) and the yin lines rising after
   the summer solstice (the Meeting, 44) to the tenth (Earth, 2, all six
   broken). It gives each month a pitch pipe as well, the twelve lü, which
   rise a semitone at a time from the foundation, Huángzhōng, in the
   solstice's month. So each of the twelve hexagrams has a note.

   Where the foundation sits is a choice, and the page lets you make it:
   "c" puts Huángzhōng on C, as modern tables usually write it; "season"
   puts it on the note of the sign the winter solstice opens, Capricorn,
   which by Case's tone scale is A, so the hexagrams go round the wheel
   with the year. The choice is kept in this browser (localStorage
   temple-pipes) and shared by the neck and the changes. No library. */
(function () {
    "use strict";
    // From the solstice's month on: the hexagram's number in King Wen's order, its name in pinyin and in English
    // (as the changes have them), the month, and the pipe in characters and pinyin.
    var TWELVE = [
        [24, "Fù", "return", "the eleventh month, the winter solstice's", "黃鐘", "Huángzhōng"],
        [19, "Lín", "approach", "the twelfth month", "大呂", "Dàlǚ"],
        [11, "Tài", "peace", "the first month, spring's start", "太簇", "Tàicù"],
        [34, "Dà Zhuàng", "great strength", "the second month, the spring equinox's", "夾鐘", "Jiāzhōng"],
        [43, "Guài", "resolution, the break", "the third month", "姑洗", "Gūxiǎn"],
        [1, "Qián", "heaven, the strong", "the fourth month, summer's start", "仲呂", "Zhònglǚ"],
        [44, "Gòu", "the meeting", "the fifth month, the summer solstice's", "蕤賓", "Ruíbīn"],
        [33, "Dùn", "retreat", "the sixth month", "林鐘", "Línzhōng"],
        [12, "Pǐ", "standstill", "the seventh month, autumn's start", "夷則", "Yízé"],
        [20, "Guān", "looking, being seen", "the eighth month, the autumn equinox's", "南呂", "Nánlǚ"],
        [23, "Bō", "stripping away", "the ninth month", "無射", "Wúyì"],
        [2, "Kūn", "earth, the yielding", "the tenth month, winter's start", "應鐘", "Yìngzhōng"]
    ];
    var MODES = { c: { foundation: 0, say: "黃鐘 on C" }, season: { foundation: 9, say: "黃鐘 at the solstice, on A" } };
    var KEY = "temple-pipes", mode = "c", listeners = [];
    try { var kept = localStorage.getItem(KEY); if (MODES[kept]) mode = kept; } catch (e) { /* the default */ }

    function mod(a, n) { return ((a % n) + n) % n; }
    function entry(k) {
        var t = TWELVE[k];
        return { k: k, hex: t[0], glyph: String.fromCharCode(0x4DC0 + t[0] - 1), name: t[1], en: t[2], month: t[3], pipe: t[4], pinyin: t[5] };
    }
    // The hexagram on a note (0 C to 11 B), in the mode given or the one chosen.
    function onNote(pc, m) { return entry(mod(pc - MODES[m || mode].foundation, 12)); }
    // The note of a hexagram (King Wen's number, 1 to 64), or null for the fifty-two that keep no month.
    function noteOf(hex, m) {
        for (var k = 0; k < 12; k++) if (TWELVE[k][0] === hex) return mod(MODES[m || mode].foundation + k, 12);
        return null;
    }
    function ofHex(hex) { for (var k = 0; k < 12; k++) if (TWELVE[k][0] === hex) return entry(k); return null; }
    function set(m) {
        if (!MODES[m] || m === mode) return;
        mode = m;
        try { localStorage.setItem(KEY, m); } catch (e) { /* this visit only */ }
        listeners.forEach(function (f) { f(m); });
    }
    // Another tab of the site changing it.
    window.addEventListener("storage", function (e) { if (e.key === KEY && MODES[e.newValue] && e.newValue !== mode) { mode = e.newValue; listeners.forEach(function (f) { f(mode); }); } });

    window.Pipes = {
        MODES: MODES,
        mode: function () { return mode; },
        set: set,
        toggle: function () { set(mode === "c" ? "season" : "c"); return mode; },
        onChange: function (f) { listeners.push(f); },
        onNote: onNote, noteOf: noteOf, ofHex: ofHex,
        all: function () { return TWELVE.map(function (t, k) { return entry(k); }); }
    };
})();
