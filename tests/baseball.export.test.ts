import { describe, expect, it } from "vitest";

import { describeFilter, filterGameForReport } from "../lib/baseball/export-core";
import { createInitialData, makeGame } from "../lib/baseball/types";

describe("單場紀錄匯出範圍", () => {
  it("會依局數篩選逐球、特殊事件、換人與逐局比分", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const game = makeGame({ name: "範圍測試", venue: "測試場", date: "2026-08-13", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 9 });
    game.events = [
      { id: "e1", inning: 1, half: "away", batterId: away.players[0].id, pitcherId: home.players[0].id, result: "1B", notation: "7 1B", pitches: { balls: 0, strikes: 1, total: 1 }, outsBefore: 0, runsScored: 1, timestamp: "2026-08-13T10:00:00.000Z" },
      { id: "e2", inning: 3, half: "home", batterId: home.players[0].id, pitcherId: away.players[0].id, result: "K", notation: "K", pitches: { balls: 1, strikes: 3, total: 4 }, outsBefore: 1, runsScored: 0, timestamp: "2026-08-13T10:10:00.000Z" },
    ];
    game.specialEvents = [{ id: "s1", inning: 3, half: "home", type: "WP", pitcherId: away.players[0].id, runsScored: 1, outsBefore: 1, notation: "WP", timestamp: "2026-08-13T10:11:00.000Z" }];
    game.substitutions = [{ id: "sub1", inning: 3, half: "home", teamId: home.id, playerOutId: home.players[0].id, playerInId: home.players[1].id, position: "游擊", timestamp: "2026-08-13T10:12:00.000Z" }];

    const filtered = filterGameForReport(game, { fromInning: 1, toInning: 1 });
    expect(filtered.events.map((event) => event.id)).toEqual(["e1"]);
    expect(filtered.specialEvents).toHaveLength(0);
    expect(filtered.substitutions).toHaveLength(0);
    expect(filtered.score.find((row) => row.inning === 1)?.away).toBe(game.score.find((row) => row.inning === 1)?.away);
    expect(filtered.score.find((row) => row.inning === 3)).toBeUndefined();
  });

  it("會依時間範圍篩選事件並在 HTML 報告標示範圍", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const game = makeGame({ name: "時間測試", venue: "測試場", date: "2026-08-13", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 9 });
    game.events = [
      { id: "before", inning: 1, half: "away", batterId: away.players[0].id, pitcherId: home.players[0].id, result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 }, outsBefore: 0, runsScored: 0, timestamp: "2026-08-13T09:59:00.000Z" },
      { id: "inside", inning: 1, half: "away", batterId: away.players[1].id, pitcherId: home.players[0].id, result: "2B", notation: "上弧線 7 2B", pitches: { balls: 0, strikes: 1, total: 1 }, outsBefore: 0, runsScored: 0, timestamp: "2026-08-13T10:05:00.000Z" },
    ];
    const filter = { fromInning: 1, toInning: 1, fromTime: "2026-08-13T10:00:00.000Z", toTime: "2026-08-13T10:10:00.000Z" };
    const filtered = filterGameForReport(game, filter);
    expect(filtered.events.map((event) => event.id)).toEqual(["inside"]);
    expect(describeFilter(filter)).toContain("第 1–1 局");
    expect(describeFilter(filter)).toContain("時間");
  });
});
