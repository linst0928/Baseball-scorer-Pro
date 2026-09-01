import { describe, expect, it } from "vitest";

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  createEmptyAtBatDraft,
  createInitialData,
  ensureScoreThroughInning,
  FIELD_POSITIONS,
  formatAvg,
  getBattingStats,
  getTeamSacrificeTotals,
  getCurrentBatter,
  getCurrentPitcher,
  getNotation,
  getPitchingStats,
  getPitchLimitWarning,
  getPitcherPitchLimitHistories,
  getPitchZoneHeatmap,
  getWasedaPitchMark,
  getSeasonBattingStats,
  getSacrificeFlyAdvancement,
  canSacrificeFly,
  filterRecentGames,
  isSacrificeFlyRecord,
  SACRIFICE_BUNT_MODIFIER,
  SACRIFICE_FLY_MODIFIER,
  getSpecialEventNotation,
  appendStatNeutralSpecialEvent,
  finishGameWithEarlyEndAnnotation,
  getGamesForTeam,
  getDefensivePositionConflicts,
  getBattingOrderEligiblePlayerIds,
  getLineupCompleteness,
  isEligibleForBattingOrder,
  opensBattedBallWorkflow,
  suggestDefensiveConflictFixes,
  filterGamesForStatistics,
  getTeamPerformanceSummary,
  makeGame,
  mergeAppData,
  buildSpecialEventRunnerSummary,
  nextFieldersChoiceRunnerState,
  nextRunnerState,
  nextSpecialRunnerState,
  type RunnerAdvanceRecord,
  sortGameRosterForDisplay,
  aggregateInningRunnerEvents,
  updateGameAfterEvent,
  updateGameAfterSpecialEvent,
  swapDefensivePositions,
  swapTeamDefensiveConfigurations,
  getChangedDefensivePositions,
  getLatestCompletedAtBat,
  getForcedBaseOnBallsAdvances,
  getRunnerSourceAtBat,
  normalizePreferredPositions,
  RESERVE_POSITION,
} from "../lib/baseball/types";
import { groupPitchHistoryByZone } from "../lib/baseball/pitch-history";
import { formatRecordColumnNotation, getFieldingSequenceNotation } from "../lib/baseball/record-column-notation";
import { splitPitchMarksForVerticalGrid } from "../lib/baseball/waseda-visuals";
import { getPlayerDeletionUsage } from "../lib/baseball/player-deletion-guard";
import { createLocalBackupPayload, formatLocalSavedAt, formatLocalStorageBytes, getLocalBackupFileName, getUtf8ByteLength, parseLocalBackup } from "../lib/baseball/local-backup";

