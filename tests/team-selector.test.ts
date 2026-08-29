import { describe, expect, it } from "vitest";

import { getVisibleTeams, orderTeamsWithPrimaryFirst } from "../lib/baseball/team-selector";

describe("首頁隊伍快速切換", () => {
  const teams = [
    { id: "river", name: "河濱少棒" },
    { id: "fuxing", name: "復興少棒67" },
    { id: "sunrise", name: "旭日少棒" },
  ];

  it("會將設定的所屬隊固定排在第一位", () => {
    const { ownedTeamId, orderedTeams } = orderTeamsWithPrimaryFirst(teams, "fuxing");

    expect(ownedTeamId).toBe("fuxing");
    expect(orderedTeams.map((team) => team.id)).toEqual(["fuxing", "sunrise", "river"]);
  });

  it("收合時保留所屬隊與目前正在管理的隊伍，展開時保留完整排序", () => {
    const { ownedTeamId, orderedTeams } = orderTeamsWithPrimaryFirst(teams, "fuxing");

    expect(getVisibleTeams(orderedTeams, ownedTeamId, "sunrise", false).map((team) => team.id)).toEqual(["fuxing", "sunrise"]);
    expect(getVisibleTeams(orderedTeams, ownedTeamId, "sunrise", true).map((team) => team.id)).toEqual(["fuxing", "sunrise", "river"]);
  });

  it("所屬隊設定失效時，會安全地使用目前清單首隊", () => {
    const { ownedTeamId, orderedTeams } = orderTeamsWithPrimaryFirst(teams, "missing-team");

    expect(ownedTeamId).toBe("river");
    expect(orderedTeams[0]?.id).toBe("river");
  });
});
