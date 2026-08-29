import type { AtBatEvent, AtBatResult, Game, PitchOutcome, RecordColumnCorrection } from "@/lib/baseball/types";

/** 整體紀錄表中可補正的早稻田個人紀錄區；舊版分角目標保留為既有資料相容用途。 */
export type RecordCorrectionTarget = "pitch" | "outer" | "inner" | "other" | "leftTop" | "rightTop" | "leftBottom" | "battedBallTop" | "rightBottom";

/** 依現場早稻田記錄法安排的四個安全補正入口。 */
export const RECORD_CORRECTION_TARGETS: Array<{ id: Extract<RecordCorrectionTarget, "pitch" | "outer" | "inner" | "other">; title: string; hint: string }> = [
  { id: "pitch", title: "逐球欄", hint: "依現場逐球順序補入壞球、好球、界外、觸擊、擊出球至三振等符號。" },
  { id: "outer", title: "外圈", hint: "補入跑壘事件、球性、方向、打席結果與守備傳接，維持同一打席的完整脈絡。" },
  { id: "inner", title: "內圈", hint: "只補入得分、出局數、殘壘與不死三振等菱形中央資訊。" },
  { id: "other", title: "其他", hint: "以顯示註記補入代打、代跑、換投或局結束；不會反向改寫正式換人或局數資料。" },
];

/** 已有正式打席時，長按格所提供的三種統計中性顯示補正模式。 */
export type AtBatCorrectionMode = "replaceAll" | "editDisplay" | "runnerOnly";

export const AT_BAT_CORRECTION_MODES: Array<{ id: AtBatCorrectionMode; title: string; hint: string }> = [
  { id: "replaceAll", title: "全刪除修改", hint: "先清除這一格既有的顯示補正，再以現場記錄順序重新編寫；不會刪除正式逐球、跑壘或統計。" },
  { id: "editDisplay", title: "內容逐一修改", hint: "保留其他區域的顯示補正，只逐區調整本次要核對的早稻田符號。" },
  { id: "runnerOnly", title: "跑壘紀錄修改", hint: "只開放 SB、CS、PO、WP、PB、BK 與進壘等外圈跑壘顯示；不會改變正式跑壘資料。" },
];

const RUNNER_ONLY_SYMBOL_IDS = ["stolen-base", "caught-stealing", "pickoff", "wild-pitch", "passed-ball", "balk", "advance"];
const OUTER_BALL_QUALITY_SYMBOL_IDS = ["ground", "fly", "line"];
const OUTER_RESULT_SYMBOL_IDS = ["single", "double", "triple", "home-run", "walk", "hit-by-pitch", "fielder-choice", "error", "double-play", "fly-out", "ground-out"];
const OUTER_FIELDING_SYMBOL_IDS = ["fielding-sequence", "deflection-sequence", "self-touch-first", "double-play", "fly-out", "ground-out"];

/** 跑壘模式只可書寫外圈的跑壘相關顯示，防止誤入逐球、內圈或正式打席結果。 */
export function getRecordCorrectionTargetsForMode(mode: AtBatCorrectionMode | null) {
  return mode === "runnerOnly"
    ? RECORD_CORRECTION_TARGETS.filter((target) => target.id === "outer")
    : RECORD_CORRECTION_TARGETS;
}

/** 依模式與現場式外圈步驟限制可選符號，供 UI 與回歸測試共用。 */
export function getRecordCorrectionSymbolIdsForMode(
  target: RecordCorrectionTarget,
  mode: AtBatCorrectionMode | null,
  outerStage: "ballQuality" | "result" | "fielding" | null = null,
) {
  if (mode === "runnerOnly") return target === "outer" ? RUNNER_ONLY_SYMBOL_IDS : [];
  if (target === "outer" && outerStage === "ballQuality") return OUTER_BALL_QUALITY_SYMBOL_IDS;
  if (target === "outer" && outerStage === "result") return OUTER_RESULT_SYMBOL_IDS;
  if (target === "outer" && outerStage === "fielding") return OUTER_FIELDING_SYMBOL_IDS;
  return RECORD_CORRECTION_SYMBOL_IDS[target];
}

export const RECORD_CORRECTION_OTHER_OPTIONS = ["代打", "代跑", "換投", "局結束"] as const;

