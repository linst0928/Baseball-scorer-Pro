import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import {
  WASEDA_SYMBOL_CATEGORIES,
  WASEDA_SYMBOL_REFERENCE,
  type WasedaSymbolCategory,
  type WasedaSymbolReference,
} from "@/lib/baseball/waseda-symbol-reference";

const PALETTE = {
  navy: "#123A68",
  blue: "#1D5FA7",
  red: "#C83B44",
  ink: "#10243E",
  muted: "#6A7A8F",
  line: "#D8E2ED",
  paper: "#F7FAFD",
  white: "#FFFFFF",
  sky: "#EAF3FB",
};

function SymbolCard({ item }: { item: WasedaSymbolReference }) {
  const toneStyle = item.tone === "red" ? styles.markRed : item.tone === "blue" ? styles.markBlue : styles.markNavy;
  return (
    <View style={styles.symbolCard}>
      <View style={[styles.symbolMark, toneStyle]}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={styles.symbolMarkText}>{item.mark}</Text>
      </View>
      <View style={styles.symbolCopy}>
        <View style={styles.symbolTitleRow}>
          <Text style={styles.symbolTitle}>{item.title}</Text>
          <Text style={styles.symbolPlacement}>{item.placement}</Text>
        </View>
        <Text style={styles.symbolDescription}>{item.description}</Text>
        <View style={styles.examplePill}><Text style={styles.exampleLabel}>範例</Text><Text style={styles.exampleText}>{item.example}</Text></View>
      </View>
    </View>
  );
}

