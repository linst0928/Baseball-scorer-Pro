import { describe, expect, it } from "vitest";

import { getHitAdvanceSegments, getRunnerAdvanceLines, splitPitchMarksForVerticalGrid } from "../lib/baseball/waseda-visuals";

describe("早稻田安打推進線", () => {
  it("一壘安打僅繪製本壘至一壘的右下紅線", () => {
    expect(getHitAdvanceSegments("1B")).toEqual(["home-to-first"]);
  });

  it("長打依實際推進壘數逐段延伸，且非安打不繪製紅線", () => {
    expect(getHitAdvanceSegments("2B")).toHaveLength(2);
    expect(getHitAdvanceSegments("3B")).toHaveLength(3);
    expect(getHitAdvanceSegments("HR")).toHaveLength(4);
    expect(getHitAdvanceSegments("BB")).toEqual([]);
  });
});

describe("逐球欄分割與最多球數", () => {
  it("每欄最多7球、兩欄共最多14球，超過14球不溢出", () => {
    const marks20 = "○—△▲⊖⌁◓•○—△▲⊖⌁◓•";
    const [col1, col2] = splitPitchMarksForVerticalGrid(marks20);
    expect(col1).toHaveLength(7);
    expect(col2).toHaveLength(7);
  });
});

describe("早稻田跑壘藍線與盜壘箭頭", () => {
  it("保送、觸身、失誤與不死三振上一壘使用無箭頭右下藍線", () => {
    expect(getRunnerAdvanceLines({ result: "BB" })).toEqual([{ segment: "home-to-first", hasArrow: false }]);
    expect(getRunnerAdvanceLines({ result: "HBP" })).toEqual([{ segment: "home-to-first", hasArrow: false }]);
    expect(getRunnerAdvanceLines({ result: "E" })).toEqual([{ segment: "home-to-first", hasArrow: false }]);
    expect(getRunnerAdvanceLines({ result: "K", modifiers: ["K+（不死三振）"] })).toEqual([{ segment: "home-to-first", hasArrow: false }]);
    expect(getRunnerAdvanceLines({ result: "K" })).toEqual([]);
  });

  it("一般進壘依壘間方向繪製無箭頭藍線", () => {
    expect(getRunnerAdvanceLines({ runnerAdvance: { type: "ADV", fromBase: 1, toBase: 2 } })).toEqual([{ segment: "first-to-second", hasArrow: false }]);
    expect(getRunnerAdvanceLines({ runnerAdvance: { type: "WP", fromBase: 2, toBase: 3 } })).toEqual([{ segment: "second-to-third", hasArrow: false }]);
    expect(getRunnerAdvanceLines({ runnerAdvance: { type: "PB", fromBase: 3, toBase: 4 } })).toEqual([{ segment: "third-to-home", hasArrow: false }]);
  });

  it("連續觸身球回寫到來源打席的強制進壘使用無箭頭藍線", () => {
    expect(getRunnerAdvanceLines({ result: "HBP", runnerAdvance: { type: "ADV", fromBase: 1, toBase: 2 } })).toEqual([{ segment: "first-to-second", hasArrow: false }]);
    expect(getRunnerAdvanceLines({ result: "HBP", runnerAdvance: { type: "ADV", fromBase: 2, toBase: 3 } })).toEqual([{ segment: "second-to-third", hasArrow: false }]);
    expect(getRunnerAdvanceLines({ result: "HBP", runnerAdvance: { type: "ADV", fromBase: 3, toBase: 4 } })).toEqual([{ segment: "third-to-home", hasArrow: false }]);
  });

  it("盜壘使用藍色方向箭頭並標示 SB", () => {
    expect(getRunnerAdvanceLines({ runnerAdvance: { type: "SB", fromBase: 1, toBase: 2 } })).toEqual([{ segment: "first-to-second", hasArrow: true, label: "SB" }]);
    expect(getRunnerAdvanceLines({ runnerAdvance: { type: "SB", fromBase: 2, toBase: 3 } })).toEqual([{ segment: "second-to-third", hasArrow: true, label: "SB" }]);
    expect(getRunnerAdvanceLines({ runnerAdvance: { type: "SB", fromBase: 3, toBase: 4 } })).toEqual([{ segment: "third-to-home", hasArrow: true, label: "SB" }]);
  });

  it("投手犯規 BK 以無箭頭藍線推進並在來源邊線標示 BK", () => {
    expect(getRunnerAdvanceLines({ runnerAdvance: { type: "BK", fromBase: 1, toBase: 2 } })).toEqual([{ segment: "first-to-second", hasArrow: false, label: "BK" }]);
    expect(getRunnerAdvanceLines({ runnerAdvance: { type: "BK", fromBase: 3, toBase: 4 } })).toEqual([{ segment: "third-to-home", hasArrow: false, label: "BK" }]);
  });

  it("一壘安打後原一壘跑者推進二壘時，安打紅線與不同壘間的藍線須同步保留", () => {
    expect(getRunnerAdvanceLines({ result: "1B", runnerAdvance: { type: "ADV", fromBase: 1, toBase: 2 } })).toEqual([{ segment: "first-to-second", hasArrow: false }]);
  });

  it("確認所有壘包的推進與盜壘(不包含安打)流程皆會顯示藍色線條，而安打流程皆會顯示紅色線條", () => {
    // 1. 推進、盜壘流程 -> 藍色線條 (不包含安打重疊部分)
    // 0-1 壘間藍線 (由保送、觸身球、失誤、不死三振等推進觸發)
    expect(getRunnerAdvanceLines({ result: "BB" })).toEqual([{ segment: "home-to-first", hasArrow: false }]);
    expect(getRunnerAdvanceLines({ result: "HBP" })).toEqual([{ segment: "home-to-first", hasArrow: false }]);
    expect(getRunnerAdvanceLines({ result: "E" })).toEqual([{ segment: "home-to-first", hasArrow: false }]);
    expect(getRunnerAdvanceLines({ result: "K", modifiers: ["K+（不死三振）"] })).toEqual([{ segment: "home-to-first", hasArrow: false }]);

    // 1-2 壘間藍線 (一般推進、盜壘成功)
    expect(getRunnerAdvanceLines({ result: "1B", runnerAdvance: { type: "ADV", fromBase: 1, toBase: 2 } })).toEqual([{ segment: "first-to-second", hasArrow: false }]);
    expect(getRunnerAdvanceLines({ result: "1B", runnerAdvance: { type: "SB", fromBase: 1, toBase: 2 } })).toEqual([{ segment: "first-to-second", hasArrow: true, label: "SB" }]);

    // 2-3 壘間藍線 (一般推進、盜壘成功)
    expect(getRunnerAdvanceLines({ result: "1B", runnerAdvance: { type: "ADV", fromBase: 2, toBase: 3 } })).toEqual([{ segment: "second-to-third", hasArrow: false }]);
    expect(getRunnerAdvanceLines({ result: "1B", runnerAdvance: { type: "SB", fromBase: 2, toBase: 3 } })).toEqual([{ segment: "second-to-third", hasArrow: true, label: "SB" }]);

    // 3-4 (三壘回本壘) 壘間藍線 (一般推進回本壘得分、盜壘回本壘得分)
    expect(getRunnerAdvanceLines({ result: "1B", runnerAdvance: { type: "ADV", fromBase: 3, toBase: 4 } })).toEqual([{ segment: "third-to-home", hasArrow: false }]);
    expect(getRunnerAdvanceLines({ result: "1B", runnerAdvance: { type: "SB", fromBase: 3, toBase: 4 } })).toEqual([{ segment: "third-to-home", hasArrow: true, label: "SB" }]);

    // 2. 安打流程 -> 紅色線條
    // 一壘安打：本壘到一壘紅色線條
    expect(getHitAdvanceSegments("1B")).toEqual(["home-to-first"]);
    // 二壘安打：本壘到一壘、一壘到二壘紅色線條
    expect(getHitAdvanceSegments("2B")).toEqual(["home-to-first", "first-to-second"]);
    // 三壘安打：本壘到一壘、一壘到二壘、二壘到三壘紅色線條
    expect(getHitAdvanceSegments("3B")).toEqual(["home-to-first", "first-to-second", "second-to-third"]);
    // 全壘打：本壘到一壘、一壘到二壘、二壘到三壘、三壘到本壘紅色線條
    expect(getHitAdvanceSegments("HR")).toEqual(["home-to-first", "first-to-second", "second-to-third", "third-to-home"]);
  });

  it("推進跑者時，若提供 advancedByOrder，應在藍色進壘線上渲染對應棒次的圓括號數字標記 (如 (4))", () => {
    expect(
      getRunnerAdvanceLines({
        runnerAdvance: { type: "ADV", fromBase: 1, toBase: 2, advancedByOrder: 4 },
      })
    ).toEqual([{ segment: "first-to-second", hasArrow: false, label: "(4)" }]);

    expect(
      getRunnerAdvanceLines({
        runnerAdvance: { type: "ADV", fromBase: 2, toBase: 3, advancedByOrder: 9 },
      })
    ).toEqual([{ segment: "second-to-third", hasArrow: false, label: "(9)" }]);
  });
});
