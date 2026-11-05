# 香江小風波（hk-roguelite）

> **正式產品名：《香江小風波》**  
> 目錄暫名：`hk-roguelite/`（對外顯示名必須用《香江小風波》）  
> 狀態：完整三區（Act1 → Act2 → Act3 → 通關結算）・四角色  
> **這是全新遊戲，不是《香江 Card Game》續作。**

## 即刻玩

### 公開網址（GitHub Pages）

**<https://sirihkgolden-source.github.io/hongkong-card-game/hk-roguelite/>**

- 手機／桌面瀏覽器直接開，唔使安裝
- **零外部依賴**：字體用系統中文字體、圖全部喺 repo 內，弱網都開得快
- 建議用 390×844 直版（iPhone 12/13/14）睇，體驗最貼設計

### 本機（離線）

```bash
cd hk-roguelite
python -m http.server 8766
```

開 <http://127.0.0.1:8766/>（**唔好**直接雙擊 `index.html`——`file://` 下 ES module 會被瀏覽器 CORS 政策擋）。

> 想完全離線：斷網後開上面網址一樣玩得（已無任何 CDN 請求）。


## 產品定位

香港霓虹街頭卡牌 Rogue-lite：揀角色、組牌闖三區，一鋪一個傳奇——短、上癮、想再來一局。

- 世界：香港（街頭／城寨／夜市／天台）
- 完整路線：開局四揀一 → Act1「後巷・夜醒」→ **自動**進 Act2「旺角霓虹」→ **自動**進 Act3「城寨・天台」→ 最終 Boss **籠門之王** → 通關結算＋再來一局
- 未做：完整局外商城、名片分享實作、Act4

## 部署（GitHub Pages）

repo root 已設定 Pages（source: `main` 分支 `/`），所以 `hk-roguelite/` 直接可達：

| | URL |
|---|---|
| 遊戲 | <https://sirihkgolden-source.github.io/hongkong-card-game/hk-roguelite/> |
| 入口檔 | `hk-roguelite/index.html` |
| 資源 | `hk-roguelite/assets/…`（全部相對路徑） |

**唔使另開 `docs/` 或 `gh-pages`** —— 現有 root 部署已經覆蓋到子目錄，重複設定反而會多一份要同步嘅副本。

### 部署前自檢

```bash
cd hk-roguelite
node js/smoke-deploy.mjs
```

會檢查 257 項：本地引用檔案存在、**冇絕對路徑**（`/xxx` 在子目錄會 404）、**冇外部 CDN**、資料層 81 個 assets 都存在、CSS `url()` 冇外鏈、必要檔案齊。

### 離線可開（已達成）

- 字體：系統中文字體堆疊（PingFang HK／Microsoft JhengHei／Noto Sans CJK…），**零 Google Fonts 請求**
- 圖：全部喺 `assets/`，相對路徑
- 冇 `fetch()`／`import()` 遠端模組

> 之前用 Google Fonts，實測部署版仍會請求 `fonts.googleapis.com`；已移除，連 `preconnect` 都刪埋。

## 目錄結構

```
hk-roguelite/          ← 目錄暫名；產品名《香江小風波》
├── index.html         ← 新專案入口
├── css/
│   ├── main.css       ← 主樣式（直版優先）
│   └── landscape.css  ← 手機橫屏專用（三欄戰鬥／三欄地圖／橫排事件）
├── js/
│   ├── main.js        ← 畫面流程＋手感序列＋Act 銜接＋通關結算
│   ├── battle.js      ← 戰鬥（四角色被動）
│   ├── feel.js        ← 飛軌／飄字／震／色閃／被動橫幅
│   ├── sfx.js         ← 音效薄層（WebAudio 合成、靜音掣、無音檔）│   ├── storage.js     ← 本機存儲層（列出／清除進度，保留設定 key）
│   ├── tutorial.js    ← 新手教學記憶（首局彈一次）
│   ├── pause.js       ← 暫停／返標題（丟失清單計算，純函式）
│   ├── save.js        ← 存檔續玩（單份存檔、版本驗證）
│   ├── daily.js       ← 每日一局鉤（本機日期、每日只派一次）
│   ├── deckview.js    ← 牌組預覽（分組／排序／戰鬥守恆，純函式）
│   ├── carddetail.js  ← 長按卡詳情（人話效果＋幾時用，純函式）
│   ├── data.js        ← 角色／牌／敵／Act1–3 地圖／事件
│   ├── smoke-full.mjs ← 封測包（四角／分支／店／遺物／near-miss／再開一局）
│   ├── smoke-act2.mjs ← Act1–2 流程自測
│   ├── smoke-act3.mjs ← 三區全程＋最終 Boss 自測
│   └── probe-act3.mjs ← 最終 Boss 平衡探針（勝率／超時）
├── assets/            ← 自舊作複製的圖（enemies／skills／bg／events）
└── README.md
```

## 與舊《香江 Card Game》demo 的隔離

| 規則 | 做法 |
|------|------|
| 新專案路徑 | 本倉庫子目錄 `hk-roguelite/`（產品名《香江小風波》） |
| 新入口 | `hk-roguelite/index.html`（獨立於根目錄 `index.html`） |
| 禁止 | **不修改**倉庫根目錄舊 demo 的主循環／`index.html`／既有遊戲邏輯 |
| 舊作素材 | 僅**複製**進 `hk-roguelite/assets/` 再用於本切片；數值在 `js/data.js` 重表 |
| 禁止搬入 | office_chain／tale_chain、命運年／year_pools／過歲 UI、人生 meta |

