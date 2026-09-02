export type TeamSide = "home" | "away";
export type GameStatus = "setup" | "live" | "final";
export type AtBatResult = "1B" | "2B" | "3B" | "HR" | "BB" | "HBP" | "K" | "F" | "G" | "E";
/**
 * 跑壘特殊事件與純紀錄註記共用同一條可追溯時間線。
 * 後四種 annotation 僅為早稻田記錄法的書寫符號，絕不可參與統計或狀態結算。
 */
export type SpecialEventType = "SB" | "CS" | "WP" | "PB" | "BK" | "PO" | "ADV" | "OFFENSIVE_TIMEOUT" | "DEFENSIVE_TIMEOUT" | "INNING_END" | "GAME_END_EARLY";
export type PitchType = "fastball" | "breaking";
export type PitchFilter = PitchType | "all";
/** 打席的輸入來源；手動補登不改變現場正在進行的攻守狀態。 */
export type AtBatSource = "live" | "manual";
/** 早稻田記錄欄的擊球軌跡。 */
export type RecordTrajectory = "fly" | "wavy" | "line" | "ground" | "bounce" | "pop";
/** 守備處理的特殊結果；傳接位置仍以 fieldingSequence 保存。 */
export type FieldingPlayKind = "DP" | "TP" | "FC";
/** 高飛犧牲打未帶回分數時的例外狀況；保存於該打席，供早稻田紀錄與賽後檢視追溯。 */
export type SacrificeFlyNoScoreReason = "no_third_runner" | "runner_held_at_third" | "runner_out_at_home";
/** 現場記錄欄的結構化資料；notation 保留可讀的合成符號以支援舊版報表。 */
export type RecordColumn = {
  trajectory?: RecordTrajectory;
  /** 擊球球性所對應的方向／守備位置 1–9；與守備傳接序列分開保存。 */
  battedBallPosition?: string;
  fieldingSequence?: string;
  /** 雙殺、三殺或野手選擇；與傳接位置序列分開保存後再格式化。 */
  fieldingPlay?: FieldingPlayKind;
  modifiers?: string[];
  rbi?: number;
  /** 高飛犧牲打例外未得分的原因；未設定時依正常 SF 處理。 */
  sacrificeFlyNoScoreReason?: SacrificeFlyNoScoreReason;
};
/** 換人角色，保留舊版 position 欄位以相容既有紀錄。 */
export type SubstitutionType = "代打" | "代跑" | "換投" | "換守" | "PH" | "PR" | "RP" | "DEFENSE";
/** 早稻田球數欄的逐球狀態；依個人紀錄欄圖例區分觸擊與界外失誤。 */
export type PitchOutcome = "ball" | "strike" | "foul" | "foulTip" | "swingingStrike" | "bunt" | "missedBunt" | "buntFoul" | "foulError" | "inPlay" | "droppedThirdStrike";
/**
 * 觸擊成功與一般擊出球都會進入球性、方向、結果、傳接球的四步打擊事件流程。
 * 未碰球的觸擊（missedBunt、buntFoul）仍僅為逐球紀錄，不應結束打席。
 */
export function opensBattedBallWorkflow(outcome: PitchOutcome | undefined): outcome is "bunt" | "inPlay" {
  return outcome === "bunt" || outcome === "inPlay";
}
export type WeatherCondition = "sunny" | "cloudy" | "drizzle";
export type PlayerStatScope = "registered" | "all";
export type PitchZone = number;

export type PitchLocation = {
  /** 1–9 為好球帶；10–25 為向外擴充一圈的壞球落點。 */
  zone: PitchZone;
  type: PitchType;
  outcome: PitchOutcome;
};

export type Player = {
  id: string;
  number: number;
  name: string;
  position: string;
  /** 常用守備位置；建立所屬球隊時最多選四個，position 保留第一順位以相容既有配置流程。 */
  preferredPositions?: string[];
  bats: "R" | "L" | "S";
  /** 投球慣用手；舊名單可保持未設定，並於三個入口補登。 */
  throwingHand?: "R" | "L";
  /** 打擊慣用手；用於逐球九宮格與個人打擊熱區的左右鏡像。 */
  battingHand?: "R" | "L";
  battingOrder?: number;
};

/**
 * 一般球員名單一律依背號遞增呈現。
 *
 * 本函式僅處理球隊／學校的固定名單；單場棒次、守備與早稻田紀錄表
 * 仍應使用各自保留的賽事快照排序，避免日後新增或編輯球員影響歷史紀錄。
 */
export function sortPlayersByNumber(players: readonly Player[]): Player[] {
  return [...players].sort((left, right) => {
    const leftNumber = Number(left.number);
    const rightNumber = Number(right.number);
    const leftHasNumber = Number.isFinite(leftNumber);
    const rightHasNumber = Number.isFinite(rightNumber);
    if (leftHasNumber && rightHasNumber && leftNumber !== rightNumber) return leftNumber - rightNumber;
    if (leftHasNumber !== rightHasNumber) return leftHasNumber ? -1 : 1;
    const nameOrder = left.name.localeCompare(right.name, "zh-Hant");
    return nameOrder || left.id.localeCompare(right.id);
  });
}

/** 僅供清單畫面切換排序；絕不可回寫 Team／School players 或既有賽事棒次快照。 */
export type PlayerDisplaySortMode = "number" | "name" | "position";

export function sortPlayersForDisplay(players: readonly Player[], mode: PlayerDisplaySortMode): Player[] {
  const positionNumber = (player: Player) => {
    const preferred = normalizePreferredPositions(player.preferredPositions)[0] ?? player.position;
    const matched = FIELD_POSITIONS.find((position) => position.number === preferred || position.label === preferred)?.number;
    return Number(matched ?? preferred) || Number.MAX_SAFE_INTEGER;
  };
  return [...players].sort((left, right) => {
    if (mode === "name") return left.name.localeCompare(right.name, "zh-Hant") || left.number - right.number || left.id.localeCompare(right.id);
    if (mode === "position") return positionNumber(left) - positionNumber(right) || left.number - right.number || left.name.localeCompare(right.name, "zh-Hant");
    return left.number - right.number || left.name.localeCompare(right.name, "zh-Hant") || left.id.localeCompare(right.id);
  });
}

export type School = {
  id: string;
  name: string;
  players: Player[];
  createdAt: string;
  updatedAt: string;
};

export type Team = {
  id: string;
  name: string;
  school: string;
  schoolId?: string;
  /** 球隊年齡層級，例如 U8、U10、U12、U15、U18。 */
  level?: AgeGroup;
  players: Player[];
  /** 經方形裁切與壓縮後的隊徽本機／雲端 URI；未設定時以球隊縮寫替代。 */
  logoUri?: string;
  /** 使用者確認的球隊主題色；未設定時由主／客場預設色補足。 */
  customColor?: string;
  updatedAt?: string;
};

/** 每場先發配置快照；保留棒次、守備與登錄範圍，避免日後修改固定名單覆蓋已建立場次。 */
export type GameLineup = {
  battingOrderIds: string[];
  defensivePositions: Record<string, string>;
};

export type LineupCompleteness = {
  battingOrderCount: number;
  defensivePositionCount: number;
  complete: boolean;
};

/** 守備重複時可顯示的逐位修正建議；守位均以 1–9 標準代號保存。 */
export type DefensiveConflictFixSuggestion = {
  position: string;
  conflictingPlayerIds: string[];
  availablePositions: string[];
  /** 可切換至互換模式的非衝突守位球員，供介面顯示互換對象。 */
  suggestedSwaps: Array<{ targetPlayerId: string; targetPosition: string }>;
};

export type PitchState = {
  balls: number;
  strikes: number;
  total: number;
  locations?: PitchLocation[];
};

/** 新打者進入打席時的可視草稿；不可沿用前一打席的結果或早稻田外圈資料。 */
export type EmptyAtBatDraft = {
  pitchDraft: PitchState;
  selectedResult: null;
  recordColumnDraft: RecordColumn;
};

/**
 * 建立新的空白打席草稿，供現場五分格在確認寫入後立即切換下一位打者。
 * 以新物件回傳，避免 React 狀態與復原快照共享同一個可變參照。
 */
export function createEmptyAtBatDraft(): EmptyAtBatDraft {
  return {
    pitchDraft: { balls: 0, strikes: 0, total: 0, locations: [] },
    selectedResult: null,
    recordColumnDraft: { modifiers: [], rbi: 0 },
  };
}

export type RunnerState = {
  first: string | null;
  second: string | null;
  third: string | null;
};

/**
 * 暴投、捕逸與投手犯規會使既有跑者各推進一壘。
 * 此摘要僅描述確認前預期的跑者移動，不直接寫入比賽資料。
 */
export type SpecialEventRunnerAdvanceSummary = {
  runnerId: string;
  fromBase: 1 | 2 | 3;
  toBase: 2 | 3 | 4;
  scores: boolean;
};

export type ScoreByInning = {
  inning: number;
  away: number;
  home: number;
};

/**
 * 僅供整體紀錄表視覺化修正的早稻田符號覆蓋。
 * 它刻意不改寫 result、runsScored、outsBefore、runnerAdvances 或 pitches，
 * 因此不會以畫面修正推測性地改動比分、壘包、出局或投打統計。
 */
export type RecordColumnCorrection = {
  pitchMarks?: string;
  /** 舊版外圈整合式顯示補正；新四步卡同時寫入 outerMarks 的分區資料。 */
  outerMark?: string;
  innerMark?: string;
  /** 代打、代跑、換投或局結束等純顯示註記，不修改正式賽事事件。 */
  otherMark?: string;
  outerMarks?: {
    leftTop?: string;
    rightTop?: string;
    leftBottom?: string;
    /** 球性與方向／位置固定在外圈上方；守備傳接不使用此欄位。 */
    battedBallTop?: string;
    /** 傳球／守備傳接符號固定在打席格右下角。 */
    rightBottom?: string;
  };
  note?: string;
  revisedAt: string;
};

/**
 * 僅供單場整體紀錄表更正姓名／背號或守備欄的視覺覆蓋。
 * 不改寫先發名單、換人、打席、比分或任何正式統計，適合紙本核對後的表格補正。
 */
export type ScorebookDisplayOverride = {
  playerId?: string;
  defensivePosition?: string;
  revisedAt: string;
};

/** 單場整體紀錄表中的空白打序格定位；只用於更正歷程與 UI，不可作為虛構打席。 */
export type ScorebookBlankSlot = {
  side: TeamSide;
  battingOrder: number;
  entryIndex: number;
  inning: number;
  slotIndex: number;
  playerId?: string;
};

export type AtBatEvent = {
  id: string;
  inning: number;
  half: TeamSide;
  batterId: string;
  pitcherId: string;
  result: AtBatResult;
  notation: string;
  pitches: PitchState;
  outsBefore: number;
  runsScored: number;
  zone?: number; // 舊版單一投球九宮格落點
  hitZone?: number; // 1-9 擊球落點區域
  pitchType?: PitchType; // 舊版或打擊結果對應的球種
  hitPitchType?: PitchType;
  /** 早稻田記錄欄的軌跡、守備序列與事件標記。 */
  recordColumn?: RecordColumn;
  /**
   * 半局或比賽結束後才可寫入的視覺化個人紀錄補正；
   * 保持原始打席結果與統計結算不變，避免現場進行中資料不同步。
   */
  recordCorrection?: RecordColumnCorrection;
  /** 第三好球漏接後合法上一壘；與一般三振出局須分開計算出局數。 */
  droppedThirdStrike?: boolean;
  /** 跑者後續進壘／盜壘事件，附加到讓該跑者上壘的來源打席，供各紀錄格同步顯示。 */
  runnerAdvances?: RunnerAdvanceRecord[];
  source?: AtBatSource;
  timestamp: string;
};

/**
 * 已結束半局／完場後才可建立的正式更正稽核項目。
 * `previousEvent` 與 `priorScore` 保存提交前的原始證據；`replacementEvent` 會參與正式統計。
 */
