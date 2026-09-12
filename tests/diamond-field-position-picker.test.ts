import { describe, expect, it } from "vitest";
import {
  DIAMOND_FIELD_POSITIONS,
  formatPositionShortName,
  formatPreferredPositionsShort,
  isPositionSelected,
} from "../lib/baseball/diamond-field-positions";

describe("DiamondFieldPositionPicker 棒球場菱形圖常用守備位置指派", () => {
  it("應包含 1 至 9 號完整的守備位置節點資訊與英文代號", () => {
    expect(DIAMOND_FIELD_POSITIONS).toHaveLength(9);
    const numbers = DIAMOND_FIELD_POSITIONS.map((p) => p.number);
    for (let i = 1; i <= 9; i++) {
      expect(numbers).toContain(String(i));
    }

    const pos6 = DIAMOND_FIELD_POSITIONS.find((p) => p.number === "6");
    expect(pos6).toBeDefined();
    expect(pos6?.enCode).toBe("SS");
    expect(pos6?.label).toBe("游擊手");
    expect(pos6?.shortLabel).toBe("游擊手");
    expect(pos6?.displayCode).toBe("SS 游擊手");

    const pos8 = DIAMOND_FIELD_POSITIONS.find((p) => p.number === "8");
    expect(pos8).toBeDefined();
    expect(pos8?.enCode).toBe("CF");
    expect(pos8?.label).toBe("中外野手");
    expect(pos8?.shortLabel).toBe("中外野");
    expect(pos8?.displayCode).toBe("CF 中外野");
  });

  it("isPositionSelected 應正確辨識多種守備位置名稱格式與英文代號", () => {
    const pos6 = DIAMOND_FIELD_POSITIONS.find((p) => p.number === "6")!;
    const pos8 = DIAMOND_FIELD_POSITIONS.find((p) => p.number === "8")!;
    const pos1 = DIAMOND_FIELD_POSITIONS.find((p) => p.number === "1")!;

    // 依號碼匹配
    expect(isPositionSelected(["6"], pos6)).toBe(true);
    expect(isPositionSelected(["6"], pos8)).toBe(false);

    // 依英文代號匹配
    expect(isPositionSelected(["SS"], pos6)).toBe(true);
    expect(isPositionSelected(["cf"], pos8)).toBe(true);

    // 依完整名稱匹配
    expect(isPositionSelected(["游擊手"], pos6)).toBe(true);
    expect(isPositionSelected(["中外野手"], pos8)).toBe(true);

    // 依簡稱匹配
    expect(isPositionSelected(["游擊"], pos6)).toBe(true);
    expect(isPositionSelected(["中外野"], pos8)).toBe(true);

    // 依複合字串匹配
    expect(isPositionSelected(["SS 游擊手"], pos6)).toBe(true);
    expect(isPositionSelected(["CF 中外野"], pos8)).toBe(true);

    // 多重選取陣列（最多4個常用守備位置）
    const selected = ["游擊手", "CF", "P", "1B"];
    expect(isPositionSelected(selected, pos6)).toBe(true);
    expect(isPositionSelected(selected, pos8)).toBe(true);
    expect(isPositionSelected(selected, pos1)).toBe(true);
    const pos2 = DIAMOND_FIELD_POSITIONS.find((p) => p.number === "2")!;
    expect(isPositionSelected(selected, pos2)).toBe(false);
  });

  it("formatPositionShortName 應將各格式精確轉為中文簡稱", () => {
    expect(formatPositionShortName("1")).toBe("投");
    expect(formatPositionShortName("投手")).toBe("投");
    expect(formatPositionShortName("P")).toBe("投");

    expect(formatPositionShortName("2")).toBe("捕");
    expect(formatPositionShortName("捕手")).toBe("捕");
    expect(formatPositionShortName("C")).toBe("捕");

    expect(formatPositionShortName("3")).toBe("一壘");
    expect(formatPositionShortName("一壘手")).toBe("一壘");
    expect(formatPositionShortName("1B")).toBe("一壘");

    expect(formatPositionShortName("4")).toBe("二壘");
    expect(formatPositionShortName("二壘手")).toBe("二壘");
    expect(formatPositionShortName("2B")).toBe("二壘");

    expect(formatPositionShortName("5")).toBe("三壘");
    expect(formatPositionShortName("三壘手")).toBe("三壘");
    expect(formatPositionShortName("3B")).toBe("三壘");

    expect(formatPositionShortName("6")).toBe("游擊");
    expect(formatPositionShortName("游擊手")).toBe("游擊");
    expect(formatPositionShortName("SS")).toBe("游擊");

    expect(formatPositionShortName("7")).toBe("左外");
    expect(formatPositionShortName("左外野手")).toBe("左外");
    expect(formatPositionShortName("LF")).toBe("左外");

    expect(formatPositionShortName("8")).toBe("中外");
    expect(formatPositionShortName("中外野手")).toBe("中外");
    expect(formatPositionShortName("CF")).toBe("中外");

    expect(formatPositionShortName("9")).toBe("右外");
    expect(formatPositionShortName("右外野手")).toBe("右外");
    expect(formatPositionShortName("RF")).toBe("右外");
  });

  it("formatPreferredPositionsShort 應將最多4個常用守備位置格式化為中文簡稱字串", () => {
    expect(formatPreferredPositionsShort(["投手", "捕手", "一壘手", "右外野手"])).toBe("投、捕、一壘、右外");
    expect(formatPreferredPositionsShort(["SS", "2B"])).toBe("游擊、二壘");
    expect(formatPreferredPositionsShort(["1", "2", "3", "8", "9"])).toBe("投、捕、一壘、中外");
    expect(formatPreferredPositionsShort([])).toBe("後備");
    expect(formatPreferredPositionsShort(undefined)).toBe("後備");
  });

  it("捕手 (C) 與各守備位置座標應符合 SVG 球場長寬比配置", () => {
    const posC = DIAMOND_FIELD_POSITIONS.find((p) => p.number === "2");
    expect(posC).toBeDefined();
    expect(posC?.enCode).toBe("C");
    expect(posC?.top).toBe("80%");
    expect(posC?.left).toBe("50%");

    const posP = DIAMOND_FIELD_POSITIONS.find((p) => p.number === "1");
    expect(posP?.top).toBe("55%");
    expect(posP?.left).toBe("50%");
  });

  it("空陣列或無效值應回傳 false", () => {
    const pos1 = DIAMOND_FIELD_POSITIONS.find((p) => p.number === "1")!;
    expect(isPositionSelected([], pos1)).toBe(false);
    expect(isPositionSelected(undefined, pos1)).toBe(false);
    expect(isPositionSelected([""], pos1)).toBe(false);
  });
});
