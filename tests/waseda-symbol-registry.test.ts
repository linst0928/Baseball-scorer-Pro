import { describe, expect, it } from "vitest";
import { WASEDA_SYMBOL_REGISTRY, validateWasedaSymbols } from "../lib/baseball/waseda-symbol-registry";
import { getHitAdvanceSegments, getRunnerAdvanceLines } from "../lib/baseball/waseda-visuals";

describe("早稻田符號系統標準與稽核 (Waseda Symbol Registry)", () => {
  it("通過完整的符號稽核驗證 validateWasedaSymbols", () => {
    const audit = validateWasedaSymbols();
    expect(audit.isCompliant).toBe(true);
    expect(audit.missingMappings).toHaveLength(0);
    expect(audit.pendingConfirmationCount).toBe(0);
  });

  it("安打符號與顏色符合左上角紅色標準", () => {
    expect(WASEDA_SYMBOL_REGISTRY.SINGLE.color).toBe("red");
    expect(WASEDA_SYMBOL_REGISTRY.SINGLE.quadrant).toBe("TOP_LEFT");
    expect(WASEDA_SYMBOL_REGISTRY.SINGLE.symbol).toBe("1B");

    expect(WASEDA_SYMBOL_REGISTRY.DOUBLE.symbol).toBe("2B");
    expect(WASEDA_SYMBOL_REGISTRY.TRIPLE.symbol).toBe("3B");
    expect(WASEDA_SYMBOL_REGISTRY.HOME_RUN.symbol).toBe("HR");
  });

  it("得分/打點符號符合左下角紅色標準", () => {
    expect(WASEDA_SYMBOL_REGISTRY.RUN_SCORED_1.color).toBe("red");
    expect(WASEDA_SYMBOL_REGISTRY.RUN_SCORED_1.quadrant).toBe("BOTTOM_LEFT");
    expect(WASEDA_SYMBOL_REGISTRY.RUN_SCORED_1.symbol).toBe("①");

    expect(WASEDA_SYMBOL_REGISTRY.RUN_SCORED_2.symbol).toBe("②");
    expect(WASEDA_SYMBOL_REGISTRY.RUN_SCORED_3.symbol).toBe("③");
    expect(WASEDA_SYMBOL_REGISTRY.RUN_SCORED_4.symbol).toBe("④");
  });

  it("右上角特殊跑壘與防守事件符合藍色標準", () => {
    expect(WASEDA_SYMBOL_REGISTRY.WILD_PITCH.quadrant).toBe("TOP_RIGHT");
    expect(WASEDA_SYMBOL_REGISTRY.WILD_PITCH.symbol).toBe("WP");

    expect(WASEDA_SYMBOL_REGISTRY.PASSED_BALL.symbol).toBe("PB");
    expect(WASEDA_SYMBOL_REGISTRY.PICKOFF_OUT.symbol).toBe("PO");
    expect(WASEDA_SYMBOL_REGISTRY.OBSTRUCTION.symbol).toBe("OB");
    expect(WASEDA_SYMBOL_REGISTRY.BALK.symbol).toBe("BK");
  });

  it("右下角打席結果與妨礙事件符合標準", () => {
    expect(WASEDA_SYMBOL_REGISTRY.WALK.symbol).toBe("BB");
    expect(WASEDA_SYMBOL_REGISTRY.HIT_BY_PITCH.symbol).toBe("D");
    expect(WASEDA_SYMBOL_REGISTRY.INTENTIONAL_WALK.symbol).toBe("DIB");
    expect(WASEDA_SYMBOL_REGISTRY.STRIKEOUT.symbol).toBe("K");
    expect(WASEDA_SYMBOL_REGISTRY.DROPPED_THIRD_STRIKE.symbol).toBe("ꓘ");
    expect(WASEDA_SYMBOL_REGISTRY.CATCHER_INTERFERENCE.symbol).toBe("2IF");
    expect(WASEDA_SYMBOL_REGISTRY.BATTER_INTERFERENCE.symbol).toBe("IP2");
    expect(WASEDA_SYMBOL_REGISTRY.FIELDER_CHOICE.symbol).toBe("FC");
  });

  it("盜壘帶藍色箭頭，一般進壘無箭頭", () => {
    const sbLines = getRunnerAdvanceLines({
      runnerAdvance: { type: "SB", fromBase: 1, toBase: 2 },
    });
    expect(sbLines[0]?.hasArrow).toBe(true);
    expect(sbLines[0]?.label).toBe("SB");

    const advLines = getRunnerAdvanceLines({
      runnerAdvance: { type: "ADV", fromBase: 1, toBase: 2 },
    });
    expect(advLines[0]?.hasArrow).toBe(false);

    const poLines = getRunnerAdvanceLines({
      runnerAdvance: { type: "PO", fromBase: 1, toBase: 2 },
    });
    expect(poLines[0]?.label).toBe("PO1-3");
    expect(poLines[0]?.isCutLine).toBe(true);
  });
});
