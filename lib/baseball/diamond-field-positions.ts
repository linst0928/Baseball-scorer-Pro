export type DiamondFieldPositionItem = {
  number: string;
  enCode: string;
  label: string;
  shortLabel: string;
  displayCode: string;
  top: string;
  left: string;
  aliases: string[];
};

export const DIAMOND_FIELD_POSITIONS: DiamondFieldPositionItem[] = [
  {
    number: "8",
    enCode: "CF",
    label: "中外野手",
    shortLabel: "中外野",
    displayCode: "CF 中外野",
    top: "10%",
    left: "50%",
    aliases: ["8", "中外野手", "中外野", "中外", "8 中外", "CF"],
  },
  {
    number: "7",
    enCode: "LF",
    label: "左外野手",
    shortLabel: "左外野",
    displayCode: "LF 左外野",
    top: "22%",
    left: "17%",
    aliases: ["7", "左外野手", "左外野", "左外", "7 左外", "LF"],
  },
  {
    number: "9",
    enCode: "RF",
    label: "右外野手",
    shortLabel: "右外野",
    displayCode: "RF 右外野",
    top: "22%",
    left: "83%",
    aliases: ["9", "右外野手", "右外野", "右外", "9 右外", "RF"],
  },
  {
    number: "6",
    enCode: "SS",
    label: "游擊手",
    shortLabel: "游擊手",
    displayCode: "SS 游擊手",
    top: "37%",
    left: "34%",
    aliases: ["6", "游擊手", "游擊", "6 游擊", "SS"],
  },
  {
    number: "4",
    enCode: "2B",
    label: "二壘手",
    shortLabel: "二壘手",
    displayCode: "2B 二壘手",
    top: "37%",
    left: "66%",
    aliases: ["4", "二壘手", "二壘", "4 二壘", "2B"],
  },
  {
    number: "5",
    enCode: "3B",
    label: "三壘手",
    shortLabel: "三壘手",
    displayCode: "3B 三壘手",
    top: "55%",
    left: "17%",
    aliases: ["5", "三壘手", "三壘", "5 三壘", "3B"],
  },
  {
    number: "3",
    enCode: "1B",
    label: "一壘手",
    shortLabel: "一壘手",
    displayCode: "1B 一壘手",
    top: "55%",
    left: "83%",
    aliases: ["3", "一壘手", "一壘", "3 一壘", "1B"],
  },
  {
    number: "1",
    enCode: "P",
    label: "投手",
    shortLabel: "投手",
    displayCode: "P 投手",
    top: "55%",
    left: "50%",
    aliases: ["1", "投手", "投", "1 投手", "P"],
  },
  {
    number: "2",
    enCode: "C",
    label: "捕手",
    shortLabel: "捕手",
    displayCode: "C 捕手",
    top: "84%",
    left: "50%",
    aliases: ["2", "捕手", "捕", "2 捕手", "C"],
  },
];

export const POSITION_SHORT_NAMES: Record<string, string> = {
  "1": "投", "P": "投", "投手": "投", "投": "投",
  "2": "捕", "C": "捕", "捕手": "捕", "捕": "捕",
  "3": "一壘", "1B": "一壘", "一壘手": "一壘",
  "4": "二壘", "2B": "二壘", "二壘手": "二壘",
  "5": "三壘", "3B": "三壘", "三壘手": "三壘",
  "6": "游擊", "SS": "游擊", "游擊手": "游擊",
  "7": "左外", "LF": "左外", "左外野": "左外", "左外野手": "左外",
  "8": "中外", "CF": "中外", "中外野": "中外", "中外野手": "中外",
  "9": "右外", "RF": "右外", "右外野": "右外", "右外野手": "右外",
};

export function formatPositionShortName(pos: string): string {
  if (!pos) return "";
  const trimmed = String(pos).trim();
  if (POSITION_SHORT_NAMES[trimmed]) return POSITION_SHORT_NAMES[trimmed];
  for (const item of DIAMOND_FIELD_POSITIONS) {
    if (
      trimmed === item.number ||
      trimmed === item.enCode ||
      trimmed.toUpperCase() === item.enCode.toUpperCase() ||
      trimmed === item.label ||
      trimmed === item.shortLabel ||
      item.aliases.includes(trimmed)
    ) {
      if (item.number === "1") return "投";
      if (item.number === "2") return "捕";
      return item.shortLabel.replace(/野手$/, "").replace(/手$/, "");
    }
  }
  return trimmed;
}

export function formatPreferredPositionsShort(positions: string[] | undefined): string {
  if (!positions || !Array.isArray(positions) || positions.length === 0) {
    return "後備";
  }
  const shorts = positions
    .map((p) => formatPositionShortName(p))
    .filter(Boolean)
    .slice(0, 4);
  return shorts.length > 0 ? shorts.join("、") : "後備";
}

export function isPositionSelected(
  selectedPositions: string[] | undefined,
  pos: DiamondFieldPositionItem
): boolean {
  if (!selectedPositions || !Array.isArray(selectedPositions) || selectedPositions.length === 0) {
    return false;
  }
  return selectedPositions.some((item) => {
    const s = String(item).trim();
    if (!s) return false;
    return (
      s === pos.number ||
      s === pos.enCode ||
      s.toUpperCase() === pos.enCode.toUpperCase() ||
      s === pos.label ||
      s === pos.shortLabel ||
      s === pos.displayCode ||
      pos.aliases.includes(s) ||
      s.includes(pos.shortLabel) ||
      s.includes(pos.label) ||
      s.startsWith(pos.number)
    );
  });
}
