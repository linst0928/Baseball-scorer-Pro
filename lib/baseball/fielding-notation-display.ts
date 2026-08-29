export type FieldingNotationDisplay = {
  /** 適合緊湊打席格的可見行。 */
  lines: string[];
  /** 可直接交給 Text 的換行字串。 */
  text: string;
  /** 是否因打席格空間不足而改以省略號提示使用者點擊放大。 */
  wasTruncated: boolean;
  /** 未截斷、用於放大檢視的完整傳接序列。 */
  fullText: string;
};

const SOFT_BREAK_CHARACTERS = new Set(["ー", "・", "／", "/", "→", "、", ",", "，"]);

function normaliseNotation(notation: string) {
  return notation.trim().replace(/\s+/gu, " ");
}

/**
 * 將早稻田傳接序列優先切在傳球、事件與跑者移動符號之後；
 * 若單一片段仍太長，再以字元為單位硬切，避免窄寬打席格溢出。
 */
function getNotationChunks(notation: string) {
  const chunks: string[] = [];
  let chunk = "";

  for (const character of Array.from(notation)) {
    chunk += character;
    if (SOFT_BREAK_CHARACTERS.has(character)) {
      chunks.push(chunk);
      chunk = "";
    }
  }

  if (chunk) chunks.push(chunk);
  return chunks.filter(Boolean);
}

function withEllipsis(line: string, maxCharacters: number) {
  const allowedCharacters = Math.max(1, maxCharacters - 1);
  return `${Array.from(line.trim()).slice(0, allowedCharacters).join("")}…`;
}

export function getFieldingNotationDisplay(notation: string, maxCharacters: number, maxLines: number): FieldingNotationDisplay {
  const fullText = normaliseNotation(notation);
  if (!fullText) return { lines: [], text: "", wasTruncated: false, fullText };

  const safeMaxCharacters = Math.max(3, Math.floor(maxCharacters));
  const safeMaxLines = Math.max(1, Math.floor(maxLines));
  const lines: string[] = [];
  let currentLine = "";

  const commitLine = () => {
    const trimmed = currentLine.trim();
    if (trimmed) lines.push(trimmed);
    currentLine = "";
  };

  for (const rawChunk of getNotationChunks(fullText)) {
    let remaining = rawChunk;

    while (remaining) {
      const chunkCharacters = Array.from(remaining);
      const currentLength = Array.from(currentLine).length;
      const available = safeMaxCharacters - currentLength;

      if (currentLine && chunkCharacters.length > available) {
        commitLine();
        continue;
      }

      if (!currentLine && chunkCharacters.length > safeMaxCharacters) {
        lines.push(chunkCharacters.slice(0, safeMaxCharacters).join("").trim());
        remaining = chunkCharacters.slice(safeMaxCharacters).join("");
        continue;
      }

      currentLine += remaining;
      remaining = "";
    }
  }
  commitLine();

  const wasTruncated = lines.length > safeMaxLines;
  const visibleLines = wasTruncated
    ? [...lines.slice(0, safeMaxLines - 1), withEllipsis(lines[safeMaxLines - 1] ?? "", safeMaxCharacters)]
    : lines;

  return {
    lines: visibleLines,
    text: visibleLines.join("\n"),
    wasTruncated,
    fullText,
  };
}
