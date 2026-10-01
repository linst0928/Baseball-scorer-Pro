import { describe, expect, it } from "vitest";

import { createWasedaScorebookProjection, formatScorebookPositionCode, getScorebookSubstitutionMarker } from "../lib/baseball/waseda-scorebook-projection";
import type { AtBatEvent, GameLineup, Substitution, Team } from "../lib/baseball/types";

const makeTeam = (): Team => ({
  id: "team-fuxing",
  name: "復興少棒67",
  school: "復興國小",
  players: [
    { id: "p1", name: "林立維", number: 2, position: "一壘手", battingOrder: 1, bats: "R", throwingHand: "R", battingHand: "R" },
    { id: "p2", name: "王凱毅", number: 13, position: "投手", battingOrder: 2, bats: "R", throwingHand: "R", battingHand: "R" },
    { id: "p3", name: "張簡立宏", number: 3, position: "二壘手", battingOrder: 3, bats: "R", throwingHand: "R", battingHand: "R" },
    { id: "p4", name: "陳柏霖", number: 4, position: "三壘手", battingOrder: 4, bats: "R", throwingHand: "R", battingHand: "R" },
    { id: "p5", name: "李承恩", number: 5, position: "游擊手", battingOrder: 5, bats: "R", throwingHand: "R", battingHand: "R" },
    { id: "p6", name: "郭宥廷", number: 6, position: "左外野", battingOrder: 6, bats: "R", throwingHand: "R", battingHand: "R" },
    { id: "p7", name: "黃冠宇", number: 7, position: "中外野", battingOrder: 7, bats: "R", throwingHand: "R", battingHand: "R" },
    { id: "p8", name: "吳秉修", number: 8, position: "右外野", battingOrder: 8, bats: "R", throwingHand: "R", battingHand: "R" },
    { id: "p9", name: "楊曜全", number: 9, position: "捕手", battingOrder: 9, bats: "R", throwingHand: "R", battingHand: "R" },
    { id: "p10", name: "後備選手A", number: 10, position: "一壘手", bats: "R", throwingHand: "R", battingHand: "R" },
    { id: "p11", name: "後備選手B", number: 11, position: "投手", bats: "R", throwingHand: "R", battingHand: "R" },
  ],
});

const makeLineup = (team: Team): GameLineup => ({
  battingOrderIds: team.players.slice(0, 9).map((p) => p.id),
  defensivePositions: {
    p1: "1B",
    p2: "P",
    p3: "2B",
    p4: "3B",
    p5: "SS",
    p6: "LF",
    p7: "CF",
    p8: "RF",
    p9: "C",
  },
});

const makeAtBat = (id: string, batterId: string, inning: number, timestamp: string): AtBatEvent => ({
  id,
  inning,
  half: "away",
  batterId,
  pitcherId: "opp-pitcher",
  result: "1B",
  notation: "1B",
  pitches: { balls: 0, strikes: 0, total: 1 },
  outsBefore: 0,
  runsScored: 0,
  timestamp,
});

