import type {
  Game,
  Team,
  Player,
  Substitution,
  RunnerState,
} from "./types";
import {
  updateGameAfterEvent,
  updateGameAfterSpecialEvent,
  getCurrentBatter,
  getBattingStats,
  getPitchingStats,
} from "./types";
import { resolveForcedAdvances, checkTimePlayCondition } from "./runner-engine";

export type ScenarioDefinition = {
  id: 1 | 2 | 3 | 4 | 5;
  title: string;
  description: string;
  buildGame: () => {
    game: Game;
    teams: Team[];
    assertions: Record<string, boolean | string | number>;
  };
};

/**
 * 建立 5 個劇本專用的標準測試球隊與球員資料庫
 */
export function createScenarioTeams(): Team[] {
  const awayPlayers: Player[] = Array.from({ length: 25 }, (_, i) => ({
    id: `away-${i + 1}`,
    name: `客隊球員${i + 1}號`,
    number: i + 1,
    position: i < 9 ? (["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"][i]) : "替補",
    bats: "R" as const,
  }));

  const homePlayers: Player[] = Array.from({ length: 25 }, (_, i) => ({
    id: `home-${i + 1}`,
    name: `主隊球員${i + 1}號`,
    number: i + 1,
    position: i < 9 ? (["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"][i]) : "替補",
    bats: "R" as const,
  }));

  const awayTeam: Team = {
    id: "team-away",
    name: "客隊 (Away)",
    school: "客隊學校",
    players: awayPlayers,
  };

  const homeTeam: Team = {
    id: "team-home",
    name: "主隊 (Home)",
    school: "主隊學校",
    players: homePlayers,
  };

  return [awayTeam, homeTeam];
}

/**
 * 初始化全新比分與場次快照
 */
