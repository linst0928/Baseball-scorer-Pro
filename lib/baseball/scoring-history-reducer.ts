import { useReducer, useCallback } from "react";
import type { Game, PitchState, RecordColumn, AtBatResult } from "./types";

export type GameSnapshot = {
  game: Game;
  pitchDraft: PitchState;
  selectedResult: AtBatResult | null;
  fieldingPosition: string;
  recordColumnDraft: RecordColumn;
  timestamp: string;
};

export type HistoryState = {
  past: GameSnapshot[];
  present: GameSnapshot;
  future: GameSnapshot[];
};

export type HistoryAction =
  | { type: "PUSH_SNAPSHOT"; payload: GameSnapshot }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET"; payload: GameSnapshot };

const MAX_STACK_DEPTH = 50;

/**
 * 針對深層棒球狀態與快照的深拷貝輔助函式，確保強烈的不可變性 (Immutability)，
 * 避免 React 多次渲染或參考共用導致歷史堆疊損毀。
 */
export function deepCloneGame(game: Game): Game {
  return {
    ...game,
    homeRegisteredPlayerIds: game.homeRegisteredPlayerIds ? [...game.homeRegisteredPlayerIds] : undefined,
    awayRegisteredPlayerIds: game.awayRegisteredPlayerIds ? [...game.awayRegisteredPlayerIds] : undefined,
    homeLineup: game.homeLineup
      ? {
          battingOrderIds: [...game.homeLineup.battingOrderIds],
          defensivePositions: { ...game.homeLineup.defensivePositions },
        }
      : undefined,
    awayLineup: game.awayLineup
      ? {
          battingOrderIds: [...game.awayLineup.battingOrderIds],
          defensivePositions: { ...game.awayLineup.defensivePositions },
        }
      : undefined,
    score: game.score.map((item) => ({ ...item })),
    runners: { ...game.runners },
    events: game.events.map((event) => ({
      ...event,
      pitches: {
        ...event.pitches,
        locations: event.pitches.locations?.map((loc) => ({ ...loc })),
      },
      recordColumn: event.recordColumn
        ? {
            ...event.recordColumn,
            modifiers: event.recordColumn.modifiers ? [...event.recordColumn.modifiers] : undefined,
          }
        : undefined,
      recordCorrection: event.recordCorrection
        ? {
            ...event.recordCorrection,
            outerMarks: event.recordCorrection.outerMarks ? { ...event.recordCorrection.outerMarks } : undefined,
          }
        : undefined,
      runnerAdvances: event.runnerAdvances?.map((adv) => ({ ...adv })),
    })),
    specialEvents: game.specialEvents.map((se) => ({ ...se })),
    substitutions: game.substitutions.map((sub) => ({ ...sub })),
    scorebookDisplayOverrides: game.scorebookDisplayOverrides
      ? Object.fromEntries(
          Object.entries(game.scorebookDisplayOverrides).map(([key, val]) => [key, { ...val }])
        )
      : undefined,
    formalScorebookCorrections: game.formalScorebookCorrections
      ? game.formalScorebookCorrections.map((corr) => ({
          ...corr,
          slot: { ...corr.slot },
          replacementEvent: {
            ...corr.replacementEvent,
            pitches: {
              ...corr.replacementEvent.pitches,
              locations: corr.replacementEvent.pitches.locations?.map((loc) => ({ ...loc })),
            },
          },
          previousEvent: corr.previousEvent
            ? {
                ...corr.previousEvent,
                pitches: {
                  ...corr.previousEvent.pitches,
                  locations: corr.previousEvent.pitches.locations?.map((loc) => ({ ...loc })),
                },
              }
            : undefined,
          affectedEventIds: [...corr.affectedEventIds],
          priorScore: corr.priorScore.map((item) => ({ ...item })),
        }))
      : undefined,
  };
}

export function deepCloneSnapshot(snapshot: GameSnapshot): GameSnapshot {
  return {
    game: deepCloneGame(snapshot.game),
    pitchDraft: {
      ...snapshot.pitchDraft,
      locations: snapshot.pitchDraft.locations?.map((loc) => ({ ...loc })),
    },
    selectedResult: snapshot.selectedResult,
    fieldingPosition: snapshot.fieldingPosition,
    recordColumnDraft: {
      ...snapshot.recordColumnDraft,
      modifiers: snapshot.recordColumnDraft.modifiers ? [...snapshot.recordColumnDraft.modifiers] : undefined,
    },
    timestamp: snapshot.timestamp,
  };
}

export function historyReducer(state: HistoryState, action: HistoryAction): HistoryState {
  switch (action.type) {
    case "PUSH_SNAPSHOT": {
      // 確保推入 past 前對當前狀態 present 進行深拷貝以隔離參照
      const clonedPresent = deepCloneSnapshot(state.present);
      const clonedPayload = deepCloneSnapshot(action.payload);
      const updatedPast = [...state.past, clonedPresent];
      if (updatedPast.length > MAX_STACK_DEPTH) {
        updatedPast.shift();
      }
      return {
        past: updatedPast,
        present: clonedPayload,
        future: [],
      };
    }

    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      // 深拷貝確保取出的狀態完全與 stack 隔離
      const clonedPrevious = deepCloneSnapshot(previous);
      const clonedPresent = deepCloneSnapshot(state.present);
      return {
        past: newPast,
        present: clonedPrevious,
        future: [clonedPresent, ...state.future],
      };
    }

    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      const clonedNext = deepCloneSnapshot(next);
      const clonedPresent = deepCloneSnapshot(state.present);
      return {
        past: [...state.past, clonedPresent],
        present: clonedNext,
        future: newFuture,
      };
    }

    case "RESET": {
      return {
        past: [],
        present: deepCloneSnapshot(action.payload),
        future: [],
      };
    }

    default:
      return state;
  }
}

/**
 * 自訂 Hook：提供簡潔、強固的逐球歷史紀錄 Undo / Redo 快照管理。
 */
export function useScoringHistory(initialSnapshot: GameSnapshot) {
  const [state, dispatch] = useReducer(historyReducer, {
    past: [],
    present: deepCloneSnapshot(initialSnapshot),
    future: [],
  });

  const pushSnapshot = useCallback((nextSnapshot: GameSnapshot) => {
    dispatch({ type: "PUSH_SNAPSHOT", payload: nextSnapshot });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  const reset = useCallback((newSnapshot: GameSnapshot) => {
    dispatch({ type: "RESET", payload: newSnapshot });
  }, []);

  return {
    past: state.past,
    present: state.present,
    future: state.future,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    pushSnapshot,
    undo,
    redo,
    reset,
  };
}