export type FormalScorebookCorrection = {
  id: string;
  kind: "insert" | "replace";
  slot: ScorebookBlankSlot;
  replacementEvent: AtBatEvent;
  previousEvent?: AtBatEvent;
  affectedEventIds: string[];
  priorScore: ScoreByInning[];
  recordedAt: string;
  note?: string;
};

export type RunnerAdvanceRecord = {
  id: string;
  /** LOB 僅用於半局結束時回寫來源打席內圈的殘壘標記，並非可操作的特殊事件。 */
  type: SpecialEventType | "LOB";
  fromBase?: 1 | 2 | 3;
  toBase?: 2 | 3 | 4;
  /** 跑者出局時的該半局出局順序，供來源打席內圈同步呈現。 */
  outNumber?: 1 | 2 | 3;
  notation: string;
  /** 貢獻此進壘之打者 ID，日後計算打點 (RBI) 依據 */
  advancedByBatterId?: string;
  /** 貢獻此進壘之打擊棒次 (1-9)，早稻田進壘藍線渲染依據 */
  advancedByOrder?: number;
};

export type SpecialEvent = {
  id: string;
  inning: number;
  half: TeamSide;
  type: SpecialEventType;
  runnerId?: string;
  pitcherId?: string;
  catcherId?: string;
  fromBase?: 1 | 2 | 3;
  toBase?: 2 | 3 | 4;
  runsScored: number;
  outsBefore: number;
  notation: string;
  /** 攻方／守方暫停的可選原因；純文字備註，不參與任何棒球統計或狀態結算。 */
  reason?: string;
  /** 讓此跑者上壘的打席；用於現場、本局及單場紀錄格同步。 */
  sourceAtBatId?: string;
  timestamp: string;
};

export type Substitution = {
  id: string;
  inning: number;
  half: TeamSide;
  teamId: string;
  playerOutId: string;
  playerInId: string;
  position: string;
  type?: SubstitutionType;
  /** 換人當下進行中打席已記錄的球數；0 代表打席開始交接，缺省表示舊資料未記錄精確球序。 */
  handoffPitchNumber?: number;
  timestamp: string;
};

export type Game = {
  id: string;
  name: string;
  /** 盃賽／聯賽名稱，供跨場次統計與彙整使用。 */
  competition?: string;
  /** 賽事年齡組別；舊場次標準化時預設為 U12。 */
  ageGroup?: AgeGroup;
  venue: string;
  date: string;
  time?: string;
  weather?: WeatherCondition;
  status: GameStatus;
  homeTeamId: string;
  /** 每場登錄的主隊球員；缺省時為相容舊資料，使用固定 25 人名單。 */
  homeRegisteredPlayerIds?: string[];
  /** 主隊建立場次時確認的棒次與守備配置快照。 */
  homeLineup?: GameLineup;
  awayTeamId: string;
  /** 每場登錄的客隊球員；缺省時為相容舊資料，使用固定 25 人名單。 */
  awayRegisteredPlayerIds?: string[];
  /** 客隊建立場次時確認的棒次與守備配置快照。 */
  awayLineup?: GameLineup;
  inning: number;
  half: TeamSide;
  outs: number;
  awayBatterIndex: number;
  homeBatterIndex: number;
  score: ScoreByInning[];
  runners: RunnerState;
  events: AtBatEvent[];
  specialEvents: SpecialEvent[];
  substitutions: Substitution[];
  /** 以 `side:battingOrder:entryIndex` 鍵值保存的整體紀錄表視覺覆蓋。 */
  scorebookDisplayOverrides?: Record<string, ScorebookDisplayOverride>;
  /** 正式更正的不可覆寫稽核歷程；缺省表示舊場次尚未使用正式更正模式。 */
  formalScorebookCorrections?: FormalScorebookCorrection[];
  /** 單一投手單場投球數三段提醒；舊場次缺省時套用預設值。 */
  pitchLimitThresholds?: [number, number, number];
  /** 內建匯入資料的來源修訂；使用者建立場次與舊資料可省略。 */
  sourceRevision?: string;
  notes: string;
  maxInnings: 6 | 7 | 9 | 15;
  createdAt: string;
  updatedAt: string;
};

export type AppData = {
  schools: School[];
  teams: Team[];
  games: Game[];
  activeGameId: string | null;
  primaryTeamId?: string;
  /** 使用者明確刪除的預載賽事，不因預載資料合併而再次出現。 */
  deletedGameIds?: string[];
};

export type RecentGameSearchFilter = {
  dateFrom?: string;
  dateTo?: string;
  competition?: string;
};

/** 首頁最近比賽的日期區間與盃賽名稱搜尋。 */
export function filterRecentGames(games: Game[], filter: RecentGameSearchFilter): Game[] {
  const competitionQuery = filter.competition?.trim().toLocaleLowerCase() ?? "";
  return games
    .filter((game) => {
      const gameDate = game.date.slice(0, 10);
      const inDateRange = (!filter.dateFrom || gameDate >= filter.dateFrom) && (!filter.dateTo || gameDate <= filter.dateTo);
      const matchesCompetition = !competitionQuery || (game.competition ?? "").toLocaleLowerCase().includes(competitionQuery);
      return inDateRange && matchesCompetition;
    })
    .sort((left, right) => right.date.localeCompare(left.date));
}

export type BattingLine = {
  player: Player;
  ab: number;
  h: number;
  oneB: number;
  twoB: number;
  threeB: number;
  hr: number;
  bb: number;
  hbp: number;
  r: number;
  rbi: number;
  /** 犧牲短打次數；不計入打數。 */
  sh: number;
  /** 高飛犧牲打次數；不計入打數。 */
  sf: number;
  /** 僅由犧牲短打與高飛犧牲打產生的打點。 */
  sacRbi: number;
  so: number;
  e: number;
  avg: number;
  slg: number;
  obp: number;
  ops: number;
};

/** 單場早稻田紀錄表團隊列使用的犧牲打合計。 */
export type TeamSacrificeTotals = {
  sh: number;
  sf: number;
  sacRbi: number;
};

export type PitchingLine = {
  player: Player;
  outs: number;
  ip: string;
  pitches: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  so: number;
  era: number;
};

export type PitchLimitWarningLevel = "none" | "yellow" | "orange" | "red";
export type PitcherPitchLimitHistory = {
  pitcherId: string;
  pitches: number;
  nextThreshold?: number;
  reachedThresholds: number[];
};

export const FIELD_POSITIONS = [
  { number: "1", label: "投手" },
  { number: "2", label: "捕手" },
  { number: "3", label: "一壘" },
  { number: "4", label: "二壘" },
  { number: "5", label: "三壘" },
  { number: "6", label: "游擊" },
  { number: "7", label: "左外" },
  { number: "8", label: "中外" },
  { number: "9", label: "右外" },
];

/**
 * 將舊資料、匯入資料與表單輸入統一成最多四個不重複的正式守位代碼。
 * 亦接受既有資料中的中文守位名稱，避免一個重複值佔用名額卻未顯示在球場圖上。
 */
export function normalizePreferredPositions(positions: unknown): string[] {
  if (!Array.isArray(positions)) return [];
  const normalized = positions
    .map((value) => String(value).trim())
    .map((value) => FIELD_POSITIONS.find((position) => position.number === value || position.label === value)?.number)
    .filter((position): position is string => Boolean(position));
  return Array.from(new Set(normalized)).slice(0, 4);
}

/** 「後備」可保留於單場登錄名單，但不是正式九人守備位置。 */
export const RESERVE_POSITION = "reserve";
export const RESERVE_POSITION_LABEL = "後備";

/** 僅 1 至 9 號正式守位可讓球員進入先發棒次。 */
export function isEligibleForBattingOrder(lineup: GameLineup | undefined, playerId: string): boolean {
  const assignedPosition = lineup?.defensivePositions[playerId];
  return FIELD_POSITIONS.some((position) => position.number === assignedPosition || position.label === assignedPosition);
}

/** 回傳同時已登錄且已配置正式守位的可先發球員。 */
export function getBattingOrderEligiblePlayerIds(lineup: GameLineup | undefined, registeredPlayerIds: string[]): string[] {
  const registered = new Set(registeredPlayerIds);
  return Array.from(new Set(
    Object.keys(lineup?.defensivePositions ?? {}).filter((playerId) => registered.has(playerId) && isEligibleForBattingOrder(lineup, playerId)),
  ));
}

export const WEATHER_OPTIONS: Array<{ value: WeatherCondition; label: string; icon: string }> = [
  { value: "sunny", label: "晴天", icon: "☀" },
  { value: "cloudy", label: "陰天", icon: "☁" },
  { value: "drizzle", label: "小雨", icon: "☂" },
];

export type AgeGroup = "U18" | "U15" | "U12" | "U10" | "U8";

export const AGE_GROUP_OPTIONS: AgeGroup[] = ["U18", "U15", "U12", "U10", "U8"];

export const SPECIAL_EVENT_LABELS: Record<SpecialEventType, string> = {
  SB: "盜壘成功",
  CS: "盜壘刺",
  WP: "暴投",
  PB: "捕逸",
  BK: "投手犯規",
  ADV: "進壘",
  OFFENSIVE_TIMEOUT: "攻方暫停",
  DEFENSIVE_TIMEOUT: "守方暫停",
  INNING_END: "半局攻擊結束",
  GAME_END_EARLY: "未滿三出局結束比賽",
};

export const STAT_NEUTRAL_SPECIAL_EVENT_TYPES = ["OFFENSIVE_TIMEOUT", "DEFENSIVE_TIMEOUT", "INNING_END", "GAME_END_EARLY"] as const;

/** 早稻田書寫註記不可改變跑壘、比分、球數、出局或任何投打統計。 */
export function isStatNeutralSpecialEvent(type: SpecialEventType): type is typeof STAT_NEUTRAL_SPECIAL_EVENT_TYPES[number] {
  return (STAT_NEUTRAL_SPECIAL_EVENT_TYPES as readonly string[]).includes(type);
}

export function getSpecialEventNotation(type: SpecialEventType, fromBase?: number, toBase?: number): string {
  // 使用者已確認：盜壘維持藍色箭頭加 SB，不採 1189LAB 的單一 S 寫法。
  if (type === "SB") return "SB";
  if (type === "CS") return "CS";
  if (type === "ADV") return toBase === 4 ? "↑" : `↑${fromBase ?? ""}→${toBase ?? ""}`;
  if (type === "OFFENSIVE_TIMEOUT") return "O.C";
  if (type === "DEFENSIVE_TIMEOUT") return "T";
  if (type === "INNING_END") return "//";
  if (type === "GAME_END_EARLY") return "///";
  return type;
}

/** 對應使用者提供之早稻田個人紀錄欄球數符號，供現場格與單場紀錄共用。 */
export function getWasedaPitchMark(outcome: PitchOutcome): string {
  if (outcome === "ball") return "—";
  if (outcome === "strike") return "○";
  if (outcome === "foul") return "△";
  if (outcome === "foulTip") return "▲";
  if (outcome === "swingingStrike") return "⊖";
  if (outcome === "bunt") return "⌁";
  if (outcome === "missedBunt") return "◓";
  if (outcome === "buntFoul") return "△⌁";
  if (outcome === "foulError") return "△E";
  if (outcome === "droppedThirdStrike") return "K+";
  return "•";
}

export const RESULT_LABELS: Record<AtBatResult, string> = {
  "1B": "一壘安打",
  "2B": "二壘安打",
  "3B": "三壘安打",
  HR: "全壘打",
  BB: "四壞球",
  HBP: "觸身球",
  K: "三振",
  F: "高飛球出局",
  G: "滾地球出局",
  E: "失誤上壘",
};

export function createSeedPlayers(teamPrefix: string): Player[] {
  return Array.from({ length: 25 }, (_, index) => ({
    id: `${teamPrefix}-p${index + 1}`,
    number: index + 1,
    name: `${teamPrefix === "home" ? "主隊" : "客隊"}${index + 1}號`,
    position: FIELD_POSITIONS[index]?.label ?? "替補",
    battingOrder: index + 1,
    bats: "R" as const,
  }));
}

