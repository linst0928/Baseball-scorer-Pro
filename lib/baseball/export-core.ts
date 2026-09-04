import { Game, Team, getGameSummary, getInningRows, formatGameDateTime } from "./types";

type ScoreByInning = { inning: number; away: number; home: number };

export type GameReportFilter = {
  fromInning?: number;
  toInning?: number;
  fromTime?: string;
  toTime?: string;
};

function escapeCsv(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/** 僅輸出已核對場次可安全提供的基本資料與逐局比分，不補造逐球或個人統計。 */
export function buildGameScoreCsv(game: Game, away: Team, home: Team): string {
  const summary = getGameSummary(game, [away, home]);
  const lines = [
    ["欄位", "內容"],
    ["比賽名稱", game.name],
    ["日期時間", formatGameDateTime(game)],
    ["賽事", game.competition || ""],
    ["場地", game.venue || ""],
    ["客隊", away.name],
    ["主隊", home.name],
    ["客隊總分", summary.awayRuns],
    ["主隊總分", summary.homeRuns],
    [],
    ["逐局比分"],
    ["局", "客隊", "主隊"],
    ...getInningRows(game).map((row) => [row.inning, row.away, row.home]),
  ];
  return lines.map((row) => row.map((value) => escapeCsv(value ?? "")).join(",")).join("\r\n");
}

function isInReportRange(inning: number, timestamp: string, filter?: GameReportFilter): boolean {
  const fromInning = Math.max(1, filter?.fromInning ?? 1);
  const toInning = Math.max(fromInning, filter?.toInning ?? 15);
  if (inning < fromInning || inning > toInning) return false;
  const time = new Date(timestamp).getTime();
  if (filter?.fromTime && time < new Date(filter.fromTime).getTime()) return false;
  if (filter?.toTime && time > new Date(filter.toTime).getTime()) return false;
  return true;
}

export function filterGameForReport(game: Game, filter?: GameReportFilter): Game {
  if (!filter || (filter.fromInning === undefined && filter.toInning === undefined && !filter.fromTime && !filter.toTime)) return game;
  const fromInning = Math.max(1, filter.fromInning ?? 1);
  const toInning = Math.max(fromInning, filter.toInning ?? game.maxInnings);
  const events = game.events.filter((event) => isInReportRange(event.inning, event.timestamp, filter));
  const specialEvents = (game.specialEvents ?? []).filter((event) => isInReportRange(event.inning, event.timestamp, filter));
  const substitutions = game.substitutions.filter((event) => isInReportRange(event.inning, event.timestamp, filter));
  const score = game.score.filter((row) => row.inning >= fromInning && row.inning <= toInning).map((row) => ({ ...row }));
  if (filter.fromTime || filter.toTime) {
    const selectedScore = new Map<number, ScoreByInning>(score.map((row) => [row.inning, { inning: row.inning, away: 0, home: 0 }]));
    [...events.map((event) => ({ inning: event.inning, half: event.half, runsScored: event.runsScored })), ...specialEvents.map((event) => ({ inning: event.inning, half: event.half, runsScored: event.runsScored }))].forEach((event) => {
      const row = selectedScore.get(event.inning);
      if (row) row[event.half] += event.runsScored;
    });
    return { ...game, score: Array.from(selectedScore.values()), events, specialEvents, substitutions };
  }
  return { ...game, score, events, specialEvents, substitutions };
}

export function describeFilter(filter?: GameReportFilter): string {
  if (!filter) return "全部紀錄";
  const from = filter.fromInning ?? 1;
  const to = filter.toInning ?? "末局";
  const time = filter.fromTime || filter.toTime ? ` · 時間 ${filter.fromTime ? new Date(filter.fromTime).toLocaleString("zh-TW") : "起始"}–${filter.toTime ? new Date(filter.toTime).toLocaleString("zh-TW") : "現在"}` : "";
  return `第 ${from}–${to} 局${time}`;
}
