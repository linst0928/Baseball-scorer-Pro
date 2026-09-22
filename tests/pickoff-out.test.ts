import { describe, it, expect } from "vitest";
import { nextSpecialRunnerState, updateGameAfterSpecialEvent, type Game, type SpecialEvent, type RunnerState } from "../lib/baseball/types";

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

  it("Test 1: 一壘牽制 - 一壘有跑者被牽制出局", () => {
    const runnersBefore: RunnerState = { first: "R1", second: null, third: null };
    const movement = nextSpecialRunnerState(runnersBefore, "PO", 1);

    expect(movement.runners.first).toBeNull();
    expect(movement.runners.second).toBeNull();
    expect(movement.runners.third).toBeNull();
    expect(movement.outsAdded).toBe(1);
    expect(movement.runs).toBe(0);

    const event: SpecialEvent = {
      id: "event-po-1",
      inning: mockGame.inning,
      half: mockGame.half,
      type: "PO",
      runnerId: "R1",
      fromBase: 1,
      pickoffBase: "FIRST",
      outType: "PICKOFF_OUT",
      runsScored: 0,
      outsBefore: mockGame.outs,
      notation: "PO",
      timestamp: new Date().toISOString(),
    };

    const gameBefore = { ...mockGame, runners: runnersBefore };
    const gameAfter = updateGameAfterSpecialEvent(gameBefore, event, movement.runners, movement.runs, movement.outsAdded);

    expect(gameAfter.runners.first).toBeNull();
    expect(gameAfter.outs).toBe(1);
    expect(gameAfter.specialEvents).toHaveLength(1);
    expect(gameAfter.specialEvents[0].type).toBe("PO");
    expect(gameAfter.specialEvents[0].pickoffBase).toBe("FIRST");
    expect(gameAfter.specialEvents[0].outType).toBe("PICKOFF_OUT");
  });

  it("Test 2: 二壘牽制 - 二壘有跑者被牽制出局", () => {
    const runnersBefore: RunnerState = { first: null, second: "R2", third: null };
    const movement = nextSpecialRunnerState(runnersBefore, "PO", 2);

    expect(movement.runners.second).toBeNull();
    expect(movement.outsAdded).toBe(1);

    const event: SpecialEvent = {
      id: "event-po-2",
      inning: mockGame.inning,
      half: mockGame.half,
      type: "PO",
      runnerId: "R2",
      fromBase: 2,
      pickoffBase: "SECOND",
      outType: "PICKOFF_OUT",
      runsScored: 0,
      outsBefore: mockGame.outs,
      notation: "PO",
      timestamp: new Date().toISOString(),
    };

    const gameBefore = { ...mockGame, runners: runnersBefore };
    const gameAfter = updateGameAfterSpecialEvent(gameBefore, event, movement.runners, movement.runs, movement.outsAdded);

    expect(gameAfter.runners.second).toBeNull();
    expect(gameAfter.outs).toBe(1);
    expect(gameAfter.specialEvents[0].pickoffBase).toBe("SECOND");
  });

  it("Test 3: 三壘牽制 - 三壘有跑者被牽制出局", () => {
    const runnersBefore: RunnerState = { first: null, second: null, third: "R3" };
    const movement = nextSpecialRunnerState(runnersBefore, "PO", 3);

    expect(movement.runners.third).toBeNull();
    expect(movement.outsAdded).toBe(1);

    const event: SpecialEvent = {
      id: "event-po-3",
      inning: mockGame.inning,
      half: mockGame.half,
      type: "PO",
      runnerId: "R3",
      fromBase: 3,
      pickoffBase: "THIRD",
      outType: "PICKOFF_OUT",
      runsScored: 0,
      outsBefore: mockGame.outs,
      notation: "PO",
      timestamp: new Date().toISOString(),
    };

    const gameBefore = { ...mockGame, runners: runnersBefore };
    const gameAfter = updateGameAfterSpecialEvent(gameBefore, event, movement.runners, movement.runs, movement.outsAdded);

    expect(gameAfter.runners.third).toBeNull();
    expect(gameAfter.outs).toBe(1);
    expect(gameAfter.specialEvents[0].pickoffBase).toBe("THIRD");
  });

  it("Test 4: 一壘無人 - 按一壘牽制不產生任何出局與事件", () => {
    const runnersBefore: RunnerState = { first: null, second: null, third: null };
    const movement = nextSpecialRunnerState(runnersBefore, "PO", 1);

    expect(movement.runners.first).toBeNull();
    expect(movement.outsAdded).toBe(0);
  });

  it("Test 5: 滿壘一壘牽制 - 僅一壘跑者出局，其餘二三壘跑者留在原壘包不移動", () => {
    const runnersBefore: RunnerState = { first: "R1", second: "R2", third: "R3" };
    const movement = nextSpecialRunnerState(runnersBefore, "PO", 1);

    expect(movement.runners.first).toBeNull();
    expect(movement.runners.second).toBe("R2");
    expect(movement.runners.third).toBe("R3");
    expect(movement.outsAdded).toBe(1);
    expect(movement.runs).toBe(0);

    const event: SpecialEvent = {
      id: "event-po-full-1",
      inning: mockGame.inning,
      half: mockGame.half,
      type: "PO",
      runnerId: "R1",
      fromBase: 1,
      pickoffBase: "FIRST",
      outType: "PICKOFF_OUT",
      runsScored: 0,
      outsBefore: mockGame.outs,
      notation: "PO",
      timestamp: new Date().toISOString(),
    };

    const gameBefore = { ...mockGame, runners: runnersBefore };
    const gameAfter = updateGameAfterSpecialEvent(gameBefore, event, movement.runners, movement.runs, movement.outsAdded);

    expect(gameAfter.runners.first).toBeNull();
    expect(gameAfter.runners.second).toBe("R2");
    expect(gameAfter.runners.third).toBe("R3");
    expect(gameAfter.outs).toBe(1);
  });

  it("Test 6: 兩出局一壘牽制出局 - 正確觸發半局結束與壘包清除", () => {
    const runnersBefore: RunnerState = { first: "R1", second: null, third: null };
    const movement = nextSpecialRunnerState(runnersBefore, "PO", 1);

    const event: SpecialEvent = {
      id: "event-po-3outs",
      inning: mockGame.inning,
      half: mockGame.half,
      type: "PO",
      runnerId: "R1",
      fromBase: 1,
      pickoffBase: "FIRST",
      outType: "PICKOFF_OUT",
      runsScored: 0,
      outsBefore: 2, // 兩出局
      notation: "PO",
      timestamp: new Date().toISOString(),
    };

    const gameBefore = { ...mockGame, runners: runnersBefore, outs: 2 };
    const gameAfter = updateGameAfterSpecialEvent(gameBefore, event, movement.runners, movement.runs, movement.outsAdded);

    expect(gameAfter.outs).toBe(0); // 正常狀態機清除為 0
    expect(gameAfter.runners.first).toBeNull();
    expect(gameAfter.runners.second).toBeNull();
    expect(gameAfter.runners.third).toBeNull();
    expect(gameAfter.half).toBe("home"); // 攻守切換由 away 變為 home
  });
});
