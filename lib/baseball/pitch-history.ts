import type { PitchLocation, PitchType } from "./types";

export type SequencedPitchLocation = {
  sequence: number;
  type: PitchType;
  outcome: PitchLocation["outcome"];
};

/**
 * 將單一打席的逐球暫存依九宮格／外圈位置分組，並維持輸入順序作為顯示序號。
 * 畫面只傳入目前 pitchDraft.locations；完成打席後既有流程會重設為空陣列。
 */
export function groupPitchHistoryByZone(pitches: PitchLocation[]): Record<number, SequencedPitchLocation[]> {
  return pitches.reduce<Record<number, SequencedPitchLocation[]>>((history, pitch, index) => {
    const zonePitches = history[pitch.zone] ?? [];
    zonePitches.push({ sequence: index + 1, type: pitch.type, outcome: pitch.outcome });
    history[pitch.zone] = zonePitches;
    return history;
  }, {});
}
