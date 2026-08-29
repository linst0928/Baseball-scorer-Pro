export type WasedaSymbolCategory = "球數欄" | "外圈" | "內圈" | "跑壘／特殊" | "守備／軌跡";

export type WasedaSymbolReference = {
  id: string;
  category: WasedaSymbolCategory;
  mark: string;
  title: string;
  placement: string;
  description: string;
  example: string;
  tone: "navy" | "red" | "blue";
};

export const WASEDA_SYMBOL_CATEGORIES: Array<WasedaSymbolCategory | "全部"> = [
  "全部",
  "球數欄",
  "外圈",
  "內圈",
  "跑壘／特殊",
  "守備／軌跡",
];

/**
 * App 支援的早稻田紀錄符號全集。每一筆均指定個人紀錄欄中的位置，
 * 讓速查表、長按說明與逐球輸入能使用相同資料口徑。
 */
export const WASEDA_SYMBOL_REFERENCE: WasedaSymbolReference[] = [
  { id: "ball", category: "球數欄", mark: "—", title: "壞球", placement: "球數欄", description: "投球未進好球帶且打者未揮棒；累加壞球數。", example: "外角偏高：—", tone: "navy" },
  { id: "called-strike", category: "球數欄", mark: "○", title: "未揮好球", placement: "球數欄", description: "投球進入好球帶，打者未揮棒；累加好球數。", example: "內角好球：○", tone: "navy" },
  { id: "foul", category: "球數欄", mark: "△", title: "界外球", placement: "球數欄", description: "擊球落在界外；兩好球後不再增加好球數。", example: "右側界外：△", tone: "navy" },
  { id: "foul-tip", category: "球數欄", mark: "▲", title: "擦棒被捕", placement: "球數欄", description: "擦棒後由捕手直接接捕；屬好球，第三好球時為三振。", example: "兩好球後擦棒被捕：▲", tone: "navy" },
  { id: "swinging-strike", category: "球數欄", mark: "⊖", title: "揮棒落空", placement: "球數欄", description: "打者揮棒未碰到球；累加好球數。", example: "變化球揮空：⊖", tone: "navy" },
  { id: "bunt", category: "球數欄", mark: "⌁", title: "觸擊", placement: "球數欄", description: "記錄打者嘗試觸擊的逐球動作；最後結果另以打席結果判定。", example: "觸擊推進：⌁", tone: "navy" },
  { id: "missed-bunt", category: "球數欄", mark: "◓", title: "觸擊落空", placement: "球數欄", description: "打者試圖觸擊但未碰到球；記為好球。", example: "短打失敗：◓", tone: "navy" },
  { id: "bunt-foul", category: "球數欄", mark: "△⌁", title: "觸擊界外", placement: "球數欄", description: "觸擊球落在界外；兩好球後觸擊界外為三振。", example: "兩好球後觸擊界外：△⌁", tone: "navy" },
  { id: "foul-error", category: "球數欄", mark: "△E", title: "界外失誤", placement: "球數欄／外圈右上", description: "界外球被守備方處理失誤；保留界外與失誤事實供後續判定。", example: "界外飛球漏接：△E", tone: "blue" },
  { id: "in-play", category: "球數欄", mark: "•", title: "擊出球", placement: "球數欄 → 外圈右下", description: "球進入比賽場地；接著填寫安打、出局或失誤與守備傳接。", example: "• → 5ー3", tone: "navy" },

  { id: "single", category: "外圈", mark: "1B", title: "一壘安打", placement: "外圈左上（紅字）", description: "以紅字記錄安打種類，並在菱形標出打者與跑者進壘。", example: "平飛 7 1B", tone: "red" },
  { id: "double", category: "外圈", mark: "2B", title: "二壘安打", placement: "外圈左上（紅字）", description: "以紅字記錄二壘安打，並補上擊球方向或軌跡。", example: "上弧線 7 2B", tone: "red" },
  { id: "triple", category: "外圈", mark: "3B", title: "三壘安打", placement: "外圈左上（紅字）", description: "以紅字記錄三壘安打，並標出所有跑者進壘。", example: "平飛 9 3B", tone: "red" },
  { id: "home-run", category: "外圈", mark: "HR", title: "全壘打", placement: "外圈左上（紅字）", description: "以紅字記錄全壘打；得分者同步在內圈得分區完成標記。", example: "左外野 HR", tone: "red" },
  { id: "rbi", category: "外圈", mark: "① ② ③ ④", title: "打點", placement: "外圈左下（紅圈數字）", description: "按該打席打回的得分人數標示打點；最多可記四分。", example: "2B ②", tone: "red" },
  { id: "walk", category: "外圈", mark: "B", title: "四壞球", placement: "外圈右上（藍字）", description: "非安打上壘事件；打者上一壘，其他跑者依規則推進。", example: "B 上壘", tone: "blue" },
  { id: "hit-by-pitch", category: "外圈", mark: "DB", title: "觸身球", placement: "外圈右上（藍字）", description: "非安打上壘事件；打者因觸身取得一壘。", example: "DB 上壘", tone: "blue" },
  { id: "fielder-choice", category: "外圈", mark: "FC", title: "野手選擇", placement: "外圈右上（藍字）", description: "守備方選擇處理其他跑者，打者因野手選擇上壘。", example: "FC 6ー4", tone: "blue" },
  { id: "error", category: "外圈", mark: "E", title: "失誤", placement: "外圈右上（藍字）", description: "結果區只記 E；守備位置與必要傳接另記於外圈右下，不與結果符號合併。", example: "E；右下：6ー3", tone: "blue" },
  { id: "strikeout", category: "外圈", mark: "K", title: "三振", placement: "菱形內圈", description: "打席以三振結束；依該局出局順序在內圈標示 I、II 或 III。", example: "K → II", tone: "navy" },
  { id: "called-strikeout", category: "外圈", mark: "○K", title: "見逃三振", placement: "菱形內圈", description: "第三好球為打者未揮棒時，以未揮好球符號加 K 記錄。", example: "○K → II", tone: "navy" },
  { id: "double-play", category: "外圈", mark: "DP", title: "雙殺", placement: "外圈左上／守備序列", description: "以 DP 搭配守備傳接記錄一個打席造成兩個出局。", example: "6ー4ー3 DP", tone: "blue" },

  { id: "out-one", category: "內圈", mark: "I", title: "第一出局", placement: "菱形內部", description: "該局的第一個出局，以羅馬數字標示。", example: "6-3 I", tone: "navy" },
  { id: "out-two", category: "內圈", mark: "II", title: "第二出局", placement: "菱形內部", description: "該局的第二個出局，以羅馬數字標示。", example: "F8 II", tone: "navy" },
  { id: "out-three", category: "內圈", mark: "III", title: "第三出局", placement: "菱形內部", description: "該局的第三個出局，以羅馬數字標示，結束半局。", example: "K III", tone: "navy" },
  { id: "unearned-run", category: "內圈", mark: "○", title: "失分", placement: "內圈得分區", description: "投手失分以空心圓標記，用於後續責失分判讀。", example: "○", tone: "navy" },
  { id: "earned-run", category: "內圈", mark: "●", title: "自責分", placement: "內圈得分區", description: "投手自責分以實心圓標記，用於 ERA 與投手統計。", example: "●", tone: "navy" },
  { id: "left-on-base", category: "內圈", mark: "ℓ", title: "殘壘", placement: "內圈得分區", description: "半局結束時仍留在壘上的跑者，以草寫 l 表示殘壘。", example: "ℓ", tone: "navy" },

  { id: "stolen-base", category: "跑壘／特殊", mark: "→ SB", title: "盜壘", placement: "菱形邊線／外圈（藍字）", description: "本 App 採用已確認的例外：跑者在投球間自行進壘時，沿壘線以藍色箭頭加 SB 表示方向。", example: "→ SB 1→2", tone: "blue" },
  { id: "caught-stealing", category: "跑壘／特殊", mark: "CS", title: "盜壘刺", placement: "菱形邊線／外圈（藍字）", description: "跑者嘗試盜壘時被刺殺；出局順序同步反映於內圈。", example: "CS 2→3", tone: "blue" },
  { id: "pickoff", category: "跑壘／特殊", mark: "PO", title: "牽制出局", placement: "外圈左上（藍字）", description: "投手或捕手牽制使跑者出局。", example: "PO 1-3", tone: "blue" },
  { id: "wild-pitch", category: "跑壘／特殊", mark: "WP", title: "暴投", placement: "外圈右上（藍字）", description: "投手失控造成跑者前進；屬投手特殊事件。", example: "WP，3B→本壘", tone: "blue" },
  { id: "passed-ball", category: "跑壘／特殊", mark: "PB", title: "捕逸", placement: "外圈右上（藍字）", description: "捕手未能正常接捕而使跑者前進；與暴投分開記錄。", example: "PB，2B→3B", tone: "blue" },
  { id: "balk", category: "跑壘／特殊", mark: "BK", title: "投手犯規", placement: "外圈右上（藍字）", description: "投手犯規造成跑者推進。", example: "BK，1B→2B", tone: "blue" },
  { id: "advance", category: "跑壘／特殊", mark: "↑", title: "進壘", placement: "菱形邊線／外圈（藍字）", description: "用於非指定特殊事件的跑者前進，並沿壘線標記方向。", example: "2B→3B", tone: "blue" },
  { id: "offensive-timeout", category: "跑壘／特殊", mark: "O.C", title: "攻方暫停", placement: "本半局紀錄欄旁／完整紀錄時間線", description: "攻方暫停以 O.C 註記。此 App 將其保存為可追溯的純註記，絕不改變球數、比分、壘包、出局或投打統計。", example: "第 4 局上：O.C", tone: "navy" },
  { id: "defensive-timeout", category: "跑壘／特殊", mark: "T", title: "守方暫停", placement: "本半局紀錄欄旁／完整紀錄時間線", description: "守方暫停以 T 註記。此 App 將其保存為可追溯的純註記，絕不改變球數、比分、壘包、出局或投打統計。", example: "第 4 局上：T", tone: "navy" },
  { id: "inning-end", category: "跑壘／特殊", mark: "//", title: "半局攻擊結束", placement: "該半局最後一筆紀錄後", description: "正常達三出局並切換攻守時自動寫入雙斜線。它只標示半局邊界，不額外產生出局或清壘。", example: "K III //", tone: "navy" },
  { id: "game-end-early", category: "跑壘／特殊", mark: "///", title: "未滿三出局結束比賽", placement: "完整紀錄最後一筆註記", description: "比賽在當半局未滿三出局而被使用者確認結束時，以三斜線註記；必須走確認流程，且不得補加出局、清除跑者或改變比分。", example: "第 7 局下 1 出局：///", tone: "navy" },
  { id: "pinch-hitter", category: "跑壘／特殊", mark: "PH", title: "代打", placement: "整體紀錄替換子列／替換發生局打席格上側", description: "代打進場時，替換球員姓名旁顯示進場局數與 PH；同局打席格以獨立徽記標示，不與結果或傳接混寫。", example: "第 10 局・PH（代打）", tone: "blue" },
  { id: "pinch-runner", category: "跑壘／特殊", mark: "PR", title: "代跑", placement: "整體紀錄替換子列／替換發生局打席格上側", description: "代跑進場時，替換球員姓名旁顯示進場局數與 PR；同局打席格以獨立徽記標示，不與結果或傳接混寫。", example: "第 8 局・PR（代跑）", tone: "blue" },
  { id: "pinch-fielder", category: "跑壘／特殊", mark: "PF", title: "代守", placement: "整體紀錄替換子列／替換發生局打席格上側", description: "換守進場時，替換球員姓名旁顯示進場局數與 PF；同局打席格以獨立徽記標示，不與結果或傳接混寫。", example: "第 7 局・PF（代守）", tone: "blue" },
  { id: "pitching-change", category: "跑壘／特殊", mark: "︺ P", title: "換投", placement: "新投手面對的首位打者格左上", description: "對手換投後，系統以既有換投紀錄與打席 pitcherId 找出新投手面對的第一位打者；標記只提示投手交接，不與打席結果、替換徽記或右下傳接混寫。", example: "第 6 局・︺ P #18", tone: "blue" },

  { id: "fly", category: "守備／軌跡", mark: "⌒", title: "高飛球", placement: "菱形邊線／外圈", description: "用於描述高拋物線飛球的擊球軌跡。", example: "⌒7 2B", tone: "navy" },
  { id: "line", category: "守備／軌跡", mark: "ー", title: "平飛球", placement: "菱形邊線／外圈", description: "用於描述平直飛出的擊球軌跡。", example: "ー8 1B", tone: "navy" },
  { id: "ground", category: "守備／軌跡", mark: "＿", title: "滾地球", placement: "菱形邊線／外圈", description: "用於描述貼地滾動的擊球軌跡。", example: "＿6 5ー3", tone: "navy" },
  { id: "fielding-sequence", category: "守備／軌跡", mark: "5ー3", title: "守備傳接", placement: "外圈右下（藍字）", description: "用守備員代號與長橫線記錄接傳順序；可搭配 DP、E 或 FC。", example: "5ー3", tone: "blue" },
  { id: "deflection-sequence", category: "守備／軌跡", mark: "1・4ー3", title: "折射後傳接", placement: "外圈右下（藍字）", description: "以中點表示先碰觸或折射、再以長橫線表示完成傳接的守備處理。", example: "1・4ー3", tone: "blue" },
  { id: "self-touch-first", category: "守備／軌跡", mark: "3A", title: "自踩一壘", placement: "外圈右下（藍字）", description: "野手自行踩一壘完成封殺時，於守備代號後接 A；A 是一壘壘包字母，不是傳球符號。補位後踩一壘可寫為 1ー4A。", example: "一壘手自行踩壘：3A", tone: "blue" },
  { id: "fly-out", category: "守備／軌跡", mark: "FO", title: "飛球出局", placement: "外圈右上；傳接另列右下", description: "結果區只記 FO；守備位置與傳接另記於外圈右下，內圈補該局出局順序。", example: "FO；右下：8；內圈：II", tone: "navy" },
  { id: "ground-out", category: "守備／軌跡", mark: "GO", title: "滾地出局", placement: "外圈右上；傳接另列右下", description: "結果區只記 GO；滾地軌跡、守備位置與傳接另記於外圈右下，內圈補該局出局順序。", example: "GO；右下：＿6ー3；內圈：I", tone: "navy" },
];
