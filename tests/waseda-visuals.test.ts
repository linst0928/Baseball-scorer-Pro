import { describe, expect, it } from "vitest";

import { getHitAdvanceSegments, getRunnerAdvanceLines } from "../lib/baseball/waseda-visuals";

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
});
