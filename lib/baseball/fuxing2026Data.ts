import type { AppData, Game, Player, ScoreByInning, School, Team } from "./types";

export const FUXING_COMPETITION = "115年高市社區(團)棒球交流賽";
const IMPORTED_AT = "2026-07-23T14:30:00.000Z";
/** 六份原始紀錄表經人工文字層核對後的內建資料修訂。 */
export const FUXING_2026_PDF_SOURCE_REVISION = "fuxing67-pdf-20260723-r1";
export const FUXING_2026_PDF_SOURCE_LABEL = "六份 2026 年 7 月交流賽比賽紀錄表（文字層核對）";

const rosterSource: Array<[number, string, string]> = [
  [1, "何益宏", "投手"],
  [2, "林立維", "投手"],
  [3, "廖莊睿哲", "一壘"],
  [4, "黃𡩣", "三壘"],
  [5, "安冠宇", "投手"],
  [6, "曹森評", "游擊"],
  [8, "林品任", "中外"],
  [10, "許仁義", "捕手"],
  [11, "孫嘉蔚", "左外"],
  [12, "伍奕睿", "二壘"],
  [13, "王凱毅", "右外"],
  [14, "廖郭恆毅", "替補"],
  [15, "林庠均", "替補"],
  [16, "石晨翔", "捕手"],
];

export const FUXING_PLAYERS: Player[] = rosterSource.map(([number, name, position], index) => ({
  id: `fuxing67-p${number}`,
  number,
  name,
  position,
  bats: "R",
  battingOrder: index + 1,
}));

export type ImportedBattingSummary = {
  playerId: string;
  games: number;
  pa: number;
  ab: number;
  r: number;
  h: number;
  rbi: number;
  twoB: number;
  threeB: number;
  hr: number;
  reachesByWalkOrHitByPitch: number;
  so: number;
  sb: number;
  cs: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
};

export type ImportedPitchingSummary = {
  playerId: string;
  ip: string;
  h: number;
  so: number;
  walksOrHitByPitch: number;
};

/** 來源全隊累計列；BB/HBP 維持原 PDF「四壞、觸身」合併口徑。 */
export const FUXING_CUP_TEAM_BATTING_SUMMARY = {
  games: 6,
  pa: 155,
  ab: 116,
  r: 37,
  h: 43,
  rbi: 27,
  twoB: 3,
  threeB: 0,
  hr: 0,
  reachesByWalkOrHitByPitch: 39,
  so: 26,
  avg: 0.371,
  obp: 0.529,
  slg: 0.397,
  ops: 0.926,
};

/**
 * 來源：2026.07_115年社區(團)交流賽_個人成績統計.pdf。
 * 原表將四壞與觸身合併，故本欄位保持原始合併口徑；不可將它反推為逐打席資料。
 */
export const FUXING_CUP_BATTING_SUMMARY: ImportedBattingSummary[] = [
  [1, 6, 18, 16, 4, 9, 3, 0, 0, 0, 2, 2, 3, 0, .563, .611, .563, 1.174],
  [2, 5, 13, 8, 4, 4, 3, 0, 0, 0, 5, 1, 8, 0, .500, .692, .500, 1.192],
  [3, 5, 5, 4, 0, 1, 0, 0, 0, 0, 1, 3, 2, 0, .250, .400, .250, .650],
  [4, 5, 8, 3, 2, 1, 0, 0, 0, 0, 5, 1, 6, 0, .333, .750, .333, 1.083],
  [5, 5, 11, 10, 2, 3, 1, 2, 0, 0, 1, 3, 2, 0, .300, .364, .500, .864],
  [6, 6, 17, 13, 2, 3, 3, 0, 0, 0, 4, 0, 9, 0, .231, .412, .231, .643],
  [8, 5, 10, 9, 2, 2, 3, 0, 0, 0, 1, 2, 5, 0, .222, .300, .222, .522],
  [10, 6, 18, 10, 3, 4, 1, 0, 0, 0, 8, 3, 11, 0, .400, .667, .400, 1.067],
  [11, 3, 5, 4, 1, 1, 1, 0, 0, 0, 1, 1, 0, 0, .250, .400, .250, .650],
  [12, 6, 13, 10, 6, 6, 4, 1, 0, 0, 3, 4, 4, 1, .600, .692, .700, 1.392],
  [13, 6, 8, 8, 4, 2, 2, 0, 0, 0, 0, 2, 3, 0, .250, .250, .250, .500],
  [14, 2, 3, 1, 1, 0, 0, 0, 0, 0, 2, 1, 3, 0, .000, .667, .000, .667],
  [15, 5, 8, 7, 1, 2, 1, 0, 0, 0, 1, 2, 3, 0, .286, .375, .286, .661],
  [16, 6, 18, 13, 5, 5, 5, 0, 0, 0, 5, 1, 4, 0, .385, .556, .385, .940],
].map(([number, games, pa, ab, r, h, rbi, twoB, threeB, hr, reachesByWalkOrHitByPitch, so, sb, cs, avg, obp, slg, ops]) => ({
  playerId: `fuxing67-p${number}`,
  games,
  pa,
  ab,
  r,
  h,
  rbi,
  twoB,
  threeB,
  hr,
  reachesByWalkOrHitByPitch,
  so,
  sb,
  cs,
  avg,
  obp,
  slg,
  ops,
}));

