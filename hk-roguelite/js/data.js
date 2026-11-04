/**
 * 《香江小風波》垂直切片資料表（新專案重表，不綁舊年池／office）
 * 目錄暫名 hk-roguelite；對外產品名《香江小風波》
 */

export const META = {
  title: "香江小風波",
  act1Name: "後巷・夜醒",
  act2Name: "旺角霓虹",
  act3Name: "城寨・天台",
  /** @deprecated 用 act1Name */
  actName: "後巷・夜醒",
  isolationNote: "目錄暫名 hk-roguelite；產品名《香江小風波》／與根目錄舊香江 demo 隔離",
};

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
    blurb: "烙住：下回合敵再受 2 點跳電。",
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
    blurb: "舊帳對數——打完再烙三點跳電。",
    art: "assets/skills/S72.png",
    rarity: "稀有",
  },
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
    initial: "油",
    maxHp: 68,
    energy: 3,
    passive: {
      id: "kuaisou",
      name: "快手",
      desc: "每打出第 3 張攻擊牌，下一張攻擊平一費（最低 0）兼額外 +3 傷害。",
    },
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
    ],
    rewardBias: ["S07", "S12", "S14", "S40", "S64", "S02"],
  },
  asan: {
    id: "asan",
    name: "阿珊・茶記夜更",
    short: "捱得、護得場；盾厚再反打",
    initial: "珊",
    maxHp: 80,
    energy: 3,
    passive: {
      id: "dangkou",
      name: "檔口",
      desc: "每場戰鬥首次捱打之後，即刻加 8 擋。",
    },
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
    ],
    rewardBias: ["S46", "S56", "S31", "S40", "S47", "S21", "S11", "S07"],
  },
  kauko: {
    id: "kauko",
    name: "九哥・招牌霓虹",
    short: "識睇牌、識抽牌；技能多、節奏活",
    initial: "九",
    maxHp: 65,
    energy: 3,
    passive: {
      id: "zhaopaiyan",
      name: "招牌眼",
      desc: "每場戰鬥首次打出技能牌，即刻多抽 1 張。",
    },
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
    ],
    rewardBias: ["S06", "S16", "S72", "S22", "S25", "S12"],
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
    intents: [
      { kind: "attack", value: 6, label: "偷襲 6" },
      { kind: "attack", value: 8, label: "撲影 8" },
      { kind: "block", value: 5, label: "隱影擋 5" },
    ],
  },
  E02: {
    id: "E02",
    name: "到期罐頭客",
    hp: 42,
    art: "assets/enemies/E02.jpg",
    flavor: "過期酸味湧出——客人都過期了。",
    intents: [
      { kind: "attack", value: 9, label: "砸罐 9" },
      { kind: "attack", value: 7, label: "酸液 7" },
      { kind: "buff_attack", value: 2, label: "發酵＋2攻" },
    ],
  },
  E03: {
    id: "E03",
    name: "逼爆潮",
    hp: 38,
    art: "assets/enemies/E03.jpg",
    flavor: "人潮湧到你站不穩。借过——打都要打。",
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
    name: "旺角圍標",
    hp: 48,
    art: "assets/enemies/E06.jpg",
    flavor: "燈箱一閃，圍標隊已經企滿你前後左右。",
    intents: [
      { kind: "attack", value: 9, label: "夾擊 9" },
      { kind: "attack", value: 12, label: "圍標 12" },
      { kind: "block", value: 6, label: "人牆 6" },
    ],
  },
  E07: {
    id: "E07",
    name: "招牌拆遷隊",
    hp: 52,
    art: "assets/enemies/E07.png",
    flavor: "電鋸聲響——呢條街嘅字，今晚拆完。",
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
    intents: [
      { kind: "attack", value: 11, label: "紥鐵 11" },
      { kind: "attack", value: 8, label: "鐵枝橫掃 8" },
      { kind: "buff_attack", value: 2, label: "上螺絲＋2攻" },
    ],
  },
  /** Act3 小怪：清場 */
  E10: {
    id: "E10",
    name: "清場沙包手",
    hp: 52,
    art: "assets/enemies/E10.png",
    flavor: "水浸都清得走，何況你一個人。沙包一放，路就冇咗。",
    intents: [
      { kind: "attack", value: 10, label: "沙包砸 10" },
      { kind: "block", value: 7, label: "疊沙包擋 7" },
      { kind: "attack", value: 13, label: "清場一推 13" },
    ],
  },
  /** Act3 小怪：籠邊睇客 */
  E11: {
    id: "E11",
    name: "籠邊睇客",
    hp: 46,
    art: "assets/enemies/E11.png",
    flavor: "籠邊個個都落過注。佢唔落注——佢落手。",
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
    bg: "assets/bg/bg-alley-mahjong-night.jpg",
  },
  {
    id: "n2",
    type: "event",
    title: "巷口風聲",
    subtitle: "短事件",
    eventId: "ev_gate_whisper",
    bg: "assets/bg/bg-stairwell-old.jpg",
  },
  {
    id: "n3",
    type: "battle",
    title: "到期罐頭客",
    subtitle: "戰鬥 → 選牌",
    enemyId: "E02",
    bg: "assets/bg/bg-tenement-stairwell.jpg",
  },
  {
    id: "n4",
    type: "rest",
    title: "簷篷底歇腳",
    subtitle: "休息／便利店",
    bg: "assets/bg/bg-alley-mahjong-night.jpg",
  },
  {
    id: "n5",
    type: "battle",
    title: "逼爆潮",
    subtitle: "戰鬥 → 選牌",
    enemyId: "E03",
    bg: "assets/bg/bg-neon-street-day.jpg",
  },
  {
    id: "n6",
    type: "boss",
    title: "巷口鐵閘・睇場",
    subtitle: "區 Boss",
    enemyId: "E04",
    bg: "assets/bg/bg-stairwell-old.jpg",
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
    bg: "assets/bg/bg-neon-street-day.jpg",
  },
  {
    id: "a2n2",
    type: "reward",
    title: "夜檔執牌",
    subtitle: "選牌",
    bg: "assets/bg/bg-neon-street-day.jpg",
  },
  {
    id: "a2n3",
    type: "event",
    title: "彌敦道擦肩",
    subtitle: "短事件",
    eventId: "ev_neon_hustle",
    bg: "assets/bg/bg-neon-street-day.jpg",
  },
  {
    id: "a2n4",
    type: "battle",
    title: "招牌拆遷隊",
    subtitle: "戰鬥 → 選牌",
    enemyId: "E07",
    bg: "assets/bg/bg-neon-street-day.jpg",
  },
  {
    id: "a2n5",
    type: "rest",
    title: "通宵便利店",
    subtitle: "休息／便利店",
    bg: "assets/bg/bg-neon-street-day.jpg",
  },
  {
    id: "a2n6",
    type: "boss",
    title: "西裝收數隊",
    subtitle: "區 Boss",
    enemyId: "E05",
    bg: "assets/bg/bg-neon-street-day.jpg",
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
    bg: "assets/bg/bg-rooftop-playground.jpg",
  },
  {
    id: "a3n2",
    type: "reward",
    title: "天台執牌",
    subtitle: "選牌",
    bg: "assets/bg/bg-rooftop-playground.jpg",
  },
  {
    id: "a3n3",
    type: "event",
    title: "籠邊夜話",
    subtitle: "短事件",
    eventId: "ev_rooftop_cage",
    bg: "assets/bg/bg-rooftop-wooden-dummy.jpg",
  },
  {
    id: "a3n4",
    type: "battle",
    title: "清場／精英",
    subtitle: "戰鬥 → 選牌",
    enemyPool: ["E10", "E11", "E08"],
    bg: "assets/bg/bg-rooftop-wooden-dummy.jpg",
  },
  {
    id: "a3n5",
    type: "rest",
    title: "天台搭棚歇腳",
    subtitle: "休息／便利店",
    bg: "assets/bg/bg-rooftop-playground.jpg",
  },
  {
    id: "a3n6",
    type: "boss",
    title: "籠門之王",
    subtitle: "最終 Boss",
    enemyId: "E12",
    bg: "assets/bg/bg-rooftop-playground.jpg",
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
        effectText: "下戰開場 +1 能量；入場帶 6 擋",
        apply: (run) => {
          run.nextBattleEnergyBonus = (run.nextBattleEnergyBonus || 0) + 1;
          run.nextBattleBlock = (run.nextBattleBlock || 0) + 6;
          return "吹得掂——下一場開局多 1 能量，兼帶 6 擋入場。";
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
        effectText: "下戰開場 −1 能量；入場帶 8 擋",
        apply: (run) => {
          run.nextBattleEnergyPenalty = (run.nextBattleEnergyPenalty || 0) + 1;
          run.nextBattleBlock = (run.nextBattleBlock || 0) + 8;
          return "走得快，下一場慢半拍，不過有擋傍身。";
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
};

/** 依 run.act 取當前地圖 */
export function mapForAct(act) {
  if (act === 3) return ACT3_MAP;
  return act === 2 ? ACT2_MAP : ACT1_MAP;
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
};

export function cardById(id) {
  return CARDS[id];
}

export function enemyById(id) {
  return ENEMIES[id];
}

export function pickRewardChoices(count = 3, exclude = [], characterId = null) {
  const char = characterId ? characterById(characterId) : null;
  const bias = char?.rewardBias || [];
  const pool = REWARD_POOL.filter((id) => !exclude.includes(id));
  const weighted = [
    ...bias.filter((id) => pool.includes(id)),
    ...bias.filter((id) => pool.includes(id)),
    ...pool,
  ];
  const shuffled = [...weighted].sort(() => Math.random() - 0.5);
  const picked = [];
  for (const id of shuffled) {
    if (!picked.includes(id)) picked.push(id);
    if (picked.length >= count) break;
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

/** 遭遇紀錄一句（結算畫面用） */
export function enemyTag(enemy) {
  if (!enemy) return "";
  if (enemy.isFinalBoss) return "最終 Boss";
  if (enemy.isBoss) return "區 Boss";
  if (enemy.isElite) return "精英";
  return "小怪";
}
