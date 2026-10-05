import { useMemo, useState, useEffect } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { type Game, type ScorebookDisplayOverride, type Team, type TeamSide, formatGameDateTime } from "@/lib/baseball/types";
import type { WasedaScorebookEntry } from "@/lib/baseball/waseda-scorebook-projection";

export type ScorebookDisplayEditField = "player" | "defense" | "menu";

export type WasedaCellActionMenuModalProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  onSelectOption: (option: "correction" | "ph" | "pr" | "defense") => void;
};

export function WasedaCellActionMenuModal({
  visible,
  title,
  subtitle,
  onClose,
  onSelectOption,
}: WasedaCellActionMenuModalProps) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Text style={styles.closeText}>關閉</Text>
            </Pressable>
          </View>
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>請選擇長按修改動作</Text>
            <View style={styles.categoryCardRow}>
              <Pressable
                onPress={() => onSelectOption("correction")}
                style={({ pressed }) => [styles.categoryCard, pressed && styles.pressed]}
              >
                <Text style={styles.categoryCardBadge}>✏️ 現場記錄</Text>
                <Text style={styles.categoryCardTitle}>【筆誤錯登】</Text>
                <Text style={styles.categoryCardDesc}>展開現場紀錄流程，重新編輯該打席的逐球、球性方向、結果與跑壘事件。</Text>
              </Pressable>

              <Pressable
                onPress={() => onSelectOption("ph")}
                style={({ pressed }) => [styles.categoryCard, styles.categoryCardPH, pressed && styles.pressed]}
              >
                <Text style={styles.categoryCardBadge}>🧢 代打</Text>
                <Text style={styles.categoryCardTitle}>【代打 (PH)】</Text>
                <Text style={styles.categoryCardDesc}>指派代打球員，自動在該打席格左緣繪製 ︴PH 標記並同步左側打序欄。</Text>
              </Pressable>

              <Pressable
                onPress={() => onSelectOption("pr")}
                style={({ pressed }) => [styles.categoryCard, styles.categoryCardPR, pressed && styles.pressed]}
              >
                <Text style={styles.categoryCardBadge}>🏃 代跑</Text>
                <Text style={styles.categoryCardTitle}>【代跑 (PR)】</Text>
                <Text style={styles.categoryCardDesc}>指派代跑球員，自動在該打席格左緣繪製 ︴PR 標記並同步左側打序欄。</Text>
              </Pressable>

              <Pressable
                onPress={() => onSelectOption("defense")}
                style={({ pressed }) => [styles.categoryCard, styles.categoryCardDefense, pressed && styles.pressed]}
              >
                <Text style={styles.categoryCardBadge}>🛡️ 換守</Text>
                <Text style={styles.categoryCardTitle}>【換守】</Text>
                <Text style={styles.categoryCardDesc}>指派換守球員與新守備位置，檢核守備衝突並雙向同步整體紀錄。</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type ScorebookDisplayEditorProps = {
  field: ScorebookDisplayEditField | null;
  entryLabel: string;
  team: Team | null;
  side?: TeamSide;
  battingOrder?: number;
  entry?: WasedaScorebookEntry | null;
  allOrderEntries?: WasedaScorebookEntry[];
  currentOnFieldPositions?: Map<string, string> | Record<string, string>;
  currentPlayerId?: string;
  currentDefensivePosition?: string;
  initialCategory?: "typo" | "ph" | "pr" | "defense";
  onClose: () => void;
  onSave: (patch: ScorebookDisplayOverride & { substitutionAction?: "typo" | "ph" | "pr" | "defense"; targetEntryIndex?: number }) => void;
};

const DEFENSIVE_POSITIONS = [
  { number: "1", label: "投手 (P)" },
  { number: "2", label: "捕手 (C)" },
  { number: "3", label: "一壘手 (1B)" },
  { number: "4", label: "二壘手 (2B)" },
  { number: "5", label: "三壘手 (3B)" },
  { number: "6", label: "游擊手 (SS)" },
  { number: "7", label: "左外野 (LF)" },
  { number: "8", label: "中外野 (CF)" },
  { number: "9", label: "右外野 (RF)" },
  { number: "DH", label: "指名打擊 (DH)" },
  { number: "PH", label: "代打 (PH)" },
  { number: "PR", label: "代跑 (PR)" },
];

