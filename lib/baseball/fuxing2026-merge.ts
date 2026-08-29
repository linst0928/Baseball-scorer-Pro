import { createFuxing2026Data, FUXING_2026_PDF_SOURCE_REVISION, FUXING_TEAM } from "./fuxing2026Data";
import { normalizeAppData, type AppData, type Game, type School, type Team } from "./types";

const LEGACY_SAMPLE_TEAM_NAMES = ["山城國小", "海風國小", "海豐國小", "中華隊", "日本隊"];
const LEGACY_SAMPLE_SCHOOL_NAMES = ["山城學校", "海風學校", "海豐國小", "中華隊", "日本隊"];

function isLegacySampleGame(game: Game): boolean {
  return game.name.includes("2013 WBC") || game.competition?.includes("2013 WBC") === true || game.homeTeamId === "team-home" || game.awayTeamId === "team-away";
}

/**
 * 僅將「沒有逐球、特殊事件、換人或比賽資訊編輯痕跡」的舊內建場次提升至最新 PDF 修訂。
 * App 的賽事編輯與開始記錄均會更新 updatedAt；因此 createdAt 與 updatedAt 不同時，一律保留使用者資料。
 * 任何可能經使用者現場編輯的場次均完整保留，已刪除的內建場次也不會復活。
 */
export function canSafelyRefreshFuxingBuiltinGame(game: Game): boolean {
  const noRecordedActivity = game.events.length === 0 && game.specialEvents.length === 0 && game.substitutions.length === 0;
  const isPristineTimestamp = game.createdAt === game.updatedAt;
  const requiresUpgrade = game.sourceRevision !== FUXING_2026_PDF_SOURCE_REVISION;
  return noRecordedActivity && isPristineTimestamp && requiresUpgrade;
}

function mergeBuiltins<T extends { id: string }>(current: T[], imported: T[]): T[] {
  const currentById = new Map(current.map((item) => [item.id, item]));
  return [...current, ...imported.filter((item) => !currentById.has(item.id))];
}

export function mergeFuxingImport(current?: AppData): AppData {
  const imported = createFuxing2026Data();
  if (!current) return imported;

  const deletedGameIds = current.deletedGameIds ?? [];
  const deletedGameIdSet = new Set(deletedGameIds);
  const importedGameById = new Map(imported.games.map((game) => [game.id, game]));
  const retainedGames = current.games.filter((game) => !isLegacySampleGame(game));
  const games = retainedGames
    .map((game) => {
      const latest = importedGameById.get(game.id);
      return latest && canSafelyRefreshFuxingBuiltinGame(game) ? latest : game;
    })
    .concat(imported.games.filter((game) => !retainedGames.some((currentGame) => currentGame.id === game.id) && !deletedGameIdSet.has(game.id)));

  const retainedTeams = current.teams.filter((team) => !LEGACY_SAMPLE_TEAM_NAMES.includes(team.name) && team.id !== "team-home" && team.id !== "team-away");
  const retainedSchools = current.schools.filter((school) => !LEGACY_SAMPLE_SCHOOL_NAMES.includes(school.name));
  const teams = mergeBuiltins<Team>(retainedTeams, imported.teams);
  const schools = mergeBuiltins<School>(retainedSchools, imported.schools);
  const activeGameId = games.some((game) => game.id === current.activeGameId) ? current.activeGameId : games[0]?.id ?? null;
  return normalizeAppData({
    schools,
    teams,
    games,
    primaryTeamId: current.primaryTeamId && teams.some((team) => team.id === current.primaryTeamId) ? current.primaryTeamId : FUXING_TEAM.id,
    activeGameId,
    deletedGameIds,
  });
}
