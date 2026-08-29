import type { AtBatEvent, AtBatResult, Game, GameLineup, ScoreByInning, Substitution, Team, TeamSide } from "./types";

/**
 * 2013 WBC 公開賽果的唯讀顯示範例。
 *
 * 賽名、日期、階段與最終比分來自 docs/wbc2013-display-example-research.md 所列公開來源。
 * 為壓力測試早稻田連續列而建立的逐打席／換人序列是「展示投影」，不是官方逐球資料；
 * 本模組永不進入 AppData 或 AsyncStorage，也不可在 App 內修改或匯出。
 */
const DISPLAY_REVISION = "wbc2013-display-example-r1";
const POSITIONS = ["投手", "捕手", "一壘", "二壘", "三壘", "游擊", "左外", "中外", "右外"];

export type Wbc2013DisplayExample = {
  id: string;
  label: string;
  coverage: string;
  game: Game;
  away: Team;
  home: Team;
  sourceUrls: string[];
};

function createTeam(id: string, name: string, color: string): Team {
  return {
    id,
    name,
    school: "2013 WBC 顯示範例",
    schoolId: `school-${id}`,
    customColor: color,
    updatedAt: "2013-03-19T00:00:00.000Z",
    players: Array.from({ length: 11 }, (_, index) => ({
      id: `${id}-display-p${index + 1}`,
      number: index + 1,
      name: index < 9 ? `展示先發 ${index + 1}` : `展示候補 ${String.fromCharCode(65 + index - 9)}`,
      position: POSITIONS[index] ?? "替補",
      preferredPositions: index < 9 ? [String(index + 1)] : [],
      bats: index % 3 === 1 ? "L" : "R",
      battingOrder: index < 9 ? index + 1 : undefined,
    })),
  };
}

function createLineup(team: Team): GameLineup {
  const starters = team.players.slice(0, 9);
  return {
    battingOrderIds: starters.map((player) => player.id),
    defensivePositions: Object.fromEntries(starters.map((player, index) => [player.id, String(index + 1)])),
  };
}

function scoreByInning(away: number[], home: number[]): ScoreByInning[] {
  return Array.from({ length: Math.max(away.length, home.length) }, (_, index) => ({
    inning: index + 1,
    away: away[index] ?? 0,
    home: home[index] ?? 0,
  }));
}

function displayNotation(result: AtBatResult, eventIndex: number) {
  if (result === "G") return { notation: "G 6-3", recordColumn: { trajectory: "ground" as const, battedBallPosition: "6", fieldingSequence: "6-3" } };
  if (result === "F") return { notation: "F 7", recordColumn: { trajectory: "fly" as const, battedBallPosition: "7", fieldingSequence: "7" } };
  if (result === "E") return { notation: "E5-3", recordColumn: { trajectory: "ground" as const, battedBallPosition: "5", fieldingSequence: "5-3" } };
  if (result === "K") return { notation: "K", recordColumn: { modifiers: [] } };
  if (result === "BB") return { notation: "BB", recordColumn: { modifiers: [] } };
  if (result === "1B") return { notation: "1B 7", recordColumn: { trajectory: "line" as const, battedBallPosition: "7", rbi: eventIndex % 5 === 0 ? 1 : 0 } };
  if (result === "2B") return { notation: "2B 8", recordColumn: { trajectory: "line" as const, battedBallPosition: "8", rbi: 1 } };
  return { notation: result, recordColumn: { trajectory: "line" as const, battedBallPosition: "9" } };
}