describe("【換守】規格重構與早稻田符號繪製驗證", () => {
  it("守備代號標準縮寫轉換正確 (P, C, 1B, 2B, 3B, SS, LF, CF, RF, DH)", () => {
    expect(formatScorebookPositionCode("投手")).toBe("P");
    expect(formatScorebookPositionCode("1")).toBe("P");
    expect(formatScorebookPositionCode("P")).toBe("P");
    expect(formatScorebookPositionCode("捕手")).toBe("C");
    expect(formatScorebookPositionCode("2")).toBe("C");
    expect(formatScorebookPositionCode("一壘手")).toBe("1B");
    expect(formatScorebookPositionCode("一壘")).toBe("1B");
    expect(formatScorebookPositionCode("3")).toBe("1B");
    expect(formatScorebookPositionCode("二壘手")).toBe("2B");
    expect(formatScorebookPositionCode("4")).toBe("2B");
    expect(formatScorebookPositionCode("三壘手")).toBe("3B");
    expect(formatScorebookPositionCode("5")).toBe("3B");
    expect(formatScorebookPositionCode("游擊手")).toBe("SS");
    expect(formatScorebookPositionCode("游擊")).toBe("SS");
    expect(formatScorebookPositionCode("6")).toBe("SS");
    expect(formatScorebookPositionCode("左外野")).toBe("LF");
    expect(formatScorebookPositionCode("7")).toBe("LF");
    expect(formatScorebookPositionCode("中外野")).toBe("CF");
    expect(formatScorebookPositionCode("8")).toBe("CF");
    expect(formatScorebookPositionCode("右外野")).toBe("RF");
    expect(formatScorebookPositionCode("9")).toBe("RF");
  });

  it("換守標記映射為 PD，且代守類型為 PD", () => {
    expect(getScorebookSubstitutionMarker("換守")).toEqual({ code: "PD", label: "代守" });
    expect(getScorebookSubstitutionMarker("代守")).toEqual({ code: "PD", label: "代守" });
    expect(getScorebookSubstitutionMarker("PD")).toEqual({ code: "PD", label: "代守" });
  });

  it("規格 1：【上下調動】(原球員換下場，場下球員上場替代) - 打席格最左側標註 PD 與新球員姓名，打序欄加註替換", () => {
    const team = makeTeam();
    const lineup = makeLineup(team);
    // 五局時更換守備打序 3 (p3 張簡立宏) -> 替補 p10 (後備選手A)，守備一壘
    const substitutions: Substitution[] = [
      {
        id: "sub-def-1",
        inning: 5,
        half: "away",
        teamId: team.id,
        playerOutId: "p3",
        playerInId: "p10",
        position: "1B",
        type: "換守",
        defensiveChangeType: "上下調動",
        timestamp: "2026-09-29T10:00:00.000Z",
      },
    ];

    const events: AtBatEvent[] = [
      makeAtBat("ab-1", "p3", 1, "2026-09-29T08:00:00.000Z"),
      makeAtBat("ab-2", "p3", 3, "2026-09-29T09:00:00.000Z"),
      makeAtBat("ab-3", "p10", 5, "2026-09-29T10:05:00.000Z"),
    ];

    const projection = createWasedaScorebookProjection({
      team,
      side: "away",
      lineup,
      events,
      substitutions,
      inningCount: 5,
    });

    const thirdOrder = projection.battingOrders[2];
    expect(thirdOrder.entries.length).toBeGreaterThanOrEqual(2);
    expect(thirdOrder.entries[0].playerId).toBe("p3");
    expect(thirdOrder.entries[1].playerId).toBe("p10");
    expect(thirdOrder.entries[1].kind).toBe("substitute");
    expect(thirdOrder.entries[1].enteredInning).toBe(5);

    // 第 5 局打席格渲染徽記：必須帶有 code: "PD", playerName: "後備選手A"
    const fifthInningAppearance = projection.innings[4].appearances.find((app) => app.battingOrder === 3);
    expect(fifthInningAppearance?.replacementBadge).toBeDefined();
    expect(fifthInningAppearance?.replacementBadge).toMatchObject({
      code: "PD",
      label: "代守",
      inning: 5,
      playerName: "後備選手A",
    });
  });

  it("規格 2：【場上調動】(球員未換下場，僅局間或局中互換防守位置) - 不畫波浪線，打序名單維持原樣，守備欄加註 1B-D2P 與 P-D21B", () => {
    const team = makeTeam();
    const lineup = makeLineup(team);
    // 二局時 (D2)，原一壘手 p1 (1B) 與 原投手 p2 (P) 互換守備位置
    const substitutions: Substitution[] = [
      {
        id: "swap-1",
        inning: 2,
        half: "away",
        teamId: team.id,
        playerOutId: "p1",
        playerInId: "p1",
        position: "P",
        type: "換守",
        defensiveChangeType: "場上調動",
        timestamp: "2026-09-29T08:30:00.000Z",
      },
      {
        id: "swap-2",
        inning: 2,
        half: "away",
        teamId: team.id,
        playerOutId: "p2",
        playerInId: "p2",
        position: "1B",
        type: "換守",
        defensiveChangeType: "場上調動",
        timestamp: "2026-09-29T08:30:01.000Z",
      },
    ];

    const events: AtBatEvent[] = [
      makeAtBat("ab-1-1", "p1", 1, "2026-09-29T08:00:00.000Z"),
      makeAtBat("ab-1-2", "p2", 1, "2026-09-29T08:10:00.000Z"),
      makeAtBat("ab-2-1", "p1", 2, "2026-09-29T08:35:00.000Z"),
      makeAtBat("ab-2-2", "p2", 2, "2026-09-29T08:45:00.000Z"),
    ];

    const projection = createWasedaScorebookProjection({
      team,
      side: "away",
      lineup,
      events,
      substitutions,
      inningCount: 3,
    });

    const firstOrder = projection.battingOrders[0];
    const secondOrder = projection.battingOrders[1];

    // 打序與球員名單維持不變 (僅先發球員，沒有新增 substitute entry)
    expect(firstOrder.entries.filter((e) => e.playerId).length).toBe(1);
    expect(secondOrder.entries.filter((e) => e.playerId).length).toBe(1);
    expect(firstOrder.entries[0].playerId).toBe("p1");
    expect(secondOrder.entries[0].playerId).toBe("p2");

    // 守備欄位格式化加註：
    // 原 1B 更換至 P -> 1B-D2P
    // 原 P 更換至 1B -> P-D21B
    expect(firstOrder.entries[0].formattedDefensivePosition).toBe("1B-D2P");
    expect(secondOrder.entries[0].formattedDefensivePosition).toBe("P-D21B");

    // 打席格中不應有代守波浪線 replacementBadge
    const inning2Apps = projection.innings[1].appearances;
    expect(inning2Apps.find((app) => app.battingOrder === 1)?.replacementBadge).toBeUndefined();
    expect(inning2Apps.find((app) => app.battingOrder === 2)?.replacementBadge).toBeUndefined();
  });

  it("多人連續場上調動與多次調動守備字串累加測試", () => {
    const team = makeTeam();
    const lineup = makeLineup(team);
    // 二局時 p1 (1B) -> P, 四局時 p1 (P) -> SS
    const substitutions: Substitution[] = [
      {
        id: "swap-1",
        inning: 2,
        half: "away",
        teamId: team.id,
        playerOutId: "p1",
        playerInId: "p1",
        position: "P",
        type: "換守",
        defensiveChangeType: "場上調動",
        timestamp: "2026-09-29T08:30:00.000Z",
      },
      {
        id: "swap-2",
        inning: 4,
        half: "away",
        teamId: team.id,
        playerOutId: "p1",
        playerInId: "p1",
        position: "SS",
        type: "換守",
        defensiveChangeType: "場上調動",
        timestamp: "2026-09-29T09:30:00.000Z",
      },
    ];

    const projection = createWasedaScorebookProjection({
      team,
      side: "away",
      lineup,
      events: [],
      substitutions,
      inningCount: 5,
    });

    expect(projection.battingOrders[0].entries[0].formattedDefensivePosition).toBe("1B-D2P-D4SS");
  });
});
