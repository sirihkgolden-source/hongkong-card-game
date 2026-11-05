/**
 * 《香江小風波》垂直切片資料表（新專案重表，不綁舊年池／office）
 * 目錄暫名 hk-roguelite；對外產品名《香江小風波》
 */

/**
 * 開局金幣：夠買最便宜消耗品（黃大仙靈符 6 金）兩件，
 * 確保第一間士多唔會「乜都買唔到」。
 */
export const START_GOLD = 12;

export const META = {
  title: "香江小風波",
  act1Name: "後巷・夜醒",
  act2Name: "旺角霓虹",
  act3Name: "城寨・天台",
  /** @deprecated 用 act1Name */
  actName: "後巷・夜醒",
  isolationNote: "目錄暫名 hk-roguelite；產品名《香江小風波》／與根目錄舊香江 demo 隔離",
};

/**
 * Act 銜接過場：打贏本區 Boss 之後、入下一區之前顯示一句。
 * 用嚟交代「由後巷行到旺角、再由旺角爬到天台」嘅地理同情緒轉折。
 * key = 即將進入嘅 Act。
 */
export const ACT_TRANSITIONS = {
  2: {
    from: "後巷",
    to: "旺角霓虹",
    line: "鐵閘後面係條斜路。行上去，霓虹開始光到刺眼——旺角到了。",
    note: "街闊咗，但人情薄咗。",
  },
  3: {
    from: "旺角",
    to: "城寨・天台",
    line: "由旺角一路行到城寨邊，樓愈嚟愈高，天愈嚟愈窄。樓梯盡頭有道鐵門。",
    note: "上到天台，就冇退路。",
  },
};

/**
 * Act 級區背景（每個 Act 共用一張）
 * 路徑指向總導演確認嘅新美術；缺檔時 UI 會降級成內建霓虹漸層。
 */
export const ACT_BG = {
  1: "assets/art/bg/bg_act1_alley.jpg",
  2: "assets/art/bg/bg_act2_mongkok.jpg",
  3: "assets/art/bg/bg_act3_rooftop.jpg",
};

/** 取該 Act 的背景路徑（未知 Act fallback 去 Act1） */
export function actBg(act) {
  return ACT_BG[act] || ACT_BG[1];
}

/** @typedef {"attack"|"skill"} CardType */

/**
 * @type {Record<string, {
 *   id: string, name: string, type: CardType, cost: number,
 *   dmg?: number, block?: number, draw?: number, heal?: number,
 *   blurb: string, art: string, rarity: string
 * }>}
 */
export const CARDS = {
  S01: {
    id: "S01",
    name: "後巷抹油",
    type: "attack",
    cost: 0,
    dmg: 5,
    blurb: "抹一手油，先出手為敬。",
    art: "assets/skills/S01.png",
    rarity: "普通",
  },
  S15: {
    id: "S15",
    name: "廊燈直拳",
    type: "attack",
    cost: 1,
    dmg: 9,
    blurb: "廊燈底下，一拳見真章。",
    art: "assets/skills/S15.png",
    rarity: "普通",
  },
  S07: {
    id: "S07",
    name: "大力出奇蹟",
    type: "attack",
    cost: 2,
    dmg: 16,
    blurb: "搏一鋪——大力出奇蹟。",
    art: "assets/skills/S07.png",
    rarity: "稀有",
  },
  S12: {
    id: "S12",
    name: "埋單",
    type: "attack",
    cost: 1,
    dmg: 7,
    draw: 1,
    blurb: "埋單兼抽一張，節奏不斷。",
    art: "assets/skills/S12.png",
    rarity: "普通",
  },
  S40: {
    id: "S40",
    name: "紅白藍砸",
    type: "attack",
    cost: 1,
    dmg: 11,
    blurb: "袋一甩，對面暈兩秒。",
    art: "assets/skills/S40.png",
    rarity: "普通",
  },
  S64: {
    id: "S64",
    name: "打邊爐氣",
    type: "attack",
    cost: 2,
    dmg: 8,
    dmgBonusOnLowHp: 6,
    blurb: "血少氣旺：低於半血時額外傷害。",
    art: "assets/skills/S64.png",
    rarity: "稀有",
  },
  S14: {
    id: "S14",
    name: "油星飛濺",
    type: "attack",
    cost: 1,
    dmg: 6,
    blurb: "油星一濺，再補一下。",
    art: "assets/skills/S14.png",
    rarity: "普通",
  },
  S06: {
    id: "S06",
    name: "單車變摩托",
    type: "skill",
    cost: 1,
    draw: 2,
    blurb: "加速換擋，連抽兩張。",
    art: "assets/skills/S06.png",
    rarity: "稀有",
  },
  S11: {
    id: "S11",
    name: "萬年船",
    type: "skill",
    cost: 1,
    block: 7,
    blurb: "老牌穩陣，擋一陣。",
    art: "assets/skills/S11.png",
    rarity: "普通",
  },
  S46: {
    id: "S46",
    name: "鐵皮硬遮",
    type: "skill",
    cost: 1,
    block: 10,
    blurb: "鐵皮一擋，風雨難侵。",
    art: "assets/skills/S46.png",
    rarity: "普通",
  },
  S56: {
    id: "S56",
    name: "菠蘿油盾",
    type: "skill",
    cost: 2,
    block: 14,
    heal: 3,
    blurb: "厚盾兼暖胃。",
    art: "assets/skills/S56.png",
    rarity: "稀有",
  },
  S02: {
    id: "S02",
    name: "椒鹽補刀",
    type: "attack",
    cost: 0,
    dmg: 3,
    draw: 1,
    blurb: "便宜補刀，順手摸一張。",
    art: "assets/skills/S02.png",
    rarity: "普通",
  },
  S09: {
    id: "S09",
    name: "最緊要開心",
    type: "skill",
    cost: 0,
    heal: 5,
    blurb: "開心就係力量——回一點血。",
    art: "assets/skills/S09.png",
    rarity: "普通",
  },
  S16: {
    id: "S16",
    name: "壞管跳電",
    type: "attack",
    cost: 1,
    dmg: 5,
    mark: 2,
    blurb: "電一跳就留住——下回合對面再痛 2 點。",
    art: "assets/skills/S16.png",
    rarity: "普通",
  },
  S21: {
    id: "S21",
    name: "雨衣包紮",
    type: "skill",
    cost: 1,
    heal: 8,
    blurb: "雨衣一包，傷口先收埋。",
    art: "assets/skills/S21.png",
    rarity: "普通",
  },
  S22: {
    id: "S22",
    name: "掛波小心",
    type: "skill",
    cost: 0,
    block: 4,
    draw: 1,
    blurb: "小心掛波——擋一下再摸牌。",
    art: "assets/skills/S22.png",
    rarity: "普通",
  },
  S25: {
    id: "S25",
    name: "加底唔該",
    type: "skill",
    cost: 1,
    heal: 4,
    draw: 1,
    blurb: "加底唔該——回血兼抽一張。",
    art: "assets/skills/S25.png",
    rarity: "普通",
  },
  S31: {
    id: "S31",
    name: "舖面馬賽克",
    type: "skill",
    cost: 1,
    block: 9,
    blurb: "舖面砌實，擋得住撞。",
    art: "assets/skills/S31.png",
    rarity: "普通",
  },
  S47: {
    id: "S47",
    name: "芝麻糊暖",
    type: "skill",
    cost: 1,
    heal: 6,
    block: 3,
    blurb: "暖胃兼擋三點，茶記味道。",
    art: "assets/skills/S47.png",
    rarity: "普通",
  },
  S72: {
    id: "S72",
    name: "舊帳對數",
    type: "attack",
    cost: 2,
    dmg: 10,
    mark: 3,
    blurb: "數簿一翻，舊帳走唔甩——下回合對面再痛 3 點。",
    art: "assets/skills/S72.png",
    rarity: "稀有",
  },

  /* —— 角色專屬牌（每角 3 張，共 9；只入該角色選牌池＋開局牌組）—— */

  /** 阿油・後巷經紀：快攻／搏命 */
  S80: {
    id: "S80",
    name: "追落街",
    type: "attack",
    cost: 0,
    dmg: 4,
    draw: 1,
    blurb: "追落街再補一拳——快手嘅節奏唔可以斷。",
    art: "assets/skills/S02.png",
    rarity: "專屬",
    owner: "oil",
  },
  S81: {
    id: "S81",
    name: "拆招牌",
    type: "attack",
    cost: 1,
    dmg: 8,
    mark: 2,
    blurb: "招牌一拆，火花照落對面塊面——下回合再痛 2 點。",
    art: "assets/skills/S16.png",
    rarity: "專屬",
    owner: "oil",
  },
  S82: {
    id: "S82",
    name: "一鋪清袋",
    type: "attack",
    cost: 2,
    dmg: 14,
    dmgBonusOnLowHp: 6,
    blurb: "袋口一清，命都押埋——血少更狠。",
    art: "assets/skills/S07.png",
    rarity: "專屬",
    owner: "oil",
  },

  /** 阿珊・茶記夜更：檔口／盾奶 */
  S83: {
    id: "S83",
    name: "落半閘",
    type: "skill",
    cost: 1,
    block: 9,
    heal: 2,
    blurb: "鐵閘落一半，擋住先，順手回一口氣。",
    art: "assets/skills/S46.png",
    rarity: "專屬",
    owner: "asan",
  },
  S84: {
    id: "S84",
    name: "絲襪奶茶",
    type: "skill",
    cost: 1,
    heal: 7,
    draw: 1,
    blurb: "茶走濃啲，手就定啲——回血兼摸牌。",
    art: "assets/skills/S25.png",
    rarity: "專屬",
    owner: "asan",
  },
  S85: {
    id: "S85",
    name: "收爐",
    type: "skill",
    cost: 2,
    block: 16,
    blurb: "茶記收爐，爐門一關，今晚唔做你生意。",
    art: "assets/skills/S56.png",
    rarity: "專屬",
    owner: "asan",
  },

  /** 九哥・招牌工：抽牌／標記 */
  S86: {
    id: "S86",
    name: "招牌著燈",
    type: "skill",
    cost: 0,
    block: 3,
    draw: 1,
    blurb: "燈一著，全條街都知你喺度——擋一下再摸一張。",
    art: "assets/skills/S22.png",
    rarity: "專屬",
    owner: "kauko",
  },
  S87: {
    id: "S87",
    name: "跳掣",
    type: "attack",
    cost: 1,
    dmg: 4,
    mark: 4,
    blurb: "掣一跳，半條街停電——下回合再痛 4 點。",
    art: "assets/skills/S16.png",
    rarity: "專屬",
    owner: "kauko",
  },
  S88: {
    id: "S88",
    name: "掛滿霓虹",
    type: "attack",
    cost: 2,
    dmg: 9,
    draw: 2,
    blurb: "招牌掛到滿，字都數唔切——打完連抽兩張。",
    art: "assets/skills/S72.png",
    rarity: "專屬",
    owner: "kauko",
  },

  /* ===== 勝仔・跌打館學徒專屬（回復流） ===== */
  S89: {
    id: "S89",
    name: "跌打酒",
    type: "skill",
    cost: 1,
    heal: 6,
    block: 4,
    blurb: "推埋瘀血，順手包紮——回 6 HP 兼 4 擋。",
    art: "assets/skills/S21.png",
    rarity: "專屬",
    owner: "sing",
  },
  S90: {
    id: "S90",
    name: "駁骨",
    type: "skill",
    cost: 2,
    heal: 12,
    blurb: "啪一聲駁返原位——即刻回 12 HP。",
    art: "assets/skills/S47.png",
    rarity: "專屬",
    owner: "sing",
  },
  S91: {
    id: "S91",
    name: "藥油拳",
    type: "attack",
    cost: 1,
    dmg: 7,
    heal: 3,
    blurb: "藥油抹拳頭，打完順手醫自己——傷 7 兼回 3 HP。",
    art: "assets/skills/S09.png",
    rarity: "專屬",
    owner: "sing",
  },
};