## 遊戲內容

### 四角色（開局可揀）

| 角色 | 被動 | 一句 |
|------|------|------|
| 阿油・後巷經紀 | **快手** | 每第 3 張攻擊 → 下張攻擊 −1 費＋3 傷 |
| 阿珊・茶記夜更 | **檔口** | 每場首次捱打後立刻 **+8 擋** |
| 九哥・招牌工 | **招牌眼** | 每場首次打出技能牌 **抽 1** |
| 勝仔・跌打館學徒 | **跌打** | 每場首次打出技能牌，即刻 **回 4 HP** |

### 角色專屬牌（每角 3 張，共 12）

| 角色 | 專屬牌（開局必帶 ★） | 一句 |
|---|---|---|
| 阿油 | **追落街** ★／拆招牌／一鋪清袋 | 快手節奏：續航抽牌、標記、低血搏命 |
| 阿珊 | **落半閘** ★／絲襪奶茶／收爐 | 檔口本命：厚盾兼回血，捱得住 |
| 九哥 | **招牌著燈** ★／跳掣／掛滿霓虹 | 招牌眼本命：抽牌＋重標記 |
| 勝仔 | **跌打酒** ★／駁骨／藥油拳 | 跌打本命：邊打邊醫，愈拖愈唔死 |

- 專屬牌**只入自己角色**嘅選牌池，別角專屬牌永遠唔會出現
- 選牌加權：自己專屬 ×5 ＞ `rewardBias` ×2 ＞ 共用池 ×1；實測每抽三選一約 **77–80%** 見到至少一張專屬
- 共用池 `REWARD_POOL` 唔含任何專屬牌，避免漏出

### Act1「後巷・夜醒」（6 節點）

戰鬥 → 選牌 → 事件（池抽）→ 戰鬥 → 休息／便利店 → **Boss：巷口鐵閘・睇場**

### Act2「旺角霓虹」（6 節點）

戰 → 選牌 → 事件（池抽）→ 戰 → 休息／便利店 → **Boss：西裝收數隊**（E05）

### Act3「城寨・天台」（6 節點）

戰（紮鐵佬）→ 選牌 → 事件（池抽）→ **戰／精英**（清場沙包手／籠邊睇客，精英可抽 **地盤清場隊 E08**）→ 休息／便利店 → **最終 Boss：籠門之王**（E12）

### 事件池（每 Act 3 個短事件，行到先抽）

事件格**唔再綁死一個事件**：行到先由該 Act 池抽一個，抽定就記住（重繪／結果頁一致），地圖節點亦會顯示抽中嘅事件名。

| Act | 事件池 |
|---|---|
| 1 後巷 | 巷口風聲／**涼茶舖**／**排檔收工** |
| 2 旺角 | 彌敦道擦肩／**地鐵逼爆**／**招牌跌下來** |
| 3 天台 | 籠邊夜話／**天台晾衫**／**最後一支煙** |

- 全部 **三選一**，每個選項都**改局**（HP／最大生命／牌組／下戰能量／入場擋）
- **唔發死金**：事件永不改金幣，金幣只經小怪勝場入、便利店出
- 港味命名：涼茶舖、排檔收工、地鐵逼爆、招牌跌下來、天台晾衫、最後一支煙
- 自測每次各 Act 抽 200 次，確認池內每個事件都抽得到、選項 id 唯一、每個選項都改局

- 三段 Boss 全部勝後**同一局**自動接下一 Act（保留牌組／HP／金幣）
- 最終 Boss 打贏 → **通關結算**：遭遇清單、牌組構成、名片 stub、「再來一局」
- 每段 Boss 戰前強制停一句大字＋按鈕：
  - Act1：「呢條巷我睇場。生面孔，先過我呢關。」
  - Act2：「月光底落數。散水定散骨，你揀。」
  - Act3：「天台無燈。今夜邊個落場，邊個落地。」
- 事件必改局（改牌／HP／下戰能量／擋），唔發死金；金幣有便利店出口

### 遺物（8 件）＋士多

| 遺物 | 效果 | 稀有 |
|---|---|---|
| **鐵閘鎖匙** | 每場開場 **+1 能量** | 普通 |
| **地盤安全帽** | 每場開場自帶 **8 擋** | 普通 |
| **麻雀檯燈** | 每場首回合**多抽 1 張** | 稀有 |
| **紅白藍袋** | 每場勝場**回 5 HP** | 普通 |
| **茶記賬簿** | 小怪勝場**額外 +3 金** | 普通 |
| **霓虹燈膽** | 所有攻擊 **+2 傷害** | 稀有 |
| **跌打酒** | 入手即刻**最大生命 +10**（並回 10） | 普通 |
| **觀音借庫** | 入手即刻 **+20 金幣** | 稀有 |

**便利店（士多）可買可賣**：
- 買・遺物 **14 金**（每次入店抽 2 件未擁有嘅貨）
- 買・回血 6 金／12 HP、買・執牌 8 金
- **賣・遺物 +6 金**（即時型遺物會扣返對應最大生命）
- **賣・牌組 +4 金**（牌組 −1 張，列重複度最高嘅 4 款）
- 「離開」按鈕先推進地圖，可以連續買賣幾次

> 買／賣都真係改局：遺物效果直接接入戰鬥（開場能量／擋／抽牌／攻擊加成）同勝場結算（回血／額外金）。

