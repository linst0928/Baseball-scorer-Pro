import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { WasedaPersonalRecordCell } from "./waseda-personal-record-cell";
import { createWasedaScorebookProjection, getScorebookDisplayOverrideKey, getScorebookSubstitutionMarker, type WasedaScorebookEntry } from "@/lib/baseball/waseda-scorebook-projection";
import { formatAvg, getBattingStats, getPitchingStats, getTeamPerformanceSummary, type Game, type ScorebookBlankSlot, type ScorebookDisplayOverride, type Team, type TeamSide } from "@/lib/baseball/types";

type WasedaScorebookTeamSheetProps = {
  game: Game;
  team: Team;
  opponentTeam: Team;
  side: TeamSide;
  onSelectAtBatEvent: (eventId: string) => void;
  onLongPressAtBatEvent?: (eventId: string) => void;
  onLongPressEntry?: (entry: WasedaScorebookEntry, battingOrder: number, field: "player" | "defense") => void;
  onLongPressBlankSlot?: (slot: ScorebookBlankSlot) => void;
};

/** 緊湊打席格依紙本參考採 92×70，逐局欄與單一紙本格同寬，不保留粗框外側空白。 */
const SLOT_HEIGHT = 70;
const INNING_WIDTH = 92;
/** 未登場候補只作為可擴充的保留列，不應佔用一個完整打席格高度。 */
const RESERVE_ROW_HEIGHT = 30;

const halfLabel = (half: TeamSide) => half === "away" ? "上" : "下";

