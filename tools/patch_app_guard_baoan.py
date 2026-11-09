#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Patch app.js / styles / index for guard_baoan accident engine."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "app.js"
SNIP = ROOT / "tools" / "guard_baoan_engine_snippet.js"
CSS = ROOT / "styles.css"
INDEX = ROOT / "index.html"

MARKER = "  /* ========== guard_baoan accident-chain engine"
END_MARKER = "  window.__GB_ACCIDENT = {"


def main():
    app = APP.read_text(encoding="utf-8")
    snip = SNIP.read_text(encoding="utf-8")

    # Remove previous injection if present
    if MARKER in app:
        start = app.index(MARKER)
        # find end of snippet — after __GB_ACCIDENT block closing };
        end = app.find("  /* ---------- Screens ---------- */", start)
        # Actually insert before render; remove from marker to just before function render
        end = app.find("\n  function render() {", start)
        if end < 0:
            raise SystemExit("cannot find render() to bound old snippet")
        app = app[:start] + app[end + 1 :]  # keep leading newline before function render

    if "function render() {" not in app:
        raise SystemExit("render() missing")

    # Insert snippet before function render
    app = app.replace(
        "\n  function render() {",
        "\n" + snip + "\n  function render() {",
        1,
    )

    # poolFighters: exclude pack_only
    old_pool = """  function poolFighters() {
    return (DATA.fighters || []).filter((f) => f && f.id && !isShardOnlyFighter(f));
  }"""
    new_pool = """  function poolFighters() {
    return (DATA.fighters || []).filter((f) => f && f.id && !isShardOnlyFighter(f) && !f.pack_only);
  }"""
    if old_pool in app:
        app = app.replace(old_pool, new_pool, 1)

    # officeIntervalYears: accident packs never paced by life age
    old_iv = """  function officeIntervalYears(pack) {
    if (!pack) return 0;
    const n = pack.office_interval_years | 0;
    if (n > 0) return n;
    if (pack.id === "guard_baoan") return 7;
    return 0;
  }"""
    new_iv = """  function officeIntervalYears(pack) {
    if (!pack) return 0;
    if (pack.engine === "accident" || pack.no_life_age) return 0;
    const n = pack.office_interval_years | 0;
    if (n > 0) return n;
    return 0;
  }"""
    if old_iv in app:
        app = app.replace(old_iv, new_iv, 1)

    # bgMap + render map screens
    if 'gbAccident: "bg-soft"' not in app:
        app = app.replace(
            '      office: "bg-soft",\n      tale: "bg-soft",',
            '      office: "bg-soft",\n      gbPrep: "bg-team",\n      gbAccident: "bg-soft",\n      gbShop: "bg-soft",\n      gbEnding: "bg-result",\n      gbStair: "bg-soft",\n      gbWheel: "bg-home",\n      gbWelfare: "bg-home",\n      gbDuties: "bg-home",\n      tale: "bg-soft",',
            1,
        )
    if "gbAccident: viewGbAccident" not in app:
        app = app.replace(
            "      office: viewOffice,\n      tale: viewTale,",
            "      office: viewOffice,\n      gbPrep: viewGbPrep,\n      gbAccident: viewGbAccident,\n      gbShop: viewGbShop,\n      gbEnding: viewGbEnding,\n      gbStair: viewGbStair,\n      gbWheel: viewGbWheel,\n      gbWelfare: viewGbWelfare,\n      gbDuties: viewGbDuties,\n      tale: viewTale,",
            1,
        )

    # Pack detail start: accident engine
    old_start = """    if (startChain) {
      startChain.onclick = () => {
        // t369：tale 鏈優先（通用故事引擎，有角色弧線）
        if (isTaleChain) {"""
    new_start = """    if (startChain) {
      startChain.onclick = () => {
        if (isAccidentPack(pack)) {
          state.storyPackDetailId = pack.id;
          gbEnterPackFromSelect();
          return;
        }
        // t369：tale 鏈優先（通用故事引擎，有角色弧線）
        if (isTaleChain) {"""
    if old_start in app and "isAccidentPack(pack)" not in app.split("if (startChain)")[1][:400]:
        app = app.replace(old_start, new_start, 1)

    # isChainPack detection for accident
    # Find where isChainPack / isTaleChain computed in viewStoryPackDetail
    needle = "const isTaleChain = !!(pack.tale_chain && pack.tale_chain.length);"
    if needle in app and "isAccidentPack(pack)" not in app[app.find(needle):app.find(needle)+500]:
        app = app.replace(
            needle,
            needle + "\n    const isAccidentChain = isAccidentPack(pack);",
            1,
        )
    # Also treat accident as chain pack for start button
    old_chain = "const isChainPack = !!(isTaleChain || (pack.office_chain && pack.office_chain.length));"
    # try variants
    for cand in [
        "const isChainPack = !!(isTaleChain || (pack.office_chain && pack.office_chain.length));",
        "const isChainPack = isTaleChain || !!(pack.office_chain && pack.office_chain.length);",
    ]:
        if cand in app:
            app = app.replace(
                cand,
                "const isChainPack = !!(isTaleChain || isAccidentPack(pack) || (pack.office_chain && pack.office_chain.length));",
                1,
            )
            break

    # Soften pack detail spoilers for accident: hide endings until cleared
    # (handled lightly via existing endingsHtml — skip if complex)

    # Home side spin / welfare
    old_side = """    ["side-spin","side-welfare","side-path"].forEach((id) => {
      const el = $("#"+id, root);
      if (el) el.onclick = () => toast("這個位置尚未開放——請點選「舊帳」或「開始人生／繼續上次未完人生」繼續。");
    });"""
    new_side = """    const spinBtn = $("#side-spin", root);
    if (spinBtn) spinBtn.onclick = () => { state.screen = "gbWheel"; render(); };
    const welBtn = $("#side-welfare", root);
    if (welBtn) welBtn.onclick = () => { state.screen = "gbWelfare"; render(); };
    const pathBtn = $("#side-path", root);
    if (pathBtn) pathBtn.onclick = () => toast("人生路仍跟今世主線；本包事故鏈請由故事包進入。");
    // 差事：若已解鎖本包，主頁差事走海嵐峰排班
    const tabJobs2 = $("#tab-jobs", root);
    if (tabJobs2) {
      tabJobs2.onclick = () => {
        if (storyPackById(GB_PACK_ID) && storyPackById(GB_PACK_ID).status === "available") {
          state.screen = "gbDuties";
          render();
          return;
        }
        ensureDaily();
        state.screen = "missions";
        render();
      };
    }"""
    if old_side in app:
        app = app.replace(old_side, new_side, 1)

    # endBattle hook for gb run
    old_end = """    state.battleFieldSnapshot = null;
    state.factionSkirmish = false;
    if (tutorialLoss) {
      // 教學期敗：唔加歲／唔推遭遇；清選中事件，返回同年四揀一
      state.selectedEvent = null;
      state.deploy = [];
    } else {
      // 勝或畢業後敗：結算後年紀＋1
      advanceYear();
    }
    setTimeout(() => {
      state.screen = "result";
      render();
    }, 560 / state.speed);
  }"""
    new_end = """    state.battleFieldSnapshot = null;
    state.factionSkirmish = false;
    if (state.gbRun && state.gbRun.packId === GB_PACK_ID && state.gbRun.phase === "battle") {
      // 事故鏈戰鬥：唔加今生歲數，返回戰後文
      setTimeout(() => {
        gbOnBattleEnd(!!win);
        render();
      }, 560 / state.speed);
      return;
    }
    if (tutorialLoss) {
      // 教學期敗：唔加歲／唔推遭遇；清選中事件，返回同年四揀一
      state.selectedEvent = null;
      state.deploy = [];
    } else {
      // 勝或畢業後敗：結算後年紀＋1
      advanceYear();
    }
    setTimeout(() => {
      state.screen = "result";
      render();
    }, 560 / state.speed);
  }"""
    if old_end in app and "gbOnBattleEnd" not in app[app.find("function endBattle"):app.find("function endBattle")+2500]:
        app = app.replace(old_end, new_end, 1)

    # persist gbAccount / gbRun
    if "gbAccount: cloneObj(state.gbAccount" not in app:
        app = app.replace(
            "      lifeStarBonus: state.lifeStarBonus && state.lifeStarBonus.id\n"
            "        ? { kind: state.lifeStarBonus.kind === \"fighter\" ? \"fighter\" : \"gear\", id: String(state.lifeStarBonus.id) }\n"
            "        : null,\n"
            "    };",
            "      lifeStarBonus: state.lifeStarBonus && state.lifeStarBonus.id\n"
            "        ? { kind: state.lifeStarBonus.kind === \"fighter\" ? \"fighter\" : \"gear\", id: String(state.lifeStarBonus.id) }\n"
            "        : null,\n"
            "      gbAccount: cloneObj(state.gbAccount, null),\n"
            "      gbRun: cloneObj(state.gbRun, null),\n"
            "    };",
            1,
        )

    # load gbAccount
    if "if (data.gbAccount" not in app:
        # insert after storyPackUserPicked load-ish — find a stable anchor near end of loadGame assignments
        anchor = "      if (data.officePace && typeof data.officePace === \"object\") state.officePace = data.officePace;"
        if anchor in app:
            app = app.replace(
                anchor,
                anchor
                + "\n      if (data.gbAccount && typeof data.gbAccount === \"object\") state.gbAccount = data.gbAccount;\n"
                + "      if (data.gbRun && typeof data.gbRun === \"object\") state.gbRun = data.gbRun;",
                1,
            )

    # state defaults
    if "gbAccount: null," not in app:
        app = app.replace(
            "    officeRun: null,",
            "    officeRun: null,\n    gbRun: null,\n    gbAccount: null,",
            1,
        )

    # Pack detail blurb note for no age + hide beat spoilers lightly
    old_note = """        <div class="soft-panel pack-detail-note">${isChainPack
          ? "多分支故事：每步 2–3 個選擇，人物關係會影響對白與結局。中途不設獎賞，行到最後才知道結果。"
          : "故事包只是氣氛模組；進入故事後仍是命運／四揀一混其他類型，不會變成單一條直線劇。"}</div>"""
    new_note = """        <div class="soft-panel pack-detail-note">${isAccidentPack(pack)
          ? "事故鏈：三選一→戰鬥→戰後→結案。本包不使用今生歲數。開局須選 5 戰鬥＋5 技能。完成任一結局後才解鎖回想。"
          : (isChainPack
          ? "多分支故事：每步 2–3 個選擇，人物關係會影響對白與結局。中途不設獎賞，行到最後才知道結果。"
          : "故事包只是氣氛模組；進入故事後仍是命運／四揀一混其他類型，不會變成單一條直線劇。")}</div>"""
    if old_note in app:
        app = app.replace(old_note, new_note, 1)

    # Start button label for accident
    old_btn = """        ${isChainPack ? `<button class="btn gold" id="btn-pack-start-chain" type="button">${isTaleChain ? "由第一步開始（故事）" : `開始（${esc(pack.name)}）`}</button>` : ""}"""
    new_btn = """        ${isChainPack ? `<button class="btn gold" id="btn-pack-start-chain" type="button">${isAccidentPack(pack) ? "開始事故鏈（不計今生歲數）" : (isTaleChain ? "由第一步開始（故事）" : `開始（${esc(pack.name)}）`)}</button>` : ""}
        ${isAccidentPack(pack) ? `<button class="btn ghost" id="btn-pack-stair" type="button">跳樓梯</button>` : ""}"""
    if old_btn in app:
        app = app.replace(old_btn, new_btn, 1)

    # wire stair from pack detail
    if 'const stairBtn = $("#btn-pack-stair"' not in app:
        app = app.replace(
            '    $("#btn-pack-list", root).onclick = () => { state.screen = "storyPacks"; render(); };',
            '    $("#btn-pack-list", root).onclick = () => { state.screen = "storyPacks"; render(); };\n'
            '    const stairBtn = $("#btn-pack-stair", root);\n'
            '    if (stairBtn) stairBtn.onclick = () => { state.activeStoryPackId = pack.id; gbOpenStair(); };',
            1,
        )

    # Hide endings list for accident until cleared
    # Find endingsHtml construction — optional soft patch via replacing office endings display when accident
    # Skip if too fragile; pack.office_endings removed so endingsHtml likely empty.

    # fighterById rebuild — DATA already has cards; maps built at boot from DATA — OK

    # skills in life pool: filter pack_only from normal lifeSkills seed?
    # When album seeds skills, pack_only might appear — filter in ensureLifeSkills if needed later.

    APP.write_text(app, encoding="utf-8")
    print("patched app.js", APP.stat().st_size)

    # CSS
    css = CSS.read_text(encoding="utf-8")
    if ".card-grid .card-mini" not in css:
        css += """

/* guard_baoan accident UI */
.card-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 8px 0 16px; }
.card-grid .card-mini { display: flex; flex-direction: column; gap: 4px; padding: 6px; border: 1px solid rgba(255,255,255,.2); background: rgba(0,0,0,.35); color: inherit; border-radius: 8px; }
.card-grid .card-mini.selected { outline: 2px solid #f0c36a; }
.card-grid .card-mini img { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 4px; }
.card-grid .card-mini span { font-size: 11px; line-height: 1.2; }
.choice-col { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; }
.choice-col .btn.choice { text-align: left; white-space: normal; height: auto; padding: 12px; }
.gb-stair-stage { height: 120px; margin: 12px 0; background: linear-gradient(180deg, #1a2230, #0b1018); border-radius: 8px; position: relative; overflow: hidden; }
.gb-stair-step { position: absolute; left: 10%; right: 10%; height: 14px; background: #6b5a45; border: 1px solid #3e3428; }
.gb-stair-step:nth-child(1) { bottom: 18px; transform: translateX(0); animation: gbStep 1.6s ease-in-out infinite; }
.gb-stair-step:nth-child(2) { bottom: 48px; transform: translateX(12%); animation: gbStep 1.6s ease-in-out .2s infinite; }
.gb-stair-step:nth-child(3) { bottom: 78px; transform: translateX(24%); animation: gbStep 1.6s ease-in-out .4s infinite; }
@keyframes gbStep { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.25); } }
.soft-panel.tiny { font-size: 12px; opacity: .85; }
"""
        CSS.write_text(css, encoding="utf-8")
        print("patched styles.css")

    # cache bust
    idx = INDEX.read_text(encoding="utf-8")
    idx = idx.replace("t449-pages-1", "t450-guard-baoan-1")
    INDEX.write_text(idx, encoding="utf-8")
    print("cache bump t450-guard-baoan-1")


if __name__ == "__main__":
    main()
