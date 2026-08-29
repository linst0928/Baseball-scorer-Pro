import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { getDroppedThirdStrikeEligibility, isAtBatOut, isDroppedThirdStrikeLegal } from "../lib/baseball/types";

describe("不死三振 K+ 規則", () => {
  it("僅一壘無人或兩出局時允許第三好球未接捕後上壘", () => {
    const emptyFirst = { first: null, second: "runner-2", third: null };
    const occupiedFirst = { first: "runner-1", second: null, third: null };

    expect(isDroppedThirdStrikeLegal(emptyFirst, 0)).toBe(true);
    expect(getDroppedThirdStrikeEligibility(emptyFirst, 0)).toEqual({ allowed: true });
    expect(isDroppedThirdStrikeLegal(occupiedFirst, 0)).toBe(false);
    expect(getDroppedThirdStrikeEligibility(occupiedFirst, 1)).toMatchObject({ allowed: false, reason: expect.stringContaining("一壘已有跑者") });
    expect(isDroppedThirdStrikeLegal(occupiedFirst, 2)).toBe(true);
    expect(getDroppedThirdStrikeEligibility(occupiedFirst, 2)).toEqual({ allowed: true });
  });

  it("合法 K+ 仍是 K 統計但不計一般打席出局，普通 K 則維持出局", () => {
    expect(isAtBatOut({ result: "K", recordColumn: { modifiers: [] }, droppedThirdStrike: false })).toBe(true);
    expect(isAtBatOut({ result: "K", recordColumn: { modifiers: ["不死三振 K+"] }, droppedThirdStrike: false })).toBe(false);
    expect(isAtBatOut({ result: "K", recordColumn: { modifiers: [] }, droppedThirdStrike: true })).toBe(false);
  });

  it("現場與正式補登都以 K+ 專用受控選項與同一壘況理由提示處理", () => {
    const source = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");

    expect(source).toContain("getDroppedThirdStrikeEligibility");
    expect(source).toContain("第三好球確認");
    expect(source).toContain("不死三振 K+");
    expect(source).toContain("K+ 不可用：");
    expect(source).toContain("droppedThirdStrike");
    expect(source).toContain("K+ 僅用於第三好球未接捕且可合法上一壘");
  });
});
