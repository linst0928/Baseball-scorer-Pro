import { describe, expect, it } from "vitest";
import { historyReducer, deepCloneGame, deepCloneSnapshot, type GameSnapshot, type HistoryState } from "../lib/baseball/scoring-history-reducer";
import type { Game } from "../lib/baseball/types";

describe("Scoring History Stack Reducer", () => {
  const createMockGame = (id: string, outs = 0): Game => ({
    id,
    name: "Mock Game",
    competition: "Community Cup",
    venue: "Test Field",
    date: "2026-09-02",
    status: "live",
    homeTeamId: "team-home",
    awayTeamId: "team-away",
    inning: 1,
    half: "away",
    outs,
    awayBatterIndex: 0,
    homeBatterIndex: 0,
    score: [{ inning: 1, away: 0, home: 0 }],
    runners: { first: null, second: null, third: null },
    events: [],
    specialEvents: [],
    substitutions: [],
    maxInnings: 6,
    notes: "",
    createdAt: "2026-09-02T00:00:00.000Z",
    updatedAt: "2026-09-02T00:00:00.000Z",
  });

  const createMockSnapshot = (gameId: string, outs = 0, timestamp = "2026-09-02T10:00:00.000Z"): GameSnapshot => ({
    game: createMockGame(gameId, outs),
    pitchDraft: { balls: 0, strikes: 0, total: 0, locations: [] },
    selectedResult: null,
    fieldingPosition: "1",
    recordColumnDraft: { modifiers: [], rbi: 0 },
    timestamp,
  });

  it("能安全對整個 Game 狀態物件與 Snapshot 進行深度拷貝 (Immutability)，避免共用參考參照", () => {
    const original = createMockSnapshot("game-1", 1);
    original.game.runners.first = "runner-1";
    original.pitchDraft.locations = [{ zone: 5, type: "fastball", outcome: "strike" }];

    const cloned = deepCloneSnapshot(original);

    // 修改 clone，不應影響原物件
    cloned.game.runners.first = "modified-runner";
    if (cloned.pitchDraft.locations && cloned.pitchDraft.locations[0]) {
      cloned.pitchDraft.locations[0].zone = 9;
    }

    expect(original.game.runners.first).toBe("runner-1");
    if (original.pitchDraft.locations && original.pitchDraft.locations[0]) {
      expect(original.pitchDraft.locations[0].zone).toBe(5);
    }
  });

  it("支援 PUSH_SNAPSHOT 動作，會把 present 推入 past 堆疊，並清空 future 堆疊", () => {
    const initial = createMockSnapshot("game-1", 0);
    let state: HistoryState = {
      past: [],
      present: initial,
      future: [createMockSnapshot("game-1", 99)],
    };

    const nextSnapshot = createMockSnapshot("game-1", 1);
    state = historyReducer(state, { type: "PUSH_SNAPSHOT", payload: nextSnapshot });

    expect(state.past).toHaveLength(1);
    expect(state.past[0].game.outs).toBe(0);
    expect(state.present.game.outs).toBe(1);
    expect(state.future).toHaveLength(0);
  });

  it("支援 UNDO 與 REDO 動作，能雙向巡航歷史狀態機", () => {
    const snapshot1 = createMockSnapshot("game-1", 0, "10:00");
    const snapshot2 = createMockSnapshot("game-1", 1, "10:01");
    const snapshot3 = createMockSnapshot("game-1", 2, "10:02");

    let state: HistoryState = {
      past: [],
      present: snapshot1,
      future: [],
    };

    // 推進到 snapshot2
    state = historyReducer(state, { type: "PUSH_SNAPSHOT", payload: snapshot2 });
    // 推進到 snapshot3
    state = historyReducer(state, { type: "PUSH_SNAPSHOT", payload: snapshot3 });

    expect(state.past).toHaveLength(2);
    expect(state.present.game.outs).toBe(2);

    // 執行 UNDO: 回到 2 -> 回到 1
    state = historyReducer(state, { type: "UNDO" });
    expect(state.present.game.outs).toBe(1);
    expect(state.future).toHaveLength(1);
    expect(state.future[0].game.outs).toBe(2);

    state = historyReducer(state, { type: "UNDO" });
    expect(state.present.game.outs).toBe(0);
    expect(state.future).toHaveLength(2);

    // 執行 REDO: 0 -> 1
    state = historyReducer(state, { type: "REDO" });
    expect(state.present.game.outs).toBe(1);
    expect(state.past).toHaveLength(1);
    expect(state.future).toHaveLength(1);
  });

  it("RESET 動作將徹底清除過去與未來堆疊，並重設當前 present 狀態", () => {
    const snapshot1 = createMockSnapshot("game-1", 1);
    const snapshot2 = createMockSnapshot("game-1", 2);
    const snapshot3 = createMockSnapshot("game-1", 3);

    const state: HistoryState = {
      past: [snapshot1],
      present: snapshot2,
      future: [snapshot3],
    };

    const resetSnapshot = createMockSnapshot("game-1", 0);
    const newState = historyReducer(state, { type: "RESET", payload: resetSnapshot });

    expect(newState.past).toHaveLength(0);
    expect(newState.future).toHaveLength(0);
    expect(newState.present.game.outs).toBe(0);
  });

  it("安打不觸發強制自動推進：二壘有跑者(R2)，打者擊出 1B 且 R2 選擇留在原壘時，結算後一壘為打者、二壘為原R2、三壘為空且無人得分", () => {
    // 初始狀態：二壘有跑者 (R2)
    const initial = createMockSnapshot("game-hit-test", 0);
    initial.game.runners = { first: null, second: "runner-2", third: null };
    initial.game.awayRegisteredPlayerIds = ["batter-1", "runner-2"];
    initial.game.awayBatterIndex = 0; // 當前打者為 batter-1

    let state: HistoryState = {
      past: [],
      present: initial,
      future: [],
    };

    // 模擬 Step 3 跑者抉擇：R2 選擇 HOLD (留在原壘)
    const tempRunnersAfterHold = { ...initial.game.runners };
    // R2 留在原壘：second 依然為 runner-2
    tempRunnersAfterHold.second = "runner-2";

    // 模擬 Step 4 最終寫入結算：打者擊出 1B (佔一壘)，不自動推進二壘跑者
    const batterId = initial.game.awayRegisteredPlayerIds[initial.game.awayBatterIndex];
    const finalRunners = { ...tempRunnersAfterHold };
    finalRunners.first = batterId; // 打者上一壘

    const finishedSnapshot: GameSnapshot = {
      ...initial,
      game: {
        ...initial.game,
        runners: finalRunners,
      },
      selectedResult: "1B",
      timestamp: "2026-09-02T10:05:00.000Z",
    };

    state = historyReducer(state, { type: "PUSH_SNAPSHOT", payload: finishedSnapshot });

    // 斷言：一壘有人(打者 batter-1)、二壘有人(原R2 runner-2)，三壘為空，無人得分
    expect(state.present.game.runners.first).toBe("batter-1");
    expect(state.present.game.runners.second).toBe("runner-2");
    expect(state.present.game.runners.third).toBeNull();
    expect(state.present.selectedResult).toBe("1B");
  });
});
