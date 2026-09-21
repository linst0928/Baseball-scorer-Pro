import { describe, it, expect } from "vitest";
import {
  calculateForceState,
  determineOutType,
  updateForceChainAfterOut,
  evaluateThirdOutRunSettlement,
} from "../lib/baseball/force-play";
import type { RunnerState } from "../lib/baseball/types";

describe("Force Play Core Domain Logic & State Machine Tests", () => {
  const emptyRunners: RunnerState = { first: null, second: null, third: null };

  describe("五、八種基本壘包狀態測試 (Basic Base States)", () => {
    it("Case 1: 壘上無人 (Empty Bases) - 打者擊球成為跑者，跑者無 Force", () => {
      const state = calculateForceState(emptyRunners, true, "batter-1");
      expect(state.batterBecomesRunner).toBe(true);
      expect(state.batterRunnerForced).toBe(true);
      expect(state.runners.first).toBeNull();
      expect(state.runners.second).toBeNull();
      expect(state.runners.third).toBeNull();
      expect(state.forceChain).toEqual([
        { runnerId: "batter-1", fromBase: 0, toBase: 1 },
      ]);
    });

    it("Case 2: 只有一壘有人 (Runner on 1B) - R1 被 Force 至二壘", () => {
      const runners: RunnerState = { first: "R1", second: null, third: null };
      const state = calculateForceState(runners, true, "batter-1");

      expect(state.runners.first?.isForced).toBe(true);
      expect(state.runners.first?.forceTargetBase).toBe(2);

      expect(state.forceChain).toEqual([
        { runnerId: "batter-1", fromBase: 0, toBase: 1 },
        { runnerId: "R1", fromBase: 1, toBase: 2 },
      ]);
    });

    it("Case 3: 只有二壘有人 (Runner on 2B) - R2 不被 Force (自主進壘)", () => {
      const runners: RunnerState = { first: null, second: "R2", third: null };
      const state = calculateForceState(runners, true, "batter-1");

      expect(state.runners.second?.isForced).toBe(false);
      expect(state.runners.second?.forceTargetBase).toBeNull();

      expect(state.forceChain).toEqual([
        { runnerId: "batter-1", fromBase: 0, toBase: 1 },
      ]);
    });

    it("Case 4: 只有三壘有人 (Runner on 3B) - R3 不被 Force (自主進壘)", () => {
      const runners: RunnerState = { first: null, second: null, third: "R3" };
      const state = calculateForceState(runners, true, "batter-1");

      expect(state.runners.third?.isForced).toBe(false);
      expect(state.runners.third?.forceTargetBase).toBeNull();

      expect(state.forceChain).toEqual([
        { runnerId: "batter-1", fromBase: 0, toBase: 1 },
      ]);
    });

    it("Case 5: 一、二壘有人 (Runners on 1B & 2B) - 形成 R1→2B, R2→3B Force Chain", () => {
      const runners: RunnerState = { first: "R1", second: "R2", third: null };
      const state = calculateForceState(runners, true, "batter-1");

      expect(state.runners.first?.isForced).toBe(true);
      expect(state.runners.first?.forceTargetBase).toBe(2);

      expect(state.runners.second?.isForced).toBe(true);
      expect(state.runners.second?.forceTargetBase).toBe(3);

      expect(state.forceChain).toEqual([
        { runnerId: "batter-1", fromBase: 0, toBase: 1 },
        { runnerId: "R1", fromBase: 1, toBase: 2 },
        { runnerId: "R2", fromBase: 2, toBase: 3 },
      ]);
    });

    it("Case 6: 一、三壘有人 (Runners on 1B & 3B) - R1 被 Force 至二壘，R3 不被 Force", () => {
      const runners: RunnerState = { first: "R1", second: null, third: "R3" };
      const state = calculateForceState(runners, true, "batter-1");

      expect(state.runners.first?.isForced).toBe(true);
      expect(state.runners.first?.forceTargetBase).toBe(2);

      expect(state.runners.third?.isForced).toBe(false);
      expect(state.runners.third?.forceTargetBase).toBeNull();

      expect(state.forceChain).toEqual([
        { runnerId: "batter-1", fromBase: 0, toBase: 1 },
        { runnerId: "R1", fromBase: 1, toBase: 2 },
      ]);
    });

    it("Case 7: 二、三壘有人，一壘空 (Runners on 2B & 3B) - R2, R3 均不被 Force (關鍵 Edge Case)", () => {
      const runners: RunnerState = { first: null, second: "R2", third: "R3" };
      const state = calculateForceState(runners, true, "batter-1");

      expect(state.runners.second?.isForced).toBe(false);
      expect(state.runners.second?.forceTargetBase).toBeNull();

      expect(state.runners.third?.isForced).toBe(false);
      expect(state.runners.third?.forceTargetBase).toBeNull();

      expect(state.forceChain).toEqual([
        { runnerId: "batter-1", fromBase: 0, toBase: 1 },
      ]);
    });

    it("Case 8: 滿壘 (Bases Loaded) - R1→2B, R2→3B, R3→Home 完整 Force Chain", () => {
      const runners: RunnerState = { first: "R1", second: "R2", third: "R3" };
      const state = calculateForceState(runners, true, "batter-1");

      expect(state.runners.first?.isForced).toBe(true);
      expect(state.runners.first?.forceTargetBase).toBe(2);

      expect(state.runners.second?.isForced).toBe(true);
      expect(state.runners.second?.forceTargetBase).toBe(3);

      expect(state.runners.third?.isForced).toBe(true);
      expect(state.runners.third?.forceTargetBase).toBe(4);

      expect(state.forceChain).toEqual([
        { runnerId: "batter-1", fromBase: 0, toBase: 1 },
        { runnerId: "R1", fromBase: 1, toBase: 2 },
        { runnerId: "R2", fromBase: 2, toBase: 3 },
        { runnerId: "R3", fromBase: 3, toBase: 4 },
      ]);
    });
  });

  describe("六與七、Force Play 與 Tag Play 嚴格區分 & 特殊事件", () => {
    it("七、盜壘事件 (Steal) 打者未成為跑者，跑者 force = false，出局屬 Tag Out", () => {
      const runners: RunnerState = { first: "R1", second: null, third: null };
      const state = calculateForceState(runners, false); // 打者未成為跑者

      expect(state.batterBecomesRunner).toBe(false);
      expect(state.runners.first?.isForced).toBe(false);

      const outType = determineOutType("R1", 2, state, false);
      expect(outType).toBe("TAG_OUT");
    });

    it("六、一壘有人打者擊出滾地球，守備員踩二壘，刺殺 R1 為 FORCE_OUT", () => {
      const runners: RunnerState = { first: "R1", second: null, third: null };
      const state = calculateForceState(runners, true, "batter-1");

      const r1OutType = determineOutType("R1", 2, state, false);
      expect(r1OutType).toBe("FORCE_OUT");

      const batterOutType = determineOutType("batter-1", 1, state, true);
      expect(batterOutType).toBe("FORCE_OUT");
    });

    it("只有二壘有人，R2 跑向三壘被刺殺，屬於 TAG_OUT", () => {
      const runners: RunnerState = { first: null, second: "R2", third: null };
      const state = calculateForceState(runners, true, "batter-1");

      const r2OutType = determineOutType("R2", 3, state, false);
      expect(r2OutType).toBe("TAG_OUT");
    });
  });

  describe("九、Force Chain 動態更新與解除 (Force Chain Resolution)", () => {
    it("一二壘有人，R1 在二壘 Force Out 後，R2 隨後在三壘被刺殺應為 TAG_OUT (Force 解除)", () => {
      const initialRunners: RunnerState = { first: "R1", second: "R2", third: null };
      const initialForceState = calculateForceState(initialRunners, true, "batter-1");

      // 第一步：R1 在 2 壘 Force Out
      const { nextRunners, nextForceState } = updateForceChainAfterOut(
        initialRunners,
        "R1",
        initialForceState
      );

      // R1 出局後，一壘空，此時 R2 在 3 壘不再被 Force！
      expect(nextRunners.first).toBeNull();
      expect(nextRunners.second).toBe("R2");
      expect(nextForceState.runners.second?.isForced).toBe(false);

      // 若守備員隨後在三壘刺殺 R2，出局型態必須為 TAG_OUT
      const r2OutType = determineOutType("R2", 3, nextForceState, false);
      expect(r2OutType).toBe("TAG_OUT");
    });
  });

  describe("十一與十二、滿壘本壘 Force Out & 第三出局與得分結算", () => {
    it("十一、滿壘時捕手踩本壘刺殺 R3，判定為 FORCE_OUT", () => {
      const runners: RunnerState = { first: "R1", second: "R2", third: "R3" };
      const state = calculateForceState(runners, true, "batter-1");

      const r3OutType = determineOutType("R3", 4, state, false);
      expect(r3OutType).toBe("FORCE_OUT");
    });

    it("十二、第三出局為 FORCE_OUT 時，無條件否定得分 (Runs Not Allowed)", () => {
      const settlement = evaluateThirdOutRunSettlement("FORCE_OUT", 2, true);
      expect(settlement.runsAllowed).toBe(false);
      expect(settlement.isForcePlayThirdOut).toBe(true);
    });

    it("十二、第三出局為 TAG_OUT 且跑者在大於出局完成前踏觸本壘，得分成立", () => {
      const settlement = evaluateThirdOutRunSettlement("TAG_OUT", 3, true);
      expect(settlement.runsAllowed).toBe(true);
      expect(settlement.isForcePlayThirdOut).toBe(false);
    });

    it("十二、第三出局為 TAG_OUT 但跑者未在出局完成前踏觸本壘，得分不成立", () => {
      const settlement = evaluateThirdOutRunSettlement("TAG_OUT", 3, false);
      expect(settlement.runsAllowed).toBe(false);
      expect(settlement.isForcePlayThirdOut).toBe(false);
    });
  });
});
