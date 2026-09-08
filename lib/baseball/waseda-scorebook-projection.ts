import type { AtBatEvent, GameLineup, Substitution, Team, TeamSide } from "./types";

/** 單場整體紀錄專用的替換徽記；僅供顯示，不改寫正式比賽資料。 */
export type ScorebookSubstitutionBadge = {
  code: "PH" | "PR" | "PF";
  label: "代打" | "代跑" | "代守";
  inning: number;
  /** 僅由正式換人資料帶入；缺省時不得從完成打席球數反推。 */
  handoffPitchNumber?: number;
};

/** 換投後第一位面對新投手的打席提示；僅投影既有 pitcherId 與換投紀錄。 */
export type ScorebookPitchingChangeBadge = {
  code: "P";
  inning: number;
  pitcherId: string;
};

/** 守備位置的起訖時間線；只描述既有代打、換守與離場紀錄，不重寫名單或換人。 */
export type ScorebookDefenseTimelineItem = {
  playerId: string;
  playerOutId?: string;
  position: string;
  inning: number;
  half: TeamSide;
  label: "代打後轉守" | "換守";
  leftInning?: number;
  leftHalf?: TeamSide;
};

/** 將既有換人類型轉為紀錄表簡寫；換投與遺漏型別不臆測、不顯示。 */
export function getScorebookSubstitutionMarker(type?: Substitution["type"] | string): Omit<ScorebookSubstitutionBadge, "inning"> | undefined {
  switch (type) {
    case "代打": return { code: "PH", label: "代打" };
    case "代跑": return { code: "PR", label: "代跑" };
    case "換守": return { code: "PF", label: "代守" };
    default: return undefined;
  }
}

/**
 * 單場整體紀錄的單一棒次子列。空白候補格刻意不帶 playerId，絕不代表虛構打席。
 */
export type WasedaScorebookEntry = {
  entryIndex: number;
  playerId?: string;
  kind: "starter" | "substitute" | "reserve";
  enteredInning?: number;
  enteredHalf?: TeamSide;
  substitution?: Pick<Substitution, "id" | "type" | "position" | "handoffPitchNumber" | "timestamp">;
  playerOutId?: string;
  fallback?: boolean;
};

export type WasedaScorebookAppearance = {
  event: AtBatEvent;
  eventId: string;
  battingOrder: number;
  entryIndex: number;
  /** 該半局的實際打席順序；從 0 起算，供動態格位定位而非重算比賽。 */
  appearanceIndex: number;
  /** 僅在替換發生局的該替換球員格內顯示，與結果與傳接符號分離。 */
  replacementBadge?: ScorebookSubstitutionBadge;
  /** 僅在換投後新投手面對的第一位打者格內顯示，與替換、結果與傳接符號分離。 */
  pitchingChangeBadge?: ScorebookPitchingChangeBadge;
};

export type WasedaScorebookOrder = {
  battingOrder: number;
  entries: WasedaScorebookEntry[];
};

export type WasedaScorebookInning = {
  inning: number;
  appearances: WasedaScorebookAppearance[];
  /** 該局全隊實際打席數；僅供表頭與密集局數提示，不再決定單一球員子列的高度。 */
  slotCount: number;
};

export type WasedaScorebookProjection = {
  battingOrders: WasedaScorebookOrder[];
  innings: WasedaScorebookInning[];
  maxPlateAppearances: number;
  usesLineupFallback: boolean;
  defenseTimeline: ScorebookDefenseTimelineItem[];
};

/** 建立單場整體紀錄表的穩定列鍵；僅用於視覺覆蓋，不影響原始賽事資料。 */
export const getScorebookDisplayOverrideKey = (side: TeamSide, battingOrder: number, entryIndex: number) => `${side}:${battingOrder}:${entryIndex}`;

export type WasedaScorebookProjectionInput = {
  team: Team;
  side: TeamSide;
  lineup?: GameLineup;
  events: readonly AtBatEvent[];
  substitutions: readonly Substitution[];
  inningCount?: number;
};

