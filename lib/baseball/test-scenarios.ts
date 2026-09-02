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
    name: "系統全面壓力與整合測試賽",
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
    notes: "5大劇本測試紀錄",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 🎬 劇本一：常規推進、安打不推進與棒次跨局連續性 (基礎打擊戰)
 */
export function runScenario1() {
  const teams = createScenarioTeams();
  let game = createScenarioBaseGame(teams);

  // --- 一局上 (客隊攻擊) ---
  // 1棒 (away-1): K
  game = updateGameAfterEvent(game, {
    id: "s1-1-1", inning: 1, half: "away", batterId: "away-1", pitcherId: "home-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  // 2棒 (away-2): 6-3 刺殺
  game = updateGameAfterEvent(game, {
    id: "s1-1-2", inning: 1, half: "away", batterId: "away-2", pitcherId: "home-1",
    result: "G", notation: "6-3", pitches: { balls: 1, strikes: 1, total: 2 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  // 3棒 (away-3): 8 接殺
  game = updateGameAfterEvent(game, {
    id: "s1-1-3", inning: 1, half: "away", batterId: "away-3", pitcherId: "home-1",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  const top1InningScore = game.score.find((s) => s.inning === 1)?.away ?? 0;

  // --- 一局下 (主隊攻擊) ---
  // 1棒 (home-1): 1B 中安
  game = updateGameAfterEvent(game, {
    id: "s1-1-4", inning: 1, half: "home", batterId: "home-1", pitcherId: "away-1",
    result: "1B", notation: "1B 8", pitches: { balls: 2, strikes: 1, total: 3 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-1", second: null, third: null }, 0);

  // 2棒 (home-2): 1B 左安，測試一壘跑者停留在二壘，不主動上三壘
  game = updateGameAfterEvent(game, {
    id: "s1-1-5", inning: 1, half: "home", batterId: "home-2", pitcherId: "away-1",
    result: "1B", notation: "1B 7", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-2", second: "home-1", third: null }, 0);

  // 3棒 (home-3): K
  game = updateGameAfterEvent(game, {
    id: "s1-1-6", inning: 1, half: "home", batterId: "home-3", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  // 4棒 (home-4): 2B 右二安，二壘跑者 home-1 回本壘得分，一壘跑者 home-2 上三壘
  game = updateGameAfterEvent(game, {
    id: "s1-1-7", inning: 1, half: "home", batterId: "home-4", pitcherId: "away-1",
    result: "2B", notation: "2B 9", pitches: { balls: 1, strikes: 0, total: 1 },
    outsBefore: 1, runsScored: 1, timestamp: new Date().toISOString(),
  }, { first: null, second: "home-4", third: "home-2" }, 1, [
    { runnerId: "home-1", fromBase: 2, toBase: 4 },
    { runnerId: "home-2", fromBase: 1, toBase: 3 },
  ]);

  // 5棒 (home-5): 6-3 刺殺，三壘跑者留在三壘未推進
  game = updateGameAfterEvent(game, {
    id: "s1-1-8", inning: 1, half: "home", batterId: "home-5", pitcherId: "away-1",
    result: "G", notation: "6-3", pitches: { balls: 0, strikes: 2, total: 2 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: "home-4", third: "home-2" }, 0);

  // 6棒 (home-6): 4-3 刺殺
  game = updateGameAfterEvent(game, {
    id: "s1-1-9", inning: 1, half: "home", batterId: "home-6", pitcherId: "away-1",
    result: "G", notation: "4-3", pitches: { balls: 2, strikes: 2, total: 4 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  const bot1InningScore = game.score.find((s) => s.inning === 1)?.home ?? 0;

  // --- 二局上 (客隊攻擊) ---
  // 斷言確認：打序必須由 4棒 (away-4) 開始！
  const batterInTop2 = getCurrentBatter(game, teams[0]);
  const top2Inning = game.inning;
  const top2Half = game.half;

  // 4棒 (away-4): BB
  game = updateGameAfterEvent(game, {
    id: "s1-2-1", inning: 2, half: "away", batterId: "away-4", pitcherId: "home-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-4", second: null, third: null }, 0);

  // 5棒 (away-5): 6-4-3 GIDP 雙殺
  game = updateGameAfterEvent(game, {
    id: "s1-2-2", inning: 2, half: "away", batterId: "away-5", pitcherId: "home-1",
    result: "G", notation: "6-4-3 GIDP", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { fieldingPlay: "DP" },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // 6棒 (away-6): K
  game = updateGameAfterEvent(game, {
    id: "s1-2-3", inning: 2, half: "away", batterId: "away-6", pitcherId: "home-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  return {
    game,
    teams,
    assertions: {
      top1Score: top1InningScore,
      bot1Score: bot1InningScore,
      top2StartBatterId: batterInTop2.id,
      isTop2StartBatterMatch: batterInTop2.id === "away-4",
      top2Inning,
      top2Half,
      finalInning: game.inning,
      finalHalf: game.half,
    },
  };
}

/**
 * 🎬 劇本二：壘包破壞者 (盜壘、暴投、牽制與特殊推進)
 */
export function runScenario2() {
  const teams = createScenarioTeams();
  let game = createScenarioBaseGame(teams);

  // --- 一局上 (客隊攻擊) ---
  // 1棒 (away-1): BB
  game = updateGameAfterEvent(game, {
    id: "s2-1-1", inning: 1, half: "away", batterId: "away-1", pitcherId: "home-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-1", second: null, third: null }, 0);

  // [壘上事件] 1棒盜二壘成功 (SB)
  game = updateGameAfterSpecialEvent(game, {
    id: "s2-sp-1", inning: 1, half: "away", type: "SB", runnerId: "away-1", pitcherId: "home-1",
    fromBase: 1, toBase: 2, runsScored: 0, outsBefore: 0, notation: "SB", timestamp: new Date().toISOString(),
  }, { first: null, second: "away-1", third: null }, 0, 0);

  // 2棒 (away-2): K
  game = updateGameAfterEvent(game, {
    id: "s2-1-2", inning: 1, half: "away", batterId: "away-2", pitcherId: "home-1",
    result: "K", notation: "K", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  // [壘上事件] 1棒盜三壘失敗 (CS)，出局數+1
  game = updateGameAfterSpecialEvent(game, {
    id: "s2-sp-2", inning: 1, half: "away", type: "CS", runnerId: "away-1", pitcherId: "home-1",
    fromBase: 2, toBase: 3, runsScored: 0, outsBefore: 1, notation: "CS", timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0, 1);

  // 3棒 (away-3): 5-3 刺殺
  game = updateGameAfterEvent(game, {
    id: "s2-1-3", inning: 1, half: "away", batterId: "away-3", pitcherId: "home-1",
    result: "G", notation: "5-3", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  // --- 一局下 (主隊攻擊) ---
  // 1棒 (home-1): 1B
  game = updateGameAfterEvent(game, {
    id: "s2-1-4", inning: 1, half: "home", batterId: "home-1", pitcherId: "away-1",
    result: "1B", notation: "1B", pitches: { balls: 1, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-1", second: null, third: null }, 0);

  // 2棒 (home-2): BB
  game = updateGameAfterEvent(game, {
    id: "s2-1-5", inning: 1, half: "home", batterId: "home-2", pitcherId: "away-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-2", second: "home-1", third: null }, 0);

  // [壘上事件] 投手暴投 (WP)，跑者分別推進至二、三壘
  game = updateGameAfterSpecialEvent(game, {
    id: "s2-sp-3", inning: 1, half: "home", type: "WP", runnerId: "home-1", pitcherId: "away-1",
    fromBase: 2, toBase: 3, runsScored: 0, outsBefore: 0, notation: "WP", timestamp: new Date().toISOString(),
  }, { first: null, second: "home-2", third: "home-1" }, 0, 0);

  // 3棒 (home-3): 高飛犧牲打 SF，三壘得分，二壘 Hold
  game = updateGameAfterEvent(game, {
    id: "s2-1-6", inning: 1, half: "home", batterId: "home-3", pitcherId: "away-1",
    result: "F", notation: "SF 8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 1, recordColumn: { modifiers: ["SF"] },
    timestamp: new Date().toISOString(),
  }, { first: null, second: "home-2", third: null }, 1, [
    { runnerId: "home-1", fromBase: 3, toBase: 4 },
  ]);

  // [壘上事件] 4棒打擊時，二壘跑者被投手牽制出局 PO
  game = updateGameAfterSpecialEvent(game, {
    id: "s2-sp-4", inning: 1, half: "home", type: "PO", runnerId: "home-2", pitcherId: "away-1",
    fromBase: 2, runsScored: 0, outsBefore: 1, notation: "PO", timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0, 1);

  // 4棒 (home-4): 重新打擊 K
  game = updateGameAfterEvent(game, {
    id: "s2-1-7", inning: 1, half: "home", batterId: "home-4", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 2, strikes: 3, total: 5 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  // --- 二局上 (客隊攻擊) ---
  // 4棒 (away-4): 不死三振，捕手傳一壘 E2 暴傳，上二壘
  game = updateGameAfterEvent(game, {
    id: "s2-2-1", inning: 2, half: "away", batterId: "away-4", pitcherId: "home-1",
    result: "K", notation: "K+ E2", pitches: { balls: 1, strikes: 3, total: 4 },
    outsBefore: 0, runsScored: 0, droppedThirdStrike: true,
    timestamp: new Date().toISOString(),
  }, { first: null, second: "away-4", third: null }, 0);

  // 5棒 (away-5): 打擊區時發生投手犯規 Balk，4棒上三壘
  game = updateGameAfterSpecialEvent(game, {
    id: "s2-sp-5", inning: 2, half: "away", type: "BK", runnerId: "away-4", pitcherId: "home-1",
    fromBase: 2, toBase: 3, runsScored: 0, outsBefore: 0, notation: "BK", timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: "away-4" }, 0, 0);

  return {
    game,
    teams,
    assertions: {
      hasWildPitch: game.specialEvents.some((e) => e.type === "WP"),
      hasPickoff: game.specialEvents.some((e) => e.type === "PO"),
      hasBalk: game.specialEvents.some((e) => e.type === "BK"),
      hasStolenBase: game.specialEvents.some((e) => e.type === "SB"),
      hasCaughtStealing: game.specialEvents.some((e) => e.type === "CS"),
    },
  };
}

/**
 * 🎬 劇本三：教練團的調度藝術 (換打 PH、換投 RP、代跑 PR)
 */
export function runScenario3() {
  const teams = createScenarioTeams();
  let game = createScenarioBaseGame(teams);

  // --- 一局上 (客隊攻擊) ---
  // 1棒 (away-1): BB
  game = updateGameAfterEvent(game, {
    id: "s3-1-1", inning: 1, half: "away", batterId: "away-1", pitcherId: "home-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-1", second: null, third: null }, 0);

  // [更換代跑 PR] 1棒下，換上 11棒 (away-11) 代跑
  const subPR: Substitution = {
    id: "sub-pr-1", inning: 1, half: "away", teamId: teams[0].id, type: "代跑",
    playerOutId: "away-1", playerInId: "away-11", position: "代跑", timestamp: new Date().toISOString(),
  };
  game = {
    ...game,
    substitutions: [...game.substitutions, subPR],
    runners: { first: "away-11", second: null, third: null },
  };

  // 2棒 (away-2): 1B，11棒上三壘
  game = updateGameAfterEvent(game, {
    id: "s3-1-2", inning: 1, half: "away", batterId: "away-2", pitcherId: "home-1",
    result: "1B", notation: "1B 7", pitches: { balls: 1, strikes: 1, total: 2 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-2", second: null, third: "away-11" }, 0);

  // 3棒 (away-3): SF，11棒回本壘得分
  game = updateGameAfterEvent(game, {
    id: "s3-1-3", inning: 1, half: "away", batterId: "away-3", pitcherId: "home-1",
    result: "F", notation: "SF 8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 1, recordColumn: { modifiers: ["SF"], rbi: 1 },
    timestamp: new Date().toISOString(),
  }, { first: "away-2", second: null, third: null }, 1, [
    { runnerId: "away-11", fromBase: 3, toBase: 4 },
  ]);

  // 4棒 (away-4): K
  game = updateGameAfterEvent(game, {
    id: "s3-1-4", inning: 1, half: "away", batterId: "away-4", pitcherId: "home-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  // 5棒 (away-5): 6-3 刺殺
  game = updateGameAfterEvent(game, {
    id: "s3-1-5", inning: 1, half: "away", batterId: "away-5", pitcherId: "home-1",
    result: "G", notation: "6-3", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  // --- 二局下 (主隊攻擊) ---
  // 防守方 (客隊) [更換投手 RP]: 換上 away-12
  const subRP1: Substitution = {
    id: "sub-rp-1", inning: 2, half: "home", teamId: teams[0].id, type: "換投",
    playerOutId: "away-1", playerInId: "away-12", position: "投手", timestamp: new Date().toISOString(),
  };
  game = { ...game, substitutions: [...game.substitutions, subRP1] };

  // 6棒 (home-6): BB
  game = updateGameAfterEvent(game, {
    id: "s3-2-1", inning: 2, half: "home", batterId: "home-6", pitcherId: "away-12",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-6", second: null, third: null }, 0);

  // 7棒 (home-7): 球數 2好1壞時，防守方再次換投: 換上 away-13
  const subRP2: Substitution = {
    id: "sub-rp-2", inning: 2, half: "home", teamId: teams[0].id, type: "換投",
    playerOutId: "away-12", playerInId: "away-13", position: "投手", timestamp: new Date().toISOString(),
  };
  game = { ...game, substitutions: [...game.substitutions, subRP2] };

  // 7棒 (home-7): K (記在後援投手 away-13 身上)
  game = updateGameAfterEvent(game, {
    id: "s3-2-2", inning: 2, half: "home", batterId: "home-7", pitcherId: "away-13",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 2, total: 2 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  // --- 三局上 (客隊攻擊) ---
  // [更換代打 PH] 原9棒換下，由 15棒 (away-15) 代打
  const subPH: Substitution = {
    id: "sub-ph-1", inning: 3, half: "away", teamId: teams[0].id, type: "代打",
    playerOutId: "away-9", playerInId: "away-15", position: "代打", timestamp: new Date().toISOString(),
  };
  game = { ...game, half: "away", inning: 3, substitutions: [...game.substitutions, subPH], awayBatterIndex: 8 };

  // 15棒 (away-15): 2B 安打
  game = updateGameAfterEvent(game, {
    id: "s3-3-1", inning: 3, half: "away", batterId: "away-15", pitcherId: "home-1",
    result: "2B", notation: "2B 7", pitches: { balls: 1, strikes: 0, total: 2 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: null, second: "away-15", third: null }, 0);

  // [再次更換代跑 PR] 15棒換下，16棒 (away-16) 代跑
  const subPR2: Substitution = {
    id: "sub-pr-2", inning: 3, half: "away", teamId: teams[0].id, type: "代跑",
    playerOutId: "away-15", playerInId: "away-16", position: "代跑", timestamp: new Date().toISOString(),
  };
  game = {
    ...game,
    substitutions: [...game.substitutions, subPR2],
    runners: { first: null, second: "away-16", third: null },
  };

  // 1棒 (away-1): HR 兩分砲
  game = updateGameAfterEvent(game, {
    id: "s3-3-2", inning: 3, half: "away", batterId: "away-1", pitcherId: "home-1",
    result: "HR", notation: "HR 7", pitches: { balls: 2, strikes: 1, total: 3 },
    outsBefore: 0, runsScored: 2, recordColumn: { rbi: 2 },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 2, [
    { runnerId: "away-16", fromBase: 2, toBase: 4 },
  ]);

  // 斷言確認：次一打席打序應正確推進至 2棒 (away-2)
  const nextBatter = getCurrentBatter(game, teams[0]);

  const awayStats = getBattingStats(game, teams[0]);
  const pr11Runs = awayStats.find((s) => s.player.id === "away-11")?.r ?? 0;
  const pr16Runs = awayStats.find((s) => s.player.id === "away-16")?.r ?? 0;
  const batter1Runs = awayStats.find((s) => s.player.id === "away-1")?.r ?? 0;
  const batter1Rbi = awayStats.find((s) => s.player.id === "away-1")?.rbi ?? 0;

  const pitchingStats13 = getPitchingStats(game, teams[0]).find((p) => p.player.id === "away-13");

  return {
    game,
    teams,
    assertions: {
      pr11Score: pr11Runs,
      pr16Score: pr16Runs,
      batter1Score: batter1Runs,
      batter1Rbi: batter1Rbi,
      rp13Strikeouts: pitchingStats13?.so ?? 0,
      nextBatterId: nextBatter.id,
      isNextBatter2nd: nextBatter.id === "away-2",
    },
  };
}

/**
 * 🎬 劇本四：野手選擇、失誤與極端防守 (FC, Error, Time Play)
 */
export function runScenario4() {
  const teams = createScenarioTeams();
  let game = createScenarioBaseGame(teams);

  // --- 一局上 (客隊攻擊) ---
  // 1棒 (away-1): 1B
  game = updateGameAfterEvent(game, {
    id: "s4-1-1", inning: 1, half: "away", batterId: "away-1", pitcherId: "home-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-1", second: null, third: null }, 0);

  // 2棒 (away-2): FC 游擊滾地球，傳二壘封殺一壘跑者，打者安全上一壘
  game = updateGameAfterEvent(game, {
    id: "s4-1-2", inning: 1, half: "away", batterId: "away-2", pitcherId: "home-1",
    result: "G", notation: "FC 6", pitches: { balls: 1, strikes: 1, total: 2 },
    outsBefore: 0, runsScored: 0, recordColumn: { fieldingPlay: "FC" },
    timestamp: new Date().toISOString(),
  }, { first: "away-2", second: null, third: null }, 0);

  // 3棒 (away-3): 三壘滾地球，三壘手失誤 E5
  game = updateGameAfterEvent(game, {
    id: "s4-1-3", inning: 1, half: "away", batterId: "away-3", pitcherId: "home-1",
    result: "E", notation: "E5", pitches: { balls: 2, strikes: 0, total: 2 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-3", second: "away-2", third: null }, 0);

  // 4棒 (away-4): 6-4-3 GIDP 雙殺
  game = updateGameAfterEvent(game, {
    id: "s4-1-4", inning: 1, half: "away", batterId: "away-4", pitcherId: "home-1",
    result: "G", notation: "6-4-3 GIDP", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 0, recordColumn: { fieldingPlay: "DP" },
    timestamp: new Date().toISOString(),
  }, { first: null, second: null, third: null }, 0);

  // --- 二局下 (主隊攻擊) ---
  // 5, 6, 7棒保送形成滿壘
  game = updateGameAfterEvent(game, {
    id: "s4-2-1", inning: 2, half: "home", batterId: "home-5", pitcherId: "away-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-5", second: null, third: null }, 0);

  game = updateGameAfterEvent(game, {
    id: "s4-2-2", inning: 2, half: "home", batterId: "home-6", pitcherId: "away-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-6", second: "home-5", third: null }, 0);

  game = updateGameAfterEvent(game, {
    id: "s4-2-3", inning: 2, half: "home", batterId: "home-7", pitcherId: "away-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 2, total: 6 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "home-7", second: "home-6", third: "home-5" }, 0);

  // 8棒 (home-8): 游擊滾地傳本壘封殺三壘跑者，捕手再傳一壘完成 6-2-3 雙殺，其他跑者分佔二三壘
  game = updateGameAfterEvent(game, {
    id: "s4-2-4", inning: 2, half: "home", batterId: "home-8", pitcherId: "away-1",
    result: "G", notation: "6-2-3 DP", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 0, runsScored: 0, recordColumn: { fieldingPlay: "DP" },
    timestamp: new Date().toISOString(),
  }, { first: null, second: "home-7", third: "home-6" }, 0);

  // 9棒 (home-9): K
  game = updateGameAfterEvent(game, {
    id: "s4-2-5", inning: 2, half: "home", batterId: "home-9", pitcherId: "away-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  // --- 三局上 (Time Play 壓力測試) ---
  // 設定狀態：2 出局，二三壘有人
  const timePlayRunnersBefore: RunnerState = { first: null, second: "away-2", third: "away-1" };
  const timePlayCheck = checkTimePlayCondition({
    result: "F",
    baseOfOut: 3, // 二壘跑者在三壘前被觸殺（非封殺狀態）
    runnersBefore: timePlayRunnersBefore,
    outsBefore: 2,
  });

  return {
    game,
    teams,
    assertions: {
      timePlayRequiresConfirmation: timePlayCheck.requireTimePlayConfirmation,
      timePlayIsForcePlayOut: timePlayCheck.isForcePlayOut,
    },
  };
}

/**
 * 🎬 劇本五：無盡的半局 (一輪猛攻與強制進壘防呆)
 */
export function runScenario5() {
  const teams = createScenarioTeams();
  let game = createScenarioBaseGame(teams);

  // --- 一局上 (打滿 12 人次) ---
  // 1棒: 1B
  game = updateGameAfterEvent(game, {
    id: "s5-1", inning: 1, half: "away", batterId: "away-1", pitcherId: "home-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-1", second: null, third: null }, 0);

  // 2棒: BB
  game = updateGameAfterEvent(game, {
    id: "s5-2", inning: 1, half: "away", batterId: "away-2", pitcherId: "home-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 0, total: 4 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-2", second: "away-1", third: null }, 0);

  // 3棒: 1B (滿壘)
  game = updateGameAfterEvent(game, {
    id: "s5-3", inning: 1, half: "away", batterId: "away-3", pitcherId: "home-1",
    result: "1B", notation: "1B", pitches: { balls: 1, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-3", second: "away-2", third: "away-1" }, 0);

  // 4棒: HBP (觸身球) 滿壘強制推進
  const forcedResult4 = resolveForcedAdvances(game.runners, "away-4");
  game = updateGameAfterEvent(game, {
    id: "s5-4", inning: 1, half: "away", batterId: "away-4", pitcherId: "home-1",
    result: "HBP", notation: "HBP", pitches: { balls: 1, strikes: 0, total: 1 },
    outsBefore: 0, runsScored: 1, recordColumn: { rbi: 1 },
    timestamp: new Date().toISOString(),
  }, forcedResult4.runners, 1, [
    { runnerId: "away-1", fromBase: 3, toBase: 4 },
  ]);

  // 5棒: K
  game = updateGameAfterEvent(game, {
    id: "s5-5", inning: 1, half: "away", batterId: "away-5", pitcherId: "home-1",
    result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
    outsBefore: 0, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  // 6棒: BB 滿壘保送再擠回1分
  const forcedResult6 = resolveForcedAdvances(game.runners, "away-6");
  game = updateGameAfterEvent(game, {
    id: "s5-6", inning: 1, half: "away", batterId: "away-6", pitcherId: "home-1",
    result: "BB", notation: "BB", pitches: { balls: 4, strikes: 1, total: 5 },
    outsBefore: 1, runsScored: 1, recordColumn: { rbi: 1 },
    timestamp: new Date().toISOString(),
  }, forcedResult6.runners, 1, [
    { runnerId: "away-2", fromBase: 3, toBase: 4 },
  ]);

  // 7棒: 1B (2分打點)
  game = updateGameAfterEvent(game, {
    id: "s5-7", inning: 1, half: "away", batterId: "away-7", pitcherId: "home-1",
    result: "1B", notation: "1B", pitches: { balls: 0, strikes: 0, total: 1 },
    outsBefore: 1, runsScored: 2, recordColumn: { rbi: 2 },
    timestamp: new Date().toISOString(),
  }, { first: "away-7", second: "away-6", third: null }, 2, [
    { runnerId: "away-3", fromBase: 3, toBase: 4 },
    { runnerId: "away-4", fromBase: 2, toBase: 4 },
  ]);

  // 8棒: E6
  game = updateGameAfterEvent(game, {
    id: "s5-8", inning: 1, half: "away", batterId: "away-8", pitcherId: "home-1",
    result: "E", notation: "E6", pitches: { balls: 2, strikes: 1, total: 3 },
    outsBefore: 1, runsScored: 0, timestamp: new Date().toISOString(),
  }, { first: "away-8", second: "away-7", third: "away-6" }, 0);

  // 9棒: 2B (2分打點)
  game = updateGameAfterEvent(game, {
    id: "s5-9", inning: 1, half: "away", batterId: "away-9", pitcherId: "home-1",
    result: "2B", notation: "2B", pitches: { balls: 1, strikes: 0, total: 1 },
    outsBefore: 1, runsScored: 2, recordColumn: { rbi: 2 },
    timestamp: new Date().toISOString(),
  }, { first: null, second: "away-9", third: "away-8" }, 2, [
    { runnerId: "away-6", fromBase: 3, toBase: 4 },
    { runnerId: "away-7", fromBase: 2, toBase: 4 },
  ]);

  // 1棒 (第二次上場): SF (1分打點)
  game = updateGameAfterEvent(game, {
    id: "s5-10", inning: 1, half: "away", batterId: "away-1", pitcherId: "home-1",
    result: "F", notation: "SF 8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 1, runsScored: 1, recordColumn: { modifiers: ["SF"], rbi: 1 },
    timestamp: new Date().toISOString(),
  }, { first: null, second: "away-9", third: null }, 1, [
    { runnerId: "away-8", fromBase: 3, toBase: 4 },
  ]);

  // 2棒 (第二次上場): 1B (1分打點)
  game = updateGameAfterEvent(game, {
    id: "s5-11", inning: 1, half: "away", batterId: "away-2", pitcherId: "home-1",
    result: "1B", notation: "1B", pitches: { balls: 1, strikes: 1, total: 2 },
    outsBefore: 2, runsScored: 1, recordColumn: { rbi: 1 },
    timestamp: new Date().toISOString(),
  }, { first: "away-2", second: null, third: null }, 1, [
    { runnerId: "away-9", fromBase: 2, toBase: 4 },
  ]);

  // 3棒 (第二次上場): 8 接殺 (第 3 出局)
  game = updateGameAfterEvent(game, {
    id: "s5-12", inning: 1, half: "away", batterId: "away-3", pitcherId: "home-1",
    result: "F", notation: "8", pitches: { balls: 0, strikes: 1, total: 1 },
    outsBefore: 2, runsScored: 0, timestamp: new Date().toISOString(),
  }, game.runners, 0);

  const top1Runs = game.score.find((s) => s.inning === 1)?.away ?? 0;

  // --- 一局下 (主隊攻擊) --- 三上三下
  for (let i = 1; i <= 3; i++) {
    game = updateGameAfterEvent(game, {
      id: `s5-bot1-${i}`, inning: 1, half: "home", batterId: `home-${i}`, pitcherId: "away-1",
      result: "K", notation: "K", pitches: { balls: 0, strikes: 3, total: 3 },
      outsBefore: i - 1, runsScored: 0, timestamp: new Date().toISOString(),
    }, game.runners, 0);
  }

  // --- 二局上 ---
  const top2StartBatter = getCurrentBatter(game, teams[0]);

  return {
    game,
    teams,
    assertions: {
      top1TotalRuns: top1Runs,
      isTop1EightRuns: top1Runs === 8,
      top2StartBatterId: top2StartBatter.id,
      isTop2StartBatter4th: top2StartBatter.id === "away-4",
      runnersClearedAfterInning: game.runners.first === null && game.runners.second === null && game.runners.third === null,
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
