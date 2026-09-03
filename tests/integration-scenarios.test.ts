import { describe, expect, it } from "vitest";
import {
  runScenario1,
  runScenario2,
  runScenario3,
  runScenario4,
  runScenario5,
  loadScenarioState,
} from "../lib/baseball/test-scenarios";
import { nextRunnerState } from "../lib/baseball/types";

describe("系統全面壓力與整合測試 (5大棒球劇本)", () => {
  describe("🎬 劇本一：常規推進、安打不推進與棒次跨局連續性 (基礎打擊戰)", () => {
    it("驗證一局上三上三下、一局下 Hold 跑者與得分、二局上打序連貫由 4 棒開始", () => {
      const { assertions } = runScenario1();

      expect(assertions.top1Score).toBe(0);
      expect(assertions.bot1Score).toBe(1);
      expect(assertions.isTop2StartBatterMatch).toBe(true);
      expect(assertions.top2StartBatterId).toBe("away-4");
      expect(assertions.top2Inning).toBe(2);
      expect(assertions.top2Half).toBe("away");
    });

    it("支援一鍵載入劇本一狀態", () => {
      const state = loadScenarioState(1);
      expect(state.id).toBe("game-scenario-test");
      expect(state.events.length).toBeGreaterThan(0);
    });
  });

  describe("🎬 劇本二：壘包破壞者 (盜壘、暴投、牽制與特殊推進)", () => {
    it("驗證 SB, CS, WP, SF, PO, K+E2 與 BK 特殊進壘與出局狀態綁定", () => {
      const { game, assertions } = runScenario2();

      expect(assertions.hasStolenBase).toBe(true);
      expect(assertions.hasCaughtStealing).toBe(true);
      expect(assertions.hasWildPitch).toBe(true);
      expect(assertions.hasPickoff).toBe(true);
      expect(assertions.hasBalk).toBe(true);
      expect(game.specialEvents.length).toBeGreaterThanOrEqual(5);
    });

    it("支援一鍵載入劇本二狀態", () => {
      const state = loadScenarioState(2);
      expect(state.specialEvents.some((e) => e.type === "WP")).toBe(true);
      expect(state.specialEvents.some((e) => e.type === "PO")).toBe(true);
    });
  });

  describe("🎬 劇本三：教練團的調度藝術 (換打 PH、換投 RP、代跑 PR)", () => {
    it("驗證代跑得分歸屬、後援投手三振歸屬、代打/二次代跑及打序延續至 2 棒", () => {
      const { assertions } = runScenario3();

      expect(assertions.pr11Score).toBe(1);
      expect(assertions.pr16Score).toBe(1);
      expect(assertions.batter1Score).toBe(1);
      expect(assertions.batter1Rbi).toBe(2);
      expect(assertions.rp13Strikeouts).toBe(1);
      expect(assertions.isNextBatter2nd).toBe(true);
      expect(assertions.nextBatterId).toBe("away-2");
    });

    it("支援一鍵載入劇本三狀態", () => {
      const state = loadScenarioState(3);
      expect(state.substitutions.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("🎬 劇本四：野手選擇、失誤與極端防守 (FC, Error, Time Play)", () => {
    it("驗證 FC 野手選擇、E5 失誤、DP 雙殺與第 3 出局非封殺之 Time Play 阻斷確認", () => {
      const { assertions } = runScenario4();

      expect(assertions.timePlayRequiresConfirmation).toBe(true);
      expect(assertions.timePlayIsForcePlayOut).toBe(false);

      // 加強斷言：失誤上壘時，打者應安全站上一壘，若一壘有人則強制推進二壘
      const stateBeforeError = { first: "away-1", second: null, third: null };
      const resultAfterError = nextRunnerState(stateBeforeError, "E", "away-2");
      expect(resultAfterError.runners.first).toBe("away-2");
      expect(resultAfterError.runners.second).toBe("away-1");
    });

    it("支援一鍵載入劇本四狀態", () => {
      const state = loadScenarioState(4);
      expect(state.events.some((e) => e.recordColumn?.fieldingPlay === "FC")).toBe(true);
    });
  });

  describe("🎬 劇本五：無盡的半局 (一輪猛攻與強制進壘防呆)", () => {
    it("驗證滿壘觸身球與滿壘保送自動推進、一局上得 8 分、攻守交換後二局上由 4 棒開局", () => {
      const { assertions } = runScenario5();

      expect(assertions.isTop1EightRuns).toBe(true);
      expect(assertions.top1TotalRuns).toBe(8);
      expect(assertions.runnersClearedAfterInning).toBe(true);
      expect(assertions.isTop2StartBatter4th).toBe(true);
      expect(assertions.top2StartBatterId).toBe("away-4");
    });

    it("支援一鍵載入劇本五狀態", () => {
      const state = loadScenarioState(5);
      expect(state.score.find((s) => s.inning === 1)?.away).toBe(8);
    });
  });
});