const chronological = <T extends { timestamp: string }>(items: readonly T[]) => items
  .map((item, index) => ({ item, index }))
  .sort((left, right) => {
    const difference = new Date(left.item.timestamp).getTime() - new Date(right.item.timestamp).getTime();
    return Number.isNaN(difference) || difference === 0 ? left.index - right.index : difference;
  })
  .map(({ item }) => item);

const unique = (ids: readonly string[]) => Array.from(new Set(ids));

const isDefensivePosition = (position: string | undefined) => Boolean(position && /^[1-9]$/.test(position));

const rosterOrder = (team: Team) => team.players
  .slice()
  .sort((left, right) => (left.battingOrder ?? Number.MAX_SAFE_INTEGER) - (right.battingOrder ?? Number.MAX_SAFE_INTEGER) || left.number - right.number)
  .map((player) => player.id);

/**
 * 以本場先發快照為優先建立 1–9 棒。沒有快照的歷史場次只使用實際打席首次順序與固定名單作保守回退，
 * 不寫入或改動任何原始比賽資料。
 */
const deriveStarterIds = (input: WasedaScorebookProjectionInput, teamEvents: readonly AtBatEvent[]) => {
  const rosterIds = new Set(input.team.players.map((player) => player.id));
  const lineupIds = unique((input.lineup?.battingOrderIds ?? []).filter((id) => rosterIds.has(id)));
  if (lineupIds.length > 0) return lineupIds.slice(0, 9);
  const eventIds = unique(teamEvents.map((event) => event.batterId).filter((id) => rosterIds.has(id)));
  return unique([...eventIds, ...rosterOrder(input.team)]).slice(0, 9);
};

const orderForUnmappedBatter = (orders: WasedaScorebookOrder[]) => {
  const emptyStarter = orders.find((order) => !order.entries[0]?.playerId);
  if (emptyStarter) return emptyStarter;
  return orders.find((order) => order.entries.every((entry) => !entry.playerId)) ?? orders.at(-1);
};

/**
 * 將既有比賽資料投影為早稻田式整體紀錄表格。此函式純讀取資料；事件、換人、先發名單及陣容皆不會被改寫。
 */