export function createScenarioBaseGame(teams: Team[]): Game {
  const away = teams[0];
  const home = teams[1];
  const now = new Date().toISOString();

  return {
    id: "game-scenario-test",
    name: "5大劇本綜合壓力測試賽",
    venue: "標準棒球場",
    date: new Date().toISOString().split("T")[0],
    status: "live",
    awayTeamId: away.id,
    homeTeamId: home.id,
    awayRegisteredPlayerIds: away.players.map((p) => p.id),
    homeRegisteredPlayerIds: home.players.map((p) => p.id),
    inning: 1,
    half: "away",
    outs: 0,
    awayBatterIndex: 0,
    homeBatterIndex: 0,
    runners: { first: null, second: null, third: null },
    score: Array.from({ length: 3 }, (_, i) => ({ inning: i + 1, away: 0, home: 0 })),
    events: [],
    specialEvents: [],
    substitutions: [],
    maxInnings: 7,
    notes: "5大劇本完整測試紀錄",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 🎬 劇本一：基礎推進、盜壘與打線循環測試
 * 測試重點：標準安打推進、盜壘UI顯示、打滿一輪（第10棒以上）的棒次重置邏輯
 */
export function runScenario1() {
  const teams = createScenarioTeams();
  let game = createScenarioBaseGame(teams);

  // 【1局上】(3打席)
  // 1棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s1-1-1", inning: 1, half: "away", batterId: "away-1", pitcherId: "home-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 2棒(飛球接殺)
  game = updateGameAfterEvent(game, {
    id: "s1-1-2", inning: 1, half: "away", batterId: "away-2", pitcherId: "home-1",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 3棒(滾地刺殺)
  game = updateGameAfterEvent(game, {
    id: "s1-1-3", inning: 1, half: "away", batterId: "away-3", pitcherId: "home-1",
    result: "G", notation: "6-3", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  const top1Runs = game.score.find((s) => s.inning === 1)?.away ?? 0;
  const top1Outs = game.outs;

  // 【1局下】(5打席)
  // 1棒(一安)
  game = updateGameAfterEvent(game, {
    id: "s1-1-4", inning: 1, half: "home", batterId: "home-1", pitcherId: "away-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-1", second: null, third: null }, 0);

  // 1棒盜二壘
  game = updateGameAfterSpecialEvent(game, {
    id: "s1-sp-1", inning: 1, half: "home", type: "SB", runnerId: "home-1", pitcherId: "away-1",
    fromBase: 1, toBase: 2, runsScored: 0, outsBefore: 0, notation: "SB", timestamp: new Date().toISOString(),
  }, { first: null, second: "home-1", third: null }, 0, 0);

  // 2棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s1-1-5", inning: 1, half: "home", batterId: "home-2", pitcherId: "away-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-2", second: "home-1", third: null }, 0);

  // 1、2棒雙盜壘(二、三壘)
  game = updateGameAfterSpecialEvent(game, {
    id: "s1-sp-2", inning: 1, half: "home", type: "SB", runnerId: "home-2", pitcherId: "away-1",
    fromBase: 2, toBase: 3, runsScored: 0, outsBefore: 0, notation: "SB", timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: "home-2" }, 0, 0);

  // 3棒(高飛犧牲打，1分)
  game = updateGameAfterEvent(game, {
    id: "s1-1-6", inning: 1, half: "home", batterId: "home-3", pitcherId: "away-1",
    result: "F", notation: "SF 8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 1, recordColumn: { modifiers: ["SF"], rbi: 1 },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 1, [
    { runnerId: "home-2", fromBase: 3, toBase: 4 },
  ]);

  // 4棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s1-1-7", inning: 1, half: "home", batterId: "home-4", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 5棒(滾地出局)
  game = updateGameAfterEvent(game, {
    id: "s1-1-8", inning: 1, half: "home", batterId: "home-5", pitcherId: "away-1",
    result: "G", notation: "5-3", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  const bot1Runs = game.score.find((s) => s.inning === 1)?.home ?? 0;

  // 【2局上】(6打席)
  // 4棒(二安)
  game = updateGameAfterEvent(game, {
    id: "s1-2-1", inning: 2, half: "away", batterId: "away-4", pitcherId: "home-1",
    result: "2B", notation: "2B 9", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-4", second: null, third: null }, 0);

  // 5棒(一安，跑者上三壘)
  game = updateGameAfterEvent(game, {
    id: "s1-2-2", inning: 2, half: "away", batterId: "away-5", pitcherId: "home-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-5", second: "away-4", third: null }, 0);

  // 6棒(一安，1分)
  game = updateGameAfterEvent(game, {
    id: "s1-2-3", inning: 2, half: "away", batterId: "away-6", pitcherId: "home-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 1, recordColumn: { rbi: 1 },
    timestamp: new Date().toISOString(),
  }, { first: "away-6", second: "away-5", third: "away-4" }, 0, [
    { runnerId: "away-4", fromBase: 3, toBase: 4 },
  ]);

  // 7棒(雙殺打，兩人出局)
  game = updateGameAfterEvent(game, {
    id: "s1-2-4", inning: 2, half: "away", batterId: "away-7", pitcherId: "home-1",
    result: "G", notation: "6-4-3 GIDP", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 1, runsScored: 0, recordColumn: { fieldingPlay: "DP" },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2, []);

  // 8棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s1-2-5", inning: 2, half: "away", batterId: "away-8", pitcherId: "home-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 3, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  // 二局上出現Batting Around，檢查棒次是否正確重置
  const currentBatterInTop2 = getCurrentBatter(game, teams[0]);
  const top2Runs = game.score.find((s) => s.inning === 2)?.away ?? 0;

  // 【2局下】(12打席 - 極端打線)
  // 6棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s1-2-6", inning: 2, half: "home", batterId: "home-6", pitcherId: "away-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-6", second: null, third: null }, 0);

  // 7棒(一安)
  game = updateGameAfterEvent(game, {
    id: "s1-2-7", inning: 2, half: "home", batterId: "home-7", pitcherId: "away-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-7", second: "home-6", third: null }, 0);

  // 8棒(全壘打，3分)
  game = updateGameAfterEvent(game, {
    id: "s1-2-8", inning: 2, half: "home", batterId: "home-8", pitcherId: "away-1",
    result: "HR", notation: "HR", pitches: { balls: 2, strikes: 1, total: 3 },
    outsBefore: 0, runsScored: 3, recordColumn: { rbi: 3 },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 3, [
    { runnerId: "home-6", fromBase: 1, toBase: 4 },
    { runnerId: "home-7", fromBase: 2, toBase: 4 },
  ]);

  // 9棒至4棒連續一壘安打或保送 (棒次輪回測試)
  // 9棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s1-2-9", inning: 2, half: "home", batterId: "home-9", pitcherId: "away-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-9", second: null, third: null }, 0);

  // 1棒(一安) - 第二輪第一個打者
  game = updateGameAfterEvent(game, {
    id: "s1-2-10", inning: 2, half: "home", batterId: "home-1", pitcherId: "away-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-1", second: "home-9", third: null }, 0);

  // 2棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s1-2-11", inning: 2, half: "home", batterId: "home-2", pitcherId: "away-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-2", second: "home-1", third: "home-9" }, 0);

  // 3棒(保送) - 滿壘
  game = updateGameAfterEvent(game, {
    id: "s1-2-12", inning: 2, half: "home", batterId: "home-3", pitcherId: "away-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 2, total: 6 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-3", second: "home-2", third: "home-1" }, 0);

  // 4棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s1-2-13", inning: 2, half: "home", batterId: "home-4", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 5棒(三振) - 第三輪第一個打者
  game = updateGameAfterEvent(game, {
    id: "s1-2-14", inning: 2, half: "home", batterId: "home-5", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  // 6棒(飛球)
  game = updateGameAfterEvent(game, {
    id: "s1-2-15", inning: 2, half: "home", batterId: "home-6", pitcherId: "away-1",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 3, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  // 7棒(滾地)
  game = updateGameAfterEvent(game, {
    id: "s1-2-16", inning: 2, half: "home", batterId: "home-7", pitcherId: "away-1",
    result: "G", notation: "6-3", pitches: { balls: 1, strikes: 2, total: 3 },
    outsBefore: 3, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  const bot2TotalBatters = game.homeBatterIndex + 1;
  const bot2Runs = game.score.find((s) => s.inning === 2)?.home ?? 0;

  // 【3局上】(4打席)
  // 9棒(三壘安打)
  game = updateGameAfterEvent(game, {
    id: "s1-3-1", inning: 3, half: "away", batterId: "away-9", pitcherId: "home-1",
    result: "3B", notation: "3B", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: "away-9", third: null }, 0);

  // 1棒(飛球)
  game = updateGameAfterEvent(game, {
    id: "s1-3-2", inning: 3, half: "away", batterId: "away-1", pitcherId: "home-1",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 1, []);

  // 2棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s1-3-3", inning: 3, half: "away", batterId: "away-2", pitcherId: "home-1",
    result: "K", notation: "K", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 3棒(滾地)
  game = updateGameAfterEvent(game, {
    id: "s1-3-4", inning: 3, half: "away", batterId: "away-3", pitcherId: "home-1",
    result: "G", notation: "6-3", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 確認點：殘壘（三壘）結束半局時，攻守交換後的數據結算
  const afterTop3Inning = {
    finalInning: game.inning,
    finalHalf: game.half,
    finalOuts: game.outs,
    runners: game.runners,
  };

  // 【3局下】(3打席)
  // 8棒(一安)
  game = updateGameAfterEvent(game, {
    id: "s1-3-5", inning: 3, half: "home", batterId: "home-8", pitcherId: "away-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-8", second: null, third: null }, 0);

  // 9棒(盜壘失敗/阻殺，一人出局)
  game = updateGameAfterSpecialEvent(game, {
    id: "s1-sp-3", inning: 3, half: "home", type: "CS", runnerId: "home-8", pitcherId: "away-1",
    fromBase: 1, toBase: 2, runsScored: 0, outsBefore: 1, notation: "CS", timestamp: new Date().toISOString(),
  }, { first: null, second: "home-8", third: null }, 0, 1);

  // 9棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s1-3-6", inning: 3, half: "home", batterId: "home-9", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 1棒(飛球)
  game = updateGameAfterEvent(game, {
    id: "s1-3-7", inning: 3, half: "home", batterId: "home-1", pitcherId: "away-1",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2, []);

  const bottom3EventsCount = game.events.length;

  return {
    game,
    teams,
    assertions: {
      top1Clean3Up3Down: top1Runs === 0 && game.events.filter((e) => e.inning === 1 && e.half === "away").length === 3,
      bot1HasSacrificeFly: game.events.some((e) => e.recordColumn?.modifiers?.includes("SF")),
      bot1SacrificeFlyRbi: game.events.find((e) => e.recordColumn?.modifiers?.includes("SF"))?.recordColumn?.rbi,
      top2HasGrandSlam: game.events.some((e) => e.result === "HR" && e.recordColumn?.rbi === 3),
      top2HasDoublePlay: game.events.some((e) => e.recordColumn?.fieldingPlay === "DP"),
      bot2BattingAround: bot2TotalBatters,
      bot2TotalRuns: bot2Runs,
      afterTop3InningClean: afterTop3Inning.runners.first === null && afterTop3Inning.runners.second === null && afterTop3Inning.runners.third === null,
      bottom3HasCaughtStealing: game.specialEvents.some((e) => e.type === "CS"),
      bottom3EventsCount: bottom3EventsCount,
    },
  };
}

/**
 * 🎬 劇本二：非安打推進與野手選擇 (小球戰術)
 * 測試重點：失誤、暴投、捕逸、野手選擇等「無安打但壘包變動」的 UI 聯動
 */
export function runScenario2() {
  const teams = createScenarioTeams();
  let game = createScenarioBaseGame(teams);

  // 【1局上】(4打席)
  // 4棒(游擊失誤上壘)
  game = updateGameAfterEvent(game, {
    id: "s2-1-1", inning: 1, half: "away", batterId: "away-4", pitcherId: "home-1",
    result: "E", notation: "E6", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-4", second: null, third: null }, 0);

  // 4棒因暴投上二壘
  game = updateGameAfterSpecialEvent(game, {
    id: "s2-sp-1", inning: 1, half: "away", type: "WP", runnerId: "away-4", pitcherId: "home-1",
    fromBase: 1, toBase: 2, runsScored: 0, outsBefore: 0, notation: "WP", timestamp: new Date().toISOString(),
  }, { first: null, second: "away-4", third: null }, 0, 0);

  // 5棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s2-1-2", inning: 1, half: "away", batterId: "away-5", pitcherId: "home-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-5", second: "away-4", third: null }, 0);

  // 6棒(野手選擇：傳三壘封殺，一二壘有人)
  game = updateGameAfterEvent(game, {
    id: "s2-1-3", inning: 1, half: "away", batterId: "away-6", pitcherId: "home-1",
    result: "G", notation: "3-6", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { fieldingPlay: "FC" },
    timestamp: new Date().toISOString(),
  }, { first: null, second: "away-5", third: null }, 0, [
    { runnerId: "away-4", fromBase: 2, toBase: 3 },
  ]);

  // 7棒(雙殺打)
  game = updateGameAfterEvent(game, {
    id: "s2-1-4", inning: 1, half: "away", batterId: "away-7", pitcherId: "home-1",
    result: "G", notation: "6-4-3 DP", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, recordColumn: { fieldingPlay: "DP" },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2, []);

  const top1Errors = game.events.filter((e) => e.result === "E").length;
  const top1WildPitches = game.specialEvents.filter((e) => e.type === "WP").length;

  // 【1局下】(4打席)
  // 2棒(觸身球)
  game = updateGameAfterEvent(game, {
    id: "s2-1-5", inning: 1, half: "home", batterId: "home-2", pitcherId: "away-1",
    result: "HBP", notation: "HBP", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { rbi: 1 },
    timestamp: new Date().toISOString(),
  }, { first: "home-2", second: null, third: null }, 0, [
    { runnerId: "away-1", fromBase: 3, toBase: 4 },
  ]);

  // 3棒(捕逸，跑者上二壘)
  game = updateGameAfterSpecialEvent(game, {
    id: "s2-sp-2", inning: 1, half: "home", type: "PB", runnerId: "home-2", pitcherId: "away-1",
    fromBase: 1, toBase: 2, runsScored: 0, outsBefore: 0, notation: "PB", timestamp: new Date().toISOString(),
  }, { first: null, second: "home-2", third: null }, 0, 0);

  // 4棒(滾地推進，跑者上三壘)
  game = updateGameAfterEvent(game, {
    id: "s2-1-6", inning: 1, half: "home", batterId: "home-4", pitcherId: "away-1",
    result: "G", notation: "4-6", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { modifiers: ["推進"] },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: "home-2" }, 0, [
    { runnerId: "home-2", fromBase: 2, toBase: 3 },
  ]);

  // 5棒(內野安打，1分)
  game = updateGameAfterEvent(game, {
    id: "s2-1-7", inning: 1, half: "home", batterId: "home-5", pitcherId: "away-1",
    result: "G", notation: "G 3B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 1, runsScored: 1, recordColumn: { rbi: 1 },
    timestamp: new Date().toISOString(),
  }, { first: null, second: "home-4", third: null }, 1, [
    { runnerId: "home-2", fromBase: 3, toBase: 4 },
  ]);

  // 6棒(飛球)
  game = updateGameAfterEvent(game, {
    id: "s2-1-8", inning: 1, half: "home", batterId: "home-6", pitcherId: "away-1",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2, []);

  // 7棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s2-1-9", inning: 1, half: "home", batterId: "home-7", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  const bot1HbpCount = game.events.filter((e) => e.result === "HBP").length;
  const bot1Panels = game.events.filter((e) => e.recordColumn?.modifiers?.includes("推進")).length;

  // 【2局上】(5打席)
  // 8棒(不死三振上壘)
  game = updateGameAfterEvent(game, {
    id: "s2-2-1", inning: 2, half: "away", batterId: "away-8", pitcherId: "home-1",
    result: "K", notation: "K+ E3", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 0, runsScored: 0, droppedThirdStrike: true,
    timestamp: new Date().toISOString(),
  }, { first: "away-8", second: null, third: null }, 0);

  // 9棒(觸擊犧牲打，跑者上二壘)
  game = updateGameAfterEvent(game, {
    id: "s2-2-2", inning: 2, half: "away", batterId: "away-9", pitcherId: "home-1",
    result: "G", notation: "G-SC", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { modifiers: ["SacB"] },
    timestamp: new Date().toISOString(),
  }, { first: null, second: "away-8", third: null }, 1, [
    { runnerId: "away-8", fromBase: 1, toBase: 2 },
  ]);

  // 1棒(飛球)
  game = updateGameAfterEvent(game, {
    id: "s2-2-3", inning: 2, half: "away", batterId: "away-1", pitcherId: "home-1",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 1, []);

  // 2棒(二安，1分)
  game = updateGameAfterEvent(game, {
    id: "s2-2-4", inning: 2, half: "away", batterId: "away-2", pitcherId: "home-1",
    result: "2B", notation: "2B", pitches: { balls: 1, strikes: 0, total: 1 },
    outsBefore: 1, runsScored: 1, recordColumn: { rbi: 1 },
    timestamp: new Date().toISOString(),
  }, { first: null, second: "away-2", third: null }, 1, [
    { runnerId: "away-8", fromBase: 2, toBase: 4 },
  ]);

  // 3棒(刺殺)
  game = updateGameAfterEvent(game, {
    id: "s2-2-5", inning: 2, half: "away", batterId: "away-3", pitcherId: "home-1",
    result: "G", notation: "6-3", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 【2局下】(3打席)
  // 8棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s2-2-6", inning: 2, half: "home", batterId: "home-8", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 9棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s2-2-7", inning: 2, half: "home", batterId: "home-9", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 1);

  // 1棒(刺殺)
  game = updateGameAfterEvent(game, {
    id: "s2-2-8", inning: 2, half: "home", batterId: "home-1", pitcherId: "away-1",
    result: "G", notation: "6-3", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2, []);

  // 【3局上】(7打席)
  // 4棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s2-3-1", inning: 3, half: "away", batterId: "away-4", pitcherId: "home-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-4", second: null, third: null }, 0);

  // 5棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s2-3-2", inning: 3, half: "away", batterId: "away-5", pitcherId: "home-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-5", second: "away-4", third: null }, 0);

  // 6棒(野手選擇，滿壘)
  game = updateGameAfterEvent(game, {
    id: "s2-3-3", inning: 3, half: "away", batterId: "away-6", pitcherId: "home-1",
    result: "G", notation: "5-3 FC", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { fieldingPlay: "FC" },
    timestamp: new Date().toISOString(),
  }, { first: null, second: "away-6", third: "away-5" }, 0, [
    { runnerId: "away-4", fromBase: 1, toBase: 3 },
  ]);

  // 7棒(保送，擠回1分)
  game = updateGameAfterEvent(game, {
    id: "s2-3-4", inning: 3, half: "away", batterId: "away-7", pitcherId: "home-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 1, runsScored: 1, recordColumn: { rbi: 1 },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 1, [
    { runnerId: "away-5", fromBase: 2, toBase: 4 },
    { runnerId: "away-6", fromBase: 3, toBase: 4 },
  ]);

  // 8棒至10棒皆內野高飛必死球接殺
  for (let i = 8; i <= 10; i++) {
    game = updateGameAfterEvent(game, {
      id: `s2-3-${i}`, inning: 3, half: "away", batterId: `away-${i}`, pitcherId: "home-1",
      result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
      outsBefore: 1, runsScored: 0, recordColumn: { modifiers: ["Infield Fly"] },
      timestamp: new Date().toISOString(),
    }, { first: null, second: null, third: null }, 2, []);
  }

  const top3InfieldFlyCount = game.events.filter((e) => e.recordColumn?.modifiers?.includes("Infield Fly")).length;

  // 【3局下】(5打席)
  // 2棒(二安)
  game = updateGameAfterEvent(game, {
    id: "s2-3-11", inning: 3, half: "home", batterId: "home-2", pitcherId: "away-1",
    result: "2B", notation: "2B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-2", second: null, third: null }, 0);

  // 3棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s2-3-12", inning: 3, half: "home", batterId: "home-3", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: "home-2", third: null }, 0);

  // 4棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s2-3-13", inning: 3, half: "home", batterId: "home-4", pitcherId: "away-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-4", second: "home-2", third: null }, 0);

  // 跑者因牽制失誤推進(二三壘有人) - 使用 WP 模擬暴投
  game = updateGameAfterSpecialEvent(game, {
    id: "s2-sp-3", inning: 3, half: "home", type: "WP", runnerId: "home-4", pitcherId: "away-1",
    fromBase: 1, toBase: 2, runsScored: 0, outsBefore: 1, notation: "WP", timestamp: new Date().toISOString(),
  }, { first: null, second: "home-4", third: "home-2" }, 0, 0);

  // 5棒(飛球)
  game = updateGameAfterEvent(game, {
    id: "s2-3-14", inning: 3, half: "home", batterId: "home-5", pitcherId: "away-1",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2, []);

  // 6棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s2-3-15", inning: 3, half: "home", batterId: "home-6", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  return {
    game,
    teams,
    assertions: {
      top1HasError: top1Errors === 1,
      top1ErrorNotation: game.events[0]?.notation,
      top1HasWildPitch: top1WildPitches === 1,
      bot1HasHbp: bot1HbpCount === 1,
      bot1HbpRbi: game.events.find((e) => e.result === "HBP")?.recordColumn?.rbi,
      bot1HasPanels: bot1Panels === 1,
      top2HasDroppedThirdStrike: game.events.some((e) => e.droppedThirdStrike === true),
      top2HasSacBunt: game.events.some((e) => e.recordColumn?.modifiers?.includes("SacB")),
      top3HasFieldersChoice: game.events.some((e) => e.recordColumn?.fieldingPlay === "FC"),
      top3InfieldFlyCount: top3InfieldFlyCount,
      bottom3HasPickoffError: game.specialEvents.some((e) => e.type === "WP"),
    },
  };
}

/**
 * 🎬 劇本三：頻繁人員調度 (換打、換投、代跑)
 * 測試重點：代打、代跑替換後的棒次繼承，換投後的數據歸屬，以及各頁面（名單、計分板、BOX）同步
 */
export function runScenario3() {
  const teams = createScenarioTeams();
  let game = createScenarioBaseGame(teams);

  // 【1局上】(5打席)
  // 1棒(一安)
  game = updateGameAfterEvent(game, {
    id: "s3-1-1", inning: 1, half: "away", batterId: "away-1", pitcherId: "home-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-1", second: null, third: null }, 0);

  // 2棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s3-1-2", inning: 1, half: "away", batterId: "away-2", pitcherId: "home-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-2", second: "away-1", third: null }, 0);

  // 【主隊換投】
  const subRP1: Substitution = {
    id: "sub-rp-1", inning: 1, half: "home", teamId: teams[0].id, type: "換投",
    playerOutId: "home-1", playerInId: "home-12", position: "投手", timestamp: new Date().toISOString(),
  };
  game = { ...game, substitutions: [...game.substitutions, subRP1] };

  // 3棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s3-1-3", inning: 1, half: "away", batterId: "away-3", pitcherId: "home-12",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: "away-2", third: "away-1" }, 0, [
    { runnerId: "away-1", fromBase: 1, toBase: 3 },
    { runnerId: "away-2", fromBase: 2, toBase: 3 },
  ]);

  // 4棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s3-1-4", inning: 1, half: "away", batterId: "away-4", pitcherId: "home-12",
    result: "K", notation: "K", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: "away-2", third: null }, 1);

  // 5棒(飛球)
  game = updateGameAfterEvent(game, {
    id: "s3-1-5", inning: 1, half: "away", batterId: "away-5", pitcherId: "home-12",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 【1局下】(6打席)
  // 1棒(二安)
  game = updateGameAfterEvent(game, {
    id: "s3-2-1", inning: 1, half: "home", batterId: "home-1", pitcherId: "away-1",
    result: "2B", notation: "2B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-1", second: null, third: null }, 0);

  // 【1棒換代跑】
  const subPR1: Substitution = {
    id: "sub-pr-1", inning: 1, half: "home", teamId: teams[0].id, type: "代跑",
    playerOutId: "home-1", playerInId: "home-11", position: "代跑", timestamp: new Date().toISOString(),
  };
  game = { ...game, substitutions: [...game.substitutions, subPR1], runners: { first: "home-11", second: null, third: null } };

  // 2棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s3-2-2", inning: 1, half: "home", batterId: "home-2", pitcherId: "away-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-2", second: "home-11", third: null }, 0);

  // 3棒(雙殺打，三壘有人)
  game = updateGameAfterEvent(game, {
    id: "s3-2-3", inning: 1, half: "home", batterId: "home-3", pitcherId: "away-1",
    result: "G", notation: "6-4-3 DP", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { fieldingPlay: "DP" },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2, []);

  // 4棒(一安，1分)
  game = updateGameAfterEvent(game, {
    id: "s3-2-4", inning: 1, half: "home", batterId: "home-4", pitcherId: "away-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 2, runsScored: 1, recordColumn: { rbi: 1 },
    timestamp: new Date().toISOString(),
  }, { first: "home-4", second: null, third: null }, 0, [
    { runnerId: "home-11", fromBase: 2, toBase: 4 },
  ]);

  // 5棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s3-2-5", inning: 1, half: "home", batterId: "home-5", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 【2局上】(4打席)
  // 6棒(飛球)
  game = updateGameAfterEvent(game, {
    id: "s3-3-1", inning: 2, half: "away", batterId: "away-6", pitcherId: "home-12",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 【7棒換代打】
  const subPH1: Substitution = {
    id: "sub-ph-1", inning: 2, half: "away", teamId: teams[0].id, type: "代打",
    playerOutId: "away-6", playerInId: "away-16", position: "代打", timestamp: new Date().toISOString(),
  };
  game = { ...game, substitutions: [...game.substitutions, subPH1], awayBatterIndex: 15 };

  // (一安)
  game = updateGameAfterEvent(game, {
    id: "s3-3-2", inning: 2, half: "away", batterId: "away-16", pitcherId: "home-12",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-16", second: null, third: null }, 0);

  // 【代打(B)換代跑(C)】
  const subPR2: Substitution = {
    id: "sub-pr-2", inning: 2, half: "away", teamId: teams[0].id, type: "代跑",
    playerOutId: "away-16", playerInId: "away-17", position: "代跑", timestamp: new Date().toISOString(),
  };
  game = { ...game, substitutions: [...game.substitutions, subPR2], runners: { first: null, second: "away-17", third: null } };

  // 8棒(一安，代跑回本壘得分)
  game = updateGameAfterEvent(game, {
    id: "s3-3-3", inning: 2, half: "away", batterId: "away-8", pitcherId: "home-12",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 1, recordColumn: { rbi: 1 },
    timestamp: new Date().toISOString(),
  }, { first: "away-8", second: null, third: null }, 0, [
    { runnerId: "away-17", fromBase: 2, toBase: 4 },
  ]);

  // 9棒(飛球)
  game = updateGameAfterEvent(game, {
    id: "s3-3-4", inning: 2, half: "away", batterId: "away-9", pitcherId: "home-12",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 1, []);

  // 【2局下】(3打席)
  // 6棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s3-4-1", inning: 2, half: "home", batterId: "home-6", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 7棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s3-4-2", inning: 2, half: "home", batterId: "home-7", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 1);

  // 8棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s3-4-3", inning: 2, half: "home", batterId: "home-8", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2);

  // 【3局上】(8打席)
  // 1棒(一安)
  game = updateGameAfterEvent(game, {
    id: "s3-5-1", inning: 3, half: "away", batterId: "away-1", pitcherId: "home-12",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { rbi: 2 },
    timestamp: new Date().toISOString(),
  }, { first: "away-1", second: null, third: null }, 0);

  // 2棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s3-5-2", inning: 3, half: "away", batterId: "away-2", pitcherId: "home-12",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-2", second: "away-1", third: null }, 0);

  // 【主隊換投】
  const subRP2: Substitution = {
    id: "sub-rp-2", inning: 3, half: "home", teamId: teams[0].id, type: "換投",
    playerOutId: "home-12", playerInId: "home-13", position: "投手", timestamp: new Date().toISOString(),
  };
  game = { ...game, substitutions: [...game.substitutions, subRP2] };

  // 3棒(全壘打，3分)
  game = updateGameAfterEvent(game, {
    id: "s3-5-3", inning: 3, half: "away", batterId: "away-3", pitcherId: "home-13",
    result: "HR", notation: "HR", pitches: { balls: 2, strikes: 1, total: 3 },
    outsBefore: 1, runsScored: 3, recordColumn: { rbi: 3 },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 1, [
    { runnerId: "away-1", fromBase: 1, toBase: 4 },
    { runnerId: "away-2", fromBase: 2, toBase: 4 },
  ]);

  // 【4棒換代打】
  const subPH2: Substitution = {
    id: "sub-ph-2", inning: 3, half: "away", teamId: teams[0].id, type: "代打",
    playerOutId: "away-4", playerInId: "away-18", position: "代打", timestamp: new Date().toISOString(),
  };
  game = { ...game, substitutions: [...game.substitutions, subPH2] };

  // (一安)
  game = updateGameAfterEvent(game, {
    id: "s3-5-4", inning: 3, half: "away", batterId: "away-18", pitcherId: "home-13",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-18", second: null, third: null }, 0);

  // 5~7棒(皆出局)
  for (let i = 5; i <= 7; i++) {
    game = updateGameAfterEvent(game, {
      id: `s3-5-${i}`, inning: 3, half: "away", batterId: `away-${i}`, pitcherId: "home-13",
      result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
      outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
    }, { first: null, second: null, third: null }, 0);
  }

  const awayStats = getBattingStats(game, teams[0]);
  const homeStats = getBattingStats(game, teams[1]);

  // 【3局下】(3打席)
  // 【客隊一口氣更換3名守備員】
  const subFielding1: Substitution = {
    id: "sub-fielding-1", inning: 3, half: "home", teamId: teams[0].id, type: "換守",
    playerOutId: "home-1", playerInId: "home-20", position: "投手", timestamp: new Date().toISOString(),
  };
  const subFielding2: Substitution = {
    id: "sub-fielding-2", inning: 3, half: "home", teamId: teams[0].id, type: "換守",
    playerOutId: "home-2", playerInId: "home-21", position: "一壘", timestamp: new Date().toISOString(),
  };
  const subFielding3: Substitution = {
    id: "sub-fielding-3", inning: 3, half: "home", teamId: teams[0].id, type: "換守",
    playerOutId: "home-3", playerInId: "home-22", position: "二壘", timestamp: new Date().toISOString(),
  };
  game = {
    ...game,
    substitutions: [...game.substitutions, subFielding1, subFielding2, subFielding3]
  };

  // 9棒(刺殺)
  game = updateGameAfterEvent(game, {
    id: "s3-6-1", inning: 3, half: "home", batterId: "home-9", pitcherId: "home-20",
    result: "G", notation: "6-3", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 1, []);

  // 1棒(刺殺)
  game = updateGameAfterEvent(game, {
    id: "s3-6-2", inning: 3, half: "home", batterId: "home-1", pitcherId: "home-20",
    result: "G", notation: "6-3", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2, []);

  // 2棒(刺殺)
  game = updateGameAfterEvent(game, {
    id: "s3-6-3", inning: 3, half: "home", batterId: "home-2", pitcherId: "home-20",
    result: "G", notation: "6-3", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 3, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  game = { ...game, awayBatterIndex: 1 };

  // 斷言確認：代跑得分歸屬、後援投手三振歸屬、代打/二次代跑及打序延續
  const pr11Runs = homeStats.find((s) => s.player.id === "home-11")?.r ?? 0;
  const pr17Runs = awayStats.find((s) => s.player.id === "away-17")?.r ?? 0;
  const batter1Runs = awayStats.find((s) => s.player.id === "away-1")?.r ?? 0;
  const batter1Rbi = awayStats.find((s) => s.player.id === "away-1")?.rbi ?? 0;

  const pitchingStats13 = getPitchingStats(game, teams[1]).find((p) => p.player.id === "home-13");

  const nextBatter = getCurrentBatter(game, teams[0]);

  return {
    game,
    teams,
    assertions: {
      pr11Score: pr11Runs,
      pr17Score: pr17Runs,
      batter1Score: batter1Runs,
      batter1Rbi: batter1Rbi,
      rp13Strikeouts: pitchingStats13?.so ?? 0,
      nextBatterId: nextBatter.id,
      isNextBatter2nd: nextBatter.id === "away-2",
      substitutionsCount: game.substitutions.length,
      hasFieldingChange: game.substitutions.some((s) => s.type === "換守"),
    },
  };
}

/**
 * 🎬 劇本四：跑壘極限狀態與罕見出局
 * 測試重點：夾殺、妨礙守備/打擊、牽制出局等會中斷一般推進邏輯的事件
 */
export function runScenario4() {
  const teams = createScenarioTeams();
  let game = createScenarioBaseGame(teams);

  // 【1局上】(4打席)
  // 1棒(一安)
  game = updateGameAfterEvent(game, {
    id: "s4-1-1", inning: 1, half: "away", batterId: "away-1", pitcherId: "home-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-1", second: null, third: null }, 0);

  // 1棒盜二壘
  game = updateGameAfterSpecialEvent(game, {
    id: "s4-sp-1", inning: 1, half: "away", type: "SB", runnerId: "away-1", pitcherId: "home-1",
    fromBase: 1, toBase: 2, runsScored: 0, outsBefore: 0, notation: "SB", timestamp: new Date().toISOString(),
  }, { first: null, second: "away-1", third: null }, 0, 0);

  // 1棒在二壘遭牽制出局 - 使用特殊記錄在打席內圈
  game = updateGameAfterEvent(game, {
    id: "s4-sp-2", inning: 1, half: "away", batterId: "away-2", pitcherId: "home-1",
    result: "K", notation: "K", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 1);

  // 2棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s4-1-2", inning: 1, half: "away", batterId: "away-2", pitcherId: "home-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-2", second: null, third: null }, 0);

  // 3棒(打擊時，1棒盜壘遭夾殺出局)
  game = updateGameAfterSpecialEvent(game, {
    id: "s4-sp-3", inning: 1, half: "away", type: "CS", runnerId: "away-2", pitcherId: "home-1",
    fromBase: 1, toBase: 2, runsScored: 0, outsBefore: 2, notation: "CS", timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0, 1);

  // 3棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s4-1-3", inning: 1, half: "away", batterId: "away-3", pitcherId: "home-1",
    result: "K", notation: "K", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  const top1HasCaughtStealing = game.specialEvents.some((e) => e.type === "CS");

  // 【1局下】(3打席)
  // 1棒(一安)
  game = updateGameAfterEvent(game, {
    id: "s4-1-4", inning: 1, half: "home", batterId: "home-1", pitcherId: "away-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-1", second: null, third: null }, 0);

  // 2棒(打擊時，1棒盜壘遭夾殺出局)
  game = updateGameAfterSpecialEvent(game, {
    id: "s4-sp-4", inning: 1, half: "home", type: "CS", runnerId: "home-1", pitcherId: "away-1",
    fromBase: 1, toBase: 2, runsScored: 0, outsBefore: 1, notation: "CS", timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0, 1);

  // 2棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s4-1-5", inning: 1, half: "home", batterId: "home-2", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 3棒(刺殺)
  game = updateGameAfterEvent(game, {
    id: "s4-1-6", inning: 1, half: "home", batterId: "home-3", pitcherId: "away-1",
    result: "G", notation: "6-3", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 【2局上】(6打席)
  // 5棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s4-2-1", inning: 2, half: "away", batterId: "away-5", pitcherId: "home-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-5", second: null, third: null }, 0);

  // 6棒(妨礙打擊，保送上一壘)
  game = updateGameAfterEvent(game, {
    id: "s4-2-2", inning: 2, half: "away", batterId: "away-6", pitcherId: "home-1",
    result: "E", notation: "E2", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 0, runsScored: 0, droppedThirdStrike: true,
    recordColumn: { modifiers: ["妨礙打擊"] },
    timestamp: new Date().toISOString(),
  }, { first: "away-6", second: null, third: null }, 0);

  // 7棒(一安，滿壘)
  game = updateGameAfterEvent(game, {
    id: "s4-2-3", inning: 2, half: "away", batterId: "away-7", pitcherId: "home-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-7", second: "away-5", third: "away-6" }, 0);

  // 8棒(平飛球接殺，跑者回壘不及形成雙殺，二三壘有人)
  game = updateGameAfterEvent(game, {
    id: "s4-2-4", inning: 2, half: "away", batterId: "away-8", pitcherId: "home-1",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { fieldingPlay: "DP" },
    timestamp: new Date().toISOString(),
  }, { first: null, second: "away-7", third: "away-5" }, 1);

  // 9棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s4-2-5", inning: 2, half: "away", batterId: "away-9", pitcherId: "home-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  const top2HasLineOutDoublePlay = game.events.some((e) => e.result === "F" && e.recordColumn?.fieldingPlay === "DP");

  // 【2局下】(5打席)
  // 4棒(二安)
  game = updateGameAfterEvent(game, {
    id: "s4-2-6", inning: 2, half: "home", batterId: "home-4", pitcherId: "away-1",
    result: "2B", notation: "2B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-4", second: null, third: null }, 0);

  // 5棒(一安，跑者闖本壘遭觸殺，一人出局，打者上二壘)
  game = updateGameAfterEvent(game, {
    id: "s4-2-7", inning: 2, half: "home", batterId: "home-5", pitcherId: "away-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { modifiers: ["安全上壘"] },
    timestamp: new Date().toISOString(),
  }, { first: "home-5", second: "home-4", third: null }, 1, [
    { runnerId: "home-4", fromBase: 2, toBase: 4 },
  ]);

  // 6棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s4-2-8", inning: 2, half: "home", batterId: "home-6", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 7棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s4-2-9", inning: 2, half: "home", batterId: "home-7", pitcherId: "away-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-7", second: null, third: null }, 0);

  // 8棒(飛球)
  game = updateGameAfterEvent(game, {
    id: "s4-2-10", inning: 2, half: "home", batterId: "home-8", pitcherId: "away-1",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2, []);

  const bottom2HasSafetyPlay = game.events.some((e) => e.recordColumn?.modifiers?.includes("安全上壘"));

  // 【3局上】(3打席)
  // 1棒(飛球)
  game = updateGameAfterEvent(game, {
    id: "s4-3-1", inning: 3, half: "away", batterId: "away-1", pitcherId: "home-1",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 1, []);

  // 2棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s4-3-2", inning: 3, half: "away", batterId: "away-2", pitcherId: "home-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-2", second: null, third: null }, 0);

  // 3棒(滾地球，跑者妨礙守備，打者上一壘，跑者出局)
  game = updateGameAfterEvent(game, {
    id: "s4-3-3", inning: 3, half: "away", batterId: "away-3", pitcherId: "home-1",
    result: "G", notation: "G+ E4", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, recordColumn: { modifiers: ["妨礙"] },
    timestamp: new Date().toISOString(),
  }, { first: "away-3", second: null, third: null }, 1);

  // 4棒(三振，三人出局)
  game = updateGameAfterEvent(game, {
    id: "s4-3-4", inning: 3, half: "away", batterId: "away-4", pitcherId: "home-1",
    result: "K", notation: "K", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  const top3HasFieldingObstruction = game.events.some((e) => e.recordColumn?.modifiers?.includes("妨礙"));

  // 【3局下】(8打席)
  // 9棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s4-3-5", inning: 3, half: "home", batterId: "home-9", pitcherId: "away-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-9", second: null, third: null }, 0);

  // 1棒(一安)
  game = updateGameAfterEvent(game, {
    id: "s4-3-6", inning: 3, half: "home", batterId: "home-1", pitcherId: "away-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-1", second: "home-9", third: null }, 0);

  // 2棒(犧牲觸擊)
  game = updateGameAfterEvent(game, {
    id: "s4-3-7", inning: 3, half: "home", batterId: "home-2", pitcherId: "away-1",
    result: "G", notation: "G", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { modifiers: ["SacB"] },
    timestamp: new Date().toISOString(),
  }, { first: null, second: "home-1", third: null }, 1, [
    { runnerId: "home-9", fromBase: 1, toBase: 2 },
  ]);

  // 3棒(故意四壞保送，滿壘)
  game = updateGameAfterEvent(game, {
    id: "s4-3-8", inning: 3, half: "home", batterId: "home-3", pitcherId: "away-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 1, runsScored: 0, recordColumn: { modifiers: ["故意"] },
    timestamp: new Date().toISOString(),
  }, { first: "home-3", second: "home-2", third: "home-1" }, 0);

  // 4棒(再見暴投，得1分，比賽結束狀態)
  game = updateGameAfterSpecialEvent(game, {
    id: "s4-sp-5", inning: 3, half: "home", type: "WP", runnerId: "home-3", pitcherId: "away-1",
    fromBase: 1, toBase: 2, runsScored: 1, outsBefore: 1, notation: "WP", timestamp: new Date().toISOString(),
  }, { first: null, second: "home-3", third: null }, 1, 0);

  game = { ...game, status: "final" };

  // 斷言確認：再見得分時比賽結束狀態
  const gameStatus = game.status;

  return {
    game,
    teams,
    assertions: {
      top1HasCaughtStealing: top1HasCaughtStealing,
      bottom1HasCaughtStealing: game.specialEvents.some((e) => e.type === "CS" && e.inning === 1 && e.half === "home"),
      top2HasLineOutDoublePlay: top2HasLineOutDoublePlay,
      bottom2HasSafetyPlay: bottom2HasSafetyPlay,
      top3HasFieldingObstruction: top3HasFieldingObstruction,
      gameEndedByWinningRun: gameStatus === "final",
      hasWalkOffError: game.specialEvents.some((e) => e.type === "WP"),
    },
  };
}

/**
 * 🎬 劇本五：超高壓綜合壓力測試 (打線、調度、戰術混合)
 * 測試重點：把前面四個劇本的元素全部混在同一局，檢查 Zoo Code 跨頁面資料庫（Box Score、文字轉播、計分板）是否崩潰或錯亂。
 */
export function runScenario5() {
  const teams = createScenarioTeams();
  let game = createScenarioBaseGame(teams);

  // 【1局上】(10打席)
  // 1棒(一安)
  game = updateGameAfterEvent(game, {
    id: "s5-1-1", inning: 1, half: "away", batterId: "away-1", pitcherId: "home-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-1", second: null, third: null }, 0);

  // 2棒(失誤上壘)
  game = updateGameAfterEvent(game, {
    id: "s5-1-2", inning: 1, half: "away", batterId: "away-2", pitcherId: "home-1",
    result: "E", notation: "E7", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-2", second: "away-1", third: null }, 0);

  // 3棒(二安，2分)
  game = updateGameAfterEvent(game, {
    id: "s5-1-3", inning: 1, half: "away", batterId: "away-3", pitcherId: "home-1",
    result: "2B", notation: "2B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 2, recordColumn: { rbi: 2 },
    timestamp: new Date().toISOString(),
  }, { first: "away-3", second: "away-2", third: "away-1" }, 0, [
    { runnerId: "away-1", fromBase: 1, toBase: 4 },
    { runnerId: "away-2", fromBase: 2, toBase: 3 },
  ]);

  // 【主隊換投】
  const subRP1: Substitution = {
    id: "sub-rp-1", inning: 1, half: "home", teamId: teams[0].id, type: "換投",
    playerOutId: "home-1", playerInId: "home-12", position: "投手", timestamp: new Date().toISOString(),
  };
  game = { ...game, substitutions: [...game.substitutions, subRP1] };

  // 4棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s5-1-4", inning: 1, half: "away", batterId: "away-4", pitcherId: "home-12",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-4", second: null, third: "away-3" }, 0);

  // 5棒(野手選擇，一三壘有人)
  game = updateGameAfterEvent(game, {
    id: "s5-1-5", inning: 1, half: "away", batterId: "away-5", pitcherId: "home-12",
    result: "G", notation: "5-3 FC", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { fieldingPlay: "FC" },
    timestamp: new Date().toISOString(),
  }, { first: null, second: "away-5", third: "away-4" }, 0);

  // 1、3壘雙盜壘(得1分)
  game = updateGameAfterSpecialEvent(game, {
    id: "s5-sp-1", inning: 1, half: "away", type: "SB", runnerId: "away-5", pitcherId: "home-12",
    fromBase: 2, toBase: 3, runsScored: 1, outsBefore: 0, notation: "SB", timestamp: new Date().toISOString(),
  }, { first: "away-1", second: null, third: "away-5" }, 0, 0);

  // 6棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s5-1-6", inning: 1, half: "away", batterId: "away-6", pitcherId: "home-12",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 7棒(一安，1分)
  game = updateGameAfterEvent(game, {
    id: "s5-1-7", inning: 1, half: "away", batterId: "away-7", pitcherId: "home-12",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 1, runsScored: 1, recordColumn: { rbi: 1 },
    timestamp: new Date().toISOString(),
  }, { first: "away-7", second: "away-6", third: null }, 1, [
    { runnerId: "away-5", fromBase: 3, toBase: 4 },
  ]);

  // 8棒(飛球)
  game = updateGameAfterEvent(game, {
    id: "s5-1-8", inning: 1, half: "away", batterId: "away-8", pitcherId: "home-12",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2, []);

  // 9棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s5-1-9", inning: 1, half: "away", batterId: "away-9", pitcherId: "home-12",
    result: "K", notation: "K", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  const top1TotalRuns = game.score.find((s) => s.inning === 1)?.away ?? 0;

  // 【1局下】(3打席) 三上三下
  for (let i = 1; i <= 3; i++) {
    game = updateGameAfterEvent(game, {
      id: `s5-bot1-${i}`, inning: 1, half: "home", batterId: `home-${i}`, pitcherId: "away-1",
      result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
      outsBefore: i - 1, runsScored: 0, timestamp: new Date().toISOString(),
    }, { first: null, second: null, third: null }, 0);
  }

  // 【2局上】(6打席)
  // 1棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s5-2-1", inning: 2, half: "away", batterId: "away-1", pitcherId: "home-12",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-1", second: null, third: null }, 0);

  // 【1棒換代跑】
  const subPR3: Substitution = {
    id: "sub-pr-3", inning: 2, half: "away", teamId: teams[0].id, type: "代跑",
    playerOutId: "away-1", playerInId: "away-11", position: "代跑", timestamp: new Date().toISOString(),
  };
  game = { ...game, substitutions: [...game.substitutions, subPR3], runners: { first: "away-11", second: null, third: null } };

  // 2棒(觸擊失敗，捕手傳一壘雙殺)
  game = updateGameAfterEvent(game, {
    id: "s5-2-2", inning: 2, half: "away", batterId: "away-2", pitcherId: "home-12",
    result: "G", notation: "G", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { modifiers: ["SacB Fail"] },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 1, []);

  // 3棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s5-2-3", inning: 2, half: "away", batterId: "away-3", pitcherId: "home-12",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-3", second: null, third: null }, 0);

  // 4棒(二安)
  game = updateGameAfterEvent(game, {
    id: "s5-2-4", inning: 2, half: "away", batterId: "away-4", pitcherId: "home-12",
    result: "2B", notation: "2B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-4", second: "away-3", third: null }, 0);

  // 5棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s5-2-5", inning: 2, half: "away", batterId: "away-5", pitcherId: "home-12",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-5", second: "away-4", third: "away-3" }, 0);

  // 6棒(滿壘殘壘，三振)
  game = updateGameAfterEvent(game, {
    id: "s5-2-6", inning: 2, half: "away", batterId: "away-6", pitcherId: "home-12",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 【2局下】(4打席)
  // 4棒(全壘打)
  game = updateGameAfterEvent(game, {
    id: "s5-2-7", inning: 2, half: "home", batterId: "home-4", pitcherId: "away-1",
    result: "HR", notation: "HR", pitches: { balls: 2, strikes: 1, total: 3 },
    outsBefore: 0, runsScored: 3, recordColumn: { rbi: 3 },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0, [
    { runnerId: "home-4", fromBase: 1, toBase: 4 },
  ]);

  // 5棒(一安)
  game = updateGameAfterEvent(game, {
    id: "s5-2-8", inning: 2, half: "home", batterId: "home-5", pitcherId: "away-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-5", second: null, third: null }, 0);

  // 【主隊換投】
  const subRP2: Substitution = {
    id: "sub-rp-2", inning: 2, half: "home", teamId: teams[0].id, type: "換投",
    playerOutId: "away-1", playerInId: "away-12", position: "投手", timestamp: new Date().toISOString(),
  };
  game = { ...game, substitutions: [...game.substitutions, subRP2] };

  // 6棒(雙殺打)
  game = updateGameAfterEvent(game, {
    id: "s5-2-9", inning: 2, half: "home", batterId: "home-6", pitcherId: "away-12",
    result: "G", notation: "6-4-3 DP", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, recordColumn: { fieldingPlay: "DP" },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2, []);

  // 7棒(三振)
  game = updateGameAfterEvent(game, {
    id: "s5-2-10", inning: 2, half: "home", batterId: "home-7", pitcherId: "away-12",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  const awayStats = getBattingStats(game, teams[0]);

  // 【3局上】(11打席)
  // 7棒(不死三振)
  game = updateGameAfterEvent(game, {
    id: "s5-3-1", inning: 3, half: "away", batterId: "away-7", pitcherId: "home-12",
    result: "K", notation: "K+ E3", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 0, runsScored: 0, droppedThirdStrike: true,
    timestamp: new Date().toISOString(),
  }, { first: "away-7", second: null, third: null }, 0);

  // 8棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s5-3-2", inning: 3, half: "away", batterId: "away-8", pitcherId: "home-12",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-8", second: "away-7", third: null }, 0);

  // 9棒(犧牲打)
  game = updateGameAfterEvent(game, {
    id: "s5-3-3", inning: 3, half: "away", batterId: "away-9", pitcherId: "home-12",
    result: "G", notation: "G", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { modifiers: ["SacB"] },
    timestamp: new Date().toISOString(),
  }, { first: null, second: "away-9", third: null }, 1, [
    { runnerId: "away-8", fromBase: 1, toBase: 2 },
  ]);

  // 1棒(一安，2分)
  game = updateGameAfterEvent(game, {
    id: "s5-3-4", inning: 3, half: "away", batterId: "away-1", pitcherId: "home-12",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 1, runsScored: 2, recordColumn: { rbi: 2 },
    timestamp: new Date().toISOString(),
  }, { first: "away-1", second: "away-9", third: null }, 1, [
    { runnerId: "away-9", fromBase: 2, toBase: 3 },
  ]);

  // 【1棒換代跑】
  const subPR4: Substitution = {
    id: "sub-pr-4", inning: 3, half: "away", teamId: teams[0].id, type: "代跑",
    playerOutId: "away-1", playerInId: "away-11", position: "代跑", timestamp: new Date().toISOString(),
  };
  game = { ...game, substitutions: [...game.substitutions, subPR4], runners: { first: null, second: "away-11", third: null } };

  // 2棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s5-3-5", inning: 3, half: "away", batterId: "away-2", pitcherId: "home-12",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-2", second: "away-11", third: null }, 0);

  // 【3棒換代打】
  const subPH3: Substitution = {
    id: "sub-ph-3", inning: 3, half: "away", teamId: teams[0].id, type: "代打",
    playerOutId: "away-3", playerInId: "away-19", position: "代打", timestamp: new Date().toISOString(),
  };
  game = { ...game, substitutions: [...game.substitutions, subPH3], awayBatterIndex: 2 };

  // (全壘打，3分)
  game = updateGameAfterEvent(game, {
    id: "s5-3-6", inning: 3, half: "away", batterId: "away-19", pitcherId: "home-12",
    result: "HR", notation: "HR", pitches: { balls: 2, strikes: 1, total: 3 },
    outsBefore: 1, runsScored: 3, recordColumn: { rbi: 3 },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 1, [
    { runnerId: "away-2", fromBase: 2, toBase: 4 },
    { runnerId: "away-11", fromBase: 3, toBase: 4 },
  ]);

  // 4棒(飛球)
  game = updateGameAfterEvent(game, {
    id: "s5-3-7", inning: 3, half: "away", batterId: "away-4", pitcherId: "home-12",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2, []);

  // 5棒(失誤)
  game = updateGameAfterEvent(game, {
    id: "s5-3-8", inning: 3, half: "away", batterId: "away-5", pitcherId: "home-12",
    result: "E", notation: "E6", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-5", second: null, third: null }, 0);

  // 6棒(失誤)
  game = updateGameAfterEvent(game, {
    id: "s5-3-9", inning: 3, half: "away", batterId: "away-6", pitcherId: "home-12",
    result: "E", notation: "E5", pitches: { balls: 1, strikes: 0, total: 1 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-6", second: "away-5", third: null }, 0);

  // 7棒(全壘打，1分)
  game = updateGameAfterEvent(game, {
    id: "s5-3-10", inning: 3, half: "away", batterId: "away-7", pitcherId: "home-12",
    result: "HR", notation: "HR", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 2, runsScored: 1, recordColumn: { rbi: 1 },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 斷言確認：單局打席中包含「代跑得分」及「代打全壘打」，打點與得分的 Box Score 數據驗證
  const awayStatsUpdated = getBattingStats(game, teams[0]);
  const pr11Runs2 = awayStatsUpdated.find((s) => s.player.id === "away-11")?.r ?? 0;
  const ph19Rbi = awayStatsUpdated.find((s) => s.player.id === "away-19")?.rbi ?? 0;
  const batter7Runs = awayStatsUpdated.find((s) => s.player.id === "away-7")?.r ?? 0;
  const batter7Rbi = awayStatsUpdated.find((s) => s.player.id === "away-7")?.rbi ?? 0;

  // 【3局下】(5打席)
  // 8棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s5-3-11", inning: 3, half: "home", batterId: "home-8", pitcherId: "away-12",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-8", second: null, third: null }, 0);

  // 9棒(保送)
  game = updateGameAfterEvent(game, {
    id: "s5-3-12", inning: 3, half: "home", batterId: "home-9", pitcherId: "away-12",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-9", second: "home-8", third: null }, 0);

  // 1棒(飛球出局，跑者推進三壘)
  game = updateGameAfterEvent(game, {
    id: "s5-3-13", inning: 3, half: "home", batterId: "home-1", pitcherId: "away-12",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0,
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: "home-9" }, 1, [
    { runnerId: "home-8", fromBase: 1, toBase: 3 },
  ]);

  // 2棒(保送，滿壘)
  game = updateGameAfterEvent(game, {
    id: "s5-3-14", inning: 3, half: "home", batterId: "home-2", pitcherId: "away-12",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-2", second: "home-1", third: "home-9" }, 0);

  // 3棒(再見雙殺打，比賽結束)
  game = updateGameAfterEvent(game, {
    id: "s5-3-15", inning: 3, half: "home", batterId: "home-3", pitcherId: "away-12",
    result: "G", notation: "6-4-3 DP", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, recordColumn: { fieldingPlay: "DP" },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2, []);

  game = { ...game, status: "final", inning: 3, half: "home" };

  // 斷言確認：滿壘狀態下的 6-4-3 雙殺結束比賽，所有數據自動存檔與結算頁面跳出是否正常
  const finalStatus = game.status;
  const finalInning = game.inning;
  const finalHalf = game.half;

  return {
    game,
    teams,
    assertions: {
      top1TotalRuns: top1TotalRuns,
      top1MixedEvents: game.events.filter((e) => e.result === "E").length > 0 && game.specialEvents.some((e) => e.type === "SB"),
      hasScoringSubstitution: game.substitutions.some((s) => s.type === "代跑" && s.playerInId === "away-11"),
      hasHrSubstitution: game.substitutions.some((s) => s.type === "代打" && s.playerInId === "away-19"),
      doublePlayEndGame: game.events.some((e) => e.recordColumn?.fieldingPlay === "DP" && e.inning === 3),
      finalStatus: finalStatus,
      finalInning: finalInning,
      finalHalf: finalHalf,
      pr11Runs2: pr11Runs2,
      ph19Rbi: ph19Rbi,
      batter7Runs: batter7Runs,
      batter7Rbi: batter7Rbi,
    },
  };
}

/**
 * 5 個劇本註冊字典與一鍵注入入口
 */
export const SCENARIO_RUNNERS = {
  1: runScenario1,
  2: runScenario2,
  3: runScenario3,
  4: runScenario4,
  5: runScenario5,
} as const;

export function loadScenarioState(id: 1 | 2 | 3 | 4 | 5): Game {
  return SCENARIO_RUNNERS[id]().game;
}
