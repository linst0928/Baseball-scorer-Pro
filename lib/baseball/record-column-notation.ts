import { type AtBatResult, type FieldingPlayKind, type Game, type RecordColumn, type RecordTrajectory, type RunnerState, getNotation, SACRIFICE_FLY_NO_SCORE_REASON_LABELS } from "./types";

/** 現場輸入用的常用早稻田傳接範本；DP 標記與傳接路徑分開保存。 */
export type FieldingSequencePreset = {
  id: "6-3" | "4-6-3-dp" | "3a";
  label: string;
  detail: string;
  sequence: string;
  fieldingPlay?: FieldingPlayKind;
};

export const FIELDING_SEQUENCE_PRESETS: readonly FieldingSequencePreset[] = [
  { id: "6-3", label: "6ー3", detail: "游擊→一壘", sequence: "6ー3" },
  { id: "4-6-3-dp", label: "4ー6ー3 DP", detail: "二壘→游擊→一壘雙殺", sequence: "4ー6ー3", fieldingPlay: "DP" },
  { id: "3a", label: "3A", detail: "一壘手自踩一壘", sequence: "3A" },
];

/** 傳接建議只影響輸入排序；所有序列仍使用既有早稻田表記與手動按鍵。 */
export type FieldingSequenceSuggestion = {
  id: string;
  label: string;
  detail: string;
  sequence: string;
  fieldingPlay?: FieldingPlayKind;
  source: "context" | "history" | "fallback";
  occurrences?: number;
};

export type FieldingSuggestionContext = {
  battedBallPosition?: string;
  result?: AtBatResult | null;
  runners: RunnerState;
  games: Game[];
};

const POSITION_LABELS: Record<string, string> = {
  "1": "投手", "2": "捕手", "3": "一壘", "4": "二壘", "5": "三壘", "6": "游擊", "7": "左外", "8": "中外", "9": "右外",
};

const RUNNER_NEARBY_RECEIVER: Record<string, Array<{ runner: keyof RunnerState; receiver: string; base: string }>> = {
  "7": [{ runner: "third", receiver: "5", base: "三壘" }, { runner: "second", receiver: "6", base: "二壘" }, { runner: "first", receiver: "4", base: "一壘" }],
  "8": [{ runner: "second", receiver: "6", base: "二壘" }, { runner: "third", receiver: "5", base: "三壘" }, { runner: "first", receiver: "4", base: "一壘" }],
  "9": [{ runner: "first", receiver: "3", base: "一壘" }, { runner: "second", receiver: "4", base: "二壘" }, { runner: "third", receiver: "5", base: "三壘" }],
};

const DEFAULT_FIELDING_ROUTE: Record<string, string> = {
  "1": "1ー3", "2": "2ー3", "3": "3A", "4": "4ー3", "5": "5ー3", "6": "6ー3", "7": "7ー6ー3", "8": "8ー6ー3", "9": "9ー4ー3",
};

function suggestionId(sequence: string, fieldingPlay?: FieldingPlayKind) {
  return `${sequence}-${fieldingPlay ?? "routine"}`.replace(/[^A-Z0-9]/gi, "_");
}

function suggestionLabel(sequence: string, fieldingPlay?: FieldingPlayKind) {
  return fieldingPlay ? `${sequence} ${fieldingPlay}` : sequence;
}

/** 擊球方向是傳接建議的第一優先：建議序列首位必須是處理該球的守備員。 */
function sequenceStartsAtPosition(sequence: string, position?: string): boolean {
  if (!position) return true;
  const normalized = sequence.replace(/[\-―ー–—]/g, "ー").trim().toUpperCase();
  return new RegExp(`^${position}(?:$|[ーAE])`).test(normalized);
}

/**
 * 從已保存場次中計數傳接序列。相同擊球方向的歷史優先，藉此讓本隊實際常用的傳接自然浮到前列。
 */
