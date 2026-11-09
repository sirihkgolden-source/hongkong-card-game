#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Inject guard_baoan accident-chain pack data into data.js / data.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = "assets/story-packs/guard_baoan/cards"

BATTLE = [
    ("b01", "好言相勸", "勸導"), ("b02", "講明屋苑規定", "勸導"),
    ("b03", "請你配合一下", "勸導"), ("b04", "冷靜傾", "勸導"),
    ("b05", "護住通道", "護住"), ("b06", "護住同事", "護住"),
    ("b07", "人牆", "護住"), ("b08", "守住閘口", "護住"),
    ("b09", "核對證件", "核對"), ("b10", "核對單位", "核對"),
    ("b11", "核對訪客目的", "核對"), ("b12", "身份核對完成", "核對"),
    ("b13", "臨時封鎖", "封鎖"), ("b14", "拉起警戒帶", "封鎖"),
    ("b15", "封樓層口", "封鎖"), ("b16", "全面封鎖", "封鎖"),
    ("b17", "拍照存證", "存證"), ("b18", "錄下經過", "存證"),
    ("b19", "封存證物", "存證"), ("b20", "證據齊全", "存證"),
    ("b21", "引導改道", "引導"), ("b22", "帶離現場", "引導"),
    ("b23", "疏散通道", "引導"), ("b24", "安全路線", "引導"),
    ("b25", "通知管理處", "通報"), ("b26", "通知同事到場", "通報"),
    ("b27", "報警求助", "通報"), ("b28", "支援已到", "通報"),
    ("b29", "清走障礙", "清理"), ("b30", "清理現場", "清理"),
    ("b31", "清理完畢", "清理"), ("b32", "安撫住戶", "安撫"),
    ("b33", "安撫情緒", "安撫"), ("b34", "局面回穩", "安撫"),
]
BATTLE_FILES = {
    "b01": "b01-hao-yan.jpg", "b02": "b02-gui-ding.jpg", "b03": "b03-pei-he.jpg",
    "b04": "b04-leng-jing.jpg", "b05": "b05-hu-tong.jpg", "b06": "b06-hu-tongshi.jpg",
    "b07": "b07-ren-qiang.jpg", "b08": "b08-shou-zha.jpg", "b09": "b09-he-dui.jpg",
    "b10": "b10-he-danwei.jpg", "b11": "b11-he-fangke.jpg", "b12": "b12-shenfen-wan.jpg",
    "b13": "b13-feng-suo.jpg", "b14": "b14-jingjie-dai.jpg", "b15": "b15-feng-louceng.jpg",
    "b16": "b16-quanmian.jpg", "b17": "b17-pai-zhao.jpg", "b18": "b18-lu-xia.jpg",
    "b19": "b19-fengcun.jpg", "b20": "b20-zhengju-qi.jpg", "b21": "b21-gai-dao.jpg",
    "b22": "b22-dai-li.jpg", "b23": "b23-shu-san.jpg", "b24": "b24-anquan-luxian.jpg",
    "b25": "b25-tongzhi-guan.jpg", "b26": "b26-tongzhi-tongshi.jpg", "b27": "b27-bao-jing.jpg",
    "b28": "b28-zhiyuan.jpg", "b29": "b29-qing-zou.jpg", "b30": "b30-qingli-xian.jpg",
    "b31": "b31-qingli-wan.jpg", "b32": "b32-anfu-zhu.jpg", "b33": "b33-anfu-qingxu.jpg",
    "b34": "b34-jumian.jpg",
}
SKILL = [
    ("s01", "熟樓層", "巡邏、尋人、分層通知較有利。"),
    ("s02", "按程序", "程序類結算與相關戰鬥較有利。"),
    ("s03", "人情援護", "人情選項或同事支援較有利。"),
    ("s04", "抗壓", "減輕壓力上升或失利懲罰。"),
    ("s05", "調停", "安撫／鄰居衝突較有利。"),
    ("s06", "見證人", "存證、刮車、投訴見證較有利。"),
    ("s07", "閘口意識", "核對、拒檢、徘徊較有利。"),
    ("s08", "夜巡習慣", "夜巷、凌晨、後巷較有利。"),
    ("s09", "冷靜判斷", "降低選錯或混亂場額外壓力。"),
    ("s10", "雙人當值", "需同事在場的選項較穩。"),
    ("s11", "書面清楚", "日誌、投訴、突擊巡查較有利。"),
    ("s12", "危急優先", "水浸、火警隱患、報警較有利。"),
]
SKILL_FILES = {
    "s01": "s01-shu-louceng.jpg", "s02": "s02-an-chengxu.jpg", "s03": "s03-renqing.jpg",
    "s04": "s04-kang-ya.jpg", "s05": "s05-tiaoting.jpg", "s06": "s06-jianzheng.jpg",
    "s07": "s07-zhakou.jpg", "s08": "s08-yexun.jpg", "s09": "s09-lengjing-panduan.jpg",
    "s10": "s10-shuangren.jpg", "s11": "s11-shumian.jpg", "s12": "s12-weiji.jpg",
}
EQUIP = [
    ("e01", "手電筒"), ("e02", "對講機"), ("e03", "防水膠袋"), ("e04", "臨時路障牌"),
    ("e05", "急救貼"), ("e06", "筆記本"), ("e07", "印台"), ("e08", "乾淨手套"),
    ("e09", "職員證吊繩"), ("e10", "反光背心"), ("e11", "哨子"), ("e12", "保溫杯"),
]
EQUIP_FILES = {
    "e01": "e01-shoudian.jpg", "e02": "e02-duijiang.jpg", "e03": "e03-fangshui.jpg",
    "e04": "e04-luzhang.jpg", "e05": "e05-jijiu.jpg", "e06": "e06-bijiben.jpg",
    "e07": "e07-yintai.jpg", "e08": "e08-shoutao.jpg", "e09": "e09-zhengjian.jpg",
    "e10": "e10-fanguang.jpg", "e11": "e11-shaoyi.jpg", "e12": "e12-baowenbei.jpg",
}