export function createWasedaScorebookProjection(input: WasedaScorebookProjectionInput): WasedaScorebookProjection {
  const teamEvents = chronological(input.events.filter((event) => event.half === input.side));
  const starterIds = deriveStarterIds(input, teamEvents);
  const usesLineupFallback = !input.lineup?.battingOrderIds?.length;
  const battingOrders: WasedaScorebookOrder[] = Array.from({ length: 9 }, (_, index) => ({
    battingOrder: index + 1,
    entries: [{ entryIndex: 0, playerId: starterIds[index], kind: "starter", fallback: usesLineupFallback }],
  }));
  const playerOrder = new Map<string, number>();
  starterIds.forEach((playerId, index) => playerOrder.set(playerId, index + 1));

  const addSubstitute = (order: WasedaScorebookOrder, substitution: Substitution) => {
    const existing = order.entries.find((entry) => entry.playerId === substitution.playerInId);
    if (existing) return existing;
    const entry: WasedaScorebookEntry = {
      entryIndex: order.entries.length,
      playerId: substitution.playerInId,
      kind: "substitute",
      enteredInning: substitution.inning,
      enteredHalf: substitution.half,
      substitution: {
        id: substitution.id,
        type: substitution.type,
        position: substitution.position,
        handoffPitchNumber: substitution.handoffPitchNumber,
        timestamp: substitution.timestamp,
      },
      playerOutId: substitution.playerOutId,
    };
    order.entries.push(entry);
    playerOrder.set(substitution.playerInId, order.battingOrder);
    return entry;
  };

  chronological(input.substitutions.filter((substitution) => substitution.teamId === input.team.id)).forEach((substitution) => {
    const battingOrder = playerOrder.get(substitution.playerOutId) ?? playerOrder.get(substitution.playerInId);
    if (!battingOrder) return;
    addSubstitute(battingOrders[battingOrder - 1], substitution);
  });

  const teamSubstitutions = chronological(input.substitutions.filter((substitution) => substitution.teamId === input.team.id));
  const defenseTimeline = teamSubstitutions.flatMap((substitution, substitutionIndex) => {
    if (substitution.type !== "換守" || !isDefensivePosition(substitution.position)) return [];
    const previousPinchHit = teamSubstitutions.slice(0, substitutionIndex).reverse().find((candidate) => candidate.playerInId === substitution.playerInId && candidate.type === "代打");
    const nextExit = teamSubstitutions.slice(substitutionIndex + 1).find((candidate) => candidate.playerOutId === substitution.playerInId);
    return [{
      playerId: substitution.playerInId,
      playerOutId: substitution.playerOutId,
      position: substitution.position,
      inning: substitution.inning,
      half: substitution.half,
      label: previousPinchHit ? "代打後轉守" as const : "換守" as const,
      leftInning: nextExit?.inning,
      leftHalf: nextExit?.half,
    }];
  });

  /**
   * 既有資料以完整打席保存投手；因此只在新投手 pitcherId 首次出現的完成打席標記換投。
   * 若資料未保留可比較的時間戳，安全回退到該新投手第一個既有打席，不臆測局中逐球欄。
   */
  const pitchingChangeByEventId = new Map<string, ScorebookPitchingChangeBadge>();
  chronological(input.substitutions.filter((substitution) => substitution.teamId !== input.team.id && substitution.type === "換投")).forEach((substitution) => {
    const newPitcherEvents = teamEvents.filter((event) => event.pitcherId === substitution.playerInId);
    const substitutionTime = new Date(substitution.timestamp).getTime();
    const firstFaced = newPitcherEvents.find((event) => {
      const eventTime = new Date(event.timestamp).getTime();
      return !Number.isNaN(substitutionTime) && !Number.isNaN(eventTime) && eventTime >= substitutionTime;
    }) ?? newPitcherEvents[0];
    if (firstFaced && !pitchingChangeByEventId.has(firstFaced.id)) {
      pitchingChangeByEventId.set(firstFaced.id, { code: "P", inning: substitution.inning, pitcherId: substitution.playerInId });
    }
  });

  /**
   * 若舊場次遺漏換人記錄，仍保留該實際打席，並明示為回退投影；不猜測其真實換人局數或守備位置。
   */
  teamEvents.forEach((event) => {
    if (playerOrder.has(event.batterId)) return;
    const order = orderForUnmappedBatter(battingOrders);
    if (!order) return;
    const entry: WasedaScorebookEntry = {
      entryIndex: order.entries.length,
      playerId: event.batterId,
      kind: "substitute",
      enteredInning: event.inning,
      enteredHalf: event.half,
      fallback: true,
    };
    order.entries.push(entry);
    playerOrder.set(event.batterId, order.battingOrder);
  });

  battingOrders.forEach((order) => {
    while (order.entries.length < 3) {
      order.entries.push({ entryIndex: order.entries.length, kind: "reserve" });
    }
  });

  const entryByPlayerId = new Map<string, WasedaScorebookEntry & { battingOrder: number }>();
  battingOrders.forEach((order) => order.entries.forEach((entry) => {
    if (entry.playerId) entryByPlayerId.set(entry.playerId, { ...entry, battingOrder: order.battingOrder });
  }));

  const visibleInningCount = Math.max(
    1,
    input.inningCount ?? 0,
    ...teamEvents.map((event) => event.inning),
  );
  const innings = Array.from({ length: visibleInningCount }, (_, index) => index + 1).map((inning) => {
    const appearances = teamEvents
      .filter((event) => event.inning === inning)
      .map((event, appearanceIndex) => {
        const entry = entryByPlayerId.get(event.batterId);
        /** 遺漏球員仍不建立假事件；此防線只提供可追溯的最後保留格。 */
        const resolved = entry ?? { battingOrder: 9, entryIndex: battingOrders[8].entries.length - 1 };
        const marker = entry && entry.enteredInning === inning
          ? getScorebookSubstitutionMarker(entry.substitution?.type)
          : undefined;
        return {
          event,
          eventId: event.id,
          battingOrder: resolved.battingOrder,
          entryIndex: resolved.entryIndex,
          appearanceIndex,
          replacementBadge: marker && entry?.enteredInning
            ? { ...marker, inning: entry.enteredInning, handoffPitchNumber: entry.substitution?.handoffPitchNumber }
            : undefined,
          pitchingChangeBadge: pitchingChangeByEventId.get(event.id),
        };
      });
    return { inning, appearances, slotCount: Math.max(3, appearances.length) };
  });
  const maxPlateAppearances = Math.max(3, ...innings.map((inning) => inning.appearances.length));

  return { battingOrders, innings, maxPlateAppearances, usesLineupFallback, defenseTimeline };
}

