# 觸擊與犧牲短打規則查核筆記

> 本文件僅補充正式比賽規則與統計判定；早稻田紀錄欄的三區位置仍以 `waseda-core-standard.md` 為最高規範。

## 已確認規則

| 情境 | 應用程式處理 | 依據 |
| --- | --- | --- |
| 兩好球後觸擊界外 | 計為第三好球，打者三振出局，打席立即結束；不得當作一般界外繼續打席。 | Official Baseball Rules（2020 Edition，Rule 5.09(a)(4)）；[Baseball Canada PDF](https://www.baseball.ca/uploads/files/2020%20Official%20Baseball%20Rules.pdf) |
| 少於兩好球的觸擊界外 | 計一個好球；若尚未累積兩好球，打席繼續。 | Official Baseball Rules（2020 Edition）；同上 |
| 成功犧牲短打 | 打者以出局換取至少一名跑者推進一個壘包，記為 SH；一般在壘上有人且少於兩出局時成立。 | [MLB：Sacrifice Bunt](https://www.mlb.com/glossary/standard-stats/sacrifice-bunt) |
| 犧牲短打後打者因失誤上壘 | 可仍給予 SH；若觸擊變成安打，則記安打而非 SH。 | [MLB：Sacrifice Bunt](https://www.mlb.com/glossary/standard-stats/sacrifice-bunt) |
| 打點提示 | 跑者於打席結果回本壘時，需讓紀錄者確認是否計 RBI；依早稻田核心規範，同步回寫來源打者的打點與跑者終點。 | `docs/waseda-core-standard.md` 第 D 節 |

## 介面對應

紅框的觸擊快捷列應將「觸擊」、「未碰觸擊」、「觸擊擦棒／界外」分開：成功觸擊在完成落點後進入打擊事件流程；未碰觸擊不改變球數；觸擊界外依目前好球數判定為一般好球或兩好球後的 K。犧牲短打快捷結果僅在觸擊打席完成後提供，顯示實際推進跑者與可能打點，並要求確認。

黃框的壘包格須將畫面直接繫結於單一 `runnerState` 快照；跑者移動後，來源壘位必須不存在該跑者，目的壘位才可顯示其最新圖示，避免同一跑者同時殘留兩個壘位。