# Verb → combat template (reuse body formulas; labels for 秩序／護盾／證據)
VERB_TMPL = {
    "勸導": dict(atk=11, spd=12, power="magic", support=False, dmg_mult=1.2, tags=["秩序"], basic="勸導", skill="局面緩和"),
    "引導": dict(atk=12, spd=13, power="magic", support=True, dmg_mult=0.9, tags=["秩序"], basic="引導", skill="帶離"),
    "安撫": dict(atk=10, spd=11, power="magic", support=True, heal_mult=0.6, dmg_mult=0, tags=["秩序"], basic="安撫", skill="回穩"),
    "護住": dict(atk=10, spd=9, power="phys", support=True, dmg_mult=0, tags=["護盾"], basic="護住", skill="守線"),
    "封鎖": dict(atk=11, spd=8, power="phys", support=True, dmg_mult=0.8, tags=["護盾"], basic="封鎖", skill="封口"),
    "核對": dict(atk=13, spd=11, power="phys", support=False, dmg_mult=1.3, tags=["證據"], basic="核對", skill="身份確認"),
    "存證": dict(atk=12, spd=10, power="phys", support=False, dmg_mult=1.4, tags=["證據"], basic="存證", skill="封存"),
    "通報": dict(atk=14, spd=12, power="magic", support=False, dmg_mult=1.5, tags=["證據"], basic="通報", skill="支援"),
    "清理": dict(atk=11, spd=12, power="phys", support=True, dmg_mult=1.0, tags=["秩序", "護盾"], basic="清理", skill="清場"),
}

HID = ("flag_noted", "pressure", "boss", "procedure", "favor", "renqing", "gold_run")


def d(**kwargs):
    """Hidden delta with all fields present (0 if omitted)."""
    out = {k: 0 for k in HID}
    out["flag_noted"] = False
    for k, v in kwargs.items():
        if k == "flag_noted":
            out[k] = bool(v)
        else:
            out[k] = int(v)
    return out


def choice(text, outcome, delta=None, battle=None, night_shop=False):
    c = {
        "text": text,
        "outcome": outcome,
        "hidden_delta": delta or d(),
    }
    if battle:
        c["battle"] = battle
    if night_shop:
        c["night_shop"] = True
    return c


def mk_event(eid, title, desc, dialogue, choices, *, kind="main", art=None, is_main=True):
    return {
        "id": eid,
        "name": title,
        "type": "story",
        "category": "story_pack",
        "category_label": "海嵐峰事故",
        "desc": desc,
        "dialogue": dialogue,
        "art": art or "assets/events/ev-gb-lobby-t409.jpg",
        "battle": None,
        "story_pack_id": "guard_baoan",
        "pack": "guard_baoan",
        "reward_soul": 0,
        "reward_xp": 0,
        "reward_gold": 0,
        "rewards_preview": "後果未知",
        "reward_blurb": "隱藏數值於結案結算",
        "accident_node": kind,
        "accident_main": bool(is_main),
        "accident_choices": choices,
        "office_node": None,
        "office_choices": None,
        "office_final": False,
        "tale_cast": [
            {"id": "baoan", "name": "李步岸", "line": "記清楚。寫清楚。交清楚。"},
        ],
    }


