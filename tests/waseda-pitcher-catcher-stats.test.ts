import { describe, expect, it } from "vitest";
import { getDetailedPitcherStats, getDetailedCatcherStats } from "../lib/baseball/waseda-scorebook-projection";
import type { AtBatEvent, Team, GameLineup } from "../lib/baseball/types";

const mockTeam = (id: string, name: string): Team => ({
  id,
  name,
  code: name.slice(0, 2),
  players: [
    { id: `${id}-p1`, name: "投手A", number: 11, position: "1", throwingHand: "R", battingHand: "R" },
    { id: `${id}-p2`, name: "投手B", number: 18, position: "1", throwingHand: "L", battingHand: "L" },
    { id: `${id}-c1`, name: "捕手A", number: 22, position: "2", throwingHand: "R", battingHand: "R" },
  ],
});

const mockLineup = (team: Team): GameLineup => ({
  battingOrderIds: team.players.map((p) => p.id),
  defensivePositions: {
    [`${team.id}-p1`]: "1",
    [`${team.id}-c1`]: "2",
  },
});

describe("【任務 6-4：底部面板投捕數據自動統計】單元測試", () => {
  it("自動計算投手統計資料：包含背號、姓名、慣用手、總球數、好球、被安打、HR、BB、HBP、K、WP、R、ER", () => {
    const away = mockTeam("away", "客隊");
    const home = mockTeam("home", "主隊");

    // 客隊防守半局（home 打擊事件，pitcherId 為客隊投手 away-p1）
    const game = {
      awayLineup: mockLineup(away),
      homeLineup: mockLineup(home),
      events: [
        { id: "e1", inning: 1, half: "home", batterId: "h1", pitcherId: "away-p1", outsBefore: 0, result: "HR", runsScored: 1, pitches: { balls: 1, strikes: 2, total: 3 }, timestamp: "2026-09-07T00:00:00Z", notation: "HR" },
        { id: "e2", inning: 1, half: "home", batterId: "h2", pitcherId: "away-p1", outsBefore: 0, result: "BB", runsScored: 0, pitches: { balls: 4, strikes: 1, total: 5 }, timestamp: "2026-09-07T00:01:00Z", notation: "BB" },
        { id: "e3", inning: 1, half: "home", batterId: "h3", pitcherId: "away-p1", outsBefore: 0, result: "K", runsScored: 0, pitches: { balls: 0, strikes: 3, total: 3 }, timestamp: "2026-09-07T00:02:00Z", notation: "K" },
      ] as AtBatEvent[],
      specialEvents: [
        { half: "home" as const, type: "WP", notation: "WP" },
      ],
    };

    const pitcherStats = getDetailedPitcherStats(game as any, away, "away");

    expect(pitcherStats.length).toBeGreaterThanOrEqual(1);
    const starter = pitcherStats[0];
    expect(starter.playerId).toBe("away-p1");
    expect(starter.number).toBe(11);
    expect(starter.name).toBe("投手A");
    expect(starter.throwingHand).toBe("R");
    expect(starter.totalPitches).toBe(11); // 3 + 5 + 3 = 11
    expect(starter.strikes).toBe(6);       // 2 + 1 + 3 = 6
    expect(starter.hits).toBe(1);          // 1 個 HR
    expect(starter.hr).toBe(1);            // 1 個 HR
    expect(starter.walks).toBe(1);         // 1 個 BB
    expect(starter.strikeouts).toBe(1);    // 1 個 K
    expect(starter.wp).toBe(1);            // 1 個 WP
    expect(starter.runs).toBe(1);          // 失分 1
  });

  it("自動計算捕手統計資料：包含背號、名稱、慣用手、PB、被盜壘SB、阻殺CS", () => {
    const away = mockTeam("away", "客隊");
    const home = mockTeam("home", "主隊");

    const game = {
      awayLineup: mockLineup(away),
      homeLineup: mockLineup(home),
      events: [] as AtBatEvent[],
      specialEvents: [
        { half: "home" as const, type: "PB", notation: "PB" },
        { half: "home" as const, type: "SB", notation: "SB" },
        { half: "home" as const, type: "CS", notation: "CS" },
      ],
    };

    const catcherStats = getDetailedCatcherStats(game as any, away, "away");

    expect(catcherStats.length).toBeGreaterThanOrEqual(1);
    const starterCatcher = catcherStats[0];
    expect(starterCatcher.playerId).toBe("away-c1");
    expect(starterCatcher.number).toBe(22);
    expect(starterCatcher.name).toBe("捕手A");
    expect(starterCatcher.pb).toBe(1);
    expect(starterCatcher.stolenBases).toBe(1);
    expect(starterCatcher.caughtStealing).toBe(1);
  });
});
