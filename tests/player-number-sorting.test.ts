import { describe, expect, it } from "vitest";

import { createInitialData, normalizeAppData, sortPlayersByNumber, sortPlayersForDisplay, type Player } from "../lib/baseball/types";

const player = (id: string, number: number, name: string): Player => ({
  id,
  number,
  name,
  position: "6",
  bats: "R",
});

describe("球員背號排序", () => {
  it("以數值背號遞增排序且不改寫傳入陣列", () => {
    const players = [player("p18", 18, "十八"), player("p2", 2, "二"), player("p10", 10, "十")];

    expect(sortPlayersByNumber(players).map((entry) => entry.number)).toEqual([2, 10, 18]);
    expect(players.map((entry) => entry.number)).toEqual([18, 2, 10]);
  });

  it("會將無法辨識的背號置後，並以姓名與識別碼提供穩定順序", () => {
    const players = [
      player("z", Number.NaN, "張三"),
      player("b", 9, "九"),
      player("a", Number.NaN, "王小明"),
    ];

    expect(sortPlayersByNumber(players).map((entry) => entry.id)).toEqual(["b", "a", "z"]);
  });

  it("背號、姓名與守備位置三種畫面排序均為衍生結果，不改寫固定名單或正式棒次快照", () => {
    const players = [
      { ...player("p7", 7, "王小明"), position: "7", preferredPositions: ["7"] },
      { ...player("p2", 2, "陳大文"), position: "2", preferredPositions: ["2"] },
      { ...player("p18", 18, "林一"), position: "1", preferredPositions: ["1"] },
    ];
    const originalIds = players.map((entry) => entry.id);
    const battingOrderIds = ["p7", "p2", "p18"];

    expect(sortPlayersForDisplay(players, "number").map((entry) => entry.id)).toEqual(["p2", "p7", "p18"]);
    expect(sortPlayersForDisplay(players, "name").map((entry) => entry.id)).toEqual(["p7", "p18", "p2"]);
    expect(sortPlayersForDisplay(players, "position").map((entry) => entry.id)).toEqual(["p18", "p2", "p7"]);
    expect(players.map((entry) => entry.id)).toEqual(originalIds);
    expect(battingOrderIds).toEqual(["p7", "p2", "p18"]);
  });

  it("資料正規化會同步整理球隊與學校固定名單，不改變賽事快照的棒次語意", () => {
    const seed = createInitialData();
    const unorderedPlayers = [player("p18", 18, "十八"), player("p2", 2, "二"), player("p10", 10, "十")];
    const normalized = normalizeAppData({
      ...seed,
      teams: [{ ...seed.teams[0], players: unorderedPlayers }],
      schools: [{ ...seed.schools[0], players: unorderedPlayers }],
    });

    expect(normalized.teams[0]?.players.map((entry) => entry.number)).toEqual([2, 10, 18]);
    expect(normalized.schools[0]?.players.map((entry) => entry.number)).toEqual([2, 10, 18]);
    expect(normalized.games.map((game) => ({
      id: game.id,
      homeRegisteredPlayerIds: game.homeRegisteredPlayerIds,
      awayRegisteredPlayerIds: game.awayRegisteredPlayerIds,
      homeBatterIndex: game.homeBatterIndex,
      awayBatterIndex: game.awayBatterIndex,
    }))).toEqual(seed.games.map((game) => ({
      id: game.id,
      homeRegisteredPlayerIds: game.homeRegisteredPlayerIds,
      awayRegisteredPlayerIds: game.awayRegisteredPlayerIds,
      homeBatterIndex: game.homeBatterIndex,
      awayBatterIndex: game.awayBatterIndex,
    })));
  });
});