/** 角色專屬牌 id（每角 3 張） */
export const SIGNATURE_CARDS = {
  oil: ["S80", "S81", "S82"],
  asan: ["S83", "S84", "S85"],
  kauko: ["S86", "S87", "S88"],
  sing: ["S89", "S90", "S91"],
};

/** 共用獎勵池（三選一抽樣來源） */
export const REWARD_POOL = [
  "S07",
  "S12",
  "S40",
  "S64",
  "S14",
  "S06",
  "S46",
  "S56",
  "S02",
  "S09",
  "S16",
  "S15",
  "S21",
  "S22",
  "S25",
  "S31",
  "S47",
  "S72",
];

/**
 * 開局三角色（名取自 PREP_PACK／brief；被動依 Round 2 可見回饋）
 * @type {Record<string, {
 *   id: string, name: string, short: string, initial: string,
 *   maxHp: number, energy: number,
 *   passive: { id: string, name: string, desc: string },
 *   starterDeck: string[],
 *   rewardBias?: string[]
 * }>}
 */
export const CHARACTERS = {
  oil: {
    id: "oil",
    name: "阿油・後巷經紀",
    short: "出手快、愛搏；一路削血一路加速",
    /** 一句講清點玩（選角一眼睇到路線） */
    playstyle: "連環出拳——每三張攻擊，第四張平一費兼加傷。",
    route: "搏命・攻擊",
    initial: "油",
    portrait: "assets/art/portraits/ayau.webp",
    maxHp: 68,
    energy: 3,
    passive: {
      id: "kuaisou",
      name: "快手",
      desc: "每打出第 3 張攻擊牌，下一張攻擊平一費（最低 0）兼額外 +3 傷害。",
    },
    /** 「再開一局」鉤：選角／結算各用一句港味（純文案，唔影響數值） */
    rerunHook: {
      select: "手快有手慢冇——呢條巷，你仲想再快一次？",
      clear: "一鋪清袋唔夠喉？下一鋪，快手更快。",
      defeat: "輸咗唔緊要，快手嘅人，翻本最快。",
    },
    /** 通關時嘅本局總結（唔講下一鋪，講呢一鋪做到咩） */
    clearSummary: "由後巷打到天台，你冇停過手。三張拳，一個傳奇。",
    /** 選角後第一句：交代「你呢一刻喺邊、要做咩」 */
    openLine: "後巷濕氣未散。你捏實張卡片，行出去——第一格已經有人等緊。",
    starterDeck: [
      "S01",
      "S01",
      "S01",
      "S15",
      "S15",
      "S02",
      "S02",
      "S11",
      "S14",
      "S80",
    ],
    /** 選牌傾向：搏命型（純攻擊為主，一眼認得係阿油） */
    rewardBias: ["S07", "S40", "S14", "S16", "S15", "S72", "S81", "S82", "S80"],
  },
  asan: {
    id: "asan",
    name: "阿珊・茶記夜更",
    short: "捱得、護得場；盾厚再反打",
    /** 一句講清點玩（選角一眼睇到路線） */
    playstyle: "疊盾捱打——擋夠先還手，愈守愈硬淨。",
    route: "守住・擋回",
    initial: "珊",
    portrait: "assets/art/portraits/ashan.jpg",
    maxHp: 80,
    energy: 3,
    passive: {
      id: "dangkou",
      name: "檔口",
      desc: "每場戰鬥首次捱打之後，即刻加 8 擋。",
    },
    /** 「再開一局」鉤：選角／結算各用一句港味（純文案，唔影響數值） */
    rerunHook: {
      select: "檔口一日未收爐，你都仲有得打。",
      clear: "收爐都要熄燈——但爐邊嗰份火氣，留返下一局。",
      defeat: "檔口執咗可以再開；呢口氣，唔會就咁散。",
    },
    /** 通關時嘅本局總結（唔講下一鋪，講呢一鋪做到咩） */
    clearSummary: "你由後巷一路守住上到天台。擋得住嘅，唔止拳頭。",
    /** 選角後第一句：交代「你呢一刻喺邊、要做咩」 */
    openLine: "收爐前最後一杯。你圍裙都未除，就咁行出舖頭。",
    starterDeck: [
      "S15",
      "S15",
      "S01",
      "S11",
      "S11",
      "S46",
      "S56",
      "S31",
      "S47",
      "S21",
      "S83",
    ],
    /** 選牌傾向：守住型（擋／回血為主，一眼認得係阿珊） */
    rewardBias: ["S46", "S56", "S31", "S11", "S83", "S84", "S85"],
  },
  kauko: {
    id: "kauko",
    name: "九哥・招牌工",
    short: "識睇牌、識抽牌；技能多、節奏活",
    /** 一句講清點玩（選角一眼睇到路線） */
    playstyle: "抽牌鋪路——技能先起手，牌多就有得揀。",
    route: "節奏・抽牌",
    initial: "九",
    portrait: "assets/art/portraits/kauko.jpg",
    maxHp: 65,
    energy: 3,
    passive: {
      id: "zhaopaiyan",
      name: "招牌眼",
      desc: "每場戰鬥首次打出技能牌，即刻多抽 1 張。",
    },
    /** 「再開一局」鉤：選角／結算各用一句港味（純文案，唔影響數值） */
    rerunHook: {
      select: "招牌睇得穿，牌底都睇得穿——再嚟一局？",
      clear: "霓虹熄一格，你眼利一分。下一鋪，睇得更穿。",
      defeat: "招牌跌落嚟唔怕，識睇嘅人，識得再掛返上去。",
    },
    /** 通關時嘅本局總結（唔講下一鋪，講呢一鋪做到咩） */
    clearSummary: "由第一格睇到最後一格，你冇漏過一張牌。霓虹底下，最亮嗰盞係你。",
    /** 選角後第一句：交代「你呢一刻喺邊、要做咩」 */
    openLine: "招牌拆到一半，你放低電鑽。呢條街，今晚開始由你睇。",
    starterDeck: [
      "S01",
      "S16",
      "S16",
      "S14",
      "S72",
      "S02",
      "S22",
      "S11",
      "S25",
      "S40",
      "S86",
    ],
    /** 選牌傾向：抽牌／節奏型（一眼認得係九哥） */
    rewardBias: ["S06", "S12", "S02", "S22", "S25", "S16", "S86", "S87", "S88"],
  },
  sing: {
    id: "sing",
    name: "勝仔・跌打館學徒",
    short: "捱得痛、識自救；血薄但有得回",
    /** 一句講清點玩：回復流，同快手／檔口／招牌眼完全唔同 */
    playstyle: "邊打邊醫——每場第一次出技能牌就回血，愈拖愈唔死。",
    route: "回復・續戰",
    initial: "勝",
    maxHp: 58,
    energy: 3,
    passive: {
      id: "seotong",
      name: "跌打",
      desc: "每場戰鬥首次打出技能牌，即刻回 5 HP。",
    },
    /** 「再開一局」鉤 */
    rerunHook: {
      select: "跌打館學徒，最識捱痛——呢鋪想試幾耐？",
      clear: "由後巷捱到天台，你都冇嗌過一聲痛。下一鋪，捱得更耐。",
      defeat: "骨都未駁好就想再打？好，跌打館隨時開門。",
    },
    /** 通關總結 */
    clearSummary: "一身瘀傷行落天台，但你仲企得住。捱得，就係本事。",
    /** 選角後第一句 */
    openLine: "跌打館關咗門，你仲孭住藥箱。出去行一轉，順便試下自己副骨頭。",
    starterDeck: [
      "S01",
      "S01",
      "S21",
      "S21",
      "S09",
      "S47",
      "S25",
      "S11",
      "S22",
      "S89",
    ],
    /** 選牌傾向：純回血型（一眼認得係勝仔） */
    rewardBias: ["S21", "S09", "S90", "S89", "S91", "S47"],
  },
};

