import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { WasedaPersonalRecordCell } from "./waseda-personal-record-cell";
import { calculateWasedaMatrixStats, createWasedaScorebookProjection, getDetailedCatcherStats, getDetailedPitcherStats, getScorebookDisplayOverrideKey, getScorebookSubstitutionMarker, type WasedaMatrixStats, type WasedaScorebookEntry } from "@/lib/baseball/waseda-scorebook-projection";
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

/** 緊湊打席格依紙本參考採 92×70，逐局欄與單一紙本格同寬，不保留粗框外側空白。先發 1–9 棒為直向主列；每棒次固定預留三格球員承接欄。單一棒次使用一組三格球員承接列；換人時增加列，但逐局打席格仍由整個棒次共用。支援「僅替換局：」與「守備轉換時間線」顯示。 */
const SLOT_HEIGHT = 70;
const INNING_WIDTH = 92;
/** 未登場候補只作為可擴充的保留列，不應佔用一個完整打席格高度。 */
const RESERVE_ROW_HEIGHT = 30;

const halfLabel = (half: TeamSide) => half === "away" ? "上" : "下";

export function WasedaScorebookTeamSheet({ game, team, opponentTeam, side, onSelectAtBatEvent, onLongPressAtBatEvent, onLongPressEntry, onLongPressBlankSlot }: WasedaScorebookTeamSheetProps) {
  const [showSubstitutionInningsOnly, setShowSubstitutionInningsOnly] = useState(false);
  const lineup = side === "away" ? game.awayLineup : game.homeLineup;

  // 中央矩陣動態局數顯示 (裁切/增列)：呈現至最後實際結束或上限局數
  const calculatedInningCount = useMemo(() => {
    return Math.max(
      game.maxInnings || 6,
      game.inning,
      game.score.length,
      ...game.events.map((e) => e.inning),
      1
    );
  }, [game.events, game.inning, game.maxInnings, game.score.length]);

  const projection = useMemo(() => createWasedaScorebookProjection({
    team,
    side,
    lineup,
    events: game.events,
    substitutions: game.substitutions,
    inningCount: calculatedInningCount,
  }), [calculatedInningCount, game.awayLineup, game.events, game.homeLineup, game.substitutions, lineup, side, team]);
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
    {/* 僅保留主客場名稱與隊伍底色 */}
    <View style={[styles.cleanTeamHeaderRow, { backgroundColor: surface, borderColor: accent }]}>
      <Text style={[styles.cleanTeamHeaderSide, { color: accent }]}>{side === "away" ? "客場(先攻)" : "主場(先守)"}</Text>
      <Text style={[styles.cleanTeamHeaderName, { color: accent }]}>{team.name}</Text>
    </View>

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
                  {appearances.map((appearance, localAppearanceIndex) => {
                    const handleLongPress = () => {
                      // a-1、該局結束前，不得修改該局內容，但可以任意修改其他完成的局數內容。
                      // a-2、該場比賽結束後，可以任意更改內容，不受任何系統防呆限制。
                      if (game.status !== "final" && inning.inning === game.inning) {
                        Alert.alert("進行中局數鎖定", "該局尚未結束，不得修改進行中局數內容；請於該局結束後或賽後修改，或於現場記錄修改最新一球。");
                        return;
                      }
                      onLongPressAtBatEvent?.(appearance.eventId);
                    };

                    return <Pressable
                      key={appearance.eventId}
                      accessibilityRole="button"
                      accessibilityLabel={`查看第${inning.inning}局第${appearance.appearanceIndex + 1}席第${order.battingOrder}棒的早稻田紀錄；長按直接修改`}
                      onPress={() => onSelectAtBatEvent(appearance.eventId)}
                      onLongPress={handleLongPress}
                      delayLongPress={420}
                      style={({ pressed }) => [styles.appearanceSlot, { top: localAppearanceIndex * SLOT_HEIGHT, height: SLOT_HEIGHT }, pressed && styles.pressed]}
                    >
                      <WasedaPersonalRecordCell size="compact" event={appearance.event} showLabels={false} replacementBadge={appearance.replacementBadge} pitchingChangeBadge={appearance.pitchingChangeBadge ? { ...appearance.pitchingChangeBadge, pitcherLabel: opponentPlayerById.get(appearance.pitchingChangeBadge.pitcherId) ? `#${opponentPlayerById.get(appearance.pitchingChangeBadge.pitcherId)?.number}` : "新投手" } : undefined} />
                    </Pressable>;
                  })}
                  {appearances.length === 0 && activeEntry?.playerId ? (() => {
                    const slot: ScorebookBlankSlot = { side, battingOrder: order.battingOrder, entryIndex: activeEntry.entryIndex, inning: inning.inning, slotIndex: 0, playerId: activeEntry.playerId };
                    const handleLongPressBlank = () => {
                      if (game.status !== "final" && inning.inning === game.inning) {
                        Alert.alert("進行中局數鎖定", "該局尚未結束，不得補登進行中局數內容；請於現場記錄輸入，或待該局結束後再行補登。");
                        return;
                      }
                      onLongPressBlankSlot?.(slot);
                    };

                    return <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`長按第${inning.inning}局第${order.battingOrder}棒空白打序格，正式補登紀錄`}
                      accessibilityHint="一般點擊不會開啟；長按後才會檢查半局安全鎖並開啟正式補正。"
                      onLongPress={handleLongPressBlank}
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

        {/* C3 統計資料列：合計欄位寬度與打序(30)完全一致並對齊，後方依序展開統計項目 */}
        <WasedaMatrixStatsRow stats={calculateWasedaMatrixStats(game, side)} />
      </View>
    </ScrollView>

    <View style={styles.legend}>
      <Text style={styles.legendTitle}>閱讀與修改</Text>
      <Text style={styles.legendText}>長按空白格會依「區域→符號→內容／備註→預覽確認」進入正式補登；未完賽前進行中局數禁止修改，完賽後開放任意編輯。</Text>
    </View>
  </View>;
}

export function WasedaMatrixStatsRow({ stats }: { stats: WasedaMatrixStats }) {
  const statItems = [
    { key: "hits", label: "安打", value: stats.hits },
    { key: "walks", label: "四壞球", value: stats.walks },
    { key: "hbp", label: "觸身球", value: stats.hbp },
    { key: "strikeouts", label: "三振", value: stats.strikeouts },
    { key: "doublePlays", label: "雙殺打", value: stats.doublePlays },
    { key: "sacrifices", label: "犧牲打", value: stats.sacrifices },
    { key: "stolenBases", label: "盜壘成功", value: stats.stolenBases },
    { key: "caughtStealing", label: "盜壘失敗", value: stats.caughtStealing },
    { key: "opponentErrors", label: "失誤", value: stats.opponentErrors, note: "對手矩陣" },
  ];

  return (
    <View style={styles.statsRowWrapper}>
      <View style={styles.statsLeftContainer}>
        <View style={styles.statsLabelLead}>
          <Text style={styles.statsLabelLeadText}>早稻田矩陣統計</Text>
        </View>
        {/* 第一個欄位標題固定為「合計」，寬度為 30，與上方 C2 打序欄位完全對齊 */}
        <View style={styles.statsTotalTitleCell}>
          <Text style={styles.statsTotalTitleText}>合計</Text>
        </View>
      </View>
      <View style={styles.statsItemsContainer}>
        {statItems.map((item) => (
          <View key={item.key} style={styles.statColumnCell}>
            <Text style={styles.statColumnLabel}>
              {item.label}
              {item.note ? <Text style={styles.statColumnNote}>*</Text> : null}
            </Text>
            <Text style={styles.statColumnValue}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function PitcherCatcherBottomPanel({ game, team, side }: { game: any; team: Team; side: TeamSide }) {
  const pitcherStats = useMemo(() => getDetailedPitcherStats(game, team, side), [game, team, side]);
  const catcherStats = useMemo(() => getDetailedCatcherStats(game, team, side), [game, team, side]);

  const padRows = <T,>(items: T[], minCount: number) => {
    const list = [...items];
    while (list.length < minCount) {
      list.push(null as any);
    }
    return list;
  };

  const paddedPitchers = padRows(pitcherStats, 5);
  const paddedCatchers = padRows(catcherStats, 5);

  return (
    <View style={styles.bottomSplitWrapper}>
      {/* 底部左側：投手資訊 (直列 5+) */}
      <View style={styles.bottomPitcherSection}>
        <View style={styles.bottomSectionHeader}>
          <Text style={styles.bottomSectionTitle}>投手數據 (Pitchers) · {team.name}</Text>
          <Text style={styles.bottomSectionSub}>逐球自動同步統計</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator persistentScrollbar>
          <View>
            <View style={styles.pitcherHeaderRow}>
              <Text style={[styles.pCol, styles.pColJersey, styles.tableHeaderText]}>背號</Text>
              <Text style={[styles.pCol, styles.pColName, styles.tableHeaderText]}>姓名</Text>
              <Text style={[styles.pCol, styles.pColHand, styles.tableHeaderText]}>慣用</Text>
              <Text style={[styles.pCol, styles.pColStat, styles.tableHeaderText]}>總球數</Text>
              <Text style={[styles.pCol, styles.pColStat, styles.tableHeaderText]}>好球</Text>
              <Text style={[styles.pCol, styles.pColStat, styles.tableHeaderText]}>被安打</Text>
              <Text style={[styles.pCol, styles.pColStat, styles.tableHeaderText]}>HR</Text>
              <Text style={[styles.pCol, styles.pColStat, styles.tableHeaderText]}>BB</Text>
              <Text style={[styles.pCol, styles.pColStat, styles.tableHeaderText]}>HBP</Text>
              <Text style={[styles.pCol, styles.pColStat, styles.tableHeaderText]}>K</Text>
              <Text style={[styles.pCol, styles.pColStat, styles.tableHeaderText]}>WP</Text>
              <Text style={[styles.pCol, styles.pColStat, styles.tableHeaderText]}>R</Text>
              <Text style={[styles.pCol, styles.pColStat, styles.tableHeaderText]}>ER</Text>
            </View>
            {paddedPitchers.map((p, idx) => (
              <View key={p ? p.playerId : `p-pad-${idx}`} style={[styles.tableDataRow, idx % 2 === 1 && styles.tableRowAlt]}>
                <Text style={[styles.pCol, styles.pColJersey, styles.pColJerseyText]}>{p ? `#${p.number}` : "—"}</Text>
                <Text numberOfLines={1} style={[styles.pCol, styles.pColName, styles.tableDataText]}>
                  {p ? p.name : "—"}
                  {p?.isStarter ? <Text style={styles.starterTag}> (先發)</Text> : null}
                </Text>
                <Text style={[styles.pCol, styles.pColHand, styles.tableDataText]}>{p ? `${p.throwingHand}投` : "—"}</Text>
                <Text style={[styles.pCol, styles.pColStat, styles.tableDataStatHighlight]}>{p ? p.totalPitches : "—"}</Text>
                <Text style={[styles.pCol, styles.pColStat, styles.tableDataText]}>{p ? p.strikes : "—"}</Text>
                <Text style={[styles.pCol, styles.pColStat, styles.tableDataText]}>{p ? p.hits : "—"}</Text>
                <Text style={[styles.pCol, styles.pColStat, styles.tableDataText]}>{p ? p.hr : "—"}</Text>
                <Text style={[styles.pCol, styles.pColStat, styles.tableDataText]}>{p ? p.walks : "—"}</Text>
                <Text style={[styles.pCol, styles.pColStat, styles.tableDataText]}>{p ? p.hbp : "—"}</Text>
                <Text style={[styles.pCol, styles.pColStat, styles.tableDataText]}>{p ? p.strikeouts : "—"}</Text>
                <Text style={[styles.pCol, styles.pColStat, styles.tableDataText]}>{p ? p.wp : "—"}</Text>
                <Text style={[styles.pCol, styles.pColStat, styles.tableDataText]}>{p ? p.runs : "—"}</Text>
                <Text style={[styles.pCol, styles.pColStat, styles.tableDataText]}>{p ? p.er : "—"}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* 底部右側：捕手資訊 (直列 5+) */}
      <View style={styles.bottomCatcherSection}>
        <View style={styles.bottomSectionHeader}>
          <Text style={styles.bottomSectionTitle}>捕手數據 (Catchers) · {team.name}</Text>
          <Text style={styles.bottomSectionSub}>自動防守數據</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator persistentScrollbar>
          <View>
            <View style={styles.catcherHeaderRow}>
              <Text style={[styles.cCol, styles.cColJersey, styles.tableHeaderText]}>背號</Text>
              <Text style={[styles.cCol, styles.cColName, styles.tableHeaderText]}>名稱</Text>
              <Text style={[styles.cCol, styles.cColHand, styles.tableHeaderText]}>慣用</Text>
              <Text style={[styles.cCol, styles.cColStat, styles.tableHeaderText]}>捕逸(PB)</Text>
              <Text style={[styles.cCol, styles.cColStat, styles.tableHeaderText]}>被盜(SB)</Text>
              <Text style={[styles.cCol, styles.cColStat, styles.tableHeaderText]}>阻殺(CS)</Text>
            </View>
            {paddedCatchers.map((c, idx) => (
              <View key={c ? c.playerId : `c-pad-${idx}`} style={[styles.tableDataRow, idx % 2 === 1 && styles.tableRowAlt]}>
                <Text style={[styles.cCol, styles.cColJersey, styles.cColJerseyText]}>{c ? `#${c.number}` : "—"}</Text>
                <Text numberOfLines={1} style={[styles.cCol, styles.cColName, styles.tableDataText]}>
                  {c ? c.name : "—"}
                  {c?.isStarter ? <Text style={styles.starterTag}> (先發)</Text> : null}
                </Text>
                <Text style={[styles.cCol, styles.cColHand, styles.tableDataText]}>{c ? `${c.throwingHand}投` : "—"}</Text>
                <Text style={[styles.cCol, styles.cColStat, styles.tableDataText]}>{c ? c.pb : "—"}</Text>
                <Text style={[styles.cCol, styles.cColStat, styles.tableDataText]}>{c ? c.stolenBases : "—"}</Text>
                <Text style={[styles.cCol, styles.cColStat, styles.tableDataText]}>{c ? c.caughtStealing : "—"}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { borderWidth: 1, borderRadius: 16, padding: 10, gap: 9 },
  cleanTeamHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderLeftWidth: 4, marginBottom: 4 },
  cleanTeamHeaderSide: { fontSize: 11, fontWeight: "900" },
  cleanTeamHeaderName: { fontSize: 16, fontWeight: "900" },
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
  bottomSplitWrapper: { flexDirection: "row", gap: 12, width: "100%", alignItems: "stretch" },
  bottomPitcherSection: { flex: 1.6, width: "100%", minWidth: 320, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, padding: 10, gap: 6 },
  bottomCatcherSection: { flex: 1, width: "100%", minWidth: 240, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 12, padding: 10, gap: 6 },
  bottomSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  bottomSectionTitle: { color: "#0F172A", fontSize: 11, fontWeight: "900" },
  bottomSectionSub: { color: "#64748B", fontSize: 9, fontWeight: "800" },
  pitcherHeaderRow: { flexDirection: "row", backgroundColor: "#1E293B", borderTopLeftRadius: 6, borderTopRightRadius: 6, overflow: "hidden" },
  catcherHeaderRow: { flexDirection: "row", backgroundColor: "#0F172A", borderTopLeftRadius: 6, borderTopRightRadius: 6, overflow: "hidden" },
  tableHeaderText: { color: "#FFFFFF", fontSize: 9, fontWeight: "900", textAlign: "center", paddingVertical: 5 },
  tableDataRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#E2E8F0", alignItems: "center", minHeight: 28 },
  tableRowAlt: { backgroundColor: "#F8FAFC" },
  tableDataText: { fontSize: 10, fontWeight: "800", color: "#0F172A", textAlign: "center" },
  tableDataStatHighlight: { fontSize: 10, fontWeight: "900", color: "#1D4ED8", textAlign: "center" },
  pCol: { paddingHorizontal: 3 },
  pColJersey: { width: 38, textAlign: "center" },
  pColJerseyText: { fontSize: 9, fontWeight: "900", color: "#1D4ED8", textAlign: "center" },
  pColName: { width: 92, textAlign: "left", paddingLeft: 4 },
  pColHand: { width: 38, textAlign: "center" },
  pColStat: { width: 44, textAlign: "center" },
  cCol: { paddingHorizontal: 3 },
  cColJersey: { width: 38, textAlign: "center" },
  cColJerseyText: { fontSize: 9, fontWeight: "900", color: "#1D4ED8", textAlign: "center" },
  cColName: { width: 92, textAlign: "left", paddingLeft: 4 },
  cColHand: { width: 38, textAlign: "center" },
  cColStat: { width: 62, textAlign: "center" },
  starterTag: { color: "#2563EB", fontSize: 8, fontWeight: "900" },
  statsRowWrapper: { flexDirection: "row", backgroundColor: "#0F172A", borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 2, borderColor: "#64748B", alignItems: "stretch", minHeight: 40 },
  statsLeftContainer: { width: 252, flexDirection: "row", borderRightWidth: 1, borderColor: "#475569", backgroundColor: "#1E293B" },
  statsLabelLead: { width: 222, paddingHorizontal: 8, justifyContent: "center" },
  statsLabelLeadText: { color: "#94A3B8", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  statsTotalTitleCell: { width: 30, alignItems: "center", justifyContent: "center", borderLeftWidth: 1, borderColor: "#475569", backgroundColor: "#0F172A" },
  statsTotalTitleText: { color: "#38BDF8", fontSize: 10, fontWeight: "900", textAlign: "center" },
  statsItemsContainer: { flexDirection: "row", alignItems: "center" },
  statColumnCell: { width: 72, minHeight: 40, alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderColor: "#334155", paddingHorizontal: 4, paddingVertical: 4 },
  statColumnLabel: { color: "#94A3B8", fontSize: 9, fontWeight: "800", textAlign: "center" },
  statColumnNote: { color: "#F59E0B", fontSize: 8, fontWeight: "900" },
  statColumnValue: { color: "#FFFFFF", fontSize: 13, fontWeight: "900", marginTop: 2, textAlign: "center" },
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
