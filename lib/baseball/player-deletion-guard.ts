import type { Game, TeamSide } from "./types";

export type PlayerGameUsage = {
  gameId: string;
  gameName: string;
  date: string;
  inLineup: boolean;
  inRegisteredRoster: boolean;
  inRecordedEvents: boolean;
};

export type PlayerDeletionUsageSummary = {
  games: PlayerGameUsage[];
  lineupGameCount: number;
  registeredGameCount: number;
  recordedGameCount: number;
  requiresWarning: boolean;
};

function sideUsesPlayerRecord(game: Game, side: TeamSide, playerId: string) {
  const isBattingSide = (half: TeamSide) => half === side;
  const isDefendingSide = (half: TeamSide) => half !== side;

  const atBatUsage = game.events.some((event) =>
    (event.batterId === playerId && isBattingSide(event.half)) ||
    (event.pitcherId === playerId && isDefendingSide(event.half)),
  );
  const specialEventUsage = game.specialEvents.some((event) =>
    (event.runnerId === playerId && isBattingSide(event.half)) ||
    (event.pitcherId === playerId && isDefendingSide(event.half)) ||
    (event.catcherId === playerId && isDefendingSide(event.half)),
  );
  const substitutionUsage = game.substitutions.some((event) =>
    event.teamId === (side === "home" ? game.homeTeamId : game.awayTeamId) &&
    (event.playerInId === playerId || event.playerOutId === playerId),
  );

  return atBatUsage || specialEventUsage || substitutionUsage;
}

/**
 * 彙整球員在既有場次中的先發、登錄與逐球／換人紀錄使用範圍。
 * 固定名單異動不會改寫 Game 的快照，但使用中的球員仍需先明確警告使用者。
 */
export function getPlayerDeletionUsage(games: Game[], teamId: string, playerId: string): PlayerDeletionUsageSummary {
  const usages = games.flatMap((game) => {
    const sides: TeamSide[] = [];
    if (game.homeTeamId === teamId) sides.push("home");
    if (game.awayTeamId === teamId) sides.push("away");

    if (!sides.length) return [];

    const inLineup = sides.some((side) => {
      const lineup = side === "home" ? game.homeLineup : game.awayLineup;
      return Boolean(lineup?.battingOrderIds.includes(playerId) || (lineup && Object.prototype.hasOwnProperty.call(lineup.defensivePositions, playerId)));
    });
    const inRegisteredRoster = sides.some((side) => (side === "home" ? game.homeRegisteredPlayerIds : game.awayRegisteredPlayerIds)?.includes(playerId) ?? false);
    const inRecordedEvents = sides.some((side) => sideUsesPlayerRecord(game, side, playerId));

    return inLineup || inRegisteredRoster || inRecordedEvents
      ? [{ gameId: game.id, gameName: game.name, date: game.date, inLineup, inRegisteredRoster, inRecordedEvents }]
      : [];
  });

  const lineupGameCount = usages.filter((usage) => usage.inLineup).length;
  const registeredGameCount = usages.filter((usage) => usage.inRegisteredRoster).length;
  const recordedGameCount = usages.filter((usage) => usage.inRecordedEvents).length;

  return {
    games: usages,
    lineupGameCount,
    registeredGameCount,
    recordedGameCount,
    requiresWarning: lineupGameCount > 0 || recordedGameCount > 0,
  };
}