### 打擊感層

出牌縮卡→飛軌→落點閃／kickback→傷害上飄；受擊預示＋紅閃；被動橫幅；單次攻擊總延遲 ≤350ms

### 音效薄層（無音檔，WebAudio 即時合成）

全遊戲**冇一個 .mp3／.wav**——所有聲都係 `OscillatorNode` 即時砌，零檔案、零外部請求。

| 時機 | 音效 | 聲音設計 |
|---|---|---|
| 出牌 | `sfx.card()` | 760Hz → 560Hz 兩個短 square，似「甩牌」 |
| 受傷 | `sfx.hurt()` | 120Hz → 78Hz sawtooth 下沉，似被打中 |
| 金幣 | `sfx.coin()` | 1180Hz → 1560Hz 兩粒 triangle，似「叮噹」 |
| 通關 | `sfx.clear()` | C-E-G-C 四粒上行大調，最後一粒長 170ms |

- **音量預設低**：`MASTER_GAIN = 0.42`，再乘每個音本身 gain（0.03–0.062）；全部經同一個 master gain 節點，一次過調
- **每粒音都有包絡**：6ms 起音 → 指數衰減，避免「噗」聲同爆音
- **靜音掣**：標題頁／選角頁／戰鬥頁都有，44px 高，`localStorage` key `hk_sfx_muted`，重開機都記得
- **靜音時完全唔開 AudioContext**（連 oscillator 都唔建），省電
- **無 AudioContext 環境**（舊瀏覽器／Node 自測）→ 靜靜降級，唔 throw

預覽請用本機靜態伺服器（見上）。瀏覽器政策要求**首次用戶互動**後才可出聲，所以入場撳第一下（例如「進入選角」）之後音效才會響——呢個係正常，唔係壞。

### 設定頁（靜音記憶＋清除進度）

標題頁「設定」入 → `screen: settings`。入面只有兩件事，但兩件都要可靠：

**① 音效開關（記住）**

- 狀態寫入 `localStorage`（key `hk_sfx_muted`），**重開瀏覽器仍然生效**
- 撳掣即刻反映：圖示 🔇／🔊、文案「音效：關／開」、`aria-pressed`、`is-muted` class 四樣同步
- 由 `sfx.js` 嘅 `isMuted()`／`toggleMuted()` 單一來源驅動，唔會出現「UI 話關但其實有聲」

**② 清除本機進度（要撳兩下）**

| 步驟 | 會發生咩 |
|---|---|
| 撳「清除本機進度」 | **只係問**，彈紅色確認區，列出將會清走邊幾個 key。**資料完全冇動** |
| 撳「係，清除」 | 真係清，只清 `hk_` 前綴嘅**進度** key |
| 撳「唔好，取消」 | 回上一步，資料完好，提示「冇清到任何嘢。」 |

- **音效設定一定保留**（`SETTING_KEYS` 白名單），唔會清完進度連靜音都冇埋
- **唔會碰其他 App 嘅 key**（嚴格 `hk_` 前綴）
- 冇進度時掣**禁用**，文案講明「（冇進度可清）」
- 每次入設定頁都由「未確認」開始，唔會殘留上次嘅紅色確認區
- 清除後有回饋：「已清除 N 項本機進度。音效設定保留。」

### 新手教學（首局一頁，可跳過）

標題撳「進入選角」→ **第一次**會先彈教學頁（`screen: tutorial`），之後唔會再彈。

一頁講清三件事，每件一句港味 + 一句實際操作：

| # | 教咩 | 對應實機 UI |
|---|---|---|
| 1 | 出牌 | 手牌喺最底、撳一張就打出、左上角係費用 |
| 2 | 擋 | 擋喺敵人回合幫你食傷、敵人頭上寫住今回合想打幾多 |
| 3 | 結束回合 | 撳「結束回合」敵人出手、之後重新抽牌回滿⚡ |

- 兩個掣：**「明白，開始」**（主掣）同 **「跳過教學」**，兩條路一樣（都係記住 + 入選角）
- 記憶寫 `localStorage` key `hk_tutorial_seen`（值固定 `"1"`），重開瀏覽器仍然唔彈
- **只有精確 `"1"` 才算睇過**——其他怪值都當未睇，寧願教多一次都唔好漏教
- 教學記憶屬**進度類**：設定頁「清除本機進度」會一併清走，清完再開就當第一次玩（清進度＝重新開始，合理）
- 冇 `localStorage`（私隱模式）→ `hasSeenTutorial()` 回 `false`，每局都教，唔會崩

### 暫停／返回標題

**地圖**同**戰鬥**都有暫停掣（`65×44px`，`aria-label="暫停"`）：

| 畫面 | 位置 |
|---|---|
| 地圖 | 狀態列右上角（`margin-left: auto`） |
| 戰鬥 | 同「結束回合」並排（**唔會遮敵人立繪或手牌**，實測 `overlap: false`） |

暫停頁三件事：

1. **繼續** —— 原畫面原狀態返去，`battle`／`run` 完全唔重算（實測暫停再繼續 HP 68→68，戰鬥物件仍在）
2. **返回標題** —— 要**二次確認**
3. **設定** —— 由暫停入設定，個掣會變「**返暫停**」，撳完返暫停頁而唔係標題（避免唔覺意丟局）

**丟失清單逐項對得上真實數值**（`js/pause.js` 純函式，smoke 直接測）：

