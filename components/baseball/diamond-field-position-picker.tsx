import React from "react";
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from "react-native";
import type { InterfacePalette } from "@/lib/theme-provider";
import {
  DIAMOND_FIELD_POSITIONS,
  isPositionSelected,
  type DiamondFieldPositionItem,
} from "@/lib/baseball/diamond-field-positions";
import {
  COMMON_DEFENSE_BLANK_FIELD_IMAGE,
  LIVE_INFIELD_BLANK_FIELD_IMAGE,
} from "@/constants/baseball-assets";

export {
  DIAMOND_FIELD_POSITIONS,
  isPositionSelected,
  type DiamondFieldPositionItem,
};

/**
 * 現場紀錄「壘包與跑壘紀錄」專用的棒球場內野背景圖 (B1 區塊：僅內野 Infield Only)
 * 使用 內野守備位置(空白).jpg，保持 5:3 長寬比防變形
 */
export function LiveInfieldDiamondBackground({
  style,
  themeMode = "dark",
  imageSource,
}: {
  style?: object;
  themeMode?: "dark" | "light";
  imageSource?: ImageSourcePropType;
}) {
  const isDark = themeMode === "dark";
  return (
    <View style={[styles.liveFieldCanvas, isDark && styles.liveFieldCanvasDark, style]}>
      <Image
        source={imageSource || LIVE_INFIELD_BLANK_FIELD_IMAGE}
        style={styles.backgroundImage}
        resizeMode="contain"
      />
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
  /** 可選的球場背景圖；未提供時預設使用 常用守備位置(空白).jpg。 */
  fieldImageSource?: ImageSourcePropType;
}

/**
 * 常用守備位置視覺化棒球場菱形圖元件
 * 完全比照「常用守備位置(空白).jpg」繪製（包含深色背景、外野/內野紅土草皮、投手丘、壘包、[英文代號]+[中文守位]立體黑底標籤與點擊指派切換）
 */
export function DiamondFieldPositionPicker({
  selectedPositions = [],
  onChange,
  maxCount = 4,
  interfacePalette,
  title = "常用守備位置指派（點擊球場菱形圖）",
  hint = "最多可選擇 4 個常用守備位置，點擊位置圖示即可選取／取消",
  fieldImageSource,
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

      {/* 棒球場菱形圖：採用「內外野守備位置(空白).jpg」全場示意圖 */}
      <View style={styles.fieldCanvasContainer}>
        <Image
          source={fieldImageSource || COMMON_DEFENSE_BLANK_FIELD_IMAGE}
          style={styles.backgroundImage}
          resizeMode="contain"
        />

        {/* 9 個守備位置標籤（左側銀白代號 + 右側黑底中文名稱） */}
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

  /* 內外野守備位置(空白).jpg 風格球場畫布 - 鎖定 6:3 (2:1) 長寬比防變形 */
  fieldCanvasContainer: {
    width: "100%",
    maxWidth: 520,
    aspectRatio: 6 / 3,
    alignSelf: "center",
    borderRadius: 10,
    position: "relative",
    overflow: "visible",
    borderWidth: 1,
    borderColor: "#1E293B",
    backgroundColor: "#061325",
    marginVertical: 4,
    flexShrink: 0,
  },

  backgroundImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  },

  /* 守位標籤樣式 (左側銀白代號 + 右側黑底中文名稱) */
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

  /* 現場紀錄 LiveInfieldDiamondBackground 樣式 (5:3 長寬比) */
  liveFieldCanvas: {
    position: "relative",
    width: "100%",
    aspectRatio: 5 / 3,
    overflow: "visible",
    backgroundColor: "#0B192C",
    borderRadius: 10,
  },
  liveFieldCanvasDark: {
    backgroundColor: "#0B192C",
  },
});
