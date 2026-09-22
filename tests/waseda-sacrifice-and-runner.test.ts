import { describe, expect, it } from "vitest";
import { isSacrificeBuntRecord, isSacrificeFlyRecord, type RunnerAdvanceRecord } from "../lib/baseball/types";

describe("早稻田犧牲打外框與跑壘代跑結構測試", () => {
  it("正確認定犧牲短打（SH/SAC）與高飛犧牲打（SF）記錄", () => {
    expect(isSacrificeBuntRecord({ modifiers: ["犧牲短打（SH）"] })).toBe(true);
    expect(isSacrificeBuntRecord({ modifiers: ["一般滾地球"] })).toBe(false);

    expect(isSacrificeFlyRecord({ modifiers: ["高飛犧牲打（SF）"] })).toBe(true);
    expect(isSacrificeFlyRecord({ modifiers: ["一般高飛球"] })).toBe(false);
  });

  it("RunnerAdvanceRecord 結構擴充支援 substitutedPlayer 與 baseLocation 特定象限波浪線定位", () => {
    const prRecord: RunnerAdvanceRecord = {
      id: "pr-1",
      type: "ADV",
      fromBase: 1,
      toBase: 2,
      notation: "PR 林庫均 1→2",
      substitutedPlayer: {
        originalPlayerId: "player-1",
        substitutePlayerId: "player-15",
        substitutePlayerName: "林庫均",
      },
      baseLocation: 1, // 一壘代跑
    };

    expect(prRecord.substitutedPlayer?.substitutePlayerName).toBe("林庫均");
    expect(prRecord.baseLocation).toBe(1);
  });
});
