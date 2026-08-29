import type { AtBatResult, RunnerAdvanceRecord } from "./types";

/**
 * 早稻田個人紀錄欄中，安打自本壘開始的紅色推進線分段。
 * 菱形本身始終保留灰色虛線；安打只覆蓋實際完成的壘間線段。
 */
export type HitAdvanceSegment =
  | "home-to-first"
  | "first-to-second"
  | "second-to-third"
  | "third-to-home";

const HIT_ADVANCE_SEGMENTS: Record<"1B" | "2B" | "3B" | "HR", HitAdvanceSegment[]> = {
  "1B": ["home-to-first"],
  "2B": ["home-to-first", "first-to-second"],
  "3B": ["home-to-first", "first-to-second", "second-to-third"],
  "HR": ["home-to-first", "first-to-second", "second-to-third", "third-to-home"],
};

export function getHitAdvanceSegments(result?: AtBatResult): HitAdvanceSegment[] {
  if (!result || !(result in HIT_ADVANCE_SEGMENTS)) return [];
  return HIT_ADVANCE_SEGMENTS[result as keyof typeof HIT_ADVANCE_SEGMENTS];
}

/**
 * 個人紀錄欄的球數以兩個直式欄呈現，每欄固定最多14球。
 * 回傳值供 React Native 的 column + wrap 版面與回歸測試共用，超過28球不溢出格外。
 */
export function splitPitchMarksForVerticalGrid(marks?: string): [string[], string[]] {
  const items = Array.from(marks ?? "").slice(0, 28);
  return [items.slice(0, 14), items.slice(14, 28)];
}

export type RunnerAdvanceContext = {
  type?: RunnerAdvanceRecord["type"];
  fromBase?: 0 | 1 | 2 | 3;
  toBase?: 1 | 2 | 3 | 4;
};

export type RunnerAdvanceLine = {
  segment: HitAdvanceSegment;
  hasArrow: boolean;
  label?: "SB" | "BK";
};

const BASE_ADVANCE_SEGMENTS: Record<"0-1" | "1-2" | "2-3" | "3-4", HitAdvanceSegment> = {
  "0-1": "home-to-first",
  "1-2": "first-to-second",
  "2-3": "second-to-third",
  "3-4": "third-to-home",
};

/**
 * 早稻田個人紀錄欄中的藍色跑壘線。一般進壘不畫箭頭；盜壘加前進箭頭與 SB。
 * 同一線段若同時含安打，安打紅線優先；不同線段仍須顯示藍色跑者推進，
 * 例如一壘安打（本壘至一壘紅線）後，既有一壘跑者推進二壘（藍線）必須同步保留。
 */
export function getRunnerAdvanceLines({
  result,
  modifiers = [],
  runnerAdvance,
}: {
  result?: AtBatResult;
  modifiers?: string[];
  runnerAdvance?: RunnerAdvanceContext;
}): RunnerAdvanceLine[] {
  if (runnerAdvance?.fromBase !== undefined && runnerAdvance.toBase !== undefined) {
    const segment = BASE_ADVANCE_SEGMENTS[`${runnerAdvance.fromBase}-${runnerAdvance.toBase}` as keyof typeof BASE_ADVANCE_SEGMENTS];
    if (!segment || runnerAdvance.type === "CS") return [];
    if (getHitAdvanceSegments(result).includes(segment)) return [];
    const stolenBase = runnerAdvance.type === "SB";
    const balk = runnerAdvance.type === "BK";
    return [{ segment, hasArrow: stolenBase, label: stolenBase ? "SB" : balk ? "BK" : undefined }];
  }

  const droppedThirdStrike = result === "K" && modifiers.some((modifier) => /不死三振|dropped\s*third|K\+/i.test(modifier));
  if (result === "BB" || result === "HBP" || result === "E" || droppedThirdStrike) {
    return [{ segment: "home-to-first", hasArrow: false }];
  }

  return [];
}
