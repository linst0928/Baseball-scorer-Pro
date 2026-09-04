import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";

import { Game, Team, getGameSummary, getInningRows, formatGameDateTime } from "./types";
import { buildGameScoreCsv, describeFilter, filterGameForReport } from "./export-core";
import type { GameReportFilter } from "./export-core";

export { buildGameScoreCsv, type GameReportFilter } from "./export-core";

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#039;" }[character] ?? character));
}

export function buildGameReportHtml(game: Game, away: Team, home: Team, filter?: GameReportFilter): string {
  const reportGame = filterGameForReport(game, filter);
  const summary = getGameSummary(reportGame, [away, home]);
  const rows = getInningRows(reportGame).map((row) => `<tr><td>${row.inning}</td><td>${row.away}</td><td>${row.home}</td></tr>`).join("");
  const events = reportGame.events.map((event) => `<tr><td>${event.inning}${event.half === "away" ? "上" : "下"}</td><td>${escapeHtml(event.notation)}</td><td>${event.result}</td><td>${event.pitches.total}</td></tr>`).join("");
  const specialEvents = reportGame.specialEvents.map((event) => `<tr><td>${event.inning}${event.half === "away" ? "上" : "下"}</td><td>${escapeHtml(event.notation)}</td><td>${event.type}</td><td>${event.runsScored} 分／${event.outsBefore} 出局</td></tr>`).join("");
  const substitutions = reportGame.substitutions.map((substitution) => { const team = substitution.teamId === away.id ? away : home; const playerOut = team.players.find((player) => player.id === substitution.playerOutId); const playerIn = team.players.find((player) => player.id === substitution.playerInId); return `<tr><td>${substitution.inning}${substitution.half === "away" ? "上" : "下"}</td><td>${escapeHtml(team.name)}</td><td>#${playerOut?.number ?? "?"} → #${playerIn?.number ?? "?"}</td><td>${escapeHtml(substitution.position)}</td></tr>`; }).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    @page { margin: 24px; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", Arial, sans-serif; color: #10243E; }
    h1 { margin: 0 0 4px; color: #123A68; font-size: 24px; }
    h2 { margin-top: 24px; color: #1D5FA7; font-size: 16px; }
    p { color: #6A7A8F; margin: 4px 0; }
    .score { margin-top: 20px; padding: 16px; background: #EAF3FB; border-radius: 12px; font-size: 18px; font-weight: 700; }
    .summary { display: flex; gap: 8px; margin-top: 14px; }
    .stat { padding: 10px; background: #F7FAFD; border: 1px solid #D8E2ED; border-radius: 8px; min-width: 70px; }
    .stat b { display: block; font-size: 18px; color: #1D5FA7; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; }
    th, td { border-bottom: 1px solid #D8E2ED; padding: 8px; text-align: left; }
    th { background: #123A68; color: white; }
    .notes { white-space: pre-wrap; padding: 12px; background: #FFF9E9; border: 1px solid #F2DF9E; border-radius: 8px; }
  </style></head><body>
    <h1>${escapeHtml(game.name)}</h1><p>${escapeHtml(away.name)}（客）對 ${escapeHtml(home.name)}（主）</p><p>${escapeHtml(game.venue)} · ${escapeHtml(formatGameDateTime(game))} · ${game.maxInnings} 局制 · 匯出範圍：${escapeHtml(describeFilter(filter))}</p>
    <div class="score">${escapeHtml(away.name)} ${summary.awayRuns}　—　${summary.homeRuns} ${escapeHtml(home.name)}</div>
    <div class="summary"><div class="stat"><b>${summary.hits}</b>安打</div><div class="stat"><b>${summary.walks}</b>四壞</div><div class="stat"><b>${summary.strikeouts}</b>三振</div><div class="stat"><b>${summary.errors}</b>失誤</div></div>
    <h2>逐局比分</h2><table><thead><tr><th>局</th><th>客場</th><th>主場</th></tr></thead><tbody>${rows || '<tr><td colspan="3">選定範圍尚無比分紀錄</td></tr>'}</tbody></table>
    <h2>逐球符號</h2><table><thead><tr><th>局</th><th>紀錄</th><th>結果</th><th>球數</th></tr></thead><tbody>${events || '<tr><td colspan="4">選定範圍尚無逐球紀錄</td></tr>'}</tbody></table>
    <h2>特殊事件</h2><table><thead><tr><th>局</th><th>紀錄</th><th>事件</th><th>影響</th></tr></thead><tbody>${specialEvents || '<tr><td colspan="4">選定範圍尚無特殊事件</td></tr>'}</tbody></table>
    <h2>完整換人紀錄</h2><table><thead><tr><th>局</th><th>球隊</th><th>球員</th><th>位置／角色</th></tr></thead><tbody>${substitutions || '<tr><td colspan="4">選定範圍尚無換人紀錄</td></tr>'}</tbody></table>
    <h2>逐場備註</h2><div class="notes">${escapeHtml(game.notes || "無")}</div>
  </body></html>`;
}

export function buildGameReportSvg(game: Game, away: Team, home: Team, filter?: GameReportFilter): string {
  const reportGame = filterGameForReport(game, filter);
  const summary = getGameSummary(reportGame, [away, home]);
  const rows = getInningRows(reportGame).slice(0, 15);
  const inningLabels = rows.map((row, index) => `<text x="${145 + index * 38}" y="270" text-anchor="middle" class="muted">${row.inning}</text>`).join("");
  const awayScores = rows.map((row, index) => `<text x="${145 + index * 38}" y="308" text-anchor="middle" class="ink">${row.away}</text>`).join("");
  const homeScores = rows.map((row, index) => `<text x="${145 + index * 38}" y="345" text-anchor="middle" class="ink">${row.home}</text>`).join("");
  const symbols = reportGame.events.slice(-5).map((event, index) => `<text x="52" y="${440 + index * 30}" class="ink">${event.inning}${event.half === "away" ? "上" : "下"}</text><text x="155" y="${440 + index * 30}" class="blue">${escapeHtml(event.notation)}</text><text x="300" y="${440 + index * 30}" class="muted">${event.result} · ${event.pitches.total}球</text>`).join("");
  const specialSymbols = reportGame.specialEvents.slice(-3).map((event, index) => `<text x="52" y="${590 + index * 22}" class="ink">${event.inning}${event.half === "away" ? "上" : "下"}</text><text x="155" y="${590 + index * 22}" class="blue">${escapeHtml(event.notation)}</text><text x="300" y="${590 + index * 22}" class="muted">${event.type} · ${event.runsScored}分</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="720" viewBox="0 0 720 720"><style>.ink{fill:#10243E;font-family:Arial,"Noto Sans TC",sans-serif}.muted{fill:#6A7A8F;font-family:Arial,"Noto Sans TC",sans-serif}.blue{fill:#1D5FA7;font-family:Arial,"Noto Sans TC",sans-serif;font-weight:700}.title{fill:#123A68;font-family:Arial,"Noto Sans TC",sans-serif;font-weight:800}</style><rect width="720" height="720" fill="#F7FAFD"/><rect x="24" y="24" width="672" height="672" rx="24" fill="#FFFFFF" stroke="#D8E2ED"/><text x="52" y="74" font-size="28" class="title">${escapeHtml(game.name)}</text><text x="52" y="102" font-size="15" class="muted">${escapeHtml(away.name)}（客）對 ${escapeHtml(home.name)}（主） · ${escapeHtml(game.venue)}</text><text x="52" y="123" font-size="12" class="muted">匯出範圍：${escapeHtml(describeFilter(filter))}</text><rect x="52" y="140" width="616" height="82" rx="16" fill="#123A68"/><text x="80" y="176" font-size="15" fill="#BBD0E5" font-family="Arial">SCORE</text><text x="80" y="210" font-size="25" fill="#FFFFFF" font-family="Arial" font-weight="700">${escapeHtml(away.name)} ${summary.awayRuns}</text><text x="600" y="210" text-anchor="end" font-size="25" fill="#FFFFFF" font-family="Arial" font-weight="700">${summary.homeRuns} ${escapeHtml(home.name)}</text><text x="52" y="250" font-size="17" class="title">逐局比分</text><line x1="52" y1="282" x2="668" y2="282" stroke="#D8E2ED"/>${inningLabels}<text x="80" y="308" class="blue">客</text>${awayScores}<text x="80" y="345" class="blue">主</text>${homeScores}<text x="52" y="395" font-size="17" class="title">逐球符號（最近 5 筆）</text>${symbols || '<text x="52" y="440" class="muted">尚未有逐球紀錄</text>'}<text x="52" y="575" font-size="17" class="title">特殊事件（最近 3 筆）</text>${specialSymbols || '<text x="52" y="610" class="muted">尚未有特殊事件</text>'}<text x="500" y="680" font-size="14" class="muted">安打 ${summary.hits} · 四壞 ${summary.walks} · 三振 ${summary.strikeouts} · 失誤 ${summary.errors} · 特殊 ${reportGame.specialEvents.length} · 換人 ${reportGame.substitutions.length}</text></svg>`;
}

export async function shareGamePdf(game: Game, away: Team, home: Team, filter?: GameReportFilter): Promise<string> {
  const html = buildGameReportHtml(game, away, home, filter);
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return "web-print-dialog";
  }
  const result = await Print.printToFileAsync({ html, width: 612, height: 792, margins: { top: 24, bottom: 24, left: 24, right: 24 } });
  const suffix = filter ? `-${filter.fromInning ?? 1}-${filter.toInning ?? game.maxInnings}` : "";
  const permanentUri = `${FileSystem.documentDirectory}baseball-${game.id}${suffix}.pdf`;
  await FileSystem.copyAsync({ from: result.uri, to: permanentUri });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(permanentUri, { mimeType: "application/pdf", UTI: ".pdf", dialogTitle: "分享比賽 PDF" });
  return permanentUri;
}

export async function shareGameImage(game: Game, away: Team, home: Team, filter?: GameReportFilter): Promise<string> {
  const svg = buildGameReportSvg(game, away, home, filter);
  if (Platform.OS === "web") {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `baseball-${game.id}.svg`;
    anchor.click();
    URL.revokeObjectURL(url);
    return "web-download";
  }
  const suffix = filter ? `-${filter.fromInning ?? 1}-${filter.toInning ?? game.maxInnings}` : "";
  const fileUri = `${FileSystem.documentDirectory}baseball-${game.id}${suffix}.svg`;
  await FileSystem.writeAsStringAsync(fileUri, svg, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: "image/svg+xml", UTI: "public.svg-image", dialogTitle: "分享比賽圖片" });
  return fileUri;
}

/** 以系統分享面板提供 CSV，讓 Android 使用者可另存至試算表或檔案管理器。 */
export async function shareGameScoreCsv(game: Game, away: Team, home: Team): Promise<string> {
  const csv = `\uFEFF${buildGameScoreCsv(game, away, home)}`;
  const filename = `baseball-score-${game.id}.csv`;
  if (Platform.OS === "web") {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    return "web-download";
  }
  const fileUri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: "text/csv", UTI: "public.comma-separated-values-text", dialogTitle: "儲存已核對比賽 CSV" });
  return fileUri;
}

export function filterGameReport(game: Game, filter?: GameReportFilter): Game {
  return filterGameForReport(game, filter);
}

export function describeGameReportFilter(filter?: GameReportFilter): string {
  return describeFilter(filter);
}
