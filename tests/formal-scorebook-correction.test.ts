import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getBattingStats, makeGame, createInitialData } from "../lib/baseball/types";
import {
  applyFormalScorebookAtBatReplacement,
  applyFormalScorebookBlankCorrection,
  getFormalScorebookCorrectionLockReason,
  isFormalScorebookCorrectionUnlocked,
} from "../lib/baseball/formal-scorebook-correction";

describe("整體紀錄表正式更正模式", () => {
  it("僅對已結束半局或完場開放正式更正", () => {
    const data = createInitialData();
    const game = makeGame({ name: "正式更正鎖定", venue: "測試球場", date: "2026-08-26", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 6 });
    game.status = "live";
    game.inning = 1;
    game.half = "away";
    const slot = { side: "away" as const, battingOrder: 1, entryIndex: 0, inning: 1, slotIndex: 0, playerId: data.teams[0].players[0].id };

    expect(isFormalScorebookCorrectionUnlocked(game, slot)).toBe(false);
    expect(getFormalScorebookCorrectionLockReason(game, slot)).toContain("半局結束後");
    expect(isFormalScorebookCorrectionUnlocked({ ...game, half: "home" }, slot)).toBe(true);
    expect(isFormalScorebookCorrectionUnlocked({ ...game, status: "final" }, slot)).toBe(true);
  });

  it("長按空白格補登會保留稽核歷程，並讓正式事件與打擊統計參與重播", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const game = makeGame({ name: "空白格正式補登", venue: "測試球場", date: "2026-08-26", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 6 });
    game.status = "final";
    const baseline = structuredClone(game);
    const batter = away.players[0];
    const corrected = applyFormalScorebookBlankCorrection(game, {
      slot: { side: "away", battingOrder: 1, entryIndex: 0, inning: 1, slotIndex: 0, playerId: batter.id },
      replacementEvent: {
        id: "",
        inning: 1,
        half: "away",
        batterId: batter.id,
        pitcherId: home.players[0].id,
        result: "1B",
        notation: "1B ground・7 7-4",
        pitches: { balls: 1, strikes: 2, total: 3 },
        outsBefore: 0,
        runsScored: 0,
        recordColumn: { trajectory: "ground", battedBallPosition: "7", fieldingSequence: "7-4", modifiers: [], rbi: 0 },
        source: "manual",
        timestamp: "2026-08-26T09:00:00.000Z",
      },
      note: "核對紙本後補登",
    });

    expect(game).toEqual(baseline);
    expect(corrected.events).toHaveLength(1);
    expect(corrected.events[0]).toMatchObject({ result: "1B", batterId: batter.id, recordColumn: { trajectory: "ground", battedBallPosition: "7", fieldingSequence: "7-4" } });
    expect(corrected.formalScorebookCorrections).toHaveLength(1);
    expect(corrected.formalScorebookCorrections?.[0]).toMatchObject({ kind: "insert", priorScore: baseline.score, note: "核對紙本後補登" });
    expect(getBattingStats(corrected, away).find((line) => line.player.id === batter.id)).toMatchObject({ h: 1, oneB: 1, ab: 1 });
  });

  it("全刪除修改僅正式重建目標打席，保留其定位、稽核與其他打席", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const game = makeGame({ name: "單一打席正式重建", venue: "測試球場", date: "2026-08-27", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 6 });
    game.status = "final";
    const original = {
      id: "at-bat-to-rebuild",
      inning: 1,
      half: "away" as const,
      batterId: away.players[0].id,
      pitcherId: home.players[0].id,
      result: "G" as const,
      notation: "GO 6-3",
      pitches: { balls: 1, strikes: 1, total: 2 },
      outsBefore: 0,
      runsScored: 0,
      recordColumn: { trajectory: "ground" as const, battedBallPosition: "6", fieldingSequence: "6-3", modifiers: [], rbi: 0 },
      source: "manual" as const,
      timestamp: "2026-08-27T09:00:00.000Z",
    };
    const untouched = {
      ...original,
      id: "at-bat-unchanged",
      batterId: away.players[1].id,
      result: "K" as const,
      notation: "K",
      pitches: { balls: 0, strikes: 3, total: 3 },
      outsBefore: 1,
      recordColumn: { modifiers: [], rbi: 0 },
      timestamp: "2026-08-27T09:02:00.000Z",
    };
    game.events = [original, untouched];
    const baseline = structuredClone(game);

    const corrected = applyFormalScorebookAtBatReplacement(game, {
      targetEventId: original.id,
      slot: { side: "away", battingOrder: 1, entryIndex: 0, inning: 1, slotIndex: 0, playerId: original.batterId },
      replacementEvent: {
        ...original,
        id: "must-not-replace-id",
        inning: 9,
        half: "home",
        batterId: home.players[1].id,
        result: "BB",
        notation: "BB",
        pitches: { balls: 4, strikes: 0, total: 4 },
        outsBefore: 0,
        recordColumn: { modifiers: [], rbi: 0 },
        timestamp: "2026-08-27T12:00:00.000Z",
      },
      note: "原紀錄誤觸，依紙本全刪除後重建",
    });

    expect(game).toEqual(baseline);
    expect(corrected.events).toHaveLength(2);
    expect(corrected.events.find((event) => event.id === original.id)).toMatchObject({
      id: original.id,
      inning: 1,
      half: "away",
      batterId: original.batterId,
      timestamp: original.timestamp,
      result: "BB",
      notation: "BB",
    });
    expect(corrected.events.find((event) => event.id === untouched.id)).toMatchObject({
      ...untouched,
      // 前席由出局改為保送後，重播必須回算本席打擊前出局數與空跑壘推進。
      outsBefore: 0,
      runnerAdvances: [],
    });
    expect(corrected.formalScorebookCorrections?.at(-1)).toMatchObject({
      kind: "replace",
      affectedEventIds: [original.id, untouched.id],
      note: "原紀錄誤觸，依紙本全刪除後重建",
      previousEvent: original,
      replacementEvent: { id: original.id, result: "BB" },
    });
  });

  it("結果卡與空白格工作台固定使用 E、FO、GO，並經長按與現場式逐步預覽確認才寫入", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    const sheetSource = readFileSync(resolve(process.cwd(), "components/baseball/waseda-scorebook-team-sheet.tsx"), "utf8");
    const cellSource = readFileSync(resolve(process.cwd(), "components/baseball/waseda-personal-record-cell.tsx"), "utf8");

    expect(source).toContain('label: "飛球出局"');
    expect(source).toContain('label: "滾地出局"');
    expect(source).toContain('label: "失誤"');
    expect(source).toContain('label="確認正式更正"');
    expect(source).toContain("onApplyFormalBlankSlotCorrection");
    expect(source).toContain("onApplyFormalAtBatReplacement");
    expect(source).toContain("applyFormalScorebookAtBatReplacement");
    expect(source).toContain("FormalBlankSlotLiveWorkflowModal");
    expect(source).toContain('isReplacement ? "正式重建｜現場紀錄流程" : "正式補登｜現場紀錄流程"');
    expect(source).toContain('["pitches", "逐球"]');
    expect(source).toContain('["trajectory", "球性"]');
    expect(source).toContain('["direction", "方向"]');
    expect(source).toContain('["result", "結果"]');
    expect(source).toContain('["fielding", "傳球"]');
    expect(source).toContain("PITCH_CORRECTION_OPTIONS.map");
    expect(source).toContain("RECORD_TRAJECTORIES.map");
    expect(source).toContain("FIELD_POSITIONS.map");
    expect(source).toContain("recordPitchOutcome");
    expect(source).toContain("getPitchCorrectionPreview");
    expect(source).toContain("傳接球事件固定記在打席格右下角");
    expect(source).toContain('isReplacement ? "確認正式重建" : "確認正式補登"');
    expect(source).toContain("確認正式重建");
    expect(source).toContain("其他打席不變，並保留原始與重建內容的更正歷程");
    expect(sheetSource).toContain("WasedaPersonalRecordCell");
    expect(sheetSource).toContain("onLongPressBlankSlot");
    expect(sheetSource).toContain("delayLongPress={420}");
    expect(sheetSource).toContain("defenseEditTarget");
    expect(sheetSource).toContain("const INNING_WIDTH = 92;");
    expect(sheetSource).toContain('appearanceSlot: { position: "absolute", left: 0, right: 0, backgroundColor: "transparent", overflow: "hidden" }');
    expect(sheetSource).toContain("每格直接使用 WasedaPersonalRecordCell 自身紙本邊框，避免出現雙框與框外空白");
    expect(sheetSource).not.toContain("appearanceIndex:");
    expect(sheetSource).not.toContain("left: 3, right: 3, borderWidth: 1");
    expect(cellSource).toContain("diamondGuideTop");
    expect(cellSource).toContain("diamondGuideBottom");
    expect(cellSource).toContain("diamondGuideLeft");
    expect(cellSource).toContain("diamondGuideRight");
    expect(cellSource).toContain("diamondStage");
    expect(cellSource).not.toContain("diamondFrame");
    expect(cellSource).toContain('innerSquare: { width: 26, height: 26');
    expect(cellSource).toContain("borderStyle: \"dashed\"");
    expect(cellSource).toContain("rightBottom");
  });
});