export default function WasedaSymbolsScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<WasedaSymbolCategory | "全部">("全部");
  const [query, setQuery] = useState("");

  const symbols = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return WASEDA_SYMBOL_REFERENCE.filter((item) => {
      const matchesCategory = category === "全部" || item.category === category;
      const content = `${item.mark} ${item.title} ${item.placement} ${item.description} ${item.example}`.toLowerCase();
      return matchesCategory && (!normalizedQuery || content.includes(normalizedQuery));
    });
  }, [category, query]);

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} containerClassName="bg-background">
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="返回首頁" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <Text style={styles.backButtonText}>‹ 返回</Text>
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>WASEDA SCOREKEEPING</Text>
            <Text style={styles.title}>早稻田符號速查表</Text>
          </View>
          <View style={styles.countBadge}><Text style={styles.countBadgeText}>{symbols.length} 個符號</Text></View>
        </View>

        <FlatList
          data={symbols}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <SymbolCard item={item} />}
          ListHeaderComponent={(
            <View>
              <View style={styles.guideBanner}>
                <View style={styles.guideBadge}><Text style={styles.guideBadgeText}>記</Text></View>
                <View style={styles.guideCopy}><Text style={styles.guideTitle}>依 1189LAB 對齊，由「位置」開始查詢</Text><Text style={styles.guideText}>個人紀錄欄分為球數欄、外圈與菱形內圈；軌跡統一為⌒、ー、＿，守備傳接使用 5ー3。盜壘維持本 App 已確認的藍色箭頭加 SB；現場可長按符號查看相同說明。</Text></View>
              </View>
              <TextInput value={query} onChangeText={setQuery} placeholder="搜尋符號、名稱、位置或範例，例如：SB、暴投、外圈" placeholderTextColor={PALETTE.muted} style={styles.searchInput} returnKeyType="search" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {WASEDA_SYMBOL_CATEGORIES.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={({ pressed }) => [styles.categoryChip, category === item && styles.categoryChipActive, pressed && styles.pressed]}><Text style={[styles.categoryText, category === item && styles.categoryTextActive]}>{item}</Text></Pressable>)}
              </ScrollView>
              <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{category === "全部" ? "全部符號" : category}</Text><Text style={styles.sectionMeta}>符號 · 使用位置 · 寫法範例</Text></View>
            </View>
          )}
          ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyTitle}>沒有符合的符號</Text><Text style={styles.emptyText}>請改用縮寫、中文名稱或紀錄欄位置搜尋。</Text></View>}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PALETTE.paper },
  topBar: { minHeight: 74, backgroundColor: PALETTE.white, borderBottomWidth: 1, borderColor: PALETTE.line, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 12 },
  backButton: { minHeight: 38, borderWidth: 1, borderColor: PALETTE.line, borderRadius: 10, backgroundColor: PALETTE.paper, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  backButtonText: { color: PALETTE.navy, fontWeight: "900", fontSize: 12 },
  titleBlock: { flex: 1 },
  eyebrow: { color: PALETTE.blue, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  title: { color: PALETTE.ink, fontSize: 20, lineHeight: 26, fontWeight: "900" },
  countBadge: { paddingVertical: 7, paddingHorizontal: 11, borderRadius: 99, backgroundColor: PALETTE.sky },
  countBadgeText: { color: PALETTE.blue, fontSize: 11, fontWeight: "900" },
  listContent: { padding: 16, paddingBottom: 26 },
  guideBanner: { flexDirection: "row", gap: 12, backgroundColor: PALETTE.navy, borderRadius: 16, padding: 14, marginBottom: 12 },
  guideBadge: { width: 42, height: 42, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  guideBadgeText: { color: PALETTE.white, fontSize: 21, fontWeight: "900" },
  guideCopy: { flex: 1 },
  guideTitle: { color: PALETTE.white, fontSize: 14, fontWeight: "900", marginBottom: 3 },
  guideText: { color: "#DDEBFA", fontSize: 11, lineHeight: 17 },
  searchInput: { minHeight: 43, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.line, borderRadius: 12, paddingHorizontal: 13, color: PALETTE.ink, fontSize: 12, marginBottom: 11 },
  categoryRow: { gap: 8, paddingBottom: 12 },
  categoryChip: { minHeight: 34, borderRadius: 17, borderWidth: 1, borderColor: PALETTE.line, backgroundColor: PALETTE.white, paddingHorizontal: 12, justifyContent: "center" },
  categoryChipActive: { backgroundColor: PALETTE.navy, borderColor: PALETTE.navy },
  categoryText: { color: PALETTE.muted, fontSize: 11, fontWeight: "800" },
  categoryTextActive: { color: PALETTE.white },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 },
  sectionTitle: { color: PALETTE.ink, fontSize: 16, fontWeight: "900" },
  sectionMeta: { color: PALETTE.muted, fontSize: 10, fontWeight: "700" },
  gridRow: { gap: 12, marginBottom: 12 },
  symbolCard: { flex: 1, minWidth: 0, minHeight: 137, flexDirection: "row", gap: 10, backgroundColor: PALETTE.white, borderWidth: 1, borderColor: PALETTE.line, borderRadius: 14, padding: 11 },
  symbolMark: { width: 47, height: 47, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  markNavy: { backgroundColor: "#E8EDF4" },
  markRed: { backgroundColor: "#FFF0F1" },
  markBlue: { backgroundColor: "#EAF3FB" },
  symbolMarkText: { color: PALETTE.navy, fontSize: 19, fontWeight: "900", paddingHorizontal: 3 },
  symbolCopy: { flex: 1, minWidth: 0 },
  symbolTitleRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
  symbolTitle: { color: PALETTE.ink, fontSize: 13, fontWeight: "900" },
  symbolPlacement: { color: PALETTE.blue, fontSize: 9, fontWeight: "800", flexShrink: 1 },
  symbolDescription: { color: PALETTE.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
  examplePill: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7, paddingHorizontal: 7, paddingVertical: 4, alignSelf: "flex-start", backgroundColor: PALETTE.paper, borderRadius: 7 },
  exampleLabel: { color: PALETTE.muted, fontSize: 9, fontWeight: "800" },
  exampleText: { color: PALETTE.navy, fontSize: 10, fontWeight: "900" },
  emptyState: { paddingVertical: 42, alignItems: "center" },
  emptyTitle: { color: PALETTE.ink, fontSize: 15, fontWeight: "900" },
  emptyText: { color: PALETTE.muted, fontSize: 11, marginTop: 5 },
  pressed: { opacity: 0.72 },
});
