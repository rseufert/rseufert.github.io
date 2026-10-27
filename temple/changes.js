/* temple/changes.js: the changes.
   The I Ching cast on a canvas: by the yarrow stalks' odds (one in
   sixteen for an old yin, five for a young yang, seven for a young yin,
   three for an old yang) or by three coins, or six numbers typed in. The
   hexagram is drawn with its moving lines marked, the hexagram it
   changes into beside it, and the page reads the Judgment and the moving
   lines from the Chinese text (the Gutenberg Yijing, on the shelf), with
   a plain English gloss of the Judgment that is this site's own and
   Legge's full translation of 1882 on the shelf beside it. The nuclear,
   the opposite and the inverse hexagrams are named, and the trigrams.
   Nothing is stored or sent. One script, no library. */
(function () {
    "use strict";
    var canvas = document.getElementById("changes-stage");
    if (!canvas) return;
    var ctx = canvas.getContext("2d"), stage = canvas.parentNode;
    var readOut = document.getElementById("changes-reading"), allOut = document.getElementById("changes-all"), linesIn = document.getElementById("changes-lines"), askIn = document.getElementById("changes-question");
    var MONO = 'Menlo, Consolas, "DejaVu Sans Mono", monospace', SERIF = 'Georgia, "Times New Roman", serif', HAN = '"Songti SC", "Noto Serif CJK SC", "SimSun", "PingFang SC", "Hiragino Sans", serif';
    var INK = "#7cf5c8", DIM = "#2a5a4a", FAINT = "#163a2e", AMBER = "#ffb000", PAPER = "#020705", DPR = Math.min(2, window.devicePixelRatio || 1);
    // The sixty-four in King Wen's order: the lines from the bottom up, 1 a whole line and 0 a broken one.
    var KW = "111111 000000 100010 010001 111010 010111 010000 000010 111011 110111 111000 000111 101111 111101 001000 000100 100110 011001 110000 000011 100101 101001 000001 100000 100111 111001 100001 011110 010010 101101 001110 011100 001111 111100 000101 101000 101011 110101 001010 010100 110001 100011 111110 011111 000110 011000 010110 011010 101110 011101 100100 001001 001011 110100 101100 001101 011011 110110 010011 110010 110011 001100 101010 010101".split(" ");
    // Each hexagram's name in pinyin, in Legge's spelling, and a plain gloss; and a plain gloss of its Judgment, this site's own, after the Chinese.
    var NAMES = [
        ["Qián", "Khien", "heaven, the strong"], ["Kūn", "Khwăn", "earth, the yielding"], ["Zhūn", "Kun", "sprouting, hard beginnings"], ["Méng", "Măng", "the young fool"],
        ["Xū", "Hsü", "waiting"], ["Sòng", "Sung", "dispute"], ["Shī", "Sze", "the army"], ["Bǐ", "Pî", "holding together"],
        ["Xiǎo Chù", "Hsiâo Khû", "the small restraint"], ["Lǚ", "Lî", "treading"], ["Tài", "Thâi", "peace"], ["Pǐ", "Phî", "standstill"],
        ["Tóng Rén", "Thung Zăn", "fellowship"], ["Dà Yǒu", "Tâ Yû", "great holdings"], ["Qiān", "Khien", "modesty"], ["Yù", "Yü", "readiness, delight"],
        ["Suí", "Sui", "following"], ["Gǔ", "Kû", "the rot to be mended"], ["Lín", "Lin", "approach"], ["Guān", "Kwân", "looking, being seen"],
        ["Shì Kè", "Shih Ho", "biting through"], ["Bì", "Pî", "adornment"], ["Bō", "Po", "stripping away"], ["Fù", "Fû", "return"],
        ["Wú Wàng", "Wû Wang", "no guile"], ["Dà Chù", "Tâ Khû", "the great restraint"], ["Yí", "Î", "the jaws, nourishing"], ["Dà Guò", "Tâ Kwo", "the great going-past"],
        ["Kǎn", "Khan", "the pit, water"], ["Lí", "Lî", "the bright, fire"], ["Xián", "Hsien", "feeling, influence"], ["Héng", "Hăng", "lasting"],
        ["Dùn", "Thun", "retreat"], ["Dà Zhuàng", "Tâ Kwang", "great strength"], ["Jìn", "Tsin", "advance"], ["Míng Yí", "Ming Î", "the light wounded"],
        ["Jiā Rén", "Kiâ Zăn", "the household"], ["Kuí", "Khwei", "estrangement"], ["Jiǎn", "Kien", "the hard road"], ["Xiè", "Kieh", "release"],
        ["Sǔn", "Sun", "decrease"], ["Yì", "Yî", "increase"], ["Guài", "Kwâi", "resolution, the break"], ["Gòu", "Kâu", "the meeting"],
        ["Cuì", "Tshui", "gathering"], ["Shēng", "Shăng", "rising"], ["Kùn", "Khwăn", "hemmed in"], ["Jǐng", "Tsing", "the well"],
        ["Gé", "Ko", "the hide, revolution"], ["Dǐng", "Ting", "the cauldron"], ["Zhèn", "Kăn", "thunder, the shock"], ["Gèn", "Kăn", "the mountain, stillness"],
        ["Jiàn", "Kien", "gradual advance"], ["Guī Mèi", "Kwei Mei", "the younger sister given in marriage"], ["Fēng", "Făng", "plenty"], ["Lǚ", "Lü", "the traveller"],
        ["Xùn", "Sun", "the wind, the penetrating"], ["Duì", "Tui", "the lake, gladness"], ["Huàn", "Hwân", "dispersing"], ["Jié", "Kieh", "limits"],
        ["Zhōng Fú", "Kung Fû", "truth within"], ["Xiǎo Guò", "Hsiâo Kwo", "the small going-past"], ["Jì Jì", "Kî Zî", "already across"], ["Wèi Jì", "Wei Zî", "not yet across"]
    ];
    var JUDGE = [
        "Supreme success; it is favourable to be firm.",
        "Supreme success; favourable through the firmness of a mare. The superior man has somewhere to go: leading, he loses the way; following, he finds a lord. Friends in the west and south, none in the east and north. Peace in firmness brings good fortune.",
        "Supreme success; favourable to be firm. Do not use it to go anywhere; favourable to set up lords.",
        "Success. It is not I who seek the young fool; the young fool seeks me. At the first asking I tell him; a second and a third time is pestering, and the pest is not told. Favourable to be firm.",
        "With sincerity, light and success; firmness brings good fortune. Favourable to cross the great water.",
        "Sincere, but obstructed; wary in the middle brings good fortune, to the end brings misfortune. Favourable to see the great man; not favourable to cross the great water.",
        "Firmness. For a seasoned man, good fortune, no blame.",
        "Good fortune. Consult the oracle again: being great, lasting and firm, no blame. The unquiet come; the one who comes late has misfortune.",
        "Success. Dense clouds and no rain from our western border.",
        "Treading on the tiger's tail; it does not bite the man. Success.",
        "The small goes, the great comes. Good fortune and success.",
        "The wrong people: not favourable to the superior man's firmness. The great goes, the small comes.",
        "Fellowship in the open: success. Favourable to cross the great water; favourable for the superior man to be firm.",
        "Supreme success.",
        "Success. The superior man carries it through to the end.",
        "Favourable to set up lords and to move armies.",
        "Supreme success; favourable to be firm; no blame.",
        "Supreme success. Favourable to cross the great water. Three days before the first day, three days after.",
        "Supreme success; favourable to be firm. In the eighth month there will be misfortune.",
        "The washing done, the offering not yet made: sincere, and looked up to.",
        "Success. Favourable to use the law.",
        "Success. In small matters it is favourable to go somewhere.",
        "Not favourable to go anywhere.",
        "Success. Going out and coming in without harm; friends come, no blame. The way turns back; on the seventh day it returns. Favourable to go somewhere.",
        "Supreme success; favourable to be firm. If one is not correct there is error, and it is not favourable to go anywhere.",
        "Favourable to be firm. Not eating at home brings good fortune. Favourable to cross the great water.",
        "Firmness brings good fortune. Watch the jaws, and what you seek to fill your mouth with.",
        "The ridgepole sags. Favourable to go somewhere; success.",
        "The pit, doubled. With sincerity the heart has success; going has merit.",
        "Favourable to be firm; success. Keeping a cow brings good fortune.",
        "Success; favourable to be firm. Taking a maiden brings good fortune.",
        "Success, no blame; favourable to be firm; favourable to go somewhere.",
        "Success. In small matters it is favourable to be firm.",
        "Favourable to be firm.",
        "The marquis of Kang is given many horses, and received three times in a day.",
        "Favourable to be firm in hardship.",
        "Favourable for a woman to be firm.",
        "In small matters, good fortune.",
        "Favourable in the south-west, not in the north-east. Favourable to see the great man; firmness brings good fortune.",
        "Favourable in the south-west. With nowhere to go, coming back brings good fortune; with somewhere to go, early brings good fortune.",
        "With sincerity, supreme good fortune, no blame; one may be firm; favourable to go somewhere. How to use it: two bowls may serve for the offering.",
        "Favourable to go somewhere; favourable to cross the great water.",
        "Proclaimed in the king's court. A sincere cry: there is danger. Tell your own city; not favourable to take up arms; favourable to go somewhere.",
        "The woman is strong: do not take the woman.",
        "Success. The king comes to the temple. Favourable to see the great man; success; favourable to be firm. Great offerings bring good fortune; favourable to go somewhere.",
        "Supreme success. Use it to see the great man; do not worry. A march to the south brings good fortune.",
        "Success; firmness. For the great man, good fortune, no blame. Words are not believed.",
        "The town may be moved, the well is not; no loss, no gain; they come and go, and the well is a well. Nearly drawn, but the rope does not reach, and the pitcher breaks: misfortune.",
        "On your own day you are believed. Supreme success; favourable to be firm; regret vanishes.",
        "Supreme good fortune; success.",
        "Success. The thunder comes, oh, oh; then laughter, ha, ha. The thunder frightens a hundred miles, and he does not drop the ladle and the wine.",
        "Keeping the back still, he does not get his body; walking in his courtyard, he does not see his people. No blame.",
        "A maiden given in marriage: good fortune. Favourable to be firm.",
        "To go forward brings misfortune; nothing is favourable.",
        "Success. The king attains it. Do not grieve; be like the sun at noon.",
        "Small success. Firmness on the road brings good fortune.",
        "Small success. Favourable to go somewhere; favourable to see the great man.",
        "Success; favourable to be firm.",
        "Success. The king comes to the temple. Favourable to cross the great water; favourable to be firm.",
        "Success. Bitter limits may not be kept.",
        "Pigs and fishes: good fortune. Favourable to cross the great water; favourable to be firm.",
        "Success; favourable to be firm. Small things may be done, not great. The flying bird leaves its cry: it should not go up but down. Great good fortune.",
        "Success in small things; favourable to be firm. Good fortune at the start, disorder at the end.",
        "Success. The little fox, nearly across, wets its tail: nothing is favourable."
    ];
    // The text, from the Gutenberg Yijing: the name, the Judgment, the Image, the six lines from the bottom, and the seventh text where there is one.
    var TEXT = [["乾","元，亨，利，貞。","天行健，君子以自強不息。",["潛龍，勿用。","見龍在田，利見大人。","君子終日乾乾，夕惕，若厲，無咎。","或躍在淵，無咎。","飛龍在天，利見大人。","亢龍有悔。"],"見群龍無首，吉。"],
        ["坤","元，亨，利牝馬之貞。","地勢坤，君子以厚德載物。",["履霜，堅冰至。","直，方，大，不習無不利。","含章可貞。或從王事，無成有終。","括囊；無咎，無譽。","黃裳，元吉。","戰龍於野，其血玄黃。"],"利永貞。"],
        ["屯","元，亨，利，貞，勿用，有攸往，利建侯。","雲，雷，屯；君子以經綸。",["磐桓；利居貞，利建侯。","屯如邅如，乘馬班如。匪寇婚媾，女子貞不字，十年乃字。","既鹿無虞，惟入于林中，君子幾不如舍，往吝。","乘馬班如，求婚媾，往吉，無不利。","屯其膏，小貞吉，大貞凶。","乘馬班如，泣血漣如。"],""],
        ["蒙","亨。匪我求童蒙，童蒙求我。初噬告，再三瀆，瀆則不告。利貞。","山下出泉，蒙；君子以果行育德。",["發蒙，利用刑人，用說桎梏，以往吝。","包蒙，吉；納婦，吉；子克家。","勿用娶女；見金夫，不有躬，無攸利。","困蒙，吝。","童蒙，吉。","擊蒙；不利為寇，利御寇。"],""],
        ["需","有孚，光亨，貞吉。利涉大川。","雲上於天，需；君子以飲食宴樂。",["需于郊。利用恆，無咎。","需于沙。小有言，終吉。","需于泥，致寇至。","需于血，出自穴。","需于酒食，貞吉。","入于穴，有不速之客三人來，敬之終吉。"],""],
        ["訟","有孚，窒。惕中吉。終凶。利見大人，不利涉大川。","天與水違行，訟；君子以作事謀始。",["不永所事，小有言，終吉。","不克訟，歸而逋，其邑人三百戶，無眚。","食舊德，貞厲，終吉，或從王事，無成。","不克訟，復即命，渝安貞，吉。","訟元吉。","或錫之鞶帶，終朝三褫之。"],""],
        ["師","貞，丈人，吉無咎。","地中有水，師；君子以容民畜眾。",["師出以律，否臧凶。","在師中，吉無咎，王三錫命。","師或輿尸，凶。","師左次，無咎。","田有禽，利執言，無咎。長子帥師，弟子輿尸，貞凶。","大君有命，開國承家，小人勿用。"],""],
        ["比","吉。原筮元永貞，無咎。不寧方來，後夫凶。","地上有水，比；先王以建萬國，親諸侯。",["有孚比之，無咎。有孚盈缶，終來有他，吉。","比之自內，貞吉。","比之匪人。","外比之，貞吉。","顯比，王用三驅，失前禽。邑人不誡，吉。","比之無首，凶。"],""],
        ["小畜","亨。密雲不雨，自我西郊。","風行天上，小畜；君子以懿文德。",["復自道，何其咎，吉。","牽復，吉。","輿說輻，夫妻反目。","有孚，血去。惕出，無咎。","有孚攣如，富以其鄰。","既雨既處，尚德載婦，貞厲。月幾望，君子征凶。"],""],
        ["履","履虎尾，不咥人，亨。","上天下澤，履；君子以辯上下，定民志。",["素履，往無咎。","履道坦坦，幽人貞吉。","眇能視，跛能履，履虎尾，咥人，凶。武人為于大君。","履虎尾，愬愬，終吉。","夬履，貞厲。","視履考祥，其旋元吉。"],""],
        ["泰","小往大來，吉亨。","天地交泰，后以財成天地之道，輔相天地之宜，以左右民。",["拔茅茹，以其彙，征吉。","包荒，用馮河，不遐遺，朋亡，得尚于中行。","無平不陂，無往不復，艱貞無咎。勿恤其孚，于食有福。","翩翩不富，以其鄰，不戒以孚。","帝乙歸妹，以祉元吉。","城復于隍，勿用師。自邑告命，貞吝。"],""],
        ["否","否之匪人，不利君子貞，大往小來。","天地不交，否；君子以儉德辟難，不可榮以祿。",["拔茅茹，以其彙，貞吉亨。","包承。小人吉，大人否亨。","包羞。","有命無咎，疇離祉。","休否，大人吉。其亡其亡，繫于苞桑。","傾否，先否後喜。"],""],
        ["同人","同人于野，亨。利涉大川，利君子貞。","天與火，同人；君子以類族辨物。",["同人于門，無咎。","同人于宗，吝。","伏戎于莽，升其高陵，三歲不興。","乘其墉，弗克攻，吉。","同人，先號咷而後笑。大師克相遇。","同人于郊，無悔。"],""],
        ["大有","元亨。","火在天上，大有；君子以遏惡揚善，順天休命。",["無交害，匪咎，艱則無咎。","大車以載，有攸往，無咎。","公用亨于天子，小人弗克。","匪其彭，無咎。","厥孚交如，威如；吉。","自天佑之，吉無不利。"],""],
        ["謙","亨，君子有終。","地中有山，謙；君子以裒多益寡，稱物平施。",["謙謙君子，用涉大川，吉。","鳴謙，貞吉。","勞謙君子，有終吉。","無不利，撝謙。","不富，以其鄰，利用侵伐，無不利。","鳴謙，利用行師，征邑國。"],""],
        ["豫","利建侯行師。","雷出地奮，豫。先王以作樂崇德，殷薦之上帝，以配祖考。",["鳴豫，凶。","介于石，不終日，貞吉。","盱豫，悔。遲有悔。","由豫，大有得。勿疑。朋盍簪。","貞疾，恆不死。","冥豫，成有渝，無咎。"],""],
        ["隨","元亨利貞，無咎。","澤中有雷，隨；君子以嚮晦入宴息。",["官有渝，貞吉。出門交有功。","係小子，失丈夫。","係丈夫，失小子。隨有求得，利居貞。","隨有獲，貞凶。有孚在道，以明，何咎。","孚于嘉，吉。","拘系之，乃從維之。王用亨于西山。"],""],
        ["蠱","元亨，利涉大川。先甲三日，後甲三日。","山下有風，蠱；君子以振民育德。",["幹父之蠱，有子，考無咎，厲終吉。","幹母之蠱，不可貞。","幹父小有晦，無大咎。","裕父之蠱，往見吝。","幹父之蠱，用譽。","不事王侯，高尚其事。"],""],
        ["臨","元，亨，利，貞。至于八月有凶。","澤上有地，臨；君子以教思無窮，容保民無疆。",["咸臨，貞吉。","咸臨，吉無不利。","甘臨，無攸利。既憂之，無咎。","至臨，無咎。","知臨，大君之宜，吉。","敦臨，吉無咎。"],""],
        ["觀","盥而不薦，有孚顒若。","風行地上，觀；先王以省方，觀民設教。",["童觀，小人無咎，君子吝。","窺觀，利女貞。","觀我生，進退。","觀國之光，利用賓于王。","觀我生，君子無咎。","觀其生，君子無咎。"],""],
        ["噬嗑","亨。利用獄。","雷電噬嗑；先王以明罰敕法。",["履校滅趾，無咎。","噬膚滅鼻，無咎。","噬臘肉，遇毒；小吝，無咎。","噬乾胏，得金矢，利艱貞，吉。","噬乾肉，得黃金，貞厲，無咎。","何校滅耳，凶。"],""],
        ["賁","亨。小利有所往。","山下有火，賁；君子以明庶政，無敢折獄。",["賁其趾，舍車而徒。","賁其須。","賁如濡如，永貞吉。","賁如皤如，白馬翰如，匪寇婚媾。","賁于丘園，束帛戔戔，吝，終吉。","白賁，無咎。"],""],
        ["剝","不利有攸往。","山附于地，剝；上以厚下，安宅。",["剝床以足，蔑貞凶。","剝床以辨，蔑貞凶。","剝之，無咎。","剝床以膚，凶。","貫魚，以宮人寵，無不利。","碩果不食，君子得輿，小人剝廬。"],""],
        ["復","亨。出入無疾，朋來無咎。反復其道，七日來復，利有攸往。","雷在地中，復；先王以至日閉關，商旅不行，后不省方。",["不復遠，無祗悔，元吉。","休復，吉。","頻復厲，無咎。","中行獨復。","敦復，無悔。","迷復，凶，有災眚。用行師，終有大敗，以其國君，凶；至于十年，不克征。"],""],
        ["無妄","元，亨，利，貞。其匪正有眚，不利有攸往。","天下雷行，物與無妄；先王以茂對時，育萬物。",["無妄，往吉。","不耕獲，不菑畬，則利有攸往。","無妄之災，或繫之牛，行人之得，邑人之災。","可貞，無咎。","無妄之疾，勿藥有喜。","無妄，行有眚，無攸利。"],""],
        ["大畜","利貞，不家食吉，利涉大川。","天在山中，大畜；君子以多識前言往行，以畜其德。",["有厲利已。","輿說輻。","良馬逐，利艱貞。日閑輿衛，利有攸往。","童牛之牿，元吉。","豶豕之牙，吉。","何天之衢，亨。"],""],
        ["頤","貞吉。觀頤，自求口實。","山下有雷，頤；君子以慎言語，節飲食。",["舍爾靈龜，觀我朵頤，凶。","顛頤，拂經于丘頤，征凶。","拂頤，貞凶，十年勿用，無攸利。","顛頤吉，虎視眈眈，其欲逐逐，無咎。","拂經，居貞吉，不可涉大川。","由頤，厲吉，利涉大川。"],""],
        ["大過","棟橈，利有攸往，亨。","澤滅木，大過；君子以獨立不懼，遯世無悶。",["藉用白茅，無咎。","枯楊生稊，老夫得其女妻，無不利。","棟橈，凶。","棟隆，吉；有它吝。","枯楊生華，老婦得士夫，無咎無譽。","過涉滅頂，凶，無咎。"],""],
        ["坎","習坎，有孚，維心亨，行有尚。","水洊至，習坎；君子以常德行，習教事。",["習坎，入于坎窞，凶。","坎有險，求小得。","來之坎坎，險且枕，入于坎窞，勿用。","樽酒簋貳，用缶，納約自牖，終無咎。","坎不盈，祗既平，無咎。","係用徽纆，寘于叢棘，三歲不得，凶。"],""],
        ["離","利貞，亨。畜牝牛，吉。","明兩作離，大人以繼明照于四方。",["履錯然，敬之無咎。","黃離，元吉。","日昃之離，不鼓缶而歌，則大耋之嗟，凶。","突如其來如，焚如，死如，棄如。","出涕沱若，戚嗟若，吉。","王用出征，有嘉折首，獲匪其醜，無咎。"],""],
        ["咸","亨，利貞，取女吉。","山上有澤，咸；君子以虛受人。",["咸其拇。","咸其腓，凶，居吉。","咸其股，執其隨，往吝。","貞吉悔亡，憧憧往來，朋從爾思。","咸其脢，無悔。","咸其輔，頰，舌。"],""],
        ["恆","亨，無咎，利貞，利有攸往。","雷風，恆；君子以立不易方。",["浚恆，貞凶，無攸利。","悔亡。","不恆其德，或承之羞，貞吝。","田無禽。","恆其德，貞，婦人吉，夫子凶。","振恆，凶。"],""],
        ["遯","亨，小利貞。","天下有山，遯；君子以遠小人，不惡而嚴。",["遯尾，厲，勿用有攸往。","執之用黃牛之革，莫之勝說。","係遯，有疾厲，畜臣妾吉。","好遯君子吉，小人否。","嘉遯，貞吉。","肥遯，無不利。"],""],
        ["大壯","利貞。","雷在天上，大壯；君子以非禮弗履。",["壯于趾，征凶，有孚。","貞吉。","小人用壯，君子用罔，貞厲。羝羊觸藩，羸其角。","貞吉悔亡，藩決不羸，壯于大輿之輹。","喪羊于易，無悔。","羝羊觸藩，不能退，不能遂，無攸利，艱則吉。"],""],
        ["晉","康侯用錫馬蕃庶，晝日三接。","明出地上，晉；君子以自昭明德。",["晉如，摧如，貞吉。罔孚，裕無咎。","晉如，愁如，貞吉。受茲介福，于其王母。","眾允，悔亡。","晉如鼫鼠，貞厲。","悔亡，失得勿恤，往吉無不利。","晉其角，維用伐邑，厲吉無咎，貞吝。"],""],
        ["明夷","利艱貞。","明入地中，明夷；君子以蒞眾，用晦而明。",["明夷于飛，垂其翼。君子于行，三日不食，有攸往，主人有言。","明夷，夷于左股，用拯馬壯，吉。","明夷于南狩，得其大首，不可疾貞。","入于左腹，獲明夷之心，于出門庭。","箕子之明夷，利貞。","不明晦，初登于天，後入于地。"],""],
        ["家人","利女貞。","風自火出，家人；君子以言有物，而行有恆。",["閑有家，悔亡。","無攸遂，在中饋，貞吉。","家人嗃嗃，悔厲吉；婦子嘻嘻，終吝。","富家，大吉。","王假有家，勿恤吉。","有孚威如，終吉。"],""],
        ["睽","小事吉。","上火下澤，睽；君子以同而異。",["悔亡，喪馬勿逐，自復；見惡人無咎。","遇主于巷，無咎。","見輿曳，其牛掣，其人天且劓，無初有終。","睽孤，遇元夫，交孚，厲無咎。","悔亡，厥宗噬膚，往何咎。","睽孤，見豕負塗，載鬼一車，先張之弧，後說之弧，匪寇婚媾，往遇雨則吉。"],""],
        ["蹇","利西南，不利東北；利見大人，貞吉。","山上有水，蹇；君子以反身修德。",["往蹇，來譽。","王臣蹇蹇，匪躬之故。","往蹇來反。","往蹇來連。","大蹇朋來。","往蹇來碩，吉；利見大人。"],""],
        ["解","利西南，無所往，其來復吉。有攸往，夙吉。","雷雨作，解；君子以赦過宥罪。",["無咎。","田獲三狐，得黃矢，貞吉。","負且乘，致寇至，貞吝。","解而拇，朋至斯孚。","君子維有解，吉；有孚于小人。","公用射隼，于高墉之上，獲之，無不利。"],""],
        ["損","有孚，元吉，無咎，可貞，利有攸往？曷之用，二簋可用享。","山下有澤，損；君子以懲忿窒欲。",["已事遄往，無咎，酌損之。","利貞，征凶，弗損益之。","三人行，則損一人；一人行，則得其友。","損其疾，使遄有喜，無咎。","或益之，十朋之龜弗克違，元吉。","弗損益之，無咎，貞吉，利有攸往，得臣無家。"],""],
        ["益","利有攸往，利涉大川。","風雷，益；君子以見善則遷，有過則改。",["利用為大作，元吉，無咎。","或益之，十朋之龜弗克違，永貞吉。王用享于帝，吉。","益之用凶事，無咎。有孚中行，告公用圭。","中行，告公從。利用為依遷國。","有孚惠心，勿問元吉。有孚惠我德。","莫益之，或擊之，立心勿恆，凶。"],""],
        ["夬","揚于王庭，孚號，有厲，告自邑，不利即戎，利有攸往。","澤上于天，夬；君子以施祿及下，居德則忌。",["壯于前趾，往不勝為吝。","惕號，莫夜有戎，勿恤。","壯于頄，有凶。君子夬夬，獨行遇雨，若濡有慍，無咎。","臀無膚，其行次且。牽羊悔亡，聞言不信。","莧陸夬夬，中行無咎。","無號，終有凶。"],""],
        ["姤","女壯，勿用取女。","天下有風，姤；后以施命誥四方。",["繫于金柅，貞吉，有攸往，見凶，羸豕孚蹢躅。","包有魚，無咎，不利賓。","臀無膚，其行次且，厲，無大咎。","包無魚，起凶。","以杞包瓜，含章，有隕自天。","姤其角，吝，無咎。"],""],
        ["萃","亨。王假有廟，利見大人，亨，利貞。用大牲吉，利有攸往。","澤上於地，萃；君子以除戎器，戒不虞。",["有孚不終，乃亂乃萃，若號一握為笑，勿恤，往無咎。","引吉，無咎，孚乃利用禴。","萃如，嗟如，無攸利，往無咎，小吝。","大吉，無咎。","萃有位，無咎。匪孚，元永貞，悔亡。","齎咨涕洟，無咎。"],""],
        ["升","元亨，用見大人，勿恤，南征吉。","地中生木，升；君子以順德，積小以高大。",["允升，大吉。","孚乃利用禴，無咎。","升虛邑。","王用亨于岐山，吉無咎。","貞吉，升階。","冥升，利于不息之貞。"],""],
        ["困","亨，貞，大人吉，無咎，有言不信。","澤無水，困；君子以致命遂志。",["臀困于株木，入于幽谷，三歲不覿。","困于酒食，朱紱方來，利用亨祀，征凶，無咎。","困于石，據于蒺藜，入于其宮，不見其妻，凶。","來徐徐，困于金車，吝，有終。","劓刖，困于赤紱，乃徐有說，利用祭祀。","困于葛藟，于臲卼，曰動悔。有悔，征吉。"],""],
        ["井","改邑不改井，無喪無得，往來井井。汔至，亦未繘井，羸其瓶，凶。","木上有水，井；君子以勞民勸相。",["井泥不食，舊井無禽。","井谷射鮒，甕敝漏。","井渫不食，為我民惻，可用汲，王明，並受其福。","井甃，無咎。","井冽，寒泉食。","井收勿幕，有孚無吉。"],""],
        ["革","己日乃孚，元亨利貞，悔亡。","澤中有火，革；君子以治歷明時。",["鞏用黃牛之革。","己日乃革之，征吉，無咎。","征凶，貞厲，革言三就，有孚。","悔亡，有孚改命，吉。","大人虎變，未占有孚。","君子豹變，小人革面，征凶，居貞吉。"],""],
        ["鼎","元吉，亨。","木上有火，鼎；君子以正位凝命。",["鼎顛趾，利出否，得妾以其子，無咎。","鼎有實，我仇有疾，不我能即，吉。","鼎耳革，其行塞，雉膏不食，方雨虧悔，終吉。","鼎折足，覆公餗，其形渥，凶。","鼎黃耳金鉉，利貞。","鼎玉鉉，大吉，無不利。"],""],
        ["震","亨。震來虩虩，笑言啞啞。震驚百里，不喪匕鬯。","洊雷，震；君子以恐懼修身。",["震來虩虩，後笑言啞啞，吉。","震來厲，億喪貝，躋于九陵，勿逐，七日得。","震蘇蘇，震行無眚。","震遂泥。","震往來厲，億無喪，有事。","震索索，視矍矍，征凶。震不于其躬，于其鄰，無咎。婚媾有言。"],""],
        ["艮","艮其背，不獲其身，行其庭，不見其人，無咎。","兼山，艮；君子以思不出其位。",["艮其趾，無咎，利永貞。","艮其腓，不拯其隨，其心不快。","艮其限，列其夤，厲薰心。","艮其身，無咎。","艮其輔，言有序，悔亡。","敦艮，吉。"],""],
        ["漸","女歸吉，利貞。","山上有木，漸；君子以居賢德，善俗。",["鴻漸于干，小子厲，有言，無咎。","鴻漸于磐，飲食衎衎，吉。","鴻漸于陸，夫征不復，婦孕不育，凶；利御寇。","鴻漸于木，或得其桷，無咎。","鴻漸于陵，婦三歲不孕，終莫之勝，吉。","鴻漸于逵，其羽可用為儀，吉。"],""],
        ["歸妹","征凶，無攸利。","澤上有雷，歸妹；君子以永終知敝。",["歸妹以娣，跛能履，征吉。","眇能視，利幽人之貞。","歸妹以須，反歸以娣。","歸妹愆期，遲歸有時。","帝乙歸妹，其君之袂，不如其娣之袂良，月幾望，吉。","女承筐無實，士刲羊無血，無攸利。"],""],
        ["豐","亨，王假之，勿憂，宜日中。","雷電皆至，豐；君子以折獄致刑。",["遇其配主，雖旬無咎，往有尚。","豐其蔀，日中見斗，往得疑疾，有孚發若，吉。","豐其沛，日中見沫，折其右肱，無咎。","豐其蔀，日中見斗，遇其夷主，吉。","來章，有慶譽，吉。","豐其屋，蔀其家，窺其戶，闃其無人，三歲不覿，凶。"],""],
        ["旅","小亨，旅貞吉。","山上有火，旅；君子以明慎用刑，而不留獄。",["旅瑣瑣，斯其所取災。","旅即次，懷其資，得童僕貞。","旅焚其次，喪其童僕，貞厲。","旅于處，得其資斧，我心不快。","射雉一矢亡，終以譽命。","鳥焚其巢，旅人先笑後號咷。喪牛于易，凶。"],""],
        ["巽","小亨，利攸往，利見大人。","隨風，巽；君子以申命行事。",["進退，利武人之貞。","巽在床下，用史巫紛若，吉無咎。","頻巽，吝。","悔亡，田獲三品。","貞吉悔亡，無不利。無初有終，先庚三日，後庚三日，吉。","巽在床下，喪其資斧，貞凶。"],""],
        ["兌","亨，利貞。","麗澤，兌；君子以朋友講習。",["和兌，吉。","孚兌，吉，悔亡。","來兌，凶。","商兌，未寧，介疾有喜。","孚于剝，有厲。","引兌。"],""],
        ["渙","亨。王假有廟，利涉大川，利貞。","風行水上，渙；先王以享于帝立廟。",["用拯馬壯，吉。","渙奔其機，悔亡。","渙其躬，無悔。","渙其群，元吉。渙有丘，匪夷所思。","渙汗其大號，渙王居，無咎。","渙其血，去逖出，無咎。"],""],
        ["節","亨。苦節不可貞。","澤上有水，節；君子以制數度，議德行。",["不出戶庭，無咎。","不出門庭，凶。","不節若，則嗟若，無咎。","安節，亨。","甘節，吉；往有尚。","苦節，貞凶，悔亡。"],""],
        ["中孚","豚魚，吉，利涉大川，利貞。","澤上有風，中孚；君子以議獄緩死。",["虞吉，有他不燕。","鳴鶴在陰，其子和之，我有好爵，吾與爾靡之。","得敵，或鼓或罷，或泣或歌。","月幾望，馬匹亡，無咎。","有孚攣如，無咎。","翰音登于天，貞凶。"],""],
        ["小過","亨，利貞，可小事，不可大事。飛鳥遺之音，不宜上宜下，大吉。","山上有雷，小過；君子以行過乎恭，喪過乎哀，用過乎儉。",["飛鳥以凶。","過其祖，遇其妣；不及其君，遇其臣；無咎。","弗過防之，從或戕之，凶。","無咎，弗過遇之。往厲必戒，勿用永貞。","密雲不雨，自我西郊，公弋取彼在穴。","弗遇過之，飛鳥離之，凶，是謂災眚。"],""],
        ["既濟","亨，小利貞，初吉終亂。","水在火上，既濟；君子以思患而預防之。",["曳其輪，濡其尾，無咎。","婦喪其茀，勿逐，七日得。","高宗伐鬼方，三年克之，小人勿用。","繻有衣袽，終日戒。","東鄰殺牛，不如西鄰之禴祭，實受其福。","濡其首，厲。"],""],
        ["未濟","亨，小狐汔濟，濡其尾，無攸利。","火在水上，未濟；君子以慎辨物居方。",["濡其尾，吝。","曳其輪，貞吉。","未濟，征凶，利涉大川。","貞吉，悔亡，震用伐鬼方，三年有賞于大國。","貞吉，無悔，君子之光，有孚，吉。","有孚于飲酒，無咎，濡其首，有孚失是。"],""]];
    var TRI = {
        "111": { c: "☰", name: "Qián", en: "heaven", family: "the father", animal: "horse", point: "north-west", body: "the head" },
        "000": { c: "☷", name: "Kūn", en: "earth", family: "the mother", animal: "ox", point: "south-west", body: "the belly" },
        "100": { c: "☳", name: "Zhèn", en: "thunder", family: "the eldest son", animal: "dragon", point: "east", body: "the foot" },
        "010": { c: "☵", name: "Kǎn", en: "water", family: "the middle son", animal: "pig", point: "north", body: "the ear" },
        "001": { c: "☶", name: "Gèn", en: "mountain", family: "the youngest son", animal: "dog", point: "north-east", body: "the hand" },
        "011": { c: "☴", name: "Xùn", en: "wind", family: "the eldest daughter", animal: "fowl", point: "south-east", body: "the thigh" },
        "101": { c: "☲", name: "Lí", en: "fire", family: "the middle daughter", animal: "pheasant", point: "south", body: "the eye" },
        "110": { c: "☱", name: "Duì", en: "lake", family: "the youngest daughter", animal: "sheep", point: "west", body: "the mouth" }
    };
    var INDEX = {}; KW.forEach(function (p, i) { INDEX[p] = i; });
    function hexOf(bits) { return INDEX[bits.join("")]; }                       // bits from the bottom, 1 whole
    function bitsOf(n) { return KW[n].split("").map(Number); }
    function lower(bits) { return bits.slice(0, 3).join(""); } function upper(bits) { return bits.slice(3).join(""); }
    function nuclear(bits) { return [bits[1], bits[2], bits[3], bits[2], bits[3], bits[4]]; }
    function opposite(bits) { return bits.map(function (b) { return 1 - b; }); }
    function inverse(bits) { return bits.slice().reverse(); }
    var ORD = ["first", "second", "third", "fourth", "fifth", "top"];

    // ---- casting ----------------------------------------------------------------------
    function random(n) { var a = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(a); return a[0] % n; }
    function yarrow() { var r = random(16); return r < 1 ? 6 : r < 6 ? 7 : r < 13 ? 8 : 9; }
    function coins() { return 2 + random(2) + 2 + random(2) + 2 + random(2); }
    var cast = null, method = "yarrow", W = 0, H = 0;
    function throwLines(fn) { cast = { lines: [0, 0, 0, 0, 0, 0].map(fn), method: method }; settle(); }
    function settle() {
        var bits = cast.lines.map(function (v) { return v % 2; }), moving = cast.lines.map(function (v) { return v === 6 || v === 9; });
        var changed = bits.map(function (b, i) { return moving[i] ? 1 - b : b; });
        cast.bits = bits; cast.moving = moving; cast.n = hexOf(bits); cast.to = moving.some(Boolean) ? hexOf(changed) : null; cast.changed = changed;
        if (location.hash) history.replaceState(null, "", location.pathname + location.search);
        draw(); reading();
    }
    function show(n) { cast = { lines: bitsOf(n).map(function (b) { return b ? 7 : 8; }), method: "shown" }; settle(); history.replaceState(null, "", "#hex-" + (n + 1)); }

    // ---- drawing ----------------------------------------------------------------------
    function resize() { var r = stage.getBoundingClientRect(); W = Math.round(r.width); H = Math.round(r.height); canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR); draw(); }
    function hexagram(c, bits, moving, x, y, w, col, hot) {   // drawn about (x, y), w wide; six bars from the bottom
        var gap = w * 0.16, bar = w * 0.11, y0 = y + 2.5 * (bar + gap);
        for (var i = 0; i < 6; i++) {
            var yy = y0 - i * (bar + gap), mv = moving && moving[i];
            c.fillStyle = mv ? hot : col; c.shadowColor = mv ? hot : col; c.shadowBlur = mv ? 10 : 0;
            if (bits[i]) c.fillRect(x - w / 2, yy - bar / 2, w, bar);
            else { c.fillRect(x - w / 2, yy - bar / 2, w * 0.4, bar); c.fillRect(x + w * 0.1, yy - bar / 2, w * 0.4, bar); }
            c.shadowBlur = 0;
            if (mv) {   // the old marks: a ring on an old yang, a cross on an old yin
                c.strokeStyle = PAPER; c.lineWidth = Math.max(1.5, bar * 0.18); c.beginPath();
                if (bits[i]) { c.arc(x, yy, bar * 0.32, 0, Math.PI * 2); c.stroke(); }
                else { c.strokeStyle = hot; c.moveTo(x - bar * 0.35, yy - bar * 0.35); c.lineTo(x + bar * 0.35, yy + bar * 0.35); c.moveTo(x + bar * 0.35, yy - bar * 0.35); c.lineTo(x - bar * 0.35, yy + bar * 0.35); c.stroke(); }
            }
        }
    }
    function draw() {
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
        if (!cast) return;
        var two = cast.to != null, w = Math.min(H * 0.42, two ? W * 0.22 : W * 0.3), x1 = two ? W * 0.3 : W / 2, x2 = W * 0.7, y = H * 0.44;
        hexagram(ctx, cast.bits, cast.moving, x1, y, w, INK, AMBER);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = INK; ctx.font = (w * 0.3) + "px " + HAN; ctx.fillText(TEXT[cast.n][0], x1, y + w * 0.95);
        ctx.fillStyle = DIM; ctx.font = Math.max(10, w * 0.09) + "px " + MONO; ctx.fillText((cast.n + 1) + " · " + NAMES[cast.n][0].toLowerCase() + " · " + NAMES[cast.n][2], x1, y + w * 1.2);
        // the trigrams named beside
        ctx.textAlign = "left"; ctx.fillStyle = FAINT; ctx.font = Math.max(10, w * 0.08) + "px " + MONO;
        ctx.fillText(TRI[upper(cast.bits)].c + " " + TRI[upper(cast.bits)].en, x1 + w * 0.6, y - w * 0.42); ctx.fillText(TRI[lower(cast.bits)].c + " " + TRI[lower(cast.bits)].en, x1 + w * 0.6, y + w * 0.42);
        if (two) {
            ctx.strokeStyle = DIM; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(W * 0.44, y); ctx.lineTo(W * 0.56, y); ctx.lineTo(W * 0.54, y - 5); ctx.moveTo(W * 0.56, y); ctx.lineTo(W * 0.54, y + 5); ctx.stroke();
            hexagram(ctx, cast.changed, null, x2, y, w, DIM, AMBER);
            ctx.textAlign = "center"; ctx.fillStyle = DIM; ctx.font = (w * 0.3) + "px " + HAN; ctx.fillText(TEXT[cast.to][0], x2, y + w * 0.95);
            ctx.font = Math.max(10, w * 0.09) + "px " + MONO; ctx.fillText((cast.to + 1) + " · " + NAMES[cast.to][0].toLowerCase() + " · " + NAMES[cast.to][2], x2, y + w * 1.2);
            ctx.textAlign = "left"; ctx.fillStyle = FAINT; ctx.font = Math.max(10, w * 0.08) + "px " + MONO;
            ctx.fillText(TRI[upper(cast.changed)].c + " " + TRI[upper(cast.changed)].en, x2 + w * 0.6, y - w * 0.42); ctx.fillText(TRI[lower(cast.changed)].c + " " + TRI[lower(cast.changed)].en, x2 + w * 0.6, y + w * 0.42);
        }
        ctx.textAlign = "center"; ctx.fillStyle = FAINT; ctx.font = "11px " + MONO;
        ctx.fillText(cast.method === "shown" ? "the hexagram, unmoving" : "cast by " + (cast.method === "yarrow" ? "the stalks' odds" : "three coins") + " · " + cast.lines.join(" ") + " from the bottom", W / 2, H - 14);
    }
    // ---- the reading ------------------------------------------------------------------
    function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    function link(n) { return "<a href=\"#hex-" + (n + 1) + "\" data-hex=\"" + n + "\">" + (n + 1) + " " + esc(TEXT[n][0]) + " " + esc(NAMES[n][0]) + ", " + esc(NAMES[n][2]) + "</a>"; }
    function principal(moving) {   // which moving line to weigh most, by the old rule of thumb
        var idx = []; moving.forEach(function (m, i) { if (m) idx.push(i); });
        if (idx.length === 1) return { line: idx[0], say: "one line moves: read it." };
        if (idx.length === 2) return { line: idx[1], say: "two lines move: read both, the upper one chiefly." };
        if (idx.length === 3) return { line: idx[1], say: "three lines move: the middle one chiefly." };
        if (idx.length === 4) return { line: null, say: "four lines move: read the lower of the two still lines, in the hexagram it becomes." };
        if (idx.length === 5) return { line: null, say: "five lines move: read the one still line, in the hexagram it becomes." };
        return { line: null, say: "all six move: read the hexagram it becomes" + (moving.length && (hexOf(moving.map(function () { return 1; })) === 0 || true) ? ", or the seventh text where there is one." : ".") };
    }
    function reading() {
        if (!readOut || !cast) return;
        var n = cast.n, t = TEXT[n], b = cast.bits, out = [];
        var q = askIn && askIn.value.trim();
        out.push("<h3>" + (n + 1) + ". " + esc(t[0]) + " " + esc(NAMES[n][0]) + ", " + esc(NAMES[n][2]) + " <span class=\"legge\">(Legge's " + esc(NAMES[n][1]) + ")</span></h3>");
        out.push("<p class=\"tri\">" + esc(TRI[upper(b)].c + " " + TRI[upper(b)].en) + " over " + esc(TRI[lower(b)].c + " " + TRI[lower(b)].en) + (q ? " · asked: " + esc(q) : "") + "</p>");
        out.push("<p class=\"han\">" + esc(t[0]) + "：" + esc(t[1]) + "</p><p class=\"gloss\">The Judgment: " + esc(JUDGE[n]) + "</p>");
        out.push("<p class=\"han\">象曰：" + esc(t[2]) + "</p><p class=\"gloss\">The Image, in the Chinese; Legge's English of it is <a href=\"/temple/read/#yiking\">on the shelf</a>.</p>");
        if (cast.moving.some(Boolean)) {
            var p = principal(cast.moving);
            out.push("<p class=\"rule\">" + esc(p.say.charAt(0).toUpperCase() + p.say.slice(1)) + "</p>");
            cast.moving.forEach(function (m, i) {
                if (!m) return;
                var six = !b[i], label = (i === 0 ? "初" : i === 5 ? "上" : "") + (six ? "六" : "九") + (i > 0 && i < 5 ? ["", "二", "三", "四", "五"][i] : "");
                out.push("<p class=\"han line" + (p.line === i ? " chief" : "") + "\">" + esc(label) + "：" + esc(t[3][i]) + "</p><p class=\"gloss\">The " + ORD[i] + " line, " + (six ? "an old six turning" : "an old nine turning") + (p.line === i ? "; the one to weigh." : ".") + "</p>");
            });
            if (cast.moving.every(Boolean) && t[4]) out.push("<p class=\"han line\">" + esc(n === 0 ? "用九" : "用六") + "：" + esc(t[4]) + "</p>");
            out.push("<p class=\"gloss\">It becomes " + link(cast.to) + ": " + esc(JUDGE[cast.to]) + "</p>");
        } else out.push("<p class=\"rule\">No line moves: the Judgment is the answer, and there is no second hexagram.</p>");
        out.push("<p class=\"kin\">Within it, the nuclear hexagram " + link(hexOf(nuclear(b))) + "; its opposite, every line turned, " + link(hexOf(opposite(b))) + "; turned upside down, " + (hexOf(inverse(b)) === n ? "itself" : link(hexOf(inverse(b)))) + ".</p>");
        out.push("<p class=\"kin\">" + esc(TRI[lower(b)].en.charAt(0).toUpperCase() + TRI[lower(b)].en.slice(1)) + " below is " + esc(TRI[lower(b)].family) + ", " + esc(TRI[lower(b)].point) + ", " + esc(TRI[lower(b)].animal) + ", " + esc(TRI[lower(b)].body) + "; " + esc(TRI[upper(b)].en) + " above is " + esc(TRI[upper(b)].family) + ", " + esc(TRI[upper(b)].point) + ", " + esc(TRI[upper(b)].animal) + ", " + esc(TRI[upper(b)].body) + ".</p>");
        readOut.innerHTML = out.join("");
    }
    // ---- all sixty-four, small --------------------------------------------------------
    function gallery() {
        if (!allOut) return;
        var frag = document.createDocumentFragment();
        KW.forEach(function (p, n) {
            var b = document.createElement("button"); b.type = "button"; b.dataset.hex = n; b.setAttribute("aria-label", (n + 1) + " " + NAMES[n][0] + ", " + NAMES[n][2]); b.id = "pick-hex-" + (n + 1);
            var c = document.createElement("canvas"), s = 44; c.width = s * DPR; c.height = s * DPR; c.style.width = s + "px"; c.style.height = s + "px";
            var g = c.getContext("2d"); g.setTransform(DPR, 0, 0, DPR, 0, 0); g.fillStyle = PAPER; g.fillRect(0, 0, s, s); hexagram(g, bitsOf(n), null, s / 2, s / 2, s * 0.7, INK, AMBER);
            var cap = document.createElement("span"); cap.textContent = (n + 1) + " " + TEXT[n][0];
            b.appendChild(c); b.appendChild(cap); frag.appendChild(b);
        });
        allOut.appendChild(frag);
        allOut.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) { show(+b.dataset.hex); stage.scrollIntoView({ behavior: "smooth", block: "start" }); } });
    }
    // ---- hands ------------------------------------------------------------------------
    document.querySelectorAll("[data-method]").forEach(function (b) {
        b.addEventListener("click", function () { method = b.dataset.method; document.querySelectorAll("[data-method]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); throwLines(method === "coins" ? coins : yarrow); });
    });
    if (linesIn) linesIn.addEventListener("change", function () {
        var digits = linesIn.value.replace(/[^6-9]/g, "");
        if (digits.length !== 6) return;
        method = "typed"; cast = { lines: digits.split("").map(Number), method: "typed" }; settle();
    });
    if (readOut) readOut.addEventListener("click", function (e) { var a = e.target.closest("a[data-hex]"); if (a) { e.preventDefault(); show(+a.dataset.hex); } });
    addEventListener("resize", resize);
    gallery();
    var m = /^#hex-(\d+)$/.exec(location.hash || "");
    resize();
    if (m && +m[1] >= 1 && +m[1] <= 64) show(+m[1] - 1); else throwLines(yarrow);
    window.Changes = { KW: KW, NAMES: NAMES, JUDGE: JUDGE, TEXT: TEXT, TRI: TRI, cast: function () { return cast; }, throwLines: throwLines, show: show, yarrow: yarrow, coins: coins };
})();
