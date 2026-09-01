import { useState } from "react";
import { Modal, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useRouter } from "expo-router";

import {
  type AtBatEvent,
  type AtBatResult,
  type PitchState,
  type RecordColumn,
  type RecordTrajectory,
  getWasedaPitchMark,
} from "@/lib/baseball/types";
import { getHitAdvanceSegments, getRunnerAdvanceLines, splitPitchMarksForVerticalGrid, type HitAdvanceSegment, type RunnerAdvanceContext } from "@/lib/baseball/waseda-visuals";
import { getFieldingSequenceNotation, getRecordTrajectoryMark } from "@/lib/baseball/record-column-notation";
import { getFieldingNotationDisplay } from "@/lib/baseball/fielding-notation-display";
import { getFieldingNotationFontMetrics } from "@/lib/baseball/fielding-notation-font-scale";
import { useFieldingNotationPreferences } from "@/lib/fielding-notation-preferences";
import type { ScorebookPitchingChangeBadge, ScorebookSubstitutionBadge } from "@/lib/baseball/waseda-scorebook-projection";

const COLORS = {
  ink: "#10243E",
  muted: "#6A7A8F",
  line: "#C8D4E1",
  paper: "#F7FAFD",
  blue: "#1D5FA7",
  red: "#C83B44",
  white: "#FFFFFF",
};

const HIT_RESULTS: AtBatResult[] = ["1B", "2B", "3B", "HR"];
const OUT_RESULTS: AtBatResult[] = ["K", "F", "G"];
/**
 * 緊湊紙本比例的打席格，所有符號必須先保留在自身分區內，再縮小文字；
 * 0.35 讓 6pt 標記可在必要時縮至 2.1pt，避免 Android 橫式欄位外溢。
 */
const SCOREBOOK_GLYPH_MINIMUM_FONT_SCALE = 0.35;
const scorebookGlyphFitProps = {
  adjustsFontSizeToFit: true,
  minimumFontScale: SCOREBOOK_GLYPH_MINIMUM_FONT_SCALE,
} as const;

const POSITION_NAME_TO_SCOREBOOK_NUMBER: Array<[RegExp, string]> = [
  [/投手/g, "1"],
  [/捕手/g, "2"],
  [/一壘(?:手)?/g, "3"],
  [/二壘(?:手)?/g, "4"],
  [/三壘(?:手)?/g, "5"],
  [/游擊(?:手)?/g, "6"],
  [/左外(?:野手?)?/g, "7"],
  [/中外(?:野手?)?/g, "8"],
  [/右外(?:野手?)?/g, "9"],
];

/** 將球性、方向與傳接轉為打席格專用的早稻田簡記，不改寫原始事件內容。 */
function getCompactScorebookRoute(value: string) {
  let compact = value.trim();
  POSITION_NAME_TO_SCOREBOOK_NUMBER.forEach(([pattern, number]) => {
    compact = compact.replace(pattern, number);
  });
  return compact
    .replace(/(?:方向|後穿向|穿向|滾地球|高飛球|飛球|平飛球|ground|fly|line|GO|FO)/gi, "")
    .replace(/(\d)B\b/g, "$1")
    .replace(/[ー―–—]/g, "-")
    .replace(/\s+/g, "");
}

function getCompactBattedBallNotation(
  mark: { type: string; position: string },
  fieldingNotation: string,
) {
  const trajectory = mark.type === "GO" ? "＿" : mark.type === "FO" ? "⌒" : mark.type;
  const route = getCompactScorebookRoute(fieldingNotation || mark.position);
  return `${trajectory}${route}`;
}