function createDisplayEvents({ gameId, side, battingTeam, fieldingTeam, plateAppearances, scoringByInning, replacementAtInning }: {
  gameId: string;
  side: TeamSide;
  battingTeam: Team;
  fieldingTeam: Team;
  plateAppearances: number[];
  scoringByInning: number[];
  replacementAtInning: number;
}): AtBatEvent[] {
  const resultCycle: AtBatResult[] = ["G", "1B", "F", "BB", "K", "2B", "G", "F", "1B", "E", "G"];
  const pitcher = fieldingTeam.players[0];
  return plateAppearances.flatMap((count, inningIndex) => Array.from({ length: count }, (_, eventIndex) => {
    const battingSlot = (eventIndex + inningIndex * 3) % 9;
    const replacement = inningIndex + 1 >= replacementAtInning && (battingSlot === 2 || battingSlot === 7);
    const playerIndex = replacement ? battingSlot === 2 ? 9 : 10 : battingSlot;
    const result = resultCycle[(eventIndex + inningIndex) % resultCycle.length];
    const notation = displayNotation(result, eventIndex);
    return {
      id: `${gameId}-${side}-${inningIndex + 1}-${eventIndex + 1}`,
      inning: inningIndex + 1,
      half: side,
      batterId: battingTeam.players[playerIndex].id,
      pitcherId: pitcher.id,
      result,
      notation: notation.notation,
      recordColumn: notation.recordColumn,
      pitches: { balls: result === "BB" ? 4 : eventIndex % 2, strikes: result === "K" ? 3 : Math.min(2, (eventIndex + 1) % 3), total: result === "BB" ? 4 : result === "K" ? 3 : 2 + (eventIndex % 3) },
      outsBefore: eventIndex % 3,
      runsScored: eventIndex === 0 ? scoringByInning[inningIndex] ?? 0 : 0,
      hitZone: result === "1B" || result === "2B" ? 7 + (eventIndex % 3) : undefined,
      timestamp: new Date(Date.UTC(2013, 2, 1 + inningIndex, 10, eventIndex)).toISOString(),
    };
  }));
}

function createDisplaySubstitutions(gameId: string, team: Team, side: TeamSide, firstInning: number): Substitution[] {
  return [
    { id: `${gameId}-${side}-sub-1`, inning: firstInning, half: side, teamId: team.id, playerOutId: team.players[2].id, playerInId: team.players[9].id, position: "5", type: "代打", timestamp: "2013-03-08T12:00:00.000Z" },
    { id: `${gameId}-${side}-sub-2`, inning: Math.min(firstInning + 2, 9), half: side, teamId: team.id, playerOutId: team.players[7].id, playerInId: team.players[10].id, position: "8", type: "換守", timestamp: "2013-03-08T12:30:00.000Z" },
  ];
}

function createExample({
  id,
  label,
  coverage,
  date,
  venue,
  round,
  awayName,
  homeName,
  awayColor,
  homeColor,
  awayScores,
  homeScores,
  awayPlateAppearances,
  homePlateAppearances,
  sourceUrls,
}: {
  id: string;
  label: string;
  coverage: string;
  date: string;
  venue: string;
  round: string;
  awayName: string;
  homeName: string;
  awayColor: string;
  homeColor: string;
  awayScores: number[];
  homeScores: number[];
  awayPlateAppearances: number[];
  homePlateAppearances: number[];
  sourceUrls: string[];
}): Wbc2013DisplayExample {
  const away = createTeam(`${id}-away`, awayName, awayColor);
  const home = createTeam(`${id}-home`, homeName, homeColor);
  const score = scoreByInning(awayScores, homeScores);
  const game: Game = {
    id,
    name: `${awayName} vs ${homeName}｜2013 WBC 顯示範例`,
    competition: "2013 WBC 經典賽｜顯示範例（唯讀）",
    venue,
    date,
    weather: "cloudy",
    status: "final",
    awayTeamId: away.id,
    homeTeamId: home.id,
    awayRegisteredPlayerIds: away.players.map((player) => player.id),
    homeRegisteredPlayerIds: home.players.map((player) => player.id),
    awayLineup: createLineup(away),
    homeLineup: createLineup(home),
    inning: score.length,
    half: "home",
    outs: 3,
    awayBatterIndex: 0,
    homeBatterIndex: 0,
    score,
    runners: { first: null, second: null, third: null },
    events: [
      ...createDisplayEvents({ gameId: id, side: "away", battingTeam: away, fieldingTeam: home, plateAppearances: awayPlateAppearances, scoringByInning: awayScores, replacementAtInning: 6 }),
      ...createDisplayEvents({ gameId: id, side: "home", battingTeam: home, fieldingTeam: away, plateAppearances: homePlateAppearances, scoringByInning: homeScores, replacementAtInning: 7 }),
    ],
    specialEvents: [],
    substitutions: [
      ...createDisplaySubstitutions(id, away, "away", 6),
      ...createDisplaySubstitutions(id, home, "home", 7),
    ],
    sourceRevision: DISPLAY_REVISION,
    notes: `【2013 WBC 連續列顯示範例｜唯讀】\n公開核對背景：${round}、${date}、${awayName} ${awayScores.reduce((sum, score) => sum + score, 0)}：${homeScores.reduce((sum, score) => sum + score, 0)} ${homeName}。\n本場打席、傳接與換人是為測試候補列、局內多打席與換人錯位建立的展示投影，並非官方逐球；不會寫入本機資料、現場紀錄、統計或匯出內容。`,
    maxInnings: score.length > 9 ? 15 : 9,
    createdAt: "2013-03-19T00:00:00.000Z",
    updatedAt: "2013-03-19T00:00:00.000Z",
  };
  return { id, label, coverage, game, away, home, sourceUrls };
}

