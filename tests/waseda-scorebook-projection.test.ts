import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createInitialData, type AtBatEvent, type GameLineup, type Substitution, type Team } from "../lib/baseball/types";
import { createWasedaScorebookProjection, getScorebookDisplayOverrideKey, getScorebookSubstitutionMarker } from "../lib/baseball/waseda-scorebook-projection";

const team = (): Team => {
  const source = createInitialData().teams[0];
  return { ...source, players: source.players.map((player) => ({ ...player })) };
};

const pitchState = { balls: 0, strikes: 0, total: 1, locations: [] };

const atBat = (id: string, batterId: string, inning: number, timestamp: string): AtBatEvent => ({
  id,
  inning,
  half: "away",
  batterId,
  pitcherId: "opponent-pitcher",
  result: "1B",
  notation: "1B",
  pitches: { ...pitchState, locations: [] },
  outsBefore: 0,
  runsScored: 0,
  timestamp,
});

const substitution = (id: string, teamId: string, playerOutId: string, playerInId: string, inning: number, timestamp: string): Substitution => ({
  id,
  teamId,
  playerOutId,
  playerInId,
  inning,
  half: "away",
  position: "7",
  type: "代打",
  timestamp,
});

const lineupFor = (sourceTeam: Team): GameLineup => ({
  battingOrderIds: sourceTeam.players.slice(0, 9).map((player) => player.id),
  defensivePositions: Object.fromEntries(sourceTeam.players.slice(0, 9).map((player, index) => [player.id, String(index + 1)])),
});