/** @deprecated 用 CHARACTERS.oil；保留別名方便舊引用 */
export const CHARACTER = CHARACTERS.oil;

export function characterById(id) {
  if (id === "shan") return CHARACTERS.asan;
  if (id === "gau") return CHARACTERS.kauko;
  return CHARACTERS[id] || CHARACTERS.oil;
}

export function listCharacters() {
  return [CHARACTERS.oil, CHARACTERS.asan, CHARACTERS.kauko];
}

/**
 * 敵人（新專案重表；圖從舊作複製）
 * intents: array of { kind, value, label } cycled each turn
 */
export const ENEMIES = {
  E01: {
    id: "E01",
    name: "後巷影",
    hp: 32,
    art: "assets/enemies/E01.jpg",
    flavor: "後巷石屎濕漉漉，影在牆角不肯散。",
    afterword: "影散咗。巷尾仲有幾滴未乾。",
    intents: [
      { kind: "attack", value: 6, label: "偷襲 6" },
      { kind: "attack", value: 8, label: "撲影 8" },
      { kind: "block", value: 5, label: "隱影擋 5" },
    ],
  },
  E02: {
    id: "E02",
    name: "過期罐頭阿叔",
    hp: 42,
    art: "assets/enemies/E02.jpg",
    flavor: "推住車仔喺巷尾擺檔，罐頭個個都過咗期——「食唔死嘅，放心。」",
    afterword: "車仔翻咗，罐頭滾滿一地。阿叔坐喺牆邊喘氣。",
    intents: [
      { kind: "attack", value: 9, label: "砸罐 9" },
      { kind: "attack", value: 7, label: "酸液 7" },
      { kind: "buff_attack", value: 2, label: "發酵＋2攻" },
    ],
  },
  E03: {
    id: "E03",
    name: "逼爆阿姐",
    hp: 38,
    art: "assets/enemies/E03.jpg",
    flavor: "手抽四大袋，肩頭一撞就過——「借借，趕住返屋企煮飯。」",
    afterword: "阿姐執返啲袋，邊行邊鬧：「後生仔，唔識讓路。」",
    intents: [
      { kind: "attack", value: 7, label: "擠壓 7" },
      { kind: "attack", value: 11, label: "逼爆 11" },
      { kind: "weaken", value: 2, label: "踩腳：你下擊−2" },
    ],
  },
  E04: {
    id: "E04",
    name: "巷口鐵閘・睇場",
    hp: 78,
    art: "assets/enemies/E04.jpg",
    flavor: "呢條巷我睇場。生面孔，先過我呢關。",
    /** Boss 戰後一句（打贏之後先出現） */
    afterword: "鐵閘慢慢升起——你行得過，呢條巷以後都認得你。",
    /** 敗給呢個 Boss 時嘅專屬近 miss 一句 */
    nearMiss: "鐵閘落淨半呎。你隻手已經摸到閘邊，就差嗰一下推。",
    isBoss: true,
    intents: [
      { kind: "attack", value: 10, label: "攔閘 10" },
      { kind: "block", value: 8, label: "鐵閘擋 8" },
      { kind: "attack", value: 14, label: "轟出去 14" },
      { kind: "attack", value: 8, label: "喝止 8" },
    ],
  },
  E06: {
    id: "E06",
    name: "旺角睇水隊",
    hp: 48,
    art: "assets/enemies/E06.jpg",
    flavor: "三個企喺燈箱底，一眼關七——「行過嘅，都要留低個名。」",
    afterword: "三個人散開，燈箱仲喺度閃。你行過，冇人再攔。",
    intents: [
      { kind: "attack", value: 9, label: "夾擊 9" },
      { kind: "attack", value: 12, label: "圍埋 12" },
      { kind: "block", value: 6, label: "人牆 6" },
    ],
  },
  E07: {
    id: "E07",
    name: "招牌拆遷隊",
    hp: 52,
    art: "assets/enemies/E07.png",
    flavor: "電鋸聲響——呢條街嘅字，今晚拆完。",
    afterword: "電鋸停咗。招牌吊喺半空，仲未跌。",
    intents: [
      { kind: "attack", value: 10, label: "鋸字 10" },
      { kind: "weaken", value: 2, label: "火花：你下擊−2" },
      { kind: "attack", value: 13, label: "拆招牌 13" },
    ],
  },
  E05: {
    id: "E05",
    name: "西裝收數隊",
    hp: 95,
    art: "assets/enemies/E05.jpg",
    flavor: "月光底落數。散水定散骨，你揀。",
    /** Boss 戰後一句（打贏之後先出現） */
    afterword: "西裝散咗，數簿跌落地下——今晚冇人再問你拎。",
    /** 敗給呢個 Boss 時嘅專屬近 miss 一句 */
    nearMiss: "數簿翻到最後一頁。爭一個數位，你就唔使還。",
    isBoss: true,
    intents: [
      { kind: "attack", value: 12, label: "問數 12" },
      { kind: "block", value: 10, label: "西裝擋 10" },
      { kind: "attack", value: 9, label: "連環收 9" },
      { kind: "attack", value: 16, label: "散骨一記 16" },
    ],
  },
  /** Act3 小怪：紮鐵 */
  E09: {
    id: "E09",
    name: "紮鐵佬",
    hp: 56,
    art: "assets/enemies/E09.png",
    flavor: "鐵枝一紥，天台都震。你行入嚟，就當你係工地雜物。",
    afterword: "鐵枝散落一地。天台靜返，只剩風聲。",
    intents: [
      { kind: "attack", value: 11, label: "紥鐵 11" },
      { kind: "attack", value: 8, label: "鐵枝橫掃 8" },
      { kind: "buff_attack", value: 2, label: "上螺絲＋2攻" },
    ],
  },
  /** Act3 小怪：清場 */
  E10: {
    id: "E10",
    name: "沙包阿頭",
    hp: 52,
    art: "assets/enemies/E10.png",
    flavor: "膊頭托住兩個沙包，行過都唔望你一眼——「唔好企路中間。」",
    afterword: "沙包放低咗。阿頭抹咗把汗，冇再望你。",
    intents: [
      { kind: "attack", value: 10, label: "沙包砸 10" },
      { kind: "block", value: 7, label: "疊沙包擋 7" },
      { kind: "attack", value: 13, label: "膊頭一撞 13" },
    ],
  },
  /** Act3 小怪：籠邊睇客 */
  E11: {
    id: "E11",
    name: "籠邊睇客",
    hp: 46,
    art: "assets/enemies/E11.png",
    flavor: "籠邊個個都落過注。佢唔落注——佢落手。",
    afterword: "佢縮返入人群。籠邊繼續有人落注。",
    intents: [
      { kind: "attack", value: 9, label: "偷位 9" },
      { kind: "weaken", value: 2, label: "撩腳：你下擊−2" },
      { kind: "attack", value: 12, label: "補拳 12" },
    ],
  },
  /** Act3 精英：地盤清場隊 */
  E08: {
    id: "E08",
    name: "地盤清場隊",
    hp: 72,
    art: "assets/enemies/E08.png",
    flavor: "「呢度收工，你唔係工人。」安全帽一低頭，鐵枝就起。",
    afterword: "「收工就收工。」佢地執嘢走，你企喺原地。",
    isElite: true,
    intents: [
      { kind: "attack", value: 12, label: "清場 12" },
      { kind: "attack", value: 9, label: "撬棍 9" },
      { kind: "block", value: 9, label: "人牆擋 9" },
      { kind: "attack", value: 15, label: "收工埋數 15" },
    ],
  },
  /** Act3 最終 Boss：籠門之王 */
  E12: {
    id: "E12",
    name: "籠門之王",
    hp: 136,
    art: "assets/enemies/E12.jpg",
    flavor: "天台無燈。今夜邊個落場，邊個落地。",
    /** Boss 戰後一句（打贏之後先出現） */
    afterword: "籠門開咗。天台上面，第一次有人企住落嚟。",
    /** 敗給呢個 Boss 時嘅專屬近 miss 一句 */
    nearMiss: "籠門差一寸就閂埋。你隻手指，仲夾喺門邊。",
    isBoss: true,
    isFinalBoss: true,
    intents: [
      { kind: "attack", value: 13, label: "籠邊開場 13" },
      { kind: "block", value: 10, label: "靠籠擋 10" },
      { kind: "attack", value: 10, label: "膝撞 10" },
      { kind: "attack", value: 19, label: "落地一記 19" },
    ],
  },
};