/** 同一附件的投手累計欄；R／ER 未在來源中可分辨，因此不以推測值呈現。 */
export const FUXING_CUP_PITCHING_SUMMARY: ImportedPitchingSummary[] = ([
  [1, "1.0", 1, 2, 3],
  [2, "4.2", 7, 3, 5],
  [5, "0.1", 1, 0, 3],
  [6, "3.1", 3, 7, 6],
  [10, "1.2", 1, 2, 4],
  [16, "12.2", 6, 10, 6],
] as Array<[number, string, number, number, number]>).map(([number, ip, h, so, walksOrHitByPitch]) => ({ playerId: `fuxing67-p${number}`, ip, h, so, walksOrHitByPitch }));

export const FUXING_SCHOOL: School = {
  id: "school-fuxing67",
  name: "復興少棒67",
  players: FUXING_PLAYERS,
  createdAt: IMPORTED_AT,
  updatedAt: IMPORTED_AT,
};

export const FUXING_TEAM: Team = {
  id: "team-fuxing67",
  name: "復興少棒67",
  school: FUXING_SCHOOL.name,
  schoolId: FUXING_SCHOOL.id,
  players: FUXING_PLAYERS,
  updatedAt: IMPORTED_AT,
};

function createOpponent(name: string, slug: string): Team {
  const players: Player[] = Array.from({ length: 9 }, (_, index) => ({
    id: `${slug}-p${index + 1}`,
    number: index + 1,
    name: `${name}${index + 1}號`,
    position: ["投手", "捕手", "一壘", "二壘", "三壘", "游擊", "左外", "中外", "右外"][index],
    bats: "R",
    battingOrder: index + 1,
  }));
  return { id: `team-${slug}`, name, school: name, schoolId: `school-${slug}`, players, updatedAt: IMPORTED_AT };
}

const OPPONENTS = [
  createOpponent("忠孝國小", "zhongxiao"),
  createOpponent("橋仔頭社區", "qiaozitou"),
  createOpponent("強棒（巡航）", "strong-cruise"),
  createOpponent("閃耀之星", "acan-star"),
  createOpponent("中正國小", "zhongzhuang"),
  createOpponent("龍華國小", "longhua"),
];

const opponentById = Object.fromEntries(OPPONENTS.map((team) => [team.id, team]));

function inningScore(fuxing: number[], opponent: number[], fuxingSide: "away" | "home"): ScoreByInning[] {
  const length = Math.max(6, fuxing.length, opponent.length);
  return Array.from({ length }, (_, index) => ({
    inning: index + 1,
    away: fuxingSide === "away" ? fuxing[index] ?? 0 : opponent[index] ?? 0,
    home: fuxingSide === "home" ? fuxing[index] ?? 0 : opponent[index] ?? 0,
  }));
}

