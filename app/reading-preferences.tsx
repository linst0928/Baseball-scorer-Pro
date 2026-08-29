import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import {
  FIELDING_NOTATION_FONT_SIZE_MAX,
  FIELDING_NOTATION_FONT_SIZE_MIN,
  getFieldingNotationFontMetrics,
  normalizeFieldingNotationFontSize,
} from "@/lib/baseball/fielding-notation-font-scale";
import { useFieldingNotationPreferences } from "@/lib/fielding-notation-preferences";

const SAMPLE_NOTATION = "6－4－3 DP・E6・E3・6－3";

export default function ReadingPreferencesScreen() {
  const router = useRouter();
  const { fontSize, isReady, setFontSize } = useFieldingNotationPreferences();
  const [draftFontSize, setDraftFontSize] = useState(fontSize);

  useEffect(() => {
    setDraftFontSize(fontSize);
  }, [fontSize]);

  const metrics = useMemo(() => getFieldingNotationFontMetrics(draftFontSize), [draftFontSize]);
  const valueLabel = `${draftFontSize} pt`;

  return (
    <ScreenContainer className="flex-1" edges={["top", "bottom", "left", "right"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>設定中心</Text>
          <Text style={styles.title}>閱讀偏好</Text>
          <Text style={styles.subtitle}>調整傳接序列的閱讀方式；所有偏好僅保存於此裝置。</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="返回軟體設定" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text style={styles.backButtonText}>返回</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeading}>
            <View>
              <Text style={styles.cardTitle}>傳接序列字級</Text>
              <Text style={styles.cardHint}>拖曳滑桿可逐點微調；放開後立即保存並同步至放大檢視。</Text>
            </View>
            <View accessibilityLabel={`目前文字大小 ${valueLabel}`} style={styles.valueBadge}>
              <Text style={styles.valueBadgeText}>{valueLabel}</Text>
            </View>
          </View>
          <Slider
            accessibilityLabel="傳接序列文字大小滑桿"
            accessibilityHint={`可從 ${FIELDING_NOTATION_FONT_SIZE_MIN} 點調整到 ${FIELDING_NOTATION_FONT_SIZE_MAX} 點`}
            minimumValue={FIELDING_NOTATION_FONT_SIZE_MIN}
            maximumValue={FIELDING_NOTATION_FONT_SIZE_MAX}
            step={1}
            value={draftFontSize}
            minimumTrackTintColor="#1D5FA7"
            maximumTrackTintColor="#C8D4E1"
            thumbTintColor="#1D5FA7"
            onValueChange={(value) => setDraftFontSize(normalizeFieldingNotationFontSize(value))}
            onSlidingComplete={(value) => setFontSize(value)}
            style={styles.slider}
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderLabel}>小 {FIELDING_NOTATION_FONT_SIZE_MIN}</Text>
            <Text style={styles.sliderLabel}>標準 20</Text>
            <Text style={styles.sliderLabel}>大 {FIELDING_NOTATION_FONT_SIZE_MAX}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>即時預覽</Text>
          <Text style={styles.cardHint}>模擬右下角傳接區的內容；原始傳接資料不會被字級設定修改。</Text>
          <View style={styles.previewPanel}>
            <Text selectable style={[styles.previewText, { fontSize: metrics.fontSize, lineHeight: metrics.lineHeight }]}>{SAMPLE_NOTATION}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>閱讀保護</Text>
          <View style={styles.preferenceRow}><Text style={styles.preferenceLabel}>長傳接序列</Text><Text style={styles.preferenceValue}>自動換行與省略提示</Text></View>
          <View style={styles.divider} />
          <View style={styles.preferenceRow}><Text style={styles.preferenceLabel}>詳細內容</Text><Text style={styles.preferenceValue}>點擊右下角傳接區放大查看</Text></View>
          <View style={styles.divider} />
          <View style={styles.preferenceRow}><Text style={styles.preferenceLabel}>偏好載入</Text><Text style={styles.preferenceValue}>{isReady ? "已套用本機設定" : "載入本機設定中"}</Text></View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderColor: "#D9E3EE", backgroundColor: "#F8FBFF" },
  eyebrow: { color: "#1D5FA7", fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  title: { color: "#10243E", fontSize: 25, fontWeight: "900", lineHeight: 31 },
  subtitle: { maxWidth: 560, color: "#627389", fontSize: 12, fontWeight: "700", lineHeight: 18 },
  backButton: { minWidth: 70, minHeight: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#1D5FA7", borderRadius: 9, backgroundColor: "#FFFFFF" },
  backButtonText: { color: "#1D5FA7", fontSize: 13, fontWeight: "900" },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  content: { width: "100%", maxWidth: 860, alignSelf: "center", gap: 14, padding: 18, paddingBottom: 28 },
  card: { gap: 10, borderWidth: 1, borderColor: "#D9E3EE", borderRadius: 14, padding: 16, backgroundColor: "#FFFFFF" },
  cardHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  cardTitle: { color: "#10243E", fontSize: 16, fontWeight: "900", lineHeight: 21 },
  cardHint: { color: "#627389", fontSize: 12, fontWeight: "700", lineHeight: 18 },
  valueBadge: { minWidth: 62, alignItems: "center", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "#DCEEFF" },
  valueBadgeText: { color: "#1D5FA7", fontSize: 13, fontWeight: "900" },
  slider: { width: "100%", height: 42 },
  sliderLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: -5 },
  sliderLabel: { color: "#6A7A8F", fontSize: 11, fontWeight: "800" },
  previewPanel: { minHeight: 100, justifyContent: "center", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 10, padding: 14, backgroundColor: "#EFF6FF" },
  previewText: { color: "#1D5FA7", fontWeight: "900", textAlign: "center" },
  preferenceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18, paddingVertical: 4 },
  preferenceLabel: { color: "#10243E", flex: 1, fontSize: 13, fontWeight: "900" },
  preferenceValue: { color: "#1D5FA7", flex: 2, fontSize: 12, fontWeight: "800", textAlign: "right" },
  divider: { height: 1, backgroundColor: "#E6EDF5" },
});