/**
 * Act1 地圖：6 節點（戰鬥後彈三選一；含事件／休息／Boss）
 * 線性解鎖：打完當前才開下一格
 */
export const ACT1_MAP = [
  {
    id: "n1",
    type: "battle",
    title: "後巷影",
    subtitle: "戰鬥 → 選牌",
    enemyId: "E01",
    bg: "assets/art/bg/bg_act1_alley.jpg",
  },
  {
    id: "n2",
    type: "event",
    title: "街頭閒事",
    subtitle: "短事件",
    bg: "assets/art/bg/bg_act1_alley.jpg",
  },
  {
    id: "n3",
    // Act 內分支：二揀一，兩邊獎勵／風險唔同，但都必改局
    type: "branch",
    title: "路口二揀一",
    subtitle: "分支路線",
    bg: "assets/art/bg/bg_act1_alley.jpg",
    options: [
      {
        id: "hard",
        label: "頂硬上：打埋呢班人",
        effectText: "入戰鬥（敵人較硬）；贏咗多 6 金",
        kind: "battle",
        enemyId: "E02",
        bonusGold: 6,
      },
      {
        id: "detour",
        label: "繞路：行後巷尾",
        effectText: "入事件；順手拾到 5 金，兼回 6 HP",
        kind: "event",
        eventId: "ev_dai_pai_dong",
        bonusGold: 5,
        bonusHp: 6,
      },
    ],
  },
  {
    id: "n4",
    type: "rest",
    title: "簷篷底歇腳",
    subtitle: "休息／便利店",
    bg: "assets/art/bg/bg_act1_alley.jpg",
  },
  {
    id: "n5",
    type: "battle",
    title: "逼爆潮",
    subtitle: "戰鬥 → 選牌",
    enemyId: "E03",
    bg: "assets/art/bg/bg_act1_alley.jpg",
  },
  {
    id: "n6",
    type: "boss",
    title: "巷口鐵閘・睇場",
    subtitle: "區 Boss",
    enemyId: "E04",
    bg: "assets/art/bg/bg_act1_alley.jpg",
  },
];

/**
 * Act2「旺角霓虹」：戰→選牌→事件→戰→休息／便利店→Boss（共 6）
 */
export const ACT2_MAP = [
  {
    id: "a2n1",
    type: "battle",
    title: "旺角圍標",
    subtitle: "戰鬥",
    enemyId: "E06",
    bg: "assets/art/bg/bg_act2_mongkok.jpg",
  },
  {
    id: "a2n2",
    type: "reward",
    title: "夜檔執牌",
    subtitle: "選牌",
    bg: "assets/art/bg/bg_act2_mongkok.jpg",
  },
  {
    id: "a2n3",
    type: "event",
    title: "旺角閒事",
    subtitle: "短事件",
    bg: "assets/art/bg/bg_act2_mongkok.jpg",
  },
  {
    id: "a2n4",
    // Act2 分支：兩條路都改局
    type: "branch",
    title: "旺角路口",
    subtitle: "分支路線",
    bg: "assets/art/bg/bg_act2_mongkok.jpg",
    options: [
      {
        id: "hard",
        label: "照拆：同拆遷隊硬碰",
        effectText: "入戰鬥（招牌拆遷隊）；贏咗多 7 金",
        kind: "battle",
        enemyId: "E07",
        bonusGold: 7,
      },
      {
        id: "detour",
        label: "兜路：行後樓梯落去",
        effectText: "入事件；順手拾到 6 金，兼回 5 HP",
        kind: "event",
        eventId: "ev_neon_sign",
        bonusGold: 6,
        bonusHp: 5,
      },
    ],
  },
  {
    id: "a2n5",
    type: "rest",
    title: "通宵便利店",
    subtitle: "休息／便利店",
    bg: "assets/art/bg/bg_act2_mongkok.jpg",
  },
  {
    id: "a2n6",
    type: "boss",
    title: "西裝收數隊",
    subtitle: "區 Boss",
    enemyId: "E05",
    bg: "assets/art/bg/bg_act2_mongkok.jpg",
  },
];

/**
 * Act3「城寨・天台」：戰→選牌→事件→戰／精英→休息或便利店→最終 Boss（共 6）
 * n4 用 enemyPool 抽：地盤清場隊（精英 E08）／清場沙包手／籠邊睇客
 */
export const ACT3_MAP = [
  {
    id: "a3n1",
    type: "battle",
    title: "紮鐵佬",
    subtitle: "戰鬥",
    enemyId: "E09",
    bg: "assets/art/bg/bg_act3_rooftop.jpg",
  },
  {
    id: "a3n2",
    type: "reward",
    title: "天台執牌",
    subtitle: "選牌",
    bg: "assets/art/bg/bg_act3_rooftop.jpg",
  },
  {
    id: "a3n3",
    type: "event",
    title: "天台閒事",
    subtitle: "短事件",
    bg: "assets/art/bg/bg_act3_rooftop.jpg",
  },
  {
    id: "a3n4",
    // Act3 分支：尾段，兩邊都改局
    type: "branch",
    title: "上天台前",
    subtitle: "分支路線",
    bg: "assets/art/bg/bg_act3_rooftop.jpg",
    options: [
      {
        id: "hard",
        label: "清場：正面衝上去",
        effectText: "入戰鬥（可能遇到精英）；贏咗多 8 金",
        kind: "battle",
        enemyPool: ["E10", "E11", "E08"],
        bonusGold: 8,
      },
      {
        id: "detour",
        label: "攀水管：由外牆爬",
        effectText: "入事件；順手拾到 7 金，兼回 4 HP",
        kind: "event",
        eventId: "ev_rooftop_laundry",
        bonusGold: 7,
        bonusHp: 4,
      },
    ],
  },
  {
    id: "a3n5",
    type: "rest",
    title: "天台搭棚歇腳",
    subtitle: "休息／便利店",
    bg: "assets/art/bg/bg_act3_rooftop.jpg",
  },
  {
    id: "a3n6",
    type: "boss",
    title: "籠門之王",
    subtitle: "最終 Boss",
    enemyId: "E12",
    bg: "assets/art/bg/bg_act3_rooftop.jpg",
  },
];

