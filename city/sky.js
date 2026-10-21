// The sky over the city (city/city.js draws it): the real one, for Portland.
//
// A catalogue of the brighter stars in the constellations you can pick out
// without a chart, with the lines a chart would draw, and the arithmetic
// that turns a star's fixed place on the sky (right ascension and
// declination, J2000) into where it is over your head at a given moment
// from a given place. The sky turns because the Earth does: once a day
// about the axis that points at the north celestial pole, which Polaris
// sits almost on, so Polaris holds still at an altitude equal to your
// latitude (45.5° in Portland) and everything else wheels round it
// anticlockwise, fifteen degrees an hour. Stars within 45.5° of the pole
// never set here: the Dipper, the Little Dipper, Cassiopeia, Cepheus and
// most of Draco are up every night of the year, somewhere on their circle.
// The rest rise in the east and set in the west, and because a sidereal
// day is four minutes short of a solar one, each night's sky is four
// minutes ahead of the last, which is why there are summer stars and
// winter stars. The Sun and Moon are placed by short formulae good to
// about a degree, which is enough to know whether it is dark.
(function (root) {
    "use strict";
    var D = Math.PI / 180;
    // name, right ascension (hours), declination (degrees), magnitude, constellation
    var STARS = [
        ["Dubhe", 11.062, 61.75, 1.8, "UMa"], ["Merak", 11.031, 56.38, 2.4, "UMa"], ["Phecda", 11.897, 53.69, 2.4, "UMa"], ["Megrez", 12.257, 57.03, 3.3, "UMa"],
        ["Alioth", 12.900, 55.96, 1.8, "UMa"], ["Mizar", 13.399, 54.93, 2.2, "UMa"], ["Alkaid", 13.792, 49.31, 1.9, "UMa"],
        ["Polaris", 2.530, 89.26, 2.0, "UMi"], ["Yildun", 17.537, 86.59, 4.4, "UMi"], ["ε UMi", 16.766, 82.04, 4.2, "UMi"], ["ζ UMi", 15.734, 77.79, 4.3, "UMi"],
        ["Kochab", 14.845, 74.16, 2.1, "UMi"], ["Pherkad", 15.345, 71.83, 3.0, "UMi"], ["η UMi", 16.292, 75.75, 5.0, "UMi"],
        ["Caph", 0.153, 59.15, 2.3, "Cas"], ["Schedar", 0.675, 56.54, 2.2, "Cas"], ["Navi", 0.945, 60.72, 2.5, "Cas"], ["Ruchbah", 1.430, 60.24, 2.7, "Cas"], ["Segin", 1.907, 63.67, 3.4, "Cas"],
        ["Alderamin", 21.310, 62.59, 2.5, "Cep"], ["Alfirk", 21.478, 70.56, 3.2, "Cep"], ["Errai", 23.656, 77.63, 3.2, "Cep"], ["ζ Cep", 22.181, 58.20, 3.4, "Cep"], ["ι Cep", 22.828, 66.20, 3.5, "Cep"], ["δ Cep", 22.486, 58.42, 4.0, "Cep"],
        ["Eltanin", 17.943, 51.49, 2.2, "Dra"], ["Rastaban", 17.507, 52.30, 2.8, "Dra"], ["ν Dra", 17.537, 55.17, 4.9, "Dra"], ["Grumium", 17.892, 56.87, 3.7, "Dra"], ["Altais", 19.209, 67.66, 3.1, "Dra"],
        ["χ Dra", 18.351, 72.73, 3.6, "Dra"], ["ζ Dra", 17.146, 65.71, 3.2, "Dra"], ["η Dra", 16.400, 61.51, 2.7, "Dra"], ["θ Dra", 16.033, 58.56, 4.0, "Dra"], ["Edasich", 15.415, 58.97, 3.3, "Dra"],
        ["Thuban", 14.073, 64.38, 3.7, "Dra"], ["κ Dra", 12.558, 69.79, 3.9, "Dra"], ["λ Dra", 11.523, 69.33, 3.8, "Dra"],
        ["Betelgeuse", 5.919, 7.41, 0.5, "Ori"], ["Rigel", 5.242, -8.20, 0.1, "Ori"], ["Bellatrix", 5.419, 6.35, 1.6, "Ori"], ["Mintaka", 5.533, -0.30, 2.2, "Ori"], ["Alnilam", 5.604, -1.20, 1.7, "Ori"],
        ["Alnitak", 5.679, -1.94, 1.8, "Ori"], ["Saiph", 5.796, -9.67, 2.1, "Ori"], ["Meissa", 5.585, 9.93, 3.4, "Ori"],
        ["Sirius", 6.752, -16.72, -1.5, "CMa"], ["Mirzam", 6.378, -17.96, 2.0, "CMa"], ["Adhara", 6.977, -28.97, 1.5, "CMa"], ["Wezen", 7.140, -26.39, 1.8, "CMa"], ["Aludra", 7.401, -29.30, 2.4, "CMa"],
        ["Procyon", 7.655, 5.22, 0.4, "CMi"], ["Gomeisa", 7.452, 8.29, 2.9, "CMi"],
        ["Castor", 7.577, 31.89, 1.6, "Gem"], ["Pollux", 7.755, 28.03, 1.1, "Gem"], ["Alhena", 6.629, 16.40, 1.9, "Gem"], ["Wasat", 7.335, 21.98, 3.5, "Gem"], ["Mebsuta", 6.732, 25.13, 3.0, "Gem"], ["Tejat", 6.383, 22.51, 2.9, "Gem"], ["Mekbuda", 7.068, 20.57, 4.0, "Gem"],
        ["Aldebaran", 4.599, 16.51, 0.9, "Tau"], ["Elnath", 5.438, 28.61, 1.7, "Tau"], ["ζ Tau", 5.627, 21.14, 3.0, "Tau"], ["θ Tau", 4.477, 15.87, 3.4, "Tau"], ["γ Tau", 4.330, 15.63, 3.7, "Tau"], ["δ Tau", 4.382, 17.54, 3.8, "Tau"], ["ε Tau", 4.477, 19.18, 3.5, "Tau"], ["Pleiades", 3.791, 24.11, 2.9, "Tau"],
        ["Capella", 5.278, 46.00, 0.1, "Aur"], ["Menkalinan", 5.992, 44.95, 1.9, "Aur"], ["θ Aur", 5.995, 37.21, 2.6, "Aur"], ["ι Aur", 4.950, 33.17, 2.7, "Aur"], ["ε Aur", 5.033, 43.82, 3.0, "Aur"],
        ["Mirfak", 3.405, 49.86, 1.8, "Per"], ["Algol", 3.136, 40.96, 2.1, "Per"], ["γ Per", 3.080, 53.51, 2.9, "Per"], ["δ Per", 3.715, 47.79, 3.0, "Per"], ["ε Per", 3.964, 40.01, 2.9, "Per"], ["ζ Per", 3.902, 31.88, 2.9, "Per"],
        ["Vega", 18.616, 38.78, 0.0, "Lyr"], ["ε Lyr", 18.739, 39.67, 4.0, "Lyr"], ["ζ Lyr", 18.746, 37.60, 4.3, "Lyr"], ["δ Lyr", 18.908, 36.90, 4.3, "Lyr"], ["Sulafat", 18.982, 32.69, 3.2, "Lyr"], ["Sheliak", 18.835, 33.36, 3.5, "Lyr"],
        ["Deneb", 20.690, 45.28, 1.3, "Cyg"], ["Sadr", 20.370, 40.26, 2.2, "Cyg"], ["Albireo", 19.512, 27.96, 3.1, "Cyg"], ["Gienah", 20.770, 33.97, 2.5, "Cyg"], ["δ Cyg", 19.750, 45.13, 2.9, "Cyg"], ["ζ Cyg", 21.216, 30.23, 3.2, "Cyg"], ["ι Cyg", 19.496, 51.73, 3.8, "Cyg"],
        ["Altair", 19.846, 8.87, 0.8, "Aql"], ["Tarazed", 19.771, 10.61, 2.7, "Aql"], ["Alshain", 19.921, 6.41, 3.7, "Aql"], ["ζ Aql", 19.090, 13.86, 3.0, "Aql"], ["θ Aql", 20.188, -0.82, 3.2, "Aql"], ["δ Aql", 19.425, 3.11, 3.4, "Aql"], ["λ Aql", 19.102, -4.88, 3.4, "Aql"],
        ["Antares", 16.490, -26.43, 1.0, "Sco"], ["Graffias", 16.091, -19.81, 2.6, "Sco"], ["Dschubba", 16.006, -22.62, 2.3, "Sco"], ["π Sco", 15.981, -26.11, 2.9, "Sco"], ["σ Sco", 16.353, -25.59, 2.9, "Sco"], ["τ Sco", 16.598, -28.22, 2.8, "Sco"],
        ["ε Sco", 16.836, -34.29, 2.3, "Sco"], ["μ Sco", 16.864, -38.05, 3.0, "Sco"], ["ζ Sco", 16.909, -42.36, 3.6, "Sco"], ["η Sco", 17.203, -43.24, 3.3, "Sco"], ["Sargas", 17.622, -43.00, 1.9, "Sco"], ["ι Sco", 17.793, -40.13, 3.0, "Sco"], ["κ Sco", 17.708, -39.03, 2.4, "Sco"], ["Shaula", 17.560, -37.10, 1.6, "Sco"], ["Lesath", 17.513, -37.30, 2.7, "Sco"],
        ["Regulus", 10.140, 11.97, 1.4, "Leo"], ["Denebola", 11.818, 14.57, 2.1, "Leo"], ["Algieba", 10.333, 19.84, 2.0, "Leo"], ["Zosma", 11.235, 20.52, 2.6, "Leo"], ["ε Leo", 9.764, 23.77, 3.0, "Leo"], ["ζ Leo", 10.278, 23.42, 3.4, "Leo"], ["μ Leo", 9.879, 26.01, 3.9, "Leo"], ["η Leo", 10.122, 16.76, 3.5, "Leo"], ["Chertan", 11.237, 15.43, 3.3, "Leo"],
        ["Arcturus", 14.261, 19.18, 0.0, "Boo"], ["Izar", 14.750, 27.07, 2.4, "Boo"], ["Nekkar", 15.032, 40.39, 3.5, "Boo"], ["γ Boo", 14.535, 38.31, 3.0, "Boo"], ["δ Boo", 15.258, 33.31, 3.5, "Boo"], ["ρ Boo", 14.530, 30.37, 3.6, "Boo"], ["η Boo", 13.911, 18.40, 2.7, "Boo"],
        ["Spica", 13.420, -11.16, 1.0, "Vir"], ["Porrima", 12.694, -1.45, 2.7, "Vir"], ["Vindemiatrix", 13.036, 10.96, 2.8, "Vir"], ["ζ Vir", 13.578, -0.60, 3.4, "Vir"], ["δ Vir", 12.927, 3.40, 3.4, "Vir"], ["β Vir", 11.845, 1.76, 3.6, "Vir"], ["η Vir", 12.332, -0.67, 3.9, "Vir"],
        ["Markab", 23.079, 15.21, 2.5, "Peg"], ["Scheat", 23.063, 28.08, 2.4, "Peg"], ["Algenib", 0.220, 15.18, 2.8, "Peg"], ["Enif", 21.736, 9.88, 2.4, "Peg"], ["η Peg", 22.717, 30.22, 2.9, "Peg"], ["μ Peg", 22.833, 24.60, 3.5, "Peg"], ["θ Peg", 22.170, 6.20, 3.5, "Peg"],
        ["Alpheratz", 0.140, 29.09, 2.1, "And"], ["Mirach", 1.162, 35.62, 2.1, "And"], ["Almach", 2.065, 42.33, 2.1, "And"], ["δ And", 0.656, 30.86, 3.3, "And"], ["M31", 0.712, 41.27, 3.4, "And"],
        ["Alphecca", 15.578, 26.71, 2.2, "CrB"], ["β CrB", 15.464, 29.11, 3.7, "CrB"], ["γ CrB", 15.712, 26.30, 3.8, "CrB"], ["θ CrB", 15.549, 31.36, 4.1, "CrB"], ["δ CrB", 15.826, 26.07, 4.6, "CrB"], ["ε CrB", 15.959, 26.88, 4.1, "CrB"],
        ["ζ Her", 16.688, 31.60, 2.8, "Her"], ["η Her", 16.715, 38.92, 3.5, "Her"], ["ε Her", 17.005, 30.93, 3.9, "Her"], ["π Her", 17.251, 36.81, 3.2, "Her"], ["Kornephoros", 16.504, 21.49, 2.8, "Her"],
        ["Kaus Australis", 18.403, -34.38, 1.8, "Sgr"], ["Kaus Media", 18.350, -29.83, 2.7, "Sgr"], ["Kaus Borealis", 18.466, -25.42, 2.8, "Sgr"], ["φ Sgr", 18.763, -26.99, 3.2, "Sgr"], ["Nunki", 18.921, -26.30, 2.0, "Sgr"], ["τ Sgr", 19.116, -27.67, 3.3, "Sgr"], ["Ascella", 19.043, -29.88, 2.6, "Sgr"], ["Alnasl", 18.097, -30.42, 3.0, "Sgr"],
        ["Hamal", 2.120, 23.46, 2.0, "Ari"], ["Sheratan", 1.911, 20.81, 2.6, "Ari"], ["Mesarthim", 1.892, 19.29, 3.9, "Ari"]
    ];
    // The lines, by star name.
    var LINES = [
        ["Dubhe", "Merak"], ["Merak", "Phecda"], ["Phecda", "Megrez"], ["Megrez", "Dubhe"], ["Megrez", "Alioth"], ["Alioth", "Mizar"], ["Mizar", "Alkaid"],
        ["Polaris", "Yildun"], ["Yildun", "ε UMi"], ["ε UMi", "ζ UMi"], ["ζ UMi", "Kochab"], ["Kochab", "Pherkad"], ["Pherkad", "η UMi"], ["η UMi", "ζ UMi"],
        ["Caph", "Schedar"], ["Schedar", "Navi"], ["Navi", "Ruchbah"], ["Ruchbah", "Segin"],
        ["Alderamin", "Alfirk"], ["Alfirk", "Errai"], ["Errai", "ι Cep"], ["ι Cep", "ζ Cep"], ["ζ Cep", "Alderamin"], ["ζ Cep", "δ Cep"],
        ["Eltanin", "Rastaban"], ["Rastaban", "ν Dra"], ["ν Dra", "Grumium"], ["Grumium", "Eltanin"], ["Grumium", "Altais"], ["Altais", "χ Dra"], ["χ Dra", "ζ Dra"], ["ζ Dra", "η Dra"], ["η Dra", "θ Dra"], ["θ Dra", "Edasich"], ["Edasich", "Thuban"], ["Thuban", "κ Dra"], ["κ Dra", "λ Dra"],
        ["Betelgeuse", "Bellatrix"], ["Bellatrix", "Mintaka"], ["Mintaka", "Alnilam"], ["Alnilam", "Alnitak"], ["Alnitak", "Saiph"], ["Saiph", "Rigel"], ["Rigel", "Mintaka"], ["Betelgeuse", "Alnitak"], ["Bellatrix", "Meissa"], ["Meissa", "Betelgeuse"],
        ["Sirius", "Mirzam"], ["Sirius", "Wezen"], ["Wezen", "Adhara"], ["Wezen", "Aludra"], ["Procyon", "Gomeisa"],
        ["Castor", "Mebsuta"], ["Mebsuta", "Tejat"], ["Pollux", "Wasat"], ["Wasat", "Mekbuda"], ["Mekbuda", "Alhena"], ["Castor", "Pollux"],
        ["Elnath", "ε Tau"], ["ε Tau", "δ Tau"], ["δ Tau", "γ Tau"], ["γ Tau", "θ Tau"], ["θ Tau", "Aldebaran"], ["Aldebaran", "ζ Tau"],
        ["Capella", "Menkalinan"], ["Menkalinan", "θ Aur"], ["θ Aur", "Elnath"], ["Elnath", "ι Aur"], ["ι Aur", "ε Aur"], ["ε Aur", "Capella"],
        ["γ Per", "Mirfak"], ["Mirfak", "δ Per"], ["δ Per", "ε Per"], ["ε Per", "ζ Per"], ["Mirfak", "Algol"],
        ["Vega", "ε Lyr"], ["Vega", "ζ Lyr"], ["ζ Lyr", "δ Lyr"], ["δ Lyr", "Sulafat"], ["Sulafat", "Sheliak"], ["Sheliak", "ζ Lyr"],
        ["Deneb", "Sadr"], ["Sadr", "Albireo"], ["δ Cyg", "Sadr"], ["Sadr", "Gienah"], ["Gienah", "ζ Cyg"], ["ι Cyg", "δ Cyg"],
        ["Alshain", "Altair"], ["Altair", "Tarazed"], ["Tarazed", "ζ Aql"], ["Altair", "δ Aql"], ["δ Aql", "λ Aql"], ["Altair", "θ Aql"],
        ["Graffias", "Dschubba"], ["Dschubba", "π Sco"], ["Dschubba", "σ Sco"], ["σ Sco", "Antares"], ["Antares", "τ Sco"], ["τ Sco", "ε Sco"], ["ε Sco", "μ Sco"], ["μ Sco", "ζ Sco"], ["ζ Sco", "η Sco"], ["η Sco", "Sargas"], ["Sargas", "ι Sco"], ["ι Sco", "κ Sco"], ["κ Sco", "Shaula"], ["Shaula", "Lesath"],
        ["Regulus", "η Leo"], ["η Leo", "Algieba"], ["Algieba", "ζ Leo"], ["ζ Leo", "μ Leo"], ["μ Leo", "ε Leo"], ["Algieba", "Zosma"], ["Zosma", "Denebola"], ["Denebola", "Chertan"], ["Chertan", "Regulus"], ["Zosma", "Chertan"],
        ["Arcturus", "Izar"], ["Izar", "δ Boo"], ["δ Boo", "Nekkar"], ["Nekkar", "γ Boo"], ["γ Boo", "ρ Boo"], ["ρ Boo", "Arcturus"], ["Arcturus", "η Boo"],
        ["Spica", "Porrima"], ["Porrima", "η Vir"], ["η Vir", "β Vir"], ["Porrima", "δ Vir"], ["δ Vir", "Vindemiatrix"], ["Spica", "ζ Vir"], ["ζ Vir", "δ Vir"],
        ["Markab", "Scheat"], ["Scheat", "Alpheratz"], ["Alpheratz", "Algenib"], ["Algenib", "Markab"], ["Markab", "θ Peg"], ["θ Peg", "Enif"], ["Scheat", "μ Peg"], ["μ Peg", "η Peg"],
        ["Alpheratz", "δ And"], ["δ And", "Mirach"], ["Mirach", "Almach"],
        ["θ CrB", "β CrB"], ["β CrB", "Alphecca"], ["Alphecca", "γ CrB"], ["γ CrB", "δ CrB"], ["δ CrB", "ε CrB"],
        ["ζ Her", "η Her"], ["η Her", "π Her"], ["π Her", "ε Her"], ["ε Her", "ζ Her"], ["ζ Her", "Kornephoros"],
        ["Alnasl", "Kaus Media"], ["Kaus Media", "Kaus Australis"], ["Kaus Australis", "Ascella"], ["Ascella", "τ Sgr"], ["τ Sgr", "Nunki"], ["Nunki", "φ Sgr"], ["φ Sgr", "Kaus Borealis"], ["Kaus Borealis", "Kaus Media"], ["φ Sgr", "Ascella"],
        ["Hamal", "Sheratan"], ["Sheratan", "Mesarthim"]
    ];
    var NAMES = {
        UMa: "URSA MAJOR", UMi: "URSA MINOR", Cas: "CASSIOPEIA", Cep: "CEPHEUS", Dra: "DRACO", Ori: "ORION", CMa: "CANIS MAJOR", CMi: "CANIS MINOR",
        Gem: "GEMINI", Tau: "TAURUS", Aur: "AURIGA", Per: "PERSEUS", Lyr: "LYRA", Cyg: "CYGNUS", Aql: "AQUILA", Sco: "SCORPIUS", Leo: "LEO",
        Boo: "BOÖTES", Vir: "VIRGO", Peg: "PEGASUS", And: "ANDROMEDA", CrB: "CORONA BOREALIS", Her: "HERCULES", Sgr: "SAGITTARIUS", Ari: "ARIES"
    };
    // What the labels say when you ask: a line each, the lore of the sky.
    var ABOUT = {
        UMa: "the great bear. the seven bright ones are the big dipper, an asterism, not a constellation: the bear is bigger. it never sets here.",
        UMi: "the little bear, the little dipper. polaris is the end of its handle, half a degree from the pole, which is why it stands still.",
        Cas: "the queen on her chair, a W, or an M by morning. across the pole from the dipper: when one is high the other is low.",
        Cep: "the king, a house with a steep roof, dim, between cassiopeia and the pole. circumpolar here.",
        Dra: "the dragon, winding between the bears. thuban in its tail was the pole star when the pyramids were built; the pole drifts, 26,000 years a lap.",
        Ori: "the hunter. three stars in a row for a belt, betelgeuse red at one shoulder and rigel blue at the opposite foot. winter, in the south.",
        CMa: "the big dog, at orion's heel. sirius is the brightest star in the night, 8.6 light years off, which is next door.",
        CMi: "the little dog: procyon and a friend. it rises before sirius, which is what the name says.",
        Gem: "the twins, castor and pollux, side by side over orion's raised arm. winter and spring.",
        Tau: "the bull. aldebaran is its red eye, the V of the hyades its face, the pleiades the cluster on its shoulder. count the sisters: six, usually.",
        Aur: "the charioteer, a pentagon with capella at the top, nearly overhead on winter nights. capella is four stars pretending to be one.",
        Per: "the hero, between cassiopeia and the pleiades. algol is the demon star: it winks, every 2.87 days, because one star passes in front of another.",
        Lyr: "the lyre. vega, fifth brightest in the sky, was the pole star 14,000 years ago and will be again.",
        Cyg: "the swan, flying down the milky way, also the northern cross. deneb at its tail is 2,600 light years off and still that bright.",
        Aql: "the eagle. altair, with vega and deneb, makes the summer triangle, up all summer and into autumn.",
        Sco: "the scorpion, low in the south in summer, antares its red heart, the tail curling to shaula. it never gets high from portland.",
        Leo: "the lion. the sickle is its head, regulus at the bottom of the hook, denebola the tail. spring, in the evening.",
        Boo: "the herdsman, a kite with arcturus at the tail. follow the arc of the dipper's handle to arcturus, then speed on to spica.",
        Vir: "the maiden. spica, at the end of the arc from the dipper. spring and early summer.",
        Peg: "the winged horse, flying upside down. the great square is its body; the corner star belongs to andromeda. autumn.",
        And: "the chained princess. off her knee, the smudge is M31, the andromeda galaxy, 2.5 million light years off, the farthest thing you can see without help.",
        CrB: "the northern crown, a small arc of seven, alphecca its jewel. between arcturus and hercules.",
        Her: "hercules, upside down, the keystone his body. in the keystone's side is M13, a ball of a few hundred thousand stars.",
        Sgr: "the archer, drawn as a teapot. the centre of the galaxy is just past the spout, 26,000 light years away, behind the dust.",
        Ari: "the ram, three stars in a bent line. small, and the first sign of the zodiac, which is a different matter."
    };

    // ---- the arithmetic -----------------------------------------------------
    function jd(date) { return date.getTime() / 86400000 + 2440587.5; }
    // Local sidereal time in hours: where the sky's zero of right ascension is on your meridian.
    function lst(date, lon) {
        var t = jd(date) - 2451545.0;
        var gmst = 18.697374558 + 24.06570982441908 * t;
        return ((gmst + lon / 15) % 24 + 24) % 24;
    }
    // Right ascension and declination to altitude and azimuth (from north through east), in radians.
    function altaz(raH, decDeg, lstH, latDeg) {
        var H = (lstH - raH) * 15 * D, dec = decDeg * D, lat = latDeg * D;
        var sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(H);
        var alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
        var az = Math.atan2(-Math.cos(dec) * Math.sin(H), Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H));
        return { alt: alt, az: az };
    }
    function eclipticToEq(lonDeg, latDeg, t) {
        var eps = (23.439 - 0.0000004 * t) * D, l = lonDeg * D, b = latDeg * D;
        var ra = Math.atan2(Math.sin(l) * Math.cos(eps) - Math.tan(b) * Math.sin(eps), Math.cos(l)) / D / 15;
        var dec = Math.asin(Math.sin(b) * Math.cos(eps) + Math.cos(b) * Math.sin(eps) * Math.sin(l)) / D;
        return { ra: (ra + 24) % 24, dec: dec };
    }
    // The Sun, to about a degree: mean longitude and anomaly, two terms of the equation of centre.
    function sun(date) {
        var t = jd(date) - 2451545.0;
        var L = (280.460 + 0.9856474 * t) % 360, g = ((357.528 + 0.9856003 * t) % 360) * D;
        var lon = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
        var eq = eclipticToEq(lon, 0, t);
        eq.lon = (lon % 360 + 360) % 360;
        return eq;
    }
    // The Moon, to a degree or so: the biggest terms of its longitude and latitude; the phase from its elongation.
    function moon(date) {
        var t = jd(date) - 2451545.0;
        var Lp = 218.316 + 13.176396 * t, Mp = (134.963 + 13.064993 * t) * D, F = (93.272 + 13.229350 * t) * D;
        var lon = Lp + 6.289 * Math.sin(Mp), lat = 5.128 * Math.sin(F);
        var eq = eclipticToEq(lon, lat, t), s = sun(date);
        var elong = ((lon - s.lon) % 360 + 360) % 360;
        eq.phase = elong / 360;                                   // 0 new, 0.5 full
        eq.lit = (1 - Math.cos(elong * D)) / 2;
        return eq;
    }
    // Everything placed for a moment and a place: stars as unit directions (x east, y up, z north).
    function compute(date, lat, lon) {
        var L = lst(date, lon), stars = [], byName = {};
        STARS.forEach(function (s, i) {
            var p = altaz(s[1], s[2], L, lat);
            var st = { name: s[0], mag: s[3], con: s[4], alt: p.alt, az: p.az, x: Math.cos(p.alt) * Math.sin(p.az), y: Math.sin(p.alt), z: Math.cos(p.alt) * Math.cos(p.az) };
            stars.push(st); byName[s[0]] = i;
        });
        var lines = LINES.map(function (l) { return [byName[l[0]], byName[l[1]]]; });
        var su = sun(date), mo = moon(date), sp = altaz(su.ra, su.dec, L, lat), mp = altaz(mo.ra, mo.dec, L, lat);
        var cons = {};
        stars.forEach(function (s) { var c = cons[s.con] || (cons[s.con] = { x: 0, y: 0, z: 0, n: 0, alt: -9 }); c.x += s.x; c.y += s.y; c.z += s.z; c.n++; if (s.alt > c.alt) c.alt = s.alt; });
        Object.keys(cons).forEach(function (k) { var c = cons[k]; var m = Math.hypot(c.x, c.y, c.z) || 1; c.x /= m; c.y /= m; c.z /= m; c.name = NAMES[k]; c.about = ABOUT[k]; });
        return { stars: stars, lines: lines, cons: cons, lst: L, sun: { alt: sp.alt, az: sp.az }, moon: { alt: mp.alt, az: mp.az, phase: mo.phase, lit: mo.lit }, pole: altaz(0, 90, L, lat) };
    }
    root.CitySky = { compute: compute, lst: lst, altaz: altaz, sun: sun, moon: moon, STARS: STARS, LINES: LINES, NAMES: NAMES, ABOUT: ABOUT };
}(typeof self !== "undefined" ? self : this));