```
Act1 打到第 1／6 格
HP 68／68
12 個大洋
10 張牌
2 件遺物   ← 冇遺物時唔會出現（唔灌水）
```

警告句：「返標題會幫你存起呢一局（Act1 第 1／6 格），下次撳『繼續』返得嚟。」

> **第八輪加咗存檔後，呢句文案已同步改**：唔會再講「冇得續」（嗰句係第七輪未有存檔時嘅講法，已作廢）。改動有 smoke 斷言守住——`pauseLossLine()` 必須提「存起」或「繼續」，而且**唔可以**含「冇得續」。

二次確認實測：第一次撳只彈紅色確認區（`run` 仍在、**存檔亦在**）→ 取消後局況完好 → 確認後返標題、`run: null`，但**存檔保留**，標題頁隨即出現「繼續」。

### 存檔續玩（本機單份）

每次畫面更新都自動存一次（`autoSave()`），key `hk_run_v1`。

**存咩**（白名單，JSON 可序列化）：

| 欄位 | 內容 |
|---|---|
| `characterId` | 角色 |
| `act`／`mapIndex`／`completed` | Act、節點、已完成節點 |
| `deck`／`relics` | 牌組、遺物 |
| `hp`／`maxHp`／`gold` | 血、金 |
| `encounters`／`nodeEnemies`／`nodeEvents` | 遭遇記錄、該格抽定嘅敵人／事件（重入要一致） |
| `nextBattleEnergyPenalty`／`Bonus`／`Block` | 跨場加成（唔存就等於食咗玩家嘅遺物效果） |
| `v`／`at` | 格式版本、時間戳 |

**刻意唔存**：進行中戰鬥嘅 `hand`／`energy`／`intent` —— 戰鬥係即時運算，中途存會令回合數對唔上，所以一律由該節點重入。

**驗證**（`validateSave`，任何一項唔過就當冇存檔）：

- `v` 要對版本（防舊格式爆）
- `characterId` 要存在於現有角色（防角色被移除）
- `act` 1–3、`mapIndex ≥ 0`、`maxHp > 0`、`deck` 非空

**生命週期**：

| 時機 | 存檔 |
|---|---|
| 每次 render（有 run） | 自動寫 |
| 戰鬥中 | 照存（標記 `screen: "battle"`，重入回地圖由該節點打） |
| 暫停 → 返標題 | **保留**（可以續） |
| 通關／敗北 | **清走**（局已完，唔應該再出「繼續」） |
| 新局覆蓋（確認後） | **清走**，並同時清 `state.run` |

> `autoSave()` 對 `victory`／`defeat` 有 guard，否則結算頁一 render 就會把已完嘅局寫返存檔。

### 每日一局鉤（本機日期）

key `hk_daily_v1`。規則好薄：

- 每日**第一次完局**（通關或失敗都算）派 **1 個**獎勵
- 同日再完局**唔會**再派（結算頁連 panel 都唔出，唔會日日彈同一個）
- 獎勵輪換兩種：
  - **金幣**：下一局開局 +6／+8／+10（實測 6 金 → 開局 12 → **18**）
  - **名片句**：一句港味短句（收藏性質，唔影響數值）
- 邊個獎勵由**日期字串 hash** 決定 —— 同一天永遠同一個，唔會重開就變

**日期用本機時間**，唔用 `toISOString()`：

```js
const y = d.getFullYear();
const m = String(d.getMonth() + 1).padStart(2, "0");
const day = String(d.getDate()).padStart(2, "0");
return `${y}-${m}-${day}`;
```

> 呢個唔係小事：`toISOString().slice(0,10)` 係 **UTC**，香港玩家凌晨 00:30 打機會被算成**前一日**。smoke 有斷言守住（用 `new Date(2026,10,6,0,30)` 測，UTC 版會變 `2026-11-05`）。

**標題頁狀態**（`.daily-line`，44px 高）：

| 狀態 | 文案 | 色系 |
|---|---|---|
| 今日未領 | 今日未領——打一局（贏輸都計）就有。 | 琥珀 |
| 今日已領（金） | 今日已領：下局 +N 金。 | 灰綠 |
| 今日已領（句） | 今日已領：一句名片句。 | 灰綠 |

**金幣發放時機**：結算時只寫入 `pendingGold`，真正加落去係**下一局開局**（`createRun()` 讀 `consumePendingGold()`，攞完即清）。因為結算時局已經完，加落去冇意思；亦避免重複派。

實測：`pendingGold 6` → 開新局 `gold 18`（12+6）、`run.dailyBonusGold 6`、`pendingGold` 變 0。

### 牌組預覽（選角 / 戰鬥）

`js/deckview.js` 係純函式（唔讀 DOM／localStorage），smoke 可以直接測。

**兩個入口**：

| 位置 | 掣 | 展開後 |
|---|---|---|
| 選角頁 | 「睇 starter 牌組 N 張」 | 該角色 starter 清單（預設收起） |
| 戰鬥中 | 「睇成副牌組 N 張」 | 抽牌堆 + 手牌 + 棄牌堆全部計 |

**點解唔用卡面圖**：10 幾張卡面圖喺 390 會撐爆版面、又要 load 一堆圖。預覽改用「一眼睇數」清單：`費用圓章 ｜ 名 ｜ 類型 ｜ ×N`。

**排序規則**（刻意固定，唔靠 Object 插入序）：

1. 攻擊 → 技能（同類聚埋，一眼睇比例）
2. 同類內按費用升序
3. 同費按牌名（`localeCompare("zh-Hant")`）