describe("早稻田單場整體紀錄投影", () => {
  it("保留九個先發棒次、每棒至少兩個候補格，且單局超過九打席不截斷", () => {
    const sourceTeam = team();
    const lineup = lineupFor(sourceTeam);
    const events = Array.from({ length: 10 }, (_, index) => atBat(`ab-${index + 1}`, lineup.battingOrderIds[index % 9], 1, `2026-08-24T00:00:${String(index).padStart(2, "0")}.000Z`));

    const projection = createWasedaScorebookProjection({ team: sourceTeam, side: "away", lineup, events, substitutions: [], inningCount: 1 });

    expect(projection.battingOrders).toHaveLength(9);
    expect(projection.battingOrders.every((order) => order.entries.length >= 3)).toBe(true);
    expect(projection.battingOrders.map((order) => order.entries[0]?.playerId)).toEqual(lineup.battingOrderIds);
    expect(projection.innings[0]?.appearances).toHaveLength(10);
    expect(projection.innings[0]?.appearances.map((appearance) => appearance.eventId)).toEqual(events.map((event) => event.id));
    expect(projection.innings[0]?.slotCount).toBe(10);
    expect(projection.maxPlateAppearances).toBe(10);
  });

  it("沿同棒次換人鏈承接候補列，並保留不同棒次的錯位入局時點", () => {
    const sourceTeam = team();
    const lineup = lineupFor(sourceTeam);
    const [starterOne, starterTwo] = lineup.battingOrderIds;
    const reserveOne = sourceTeam.players[9]?.id ?? "reserve-1";
    const reserveTwo = sourceTeam.players[10]?.id ?? "reserve-2";
    const reserveOtherOrder = sourceTeam.players[11]?.id ?? "reserve-3";
    const changes = [
      substitution("sub-1", sourceTeam.id, starterOne, reserveOne, 3, "2026-08-24T00:03:00.000Z"),
      substitution("sub-2", sourceTeam.id, reserveOne, reserveTwo, 5, "2026-08-24T00:05:00.000Z"),
      substitution("sub-3", sourceTeam.id, starterTwo, reserveOtherOrder, 4, "2026-08-24T00:04:00.000Z"),
    ];
    const events = [
      atBat("start", starterOne, 1, "2026-08-24T00:01:00.000Z"),
      atBat("reserve-1", reserveOne, 3, "2026-08-24T00:03:20.000Z"),
      atBat("reserve-2", reserveTwo, 5, "2026-08-24T00:05:20.000Z"),
    ];

    const projection = createWasedaScorebookProjection({ team: sourceTeam, side: "away", lineup, events, substitutions: changes, inningCount: 5 });
    const firstOrder = projection.battingOrders[0];
    const secondOrder = projection.battingOrders[1];

    expect(firstOrder.entries.slice(0, 3).map((entry) => entry.playerId)).toEqual([starterOne, reserveOne, reserveTwo]);
    expect(firstOrder.entries[1]?.enteredInning).toBe(3);
    expect(firstOrder.entries[2]?.enteredInning).toBe(5);
    expect(secondOrder.entries[1]?.playerId).toBe(reserveOtherOrder);
    expect(secondOrder.entries[1]?.enteredInning).toBe(4);
    expect(projection.innings[2]?.appearances[0]).toMatchObject({ eventId: "reserve-1", battingOrder: 1, entryIndex: 1, appearanceIndex: 0 });
    expect(projection.innings[4]?.appearances[0]).toMatchObject({ eventId: "reserve-2", battingOrder: 1, entryIndex: 2, appearanceIndex: 0 });
  });

  it("同棒次的先發與代打各自保有球員子列，且同一球員同局多次打席只在自己的子列延展", () => {
    const sourceTeam = team();
    const lineup = lineupFor(sourceTeam);
    const starter = lineup.battingOrderIds[0]!;
    const pinchHitter = sourceTeam.players[9]!.id;
    const changes = [substitution("pinch-hit", sourceTeam.id, starter, pinchHitter, 10, "2026-08-24T00:10:00.000Z")];
    const events = [
      atBat("starter-first", starter, 1, "2026-08-24T00:01:00.000Z"),
      atBat("starter-second", starter, 1, "2026-08-24T00:01:30.000Z"),
      atBat("pinch-hit", pinchHitter, 10, "2026-08-24T00:10:20.000Z"),
    ];

    const projection = createWasedaScorebookProjection({ team: sourceTeam, side: "away", lineup, events, substitutions: changes, inningCount: 10 });
    const firstOrder = projection.battingOrders[0]!;
    const starterAppearances = projection.innings[0]!.appearances.filter((appearance) => appearance.battingOrder === 1 && appearance.entryIndex === 0);
    const pinchHitAppearances = projection.innings[9]!.appearances.filter((appearance) => appearance.battingOrder === 1 && appearance.entryIndex === 1);

    expect(firstOrder.entries.slice(0, 2).map((entry) => entry.playerId)).toEqual([starter, pinchHitter]);
    expect(firstOrder.entries[1]).toMatchObject({ kind: "substitute", enteredInning: 10, substitution: { type: "代打" } });
    expect(starterAppearances.map((appearance) => appearance.eventId)).toEqual(["starter-first", "starter-second"]);
    expect(pinchHitAppearances.map((appearance) => appearance.eventId)).toEqual(["pinch-hit"]);
    expect(starterAppearances.every((appearance) => appearance.entryIndex !== pinchHitAppearances[0]?.entryIndex)).toBe(true);
  });

  it("將代打、代跑與換守安全映射為 PH、PR、PF，且只在替換發生局的對應打席投影徽記", () => {
    const sourceTeam = team();
    const lineup = lineupFor(sourceTeam);
    const starter = lineup.battingOrderIds[0]!;
    const [pinchHitter, pinchRunner, pinchFielder] = sourceTeam.players.slice(9, 12).map((player) => player.id);
    const changes: Substitution[] = [
      { ...substitution("ph", sourceTeam.id, starter, pinchHitter!, 2, "2026-08-24T00:02:00.000Z"), type: "代打" },
      { ...substitution("pr", sourceTeam.id, pinchHitter!, pinchRunner!, 3, "2026-08-24T00:03:00.000Z"), type: "代跑" },
      { ...substitution("pf", sourceTeam.id, pinchRunner!, pinchFielder!, 4, "2026-08-24T00:04:00.000Z"), type: "換守" },
    ];
    const events = [
      atBat("ph-at-bat", pinchHitter!, 2, "2026-08-24T00:02:10.000Z"),
      atBat("pr-at-bat", pinchRunner!, 3, "2026-08-24T00:03:10.000Z"),
      atBat("pf-at-bat", pinchFielder!, 4, "2026-08-24T00:04:10.000Z"),
    ];

    const projection = createWasedaScorebookProjection({ team: sourceTeam, side: "away", lineup, events, substitutions: changes, inningCount: 4 });

    expect(getScorebookSubstitutionMarker("代打")).toEqual({ code: "PH", label: "代打" });
    expect(getScorebookSubstitutionMarker("代跑")).toEqual({ code: "PR", label: "代跑" });
    expect(getScorebookSubstitutionMarker("換守")).toEqual({ code: "PF", label: "代守" });
    expect(getScorebookSubstitutionMarker("換投")).toBeUndefined();
    expect(getScorebookSubstitutionMarker()).toBeUndefined();
    expect(projection.innings[1]?.appearances[0]?.replacementBadge).toEqual({ inning: 2, code: "PH", label: "代打" });
    expect(projection.innings[2]?.appearances[0]?.replacementBadge).toEqual({ inning: 3, code: "PR", label: "代跑" });
    expect(projection.innings[3]?.appearances[0]?.replacementBadge).toEqual({ inning: 4, code: "PF", label: "代守" });
  });

  it("只投影正式保存的第 N 球交接，不從完成打席球數猜測舊資料", () => {
    const sourceTeam = team();
    const lineup = lineupFor(sourceTeam);
    const starter = lineup.battingOrderIds[0]!;
    const pinchHitter = sourceTeam.players[9]!.id;
    const preciseChange: Substitution = {
      ...substitution("precise-handoff", sourceTeam.id, starter, pinchHitter, 2, "2026-08-24T00:02:00.000Z"),
      handoffPitchNumber: 2,
    };
    const legacyChange = substitution("legacy-handoff", sourceTeam.id, pinchHitter, sourceTeam.players[10]!.id, 3, "2026-08-24T00:03:00.000Z");
    const changes = [preciseChange, legacyChange];
    const originalChanges = JSON.stringify(changes);
    const events = [
      atBat("precise-at-bat", pinchHitter, 2, "2026-08-24T00:02:20.000Z"),
      atBat("legacy-at-bat", sourceTeam.players[10]!.id, 3, "2026-08-24T00:03:20.000Z"),
    ];

    const projection = createWasedaScorebookProjection({ team: sourceTeam, side: "away", lineup, events, substitutions: changes, inningCount: 3 });

    expect(projection.battingOrders[0]?.entries[1]?.substitution).toMatchObject({ id: "precise-handoff", handoffPitchNumber: 2 });
    expect(projection.innings[1]?.appearances[0]?.replacementBadge).toEqual({ inning: 2, code: "PH", label: "代打", handoffPitchNumber: 2 });
    expect(projection.innings[2]?.appearances[0]?.replacementBadge).toEqual({ inning: 3, code: "PH", label: "代打", handoffPitchNumber: undefined });
    expect(JSON.stringify(changes)).toBe(originalChanges);
  });

  it("將對手換投投影到新投手面對的首位打者格，且不影響原始打席或本隊替換列", () => {
    const sourceTeam = team();
    const lineup = lineupFor(sourceTeam);
    const incomingPitcher = "opponent-pitcher-2";
    const events = [
      atBat("before-change", lineup.battingOrderIds[0]!, 5, "2026-08-24T00:05:00.000Z"),
      { ...atBat("first-faced", lineup.battingOrderIds[1]!, 6, "2026-08-24T00:06:20.000Z"), pitcherId: incomingPitcher },
      { ...atBat("later-faced", lineup.battingOrderIds[2]!, 6, "2026-08-24T00:06:50.000Z"), pitcherId: incomingPitcher },
    ];
    const changes: Substitution[] = [{
      ...substitution("pitching-change", "opponent-team", "opponent-pitcher", incomingPitcher, 6, "2026-08-24T00:06:00.000Z"),
      type: "換投",
      position: "1",
    }];
    const originalEvents = JSON.stringify(events);

    const projection = createWasedaScorebookProjection({ team: sourceTeam, side: "away", lineup, events, substitutions: changes, inningCount: 6 });

    expect(projection.innings[5]?.appearances[0]?.pitchingChangeBadge).toEqual({ code: "P", inning: 6, pitcherId: incomingPitcher });
    expect(projection.innings[5]?.appearances[1]?.pitchingChangeBadge).toBeUndefined();
    expect(JSON.stringify(events)).toBe(originalEvents);
  });

  it("以正式代打與換守紀錄導出守備起訖時間線，不猜測未寫入的守位", () => {
    const sourceTeam = team();
    const lineup = lineupFor(sourceTeam);
    const pinchHitter = sourceTeam.players[9]!.id;
    const leavingFielder = lineup.battingOrderIds[4]!;
    const replacement = sourceTeam.players[10]!.id;
    const changes: Substitution[] = [
      { ...substitution("ph", sourceTeam.id, lineup.battingOrderIds[0]!, pinchHitter, 4, "2026-08-24T00:04:00.000Z"), type: "代打", position: "7" },
      { ...substitution("field", sourceTeam.id, leavingFielder, pinchHitter, 4, "2026-08-24T00:04:30.000Z"), type: "換守", position: "6", half: "home" },
      { ...substitution("field-exit", sourceTeam.id, pinchHitter, replacement, 7, "2026-08-24T00:07:00.000Z"), type: "換守", position: "6", half: "home" },
    ];

    const projection = createWasedaScorebookProjection({ team: sourceTeam, side: "away", lineup, events: [], substitutions: changes, inningCount: 7 });

    expect(projection.defenseTimeline).toContainEqual(expect.objectContaining({ playerId: pinchHitter, position: "6", inning: 4, half: "home", label: "代打後轉守", leftInning: 7, leftHalf: "home" }));
    expect(projection.defenseTimeline.every((item) => item.position !== "7" || item.label !== "代打後轉守")).toBe(true);
  });

  it("同一棒次超過三位替換球員時持續擴充球員子列，不截斷既有打席", () => {
    const sourceTeam = team();
    const lineup = lineupFor(sourceTeam);
    const starter = lineup.battingOrderIds[0]!;
    const replacements = sourceTeam.players.slice(9, 13).map((player) => player.id);
    const changes = replacements.map((playerInId, index) => substitution(
      `sub-${index}`,
      sourceTeam.id,
      index === 0 ? starter : replacements[index - 1]!,
      playerInId,
      index + 2,
      `2026-08-24T00:0${index + 2}:00.000Z`,
    ));

    const projection = createWasedaScorebookProjection({ team: sourceTeam, side: "away", lineup, events: [], substitutions: changes, inningCount: 5 });

    expect(projection.battingOrders[0]!.entries.slice(0, 5).map((entry) => entry.playerId)).toEqual([starter, ...replacements]);
    expect(projection.battingOrders[0]!.entries).toHaveLength(5);
  });

  it("舊場次以實際打席保守回退，並且不修改事件、先發名單或換人資料", () => {
    const sourceTeam = team();
    const events = [atBat("legacy-ab", sourceTeam.players[4]!.id, 2, "2026-08-24T00:02:00.000Z")];
    const substitutions: Substitution[] = [];
    const originalEvents = JSON.stringify(events);
    const originalSubstitutions = JSON.stringify(substitutions);

    const projection = createWasedaScorebookProjection({ team: sourceTeam, side: "away", events, substitutions, inningCount: 2 });

    expect(projection.usesLineupFallback).toBe(true);
    expect(projection.innings[1]?.appearances[0]?.event).toBe(events[0]);
    expect(projection.innings[0]?.appearances).toEqual([]);
    expect(projection.innings[0]?.slotCount).toBe(3);
    expect(JSON.stringify(events)).toBe(originalEvents);
    expect(JSON.stringify(substitutions)).toBe(originalSubstitutions);
  });

  it("有正式棒次快照時第 4 棒不會因出賽時間而置底，替換後仍承接原第 4 棒列", () => {
    const sourceTeam = team();
    const lineup = lineupFor(sourceTeam);
    const fourthBatter = lineup.battingOrderIds[3]!;
    const pinchHitter = sourceTeam.players[9]!.id;
    const events = [
      atBat("fourth-before", fourthBatter, 1, "2026-08-27T00:01:00.000Z"),
      atBat("fourth-after", pinchHitter, 3, "2026-08-27T00:03:20.000Z"),
      atBat("first-later", lineup.battingOrderIds[0]!, 4, "2026-08-27T00:04:00.000Z"),
    ];
    const substitutions = [substitution("fourth-ph", sourceTeam.id, fourthBatter, pinchHitter, 3, "2026-08-27T00:03:00.000Z")];
    const originalLineup = JSON.stringify(lineup);

    const projection = createWasedaScorebookProjection({ team: sourceTeam, side: "away", lineup, events, substitutions, inningCount: 4 });

    expect(projection.battingOrders.map((order) => order.entries[0]?.playerId)).toEqual(lineup.battingOrderIds);
    expect(projection.battingOrders[3]?.entries.slice(0, 2).map((entry) => entry.playerId)).toEqual([fourthBatter, pinchHitter]);
    expect(projection.innings[2]?.appearances[0]).toMatchObject({ eventId: "fourth-after", battingOrder: 4, entryIndex: 1 });
    expect(JSON.stringify(lineup)).toBe(originalLineup);
  });

  it("單場工作台以每棒三格可擴充承接列與每局共享打席格呈現替換，且只為當前打者保留可補登空格", () => {
    const sheetSource = readFileSync(resolve(process.cwd(), "components/baseball/waseda-scorebook-team-sheet.tsx"), "utf8");
    const screenSource = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    expect(sheetSource).toContain("先發 1–9 棒為直向主列；每棒次固定預留三格球員承接欄");
    expect(sheetSource).toContain("單一棒次使用一組三格球員承接列；換人時增加列，但逐局打席格仍由整個棒次共用");
    expect(sheetSource).toContain("const sharedSlotCount");
    expect(sheetSource).toContain("const displayedEntries = order.entries.slice(0, Math.max(3, order.entries.length))");
    expect(sheetSource).toContain("const activeEntry");
    expect(sheetSource).toContain("sharedEntryLane");
    expect(sheetSource).toContain("sharedOrderRow");
    expect(sheetSource).toContain("const appearances = inning.appearances.filter");
    expect(sheetSource).toContain("{appearances.map((appearance,");
    expect(sheetSource).toContain("getScorebookSubstitutionMarker");
    expect(sheetSource).toContain("第${entry.enteredInning}局");
    expect(sheetSource).toContain("replacementBadge={appearance.replacementBadge}");
    expect(sheetSource).toContain("sharedEntryRoleChipPH");
    expect(sheetSource).toContain("sharedEntryRoleChipPR");
    expect(sheetSource).toContain("sharedEntryRoleChipPF");
    expect(sheetSource).toContain("替換角色標籤");
    expect(sheetSource).toContain("sharedEntryHandoff");
    expect(sheetSource).toContain("第${entry.enteredInning}局${entry.enteredHalf ? halfLabel(entry.enteredHalf) : \"\"}起");
    expect(sheetSource).toContain("const substitutionInnings");
    expect(sheetSource).toContain("const visibleInnings");
    expect(sheetSource).toContain("僅替換局：");
    expect(sheetSource).toContain("numberOfLines={1} ellipsizeMode=\"tail\"");
    expect(sheetSource).toContain("handoffPitchNumber");
    expect(sheetSource).toContain("pitchingChangeBadge={appearance.pitchingChangeBadge");
    expect(sheetSource).toContain("守備轉換時間線");
    expect(screenSource).toContain("opponentTeam={side === \"away\" ? home : away}");
    expect(sheetSource).toContain("blankReplacementBadge");
    expect(sheetSource).not.toContain("inning.slotCount - appearances.length");
    expect(sheetSource).toContain("先攻打擊");
    expect(sheetSource).toContain("打序");
    expect(sheetSource).toContain("每棒次為一列；左側固定三格球員承接欄，右側每局共享一組實際打席格");
    expect(sheetSource).toContain("const SLOT_HEIGHT = 70");
    expect(sheetSource).toContain("const INNING_WIDTH = 92");
    expect(sheetSource).toContain("不保留粗框外側空白");
    expect(sheetSource).toContain("區域→符號→內容／備註→預覽確認");
    expect(screenSource).toContain("<WasedaScorebookTeamSheet");
  });

  it("為單場整體紀錄提供穩定的視覺覆蓋列鍵，且投影不會改寫原始賽事輸入", () => {
    const sourceTeam = team();
    const lineup = lineupFor(sourceTeam);
    const events = [atBat("display-safe", lineup.battingOrderIds[0]!, 1, "2026-08-25T00:00:00.000Z")];
    const substitutions: Substitution[] = [];
    const originalEvents = JSON.stringify(events);
    const originalLineup = JSON.stringify(lineup);
    const overrides = { [getScorebookDisplayOverrideKey("away", 1, 0)]: { defensivePosition: "6" } };
    const sheetSource = readFileSync(resolve(process.cwd(), "components/baseball/waseda-scorebook-team-sheet.tsx"), "utf8");

    expect(getScorebookDisplayOverrideKey("away", 1, 0)).toBe("away:1:0");
    expect(getScorebookDisplayOverrideKey("home", 9, 2)).toBe("home:9:2");
    expect(Object.keys(overrides)).toEqual(["away:1:0"]);
    createWasedaScorebookProjection({ team: sourceTeam, side: "away", lineup, events, substitutions, inningCount: 1 });
    expect(JSON.stringify(events)).toBe(originalEvents);
    expect(JSON.stringify(lineup)).toBe(originalLineup);
    expect(sheetSource).toContain("game.scorebookDisplayOverrides?.[overrideKey]");
    expect(sheetSource).toContain("displayOverride?.defensivePosition");
  });
});