export function createInitialData(): AppData {
  const now = new Date().toISOString();
  const awaySchool: School = { id: "school-opponent", name: "對手球隊", players: createSeedPlayers("away"), createdAt: now, updatedAt: now };
  const homeSchool: School = { id: "school-fuxing67", name: "復興少棒67", players: createSeedPlayers("home"), createdAt: now, updatedAt: now };
  const awayTeam: Team = { id: "team-opponent", name: "對手球隊", school: awaySchool.name, schoolId: awaySchool.id, players: awaySchool.players, updatedAt: now };
  const homeTeam: Team = { id: "team-fuxing67", name: "復興少棒67", school: homeSchool.name, schoolId: homeSchool.id, players: homeSchool.players, updatedAt: now };
  const game: Game = {
    id: "game-fuxing-default",
    name: "復興少棒67｜新場次",
    competition: "",
    ageGroup: "U12",
    venue: "",
    date: now.slice(0, 10),
    weather: "sunny",
    status: "setup",
    homeTeamId: homeTeam.id,
    awayRegisteredPlayerIds: awayTeam.players.slice(0, 25).map((player) => player.id),
    homeRegisteredPlayerIds: homeTeam.players.slice(0, 25).map((player) => player.id),
    awayTeamId: awayTeam.id,
    inning: 1,
    half: "away",
    outs: 0,
    awayBatterIndex: 0,
    homeBatterIndex: 0,
    score: Array.from({ length: 9 }, (_, i) => ({ inning: i + 1, away: 0, home: 0 })),
    runners: { first: null, second: null, third: null },
    events: [],
    specialEvents: [],
    substitutions: [],
    notes: "現場紀錄備註：",
    maxInnings: 9,
    createdAt: now,
    updatedAt: now,
  };
  return { schools: [awaySchool, homeSchool], teams: [awayTeam, homeTeam], games: [game], activeGameId: game.id, primaryTeamId: homeTeam.id };
}

export function normalizeAppData(value: unknown): AppData {
  const seed = createInitialData();
  const raw = value && typeof value === "object" ? value as Partial<AppData> : {};
  const normalizePlayers = (players: Player[] | undefined) => Array.isArray(players)
    ? sortPlayersByNumber(players.map((player) => ({ ...player, preferredPositions: normalizePreferredPositions(player.preferredPositions) })))
    : [];
  const rawTeams = Array.isArray(raw.teams) && raw.teams.length > 0 ? raw.teams as Team[] : seed.teams;
  const teams = rawTeams.map((team) => ({ ...team, players: normalizePlayers(team.players) }));
  const now = new Date().toISOString();
  const schools = Array.isArray(raw.schools) && raw.schools.length > 0
    ? (raw.schools as School[]).map((school) => ({ ...school, players: normalizePlayers(school.players) }))
    : Array.from(new Map(teams.map((team) => [team.schoolId ?? `school-${team.id}`, { id: team.schoolId ?? `school-${team.id}`, name: team.school, players: team.players, createdAt: now, updatedAt: now }])).values());
  const defaultRegisteredIds = (teamId: string) => teams.find((team) => team.id === teamId)?.players.slice(0, 25).map((player) => player.id) ?? [];
  const games = Array.isArray(raw.games) && raw.games.length > 0
    ? (raw.games as Game[]).map((game) => ({
      ...game,
      competition: typeof game.competition === "string" ? game.competition : "",
      ageGroup: ["U18", "U15", "U12", "U10", "U8"].includes(game.ageGroup ?? "") ? game.ageGroup as AgeGroup : "U12",
      pitchLimitThresholds: normalizePitchLimitThresholds(game.pitchLimitThresholds),
      weather: game.weather ?? "sunny",
      awayRegisteredPlayerIds: Array.isArray(game.awayRegisteredPlayerIds) ? game.awayRegisteredPlayerIds : defaultRegisteredIds(game.awayTeamId),
      homeRegisteredPlayerIds: Array.isArray(game.homeRegisteredPlayerIds) ? game.homeRegisteredPlayerIds : defaultRegisteredIds(game.homeTeamId),
      specialEvents: Array.isArray(game.specialEvents) ? game.specialEvents : [],
      substitutions: Array.isArray(game.substitutions) ? game.substitutions : [],
    }))
    : seed.games;
  const activeGameId = typeof raw.activeGameId === "string" && games.some((game) => game.id === raw.activeGameId) ? raw.activeGameId : games[0]?.id ?? null;
  const primaryTeamId = typeof raw.primaryTeamId === "string" && teams.some((team) => team.id === raw.primaryTeamId) ? raw.primaryTeamId : teams[0]?.id;
  const deletedGameIds = Array.isArray(raw.deletedGameIds) ? raw.deletedGameIds.filter((id): id is string => typeof id === "string") : [];
  return { schools, teams, games, activeGameId, primaryTeamId, deletedGameIds };
}