describe("棒球紀錄法核心邏輯", () => {
  it("本機備份會保留版本、建立時間與完整 AppData，且僅接受有效格式", () => {
    const data = createInitialData();
    const payload = createLocalBackupPayload(data, "2026-08-23T08:15:00.000Z");
    const restored = parseLocalBackup(JSON.stringify(payload));

    expect(restored?.version).toBe("bsp-local-backup-1");
    expect(restored?.exportedAt).toBe("2026-08-23T08:15:00.000Z");
    expect(restored?.appData.teams.length).toBe(data.teams.length);
    expect(restored?.appData.games.length).toBe(data.games.length);
    expect(parseLocalBackup(JSON.stringify({ version: "bsp-local-backup-1", exportedAt: "not-a-date", appData: data }))).toBeUndefined();
    expect(parseLocalBackup(JSON.stringify({ version: "other-backup", exportedAt: payload.exportedAt, appData: data }))).toBeUndefined();
  });

  it("本機保存容量與時間提示使用可讀格式，備份檔名保留可排序的建立時間", () => {
    expect(getUtf8ByteLength("棒球")).toBe(6);
    expect(formatLocalStorageBytes(0)).toBe("0 B");
    expect(formatLocalStorageBytes(1024)).toBe("1 KB");
    expect(formatLocalStorageBytes(1536)).toBe("1.5 KB");
    expect(formatLocalSavedAt(null)).toBe("尚未完成首次保存");
    expect(getLocalBackupFileName("2026-08-23T08:15:00.000Z")).toBe("baseball-scorer-pro-backup-2026-08-23T08-15-00-000Z.json");
  });

  it("首頁與離線設定中心提供完整本機備份、覆寫還原與保存狀態提示", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(source).toContain("const LOCAL_SAVE_META_STORAGE_KEY");
    expect(source).toContain("createLocalBackupPayload(data, exportedAt)");
    expect(source).toContain("parseLocalBackup(content)");
    expect(source).toContain("確認覆寫本機資料");
    expect(source).toContain('label="匯出本機備份 ↑"');
    expect(source).toContain('label="匯入還原 ↓"');
    expect(source).toContain("最近保存：{formatLocalSavedAt(lastLocalSavedAt)}");
    expect(source).toContain("資料容量");
  });

  it("慣用守位會去除重複與舊中文名稱，並保留四個不同守位", () => {
    expect(normalizePreferredPositions(["1", "3", "4", "二壘", "2", "9"]))
      .toEqual(["1", "3", "4", "2"]);
    expect(normalizePreferredPositions(["投手", "捕手", "一壘", "二壘"]))
      .toEqual(["1", "2", "3", "4"]);
  });

  it("刪除球員前會辨識既有先發快照、登錄名單與逐球紀錄的使用範圍", () => {
    const data = createInitialData();
    const home = data.teams[0];
    const away = data.teams[1];
    const player = home.players[0];
    const game = makeGame({
      name: "球員刪除防呆測試",
      venue: "測試球場",
      date: "2026-08-22",
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeRegisteredPlayerIds: [player.id],
      awayRegisteredPlayerIds: [away.players[0].id],
      homeLineup: { battingOrderIds: [player.id], defensivePositions: { [player.id]: "1" } },
      maxInnings: 6,
    });
    game.events.push({
      id: "delete-guard-at-bat",
      inning: 1,
      half: "home",
      batterId: player.id,
      pitcherId: away.players[0].id,
      result: "1B",
      notation: "1B",
      pitches: { balls: 0, strikes: 0, total: 1 },
      outsBefore: 0,
      runsScored: 0,
      timestamp: "2026-08-22T00:00:00.000Z",
    });

    const usage = getPlayerDeletionUsage([game], home.id, player.id);
    expect(usage).toMatchObject({ lineupGameCount: 1, registeredGameCount: 1, recordedGameCount: 1, requiresWarning: true });
    expect(usage.games[0]).toMatchObject({ gameId: game.id, inLineup: true, inRegisteredRoster: true, inRecordedEvents: true });
    expect(getPlayerDeletionUsage([game], home.id, home.players[1].id)).toMatchObject({ games: [], requiresWarning: false });
  });

  it("換打者時會建立完全空白的逐球與早稻田紀錄草稿", () => {
    const previousDraft = {
      pitchDraft: { balls: 2, strikes: 1, total: 3, locations: [{ zone: 5, type: "fastball" as const, outcome: "strike" as const }] },
      selectedResult: "2B" as const,
      recordColumnDraft: { trajectory: "fly" as const, battedBallPosition: "7", rbi: 1, modifiers: ["RBI"] },
    };
    const nextDraft = createEmptyAtBatDraft();

    expect(nextDraft).toEqual({
      pitchDraft: { balls: 0, strikes: 0, total: 0, locations: [] },
      selectedResult: null,
      recordColumnDraft: { modifiers: [], rbi: 0 },
    });
    expect(nextDraft.pitchDraft).not.toBe(previousDraft.pitchDraft);
    expect(nextDraft.recordColumnDraft).not.toBe(previousDraft.recordColumnDraft);
  });

  it("會產生 1189LAB 對齊的打席與守備符號", () => {
    expect(getNotation("2B", "7")).toBe("2B");
    expect(getNotation("F", "8")).toBe("⌒8");
    expect(getNotation("G", "6")).toBe("＿6ー3");
    expect(getNotation("K", "2")).toBe("K");
    expect(getNotation("BB", "2")).toBe("B");
    expect(getNotation("HBP", "2")).toBe("DB");
  });

  it("保留野手自踩一壘 A 的早稻田表記，而不誤作傳球或補位", () => {
    expect(getFieldingSequenceNotation("G", { fieldingSequence: "3A" })).toBe("3A");
    expect(getFieldingSequenceNotation("G", { fieldingSequence: "1ー4A" })).toBe("1ー4A");
    expect(formatRecordColumnNotation("G", "3", { trajectory: "ground", battedBallPosition: "3", fieldingSequence: "3A" })).toBe("＿3 3A");
  });

  it("登錄名單會依背號選擇建立的棒次輪替，而不重排固定名單", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    away.players[0].battingOrder = 3;
    away.players[1].battingOrder = 1;
    away.players[2].battingOrder = 2;
    const game = makeGame({
      name: "棒次選擇測試",
      venue: "測試球場",
      date: "2026-08-15",
      awayTeamId: away.id,
      homeTeamId: home.id,
      awayRegisteredPlayerIds: away.players.slice(0, 3).map((player) => player.id),
      homeRegisteredPlayerIds: home.players.slice(0, 3).map((player) => player.id),
      maxInnings: 6,
    });

    expect(getCurrentBatter(game, away).id).toBe(away.players[1].id);
    game.awayBatterIndex = 1;
    expect(getCurrentBatter(game, away).id).toBe(away.players[2].id);
    game.awayBatterIndex = 2;
    expect(getCurrentBatter(game, away).id).toBe(away.players[0].id);
  });

  it("新增場次會保存年齡層，未指定的歷史相容建立仍預設為 U12", () => {
    const data = createInitialData();
    const baseInput = {
      name: "年齡層流程測試",
      venue: "測試球場",
      date: "2026-08-15",
      awayTeamId: data.teams[0].id,
      homeTeamId: data.teams[1].id,
      maxInnings: 6 as const,
    };

    expect(makeGame({ ...baseInput, ageGroup: "U10" }).ageGroup).toBe("U10");
    expect(makeGame(baseInput).ageGroup).toBe("U12");
  });

  it("重複的守備位置不會被視為完成的先發九人配置", () => {
    const data = createInitialData();
    const playerIds = data.teams[0].players.slice(0, 9).map((player) => player.id);
    const duplicatePositions = Object.fromEntries(playerIds.map((playerId) => [playerId, "1"]));
    const completePositions = Object.fromEntries(playerIds.map((playerId, index) => [playerId, String(index + 1)]));

    expect(getLineupCompleteness({ battingOrderIds: playerIds, defensivePositions: duplicatePositions }, playerIds)).toEqual({ battingOrderCount: 9, defensivePositionCount: 1, complete: false });
    expect(getLineupCompleteness({ battingOrderIds: playerIds, defensivePositions: completePositions }, playerIds)).toEqual({ battingOrderCount: 9, defensivePositionCount: 9, complete: true });
  });

  it("棒次只接受已配置正式守位的登錄球員，並排除後備與未配置者", () => {
    const data = createInitialData();
    const playerIds = data.teams[0].players.slice(0, 11).map((player) => player.id);
    const defensivePositions = Object.fromEntries(playerIds.slice(0, 9).map((playerId, index) => [playerId, String(index + 1)]));
    defensivePositions[playerIds[9]] = RESERVE_POSITION;
    const lineup = { battingOrderIds: [...playerIds], defensivePositions };

    expect(getBattingOrderEligiblePlayerIds(lineup, playerIds)).toEqual(playerIds.slice(0, 9));
    expect(isEligibleForBattingOrder(lineup, playerIds[8])).toBe(true);
    expect(isEligibleForBattingOrder(lineup, playerIds[9])).toBe(false);
    expect(isEligibleForBattingOrder(lineup, playerIds[10])).toBe(false);
    expect(getLineupCompleteness(lineup, playerIds)).toEqual({ battingOrderCount: 9, defensivePositionCount: 9, complete: true });
  });

  it("可偵測重複守位並在互換後保留棒次不變", () => {
    const data = createInitialData();
    const playerIds = data.teams[0].players.slice(0, 3).map((player) => player.id);
    const lineup = { battingOrderIds: playerIds, defensivePositions: { [playerIds[0]]: "6", [playerIds[1]]: "6", [playerIds[2]]: "8" } };
    expect(getDefensivePositionConflicts(lineup)).toEqual([{ position: "6", playerIds: [playerIds[0], playerIds[1]] }]);
    const swapped = swapDefensivePositions({ battingOrderIds: playerIds, defensivePositions: { [playerIds[0]]: "6", [playerIds[1]]: "8" } }, playerIds[0], playerIds[1]);
    expect(swapped.battingOrderIds).toEqual(playerIds);
    expect(swapped.defensivePositions).toEqual({ [playerIds[0]]: "8", [playerIds[1]]: "6" });
  });

  it("可依主客登錄名單順序一鍵互換守備配置，並移除失去正式守位的棒次", () => {
    const data = createInitialData();
    const homeIds = data.teams[0].players.slice(0, 3).map((player) => player.id);
    const awayIds = data.teams[1].players.slice(0, 3).map((player) => player.id);
    const swapped = swapTeamDefensiveConfigurations(
      { battingOrderIds: homeIds, defensivePositions: { [homeIds[0]]: "1", [homeIds[1]]: "2", [homeIds[2]]: "3" } },
      homeIds,
      { battingOrderIds: awayIds, defensivePositions: { [awayIds[0]]: "8", [awayIds[1]]: RESERVE_POSITION } },
      awayIds,
    );

    expect(swapped.homeLineup.defensivePositions).toEqual({ [homeIds[0]]: "8", [homeIds[1]]: RESERVE_POSITION });
    expect(swapped.homeLineup.battingOrderIds).toEqual([homeIds[0]]);
    expect(swapped.awayLineup.defensivePositions).toEqual({ [awayIds[0]]: "1", [awayIds[1]]: "2", [awayIds[2]]: "3" });
    expect(swapped.awayLineup.battingOrderIds).toEqual(awayIds);
  });

  it("可只互換成對勾選的守備位置，其他守位與棒次維持原樣", () => {
    const data = createInitialData();
    const homeIds = data.teams[0].players.slice(0, 2).map((player) => player.id);
    const awayIds = data.teams[1].players.slice(0, 2).map((player) => player.id);
    const swapped = swapTeamDefensiveConfigurations(
      { battingOrderIds: homeIds, defensivePositions: { [homeIds[0]]: "1", [homeIds[1]]: "2" } },
      homeIds,
      { battingOrderIds: awayIds, defensivePositions: { [awayIds[0]]: "6", [awayIds[1]]: "8" } },
      awayIds,
      ["1", "6"],
    );

    expect(swapped.homeLineup.defensivePositions).toEqual({ [homeIds[0]]: "6", [homeIds[1]]: "2" });
    expect(swapped.awayLineup.defensivePositions).toEqual({ [awayIds[0]]: "1", [awayIds[1]]: "8" });
    expect(swapped.homeLineup.battingOrderIds).toEqual(homeIds);
    expect(swapped.awayLineup.battingOrderIds).toEqual(awayIds);
  });

  it("互換或復原時只標示實際變動的正式守備位置", () => {
    const data = createInitialData();
    const homeIds = data.teams[0].players.slice(0, 2).map((player) => player.id);
    const awayIds = data.teams[1].players.slice(0, 2).map((player) => player.id);
    const previousHome = { battingOrderIds: homeIds, defensivePositions: { [homeIds[0]]: "1", [homeIds[1]]: "2" } };
    const previousAway = { battingOrderIds: awayIds, defensivePositions: { [awayIds[0]]: "6", [awayIds[1]]: "8" } };
    const swapped = swapTeamDefensiveConfigurations(previousHome, homeIds, previousAway, awayIds, ["1", "6"]);

    expect(getChangedDefensivePositions(previousHome, previousAway, swapped.homeLineup, swapped.awayLineup)).toEqual(["1", "6"]);
    expect(getChangedDefensivePositions(swapped.homeLineup, swapped.awayLineup, previousHome, previousAway)).toEqual(["1", "6"]);
    expect(getChangedDefensivePositions(previousHome, previousAway, previousHome, previousAway)).toEqual([]);
    expect(FIELD_POSITIONS.map((position) => position.number)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });

  it("會為每個重複守位提出空缺守位與可互換球員的修正建議", () => {
    const data = createInitialData();
    const playerIds = data.teams[0].players.slice(0, 4).map((player) => player.id);
    const lineup = { battingOrderIds: playerIds, defensivePositions: { [playerIds[0]]: "6", [playerIds[1]]: "6", [playerIds[2]]: "8", [playerIds[3]]: "3" } };

    expect(suggestDefensiveConflictFixes({ battingOrderIds: playerIds, defensivePositions: { [playerIds[0]]: "6", [playerIds[1]]: "8" } }, playerIds)).toEqual([]);
    expect(suggestDefensiveConflictFixes(lineup, playerIds)).toEqual([{
      position: "6",
      conflictingPlayerIds: [playerIds[0], playerIds[1]],
      availablePositions: ["1"],
      suggestedSwaps: [
        { targetPlayerId: playerIds[2], targetPosition: "8" },
        { targetPlayerId: playerIds[3], targetPosition: "3" },
      ],
    }]);
  });

  it("會保留四分格逐球控制的早稻田球數欄符號", () => {
    expect(getWasedaPitchMark("ball")).toBe("—");
    expect(getWasedaPitchMark("strike")).toBe("○");
    expect(getWasedaPitchMark("foul")).toBe("△");
    expect(getWasedaPitchMark("foulTip")).toBe("▲");
    expect(getWasedaPitchMark("swingingStrike")).toBe("⊖");
    expect(getWasedaPitchMark("bunt")).toBe("⌁");
    expect(getWasedaPitchMark("missedBunt")).toBe("◓");
    expect(getWasedaPitchMark("buntFoul")).toBe("△⌁");
    expect(getWasedaPitchMark("foulError")).toBe("△E");
    expect(getWasedaPitchMark("inPlay")).toBe("•");
  });

  it("成功觸擊會與擊出球同樣開啟四步打擊事件流程，未碰球觸擊則維持逐球輸入", () => {
    expect(opensBattedBallWorkflow("inPlay")).toBe(true);
    expect(opensBattedBallWorkflow("bunt")).toBe(true);
    expect(opensBattedBallWorkflow("missedBunt")).toBe(false);
    expect(opensBattedBallWorkflow("buntFoul")).toBe(false);
    expect(opensBattedBallWorkflow("strike")).toBe(false);
  });

  it("高飛犧牲打會讓三壘跑者得分、記錄打點且不計入打數", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const runner = away.players[0];
    const batter = away.players[1];
    const game = makeGame({ name: "高飛犧牲打測試", venue: "測試場", date: "2026-08-18", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 7 });
    const advancement = getSacrificeFlyAdvancement({ first: null, second: null, third: runner.id });
    const sacrificeFly = {
      id: "sacrifice-fly",
      inning: 1,
      half: "away" as const,
      batterId: batter.id,
      pitcherId: home.players[0].id,
      result: "F" as const,
      notation: "⌒8 SF",
      pitches: { balls: 0, strikes: 1, total: 2, locations: [{ zone: 5, type: "fastball" as const, outcome: "strike" as const }, { zone: 8, type: "fastball" as const, outcome: "inPlay" as const }] },
      outsBefore: 0,
      runsScored: advancement.runs,
      recordColumn: { trajectory: "fly" as const, battedBallPosition: "8", modifiers: [SACRIFICE_FLY_MODIFIER], rbi: advancement.runs, runnerAdvances: advancement.advances },
      timestamp: "2026-08-18T10:00:00.000Z",
    };

    const after = updateGameAfterEvent(game, sacrificeFly, advancement.runners, 1);
    const line = getBattingStats(after, away).find((item) => item.player.id === batter.id);
    expect(advancement).toEqual({ runners: { first: null, second: null, third: null }, runs: 1, advances: [{ id: "sf-3-4", type: "ADV", fromBase: 3, toBase: 4, notation: "SF 3→本" }] });
    expect(isSacrificeFlyRecord(after.events[0].recordColumn)).toBe(true);
    expect(after.score[0]?.away).toBe(1);
    expect(after.outs).toBe(1);
    expect(line).toMatchObject({ ab: 0, rbi: 1, avg: 0 });
  });

  it("僅在三壘有跑者時符合高飛犧牲打得分條件，例外確認不會誤記分或打點", () => {
    const emptyBases = { first: null, second: null, third: null };
    const thirdOccupied = { first: "runner-1", second: null, third: "runner-3" };

    expect(canSacrificeFly(emptyBases)).toBe(false);
    expect(canSacrificeFly(thirdOccupied)).toBe(true);
    expect(getSacrificeFlyAdvancement(emptyBases)).toMatchObject({ runners: emptyBases, runs: 0, advances: [] });
  });

  it("單場打擊統計會分別計算 SH、SF 與兩類犧牲打的 RBI", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const game = makeGame({ name: "犧牲打統計測試", venue: "測試場", date: "2026-08-18", awayTeamId: away.id, homeTeamId: data.teams[1].id, maxInnings: 7 });
    const batter = away.players[0];

    game.events = [
      { id: "stat-sh", inning: 1, half: "away", batterId: batter.id, pitcherId: "pitcher", result: "G", notation: "SH", pitches: { balls: 0, strikes: 0, total: 1 }, outsBefore: 0, runsScored: 0, recordColumn: { modifiers: [SACRIFICE_BUNT_MODIFIER], rbi: 1 }, timestamp: "2026-08-18T10:00:00.000Z" },
      { id: "stat-sf", inning: 2, half: "away", batterId: batter.id, pitcherId: "pitcher", result: "F", notation: "SF", pitches: { balls: 0, strikes: 1, total: 2 }, outsBefore: 0, runsScored: 1, recordColumn: { modifiers: [SACRIFICE_FLY_MODIFIER], rbi: 1 }, timestamp: "2026-08-18T10:05:00.000Z" },
    ];

    expect(getBattingStats(game, away)[0]).toMatchObject({ ab: 0, h: 0, sh: 1, sf: 1, sacRbi: 2, rbi: 2 });
    expect(getTeamSacrificeTotals(getBattingStats(game, away))).toEqual({ sh: 1, sf: 1, sacRbi: 2 });
  });

  it("SF 未得分原因會保留跑者狀態或記錄本壘傳殺，且附帶可讀備註", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const runner = away.players[0];
    const batter = away.players[1];
    const game = makeGame({ name: "SF 例外原因測試", venue: "測試場", date: "2026-08-18", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 7 });
    const held = getSacrificeFlyAdvancement({ first: null, second: null, third: runner.id }, "runner_held_at_third");
    const homeOut = getSacrificeFlyAdvancement({ first: null, second: null, third: runner.id }, "runner_out_at_home");
    const event = {
      id: "sf-home-out",
      inning: 1,
      half: "away" as const,
      batterId: batter.id,
      pitcherId: home.players[0].id,
      result: "F" as const,
      notation: formatRecordColumnNotation("F", "8", { trajectory: "fly", battedBallPosition: "8", fieldingSequence: "8ー2", modifiers: [SACRIFICE_FLY_MODIFIER], sacrificeFlyNoScoreReason: "runner_out_at_home" }),
      pitches: { balls: 0, strikes: 1, total: 2 },
      outsBefore: 0,
      runsScored: homeOut.runs,
      recordColumn: { trajectory: "fly" as const, battedBallPosition: "8", fieldingSequence: "8ー2", modifiers: [SACRIFICE_FLY_MODIFIER], sacrificeFlyNoScoreReason: "runner_out_at_home" as const, rbi: 0, runnerAdvances: homeOut.advances },
      timestamp: "2026-08-18T10:05:00.000Z",
    };

    expect(held).toEqual({ runners: { first: null, second: null, third: runner.id }, runs: 0, advances: [] });
    expect(homeOut).toMatchObject({ runners: { first: null, second: null, third: null }, runs: 0, advances: [{ type: "CS", fromBase: 3, toBase: 4 }] });
    expect(event.notation).toContain("SF未得分：守備傳殺於本壘");
    expect(updateGameAfterEvent(game, event, homeOut.runners, homeOut.runs).outs).toBe(2);
  });

  it("擊出球完成後會保留球種、九宮格落點與後續守備傳接紀錄", () => {
    const data = createInitialData();
    const game = makeGame({ name: "擊出後流程", venue: "測試場", date: "2026-08-15", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 7 });
    const event = {
      id: "in-play-flow",
      inning: 1,
      half: "away" as const,
      batterId: data.teams[0].players[0].id,
      pitcherId: data.teams[1].players[0].id,
      result: "G" as const,
      notation: formatRecordColumnNotation("G", "6", { trajectory: "ground", battedBallPosition: "6", fieldingSequence: "6-3" }),
      pitches: { balls: 0, strikes: 1, total: 2, locations: [{ zone: 5, type: "fastball" as const, outcome: "strike" as const }, { zone: 8, type: "breaking" as const, outcome: "inPlay" as const }] },
      outsBefore: 0,
      runsScored: 0,
      recordColumn: { trajectory: "ground" as const, battedBallPosition: "6", fieldingSequence: "6-3" },
      timestamp: "2026-08-15T10:00:00.000Z",
    };

    const after = updateGameAfterEvent(game, event, { first: null, second: null, third: null }, 0);
    expect(after.events[0].pitches.locations?.at(-1)).toEqual({ zone: 8, type: "breaking", outcome: "inPlay" });
    expect(after.events[0].notation).toBe("＿6 6ー3");
    expect(after.outs).toBe(1);
  });

  it("守備位置編號符合棒球紀錄法的內野配置", () => {
    const labels = Object.fromEntries(FIELD_POSITIONS.map((position) => [position.number, position.label]));
    expect(labels["3"]).toBe("一壘");
    expect(labels["4"]).toBe("二壘");
    expect(labels["5"]).toBe("三壘");
    expect(labels["6"]).toBe("游擊");
    expect(getNotation("G", "3")).toBe("＿3ー3");
    expect(getNotation("G", "4")).toBe("＿4ー3");
    expect(getNotation("G", "5")).toBe("＿5ー3");
    expect(getNotation("G", "6")).toBe("＿6ー3");
  });

  it("會正確計算打擊率、長打率、上壘率與 OPS", () => {
    const data = createInitialData();
    const game = data.games[0];
    const team = data.teams[0];
    game.events = [
      { id: "1", inning: 1, half: "away", batterId: team.players[0].id, pitcherId: "pitcher", result: "1B", notation: "7 1B", pitches: { balls: 0, strikes: 1, total: 1 }, outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString() },
      { id: "2", inning: 1, half: "away", batterId: team.players[0].id, pitcherId: "pitcher", result: "2B", notation: "8 2B", pitches: { balls: 1, strikes: 0, total: 1 }, outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString() },
      { id: "3", inning: 1, half: "away", batterId: team.players[0].id, pitcherId: "pitcher", result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 }, outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString() },
    ];
    const line = getBattingStats(game, team)[0];
    expect(line.ab).toBe(2);
    expect(line.h).toBe(2);
    expect(formatAvg(line.avg)).toBe("1.000");
    expect(line.slg).toBe(1.5);
    expect(line.obp).toBe(1);
    expect(line.ops).toBe(2.5);
  });

  it("滿壘四壞會推進一分，安打會更新壘包狀態", () => {
    const first = "runner-1";
    const second = "runner-2";
    const third = "runner-3";
    const loaded = nextRunnerState({ first, second, third }, "BB", "batter");
    expect(loaded.runs).toBe(1);
    expect(loaded.runners.first).toBe("batter");
    expect(loaded.runners.second).toBe(first);
    expect(loaded.runners.third).toBe(second);

    const single = nextRunnerState({ first: first, second: null, third: null }, "1B", "batter");
    expect(single.runs).toBe(0);
    expect(single.runners.first).toBe("batter");
    expect(single.runners.second).toBe(first);
    expect(single.runners.third).toBeNull();
  });

  it("野手選擇會封殺原一壘跑者並讓打者安全上一壘", () => {
    const runnerResult = nextFieldersChoiceRunnerState({ first: "runner-1", second: "runner-2", third: null }, "batter");
    expect(runnerResult.runs).toBe(0);
    expect(runnerResult.runners.first).toBe("batter");
    expect(runnerResult.runners.second).toBe("runner-2");
    expect(runnerResult.runners.third).toBeNull();

    const seed = createInitialData().games[0];
    const game = { ...seed, status: "live" as const, runners: { first: "runner-1", second: "runner-2", third: null } };
    const event = {
      id: "fc-1",
      inning: 1,
      half: "away" as const,
      batterId: "batter",
      pitcherId: "pitcher",
      result: "G" as const,
      notation: "6-4 FC",
      pitches: { balls: 0, strikes: 0, total: 1 },
      outsBefore: 0,
      runsScored: 0,
      recordColumn: { fieldingPlay: "FC" as const, fieldingSequence: "6-4" },
      timestamp: new Date().toISOString(),
    };
    const updated = updateGameAfterEvent(game, event, runnerResult.runners, runnerResult.runs);
    expect(updated.outs).toBe(1);
    expect(updated.runners.first).toBe("batter");
    expect(updated.runners.second).toBe("runner-2");

    const team = { ...createInitialData().teams[0], players: [{ ...createInitialData().teams[0].players[0], id: "batter" }] };
    const fcBatting = getBattingStats({ ...game, events: [event] }, team)[0];
    expect(fcBatting.ab).toBe(1);
    expect(fcBatting.h).toBe(0);
  });

  it("不死三振選擇 K+ 時會讓打者上一壘，一般三振仍維持原壘包", () => {
    const dropped = nextRunnerState({ first: null, second: null, third: null }, "K", "batter", { droppedThirdStrike: true });
    expect(dropped.runners.first).toBe("batter");
    expect(dropped.runs).toBe(0);

    const ordinary = nextRunnerState({ first: null, second: null, third: null }, "K", "batter");
    expect(ordinary.runners.first).toBeNull();
  });

  it("不死三振僅在一壘無人或兩出局時成立，且合法 K+ 不增加出局數", () => {
    const blocked = nextRunnerState({ first: "runner-1", second: null, third: null }, "K", "batter", { droppedThirdStrike: true, outs: 1 });
    expect(blocked.runners.first).toBe("runner-1");

    const legalWithTwoOuts = nextRunnerState({ first: "runner-1", second: null, third: null }, "K", "batter", { droppedThirdStrike: true, outs: 2 });
    expect(legalWithTwoOuts.runners.first).toBe("batter");
    expect(legalWithTwoOuts.runners.second).toBe("runner-1");

    const data = createInitialData();
    const game = makeGame({ name: "K+ 規則", venue: "測試場", date: "2026-08-15", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 7 });
    const event = { id: "legal-k-plus", inning: 1, half: "away" as const, batterId: data.teams[0].players[0].id, pitcherId: data.teams[1].players[0].id, result: "K" as const, notation: "K+", pitches: { balls: 0, strikes: 3, total: 3 }, outsBefore: 0, runsScored: 0, droppedThirdStrike: true, timestamp: "2026-08-15T10:00:00.000Z" };
    const after = updateGameAfterEvent(game, event, { first: event.batterId, second: null, third: null }, 0);
    expect(after.outs).toBe(0);
    expect(after.runners.first).toBe(event.batterId);
  });

  it("跑壘事件會同步附加到讓跑者上壘的來源打席，供本局與單場紀錄格共用", () => {
    const data = createInitialData();
    const runner = data.teams[0].players[0];
    const pitcher = data.teams[1].players[0];
    const game = makeGame({ name: "跑壘同步", venue: "測試場", date: "2026-08-14", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 7 });
    const onBase = { id: "ab-runner", inning: 1, half: "away" as const, batterId: runner.id, pitcherId: pitcher.id, result: "BB" as const, notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 }, outsBefore: 0, runsScored: 0, timestamp: "2026-08-14T10:00:00.000Z" };
    const afterAtBat = updateGameAfterEvent(game, onBase, { first: runner.id, second: null, third: null }, 0);
    const afterSteal = updateGameAfterSpecialEvent(afterAtBat, { id: "special-sb", inning: 1, half: "away", type: "SB", runnerId: runner.id, pitcherId: pitcher.id, fromBase: 1, toBase: 2, runsScored: 0, outsBefore: 0, notation: "SB 1→2", timestamp: "2026-08-14T10:01:00.000Z" }, { first: null, second: runner.id, third: null }, 0, 0);

    expect(afterSteal.specialEvents[0]).toMatchObject({ sourceAtBatId: "ab-runner" });
    expect(afterSteal.events[0].runnerAdvances).toEqual([{ id: "special-sb", type: "SB", fromBase: 1, toBase: 2, notation: "SB 1→2" }]);
  });

  it("DP 會同時清除前位跑者壘包並將第二個出局回寫至來源打席", () => {
    const data = createInitialData();
    const runner = data.teams[0].players[0];
    const batter = data.teams[0].players[1];
    const pitcher = data.teams[1].players[0];
    let game = makeGame({ name: "雙殺同步", venue: "測試場", date: "2026-08-20", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 7 });
    const walk = { id: "dp-runner-on", inning: 1, half: "away" as const, batterId: runner.id, pitcherId: pitcher.id, result: "BB" as const, notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 }, outsBefore: 0, runsScored: 0, timestamp: "2026-08-20T10:00:00.000Z" };
    game = updateGameAfterEvent(game, walk, { first: runner.id, second: null, third: null }, 0);
    const doublePlay = { id: "dp-grounder", inning: 1, half: "away" as const, batterId: batter.id, pitcherId: pitcher.id, result: "G" as const, notation: "6ー4ー3 DP", pitches: { balls: 0, strikes: 1, total: 1 }, outsBefore: 0, runsScored: 0, recordColumn: { fieldingSequence: "6ー4ー3", fieldingPlay: "DP" as const }, timestamp: "2026-08-20T10:01:00.000Z" };
    const after = updateGameAfterEvent(game, doublePlay, { first: runner.id, second: null, third: null }, 0);

    expect(after.outs).toBe(2);
    expect(after.runners).toEqual({ first: null, second: null, third: null });
    expect(after.events.find((event) => event.id === "dp-runner-on")?.runnerAdvances).toContainEqual(expect.objectContaining({ fromBase: 1, toBase: 2, outNumber: 2, notation: "DP 1壘跑者出局" }));
    expect(after.events.find((event) => event.id === "dp-grounder")?.recordColumn?.fieldingPlay).toBe("DP");
  });

  it("第三出局盜壘刺會回寫來源打席內圈出局序號，其他壘上跑者會標記殘壘", () => {
    const data = createInitialData();
    const [runnerAtSecond, caughtRunner] = data.teams[0].players;
    const pitcher = data.teams[1].players[0];
    let game = makeGame({ name: "CS 與殘壘", venue: "測試場", date: "2026-08-15", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 7 });
    const firstWalk = { id: "walk-second", inning: 1, half: "away" as const, batterId: runnerAtSecond.id, pitcherId: pitcher.id, result: "BB" as const, notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 }, outsBefore: 0, runsScored: 0, timestamp: "2026-08-15T10:00:00.000Z" };
    const secondWalk = { id: "walk-first", inning: 1, half: "away" as const, batterId: caughtRunner.id, pitcherId: pitcher.id, result: "BB" as const, notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 }, outsBefore: 0, runsScored: 0, timestamp: "2026-08-15T10:01:00.000Z" };
    game = updateGameAfterEvent(game, firstWalk, { first: runnerAtSecond.id, second: null, third: null }, 0);
    game = updateGameAfterEvent(game, secondWalk, { first: caughtRunner.id, second: runnerAtSecond.id, third: null }, 0);
    game = { ...game, outs: 2 };

    const after = updateGameAfterSpecialEvent(game, { id: "third-out-cs", inning: 1, half: "away", type: "CS", runnerId: caughtRunner.id, pitcherId: pitcher.id, fromBase: 1, toBase: 2, runsScored: 0, outsBefore: 2, notation: "CS 1→2", timestamp: "2026-08-15T10:02:00.000Z" }, { first: null, second: runnerAtSecond.id, third: null }, 0, 1);
    expect(after.half).toBe("home");
    expect(after.events.find((event) => event.id === "walk-first")?.runnerAdvances).toContainEqual({ id: "third-out-cs", type: "CS", fromBase: 1, toBase: 2, outNumber: 3, notation: "CS 1→2" });
    expect(after.events.find((event) => event.id === "walk-second")?.runnerAdvances).toContainEqual({ id: "third-out-cs-lob-2", type: "LOB", fromBase: 2, notation: "l" });
  });

  it("三個出局會從客場上半局換到主場下半局", () => {
    const data = createInitialData();
    let game = makeGame({ name: "測試賽", venue: "測試場", date: "2026-08-12", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 9 });
    for (let i = 0; i < 3; i += 1) {
      const event = { id: String(i), inning: game.inning, half: game.half, batterId: data.teams[0].players[i].id, pitcherId: data.teams[1].players[0].id, result: "K" as const, notation: "K", pitches: { balls: 0, strikes: 3, total: 3 }, outsBefore: game.outs, runsScored: 0, timestamp: new Date().toISOString() };
      game = updateGameAfterEvent(game, event, game.runners, 0);
    }
    expect(game.half).toBe("home");
    expect(game.inning).toBe(1);
    expect(game.outs).toBe(0);
    expect(game.specialEvents.filter((event) => event.type === "INNING_END")).toHaveLength(1);
    expect(game.specialEvents.at(-1)).toMatchObject({ type: "INNING_END", notation: "//", inning: 1, half: "away" });
  });

  it("支援 15 局比賽並建立完整局數欄位", () => {
    const data = createInitialData();
    const game = makeGame({ name: "延長賽", venue: "主球場", date: "2026-08-12", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 15 });
    expect(game.maxInnings).toBe(15);
    expect(game.score).toHaveLength(15);
    expect(game.score[14]?.inning).toBe(15);
  });

  it("會保留觸身球的 1189LAB 標準紀錄符號", () => {
    expect(getNotation("HBP", "2")).toBe("DB");
  });

  it("換人後會使用最新投手", () => {
    const data = createInitialData();
    const game = makeGame({ name: "換人測試", venue: "測試場", date: "2026-08-12", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 9 });
    game.substitutions = [{ id: "sub-1", inning: 3, half: "away", teamId: data.teams[1].id, playerOutId: data.teams[1].players[0].id, playerInId: data.teams[1].players[1].id, position: "投手", timestamp: new Date().toISOString() }];
    expect(getCurrentPitcher(game, data.teams[1], data.teams[0]).id).toBe(data.teams[1].players[1].id);
  });

  it("換守會以獨立類型與新的守備位置保留在換人紀錄", () => {
    const data = createInitialData();
    const game = makeGame({ name: "換守測試", venue: "測試場", date: "2026-08-13", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 7 });
    game.substitutions = [{ id: "def-1", inning: 4, half: "home", teamId: data.teams[0].id, playerOutId: data.teams[0].players[2].id, playerInId: data.teams[0].players[10].id, position: "游擊", type: "換守", timestamp: "2026-08-13T10:00:00.000Z" }];
    expect(game.substitutions[0]).toMatchObject({ type: "換守", position: "游擊", inning: 4 });
  });

  it("手動補登打席會納入打擊統計並保留補登來源", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const game = makeGame({ name: "補登測試", venue: "測試場", date: "2026-08-13", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 7 });
    game.events = [{ id: "manual-hit", inning: 2, half: "away", batterId: away.players[0].id, pitcherId: home.players[0].id, result: "2B", notation: "〉7 2B", pitches: { balls: 1, strikes: 2, total: 3 }, outsBefore: 1, runsScored: 1, source: "manual", timestamp: "2026-08-13T10:00:00.000Z" }];
    expect(game.events[0].source).toBe("manual");
    expect(getBattingStats(game, away)[0]).toMatchObject({ ab: 1, h: 1, twoB: 1 });
  });

  it("早稻田記錄欄會隨打席保存軌跡、守備序列、特殊標記與打點", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const game = makeGame({ name: "記錄欄測試", venue: "測試場", date: "2026-08-14", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 6 });
    game.events = [{
      id: "record-column-1",
      inning: 1,
      half: "away",
      batterId: away.players[0].id,
      pitcherId: home.players[0].id,
      result: "E",
      notation: "⌒6 E6-3 DP",
      pitches: { balls: 1, strikes: 1, total: 2 },
      outsBefore: 0,
      runsScored: 0,
      recordColumn: { trajectory: "ground", fieldingSequence: "6-3", modifiers: ["E", "DP"], rbi: 2 },
      timestamp: "2026-08-14T10:00:00.000Z",
    }];
    expect(game.events[0].recordColumn).toEqual({ trajectory: "ground", fieldingSequence: "6-3", modifiers: ["E", "DP"], rbi: 2 });
  });

  it("賽事超過預定局數時會自動補足比分欄位供 R/H/E 記分板使用", () => {
    const data = createInitialData();
    const game = makeGame({ name: "第八局延長", venue: "測試場", date: "2026-08-13", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 7 });
    const score = ensureScoreThroughInning(game.score.slice(0, 7), 9).map((row) => row.inning === 9 ? { ...row, away: 2, home: 1 } : row);
    expect(score).toHaveLength(9);
    expect(score[8]).toEqual({ inning: 9, away: 2, home: 1 });
  });

  it("會正確記錄盜壘、盜壘刺、暴投與捕逸的壘包結果", () => {
    const stolen = nextSpecialRunnerState({ first: "runner-1", second: null, third: null }, "SB", 1, 2);
    expect(stolen.runners.first).toBeNull();
    expect(stolen.runners.second).toBe("runner-1");
    expect(stolen.runs).toBe(0);
    expect(getSpecialEventNotation("SB", 1, 2)).toBe("SB");

    const caught = nextSpecialRunnerState({ first: "runner-1", second: null, third: null }, "CS", 1, 2);
    expect(caught.runners.first).toBeNull();
    expect(caught.outsAdded).toBe(1);
    expect(getSpecialEventNotation("CS", 1, 2)).toBe("CS");

    const wild = nextSpecialRunnerState({ first: "runner-1", second: "runner-2", third: "runner-3" }, "WP");
    expect(wild.runs).toBe(1);
    expect(wild.runners.third).toBe("runner-2");
    expect(wild.runners.second).toBe("runner-1");
    expect(wild.runners.first).toBeNull();

    const passed = nextSpecialRunnerState({ first: "runner-1", second: null, third: null }, "PB");
    expect(passed.runners.second).toBe("runner-1");

    const balkHome = nextSpecialRunnerState({ first: null, second: "runner-2", third: "runner-3" }, "BK", 3, 4);
    expect(balkHome.runs).toBe(1);
    expect(balkHome.runners.third).toBeNull();
    const balkAdvance = nextSpecialRunnerState(balkHome.runners, "BK", 2, 3);
    expect(balkAdvance.runs).toBe(0);
    expect(balkAdvance.runners.third).toBe("runner-2");
    expect(balkAdvance.runners.second).toBeNull();

    const advance = nextSpecialRunnerState({ first: null, second: "runner-2", third: null }, "ADV", 2, 3);
    expect(advance.runners.second).toBeNull();
    expect(advance.runners.third).toBe("runner-2");
    expect(getSpecialEventNotation("ADV", 2, 3)).toBe("↑2→3");
  });

  it("攻守暫停與早稻田斜線註記均為統計中性，不改變跑者、比分或出局", () => {
    const runners = { first: "runner-1", second: "runner-2", third: null };
    (['OFFENSIVE_TIMEOUT', 'DEFENSIVE_TIMEOUT', 'INNING_END', 'GAME_END_EARLY'] as const).forEach((type) => {
      const movement = nextSpecialRunnerState(runners, type, 1, 2);
      expect(movement).toEqual({ runners, runs: 0, outsAdded: 0 });
    });
    expect(getSpecialEventNotation("OFFENSIVE_TIMEOUT")).toBe("O.C");
    expect(getSpecialEventNotation("DEFENSIVE_TIMEOUT")).toBe("T");
    expect(getSpecialEventNotation("INNING_END")).toBe("//");
    expect(getSpecialEventNotation("GAME_END_EARLY")).toBe("///");

    const data = createInitialData();
    const game = {
      ...makeGame({ name: "純註記測試", venue: "測試場", date: "2026-08-23", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 7 }),
      outs: 1,
      runners,
      score: [{ inning: 1, away: 2, home: 1 }],
    };
    const after = appendStatNeutralSpecialEvent(game, { id: "timeout-1", inning: 1, half: "away", type: "OFFENSIVE_TIMEOUT", runsScored: 0, outsBefore: 1, notation: "O.C", reason: "戰術討論與跑壘確認", timestamp: "2026-08-23T10:00:00.000Z" });
    expect(after.outs).toBe(1);
    expect(after.runners).toEqual(runners);
    expect(after.score).toEqual(game.score);
    expect(after.events).toEqual(game.events);
    expect(after.specialEvents).toHaveLength(1);
    expect(after.specialEvents[0]).toMatchObject({ notation: "O.C", reason: "戰術討論與跑壘確認", runsScored: 0 });
  });

  it("未滿三出局結束比賽會留下唯一 ///，且不補加出局或清除跑者", () => {
    const data = createInitialData();
    const runners = { first: data.teams[0].players[0].id, second: null, third: null };
    const game = {
      ...makeGame({ name: "提前結束", venue: "測試場", date: "2026-08-23", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 7 }),
      inning: 5,
      half: "home" as const,
      outs: 1,
      runners,
      score: [{ inning: 1, away: 3, home: 2 }],
    };
    const after = finishGameWithEarlyEndAnnotation(game);
    const repeated = finishGameWithEarlyEndAnnotation(after);

    expect(after.status).toBe("final");
    expect(after.outs).toBe(1);
    expect(after.runners).toEqual(runners);
    expect(after.score).toEqual(game.score);
    expect(after.specialEvents.at(-1)).toMatchObject({ type: "GAME_END_EARLY", notation: "///", inning: 5, half: "home", outsBefore: 1 });
    expect(repeated.specialEvents.filter((event) => event.type === "GAME_END_EARLY")).toHaveLength(1);
  });

  it("工作台提供 O.C／T 純註記與提前結束 /// 的確認文案", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    expect(source).toContain('mark: "O.C"');
    expect(source).toContain('mark: "T"');
    expect(source).toContain("純註記，不影響統計");
    expect(source).toContain("確認提前結束比賽");
    expect(source).toContain("確認結束並記錄 ///");
    expect(source).toContain("暫停原因（選填）");
    expect(source).toContain("暫停原因：");
  });

  it("完整紀錄表保留五步教學、分隊表與已落帳復原入口", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    expect(source).toContain("結果 → 跑者 → 出局 → 得分 → 半局核對");
    expect(source).toContain("客場／先攻");
    expect(source).toContain("主場／後攻");
    expect(source).toContain("換人歷程｜寫入前可於工作台逐步返回");
    expect(source).toContain("守備／傳接摘要");
    expect(source).toContain("復原上一筆");
  });

  it("WP、PB、BK 共用跑者摘要會列出起點、終點與預計得分", () => {
    expect(buildSpecialEventRunnerSummary("WP", { first: "runner-1", second: null, third: null })).toEqual([
      { fromBase: 1, toBase: 2, runnerId: "runner-1", scores: false },
    ]);
    expect(buildSpecialEventRunnerSummary("PB", { first: "runner-1", second: "runner-2", third: null })).toEqual([
      { fromBase: 2, toBase: 3, runnerId: "runner-2", scores: false },
      { fromBase: 1, toBase: 2, runnerId: "runner-1", scores: false },
    ]);
    expect(buildSpecialEventRunnerSummary("BK", { first: null, second: "runner-2", third: "runner-3" })).toEqual([
      { fromBase: 3, toBase: 4, runnerId: "runner-3", scores: true },
      { fromBase: 2, toBase: 3, runnerId: "runner-2", scores: false },
    ]);
    expect(buildSpecialEventRunnerSummary("WP", { first: null, second: null, third: null })).toEqual([]);
    expect(buildSpecialEventRunnerSummary("PB", { first: null, second: null, third: null })).toEqual([]);
  });

  it("特殊事件會更新比分、出局與逐球歷史", () => {
    const data = createInitialData();
    const game = makeGame({ name: "特殊事件測試", venue: "測試場", date: "2026-08-13", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 9 });
    const event = { id: "special-1", inning: 1, half: "away" as const, type: "WP" as const, pitcherId: data.teams[1].players[0].id, runsScored: 1, outsBefore: 0, notation: "WP", timestamp: new Date().toISOString() };
    const updated = updateGameAfterSpecialEvent(game, event, { first: null, second: null, third: null }, 1, 0);
    expect(updated.specialEvents).toHaveLength(1);
    expect(updated.score[0].away).toBe(1);
    expect(updated.updatedAt).toMatch(/^2026-/);
  });

  it("離線與雲端合併會保留兩邊逐球與特殊事件且不重複", () => {
    const seed = createInitialData();
    const local = JSON.parse(JSON.stringify(seed)) as ReturnType<typeof createInitialData>;
    const remote = JSON.parse(JSON.stringify(seed)) as ReturnType<typeof createInitialData>;
    local.games[0].updatedAt = "2026-08-13T10:00:00.000Z";
    remote.games[0].updatedAt = "2026-08-13T10:05:00.000Z";
    local.games[0].events = [{ id: "local-event", inning: 1, half: "away", batterId: local.teams[0].players[0].id, pitcherId: local.teams[1].players[0].id, result: "1B", notation: "7 1B", pitches: { balls: 0, strikes: 1, total: 1 }, outsBefore: 0, runsScored: 0, timestamp: "2026-08-13T10:01:00.000Z" }];
    remote.games[0].events = [{ id: "remote-event", inning: 1, half: "away", batterId: remote.teams[0].players[1].id, pitcherId: remote.teams[1].players[0].id, result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 }, outsBefore: 0, runsScored: 0, timestamp: "2026-08-13T10:04:00.000Z" }];
    remote.games[0].specialEvents = [{ id: "remote-special", inning: 1, half: "away", type: "SB", runnerId: remote.teams[0].players[0].id, pitcherId: remote.teams[1].players[0].id, fromBase: 1, toBase: 2, runsScored: 0, outsBefore: 0, notation: "SB2", timestamp: "2026-08-13T10:03:00.000Z" }];
    const merged = mergeAppData(local, remote);
    expect(merged.games[0].events.map((event) => event.id).sort()).toEqual(["local-event", "remote-event"]);
    expect(merged.games[0].specialEvents[0].id).toBe("remote-special");
    expect(merged.games[0].updatedAt).toBe("2026-08-13T10:05:00.000Z");
  });

  it("所屬球隊統計會依主客場只累計該隊表現", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const game = makeGame({ name: "主客場統計", venue: "測試場", date: "2026-08-13", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 9 });
    game.events = [
      { id: "away-hit", inning: 1, half: "away", batterId: away.players[0].id, pitcherId: home.players[0].id, result: "1B", notation: "7 1B", pitches: { balls: 0, strikes: 1, total: 1 }, outsBefore: 0, runsScored: 0, timestamp: "2026-08-13T10:00:00.000Z" },
      { id: "home-hit", inning: 1, half: "home", batterId: home.players[0].id, pitcherId: away.players[0].id, result: "2B", notation: "8 2B", pitches: { balls: 0, strikes: 1, total: 1 }, outsBefore: 0, runsScored: 0, timestamp: "2026-08-13T10:01:00.000Z" },
    ];
    expect(getGamesForTeam([game], away.id)).toHaveLength(1);
    expect(getTeamPerformanceSummary([game], away).hits).toBe(1);
    expect(getTeamPerformanceSummary([game], home).hits).toBe(1);
  });

  it("會跨不限場次賽事累計打擊數據", () => {
    const data = createInitialData();
    const first = makeGame({ name: "第一場", venue: "A", date: "2026-08-12", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 7 });
    const second = makeGame({ name: "第二場", venue: "B", date: "2026-08-13", awayTeamId: data.teams[0].id, homeTeamId: data.teams[1].id, maxInnings: 7 });
    first.events = [{ id: "s1", inning: 1, half: "away", batterId: data.teams[0].players[0].id, pitcherId: data.teams[1].players[0].id, result: "HR", notation: "8 HR", pitches: { balls: 0, strikes: 1, total: 1 }, outsBefore: 0, runsScored: 1, timestamp: new Date().toISOString() }];
    second.events = [{ id: "s2", inning: 1, half: "away", batterId: data.teams[0].players[0].id, pitcherId: data.teams[1].players[0].id, result: "1B", notation: "7 1B", pitches: { balls: 0, strikes: 1, total: 1 }, outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString() }];
    const line = getSeasonBattingStats([first, second], data.teams[0])[0];
    expect(line.ab).toBe(2);
    expect(line.h).toBe(2);
    expect(line.slg).toBe(2.5);
  });

  it("會依單場、日到日、月到月與複數盃賽篩選統計賽事", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const aprilCup = makeGame({ name: "四月盃賽", competition: "春季盃", venue: "A", date: "2026-04-12", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 7 });
    const mayLeague = makeGame({ name: "五月聯賽", competition: "夏季聯賽", venue: "B", date: "2026-05-04", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 7 });
    const juneCup = makeGame({ name: "六月盃賽", competition: "春季盃", venue: "C", date: "2026-06-21", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 7 });
    const games = [aprilCup, mayLeague, juneCup];

    expect(filterGamesForStatistics(games, { mode: "game", gameId: mayLeague.id }).map((game) => game.id)).toEqual([mayLeague.id]);
    expect(filterGamesForStatistics(games, { mode: "date", start: "2026-05-01", end: "2026-05-31" }).map((game) => game.id)).toEqual([mayLeague.id]);
    expect(filterGamesForStatistics(games, { mode: "month", start: "2026-04", end: "2026-05" }).map((game) => game.id)).toEqual([aprilCup.id, mayLeague.id]);
    expect(filterGamesForStatistics(games, { mode: "cup", competitions: ["春季盃", "夏季聯賽"] })).toHaveLength(3);
    expect(filterGamesForStatistics(games, { mode: "cup", competitions: [] })).toHaveLength(0);
  });

  it("首頁最近比賽可依日期區間與盃賽名稱搜尋，且已刪除賽事不會在同步合併後回來", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const springCup = makeGame({ name: "春季盃第一場", competition: "春季盃", venue: "A", date: "2026-04-12", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 7 });
    const summerCup = makeGame({ name: "夏季盃第一場", competition: "夏季盃", venue: "B", date: "2026-06-21", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 7 });

    expect(filterRecentGames([springCup, summerCup], { dateFrom: "2026-04-01", dateTo: "2026-04-30" }).map((game) => game.id)).toEqual([springCup.id]);
    expect(filterRecentGames([springCup, summerCup], { competition: "夏季" }).map((game) => game.id)).toEqual([summerCup.id]);

    const local = { ...data, games: [springCup], deletedGameIds: [summerCup.id] };
    const remote = { ...data, games: [springCup, summerCup], deletedGameIds: [] };
    expect(mergeAppData(local, remote).games.some((game) => game.id === summerCup.id)).toBe(false);
  });

  it("登錄制會將單場統計限制於已登錄球員，但全 25 人範圍仍保留完整名單", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const roster25 = Array.from({ length: 25 }, (_, index) => ({
      ...away.players[0],
      id: `roster-${index + 1}`,
      name: `登錄測試${index + 1}`,
      number: index + 1,
      battingOrder: index < 9 ? index + 1 : undefined,
    }));
    const rosterTeam = { ...away, players: roster25 };
    const game = makeGame({ name: "登錄制測試", venue: "測試場", date: "2026-08-13", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 9 });
    game.awayRegisteredPlayerIds = [roster25[0].id];
    game.events = [
      { id: "registered-hit", inning: 1, half: "away", batterId: roster25[0].id, pitcherId: home.players[0].id, result: "1B", notation: "7 1B", pitches: { balls: 0, strikes: 1, total: 1 }, outsBefore: 0, runsScored: 0, timestamp: "2026-08-13T10:00:00.000Z" },
      { id: "unregistered-hit", inning: 1, half: "away", batterId: roster25[1].id, pitcherId: home.players[0].id, result: "2B", notation: "8 2B", pitches: { balls: 0, strikes: 1, total: 1 }, outsBefore: 0, runsScored: 0, timestamp: "2026-08-13T10:01:00.000Z" },
    ];

    const registeredLines = getBattingStats(game, rosterTeam, "registered");
    const allLines = getBattingStats(game, rosterTeam, "all");
    expect(registeredLines).toHaveLength(1);
    expect(registeredLines[0].player.id).toBe(roster25[0].id);
    expect(registeredLines[0].h).toBe(1);
    expect(allLines).toHaveLength(25);
    expect(allLines.find((line) => line.player.id === roster25[1].id)?.h).toBe(1);
  });

  it("連續觸身球會保留前位跑者的強制進壘來源，且不改變既有壘包與比分結算", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const pitcher = home.players[0];
    let game = makeGame({ name: "連續觸身球測試", venue: "測試場", date: "2026-08-24", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 7 });

    const recordHbp = (id: string, batterId: string, minute: number) => {
      const next = nextRunnerState(game.runners, "HBP", batterId);
      game = updateGameAfterEvent(game, {
        id,
        inning: game.inning,
        half: game.half,
        batterId,
        pitcherId: pitcher.id,
        result: "HBP",
        notation: "DB",
        pitches: { balls: 0, strikes: 0, total: 0 },
        outsBefore: game.outs,
        runsScored: next.runs,
        timestamp: `2026-08-24T10:0${minute}:00.000Z`,
      }, next.runners, next.runs);
    };

    recordHbp("hbp-1", away.players[0].id, 0);
    expect(getForcedBaseOnBallsAdvances(game.runners, "HBP", "hbp-2")).toHaveLength(1);
    recordHbp("hbp-2", away.players[1].id, 1);
    recordHbp("hbp-3", away.players[2].id, 2);
    recordHbp("hbp-4", away.players[3].id, 3);

    expect(game.runners).toEqual({ first: away.players[3].id, second: away.players[2].id, third: away.players[1].id });
    expect(game.score.find((row) => row.inning === 1)?.away).toBe(1);
    expect(game.events.find((event) => event.id === "hbp-1")?.runnerAdvances).toEqual([
      { id: `hbp-2-forced-${away.players[0].id}-1-2`, type: "ADV", fromBase: 1, toBase: 2, notation: "HBP（DB） 強制 1→2" },
      { id: `hbp-3-forced-${away.players[0].id}-2-3`, type: "ADV", fromBase: 2, toBase: 3, notation: "HBP（DB） 強制 2→3" },
      { id: `hbp-4-forced-${away.players[0].id}-3-4`, type: "ADV", fromBase: 3, toBase: 4, notation: "HBP（DB） 強制 3→4" },
    ]);
    expect(game.events.find((event) => event.id === "hbp-2")?.runnerAdvances).toEqual([
      { id: `hbp-3-forced-${away.players[1].id}-1-2`, type: "ADV", fromBase: 1, toBase: 2, notation: "HBP（DB） 強制 1→2" },
      { id: `hbp-4-forced-${away.players[1].id}-2-3`, type: "ADV", fromBase: 2, toBase: 3, notation: "HBP（DB） 強制 2→3" },
    ]);
    expect(game.events.find((event) => event.id === "hbp-3")?.runnerAdvances).toEqual([
      { id: `hbp-4-forced-${away.players[2].id}-1-2`, type: "ADV", fromBase: 1, toBase: 2, notation: "HBP（DB） 強制 1→2" },
    ]);
  });

  describe("跨介面同步", () => {
    it("以同一份逐球事件同步現場五分格、本局打者列、單場紀錄與統計預覽", () => {
      const data = createInitialData();
      const away = data.teams[0];
      const home = data.teams[1];
      const runner = away.players[0];
      const batter = away.players[1];
      const pitcher = home.players[0];
      const game = makeGame({ name: "跨介面同步測試", venue: "測試場", date: "2026-08-14", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 7 });

      const walk = {
        id: "sync-walk",
        inning: 1,
        half: "away" as const,
        batterId: runner.id,
        pitcherId: pitcher.id,
        result: "BB" as const,
        notation: "B",
        pitches: {
          balls: 4,
          strikes: 0,
          total: 4,
          locations: [
            { zone: 10, type: "fastball" as const, outcome: "ball" as const },
            { zone: 1, type: "fastball" as const, outcome: "ball" as const },
            { zone: 11, type: "breaking" as const, outcome: "ball" as const },
            { zone: 1, type: "fastball" as const, outcome: "ball" as const },
          ],
        },
        outsBefore: 0,
        runsScored: 0,
        timestamp: "2026-08-14T10:00:00.000Z",
      };
      let updated = updateGameAfterEvent(game, walk, { first: runner.id, second: null, third: null }, 0);

      updated = updateGameAfterSpecialEvent(updated, {
        id: "sync-sb",
        inning: 1,
        half: "away",
        type: "SB",
        runnerId: runner.id,
        pitcherId: pitcher.id,
        fromBase: 1,
        toBase: 2,
        runsScored: 0,
        outsBefore: 0,
        notation: "SB 1→2",
        timestamp: "2026-08-14T10:01:00.000Z",
      }, { first: null, second: runner.id, third: null }, 0, 0);

      const double = {
        id: "sync-double",
        inning: 1,
        half: "away" as const,
        batterId: batter.id,
        pitcherId: pitcher.id,
        result: "2B" as const,
        notation: "〉7 2B",
        pitches: {
          balls: 1,
          strikes: 2,
          total: 3,
          locations: [
            { zone: 5, type: "fastball" as const, outcome: "strike" as const },
            { zone: 11, type: "breaking" as const, outcome: "foul" as const },
            { zone: 5, type: "fastball" as const, outcome: "inPlay" as const },
          ],
        },
        outsBefore: 0,
        runsScored: 1,
        recordColumn: { trajectory: "fly" as const, battedBallPosition: "7", fieldingSequence: "7", rbi: 1 },
        timestamp: "2026-08-14T10:02:00.000Z",
      };
      updated = updateGameAfterEvent(updated, double, { first: null, second: batter.id, third: null }, 1);

      const strikeout = {
        id: "sync-k",
        inning: 1,
        half: "away" as const,
        batterId: away.players[2].id,
        pitcherId: pitcher.id,
        result: "K" as const,
        notation: "K",
        pitches: {
          balls: 0,
          strikes: 3,
          total: 3,
          locations: [
            { zone: 6, type: "fastball" as const, outcome: "strike" as const },
            { zone: 6, type: "fastball" as const, outcome: "swingingStrike" as const },
            { zone: 2, type: "breaking" as const, outcome: "swingingStrike" as const },
          ],
        },
        outsBefore: 0,
        runsScored: 0,
        timestamp: "2026-08-14T10:03:00.000Z",
      };
      updated = updateGameAfterEvent(updated, strikeout, updated.runners, 0);

      // 現場右側本局打者列與單場整體紀錄都僅讀取同一個 events 陣列。
      const inningEvents = updated.events.filter((event) => event.inning === 1 && event.half === "away");
      expect(inningEvents.map((event) => event.id)).toEqual(["sync-walk", "sync-double", "sync-k"]);
      expect(inningEvents.find((event) => event.id === "sync-double")?.recordColumn).toMatchObject({ trajectory: "fly", battedBallPosition: "7", rbi: 1 });

      // 壘包工作台、右側本局格與單場格使用同一個來源打席上的 runnerAdvances。
      const runnerSource = updated.events.find((event) => event.id === "sync-walk");
      expect(updated.specialEvents.find((event) => event.id === "sync-sb")?.sourceAtBatId).toBe("sync-walk");
      expect(runnerSource?.runnerAdvances).toEqual([{ id: "sync-sb", type: "SB", fromBase: 1, toBase: 2, notation: "SB 1→2" }]);

      // 左下逐球格保留同格序號與真實結果，供早稻田符號、中上球數欄與統計熱點圖共用。
      const pitchGrid = groupPitchHistoryByZone(double.pitches.locations ?? []);
      expect(pitchGrid[5]).toEqual([
        { sequence: 1, type: "fastball", outcome: "strike" },
        { sequence: 3, type: "fastball", outcome: "inPlay" },
      ]);
      expect(double.pitches.locations?.map((pitch) => getWasedaPitchMark(pitch.outcome))).toEqual(["○", "△", "•"]);
      const pitchHeatmap = getPitchZoneHeatmap(updated, "all", pitcher.id);
      expect(pitchHeatmap.total).toBe(10);
      expect(pitchHeatmap.counts[0]).toBe(2);
      expect(pitchHeatmap.counts[4]).toBe(2);
      expect(pitchHeatmap.outsideTotal).toBe(3);

      // 照片式比分板、單場表與統計預覽均以逐局 score 及相同打席結果計算。
      expect(updated.score.find((row) => row.inning === 1)).toMatchObject({ away: 1, home: 0 });
      expect(getTeamPerformanceSummary([updated], away)).toMatchObject({ runs: 1, hits: 1, walks: 1, strikeouts: 1, stolenBases: 1 });
      expect(getBattingStats(updated, away).find((line) => line.player.id === batter.id)).toMatchObject({ ab: 1, h: 1, twoB: 1, rbi: 1, avg: 1, slg: 2, obp: 1, ops: 3 });
      expect(getPitchingStats(updated, home).find((line) => line.player.id === pitcher.id)).toMatchObject({ pitches: 10, h: 1, r: 1, bb: 1, so: 1, ip: "0.1" });
    });

    it("壘上跑者會回溯一般一壘安打來源，並與最近完成打席使用相同事件", () => {
      const data = createInitialData();
      const away = data.teams[0];
      const home = data.teams[1];
      const firstRunner = away.players[0];
      const nextBatter = away.players[1];
      const pitcher = home.players[0];
      const game = makeGame({ name: "一壘安打同步", venue: "測試場", date: "2026-08-23", awayTeamId: away.id, homeTeamId: home.id, maxInnings: 7 });
      const firstHit = {
        id: "source-1b",
        inning: 1,
        half: "away" as const,
        batterId: firstRunner.id,
        pitcherId: pitcher.id,
        result: "1B" as const,
        notation: "7 1B",
        pitches: { balls: 0, strikes: 1, total: 1 },
        outsBefore: 0,
        runsScored: 0,
        timestamp: "2026-08-23T10:00:00.000Z",
      };
      let updated = updateGameAfterEvent(game, firstHit, { first: firstRunner.id, second: null, third: null }, 0);
      const secondHit = {
        ...firstHit,
        id: "latest-1b",
        batterId: nextBatter.id,
        notation: "9 1B",
        timestamp: "2026-08-23T10:01:00.000Z",
      };
      updated = updateGameAfterEvent(updated, secondHit, { first: nextBatter.id, second: firstRunner.id, third: null }, 0);

      expect(updated.runners).toMatchObject({ first: nextBatter.id, second: firstRunner.id });
      expect(getRunnerSourceAtBat(updated.events, updated.specialEvents, updated.runners.first, { inning: 1, half: "away" })?.id).toBe("latest-1b");
      expect(getRunnerSourceAtBat(updated.events, updated.specialEvents, updated.runners.second, { inning: 1, half: "away" })?.id).toBe("source-1b");
      expect(getRunnerSourceAtBat(updated.events, updated.specialEvents, updated.runners.second, { inning: 1, half: "away" })?.notation).toBe("7 1B");
      expect(getLatestCompletedAtBat(updated.events, undefined, { inning: 1, half: "away" })?.id).toBe("latest-1b");
    });
  });
});

