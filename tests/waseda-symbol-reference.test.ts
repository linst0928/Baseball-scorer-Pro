import { describe, expect, it } from "vitest";

import { WASEDA_SYMBOL_CATEGORIES, WASEDA_SYMBOL_REFERENCE } from "../lib/baseball/waseda-symbol-reference";

describe("早稻田符號速查字典", () => {
  it("涵蓋五個紀錄分區，且每個分類皆有可供速查的符號", () => {
    expect(WASEDA_SYMBOL_CATEGORIES).toEqual(["全部", "球數欄", "外圈", "內圈", "跑壘／特殊", "守備／軌跡"]);
    for (const category of WASEDA_SYMBOL_CATEGORIES.slice(1)) {
      expect(WASEDA_SYMBOL_REFERENCE.some((symbol) => symbol.category === category)).toBe(true);
    }
  });

  it("每個符號均可唯一識別，並提供位置、用法與範例", () => {
    const ids = WASEDA_SYMBOL_REFERENCE.map((symbol) => symbol.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(WASEDA_SYMBOL_REFERENCE.length).toBeGreaterThanOrEqual(25);
    for (const symbol of WASEDA_SYMBOL_REFERENCE) {
      expect(symbol.mark.trim().length).toBeGreaterThan(0);
      expect(symbol.title.trim().length).toBeGreaterThan(0);
      expect(symbol.placement.trim().length).toBeGreaterThan(0);
      expect(symbol.description.trim().length).toBeGreaterThan(0);
      expect(symbol.example.trim().length).toBeGreaterThan(0);
    }
  });

  it("將失誤與飛滾球出局的結果代碼與右下守備傳接資訊分離", () => {
    const byId = Object.fromEntries(WASEDA_SYMBOL_REFERENCE.map((symbol) => [symbol.id, symbol]));

    expect(byId.error.mark).toBe("E");
    expect(byId["fly-out"].mark).toBe("FO");
    expect(byId["ground-out"].mark).toBe("GO");
    expect(byId.error.example).not.toMatch(/\dE/);
    expect(byId["fly-out"].example).not.toMatch(/F\d/);
    expect(byId["ground-out"].example).not.toMatch(/GO\s*\d/);
    expect(byId["fielding-sequence"].placement).toContain("右下");
  });
});
