import React from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, {
  Rect,
  Path,
  Circle,
  Polygon,
  Line,
  Text as SvgText,
} from "react-native-svg";
import type { InterfacePalette } from "@/lib/theme-provider";
import {
  DIAMOND_FIELD_POSITIONS,
  isPositionSelected,
  type DiamondFieldPositionItem,
} from "@/lib/baseball/diamond-field-positions";

export {
  DIAMOND_FIELD_POSITIONS,
  isPositionSelected,
  type DiamondFieldPositionItem,
};

/**
 * 現場紀錄「壘包與跑壘紀錄」專用的向量棒球場內野背景圖示
 * 包含外野草皮、內野界外線、內野紅土菱形/跑道、內野草皮島、投手丘／投手板及各壘包（本壘、一壘、二壘、三壘）
 */
export function LiveInfieldDiamondBackground({
  style,
  themeMode = "dark",
}: {
  style?: object;
  themeMode?: "dark" | "light";
}) {
  const isDark = themeMode === "dark";
  const bgColor = isDark ? "#0B192C" : "#F1F5F9";
  return (
    <View style={[styles.liveFieldCanvas, isDark && styles.liveFieldCanvasDark, style]}>
      <Svg
        viewBox="0 0 400 250"
        preserveAspectRatio="xMidYMid meet"
        style={StyleSheet.absoluteFill}
      >
        <Rect x="0" y="0" width="400" height="250" fill={bgColor} />
        {/* 外野綠色草皮扇形 */}
        <Path
          d="M 200 210 L 30 35 A 240 240 0 0 1 370 35 Z"
          fill="#5D941E"
          stroke="#F5A623"
          strokeWidth={2}
          opacity={0.9}
        />
        {/* 內野橘黃色紅土走道 */}
        <Path
          d="M 200 210 L 70 75 A 180 180 0 0 1 330 75 Z"
          fill="#F5A623"
          opacity={0.95}
        />
        {/* 白色界外線 */}
        <Line x1="200" y1="210" x2="25" y2="30" stroke="#FFFFFF" strokeWidth={2.5} opacity={0.9} />
        <Line x1="200" y1="210" x2="375" y2="30" stroke="#FFFFFF" strokeWidth={2.5} opacity={0.9} />
        {/* 內野紅土菱形 */}
        <Polygon points="200,210 265,145 200,80 135,145" fill="#F5A623" />
        {/* 內野草地菱形島 */}
        <Polygon points="200,195 250,145 200,95 150,145" fill="#5D941E" />
        {/* 投手丘與投手板 */}
        <Circle cx="200" cy="145" r="14" fill="#D97706" stroke="#FFE699" strokeWidth={1} />
        <Rect x="194" y="143.5" width="12" height="3" rx="1" fill="#FFFFFF" />
        {/* 壘包 (2B, 1B, 3B, HP) */}
        <Polygon points="200,74 206,80 200,86 194,80" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth={1} />
        <Polygon points="265,139 271,145 265,151 259,145" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth={1} />
        <Polygon points="135,139 141,145 135,151 129,145" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth={1} />
        <Polygon points="200,203 207,210 200,217 193,210" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth={1} />
      </Svg>
    </View>
  );
}

interface DiamondFieldPositionPickerProps {
  selectedPositions: string[];
  onChange: (positions: string[]) => void;
  maxCount?: number;
  interfacePalette?: InterfacePalette;
  title?: string;
  hint?: string;
}

/**
 * 常用守備位置視覺化棒球場菱形圖元件
 * 完全比照「常用守備位置.jpg」繪製（包含深色背景、外野/內野紅土草皮、投手丘、壘包、[英文代號]+[中文守位]立體黑底標籤與點擊指派切換）
 */