function learnHistoricalSuggestions(position: string | undefined, games: Game[]): FieldingSequenceSuggestion[] {
  const counts = new Map<string, { sequence: string; fieldingPlay?: FieldingPlayKind; count: number; directionMatches: number }>();
  games.forEach((game) => game.events.forEach((event) => {
    const record = event.recordColumn;
    if (!record) return;
    const sequence = record?.fieldingSequence?.trim();
    if (!sequence) return;
    const normalized = sequence.replace(/[\-―ー–—]/g, "ー").toUpperCase();
    const key = `${normalized}|${record.fieldingPlay ?? "routine"}`;
    const current = counts.get(key) ?? { sequence: normalized, fieldingPlay: record.fieldingPlay, count: 0, directionMatches: 0 };
    current.count += 1;
    if (position && record.battedBallPosition === position) current.directionMatches += 1;
    counts.set(key, current);
  }));

  return Array.from(counts.values())
    .filter((entry) => !position || (entry.directionMatches > 0 && sequenceStartsAtPosition(entry.sequence, position)))
    .sort((left, right) => right.directionMatches - left.directionMatches || right.count - left.count || left.sequence.localeCompare(right.sequence))
    .map((entry) => ({
      id: suggestionId(entry.sequence, entry.fieldingPlay),
      label: suggestionLabel(entry.sequence, entry.fieldingPlay),
      detail: `同方向已記錄 ${entry.directionMatches || entry.count} 次`,
      sequence: entry.sequence,
      fieldingPlay: entry.fieldingPlay,
      source: "history" as const,
      occurrences: entry.directionMatches || entry.count,
    }));
}

function contextualSuggestions(position: string | undefined, result: AtBatResult | null | undefined, runners: RunnerState): FieldingSequenceSuggestion[] {
  if (!position) return [];
  const suggestions: FieldingSequenceSuggestion[] = [];
  const receiverChoices = RUNNER_NEARBY_RECEIVER[position] ?? [];
  const nearestRunner = receiverChoices.find((choice) => Boolean(runners[choice.runner]));

  if (position === "3") {
    suggestions.push({ id: "context-3a", label: "3A", detail: "一壘手自踩一壘", sequence: "3A", source: "context" });
  }
  if (nearestRunner) {
    const sequence = `${position}ー${nearestRunner.receiver}`;
    suggestions.push({ id: suggestionId(sequence), label: sequence, detail: `${POSITION_LABELS[position]}先傳向${nearestRunner.base}附近跑者`, sequence, source: "context" });
  }
  if (result === "F") {
    suggestions.push({ id: suggestionId(position), label: position, detail: `${POSITION_LABELS[position]}直接接殺`, sequence: position, source: "context" });
  }
  const fallback = DEFAULT_FIELDING_ROUTE[position];
  if (fallback) suggestions.push({ id: suggestionId(fallback), label: fallback, detail: position === "3" ? "一壘手自踩一壘" : `${POSITION_LABELS[position]}常見刺殺路徑`, sequence: fallback, source: "fallback" });
  return suggestions;
}

/**
 * 歷史紀錄不足五項時，仍只產生以擊球方向守備員起始的安全候選，讓 3 方向以 3 開頭、6 方向以 6 開頭。
 */
function directionFallbackSuggestions(position: string | undefined): FieldingSequenceSuggestion[] {
  if (!position) return [];
  const routes = position === "3"
    ? ["3A", "3", "3E", "3ー6", "3ー2"]
    : [`${position}ー3`, `${position}`, `${position}E`, `${position}ー4`, `${position}ー2`];
  return routes.map((sequence) => ({
    id: suggestionId(sequence),
    label: sequence,
    detail: `${POSITION_LABELS[position]}處理球的候選傳接`,
    sequence,
    source: "fallback" as const,
  }));
}

/**
 * 產生最多五項傳接建議：擊球方向完全相符的內部歷史紀錄優先，再依壘上最近跑者調整，最後才補既有常用路徑。
 */
export function getFieldingSequenceSuggestions({ battedBallPosition, result, runners, games }: FieldingSuggestionContext): FieldingSequenceSuggestion[] {
  const ranked = [
    ...learnHistoricalSuggestions(battedBallPosition, games),
    ...contextualSuggestions(battedBallPosition, result, runners),
    ...directionFallbackSuggestions(battedBallPosition),
  ].filter((suggestion) => sequenceStartsAtPosition(suggestion.sequence, battedBallPosition));
  const unique = new Map<string, FieldingSequenceSuggestion>();
  ranked.forEach((suggestion) => {
    const key = `${suggestion.sequence}|${suggestion.fieldingPlay ?? "routine"}`;
    if (!unique.has(key)) unique.set(key, suggestion);
  });
  if (unique.size < 5 && !battedBallPosition) {
    FIELDING_SEQUENCE_PRESETS.forEach((preset) => {
      const key = `${preset.sequence}|${preset.fieldingPlay ?? "routine"}`;
      if (!unique.has(key)) unique.set(key, { ...preset, source: "fallback" });
    });
  }
  return Array.from(unique.values()).slice(0, 5);
}

