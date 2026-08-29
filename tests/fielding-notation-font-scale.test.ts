import { describe, expect, it } from "vitest";

import {
  DEFAULT_FIELDING_NOTATION_FONT_SIZE,
  FIELDING_NOTATION_FONT_SIZE_MAX,
  FIELDING_NOTATION_FONT_SIZE_MIN,
  FIELDING_NOTATION_FONT_SCALE_STORAGE_KEY,
  getFieldingNotationFontMetrics,
  normalizeFieldingNotationFontSize,
} from "../lib/baseball/fielding-notation-font-scale";

describe("傳接序列放大檢視字級偏好", () => {
  it("提供可微調滑桿範圍，且字級與行高維持可讀比例", () => {
    expect(FIELDING_NOTATION_FONT_SIZE_MIN).toBe(14);
    expect(FIELDING_NOTATION_FONT_SIZE_MAX).toBe(32);
    expect(getFieldingNotationFontMetrics(FIELDING_NOTATION_FONT_SIZE_MIN).fontSize).toBeLessThan(getFieldingNotationFontMetrics(FIELDING_NOTATION_FONT_SIZE_MAX).fontSize);
    expect(getFieldingNotationFontMetrics(24).lineHeight).toBeGreaterThan(getFieldingNotationFontMetrics(24).fontSize);
  });

  it("保留舊三段偏好相容性，並正規化新的數值、越界值與無效值", () => {
    expect(FIELDING_NOTATION_FONT_SCALE_STORAGE_KEY).toBe("baseball-scorer-pro:fielding-notation-font-scale:v1");
    expect(normalizeFieldingNotationFontSize("small")).toBe(16);
    expect(normalizeFieldingNotationFontSize("standard")).toBe(DEFAULT_FIELDING_NOTATION_FONT_SIZE);
    expect(normalizeFieldingNotationFontSize("large")).toBe(26);
    expect(normalizeFieldingNotationFontSize("27.6")).toBe(28);
    expect(normalizeFieldingNotationFontSize(4)).toBe(FIELDING_NOTATION_FONT_SIZE_MIN);
    expect(normalizeFieldingNotationFontSize(99)).toBe(FIELDING_NOTATION_FONT_SIZE_MAX);
    expect(normalizeFieldingNotationFontSize("invalid-size")).toBe(DEFAULT_FIELDING_NOTATION_FONT_SIZE);
  });
});
