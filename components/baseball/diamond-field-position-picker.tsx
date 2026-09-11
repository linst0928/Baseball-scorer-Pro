import React from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  return (
    <View style={[styles.liveFieldCanvas, isDark && styles.liveFieldCanvasDark, style]}>
      {/* 暗色/深藍背景底層 */}
      <View style={[styles.fieldBgOverlay, isDark && styles.fieldBgOverlayDark]} />

      {/* 外野草皮扇形弧 */}
      <View style={styles.liveOutfieldArc} />

      {/* 內野橘黃色紅土走道 (Dirt Track Arc) */}
      <View style={styles.liveDirtArc} />

      {/* 左/右白色界外線 (Foul Lines) */}
      <View style={styles.liveLeftFoulLine} />
      <View style={styles.liveRightFoulLine} />

      {/* 內野紅土菱形 (Dirt Diamond) */}
      <View style={styles.liveDirtDiamond} />

      {/* 內野草地菱形島 (Infield Grass Island) */}
      <View style={styles.liveInfieldGrass} />

      {/* 投手丘與白色投手板 */}
      <View style={styles.livePitcherMound}>
        <View style={styles.livePitcherRubber} />
      </View>

      {/* 四個壘包 (2B, 1B, 3B, HP) */}
      <View style={styles.liveBase2B} />
      <View style={styles.liveBase1B} />
      <View style={styles.liveBase3B} />
      <View style={styles.liveHomePlate} />
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

      {/* 棒球場菱形圖（比照 常用守備位置.jpg 繪製） */}
      <View style={styles.fieldCanvasContainer}>
        {/* 暗黑深藍波點科技球場底色 */}
        <View style={styles.fieldDarkBackground} />

        {/* 外野綠色草皮 */}
        <View style={styles.outfieldArc} />

        {/* 內野橘黃色紅土走道 (Dirt Arc) */}
        <View style={styles.dirtArc} />

        {/* 左/右白色界外線 (Foul Lines) */}
        <View style={styles.leftFoulLine} />
        <View style={styles.rightFoulLine} />

        {/* 內野紅土菱形 (Dirt Diamond) */}
        <View style={styles.dirtDiamond} />

        {/* 內野草地菱形島 (Infield Grass Island) */}
        <View style={styles.infieldGrass} />

        {/* 投手丘與白色投手板 */}
        <View style={styles.pitcherMound}>
          <View style={styles.pitcherRubber} />
        </View>

        {/* 二壘包 */}
        <View style={styles.base2B} />

        {/* 本壘板區 */}
        <View style={styles.homePlateArea} />
        <View style={styles.homePlate} />

        {/* 左下角「常用守備位置」金色浮水印標籤 */}
        <View style={styles.watermarkContainer}>
          <Text style={styles.watermarkText}>常用守備位置</Text>
        </View>

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

  /* 常用守備位置.jpg 風格球場畫布 */
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
  },
  fieldDarkBackground: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#061325",
  },
  outfieldArc: {
    position: "absolute",
    left: "6%",
    right: "6%",
    top: "3%",
    height: 165,
    borderTopLeftRadius: 160,
    borderTopRightRadius: 160,
    backgroundColor: "#5D941E",
    borderWidth: 2,
    borderColor: "#F5A623",
  },
  dirtArc: {
    position: "absolute",
    left: "14%",
    right: "14%",
    top: "22%",
    height: 130,
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    backgroundColor: "#F5A623",
  },
  leftFoulLine: {
    position: "absolute",
    width: 2.5,
    height: 180,
    left: "50%",
    bottom: 22,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "#FFFFFF",
    shadowColor: "#FFF",
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  rightFoulLine: {
    position: "absolute",
    width: 2.5,
    height: 180,
    left: "50%",
    bottom: 22,
    transform: [{ rotate: "-45deg" }],
    backgroundColor: "#FFFFFF",
    shadowColor: "#FFF",
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  dirtDiamond: {
    position: "absolute",
    width: 80,
    height: 80,
    left: "50%",
    top: 75,
    marginLeft: -40,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "#F5A623",
    borderRadius: 4,
  },
  infieldGrass: {
    position: "absolute",
    width: 52,
    height: 52,
    left: "50%",
    top: 89,
    marginLeft: -26,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "#5D941E",
    borderRadius: 2,
  },
  pitcherMound: {
    position: "absolute",
    width: 24,
    height: 14,
    left: "50%",
    top: 108,
    marginLeft: -12,
    borderRadius: 7,
    backgroundColor: "#D97706",
    alignItems: "center",
    justifyContent: "center",
  },
  pitcherRubber: {
    width: 8,
    height: 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 1,
  },
  base2B: {
    position: "absolute",
    width: 8,
    height: 8,
    left: "50%",
    top: 71,
    marginLeft: -4,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 1,
  },
  homePlateArea: {
    position: "absolute",
    width: 40,
    height: 24,
    left: "50%",
    bottom: 12,
    marginLeft: -20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#F5A623",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  homePlate: {
    position: "absolute",
    width: 7,
    height: 7,
    left: "50%",
    bottom: 24,
    marginLeft: -3.5,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "#FFFFFF",
  },
  watermarkContainer: {
    position: "absolute",
    left: 8,
    bottom: 6,
  },
  watermarkText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#F5A623",
    letterSpacing: 1,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
  fieldBgOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "transparent",
  },
  fieldBgOverlayDark: {
    backgroundColor: "#0B192C",
  },
  liveOutfieldArc: {
    position: "absolute",
    left: "5%",
    right: "5%",
    top: "4%",
    height: "90%",
    borderTopLeftRadius: 180,
    borderTopRightRadius: 180,
    backgroundColor: "#5D941E",
    borderWidth: 2,
    borderColor: "#F5A623",
    opacity: 0.9,
  },
  liveDirtArc: {
    position: "absolute",
    left: "14%",
    right: "14%",
    top: "22%",
    height: "72%",
    borderTopLeftRadius: 130,
    borderTopRightRadius: 130,
    backgroundColor: "#F5A623",
    opacity: 0.95,
  },
  liveLeftFoulLine: {
    position: "absolute",
    width: 2.5,
    height: 240,
    left: "50%",
    bottom: 24,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "#FFFFFF",
    opacity: 0.9,
  },
  liveRightFoulLine: {
    position: "absolute",
    width: 2.5,
    height: 240,
    left: "50%",
    bottom: 24,
    transform: [{ rotate: "-45deg" }],
    backgroundColor: "#FFFFFF",
    opacity: 0.9,
  },
  liveDirtDiamond: {
    position: "absolute",
    width: 100,
    height: 100,
    left: "50%",
    top: "34%",
    marginLeft: -50,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "#F5A623",
    borderRadius: 6,
  },
  liveInfieldGrass: {
    position: "absolute",
    width: 66,
    height: 66,
    left: "50%",
    top: "40%",
    marginLeft: -33,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "#5D941E",
    borderRadius: 3,
  },
  livePitcherMound: {
    position: "absolute",
    width: 32,
    height: 20,
    left: "50%",
    top: "48%",
    marginLeft: -16,
    borderRadius: 10,
    backgroundColor: "#D97706",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FFE699",
  },
  livePitcherRubber: {
    width: 10,
    height: 2.5,
    backgroundColor: "#FFFFFF",
    borderRadius: 1,
  },
  liveBase2B: {
    position: "absolute",
    width: 12,
    height: 12,
    left: "50%",
    top: "22%",
    marginLeft: -6,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  liveBase1B: {
    position: "absolute",
    width: 12,
    height: 12,
    right: "17%",
    top: "48%",
    marginTop: -6,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  liveBase3B: {
    position: "absolute",
    width: 12,
    height: 12,
    left: "17%",
    top: "48%",
    marginTop: -6,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  liveHomePlate: {
    position: "absolute",
    width: 12,
    height: 12,
    left: "50%",
    bottom: 24,
    marginLeft: -6,
    transform: [{ rotate: "45deg" }],
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
});
