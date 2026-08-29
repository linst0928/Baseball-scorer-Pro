import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { AtBatResult, PitchOutcome } from "../lib/baseball/types";
import { getPitchCorrectionPreview, getRecordCorrectionLockReason, getRecordCorrectionSymbolIdsForMode, getRecordCorrectionTargetsForMode, getRecordCorrectionValue, isRecordCorrectionUnlocked, mergeRecordCorrection, RECORD_CORRECTION_TARGETS } from "../lib/baseball/record-correction";

describe("整體紀錄表個人紀錄補正", () => {
  it("只在已切換的前一半局或比賽結束後解鎖，不把進行中半局視為安全", () => {
    expect(isRecordCorrectionUnlocked({ status: "live", inning: 4, half: "away" }, { inning: 4, half: "away" })).toBe(false);
    expect(isRecordCorrectionUnlocked({ status: "live", inning: 4, half: "home" }, { inning: 4, half: "away" })).toBe(true);
    expect(isRecordCorrectionUnlocked({ status: "live", inning: 4, half: "home" }, { inning: 4, half: "home" })).toBe(false);
    expect(isRecordCorrectionUnlocked({ status: "live", inning: 5, half: "away" }, { inning: 4, half: "home" })).toBe(true);
    expect(isRecordCorrectionUnlocked({ status: "final", inning: 4, half: "away" }, { inning: 4, half: "away" })).toBe(true);
  });

  it("在不可修改時提供具體的半局安全鎖定原因", () => {
    expect(getRecordCorrectionLockReason({ status: "live", inning: 4, half: "away" }, { inning: 4, half: "away" }))
      .toContain("第 4 局上仍在進行");
    expect(getRecordCorrectionLockReason({ status: "live", inning: 4, half: "away" }, { inning: 4, half: "home" }))
      .toContain("所在半局確實結束");
    expect(getRecordCorrectionLockReason({ status: "final", inning: 4, half: "away" }, { inning: 4, half: "away" })).toBeUndefined();
  });

  it("只建立不可變的顯示補正，絕不改動打席結果、得分、出局、跑壘或逐球資料", () => {
    const event = {
      id: "atbat-1",
      result: "1B",
      runsScored: 1,
      outsBefore: 1,
      runnerAdvances: [{ runnerId: "runner-1", fromBase: 1, toBase: 2, type: "ADV" }],
      pitches: { locations: [{ outcome: "BALL" }] },
      recordCorrection: { innerMark: "I", revisedAt: "2026-08-24T10:00:00.000Z" },
    };
    const originalCorrection = { ...event.recordCorrection };
    const correction = mergeRecordCorrection(event.recordCorrection, "rightBottom", "6ー3", "補記守備傳接", "2026-08-24T10:01:00.000Z");
    const correctedEvent = { ...event, recordCorrection: correction };

    expect(correctedEvent).toMatchObject({
      result: "1B",
      runsScored: 1,
      outsBefore: 1,
      runnerAdvances: [{ runnerId: "runner-1", fromBase: 1, toBase: 2, type: "ADV" }],
      pitches: { locations: [{ outcome: "BALL" }] },
      recordCorrection: { innerMark: "I", outerMarks: { rightBottom: "6ー3" }, note: "補記守備傳接" },
    });
    expect(event.recordCorrection).toEqual(originalCorrection);
    expect(getRecordCorrectionValue(correctedEvent.recordCorrection, "rightBottom")).toBe("6ー3");
    expect(getRecordCorrectionValue(correctedEvent.recordCorrection, "pitch")).toBe("");
  });

  it("清除最後一個補正欄位時會移除覆蓋物件，且保留原資料不變", () => {
    const current = { pitchMarks: "—○△", revisedAt: "2026-08-24T10:00:00.000Z" };
    const cleared = mergeRecordCorrection(current, "pitch", "", "", "2026-08-24T10:02:00.000Z");

    expect(cleared).toBeUndefined();
    expect(current).toEqual({ pitchMarks: "—○△", revisedAt: "2026-08-24T10:00:00.000Z" });
  });

  it("依逐球欄、外圈、內圈與其他四區保存顯示覆蓋，且舊版分角資料保持相容", () => {
    const first = mergeRecordCorrection(undefined, "pitch", "—○△", "", "2026-08-24T10:00:00.000Z");
    const second = mergeRecordCorrection(first, "outer", "⌒7 2B 7-4", "紙本核對", "2026-08-24T10:01:00.000Z");
    const third = mergeRecordCorrection(second, "inner", "○", "紙本核對", "2026-08-24T10:02:00.000Z");
    const fourth = mergeRecordCorrection(third, "other", "代跑：9 張三", "紙本核對", "2026-08-24T10:03:00.000Z");

    expect(RECORD_CORRECTION_TARGETS.map((target) => target.id)).toEqual(["pitch", "outer", "inner", "other"]);
    expect(fourth).toMatchObject({ pitchMarks: "—○△", outerMark: "⌒7 2B 7-4", innerMark: "○", otherMark: "代跑：9 張三", note: "紙本核對" });
    expect(getRecordCorrectionValue(fourth, "outer")).toBe("⌒7 2B 7-4");
    expect(getRecordCorrectionValue(fourth, "other")).toBe("代跑：9 張三");
  });

  it("只在單場整體紀錄的逐球補正草稿中，要求原打席結果的結束符號位於最後一顆", () => {
    expect(getPitchCorrectionPreview(["ball", "ball", "ball", "ball"], "BB")).toMatchObject({ value: "— — — —", balls: 4, strikes: 0, terminal: "walk" });
    expect(getPitchCorrectionPreview(["strike", "foul", "swingingStrike"], "K")).toMatchObject({ balls: 0, strikes: 3, terminal: "strikeout" });
    expect(getPitchCorrectionPreview(["ball", "inPlay"], "1B")).toMatchObject({ balls: 1, strikes: 0, terminal: "in-play" });
    expect(getPitchCorrectionPreview(["inPlay", "ball"], "1B").error).toContain("必須是最後一顆");
    expect(getPitchCorrectionPreview(["ball", "ball", "ball"], "BB").error).toContain("第四壞球");
    expect(getPitchCorrectionPreview(["ball"], "HBP").error).toContain("觸身球打席");
  });

  it("安打、失誤與雙殺均可依逐球後的四步卡完成預覽，且確認只寫入顯示補正", () => {
    const scenarios: Array<{
      name: string;
      result: AtBatResult;
      pitchDraft: PitchOutcome[];
      outerMark: string;
      event: Record<string, unknown>;
    }> = [
      {
        name: "安打",
        result: "1B",
        pitchDraft: ["ball", "inPlay"],
        outerMark: "飛 7 1B 無傳接",
        event: {
          id: "hit-1",
          result: "1B",
          runsScored: 0,
          outsBefore: 1,
          runnerAdvances: [{ runnerId: "runner-1", fromBase: 1, toBase: 2, type: "ADV" }],
          pitches: { locations: [{ outcome: "BALL" }, { outcome: "IN_PLAY" }] },
        },
      },
      {
        name: "失誤",
        result: "E",
        pitchDraft: ["strike", "inPlay"],
        outerMark: "滾 6 E6 無傳接",
        event: {
          id: "error-1",
          result: "E",
          runsScored: 0,
          outsBefore: 0,
          runnerAdvances: [{ runnerId: "batter-1", fromBase: 0, toBase: 1, type: "ADV" }],
          pitches: { locations: [{ outcome: "STRIKE" }, { outcome: "IN_PLAY" }] },
        },
      },
      {
        name: "雙殺",
        result: "G",
        pitchDraft: ["foul", "inPlay"],
        outerMark: "滾 6 DP 6-4-3",
        event: {
          id: "double-play-1",
          result: "G",
          runsScored: 0,
          outsBefore: 0,
          runnerAdvances: [
            { runnerId: "runner-1", fromBase: 1, toBase: 0, type: "OUT" },
            { runnerId: "batter-1", fromBase: 0, toBase: 0, type: "OUT" },
          ],
          pitches: { locations: [{ outcome: "FOUL" }, { outcome: "IN_PLAY" }] },
        },
      },
      {
        name: "三殺",
        result: "G",
        pitchDraft: ["strike", "inPlay"],
        outerMark: "滾 5 5ー4ー3 TP",
        event: {
          id: "triple-play-1",
          result: "G",
          runsScored: 0,
          outsBefore: 0,
          recordColumn: { trajectory: "ground", battedBallPosition: "5", fieldingSequence: "5-4-3", fieldingPlay: "TP" },
          runnerAdvances: [
            { runnerId: "runner-2", fromBase: 2, toBase: 0, type: "OUT" },
            { runnerId: "runner-1", fromBase: 1, toBase: 0, type: "OUT" },
            { runnerId: "batter-1", fromBase: 0, toBase: 0, type: "OUT" },
          ],
          pitches: { locations: [{ outcome: "STRIKE" }, { outcome: "IN_PLAY" }] },
        },
      },
      {
        name: "野手選擇",
        result: "G",
        pitchDraft: ["ball", "inPlay"],
        outerMark: "滾 6 FC 6",
        event: {
          id: "fielder-choice-1",
          result: "G",
          runsScored: 0,
          outsBefore: 1,
          recordColumn: { trajectory: "ground", battedBallPosition: "6", fieldingSequence: "6", fieldingPlay: "FC" },
          runnerAdvances: [
            { runnerId: "runner-1", fromBase: 1, toBase: 0, type: "OUT" },
            { runnerId: "batter-1", fromBase: 0, toBase: 1, type: "ADV" },
          ],
          pitches: { locations: [{ outcome: "BALL" }, { outcome: "IN_PLAY" }] },
        },
      },
      {
        name: "多重失誤組合",
        result: "E",
        pitchDraft: ["strike", "inPlay"],
        outerMark: "滾 6 E6・E3 6ー3",
        event: {
          id: "multiple-errors-1",
          result: "E",
          runsScored: 1,
          outsBefore: 1,
          recordColumn: { trajectory: "ground", battedBallPosition: "6", fieldingSequence: "6-3", fieldingPlay: "E6・E3" },
          runnerAdvances: [
            { runnerId: "runner-3", fromBase: 3, toBase: 4, type: "SCORE" },
            { runnerId: "runner-2", fromBase: 2, toBase: 3, type: "ADV" },
            { runnerId: "batter-1", fromBase: 0, toBase: 1, type: "ADV" },
          ],
          pitches: { locations: [{ outcome: "STRIKE" }, { outcome: "IN_PLAY" }] },
        },
      },
    ];

    scenarios.forEach(({ name, result, pitchDraft, outerMark, event }) => {
      const before = structuredClone(event);
      const pitchPreview = getPitchCorrectionPreview(pitchDraft, result);
      expect(pitchPreview, name).toMatchObject({ terminal: "in-play" });
      expect(pitchPreview.error, name).toBeUndefined();

      const withPitch = mergeRecordCorrection(undefined, "pitch", pitchPreview.value, "流程測試", "2026-08-25T20:00:00.000Z");
      const correction = mergeRecordCorrection(withPitch, "outer", outerMark, "流程測試", "2026-08-25T20:01:00.000Z");

      expect(correction, name).toMatchObject({ pitchMarks: pitchPreview.value, outerMark, note: "流程測試" });
      expect(event, name).toEqual(before);
    });
  });

  it("強迫進壘保留逐球結束，跑壘補正不會錯誤開啟擊出球四步卡或改動正式進壘", () => {
    const event = {
      id: "forced-advance-1",
      result: "BB" as AtBatResult,
      runsScored: 1,
      outsBefore: 2,
      runnerAdvances: [
        { runnerId: "runner-3", fromBase: 3, toBase: 4, type: "SCORE" },
        { runnerId: "runner-2", fromBase: 2, toBase: 3, type: "ADV" },
        { runnerId: "runner-1", fromBase: 1, toBase: 2, type: "ADV" },
        { runnerId: "batter-1", fromBase: 0, toBase: 1, type: "ADV" },
      ],
      pitches: { locations: [{ outcome: "BALL" }, { outcome: "BALL" }, { outcome: "BALL" }, { outcome: "BALL" }] },
    };
    const before = structuredClone(event);
    const pitchPreview = getPitchCorrectionPreview(["ball", "ball", "ball", "ball"], event.result);
    const withPitch = mergeRecordCorrection(undefined, "pitch", pitchPreview.value, "強迫進壘測試", "2026-08-25T21:00:00.000Z");
    const correction = mergeRecordCorrection(withPitch, "outer", "BB 強迫進壘 1→2、2→3、3→本", "強迫進壘測試", "2026-08-25T21:01:00.000Z");

    expect(pitchPreview).toMatchObject({ terminal: "walk", balls: 4, strikes: 0 });
    expect(pitchPreview.error).toBeUndefined();
    expect(getRecordCorrectionTargetsForMode("runnerOnly").map((target) => target.id)).toEqual(["outer"]);
    expect(correction).toMatchObject({ pitchMarks: pitchPreview.value, outerMark: "BB 強迫進壘 1→2、2→3、3→本" });
    expect(event).toEqual(before);
  });

  it("三種修改模式都只限制顯示補正範圍，跑壘模式不得進入逐球、內圈或正式打席結果", () => {
    expect(getRecordCorrectionTargetsForMode("replaceAll").map((target) => target.id)).toEqual(["pitch", "outer", "inner", "other"]);
    expect(getRecordCorrectionTargetsForMode("editDisplay").map((target) => target.id)).toEqual(["pitch", "outer", "inner", "other"]);
    expect(getRecordCorrectionTargetsForMode("runnerOnly").map((target) => target.id)).toEqual(["outer"]);
    expect(getRecordCorrectionSymbolIdsForMode("pitch", "runnerOnly")).toEqual([]);
    expect(getRecordCorrectionSymbolIdsForMode("inner", "runnerOnly")).toEqual([]);
    expect(getRecordCorrectionSymbolIdsForMode("outer", "runnerOnly")).toEqual(["stolen-base", "caught-stealing", "pickoff", "wild-pitch", "passed-ball", "balk", "advance"]);
  });

  it("外圈依現場紀錄順序分開球性、結果與守備傳接符號，不把傳接混入球性或內圈", () => {
    expect(getRecordCorrectionSymbolIdsForMode("outer", "editDisplay", "ballQuality")).toEqual(["ground", "fly", "line"]);
    expect(getRecordCorrectionSymbolIdsForMode("outer", "editDisplay", "result")).toContain("single");
    expect(getRecordCorrectionSymbolIdsForMode("outer", "editDisplay", "result")).not.toContain("fielding-sequence");
    expect(getRecordCorrectionSymbolIdsForMode("outer", "editDisplay", "fielding")).toContain("fielding-sequence");
    expect(getRecordCorrectionSymbolIdsForMode("outer", "editDisplay", "fielding")).not.toContain("single");
  });

  it("四步卡將球性／方向、結果與傳接拆入固定分區，傳接只寫入右下角且不改正式資料", () => {
    const event = {
      id: "right-bottom-fielding",
      result: "E" as AtBatResult,
      runsScored: 1,
      outsBefore: 1,
      runnerAdvances: [{ runnerId: "runner-3", fromBase: 3, toBase: 4, type: "SCORE" }],
      pitches: { locations: [{ outcome: "STRIKE" }, { outcome: "IN_PLAY" }] },
    };
    const before = structuredClone(event);
    const summary = "滾 6 E6・E3 6ー3";
    const withSummary = mergeRecordCorrection(undefined, "outer", summary, "右下角傳接測試", "2026-08-25T22:00:00.000Z");
    const withBattedBall = mergeRecordCorrection(withSummary, "battedBallTop", "滾 6 游", "右下角傳接測試", "2026-08-25T22:00:01.000Z");
    const withResult = mergeRecordCorrection(withBattedBall, "rightTop", "E6・E3", "右下角傳接測試", "2026-08-25T22:00:02.000Z");
    const correction = mergeRecordCorrection(withResult, "rightBottom", "6ー3", "右下角傳接測試", "2026-08-25T22:00:03.000Z");

    expect(correction).toMatchObject({
      outerMark: summary,
      outerMarks: { battedBallTop: "滾 6 游", rightTop: "E6・E3", rightBottom: "6ー3" },
    });
    expect(getRecordCorrectionValue(correction, "rightBottom")).toBe("6ー3");
    expect(event).toEqual(before);
  });

  it("工作台保留唯讀查看、安全鎖、上一步與取消，且紀錄格優先呈現覆蓋內容", () => {
    const root = resolve(__dirname, "..");
    const homeScreen = readFileSync(resolve(root, "app/(tabs)/index.tsx"), "utf8");
    const recordCell = readFileSync(resolve(root, "components/baseball/waseda-personal-record-cell.tsx"), "utf8");
    const correctionRules = readFileSync(resolve(root, "lib/baseball/record-correction.ts"), "utf8");

    expect(homeScreen).toContain("function GameRecordDetailModal");
    expect(homeScreen).toContain("getRecordCorrectionLockReason(game, event)");
    expect(homeScreen).toContain("逐球欄、外圈、內圈或其他區");
    expect(homeScreen).toContain("擊出／觸擊後打擊事件");
    expect(homeScreen).toContain("1／4 選擇球性。");
    expect(homeScreen).toContain("2／4 選擇擊球方向／位置");
    expect(homeScreen).toContain("3／4 選擇打席結果或出局結果。");
    expect(homeScreen).toContain("4／4 選擇或輸入傳接球事件");
    expect(homeScreen).toContain("固定顯示在打席格右下角");
    expect(homeScreen).toContain('target: "battedBallTop" as const');
    expect(homeScreen).toContain('target: "rightBottom" as const');
    expect(homeScreen).toContain("FieldingSequenceButtonEditor");
    expect(homeScreen).toContain("RECORD_CORRECTION_OTHER_OPTIONS");
    expect(homeScreen).toContain("修改個人紀錄");
    expect(homeScreen).toContain("上一步");
    expect(homeScreen).toContain("取消");
    expect(homeScreen).toContain("此流程只校正早稻田紀錄格的顯示符號");
    expect(homeScreen).toContain("isRecordCorrectionUnlocked(activeGame, sourceEvent)");
    expect(homeScreen).toContain("mergeRecordCorrection(event.recordCorrection");
    expect(homeScreen).toContain("getPitchCorrectionPreview(pitchDraft, event.result)");
    expect(homeScreen).toContain('pitchPreview.terminal === "in-play"');
    expect(homeScreen).toContain("預覽修改結果");
    expect(homeScreen).toContain("修改前");
    expect(homeScreen).toContain("修改後");
    expect(homeScreen).toContain("確認才會寫入補正");
    expect(recordCell).toContain("const correction = event?.recordCorrection");
    expect(recordCell).toContain("correction?.pitchMarks");
    expect(recordCell).toContain("correction?.innerMark");
    expect(recordCell).toContain("correction?.outerMark");
    expect(recordCell).toContain("correction?.otherMark");
    expect(recordCell).toContain("outerMarks?.rightBottom");
    expect(homeScreen).toContain("AT_BAT_CORRECTION_MODES");
    expect(correctionRules).toContain("全刪除修改");
    expect(correctionRules).toContain("內容逐一修改");
    expect(correctionRules).toContain("跑壘紀錄修改");
    expect(homeScreen).toContain("onReplaceAll(event.id, target, pendingValue, note)");
    expect(homeScreen).toContain("onSaveBatch(event.id, pendingCorrections, note, correctionMode === \"replaceAll\")");
    expect(homeScreen).toContain("...(pitchDraft.length && pitchPreview && !pitchPreview.error");
    expect(homeScreen).toContain("{ target, value: normalizedValue }");
  });
});
