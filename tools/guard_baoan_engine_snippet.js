  /* ========== guard_baoan accident-chain engine (CURSOR_LANDING_SPEC) ========== */
  const GB_PACK_ID = "guard_baoan";
  const GB_HID_KEYS = ["pressure", "boss", "procedure", "favor", "renqing", "gold_run"];
  const GB_HID_CLAMP = {
    pressure: [0, 12], boss: [-5, 10], procedure: [0, 12], favor: [0, 10], renqing: [0, 10], gold_run: [0, 999],
  };

  function isAccidentPack(pack) {
    const p = typeof pack === "string" ? storyPackById(pack) : pack;
    return !!(p && (p.engine === "accident" || p.id === GB_PACK_ID && Array.isArray(p.accident_chain)));
  }

  function gbPack() {
    return storyPackById(GB_PACK_ID);
  }

  function gbMeta() {
    return DATA.guard_baoan_meta || {
      daily_soul_cap: 8, daily_fame_cap: 10, clear_soul_first: 20, clear_soul_replay: 5,
      welfare_makeup_cost: 2, stair_success: 15, stair_hidden: 100, stair_hidden_soul: 100,
    };
  }

  function gbEmptyHidden() {
    return {
      flag_noted: false,
      pressure: 0,
      boss: 0,
      procedure: 0,
      favor: 0,
      renqing: 0,
      gold_run: 0,
    };
  }

  function gbEnsureAccount() {
    if (!state.gbAccount || typeof state.gbAccount !== "object") {
      state.gbAccount = {
        ownedBattle: [],
        ownedSkill: [],
        ownedEquip: [],
        packClearCount: 0,
        remnantModelClaimed: false,
        stair100Claimed: false,
        wheelCost: 1,
        wheelDateKey: "",
        welfare: { signed: {}, makeup: {} },
        duties: null,
        dailySoul: 0,
        dailyFame: 0,
        dailyDateKey: "",
      };
    }
    const a = state.gbAccount;
    if (!Array.isArray(a.ownedBattle)) a.ownedBattle = [];
    if (!Array.isArray(a.ownedSkill)) a.ownedSkill = [];
    if (!Array.isArray(a.ownedEquip)) a.ownedEquip = [];
    if (typeof a.packClearCount !== "number") a.packClearCount = 0;
    if (typeof a.wheelCost !== "number") a.wheelCost = 1;
    if (!a.welfare || typeof a.welfare !== "object") a.welfare = { signed: {}, makeup: {} };
    return a;
  }

  function gbGrantStarters() {
    const pack = gbPack();
    const a = gbEnsureAccount();
    const add = (arr, ids) => {
      (ids || []).forEach((id) => {
        if (id && arr.indexOf(id) < 0) arr.push(id);
      });
    };
    if (!a.ownedBattle.length) add(a.ownedBattle, pack && pack.accident_starter_battle);
    if (!a.ownedSkill.length) add(a.ownedSkill, pack && pack.accident_starter_skill);
    // sync into album counts so UI/album consistent
    a.ownedBattle.forEach((id) => {
      if ((state.cardCounts[id] | 0) < 1) {
        state.cardCounts[id] = 1;
      }
    });
    a.ownedSkill.forEach((id) => {
      if ((state.cardCounts[id] | 0) < 1) state.cardCounts[id] = 1;
    });
    a.ownedEquip.forEach((id) => {
      if ((state.cardCounts[id] | 0) < 1) state.cardCounts[id] = 1;
    });
  }

  function gbOwnBattleIds() {
    gbGrantStarters();
    return gbEnsureAccount().ownedBattle.slice();
  }
  function gbOwnSkillIds() {
    gbGrantStarters();
    return gbEnsureAccount().ownedSkill.slice();
  }
  function gbOwnEquipIds() {
    gbGrantStarters();
    return gbEnsureAccount().ownedEquip.slice();
  }

  function gbUnlockCard(id) {
    if (!id) return;
    const a = gbEnsureAccount();
    if (String(id).indexOf("GB_B") === 0) {
      if (a.ownedBattle.indexOf(id) < 0) a.ownedBattle.push(id);
    } else if (String(id).indexOf("GB_S") === 0) {
      if (a.ownedSkill.indexOf(id) < 0) a.ownedSkill.push(id);
    } else if (String(id).indexOf("GB_E") === 0) {
      if (a.ownedEquip.indexOf(id) < 0) a.ownedEquip.push(id);
    }
    state.cardCounts[id] = Math.max(1, state.cardCounts[id] | 0);
  }

  function gbHkDateKey() {
    return hkDateKey();
  }

  function gbEnsureDailyCaps() {
    const a = gbEnsureAccount();
    const key = gbHkDateKey();
    if (a.dailyDateKey !== key) {
      a.dailyDateKey = key;
      a.dailySoul = 0;
      a.dailyFame = 0;
    }
    if (a.wheelDateKey !== key) {
      a.wheelDateKey = key;
      a.wheelCost = 1;
    }
  }

  function gbGrantCappedSoul(n, opts) {
    opts = opts || {};
    const add = Math.max(0, n | 0);
    if (!add) return 0;
    if (opts.uncapped) {
      state.soul = (state.soul | 0) + add;
      return add;
    }
    gbEnsureDailyCaps();
    const a = gbEnsureAccount();
    const cap = (gbMeta().daily_soul_cap | 0) || 8;
    const room = Math.max(0, cap - (a.dailySoul | 0));
    const got = Math.min(add, room);
    a.dailySoul = (a.dailySoul | 0) + got;
    state.soul = (state.soul | 0) + got;
    return got;
  }

  function gbGrantCappedFame(n) {
    const add = Math.max(0, n | 0);
    if (!add) return 0;
    gbEnsureDailyCaps();
    const a = gbEnsureAccount();
    const cap = (gbMeta().daily_fame_cap | 0) || 10;
    const room = Math.max(0, cap - (a.dailyFame | 0));
    const got = Math.min(add, room);
    a.dailyFame = (a.dailyFame | 0) + got;
    state.fame = (state.fame | 0) + got;
    return got;
  }

  function applyHiddenDelta(stepId, choiceId, context) {
    const run = state.gbRun;
    if (!run) return null;
    if (!run.hidden) run.hidden = gbEmptyHidden();
    const delta = (context && context.delta) || {};
    const log = { stepId: stepId || "", choiceId: choiceId || "", before: Object.assign({}, run.hidden), delta: {} };
    if (delta.flag_noted) run.hidden.flag_noted = true;
    GB_HID_KEYS.forEach((k) => {
      const v = delta[k] | 0;
      log.delta[k] = v;
      let next = (run.hidden[k] | 0) + v;
      const clamp = GB_HID_CLAMP[k];
      if (clamp) next = Math.max(clamp[0], Math.min(clamp[1], next));
      run.hidden[k] = next;
    });
    // skill modifiers (passive owned in-run)
    const skills = run.pickedSkills || [];
    if (skills.indexOf("GB_S04") >= 0 && (delta.pressure | 0) > 0) {
      run.hidden.pressure = Math.max(0, (run.hidden.pressure | 0) - 1);
      log.delta.pressure_resist = -1;
    }
    if (skills.indexOf("GB_S02") >= 0 && (delta.procedure | 0) > 0) {
      run.hidden.procedure = Math.min(12, (run.hidden.procedure | 0) + 1);
      log.delta.procedure_boost = 1;
    }
    log.after = Object.assign({}, run.hidden);
    if (!Array.isArray(run.hiddenLog)) run.hiddenLog = [];
    run.hiddenLog.push(log);
    return log;
  }

  function gbAccidentNodeById(id) {
    if (!id) return null;
    return (DATA.events || []).find((e) => e.id === id && e.accident_node) || null;
  }

  function gbShuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function gbBeginFreshRun() {
    gbGrantStarters();
    state.gbRun = {
      packId: GB_PACK_ID,
      phase: "prep", // prep | intro | dialogue | choose | outcome | battle | shop | ending
      chainIndex: 0,
      mainCount: 0,
      nodeId: null,
      dlgPage: 0,
      hidden: gbEmptyHidden(),
      hiddenLog: [],
      pickedBattle: [],
      pickedSkills: [],
      runEquip: [],
      shopNightKey: "",
      shopCoffeeBought: false,
      shopBought: {},
      pendingChoice: null,
      pendingBattle: null,
      battleWin: null,
      endingId: null,
      rewardNote: "",
      stairStreak: 0,
      stairDoneToday: false,
    };
    // isolate combat pocket for this pack run
    state.team = [];
    state.deploy = [];
    state.lifeSkills = [];
    state.loadout = {};
    state.deadFighters = [];
    return state.gbRun;
  }

  function gbHasActiveRun() {
    return !!(state.gbRun && state.gbRun.packId === GB_PACK_ID && state.gbRun.phase !== "ended");
  }

  function gbEnterPackFromSelect() {
    if (gbHasActiveRun() && state.gbRun.phase !== "prep" && state.gbRun.phase !== "ending") {
      state.screen = state.gbRun.phase === "prep" ? "gbPrep" : "gbAccident";
      if (state.gbRun.phase === "shop") state.screen = "gbShop";
      if (state.gbRun.phase === "stair") state.screen = "gbStair";
      render();
      return;
    }
    gbBeginFreshRun();
    state.activeStoryPackId = GB_PACK_ID;
    state.storyPackUserPicked = true;
    state.screen = "gbPrep";
    render();
  }

  function gbConfirmPrep() {
    const run = state.gbRun;
    if (!run) return;
    if ((run.pickedBattle || []).length !== 5 || (run.pickedSkills || []).length !== 5) return;
    // only selected cards usable
    state.team = run.pickedBattle.slice();
    state.lifeSkills = run.pickedSkills.slice();
    state.deploy = run.pickedBattle.slice(0, TEAM_SIZE);
    state.loadout = {};
    run.pickedBattle.forEach((fid) => {
      state.loadout[fid] = run.pickedSkills.slice(0, Math.min(2, raritySlots(fighterById[fid] || { rarity: "普通" })));
    });
    const pack = gbPack();
    const first = (pack && pack.accident_entry) || (pack && pack.accident_chain && pack.accident_chain[0]);
    run.chainIndex = 0;
    run.nodeId = first;
    run.phase = "intro";
    run.dlgPage = 0;
    state.selectedEvent = gbAccidentNodeById(first);
    state.screen = "gbAccident";
    render();
  }

  function gbCurrentNode() {
    const run = state.gbRun;
    if (!run) return null;
    return gbAccidentNodeById(run.nodeId);
  }

  function gbChoiceOrder(node) {
    const run = state.gbRun;
    const choices = (node && Array.isArray(node.accident_choices)) ? node.accident_choices : [];
    if (!run) return choices.map((c, i) => ({ c, i }));
    if (!run.choiceOrder || run.choiceOrderNode !== node.id) {
      const idx = choices.map((_, i) => i);
      run.choiceOrder = gbShuffle(idx);
      run.choiceOrderNode = node.id;
    }
    return run.choiceOrder.map((i) => ({ c: choices[i], i }));
  }

  function gbCheckEnding() {
    const run = state.gbRun;
    if (!run || !run.hidden) return null;
    // earliest after 8 main events
    if ((run.mainCount | 0) < 8) return null;
    const h = run.hidden;
    if (h.flag_noted || (h.pressure | 0) >= 8 || (h.boss | 0) <= -2) return "ending_c";
    if ((h.boss | 0) >= 5 && (h.procedure | 0) >= 6 && (h.pressure | 0) <= 4) return "ending_a";
    const fr = (h.favor | 0) + (h.renqing | 0);
    if (fr >= 8 && ((h.favor | 0) >= 3 || (h.renqing | 0) >= 3)) return "ending_b";
    return null;
  }

  function gbEndingEventId(key) {
    const pack = gbPack();
    const hit = ((pack && pack.accident_endings) || []).find((e) => e.id === key);
    return (hit && hit.event) || ({
      ending_a: "EV_GB_END_A", ending_b: "EV_GB_END_B", ending_c: "EV_GB_END_C",
    })[key];
  }

  function gbApplyBattleHidden(win) {
    const run = state.gbRun;
    if (!run) return;
    if (win) {
      applyHiddenDelta(run.nodeId, "battle_win", { delta: { procedure: 1, boss: 1, gold_run: 2 } });
    } else {
      applyHiddenDelta(run.nodeId, "battle_lose", { delta: { pressure: 2, boss: -1 } });
      if ((run.pickedSkills || []).indexOf("GB_S04") >= 0) {
        applyHiddenDelta(run.nodeId, "battle_lose_resist", { delta: { pressure: -1 } });
      }
    }
  }

  function gbResolveChoice(choiceIdx) {
    const run = state.gbRun;
    const node = gbCurrentNode();
    if (!run || !node) return;
    const choices = Array.isArray(node.accident_choices) ? node.accident_choices : [];
    const pick = choices[choiceIdx | 0];
    if (!pick) return;
    run.pendingChoice = { idx: choiceIdx | 0, pick };
    applyHiddenDelta(node.id, "c" + choiceIdx, { delta: pick.hidden_delta || {} });
    run.phase = "outcome";
    if (pick.battle) {
      run.pendingBattle = pick.battle;
    } else {
      run.pendingBattle = null;
    }
    run.wantShop = !!pick.night_shop;
    render();
  }

  function gbAfterOutcomeContinue() {
    const run = state.gbRun;
    if (!run) return;
    if (run.pendingBattle) {
      const enemyId = run.pendingBattle;
      const node = gbCurrentNode();
      // inject battle onto a synthetic event without mutating data permanently
      const battleEv = Object.assign({}, node || {}, {
        id: (node && node.id) + "_BATTLE",
        battle: enemyId,
        name: (node && node.name) || "現場衝突",
        reward_soul: 0,
        reward_gold: 0,
        reward_xp: 0,
        category: "adventure",
      });
      state.selectedEvent = battleEv;
      state.gbRun.phase = "battle";
      // ensure deploy from picked only
      state.team = (run.pickedBattle || []).filter((id) => !isDeadFighter(id));
      if (!state.deploy || !state.deploy.length) state.deploy = state.team.slice(0, TEAM_SIZE);
      state.screen = "encounter";
      render();
      return;
    }
    gbFinishStep();
  }

  function gbOnBattleEnd(win) {
    const run = state.gbRun;
    if (!run) return false;
    run.battleWin = !!win;
    run.pendingBattle = null;
    gbApplyBattleHidden(win);
    run.phase = "outcome";
    run.postBattleNote = win
      ? "現場受控。你把經過寫進日誌。"
      : "現場一度失序。你喘住氣，壓力往上爬。";
    state.screen = "gbAccident";
    // do not advance life age
    return true;
  }

  function gbFinishStep() {
    const run = state.gbRun;
    const node = gbCurrentNode();
    if (!run) return;
    if (node && node.accident_main) run.mainCount = (run.mainCount | 0) + 1;

    const endKey = gbCheckEnding();
    if (endKey) {
      gbTriggerEnding(endKey);
      return;
    }

    if (run.wantShop) {
      run.wantShop = false;
      const nightKey = "n" + (run.chainIndex | 0);
      if (run.shopNightKey !== nightKey) {
        run.shopNightKey = nightKey;
        run.shopCoffeeBought = false;
        run.phase = "shop";
        state.screen = "gbShop";
        render();
        return;
      }
    }

    gbAdvanceChain();
  }

  function gbAdvanceChain() {
    const run = state.gbRun;
    const pack = gbPack();
    if (!run || !pack) return;
    const chain = pack.accident_chain || [];
    let next = (run.chainIndex | 0) + 1;
    run.chainIndex = next;
    if (next >= chain.length) {
      // fallback ending C
      gbTriggerEnding("ending_c");
      return;
    }
    run.nodeId = chain[next];
    run.phase = "intro";
    run.dlgPage = 0;
    run.pendingChoice = null;
    run.postBattleNote = "";
    run.choiceOrder = null;
    run.choiceOrderNode = null;
    state.selectedEvent = gbAccidentNodeById(run.nodeId);
    state.screen = "gbAccident";
    render();
  }

  function gbTriggerEnding(key) {
    const run = state.gbRun;
    if (!run) return;
    run.endingId = key;
    run.phase = "ending";
    const evId = gbEndingEventId(key);
    state.selectedEvent = (DATA.events || []).find((e) => e.id === evId) || null;
    // rewards
    const a = gbEnsureAccount();
    const meta = gbMeta();
    const first = (a.packClearCount | 0) <= 0;
    const soulGain = first ? (meta.clear_soul_first | 0) || 20 : (meta.clear_soul_replay | 0) || 5;
    state.soul = (state.soul | 0) + soulGain;
    a.packClearCount = (a.packClearCount | 0) + 1;
    let remnant = 0;
    if (key === "ending_a" && !a.remnantModelClaimed) {
      a.remnantModelClaimed = true;
      remnant = 1;
      // remnant pages use cardShards pool — grant generic shard token count
      if (!state.cardShards || typeof state.cardShards !== "object") state.cardShards = {};
      state.cardShards.remnant_guard_baoan_model = (state.cardShards.remnant_guard_baoan_model | 0) + 1;
      if (!state.lifeFlags) state.lifeFlags = {};
      state.lifeFlags.remnant_guard_baoan_model = 1;
    }
    if (!state.lifeFlags) state.lifeFlags = {};
    state.lifeFlags["accident_ending_" + key] = 1;
    state.lifeFlags["office_cleared_" + GB_PACK_ID] = 1;
    run.rewardNote = (first ? "首次通關 20" : "再次通關 5") + " 膠幣" + (remnant ? "；殘頁 +1（模範保安）" : "");
    // reset run-only, keep owned
    gbResetRunKeepAccount();
    state.screen = "gbEnding";
    render();
  }

  function gbResetRunKeepAccount() {
    const run = state.gbRun;
    // keep ending display fields on a stub
    const endingId = run && run.endingId;
    const rewardNote = run && run.rewardNote;
    const hidden = run && run.hidden;
    state.gbRun = {
      packId: GB_PACK_ID,
      phase: "ending",
      endingId,
      rewardNote,
      hidden,
      pickedBattle: [],
      pickedSkills: [],
    };
    state.team = [];
    state.deploy = [];
    state.lifeSkills = [];
    state.loadout = {};
  }

  function gbLeaveEnding() {
    state.gbRun = null;
    state.selectedEvent = null;
    state.screen = "home";
    render();
  }

  function gbShopBuy(shopId) {
    const run = state.gbRun;
    const pack = gbPack();
    if (!run || !pack) return "無法購買";
    const item = (pack.accident_shop || []).find((x) => x.id === shopId);
    if (!item) return "沒有此貨";
    if (run.shopBought && run.shopBought[shopId] && item.night_limit) return "今晚已買過";
    if (item.id === "shop_coffee" && run.shopCoffeeBought) return "熱咖啡每晚限一次";
    const price = item.price | 0;
    if ((run.hidden.gold_run | 0) < price) return "局內金幣不足";
    if ((item.need_renqing | 0) > 0 && (run.hidden.renqing | 0) < (item.need_renqing | 0)) return "人情不足";
    run.hidden.gold_run = (run.hidden.gold_run | 0) - price;
    if ((item.consume_renqing | 0) > 0) {
      run.hidden.renqing = Math.max(0, (run.hidden.renqing | 0) - (item.consume_renqing | 0));
    }
    applyHiddenDelta("shop", shopId, { delta: { gold_run: 0, pressure: item.pressure | 0 } });
    if (item.pressure) {
      run.hidden.pressure = Math.max(0, (run.hidden.pressure | 0) + (item.pressure | 0));
    }
    (item.grant || []).forEach((g) => {
      if (g === "coffee") {
        run.shopCoffeeBought = true;
      } else if (g === "support") {
        // temporary support: unlock b26-like if owned pick allows — grant once to run team skill feel
        if (run.pickedSkills.indexOf("GB_S10") < 0) run.pickedSkills.push("GB_S10");
      } else {
        gbUnlockCard(g);
        if (String(g).indexOf("GB_E") === 0 && (run.runEquip || []).indexOf(g) < 0) {
          run.runEquip = (run.runEquip || []).concat([g]);
        }
      }
    });
    if (!run.shopBought) run.shopBought = {};
    run.shopBought[shopId] = 1;
    if (item.night_limit) run.shopCoffeeBought = true;
    return "";
  }

  /* ----- Duties (海嵐峰排班) ----- */
  function gbDutyPool() {
    const pack = gbPack();
    return (pack && pack.roster_duties) || [];
  }

  function gbEnsureDuties() {
    gbEnsureDailyCaps();
    const a = gbEnsureAccount();
    const key = gbHkDateKey();
    if (a.duties && a.duties.dateKey === key) return a.duties;
    const pool = gbDutyPool();
    const routine = pool.filter((d) => d.pool === "routine" || d.pool === "both");
    const extra = pool.filter((d) => d.pool === "extra" || d.pool === "both");
    const pickWeighted = (arr, n, used) => {
      const out = [];
      const bag = arr.slice();
      while (out.length < n && bag.length) {
        let total = 0;
        bag.forEach((d) => { total += (d.weight | 0) || 1; });
        let r = Math.random() * total;
        let idx = 0;
        for (; idx < bag.length; idx++) {
          r -= (bag[idx].weight | 0) || 1;
          if (r <= 0) break;
        }
        const hit = bag.splice(Math.min(idx, bag.length - 1), 1)[0];
        if (!hit || used.has(hit.id)) continue;
        used.add(hit.id);
        out.push(hit.id);
      }
      return out;
    };
    const used = new Set();
    // ensure gate + patrol coverage
    const slots = ["slot_morning", "slot_noon", "slot_dusk", "slot_night"];
    const prefer = {
      slot_morning: ["duty_gate", "duty_log", "duty_notice", "duty_fire"],
      slot_night: ["duty_patrol_floor", "duty_backlane", "duty_cctv", "duty_carpark"],
    };
    const assigned = {};
    slots.forEach((slot) => {
      const prefs = (prefer[slot] || []).map((id) => routine.find((d) => d.id === id)).filter(Boolean);
      const pickFrom = prefs.length ? prefs : routine;
      const ids = pickWeighted(pickFrom, 1, used);
      assigned[slot] = ids[0] || null;
    });
    // fill nulls
    slots.forEach((slot) => {
      if (!assigned[slot]) {
        const ids = pickWeighted(routine, 1, used);
        assigned[slot] = ids[0] || null;
      }
    });
    const extraId = pickWeighted(extra.length ? extra : routine, 1, used)[0] || null;
    a.duties = {
      dateKey: key,
      slots: assigned,
      extra: extraId,
      status: {},
      retries: {},
    };
    return a.duties;
  }

  function gbCompleteDuty(dutyId) {
    const duties = gbEnsureDuties();
    if (!dutyId || (duties.status[dutyId] === "done")) return { ok: false, msg: "已完成" };
    const def = gbDutyPool().find((d) => d.id === dutyId);
    if (!def) return { ok: false, msg: "無此差事" };
    const soulWant = (def.reward && def.reward.soul) | 0;
    const fameWant = (def.reward && def.reward.fame) | 0;
    const soulGot = gbGrantCappedSoul(soulWant);
    const fameGot = gbGrantCappedFame(fameWant);
    duties.status[dutyId] = "done";
    let msg = `完成「${def.name}」`;
    if (soulGot < soulWant) msg += "（今日膠幣已達上限）";
    if (fameGot < fameWant) msg += "（今日聲望已達上限）";
    return { ok: true, msg, soulGot, fameGot };
  }

  function gbAbandonDuty(dutyId) {
    const duties = gbEnsureDuties();
    if (!dutyId) return;
    duties.status[dutyId] = "abandoned";
  }

  /* ----- Wheel / Welfare ----- */
  function gbWheelSpin() {
    gbEnsureDailyCaps();
    const a = gbEnsureAccount();
    const cost = Math.max(1, a.wheelCost | 0);
    if ((state.soul | 0) < cost) return { ok: false, msg: `膠幣不足（需要 ${cost}）` };
    state.soul = (state.soul | 0) - cost;
    a.wheelCost = cost * 2;
    const prizes = (gbMeta().wheel_prizes) || ["fame5", "shards2", "battle1", "skill1", "equip1", "thanks"];
    const prize = prizes[Math.floor(Math.random() * prizes.length)];
    let msg = "多謝參加";
    if (prize === "fame5") {
      const got = gbGrantCappedFame(5);
      msg = got < 5 ? `聲望 +${got}（已達今日上限）` : "聲望 +5";
    } else if (prize === "shards2") {
      if (!state.cardShards) state.cardShards = {};
      state.cardShards.wheel_remnant = (state.cardShards.wheel_remnant | 0) + 2;
      msg = "殘頁 +2";
    } else if (prize === "battle1" || prize === "skill1" || prize === "equip1") {
      const all = prize === "battle1" ? (DATA.fighters || []).filter((f) => f.pack_only === GB_PACK_ID)
        : prize === "skill1" ? (DATA.skills || []).filter((s) => s.pack_only === GB_PACK_ID)
          : (DATA.equipment || []).filter((e) => e.pack_only === GB_PACK_ID);
      const owned = new Set(prize === "battle1" ? gbOwnBattleIds() : prize === "skill1" ? gbOwnSkillIds() : gbOwnEquipIds());
      const fresh = all.filter((x) => !owned.has(x.id));
      const pool = fresh.length ? fresh : all;
      if (!pool.length) {
        const got = gbGrantCappedSoul(1);
        msg = got ? "已有補償 膠幣 +1" : "已全擁有，且今日膠幣已達上限";
      } else {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        gbUnlockCard(pick.id);
        msg = `${pick.name} ×1`;
      }
    } else {
      msg = "多謝參加";
    }
    return { ok: true, msg, nextCost: a.wheelCost };
  }

  function gbWelfareSign(dateKey, isMakeup) {
    gbEnsureDailyCaps();
    const a = gbEnsureAccount();
    const key = dateKey || gbHkDateKey();
    if (a.welfare.signed[key]) return { ok: false, msg: "今日已簽到" };
    if (isMakeup) {
      const cost = (gbMeta().welfare_makeup_cost | 0) || 2;
      if ((state.soul | 0) < cost) return { ok: false, msg: "膠幣不足（補簽需 2）" };
      state.soul -= cost;
      a.welfare.makeup[key] = 1;
    }
    a.welfare.signed[key] = 1;
    const roll = Math.random();
    let msg = "多謝惠顧";
    if (roll < 0.25) {
      const got = gbGrantCappedSoul(1);
      msg = got ? "膠幣 +1" : "今日膠幣已達上限";
    } else if (roll < 0.45) {
      const got = gbGrantCappedSoul(2);
      msg = got ? `膠幣 +${got}` : "今日膠幣已達上限";
    } else if (roll < 0.65) {
      const got = gbGrantCappedFame(1);
      msg = got ? "聲望 +1" : "今日聲望已達上限";
    } else if (roll < 0.8) {
      const got = gbGrantCappedFame(2);
      msg = got ? `聲望 +${got}` : "今日聲望已達上限";
    } else if (roll < 0.9) {
      const all = (DATA.fighters || []).filter((f) => f.pack_only === GB_PACK_ID);
      const owned = new Set(gbOwnBattleIds());
      const fresh = all.filter((x) => !owned.has(x.id));
      const pool = fresh.length ? fresh : all;
      if (pool.length) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        gbUnlockCard(pick.id);
        msg = `戰鬥卡 ${pick.name}`;
      }
    }
    return { ok: true, msg };
  }

  /* ----- Stair jump ----- */
  function gbOpenStair() {
    if (!gbHasActiveRun() && !(state.gbRun && state.gbRun.phase === "stair")) {
      // allow from pack detail / home when pack selected — but only inside pack context
      if (!state.gbRun) {
        state.gbRun = { packId: GB_PACK_ID, phase: "stair", stairStreak: 0, stairSuccessClaimed: false, hidden: gbEmptyHidden() };
      } else {
        state.gbRun.phase = "stair";
        state.gbRun.stairStreak = 0;
      }
    } else if (state.gbRun) {
      state.gbRun.phase = "stair";
      state.gbRun.stairStreak = state.gbRun.stairStreak | 0;
    }
    state.screen = "gbStair";
    render();
  }

  function gbStairJump(ok) {
    const run = state.gbRun;
    if (!run) return;
    const a = gbEnsureAccount();
    const meta = gbMeta();
    if (!ok) {
      run.stairStreak = 0;
      return { streak: 0, msg: "踏空——連跳歸零" };
    }
    run.stairStreak = (run.stairStreak | 0) + 1;
    const streak = run.stairStreak | 0;
    let msg = `連續 ${streak}`;
    if (streak >= (meta.stair_success | 0 || 15) && !run.stairSuccessClaimed) {
      run.stairSuccessClaimed = true;
      run.hidden = run.hidden || gbEmptyHidden();
      run.hidden.gold_run = (run.hidden.gold_run | 0) + 3;
      msg += " · 完成！局內金幣 +3";
    }
    if (streak >= (meta.stair_hidden | 0 || 100) && !a.stair100Claimed) {
      a.stair100Claimed = true;
      const got = gbGrantCappedSoul((meta.stair_hidden_soul | 0) || 100, { uncapped: true });
      msg += ` · 隱藏獎：膠幣 +${got}（只領一次）`;
    }
    return { streak, msg };
  }

  /* ----- Views ----- */
  function viewGbPrep(root) {
    const run = state.gbRun || gbBeginFreshRun();
    const battles = gbOwnBattleIds().map((id) => fighterById[id]).filter(Boolean);
    const skills = gbOwnSkillIds().map((id) => skillById[id]).filter(Boolean);
    const pb = new Set(run.pickedBattle || []);
    const ps = new Set(run.pickedSkills || []);
    const canGo = pb.size === 5 && ps.size === 5;
    root.innerHTML = `
      <div class="hud">
        <span class="chip year"><span class="dot"></span>開局選卡</span>
        <span class="chip soul"><span class="dot"></span>戰鬥 ${pb.size}/5 · 技能 ${ps.size}/5</span>
      </div>
      <div class="ribbon">海嵐峰卡冊 · 只帶入已選</div>
      <div class="bubble">挑選 5 張戰鬥卡＋5 張技能卡。未選入本局的卡不會顯示或使用。</div>
      <div class="soft-panel"><b>戰鬥卡</b></div>
      <div class="card-grid" id="gb-b-grid">
        ${battles.map((f) => `
          <button type="button" class="card-mini ${pb.has(f.id) ? "selected" : ""}" data-bid="${esc(f.id)}">
            <img src="${esc(f.art || "")}" alt="" data-card-name="${esc(f.name)}" data-card-kind="fighter" />
            <span>${esc(f.name)}</span>
          </button>`).join("")}
      </div>
      <div class="soft-panel"><b>技能卡</b></div>
      <div class="card-grid" id="gb-s-grid">
        ${skills.map((s) => `
          <button type="button" class="card-mini ${ps.has(s.id) ? "selected" : ""}" data-sid="${esc(s.id)}">
            <img src="${esc(s.art || "")}" alt="" data-card-name="${esc(s.name)}" data-card-kind="skill" />
            <span>${esc(s.name)}</span>
          </button>`).join("")}
      </div>
      <div class="btn-row">
        <button class="btn ghost" id="gb-prep-back" type="button">返回</button>
        <button class="btn gold" id="gb-prep-go" type="button" ${canGo ? "" : "disabled"}>開始第一更</button>
      </div>
    `;
    root.querySelectorAll("[data-bid]").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-bid");
        const arr = run.pickedBattle || [];
        const i = arr.indexOf(id);
        if (i >= 0) arr.splice(i, 1);
        else if (arr.length < 5) arr.push(id);
        run.pickedBattle = arr;
        render();
      };
    });
    root.querySelectorAll("[data-sid]").forEach((btn) => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-sid");
        const arr = run.pickedSkills || [];
        const i = arr.indexOf(id);
        if (i >= 0) arr.splice(i, 1);
        else if (arr.length < 5) arr.push(id);
        run.pickedSkills = arr;
        render();
      };
    });
    $("#gb-prep-back", root).onclick = () => { state.gbRun = null; state.screen = "storyPackDetail"; state.storyPackDetailId = GB_PACK_ID; render(); };
    const go = $("#gb-prep-go", root);
    if (go) go.onclick = () => gbConfirmPrep();
  }

  function viewGbAccident(root) {
    const run = state.gbRun;
    const node = gbCurrentNode();
    if (!run || !node) {
      root.innerHTML = `<div class="bubble">事故鏈未就緒</div><button class="btn" id="gb-x">返回</button>`;
      $("#gb-x", root).onclick = () => { state.screen = "home"; render(); };
      return;
    }
    const phase = run.phase || "intro";
    const dlg = Array.isArray(node.dialogue) ? node.dialogue : [];
    let body = "";
    if (phase === "intro") {
      body = `
        <div class="pack-detail-art comic-frame"><img src="${esc(node.art || "")}" alt="" /></div>
        <div class="bubble">${esc(node.desc || "")}</div>
        <button class="btn pink" id="gb-next" type="button">繼續</button>`;
    } else if (phase === "dialogue") {
      const line = dlg[run.dlgPage | 0] || { speaker: "", line: "……" };
      body = `
        <div class="soft-panel"><b>${esc(line.speaker || "")}</b><div>${esc(line.line || "")}</div></div>
        <button class="btn pink" id="gb-next" type="button">${(run.dlgPage | 0) + 1 >= dlg.length ? "面對選擇" : "下一句"}</button>`;
    } else if (phase === "choose") {
      const ordered = gbChoiceOrder(node);
      body = `
        <div class="bubble">${esc(node.name || "")}——三選一（次序已隨機）</div>
        <div class="choice-col">
          ${ordered.map(({ c, i }) => `<button class="btn choice" type="button" data-ci="${i}">${esc(c.text || "")}</button>`).join("")}
        </div>
        <div class="soft-panel tiny">隱藏數值已接入；正式版不顯示數字。</div>`;
    } else if (phase === "outcome") {
      const pick = run.pendingChoice && run.pendingChoice.pick;
      const note = run.postBattleNote || "";
      body = `
        <div class="ribbon">戰後／後果</div>
        <div class="bubble">${esc((pick && pick.outcome) || note || "結案。")}</div>
        ${note && pick ? `<div class="soft-panel">${esc(note)}</div>` : ""}
        <button class="btn gold" id="gb-next" type="button">${run.pendingBattle ? "進入現場" : "結案繼續"}</button>`;
    } else {
      body = `<div class="bubble">…</div><button class="btn" id="gb-next" type="button">繼續</button>`;
    }
    root.innerHTML = `
      <div class="hud">
        <span class="chip year"><span class="dot"></span>${esc(node.name || "")}</span>
        <span class="chip soul"><span class="dot"></span>局內金幣 ${run.hidden ? (run.hidden.gold_run | 0) : 0}</span>
      </div>
      <div class="ribbon">你的保安，李步岸</div>
      ${body}
      <div class="btn-row">
        <button class="btn ghost" id="gb-stair" type="button">跳樓梯</button>
        <button class="btn ghost" id="gb-abort" type="button">中止本局</button>
      </div>
    `;
    const next = $("#gb-next", root);
    if (next) {
      next.onclick = () => {
        if (phase === "intro") {
          run.phase = dlg.length ? "dialogue" : "choose";
          run.dlgPage = 0;
        } else if (phase === "dialogue") {
          if ((run.dlgPage | 0) + 1 >= dlg.length) run.phase = "choose";
          else run.dlgPage = (run.dlgPage | 0) + 1;
        } else if (phase === "outcome") {
          gbAfterOutcomeContinue();
          return;
        }
        render();
      };
    }
    root.querySelectorAll("[data-ci]").forEach((btn) => {
      btn.onclick = () => gbResolveChoice(btn.getAttribute("data-ci") | 0);
    });
    $("#gb-stair", root).onclick = () => gbOpenStair();
    $("#gb-abort", root).onclick = () => {
      state.gbRun = null;
      state.screen = "home";
      render();
    };
  }

  function viewGbShop(root) {
    const run = state.gbRun;
    const pack = gbPack();
    const items = (pack && pack.accident_shop) || [];
    const gold = run && run.hidden ? (run.hidden.gold_run | 0) : 0;
    const rq = run && run.hidden ? (run.hidden.renqing | 0) : 0;
    root.innerHTML = `
      <div class="hud">
        <span class="chip year"><span class="dot"></span>夜班商店</span>
        <span class="chip soul"><span class="dot"></span>局內金幣 ${gold} · 人情 ${rq}</span>
      </div>
      <div class="ribbon">只收局內金幣</div>
      <div class="soft-panel" id="gb-shop-msg" hidden></div>
      <div class="choice-col">
        ${items.map((it) => {
          const needRq = (it.need_renqing | 0) > 0 && rq < (it.need_renqing | 0);
          const coffeeBlock = it.id === "shop_coffee" && run.shopCoffeeBought;
          const disabled = needRq || coffeeBlock || gold < (it.price | 0);
          const hint = needRq ? "（人情不足）" : coffeeBlock ? "（今晚已買）" : "";
          return `<button class="btn choice" type="button" data-shop="${esc(it.id)}" ${disabled ? "disabled" : ""}>${esc(it.name)} · ${it.price} 金幣${hint}</button>`;
        }).join("")}
      </div>
      <button class="btn gold" id="gb-shop-leave" type="button">離開商店</button>
    `;
    const msg = $("#gb-shop-msg", root);
    root.querySelectorAll("[data-shop]").forEach((btn) => {
      btn.onclick = () => {
        const err = gbShopBuy(btn.getAttribute("data-shop"));
        if (msg) {
          msg.hidden = false;
          msg.textContent = err || "已購入";
        }
        render();
      };
    });
    $("#gb-shop-leave", root).onclick = () => {
      run.phase = "intro";
      gbAdvanceChain();
    };
  }

  function viewGbEnding(root) {
    const run = state.gbRun || {};
    const ev = state.selectedEvent;
    const label = (ev && ev.name) || "結局";
    const desc = (ev && (ev.life_summary || ev.desc)) || "";
    const voice = (ev && ev.voice_line) || ((ev && ev.dialogue && ev.dialogue[0] && ev.dialogue[0].line) || "");
    root.innerHTML = `
      <div class="hud"><span class="chip year"><span class="dot"></span>結局</span></div>
      <div class="ribbon">${esc(label)}</div>
      <div class="pack-detail-art comic-frame"><img src="${esc((ev && ev.art) || "assets/story-packs/guard_baoan/portrait.jpg")}" alt="" /></div>
      <div class="bubble">${esc(desc)}</div>
      <div class="soft-panel"><b>李步岸</b><div>${esc(voice)}</div></div>
      <div class="soft-panel">${esc(run.rewardNote || "")}</div>
      <div class="btn-row">
        <button class="btn ghost" id="gb-end-blank" type="button">點空白繼續（不關）</button>
        <button class="btn gold" id="gb-end-ok" type="button">確認離開</button>
      </div>
    `;
    $("#gb-end-blank", root).onclick = () => {
      /* 故意分開：點空白不跳系統 */
    };
    $("#gb-end-ok", root).onclick = () => gbLeaveEnding();
  }

  function viewGbStair(root) {
    const run = state.gbRun || { stairStreak: 0 };
    const streak = run.stairStreak | 0;
    root.innerHTML = `
      <div class="hud">
        <span class="chip year"><span class="dot"></span>跳樓梯</span>
        <span class="chip soul"><span class="dot"></span>連跳 ${streak}</span>
      </div>
      <div class="ribbon">走火梯／後樓梯 · 不限時</div>
      <div class="bubble">連續跳過 15 次即算成功。同一局連續 100 次可領一次 100 膠幣。</div>
      <div class="soft-panel" id="gb-stair-msg">準備起跳</div>
      <div class="gb-stair-stage" aria-hidden="true">
        <div class="gb-stair-step"></div>
        <div class="gb-stair-step"></div>
        <div class="gb-stair-step"></div>
      </div>
      <div class="btn-row">
        <button class="btn pink" id="gb-stair-ok" type="button">跳上</button>
        <button class="btn ghost" id="gb-stair-fail" type="button">踩空（練習）</button>
      </div>
      <button class="btn ghost" id="gb-stair-leave" type="button">離開（連跳清零）</button>
    `;
    const msg = $("#gb-stair-msg", root);
    $("#gb-stair-ok", root).onclick = () => {
      // simple timing-less success with small miss chance if spam? Spec: player controlled — always can succeed
      const r = gbStairJump(true);
      if (msg) msg.textContent = r.msg;
      render();
    };
    $("#gb-stair-fail", root).onclick = () => {
      const r = gbStairJump(false);
      if (msg) msg.textContent = r.msg;
      render();
    };
    $("#gb-stair-leave", root).onclick = () => {
      if (run) run.stairStreak = 0;
      if (run && run.nodeId) {
        run.phase = "choose";
        state.screen = "gbAccident";
      } else {
        state.gbRun = null;
        state.screen = "storyPackDetail";
        state.storyPackDetailId = GB_PACK_ID;
      }
      render();
    };
  }

  function viewGbWheel(root) {
    gbEnsureDailyCaps();
    const a = gbEnsureAccount();
    root.innerHTML = `
      <div class="hud"><span class="chip soul"><span class="dot"></span>膠幣 ${state.soul|0}</span></div>
      <div class="ribbon">轉盤</div>
      <div class="bubble">首次 1 膠幣，其後每次 ×2；每日香港時間 00:00 重置為 1。</div>
      <div class="soft-panel">下一次費用：${a.wheelCost|0}</div>
      <div class="soft-panel" id="gb-wheel-msg" hidden></div>
      <div class="btn-row">
        <button class="btn gold" id="gb-wheel-go" type="button">轉動</button>
        <button class="btn ghost" id="gb-wheel-back" type="button">返回</button>
      </div>
    `;
    $("#gb-wheel-go", root).onclick = () => {
      const r = gbWheelSpin();
      const el = $("#gb-wheel-msg", root);
      if (el) { el.hidden = false; el.textContent = r.msg + (r.nextCost != null ? `（下次 ${r.nextCost}）` : ""); }
      render();
    };
    $("#gb-wheel-back", root).onclick = () => { state.screen = "home"; render(); };
  }

  function viewGbWelfare(root) {
    gbEnsureDailyCaps();
    const a = gbEnsureAccount();
    const today = gbHkDateKey();
    const signed = !!(a.welfare.signed && a.welfare.signed[today]);
    // last 6 days makeup list
    const days = [];
    for (let i = 1; i <= 6; i++) {
      const dt = new Date();
      // approximate HK by using hkDateKey base — generate from today string
      const base = new Date(today + "T12:00:00+08:00");
      base.setDate(base.getDate() - i);
      const k = base.toISOString().slice(0, 10);
      days.push(k);
    }
    root.innerHTML = `
      <div class="hud"><span class="chip soul"><span class="dot"></span>膠幣 ${state.soul|0}</span></div>
      <div class="ribbon">福利 · 每日簽到</div>
      <div class="bubble">每日隨機獎勵；補簽消耗 2 膠幣。膠幣／聲望受全日上限約束。</div>
      <div class="soft-panel" id="gb-wel-msg" hidden></div>
      <button class="btn gold" id="gb-wel-sign" type="button" ${signed ? "disabled" : ""}>${signed ? "今日已簽" : "今日簽到"}</button>
      <div class="soft-panel"><b>補簽（最近 6 日）</b>
        ${days.map((k) => {
          const done = !!(a.welfare.signed && a.welfare.signed[k]);
          return `<div class="btn-row"><span>${esc(k)}</span>
            <button class="btn ghost" data-makeup="${esc(k)}" type="button" ${done ? "disabled" : ""}>${done ? "已簽" : "補簽 2 膠幣"}</button></div>`;
        }).join("")}
      </div>
      <button class="btn ghost" id="gb-wel-back" type="button">返回</button>
    `;
    const flash = (m) => {
      const el = $("#gb-wel-msg", root);
      if (el) { el.hidden = false; el.textContent = m; }
    };
    $("#gb-wel-sign", root).onclick = () => { flash(gbWelfareSign(today, false).msg); render(); };
    root.querySelectorAll("[data-makeup]").forEach((btn) => {
      btn.onclick = () => { flash(gbWelfareSign(btn.getAttribute("data-makeup"), true).msg); render(); };
    });
    $("#gb-wel-back", root).onclick = () => { state.screen = "home"; render(); };
  }

  function viewGbDuties(root) {
    const duties = gbEnsureDuties();
    const a = gbEnsureAccount();
    const pool = gbDutyPool();
    const byId = Object.fromEntries(pool.map((d) => [d.id, d]));
    const slotNames = {
      slot_morning: "早更", slot_noon: "午更", slot_dusk: "黃昏更", slot_night: "夜更",
    };
    const doneRoutine = Object.keys(duties.slots || {}).filter((s) => {
      const id = duties.slots[s];
      return id && duties.status[id] === "done";
    }).length;
    const extraUnlocked = doneRoutine >= 2;
    root.innerHTML = `
      <div class="hud">
        <span class="chip year"><span class="dot"></span>海嵐峰今日排班</span>
        <span class="chip soul"><span class="dot"></span>膠幣 ${a.dailySoul|0}/8 · 聲望 ${a.dailyFame|0}/10</span>
      </div>
      <div class="ribbon">每日差事</div>
      <div class="choice-col">
        ${Object.keys(slotNames).map((slot) => {
          const id = duties.slots[slot];
          const def = byId[id];
          const st = duties.status[id] || "pending";
          const label = def ? def.name : "這一更暫未派出";
          const stLabel = st === "done" ? "已交更" : st === "abandoned" ? "本更缺勤" : "等候當值";
          return `<div class="soft-panel"><b>${slotNames[slot]} · ${esc(label)}</b>
            <div>${def ? esc(def.desc) : ""}</div>
            <div>${stLabel}${def ? ` · 應發 膠幣${(def.reward&&def.reward.soul)|0}／聲望${(def.reward&&def.reward.fame)|0}` : ""}</div>
            ${st === "pending" && def ? `<div class="btn-row">
              <button class="btn pink" data-duty="${esc(id)}" type="button">完成當值</button>
              <button class="btn ghost" data-abandon="${esc(id)}" type="button">放棄</button>
            </div>` : ""}
          </div>`;
        }).join("")}
        <div class="soft-panel"><b>臨時差事</b>
          ${!extraUnlocked ? "<div>完成兩件例行差事後解鎖臨時差事</div>" : ""}
          ${extraUnlocked && duties.extra ? (() => {
            const def = byId[duties.extra];
            const st = duties.status[duties.extra] || "pending";
            return `<div>${esc(def ? def.name : "")}</div><div>${esc(def ? def.desc : "")}</div>
              ${st === "pending" ? `<button class="btn pink" data-duty="${esc(duties.extra)}" type="button">完成臨時差事</button>` : st}`;
          })() : ""}
        </div>
      </div>
      <div class="soft-panel" id="gb-duty-msg" hidden></div>
      <button class="btn ghost" id="gb-duty-back" type="button">返回</button>
    `;
    const flash = (m) => {
      const el = $("#gb-duty-msg", root);
      if (el) { el.hidden = false; el.textContent = m; }
    };
    root.querySelectorAll("[data-duty]").forEach((btn) => {
      btn.onclick = () => { flash(gbCompleteDuty(btn.getAttribute("data-duty")).msg); render(); };
    });
    root.querySelectorAll("[data-abandon]").forEach((btn) => {
      btn.onclick = () => {
        if (!confirm("放棄後本更不會補派，亦不會獲得獎勵。確定放棄？")) return;
        gbAbandonDuty(btn.getAttribute("data-abandon"));
        render();
      };
    });
    $("#gb-duty-back", root).onclick = () => { state.screen = "home"; render(); };
  }

  /* patch helpers used by outer code — exposed on a namespace */
  window.__GB_ACCIDENT = {
    isAccidentPack,
    enter: gbEnterPackFromSelect,
    onBattleEnd: gbOnBattleEnd,
    ensureAccount: gbEnsureAccount,
    grantStarters: gbGrantStarters,
  };