const TRAJECTORY_MARK: Record<RecordTrajectory, string> = {
  fly: "⌒",
  // 舊資料仍可載入；統一以 1189LAB 的三種可見軌跡呈現。
  wavy: "⌒",
  line: "ー",
  ground: "＿",
  bounce: "＿",
  pop: "⌒",
};

const BATTED_BALL_RESULTS: AtBatResult[] = ["1B", "2B", "3B", "HR", "F", "G"];

/** 以守備位置與球性合成外圈右下的擊球方向記號，例如「⌒7」。 */
export function getBattedBallNotation(record: RecordColumn): string {
  const trajectory = record.trajectory ? TRAJECTORY_MARK[record.trajectory] : "";
  const position = record.battedBallPosition?.trim() ?? "";
  return trajectory && position ? `${trajectory}${position}` : "";
}

/** 保留字元形式，供個人紀錄欄將球性繪於守備位置數字的上方。 */
export function getRecordTrajectoryMark(trajectory?: RecordTrajectory): string | undefined {
  return trajectory ? TRAJECTORY_MARK[trajectory] : undefined;
}

function normalizeFieldingSequence(result: AtBatResult, sequence?: string): string {
  const normalized = (sequence?.trim().toUpperCase() ?? "").replace(/[\-―ー–—]/g, "ー");
  if (!normalized) return "";
  if (result !== "E") return normalized;

  // 1189LAB 的失誤格式將 E 接在首位守備員後，例如 6E、6Eー3。
  const legacyErrorFirst = normalized.match(/^E(\d)(.*)$/);
  if (legacyErrorFirst) return `${legacyErrorFirst[1]}E${legacyErrorFirst[2]}`;
  if (normalized.includes("E")) return normalized;
  const fielderFirst = normalized.match(/^(\d)(.*)$/);
  return fielderFirst ? `${fielderFirst[1]}E${fielderFirst[2]}` : `E${normalized}`;
}

/**
 * 合成守備傳接字串：雙殺／三殺置於序列末端，野手選擇置於序列前端。
 * 例如 6ー4ー3 DP、5ー4ー3 TP、FC 6；失誤則記為 5Eー3。
 */
export function getFieldingSequenceNotation(result: AtBatResult, record: RecordColumn): string {
  const sequence = normalizeFieldingSequence(result, record.fieldingSequence);
  const play = record.fieldingPlay;
  if (!play) return sequence;
  if (!sequence) return play;
  return play === "FC" ? `FC ${sequence}` : `${sequence} ${play}`;
}

/** 現場提示專用：讓 FO／GO 按目前守備位置即時產生可理解的輸入示例。 */
export function getFieldingExampleNotation(result: AtBatResult, position: string, record: RecordColumn): string {
  if (result !== "F" && result !== "G") return "";
  const prefix = result === "F" ? "FO" : "GO";
  const fielding = getFieldingSequenceNotation(result, record);
  return fielding ? `${prefix} ${fielding}` : position ? `${prefix}${position}` : prefix;
}

/**
 * 早稻田外圈符號由兩個獨立意義組成：
 * 1. 擊球球性／方向，如「⌒7」；2. 守備處理，如「5Eー3」。
 * 合成字串只為相容既有報表；原始欄位仍保存於 RecordColumn。
 */
export function formatRecordColumnNotation(result: AtBatResult, fallbackPosition: string, record: RecordColumn): string {
  const battedBall = getBattedBallNotation(record);
  const fielding = getFieldingSequenceNotation(result, record);
  const modifiers = (record.modifiers ?? [])
    .map((modifier) => modifier.split("（")[0])
    .filter((modifier) => !(fielding.includes("E") && modifier === "E"));
  const isCalledStrikeout = result === "K" && modifiers.includes("○K");
  const visibleModifiers = modifiers.filter((modifier) => modifier !== "○K");
  const sacrificeFlyException = record.sacrificeFlyNoScoreReason ? `SF未得分：${SACRIFICE_FLY_NO_SCORE_REASON_LABELS[record.sacrificeFlyNoScoreReason]}` : "";
  const isBattedBall = BATTED_BALL_RESULTS.includes(result);
  const resultNotation = fielding
    ? ""
    : battedBall
      ? (result === "F" || result === "G" ? "" : result)
      : isCalledStrikeout ? "○K" : getNotation(result, fallbackPosition);

  return [battedBall, fielding, ...visibleModifiers, sacrificeFlyException, resultNotation].filter(Boolean).join(" ");
}
