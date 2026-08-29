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
});