export function DiamondFieldPositionPicker({
  selectedPositions = [],
  onChange,
  maxCount = 4,
  interfacePalette,
  title = "常用守備位置指派（點擊球場菱形圖）",
  hint = "最多可選擇 4 個常用守備位置，點擊位置圖示即可選取／取消",
}: DiamondFieldPositionPickerProps) {
  const currentPositions = Array.isArray(selectedPositions) ? selectedPositions : [];

  const handleToggle = (pos: DiamondFieldPositionItem) => {
    const selected = isPositionSelected(currentPositions, pos);
    if (selected) {
      // 移除此位置
      const next = currentPositions.filter((item) => {
        const s = String(item).trim();
        return !(
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
      onChange(next);
    } else {
      if (currentPositions.length >= maxCount) {
        Alert.alert(
          `最多可選 ${maxCount} 個常用守位`,
          `已達到最多 ${maxCount} 個常用守備位置上限。請先點擊取消已選位置後，再選擇新位置。`
        );
        return;
      }
      onChange([...currentPositions, pos.label]);
    }
  };

  const handleRemove = (posName: string) => {
    onChange(currentPositions.filter((p) => p !== posName));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <View style={styles.container}>
      {/* 標題與說明 */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, interfacePalette && { color: interfacePalette.foreground }]}>
          {title}
        </Text>
        <Text style={[styles.badge, interfacePalette && { backgroundColor: interfacePalette.surface, color: interfacePalette.primary }]}>
          {currentPositions.length}/{maxCount} 個
        </Text>
      </View>
      {hint ? (
        <Text style={[styles.hint, interfacePalette && { color: interfacePalette.muted }]}>
          {hint}
        </Text>
      ) : null}

      {/* 棒球場菱形圖（以 SVG 繪製維持固定長寬比，等比例不變形） */}
      <View style={styles.fieldCanvasContainer}>
        {/* SVG 球場向量繪製層：固定 viewBox 與 preserveAspectRatio */}
        <Svg
          viewBox="0 0 400 250"
          preserveAspectRatio="xMidYMid meet"
          style={StyleSheet.absoluteFill}
        >
          {/* 暗黑深藍波點科技球場底色 */}
          <Rect x="0" y="0" width="400" height="250" rx="10" fill="#061325" />

          {/* 外野綠色草皮扇形弧 */}
          <Path
            d="M 200 200 L 35 35 A 235 235 0 0 1 365 35 Z"
            fill="#5D941E"
            stroke="#F5A623"
            strokeWidth={2}
          />

          {/* 內野橘黃色紅土走道 (Dirt Track Arc) */}
          <Path
            d="M 200 200 L 75 75 A 175 175 0 0 1 325 75 Z"
            fill="#F5A623"
          />

          {/* 左/右白色界外線 (Foul Lines) */}
          <Line x1="200" y1="200" x2="30" y2="30" stroke="#FFFFFF" strokeWidth={2.5} />
          <Line x1="200" y1="200" x2="370" y2="30" stroke="#FFFFFF" strokeWidth={2.5} />

          {/* 內野紅土菱形 (Dirt Diamond) */}
          <Polygon
            points="200,200 260,140 200,80 140,140"
            fill="#F5A623"
          />

          {/* 內野草地菱形島 (Infield Grass Island) */}
          <Polygon
            points="200,186 246,140 200,94 154,140"
            fill="#5D941E"
          />

          {/* 投手丘與白色投手板 */}
          <Circle cx="200" cy="137.5" r="13" fill="#D97706" />
          <Rect x="194" y="136" width="12" height="3" rx="1" fill="#FFFFFF" />

          {/* 二壘包 (2B) */}
          <Polygon points="200,74 206,80 200,86 194,80" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth={1} />

          {/* 一壘包 (1B) */}
          <Polygon points="260,134 266,140 260,146 254,140" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth={1} />

          {/* 三壘包 (3B) */}
          <Polygon points="140,134 146,140 140,146 134,140" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth={1} />

          {/* 本壘板區紅土圓弧 (Home Plate Dirt Area) */}
          <Circle cx="200" cy="200" r="18" fill="#F5A623" stroke="#FFFFFF" strokeWidth={1.5} />

          {/* 本壘板 (Home Plate) - 精準置中於菱形尖端 (200, 200) */}
          <Polygon points="200,193 207,200 200,207 193,200" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth={0.5} />

          {/* 左下角「常用守備位置」金色浮水印標籤 */}
          <SvgText
            x="14"
            y="238"
            fill="#F5A623"
            fontSize="12"
            fontWeight="900"
            letterSpacing="1"
          >
            常用守備位置
          </SvgText>
        </Svg>

        {/* 9 個守備位置標籤（完全比照附圖：左側銀白代號 + 右側黑底中文名稱） */}
        {DIAMOND_FIELD_POSITIONS.map((pos) => {
          const selected = isPositionSelected(currentPositions, pos);
          return (
            <Pressable
              key={pos.number}
              accessibilityRole="button"
              accessibilityLabel={`${pos.displayCode}${selected ? "，已選取" : ""}`}
              onPress={() => handleToggle(pos)}
              style={({ pressed }) => [
                styles.positionBadge,
                { top: pos.top as any, left: pos.left as any },
                selected ? styles.positionBadgeSelected : styles.positionBadgeNormal,
                pressed && styles.positionBadgePressed,
              ]}
            >
              {/* 左側銀底代號區塊 (如 SS, 2B, CF...) */}
              <View
                style={[
                  styles.badgeCodeBox,
                  selected ? styles.badgeCodeBoxSelected : styles.badgeCodeBoxNormal,
                ]}
              >
                <Text
                  style={[
                    styles.badgeCodeText,
                    selected ? styles.badgeCodeTextSelected : styles.badgeCodeTextNormal,
                  ]}
                >
                  {pos.enCode}
                </Text>
              </View>

              {/* 右側黑底中文名稱區塊 (如 游擊手, 中外野...) */}
              <View
                style={[
                  styles.badgeLabelBox,
                  selected ? styles.badgeLabelBoxSelected : styles.badgeLabelBoxNormal,
                ]}
              >
                <Text
                  style={[
                    styles.badgeLabelText,
                    selected ? styles.badgeLabelTextSelected : styles.badgeLabelTextNormal,
                  ]}
                  numberOfLines={1}
                >
                  {pos.shortLabel}
                </Text>
                {selected ? <Text style={styles.badgeCheckmark}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* 已選標籤與快捷操作 */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryHeader}>
          <Text style={[styles.summaryTitle, interfacePalette && { color: interfacePalette.muted }]}>
            已選常用守位：
          </Text>
          {currentPositions.length > 0 ? (
            <Pressable onPress={handleClearAll} hitSlop={6} style={styles.clearButton}>
              <Text style={styles.clearButtonText}>清空守位</Text>
            </Pressable>
          ) : null}
        </View>

        {currentPositions.length > 0 ? (
          <View style={styles.chipList}>
            {currentPositions.map((posName, idx) => (
              <View key={`${posName}-${idx}`} style={styles.chip}>
                <Text style={styles.chipText}>{posName}</Text>
                <Pressable
                  onPress={() => handleRemove(posName)}
                  hitSlop={8}
                  style={styles.chipCloseBtn}
                  accessibilityLabel={`移除 ${posName}`}
                >
                  <Text style={styles.chipCloseText}>✕</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.emptyHint, interfacePalette && { color: interfacePalette.muted }]}>
            尚未選擇常用守位（預設為後備，可直接點選上方球場圖示指派）
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    marginTop: 2,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 11,
    fontWeight: "800",
    color: "#123A68",
  },
  badge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#1D5FA7",
    backgroundColor: "#EAF3FB",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  hint: {
    fontSize: 9.5,
    color: "#6B7280",
    marginTop: -2,
  },

  /* 常用守備位置.jpg 風格球場畫布 - 鎖定 16:10 長寬比與防擠壓 */
  fieldCanvasContainer: {
    width: "100%",
    maxWidth: 420,
    aspectRatio: 16 / 10,
    maxHeight: 260,
    alignSelf: "center",
    borderRadius: 10,
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E293B",
    backgroundColor: "#061325",
    marginVertical: 4,
    flexShrink: 0,
  },

  /* 守位標籤樣式 (比照 常用守備位置.jpg：左側銀白代號 + 右側黑底中文名稱) */
  positionBadge: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    height: 22,
    borderRadius: 4,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 2.5,
    elevation: 4,
    transform: [{ translateX: -38 }, { translateY: -11 }],
  },
  positionBadgeNormal: {
    borderWidth: 1,
    borderColor: "#334155",
    zIndex: 4,
  },
  positionBadgeSelected: {
    borderWidth: 1.5,
    borderColor: "#F5A623",
    shadowColor: "#F5A623",
    shadowOpacity: 0.8,
    shadowRadius: 4,
    zIndex: 12,
  },
  positionBadgePressed: {
    opacity: 0.8,
    transform: [{ translateX: -38 }, { translateY: -11 }, { scale: 0.94 }],
  },
  badgeCodeBox: {
    paddingHorizontal: 5,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
  },
  badgeCodeBoxNormal: {
    backgroundColor: "#E2E8F0",
    borderRightColor: "#475569",
  },
  badgeCodeBoxSelected: {
    backgroundColor: "#FDE68A",
    borderRightColor: "#F5A623",
  },
  badgeCodeText: {
    fontSize: 9.5,
    fontWeight: "900",
    fontStyle: "italic",
  },
  badgeCodeTextNormal: {
    color: "#0F172A",
  },
  badgeCodeTextSelected: {
    color: "#78350F",
  },
  badgeLabelBox: {
    paddingHorizontal: 6,
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 42,
  },
  badgeLabelBoxNormal: {
    backgroundColor: "#0F172A",
  },
  badgeLabelBoxSelected: {
    backgroundColor: "#1E3A8A",
  },
  badgeLabelText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  badgeLabelTextNormal: {
    color: "#FFFFFF",
  },
  badgeLabelTextSelected: {
    color: "#FEF08A",
  },
  badgeCheckmark: {
    fontSize: 8.5,
    fontWeight: "900",
    color: "#F5A623",
    marginLeft: 3,
  },

  /* 底部選取摘要 */
  summaryContainer: {
    gap: 3,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#6B7280",
  },
  clearButton: {
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  clearButtonText: {
    fontSize: 10,
    color: "#DC2626",
    fontWeight: "700",
  },
  chipList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EAF3FB",
    borderColor: "#1D5FA7",
    borderWidth: 0.8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  chipText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#123A68",
  },
  chipCloseBtn: {
    padding: 1,
  },
  chipCloseText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#6B7280",
  },
  emptyHint: {
    fontSize: 10,
    color: "#9CA3AF",
    fontStyle: "italic",
  },

  /* 現場紀錄 LiveInfieldDiamondBackground 樣式 */
  liveFieldCanvas: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
  },
  liveFieldCanvasDark: {
    backgroundColor: "#0B192C",
  },
});
