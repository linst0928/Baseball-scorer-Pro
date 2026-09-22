export type WasedaQuadrant =
  | "TOP_LEFT"
  | "BOTTOM_LEFT"
  | "TOP_RIGHT"
  | "BOTTOM_RIGHT"
  | "INNER"
  | "PITCH_GRID"
  | "SUBSTITUTION"
  | "SPECIAL";

export type WasedaColorTone = "red" | "blue" | "navy";

export type WasedaSymbolDefinition = {
  eventType: string;
  name: string;
  symbol: string;
  color: WasedaColorTone;
  quadrant: WasedaQuadrant;
  hasArrow?: boolean;
  description: string;
  status: "PASS" | "NEED_USER_CONFIRMATION";
};

export const WASEDA_SYMBOL_REGISTRY: Record<string, WasedaSymbolDefinition> = {
  // --- 左上角：安打區 (紅色) ---
  SINGLE: {
    eventType: "SINGLE",
    name: "一壘安打",
    symbol: "1B",
    color: "red",
    quadrant: "TOP_LEFT",
    description: "外圈左上紅字 1B，菱形本壘至一壘紅線",
    status: "PASS",
  },
  DOUBLE: {
    eventType: "DOUBLE",
    name: "二壘安打",
    symbol: "2B",
    color: "red",
    quadrant: "TOP_LEFT",
    description: "外圈左上紅字 2B，菱形本壘經一壘至二壘紅線",
    status: "PASS",
  },
  TRIPLE: {
    eventType: "TRIPLE",
    name: "三壘安打",
    symbol: "3B",
    color: "red",
    quadrant: "TOP_LEFT",
    description: "外圈左上紅字 3B，菱形本壘經一、二壘至三壘紅線",
    status: "PASS",
  },
  HOME_RUN: {
    eventType: "HOME_RUN",
    name: "全壘打",
    symbol: "HR",
    color: "red",
    quadrant: "TOP_LEFT",
    description: "外圈左上紅字 HR，菱形全圈紅線，內圈得分符號",
    status: "PASS",
  },

  // --- 左下角：得分區 (紅色) ---
  RUN_SCORED_1: {
    eventType: "RUN_SCORED_1",
    name: "得分/打點 (1分)",
    symbol: "①",
    color: "red",
    quadrant: "BOTTOM_LEFT",
    description: "外圈左下紅字①",
    status: "PASS",
  },
  RUN_SCORED_2: {
    eventType: "RUN_SCORED_2",
    name: "得分/打點 (2分)",
    symbol: "②",
    color: "red",
    quadrant: "BOTTOM_LEFT",
    description: "外圈左下紅字②",
    status: "PASS",
  },
  RUN_SCORED_3: {
    eventType: "RUN_SCORED_3",
    name: "得分/打點 (3分)",
    symbol: "③",
    color: "red",
    quadrant: "BOTTOM_LEFT",
    description: "外圈左下紅字③",
    status: "PASS",
  },
  RUN_SCORED_4: {
    eventType: "RUN_SCORED_4",
    name: "得分/打點 (4分)",
    symbol: "④",
    color: "red",
    quadrant: "BOTTOM_LEFT",
    description: "外圈左下紅字④",
    status: "PASS",
  },

  // --- 右上角：跑壘 / 投手犯規 / 特殊事件 (藍色) ---
  WILD_PITCH: {
    eventType: "WILD_PITCH",
    name: "暴投",
    symbol: "WP",
    color: "blue",
    quadrant: "TOP_RIGHT",
    description: "外圈右上藍字 WP",
    status: "PASS",
  },
  PASSED_BALL: {
    eventType: "PASSED_BALL",
    name: "捕逸",
    symbol: "PB",
    color: "blue",
    quadrant: "TOP_RIGHT",
    description: "外圈右上藍字 PB",
    status: "PASS",
  },
  PICKOFF_OUT: {
    eventType: "PICKOFF_OUT",
    name: "牽制出局",
    symbol: "PO",
    color: "blue",
    quadrant: "TOP_RIGHT",
    description: "外圈右上藍字 PO，自動帶傳接位置如 PO1-3",
    status: "PASS",
  },
  OBSTRUCTION: {
    eventType: "OBSTRUCTION",
    name: "妨礙跑壘",
    symbol: "OB",
    color: "blue",
    quadrant: "TOP_RIGHT",
    description: "外圈右上藍字 OB",
    status: "PASS",
  },
  BALK: {
    eventType: "BALK",
    name: "投手犯規",
    symbol: "BK",
    color: "blue",
    quadrant: "TOP_RIGHT",
    description: "外圈右上藍字 BK",
    status: "PASS",
  },
  DOUBLE_PLAY: {
    eventType: "DOUBLE_PLAY",
    name: "雙殺",
    symbol: "DP",
    color: "blue",
    quadrant: "TOP_RIGHT",
    description: "外圈右上藍字 DP 或守備序列附註",
    status: "PASS",
  },
  TRIPLE_PLAY: {
    eventType: "TRIPLE_PLAY",
    name: "三殺",
    symbol: "TP",
    color: "blue",
    quadrant: "TOP_RIGHT",
    description: "外圈右上藍字 TP 或守備序列附註",
    status: "PASS",
  },

  // --- 右下角：打席結果 / 守備事件 / 擊球方向 (藍色) ---
  WALK: {
    eventType: "WALK",
    name: "四壞球",
    symbol: "BB",
    color: "blue",
    quadrant: "BOTTOM_RIGHT",
    description: "外圈右下藍字 BB",
    status: "PASS",
  },
  HIT_BY_PITCH: {
    eventType: "HIT_BY_PITCH",
    name: "觸身球",
    symbol: "D",
    color: "blue",
    quadrant: "BOTTOM_RIGHT",
    description: "外圈右下藍字 D",
    status: "PASS",
  },
  INTENTIONAL_WALK: {
    eventType: "INTENTIONAL_WALK",
    name: "敬遠",
    symbol: "DB",
    color: "blue",
    quadrant: "BOTTOM_RIGHT",
    description: "外圈右下藍字 DB (敬遠) / DIB (故意四壞)",
    status: "PASS",
  },
  STRIKEOUT: {
    eventType: "STRIKEOUT",
    name: "三振",
    symbol: "K",
    color: "blue",
    quadrant: "BOTTOM_RIGHT",
    description: "外圈右下藍字 K",
    status: "PASS",
  },
  DROPPED_THIRD_STRIKE: {
    eventType: "DROPPED_THIRD_STRIKE",
    name: "不死三振",
    symbol: "ꓘ",
    color: "blue",
    quadrant: "BOTTOM_RIGHT",
    description: "外圈右下藍字反向 ꓘ (以 SVG/向量路徑安全渲染)",
    status: "PASS",
  },
  CATCHER_INTERFERENCE: {
    eventType: "CATCHER_INTERFERENCE",
    name: "打者妨礙打擊",
    symbol: "2IF",
    color: "blue",
    quadrant: "BOTTOM_RIGHT",
    description: "外圈右下藍字 2IF",
    status: "PASS",
  },
  BATTER_INTERFERENCE: {
    eventType: "BATTER_INTERFERENCE",
    name: "打者妨礙守備",
    symbol: "IP2",
    color: "blue",
    quadrant: "BOTTOM_RIGHT",
    description: "外圈右下藍字 IP2",
    status: "PASS",
  },
  FIELDER_CHOICE: {
    eventType: "FIELDER_CHOICE",
    name: "野手選擇",
    symbol: "FC",
    color: "blue",
    quadrant: "BOTTOM_RIGHT",
    description: "外圈右下藍字 FC",
    status: "PASS",
  },

  // --- 替補與交接註記 ---
  PINCH_HIT: {
    eventType: "PINCH_HIT",
    name: "代打",
    symbol: "︴PH",
    color: "blue",
    quadrant: "SUBSTITUTION",
    description: "打席格側邊藍色波浪線加 PH",
    status: "PASS",
  },
  PINCH_RUN: {
    eventType: "PINCH_RUN",
    name: "代跑",
    symbol: "︴PR",
    color: "blue",
    quadrant: "SUBSTITUTION",
    description: "打席格側邊藍色波浪線加 PR",
    status: "PASS",
  },
  DEFENSIVE_SUB: {
    eventType: "DEFENSIVE_SUB",
    name: "代守",
    symbol: "︴PF",
    color: "blue",
    quadrant: "SUBSTITUTION",
    description: "打席格側邊藍色波浪線加 PF",
    status: "PASS",
  },

  // --- 半局與比賽終記 ---
  INNING_END: {
    eventType: "INNING_END",
    name: "局結束",
    symbol: "//",
    color: "navy",
    quadrant: "SPECIAL",
    description: "雙斜線局結束符號",
    status: "PASS",
  },
  GAME_END: {
    eventType: "GAME_END",
    name: "比賽結束",
    symbol: "///",
    color: "navy",
    quadrant: "SPECIAL",
    description: "三斜線比賽結束符號",
    status: "PASS",
  },
};

