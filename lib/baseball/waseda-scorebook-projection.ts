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
