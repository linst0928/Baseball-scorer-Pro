import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  getWbc2013DisplayExample,
  isWbc2013DisplayExample,
  WBC2013_DISPLAY_EXAMPLES,
  WBC2013_DISPLAY_GAMES,
} from "../lib/baseball/wbc2013-display-examples";
import { createWasedaScorebookProjection } from "../lib/baseball/waseda-scorebook-projection";

const projectRoot = resolve(__dirname, "..");
const totalRuns = (scores: Array<{ away: number; home: number }>, side: "away" | "home") => scores.reduce((total, inning) => total + inning[side], 0);

describe("2013 WBC 唯讀連續列顯示範例", () => {
  it("提供三場可識別的唯讀公開賽果範例，且不宣稱展示逐球為官方資料", () => {
    expect(WBC2013_DISPLAY_EXAMPLES).toHaveLength(3);
    expect(WBC2013_DISPLAY_GAMES).toHaveLength(3);
    expect(WBC2013_DISPLAY_EXAMPLES.map((example) => example.label)).toEqual([
      "日本 4：3 中華台北（10局）",
      "荷蘭 7：6 古巴",
      "波多黎各 3：1 日本",
    ]);
    expect(WBC2013_DISPLAY_EXAMPLES.every((example) => example.game.competition?.includes("顯示範例（唯讀）"))).toBe(true);
    expect(WBC2013_DISPLAY_EXAMPLES.every((example) => example.game.notes.includes("並非官方逐球"))).toBe(true);
    expect(WBC2013_DISPLAY_EXAMPLES.every((example) => example.sourceUrls.length > 0)).toBe(true);
    expect(isWbc2013DisplayExample("wbc2013-japan-chinese-taipei-display")).toBe(true);
    expect(getWbc2013DisplayExample("not-a-display-example")).toBeUndefined();
  });

  it("保留可核對的比分、延長局與高密度單局情境", () => {
    const japanTaiwan = WBC2013_DISPLAY_EXAMPLES[0];
    const netherlandsCuba = WBC2013_DISPLAY_EXAMPLES[1];

    expect(japanTaiwan.game.score).toHaveLength(10);
    expect(totalRuns(japanTaiwan.game.score, "away")).toBe(4);
    expect(totalRuns(japanTaiwan.game.score, "home")).toBe(3);
    expect(netherlandsCuba.game.score).toHaveLength(9);
    expect(totalRuns(netherlandsCuba.game.score, "away")).toBe(7);
    expect(totalRuns(netherlandsCuba.game.score, "home")).toBe(6);
    expect(netherlandsCuba.game.events.filter((event) => event.half === "away" && event.inning === 1)).toHaveLength(11);
  });

  it("將範例純讀取投影為候補列、換人錯位與不限九個打席的連續列", () => {
    const example = WBC2013_DISPLAY_EXAMPLES[1];
    const sourceEvents = JSON.parse(JSON.stringify(example.game.events));
    const projection = createWasedaScorebookProjection({
      team: example.away,
      side: "away",
      lineup: example.game.awayLineup,
      events: example.game.events,
      substitutions: example.game.substitutions,
      inningCount: example.game.score.length,
    });

    expect(projection.maxPlateAppearances).toBeGreaterThan(9);
    expect(projection.innings[0]).toMatchObject({ inning: 1, slotCount: 11 });
    expect(projection.battingOrders.every((order) => order.entries.length >= 3)).toBe(true);
    expect(projection.battingOrders.some((order) => order.entries.some((entry) => entry.kind === "substitute" && entry.enteredInning === 6))).toBe(true);
    expect(example.game.events).toEqual(sourceEvents);
  });

  it("以暫時選取接入工作台，並將展示例項與正式資料的儲存、補正與匯出動作隔離", () => {
    const homeScreen = readFileSync(resolve(projectRoot, "app/(tabs)/index.tsx"), "utf8");
    const selector = readFileSync(resolve(projectRoot, "components/baseball/scorebook-workbench-controls.tsx"), "utf8");

    expect(homeScreen).toContain("WBC2013_DISPLAY_GAMES");
    expect(homeScreen).toContain("const [wbcDisplayExampleId, setWbcDisplayExampleId]");
    expect(homeScreen).toContain("isReadOnly={Boolean(wbcDisplayExample)}");
    expect(homeScreen).toContain("setWbcDisplayExampleId(example.id)");
    expect(homeScreen).toContain("disabled={isReadOnly}");
    expect(homeScreen).toContain("不寫入本機資料");
    expect(selector).toContain('"examples", "2013 WBC 範例"');
    expect(selector).toContain("唯讀展示範例");
  });
});