export type WasedaMatrixStats = {
  hits: number;          // 安打 (1B, 2B, 3B, HR)
  walks: number;         // 四壞球 (BB, IBB)
  hbp: number;           // 觸身球 (HBP)
  strikeouts: number;    // 三振 (K, KL, KS)
  doublePlays: number;   // 雙殺打 (DP, GDP, TP)
  sacrifices: number;    // 犧牲打 (SH, SF, SAC)
  stolenBases: number;   // 盜壘成功 (SB)
  caughtStealing: number;// 盜壘失敗 (CS, PO)
  opponentErrors: number;// 失誤 (資料來源為對手早稻田矩陣)
};

/**
 * 依早稻田矩陣邏輯統計單隊各項打擊與跑壘結果。
 * 例外邏輯：失誤欄位統計對手早稻田矩陣中的失誤記錄。
 */
export function calculateWasedaMatrixStats(game: { events: readonly AtBatEvent[]; specialEvents?: readonly { half: TeamSide; type: string; notation?: string }[] }, side: TeamSide): WasedaMatrixStats {
  const teamEvents = game.events.filter((e) => e.half === side);
  const opponentEvents = game.events.filter((e) => e.half !== side);
  const teamSpecialEvents = (game.specialEvents || []).filter((e) => e.half === side);

  const hits = teamEvents.filter((e) => ["1B", "2B", "3B", "HR"].includes(e.result as string) || /\b(1B|2B|3B|HR)\b/.test(e.notation || "")).length;
  const walks = teamEvents.filter((e) => (e.result as string) === "BB" || (e.result as string) === "IBB" || /\b(BB|IBB)\b/.test(e.notation || "")).length;
  const hbp = teamEvents.filter((e) => e.result === "HBP" || /\bHBP\b/.test(e.notation || "")).length;
  const strikeouts = teamEvents.filter((e) => ["K", "KL", "KS"].includes(e.result as string) || /\b(K|KL|KS)\b/.test(e.notation || "")).length;
  const doublePlays = teamEvents.filter((e) => /\b(DP|GDP|TP)\b/.test(e.result as string) || /\b(DP|GDP|TP)\b/.test(e.notation || "")).length;
  const sacrifices = teamEvents.filter((e) => ["SH", "SF", "SAC"].includes(e.result as string) || /\b(SH|SF|SAC)\b/.test(e.notation || "")).length;
  const stolenBases = teamSpecialEvents.filter((e) => e.type === "SB").length + teamEvents.filter((e) => /\bSB\b/.test(e.notation || "")).length;
  const caughtStealing = teamSpecialEvents.filter((e) => e.type === "CS").length + teamEvents.filter((e) => /\bCS\b/.test(e.notation || "")).length;

  // 對手早稻田矩陣中的失誤紀錄（包含對手打席/防守事件中的失誤及對手失誤讓本隊上壘次數）
  const opponentErrors = opponentEvents.filter((e) => e.result === "E" || /\bE[1-9]?\b/.test(e.notation || "") || /\bE\b/.test(e.result || "")).length
    + teamEvents.filter((e) => e.result === "E" || /\bE[1-9]?\b/.test(e.notation || "")).length;

  return {
    hits,
    walks,
    hbp,
    strikeouts,
    doublePlays,
    sacrifices,
    stolenBases,
    caughtStealing,
    opponentErrors,
  };
}

