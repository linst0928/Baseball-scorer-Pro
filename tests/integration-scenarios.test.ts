import { describe, expect, it } from "vitest";
import {
  runScenario1,
  runScenario2,
  runScenario3,
  runScenario4,
  runScenario5,
  loadScenarioState,
} from "../lib/baseball/test-scenarios";

describe("5大棒球劇本綜合壓力測試", () => {
  describe("🎬 劇本一：基礎推進、盜壘與打線循環測試", () => {
    it("驗證標準安打推進、盜壘UI顯示與棒次重置邏輯", () => {
      const { assertions } = runScenario1();

      expect(assertions.top1Clean3Up3Down).toBe(true);
      expect(assertions.bot1HasSacrificeFly).toBe(true);
      expect(assertions.bot1SacrificeFlyRbi).toBe(1);
      expect(assertions.top2HasGrandSlam).toBe(true);
      expect(assertions.top2HasDoublePlay).toBe(true);
      expect(assertions.bot2BattingAround).toBeGreaterThan(10);
      expect(assertions.bot2TotalRuns).toBeGreaterThan(0);
    });

    it("驗證殘壘結束半局與盜壘失敗邏輯", () => {
      const { assertions } = runScenario1();

      expect(assertions.afterTop3InningClean).toBe(true);
      expect(assertions.bottom3HasCaughtStealing).toBe(true);
      expect(assertions.bottom3EventsCount).toBeGreaterThan(0);
    });

    it("支援一鍵載入劇本一狀態", () => {
      const state = loadScenarioState(1);
      expect(state.id).toBe("game-scenario-test");
      expect(state.events.length).toBeGreaterThan(20);
    });
  });

  describe("🎬 劇本二：非安打推進與野手選擇 (小球戰術)", () => {
    it("驗證失誤、暴投、捕逸、野手選擇的UI聯動", () => {
      const { assertions } = runScenario2();

      expect(assertions.top1HasError).toBe(true);
      expect(assertions.top1ErrorNotation).toBe("E6");
      expect(assertions.top1HasWildPitch).toBe(true);
      expect(assertions.bot1HasHbp).toBe(true);
      expect(assertions.bot1HbpRbi).toBe(1);
      expect(assertions.bot1HasPanels).toBe(true);
      expect(assertions.top2HasDroppedThirdStrike).toBe(true);
      expect(assertions.top2HasSacBunt).toBe(true);
      expect(assertions.top3HasFieldersChoice).toBe(true);
      expect(assertions.top3InfieldFlyCount).toBe(3);
    });

    it("驗證牽制失誤推進邏輯", () => {
      const { assertions } = runScenario2();
      expect(assertions.bottom3HasPickoffError).toBe(true);
    });

    it("支援一鍵載入劇本二狀態", () => {
      const state = loadScenarioState(2);
      expect(state.specialEvents.some((e) => e.type === "WP")).toBe(true);
      expect(state.specialEvents.some((e) => e.type === "PB")).toBe(true);
    });
  });

  describe("🎬 劇本三：頻繁人員調度 (換打、換投、代跑)", () => {
    it("驗證代打、代跑替換後的棒次繼承與數據歸屬", () => {
      const { assertions } = runScenario3();

      expect(assertions.pr11Score).toBe(1);
      expect(assertions.pr17Score).toBe(1);
      expect(assertions.batter1Score).toBe(1);
      expect(assertions.batter1Rbi).toBe(2);
      expect(assertions.rp13Strikeouts).toBeGreaterThan(0);
      expect(assertions.nextBatterId).toBe("away-2");
      expect(assertions.isNextBatter2nd).toBe(true);
      expect(assertions.substitutionsCount).toBeGreaterThan(5);
      expect(assertions.hasFieldingChange).toBe(true);
    });

    it("支援一鍵載入劇本三狀態", () => {
      const state = loadScenarioState(3);
      expect(state.substitutions.length).toBeGreaterThan(5);
    });
  });

  describe("🎬 劇本四：跑壘極限狀態與罕見出局", () => {
    it("驗證夾殺、妨礙守備/打擊、牽制出局的UI聯動", () => {
      const { assertions } = runScenario4();

      expect(assertions.top1HasCaughtStealing).toBe(true);
      expect(assertions.bottom1HasCaughtStealing).toBe(true);
      expect(assertions.top2HasLineOutDoublePlay).toBe(true);
      expect(assertions.bottom2HasSafetyPlay).toBe(true);
      expect(assertions.top3HasFieldingObstruction).toBe(true);
    });

    it("驗證再見得分與比賽結束狀態", () => {
      const { assertions } = runScenario4();
      expect(assertions.gameEndedByWinningRun).toBe(true);
      expect(assertions.hasWalkOffError).toBe(true);
    });

    it("支援一鍵載入劇本四狀態", () => {
      const state = loadScenarioState(4);
      expect(state.events.some((e) => e.result === "E")).toBe(true);
    });
  });

  describe("🎬 劇本五：超高壓綜合壓力測試", () => {
    it("驗證打線、調度、戰術混合的跨頁面資料庫完整性", () => {
      const { assertions } = runScenario5();

      expect(assertions.top1TotalRuns).toBeGreaterThan(0);
      expect(assertions.top1MixedEvents).toBe(true);
      expect(assertions.hasScoringSubstitution).toBe(true);
      expect(assertions.hasHrSubstitution).toBe(true);
      expect(assertions.doublePlayEndGame).toBe(true);
      expect(assertions.finalStatus).toBe("final");
      expect(assertions.finalInning).toBe(3);
      expect(assertions.finalHalf).toBe("home");
      expect(assertions.pr11Runs2).toBeGreaterThan(0);
      expect(assertions.ph19Rbi).toBeGreaterThan(0);
      expect(assertions.batter7Runs).toBeGreaterThan(0);
      expect(assertions.batter7Rbi).toBeGreaterThan(0);
    });

    it("支援一鍵載入劇本五狀態", () => {
      const state = loadScenarioState(5);
      expect(state.status).toBe("final");
    });
  });
});
