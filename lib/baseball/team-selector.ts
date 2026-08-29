export type TeamSelectorItem = {
  id: string;
  name: string;
};

/** 將使用者所屬隊置頂；若設定已失效，則沿用目前陣列的第一隊。 */
export function orderTeamsWithPrimaryFirst<T extends TeamSelectorItem>(teams: readonly T[], primaryTeamId?: string) {
  const ownedTeamId = teams.some((team) => team.id === primaryTeamId) ? primaryTeamId : teams[0]?.id;
  const orderedTeams = [...teams].sort((left, right) => {
    if (left.id === ownedTeamId) return -1;
    if (right.id === ownedTeamId) return 1;
    return left.name.localeCompare(right.name, "zh-Hant");
  });

  return { ownedTeamId, orderedTeams };
}

/** 收合時僅保留所屬隊及目前選取隊，避免首頁橫式工作區被長名單占滿。 */
export function getVisibleTeams<T extends TeamSelectorItem>(orderedTeams: readonly T[], ownedTeamId: string | undefined, selectedTeamId: string | undefined, expanded: boolean) {
  if (expanded) return [...orderedTeams];
  return orderedTeams.filter((team) => team.id === ownedTeamId || team.id === selectedTeamId);
}