def build_events():
    events = []
    # --- Main 20 ---
    events.append(mk_event(
        "EV_GB_M01", "第一更",
        "海嵐峰大堂燈光好靚，保安室電風扇好嘈。隊長李步岸把登記簿推到你面前：上樓前，必須先登記證件。",
        [
            {"speaker": "李步岸", "line": "第一更。規矩同人情都要揀。記住：冇登記，唔放人上樓。"},
            {"speaker": "你", "line": "明白。先登記，後上樓。"},
        ],
        [
            choice("把守則抄進筆記本，反覆核對流程",
                   "你把「先登記後上樓」寫在頁首。李步岸瞄一眼，沒誇你，只把印章往你那邊推。",
                   d(procedure=2, boss=1, pressure=-1)),
            choice("先跟畢好彩打聲招呼，問今晚要注意邊戶",
                   "畢好彩塞你一粒糖：「擋小人。」你記住幾戶難搞單位，人情先欠一筆。",
                   d(favor=1, renqing=1, procedure=0)),
            choice("笑住應承，心想現場再睇",
                   "李步岸沒再多講。風扇轉了一圈，你覺得登記簿突然好重。",
                   d(pressure=1, boss=-1)),
        ],
        art="assets/events/ev-gb-corridor-t409.jpg",
    ))
    events.append(mk_event(
        "EV_GB_M02", "無證訪客",
        "有人說門卡壞了，急住要上樓取藥。證件卻沒有。閘口燈光把他影子拉得很長。",
        [
            {"speaker": "訪客", "line": "通融下啦，我住十五樓，卡壞咗。"},
            {"speaker": "李步岸", "line": "（對講機）先問清楚。唔好自己發明規矩。"},
        ],
        [
            choice("請住戶下來或視像確認，並完成登記後才放行",
                   "你按程序聯絡單位，登記完成才放行。訪客嘟嘴，但日誌乾淨。",
                   d(procedure=2, boss=1, pressure=1)),
            choice("好言相勸，請他等同事核對閉路片段",
                   "你把語氣放軟，對方願意等。畢好彩跑來幫忙看畫面。",
                   d(favor=1, procedure=1, renqing=1)),
            choice("先放行再補登記，省得嘈",
                   "他匆匆進升降機。半小時後管理處來電問名冊——你的名字也被記下一筆。",
                   d(flag_noted=True, boss=-2, procedure=-2, pressure=2), battle="E_GB01"),
        ],
    ))
    events.append(mk_event(
        "EV_GB_M03", "送餐趕時間",
        "外賣騎手／送餐員在閘口拍門：訂單逾時會被扣錢。他催你快啲放行。",
        [{"speaker": "送餐員", "line": "大哥通融下，超時要罰。"},
         {"speaker": "你", "line": "一定要臨時登記，唔可以省略證件核對。"}],
        [
            choice("完成臨時登記，核對送達單位後放行",
                   "你寫下暫留時間。送餐員走時對你點頭，大堂恢復安靜。",
                   d(procedure=2, favor=1, gold_run=1)),
            choice("請住戶到大堂領取，並在告示欄旁說明",
                   "住戶下樓取餐。你沒有省略登記，也沒有用廣播。",
                   d(procedure=1, boss=1, favor=1)),
            choice("省略證件，只記單位號碼",
                   "事後抽查發現缺頁。副隊長邱得根搖頭：「按程序，呢頁唔合格。」",
                   d(procedure=-2, boss=-1, pressure=1)),
        ],
    ))
    events.append(mk_event(
        "EV_GB_M04", "排更風波",
        "有人稱病請假，卻有人在茶水間說他在外看波。更表就放在你手邊。",
        [{"speaker": "麥峰", "line": "我當冇聽見啦……你想點？"},
         {"speaker": "邱得根", "line": "報告管理處？定私下勸退？"}],
        [
            choice("書面記錄並報告管理處",
                   "你把時間、證言寫清楚上呈。李步岸說：交更要乾淨。",
                   d(procedure=2, boss=2, favor=-1, renqing=-1)),
            choice("私下勸退，請他下次老實請假",
                   "對方臉紅，答應補更。人情保住，日誌只寫「已跟進」。",
                   d(favor=1, renqing=2, procedure=0, boss=0)),
            choice("裝作不見，當更照舊",
                   "風波暫時過去。你胸口卻像壓住一本空白的登記簿。",
                   d(pressure=2, boss=-1, renqing=1)),
        ],
    ))
    events.append(mk_event(
        "EV_GB_M05", "雪櫃風雲",
        "職員雪櫃裡的飯盒失蹤。有人要翻袋，有人要查閉路。基層同事站在一旁，氣氛刺耳。",
        [{"speaker": "畢好彩", "line": "唔好羞辱人啦……查閉路得唔得？"},
         {"speaker": "李步岸", "line": "查就查。唔好當笑點。"}],
        [
            choice("覆看閉路、書面記錄，不作公開羞辱",
                   "畫面顯示誤取。你請雙方私下和解，日誌寫明經過。",
                   d(procedure=2, favor=1, boss=1)),
            choice("請雙方茶水間和解，保溫人情",
                   "飯盒找回來。沒人當眾被嘲。麥峰遞你一杯水。",
                   d(favor=2, renqing=1, pressure=-1)),
            choice("設局試探，把人當笑料",
                   "笑聲很大，士氣很小。李步岸只說：下次唔好咁做。",
                   d(favor=-2, boss=-1, pressure=1, renqing=-1)),
        ],
        art="assets/events/ev-gb-room-t409.jpg",
    ))
    events.append(mk_event(
        "EV_GB_M06", "尋物夜",
        "孫婆婆說孫仔不見了。全大堂亂起來——結果是一隻龜。規程寫：非緊急勿離崗。",
        [{"speaker": "孫婆婆", "line": "佢識行……會唔會跌落去？"},
         {"speaker": "李步岸", "line": "失物登記。通知同事。唔好成個崗位走晒。"}],
        [
            choice("失物登記，對講機請同事分層協助",
                   "龜在花槽旁。你沒離崗亂跑，書面與通知都齊。",
                   d(procedure=2, favor=2, boss=1, gold_run=1)),
            choice("安撫婆婆，請她在大堂等，你守閘兼聯絡",
                   "她坐下飲水。你守住閘口，人情與崗位兩樣都在。",
                   d(favor=2, pressure=-1, procedure=1)),
            choice("自行離崗四處尋，閘口無人",
                   "龜找回來，但閘口空檔被投訴。壓力上來。",
                   d(pressure=2, boss=-1, favor=1, procedure=-1)),
        ],
    ))
    events.append(mk_event(
        "EV_GB_M07", "鄰居氣味",
        "兩戶要你表態邊邊啱。告示是工具不是武器；通知只能用告示欄或上門口頭，沒有廣播。",
        [{"speaker": "住戶甲", "line": "你話句公道話！"},
         {"speaker": "住戶乙", "line": "佢先唔啱！"}],
        [
            choice("張貼中性告示，並按樓層口頭知會相關單位",
                   "你沒選邊站。告示欄多了一張紙，走廊安靜了一點。",
                   d(procedure=2, favor=1, boss=1), night_shop=True),
            choice("帶雙方到大堂冷靜傾，嘗試調停",
                   "聲音降下來。你記下雙方陳述，不上廣播。",
                   d(favor=2, renqing=1, pressure=1), battle="E_GB02"),
            choice("偏幫大聲嗰邊，省得嘈",
                   "短期安靜，長期投訴。管理處留言要你解釋。",
                   d(favor=-1, boss=-2, pressure=2, renqing=-1), battle="E_GB02"),
        ],
    ))
    events.append(mk_event(
        "EV_GB_M08", "閉路失靈",
        "控制室故障。螢幕一片雪花。假裝沒事，不是選項。",
        [{"speaker": "邱得根", "line": "可以……寫「系統維護中」頂住？"},
         {"speaker": "李步岸", "line": "記錄。報告管理處。閘口加人。"}],
        [
            choice("書面記錄故障、報告管理處，並加強閘口人手",
                   "你把時間與範圍寫清楚。閘口加一人，漏洞收窄。",
                   d(procedure=2, boss=2, pressure=1)),
            choice("請同事幫手輪更監看閘口，人情換人手",
                   "畢好彩願意頂更。你欠他一頓宵夜。",
                   d(renqing=-1 if False else 0, favor=1, procedure=1, boss=1, pressure=1)),  # noqa — fix below
            choice("假裝正常，等下一更發現",
                   "翌日抽查。日誌空白處像一塊疤。",
                   d(flag_noted=True, boss=-3, procedure=-2, pressure=2)),
        ],
    ))
    # fix M08 choice2 delta properly
    events[-1]["accident_choices"][1]["hidden_delta"] = d(favor=1, procedure=1, boss=1, pressure=1, renqing=1)

    events.append(mk_event(
        "EV_GB_M09", "後巷怪聲",
        "後巷有聲——可能是貓，也可能是堆放的雜物。規程：護住通道、雙人當值，勿單獨莽闖。",
        [{"speaker": "麥峰", "line": "一齊去？定我喺度頂住？"},
         {"speaker": "李步岸", "line": "兩人。通道唔可以塞。"}],
        [
            choice("兩人同行檢查，清走障礙並記錄",
                   "是被吹倒的紙箱。通道恢復，日誌有頁。",
                   d(procedure=2, boss=1, pressure=-1, gold_run=1), night_shop=True),
            choice("先封鎖後巷口，再通知同事到場",
                   "你護住通道。支援到了才入內。",
                   d(procedure=1, favor=1, boss=1), battle="E_GB03"),
            choice("自己衝入查看，圖快",
                   "腳下差點絆倒。 Alone 的代價是壓力與責備。",
                   d(pressure=3, boss=-1, procedure=-1), battle="E_GB03"),
        ],
        art="assets/events/ev-gb-corridor-t409.jpg",
    ))
    events.append(mk_event(
        "EV_GB_M10", "裝修逾時",
        "打鑽聲超過許可時段。核對裝修紙、勸停、書面記錄——三樣都要。",
        [{"speaker": "裝修師傅", "line": "再半小時就完。"},
         {"speaker": "你", "line": "逾時要停，我要寫單。"}],
        [
            choice("核對許可、勸停打鑽、書面記錄並報告管理處",
                   "鑽聲停下。紙上有時間、單位與跟進。",
                   d(procedure=3, boss=2, favor=-1)),
            choice("好言相勸，給十分鐘收工，再寫記錄",
                   "對方收工。你仍寫單，語氣留有餘地。",
                   d(procedure=1, favor=1, renqing=1, boss=1)),
            choice("當作聽唔到，等投訴先算",
                   "投訴上來。你的名字出現在「當值未處理」。",
                   d(pressure=2, boss=-2, procedure=-2)),
        ],
    ))
    events.append(mk_event(
        "EV_GB_M11", "停車場刮車",
        "兩車相刮。你只見證存證，不裁決。拍照、錄下經過、封存記錄。",
        [{"speaker": "車主甲", "line": "你話邊個錯！"},
         {"speaker": "李步岸", "line": "我哋唔判。只記錄。"}],
        [
            choice("拍照存證、記車牌時間，請雙方自行報保險",
                   "你封存記錄。雙方仍嘈，但程序站得住。",
                   d(procedure=2, boss=1, favor=1, gold_run=2)),
            choice("安撫雙方到大堂冷靜，再補書面",
                   "聲音降下。印台蓋下去的一刻，大家都安靜。",
                   d(favor=2, procedure=1, pressure=-1)),
            choice("試圖裁決對錯，令場面更亂",
                   "兩人都怪你。壓力與上司分數一齊跌。",
                   d(pressure=2, boss=-2, favor=-1), battle="E_GB04"),
        ],
    ))
    events.append(mk_event(
        "EV_GB_M12", "渠塞水浸",
        "低層走廊見水。臨時封鎖、引導改道、報告管理處召喚維修。",
        [{"speaker": "住戶", "line": "我對鞋濕晒！"},
         {"speaker": "你", "line": "先封路，改道，再叫維修。"}],
        [
            choice("封鎖範圍、放置告示與路障，報告管理處",
                   "水勢受控。維修單已開。你沒有只口頭答應。",
                   d(procedure=3, boss=2, pressure=1, gold_run=1), night_shop=True),
            choice("引導住戶改道並安撫，同時請同事幫手",
                   "人情與程序並行。水聲變小。",
                   d(favor=2, renqing=1, procedure=1)),
            choice("口頭說會跟進，未寫單也未封路",
                   "水擴展到電梯大堂。記名風險上升。",
                   d(flag_noted=True, pressure=3, boss=-2, procedure=-3)),
        ],
    ))
    events.append(mk_event(
        "EV_GB_M13", "惡劣天氣",
        "掛波前後。加固雨擋、渠口、懸掛物。按樓層口頭提醒收回花盆；告示欄補充。無廣播。",
        [{"speaker": "畢好彩", "line": "我幫你行高層？"},
         {"speaker": "李步岸", "line": "告示欄。口頭。唔好幻想有廣播。"}],
        [
            choice("分層口頭提醒，告示欄補充，並檢查天台門",
                   "花盆收回來。日誌寫滿風雨準備。",
                   d(procedure=2, boss=2, favor=1, pressure=1)),
            choice("請同事幫手分樓，人情換效率",
                   "你們走完半座。風開始大。",
                   d(renqing=1, favor=1, procedure=1, boss=1)),
            choice("只在大堂喊幾句，圖快",
                   "高層無人知。事後投訴：點解唔通知。",
                   d(pressure=2, boss=-2, favor=-1, procedure=-1)),
        ],
    ))
    events.append(mk_event(
        "EV_GB_M14", "身份裂縫",
        "同事包內露出內部名冊。立即告知隊長、限期盯住，或幫忙隱瞞——後者可被記名。",
        [{"speaker": "同事", "line": "……你當冇見過得唔得？"},
         {"speaker": "你", "line": "名冊唔可以流出閘口。"}],
        [
            choice("立即告知隊長李步岸，並書面記錄",
                   "他收下名冊。你的手乾淨，程序站得住。",
                   d(procedure=3, boss=3, favor=-1, renqing=-1)),
            choice("限期盯住，要求對方交回並見證",
                   "對方交回。你做人留線，亦冇隱瞞到底。",
                   d(procedure=1, favor=1, renqing=1, boss=1, pressure=1)),
            choice("幫忙隱瞞，當無其事",
                   "抽查時名冊對不上。記名蓋在你頁上。",
                   d(flag_noted=True, boss=-3, procedure=-2, pressure=2, renqing=2)),
        ],
        art="assets/events/ev-gb-room-t409.jpg",
    ))
    events.append(mk_event(
        "EV_GB_M15", "大堂紛爭",
        "醉酒爭吵堵住閘口。先安撫與護住通道，必要時報警求助。",
        [{"speaker": "醉客", "line": "你阻住我！"},
         {"speaker": "李步岸", "line": "通道。先護住。"}],
        [
            choice("護住通道，安撫降溫，必要時報警",
                   "支援到場。大堂恢復通行。你的報告寫得很短、很清楚。",
                   d(procedure=2, boss=2, pressure=1, gold_run=2), battle="E_GB05"),
            choice("好言相勸，請同事到場雙人當值",
                   "人牆成形。對方坐下喝水。",
                   d(favor=2, renqing=1, procedure=1), battle="E_GB05"),
            choice("硬碰硬推人，場面失控",
                   "投訴與壓力一齊來。上司語氣冷。",
                   d(pressure=3, boss=-2, favor=-2), battle="E_GB05"),
        ],
    ))
    events.append(mk_event(
        "EV_GB_M16", "不審徘徊",
        "閘口外有人反覆徘徊。閘口意識、核對證件、通知同事到場。",
        [{"speaker": "徘徊者", "line": "我等朋友咋。"},
         {"speaker": "你", "line": "請出示證件，並說明來訪單位。"}],
        [
            choice("核對證件與目的，記錄並通知同事",
                   "對方出示證件後離開。閉路與書面都齊。",
                   d(procedure=2, boss=1, pressure=0), battle="E_GB01"),
            choice("保持距離觀察，對講機呼叫支援",
                   "支援到了。沒有單獨莽上。",
                   d(procedure=1, favor=1, boss=1), battle="E_GB01"),
            choice("喝令驅趕，不登記經過",
                   "人走了，紀錄也空了。管理處問細節時你答不出。",
                   d(pressure=2, boss=-1, procedure=-2)),
        ],
    ))
    events.append(mk_event(
        "EV_GB_M17", "垃圾房隱患",
        "垃圾房走火路被雜物擋住。清走障礙、檢查走火路；嚴重則封鎖並報告管理處。",
        [{"speaker": "麥峰", "line": "呢堆野……我當睇唔到？"},
         {"speaker": "你", "line": "走火通道唔可以塞。"}],
        [
            choice("清走障礙，檢查走火路，書面報告管理處",
                   "通道重開。你手套弄髒，日誌卻乾淨。",
                   d(procedure=3, boss=2, pressure=1, gold_run=1), night_shop=True),
            choice("臨時封鎖並請同事幫手清理",
                   "雙人當值，清理完畢。人情與安全都在。",
                   d(procedure=2, favor=1, renqing=1, boss=1)),
            choice("挪開一點就當完成",
                   "巡查指出仍阻塞。壓力上升。",
                   d(pressure=2, boss=-2, procedure=-2)),
        ],
    ))
    events.append(mk_event(
        "EV_GB_M18", "突擊巡查",
        "上司與管理公司突查日誌與登記簿。書面清楚者加分；缺頁者加壓力。",
        [{"speaker": "巡查", "line": "呢頁邊個簽？"},
         {"speaker": "李步岸", "line": "你自己答。"}],
        [
            choice("呈上完整登記與巡邏日誌，逐項對答",
                   "書面清楚。上司點頭，按程序分數上升。",
                   d(procedure=3, boss=3, pressure=-1)),
            choice("請隊長同席說明，補述人情脈絡",
                   "李步岸替你補一句。你仍交出原件。",
                   d(boss=2, favor=1, procedure=1, renqing=1)),
            choice("含糊其詞，把缺頁推給上一更",
                   "卸責被看穿。上司分數下跌。",
                   d(boss=-3, pressure=2, procedure=-1, favor=-1)),
        ],
    ))
    events.append(mk_event(
        "EV_GB_M19", "投訴升級",
        "住戶揚言停管理費。引導、書面、上呈；勿代管理處承諾。",
        [{"speaker": "住戶", "line": "你哋再唔處理我就停管理費！"},
         {"speaker": "邱得根", "line": "千祈唔好代人承諾豁免。"}],
        [
            choice("書面清楚記錄，引導至管理處，不上廣播",
                   "你沒有代承諾。投訴單連同時間線一併上呈。",
                   d(procedure=3, boss=2, favor=1), battle="E_GB04"),
            choice("先安撫情緒，再請住戶坐下寫陳述",
                   "聲音降下。人情保住，程序亦在。",
                   d(favor=2, renqing=1, procedure=1, pressure=-1)),
            choice("代管理處說可以通融豁免",
                   "對方錄音。你越權的話被呈上——記名邊緣。",
                   d(flag_noted=True, boss=-3, procedure=-2, pressure=2, favor=1)),
        ],
    ))
    events.append(mk_event(
        "EV_GB_M20", "換場之夜",
        "管理公司空降傳聞。簽名信在茶水間傳。此節權重較高，但仍經隱藏門檻結算。",
        [{"speaker": "畢好彩", "line": "簽唔簽？"},
         {"speaker": "李步岸", "line": "你自己揀。後果自己擔。"}],
        [
            choice("拒絕傳謠，按程序交更並報告管理處已知事實",
                   "你把傳聞與事實分開寫。大門仍在，日誌也在。",
                   d(procedure=3, boss=3, pressure=1, favor=-1), night_shop=True),
            choice("安撫同事情緒，但不簽名、不承諾",
                   "茶水間安靜下來。人情海嵐，程序未拆。",
                   d(favor=3, renqing=2, procedure=1, boss=1)),
            choice("帶頭簽名施壓，場面失控",
                   "信出了閘口。你的名字在最前——亦在記名欄。",
                   d(flag_noted=True, boss=-3, pressure=3, favor=2, renqing=2, procedure=-2), battle="E_GB05"),
        ],
    ))

    # --- Transitions 9 ---
    trans = [
        ("EV_GB_T01", "交更", "交接簿在燈光下發白。寫清楚本更閘口、巡邏與未完事項。",
         [choice("逐項寫明，字跡清楚移交", "下一更點頭接收。上司喜歡清楚的頁。", d(procedure=1, boss=1)),
          choice("請同事幫忙覆核一遍", "雙人過目，漏項少了。", d(favor=1, procedure=1)),
          choice("草草幾句交差", "字跡含糊，被要求重寫。", d(pressure=1, boss=-1, procedure=-1))]),
        ("EV_GB_T02", "告示欄", "告示欄是海嵐峰的喉嚨。這裡沒有廣播系統。",
         [choice("更新告示，並把副本放入各層信箱位", "通知到位，無需廣播。", d(procedure=1, favor=1)),
          choice("只更新大堂告示，口頭提醒經過住戶", "有人知道，有人不知道。", d(favor=1)),
          choice("懶得換紙，舊告示留住", "過期告示被投訴。", d(boss=-1, pressure=1))]),
        ("EV_GB_T03", "對講機測試", "對講機雜音大。備用電池可能在夜班商店。",
         [choice("測試各樓層頻道並記錄結果", "雜音位置寫進日誌。", d(procedure=1, boss=1), True),
          choice("向同事借電，答應稍後還", "人情＋1，機器暫時醒。", d(renqing=1, favor=1)),
          choice("當壞機，唔報", "關鍵時刻無聲。", d(pressure=1, procedure=-1))]),
        ("EV_GB_T04", "茶水間", "熱水瓶響。閒話與休息只隔一張檯。",
         [choice("靜靜飲水休息，降壓", "風扇聲變遠。壓力下降。", d(pressure=-1)),
          choice("聽閒話但唔傳，守住人情", "你知道多一點，嘴仍緊。", d(renqing=1, favor=1)),
          choice("加入議論某人私事", "笑聲換來隔閡。", d(favor=-1, pressure=1))]),
        ("EV_GB_T05", "大堂燈光", "玻璃大門把霓虹折進來。氣氛過渡，變動宜小。",
         [choice("巡視大堂角落，確認通道暢通", "角落乾淨。", d(procedure=1)),
          choice("跟住戶點頭打招呼", "有人記得你的姓。", d(favor=1)),
          choice("發呆到下一更", "沒事發生，也沒長進。", d())]),
        ("EV_GB_T06", "巡邏日誌", "由低層行到天台。熟樓層的人走得較穩。",
         [choice("按層記錄異常並口頭知會", "日誌與人情都有。", d(procedure=1, favor=1)),
          choice("重點檢查走火通道", "通道暢通。", d(procedure=1, boss=1)),
          choice("抄舊日誌充數", "被抽查時露餡。", d(boss=-1, procedure=-1, pressure=1))]),
        ("EV_GB_T07", "凌晨靜更", "鐘指住三點。夜巡習慣在腳步聲裡。",
         [choice("按路線夜巡，保持清醒", "靜更平安。", d(pressure=-1, procedure=1), True),
          choice("跟雙人當值的同事一齊行", "兩人影並排。", d(favor=1, renqing=1)),
          choice("偷睡一小時", "對講機響時你慢半拍。", d(pressure=1, boss=-1))]),
        ("EV_GB_T08", "管理處留言", "信封上寫：請當值閱後簽名。書面指示是加按程序的機會。",
         [choice("細讀、簽名、按指示執行", "程序分數微升。", d(procedure=2, boss=1)),
          choice("請隊長一齊看過再簽", "雙人確認，穩妥。", d(procedure=1, boss=1, favor=1)),
          choice("未讀先丟一旁", "翌日被問進度。", d(boss=-1, pressure=1, procedure=-1))]),
        ("EV_GB_T09", "雨夜閘口", "雨把訪客與送餐員都趕進大堂。閘口要更快，也要更準。",
         [choice("加快臨時登記，仍核對證件", "濕傘與名冊排成一行。", d(procedure=1, favor=1, gold_run=1)),
          choice("請送餐員排隊，安撫住戶", "秩序尚在。", d(favor=1, pressure=-1)),
          choice("雨大就放寬核對", "事後抽查缺頁。", d(procedure=-1, boss=-1, pressure=1))]),
    ]
    for eid, title, desc, chs in trans:
        # chs 已係 choice(...) 回傳的 dict 列表（可含 night_shop）
        events.append(mk_event(
            eid, title, desc,
            [{"speaker": "李步岸", "line": "過渡亦要寫清楚。"}],
            list(chs), kind="trans", is_main=False,
        ))

    # Endings
    endings = [
        ("EV_GB_END_A", "ending_a", "模範保安",
         "程序站得住，人情未把規矩拆掉。李步岸只說：交更清楚，就夠。",
         "做到呢步，已經唔簡單。"),
        ("EV_GB_END_B", "ending_b", "人情海嵐",
         "告示少了，打招呼多了；規矩未必最工整，但人還在。",
         "海嵐峰記得你個姓。"),
        ("EV_GB_END_C", "ending_c", "被記名／失職",
         "大門或許仍在，但日誌上有你的名字，或壓力把判斷壓垮，或上司不再撐你。",
         "……下次，寫清楚。"),
    ]
    for eid, key, label, desc, voice in endings:
        events.append({
            "id": eid,
            "name": label,
            "type": "story",
            "category": "story_pack",
            "category_label": "結局",
            "desc": desc,
            "dialogue": [{"speaker": "李步岸", "line": voice}],
            "art": "assets/story-packs/guard_baoan/portrait.jpg",
            "battle": None,
            "story_pack_id": "guard_baoan",
            "pack": "guard_baoan",
            "reward_soul": 0,
            "reward_xp": 0,
            "reward_gold": 0,
            "rewards_preview": "通關結算",
            "reward_blurb": "膠幣與殘頁於結局畫面發放",
            "accident_ending": key,
            "accident_node": "ending",
            "office_node": None,
            "office_ending": key,
            "voice_line": voice,
            "life_summary": desc,
        })
    return events


