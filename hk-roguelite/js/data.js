/**
 * 《香江小風波》垂直切片資料表（新專案重表，不綁舊年池／office）
 * 目錄暫名 hk-roguelite；對外產品名《香江小風波》
 */

export const META = {
  title: "香江小風波",
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
};

/** 阿油獎勵池（三選一抽樣來源） */
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
];

export const CHARACTER = {
  id: "oil",
  name: "阿油・後巷經紀",
  short: "出手快、愛搏；一路削血一路加速",
  initial: "油",
  maxHp: 68,
  energy: 3,
  passive: {
    id: "kuaisou",
    name: "快手",
    desc: "每打出第 3 張攻擊牌，下一張攻擊費用 −1（最低 0）並額外 +3 傷害。",
  },
  /** 開局薄牌組：多廉價攻擊、少盾 */
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
};

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
    subtitle: "休息／磨刀",
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
        effectText: "獲得 6 金幣；下戰開場 −1 能量",
        apply: (run) => {
          run.gold += 6;
          run.nextBattleEnergyPenalty = 1;
          return "銀紙入袋，但下一場要慢半拍。";
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
};

export function cardById(id) {
  return CARDS[id];
}

export function enemyById(id) {
  return ENEMIES[id];
}

export function pickRewardChoices(count = 3, exclude = []) {
  const pool = REWARD_POOL.filter((id) => !exclude.includes(id));
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
