import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("閱讀偏好設定頁", () => {
  it("提供獨立設定頁、滑桿微調與本機偏好套用，不讀寫正式賽事資料", () => {
    const screen = readFileSync(resolve(process.cwd(), "app/reading-preferences.tsx"), "utf8");
    const provider = readFileSync(resolve(process.cwd(), "lib/fielding-notation-preferences.tsx"), "utf8");
    const settings = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(screen).toContain('import Slider from "@react-native-community/slider"');
    expect(screen).toContain('accessibilityLabel="傳接序列文字大小滑桿"');
    expect(screen).toContain("minimumValue={FIELDING_NOTATION_FONT_SIZE_MIN}");
    expect(screen).toContain("maximumValue={FIELDING_NOTATION_FONT_SIZE_MAX}");
    expect(screen).toContain("onSlidingComplete={(value) => setFontSize(value)}");
    expect(screen).toContain("閱讀保護");
    expect(provider).toContain("AsyncStorage.setItem(FIELDING_NOTATION_FONT_SCALE_STORAGE_KEY");
    expect(provider).toContain("不得寫入任何 Game 或 AtBatEvent");
    expect(settings).toContain("onOpenReadingPreferences");
    expect(settings).toContain('router.push("/reading-preferences")');
  });
});
