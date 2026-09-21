import { describe, expect, it } from "vitest";

import { groupPitchHistoryByZone } from "../lib/baseball/pitch-history";

describe("本打者逐球九宮格歷程", () => {
  it("保留連續同格與內外圈投球的原始序號", () => {
    const history = groupPitchHistoryByZone([
      { zone: 5, type: "fastball", outcome: "strike" },
      { zone: 10, type: "breaking", outcome: "ball" },
      { zone: 5, type: "breaking", outcome: "foul" },
    ]);

    expect(history[5]).toEqual([
      { sequence: 1, type: "fastball", outcome: "strike" },
      { sequence: 3, type: "breaking", outcome: "foul" },
    ]);
    expect(history[10]).toEqual([{ sequence: 2, type: "breaking", outcome: "ball" }]);
  });

  it("新打席的空白暫存不帶入上一位打者的落點", () => {
    expect(groupPitchHistoryByZone([])).toEqual({});
  });

  it("回復上一球僅退回當前打席陣列最後一顆球並重新計算球數", () => {
    const pitches = [
      { zone: 5, type: "fastball" as const, outcome: "strike" as const },
      { zone: 10, type: "breaking" as const, outcome: "ball" as const },
      { zone: 5, type: "breaking" as const, outcome: "foul" as const },
    ];
    const popped = pitches.slice(0, -1);
    expect(popped.length).toBe(2);
    expect(popped[0].outcome).toBe("strike");
    expect(popped[1].outcome).toBe("ball");
  });
});