export const EVENTS = {
  ev_gate_whisper: {
    id: "ev_gate_whisper",
    title: "巷口風聲",
    art: "assets/events/ev-alley-wake.jpg",
    body: "鐵閘未落，有人喺梯間咬耳仔：「入面有人睇場，生面孔最好識趣。」你掂掂袋口——揀法會改你這一鋪。",
    choices: [
      {
        id: "pay",
        label: "塞兩張銀紙買平安",
        effectText: "失去 8 HP，牌組加入「椒鹽補刀」",
        apply: (run) => {
          run.hp = Math.max(1, run.hp - 8);
          run.deck.push("S02");
          return "痛一下，但多咗廉價補刀。";
        },
      },
      {
        id: "bluff",
        label: "吹水話自己熟路",
        effectText: "最大生命 +3 並回 3；下戰開場 +1 能量；入場帶 6 擋",
        apply: (run) => {
          run.maxHp += 3;
          run.hp = Math.min(run.maxHp, run.hp + 3);
          run.nextBattleEnergyBonus = (run.nextBattleEnergyBonus || 0) + 1;
          run.nextBattleBlock = (run.nextBattleBlock || 0) + 6;
          return "吹得掂——底氣壯咗，下一場開局多 1 能量，兼帶 6 擋入場。";
        },
      },
      {
        id: "fight_mood",
        label: "硬碰硬頂上去",
        effectText: "最大生命 +4 並回 4；牌組加入「大力出奇蹟」",
        apply: (run) => {
          run.maxHp += 4;
          run.hp = Math.min(run.maxHp, run.hp + 4);
          run.deck.push("S07");
          return "血厚咗，腰間多咗一張搏命牌。";
        },
      },
    ],
  },
  /** Act2：必改局，唔發死金 */
  ev_neon_hustle: {
    id: "ev_neon_hustle",
    title: "彌敦道擦肩",
    art: "assets/events/ev-mtr-crowd.jpg",
    body: "霓虹一閃，有人拍你膊頭：「兄弟，順手幫個忙？」你知——揀咗就改呢一鋪牌路。",
    choices: [
      {
        id: "help",
        label: "幫手擋一陣人潮",
        effectText: "失去 10 HP；牌組加入「鐵皮硬遮」",
        apply: (run) => {
          run.hp = Math.max(1, run.hp - 10);
          run.deck.push("S46");
          return "膊頭痛，但多咗一面硬遮。";
        },
      },
      {
        id: "slip",
        label: "跣足溜走",
        effectText: "回 6 HP；下戰開場 −1 能量；入場帶 8 擋",
        apply: (run) => {
          run.hp = Math.min(run.maxHp, run.hp + 6);
          run.nextBattleEnergyPenalty = (run.nextBattleEnergyPenalty || 0) + 1;
          run.nextBattleBlock = (run.nextBattleBlock || 0) + 8;
          return "走得快，喘返順氣（回 6 HP）；下一場慢半拍，不過有 8 擋傍身。";
        },
      },
      {
        id: "deal",
        label: "同佢交換情報",
        effectText: "最大生命 +3 並回 6；牌組加入「埋單」",
        apply: (run) => {
          run.maxHp += 3;
          run.hp = Math.min(run.maxHp, run.hp + 6);
          run.deck.push("S12");
          return "聽完內幕，腰間多咗一張「埋單」。";
        },
      },
    ],
  },
  /** Act3：三選一全部改局（血／牌／下戰能量） */
  ev_rooftop_cage: {
    id: "ev_rooftop_cage",
    title: "籠邊夜話",
    art: "assets/events/ev-rooftop-night.jpg",
    body: "鐵籠邊有人遞煙：「上面個王，冇人打得低。你想入場，就要先押一樣嘢。」你望望自己隻手——押咩，今夜就變咩。",
    choices: [
      {
        id: "bet_blood",
        label: "押自己一身血",
        effectText: "失去 12 HP；最大生命 +6；牌組加入「打邊爐氣」",
        apply: (run) => {
          run.hp = Math.max(1, run.hp - 12);
          run.maxHp += 6;
          run.deck.push("S64");
          return "血濺籠邊，但身子骨硬淨咗，多咗一張「打邊爐氣」。";
        },
      },
      {
        id: "bet_gear",
        label: "押舖頭面子",
        effectText: "下戰開場 +1 能量；入場帶 10 擋；牌組加入「舊帳對數」",
        apply: (run) => {
          run.nextBattleEnergyBonus = (run.nextBattleEnergyBonus || 0) + 1;
          run.nextBattleBlock = (run.nextBattleBlock || 0) + 10;
          run.deck.push("S72");
          return "面子抵錢——下場多 1 能量、10 擋入場，仲多一張「舊帳對數」。";
        },
      },
      {
        id: "bet_hand",
        label: "押自己隻右手",
        effectText: "最大生命 +2 並回 10；牌組加入「大力出奇蹟」",
        apply: (run) => {
          run.maxHp += 2;
          run.hp = Math.min(run.maxHp, run.hp + 10);
          run.deck.push("S07");
          return "拳頭包好，氣順咗，腰間多咗一張「大力出奇蹟」。";
        },
      },
    ],
  },

  /* ===== Act1 加厚 ===== */
  /** Act1-A：涼茶舖 */
  ev_herbal_tea: {
    id: "ev_herbal_tea",
    title: "涼茶舖",
    art: "assets/events/ev-cha-chaan.jpg",
    body: "涼茶舖阿伯遞你一碗廿四味：「飲咗先講嘢。」你望望碗底——苦，但呢條街冇免費嘅甜。",
    choices: [
      {
        id: "drink",
        label: "成碗灌落去",
        effectText: "回 14 HP；最大生命 +2",
        apply: (run) => {
          run.maxHp += 2;
          run.hp = Math.min(run.maxHp, run.hp + 14);
          return "苦到面都縐埋，但身子骨爽利咗。";
        },
      },
      {
        id: "buy_pills",
        label: "買包感冒茶傍身",
        effectText: "失去 4 HP；牌組加入「雨衣包紮」",
        apply: (run) => {
          run.hp = Math.max(1, run.hp - 4);
          run.deck.push("S21");
          return "藥苦，但袋中多咗一張包紮牌。";
        },
      },
      {
        id: "ask_gate",
        label: "問阿伯鐵閘點行",
        effectText: "下戰開場 +1 能量；牌組加入「掛波小心」",
        apply: (run) => {
          run.nextBattleEnergyBonus = (run.nextBattleEnergyBonus || 0) + 1;
          run.deck.push("S22");
          return "阿伯指咗條後巷——下一場多 1 能量，仲多張擋牌。";
        },
      },
    ],
  },
  /** Act1-B：排檔收工 */
  ev_dai_pai_dong: {
    id: "ev_dai_pai_dong",
    title: "排檔收工",
    art: "assets/events/ev-dai-pai-dong.jpg",
    body: "排檔阿姐收緊膠凳，見你一身傷：「執兩件嘢先走啦，唔好死喺我檔口前面。」",
    choices: [
      {
        id: "eat",
        label: "食碗車仔麵先",
        effectText: "回 10 HP；牌組加入「最緊要開心」",
        apply: (run) => {
          run.hp = Math.min(run.maxHp, run.hp + 10);
          run.deck.push("S09");
          return "熱湯落肚，人都軟化咗，多咗張「最緊要開心」。";
        },
      },
      {
        id: "take_stool",
        label: "攞張膠凳走",
        effectText: "牌組加入「紅白藍砸」；最大生命 +2",
        apply: (run) => {
          run.maxHp += 2;
          run.deck.push("S40");
          return "膠凳揸手，多咗一張砸牌。";
        },
      },
      {
        id: "pay_tab",
        label: "幫佢埋單",
        effectText: "失去 6 HP（做義工累到）；下戰入場帶 9 擋",
        apply: (run) => {
          run.hp = Math.max(1, run.hp - 6);
          run.nextBattleBlock = (run.nextBattleBlock || 0) + 9;
          return "幫手幫到腰痠，不過街坊記住你——下場帶 9 擋入場。";
        },
      },
    ],
  },

  /* ===== Act2 加厚 ===== */
  /** Act2-A：地鐵逼爆 */
  ev_mtr_squeeze: {
    id: "ev_mtr_squeeze",
    title: "地鐵逼爆",
    art: "assets/events/ev-mtr-crowd.jpg",
    body: "車門一開，人潮將你推入車廂。你背脊貼實玻璃，前面有人踩住你隻鞋——呢個城市連呼吸都要爭。",
    choices: [
      {
        id: "squeeze_in",
        label: "硬擠入去",
        effectText: "失去 8 HP；下戰開場 +2 能量",
        apply: (run) => {
          run.hp = Math.max(1, run.hp - 8);
          run.nextBattleEnergyBonus = (run.nextBattleEnergyBonus || 0) + 2;
          return "夾到骨都響，但逼出咗一肚子火——下場多 2 能量。";
        },
      },
      {
        id: "let_pass",
        label: "讓位畀阿婆",
        effectText: "最大生命 +5 並回 5；牌組加入「芝麻糊暖」",
        apply: (run) => {
          run.maxHp += 5;
          run.hp = Math.min(run.maxHp, run.hp + 5);
          run.deck.push("S47");
          return "阿婆拍你手背，你個人暖返——多咗張「芝麻糊暖」。";
        },
      },
      {
        id: "pickpocket",
        label: "順手摸個袋",
        effectText: "牌組加入「椒鹽補刀」＋「埋單」；失去 10 HP",
        apply: (run) => {
          run.hp = Math.max(1, run.hp - 10);
          run.deck.push("S02", "S12");
          return "得手，但畀人發現——食咗兩拳，袋中多咗兩張牌。";
        },
      },
    ],
  },
  /** Act2-B：霓虹招牌 */
  ev_neon_sign: {
    id: "ev_neon_sign",
    title: "招牌跌下來",
    art: "assets/events/ev-mtr-platform.jpg",
    body: "頭頂招牌鐵架生鏽，風一吹就搖。下面仲有人行過——你上唔上去托住？",
    choices: [
      {
        id: "hold_up",
        label: "托住個招牌",
        effectText: "牌組加入「鐵皮硬遮」；下戰入場帶 10 擋",
        apply: (run) => {
          run.deck.push("S46");
          run.nextBattleBlock = (run.nextBattleBlock || 0) + 10;
          return "膊頭頂到實，招牌冇跌——多咗張硬遮，下場帶 10 擋。";
        },
      },
      {
        id: "run_away",
        label: "拉大隊走避",
        effectText: "最大生命 +3；牌組加入「掛波小心」",
        apply: (run) => {
          run.maxHp += 3;
          run.deck.push("S22");
          return "街坊跟你走避，冇人受傷——身子骨同牌組都结实咗。";
        },
      },
      {
        id: "take_metal",
        label: "拆條鐵枝走",
        effectText: "牌組加入「大力出奇蹟」；失去 7 HP",
        apply: (run) => {
          run.hp = Math.max(1, run.hp - 7);
          run.deck.push("S07");
          return "鐵枝割手，但揸上手好实在——多咗張搏命牌。";
        },
      },
    ],
  },

  /* ===== Act3 加厚 ===== */
  /** Act3-A：天台晾衫 */
  ev_rooftop_laundry: {
    id: "ev_rooftop_laundry",
    title: "天台晾衫",
    art: "assets/events/ev-rooftop-night.jpg",
    body: "天台橫杆掛滿衫，風一吹全部向你撲。角落有個阿嬸收衫，望你一眼：「後生仔，你仲未死呀？」",
    choices: [
      {
        id: "help_hang",
        label: "幫手收衫",
        effectText: "回 12 HP；最大生命 +3",
        apply: (run) => {
          run.maxHp += 3;
          run.hp = Math.min(run.maxHp, run.hp + 12);
          return "阿嬸塞你一件乾衫，你換走濕透嗰件——個人暖返。";
        },
      },
      {
        id: "take_rope",
        label: "拆條尼龍繩",
        effectText: "牌組加入「萬年船」；下戰入場帶 8 擋",
        apply: (run) => {
          run.deck.push("S11");
          run.nextBattleBlock = (run.nextBattleBlock || 0) + 8;
          return "繩纏手當護腕——多咗張擋牌，下場帶 8 擋。";
        },
      },
      {
        id: "ask_cage",
        label: "問阿嬸籠邊點去",
        effectText: "下戰開場 +1 能量；牌組加入「舊帳對數」",
        apply: (run) => {
          run.nextBattleEnergyBonus = (run.nextBattleEnergyBonus || 0) + 1;
          run.deck.push("S72");
          return "阿嬸指住水塔後面——下一場多 1 能量，仲多張標記牌。";
        },
      },
    ],
  },
  /** Act3-B：最後一支煙 */
  ev_last_cigarette: {
    id: "ev_last_cigarette",
    title: "最後一支煙",
    art: "assets/events/ev-expired-can.jpg",
    body: "水塔後面有人遞你一支煙：「上去之前，食埋佢。落面嘅人，唔使留手。」火機一啪，燒亮你半邊面。",
    choices: [
      {
        id: "smoke",
        label: "食埋佢先上",
        effectText: "失去 9 HP；最大生命 +8",
        apply: (run) => {
          run.hp = Math.max(1, run.hp - 9);
          run.maxHp += 8;
          return "一口氣頂到底——血少咗，但骨頭硬淨好多。";
        },
      },
      {
        id: "keep_it",
        label: "袋住唔食",
        effectText: "牌組加入「打邊爐氣」；下戰入場帶 6 擋",
        apply: (run) => {
          run.deck.push("S64");
          run.nextBattleBlock = (run.nextBattleBlock || 0) + 6;
          return "留住個火——多咗張低血爆發牌，下場帶 6 擋。";
        },
      },
      {
        id: "pass_it",
        label: "傳畀下一個",
        effectText: "回 8 HP；牌組加入「加底唔該」",
        apply: (run) => {
          run.hp = Math.min(run.maxHp, run.hp + 8);
          run.deck.push("S25");
          return "你傳出去，有人接住——手暖咗，多咗張回血抽牌。";
        },
      },
    ],
  },

  /* ===== 密度補充：每 Act 再補一個短事件（三選一全部即時可見改局） ===== */

  /** Act1-C：樓梯口阿婆 */
  ev_stair_auntie: {
    id: "ev_stair_auntie",
    title: "樓梯口阿婆",
    art: "assets/events/ev-alley-wake.jpg",
    body: "唐樓樓梯口，阿婆攔住你：「後生仔，幫手托包米上四樓得唔得？」你望望自己一身傷，又望望佢隻手——呢條街，冇人幫就冇人幫。",
    choices: [
      {
        id: "carry_rice",
        label: "托住包米上四樓",
        effectText: "失去 5 HP；最大生命 +6",
        apply: (run) => {
          run.hp = Math.max(1, run.hp - 5);
          run.maxHp += 6;
          return "爬到四樓，腰骨酸到震——但條腰此後實淨咗。";
        },
      },
      {
        id: "give_tissue",
        label: "遞佢一張紙巾",
        effectText: "牌組加入「雨衣包紮」",
        apply: (run) => {
          run.deck.push("S21");
          return "阿婆抹咗抹手，硬塞你一卷膠布——多咗張包紮牌。";
        },
      },
      {
        id: "chat",
        label: "企喺樓梯口傾兩句",
        effectText: "回 9 HP；牌組加入「最緊要開心」",
        apply: (run) => {
          run.hp = Math.min(run.maxHp, run.hp + 9);
          run.deck.push("S09");
          return "阿婆講咗半個鐘舊事，你笑到咳——氣順咗，仲多張開心牌。";
        },
      },
    ],
  },

  /** Act2-C：旺角截的士 */
  ev_taxi_run: {
    id: "ev_taxi_run",
    title: "旺角截的士",
    art: "assets/events/ev-mtr-crowd.jpg",
    body: "凌晨三點，彌敦道仲塞。有架的士慢車埋嚟，司機探頭：「去邊？上車先講。」你知呢區啲的士——上得去，落唔落得返嚟係另一件事。",
    choices: [
      {
        id: "ride_rest",
        label: "上車唞一轉",
        effectText: "回 6 HP；牌組加入「單車變摩托」",
        apply: (run) => {
          run.hp = Math.min(run.maxHp, run.hp + 6);
          run.deck.push("S06");
          return "冷氣一吹，人鬆咗——落車多咗張搏命牌。";
        },
      },
      {
        id: "bargain",
        label: "同司機講價講到落車",
        effectText: "最大生命 +4；失去 6 HP（講到口乾）",
        apply: (run) => {
          run.maxHp += 4;
          run.hp = Math.max(1, run.hp - 6);
          return "講到落車都未講掂，但你把口練得更硬淨。";
        },
      },
      {
        id: "read_shift",
        label: "幫佢睇更表",
        effectText: "牌組加入「舊帳對數」",
        apply: (run) => {
          run.deck.push("S72");
          return "你幫佢數清更數，佢教你點睇數——多咗張對數牌。";
        },
      },
    ],
  },

  /** Act3-C：天台水缸 */
  ev_water_tank: {
    id: "ev_water_tank",
    title: "天台水缸",
    art: "assets/events/ev-rooftop-night.jpg",
    body: "舊水缸鏽到穿孔，但水仲係涼。你扭開水喉，水聲喺天台回響——上去之前，洗乾淨塊面，人都清醒啲。",
    choices: [
      {
        id: "wash_face",
        label: "洗個面",
        effectText: "回 10 HP；最大生命 +2",
        apply: (run) => {
          run.maxHp += 2;
          run.hp = Math.min(run.maxHp, run.hp + 10);
          return "凍水一淋，血都醒返——個人清清爽爽。";
        },
      },
      {
        id: "drink_raw",
        label: "就咁飲一啖",
        effectText: "失去 4 HP；最大生命 +7",
        apply: (run) => {
          run.hp = Math.max(1, run.hp - 4);
          run.maxHp += 7;
          return "鏽味衝上鼻，你嘔咗兩聲——但身子骨反而頂得住。";
        },
      },
      {
        id: "fill_canteen",
        label: "裝滿個水壺",
        effectText: "牌組加入「萬年船」",
        apply: (run) => {
          run.deck.push("S11");
          return "水壺孭上身，行路穩咗——多咗張穩陣擋牌。";
        },
      },
    ],
  },
};