**重複牌合成一行 ×N**，例如阿油 starter 10 張 → 6 行：

```
共 10 張 · 攻擊 9 張 · 技能 1 張 · 平均 0.4 費
0  後巷抹油   攻擊  ×3
0  追落街     攻擊  ×1
0  椒鹽補刀   攻擊  ×2
1  油星飛濺   攻擊  ×1
1  廊燈直拳   攻擊  ×2
1  萬年船     技能  ×1
```

**戰鬥中點解要計晒三個堆**：只計 `drawPile` 嘅話，抽咗牌個數就會跌，玩家會以為牌組縮水。`battleDeckIds()` 加埋 hand + discard，smoke 有守恆斷言（出牌前後總數不變）。

### 長按卡牌睇詳情（手機為主）

卡面本身只有短標（「傷 5／盾 3」），**撳住 0.42 秒**會彈詳情：完整人話效果 + 一句「幾時用」+ flavor。

| 操作 | 結果 |
|---|---|
| 撳一下 | 正常出牌 |
| **撳住 0.42 秒** | 彈詳情，**唔會出牌** |
| 撳「知道」／撳背景 | 關閉 |
| 桌機右鍵 | 都當睇詳情 |

**手指郁多過 10px 就取消長按** —— 否則玩家想捲頁睇手牌會被誤判。

詳情內容由 `js/carddetail.js` 砌（純函式）：

```
0  後巷抹油  攻擊・普通
・造成 5 點傷害。
・免費牌，有得打就打，唔會蝕。
「抹一手油，先出手為敬。」
```

- 有 `dmgBonusOnLowHp` 嘅牌會特別講「你自己半血以下時，額外 +N 傷」
- 有 `mark` 嘅牌會講「敵人下個回合再多痛 N」
- 冇數值效果嘅牌都有句「冇即時數值效果——多數係舖路或者觸發被動」
- 「幾時用」按牌型分流（重拳／擋／回血／抽牌／免費牌各有講法）

**兩個實作陷阱（已修）**：

1. 彈層掛喺 `body`（唔可以掛 `.screen`，會被 `patchScreen` 沖走），但 `onClick` 只綁 `#app` → 詳情層嘅「知道」撳唔到。加咗 document 層捕獲階段監聽。
2. 長按放手會補一個 `click` → 會誤出牌。`onClick` 開頭加 guard：有詳情就當關閉，但**詳情層內部**嘅撳法要放行。

### 設定頁「點玩（操作一句）」

設定頁加一節，三條一句話：

1. **撳牌就出牌；撳住牌 0.4 秒睇詳情（唔會出牌）。**
2. 敵人頭上寫住今回合想打幾多——睇清楚先決定擋定打。
3. 冇牌打就撳「結束回合」，敵人出手，之後重新抽牌回滿⚡。

### 三頁一屏（地圖／事件／戰果）

目標：390×844 下**唔使上下拉**都操作得到。

| 頁 | 改前超出 | 改法 | 改後 |
|---|---|---|---|
| 地圖 | **+198px** | `.map-list` 單欄 flex → **兩欄 grid**（6 格 → 3 行）；節點 padding 收緊 | **0px** |
| 事件 | 0（本身 OK） | 保持；選項卡 75px 高、3 個全在屏內 | 0px |
| 戰果 | **+593px** | 遺物／遭遇／牌組／名片收進 `<details>`；底欄獨立掛 body | 0px（內容仍可拉，但**主掣唔使拉**） |

**大掣固定可見（踩過兩個坑）**

1. 先試 `position: sticky` → 實測 actions `top: 922`（仍喺屏外）。**sticky 只喺容器高度內生效**，內容一長過視口就被推走。
2. 改 `position: fixed` 放喺 `.screen-result` 入面 → 實測 `bottom: 854 > 844`（超出 10px）。

   根因：`.screen-result.is-lose` 有 `filter: saturate(...)`、`.is-win` 有 `animation` —— **兩者都會令該元素成為 fixed 子元素嘅包含塊**，fixed 就唔再對齊視口。

   修法：底欄由 `renderResultBar()` **直接掛 `body`**，唔留喺 `.screen` 入面。

**戰果頁細節收納**

```html
<details class="result-details">
  <summary class="result-details-summary">睇本局細節（遺物／遭遇／牌組／名片）</summary>
  ...
</details>
```

- 預設收起 → 主掣同 summary 都喺屏內
- summary `min-height: 48px`、自訂箭頭（隱藏 `::-webkit-details-marker`，各瀏覽器一致）
- `.screen-result` 加 `padding-bottom: 9rem`，否則最後一段被 fixed 底欄蓋住
### 戰鬥手牌一屏（390）

**問題**：改之前 390×844 下 `docH = 981`（要拉 137px 才見到「結束回合」），手牌區竟然佔 **390px** —— 因為 `.hand` 用 `grid auto-fill minmax(118px)`，5 張牌在 376 寬下只能放 3 張，換行變 2 行。

**四項改動**：

| 問題 | 改法 | 效果 |
|---|---|---|
| 手牌換行撐高 | `.hand` 改 `flex` + `nowrap` + `overflow-x: auto` | 單行橫滑，390→**162px** |
| 卡面過高 | `.card-face` 固定 `flex: 0 0 118px`、移除 `min-height: 168px` | 卡高 204→**153px** |
| 卡圖佔位 | `.card-art` `aspect-ratio: 1` → `4 / 3` | 省 30px |
| blurb 佔空間 | 手牌上 `.hand .card-blurb { display: none }` | 省 32px（長按詳情仍睇得到） |

