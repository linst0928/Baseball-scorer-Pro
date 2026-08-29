# 完整逐球驗證資料來源

本輪以 **2024 年世界大賽第 5 戰**作為可重播的公開實戰資料。MLB 官方公開賽程資料顯示：2024 年 10 月 30 日，洛杉磯道奇客場對紐約洋基，終場 **7 比 6**，比賽狀態為 Final、正式賽程為 9 局，賽事識別碼為 `775296`。

| 項目 | 驗證值 |
|---|---|
| 賽事 | 2024 World Series Game 5 |
| 日期 | 2024-10-30 |
| 客隊／主隊 | Los Angeles Dodgers／New York Yankees |
| 終場比分 | 7／6 |
| 正式局數 | 9 |
| 官方逐球資料端點 | `https://statsapi.mlb.com/api/v1.1/game/775296/feed/live` |

## 使用範圍

逐球資料僅用於驗證應用程式的資料映射：逐球結果應進入球數欄；打席結果、守備傳接與跑壘事件應分別映射至外圈、菱形邊線與內圈。美國職棒事件名稱不會直接宣稱為早稻田符號，需透過本專案的對照字典轉換後進行核對。

## 核對結果

執行 `pnpm tsx scripts/validate-mlb-pitch-by-pitch.ts` 後，官方資料共含 89 個打席與 342 顆標示為投球的事件；終場資料為客隊 7 分、主隊 6 分、9 局，與公開賽程一致。應用程式使用的符號映射已覆蓋全部球數欄投球事件，沒有未分類描述。

| 分區 | 官方逐球／打席分類 | App 早稻田記錄欄映射 | 筆數 |
|---|---|---|---:|
| 球數欄 | In play | `•` 擊出球 | 53 |
| 球數欄 | Strike | `○` 沒有揮棒好球 | 62 |
| 球數欄 | Ball | `—` 壞球 | 137 |
| 球數欄 | Foul | `△` 界外球 | 55 |
| 球數欄 | Swinging strike | `⊖` 揮棒落空 | 30 |
| 球數欄 | Foul tip | `▲` 擦棒被捕 | 3 |
| 球數欄 | Bunt | `⌁` 觸擊 | 1 |
| 外圈 | Hit by pitch | `HBP` 非安打上壘 | 1 |
| 內圈／外圈 | 單打、二壘打、全壘打、保送、三振、失誤與出局 | 對應打席結果與菱形進壘／出局標示 | 89 個打席均可分類 |

> 觸身球不是球數欄符號；它依示意圖規則屬於右上外圈的「非安打上壘」事件。因此，驗證腳本會將官方 `Hit By Pitch` 事件明確導向 `HBP`，而不是誤視為未分類投球。

## 來源

1. [MLB Stats API — 2024-10-30 schedule](https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2024-10-30)
2. [Baseball-Reference — Pitch-by-Pitch Data](https://www.baseball-reference.com/about/pitch_data.shtml)