/** 依 run.act 取當前地圖 */
export function mapForAct(act) {
  if (act === 3) return ACT3_MAP;
  return act === 2 ? ACT2_MAP : ACT1_MAP;
}

/**
 * 每 Act 事件池：事件節點行到時抽一個（同一節點抽定就記住）
 * 每 Act 至少 3 個短事件（1 個固定 + 2 個加厚）
 */
export const EVENT_POOLS = {
  1: ["ev_gate_whisper", "ev_herbal_tea", "ev_dai_pai_dong", "ev_stair_auntie"],
  2: ["ev_neon_hustle", "ev_mtr_squeeze", "ev_neon_sign", "ev_taxi_run"],
  3: ["ev_rooftop_cage", "ev_rooftop_laundry", "ev_last_cigarette", "ev_water_tank"],
};

/** 抽一個該 Act 的事件 id（可傳 rng 方便自測） */
export function pickEventId(act, rng = Math.random) {
  const pool = EVENT_POOLS[act] || EVENT_POOLS[1];
  return pool[Math.floor(rng() * pool.length)] || pool[0];
}

/** 依 id 取事件；缺就 fallback 第一個 Act1 事件 */
export function eventById(id) {
  return EVENTS[id] || EVENTS.ev_gate_whisper;
}

export function actDisplayName(act) {
  if (act === 3) return META.act3Name;
  return act === 2 ? META.act2Name : META.act1Name;
}