export type WasedaPersonalRecordCellProps = {
  /** 已完成打席可直接傳入 event；即時打席則以其他欄位傳入草稿。 */
  event?: AtBatEvent;
  pitchState?: PitchState;
  pitchMarks?: string;
  result?: AtBatResult;
  recordColumn?: RecordColumn;
  notation?: string;
  runnerNotation?: string;
  innerMark?: string;
  runsScored?: number;
  outsBefore?: number;
  label?: string;
  note?: string;
  /** 新打者草稿尚未輸入任何逐球或結果時，在紀錄欄中央顯示的淡色提示。 */
  emptyHint?: string;
  /** 結構化跑壘事件，用於繪製藍色進壘線與盜壘箭頭。 */
  runnerAdvance?: RunnerAdvanceContext;
  /** 替換發生局的純顯示徽記；不得併入 E／FO／GO 或右下傳接字串。 */
  replacementBadge?: ScorebookSubstitutionBadge;
  /** 換投後新投手面對第一位打者的純顯示徽記；只反映正式換投與 pitcherId。 */
  pitchingChangeBadge?: ScorebookPitchingChangeBadge & { pitcherLabel?: string };
  size?: "large" | "regular" | "compact" | "live" | "rail";
  showLabels?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * 早稻田式個人紀錄欄。
 *
 * 每一格保持三個不可省略區域：左側球數欄、中央內圈菱形、外圈四分區。
 * `event` 與即時草稿皆可驅動同一格，避免現場、逐局與單場總表產生不同記法。
 */
export function WasedaPersonalRecordCell({
  event,
  pitchState,
  pitchMarks,
  result,
  recordColumn,
  notation,
  runnerNotation,
  innerMark: innerMarkOverride,
  runsScored,
  outsBefore,
  label,
  note,
  emptyHint,
  runnerAdvance,
  replacementBadge,
  pitchingChangeBadge,
  size = "regular",
  showLabels = false,
  style,
}: WasedaPersonalRecordCellProps) {
  const router = useRouter();
  const [isFieldingNotationOpen, setIsFieldingNotationOpen] = useState(false);
  const { fontSize: fieldingNotationFontSize } = useFieldingNotationPreferences();
  const finalResult = result ?? event?.result;
  const finalRecord = recordColumn ?? event?.recordColumn;
  const finalNotation = notation ?? event?.notation ?? "";
  const finalRuns = runsScored ?? event?.runsScored ?? 0;
  const finalOutsBefore = outsBefore ?? event?.outsBefore;
  const correction = event?.recordCorrection;
  const marks = pitchMarks ?? correction?.pitchMarks ?? (pitchState ?? event?.pitches)?.locations?.map((pitch) => getWasedaPitchMark(pitch.outcome)).join("") ?? "";
  const pitchMarkItems = splitPitchMarksForVerticalGrid(marks).flat();
  /** 精確交接只接受正式換人資料；舊資料沒有欄位時，絕不從完成打席球數推測第 N 球。 */
  const replacementHandoffPitchNumber = typeof replacementBadge?.handoffPitchNumber === "number"
    && Number.isInteger(replacementBadge.handoffPitchNumber)
    && replacementBadge.handoffPitchNumber >= 0
    ? replacementBadge.handoffPitchNumber
    : undefined;
  const replacementHandoffLabel = typeof replacementHandoffPitchNumber === "number"
    ? replacementHandoffPitchNumber === 0 ? "打席開始交接" : `第 ${replacementHandoffPitchNumber} 球交接`
    : undefined;
  /** 僅供舊資料參考本席總球數，並明確不等同於精確交接球序。 */
  const replacementPitchTotal = replacementBadge && typeof replacementHandoffPitchNumber !== "number"
    ? event?.pitches?.total ?? pitchState?.total ?? (pitchMarkItems.length ? pitchMarkItems.length : undefined)
    : undefined;
  const hit = finalResult ? HIT_RESULTS.includes(finalResult) : false;
  const modifiers = finalRecord?.modifiers ?? [];
  const droppedThirdStrike = finalResult === "K" && Boolean(
    event?.droppedThirdStrike || modifiers.some((modifier) => /不死三振|dropped\s*third|K\+/i.test(modifier)),
  );
  const out = finalResult ? OUT_RESULTS.includes(finalResult) && !droppedThirdStrike : false;
  const runnerAdvances = event?.runnerAdvances ?? [];
  const caughtStealing = runnerAdvances.find((advance) => advance.type === "CS");
  const leftOnBase = runnerAdvances.some((advance) => advance.type === "LOB");
  const headingNote = [note, correction?.otherMark].filter(Boolean).join(" · ");
  const runnerOutNotation = caughtStealing ? `CS·${["I", "II", "III"][(caughtStealing.outNumber ?? 1) - 1]}` : undefined;
  const onBaseMarks = [
    finalResult === "BB" ? "BB" : null,
    finalResult === "HBP" ? "HBP" : null,
    finalResult === "K" ? (droppedThirdStrike ? "K+" : "K") : null,
    finalResult === "E" ? "E" : null,
    runnerNotation && /\b(?:WP|PB|BK)\b/.test(runnerNotation) ? runnerNotation : null,
  ].filter(Boolean).join("·");
  const leftTop = [hit ? finalResult : null].filter(Boolean).join("·");
  const battedBallTrajectory = getRecordTrajectoryMark(finalRecord?.trajectory);
  const battedBallPosition = finalRecord?.battedBallPosition ?? (battedBallTrajectory ? finalNotation.match(/[1-9]/)?.[0] : undefined);
  /** 球性、方向與守備傳接固定在右下分區，由上而下堆疊，避免擠壓中央菱形。 */
  const outerMarks = correction?.outerMarks;
  const correctedBattedBallParts = outerMarks?.battedBallTop?.trim().split(/\s+/).filter(Boolean) ?? [];
  const correctedBattedBallOuterMark = correctedBattedBallParts.length
    ? { type: correctedBattedBallParts[0], position: correctedBattedBallParts.slice(1).join(" ") }
    : undefined;
  const formalBattedBallOuterMark = finalResult === "G"
    ? { type: "GO", position: battedBallPosition ?? "" }
    : finalResult === "F"
      ? { type: "FO", position: battedBallPosition ?? "" }
      : battedBallTrajectory && battedBallPosition
        ? { type: battedBallTrajectory, position: battedBallPosition }
        : undefined;
  const battedBallOuterMark = correctedBattedBallOuterMark ?? formalBattedBallOuterMark;
  const lowerRight = finalRecord && finalResult
    ? getFieldingSequenceNotation(finalResult, finalRecord)
    : finalRecord?.fieldingSequence || (!battedBallTrajectory && !hit && !onBaseMarks && !runnerNotation ? finalNotation : "");
  const allowedInnerMarks = new Set(["—", "○", "Ⅰ", "Ⅱ", "Ⅲ", "I", "II", "III", "ℓ", "CS", "ꓘ"]);
  const requestedInnerMark = innerMarkOverride ?? correction?.innerMark;
  const safeInnerOverride = requestedInnerMark && allowedInnerMarks.has(requestedInnerMark) ? requestedInnerMark : undefined;
  /**
   * 早稻田菱形中央只記得分、出局、殘壘、CS 或不死三振；
   * 安打種類保留在外圈與紅色壘線，絕不寫入中央。
   */
  const innerMark = safeInnerOverride
    ?? (runnerOutNotation ?? (leftOnBase ? "ℓ" : (droppedThirdStrike ? "ꓘ" : (out && typeof finalOutsBefore === "number" ? ["I", "II", "III"][Math.min(finalOutsBefore, 2)] : (finalRuns > 0 ? "○" : "—")))));
  const rbi = Math.max(0, Math.min(finalRecord?.rbi ?? 0, 4));
  const liveSize = size === "live";
  const compactSize = size === "compact";
  const largeSize = size === "large";
  const sizeStyle = largeSize ? styles.large : compactSize ? styles.compact : liveSize ? styles.live : size === "rail" ? styles.rail : styles.regular;
  const hitAdvanceSegments = getHitAdvanceSegments(finalResult);
  const syncedRunnerAdvances = runnerAdvances
    .filter((advance): advance is typeof advance & { fromBase: 1 | 2 | 3; toBase: 2 | 3 | 4 } => Boolean(advance.fromBase && advance.toBase))
    .map((advance) => ({ type: advance.type, fromBase: advance.fromBase, toBase: advance.toBase }));
  /** 保送、不死三振、觸身與失誤上壘均須走外框交點，不能誤用菱形內的跑壘線。 */
  const batterReachesFirst = finalResult === "BB" || finalResult === "HBP" || finalResult === "E" || droppedThirdStrike;
  const mergedRunnerAdvances: RunnerAdvanceContext[] = [...syncedRunnerAdvances];
  if (runnerAdvance && runnerAdvance.fromBase !== undefined && runnerAdvance.toBase !== undefined) {
    const existingIndex = mergedRunnerAdvances.findIndex(
      (adv) => adv.fromBase === runnerAdvance.fromBase && adv.toBase === runnerAdvance.toBase,
    );
    if (existingIndex >= 0) {
      if (runnerAdvance.type) {
        mergedRunnerAdvances[existingIndex] = {
          ...mergedRunnerAdvances[existingIndex],
          type: runnerAdvance.type,
        };
      }
    } else {
      mergedRunnerAdvances.push(runnerAdvance);
    }
  }
  const runnerAdvanceContexts = mergedRunnerAdvances
    .filter((advance) => !(batterReachesFirst && advance.fromBase === 0 && advance.toBase === 1));
  /** 打者上一壘獨立保留，避免被其他跑者進壘紀錄覆蓋或誤繪為菱形內線。 */
  const batterFirstBaseLines = batterReachesFirst
    ? getRunnerAdvanceLines({ result: finalResult, modifiers })
    : [];
  const runnerAdvanceLines = runnerAdvanceContexts
    .flatMap((advance) => getRunnerAdvanceLines({ result: finalResult, modifiers, runnerAdvance: advance }));
  const hasRecordDraft = Boolean(
    finalRecord?.trajectory
    || finalRecord?.battedBallPosition
    || finalRecord?.fieldingSequence
    || finalRecord?.fieldingPlay
    || (finalRecord?.modifiers?.length ?? 0) > 0
    || finalRecord?.rbi,
  );
  const showEmptyHint = Boolean(emptyHint && !event && !marks && !finalResult && !finalNotation && !runnerNotation && !hasRecordDraft && runnerAdvanceLines.length === 0);
  const hasStructuredOuterCorrection = Boolean(
    outerMarks?.leftTop || outerMarks?.rightTop || outerMarks?.leftBottom || outerMarks?.battedBallTop || outerMarks?.rightBottom,
  );
  const displayedFieldingNotation = outerMarks?.rightBottom ?? lowerRight;
  const fieldingCharacterLimit = size === "compact" || liveSize ? 5 : size === "large" ? 16 : size === "rail" ? 11 : 12;
  const fieldingLineLimit = size === "compact" || liveSize ? 2 : 3;
  const fieldingDisplay = getFieldingNotationDisplay(displayedFieldingNotation, fieldingCharacterLimit, fieldingLineLimit);
  const fieldingModalDisplay = getFieldingNotationDisplay(displayedFieldingNotation, 24, 24);
  const fieldingModalFontMetrics = getFieldingNotationFontMetrics(fieldingNotationFontSize);
  /** 例如「投手方向滾地球後穿向 1B」只顯示為「＿1-3」，完整原始傳接仍可點擊查看。 */
  const compactBattedBallNotation = battedBallOuterMark
    ? getCompactBattedBallNotation(battedBallOuterMark, displayedFieldingNotation)
    : undefined;

  return (
    <View style={[styles.wrap, sizeStyle, style]}>
      {label ? <View style={styles.heading}><Text numberOfLines={1} style={styles.headingLabel}>{label}</Text>{headingNote ? <Text numberOfLines={1} style={styles.headingNote}>{headingNote}</Text> : null}</View> : null}
      <View style={[styles.cell, compactSize && styles.cellCompact, liveSize && styles.cellLive]}>
        <View style={[styles.pitchColumn, compactSize && styles.pitchColumnCompact, liveSize && styles.pitchColumnLive]}>
          {showLabels ? <Text {...scorebookGlyphFitProps} numberOfLines={1} style={styles.zoneLabel}>球數欄</Text> : null}
          <View accessibilityLabel={`逐球紀錄，共 ${pitchMarkItems.length} 球`} style={[styles.pitchMarkGrid, compactSize && styles.pitchMarkGridCompact, liveSize && styles.pitchMarkGridLive]}>
            {(pitchMarkItems.length ? pitchMarkItems : ["·"]).map((mark, index) => (
              <Text {...scorebookGlyphFitProps} key={`${mark}-${index}`} numberOfLines={1} style={[styles.pitchMarkCell, compactSize && styles.pitchMarkCellCompact, liveSize && styles.pitchMarkCellLive]}>{mark}</Text>
            ))}
          </View>
        </View>
        <View style={[styles.outerArea, compactSize && styles.outerAreaCompact, liveSize && styles.outerAreaLive]}>
          {showLabels ? <Text {...scorebookGlyphFitProps} numberOfLines={1} style={styles.outerLabel}>外圈</Text> : null}
          {pitchingChangeBadge ? <View pointerEvents="none" accessibilityLabel={`換投標記：第${pitchingChangeBadge.inning}局 ︺ P ${pitchingChangeBadge.pitcherLabel ?? "新投手"}`} style={[styles.pitchingChangeBadge, liveSize && styles.pitchingChangeBadgeLive]}><Text {...scorebookGlyphFitProps} numberOfLines={1} style={[styles.pitchingChangeBadgeCode, liveSize && styles.pitchingChangeBadgeCodeLive]}>︺ P</Text><Text {...scorebookGlyphFitProps} numberOfLines={1} style={[styles.pitchingChangeBadgePitcher, liveSize && styles.pitchingChangeBadgePitcherLive]}>{pitchingChangeBadge.pitcherLabel ?? "新投手"}</Text></View> : null}
          {replacementBadge ? <View pointerEvents="none" accessibilityLabel={`替換交接：第${replacementBadge.inning}局起 ${replacementBadge.code}${replacementHandoffLabel ? `；${replacementHandoffLabel}` : typeof replacementPitchTotal === "number" ? `；本席 ${replacementPitchTotal} 球（非精確交接）` : ""}`} style={[styles.replacementBadge, liveSize && styles.replacementBadgeLive]}><View style={styles.replacementBadgeHeader}><Text {...scorebookGlyphFitProps} numberOfLines={1} style={[styles.replacementBadgeCode, liveSize && styles.replacementBadgeCodeLive]}>{replacementBadge.code}</Text><Text {...scorebookGlyphFitProps} numberOfLines={1} style={[styles.replacementBadgeHandoff, liveSize && styles.replacementBadgeHandoffLive]}>交接</Text></View><Text {...scorebookGlyphFitProps} numberOfLines={1} style={[styles.replacementBadgeInning, liveSize && styles.replacementBadgeInningLive]}>第{replacementBadge.inning}局起</Text>{replacementHandoffLabel ? <Text {...scorebookGlyphFitProps} numberOfLines={1} style={[styles.replacementBadgePitchCount, liveSize && styles.replacementBadgePitchCountLive]}>{replacementHandoffLabel}</Text> : typeof replacementPitchTotal === "number" ? <Text {...scorebookGlyphFitProps} numberOfLines={1} style={[styles.replacementBadgePitchCount, liveSize && styles.replacementBadgePitchCountLive]}>本席 {replacementPitchTotal} 球</Text> : null}</View> : null}
          {correction?.outerMark && !hasStructuredOuterCorrection ? <Text {...scorebookGlyphFitProps} numberOfLines={2} style={[styles.outerCorrectionMark, liveSize && styles.outerCorrectionMarkLive]}>{correction.outerMark}</Text> : <>
            <Text {...scorebookGlyphFitProps} numberOfLines={2} style={[styles.leftTop, liveSize && styles.leftTopLive, hit && styles.redText]}>{outerMarks?.leftTop ?? leftTop ?? ""}</Text>
            <Text {...scorebookGlyphFitProps} numberOfLines={1} style={[batterReachesFirst ? styles.batterFirstBaseMark : styles.rightTop, liveSize && (batterReachesFirst ? styles.batterFirstBaseMarkLive : styles.rightTopLive)]}>{outerMarks?.rightTop ?? onBaseMarks}</Text>
            <Text {...scorebookGlyphFitProps} numberOfLines={1} style={[styles.leftBottom, liveSize && styles.leftBottomLive]}>{outerMarks?.leftBottom ?? (rbi ? "①②③④".slice(0, rbi) : "")}</Text>
            <View accessibilityLabel={displayedFieldingNotation ? `右下角傳接符號：${displayedFieldingNotation}` : "右下角傳接符號"} style={[styles.rightBottom, liveSize && styles.rightBottomLive, displayedFieldingNotation && styles.rightBottomHasFielding]}>
              {compactBattedBallNotation ? <Pressable
                accessibilityRole="button"
                accessibilityLabel={`放大查看右下角簡化符號：${compactBattedBallNotation}`}
                accessibilityHint="開啟唯讀完整傳接序列放大檢視，不會修改賽事紀錄"
                hitSlop={4}
                onPress={(pressEvent) => {
                  pressEvent.stopPropagation();
                  setIsFieldingNotationOpen(true);
                }}
                style={({ pressed }) => [styles.fieldingTapTarget, pressed && styles.fieldingTapTargetPressed]}
              >
                <Text {...scorebookGlyphFitProps} ellipsizeMode="tail" numberOfLines={fieldingLineLimit} style={styles.compactBattedBallNotation}>{compactBattedBallNotation}</Text>
              </Pressable> : displayedFieldingNotation ? <Pressable
                accessibilityRole="button"
                accessibilityLabel={`放大查看右下角傳接符號：${displayedFieldingNotation}`}
                accessibilityHint="開啟唯讀傳接序列放大檢視，不會修改賽事紀錄"
                hitSlop={4}
                onPress={(pressEvent) => {
                  pressEvent.stopPropagation();
                  setIsFieldingNotationOpen(true);
                }}
                style={({ pressed }) => [styles.fieldingTapTarget, pressed && styles.fieldingTapTargetPressed]}
              >
                <Text {...scorebookGlyphFitProps} ellipsizeMode="tail" numberOfLines={fieldingLineLimit} style={[styles.fieldingNotation, fieldingDisplay.wasTruncated && styles.fieldingNotationTruncated]}>{fieldingDisplay.text}</Text>
              </Pressable> : null}
            </View>
          </>}
          <View style={styles.diamondStage}>
            <View pointerEvents="none" style={[styles.diamondGuide, styles.diamondGuideTop]} />
            <View pointerEvents="none" style={[styles.diamondGuide, styles.diamondGuideRight]} />
            <View pointerEvents="none" style={[styles.diamondGuide, styles.diamondGuideBottom]} />
            <View pointerEvents="none" style={[styles.diamondGuide, styles.diamondGuideLeft]} />
            <View style={styles.diamond} />
            {batterFirstBaseLines.map((line) => (
              <View key={`batter-${line.segment}`} pointerEvents="none" style={styles.runnerAdvanceOverlay}>
                <View style={[styles.batterReachLine, batterReachSegmentStyle(line.segment)]} />
              </View>
            ))}
            {runnerAdvanceLines.map((line) => (
              <View key={`runner-${line.segment}`} pointerEvents="none" style={styles.runnerAdvanceOverlay}>
                <View style={[styles.runnerAdvanceLine, runnerSegmentStyle(line.segment)]} />
                {line.hasArrow ? <Text {...scorebookGlyphFitProps} numberOfLines={1} style={[styles.runnerAdvanceArrow, runnerArrowStyle(line.segment)]}>▶</Text> : null}
                {line.label ? <Text {...scorebookGlyphFitProps} numberOfLines={1} style={[styles.runnerAdvanceLabel, runnerLabelStyle(line.segment), line.label === "BK" && styles.runnerAdvanceLabelBK]}>{line.label}</Text> : null}
              </View>
            ))}
            {hitAdvanceSegments.map((segment) => (
              <View key={segment} style={[styles.hitAdvanceLine, hitSegmentStyle(segment)]} />
            ))}
            <View style={[styles.innerSquare, liveSize && styles.innerSquareLive]}>
              {showLabels ? <Text {...scorebookGlyphFitProps} numberOfLines={1} style={styles.innerLabel}>內圈</Text> : null}
              <Text {...scorebookGlyphFitProps} numberOfLines={1} style={[styles.innerMark, liveSize && styles.innerMarkLive, innerMark.length > 3 && styles.innerMarkLong, (innerMark === "○" || innerMark === "●") && styles.innerScoreMark]}>{innerMark}</Text>
            </View>
          </View>
          {showEmptyHint ? <View pointerEvents="none" style={styles.emptyHintOverlay}><Text {...scorebookGlyphFitProps} numberOfLines={1} style={styles.emptyHintText}>{emptyHint}</Text></View> : null}
        </View>
      </View>
      <Modal
        transparent
        animationType="fade"
        visible={isFieldingNotationOpen}
        onRequestClose={() => setIsFieldingNotationOpen(false)}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="關閉傳接序列放大檢視" onPress={() => setIsFieldingNotationOpen(false)} style={styles.fieldingModalBackdrop}>
          <Pressable onPress={(pressEvent) => pressEvent.stopPropagation()} style={styles.fieldingModalCard}>
            <Text style={styles.fieldingModalEyebrow}>早稻田式傳接序列</Text>
            <Text style={styles.fieldingModalTitle}>右下角傳接區</Text>
            <View style={styles.fieldingFontScaleControl}>
              <Text style={styles.fieldingFontScaleLabel}>文字大小：{fieldingNotationFontSize} pt</Text>
              <Text style={styles.fieldingFontScaleHint}>可在閱讀偏好頁以滑桿微調，設定會立即套用。</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="開啟閱讀偏好字級設定" onPress={() => { setIsFieldingNotationOpen(false); router.push("/reading-preferences"); }} style={({ pressed }) => [styles.fieldingFontScaleSettingsButton, pressed && styles.fieldingFontScaleOptionPressed]}>
                <Text style={styles.fieldingFontScaleSettingsButtonText}>開啟閱讀偏好</Text>
              </Pressable>
            </View>
            <View style={styles.fieldingModalNotation}><Text selectable style={[styles.fieldingModalNotationText, { fontSize: fieldingModalFontMetrics.fontSize, lineHeight: fieldingModalFontMetrics.lineHeight }]}>{fieldingModalDisplay.text}</Text></View>
            <Text style={styles.fieldingModalHint}>唯讀放大檢視；不會變更逐球、跑壘、比分或正式統計。</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="關閉放大檢視" onPress={() => setIsFieldingNotationOpen(false)} style={({ pressed }) => [styles.fieldingModalClose, pressed && styles.fieldingModalClosePressed]}><Text style={styles.fieldingModalCloseText}>關閉</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  /** 2013 WBC 記錄表採直角方格；打席格不得因尺寸改為圓角或圓形。 */
  wrap: { borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white, overflow: "hidden" },
  large: { minWidth: 236, minHeight: 158 },
  regular: { minWidth: 150, minHeight: 112 },
  /** 參考紙本格為左側 22px 逐球欄＋右側 68px 方框，連同外框採 92×70 比例。 */
  compact: { width: 92, minWidth: 92, minHeight: 70 },
  live: { width: 72, minWidth: 72, minHeight: 70 },
  rail: { minWidth: 132, minHeight: 86 },
  heading: { minHeight: 20, paddingHorizontal: 6, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.paper, borderBottomWidth: 1, borderColor: COLORS.line },
  headingLabel: { color: COLORS.ink, flexShrink: 1, fontSize: 9, fontWeight: "900" },
  headingNote: { color: COLORS.muted, flex: 1, fontSize: 7, fontWeight: "700", textAlign: "right" },
  cell: { flex: 1, flexDirection: "row", minHeight: 96 },
  cellCompact: { minHeight: 68 },
  cellLive: { minHeight: 70 },
  pitchColumn: { width: 29, paddingVertical: 3, alignItems: "center", borderRightWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.white },
  pitchColumnCompact: { width: 22, paddingVertical: 2 },
  pitchColumnLive: { width: 23, paddingVertical: 2 },
  zoneLabel: { color: COLORS.muted, fontSize: 6, fontWeight: "900", writingDirection: "ltr" },
  /** 每欄最多14球、兩欄共28球；直式由上而下讀取，維持緊湊橫式工作台高度。 */
  pitchMarkGrid: { width: 20, height: 82, marginTop: 2, flexDirection: "column", flexWrap: "wrap", alignContent: "flex-start", overflow: "hidden" },
  pitchMarkGridCompact: { width: 16, height: 62, marginTop: 1 },
  pitchMarkGridLive: { width: 16, height: 62, marginTop: 1 },
  pitchMarkCell: { width: 10, height: 5, color: COLORS.ink, fontSize: 6, fontWeight: "900", lineHeight: 5, includeFontPadding: false, textAlign: "center", textAlignVertical: "center" },
  pitchMarkCellCompact: { width: 8, height: 4.4, fontSize: 5.5, lineHeight: 4.4 },
  pitchMarkCellLive: { width: 8, height: 4.4, fontSize: 5.5, lineHeight: 4.4 },
  /** 最外層 wrap 已提供紙本格線；外圈僅承載符號，避免再畫一層重複方框。 */
  outerArea: { flex: 1, minHeight: 96, position: "relative", overflow: "hidden", backgroundColor: "transparent", borderWidth: 0 },
  /** 緊湊格維持 68px 高的單一紙本方格，不加內嵌外框。 */
  outerAreaCompact: { minHeight: 68, borderWidth: 0 },
  outerAreaLive: { minHeight: 70 },
  outerLabel: { position: "absolute", top: 3, left: 4, color: COLORS.muted, fontSize: 6, fontWeight: "900" },
  pitchingChangeBadge: { position: "absolute", top: 3, left: 4, maxWidth: "34%", paddingHorizontal: 1, paddingVertical: 1, borderWidth: 1, borderColor: "#F59E0B", borderRadius: 4, backgroundColor: "transparent", zIndex: 12 },
  pitchingChangeBadgeLive: { top: 2, left: 2, paddingHorizontal: 1, paddingVertical: 0 },
  pitchingChangeBadgeCode: { color: "#92400E", fontSize: 7, fontWeight: "900", lineHeight: 8 },
  pitchingChangeBadgeCodeLive: { fontSize: 6, lineHeight: 7 },
  pitchingChangeBadgePitcher: { color: "#B45309", fontSize: 6, fontWeight: "800", lineHeight: 7 },
  pitchingChangeBadgePitcherLive: { fontSize: 5, lineHeight: 6 },
  replacementBadge: { position: "absolute", top: 3, left: "50%", width: 46, marginLeft: -23, alignItems: "center", borderWidth: 1, borderColor: "#38BDF8", borderRadius: 5, paddingHorizontal: 2, paddingVertical: 1, backgroundColor: "transparent", zIndex: 12 },
  replacementBadgeLive: { top: 2, width: 36, marginLeft: -18, borderRadius: 4, paddingHorizontal: 1, paddingVertical: 0 },
  replacementBadgeHeader: { flexDirection: "row", alignItems: "center", gap: 2 },
  replacementBadgeHandoff: { color: "#0C4A6E", fontSize: 5.5, fontWeight: "900", lineHeight: 7, letterSpacing: 0.1 },
  replacementBadgeHandoffLive: { fontSize: 4.5, lineHeight: 6 },
  replacementBadgeInning: { color: "#075985", fontSize: 6, fontWeight: "800", lineHeight: 7 },
  replacementBadgeInningLive: { fontSize: 5, lineHeight: 6 },
  replacementBadgeCode: { color: "#0369A1", fontSize: 9, fontWeight: "900", lineHeight: 10 },
  replacementBadgeCodeLive: { fontSize: 7, lineHeight: 8 },
  replacementBadgePitchCount: { color: "#0E7490", fontSize: 5.5, fontWeight: "800", lineHeight: 6.5 },
  replacementBadgePitchCountLive: { fontSize: 4.5, lineHeight: 5.5 },
  outerCorrectionMark: { position: "absolute", top: 12, left: 4, right: 4, color: COLORS.blue, fontSize: 8, fontWeight: "900", lineHeight: 10, textAlign: "center" },
  outerCorrectionMarkLive: { top: 6, left: 3, right: 3, fontSize: 7, lineHeight: 8.5 },
  leftTop: { position: "absolute", top: 12, left: 5, maxWidth: "42%", color: COLORS.blue, fontSize: 9, fontWeight: "900" },
  leftTopLive: { top: 5, left: 3, fontSize: 8 },
  rightTop: { position: "absolute", top: 12, right: 5, maxWidth: "42%", color: COLORS.blue, fontSize: 8, fontWeight: "900", textAlign: "right" },
  rightTopLive: { top: 5, right: 3, fontSize: 7.5 },
  /** BB／K+ 緊鄰本壘至一壘藍線，與參考表的右下上壘分區一致。 */
  batterFirstBaseMark: { position: "absolute", right: 4, bottom: 15, maxWidth: "48%", color: COLORS.blue, fontSize: 13, fontWeight: "900", lineHeight: 14, textAlign: "right", zIndex: 7 },
  batterFirstBaseMarkLive: { right: 2, bottom: 12, fontSize: 10, lineHeight: 11 },
  battedBallRightBottom: { alignItems: "flex-end", gap: 0, marginBottom: 1, maxWidth: "100%" },
  battedBallType: { color: COLORS.blue, fontSize: 8, fontWeight: "900", lineHeight: 9 },
  groundBallType: { letterSpacing: -0.2 },
  battedBallDirection: { color: COLORS.blue, fontSize: 10, fontWeight: "900", lineHeight: 10 },
  leftBottom: { position: "absolute", bottom: 5, left: 5, color: COLORS.red, fontSize: 10, fontWeight: "900", letterSpacing: -2 },
  leftBottomLive: { bottom: 3, left: 3, fontSize: 8 },
  rightBottom: { position: "absolute", right: 3, bottom: 3, maxWidth: "58%", alignItems: "flex-end", justifyContent: "flex-end", zIndex: 8 },
  rightBottomLive: { right: 2, bottom: 2, maxWidth: "58%" },
  rightBottomHasFielding: { paddingHorizontal: 2, paddingVertical: 1, borderTopLeftRadius: 3, backgroundColor: "transparent" },
  fieldingTapTarget: { alignSelf: "flex-end", maxWidth: "100%", minWidth: 18, minHeight: 16, justifyContent: "flex-end" },
  fieldingTapTargetPressed: { opacity: 0.62, transform: [{ scale: 0.98 }] },
  compactBattedBallNotation: { maxWidth: "100%", color: COLORS.blue, fontSize: 9, fontWeight: "900", lineHeight: 10, includeFontPadding: false, textAlign: "right", flexShrink: 1 },
  fieldingNotation: { maxWidth: "100%", color: COLORS.blue, fontSize: 8, fontWeight: "900", lineHeight: 9.5, includeFontPadding: false, textAlign: "right", flexShrink: 1 },
  fieldingNotationTruncated: { textDecorationLine: "underline", textDecorationStyle: "dotted" },
  fieldingModalBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: "rgba(15, 23, 42, 0.48)" },
  fieldingModalCard: { width: "100%", maxWidth: 420, gap: 8, borderRadius: 18, padding: 18, backgroundColor: COLORS.white, shadowColor: "#0F172A", shadowOpacity: 0.22, shadowRadius: 16, elevation: 8 },
  fieldingModalEyebrow: { color: COLORS.blue, fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  fieldingModalTitle: { color: COLORS.ink, fontSize: 18, fontWeight: "900", lineHeight: 23 },
  fieldingFontScaleControl: { gap: 6, borderWidth: 1, borderColor: "#D7E3F4", borderRadius: 10, padding: 8, backgroundColor: "#F8FBFF" },
  fieldingFontScaleLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "900" },
  fieldingFontScaleHint: { color: COLORS.muted, fontSize: 10, fontWeight: "700", lineHeight: 14 },
  fieldingFontScaleSettingsButton: { minHeight: 34, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.blue, borderRadius: 8, backgroundColor: COLORS.white },
  fieldingFontScaleSettingsButtonText: { color: COLORS.blue, fontSize: 12, fontWeight: "900" },
  fieldingFontScaleOptionPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  fieldingModalNotation: { minHeight: 76, justifyContent: "center", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 10, padding: 12, backgroundColor: "#EFF6FF" },
  fieldingModalNotationText: { color: COLORS.blue, fontSize: 18, fontWeight: "900", lineHeight: 28, textAlign: "center" },
  fieldingModalHint: { color: COLORS.muted, fontSize: 11, fontWeight: "700", lineHeight: 16 },
  fieldingModalClose: { minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: COLORS.ink },
  fieldingModalClosePressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  fieldingModalCloseText: { color: COLORS.white, fontSize: 14, fontWeight: "900" },
  /**
   * 緊湊紙本格右區為 68×68；菱形導引虛線直接接到外側粗框。
   * 外側打者上壘／安打線取四個邊界交點，跑者推進線則取菱形四角交點。
   */
  diamondStage: { position: "absolute", top: "50%", left: "50%", width: 68, height: 68, marginLeft: -34, marginTop: -34, alignItems: "center", justifyContent: "center", zIndex: 2 },
  diamondStageLarge: { width: 140, height: 140, marginLeft: -70, marginTop: -70 },
  diamond: { position: "absolute", width: 32, height: 32, borderWidth: 1, borderStyle: "dashed", borderColor: "#7B91A8", transform: [{ rotate: "45deg" }] },
  diamondLarge: { width: 64, height: 64 },
  diamondGuide: { position: "absolute", borderStyle: "dashed", borderColor: "#A8B8C9" },
  diamondGuideTop: { top: 0, left: 33, width: 1, height: 12, borderLeftWidth: 1 },
  diamondGuideRight: { top: 33, right: 0, width: 12, height: 1, borderTopWidth: 1 },
  diamondGuideBottom: { bottom: 0, left: 33, width: 1, height: 12, borderLeftWidth: 1 },
  diamondGuideLeft: { top: 33, left: 0, width: 12, height: 1, borderTopWidth: 1 },
  runnerAdvanceOverlay: { ...StyleSheet.absoluteFillObject },
  /** 進壘、SB 與 BK 以藍色實線覆蓋在對應的菱形虛線上。 */
  runnerAdvanceLine: { position: "absolute", width: 32, height: 2.5, borderRadius: 2, backgroundColor: COLORS.blue, zIndex: 4 },
  /** 保送、不死三振、觸身與失誤上壘由底邊交點逆時鐘接至右邊交點。 */
  batterReachLine: { position: "absolute", width: 48, height: 3, borderRadius: 2, backgroundColor: COLORS.blue, zIndex: 4 },
  runnerAdvanceArrow: { position: "absolute", color: COLORS.blue, fontSize: 9, fontWeight: "900", zIndex: 3 },
  runnerAdvanceArrowHomeToFirst: { left: 48.5, top: 32.5, transform: [{ rotate: "-45deg" }] },
  runnerAdvanceArrowFirstToSecond: { left: 32, top: 9.5, transform: [{ rotate: "-135deg" }] },
  runnerAdvanceArrowSecondToThird: { left: 9.5, top: 26, transform: [{ rotate: "135deg" }] },
  runnerAdvanceArrowThirdToHome: { left: 26, top: 48.5, transform: [{ rotate: "45deg" }] },
  runnerAdvanceLabel: { position: "absolute", color: COLORS.blue, fontSize: 6, fontWeight: "900", zIndex: 3 },
  runnerAdvanceLabelBK: { color: "#0F4E90", backgroundColor: "transparent", borderRadius: 3, overflow: "hidden", paddingHorizontal: 2, fontSize: 7, letterSpacing: -0.2 },
  runnerAdvanceLabelHomeToFirst: { left: 43, top: 51 },
  runnerAdvanceLabelFirstToSecond: { left: 40, top: 2 },
  runnerAdvanceLabelSecondToThird: { left: 0, top: 2 },
  runnerAdvanceLabelThirdToHome: { left: 1, top: 50 },
  /** 菱形底端→右端，依逆時鐘前進的第一段內部跑壘線。 */
  runnerHomeToFirst: { left: 29, top: 44, transform: [{ rotate: "-45deg" }] },
  runnerFirstToSecond: { left: 29, top: 21, transform: [{ rotate: "45deg" }] },
  runnerSecondToThird: { left: 7, top: 21, transform: [{ rotate: "-45deg" }] },
  runnerThirdToHome: { left: 7, top: 44, transform: [{ rotate: "45deg" }] },
  /** 打者安打以紅色實線沿外框交點逆時鐘連接，與菱形內跑壘線分層。 */
  hitAdvanceLine: { position: "absolute", width: 48, height: 3, borderRadius: 2, backgroundColor: COLORS.red, zIndex: 4 },
  hitHomeToFirst: { left: 27, top: 50, transform: [{ rotate: "-45deg" }] },
  hitFirstToSecond: { left: 27, top: 16, transform: [{ rotate: "45deg" }] },
  hitSecondToThird: { left: -7, top: 16, transform: [{ rotate: "-45deg" }] },
  hitThirdToHome: { left: -7, top: 50, transform: [{ rotate: "45deg" }] },
  /** 中央僅保留得分／出局符號的透明定位區，不繪製多餘小方框。 */
  innerSquare: { width: 26, height: 26, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  innerSquareLive: { width: 24, height: 24, backgroundColor: "transparent" },
  innerLabel: { color: COLORS.muted, fontSize: 5, fontWeight: "900" },
  innerMark: { color: COLORS.ink, maxWidth: 27, fontSize: 12, fontWeight: "900", lineHeight: 13, textAlign: "center" },
  innerMarkLive: { fontSize: 12, lineHeight: 13 },
  /** 得分以高辨識度紅色圓點呈現；○／●仍分別保留非自責／自責責任意義。 */
  innerScoreMark: { color: COLORS.red, fontSize: 16, lineHeight: 16 },
  innerMarkLong: { fontSize: 8.5, letterSpacing: -0.45 },
  emptyHintOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  emptyHintText: { color: "#9AA9B9", backgroundColor: "transparent", fontSize: 10, fontWeight: "800" },
  redText: { color: COLORS.red },
});

function hitSegmentStyle(segment: HitAdvanceSegment) {
  switch (segment) {
    case "home-to-first":
      return styles.hitHomeToFirst;
    case "first-to-second":
      return styles.hitFirstToSecond;
    case "second-to-third":
      return styles.hitSecondToThird;
    case "third-to-home":
      return styles.hitThirdToHome;
  }
}

function runnerSegmentStyle(segment: HitAdvanceSegment) {
  switch (segment) {
    case "home-to-first": return styles.runnerHomeToFirst;
    case "first-to-second": return styles.runnerFirstToSecond;
    case "second-to-third": return styles.runnerSecondToThird;
    case "third-to-home": return styles.runnerThirdToHome;
  }
}

function batterReachSegmentStyle(segment: HitAdvanceSegment) {
  switch (segment) {
    case "home-to-first": return styles.hitHomeToFirst;
    case "first-to-second": return styles.hitFirstToSecond;
    case "second-to-third": return styles.hitSecondToThird;
    case "third-to-home": return styles.hitThirdToHome;
  }
}

function runnerArrowStyle(segment: HitAdvanceSegment) {
  switch (segment) {
    case "home-to-first": return styles.runnerAdvanceArrowHomeToFirst;
    case "first-to-second": return styles.runnerAdvanceArrowFirstToSecond;
    case "second-to-third": return styles.runnerAdvanceArrowSecondToThird;
    case "third-to-home": return styles.runnerAdvanceArrowThirdToHome;
  }
}

function runnerLabelStyle(segment: HitAdvanceSegment) {
  switch (segment) {
    case "home-to-first": return styles.runnerAdvanceLabelHomeToFirst;
    case "first-to-second": return styles.runnerAdvanceLabelFirstToSecond;
    case "second-to-third": return styles.runnerAdvanceLabelSecondToThird;
    case "third-to-home": return styles.runnerAdvanceLabelThirdToHome;
  }
}
