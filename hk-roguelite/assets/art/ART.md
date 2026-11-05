# 美術對照表（assets/art/）

> 產品：《香江小波風》｜目錄暫名 `hk-roguelite/`
> 本目錄只放**總導演確認**嘅圖；Cursor 只負責接線，**唔出圖、唔外撈網圖**。
> 商用授權由總導演自行確認（本輪不負責授權審查）。

## 立繪（開局四選一）

| 檔名 | 用途 | 角色 id | 顯示名 | 備註 |
|------|------|---------|--------|------|
| `portraits/ayau.webp` | 選角立繪 | `oil` | 阿油・後巷經紀 | **男**：綠外套＋花恤＋waist pouch，手遞卡片；透明底 |
| `portraits/ashan.jpg` | 選角立繪 | `asan` | 阿珊・茶記夜更 | 茶記圍裙＋鉛筆咬嘴（禁維港遊客女） |
| `portraits/kauko.jpg` | 選角立繪 | `kauko` | 九哥・招牌工 | 工圍裙＋工具枱＋啤牌（唔叫霓虹工） |
| `portraits/shingzai.webp` | 選角立繪 | `sing` | 勝仔・跌打館學徒 | 半身、手纏繃帶、白頭巾；藥櫃「正骨推拿」＋右下菠蘿包奶茶 |

## 區背景（3 Act）

| 檔名 | 用途 | Act | 區名 | 備註 |
|------|------|-----|------|------|
| `bg/bg_act1_alley.jpg` | Act1 區背 | 1 | 後巷・夜醒 | 窄巷霓虹／鐵閘感 |
| `bg/bg_act2_mongkok.jpg` | Act2 區背 | 2 | 旺角霓虹 | 亞皆老街街景，地面有「旺角 ARGYLE STREET」路牌 |
| `bg/bg_act3_rooftop.jpg` | Act3 區背 | 3 | 城寨・天台 | 水塔＋竹棚晾衫＋女兒牆，望落旺角燈牌街＋遠處中銀 |

> 三張區背**必須互不相同**（曾誤將 Act2／Act3 指向同一張天台圖，已修正）。
> 換圖後請跑：
> ```powershell
> Get-FileHash assets\art\bg\*.jpg -Algorithm MD5
> ```
> 確認三個 MD5 唔一樣。

### 尺寸規格

- 全部 **768×1024**（3:4 直向），JPEG quality 88、progressive、單張 < 400KB。
- `bg_act2_mongkok.jpg` 由橫圖 `assets/bg/bg-neon-street-day.jpg`（1024×576）置中裁切成 432×576 再放大到 768×1024，保留「旺角 ARGYLE」路牌做定位。

## 副檔名與降級

- 立繪：`ayau.webp`（透明底 RGBA）、`ashan.jpg`、`kauko.jpg`、`shingzai.webp`。
- 背景：三張均為 `.jpg`。
- 若日後換格式，只需同名改副檔名，`js/data.js` 嘅 `portrait` / `ACT_BG` 改一處即可。
- **缺圖降級**：`<img onerror>` 會加 `is-fallback` class，顯示字首漸層（油／珊／九／勝）；背景用 `--act-bg`，缺檔時自動落回內建霓虹漸層，唔會爆 layout。
- **降級係無聲嘅**：所以 `smoke-act2.mjs` 有斷言直接讀 `assets/art/portraits/` 目錄，確認四角 `portrait` 指向嘅檔真係存在（見下）。

## 勝仔立繪（曾缺檔，已修）

- **2026-11-06 事故**：`sing` 在 `js/data.js` **完全冇 `portrait` 欄位**，`shingzai.webp` 亦唔存在 → 選角靜靜 fallback 成純色「勝」字塊，而 smoke 照樣全綠（因為只測資料欄位、冇測檔案存在）。
- **修正**：
  1. 由總導演提供嘅 `1970s-hk-dit-da-apprentice….jpg`（768×1024）本機轉存為 `assets/art/portraits/shingzai.webp`（q88，242KB）
  2. `js/data.js` 加 `sing.portrait = "assets/art/portraits/shingzai.webp"`
  3. `smoke-act2.mjs` 加 4 條斷言：四角都要有 `portrait`、路徑格式合規、**檔案真係存在**、四角唔可以重用同一張
- **驗收**：390 下 `.char-portrait` `naturalWidth = 768`、`.avatar-fallback` `display: none`、`overlap`／溢出皆零。

## 阿油立繪（曾出錯，已修）

- **2026-11-05 事故**：`ayau.jpg` 誤用女角圖，選角時 `oil` 顯示女性，與角色設定（後巷經紀，男）不符。
- **修正**：改用綠外套＋花恤男圖（來源 `hk_1970s_mong_kok_broker_character_transparent.png`，1632×2176 RGBA），轉存為 `ayau.webp`（768×1024，q90，249KB），舊 `ayau.jpg` 已刪除。
- **驗收**：選角畫面 `oil` 必須見到男性、綠外套、手持卡片。

## 未改動

- 舊 `assets/bg/*.jpg`、`assets/enemies/*`、`assets/skills/*` **保留**（敵圖／牌圖仍用）。
- 本輪只將 **Act 區背景** 與 **角色立繪** 指向 `assets/art/…`。
- 未改任何玩法數值、被動公式、牌效果、節點流程。