/** 便利店：花金買貨（有金先有得花） */
export const SHOP = {
  healCost: 6,
  healAmt: 12,
  cardCost: 8,
  cardId: "S12",
  /** 買遺物（隨機未擁有） */
  relicCost: 14,
  /** 賣遺物換金 */
  sellRelicGain: 6,
  /** 賣牌換金 */
  sellCardGain: 4,
  /**
   * 「抽卡包」：貴啲，但一定係稀有牌池，手感更爽。
   * 池子只放稀有／專屬級，唔會抽到普通牌。
   */
  packCost: 11,
  packPool: [
    "S07", "S64", "S72", "S06", "S56",
    "S80", "S81", "S82",
    "S83", "S84", "S85",
    "S86", "S87", "S88",
    "S89", "S90", "S91",
  ],
  /** 「換貨」：花少少金刷新士多遺物貨架 */
  rerollCost: 5,
};

/**
 * 消耗品（士多貨架一定有 1 件）
 * 買完即用，唔會入遺物欄，所以叫「消耗」。
 * @type {Record<string, {
 *   id: string, name: string, desc: string, flavor: string,
 *   price: number,
 *   apply: (run: object) => string
 * }>}
 */
export const CONSUMABLES = {
  cs_painkiller: {
    id: "cs_painkiller",
    name: "必理痛",
    desc: "即刻回 18 HP。",
    flavor: "一板四粒，痛就食兩粒——剩返兩粒留返下次。",
    price: 7,
    apply: (run) => {
      const before = run.hp;
      run.hp = Math.min(run.maxHp, run.hp + 18);
      const healed = run.hp - before;
      return healed > 0 ? `食咗兩粒，回咗 ${healed} HP。` : "已經滿血，食咗都冇用。";
    },
  },
  cs_bandage: {
    id: "cs_bandage",
    name: "藥水膠布",
    desc: "即刻最大生命 +5，並回 5。",
    flavor: "貼住傷口，行路都冇咁痛。",
    price: 9,
    apply: (run) => {
      run.maxHp += 5;
      run.hp = Math.min(run.maxHp, run.hp + 5);
      return "貼好膠布——最大生命 +5，順手回 5 HP。";
    },
  },
  cs_energy_drink: {
    id: "cs_energy_drink",
    name: "提神能量飲品",
    desc: "下一場戰鬥開場 +1 能量。",
    flavor: "味道似藥水，但真係頂得一陣。",
    price: 8,
    apply: (run) => {
      run.nextBattleEnergyBonus = (run.nextBattleEnergyBonus || 0) + 1;
      return "飲完心跳快咗——下一場開局多 1 能量。";
    },
  },
  cs_lucky_charm: {
    id: "cs_lucky_charm",
    name: "黃大仙靈符",
    desc: "牌組加入一張「椒鹽補刀」。",
    flavor: "求個心安，順手多張平價補刀。",
    price: 6,
    apply: (run) => {
      run.deck.push("S02");
      return "靈符入袋——牌組多咗張「椒鹽補刀」。";
    },
  },
};

