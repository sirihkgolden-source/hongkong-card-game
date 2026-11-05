# 美術對照表（assets/art/）

> 產品：《香江小波風》｜目錄暫名 `hk-roguelite/`
> 本目錄只放**總導演確認**嘅圖；Cursor 只負責接線，**唔出圖、唔外撈網圖**。
> 商用授權由總導演自行確認（本輪不負責授權審查）。

## 立繪（開局三選一）

| 檔名 | 用途 | 角色 id | 顯示名 | 備註 |
|------|------|---------|--------|------|
| `portraits/ayau.jpg` | 選角立繪 | `oil` | 阿油・後巷經紀 | 街頭造型、霓虹背景 |
| `portraits/ashan.jpg` | 選角立繪 | `asan` | 阿珊・茶記夜更 | 茶記圍裙＋鉛筆咬嘴（禁維港遊客女） |
| `portraits/kauko.jpg` | 選角立繪 | `kauko` | 九哥・招牌工 | 工圍裙＋工具枱＋啤牌（唔叫霓虹工） |

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

- 現時全部為 **`.jpg`**。
- 若日後換 `webp`／`png`，只需同名改副檔名，`js/data.js` 嘅 `ART` 常數改一處即可。
- **缺圖降級**：`<img onerror>` 會加 `is-fallback` class，顯示字首漸層（油／珊／九）；背景用 `--act-bg`，缺檔時自動落回內建霓虹漸層，唔會爆 layout。

## 未改動

- 舊 `assets/bg/*.jpg`、`assets/enemies/*`、`assets/skills/*` **保留**（敵圖／牌圖仍用）。
- 本輪只將 **Act 區背景** 與 **角色立繪** 指向 `assets/art/…`。
- 未改任何玩法數值、被動公式、牌效果、節點流程。