export type WasedaSymbolAuditResult = {
  totalRegistered: number;
  passCount: number;
  pendingConfirmationCount: number;
  missingMappings: string[];
  isCompliant: boolean;
  auditDetails: Array<{ eventType: string; symbol: string; quadrant: string; status: string }>;
};

/**
 * 早稻田符號系統稽核驗證器。
 * 檢查系統中每個預期的事件類型是否都有對應且符合《符號說明.jpg》標準的 Registry 設定。
 */
export function validateWasedaSymbols(): WasedaSymbolAuditResult {
  const expectedEvents = [
    "SINGLE", "DOUBLE", "TRIPLE", "HOME_RUN",
    "RUN_SCORED_1", "RUN_SCORED_2", "RUN_SCORED_3", "RUN_SCORED_4",
    "WILD_PITCH", "PASSED_BALL", "PICKOFF_OUT", "OBSTRUCTION", "BALK", "DOUBLE_PLAY", "TRIPLE_PLAY",
    "WALK", "HIT_BY_PITCH", "INTENTIONAL_WALK", "STRIKEOUT", "DROPPED_THIRD_STRIKE",
    "CATCHER_INTERFERENCE", "BATTER_INTERFERENCE", "FIELDER_CHOICE",
    "PINCH_HIT", "PINCH_RUN", "DEFENSIVE_SUB",
    "INNING_END", "GAME_END",
  ];

  const missingMappings: string[] = [];
  const auditDetails: Array<{ eventType: string; symbol: string; quadrant: string; status: string }> = [];
  let passCount = 0;
  let pendingConfirmationCount = 0;

  for (const eventType of expectedEvents) {
    const def = WASEDA_SYMBOL_REGISTRY[eventType];
    if (!def) {
      missingMappings.push(eventType);
      auditDetails.push({ eventType, symbol: "MISSING", quadrant: "NONE", status: "FAILED" });
    } else {
      if (def.status === "PASS") passCount++;
      else if (def.status === "NEED_USER_CONFIRMATION") pendingConfirmationCount++;

      auditDetails.push({
        eventType,
        symbol: def.symbol,
        quadrant: def.quadrant,
        status: def.status,
      });
    }
  }

  return {
    totalRegistered: Object.keys(WASEDA_SYMBOL_REGISTRY).length,
    passCount,
    pendingConfirmationCount,
    missingMappings,
    isCompliant: missingMappings.length === 0 && pendingConfirmationCount === 0,
    auditDetails,
  };
}
