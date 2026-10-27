/* temple/tarot.js: the cards.
   The seventy-eight, drawn as line art from Waite's descriptions of the
   pictures Pamela Colman Smith painted in 1909 (the book is on the shelf),
   not traced from them: the trumps as small emblems, the pips laid out as
   the old packs lay them, the court as figures. Each card carries what the
   Golden Dawn laid on it in Book T: a letter and a planet, sign or element
   for the trumps, a decan of the zodiac for the twos to tens, thirty
   degrees for the Knights, Queens and Kings; so the ephemeris in
   js/zodiac.js can say which cards the Sun and the Moon stand in now, and
   js/hours.js whose trump the hour is. The spreads are Waite's: one card,
   three, and his "ancient Celtic method", ten cards about a significator,
   which here is the card the Sun stands in. Shuffled with the browser's
   random numbers; nothing stored or sent. One script, no library. */
(function () {
    "use strict";
    var Z = window.Zodiac, canvas = document.getElementById("tarot-stage");
    if (!Z || !canvas) return;
    var ctx = canvas.getContext("2d"), stage = canvas.parentNode;
    var readOut = document.getElementById("tarot-reading"), todayOut = document.getElementById("tarot-today"), deckOut = document.getElementById("tarot-deck");
    var saveLink = document.getElementById("tarot-save"), revBtn = document.getElementById("tarot-reversals"), againBtn = document.getElementById("tarot-again");
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace', SERIF = 'Georgia, "Times New Roman", serif';
    var INK = "#7cf5c8", DIM = "#2a5a4a", FAINT = "#163a2e", AMBER = "#ffb000", PAPER = "#020705", DPR = Math.min(2, window.devicePixelRatio || 1);
    var ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];
    // Waite's divinatory meanings, upright then reversed, from the Pictorial Key (1910), as the shelf's copy has them.
    var WAITE = {
        "King of Wands":["Dark man, friendly, countryman, generally married, honest and conscientious. The card always signifies honesty, and may mean news concerning an unexpected heritage to fall in before very long.","Good, but severe; austere, yet tolerant."],
        "Queen of Wands":["A dark woman, countrywoman, friendly, chaste, loving, honourable. If the card beside her signifies a man, she is well disposed towards him; if a woman, she is interested in the Querent. Also, love of money, or a certain success in business.","Good, economical, obliging, serviceable. Signifies also—but in certain positions and in the neighbourhood of other cards tending in such directions—opposition, jealousy, even deceit and infidelity."],
        "Knight of Wands":["Departure, absence, flight, emigration. A dark young man, friendly. Change of residence.","Rupture, division, interruption, discord,"],
        "Page of Wands":["Dark young man, faithful, a lover, an envoy, a postman. Beside a man, he will bear favourable testimony concerning him. A dangerous rival, if followed by the Page of Cups. Has the chief qualities of his suit. He may signify family intelligence.","Anecdotes, announcements, evil news. Also indecision and the instability which accompanies it."],
        "Ten of Wands":["A card of many significances, and some of the readings cannot be harmonized. I set aside that which connects it with honour and good faith. The chief meaning is oppression simply, but it is also fortune, gain, any kind of success, and then it is the oppression of these things. It is also a card of false-seeming, disguise, perfidy. The place which the figure is approaching may suffer from the rods that he carries. Success is stultified if the Nine of Swords follows, and if it is a question of a lawsuit, there will be certain loss.","Contrarieties, difficulties, intrigues, and their analogies."],
        "Nine of Wands":["The card signifies strength in opposition. If attacked, the person will meet an onslaught boldly; and his build shews, that he may prove a formidable antagonist. With this main significance there are all its possible adjuncts—delay, suspension, adjournment.","Obstacles, adversity, calamity."],
        "Seven of Wands":["It is a card of valour, for, on the surface, six are attacking one, who has, however, the vantage position. On the intellectual plane, it signifies discussion, wordy strife; in business—negotiations, war of trade, barter, competition. It is further a card of success, for the combatant is on the top and his enemies may be unable to reach him.","Perplexity, embarrassments, anxiety. It is also a caution against indecision."],
        "Six of Wands":["The card has been so designed that it can cover several significations; on the surface, it is a victor triumphing, but it is also great news, such as might be carried in state by the King's courier; it is expectation crowned with its own desire, the crown of hope, and so forth.","Apprehension, fear, as of a victorious enemy at the gate; treachery, disloyalty, as of gates being opened to the enemy; also indefinite delay."],
        "Five of Wands":["Imitation, as, for example, sham fight, but also the strenuous competition and struggle of the search after riches and fortune. In this sense it connects with the battle of life. Hence some attributions say that it is a card of gold, gain, opulence.","Litigation, disputes, trickery, contradiction."],
        "Four of Wands":["They are for once almost on the surface—country life, haven of refuge, a species of domestic harvest-home, repose, concord, harmony, prosperity, peace, and the perfected work of these.","The meaning remains unaltered; it is prosperity, increase, felicity, beauty, embellishment."],
        "Three of Wands":["He symbolizes established strength, enterprise, effort, trade, commerce, discovery; those are his ships, bearing his merchandise, which are sailing over the sea. The card also signifies able co-operation in business, as if the successful merchant prince were looking from his side towards yours with a view to help you.","The end of troubles, suspension or cessation of adversity, toil and disappointment."],
        "Two of Wands":["Between the alternative readings there is no marriage possible; on the one hand, riches, fortune, magnificence; on the other, physical suffering, disease, chagrin, sadness, mortification. The design gives one suggestion; here is a lord overlooking his dominion and alternately contemplating a globe; it looks like the malady, the mortification, the sadness of Alexander amidst the grandeur of this world's wealth.","Surprise, wonder, enchantment, emotion, trouble, fear."],
        "Ace of Wands":["Creation, invention, enterprise, the powers which result in these; principle, beginning, source; birth, family, origin, and in a sense the virility which is behind them; the starting point of enterprises; according to another account, money, fortune, inheritance.","Fall, decadence, ruin, perdition, to perish also a certain clouded joy."],
        "King of Cups":["Fair man, man of business, law, or divinity; responsible, disposed to oblige the Querent; also equity, art and science, including those who profess science, law and art; creative intelligence.","Dishonest, double-dealing man; roguery, exaction, injustice, vice, scandal, pillage, considerable loss."],
        "Queen of Cups":["Good, fair woman; honest, devoted woman, who will do service to the Querent; loving intelligence, and hence the gift of vision; success, happiness, pleasure; also wisdom, virtue; a perfect spouse and a good mother.","The accounts vary; good woman; otherwise, distinguished woman but one not to be trusted; perverse woman; vice, dishonour, depravity."],
        "Knight of Cups":["Arrival, approach—sometimes that of a messenger; advances, proposition, demeanour, invitation, incitement.","Trickery, artifice, subtlety, swindling, duplicity, fraud."],
        "Page of Cups":["Fair young man, one impelled to render service and with whom the Querent will be connected; a studious youth; news, message; application, reflection, meditation; also these things directed to business.","Taste, inclination, attachment, seduction, deception, artifice."],
        "Ten of Cups":["Contentment, repose of the entire heart; the perfection of that state; also perfection of human love and friendship; if with several picture-cards, a person who is taking charge of the Querent's interests; also the town, village or country inhabited by the Querent.","Repose of the false heart, indignation, violence."],
        "Nine of Cups":["Concord, contentment, physical bien-etre\\ also victory, success, advantage; satisfaction for the Querent or person for whom the consultation is made.","Truth, loyalty, liberty; but the readings vary and include mistakes, imperfections, etc."],
        "Eight of Cups":["The card speaks for itself on the surface, but other readings are entirely antithetical—giving joy, mildness, timidity, honour, modesty. In practice, it is usually found that the card shews the decline of a matter, or that a matter which has been thought to be important is really of slight consequence—either for good or evil.","Great joy, happiness, feasting."],
        "Seven of Cups":["Fairy favours, images of reflection, sentiment, imagination, things seen in the glass of contemplation; some attainment in these degrees, but nothing permanent or substantial is suggested.","Desire, will, determination, project."],
        "Six of Cups":["A card of the past and of memories, looking back, as—for example—on childhood; happiness, enjoyment, but coming rather from the past; things that have vanished. Another reading reverses this, giving new relations, new knowledge, new environment, and then the children are disporting in an unfamiliar precinct.","The future, renewal, that which will come to pass presently."],
        "Five of Cups":["It is a card of loss, but something remains over; three have been taken, but two are left; it is a card of inheritance, patrimony, transmission, but not corresponding to expectations; with some interpreters it is a card of marriage, but not without bitterness or frustration.","News, alliances, affinity, consanguinity, ancestry, return, false projects."],
        "Four of Cups":["Weariness, disgust, aversion, imaginary vexations, as if the wine of this world had caused satiety only; another wine, as if a fairy gift, is now offered the wastrel, but he sees no consolation therein. This is also a card of blended pleasure.","Novelty, presage, new instruction, new relations."],
        "Three of Cups":["The conclusion of any matter in plenty, perfection and merriment; happy issue, victory, fulfilment, solace, healing,","Expedition, dispatch, achievement, end. It signifies also the side of excess in physical enjoyment, and the pleasures of the senses."],
        "Two of Cups":["Love, passion, friendship, affinity, union, concord, sympathy, the interrelation of the sexes, and—as a suggestion apart from all offices of divination- that desire which is not in Nature, but by which Nature is sanctified.",""],
        "Ace of Cups":["House of the true heart, joy, content, abode, nourishment, abundance, fertility; Holy Table, felicity hereof.","House of the false heart, mutation, instability, revolution."],
        "King of Swords":["Whatsoever arises out of the idea of judgment and all its connexions-power, command, authority, militant intelligence, law, offices of the crown, and so forth.","Cruelty, perversity, barbarity, perfidy, evil intention."],
        "Queen of Swords":["Widowhood, female sadness and embarrassment, absence, sterility, mourning, privation, separation.","Malice, bigotry, artifice, prudery, bale, deceit."],
        "Knight of Swords":["Skill, bravery, capacity, defence, address, enmity, wrath, war, destruction, opposition, resistance, ruin. There is therefore a sense in which the card signifies death, but it carries this meaning only in its proximity to other cards of fatality.","Imprudence, incapacity, extravagance."],
        "Page of Swords":["Authority, overseeing, secret service, vigilance, spying, examination, and the qualities thereto belonging.","More evil side of these qualities; what is unforeseen, unprepared state; sickness is also intimated."],
        "Ten of Swords":["Whatsoever is intimated by the design; also pain, affliction, tears, sadness, desolation. It is not especially a card of violent death.","Advantage, profit, success, favour, but none of these are permanent; also power and authority."],
        "Nine of Swords":["Death, failure, miscarriage, delay, deception, disappointment, despair.","Imprisonment, suspicion, doubt, reasonable fear, shame."],
        "Eight of Swords":["Bad news, violent chagrin, crisis, censure, power in trammels, conflict, calumny; also sickness.","Disquiet, difficulty, opposition, accident, treachery; what is unforeseen; fatality."],
        "Seven of Swords":["Design, attempt, wish, hope, confidence; also quarrelling, a plan that may fail, annoyance. The design is uncertain in its import, because the significations are widely at variance with each other.","Good advice, counsel, instruction, slander, babbling."],
        "Six of Swords":["journey by water, route, way, envoy, commissionary, expedient.","Declaration, confession, publicity; one account says that it is a proposal of love."],
        "Five of Swords":["Degradation, destruction, revocation, infamy, dishonour, loss, with the variants and analogues of these.","The same; burial and obsequies."],
        "Four of Swords":["Vigilance, retreat, solitude, hermit's repose, exile, tomb and coffin. It is these last that have suggested the design.","Wise administration, circumspection, economy, avarice, precaution, testament."],
        "Three of Swords":["Removal, absence, delay, division, rupture, dispersion, and all that the design signifies naturally, being too simple and obvious to call for specific enumeration.","Mental alienation, error, loss, distraction, disorder, confusion."],
        "Two of Swords":["Conformity and the equipoise which it suggests, courage, friendship, concord in a state of arms; another reading gives tenderness, affection, intimacy. The suggestion of harmony and other favourable readings must be considered in a qualified manner, as Swords generally are not symbolical of beneficent forces in human affairs.","Imposture, falsehood, duplicity, disloyalty."],
        "Ace of Swords":["Triumph, the excessive degree in everything, conquest, triumph of force. It is a card of great force, in love as well as in hatred. The crown may carry a much higher significance than comes usually within the sphere of fortune-telling.","The same, but the results are disastrous; another account says—conception, childbirth, augmentation, multiplicity."],
        "King of Pentacles":["Valour, realizing intelligence, business and normal intellectual aptitude, sometimes mathematical gifts and attainments of this kind; success in these paths.","Vice, weakness, ugliness, perversity, corruption, peril."],
        "Queen of Pentacles":["Opulence, generosity, magnificence, security, liberty.","Evil, suspicion, suspense, fear, mistrust."],
        "Knight of Pentacles":["Utility, serviceableness, interest, responsibility, rectitude-all on the normal and external plane.","inertia, idleness, repose of that kind, stagnation; also placidity, discouragement, carelessness."],
        "Page of Pentacles":["Application, study, scholarship, reflection another reading says news, messages and the bringer thereof; also rule, management.","Prodigality, dissipation, liberality, luxury; unfavourable news."],
        "Ten of Pentacles":["Gain, riches; family matters, archives, extraction, the abode of a family.","Chance, fatality, loss, robbery, games of hazard; sometimes gift, dowry, pension."],
        "Nine of Pentacles":["Prudence, safety, success, accomplishment, certitude, discernment.","Roguery, deception, voided project, bad faith."],
        "Eight of Pentacles":["Work, employment, commission, craftsmanship, skill in craft and business, perhaps in the preparatory stage.","Voided ambition, vanity, cupidity, exaction, usury. It may also signify the possession of skill, in the sense of the ingenious mind turned to cunning and intrigue."],
        "Seven of Pentacles":["These are exceedingly contradictory; in the main, it is a card of money, business, barter; but one reading gives altercation, quarrels—and another innocence, ingenuity, purgation.","Cause for anxiety regarding money which it may be proposed to lend."],
        "Six of Pentacles":["Presents, gifts, gratification another account says attention, vigilance now is the accepted time, present prosperity, etc.","Desire, cupidity, envy, jealousy, illusion."],
        "Five of Pentacles":["The card foretells material trouble above all, whether in the form illustrated—that is, destitution—or otherwise. For some cartomancists, it is a card of love and lovers-wife, husband, friend, mistress; also concordance, affinities. These alternatives cannot be harmonized.","Disorder, chaos, ruin, discord, profligacy."],
        "Four of Pentacles":["The surety of possessions, cleaving to that which one has, gift, legacy, inheritance.","Suspense, delay, opposition."],
        "Three of Pentacles":["Metier, trade, skilled labour; usually, however, regarded as a card of nobility, aristocracy, renown, glory.","Mediocrity, in work and otherwise, puerility, pettiness, weakness."],
        "Two of Pentacles":["On the one hand it is represented as a card of gaiety, recreation and its connexions, which is the subject of the design; but it is read also as news and messages in writing, as obstacles, agitation, trouble, embroilment.","Enforced gaiety, simulated enjoyment, literal sense, handwriting, composition, letters of exchange."],
        "Ace of Pentacles":["Perfect contentment, felicity, ecstasy; also speedy intelligence; gold.","The evil side of wealth, bad intelligence; also great riches. In any case it shews prosperity, comfortable material conditions, but whether these are of advantage to the possessor will depend on whether the card is reversed or not."],
        "The Magician":["Skill, diplomacy, address, subtlety; sickness, pain, loss, disaster, snares of enemies; self-confidence, will; the Querent, if male.","Physician, Magus, mental disease, disgrace, disquiet."],
        "The High Priestess":["Secrets, mystery, the future as yet unrevealed; the woman who interests the Querent, if male; the Querent herself, if female; silence, tenacity; mystery, wisdom, science.","Passion, moral or physical ardour, conceit, surface knowledge."],
        "The Empress":["Fruitfulness, action, initiative, length of days; the unknown, clandestine; also difficulty, doubt, ignorance.","Light, truth, the unravelling of involved matters, public rejoicings; according to another reading, vacillation."],
        "The Emperor":["Stability, power, protection, realization; a great person; aid, reason, conviction; also authority and will.","Benevolence, compassion, credit; also confusion to enemies, obstruction, immaturity."],
        "The Hierophant":["Marriage, alliance, captivity, servitude; by another account, mercy and goodness; inspiration; the man to whom the Querent has recourse.","Society, good understanding, concord, overkindness, weakness."],
        "The Lovers":["Attraction, love, beauty, trials overcome.","Failure, foolish designs. Another account speaks of marriage frustrated and contrarieties of all kinds."],
        "The Chariot":["Succour, providence also war, triumph, presumption, vengeance, trouble.","Riot, quarrel, dispute, litigation, defeat."],
        "Strength":["Power, energy, action, courage, magnanimity; also complete success and honours.","Despotism, abuse if power, weakness, discord, sometimes even disgrace."],
        "The Hermit":["Prudence, circumspection; also and especially treason, dissimulation, roguery, corruption.","Concealment, disguise, policy, fear, unreasoned caution."],
        "Wheel of Fortune":["Destiny, fortune, success, elevation, luck, felicity.","Increase, abundance, superfluity."],
        "Justice":["Equity, rightness, probity, executive; triumph of the deserving side in law.","Law in all its departments, legal complications, bigotry, bias, excessive severity."],
        "The Hanged Man":["Wisdom, circumspection, discernment, trials, sacrifice, intuition, divination, prophecy.","Selfishness, the crowd, body politic."],
        "Death":["End, mortality, destruction, corruption also, for a man, the loss of a benefactor for a woman, many contrarieties; for a maid, failure of marriage projects.","Inertia, sleep, lethargy, petrifaction, somnambulism; hope destroyed."],
        "Temperance":["Economy, moderation, frugality, management, accommodation.","Things connected with churches, religions, sects, the priesthood, sometimes even the priest who will marry the Querent; also disunion, unfortunate combinations, competing interests."],
        "The Devil":["Ravage, violence, vehemence, extraordinary efforts, force, fatality; that which is predestined but is not for this reason evil.","Evil fatality, weakness, pettiness, blindness."],
        "The Tower":["Misery, distress, indigence, adversity, calamity, disgrace, deception, ruin. It is a card in particular of unforeseen catastrophe.","According to one account, the same in a lesser degree also oppression, imprisonment, tyranny."],
        "The Star":["Loss, theft, privation, abandonment; another reading says-hope and bright prospects,","Arrogance, haughtiness, impotence."],
        "The Moon":["Hidden enemies, danger, calumny, darkness, terror, deception, occult forces, error.","Instability, inconstancy, silence, lesser degrees of deception and error."],
        "The Sun":["Material happiness, fortunate marriage, contentment.","The same in a lesser sense."],
        "Judgement":["Change of position, renewal, outcome. Another account specifies total loss though lawsuit.","Weakness, pusillanimity, simplicity; also deliberation, decision, sentence."],
        "The Fool":["Folly, mania, extravagance, intoxication, delirium, frenzy, bewrayment.","Negligence, absence, distribution, carelessness, apathy, nullity, vanity."],
        "The World":["Assured success, recompense, voyage, route, emigration, flight, change of place.","Inertia, fixity, stagnation, permanence."]
    };
    // ---- the deck ----------------------------------------------------------------------
    // The trumps with the order's attributions: the letter, and the planet, sign or element.
    var TRUMP_OF = [["Aleph", "Air"], ["Beth", "Mercury"], ["Gimel", "Moon"], ["Daleth", "Venus"], ["Heh", "Aries"], ["Vav", "Taurus"], ["Zayin", "Gemini"], ["Cheth", "Cancer"], ["Teth", "Leo"], ["Yod", "Virgo"], ["Kaph", "Jupiter"], ["Lamed", "Libra"], ["Mem", "Water"], ["Nun", "Scorpio"], ["Samekh", "Sagittarius"], ["Ayin", "Capricorn"], ["Peh", "Mars"], ["Tzaddi", "Aquarius"], ["Qoph", "Pisces"], ["Resh", "Sun"], ["Shin", "Fire"], ["Tav", "Saturn"]];
    var SUITS = { Wands: "Fire", Cups: "Water", Swords: "Air", Pentacles: "Earth" };
    var COURT_ELEMENT = { Page: "earth", Knight: "fire", Queen: "water", King: "air" }, GD_NAME = { Page: "Princess", Knight: "Knight", Queen: "Queen", King: "Prince" };
    var QUAD = { Wands: "Cancer, Leo and Virgo", Cups: "Libra, Scorpio and Sagittarius", Swords: "Capricorn, Aquarius and Pisces", Pentacles: "Aries, Taurus and Gemini" };   // the quarter about the pole the Ace and the Page of each suit rule
    var DECK = Z.deck().map(function (c, i) {
        c.index = i; c.slug = "card-" + c.name.toLowerCase().replace(/[^a-z]+/g, "-");
        if (c.trump != null) { c.letter = TRUMP_OF[c.trump][0]; c.of = TRUMP_OF[c.trump][1]; }
        if (c.suit && c.rank >= 2 && c.rank <= 10) {
            // the decan: the sign of the suit's element and the rank's quality, and the decan within it
            var q = c.rank <= 4 ? "cardinal" : c.rank <= 7 ? "fixed" : "mutable", k = (c.rank - 2) % 3;
            var s = Z.SIGNS.filter(function (g) { return g.element === SUITS[c.suit] && g.quality === q; })[0];
            c.decan = Z.decan(Z.SIGNS.indexOf(s) * 30 + k * 10);
        }
        if (c.court && c.court !== "Page") {
            var qq = { Queen: "cardinal", King: "fixed", Knight: "mutable" }[c.court];
            var sg = Z.SIGNS.filter(function (g) { return g.element === SUITS[c.suit] && g.quality === qq; })[0], si = Z.SIGNS.indexOf(sg);
            c.from = Z.rev(si * 30 - 10); c.to = si * 30 + 20;
        }
        return c;
    });
    var BY = {}; DECK.forEach(function (c) { BY[c.name] = c; BY[c.slug] = c; });
    var DATES = Z.decanDates(new Date().getFullYear()), MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    function when(d) { var a = DATES[d.index], b = DATES[(d.index + 1) % 36]; return a && b ? "about " + MON[a.getUTCMonth()] + " " + a.getUTCDate() + " to " + MON[b.getUTCMonth()] + " " + b.getUTCDate() : ""; }

    // ---- a pen for card space: x from -1 to 1, y from -1.7 to 1.7, y down ------------------
    function pen(c, cx, cy, s, col, w) {
        var p = {
            col: col || INK, w: w || 1.5,
            X: function (x) { return cx + x * s; }, Y: function (y) { return cy + y * s; },
            set: function () { c.strokeStyle = p.col; c.fillStyle = p.col; c.lineWidth = p.w; c.lineCap = "round"; c.lineJoin = "round"; },
            line: function (pts) { p.set(); c.beginPath(); pts.forEach(function (q, i) { c[i ? "lineTo" : "moveTo"](p.X(q[0]), p.Y(q[1])); }); c.stroke(); return p; },
            poly: function (pts) { p.set(); c.beginPath(); pts.forEach(function (q, i) { c[i ? "lineTo" : "moveTo"](p.X(q[0]), p.Y(q[1])); }); c.closePath(); c.stroke(); return p; },
            circle: function (x, y, r, fill) { p.set(); c.beginPath(); c.arc(p.X(x), p.Y(y), r * s, 0, Math.PI * 2); if (fill) c.fill(); else c.stroke(); return p; },
            arc: function (x, y, r, a0, a1, ccw) { p.set(); c.beginPath(); c.arc(p.X(x), p.Y(y), r * s, a0 * Math.PI / 180, a1 * Math.PI / 180, !!ccw); c.stroke(); return p; },
            ellipse: function (x, y, rx, ry, rot) { p.set(); c.beginPath(); c.ellipse(p.X(x), p.Y(y), rx * s, ry * s, rot || 0, 0, Math.PI * 2); c.stroke(); return p; },
            star: function (x, y, r, n, rot, step) { step = step || Math.floor(n / 2); var pts = []; for (var i = 0; i < n; i++) { var a = (rot || -90) * Math.PI / 180 + i * step * 2 * Math.PI / n; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } return p.poly(pts); },
            rays: function (x, y, r0, r1, n, rot) { for (var i = 0; i < n; i++) { var a = (rot || 0) * Math.PI / 180 + i * 2 * Math.PI / n; p.line([[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a) * r1, y + Math.sin(a) * r1]]); } return p; },
            wave: function (x0, x1, y, amp, n) { var pts = [], N = n * 8; for (var i = 0; i <= N; i++) { var t = i / N; pts.push([x0 + (x1 - x0) * t, y + Math.sin(t * n * Math.PI * 2) * amp]); } return p.line(pts); },
            zig: function (x0, y0, x1, y1, n, amp) { var pts = [], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; for (var i = 0; i <= n; i++) { var t = i / n, o = (i % 2 ? amp : -amp) * (i && i < n ? 1 : 0); pts.push([x0 + dx * t + nx * o, y0 + dy * t + ny * o]); } return p.line(pts); },
            text: function (t, x, y, size, font, align) { c.fillStyle = p.col; c.font = (size * s) + "px " + (font || SERIF); c.textAlign = align || "center"; c.textBaseline = "middle"; c.fillText(t, p.X(x), p.Y(y)); return p; },
            dash: function (on) { c.setLineDash(on ? [3, 4] : []); return p; },
            head: function (x, y, r) { return p.circle(x, y, r || 0.12); },
            figure: function (x, y, h, opts) {   // a standing figure: head, body, arms, legs, h the height from crown to feet
                opts = opts || {}; var r = h * 0.09, top = y - h / 2;
                p.head(x, top + r, r); p.line([[x, top + r * 2], [x, top + h * 0.55]]);
                p.line([[x, top + h * 0.55], [x - h * 0.12, y + h / 2]]); p.line([[x, top + h * 0.55], [x + h * 0.12, y + h / 2]]);
                var sh = top + h * 0.28;
                p.line([[x, sh], opts.left || [x - h * 0.18, sh + h * 0.22]]); p.line([[x, sh], opts.right || [x + h * 0.18, sh + h * 0.22]]);
                return p;
            },
            flame: function (x, y, h) { return p.line([[x - h * 0.3, y], [x - h * 0.1, y - h * 0.5], [x, y - h * 0.2], [x + h * 0.15, y - h], [x + h * 0.3, y]]); },
            crown: function (x, y, w) { return p.line([[x - w / 2, y], [x - w / 2, y - w * 0.4], [x - w / 4, y - w * 0.15], [x, y - w * 0.5], [x + w / 4, y - w * 0.15], [x + w / 2, y - w * 0.4], [x + w / 2, y], [x - w / 2, y]]); },
            wings: function (x, y, w) { p.line([[x - 0.05, y], [x - w * 0.5, y - w * 0.35], [x - w * 0.95, y - w * 0.25], [x - w * 0.6, y + w * 0.1], [x - w * 0.3, y + w * 0.15]]); p.line([[x + 0.05, y], [x + w * 0.5, y - w * 0.35], [x + w * 0.95, y - w * 0.25], [x + w * 0.6, y + w * 0.1], [x + w * 0.3, y + w * 0.15]]); return p; },
            hills: function (y, h) { return p.line([[-1, y], [-0.7, y - h], [-0.4, y - h * 0.4], [-0.1, y - h * 1.2], [0.25, y - h * 0.5], [0.6, y - h * 0.9], [1, y]]); },
            cloud: function (x, y, r) { p.arc(x, y, r, 180, 360); p.arc(x - r * 0.9, y + r * 0.1, r * 0.6, 150, 330); p.arc(x + r * 0.9, y + r * 0.1, r * 0.6, 210, 390); return p; }
        };
        return p;
    }
    // ---- the suit emblems: a wand, a cup, a sword, a pentacle; s the size, a the lean in degrees ------
    function wand(p, x, y, s, a) {
        var r = (a || 0) * Math.PI / 180, dx = Math.sin(r) * s, dy = -Math.cos(r) * s;
        p.line([[x - dx * 0.8, y - dy * 0.8], [x + dx * 0.8, y + dy * 0.8]]);
        [0.45, 0.15, -0.2].forEach(function (t, i) { var ox = x + dx * t, oy = y + dy * t, side = i % 2 ? 1 : -1; p.line([[ox, oy], [ox + Math.cos(r) * s * 0.18 * side - dx * 0.12, oy + Math.sin(r) * s * 0.18 * side - dy * 0.12]]); });
    }
    function cup(p, x, y, s) {
        p.arc(x, y - s * 0.15, s * 0.42, 0, 180); p.line([[x - s * 0.42, y - s * 0.15], [x + s * 0.42, y - s * 0.15]]);
        p.line([[x, y + s * 0.27], [x, y + s * 0.6]]); p.arc(x, y + s * 0.72, s * 0.3, 180, 360);
    }
    function sword(p, x, y, s, a) {
        var r = (a || 0) * Math.PI / 180, dx = Math.sin(r) * s, dy = -Math.cos(r) * s, px = Math.cos(r) * s, py = Math.sin(r) * s;
        p.line([[x - dx * 0.75, y - dy * 0.75], [x + dx * 0.7, y + dy * 0.7], [x + dx * 0.85, y + dy * 0.85], [x + dx * 0.7 - px * 0.04, y + dy * 0.7 - py * 0.04]]);
        p.line([[x - dx * 0.45 - px * 0.28, y - dy * 0.45 - py * 0.28], [x - dx * 0.45 + px * 0.28, y - dy * 0.45 + py * 0.28]]);
        p.circle(x - dx * 0.82, y - dy * 0.82, s * 0.06);
    }
    function pentacle(p, x, y, s) { p.circle(x, y, s * 0.5); p.star(x, y, s * 0.4, 5); }
    var EMBLEM = { Wands: wand, Cups: cup, Swords: sword, Pentacles: pentacle };
    // ---- the trumps, each a few strokes -------------------------------------------------------
    var TRUMP = [
        function (p) {   // the Fool: a youth at a cliff's edge, bundle on a stick, rose in hand, a sun, a little dog
            p.circle(0.72, -1.0, 0.14); p.rays(0.72, -1.0, 0.2, 0.3, 12);
            p.hills(1.0, 0.35); p.line([[-1, 0.95], [-0.25, 0.95], [-0.05, 0.6], [0.2, 0.55], [0.3, 0.7], [0.3, 1.2]]);
            p.figure(0.0, -0.1, 1.3, { left: [-0.55, -0.72], right: [0.45, -0.55] }); p.line([[0.0, -0.17], [0.28, 0.55]]);
            p.line([[-0.55, -0.72], [-0.7, -0.95]]); p.circle(-0.76, -1.03, 0.09); p.circle(0.5, -0.6, 0.05);
            p.line([[-0.5, 0.95], [-0.4, 0.82], [-0.3, 0.9]]); p.circle(-0.55, 0.8, 0.06);
        },
        function (p) {   // the Magician: one hand up with a wand, one down, the lemniscate, the four emblems on a table
            p.line([[-0.7, 0.55], [0.7, 0.55]]); p.line([[-0.6, 0.55], [-0.6, 1.0]]); p.line([[0.6, 0.55], [0.6, 1.0]]);
            wand(p, -0.45, 0.3, 0.4, 0); cup(p, -0.15, 0.35, 0.3); sword(p, 0.2, 0.3, 0.42, 0); pentacle(p, 0.52, 0.35, 0.3);
            p.figure(0, -0.55, 1.5, { left: [-0.3, 0.1], right: [0.35, -1.2] }); p.line([[0.35, -1.3], [0.35, -0.95]]);
            p.circle(-0.1, -1.4, 0.08); p.circle(0.1, -1.4, 0.08);
        },
        function (p) {   // the High Priestess: between two pillars, the veil, the crescent at her feet, the scroll
            p.line([[-0.8, -1.2], [-0.8, 0.9]]); p.line([[0.8, -1.2], [0.8, 0.9]]); p.text("B", -0.8, -1.3, 0.18, SERIF); p.text("J", 0.8, -1.3, 0.18, SERIF);
            p.dash(true).line([[-0.75, -1.05], [0.75, -1.05]]).dash(false); [-0.45, -0.15, 0.15, 0.45].forEach(function (x) { p.circle(x, -0.85, 0.06); });
            p.head(0, -0.55, 0.13); p.arc(-0.14, -0.7, 0.1, 90, 270); p.arc(0.14, -0.7, 0.1, -90, 90); p.circle(0, -0.78, 0.07);
            p.poly([[-0.4, 0.85], [0, -0.4], [0.4, 0.85]]); p.poly([[0.2, 0.1], [0.45, 0.1], [0.45, 0.4], [0.2, 0.4]]);
            p.arc(0, 1.05, 0.22, 200, 340);
        },
        function (p) {   // the Empress: twelve stars, the shield with the sign of Venus, wheat
            for (var i = 0; i < 12; i++) { var a = Math.PI + i * Math.PI / 11; p.circle(Math.cos(a) * 0.4, -1.0 + Math.sin(a) * 0.3, 0.025, true); }
            p.head(0, -0.75, 0.13); p.poly([[-0.5, 0.9], [-0.1, -0.55], [0.1, -0.55], [0.5, 0.9]]);
            p.line([[0.35, 0.3], [0.65, 0.3], [0.65, 0.65], [0.5, 0.8], [0.35, 0.65]]); p.text("♀", 0.5, 0.52, 0.28, SERIF);
            [-0.9, -0.75, -0.6].forEach(function (x, i) { p.line([[x, 1.1], [x + 0.05, 0.6 - i * 0.05]]); p.zig(x + 0.05, 0.6 - i * 0.05, x + 0.1, 0.35 - i * 0.05, 4, 0.04); });
        },
        function (p) {   // the Emperor: a stone throne with rams' heads, the ankh and the orb, mountains behind
            p.hills(0.0, 0.5); p.poly([[-0.6, -0.3], [0.6, -0.3], [0.6, 1.0], [-0.6, 1.0]]);
            [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.6], [0.6, 0.6]].forEach(function (q) { p.arc(q[0], q[1], 0.08, 0, 300); });
            p.head(0, -0.6, 0.13); p.crown(0, -0.72, 0.3); p.line([[-0.1, -0.5], [0, -0.3], [0.1, -0.5]]);
            p.poly([[-0.35, 0.8], [-0.15, -0.4], [0.15, -0.4], [0.35, 0.8]]);
            p.circle(0.45, -0.2, 0.06); p.line([[0.45, -0.14], [0.45, 0.2]]); p.line([[0.37, -0.02], [0.53, -0.02]]); p.circle(-0.45, 0.05, 0.08);
        },
        function (p) {   // the Hierophant: triple crown, triple cross, two keys crossed, two kneeling
            p.line([[-0.75, -1.1], [-0.75, 0.6]]); p.line([[0.75, -1.1], [0.75, 0.6]]);
            p.head(0, -0.6, 0.13); p.arc(0, -0.78, 0.1, 180, 360); p.arc(0, -0.9, 0.08, 180, 360); p.arc(0, -1.0, 0.06, 180, 360);
            p.poly([[-0.4, 0.75], [-0.12, -0.42], [0.12, -0.42], [0.4, 0.75]]);
            p.line([[0.5, -1.0], [0.5, 0.5]]); [-0.85, -0.7, -0.55].forEach(function (y, i) { p.line([[0.5 - 0.1 - i * 0.03, y], [0.5 + 0.1 + i * 0.03, y]]); });
            p.line([[-0.35, -0.3], [-0.5, -0.6]]); p.line([[-0.5, -0.6], [-0.56, -0.72]]); p.line([[-0.46, -0.62], [-0.49, -0.75]]);
            p.line([[-0.3, 1.1], [0.3, 0.85]]); p.line([[0.3, 1.1], [-0.3, 0.85]]); p.circle(-0.33, 1.12, 0.05); p.circle(0.33, 1.12, 0.05);
            p.head(-0.7, 0.9, 0.08); p.head(0.7, 0.9, 0.08);
        },
        function (p) {   // the Lovers: the angel in the sun, the two below, the tree of knowledge and the serpent, the tree of flames
            p.arc(0, -1.0, 0.45, 180, 360); p.rays(0, -1.0, 0.5, 0.62, 9, 190);
            p.head(0, -1.05, 0.1); p.wings(0, -0.9, 0.5); p.line([[0, -0.95], [0, -0.6]]);
            p.figure(-0.45, 0.45, 1.1, { right: [-0.2, 0.3] }); p.figure(0.45, 0.45, 1.1, { left: [0.2, 0.3] });
            p.line([[-0.85, 1.0], [-0.85, 0.1]]); p.wave(-0.95, -0.75, 0.55, 0.05, 3); p.circle(-0.78, 0.0, 0.06); p.circle(-0.95, 0.05, 0.06);
            p.line([[0.85, 1.0], [0.85, 0.1]]); [0.1, 0.3, 0.5].forEach(function (y) { p.flame(0.85, y, 0.18); });
            p.line([[-0.2, 1.0], [0, 0.6], [0.2, 1.0]]);
        },
        function (p) {   // the Chariot: the cube car under its canopy of stars, two sphinxes, the winged disc
            p.poly([[-0.65, -0.95], [0.65, -0.95], [0.65, -1.05], [-0.65, -1.05]]); [-0.4, -0.1, 0.2, 0.5].forEach(function (x) { p.star(x, -1.2, 0.05, 5); });
            p.line([[-0.6, -0.95], [-0.6, 0.0]]); p.line([[0.6, -0.95], [0.6, 0.0]]);
            p.poly([[-0.55, 0.0], [0.55, 0.0], [0.55, 0.75], [-0.55, 0.75]]); p.circle(0, 0.35, 0.09); p.line([[-0.3, 0.3], [-0.12, 0.35]]); p.line([[0.3, 0.3], [0.12, 0.35]]);
            p.head(0, -0.6, 0.12); p.star(0, -0.78, 0.09, 8, -90, 3); p.line([[0, -0.48], [0, 0.0]]); p.line([[-0.3, -0.2], [0, -0.4], [0.3, -0.2]]);
            p.circle(-0.5, 0.9, 0.1); p.circle(0.5, 0.9, 0.1);
            p.poly([[-0.95, 1.15], [-0.6, 1.15], [-0.6, 0.85], [-0.75, 0.75], [-0.95, 0.85]]); p.head(-0.75, 0.68, 0.07);
            p.poly([[0.95, 1.15], [0.6, 1.15], [0.6, 0.85], [0.75, 0.75], [0.95, 0.85]]); p.head(0.75, 0.68, 0.07); p.circle(0.78, 1.0, 0.1, true);
        },
        function (p) {   // Strength: a woman closing a lion's jaws, the lemniscate over her
            p.circle(-0.5, -1.15, 0.08); p.circle(-0.3, -1.15, 0.08);
            p.head(-0.4, -0.85, 0.12); p.line([[-0.4, -0.73], [-0.45, 0.0], [-0.6, 0.9]]); p.line([[-0.42, -0.5], [0.1, -0.15]]); p.line([[-0.42, -0.5], [0.2, 0.05]]);
            p.circle(0.35, -0.05, 0.22); p.rays(0.35, -0.05, 0.26, 0.4, 12, 15); p.line([[0.2, -0.05], [0.28, 0.02]]); p.line([[0.1, 0.0], [0.26, 0.08]]);
            p.arc(0.4, 0.55, 0.45, 150, 390); p.line([[0.0, 0.7], [0.0, 1.0]]); p.line([[0.75, 0.7], [0.75, 1.0]]); p.line([[0.85, 0.5], [1.0, 0.2], [0.95, 0.0]]);
        },
        function (p) {   // the Hermit: hooded, on a peak, the staff, the lantern with its star
            p.hills(1.1, 0.6);
            p.arc(0.0, -0.9, 0.16, 150, 390); p.head(0.0, -0.85, 0.1); p.poly([[-0.4, 0.95], [-0.12, -0.78], [0.12, -0.78], [0.4, 0.95]]);
            p.line([[-0.45, -0.95], [-0.45, 1.0]]); p.line([[0.15, -0.5], [0.45, -0.6]]);
            p.poly([[0.45, -0.85], [0.62, -0.75], [0.62, -0.45], [0.45, -0.35], [0.28, -0.45], [0.28, -0.75]]); p.star(0.45, -0.6, 0.1, 3, -90, 1); p.star(0.45, -0.6, 0.1, 3, 90, 1);
            p.rays(0.45, -0.6, 0.25, 0.35, 8, 22);
        },
        function (p) {   // the Wheel of Fortune: TARO and the Name on the rim, the sphinx above, the serpent down, Anubis up, four books in the corners
            p.circle(0, 0, 0.78); p.circle(0, 0, 0.5); p.rays(0, 0, 0.0, 0.5, 8, 0);
            ["T", "A", "R", "O"].forEach(function (ch, i) { var a = -Math.PI / 2 + i * Math.PI / 2; p.text(ch, Math.cos(a) * 0.64, Math.sin(a) * 0.64, 0.2, MONO); });
            ["י", "ה", "ו", "ה"].forEach(function (ch, i) { var a = -Math.PI / 4 + i * Math.PI / 2; p.text(ch, Math.cos(a) * 0.64, Math.sin(a) * 0.64, 0.2, SERIF); });
            p.poly([[-0.25, -0.8], [0.25, -0.8], [0.2, -1.0], [-0.2, -1.0]]); p.head(0, -1.1, 0.09); p.line([[-0.1, -1.0], [0.15, -1.0]]);
            p.wave(-0.95, -0.75, 0.0, 0.07, 3); p.line([[-0.75, 0.0], [-0.72, 0.4]]);
            p.figure(0.86, 0.4, 0.7); p.line([[0.86, 0.1], [0.98, 0.0]]);
            [[-0.85, -1.2], [0.85, -1.2], [-0.85, 1.05], [0.85, 1.05]].forEach(function (q) { p.poly([[q[0] - 0.12, q[1] - 0.08], [q[0] + 0.12, q[1] - 0.08], [q[0] + 0.12, q[1] + 0.08], [q[0] - 0.12, q[1] + 0.08]]); p.line([[q[0], q[1] - 0.08], [q[0], q[1] + 0.08]]); });
        },
        function (p) {   // Justice: enthroned between pillars, the sword up, the scales
            p.line([[-0.8, -1.1], [-0.8, 0.9]]); p.line([[0.8, -1.1], [0.8, 0.9]]);
            p.head(0, -0.7, 0.13); p.crown(0, -0.83, 0.26); p.poly([[-0.42, 0.9], [-0.12, -0.52], [0.12, -0.52], [0.42, 0.9]]);
            sword(p, 0.5, -0.5, 0.6, 0); p.line([[0.12, -0.3], [0.5, -0.2]]);
            p.line([[-0.12, -0.3], [-0.5, -0.1]]); p.line([[-0.5, -0.1], [-0.5, 0.0]]); p.line([[-0.72, 0.0], [-0.28, 0.0]]);
            p.line([[-0.72, 0.0], [-0.72, 0.25]]); p.arc(-0.72, 0.25, 0.1, 0, 180); p.line([[-0.28, 0.0], [-0.28, 0.25]]); p.arc(-0.28, 0.25, 0.1, 0, 180);
        },
        function (p) {   // the Hanged Man: from a living tau, one leg crossed behind, the arms behind, the halo
            p.line([[-0.75, -1.0], [0.75, -1.0]]); p.line([[-0.7, -1.0], [-0.7, 1.1]]); p.line([[0.7, -1.0], [0.7, 1.1]]);
            [-0.6, -0.2, 0.3, 0.8].forEach(function (y) { p.line([[-0.7, y], [-0.55, y - 0.1]]); p.line([[0.7, y], [0.55, y - 0.1]]); });
            p.line([[0, -1.0], [0, -0.2]]); p.line([[0, -0.2], [0.32, -0.55], [0.05, -0.8]]); p.line([[0, -0.2], [0, 0.5]]);
            p.line([[0, 0.35], [-0.22, 0.75], [0, 0.92], [0.22, 0.75], [0, 0.35]]); p.head(0, 0.66, 0.12); p.rays(0, 0.66, 0.2, 0.3, 10, 0);
        },
        function (p) {   // Death: the skeleton in armour on a pale horse, the banner with the rose, the sun between two towers, the fallen king
            p.arc(0, 1.2, 0.2, 180, 360); p.poly([[-0.4, 1.05], [-0.25, 1.05], [-0.25, 0.85], [-0.4, 0.85]]); p.poly([[0.4, 1.05], [0.25, 1.05], [0.25, 0.85], [0.4, 0.85]]);
            p.ellipse(0.0, 0.35, 0.5, 0.22); p.line([[0.4, 0.2], [0.75, -0.15]]); p.ellipse(0.8, -0.22, 0.14, 0.08, -0.6); p.line([[-0.5, 0.35], [-0.75, 0.6]]);
            [-0.35, -0.15, 0.2, 0.4].forEach(function (x) { p.line([[x, 0.55], [x, 0.95]]); });
            p.line([[0.05, 0.15], [0.05, -0.5]]); p.circle(0.05, -0.65, 0.13); p.circle(0.0, -0.68, 0.025, true); p.circle(0.1, -0.68, 0.025, true);
            p.line([[0.05, -0.35], [-0.45, -0.5]]); p.line([[-0.45, -1.3], [-0.45, -0.1]]); p.poly([[-0.45, -1.3], [0.15, -1.3], [0.15, -0.85], [-0.45, -0.85]]);
            p.circle(-0.15, -1.07, 0.06); for (var i = 0; i < 5; i++) { var a = -Math.PI / 2 + i * Math.PI * 2 / 5; p.circle(-0.15 + Math.cos(a) * 0.11, -1.07 + Math.sin(a) * 0.11, 0.06); }
            p.crown(-0.75, 1.1, 0.2);
        },
        function (p) {   // Temperance: the angel with the triangle on her breast, the two cups and the stream between, one foot in the water, the path to the sun
            p.head(0, -0.9, 0.12); p.wings(0, -0.75, 0.55); p.poly([[-0.1, -0.5], [0.1, -0.5], [0, -0.66]]); p.poly([[-0.4, 0.9], [-0.12, -0.75], [0.12, -0.75], [0.4, 0.9]]);
            cup(p, -0.5, -0.1, 0.3); cup(p, 0.45, 0.35, 0.3); p.line([[-0.1, -0.45], [-0.45, -0.2]]); p.line([[0.1, -0.45], [0.4, 0.2]]);
            p.dash(true).line([[-0.45, -0.25], [0.35, 0.12]]).dash(false);
            p.wave(-1, 0.0, 0.95, 0.05, 4); p.line([[0.0, 0.95], [1, 0.95]]); p.line([[0.55, 0.95], [0.75, 0.3], [0.95, -0.3]]); p.arc(0.85, -0.5, 0.12, 180, 360); p.rays(0.85, -0.5, 0.15, 0.25, 6, 195);
        },
        function (p) {   // the Devil: bat wings, horns, the inverted pentagram on the brow, the half cube, the torch down, two chained
            p.poly([[-0.4, 0.55], [0.4, 0.55], [0.4, 1.1], [-0.4, 1.1]]);
            p.head(0, -0.65, 0.15); p.star(0, -0.72, 0.09, 5, 90); p.line([[-0.1, -0.78], [-0.3, -1.1], [-0.15, -1.0]]); p.line([[0.1, -0.78], [0.3, -1.1], [0.15, -1.0]]);
            p.line([[-0.1, -0.5], [-0.9, -0.85], [-0.75, -0.55], [-0.95, -0.4], [-0.7, -0.3], [-0.8, -0.05], [-0.3, -0.1]]);
            p.line([[0.1, -0.5], [0.9, -0.85], [0.75, -0.55], [0.95, -0.4], [0.7, -0.3], [0.8, -0.05], [0.3, -0.1]]);
            p.poly([[-0.3, 0.55], [-0.1, -0.5], [0.1, -0.5], [0.3, 0.55]]); p.line([[0.1, -0.3], [0.5, -0.15]]); p.line([[0.5, -0.15], [0.55, 0.3]]); p.flame(0.55, 0.5, -0.18);
            p.circle(0, 0.55, 0.05); p.figure(-0.65, 0.85, 0.6); p.figure(0.65, 0.85, 0.6); p.line([[-0.65, 0.6], [0, 0.55], [0.65, 0.6]]);
        },
        function (p) {   // the Tower: struck, the crown blown off, flames, two falling, the yods
            p.poly([[-0.3, -0.2], [0.3, -0.2], [0.3, 1.1], [-0.3, 1.1]]); p.line([[-0.1, 0.0], [-0.1, 0.2], [0.1, 0.2], [0.1, 0.0]]); p.line([[-0.1, 0.6], [-0.1, 0.8], [0.1, 0.8], [0.1, 0.6]]);
            p.crown(0.5, -0.75, 0.32); p.line([[0.95, -1.35], [0.5, -0.95], [0.6, -0.9], [0.2, -0.45], [0.3, -0.4], [0.0, -0.2]]);
            p.flame(-0.25, -0.2, 0.3); p.flame(0.2, -0.2, 0.35); p.flame(-0.1, 0.0, 0.2); p.flame(0.15, 0.6, 0.2);
            [[-0.65, 0.35], [0.68, 0.6]].forEach(function (q) { p.head(q[0], q[1] + 0.25, 0.09); p.line([[q[0], q[1] + 0.16], [q[0] + 0.05, q[1] - 0.4]]); p.line([[q[0] + 0.05, q[1] - 0.4], [q[0] - 0.15, q[1] - 0.7]]); p.line([[q[0] + 0.05, q[1] - 0.4], [q[0] + 0.25, q[1] - 0.65]]); p.line([[q[0] + 0.02, q[1] - 0.05], [q[0] - 0.2, q[1] + 0.15]]); p.line([[q[0] + 0.02, q[1] - 0.05], [q[0] + 0.22, q[1] + 0.1]]); });
            for (var i = 0; i < 10; i++) p.circle(-0.85 + (i % 5) * 0.42 + (i > 4 ? 0.2 : 0), -1.2 + Math.floor(i / 5) * 0.25 + (i % 3) * 0.1, 0.02, true);
            p.hills(1.15, 0.2);
        },
        function (p) {   // the Star: the great star and seven, a woman kneeling, pouring on the land and into the pool, the bird in the tree
            p.star(0, -1.0, 0.28, 8, -90, 3); p.rays(0, -1.0, 0.32, 0.42, 8, 22.5);
            [[-0.7, -1.25], [-0.75, -0.75], [-0.4, -0.55], [0.4, -0.55], [0.72, -0.78], [0.68, -1.25], [0.0, -0.5]].forEach(function (q) { p.star(q[0], q[1], 0.08, 8, -90, 3); });
            p.head(-0.2, 0.0, 0.11); p.line([[-0.2, 0.11], [-0.1, 0.5], [-0.45, 0.6], [-0.45, 0.9]]); p.line([[-0.1, 0.5], [0.15, 0.9]]);
            p.line([[-0.15, 0.25], [-0.55, 0.35]]); p.line([[-0.15, 0.25], [0.3, 0.3]]);
            p.poly([[-0.62, 0.28], [-0.5, 0.28], [-0.52, 0.45], [-0.6, 0.45]]); p.poly([[0.25, 0.25], [0.37, 0.25], [0.39, 0.42], [0.23, 0.42]]);
            p.wave(-1, -0.3, 0.95, 0.04, 3); p.dash(true).line([[-0.56, 0.45], [-0.6, 0.9]]).dash(false); [0.4, 0.55, 0.7, 0.85].forEach(function (x, i) { p.line([[0.3, 0.42], [x, 1.0 - i * 0.08]]); });
            p.line([[0.85, 1.0], [0.85, 0.2]]); p.line([[0.85, 0.2], [0.65, -0.1]]); p.line([[0.85, 0.2], [1.0, -0.15]]); p.ellipse(0.72, -0.18, 0.07, 0.04); p.line([[0.78, -0.2], [0.92, -0.26]]);
        },
        function (p) {   // the Moon: the moon with its face, the yods falling, two towers, the dog and the wolf, the crayfish, the path
            p.circle(0, -0.95, 0.3); p.arc(0.08, -0.95, 0.22, 110, 250); p.rays(0, -0.95, 0.35, 0.45, 16, 0);
            for (var i = 0; i < 15; i++) p.circle(-0.7 + (i % 5) * 0.35, -0.5 + Math.floor(i / 5) * 0.14 + (i % 2) * 0.05, 0.02, true);
            p.poly([[-0.9, 0.5], [-0.65, 0.5], [-0.65, -0.1], [-0.9, -0.1]]); p.poly([[0.9, 0.5], [0.65, 0.5], [0.65, -0.1], [0.9, -0.1]]);
            p.line([[0.1, 1.3], [-0.2, 0.9], [0.25, 0.6], [-0.1, 0.35], [0.1, 0.1]]);
            p.line([[-0.5, 0.45], [-0.4, 0.3], [-0.25, 0.35], [-0.28, 0.5]]); p.line([[-0.4, 0.3], [-0.42, 0.22], [-0.36, 0.25]]);
            p.line([[0.5, 0.45], [0.4, 0.3], [0.25, 0.35], [0.28, 0.5]]); p.line([[0.4, 0.3], [0.43, 0.2], [0.47, 0.26]]);
            p.wave(-1, 1, 1.05, 0.04, 5); p.ellipse(-0.45, 1.2, 0.12, 0.07); p.arc(-0.6, 1.08, 0.08, 90, 300); p.arc(-0.3, 1.08, 0.08, 240, 450);
        },
        function (p) {   // the Sun: rays straight and waving, the wall, the sunflowers, the child on the horse with the banner
            p.circle(0, -0.85, 0.28); p.rays(0, -0.85, 0.34, 0.55, 8, 0); for (var i = 0; i < 8; i++) { var a = (22.5 + i * 45) * Math.PI / 180; p.zig(Math.cos(a) * 0.34, -0.85 + Math.sin(a) * 0.34, Math.cos(a) * 0.52, -0.85 + Math.sin(a) * 0.52, 4, 0.03); }
            p.line([[-1, 0.05], [1, 0.05]]); p.line([[-1, 0.3], [1, 0.3]]);
            [-0.75, -0.45, 0.45, 0.75].forEach(function (x) { p.circle(x, -0.15, 0.06); p.rays(x, -0.15, 0.08, 0.14, 8, 0); p.line([[x, -0.09], [x, 0.05]]); });
            p.ellipse(0.05, 0.75, 0.45, 0.2); p.line([[0.4, 0.62], [0.65, 0.4]]); p.ellipse(0.7, 0.35, 0.12, 0.07, -0.5); [-0.3, -0.1, 0.2, 0.38].forEach(function (x) { p.line([[x, 0.92], [x, 1.2]]); });
            p.head(0.0, 0.2, 0.1); p.line([[0.0, 0.3], [0.0, 0.6]]); p.line([[0.0, 0.4], [-0.4, 0.25]]); p.line([[-0.4, -0.3], [-0.4, 0.95]]); p.poly([[-0.4, -0.3], [-0.75, -0.3], [-0.75, 0.15], [-0.4, 0.15]]);
        },
        function (p) {   // Judgement: the angel with the trumpet and its banner, the dead rising from their tombs, the water
            p.head(0, -1.15, 0.1); p.wings(0, -1.0, 0.6); p.line([[0, -1.05], [0, -0.7]]);
            p.line([[0.05, -0.85], [-0.55, -0.4]]); p.poly([[-0.55, -0.4], [-0.75, -0.3], [-0.62, -0.2]]); p.poly([[-0.2, -0.75], [0.0, -0.75], [0.0, -0.5], [-0.2, -0.5]]); p.line([[-0.1, -0.75], [-0.1, -0.5]]); p.line([[-0.2, -0.62], [0.0, -0.62]]);
            [[-0.6, 0.5], [0.0, 0.4], [0.6, 0.5]].forEach(function (q) { p.poly([[q[0] - 0.22, q[1] + 0.3], [q[0] + 0.22, q[1] + 0.3], [q[0] + 0.22, q[1] + 0.6], [q[0] - 0.22, q[1] + 0.6]]); p.head(q[0], q[1] - 0.2, 0.09); p.line([[q[0], q[1] - 0.1], [q[0], q[1] + 0.3]]); p.line([[q[0] - 0.18, q[1] - 0.3], [q[0], q[1] + 0.0], [q[0] + 0.18, q[1] - 0.3]]); });
            p.wave(-1, 1, 1.15, 0.03, 6); p.hills(0.2, 0.25);
        },
        function (p) {   // the World: the wreath, the dancer with two wands, the four living creatures
            p.ellipse(0, 0, 0.6, 0.98); p.ellipse(0, 0, 0.52, 0.9); p.line([[-0.1, -1.05], [0.1, -0.85]]); p.line([[0.1, -1.05], [-0.1, -0.85]]); p.line([[-0.1, 1.05], [0.1, 0.85]]); p.line([[0.1, 1.05], [-0.1, 0.85]]);
            p.head(0, -0.6, 0.12); p.line([[0, -0.48], [0.05, 0.1], [-0.15, 0.6]]); p.line([[0.05, 0.1], [0.25, 0.4], [0.0, 0.65]]);
            p.line([[0.02, -0.3], [-0.3, -0.45]]); p.line([[0.02, -0.3], [0.3, -0.1]]); p.line([[-0.35, -0.6], [-0.25, -0.3]]); p.line([[0.35, -0.25], [0.25, 0.05]]);
            p.head(-0.85, -1.3, 0.1); p.line([[0.7, -1.4], [0.85, -1.25], [1.0, -1.4]]); p.head(0.85, -1.2, 0.06);
            p.head(-0.85, 1.3, 0.1); p.arc(-0.95, 1.2, 0.08, 180, 300); p.arc(-0.75, 1.2, 0.08, 240, 360); p.head(0.85, 1.3, 0.1); p.rays(0.85, 1.3, 0.12, 0.2, 10, 0);
        }
    ];
    // ---- the small cards: the pips as the old packs lay them; the Ace from a cloud; the court as figures ------
    var PIPS = { 1: [[0, 0]], 2: [[0, -0.55], [0, 0.55]], 3: [[0, -0.7], [0, 0], [0, 0.7]], 4: [[-0.42, -0.6], [0.42, -0.6], [-0.42, 0.6], [0.42, 0.6]],
        5: [[-0.42, -0.6], [0.42, -0.6], [-0.42, 0.6], [0.42, 0.6], [0, 0]], 6: [[-0.42, -0.7], [0.42, -0.7], [-0.42, 0], [0.42, 0], [-0.42, 0.7], [0.42, 0.7]],
        7: [[-0.42, -0.7], [0.42, -0.7], [-0.42, 0], [0.42, 0], [-0.42, 0.7], [0.42, 0.7], [0, -0.35]],
        8: [[-0.42, -0.85], [0.42, -0.85], [-0.42, -0.28], [0.42, -0.28], [-0.42, 0.28], [0.42, 0.28], [-0.42, 0.85], [0.42, 0.85]],
        9: [[-0.42, -0.85], [0.42, -0.85], [-0.42, -0.28], [0.42, -0.28], [-0.42, 0.28], [0.42, 0.28], [-0.42, 0.85], [0.42, 0.85], [0, 0]],
        10: [[-0.42, -0.85], [0.42, -0.85], [-0.42, -0.28], [0.42, -0.28], [-0.42, 0.28], [0.42, 0.28], [-0.42, 0.85], [0.42, 0.85], [0, -0.55], [0, 0.55]] };
    function pips(p, card) {
        var em = EMBLEM[card.suit], n = card.rank, size = n === 1 ? 0.9 : n <= 3 ? 0.5 : n <= 7 ? 0.48 : 0.42;
        if (n === 1) { p.cloud(-0.6, -0.1, 0.22); p.line([[-0.45, -0.1], [-0.2, -0.05]]); em(p, 0.15, 0.0, size, 0); p.rays(0.15, 0.0, 0.62, 0.72, 10, 0); return; }
        PIPS[n].forEach(function (q, i) { em(p, q[0], q[1], size, card.suit === "Wands" || card.suit === "Swords" ? (q[0] < 0 ? -8 : q[0] > 0 ? 8 : 0) : 0); });
    }
    function court(p, card) {
        var em = EMBLEM[card.suit], small = 0.34;
        if (card.court === "Page") { p.figure(-0.1, 0.0, 1.5, { right: [0.4, -0.35] }); p.line([[-0.3, -0.75], [0.0, -0.78]]); em(p, 0.45, -0.3, small, 0); p.hills(1.1, 0.3); }
        if (card.court === "Knight") {
            p.ellipse(-0.05, 0.4, 0.5, 0.22); p.line([[0.4, 0.25], [0.7, -0.2]]); p.ellipse(0.76, -0.27, 0.14, 0.08, -0.6); p.line([[0.86, -0.32], [0.9, -0.42]]);
            [-0.4, -0.2, 0.2, 0.38].forEach(function (x, i) { p.line([[x, 0.6], [x + (i % 2 ? 0.08 : -0.08), 1.0]]); }); p.line([[-0.55, 0.4], [-0.8, 0.7]]);
            p.line([[0.0, 0.2], [0.0, -0.45]]); p.head(0.0, -0.6, 0.12); p.line([[0.0, -0.72], [-0.2, -0.95], [-0.1, -0.75]]); p.line([[0.0, -0.3], [0.4, -0.5]]); em(p, 0.45, -0.75, small, 0);
        }
        if (card.court === "Queen" || card.court === "King") {
            p.line([[-0.6, 1.05], [-0.6, -0.6], [0.6, -0.6], [0.6, 1.05]]); p.line([[-0.6, 0.35], [0.6, 0.35]]);
            if (card.court === "King") { em(p, 0.0, -0.95, 0.22, 0); }
            p.head(0, -0.7, 0.13); p.crown(0, -0.83, card.court === "King" ? 0.34 : 0.26);
            if (card.court === "King") p.line([[-0.08, -0.6], [0, -0.48], [0.08, -0.6]]);
            p.poly([[-0.35, 0.35], [-0.12, -0.55], [0.12, -0.55], [0.35, 0.35]]); p.poly([[-0.45, 0.35], [0.45, 0.35], [0.45, 1.05], [-0.45, 1.05]]);
            p.line([[0.12, -0.3], [0.45, -0.15]]); em(p, 0.5, -0.4, small, 0); p.line([[-0.12, -0.3], [-0.4, 0.0]]);
        }
    }
    // ---- a card drawn at (cx, cy), h tall, upright or reversed ---------------------------------------
    function drawCard(c, card, cx, cy, h, reversed, col, turned) {
        var s = h / 3.4, w = s * 2;
        c.save(); c.translate(cx, cy); if (reversed) c.rotate(Math.PI); if (turned) c.rotate(Math.PI / 2);
        var p = pen(c, 0, 0, s, col || INK, Math.max(1, Math.min(2.2, s * 0.028)));
        c.fillStyle = PAPER; c.fillRect(-w / 2, -h / 2, w, h);
        c.strokeStyle = col || INK; c.lineWidth = Math.max(1, s * 0.03); c.strokeRect(-w / 2, -h / 2, w, h);
        c.strokeStyle = FAINT; c.lineWidth = 1; c.strokeRect(-w / 2 + s * 0.08, -h / 2 + s * 0.08, w - s * 0.16, h - s * 0.16);
        c.save(); c.beginPath(); c.rect(-w / 2 + s * 0.1, -s * 1.55, w - s * 0.2, s * 2.75); c.clip();
        if (card.trump != null) TRUMP[card.trump](p); else if (card.court) court(p, card); else pips(p, card);
        c.restore();
        var tp = pen(c, 0, 0, s, DIM, 1);
        if (card.trump != null) tp.text(ROMAN[card.trump], 0, -1.45, 0.18, MONO); else tp.text(card.suit === "Wands" ? "♣" : card.suit === "Cups" ? "♥" : card.suit === "Swords" ? "♠" : "♦", 0, -1.45, 0.2, SERIF);
        tp.col = INK; tp.text(card.name.toUpperCase(), 0, 1.42, Math.min(0.14, 2.6 / card.name.length), MONO);
        c.restore();
    }
    // ---- the spreads: Waite's one card, three, and the Celtic cross about a significator -------------
    var SPREADS = {
        one: { name: "a card", slots: [{ x: 0.5, y: 0.5, h: 0.86, what: "the card" }] },
        three: { name: "three", slots: [{ x: 0.2, y: 0.5, what: "what is behind" }, { x: 0.5, y: 0.5, what: "what is here" }, { x: 0.8, y: 0.5, what: "what is before" }] },
        cross: { name: "the cross", slots: [
            { x: 0.3, y: 0.5, what: "covers him", say: "the influence that is affecting the person or matter of inquiry generally, the atmosphere of it in which the other currents work" },
            { x: 0.3, y: 0.5, turn: true, what: "crosses him", say: "what the obstacles are, if any" },
            { x: 0.3, y: 0.17, what: "crowns him", say: "the aim or ideal in the matter; the best that can be achieved under the circumstances, but that which has not yet been made actual" },
            { x: 0.3, y: 0.83, what: "is beneath him", say: "the foundation or basis of the matter, that which has already passed into actuality and which the Significator has made his own" },
            { x: 0.08, y: 0.5, what: "is behind him", say: "the influence that is just passed, or is now passing away" },
            { x: 0.52, y: 0.5, what: "is before him", say: "the influence that is coming into action and will operate in the near future" },
            { x: 0.86, y: 0.86, what: "himself", say: "the Significator, whether person or thing, its position or attitude in the circumstances" },
            { x: 0.86, y: 0.62, what: "his house", say: "his environment and the tendencies at work therein which have an effect on the matter, for instance his position in life, the influence of immediate friends" },
            { x: 0.86, y: 0.38, what: "his hopes or fears", say: "his hopes or fears in the matter" },
            { x: 0.86, y: 0.14, what: "what will come", say: "the culmination which is brought about by the influences shewn by the other cards that have been turned up in the divination" }
        ] }
    };
    var spread = "one", hand = [], reversals = true, significator = null, W = 0, H = 0, sky = null;
    function random(n) { var a = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(a); return a[0] % n; }
    function shuffle(exclude) {
        var deck = DECK.filter(function (c) { return c !== exclude; });
        for (var i = deck.length - 1; i > 0; i--) { var j = random(i + 1), t = deck[i]; deck[i] = deck[j]; deck[j] = t; }
        return deck;
    }
    function deal() {
        sky = Z.sky();
        var sunCard = BY[sky.bodies[0].decan.card];
        significator = spread === "cross" ? sunCard : null;
        var deck = shuffle(significator), n = SPREADS[spread].slots.length;
        hand = deck.slice(0, n).map(function (c) { return { card: c, reversed: reversals && random(3) === 0 }; });
        if (location.hash) history.replaceState(null, "", location.pathname + location.search);
        draw(); reading();
    }
    function show(card) {   // one card, chosen from the deck below, upright
        spread = "one"; sky = Z.sky(); significator = null; hand = [{ card: card, reversed: false }];
        pressed(); draw(); reading();
    }
    function cardHeight() {
        if (spread === "one") return Math.min(H * 0.86, W * 0.9 / 2 * 3.4);
        if (spread === "three") return Math.min(H * 0.86, W * 0.27 / 2 * 3.4);
        return Math.min(H * 0.225, W * 0.17 / 2 * 3.4);
    }
    function resize() { var r = stage.getBoundingClientRect(); W = Math.round(r.width); H = Math.round(r.height); canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); draw(); }
    function draw() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
        var h = cardHeight(), slots = SPREADS[spread].slots;
        if (spread === "cross") {
            ctx.strokeStyle = FAINT; ctx.lineWidth = 1; ctx.setLineDash([3, 5]);
            ctx.beginPath(); ctx.moveTo(W * 0.3, H * 0.1); ctx.lineTo(W * 0.3, H * 0.9); ctx.moveTo(W * 0.04, H * 0.5); ctx.lineTo(W * 0.62, H * 0.5); ctx.stroke(); ctx.setLineDash([]);
            if (significator) drawCard(ctx, significator, W * 0.3 - h * 0.08, H * 0.5 - h * 0.06, h, false, DIM);
        }
        hand.forEach(function (c, i) {
            var s = slots[i]; if (!s) return;
            drawCard(ctx, c.card, W * s.x, H * s.y, h * (s.h ? 1 : spread === "one" ? 1 : 1), c.reversed, i === 1 && spread === "cross" ? AMBER : INK, s.turn);
            if (spread === "cross") { ctx.fillStyle = DIM; ctx.font = "11px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(i + 1), W * s.x + (s.turn ? h * 0.33 : 0), H * s.y + (s.turn ? -h * 0.22 : h * 0.56)); }
        });
        if (saveLink) { try { saveLink.href = canvas.toDataURL("image/png"); } catch (e) { saveLink.hidden = true; } }
    }
    // ---- what a card is: the order's attribution and whether anything stands there now -------------------
    function here(test) {
        if (!sky) return "";
        var there = sky.bodies.filter(function (b) { return b.name !== "Node" && test(b); }).map(function (b) { return b.name === "Sun" || b.name === "Moon" ? "the " + b.name : b.name; });
        if (!there.length) return "";
        return " " + there.join(" and ") + (there.length > 1 ? " stand" : " stands") + " there now.";
    }
    function about(card) {
        var t = "";
        if (card.trump != null) {
            var of = card.of, kind = Z.PLANETS[of] ? "planet" : Z.ELEMENTS[of] ? "element" : "sign";
            t = "Trump " + ROMAN[card.trump] + ", the letter " + card.letter + "; the order gives it to " + (kind === "sign" ? of : kind === "planet" ? (of === "Sun" || of === "Moon" ? "the " + of : of) : "the element " + of) + ".";
            if (kind === "sign") t += here(function (b) { return b.sign.sign.name === of; });
            if (kind === "planet" && sky) { var b = sky.bodies.filter(function (x) { return x.name === of; })[0]; if (b) t += " " + (of === "Sun" || of === "Moon" ? "The " + of : of) + " is at " + Z.fmt(b.lon) + (b.retrograde ? ", retrograde" : "") + "."; }
            var hour = window.Hours && window.Hours.now();
            if (kind === "planet" && hour && hour.planet === of) t += " This is the hour's trump: the hour is " + (of === "Sun" || of === "Moon" ? "the " + of : of) + "'s until " + window.Hours.hm(hour.end) + ".";
            return t;
        }
        var el = SUITS[card.suit];
        if (card.rank === 1) return "The Ace: the root of the powers of " + el + ". With the Page it rules the quarter of the heavens about the pole that holds " + QUAD[card.suit] + ".";
        if (card.decan) {
            var d = card.decan;
            t = "Lord of " + d.title + ": the " + ["first", "second", "third"][d.n - 1] + " decan of " + d.sign.name + ", " + d.ruler + " in " + d.sign.name + ", " + d.from % 30 + "° to " + (d.to % 30 || 30) + "°, " + when(d) + ".";
            return t + here(function (b) { return b.decan.index === d.index; });
        }
        if (card.court === "Page") return "The Page, the order's Princess: the earth of " + el + ". With the Ace she rules the quarter about the pole that holds " + QUAD[card.suit] + ".";
        t = "The " + card.court + ", the order's " + GD_NAME[card.court] + ": the " + COURT_ELEMENT[card.court] + " of " + el + "; rules from " + Z.fmt(card.from) + " to " + Z.fmt(card.to) + ".";
        return t + here(function (b) { return Z.rev(b.lon - card.from) < 30; });
    }
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function reading() {
        if (!readOut) return;
        var slots = SPREADS[spread].slots, out = [];
        if (spread === "cross" && significator) out.push("<p class=\"sig\"><b>The Significator</b>: " + esc(significator.name) + ", the card the Sun stands in, laid face up first. " + esc(about(significator)) + "</p>");
        hand.forEach(function (c, i) {
            var s = slots[i], m = WAITE[c.card.name] || ["", ""], mean = c.reversed ? (m[1] || "Waite gives no reversed meaning for this card; read it upright and with less weight.") : m[0];
            out.push("<div class=\"card-read\" id=\"" + c.card.slug + "\"><h3>" + (spread === "cross" ? (i + 1) + ". This " + esc(s.what) + ": " : spread === "three" ? esc(s.what) + ": " : "") + esc(c.card.name) + (c.reversed ? ", reversed" : "") + "</h3>"
                + (s.say ? "<p class=\"pos\">" + esc(s.say) + ".</p>" : "")
                + "<p class=\"waite\">Waite: " + esc(mean) + "</p>"
                + "<p class=\"gd\">" + esc(about(c.card)) + "</p></div>");
        });
        readOut.innerHTML = out.join("");
    }
    function today() {
        if (!todayOut) return;
        var s = Z.sky(), sun = s.bodies[0], moon = s.bodies[1], bits = [];
        bits.push("The Sun stands in " + sun.decan.card + ", " + sun.decan.title + " (" + Z.fmt(sun.lon) + ")");
        bits.push("the Moon in " + moon.decan.card + ", " + moon.decan.title + " (" + Z.fmt(moon.lon) + ", " + s.phase + ")");
        bits.push("rising at Portland, " + s.asc.decan.card);
        var h = window.Hours && window.Hours.now();
        if (h) bits.push("the hour is " + (h.planet === "Sun" || h.planet === "Moon" ? "the " + h.planet : h.planet) + "'s, whose trump is " + Z.PLANETS[h.planet].trump);
        todayOut.innerHTML = bits.map(function (b, i) { return i ? b : b; }).join("; ") + ". <a href=\"/temple/zodiac/\">The wheel</a> shows the rest.";
        todayOut.querySelectorAll("a").forEach(function () {});
    }
    // ---- the deck below: every card small, a button each ---------------------------------------------
    function gallery() {
        if (!deckOut) return;
        var frag = document.createDocumentFragment();
        DECK.forEach(function (card) {
            var b = document.createElement("button"); b.type = "button"; b.setAttribute("aria-label", card.name); b.dataset.slug = card.slug; b.id = "pick-" + card.slug;
            var c = document.createElement("canvas"), cw = 66, ch = Math.round(cw * 1.7); c.width = cw * DPR; c.height = ch * DPR; c.style.width = cw + "px"; c.style.height = ch + "px";
            var g = c.getContext("2d"); g.setTransform(DPR, 0, 0, DPR, 0, 0); drawCard(g, card, cw / 2, ch / 2, ch - 2, false, INK);
            var cap = document.createElement("span"); cap.textContent = card.trump != null ? ROMAN[card.trump] : card.rank === 1 ? "A" : card.rank <= 10 ? String(card.rank) : card.court[0];
            b.appendChild(c); b.appendChild(cap); frag.appendChild(b);
        });
        deckOut.appendChild(frag);
        deckOut.addEventListener("click", function (e) {
            var b = e.target.closest("button"); if (!b) return;
            var card = BY[b.dataset.slug]; if (!card) return;
            show(card); history.replaceState(null, "", "#" + card.slug);
            stage.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }
    // ---- hands ------------------------------------------------------------------------------------
    var spreadBtns = document.querySelectorAll("[data-spread]");
    function pressed() { spreadBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.spread === spread)); }); }
    spreadBtns.forEach(function (b) { b.addEventListener("click", function () { spread = b.dataset.spread; pressed(); deal(); }); });
    if (againBtn) againBtn.addEventListener("click", deal);
    if (revBtn) { revBtn.setAttribute("aria-pressed", String(reversals)); revBtn.addEventListener("click", function () { reversals = !reversals; revBtn.setAttribute("aria-pressed", String(reversals)); deal(); }); }
    addEventListener("resize", resize);
    gallery(); today(); setInterval(today, 60000);
    var asked = BY[(location.hash || "").slice(1)];
    resize();
    if (asked) show(asked); else { pressed(); deal(); }
    window.Tarot = { DECK: DECK, BY: BY, WAITE: WAITE, drawCard: drawCard, deal: deal, show: show, about: about, spread: function (s) { spread = s; pressed(); deal(); } };
})();