function createImportedGame({
  id,
  opponentId,
  date,
  fuxingSide,
  fuxingRuns,
  opponentRuns,
  fuxingInnings,
  opponentInnings,
  venue,
  notes,
}: {
  id: string;
  opponentId: string;
  date: string;
  fuxingSide: "away" | "home";
  fuxingRuns: number;
  opponentRuns: number;
  fuxingInnings: number[];
  opponentInnings: number[];
  venue: string;
  notes: string;
}): Game {
  const opponent = opponentById[opponentId];
  const homeTeamId = fuxingSide === "home" ? FUXING_TEAM.id : opponent.id;
  const awayTeamId = fuxingSide === "away" ? FUXING_TEAM.id : opponent.id;
  const score = inningScore(fuxingInnings, opponentInnings, fuxingSide);
  const scoreCheck = score.reduce((total, row) => total + (fuxingSide === "away" ? row.away : row.home), 0);
  const opponentScoreCheck = score.reduce((total, row) => total + (fuxingSide === "away" ? row.home : row.away), 0);
  if (scoreCheck !== fuxingRuns || opponentScoreCheck !== opponentRuns) {
    throw new Error(`Imported score mismatch for ${id}`);
  }
  return {
    id,
    name: `${FUXING_TEAM.name} × ${opponent.name}`,
    competition: FUXING_COMPETITION,
    venue,
    date,
    weather: "sunny",
    status: "final",
    homeTeamId,
    awayTeamId,
    homeRegisteredPlayerIds: homeTeamId === FUXING_TEAM.id ? FUXING_PLAYERS.map((player) => player.id) : opponent.players.map((player) => player.id),
    awayRegisteredPlayerIds: awayTeamId === FUXING_TEAM.id ? FUXING_PLAYERS.map((player) => player.id) : opponent.players.map((player) => player.id),
    inning: score.length,
    half: "home",
    outs: 3,
    awayBatterIndex: 0,
    homeBatterIndex: 0,
    score,
    runners: { first: null, second: null, third: null },
    events: [],
    specialEvents: [],
    substitutions: [],
    sourceRevision: FUXING_2026_PDF_SOURCE_REVISION,
    notes: `【附件逐場紀錄核對】\n來源修訂：${FUXING_2026_PDF_SOURCE_REVISION}\n來源：${FUXING_2026_PDF_SOURCE_LABEL}\n表上比分：${FUXING_TEAM.name} ${fuxingRuns}：${opponentRuns} ${opponent.name}\n${notes}\n僅回填可與內建場次 ID 對應的賽事基本資料、逐局與比分；無法可靠辨識的手寫打席符號、跑壘及投球軌跡不予推測，不建立逐球事件或個人統計。`,
    maxInnings: 6,
    createdAt: IMPORTED_AT,
    updatedAt: IMPORTED_AT,
  };
}

export const FUXING_2026_GAMES: Game[] = [
  createImportedGame({
    id: "fuxing67-20260721-0830-zhongxiao",
    opponentId: "team-zhongxiao",
    date: "2026-07-21 08:30",
    fuxingSide: "away",
    fuxingRuns: 2,
    opponentRuns: 3,
    fuxingInnings: [0, 0, 2],
    opponentInnings: [2, 0, 1],
    venue: "迷馬力（東）",
    notes: "對手：忠孝國小。首局上下雨且一局下暫停；紀錄另註記忠孝國小未攜帶證件而判負。行政判決與表上 2：3 比分衝突，因此保留表上逐局與比分，不自動改寫為行政判決結果。",
  }),
  createImportedGame({
    id: "fuxing67-20260721-1430-qiaozitou",
    opponentId: "team-qiaozitou",
    date: "2026-07-21 14:30",
    fuxingSide: "home",
    fuxingRuns: 2,
    opponentRuns: 0,
    fuxingInnings: [2, 0, 0],
    opponentInnings: [0, 0, 0],
    venue: "迷馬力（東）",
    notes: "對手：橋仔頭社區。PDF 逐局與正式總分為橋仔頭社區 0：2 復興少棒67；同份打擊摘要的 RBI 合計為 13，與比分不一致，故不以該摘要建立個人統計或逐球紀錄。",
  }),
  createImportedGame({
    id: "fuxing67-20260722-1000-strong-cruise",
    opponentId: "team-strong-cruise",
    date: "2026-07-22 10:00",
    fuxingSide: "home",
    fuxingRuns: 8,
    opponentRuns: 0,
    fuxingInnings: [8, 0, 0],
    opponentInnings: [0, 0, 0],
    venue: "迷馬力（西）",
    notes: "對手：強棒（巡航）。PDF 逐局與正式總分為強棒（巡航）0：8 復興少棒67；打擊摘要的 RBI 合計為 19，與比分不一致，故不以該摘要建立個人統計或逐球紀錄。",
  }),
  createImportedGame({
    id: "fuxing67-20260723-0830-acan-star",
    opponentId: "team-acan-star",
    date: "2026-07-23 08:30",
    fuxingSide: "away",
    fuxingRuns: 2,
    opponentRuns: 0,
    fuxingInnings: [0, 0, 0, 2],
    opponentInnings: [0, 0, 0, 0],
    venue: "迷瑪力（西）",
    notes: "對手：閃耀之星。PDF 逐局與最終比分為復興少棒67 2：0 閃耀之星；打擊摘要的 RBI 合計為 3，與比分不完全相符，故不以該摘要建立個人統計或逐球紀錄。",
  }),
  createImportedGame({
    id: "fuxing67-20260723-1030-zhongzhuang",
    opponentId: "team-zhongzhuang",
    date: "2026-07-23 10:30",
    fuxingSide: "away",
    fuxingRuns: 4,
    opponentRuns: 3,
    fuxingInnings: [4, 0, 0, 0, 0, 0],
    opponentInnings: [0, 0, 0, 1, 2, 0],
    venue: "迷馬力（西）",
    notes: "對手：中正國小。逐局比分可驗證為復興少棒67 4／0／0／0／0／0、對手 0／0／0／0／1／2。PDF 統計僅保留於來源註記，不建立個人統計或逐球紀錄。",
  }),
  createImportedGame({
    id: "fuxing67-20260723-1300-longhua",
    opponentId: "team-longhua",
    date: "2026-07-22 13:00",
    fuxingSide: "away",
    fuxingRuns: 8,
    opponentRuns: 4,
    fuxingInnings: [2, 2, 3, 1, 0],
    opponentInnings: [4, 0, 0, 0, 0],
    venue: "迷馬力（西）",
    notes: "對手：龍華國小。復興少棒67為客隊，PDF 可辨識復興逐局 2／2／3／1／0，局內小計為 8；PDF 表頭卻標示 0：0，且對手逐局未完整辨識。因此保留既有內建候選總比分 8：4 與其舊有對手逐局分配，不宣稱此兩欄由 PDF 證實，亦不建立個人統計或逐球紀錄。",
  }),
];

