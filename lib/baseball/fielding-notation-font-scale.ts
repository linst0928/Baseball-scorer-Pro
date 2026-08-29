export const FIELDING_NOTATION_FONT_SCALE_STORAGE_KEY = "baseball-scorer-pro:fielding-notation-font-scale:v1";
export const FIELDING_NOTATION_FONT_SIZE_MIN = 14;
export const FIELDING_NOTATION_FONT_SIZE_MAX = 32;
export const DEFAULT_FIELDING_NOTATION_FONT_SIZE = 20;

const LEGACY_SCALE_TO_SIZE: Record<string, number> = {
  small: 16,
  standard: DEFAULT_FIELDING_NOTATION_FONT_SIZE,
  large: 26,
};

/**
 * 接受 V07 的 small／standard／large 舊偏好與新版數值，統一限制於滑桿範圍。
 * 此純函式只處理閱讀偏好，不參與任何正式賽事或統計資料。
 */
export function normalizeFieldingNotationFontSize(value: unknown): number {
  const legacyValue = typeof value === "string" ? LEGACY_SCALE_TO_SIZE[value] : undefined;
  const parsed = legacyValue ?? (typeof value === "number" ? value : Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_FIELDING_NOTATION_FONT_SIZE;
  return Math.min(FIELDING_NOTATION_FONT_SIZE_MAX, Math.max(FIELDING_NOTATION_FONT_SIZE_MIN, Math.round(parsed)));
}

export function getFieldingNotationFontMetrics(fontSize: number) {
  const safeFontSize = normalizeFieldingNotationFontSize(fontSize);
  return {
    fontSize: safeFontSize,
    lineHeight: Math.max(safeFontSize + 6, Math.round(safeFontSize * 1.48)),
  };
}