export function ScorebookDisplayEditor({
  field,
  entryLabel,
  team,
  battingOrder,
  entry,
  allOrderEntries = [],
  currentOnFieldPositions,
  currentPlayerId,
  currentDefensivePosition,
  initialCategory,
  onClose,
  onSave,
}: ScorebookDisplayEditorProps) {
  const isVisible = field !== null && team !== null;

  const [step, setStep] = useState<"category" | "typo_target" | "player_select" | "defense_select">("category");
  const [category, setCategory] = useState<"typo" | "ph" | "pr" | "defense" | null>(null);
  const [targetEntryIndex, setTargetEntryIndex] = useState<number>(entry?.entryIndex ?? 0);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>(currentPlayerId);
  const [selectedDefensivePosition, setSelectedDefensivePosition] = useState<string | undefined>(currentDefensivePosition);

  // 初始化重置狀態
  useEffect(() => {
    if (isVisible) {
      if (initialCategory === "ph") {
        setCategory("ph");
        const phIndex = allOrderEntries.length > 1 ? allOrderEntries.length - 1 : 1;
        setTargetEntryIndex(phIndex);
        setSelectedDefensivePosition("PH");
        setSelectedPlayerId(currentPlayerId);
        setStep("player_select");
      } else if (initialCategory === "pr") {
        setCategory("pr");
        const prIndex = allOrderEntries.length > 1 ? allOrderEntries.length - 1 : 1;
        setTargetEntryIndex(prIndex);
        setSelectedDefensivePosition("PR");
        setSelectedPlayerId(currentPlayerId);
        setStep("player_select");
      } else if (initialCategory === "defense") {
        setCategory("defense");
        setTargetEntryIndex(entry?.entryIndex ?? 0);
        setSelectedPlayerId(currentPlayerId);
        setSelectedDefensivePosition(currentDefensivePosition);
        setStep("player_select");
      } else if (initialCategory === "typo") {
        setCategory("typo");
        setTargetEntryIndex(entry?.entryIndex ?? 0);
        setSelectedPlayerId(currentPlayerId);
        setSelectedDefensivePosition(currentDefensivePosition);
        setStep("typo_target");
      } else {
        setStep("category");
        setCategory(null);
        setTargetEntryIndex(entry?.entryIndex ?? 0);
        setSelectedPlayerId(currentPlayerId);
        setSelectedDefensivePosition(currentDefensivePosition);
      }
    }
  }, [isVisible, currentPlayerId, currentDefensivePosition, entry?.entryIndex, initialCategory, allOrderEntries.length]);

  if (!isVisible || !team) return null;

  // 連動換守衝突防呆檢查
  const checkPositionConflict = (posCode?: string) => {
    if (!posCode || posCode === "DH" || posCode === "PH" || posCode === "PR") return null;
    if (!currentOnFieldPositions) return null;

    let entries: Array<[string, string]> = [];
    if (currentOnFieldPositions instanceof Map) {
      entries = Array.from(currentOnFieldPositions.entries());
    } else {
      entries = Object.entries(currentOnFieldPositions);
    }

    const conflictingPlayerEntry = entries.find(([pid, pos]) => pid !== selectedPlayerId && pos === posCode);
    if (conflictingPlayerEntry) {
      const p = team.players.find((item) => item.id === conflictingPlayerEntry[0]);
      const pName = p ? `#${p.number} ${p.name}` : "其他球員";
      const posLabel = DEFENSIVE_POSITIONS.find((item) => item.number === posCode)?.label ?? posCode;
      return `⚠️ 防呆提醒：${pName} 目前已佔用【${posLabel}】！完成修改後請留意連動換守調整，避免守位重疊。`;
    }
    return null;
  };

  const conflictMessage = checkPositionConflict(selectedDefensivePosition);

  const handleSelectCategory = (selectedCat: "typo" | "ph" | "pr" | "defense") => {
    setCategory(selectedCat);
    if (selectedCat === "typo") {
      setStep("typo_target");
    } else if (selectedCat === "ph") {
      const phIndex = allOrderEntries.length > 1 ? allOrderEntries.length - 1 : 1;
      setTargetEntryIndex(phIndex);
      setSelectedDefensivePosition("PH");
      setStep("player_select");
    } else if (selectedCat === "pr") {
      const prIndex = allOrderEntries.length > 1 ? allOrderEntries.length - 1 : 1;
      setTargetEntryIndex(prIndex);
      setSelectedDefensivePosition("PR");
      setStep("player_select");
    } else if (selectedCat === "defense") {
      setTargetEntryIndex(entry?.entryIndex ?? 0);
      setStep("player_select");
    }
  };

  const handleSelectTypoTarget = (targetIdx: number) => {
    setTargetEntryIndex(targetIdx);
    const targetEntry = allOrderEntries.find((e) => e.entryIndex === targetIdx);
    if (targetEntry?.playerId) {
      setSelectedPlayerId(targetEntry.playerId);
    }
    if (targetEntry?.formattedDefensivePosition) {
      setSelectedDefensivePosition(targetEntry.formattedDefensivePosition);
    }
    setStep("player_select");
  };

  const handleSelectPlayer = (playerId: string) => {
    setSelectedPlayerId(playerId);
    setStep("defense_select");
  };

  const handleSelectDefense = (defPos: string) => {
    setSelectedDefensivePosition(defPos);
  };

  const handleConfirmSave = () => {
    let roleOverride: "starter" | "PH" | "PR" | undefined;
    if (category === "ph") roleOverride = "PH";
    else if (category === "pr") roleOverride = "PR";

    onSave({
      playerId: selectedPlayerId,
      defensivePosition: selectedDefensivePosition,
      role: roleOverride,
      substitutionAction: category ?? "typo",
      targetEntryIndex,
      revisedAt: new Date().toISOString(),
    });
  };

  return (
    <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>打序格修改與替補調度</Text>
              <Text style={styles.subtitle}>
                {battingOrder ? `第 ${battingOrder} 棒 · ` : ""}{entryLabel}
              </Text>
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Text style={styles.closeText}>關閉</Text>
            </Pressable>
          </View>

          {/* 步驟 1: 選擇修改類別 */}
          {step === "category" && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Step 1. 請選擇修改類別</Text>
              <View style={styles.categoryCardRow}>
                <Pressable
                  onPress={() => handleSelectCategory("typo")}
                  style={({ pressed }) => [styles.categoryCard, pressed && styles.pressed]}
                >
                  <Text style={styles.categoryCardBadge}>✏️ 修正</Text>
                  <Text style={styles.categoryCardTitle}>【筆誤錯登】</Text>
                  <Text style={styles.categoryCardDesc}>修正先發、代打或代跑的球員姓名、背號或守備位置錯登。</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleSelectCategory("ph")}
                  style={({ pressed }) => [styles.categoryCard, styles.categoryCardPH, pressed && styles.pressed]}
                >
                  <Text style={styles.categoryCardBadge}>🧢 替補</Text>
                  <Text style={styles.categoryCardTitle}>【代打 (PH)】</Text>
                  <Text style={styles.categoryCardDesc}>更換代打球員並選擇守備位置，自動同步右側早稻田波浪線。</Text>
                </Pressable>

                <Pressable
                  onPress={() => handleSelectCategory("pr")}
                  style={({ pressed }) => [styles.categoryCard, styles.categoryCardPR, pressed && styles.pressed]}
                >
                  <Text style={styles.categoryCardBadge}>🏃 替補</Text>
                  <Text style={styles.categoryCardTitle}>【代跑 (PR)】</Text>
                  <Text style={styles.categoryCardDesc}>更換代跑球員並選擇守備位置，自動同步右側早稻田波浪線。</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* 步驟 2A: 選擇欲筆誤錯登的對象 */}
          {step === "typo_target" && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeaderRow}>
                <Pressable onPress={() => setStep("category")} style={styles.backButton}>
                  <Text style={styles.backButtonText}>← 上一步</Text>
                </Pressable>
                <Text style={styles.stepTitle}>Step 2. 請選擇欲修改的球員層級</Text>
              </View>
              <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {allOrderEntries.length > 0 ? (
                  allOrderEntries.map((e) => {
                    const p = e.playerId ? team.players.find((item) => item.id === e.playerId) : undefined;
                    const roleLabel = e.kind === "starter" ? "先發球員" : e.substitution?.type === "代跑" ? "代跑 (PR)" : "代打 (PH)";
                    return (
                      <Pressable
                        key={e.entryIndex}
                        onPress={() => handleSelectTypoTarget(e.entryIndex)}
                        style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                      >
                        <View>
                          <Text style={styles.optionTitle}>
                            [{roleLabel}] {p ? `#${p.number} ${p.name}` : "未登錄球員 / 留空"}
                          </Text>
                          <Text style={styles.optionSubtitle}>
                            守備位置: {e.formattedDefensivePosition || "—"}
                          </Text>
                        </View>
                        <Text style={styles.selectMark}>選擇更正</Text>
                      </Pressable>
                    );
                  })
                ) : (
                  <Pressable
                    onPress={() => handleSelectTypoTarget(0)}
                    style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                  >
                    <Text style={styles.optionTitle}>修改先發球員 (第 1 列)</Text>
                    <Text style={styles.selectMark}>選擇</Text>
                  </Pressable>
                )}
              </ScrollView>
            </View>
          )}

          {/* 步驟 2B: 選擇球員 */}
          {step === "player_select" && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeaderRow}>
                <Pressable
                  onPress={() => setStep(category === "typo" ? "typo_target" : "category")}
                  style={styles.backButton}
                >
                  <Text style={styles.backButtonText}>← 上一步</Text>
                </Pressable>
                <Text style={styles.stepTitle}>
                  {category === "ph" ? "Step 2. 選擇代打 (PH) 球員" : category === "pr" ? "Step 2. 選擇代跑 (PR) 球員" : category === "defense" ? "Step 2. 選擇換守球員" : "Step 2. 更換修正球員"}
                </Text>
              </View>
              <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {team.players.map((player) => {
                  const selected = player.id === selectedPlayerId;
                  return (
                    <Pressable
                      key={player.id}
                      onPress={() => handleSelectPlayer(player.id)}
                      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
                    >
                      <View>
                        <Text style={styles.optionTitle}>#{player.number} {player.name}</Text>
                        <Text style={styles.optionSubtitle}>
                          {player.throwingHand}{player.battingHand} · 常用位置: {player.preferredPositions?.join("／") || "未設定"}
                        </Text>
                      </View>
                      <Text style={styles.selectMark}>{selected ? "已選取" : "選擇"}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* 步驟 2C: 選擇守備位置 & 連動換守防呆檢核 */}
          {step === "defense_select" && (
            <View style={styles.stepContainer}>
              <View style={styles.stepHeaderRow}>
                <Pressable onPress={() => setStep("player_select")} style={styles.backButton}>
                  <Text style={styles.backButtonText}>← 上一步</Text>
                </Pressable>
                <Text style={styles.stepTitle}>Step 3. 設定守備位置與連動換守檢核</Text>
              </View>

              {conflictMessage ? (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>{conflictMessage}</Text>
                </View>
              ) : null}

              <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                {DEFENSIVE_POSITIONS.map((position) => {
                  const selected = position.number === selectedDefensivePosition;
                  return (
                    <Pressable
                      key={position.number}
                      onPress={() => handleSelectDefense(position.number)}
                      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
                    >
                      <Text style={styles.optionTitle}>{position.label}</Text>
                      <Text style={styles.selectMark}>{selected ? "已選取" : "選擇"}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.footerRow}>
                <Pressable onPress={handleConfirmSave} style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
                  <Text style={styles.saveButtonText}>確認修改並同步整體紀錄</Text>
                </Pressable>
              </View>
            </View>
          )}
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
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>{filteredGames.length ? filteredGames.map((game) => <Pressable key={game.id} onPress={() => { onSelect(game.id); setVisible(false); }} style={({ pressed }) => [styles.option, game.id === activeGameId && styles.optionSelected, pressed && styles.pressed]}><View style={styles.gameRowCopy}><Text style={styles.optionTitle}>{game.name}</Text><Text style={styles.optionSubtitle}>{formatGameDateTime(game)} · {game.competition || "未分類賽事"} · {isDisplayExample(game) ? "唯讀展示範例" : game.status === "final" ? "已結束" : "現場紀錄"}</Text></View><Text style={styles.selectMark}>{game.id === activeGameId ? "目前" : "開啟"}</Text></Pressable>) : <Text style={styles.empty}>目前沒有符合篩選條件的場次。</Text>}</ScrollView>
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
  stepContainer: { marginTop: 14, gap: 12 },
  stepHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepTitle: { color: "#1e293b", fontSize: 15, fontWeight: "800" },
  backButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: "#cbd5e1" },
  backButtonText: { color: "#1e293b", fontSize: 12, fontWeight: "700" },
  categoryCardRow: { flexDirection: "column", gap: 10, marginTop: 6 },
  categoryCard: { padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#cbd5e1", backgroundColor: "#ffffff" },
  categoryCardPH: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
  categoryCardPR: { borderColor: "#10b981", backgroundColor: "#ecfdf5" },
  categoryCardDefense: { borderColor: "#6366f1", backgroundColor: "#eef2ff" },
  categoryCardBadge: { fontSize: 11, fontWeight: "800", color: "#64748b", marginBottom: 2 },
  categoryCardTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
  categoryCardDesc: { fontSize: 12, color: "#475569", marginTop: 4, lineHeight: 16 },
  warningBox: { padding: 10, borderRadius: 8, backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#f59e0b" },
  warningText: { color: "#b45309", fontSize: 12, fontWeight: "700", lineHeight: 17 },
  footerRow: { marginTop: 12, alignItems: "flex-end" },
  saveButton: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, backgroundColor: "#1d4ed8" },
  saveButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 12 }, chip: { borderWidth: 1, borderColor: "#cbd5e1", paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: "#fff" }, chipActive: { borderColor: "#1d4ed8", backgroundColor: "#dbeafe" }, chipText: { color: "#475569", fontSize: 12, fontWeight: "700" }, chipTextActive: { color: "#1d4ed8" },
  list: { marginTop: 14 }, listContent: { gap: 8, paddingBottom: 4 }, option: { minHeight: 52, padding: 11, borderWidth: 1, borderColor: "#dbe3ef", borderRadius: 11, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, optionSelected: { borderColor: "#2563eb", backgroundColor: "#eff6ff" }, optionTitle: { color: "#0f172a", fontSize: 14, fontWeight: "800" }, optionSubtitle: { marginTop: 2, color: "#64748b", fontSize: 11 }, selectMark: { color: "#1d4ed8", fontSize: 12, fontWeight: "800" }, gameRowCopy: { flex: 1 }, empty: { paddingVertical: 22, color: "#64748b", textAlign: "center" },
  gameTrigger: { minWidth: 210, maxWidth: 340, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff" }, gameTriggerLabel: { color: "#1e3a8a", fontSize: 11, fontWeight: "800" }, gameTriggerValue: { flex: 1, color: "#1d4ed8", fontSize: 12, fontWeight: "800" }, gameTriggerChevron: { color: "#1d4ed8", fontWeight: "900" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
});
