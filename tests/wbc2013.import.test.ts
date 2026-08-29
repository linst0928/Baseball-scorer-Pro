import { describe, expect, it } from "vitest";

import {
  createFuxing2026Data,
  FUXING_2026_GAMES,
  FUXING_COMPETITION,
  FUXING_CUP_BATTING_SUMMARY,
  FUXING_CUP_TEAM_BATTING_SUMMARY,
  FUXING_2026_PDF_SOURCE_REVISION,
  FUXING_TEAM,
  FUXING_2026_VERIFIED_SCORE_GAME_IDS,
  isFuxing2026VerifiedScoreGame,
} from "../lib/baseball/fuxing2026Data";
import { buildGameScoreCsv } from "../lib/baseball/export-core";
import { mergeFuxingImport } from "../lib/baseball/fuxing2026-merge";

describe("復興少棒67逐場紀錄匯入", () => {
  it("使用附件球員名單建立復興少棒67隊伍", () => {
    const data = createFuxing2026Data();

    expect(data.primaryTeamId).toBe(FUXING_TEAM.id);
    expect(FUXING_TEAM.name).toBe("復興少棒67");
    expect(FUXING_TEAM.players).toHaveLength(14);
    expect(FUXING_TEAM.players.map((player) => player.number)).toEqual([1, 2, 3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16]);
    expect(data.teams.some((team) => team.name === "山城國小" || team.name === "海豐國小")).toBe(false);
  });

  it("保留六場附件可驗證的盃賽日期、比分與來源說明", () => {
    const expectedScores: Array<[number, number]> = [[2, 3], [2, 0], [8, 0], [2, 0], [4, 3], [8, 4]];

    expect(FUXING_2026_GAMES).toHaveLength(6);
    expect(FUXING_2026_GAMES.every((game) => game.competition === FUXING_COMPETITION)).toBe(true);
    expect(FUXING_2026_GAMES.every((game) => game.sourceRevision === FUXING_2026_PDF_SOURCE_REVISION)).toBe(true);
    expect(FUXING_2026_GAMES.every((game) => game.notes.includes("僅回填可與內建場次 ID 對應的賽事基本資料"))).toBe(true);
    expect(FUXING_2026_GAMES.map((game) => game.date)).toEqual(["2026-07-21 08:30", "2026-07-21 14:30", "2026-07-22 10:00", "2026-07-23 08:30", "2026-07-23 10:30", "2026-07-22 13:00"]);
    expect(FUXING_2026_GAMES.map((game) => {
      const fuxingIsAway = game.awayTeamId === FUXING_TEAM.id;
      const fuxingRuns = game.score.reduce((total, row) => total + (fuxingIsAway ? row.away : row.home), 0);
      const opponentRuns = game.score.reduce((total, row) => total + (fuxingIsAway ? row.home : row.away), 0);
      return [fuxingRuns, opponentRuns];
    })).toEqual(expectedScores);
  });

  it("保留附件個人成績表的盃賽累計口徑，不反推為逐球資料", () => {
    expect(FUXING_CUP_TEAM_BATTING_SUMMARY).toMatchObject({ games: 6, pa: 155, h: 43, ops: 0.926 });
    expect(FUXING_CUP_BATTING_SUMMARY).toHaveLength(14);
    expect(FUXING_CUP_BATTING_SUMMARY.find((row) => row.playerId === "fuxing67-p12")).toMatchObject({ h: 6, ops: 1.392 });
    expect(FUXING_2026_GAMES.flatMap((game) => game.events)).toHaveLength(0);
  });

  it("只提升未編輯的舊內建場次，並保留使用者手動改寫的賽事資訊", () => {
    const baseline = createFuxing2026Data();
    const pristineLegacyGame = { ...baseline.games[0], sourceRevision: undefined, notes: "舊版內建來源" };
    const userEditedGame = { ...baseline.games[1], name: "使用者手動更名", updatedAt: "2026-08-24T08:00:00.000Z", sourceRevision: undefined };
    const merged = mergeFuxingImport({ ...baseline, games: [pristineLegacyGame, userEditedGame, ...baseline.games.slice(2)] });

    expect(merged.games.find((game) => game.id === pristineLegacyGame.id)?.sourceRevision).toBe(FUXING_2026_PDF_SOURCE_REVISION);
    expect(merged.games.find((game) => game.id === userEditedGame.id)?.name).toBe("使用者手動更名");
    expect(merged.games.find((game) => game.id === userEditedGame.id)?.sourceRevision).toBeUndefined();
  });

  it("不復活已刪除的內建場次，並保留使用者自行建立的場次", () => {
    const baseline = createFuxing2026Data();
    const deletedId = baseline.games[0].id;
    const personalGame = { ...baseline.games[1], id: "personal-offline-game", name: "我的離線練習賽", sourceRevision: undefined };
    const merged = mergeFuxingImport({ ...baseline, games: [...baseline.games.slice(1), personalGame], deletedGameIds: [deletedId] });

    expect(merged.games.some((game) => game.id === deletedId)).toBe(false);
    expect(merged.games.find((game) => game.id === personalGame.id)?.name).toBe("我的離線練習賽");
  });

  it("只讓逐局與最終比分均已核對的內建場次輸出 CSV", () => {
    const data = createFuxing2026Data();
    const verifiedGames = data.games.filter(isFuxing2026VerifiedScoreGame);
    const unverifiedGame = data.games.find((game) => !FUXING_2026_VERIFIED_SCORE_GAME_IDS.includes(game.id as never));

    expect(FUXING_2026_VERIFIED_SCORE_GAME_IDS).toHaveLength(5);
    expect(verifiedGames.map((game) => game.id)).toEqual([...FUXING_2026_VERIFIED_SCORE_GAME_IDS]);
    expect(unverifiedGame).toBeDefined();
    expect(isFuxing2026VerifiedScoreGame(unverifiedGame!)).toBe(false);
    expect(isFuxing2026VerifiedScoreGame({ ...verifiedGames[0], updatedAt: "2026-08-24T09:00:00.000Z" })).toBe(false);
  });

  it("CSV 僅包含安全的基本資料、最終比分與逐局資料，並處理試算表字串跳脫", () => {
    const data = createFuxing2026Data();
    const game = data.games.find((candidate) => candidate.id === FUXING_2026_VERIFIED_SCORE_GAME_IDS[0])!;
    const away = data.teams.find((team) => team.id === game.awayTeamId)!;
    const home = data.teams.find((team) => team.id === game.homeTeamId)!;
    const csv = buildGameScoreCsv({ ...game, competition: '核對盃賽,"組別A"' }, away, home);

    expect(csv).toContain('"欄位","內容"');
    expect(csv).toContain('"賽事","核對盃賽,""組別A"""');
    expect(csv).toContain('"客隊總分","2"');
    expect(csv).toContain('"主隊總分","3"');
    expect(csv).toContain('"局","客隊","主隊"');
    expect(csv).not.toContain("逐球");
    expect(csv).not.toContain("打擊率");
  });
});