export function mergeAppData(local: AppData, remote: AppData): AppData {
  const pickNewest = <T extends { updatedAt?: string }>(left: T, right: T): T => (new Date(left.updatedAt ?? "1970-01-01").getTime() >= new Date(right.updatedAt ?? "1970-01-01").getTime() ? left : right);
  const mergeById = <T extends { id: string; updatedAt?: string }>(left: T[], right: T[]) => {
    const map = new Map<string, T>();
    [...left, ...right].forEach((item) => { const existing = map.get(item.id); map.set(item.id, existing ? pickNewest(existing, item) : item); });
    return Array.from(map.values());
  };
  const deletedGameIds = Array.from(new Set([...(local.deletedGameIds ?? []), ...(remote.deletedGameIds ?? [])]));
  const deletedGameIdSet = new Set(deletedGameIds);
  const localGames = new Map(local.games.filter((game) => !deletedGameIdSet.has(game.id)).map((game) => [game.id, game]));
  const remoteGames = new Map(remote.games.filter((game) => !deletedGameIdSet.has(game.id)).map((game) => [game.id, game]));
  const gameIds = new Set([...localGames.keys(), ...remoteGames.keys()]);
  const games = Array.from(gameIds).map((id) => {
    const left = localGames.get(id);
    const right = remoteGames.get(id);
    if (!left) return right!;
    if (!right) return left;
    const base = pickNewest(left, right);
    return {
      ...base,
      events: Array.from(new Map([...left.events, ...right.events].map((event) => [event.id, event])).values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
      specialEvents: Array.from(new Map([...(left.specialEvents ?? []), ...(right.specialEvents ?? [])].map((event) => [event.id, event])).values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
      substitutions: Array.from(new Map([...left.substitutions, ...right.substitutions].map((substitution) => [substitution.id, substitution])).values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    };
  });
  const teams = mergeById(local.teams, remote.teams);
  const schools = mergeById(local.schools, remote.schools);
  const activeGameId = games.some((game) => game.id === local.activeGameId) ? local.activeGameId : remote.activeGameId;
  const primaryTeamId = local.primaryTeamId && teams.some((team) => team.id === local.primaryTeamId) ? local.primaryTeamId : remote.primaryTeamId ?? teams[0]?.id;
  return normalizeAppData({ schools, teams, games, activeGameId, primaryTeamId, deletedGameIds });
}

export function formatAvg(value: number): string {
  return value.toFixed(3).replace(/^0/, "");
}

export function formatRate(value: number): string {
  return value.toFixed(3);
}

export function getRegisteredPlayers(game: Game, team: Team): Player[] {
  const registeredIds = team.id === game.awayTeamId ? game.awayRegisteredPlayerIds : game.homeRegisteredPlayerIds;
  const lineup = team.id === game.awayTeamId ? game.awayLineup : game.homeLineup;
  const fallbackIds = new Set(team.players.slice(0, 25).map((player) => player.id));
  const ids = new Set(Array.isArray(registeredIds) ? registeredIds : fallbackIds);
  const battingOrder = new Map((lineup?.battingOrderIds ?? []).map((playerId, index) => [playerId, index]));
  return team.players
    .filter((player) => ids.has(player.id))
    .sort((left, right) => (battingOrder.get(left.id) ?? left.battingOrder ?? Number.MAX_SAFE_INTEGER) - (battingOrder.get(right.id) ?? right.battingOrder ?? Number.MAX_SAFE_INTEGER));
}

/**
 * 單場早稻田紀錄表專用的球員顯示順序。
 *
 * 固定依本場建立時儲存的先發棒次列出九人；未列入先發而實際上場的候補，
 * 以最早換入或完成打席的時間接續；其餘登錄但未上場者，才依背號置於最後。
 * 不可使用球隊固定名單的 `battingOrder`，避免後續名單編輯改寫歷史賽事順序。
 */
export function sortGameRosterForDisplay(game: Game, team: Team, side: TeamSide): Player[] {
  const lineup = side === "away" ? game.awayLineup : game.homeLineup;
  const starterOrder = new Map((lineup?.battingOrderIds ?? []).map((playerId, index) => [playerId, index]));
  const registeredPlayers = getRegisteredPlayers(game, team);
  const registeredIds = new Set(registeredPlayers.map((player) => player.id));
  const firstAppearance = new Map<string, string>();
  const noteAppearance = (playerId: string, timestamp: string) => {
    if (!registeredIds.has(playerId)) return;
    const current = firstAppearance.get(playerId);
    if (!current || timestamp < current) firstAppearance.set(playerId, timestamp);
  };

  game.substitutions
    .filter((substitution) => substitution.teamId === team.id)
    .forEach((substitution) => noteAppearance(substitution.playerInId, substitution.timestamp));
  game.events
    .filter((event) => event.half === side)
    .forEach((event) => noteAppearance(event.batterId, event.timestamp));

  return [...registeredPlayers].sort((left, right) => {
    const leftStarter = starterOrder.get(left.id);
    const rightStarter = starterOrder.get(right.id);
    if (leftStarter !== undefined || rightStarter !== undefined) {
      if (leftStarter === undefined) return 1;
      if (rightStarter === undefined) return -1;
      return leftStarter - rightStarter;
    }

    const leftAppearance = firstAppearance.get(left.id);
    const rightAppearance = firstAppearance.get(right.id);
    if (leftAppearance || rightAppearance) {
      if (!leftAppearance) return 1;
      if (!rightAppearance) return -1;
      const timeOrder = leftAppearance.localeCompare(rightAppearance);
      if (timeOrder) return timeOrder;
    }

    return left.number - right.number || left.name.localeCompare(right.name, "zh-TW");
  });
}

/**
 * 同一球員、同一局可能在不同來源打席留下跑壘事件。單場總表與本局清單
 * 應以最新打席作為格子的主要內容，並合併所有來源打席的跑壘資訊繪製藍線。
 */
export function aggregateInningRunnerEvents(events: AtBatEvent[], playerId: string, inning: number): AtBatEvent | undefined {
  const matchingEvents = events
    .filter((event) => event.batterId === playerId && event.inning === inning)
    .slice()
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const latestEvent = matchingEvents.at(-1);
  if (!latestEvent) return undefined;
  const runnerAdvances = matchingEvents.flatMap((event) => event.runnerAdvances ?? []);
  return runnerAdvances.length > 0 ? { ...latestEvent, runnerAdvances } : latestEvent;
}

/** 完成打席的查詢範圍；未指定的欄位不會限制結果。 */
export type CompletedAtBatSelectorOptions = {
  half?: TeamSide;
  inning?: number;
};

/**
 * 以時間排序取得最近一筆已完成打席。現場工作台、逐局列與壘上來源都應使用
 * 此選取器，避免各畫面各自以陣列位置或草稿狀態判斷，造成安打後的符號不同步。
 */
export function getLatestCompletedAtBat(
  events: AtBatEvent[],
  playerId?: string,
  options: CompletedAtBatSelectorOptions = {},
): AtBatEvent | undefined {
  return events
    .filter((event) => (
      (!playerId || event.batterId === playerId)
      && (!options.half || event.half === options.half)
      && (!options.inning || event.inning === options.inning)
    ))
    .slice()
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .at(-1);
}

/**
 * 取得目前壘上跑者的來源打席。跑者後續 SB、WP、PB、BK 等特殊事件會保存
 * sourceAtBatId；若尚未發生特殊事件，則回退為該跑者在目前半局的最近完成打席。
 */
export function getRunnerSourceAtBat(
  events: AtBatEvent[],
  specialEvents: SpecialEvent[] | undefined,
  runnerId: string | null | undefined,
  options: CompletedAtBatSelectorOptions = {},
): AtBatEvent | undefined {
  if (!runnerId) return undefined;
  const latestRunnerEvent = (specialEvents ?? [])
    .filter((event) => (
      event.runnerId === runnerId
      && (!options.half || event.half === options.half)
      && (!options.inning || event.inning === options.inning)
    ))
    .slice()
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .at(-1);
  const linkedSource = latestRunnerEvent?.sourceAtBatId
    ? events.find((event) => event.id === latestRunnerEvent.sourceAtBatId)
    : undefined;
  return linkedSource ?? getLatestCompletedAtBat(events, runnerId, options);
}

/** 將球隊目前的背號棒次與守備位置存成可隨新場次複製的快照。 */
export function createLineupSnapshot(team: Team, registeredPlayerIds?: string[]): GameLineup {
  const registered = new Set(registeredPlayerIds?.length ? registeredPlayerIds : team.players.slice(0, 25).map((player) => player.id));
  const players = team.players.filter((player) => registered.has(player.id));
  const battingOrderIds = [...players]
    .sort((left, right) => (left.battingOrder ?? Number.MAX_SAFE_INTEGER) - (right.battingOrder ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 9)
    .map((player) => player.id);
  const defensivePositions = Object.fromEntries(
    battingOrderIds.map((playerId) => [playerId, team.players.find((player) => player.id === playerId)?.position ?? ""]),
  );
  return { battingOrderIds, defensivePositions };
}

/** 回傳可用於建立賽事頁的九棒與九守備完成度；不會阻擋使用者以替補名單建立場次。 */
export function getLineupCompleteness(lineup: GameLineup | undefined, registeredPlayerIds: string[]): LineupCompleteness {
  const registered = new Set(registeredPlayerIds);
  const battingOrderIds = Array.from(new Set(lineup?.battingOrderIds.filter((playerId) => registered.has(playerId)) ?? [])).slice(0, 9);
  const allowedPositions = new Set(FIELD_POSITIONS.flatMap((position) => [position.number, position.label]));
  const defensivePositionCount = new Set(
    battingOrderIds
      .map((playerId) => lineup?.defensivePositions[playerId] ?? "")
      .filter((position) => allowedPositions.has(position)),
  ).size;
  return {
    battingOrderCount: battingOrderIds.length,
    defensivePositionCount,
    complete: battingOrderIds.length === 9 && defensivePositionCount === 9,
  };
}

/** 回傳同一守位被多位先發球員選擇時的衝突清單，供建立賽事頁做醒目提示。 */
export function getDefensivePositionConflicts(lineup: GameLineup | undefined): Array<{ position: string; playerIds: string[] }> {
  const assignedPlayers = new Map<string, string[]>();
  for (const [playerId, assignedPosition] of Object.entries(lineup?.defensivePositions ?? {})) {
    const normalized = FIELD_POSITIONS.find((position) => position.number === assignedPosition || position.label === assignedPosition)?.number;
    if (!normalized) continue;
    assignedPlayers.set(normalized, [...(assignedPlayers.get(normalized) ?? []), playerId]);
  }
  return Array.from(assignedPlayers.entries())
    .filter(([, playerIds]) => playerIds.length > 1)
    .map(([position, playerIds]) => ({ position, playerIds }));
}

/**
 * 依重複守位回傳可直接改派的空缺守位，以及可供快速互換的既有非衝突守位球員。
 * 僅採計本場已登錄球員，避免固定名單或前一場快照殘留的守位干擾建立流程。
 */
export function suggestDefensiveConflictFixes(lineup: GameLineup | undefined, registeredPlayerIds: string[]): DefensiveConflictFixSuggestion[] {
  if (!lineup) return [];
  const registered = new Set(registeredPlayerIds);
  const normalizePosition = (assignedPosition: string | undefined) => FIELD_POSITIONS.find((position) => position.number === assignedPosition || position.label === assignedPosition)?.number;
  const conflicts = getDefensivePositionConflicts(lineup)
    .map((conflict) => ({ ...conflict, playerIds: conflict.playerIds.filter((playerId) => registered.has(playerId)) }))
    .filter((conflict) => conflict.playerIds.length > 1);
  if (!conflicts.length) return [];

  const conflictedPlayerIds = new Set(conflicts.flatMap((conflict) => conflict.playerIds));
  const occupiedPositions = new Set(
    Object.entries(lineup.defensivePositions)
      .filter(([playerId]) => registered.has(playerId))
      .map(([, position]) => normalizePosition(position))
      .filter((position): position is string => Boolean(position)),
  );
  const availablePositions = FIELD_POSITIONS.map((position) => position.number).filter((position) => !occupiedPositions.has(position));
  const suggestedSwaps = Object.entries(lineup.defensivePositions)
    .filter(([playerId]) => registered.has(playerId) && !conflictedPlayerIds.has(playerId))
    .map(([playerId, position]) => ({ targetPlayerId: playerId, targetPosition: normalizePosition(position) }))
    .filter((suggestion): suggestion is { targetPlayerId: string; targetPosition: string } => Boolean(suggestion.targetPosition));

  let availableIndex = 0;
  return conflicts.map((conflict) => {
    const positionsForConflict = availablePositions.slice(availableIndex, availableIndex + Math.max(1, conflict.playerIds.length - 1));
    availableIndex += positionsForConflict.length;
    return {
      position: conflict.position,
      conflictingPlayerIds: conflict.playerIds,
      availablePositions: positionsForConflict,
      suggestedSwaps,
    };
  });
}

/** 互換兩位先發球員的守備位置；未設定守位的一方會承接另一方的守位。 */
export function swapDefensivePositions(lineup: GameLineup, firstPlayerId: string, secondPlayerId: string): GameLineup {
  if (firstPlayerId === secondPlayerId) return lineup;
  const defensivePositions = { ...lineup.defensivePositions };
  const firstPosition = defensivePositions[firstPlayerId];
  const secondPosition = defensivePositions[secondPlayerId];
  if (secondPosition) defensivePositions[firstPlayerId] = secondPosition;
  else delete defensivePositions[firstPlayerId];
  if (firstPosition) defensivePositions[secondPlayerId] = firstPosition;
  else delete defensivePositions[secondPlayerId];
  return { ...lineup, defensivePositions };
}

/**
 * 依雙方各自登錄名單的順序，交換主客隊的守備配置。
 *
 * 球員名單及棒次仍屬於原隊；互換後不再具正式守位的球員會自動移出棒次，
 * 以保留「棒次必須具備 1 至 9 號正式守位」的不變量。
 */
export function swapTeamDefensiveConfigurations(
  homeLineup: GameLineup,
  homeRegisteredPlayerIds: string[],
  awayLineup: GameLineup,
  awayRegisteredPlayerIds: string[],
  selectedPositions?: string[],
): { homeLineup: GameLineup; awayLineup: GameLineup } {
  const selected = selectedPositions?.length ? new Set(selectedPositions) : null;
  const applyConfiguration = (
    targetLineup: GameLineup,
    targetRegisteredPlayerIds: string[],
    sourceLineup: GameLineup,
    sourceRegisteredPlayerIds: string[],
  ): GameLineup => {
    const defensivePositions = targetRegisteredPlayerIds.reduce<Record<string, string>>((next, targetPlayerId, index) => {
      const sourcePosition = sourceLineup.defensivePositions[sourceRegisteredPlayerIds[index]];
      const currentPosition = targetLineup.defensivePositions[targetPlayerId];
      if (!selected) {
        if (sourcePosition) next[targetPlayerId] = sourcePosition;
        return next;
      }
      const shouldSwap = Boolean(sourcePosition && currentPosition && selected.has(sourcePosition) && selected.has(currentPosition));
      if (shouldSwap && sourcePosition) next[targetPlayerId] = sourcePosition;
      else if (currentPosition) next[targetPlayerId] = currentPosition;
      return next;
    }, {});
    const nextLineup = { ...targetLineup, defensivePositions };
    const eligible = new Set(getBattingOrderEligiblePlayerIds(nextLineup, targetRegisteredPlayerIds));
    return { ...nextLineup, battingOrderIds: targetLineup.battingOrderIds.filter((playerId) => eligible.has(playerId)) };
  };

  return {
    homeLineup: applyConfiguration(homeLineup, homeRegisteredPlayerIds, awayLineup, awayRegisteredPlayerIds),
    awayLineup: applyConfiguration(awayLineup, awayRegisteredPlayerIds, homeLineup, homeRegisteredPlayerIds),
  };
}

/**
 * 比較主客隊互換前後的守備配置，回傳實際變動的正式守位代號。
 * 後備不屬於球場守位，因此不會列入短暫高亮提示。
 */
export function getChangedDefensivePositions(
  previousHomeLineup: GameLineup,
  previousAwayLineup: GameLineup,
  nextHomeLineup: GameLineup,
  nextAwayLineup: GameLineup,
): string[] {
  const assignmentsAt = (lineup: GameLineup, position: string) => Object.entries(lineup.defensivePositions)
    .filter(([, assignedPosition]) => assignedPosition === position)
    .map(([playerId]) => playerId)
    .sort()
    .join("|");

  return FIELD_POSITIONS
    .map((position) => position.number)
    .filter((position) => (
      assignmentsAt(previousHomeLineup, position) !== assignmentsAt(nextHomeLineup, position)
      || assignmentsAt(previousAwayLineup, position) !== assignmentsAt(nextAwayLineup, position)
    ));
}

export function getBattingStats(game: Game, team: Team, scope: PlayerStatScope = "all"): BattingLine[] {
  const players = scope === "registered" ? getRegisteredPlayers(game, team) : team.players;
  return players.map((player) => {
    const events = game.events.filter((event) => event.batterId === player.id);
    const hits = events.filter((event) => ["1B", "2B", "3B", "HR"].includes(event.result));
    const atBats = events.filter((event) => !["BB", "HBP"].includes(event.result) && !isSacrificeBuntRecord(event.recordColumn) && !isSacrificeFlyRecord(event.recordColumn)).length;
    const sacrificeBunts = events.filter((event) => isSacrificeBuntRecord(event.recordColumn));
    const sacrificeFlies = events.filter((event) => isSacrificeFlyRecord(event.recordColumn));
    const oneB = events.filter((event) => event.result === "1B").length;
    const twoB = events.filter((event) => event.result === "2B").length;
    const threeB = events.filter((event) => event.result === "3B").length;
    const hr = events.filter((event) => event.result === "HR").length;
    const bb = events.filter((event) => event.result === "BB").length;
    const hbp = events.filter((event) => event.result === "HBP").length;
    const so = events.filter((event) => event.result === "K").length;
    const e = events.filter((event) => event.result === "E").length;
    const rbi = events.reduce((sum, event) => sum + (event.recordColumn?.rbi ?? 0), 0);
    const sacRbi = [...sacrificeBunts, ...sacrificeFlies].reduce((sum, event) => sum + (event.recordColumn?.rbi ?? 0), 0);
    const totalBases = oneB + twoB * 2 + threeB * 3 + hr * 4;
    const avg = atBats ? hits.length / atBats : 0;
    const slg = atBats ? totalBases / atBats : 0;
    const obpDenominator = atBats + bb + hbp;
    const obp = obpDenominator ? (hits.length + bb + hbp) / obpDenominator : 0;
    const specialRuns = (game.specialEvents ?? []).filter((se) => se.runnerId === player.id && se.toBase === 4 && se.type !== "CS").length;
    const eventRuns = game.events.reduce((sum, event) => {
      if (event.batterId === player.id && event.result === "HR") return sum;
      const advs = (event.runnerAdvances ?? []).filter((adv) => adv.toBase === 4 && adv.type !== "LOB");
      const matched = advs.filter((adv) => adv.runnerId === player.id).length;
      return sum + matched;
    }, 0);
    const runsCount = hr + specialRuns + eventRuns;
    return {
      player,
      ab: atBats,
      h: hits.length,
      oneB,
      twoB,
      threeB,
      hr,
      bb,
      hbp,
      r: runsCount,
      rbi,
      sh: sacrificeBunts.length,
      sf: sacrificeFlies.length,
      sacRbi,
      so,
      e,
      avg,
      slg,
      obp,
      ops: slg + obp,
    };
  });
}

export function getGamesForTeam(games: Game[], teamId: string): Game[] {
  return games.filter((game) => game.homeTeamId === teamId || game.awayTeamId === teamId);
}

export type StatisticsFilterMode = "game" | "date" | "month" | "cup";

export type StatisticsGameFilter = {
  mode: StatisticsFilterMode;
  gameId?: string;
  start?: string;
  end?: string;
  competitions?: string[];
};

/** 依單場、日期區間、月份區間或一個以上盃賽名稱篩選統計賽事。 */
export function filterGamesForStatistics(games: Game[], filter: StatisticsGameFilter): Game[] {
  if (filter.mode === "game") return filter.gameId ? games.filter((game) => game.id === filter.gameId) : [];
  if (filter.mode === "date") return games.filter((game) => (!filter.start || game.date.slice(0, 10) >= filter.start) && (!filter.end || game.date.slice(0, 10) <= filter.end));
  if (filter.mode === "month") return games.filter((game) => (!filter.start || game.date.slice(0, 7) >= filter.start) && (!filter.end || game.date.slice(0, 7) <= filter.end));
  const selectedCompetitions = new Set((filter.competitions ?? []).map((competition) => competition.trim()).filter(Boolean));
  return selectedCompetitions.size ? games.filter((game) => selectedCompetitions.has(game.competition?.trim() ?? "")) : [];
}

export function getSeasonBattingStats(games: Game[], team: Team, scope: PlayerStatScope = "all"): BattingLine[] {
  if (games.length === 0) return getBattingStats(createInitialData().games[0], team, scope);
  const teamPlayerIds = new Set(team.players.map((player) => player.id));
  const registeredPlayerIds = new Set(games.flatMap((game) => team.id === game.awayTeamId ? game.awayRegisteredPlayerIds ?? [] : team.id === game.homeTeamId ? game.homeRegisteredPlayerIds ?? [] : []));
  const aggregate = {
    ...games[0],
    events: games.flatMap((game) => game.events).filter((event) => teamPlayerIds.has(event.batterId)),
    awayRegisteredPlayerIds: team.id === games[0].awayTeamId ? [...registeredPlayerIds] : games[0].awayRegisteredPlayerIds,
    homeRegisteredPlayerIds: team.id === games[0].homeTeamId ? [...registeredPlayerIds] : games[0].homeRegisteredPlayerIds,
  };
  return getBattingStats(aggregate, team, scope);
}

export type TeamPerformanceSummary = {
  games: number;
  runs: number;
  hits: number;
  walks: number;
  strikeouts: number;
  errors: number;
  stolenBases: number;
  caughtStealing: number;
  wildPitches: number;
  passedBalls: number;
};

export function getTeamPerformanceSummary(games: Game[], team: Team): TeamPerformanceSummary {
  const playerIds = new Set(team.players.map((player) => player.id));
  const teamGames = getGamesForTeam(games, team.id);
  const events = teamGames.flatMap((game) => game.events).filter((event) => playerIds.has(event.batterId));
  const teamSpecialEvents = teamGames.flatMap((game) => (game.specialEvents ?? []).map((event) => ({ game, event }))).filter(({ game, event }) => {
    const isBattingSide = (event.half === "away" ? game.awayTeamId : game.homeTeamId) === team.id;
    const isPitchingSide = !isBattingSide;
    return ["SB", "CS"].includes(event.type) ? isBattingSide : isPitchingSide;
  }).map(({ event }) => event);
  return {
    games: teamGames.length,
    runs: teamGames.reduce((sum, game) => sum + getTeamRuns(game, game.homeTeamId === team.id ? "home" : "away"), 0),
    hits: events.filter((event) => ["1B", "2B", "3B", "HR"].includes(event.result)).length,
    walks: events.filter((event) => event.result === "BB").length,
    strikeouts: events.filter((event) => event.result === "K").length,
    errors: events.filter((event) => event.result === "E").length,
    stolenBases: teamSpecialEvents.filter((event) => event.type === "SB").length,
    caughtStealing: teamSpecialEvents.filter((event) => event.type === "CS").length,
    wildPitches: teamSpecialEvents.filter((event) => event.type === "WP").length,
    passedBalls: teamSpecialEvents.filter((event) => event.type === "PB").length,
  };
}

export function getPitchingStats(game: Game, team: Team, scope: PlayerStatScope = "all"): PitchingLine[] {
  const players = scope === "registered" ? getRegisteredPlayers(game, team) : team.players;
  const pitcherIdsWithEvents = new Set(game.events.map((e) => e.pitcherId).filter(Boolean));
  const pitcherIdsInSubs = new Set(
    (game.substitutions ?? [])
      .filter((s) => s.teamId === team.id && (s.position === "投手" || s.type === "換投" || s.type === "RP"))
      .map((s) => s.playerInId)
  );

  return players.filter((player) =>
    player.position === "投手" ||
    player.number === 1 ||
    pitcherIdsWithEvents.has(player.id) ||
    pitcherIdsInSubs.has(player.id)
  ).map((player) => {
    const events = game.events.filter((event) => event.pitcherId === player.id);
    const outs = events.filter(isAtBatOut).length;
    const h = events.filter((event) => ["1B", "2B", "3B", "HR"].includes(event.result)).length;
    const bb = events.filter((event) => event.result === "BB").length;
    const so = events.filter((event) => event.result === "K").length;
    const runs = events.reduce((sum, event) => sum + event.runsScored, 0);
    const era = outs ? (runs * 27) / outs : 0;
    return { player, outs, ip: `${Math.floor(outs / 3)}.${outs % 3}`, pitches: events.reduce((sum, event) => sum + event.pitches.total, 0), h, r: runs, er: runs, bb, so, era };
  });
}

export const DEFAULT_PITCH_LIMIT_THRESHOLDS: [number, number, number] = [50, 70, 85];

export function normalizePitchLimitThresholds(value: unknown): [number, number, number] {
  if (!Array.isArray(value)) return DEFAULT_PITCH_LIMIT_THRESHOLDS;
  const values = value.map(Number).filter((item) => Number.isInteger(item) && item > 0).sort((left, right) => left - right);
  return values.length === 3 && values[0] < values[1] && values[1] < values[2]
    ? [values[0], values[1], values[2]]
    : DEFAULT_PITCH_LIMIT_THRESHOLDS;
}

export function getPitcherGamePitchCount(game: Game, pitcherId: string): number {
  return game.events.filter((event) => event.pitcherId === pitcherId).reduce((sum, event) => sum + event.pitches.total, 0);
}

export function getPitchLimitWarning(pitches: number, thresholds: readonly number[] = DEFAULT_PITCH_LIMIT_THRESHOLDS): { level: PitchLimitWarningLevel; nextThreshold?: number; reachedThresholds: number[] } {
  const ordered = normalizePitchLimitThresholds(thresholds);
  const nextThreshold = ordered.find((threshold) => threshold > pitches);
  const remaining = nextThreshold === undefined ? undefined : nextThreshold - pitches;
  const level: PitchLimitWarningLevel = remaining === undefined || remaining > 3 ? "none" : remaining === 3 ? "yellow" : remaining === 2 ? "orange" : "red";
  return { level, nextThreshold, reachedThresholds: ordered.filter((threshold) => pitches >= threshold) };
}

export function getPitcherPitchLimitHistories(game: Game): PitcherPitchLimitHistory[] {
  const pitcherIds = Array.from(new Set([
    ...game.events.map((event) => event.pitcherId),
    ...game.substitutions.filter((substitution) => substitution.type === "換投").map((substitution) => substitution.playerInId),
  ].filter(Boolean)));
  const thresholds = normalizePitchLimitThresholds(game.pitchLimitThresholds);
  return pitcherIds.map((pitcherId) => {
    const pitches = getPitcherGamePitchCount(game, pitcherId);
    const warning = getPitchLimitWarning(pitches, thresholds);
    return { pitcherId, pitches, nextThreshold: warning.nextThreshold, reachedThresholds: warning.reachedThresholds };
  });
}

export type ZoneHeatmap = {
  counts: number[];
  total: number;
  outsideCounts: number[];
  outsideTotal: number;
};

function emptyZoneHeatmap(): ZoneHeatmap {
  return { counts: Array.from({ length: 9 }, () => 0), total: 0, outsideCounts: Array.from({ length: 16 }, () => 0), outsideTotal: 0 };
}

function addZone(heatmap: ZoneHeatmap, zone: number | undefined): void {
  if (!zone || zone < 1 || zone > 25) return;
  if (zone <= 9) heatmap.counts[zone - 1] += 1;
  else {
    heatmap.outsideCounts[zone - 10] += 1;
    heatmap.outsideTotal += 1;
  }
  heatmap.total += 1;
}

function matchesPitchFilter(type: PitchType | undefined, filter: PitchFilter): boolean {
  return filter === "all" || type === filter;
}

/** 將每個打席保存的逐球九宮格落點彙整為可視化熱點資料。 */
export function getPitchZoneHeatmap(game: Game, filter: PitchFilter = "all", pitcherId?: string, batterId?: string, inning?: number): ZoneHeatmap {
  const heatmap = emptyZoneHeatmap();
  game.events
    .filter((event) => (!pitcherId || event.pitcherId === pitcherId) && (!batterId || event.batterId === batterId) && (!inning || event.inning === inning))
    .forEach((event) => {
      const locations = event.pitches.locations;
      if (locations?.length) {
        locations.filter((pitch) => matchesPitchFilter(pitch.type, filter)).forEach((pitch) => addZone(heatmap, pitch.zone));
        return;
      }
      if (matchesPitchFilter(event.pitchType, filter)) addZone(heatmap, event.zone);
    });
  return heatmap;
}

/** 將每次擊球的落點依該球的球種篩選並彙整為九區分佈。 */
export function getHitZoneHeatmap(game: Game, filter: PitchFilter = "all", batterId?: string, pitcherId?: string, inning?: number): ZoneHeatmap {
  const heatmap = emptyZoneHeatmap();
  game.events
    .filter((event) => (!batterId || event.batterId === batterId) && (!pitcherId || event.pitcherId === pitcherId) && (!inning || event.inning === inning))
    .forEach((event) => {
      const terminalPitchType = event.hitPitchType ?? event.pitchType ?? event.pitches.locations?.at(-1)?.type;
      if (matchesPitchFilter(terminalPitchType, filter)) addZone(heatmap, event.hitZone);
    });
  return heatmap;
}

export type PlayerHeatmapRates = {
  pitchTotal: number;
  strikes: number;
  balls: number;
  swingingStrikes: number;
  plateAppearances: number;
  hits: number;
  walks: number;
  extraBaseHits: number;
  whiffRate: number;
  hitRate: number;
  walkRate: number;
  extraBaseRate: number;
};

export type PlayerHeatmapAnalytics = {
  pitchingZone: ZoneHeatmap;
  battingZone: ZoneHeatmap;
  pitching: PlayerHeatmapRates;
  batting: PlayerHeatmapRates;
};

function createPlayerHeatmapRates(): PlayerHeatmapRates {
  return {
    pitchTotal: 0,
    strikes: 0,
    balls: 0,
    swingingStrikes: 0,
    plateAppearances: 0,
    hits: 0,
    walks: 0,
    extraBaseHits: 0,
    whiffRate: 0,
    hitRate: 0,
    walkRate: 0,
    extraBaseRate: 0,
  };
}

function finalizePlayerHeatmapRates(rates: PlayerHeatmapRates): PlayerHeatmapRates {
  const plateAppearances = Math.max(rates.plateAppearances, 1);
  const pitchTotal = Math.max(rates.pitchTotal, 1);
  return {
    ...rates,
    whiffRate: rates.swingingStrikes / pitchTotal,
    hitRate: rates.hits / plateAppearances,
    walkRate: rates.walks / plateAppearances,
    extraBaseRate: rates.extraBaseHits / plateAppearances,
  };
}

function addPlayerPitchLocations(rates: PlayerHeatmapRates, event: AtBatEvent): void {
  const locations = event.pitches.locations?.length
    ? event.pitches.locations
    : event.zone && event.pitchType
      ? [{ zone: event.zone, type: event.pitchType, outcome: "inPlay" as PitchOutcome }]
      : [];
  locations.forEach((pitch) => {
    rates.pitchTotal += 1;
    if (pitch.outcome === "ball") rates.balls += 1;
    else rates.strikes += 1;
    if (pitch.outcome === "swingingStrike" || pitch.outcome === "missedBunt") rates.swingingStrikes += 1;
  });
}

/**
 * 個人熱區以目前統計範圍內的比賽聚合資料計算。
 * 投球區取該投手投出的落點；打擊區取該打者面對的投球落點，視覺鏡像由介面依打擊慣用手處理。
 */
export function getPlayerHeatmapAnalytics(game: Game, playerId: string): PlayerHeatmapAnalytics {
  const pitching = createPlayerHeatmapRates();
  const batting = createPlayerHeatmapRates();
  const isHit = (result: AtBatResult) => ["1B", "2B", "3B", "HR"].includes(result);
  const isExtraBaseHit = (result: AtBatResult) => ["2B", "3B", "HR"].includes(result);

  game.events.forEach((event) => {
    if (event.pitcherId === playerId) {
      addPlayerPitchLocations(pitching, event);
      pitching.plateAppearances += 1;
      if (isHit(event.result)) pitching.hits += 1;
      if (event.result === "BB") pitching.walks += 1;
      if (isExtraBaseHit(event.result)) pitching.extraBaseHits += 1;
    }
    if (event.batterId === playerId) {
      addPlayerPitchLocations(batting, event);
      batting.plateAppearances += 1;
      if (isHit(event.result)) batting.hits += 1;
      if (event.result === "BB") batting.walks += 1;
      if (isExtraBaseHit(event.result)) batting.extraBaseHits += 1;
    }
  });

  return {
    pitchingZone: getPitchZoneHeatmap(game, "all", playerId),
    battingZone: getPitchZoneHeatmap(game, "all", undefined, playerId),
    pitching: finalizePlayerHeatmapRates(pitching),
    batting: finalizePlayerHeatmapRates(batting),
  };
}

export function getTeamRuns(game: Game, side: TeamSide): number {
  return game.score.reduce((sum, inning) => sum + inning[side], 0);
}

export function getTeamHits(game: Game, teamId: string): number {
  return game.events.filter((event) => event.batterId.startsWith(teamId.replace("team-", ""))).filter((event) => ["1B", "2B", "3B", "HR"].includes(event.result)).length;
}

export function getTeamEventCount(game: Game, team: Team, result: AtBatResult): number {
  return game.events.filter((event) => event.batterId.startsWith(team.id.replace("team-", "")) && event.result === result).length;
}

export function getNotation(result: AtBatResult, fieldingPosition: string): string {
  if (result === "K") return "K";
  if (result === "BB") return "B";
  if (result === "HBP") return "DB";
  if (result === "E") return `E${fieldingPosition}`;
  if (result === "F") return `⌒${fieldingPosition}`;
  if (result === "G") return `＿${fieldingPosition}ー3`;
  if (result === "1B" || result === "2B" || result === "3B" || result === "HR") return result;
  return result;
}

export function nextSpecialRunnerState(runners: RunnerState, type: SpecialEventType, fromBase?: 1 | 2 | 3, toBase?: 2 | 3 | 4): { runners: RunnerState; runs: number; outsAdded: number } {
  const next: RunnerState = { ...runners };
  let runs = 0;
  let outsAdded = 0;
  const keyFor = (base: number) => (base === 1 ? "first" : base === 2 ? "second" : "third") as "first" | "second" | "third";

  // O.C、T、//、/// 是記錄註記；明確 no-op，避免後續擴充時誤當成跑壘事件。
  if (isStatNeutralSpecialEvent(type)) return { runners: next, runs, outsAdded };
  if ((type === "SB" || type === "BK" || type === "ADV") && fromBase) {
    const runner = next[keyFor(fromBase)];
    if (runner) {
      next[keyFor(fromBase)] = null;
      if (toBase === 4) runs = 1;
      else if (toBase) next[keyFor(toBase)] = runner;
    }
  } else if (type === "CS" && fromBase) {
    next[keyFor(fromBase)] = null;
    outsAdded = 1;
  } else if (type === "WP" || type === "PB") {
    if (next.third) runs += 1;
    next.third = next.second;
    next.second = next.first;
    next.first = null;
  }
  return { runners: next, runs, outsAdded };
}

/**
 * 建立 WP／PB／BK 共用的跑者推進確認摘要。
 * 依三、二、一壘順序回傳，先列出可能得分的跑者，便於紀錄員確認。
 */
export function buildSpecialEventRunnerSummary(
  type: Extract<SpecialEventType, "WP" | "PB" | "BK">,
  runners: RunnerState,
): SpecialEventRunnerAdvanceSummary[] {
  const advances: Array<{ fromBase: 1 | 2 | 3; runnerId: string | null; toBase: 2 | 3 | 4 }> = [
    { fromBase: 3, runnerId: runners.third, toBase: 4 },
    { fromBase: 2, runnerId: runners.second, toBase: 3 },
    { fromBase: 1, runnerId: runners.first, toBase: 2 },
  ];

  return advances
    .filter((advance): advance is { fromBase: 1 | 2 | 3; runnerId: string; toBase: 2 | 3 | 4 } => Boolean(advance.runnerId))
    .map((advance) => ({
      runnerId: advance.runnerId,
      fromBase: advance.fromBase,
      toBase: advance.toBase,
      scores: advance.toBase === 4,
    }));
}

/** 不死三振僅在一壘無人，或該半局已有兩出局時成立。 */
export function isDroppedThirdStrikeLegal(runners: RunnerState, outs: number): boolean {
  return !runners.first || outs >= 2;
}

/**
 * 未接捕第三好球的可用性必須依打席開始前壘況判斷。一壘無人或兩出局時，
 * 打者才可嘗試跑向一壘；否則仍為一般三振出局，不能記為 K+。
 */
export function getDroppedThirdStrikeEligibility(runners: RunnerState, outs: number): {
  allowed: boolean;
  reason?: string;
} {
  if (!runners.first) return { allowed: true };
  if (outs >= 2) return { allowed: true };
  return { allowed: false, reason: "一壘已有跑者且未滿兩出局，不可記錄不死三振 K+。" };
}

/** 相容舊資料的 K+ 修飾符，並以獨立欄位保存新資料的合法不死三振。 */
export function isDroppedThirdStrike(event: Pick<AtBatEvent, "result" | "recordColumn" | "droppedThirdStrike">): boolean {
  return event.result === "K" && Boolean(
    event.droppedThirdStrike || event.recordColumn?.modifiers?.some((modifier) => /不死三振|dropped\s*third|K\+/i.test(modifier)),
  );
}

/** 合法不死三振不加打席出局數；三振統計仍由結果 K 正確累計。 */
export function isAtBatOut(event: Pick<AtBatEvent, "result" | "recordColumn" | "droppedThirdStrike">): boolean {
  return event.result === "F" || event.result === "G" || (event.result === "K" && !isDroppedThirdStrike(event));
}

/** 觸擊界外若發生在兩好球後，即依正式棒球規則判為第三好球出局。 */
export function isBuntFoulStrikeout(outcome: PitchOutcome, strikesBeforePitch: number): boolean {
  return outcome === "buntFoul" && strikesBeforePitch >= 2;
}

export const SACRIFICE_BUNT_MODIFIER = "犧牲短打（SH）";
export const SACRIFICE_FLY_MODIFIER = "高飛犧牲打（SF）";
export const SACRIFICE_FLY_NO_SCORE_REASON_LABELS: Record<SacrificeFlyNoScoreReason, string> = {
  no_third_runner: "三壘無跑者",
  runner_held_at_third: "跑者未衝本壘",
  runner_out_at_home: "守備傳殺於本壘",
};

export function isSacrificeBuntRecord(recordColumn?: RecordColumn): boolean {
  return Boolean(recordColumn?.modifiers?.includes(SACRIFICE_BUNT_MODIFIER));
}

export function isSacrificeFlyRecord(recordColumn?: RecordColumn): boolean {
  return Boolean(recordColumn?.modifiers?.includes(SACRIFICE_FLY_MODIFIER));
}

export function isSacrificeFlyRunnerOutAtHome(recordColumn?: RecordColumn): boolean {
  return isSacrificeFlyRecord(recordColumn) && recordColumn?.sacrificeFlyNoScoreReason === "runner_out_at_home";
}

/** 高飛犧牲打的必要跑者條件：三壘必須有可利用高飛球回本的跑者。 */
export function canSacrificeFly(runners: RunnerState): boolean {
  return Boolean(runners.third);
}

/** 成功犧牲短打：打者出局、既有跑者各推進一壘；三壘跑者回本並產生本打席打點提示。 */
export function getSacrificeBuntAdvancement(runners: RunnerState): { runners: RunnerState; runs: number; advances: RunnerAdvanceRecord[] } {
  const advances: RunnerAdvanceRecord[] = [];
  if (runners.third) advances.push({ id: "sac-3-4", type: "ADV", fromBase: 3, toBase: 4, notation: "SH 3→本" });
  if (runners.second) advances.push({ id: "sac-2-3", type: "ADV", fromBase: 2, toBase: 3, notation: "SH 2→3" });
  if (runners.first) advances.push({ id: "sac-1-2", type: "ADV", fromBase: 1, toBase: 2, notation: "SH 1→2" });
  return {
    runners: { first: null, second: runners.first, third: runners.second },
    runs: runners.third ? 1 : 0,
    advances,
  };
}

/** 高飛犧牲打：三壘跑者利用高飛球回本，打者出局並獲得打點；不計打數。 */
export function getSacrificeFlyAdvancement(runners: RunnerState, noScoreReason?: SacrificeFlyNoScoreReason): { runners: RunnerState; runs: number; advances: RunnerAdvanceRecord[] } {
  if (!runners.third || noScoreReason === "no_third_runner" || noScoreReason === "runner_held_at_third") {
    return { runners, runs: 0, advances: [] };
  }
  if (noScoreReason === "runner_out_at_home") {
    return {
      runners: { ...runners, third: null },
      runs: 0,
      advances: [{ id: "sf-3-4-out", type: "CS", fromBase: 3, toBase: 4, notation: "SF 3→本刺" }],
    };
  }
  const advances: RunnerAdvanceRecord[] = [{ id: "sf-3-4", type: "ADV", fromBase: 3, toBase: 4, notation: "SF 3→本" }];
  return {
    runners: { first: runners.first, second: runners.second, third: null },
    runs: 1,
    advances,
  };
}

/** 將已算出的個別打擊線彙總為單場早稻田紀錄表的團隊犧牲打合計。 */
export function getTeamSacrificeTotals(lines: Array<Pick<BattingLine, "sh" | "sf" | "sacRbi">>): TeamSacrificeTotals {
  return lines.reduce<TeamSacrificeTotals>((totals, line) => ({
    sh: totals.sh + line.sh,
    sf: totals.sf + line.sf,
    sacRbi: totals.sacRbi + line.sacRbi,
  }), { sh: 0, sf: 0, sacRbi: 0 });
}

export function nextRunnerState(runners: RunnerState, result: AtBatResult, batterId: string, options?: { droppedThirdStrike?: boolean; outs?: number }): { runners: RunnerState; runs: number } {
  const droppedThirdStrike = Boolean(options?.droppedThirdStrike && isDroppedThirdStrikeLegal(runners, options?.outs ?? 0));
  if (result === "BB" || result === "HBP" || (result === "K" && droppedThirdStrike)) {
    if (!runners.first) return { runners: { ...runners, first: batterId }, runs: 0 };
    if (!runners.second) return { runners: { ...runners, second: runners.first, first: batterId }, runs: 0 };
    if (!runners.third) return { runners: { ...runners, third: runners.second, second: runners.first, first: batterId }, runs: 0 };
    return { runners: { first: batterId, second: runners.first, third: runners.second }, runs: 1 };
  }
  if (["1B", "2B", "3B", "HR"].includes(result)) {
    const bases = result === "1B" ? 1 : result === "2B" ? 2 : result === "3B" ? 3 : 4;
    // 安打的預設結算必須讓既有跑者至少推進與打者相同的壘數。
    // 例如一壘有人、打者擊出 1B 時，原一壘跑者自動到二壘；
    // 若守備選擇處理原跑者而未讓其推進，應由 FC 結果處理，不能同時把兩人留在一壘。
    const next: RunnerState = { first: null, second: null, third: null };
    let runs = 0;
    const advanceRunner = (runnerId: string | null, fromBase: 1 | 2 | 3) => {
      if (!runnerId) return;
      const destination = fromBase + bases;
      if (destination >= 4) {
        runs += 1;
        return;
      }
      next[["first", "second", "third"][destination - 1] as "first" | "second" | "third"] = runnerId;
    };
    advanceRunner(runners.third, 3);
    advanceRunner(runners.second, 2);
    advanceRunner(runners.first, 1);
    if (bases === 4) runs += 1;
    else next[["first", "second", "third"][bases - 1] as "first" | "second" | "third"] = batterId;
    return { runners: next, runs };
  }
  return { runners, runs: 0 };
}

/**
 * 保送、觸身球與合法不死三振使既有跑者被迫推進時，將推進保留在跑者的來源打席。
 * 此函式只建立早稻田視覺紀錄，不參與壘包、比分或出局數結算；實際結算仍統一由
 * nextRunnerState 處理，以避免同一規則在兩處改寫而不同步。
 */
export function getForcedBaseOnBallsAdvances(
  runners: RunnerState,
  result: AtBatResult,
  eventId: string,
  options?: { droppedThirdStrike?: boolean; outs?: number },
): Array<{ runnerId: string; advance: RunnerAdvanceRecord }> {
  const droppedThirdStrike = Boolean(options?.droppedThirdStrike && isDroppedThirdStrikeLegal(runners, options?.outs ?? 0));
  if (result !== "BB" && result !== "HBP" && !(result === "K" && droppedThirdStrike)) return [];

  // 一壘沒有跑者時，打者本身上一壘由結果（BB／HBP／K+）繪製，沒有前位跑者進壘資料。
  if (!runners.first) return [];

  const cause = result === "HBP" ? "HBP（DB）" : result === "BB" ? "B" : "K+";
  const forced: Array<readonly [1 | 2 | 3, string, 2 | 3 | 4]> = [[1, runners.first, 2]];
  if (runners.second) forced.unshift([2, runners.second, 3]);
  if (runners.third) forced.unshift([3, runners.third, 4]);

  return forced.map(([fromBase, runnerId, toBase]) => ({
    runnerId,
    advance: {
      id: `${eventId}-forced-${runnerId}-${fromBase}-${toBase}`,
      type: "ADV",
      fromBase,
      toBase,
      notation: `${cause} 強制 ${fromBase}→${toBase}`,
    },
  }));
}

/**
 * 野手選擇（FC）：守備優先封殺原一壘跑者時，打者安全上一壘。
 * 若一壘原本無跑者，僅記錄打者上一壘，不額外增加出局數。
 */
export function nextFieldersChoiceRunnerState(runners: RunnerState, batterId: string): { runners: RunnerState; runs: number } {
  return {
    runners: {
      first: batterId,
      second: runners.second,
      third: runners.third,
    },
    runs: 0,
  };
}

export function getCurrentBatter(game: Game, team: Team): Player {
  const index = game.half === "away" ? game.awayBatterIndex : game.homeBatterIndex;
  const registeredPlayers = getRegisteredPlayers(game, team);
  const battingPool = registeredPlayers.length > 0 ? registeredPlayers : team.players;
  
  // 棒球打序以 9 人為一輪槽位 (0~8)
  const slotIndex = index % 9;

  // 檢查是否有針對該棒次/球員的代打 (PH) 更換
  const teamSubs = (game.substitutions ?? []).filter((s) => s.teamId === team.id && (s.type === "代打" || s.type === "PH"));
  const lastSub = teamSubs.reverse().find((s) => {
    const outPlayer = team.players.find((p) => p.id === s.playerOutId);
    return outPlayer ? (outPlayer.number - 1) % 9 === slotIndex : false;
  });

  if (lastSub) {
    const inPlayer = team.players.find((p) => p.id === lastSub.playerInId);
    if (inPlayer) return inPlayer;
  }

  return battingPool[slotIndex] ?? team.players[0];
}

export function getCurrentPitcher(game: Game, homeTeam: Team, awayTeam: Team): Player {
  const pitchingTeam = game.half === "away" ? homeTeam : awayTeam;
  const registeredPlayers = getRegisteredPlayers(game, pitchingTeam);
  const latestPitcherChange = [...(game.substitutions ?? [])].reverse().find((substitution) => substitution.teamId === pitchingTeam.id && substitution.position.includes("投手"));
  return (latestPitcherChange && pitchingTeam.players.find((player) => player.id === latestPitcherChange.playerInId)) ?? registeredPlayers.find((player) => player.number === 1 || player.position === "投手") ?? pitchingTeam.players.find((player) => player.number === 1) ?? pitchingTeam.players[0];
}

export function getRecentEvents(game: Game, teams: Team[]): Array<AtBatEvent & { batterName: string }> {
  return game.events.slice(-6).reverse().map((event) => ({
    ...event,
    batterName: teams.flatMap((team) => team.players).find((player) => player.id === event.batterId)?.name ?? "未知球員",
  }));
}

export function getInningRows(game: Game): ScoreByInning[] {
  const lastRecordedInning = Math.max(
    game.inning,
    game.maxInnings,
    ...game.score.map((row) => row.inning),
    ...game.events.map((event) => event.inning),
    ...(game.specialEvents ?? []).map((event) => event.inning),
  );
  return ensureScoreThroughInning(game.score, lastRecordedInning);
}

/**
 * 將逐局比分補足至指定局數。正式賽事可自然超過預定的 6／7／9／15 局；
 * 原資料未預先建立的延長局會以 0:0 欄位補上，供計分與照片式比分板共同使用。
 */
export function ensureScoreThroughInning(score: ScoreByInning[], inning: number): ScoreByInning[] {
  const rowMap = new Map(score.map((row) => [row.inning, { ...row }]));
  const finalInning = Math.max(1, inning, ...rowMap.keys());
  return Array.from({ length: finalInning }, (_, index) => rowMap.get(index + 1) ?? ({ inning: index + 1, away: 0, home: 0 }));
}

function appendInningEndAnnotation(events: SpecialEvent[], source: Pick<SpecialEvent, "id" | "inning" | "half" | "timestamp">): SpecialEvent[] {
  if (events.some((event) => event.type === "INNING_END" && event.inning === source.inning && event.half === source.half)) return events;
  return [...events, {
    id: `${source.id}-inning-end`,
    inning: source.inning,
    half: source.half,
    type: "INNING_END",
    runsScored: 0,
    outsBefore: 3,
    notation: getSpecialEventNotation("INNING_END"),
    timestamp: source.timestamp,
  }];
}

/**
 * 將純書寫註記附加到完整賽事紀錄；刻意保留其餘 Game 欄位原值。
 * 因此 O.C、T、//、/// 永遠不會改變比分、跑者、出局數或投打統計。
 */
export function appendStatNeutralSpecialEvent(game: Game, event: SpecialEvent): Game {
  if (!isStatNeutralSpecialEvent(event.type)) return game;
  const existingEvents = game.specialEvents ?? [];
  const alreadyRecorded = existingEvents.some((item) => item.id === event.id || (
    item.type === event.type && item.inning === event.inning && item.half === event.half && item.notation === event.notation
  ));
  if (alreadyRecorded) return game;
  return {
    ...game,
    specialEvents: [...existingEvents, { ...event, runsScored: 0 }],
    updatedAt: new Date().toISOString(),
  };
}

/** 使用者手動結束比賽時，以 /// 留下未滿三出局的可追溯註記。 */
export function finishGameWithEarlyEndAnnotation(game: Game): Game {
  const now = new Date().toISOString();
  const annotation: SpecialEvent = {
    id: `game-end-early-${Date.now()}`,
    inning: game.inning,
    half: game.half,
    type: "GAME_END_EARLY",
    runsScored: 0,
    outsBefore: game.outs,
    notation: getSpecialEventNotation("GAME_END_EARLY"),
    timestamp: now,
  };
  const withAnnotation = appendStatNeutralSpecialEvent(game, annotation);
  return { ...withAnnotation, status: "final", updatedAt: now };
}

export function updateGameAfterSpecialEvent(game: Game, event: SpecialEvent, runnerState: RunnerState, runs: number, outsAdded: number): Game {
  if (isStatNeutralSpecialEvent(event.type)) return appendStatNeutralSpecialEvent(game, event);
  const nextScore = ensureScoreThroughInning(game.score, event.inning).map((row) => row.inning === event.inning ? { ...row, [event.half]: row[event.half] + runs } : row);
  const nextOuts = game.outs + outsAdded;
  const halfEnded = nextOuts >= 3;
  const nextHalf: TeamSide = halfEnded ? (game.half === "away" ? "home" : "away") : game.half;
  const nextInning = halfEnded && game.half === "home" ? game.inning + 1 : game.inning;
  const sourceAtBat = event.runnerId
    ? [...game.events].reverse().find((atBat) => atBat.batterId === event.runnerId)
    : undefined;
  const linkedEvent = sourceAtBat ? { ...event, sourceAtBatId: sourceAtBat.id } : event;
  const advance: RunnerAdvanceRecord = {
    id: linkedEvent.id,
    type: linkedEvent.type,
    fromBase: linkedEvent.fromBase,
    toBase: linkedEvent.toBase,
    ...(linkedEvent.type === "CS" ? { outNumber: Math.min(linkedEvent.outsBefore + 1, 3) as 1 | 2 | 3 } : {}),
    notation: linkedEvent.notation,
  };
  const eventsWithAdvance = sourceAtBat
    ? game.events.map((atBat) => atBat.id === sourceAtBat.id
      ? {
        ...atBat,
        // 跑者因特殊事件回本時，得分圓點必須留在該跑者的來源打席；
        // BK 本身不計為下一棒的一顆投球，也不會產生打點。
        runsScored: runs > 0 ? (atBat.runsScored ?? 0) + runs : atBat.runsScored,
        runnerAdvances: [...(atBat.runnerAdvances ?? []), advance],
      }
      : atBat)
    : game.events;
  return {
    ...game,
    status: "live",
    inning: nextInning,
    half: nextHalf,
    outs: halfEnded ? 0 : nextOuts,
    runners: halfEnded ? { first: null, second: null, third: null } : runnerState,
    score: nextScore,
    events: halfEnded ? markLeftOnBase(eventsWithAdvance, runnerState, linkedEvent.id) : eventsWithAdvance,
    specialEvents: halfEnded
      ? appendInningEndAnnotation([...(game.specialEvents ?? []), linkedEvent], linkedEvent)
      : [...(game.specialEvents ?? []), linkedEvent],
    updatedAt: new Date().toISOString(),
  };
}

export function updateGameAfterEvent(
  game: Game,
  event: AtBatEvent,
  runnerState: RunnerState,
  runs: number,
  customRunnerAdvances?: Array<{ runnerId: string; fromBase: 1 | 2 | 3; toBase: 2 | 3 | 4 }>,
): Game {
  const nextScore = ensureScoreThroughInning(game.score, event.inning).map((row) => row.inning === event.inning ? { ...row, [event.half]: row[event.half] + runs } : row);
  const forcedBaseOnBallsAdvances = getForcedBaseOnBallsAdvances(game.runners, event.result, event.id, {
    droppedThirdStrike: event.droppedThirdStrike,
    outs: game.outs,
  });
  const customAdvances = (customRunnerAdvances ?? []).map(({ runnerId, fromBase, toBase }) => ({
    runnerId,
    advance: {
      id: `${event.id}-custom-${runnerId}-${fromBase}-${toBase}`,
      type: "ADV" as const,
      fromBase,
      toBase,
      notation: `推進 ${fromBase}→${toBase === 4 ? "得分" : toBase}`,
      runnerId,
    },
  }));
  const isFieldersChoice = event.recordColumn?.fieldingPlay === "FC";
  const fieldersChoiceRunnerOut = isFieldersChoice && Boolean(game.runners.first);
  const batterOut = isAtBatOut(event) && !isFieldersChoice;
  const fieldingOuts = event.recordColumn?.fieldingPlay === "DP" ? 2 : event.recordColumn?.fieldingPlay === "TP" ? 3 : fieldersChoiceRunnerOut ? 1 : batterOut ? 1 : 0;
  const nextOuts = Math.min(3, game.outs + fieldingOuts + (isSacrificeFlyRunnerOutAtHome(event.recordColumn) ? 1 : 0));
  const runnerOutCount = Math.max(0, fieldingOuts - (batterOut ? 1 : 0));
  const runnerOuts = ([
    [1, game.runners.first],
    [2, game.runners.second],
    [3, game.runners.third],
  ] as const)
    .filter((entry): entry is readonly [1 | 2 | 3, string] => Boolean(entry[1]))
    .slice(0, runnerOutCount);
  const runnerIdsOut = runnerOuts.map(([, runnerId]) => runnerId);
  const runnerOutAdvances = runnerOuts.map(([fromBase, runnerId], index) => ({
    runnerId,
    advance: {
      id: `${event.id}-runner-out-${runnerId}`,
      type: "ADV" as const,
      fromBase,
      toBase: Math.min(fromBase + 1, 4) as 2 | 3 | 4,
      outNumber: Math.min(game.outs + (batterOut ? 1 : 0) + index + 1, 3) as 1 | 2 | 3,
      notation: `${event.recordColumn?.fieldingPlay ?? "守備"} ${fromBase}壘跑者出局`,
    },
  }));
  const settledRunners = runnerIdsOut.length === 0
    ? runnerState
    : {
      first: runnerState.first && runnerIdsOut.includes(runnerState.first) ? null : runnerState.first,
      second: runnerState.second && runnerIdsOut.includes(runnerState.second) ? null : runnerState.second,
      third: runnerState.third && runnerIdsOut.includes(runnerState.third) ? null : runnerState.third,
    };
  const runnerOutSourceIndexes = new Map<string, number>();
  runnerOutAdvances.forEach(({ runnerId }) => {
    for (let index = game.events.length - 1; index >= 0; index -= 1) {
      if (game.events[index].batterId === runnerId) {
        runnerOutSourceIndexes.set(runnerId, index);
        break;
      }
    }
  });
  const forcedAdvanceSourceIndexes = new Map<string, number>();
  forcedBaseOnBallsAdvances.forEach(({ runnerId }) => {
    for (let index = game.events.length - 1; index >= 0; index -= 1) {
      if (game.events[index].batterId === runnerId) {
        forcedAdvanceSourceIndexes.set(runnerId, index);
        break;
      }
    }
  });
  const customAdvanceSourceIndexes = new Map<string, number>();
  customAdvances.forEach(({ runnerId }) => {
    const subRecord = (game.substitutions ?? []).find((s) => s.playerInId === runnerId && (s.type === "代跑" || s.type === "PR"));
    const effectiveBatterId = subRecord?.playerOutId ?? runnerId;

    for (let index = game.events.length - 1; index >= 0; index -= 1) {
      if (game.events[index].batterId === effectiveBatterId) {
        customAdvanceSourceIndexes.set(runnerId, index);
        break;
      }
    }
  });
  const eventsWithRunnerAdvances = game.events.map((atBat, index) => {
    const runnerOut = runnerOutAdvances.find((entry) => runnerOutSourceIndexes.get(entry.runnerId) === index);
    const forcedAdvances = forcedBaseOnBallsAdvances
      .filter((entry) => forcedAdvanceSourceIndexes.get(entry.runnerId) === index)
      .map((entry) => entry.advance);
    const customAdvs = customAdvances
      .filter((entry) => customAdvanceSourceIndexes.get(entry.runnerId) === index)
      .map((entry) => entry.advance);
    const advances = [
      ...(runnerOut ? [runnerOut.advance] : []),
      ...forcedAdvances,
      ...customAdvs,
    ];
    return advances.length > 0 ? { ...atBat, runnerAdvances: [...(atBat.runnerAdvances ?? []), ...advances] } : atBat;
  });
  const halfEnded = nextOuts >= 3;
  const nextHalf: TeamSide = halfEnded ? (game.half === "away" ? "home" : "away") : game.half;
  const nextInning = halfEnded && game.half === "home" ? game.inning + 1 : game.inning;
  const nextScoreFilled = nextScore.map((row) => row.inning <= nextInning ? row : row);
  const nextAwayBatterIndex = game.half === "away" ? game.awayBatterIndex + 1 : game.awayBatterIndex;
  const nextHomeBatterIndex = game.half === "home" ? game.homeBatterIndex + 1 : game.homeBatterIndex;
  return {
    ...game,
    status: "live",
    inning: nextInning,
    half: nextHalf,
    outs: halfEnded ? 0 : nextOuts,
    runners: halfEnded ? { first: null, second: null, third: null } : settledRunners,
    awayBatterIndex: nextAwayBatterIndex,
    homeBatterIndex: nextHomeBatterIndex,
    score: nextScoreFilled,
    events: halfEnded ? markLeftOnBase([...eventsWithRunnerAdvances, event], settledRunners, event.id) : [...eventsWithRunnerAdvances, event],
    specialEvents: halfEnded
      ? appendInningEndAnnotation(game.specialEvents ?? [], event)
      : game.specialEvents ?? [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 半局結束時，仍在壘上的跑者必須回寫到各自「來源打席」的內圈。
 * l／ℓ 是殘壘結算註記，不是跑壘推進，因此不應繪製藍色壘線。
 */
function markLeftOnBase(events: AtBatEvent[], runners: RunnerState, triggerId: string): AtBatEvent[] {
  const stranded = ([
    [1, runners.first],
    [2, runners.second],
    [3, runners.third],
  ] as const).filter((entry): entry is readonly [1 | 2 | 3, string] => Boolean(entry[1]));
  if (stranded.length === 0) return events;

  const sourceIndexByRunner = new Map<string, number>();
  stranded.forEach(([, runnerId]) => {
    const sourceIndex = events.map((atBat) => atBat.batterId).lastIndexOf(runnerId);
    if (sourceIndex >= 0) sourceIndexByRunner.set(runnerId, sourceIndex);
  });

  return events.map((atBat, index) => {
    const strandedRunner = stranded.find(([, runnerId]) => sourceIndexByRunner.get(runnerId) === index);
    if (!strandedRunner) return atBat;
    const [fromBase] = strandedRunner;
    const lobId = `${triggerId}-lob-${fromBase}`;
    if (atBat.runnerAdvances?.some((advance) => advance.id === lobId)) return atBat;
    return {
      ...atBat,
      runnerAdvances: [
        ...(atBat.runnerAdvances ?? []),
        { id: lobId, type: "LOB", fromBase, notation: "l" },
      ],
    };
  });
}

export function getTeamForHalf(game: Game, teams: Team[]): Team {
  const teamId = game.half === "away" ? game.awayTeamId : game.homeTeamId;
  return teams.find((team) => team.id === teamId) ?? teams[0];
}

export function getOpponentTeam(game: Game, teams: Team[]): Team {
  const teamId = game.half === "away" ? game.homeTeamId : game.awayTeamId;
  return teams.find((team) => team.id === teamId) ?? teams[0];
}

export function getGameSummary(game: Game, teams: Team[]): { away: Team; home: Team; awayRuns: number; homeRuns: number; hits: number; walks: number; strikeouts: number; errors: number; stolenBases: number; caughtStealing: number; wildPitches: number; passedBalls: number } {
  const away = teams.find((team) => team.id === game.awayTeamId) ?? teams[0];
  const home = teams.find((team) => team.id === game.homeTeamId) ?? teams[0];
  const homeIds = new Set(home.players.map((player) => player.id));
  const awayIds = new Set(away.players.map((player) => player.id));
  const teamEvents = game.events.filter((event) => awayIds.has(event.batterId) || homeIds.has(event.batterId));
  return {
    away,
    home,
    awayRuns: getTeamRuns(game, "away"),
    homeRuns: getTeamRuns(game, "home"),
    hits: teamEvents.filter((event) => ["1B", "2B", "3B", "HR"].includes(event.result)).length,
    walks: teamEvents.filter((event) => event.result === "BB").length,
    strikeouts: teamEvents.filter((event) => event.result === "K").length,
    errors: teamEvents.filter((event) => event.result === "E").length,
    stolenBases: (game.specialEvents ?? []).filter((event) => event.type === "SB").length,
    caughtStealing: (game.specialEvents ?? []).filter((event) => event.type === "CS").length,
    wildPitches: (game.specialEvents ?? []).filter((event) => event.type === "WP").length,
    passedBalls: (game.specialEvents ?? []).filter((event) => event.type === "PB").length,
  };
}

export function makeGame(input: { name: string; competition?: string; ageGroup?: AgeGroup; venue: string; date: string; time?: string; weather?: WeatherCondition; awayTeamId: string; homeTeamId: string; awayRegisteredPlayerIds?: string[]; homeRegisteredPlayerIds?: string[]; awayLineup?: GameLineup; homeLineup?: GameLineup; pitchLimitThresholds?: [number, number, number]; maxInnings: 6 | 7 | 9 | 15 }): Game {
  const now = new Date().toISOString();
  return {
    id: `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: input.name || "未命名比賽",
    competition: input.competition?.trim() ?? "",
    ageGroup: input.ageGroup ?? "U12",
    venue: input.venue || "未設定場地",
    date: input.date || now.slice(0, 10),
    time: input.time,
    weather: input.weather ?? "sunny",
    status: "setup",
    homeTeamId: input.homeTeamId,
    awayRegisteredPlayerIds: input.awayRegisteredPlayerIds ?? [],
    homeRegisteredPlayerIds: input.homeRegisteredPlayerIds ?? [],
    awayLineup: input.awayLineup,
    homeLineup: input.homeLineup,
    awayTeamId: input.awayTeamId,
    inning: 1,
    half: "away",
    outs: 0,
    awayBatterIndex: 0,
    homeBatterIndex: 0,
    score: Array.from({ length: 15 }, (_, i) => ({ inning: i + 1, away: 0, home: 0 })),
    runners: { first: null, second: null, third: null },
    events: [],
    specialEvents: [],
    substitutions: [],
    pitchLimitThresholds: normalizePitchLimitThresholds(input.pitchLimitThresholds),
    notes: "",
    maxInnings: input.maxInnings,
    createdAt: now,
    updatedAt: now,
  };
}
