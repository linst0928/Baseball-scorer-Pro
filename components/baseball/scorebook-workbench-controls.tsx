import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Game, ScorebookDisplayOverride, Team } from "@/lib/baseball/types";

export type ScorebookDisplayEditField = "player" | "defense";

type ScorebookDisplayEditorProps = {
  field: ScorebookDisplayEditField | null;
  entryLabel: string;
  team: Team | null;
  currentPlayerId?: string;
  currentDefensivePosition?: string;
  onClose: () => void;
  onSave: (patch: ScorebookDisplayOverride) => void;
};

const DEFENSIVE_POSITIONS = [
  { number: "1", label: "投手" }, { number: "2", label: "捕手" }, { number: "3", label: "一壘" },
  { number: "4", label: "二壘" }, { number: "5", label: "三壘" }, { number: "6", label: "游擊" },
  { number: "7", label: "左外" }, { number: "8", label: "中外" }, { number: "9", label: "右外" },
];

export function ScorebookDisplayEditor({ field, entryLabel, team, currentPlayerId, currentDefensivePosition, onClose, onSave }: ScorebookDisplayEditorProps) {
  const isVisible = field !== null && team !== null;
  const title = field === "player" ? "更換表格球員" : "修改表格守備";
  const hint = field === "player"
    ? "此修改只覆蓋單場整體紀錄的姓名與背號顯示，不改動先發名單、現場逐球或正式統計。"
    : "此修改只覆蓋單場整體紀錄的守備顯示，不改動守備配置、出局判定或正式統計。";

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>{entryLabel}</Text></View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Text style={styles.closeText}>關閉</Text></Pressable>
          </View>
          <Text style={styles.hint}>{hint}</Text>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {field === "player" ? team?.players.map((player) => {
              const selected = player.id === currentPlayerId;
              return <Pressable key={player.id} onPress={() => onSave({ playerId: player.id, revisedAt: new Date().toISOString() })} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}><View><Text style={styles.optionTitle}>#{player.number} {player.name}</Text><Text style={styles.optionSubtitle}>{player.throwingHand}{player.battingHand} · 常用 {player.preferredPositions?.join("／") || "未設定"}</Text></View><Text style={styles.selectMark}>{selected ? "已選" : "選擇"}</Text></Pressable>;
            }) : DEFENSIVE_POSITIONS.map((position) => {
              const selected = position.number === currentDefensivePosition;
              return <Pressable key={position.number} onPress={() => onSave({ defensivePosition: position.number, revisedAt: new Date().toISOString() })} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}><Text style={styles.optionTitle}>{position.number} {position.label}</Text><Text style={styles.selectMark}>{selected ? "已選" : "選擇"}</Text></Pressable>;
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type ScorebookGameSelectorProps = {
  activeGameId: string;
  games: Game[];
  onSelect: (gameId: string) => void;
};

export function ScorebookGameSelector({ activeGameId, games, onSelect }: ScorebookGameSelectorProps) {
  const [visible, setVisible] = useState(false);
  const [scope, setScope] = useState<"all" | "live" | "examples">("all");
  const [date, setDate] = useState("全部日期");
  const [competition, setCompetition] = useState("全部盃賽");
  const dates = useMemo(() => ["全部日期", ...Array.from(new Set(games.map((game) => game.date))).sort((a, b) => b.localeCompare(a))], [games]);
  const competitions = useMemo(() => ["全部盃賽", ...Array.from(new Set(games.map((game) => game.competition || "未分類賽事")))], [games]);
  const isDisplayExample = (game: Game) => game.sourceRevision?.startsWith("wbc2013-display-example-") ?? false;
  const filteredGames = useMemo(() => games.filter((game) => (scope === "all" || (scope === "live" ? game.status !== "final" : isDisplayExample(game))) && (date === "全部日期" || game.date === date) && (competition === "全部盃賽" || (game.competition || "未分類賽事") === competition)), [competition, date, games, scope]);
  const activeGame = games.find((game) => game.id === activeGameId);

  return <>
    <Pressable onPress={() => setVisible(true)} style={({ pressed }) => [styles.gameTrigger, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="選擇單場整體紀錄場次"><Text style={styles.gameTriggerLabel}>場次</Text><Text numberOfLines={1} style={styles.gameTriggerValue}>{activeGame?.name || "選擇場次"}</Text><Text style={styles.gameTriggerChevron}>⌄</Text></Pressable>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}><View><Text style={styles.title}>選擇整體紀錄場次</Text><Text style={styles.subtitle}>可依現場、日期與盃賽快速縮小清單</Text></View><Pressable onPress={() => setVisible(false)} style={({ pressed }) => [styles.close, pressed && styles.pressed]}><Text style={styles.closeText}>關閉</Text></Pressable></View>
          <Text style={styles.filterLabel}>狀態</Text><View style={styles.chipRow}>{([ ["all", "全部場次"], ["live", "現場進行中"], ["examples", "2013 WBC 範例"] ] as const).map(([value, label]) => <Pressable key={value} onPress={() => setScope(value)} style={({ pressed }) => [styles.chip, scope === value && styles.chipActive, pressed && styles.pressed]}><Text style={[styles.chipText, scope === value && styles.chipTextActive]}>{label}</Text></Pressable>)}</View>
          <Text style={styles.filterLabel}>日期</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{dates.map((value) => <Pressable key={value} onPress={() => setDate(value)} style={({ pressed }) => [styles.chip, date === value && styles.chipActive, pressed && styles.pressed]}><Text style={[styles.chipText, date === value && styles.chipTextActive]}>{value}</Text></Pressable>)}</ScrollView>
          <Text style={styles.filterLabel}>盃賽／聯賽</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>{competitions.map((value) => <Pressable key={value} onPress={() => setCompetition(value)} style={({ pressed }) => [styles.chip, competition === value && styles.chipActive, pressed && styles.pressed]}><Text style={[styles.chipText, competition === value && styles.chipTextActive]}>{value}</Text></Pressable>)}</ScrollView>
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>{filteredGames.length ? filteredGames.map((game) => <Pressable key={game.id} onPress={() => { onSelect(game.id); setVisible(false); }} style={({ pressed }) => [styles.option, game.id === activeGameId && styles.optionSelected, pressed && styles.pressed]}><View style={styles.gameRowCopy}><Text style={styles.optionTitle}>{game.name}</Text><Text style={styles.optionSubtitle}>{game.date} · {game.competition || "未分類賽事"} · {isDisplayExample(game) ? "唯讀展示範例" : game.status === "final" ? "已結束" : "現場紀錄"}</Text></View><Text style={styles.selectMark}>{game.id === activeGameId ? "目前" : "開啟"}</Text></Pressable>) : <Text style={styles.empty}>目前沒有符合篩選條件的場次。</Text>}</ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "rgba(15, 23, 42, 0.58)" },
  sheet: { width: "100%", maxWidth: 720, maxHeight: "86%", borderRadius: 18, backgroundColor: "#f8fafc", padding: 18, shadowColor: "#0f172a", shadowOpacity: 0.24, shadowRadius: 18, elevation: 12 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  title: { color: "#0f172a", fontSize: 19, fontWeight: "800" }, subtitle: { color: "#64748b", marginTop: 3, fontSize: 12 },
  close: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, backgroundColor: "#e2e8f0" }, closeText: { color: "#334155", fontWeight: "700" },
  hint: { marginTop: 14, color: "#475569", fontSize: 13, lineHeight: 19 }, filterLabel: { marginTop: 13, marginBottom: 6, color: "#334155", fontSize: 12, fontWeight: "800" },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 12 }, chip: { borderWidth: 1, borderColor: "#cbd5e1", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: "#fff" }, chipActive: { borderColor: "#1d4ed8", backgroundColor: "#dbeafe" }, chipText: { color: "#475569", fontSize: 12, fontWeight: "700" }, chipTextActive: { color: "#1d4ed8" },
  list: { marginTop: 14 }, listContent: { gap: 8, paddingBottom: 4 }, option: { minHeight: 52, padding: 11, borderWidth: 1, borderColor: "#dbe3ef", borderRadius: 11, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, optionSelected: { borderColor: "#2563eb", backgroundColor: "#eff6ff" }, optionTitle: { color: "#0f172a", fontSize: 14, fontWeight: "800" }, optionSubtitle: { marginTop: 2, color: "#64748b", fontSize: 11 }, selectMark: { color: "#1d4ed8", fontSize: 12, fontWeight: "800" }, gameRowCopy: { flex: 1 }, empty: { paddingVertical: 22, color: "#64748b", textAlign: "center" },
  gameTrigger: { minWidth: 210, maxWidth: 340, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff" }, gameTriggerLabel: { color: "#1e3a8a", fontSize: 11, fontWeight: "800" }, gameTriggerValue: { flex: 1, color: "#1d4ed8", fontSize: 12, fontWeight: "800" }, gameTriggerChevron: { color: "#1d4ed8", fontWeight: "900" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