export type DetailedPitcherStat = {
  playerId: string;
  number: number;
  name: string;
  throwingHand: string;
  totalPitches: number;
  strikes: number;
  hits: number;
  hr: number;
  walks: number;
  hbp: number;
  strikeouts: number;
  wp: number;
  runs: number;
  er: number;
  isStarter: boolean;
};

export type DetailedCatcherStat = {
  playerId: string;
  number: number;
  name: string;
  throwingHand: string;
  pb: number;
  stolenBases: number;
  caughtStealing: number;
  isStarter: boolean;
};

/**
 * 依現場紀錄之逐球與特殊事件，自動累加統計特定球隊之投手詳細數據。
 * 排序：先發第 1 欄，後援投手依序向下。
 */
export function getDetailedPitcherStats(game: { events: readonly AtBatEvent[]; substitutions?: readonly Substitution[]; score?: readonly any[]; awayLineup?: GameLineup; homeLineup?: GameLineup }, team: Team, side: TeamSide): DetailedPitcherStat[] {
  const lineup = side === "away" ? game.awayLineup : game.homeLineup;
  const teamPlayerMap = new Map(team.players.map((p) => [p.id, p]));

  // 找出該隊先發投手 ID
  const starterPitcherId = lineup?.defensivePositions
    ? Object.keys(lineup.defensivePositions).find((id) => lineup.defensivePositions[id] === "1" || lineup.defensivePositions[id] === "投手")
    : undefined;

  // 按出場時間順序收集投手 ID
  const pitcherIdsOrdered: string[] = [];
  if (starterPitcherId && teamPlayerMap.has(starterPitcherId)) {
    pitcherIdsOrdered.push(starterPitcherId);
  }

  // 從事件與換人紀錄收集其餘投手
  game.events.forEach((event) => {
    if (event.pitcherId && teamPlayerMap.has(event.pitcherId) && !pitcherIdsOrdered.includes(event.pitcherId)) {
      pitcherIdsOrdered.push(event.pitcherId);
    }
  });

  (game.substitutions || []).forEach((sub) => {
    if (sub.teamId === team.id && (sub.position === "1" || sub.position === "投手" || sub.type === "換投") && teamPlayerMap.has(sub.playerInId)) {
      if (!pitcherIdsOrdered.includes(sub.playerInId)) {
        pitcherIdsOrdered.push(sub.playerInId);
      }
    }
  });

  // 若仍無投手資料，保底帶入名單中的預設投手或號碼為 1 者
  if (pitcherIdsOrdered.length === 0) {
    const defaultPitcher = team.players.find((p) => p.position === "投手" || p.number === 1) || team.players[0];
    if (defaultPitcher) pitcherIdsOrdered.push(defaultPitcher.id);
  }

  const defenseHalf = side === "away" ? "home" : "away";
  const defenseSpecialEvents = ((game as any).specialEvents || []).filter((se: any) => se.half === defenseHalf);

  return pitcherIdsOrdered.map((pitcherId, index) => {
    const player = teamPlayerMap.get(pitcherId) || { id: pitcherId, number: 0, name: "未知投手", throwingHand: "R", throws: "R" } as any;
    const pitcherEvents = game.events.filter((e) => e.pitcherId === pitcherId);

    const totalPitches = pitcherEvents.reduce((sum, e) => sum + (e.pitches?.total || 0), 0);
    const strikes = pitcherEvents.reduce((sum, e) => sum + (e.pitches?.strikes || 0), 0);
    const hits = pitcherEvents.filter((e) => ["1B", "2B", "3B", "HR"].includes(e.result as string) || /\b(1B|2B|3B|HR)\b/.test(e.notation || "")).length;
    const hr = pitcherEvents.filter((e) => (e.result as string) === "HR" || /\bHR\b/.test(e.notation || "")).length;
    const walks = pitcherEvents.filter((e) => (e.result as string) === "BB" || (e.result as string) === "IBB" || /\b(BB|IBB)\b/.test(e.notation || "")).length;
    const hbp = pitcherEvents.filter((e) => e.result === "HBP" || /\bHBP\b/.test(e.notation || "")).length;
    const strikeouts = pitcherEvents.filter((e) => ["K", "KL", "KS"].includes(e.result as string) || /\b(K|KL|KS)\b/.test(e.notation || "")).length;
    const wp = pitcherEvents.filter((e) => (e.result as string) === "WP" || /\bWP\b/.test(e.notation || "")).length + defenseSpecialEvents.filter((se: any) => se.type === "WP").length;
    const runs = pitcherEvents.reduce((sum, e) => sum + (e.runsScored || 0), 0);
    const er = runs; // 預設自責分等於失分

    return {
      playerId: player.id,
      number: player.number ?? 0,
      name: player.name || "未知投手",
      throwingHand: player.throwingHand || player.throws || "R",
      totalPitches,
      strikes,
      hits,
      hr,
      walks,
      hbp,
      strikeouts,
      wp,
      runs,
      er,
      isStarter: index === 0,
    };
  });
}