**另外兩個真 bug（順手修）**：

1. **牌組掣佔一整行 48px** → 併入牌堆列做第 4 格（`⿴牌庫 5 ｜ 棄牌 0 ｜ 手牌 5 ｜ 牌組 10`），四格各 44px 高、逼一行唔折行。
2. **`.screen` 在 390 下爆到 430px**（`max-width: min(430px, 100%)` 嘅 `100%` 跟父容器 `.app` 內容寬，而 padding 唔計入）→ 改用 `calc(100vw - 0.9rem)`。**呢個係橫向被裁 40px 嘅真因**。

**改前後實測**：

| 指標 | 改前 | 改後 |
|---|---|---|
| `docH` | 981（要拉 137px） | **844 = 視口** |
| 手牌區高 | 390 | **162** |
| 卡高 | 204 | **153** |
| 結束回合 bottom | 881（**屏外**） | **614（屏內）** |
| `.screen` 闊度 | 430（爆邊） | **376** |
| 橫滑 | 無 | `scrollWidth 612 > client 376`，實測 `scrollLeft 0 → 236.8` |

### 手機置中（根容器）

**症狀**：390 直版下整體偏右、右邊被裁。

**根因（三個疊埋）**：

1. **`.app` 用 `place-items: center`**

   grid 子項預設 `min-width: auto`。手牌橫滑容器 `.hand` 的 min-content 寬度是「所有卡加起來」（8 張 ≈ 983px），grid 就會用呢個寬度撐大軌道 → 整行被推寬，畫面偏右。

2. **`.screen` 冇 `min-width: 0`**

   同理，grid／flex 子項都預設唔收縮。

3. **`.hand` 冇 `min-width: 0` + 有重複 `overflow-x: auto`**

   之前兩輪合併留下重複宣告，而且缺 `min-width: 0` 令卡片真的撐爆容器。

**修法**：

```css
body { overflow-x: clip; overflow-x: hidden; }   /* 禁水平捲動 */

.app {
  display: grid;
  grid-template-columns: minmax(0, 1fr);  /* 軌道唔可以被內容撐闊 */
  align-items: start;
  justify-items: center;                  /* 項目喺軌道內置中 */
  justify-content: center;                /* 軌道喺容器內置中（寬螢幕靠呢個） */
  width: 100%;
  max-width: 100%;
}

.screen, .screen-wide, .screen-battle {
  min-width: 0;
  max-width: 100%;
}

.hand {
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;   /* 只准一個 */
}
```

**實測（CDP + 像素分析）**：

| 寬度 | 左右邊距 | 水平溢出 |
|---|---|---|
| 320 | 7 / 7 | 無 |
| 360 | 7 / 7 | 無 |
| 390（8 張手牌） | 7 / 7 | 無 |
| 414 | 7 / 7 | 無 |
| 1920（桌面） | 745 / 745 | 無 |

**像素級覆核**（CDP 截圖 780×1688 @2x，掃描每行最左／最右非暗像素）：

```
左邊界 CSS 7.5px ｜ 右邊界 CSS 382（右邊距 8px）｜ 視口 390
→ 左右差 0.5px（抗鋸齒），實質對稱
```

11 個頁面（title／select／map／event／reward／rest／settings／tutorial／pause／victory／defeat）全部 7/7 對稱、零水平溢出。

### 手機橫屏（主驗收尺寸）

**橫屏高度只有 360–430px**，直版嘅垂直堆疊一定唔夠位（實測 844×390 下 `docH = 751`，要拉 **361px** 才見到結束回合）。

另開 `css/landscape.css`，喺 `(orientation: landscape) and (max-height: 500px)` 之下換版面：

| 頁 | 直版 | 橫屏 |
|---|---|---|
| **戰鬥** | 單欄垂直堆疊 | **三欄**：左 HUD｜中手牌｜右操作（結束回合 + 暫停） |
| **地圖** | 兩欄（3 行） | **三欄**（6 格 → 2 行） |
| **事件** | 選項縱排 | 選項**橫排三欄** |
| **戰果** | 底欄縱排 | 底欄**橫排並排**、副標收起 |

**判斷式用 `orientation` + 高度上限**，唔用固定闊度 —— 手機橫屏高度 360–430，桌面橫屏通常 >600，唔會誤中。

**戰鬥頁三欄 grid**：

```css
.screen-battle {
  grid-template-columns: minmax(0,1fr) minmax(0,1.15fr) minmax(0,0.95fr);
  grid-template-areas:
    "top   top   top"
    "piles piles piles"
    "hand  hand  act"
    "log   log   log";
  height: calc(100vh - 0.6rem);
}
.hand          { grid-area: hand; }
.battle-actions{ grid-area: act; }   /* 結束回合固定右欄 */
```

卡片縮到 **96px 闊**（直版 118），5 張一屏放得晒。

**橫屏實測（CDP 量 DOM 佈局）**：

| 尺寸 | 一屏 | 左右對稱 | 手牌可見 | 結束回合可見 |
|---|---|---|---|---|
| **844×390**（iPhone 14 橫） | ✅ `over: 0` | ✅ 6/6 | ✅ | ✅ |
| **780×360** | ✅ `over: 0` | ✅ | ✅ | ✅ |
| **667×375**（iPhone SE 橫） | ✅ `over: 0` | ✅ | ✅ | ✅ |