def build_fighters():
    out = []
    for i, (bid, name, verb) in enumerate(BATTLE):
        tier = (i % 4)  # 0..3 within verb groups roughly
        # better: position within same verb
        same = [x for x in BATTLE if x[2] == verb]
        tier = same.index((bid, name, verb))
        base = VERB_TMPL[verb]
        atk = base["atk"] + tier
        spd = base["spd"] + (tier // 2)
        f = {
            "id": f"GB_{bid.upper()}",
            "name": name,
            "rarity": ["普通", "普通", "稀有", "史詩"][min(tier, 3)],
            "slots": 4 + min(tier, 2),
            "tags": list(base["tags"]) + ["海嵐峰", "保安"],
            "atk": atk,
            "spd": spd,
            "basic": base["basic"],
            "skill": base["skill"],
            "skill_cd": 3,
            "art": f"{ART}/{BATTLE_FILES[bid]}",
            "flavor": f"海嵐峰當值卡・{verb}",
            "blurb": f"{verb}・{name}",
            "skill_effect": f"{verb}系效果（沿用本體同級結算）",
            "rarity_slang": "保安卡",
            "tod": "夜更閘口",
            "dmg_mult": base.get("dmg_mult", 1.0),
            "hits": 1,
            "target": "single",
            "power": base["power"],
            "pack_only": "guard_baoan",
            "gb_verb": verb,
            "gb_card_id": bid,
        }
        if base.get("support"):
            f["support"] = True
        if base.get("heal_mult"):
            f["heal_mult"] = base["heal_mult"]
        out.append(f)
    return out


def build_skills():
    out = []
    for sid, name, effect in SKILL:
        out.append({
            "id": f"GB_{sid.upper()}",
            "name": name,
            "tag": "保安",
            "tags": ["保安", "海嵐峰"],
            "cd": 3,
            "effect": effect,
            "kind": "招式",
            "blurb": effect,
            "art": f"{ART}/{SKILL_FILES[sid]}",
            "dmg_mult": 0.4,
            "hits": 1,
            "target": "single",
            "power": "magic",
            "rarity": "稀有",
            "pack_only": "guard_baoan",
            "gb_card_id": sid,
            "passive": True,
        })
    return out


def build_equipment():
    out = []
    slots = ["hand", "hand", "bag", "bag", "body", "hand", "hand", "hand", "body", "body", "hand", "bag"]
    for i, (eid, name) in enumerate(EQUIP):
        out.append({
            "id": f"GB_{eid.upper()}",
            "name": name,
            "slot": slots[i],
            "rarity": "common",
            "atk": 1 if i % 3 == 0 else 0,
            "def": 1 if i % 3 == 1 else 0,
            "hp": 2 if i % 3 == 2 else 1,
            "spd": 0,
            "tag_boost": None,
            "blurb": f"海嵐峰裝備・{name}",
            "flavor": "夜班可用。",
            "art": f"{ART}/{EQUIP_FILES[eid]}",
            "star": 1,
            "max_star": 5,
            "star_bonus_per_level": {"atk": 0, "def": 1, "hp": 1, "spd": 0},
            "source_id": f"GB_{eid.upper()}",
            "pack_only": "guard_baoan",
            "gb_card_id": eid,
        })
    return out


def build_enemies():
    return [
        {"id": "E_GB01", "name": "拒檢訪客", "stage": "閘口衝突", "hp": 90, "atk": 11, "spd": 10, "slots": 3,
         "notes": "秩序／證據", "art": "assets/enemies/E01.jpg", "flavor": "冇證件硬闖。", "blurb": "拒檢。",
         "event_type": "閘口", "rarity": "敵方", "rarity_slang": "現場對手",
         "tags": ["證據", "秩序"], "basic_power": "phys", "pack_only": "guard_baoan"},
        {"id": "E_GB02", "name": "鄰居爭執", "stage": "大堂紛爭", "hp": 100, "atk": 12, "spd": 11, "slots": 3,
         "notes": "秩序", "art": "assets/enemies/E02.jpg", "flavor": "兩戶要你表態。", "blurb": "爭執。",
         "event_type": "人情", "rarity": "敵方", "rarity_slang": "現場對手",
         "tags": ["秩序"], "basic_power": "magic", "pack_only": "guard_baoan"},
        {"id": "E_GB03", "name": "後巷陰影", "stage": "後巷", "hp": 110, "atk": 13, "spd": 12, "slots": 3,
         "notes": "護盾", "art": "assets/enemies/E03.jpg", "flavor": "通道唔可以塞。", "blurb": "後巷。",
         "event_type": "巡邏", "rarity": "敵方", "rarity_slang": "現場對手",
         "tags": ["護盾"], "basic_power": "phys", "pack_only": "guard_baoan"},
        {"id": "E_GB04", "name": "投訴現場", "stage": "見證", "hp": 120, "atk": 12, "spd": 10, "slots": 3,
         "notes": "證據", "art": "assets/enemies/E04.jpg", "flavor": "只見證，不裁決。", "blurb": "投訴。",
         "event_type": "文書", "rarity": "敵方", "rarity_slang": "現場對手",
         "tags": ["證據"], "basic_power": "magic", "pack_only": "guard_baoan"},
        {"id": "E_GB05", "name": "失控場面", "stage": "衝突升級", "hp": 140, "atk": 14, "spd": 11, "slots": 3,
         "notes": "秩序／護盾", "art": "assets/enemies/E05.jpg", "flavor": "先護住通道。", "blurb": "失控。",
         "event_type": "衝突", "rarity": "敵方", "rarity_slang": "現場對手",
         "tags": ["秩序", "護盾"], "basic_power": "phys", "pack_only": "guard_baoan"},
    ]


CHAIN = [
    "EV_GB_M01", "EV_GB_T01", "EV_GB_M02", "EV_GB_M03", "EV_GB_T09",
    "EV_GB_M04", "EV_GB_T04", "EV_GB_M05", "EV_GB_M06", "EV_GB_T02",
    "EV_GB_M07", "EV_GB_M08", "EV_GB_T03", "EV_GB_M09", "EV_GB_M10",
    "EV_GB_T06", "EV_GB_M11", "EV_GB_M12", "EV_GB_T05", "EV_GB_M13",
    "EV_GB_M14", "EV_GB_T07", "EV_GB_M15", "EV_GB_M16", "EV_GB_T08",
    "EV_GB_M17", "EV_GB_M18", "EV_GB_M19", "EV_GB_M20",
]

SHOP = [
    {"id": "shop_flash_batt", "name": "手電筒電池", "price": 8, "grant": ["GB_E01"], "temp": True},
    {"id": "shop_walkie_spare", "name": "對講機備用電池", "price": 10, "grant": ["GB_E02"], "temp": True},
    {"id": "shop_drybag", "name": "防水膠袋", "price": 6, "grant": ["GB_E03"], "temp": False},
    {"id": "shop_barrier", "name": "臨時路障牌", "price": 12, "grant": ["GB_E04"], "temp": False},
    {"id": "shop_colleague", "name": "請同事幫手", "price": 15, "grant": ["support"], "need_renqing": 1, "consume_renqing": 1},
    {"id": "shop_plaster", "name": "急救貼", "price": 5, "grant": ["GB_E05"], "temp": False},
    {"id": "shop_note_stamp", "name": "筆記本與印台", "price": 9, "grant": ["GB_E06", "GB_E07"], "temp": False},
    {"id": "shop_coffee", "name": "熱咖啡", "price": 3, "grant": ["coffee"], "night_limit": 1, "pressure": -1},
    {"id": "shop_gloves", "name": "乾淨手套", "price": 4, "grant": ["GB_E08"], "temp": False},
]

DUTIES = [
    {"id": "duty_gate", "name": "閘口當值", "pool": "both", "weight": 8, "reward": {"soul": 2, "fame": 2},
     "desc": "大堂閘口核對訪客證件、單位與來訪目的，完成書面登記後才可放行上樓。"},
    {"id": "duty_delivery", "name": "送餐臨時登記", "pool": "routine", "weight": 7, "reward": {"soul": 1, "fame": 1},
     "desc": "為外賣騎手／送餐員辦理臨時登記，核對送達單位與暫留時間。"},
    {"id": "duty_parcel", "name": "速遞暫存", "pool": "routine", "weight": 6, "reward": {"soul": 1, "fame": 1},
     "desc": "登記速遞件、核對收件單位與暫存櫃位置，請住戶到大堂領取。"},
    {"id": "duty_renovation", "name": "裝修許可核對", "pool": "both", "weight": 5, "reward": {"soul": 2, "fame": 1},
     "desc": "核對裝修紙、施工時段與保護墊。逾時打鑽須勸停，並書面記錄。"},
    {"id": "duty_patrol_floor", "name": "分層巡邏", "pool": "both", "weight": 8, "reward": {"soul": 2, "fame": 1},
     "desc": "由低層步行至天台，按樓層口頭知會當層異常，並寫入巡邏日誌。屋苑沒有廣播系統。"},
    {"id": "duty_carpark", "name": "停車場巡更", "pool": "routine", "weight": 6, "reward": {"soul": 1, "fame": 2},
     "desc": "核對車牌、處理阻路車輛，查看閉路死角。"},
    {"id": "duty_backlane", "name": "後巷與垃圾房", "pool": "both", "weight": 6, "reward": {"soul": 2, "fame": 1},
     "desc": "檢查後巷走火通道、垃圾房與擋鼠閘，清走障礙。"},
    {"id": "duty_lift", "name": "升降機大堂駐守", "pool": "routine", "weight": 5, "reward": {"soul": 1, "fame": 2},
     "desc": "駐守升降機大堂，協助長者及訪客，留意困梯警號。"},
    {"id": "duty_cctv", "name": "控制室監看", "pool": "both", "weight": 6, "reward": {"soul": 1, "fame": 2},
     "desc": "覆看閉路片段，標記可疑徘徊與閘口漏登記。"},
    {"id": "duty_notice", "name": "更新告示欄", "pool": "routine", "weight": 6, "reward": {"soul": 1, "fame": 1},
     "desc": "張貼於大堂告示欄；如須讓各層知悉，按樓層口頭通知。禁止以廣播代替告示。"},
    {"id": "duty_complaint", "name": "住戶投訴紀錄", "pool": "both", "weight": 5, "reward": {"soul": 2, "fame": 2},
     "desc": "以書面清楚記下投訴，並報告管理處。不得代管理處承諾豁免規定。"},
    {"id": "duty_lost", "name": "失物登記", "pool": "routine", "weight": 5, "reward": {"soul": 1, "fame": 2},
     "desc": "為拾獲物品做暫存與書面登記。非緊急不得離崗四處尋物。"},
    {"id": "duty_log", "name": "交更日誌", "pool": "routine", "weight": 7, "reward": {"soul": 1, "fame": 1},
     "desc": "把本更閘口、巡邏、投訴與未完事項寫清楚，移交下一更。"},
    {"id": "duty_fire", "name": "消防設備點檢", "pool": "both", "weight": 4, "reward": {"soul": 2, "fame": 2},
     "desc": "點檢滅火筒、走火路、警鐘與緊急照明。此項不是廣播測試。"},
    {"id": "duty_typhoon", "name": "惡劣天氣加固", "pool": "extra", "weight": 3, "reward": {"soul": 3, "fame": 2},
     "desc": "掛波前後檢查雨擋與天台門。逐層口頭提醒收回花盆，告示欄補充，不用廣播。"},
    {"id": "duty_water", "name": "渠塞或水浸初報", "pool": "extra", "weight": 3, "reward": {"soul": 3, "fame": 2},
     "desc": "先封路、放置告示與臨時路障牌，記錄範圍並報告管理處召喚維修。"},
    {"id": "duty_scrape", "name": "停車場刮車見證", "pool": "extra", "weight": 3, "reward": {"soul": 2, "fame": 3},
     "desc": "協助雙方拍攝現況。保安只見證與記錄，不裁決責任。"},
]


def build_pack():
    event_ids = CHAIN + ["EV_GB_END_A", "EV_GB_END_B", "EV_GB_END_C"]
    return {
        "id": "guard_baoan",
        "name": "你的保安，李步岸",
        "blurb": "海嵐峰大堂燈光好靚，保安室電風扇好嘈。隊長李步岸記齊住客樣貌，記唔齊自己幾時笑過。你第一更開始，規矩同人情就要揀邊邊。",
        "cover": "assets/story-packs/guard_baoan/cover.jpg",
        "portrait": "assets/story-packs/guard_baoan/portrait.jpg",
        "status": "available",
        "engine": "accident",
        "no_life_age": True,
        "event_ids": event_ids,
        "accident_chain": CHAIN,
        "accident_entry": "EV_GB_M01",
        "accident_endings": [
            {"id": "ending_a", "event": "EV_GB_END_A", "label": "模範保安",
             "blurb": "程序站得住，人情未把規矩拆掉。"},
            {"id": "ending_b", "event": "EV_GB_END_B", "label": "人情海嵐",
             "blurb": "告示少了，打招呼多了。"},
            {"id": "ending_c", "event": "EV_GB_END_C", "label": "被記名／失職",
             "blurb": "日誌上有你的名字，或壓力把判斷壓垮。"},
        ],
        "accident_shop": SHOP,
        "accident_starter_battle": [f"GB_B{str(i).zfill(2)}" for i in (1, 2, 5, 9, 13, 17, 21, 25, 29, 32)],
        "accident_starter_skill": [f"GB_S{str(i).zfill(2)}" for i in range(1, 9)],
        "minigame": "stair_jump",
        "roster_duties": DUTIES,
        "tale_cast_profiles": [
            {"id": "baoan", "name": "李步岸", "role": "隊長", "blurb": "古板盡責，毒舌有心。"},
            {"id": "lucky", "name": "畢好彩", "role": "同事", "blurb": "迷信轉運，常幫倒忙。"},
            {"id": "bee", "name": "麥峰", "role": "同事", "blurb": "能避則避，偶爾意外立功。"},
            {"id": "root", "name": "邱得根", "role": "副隊長", "blurb": "引經據典，擅長卸責。"},
            {"id": "plaza", "name": "海嵐峰", "role": "舞台", "blurb": "光鮮大門，狼狽後巷。"},
        ],
        "beats": [
            "只有從故事包選擇頁開始，才進入海嵐峰事故鏈。",
            "本包不使用今生歲數。開局挑選 5 戰鬥＋5 技能。",
            "循環：三選一→戰鬥→戰後→結案。隱藏數值全程結算。",
            "帶離只有卡冊擁有、殘頁、膠幣。首次通關 20，其後 5。",
        ],
    }


def main():
    data_json = ROOT / "data.json"
    data = json.loads(data_json.read_text(encoding="utf-8"))

    # Remove old GB office events
    old_ids = {e["id"] for e in data["events"] if str(e.get("story_pack_id") or e.get("pack") or "").startswith("guard_baoan") or str(e.get("id", "")).startswith("EV_GB_")}
    data["events"] = [e for e in data["events"] if e.get("id") not in old_ids]

    new_events = build_events()
    data["events"].extend(new_events)

    # Remove prior GB cards if re-run
    data["fighters"] = [f for f in data["fighters"] if not str(f.get("id", "")).startswith("GB_")]
    data["skills"] = [s for s in data["skills"] if not str(s.get("id", "")).startswith("GB_")]
    data["equipment"] = [e for e in data["equipment"] if not str(e.get("id", "")).startswith("GB_")]
    data["enemies"] = [e for e in data["enemies"] if not str(e.get("id", "")).startswith("E_GB")]

    data["fighters"].extend(build_fighters())
    data["skills"].extend(build_skills())
    data["equipment"].extend(build_equipment())
    data["enemies"].extend(build_enemies())

    packs = data["story_packs"]
    for i, p in enumerate(packs):
        if p.get("id") == "guard_baoan":
            packs[i] = build_pack()
            break
    else:
        packs.insert(0, build_pack())

    data["guard_baoan_meta"] = {
        "daily_soul_cap": 8,
        "daily_fame_cap": 10,
        "clear_soul_first": 20,
        "clear_soul_replay": 5,
        "wheel_prizes": ["fame5", "shards2", "battle1", "skill1", "equip1", "thanks"],
        "welfare_makeup_cost": 2,
        "stair_success": 15,
        "stair_hidden": 100,
        "stair_hidden_soul": 100,
    }

    text = json.dumps(data, ensure_ascii=False, indent=2)
    data_json.write_text(text + "\n", encoding="utf-8")
    (ROOT / "data.js").write_text("window.HK_SLICE_DATA = " + text + ";\n", encoding="utf-8")
    print("OK events", len(new_events), "fighters", len(build_fighters()), "chain", len(CHAIN))
    print("removed old", len(old_ids))


if __name__ == "__main__":
    main()
