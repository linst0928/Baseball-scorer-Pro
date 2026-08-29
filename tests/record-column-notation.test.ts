import { describe, expect, it } from "vitest";

import { FIELDING_SEQUENCE_PRESETS, formatRecordColumnNotation, getBattedBallNotation, getFieldingExampleNotation, getFieldingSequenceNotation, getFieldingSequenceSuggestions } from "../lib/baseball/record-column-notation";
import type { Game } from "../lib/baseball/types";

describe("早稻田外圈擊球與守備符號", () => {
  it("以球性與方向獨立合成左外野高飛球的 ⌒7", () => {
    expect(getBattedBallNotation({ trajectory: "fly", battedBallPosition: "7" })).toBe("⌒7");
    expect(formatRecordColumnNotation("F", "7", { trajectory: "fly", battedBallPosition: "7" })).toBe("⌒7");
  });

  it("保留安打結果並將球性方向置於守備位置上方的等價文字預覽", () => {
    expect(formatRecordColumnNotation("2B", "7", { trajectory: "fly", battedBallPosition: "7" })).toBe("⌒7 2B");
  });

  it("將三壘手失誤後傳一壘呈現為 5Eー3，且可正規化舊版 E5-3 輸入", () => {
    expect(formatRecordColumnNotation("E", "5", { fieldingSequence: "5-3", modifiers: ["E（失誤）"] })).toBe("5Eー3");
    expect(formatRecordColumnNotation("E", "5", { fieldingSequence: "E5-3" })).toBe("5Eー3");
  });

  it("允許擊球方向與守備處理並列，而不混用兩者語意", () => {
    expect(formatRecordColumnNotation("E", "5", { trajectory: "ground", battedBallPosition: "5", fieldingSequence: "E5-3" })).toBe("＿5 5Eー3");
  });

  it("提供 FO／GO 與守備位置連動的即時範例", () => {
    expect(getFieldingExampleNotation("F", "7", {})).toBe("FO7");
    expect(getFieldingExampleNotation("G", "6", { fieldingSequence: "6-3" })).toBe("GO 6ー3");
  });

  it("以可編輯序列正確格式化 DP、TP 與 FC", () => {
    expect(getFieldingSequenceNotation("G", { fieldingSequence: "6-4-3", fieldingPlay: "DP" })).toBe("6ー4ー3 DP");
    expect(getFieldingSequenceNotation("F", { fieldingSequence: "5-4-3", fieldingPlay: "TP" })).toBe("5ー4ー3 TP");
    expect(getFieldingSequenceNotation("G", { fieldingSequence: "6", fieldingPlay: "FC" })).toBe("FC 6");
    expect(formatRecordColumnNotation("G", "6", { trajectory: "ground", battedBallPosition: "6", fieldingSequence: "6-4-3", fieldingPlay: "DP" })).toBe("＿6 6ー4ー3 DP");
  });

  it("提供可一鍵帶入的 6ー3、4ー6ー3 DP 與 3A 常用傳接範本", () => {
    expect(FIELDING_SEQUENCE_PRESETS).toEqual([
      { id: "6-3", label: "6ー3", detail: "游擊→一壘", sequence: "6ー3" },
      { id: "4-6-3-dp", label: "4ー6ー3 DP", detail: "二壘→游擊→一壘雙殺", sequence: "4ー6ー3", fieldingPlay: "DP" },
      { id: "3a", label: "3A", detail: "一壘手自踩一壘", sequence: "3A" },
    ]);
    expect(getFieldingSequenceNotation("G", { fieldingSequence: FIELDING_SEQUENCE_PRESETS[1].sequence, fieldingPlay: FIELDING_SEQUENCE_PRESETS[1].fieldingPlay })).toBe("4ー6ー3 DP");
    expect(formatRecordColumnNotation("G", "3", { fieldingSequence: FIELDING_SEQUENCE_PRESETS[2].sequence })).toBe("3A");
  });

  it("以同一擊球方向的內部紀錄作為傳球建議第一優先，最多提供五項", () => {
    const games = [{ events: [
      { recordColumn: { battedBallPosition: "7", fieldingSequence: "7-5" } },
      { recordColumn: { battedBallPosition: "7", fieldingSequence: "7-5" } },
      { recordColumn: { battedBallPosition: "6", fieldingSequence: "6-3" } },
    ] }] as unknown as Game[];

    const suggestions = getFieldingSequenceSuggestions({ battedBallPosition: "7", result: "G", runners: { first: null, second: null, third: null }, games });

    expect(suggestions[0]).toMatchObject({ sequence: "7ー5", source: "history", occurrences: 2 });
    expect(suggestions).toHaveLength(5);
  });

  it("左外野擊球有一壘跑者時優先建議向最近跑者壘包處理；一壘方向優先建議 3A", () => {
    const leftFieldSuggestions = getFieldingSequenceSuggestions({ battedBallPosition: "7", result: "G", runners: { first: "runner-1", second: null, third: null }, games: [] });
    const firstBaseSuggestions = getFieldingSequenceSuggestions({ battedBallPosition: "3", result: "G", runners: { first: null, second: null, third: null }, games: [] });

    expect(leftFieldSuggestions[0]).toMatchObject({ sequence: "7ー4", source: "context" });
    expect(firstBaseSuggestions[0]).toMatchObject({ sequence: "3A", source: "context" });
  });

  it("以相同的 K 資料結果呈現一般三振或 ○K 見逃三振", () => {
    expect(formatRecordColumnNotation("K", "2", {})).toBe("K");
    expect(formatRecordColumnNotation("K", "2", { modifiers: ["○K（見逃三振）"] })).toBe("○K");
  });
});
