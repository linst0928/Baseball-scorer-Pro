import { describe, expect, it } from "vitest";

import { getFieldingNotationDisplay } from "../lib/baseball/fielding-notation-display";

describe("手機版傳接序列顯示", () => {
  it("雙殺序列優先在傳接符號後換行，避免單行超出窄寬傳接區", () => {
    const display = getFieldingNotationDisplay("6ー4ー3 DP", 4, 3);

    expect(display.lines).toEqual(["6ー4ー", "3 DP"]);
    expect(display.text).toBe("6ー4ー\n3 DP");
    expect(display.wasTruncated).toBe(false);
  });

  it("三殺極長傳接序列以省略號保護緊湊打席格，放大檢視仍保留完整字串", () => {
    const notation = "5ー4ー3 TP・E6→3→2";
    const display = getFieldingNotationDisplay(notation, 6, 2);

    expect(display.wasTruncated).toBe(true);
    expect(display.fullText).toBe(notation);
    expect(display.lines).toHaveLength(2);
    expect(display.lines.every((line) => Array.from(line).length <= 6)).toBe(true);
    expect(display.text.endsWith("…")).toBe(true);
  });

  it("多重失誤傳接組合在傳球、事件與跑者移動記號後分段，沒有任何顯示行超出限制", () => {
    const notation = "6ー4ー3 DP・E6→3→2・E3／5ー4";
    const display = getFieldingNotationDisplay(notation, 7, 5);

    expect(display.fullText).toBe(notation);
    expect(display.lines.every((line) => Array.from(line).length <= 7)).toBe(true);
    expect(display.text).toContain("\n");
  });
});
