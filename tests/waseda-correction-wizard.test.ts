import { describe, expect, it } from "vitest";
import { createInitialData, makeGame, type AtBatEvent } from "../lib/baseball/types";
import {
  applyFormalScorebookAtBatReplacement,
  applyFormalScorebookBlankCorrection,
} from "../lib/baseball/formal-scorebook-correction";
import { getRecordTrajectoryMark } from "../lib/baseball/record-column-notation";

describe("早稻田筆誤錯登五步驟引導與預覽機制", () => {
  it("步驟 1~5 資料組裝能完整生成合規的 AtBatEvent 與更正標記", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];

    const batter = away.players[0];
    const pitcher = home.players[0];

    // 模擬精靈中五步驟所產生的狀態
    // 步驟 1: 打擊事件（球性: fly, 方向: 7 左外野, 結果: 1B, 傳球: 7-4）
    const trajectory = "fly";
    const direction = "7 左外野";
    const result = "1B";
    const fieldingSequence = "7-4";
    const rbi = 1;

    // 步驟 2: 跑壘事件（SB 盜壘成功，從 1 壘到 2 壘）
    const runnerEventType = "SB";

    // 步驟 3: 得分設定（自責分得分）
    const runsScored = 1;
    const isUnearned = false;

    // 步驟 4: 出局/殘壘標示
    const computedInnerMark = isUnearned ? "○" : "●";

    // 組裝預覽事件
    const notation = [
      result,
      `${getRecordTrajectoryMark(trajectory)}・${direction}`,
      fieldingSequence,
    ].join(" ");

    const previewEvent: AtBatEvent = {
      id: "test-wizard-preview-1-0",
      inning: 1,
      half: "away",
      batterId: batter.id,
      pitcherId: pitcher.id,
      result: "1B",
      notation,
      pitches: { balls: 0, strikes: 0, total: 0 },
      outsBefore: 0,
      runsScored,
      unearnedRunsDuringAtBat: isUnearned ? 1 : 0,
      recordColumn: {
        trajectory,
        battedBallPosition: direction,
        fieldingSequence,
        modifiers: [],
        rbi,
      },
      recordCorrection: {
        innerMark: computedInnerMark,
        otherMark: runnerEventType,
        revisedAt: "2026-10-06T08:00:00.000Z",
      },
      source: "manual",
      timestamp: "2026-10-06T08:00:00.000Z",
    };

    expect(previewEvent.result).toBe("1B");
    expect(previewEvent.notation).toContain("1B");
    expect(previewEvent.notation).toContain("︵");
    expect(previewEvent.recordCorrection?.innerMark).toBe("●");
  });

  it("可成功套用至空白格正式補登並重播正確賽事資料與統計", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const game = makeGame({
      name: "精靈補登重播測試",
      venue: "測試球場",
      date: "2026-10-06",
      awayTeamId: away.id,
      homeTeamId: home.id,
      maxInnings: 6,
    });
    game.status = "final";

    const batter = away.players[0];
    const pitcher = home.players[0];

    const replacementEvent: AtBatEvent = {
      id: "formal-wizard-event-1",
      inning: 1,
      half: "away",
      batterId: batter.id,
      pitcherId: pitcher.id,
      result: "2B",
      notation: "2B line・8",
      pitches: { balls: 0, strikes: 0, total: 0 },
      outsBefore: 0,
      runsScored: 0,
      recordColumn: {
        trajectory: "line",
        battedBallPosition: "8 中外野",
        fieldingSequence: "",
        modifiers: [],
        rbi: 1,
      },
      recordCorrection: {
        innerMark: "Ⅱ",
        revisedAt: "2026-10-06T08:00:00.000Z",
      },
      source: "manual",
      timestamp: "2026-10-06T08:00:00.000Z",
    };

    const updatedGame = applyFormalScorebookBlankCorrection(game, {
      slot: {
        side: "away",
        battingOrder: 1,
        entryIndex: 0,
        inning: 1,
        slotIndex: 0,
        playerId: batter.id,
      },
      replacementEvent,
      note: "依中央矩陣筆誤錯登精靈修正",
    });

    expect(updatedGame.events).toHaveLength(1);
    expect(updatedGame.events[0].result).toBe("2B");
    expect(updatedGame.events[0].recordColumn?.trajectory).toBe("line");
    expect(updatedGame.events[0].recordCorrection?.innerMark).toBe("Ⅱ");
    expect(updatedGame.formalScorebookCorrections).toHaveLength(1);
  });

  it("可成功對既有打席進行【筆誤錯登】正式重建", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const game = makeGame({
      name: "精靈重建測試",
      venue: "測試球場",
      date: "2026-10-06",
      awayTeamId: away.id,
      homeTeamId: home.id,
      maxInnings: 6,
    });
    game.status = "final";

    const batter = away.players[0];
    const pitcher = home.players[0];

    // 原打席事件 (例如原先誤記為 1B)
    const originalEvent: AtBatEvent = {
      id: "event-original-1",
      inning: 1,
      half: "away",
      batterId: batter.id,
      pitcherId: pitcher.id,
      result: "1B",
      notation: "1B",
      pitches: { balls: 0, strikes: 0, total: 0 },
      outsBefore: 0,
      runsScored: 0,
      source: "manual",
      timestamp: "2026-10-06T08:00:00.000Z",
    };
    game.events = [originalEvent];

    // 使用筆誤錯登精靈重建為 HR
    const replacementEvent: AtBatEvent = {
      ...originalEvent,
      result: "HR",
      notation: "HR fly・7",
      runsScored: 1,
      recordColumn: {
        trajectory: "fly",
        battedBallPosition: "7 左外野",
        modifiers: [],
        rbi: 1,
      },
      recordCorrection: {
        innerMark: "●",
        revisedAt: "2026-10-06T08:00:00.000Z",
      },
    };

    const updatedGame = applyFormalScorebookAtBatReplacement(game, {
      targetEventId: originalEvent.id,
      replacementEvent,
      note: "長按筆誤錯登重構精靈修正為全壘打",
    });

    expect(updatedGame.events).toHaveLength(1);
    expect(updatedGame.events[0].result).toBe("HR");
    expect(updatedGame.events[0].runsScored).toBe(1);
    expect(updatedGame.events[0].recordCorrection?.innerMark).toBe("●");
  });
});
