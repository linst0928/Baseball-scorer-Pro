import { describe, it, expect } from "vitest";
import {
  nextSpecialRunnerState,
  updateGameAfterSpecialEvent,
  applyPickoffOutcome,
  type Game,
  type SpecialEvent,
  type RunnerState,
  type AtBatEvent,
  type PickoffRunnerOutcome,
} from "../lib/baseball/types";
import { getRunnerAdvanceLines } from "../lib/baseball/waseda-visuals";

describe("牽制出局 (Pickoff Out) 核心判定與狀態更新測試", () => {
  const mockGame: Game = {
    id: "game-test",
    name: "測試比賽",
    venue: "測試球場",
    date: "2026-09-21",
    status: "live",
    homeTeamId: "team-home",
    awayTeamId: "team-away",
    inning: 1,
    half: "away",
    outs: 0,
    awayBatterIndex: 0,
    homeBatterIndex: 0,
    score: [{ inning: 1, away: 0, home: 0 }],
    runners: { first: null, second: null, third: null },
    events: [],
    specialEvents: [],
    substitutions: [],
    notes: "",
    maxInnings: 9,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const createBaseRunners = (): RunnerState => ({
    first: "R1",
    second: "R2",
    third: "R3",
  });

  const createEventsWithRunners = (): AtBatEvent[] => [
    {
      id: "ab-r1",
      inning: 1,
      half: "away",
      batterId: "R1",
      pitcherId: "P1",
      result: "1B",
      notation: "1B",
      runsScored: 0,
      outsBefore: 0,
      pitches: { balls: 0, strikes: 0, total: 1 },
      timestamp: new Date().toISOString(),
    },
    {
      id: "ab-r2",
      inning: 1,
      half: "away",
      batterId: "R2",
      pitcherId: "P1",
      result: "1B",
      notation: "1B",
      runsScored: 0,
      outsBefore: 0,
      pitches: { balls: 0, strikes: 0, total: 1 },
      timestamp: new Date().toISOString(),
    },
    {
      id: "ab-r3",
      inning: 1,
      half: "away",
      batterId: "R3",
      pitcherId: "P1",
      result: "1B",
      notation: "1B",
      runsScored: 0,
      outsBefore: 0,
      pitches: { balls: 0, strikes: 0, total: 1 },
      timestamp: new Date().toISOString(),
    },
    {
      id: "ab-batter",
      inning: 1,
      half: "away",
      batterId: "B2",
      pitcherId: "P1",
      result: undefined as any,
      notation: "",
      runsScored: 0,
      outsBefore: 0,
      pitches: { balls: 0, strikes: 0, total: 0 },
      timestamp: new Date().toISOString(),
    }
  ];

  it("一壘牽制 - 投手發起 (PO1-3)", () => {
    const runnersBefore = createBaseRunners();
    const movement = nextSpecialRunnerState(runnersBefore, "PO", 1);

    expect(movement.runners.first).toBeNull();
    expect(movement.runners.second).toBe("R2");
    expect(movement.runners.third).toBe("R3");
    expect(movement.outsAdded).toBe(1);

    const event: SpecialEvent = {
      id: "event-po-1-3",
      inning: mockGame.inning,
      half: mockGame.half,
      type: "PO",
      runnerId: "R1",
      fromBase: 1,
      pickoffBase: "FIRST",
      outType: "PICKOFF_OUT",
      runsScored: 0,
      outsBefore: mockGame.outs,
      notation: "PO1-3",
      timestamp: new Date().toISOString(),
    };

    const gameBefore = { ...mockGame, runners: runnersBefore, events: createEventsWithRunners() };
    const gameAfter = updateGameAfterSpecialEvent(gameBefore, event, movement.runners, movement.runs, movement.outsAdded);

    expect(gameAfter.runners.first).toBeNull();
    expect(gameAfter.runners.second).toBe("R2");
    expect(gameAfter.runners.third).toBe("R3");
    expect(gameAfter.outs).toBe(1);

    // 驗證生成的 notation 寫入被牽制跑者(R1)的來源打席
    const r1AtBat = gameAfter.events.find(e => e.batterId === "R1");
    expect(r1AtBat).toBeDefined();
    expect(r1AtBat?.runnerAdvances).toBeDefined();
    expect(r1AtBat?.runnerAdvances?.at(-1)?.notation).toBe("PO1-3");

    // 驗證當前打者 (B2) 的打席格絕無牽制符號
    const currentBatterAtBat = gameAfter.events.find(e => e.batterId === "B2");
    expect(currentBatterAtBat?.runnerAdvances).toBeUndefined();
  });

  it("一壘牽制 - 捕手發起 (PO2-3)", () => {
    const runnersBefore = createBaseRunners();
    const movement = nextSpecialRunnerState(runnersBefore, "PO", 1);

    const event: SpecialEvent = {
      id: "event-po-2-3",
      inning: mockGame.inning,
      half: mockGame.half,
      type: "PO",
      runnerId: "R1",
      fromBase: 1,
      pickoffBase: "FIRST",
      outType: "PICKOFF_OUT",
      runsScored: 0,
      outsBefore: mockGame.outs,
      notation: "PO2-3",
      timestamp: new Date().toISOString(),
    };

    const gameBefore = { ...mockGame, runners: runnersBefore, events: createEventsWithRunners() };
    const gameAfter = updateGameAfterSpecialEvent(gameBefore, event, movement.runners, movement.runs, movement.outsAdded);

    const r1AtBat = gameAfter.events.find(e => e.batterId === "R1");
    expect(r1AtBat?.runnerAdvances?.at(-1)?.notation).toBe("PO2-3");
  });

  it("二壘牽制 - 投手發起傳二壘手 (PO1-4)", () => {
    const runnersBefore = createBaseRunners();
    const movement = nextSpecialRunnerState(runnersBefore, "PO", 2);

    expect(movement.runners.second).toBeNull();

    const event: SpecialEvent = {
      id: "event-po-1-4",
      inning: mockGame.inning,
      half: mockGame.half,
      type: "PO",
      runnerId: "R2",
      fromBase: 2,
      pickoffBase: "SECOND",
      outType: "PICKOFF_OUT",
      runsScored: 0,
      outsBefore: mockGame.outs,
      notation: "PO1-4",
      timestamp: new Date().toISOString(),
    };

    const gameBefore = { ...mockGame, runners: runnersBefore, events: createEventsWithRunners() };
    const gameAfter = updateGameAfterSpecialEvent(gameBefore, event, movement.runners, movement.runs, movement.outsAdded);

    const r2AtBat = gameAfter.events.find(e => e.batterId === "R2");
    expect(r2AtBat?.runnerAdvances?.at(-1)?.notation).toBe("PO1-4");
  });

  it("二壘牽制 - 投手發起傳游擊手 (PO1-6)", () => {
    const runnersBefore = createBaseRunners();
    const movement = nextSpecialRunnerState(runnersBefore, "PO", 2);

    const event: SpecialEvent = {
      id: "event-po-1-6",
      inning: mockGame.inning,
      half: mockGame.half,
      type: "PO",
      runnerId: "R2",
      fromBase: 2,
      pickoffBase: "SECOND",
      outType: "PICKOFF_OUT",
      runsScored: 0,
      outsBefore: mockGame.outs,
      notation: "PO1-6",
      timestamp: new Date().toISOString(),
    };

    const gameBefore = { ...mockGame, runners: runnersBefore, events: createEventsWithRunners() };
    const gameAfter = updateGameAfterSpecialEvent(gameBefore, event, movement.runners, movement.runs, movement.outsAdded);

    const r2AtBat = gameAfter.events.find(e => e.batterId === "R2");
    expect(r2AtBat?.runnerAdvances?.at(-1)?.notation).toBe("PO1-6");
  });

  it("二壘牽制 - 捕手發起 (PO2-4)", () => {
    const runnersBefore = createBaseRunners();
    const movement = nextSpecialRunnerState(runnersBefore, "PO", 2);

    const event: SpecialEvent = {
      id: "event-po-2-4",
      inning: mockGame.inning,
      half: mockGame.half,
      type: "PO",
      runnerId: "R2",
      fromBase: 2,
      pickoffBase: "SECOND",
      outType: "PICKOFF_OUT",
      runsScored: 0,
      outsBefore: mockGame.outs,
      notation: "PO2-4",
      timestamp: new Date().toISOString(),
    };

    const gameBefore = { ...mockGame, runners: runnersBefore, events: createEventsWithRunners() };
    const gameAfter = updateGameAfterSpecialEvent(gameBefore, event, movement.runners, movement.runs, movement.outsAdded);

    const r2AtBat = gameAfter.events.find(e => e.batterId === "R2");
    expect(r2AtBat?.runnerAdvances?.at(-1)?.notation).toBe("PO2-4");
  });

  it("三壘牽制 - 投手發起 (PO1-5)", () => {
    const runnersBefore = createBaseRunners();
    const movement = nextSpecialRunnerState(runnersBefore, "PO", 3);

    expect(movement.runners.third).toBeNull();

    const event: SpecialEvent = {
      id: "event-po-1-5",
      inning: mockGame.inning,
      half: mockGame.half,
      type: "PO",
      runnerId: "R3",
      fromBase: 3,
      pickoffBase: "THIRD",
      outType: "PICKOFF_OUT",
      runsScored: 0,
      outsBefore: mockGame.outs,
      notation: "PO1-5",
      timestamp: new Date().toISOString(),
    };

    const gameBefore = { ...mockGame, runners: runnersBefore, events: createEventsWithRunners() };
    const gameAfter = updateGameAfterSpecialEvent(gameBefore, event, movement.runners, movement.runs, movement.outsAdded);

    const r3AtBat = gameAfter.events.find(e => e.batterId === "R3");
    expect(r3AtBat?.runnerAdvances?.at(-1)?.notation).toBe("PO1-5");
  });

  it("三壘牽制 - 捕手發起 (PO2-5)", () => {
    const runnersBefore = createBaseRunners();
    const movement = nextSpecialRunnerState(runnersBefore, "PO", 3);

    const event: SpecialEvent = {
      id: "event-po-2-5",
      inning: mockGame.inning,
      half: mockGame.half,
      type: "PO",
      runnerId: "R3",
      fromBase: 3,
      pickoffBase: "THIRD",
      outType: "PICKOFF_OUT",
      runsScored: 0,
      outsBefore: mockGame.outs,
      notation: "PO2-5",
      timestamp: new Date().toISOString(),
    };

    const gameBefore = { ...mockGame, runners: runnersBefore, events: createEventsWithRunners() };
    const gameAfter = updateGameAfterSpecialEvent(gameBefore, event, movement.runners, movement.runs, movement.outsAdded);

    const r3AtBat = gameAfter.events.find(e => e.batterId === "R3");
    expect(r3AtBat?.runnerAdvances?.at(-1)?.notation).toBe("PO2-5");
  });

  it("兩出局三壘牽制出局 - 觸發攻守交換並清空壘包", () => {
    const runnersBefore = createBaseRunners();
    const movement = nextSpecialRunnerState(runnersBefore, "PO", 3);

    const event: SpecialEvent = {
      id: "event-po-3outs",
      inning: mockGame.inning,
      half: mockGame.half,
      type: "PO",
      runnerId: "R3",
      fromBase: 3,
      pickoffBase: "THIRD",
      outType: "PICKOFF_OUT",
      runsScored: 0,
      outsBefore: 2, // 兩出局
      notation: "PO1-5",
      timestamp: new Date().toISOString(),
    };

    const gameBefore = { ...mockGame, runners: runnersBefore, outs: 2, events: createEventsWithRunners() };
    const gameAfter = updateGameAfterSpecialEvent(gameBefore, event, movement.runners, movement.runs, movement.outsAdded);

    expect(gameAfter.outs).toBe(0); // 重置為 0
    expect(gameAfter.runners.first).toBeNull();
    expect(gameAfter.runners.second).toBeNull();
    expect(gameAfter.runners.third).toBeNull();
    expect(gameAfter.half).toBe("home"); // 攻守切換由 away 變為 home
  });

  describe("🎯 實務規格情境範例 1~5 全面測試", () => {
    it("範例 1：單純牽制出局 - 一壘跑者遭捕手牽制出局 (PO2-3)", () => {
      const initialGame: Game = {
        ...mockGame,
        runners: { first: "R1", second: null, third: null },
        events: createEventsWithRunners(),
      };

      const outcomes: PickoffRunnerOutcome[] = [
        {
          runnerId: "R1",
          fromBase: 1,
          isTarget: true,
          isOut: true,
          notation: "PO2-3",
        },
      ];

      const afterGame = applyPickoffOutcome(initialGame, outcomes, "P1");

      expect(afterGame.outs).toBe(1);
      expect(afterGame.runners.first).toBeNull();

      const r1AtBat = afterGame.events.find((e) => e.batterId === "R1");
      expect(r1AtBat?.runnerAdvances?.at(-1)?.notation).toBe("PO2-3");
      expect(r1AtBat?.runnerAdvances?.at(-1)?.outType).toBe("PICKOFF_OUT");
    });

    it("範例 2：牽制失誤導致推進 - 二壘跑者遭投手牽制 (二壘手) 失誤進三壘 (PO1-4E)", () => {
      const initialGame: Game = {
        ...mockGame,
        runners: { first: null, second: "R2", third: null },
        events: createEventsWithRunners(),
      };

      const outcomes: PickoffRunnerOutcome[] = [
        {
          runnerId: "R2",
          fromBase: 2,
          isTarget: true,
          isOut: false,
          toBase: 3,
          notation: "PO1-4E",
        },
      ];

      const afterGame = applyPickoffOutcome(initialGame, outcomes, "P1");

      expect(afterGame.outs).toBe(0);
      expect(afterGame.runners.second).toBeNull();
      expect(afterGame.runners.third).toBe("R2");

      const r2AtBat = afterGame.events.find((e) => e.batterId === "R2");
      const r2Advance = r2AtBat?.runnerAdvances?.at(-1);
      expect(r2Advance?.notation).toBe("PO1-4E");
      expect(r2Advance?.fromBase).toBe(2);
      expect(r2Advance?.toBase).toBe(3);

      // 驗證跑壘線為無箭頭推進藍線
      const advanceLines = getRunnerAdvanceLines({ runnerAdvance: r2Advance });
      expect(advanceLines[0]?.segment).toBe("second-to-third");
      expect(advanceLines[0]?.hasArrow).toBe(false);
      expect(advanceLines[0]?.label).toBeUndefined();
    });

    it("範例 3：牽制出局，但其他跑者趁機得分 - 牽制二壘出局 (PO1-6)，三壘跑者回本壘得分", () => {
      const initialGame: Game = {
        ...mockGame,
        runners: { first: null, second: "R2", third: "R3" },
        events: createEventsWithRunners(),
      };

      const outcomes: PickoffRunnerOutcome[] = [
        {
          runnerId: "R2",
          fromBase: 2,
          isTarget: true,
          isOut: true,
          notation: "PO1-6",
        },
        {
          runnerId: "R3",
          fromBase: 3,
          isTarget: false,
          isOut: false,
          toBase: 4,
          notation: "ADV",
        },
      ];

      const afterGame = applyPickoffOutcome(initialGame, outcomes, "P1");

      expect(afterGame.outs).toBe(1);
      expect(afterGame.runners.second).toBeNull();
      expect(afterGame.runners.third).toBeNull();
      expect(afterGame.score[0]?.away).toBe(1);

      // 1. 二壘跑者右上角顯示 PO1-6
      const r2AtBat = afterGame.events.find((e) => e.batterId === "R2");
      expect(r2AtBat?.runnerAdvances?.at(-1)?.notation).toBe("PO1-6");

      // 2. 三壘跑者畫出三壘往本壘無箭頭藍線
      const r3AtBat = afterGame.events.find((e) => e.batterId === "R3");
      const r3Advance = r3AtBat?.runnerAdvances?.at(-1);
      expect(r3Advance?.fromBase).toBe(3);
      expect(r3Advance?.toBase).toBe(4);

      // 3. 當下打者打席格記錄非自責分 (⭕)
      const currentBatterAtBat = afterGame.events.find((e) => e.batterId === "B2");
      expect(currentBatterAtBat?.unearnedRunsDuringAtBat).toBe(1);
    });

    it("範例 4：雙殺/多重傳球牽制出局 - 牽制三壘出局 (PO1-5)，一壘跑者遭三壘手傳二壘手觸殺 (PO1-5-4)", () => {
      const initialGame: Game = {
        ...mockGame,
        runners: { first: "R1", second: null, third: "R3" },
        events: createEventsWithRunners(),
      };

      const outcomes: PickoffRunnerOutcome[] = [
        {
          runnerId: "R3",
          fromBase: 3,
          isTarget: true,
          isOut: true,
          notation: "PO1-5",
        },
        {
          runnerId: "R1",
          fromBase: 1,
          isTarget: false,
          isOut: true,
          notation: "PO1-5-4",
        },
      ];

      const afterGame = applyPickoffOutcome(initialGame, outcomes, "P1");

      expect(afterGame.outs).toBe(2);
      expect(afterGame.runners.first).toBeNull();
      expect(afterGame.runners.third).toBeNull();

      const r3AtBat = afterGame.events.find((e) => e.batterId === "R3");
      expect(r3AtBat?.runnerAdvances?.at(-1)?.notation).toBe("PO1-5");

      const r1AtBat = afterGame.events.find((e) => e.batterId === "R1");
      expect(r1AtBat?.runnerAdvances?.at(-1)?.notation).toBe("PO1-5-4");
    });

    it("範例 5：牽制失誤導致得分 - 牽制三壘暴傳失誤 (PO1-5E)，三壘跑者回本壘得分", () => {
      const initialGame: Game = {
        ...mockGame,
        runners: { first: null, second: null, third: "R3" },
        events: createEventsWithRunners(),
      };

      const outcomes: PickoffRunnerOutcome[] = [
        {
          runnerId: "R3",
          fromBase: 3,
          isTarget: true,
          isOut: false,
          toBase: 4,
          notation: "PO1-5E",
        },
      ];

      const afterGame = applyPickoffOutcome(initialGame, outcomes, "P1");

      expect(afterGame.outs).toBe(0);
      expect(afterGame.runners.third).toBeNull();
      expect(afterGame.score[0]?.away).toBe(1);

      // 1. 三壘跑者右上角顯示 PO1-5E，推進線為無箭頭藍線
      const r3AtBat = afterGame.events.find((e) => e.batterId === "R3");
      const r3Advance = r3AtBat?.runnerAdvances?.at(-1);
      expect(r3Advance?.notation).toBe("PO1-5E");
      expect(r3Advance?.fromBase).toBe(3);
      expect(r3Advance?.toBase).toBe(4);

      const advanceLines = getRunnerAdvanceLines({ runnerAdvance: r3Advance });
      expect(advanceLines[0]?.segment).toBe("third-to-home");
      expect(advanceLines[0]?.hasArrow).toBe(false);

      // 2. 當下打者打席格記錄非自責得分，供菱形中央繪製紅色空心圓圈 (⭕)
      const currentBatterAtBat = afterGame.events.find((e) => e.batterId === "B2");
      expect(currentBatterAtBat?.unearnedRunsDuringAtBat).toBe(1);
    });
  });
});