/**
 * 僅以下五場的最終比分與雙方逐局均可由已核對的 PDF 文字層確認。
 * 龍華一戰的對手逐局仍屬既有候選值，故刻意不納入 CSV 匯出白名單。
 */
export const FUXING_2026_VERIFIED_SCORE_GAME_IDS = [
  "fuxing67-20260721-0830-zhongxiao",
  "fuxing67-20260721-1430-qiaozitou",
  "fuxing67-20260722-1000-strong-cruise",
  "fuxing67-20260723-0830-acan-star",
  "fuxing67-20260723-1030-zhongzhuang",
] as const;

const verifiedScoreGameIdSet = new Set<string>(FUXING_2026_VERIFIED_SCORE_GAME_IDS);
const verifiedScoreBaselineById = new Map(FUXING_2026_GAMES
  .filter((game) => verifiedScoreGameIdSet.has(game.id))
  .map((game) => [game.id, game]));

/**
 * 僅在場次仍等同核對後的內建基準、且未被使用者現場記錄或編輯時開放 CSV。
 * 這避免把後續修改的本機資料誤標示為已由 PDF 完整核對。
 */
export function isFuxing2026VerifiedScoreGame(game: Game): boolean {
  const baseline = verifiedScoreBaselineById.get(game.id);
  if (!baseline || game.sourceRevision !== FUXING_2026_PDF_SOURCE_REVISION) return false;
  if (game.createdAt !== game.updatedAt || game.events.length > 0 || game.specialEvents.length > 0 || game.substitutions.length > 0) return false;
  return game.name === baseline.name
    && game.date === baseline.date
    && game.competition === baseline.competition
    && game.venue === baseline.venue
    && game.homeTeamId === baseline.homeTeamId
    && game.awayTeamId === baseline.awayTeamId
    && JSON.stringify(game.score) === JSON.stringify(baseline.score);
}

export function createFuxing2026Data(): AppData {
  const opponentSchools: School[] = OPPONENTS.map((team) => ({ id: team.schoolId ?? `school-${team.id}`, name: team.school, players: team.players, createdAt: IMPORTED_AT, updatedAt: IMPORTED_AT }));
  return {
    schools: [FUXING_SCHOOL, ...opponentSchools],
    teams: [FUXING_TEAM, ...OPPONENTS],
    games: FUXING_2026_GAMES,
    activeGameId: FUXING_2026_GAMES[0].id,
    primaryTeamId: FUXING_TEAM.id,
  };
}