/**
 * 依現場紀錄之逐球與特殊事件，自動累加統計特定球隊之捕手詳細數據。
 * 排序：先發第 1 欄，後援捕手依序向下。
 */
export function getDetailedCatcherStats(game: { events: readonly AtBatEvent[]; substitutions?: readonly Substitution[]; awayLineup?: GameLineup; homeLineup?: GameLineup }, team: Team, side: TeamSide): DetailedCatcherStat[] {
  const lineup = side === "away" ? game.awayLineup : game.homeLineup;
  const teamPlayerMap = new Map(team.players.map((p) => [p.id, p]));

  // 找出該隊先發捕手 ID
  const starterCatcherId = lineup?.defensivePositions
    ? Object.keys(lineup.defensivePositions).find((id) => lineup.defensivePositions[id] === "2" || lineup.defensivePositions[id] === "捕手")
    : undefined;

  const catcherIdsOrdered: string[] = [];
  if (starterCatcherId && teamPlayerMap.has(starterCatcherId)) {
    catcherIdsOrdered.push(starterCatcherId);
  }

  // 從換人紀錄收集成員
  (game.substitutions || []).forEach((sub) => {
    if (sub.teamId === team.id && (sub.position === "2" || sub.position === "捕手") && teamPlayerMap.has(sub.playerInId)) {
      if (!catcherIdsOrdered.includes(sub.playerInId)) {
        catcherIdsOrdered.push(sub.playerInId);
      }
    }
  });

  // 保底帶入名單中的預設捕手
  if (catcherIdsOrdered.length === 0) {
    const defaultCatcher = team.players.find((p) => p.position === "捕手" || p.number === 2) || team.players[0];
    if (defaultCatcher) catcherIdsOrdered.push(defaultCatcher.id);
  }

  const defenseHalf = side === "away" ? "home" : "away";
  const defenseSpecialEvents = ((game as any).specialEvents || []).filter((se: any) => se.half === defenseHalf);
  const defenseAtBatEvents = game.events.filter((e) => e.half === defenseHalf);

  const totalPB = defenseSpecialEvents.filter((se: any) => se.type === "PB").length + defenseAtBatEvents.filter((e) => (e.result as string) === "PB" || /\bPB\b/.test(e.notation || "")).length;
  const totalSB = defenseSpecialEvents.filter((se: any) => se.type === "SB").length + defenseAtBatEvents.filter((e) => /\bSB\b/.test(e.notation || "")).length;
  const totalCS = defenseSpecialEvents.filter((se: any) => se.type === "CS").length + defenseAtBatEvents.filter((e) => /\bCS\b/.test(e.notation || "")).length;

  return catcherIdsOrdered.map((catcherId, index) => {
    const player = teamPlayerMap.get(catcherId) || { id: catcherId, number: 0, name: "未知捕手", throwingHand: "R", throws: "R" } as any;

    return {
      playerId: player.id,
      number: player.number ?? 0,
      name: player.name || "未知捕手",
      throwingHand: player.throwingHand || player.throws || "R",
      pb: index === 0 ? totalPB : 0,
      stolenBases: index === 0 ? totalSB : 0,
      caughtStealing: index === 0 ? totalCS : 0,
      isStarter: index === 0,
    };
  });
}