/** 僅供單場整體紀錄的事後補正使用；不會反向寫入正式 pitches。 */
export const PITCH_CORRECTION_OPTIONS: Array<{ outcome: PitchOutcome; mark: string; title: string }> = [
  { outcome: "ball", mark: "—", title: "壞球" },
  { outcome: "strike", mark: "○", title: "未揮好球" },
  { outcome: "foul", mark: "△", title: "界外球" },
  { outcome: "foulTip", mark: "▲", title: "擦棒被捕" },
  { outcome: "swingingStrike", mark: "⊖", title: "揮棒落空" },
  { outcome: "bunt", mark: "⌁", title: "觸擊" },
  { outcome: "missedBunt", mark: "◓", title: "觸擊落空" },
  { outcome: "buntFoul", mark: "△⌁", title: "觸擊界外" },
  { outcome: "foulError", mark: "△E", title: "界外失誤" },
  { outcome: "inPlay", mark: "•", title: "擊出球" },
];

const pitchCorrectionMarks = new Map(PITCH_CORRECTION_OPTIONS.map((option) => [option.outcome, option.mark]));

export type PitchCorrectionPreview = {
  value: string;
  balls: number;
  strikes: number;
  terminal: "walk" | "strikeout" | "in-play" | "incomplete";
  error?: string;
};

/**
 * 驗證一次性補入的逐球草稿是否和既有打席結束型態相容。
 * 這只是顯示覆蓋的防呆，不建立 PitchState、不改寫正式 pitches 或統計。
 */
export function getPitchCorrectionPreview(outcomes: PitchOutcome[], result: AtBatResult): PitchCorrectionPreview {
  let balls = 0;
  let strikes = 0;
  let terminal: PitchCorrectionPreview["terminal"] = "incomplete";
  const value = outcomes.map((outcome) => pitchCorrectionMarks.get(outcome) ?? "?").join(" ");

  for (const [index, outcome] of outcomes.entries()) {
    if (terminal !== "incomplete") return { value, balls, strikes, terminal, error: "打席已結束，結束符號後不可再補入逐球紀錄。" };
    if (outcome === "ball") balls += 1;
    if (["strike", "foulTip", "swingingStrike", "missedBunt", "buntFoul"].includes(outcome)) strikes += 1;
    if (outcome === "foul" || outcome === "foulError") strikes = Math.min(2, strikes + 1);
    if (outcome === "inPlay" || outcome === "bunt") terminal = "in-play";
    if (strikes >= 3) terminal = "strikeout";
    if (balls >= 4) terminal = "walk";
    if (terminal !== "incomplete" && index !== outcomes.length - 1) return { value, balls, strikes, terminal, error: "打席結束的逐球符號必須是最後一顆。" };
  }

  const expectedTerminal = result === "K" ? "strikeout" : result === "BB" ? "walk" : result === "HBP" ? "incomplete" : "in-play";
  if (!outcomes.length) return { value, balls, strikes, terminal, error: "請至少補入一顆逐球紀錄。" };
  if (result === "HBP") return { value, balls, strikes, terminal, error: "觸身球打席請保留原始觸身結果；逐球欄不可用壞球、三振或擊出球替代觸身結束。" };
  if (terminal !== expectedTerminal) {
    const expectedLabel = expectedTerminal === "strikeout" ? "第三好球／觸擊兩好球後界外三振" : expectedTerminal === "walk" ? "第四壞球" : "最後的擊出球";
    return { value, balls, strikes, terminal, error: `此打席原始結果為 ${result}，逐球欄必須以${expectedLabel}結束。` };
  }
  return { value, balls, strikes, terminal };
}

/** 僅列出既有速查表已支援、且適合各紀錄區的符號識別。 */
export const RECORD_CORRECTION_SYMBOL_IDS: Record<RecordCorrectionTarget, string[]> = {
  pitch: ["ball", "called-strike", "foul", "foul-tip", "swinging-strike", "bunt", "missed-bunt", "bunt-foul", "foul-error", "in-play"],
  outer: ["single", "double", "triple", "home-run", "walk", "hit-by-pitch", "fielder-choice", "error", "double-play", "stolen-base", "caught-stealing", "pickoff", "wild-pitch", "passed-ball", "balk", "advance", "fly", "line", "ground", "fielding-sequence", "deflection-sequence", "self-touch-first", "fly-out", "ground-out", "rbi"],
  inner: ["out-one", "out-two", "out-three", "unearned-run", "earned-run", "left-on-base", "strikeout", "called-strikeout"],
  other: [],
  leftTop: ["single", "double", "triple", "home-run", "double-play", "fly", "line", "ground", "fly-out", "ground-out"],
  rightTop: ["walk", "hit-by-pitch", "fielder-choice", "error", "stolen-base", "caught-stealing", "pickoff", "wild-pitch", "passed-ball", "balk", "advance"],
  leftBottom: ["rbi"],
  battedBallTop: ["fly", "line", "ground", "fly-out", "ground-out"],
  rightBottom: ["fielding-sequence", "deflection-sequence", "self-touch-first", "double-play", "fly-out", "ground-out"],
};

