import {
  type AtBatEvent,
  type FormalScorebookCorrection,
  type Game,
  type ScorebookBlankSlot,
  type SpecialEvent,
  isStatNeutralSpecialEvent,
  nextRunnerState,
  nextSpecialRunnerState,
  updateGameAfterEvent,
  updateGameAfterSpecialEvent,
} from "./types";
import { isRecordCorrectionUnlocked } from "./record-correction";

export type FormalScorebookCorrectionInput = {
  slot: ScorebookBlankSlot;
  replacementEvent: AtBatEvent;
  note?: string;
};

/** 已完成打席的全刪除後正式重建輸入；只允許取代單一既有打席。 */
export type FormalScorebookAtBatReplacementInput = {
  targetEventId: string;
  replacementEvent: AtBatEvent;
  /** 用於稽核和安全鎖的整體紀錄表定位；沒有時依原打席建立最小定位。 */
  slot?: ScorebookBlankSlot;
  note?: string;
};

type TimelineEntry =
  | { kind: "atBat"; value: AtBatEvent }
  | { kind: "special"; value: SpecialEvent };

const halfOrder = (half: "away" | "home") => half === "away" ? 0 : 1;

const timelineOrder = (left: TimelineEntry, right: TimelineEntry) => {
  if (left.value.inning !== right.value.inning) return left.value.inning - right.value.inning;
  if (left.value.half !== right.value.half) return halfOrder(left.value.half) - halfOrder(right.value.half);
  if (left.value.timestamp !== right.value.timestamp) return left.value.timestamp.localeCompare(right.value.timestamp);
  return left.kind === right.kind ? left.value.id.localeCompare(right.value.id) : left.kind === "atBat" ? -1 : 1;
};

/** 正式更正與既有打席補正使用相同的半局安全鎖，避免改寫仍在進行中的攻守狀態。 */
export function isFormalScorebookCorrectionUnlocked(game: Pick<Game, "status" | "inning" | "half">, slot: Pick<ScorebookBlankSlot, "inning" | "side">) {
  return isRecordCorrectionUnlocked(game, { inning: slot.inning, half: slot.side });
}

export function getFormalScorebookCorrectionLockReason(game: Pick<Game, "status" | "inning" | "half">, slot: Pick<ScorebookBlankSlot, "inning" | "side">) {
  if (isFormalScorebookCorrectionUnlocked(game, slot)) return undefined;
  const selectedHalf = slot.side === "away" ? "上" : "下";
  const currentHalf = game.half === "away" ? "上" : "下";
  return `第 ${slot.inning} 局${selectedHalf}仍可能影響進行中的跑者、比分與出局數；請在半局結束後或完場時再作正式更正。目前為第 ${game.inning} 局${currentHalf}。`;
}

/**
 * 依現有正式狀態更新函式重播已完成時間線。重播時會丟棄系統自動產生的局結束註記，
 * 再由既有函式生成正確的 LOB／局結束資訊，因此更正後的事件、跑壘、比分與統計有同一來源。
 */