export const WBC2013_DISPLAY_EXAMPLES: Wbc2013DisplayExample[] = [
  createExample({
    id: "wbc2013-japan-chinese-taipei-display",
    label: "日本 4：3 中華台北（10局）",
    coverage: "延長 10 局、候補列、後段追分與局內重複打席",
    date: "2013-03-08 19:00",
    venue: "東京巨蛋",
    round: "東京第二輪",
    awayName: "日本",
    homeName: "中華台北",
    awayColor: "#1D5FA7",
    homeColor: "#D84B42",
    awayScores: [0, 0, 0, 0, 0, 0, 0, 2, 1, 1],
    homeScores: [0, 0, 1, 0, 1, 0, 0, 1, 0, 0],
    awayPlateAppearances: [3, 3, 4, 3, 5, 3, 3, 6, 4, 5],
    homePlateAppearances: [3, 4, 4, 3, 5, 3, 3, 5, 3, 3],
    sourceUrls: ["https://www.mlb.com/world-baseball-classic/history/2013", "https://www.espn.com/world-baseball-classic/game/_/gameId/330308106/japan-chinese-taipei", "https://www.mlb.com/gameday/japan-vs-chinese-taipei/2013/03/08/361276/final/box"],
  }),
  createExample({
    id: "wbc2013-netherlands-cuba-display",
    label: "荷蘭 7：6 古巴",
    coverage: "首局 11 打席、候補鏈與高密度單局連續列",
    date: "2013-03-11 19:00",
    venue: "東京巨蛋",
    round: "東京第二輪",
    awayName: "荷蘭",
    homeName: "古巴",
    awayColor: "#F28C28",
    homeColor: "#C83B44",
    awayScores: [2, 0, 0, 0, 1, 0, 1, 0, 3],
    homeScores: [0, 1, 0, 2, 0, 0, 2, 0, 1],
    awayPlateAppearances: [11, 3, 3, 4, 5, 3, 4, 3, 6],
    homePlateAppearances: [3, 4, 3, 5, 3, 3, 5, 3, 4],
    sourceUrls: ["https://www.mlb.com/world-baseball-classic/history/2013"],
  }),
  createExample({
    id: "wbc2013-puerto-rico-japan-display",
    label: "波多黎各 3：1 日本",
    coverage: "準決賽低比分、投手／守備替換與緊湊連續列",
    date: "2013-03-17 20:00",
    venue: "舊金山 AT&T Park",
    round: "準決賽",
    awayName: "波多黎各",
    homeName: "日本",
    awayColor: "#5A3D8E",
    homeColor: "#1D5FA7",
    awayScores: [0, 0, 1, 0, 0, 2, 0, 0, 0],
    homeScores: [0, 0, 0, 0, 1, 0, 0, 0, 0],
    awayPlateAppearances: [3, 3, 5, 3, 4, 6, 3, 3, 3],
    homePlateAppearances: [3, 3, 3, 4, 5, 3, 3, 3, 3],
    sourceUrls: ["https://www.mlb.com/world-baseball-classic/history/2013"],
  }),
];

export const WBC2013_DISPLAY_GAMES = WBC2013_DISPLAY_EXAMPLES.map((example) => example.game);

export function getWbc2013DisplayExample(gameId: string) {
  return WBC2013_DISPLAY_EXAMPLES.find((example) => example.game.id === gameId);
}

export function isWbc2013DisplayExample(gameId: string) {
  return Boolean(getWbc2013DisplayExample(gameId));
}
