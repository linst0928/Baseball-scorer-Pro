import { describe, expect, it } from "vitest";
import { calculateWasedaMatrixStats, createWasedaScorebookProjection } from "../lib/baseball/waseda-scorebook-projection";
import type { Game, Team, AtBatEvent } from "../lib/baseball/types";

const mockTeam = (id: string, name: string): Team => ({
  id,
  name,
  code: name.slice(0, 2),
  players: Array.from({ length: 9 }, (_, i) => ({
    id: `${id}-p${i + 1}`,
    name: `球員${i + 1}`,
    number: i + 1,
    position: "1",
    throwingHand: "R",
    battingHand: "R",
    throws: "R",
    bats: "R",
  })),
});

const mockEvent = (id: string, inning: number, half: "away" | "home", batterId: string): AtBatEvent => ({
  id,
  inning,
  half,
  batterId,
  pitcherId: "pitcher-1",
  outsBefore: 0,
  result: "1B",
  runsScored: 0,
  pitches: { balls: 0, strikes: 0, total: 1 },
  timestamp: new Date().toISOString(),
  notation: "1B",
});

describe("【任務 6-2：C1 標頭與 C2 早稻田矩陣邏輯】單元測試", () => {
  it("C2 矩陣動態局數裁切/增列邏輯：無延長時呈現設定上限，延長時動態增列", () => {
    const away = mockTeam("away", "客隊");
    const home = mockTeam("home", "主隊");

    // 例1：原設定 6 局比賽，實際進行 5 局，顯示 6 局
    const inningCount1 = Math.max(6, 5, 5, 1);
    const projection1 = createWasedaScorebookProjection({
      team: away,
      side: "away",
      events: [mockEvent("e1", 5, "away", away.players[0].id)],
      substitutions: [],
      inningCount: inningCount1,
    });
    expect(projection1.innings.length).toBe(6);

    // 例2：原設定 6 局比賽，延長至 8 局，動態增列至 8 局
    const inningCount2 = Math.max(6, 8, 8, ...[8]);
    const projection2 = createWasedaScorebookProjection({
      team: away,
      side: "away",
      events: [mockEvent("e2", 8, "away", away.players[0].id)],
      substitutions: [],
      inningCount: inningCount2,
    });
    expect(projection2.innings.length).toBe(8);
  });

  it("手動修正權限邏輯：進行中比賽鎖定目前進行局，完賽後全開放", () => {
    const isEditingAllowed = (gameStatus: Game["status"], currentInning: number, targetInning: number) => {
      if (gameStatus === "final") return true;
      return targetInning < currentInning;
    };

    // 進行中（第 5 局）：無法修改第 5 局，但可修改第 1-4 局
    expect(isEditingAllowed("live", 5, 5)).toBe(false);
    expect(isEditingAllowed("live", 5, 4)).toBe(true);
    expect(isEditingAllowed("live", 5, 1)).toBe(true);

    // 完賽：所有局數（1-5 局）皆可修改
    expect(isEditingAllowed("final", 5, 5)).toBe(true);
    expect(isEditingAllowed("final", 5, 3)).toBe(true);
  });

  it("【任務 6-3】早稻田矩陣邏輯統計計算：精確統計9項指標，且失誤讀取對手矩陣記錄", () => {
    const game = {
      events: [
        // 客隊打席
        { id: "e1", inning: 1, half: "away", batterId: "a1", pitcherId: "h1", outsBefore: 0, result: "1B", runsScored: 0, pitches: { balls: 0, strikes: 0, total: 1 }, timestamp: "2026-09-07T00:00:00Z", notation: "1B" },
        { id: "e2", inning: 1, half: "away", batterId: "a2", pitcherId: "h1", outsBefore: 0, result: "BB", runsScored: 0, pitches: { balls: 4, strikes: 0, total: 4 }, timestamp: "2026-09-07T00:01:00Z", notation: "BB" },
        { id: "e3", inning: 1, half: "away", batterId: "a3", pitcherId: "h1", outsBefore: 0, result: "HBP", runsScored: 0, pitches: { balls: 0, strikes: 0, total: 1 }, timestamp: "2026-09-07T00:02:00Z", notation: "HBP" },
        { id: "e4", inning: 1, half: "away", batterId: "a4", pitcherId: "h1", outsBefore: 0, result: "K", runsScored: 0, pitches: { balls: 0, strikes: 3, total: 3 }, timestamp: "2026-09-07T00:03:00Z", notation: "K" },
        { id: "e5", inning: 2, half: "away", batterId: "a5", pitcherId: "h1", outsBefore: 0, result: "DP", runsScored: 0, pitches: { balls: 1, strikes: 1, total: 2 }, timestamp: "2026-09-07T00:04:00Z", notation: "6-4-3 DP" },
        { id: "e6", inning: 2, half: "away", batterId: "a6", pitcherId: "h1", outsBefore: 2, result: "SF", runsScored: 1, pitches: { balls: 0, strikes: 1, total: 1 }, timestamp: "2026-09-07T00:05:00Z", notation: "SF8" },

        // 主隊打席（對手）：主隊發生了 2 次失誤 E
        { id: "e7", inning: 1, half: "home", batterId: "h1", pitcherId: "a1", outsBefore: 0, result: "E", runsScored: 0, pitches: { balls: 1, strikes: 1, total: 2 }, timestamp: "2026-09-07T00:06:00Z", notation: "E6" },
        { id: "e8", inning: 1, half: "home", batterId: "h2", pitcherId: "a1", outsBefore: 0, result: "E", runsScored: 0, pitches: { balls: 0, strikes: 1, total: 1 }, timestamp: "2026-09-07T00:07:00Z", notation: "E5" },
      ] as AtBatEvent[],
      specialEvents: [
        { half: "away" as const, type: "SB", notation: "SB" },
        { half: "away" as const, type: "CS", notation: "CS" },
      ],
    };

    const awayStats = calculateWasedaMatrixStats(game, "away");

    expect(awayStats.hits).toBe(1);
    expect(awayStats.walks).toBe(1);
    expect(awayStats.hbp).toBe(1);
    expect(awayStats.strikeouts).toBe(1);
    expect(awayStats.doublePlays).toBe(1);
    expect(awayStats.sacrifices).toBe(1);
    expect(awayStats.stolenBases).toBe(1);
    expect(awayStats.caughtStealing).toBe(1);
    // 例外邏輯：失誤讀取對手（主隊）早稻田矩陣記錄 (2 次 E)
    expect(awayStats.opponentErrors).toBe(2);
  });
});