**戰果頁底欄**：由 184px 壓到 **47px**（兩粒掣並排：主掣 316×40、返回 96px），兩粒都喺屏內。

**直版回歸**：390×844 下 `gridTemplateColumns: none`（冇套用三欄）、一屏、對稱 —— 完全冇受影響。

> ⚠️ 用截圖核對時要小心：截圖工具會用自己嘅裝置尺寸（實測影到 2208×1331），同 CDP `Emulation.setDeviceMetricsOverride` 設定嘅 844×390 唔一致。**以 `getBoundingClientRect()` 量到嘅數值為準**。

## 自測

```bash
cd hk-roguelite
node js/smoke-act2.mjs   # Act1–2 流程＋音效＋設定頁＋教學＋暫停＋存檔＋每日鉤＋牌組預覽＋長按詳情＋手牌一屏
node js/smoke-act3.mjs   # 四角色×三區全程 → 最終 Boss → 結算資料
node js/smoke-full.mjs   # 封測包：四角／分支／店／遺物／near-miss／再開一局
node js/probe-act3.mjs   # 最終 Boss 勝率／超時（平衡下限參考）
node js/smoke-deploy.mjs # 部署＋窄屏置中＋手機橫屏：相對路徑／無外部依賴／assets／CSS 規則（292 項）
```

`smoke-act2.mjs` 尾段有兩組唔需要瀏覽器嘅檢查：

**「音效薄層」**

- 四類必需音（`card`／`hurt`／`coin`／`clear`）都存在，而且 `SFX_NAMES` 每個登記名都真係有實作
- `MASTER_GAIN` 必須 > 0 且 < 0.6（防止有人日後不小心調到炸耳）
- 靜音 toggle 兩下要還原、靜音狀態真係寫入／清走 `localStorage`
- 靜音時同無 `AudioContext` 環境下播全部音都**唔 throw**

**「設定頁清除進度」**

- 只列出 `hk_` 前綴嘅 key，其他 App 嘅 key 唔會被掃到
- 清除進度**必須保留** `hk_sfx_muted`（唔可以連靜音設定都洗走）
- 冇進度時重複清除要安全回空，唔 throw
- `removeItem` 拋錯時要回 `ok: false`，唔會令遊戲崩

**「新手教學記憶」**

- 全新機 `hasSeenTutorial() === false`（首局會彈）
- 標記後寫入 `hk_tutorial_seen = "1"`，重開仍然記得
- 只有精確 `"1"` 才算睇過（`"true"`／`"0"` 都當未睇）
- 教學記憶**唔可以**列入 `SETTING_KEYS`（清進度要清得走）
- 清進度後教學會再彈，但音效設定保留
- 無 `localStorage` 環境下三個函式都回 `false`，唔 throw

**「暫停／返標題」**

- 冇 `run` 時 `hasRunToLose() === false`、`ok === false`、清單唔應該列任何嘢
- 有 `run` 時 **act／done／total／hp／maxHp／gold／deck／relics 逐項對得上真實數值**
- 清單要講「第 done+1／total 格」（而家正卡喺下一格，唔係已完成格數）
- 冇遺物時**唔應該**提「0 件遺物」
- 總結句必須含「存起」或「繼續」，而且**唔可以**含「冇得續」（有存檔仲講呢句就係呃人）
- 怪值（`act: "3"`／`completed: null`／`hp: undefined`）要降級而唔 throw

**「存檔續玩」**

- 空機 `hasSave() === false`、`loadRun() === null`、摘要空字串
- 寫入 → 讀回：六大必要欄位（角／Act／節點／牌／遺物／血金）逐項對值
- `unpackRun` 補齊 16 個欄位、跨場加成保留、`deck` 係新陣列（唔共用 reference）
- 版本唔對／角色已移除／壞 JSON／缺欄位／空牌組／Act 超界 → 一律當冇存檔
- 空角色 id、負 `mapIndex`、`maxHp: 0` 都要驗證失敗
- `clearRun()` 要**真係刪走個 key**（唔可以只回 true）
- 再存一次會覆蓋，localStorage 只可以有一份存檔
- 無 localStorage 環境下四個函式都降級，唔 throw

**「每日一局鉤」**

- `dateKey()` 用**本機時間**：`new Date(2026,10,6,0,30)` 必須得 `2026-11-06`（UTC 版會變 `2026-11-05`）
- 同一天 `rewardForDate()` 必須**穩定**（唔可以用 `Math.random`）；30 日內至少要有 2 種獎勵
- 獎勵池兩類都要有；金幣獎勵要「薄」（1–20）
- 全新 → 未領；第一次 `claimDaily()` `claimed === true`
- **同日再領** `claimed === false` 而且 `pendingGold` 唔會加
- 第二日可以再領
- 金幣獎勵：寫入 `pendingGold` → `consumePendingGold()` 攞走 → 清 0 → 再攞係 0（唔會重複派）
- 名片句獎勵：唔會加 `pendingGold`，會存入 `text`
- 壞 JSON／舊版本 → 回空、當未領
- 無 localStorage → 回空／false／0，但 `dateKey()` 唔受影響（純函式）

**「牌組預覽」**