export function WasedaScorebookTeamSheet({ game, team, opponentTeam, side, onSelectAtBatEvent, onLongPressAtBatEvent, onLongPressEntry, onLongPressBlankSlot }: WasedaScorebookTeamSheetProps) {
  const [showSubstitutionInningsOnly, setShowSubstitutionInningsOnly] = useState(false);
  const lineup = side === "away" ? game.awayLineup : game.homeLineup;
  const projection = useMemo(() => createWasedaScorebookProjection({
    team,
    side,
    lineup,
    events: game.events,
    substitutions: game.substitutions,
    inningCount: Math.max(game.inning, game.score.length, 1),
  }), [game.awayLineup, game.events, game.homeLineup, game.inning, game.score.length, game.substitutions, lineup, side, team]);
  const playerById = useMemo(() => new Map(team.players.map((player) => [player.id, player])), [team.players]);
  const opponentPlayerById = useMemo(() => new Map(opponentTeam.players.map((player) => [player.id, player])), [opponentTeam.players]);
  const batting = useMemo(() => getBattingStats(game, team), [game, team]);
  const pitching = useMemo(() => getPitchingStats(game, team), [game, team]);
  const summary = useMemo(() => getTeamPerformanceSummary([game], team), [game, team]);
  const totalRuns = game.score.reduce((total, inning) => total + (side === "away" ? inning.away : inning.home), 0);
  const accent = team.customColor ?? (side === "away" ? "#1D4ED8" : "#B91C1C");
  const surface = side === "away" ? "#EFF6FF" : "#FFF1F2";
  /** 篩選只改變這張分隊表的可視局欄，不改寫正式打席、換人或統計資料。 */
  const substitutionInnings = useMemo(() => new Set(
    game.substitutions.filter((substitution) => substitution.teamId === team.id).map((substitution) => substitution.inning),
  ), [game.substitutions, team.id]);
  const substitutionVisibleInnings = projection.innings.filter((inning) => substitutionInnings.has(inning.inning));
  const hasSubstitutionInnings = substitutionVisibleInnings.length > 0;
  const isSubstitutionInningFilterActive = showSubstitutionInningsOnly && hasSubstitutionInnings;
  const visibleInnings = isSubstitutionInningFilterActive ? substitutionVisibleInnings : projection.innings;

  const entryDescription = (entry: WasedaScorebookEntry, battingOrder: number) => {
    const overrideKey = getScorebookDisplayOverrideKey(side, battingOrder, entry.entryIndex);
    const displayOverride: ScorebookDisplayOverride | undefined = game.scorebookDisplayOverrides?.[overrideKey];
    const player = (displayOverride?.playerId ?? entry.playerId) ? playerById.get(displayOverride?.playerId ?? entry.playerId ?? "") : undefined;
    const defensivePosition = displayOverride?.defensivePosition || (entry.kind === "starter" ? lineup?.defensivePositions[entry.playerId ?? ""] : entry.substitution?.position) || player?.position || "—";
    if (!player) return { title: "候補保留／待換人", detail: "尚未登場；不代表事件", defensivePosition: "—" };
    if (entry.kind === "starter") {
      return {
        title: `#${player.number} ${player.name}`,
        detail: `先發 ${defensivePosition} · 第${battingOrder}棒${displayOverride ? " · 表格補正" : ""}`,
        defensivePosition,
      };
    }
    const change = entry.substitution;
    const replacementMarker = getScorebookSubstitutionMarker(change?.type);
    const pitchingChange = change?.type === "換投";
    return {
      title: `#${player.number} ${player.name}`,
      detail: pitchingChange && entry.enteredInning
        ? `第${entry.enteredInning}局${entry.enteredHalf ? halfLabel(entry.enteredHalf) : ""}・P（換投） · 守 ${defensivePosition}${displayOverride ? " · 表格補正" : ""}${entry.fallback ? " · 回退" : ""}`
        : replacementMarker && entry.enteredInning
        ? `第${entry.enteredInning}局${entry.enteredHalf ? halfLabel(entry.enteredHalf) : ""}・${replacementMarker.code}（${replacementMarker.label}） · 守 ${defensivePosition}${displayOverride ? " · 表格補正" : ""}${entry.fallback ? " · 回退" : ""}`
        : `${entry.enteredInning ?? "?"}${entry.enteredHalf ? halfLabel(entry.enteredHalf) : ""} 入 · ${change?.type ?? "局中承接"} ${defensivePosition}${displayOverride ? " · 表格補正" : ""}${entry.fallback ? " · 回退" : ""}`,
      defensivePosition,
    };
  };
  const formatDefenseTimeline = (item: typeof projection.defenseTimeline[number]) => {
    const player = playerById.get(item.playerId);
    const outgoing = item.playerOutId ? playerById.get(item.playerOutId) : undefined;
    const starts = `第${item.inning}局${halfLabel(item.half)}`;
    const ends = item.leftInning ? `至第${item.leftInning}局${item.leftHalf ? halfLabel(item.leftHalf) : ""}` : "持續至比賽結束";
    return `${starts}・${item.label}・#${player?.number ?? "—"} ${player?.name ?? "未登錄球員"} → ${item.position}守備${outgoing ? `（接替 #${outgoing.number} ${outgoing.name}）` : ""}・${ends}`;
  };

  return <View style={[styles.sheet, { borderColor: accent, backgroundColor: surface }]}>
    <View style={styles.titleRow}>
      <View style={styles.titleCopy}>
        <Text style={[styles.sideCaption, { color: accent }]}>{side === "away" ? "客場／先攻" : "主場／後攻"}・早稻田式單場整體紀錄</Text>
        <Text style={styles.title}>{team.name}</Text>
        <Text style={styles.hint}>先發 1–9 棒為直向主列；每棒次固定預留三格球員承接欄，代打 PH、代跑 PR、代守 PF 與換投 P 會依發生局承接，超過三人時自動增加。右側每局由整個棒次共用實際打席格，不會為替換球員虛構打席。</Text>
      </View>
      <View style={[styles.scoreBadge, { borderColor: accent }]}><Text style={[styles.scoreValue, { color: accent }]}>{totalRuns}</Text><Text style={styles.scoreLabel}>得分</Text></View>
    </View>

    {projection.usesLineupFallback ? <View style={styles.fallbackNote}><Text style={styles.fallbackText}>此舊場次缺少先發棒次快照，已按實際打席首次出現順序保守投影；原始賽事資料沒有被修改。</Text></View> : null}
    {projection.defenseTimeline.length ? <View style={styles.defenseTimelineCard}><Text style={styles.defenseTimelineTitle}>守備轉換時間線</Text><Text style={styles.defenseTimelineHint}>代打後改守與局中換守依正式換人順序呈現；未寫入的守位不推測。</Text><View style={styles.defenseTimelineList}>{projection.defenseTimeline.map((item) => <View key={`${item.playerId}-${item.inning}-${item.half}-${item.position}`} style={styles.defenseTimelineItem}><Text style={styles.defenseTimelineText}>{formatDefenseTimeline(item)}</Text></View>)}</View></View> : null}
    <View style={styles.inningQuickViewRow}><View style={styles.inningQuickViewCopy}><Text style={styles.inningQuickViewTitle}>局數快速檢視</Text><Text style={styles.inningQuickViewHint}>{hasSubstitutionInnings ? `本隊換人發生於 ${substitutionVisibleInnings.length} 局；僅篩選可視局欄。` : "本隊尚無正式換人資料，無可篩選局數。"}</Text></View><Pressable accessibilityRole="switch" accessibilityState={{ checked: isSubstitutionInningFilterActive, disabled: !hasSubstitutionInnings }} accessibilityLabel="僅顯示替換發生局" disabled={!hasSubstitutionInnings} onPress={() => setShowSubstitutionInningsOnly((current) => !current)} style={({ pressed }) => [styles.inningQuickViewToggle, isSubstitutionInningFilterActive && styles.inningQuickViewToggleActive, !hasSubstitutionInnings && styles.inningQuickViewToggleDisabled, pressed && hasSubstitutionInnings && styles.pressed]}><Text style={[styles.inningQuickViewToggleText, isSubstitutionInningFilterActive && styles.inningQuickViewToggleTextActive]}>僅替換局：{isSubstitutionInningFilterActive ? "開" : "關"}</Text><Text style={[styles.inningQuickViewToggleCount, isSubstitutionInningFilterActive && styles.inningQuickViewToggleTextActive]}>{hasSubstitutionInnings ? `${visibleInnings.length}/${projection.innings.length} 局` : "0 局"}</Text></Pressable></View>

    <ScrollView horizontal showsHorizontalScrollIndicator persistentScrollbar nestedScrollEnabled contentContainerStyle={styles.scrollContent}>
      <View>
        <View style={styles.headerRow}>
          <View style={styles.orderHeader}><Text style={[styles.headerText, styles.headerDefense]}>守備</Text><Text style={[styles.headerText, styles.headerBatter]}>先攻打擊</Text><Text style={[styles.headerText, styles.headerNumber]}>背號</Text><Text style={[styles.headerText, styles.headerOrder]}>打序</Text></View>
          {visibleInnings.map((inning) => <View key={inning.inning} style={[styles.inningHeader, { width: INNING_WIDTH }]}><Text style={styles.inningNumber}>{inning.inning}</Text><Text style={styles.inningSub}>局 · {inning.appearances.length} 人次</Text></View>)}
        </View>

        {projection.battingOrders.map((order) => {
          /** 參考表的單一棒次使用一組三格球員承接列；換人時增加列，但逐局打席格仍由整個棒次共用。 */
          const sharedSlotCount = Math.max(1, ...visibleInnings.map((inning) =>
            inning.appearances.filter((candidate) => candidate.battingOrder === order.battingOrder).length,
          ));
          const sharedRowHeight = sharedSlotCount * SLOT_HEIGHT;
          const displayedEntries = order.entries.slice(0, Math.max(3, order.entries.length));
          return <View key={order.battingOrder} style={styles.orderGroup}>
            <View style={[styles.sharedOrderRow, { height: sharedRowHeight }]}>
              <View style={styles.sharedEntryInfo}>
                <View style={styles.sharedEntryLane}>
                  {displayedEntries.map((entry, entryIndex) => {
                    const description = entryDescription(entry, order.battingOrder);
                    const entryMarker = getScorebookSubstitutionMarker(entry.substitution?.type);
                    const isEmptyReserve = entry.kind === "reserve" && !entry.playerId;
                    const entryRole = entry.kind === "starter" ? "先發" : entryMarker?.code ?? (entry.substitution?.type === "換投" ? "P" : "候補");
                    const entryRoleChipStyle = entryRole === "PH"
                      ? styles.sharedEntryRoleChipPH
                      : entryRole === "PR"
                        ? styles.sharedEntryRoleChipPR
                        : entryRole === "PF"
                          ? styles.sharedEntryRoleChipPF
                          : entryRole === "P"
                            ? styles.sharedEntryRoleChipP
                            : styles.sharedEntryRoleChipStarter;
                    return <View key={`${order.battingOrder}-${entry.entryIndex}-${entry.playerId ?? "reserve"}`} style={[styles.playerEntryCell, entryIndex < displayedEntries.length - 1 && styles.playerEntryCellDivider]}>
                      <Pressable onLongPress={() => onLongPressEntry?.(entry, order.battingOrder, "defense")} delayLongPress={420} accessibilityRole="button" accessibilityLabel={`長按修改第${order.battingOrder}棒第${entryIndex + 1}格守備位置`} style={({ pressed }) => [styles.sharedDefenseEditTarget, pressed && styles.pressed]}>
                        <Text style={[styles.sharedDefenseLabel, isEmptyReserve && styles.emptyEntryText]}>{isEmptyReserve ? "" : description.defensivePosition}</Text>
                      </Pressable>
                      <Pressable onLongPress={() => onLongPressEntry?.(entry, order.battingOrder, "player")} delayLongPress={420} accessibilityRole="button" accessibilityLabel={`長按修改第${order.battingOrder}棒第${entryIndex + 1}格球員`} style={({ pressed }) => [styles.sharedPlayerEditTarget, pressed && styles.pressed]}>
                        <View accessibilityLabel={isEmptyReserve ? undefined : `${entryRole} 替換角色標籤`} style={[styles.sharedEntryRoleChip, entryRoleChipStyle, isEmptyReserve && styles.sharedEntryRoleChipEmpty]}><Text style={[styles.sharedEntryRole, isEmptyReserve && styles.emptyEntryText]}>{isEmptyReserve ? "" : entryRole}</Text></View>
                        <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.sharedPlayerName, isEmptyReserve && styles.emptyEntryText]}>{isEmptyReserve ? "" : description.title.replace(/^#\S+\s*/, "")}</Text>
                        {entry.enteredInning && entry.kind === "substitute" ? <View style={styles.sharedEntryHandoff}><Text style={styles.sharedEntryHandoffLabel}>交接</Text><Text numberOfLines={1} ellipsizeMode="clip" style={styles.sharedEnteredInning}>{typeof entry.substitution?.handoffPitchNumber === "number" ? entry.substitution.handoffPitchNumber === 0 ? "打席開始" : `第${entry.substitution.handoffPitchNumber}球` : `第${entry.enteredInning}局${entry.enteredHalf ? halfLabel(entry.enteredHalf) : ""}起`}</Text></View> : null}
                      </Pressable>
                      <Text style={[styles.sharedJerseyLabel, isEmptyReserve && styles.emptyEntryText]}>{isEmptyReserve ? "" : (description.title.match(/^#(\S+)/)?.[1] ?? "—")}</Text>
                    </View>;
                  })}
                </View>
                <View style={styles.sharedOrderColumn}><Text style={styles.sharedOrderLabel}>{order.battingOrder}</Text></View>
              </View>
              {visibleInnings.map((inning) => {
                const appearances = inning.appearances.filter((candidate) => candidate.battingOrder === order.battingOrder);
                const activeEntry = [...displayedEntries].reverse().find((entry) => Boolean(entry.playerId) && (!entry.enteredInning || entry.enteredInning <= inning.inning));
                const blankReplacementMarker = activeEntry?.enteredInning === inning.inning
                  ? getScorebookSubstitutionMarker(activeEntry.substitution?.type)
                  : undefined;
                const blankReplacementBadge = blankReplacementMarker && activeEntry?.enteredInning
                  ? { ...blankReplacementMarker, inning: activeEntry.enteredInning, handoffPitchNumber: activeEntry.substitution?.handoffPitchNumber }
                  : undefined;
                return <View key={`${order.battingOrder}-${inning.inning}`} style={[styles.inningColumn, { width: INNING_WIDTH, height: sharedRowHeight }]}>
                  {appearances.map((appearance, localAppearanceIndex) => <Pressable key={appearance.eventId} accessibilityRole="button" accessibilityLabel={`查看第${inning.inning}局第${appearance.appearanceIndex + 1}席第${order.battingOrder}棒的早稻田紀錄；長按直接修改`} onPress={() => onSelectAtBatEvent(appearance.eventId)} onLongPress={() => onLongPressAtBatEvent?.(appearance.eventId)} delayLongPress={420} style={({ pressed }) => [styles.appearanceSlot, { top: localAppearanceIndex * SLOT_HEIGHT, height: SLOT_HEIGHT }, pressed && styles.pressed]}>
                    <WasedaPersonalRecordCell size="compact" event={appearance.event} showLabels={false} replacementBadge={appearance.replacementBadge} pitchingChangeBadge={appearance.pitchingChangeBadge ? { ...appearance.pitchingChangeBadge, pitcherLabel: opponentPlayerById.get(appearance.pitchingChangeBadge.pitcherId) ? `#${opponentPlayerById.get(appearance.pitchingChangeBadge.pitcherId)?.number}` : "新投手" } : undefined} />
                  </Pressable>)}
                  {appearances.length === 0 && activeEntry?.playerId ? (() => {
                    const slot: ScorebookBlankSlot = { side, battingOrder: order.battingOrder, entryIndex: activeEntry.entryIndex, inning: inning.inning, slotIndex: 0, playerId: activeEntry.playerId };
                    return <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`長按第${inning.inning}局第${order.battingOrder}棒空白打序格，正式補登紀錄`}
                      accessibilityHint="一般點擊不會開啟；長按後才會檢查半局安全鎖並開啟正式補正。"
                      onLongPress={() => onLongPressBlankSlot?.(slot)}
                      delayLongPress={420}
                      style={({ pressed }) => [styles.appearanceSlot, { height: SLOT_HEIGHT }, pressed && styles.pressed]}
                    >
                      <WasedaPersonalRecordCell
                        size="compact"
                        emptyHint="長按補登"
                        replacementBadge={blankReplacementBadge}
                        showLabels={false}
                      />
                    </Pressable>;
                  })() : null}
                </View>;
              })}
            </View>
          </View>;
        })}
      </View>
    </ScrollView>

    <View style={styles.legend}><Text style={styles.legendTitle}>閱讀與修改</Text><Text style={styles.legendText}>打序欄設於先攻打擊與背號旁；每一棒次是直向主列，左側保留三格、可隨換人擴充的球員承接欄。先發、代打 PH、代跑 PR、代守 PF 與換投 P 會依發生局接續在同一棒次；右側每一局只保留該棒次的實際打席格，避免替換球員各自生成假格。長按空白格會依「區域→符號→內容／備註→預覽確認」進入與既有修正工作台一致的正式補登流程。</Text></View>
    <View style={styles.summaryRow}>
      <View style={styles.summaryCard}><Text style={styles.summaryTitle}>打擊摘要</Text><Text style={styles.summaryText}>R {summary.runs} · H {summary.hits} · BB {summary.walks} · K {summary.strikeouts}</Text><Text style={styles.summaryText}>{batting.filter((line) => line.ab + line.bb + line.hbp + line.sh + line.sf > 0).map((line) => `#${line.player.number} ${formatAvg(line.avg)}`).join(" · ") || "尚無完成打席"}</Text></View>
      <View style={styles.summaryCard}><Text style={styles.summaryTitle}>投手摘要</Text><Text style={styles.summaryText}>{pitching.filter((line) => line.pitches > 0).map((line) => `#${line.player.number} IP ${line.ip}／${line.pitches}球`).join(" · ") || "尚無投球紀錄"}</Text></View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  sheet: { borderWidth: 1, borderRadius: 16, padding: 10, gap: 9 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  titleCopy: { flex: 1, gap: 2 },
  sideCaption: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  title: { color: "#0F172A", fontSize: 17, fontWeight: "900" },
  hint: { color: "#475569", fontSize: 10, lineHeight: 14, maxWidth: 560 },
  scoreBadge: { minWidth: 52, alignItems: "center", borderWidth: 1, borderRadius: 10, backgroundColor: "#FFFFFF", paddingHorizontal: 8, paddingVertical: 4 },
  scoreValue: { fontSize: 23, fontWeight: "900", lineHeight: 27 },
  scoreLabel: { color: "#64748B", fontSize: 8, fontWeight: "900" },
  fallbackNote: { borderWidth: 1, borderColor: "#FDE68A", backgroundColor: "#FFFBEB", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  fallbackText: { color: "#854D0E", fontSize: 9, fontWeight: "700", lineHeight: 13 },
  defenseTimelineCard: { borderWidth: 1, borderColor: "#A7F3D0", borderRadius: 8, padding: 9, gap: 5, backgroundColor: "#ECFDF5" },
  defenseTimelineTitle: { color: "#047857", fontSize: 12, fontWeight: "900" },
  defenseTimelineHint: { color: "#166534", fontSize: 10, fontWeight: "700", lineHeight: 14 },
  defenseTimelineList: { gap: 4 },
  defenseTimelineItem: { borderLeftWidth: 3, borderLeftColor: "#10B981", paddingLeft: 7 },
  defenseTimelineText: { color: "#14532D", fontSize: 10, fontWeight: "800", lineHeight: 14 },
  inningQuickViewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7, backgroundColor: "#F8FAFC" },
  inningQuickViewCopy: { flex: 1, minWidth: 0, gap: 1 },
  inningQuickViewTitle: { color: "#0F172A", fontSize: 10, fontWeight: "900" },
  inningQuickViewHint: { color: "#475569", fontSize: 8, fontWeight: "700", lineHeight: 11 },
  inningQuickViewToggle: { minWidth: 78, alignItems: "center", borderWidth: 1, borderColor: "#93C5FD", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: "#FFFFFF" },
  inningQuickViewToggleActive: { borderColor: "#1D4ED8", backgroundColor: "#DBEAFE" },
  inningQuickViewToggleDisabled: { borderColor: "#CBD5E1", backgroundColor: "#F1F5F9", opacity: 0.7 },
  inningQuickViewToggleText: { color: "#1D4ED8", fontSize: 9, fontWeight: "900" },
  inningQuickViewToggleTextActive: { color: "#1E3A8A" },
  inningQuickViewToggleCount: { color: "#64748B", fontSize: 7, fontWeight: "800" },
  scrollContent: { paddingBottom: 4 },
  headerRow: { flexDirection: "row", backgroundColor: "#0F172A", borderTopLeftRadius: 8, borderTopRightRadius: 8, overflow: "hidden" },
  orderHeader: { width: 252, minHeight: 42, flexDirection: "row", alignItems: "center", borderRightWidth: 1, borderColor: "#475569" },
  headerText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  headerDefense: { width: 30, textAlign: "center" },
  headerBatter: { flex: 1, paddingLeft: 6 },
  headerNumber: { width: 30, textAlign: "center" },
  headerOrder: { width: 30, textAlign: "center" },
  inningHeader: { minHeight: 42, alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderColor: "#475569" },
  inningNumber: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", lineHeight: 16 },
  inningSub: { color: "#CBD5E1", fontSize: 8, fontWeight: "800" },
  orderGroup: { borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 2, borderColor: "#64748B", backgroundColor: "#FFFFFF" },
  entryRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#CBD5E1" },
  entryRowStarter: { borderTopWidth: 2, borderColor: "#94A3B8" },
  /** 每棒次為一列；左側固定三格球員承接欄，右側每局共享一組實際打席格。 */
  sharedOrderRow: { flexDirection: "row", borderTopWidth: 2, borderColor: "#94A3B8" },
  sharedEntryInfo: { width: 252, flexDirection: "row", borderRightWidth: 1, borderColor: "#64748B", backgroundColor: "#F8FAFC" },
  sharedEntryLane: { flex: 1 },
  playerEntryCell: { flex: 1, minHeight: 22, flexDirection: "row", alignItems: "center" },
  playerEntryCellDivider: { borderBottomWidth: 1, borderColor: "#CBD5E1" },
  sharedDefenseEditTarget: { width: 30, alignSelf: "stretch", alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderColor: "#CBD5E1" },
  sharedDefenseLabel: { color: "#1D4ED8", fontSize: 9, fontWeight: "900", textAlign: "center" },
  sharedPlayerEditTarget: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 5, alignSelf: "stretch" },
  sharedEntryRoleChip: { width: 28, minWidth: 28, minHeight: 16, flexShrink: 0, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 4 },
  sharedEntryRoleChipStarter: { borderColor: "#BFDBFE", backgroundColor: "#EFF6FF" },
  sharedEntryRoleChipPH: { borderColor: "#C4B5FD", backgroundColor: "#F5F3FF" },
  sharedEntryRoleChipPR: { borderColor: "#6EE7B7", backgroundColor: "#ECFDF5" },
  sharedEntryRoleChipPF: { borderColor: "#FCD34D", backgroundColor: "#FFFBEB" },
  sharedEntryRoleChipP: { borderColor: "#FDBA74", backgroundColor: "#FFF7ED" },
  sharedEntryRoleChipEmpty: { borderColor: "transparent", backgroundColor: "transparent" },
  sharedEntryRole: { color: "#1D4ED8", fontSize: 8, fontWeight: "900", textAlign: "center" },
  sharedPlayerName: { flex: 1, flexShrink: 1, minWidth: 0, color: "#0F172A", fontSize: 11, fontWeight: "900", lineHeight: 13 },
  sharedEntryHandoff: { width: 44, flexShrink: 0, alignItems: "flex-end", gap: 0 },
  sharedEntryHandoffLabel: { color: "#0369A1", fontSize: 6, fontWeight: "900", lineHeight: 7 },
  sharedEnteredInning: { color: "#64748B", fontSize: 7, fontWeight: "800", lineHeight: 8 },
  sharedJerseyLabel: { width: 30, color: "#1D4ED8", fontSize: 10, fontWeight: "900", textAlign: "center" },
  sharedOrderColumn: { width: 30, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderColor: "#64748B" },
  sharedOrderLabel: { color: "#0F172A", fontSize: 11, fontWeight: "900", textAlign: "center" },
  emptyEntryText: { color: "transparent" },
  entryInfo: { width: 236, flexDirection: "row", alignItems: "flex-start", borderRightWidth: 1, borderColor: "#CBD5E1", backgroundColor: "#F8FAFC", paddingVertical: 3 },
  compactReserveEntryInfo: { alignItems: "center", paddingVertical: 0 },
  defenseEditTarget: { width: 30, alignSelf: "stretch", justifyContent: "flex-start" },
  defenseLabel: { width: 30, color: "#1D4ED8", fontSize: 9, fontWeight: "900", paddingTop: 3, textAlign: "center" },
  orderLabel: { width: 30, color: "#0F172A", fontSize: 10, fontWeight: "900", paddingTop: 3, textAlign: "center" },
  reserveOrderLabel: { color: "#475569" },
  entryCopy: { flex: 1, gap: 1, paddingHorizontal: 4 },
  compactReserveEntryCopy: { justifyContent: "center" },
  jerseyLabel: { width: 34, color: "#1D4ED8", fontSize: 9, fontWeight: "900", paddingTop: 3, textAlign: "center" },
  entryEditTarget: { alignSelf: "stretch", borderRadius: 3, paddingHorizontal: 2, paddingVertical: 0 },
  compactReserveEntryEditTarget: { alignSelf: "auto" },
  playerName: { color: "#0F172A", fontSize: 11, fontWeight: "900" },
  reserveName: { color: "#94A3B8", fontSize: 10, fontWeight: "800" },
  compactReserveName: { color: "#64748B", fontSize: 9, fontWeight: "900", lineHeight: 12 },
  playerDetail: { color: "#64748B", fontSize: 8, lineHeight: 11 },
  inningColumn: { position: "relative", borderRightWidth: 1, borderColor: "#CBD5E1", backgroundColor: "#FFFFFF" },
  /** 每格直接使用 WasedaPersonalRecordCell 自身紙本邊框，避免出現雙框與框外空白。 */
  appearanceSlot: { position: "absolute", left: 0, right: 0, backgroundColor: "transparent", overflow: "hidden" },
  blankSlot: { position: "absolute", left: 0, right: 0, alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1, borderStyle: "dashed", borderColor: "#94A3B8", backgroundColor: "#F8FAFC" },
  blankReplacementBadge: { position: "absolute", top: 5, alignSelf: "center", alignItems: "center", borderWidth: 1, borderColor: "#7DD3FC", borderRadius: 5, paddingHorizontal: 4, paddingVertical: 1, backgroundColor: "#F0F9FF" },
  blankReplacementBadgeCode: { color: "#0369A1", fontSize: 7, fontWeight: "900", lineHeight: 8 },
  blankReplacementBadgeText: { color: "#075985", fontSize: 7, fontWeight: "900" },
  blankSlotTitle: { color: "#475569", fontSize: 10, fontWeight: "900" },
  blankSlotHint: { color: "#94A3B8", fontSize: 8, fontWeight: "800" },
  pressed: { opacity: 0.68, transform: [{ scale: 0.985 }] },
  legend: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 8, paddingVertical: 7, borderRadius: 8, backgroundColor: "#F8FAFC" },
  legendTitle: { color: "#0F172A", fontSize: 9, fontWeight: "900" },
  legendText: { flex: 1, color: "#475569", fontSize: 9, lineHeight: 13 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  summaryCard: { flexGrow: 1, flexBasis: 250, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: "#FFFFFF", borderRadius: 9, padding: 8, gap: 3 },
  summaryTitle: { color: "#0F172A", fontSize: 10, fontWeight: "900" },
  summaryText: { color: "#475569", fontSize: 9, lineHeight: 13 },
});