describe("單場早稻田紀錄表資料投影", () => {
  it("依本場先發棒次、候補首次上場時間與未上場背號排序球員", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const game = makeGame({
      name: "單場排序模擬",
      venue: "測試球場",
      date: "2026-08-18",
      awayTeamId: away.id,
      homeTeamId: home.id,
      awayRegisteredPlayerIds: away.players.slice(0, 6).map((player) => player.id),
      awayLineup: { battingOrderIds: [away.players[2].id, away.players[0].id, away.players[1].id], defensivePositions: {} },
      maxInnings: 6,
    });
    game.events = [{
      id: "early-sub-atbat",
      inning: 2,
      half: "away",
      batterId: away.players[3].id,
      pitcherId: home.players[0].id,
      result: "BB",
      notation: "B",
      pitches: { balls: 4, strikes: 0, total: 4 },
      outsBefore: 0,
      runsScored: 0,
      timestamp: "2026-08-18T09:01:00.000Z",
    }];
    game.substitutions = [{
      id: "later-substitution",
      inning: 2,
      half: "away",
      teamId: away.id,
      playerOutId: away.players[0].id,
      playerInId: away.players[4].id,
      position: "7",
      timestamp: "2026-08-18T09:02:00.000Z",
    }];

    expect(sortGameRosterForDisplay(game, away, "away").map((player) => player.id)).toEqual([
      away.players[2].id,
      away.players[0].id,
      away.players[1].id,
      away.players[3].id,
      away.players[4].id,
      away.players[5].id,
    ]);
  });

  it("合併同一球員同一局全部來源打席的SB、WP與PB跑壘資訊", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const baseEvent = (id: string, batterId: string, inning: number, timestamp: string, runnerAdvances: RunnerAdvanceRecord[] = []) => ({
      id,
      inning,
      half: "away" as const,
      batterId,
      pitcherId: home.players[0].id,
      result: "BB" as const,
      notation: "B",
      pitches: { balls: 4, strikes: 0, total: 4 },
      outsBefore: 0,
      runsScored: 0,
      runnerAdvances,
      timestamp,
    });
    const events = [
      baseEvent("source-sb", away.players[0].id, 3, "2026-08-18T10:00:00.000Z", [{ id: "sb", type: "SB" as const, fromBase: 1 as const, toBase: 2 as const, notation: "SB 1→2" }]),
      baseEvent("other-player", away.players[1].id, 3, "2026-08-18T10:01:00.000Z", [{ id: "other", type: "ADV" as const, fromBase: 1 as const, toBase: 2 as const, notation: "1→2" }]),
      baseEvent("source-wp-pb", away.players[0].id, 3, "2026-08-18T10:02:00.000Z", [
        { id: "wp", type: "WP" as const, fromBase: 2 as const, toBase: 3 as const, notation: "WP 2→3" },
        { id: "pb", type: "PB" as const, fromBase: 3 as const, toBase: 4 as const, notation: "PB 3→H" },
      ]),
      baseEvent("other-inning", away.players[0].id, 4, "2026-08-18T10:03:00.000Z"),
    ];

    const aggregate = aggregateInningRunnerEvents(events, away.players[0].id, 3);
    expect(aggregate?.id).toBe("source-wp-pb");
    expect(aggregate?.runnerAdvances?.map((advance) => advance.type)).toEqual(["SB", "WP", "PB"]);
  });

  it("逐球球數欄固定以兩個直式欄各容納7球，最多14球不溢出", () => {
    const [firstColumn, secondColumn] = splitPitchMarksForVerticalGrid("○●△×•⌒ー○●△×•⌒ー○●△×•⌒ー○●△×•⌒ー○●");
    expect(firstColumn).toHaveLength(7);
    expect(secondColumn).toHaveLength(7);
    expect([...firstColumn, ...secondColumn]).toHaveLength(14);
    expect([...firstColumn, ...secondColumn]).toEqual(Array.from("○●△×•⌒ー○●△×•⌒ー"));
  });

  it("門檻前三球依序呈現黃、橘、紅的漸進預警，達標後切換下一門檻", () => {
    expect(getPitchLimitWarning(47, [50, 70, 85])).toMatchObject({ level: "yellow", nextThreshold: 50 });
    expect(getPitchLimitWarning(48, [50, 70, 85])).toMatchObject({ level: "orange", nextThreshold: 50 });
    expect(getPitchLimitWarning(49, [50, 70, 85])).toMatchObject({ level: "red", nextThreshold: 50 });
    expect(getPitchLimitWarning(50, [50, 70, 85])).toMatchObject({ level: "none", nextThreshold: 70, reachedThresholds: [50] });
  });

  it("換投後保留每位投手的球數、下一門檻與已達門檻歷程", () => {
    const data = createInitialData();
    const away = data.teams[0];
    const home = data.teams[1];
    const game = makeGame({ name: "投手歷程", venue: "測試球場", date: "2026-08-18", awayTeamId: away.id, homeTeamId: home.id, pitchLimitThresholds: [50, 70, 85], maxInnings: 6 });
    game.events = [
      { id: "starter-49", inning: 1, half: "away", batterId: away.players[0].id, pitcherId: home.players[0].id, result: "BB", notation: "B", pitches: { balls: 4, strikes: 0, total: 49 }, outsBefore: 0, runsScored: 0, timestamp: "2026-08-18T09:00:00.000Z" },
      { id: "reliever-50", inning: 2, half: "away", batterId: away.players[1].id, pitcherId: home.players[1].id, result: "BB", notation: "B", pitches: { balls: 4, strikes: 0, total: 50 }, outsBefore: 0, runsScored: 0, timestamp: "2026-08-18T10:00:00.000Z" },
    ];
    expect(getPitcherPitchLimitHistories(game)).toEqual([
      { pitcherId: home.players[0].id, pitches: 49, nextThreshold: 50, reachedThresholds: [] },
      { pitcherId: home.players[1].id, pitches: 50, nextThreshold: 70, reachedThresholds: [50] },
    ]);
  });

  it("首頁守備配置固定引用使用者指定的棒球場俯視圖，且不會回退至舊別名資產", () => {
    const root = process.cwd();
    const screenSource = readFileSync(resolve(root, "app/(tabs)/index.tsx"), "utf8");
    const fieldCardStart = screenSource.indexOf("function FieldCard");
    const teamsViewStart = screenSource.indexOf("function TeamsView");
    const fieldCardSource = screenSource.slice(fieldCardStart, teamsViewStart);
    const assetSource = readFileSync(resolve(root, "constants/baseball-assets.ts"), "utf8");
    const fieldAsset = readFileSync(resolve(root, "assets/images/istockphoto-1269757192-612x612.jpg"));
    const imageHash = createHash("sha256").update(fieldAsset).digest("hex");

    expect(screenSource).toContain('import { HOME_DEFENSE_FIELD_IMAGE } from "@/constants/baseball-assets"');
    expect(fieldCardStart).toBeGreaterThan(-1);
    expect(teamsViewStart).toBeGreaterThan(fieldCardStart);
    expect(fieldCardSource).toContain("source={HOME_DEFENSE_FIELD_IMAGE}");
    expect(fieldCardSource).toContain('resizeMode="contain"');
    expect(fieldCardSource).toContain("style={styles.fieldCanvasLarge}");
    expect(fieldCardSource).toContain("imageStyle={styles.fieldCanvasLargeImage}");
    expect(fieldCardSource).toContain("首頁守備位置配置圖（使用者指定棒球場俯視圖）");
    expect(fieldCardSource).not.toContain("styles.fieldGrass");
    expect(fieldCardSource).not.toContain("styles.fieldDiamondLarge");
    expect(assetSource).toContain('HOME_DEFENSE_FIELD_IMAGE_PATH = "assets/images/istockphoto-1269757192-612x612.jpg"');
    expect(assetSource).toContain('require("../assets/images/istockphoto-1269757192-612x612.jpg")');
    expect(assetSource).toContain('HOME_DEFENSE_FIELD_IMAGE_SHA256 = "3e54016b59f580b01c1bfb4a207118ffac237cf6beefdb681b216472ce157b31"');
    expect(screenSource).not.toContain("home-defense-field.jpg");
    expect(imageHash).toBe("3e54016b59f580b01c1bfb4a207118ffac237cf6beefdb681b216472ce157b31");
    expect(existsSync(resolve(root, "assets/images/home-defense-field.jpg"))).toBe(false);
    expect(existsSync(resolve(root, "assets/images/user-provided-baseball-field.jpg"))).toBe(false);
    expect(existsSync(resolve(root, "assets/images/baseball-field-top-down.jpg"))).toBe(false);
  });
  it("球隊隊徽與自訂色會以最新時間戳合併，避免雲端同步遺失球隊識別", () => {
    const seed = createInitialData();
    const teamId = seed.teams[0].id;
    const local = {
      ...seed,
      teams: seed.teams.map((team) => team.id === teamId ? { ...team, logoUri: "file:///old-logo.jpg", customColor: "#1D5FA7", updatedAt: "2026-08-20T08:00:00.000Z" } : team),
    };
    const remote = {
      ...seed,
      teams: seed.teams.map((team) => team.id === teamId ? { ...team, logoUri: "file:///new-logo.jpg", customColor: "#0F766E", updatedAt: "2026-08-21T08:00:00.000Z" } : team),
    };
    const merged = mergeAppData(local, remote);
    expect(merged.teams.find((team) => team.id === teamId)).toMatchObject({ logoUri: "file:///new-logo.jpg", customColor: "#0F766E" });
  });
  it("首頁守備標記短按顯示球員資訊、長按維持守位指派，並在主要工作台使用隊徽與淡色主客場辨識", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    const fieldCardStart = source.indexOf("function FieldCard");
    const teamsViewStart = source.indexOf("function TeamsView");
    const fieldCardSource = source.slice(fieldCardStart, teamsViewStart);
    expect(fieldCardSource).toContain("onOpenPlayerInfo(assigned");
    expect(fieldCardSource).toContain("onLongPress={() => onAssign(node.number)}");
    expect(source).toContain("function TeamLogoName");
    expect(source).toContain("launchImageLibraryAsync");
    expect(source).toContain("manipulateAsync");
    expect(source).toContain("teamSurfaceColor(away, \"away\")");
    expect(source).toContain("teamSurfaceColor(home, \"home\")");
    expect(source).toContain("<TeamLogoName team={primaryTeam}");
  });
  it("隊徽品牌設定提供多色票、對比度提示、移除與還原預設，並把隊色套用至主要紀錄區", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(source).toContain("function getLogoColorSuggestions");
    expect(source).toContain("function colorContrastRatio");
    expect(source).toContain("function getContrastHint");
    expect(source).toContain("依隊徽建議色票");
    expect(source).toContain("還原預設圖案");
    expect(source).toContain("移除隊徽");
    expect(source).toContain("logoUri: undefined, customColor: undefined");
    expect(source).toContain("teamSurfaceColor(battingTeam, game.half)");
    expect(source).toContain("backgroundColor: teamSurfaceColor(selectedScorebook.team, selectedScorebook.side)");
    expect(source).toContain("borderColor: teamAccentColor(selectedScorebook.team, selectedScorebook.side)");
  });
  it("自訂配色可安全匯出與匯入 bsp-palette-1 JSON 色票，並保留原生與網頁相容分支", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(source).toContain('type PaletteTransferPayload');
    expect(source).toContain('version: "bsp-palette-1"');
    expect(source).toContain("function parsePaletteTransfer");
    expect(source).toContain("FileSystem.writeAsStringAsync");
    expect(source).toContain("Sharing.shareAsync");
    expect(source).toContain("DocumentPicker.getDocumentAsync");
    expect(source).toContain('type: "application/json"');
    expect(source).toContain("匯出色票 ↑");
    expect(source).toContain("匯入色票 ↓");
  });
  it("球員背號與姓名後使用共用投打縮寫，並覆蓋即時、名單、單場、統計與換人工作台", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(source).toContain("function playerHandAbbr");
    expect(source).toContain("function playerIdentityLabel");
    expect(source).toContain('`${player?.throwingHand ?? "?"}${player?.battingHand ?? "?"}`');
    expect(source).toContain("playerIdentityLabel(batter, \"#— 尚未設定\")");
    expect(source).toContain("playerIdentityLabel(pitcher, \"#— 尚未設定\")");
    expect(source).toContain("playerIdentityLabel(row.player)");
    expect(source).toContain("player.name} {playerHandAbbr(player)}");
    expect(source).toContain("candidate.name} {playerHandAbbr(candidate)}");
  });
  it("1.1.2 設定中心提供雲端帳號、球隊、七種配色與受倒數保護的初始設定還原", () => {
    const root = process.cwd();
    const source = readFileSync(resolve(root, "app/(tabs)/index.tsx"), "utf8");
    const themeSource = readFileSync(resolve(root, "lib/theme-provider.tsx"), "utf8");
    const appConfig = readFileSync(resolve(root, "app.config.ts"), "utf8");
    const packageJson = readFileSync(resolve(root, "package.json"), "utf8");

    expect(source).toContain("function SoftwareSettingsModal");
    expect(source).toContain('accessibilityLabel="開啟軟體設定"');
    expect(source).toContain("帳號與雲端資料");
    expect(source).toContain("立即同步");
    expect(source).toContain("同步範圍：球隊、隊徽、球員資料、場次、早稻田逐球紀錄與個人統計。");
    expect(source).toContain("球隊設定");
    expect(source).toContain("介面配色");
    expect(source).toContain("還原初始設定");
    expect(source).toContain('confirmText.trim() === "還原"');
    expect(source).toContain("setCountdown(6)");
    expect(source).toContain("restoreInitialSettings");
    expect(themeSource).toContain('id: "original"');
    expect(themeSource).toContain('id: "vivid"');
    expect(themeSource).toContain('id: "colorful"');
    expect(themeSource).toContain('id: "deep"');
    expect(themeSource).toContain('id: "grayscale"');
    expect(themeSource).toContain('id: "custom"');
    expect(themeSource).toContain("THEME_STORAGE_KEY");
    expect(appConfig).toContain('version: "1.1.2"');
    expect(packageJson).toContain('"version": "1.1.2"');
  });
  it("首頁移除不必要的紀錄法與驗證匯入提示卡，保留符號學習工具", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(source).not.toContain("棒球紀錄法已啟用");
    expect(source).not.toContain("已驗證紀錄匯入");
    expect(source).toContain("早稻田符號學習工具");
    expect(source).toContain("符號速查表");
    expect(source).toContain("新手教學");
  });
  it("所屬球隊建立精靈可收集隊名、隊徽、層級、投打資訊與最多四個慣用守位", () => {
    const root = process.cwd();
    const source = readFileSync(resolve(root, "app/(tabs)/index.tsx"), "utf8");
    const typesSource = readFileSync(resolve(root, "lib/baseball/types.ts"), "utf8");

    expect(source).toContain("function PrimaryTeamWizard");
    expect(source).toContain("建立所屬球隊");
    expect(source).toContain("隊伍名稱");
    expect(source).toContain("球隊層級");
    expect(source).toContain("隊徽（可選）");
    expect(source).toContain("逐位設定姓名、背號、投打慣用手與最多四個慣用守位");
    expect(source).toContain("if (selected.includes(position))");
    expect(source).toContain("selected.filter((item) => item !== position)");
    expect(source).toContain("if (selected.length >= 4)");
    expect(source).toContain("最多四個慣用守位");
    expect(source).toContain("onCreatePrimaryTeam");
    expect(typesSource).toContain("preferredPositions?: string[]");
    expect(typesSource).toContain("level?: AgeGroup");
  });
  it("色票匯入會先預覽來源色塊，僅在確認後才覆寫目前自訂配色", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(source).toContain("setPendingPalette(parsed)");
    expect(source).toContain("預覽匯入色票");
    expect(source).toContain("確認後才會覆寫目前的自訂配色");
    expect(source).toContain("來源色票");
    expect(source).toContain("確認套用色票");
    expect(source).toContain("onSetCustomColor(pendingPalette.customColor)");
    expect(source).toContain("setPendingPalette(null)");
  });
  it("所屬球隊精靈可由棒球場圖直接點選慣用守位，並保留四個守位上限", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(source).toContain("function PreferredPositionFieldPicker");
    expect(source).toContain('accessibilityLabel={`選擇${position?.label ?? spot.number}守備位置`}');
    expect(source).toContain("onToggle(spot.number)");
    expect(source).toContain("<PreferredPositionFieldPicker selectedPositions={activePlayer.preferredPositions} onToggle={togglePosition} />");
    expect(source).toContain("已選 {selectedPositions.length}/4");
  });
  it("守備配置可取消全部目前守位，且個人常用守位獨立於目前守備位置並可選滿四個", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(source).toContain('label="取消所有守備位置"');
    expect(source).toContain("onClearDefense={clearAllDefensivePositions}");
    expect(source).toContain('position: "後備"');
    expect(source).toContain('label="常用守備位置"');
    expect(source).toContain("preferredPositions: normalizePreferredPositions(player.preferredPositions)");
    expect(source).not.toContain('preferredPositions: player.preferredPositions ?? (player.position');
    expect(source).toContain("if (selectedPositions.length >= 4)");
  });
  it("球員詳情的守備位置欄位會唯讀顯示 A 區選定的精簡常用守位摘要", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(source).toContain("function preferredPositionSummary");
    expect(source).toContain('投手: "投", 捕手: "捕", 一壘手: "一", 二壘手: "二", 三壘手: "三", 游擊手: "游", 左外野手: "左", 中外野手: "中", 右外野手: "右"');
    expect(source).toContain('return position ? `${position.number}${shortLabels[position.label] ?? position.label}` : number;');
    expect(source).toContain('}).join("／");');
    expect(source).toContain('if (!positions.length) return "尚未設定";');
    expect(source).toContain('accessibilityLabel={`守備位置：${preferredPositionSummary(selectedPlayer)}`}');
    expect(source).toContain("styles.playerPreferredPositionsReadout");
    expect(source).not.toContain('TextInput value={selectedPlayer.position}');
  });
  it("棒次排定後固定顯示球員背號與姓名", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(source).toContain('player ? `#${player.number} ${player.name}` : "未排"');
    expect(source).toContain('<Text numberOfLines={1} style={styles.lineupPreviewPlayer}>{player ? `#${player.number} ${player.name}` : "未排"}</Text>');
  });
  it("新增場次可拖曳球員卡重排棒次並拖放至目標守位", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(source).toContain("createBattingDragResponder");
    expect(source).toContain("moveBattingOrderByDrag");
    expect(source).toContain("battingDropTargets.current[side][order]");
    expect(source).toContain("createDefenseDragResponder");
    expect(source).toContain("dropDefenseCard");
    expect(source).toContain("defensiveDropTargets.current[side][position.number]");
    expect(source).toContain("直接拖拉下方球員卡到目標守位");
    expect(source).toContain("可直接拖拉已排定的球員卡至目標棒次");
    expect(source).toContain("playerIdentityLabel(player)");
    expect(source).toContain("lineupDraggingCard");
  });
  it("投球九宮格在逐球序號旁疊加早稻田結果符號，首頁教學卡提供新增球隊精靈入口", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    const pitchHistorySource = readFileSync(resolve(process.cwd(), "lib/baseball/pitch-history.ts"), "utf8");

    expect(pitchHistorySource).toContain("outcome: pitch.outcome");
    expect(source).toContain("getWasedaPitchMark(pitch.outcome)");
    expect(source).toContain("PITCH_SYMBOL_HELP[pitch.outcome].mark");
    expect(source).toContain("zonePickerPitchDotText");
    expect(source).toContain("新增球隊");
    expect(source).toContain("onCreatePrimaryTeam");
    expect(source).toContain("新手教學");
  });
  it("新增球隊完成後顯示名單完整度摘要與非阻斷式資料提醒", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(source).toContain("function getRosterCompleteness");
    expect(source).toContain("已建立名單完整度摘要");
    expect(source).toContain("重複背號");
    expect(source).toContain("尚未設定投打");
    expect(source).toContain("尚未設定慣用守位");
    expect(source).toContain("建立完成，已設為所屬球隊");
    expect(source).toContain("result !== false");
  });
});