- 空牌組／`null`／`undefined` 都要安全回空，唔 throw
- 四角 starter 都要整理得到：`total === starterDeck.length`、行 count 總和 === total、攻擊 + 技能 === total
- 每個 starter 牌都要有名（唔可以漏做，否則顯示會變 id）
- **重複牌合成一行**：`["S01","S01","S01","S15"]` → 2 行，`S01` 嘅 count === 3
- **排序**：攻擊排喺技能之前；同 type 內費用非遞減
- **平均費用按張數加權**（唔係按行平均）
- 概覽句要含「共／攻擊／技能／平均」
- 未知牌 id 降級：用 id 做名、費用落回 0
- `battleDeckIds()`：抽牌堆 + 手牌 + 棄牌堆全部要計；缺欄位／`null` 安全
- **實戰守恆**：真開一場戰鬥，`battleDeckIds(b).length === run.deck.length`；出一張牌之後仍然一樣

**「長按卡詳情」**

- **每一張**牌（`CARDS` 全部）都要砌得出詳情：有名、有費用、有至少一句效果、有「幾時用」
- 效果句唔可以空白（長度 > 3）
- **數字要對得上**：有 `dmg`／`block`／`heal`／`draw`／`mark` 嘅牌，詳情句必須包含該數字
- `dmgBonusOnLowHp` 要特別講「半血以下」＋數字（呢個係玩家最易忽略嘅機制）
- 冇數值效果嘅牌都要有一句人話
- `null`／`undefined` 降級而唔 throw
- 「幾時用」要按牌型分流，唔可以全部一樣

**「三頁一屏」**（Node 冇 DOM，所以驗 CSS 原文）

- `.map-list` 要用 `display: grid` + `repeat(2, ...)`（6 格 → 3 行），**唔可以**再用單欄 `flex-direction: column`
- `.result-details` 同 `.result-details-summary`（`min-height: 48px`）要存在
- `.result-details-summary::-webkit-details-marker` 要 `display: none`（自訂箭頭，跨瀏覽器一致）
- `.result-bar` **必須 `position: fixed`** + `bottom: 0` + `z-index`（sticky 會被長內容推走）
- `.result-bar .btn` 要 `min-height: 44px`
- `.screen-result` 要有 `padding-bottom`（留位畀 fixed 底欄，否則最後一段被蓋）
**「戰鬥手牌一屏」**（Node 冇 DOM，所以驗 CSS 原文有冇關鍵規則，防止日後被誤刪）

- `.hand` 必須係 `display: flex` + `flex-wrap: nowrap` + `overflow-x: auto`，而且**冇** `grid-template-columns`（會換行撐高）
- `.card-face` 要有固定 `flex: 0 0 Npx` 同 `width`，而且**冇** `min-height: 168px`
- `.card-art` 要用 `aspect-ratio: 4 / 3`
- `.hand .card-blurb` 要 `display: none`
- `.pile-row` 要 `flex-wrap: nowrap`
- **手機 media query 唔可以用 `100%`**：要 `calc(100vw - padding)`，否則 390 下爆到 430
- `.pile-deck-btn` 要 `min-height: 44px`

**「窄屏置中」**（喺 `smoke-deploy.mjs`，驗 CSS 原文）

- `.app` 要 `grid-template-columns: minmax(0, 1fr)`（防內容撐闊）
- `.app` 要 `justify-items: center`（項目置中）
- `.app` **唔可以**用 `place-items: center`（會連垂直一齊置中，長內容會偏）
- `.screen*` 要有 `min-width: 0`
- `body` 要 `overflow-x: hidden` 或 `clip`
- `.hand` 要 `min-width: 0` + `max-width: 100%` + `overflow-x: auto`
- `.hand` **唔可以有重複 `overflow-x`**（合併事故遺留）
- `.battle-top` 要有 `minmax(0,1fr)` 或 `min-width: 0`


### 封測包（`smoke-full.mjs`）

推 PR 前跑一次，一次過檢查 380 項：

| 區塊 | 檢查內容 |
| --- | --- |
| 四角開局 | 角色數、被動、starter ≥9、專屬 3 張、路線互不相同 |
| Act 內分支 | 三區各 1 個、≥2 選項、兩路類型唔同、兩邊都有可見改動 |
| 便利店 | 五個價錢合法、開局金幣買得起最便宜項、貨架抽夠 |
| 遺物 | 全部有 effect、專屬對自己生效／對別角無效 |
| near-miss | 三 Boss 各有專屬台詞且不重複 |
| 再開一局 | 四角 rerunHook 三段齊、clearSummary 不重複 |
| Act 銜接 | 兩段過場句齊、to 與區名一致 |
| 事件池 | 每區 ≥4、每個選項即時可見 |
| 戰鬥核心 | 四角各打一場、牌堆守恆、結束回合有變化 |
| 經濟 | 小怪戰後必有金 |
| 選牌加權 | 四角主路線互不相同 |

### 本機驗收步驟

```bash
cd hk-roguelite
python -m http.server 8766
```

瀏覽器開 <http://127.0.0.1:8766/>，建議用 DevTools 手機模式 **橫屏 844×390**（主驗收尺寸）或直版 390×844。

### 已知問題（3 條內）

1. **商店「抽卡包」可能抽到已擁有嘅牌** —— 目前唔會去重，牌組可能重複。
2. **平衡未經真人長時間試玩** —— 目前靠 smoke 模擬，四角通關率 100%，
   但剩餘 HP 差距（35%–82%）只反映角色風格，未經手感驗證。
3. **分支只有一個節點** —— 每 Act 一格二揀一，未做完整分支圖。