export function replayGameAfterFormalScorebookCorrection(game: Game, events: AtBatEvent[]): Game {
  const timeline: TimelineEntry[] = [
    ...events.map((value) => ({ kind: "atBat" as const, value })),
    ...(game.specialEvents ?? [])
      .filter((value) => value.type !== "INNING_END")
      .map((value) => ({ kind: "special" as const, value })),
  ].sort(timelineOrder);

  let replay: Game = {
    ...game,
    inning: 1,
    half: "away",
    outs: 0,
    runners: { first: null, second: null, third: null },
    awayBatterIndex: 0,
    homeBatterIndex: 0,
    score: [],
    events: [],
    specialEvents: [],
  };

  timeline.forEach((entry) => {
    if (entry.kind === "special") {
      const special = entry.value;
      const outcome = nextSpecialRunnerState(replay.runners, special.type, special.fromBase, special.toBase);
      replay = updateGameAfterSpecialEvent(replay, {
        ...special,
        outsBefore: replay.outs,
        runsScored: isStatNeutralSpecialEvent(special.type) ? 0 : outcome.runs,
      }, outcome.runners, outcome.runs, outcome.outsAdded);
      return;
    }

    const atBat = entry.value;
    const outcome = nextRunnerState(replay.runners, atBat.result, atBat.batterId, {
      droppedThirdStrike: atBat.droppedThirdStrike,
      outs: replay.outs,
    });
    replay = updateGameAfterEvent(replay, {
      ...atBat,
      outsBefore: replay.outs,
      runsScored: outcome.runs,
      runnerAdvances: [],
    }, outcome.runners, outcome.runs);
    replay = {
      ...replay,
      awayBatterIndex: atBat.half === "away" ? replay.awayBatterIndex + 1 : replay.awayBatterIndex,
      homeBatterIndex: atBat.half === "home" ? replay.homeBatterIndex + 1 : replay.homeBatterIndex,
    };
  });

  return {
    ...replay,
    status: game.status,
    notes: game.notes,
    substitutions: game.substitutions,
    scorebookDisplayOverrides: game.scorebookDisplayOverrides,
    formalScorebookCorrections: game.formalScorebookCorrections,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 建立一筆正式空白格補登。提交前會先檢查安全鎖；提交後保留原始比分與完整事件識別，
 * 再以時間線重播使 events、runnerAdvances、score、outs 與統計來源一致。
 */
export function applyFormalScorebookBlankCorrection(game: Game, input: FormalScorebookCorrectionInput): Game {
  if (!isFormalScorebookCorrectionUnlocked(game, input.slot)) {
    throw new Error(getFormalScorebookCorrectionLockReason(game, input.slot));
  }
  const recordedAt = new Date().toISOString();
  const replacementEvent: AtBatEvent = {
    ...input.replacementEvent,
    id: input.replacementEvent.id || `formal-correction-${game.id}-${recordedAt}`,
    inning: input.slot.inning,
    half: input.slot.side,
    batterId: input.slot.playerId ?? input.replacementEvent.batterId,
    source: "manual",
    timestamp: input.replacementEvent.timestamp || recordedAt,
  };
  const correction: FormalScorebookCorrection = {
    id: `formal-scorebook-correction-${game.id}-${recordedAt}`,
    kind: "insert",
    slot: input.slot,
    replacementEvent,
    affectedEventIds: game.events.map((event) => event.id),
    priorScore: game.score.map((inning) => ({ ...inning })),
    recordedAt,
    note: input.note?.trim() || undefined,
  };
  const withAudit: Game = {
    ...game,
    formalScorebookCorrections: [...(game.formalScorebookCorrections ?? []), correction],
  };
  return replayGameAfterFormalScorebookCorrection(withAudit, [...game.events, replacementEvent]);
}

/**
 * 在半局結束或完場後，以全新草稿取代一筆已完成打席。
 * 不重用舊打席的逐球、結果、紀錄欄、跑壘或顯示補正資料；只保留不可變的
 * 事件識別、局數、攻守、打者與時間，並保存原始事件與替換事件的稽核證據。
 */
export function applyFormalScorebookAtBatReplacement(game: Game, input: FormalScorebookAtBatReplacementInput): Game {
  const previousEvent = game.events.find((event) => event.id === input.targetEventId);
  if (!previousEvent) throw new Error("找不到欲正式重建的打席；請重新開啟該打席格後再試。 ");

  const slot: ScorebookBlankSlot = input.slot ?? {
    side: previousEvent.half,
    battingOrder: 0,
    entryIndex: 0,
    inning: previousEvent.inning,
    slotIndex: 0,
    playerId: previousEvent.batterId,
  };
  const safetySlot: ScorebookBlankSlot = {
    ...slot,
    side: previousEvent.half,
    inning: previousEvent.inning,
    playerId: previousEvent.batterId,
  };
  if (!isFormalScorebookCorrectionUnlocked(game, safetySlot)) {
    throw new Error(getFormalScorebookCorrectionLockReason(game, safetySlot));
  }

  const recordedAt = new Date().toISOString();
  const replacementEvent: AtBatEvent = {
    id: previousEvent.id,
    inning: previousEvent.inning,
    half: previousEvent.half,
    batterId: previousEvent.batterId,
    pitcherId: input.replacementEvent.pitcherId,
    result: input.replacementEvent.result,
    notation: input.replacementEvent.notation,
    pitches: input.replacementEvent.pitches,
    outsBefore: input.replacementEvent.outsBefore,
    runsScored: input.replacementEvent.runsScored,
    zone: input.replacementEvent.zone,
    hitZone: input.replacementEvent.hitZone,
    pitchType: input.replacementEvent.pitchType,
    hitPitchType: input.replacementEvent.hitPitchType,
    recordColumn: input.replacementEvent.recordColumn,
    droppedThirdStrike: input.replacementEvent.droppedThirdStrike,
    runnerAdvances: input.replacementEvent.runnerAdvances?.map((advance) => ({ ...advance })),
    source: "manual",
    timestamp: previousEvent.timestamp,
  };
  const correction: FormalScorebookCorrection = {
    id: `formal-scorebook-replacement-${game.id}-${recordedAt}`,
    kind: "replace",
    slot: safetySlot,
    previousEvent: { ...previousEvent, runnerAdvances: previousEvent.runnerAdvances?.map((advance) => ({ ...advance })) },
    replacementEvent,
    affectedEventIds: game.events.map((event) => event.id),
    priorScore: game.score.map((inning) => ({ ...inning })),
    recordedAt,
    note: input.note?.trim() || undefined,
  };
  const withAudit: Game = {
    ...game,
    formalScorebookCorrections: [...(game.formalScorebookCorrections ?? []), correction],
  };
  const events = game.events.map((event) => event.id === previousEvent.id ? replacementEvent : event);
  return replayGameAfterFormalScorebookCorrection(withAudit, events);
}