/**
 * 只有整場完賽，或目前攻守已切換、選取半局確實在前時，才開放補正。
 * 不以「打席已存在」作為解鎖條件，避免進行中跑者與比分被誤認為可修改。
 */
export function isRecordCorrectionUnlocked(
  game: Pick<Game, "status" | "inning" | "half">,
  event: Pick<AtBatEvent, "inning" | "half">,
) {
  if (game.status === "final") return true;
  const selectedHalfOrder = event.half === "away" ? 0 : 1;
  const currentHalfOrder = game.half === "away" ? 0 : 1;
  return event.inning < game.inning || (event.inning === game.inning && selectedHalfOrder < currentHalfOrder);
}

/** 供唯讀畫面明確說明安全鎖定的實際原因，不以模糊提示代替比賽狀態。 */
export function getRecordCorrectionLockReason(
  game: Pick<Game, "status" | "inning" | "half">,
  event: Pick<AtBatEvent, "inning" | "half">,
) {
  if (isRecordCorrectionUnlocked(game, event)) return undefined;
  const eventHalf = event.half === "away" ? "上" : "下";
  const currentHalf = game.half === "away" ? "上" : "下";
  if (event.inning === game.inning && event.half === game.half) {
    return `第 ${event.inning} 局${eventHalf}仍在進行；為避免打者、跑者、比分與出局數不同步，請在本半局結束後再修改。`;
  }
  return `目前仍在第 ${game.inning} 局${currentHalf}；此打席必須待所在半局確實結束，或整場比賽標記為完賽後才能修改。`;
}

export function getRecordCorrectionValue(correction: RecordColumnCorrection | undefined, target: RecordCorrectionTarget) {
  if (target === "pitch") return correction?.pitchMarks ?? "";
  if (target === "inner") return correction?.innerMark ?? "";
  if (target === "outer") return correction?.outerMark ?? "";
  if (target === "other") return correction?.otherMark ?? "";
  return correction?.outerMarks?.[target] ?? "";
}

/**
 * 只建立視覺覆蓋資料，絕不接觸打席結果、逐球、出局、得分或跑壘資料。
 * 清除最後一個補正欄位時回傳 undefined，讓呼叫端可移除整個覆蓋物件。
 */
export function mergeRecordCorrection(
  current: RecordColumnCorrection | undefined,
  target: RecordCorrectionTarget,
  value: string,
  note: string,
  revisedAt = new Date().toISOString(),
): RecordColumnCorrection | undefined {
  const next: RecordColumnCorrection = { ...(current ?? { revisedAt }), revisedAt };
  const trimmedValue = value.trim();
  if (target === "pitch") {
    if (trimmedValue) next.pitchMarks = trimmedValue;
    else delete next.pitchMarks;
  } else if (target === "inner") {
    if (trimmedValue) next.innerMark = trimmedValue;
    else delete next.innerMark;
  } else if (target === "outer") {
    if (trimmedValue) next.outerMark = trimmedValue;
    else delete next.outerMark;
  } else if (target === "other") {
    if (trimmedValue) next.otherMark = trimmedValue;
    else delete next.otherMark;
  } else {
    const outerMarks = { ...(next.outerMarks ?? {}) };
    if (trimmedValue) outerMarks[target] = trimmedValue;
    else delete outerMarks[target];
    if (Object.keys(outerMarks).length > 0) next.outerMarks = outerMarks;
    else delete next.outerMarks;
  }
  if (note.trim()) next.note = note.trim();
  else delete next.note;
  return next.pitchMarks || next.outerMark || next.innerMark || next.otherMark || Object.keys(next.outerMarks ?? {}).length > 0 || next.note ? next : undefined;
}