/** 抽 n 件消耗品做貨架（每局洗一次） */
export function pickShopConsumables(n = 1, rng = Math.random) {
  const ids = Object.keys(CONSUMABLES);
  const shuffled = [...ids].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

export function consumableById(id) {
  return CONSUMABLES[id];
}

/**
 * 遺物（每件都真係改局；effect 會累加）
 * effect 欄位：
 *   startEnergy  每場戰鬥開場 +能量上限
 *   startBlock   每場戰鬥開場自帶擋
 *   startDraw    每場戰鬥首回合多抽
 *   attackBonus  所有攻擊 +傷害
 *   healOnWin    每場戰鬥勝利回血
 *   goldBonus    小怪勝場額外金幣
 *   instantMaxHp 入手即刻 +最大生命
 *   instantGold  入手即刻 +金幣
 * @type {Record<string, {
 *   id: string, name: string, desc: string, flavor: string,
 *   effect: Record<string, number>, rarity: string
 * }>}
 */
export const RELICS = {
  rl_gate_key: {
    id: "rl_gate_key",
    name: "鐵閘鎖匙",
    desc: "每場戰鬥開場 +1 能量。",
    flavor: "執到條匙，閘就唔再係牆。",
    effect: { startEnergy: 1 },
    rarity: "普通",
  },
  rl_helmet: {
    id: "rl_helmet",
    name: "地盤安全帽",
    desc: "每場戰鬥開場自帶 8 擋。",
    flavor: "上面印住「安全」，你戴住去打人。",
    effect: { startBlock: 8 },
    rarity: "普通",
  },
  rl_mahjong_lamp: {
    id: "rl_mahjong_lamp",
    name: "麻雀檯燈",
    desc: "每場戰鬥首回合多抽 1 張。",
    flavor: "四個人打牌，燈膽最亮嗰個贏。",
    effect: { startDraw: 1 },
    rarity: "稀有",
  },
  rl_rwb_bag: {
    id: "rl_rwb_bag",
    name: "紅白藍袋",
    desc: "每場戰鬥勝利回 5 HP。",
    flavor: "袋唔重，但你孭住佢行咗三條街。",
    effect: { healOnWin: 5 },
    rarity: "普通",
  },
  rl_cha_ledger: {
    id: "rl_cha_ledger",
    name: "茶記賬簿",
    desc: "小怪勝場額外 +3 金幣。",
    flavor: "邊枱未埋單，賬簿記得比你清楚。",
    effect: { goldBonus: 3 },
    rarity: "普通",
  },
  rl_neon_tube: {
    id: "rl_neon_tube",
    name: "霓虹燈膽",
    desc: "所有攻擊 +2 傷害。",
    flavor: "拆落嚟嘅燈膽仲暖手——照住你就夠。",
    effect: { attackBonus: 2 },
    rarity: "稀有",
  },
  rl_med_wine: {
    id: "rl_med_wine",
    name: "跌打酒",
    desc: "入手即刻最大生命 +10（並回 10）。",
    flavor: "味道沖，但係真係得。",
    effect: { instantMaxHp: 10 },
    rarity: "普通",
  },
  rl_kwun_yam: {
    id: "rl_kwun_yam",
    name: "觀音借庫",
    desc: "入手即刻 +20 金幣。",
    flavor: "借咗就係借咗，還唔還係另一件事。",
    effect: { instantGold: 20 },
    rarity: "稀有",
  },

  /* ===== 角色專屬遺物（三角色各一，名字／效果一眼分到） ===== */

  /** 阿油專屬：快手＝第 3 張攻擊後嗰下，直接多打一下 */
  rl_oil_flask: {
    id: "rl_oil_flask",
    name: "阿油・電油樽",
    desc: "【阿油】每場戰鬥開始多 1 次抽牌機會（首回合多抽 2 張）。",
    flavor: "電油唔止入電單車——入你對拳都得。",
    effect: { startDraw: 2 },
    rarity: "專屬",
    owner: "oil",
  },
  /** 阿珊專屬：檔口＝守得更實 */
  rl_asan_apron: {
    id: "rl_asan_apron",
    name: "阿珊・茶記圍裙",
    desc: "【阿珊】每場戰鬥額外 +6 開場擋。",
    flavor: "圍裙一綁，成個檔口都係你嘅防線。",
    effect: { startBlock: 6 },
    rarity: "專屬",
    owner: "asan",
  },
  /** 九哥專屬：招牌眼＝睇得穿，出牌更順 */
  rl_kauko_signboard: {
    id: "rl_kauko_signboard",
    name: "九哥・招牌眼鏡",
    desc: "【九哥】每回合開始多抽 1 張。",
    flavor: "招牌睇得穿，牌底自然都睇得穿。",
    effect: { drawPerTurn: 1 },
    rarity: "專屬",
    owner: "kauko",
  },
  /** 勝仔專屬：跌打館藥箱，邊打邊回 */
  rl_sing_kit: {
    id: "rl_sing_kit",
    name: "勝仔・跌打藥箱",
    desc: "【勝仔】每場戰鬥首次回血時，額外多回 4 HP。",
    flavor: "箱仔細細，但入面乜都有——連你估唔到嘅都有。",
    effect: { healBonusFirst: 4 },
    rarity: "專屬",
    owner: "sing",
  },

  /* ===== 通用遺物（新） ===== */

  /** 通用：愈打愈順，手牌多就抽多張 */
  rl_tram_token: {
    id: "rl_tram_token",
    name: "叮叮車票",
    desc: "每場戰鬥開波多抽 1 張。",
    flavor: "車票唔記得用，就一直袋喺度。",
    effect: { startDraw: 1 },
    rarity: "普通",
  },
  /** 通用：抵打，捱得 */
  rl_bamboo_hat: {
    id: "rl_bamboo_hat",
    name: "竹帽",
    desc: "每場戰鬥開波自帶 5 擋。",
    flavor: "落雨唔怕，落石都頂得住兩下。",
    effect: { startBlock: 5 },
    rarity: "普通",
  },
  /** 通用：錢滾錢 */
  rl_stamp_card: {
    id: "rl_stamp_card",
    name: "印花卡",
    desc: "打贏小怪多 2 金——儲夠有得換。",
    flavor: "儲滿十個印花換個電飯煲，可惜你冇命等到。",
    effect: { goldBonus: 2 },
    rarity: "普通",
  },
  /* ===== 通用遺物（新） ===== */

  /** 通用：出牌多，食「涼茶」 */
  rl_herbal_cup: {
    id: "rl_herbal_cup",
    name: "涼茶碗",
    desc: "每回合開始多抽 1 張。",
    flavor: "苦口良藥——飲完，腦筋清一截。",
    effect: { drawPerTurn: 1 },
    rarity: "稀有",
  },
  /** 通用：攻擊牌每張加傷，食「搏命」型牌組 */
  rl_iron_knuckle: {
    id: "rl_iron_knuckle",
    name: "鐵指虎",
    desc: "每張攻擊牌額外 +1 傷害。",
    flavor: "戴上去，拳頭先算數。",
    effect: { attackPerCard: 1 },
    rarity: "稀有",
  },
};

export function relicById(id) {
  return RELICS[id];
}

/** 加總已擁有遺物效果 */
export function relicBonuses(run) {
  const out = {
    startEnergy: 0,
    startBlock: 0,
    startDraw: 0,
    attackBonus: 0,
    healOnWin: 0,
    goldBonus: 0,
    /** 每回合開始額外抽牌（角色專屬遺物用） */
    drawPerTurn: 0,
    /** 攻擊牌每張額外傷害（角色專屬遺物用） */
    attackPerCard: 0,
    /** 每場戰鬥首回合額外能量（角色專屬遺物用） */
    firstTurnEnergy: 0,
    /** 戰鬥勝利額外回血（角色專屬遺物用） */
    healOnWinBonus: 0,
    /** 每場首次回血額外加成（勝仔專屬遺物用） */
    healBonusFirst: 0,
  };
  for (const id of run?.relics || []) {
    const relic = RELICS[id];
    if (!relic) continue;
    // 角色專屬遺物：只有對應角色先食到效果
    if (relic.owner && relic.owner !== run?.characterId) continue;
    for (const [k, v] of Object.entries(relic.effect || {})) {
      if (k in out) out[k] += v;
    }
  }
  return out;
}

/**
 * 未擁有嘅遺物（便利店抽貨用）
 * 角色專屬遺物只會出現喺對應角色，否則貨架會擺滿用唔到嘅貨。
 */
export function unownedRelics(run) {
  const owned = new Set(run?.relics || []);
  const charId = run?.characterId;
  return Object.keys(RELICS).filter((id) => {
    if (owned.has(id)) return false;
    const owner = RELICS[id]?.owner;
    if (owner && owner !== charId) return false;
    return true;
  });
}

/** 抽 n 件未擁有遺物做便利店貨 */
export function pickShopRelics(run, n = 2, rng = Math.random) {
  const pool = unownedRelics(run);
  const shuffled = [...pool].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

/**
 * 抽卡包：由 SHOP.packPool（稀有／專屬級）抽一張。
 * 專屬牌只會抽自己角色嘅，避免角色辨識度被打亂。
 * @param {string} charId 角色 id（'oil'|'asan'|'kauko'）
 */
export function pickPackCard(charId, rng = Math.random) {
  const pool = SHOP.packPool.filter((id) => {
    const card = CARDS[id];
    if (!card) return false;
    // 專屬牌：只抽自己
    if (card.owner) return card.owner === charId;
    return true;
  });
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}


export function cardById(id) {
  return CARDS[id];
}

export function enemyById(id) {
  return ENEMIES[id];
}

/** 全體專屬牌 id（用嚟確保唔會跨角色漏出） */
const ALL_SIGNATURE_IDS = Object.values(SIGNATURE_CARDS).flat();

/**
 * 按角色加權抽三選一。
 * 規則：
 * - 共用池 = REWARD_POOL 減去所有專屬牌（專屬牌只經自己條線入）
 * - 自己 3 張專屬牌入池，權重最高（signatureWeight）
 * - rewardBias 次之
 * - 其他角色專屬牌永遠唔會出現
 */
export function pickRewardChoices(count = 3, exclude = [], characterId = null) {
  const char = characterId ? characterById(characterId) : null;
  const ownSignatures = SIGNATURE_CARDS[char?.id] || [];
  const bias = (char?.rewardBias || []).filter((id) => !ownSignatures.includes(id));

  const shared = REWARD_POOL.filter(
    (id) => !ALL_SIGNATURE_IDS.includes(id) && !exclude.includes(id)
  );
  const signatures = ownSignatures.filter((id) => !exclude.includes(id) && CARDS[id]);
  const biased = bias.filter((id) => shared.includes(id));

  /** @type {Map<string, number>} */
  const weight = new Map();
  const add = (id, w) => weight.set(id, Math.max(weight.get(id) || 0, w));
  shared.forEach((id) => add(id, 1));
  // 角色傾向 ×4：令「揀邊個角色」一眼睇得出牌路唔同
  biased.forEach((id) => add(id, 4));
  // 專屬牌 ×3（略低於傾向，避免專屬蓋過角色路線特色）
  signatures.forEach((id) => add(id, 3));

  const picked = [];
  while (picked.length < count && weight.size > 0) {
    const entries = [...weight.entries()];
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = Math.random() * total;
    let chosen = entries[entries.length - 1][0];
    for (const [id, w] of entries) {
      roll -= w;
      if (roll <= 0) {
        chosen = id;
        break;
      }
    }
    picked.push(chosen);
    weight.delete(chosen);
  }
  return picked;
}

/** 小怪勝場金幣（有便利店可花） */
export function battleGoldReward(isBoss) {
  return isBoss ? 0 : 5 + Math.floor(Math.random() * 4);
}

/** 節點敵人：有 enemyId 用固定；有 enemyPool 就抽一個（精英可抽中） */
export function pickNodeEnemyId(node, rng = Math.random) {
  if (!node) return null;
  if (node.enemyId) return node.enemyId;
  const pool = node.enemyPool || [];
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)] || pool[0];
}

/**
 * Act 內分支：取某選項對應嘅實際節點內容。
 * 回傳 { kind, enemyId?, eventId?, bonusGold?, bonusHp? }
 */
export function branchOptionById(node, optionId) {
  if (!node?.options) return null;
  return node.options.find((o) => o.id === optionId) || node.options[0] || null;
}

/** 遭遇紀錄一句（結算畫面用） */
export function enemyTag(enemy) {
  if (!enemy) return "";
  if (enemy.isFinalBoss) return "最終 Boss";
  if (enemy.isBoss) return "區 Boss";
  if (enemy.isElite) return "精英";
  return "小怪";
}
