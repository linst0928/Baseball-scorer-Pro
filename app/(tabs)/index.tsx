import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme as useNativeColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Sharing from "expo-sharing";
import * as ScreenOrientation from "expo-screen-orientation";
import Constants from "expo-constants";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { WasedaPersonalRecordCell } from "@/components/baseball/waseda-personal-record-cell";
import { WasedaScorebookTeamSheet } from "@/components/baseball/waseda-scorebook-team-sheet";
import { ScorebookDisplayEditor, ScorebookGameSelector } from "@/components/baseball/scorebook-workbench-controls";
import { HOME_DEFENSE_FIELD_IMAGE } from "@/constants/baseball-assets";
import { INTERFACE_COLOR_MODES, resolveInterfacePalette, useThemeContext, type InterfaceColorMode, type InterfacePalette } from "@/lib/theme-provider";
import { shareGameImage, shareGamePdf, shareGameScoreCsv, type GameReportFilter } from "@/lib/baseball/export";
import { getVisibleTeams, orderTeamsWithPrimaryFirst } from "@/lib/baseball/team-selector";
import {
  AtBatResult,
  AgeGroup,
  AGE_GROUP_OPTIONS,
  AppData,
  AtBatEvent,
  FIELD_POSITIONS,
  normalizePreferredPositions,
  Game,
  GameLineup,
  PitchFilter,
  PitchLocation,
  PitchOutcome,
  PitchState,
  PitchType,
  RecordColumn,
  RecordTrajectory,
  PlayerStatScope,
  School,
  Player,
  ScorebookDisplayOverride,
  ScorebookBlankSlot,
  Team,
  TeamSide,
  Substitution,
  SubstitutionType,
  SpecialEvent,
  SpecialEventType,
  SPECIAL_EVENT_LABELS,
  WEATHER_OPTIONS,
  WeatherCondition,
  createEmptyAtBatDraft,
  createLineupSnapshot,
  createInitialData,
  formatAvg,
  formatRate,
  getBattingStats,
  getPitchingStats,
  getCurrentBatter,
  getCurrentPitcher,
  getGameSummary,
  getHitZoneHeatmap,
  getInningRows,
  getLineupCompleteness,
  getBattingOrderEligiblePlayerIds,
  getDefensivePositionConflicts,
  isEligibleForBattingOrder,
  RESERVE_POSITION,
  RESERVE_POSITION_LABEL,
  suggestDefensiveConflictFixes,
  getNotation,
  getWasedaPitchMark,
  getPitchZoneHeatmap,
  getSpecialEventNotation,
  isStatNeutralSpecialEvent,
  appendStatNeutralSpecialEvent,
  finishGameWithEarlyEndAnnotation,
  getOpponentTeam,
  opensBattedBallWorkflow,
  getRecentEvents,
  filterRecentGames,
  getSeasonBattingStats,
  filterGamesForStatistics,
  getSacrificeBuntAdvancement,
  getSacrificeFlyAdvancement,
  canSacrificeFly,
  getTeamSacrificeTotals,
  getGamesForTeam,
  getTeamForHalf,
  getTeamPerformanceSummary,
  getPitchLimitWarning,
  getPitcherPitchLimitHistories,
  getPlayerHeatmapAnalytics,
  makeGame,
  mergeAppData,
  buildSpecialEventRunnerSummary,
  nextFieldersChoiceRunnerState,
  nextRunnerState,
  nextSpecialRunnerState,
  sortGameRosterForDisplay,
  sortPlayersForDisplay,
  aggregateInningRunnerEvents,
  getLatestCompletedAtBat,
  getRunnerSourceAtBat,
  getDroppedThirdStrikeEligibility,
  isBuntFoulStrikeout,
  isSacrificeBuntRecord,
  isSacrificeFlyRecord,
  SACRIFICE_BUNT_MODIFIER,
  SACRIFICE_FLY_MODIFIER,
  SACRIFICE_FLY_NO_SCORE_REASON_LABELS,
  SacrificeFlyNoScoreReason,
  normalizeAppData,
  ensureScoreThroughInning,
  updateGameAfterEvent,
  updateGameAfterSpecialEvent,
  swapDefensivePositions,
  swapTeamDefensiveConfigurations,
  getChangedDefensivePositions,
} from "@/lib/baseball/types";
import { getScorebookDisplayOverrideKey, type WasedaScorebookEntry } from "@/lib/baseball/waseda-scorebook-projection";
import { AT_BAT_CORRECTION_MODES, getPitchCorrectionPreview, getRecordCorrectionLockReason, getRecordCorrectionSymbolIdsForMode, getRecordCorrectionTargetsForMode, getRecordCorrectionValue, isRecordCorrectionUnlocked, mergeRecordCorrection, PITCH_CORRECTION_OPTIONS, RECORD_CORRECTION_OTHER_OPTIONS, RECORD_CORRECTION_SYMBOL_IDS, RECORD_CORRECTION_TARGETS, type AtBatCorrectionMode, type RecordCorrectionTarget } from "@/lib/baseball/record-correction";
import { applyFormalScorebookAtBatReplacement, applyFormalScorebookBlankCorrection, getFormalScorebookCorrectionLockReason } from "@/lib/baseball/formal-scorebook-correction";
import { createFuxing2026Data, FUXING_2026_GAMES, FUXING_COMPETITION, FUXING_CUP_BATTING_SUMMARY, FUXING_CUP_PITCHING_SUMMARY, FUXING_CUP_TEAM_BATTING_SUMMARY, FUXING_TEAM, isFuxing2026VerifiedScoreGame } from "@/lib/baseball/fuxing2026Data";
import { mergeFuxingImport } from "@/lib/baseball/fuxing2026-merge";
import { getWbc2013DisplayExample, WBC2013_DISPLAY_GAMES } from "@/lib/baseball/wbc2013-display-examples";
import { WASEDA_SYMBOL_CATEGORIES, WASEDA_SYMBOL_REFERENCE } from "@/lib/baseball/waseda-symbol-reference";
import { groupPitchHistoryByZone } from "@/lib/baseball/pitch-history";
import { type FieldingSequenceSuggestion, formatRecordColumnNotation, getFieldingExampleNotation, getFieldingSequenceSuggestions } from "@/lib/baseball/record-column-notation";
import { getPlayerDeletionUsage } from "@/lib/baseball/player-deletion-guard";
import { createLocalBackupPayload, formatLocalSavedAt, formatLocalStorageBytes, getLocalBackupFileName, getUtf8ByteLength, parseLocalBackup } from "@/lib/baseball/local-backup";

const STORAGE_KEY = "baseball-scorer-pro:data:v1";
const ONBOARDING_STORAGE_KEY = "baseball-scorer-pro:onboarding:v1";
const LOCAL_SAVE_META_STORAGE_KEY = "baseball-scorer-pro:last-local-save:v1";
/** 單一離線開關：本版本僅使用裝置上的 AsyncStorage，不初始化 OAuth 或遠端同步。 */
const OFFLINE_MODE = true;
/** 與 app.config.ts 的 release metadata 對齊；原生 release 若未提供 manifest 時使用此安全後備值。 */
const APP_VERSION = Constants.expoConfig?.version ?? "1.1.2";
const APP_BUILD_IDENTIFIER = typeof Constants.expoConfig?.extra?.buildIdentifier === "string"
  ? Constants.expoConfig.extra.buildIdentifier
  : "1.1.2-20260827-V04";
const APP_BUILD_DATE = typeof Constants.expoConfig?.extra?.buildDate === "string"
  ? Constants.expoConfig.extra.buildDate
  : "2026-08-27";
const BRAND = {
  navy: "#123A68",
  blue: "#1D5FA7",
  sky: "#EAF3FB",
  red: "#C83B44",
  green: "#1F8A5B",
  ink: "#10243E",
  muted: "#6A7A8F",
  line: "#D8E2ED",
  paper: "#F7FAFD",
  white: "#FFFFFF",
  yellow: "#F5B942",
};

const CLOUD_SYNC_STAGES = {
  local: { label: "尚未同步", percent: 0, color: BRAND.muted, hint: "登入後會建立專屬雲端備份並啟用跨裝置存取。" },
  reading: { label: "讀取雲端資料", percent: 10, color: BRAND.blue, hint: "正在確認帳號中的最新雲端快照。" },
  merging: { label: "合併本機資料", percent: 40, color: BRAND.yellow, hint: "正在比對本機與雲端資料，保護兩端的賽事紀錄。" },
  uploading: { label: "上傳至雲端", percent: 80, color: BRAND.blue, hint: "正在加密上傳與驗證，請保持網路連線。" },
  complete: { label: "雲端已同步", percent: 100, color: BRAND.green, hint: "同步完成。您的紀錄可在登入相同帳號的其他裝置開啟。" },
  conflict: { label: "同步待確認", percent: 100, color: BRAND.red, hint: "已取得另一部裝置的資料；請先完成合併或選擇保留版本。" },
  queued: { label: "等待同步", percent: 0, color: BRAND.yellow, hint: "資料已安全保存在本機，將在網路可用時再次同步。" },
} as const;

type CloudSyncStage = keyof typeof CLOUD_SYNC_STAGES;

const TEAM_COLOR_SWATCHES = ["#1D5FA7", "#0F766E", "#1F8A5B", "#B45309", "#C83B44", "#7C3AED"] as const;

function normalizeTeamColor(value: string | undefined) {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^#[0-9A-F]{6}$/.test(normalized) ? normalized : undefined;
}

type PaletteTransferPayload = {
  version: "bsp-palette-1";
  label: string;
  customColor: string;
  exportedAt: string;
};

type PrimaryTeamWizardPlayer = {
  id: string;
  name: string;
  number: string;
  throwingHand: "R" | "L";
  battingHand: "R" | "L";
  preferredPositions: string[];
};

type PrimaryTeamWizardInput = {
  name: string;
  logoUri?: string;
  level: AgeGroup;
  players: PrimaryTeamWizardPlayer[];
};

function parsePaletteTransfer(value: string): PaletteTransferPayload | undefined {
  try {
    const parsed = JSON.parse(value) as Partial<PaletteTransferPayload>;
    const customColor = normalizeTeamColor(parsed.customColor);
    if (parsed.version !== "bsp-palette-1" || !customColor || typeof parsed.label !== "string" || typeof parsed.exportedAt !== "string") return undefined;
    return { version: "bsp-palette-1", label: parsed.label, customColor, exportedAt: parsed.exportedAt };
  } catch {
    return undefined;
  }
}

function playerHandAbbr(player: Pick<Player, "throwingHand" | "battingHand"> | null | undefined) {
  return `${player?.throwingHand ?? "?"}${player?.battingHand ?? "?"}`;
}

function preferredPositionSummary(player: Pick<Player, "preferredPositions"> | null | undefined) {
  const positions = normalizePreferredPositions(player?.preferredPositions);
  if (!positions.length) return "尚未設定";
  const shortLabels: Record<string, string> = { 投手: "投", 捕手: "捕", 一壘手: "一", 二壘手: "二", 三壘手: "三", 游擊手: "游", 左外野手: "左", 中外野手: "中", 右外野手: "右" };
  return positions.map((number) => {
    const position = FIELD_POSITIONS.find((candidate) => candidate.number === number);
    return position ? `${position.number}${shortLabels[position.label] ?? position.label}` : number;
  }).join("／");
}

function playerIdentityLabel(player: Pick<Player, "number" | "name" | "throwingHand" | "battingHand"> | null | undefined, fallback = "未指派") {
  return player ? `#${player.number} ${player.name} ${playerHandAbbr(player)}` : fallback;
}

function tintFromHex(color: string, alpha = "18") {
  const normalized = normalizeTeamColor(color);
  return normalized ? `${normalized}${alpha}` : undefined;
}

function teamAccentColor(team: Team, side: TeamSide) {
  const fallback = side === "home" ? "#D97706" : "#1D5FA7";
  return normalizeTeamColor(team.customColor) ?? fallback;
}

function colorContrastRatio(foreground: string, background: string) {
  const toLuminance = (value: string) => {
    const normalized = normalizeTeamColor(value) ?? "#000000";
    const channels = [1, 3, 5].map((index) => parseInt(normalized.slice(index, index + 2), 16) / 255).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const [first, second] = [toLuminance(foreground), toLuminance(background)].sort((left, right) => right - left);
  return (first + 0.05) / (second + 0.05);
}

function getContrastHint(color: string) {
  const ratio = colorContrastRatio(color, BRAND.white);
  return ratio >= 4.5 ? `白字對比 AA · ${ratio.toFixed(1)}:1` : `建議深藍字 · 白字 ${ratio.toFixed(1)}:1`;
}

function readableTextOn(background: string) {
  return colorContrastRatio(BRAND.white, background) >= colorContrastRatio(BRAND.ink, background) ? BRAND.white : BRAND.ink;
}

function getLogoColorSuggestion(logoUri: string | undefined, fallback: string) {
  if (!logoUri) return fallback;
  let hash = 0;
  for (let index = 0; index < logoUri.length; index += Math.max(1, Math.floor(logoUri.length / 120))) {
    hash = ((hash << 5) - hash + logoUri.charCodeAt(index)) | 0;
  }
  return TEAM_COLOR_SWATCHES[Math.abs(hash) % TEAM_COLOR_SWATCHES.length];
}

function getLogoColorSuggestions(logoUri: string | undefined, fallback: string) {
  const primary = getLogoColorSuggestion(logoUri, fallback);
  const start = Math.max(0, TEAM_COLOR_SWATCHES.indexOf(primary as typeof TEAM_COLOR_SWATCHES[number]));
  return [0, 2, 4].map((offset) => TEAM_COLOR_SWATCHES[(start + offset) % TEAM_COLOR_SWATCHES.length]);
}

function teamSurfaceColor(team: Team, side: TeamSide) {
  return tintFromHex(teamAccentColor(team, side), "32") ?? (side === "home" ? "#FFF7ED" : "#EFF6FF");
}

function TeamLogoName({ team, textStyle, logoSize = 20, align = "left" }: { team: Team; textStyle: object; logoSize?: number; align?: "left" | "right" }) {
  return <View style={[styles.teamLogoNameRow, align === "right" && styles.teamLogoNameRowRight]}>
    {team.logoUri ? <Image source={{ uri: team.logoUri }} style={{ width: logoSize, height: logoSize, borderRadius: Math.max(3, Math.round(logoSize / 5)) }} resizeMode="cover" accessibilityLabel={`${team.name} 隊徽`} /> : <View style={[styles.teamLogoFallback, { width: logoSize, height: logoSize, borderRadius: Math.max(3, Math.round(logoSize / 5)), backgroundColor: teamSurfaceColor(team, "away") }]}><Text style={[styles.teamLogoFallbackText, { fontSize: Math.max(7, Math.round(logoSize * 0.45)) }]}>{team.name.slice(0, 1)}</Text></View>}
    <Text numberOfLines={1} style={[textStyle, styles.teamLogoNameText]}>{team.name}</Text>
  </View>;
}

const RECORD_TRAJECTORIES: Array<{ id: RecordTrajectory; mark: string; label: string }> = [
  { id: "fly", mark: "⌒", label: "高飛球" },
  { id: "line", mark: "ー", label: "平飛球" },
  { id: "ground", mark: "＿", label: "滾地球" },
];
const RECORD_MODIFIERS = ["E（失誤）", "DP（雙殺）", "TP（三殺）", "FC（野選）", "K+（不死三振）", "○K（見逃三振）", "CS（盜壘刺）", "PO（牽制出局）", "SB（盜壘）", "WP（暴投）", "PB（捕逸）", "BK（投手犯規）", "SH（犧牲觸擊）", "SF（高飛犧牲）"];
const FIELDING_PLAY_CHOICES = [
  { id: "DP" as const, label: "DP", detail: "雙殺" },
  { id: "TP" as const, label: "TP", detail: "三殺" },
  { id: "FC" as const, label: "FC", detail: "野選" },
];

const FIELD_POSITION_LAYOUT = [
  { number: "1", top: 62, left: 50 },
  { number: "2", top: 83, left: 50 },
  { number: "3", top: 64, left: 71 },
  { number: "4", top: 48, left: 61 },
  { number: "5", top: 64, left: 29 },
  { number: "6", top: 48, left: 39 },
  { number: "7", top: 31, left: 22 },
  { number: "8", top: 18, left: 50 },
  { number: "9", top: 31, left: 78 },
] as const;

const RESULT_SHORTCUT_LABELS: Record<AtBatResult, string> = {
  "1B": "一壘安打",
  "2B": "二壘安打",
  "3B": "三壘安打",
  HR: "全壘打",
  BB: "四壞球",
  HBP: "觸身球",
  K: "三振",
  F: "飛球出局",
  G: "滾地出局",
  E: "失誤",
};

const RESULT_SHORTCUTS: Array<{ id: string; result: AtBatResult; code?: string; label?: string; calledStrikeout?: boolean }> = [
  { id: "1B", result: "1B" }, { id: "2B", result: "2B" }, { id: "3B", result: "3B" }, { id: "HR", result: "HR" },
  { id: "B", result: "BB" }, { id: "DB", result: "HBP" }, { id: "K", result: "K" }, { id: "called-K", result: "K", code: "○K", label: "見逃三振", calledStrikeout: true },
  { id: "FO", result: "F", code: "FO", label: "飛球出局" }, { id: "GO", result: "G", code: "GO", label: "滾地出局" }, { id: "E", result: "E", code: "E", label: "失誤" },
];

function getResultShortcutCode(result: AtBatResult, fieldingPosition: string): string {
  if (["1B", "2B", "3B", "HR"].includes(result)) return result;
  if (result === "F") return "FO";
  if (result === "G") return "GO";
  if (result === "K") return "K";
  return getNotation(result, fieldingPosition);
}

type MainTab = "home" | "record" | "gameLog" | "stats";
type StatsTab = "batting" | "pitching" | "preview";
type StatsMode = "game" | "date" | "month" | "cup";

type NewGameForm = {
  name: string;
  competition: string;
  ageGroup: AgeGroup;
  venue: string;
  date: string;
  time: string;
  weather: WeatherCondition;
  awayTeamId: string;
  homeTeamId: string;
  awayRegisteredPlayerIds: string[];
  homeRegisteredPlayerIds: string[];
  awayLineup?: GameLineup;
  homeLineup?: GameLineup;
  pitchLimitThresholds: [number, number, number];
  maxInnings: 6 | 7 | 9 | 15;
};

type SpecialDraft = {
  type: SpecialEventType;
  fromBase?: 1 | 2 | 3;
  toBase?: 2 | 3 | 4;
  /** 僅供攻方 O.C 與守方 T 的可選文字備註使用。 */
  reason?: string;
};

type ManualAtBatDraft = {
  inning: number;
  half: TeamSide;
  batterId: string;
  pitcherId: string;
  result: AtBatResult;
  notation: string;
  runsScored: number;
  outsBefore: number;
  balls: number;
  strikes: number;
  total: number;
};

type PitchDraft = PitchState;
type GameSnapshot = {
  game: Game;
  pitchDraft: PitchDraft;
  fieldingPosition: string;
  selectedResult: AtBatResult | null;
  recordColumnDraft: RecordColumn;
};

type OperationFeedback = {
  id: number;
  tone: "success" | "restore";
  title: string;
  detail: string;
};

type GameRecordRow = {
  id: string;
  kind: "atbat" | "special" | "substitution";
  /** 僅打席列帶原始事件識別，避免由畫面文字回推資料。 */
  atBatEventId?: string;
  inning: number;
  half: TeamSide;
  teamName: string;
  playerLabel: string;
  notation: string;
  resultLabel: string;
  detail: string;
  detailLines: string[];
  timestamp: string;
};

type RecordCorrectionStep = "detail" | "mode" | "target" | "symbol" | "outerDirection" | "other" | "pitchBatch" | "outerWorkflow" | "content" | "preview";

type SymbolHelp = {
  mark: string;
  name: string;
  area: string;
  usage: string;
  example: string;
  tone?: "red" | "blue" | "navy";
};

const RUNNER_SYMBOL_HELP: Record<"SB" | "CS" | "ADV" | "WP" | "PB" | "BK" | "UNDO", SymbolHelp> = {
  SB: { mark: "→ SB", name: "盜壘（SB）", area: "菱形邊線／外圈（藍字）", usage: "依已確認的 App 規則，跑者在投球間自行進壘時，沿對應壘線以藍色箭頭加 SB 表示前進方向。", example: "一壘跑者盜二壘：→ SB 1→2", tone: "blue" },
  CS: { mark: "CS", name: "盜壘失敗（CS）", area: "來源打席外圈／內圈", usage: "跑者嘗試盜壘後被觸殺或封殺；來源打席記錄 CS 並增加一個出局數。", example: "一壘跑者盜二壘遭刺殺：CS 1→2", tone: "blue" },
  ADV: { mark: "↑", name: "進壘", area: "菱形邊線／外圈（藍字）", usage: "非指定特殊事件的推進紀錄；用於依守備、傳球或其他原因前進。", example: "二壘跑者進三壘：2→3", tone: "blue" },
  WP: { mark: "WP", name: "暴投", area: "外圈右上（藍字）", usage: "投手投球失控造成跑者前進；同時屬投手特殊事件。", example: "WP，三壘跑者返本得分", tone: "blue" },
  PB: { mark: "PB", name: "捕逸", area: "外圈右上（藍字）", usage: "捕手未能正常接捕而使跑者前進；與暴投分開記錄。", example: "PB，二壘跑者進三壘", tone: "blue" },
  BK: { mark: "BK", name: "投手犯規（BK）", area: "外圈（藍字）", usage: "投手犯規使跑者推進；記錄 BK，並將壘上跑者依壘況前進。", example: "一壘跑者因 BK 進二壘", tone: "blue" },
  UNDO: { mark: "↶", name: "回復上一球", area: "操作功能", usage: "移除上一筆逐球或跑壘事件，並還原壘況、球數與個人紀錄欄。", example: "誤點界外球後立即回復", tone: "navy" },
};

const PITCH_SYMBOL_HELP: Record<PitchOutcome, SymbolHelp> = {
  ball: { mark: "—", name: "壞球", area: "球數欄", usage: "投球未進好球帶且打者未揮棒；累加壞球數。", example: "外角偏高：—", tone: "navy" },
  strike: { mark: "○", name: "未揮好球", area: "球數欄", usage: "投球進入好球帶，打者未揮棒；累加好球數。", example: "內角好球：○", tone: "navy" },
  foulTip: { mark: "▲", name: "擦棒被捕", area: "球數欄", usage: "擦棒後由捕手直接接捕；屬好球，第三好球時為三振。", example: "兩好球後擦棒被捕：▲", tone: "navy" },
  foul: { mark: "△", name: "界外球", area: "球數欄", usage: "擊球落在界外；未滿兩好球時計好球，兩好球後不再增加好球數。", example: "右側界外：△", tone: "navy" },
  swingingStrike: { mark: "⊖", name: "揮棒落空", area: "球數欄", usage: "打者揮棒未碰到球；累加好球數。", example: "變化球揮空：⊖", tone: "navy" },
  bunt: { mark: "⌁", name: "觸擊", area: "球數欄", usage: "記錄打者嘗試觸擊的逐球動作；最後結果仍以打席結果或守備序列判定。", example: "觸擊推進：⌁", tone: "navy" },
  missedBunt: { mark: "◓", name: "觸擊落空", area: "球數欄", usage: "打者試圖觸擊但未碰到球；記為好球。", example: "短打失敗：◓", tone: "navy" },
  buntFoul: { mark: "△⌁", name: "觸擊界外", area: "球數欄", usage: "觸擊球落在界外；兩好球後的觸擊界外為三振。", example: "兩好球後觸擊界外：△⌁", tone: "navy" },
  foulError: { mark: "△E", name: "界外失誤", area: "球數欄／外圈右上", usage: "界外球被守備方處理失誤；保留界外球與失誤事實供後續判定。", example: "界外飛球漏接：△E", tone: "blue" },
  inPlay: { mark: "•", name: "擊出球", area: "球數欄 → 外圈右下", usage: "球進入比賽場地；接著選取安打、出局或失誤，並填入擊球方向與守備傳接。", example: "• → 5ー3", tone: "navy" },
  droppedThirdStrike: { mark: "K+", name: "不死三振", area: "球數欄／打席結果", usage: "投手投出第三好球但捕手未接捕（不死三振）；打者可嘗試向一壘跑。", example: "不死三振：K+", tone: "navy" },
};

function getResultSymbolHelp(result: AtBatResult, position: string): SymbolHelp {
  const notation = getNotation(result, position);
  if (["1B", "2B", "3B", "HR"].includes(result)) return { mark: notation, name: `${result} 安打`, area: "外圈左上（紅字）＋菱形內圈", usage: "以紅字標示安打種類，並依打者、跑者完成的進壘在菱形與得分區填寫。", example: `平飛 ${position} ${notation}`, tone: "red" };
  if (["BB", "HBP", "E"].includes(result)) return { mark: result === "E" ? "E" : notation, name: result === "BB" ? "四壞球" : result === "HBP" ? "觸身球" : "失誤（E）", area: "外圈右下（藍字）＋菱形內圈", usage: "非安打上壘事件以藍字記錄；失誤固定標示 E，必要時在右下傳接欄補上守備員代號。", example: result === "E" ? "E 6（失誤上壘）" : `${notation} 上壘`, tone: "blue" };
  if (result === "K") return { mark: "K／○K", name: "三振／見逃三振", area: "菱形內圈", usage: "揮空或擦棒形成第三好球時記 K；第三好球未揮棒時記 ○K。兩者皆依該局出局順序標示 I、II 或 III。", example: "○K → 第二出局 II", tone: "navy" };
  return { mark: result === "F" ? "FO" : "GO", name: result === "F" ? "飛球出局（FO）" : "滾地出局（GO）", area: "外圈右下（藍字）＋菱形內圈", usage: "結果固定以 FO 或 GO 標示；擊球方向與守備傳接一併記錄於右下區，再於內圈標示出局數。", example: result === "F" ? `FO ⌒${position}` : `GO ＿${position}ー3`, tone: "blue" };
}

function getModifierSymbolHelp(modifier: string): SymbolHelp {
  const code = modifier.split("（")[0];
  const details: Record<string, Omit<SymbolHelp, "mark" | "name">> = {
    E: { area: "外圈右上（藍字）", usage: "守備失誤；以守備員代號後接 E，必要時再加傳接序列。", example: "6Eー3" , tone: "blue" },
    DP: { area: "外圈右上／菱形內圈", usage: "雙殺；以守備傳接順序記錄並在內圈反映兩個出局。", example: "6ー4ー3 DP", tone: "blue" },
    TP: { area: "外圈右上／菱形內圈", usage: "三殺；以守備傳接順序記錄並在內圈反映三個出局。", example: "5ー4ー3 TP", tone: "blue" },
    FC: { area: "外圈右上（藍字）", usage: "野手選擇；守備方選擇處理其他跑者，打者上壘。", example: "FC 6ー4", tone: "blue" },
    CS: { area: "菱形邊線（藍字）", usage: "盜壘刺；在跑者前進路線標示被刺殺。", example: "CS 2→3", tone: "blue" },
    PO: { area: "外圈右上（藍字）", usage: "牽制出局；記錄投手、捕手或守備員的牽制傳接。", example: "PO 1ー3", tone: "blue" },
    SB: { area: "菱形邊線（藍字）", usage: "盜壘成功；沿壘線以箭頭連結前後壘包。", example: "SB 1→2", tone: "blue" },
    WP: { area: "外圈右上（藍字）", usage: "暴投造成推進或得分。", example: "WP，三壘跑者得分", tone: "blue" },
    PB: { area: "外圈右上（藍字）", usage: "捕逸造成推進或得分。", example: "PB，二壘跑者進三壘", tone: "blue" },
    BK: { area: "外圈右上（藍字）", usage: "投手犯規；依規則讓跑者推進。", example: "BK，跑者進壘", tone: "blue" },
    SH: { area: "菱形內圈／外圈右下", usage: "犧牲觸擊；補上觸擊方向與守備傳接，打者不計打數。", example: "SH 1ー3", tone: "blue" },
    SF: { area: "菱形內圈／外圈右下", usage: "高飛犧牲；補上外野守備員代號與得分跑者。", example: "SF 8，③得分", tone: "blue" },
  };
  return { mark: code, name: modifier, ...(details[code] ?? { area: "記錄欄", usage: "補充打席的特殊紀錄。", example: code, tone: "navy" }) };
}

function Button({ label, onPress, variant = "primary", compact = false, touch = false, fluid = false, disabled = false }: { label: string; onPress: () => void; variant?: "primary" | "secondary" | "danger" | "ghost"; compact?: boolean; touch?: boolean; fluid?: boolean; disabled?: boolean }) {
  const { interfacePalette } = useThemeContext();
  const buttonTheme = {
    primary: { backgroundColor: interfacePalette.primary, borderColor: interfacePalette.primary },
    secondary: { backgroundColor: interfacePalette.background, borderColor: interfacePalette.border },
    danger: { backgroundColor: interfacePalette.error, borderColor: interfacePalette.error },
    ghost: { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border },
    primaryText: { color: readableTextOn(interfacePalette.primary) },
    secondaryText: { color: interfacePalette.foreground },
    dangerText: { color: readableTextOn(interfacePalette.error) },
    disabled: { backgroundColor: interfacePalette.border, borderColor: interfacePalette.border },
    disabledText: { color: interfacePalette.muted },
  };
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        touch && styles.buttonTouch,
        fluid && styles.buttonFluid,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        variant === "ghost" && styles.buttonGhost,
        disabled && styles.buttonDisabled,
        variant === "primary" && buttonTheme.primary,
        variant === "secondary" && buttonTheme.secondary,
        variant === "danger" && buttonTheme.danger,
        variant === "ghost" && buttonTheme.ghost,
        disabled && buttonTheme.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, touch && styles.buttonTextTouch, variant === "secondary" && styles.buttonSecondaryText, variant === "ghost" && styles.buttonGhostText, variant === "primary" && buttonTheme.primaryText, variant === "secondary" && buttonTheme.secondaryText, variant === "danger" && buttonTheme.dangerText, variant === "ghost" && buttonTheme.secondaryText, disabled && styles.buttonDisabledText, disabled && buttonTheme.disabledText]}>{label}</Text>
    </Pressable>
  );
}

function InterfacePalettePreview({ palette }: { palette: InterfacePalette }) {
  const primaryText = readableTextOn(palette.primary);
  return (
    <View style={[styles.interfacePalettePreview, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={[styles.interfacePalettePreviewTop, { backgroundColor: palette.primary }]}><View style={[styles.interfacePalettePreviewTitle, { backgroundColor: primaryText }]} /></View>
      <View style={[styles.interfacePalettePreviewCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={[styles.interfacePalettePreviewLine, { backgroundColor: palette.foreground }]} />
        <View style={[styles.interfacePalettePreviewLineShort, { backgroundColor: palette.muted }]} />
        <View style={styles.interfacePalettePreviewStatusRow}>
          <View style={[styles.interfacePalettePreviewStatus, { backgroundColor: palette.success }]} />
          <View style={[styles.interfacePalettePreviewStatus, { backgroundColor: palette.warning }]} />
          <View style={[styles.interfacePalettePreviewStatus, { backgroundColor: palette.error }]} />
        </View>
      </View>
    </View>
  );
}

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  const { interfacePalette } = useThemeContext();
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleCopy}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: interfacePalette.primary }]}>{eyebrow}</Text> : null}
        <Text style={[styles.sectionTitle, { color: interfacePalette.foreground }]}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

function TeamPill({ team, side }: { team: Team; side: TeamSide }) {
  return (
    <View style={[styles.teamPill, side === "home" ? styles.homePill : styles.awayPill, { backgroundColor: teamSurfaceColor(team, side) }]}>
      <Text style={styles.teamPillLabel}>{side === "home" ? "主場(先守)" : "客場(先攻)"}</Text>
      <TeamLogoName team={team} textStyle={styles.teamPillName} logoSize={16} />
    </View>
  );
}

function ScoreBoard({ game, away, home }: { game: Game; away: Team; home: Team }) {
  const rows = getInningRows(game);
  const totals = (side: TeamSide) => rows.reduce((sum, row) => sum + row[side], 0);
  const hits = (side: TeamSide) => game.events.filter((event) => event.half === side && ["1B", "2B", "3B", "HR"].includes(event.result)).length;
  // 失誤由守備方承擔：客隊打擊時的 E 計入主隊，反之亦然。
  const errors = (side: TeamSide) => game.events.filter((event) => event.half !== side && event.result === "E").length;
  return (
    <View style={styles.photoScoreboard}>
      <View style={styles.photoScoreboardCaption}>
        <Text style={styles.photoScoreboardTitle}>主客場比分</Text>
        <Text style={styles.photoScoreboardMeta}>{game.status === "final" ? "FINAL" : `第 ${game.inning} 局${game.half === "away" ? "上" : "下"}`} · 預定 {game.maxInnings} 局</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoScoreboardScroll}>
        <View>
          <View style={styles.photoScoreboardHeaderRow}>
            <Text style={[styles.photoScoreboardTeamHeader, styles.photoScoreboardHeaderText]}>隊伍</Text>
            {rows.map((row) => <Text key={row.inning} style={[styles.photoScoreboardInningHeader, styles.photoScoreboardHeaderText, row.inning === game.inning && styles.photoScoreboardActiveHeader]}>{row.inning}</Text>)}
            {(["R", "H", "E"] as const).map((label) => <Text key={label} style={[styles.photoScoreboardTotalHeader, styles.photoScoreboardHeaderText]}>{label}</Text>)}
          </View>
          {([ ["away", away, "客"], ["home", home, "主"] ] as const).map(([side, team, sideLabel]) => <View key={side} style={[styles.photoScoreboardTeamRow, side === "home" && styles.photoScoreboardHomeRow, { backgroundColor: teamSurfaceColor(team, side) }]}><View style={styles.photoScoreboardTeamCell}><Text style={styles.photoScoreboardSide}>{sideLabel}</Text><TeamLogoName team={team} textStyle={styles.photoScoreboardTeamName} logoSize={16} /></View>{rows.map((row) => <Text key={`${side}-${row.inning}`} style={[styles.photoScoreboardInningCell, row.inning === game.inning && styles.photoScoreboardActiveCell]}>{row[side]}</Text>)}<Text style={styles.photoScoreboardTotalCell}>{totals(side)}</Text><Text style={styles.photoScoreboardTotalCell}>{hits(side)}</Text><Text style={styles.photoScoreboardTotalCell}>{errors(side)}</Text></View>)}
        </View>
      </ScrollView>
    </View>
  );
}

function BaseballDiamond({ runners }: { runners: Game["runners"] }) {
  const runnerList = [
    runners.first ? "一壘" : null,
    runners.second ? "二壘" : null,
    runners.third ? "三壘" : null,
  ].filter(Boolean);
  return (
    <View style={styles.diamondWrap}>
      <View style={styles.diamond}>
        <View style={[styles.base, styles.secondBase, runners.second ? styles.occupiedBase : null]}>
          <Text style={[styles.baseText, runners.second ? styles.occupiedBaseText : null]}>2</Text>
        </View>
        <View style={[styles.base, styles.thirdBase, runners.third ? styles.occupiedBase : null]}>
          <Text style={[styles.baseText, runners.third ? styles.occupiedBaseText : null]}>3</Text>
        </View>
        <View style={[styles.base, styles.firstBase, runners.first ? styles.occupiedBase : null]}>
          <Text style={[styles.baseText, runners.first ? styles.occupiedBaseText : null]}>1</Text>
        </View>
        <View style={styles.homePlate}><Text style={styles.homePlateText}>本</Text></View>
      </View>
      <Text style={styles.diamondCaption}>
        {runnerList.length > 0 ? `跑者：${runnerList.join("、")}` : "壘包清空"}
      </Text>
    </View>
  );
}

function StatChip({ label, value, accent = BRAND.blue }: { label: string; value: string | number; accent?: string }) {
  return <View style={styles.statChip}><Text style={[styles.statValue, { color: accent }]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function App() {
  const { interfaceColorMode, setInterfaceColorMode, customInterfaceColor, setCustomInterfaceColor, interfacePalette } = useThemeContext();
  const router = useRouter();
  const systemColorScheme = useNativeColorScheme();
  const isDarkInterface = interfaceColorMode === "deep" || (interfaceColorMode === "system" && systemColorScheme === "dark");
  const [data, setData] = useState<AppData>(() => mergeFuxingImport());
  const [hydrated, setHydrated] = useState(false);
  const [lastLocalSavedAt, setLastLocalSavedAt] = useState<string | null>(null);
  const [showSpecialEvent, setShowSpecialEvent] = useState(false);
  const [showSchoolManager, setShowSchoolManager] = useState(false);
  const [showPrimaryTeamWizard, setShowPrimaryTeamWizard] = useState(false);
  const [symbolHelp, setSymbolHelp] = useState<SymbolHelp | null>(null);
  const [showSymbolReference, setShowSymbolReference] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const gameHistoryRef = useRef<Record<string, GameSnapshot[]>>({});
  const [tab, setTab] = useState<MainTab>("home");
  const [statsTab, setStatsTab] = useState<StatsTab>("batting");
  const [recordAutoRefresh, setRecordAutoRefresh] = useState(true);
  const [recordRefreshing, setRecordRefreshing] = useState(false);
  const [recordLastRefreshedAt, setRecordLastRefreshedAt] = useState<string | null>(null);
  const [showExportRange, setShowExportRange] = useState(false);
  const [exportFilter, setExportFilter] = useState<GameReportFilter | undefined>(undefined);
  const [selectedGameRecordRow, setSelectedGameRecordRow] = useState<GameRecordRow | null>(null);
  const [recordCorrectionInitialStep, setRecordCorrectionInitialStep] = useState<"detail" | "target">("detail");
  const [formalAtBatReplacement, setFormalAtBatReplacement] = useState<AtBatEvent | null>(null);
  const [selectedResult, setSelectedResult] = useState<AtBatResult | null>(null);
  const [showNewGame, setShowNewGame] = useState(false);
  const [showEditGame, setShowEditGame] = useState(false);
  const [showSubstitution, setShowSubstitution] = useState(false);
  const [showManualAtBat, setShowManualAtBat] = useState(false);
  const [substitutionPreset, setSubstitutionPreset] = useState<SubstitutionType>("代打");
  const [selectedTeamId, setSelectedTeamId] = useState("team-home");
  const [fieldingPosition, setFieldingPosition] = useState("7");
  const [recordColumnDraft, setRecordColumnDraft] = useState<RecordColumn>({ modifiers: [], rbi: 0 });
  const [pitchDraft, setPitchDraft] = useState<PitchDraft>({ balls: 0, strikes: 0, total: 0, locations: [] });
  const [selectedPitchType, setSelectedPitchType] = useState<PitchType>("fastball");
  const [selectedPitchZone, setSelectedPitchZone] = useState<PitchLocation["zone"]>(5);
  const [newGameForm, setNewGameForm] = useState<NewGameForm>({ name: "", competition: "", ageGroup: "U12", venue: "", date: new Date().toISOString().slice(0, 10), time: "08:00", weather: "sunny", awayTeamId: "team-away", homeTeamId: "team-home", awayRegisteredPlayerIds: [], homeRegisteredPlayerIds: [], pitchLimitThresholds: [50, 70, 85], maxInnings: 9 });
  const [pendingDeletedGame, setPendingDeletedGame] = useState<{ game: Game; index: number } | null>(null);
  const [showSoftwareSettings, setShowSoftwareSettings] = useState(false);
  const [orientationDiagnostic, setOrientationDiagnostic] = useState({ label: "方向鎖定中", detail: "確認中", healthy: false });
  const deleteUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [operationFeedback, setOperationFeedback] = useState<OperationFeedback | null>(null);
  const [wbcDisplayExampleId, setWbcDisplayExampleId] = useState<string | null>(null);

  const announceOperationFeedback = useCallback((tone: OperationFeedback["tone"], title: string, detail: string) => {
    setOperationFeedback({ id: Date.now(), tone, title, detail });
    if (Platform.OS !== "web") {
      const feedbackType = tone === "success" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning;
      void Haptics.notificationAsync(feedbackType).catch(() => undefined);
    }
  }, []);

  const themedChrome = useMemo(() => ({
    shell: { backgroundColor: interfacePalette.background },
    topBar: { backgroundColor: interfacePalette.primary, borderBottomColor: interfacePalette.primary },
    bottomNav: { backgroundColor: interfacePalette.surface, borderTopColor: interfacePalette.border },
    brandName: { color: readableTextOn(interfacePalette.primary) },
    brandSub: { color: readableTextOn(interfacePalette.primary) },
    settingsPill: { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border },
    settingsPillText: { color: interfacePalette.foreground },
  }), [interfacePalette]);

  useKeepAwake();

  const refreshOrientationDiagnostic = useCallback(async () => {
    if (Platform.OS === "web") {
      setOrientationDiagnostic({ label: "方向鎖定中", detail: "網頁預覽", healthy: true });
      return;
    }
    try {
      const [orientation, lock] = await Promise.all([
        ScreenOrientation.getOrientationAsync(),
        ScreenOrientation.getOrientationLockAsync(),
      ]);
      const landscapeLocks = [
        ScreenOrientation.OrientationLock.LANDSCAPE,
        ScreenOrientation.OrientationLock.LANDSCAPE_LEFT,
        ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
      ];
      const landscapeOrientations = [
        ScreenOrientation.Orientation.LANDSCAPE_LEFT,
        ScreenOrientation.Orientation.LANDSCAPE_RIGHT,
      ];
      const healthy = landscapeLocks.includes(lock) && landscapeOrientations.includes(orientation);
      setOrientationDiagnostic({ label: healthy ? "方向鎖定中" : "方向需確認", detail: healthy ? "橫式" : "重新鎖定中", healthy });
    } catch {
      setOrientationDiagnostic({ label: "方向鎖定中", detail: "狀態待確認", healthy: false });
    }
  }, []);

  const relockLandscape = useCallback(async () => {
    if (Platform.OS === "web") {
      await refreshOrientationDiagnostic();
      return;
    }
    setOrientationDiagnostic({ label: "方向鎖定中", detail: "重新套用中", healthy: false });
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      await refreshOrientationDiagnostic();
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      setOrientationDiagnostic({ label: "方向需確認", detail: "鎖定失敗", healthy: false });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    }
  }, [refreshOrientationDiagnostic]);

  useEffect(() => {
    if (Platform.OS === "web") {
      setOrientationDiagnostic({ label: "方向鎖定中", detail: "網頁預覽", healthy: true });
      return;
    }

    let mounted = true;
    const updateOrientationDiagnostic = async () => {
      try {
        const [orientation, lock] = await Promise.all([
          ScreenOrientation.getOrientationAsync(),
          ScreenOrientation.getOrientationLockAsync(),
        ]);
        if (!mounted) return;
        const landscapeLocks = [
          ScreenOrientation.OrientationLock.LANDSCAPE,
          ScreenOrientation.OrientationLock.LANDSCAPE_LEFT,
          ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT,
        ];
        const landscapeOrientations = [
          ScreenOrientation.Orientation.LANDSCAPE_LEFT,
          ScreenOrientation.Orientation.LANDSCAPE_RIGHT,
        ];
        const healthy = landscapeLocks.includes(lock) && landscapeOrientations.includes(orientation);
        setOrientationDiagnostic({
          label: healthy ? "方向鎖定中" : "方向需確認",
          detail: healthy ? "橫式" : "重新鎖定中",
          healthy,
        });
      } catch {
        if (mounted) setOrientationDiagnostic({ label: "方向鎖定中", detail: "狀態待確認", healthy: false });
      }
    };

    void updateOrientationDiagnostic();
    const subscription = ScreenOrientation.addOrientationChangeListener(() => {
      void updateOrientationDiagnostic();
    });
    return () => {
      mounted = false;
      ScreenOrientation.removeOrientationChangeListener(subscription);
    };
  }, []);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(ONBOARDING_STORAGE_KEY), AsyncStorage.getItem(LOCAL_SAVE_META_STORAGE_KEY)]).then(([stored, tutorialState, storedSavedAt]) => {
      if (stored) {
        try {
          setData(mergeFuxingImport(normalizeAppData(JSON.parse(stored))));
        } catch {
          setData(mergeFuxingImport());
        }
      }
      setTutorialCompleted(tutorialState === "complete");
      setLastLocalSavedAt(storedSavedAt);
      setHydrated(true);
    }).catch(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const savedAt = new Date().toISOString();
    void Promise.all([
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)),
      AsyncStorage.setItem(LOCAL_SAVE_META_STORAGE_KEY, savedAt),
    ]).then(() => setLastLocalSavedAt(savedAt)).catch(() => undefined);
  }, [data, hydrated]);

  useEffect(() => {
    if (hydrated && tab === "record" && !tutorialCompleted) {
      setTutorialStep(0);
      setShowTutorial(true);
    }
  }, [hydrated, tab, tutorialCompleted]);

  const activeGame = useMemo(() => data.games.find((game) => game.id === data.activeGameId) ?? data.games[0], [data]);
  const awayTeam = useMemo(() => data.teams.find((team) => team.id === activeGame?.awayTeamId) ?? data.teams[0], [data.teams, activeGame]);
  const homeTeam = useMemo(() => data.teams.find((team) => team.id === activeGame?.homeTeamId) ?? data.teams[1] ?? data.teams[0], [data.teams, activeGame]);
  const wbcDisplayExample = useMemo(() => wbcDisplayExampleId ? getWbc2013DisplayExample(wbcDisplayExampleId) : undefined, [wbcDisplayExampleId]);
  const scorebookGame = wbcDisplayExample?.game ?? activeGame;
  const scorebookAwayTeam = wbcDisplayExample?.away ?? awayTeam;
  const scorebookHomeTeam = wbcDisplayExample?.home ?? homeTeam;
  const scorebookGames = useMemo(() => [...data.games, ...WBC2013_DISPLAY_GAMES], [data.games]);
  const currentBattingTeam = activeGame ? getTeamForHalf(activeGame, data.teams) : awayTeam;
  const currentPitchingTeam = activeGame ? getOpponentTeam(activeGame, data.teams) : homeTeam;
  const currentBatter = activeGame ? getCurrentBatter(activeGame, currentBattingTeam) : currentBattingTeam?.players[0];
  const currentPitcher = activeGame ? getCurrentPitcher(activeGame, homeTeam, awayTeam) : homeTeam?.players[0];
  const recentEvents = activeGame ? getRecentEvents(activeGame, data.teams) : [];
  const summary = activeGame ? getGameSummary(activeGame, data.teams) : null;
  const primaryTeam = useMemo(() => data.teams.find((team) => team.id === data.primaryTeamId) ?? homeTeam ?? awayTeam, [awayTeam, data.primaryTeamId, data.teams, homeTeam]);
  const primaryTeamGames = useMemo(() => getGamesForTeam(data.games, primaryTeam?.id ?? ""), [data.games, primaryTeam?.id]);
  const primaryPerformance = useMemo(() => primaryTeam ? getTeamPerformanceSummary(primaryTeamGames, primaryTeam) : null, [primaryTeam, primaryTeamGames]);
  const primarySide: TeamSide | null = activeGame && primaryTeam ? (activeGame.homeTeamId === primaryTeam.id ? "home" : activeGame.awayTeamId === primaryTeam.id ? "away" : null) : null;
  const currentBattingPerformance = useMemo(() => activeGame && currentBattingTeam ? getTeamPerformanceSummary([activeGame], currentBattingTeam) : null, [activeGame, currentBattingTeam]);
  const awayPerformance = useMemo(() => activeGame ? getTeamPerformanceSummary([activeGame], awayTeam) : null, [activeGame, awayTeam]);
  const homePerformance = useMemo(() => activeGame ? getTeamPerformanceSummary([activeGame], homeTeam) : null, [activeGame, homeTeam]);

  const updateData = useCallback((updater: (current: AppData) => AppData) => {
    setData((current) => normalizeAppData(updater(current)));
  }, []);

  const localStorageBytes = useMemo(() => getUtf8ByteLength(JSON.stringify(data)), [data]);
  const localStorageSizeLabel = useMemo(() => formatLocalStorageBytes(localStorageBytes), [localStorageBytes]);

  const exportLocalBackup = useCallback(async () => {
    const exportedAt = new Date().toISOString();
    const content = JSON.stringify(createLocalBackupPayload(data, exportedAt), null, 2);
    const fileName = getLocalBackupFileName(exportedAt);
    try {
      if (Platform.OS === "web") {
        const webDocument = globalThis.document;
        if (!webDocument || !globalThis.URL?.createObjectURL) throw new Error("目前瀏覽器不支援備份檔下載。");
        const objectUrl = globalThis.URL.createObjectURL(new Blob([content], { type: "application/json" }));
        const downloadLink = webDocument.createElement("a");
        downloadLink.href = objectUrl;
        downloadLink.download = fileName;
        webDocument.body.appendChild(downloadLink);
        downloadLink.click();
        webDocument.body.removeChild(downloadLink);
        globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(objectUrl), 0);
        Alert.alert("本機備份已下載", "請將 JSON 備份檔存放至安全位置，換機後可使用「匯入還原」完整復原。\n\n此檔案包含球隊、球員、場次與逐球紀錄。");
        return;
      }
      const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!directory) throw new Error("裝置暫存資料夾無法使用。");
      const fileUri = `${directory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
      if (!await Sharing.isAvailableAsync()) throw new Error("此裝置目前不支援系統分享。請改用支援檔案儲存的裝置。");
      await Sharing.shareAsync(fileUri, { mimeType: "application/json", dialogTitle: "儲存 Baseball Scorer Pro 本機備份" });
      Alert.alert("本機備份已建立", "請在系統分享視窗選擇「檔案」或雲端硬碟保存備份。換機後可匯入此 JSON 檔完整還原資料。");
    } catch (error) {
      Alert.alert("無法匯出本機備份", error instanceof Error ? error.message : "請稍後再試。");
    }
  }, [data]);

  const importLocalBackup = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      const content = Platform.OS === "web" && asset.file ? await asset.file.text() : await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const backup = parseLocalBackup(content);
      if (!backup) {
        Alert.alert("備份檔案無法使用", "請選擇由 Baseball Scorer Pro 匯出的 bsp-local-backup-1 JSON 本機備份檔。");
        return;
      }
      const createdAtLabel = formatLocalSavedAt(backup.exportedAt);
      Alert.alert(
        "確認覆寫本機資料",
        `此備份建立於 ${createdAtLabel}，包含 ${backup.appData.teams.length} 支隊伍與 ${backup.appData.games.length} 場比賽。\n\n還原後會取代目前這部裝置的所有球隊、球員與賽事紀錄，且無法自動復原。建議先匯出目前資料。`,
        [
          { text: "取消", style: "cancel" },
          {
            text: "覆寫並還原",
            style: "destructive",
            onPress: () => {
              const restoredAt = new Date().toISOString();
              setData(backup.appData);
              setLastLocalSavedAt(restoredAt);
              void Promise.all([
                AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(backup.appData)),
                AsyncStorage.setItem(LOCAL_SAVE_META_STORAGE_KEY, restoredAt),
              ]).catch(() => undefined);
              Alert.alert("本機資料已還原", "備份資料已套用並保存於這部裝置。請開啟最近比賽確認紀錄內容。" );
            },
          },
        ],
      );
    } catch (error) {
      Alert.alert("無法匯入本機備份", error instanceof Error ? error.message : "請選擇有效的 JSON 本機備份檔。");
    }
  }, []);

  const restoreInitialSettings = useCallback(() => {
    const initial = mergeFuxingImport();
    gameHistoryRef.current = {};
    if (deleteUndoTimerRef.current) clearTimeout(deleteUndoTimerRef.current);
    deleteUndoTimerRef.current = null;
    setPendingDeletedGame(null);
    setData(initial);
    setSelectedTeamId(initial.primaryTeamId ?? initial.teams[0]?.id ?? "");
    setTab("home");
    setStatsTab("batting");
    setInterfaceColorMode("original");
    setCustomInterfaceColor("#7C3AED");
    void AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "complete");
    setTutorialCompleted(true);
    Alert.alert("已還原初始設定", "已恢復內建球隊與示範比賽資料；登入帳號不會登出，最新資料會於下次同步寫入雲端。");
  }, [setCustomInterfaceColor, setInterfaceColorMode]);

  const clearPendingDelete = useCallback(() => {
    if (deleteUndoTimerRef.current) clearTimeout(deleteUndoTimerRef.current);
    deleteUndoTimerRef.current = null;
    setPendingDeletedGame(null);
  }, []);

  useEffect(() => () => {
    if (deleteUndoTimerRef.current) clearTimeout(deleteUndoTimerRef.current);
  }, []);

  const deleteRecentGame = useCallback((game: Game) => {
    Alert.alert("刪除這場比賽？", `「${game.name}」將從最近比賽移除；您可在 5 秒內復原。`, [
      { text: "取消", style: "cancel" },
      {
        text: "刪除",
        style: "destructive",
        onPress: () => {
          if (deleteUndoTimerRef.current) clearTimeout(deleteUndoTimerRef.current);
          setData((current) => {
            const index = current.games.findIndex((candidate) => candidate.id === game.id);
            if (index < 0) return current;
            const games = current.games.filter((candidate) => candidate.id !== game.id);
            const nextActiveGameId = current.activeGameId === game.id ? games[0]?.id ?? null : current.activeGameId;
            return { ...current, games, activeGameId: nextActiveGameId, deletedGameIds: [...new Set([...(current.deletedGameIds ?? []), game.id])] };
          });
          setPendingDeletedGame({ game, index: data.games.findIndex((candidate) => candidate.id === game.id) });
          deleteUndoTimerRef.current = setTimeout(() => {
            deleteUndoTimerRef.current = null;
            setPendingDeletedGame(null);
          }, 5000);
        },
      },
    ]);
  }, [data.games]);

  const restoreDeletedGame = useCallback(() => {
    if (!pendingDeletedGame) return;
    const { game, index } = pendingDeletedGame;
    setData((current) => {
      if (current.games.some((candidate) => candidate.id === game.id)) return current;
      const games = [...current.games];
      games.splice(Math.min(Math.max(index, 0), games.length), 0, game);
      return { ...current, games, activeGameId: current.activeGameId ?? game.id, deletedGameIds: (current.deletedGameIds ?? []).filter((id) => id !== game.id) };
    });
    clearPendingDelete();
  }, [clearPendingDelete, pendingDeletedGame]);

  const importFuxingRecords = useCallback(() => {
    const imported = createFuxing2026Data();
    setData((current) => mergeFuxingImport(current));
    setSelectedTeamId(FUXING_TEAM.id);
    setNewGameForm((form) => ({ ...form, awayTeamId: imported.games[0]?.awayTeamId ?? form.awayTeamId, homeTeamId: imported.games[0]?.homeTeamId ?? form.homeTeamId }));
    setRecordLastRefreshedAt(new Date().toISOString());
    setTab("home");
    Alert.alert("已載入復興少棒67交流賽資料", "已依來源修訂核對六場內建場次的基本資料、可驗證逐局與比分；沒有逐球、特殊事件或換人紀錄的內建場次才會更新。使用者建立、已刪除或已記錄的場次將保留不變。手寫逐球符號與衝突統計僅保留於備註，不會自動推測寫入。 ");
  }, []);

  const updateActiveGame = useCallback((updater: (game: Game) => Game) => {
    updateData((current) => ({
      ...current,
      games: current.games.map((game) => game.id === current.activeGameId ? updater(game) : game),
    }));
  }, [updateData]);

  const saveRecordCorrection = useCallback((eventId: string, target: RecordCorrectionTarget, value: string, note: string) => {
    if (!activeGame) return;
    const sourceEvent = activeGame.events.find((event) => event.id === eventId);
    if (!sourceEvent) {
      Alert.alert("找不到原始打席", "此紀錄可能已被復原或重新整理；請關閉後重新點選紀錄格。 ");
      return;
    }
    if (!isRecordCorrectionUnlocked(activeGame, sourceEvent)) {
      Alert.alert("尚未到可修改時機", "為避免進行中打者與跑者資料不同步，僅能在本半局結束或比賽結束後補正個人紀錄。 ");
      return;
    }
    updateActiveGame((game) => ({
      ...game,
      updatedAt: new Date().toISOString(),
      events: game.events.map((event) => event.id === eventId
        ? { ...event, recordCorrection: mergeRecordCorrection(event.recordCorrection, target, value, note) }
        : event),
    }));
    announceOperationFeedback("success", "個人紀錄符號已補正", "僅更新整體紀錄表的顯示符號；比分、壘包、出局、逐球與投打統計均維持原始打席。 ");
  }, [activeGame, announceOperationFeedback, updateActiveGame]);

  const saveRecordCorrectionBatch = useCallback((eventId: string, corrections: Array<{ target: RecordCorrectionTarget; value: string }>, note: string, replaceAll: boolean) => {
    if (!activeGame || corrections.length === 0) return;
    const sourceEvent = activeGame.events.find((event) => event.id === eventId);
    if (!sourceEvent) {
      Alert.alert("找不到原始打席", "此紀錄可能已被復原或重新整理；請關閉後重新點選紀錄格。 ");
      return;
    }
    if (!isRecordCorrectionUnlocked(activeGame, sourceEvent)) {
      Alert.alert("尚未到可修改時機", "為避免進行中打者與跑者資料不同步，僅能在本半局結束或比賽結束後補正個人紀錄。 ");
      return;
    }
    updateActiveGame((game) => ({
      ...game,
      updatedAt: new Date().toISOString(),
      events: game.events.map((event) => {
        if (event.id !== eventId) return event;
        const recordCorrection = corrections.reduce(
          (current, correction) => mergeRecordCorrection(current, correction.target, correction.value, note),
          replaceAll ? undefined : event.recordCorrection,
        );
        return { ...event, recordCorrection };
      }),
    }));
    announceOperationFeedback("success", replaceAll ? "個人紀錄已重新編寫顯示" : "個人紀錄符號已補正", "只在同一筆整體紀錄顯示覆蓋中保存逐球與早稻田外圈內容；正式逐球、跑壘、比分與統計維持不變。 ");
  }, [activeGame, announceOperationFeedback, updateActiveGame]);

  const replaceAllRecordCorrections = useCallback((eventId: string, target: RecordCorrectionTarget, value: string, note: string) => {
    if (!activeGame) return;
    const sourceEvent = activeGame.events.find((event) => event.id === eventId);
    if (!sourceEvent) {
      Alert.alert("找不到原始打席", "此紀錄可能已被復原或重新整理；請關閉後重新點選紀錄格。 ");
      return;
    }
    if (!isRecordCorrectionUnlocked(activeGame, sourceEvent)) {
      Alert.alert("尚未到可修改時機", "全刪除後的正式重建只開放於半局結束或比賽結束後，避免影響進行中的壘包、比分與出局數。 ");
      return;
    }
    void target; void value; void note;
    setFormalAtBatReplacement(sourceEvent);
    announceOperationFeedback("success", "已開啟單一打席正式重建", "原打席的逐球、結果、跑壘與符號將以空白草稿重建；其他打席維持不變並保留更正歷程。 ");
  }, [activeGame, announceOperationFeedback]);

  const clearAllRecordCorrections = useCallback((eventId: string) => {
    if (!activeGame) return;
    const sourceEvent = activeGame.events.find((event) => event.id === eventId);
    if (!sourceEvent) return;
    if (!isRecordCorrectionUnlocked(activeGame, sourceEvent)) return;
    updateActiveGame((game) => ({
      ...game,
      updatedAt: new Date().toISOString(),
      events: game.events.map((event) => {
        if (event.id !== eventId) return event;
        const { recordCorrection: _recordCorrection, ...unchangedEvent } = event;
        return unchangedEvent;
      }),
    }));
    announceOperationFeedback("restore", "已清除個人紀錄補正", "已回到原始打席的紀錄格顯示；原始比分與統計未曾改動。 ");
  }, [activeGame, announceOperationFeedback, updateActiveGame]);

  const startGame = useCallback(() => {
    if (!activeGame) return;
    updateActiveGame((game) => ({ ...game, status: "live", updatedAt: new Date().toISOString() }));
    setTab("record");
  }, [activeGame, updateActiveGame]);

  const completeTutorial = useCallback(() => {
    setShowTutorial(false);
    setTutorialCompleted(true);
    void AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "complete");
  }, []);

  const openTutorial = useCallback(() => {
    setTutorialStep(0);
    setShowTutorial(true);
  }, []);

  const recordOutcome = useCallback((result: AtBatResult, pitchOverride = pitchDraft, recordColumnOverride = recordColumnDraft) => {
    if (!activeGame || !currentBatter || !currentPitcher) return;
    const droppedThirdStrikeRequested = result === "K" && (recordColumnOverride.modifiers ?? []).some((modifier) => /不死三振|dropped\s*third|K\+/i.test(modifier));
    const droppedThirdStrike = droppedThirdStrikeRequested && (!activeGame.runners.first || activeGame.outs >= 2);
    const sacrificeBunt = result === "G" && isSacrificeBuntRecord(recordColumnOverride);
    const sacrificeFly = result === "F" && isSacrificeFlyRecord(recordColumnOverride);
    const sacrificeResult = sacrificeBunt
      ? getSacrificeBuntAdvancement(activeGame.runners)
      : sacrificeFly
        ? getSacrificeFlyAdvancement(activeGame.runners, recordColumnOverride.sacrificeFlyNoScoreReason)
        : null;
    const finalRecordColumn = {
      ...recordColumnOverride,
      modifiers: droppedThirdStrikeRequested && !droppedThirdStrike
        ? (recordColumnOverride.modifiers ?? []).filter((modifier) => !/不死三振|dropped\s*third|K\+/i.test(modifier))
        : [...(recordColumnOverride.modifiers ?? [])],
      rbi: sacrificeResult ? sacrificeResult.runs : recordColumnOverride.rbi,
    };
    if (droppedThirdStrikeRequested && !droppedThirdStrike) {
      Alert.alert("不死三振不成立", "一壘有人且未滿兩出局時不可跑壘；本打席已依早稻田核心規範記為一般三振出局。");
    }
    const runnerResult = sacrificeResult ?? (finalRecordColumn.fieldingPlay === "FC"
      ? nextFieldersChoiceRunnerState(activeGame.runners, currentBatter.id)
      : nextRunnerState(activeGame.runners, result, currentBatter.id, { droppedThirdStrike, outs: activeGame.outs }));
    gameHistoryRef.current[activeGame.id] = [...(gameHistoryRef.current[activeGame.id] ?? []), { game: activeGame, pitchDraft, fieldingPosition, selectedResult, recordColumnDraft }].slice(-20);
    const isBallInPlay = ["1B", "2B", "3B", "HR", "F", "G", "E"].includes(result);
    const locations = [...(pitchOverride.locations ?? [])];
    if (isBallInPlay && !opensBattedBallWorkflow(locations.at(-1)?.outcome)) {
      locations.push({ zone: selectedPitchZone, type: selectedPitchType, outcome: "inPlay" });
    }
    const pitches: PitchDraft = {
      ...pitchOverride,
      total: Math.max(pitchOverride.total, locations.length),
      locations,
    };
    const event = {
      id: `ab-${Date.now()}`,
      inning: activeGame.inning,
      half: activeGame.half,
      batterId: currentBatter.id,
      pitcherId: currentPitcher.id,
      result,
      notation: formatRecordColumnNotation(result, fieldingPosition, finalRecordColumn),
      pitches,
      outsBefore: activeGame.outs,
      runsScored: runnerResult.runs,
      zone: locations.at(-1)?.zone,
      pitchType: locations.at(-1)?.type ?? selectedPitchType,
      hitZone: undefined,
      hitPitchType: isBallInPlay ? selectedPitchType : undefined,
      recordColumn: finalRecordColumn,
      runnerAdvances: sacrificeResult?.advances.map((advance) => recordColumnOverride.sacrificeFlyNoScoreReason === "runner_out_at_home"
        ? { ...advance, outNumber: Math.min(activeGame.outs + 2, 3) as 1 | 2 | 3 }
        : advance),
      droppedThirdStrike,
      timestamp: new Date().toISOString(),
    };
    updateActiveGame((game) => {
      const updated = updateGameAfterEvent(game, event, runnerResult.runners, runnerResult.runs);
      return game.half === "away"
        ? { ...updated, awayBatterIndex: game.awayBatterIndex + 1 }
        : { ...updated, homeBatterIndex: game.homeBatterIndex + 1 };
    });
    const nextAtBatDraft = createEmptyAtBatDraft();
    setPitchDraft(nextAtBatDraft.pitchDraft);
    setSelectedResult(nextAtBatDraft.selectedResult);
    setRecordColumnDraft(nextAtBatDraft.recordColumnDraft);
  }, [activeGame, currentBatter, currentPitcher, fieldingPosition, pitchDraft, recordColumnDraft, selectedPitchType, selectedPitchZone, updateActiveGame]);

  const recordSpecialEvent = useCallback((draft: SpecialDraft) => {
    if (!activeGame || !currentPitcher) return;
    const fromBase = draft.fromBase ?? 1;
    const toBase = draft.toBase ?? 2;
    const runnerByBase = { 1: activeGame.runners.first, 2: activeGame.runners.second, 3: activeGame.runners.third } as const;
    const runnerId = runnerByBase[fromBase];
    if ((draft.type === "SB" || draft.type === "CS" || draft.type === "ADV") && !runnerId) {
      Alert.alert("目前沒有可記錄的跑者", "請先讓跑者進入指定壘包，再記錄盜壘或盜壘刺。");
      return;
    }
    const movement = nextSpecialRunnerState(activeGame.runners, draft.type, fromBase, toBase);
    const event: SpecialEvent = {
      id: `special-${Date.now()}`,
      inning: activeGame.inning,
      half: activeGame.half,
      type: draft.type,
      runnerId: isStatNeutralSpecialEvent(draft.type) ? undefined : runnerId ?? undefined,
      pitcherId: currentPitcher.id,
      fromBase: isStatNeutralSpecialEvent(draft.type) ? undefined : fromBase,
      toBase: isStatNeutralSpecialEvent(draft.type) ? undefined : toBase,
      runsScored: movement.runs,
      outsBefore: activeGame.outs,
      notation: getSpecialEventNotation(draft.type, fromBase, toBase),
      reason: (draft.type === "OFFENSIVE_TIMEOUT" || draft.type === "DEFENSIVE_TIMEOUT") ? draft.reason?.trim() || undefined : undefined,
      timestamp: new Date().toISOString(),
    };
    gameHistoryRef.current[activeGame.id] = [...(gameHistoryRef.current[activeGame.id] ?? []), { game: activeGame, pitchDraft, fieldingPosition, selectedResult, recordColumnDraft }].slice(-20);
    updateActiveGame((game) => isStatNeutralSpecialEvent(draft.type)
      ? appendStatNeutralSpecialEvent(game, event)
      : updateGameAfterSpecialEvent(game, event, movement.runners, movement.runs, movement.outsAdded));
    setShowSpecialEvent(false);
    announceOperationFeedback("success", "特殊紀錄已寫入", `${event.notation}${event.reason ? `・${event.reason}` : ""} 已保存；可使用「復原上一筆」回退。`);
  }, [activeGame, announceOperationFeedback, currentPitcher, fieldingPosition, pitchDraft, recordColumnDraft, selectedResult, updateActiveGame]);

  const recordBalk = useCallback(() => {
    if (!activeGame || !currentPitcher) return;
    const advances = ([
      { fromBase: 3 as const, runnerId: activeGame.runners.third, toBase: 4 as const },
      { fromBase: 2 as const, runnerId: activeGame.runners.second, toBase: 3 as const },
      { fromBase: 1 as const, runnerId: activeGame.runners.first, toBase: 2 as const },
    ]).filter((advance) => Boolean(advance.runnerId));
    if (advances.length === 0) {
      Alert.alert("目前沒有受影響的跑者", "投手犯規會使壘上跑者各推進一壘；目前壘包無跑者。 ");
      return;
    }
    gameHistoryRef.current[activeGame.id] = [...(gameHistoryRef.current[activeGame.id] ?? []), { game: activeGame, pitchDraft, fieldingPosition, selectedResult, recordColumnDraft }].slice(-20);
    updateActiveGame((game) => advances.reduce((updated, advance) => {
      const movement = nextSpecialRunnerState(updated.runners, "BK", advance.fromBase, advance.toBase);
      const event = {
        id: `balk-${Date.now()}-${advance.fromBase}`,
        inning: updated.inning,
        half: updated.half,
        type: "BK" as const,
        runnerId: advance.runnerId ?? undefined,
        pitcherId: currentPitcher.id,
        fromBase: advance.fromBase,
        toBase: advance.toBase,
        runsScored: movement.runs,
        outsBefore: updated.outs,
        notation: getSpecialEventNotation("BK", advance.fromBase, advance.toBase),
        timestamp: new Date().toISOString(),
      };
      return updateGameAfterSpecialEvent(updated, event, movement.runners, movement.runs, movement.outsAdded);
    }, game));
  }, [activeGame, currentPitcher, fieldingPosition, pitchDraft, recordColumnDraft, selectedResult, updateActiveGame]);

  const recordRunnerAction = useCallback((type: "SB" | "CS" | "ADV" | "WP" | "PB" | "BK", requestedBase?: 1 | 2 | 3, targetBase?: 2 | 3 | 4) => {
    if (!activeGame) return;
    if (type === "BK") {
      recordBalk();
      return;
    }
    const occupiedBase = requestedBase ?? (activeGame.runners.third ? 3 : activeGame.runners.second ? 2 : activeGame.runners.first ? 1 : 1);
    const toBase = targetBase ?? (occupiedBase === 3 ? 4 : (occupiedBase + 1) as 2 | 3 | 4);
    recordSpecialEvent({ type, fromBase: occupiedBase, toBase });
  }, [activeGame, recordBalk, recordSpecialEvent]);

  const addSchool = useCallback((name: string): Team | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const now = new Date().toISOString();
    const schoolId = `school-${Date.now()}`;
    const sourcePlayers = data.teams[0]?.players ?? [];
    const players = Array.from({ length: 18 }, (_, index) => ({
      ...(sourcePlayers[index] ?? { number: index + 1, position: "替補", bats: "R" as const }),
      id: `${schoolId}-p${index + 1}`,
      number: index + 1,
      name: `${trimmed}${index + 1}號`,
      battingOrder: index + 1,
    }));
    const school: School = { id: schoolId, name: trimmed, players, createdAt: now, updatedAt: now };
    const team: Team = { id: `team-${schoolId}`, name: `${trimmed}隊`, school: trimmed, schoolId, players, updatedAt: now };
    updateData((current) => ({ ...current, schools: [...current.schools, school], teams: [...current.teams, team] }));
    return team;
  }, [data.teams, updateData]);

  const createPrimaryTeamFromWizard = useCallback((input: PrimaryTeamWizardInput): Team | null => {
    const name = input.name.trim();
    const configuredPlayers = input.players.filter((player) => player.name.trim());
    const normalizedName = name.toLocaleLowerCase("zh-Hant");
    if (!name || configuredPlayers.length === 0 || data.teams.some((team) => team.name.trim().toLocaleLowerCase("zh-Hant") === normalizedName)) return null;
    const now = new Date().toISOString();
    const schoolId = `school-${Date.now()}`;
    const players: Player[] = configuredPlayers.map((player, index) => ({
      id: `${schoolId}-p${index + 1}`,
      number: Number(player.number),
      name: player.name.trim(),
      position: player.preferredPositions[0] ?? RESERVE_POSITION_LABEL,
      preferredPositions: player.preferredPositions.slice(0, 4),
      bats: player.battingHand,
      throwingHand: player.throwingHand,
      battingHand: player.battingHand,
    }));
    const school: School = { id: schoolId, name, players, createdAt: now, updatedAt: now };
    const team: Team = { id: `team-${schoolId}`, name, school: name, schoolId, level: input.level, players, logoUri: input.logoUri, updatedAt: now };
    updateData((current) => ({ ...current, schools: [...current.schools, school], teams: [...current.teams, team], primaryTeamId: team.id }));
    setSelectedTeamId(team.id);
    return team;
  }, [data.teams, updateData]);

  const updateSchool = useCallback((schoolId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    updateData((current) => ({
      ...current,
      schools: current.schools.map((school) => school.id === schoolId ? { ...school, name: trimmed, updatedAt: now } : school),
      teams: current.teams.map((team) => team.schoolId === schoolId ? { ...team, name: `${trimmed}隊`, school: trimmed, updatedAt: now } : team),
    }));
  }, [updateData]);

  const duplicateSchool = useCallback((schoolId: string) => {
    const source = data.schools.find((school) => school.id === schoolId);
    if (!source) return;
    const now = new Date().toISOString();
    const nextId = `school-${Date.now()}`;
    const players = source.players.map((player, index) => ({ ...player, id: `${nextId}-p${index + 1}`, name: `${source.name}副本${index + 1}號` }));
    const school: School = { ...source, id: nextId, name: `${source.name}副本`, players, createdAt: now, updatedAt: now };
    const team: Team = { id: `team-${nextId}`, name: `${school.name}隊`, school: school.name, schoolId: nextId, players, updatedAt: now };
    updateData((current) => ({ ...current, schools: [...current.schools, school], teams: [...current.teams, team] }));
  }, [data.schools, updateData]);

  const deleteSchool = useCallback((schoolId: string) => {
    const schoolTeamIds = new Set(data.teams.filter((team) => team.schoolId === schoolId).map((team) => team.id));
    if (data.schools.length <= 2) {
      Alert.alert("至少保留兩間學校", "新增第三間學校後，才能刪除目前的學校名單。");
      return;
    }
    if (data.games.some((game) => schoolTeamIds.has(game.homeTeamId) || schoolTeamIds.has(game.awayTeamId))) {
      Alert.alert("名單仍被賽事使用", "請保留這間學校，或先完成相關賽事的資料整理。");
      return;
    }
    updateData((current) => ({ ...current, schools: current.schools.filter((school) => school.id !== schoolId), teams: current.teams.filter((team) => team.schoolId !== schoolId) }));
  }, [data.games, data.schools.length, data.teams, updateData]);

  const recordPitch = useCallback((kind: PitchOutcome, selection?: Pick<PitchLocation, "zone" | "type">) => {
    const location: PitchLocation = { zone: selection?.zone ?? selectedPitchZone, type: selection?.type ?? selectedPitchType, outcome: kind };
    const addsStrike = kind === "strike" || kind === "swingingStrike" || kind === "foulTip" || kind === "missedBunt" || ((kind === "foul" || kind === "buntFoul") && pitchDraft.strikes < 2);
    const next = {
      balls: kind === "ball" ? pitchDraft.balls + 1 : pitchDraft.balls,
      strikes: addsStrike ? pitchDraft.strikes + 1 : pitchDraft.strikes,
      total: pitchDraft.total + 1,
      locations: [...(pitchDraft.locations ?? []), location],
    };
    setPitchDraft(next);
    if (next.balls >= 4) recordOutcome("BB", next);
    if (isBuntFoulStrikeout(kind, pitchDraft.strikes) || next.strikes >= 3) setSelectedResult("K");
  }, [pitchDraft, recordOutcome, selectedPitchType, selectedPitchZone]);

  const finishGame = useCallback(() => {
    if (!activeGame || activeGame.status === "final") return;
    Alert.alert(
      "確認提前結束比賽",
      `目前為 ${activeGame.inning} 局${activeGame.half === "away" ? "上" : "下"}，已有 ${activeGame.outs} 出局。確認後會以早稻田符號 /// 註記未滿三出局的比賽結束；不會補加出局、清除跑者或變更比分。`,
      [
        { text: "取消", style: "cancel" },
        {
          text: "確認結束並記錄 ///",
          style: "destructive",
          onPress: () => {
            gameHistoryRef.current[activeGame.id] = [...(gameHistoryRef.current[activeGame.id] ?? []), { game: activeGame, pitchDraft, fieldingPosition, selectedResult, recordColumnDraft }].slice(-20);
            updateActiveGame((game) => finishGameWithEarlyEndAnnotation(game));
            announceOperationFeedback("success", "比賽結束註記已寫入", "已記錄 ///；比分、跑者與出局數均維持原狀。 ");
          },
        },
      ],
    );
  }, [activeGame, announceOperationFeedback, fieldingPosition, pitchDraft, recordColumnDraft, selectedResult, updateActiveGame]);

  const undoLastEvent = useCallback(() => {
    if (!activeGame) return;
    const history = gameHistoryRef.current[activeGame.id] ?? [];
    const previous = history[history.length - 1];
    if (!previous) {
      Alert.alert("沒有可回復的球", "尚未保存可回復的逐球快照。");
      return;
    }
    gameHistoryRef.current[activeGame.id] = history.slice(0, -1);
    updateData((current) => ({ ...current, games: current.games.map((game) => game.id === activeGame.id ? { ...previous.game, updatedAt: new Date().toISOString() } : game) }));
    setPitchDraft(previous.pitchDraft);
    setFieldingPosition(previous.fieldingPosition);
    setSelectedResult(previous.selectedResult);
    announceOperationFeedback("restore", "已回復上一筆紀錄", "已還原寫入前的比分、壘包、出局與逐步草稿。 ");
  }, [activeGame, announceOperationFeedback, updateData]);

  const setPrimaryTeam = useCallback((teamId: string) => {
    if (!data.teams.some((team) => team.id === teamId)) return;
    updateData((current) => ({ ...current, primaryTeamId: teamId }));
    setSelectedTeamId(teamId);
  }, [data.teams, updateData]);

  const createGame = useCallback(() => {
    if (newGameForm.awayTeamId === newGameForm.homeTeamId) {
      Alert.alert("主客隊不能相同", "請選擇兩支不同的球隊。");
      return;
    }
    const game = makeGame(newGameForm);
    updateData((current) => ({ ...current, games: [game, ...current.games], activeGameId: game.id }));
    setShowNewGame(false);
    setTab("record");
  }, [newGameForm, updateData]);

  const updateGameMeta = useCallback((patch: Partial<Game>) => {
    updateActiveGame((game) => ({ ...game, ...patch, updatedAt: new Date().toISOString() }));
    setShowEditGame(false);
  }, [updateActiveGame]);

  const addSubstitution = useCallback((substitution: Omit<Substitution, "id" | "timestamp">) => {
    if (!activeGame) return;
    gameHistoryRef.current[activeGame.id] = [...(gameHistoryRef.current[activeGame.id] ?? []), { game: activeGame, pitchDraft, fieldingPosition, selectedResult, recordColumnDraft }].slice(-20);
    updateActiveGame((game) => ({
      ...game,
      substitutions: [...game.substitutions, { ...substitution, id: `sub-${Date.now()}`, timestamp: new Date().toISOString() }],
      updatedAt: new Date().toISOString(),
    }));
    setShowSubstitution(false);
    announceOperationFeedback("success", "換人已寫入", `${substitution.type}已記錄；人員與守備調整可使用「復原上一筆」回退。`);
  }, [activeGame, announceOperationFeedback, fieldingPosition, pitchDraft, recordColumnDraft, selectedResult, updateActiveGame]);

  const recordManualAtBat = useCallback((draft: ManualAtBatDraft) => {
    if (!activeGame) return;
    const timestamp = new Date().toISOString();
    const inning = Math.max(1, Math.floor(draft.inning || 1));
    const runsScored = Math.max(0, Math.floor(draft.runsScored || 0));
    const event = {
      id: `manual-ab-${Date.now()}`,
      inning,
      half: draft.half,
      batterId: draft.batterId,
      pitcherId: draft.pitcherId,
      result: draft.result,
      notation: draft.notation.trim() || draft.result,
      pitches: { balls: Math.max(0, draft.balls), strikes: Math.max(0, draft.strikes), total: Math.max(draft.total, draft.balls + draft.strikes, 0) },
      outsBefore: Math.min(2, Math.max(0, Math.floor(draft.outsBefore || 0))),
      runsScored,
      source: "manual" as const,
      timestamp,
    };
    gameHistoryRef.current[activeGame.id] = [...(gameHistoryRef.current[activeGame.id] ?? []), { game: activeGame, pitchDraft, fieldingPosition, selectedResult, recordColumnDraft }].slice(-20);
    updateActiveGame((game) => ({
      ...game,
      score: ensureScoreThroughInning(game.score, inning).map((row) => row.inning === inning ? { ...row, [draft.half]: row[draft.half] + runsScored } : row),
      events: [...game.events, event],
      updatedAt: timestamp,
    }));
    setShowManualAtBat(false);
    setRecordLastRefreshedAt(timestamp);
  }, [activeGame, fieldingPosition, pitchDraft, recordColumnDraft, selectedResult, updateActiveGame]);

  const applyFormalBlankSlotCorrection = useCallback((slot: ScorebookBlankSlot, replacementEvent: AtBatEvent, note?: string) => {
    if (!activeGame) return;
    try {
      const corrected = applyFormalScorebookBlankCorrection(activeGame, { slot, replacementEvent, note });
      gameHistoryRef.current[activeGame.id] = [...(gameHistoryRef.current[activeGame.id] ?? []), { game: activeGame, pitchDraft, fieldingPosition, selectedResult, recordColumnDraft }].slice(-20);
      updateActiveGame(() => corrected);
      setRecordLastRefreshedAt(corrected.updatedAt);
      announceOperationFeedback("success", "正式更正已套用", `第 ${slot.inning} 局${slot.side === "away" ? "上" : "下"}的補登已重播；比分、出局、跑壘與投打統計已重新計算。`);
    } catch (error) {
      Alert.alert("目前不可正式更正", error instanceof Error ? error.message : "請在半局結束後或比賽完場後再試。");
    }
  }, [activeGame, announceOperationFeedback, fieldingPosition, pitchDraft, recordColumnDraft, selectedResult, updateActiveGame]);

  const applyFormalAtBatReplacement = useCallback((slot: ScorebookBlankSlot, targetEvent: AtBatEvent, replacementEvent: AtBatEvent, note?: string) => {
    if (!activeGame) return;
    try {
      const corrected = applyFormalScorebookAtBatReplacement(activeGame, { targetEventId: targetEvent.id, slot, replacementEvent, note });
      gameHistoryRef.current[activeGame.id] = [...(gameHistoryRef.current[activeGame.id] ?? []), { game: activeGame, pitchDraft, fieldingPosition, selectedResult, recordColumnDraft }].slice(-20);
      updateActiveGame(() => corrected);
      setRecordLastRefreshedAt(corrected.updatedAt);
      announceOperationFeedback("success", "單一打席已正式重建", "僅重建此單一打席；其他打席不變，並保留原始與重建內容的更正歷程。 ");
    } catch (error) {
      Alert.alert("目前不可正式重建", error instanceof Error ? error.message : "請在半局結束後或比賽完場後再試。 ");
    }
  }, [activeGame, announceOperationFeedback, fieldingPosition, pitchDraft, recordColumnDraft, selectedResult, updateActiveGame]);

  const exportPdf = useCallback(async (filter?: GameReportFilter) => {
    try {
      await shareGamePdf(activeGame, awayTeam, homeTeam, filter);
      Alert.alert("PDF 已準備完成", "已依選定局數／時間範圍產生，可從系統分享面板傳送或儲存。 ");
    } catch {
      Alert.alert("輸出失敗", "目前無法產生 PDF，請稍後再試。 ");
    }
  }, [activeGame, awayTeam, homeTeam]);

  const exportImage = useCallback(async (filter?: GameReportFilter) => {
    try {
      await shareGameImage(activeGame, awayTeam, homeTeam, filter);
      Alert.alert("圖片已準備完成", "已依選定局數／時間範圍產生單場紀錄圖片，可分享或儲存。 ");
    } catch {
      Alert.alert("輸出失敗", "目前無法產生圖片，請稍後再試。 ");
    }
  }, [activeGame, awayTeam, homeTeam]);

  const exportVerifiedScoreCsv = useCallback(async () => {
    if (!isFuxing2026VerifiedScoreGame(activeGame)) {
      Alert.alert("尚無可匯出的已核對 CSV", "CSV 僅提供逐局與最終比分皆已核對、且未再由使用者修改的內建復興少棒67場次。");
      return;
    }
    try {
      await shareGameScoreCsv(activeGame, awayTeam, homeTeam);
      Alert.alert("CSV 已準備完成", "已匯出基本比分與逐局資料，可從系統分享面板儲存或交由試算表開啟。未包含未核對的逐球或個人統計。");
    } catch {
      Alert.alert("輸出失敗", "目前無法產生 CSV，請稍後再試。");
    }
  }, [activeGame, awayTeam, homeTeam]);

  const openExportRange = useCallback(() => {
    setExportFilter({ fromInning: 1, toInning: Math.max(activeGame.inning, 1) });
    setShowExportRange(true);
  }, [activeGame.inning]);

  const recordSyncState: "synced" | "pending" | "refreshing" = recordRefreshing ? "refreshing" : "synced";

  const refreshGameRecord = useCallback(async () => {
    setRecordRefreshing(true);
    try {
      setRecordLastRefreshedAt(new Date().toISOString());
    } finally {
      setRecordLastRefreshedAt(new Date().toISOString());
      setRecordRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!recordAutoRefresh || tab !== "gameLog" || !activeGame) return;
    const timer = setInterval(() => { void refreshGameRecord(); }, 5000);
    return () => clearInterval(timer);
  }, [activeGame?.id, recordAutoRefresh, refreshGameRecord, tab]);

  useEffect(() => {
    if (activeGame?.updatedAt) setRecordLastRefreshedAt(activeGame.updatedAt);
  }, [activeGame?.updatedAt]);

  const updatePlayer = useCallback((teamId: string, playerId: string, patch: Partial<Player>) => {
    updateData((current) => ({
      ...current,
      teams: current.teams.map((team) => team.id === teamId ? { ...team, players: team.players.map((player) => player.id === playerId ? { ...player, ...patch } : player) } : team),
    }));
  }, [updateData]);

  const addPlayer = useCallback((teamId: string, player: Player) => {
    updateData((current) => ({
      ...current,
      teams: current.teams.map((team) => team.id === teamId ? { ...team, players: [...team.players, player], updatedAt: new Date().toISOString() } : team),
    }));
  }, [updateData]);

  const deletePlayer = useCallback((teamId: string, playerId: string) => {
    updateData((current) => ({
      ...current,
      teams: current.teams.map((team) => team.id === teamId ? { ...team, players: team.players.filter((player) => player.id !== playerId), updatedAt: new Date().toISOString() } : team),
    }));
  }, [updateData]);

  const updateTeam = useCallback((teamId: string, patch: Partial<Pick<Team, "logoUri" | "customColor">>) => {
    updateData((current) => ({
      ...current,
      teams: current.teams.map((team) => team.id === teamId ? { ...team, ...patch, updatedAt: new Date().toISOString() } : team),
    }));
  }, [updateData]);

  const assignBattingOrder = useCallback((teamId: string, playerId: string, battingOrder: number | undefined) => {
    updateData((current) => ({
      ...current,
      teams: current.teams.map((team) => {
        if (team.id !== teamId) return team;
        return {
          ...team,
          players: team.players.map((player) => {
            if (player.id === playerId) return { ...player, battingOrder };
            if (battingOrder !== undefined && player.battingOrder === battingOrder) return { ...player, battingOrder: undefined };
            return player;
          }),
        };
      }),
    }));
  }, [updateData]);

  if (!hydrated || !activeGame || !awayTeam || !homeTeam) {
    return <ScreenContainer className="p-5"><View style={styles.loading}><Text style={styles.loadingText}>載入比賽紀錄中…</Text></View></ScreenContainer>;
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]} containerClassName="bg-background">
      <View style={[styles.appShell, themedChrome.shell]}>
        <OperationFeedbackToast feedback={operationFeedback} onDismiss={() => setOperationFeedback(null)} />
        <View style={[styles.topBar, themedChrome.topBar]}>
          <View style={[styles.brandMark, isDarkInterface && styles.brandMarkDark]}><Image source={require("../../assets/images/baseball-scorecard-logo.png")} style={styles.brandMarkImage} resizeMode="cover" accessibilityLabel="Baseball Scorer 記分圖示" /></View>
          <View style={styles.brandCopy}><Text style={[styles.brandName, themedChrome.brandName]}>Baseball Scorer</Text><Text style={[styles.brandSub, themedChrome.brandSub]}>專業棒球紀錄</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="本機資料保存說明" onPress={() => Alert.alert("本機離線資料", "本版本的球隊、球員與逐球紀錄會自動保存於本裝置。解除安裝或換機前，請先匯出需要留存的紀錄。")} style={({ pressed }) => [styles.syncPill, pressed && styles.pressed]}><View style={[styles.syncDot, styles.syncLocal]} /><Text style={styles.syncText}>本機資料</Text></Pressable>
          <View accessibilityLabel={`${orientationDiagnostic.label}：${orientationDiagnostic.detail}`} style={[styles.orientationDiagnosticPill, orientationDiagnostic.healthy ? styles.orientationDiagnosticHealthy : styles.orientationDiagnosticPending]}><View style={[styles.orientationDiagnosticDot, orientationDiagnostic.healthy ? styles.orientationDiagnosticDotHealthy : styles.orientationDiagnosticDotPending]} /><Text style={styles.orientationDiagnosticText}>{orientationDiagnostic.label}·{orientationDiagnostic.detail}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="重新鎖定橫式方向" onPress={() => { void relockLandscape(); }} style={({ pressed }) => [styles.orientationRelockPill, pressed && styles.pressed]}><Text style={styles.orientationRelockText}>↻ 重新鎖定</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="開啟軟體設定" onPress={() => setShowSoftwareSettings(true)} style={({ pressed }) => [styles.settingsPill, themedChrome.settingsPill, pressed && styles.pressed]}><Text style={[styles.settingsPillIcon, themedChrome.settingsPillText]}>⚙</Text><Text style={[styles.settingsPillText, themedChrome.settingsPillText]}>設定</Text></Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {tab === "home" ? (
            <HomeView data={data} activeGame={activeGame} awayTeam={awayTeam} homeTeam={homeTeam} userName="記錄員" isDarkInterface={isDarkInterface} lastLocalSavedAt={lastLocalSavedAt} localStorageSizeLabel={localStorageSizeLabel} teams={data.teams} schools={data.schools} primaryTeamId={data.primaryTeamId} selectedTeamId={selectedTeamId} pendingDeletedGame={pendingDeletedGame?.game ?? null} onSelectTeam={setSelectedTeamId} onUpdatePlayer={updatePlayer} onAddPlayer={addPlayer} onDeletePlayer={deletePlayer} onUpdateTeam={updateTeam} onAssignBattingOrder={assignBattingOrder} onManageSchools={() => setShowSchoolManager(true)} onImportFuxing={importFuxingRecords} onStart={startGame} onCreate={() => setShowNewGame(true)} onOpenSymbolReference={() => setShowSymbolReference(true)} onOpenTutorial={openTutorial} onCreatePrimaryTeam={() => setShowPrimaryTeamWizard(true)} onOpenGame={(gameId) => { updateData((current) => ({ ...current, activeGameId: gameId })); setTab("gameLog"); }} onDeleteGame={deleteRecentGame} onRestoreDeletedGame={restoreDeletedGame} />
          ) : null}
          {tab === "record" ? (
            <RecordView game={activeGame} games={data.games} away={awayTeam} home={homeTeam} myTeam={primaryTeam} mySide={primarySide} battingTeam={currentBattingTeam} pitchingTeam={currentPitchingTeam} batter={currentBatter} pitcher={currentPitcher} teamPerformance={currentBattingPerformance} awayPerformance={awayPerformance} homePerformance={homePerformance} pitchDraft={pitchDraft} fieldingPosition={fieldingPosition} selectedResult={selectedResult} selectedPitchType={selectedPitchType} selectedPitchZone={selectedPitchZone} recordColumnDraft={recordColumnDraft} recentEvents={recentEvents} canUndo={(gameHistoryRef.current[activeGame.id] ?? []).length > 0} onUndo={undoLastEvent} onRunnerAction={recordRunnerAction} onSubstitute={(role: SubstitutionType = "代打") => { setSubstitutionPreset(role); setShowSubstitution(true); }} onSpecialEvent={() => setShowSpecialEvent(true)} onStart={startGame} onPitch={recordPitch} onSelectResult={setSelectedResult} onClearSelectedResult={() => setSelectedResult(null)} onOutcome={(result, recordColumnOverride) => recordOutcome(result, pitchDraft, recordColumnOverride)} onPosition={setFieldingPosition} onRecordColumnChange={setRecordColumnDraft} onPitchType={setSelectedPitchType} onPitchZone={setSelectedPitchZone} onEdit={() => setShowEditGame(true)} onFinish={finishGame} onOpenSymbolReference={() => setShowSymbolReference(true)} onOpenSymbolHelp={setSymbolHelp} onUpdatePlayer={updatePlayer} />
          ) : null}
          {tab === "gameLog" && scorebookGame && scorebookAwayTeam && scorebookHomeTeam ? (
            <SingleGameRecord game={scorebookGame} games={scorebookGames} away={scorebookAwayTeam} home={scorebookHomeTeam} isReadOnly={Boolean(wbcDisplayExample)} onSelectGame={(gameId) => {
              const example = getWbc2013DisplayExample(gameId);
              setSelectedGameRecordRow(null);
              setRecordCorrectionInitialStep("detail");
              if (example) {
                setWbcDisplayExampleId(example.id);
                return;
              }
              setWbcDisplayExampleId(null);
              updateData((current) => ({ ...current, activeGameId: gameId }));
            }} onSaveDisplayOverrides={(scorebookDisplayOverrides) => updateActiveGame((game) => ({ ...game, scorebookDisplayOverrides, updatedAt: new Date().toISOString() }))} onApplyFormalBlankSlotCorrection={applyFormalBlankSlotCorrection} onApplyFormalAtBatReplacement={applyFormalAtBatReplacement} formalAtBatReplacement={formalAtBatReplacement} onFormalAtBatReplacementHandled={() => setFormalAtBatReplacement(null)} onRefresh={refreshGameRecord} autoRefresh={recordAutoRefresh} refreshing={recordRefreshing} lastRefreshedAt={recordLastRefreshedAt} syncState={recordSyncState} onToggleAutoRefresh={() => setRecordAutoRefresh((value) => !value)} onOpenExportRange={openExportRange} onSelectRow={(row) => { setRecordCorrectionInitialStep("detail"); setSelectedGameRecordRow(row); }} onOpenCorrection={(row) => { setRecordCorrectionInitialStep("target"); setSelectedGameRecordRow(row); }} canUndo={!wbcDisplayExample && (gameHistoryRef.current[activeGame.id] ?? []).length > 0} onUndo={undoLastEvent} />
          ) : null}
          {tab === "stats" ? (
            <StatsViewV2 game={activeGame} games={data.games} away={awayTeam} home={homeTeam} primaryTeam={primaryTeam} primaryTeamGames={primaryTeamGames} primarySide={primarySide} tab={statsTab} onTab={setStatsTab} onSetPrimaryTeam={setPrimaryTeam} onUpdatePlayer={updatePlayer} onOpenExportRange={openExportRange} />
          ) : null}
        </ScrollView>

        <View style={[styles.bottomNav, themedChrome.bottomNav]}>
          <NavButton label="首頁" icon="⌂" active={tab === "home"} onPress={() => setTab("home")} />
          <NavButton label="現場記錄" icon="◉" active={tab === "record"} onPress={() => setTab("record")} emphasis />
          <NavButton label="單場整體紀錄" icon="▤" active={tab === "gameLog"} onPress={() => setTab("gameLog")} />
          <NavButton label="統計預覽" icon="▥" active={tab === "stats"} onPress={() => setTab("stats")} />
        </View>
      </View>

      <NewGameModal visible={showNewGame} form={newGameForm} teams={data.teams} games={data.games} onChange={setNewGameForm} onCreateTeam={addSchool} onClose={() => setShowNewGame(false)} onSubmit={createGame} />
      <EditGameModal visible={showEditGame} game={activeGame} onClose={() => setShowEditGame(false)} onSave={updateGameMeta} />
      <SubstitutionModal visible={showSubstitution} game={activeGame} teams={data.teams} initialType={substitutionPreset} initialHandoffPitchNumber={pitchDraft.total} onClose={() => setShowSubstitution(false)} onSubmit={addSubstitution} />
      <ManualAtBatModal visible={showManualAtBat} game={activeGame} away={awayTeam} home={homeTeam} onClose={() => setShowManualAtBat(false)} onSubmit={recordManualAtBat} />
      <SpecialEventModal visible={showSpecialEvent} game={activeGame} teams={data.teams} onClose={() => setShowSpecialEvent(false)} onSubmit={recordSpecialEvent} />
      <SchoolManagerModal visible={showSchoolManager} schools={data.schools} onClose={() => setShowSchoolManager(false)} onAdd={addSchool} onUpdate={updateSchool} onDuplicate={duplicateSchool} onDelete={deleteSchool} />
      <PrimaryTeamWizard visible={showPrimaryTeamWizard} teams={data.teams} onClose={() => setShowPrimaryTeamWizard(false)} onSubmit={createPrimaryTeamFromWizard} />
      <ExportRangeModal visible={showExportRange} game={activeGame} initialFilter={exportFilter} canExportVerifiedScoreCsv={isFuxing2026VerifiedScoreGame(activeGame)} onClose={() => setShowExportRange(false)} onExport={(filter, format) => { setShowExportRange(false); if (format === "pdf") void exportPdf(filter); else if (format === "image") void exportImage(filter); else void exportVerifiedScoreCsv(); }} />
      <GameRecordDetailModal row={selectedGameRecordRow} game={activeGame} initialStep={recordCorrectionInitialStep} onClose={() => { setSelectedGameRecordRow(null); setRecordCorrectionInitialStep("detail"); }} onSave={saveRecordCorrection} onSaveBatch={saveRecordCorrectionBatch} onReplaceAll={(eventId, target, value, note) => { replaceAllRecordCorrections(eventId, target, value, note); setSelectedGameRecordRow(null); setRecordCorrectionInitialStep("detail"); }} onClearAll={clearAllRecordCorrections} />
      <SymbolReferenceModal visible={showSymbolReference} onClose={() => setShowSymbolReference(false)} />
      <SymbolHelpModal help={symbolHelp} onClose={() => setSymbolHelp(null)} />
      <OnboardingTutorialModal visible={showTutorial} step={tutorialStep} onChangeStep={setTutorialStep} onOpenSymbols={() => { completeTutorial(); setShowSymbolReference(true); }} onComplete={completeTutorial} />
      <SoftwareSettingsModal visible={showSoftwareSettings} accountName="記錄員" accountEmail={null} isAuthenticated={false} cloudSyncState="local" cloudSyncStage="local" lastLocalSavedAt={lastLocalSavedAt} localStorageSizeLabel={localStorageSizeLabel} interfaceColorMode={interfaceColorMode} customColor={customInterfaceColor} onClose={() => setShowSoftwareSettings(false)} onLogin={() => undefined} onLogout={() => undefined} onSyncNow={() => undefined} onExportLocalBackup={() => { void exportLocalBackup(); }} onImportLocalBackup={() => { void importLocalBackup(); }} onOpenTeams={() => { setShowSoftwareSettings(false); setShowPrimaryTeamWizard(true); }} onOpenSchools={() => { setShowSoftwareSettings(false); setShowSchoolManager(true); }} onOpenReadingPreferences={() => { setShowSoftwareSettings(false); router.push("/reading-preferences"); }} onCreatePrimaryTeam={() => { setShowSoftwareSettings(false); setShowPrimaryTeamWizard(true); }} onSetColorMode={(mode) => { setInterfaceColorMode(mode); if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => undefined); }} onSetCustomColor={setCustomInterfaceColor} onRestoreInitial={restoreInitialSettings} />
    </ScreenContainer>
  );
}

function OperationFeedbackToast({ feedback, onDismiss }: { feedback: OperationFeedback | null; onDismiss: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    if (!feedback) return;
    opacity.stopAnimation();
    translateY.stopAnimation();
    opacity.setValue(0);
    translateY.setValue(-8);
    const enter = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]);
    const leave = Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -6, duration: 180, useNativeDriver: true }),
    ]);
    enter.start();
    const timer = setTimeout(() => leave.start(({ finished }) => { if (finished) onDismiss(); }), 2500);
    return () => {
      clearTimeout(timer);
      leave.stop();
    };
  }, [feedback?.id, onDismiss, opacity, translateY]);

  if (!feedback) return null;
  const isRestore = feedback.tone === "restore";
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.operationFeedbackToast, isRestore ? styles.operationFeedbackRestore : styles.operationFeedbackSuccess, { opacity, transform: [{ translateY }] }]}
    >
      <Text style={[styles.operationFeedbackIcon, isRestore && styles.operationFeedbackRestoreIcon]}>{isRestore ? "↶" : "✓"}</Text>
      <View style={styles.operationFeedbackCopy}>
        <Text style={styles.operationFeedbackTitle}>{feedback.title}</Text>
        <Text numberOfLines={1} style={styles.operationFeedbackDetail}>{feedback.detail}</Text>
      </View>
    </Animated.View>
  );
}

function SoftwareSettingsModal({ visible, accountName, accountEmail, isAuthenticated, cloudSyncState, cloudSyncStage, lastCloudSyncedAt, lastLocalSavedAt, localStorageSizeLabel, interfaceColorMode, customColor, onClose, onLogin, onLogout, onSyncNow, onExportLocalBackup, onImportLocalBackup, onOpenTeams, onOpenSchools, onOpenReadingPreferences, onCreatePrimaryTeam, onSetColorMode, onSetCustomColor, onRestoreInitial }: { visible: boolean; accountName: string; accountEmail?: string | null; isAuthenticated: boolean; cloudSyncState: "local" | "syncing" | "ready" | "conflict"; cloudSyncStage: CloudSyncStage; lastCloudSyncedAt?: string; lastLocalSavedAt?: string | null; localStorageSizeLabel?: string; interfaceColorMode: InterfaceColorMode; customColor: string; onClose: () => void; onLogin: () => void; onLogout: () => void; onSyncNow: () => void; onExportLocalBackup: () => void; onImportLocalBackup: () => void; onOpenTeams: () => void; onOpenSchools: () => void; onOpenReadingPreferences: () => void; onCreatePrimaryTeam: () => void; onSetColorMode: (mode: InterfaceColorMode) => void; onSetCustomColor: (color: string) => void; onRestoreInitial: () => void }) {
  const { interfacePalette } = useThemeContext();
  const systemColorScheme = useNativeColorScheme() ?? "light";
  const settingsTheme = useMemo(() => ({
    sheet: { backgroundColor: interfacePalette.background },
    handle: { backgroundColor: interfacePalette.border },
    title: { color: interfacePalette.foreground },
    subtitle: { color: interfacePalette.muted },
    close: { color: interfacePalette.primary },
    section: { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border },
    sectionTitle: { color: interfacePalette.foreground },
    hint: { color: interfacePalette.muted },
    input: { backgroundColor: interfacePalette.background, borderColor: interfacePalette.border, color: interfacePalette.foreground },
    option: { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border },
    optionActive: { backgroundColor: interfacePalette.background, borderColor: interfacePalette.primary },
    optionLabel: { color: interfacePalette.foreground },
    optionLabelActive: { color: interfacePalette.primary },
    statusCard: { backgroundColor: interfacePalette.background, borderColor: interfacePalette.success },
    apkCard: { backgroundColor: interfacePalette.background, borderColor: interfacePalette.border },
    apkStep: { backgroundColor: interfacePalette.surface, color: interfacePalette.muted },
    resetSection: { backgroundColor: interfacePalette.background, borderColor: interfacePalette.error },
  }), [interfacePalette]);
  const palettePreviewForMode = useCallback((mode: InterfaceColorMode) => resolveInterfacePalette(mode === "system" ? systemColorScheme : "light", mode, customColor), [customColor, systemColorScheme]);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [customColorInput, setCustomColorInput] = useState(customColor);
  const [pendingPalette, setPendingPalette] = useState<PaletteTransferPayload | null>(null);
  const [apkBuildGuideStage, setApkBuildGuideStage] = useState<"idle" | "checking" | "ready">("idle");
  const apkBuildGuideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startApkBuildGuide = () => {
    if (apkBuildGuideTimer.current) clearTimeout(apkBuildGuideTimer.current);
    setApkBuildGuideStage("checking");
    apkBuildGuideTimer.current = setTimeout(() => {
      setApkBuildGuideStage("ready");
      apkBuildGuideTimer.current = null;
    }, 900);
  };

  const renderOfflineSettings = () => {
    return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={[styles.modalSheet, styles.settingsModalSheet]}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>軟體設定</Text><Text style={styles.modalSubtitle}>Baseball Scorer Pro 1.1.1 · 球隊、介面與本機資料管理</Text></View><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="關閉軟體設定"><Text style={styles.modalClose}>關閉</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.settingsLandscape}><View style={[styles.settingsSection, styles.settingsAccountSection]}><Text style={styles.settingsSectionTitle}>本機資料儲存</Text><View style={[styles.cloudSyncStatusCard, { borderColor: BRAND.green }]}><View><Text style={[styles.cloudSyncStatusLabel, { color: BRAND.green }]}>本機已保存</Text><Text style={styles.cloudSyncStatusHint}>球隊、隊徽、球員、場次與早稻田逐球紀錄會自動寫入此裝置的本機儲存空間。</Text></View></View><Text style={styles.settingsHint}>此版本尚未部署雲端同步。解除安裝或換機前，請先使用各場次的 PDF／圖片匯出功能保留紀錄。</Text><Text style={styles.settingsVersion}>目前版本 1.1.1 · 離線模式</Text></View><View style={styles.settingsSection}><Text style={styles.settingsSectionTitle}>球隊設定</Text><Text style={styles.settingsHint}>統一管理所屬球隊、其他隊伍、隊徽建議底色及球員背號、投打慣用手。</Text><Button label="所屬球隊／球員資料" compact onPress={onOpenTeams} /><View style={styles.settingsButtonGap} /><Button label="其他隊伍與隊色建議" variant="secondary" compact onPress={onOpenTeams} /><View style={styles.settingsButtonGap} /><Button label="學校／隊伍資料庫" variant="secondary" compact onPress={onOpenSchools} /></View><View style={[styles.settingsSection, styles.settingsThemeSection]}><Text style={styles.settingsSectionTitle}>介面配色</Text><Text style={styles.settingsHint}>選擇全域工作台配色；深色模式適合夜間場地，色票不會覆蓋主客隊的隊色辨識。</Text><View style={styles.interfacePaletteGrid}>{INTERFACE_COLOR_MODES.map((mode) => <Pressable key={mode.id} onPress={() => onSetColorMode(mode.id)} style={[styles.interfacePaletteOption, interfaceColorMode === mode.id && styles.interfacePaletteOptionActive]}><View style={[styles.interfacePaletteDot, { backgroundColor: mode.preview }]} /><View style={styles.interfacePaletteCopy}><Text style={[styles.interfacePaletteLabel, interfaceColorMode === mode.id && styles.interfacePaletteLabelActive]}>{mode.label}</Text><Text style={styles.interfacePaletteHint}>{mode.hint}</Text></View></Pressable>)}</View><View style={styles.customThemeRow}><TextInput value={customColorInput} onChangeText={setCustomColorInput} autoCapitalize="characters" maxLength={7} placeholder="#7C3AED" placeholderTextColor={BRAND.muted} style={styles.customThemeInput} /><Button label="套用自訂" variant="secondary" compact onPress={applyCustomColor} /></View><View style={styles.customThemeRow}><Button label="匯出色票 ↑" variant="secondary" compact onPress={() => { void exportCustomPalette(); }} /><Button label="匯入色票 ↓" variant="secondary" compact onPress={() => { void importCustomPalette(); }} /></View><Text style={styles.settingsHint}>色票會以 JSON 保存；可備份或分享給其他球隊成員，匯入後立即套用。</Text></View><View style={[styles.settingsSection, styles.settingsResetSection]}><Text style={styles.settingsSectionTitle}>還原初始設定</Text><Text style={styles.settingsHint}>此操作會移除目前裝置的球隊、球員、賽事與介面設定，改回內建示範資料；資料僅保存於此裝置。</Text>{resetStep === 0 ? <Button label="開始安全還原" variant="danger" compact onPress={() => setResetStep(1)} /> : null}{resetStep === 1 ? <><Text style={styles.resetWarning}>第一次確認：所有目前本機資料都會被新的初始資料取代。</Text><Button label="我了解並繼續" variant="danger" compact onPress={() => { setResetStep(2); setCountdown(6); }} /><View style={styles.settingsButtonGap} /><Button label="取消" variant="secondary" compact onPress={() => setResetStep(0)} /></> : null}{resetStep === 2 ? <><Text style={styles.resetWarning}>第二次確認：請輸入「還原」，並等待倒數結束才可執行。</Text><TextInput value={confirmText} onChangeText={setConfirmText} placeholder="輸入：還原" placeholderTextColor={BRAND.muted} style={styles.customThemeInput} /><Pressable disabled={!resetEnabled} onPress={() => { onRestoreInitial(); onClose(); }} style={[styles.safeResetButton, !resetEnabled && styles.safeResetButtonDisabled]}><Text style={styles.safeResetButtonText}>{countdown > 0 ? `安全等待 ${countdown} 秒` : confirmText.trim() !== "還原" ? "請輸入「還原」" : "確認還原初始設定"}</Text></Pressable><Pressable onPress={() => { setResetStep(0); setConfirmText(""); }}><Text style={styles.resetCancelText}>取消還原</Text></Pressable></> : null}</View></ScrollView></View></View></Modal>;
  }

  const renderOfflineSettingsWithBackup = () => (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalSheet, styles.settingsModalSheet, settingsTheme.sheet]}>
          <View style={[styles.modalHandle, settingsTheme.handle]} />
          <View style={styles.modalHeader}>
            <View><Text style={[styles.modalTitle, settingsTheme.title]}>軟體設定</Text><Text style={[styles.modalSubtitle, settingsTheme.subtitle]}>Baseball Scorer Pro {APP_VERSION} · 球隊、介面與本機資料管理</Text></View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="關閉軟體設定"><Text style={[styles.modalClose, settingsTheme.close]}>關閉</Text></Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.settingsLandscape}>
            <View style={[styles.settingsSection, styles.settingsAccountSection, settingsTheme.section]}>
              <Text style={[styles.settingsSectionTitle, settingsTheme.sectionTitle]}>本機資料儲存</Text>
              <View style={[styles.cloudSyncStatusCard, settingsTheme.statusCard]}>
                <View><Text style={[styles.cloudSyncStatusLabel, { color: interfacePalette.success }]}>本機自動保存已啟用</Text><Text style={[styles.cloudSyncStatusHint, settingsTheme.hint]}>最近保存：{formatLocalSavedAt(lastLocalSavedAt)}　·　目前容量：{localStorageSizeLabel ?? "計算中"}</Text></View>
              </View>
              <Text style={[styles.settingsHint, settingsTheme.hint]}>完整備份包含球隊、隊徽、球員、賽事與逐球紀錄。解除安裝或換機前，請先匯出 JSON 備份並保存到「檔案」或雲端硬碟。</Text>
              <View style={styles.localBackupActions}><Button label="匯出本機備份 ↑" compact onPress={onExportLocalBackup} /><Button label="匯入還原 ↓" variant="secondary" compact onPress={onImportLocalBackup} /></View>
              <Text style={[styles.settingsVersion, settingsTheme.hint]}>目前版本 {APP_VERSION} · 單機離線模式</Text>
              <Text style={[styles.settingsBuildMeta, settingsTheme.optionLabel]}>建置識別碼：{APP_BUILD_IDENTIFIER}</Text>
              <Text style={[styles.settingsBuildMeta, settingsTheme.optionLabel]}>建置日期：{APP_BUILD_DATE}</Text>
            </View>
            <View style={[styles.settingsSection, styles.settingsApkBuildSection, settingsTheme.section]}>
              <Text style={[styles.settingsSectionTitle, settingsTheme.sectionTitle]}>Android APK 建置</Text>
              <Text style={[styles.settingsHint, settingsTheme.hint]}>此離線 App 不會在裝置上直接編譯 APK；請先完成建置前檢查，再到專案管理介面按下 Publish，由 Android 建置服務產生可下載的 APK。</Text>
              <View style={[styles.apkBuildStatusCard, settingsTheme.apkCard, apkBuildGuideStage === "checking" && styles.apkBuildStatusCardChecking, apkBuildGuideStage === "ready" && styles.apkBuildStatusCardReady]} accessibilityLiveRegion="polite">
                <View style={styles.apkBuildStatusHeader}>
                  {apkBuildGuideStage === "checking" ? <ActivityIndicator size="small" color={interfacePalette.primary} /> : <View style={[styles.apkBuildStageMark, { backgroundColor: interfacePalette.primary }, apkBuildGuideStage === "ready" && { backgroundColor: interfacePalette.success }]}><Text style={[styles.apkBuildStageMarkText, { color: readableTextOn(apkBuildGuideStage === "ready" ? interfacePalette.success : interfacePalette.primary) }]}>{apkBuildGuideStage === "ready" ? "✓" : "1"}</Text></View>}
                  <View style={styles.apkBuildStatusCopy}>
                    <Text style={[styles.apkBuildStatusTitle, settingsTheme.optionLabel]}>{apkBuildGuideStage === "checking" ? "正在檢查 APK 建置前置條件" : apkBuildGuideStage === "ready" ? "建置前檢查完成" : "尚未開始 APK 建置"}</Text>
                    <Text style={[styles.apkBuildStatusHint, settingsTheme.hint]}>{apkBuildGuideStage === "checking" ? "正在確認版本、建置識別與 Android 設定…" : apkBuildGuideStage === "ready" ? "下一步請在專案管理介面按 Publish，服務會顯示實際建置進度。" : "可先執行檢查，再將此已保存版本送交 Android 建置服務。"}</Text>
                  </View>
                </View>
                <View style={styles.apkBuildSteps}><Text style={[styles.apkBuildStep, apkBuildGuideStage !== "idle" && styles.apkBuildStepActive]}>1 檢查</Text><Text style={styles.apkBuildStepArrow}>→</Text><Text style={[styles.apkBuildStep, apkBuildGuideStage === "ready" && styles.apkBuildStepReady]}>2 Publish</Text><Text style={styles.apkBuildStepArrow}>→</Text><Text style={styles.apkBuildStep}>3 下載 APK</Text></View>
              </View>
              <Pressable disabled={apkBuildGuideStage === "checking"} onPress={startApkBuildGuide} style={({ pressed }) => [styles.apkBuildGuideAction, apkBuildGuideStage === "checking" && styles.apkBuildGuideActionDisabled, pressed && apkBuildGuideStage !== "checking" && styles.pressed]} accessibilityRole="button" accessibilityLabel="開始 APK 建置前檢查">
                <Text style={styles.apkBuildGuideActionText}>{apkBuildGuideStage === "checking" ? "建置前檢查中…" : apkBuildGuideStage === "ready" ? "再次檢查建置設定" : "開始 APK 建置前檢查"}</Text>
              </Pressable>
              <Text style={styles.apkBuildGuideNote}>實際的「建置中／成功／失敗」狀態會在 Publish 後的建置服務中顯示；本頁不會將準備動畫誤當成已完成 APK 編譯。</Text>
            </View>
            <View style={[styles.settingsSection, settingsTheme.section]}>
              <Text style={[styles.settingsSectionTitle, settingsTheme.sectionTitle]}>球隊設定</Text><Text style={[styles.settingsHint, settingsTheme.hint]}>統一管理所屬球隊、其他隊伍、隊徽建議底色及球員背號、投打慣用手。</Text>
              <Button label="所屬球隊／球員資料" compact onPress={onOpenTeams} /><View style={styles.settingsButtonGap} /><Button label="其他隊伍與隊色建議" variant="secondary" compact onPress={onOpenTeams} /><View style={styles.settingsButtonGap} /><Button label="學校／隊伍資料庫" variant="secondary" compact onPress={onOpenSchools} />
            </View>
            <View style={[styles.settingsSection, settingsTheme.section]}>
              <Text style={[styles.settingsSectionTitle, settingsTheme.sectionTitle]}>閱讀偏好</Text>
              <Text style={[styles.settingsHint, settingsTheme.hint]}>集中調整傳接放大檢視的字級；設定會保存於此裝置，且不會改動比賽紀錄。</Text>
              <Button label="開啟閱讀偏好" compact onPress={onOpenReadingPreferences} />
            </View>
            <View style={[styles.settingsSection, styles.settingsThemeSection, settingsTheme.section]}>
              <Text style={[styles.settingsSectionTitle, settingsTheme.sectionTitle]}>介面配色</Text><Text style={[styles.settingsHint, settingsTheme.hint]}>每個模式均會改變背景、表面、文字、邊框、按鈕與狀態色；主客隊專屬隊色仍會保留作辨識。</Text>
              <View style={styles.interfacePaletteGrid}>{INTERFACE_COLOR_MODES.map((mode) => { const active = interfaceColorMode === mode.id; const previewPalette = palettePreviewForMode(mode.id); return <Pressable key={mode.id} accessibilityRole="button" accessibilityLabel={`套用${mode.label}，${mode.hint}`} onPress={() => onSetColorMode(mode.id)} style={[styles.interfacePaletteOption, settingsTheme.option, active && styles.interfacePaletteOptionActive, active && settingsTheme.optionActive]}><InterfacePalettePreview palette={previewPalette} /><View style={styles.interfacePaletteCopy}><Text style={[styles.interfacePaletteLabel, settingsTheme.optionLabel, active && styles.interfacePaletteLabelActive, active && settingsTheme.optionLabelActive]}>{mode.label}</Text><Text style={[styles.interfacePaletteHint, settingsTheme.hint]}>{mode.hint}</Text></View></Pressable>; })}</View>
              <View style={styles.customThemeRow}><TextInput value={customColorInput} onChangeText={setCustomColorInput} autoCapitalize="characters" maxLength={7} placeholder="#7C3AED" placeholderTextColor={interfacePalette.muted} style={[styles.customThemeInput, settingsTheme.input]} /><Button label="套用自訂" variant="secondary" compact onPress={applyCustomColor} /></View>
              <View style={styles.customThemeRow}><Button label="匯出色票 ↑" variant="secondary" compact onPress={() => { void exportCustomPalette(); }} /><Button label="匯入色票 ↓" variant="secondary" compact onPress={() => { void importCustomPalette(); }} /></View><Text style={[styles.settingsHint, settingsTheme.hint]}>色票會以 JSON 保存；可備份或分享給其他球隊成員，匯入後立即套用。</Text>
            </View>
            <View style={[styles.settingsSection, styles.settingsResetSection, settingsTheme.resetSection]}>
              <Text style={[styles.settingsSectionTitle, settingsTheme.sectionTitle]}>還原初始設定</Text><Text style={[styles.settingsHint, settingsTheme.hint]}>此操作會移除目前裝置的球隊、球員、賽事與介面設定，改回內建示範資料；資料僅保存於此裝置。</Text>
              {resetStep === 0 ? <Button label="開始安全還原" variant="danger" compact onPress={() => setResetStep(1)} /> : null}
              {resetStep === 1 ? <><Text style={styles.resetWarning}>第一次確認：所有目前本機資料都會被新的初始資料取代。</Text><Button label="我了解並繼續" variant="danger" compact onPress={() => { setResetStep(2); setCountdown(6); }} /><View style={styles.settingsButtonGap} /><Button label="取消" variant="secondary" compact onPress={() => setResetStep(0)} /></> : null}
              {resetStep === 2 ? <><Text style={[styles.resetWarning, { color: interfacePalette.error }]}>第二次確認：請輸入「還原」，並等待倒數結束才可執行。</Text><TextInput value={confirmText} onChangeText={setConfirmText} placeholder="輸入：還原" placeholderTextColor={interfacePalette.muted} style={[styles.customThemeInput, settingsTheme.input]} /><Pressable disabled={!resetEnabled} onPress={() => { onRestoreInitial(); onClose(); }} style={[styles.safeResetButton, { backgroundColor: interfacePalette.error }, !resetEnabled && styles.safeResetButtonDisabled]}><Text style={[styles.safeResetButtonText, { color: readableTextOn(interfacePalette.error) }]}>{countdown > 0 ? `安全等待 ${countdown} 秒` : confirmText.trim() !== "還原" ? "請輸入「還原」" : "確認還原初始設定"}</Text></Pressable><Pressable onPress={() => { setResetStep(0); setConfirmText(""); }}><Text style={[styles.resetCancelText, settingsTheme.hint]}>取消還原</Text></Pressable></> : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  useEffect(() => {
    if (!visible) {
      if (apkBuildGuideTimer.current) clearTimeout(apkBuildGuideTimer.current);
      apkBuildGuideTimer.current = null;
      setApkBuildGuideStage("idle");
      setResetStep(0);
      setConfirmText("");
      setCountdown(0);
      setCustomColorInput(customColor);
      setPendingPalette(null);
    }
  }, [customColor, visible]);

  useEffect(() => () => { if (apkBuildGuideTimer.current) clearTimeout(apkBuildGuideTimer.current); }, []);

  useEffect(() => {
    if (resetStep !== 2 || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [countdown, resetStep]);

  const resetEnabled = resetStep === 2 && countdown === 0 && confirmText.trim() === "還原";
  const visibleCloudSyncStage: CloudSyncStage = cloudSyncState === "ready" ? "complete" : cloudSyncState === "conflict" ? "conflict" : cloudSyncState === "local" ? "local" : cloudSyncStage;
  const cloudStateMeta = CLOUD_SYNC_STAGES[visibleCloudSyncStage];
  const lastSyncLabel = lastCloudSyncedAt ? new Date(lastCloudSyncedAt).toLocaleString() : "尚未建立雲端快照";
  const applyCustomColor = () => {
    const normalized = customColorInput.trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(normalized)) {
      Alert.alert("色碼格式不正確", "請輸入 6 位十六進位色碼，例如 #7C3AED。");
      return;
    }
    onSetCustomColor(normalized);
    onSetColorMode("custom");
  };

  const exportCustomPalette = async () => {
    const paletteColor = normalizeTeamColor(customColorInput) ?? normalizeTeamColor(customColor) ?? "#7C3AED";
    const payload: PaletteTransferPayload = {
      version: "bsp-palette-1",
      label: "Baseball Scorer Pro 自訂色票",
      customColor: paletteColor,
      exportedAt: new Date().toISOString(),
    };
    const content = JSON.stringify(payload, null, 2);
    try {
      if (Platform.OS === "web") {
        const webDocument = globalThis.document;
        if (!webDocument || !globalThis.URL?.createObjectURL) throw new Error("目前瀏覽器不支援色票檔案下載。");
        const objectUrl = globalThis.URL.createObjectURL(new Blob([content], { type: "application/json" }));
        const downloadLink = webDocument.createElement("a");
        downloadLink.href = objectUrl;
        downloadLink.download = `bsp-palette-${Date.now()}.json`;
        webDocument.body.appendChild(downloadLink);
        downloadLink.click();
        webDocument.body.removeChild(downloadLink);
        globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(objectUrl), 0);
        Alert.alert("色票已下載", "已下載 JSON 色票檔，可傳送給其他球隊成員或留存備份。");
        return;
      }
      const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!directory) throw new Error("裝置暫存資料夾無法使用。");
      const fileUri = `${directory}bsp-palette-${Date.now()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
      if (!await Sharing.isAvailableAsync()) throw new Error("此裝置目前不支援系統分享。");
      await Sharing.shareAsync(fileUri, { mimeType: "application/json", dialogTitle: "分享 Baseball Scorer Pro 色票" });
    } catch (error) {
      Alert.alert("無法匯出色票", error instanceof Error ? error.message : "請稍後再試。");
    }
  };

  const importCustomPalette = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true, multiple: false });
      if (result.canceled) return;
      const asset = result.assets[0];
      const content = Platform.OS === "web" && asset.file ? await asset.file.text() : await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsed = parsePaletteTransfer(content);
      if (!parsed) {
        Alert.alert("色票檔案無法使用", "請選擇 Baseball Scorer Pro 匯出的 bsp-palette-1 JSON 色票檔。" );
        return;
      }
      setPendingPalette(parsed);
    } catch (error) {
      Alert.alert("無法匯入色票", error instanceof Error ? error.message : "請選擇有效的 JSON 色票檔。");
    }
  };

  if (OFFLINE_MODE) return renderOfflineSettingsWithBackup();

  if (pendingPalette) {
    return <Modal visible animationType="fade" transparent onRequestClose={() => setPendingPalette(null)}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>預覽匯入色票</Text><Text style={styles.modalSubtitle}>確認後才會覆寫目前的自訂配色</Text></View><Pressable onPress={() => setPendingPalette(null)}><Text style={styles.modalClose}>取消</Text></Pressable></View><View style={styles.wizardStepPanel}><Text style={styles.inputLabel}>來源色票</Text><Text style={styles.settingsAccountName}>{pendingPalette.label || "未命名色票"}</Text><Text style={styles.settingsHint}>格式：{pendingPalette.version}　匯出時間：{new Date(pendingPalette.exportedAt).toLocaleString()}</Text><View style={styles.teamBrandingCard}><View style={[styles.interfacePaletteDot, { width: 58, height: 58, borderRadius: 14, backgroundColor: pendingPalette.customColor }]} /><View style={styles.teamBrandingCopy}><Text style={styles.teamBrandingTitle}>{pendingPalette.customColor}</Text><Text style={styles.teamBrandingHint}>此色塊即為確認後套用於「自訂配色」模式的主色。</Text></View></View><View style={styles.wizardNavigation}><Button label="取消" variant="secondary" compact onPress={() => setPendingPalette(null)} /><Button label="確認套用色票" compact onPress={() => { setCustomColorInput(pendingPalette.customColor); onSetCustomColor(pendingPalette.customColor); onSetColorMode("custom"); setPendingPalette(null); Alert.alert("色票已匯入", `已套用 ${pendingPalette.customColor}。`); }} /></View></View></View></View></Modal>;
  }

  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={[styles.modalSheet, styles.settingsModalSheet]}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>軟體設定</Text><Text style={styles.modalSubtitle}>Baseball Scorer Pro 1.1.1 · 常用帳號、球隊、介面與資料管理</Text></View><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="關閉軟體設定"><Text style={styles.modalClose}>關閉</Text></Pressable></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.settingsLandscape}><View style={[styles.settingsSection, styles.settingsAccountSection]}><Text style={styles.settingsSectionTitle}>帳號與雲端資料</Text><View style={styles.accountIdentityRow}><View style={[styles.accountIdentityAvatar, { backgroundColor: cloudStateMeta.color }]}><Text style={styles.accountIdentityAvatarText}>{isAuthenticated ? accountName.slice(0, 1) : "雲"}</Text></View><View style={styles.accountIdentityCopy}><Text style={styles.settingsAccountName}>{isAuthenticated ? accountName : "尚未登入"}</Text><Text style={styles.settingsHint}>{isAuthenticated ? accountEmail || "已登入專屬帳號" : "登入後建立個人專屬的雲端資料空間。"}</Text></View></View><View style={[styles.cloudSyncStatusCard, { borderColor: cloudStateMeta.color }]}><View><Text style={[styles.cloudSyncStatusLabel, { color: cloudStateMeta.color }]}>{cloudStateMeta.label} · {cloudStateMeta.percent}%</Text><Text style={styles.cloudSyncStatusHint}>{cloudStateMeta.hint}</Text></View><View style={styles.cloudSyncProgressRow}><View style={styles.cloudSyncProgressTrack}><View style={[styles.cloudSyncProgressFill, { width: `${cloudStateMeta.percent}%`, backgroundColor: cloudStateMeta.color }]} /></View><Text style={[styles.cloudSyncProgressValue, { color: cloudStateMeta.color }]}>{cloudStateMeta.percent}%</Text></View><Text style={styles.cloudSyncTime}>上次同步：{lastSyncLabel}</Text></View><Text style={styles.settingsHint}>同步範圍：球隊、隊徽、球員資料、場次、早稻田逐球紀錄與個人統計。</Text>{isAuthenticated ? <><Button label={cloudSyncState === "syncing" ? "同步處理中" : "立即同步"} variant={cloudSyncState === "conflict" ? "danger" : "primary"} compact disabled={cloudSyncState === "syncing"} onPress={onSyncNow} /><View style={styles.settingsButtonGap} /><Button label="登出帳號" variant="secondary" compact onPress={onLogout} /></> : <Button label="登入並啟用雲端同步" variant="primary" compact onPress={onLogin} />}<Text style={styles.settingsVersion}>目前版本 1.1.1</Text></View><View style={styles.settingsSection}><Text style={styles.settingsSectionTitle}>球隊設定</Text><Text style={styles.settingsHint}>統一管理所屬球隊、其他隊伍、隊徽建議底色及球員背號、投打慣用手。</Text><Button label="所屬球隊／球員資料" compact onPress={onOpenTeams} /><View style={styles.settingsButtonGap} /><Button label="其他隊伍與隊色建議" variant="secondary" compact onPress={onOpenTeams} /><View style={styles.settingsButtonGap} /><Button label="學校／隊伍資料庫" variant="secondary" compact onPress={onOpenSchools} /></View><View style={[styles.settingsSection, styles.settingsThemeSection]}><Text style={styles.settingsSectionTitle}>介面配色</Text><Text style={styles.settingsHint}>選擇全域工作台配色；深色模式適合夜間場地，色票不會覆蓋主客隊的隊色辨識。</Text><View style={styles.interfacePaletteGrid}>{INTERFACE_COLOR_MODES.map((mode) => <Pressable key={mode.id} onPress={() => onSetColorMode(mode.id)} style={[styles.interfacePaletteOption, interfaceColorMode === mode.id && styles.interfacePaletteOptionActive]}><View style={[styles.interfacePaletteDot, { backgroundColor: mode.preview }]} /><View style={styles.interfacePaletteCopy}><Text style={[styles.interfacePaletteLabel, interfaceColorMode === mode.id && styles.interfacePaletteLabelActive]}>{mode.label}</Text><Text style={styles.interfacePaletteHint}>{mode.hint}</Text></View></Pressable>)}</View><View style={styles.customThemeRow}><TextInput value={customColorInput} onChangeText={setCustomColorInput} autoCapitalize="characters" maxLength={7} placeholder="#7C3AED" placeholderTextColor={BRAND.muted} style={styles.customThemeInput} /><Button label="套用自訂" variant="secondary" compact onPress={applyCustomColor} /></View><View style={styles.customThemeRow}><Button label="匯出色票 ↑" variant="secondary" compact onPress={() => { void exportCustomPalette(); }} /><Button label="匯入色票 ↓" variant="secondary" compact onPress={() => { void importCustomPalette(); }} /></View><Text style={styles.settingsHint}>色票會以 JSON 保存；可備份或分享給其他球隊成員，匯入後立即套用。</Text></View><View style={[styles.settingsSection, styles.settingsResetSection]}><Text style={styles.settingsSectionTitle}>還原初始設定</Text><Text style={styles.settingsHint}>此操作會移除目前裝置的球隊、球員、賽事與介面設定，改回內建示範資料；登入帳號不會登出。</Text>{resetStep === 0 ? <Button label="開始安全還原" variant="danger" compact onPress={() => setResetStep(1)} /> : null}{resetStep === 1 ? <><Text style={styles.resetWarning}>第一次確認：所有目前本機資料都會被新的初始資料取代。</Text><Button label="我了解並繼續" variant="danger" compact onPress={() => { setResetStep(2); setCountdown(6); }} /><View style={styles.settingsButtonGap} /><Button label="取消" variant="secondary" compact onPress={() => setResetStep(0)} /></> : null}{resetStep === 2 ? <><Text style={styles.resetWarning}>第二次確認：請輸入「還原」，並等待倒數結束才可執行。</Text><TextInput value={confirmText} onChangeText={setConfirmText} placeholder="輸入：還原" placeholderTextColor={BRAND.muted} style={styles.customThemeInput} /><Pressable disabled={!resetEnabled} onPress={() => { onRestoreInitial(); onClose(); }} style={[styles.safeResetButton, !resetEnabled && styles.safeResetButtonDisabled]}><Text style={styles.safeResetButtonText}>{countdown > 0 ? `安全等待 ${countdown} 秒` : confirmText.trim() !== "還原" ? "請輸入「還原」" : "確認還原初始設定"}</Text></Pressable><Pressable onPress={() => { setResetStep(0); setConfirmText(""); }}><Text style={styles.resetCancelText}>取消還原</Text></Pressable></> : null}</View></ScrollView></View></View></Modal>;
}

function HomeView({ data, activeGame, awayTeam, homeTeam, userName, isDarkInterface, lastLocalSavedAt, localStorageSizeLabel, teams, schools, primaryTeamId, selectedTeamId, pendingDeletedGame, onSelectTeam, onUpdatePlayer, onAddPlayer, onDeletePlayer, onUpdateTeam, onAssignBattingOrder, onManageSchools, onImportFuxing, onStart, onCreate, onOpenSymbolReference, onOpenTutorial, onCreatePrimaryTeam, onOpenGame, onDeleteGame, onRestoreDeletedGame }: { data: AppData; activeGame: Game; awayTeam: Team; homeTeam: Team; userName: string; isDarkInterface: boolean; lastLocalSavedAt: string | null; localStorageSizeLabel: string; teams: Team[]; schools: School[]; primaryTeamId?: string; selectedTeamId: string; pendingDeletedGame: Game | null; onSelectTeam: (id: string) => void; onUpdatePlayer: (teamId: string, playerId: string, patch: Partial<Player>) => void; onAddPlayer: (teamId: string, player: Player) => void; onDeletePlayer: (teamId: string, playerId: string) => void; onUpdateTeam: (teamId: string, patch: Partial<Pick<Team, "logoUri" | "customColor">>) => void; onAssignBattingOrder: (teamId: string, playerId: string, battingOrder: number | undefined) => void; onManageSchools: () => void; onImportFuxing: () => void; onStart: () => void; onCreate: () => void; onOpenSymbolReference: () => void; onOpenTutorial: () => void; onCreatePrimaryTeam: () => void; onOpenGame: (id: string) => void; onDeleteGame: (game: Game) => void; onRestoreDeletedGame: () => void }) {
  const totalRuns = activeGame.score.reduce((sum, row) => sum + row.away + row.home, 0);
  const [recentSearch, setRecentSearch] = useState({ dateFrom: "", dateTo: "", competition: "" });
  const recentGames = useMemo(() => filterRecentGames(data.games, recentSearch), [data.games, recentSearch]);
  const hasRecentSearch = Boolean(recentSearch.dateFrom || recentSearch.dateTo || recentSearch.competition);
  return (
    <View style={styles.pageGap}>
      <View style={styles.welcomeRow}><View><Text style={styles.welcomeEyebrow}>早安，{userName}</Text><Text style={styles.welcomeTitle}>準備好記錄下一場比賽了嗎？</Text></View><View style={[styles.miniAvatar, isDarkInterface && styles.miniAvatarDark]}><Image source={require("../../assets/images/baseball-scorecard-logo.png")} style={styles.miniAvatarImage} resizeMode="cover" accessibilityLabel="Baseball Scorer 記分圖示" /></View></View>
      <View accessibilityLabel={`本機資料最近保存於 ${formatLocalSavedAt(lastLocalSavedAt)}，目前資料容量 ${localStorageSizeLabel}`} style={styles.localStorageStatusCard}><View style={styles.localStorageStatusCopy}><Text style={styles.localStorageStatusTitle}>本機資料保護中</Text><Text numberOfLines={1} style={styles.localStorageStatusMeta}>最近保存：{formatLocalSavedAt(lastLocalSavedAt)}</Text></View><View style={styles.localStorageSizePill}><Text style={styles.localStorageSizeLabel}>資料容量</Text><Text style={styles.localStorageSizeValue}>{localStorageSizeLabel}</Text></View></View>
      <View style={styles.homeLandscapeWorkspace}>
      <View style={styles.homeMainColumn}>
      <View style={styles.heroCard}>
        <View style={styles.heroAccent} />
        <View style={styles.heroTop}><View><Text style={styles.heroEyebrow}>目前進行中的比賽</Text><Text style={styles.heroTitle}>{activeGame.name}</Text><Text style={styles.heroMeta}>{activeGame.venue} · {activeGame.date}</Text></View><Text style={styles.heroBaseball}>⚾</Text></View>
        <View style={styles.heroScoreRow}><View><TeamLogoName team={awayTeam} textStyle={styles.heroTeam} logoSize={18} /><Text style={styles.heroScore}>{activeGame.score.reduce((sum, row) => sum + row.away, 0)}</Text></View><Text style={styles.heroVs}>VS</Text><View style={styles.heroTeamRight}><TeamLogoName team={homeTeam} textStyle={styles.heroTeam} logoSize={18} align="right" /><Text style={styles.heroScore}>{activeGame.score.reduce((sum, row) => sum + row.home, 0)}</Text></View></View>
        <View style={styles.heroFooter}><View><Text style={styles.heroFooterLabel}>{activeGame.status === "setup" ? "尚未開賽" : `${activeGame.inning}局${activeGame.half === "away" ? "上" : "下"}`}</Text><Text style={styles.heroFooterValue}>{activeGame.events.length} 個打席 · {totalRuns} 分</Text></View><Button label={activeGame.status === "setup" ? "開始記錄" : "繼續記錄"} onPress={onStart} compact /></View>
      </View>
      <SectionTitle eyebrow="GAME LOG" title="最近比賽" action={<Button label="＋ 新增場次" onPress={onCreate} variant="secondary" compact />} />
      <View style={styles.recentSearchRow}>
        <TextInput value={recentSearch.dateFrom} onChangeText={(dateFrom) => setRecentSearch((current) => ({ ...current, dateFrom }))} placeholder="起始日期 YYYY-MM-DD" placeholderTextColor={BRAND.muted} style={styles.recentDateInput} {...({ type: "date" } as any)} returnKeyType="done" />
        <Text style={styles.recentSearchSeparator}>至</Text>
        <TextInput value={recentSearch.dateTo} onChangeText={(dateTo) => setRecentSearch((current) => ({ ...current, dateTo }))} placeholder="結束日期 YYYY-MM-DD" placeholderTextColor={BRAND.muted} style={styles.recentDateInput} {...({ type: "date" } as any)} returnKeyType="done" />
        <TextInput value={recentSearch.competition} onChangeText={(competition) => setRecentSearch((current) => ({ ...current, competition }))} placeholder="搜尋盃賽名稱" placeholderTextColor={BRAND.muted} style={styles.recentCompetitionInput} returnKeyType="done" />
        {hasRecentSearch ? <Button label="清除" onPress={() => setRecentSearch({ dateFrom: "", dateTo: "", competition: "" })} variant="ghost" compact /> : null}
      </View>
      {pendingDeletedGame ? <View style={styles.recentUndoBar}><Text numberOfLines={1} style={styles.recentUndoText}>已刪除「{pendingDeletedGame.name}」</Text><Button label="復原" onPress={onRestoreDeletedGame} variant="secondary" compact /></View> : null}
      <View style={styles.gameList}>{recentGames.slice(0, 5).map((game) => { const away = data.teams.find((team) => team.id === game.awayTeamId); const home = data.teams.find((team) => team.id === game.homeTeamId); return <View key={game.id} style={styles.gameListItem}><Pressable onPress={() => onOpenGame(game.id)} style={({ pressed }) => [styles.gameListOpen, pressed && styles.pressed]}><View style={styles.gameDate}><Text style={styles.gameDateDay}>{game.date.slice(8, 10)}</Text><Text style={styles.gameDateMonth}>{game.date.slice(5, 7)}月</Text></View><View style={styles.gameListCopy}><Text numberOfLines={1} style={styles.gameListTitle}>{game.name}</Text><Text numberOfLines={1} style={styles.gameListMeta}>{away?.name ?? "客隊"} 對 {home?.name ?? "主隊"} · {game.venue}</Text></View><View style={styles.gameListResult}><Text style={styles.gameListStatus}>{game.status === "final" ? "完成" : game.status === "live" ? "進行中" : "待開始"}</Text><Text style={styles.gameListArrow}>›</Text></View></Pressable><Pressable accessibilityLabel={`刪除 ${game.name}`} onPress={() => onDeleteGame(game)} style={({ pressed }) => [styles.deleteGameButton, pressed && styles.pressed]}><Text style={styles.deleteGameButtonText}>刪除</Text></Pressable></View>; })}{recentGames.length === 0 ? <View style={styles.recentEmpty}><Text style={styles.recentEmptyText}>找不到符合日期或盃賽條件的比賽。</Text></View> : null}</View>
      <View style={styles.learningCard}><View style={styles.learningCopy}><Text style={styles.learningEyebrow}>LEARN THE SCORECARD</Text><Text style={styles.learningTitle}>早稻田符號學習工具</Text><Text style={styles.learningText}>查閱球數欄、外圈與內圈的完整寫法，或重新播放三步新手教學。</Text></View><View style={styles.learningActions}><Button label="符號速查表" onPress={onOpenSymbolReference} compact /><Button label="新手教學" onPress={onOpenTutorial} variant="secondary" compact /><Button label="＋ 新增球隊" onPress={onCreatePrimaryTeam} variant="secondary" compact /></View></View>
      </View>
          <View style={styles.homeSetupColumn}><SectionTitle eyebrow="TEAM SETUP" title="球隊、球員與場上配置" action={<Text style={styles.smallMuted}>橫式管理工作區</Text>} /><Text style={styles.mutedText}>在此以選項管理固定名單，並按背號指派第 1 至第 9 棒與守備位置；新增場次時可直接導入。</Text><TeamsView teams={teams} schools={schools} games={data.games} primaryTeamId={primaryTeamId} selectedTeamId={selectedTeamId} onSelect={onSelectTeam} onUpdatePlayer={onUpdatePlayer} onAddPlayer={onAddPlayer} onDeletePlayer={onDeletePlayer} onUpdateTeam={onUpdateTeam} onAssignBattingOrder={onAssignBattingOrder} onManageSchools={onManageSchools} /></View>
      </View>
    </View>
  );
}

function RecordView({ game, games, away, home, myTeam, mySide, battingTeam, pitchingTeam, batter, pitcher, teamPerformance, awayPerformance, homePerformance, pitchDraft, fieldingPosition, selectedResult, selectedPitchType, selectedPitchZone, recordColumnDraft, recentEvents, canUndo, onUndo, onRunnerAction, onSubstitute, onSpecialEvent, onStart, onPitch, onSelectResult, onClearSelectedResult, onOutcome, onPosition, onRecordColumnChange, onPitchType, onPitchZone, onEdit, onFinish, onOpenSymbolReference, onOpenSymbolHelp, onUpdatePlayer }: { game: Game; games: Game[]; away: Team; home: Team; myTeam: Team; mySide: TeamSide | null; battingTeam: Team; pitchingTeam: Team; batter?: Player; pitcher?: Player; teamPerformance: ReturnType<typeof getTeamPerformanceSummary> | null; awayPerformance: ReturnType<typeof getTeamPerformanceSummary> | null; homePerformance: ReturnType<typeof getTeamPerformanceSummary> | null; pitchDraft: PitchDraft; fieldingPosition: string; selectedResult: AtBatResult | null; selectedPitchType: PitchType; selectedPitchZone: PitchLocation["zone"]; recordColumnDraft: RecordColumn; recentEvents: Array<{ id: string; batterName: string; notation: string; inning: number; half: TeamSide; result: AtBatResult; pitches: { balls: number; strikes: number; total: number } }>; canUndo: boolean; onUndo: () => void; onRunnerAction: (type: "SB" | "CS" | "ADV" | "WP" | "PB" | "BK", base?: 1 | 2 | 3, targetBase?: 2 | 3 | 4) => void; onSubstitute: (role?: "代打" | "代跑" | "換投" | "換守") => void; onSpecialEvent: () => void; onStart: () => void; onPitch: (kind: PitchOutcome) => void; onSelectResult: (result: AtBatResult) => void; onClearSelectedResult: () => void; onOutcome: (result: AtBatResult, recordColumnOverride?: RecordColumn) => void; onPosition: (position: string) => void; onRecordColumnChange: (value: RecordColumn) => void; onPitchType: (type: PitchType) => void; onPitchZone: (zone: PitchLocation["zone"]) => void; onEdit: () => void; onFinish: () => void; onOpenSymbolReference: () => void; onOpenSymbolHelp: (help: SymbolHelp) => void; onUpdatePlayer: (teamId: string, playerId: string, patch: Partial<Player>) => void }) {
  const firstRunner = Boolean(game.runners.first);
  const secondRunner = Boolean(game.runners.second);
  const thirdRunner = Boolean(game.runners.third);
  const atBatOrder = game.half === "away" ? (game.awayBatterIndex % Math.max(battingTeam.players.length, 1)) + 1 : (game.homeBatterIndex % Math.max(battingTeam.players.length, 1)) + 1;
  const orderedBatters = [...battingTeam.players].sort((left, right) => (left.battingOrder ?? 99) - (right.battingOrder ?? 99));
  const currentBatterIndex = Math.max(orderedBatters.findIndex((player) => player.id === batter?.id), 0);
  const nextBatters = [1, 2].map((offset) => orderedBatters[(currentBatterIndex + offset) % Math.max(orderedBatters.length, 1)]).filter((player): player is Player => Boolean(player));
  const [inningFilterOpen, setInningFilterOpen] = useState(false);
  const [selectedRailInning, setSelectedRailInning] = useState(game.inning);
  const [summaryMode, setSummaryMode] = useState<"compact" | "detailed">("compact");
  const [runnerActionConfirmation, setRunnerActionConfirmation] = useState<"CS" | "WP" | "PB" | "BK" | null>(null);
  const completedPitcherHistories = useMemo(() => getPitcherPitchLimitHistories(game), [game]);
  const completedCurrentPitcherPitches = completedPitcherHistories.find((history) => history.pitcherId === pitcher?.id)?.pitches ?? 0;
  const currentPitcherPitches = completedCurrentPitcherPitches + pitchDraft.total;
  const pitchLimitWarning = getPitchLimitWarning(currentPitcherPitches, game.pitchLimitThresholds);
  const [pitchWarningPulse, setPitchWarningPulse] = useState(false);
  useEffect(() => {
    if (pitchLimitWarning.level === "none") { setPitchWarningPulse(false); return; }
    setPitchWarningPulse(true);
    const timer = setInterval(() => setPitchWarningPulse((value) => !value), 360);
    return () => clearInterval(timer);
  }, [pitchLimitWarning.level, pitchLimitWarning.nextThreshold]);
  const playerById = useMemo(() => new Map([...away.players, ...home.players].map((player) => [player.id, player])), [away.players, home.players]);
  const pitcherHistories = useMemo(() => {
    const withLiveDraft = completedPitcherHistories.map((history) => history.pitcherId === pitcher?.id ? { ...history, pitches: currentPitcherPitches, ...getPitchLimitWarning(currentPitcherPitches, game.pitchLimitThresholds) } : history);
    if (pitcher && !withLiveDraft.some((history) => history.pitcherId === pitcher.id)) {
      const warning = getPitchLimitWarning(currentPitcherPitches, game.pitchLimitThresholds);
      withLiveDraft.push({ pitcherId: pitcher.id, pitches: currentPitcherPitches, nextThreshold: warning.nextThreshold, reachedThresholds: warning.reachedThresholds });
    }
    return withLiveDraft;
  }, [completedPitcherHistories, currentPitcherPitches, game.pitchLimitThresholds, pitcher]);
  const pitchWarningStyle = pitchLimitWarning.level === "yellow" ? styles.pitchLimitYellow : pitchLimitWarning.level === "orange" ? styles.pitchLimitOrange : pitchLimitWarning.level === "red" ? styles.pitchLimitRed : styles.pitchLimitCalm;
  const pitchWarningTextStyle = pitchLimitWarning.level === "red" ? styles.pitchLimitTextOnRed : styles.pitchLimitText;
  const inningsWithEvents = Array.from(new Set(game.events.filter((event) => event.half === game.half).map((event) => event.inning))).sort((a, b) => a - b);
  const currentHalfEvents = game.events.filter((event) => event.inning === selectedRailInning && event.half === game.half);
  const latestCompletedAtBat = useMemo(
    () => getLatestCompletedAtBat(game.events, undefined, { inning: game.inning, half: game.half }),
    [game.events, game.half, game.inning],
  );
  const latestCompletedBatter = latestCompletedAtBat
    ? battingTeam.players.find((player) => player.id === latestCompletedAtBat.batterId)
    : undefined;
  const selectPosition = (position: string) => {
    onPosition(position);
    if (recordColumnDraft.trajectory) onRecordColumnChange({ ...recordColumnDraft, battedBallPosition: position });
  };
  const droppedThirdStrikeEligibility = getDroppedThirdStrikeEligibility(game.runners, game.outs);
  const droppedThirdStrikeSelected = selectedResult === "K" && (recordColumnDraft.modifiers ?? []).some((modifier) => /不死三振|dropped\s*third|K\+/i.test(modifier));
  const buildStrikeoutRecord = (droppedThirdStrike: boolean): RecordColumn => {
    const modifiers = (recordColumnDraft.modifiers ?? []).filter((modifier) => !/不死三振|dropped\s*third|K\+/i.test(modifier));
    return { ...recordColumnDraft, modifiers: droppedThirdStrike ? [...modifiers, "不死三振 K+"] : modifiers };
  };
  return (
    <View style={styles.pageGap}>
      <View style={styles.recordHeader}><View><Text style={styles.eyebrow}>LIVE SCORING · 五分格工作台</Text><Text style={styles.sectionTitle}>{game.name}</Text><Text style={styles.mutedText}>{game.venue} · {game.date} · {game.inning} 局{game.half === "away" ? "上" : "下"}</Text></View><View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Pressable onPress={onOpenSymbolReference} accessibilityRole="button" accessibilityLabel="開啟早稻田符號對照表" style={({ pressed }) => [styles.headerSymbolReferenceButton, pressed && styles.pressed]}><Text style={styles.headerSymbolReferenceText}>符號對照表</Text></Pressable><Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel="編輯比賽資訊" style={styles.iconButton}><Text style={styles.iconButtonText}>⋯</Text></Pressable></View></View>
      <View style={styles.liveTeamIdentityRow}><View style={[styles.liveTeamIdentityCard, { backgroundColor: teamSurfaceColor(away, "away") }]}><Text style={styles.liveTeamIdentitySide}>客場(先攻)／先攻</Text><TeamLogoName team={away} textStyle={styles.liveTeamIdentityName} logoSize={19} /></View><View style={[styles.liveTeamIdentityCard, styles.liveTeamIdentityCardHome, { backgroundColor: teamSurfaceColor(home, "home") }]}><Text style={styles.liveTeamIdentitySide}>主場(先守)／後攻</Text><TeamLogoName team={home} textStyle={styles.liveTeamIdentityName} logoSize={19} align="right" /></View></View>
      <ScoreBoard game={game} away={away} home={home} />
      {game.status === "setup" ? <View style={styles.setupCard}><Text style={styles.setupTitle}>球員名單與比賽資訊已就緒</Text><Text style={styles.setupText}>客場(先攻)先攻，記錄員可以從第一球開始建立完整比賽紀錄。</Text><Button label="開始第一局" onPress={onStart} /></View> : null}

      <View style={styles.fiveGridWorkspace}>
        <View style={styles.fiveGridColumn}>
          <View style={styles.liveQuadrant}>
            <LivePanelTitle number="1" title="壘包與跑壘紀錄" subtitle="本壘三區格與一、二、三壘跑壘同步" />
            <LiveInfieldPanel
              game={game}
              pitchDraft={pitchDraft}
              batter={batter}
              pitcher={pitcher}
              battingPlayers={battingTeam.players}
              selectedResult={selectedResult}
              fieldingPosition={fieldingPosition}
              recordColumn={recordColumnDraft}
              runnerActionRail={<View style={styles.runnerActionRail}>
                <Text style={styles.runnerActionRailTitle}>跑壘事件</Text>
                <Text style={styles.runnerActionRailHint}>依壘況推進</Text>
                <RunnerActionButton vertical label="1→2 盜壘" mark="S" help={RUNNER_SYMBOL_HELP.SB} disabled={!firstRunner} onPress={() => onRunnerAction("SB", 1)} onLongPress={onOpenSymbolHelp} />
                <RunnerActionButton vertical label="2→3 盜壘" mark="S" help={RUNNER_SYMBOL_HELP.SB} disabled={!secondRunner} onPress={() => onRunnerAction("SB", 2)} onLongPress={onOpenSymbolHelp} />
                <RunnerActionButton vertical label="3→本 盜壘" mark="S" help={RUNNER_SYMBOL_HELP.SB} disabled={!thirdRunner} onPress={() => onRunnerAction("SB", 3)} onLongPress={onOpenSymbolHelp} />
                <RunnerActionButton vertical label="盜壘失敗" mark="CS" help={RUNNER_SYMBOL_HELP.CS} disabled={!firstRunner && !secondRunner && !thirdRunner} onPress={() => setRunnerActionConfirmation("CS")} onLongPress={onOpenSymbolHelp} emphasis />
                <RunnerActionButton vertical label="進壘" mark="↑" help={RUNNER_SYMBOL_HELP.ADV} disabled={!firstRunner && !secondRunner && !thirdRunner} onPress={() => onRunnerAction("ADV")} onLongPress={onOpenSymbolHelp} />
                <RunnerActionButton vertical label="暴投" mark="WP" help={RUNNER_SYMBOL_HELP.WP} disabled={!firstRunner && !secondRunner && !thirdRunner} onPress={() => setRunnerActionConfirmation("WP")} onLongPress={onOpenSymbolHelp} />
                <RunnerActionButton vertical label="捕逸" mark="PB" help={RUNNER_SYMBOL_HELP.PB} disabled={!firstRunner && !secondRunner && !thirdRunner} onPress={() => setRunnerActionConfirmation("PB")} onLongPress={onOpenSymbolHelp} />
                <RunnerActionButton vertical label="投手犯規" mark="BK" help={RUNNER_SYMBOL_HELP.BK} disabled={!firstRunner && !secondRunner && !thirdRunner} onPress={() => setRunnerActionConfirmation("BK")} onLongPress={onOpenSymbolHelp} />
                <RunnerActionButton vertical label="恢復上一球" mark="↶" help={RUNNER_SYMBOL_HELP.UNDO} disabled={!canUndo} onPress={onUndo} onLongPress={onOpenSymbolHelp} emphasis />
              </View>}
            />
          </View>
          <View style={styles.liveQuadrant}>
            <LivePanelTitle number="2" title="投球落點與逐球動作" subtitle="固定依序：早稻田符號 → 球種 → 九宮格；完成第 3 步才寫入。" />
            <PitchTrackingControls selectedType={selectedPitchType} pitchZone={selectedPitchZone} pitchHistory={pitchDraft.locations ?? []} onType={onPitchType} onPitchZone={onPitchZone} onPitch={onPitch} onOpenSymbolHelp={onOpenSymbolHelp} onUndo={onUndo} canUndo={canUndo} />
          </View>
        </View>

        <View style={[styles.fiveGridColumn, styles.middleLiveStack]}>
          {/* 上半部：投手區塊 */}
          <View style={[styles.liveQuadrant, styles.middlePitcherPanel]}>
            <View style={styles.pitcherSectionHeader}>
              <View style={styles.pitcherTitleGroup}>
                <Text style={styles.pitcherHeaderLabel}>投手</Text>
                <View style={styles.pitcherMetaGroup}>
                  <Text style={styles.pitcherTeamName}>{pitchingTeam.name}</Text>
                  <Text style={styles.pitcherNameText}>{playerIdentityLabel(pitcher, "#— 尚未設定")}</Text>
                </View>
              </View>
              <View style={[styles.pitcherLimitBox, pitchWarningStyle, pitchWarningPulse && pitchLimitWarning.level !== "none" && styles.pitchLimitPulse]}>
                <Text numberOfLines={1} style={[styles.pitcherLimitPitches, pitchWarningTextStyle]}>P {currentPitcherPitches} 球</Text>
                <Text numberOfLines={1} style={[styles.pitcherLimitDesc, pitchWarningTextStyle]}>
                  {pitchLimitWarning.nextThreshold ? `下一檻 ${pitchLimitWarning.nextThreshold}` : "已達上限"}
                </Text>
              </View>
            </View>
            {pitcherHistories.length > 0 && (
              <View style={styles.pitcherHistoriesRow}>
                {pitcherHistories.slice(0, 3).map((history) => {
                  const player = playerById.get(history.pitcherId);
                  return (
                    <Text key={history.pitcherId} numberOfLines={1} style={[styles.pitcherHistoryChipText, history.pitcherId === pitcher?.id && styles.pitcherHistoryChipTextActive]}>
                      #{player?.number} {player?.name}：{history.pitches}球
                    </Text>
                  );
                })}
              </View>
            )}
          </View>

          {/* 下半部：打者與打席區塊 */}
          <View style={[styles.liveQuadrant, styles.middleBatterPanel, { backgroundColor: teamSurfaceColor(battingTeam, game.half), borderColor: teamAccentColor(battingTeam, game.half) }]}>
            <View style={styles.batterSectionHeader}>
              <View style={styles.batterTitleGroup}>
                <Text style={[styles.batterHeaderLabel, { borderColor: teamAccentColor(battingTeam, game.half), color: teamAccentColor(battingTeam, game.half) }]}>打者</Text>
                <View style={styles.batterMetaGroup}>
                  <Text style={styles.batterTeamName}>{battingTeam.name} · 第 {atBatOrder} 棒</Text>
                  <Text style={styles.batterNameText}>{playerIdentityLabel(batter, "#— 尚未設定")}</Text>
                </View>
              </View>
              <View style={styles.batterCountsGroup}>
                <View style={styles.compactCountPill}>
                  <Text style={styles.compactCountLabel}>壞</Text>
                  <Text style={styles.compactCountValue}>{pitchDraft.balls}</Text>
                </View>
                <View style={styles.compactCountPill}>
                  <Text style={[styles.compactCountLabel, styles.strikeLabelColor]}>好</Text>
                  <Text style={[styles.compactCountValue, styles.strikeValueColor]}>{pitchDraft.strikes}</Text>
                </View>
                <View style={styles.compactCountPill}>
                  <Text style={[styles.compactCountLabel, styles.outLabelColor]}>出</Text>
                  <Text style={[styles.compactCountValue, styles.outValueColor]}>{game.outs}</Text>
                </View>
              </View>
            </View>
            <View style={styles.currentAtBatWorkRow}>
              <View style={styles.atBatRecordPanel}>
                <CurrentAtBatPanel game={game} pitchDraft={pitchDraft} batter={batter} completedAtBat={latestCompletedAtBat} completedBatter={latestCompletedBatter} selectedResult={selectedResult} fieldingPosition={fieldingPosition} recordColumn={recordColumnDraft} />
              </View>
            </View>
          </View>

          <View style={[styles.liveQuadrant, styles.middleControlsPanel]}>
            <LivePanelTitle number="4" title="擊出／觸擊後事件、換人與後兩棒次" subtitle="選擇「• 擊出球」或「⌁ 觸擊」後，完成球性、方向、結果與傳球事件。" />
            {selectedResult === "K" ? <View style={styles.battedBallWaitingCard}><Text style={styles.battedBallWaitingTitle}>第三好球確認</Text><Text style={styles.battedBallWaitingHint}>請確認捕手是否接捕第三好球；一般三振會記出局，只有未接捕且壘況合法時才可記 K+ 並讓打者上一壘。</Text><View style={styles.substitutionQuickRow}><Button label="一般 K：記出局" onPress={() => onOutcome("K", buildStrikeoutRecord(false))} variant={droppedThirdStrikeSelected ? "secondary" : "primary"} compact touch fluid /><Button label="K+：未接捕上一壘" disabled={!droppedThirdStrikeEligibility.allowed} onPress={() => onOutcome("K", buildStrikeoutRecord(true))} variant={droppedThirdStrikeSelected ? "primary" : "secondary"} compact touch fluid /></View><Text style={styles.recordCorrectionSafetyText}>{droppedThirdStrikeEligibility.allowed ? "K+ 合法：第三好球未接捕後，可記 K 統計並使打者安全上一壘。" : `K+ 不可用：${droppedThirdStrikeEligibility.reason ?? "一壘有人且未滿兩出局時，打者仍為三振出局。"}`}</Text></View> : <BattedBallWorkflowControls active={opensBattedBallWorkflow(pitchDraft.locations?.at(-1)?.outcome)} triggerOutcome={pitchDraft.locations?.at(-1)?.outcome} batter={batter} battingPlayers={battingTeam.players} runners={game.runners} games={games} draft={recordColumnDraft} result={selectedResult} fieldingPosition={fieldingPosition} onChange={onRecordColumnChange} onSelectResult={onSelectResult} onClearResult={onClearSelectedResult} onPosition={selectPosition} onCommit={onOutcome} onOpenSymbolHelp={onOpenSymbolHelp} onHitByPitch={() => onOutcome("HBP")} />}
            <View style={styles.substitutionQuickRow}><Button label="代打" onPress={() => onSubstitute("代打")} variant="secondary" compact touch fluid /><Button label="代跑" onPress={() => onSubstitute("代跑")} variant="secondary" compact touch fluid /><Button label="換投" onPress={() => onSubstitute("換投")} variant="secondary" compact touch fluid /></View>
            <View style={styles.substitutionQuickRow}><Button label="代守" onPress={() => onSubstitute("換守")} variant="secondary" compact touch fluid /><Button label="特殊事件" onPress={onSpecialEvent} variant="secondary" compact touch fluid /><Button label="結束比賽" onPress={onFinish} variant={game.status === "final" ? "secondary" : "danger"} compact touch fluid /></View>
            <BatterQueuePreview players={nextBatters} events={game.events} />
          </View>
        </View>

        {/* 右側欄：包含右上角名單與局數紀錄 */}
        <View style={styles.rightRailColumn}>
          <LiveLineupPanel away={away} home={home} game={game} batter={batter} pitcher={pitcher} />
          <View style={styles.inningRailPanel}>
            <LivePanelTitle number="5" title={`第 ${selectedRailInning} 局已上場打者`} subtitle="可收合局數快速切換；與單場整體紀錄同步。" />
            <View style={styles.substitutionQuickRow}><Button label={inningFilterOpen ? "收合局數" : "切換局數"} onPress={() => setInningFilterOpen((open) => !open)} variant="secondary" compact />{!inningFilterOpen && <Button label={`第 ${selectedRailInning} 局`} onPress={() => setInningFilterOpen(true)} variant="ghost" compact />}</View>
            {inningFilterOpen && <View style={styles.substitutionQuickRow}>{inningsWithEvents.map((inning) => <Button key={inning} label={`${inning} 局`} onPress={() => { setSelectedRailInning(inning); setInningFilterOpen(false); }} variant={selectedRailInning === inning ? "primary" : "secondary"} compact />)}</View>}
            <InningAtBatRail events={currentHalfEvents} players={battingTeam.players} />
          </View>
        </View>
      </View>

      <View style={styles.recentCard}><SectionTitle eyebrow="PLAY-BY-PLAY" title="最近紀錄" action={<Text style={styles.eventCount}>{game.events.length + (game.specialEvents ?? []).length} 筆</Text>} />{recentEvents.length === 0 && (game.specialEvents ?? []).length === 0 ? <Text style={styles.emptyText}>尚未有逐球結果。從左下選取投球落點與動作，或在中下選擇早稻田打席結果。</Text> : <>{recentEvents.map((event) => <View key={event.id} style={styles.eventRow}><View style={styles.eventInning}><Text style={styles.eventInningNumber}>{event.inning}</Text><Text style={styles.eventInningHalf}>{event.half === "away" ? "上" : "下"}</Text></View><View style={styles.eventMain}><Text style={styles.eventBatter}>{event.batterName}</Text><Text style={styles.eventMeta}>{event.pitches.total} 球 · {event.result}</Text></View><Text style={styles.eventNotation}>{event.notation}</Text></View>)}{(game.specialEvents ?? []).slice(-8).reverse().map((event) => <View key={event.id} style={styles.eventRow}><View style={[styles.eventInning, styles.specialEventInning]}><Text style={styles.eventInningNumber}>{event.inning}</Text><Text style={styles.eventInningHalf}>{event.half === "away" ? "上" : "下"}</Text></View><View style={styles.eventMain}><Text style={styles.eventBatter}>{SPECIAL_EVENT_LABELS[event.type]}</Text><Text style={styles.eventMeta}>{event.runsScored ? `${event.runsScored} 分 · ` : ""}特殊事件</Text></View><Text style={styles.eventNotation}>{event.notation}</Text></View>)}</>}</View>
      <RunnerActionConfirmationModal action={runnerActionConfirmation} game={game} battingPlayers={battingTeam.players} onClose={() => setRunnerActionConfirmation(null)} onConfirm={(fromBase, targetBase) => { if (runnerActionConfirmation === "CS") onRunnerAction("CS", fromBase, targetBase); else if (runnerActionConfirmation) onRunnerAction(runnerActionConfirmation); setRunnerActionConfirmation(null); }} />
    </View>
  );
}

function RunnerActionConfirmationModal({ action, game, battingPlayers, onClose, onConfirm }: { action: "CS" | "WP" | "PB" | "BK" | null; game: Game; battingPlayers: Player[]; onClose: () => void; onConfirm: (fromBase: 1 | 2 | 3, targetBase: 2 | 3 | 4) => void }) {
  const runnerChoices = ([
    { base: 1 as const, runnerId: game.runners.first },
    { base: 2 as const, runnerId: game.runners.second },
    { base: 3 as const, runnerId: game.runners.third },
  ]).filter((choice) => Boolean(choice.runnerId));
  const defaultChoice = runnerChoices[runnerChoices.length - 1] ?? runnerChoices[0];
  const [fromBase, setFromBase] = useState<1 | 2 | 3>(defaultChoice?.base ?? 1);
  const [targetBase, setTargetBase] = useState<2 | 3 | 4>(defaultChoice?.base === 3 ? 4 : ((defaultChoice?.base ?? 1) + 1) as 2 | 3 | 4);
  useEffect(() => {
    if (!action) return;
    const selected = runnerChoices[runnerChoices.length - 1] ?? runnerChoices[0];
    setFromBase(selected?.base ?? 1);
    setTargetBase(selected?.base === 3 ? 4 : ((selected?.base ?? 1) + 1) as 2 | 3 | 4);
  }, [action, game.runners.first, game.runners.second, game.runners.third]);
  const selectedRunner = runnerChoices.find((choice) => choice.base === fromBase)?.runnerId;
  const selectedRunnerName = battingPlayers.find((player) => player.id === selectedRunner)?.name ?? "未登錄跑者";
  const targetChoices = ([2, 3, 4] as const).filter((base) => base > fromBase);
  const specialAdvances = action && action !== "CS" ? buildSpecialEventRunnerSummary(action, game.runners) : [];
  const specialEventTitle = action === "WP" ? "確認暴投（WP）" : action === "PB" ? "確認捕逸（PB）" : "確認投手犯規（BK）";
  return <Modal visible={Boolean(action)} animationType="fade" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>{action === "CS" ? "確認盜壘失敗（CS）" : specialEventTitle}</Text><Text style={styles.modalSubtitle}>{action === "CS" ? "先選擇嘗試盜壘的跑者與目標壘包" : "確認每位受影響跑者的推進、得分與紀錄來源"}</Text></View><Pressable onPress={onClose}><Text style={styles.modalClose}>取消</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}>{action === "CS" ? <><Text style={styles.inputLabel}>選擇跑者</Text><View style={styles.modalChoiceRow}>{runnerChoices.map((choice) => { const player = battingPlayers.find((candidate) => candidate.id === choice.runnerId); return <Pressable key={choice.base} onPress={() => { setFromBase(choice.base); setTargetBase(choice.base === 3 ? 4 : (choice.base + 1) as 2 | 3 | 4); }} style={[styles.modalChoice, fromBase === choice.base && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, fromBase === choice.base && styles.modalChoiceTextActive]}>{choice.base} 壘 · #{player?.number ?? "—"} {player?.name ?? "跑者"}</Text></Pressable>; })}</View><Text style={styles.inputLabel}>嘗試目標壘包</Text><View style={styles.modalChoiceRow}>{targetChoices.map((base) => <Pressable key={base} onPress={() => setTargetBase(base)} style={[styles.modalChoice, targetBase === base && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, targetBase === base && styles.modalChoiceTextActive]}>{base === 4 ? "本壘" : `${base} 壘`}</Text></Pressable>)}</View><View style={styles.confirmationSummary}><Text style={styles.confirmationSummaryTitle}>確認內容</Text><Text style={styles.confirmationSummaryText}>{fromBase} 壘跑者 #{battingPlayers.find((player) => player.id === selectedRunner)?.number ?? "—"} {selectedRunnerName} 嘗試盜向 {targetBase === 4 ? "本壘" : `${targetBase} 壘`}，未成功並記為出局。</Text><Text style={styles.confirmationNotation}>早稻田符號：{getSpecialEventNotation("CS", fromBase, targetBase)}</Text></View></> : <><View style={styles.confirmationSummary}><Text style={styles.confirmationSummaryTitle}>{action} 預計推進</Text>{specialAdvances.map((advance) => { const player = battingPlayers.find((candidate) => candidate.id === advance.runnerId); return <Text key={advance.fromBase} style={styles.confirmationSummaryText}>{advance.fromBase} 壘 #{player?.number ?? "—"} {player?.name ?? "跑者"} → {advance.scores ? "本壘得分" : `${advance.toBase} 壘`}</Text>; })}<Text style={styles.confirmationNotation}>預計得分：{specialAdvances.filter((advance) => advance.scores).length} 分 · 來源：各跑者原上壘打席</Text></View><Text style={styles.substitutionContext}>確認後會依早稻田規則將 {action} 回寫至每位跑者的來源打席，並同步更新壘包、比分及單場整體紀錄。</Text></>}<View style={styles.confirmationActionRow}><View style={styles.confirmationActionFlex}><Button label="取消" onPress={onClose} variant="secondary" touch fluid /></View><View style={styles.confirmationActionFlex}><Button label={action === "CS" ? "確認記錄 CS" : `確認記錄 ${action ?? ""}`} onPress={() => onConfirm(fromBase, targetBase)} touch fluid /></View></View></ScrollView></View></View></Modal>;
}

function LiveLineupPanel({ away, home, game, batter, pitcher }: { away: Team; home: Team; game: Game; batter?: Player; pitcher?: Player }) {
  const getLineup = (team: Team, side: TeamSide) => {
    const lineup = side === "away" ? game.awayLineup : game.homeLineup;
    const playerMap = new Map(team.players.map((p) => [p.id, p]));

    if (lineup && lineup.battingOrderIds && lineup.battingOrderIds.length > 0) {
      const orderedPlayers = lineup.battingOrderIds
        .map((playerId, index) => {
          const player = playerMap.get(playerId);
          if (!player) return undefined;
          const defensivePos = lineup.defensivePositions[playerId] || player.position;
          const updatedPlayer: Player = {
            ...player,
            battingOrder: index + 1,
            position: defensivePos,
          };
          return updatedPlayer;
        })
        .filter((p): p is Player => p !== undefined);

      if (orderedPlayers.length >= 9) {
        return orderedPlayers.slice(0, 9);
      }

      const existingIds = new Set(orderedPlayers.map((p) => p.id));
      const remaining = team.players
        .filter((p) => !existingIds.has(p.id))
        .map((p) => ({ ...p, battingOrder: undefined }));
      return [...orderedPlayers, ...remaining].slice(0, 9);
    }

    const lineupPlayers = [...team.players]
      .filter((p) => p.battingOrder !== undefined && p.battingOrder >= 1 && p.battingOrder <= 9)
      .sort((a, b) => (a.battingOrder ?? 0) - (b.battingOrder ?? 0));
    if (lineupPlayers.length >= 9) return lineupPlayers.slice(0, 9);
    const existingIds = new Set(lineupPlayers.map((p) => p.id));
    const remaining = team.players.filter((p) => !existingIds.has(p.id));
    return [...lineupPlayers, ...remaining].slice(0, 9);
  };

  const awayLineup = getLineup(away, "away");
  const homeLineup = getLineup(home, "home");

  const renderPlayerRow = (player: Player | undefined, index: number, isCurrent: boolean, side: TeamSide) => {
    if (!player) return null;
    return (
      <View key={player.id || `${side}-${index}`} style={[styles.lineupRowItem, isCurrent && styles.lineupRowItemActive]}>
        <Text style={[styles.lineupOrderText, isCurrent && styles.lineupOrderTextActive]}>{index + 1}</Text>
        <Text style={[styles.lineupNumberText, isCurrent && styles.lineupNumberTextActive]}>#{player.number}</Text>
        <Text numberOfLines={1} style={[styles.lineupNameText, isCurrent && styles.lineupNameTextActive]}>{player.name}</Text>
        <Text style={[styles.lineupPosText, isCurrent && styles.lineupPosTextActive]}>{player.position?.slice(0, 1) || "替"}</Text>
      </View>
    );
  };

  return (
    <View style={styles.liveLineupContainer}>
      <Text style={styles.liveLineupTitle}>主客場 1~9 棒打線名單</Text>
      <View style={styles.liveLineupSubRow}>
        <View style={styles.liveLineupTeamCol}>
          <Text style={[styles.liveLineupTeamHeader, { color: BRAND.blue }]}>{away.name.slice(0, 6)} (客)</Text>
          <View style={styles.lineupListWrap}>
            {awayLineup.map((p, idx) => renderPlayerRow(p, idx, game.half === "away" && batter?.id === p?.id, "away"))}
          </View>
        </View>
        <View style={styles.liveLineupTeamCol}>
          <Text style={[styles.liveLineupTeamHeader, { color: BRAND.red }]}>{home.name.slice(0, 6)} (主)</Text>
          <View style={styles.lineupListWrap}>
            {homeLineup.map((p, idx) => renderPlayerRow(p, idx, game.half === "home" && batter?.id === p?.id, "home"))}
          </View>
        </View>
      </View>
    </View>
  );
}

function LivePanelTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return <View style={styles.livePanelTitleRow}><Text style={styles.livePanelNumber}>{number}</Text><View style={styles.livePanelCopy}><Text style={styles.livePanelTitle}>{title}</Text><Text style={styles.livePanelSubtitle}>{subtitle}</Text></View></View>;
}

function RunnerActionButton({ label, mark, help, onPress, onLongPress, disabled, emphasis = false, vertical = false }: { label: string; mark: string; help: SymbolHelp; onPress: () => void; onLongPress: (help: SymbolHelp) => void; disabled: boolean; emphasis?: boolean; vertical?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} onLongPress={() => onLongPress(help)} delayLongPress={420} accessibilityHint="長按查看早稻田符號說明" style={({ pressed }) => [styles.runnerActionButton, vertical && styles.runnerActionButtonVertical, emphasis && styles.runnerActionButtonEmphasis, disabled && styles.actionButtonDisabled, pressed && styles.pressed]}><Text style={[styles.runnerActionMark, vertical && styles.runnerActionMarkVertical]}>{mark}</Text><Text style={[styles.runnerActionText, vertical && styles.runnerActionTextVertical]} numberOfLines={vertical ? 1 : undefined}>{label}</Text></Pressable>;
}

function PitchActionButton({ label, mark, help, onPress, onLongPress, disabled = false, emphasis = false, selected = false }: { label: string; mark: string; help: SymbolHelp; onPress: () => void; onLongPress: (help: SymbolHelp) => void; disabled?: boolean; emphasis?: boolean; selected?: boolean }) {
  return <Pressable disabled={disabled} onPress={onPress} onLongPress={() => onLongPress(help)} delayLongPress={420} accessibilityHint="長按查看早稻田符號說明" style={({ pressed }) => [styles.pitchActionButton, selected && styles.pitchActionButtonSelected, emphasis && styles.pitchActionButtonEmphasis, disabled && styles.actionButtonDisabled, pressed && styles.pressed]}><Text style={styles.pitchActionMark}>{mark}</Text><Text style={styles.pitchActionText}>{label}</Text></Pressable>;
}

function LiveInfieldPanel({ game, pitchDraft, batter, pitcher, battingPlayers, selectedResult, fieldingPosition, recordColumn, runnerActionRail }: { game: Game; pitchDraft: PitchDraft; batter?: Player; pitcher?: Player; battingPlayers: Player[]; selectedResult: AtBatResult | null; fieldingPosition: string; recordColumn: RecordColumn; runnerActionRail: ReactNode }) {
  const quadrants = getLiveWasedaQuadrants(game, pitchDraft, selectedResult, fieldingPosition, recordColumn);
  const [showBaseZoom, setShowBaseZoom] = useState(false);
  const runnerLabel = (runnerId: string | null, base: string) => {
    const runner = battingPlayers.find((player) => player.id === runnerId);
    return runner ? `${runner.battingOrder ?? "—"}棒 #${runner.number} ${runner.name}` : `${base}空壘`;
  };
  const first = runnerLabel(game.runners.first, "一壘");
  const second = runnerLabel(game.runners.second, "二壘");
  const third = runnerLabel(game.runners.third, "三壘");
  const batterLabel = `${batter?.battingOrder ?? "—"}棒 #${batter?.number ?? "—"} ${batter?.name ?? "待選打者"}`;
  return <View style={styles.liveInfieldGrid}>
    <View style={styles.liveRunnerDefenseRow}><View style={styles.liveRunnerDefenseCopy}><Text style={styles.liveRunnerDefenseDot}>◉</Text><Text style={styles.liveRunnerDefenseText}>守備：{playerIdentityLabel(pitcher, "#— 尚未設定")}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="放大檢視壘包紀錄格" onPress={() => setShowBaseZoom(true)} style={({ pressed }) => [styles.liveRunnerZoomButton, pressed && styles.pressed]}><Text style={styles.liveRunnerZoomIcon}>⊕</Text><Text style={styles.liveRunnerZoomText}>放大</Text></Pressable></View>
    <View style={styles.liveInfieldWorkRow}>
      <View style={styles.liveRunnerCrossContainer}>
        <Image
          source={require("../../assets/images/live-infield-background.jpg")}
          resizeMode="contain"
          style={styles.liveRunnerCrossBackgroundImage}
        />
        
        {/* 二壘 (Top Center) */}
        <View style={[styles.liveRunnerAbsoluteSlot, { top: "5%", left: "50%", transform: [{ translateX: -46 }] }]}>
          <View style={[styles.liveRunnerScoreCell, game.runners.second && styles.liveRunnerScoreCellOccupied]}>
            <WasedaBaseCell {...quadrants[2]} dense style={{ borderWidth: 0 }} />
          </View>
          <View style={[styles.liveRunnerPlayerTag, game.runners.second && styles.liveRunnerPlayerTagOccupied]}>
            <Text style={styles.liveRunnerPlayerTagText} numberOfLines={1}>{second}</Text>
          </View>
        </View>

        {/* 三壘 (Middle Left) */}
        <View style={[styles.liveRunnerAbsoluteSlot, { top: "35%", left: "5%" }]}>
          <View style={[styles.liveRunnerScoreCell, game.runners.third && styles.liveRunnerScoreCellOccupied]}>
            <WasedaBaseCell {...quadrants[3]} dense style={{ borderWidth: 0 }} />
          </View>
          <View style={[styles.liveRunnerPlayerTag, game.runners.third && styles.liveRunnerPlayerTagOccupied]}>
            <Text style={styles.liveRunnerPlayerTagText} numberOfLines={1}>{third}</Text>
          </View>
        </View>

        {/* 投手丘 (Center) */}
        <View style={[styles.liveRunnerAbsoluteSlot, { top: "35%", left: "50%", transform: [{ translateX: -36 }] }]}>
          <View style={styles.liveRunnerMound}>
            <Text style={styles.liveRunnerMoundText}>投</Text>
            <Text style={styles.liveRunnerMoundText}>#{pitcher?.number ?? "—"}</Text>
            <Text style={styles.liveRunnerMoundMeta}>{pitchDraft.total} 球</Text>
          </View>
        </View>

        {/* 一壘 (Middle Right) */}
        <View style={[styles.liveRunnerAbsoluteSlot, { top: "35%", right: "5%" }]}>
          <View style={[styles.liveRunnerScoreCell, game.runners.first && styles.liveRunnerScoreCellOccupied]}>
            <WasedaBaseCell {...quadrants[1]} dense style={{ borderWidth: 0 }} />
          </View>
          <View style={[styles.liveRunnerPlayerTag, game.runners.first && styles.liveRunnerPlayerTagOccupied]}>
            <Text style={styles.liveRunnerPlayerTagText} numberOfLines={1}>{first}</Text>
          </View>
        </View>

        {/* 本壘 (Bottom Center) */}
        <View style={[styles.liveRunnerAbsoluteSlot, { bottom: "5%", left: "50%", transform: [{ translateX: -46 }] }]}>
          <View style={styles.liveRunnerScoreCell}>
            <WasedaBaseCell {...quadrants[0]} dense style={{ borderWidth: 0 }} />
          </View>
          <View style={styles.liveRunnerPlayerTag}>
            <Text style={styles.liveRunnerPlayerTagText} numberOfLines={1}>{batterLabel}</Text>
          </View>
        </View>
      </View>
      {runnerActionRail}
    </View>
    <View style={styles.liveRunnerOutRow}><Text style={styles.liveRunnerOutIcon}>◔</Text><Text style={styles.liveRunnerOutText}>出局數：{game.outs === 0 ? "○" : "Ⅱ"}（{game.outs} 出局）</Text></View>
    <BaseCellZoomModal visible={showBaseZoom} quadrants={quadrants} onClose={() => setShowBaseZoom(false)} />
  </View>;
}

function BaseCellZoomModal({ visible, quadrants, onClose }: { visible: boolean; quadrants: LiveWasedaQuadrant[]; onClose: () => void }) {
  return <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}><View style={styles.baseZoomBackdrop}><View style={styles.baseZoomSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>壘包格放大檢視</Text><Text style={styles.modalSubtitle}>唯讀模式；內容與現場早稻田紀錄即時同步</Text></View><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="關閉壘包格放大檢視"><Text style={styles.modalClose}>關閉</Text></Pressable></View><View style={styles.baseZoomGrid}>{quadrants.map((quadrant) => <View key={quadrant.label} style={styles.baseZoomCell}><Text style={styles.baseZoomCellLabel}>{quadrant.label}</Text><WasedaBaseCell {...quadrant} size="regular" /></View>)}</View><Text style={styles.baseZoomHint}>放大檢視僅供確認球數、外圈、內圈與跑壘推進，不會改變壘包或打席資料。</Text></View></View></Modal>;
}

function CurrentAtBatPanel({ game, pitchDraft, batter, completedAtBat, completedBatter, selectedResult, fieldingPosition, recordColumn }: { game: Game; pitchDraft: PitchDraft; batter?: Player; completedAtBat?: Game["events"][number]; completedBatter?: Player; selectedResult: AtBatResult | null; fieldingPosition: string; recordColumn: RecordColumn }) {
  const hasLiveDraft = Boolean(
    pitchDraft.total
    || selectedResult
    || recordColumn.trajectory
    || recordColumn.battedBallPosition
    || recordColumn.fieldingSequence
    || recordColumn.fieldingPlay
    || (recordColumn.modifiers?.length ?? 0) > 0
    || recordColumn.rbi,
  );
  const displayedCompletedAtBat = hasLiveDraft ? undefined : completedAtBat;
  const displayBatter = displayedCompletedAtBat ? completedBatter ?? batter : batter;
  const preview = selectedResult ? formatRecordColumnNotation(selectedResult, fieldingPosition, recordColumn) : "";
  return <View style={styles.currentAtBatPanel}><View style={styles.currentAtBatHeader}><Text style={styles.currentAtBatName}>{playerIdentityLabel(displayBatter, "#— 本次打者")}</Text><Text style={styles.currentAtBatSync}>{displayedCompletedAtBat ? "剛完成 · 已同步" : "與左下連動"}</Text></View><WasedaPersonalRecordCell size="large" label={displayedCompletedAtBat ? "剛完成個人紀錄欄｜球數欄、外圈、內圈" : "本次個人紀錄欄｜球數欄、外圈、內圈"} note="早稻田式" event={displayedCompletedAtBat} pitchState={hasLiveDraft ? pitchDraft : undefined} result={hasLiveDraft ? selectedResult ?? undefined : undefined} recordColumn={hasLiveDraft ? recordColumn : undefined} notation={hasLiveDraft ? preview : undefined} outsBefore={hasLiveDraft ? game.outs : undefined} /></View>;
}

type FieldingEventChoice = "none" | "routine" | "DP" | "TP" | "FC";

type RecordCorrectionBattedBallDraft = {
  trajectoryId: string | null;
  position: string | null;
  result: AtBatResult | null;
  fieldingEvent: FieldingEventChoice | null;
  fieldingSequence: string;
};

const EMPTY_RECORD_CORRECTION_BATCHED_BALL_DRAFT: RecordCorrectionBattedBallDraft = {
  trajectoryId: null,
  position: null,
  result: null,
  fieldingEvent: null,
  fieldingSequence: "",
};

const RECORD_CORRECTION_RESULT_SYMBOL_IDS: Partial<Record<AtBatResult | "FC" | "DP", string>> = {
  "1B": "single",
  "2B": "double",
  "3B": "triple",
  HR: "home-run",
  BB: "walk",
  HBP: "hit-by-pitch",
  FC: "fielder-choice",
  E: "error",
  DP: "double-play",
  F: "fly-out",
  G: "ground-out",
};

function BattedBallWorkflowControls({ active, triggerOutcome, batter, battingPlayers, runners, games, draft, result, fieldingPosition, onChange, onSelectResult, onClearResult, onPosition, onCommit, onOpenSymbolHelp, onHitByPitch }: { active: boolean; triggerOutcome?: PitchOutcome; batter?: Player; battingPlayers: Player[]; runners: Game["runners"]; games: Game[]; draft: RecordColumn; result: AtBatResult | null; fieldingPosition: string; onChange: (value: RecordColumn) => void; onSelectResult: (result: AtBatResult) => void; onClearResult: () => void; onPosition: (position: string) => void; onCommit: (result: AtBatResult) => void; onOpenSymbolHelp: (help: SymbolHelp) => void; onHitByPitch: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [fieldingEvent, setFieldingEvent] = useState<FieldingEventChoice | null>(null);
  const [sfNoScoreWarning, setSfNoScoreWarning] = useState(false);
  const [showFcConfirmation, setShowFcConfirmation] = useState(false);
  const modifiers = draft.modifiers ?? [];
  const ballInPlayResults = RESULT_SHORTCUTS.filter((shortcut) => ["1B", "2B", "3B", "HR", "F", "G", "E"].includes(shortcut.result));
  const fieldingExample = result ? getFieldingExampleNotation(result, draft.battedBallPosition ?? fieldingPosition, draft) : "";
  const triggerLabel = triggerOutcome === "bunt" ? "⌁ 觸擊" : "• 擊出球";
  const canRecordSacrifice = triggerOutcome === "bunt" && Boolean(runners.first || runners.second || runners.third);
  const canRecordSacrificeFly = canSacrificeFly(runners);
  const sacrificePreview = getSacrificeBuntAdvancement(runners);
  const sacrificeFlyPreview = getSacrificeFlyAdvancement(runners);
  const sacrificeSelected = result === "G" && isSacrificeBuntRecord(draft);
  const sacrificeFlySelected = result === "F" && isSacrificeFlyRecord(draft);
  const sacrificeFlyNoScoreReason = draft.sacrificeFlyNoScoreReason;
  const sacrificeFlyNoScoreReasonOptions: SacrificeFlyNoScoreReason[] = canRecordSacrificeFly ? ["runner_held_at_third", "runner_out_at_home"] : ["no_third_runner"];
  const fieldingSuggestions = useMemo(() => getFieldingSequenceSuggestions({ battedBallPosition: draft.battedBallPosition ?? fieldingPosition, result, runners, games }), [draft.battedBallPosition, fieldingPosition, games, result, runners]);

  useEffect(() => {
    if (!active) {
      setStep(1);
      setFieldingEvent(null);
    }
  }, [active, batter?.id]);
  const needsSequence = fieldingEvent !== null && fieldingEvent !== "none";

  useEffect(() => {
    if (!active) {
      setStep(1);
      setFieldingEvent(null);
    }
  }, [active, batter?.id]);

  const chooseFieldingEvent = (choice: FieldingEventChoice) => {
    setFieldingEvent(choice);
    if (choice !== "FC") setShowFcConfirmation(false);
    const cleanModifiers = modifiers.filter((item) => !/^(DP|TP|FC)（|^犧牲短打|^高飛犧牲打/.test(item));
    if (choice === "none" || choice === "routine") {
      onChange({ ...draft, fieldingPlay: undefined, fieldingSequence: choice === "none" ? undefined : draft.fieldingSequence, modifiers: cleanModifiers });
      return;
    }
    if (choice === "FC") {
      // FC 是守備選擇，不可保留先前誤選的一壘安打等安打結果。
      // 以滾地守備結果保存，讓打者計 AB 而不計 H；跑者／出局則由 FC 專用結算處理。
      onSelectResult("G");
    }
    onChange({ ...draft, fieldingPlay: choice, modifiers: cleanModifiers });
  };

  const setRbi = (value: number) => onChange({ ...draft, rbi: value });
  const chooseSacrificeBunt = () => {
    if (!canRecordSacrifice) return;
    const cleanModifiers = modifiers.filter((item) => !/^(DP|TP|FC)（|^犧牲短打|^高飛犧牲打/.test(item));
    setFieldingEvent("none");
    onSelectResult("G");
    onChange({ ...draft, modifiers: [...cleanModifiers, SACRIFICE_BUNT_MODIFIER], sacrificeFlyNoScoreReason: undefined, rbi: sacrificePreview.runs });
    setStep(4);
  };
  const chooseSacrificeFly = (noScoreReason?: SacrificeFlyNoScoreReason) => {
    const cleanModifiers = modifiers.filter((item) => !/^(DP|TP|FC)（|^犧牲短打|^高飛犧牲打/.test(item));
    const resolvedNoScoreReason: SacrificeFlyNoScoreReason | undefined = noScoreReason ?? (!canRecordSacrificeFly ? "no_third_runner" : undefined);
    const advancement = getSacrificeFlyAdvancement(runners, resolvedNoScoreReason);
    setSfNoScoreWarning(false);
    setFieldingEvent("routine");
    onSelectResult("F");
    onChange({ ...draft, battedBallPosition: ["7", "8", "9"].includes(draft.battedBallPosition ?? fieldingPosition) ? draft.battedBallPosition : "8", modifiers: [...cleanModifiers, SACRIFICE_FLY_MODIFIER], sacrificeFlyNoScoreReason: resolvedNoScoreReason, rbi: advancement.runs });
    setStep(4);
  };
  const requestSacrificeFly = () => {
    if (!canRecordSacrificeFly) {
      setSfNoScoreWarning(true);
      return;
    }
    chooseSacrificeFly();
  };
  const clearAfter = (target: 1 | 2 | 3) => {
    const cleanModifiers = modifiers.filter((item) => !/^(DP|TP|FC)（|^犧牲短打|^高飛犧牲打/.test(item));
    setFieldingEvent(null);
    if (target <= 2) onClearResult();
    onChange({ ...draft, battedBallPosition: target === 1 ? undefined : draft.battedBallPosition, fieldingPlay: undefined, fieldingSequence: undefined, modifiers: cleanModifiers, sacrificeFlyNoScoreReason: undefined, rbi: undefined });
    setStep(target);
  };

  if (!active) {
    return <View style={styles.battedBallWaitingCard}><Text style={styles.battedBallWaitingTitle}>等待擊出球或觸擊</Text><Text style={styles.battedBallWaitingHint}>請先在第 2 區完成「早稻田符號 → 球種 → 九宮格」。選擇「• 擊出球」或「⌁ 觸擊」後，這裡會鎖定一般逐球輸入並開啟相同的打擊事件四步流程。</Text><Pressable onPress={onHitByPitch} onLongPress={() => onOpenSymbolHelp(getResultSymbolHelp("HBP", fieldingPosition))} delayLongPress={420} accessibilityHint="長按查看觸身球符號說明" style={({ pressed }) => [styles.battedBallExceptionalButton, pressed && styles.pressed]}><Text style={styles.battedBallExceptionalCode}>DB</Text><Text style={styles.battedBallExceptionalLabel}>觸身球</Text></Pressable></View>;
  }

  const readyToCommit = Boolean(result && fieldingEvent && (!needsSequence || draft.fieldingSequence?.trim()));
  const stepLabels = ["球性", "方向／位置", "結果", "傳球事件"];
  return <View style={styles.battedBallWorkflowCard}>
    <View style={styles.battedBallWorkflowHeader}><View><Text style={styles.battedBallWorkflowTitle}>擊出／觸擊後打擊事件</Text><Text style={styles.battedBallWorkflowHint}>已記錄「{triggerLabel}」；請依序完成四步，最後才寫入本打席。</Text></View><Text style={styles.battedBallWorkflowPreview}>{result ? formatRecordColumnNotation(result, fieldingPosition, draft) : "第 1 步"}</Text></View>{step === 4 && needsSequence ? <FieldingSequenceButtonEditor value={draft.fieldingSequence ?? ""} suggestions={fieldingSuggestions} hitDirection={draft.battedBallPosition ?? fieldingPosition} onChange={(fieldingSequence) => onChange({ ...draft, fieldingSequence })} onPreset={(preset) => { const cleanModifiers = modifiers.filter((item) => !/^(DP|TP|FC)（/.test(item)); setFieldingEvent(preset.fieldingPlay ?? "routine"); onChange({ ...draft, fieldingSequence: preset.sequence, fieldingPlay: preset.fieldingPlay, modifiers: cleanModifiers }); }} /> : null}
    <View style={styles.battedBallStepRow}>{stepLabels.map((label, index) => { const stepNumber = (index + 1) as 1 | 2 | 3 | 4; return <View key={label} style={[styles.battedBallStepChip, step === stepNumber && styles.battedBallStepChipActive, step > stepNumber && styles.battedBallStepChipDone]}><Text style={[styles.battedBallStepIndex, step >= stepNumber && styles.battedBallStepIndexActive]}>{stepNumber}</Text><Text style={[styles.battedBallStepText, step >= stepNumber && styles.battedBallStepTextActive]}>{label}</Text></View>; })}</View>

    {step === 1 ? <View style={styles.battedBallStage}><Text style={styles.battedBallStageTitle}>1／4 選擇擊球球性</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recordColumnChoices}>{RECORD_TRAJECTORIES.map((item) => <Pressable key={item.id} onPress={() => { onChange({ ...draft, trajectory: item.id, battedBallPosition: undefined }); setStep(2); }} onLongPress={() => onOpenSymbolHelp({ mark: item.mark, name: item.label, area: "外圈右下（藍字）", usage: "搭配方向位置 1–9，描述擊出球的飛行或滾地性質；守備傳接需另填。", example: `${item.mark}7 2B`, tone: "blue" })} delayLongPress={420} accessibilityHint="長按查看早稻田符號說明" style={({ pressed }) => [styles.recordColumnChoice, draft.trajectory === item.id && styles.recordColumnChoiceActive, pressed && styles.pressed]}><Text style={[styles.recordColumnChoiceMark, draft.trajectory === item.id && styles.recordColumnChoiceMarkActive]}>{item.mark}</Text><Text style={[styles.recordColumnChoiceText, draft.trajectory === item.id && styles.recordColumnChoiceTextActive]}>{item.label}</Text></Pressable>)}</ScrollView></View> : null}

    {step === 2 ? <View style={styles.battedBallStage}><Text style={styles.battedBallStageTitle}>2／4 選擇擊球方向／守備位置</Text><Text style={styles.battedBallStageHint}>使用 1–9 代號記錄擊球方向；例如左外野高飛球為「⌒7」。</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.positionRow}>{FIELD_POSITIONS.map((position) => <Pressable key={position.number} onPress={() => { onPosition(position.number); onChange({ ...draft, battedBallPosition: position.number }); setStep(3); }} style={({ pressed }) => [styles.positionChip, draft.battedBallPosition === position.number && styles.positionChipActive, pressed && styles.pressed]}><Text style={[styles.positionChipNumber, draft.battedBallPosition === position.number && styles.positionChipNumberActive]}>{position.number}</Text><Text style={[styles.positionChipLabel, draft.battedBallPosition === position.number && styles.positionChipLabelActive]}>{position.label}</Text></Pressable>)}</ScrollView><Button label="上一步" onPress={() => clearAfter(1)} variant="secondary" compact touch /></View> : null}

    {step === 3 ? <View style={styles.battedBallStage}>
      <Text style={styles.battedBallStageTitle}>3／4 選擇安打、出局或失誤</Text>
      <View style={styles.resultGrid}>{ballInPlayResults.map((shortcut) => <Pressable key={shortcut.id} onPress={() => { onSelectResult(shortcut.result); onChange({ ...draft, sacrificeFlyNoScoreReason: undefined }); setSfNoScoreWarning(false); setStep(4); }} onLongPress={() => onOpenSymbolHelp(getResultSymbolHelp(shortcut.result, draft.battedBallPosition ?? fieldingPosition))} delayLongPress={420} accessibilityHint="長按查看早稻田符號說明" style={({ pressed }) => [styles.resultButton, result === shortcut.result && styles.resultButtonSelected, ["1B", "2B", "3B", "HR"].includes(shortcut.result) && styles.hitResultButton, ["F", "G"].includes(shortcut.result) && styles.outResultButton, pressed && styles.pressed]}><Text style={styles.resultButtonCode}>{shortcut.code ?? getResultShortcutCode(shortcut.result, fieldingPosition)}</Text><Text style={styles.resultButtonLabel}>{shortcut.label ?? RESULT_SHORTCUT_LABELS[shortcut.result]}</Text></Pressable>)}</View>
      <View style={styles.sacrificeButtonRow}>
        {canRecordSacrifice ? <Pressable onPress={chooseSacrificeBunt} onLongPress={() => onOpenSymbolHelp({ mark: "SH", name: "犧牲短打", area: "內圈格／打擊結果", usage: "有壘上跑者時，打者以觸擊使跑者推進且自己出局；不計打數。", example: sacrificePreview.runs ? "SH · 三壘跑者回本，記 1 RBI" : "SH · 壘上跑者各推進一壘", tone: "blue" })} delayLongPress={420} accessibilityHint="長按查看犧牲短打規則" style={({ pressed }) => [styles.sacrificeBuntButton, sacrificeSelected && styles.sacrificeBuntButtonActive, pressed && styles.pressed]}><View><Text style={[styles.sacrificeBuntCode, sacrificeSelected && styles.sacrificeBuntCodeActive]}>SH</Text><Text style={[styles.sacrificeBuntLabel, sacrificeSelected && styles.sacrificeBuntLabelActive]}>犧牲短打</Text></View><Text style={[styles.sacrificeBuntHint, sacrificeSelected && styles.sacrificeBuntHintActive]}>{sacrificePreview.runs ? "三壘跑者回本 · 1 RBI" : "跑者各推進一壘"}</Text></Pressable> : null}
        <Pressable onPress={requestSacrificeFly} onLongPress={() => onOpenSymbolHelp({ mark: "SF", name: "高飛犧牲打", area: "內圈格／打擊結果", usage: "三壘有跑者時，打者以高飛球出局使跑者回本；不計打數，但記打點。", example: "SF · 三壘跑者回本，記 1 RBI", tone: "blue" })} delayLongPress={420} accessibilityHint="長按查看高飛犧牲打規則" style={({ pressed }) => [styles.sacrificeBuntButton, sacrificeFlySelected && styles.sacrificeBuntButtonActive, pressed && styles.pressed]}><View><Text style={[styles.sacrificeBuntCode, sacrificeFlySelected && styles.sacrificeBuntCodeActive]}>SF</Text><Text style={[styles.sacrificeBuntLabel, sacrificeFlySelected && styles.sacrificeBuntLabelActive]}>高飛犧牲打</Text></View><Text style={[styles.sacrificeBuntHint, sacrificeFlySelected && styles.sacrificeBuntHintActive]}>{canRecordSacrificeFly ? "三壘跑者回本 · 1 RBI" : "先確認三壘跑者"}</Text></Pressable>
      </View>
      {sfNoScoreWarning ? <View style={styles.sacrificeFlyWarningBanner}><View style={styles.sacrificeFlyWarningCopy}><Text style={styles.sacrificeFlyWarningTitle}>注意：三壘無跑者</Text><Text style={styles.sacrificeFlyWarningText}>請以「三壘無跑者」例外保存 SF；不會產生得分或打點，並會在早稻田紀錄附註原因。</Text></View><View style={styles.sacrificeFlyWarningActions}><Button label="取消" onPress={() => setSfNoScoreWarning(false)} variant="secondary" compact touch /><Button label="記錄例外 SF" onPress={() => chooseSacrificeFly("no_third_runner")} compact touch /></View></View> : null}
      <Button label="上一步" onPress={() => clearAfter(2)} variant="secondary" compact touch />
    </View> : null}

    {step === 4 ? <View style={styles.battedBallStage}>
      <Text style={styles.battedBallStageTitle}>4／4 選擇傳球事件</Text>
      <Text style={styles.battedBallStageHint}>安打無傳接請選「無傳接」；一般守備、失誤、雙殺、三殺與野選則選擇類型後填入傳接序列。</Text>
      {sacrificeSelected || sacrificeFlySelected ? <View style={styles.sacrificeBuntPreview}><Text style={styles.sacrificeBuntPreviewTitle}>{sacrificeFlySelected ? "高飛犧牲打預覽" : "犧牲短打推進預覽"}</Text><Text style={styles.sacrificeBuntPreviewText}>{sacrificeFlySelected ? (sacrificeFlyNoScoreReason === "runner_held_at_third" ? "例外：三壘跑者未衝本壘，保留三壘且不記得分或打點。" : sacrificeFlyNoScoreReason === "runner_out_at_home" ? "例外：三壘跑者由守備傳殺於本壘；打者與跑者各記 1 出局，不計得分或打點。" : sacrificeFlyNoScoreReason === "no_third_runner" ? "例外：三壘無跑者；不會產生得分或打點，並保存原因備註。" : "三壘跑者回本，完成後自動記 1 分與 1 RBI；打者以高飛犧牲打出局且不計打數。") : sacrificePreview.runs ? "三壘跑者回本，完成後自動記 1 分與 1 RBI；其餘跑者各推進一壘。" : "完成後壘上跑者各推進一壘；打者以犧牲短打出局且不計打數。"}</Text></View> : null}
      {sacrificeFlySelected ? <View style={styles.sacrificeFlyFieldingPanel}><View style={styles.sacrificeFlyFieldingHeader}><Text style={styles.sacrificeFlyFieldingTitle}>外野守備位置與傳殺</Text><Text style={styles.sacrificeFlyFieldingHint}>先選接球外野手，再用上方按鈕輸入傳殺序列，例如 8ー2。</Text></View><View style={styles.sacrificeFlyOutfieldRow}>{FIELD_POSITIONS.filter((position) => ["7", "8", "9"].includes(position.number)).map((position) => <Pressable key={position.number} onPress={() => { onPosition(position.number); onChange({ ...draft, battedBallPosition: position.number }); }} style={({ pressed }) => [styles.sacrificeFlyOutfieldButton, draft.battedBallPosition === position.number && styles.sacrificeFlyOutfieldButtonActive, pressed && styles.pressed]}><Text style={[styles.sacrificeFlyOutfieldCode, draft.battedBallPosition === position.number && styles.sacrificeFlyOutfieldCodeActive]}>{position.number}</Text><Text style={[styles.sacrificeFlyOutfieldLabel, draft.battedBallPosition === position.number && styles.sacrificeFlyOutfieldLabelActive]}>{position.label}</Text></Pressable>)}</View></View> : null}
      {sacrificeFlySelected ? <View style={styles.sacrificeFlyReasonPanel}><Text style={styles.sacrificeFlyReasonTitle}>未得分原因（例外才需選擇）</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sacrificeFlyReasonRow}>{canRecordSacrificeFly ? <Pressable onPress={() => { const advancement = getSacrificeFlyAdvancement(runners); onChange({ ...draft, sacrificeFlyNoScoreReason: undefined, rbi: advancement.runs }); }} style={({ pressed }) => [styles.sacrificeFlyReasonButton, !sacrificeFlyNoScoreReason && styles.sacrificeFlyReasonButtonActive, pressed && styles.pressed]}><Text style={[styles.sacrificeFlyReasonText, !sacrificeFlyNoScoreReason && styles.sacrificeFlyReasonTextActive]}>正常回本</Text></Pressable> : null}{sacrificeFlyNoScoreReasonOptions.map((reason) => <Pressable key={reason} onPress={() => { const advancement = getSacrificeFlyAdvancement(runners, reason); onChange({ ...draft, sacrificeFlyNoScoreReason: reason, rbi: advancement.runs }); }} style={({ pressed }) => [styles.sacrificeFlyReasonButton, sacrificeFlyNoScoreReason === reason && styles.sacrificeFlyReasonButtonActive, pressed && styles.pressed]}><Text style={[styles.sacrificeFlyReasonText, sacrificeFlyNoScoreReason === reason && styles.sacrificeFlyReasonTextActive]}>{SACRIFICE_FLY_NO_SCORE_REASON_LABELS[reason]}</Text></Pressable>)}</ScrollView></View> : null}
      {(result === "F" || result === "G") ? <View style={styles.fieldingExampleRow}><Text style={styles.fieldingExampleLabel}>即時守備範例</Text><Text style={styles.fieldingExampleValue}>{fieldingExample}</Text><Text style={styles.fieldingExampleHint}>{result === "F" ? "高飛球＋守備位置" : "滾地球＋守備位置／傳接"}</Text></View> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.battedBallFieldingChoices}>{([{ id: "none", label: "無傳接", detail: "安打／直接出局" }, { id: "routine", label: "一般傳接", detail: "例：5ー3、5Eー3" }, ...FIELDING_PLAY_CHOICES] as Array<{ id: FieldingEventChoice; label: string; detail: string }>).map((choice) => <Pressable key={choice.id} onPress={() => chooseFieldingEvent(choice.id)} onLongPress={() => { if (choice.id === "DP" || choice.id === "TP" || choice.id === "FC") onOpenSymbolHelp(getModifierSymbolHelp(`${choice.id}（${choice.detail}）`)); }} delayLongPress={420} accessibilityHint="長按查看早稻田符號說明" style={({ pressed }) => [styles.battedBallFieldingChoice, fieldingEvent === choice.id && styles.battedBallFieldingChoiceActive, pressed && styles.pressed]}><Text style={[styles.battedBallFieldingChoiceCode, fieldingEvent === choice.id && styles.battedBallFieldingChoiceCodeActive]}>{choice.label}</Text><Text style={[styles.battedBallFieldingChoiceDetail, fieldingEvent === choice.id && styles.battedBallFieldingChoiceDetailActive]}>{choice.detail}</Text></Pressable>)}</ScrollView>
      {needsSequence ? <View style={styles.fieldingPlayEditor}><View style={styles.fieldingPlayHeader}><Text style={styles.recordColumnFieldLabel}>即時早稻田預覽</Text><Text style={styles.fieldingPlayPreview}>{result ? formatRecordColumnNotation(result, fieldingPosition, draft) || "請選擇傳接球序列" : "請選擇打擊結果"}</Text></View></View> : null}
      <View style={styles.recordColumnDetailRow}><View style={styles.recordColumnSequenceWrap}><Text style={styles.recordColumnFieldLabel}>打點（選填）</Text><Text style={styles.recordColumnFieldHint}>選擇得分打點後，會隨此打席同步計入統計。</Text></View><View style={styles.recordColumnRbiWrap}><View style={styles.recordColumnRbiRow}>{[0, 1, 2, 3, 4].map((value) => <Pressable key={value} onPress={() => setRbi(value)} style={({ pressed }) => [styles.recordColumnRbiButton, draft.rbi === value && styles.recordColumnRbiButtonActive, pressed && styles.pressed]}><Text style={[styles.recordColumnRbiText, draft.rbi === value && styles.recordColumnRbiTextActive]}>{value}</Text></Pressable>)}</View></View></View>
      <View style={styles.battedBallCompletionRow}><Button label="上一步" onPress={() => clearAfter(3)} variant="secondary" compact touch /><Button label={fieldingEvent === "FC" ? "確認 FC 壘位" : "完成並寫入打席"} onPress={() => { if (!result) return; if (fieldingEvent === "FC") { setShowFcConfirmation(true); return; } onCommit(result); }} compact touch disabled={!readyToCommit} /></View>
    </View> : null}
    <FieldersChoiceConfirmationModal visible={showFcConfirmation} batter={batter} battingPlayers={battingPlayers} runners={runners} result={result} draft={draft} fieldingPosition={fieldingPosition} onClose={() => setShowFcConfirmation(false)} onConfirm={() => { if (result) onCommit(result); setShowFcConfirmation(false); }} />
  </View>;
}

function FieldersChoiceConfirmationModal({ visible, batter, battingPlayers, runners, result, draft, fieldingPosition, onClose, onConfirm }: { visible: boolean; batter?: Player; battingPlayers: Player[]; runners: Game["runners"]; result: AtBatResult | null; draft: RecordColumn; fieldingPosition: string; onClose: () => void; onConfirm: () => void }) {
  const settlement = batter && result ? (draft.fieldingPlay === "FC" ? nextFieldersChoiceRunnerState(runners, batter.id) : nextRunnerState(runners, result, batter.id)) : null;
  const finalBaseFor = (runnerId?: string | null) => {
    if (!runnerId || !settlement) return "離壘／出局";
    if (draft.fieldingPlay === "FC" && runners.first === runnerId) return "一壘封殺出局";
    if (settlement.runners.first === runnerId) return "一壘";
    if (settlement.runners.second === runnerId) return "二壘";
    if (settlement.runners.third === runnerId) return "三壘";
    return "本壘得分／離壘";
  };
  const participantRows = [
    { id: "batter", role: "打者", player: batter, finalBase: finalBaseFor(batter?.id) },
    ...([{ base: 1 as const, runnerId: runners.first }, { base: 2 as const, runnerId: runners.second }, { base: 3 as const, runnerId: runners.third }]
      .filter((entry) => Boolean(entry.runnerId))
      .map((entry) => ({ id: `runner-${entry.base}`, role: `原 ${entry.base} 壘跑者`, player: battingPlayers.find((candidate) => candidate.id === entry.runnerId), finalBase: finalBaseFor(entry.runnerId) }))),
  ];
  const notation = result ? formatRecordColumnNotation(result, fieldingPosition, draft) : "FC";
  return <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>確認野手選擇（FC）</Text><Text style={styles.modalSubtitle}>核對打者與原壘上跑者的最終壘位，再寫入本打席。</Text></View><Pressable onPress={onClose}><Text style={styles.modalClose}>取消</Text></Pressable></View><View style={styles.modalScrollContent}><View style={styles.confirmationSummary}><Text style={styles.confirmationSummaryTitle}>最終壘位預覽</Text>{participantRows.map((row) => <View key={row.id} style={styles.fcConfirmationRow}><View><Text style={styles.fcConfirmationRole}>{row.role}</Text><Text style={styles.confirmationSummaryText}>#{row.player?.number ?? "—"} {row.player?.name ?? "未登錄球員"}</Text></View><View style={styles.fcConfirmationBase}><Text style={styles.fcConfirmationBaseText}>{row.finalBase}</Text></View></View>)}<Text style={styles.confirmationNotation}>早稻田符號：{notation || "FC · 請輸入傳接球序列"}</Text></View><Text style={styles.substitutionContext}>確認後會依目前選取的結果與傳接序列，將壘包、跑壘來源、單場整體紀錄及統計同步寫入；取消則保留目前的 FC 輸入以便修正。</Text><View style={styles.confirmationActionRow}><View style={styles.confirmationActionFlex}><Button label="返回修正" onPress={onClose} variant="secondary" touch fluid /></View><View style={styles.confirmationActionFlex}><Button label="確認寫入 FC" onPress={onConfirm} touch fluid /></View></View></View></View></View></Modal>;
}

function FieldingSequenceButtonEditor({ value, suggestions, hitDirection, onChange, onPreset }: { value: string; suggestions: FieldingSequenceSuggestion[]; hitDirection: string; onChange: (fieldingSequence: string) => void; onPreset: (preset: Pick<FieldingSequenceSuggestion, "sequence" | "fieldingPlay">) => void }) {
  const append = (symbol: string) => onChange(`${value}${symbol}`);
  return <View style={styles.fieldingSymbolEditor}>
    <View style={styles.fieldingSymbolHeader}><Text style={styles.fieldingSymbolTitle}>傳接球序列（早稻田符號）</Text><Text style={styles.fieldingSymbolPreview}>{value || "A＝自踩一壘；請依序輸入"}</Text></View>
    <View style={styles.fieldingPresetRow}><View style={styles.fieldingPresetCaption}><Text style={styles.fieldingPresetLabel}>情境前 5</Text><Text style={styles.fieldingDirectionHint}>↘ {hitDirection || "—"} 方向優先</Text></View>{suggestions.map((suggestion) => <Pressable key={suggestion.id} onPress={() => onPreset(suggestion)} style={({ pressed }) => [styles.fieldingPresetButton, pressed && styles.pressed]}><Text style={styles.fieldingPresetCode}>{suggestion.label}</Text><Text style={styles.fieldingPresetDetail} numberOfLines={1}>{suggestion.detail}</Text></Pressable>)}</View>
    <View style={styles.fieldingSymbolNumberRow}>{FIELD_POSITIONS.map((position) => <Pressable key={position.number} onPress={() => append(position.number)} style={({ pressed }) => [styles.fieldingSymbolButton, pressed && styles.pressed]}><Text style={styles.fieldingSymbolCode}>{position.number}</Text><Text style={styles.fieldingSymbolLabel}>{position.label}</Text></Pressable>)}</View>
    <View style={styles.fieldingSymbolActionRow}><Pressable onPress={() => append("ー")} style={({ pressed }) => [styles.fieldingSymbolAction, pressed && styles.pressed]}><Text style={styles.fieldingSymbolActionCode}>ー</Text><Text style={styles.fieldingSymbolActionLabel}>傳球</Text></Pressable><Pressable onPress={() => append("A")} onLongPress={() => Alert.alert("自踩一壘（A）", "野手自行踩一壘完成封殺時，於守備代號後接 A，例如一壘手自行踩壘記為 3A；A 不是傳球符號。補位後踩一壘可記 1ー4A。")} delayLongPress={420} accessibilityHint="長按查看自踩一壘 A 的早稻田用法" style={({ pressed }) => [styles.fieldingSymbolAction, styles.fieldingSymbolBaseTouchAction, pressed && styles.pressed]}><Text style={styles.fieldingSymbolActionCode}>A</Text><Text style={styles.fieldingSymbolActionLabel}>自踩一壘</Text></Pressable><Pressable onPress={() => append("E")} style={({ pressed }) => [styles.fieldingSymbolAction, styles.fieldingSymbolErrorAction, pressed && styles.pressed]}><Text style={styles.fieldingSymbolActionCode}>E</Text><Text style={styles.fieldingSymbolActionLabel}>失誤</Text></Pressable><Pressable disabled={!value} onPress={() => onChange(value.slice(0, -1))} style={({ pressed }) => [styles.fieldingSymbolAction, !value && styles.fieldingSymbolActionDisabled, pressed && styles.pressed]}><Text style={styles.fieldingSymbolActionCode}>⌫</Text><Text style={styles.fieldingSymbolActionLabel}>刪除</Text></Pressable><Pressable disabled={!value} onPress={() => onChange("")} style={({ pressed }) => [styles.fieldingSymbolAction, !value && styles.fieldingSymbolActionDisabled, pressed && styles.pressed]}><Text style={styles.fieldingSymbolActionCode}>×</Text><Text style={styles.fieldingSymbolActionLabel}>清除</Text></Pressable></View>
  </View>;
}

function BatterQueuePreview({ players, events }: { players: Player[]; events: Game["events"] }) {
  return <View style={styles.batterQueueSection}><Text style={styles.batterQueueTitle}>後面 2 棒次</Text><View style={styles.batterQueueRow}>{players.map((player, index) => { const latest = [...events].reverse().find((event) => event.batterId === player.id); return <View key={player.id} style={styles.batterQueueCard}><View style={styles.batterQueueIdentity}><Text style={styles.batterQueueOrder}>NEXT {index + 1}</Text><Text numberOfLines={1} style={styles.batterQueueName}>#{player.number} {player.name}</Text></View><WasedaPersonalRecordCell size="compact" event={latest} label="上次打席" showLabels={false} /></View>; })}</View></View>;
}

function InningAtBatRail({ events, players }: { events: Game["events"]; players: Player[] }) {
  if (events.length === 0) return <View style={styles.inningRailEmpty}><Text style={styles.inningRailEmptyTitle}>本局尚無完成打席</Text><Text style={styles.inningRailEmptyText}>完成第一個打席後，早稻田紀錄格會依時間列在此處。</Text></View>;
  const playerInningEvents = Array.from(new Map(events.map((event) => [`${event.batterId}-${event.inning}`, aggregateInningRunnerEvents(events, event.batterId, event.inning) ?? event])).values());
  return <View style={styles.inningRailList}>{playerInningEvents.map((event, index) => { const player = players.find((candidate) => candidate.id === event.batterId); return <View key={event.id} style={styles.inningRailItem}><View style={styles.inningRailIndex}><Text style={styles.inningRailIndexText}>{index + 1}</Text></View><View style={styles.inningRailCell}><Text numberOfLines={1} style={styles.inningRailPlayer}>#{player?.number ?? "—"} {player?.name ?? event.batterId}</Text><WasedaPersonalRecordCell size="rail" event={event} showLabels={false} /></View></View>; })}</View>;
}

function LegacyRecordView({ game, away, home, myTeam, mySide, battingTeam, pitchingTeam, batter, pitcher, teamPerformance, awayPerformance, homePerformance, pitchDraft, fieldingPosition, selectedResult, selectedPitchType, selectedPitchZone, recentEvents, canUndo, onUndo, onSubstitute, onSpecialEvent, onStart, onPitch, onOutcome, onPosition, onPitchType, onPitchZone, onEdit, onFinish }: { game: Game; away: Team; home: Team; myTeam: Team; mySide: TeamSide | null; battingTeam: Team; pitchingTeam: Team; batter?: Player; pitcher?: Player; teamPerformance: ReturnType<typeof getTeamPerformanceSummary> | null; awayPerformance: ReturnType<typeof getTeamPerformanceSummary> | null; homePerformance: ReturnType<typeof getTeamPerformanceSummary> | null; pitchDraft: PitchDraft; fieldingPosition: string; selectedResult: AtBatResult; selectedPitchType: PitchType; selectedPitchZone: PitchLocation["zone"]; recentEvents: Array<{ id: string; batterName: string; notation: string; inning: number; half: TeamSide; result: AtBatResult; pitches: { balls: number; strikes: number; total: number } }>; canUndo: boolean; onUndo: () => void; onSubstitute: () => void; onSpecialEvent: () => void; onStart: () => void; onPitch: (kind: PitchOutcome) => void; onOutcome: (result: AtBatResult) => void; onPosition: (position: string) => void; onPitchType: (type: PitchType) => void; onPitchZone: (zone: PitchLocation["zone"]) => void; onEdit: () => void; onFinish: () => void }) {
  const swipeResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > 70 && canUndo) onUndo();
      if (gesture.dx < -70) onSpecialEvent();
    },
  }), [canUndo, onSpecialEvent, onUndo]);

  return (
    <View style={styles.pageGap}>
      <View style={styles.recordHeader}><View><Text style={styles.eyebrow}>LIVE SCORING</Text><Text style={styles.sectionTitle}>{game.name}</Text><Text style={styles.mutedText}>{game.venue} · {game.date}</Text></View><Pressable onPress={onEdit} style={styles.iconButton}><Text style={styles.iconButtonText}>⋯</Text></Pressable></View>
      <ScoreBoard game={game} away={away} home={home} />
          <View style={styles.liveTeamsCard}><View style={styles.liveTeamsHeader}><View><Text style={styles.teamPerspectiveEyebrow}>現場記錄分區 · 早稻田紀錄法</Text><Text style={styles.liveTeamsTitle}>主場(先守)／客場(先攻)球隊整體表現</Text></View><Text style={styles.liveTeamsMeta}>{mySide === "home" ? "所屬隊在主場(先守)" : mySide === "away" ? "所屬隊在客場(先攻)" : "所屬隊未參與本場"}</Text></View><View style={styles.liveTeamsRow}><View style={[styles.liveTeamPanel, mySide === "away" && styles.liveTeamPanelOwned]}><View style={styles.liveTeamPanelHeader}><Text style={styles.liveTeamSide}>客場(先攻)</Text>{mySide === "away" ? <Text style={styles.liveTeamOwned}>我的球隊</Text> : null}</View><Text style={styles.liveTeamName}>{away.name}</Text><Text style={styles.liveTeamNotation}>R {awayPerformance?.runs ?? 0} · H {awayPerformance?.hits ?? 0} · BB {awayPerformance?.walks ?? 0} · K {awayPerformance?.strikeouts ?? 0}</Text></View><View style={[styles.liveTeamPanel, mySide === "home" && styles.liveTeamPanelOwned]}><View style={styles.liveTeamPanelHeader}><Text style={styles.liveTeamSide}>主場(先守)</Text>{mySide === "home" ? <Text style={styles.liveTeamOwned}>我的球隊</Text> : null}</View><Text style={styles.liveTeamName}>{home.name}</Text><Text style={styles.liveTeamNotation}>R {homePerformance?.runs ?? 0} · H {homePerformance?.hits ?? 0} · BB {homePerformance?.walks ?? 0} · K {homePerformance?.strikeouts ?? 0}</Text></View></View><Text style={styles.liveTeamsHint}>上方保留主客(先守/先攻)場整體紀錄；下方「個人逐球輸入」只作用於目前打者，並同步更新所屬隊統計預覽。</Text></View>
      {game.status === "setup" ? <View style={styles.setupCard}><Text style={styles.setupTitle}>球員名單與比賽資訊已就緒</Text><Text style={styles.setupText}>客場(先攻)先攻，記錄員可以從第一球開始建立完整比賽紀錄。</Text><Button label="開始第一局" onPress={onStart} /></View> : null}
      <View style={styles.atBatCard} {...swipeResponder.panHandlers}>
        <View style={styles.atBatTop}><View><Text style={styles.eyebrow}>{game.half === "away" ? "客隊進攻" : "主隊進攻"}</Text><Text style={styles.atBatTitle}>第 {game.inning} 局 · {game.outs} 出局</Text></View><Text style={styles.orderBadge}>第 {game.half === "away" ? (game.awayBatterIndex % Math.max(battingTeam.players.length, 1)) + 1 : (game.homeBatterIndex % Math.max(battingTeam.players.length, 1)) + 1} 棒</Text></View>
        <View style={styles.matchup}><View style={styles.playerCircle}><Text style={styles.playerCircleNumber}>{batter?.number ?? "—"}</Text></View><View style={styles.matchupCopy}><Text style={styles.matchupLabel}>目前打者</Text><Text style={styles.matchupName}>{batter?.name ?? "尚未設定球員"}</Text><Text style={styles.matchupMeta}>{batter?.position ?? ""} · {batter?.bats ?? "R"}打</Text></View><Text style={styles.matchupArrow}>對</Text><View style={[styles.playerCircle, styles.pitcherCircle]}><Text style={styles.playerCircleNumber}>{pitcher?.number ?? "—"}</Text></View><View style={styles.matchupCopy}><Text style={styles.matchupLabel}>投手</Text><Text style={styles.matchupName}>{pitcher?.name ?? "尚未設定投手"}</Text><Text style={styles.matchupMeta}>{pitchingTeam.name}</Text></View></View>
        <View style={styles.countRow}><View style={styles.countBox}><Text style={styles.countValue}>{pitchDraft.balls}</Text><Text style={styles.countLabel}>壞球</Text></View><View style={styles.countBox}><Text style={[styles.countValue, styles.strikeValue]}>{pitchDraft.strikes}</Text><Text style={styles.countLabel}>好球</Text></View><View style={styles.countBox}><Text style={[styles.countValue, styles.outValue]}>{game.outs}</Text><Text style={styles.countLabel}>出局</Text></View><View style={styles.countBox}><Text style={[styles.countValue, styles.pitchValue]}>{pitchDraft.total}</Text><Text style={styles.countLabel}>本打席球數</Text></View></View>
        <BaseballDiamond runners={game.runners} />
        <LiveWasedaInfield game={game} pitchDraft={pitchDraft} batter={batter} />
        <View style={styles.teamPerspectiveCard}><View><Text style={styles.teamPerspectiveEyebrow}>球隊整體表現 · 早稻田紀錄法</Text><Text style={styles.teamPerspectiveTitle}>{myTeam.name} · {mySide === "home" ? "主場(先守)" : mySide === "away" ? "客場(先攻)" : "未加入本場"}</Text></View><View style={styles.teamPerspectiveStats}><Text style={styles.teamPerspectiveStat}>R {teamPerformance?.runs ?? 0}</Text><Text style={styles.teamPerspectiveStat}>H {teamPerformance?.hits ?? 0}</Text><Text style={styles.teamPerspectiveStat}>BB {teamPerformance?.walks ?? 0}</Text><Text style={styles.teamPerspectiveStat}>K {teamPerformance?.strikeouts ?? 0}</Text><Text style={styles.teamPerspectiveStat}>SB {teamPerformance?.stolenBases ?? 0}</Text></View><Text style={styles.teamPerspectiveHint}>下方按鈕是目前打者的個人逐球輸入；此卡同步顯示 {battingTeam.name} 的團隊累計。</Text></View>
        <PitchTrackingControls selectedType={selectedPitchType} pitchZone={selectedPitchZone} onType={onPitchType} onPitchZone={onPitchZone} onPitch={onPitch} />
        <Text style={styles.inputLabel}>個人逐球輸入 · 早稻田紀錄法</Text>
        <View style={styles.pitchRow}><Button label="壞球 —" onPress={() => onPitch("ball")} variant="secondary" /><Button label="好球 ○" onPress={() => onPitch("strike")} variant="secondary" /><Button label="界外 △" onPress={() => onPitch("foul")} variant="ghost" /></View>
        <Text style={styles.inputLabel}>擊球結果 · 先選守備位置</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.positionRow}>{FIELD_POSITIONS.map((position) => <Pressable key={position.number} onPress={() => onPosition(position.number)} style={[styles.positionChip, fieldingPosition === position.number && styles.positionChipActive]}><Text style={[styles.positionChipNumber, fieldingPosition === position.number && styles.positionChipNumberActive]}>{position.number}</Text><Text style={[styles.positionChipLabel, fieldingPosition === position.number && styles.positionChipLabelActive]}>{position.label}</Text></Pressable>)}</ScrollView>
        <View style={styles.resultGrid}>{(["1B", "2B", "3B", "HR", "BB", "HBP", "K", "F", "G", "E"] as AtBatResult[]).map((result) => <Pressable key={result} onPress={() => onOutcome(result)} style={({ pressed }) => [styles.resultButton, ["1B", "2B", "3B", "HR"].includes(result) && styles.hitResultButton, result === "K" && styles.outResultButton, pressed && styles.pressed]}><Text style={styles.resultButtonCode}>{getResultShortcutCode(result, fieldingPosition)}</Text><Text style={styles.resultButtonLabel}>{RESULT_SHORTCUT_LABELS[result]}</Text></Pressable>)}</View>
        <Text style={styles.notationHint}>本次紀錄預覽：<Text style={styles.notationValue}>{getNotation(selectedResult, fieldingPosition)}</Text></Text>
        <Pressable onPress={onSpecialEvent} style={({ pressed }) => [styles.specialEventButton, pressed && styles.pressed]}><Text style={styles.specialEventButtonIcon}>↗</Text><View><Text style={styles.specialEventButtonTitle}>特殊事件</Text><Text style={styles.specialEventButtonText}>盜壘 · 盜壘刺 · 暴投 · 捕逸 · 投手犯規</Text></View><Text style={styles.specialEventButtonArrow}>›</Text></Pressable>
        <Text style={styles.gestureHint}>向右滑回復上一球　·　向左滑開啟特殊事件</Text>
      </View>
      <View style={styles.recentCard}><SectionTitle eyebrow="PLAY-BY-PLAY" title="最近紀錄" action={<Text style={styles.eventCount}>{game.events.length + (game.specialEvents ?? []).length} 筆</Text>} />{recentEvents.length === 0 && (game.specialEvents ?? []).length === 0 ? <Text style={styles.emptyText}>尚未有逐球結果，從上方選擇好球、壞球、擊球結果或特殊事件。</Text> : <>{recentEvents.map((event) => <View key={event.id} style={styles.eventRow}><View style={styles.eventInning}><Text style={styles.eventInningNumber}>{event.inning}</Text><Text style={styles.eventInningHalf}>{event.half === "away" ? "上" : "下"}</Text></View><View style={styles.eventMain}><Text style={styles.eventBatter}>{event.batterName}</Text><Text style={styles.eventMeta}>{event.pitches.total} 球 · {event.result}</Text></View><Text style={styles.eventNotation}>{event.notation}</Text></View>)}{(game.specialEvents ?? []).slice(-8).reverse().map((event) => <View key={event.id} style={styles.eventRow}><View style={[styles.eventInning, styles.specialEventInning]}><Text style={styles.eventInningNumber}>{event.inning}</Text><Text style={styles.eventInningHalf}>{event.half === "away" ? "上" : "下"}</Text></View><View style={styles.eventMain}><Text style={styles.eventBatter}>{SPECIAL_EVENT_LABELS[event.type]}</Text><Text style={styles.eventMeta}>{event.runsScored ? `${event.runsScored} 分 · ` : ""}特殊事件</Text></View><Text style={styles.eventNotation}>{event.notation}</Text></View>)}</>}</View>
      <View style={styles.recordFooter}><Button label="回復上一球" onPress={onUndo} variant="ghost" disabled={!canUndo} compact /><Button label="換人紀錄" onPress={onSubstitute} variant="secondary" compact /><Button label="編輯賽事與備註" onPress={onEdit} variant="secondary" compact /><Button label={game.status === "final" ? "已完成" : "結束比賽"} onPress={onFinish} variant={game.status === "final" ? "secondary" : "danger"} compact /></View>
    </View>
  );
}

function PitchTrackingControls({ selectedType, pitchZone, pitchHistory = [], batter, onUpdateBatterHand, onType, onPitchZone, onPitch, onOpenSymbolHelp = () => undefined, onUndo, canUndo = false }: { selectedType: PitchType; pitchZone: PitchLocation["zone"]; pitchHistory?: PitchLocation[]; batter?: Player; onUpdateBatterHand?: (hand: "R" | "L") => void; onType: (type: PitchType) => void; onPitchZone: (zone: PitchLocation["zone"]) => void; onPitch: (kind: PitchOutcome, selection?: Pick<PitchLocation, "zone" | "type">) => void; onOpenSymbolHelp?: (help: SymbolHelp) => void; onUndo?: () => void; canUndo?: boolean }) {
  const zones = [10, 11, 12, 13, 14, 15, 1, 2, 3, 16, 17, 4, 5, 6, 18, 19, 7, 8, 9, 20, 21, 22, 23, 24, 25] as const;
  const pitchesByZone = groupPitchHistoryByZone(pitchHistory);
  const mirrorPitchZone = (zone: number) => {
    const width = zone <= 9 ? 3 : 5;
    const start = zone <= 9 ? 1 : 10;
    const index = zone - start;
    return start + Math.floor(index / width) * width + (width - 1 - (index % width));
  };
  const displayZones = batter?.battingHand === "L" ? zones.map(mirrorPitchZone) : zones;
  const pendingOutcome = pitchHistory.at(-1)?.outcome;
  const battedBallPending = opensBattedBallWorkflow(pendingOutcome);
  const pendingBallLabel = pendingOutcome === "bunt" ? "觸擊" : "擊出球";
  const [pitchStep, setPitchStep] = useState<1 | 2 | 3>(1);
  const [selectedSymbol, setSelectedSymbol] = useState<PitchOutcome | null>(null);
  const [stagedPitchType, setStagedPitchType] = useState<PitchType | null>(null);
  const resetPitchWorkflow = () => {
    setPitchStep(1);
    setSelectedSymbol(null);
    setStagedPitchType(null);
  };

  useEffect(() => {
    resetPitchWorkflow();
  }, [pitchHistory.length]);

  const chooseSymbol = (kind: PitchOutcome) => {
    setSelectedSymbol(kind);
    setStagedPitchType(null);
    setPitchStep(2);
  };
  const choosePitchType = (type: PitchType) => {
    onType(type);
    setStagedPitchType(type);
    setPitchStep(3);
  };
  const writePitchAtZone = (zone: PitchLocation["zone"]) => {
    if (!selectedSymbol || !stagedPitchType) return;
    onType(stagedPitchType);
    onPitchZone(zone);
    onPitch(selectedSymbol, { zone, type: stagedPitchType });
  };
  if (battedBallPending) {
    return <View style={styles.pitchTrackingCard}><View style={styles.pitchTrackingHeader}><View><Text style={styles.pitchTrackingTitle}>{pendingBallLabel}已完成逐球輸入</Text><Text style={styles.pitchTrackingHint}>本球的球種與九宮格落點已保存。請前往第 4 區依序完成擊球球性、方向／位置、結果與傳球事件，才能結束本打席。</Text></View><Text style={styles.pitchTrackingState}>打擊事件</Text></View><View style={styles.battedBallPitchLock}><Text style={styles.battedBallPitchLockTitle}>一般逐球輸入已暫時鎖定</Text><Text style={styles.battedBallPitchLockHint}>這可避免{pendingBallLabel}後誤記下一球；如需修正落點或球種，請先使用「回復上一球」。</Text>{onUndo ? <Button label="回復上一球" onPress={onUndo} variant="secondary" compact touch disabled={!canUndo} /> : null}</View><Text style={styles.liveMicroHint}>下一步：第 4 區「擊出／觸擊後事件」→ 球性 → 方向／位置 → 結果 → 傳球事件。</Text></View>;
  }
  return (
    <View style={styles.pitchTrackingCard}>
      <View style={styles.pitchTrackingHeader}><View><Text style={styles.pitchTrackingTitle}>逐球三步輸入 · 本打者第 {pitchHistory.length + 1} 球</Text><Text style={styles.pitchTrackingHint}>依序選擇早稻田球數符號、球種及落點；僅點選九宮格後才會寫入這一球。</Text></View><Text style={styles.pitchTrackingState}>{pitchStep}/3</Text></View>
      <View style={styles.pitchWorkflowSteps}>{([1, 2, 3] as const).map((step) => <View key={step} style={[styles.pitchWorkflowStep, pitchStep === step && styles.pitchWorkflowStepActive, pitchStep > step && styles.pitchWorkflowStepDone]}><Text style={[styles.pitchWorkflowStepNumber, pitchStep >= step && styles.pitchWorkflowStepTextActive]}>{step}</Text><Text style={[styles.pitchWorkflowStepText, pitchStep >= step && styles.pitchWorkflowStepTextActive]}>{step === 1 ? "符號" : step === 2 ? "球種" : "落點"}</Text></View>)}</View>
      {pitchStep === 1 ? <><Text style={styles.pitchWorkflowInstruction}>1／3 選擇早稻田球數符號（可長按查看說明）</Text><View style={styles.pitchActionGrid}>{(["ball", "strike", "foulTip", "foul", "swingingStrike", "bunt", "missedBunt", "buntFoul", "foulError", "inPlay"] as PitchOutcome[]).map((kind) => <PitchActionButton key={kind} label={PITCH_SYMBOL_HELP[kind].name} mark={PITCH_SYMBOL_HELP[kind].mark} help={PITCH_SYMBOL_HELP[kind]} onPress={() => chooseSymbol(kind)} onLongPress={onOpenSymbolHelp} selected={selectedSymbol === kind} />)}{onUndo ? <PitchActionButton label="恢復上一球" mark="↶" help={RUNNER_SYMBOL_HELP.UNDO} onPress={onUndo} onLongPress={onOpenSymbolHelp} disabled={!canUndo} emphasis /> : null}</View></> : null}
      {pitchStep === 2 && selectedSymbol ? <><View style={styles.pitchWorkflowMeta}><Text style={styles.pitchWorkflowInstruction}>2／3 已選 {PITCH_SYMBOL_HELP[selectedSymbol].mark} {PITCH_SYMBOL_HELP[selectedSymbol].name}；選擇球種</Text><Pressable onPress={() => setPitchStep(1)} style={styles.pitchWorkflowBack}><Text style={styles.pitchWorkflowBackText}>更換符號</Text></Pressable></View><View style={styles.pitchTypeSelector}>{(["fastball", "breaking"] as PitchType[]).map((type) => <Pressable key={type} onPress={() => choosePitchType(type)} style={({ pressed }) => [styles.pitchTypeButton, stagedPitchType === type && styles.pitchTypeButtonActive, pressed && styles.pressed]}><Text style={[styles.pitchTypeButtonText, stagedPitchType === type && styles.pitchTypeButtonTextActive]}>{type === "fastball" ? "速球" : "變化球"}</Text></Pressable>)}</View></> : null}
      {pitchStep === 3 && selectedSymbol && stagedPitchType ? <><View style={styles.pitchWorkflowMeta}><Text style={styles.pitchWorkflowInstruction}>3／3 {PITCH_SYMBOL_HELP[selectedSymbol].mark} {PITCH_SYMBOL_HELP[selectedSymbol].name} · {stagedPitchType === "fastball" ? "速球" : "變化球"}；選擇九宮格落點</Text><Pressable onPress={() => setPitchStep(2)} style={styles.pitchWorkflowBack}><Text style={styles.pitchWorkflowBackText}>更換球種</Text></Pressable></View><View style={styles.zonePickerRow}><View style={styles.zonePickerPanelWide}><View style={styles.liveMatchupRow}><Text style={styles.zonePickerTitle}>九宮格＋壞球外圈</Text><Text style={styles.smallMuted}>{batter?.battingHand === "L" ? "左打視角（已鏡像）" : batter?.battingHand === "R" ? "右打視角" : "待設定打擊慣用手"}</Text></View>{batter && !batter.battingHand ? <View style={styles.summaryModeToggle}><Text style={styles.smallMuted}>人像設定：</Text><Pressable onPress={() => onUpdateBatterHand?.("R")} style={styles.summaryModeButton}><Text style={styles.summaryModeButtonText}>右打</Text></Pressable><Pressable onPress={() => onUpdateBatterHand?.("L")} style={styles.summaryModeButton}><Text style={styles.summaryModeButtonText}>左打</Text></Pressable></View> : null}<Text style={styles.zonePickerHint}>已記錄 {pitchHistory.length} 球；點選任一格即確認寫入本球。</Text><View style={styles.zonePickerGridFive}>{displayZones.map((zone) => { const outside = zone > 9; const recordedPitches = pitchesByZone[zone] ?? []; return <Pressable key={`pitch-${zone}`} accessibilityLabel={`${outside ? "壞球外圈" : "好球帶"}第 ${zone} 區，確認寫入`} onPress={() => writePitchAtZone(zone)} style={({ pressed }) => [styles.zonePickerCell, outside && styles.zonePickerCellOutside, pitchZone === zone && styles.zonePickerCellPitchActive, recordedPitches.length > 0 && styles.zonePickerCellRecorded, pressed && styles.pressed]}><Text style={[styles.zonePickerZoneNumber, outside && styles.zonePickerCellOutsideText]}>{outside ? "外" : zone}</Text>{recordedPitches.length ? <View style={styles.zonePickerPitchSequence}>{recordedPitches.map((pitch) => <View key={`${zone}-${pitch.sequence}`} style={[styles.zonePickerPitchDot, pitch.type === "breaking" && styles.zonePickerPitchDotBreaking]}><Text style={styles.zonePickerPitchDotText}>{PITCH_SYMBOL_HELP[pitch.outcome].mark}{pitch.sequence}</Text></View>)}</View> : <Text style={[styles.zonePickerCellText, outside && styles.zonePickerCellOutsideText, pitchZone === zone && styles.zonePickerCellTextActive]}>{outside ? "○" : ""}</Text>}</Pressable>; })}</View></View></View></> : null}
      <Text style={styles.liveMicroHint}>球數欄：— 壞球、○ 未揮好球、△ 界外、▲ 擦棒被捕、⊖ 揮空、⌁ 觸擊、◓ 觸擊落空、• 擊出。</Text>
    </View>
  );
}

type LiveWasedaQuadrant = { label: string; pitches?: string; outer: string; inner: string; note: string; event?: Game["events"][number]; runnerAdvance?: Pick<SpecialEvent, "type" | "fromBase" | "toBase"> };

/**
 * 將現場逐球、打席與跑壘事件投影成四分格早稻田紀錄。單場整體紀錄也直接讀取
 * game.events 和 game.specialEvents，因此兩個畫面永遠反映同一筆比賽資料。
 */
function getLiveWasedaQuadrants(game: Game, pitchDraft: PitchDraft, selectedResult?: AtBatResult | null, fieldingPosition = "", recordColumn?: RecordColumn): LiveWasedaQuadrant[] {
  const currentRunningEvents = (game.specialEvents ?? []).filter((event) => event.inning === game.inning && event.half === game.half);
  const pitchMarks = (pitchDraft.locations ?? []).map((pitch) => getWasedaPitchMark(pitch.outcome)).join("") || "·";
  const baseQuadrant = (base: 1 | 2 | 3, label: string, runnerId: string | null): LiveWasedaQuadrant => {
    const runnerEvent = runnerId ? currentRunningEvents.filter((event) => event.runnerId === runnerId).at(-1) : undefined;
    const sourceAtBat = getRunnerSourceAtBat(game.events, game.specialEvents, runnerId, { inning: game.inning, half: game.half });
    return {
      label,
      event: sourceAtBat,
      outer: runnerEvent?.notation ?? sourceAtBat?.notation ?? "·",
      inner: runnerEvent?.type === "CS" ? "CS" : "—",
      note: runnerEvent
        ? `${runnerEvent.type} · ${runnerEvent.fromBase ?? "本"}→${runnerEvent.toBase ?? "得分"}`
        : sourceAtBat
          ? `${sourceAtBat.notation} · 來源打席已同步`
          : runnerId ? "跑者在壘" : "尚無跑壘事件",
      runnerAdvance: runnerEvent ? { type: runnerEvent.type, fromBase: runnerEvent.fromBase, toBase: runnerEvent.toBase } : undefined,
    };
  };

  return [
    { label: "本壘", pitches: pitchMarks, outer: selectedResult ? formatRecordColumnNotation(selectedResult, fieldingPosition, recordColumn ?? {}) : "", inner: selectedResult && ["K", "F", "G"].includes(selectedResult) ? ["I", "II", "III"][Math.min(game.outs, 2)] : "—", note: "球數欄＋外圈格＋內圈格" },
    baseQuadrant(1, "一壘", game.runners.first),
    baseQuadrant(2, "二壘", game.runners.second),
    baseQuadrant(3, "三壘", game.runners.third),
  ];
}

function LiveWasedaInfield({ game, pitchDraft, batter }: { game: Game; pitchDraft: PitchDraft; batter?: Player }) {
  const quadrants = getLiveWasedaQuadrants(game, pitchDraft);
  return <View style={styles.liveWasedaCard}>
    <View style={styles.liveWasedaHeader}><View><Text style={styles.liveWasedaTitle}>現場四分格 · 早稻田紀錄</Text><Text style={styles.liveWasedaHint}>左上本壘呈現球數欄、外圈格及內圈格；一、二、三壘以跑壘外圈格及內圈格即時同步。</Text></View><Text style={styles.liveWasedaBatter}>{playerIdentityLabel(batter, "#— 待選打者")}</Text></View>
    <View style={styles.liveWasedaQuadrantGrid}>
      {quadrants.map((quadrant) => <WasedaBaseCell key={quadrant.label} {...quadrant} />)}
    </View>
    <View style={styles.liveWasedaLegend}><Text style={styles.liveWasedaLegendItem}>球數欄：○ 壞球／— 好球／△ 界外</Text><Text style={styles.liveWasedaLegendItem}>外圈格：打擊、出局或跑壘過程</Text><Text style={styles.liveWasedaLegendItem}>內圈格：打席或壘上事件結果</Text></View>
  </View>;
}

function WasedaBaseCell({ label, pitches, outer, inner, note, event, runnerAdvance, dense = false, size, style }: LiveWasedaQuadrant & { dense?: boolean; size?: "large" | "regular" | "compact" | "live" | "rail"; style?: any }) {
  return <WasedaPersonalRecordCell size={size ?? (dense ? "compact" : "compact")} label={dense ? undefined : label} note={dense ? undefined : note} event={event} pitchMarks={pitches} notation={outer} runnerNotation={label === "本壘" ? undefined : outer} runnerAdvance={runnerAdvance} innerMark={inner} showLabels={false} style={style} />;
}

function FieldCard({ team, selectedPlayerId, onAssign, onClearDefense, onOpenPlayerInfo }: { team: Team; selectedPlayerId: string | undefined; onAssign: (position: string) => void; onClearDefense: () => void; onOpenPlayerInfo: (player: Player, positionLabel: string) => void }) {
  const { interfacePalette } = useThemeContext();
  const layout = [
    { number: "8", label: "中外", style: styles.fieldCenter },
    { number: "7", label: "左外", style: styles.fieldLeft },
    { number: "9", label: "右外", style: styles.fieldRight },
    { number: "6", label: "游擊手", style: styles.fieldShort },
    { number: "4", label: "二壘", style: styles.fieldSecond },
    { number: "5", label: "三壘", style: styles.fieldThird },
    { number: "3", label: "一壘", style: styles.fieldFirst },
    { number: "2", label: "捕手", style: styles.fieldCatcher },
    { number: "1", label: "投手", style: styles.fieldPitcher },
  ];
  return (
    <View style={[styles.fieldCard, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}>
      <View style={styles.fieldHeader}>
        <View>
          <Text style={[styles.fieldTitle, { color: interfacePalette.foreground }]}>守備位置配置（平板雙欄與觸控優化）</Text>
          <Text style={[styles.fieldHint, { color: interfacePalette.muted }]}>短按已指派守位可查看球員資訊；長按守位可指派目前選取球員</Text>
        </View>
        <View style={styles.fieldHeaderActions}>
          <Button label="取消所有守備位置" onPress={onClearDefense} variant="secondary" compact />
          <Text style={[styles.fieldSelected, { color: interfacePalette.primary }]}>選取：{playerIdentityLabel(team.players.find((player) => player.id === selectedPlayerId), "未選")}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fieldRosterStrip}>
        {team.players.map((player) => (
          <Pressable 
            key={player.id} 
            onPress={() => onAssign(`select:${player.id}`)} 
            onLongPress={() => onAssign(`select:${player.id}`)}
            style={({ pressed }) => [styles.fieldPlayerChip, { backgroundColor: player.id === selectedPlayerId ? interfacePalette.primary : interfacePalette.background, borderWidth: 1, borderColor: player.id === selectedPlayerId ? interfacePalette.primary : interfacePalette.border }, pressed && { opacity: 0.82, transform: [{ scale: 0.97 }] }]}
          >
            <Text style={[styles.fieldPlayerNumber, { color: player.id === selectedPlayerId ? readableTextOn(interfacePalette.primary) : interfacePalette.foreground }]}>{player.number}</Text>
            <Text numberOfLines={1} style={[styles.fieldPlayerName, { color: player.id === selectedPlayerId ? readableTextOn(interfacePalette.primary) : interfacePalette.muted }]}>{player.name} {playerHandAbbr(player)}</Text>
            <Text style={styles.fieldPlayerPosBadge}>{player.position || "未排"}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ImageBackground
        source={HOME_DEFENSE_FIELD_IMAGE}
        resizeMode="contain"
        style={styles.fieldCanvasLarge}
        imageStyle={styles.fieldCanvasLargeImage}
        accessibilityLabel="首頁守備位置配置圖（使用者指定棒球場俯視圖）"
      >
        {layout.map((node) => { 
          const assigned = team.players.find((player) => player.position === node.number); 
          return (
            <Pressable 
              key={node.number} 
              onPress={() => assigned ? onOpenPlayerInfo(assigned, `${node.number} · ${node.label}`) : onAssign(node.number)}
              onLongPress={() => onAssign(node.number)}
              style={({ pressed }) => [styles.fieldNodeLarge, node.style, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }, pressed && { opacity: 0.84, transform: [{ scale: 0.97 }] }]}
            >
              <Text style={[styles.fieldNodeNumberLarge, { color: interfacePalette.primary }]}>{node.number}</Text>
              <Text style={[styles.fieldNodeLabelLarge, { color: interfacePalette.foreground }]} numberOfLines={1}>{assigned ? playerIdentityLabel(assigned) : node.label}</Text>
            </Pressable>
          ); 
        })}
      </ImageBackground>
    </View>
  );
}

function TeamsView({ teams, schools, games, primaryTeamId, selectedTeamId, onSelect, onUpdatePlayer, onAddPlayer, onDeletePlayer, onUpdateTeam, onAssignBattingOrder, onManageSchools }: { teams: Team[]; schools: School[]; games: Game[]; primaryTeamId?: string; selectedTeamId: string; onSelect: (id: string) => void; onUpdatePlayer: (teamId: string, playerId: string, patch: Partial<Player>) => void; onAddPlayer: (teamId: string, player: Player) => void; onDeletePlayer: (teamId: string, playerId: string) => void; onUpdateTeam: (teamId: string, patch: Partial<Pick<Team, "logoUri" | "customColor">>) => void; onAssignBattingOrder: (teamId: string, playerId: string, battingOrder: number | undefined) => void; onManageSchools: () => void }) {
  const { interfacePalette } = useThemeContext();
  const selected = teams.find((team) => team.id === selectedTeamId) ?? teams[0];
  const { ownedTeamId, orderedTeams } = useMemo(() => orderTeamsWithPrimaryFirst(teams, primaryTeamId), [primaryTeamId, teams]);
  const orderedSchools = useMemo(() => [...schools].sort((left, right) => {
    if (left.id === orderedTeams[0]?.schoolId) return -1;
    if (right.id === orderedTeams[0]?.schoolId) return 1;
    return left.name.localeCompare(right.name, "zh-Hant");
  }), [orderedTeams, schools]);
  const [teamSelectorExpanded, setTeamSelectorExpanded] = useState(false);
  const visibleTeams = getVisibleTeams(orderedTeams, ownedTeamId, selected?.id, teamSelectorExpanded);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>(selected?.players[0]?.id);
  const [rosterSortMode, setRosterSortMode] = useState<"number" | "name" | "position">("number");
  const [activeBattingOrder, setActiveBattingOrder] = useState(1);
  const [markerPlayerDetail, setMarkerPlayerDetail] = useState<{ player: Player; positionLabel: string } | null>(null);
  const [playerEditor, setPlayerEditor] = useState<{ mode: "add" | "edit"; playerId?: string; name: string; number: string; throwingHand: "R" | "L"; battingHand: "R" | "L"; preferredPositions: string[] } | null>(null);
  const [teamColorInput, setTeamColorInput] = useState(selected?.customColor ?? "");
  useEffect(() => { setSelectedPlayerId(selected?.players[0]?.id); }, [selected?.id]);
  useEffect(() => { setTeamColorInput(selected?.customColor ?? ""); }, [selected?.customColor, selected?.id]);
  const rosterPlayers = useMemo(() => sortPlayersForDisplay(selected?.players ?? [], rosterSortMode), [rosterSortMode, selected?.players]);
  const selectedPlayer = selected?.players.find((player) => player.id === selectedPlayerId) ?? selected?.players[0];
  const activeBattingPlayer = selected?.players.find((player) => player.battingOrder === activeBattingOrder);
  const suggestedTeamColors = useMemo(() => getLogoColorSuggestions(selected?.logoUri, selected?.id === ownedTeamId ? "#1F8A5B" : "#1D5FA7"), [ownedTeamId, selected?.id, selected?.logoUri]);
  const applyTeamColor = (color: string) => {
    if (!selected) return;
    setTeamColorInput(color);
    onUpdateTeam(selected.id, { customColor: color });
  };
  const openPlayerEditor = (player?: Player) => {
    const nextNumber = Math.min(99, Math.max(1, ...selected.players.map((item) => item.number)) + 1);
    setPlayerEditor(player ? { mode: "edit", playerId: player.id, name: player.name, number: String(player.number), throwingHand: player.throwingHand ?? "R", battingHand: player.battingHand ?? (player.bats === "L" ? "L" : "R"), preferredPositions: normalizePreferredPositions(player.preferredPositions) } : { mode: "add", name: "", number: String(nextNumber), throwingHand: "R", battingHand: "R", preferredPositions: [] });
  };
  const toggleEditorPosition = (position: string) => {
    if (!playerEditor) return;
    const selectedPositions = normalizePreferredPositions(playerEditor.preferredPositions);
    if (selectedPositions.includes(position)) {
      setPlayerEditor({ ...playerEditor, preferredPositions: selectedPositions.filter((item) => item !== position) });
      return;
    }
    if (selectedPositions.length >= 4) {
      Alert.alert("最多四個慣用守位", "請先取消一個已選位置，再選擇新的守備位置。");
      return;
    }
    setPlayerEditor({ ...playerEditor, preferredPositions: [...selectedPositions, position] });
  };
  const clearAllDefensivePositions = () => {
    if (!selected) return;
    const assignedPlayers = selected.players.filter((player) => player.position && player.position !== "後備");
    if (!assignedPlayers.length) {
      Alert.alert("目前沒有守備位置", "所有球員目前都未指派守備位置。常用守備位置與棒次不會受到影響。");
      return;
    }
    Alert.alert("取消所有守備位置", `將取消 ${assignedPlayers.length} 位球員的目前守備位置，改為「後備」。常用守備位置與棒次不會受到影響。`, [
      { text: "保留配置", style: "cancel" },
      { text: "取消全部", style: "destructive", onPress: () => assignedPlayers.forEach((player) => onUpdatePlayer(selected.id, player.id, { position: "後備" })) },
    ]);
  };
  const savePlayerEditor = () => {
    if (!playerEditor) return;
    const name = playerEditor.name.trim();
    const number = Number(playerEditor.number);
    if (!name || !Number.isInteger(number) || number < 1 || number > 99) {
      Alert.alert("球員資料未完成", "請填寫姓名及 1 至 99 的有效背號。");
      return;
    }
    if (selected.players.some((player) => player.number === number && player.id !== playerEditor.playerId)) {
      Alert.alert("背號重複", "同一球隊的球員背號不可重複，請改用其他背號。");
      return;
    }
    const preferredPositions = normalizePreferredPositions(playerEditor.preferredPositions);
    const patch: Partial<Player> = { name, number, throwingHand: playerEditor.throwingHand, battingHand: playerEditor.battingHand, bats: playerEditor.battingHand, preferredPositions, position: preferredPositions[0] ?? "後備" };
    if (playerEditor.mode === "add") {
      if (selected.players.length >= 25) {
        Alert.alert("已達名單上限", "每支球隊最多可維護 25 位固定名單球員。");
        return;
      }
      onAddPlayer(selected.id, { id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, number, throwingHand: playerEditor.throwingHand, battingHand: playerEditor.battingHand, bats: playerEditor.battingHand, preferredPositions, position: preferredPositions[0] ?? "後備" });
      setSelectedPlayerId(undefined);
    } else if (playerEditor.playerId) {
      onUpdatePlayer(selected.id, playerEditor.playerId, patch);
      setSelectedPlayerId(playerEditor.playerId);
    }
    setPlayerEditor(null);
  };
  const deleteSelectedPlayer = () => {
    if (!selectedPlayer) return;
    onDeletePlayer(selected.id, selectedPlayer.id);
    setSelectedPlayerId(selected.players.find((player) => player.id !== selectedPlayer.id)?.id);
  };
  const requestDeleteSelectedPlayer = () => {
    if (!selectedPlayer) return;
    if (selected.players.length <= 1) {
      Alert.alert("至少保留一位球員", "球隊名單需至少保留一位球員；請先新增球員後再刪除此球員。");
      return;
    }
    const usage = getPlayerDeletionUsage(games, selected.id, selectedPlayer.id);
    if (usage.requiresWarning) {
      const scopes = [
        usage.lineupGameCount ? `先發名單 ${usage.lineupGameCount} 場` : null,
        usage.recordedGameCount ? `逐球／換人紀錄 ${usage.recordedGameCount} 場` : null,
        usage.registeredGameCount ? `已登錄名單 ${usage.registeredGameCount} 場` : null,
      ].filter(Boolean).join("；");
      const examples = usage.games.slice(0, 3).map((game) => `${game.date.slice(0, 10)} ${game.gameName}`).join("、");
      Alert.alert("使用中球員：請先確認", `#${selectedPlayer.number} ${selectedPlayer.name} 已出現在${scopes}。\n\n涉及賽事：${examples}${usage.games.length > 3 ? ` 等 ${usage.games.length} 場` : ""}\n\n刪除只會移除目前固定名單，不會改寫既有先發快照或逐球紀錄；但歷史畫面可能改以球員 ID 顯示。`, [
        { text: "返回檢查", style: "cancel" },
        { text: "我了解，仍要刪除", style: "destructive", onPress: deleteSelectedPlayer },
      ]);
      return;
    }
    Alert.alert("刪除球員", `確定要從 ${selected.name} 名單刪除 #${selectedPlayer.number} ${selectedPlayer.name} 嗎？既有比賽紀錄不會被改寫。`, [
      { text: "取消", style: "cancel" },
      { text: "刪除", style: "destructive", onPress: deleteSelectedPlayer },
    ]);
  };
  const removeTeamLogo = () => {
    if (!selected?.logoUri) return;
    Alert.alert("移除隊徽", "移除後會改用球隊名稱首字的預設圖案；目前的辨識色會保留。", [
      { text: "取消", style: "cancel" },
      { text: "移除", style: "destructive", onPress: () => onUpdateTeam(selected.id, { logoUri: undefined }) },
    ]);
  };
  const restoreDefaultIdentity = () => {
    if (!selected) return;
    Alert.alert("還原預設圖案", "將清除自訂隊徽與自訂色，改回球隊名稱首字的預設圖案及主／客場基準色。", [
      { text: "取消", style: "cancel" },
      { text: "還原", style: "destructive", onPress: () => { setTeamColorInput(""); onUpdateTeam(selected.id, { logoUri: undefined, customColor: undefined }); } },
    ]);
  };
  const chooseTeamLogo = async () => {
    if (!selected) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.9, base64: Platform.OS === "web" });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const sourceUri = Platform.OS === "web" && asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
    const cropSize = Math.min(asset.width || 512, asset.height || 512);
    const prepared = await ImageManipulator.manipulateAsync(sourceUri, [{ crop: { originX: Math.max(0, Math.round(((asset.width || cropSize) - cropSize) / 2)), originY: Math.max(0, Math.round(((asset.height || cropSize) - cropSize) / 2)), width: cropSize, height: cropSize } }, { resize: { width: 512, height: 512 } }], { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true });
    const logoUri = prepared.base64 ? `data:image/jpeg;base64,${prepared.base64}` : prepared.uri;
    onUpdateTeam(selected.id, { logoUri, customColor: selected.customColor ?? getLogoColorSuggestion(logoUri, selected.id === ownedTeamId ? "#1F8A5B" : "#1D5FA7") });
  };
  return (
        <View style={styles.pageGap}>
          <SectionTitle eyebrow="ROSTERS" title="學校與球員名單" action={<Button label="管理學校" onPress={onManageSchools} variant="secondary" compact />} />
          <Text style={styles.pageIntro}>先建立每間學校的固定名單，新增場次時即可快速導入，再於球場圖上排定守備位置。</Text>
          <View style={styles.teamSelectorHeader}>
            <Text style={styles.teamSelectorTitle}>{teamSelectorExpanded ? `隊伍清單 · ${orderedTeams.length} 隊` : "快速隊伍切換"}</Text>
            <Button label={teamSelectorExpanded ? "收合隊伍" : `展開 ${orderedTeams.length} 隊`} onPress={() => setTeamSelectorExpanded((expanded) => !expanded)} variant="secondary" compact />
          </View>
          {teamSelectorExpanded ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.schoolSelector}>{orderedSchools.map((school) => {
            const team = orderedTeams.find((item) => item.schoolId === school.id);
            return <Pressable key={school.id} onPress={() => team && onSelect(team.id)} style={[styles.schoolSelectorItem, selected?.schoolId === school.id && styles.schoolSelectorItemActive]}><Text style={[styles.schoolSelectorName, selected?.schoolId === school.id && styles.schoolSelectorNameActive]}>{school.name}</Text><Text style={styles.schoolSelectorMeta}>{school.players.length} 人</Text></Pressable>;
          })}</ScrollView> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamSelector}>{visibleTeams.map((team) => <Pressable key={team.id} onPress={() => onSelect(team.id)} style={[styles.teamSelectorItem, selected.id === team.id && styles.teamSelectorItemActive, { borderColor: team.customColor ?? BRAND.line }]}><View style={styles.teamSelectorNameRow}><TeamLogoName team={team} textStyle={[styles.teamSelectorName, selected.id === team.id && styles.teamSelectorNameActive]} logoSize={18} />{team.id === ownedTeamId ? <Text style={[styles.teamSelectorOwnedBadge, selected.id === team.id && styles.teamSelectorOwnedBadgeActive]}>所屬隊</Text> : null}</View><Text style={[styles.teamSelectorMeta, selected.id === team.id && styles.teamSelectorMetaActive]}>{team.school} · {team.players.length} 人</Text></Pressable>)}</ScrollView>
          <View style={[styles.teamBrandingCard, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}><View style={styles.teamBrandingHeader}><View><Text style={[styles.teamBrandingTitle, { color: interfacePalette.foreground }]}>隊徽與辨識配色</Text><Text style={[styles.teamBrandingHint, { color: interfacePalette.muted }]}>隊徽維持 512px 方形壓縮；工作台採辨識度較高、但不刺眼的低飽和隊色。</Text></View>{selected.logoUri ? <Image source={{ uri: selected.logoUri }} style={styles.teamBrandingPreview} resizeMode="cover" /> : <View style={[styles.teamBrandingPreview, { backgroundColor: teamSurfaceColor(selected, "home") }]}><Text style={styles.teamBrandingPreviewText}>{selected.name.slice(0, 1)}</Text></View>}</View><View style={styles.teamBrandingControls}><Button label={selected.logoUri ? "更換隊徽" : "上傳隊徽"} onPress={() => { void chooseTeamLogo(); }} compact />{selected.logoUri ? <Button label="移除隊徽" onPress={removeTeamLogo} variant="secondary" compact /> : null}<Button label="還原預設圖案" onPress={restoreDefaultIdentity} variant="secondary" compact /></View><View style={styles.teamPaletteHintRow}><Text style={[styles.teamPaletteHint, { color: interfacePalette.muted }]}>依隊徽建議色票</Text><Text style={[styles.teamPaletteContrast, { color: interfacePalette.primary }]}>{getContrastHint(teamAccentColor(selected, "home"))}</Text></View><View style={styles.teamColorRow}>{suggestedTeamColors.map((color, index) => <Pressable key={`logo-${color}`} accessibilityLabel={`套用隊徽建議色 ${color}`} onPress={() => applyTeamColor(color)} style={[styles.teamPaletteOption, { borderColor: color, backgroundColor: interfacePalette.background }, selected.customColor === color && styles.teamPaletteOptionActive]}><View style={[styles.teamColorSwatch, { backgroundColor: color }]} /><Text style={[styles.teamPaletteOptionText, { color: interfacePalette.foreground }]}>建議 {index + 1}</Text></Pressable>)}</View><Text style={[styles.teamBrandingHint, { color: interfacePalette.muted }]}>對比度提示以色票搭配白字計算；標示「建議深藍字」的色票，系統會在淡色背景上保留深色文字。</Text><View style={styles.teamColorRow}>{TEAM_COLOR_SWATCHES.map((color) => <Pressable key={color} accessibilityLabel={`套用 ${color} 配色`} onPress={() => applyTeamColor(color)} style={[styles.teamColorSwatch, { backgroundColor: color }, selected.customColor === color && styles.teamColorSwatchActive]} />)}<TextInput value={teamColorInput} onChangeText={setTeamColorInput} onEndEditing={() => { const color = normalizeTeamColor(teamColorInput); if (color) applyTeamColor(color); else setTeamColorInput(selected.customColor ?? ""); }} placeholder="#RRGGBB" placeholderTextColor={interfacePalette.muted} style={[styles.teamColorInput, { color: interfacePalette.foreground, borderColor: interfacePalette.border, backgroundColor: interfacePalette.background }]} autoCapitalize="characters" maxLength={7} returnKeyType="done" /><Pressable onPress={() => { setTeamColorInput(""); onUpdateTeam(selected.id, { customColor: undefined }); }} style={[styles.teamColorReset, { backgroundColor: interfacePalette.background }]}><Text style={[styles.teamColorResetText, { color: interfacePalette.muted }]}>僅重設色彩</Text></Pressable></View></View>
          <View style={[styles.rosterCard, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}>
            <View style={[styles.rosterHeader, { borderBottomColor: interfacePalette.border }]}><View><Text style={[styles.rosterTitle, { color: interfacePalette.foreground }]}>{selected.name}</Text><Text style={[styles.rosterMeta, { color: interfacePalette.muted }]}>{selected.school} · 點選背號選擇球員</Text></View><View style={styles.exportPresetRow}><Button label="＋ 新增球員" onPress={() => openPlayerEditor()} compact disabled={selected.players.length >= 25} /><Text style={[styles.rosterBadge, { backgroundColor: interfacePalette.background, color: interfacePalette.success }]}>{selected.players.length}/25 人</Text></View></View>
            <View style={styles.summaryModeToggle}><Text style={styles.smallMuted}>名單排序：</Text>{([{ id: "number", label: "背號" }, { id: "name", label: "姓名" }, { id: "position", label: "守備位置" }] as const).map((option) => <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: rosterSortMode === option.id }} accessibilityLabel={`依${option.label}排序（僅影響目前顯示）`} onPress={() => setRosterSortMode(option.id)} style={[styles.summaryModeButton, rosterSortMode === option.id && styles.summaryModeButtonActive]}><Text style={[styles.summaryModeButtonText, rosterSortMode === option.id && styles.summaryModeButtonTextActive]}>{option.label}</Text></Pressable>)}</View>
            <Text style={[styles.rosterMeta, { color: interfacePalette.muted }]}>排序僅影響此名單畫面，不會變更固定名單、既有正式棒次或歷史出賽順序。</Text>
            <View style={styles.rosterOptionGrid}>{rosterPlayers.map((player) => <Pressable key={player.id} accessibilityRole="button" accessibilityLabel={`選擇 ${player.number} 號 ${player.name} ${playerHandAbbr(player)}`} onPress={() => setSelectedPlayerId(player.id)} style={[styles.rosterOption, selectedPlayer?.id === player.id && styles.rosterOptionActive]}><Text style={[styles.rosterOptionNumber, selectedPlayer?.id === player.id && styles.rosterOptionTextActive]}>#{player.number}</Text><Text numberOfLines={1} style={[styles.rosterOptionName, selectedPlayer?.id === player.id && styles.rosterOptionTextActive]}>{player.name} {playerHandAbbr(player)}</Text><Text style={[styles.rosterOptionMeta, selectedPlayer?.id === player.id && styles.rosterOptionTextActive]}>{player.battingOrder ? `${player.battingOrder}棒` : player.position}</Text></Pressable>)}</View>
            {selectedPlayer ? <><View style={styles.rosterSelectedEditor}><View style={styles.numberBadge}><Text style={styles.numberBadgeText}>{selectedPlayer.number}</Text></View><TextInput value={selectedPlayer.name} onChangeText={(name) => onUpdatePlayer(selected.id, selectedPlayer.id, { name })} style={styles.playerNameInput} placeholder="球員姓名" placeholderTextColor={BRAND.muted} /><View accessible accessibilityLabel={`守備位置：${preferredPositionSummary(selectedPlayer)}`} style={styles.playerPreferredPositionsReadout}><Text numberOfLines={2} style={styles.playerPreferredPositionsText}>{preferredPositionSummary(selectedPlayer)}</Text></View><Text style={styles.batsBadge}>{playerHandAbbr(selectedPlayer)}</Text></View><View style={styles.summaryModeToggle}><Text style={styles.smallMuted}>投／打慣用手：</Text>{(["R", "L"] as const).map((hand) => <Pressable key={`throw-${hand}`} onPress={() => onUpdatePlayer(selected.id, selectedPlayer.id, { throwingHand: hand })} style={[styles.summaryModeButton, selectedPlayer.throwingHand === hand && styles.summaryModeButtonActive]}><Text style={[styles.summaryModeButtonText, selectedPlayer.throwingHand === hand && styles.summaryModeButtonTextActive]}>{hand}投</Text></Pressable>)}{(["R", "L"] as const).map((hand) => <Pressable key={`bat-${hand}`} onPress={() => onUpdatePlayer(selected.id, selectedPlayer.id, { battingHand: hand })} style={[styles.summaryModeButton, selectedPlayer.battingHand === hand && styles.summaryModeButtonActive]}><Text style={[styles.summaryModeButtonText, selectedPlayer.battingHand === hand && styles.summaryModeButtonTextActive]}>{hand}打</Text></Pressable>)}</View><View style={styles.exportPresetRow}><Button label="常用守備位置" onPress={() => openPlayerEditor(selectedPlayer)} compact variant="secondary" /><Button label="編輯完整資料" onPress={() => openPlayerEditor(selectedPlayer)} compact variant="secondary" /><Button label="刪除球員" onPress={requestDeleteSelectedPlayer} compact variant="secondary" /></View></> : null}
          </View>
          <View style={[styles.battingOrderCard, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}><View style={[styles.rosterHeader, { borderBottomColor: interfacePalette.border }]}><View><Text style={[styles.rosterTitle, { color: interfacePalette.foreground }]}>棒次排定</Text><Text style={[styles.rosterMeta, { color: interfacePalette.muted }]}>先選擇棒次，再點選球員；同一背號僅可佔一個棒次。</Text></View><Text style={[styles.rosterBadge, { backgroundColor: interfacePalette.background, color: interfacePalette.success }]}>1–9 棒</Text></View><View style={styles.battingOrderGrid}>{([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((order) => { const assigned = selected.players.find((player) => player.battingOrder === order); const isActive = activeBattingOrder === order; return <Pressable key={order} onPress={() => setActiveBattingOrder(order)} style={({ pressed }) => [styles.battingOrderSlot, { backgroundColor: isActive ? interfacePalette.primary : interfacePalette.background, borderColor: isActive ? interfacePalette.primary : interfacePalette.border }, pressed && { opacity: 0.82, transform: [{ scale: 0.97 }] }]}><Text style={[styles.battingOrderSlotLabel, { color: isActive ? readableTextOn(interfacePalette.primary) : interfacePalette.muted }]}>{order} 棒</Text><Text numberOfLines={1} style={[styles.battingOrderSlotValue, { color: isActive ? readableTextOn(interfacePalette.primary) : interfacePalette.foreground }]}>{assigned ? playerIdentityLabel(assigned) : "選擇球員"}</Text></Pressable>; })}</View><Text style={[styles.battingOrderInstruction, { color: interfacePalette.muted }]}>目前：第 {activeBattingOrder} 棒。已選：{activeBattingPlayer ? `#${activeBattingPlayer.number} ${activeBattingPlayer.name} ${playerHandAbbr(activeBattingPlayer)}` : "尚未指派"}；從下方球員選項選擇。</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.battingNumberOptions}>{selected.players.map((player) => { const isAssigned = player.battingOrder === activeBattingOrder; return <Pressable key={`order-${player.id}`} accessibilityRole="button" accessibilityState={{ selected: isAssigned }} accessibilityLabel={`第 ${activeBattingOrder} 棒選擇 ${player.number} 號 ${player.name} ${playerHandAbbr(player)}`} onPress={() => onAssignBattingOrder(selected.id, player.id, activeBattingOrder)} style={({ pressed }) => [styles.battingNumberOption, { backgroundColor: isAssigned ? interfacePalette.primary : interfacePalette.background, borderColor: isAssigned ? interfacePalette.primary : interfacePalette.border, shadowColor: isAssigned ? interfacePalette.primary : "transparent", shadowOpacity: isAssigned ? 0.28 : 0, shadowRadius: isAssigned ? 6 : 0, elevation: isAssigned ? 3 : 0 }, pressed && { opacity: 0.82, transform: [{ scale: 0.96 }] }]}><Text numberOfLines={1} style={[styles.battingNumberOptionText, { color: isAssigned ? readableTextOn(interfacePalette.primary) : interfacePalette.foreground }]}>{isAssigned ? "✓ " : ""}#{player.number} {player.name} {playerHandAbbr(player)}</Text></Pressable>; })}<Pressable onPress={() => { const assigned = selected.players.find((player) => player.battingOrder === activeBattingOrder); if (assigned) onAssignBattingOrder(selected.id, assigned.id, undefined); }} style={({ pressed }) => [styles.battingOrderClear, { backgroundColor: interfacePalette.background }, pressed && { opacity: 0.75 }]}><Text style={[styles.battingOrderClearText, { color: interfacePalette.error }]}>清除</Text></Pressable></ScrollView></View>
          <FieldCard team={selected} selectedPlayerId={selectedPlayerId} onAssign={(value) => { if (value.startsWith("select:")) setSelectedPlayerId(value.slice(7)); else if (selectedPlayerId) onUpdatePlayer(selected.id, selectedPlayerId, { position: value }); }} onClearDefense={clearAllDefensivePositions} onOpenPlayerInfo={(player, positionLabel) => setMarkerPlayerDetail({ player, positionLabel })} />
          <View style={[styles.positionGuide, { backgroundColor: interfacePalette.background, borderWidth: 1, borderColor: interfacePalette.border }]}><Text style={[styles.positionGuideTitle, { color: interfacePalette.foreground }]}>守備位置代號</Text><Text style={[styles.positionGuideText, { color: interfacePalette.muted }]}>1投手　2捕手　3一壘　4二壘　5三壘　6游擊　7左外　8中外　9右外</Text></View>
          <Modal visible={Boolean(markerPlayerDetail)} transparent animationType="fade" onRequestClose={() => setMarkerPlayerDetail(null)}>
            <Pressable style={styles.fieldPlayerInfoOverlay} onPress={() => setMarkerPlayerDetail(null)}>
              <Pressable style={styles.fieldPlayerInfoModal} onPress={(event) => event.stopPropagation()}>
                <View style={styles.fieldPlayerInfoHeader}><View><Text style={styles.fieldPlayerInfoEyebrow}>守備球員資訊</Text><Text style={styles.fieldPlayerInfoName}>{playerIdentityLabel(markerPlayerDetail?.player, "#— 未指派")}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="關閉球員資訊" onPress={() => setMarkerPlayerDetail(null)} style={styles.fieldPlayerInfoClose}><Text style={styles.fieldPlayerInfoCloseText}>×</Text></Pressable></View>
                <View style={styles.fieldPlayerInfoGrid}><View style={styles.fieldPlayerInfoItem}><Text style={styles.fieldPlayerInfoLabel}>守備位置</Text><Text style={styles.fieldPlayerInfoValue}>{markerPlayerDetail?.positionLabel ?? "—"}</Text></View><View style={styles.fieldPlayerInfoItem}><Text style={styles.fieldPlayerInfoLabel}>投／打縮寫</Text><Text style={styles.fieldPlayerInfoValue}>{markerPlayerDetail?.player ? playerHandAbbr(markerPlayerDetail.player) : "??"}</Text></View><View style={styles.fieldPlayerInfoItem}><Text style={styles.fieldPlayerInfoLabel}>棒次</Text><Text style={styles.fieldPlayerInfoValue}>{markerPlayerDetail?.player.battingOrder ? `${markerPlayerDetail.player.battingOrder} 棒` : "尚未排定"}</Text></View></View>
                <View style={styles.fieldPlayerInfoActions}><Button label="選為目前球員" onPress={() => { if (markerPlayerDetail) setSelectedPlayerId(markerPlayerDetail.player.id); setMarkerPlayerDetail(null); }} compact /><Button label="關閉" onPress={() => setMarkerPlayerDetail(null)} variant="secondary" compact /></View>
              </Pressable>
            </Pressable>
          </Modal>
          <Modal visible={Boolean(playerEditor)} transparent animationType="slide" onRequestClose={() => setPlayerEditor(null)}>
            <View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>{playerEditor?.mode === "add" ? "新增球員" : "修改球員資訊"}</Text><Text style={styles.modalSubtitle}>姓名、背號、投打慣用手與最多四個慣用守位。</Text></View><Pressable accessibilityRole="button" accessibilityLabel="關閉球員編輯" onPress={() => setPlayerEditor(null)}><Text style={styles.modalClose}>關閉</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}><View style={styles.exportInputRow}><View style={{ flex: 1 }}><Text style={styles.inputLabel}>球員姓名</Text><TextInput value={playerEditor?.name ?? ""} onChangeText={(name) => setPlayerEditor((current) => current ? { ...current, name } : current)} placeholder="例如：王小明" placeholderTextColor={BRAND.muted} maxLength={18} returnKeyType="done" style={styles.formInput} /></View><View style={{ width: 88 }}><Text style={styles.inputLabel}>背號</Text><TextInput value={playerEditor?.number ?? ""} onChangeText={(number) => setPlayerEditor((current) => current ? { ...current, number: number.replace(/[^0-9]/g, "").slice(0, 2) } : current)} placeholder="1–99" placeholderTextColor={BRAND.muted} keyboardType="number-pad" maxLength={2} style={styles.formInput} /></View></View><Text style={styles.inputLabel}>投／打慣用手</Text><View style={styles.modalChoiceRow}>{(["R", "L"] as const).map((hand) => <Pressable key={`editor-throw-${hand}`} onPress={() => setPlayerEditor((current) => current ? { ...current, throwingHand: hand } : current)} style={[styles.modalChoice, playerEditor?.throwingHand === hand && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, playerEditor?.throwingHand === hand && styles.modalChoiceTextActive]}>{hand === "R" ? "右投" : "左投"}</Text></Pressable>)}{(["R", "L"] as const).map((hand) => <Pressable key={`editor-bat-${hand}`} onPress={() => setPlayerEditor((current) => current ? { ...current, battingHand: hand } : current)} style={[styles.modalChoice, playerEditor?.battingHand === hand && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, playerEditor?.battingHand === hand && styles.modalChoiceTextActive]}>{hand === "R" ? "右打" : "左打"}</Text></Pressable>)}</View><Text style={styles.inputLabel}>慣用守備位置（{playerEditor?.preferredPositions.length ?? 0}/4）</Text>{playerEditor ? <PreferredPositionFieldPicker selectedPositions={playerEditor.preferredPositions} onToggle={toggleEditorPosition} /> : null}<View style={styles.defensivePositionRow}>{FIELD_POSITIONS.map((position) => <Pressable key={`editor-pos-${position.number}`} onPress={() => toggleEditorPosition(position.number)} style={[styles.defensivePositionChip, playerEditor?.preferredPositions.includes(position.number) && styles.defensivePositionChipActive]}><Text style={[styles.defensivePositionNumber, playerEditor?.preferredPositions.includes(position.number) && styles.defensivePositionTextActive]}>{position.number}</Text><Text style={[styles.defensivePositionLabel, playerEditor?.preferredPositions.includes(position.number) && styles.defensivePositionTextActive]}>{position.label}</Text></Pressable>)}</View><Text style={styles.substitutionContext}>未選慣用守位時，球員會標示為「後備」，不計入先發守備配置。</Text><Button label={playerEditor?.mode === "add" ? "新增至固定名單" : "儲存球員資料"} onPress={savePlayerEditor} /></ScrollView></View></View>
          </Modal>
        </View>
  );
}

function StatsView({ game, games, away, home, primaryTeam, primaryTeamGames, primaryPerformance, primarySide, tab, onTab, summary, onSetPrimaryTeam, onOpenExportRange }: { game: Game; games: Game[]; away: Team; home: Team; primaryTeam: Team; primaryTeamGames: Game[]; primaryPerformance: ReturnType<typeof getTeamPerformanceSummary> | null; primarySide: TeamSide | null; tab: StatsTab; onTab: (tab: StatsTab) => void; summary: ReturnType<typeof getGameSummary> | null; onSetPrimaryTeam: (teamId: string) => void; onOpenExportRange: () => void }) {
  const [playerScope, setPlayerScope] = useState<PlayerStatScope>("registered");
  const primaryBatting = getBattingStats(game, primaryTeam, playerScope);
  const [periodPreset, setPeriodPreset] = useState<"all" | "7d" | "30d" | "90d" | "year" | "custom">("all");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const now = new Date();
  const presetStart = periodPreset === "7d" ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6) : periodPreset === "30d" ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29) : periodPreset === "90d" ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89) : periodPreset === "year" ? new Date(now.getFullYear(), 0, 1) : undefined;
  const filteredPrimaryGames = primaryTeamGames.filter((item) => {
    const itemDate = new Date(`${item.date}T00:00:00`);
    if (Number.isNaN(itemDate.getTime())) return true;
    if (periodPreset === "custom") {
      const start = periodStart ? new Date(`${periodStart}T00:00:00`) : undefined;
      const end = periodEnd ? new Date(`${periodEnd}T23:59:59`) : undefined;
      return (!start || itemDate >= start) && (!end || itemDate <= end);
    }
    return !presetStart || itemDate >= presetStart;
  });
  const seasonPrimaryBatting = getSeasonBattingStats(filteredPrimaryGames, primaryTeam, playerScope);
  const periodLabels: Record<typeof periodPreset, string> = { all: "全部期間", "7d": "最近 7 天", "30d": "最近 30 天", "90d": "最近 90 天", year: "本年度", custom: "自訂日期" };
  const opponent = primarySide === "home" ? away : home;
  const primaryRuns = primarySide === "home" ? summary?.homeRuns ?? 0 : primarySide === "away" ? summary?.awayRuns ?? 0 : 0;
  const primarySideLabel = primarySide === "home" ? "主場(先守)" : primarySide === "away" ? "客場(先攻)" : "未參與本場";
  const [pitchFilter, setPitchFilter] = useState<PitchFilter>("all");
  return (
    <View style={styles.pageGap}><SectionTitle eyebrow="TEAM GAME DESK" title="單場詳情工作台" action={<Text style={styles.smallMuted}>{game.date}</Text>} /><View style={styles.statsOwnerCard}><View><Text style={styles.statsOwnerEyebrow}>統計預覽主體</Text><Text style={styles.statsOwnerTitle}>{primaryTeam.name}</Text><Text style={styles.statsOwnerMeta}>統計以所屬球隊為主；本場身分：{primarySideLabel}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsOwnerChoices}>{[away, home].filter((team, index, list) => list.findIndex((item) => item.id === team.id) === index).map((team) => <Pressable key={team.id} onPress={() => onSetPrimaryTeam(team.id)} style={[styles.statsOwnerChoice, team.id === primaryTeam.id && styles.statsOwnerChoiceActive]}><Text style={[styles.statsOwnerChoiceText, team.id === primaryTeam.id && styles.statsOwnerChoiceTextActive]}>{team.name}</Text><Text style={styles.statsOwnerChoiceMeta}>{team.id === game.homeTeamId ? "主場(先守)" : "客場(先攻)"}</Text></Pressable>)}</ScrollView></View><View style={styles.statsScopeCard}><Text style={styles.statsScopeLabel}>統計範圍</Text><View style={styles.statsScopeChoices}><Pressable onPress={() => setPlayerScope("registered")} style={[styles.statsScopeChoice, playerScope === "registered" && styles.statsScopeChoiceActive]}><Text style={[styles.statsScopeChoiceText, playerScope === "registered" && styles.statsScopeChoiceTextActive]}>本場登錄</Text></Pressable><Pressable onPress={() => setPlayerScope("all")} style={[styles.statsScopeChoice, playerScope === "all" && styles.statsScopeChoiceActive]}><Text style={[styles.statsScopeChoiceText, playerScope === "all" && styles.statsScopeChoiceTextActive]}>全 25 人</Text></Pressable></View><Text style={styles.statsScopeHint}>{playerScope === "registered" ? "僅顯示本場已登錄並可上場的球員。" : "顯示固定 25 人名單，含尚未出賽的球員。"}</Text></View><View style={styles.periodCard}><Text style={styles.periodTitle}>週期時間統計</Text><Text style={styles.periodHint}>累計不限場次；選擇期間後只計入該日期範圍內所屬球隊的賽事。</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodChoices}>{([ ["all", "全部"], ["7d", "近 7 天"], ["30d", "近 30 天"], ["90d", "近 90 天"], ["year", "本年度"], ["custom", "自訂" ] ] as Array<[typeof periodPreset, string]>).map(([key, label]) => <Pressable key={key} onPress={() => setPeriodPreset(key)} style={[styles.periodChoice, periodPreset === key && styles.periodChoiceActive]}><Text style={[styles.periodChoiceText, periodPreset === key && styles.periodChoiceTextActive]}>{label}</Text></Pressable>)}</ScrollView>{periodPreset === "custom" ? <View style={styles.periodDateRow}><TextInput value={periodStart} onChangeText={setPeriodStart} placeholder="開始 YYYY-MM-DD" placeholderTextColor={BRAND.muted} style={styles.periodDateInput} /><Text style={styles.periodDateDivider}>至</Text><TextInput value={periodEnd} onChangeText={setPeriodEnd} placeholder="結束 YYYY-MM-DD" placeholderTextColor={BRAND.muted} style={styles.periodDateInput} /></View> : null}<Text style={styles.periodResult}>目前：{periodLabels[periodPreset]}，共 {filteredPrimaryGames.length} 場</Text></View><View style={styles.summaryStrip}><StatChip label={`${primaryTeam.name} 比分`} value={`${primaryRuns} : ${primarySide ? (primarySide === "home" ? summary?.awayRuns ?? 0 : summary?.homeRuns ?? 0) : 0}`} accent={BRAND.navy} /><StatChip label="本場安打" value={primaryBatting.reduce((sum, row) => sum + row.h, 0)} accent={BRAND.green} /><StatChip label="本場四壞" value={primaryBatting.reduce((sum, row) => sum + row.bb, 0)} accent={BRAND.blue} /><StatChip label="本場三振" value={primaryPerformance?.strikeouts ?? 0} accent={BRAND.red} /><StatChip label="賽事失誤" value={summary?.errors ?? 0} accent={BRAND.yellow} /></View><View style={styles.statsTabs}>{([ ["batting", "打擊統計"], ["pitching", "投手統計"], ["preview", "完整預覽"] ] as [StatsTab, string][]).map(([key, label]) => <Pressable key={key} onPress={() => onTab(key)} style={[styles.statsTab, tab === key && styles.statsTabActive]}><Text style={[styles.statsTabText, tab === key && styles.statsTabTextActive]}>{label}</Text></Pressable>)}</View>{tab === "batting" ? <View style={styles.statsSection}><View style={styles.teamStatSummary}><Text style={styles.tableTitle}>球隊整體表現｜早稻田紀錄法</Text><View style={styles.teamStatSummaryRow}><Text style={styles.teamStatSummaryValue}>R {primaryPerformance?.runs ?? 0}</Text><Text style={styles.teamStatSummaryValue}>H {primaryPerformance?.hits ?? 0}</Text><Text style={styles.teamStatSummaryValue}>BB {primaryPerformance?.walks ?? 0}</Text><Text style={styles.teamStatSummaryValue}>SB {primaryPerformance?.stolenBases ?? 0}</Text><Text style={styles.teamStatSummaryValue}>E {primaryPerformance?.errors ?? 0}</Text></View><Text style={styles.seasonHint}>目前統計主隊：{primaryTeam.name}；對手：{opponent.name}。個人逐球紀錄仍依主／客場保留於完整預覽。</Text></View><StatTable title={`單場個人｜${playerScope === "registered" ? "登錄名單" : "全 25 人"}｜${primarySideLabel}｜${primaryTeam.name}`} rows={primaryBatting} /><View style={styles.seasonCard}><Text style={styles.seasonTitle}>週期累計｜{playerScope === "registered" ? "曾登錄球員" : "全 25 人"}｜{primaryTeam.name}（{periodLabels[periodPreset]}，共 {filteredPrimaryGames.length} 場）</Text><Text style={styles.seasonHint}>不限場次，僅累計使用者所屬球隊在所選日期週期內參與的賽事。</Text><StatTable title={`週期累計個人｜${primaryTeam.name}`} rows={seasonPrimaryBatting} /></View></View> : null}{tab === "pitching" ? <View style={styles.statsSection}><PitchingTable game={game} team={primaryTeam} title={`本隊投手｜${primarySideLabel}｜${primaryTeam.name}`} /><PitchingTable game={game} team={opponent} title={`對手投手｜${opponent.name}`} /><HeatmapAnalytics game={game} players={[...away.players, ...home.players]} filter={pitchFilter} onFilter={setPitchFilter} /></View> : null}{tab === "preview" ? <FullPreview game={game} away={away} home={home} onOpenExportRange={onOpenExportRange} /> : null}</View>
  );
}

function StatsViewV2({ game, games: _games, away, home, primaryTeam, primaryTeamGames, primarySide, tab, onTab, onSetPrimaryTeam, onUpdatePlayer, onOpenExportRange }: { game: Game; games: Game[]; away: Team; home: Team; primaryTeam: Team; primaryTeamGames: Game[]; primarySide: TeamSide | null; tab: StatsTab; onTab: (tab: StatsTab) => void; onSetPrimaryTeam: (teamId: string) => void; onUpdatePlayer: (teamId: string, playerId: string, patch: Partial<Player>) => void; onOpenExportRange: () => void }) {
  const [playerScope, setPlayerScope] = useState<PlayerStatScope>("registered");
  const [statsMode, setStatsMode] = useState<StatsMode>("game");
  const [selectedGameId, setSelectedGameId] = useState(game.id);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [monthStart, setMonthStart] = useState("");
  const [monthEnd, setMonthEnd] = useState("");
  const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>([]);
  const [pitchFilter, setPitchFilter] = useState<PitchFilter>("all");
  const [selectedPlayerForStats, setSelectedPlayerForStats] = useState<Player | null>(null);

  useEffect(() => {
    if (!primaryTeamGames.some((item) => item.id === selectedGameId)) setSelectedGameId(primaryTeamGames[0]?.id ?? game.id);
  }, [game.id, primaryTeamGames, selectedGameId]);

  const competitionNames = Array.from(new Set(primaryTeamGames.map((item) => item.competition?.trim()).filter((value): value is string => Boolean(value)))).sort();
  const selectedGames = filterGamesForStatistics(primaryTeamGames, {
    mode: statsMode,
    gameId: selectedGameId,
    start: statsMode === "date" ? dateStart : statsMode === "month" ? monthStart : undefined,
    end: statsMode === "date" ? dateEnd : statsMode === "month" ? monthEnd : undefined,
    competitions: selectedCompetitions,
  });
  const aggregateGame: Game = {
    ...game,
    events: selectedGames.flatMap((item) => item.events),
    specialEvents: selectedGames.flatMap((item) => item.specialEvents ?? []),
    awayRegisteredPlayerIds: primaryTeam.id === game.awayTeamId ? Array.from(new Set(selectedGames.flatMap((item) => item.awayRegisteredPlayerIds ?? []))) : game.awayRegisteredPlayerIds,
    homeRegisteredPlayerIds: primaryTeam.id === game.homeTeamId ? Array.from(new Set(selectedGames.flatMap((item) => item.homeRegisteredPlayerIds ?? []))) : game.homeRegisteredPlayerIds,
  };
  const battingRows = selectedGames.length ? getSeasonBattingStats(selectedGames, primaryTeam, playerScope) : getBattingStats({ ...game, events: [] }, primaryTeam, playerScope);
  const performance = getTeamPerformanceSummary(selectedGames, primaryTeam);
  const selectedGame = primaryTeamGames.find((item) => item.id === selectedGameId) ?? game;
  const showImportedCupSummary = primaryTeam.id === FUXING_TEAM.id && statsMode === "cup" && selectedCompetitions.includes(FUXING_COMPETITION);
  const modeLabels: Record<StatsMode, string> = { game: "單場統計", date: "日到日統計", month: "月到月統計", cup: "盃賽統計" };
  const modeHints: Record<StatsMode, string> = {
    game: "選擇一場比賽，查看該場個人及團隊數據。",
    date: "輸入開始、結束日期，跨不限場次彙整。",
    month: "輸入開始、結束月份，依完整月份區間累計。",
    cup: "可同時選擇一個或多個盃賽／聯賽分類。",
  };
  const toggleCompetition = (competition: string) => setSelectedCompetitions((current) => current.includes(competition) ? current.filter((item) => item !== competition) : [...current, competition]);
  const updateSelectedPlayer = (patch: Partial<Player>) => {
    if (!selectedPlayerForStats) return;
    onUpdatePlayer(primaryTeam.id, selectedPlayerForStats.id, patch);
    setSelectedPlayerForStats((current) => current ? { ...current, ...patch } : current);
  };

  return <>
  <View style={styles.pageGap}>
    <SectionTitle eyebrow="STATISTICS WORKBENCH" title="統計預覽" action={<Text style={styles.smallMuted}>{modeLabels[statsMode]}</Text>} />
    <View style={styles.statsOwnerCard}><View><Text style={styles.statsOwnerEyebrow}>統計預覽主體</Text><TeamLogoName team={primaryTeam} textStyle={styles.statsOwnerTitle} logoSize={20} /><Text style={styles.statsOwnerMeta}>統計只納入所屬球隊賽事；本場身分：{primarySide === "home" ? "主場(先守)" : primarySide === "away" ? "客場(先攻)" : "未參與"}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsOwnerChoices}>{[away, home].filter((team, index, list) => list.findIndex((item) => item.id === team.id) === index).map((team) => <Pressable key={team.id} onPress={() => onSetPrimaryTeam(team.id)} style={[styles.statsOwnerChoice, team.id === primaryTeam.id && styles.statsOwnerChoiceActive, { backgroundColor: teamSurfaceColor(team, team.id === game.homeTeamId ? "home" : "away") }]}><TeamLogoName team={team} textStyle={[styles.statsOwnerChoiceText, team.id === primaryTeam.id && styles.statsOwnerChoiceTextActive]} logoSize={16} /><Text style={styles.statsOwnerChoiceMeta}>{team.id === game.homeTeamId ? "主場(先守)" : "客場(先攻)"}</Text></Pressable>)}</ScrollView></View>
    <View style={styles.statsLandscapeControls}>
      <View style={styles.statsModePanel}><Text style={styles.statsControlLabel}>統計方式</Text><View style={styles.statsModeGrid}>{([ ["game", "單場"], ["date", "日到日"], ["month", "月到月"], ["cup", "盃賽"] ] as Array<[StatsMode, string]>).map(([key, label]) => <Pressable key={key} onPress={() => setStatsMode(key)} style={[styles.statsModeChoice, statsMode === key && styles.statsModeChoiceActive]}><Text style={[styles.statsModeChoiceText, statsMode === key && styles.statsModeChoiceTextActive]}>{label}</Text></Pressable>)}</View><Text style={styles.statsModeHint}>{modeHints[statsMode]}</Text></View>
      <View style={styles.statsParameterPanel}><Text style={styles.statsControlLabel}>{modeLabels[statsMode]}條件</Text>{statsMode === "game" ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsCompactChoices}>{primaryTeamGames.map((item) => <Pressable key={item.id} onPress={() => setSelectedGameId(item.id)} style={[styles.statsCompactChoice, item.id === selectedGameId && styles.statsCompactChoiceActive]}><Text numberOfLines={1} style={[styles.statsCompactChoiceText, item.id === selectedGameId && styles.statsCompactChoiceTextActive]}>{item.date.slice(0, 10)} · {item.name}</Text></Pressable>)}</ScrollView> : null}{statsMode === "date" ? <View style={styles.statsInputRow}><TextInput value={dateStart} onChangeText={setDateStart} placeholder="開始 YYYY-MM-DD" placeholderTextColor={BRAND.muted} style={styles.statsRangeInput} {...({ type: "date" } as any)} /><Text style={styles.statsRangeDivider}>至</Text><TextInput value={dateEnd} onChangeText={setDateEnd} placeholder="結束 YYYY-MM-DD" placeholderTextColor={BRAND.muted} style={styles.statsRangeInput} {...({ type: "date" } as any)} /></View> : null}{statsMode === "month" ? <View style={styles.statsInputRow}><TextInput value={monthStart} onChangeText={setMonthStart} placeholder="開始 YYYY-MM" placeholderTextColor={BRAND.muted} style={styles.statsRangeInput} {...({ type: "month" } as any)} /><Text style={styles.statsRangeDivider}>至</Text><TextInput value={monthEnd} onChangeText={setMonthEnd} placeholder="結束 YYYY-MM" placeholderTextColor={BRAND.muted} style={styles.statsRangeInput} {...({ type: "month" } as any)} /></View> : null}{statsMode === "cup" ? competitionNames.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsCompactChoices}>{competitionNames.map((competition) => <Pressable key={competition} onPress={() => toggleCompetition(competition)} style={[styles.statsCompactChoice, selectedCompetitions.includes(competition) && styles.statsCompactChoiceActive]}><Text style={[styles.statsCompactChoiceText, selectedCompetitions.includes(competition) && styles.statsCompactChoiceTextActive]}>{selectedCompetitions.includes(competition) ? "✓ " : ""}{competition}</Text></Pressable>)}</ScrollView> : <Text style={styles.statsEmptyHint}>尚無盃賽分類；可在新增或編輯賽事時填入。</Text> : null}<Text style={styles.statsResultBadge}>已納入 {selectedGames.length} 場 · {statsMode === "cup" && selectedCompetitions.length === 0 ? "請至少選擇一個盃賽" : modeLabels[statsMode]}</Text></View>
      <View style={styles.statsScopePanel}><Text style={styles.statsControlLabel}>球員範圍</Text><View style={styles.statsScopeChoices}><Pressable onPress={() => setPlayerScope("registered")} style={[styles.statsScopeChoice, playerScope === "registered" && styles.statsScopeChoiceActive]}><Text style={[styles.statsScopeChoiceText, playerScope === "registered" && styles.statsScopeChoiceTextActive]}>登錄球員</Text></Pressable><Pressable onPress={() => setPlayerScope("all")} style={[styles.statsScopeChoice, playerScope === "all" && styles.statsScopeChoiceActive]}><Text style={[styles.statsScopeChoiceText, playerScope === "all" && styles.statsScopeChoiceTextActive]}>全 25 人</Text></Pressable></View><Text style={styles.statsScopeHint}>{playerScope === "registered" ? "納入選定場次中曾登錄的球員。" : "含尚未出賽的固定名單球員。"}</Text></View>
    </View>
    <View style={styles.summaryStrip}><StatChip label="納入場次" value={selectedGames.length} accent={BRAND.navy} /><StatChip label="累計得分" value={performance.runs} accent={BRAND.green} /><StatChip label="累計安打" value={performance.hits} accent={BRAND.blue} /><StatChip label="累計四壞" value={performance.walks} accent={BRAND.red} /><StatChip label="累計三振" value={performance.strikeouts} accent={BRAND.yellow} /></View>
    {showImportedCupSummary ? <FuxingImportedCupSummary team={primaryTeam} /> : null}
    <View style={styles.statsTabs}>{([ ["batting", "打擊統計"], ["pitching", "投手統計"], ["preview", "完整預覽"] ] as [StatsTab, string][]).map(([key, label]) => <Pressable key={key} onPress={() => onTab(key)} style={[styles.statsTab, tab === key && styles.statsTabActive]}><Text style={[styles.statsTabText, tab === key && styles.statsTabTextActive]}>{label}</Text></Pressable>)}</View>
    {tab === "batting" ? <View style={styles.statsSection}><View style={styles.teamStatSummary}><Text style={styles.tableTitle}>{modeLabels[statsMode]}｜{primaryTeam.name}</Text><View style={styles.teamStatSummaryRow}><Text style={styles.teamStatSummaryValue}>R {performance.runs}</Text><Text style={styles.teamStatSummaryValue}>H {performance.hits}</Text><Text style={styles.teamStatSummaryValue}>BB {performance.walks}</Text><Text style={styles.teamStatSummaryValue}>SB {performance.stolenBases}</Text><Text style={styles.teamStatSummaryValue}>E {performance.errors}</Text></View><Text style={styles.seasonHint}>目前已選擇 {selectedGames.length} 場，統計數據會隨條件即時更新。</Text></View><StatTable title={`${modeLabels[statsMode]}個人｜${playerScope === "registered" ? "登錄名單" : "全 25 人"}｜${primaryTeam.name}`} rows={battingRows} onOpenPlayer={setSelectedPlayerForStats} /></View> : null}
    {tab === "pitching" ? <View style={styles.statsSection}><PitchingTable game={aggregateGame} team={primaryTeam} title={`${modeLabels[statsMode]}投手｜${primaryTeam.name}`} onOpenPlayer={setSelectedPlayerForStats} /><HeatmapAnalytics game={aggregateGame} players={[...away.players, ...home.players]} filter={pitchFilter} onFilter={setPitchFilter} /></View> : null}
    {tab === "preview" ? <View style={styles.statsSection}><Text style={styles.statsPreviewHint}>完整預覽固定顯示所選「單場」紀錄表；請切換單場統計後選擇要檢視的比賽。</Text><FullPreview game={selectedGame} away={away} home={home} onOpenExportRange={onOpenExportRange} /></View> : null}
  </View>
  <PlayerStatsModal player={selectedPlayerForStats} game={aggregateGame} onClose={() => setSelectedPlayerForStats(null)} onUpdatePlayer={updateSelectedPlayer} />
  </>;
}

function FuxingImportedCupSummary({ team }: { team: Team }) {
  const playerById = new Map(team.players.map((player) => [player.id, player]));
  return <View style={styles.importedSummaryCard}>
    <View style={styles.importedSummaryHeader}>
      <View><Text style={styles.importedSummaryEyebrow}>ATTACHMENT-VERIFIED TOTALS</Text><Text style={styles.importedSummaryTitle}>復興少棒67｜盃賽累計摘要</Text></View>
      <Text style={styles.importedSummaryBadge}>附件匯入</Text>
    </View>
    <Text style={styles.importedSummaryHint}>來源：2026.07_115年社區(團)交流賽_個人成績統計.pdf。此區為原始累計表；四壞與觸身在來源中合併，未反推為逐球或單場打席。</Text>
    <View style={styles.importedSummaryStrip}>
      <StatChip label="出賽" value={FUXING_CUP_TEAM_BATTING_SUMMARY.games} accent={BRAND.navy} />
      <StatChip label="安打" value={FUXING_CUP_TEAM_BATTING_SUMMARY.h} accent={BRAND.green} />
      <StatChip label="BB／HBP" value={FUXING_CUP_TEAM_BATTING_SUMMARY.reachesByWalkOrHitByPitch} accent={BRAND.blue} />
      <StatChip label="OPS" value={formatRate(FUXING_CUP_TEAM_BATTING_SUMMARY.ops)} accent={BRAND.red} />
    </View>
    <View style={styles.importedSummaryColumns}>
      <View style={styles.importedSummaryColumn}>
        <Text style={styles.importedSummaryColumnTitle}>打擊累計</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}><View><View style={styles.importedTableRow}><Text style={[styles.importedTableCell, styles.importedPlayerCell]}>球員</Text><Text style={styles.importedTableCell}>AB</Text><Text style={styles.importedTableCell}>H</Text><Text style={styles.importedTableCell}>BB/HBP</Text><Text style={styles.importedTableCell}>SB</Text><Text style={styles.importedTableCell}>AVG</Text><Text style={styles.importedTableCell}>OPS</Text></View>{FUXING_CUP_BATTING_SUMMARY.map((row) => { const player = playerById.get(row.playerId); return <View key={row.playerId} style={styles.importedTableRow}><Text style={[styles.importedTableCell, styles.importedPlayerCell]}>{playerIdentityLabel(player, row.playerId)}</Text><Text style={styles.importedTableCell}>{row.ab}</Text><Text style={styles.importedTableCell}>{row.h}</Text><Text style={styles.importedTableCell}>{row.reachesByWalkOrHitByPitch}</Text><Text style={styles.importedTableCell}>{row.sb}</Text><Text style={styles.importedTableCell}>{formatAvg(row.avg)}</Text><Text style={styles.importedTableCell}>{formatRate(row.ops)}</Text></View>; })}</View></ScrollView>
      </View>
      <View style={styles.importedSummaryColumn}>
        <Text style={styles.importedSummaryColumnTitle}>投手累計</Text>
        {FUXING_CUP_PITCHING_SUMMARY.map((row) => { const player = playerById.get(row.playerId); return <View key={row.playerId} style={styles.importedPitcherRow}><Text style={styles.importedPitcherName}>{playerIdentityLabel(player, row.playerId)}</Text><View style={styles.importedPitcherStats}><Text style={styles.importedPitcherStat}>IP {row.ip}</Text><Text style={styles.importedPitcherStat}>H {row.h}</Text><Text style={styles.importedPitcherStat}>K {row.so}</Text><Text style={styles.importedPitcherStat}>BB/HBP {row.walksOrHitByPitch}</Text></View></View>; })}
        <Text style={styles.importedPitcherNote}>來源未可靠區分責失分，故不顯示 ERA。</Text>
      </View>
    </View>
  </View>;
}

function StatTable({ title, rows, onOpenPlayer }: { title: string; rows: ReturnType<typeof getBattingStats>; onOpenPlayer?: (player: Player) => void }) {
  return <View style={styles.tableCard}><Text style={styles.tableTitle}>{title}</Text><StatGlossary terms={[ ["AB", "打數：不含四壞、觸身與犧牲打的正式打擊機會"], ["H／HR", "安打／全壘打：所有上壘安打與其中的全壘打"], ["BB", "四壞球：投手保送"], ["AVG", "打擊率＝安打 ÷ 打數"], ["SLG", "長打率＝壘打數 ÷ 打數"], ["OBP", "上壘率＝上壘次數 ÷ 上壘機會"], ["OPS", "攻擊指數＝上壘率＋長打率"] ]} /><ScrollView horizontal showsHorizontalScrollIndicator={false}><View><View style={styles.tableRow}><Text style={[styles.tableCell, styles.playerCell]}>球員</Text><Text style={styles.tableCell}>AB</Text><Text style={styles.tableCell}>H</Text><Text style={styles.tableCell}>HR</Text><Text style={styles.tableCell}>BB</Text><Text style={styles.tableCell}>AVG</Text><Text style={styles.tableCell}>SLG</Text><Text style={styles.tableCell}>OBP</Text><Text style={styles.tableCell}>OPS</Text></View>{rows.map((row) => <View key={row.player.id} style={styles.tableRow}><Pressable accessibilityRole="button" accessibilityLabel={`開啟 ${row.player.name} 個人統計`} onPress={() => onOpenPlayer?.(row.player)} style={styles.playerNameButton}><Text style={[styles.tableCell, styles.playerCell, styles.tablePlayer, styles.playerNameButtonText]}>{playerIdentityLabel(row.player)}</Text></Pressable><Text style={styles.tableCell}>{row.ab}</Text><Text style={styles.tableCell}>{row.h}</Text><Text style={styles.tableCell}>{row.hr}</Text><Text style={styles.tableCell}>{row.bb}</Text><Text style={styles.tableCell}>{formatAvg(row.avg)}</Text><Text style={styles.tableCell}>{formatRate(row.slg)}</Text><Text style={styles.tableCell}>{formatRate(row.obp)}</Text><Text style={[styles.tableCell, styles.opsCell]}>{formatRate(row.ops)}</Text></View>)}</View></ScrollView></View>;
}

function PitchingTable({ game, team, title, onOpenPlayer }: { game: Game; team: Team; title: string; onOpenPlayer?: (player: Player) => void }) {
  const rows = getPitchingStats(game, team);
  return <View style={styles.tableCard}><Text style={styles.tableTitle}>{title}</Text><StatGlossary terms={[ ["IP", "投球局數：以出局數換算，0.1 代表一個出局數"], ["P", "投球數：該投手完成打席所投的全部球數"], ["H", "被安打：對手擊出安打次數"], ["R／ER", "失分／責失分：本版以逐球資料登錄的失分計算"], ["BB", "保送：四壞球保送人次"], ["K", "奪三振：三振打者人次"], ["ERA", "防禦率＝責失分 × 9 ÷ 投球局數"] ]} />{rows.length ? rows.map((row) => <View key={row.player.id} style={styles.pitcherLine}><Pressable accessibilityRole="button" accessibilityLabel={`開啟 ${row.player.name} 個人統計`} onPress={() => onOpenPlayer?.(row.player)} style={styles.pitcherNameButton}><Text style={[styles.tablePlayer, styles.playerNameButtonText]}>{playerIdentityLabel(row.player)}</Text><Text style={styles.mutedText}>IP {row.ip} · P {row.pitches} · ERA {formatRate(row.era)}</Text></Pressable><View style={styles.pitcherStats}><Text style={styles.pitcherStatText}>H {row.h}</Text><Text style={styles.pitcherStatText}>R {row.r}</Text><Text style={styles.pitcherStatText}>ER {row.er}</Text><Text style={styles.pitcherStatText}>BB {row.bb}</Text><Text style={styles.pitcherStatText}>K {row.so}</Text></View></View>) : <Text style={styles.smallMuted}>本隊尚無投手逐球紀錄。</Text>}</View>;
}

function StatGlossary({ terms }: { terms: Array<[string, string]> }) {
  return <View style={styles.statGlossary}>{terms.map(([term, description]) => <View key={term} style={styles.statGlossaryItem}><Text style={styles.statGlossaryTerm}>{term}</Text><Text style={styles.statGlossaryDescription}>{description}</Text></View>)}</View>;
}

function HeatmapAnalytics({ game, players, filter, onFilter }: { game: Game; players: Player[]; filter: PitchFilter; onFilter: (filter: PitchFilter) => void }) {
  const [pitcherId, setPitcherId] = useState<string | undefined>();
  const [batterId, setBatterId] = useState<string | undefined>();
  const [inning, setInning] = useState<number | undefined>();
  const pitcherIds = Array.from(new Set(game.events.map((event) => event.pitcherId)));
  const batterIds = Array.from(new Set(game.events.map((event) => event.batterId)));
  const innings = Array.from(new Set(game.events.map((event) => event.inning))).sort((a, b) => a - b);
  const playerName = (id: string) => { const player = players.find((item) => item.id === id); return playerIdentityLabel(player, id); };
  const pitchHeatmap = getPitchZoneHeatmap(game, filter, pitcherId, batterId, inning);
  const hitHeatmap = getHitZoneHeatmap(game, filter, batterId, pitcherId, inning);
  const labels: Record<PitchFilter, string> = { all: "全部", fastball: "速球", breaking: "變化球" };
  return <View style={styles.heatmapCard}>
    <View style={styles.heatmapHeading}><View><Text style={styles.heatmapTitle}>投打熱點分析</Text><Text style={styles.heatmapHint}>可依球種、投手、打者及局數篩選；投球含好球帶與外圈壞球位置。</Text></View><Text style={styles.heatmapBadge}>{labels[filter]}</Text></View>
    <View style={styles.heatmapFilterRow}>{(["all", "fastball", "breaking"] as PitchFilter[]).map((item) => <Pressable key={item} onPress={() => onFilter(item)} style={({ pressed }) => [styles.heatmapFilterButton, filter === item && styles.heatmapFilterButtonActive, pressed && styles.pressed]}><Text style={[styles.heatmapFilterText, filter === item && styles.heatmapFilterTextActive]}>{labels[item]}</Text></Pressable>)}</View>
    <View style={styles.advancedHeatmapFilters}><Text style={styles.advancedHeatmapLabel}>投手</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.advancedHeatmapChoiceRow}><Pressable onPress={() => setPitcherId(undefined)} style={[styles.advancedHeatmapChoice, !pitcherId && styles.advancedHeatmapChoiceActive]}><Text style={[styles.advancedHeatmapChoiceText, !pitcherId && styles.advancedHeatmapChoiceTextActive]}>全部</Text></Pressable>{pitcherIds.map((id) => <Pressable key={id} onPress={() => setPitcherId(id)} style={[styles.advancedHeatmapChoice, pitcherId === id && styles.advancedHeatmapChoiceActive]}><Text style={[styles.advancedHeatmapChoiceText, pitcherId === id && styles.advancedHeatmapChoiceTextActive]}>{playerName(id)}</Text></Pressable>)}</ScrollView><Text style={styles.advancedHeatmapLabel}>打者</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.advancedHeatmapChoiceRow}><Pressable onPress={() => setBatterId(undefined)} style={[styles.advancedHeatmapChoice, !batterId && styles.advancedHeatmapChoiceActive]}><Text style={[styles.advancedHeatmapChoiceText, !batterId && styles.advancedHeatmapChoiceTextActive]}>全部</Text></Pressable>{batterIds.map((id) => <Pressable key={id} onPress={() => setBatterId(id)} style={[styles.advancedHeatmapChoice, batterId === id && styles.advancedHeatmapChoiceActive]}><Text style={[styles.advancedHeatmapChoiceText, batterId === id && styles.advancedHeatmapChoiceTextActive]}>{playerName(id)}</Text></Pressable>)}</ScrollView><Text style={styles.advancedHeatmapLabel}>局數</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.advancedHeatmapChoiceRow}><Pressable onPress={() => setInning(undefined)} style={[styles.advancedHeatmapChoice, !inning && styles.advancedHeatmapChoiceActive]}><Text style={[styles.advancedHeatmapChoiceText, !inning && styles.advancedHeatmapChoiceTextActive]}>全場</Text></Pressable>{innings.map((item) => <Pressable key={item} onPress={() => setInning(item)} style={[styles.advancedHeatmapChoice, inning === item && styles.advancedHeatmapChoiceActive]}><Text style={[styles.advancedHeatmapChoiceText, inning === item && styles.advancedHeatmapChoiceTextActive]}>{item} 局</Text></Pressable>)}</ScrollView></View>
    <Text style={styles.heatmapSummary}>目前篩選：投球落點 {pitchHeatmap.total} 球 · 形成擊球 {hitHeatmap.total} 次</Text>
    <View style={styles.heatmapPanels}><ZoneHeatmapPanel title="投手九宮格落點" description="格內為該區投球數" counts={pitchHeatmap.counts} total={pitchHeatmap.total} tone="pitch" /><ZoneHeatmapPanel title="打者擊球分佈" description="格內為該區擊球數" counts={hitHeatmap.counts} total={hitHeatmap.total} tone="hit" /></View>
  </View>;
}

function ZoneHeatmapPanel({ title, description, counts, total, tone, mirrored = false }: { title: string; description: string; counts: number[]; total: number; tone: "pitch" | "hit"; mirrored?: boolean }) {
  const order = mirrored ? [2, 1, 0, 5, 4, 3, 8, 7, 6] : counts.map((_, index) => index);
  const max = Math.max(...counts, 1);
  return <View style={styles.heatmapPanel}><Text style={styles.heatmapPanelTitle}>{title}</Text><Text style={styles.heatmapPanelHint}>{description}</Text><View style={styles.heatmapMatrix}>{order.map((sourceIndex) => { const count = counts[sourceIndex] ?? 0; const ratio = count / max; const level = count === 0 ? "empty" : ratio >= 0.67 ? "high" : ratio >= 0.34 ? "medium" : "low"; const toneStyle = tone === "pitch" ? level === "high" ? styles.heatmapPitchHigh : level === "medium" ? styles.heatmapPitchMedium : level === "low" ? styles.heatmapPitchLow : styles.heatmapEmpty : level === "high" ? styles.heatmapHitHigh : level === "medium" ? styles.heatmapHitMedium : level === "low" ? styles.heatmapHitLow : styles.heatmapEmpty; return <View key={`${tone}-${sourceIndex + 1}`} style={[styles.heatmapCell, toneStyle]}><Text style={styles.heatmapZoneNumber}>{sourceIndex + 1}</Text><Text style={styles.heatmapZoneCount}>{count}</Text></View>; })}</View><Text style={styles.heatmapPanelTotal}>累計 {total} 筆</Text></View>;
}

function PlayerStatsModal({ player, game, onClose, onUpdatePlayer }: { player: Player | null; game: Game; onClose: () => void; onUpdatePlayer: (patch: Partial<Player>) => void }) {
  const analytics = player ? getPlayerHeatmapAnalytics(game, player.id) : null;
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const battingHand = player?.battingHand ?? "R";
  return <Modal visible={Boolean(player)} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={[styles.modalSheet, styles.playerStatsSheet]}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>{playerIdentityLabel(player, "個人統計")}</Text><Text style={styles.playerStatsSubtitle}>個人投球／打擊熱區 · 目前統計範圍</Text></View><Pressable onPress={onClose}><Text style={styles.modalClose}>關閉</Text></Pressable></View>{player && analytics ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playerStatsLandscape}><View style={styles.playerStatsControlPanel}><Text style={styles.playerStatsSectionTitle}>投打慣用手</Text><Text style={styles.playerStatsControlHint}>此設定會保存至球員名單，並同步逐球九宮格與打擊熱區視角。</Text><Text style={styles.playerStatsControlLabel}>投球</Text><View style={styles.handChoiceRow}>{(["R", "L"] as const).map((hand) => <Pressable key={`throw-${hand}`} onPress={() => onUpdatePlayer({ throwingHand: hand })} style={[styles.handChoice, player.throwingHand === hand && styles.handChoiceActive]}><Text style={[styles.handChoiceText, player.throwingHand === hand && styles.handChoiceTextActive]}>{hand}投</Text></Pressable>)}</View><Text style={styles.playerStatsControlLabel}>打擊</Text><View style={styles.handChoiceRow}>{(["R", "L"] as const).map((hand) => <Pressable key={`bat-${hand}`} onPress={() => onUpdatePlayer({ battingHand: hand })} style={[styles.handChoice, battingHand === hand && styles.handChoiceActive]}><Text style={[styles.handChoiceText, battingHand === hand && styles.handChoiceTextActive]}>{hand}打</Text></Pressable>)}</View></View><View style={styles.playerStatsAnalysisColumn}><Text style={styles.playerStatsSectionTitle}>投球熱區</Text><View style={styles.playerStatsRateRow}><Text style={styles.playerStatsRate}>總 {analytics.pitching.pitchTotal}</Text><Text style={styles.playerStatsRate}>好球 {analytics.pitching.strikes}</Text><Text style={styles.playerStatsRate}>壞球 {analytics.pitching.balls}</Text><Text style={styles.playerStatsRate}>揮空 {percent(analytics.pitching.whiffRate)}</Text><Text style={styles.playerStatsRate}>被安打 {percent(analytics.pitching.hitRate)}</Text><Text style={styles.playerStatsRate}>保送 {percent(analytics.pitching.walkRate)}</Text></View><ZoneHeatmapPanel title="投手九宮格落點" description="格內為投球數；好球帶與外圈壞球仍完整保留於逐球紀錄" counts={analytics.pitchingZone.counts} total={analytics.pitchingZone.total} tone="pitch" /></View><View style={styles.playerStatsAnalysisColumn}><Text style={styles.playerStatsSectionTitle}>打擊熱區｜{battingHand === "L" ? "左打鏡像視角" : "右打視角"}</Text><View style={styles.playerStatsRateRow}><Text style={styles.playerStatsRate}>面對 {analytics.batting.pitchTotal}</Text><Text style={styles.playerStatsRate}>揮空 {percent(analytics.batting.whiffRate)}</Text><Text style={styles.playerStatsRate}>安打 {percent(analytics.batting.hitRate)}</Text><Text style={styles.playerStatsRate}>保送 {percent(analytics.batting.walkRate)}</Text><Text style={styles.playerStatsRate}>長打 {percent(analytics.batting.extraBaseRate)}</Text></View><ZoneHeatmapPanel title="打者九宮格落點" description="格內為面對投球數；左打會依本壘板視角左右鏡像" counts={analytics.battingZone.counts} total={analytics.battingZone.total} tone="hit" mirrored={battingHand === "L"} /></View></ScrollView> : null}</View></View></Modal>;
}

function SingleGameRecord({ game, games, away, home, isReadOnly = false, onSelectGame, onSaveDisplayOverrides, onApplyFormalBlankSlotCorrection, onApplyFormalAtBatReplacement, formalAtBatReplacement, onFormalAtBatReplacementHandled, onRefresh, autoRefresh, refreshing, lastRefreshedAt, syncState, onToggleAutoRefresh, onOpenExportRange, onSelectRow, onOpenCorrection, canUndo, onUndo }: { game: Game; games: Game[]; away: Team; home: Team; isReadOnly?: boolean; onSelectGame: (gameId: string) => void; onSaveDisplayOverrides: (scorebookDisplayOverrides: Record<string, ScorebookDisplayOverride>) => void; onApplyFormalBlankSlotCorrection: (slot: ScorebookBlankSlot, replacementEvent: AtBatEvent, note?: string) => void; onApplyFormalAtBatReplacement: (slot: ScorebookBlankSlot, targetEvent: AtBatEvent, replacementEvent: AtBatEvent, note?: string) => void; formalAtBatReplacement: AtBatEvent | null; onFormalAtBatReplacementHandled: () => void; onRefresh: () => Promise<void>; autoRefresh: boolean; refreshing: boolean; lastRefreshedAt: string | null; syncState: "synced" | "pending" | "refreshing"; onToggleAutoRefresh: () => void; onOpenExportRange: () => void; onSelectRow: (row: GameRecordRow) => void; onOpenCorrection: (row: GameRecordRow) => void; canUndo: boolean; onUndo: () => void }) {
  const [selectedScorebookSide, setSelectedScorebookSide] = useState<TeamSide>(game.half);
  const [scorebookEditor, setScorebookEditor] = useState<{
    field: "player" | "defense";
    team: Team;
    side: TeamSide;
    battingOrder: number;
    entry: WasedaScorebookEntry;
    currentPlayerId?: string;
    currentDefensivePosition?: string;
    entryLabel: string;
  } | null>(null);
  const [formalBlankSlot, setFormalBlankSlot] = useState<ScorebookBlankSlot | null>(null);
  const formalReplacementSlot = useMemo<ScorebookBlankSlot | null>(() => {
    if (!formalAtBatReplacement) return null;
    const lineup = formalAtBatReplacement.half === "away" ? game.awayLineup : game.homeLineup;
    const battingOrderIndex = lineup?.battingOrderIds.indexOf(formalAtBatReplacement.batterId) ?? -1;
    return {
      side: formalAtBatReplacement.half,
      battingOrder: battingOrderIndex >= 0 ? battingOrderIndex + 1 : 1,
      entryIndex: 0,
      inning: formalAtBatReplacement.inning,
      slotIndex: 0,
      playerId: formalAtBatReplacement.batterId,
    };
  }, [formalAtBatReplacement, game.awayLineup, game.homeLineup]);
  const formalWorkflowSlot = formalAtBatReplacement ? formalReplacementSlot : formalBlankSlot;

  useEffect(() => {
    setSelectedScorebookSide(game.half);
    setScorebookEditor(null);
    setFormalBlankSlot(null);
  }, [game.half, game.id]);
  const rows = useMemo<GameRecordRow[]>(() => {
    const teamForHalf = (half: TeamSide) => half === "away" ? away : home;
    const atBatRows = game.events.map((event) => {
      const team = teamForHalf(event.half);
      const batter = team.players.find((player) => player.id === event.batterId);
      return {
        id: `atbat-${event.id}`,
        kind: "atbat" as const,
        atBatEventId: event.id,
        inning: event.inning,
        half: event.half,
        teamName: team.name,
        playerLabel: batter ? `#${batter.number} ${batter.name}` : "未辨識打者",
        notation: event.notation || event.result,
        resultLabel: event.result,
        detail: `${event.pitches.total} 球 · ${event.outsBefore} 出局前${event.runsScored ? ` · ${event.runsScored} 分` : ""}${event.source === "manual" ? " · 補登" : ""}`,
        detailLines: [`輸入方式：${event.source === "manual" ? "手動補登" : "現場逐球"}`, `球數：${event.pitches.total}`, `好球：${event.pitches.strikes} · 壞球：${event.pitches.balls}`, `出局前：${event.outsBefore}`, `得分：${event.runsScored}`, `紀錄時間：${new Date(event.timestamp).toLocaleString("zh-TW")}`],
        timestamp: event.timestamp,
      };
    });
    const specialRows = (game.specialEvents ?? []).map((event) => {
      const team = teamForHalf(event.half);
      const runner = event.runnerId ? team.players.find((player) => player.id === event.runnerId) : undefined;
      return {
        id: `special-${event.id}`,
        kind: "special" as const,
        inning: event.inning,
        half: event.half,
        teamName: team.name,
        playerLabel: runner ? `#${runner.number} ${runner.name}` : "跑者／投捕",
        notation: event.notation || getSpecialEventNotation(event.type, event.fromBase, event.toBase),
        resultLabel: SPECIAL_EVENT_LABELS[event.type],
        detail: `特殊事件 · ${event.outsBefore} 出局前${event.runsScored ? ` · ${event.runsScored} 分` : ""}${event.reason ? ` · 原因：${event.reason}` : ""}`,
        detailLines: [`事件：${SPECIAL_EVENT_LABELS[event.type]}`, ...(event.reason ? [`暫停原因：${event.reason}`] : []), `跑者：${runner ? `#${runner.number} ${runner.name}` : "跑者／投捕"}`, `壘包：${event.fromBase ?? "-"} → ${event.toBase ?? "-"}`, `得分：${event.runsScored}`, `紀錄時間：${new Date(event.timestamp).toLocaleString("zh-TW")}`],
        timestamp: event.timestamp,
      };
    });
    const substitutionRows = game.substitutions.map((substitution) => {
      const team = substitution.teamId === away.id ? away : home;
      const playerOut = team.players.find((player) => player.id === substitution.playerOutId);
      const playerIn = team.players.find((player) => player.id === substitution.playerInId);
      return {
        id: `substitution-${substitution.id}`,
        kind: "substitution" as const,
        inning: substitution.inning,
        half: substitution.half,
        teamName: team.name,
        playerLabel: `${playerOut ? `#${playerOut.number} ${playerOut.name}` : "未知球員"} → ${playerIn ? `#${playerIn.number} ${playerIn.name}` : "未知球員"}`,
        notation: `${substitution.position} 換人`,
        resultLabel: "換人",
        detail: "人員／守備位置異動",
        detailLines: [`球員：${playerOut?.name ?? "未知球員"} → ${playerIn?.name ?? "未知球員"}`, `守備位置：${substitution.position}`, `球隊：${team.name}`, `紀錄時間：${new Date(substitution.timestamp).toLocaleString("zh-TW")}`],
        timestamp: substitution.timestamp,
      };
    });
    return [...atBatRows, ...specialRows, ...substitutionRows].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
  }, [away, game.events, game.specialEvents, game.substitutions, home]);

  const inningCount = Math.max(1, Math.min(game.maxInnings, Math.max(game.inning, game.score.length)));
  const innings = Array.from({ length: inningCount }, (_, index) => index + 1);
  const awayBatting = getBattingStats(game, away);
  const homeBatting = getBattingStats(game, home);
  const awayPitching = getPitchingStats(game, away);
  const homePitching = getPitchingStats(game, home);
  const awayTeamSummary = getTeamPerformanceSummary([game], away);
  const homeTeamSummary = getTeamPerformanceSummary([game], home);
  const totalPitches = game.events.reduce((sum, event) => sum + event.pitches.total, 0);
  const totalRuns = game.score.reduce((sum, inning) => sum + inning.away + inning.home, 0);
  const selectedScorebook = selectedScorebookSide === "away"
    ? { team: away, side: "away" as const, batting: awayBatting, pitching: awayPitching, summary: awayTeamSummary }
    : { team: home, side: "home" as const, batting: homeBatting, pitching: homePitching, summary: homeTeamSummary };

  const renderLegacyTeamSheet = (team: Team, side: TeamSide, batting: ReturnType<typeof getBattingStats>, pitching: ReturnType<typeof getPitchingStats>, teamSummary: ReturnType<typeof getTeamPerformanceSummary>) => {
    const gameLineup = side === "away" ? game.awayLineup : game.homeLineup;
    const lineup = sortGameRosterForDisplay(game, team, side);
    const teamEvents = game.events.filter((event) => event.half === side);
    const teamSubstitutions = game.substitutions.filter((substitution) => substitution.teamId === team.id).slice().sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
    const defensivePlays = teamEvents.filter((event) => /\b(?:DP|TP)\b/.test(event.result) || /\b(?:DP|TP)\b/.test(event.notation) || event.result === "E" || /\bE\b/.test(event.notation));
    const sacrificeTotals = getTeamSacrificeTotals(batting);
    const getCellEvents = (playerId: string, inning: number) => teamEvents.filter((event) => event.batterId === playerId && event.inning === inning);
    const getDefensivePositionSummary = (player: Player) => {
      const startingPosition = gameLineup?.defensivePositions[player.id];
      const changes = teamSubstitutions
        .filter((substitution) => substitution.playerInId === player.id || substitution.playerOutId === player.id)
        .map((substitution) => `${substitution.inning}${substitution.half === "away" ? "上" : "下"}${substitution.playerInId === player.id ? "入" : "出"}${substitution.position}`);
      return {
        starting: startingPosition ? `先 ${startingPosition}` : changes.some((change) => change.includes("入")) ? "局中加入" : `先 ${player.position || "—"}`,
        changes,
      };
    };
    return <View style={[styles.wasedaSheet, { backgroundColor: teamSurfaceColor(team, side), borderColor: teamAccentColor(team, side) }]} key={team.id}>
      <View style={[styles.wasedaSheetTitleRow, { backgroundColor: teamSurfaceColor(team, side) }]}><View><Text style={styles.wasedaTeamCaption}>{side === "away" ? "客場／先攻" : "主場／後攻"}</Text><TeamLogoName team={team} textStyle={styles.wasedaTeamTitle} logoSize={20} /></View><Text style={styles.wasedaTeamScore}>{side === "away" ? game.score.reduce((sum, inning) => sum + inning.away, 0) : game.score.reduce((sum, inning) => sum + inning.home, 0)}</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator persistentScrollbar nestedScrollEnabled contentContainerStyle={styles.wasedaScrollContent}>
        <View>
          <View style={styles.wasedaHeaderRow}><Text style={[styles.wasedaPositionCell, styles.wasedaHeaderText]}>守備{`\n`}先發／局中</Text><Text style={[styles.wasedaPlayerCell, styles.wasedaHeaderText]}>先攻打擊／球員</Text><Text style={[styles.wasedaNumberCell, styles.wasedaHeaderText]}>背號</Text>{innings.map((inning) => <View key={inning} style={styles.wasedaInningHeader}><Text style={styles.wasedaInningNumber}>{inning}</Text><Text style={styles.wasedaInningSub}>局</Text></View>)}<Text style={[styles.wasedaTotalCell, styles.wasedaHeaderText]}>合計</Text></View>
          {lineup.length === 0 ? <Text style={styles.emptyText}>尚未安排棒次；匯入名單後即可在此顯示球員逐局紀錄。</Text> : lineup.map((player) => {
            const playerBatting = batting.find((line) => line.player.id === player.id);
            const battingOrderIndex = gameLineup?.battingOrderIds.indexOf(player.id) ?? -1;
            const defensiveSummary = getDefensivePositionSummary(player);
            return <View key={player.id} style={styles.wasedaDataRow}><View style={[styles.wasedaPositionCell, styles.wasedaPositionSummary]}><Text style={styles.wasedaPositionStarter}>{defensiveSummary.starting}</Text><Text numberOfLines={3} style={styles.wasedaPositionTimeline}>{defensiveSummary.changes.length ? defensiveSummary.changes.join(" · ") : "局中未換守"}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`查看${team.name}${player.name}逐局紀錄`} onPress={() => { const firstEvent = teamEvents.find((event) => event.batterId === player.id); if (firstEvent) onSelectRow(rows.find((row) => row.id === `atbat-${firstEvent.id}`) ?? rows[0]); }} style={({ pressed }) => [styles.wasedaPlayerCellWrap, pressed && styles.pressed]}><Text style={styles.wasedaPlayerText}>{battingOrderIndex >= 0 ? battingOrderIndex + 1 : "候"}. {player.name} {playerHandAbbr(player)}</Text><Text style={styles.wasedaPlayerSub}>#{player.number}</Text></Pressable><Text style={styles.wasedaNumberCell}>{player.number}</Text>{innings.map((inning) => { const cellEvents = getCellEvents(player.id, inning); const event = aggregateInningRunnerEvents(cellEvents, player.id, inning); return <Pressable key={`${player.id}-${inning}`} accessibilityRole="button" accessibilityLabel={`修改${player.name}第${inning}局紀錄`} onPress={() => { if (event) { const row = rows.find((candidate) => candidate.id === `atbat-${event.id}`); if (row) onSelectRow(row); } }} style={({ pressed }) => [styles.wasedaInningCell, pressed && styles.pressed]}><WasedaPersonalRecordCell size="compact" event={event} showLabels={false} /></Pressable>; })}<Text style={styles.wasedaTotalCell}>{playerBatting?.ab ?? 0} AB / {playerBatting?.h ?? 0} H</Text></View>;
          })}
          <View style={styles.wasedaTotalsRow}><Text style={[styles.wasedaPositionCell, styles.wasedaTotalsLabel]}>團隊</Text><Text style={[styles.wasedaPlayerCell, styles.wasedaTotalsLabel]}>R {teamSummary.runs} · H {teamSummary.hits} · BB {teamSummary.walks} · K {teamSummary.strikeouts}{`\n`}SH {sacrificeTotals.sh} · SF {sacrificeTotals.sf} · 犧牲 RBI {sacrificeTotals.sacRbi}</Text><Text style={styles.wasedaNumberCell}>—</Text>{innings.map((inning) => <Text key={inning} style={styles.wasedaInningTotal}>{side === "away" ? game.score[inning - 1]?.away ?? 0 : game.score[inning - 1]?.home ?? 0}</Text>)}<Text style={styles.wasedaTotalCell}>{teamSummary.runs} 分{`\n`}SH {sacrificeTotals.sh} · SF {sacrificeTotals.sf}</Text></View>
        </View>
      </ScrollView>
      <View style={styles.wasedaLegendStrip}><Text style={styles.wasedaLegendTitle}>紀錄代號</Text><Text style={styles.wasedaLegendText}>1B 一壘安打 · 2B 二壘安打 · 3B 三壘安打 · HR 全壘打 · BB 四壞 · HBP 觸身 · K 三振 · F 飛球 · G 滾地 · E 失誤</Text></View>
      <View style={styles.wasedaSummaryGrid}><View style={styles.wasedaSummaryCard}><Text style={styles.wasedaSummaryTitle}>打擊摘要｜含 SH、SF、犧牲打 RBI</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}><View><View style={styles.wasedaStatHeader}><Text style={styles.wasedaStatPlayer}>球員</Text><Text style={styles.wasedaStatCell}>AB</Text><Text style={styles.wasedaStatCell}>H</Text><Text style={styles.wasedaStatCell}>AVG</Text><Text style={styles.wasedaStatCell}>SLG</Text><Text style={styles.wasedaStatCell}>OBP</Text><Text style={styles.wasedaStatCell}>OPS</Text><Text style={styles.wasedaStatCell}>SH</Text><Text style={styles.wasedaStatCell}>SF</Text><Text style={styles.wasedaStatSacCell}>犧牲{`\n`}RBI</Text></View>{batting.filter((line) => line.ab + line.bb + line.hbp + line.sh + line.sf > 0).map((line) => <Pressable key={line.player.id} onPress={() => { const firstEvent = teamEvents.find((event) => event.batterId === line.player.id); if (firstEvent) { const row = rows.find((candidate) => candidate.id === `atbat-${firstEvent.id}`); if (row) onSelectRow(row); } }} style={({ pressed }) => [styles.wasedaStatRow, pressed && styles.pressed]}><Text style={styles.wasedaStatPlayer}>{playerIdentityLabel(line.player)}</Text><Text style={styles.wasedaStatCell}>{line.ab}</Text><Text style={styles.wasedaStatCell}>{line.h}</Text><Text style={styles.wasedaStatCell}>{formatAvg(line.avg)}</Text><Text style={styles.wasedaStatCell}>{formatAvg(line.slg)}</Text><Text style={styles.wasedaStatCell}>{formatAvg(line.obp)}</Text><Text style={styles.wasedaStatCell}>{formatAvg(line.ops)}</Text><Text style={styles.wasedaStatCell}>{line.sh}</Text><Text style={styles.wasedaStatCell}>{line.sf}</Text><Text style={styles.wasedaStatSacCell}>{line.sacRbi}</Text></Pressable>)}</View></ScrollView></View><View style={styles.wasedaSummaryCard}><Text style={styles.wasedaSummaryTitle}>投手摘要</Text>{pitching.filter((line) => line.pitches > 0).map((line) => <Pressable key={line.player.id} onPress={() => { const firstEvent = game.events.find((event) => event.pitcherId === line.player.id); if (firstEvent) { const row = rows.find((candidate) => candidate.id === `atbat-${firstEvent.id}`); if (row) onSelectRow(row); } }} style={({ pressed }) => [styles.wasedaPitcherRow, pressed && styles.pressed]}><Text style={styles.wasedaStatPlayer}>{playerIdentityLabel(line.player)}</Text><Text style={styles.wasedaPitcherStats}>IP {line.ip} · 球 {line.pitches} · H {line.h} · BB {line.bb} · K {line.so} · ERA {formatRate(line.era)}</Text></Pressable>)}{pitching.every((line) => line.pitches === 0) ? <Text style={styles.emptyText}>尚未有投手紀錄。</Text> : null}</View></View>
      <View style={styles.wasedaSummaryGrid}><View style={styles.wasedaSummaryCard}><Text style={styles.wasedaSummaryTitle}>換人歷程｜寫入前可於工作台逐步返回</Text>{teamSubstitutions.length === 0 ? <Text style={styles.emptyText}>尚未記錄換投、代打、代跑或換守。</Text> : teamSubstitutions.map((substitution) => { const playerOut = team.players.find((player) => player.id === substitution.playerOutId); const playerIn = team.players.find((player) => player.id === substitution.playerInId); return <View key={substitution.id} style={styles.symbolRow}><Text style={styles.symbolInning}>{substitution.inning}{substitution.half === "away" ? "上" : "下"}</Text><Text style={styles.symbolText}>{substitution.type ?? "換人"} · #{playerOut?.number ?? "?"} {playerOut?.name ?? "未知"} → #{playerIn?.number ?? "?"} {playerIn?.name ?? "未知"}</Text><Text style={styles.symbolResult}>{substitution.position}</Text></View>; })}</View><View style={styles.wasedaSummaryCard}><Text style={styles.wasedaSummaryTitle}>守備／傳接摘要</Text>{defensivePlays.length === 0 ? <Text style={styles.emptyText}>尚未有雙殺、三殺或失誤紀錄。</Text> : defensivePlays.map((event) => <Pressable key={event.id} onPress={() => { const row = rows.find((candidate) => candidate.id === `atbat-${event.id}`); if (row) onSelectRow(row); }} style={({ pressed }) => [styles.symbolRow, pressed && styles.pressed]}><Text style={styles.symbolInning}>{event.inning}{event.half === "away" ? "上" : "下"}</Text><Text style={styles.symbolText}>{event.notation}</Text><Text style={styles.symbolResult}>{event.result}</Text></Pressable>)}</View></View>
    </View>;
  };

  const openScorebookEntryEditor = (team: Team, side: TeamSide, entry: WasedaScorebookEntry, battingOrder: number, field: "player" | "defense") => {
    if (isReadOnly) return;
    const overrideKey = getScorebookDisplayOverrideKey(side, battingOrder, entry.entryIndex);
    const currentOverride = game.scorebookDisplayOverrides?.[overrideKey];
    const lineup = side === "away" ? game.awayLineup : game.homeLineup;
    const currentPlayerId = currentOverride?.playerId ?? entry.playerId;
    const currentPlayer = currentPlayerId ? team.players.find((player) => player.id === currentPlayerId) : undefined;
    const currentDefensivePosition = currentOverride?.defensivePosition
      ?? (entry.kind === "starter" ? lineup?.defensivePositions[entry.playerId ?? ""] : entry.substitution?.position)
      ?? currentPlayer?.position;
    setScorebookEditor({
      field,
      team,
      side,
      battingOrder,
      entry,
      currentPlayerId,
      currentDefensivePosition,
      entryLabel: `第 ${battingOrder} 棒${entry.entryIndex > 0 ? `／候補 ${entry.entryIndex}` : "／先發"}`,
    });
  };

  const saveScorebookDisplayOverride = (patch: ScorebookDisplayOverride) => {
    if (isReadOnly || !scorebookEditor) return;
    const overrideKey = getScorebookDisplayOverrideKey(scorebookEditor.side, scorebookEditor.battingOrder, scorebookEditor.entry.entryIndex);
    onSaveDisplayOverrides({
      ...(game.scorebookDisplayOverrides ?? {}),
      [overrideKey]: {
        ...game.scorebookDisplayOverrides?.[overrideKey],
        ...patch,
      },
    });
    setScorebookEditor(null);
  };

  const openFormalBlankSlotCorrection = (slot: ScorebookBlankSlot) => {
    if (isReadOnly) return;
    const reason = getFormalScorebookCorrectionLockReason(game, slot);
    if (reason) {
      Alert.alert("尚未開放正式更正", reason);
      return;
    }
    setFormalBlankSlot(slot);
  };

  const renderTeamSheet = (team: Team, side: TeamSide, _batting: ReturnType<typeof getBattingStats>, _pitching: ReturnType<typeof getPitchingStats>, _teamSummary: ReturnType<typeof getTeamPerformanceSummary>) => <>
    <WasedaScorebookTeamSheet
      game={game}
      team={team}
      opponentTeam={side === "away" ? home : away}
      side={side}
      onSelectAtBatEvent={(eventId) => {
        if (isReadOnly) return;
        const row = rows.find((candidate) => candidate.id === `atbat-${eventId}`);
        if (row) onSelectRow(row);
      }}
      onLongPressAtBatEvent={(eventId) => {
        if (isReadOnly) return;
        const row = rows.find((candidate) => candidate.id === `atbat-${eventId}`);
        if (row) onOpenCorrection(row);
      }}
      onLongPressEntry={(entry, battingOrder, field) => openScorebookEntryEditor(team, side, entry, battingOrder, field)}
      onLongPressBlankSlot={openFormalBlankSlotCorrection}
    />
    <ScorebookDisplayEditor field={scorebookEditor?.field ?? null} entryLabel={scorebookEditor?.entryLabel ?? ""} team={scorebookEditor?.team ?? null} currentPlayerId={scorebookEditor?.currentPlayerId} currentDefensivePosition={scorebookEditor?.currentDefensivePosition} onClose={() => setScorebookEditor(null)} onSave={saveScorebookDisplayOverride} />
    <FormalBlankSlotLiveWorkflowModal visible={Boolean(formalWorkflowSlot)} game={game} away={away} home={home} slot={formalWorkflowSlot} replacementTarget={formalAtBatReplacement} onClose={() => { setFormalBlankSlot(null); onFormalAtBatReplacementHandled(); }} onSubmit={(slot, event, note) => { onApplyFormalBlankSlotCorrection(slot, event, note); setFormalBlankSlot(null); }} onReplace={(target, event, note) => { if (!formalWorkflowSlot) return; onApplyFormalAtBatReplacement(formalWorkflowSlot, target, event, note); setFormalBlankSlot(null); onFormalAtBatReplacementHandled(); }} />
  </>;

  return <View style={styles.statsSection}>
    <View style={styles.gameRecordHeaderCard}><Text style={styles.gameRecordEyebrow}>WASEDA SCOREBOOK · {isReadOnly ? "DISPLAY EXAMPLE" : "LIVE"}</Text><Text style={styles.gameRecordTitle}>單場整體紀錄</Text><Text style={styles.gameRecordIntro}>{game.name} · {game.venue} · {game.date} · {game.status === "final" ? "比賽完成" : "現場記錄中"}</Text>{isReadOnly ? <Text style={styles.gameRecordReadOnlyBanner}>2013 WBC 顯示範例｜僅供檢視連續列、候補與局內多打席；不寫入本機資料，亦不開放補正、換人、匯出或現場紀錄。</Text> : null}<View style={styles.gameRecordActionRow}><ScorebookGameSelector activeGameId={game.id} games={games} onSelect={onSelectGame} /></View><View style={styles.gameRecordMetricRow}><StatChip label="紀錄筆數" value={rows.length} accent={BRAND.navy} /><StatChip label="逐球數" value={totalPitches} accent={BRAND.blue} /><StatChip label="目前比分" value={`${game.score.reduce((sum, inning) => sum + inning.away, 0)}:${game.score.reduce((sum, inning) => sum + inning.home, 0)}`} accent={BRAND.green} /><StatChip label="總得分" value={totalRuns} accent={BRAND.red} /></View></View>
    <View style={styles.gameLogThreePane}>
      <View style={styles.gameLogLeftColumn}><View style={styles.gameLogTeamsPane}><Text style={styles.tableTitle}>主場(先守)／客場(先攻)</Text><Text style={styles.gameRecordSheetHint}>點選隊名，切換左下顯示的對應早稻田單場紀錄表。</Text><View style={styles.gameLogTeamPair}><Pressable onPress={() => setSelectedScorebookSide("away")} style={[styles.gameLogAwayTeam, selectedScorebookSide === "away" && styles.gameLogTeamSelected, { backgroundColor: teamSurfaceColor(away, "away"), borderColor: teamAccentColor(away, "away") }]}><Text style={styles.gameLogTeamSide}>客場(先攻)</Text><TeamLogoName team={away} textStyle={styles.gameLogTeamName} logoSize={18} /><Text style={styles.gameLogTeamScore}>{game.score.reduce((sum, inning) => sum + inning.away, 0)}</Text></Pressable><Text style={styles.gameLogVersus}>VS</Text><Pressable onPress={() => setSelectedScorebookSide("home")} style={[styles.gameLogHomeTeam, selectedScorebookSide === "home" && styles.gameLogTeamSelected, { backgroundColor: teamSurfaceColor(home, "home"), borderColor: teamAccentColor(home, "home") }]}><Text style={styles.gameLogTeamSide}>主場(先守)</Text><TeamLogoName team={home} textStyle={styles.gameLogTeamName} logoSize={18} align="right" /><Text style={styles.gameLogTeamScore}>{game.score.reduce((sum, inning) => sum + inning.home, 0)}</Text></Pressable></View><Text style={styles.gameRecordStatusText}>第 {game.inning} 局{game.half === "away" ? "上" : "下"} · {game.outs} 出局 · {game.status === "final" ? "比賽完成" : "現場記錄中"}</Text><ScoreBoard game={game} away={away} home={home} /></View>
      <View style={[styles.gameRecordSheet, { backgroundColor: teamSurfaceColor(selectedScorebook.team, selectedScorebook.side), borderColor: teamAccentColor(selectedScorebook.team, selectedScorebook.side) }]}><View style={styles.gameRecordSheetHeader}><View><Text style={styles.tableTitle}>{selectedScorebook.team.name}｜{isReadOnly ? "唯讀早稻田單場紀錄表" : "可編輯早稻田單場紀錄表"}</Text><Text style={styles.gameRecordSheetHint}>{isReadOnly ? "此範例只供檢視連續列投影；請改選正式場次以查看、補正或輸出紀錄。" : "點選逐局格先查看明細；長按已完成打席格可在安全時機補正顯示。"}</Text></View><Text style={styles.gameRecordSheetCount}>{rows.filter((row) => row.teamName === selectedScorebook.team.name).length} 筆</Text></View><View style={styles.gameRecordActionRow}><Button label={refreshing ? "整理中…" : "重新整理"} onPress={() => { void onRefresh(); }} disabled={isReadOnly || refreshing} variant="secondary" compact /><Button label={`自動更新：${autoRefresh ? "開" : "關"}`} onPress={onToggleAutoRefresh} disabled={isReadOnly} variant="secondary" compact /><Button label="匯出 PDF／圖片" onPress={onOpenExportRange} disabled={isReadOnly} compact /><Button label="復原上一筆" onPress={onUndo} disabled={isReadOnly || !canUndo} variant="secondary" compact /></View><View style={styles.gameRecordSyncRow}><View style={[styles.gameRecordSyncBadge, isReadOnly ? styles.gameRecordSyncBadgePending : syncState === "synced" ? styles.gameRecordSyncBadgeSynced : syncState === "refreshing" ? styles.gameRecordSyncBadgeRefreshing : styles.gameRecordSyncBadgePending]}><View style={[styles.gameRecordSyncDot, isReadOnly ? styles.gameRecordSyncDotPending : syncState === "refreshing" ? styles.gameRecordSyncDotRefreshing : syncState === "pending" ? styles.gameRecordSyncDotPending : styles.gameRecordSyncDotSynced]} /><Text style={styles.gameRecordSyncText}>{isReadOnly ? "唯讀展示資料" : syncState === "synced" ? "資料已同步" : syncState === "refreshing" ? "同步檢查中" : "待同步"}</Text></View><Text style={styles.gameRecordSyncHint}>{isReadOnly ? "展示投影不會加入本機保存、現場逐球、統計或匯出範圍。" : canUndo ? "可復原最近一次正式打席、換人或特殊註記；復原後會回到寫入前的壘包、比分與名單狀態。" : "格內三區依序為球數欄、外圈格、內圈格；長按已完成打席格可做顯示補正。"}</Text></View>{renderTeamSheet(selectedScorebook.team, selectedScorebook.side, selectedScorebook.batting, selectedScorebook.pitching, selectedScorebook.summary)}</View></View>
    </View>
  </View>;
}

function FullPreview({ game, away, home, onOpenExportRange }: { game: Game; away: Team; home: Team; onOpenExportRange: () => void }) {
  const { interfacePalette } = useThemeContext();
  const cardStyle = { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border };
  const dividerStyle = { borderBottomColor: interfacePalette.border };

  return <View style={styles.previewStack}>
    <View style={[styles.previewCard, cardStyle]}>
      <Text style={[styles.previewTitle, { color: interfacePalette.foreground }]}>完整預覽</Text>
      <Text style={[styles.previewMeta, { color: interfacePalette.muted }]}>{game.name} · {game.venue}</Text>
      <ScoreBoard game={game} away={away} home={home} />
      <View style={styles.exportRow}><Button label="匯出 PDF／圖片（選範圍）" onPress={onOpenExportRange} compact /></View>
    </View>
    <View style={[styles.previewCard, cardStyle]}>
      <Text style={[styles.previewTitle, { color: interfacePalette.foreground }]}>紀錄範圍</Text>
      <View style={[styles.rangeRow, dividerStyle]}><Text style={[styles.rangeLabel, { color: interfacePalette.primary }]}>局數</Text><Text style={[styles.rangeValue, { color: interfacePalette.foreground }]}>1–{game.inning} 局（上限 {game.maxInnings} 局）</Text></View>
      <View style={[styles.rangeRow, dividerStyle]}><Text style={[styles.rangeLabel, { color: interfacePalette.primary }]}>逐球</Text><Text style={[styles.rangeValue, { color: interfacePalette.foreground }]}>{game.events.length} 個打席／{game.events.reduce((sum, event) => sum + event.pitches.total, 0)} 球</Text></View>
      <View style={[styles.rangeRow, dividerStyle]}><Text style={[styles.rangeLabel, { color: interfacePalette.primary }]}>換人</Text><Text style={[styles.rangeValue, { color: interfacePalette.foreground }]}>{game.substitutions.length} 次</Text></View>
    </View>
    <View style={[styles.previewCard, cardStyle]}>
      <Text style={[styles.previewTitle, { color: interfacePalette.foreground }]}>逐球符號</Text>
      {game.events.length === 0 ? <Text style={[styles.emptyText, { color: interfacePalette.muted }]}>尚未有紀錄。</Text> : game.events.slice(-12).reverse().map((event) => {
        const correctedPitchMarks = event.recordCorrection?.pitchMarks?.trim();
        const originalPitchMarks = (event.pitches.locations ?? []).map((pitch) => getWasedaPitchMark(pitch.outcome)).join("");
        const pitchMarks = correctedPitchMarks || originalPitchMarks || event.notation;
        return <View key={event.id} style={[styles.symbolRow, dividerStyle]}><Text style={[styles.symbolInning, { color: interfacePalette.muted }]}>{event.inning}{event.half === "away" ? "上" : "下"}</Text><Text style={[styles.symbolText, { color: interfacePalette.primary }]}>{pitchMarks}</Text><Text style={[styles.symbolResult, { color: interfacePalette.muted }]}>{event.result}</Text></View>;
      })}
    </View>
    <View style={[styles.previewCard, cardStyle]}>
      <Text style={[styles.previewTitle, { color: interfacePalette.foreground }]}>換人歷史</Text>
      {game.substitutions.length === 0 ? <Text style={[styles.emptyText, { color: interfacePalette.muted }]}>尚未記錄換人。</Text> : game.substitutions.slice().reverse().map((substitution) => {
        const team = substitution.teamId === away.id ? away : home;
        const playerOut = team.players.find((player) => player.id === substitution.playerOutId);
        const playerIn = team.players.find((player) => player.id === substitution.playerInId);
        return <View key={substitution.id} style={[styles.symbolRow, dividerStyle]}><Text style={[styles.symbolInning, { color: interfacePalette.muted }]}>{substitution.inning}{substitution.half === "away" ? "上" : "下"}</Text><Text style={[styles.symbolText, { color: interfacePalette.foreground }]}>{team.name} #{playerOut?.number ?? "?"} → #{playerIn?.number ?? "?"}</Text><Text style={[styles.symbolResult, { color: interfacePalette.muted }]}>{substitution.position}</Text></View>;
      })}
    </View>
  </View>;
}

function NavButton({ label, icon, active, onPress, emphasis = false }: { label: string; icon: string; active: boolean; onPress: () => void; emphasis?: boolean }) {
  const { interfacePalette } = useThemeContext();
  const activeIndicator = active ? { borderBottomColor: interfacePalette.primary, borderBottomWidth: 2 } : undefined;
  const labelColor = { color: active ? interfacePalette.primary : interfacePalette.muted };
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.navButton, emphasis && styles.navButtonEmphasis, activeIndicator, pressed && styles.pressed]}><Text style={[styles.navIcon, labelColor]}>{icon}</Text><Text style={[styles.navLabel, labelColor]}>{label}</Text></Pressable>;
}

type ExportFormat = "pdf" | "image" | "csv";

function ExportRangeModal({ visible, game, initialFilter, canExportVerifiedScoreCsv, onClose, onExport }: { visible: boolean; game: Game; initialFilter?: GameReportFilter; canExportVerifiedScoreCsv: boolean; onClose: () => void; onExport: (filter: GameReportFilter | undefined, format: ExportFormat) => void }) {
  const [fromInning, setFromInning] = useState("1");
  const [toInning, setToInning] = useState(String(game.maxInnings));
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");

  useEffect(() => {
    if (!visible) return;
    setFromInning(String(initialFilter?.fromInning ?? 1));
    setToInning(String(initialFilter?.toInning ?? game.inning ?? game.maxInnings));
    setFromTime(initialFilter?.fromTime ? initialFilter.fromTime.slice(0, 16) : "");
    setToTime(initialFilter?.toTime ? initialFilter.toTime.slice(0, 16) : "");
  }, [game.inning, game.maxInnings, initialFilter?.fromInning, initialFilter?.fromTime, initialFilter?.toInning, initialFilter?.toTime, visible]);

  const buildFilter = () => {
    const from = Math.max(1, Math.min(game.maxInnings, Number.parseInt(fromInning, 10) || 1));
    const to = Math.max(from, Math.min(game.maxInnings, Number.parseInt(toInning, 10) || game.inning));
    const parseTime = (value: string) => {
      if (!value.trim()) return undefined;
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) throw new Error("時間格式錯誤");
      return parsed.toISOString();
    };
    const filter: GameReportFilter = { fromInning: from, toInning: to, fromTime: parseTime(fromTime), toTime: parseTime(toTime) };
    return filter;
  };

  const submit = (format: ExportFormat) => {
    try {
      onExport(buildFilter(), format);
    } catch {
      Alert.alert("時間格式錯誤", "請使用 YYYY-MM-DDTHH:mm 格式輸入時間，例如 2026-08-13T18:30。");
    }
  };

  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>選擇匯出範圍</Text><Text style={styles.modalSubtitle}>PDF／圖片只輸出選定局數與時間內的早稻田紀錄</Text></View><Pressable onPress={onClose}><Text style={styles.modalClose}>關閉</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false}><View style={styles.exportPresetRow}><Button label="目前進度" variant="secondary" compact onPress={() => { setFromInning("1"); setToInning(String(game.inning)); setFromTime(""); setToTime(""); }} /><Button label={`${game.maxInnings} 局全場`} variant="secondary" compact onPress={() => { setFromInning("1"); setToInning(String(game.maxInnings)); setFromTime(""); setToTime(""); }} /></View><Text style={styles.inputLabel}>局數範圍</Text><View style={styles.exportInputRow}><TextInput value={fromInning} onChangeText={setFromInning} keyboardType="number-pad" style={[styles.formInput, styles.exportNumberInput]} placeholder="起始局" placeholderTextColor={BRAND.muted} /><Text style={styles.exportRangeDash}>至</Text><TextInput value={toInning} onChangeText={setToInning} keyboardType="number-pad" style={[styles.formInput, styles.exportNumberInput]} placeholder="結束局" placeholderTextColor={BRAND.muted} /><Text style={styles.exportRangeUnit}>局</Text></View><Text style={styles.inputLabel}>時間範圍（選填）</Text><TextInput value={fromTime} onChangeText={setFromTime} style={styles.formInput} placeholder="起始：YYYY-MM-DDTHH:mm" placeholderTextColor={BRAND.muted} {...({ type: "datetime-local" } as any)} autoCapitalize="none" /><TextInput value={toTime} onChangeText={setToTime} style={styles.formInput} placeholder="結束：YYYY-MM-DDTHH:mm" placeholderTextColor={BRAND.muted} {...({ type: "datetime-local" } as any)} autoCapitalize="none" /><Text style={styles.exportRangeHint}>局數與時間會同時套用；留白時間欄位代表不限制時間。</Text>{canExportVerifiedScoreCsv ? <Text style={styles.exportVerifiedCsvHint}>此場的基本比分與逐局已完成核對；CSV 會輸出完整核對值，不受上述範圍篩選。</Text> : <Text style={styles.exportVerifiedCsvUnavailable}>CSV 僅提供逐局與最終比分皆已核對、且尚未修改的內建復興少棒67場次。</Text>}<View style={styles.exportChoiceButtons}><Button label="匯出 PDF" variant="secondary" onPress={() => submit("pdf")} /><Button label="匯出圖片" onPress={() => submit("image")} />{canExportVerifiedScoreCsv ? <Button label="匯出核對 CSV" variant="secondary" onPress={() => submit("csv")} /> : null}</View></ScrollView></View></View></Modal>;
}

function LegacyGameRecordDetailModal({ row, game, onClose, onSave, onClearAll }: { row: GameRecordRow | null; game: Game | undefined; onClose: () => void; onSave: (eventId: string, target: RecordCorrectionTarget, value: string, note: string) => void; onClearAll: (eventId: string) => void }) {
  const { interfacePalette } = useThemeContext();
  const [step, setStep] = useState<RecordCorrectionStep>("detail");
  const [target, setTarget] = useState<RecordCorrectionTarget | null>(null);
  const [symbolId, setSymbolId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const event = useMemo(() => row?.atBatEventId ? game?.events.find((candidate) => candidate.id === row.atBatEventId) : undefined, [game?.events, row?.atBatEventId]);
  const editable = Boolean(row && event && row.kind === "atbat" && game && isRecordCorrectionUnlocked(game, event));
  const selectedTarget = RECORD_CORRECTION_TARGETS.find((candidate) => candidate.id === target);
  const selectedSymbol = WASEDA_SYMBOL_REFERENCE.find((item) => item.id === symbolId);
  const availableSymbols = target ? WASEDA_SYMBOL_REFERENCE.filter((item) => RECORD_CORRECTION_SYMBOL_IDS[target].includes(item.id)) : [];

  useEffect(() => {
    if (!row) return;
    setStep("detail");
    setTarget(null);
    setSymbolId(null);
    setContent("");
    setNote(event?.recordCorrection?.note ?? "");
  }, [event?.recordCorrection?.note, row?.id]);

  const startTarget = (nextTarget: RecordCorrectionTarget) => {
    setTarget(nextTarget);
    setSymbolId(null);
    setContent(getRecordCorrectionValue(event?.recordCorrection, nextTarget));
    setNote(event?.recordCorrection?.note ?? "");
    setStep("symbol");
  };

  const back = () => {
    if (step === "content") { setStep("symbol"); return; }
    if (step === "symbol") { setStep("target"); return; }
    if (step === "target") { setStep("detail"); return; }
    onClose();
  };

  const confirmSave = () => {
    if (!event || !target) return;
    const mark = selectedSymbol?.mark ?? "";
    const freeText = content.trim();
    const normalizedValue = mark && freeText && freeText !== getRecordCorrectionValue(event.recordCorrection, target) ? `${mark} ${freeText}` : mark || freeText;
    if (!normalizedValue) {
      Alert.alert("請選擇符號或填寫內容", "此補正只會改寫所選紀錄區的顯示內容，不會變動原始打席或統計。 ");
      return;
    }
    onSave(event.id, target, normalizedValue, note);
    setStep("detail");
    setSymbolId(null);
    setContent("");
  };

  const clearTarget = () => {
    if (!event || !target || !getRecordCorrectionValue(event.recordCorrection, target)) return;
    Alert.alert("清除本區補正", "將回復此區的原始紀錄格顯示；不會變動比分、壘包、出局或統計。", [
      { text: "取消", style: "cancel" },
      { text: "清除", style: "destructive", onPress: () => { onSave(event.id, target, "", note); setStep("detail"); } },
    ]);
  };

  const hasCorrection = Boolean(event?.recordCorrection);
  const background = { backgroundColor: interfacePalette.background, borderColor: interfacePalette.border };
  const quietButton = { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border };
  const titleText = { color: interfacePalette.foreground };
  const mutedText = { color: interfacePalette.muted };
  const sectionTitle = step === "detail" ? "個人紀錄" : step === "target" ? "選擇修正區域" : step === "symbol" ? "選擇早稻田符號" : "填寫補正內容";

  return <Modal visible={Boolean(row)} animationType="fade" transparent onRequestClose={back}><View style={styles.modalBackdrop}><View style={[styles.detailModalSheet, styles.recordCorrectionSheet, background]}><View style={styles.modalHeader}><View style={styles.recordCorrectionHeaderCopy}><Text style={[styles.modalTitle, titleText]}>{sectionTitle}</Text><Text style={[styles.modalSubtitle, mutedText]}>{row?.inning}{row?.half === "away" ? "上" : "下"} · {row?.teamName}</Text></View><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="取消個人紀錄修正" style={({ pressed }) => [styles.recordCorrectionHeaderButton, quietButton, pressed && styles.pressed]}><Text style={[styles.recordCorrectionHeaderButtonText, { color: interfacePalette.primary }]}>取消</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.recordCorrectionScrollContent} keyboardShouldPersistTaps="handled">{step === "detail" ? <><Text style={[styles.detailPlayer, titleText]}>{row?.playerLabel}</Text><Text style={[styles.detailNotation, { color: interfacePalette.primary }]}>{row?.notation}</Text><Text style={[styles.detailResult, mutedText]}>{row?.resultLabel} · {row?.detail}</Text><View style={[styles.detailLineList, background]}>{row?.detailLines.map((line) => <Text key={line} style={[styles.detailLine, mutedText]}>· {line}</Text>)}</View>{event?.recordCorrection ? <View style={[styles.recordCorrectionSafetyNote, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}><Text style={[styles.recordCorrectionSafetyTitle, { color: interfacePalette.primary }]}>已有顯示補正</Text><Text style={[styles.recordCorrectionSafetyText, mutedText]}>更新於 {new Date(event.recordCorrection.revisedAt).toLocaleString("zh-TW")}；可重新選區修改或清除並回到原始顯示。</Text></View> : null}{editable ? <><View style={[styles.recordCorrectionSafetyNote, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}><Text style={[styles.recordCorrectionSafetyTitle, { color: interfacePalette.primary }]}>統計中性補正</Text><Text style={[styles.recordCorrectionSafetyText, mutedText]}>此流程只校正早稻田紀錄格的顯示符號；不會改變比分、壘包、出局、逐球或個人打擊／投球統計。</Text></View><View style={styles.recordCorrectionFooter}><Button label="修改個人紀錄" onPress={() => setStep("target")} fluid />{hasCorrection && event ? <Button label="清除全部補正" variant="danger" onPress={() => Alert.alert("清除全部補正", "將回復此打席所有補正區的原始顯示；原始結果與統計不會變動。", [{ text: "取消", style: "cancel" }, { text: "清除全部", style: "destructive", onPress: () => { onClearAll(event.id); setStep("detail"); } }])} fluid /> : null}</View></> : <View style={[styles.recordCorrectionLockNote, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.warning }]}><Text style={[styles.recordCorrectionSafetyTitle, { color: interfacePalette.warning }]}>目前僅供查看</Text><Text style={[styles.recordCorrectionSafetyText, mutedText]}>{row?.kind !== "atbat" ? "只有整體紀錄表中的單一打席格可補正。" : "為避免進行中打者或跑者資料不同步，請在本半局結束或整場比賽結束後再修改。"}</Text></View>}<Button label="完成" onPress={onClose} variant="secondary" fluid /></> : null}{step === "target" ? <><Text style={[styles.recordCorrectionStepHint, mutedText]}>選擇要顯示補正的位置；每次只修改一區，完成後可回來調整其他區域。</Text><View style={styles.recordCorrectionChoiceGrid}>{RECORD_CORRECTION_TARGETS.map((candidate) => <Pressable key={candidate.id} onPress={() => startTarget(candidate.id)} accessibilityRole="button" accessibilityLabel={`選擇${candidate.title}`} style={({ pressed }) => [styles.recordCorrectionChoice, quietButton, pressed && styles.pressed]}><Text style={[styles.recordCorrectionChoiceTitle, titleText]}>{candidate.title}</Text><Text style={[styles.recordCorrectionChoiceHint, mutedText]}>{candidate.hint}</Text>{getRecordCorrectionValue(event?.recordCorrection, candidate.id) ? <Text style={[styles.recordCorrectionCurrentValue, { color: interfacePalette.primary }]}>目前：{getRecordCorrectionValue(event?.recordCorrection, candidate.id)}</Text> : null}</Pressable>)}</View><Button label="上一步" onPress={back} variant="secondary" fluid /></> : null}{step === "symbol" && target ? <><Text style={[styles.recordCorrectionStepHint, mutedText]}>{selectedTarget?.title}：只列出目前 App 已支援且適合該區的符號。</Text><View style={styles.recordCorrectionChoiceGrid}>{availableSymbols.map((item) => <Pressable key={item.id} onPress={() => { setSymbolId(item.id); setContent(""); setStep("content"); }} accessibilityRole="button" accessibilityLabel={`選擇${item.title}`} style={({ pressed }) => [styles.recordCorrectionChoice, quietButton, pressed && styles.pressed]}><Text style={[styles.recordCorrectionSymbolMark, { color: item.tone === "red" ? interfacePalette.error : item.tone === "blue" ? interfacePalette.primary : interfacePalette.foreground }]}>{item.mark}</Text><Text style={[styles.recordCorrectionChoiceTitle, titleText]}>{item.title}</Text><Text style={[styles.recordCorrectionChoiceHint, mutedText]}>{item.placement}</Text></Pressable>)}</View>{getRecordCorrectionValue(event?.recordCorrection, target) ? <Button label="清除本區補正" onPress={clearTarget} variant="danger" fluid /> : null}<Button label="上一步" onPress={back} variant="secondary" fluid /></> : null}{step === "content" && target ? <><Text style={[styles.recordCorrectionStepHint, mutedText]}>已選：{selectedSymbol?.mark ?? "自訂內容"} {selectedSymbol?.title ?? ""}。可補上方向、守備傳接或必要說明。</Text><Text style={[styles.inputLabel, titleText]}>此區顯示內容</Text><TextInput value={content} onChangeText={setContent} placeholder={selectedSymbol ? `例如：${selectedSymbol.example}` : "輸入顯示內容"} placeholderTextColor={interfacePalette.muted} style={[styles.formInput, styles.recordCorrectionInput, { color: interfacePalette.foreground, backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]} /><Text style={[styles.inputLabel, titleText]}>補正備註（選填）</Text><TextInput value={note} onChangeText={setNote} placeholder="例如：依紙本紀錄核對" placeholderTextColor={interfacePalette.muted} style={[styles.formInput, styles.recordCorrectionInput, { color: interfacePalette.foreground, backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]} /><View style={[styles.recordCorrectionSafetyNote, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}><Text style={[styles.recordCorrectionSafetyText, mutedText]}>確認後僅寫入顯示覆蓋資料，原始 result、runsScored、outsBefore、runnerAdvances 與 pitches 不會被修改。</Text></View><Button label="確認並保存" onPress={confirmSave} fluid /><Button label="上一步" onPress={back} variant="secondary" fluid /></> : null}</ScrollView></View></View></Modal>;
}

function GameRecordDetailModal({ row, game, onClose, onSave, onSaveBatch, onReplaceAll, onClearAll, initialStep = "detail" }: { row: GameRecordRow | null; game: Game | undefined; onClose: () => void; onSave: (eventId: string, target: RecordCorrectionTarget, value: string, note: string) => void; onSaveBatch: (eventId: string, corrections: Array<{ target: RecordCorrectionTarget; value: string }>, note: string, replaceAll: boolean) => void; onReplaceAll: (eventId: string, target: RecordCorrectionTarget, value: string, note: string) => void; onClearAll: (eventId: string) => void; initialStep?: "detail" | "target" }) {
  const { interfacePalette } = useThemeContext();
  const [step, setStep] = useState<RecordCorrectionStep>("detail");
  const [correctionMode, setCorrectionMode] = useState<AtBatCorrectionMode | null>(null);
  const [target, setTarget] = useState<RecordCorrectionTarget | null>(null);
  const [outerStage, setOuterStage] = useState<"ballQuality" | "result" | "fielding" | null>(null);
  const [outerParts, setOuterParts] = useState({ ballQuality: "", direction: "", result: "" });
  const [fieldingSequence, setFieldingSequence] = useState("");
  const [symbolId, setSymbolId] = useState<string | null>(null);
  const [otherOption, setOtherOption] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [note, setNote] = useState("");
  const [pitchDraft, setPitchDraft] = useState<PitchOutcome[]>([]);
  const [pendingValue, setPendingValue] = useState("");
  const [pendingCorrections, setPendingCorrections] = useState<Array<{ target: RecordCorrectionTarget; value: string }>>([]);
  const event = useMemo(() => row?.atBatEventId ? game?.events.find((candidate) => candidate.id === row.atBatEventId) : undefined, [game?.events, row?.atBatEventId]);
  const editable = Boolean(row && event && row.kind === "atbat" && game && isRecordCorrectionUnlocked(game, event));
  const lockReason = game && event ? getRecordCorrectionLockReason(game, event) : undefined;
  const selectedTarget = RECORD_CORRECTION_TARGETS.find((candidate) => candidate.id === target);
  const selectedSymbol = WASEDA_SYMBOL_REFERENCE.find((item) => item.id === symbolId);
  const availableTargets = getRecordCorrectionTargetsForMode(correctionMode);
  const availableSymbols = target ? WASEDA_SYMBOL_REFERENCE.filter((item) => getRecordCorrectionSymbolIdsForMode(target, correctionMode, outerStage).includes(item.id)) : [];
  const pitchPreview = useMemo(() => event ? getPitchCorrectionPreview(pitchDraft, event.result) : undefined, [event?.result, pitchDraft]);
  const correctionFieldingSuggestions = useMemo(() => getFieldingSequenceSuggestions({
    battedBallPosition: outerParts.direction.match(/[1-9]/)?.[0],
    result: undefined,
    runners: { first: null, second: null, third: null },
    games: game ? [game] : [],
  }), [game, outerParts.direction]);
  const hasCorrection = Boolean(event?.recordCorrection);
  const background = { backgroundColor: interfacePalette.background, borderColor: interfacePalette.border };
  const quietButton = { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border };
  const titleText = { color: interfacePalette.foreground };
  const mutedText = { color: interfacePalette.muted };

  useEffect(() => {
    if (!row) return;
    setStep(initialStep === "target" ? "mode" : initialStep);
    setCorrectionMode(null);
    setTarget(null);
    setOuterStage(null);
    setOuterParts({ ballQuality: "", direction: "", result: "" });
    setFieldingSequence("");
    setSymbolId(null);
    setOtherOption(null);
    setContent("");
    setNote(event?.recordCorrection?.note ?? "");
    setPitchDraft([]);
    setPendingValue("");
    setPendingCorrections([]);
  }, [event?.recordCorrection?.note, initialStep, row?.id]);

  const startTarget = (nextTarget: RecordCorrectionTarget) => {
    setTarget(nextTarget);
    setOuterStage(nextTarget === "outer" && correctionMode !== "runnerOnly" ? "ballQuality" : null);
    setOuterParts({ ballQuality: "", direction: "", result: "" });
    setFieldingSequence("");
    setSymbolId(null);
    setOtherOption(null);
    setContent(getRecordCorrectionValue(event?.recordCorrection, nextTarget));
    setNote(event?.recordCorrection?.note ?? "");
    setPitchDraft([]);
    setPendingValue("");
    setPendingCorrections([]);
    setStep(nextTarget === "pitch" ? "pitchBatch" : nextTarget === "other" ? "other" : "symbol");
  };

  const startMode = (nextMode: AtBatCorrectionMode) => {
    setCorrectionMode(nextMode);
    setTarget(null);
    setOuterStage(null);
    setOuterParts({ ballQuality: "", direction: "", result: "" });
    setFieldingSequence("");
    setSymbolId(null);
    setOtherOption(null);
    setContent("");
    setPitchDraft([]);
    setPendingValue("");
    setPendingCorrections([]);
    setStep("target");
  };

  const back = () => {
    if (step === "preview") {
      if (pendingCorrections.some((correction) => correction.target === "outer")) { setTarget("outer"); setOuterStage("fielding"); setStep("symbol"); return; }
      setStep(target === "pitch" ? "pitchBatch" : "content");
      return;
    }
    if (step === "content") { setStep(target === "other" ? "other" : "symbol"); return; }
    if (step === "outerDirection") { setOuterStage("ballQuality"); setStep("symbol"); return; }
    if (step === "pitchBatch") { setStep("target"); return; }
    if (step === "symbol" && target === "outer" && correctionMode !== "runnerOnly") {
      if (outerStage === "fielding") { setOuterStage("result"); return; }
      if (outerStage === "result") { setStep("outerDirection"); return; }
      if (pitchDraft.length > 0) { setTarget("pitch"); setStep("pitchBatch"); return; }
      setStep("target");
      return;
    }
    if (step === "symbol" || step === "other") { setStep("target"); return; }
    if (step === "target") { setStep("mode"); return; }
    if (step === "mode") { setCorrectionMode(null); setStep("detail"); return; }
    onClose();
  };

  const selectSymbol = (nextSymbolId: string) => {
    const nextSymbol = WASEDA_SYMBOL_REFERENCE.find((item) => item.id === nextSymbolId);
    if (!nextSymbol) return;
    if (target === "outer" && correctionMode !== "runnerOnly" && outerStage === "ballQuality") {
      setOuterParts((current) => ({ ...current, ballQuality: nextSymbol.mark }));
      setOuterStage("result");
      setSymbolId(null);
      setStep("outerDirection");
      return;
    }
    if (target === "outer" && correctionMode !== "runnerOnly" && outerStage === "result") {
      setOuterParts((current) => ({ ...current, result: nextSymbol.mark }));
      setOuterStage("fielding");
      setSymbolId(null);
      setStep("symbol");
      return;
    }
    if (target === "outer" && correctionMode !== "runnerOnly" && outerStage === "fielding") {
      setSymbolId(nextSymbolId);
      setFieldingSequence(nextSymbol.mark);
      return;
    }
    setSymbolId(nextSymbolId);
    setContent("");
    setStep("content");
  };

  const preparePreview = () => {
    if (!event || !target) return;
    if (target === "pitch") {
      if (!pitchPreview || pitchPreview.error) {
        Alert.alert("逐球欄尚未符合打席結束", pitchPreview?.error ?? "請重新編排逐球符號。 ");
        return;
      }
      setPendingValue(pitchPreview.value);
      setPendingCorrections([{ target: "pitch", value: pitchPreview.value }]);
      setStep("preview");
      return;
    }
    const freeText = content.trim();
    const mark = selectedSymbol?.mark ?? "";
    const currentValue = getRecordCorrectionValue(event.recordCorrection, target);
    const normalizedValue = target === "other"
      ? [otherOption, freeText].filter(Boolean).join(freeText ? "：" : "")
      : target === "outer" && correctionMode !== "runnerOnly" && outerStage === "fielding"
        ? [outerParts.ballQuality, outerParts.direction.trim(), outerParts.result, fieldingSequence.trim()].filter(Boolean).join(" ")
      : mark && freeText && freeText !== currentValue && !freeText.startsWith(mark) ? `${mark} ${freeText}` : mark || freeText;
    if (!normalizedValue) {
      Alert.alert("請選擇符號或填寫內容", "這項補正只會更新所選紀錄區的顯示，不會改變原始打席或統計。");
      return;
    }
    const structuredOuterCorrections = target === "outer" && correctionMode !== "runnerOnly" && outerStage === "fielding"
      ? [
        { target: "battedBallTop" as const, value: [outerParts.ballQuality, outerParts.direction.trim()].filter(Boolean).join(" ") },
        { target: "rightTop" as const, value: outerParts.result },
        { target: "rightBottom" as const, value: fieldingSequence.trim() },
      ]
      : [];
    setPendingValue(normalizedValue);
    setPendingCorrections([
      ...(pitchDraft.length && pitchPreview && !pitchPreview.error ? [{ target: "pitch" as const, value: pitchPreview.value }] : []),
      { target, value: normalizedValue },
      ...structuredOuterCorrections,
    ]);
    setStep("preview");
  };

  const confirmSave = () => {
    if (!event || !target || !pendingValue) return;
    if (pendingCorrections.length > 1) onSaveBatch(event.id, pendingCorrections, note, correctionMode === "replaceAll");
    else if (correctionMode === "replaceAll") onReplaceAll(event.id, target, pendingValue, note);
    else onSave(event.id, target, pendingValue, note);
    setStep("detail");
    setCorrectionMode(null);
    setSymbolId(null);
    setOtherOption(null);
    setContent("");
    setPitchDraft([]);
    setPendingValue("");
    setPendingCorrections([]);
  };

  const clearTarget = () => {
    if (!event || !target || !getRecordCorrectionValue(event.recordCorrection, target)) return;
    Alert.alert("清除本區補正", "將回復此區的原始紀錄格顯示；不會變動比分、壘包、出局或統計。", [
      { text: "取消", style: "cancel" },
      { text: "清除", style: "destructive", onPress: () => { onSave(event.id, target, "", note); setStep("detail"); } },
    ]);
  };

  const sectionTitle = step === "detail" ? "個人紀錄" : step === "mode" ? "選擇修改方式" : step === "target" ? "選擇修正區域" : step === "outerDirection" ? "填寫擊球方向" : step === "symbol" ? "選擇早稻田符號" : step === "other" ? "選擇其他註記" : step === "pitchBatch" ? "編排逐球欄" : step === "preview" ? "預覽修改結果" : "填寫補正內容";
  const lockMessage = row?.kind !== "atbat"
    ? "此列是逐局或摘要資訊，不對應單一已完成打席；請從整體紀錄表的個人打席格開啟修改。"
    : lockReason ?? "找不到此打席的安全修改狀態，暫時只提供查看。";

  return (
    <Modal visible={Boolean(row)} animationType="fade" transparent onRequestClose={back}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.detailModalSheet, styles.recordCorrectionSheet, background]}>
          <View style={styles.modalHeader}>
            <View style={styles.recordCorrectionHeaderCopy}>
              <Text style={[styles.modalTitle, titleText]}>{sectionTitle}</Text>
              <Text style={[styles.modalSubtitle, mutedText]}>{row?.inning}{row?.half === "away" ? "上" : "下"} · {row?.teamName}</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="取消個人紀錄修正" style={({ pressed }) => [styles.recordCorrectionHeaderButton, quietButton, pressed && styles.pressed]}>
              <Text style={[styles.recordCorrectionHeaderButtonText, { color: interfacePalette.primary }]}>取消</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.recordCorrectionScrollContent} keyboardShouldPersistTaps="handled">
            {step === "detail" ? <>
              <Text style={[styles.detailPlayer, titleText]}>{row?.playerLabel}</Text>
              <Text style={[styles.detailNotation, { color: interfacePalette.primary }]}>{row?.notation}</Text>
              <Text style={[styles.detailResult, mutedText]}>{row?.resultLabel} · {row?.detail}</Text>
              <View style={[styles.detailLineList, background]}>{row?.detailLines.map((line) => <Text key={line} style={[styles.detailLine, mutedText]}>· {line}</Text>)}</View>
              {event?.recordCorrection ? <View style={[styles.recordCorrectionSafetyNote, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}><Text style={[styles.recordCorrectionSafetyTitle, { color: interfacePalette.primary }]}>已有顯示補正</Text><Text style={[styles.recordCorrectionSafetyText, mutedText]}>更新於 {new Date(event.recordCorrection.revisedAt).toLocaleString("zh-TW")}；可重新選區修改或清除並回到原始顯示。</Text></View> : null}
              {editable ? <>
                <View style={[styles.recordCorrectionSafetyNote, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}>
                  <Text style={[styles.recordCorrectionSafetyTitle, { color: interfacePalette.primary }]}>統計中性補正</Text>
                  <Text style={[styles.recordCorrectionSafetyText, mutedText]}>依逐球欄、外圈、內圈或其他區補足早稻田書寫；只更新顯示，不會改變比分、壘包、出局、逐球或個人打擊／投球統計。</Text>
                </View>
                <View style={styles.recordCorrectionFooter}>
                  <Button label="修改個人紀錄" onPress={() => setStep("mode")} fluid />
                  {hasCorrection && event ? <Button label="清除全部補正" variant="danger" onPress={() => Alert.alert("清除全部補正", "將回復此打席所有補正區的原始顯示；原始結果與統計不會變動。", [{ text: "取消", style: "cancel" }, { text: "清除全部", style: "destructive", onPress: () => { onClearAll(event.id); setStep("detail"); } }])} fluid /> : null}
                </View>
              </> : <View style={[styles.recordCorrectionLockNote, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.warning }]}><Text style={[styles.recordCorrectionSafetyTitle, { color: interfacePalette.warning }]}>目前僅供查看</Text><Text style={[styles.recordCorrectionSafetyText, mutedText]}>{lockMessage}</Text></View>}
              <Button label="完成" onPress={onClose} variant="secondary" fluid />
            </> : null}
            {step === "mode" ? <>
              <Text style={[styles.recordCorrectionStepHint, mutedText]}>此格已有正式打席資料。請先選擇補正方式；三種方式都只會更新整體紀錄表顯示，絕不刪除正式逐球、跑壘、比分或統計。</Text>
              <View style={styles.recordCorrectionChoiceGrid}>{AT_BAT_CORRECTION_MODES.map((option) => <Pressable key={option.id} onPress={() => startMode(option.id)} accessibilityRole="button" accessibilityLabel={`選擇${option.title}`} style={({ pressed }) => [styles.recordCorrectionChoice, quietButton, pressed && styles.pressed]}><Text style={[styles.recordCorrectionChoiceTitle, titleText]}>{option.title}</Text><Text style={[styles.recordCorrectionChoiceHint, mutedText]}>{option.hint}</Text></Pressable>)}</View>
              <Button label="上一步" onPress={back} variant="secondary" fluid />
            </> : null}
            {step === "target" ? <>
              <Text style={[styles.recordCorrectionStepHint, mutedText]}>{correctionMode === "runnerOnly" ? "跑壘紀錄修改只可寫入外圈的 SB、CS、PO、WP、PB、BK 與進壘等符號。" : correctionMode === "replaceAll" ? "全刪除修改會在最後確認時清空原有顯示覆蓋，再依現場記錄順序寫入新內容。" : "依現場記錄的書寫位置選區。每次只改一區，隨時可按「上一步」返回；原始比賽事件與統計一律不會改動。"}</Text>
              <View style={styles.recordCorrectionChoiceGrid}>{availableTargets.map((candidate) => <Pressable key={candidate.id} onPress={() => startTarget(candidate.id)} accessibilityRole="button" accessibilityLabel={`選擇${candidate.title}`} style={({ pressed }) => [styles.recordCorrectionChoice, quietButton, pressed && styles.pressed]}><Text style={[styles.recordCorrectionChoiceTitle, titleText]}>{candidate.title}</Text><Text style={[styles.recordCorrectionChoiceHint, mutedText]}>{candidate.hint}</Text>{getRecordCorrectionValue(event?.recordCorrection, candidate.id) ? <Text style={[styles.recordCorrectionCurrentValue, { color: interfacePalette.primary }]}>目前：{getRecordCorrectionValue(event?.recordCorrection, candidate.id)}</Text> : null}</Pressable>)}</View>
              <Button label="上一步" onPress={back} variant="secondary" fluid />
            </> : null}
            {step === "symbol" && target ? <>
              {target === "outer" && correctionMode !== "runnerOnly" ? <View style={[styles.recordCorrectionSafetyNote, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}><Text style={[styles.recordCorrectionSafetyTitle, { color: interfacePalette.primary }]}>擊出／觸擊後打擊事件</Text><View style={styles.battedBallStepRow}>{[["1", "球性", outerStage === "ballQuality"], ["2", "方向／位置", Boolean(outerParts.direction.trim())], ["3", "結果", outerStage === "result"], ["4", "傳球事件", outerStage === "fielding"]].map(([number, label, active]) => <View key={String(number)} style={[styles.battedBallStepChip, active && styles.battedBallStepChipActive]}><Text style={[styles.battedBallStepIndex, active && styles.battedBallStepIndexActive]}>{number}</Text><Text style={[styles.battedBallStepText, active && styles.battedBallStepTextActive]}>{label}</Text></View>)}</View></View> : null}
              <Text style={[styles.recordCorrectionStepHint, mutedText]}>{target === "pitch" ? "逐球欄依序補入每一球；最後一球為擊出球時，會接續開啟與現場紀錄相同的球性、方向、結果與傳接工作台。" : target === "inner" ? "內圈只選得分、出局數、殘壘或不死三振等菱形中央資訊。" : correctionMode === "runnerOnly" ? "跑壘紀錄修改只列出外圈跑壘符號。" : outerStage === "ballQuality" ? "1／4 選擇球性。" : outerStage === "result" ? "3／4 選擇打席結果或出局結果。" : "4／4 選擇或輸入傳接球事件；確認後會固定顯示在打席格右下角，不與球性、方向或內圈混用。"}</Text>
              {target === "outer" && correctionMode !== "runnerOnly" && outerStage === "fielding" ? <><FieldingSequenceButtonEditor value={fieldingSequence} suggestions={correctionFieldingSuggestions} hitDirection={outerParts.direction} onChange={setFieldingSequence} onPreset={(suggestion) => setFieldingSequence(suggestion.sequence)} /><View style={[styles.recordCorrectionSafetyNote, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}><Text style={[styles.recordCorrectionSafetyText, mutedText]}>即時預覽：{[outerParts.ballQuality, outerParts.direction, outerParts.result, fieldingSequence].filter(Boolean).join(" ") || "尚待完成"}</Text></View><Button label="完成打擊事件，預覽修改結果" onPress={preparePreview} fluid /></> : <View style={styles.recordCorrectionChoiceGrid}>{availableSymbols.map((item) => <Pressable key={item.id} onPress={() => selectSymbol(item.id)} accessibilityRole="button" accessibilityLabel={`選擇${item.title}`} style={({ pressed }) => [styles.recordCorrectionChoice, quietButton, pressed && styles.pressed]}><Text style={[styles.recordCorrectionSymbolMark, { color: item.tone === "red" ? interfacePalette.error : item.tone === "blue" ? interfacePalette.primary : interfacePalette.foreground }]}>{item.mark}</Text><Text style={[styles.recordCorrectionChoiceTitle, titleText]}>{item.title}</Text><Text style={[styles.recordCorrectionChoiceHint, mutedText]}>{item.placement}</Text></Pressable>)}</View>}
              {getRecordCorrectionValue(event?.recordCorrection, target) ? <Button label="清除本區補正" onPress={clearTarget} variant="danger" fluid /> : null}
              <Button label="上一步" onPress={back} variant="secondary" fluid />
            </> : null}
            {step === "outerDirection" ? <>
              <Text style={[styles.recordCorrectionStepHint, mutedText]}>2／4 選擇擊球方向／位置，再進入結果與傳接球事件。此方向卡與現場紀錄使用相同守備代號。</Text>
              <View style={styles.fieldingSymbolNumberRow}>{FIELD_POSITIONS.map((position) => <Pressable key={position.number} onPress={() => setOuterParts((current) => ({ ...current, direction: `${position.number} ${position.label}` }))} accessibilityRole="button" accessibilityLabel={`選擇${position.number}${position.label}方向`} style={({ pressed }) => [styles.fieldingSymbolButton, outerParts.direction.startsWith(position.number) && { backgroundColor: "#DBEAFE", borderColor: BRAND.blue }, pressed && styles.pressed]}><Text style={styles.fieldingSymbolCode}>{position.number}</Text><Text style={styles.fieldingSymbolLabel}>{position.label}</Text></Pressable>)}</View>
              <Text style={[styles.inputLabel, titleText]}>擊球方向</Text>
              <TextInput value={outerParts.direction} onChangeText={(direction) => setOuterParts((current) => ({ ...current, direction }))} placeholder="例如：左外野、游擊方向、右中間" placeholderTextColor={interfacePalette.muted} style={[styles.formInput, styles.recordCorrectionInput, { color: interfacePalette.foreground, backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]} />
              <Button label="下一步：選打席結果" onPress={() => { if (!outerParts.direction.trim()) { Alert.alert("請填寫擊球方向", "請先補上方向，才可依現場記錄順序選擇結果。 "); return; } setStep("symbol"); }} fluid />
              <Button label="上一步" onPress={back} variant="secondary" fluid />
            </> : null}
            {step === "other" ? <>
              <Text style={[styles.recordCorrectionStepHint, mutedText]}>選擇要顯示的非打席註記。這裡只補足紀錄格可讀性，不會建立、刪除或改寫正式代打、代跑、換投與半局事件。</Text>
              <View style={styles.recordCorrectionChoiceGrid}>{RECORD_CORRECTION_OTHER_OPTIONS.map((option) => <Pressable key={option} onPress={() => { setOtherOption(option); setContent(""); setStep("content"); }} accessibilityRole="button" accessibilityLabel={`選擇${option}註記`} style={({ pressed }) => [styles.recordCorrectionChoice, quietButton, pressed && styles.pressed]}><Text style={[styles.recordCorrectionChoiceTitle, titleText]}>{option}</Text><Text style={[styles.recordCorrectionChoiceHint, mutedText]}>{option === "局結束" ? "補充該格後的局末說明。" : `補充${option}相關的人員或時點。`}</Text></Pressable>)}</View>
              {getRecordCorrectionValue(event?.recordCorrection, "other") ? <Button label="清除本區補正" onPress={clearTarget} variant="danger" fluid /> : null}
              <Button label="上一步" onPress={back} variant="secondary" fluid />
            </> : null}
            {step === "pitchBatch" && target === "pitch" ? <>
              <Text style={[styles.recordCorrectionStepHint, mutedText]}>一次編排此打席的所有逐球符號。補正只影響整體紀錄表的顯示；既有正式逐球、比分與統計一律不變。最後一顆必須與既有打席結果相符。</Text>
              <View style={[styles.recordCorrectionSafetyNote, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}>
                <Text style={[styles.recordCorrectionSafetyTitle, { color: interfacePalette.primary }]}>本次逐球草稿</Text>
                <Text style={[styles.recordCorrectionSafetyText, mutedText]}>{pitchPreview?.value || "尚未加入逐球符號"}</Text>
                {pitchPreview ? <Text style={[styles.recordCorrectionSafetyText, { color: pitchPreview.error ? interfacePalette.warning : interfacePalette.muted }]}>球數：{pitchPreview.balls} 壞／{pitchPreview.strikes} 好{pitchPreview.error ? `；${pitchPreview.error}` : ""}</Text> : null}
              </View>
              <View style={styles.recordCorrectionChoiceGrid}>{PITCH_CORRECTION_OPTIONS.map((option) => <Pressable key={option.outcome} onPress={() => setPitchDraft((current) => [...current, option.outcome])} accessibilityRole="button" accessibilityLabel={`加入${option.title}`} style={({ pressed }) => [styles.recordCorrectionChoice, quietButton, pressed && styles.pressed]}><Text style={[styles.recordCorrectionSymbolMark, titleText]}>{option.mark}</Text><Text style={[styles.recordCorrectionChoiceTitle, titleText]}>{option.title}</Text></Pressable>)}</View>
              <View style={styles.recordCorrectionFooter}>
                <Button label="刪除最後一顆" onPress={() => setPitchDraft((current) => current.slice(0, -1))} variant="secondary" fluid />
                <Button label="清空這次逐球" onPress={() => setPitchDraft([])} variant="secondary" fluid />
              </View>
              <Text style={[styles.inputLabel, titleText]}>補正備註（選填）</Text>
              <TextInput value={note} onChangeText={setNote} placeholder="例如：依紙本紀錄核對" placeholderTextColor={interfacePalette.muted} style={[styles.formInput, styles.recordCorrectionInput, { color: interfacePalette.foreground, backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]} />
              {getRecordCorrectionValue(event?.recordCorrection, target) ? <Button label="清除本區補正" onPress={clearTarget} variant="danger" fluid /> : null}
              <Button label={pitchPreview && !pitchPreview.error && pitchPreview.terminal === "in-play" ? "下一步：擊球後球性" : "預覽修改結果"} onPress={() => { if (pitchPreview && !pitchPreview.error && pitchPreview.terminal === "in-play") { setTarget("outer"); setOuterStage("ballQuality"); setSymbolId(null); setStep("symbol"); return; } preparePreview(); }} fluid />
              <Button label="上一步" onPress={back} variant="secondary" fluid />
            </> : null}
            {step === "content" && target ? <>
              <Text style={[styles.recordCorrectionStepHint, mutedText]}>{target === "other" ? `已選：${otherOption ?? "其他註記"}。可補上人員、守位或時點。` : `已選：${selectedSymbol?.mark ?? "自訂內容"} ${selectedSymbol?.title ?? ""}。${target === "outer" ? "可依序補上球性、方向、結果、跑壘與傳球事件。" : "可補上必要說明。"}`}</Text>
              <Text style={[styles.inputLabel, titleText]}>{target === "other" ? "其他註記內容" : "此區顯示內容"}</Text>
              <TextInput value={content} onChangeText={setContent} placeholder={target === "other" ? "例如：9 號張三代跑一壘" : selectedSymbol ? `例如：${selectedSymbol.example}` : "輸入顯示內容"} placeholderTextColor={interfacePalette.muted} style={[styles.formInput, styles.recordCorrectionInput, { color: interfacePalette.foreground, backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]} />
              <Text style={[styles.inputLabel, titleText]}>補正備註（選填）</Text>
              <TextInput value={note} onChangeText={setNote} placeholder="例如：依紙本紀錄核對" placeholderTextColor={interfacePalette.muted} style={[styles.formInput, styles.recordCorrectionInput, { color: interfacePalette.foreground, backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]} />
              <View style={[styles.recordCorrectionSafetyNote, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}><Text style={[styles.recordCorrectionSafetyText, mutedText]}>下一步會先預覽修改前後內容；原始 result、runsScored、outsBefore、runnerAdvances 與 pitches 不會被修改。</Text></View>
              <Button label="預覽修改結果" onPress={preparePreview} fluid />
              <Button label="上一步" onPress={back} variant="secondary" fluid />
            </> : null}
            {step === "preview" && target ? <>
              <Text style={[styles.recordCorrectionStepHint, mutedText]}>請再次核對本區顯示。按下確認才會寫入補正；返回調整不會留下任何變更。</Text>
              <View style={[styles.recordCorrectionSafetyNote, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}>
                <Text style={[styles.recordCorrectionSafetyTitle, { color: interfacePalette.muted }]}>修改前</Text>
                <Text style={[styles.recordCorrectionSafetyText, mutedText]}>{getRecordCorrectionValue(event?.recordCorrection, target) || "（此區尚無補正顯示）"}</Text>
                <Text style={[styles.recordCorrectionSafetyTitle, { color: interfacePalette.primary }]}>修改後</Text>
                <Text style={[styles.recordCorrectionSafetyText, titleText]}>{pendingValue}</Text>
                {target === "pitch" && pitchPreview ? <Text style={[styles.recordCorrectionSafetyText, mutedText]}>逐球合計：{pitchPreview.balls} 壞／{pitchPreview.strikes} 好；以{pitchPreview.terminal === "strikeout" ? "三振" : pitchPreview.terminal === "walk" ? "四壞" : "擊出球"}結束。</Text> : null}
                {correctionMode === "replaceAll" ? <><Text style={[styles.recordCorrectionSafetyTitle, { color: interfacePalette.warning }]}>全刪除修改</Text><Text style={[styles.recordCorrectionSafetyText, mutedText]}>確認後會清除這一格其他區域既有的顯示補正，再保存目前預覽的新內容；正式事件資料完全不會被刪除。</Text></> : null}
                {note.trim() ? <><Text style={[styles.recordCorrectionSafetyTitle, { color: interfacePalette.muted }]}>補正備註</Text><Text style={[styles.recordCorrectionSafetyText, mutedText]}>{note.trim()}</Text></> : null}
              </View>
              <View style={[styles.recordCorrectionSafetyNote, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}><Text style={[styles.recordCorrectionSafetyText, mutedText]}>保存後僅更新單場整體紀錄的顯示覆蓋；不會與其他球員、現場逐球、壘包、比分或統計同動。</Text></View>
              <Button label="確認保存這次修改" onPress={confirmSave} fluid />
              <Button label="返回調整" onPress={back} variant="secondary" fluid />
            </> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SymbolHelpModal({ help, onClose }: { help: SymbolHelp | null; onClose: () => void }) {
  const toneStyle = help?.tone === "red" ? styles.symbolHelpMarkRed : help?.tone === "blue" ? styles.symbolHelpMarkBlue : styles.symbolHelpMarkNavy;
  return <Modal visible={Boolean(help)} animationType="fade" transparent onRequestClose={onClose}><View style={styles.symbolHelpBackdrop}><View style={styles.symbolHelpSheet}><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>早稻田符號說明</Text><Text style={styles.modalSubtitle}>單點輸入紀錄；長按任一常用符號即可再次查看。</Text></View><Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="關閉符號說明"><Text style={styles.modalClose}>關閉</Text></Pressable></View><View style={styles.symbolHelpHero}><View style={[styles.symbolHelpMark, toneStyle]}><Text style={styles.symbolHelpMarkText}>{help?.mark}</Text></View><View style={styles.symbolHelpTitleCopy}><Text style={styles.symbolHelpName}>{help?.name}</Text><Text style={styles.symbolHelpArea}>{help?.area}</Text></View></View><View style={styles.symbolHelpContent}><Text style={styles.symbolHelpLabel}>使用時機</Text><Text style={styles.symbolHelpBody}>{help?.usage}</Text><Text style={styles.symbolHelpLabel}>紀錄範例</Text><Text style={styles.symbolHelpExample}>{help?.example}</Text></View><Button label="了解" onPress={onClose} /></View></View></Modal>;
}

function SymbolReferenceModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { interfacePalette } = useThemeContext();
  const toneColor = (tone: "navy" | "red" | "blue") => tone === "red" ? interfacePalette.error : tone === "blue" ? interfacePalette.primary : interfacePalette.foreground;
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<(typeof WASEDA_SYMBOL_CATEGORIES)[number]>("全部");
  const zoom = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const gestureRef = useRef({ startDistance: 0, startZoom: 1, startPan: { x: 0, y: 0 }, pinching: false });
  const visibleSymbols = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return WASEDA_SYMBOL_REFERENCE.filter((item) => {
      const categoryMatched = selectedCategory === "全部" || item.category === selectedCategory;
      const searchMatched = !normalizedQuery || [item.mark, item.title, item.category, item.placement, item.description, item.example]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
      return categoryMatched && searchMatched;
    });
  }, [query, selectedCategory]);
  const resetView = useCallback(() => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    zoom.setValue(1);
    pan.setValue({ x: 0, y: 0 });
  }, [pan, zoom]);
  const setZoom = useCallback((nextZoom: number) => {
    const clamped = Math.max(0.48, Math.min(2.2, nextZoom));
    zoomRef.current = clamped;
    zoom.setValue(clamped);
  }, [zoom]);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length > 1,
    onMoveShouldSetPanResponder: (_, gesture) => gesture.numberActiveTouches > 1 || (zoomRef.current > 1 && Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 7),
    onPanResponderGrant: (event) => {
      const touches = event.nativeEvent.touches;
      const first = touches[0];
      const second = touches[1];
      gestureRef.current.startPan = { ...panRef.current };
      gestureRef.current.pinching = Boolean(first && second);
      gestureRef.current.startZoom = zoomRef.current;
      gestureRef.current.startDistance = first && second ? Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY) : 0;
    },
    onPanResponderMove: (event, gesture) => {
      const touches = event.nativeEvent.touches;
      const first = touches[0];
      const second = touches[1];
      if (first && second) {
        const distance = Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
        if (gestureRef.current.startDistance > 0) setZoom(gestureRef.current.startZoom * (distance / gestureRef.current.startDistance));
        return;
      }
      if (!gestureRef.current.pinching) {
        const nextPan = { x: gestureRef.current.startPan.x + gesture.dx, y: gestureRef.current.startPan.y + gesture.dy };
        panRef.current = nextPan;
        pan.setValue(nextPan);
      }
    },
    onPanResponderRelease: () => { gestureRef.current.pinching = false; },
    onPanResponderTerminate: () => { gestureRef.current.pinching = false; },
  }), [pan, setZoom]);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.symbolReferenceBackdrop, { backgroundColor: "rgba(0, 0, 0, 0.56)" }]}>
        <View style={[styles.symbolReferenceSheet, { backgroundColor: interfacePalette.background, borderColor: interfacePalette.border }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.symbolReferenceEyebrow, { color: interfacePalette.primary }]}>WASEDA SCOREKEEPING</Text>
              <Text style={[styles.modalTitle, { color: interfacePalette.foreground }]}>早稻田符號速查表</Text>
            </View>
            <View style={[styles.symbolReferenceCountBadge, { backgroundColor: interfacePalette.surface }]}><Text style={[styles.symbolReferenceCountText, { color: interfacePalette.primary }]}>{WASEDA_SYMBOL_REFERENCE.length} 個符號</Text></View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="關閉符號對照表"><Text style={[styles.modalClose, { color: interfacePalette.primary }]}>關閉</Text></Pressable>
          </View>
          <View style={[styles.symbolReferenceHero, { backgroundColor: interfacePalette.primary }]}>
            <View style={[styles.symbolReferenceHeroMark, { backgroundColor: interfacePalette.surface }]}><Text style={[styles.symbolReferenceHeroMarkText, { color: interfacePalette.primary }]}>記</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.symbolReferenceHeroTitle}>依 1189LAB 對齊，由「位置」開始查詢</Text><Text style={styles.symbolReferenceHeroText}>個人紀錄欄分為球數欄、外圈與菱形內圈；每張卡保留使用位置、說明與範例。</Text></View>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="搜尋早稻田符號"
            placeholder="搜尋符號、名稱、位置或範例，例如：SB、暴投、外圈"
            placeholderTextColor={interfacePalette.muted}
            style={[styles.symbolReferenceSearch, { color: interfacePalette.foreground, backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.symbolReferenceFilterRow}>
            {WASEDA_SYMBOL_CATEGORIES.map((category) => {
              const active = selectedCategory === category;
              return <Pressable key={category} onPress={() => setSelectedCategory(category)} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`篩選${category}符號`} style={({ pressed }) => [styles.symbolReferenceFilterPill, { backgroundColor: active ? interfacePalette.primary : interfacePalette.surface, borderColor: active ? "transparent" : interfacePalette.border }, pressed && styles.pressed]}><Text style={[styles.symbolReferenceFilterText, { color: active ? interfacePalette.background : interfacePalette.foreground }]}>{category}</Text></Pressable>;
            })}
          </ScrollView>
          <View style={[styles.symbolReferenceControls, { borderColor: interfacePalette.border }]}>
            <Text style={[styles.symbolReferenceGestureHint, { color: interfacePalette.muted }]}>{selectedCategory === "全部" ? "全部符號" : selectedCategory} · {visibleSymbols.length} 筆 · 雙指縮放、放大後可橫向拖曳</Text>
            <View style={styles.symbolReferenceControlButtons}>
              <Pressable accessibilityRole="button" accessibilityLabel="縮小符號對照表" onPress={() => setZoom(zoomRef.current - 0.2)} style={({ pressed }) => [styles.symbolReferenceControlButton, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }, pressed && styles.pressed]}><Text style={[styles.symbolReferenceControlText, { color: interfacePalette.primary }]}>−</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="放大符號對照表" onPress={() => setZoom(zoomRef.current + 0.2)} style={({ pressed }) => [styles.symbolReferenceControlButton, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }, pressed && styles.pressed]}><Text style={[styles.symbolReferenceControlText, { color: interfacePalette.primary }]}>＋</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="重設符號對照表檢視" onPress={resetView} style={({ pressed }) => [styles.symbolReferenceResetButton, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }, pressed && styles.pressed]}><Text style={[styles.symbolReferenceResetText, { color: interfacePalette.primary }]}>重設</Text></Pressable>
            </View>
          </View>
          <ScrollView style={[styles.symbolReferenceViewport, { borderColor: interfacePalette.border }]} contentContainerStyle={styles.symbolReferenceViewportContent} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            <Animated.View {...panResponder.panHandlers} style={[styles.symbolReferenceGrid, { transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: zoom }] }]}>
              {visibleSymbols.map((item) => (
                <View key={item.id} accessibilityLabel={`${item.mark}，${item.title}，${item.placement}；${item.description}；範例：${item.example}`} style={[styles.symbolReferenceCard, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}>
                  <View style={[styles.symbolReferenceMarkBox, { backgroundColor: interfacePalette.background }]}><Text style={[styles.symbolReferenceMark, { color: toneColor(item.tone) }]}>{item.mark}</Text></View>
                  <View style={styles.symbolReferenceCopy}>
                    <View style={styles.symbolReferenceTitleRow}><Text style={[styles.symbolReferenceTitle, { color: interfacePalette.foreground }]}>{item.title}</Text><Text style={[styles.symbolReferenceCategoryTag, { color: interfacePalette.primary }]}>{item.category}</Text></View>
                    <Text numberOfLines={2} style={[styles.symbolReferenceDescription, { color: interfacePalette.muted }]}>{item.description}</Text>
                    <Text numberOfLines={1} style={[styles.symbolReferencePlacement, { color: interfacePalette.muted }]}>位置：{item.placement}</Text>
                    <Text numberOfLines={1} style={[styles.symbolReferenceExample, { color: toneColor(item.tone) }]}>範例：{item.example}</Text>
                  </View>
                </View>
              ))}
            </Animated.View>
            {visibleSymbols.length === 0 ? <View style={[styles.symbolReferenceEmpty, { borderColor: interfacePalette.border }]}><Text style={[styles.symbolReferenceEmptyText, { color: interfacePalette.muted }]}>找不到符合的符號，請改用名稱、位置或範例搜尋。</Text></View> : null}
          </ScrollView>
          <View style={[styles.symbolReferenceFootnote, { backgroundColor: interfacePalette.surface, borderColor: interfacePalette.border }]}><Text style={[styles.symbolReferenceFootnoteText, { color: interfacePalette.muted }]}>提示：對照表用於速查，不會直接寫入紀錄。逐球、跑壘、守備傳接仍須依工作台流程完成核對。</Text></View>
        </View>
      </View>
    </Modal>
  );
}

const ONBOARDING_STEPS = [
  { mark: "①", title: "確認打席結果", text: "結果 → 跑者 → 出局 → 得分 → 半局核對。先選擇安打、保送、三振、滾地或飛球等最後結果；逐球球數可在此步補登，系統會預覽早稻田符號。", note: "提示：結果尚未寫入前，可使用上一動作回復草稿。" },
  { mark: "②", title: "核對打者與跑者", text: "依菱形確認打者上壘與既有跑者的最終壘位；野手選擇、暴投、捕逸與盜壘均先顯示摘要。", note: "提示：跑者判定有疑問時，先返回上一步，不要直接寫入。" },
  { mark: "③", title: "確認出局與守備傳接", text: "選擇出局數、守備序列，以及雙殺 DP／三殺 TP；實際出局數會與傳接符號一起核對。", note: "提示：DP／TP 不是純文字，需與跑者及出局結果一致。" },
  { mark: "④", title: "確認得分與特殊註記", text: "最後核對得分、RBI、換人與暫停。O.C／T 可加入原因，但只保留紀錄時間線，不改變統計。", note: "提示：換投、代跑、代打、換守均可逐步返回修改。" },
  { mark: "⑤", title: "半局核對與完整紀錄表", text: "第三出局會自動標示 //；未滿三出局提前結束才標示 ///。主、客各有可追溯的分隊紀錄表。", note: "提示：已落帳後仍可使用「復原上一筆」查看影響並還原。" },
] as const;

function OnboardingTutorialModal({ visible, step, onChangeStep, onOpenSymbols, onComplete }: { visible: boolean; step: number; onChangeStep: (step: number) => void; onOpenSymbols: () => void; onComplete: () => void }) {
  const current = ONBOARDING_STEPS[Math.max(0, Math.min(step, ONBOARDING_STEPS.length - 1))];
  const finalStep = step === ONBOARDING_STEPS.length - 1;
  return <Modal visible={visible} animationType="fade" transparent onRequestClose={onComplete}><View style={styles.tutorialBackdrop}><View style={styles.tutorialSheet}><View style={styles.tutorialHeader}><View><Text style={styles.tutorialEyebrow}>FIRST TIME GUIDE</Text><Text style={styles.tutorialHeaderTitle}>五步完成早稻田紀錄</Text></View><Pressable accessibilityRole="button" accessibilityLabel="略過新手教學" onPress={onComplete}><Text style={styles.tutorialSkip}>略過</Text></Pressable></View><View style={styles.tutorialProgress}>{ONBOARDING_STEPS.map((_, index) => <View key={index} style={[styles.tutorialProgressDot, index <= step && styles.tutorialProgressDotActive]} />)}</View><View style={styles.tutorialBody}><View style={styles.tutorialMark}><Text style={styles.tutorialMarkText}>{current.mark}</Text></View><View style={styles.tutorialCopy}><Text style={styles.tutorialStep}>步驟 {step + 1}／{ONBOARDING_STEPS.length}</Text><Text style={styles.tutorialTitle}>{current.title}</Text><Text style={styles.tutorialText}>{current.text}</Text><View style={styles.tutorialNote}><Text style={styles.tutorialNoteText}>{current.note}</Text></View></View></View><View style={styles.tutorialActions}>{step > 0 ? <View style={styles.tutorialActionFlex}><Button label="上一步" variant="secondary" onPress={() => onChangeStep(step - 1)} /></View> : <View style={styles.tutorialActionFlex} />}{finalStep ? <View style={styles.tutorialActionFlex}><Button label="開啟速查表" onPress={onOpenSymbols} /></View> : <View style={styles.tutorialActionFlex}><Button label="下一步" onPress={() => onChangeStep(step + 1)} /></View>}</View>{finalStep ? <Pressable accessibilityRole="button" onPress={onComplete} style={styles.tutorialFinishLink}><Text style={styles.tutorialFinishText}>直接開始記錄</Text></Pressable> : null}</View></View></Modal>;
}

function TopDownLineupField({ team, lineup, conflictedPositions = [], highlightedPositions = [] }: { team: Team; lineup: GameLineup; conflictedPositions?: string[]; highlightedPositions?: string[] }) {
  const playersForPosition = (number: string) => Object.entries(lineup.defensivePositions)
    .filter(([, position]) => FIELD_POSITIONS.find((fieldPosition) => fieldPosition.number === position || fieldPosition.label === position)?.number === number)
    .map(([playerId]) => team.players.find((player) => player.id === playerId))
    .filter((player): player is Player => Boolean(player));

  return <ImageBackground source={HOME_DEFENSE_FIELD_IMAGE} resizeMode="contain" style={styles.topDownField} imageStyle={styles.topDownFieldImage} accessibilityLabel={`${team.name} 守備位置配置圖（使用者指定棒球場俯視圖）`}>
    {FIELD_POSITION_LAYOUT.map((spot) => {
      const fieldPosition = FIELD_POSITIONS.find((candidate) => candidate.number === spot.number);
      const players = playersForPosition(spot.number);
      const conflicted = conflictedPositions.includes(spot.number);
      const highlighted = highlightedPositions.includes(spot.number);
      return <View key={spot.number} style={[styles.topDownFieldMarker, players.length ? styles.topDownFieldMarkerFilled : styles.topDownFieldMarkerEmpty, highlighted && styles.topDownFieldMarkerChanged, conflicted && styles.topDownFieldMarkerConflict, { top: `${spot.top}%`, left: `${spot.left}%` }]}>
        <Text style={[styles.topDownFieldMarkerText, !players.length && styles.topDownFieldMarkerTextEmpty]}>{players.length ? players.map((player) => `#${player.number}`).join("/") : spot.number}</Text>
        <Text style={[styles.topDownFieldMarkerLabel, conflicted && styles.topDownFieldMarkerLabelConflict]}>{conflicted ? "重複" : fieldPosition?.label ?? spot.number}</Text>
      </View>;
    })}
  </ImageBackground>;
}

function PreferredPositionFieldPicker({ selectedPositions, onToggle }: { selectedPositions: string[]; onToggle: (position: string) => void }) {
  return <View style={styles.preferredPositionFieldPanel}>
    <View style={styles.preferredPositionFieldHeader}>
      <Text style={styles.preferredPositionFieldTitle}>直接點選球場守位</Text>
      <Text style={styles.preferredPositionFieldHint}>已選 {selectedPositions.length}/4</Text>
    </View>
    <ImageBackground source={HOME_DEFENSE_FIELD_IMAGE} resizeMode="contain" style={styles.preferredPositionField} imageStyle={styles.preferredPositionFieldImage} accessibilityLabel="慣用守備位置球場圖">
      {FIELD_POSITION_LAYOUT.map((spot) => {
        const position = FIELD_POSITIONS.find((candidate) => candidate.number === spot.number);
        const selected = selectedPositions.includes(spot.number);
        return <Pressable key={`preferred-position-${spot.number}`} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`選擇${position?.label ?? spot.number}守備位置`} hitSlop={5} onPress={() => onToggle(spot.number)} style={[styles.preferredPositionFieldMarker, selected ? styles.preferredPositionFieldMarkerActive : styles.preferredPositionFieldMarkerIdle, { top: `${spot.top}%`, left: `${spot.left}%` }]}>
          <Text style={[styles.preferredPositionFieldMarkerNumber, selected && styles.preferredPositionFieldMarkerTextActive]}>{spot.number}</Text>
          <Text style={[styles.preferredPositionFieldMarkerLabel, selected && styles.preferredPositionFieldMarkerTextActive]}>{position?.label ?? spot.number}</Text>
        </Pressable>;
      })}
    </ImageBackground>
    <Text style={styles.preferredPositionFieldNote}>可在球場或下方按鈕選擇；「後備」請使用下方按鈕。</Text>
  </View>;
}

function NewGameModal({ visible, form, teams, games, onChange, onCreateTeam, onClose, onSubmit }: { visible: boolean; form: NewGameForm; teams: Team[]; games: Game[]; onChange: (form: NewGameForm) => void; onCreateTeam: (name: string) => Team | null; onClose: () => void; onSubmit: () => void }) {
  const [activeLineupTarget, setActiveLineupTarget] = useState<{ side: "away" | "home"; playerId: string } | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swapPlayerIds, setSwapPlayerIds] = useState<string[]>([]);
  const [selectedDefensiveSwapPositions, setSelectedDefensiveSwapPositions] = useState<string[]>([]);
  const [changedSwapPositions, setChangedSwapPositions] = useState<string[]>([]);
  const [lastDefensiveSwap, setLastDefensiveSwap] = useState<{ homeLineup: GameLineup; awayLineup: GameLineup } | null>(null);
  const [pitchLimitDraft, setPitchLimitDraft] = useState<[string, string, string]>(() => form.pitchLimitThresholds.map(String) as [string, string, string]);
  const [focusedPitchLimit, setFocusedPitchLimit] = useState<number | null>(null);
  const pitchLimitFocusScales = useRef([new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)]).current;
  const { width: viewportWidth } = useWindowDimensions();
  const useCompactPitchLimitLayout = viewportWidth < 720;
  const changedSwapTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [teamNameDraft, setTeamNameDraft] = useState("");
  const [battingOrderTarget, setBattingOrderTarget] = useState<{ side: "away" | "home"; order: number } | null>(null);
  const [draggingBattingOrder, setDraggingBattingOrder] = useState<string | null>(null);
  const [draggingDefensePlayer, setDraggingDefensePlayer] = useState<string | null>(null);
  const battingDropTargets = useRef<Record<"away" | "home", Partial<Record<number, View | null>>>>({ away: {}, home: {} });
  const defensiveDropTargets = useRef<Record<"away" | "home", Partial<Record<string, View | null>>>>({ away: {}, home: {} });
  const lastConflictSignature = useRef("");
  const away = teams.find((team) => team.id === form.awayTeamId);
  const home = teams.find((team) => team.id === form.homeTeamId);
  const registered = (side: "away" | "home", team?: Team) => {
    const ids = side === "away" ? form.awayRegisteredPlayerIds : form.homeRegisteredPlayerIds;
    return ids.length ? ids : (team?.players.slice(0, 25).map((player) => player.id) ?? []);
  };
  const updateTeamSetup = (side: "away" | "home", registeredPlayerIds: string[], lineup: GameLineup) => {
    onChange(side === "away" ? { ...form, awayRegisteredPlayerIds: registeredPlayerIds, awayLineup: lineup } : { ...form, homeRegisteredPlayerIds: registeredPlayerIds, homeLineup: lineup });
  };
  const lineupFor = (side: "away" | "home", team?: Team) => (side === "away" ? form.awayLineup : form.homeLineup) ?? (team ? createLineupSnapshot(team, registered(side, team)) : { battingOrderIds: [], defensivePositions: {} });
  const feedback = (kind: "error" | "success") => {
    if (Platform.OS !== "web") void Haptics.notificationAsync(kind === "error" ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success);
  };
  const conflictSignature = [away, home].map((team, index) => team ? getDefensivePositionConflicts(lineupFor(index === 0 ? "away" : "home", team)).map((conflict) => `${conflict.position}:${conflict.playerIds.sort().join(",")}`).join("|") : "").filter(Boolean).join(";");
  useEffect(() => {
    if (!visible) {
      lastConflictSignature.current = "";
      if (changedSwapTimeout.current) clearTimeout(changedSwapTimeout.current);
      changedSwapTimeout.current = null;
      setSwapMode(false);
      setSwapPlayerIds([]);
      setSelectedDefensiveSwapPositions([]);
      setChangedSwapPositions([]);
      setLastDefensiveSwap(null);
      setWizardStep(1);
      setTeamNameDraft("");
      setBattingOrderTarget(null);
      setDraggingBattingOrder(null);
      setDraggingDefensePlayer(null);
      setFocusedPitchLimit(null);
      return;
    }
    if (conflictSignature && conflictSignature !== lastConflictSignature.current) feedback("error");
    lastConflictSignature.current = conflictSignature;
  }, [visible, conflictSignature]);
  useEffect(() => {
    if (visible) setPitchLimitDraft(form.pitchLimitThresholds.map(String) as [string, string, string]);
  }, [visible]);
  useEffect(() => {
    pitchLimitFocusScales.forEach((scale, index) => {
      Animated.timing(scale, { toValue: focusedPitchLimit === index ? 1.015 : 1, duration: 160, useNativeDriver: true }).start();
    });
  }, [focusedPitchLimit, pitchLimitFocusScales]);
  useEffect(() => () => { if (changedSwapTimeout.current) clearTimeout(changedSwapTimeout.current); }, []);
  const commitPitchLimitThresholds = (showError = true) => {
    const parsed = pitchLimitDraft.map((value) => Number(value)) as [number, number, number];
    const isValid = parsed.every((value) => Number.isInteger(value) && value >= 1 && value <= 300)
      && parsed[0] < parsed[1]
      && parsed[1] < parsed[2];
    if (!isValid) {
      if (showError) Alert.alert("投球數門檻需要調整", "請依黃 ＜ 橘 ＜ 紅遞增設定，且每項為 1 至 300 球的正整數。\n例如：50、70、90。" );
      return false;
    }
    onChange({ ...form, pitchLimitThresholds: parsed });
    setPitchLimitDraft(parsed.map(String) as [string, string, string]);
    return true;
  };
  const setTeam = (side: "away" | "home", team: Team) => {
    const ids = team.players.slice(0, 25).map((player) => player.id);
    const lineup = createLineupSnapshot(team, ids);
    setSwapMode(false); setSwapPlayerIds([]); setLastDefensiveSwap(null);
    onChange(side === "away" ? { ...form, awayTeamId: team.id, awayRegisteredPlayerIds: ids, awayLineup: lineup } : { ...form, homeTeamId: team.id, homeRegisteredPlayerIds: ids, homeLineup: lineup });
  };
  const togglePlayer = (side: "away" | "home", team: Team, playerId: string) => {
    const current = registered(side, team); const hasPlayer = current.includes(playerId); const next = hasPlayer ? current.filter((id) => id !== playerId) : [...current, playerId]; const previousLineup = lineupFor(side, team); const defensivePositions = { ...previousLineup.defensivePositions };
    if (hasPlayer) delete defensivePositions[playerId];
    setSwapPlayerIds((selected) => selected.filter((id) => id !== playerId)); setLastDefensiveSwap(null);
    updateTeamSetup(side, next, { battingOrderIds: previousLineup.battingOrderIds.filter((id) => id !== playerId), defensivePositions });
  };
  const applyCommonLineup = (side: "away" | "home", team: Team) => { setSwapMode(false); setSwapPlayerIds([]); updateTeamSetup(side, registered(side, team), createLineupSnapshot(team, registered(side, team))); };
  const setDefensivePosition = (side: "away" | "home", team: Team, playerId: string, nextPosition: string | null) => {
    setLastDefensiveSwap(null);
    const previousLineup = lineupFor(side, team); const defensivePositions = { ...previousLineup.defensivePositions };
    const normalized = nextPosition ? FIELD_POSITIONS.find((position) => position.number === nextPosition || position.label === nextPosition)?.number ?? nextPosition : null;
    if (normalized) defensivePositions[playerId] = normalized; else delete defensivePositions[playerId];
    const nextLineup = { ...previousLineup, defensivePositions };
    const battingOrderIds = isEligibleForBattingOrder(nextLineup, playerId)
      ? previousLineup.battingOrderIds
      : previousLineup.battingOrderIds.filter((id) => id !== playerId);
    updateTeamSetup(side, registered(side, team), { ...nextLineup, battingOrderIds });
  };
  const applyConflictReassignment = (side: "away" | "home", team: Team, playerId: string, targetPosition: string) => {
    setDefensivePosition(side, team, playerId, targetPosition);
    setActiveLineupTarget({ side, playerId });
    setSwapMode(false);
    setSwapPlayerIds([]);
    feedback("success");
  };
  const applySuggestedSwap = (side: "away" | "home", team: Team, playerId: string, targetPlayerId: string) => {
    setLastDefensiveSwap(null);
    updateTeamSetup(side, registered(side, team), swapDefensivePositions(lineupFor(side, team), playerId, targetPlayerId));
    setActiveLineupTarget({ side, playerId: targetPlayerId });
    setSwapMode(false);
    setSwapPlayerIds([]);
    feedback("success");
  };
  const renderConflictFixSuggestions = (side: "away" | "home", team: Team, lineup: GameLineup, location: "setup" | "confirmation") => {
    const suggestions = suggestDefensiveConflictFixes(lineup, registered(side, team));
    if (!suggestions.length) return null;
    const positionLabel = (positionNumber: string) => {
      const position = FIELD_POSITIONS.find((candidate) => candidate.number === positionNumber);
      return position ? `${position.number}${position.label}` : positionNumber;
    };
    const playerLabel = (playerId: string) => {
      const player = team.players.find((candidate) => candidate.id === playerId);
      return player ? `#${player.number} ${player.name}` : "未指派球員";
    };
    return <View style={[styles.conflictFixPanel, location === "confirmation" && styles.conflictFixPanelConfirmation]}><View style={styles.conflictFixHeader}><Text style={styles.conflictFixTitle}>衝突修正建議</Text><Text style={styles.conflictFixSubtitle}>{location === "confirmation" ? "請先套用修正後再建立比賽" : "紅色守位需保留一人，其餘可直接改派"}</Text></View>{suggestions.map((suggestion) => {
      const movablePlayerIds = suggestion.conflictingPlayerIds.slice(1);
      const suggestedPlayerId = movablePlayerIds[0];
      const swapTargets = suggestion.suggestedSwaps.slice(0, 2);
      return <View key={`${side}-fix-${suggestion.position}`} style={styles.conflictFixGroup}><Text style={styles.conflictFixGroupTitle}>{positionLabel(suggestion.position)} 有 {suggestion.conflictingPlayerIds.length} 名球員重複：{suggestion.conflictingPlayerIds.map(playerLabel).join("、")}</Text>{suggestion.availablePositions.length ? <View style={styles.conflictFixActionRow}>{suggestion.availablePositions.map((targetPosition, index) => {
        const playerId = movablePlayerIds[index] ?? suggestedPlayerId;
        if (!playerId) return null;
        return <Pressable key={`${side}-fix-reassign-${playerId}-${targetPosition}`} onPress={() => applyConflictReassignment(side, team, playerId, targetPosition)} style={({ pressed }) => [styles.conflictFixAction, pressed && styles.pressed]}><Text style={styles.conflictFixActionText}>套用：{playerLabel(playerId)} → {positionLabel(targetPosition)}</Text></Pressable>;
      })}</View> : <Text style={styles.conflictFixNoVacancy}>目前沒有空缺守位；請以互換方式重新配置。</Text>}{suggestedPlayerId && swapTargets.length ? <View style={styles.conflictFixSwapRow}><Text style={styles.conflictFixSwapHint}>或直接互換 {playerLabel(suggestedPlayerId)}：</Text>{swapTargets.map((target) => <Pressable key={`${side}-fix-swap-${suggestedPlayerId}-${target.targetPlayerId}`} onPress={() => applySuggestedSwap(side, team, suggestedPlayerId, target.targetPlayerId)} style={({ pressed }) => [styles.conflictFixSwapAction, pressed && styles.pressed]}><Text style={styles.conflictFixSwapActionText}>⇄ {playerLabel(target.targetPlayerId)}（{positionLabel(target.targetPosition)}）</Text></Pressable>)}</View> : null}</View>;
    })}</View>;
  };
  const copyLatestGameLineup = (side: "away" | "home", team: Team) => {
    const source = games.find((game) => game.awayTeamId === team.id || game.homeTeamId === team.id);
    if (!source) { Alert.alert("尚無可複製配置", `${team.name} 尚未建立過含先發配置的場次。`); return; }
    const isAway = source.awayTeamId === team.id; const sourceRegistered = isAway ? source.awayRegisteredPlayerIds : source.homeRegisteredPlayerIds; const sourceLineup = isAway ? source.awayLineup : source.homeLineup;
    const validIds = (sourceRegistered?.length ? sourceRegistered : team.players.slice(0, 25).map((player) => player.id)).filter((playerId) => team.players.some((player) => player.id === playerId));
    setSwapMode(false); setSwapPlayerIds([]); setLastDefensiveSwap(null); updateTeamSetup(side, validIds, sourceLineup ?? createLineupSnapshot(team, validIds));
  };
  const toggleDefensiveSwapPosition = (position: string) => setSelectedDefensiveSwapPositions((selected) => selected.includes(position) ? selected.filter((item) => item !== position) : [...selected, position]);
  const highlightChangedSwapPositions = (positions: string[]) => {
    if (changedSwapTimeout.current) clearTimeout(changedSwapTimeout.current);
    setChangedSwapPositions(positions);
    if (!positions.length) return;
    changedSwapTimeout.current = setTimeout(() => {
      setChangedSwapPositions([]);
      changedSwapTimeout.current = null;
    }, 1500);
  };
  const swapHomeAwayDefensiveConfigurations = (selectedPositions?: string[]) => {
    if (!home || !away) return;
    const isPartialSwap = Boolean(selectedPositions?.length);
    const positionLabels = FIELD_POSITIONS.filter((position) => selectedPositions?.includes(position.number)).map((position) => `${position.number}${position.label}`).join("、");
    const applySwap = () => {
      const previousHomeLineup = lineupFor("home", home);
      const previousAwayLineup = lineupFor("away", away);
      setLastDefensiveSwap({ homeLineup: previousHomeLineup, awayLineup: previousAwayLineup });
      const swapped = swapTeamDefensiveConfigurations(
        previousHomeLineup,
        registered("home", home),
        previousAwayLineup,
        registered("away", away),
        selectedPositions,
      );
      highlightChangedSwapPositions(getChangedDefensivePositions(previousHomeLineup, previousAwayLineup, swapped.homeLineup, swapped.awayLineup));
      onChange({ ...form, homeLineup: swapped.homeLineup, awayLineup: swapped.awayLineup });
      setActiveLineupTarget(null);
      setBattingOrderTarget(null);
      setSwapMode(false);
      setSwapPlayerIds([]);
      feedback("success");
    };
    Alert.alert(
      isPartialSwap ? "互換已選守備位置" : "互換主客守備配置",
      isPartialSwap ? `將依雙方登錄名單順序，僅互換 ${positionLabels} 的配置。棒次不會交換；資格不足者會自動移出棒次。` : "將依雙方登錄名單的順序交換守備位置。棒次不會交換；互換後未具 1 至 9 號正式守位的球員，會自動移出棒次。",
      [{ text: "取消", style: "cancel" }, { text: "確認互換", onPress: applySwap }],
    );
  };
  const restoreLastDefensiveSwap = () => {
    if (!lastDefensiveSwap) return;
    const restore = () => {
      const currentHomeLineup = lineupFor("home", home);
      const currentAwayLineup = lineupFor("away", away);
      highlightChangedSwapPositions(getChangedDefensivePositions(currentHomeLineup, currentAwayLineup, lastDefensiveSwap.homeLineup, lastDefensiveSwap.awayLineup));
      onChange({ ...form, homeLineup: lastDefensiveSwap.homeLineup, awayLineup: lastDefensiveSwap.awayLineup });
      setActiveLineupTarget(null);
      setBattingOrderTarget(null);
      setLastDefensiveSwap(null);
      feedback("success");
    };
    Alert.alert("復原上次守備互換", "將恢復按下互換前的主客隊守備配置與棒次。", [{ text: "取消", style: "cancel" }, { text: "確認復原", onPress: restore }]);
  };
  const selectLineupPlayer = (side: "away" | "home", team: Team, playerId: string) => {
    if (!swapMode) { setActiveLineupTarget({ side, playerId }); return; }
    if (!swapPlayerIds.length) { setSwapPlayerIds([playerId]); return; }
    if (swapPlayerIds[0] === playerId) { setSwapPlayerIds([]); return; }
    updateTeamSetup(side, registered(side, team), swapDefensivePositions(lineupFor(side, team), swapPlayerIds[0], playerId));
    setSwapPlayerIds([]); setSwapMode(false); feedback("success");
  };
  const assignBattingOrder = (side: "away" | "home", team: Team, order: number, playerId: string) => {
    const previousLineup = lineupFor(side, team);
    if (!isEligibleForBattingOrder(previousLineup, playerId)) {
      Alert.alert("無法排入棒次", "只有已配置 1 至 9 號正式守備位置的球員可列入先發棒次；未配置或標示為後備的球員會保留為替補。 ");
      feedback("error");
      return;
    }
    const nextOrder = previousLineup.battingOrderIds.filter((id) => id !== playerId);
    nextOrder.splice(order - 1, 0, playerId);
    updateTeamSetup(side, registered(side, team), { ...previousLineup, battingOrderIds: nextOrder.slice(0, 9) });
    setBattingOrderTarget(null);
  };
  const moveBattingOrderByDrag = (side: "away" | "home", team: Team, playerId: string, targetOrder: number) => {
    const previousLineup = lineupFor(side, team);
    const sourceIndex = previousLineup.battingOrderIds.indexOf(playerId);
    if (sourceIndex < 0 || sourceIndex === targetOrder - 1) return;
    const nextOrder = previousLineup.battingOrderIds.filter((id) => id !== playerId);
    nextOrder.splice(Math.min(Math.max(targetOrder - 1, 0), nextOrder.length), 0, playerId);
    updateTeamSetup(side, registered(side, team), { ...previousLineup, battingOrderIds: nextOrder.slice(0, 9) });
    setBattingOrderTarget(null);
    feedback("success");
  };
  const dropBattingCard = (side: "away" | "home", team: Team, playerId: string, moveX: number, moveY: number) => {
    const targets = Object.entries(battingDropTargets.current[side]).filter((entry): entry is [string, View] => Boolean(entry[1]));
    if (!targets.length) return;
    let pending = targets.length;
    let targetOrder: number | null = null;
    targets.forEach(([order, target]) => target.measureInWindow((x, y, width, height) => {
      if (moveX >= x && moveX <= x + width && moveY >= y && moveY <= y + height) targetOrder = Number(order);
      pending -= 1;
      if (pending === 0 && targetOrder) moveBattingOrderByDrag(side, team, playerId, targetOrder);
    }));
  };
  const dropDefenseCard = (side: "away" | "home", team: Team, playerId: string, moveX: number, moveY: number) => {
    const targets = Object.entries(defensiveDropTargets.current[side]).filter((entry): entry is [string, View] => Boolean(entry[1]));
    if (!targets.length) return;
    let pending = targets.length;
    let targetPosition: string | null = null;
    targets.forEach(([position, target]) => target.measureInWindow((x, y, width, height) => {
      if (moveX >= x && moveX <= x + width && moveY >= y && moveY <= y + height) targetPosition = position;
      pending -= 1;
      if (pending === 0 && targetPosition) {
        if (home && away) setLastDefensiveSwap({ homeLineup: lineupFor("home", home), awayLineup: lineupFor("away", away) });
        setDefensivePosition(side, team, playerId, targetPosition);
        highlightChangedSwapPositions([targetPosition]);
        feedback("success");
      }
    }));
  };
  const createBattingDragResponder = (side: "away" | "home", team: Team, playerId: string) => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
    onPanResponderGrant: () => setDraggingBattingOrder(playerId),
    onPanResponderRelease: (_event, gesture) => { dropBattingCard(side, team, playerId, gesture.moveX, gesture.moveY); setDraggingBattingOrder(null); },
    onPanResponderTerminate: () => setDraggingBattingOrder(null),
  });
  const createDefenseDragResponder = (side: "away" | "home", team: Team, playerId: string) => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
    onPanResponderGrant: () => setDraggingDefensePlayer(playerId),
    onPanResponderRelease: (_event, gesture) => { dropDefenseCard(side, team, playerId, gesture.moveX, gesture.moveY); setDraggingDefensePlayer(null); },
    onPanResponderTerminate: () => setDraggingDefensePlayer(null),
  });
  const createTeamForSide = (side: "away" | "home") => {
    const team = onCreateTeam(teamNameDraft);
    if (!team) { Alert.alert("請輸入球隊名稱", "輸入學校或球隊名稱後，即可建立並套用於本場比賽。"); return; }
    setTeam(side, team);
    setTeamNameDraft("");
  };
  if (wizardStep >= 1 && wizardStep <= 13) return renderGameWizard();
  function renderGameWizard() {
    const title = ["盃賽名稱", "年齡層級", "正規局數", "比賽場地", "天氣", "主場球隊", "主場登錄球員", "客場球隊", "客場登錄球員", "主客隊守備位置", "主場排定棒次", "客場排定棒次", "主客先發確認"][wizardStep - 1] ?? "新增比賽";
    const hint = ["輸入本場盃賽或聯賽名稱。", "選擇正式年齡組別。", "選擇正規局數；平手時自動延長。", "輸入場地及日期。", "選擇本場天候。", "套用既有隊伍或立即建立主場隊。", "確認主場本場可出賽名單。", "套用既有隊伍或立即建立客場隊。", "確認客場本場可出賽名單。", "主客隊並列設定守備位置；後備不列入九人先發與棒次。", "依背號、姓名與守位指派主場第 1 至第 9 棒。", "依背號、姓名與守位指派客場第 1 至第 9 棒。", "核對雙方先發名單、守備位置與棒次後建立比賽。"][wizardStep - 1] ?? "";
    const valid = () => {
      const homeLineup = lineupFor("home", home); const awayLineup = lineupFor("away", away);
      if (wizardStep === 1) return Boolean(form.competition.trim());
      if (wizardStep === 3) return commitPitchLimitThresholds();
      if (wizardStep === 4) return Boolean(form.venue.trim());
      if (wizardStep === 6) return Boolean(home);
      if (wizardStep === 7) return Boolean(home && registered("home", home).length >= 9);
      if (wizardStep === 8) return Boolean(away);
      if (wizardStep === 9) return Boolean(away && registered("away", away).length >= 9);
      if (wizardStep === 10) return Boolean(home && away && getBattingOrderEligiblePlayerIds(homeLineup, registered("home", home)).length >= 9 && getBattingOrderEligiblePlayerIds(awayLineup, registered("away", away)).length >= 9 && !getDefensivePositionConflicts(homeLineup).length && !getDefensivePositionConflicts(awayLineup).length);
      if (wizardStep === 11) return Boolean(home && getLineupCompleteness(homeLineup, registered("home", home)).complete);
      if (wizardStep === 12) return Boolean(away && getLineupCompleteness(awayLineup, registered("away", away)).complete);
      return true;
    };
    const reset = () => {
      const empty: GameLineup = { battingOrderIds: [], defensivePositions: {} };
      if (wizardStep === 1) onChange({ ...form, competition: "", name: "" });
      else if (wizardStep === 4) onChange({ ...form, venue: "" });
      else if (wizardStep === 6) onChange({ ...form, homeTeamId: "", homeRegisteredPlayerIds: [], homeLineup: empty });
      else if (wizardStep === 7) onChange({ ...form, homeRegisteredPlayerIds: [], homeLineup: empty });
      else if (wizardStep === 8) onChange({ ...form, awayTeamId: "", awayRegisteredPlayerIds: [], awayLineup: empty });
      else if (wizardStep === 9) onChange({ ...form, awayRegisteredPlayerIds: [], awayLineup: empty });
      else if (wizardStep === 10) onChange({ ...form, homeLineup: home ? { ...lineupFor("home", home), defensivePositions: {} } : empty, awayLineup: away ? { ...lineupFor("away", away), defensivePositions: {} } : empty });
      else if (wizardStep === 11 && home) onChange({ ...form, homeLineup: { ...lineupFor("home", home), battingOrderIds: [] } });
      else if (wizardStep === 12 && away) onChange({ ...form, awayLineup: { ...lineupFor("away", away), battingOrderIds: [] } });
    };
    const next = () => { Keyboard.dismiss(); setFocusedPitchLimit(null); if (!valid()) { if (wizardStep !== 3) Alert.alert("尚未完成本步", `${title}需完成後才能繼續。請確認必要資料、九位登錄球員、正式守位與無重複守備位置。`); return; } if (wizardStep === 13) { onSubmit(); return; } setWizardStep((step) => step + 1); };
    const teamStage = (side: "away" | "home", selected?: Team) => <View style={styles.wizardStepPanel}><Text style={styles.inputLabel}>選擇{side === "home" ? "主場(先守)" : "客場(先攻)"}球隊</Text><View style={styles.modalChoiceRow}>{teams.map((team) => <Pressable key={`${side}-wizard-${team.id}`} onPress={() => setTeam(side, team)} style={[styles.modalChoice, selected?.id === team.id && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, selected?.id === team.id && styles.modalChoiceTextActive]}>{team.name}</Text></Pressable>)}</View><Text style={styles.wizardMinorLabel}>或當下建立新球隊</Text><View style={styles.wizardCreateTeamRow}><TextInput value={teamNameDraft} onChangeText={setTeamNameDraft} placeholder="學校或球隊名稱" placeholderTextColor={BRAND.muted} style={[styles.formInput, styles.wizardCreateTeamInput]} /><Button label="建立並套用" onPress={() => createTeamForSide(side)} compact /></View></View>;
    const registrationStage = (side: "away" | "home", team?: Team) => !team ? <Text style={styles.mutedText}>請先返回並選擇球隊。</Text> : <View style={styles.registrationPanel}><View style={styles.registrationHeader}><Text style={styles.registrationTitle}>{side === "home" ? "主場(先守)" : "客場(先攻)"}登錄球員</Text><Text style={styles.registrationCount}>{registered(side, team).length}/{Math.min(team.players.length, 25)} 人</Text></View><Text style={styles.registrationHint}>請至少選擇 9 位可出賽球員；未登錄者不納入單場統計。</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.registrationList}>{team.players.slice(0, 25).map((player) => { const selected = registered(side, team).includes(player.id); return <Pressable key={`${side}-wizard-reg-${player.id}`} onPress={() => togglePlayer(side, team, player.id)} style={[styles.registrationChip, selected && styles.registrationChipActive]}><Text style={[styles.registrationChipNumber, selected && styles.registrationChipTextActive]}>#{player.number}</Text><Text style={[styles.registrationChipText, selected && styles.registrationChipTextActive]}>{player.name} {playerHandAbbr(player)}</Text></Pressable>; })}</ScrollView></View>;
    const defenseStage = (side: "away" | "home", team?: Team) => {
      if (!team) return <Text style={styles.mutedText}>請先返回並選擇球隊。</Text>;
      const lineup = lineupFor(side, team);
      const player = activeLineupTarget?.side === side ? team.players.find((candidate) => candidate.id === activeLineupTarget.playerId) : undefined;
      const conflicts = getDefensivePositionConflicts(lineup);
      const selectedPosition = player ? lineup.defensivePositions[player.id] : undefined;
      const selectablePositions = [...FIELD_POSITIONS, { number: RESERVE_POSITION, label: RESERVE_POSITION_LABEL }];
      const positionLabel = (assignedPosition?: string) => {
        const position = FIELD_POSITIONS.find((candidate) => candidate.number === assignedPosition || candidate.label === assignedPosition);
        return position ? `${position.number}${position.label}` : assignedPosition === RESERVE_POSITION || assignedPosition === RESERVE_POSITION_LABEL ? RESERVE_POSITION_LABEL : "未配置";
      };
      return <View style={[styles.registrationPanel, styles.wizardDefensePanel, side === "home" ? styles.wizardDefenseHomePanel : styles.wizardDefenseAwayPanel]}>
        <View style={styles.wizardDefenseHeader}>
          <View style={styles.wizardDefenseCopy}><Text style={styles.registrationTitle}>{side === "home" ? "主場(先守)" : "客場(先攻)"}守備位置</Text><Text style={styles.registrationHint}>直接拖拉下方球員卡到目標守位；點選卡片後也可指定。後備不列入九人先發與棒次，紅色提示代表守位重複。</Text></View>
          <TopDownLineupField team={team} lineup={lineup} conflictedPositions={conflicts.map((conflict) => conflict.position)} highlightedPositions={changedSwapPositions} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.registrationList}>{team.players.filter((candidate) => registered(side, team).includes(candidate.id)).map((candidate) => {
          const active = player?.id === candidate.id;
          const hasConflict = conflicts.some((conflict) => conflict.playerIds.includes(candidate.id));
          const dragResponder = createDefenseDragResponder(side, team, candidate.id);
          return <View key={`${side}-wizard-defense-${candidate.id}`} {...dragResponder.panHandlers} style={draggingDefensePlayer === candidate.id ? styles.lineupDraggingCard : undefined}><Pressable onPress={() => setActiveLineupTarget({ side, playerId: candidate.id })} style={[styles.registrationChip, styles.registrationPlayerChip, active && styles.registrationChipActive, hasConflict && styles.registrationChipConflict]}><Text style={[styles.registrationChipNumber, active && styles.registrationChipTextActive]}>#{candidate.number}</Text><Text numberOfLines={1} style={[styles.registrationChipText, active && styles.registrationChipTextActive]}>{candidate.name} {playerHandAbbr(candidate)}</Text><Text numberOfLines={1} style={[styles.registrationChipPosition, active && styles.registrationChipTextActive]}>{positionLabel(lineup.defensivePositions[candidate.id])}</Text></Pressable></View>;
        })}</ScrollView>
        <Text style={styles.defensivePickerLabel}>{player ? `${playerIdentityLabel(player)}：選擇守備位置` : "拖拉球員卡至下方守位，或先點選球員"}</Text>
        <View style={styles.defensivePositionRow}>{selectablePositions.map((position) => <View key={`${side}-wizard-position-target-${position.number}`} ref={(node) => { defensiveDropTargets.current[side][position.number] = node; }} collapsable={false}><Pressable disabled={!player} onPress={() => player && setDefensivePosition(side, team, player.id, position.number)} style={[styles.defensivePositionChip, selectedPosition === position.number && styles.defensivePositionChipActive]}><Text style={[styles.defensivePositionNumber, selectedPosition === position.number && styles.defensivePositionTextActive]}>{position.number === RESERVE_POSITION ? "後" : position.number}</Text><Text style={[styles.defensivePositionLabel, selectedPosition === position.number && styles.defensivePositionTextActive]}>{position.label}</Text></Pressable></View>)}</View>
        {renderConflictFixSuggestions(side, team, lineup, "setup")}
      </View>;
    };
    const battingStage = (side: "away" | "home", team?: Team) => {
      if (!team) return <Text style={styles.mutedText}>請先返回並選擇球隊。</Text>;
      const lineup = lineupFor(side, team);
      const target = battingOrderTarget?.side === side ? battingOrderTarget.order : undefined;
      const positionLabel = (playerId: string) => {
        const position = FIELD_POSITIONS.find((candidate) => candidate.number === lineup.defensivePositions[playerId] || candidate.label === lineup.defensivePositions[playerId]);
        return position ? `${position.number}${position.label}` : lineup.defensivePositions[playerId] === RESERVE_POSITION || lineup.defensivePositions[playerId] === RESERVE_POSITION_LABEL ? RESERVE_POSITION_LABEL : "未配置";
      };
      return <View style={styles.registrationPanel}>
        <Text style={styles.registrationTitle}>{side === "home" ? "主場(先守)" : "客場(先攻)"}棒次排定</Text>
        <Text style={styles.registrationHint}>可直接拖拉已排定的球員卡至目標棒次；後備或未配置守備者以紅色標示，不可排入棒次。</Text>
        <View style={styles.wizardOrderRow}>{Array.from({ length: 9 }, (_, index) => index + 1).map((order) => {
          const player = team.players.find((candidate) => candidate.id === lineup.battingOrderIds[order - 1]);
          const dragResponder = player ? createBattingDragResponder(side, team, player.id) : undefined;
          return <View key={`${side}-wizard-order-${order}`} ref={(node) => { battingDropTargets.current[side][order] = node; }} collapsable={false} style={[styles.wizardOrderDragTarget, player && draggingBattingOrder === player.id && styles.lineupDraggingCard]} {...(dragResponder?.panHandlers ?? {})}><Pressable onPress={() => setBattingOrderTarget({ side, order })} style={[styles.wizardOrderChip, target === order && styles.wizardOrderChipActive]}><Text style={[styles.wizardOrderLabel, target === order && styles.wizardOrderTextActive]}>{order}棒</Text><Text numberOfLines={1} style={[styles.wizardOrderValue, target === order && styles.wizardOrderTextActive]}>{player ? playerIdentityLabel(player) : "未排"}</Text><Text numberOfLines={1} style={[styles.wizardOrderPosition, target === order && styles.wizardOrderTextActive]}>{player ? positionLabel(player.id) : "—"}</Text></Pressable></View>;
        })}</View>
        <Text style={styles.defensivePickerLabel}>{target ? `第 ${target} 棒：選擇球員` : "直接拖拉球員卡調整順序，或先點選棒次"}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.registrationList}>{team.players.filter((candidate) => registered(side, team).includes(candidate.id)).map((candidate) => { const eligible = isEligibleForBattingOrder(lineup, candidate.id); const assigned = lineup.battingOrderIds.includes(candidate.id); return <Pressable key={`${side}-wizard-bat-${candidate.id}`} disabled={!target || !eligible} onPress={() => target && eligible && assignBattingOrder(side, team, target, candidate.id)} style={[styles.registrationChip, styles.registrationPlayerChip, assigned && styles.registrationChipActive, !eligible && styles.registrationChipIneligible]}><Text style={[styles.registrationChipNumber, assigned && styles.registrationChipTextActive, !eligible && styles.registrationChipIneligibleText]}>#{candidate.number}</Text><Text numberOfLines={1} style={[styles.registrationChipText, assigned && styles.registrationChipTextActive, !eligible && styles.registrationChipIneligibleText]}>{candidate.name} {playerHandAbbr(candidate)}</Text><Text numberOfLines={1} style={[styles.registrationChipPosition, assigned && styles.registrationChipTextActive, !eligible && styles.registrationChipIneligibleText]}>{positionLabel(candidate.id)}</Text></Pressable>; })}</ScrollView>
      </View>;
    };
    const defenseWorkspace = <View style={styles.wizardDefenseWorkspace}><View style={styles.wizardDefenseActionRow}><View style={styles.wizardDefenseActionCopy}><Text style={styles.wizardDefenseActionTitle}>主客守備互換</Text><Text style={styles.wizardDefenseActionHint}>{selectedDefensiveSwapPositions.length ? `已勾選 ${selectedDefensiveSwapPositions.length} 個守位；若對應配置不同，請同時勾選要交換的兩個守位。` : "未勾選守位時，會交換全隊守備配置。"}</Text></View><View style={styles.wizardDefenseSwapControls}><Pressable accessibilityRole="button" accessibilityLabel="全選所有守備位置" onPress={() => setSelectedDefensiveSwapPositions(FIELD_POSITIONS.map((position) => position.number))} style={({ pressed }) => [styles.wizardDefenseSwapAction, styles.wizardDefenseSelectionAction, pressed && styles.pressed]}><Text style={styles.wizardDefenseSelectionActionText}>全選</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="清除所有已選守備位置" disabled={!selectedDefensiveSwapPositions.length} onPress={() => setSelectedDefensiveSwapPositions([])} style={({ pressed }) => [styles.wizardDefenseSwapAction, styles.wizardDefenseClearAction, !selectedDefensiveSwapPositions.length && styles.wizardDefenseSwapActionDisabled, pressed && selectedDefensiveSwapPositions.length > 0 && styles.pressed]}><Text style={styles.wizardDefenseClearActionText}>清除</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="互換已勾選守備位置" disabled={!selectedDefensiveSwapPositions.length} onPress={() => swapHomeAwayDefensiveConfigurations(selectedDefensiveSwapPositions)} style={({ pressed }) => [styles.wizardDefenseSwapAction, styles.wizardDefensePartialSwapAction, !selectedDefensiveSwapPositions.length && styles.wizardDefenseSwapActionDisabled, pressed && selectedDefensiveSwapPositions.length > 0 && styles.pressed]}><Text style={styles.wizardDefenseSwapActionText}>⇄ 已選</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="一鍵互換主客守備配置" onPress={() => swapHomeAwayDefensiveConfigurations()} style={({ pressed }) => [styles.wizardDefenseSwapAction, pressed && styles.pressed]}><Text style={styles.wizardDefenseSwapActionText}>⇄ 全隊</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="復原上次守備互換" disabled={!lastDefensiveSwap} onPress={restoreLastDefensiveSwap} style={({ pressed }) => [styles.wizardDefenseSwapAction, styles.wizardDefenseRestoreAction, !lastDefensiveSwap && styles.wizardDefenseSwapActionDisabled, pressed && Boolean(lastDefensiveSwap) && styles.pressed]}><Text style={[styles.wizardDefenseSwapActionText, styles.wizardDefenseRestoreActionText]}>↶ 復原</Text></Pressable></View></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wizardDefensePositionChoices}>{FIELD_POSITIONS.map((position) => { const selected = selectedDefensiveSwapPositions.includes(position.number); const changed = changedSwapPositions.includes(position.number); return <Pressable key={`wizard-swap-position-${position.number}`} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleDefensiveSwapPosition(position.number)} style={({ pressed }) => [styles.wizardDefensePositionChoice, selected && styles.wizardDefensePositionChoiceActive, changed && styles.wizardDefensePositionChoiceChanged, pressed && styles.pressed]}><Text style={[styles.wizardDefensePositionChoiceText, selected && styles.wizardDefensePositionChoiceTextActive, changed && styles.wizardDefensePositionChoiceTextChanged]}>{position.number}{position.label}</Text></Pressable>; })}</ScrollView><View style={styles.wizardParallelDefense}>{defenseStage("away", away)}{defenseStage("home", home)}</View></View>;
    const body = wizardStep === 1 ? <View style={styles.wizardStepPanel}><Text style={styles.inputLabel}>盃賽／聯賽名稱</Text><TextInput value={form.competition} onChangeText={(competition) => onChange({ ...form, competition })} placeholder="例如：春季聯賽、校際盃" placeholderTextColor={BRAND.muted} style={styles.formInput} /><Text style={styles.inputLabel}>賽事名稱（可選）</Text><TextInput value={form.name} onChangeText={(name) => onChange({ ...form, name })} placeholder="未填時可於賽後補充" placeholderTextColor={BRAND.muted} style={styles.formInput} /></View> : wizardStep === 2 ? <View style={styles.wizardStepPanel}><Text style={styles.inputLabel}>年齡層級</Text><View style={styles.modalChoiceRow}>{AGE_GROUP_OPTIONS.map((ageGroup) => <Pressable key={ageGroup} onPress={() => onChange({ ...form, ageGroup })} style={[styles.inningsChoice, form.ageGroup === ageGroup && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, form.ageGroup === ageGroup && styles.modalChoiceTextActive]}>{ageGroup}</Text></Pressable>)}</View></View> : wizardStep === 3 ? <View style={styles.wizardStepPanel}><Text style={styles.inputLabel}>正規局數</Text><View style={styles.modalChoiceRow}>{([6, 7, 9, 15] as const).map((innings) => <Pressable key={innings} onPress={() => onChange({ ...form, maxInnings: innings })} style={[styles.inningsChoice, form.maxInnings === innings && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, form.maxInnings === innings && styles.modalChoiceTextActive]}>{innings} 局</Text></Pressable>)}</View><View style={styles.wizardPitchLimitPanel}><Text style={styles.inputLabel}>單一投手單場投球數門檻</Text><Text style={styles.wizardPitchLimitHint}>前 3 球開始預警；黃 ＜ 橘 ＜ 紅、各 1 至 300 球。開啟鍵盤後仍可上下拖曳並操作下方按鈕。</Text><View style={[styles.wizardPitchLimitRow, useCompactPitchLimitLayout && styles.wizardPitchLimitRowCompact]}>{(["黃", "橘", "紅"] as const).map((label, index) => <Animated.View key={label} style={[styles.wizardPitchLimitField, useCompactPitchLimitLayout && styles.wizardPitchLimitFieldCompact, focusedPitchLimit === index && styles.wizardPitchLimitFieldFocused, { transform: [{ scale: pitchLimitFocusScales[index] }] }]}><Text style={styles.wizardPitchLimitLabel}>{label}</Text><TextInput value={pitchLimitDraft[index]} onChangeText={(value) => setPitchLimitDraft((current) => { const next = [...current] as [string, string, string]; next[index] = value.replace(/[^0-9]/g, "").slice(0, 3); return next; })} onFocus={() => setFocusedPitchLimit(index)} onBlur={() => { setFocusedPitchLimit(null); commitPitchLimitThresholds(false); }} onSubmitEditing={() => { setFocusedPitchLimit(null); commitPitchLimitThresholds(false); Keyboard.dismiss(); }} keyboardType="numeric" returnKeyType="done" blurOnSubmit selectTextOnFocus style={[styles.wizardPitchLimitInput, useCompactPitchLimitLayout && styles.wizardPitchLimitInputCompact]} accessibilityLabel={`${label}色投球數門檻`} /><Text style={styles.wizardPitchLimitUnit}>球</Text></Animated.View>)}</View></View></View> : wizardStep === 4 ? <View style={styles.wizardStepPanel}><Text style={styles.inputLabel}>比賽場地</Text><TextInput value={form.venue} onChangeText={(venue) => onChange({ ...form, venue })} placeholder="例如：市立棒球場" placeholderTextColor={BRAND.muted} style={styles.formInput} /><Text style={styles.inputLabel}>比賽日期</Text><TextInput value={form.date} onChangeText={(date) => onChange({ ...form, date })} placeholder="YYYY-MM-DD" placeholderTextColor={BRAND.muted} style={styles.formInput} /></View> : wizardStep === 5 ? <View style={styles.wizardStepPanel}><Text style={styles.inputLabel}>天氣</Text><View style={styles.weatherChoiceRow}>{WEATHER_OPTIONS.map((option) => <Pressable key={option.value} onPress={() => onChange({ ...form, weather: option.value })} style={[styles.weatherChoice, form.weather === option.value && styles.weatherChoiceActive]}><Text style={styles.weatherIcon}>{option.icon}</Text><Text style={[styles.weatherChoiceText, form.weather === option.value && styles.modalChoiceTextActive]}>{option.label}</Text></Pressable>)}</View></View> : wizardStep === 6 ? teamStage("home", home) : wizardStep === 7 ? registrationStage("home", home) : wizardStep === 8 ? teamStage("away", away) : wizardStep === 9 ? registrationStage("away", away) : wizardStep === 10 ? defenseWorkspace : wizardStep === 11 ? battingStage("home", home) : wizardStep === 12 ? battingStage("away", away) : confirmationStage();
    function confirmationStage() {
      const lineupPreview = (side: "home" | "away", team?: Team) => {
        if (!team) return null;
        const lineup = lineupFor(side, team);
        const conflicts = getDefensivePositionConflicts(lineup);
        return <View key={`${side}-confirmation`} style={styles.wizardConfirmationTeam}><Text style={styles.wizardConfirmationTeamTitle}>{side === "home" ? "主場(先守)" : "客場(先攻)"} · {team.name}</Text><View style={styles.wizardConfirmationColumns}><View style={styles.wizardConfirmationRoster}>{lineup.battingOrderIds.map((playerId, index) => { const player = team.players.find((candidate) => candidate.id === playerId); const position = FIELD_POSITIONS.find((candidate) => candidate.number === lineup.defensivePositions[playerId] || candidate.label === lineup.defensivePositions[playerId]); const conflicted = conflicts.some((conflict) => conflict.playerIds.includes(playerId)); return <View key={`${side}-confirmation-${playerId}`} style={[styles.wizardConfirmationPlayer, conflicted && styles.wizardConfirmationPlayerConflict]}><Text style={[styles.wizardConfirmationPlayerText, conflicted && styles.wizardConfirmationPlayerTextConflict]}>{index + 1}棒　#{player?.number ?? "—"} {player?.name ?? "未指派"}</Text><Text style={[styles.wizardConfirmationPosition, conflicted && styles.wizardConfirmationPositionConflict]}>{conflicted ? "守位重複" : position ? `${position.number}${position.label}` : "未排守備"}</Text></View>; })}</View><View style={styles.wizardConfirmationField}><TopDownLineupField team={team} lineup={lineup} conflictedPositions={conflicts.map((conflict) => conflict.position)} highlightedPositions={changedSwapPositions} /></View></View>{renderConflictFixSuggestions(side, team, lineup, "confirmation")}</View>;
      };
      return <View style={styles.wizardConfirmationPanel}><Text style={styles.wizardConfirmationTitle}>送出前確認</Text><Text style={styles.wizardConfirmationHint}>請核對主客隊九人先發、棒次與守備位置；如需調整，可使用下方「上一步」返回修正。</Text><View style={styles.wizardConfirmationTeams}>{lineupPreview("home", home)}{lineupPreview("away", away)}</View></View>;
    }
    return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={[styles.modalSheet, styles.wizardModalSheet]}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.wizardKeyboardAvoiding}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>新增比賽</Text><Text style={styles.modalSubtitle}>建立流程 {wizardStep}/13 · {title}</Text></View><Pressable onPress={() => { Keyboard.dismiss(); setFocusedPitchLimit(null); onClose(); }}><Text style={styles.modalClose}>關閉</Text></Pressable></View><View style={styles.wizardProgressTrack}><View style={[styles.wizardProgressValue, { width: `${(wizardStep / 13) * 100}%` }]} /></View><ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.wizardScrollContent, wizardStep === 3 && styles.wizardScrollContentWithPitchLimit]}><Text style={styles.wizardStepTitle}>{wizardStep}. {title}</Text><Text style={styles.wizardStepHint}>{hint}</Text>{body}</ScrollView><View style={styles.wizardNavigation}><Button label={wizardStep === 13 ? "← 返回修正" : "↶ 復原本步"} onPress={() => { Keyboard.dismiss(); setFocusedPitchLimit(null); wizardStep === 13 ? setWizardStep(12) : reset(); }} variant="secondary" compact /><Button label="← 上一步" onPress={() => { Keyboard.dismiss(); setFocusedPitchLimit(null); setWizardStep((step) => Math.max(1, step - 1)); }} variant="secondary" compact disabled={wizardStep === 1} /><Button label={wizardStep === 13 ? "確認建立比賽" : "下一步 →"} onPress={next} compact /></View></KeyboardAvoidingView></View></View></Modal>;
  }
  const wizardStageTitle = ["盃賽名稱", "年齡層級", "正規局數", "比賽場地", "天氣", "主場(先守)球隊", "主場(先守)登錄球員", "主場(先守)守備位置", "主場(先守)排定棒次", "客場(先攻)球隊", "客場(先攻)登錄球員", "客場(先攻)守備位置", "客場(先攻)排定棒次", "主客先發確認"][wizardStep - 1] ?? "新增比賽";
  const wizardStageHint = ["輸入本場的盃賽或聯賽名稱。", "選擇本場適用的正式年齡組別。", "選擇正規局數；平手時會自動延長。", "輸入比賽場地及日期。", "選擇本場天候。", "套用既有球隊，或立即建立主場(先守)球隊。", "確認主場(先守)本場可出賽名單。", "為主場(先守)先發九人指派守備位置。", "依背號指派主場(先守)第 1 至第 9 棒。", "套用既有球隊，或立即建立客場(先攻)球隊。", "確認客場(先攻)本場可出賽名單。", "為客場(先攻)先發九人指派守備位置。", "依背號指派客場(先攻)第 1 至第 9 棒。", "送出前核對兩隊先發名單、棒次與守備位置圖。"][wizardStep - 1] ?? "";
  const isWizardStageValid = () => {
    const homeLineup = lineupFor("home", home); const awayLineup = lineupFor("away", away);
    if (wizardStep === 1) return Boolean(form.competition.trim());
    if (wizardStep === 4) return Boolean(form.venue.trim());
    if (wizardStep === 6) return Boolean(home);
    if (wizardStep === 7) return Boolean(home && registered("home", home).length >= 9);
    if (wizardStep === 8) return Boolean(home && getLineupCompleteness(homeLineup, registered("home", home)).defensivePositionCount >= 9 && !getDefensivePositionConflicts(homeLineup).length);
    if (wizardStep === 9) return Boolean(home && getLineupCompleteness(homeLineup, registered("home", home)).battingOrderCount >= 9);
    if (wizardStep === 10) return Boolean(away);
    if (wizardStep === 11) return Boolean(away && registered("away", away).length >= 9);
    if (wizardStep === 12) return Boolean(away && getLineupCompleteness(awayLineup, registered("away", away)).defensivePositionCount >= 9 && !getDefensivePositionConflicts(awayLineup).length);
    if (wizardStep === 13) return Boolean(away && getLineupCompleteness(awayLineup, registered("away", away)).battingOrderCount >= 9);
    return true;
  };
  const resetWizardStage = () => {
    const emptyLineup: GameLineup = { battingOrderIds: [], defensivePositions: {} };
    if (wizardStep === 1) onChange({ ...form, competition: "", name: "" });
    else if (wizardStep === 4) onChange({ ...form, venue: "" });
    else if (wizardStep === 6) onChange({ ...form, homeTeamId: "", homeRegisteredPlayerIds: [], homeLineup: emptyLineup });
    else if (wizardStep === 7) onChange({ ...form, homeRegisteredPlayerIds: [], homeLineup: emptyLineup });
    else if (wizardStep === 8 && home) onChange({ ...form, homeLineup: { ...lineupFor("home", home), defensivePositions: {} } });
    else if (wizardStep === 9 && home) onChange({ ...form, homeLineup: { ...lineupFor("home", home), battingOrderIds: [] } });
    else if (wizardStep === 10) onChange({ ...form, awayTeamId: "", awayRegisteredPlayerIds: [], awayLineup: emptyLineup });
    else if (wizardStep === 11) onChange({ ...form, awayRegisteredPlayerIds: [], awayLineup: emptyLineup });
    else if (wizardStep === 12 && away) onChange({ ...form, awayLineup: { ...lineupFor("away", away), defensivePositions: {} } });
    else if (wizardStep === 13 && away) onChange({ ...form, awayLineup: { ...lineupFor("away", away), battingOrderIds: [] } });
  };
  const moveWizardForward = () => {
    if (!isWizardStageValid()) { Alert.alert("尚未完成本步", `${wizardStageTitle}需完成後才能繼續。請確認必要資料、九位登錄球員與無重複守備位置。`); return; }
    if (wizardStep === 13) { onChange({ ...form, name: form.name.trim() || `${form.competition.trim()}｜${form.ageGroup}` }); onSubmit(); return; }
    setWizardStep((step) => step + 1);
  };
  const wizardTeamStage = (side: "away" | "home", selected?: Team) => <View style={styles.wizardStepPanel}><Text style={styles.inputLabel}>選擇{side === "home" ? "主場" : "客場"}球隊</Text><View style={styles.modalChoiceRow}>{teams.map((team) => <Pressable key={`${side}-wizard-${team.id}`} onPress={() => setTeam(side, team)} style={[styles.modalChoice, selected?.id === team.id && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, selected?.id === team.id && styles.modalChoiceTextActive]}>{team.name}</Text></Pressable>)}</View><Text style={styles.wizardMinorLabel}>或當下建立新球隊</Text><View style={styles.wizardCreateTeamRow}><TextInput value={teamNameDraft} onChangeText={setTeamNameDraft} placeholder="學校或球隊名稱" placeholderTextColor={BRAND.muted} style={[styles.formInput, styles.wizardCreateTeamInput]} /><Button label="建立並套用" onPress={() => createTeamForSide(side)} compact /></View></View>;
  const wizardRegistrationStage = (side: "away" | "home", team?: Team) => !team ? <Text style={styles.mutedText}>請先返回並選擇球隊。</Text> : <View style={styles.registrationPanel}><View style={styles.registrationHeader}><Text style={styles.registrationTitle}>{side === "home" ? "主場" : "客場"}登錄球員</Text><Text style={styles.registrationCount}>{registered(side, team).length}/{Math.min(team.players.length, 25)} 人</Text></View><Text style={styles.registrationHint}>請至少選擇 9 位本場可出賽球員；未登錄者不納入單場統計。</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.registrationList}>{team.players.slice(0, 25).map((player) => { const selected = registered(side, team).includes(player.id); return <Pressable key={`${side}-wizard-reg-${player.id}`} onPress={() => togglePlayer(side, team, player.id)} style={[styles.registrationChip, selected && styles.registrationChipActive]}><Text style={[styles.registrationChipNumber, selected && styles.registrationChipTextActive]}>#{player.number}</Text><Text style={[styles.registrationChipText, selected && styles.registrationChipTextActive]}>{player.name}</Text></Pressable>; })}</ScrollView></View>;
  const wizardBattingStage = (side: "away" | "home", team?: Team) => {
    if (!team) return <Text style={styles.mutedText}>請先返回並選擇球隊。</Text>;
    const lineup = lineupFor(side, team); const target = battingOrderTarget?.side === side ? battingOrderTarget.order : undefined; const registeredIds = registered(side, team);
    return <View style={styles.registrationPanel}><Text style={styles.registrationTitle}>{side === "home" ? "主場" : "客場"}棒次排定</Text><Text style={styles.registrationHint}>先選第 1 至第 9 棒，再以背號指派登錄球員；重選會自動替換該棒次。</Text><View style={styles.wizardOrderRow}>{Array.from({ length: 9 }, (_, index) => index + 1).map((order) => { const player = team.players.find((candidate) => candidate.id === lineup.battingOrderIds[order - 1]); return <Pressable key={`${side}-wizard-order-${order}`} onPress={() => setBattingOrderTarget({ side, order })} style={[styles.wizardOrderChip, target === order && styles.wizardOrderChipActive]}><Text style={[styles.wizardOrderLabel, target === order && styles.wizardOrderTextActive]}>{order}棒</Text><Text numberOfLines={1} style={[styles.wizardOrderValue, target === order && styles.wizardOrderTextActive]}>{player ? `#${player.number} ${player.name}` : "未排"}</Text></Pressable>; })}</View><Text style={styles.defensivePickerLabel}>{target ? `第 ${target} 棒：選擇背號` : "請先點選要排定的棒次"}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.registrationList}>{team.players.filter((player) => registeredIds.includes(player.id)).map((player) => <Pressable key={`${side}-wizard-bat-${player.id}`} disabled={!target} onPress={() => target && assignBattingOrder(side, team, target, player.id)} style={[styles.registrationChip, lineup.battingOrderIds.includes(player.id) && styles.registrationChipActive]}><Text style={[styles.registrationChipNumber, lineup.battingOrderIds.includes(player.id) && styles.registrationChipTextActive]}>#{player.number}</Text><Text style={[styles.registrationChipText, lineup.battingOrderIds.includes(player.id) && styles.registrationChipTextActive]}>{player.name}</Text></Pressable>)}</ScrollView></View>;
  };
  const registrationPicker = (side: "away" | "home", team?: Team) => {
    if (!team) return null;
    const lineup = lineupFor(side, team); const completeness = getLineupCompleteness(lineup, registered(side, team)); const conflicts = getDefensivePositionConflicts(lineup); const conflictPositions = conflicts.map((conflict) => conflict.position);
    const missing = [`棒次 ${completeness.battingOrderCount}/9`, `守備 ${completeness.defensivePositionCount}/9`].filter((entry, index) => index === 0 ? completeness.battingOrderCount < 9 : completeness.defensivePositionCount < 9);
    const activePlayer = activeLineupTarget?.side === side ? team.players.find((player) => player.id === activeLineupTarget.playerId) : undefined;
    const activePosition = activePlayer ? FIELD_POSITIONS.find((position) => position.number === lineup.defensivePositions[activePlayer.id] || position.label === lineup.defensivePositions[activePlayer.id])?.number : undefined;
    return <View style={styles.registrationPanel}>
      <View style={styles.registrationHeader}><Text style={styles.registrationTitle}>{side === "away" ? "客隊" : "主隊"}本場登錄</Text><Text style={styles.registrationCount}>{registered(side, team).length}/{Math.min(team.players.length, 25)} 人</Text></View>
      <Text style={styles.registrationHint}>固定名單最多 25 人；未登錄者不納入單場統計。</Text>
      <View style={styles.lineupQuickRow}><Pressable onPress={() => applyCommonLineup(side, team)} style={styles.lineupQuickAction}><Text style={styles.lineupQuickActionText}>⚡ 套用常用先發九人</Text></Pressable><Pressable onPress={() => copyLatestGameLineup(side, team)} style={[styles.lineupQuickAction, styles.lineupQuickActionSecondary]}><Text style={[styles.lineupQuickActionText, styles.lineupQuickActionSecondaryText]}>▣ 複製最近場次</Text></Pressable></View>
      <View style={[styles.lineupReadiness, completeness.complete && !conflicts.length ? styles.lineupReadinessComplete : styles.lineupReadinessPending]}><Text style={[styles.lineupReadinessTitle, completeness.complete && !conflicts.length ? styles.lineupReadinessTextComplete : styles.lineupReadinessTextPending]}>{completeness.complete && !conflicts.length ? "✓ 先發配置已完成" : `! 尚未完成：${missing.join("、") || "守備重複"}`}</Text><Text style={styles.lineupReadinessHint}>守位重複會以紅色提示；互換模式下依序點選兩位球員即可交換守位。</Text></View>
      {conflicts.length ? <View style={styles.lineupConflictNotice}><Text style={styles.lineupConflictNoticeText}>守備衝突：{conflicts.map((conflict) => `${conflict.position}號守位`).join("、")} 被重複指派，請改派或互換。</Text></View> : null}
      <View style={styles.lineupFieldWorkspace}><View style={styles.lineupAssignmentPane}><View style={styles.lineupBuilderHeader}><View><Text style={styles.lineupBuilderTitle}>棒次／守備排定</Text><Text style={styles.lineupBuilderHint}>{swapMode ? "互換模式：依序點選兩位球員" : "點選棒次後，再選擇守位。"}</Text></View><Pressable onPress={() => { setSwapMode((enabled) => !enabled); setSwapPlayerIds([]); }} style={[styles.swapModeButton, swapMode && styles.swapModeButtonActive]}><Text style={[styles.swapModeButtonText, swapMode && styles.swapModeButtonTextActive]}>{swapMode ? "取消互換" : "⇄ 互換守位"}</Text></Pressable></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lineupPreviewRow}>{lineup.battingOrderIds.map((playerId, index) => { const player = team.players.find((candidate) => candidate.id === playerId); const selectedTarget = activeLineupTarget?.side === side && activeLineupTarget.playerId === playerId; const position = FIELD_POSITIONS.find((candidate) => candidate.number === lineup.defensivePositions[playerId] || candidate.label === lineup.defensivePositions[playerId]); const conflicted = conflicts.some((conflict) => conflict.playerIds.includes(playerId)); const swapSelected = swapPlayerIds.includes(playerId); return <Pressable key={`${side}-lineup-${playerId}`} onPress={() => selectLineupPlayer(side, team, playerId)} style={[styles.lineupPreviewChip, selectedTarget && styles.lineupPreviewChipActive, conflicted && styles.lineupPreviewChipConflict, swapSelected && styles.lineupPreviewChipSwapSelected]}><Text style={styles.lineupPreviewOrder}>{index + 1}棒</Text><Text numberOfLines={1} style={styles.lineupPreviewPlayer}>{player ? `#${player.number} ${player.name}` : "未排"}</Text><Text style={[styles.lineupPreviewPosition, conflicted && styles.lineupPreviewPositionConflict]}>{conflicted ? "守位重複" : position ? `${position.number}${position.label}` : "選守備"}</Text></Pressable>; })}</ScrollView>
        <View style={styles.defensivePicker}><Text style={styles.defensivePickerLabel}>{activePlayer ? `第 ${lineup.battingOrderIds.indexOf(activePlayer.id) + 1} 棒 #${activePlayer.number}：選擇守位` : "請先點選一位先發棒次"}</Text><View style={styles.defensivePositionRow}>{FIELD_POSITIONS.map((position) => { const selected = activePosition === position.number; const conflicted = selected && conflictPositions.includes(position.number); return <Pressable key={`${side}-position-${position.number}`} disabled={!activePlayer || swapMode} onPress={() => activePlayer && setDefensivePosition(side, team, activePlayer.id, position.number)} style={[styles.defensivePositionChip, selected && styles.defensivePositionChipActive, conflicted && styles.defensivePositionChipConflict]}><Text style={[styles.defensivePositionNumber, selected && styles.defensivePositionTextActive]}>{position.number}</Text><Text style={[styles.defensivePositionLabel, selected && styles.defensivePositionTextActive]}>{position.label}</Text></Pressable>; })}</View>{activePlayer ? <Pressable onPress={() => setDefensivePosition(side, team, activePlayer.id, null)} style={styles.clearDefensivePosition}><Text style={styles.clearDefensivePositionText}>清除 #${activePlayer.number} 守備位置</Text></Pressable> : null}</View>
      </View><View style={styles.lineupFieldPreview}><Text style={styles.lineupBuilderTitle}>守備位置配置圖</Text><Text style={styles.lineupBuilderHint}>正規棒球場俯視圖；紅色為衝突守位。</Text><TopDownLineupField team={team} lineup={lineup} conflictedPositions={conflictPositions} /></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.registrationList}>{team.players.slice(0, 25).map((player) => { const selected = registered(side, team).includes(player.id); return <Pressable key={`${side}-${player.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => togglePlayer(side, team, player.id)} style={[styles.registrationChip, selected && styles.registrationChipActive]}><Text style={[styles.registrationChipNumber, selected && styles.registrationChipTextActive]}>#{player.number}</Text><Text style={[styles.registrationChipText, selected && styles.registrationChipTextActive]}>{player.name}</Text></Pressable>; })}</ScrollView>
    </View>;
  };
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><Text style={styles.modalTitle}>新增比賽</Text><Pressable onPress={onClose}><Text style={styles.modalClose}>關閉</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false}><Text style={styles.inputLabel}>賽事名稱</Text><TextInput value={form.name} onChangeText={(name) => onChange({ ...form, name })} placeholder="例如：春季聯賽第 3 場" placeholderTextColor={BRAND.muted} style={styles.formInput} /><Text style={styles.inputLabel}>盃賽／聯賽分類</Text><TextInput value={form.competition} onChangeText={(competition) => onChange({ ...form, competition })} placeholder="例如：春季聯賽、校際盃（選填）" placeholderTextColor={BRAND.muted} style={styles.formInput} /><Text style={styles.inputLabel}>比賽場地</Text><TextInput value={form.venue} onChangeText={(venue) => onChange({ ...form, venue })} placeholder="例如：市立棒球場" placeholderTextColor={BRAND.muted} style={styles.formInput} /><View style={styles.modalDateTimeRow}><View style={styles.modalDateTimeCol}><Text style={styles.inputLabel}>比賽日期</Text><TextInput value={form.date} onChangeText={(date) => onChange({ ...form, date })} placeholder="YYYY-MM-DD" placeholderTextColor={BRAND.muted} style={styles.formInput} {...({ type: "date" } as any)} /></View><View style={styles.modalDateTimeCol}><Text style={styles.inputLabel}>開賽時間</Text><TextInput value={form.time} onChangeText={(time) => onChange({ ...form, time })} placeholder="08:00" placeholderTextColor={BRAND.muted} style={styles.formInput} {...({ type: "time" } as any)} /></View></View><Text style={styles.inputLabel}>天氣</Text><View style={styles.weatherChoiceRow}>{WEATHER_OPTIONS.map((option) => <Pressable key={option.value} onPress={() => onChange({ ...form, weather: option.value })} style={[styles.weatherChoice, form.weather === option.value && styles.weatherChoiceActive]}><Text style={styles.weatherIcon}>{option.icon}</Text><Text style={[styles.weatherChoiceText, form.weather === option.value && styles.modalChoiceTextActive]}>{option.label}</Text></Pressable>)}</View><Text style={styles.inputLabel}>客場球隊</Text><View style={styles.modalChoiceRow}>{teams.map((team) => <Pressable key={`away-${team.id}`} onPress={() => setTeam("away", team)} style={[styles.modalChoice, form.awayTeamId === team.id && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, form.awayTeamId === team.id && styles.modalChoiceTextActive]}>{team.name}</Text></Pressable>)}</View>{registrationPicker("away", away)}<Text style={styles.inputLabel}>主場球隊</Text><View style={styles.modalChoiceRow}>{teams.map((team) => <Pressable key={`home-${team.id}`} onPress={() => setTeam("home", team)} style={[styles.modalChoice, form.homeTeamId === team.id && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, form.homeTeamId === team.id && styles.modalChoiceTextActive]}>{team.name}</Text></Pressable>)}</View>{registrationPicker("home", home)}<Text style={styles.inputLabel}>比賽局數</Text><View style={styles.modalChoiceRow}>{([6, 7, 9, 15] as const).map((innings) => <Pressable key={innings} onPress={() => onChange({ ...form, maxInnings: innings })} style={[styles.inningsChoice, form.maxInnings === innings && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, form.maxInnings === innings && styles.modalChoiceTextActive]}>{innings} 局</Text></Pressable>)}</View><Button label="建立比賽並進入紀錄" onPress={onSubmit} /></ScrollView></View></View></Modal>;
}

/*
function NewGameModalLegacy({ visible, form, teams, games, onChange, onClose, onSubmit }: { visible: boolean; form: NewGameForm; teams: Team[]; games: Game[]; onChange: (form: NewGameForm) => void; onClose: () => void; onSubmit: () => void }) {
  const [activeLineupTarget, setActiveLineupTarget] = useState<{ side: "away" | "home"; playerId: string } | null>(null);
  const away = teams.find((team) => team.id === form.awayTeamId);
  const home = teams.find((team) => team.id === form.homeTeamId);
  const registered = (side: "away" | "home", team?: Team) => {
    const ids = side === "away" ? form.awayRegisteredPlayerIds : form.homeRegisteredPlayerIds;
    return ids.length ? ids : (team?.players.slice(0, 25).map((player) => player.id) ?? []);
  };
  const updateTeamSetup = (side: "away" | "home", registeredPlayerIds: string[], lineup: GameLineup) => {
    onChange(side === "away" ? { ...form, awayRegisteredPlayerIds: registeredPlayerIds, awayLineup: lineup } : { ...form, homeRegisteredPlayerIds: registeredPlayerIds, homeLineup: lineup });
  };
  const lineupFor = (side: "away" | "home", team?: Team) => (side === "away" ? form.awayLineup : form.homeLineup) ?? (team ? createLineupSnapshot(team, registered(side, team)) : { battingOrderIds: [], defensivePositions: {} });
  const setTeam = (side: "away" | "home", team: Team) => {
    const ids = team.players.slice(0, 25).map((player) => player.id);
    const lineup = createLineupSnapshot(team, ids);
    onChange(side === "away" ? { ...form, awayTeamId: team.id, awayRegisteredPlayerIds: ids, awayLineup: lineup } : { ...form, homeTeamId: team.id, homeRegisteredPlayerIds: ids, homeLineup: lineup });
  };
  const togglePlayer = (side: "away" | "home", team: Team, playerId: string) => {
    const current = registered(side, team);
    const hasPlayer = current.includes(playerId);
    const next = hasPlayer ? current.filter((id) => id !== playerId) : [...current, playerId];
    const previousLineup = lineupFor(side, team);
    const defensivePositions = { ...previousLineup.defensivePositions };
    if (hasPlayer) delete defensivePositions[playerId];
    updateTeamSetup(side, next, { battingOrderIds: previousLineup.battingOrderIds.filter((id) => id !== playerId), defensivePositions });
  };
  const applyCommonLineup = (side: "away" | "home", team: Team) => updateTeamSetup(side, registered(side, team), createLineupSnapshot(team, registered(side, team)));
  const setDefensivePosition = (side: "away" | "home", team: Team, playerId: string, nextPosition: string | null) => {
    const previousLineup = lineupFor(side, team);
    const normalizedPosition = nextPosition ? FIELD_POSITIONS.find((position) => position.number === nextPosition || position.label === nextPosition)?.number ?? nextPosition : null;
    const defensivePositions = Object.fromEntries(Object.entries(previousLineup.defensivePositions).filter(([assignedPlayerId, position]) => {
      if (assignedPlayerId === playerId) return false;
      const normalizedAssigned = FIELD_POSITIONS.find((candidate) => candidate.number === position || candidate.label === position)?.number ?? position;
      return normalizedAssigned !== normalizedPosition;
    }));
    if (normalizedPosition) defensivePositions[playerId] = normalizedPosition;
    updateTeamSetup(side, registered(side, team), { ...previousLineup, defensivePositions });
  };
  const copyLatestGameLineup = (side: "away" | "home", team: Team) => {
    const source = games.find((game) => game.awayTeamId === team.id || game.homeTeamId === team.id);
    if (!source) { Alert.alert("尚無可複製配置", `${team.name} 尚未建立過含先發配置的場次。`); return; }
    const sourceIsAway = source.awayTeamId === team.id;
    const sourceRegistered = sourceIsAway ? source.awayRegisteredPlayerIds : source.homeRegisteredPlayerIds;
    const sourceLineup = sourceIsAway ? source.awayLineup : source.homeLineup;
    const validIds = (sourceRegistered?.length ? sourceRegistered : team.players.slice(0, 25).map((player) => player.id)).filter((playerId) => team.players.some((player) => player.id === playerId));
    updateTeamSetup(side, validIds, sourceLineup ?? createLineupSnapshot(team, validIds));
  };
  const registrationPicker = (side: "away" | "home", team?: Team) => {
    if (!team) return null;
    const lineup = lineupFor(side, team);
    const completeness = getLineupCompleteness(lineup, registered(side, team));
    const missing: string[] = [];
    if (completeness.battingOrderCount < 9) missing.push(`棒次 ${completeness.battingOrderCount}/9`);
    if (completeness.defensivePositionCount < 9) missing.push(`守備 ${completeness.defensivePositionCount}/9`);
    const activePlayer = activeLineupTarget?.side === side ? team.players.find((player) => player.id === activeLineupTarget.playerId) : undefined;
    const activePosition = activePlayer ? FIELD_POSITIONS.find((position) => position.number === lineup.defensivePositions[activePlayer.id] || position.label === lineup.defensivePositions[activePlayer.id])?.number : undefined;
    return <View style={styles.registrationPanel}><View style={styles.registrationHeader}><Text style={styles.registrationTitle}>{side === "away" ? "客隊" : "主隊"}本場登錄與先發</Text><Text style={styles.registrationCount}>{registered(side, team).length}/{Math.min(team.players.length, 25)} 人</Text></View><Text style={styles.registrationHint}>建立此場比賽時，請在此直接完成登錄、棒次與守備；未登錄者不納入單場統計。</Text><View style={styles.lineupQuickRow}><Pressable onPress={() => applyCommonLineup(side, team)} style={styles.lineupQuickAction}><Text style={styles.lineupQuickActionText}>⚡ 套用常用先發九人</Text></Pressable><Pressable onPress={() => copyLatestGameLineup(side, team)} style={[styles.lineupQuickAction, styles.lineupQuickActionSecondary]}><Text style={[styles.lineupQuickActionText, styles.lineupQuickActionSecondaryText]}>▣ 複製最近場次</Text></Pressable></View><View style={[styles.lineupReadiness, completeness.complete ? styles.lineupReadinessComplete : styles.lineupReadinessPending]}><Text style={[styles.lineupReadinessTitle, completeness.complete ? styles.lineupReadinessTextComplete : styles.lineupReadinessTextPending]}>{completeness.complete ? "✓ 先發配置已完成" : `! 尚未完成：${missing.join("、")}`}</Text><Text style={styles.lineupReadinessHint}>點選下方棒次，再選守備位置；同一守位會自動改派為目前選擇的球員。</Text></View><View style={styles.newGameLineupFlow}><Text style={styles.newGameLineupFlowTitle}>建立賽事第 2 步 · 先發棒次與守備排定</Text><Text style={styles.newGameLineupFlowText}>下方設定會一併儲存為本場先發快照，並直接決定現場紀錄的打者輪替順序。</Text></View><View style={styles.lineupFieldWorkspace}><View style={styles.lineupAssignmentPane}><Text style={styles.lineupBuilderTitle}>本場棒次／守備排定</Text><Text style={styles.lineupBuilderHint}>先點選棒次，再點選守位。</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lineupPreviewRow}>{lineup.battingOrderIds.map((playerId, index) => { const player = team.players.find((candidate) => candidate.id === playerId); const selectedTarget = activeLineupTarget?.side === side && activeLineupTarget.playerId === playerId; const position = FIELD_POSITIONS.find((candidate) => candidate.number === lineup.defensivePositions[playerId] || candidate.label === lineup.defensivePositions[playerId]); return <Pressable key={`${side}-lineup-${playerId}`} accessibilityRole="button" accessibilityLabel={`第 ${index + 1} 棒 ${player?.number ?? ""}號，${position?.label ?? "未排守備"}`} onPress={() => setActiveLineupTarget({ side, playerId })} style={[styles.lineupPreviewChip, selectedTarget && styles.lineupPreviewChipActive]}><Text style={styles.lineupPreviewOrder}>{index + 1}棒</Text><Text style={styles.lineupPreviewPlayer}>#{player?.number ?? "—"}</Text><Text style={styles.lineupPreviewPosition}>{position ? `${position.number}${position.label}` : "選守備"}</Text></Pressable>; })}</ScrollView><View style={styles.defensivePicker}><Text style={styles.defensivePickerLabel}>{activePlayer ? `第 ${lineup.battingOrderIds.indexOf(activePlayer.id) + 1} 棒 #${activePlayer.number}：選擇守位` : "請先點選一位先發棒次"}</Text><View style={styles.defensivePositionRow}>{FIELD_POSITIONS.map((position) => { const occupied = Object.entries(lineup.defensivePositions).some(([playerId, assigned]) => playerId !== activePlayer?.id && (assigned === position.number || assigned === position.label)); const selected = activePosition === position.number; return <Pressable key={`${side}-position-${position.number}`} disabled={!activePlayer} onPress={() => activePlayer && setDefensivePosition(side, team, activePlayer.id, position.number)} style={[styles.defensivePositionChip, selected && styles.defensivePositionChipActive, occupied && !selected && styles.defensivePositionChipOccupied]}><Text style={[styles.defensivePositionNumber, selected && styles.defensivePositionTextActive]}>{position.number}</Text><Text style={[styles.defensivePositionLabel, selected && styles.defensivePositionTextActive]}>{position.label}</Text></Pressable>; })}</View>{activePlayer ? <Pressable onPress={() => setDefensivePosition(side, team, activePlayer.id, null)} style={styles.clearDefensivePosition}><Text style={styles.clearDefensivePositionText}>清除 #${activePlayer.number} 守備位置</Text></Pressable> : null}</View></View><View style={styles.lineupFieldPreview}><Text style={styles.lineupBuilderTitle}>守備位置配置圖</Text><Text style={styles.lineupBuilderHint}>正規棒球場俯視圖；數字為守備代號。</Text><TopDownLineupField team={team} lineup={lineup} /></View></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.registrationList}>{team.players.slice(0, 25).map((player) => { const selected = registered(side, team).includes(player.id); return <Pressable key={`${side}-${player.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => togglePlayer(side, team, player.id)} style={[styles.registrationChip, selected && styles.registrationChipActive]}><Text style={[styles.registrationChipNumber, selected && styles.registrationChipTextActive]}>#{player.number}</Text><Text style={[styles.registrationChipText, selected && styles.registrationChipTextActive]}>{player.name}</Text></Pressable>; })}</ScrollView></View>;
  };
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><Text style={styles.modalTitle}>新增比賽</Text><Pressable onPress={onClose}><Text style={styles.modalClose}>關閉</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false}><Text style={styles.inputLabel}>賽事名稱</Text><TextInput value={form.name} onChangeText={(name) => onChange({ ...form, name })} placeholder="例如：春季聯賽第 3 場" placeholderTextColor={BRAND.muted} style={styles.formInput} /><Text style={styles.inputLabel}>盃賽／聯賽分類</Text><TextInput value={form.competition} onChangeText={(competition) => onChange({ ...form, competition })} placeholder="例如：春季聯賽、校際盃（選填）" placeholderTextColor={BRAND.muted} style={styles.formInput} /><Text style={styles.inputLabel}>比賽場地</Text><TextInput value={form.venue} onChangeText={(venue) => onChange({ ...form, venue })} placeholder="例如：市立棒球場" placeholderTextColor={BRAND.muted} style={styles.formInput} /><Text style={styles.inputLabel}>比賽日期</Text><TextInput value={form.date} onChangeText={(date) => onChange({ ...form, date })} placeholder="YYYY-MM-DD" placeholderTextColor={BRAND.muted} style={styles.formInput} /><Text style={styles.inputLabel}>天氣</Text><View style={styles.weatherChoiceRow}>{WEATHER_OPTIONS.map((option) => <Pressable key={option.value} onPress={() => onChange({ ...form, weather: option.value })} style={[styles.weatherChoice, form.weather === option.value && styles.weatherChoiceActive]}><Text style={styles.weatherIcon}>{option.icon}</Text><Text style={[styles.weatherChoiceText, form.weather === option.value && styles.modalChoiceTextActive]}>{option.label}</Text></Pressable>)}</View><Text style={styles.inputLabel}>客場球隊</Text><View style={styles.modalChoiceRow}>{teams.map((team) => <Pressable key={`away-${team.id}`} onPress={() => setTeam("away", team)} style={[styles.modalChoice, form.awayTeamId === team.id && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, form.awayTeamId === team.id && styles.modalChoiceTextActive]}>{team.name}</Text></Pressable>)}</View>{registrationPicker("away", away)}<Text style={styles.inputLabel}>主場球隊</Text><View style={styles.modalChoiceRow}>{teams.map((team) => <Pressable key={`home-${team.id}`} onPress={() => setTeam("home", team)} style={[styles.modalChoice, form.homeTeamId === team.id && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, form.homeTeamId === team.id && styles.modalChoiceTextActive]}>{team.name}</Text></Pressable>)}</View>{registrationPicker("home", home)}<Text style={styles.inputLabel}>比賽局數</Text><View style={styles.modalChoiceRow}>{([6, 7, 9, 15] as const).map((innings) => <Pressable key={innings} onPress={() => onChange({ ...form, maxInnings: innings })} style={[styles.inningsChoice, form.maxInnings === innings && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, form.maxInnings === innings && styles.modalChoiceTextActive]}>{innings} 局</Text></Pressable>)}</View><Button label="建立比賽並進入紀錄" onPress={onSubmit} /></ScrollView></View></View></Modal>;
}

*/
function EditGameModal({ visible, game, onClose, onSave }: { visible: boolean; game: Game; onClose: () => void; onSave: (patch: Partial<Game>) => void }) {
  const [name, setName] = useState(game.name);
  const [competition, setCompetition] = useState(game.competition ?? "");
  const [venue, setVenue] = useState(game.venue);
  const [notes, setNotes] = useState(game.notes);
  useEffect(() => { if (visible) { setName(game.name); setCompetition(game.competition ?? ""); setVenue(game.venue); setNotes(game.notes); } }, [visible, game.name, game.competition, game.venue, game.notes]);
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><Text style={styles.modalTitle}>賽事資訊與備註</Text><Pressable onPress={onClose}><Text style={styles.modalClose}>關閉</Text></Pressable></View><Text style={styles.inputLabel}>賽事名稱</Text><TextInput value={name} onChangeText={setName} style={styles.formInput} placeholderTextColor={BRAND.muted} /><Text style={styles.inputLabel}>盃賽／聯賽分類</Text><TextInput value={competition} onChangeText={setCompetition} style={styles.formInput} placeholder="例如：春季聯賽、校際盃" placeholderTextColor={BRAND.muted} /><Text style={styles.inputLabel}>比賽場地</Text><TextInput value={venue} onChangeText={setVenue} style={styles.formInput} placeholderTextColor={BRAND.muted} /><Text style={styles.inputLabel}>逐場備註</Text><TextInput value={notes} onChangeText={setNotes} style={[styles.formInput, styles.notesInput]} placeholder="記錄天氣、裁判、特殊規則或教練備註" placeholderTextColor={BRAND.muted} multiline textAlignVertical="top" /><Button label="儲存變更" onPress={() => onSave({ name, competition, venue, notes })} /></View></View></Modal>;
}

function LegacySubstitutionModal({ visible, game, teams, initialType, onClose, onSubmit }: { visible: boolean; game: Game; teams: Team[]; initialType: SubstitutionType; onClose: () => void; onSubmit: (substitution: Omit<Substitution, "id" | "timestamp">) => void }) {
  const [teamId, setTeamId] = useState(game.awayTeamId);
  const [playerOutId, setPlayerOutId] = useState(teams.find((team) => team.id === game.awayTeamId)?.players[0]?.id ?? "");
  const [playerInId, setPlayerInId] = useState(teams.find((team) => team.id === game.awayTeamId)?.players[1]?.id ?? "");
  const [position, setPosition] = useState("代打");
  const [type, setType] = useState<SubstitutionType>(initialType);
  const team = teams.find((candidate) => candidate.id === teamId) ?? teams[0];
  useEffect(() => {
    setPlayerOutId(team?.players[0]?.id ?? "");
    setPlayerInId(team?.players[1]?.id ?? "");
    setPosition(team?.players[0]?.position ?? "代打");
  }, [teamId]);
  useEffect(() => { if (visible) { setType(initialType); setPosition(initialType === "換守" ? (team?.players.find((player) => player.id === playerInId)?.position ?? "游擊") : initialType); } }, [initialType, playerInId, team, visible]);
  if (!team) return null;
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><Text style={styles.modalTitle}>新增換人紀錄</Text><Pressable onPress={onClose}><Text style={styles.modalClose}>關閉</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}><Text style={styles.inputLabel}>換人類型</Text><View style={styles.modalChoiceRow}>{(["代打", "代跑", "換投", "換守"] as SubstitutionType[]).map((choice) => <Pressable key={choice} onPress={() => { setType(choice); if (choice !== "換守") setPosition(choice); }} style={[styles.modalChoice, type === choice && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, type === choice && styles.modalChoiceTextActive]}>{choice}</Text></Pressable>)}</View><Text style={styles.inputLabel}>換人球隊</Text><View style={styles.modalChoiceRow}>{teams.map((candidate) => <Pressable key={candidate.id} onPress={() => setTeamId(candidate.id)} style={[styles.modalChoice, teamId === candidate.id && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, teamId === candidate.id && styles.modalChoiceTextActive]}>{candidate.name}</Text></Pressable>)}</View><Text style={styles.inputLabel}>退場球員</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>{team.players.map((player) => <Pressable key={`out-${player.id}`} onPress={() => setPlayerOutId(player.id)} style={[styles.modalPlayerChip, player.id === playerOutId && styles.modalChoiceActive]}><Text style={[styles.modalPlayerChipNumber, player.id === playerOutId && styles.modalChoiceTextActive]}>{player.number}</Text><Text style={[styles.modalPlayerChipName, player.id === playerOutId && styles.modalChoiceTextActive]}>{player.name} {playerHandAbbr(player)}</Text></Pressable>)}</ScrollView><Text style={styles.inputLabel}>{type === "換守" ? "換入／調動球員" : "替補球員"}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>{team.players.map((player) => <Pressable key={`in-${player.id}`} onPress={() => { setPlayerInId(player.id); if (type === "換守") setPosition(player.position || "游擊"); }} style={[styles.modalPlayerChip, player.id === playerInId && styles.modalChoiceActive]}><Text style={[styles.modalPlayerChipNumber, player.id === playerInId && styles.modalChoiceTextActive]}>{player.number}</Text><Text style={[styles.modalPlayerChipName, player.id === playerInId && styles.modalChoiceTextActive]}>{player.name} {playerHandAbbr(player)}</Text></Pressable>)}</ScrollView><Text style={styles.inputLabel}>{type === "換守" ? "新守備位置" : "接替位置／角色"}</Text>{type === "換守" ? <View style={styles.modalChoiceRow}>{FIELD_POSITIONS.map((field) => <Pressable key={field.number} onPress={() => setPosition(field.label)} style={[styles.modalChoice, position === field.label && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, position === field.label && styles.modalChoiceTextActive]}>{field.number} · {field.label}</Text></Pressable>)}</View> : <TextInput value={position} onChangeText={setPosition} style={styles.formInput} placeholder="例如：投手、游擊、代打" placeholderTextColor={BRAND.muted} />}<Text style={styles.substitutionContext}>記錄時間：{game.inning} 局 {game.half === "away" ? "上" : "下"} · 類型：{type} · 目前第 {game.substitutions.length + 1} 次換人</Text><Button label="儲存換人紀錄" onPress={() => { if (playerOutId === playerInId) { Alert.alert("球員不能相同", "請選擇不同的退場與替補球員。"); return; } onSubmit({ inning: game.inning, half: game.half, teamId, playerOutId, playerInId, position, type }); }} /></ScrollView></View></View></Modal>;
}

function SubstitutionModal({ visible, game, teams, initialType, initialHandoffPitchNumber = 0, onClose, onSubmit }: { visible: boolean; game: Game; teams: Team[]; initialType: SubstitutionType; initialHandoffPitchNumber?: number; onClose: () => void; onSubmit: (substitution: Omit<Substitution, "id" | "timestamp">) => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [type, setType] = useState<SubstitutionType>(initialType);
  const [teamId, setTeamId] = useState(game.awayTeamId);
  const [playerOutId, setPlayerOutId] = useState("");
  const [playerInId, setPlayerInId] = useState("");
  const [position, setPosition] = useState("");
  const [handoffPitchNumber, setHandoffPitchNumber] = useState("0");
  const team = teams.find((candidate) => candidate.id === teamId) ?? teams[0];
  const playerOut = team?.players.find((player) => player.id === playerOutId);
  const playerIn = team?.players.find((player) => player.id === playerInId);

  useEffect(() => {
    if (!visible) return;
    const initialTeam = teams.find((candidate) => candidate.id === game.awayTeamId) ?? teams[0];
    const players = initialTeam?.players ?? [];
    setStep(1);
    setType(initialType);
    setTeamId(initialTeam?.id ?? "");
    setPlayerOutId(players[0]?.id ?? "");
    setPlayerInId(players[1]?.id ?? players[0]?.id ?? "");
    setPosition(initialType === "換守" ? (players[1]?.position ?? "游擊") : initialType);
    setHandoffPitchNumber(String(Math.max(0, Math.floor(initialHandoffPitchNumber))));
  }, [game.awayTeamId, initialHandoffPitchNumber, initialType, teams, visible]);

  const chooseTeam = (nextTeamId: string) => {
    const nextTeam = teams.find((candidate) => candidate.id === nextTeamId);
    const players = nextTeam?.players ?? [];
    setTeamId(nextTeamId);
    setPlayerOutId(players[0]?.id ?? "");
    setPlayerInId(players[1]?.id ?? players[0]?.id ?? "");
    setPosition(type === "換守" ? (players[1]?.position ?? "游擊") : type);
  };
  const chooseType = (nextType: SubstitutionType) => {
    setType(nextType);
    setPosition(nextType === "換守" ? (playerIn?.position ?? "游擊") : nextType);
  };
  const parsedHandoffPitchNumber = /^\d+$/.test(handoffPitchNumber.trim()) ? Number.parseInt(handoffPitchNumber, 10) : undefined;
  const hasValidHandoffPitchNumber = typeof parsedHandoffPitchNumber === "number" && Number.isSafeInteger(parsedHandoffPitchNumber) && parsedHandoffPitchNumber >= 0;
  const handoffSummary = hasValidHandoffPitchNumber ? parsedHandoffPitchNumber === 0 ? "打席開始交接" : `第 ${parsedHandoffPitchNumber} 球交接` : "請輸入 0 或正整數";
  const canContinue = step === 1 ? Boolean(teamId) : step === 2 ? Boolean(playerOutId) : step === 3 ? Boolean(playerInId) && playerInId !== playerOutId : Boolean(position.trim()) && hasValidHandoffPitchNumber;
  const stepTitle = (["類型與球隊", "退場球員", "換入球員", "守備／摘要"] as const)[step - 1];
  if (!team) return null;

  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>換人逐步記錄</Text><Text style={styles.modalSubtitle}>每一步可返回修正；完成前不會寫入單場紀錄。</Text></View><Pressable onPress={onClose}><Text style={styles.modalClose}>取消</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}><View style={styles.wizardStepRow}>{([1, 2, 3, 4] as const).map((item) => <View key={item} style={[styles.wizardStepChip, item === step && styles.wizardStepChipActive, item < step && styles.wizardStepChipDone]}><Text style={[styles.wizardStepIndex, item <= step && styles.wizardStepIndexActive]}>{item}</Text><Text style={[styles.wizardStepText, item === step && styles.wizardStepTextActive]}>{item === 1 ? "類型" : item === 2 ? "退場" : item === 3 ? "換入" : "核對"}</Text></View>)}</View><Text style={styles.substitutionWizardStage}>第 {step}／4 步｜{stepTitle}</Text>
    {step === 1 ? <><Text style={styles.inputLabel}>換人類型</Text><View style={styles.modalChoiceRow}>{(["代打", "代跑", "換投", "換守"] as SubstitutionType[]).map((choice) => <Pressable key={choice} onPress={() => chooseType(choice)} style={[styles.modalChoice, type === choice && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, type === choice && styles.modalChoiceTextActive]}>{choice}</Text></Pressable>)}</View><Text style={styles.inputLabel}>換人球隊</Text><View style={styles.modalChoiceRow}>{teams.map((candidate) => <Pressable key={candidate.id} onPress={() => chooseTeam(candidate.id)} style={[styles.modalChoice, teamId === candidate.id && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, teamId === candidate.id && styles.modalChoiceTextActive]}>{candidate.name}</Text></Pressable>)}</View><Text style={styles.substitutionContext}>記錄時點：第 {game.inning} 局{game.half === "away" ? "上" : "下"}；換人會同時列入分隊完整紀錄表與換人歷程。</Text></> : null}
    {step === 2 ? <><Text style={styles.inputLabel}>選擇退場球員｜{team.name}</Text><Text style={styles.modalSubtitle}>請選擇被接替的球員；下一步才選擇替補者。</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>{team.players.map((player) => <Pressable key={`out-${player.id}`} onPress={() => setPlayerOutId(player.id)} style={[styles.modalPlayerChip, player.id === playerOutId && styles.modalChoiceActive]}><Text style={[styles.modalPlayerChipNumber, player.id === playerOutId && styles.modalChoiceTextActive]}>#{player.number}</Text><Text style={[styles.modalPlayerChipName, player.id === playerOutId && styles.modalChoiceTextActive]}>{player.name} {playerHandAbbr(player)}</Text></Pressable>)}</ScrollView></> : null}
    {step === 3 ? <><Text style={styles.inputLabel}>選擇{type === "換守" ? "調動" : "替補"}球員｜{team.name}</Text><Text style={styles.modalSubtitle}>已選退場：#{playerOut?.number ?? "—"} {playerOut?.name ?? "未選擇"}。不可選擇同一位球員。</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>{team.players.map((player) => <Pressable key={`in-${player.id}`} onPress={() => { if (player.id !== playerOutId) { setPlayerInId(player.id); if (type === "換守") setPosition(player.position || "游擊"); } }} style={[styles.modalPlayerChip, player.id === playerInId && styles.modalChoiceActive, player.id === playerOutId && styles.modalPlayerChipDisabled]}><Text style={[styles.modalPlayerChipNumber, player.id === playerInId && styles.modalChoiceTextActive]}>{player.number}</Text><Text style={[styles.modalPlayerChipName, player.id === playerInId && styles.modalChoiceTextActive]}>{player.name} {playerHandAbbr(player)}</Text></Pressable>)}</ScrollView></> : null}
    {step === 4 ? <><Text style={styles.inputLabel}>{type === "換守" ? "新守備位置" : "接替角色"}</Text>{type === "換守" ? <View style={styles.modalChoiceRow}>{FIELD_POSITIONS.map((field) => <Pressable key={field.number} onPress={() => setPosition(field.label)} style={[styles.modalChoice, position === field.label && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, position === field.label && styles.modalChoiceTextActive]}>{field.number} · {field.label}</Text></Pressable>)}</View> : <TextInput value={position} onChangeText={setPosition} style={styles.formInput} placeholder="例如：投手、游擊、代打" placeholderTextColor={BRAND.muted} />}<Text style={styles.inputLabel}>第 N 球交接</Text><TextInput value={handoffPitchNumber} onChangeText={(value) => setHandoffPitchNumber(value.replace(/[^\d]/g, ""))} keyboardType="number-pad" returnKeyType="done" style={styles.formInput} placeholder="0" placeholderTextColor={BRAND.muted} accessibilityLabel="本打席已記錄球數" /><Text style={styles.substitutionContext}>此數字表示本打席已記錄的球數。0 代表「打席開始交接」，不是第一球後；舊場次沒有此欄位時不會被推測為精確球序。</Text><View style={styles.confirmationSummary}><Text style={styles.confirmationSummaryTitle}>寫入前影響摘要</Text><Text style={styles.confirmationSummaryText}>{team.name}｜{type}</Text><Text style={styles.confirmationSummaryText}>#{playerOut?.number ?? "—"} {playerOut?.name ?? "未選擇"} → #{playerIn?.number ?? "—"} {playerIn?.name ?? "未選擇"}</Text><Text style={styles.confirmationSummaryText}>接替位置／角色：{position || "未選擇"}</Text><Text style={styles.confirmationSummaryText}>精確交接：{handoffSummary}</Text><Text style={styles.confirmationSummaryText}>時點：第 {game.inning} 局{game.half === "away" ? "上" : "下"}。寫入後仍可從完整紀錄的歷程選擇該筆資料查看與復原。</Text></View></> : null}
    <View style={styles.confirmationActionRow}><View style={styles.confirmationActionFlex}>{step === 1 ? <Button label="取消" onPress={onClose} variant="secondary" touch fluid /> : <Button label="上一步" onPress={() => setStep((current) => (current - 1) as 1 | 2 | 3)} variant="secondary" touch fluid />}</View><View style={styles.confirmationActionFlex}>{step < 4 ? <Button label="下一步" onPress={() => setStep((current) => (current + 1) as 2 | 3 | 4)} disabled={!canContinue} touch fluid /> : <Button label="確認寫入換人" onPress={() => { if (playerOutId === playerInId) { Alert.alert("球員不能相同", "請返回上一步，選擇不同的退場與替補球員。"); return; } if (!hasValidHandoffPitchNumber || typeof parsedHandoffPitchNumber !== "number") { Alert.alert("交接球數無效", "請輸入 0 或正整數；0 代表打席開始交接。"); return; } onSubmit({ inning: game.inning, half: game.half, teamId, playerOutId, playerInId, position: position.trim(), type, handoffPitchNumber: parsedHandoffPitchNumber }); }} disabled={!canContinue} touch fluid />}</View></View></ScrollView></View></View></Modal>;
}

function ManualAtBatModal({ visible, game, away, home, onClose, onSubmit }: { visible: boolean; game: Game; away: Team; home: Team; onClose: () => void; onSubmit: (draft: ManualAtBatDraft) => void }) {
  const [draft, setDraft] = useState<ManualAtBatDraft>({ inning: game.inning, half: game.half, batterId: "", pitcherId: "", result: "1B", notation: "", runsScored: 0, outsBefore: 0, balls: 0, strikes: 0, total: 0 });
  const battingTeam = draft.half === "away" ? away : home;
  const pitchingTeam = draft.half === "away" ? home : away;
  useEffect(() => { if (visible) { const batting = game.half === "away" ? away : home; const pitching = game.half === "away" ? home : away; setDraft({ inning: game.inning, half: game.half, batterId: batting.players[0]?.id ?? "", pitcherId: pitching.players[0]?.id ?? "", result: "1B", notation: "", runsScored: 0, outsBefore: 0, balls: 0, strikes: 0, total: 0 }); } }, [away, game.half, game.inning, home, visible]);
  const setNumber = (key: "inning" | "runsScored" | "outsBefore" | "balls" | "strikes" | "total", value: string) => setDraft((current) => ({ ...current, [key]: Math.max(0, Number.parseInt(value, 10) || 0) }));
  const numberInput = (label: string, key: "runsScored" | "outsBefore" | "balls" | "strikes" | "total", max?: number) => <View style={{ width: 72 }}><Text style={styles.inputLabel}>{label}</Text><TextInput value={String(draft[key])} onChangeText={(value) => setNumber(key, max === undefined ? value : String(Math.min(max, Number.parseInt(value, 10) || 0)))} keyboardType="number-pad" style={styles.formInput} /></View>;
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>逐場打席補登</Text><Text style={styles.modalSubtitle}>手動建立一筆完整打席；不會改變目前現場攻守或跑者狀態。</Text></View><Pressable onPress={onClose}><Text style={styles.modalClose}>關閉</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}><View style={styles.exportInputRow}><View style={{ width: 78 }}><Text style={styles.inputLabel}>局數</Text><TextInput value={String(draft.inning)} onChangeText={(value) => setNumber("inning", value)} keyboardType="number-pad" style={styles.formInput} /></View><View style={{ flex: 1 }}><Text style={styles.inputLabel}>攻守半局</Text><View style={styles.modalChoiceRow}>{(["away", "home"] as TeamSide[]).map((half) => <Pressable key={half} onPress={() => setDraft((current) => ({ ...current, half, batterId: (half === "away" ? away : home).players[0]?.id ?? "", pitcherId: (half === "away" ? home : away).players[0]?.id ?? "" }))} style={[styles.modalChoice, draft.half === half && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, draft.half === half && styles.modalChoiceTextActive]}>{half === "away" ? `客隊進攻｜${away.name}` : `主隊進攻｜${home.name}`}</Text></Pressable>)}</View></View></View><Text style={styles.inputLabel}>打者｜{battingTeam.name}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>{battingTeam.players.map((player) => <Pressable key={player.id} onPress={() => setDraft((current) => ({ ...current, batterId: player.id }))} style={[styles.modalPlayerChip, draft.batterId === player.id && styles.modalChoiceActive]}><Text style={[styles.modalPlayerChipNumber, draft.batterId === player.id && styles.modalChoiceTextActive]}>#{player.number}</Text><Text style={[styles.modalPlayerChipName, draft.batterId === player.id && styles.modalChoiceTextActive]}>{player.name} {playerHandAbbr(player)}</Text></Pressable>)}</ScrollView><Text style={styles.inputLabel}>投手｜{pitchingTeam.name}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>{pitchingTeam.players.map((player) => <Pressable key={player.id} onPress={() => setDraft((current) => ({ ...current, pitcherId: player.id }))} style={[styles.modalPlayerChip, draft.pitcherId === player.id && styles.modalChoiceActive]}><Text style={[styles.modalPlayerChipNumber, draft.pitcherId === player.id && styles.modalChoiceTextActive]}>#{player.number}</Text><Text style={[styles.modalPlayerChipName, draft.pitcherId === player.id && styles.modalChoiceTextActive]}>{player.name} {playerHandAbbr(player)}</Text></Pressable>)}</ScrollView><Text style={styles.inputLabel}>打席結果</Text><View style={styles.modalChoiceRow}>{(["1B", "2B", "3B", "HR", "BB", "HBP", "K", "F", "G", "E"] as AtBatResult[]).map((result) => <Pressable key={result} onPress={() => setDraft((current) => ({ ...current, result }))} style={[styles.modalChoice, draft.result === result && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, draft.result === result && styles.modalChoiceTextActive]}>{result}</Text></Pressable>)}</View><Text style={styles.inputLabel}>早稻田紀錄符號／說明</Text><TextInput value={draft.notation} onChangeText={(notation) => setDraft((current) => ({ ...current, notation }))} style={styles.formInput} placeholder="例如：⌒7 2B、6-3、四壞球" placeholderTextColor={BRAND.muted} /><View style={styles.exportInputRow}>{numberInput("得分", "runsScored")}{numberInput("出局前", "outsBefore", 2)}{numberInput("壞球", "balls")}{numberInput("好球", "strikes")}{numberInput("總球數", "total")}</View><Text style={styles.substitutionContext}>補登資料會標示 [補]，並同步納入逐局比分、打擊／投手統計與 R/H/E 計分板。</Text><Button label="儲存補登打席" onPress={() => { if (!draft.batterId || !draft.pitcherId) { Alert.alert("尚未選擇球員", "請選擇打者與投手後再儲存。"); return; } onSubmit(draft); }} /></ScrollView></View></View></Modal>;
}

function FormalBlankSlotCorrectionModal({ visible, game, away, home, slot, onClose, onSubmit }: { visible: boolean; game: Game; away: Team; home: Team; slot: ScorebookBlankSlot | null; onClose: () => void; onSubmit: (slot: ScorebookBlankSlot, event: AtBatEvent, note?: string) => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [correctionArea, setCorrectionArea] = useState<"pitch" | "outer" | "inner" | "other">("pitch");
  const [batterId, setBatterId] = useState("");
  const [pitcherId, setPitcherId] = useState("");
  const [result, setResult] = useState<AtBatResult>("1B");
  const [balls, setBalls] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [trajectory, setTrajectory] = useState<RecordTrajectory | "">("");
  const [direction, setDirection] = useState("");
  const [fieldingSequence, setFieldingSequence] = useState("");
  const [notation, setNotation] = useState("");
  const [note, setNote] = useState("");
  const battingTeam = slot?.side === "away" ? away : home;
  const pitchingTeam = slot?.side === "away" ? home : away;
  useEffect(() => {
    if (!visible || !slot) return;
    setStep(1);
    setBatterId(slot.playerId ?? battingTeam.players[0]?.id ?? "");
    setPitcherId(pitchingTeam.players[0]?.id ?? "");
    setCorrectionArea("pitch"); setResult("1B"); setBalls(0); setStrikes(0); setTrajectory(""); setDirection(""); setFieldingSequence(""); setNotation(""); setNote("");
  }, [battingTeam, pitchingTeam, slot, visible]);
  if (!slot) return null;
  const resultCards: Array<{ value: AtBatResult; label: string }> = [
    { value: "1B", label: "1B" }, { value: "2B", label: "2B" }, { value: "3B", label: "3B" }, { value: "HR", label: "HR" }, { value: "BB", label: "BB" }, { value: "HBP", label: "HBP" }, { value: "K", label: "K" }, { value: "F", label: "FO" }, { value: "G", label: "GO" }, { value: "E", label: "E" },
  ];
  const resultCode = result === "F" ? "FO" : result === "G" ? "GO" : result;
  const generatedNotation = [resultCode, trajectory ? `${trajectory}${direction ? `・${direction}` : ""}` : "", fieldingSequence].filter(Boolean).join(" ");
  const canContinue = step === 1 ? Boolean(batterId && pitcherId) : step === 2 ? Boolean(result === "BB" || result === "HBP" || result === "K" || trajectory || fieldingSequence) : true;
  const previewEvent: AtBatEvent = {
    id: `formal-preview-${slot.inning}-${slot.slotIndex}`,
    inning: slot.inning,
    half: slot.side,
    batterId,
    pitcherId,
    result,
    notation: notation.trim() || generatedNotation || resultCode,
    pitches: { balls, strikes, total: balls + strikes },
    outsBefore: 0,
    runsScored: 0,
    recordColumn: { trajectory: trajectory || undefined, battedBallPosition: direction.trim() || undefined, fieldingSequence: fieldingSequence.trim() || undefined, modifiers: [], rbi: 0 },
    source: "manual",
    timestamp: new Date().toISOString(),
  };
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>正式更正｜空白打序格</Text><Text style={styles.modalSubtitle}>第 {slot.inning} 局{slot.side === "away" ? "上" : "下"}・第 {slot.battingOrder} 棒・第 {slot.slotIndex + 1} 格。與已完成打席相同，依區域、符號、內容與預覽確認後才會重播正式資料與統計。</Text></View><Pressable onPress={onClose}><Text style={styles.modalClose}>取消</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}><View style={styles.wizardStepRow}>{([1, 2, 3, 4] as const).map((item) => <View key={item} style={[styles.wizardStepChip, item === step && styles.wizardStepChipActive, item < step && styles.wizardStepChipDone]}><Text style={[styles.wizardStepIndex, item <= step && styles.wizardStepIndexActive]}>{item}</Text><Text style={[styles.wizardStepText, item === step && styles.wizardStepTextActive]}>{item === 1 ? "區域" : item === 2 ? "符號" : item === 3 ? "內容／備註" : "預覽確認"}</Text></View>)}</View>
    {step === 1 ? <><Text style={styles.inputLabel}>修正區域</Text><View style={styles.modalChoiceRow}>{([['pitch','逐球欄'], ['outer','外圈'], ['inner','內圈'], ['other','其他']] as const).map(([area, label]) => <Pressable key={area} onPress={() => setCorrectionArea(area)} style={[styles.modalChoice, correctionArea === area && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, correctionArea === area && styles.modalChoiceTextActive]}>{label}</Text></Pressable>)}</View><Text style={styles.inputLabel}>打者｜{battingTeam.name}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>{battingTeam.players.map((player) => <Pressable key={player.id} onPress={() => setBatterId(player.id)} style={[styles.modalPlayerChip, batterId === player.id && styles.modalChoiceActive]}><Text style={[styles.modalPlayerChipNumber, batterId === player.id && styles.modalChoiceTextActive]}>#{player.number}</Text><Text style={[styles.modalPlayerChipName, batterId === player.id && styles.modalChoiceTextActive]}>{player.name}</Text></Pressable>)}</ScrollView><Text style={styles.inputLabel}>投手｜{pitchingTeam.name}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>{pitchingTeam.players.map((player) => <Pressable key={player.id} onPress={() => setPitcherId(player.id)} style={[styles.modalPlayerChip, pitcherId === player.id && styles.modalChoiceActive]}><Text style={[styles.modalPlayerChipNumber, pitcherId === player.id && styles.modalChoiceTextActive]}>#{player.number}</Text><Text style={[styles.modalPlayerChipName, pitcherId === player.id && styles.modalChoiceTextActive]}>{player.name}</Text></Pressable>)}</ScrollView></> : null}
    {step === 2 ? <><Text style={styles.inputLabel}>{correctionArea === "pitch" ? "逐球與結果符號" : correctionArea === "outer" ? "外圈結果符號" : correctionArea === "inner" ? "內圈結果符號" : "其他紀錄符號"}</Text><View style={styles.modalChoiceRow}>{resultCards.map((card) => <Pressable key={card.value} onPress={() => setResult(card.value)} style={[styles.modalChoice, result === card.value && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, result === card.value && styles.modalChoiceTextActive]}>{card.label}</Text></Pressable>)}</View><View style={styles.exportInputRow}><View style={{ width: 92 }}><Text style={styles.inputLabel}>壞球</Text><TextInput value={String(balls)} onChangeText={(value) => setBalls(Math.max(0, Number.parseInt(value, 10) || 0))} keyboardType="number-pad" style={styles.formInput} /></View><View style={{ width: 92 }}><Text style={styles.inputLabel}>好球</Text><TextInput value={String(strikes)} onChangeText={(value) => setStrikes(Math.max(0, Number.parseInt(value, 10) || 0))} keyboardType="number-pad" style={styles.formInput} /></View></View></> : null}
    {step === 3 ? <><Text style={styles.inputLabel}>球性（右下）</Text><View style={styles.modalChoiceRow}>{(["fly", "line", "ground", "bounce", "wavy", "pop"] as RecordTrajectory[]).map((value) => <Pressable key={value} onPress={() => setTrajectory(value)} style={[styles.modalChoice, trajectory === value && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, trajectory === value && styles.modalChoiceTextActive]}>{value === "fly" ? "飛球" : value === "line" ? "平飛" : value === "ground" ? "滾地" : value === "bounce" ? "彈跳" : value === "wavy" ? "曲線" : "內野飛球"}</Text></Pressable>)}</View><Text style={styles.inputLabel}>方向／守備位置（右下）</Text><TextInput value={direction} onChangeText={setDirection} style={styles.formInput} placeholder="例如：7、左外野、6-3" placeholderTextColor={BRAND.muted} /><Text style={styles.inputLabel}>傳接事件（右下）</Text><TextInput value={fieldingSequence} onChangeText={setFieldingSequence} style={styles.formInput} placeholder="例如：6-4-3 DP、5E3" placeholderTextColor={BRAND.muted} /><Text style={styles.inputLabel}>早稻田符號／更正備註（選填）</Text><TextInput value={notation} onChangeText={setNotation} style={styles.formInput} placeholder={generatedNotation || "使用結果、球性、方向自動組合"} placeholderTextColor={BRAND.muted} /><TextInput value={note} onChangeText={setNote} style={[styles.formInput, { minHeight: 64, textAlignVertical: "top" }]} multiline placeholder="例如：初始紀錄遺漏，已依紙本紀錄核對" placeholderTextColor={BRAND.muted} /><Text style={styles.substitutionContext}>本流程與完成打席修正相同：先選區域與符號，補上內容後先預覽，再確認正式更正。</Text></> : null}
    {step === 4 ? <View style={styles.confirmationSummary}><Text style={styles.confirmationSummaryTitle}>正式更正預覽</Text><Text style={styles.confirmationSummaryText}>區域：{correctionArea === "pitch" ? "逐球欄" : correctionArea === "outer" ? "外圈" : correctionArea === "inner" ? "內圈" : "其他"}　結果：{resultCode}　符號：{previewEvent.notation}</Text><Text style={styles.confirmationSummaryText}>球數：{balls} 壞／{strikes} 好／{balls + strikes} 球</Text><Text style={styles.confirmationSummaryText}>右下：{[trajectory, direction, fieldingSequence].filter(Boolean).join(" · ") || "未填寫"}</Text><Text style={styles.confirmationSummaryText}>確認後將正式插入此打席、保存更正歷程，並由既有規則重播比分、出局、跑壘與投打統計。原始事件不會被靜默覆蓋。</Text></View> : null}
    <View style={styles.confirmationActionRow}><View style={styles.confirmationActionFlex}>{step === 1 ? <Button label="取消" onPress={onClose} variant="secondary" touch fluid /> : <Button label="上一步" onPress={() => setStep((current) => (current - 1) as 1 | 2 | 3)} variant="secondary" touch fluid />}</View><View style={styles.confirmationActionFlex}>{step < 4 ? <Button label="下一步" onPress={() => setStep((current) => (current + 1) as 2 | 3 | 4)} disabled={!canContinue} touch fluid /> : <Button label="確認正式更正" onPress={() => onSubmit(slot, previewEvent, note)} touch fluid />}</View></View></ScrollView></View></View></Modal>;
}

function FormalBlankSlotLiveWorkflowModal({ visible, game, away, home, slot, replacementTarget, onClose, onSubmit, onReplace }: { visible: boolean; game: Game; away: Team; home: Team; slot: ScorebookBlankSlot | null; replacementTarget?: AtBatEvent | null; onClose: () => void; onSubmit: (slot: ScorebookBlankSlot, event: AtBatEvent, note?: string) => void; onReplace?: (target: AtBatEvent, event: AtBatEvent, note?: string) => void }) {
  type LiveCorrectionStep = "players" | "pitches" | "trajectory" | "direction" | "result" | "fielding" | "preview";
  const [step, setStep] = useState<LiveCorrectionStep>("players");
  const [batterId, setBatterId] = useState("");
  const [pitcherId, setPitcherId] = useState("");
  const [pitchDraft, setPitchDraft] = useState<PitchOutcome[]>([]);
  const [trajectory, setTrajectory] = useState<RecordTrajectory | "">("");
  const [direction, setDirection] = useState("");
  const [result, setResult] = useState<AtBatResult>("1B");
  const [droppedThirdStrike, setDroppedThirdStrike] = useState(false);
  const [fieldingSequence, setFieldingSequence] = useState("");
  const [note, setNote] = useState("");
  const [isGuideExpanded, setIsGuideExpanded] = useState(false);
  const [stepFade] = useState(() => new Animated.Value(1));
  const battingTeam = slot?.side === "away" ? away : home;
  const pitchingTeam = slot?.side === "away" ? home : away;
  const isReplacement = Boolean(replacementTarget);
  const droppedThirdStrikeEligibility = getDroppedThirdStrikeEligibility(game.runners, replacementTarget?.outsBefore ?? game.outs);
  const resultCards: Array<{ value: AtBatResult; label: string }> = [
    { value: "1B", label: "1B" }, { value: "2B", label: "2B" }, { value: "3B", label: "3B" }, { value: "HR", label: "HR" },
    { value: "BB", label: "BB" }, { value: "HBP", label: "HBP" }, { value: "K", label: "K" }, { value: "F", label: "FO" }, { value: "G", label: "GO" }, { value: "E", label: "E" },
  ];
  const resultCode = result === "F" ? "FO" : result === "G" ? "GO" : result;
  const displayResultCode = result === "K" && droppedThirdStrike ? "K+" : resultCode;
  const isBattedBall = ["1B", "2B", "3B", "HR", "F", "G", "E"].includes(result);
  const pitchPreview = pitchDraft.length ? getPitchCorrectionPreview(pitchDraft, result) : null;
  const generatedNotation = [result === "K" && droppedThirdStrike ? "K+" : resultCode, trajectory ? `${trajectory}${direction ? `・${direction}` : ""}` : "", fieldingSequence].filter(Boolean).join(" ");
  const previewEvent: AtBatEvent = {
    id: `formal-live-preview-${slot?.inning ?? 0}-${slot?.slotIndex ?? 0}`,
    inning: slot?.inning ?? 1,
    half: slot?.side ?? "away",
    batterId,
    pitcherId,
    result,
    notation: generatedNotation || (droppedThirdStrike ? "K+" : resultCode),
    pitches: { balls: pitchPreview?.balls ?? 0, strikes: pitchPreview?.strikes ?? 0, total: pitchDraft.length },
    outsBefore: replacementTarget?.outsBefore ?? 0,
    runsScored: 0,
    recordColumn: { trajectory: trajectory || undefined, battedBallPosition: direction.trim() || undefined, fieldingSequence: fieldingSequence.trim() || undefined, modifiers: [], rbi: 0 },
    droppedThirdStrike: result === "K" && droppedThirdStrike && droppedThirdStrikeEligibility.allowed,
    source: "manual",
    timestamp: new Date().toISOString(),
  };
  const steps = [
    ["pitches", "逐球"], ["trajectory", "球性"], ["direction", "方向"], ["result", "結果"], ["fielding", "傳球"], ["preview", "預覽"],
  ] as const;
  const transitionTo = useCallback((nextStep: LiveCorrectionStep) => {
    stepFade.setValue(0.72);
    setStep(nextStep);
    Animated.timing(stepFade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [stepFade]);
  const recordPitchOutcome = useCallback((outcome: PitchOutcome) => {
    const nextDraft = [...pitchDraft, outcome];
    const nextPreview = getPitchCorrectionPreview(nextDraft, result);
    setPitchDraft(nextDraft);
    if (nextPreview.terminal === "in-play") {
      transitionTo("trajectory");
      return;
    }
    if (nextPreview.terminal === "strikeout") {
      setResult("K");
      transitionTo("trajectory");
      return;
    }
    if (nextPreview.terminal === "walk") {
      setResult("BB");
      transitionTo("trajectory");
    }
  }, [pitchDraft, result, transitionTo]);
  const loadSpecialDemo = (scenario: "bunt" | "double-play" | "triple-play") => {
    const demo = scenario === "bunt"
      ? { pitches: ["bunt"] as PitchOutcome[], direction: "3 一壘", fielding: "3A", label: "觸擊推進示範" }
      : scenario === "double-play"
        ? { pitches: ["inPlay"] as PitchOutcome[], direction: "4 二壘", fielding: "4ー6ー3 DP", label: "雙殺示範" }
        : { pitches: ["inPlay"] as PitchOutcome[], direction: "5 三壘", fielding: "5ー4ー3 TP", label: "三殺示範" };
    setPitchDraft(demo.pitches);
    setTrajectory("ground");
    setDirection(demo.direction);
    setResult("G");
    setFieldingSequence(demo.fielding);
    setNote(`${demo.label}；請依實際紙本紀錄核對後再確認。`);
    transitionTo("fielding");
  };
  useEffect(() => {
    if (!visible || !slot) return;
    setStep("players");
    setBatterId(replacementTarget?.batterId ?? slot.playerId ?? battingTeam.players[0]?.id ?? "");
    setPitcherId(pitchingTeam.players[0]?.id ?? "");
    setPitchDraft([]); setTrajectory(""); setDirection(""); setResult("1B"); setDroppedThirdStrike(false); setFieldingSequence(""); setNote(""); setIsGuideExpanded(false); stepFade.setValue(1);
  }, [battingTeam, pitchingTeam, replacementTarget, slot, visible]);
  if (!slot) return null;
  const goToResult = () => {
    if (result === "K" && droppedThirdStrike && !droppedThirdStrikeEligibility.allowed) {
      Alert.alert("不符合不死三振條件", droppedThirdStrikeEligibility.reason ?? "此壘況不可記錄不死三振 K+。 ");
      return;
    }
    if (isBattedBall && (!trajectory || !direction.trim())) {
      Alert.alert("請完成球性與方向", "擊出球、飛球出局、滾地出局或失誤，請依現場紀錄順序補上球性與方向。 ");
      return;
    }
    if (result === "HBP") {
      if (pitchDraft.length) Alert.alert("觸身球不需逐球符號", "請清空逐球欄後再確認觸身球；觸身球不以球／好球序列結束打席。 ");
      else transitionTo("preview");
      return;
    }
    if (!pitchPreview || pitchPreview.error) {
      Alert.alert("逐球欄尚未符合打席結束", pitchPreview?.error ?? "請先逐球輸入，並以與結果相符的最後一球結束。 ");
      return;
    }
    transitionTo(isBattedBall ? "fielding" : "preview");
  };
  const back = () => {
    const previous: Record<LiveCorrectionStep, LiveCorrectionStep> = {
      players: "players", pitches: "players", trajectory: "pitches", direction: "trajectory", result: trajectory ? "direction" : "trajectory", fielding: "result", preview: isBattedBall ? "fielding" : "result",
    };
    transitionTo(previous[step]);
  };
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>{isReplacement ? "正式重建｜現場紀錄流程" : "正式補登｜現場紀錄流程"}</Text><Text style={styles.modalSubtitle}>第 {slot.inning} 局{slot.side === "away" ? "上" : "下"}・第 {slot.battingOrder} 棒・第 {slot.slotIndex + 1} 格；{isReplacement ? "只會重建原打席，保留打者、局數與更正歷程。" : "確認後才會重播正式資料、比分、出局、跑壘及統計。"}</Text></View><Pressable onPress={onClose}><Text style={styles.modalClose}>取消</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
    <View style={styles.wizardStepRow}>{steps.map(([key, label], index) => <View key={key} style={[styles.wizardStepChip, step === key && styles.wizardStepChipActive]}><Text style={[styles.wizardStepIndex, step === key && styles.wizardStepIndexActive]}>{index + 1}</Text><Text style={[styles.wizardStepText, step === key && styles.wizardStepTextActive]}>{label}</Text></View>)}</View>
    <Pressable onPress={() => setIsGuideExpanded((current) => !current)} style={styles.recordCorrectionSafetyNote} accessibilityRole="button" accessibilityState={{ expanded: isGuideExpanded }}><Text style={styles.recordCorrectionSafetyTitle}>{isGuideExpanded ? "收起流程說明" : "展開流程說明"}</Text><Text style={styles.recordCorrectionSafetyText}>逐球完成後會自動前進；可隨時按「上一步」調整。</Text>{isGuideExpanded ? <Text style={styles.recordCorrectionSafetyText}>擊出球與成功觸擊：逐球 → 球性 → 方向 → 結果 → 傳接 → 預覽；第三好球與第四壞球會自動帶入 K／BB，再依序確認「非擊出事件」與結果。雙殺／三殺在傳接步驟選擇 DP／TP。</Text> : null}</Pressable>
    <Animated.View style={{ opacity: stepFade, transform: [{ translateY: stepFade.interpolate({ inputRange: [0.72, 1], outputRange: [8, 0] }) }] }}>
    {step === "players" ? <><Text style={styles.inputLabel}>打者｜{battingTeam.name}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>{battingTeam.players.map((player) => <Pressable key={player.id} disabled={isReplacement} onPress={() => setBatterId(player.id)} style={[styles.modalPlayerChip, batterId === player.id && styles.modalChoiceActive, isReplacement && player.id !== batterId && { opacity: 0.45 }]}><Text style={[styles.modalPlayerChipNumber, batterId === player.id && styles.modalChoiceTextActive]}>#{player.number}</Text><Text style={[styles.modalPlayerChipName, batterId === player.id && styles.modalChoiceTextActive]}>{player.name}</Text></Pressable>)}</ScrollView>{isReplacement ? <Text style={styles.substitutionContext}>正式重建已鎖定原打者；可重新輸入逐球、結果、外圈與右下傳接內容。</Text> : null}<Text style={styles.inputLabel}>投手｜{pitchingTeam.name}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalChipRow}>{pitchingTeam.players.map((player) => <Pressable key={player.id} onPress={() => setPitcherId(player.id)} style={[styles.modalPlayerChip, pitcherId === player.id && styles.modalChoiceActive]}><Text style={[styles.modalPlayerChipNumber, pitcherId === player.id && styles.modalChoiceTextActive]}>#{player.number}</Text><Text style={[styles.modalPlayerChipName, pitcherId === player.id && styles.modalChoiceTextActive]}>{player.name}</Text></Pressable>)}</ScrollView><Text style={styles.substitutionContext}>先指定本格的打者與投手；之後的逐球、外圈、內圈與右下傳接會依現場紀錄的順序建立。</Text></> : null}
    {step === "pitches" ? <><Text style={styles.recordCorrectionStepHint}>逐球輸入：依每一球實際結果排序。擊出球會自動繼續進入球性、方向、結果與傳接球事件；第四壞球與第三好球會自動帶入 BB／K 結果。</Text><View style={styles.recordCorrectionSafetyNote}><Text style={styles.recordCorrectionSafetyTitle}>本次逐球草稿</Text><Text style={styles.recordCorrectionSafetyText}>{pitchPreview?.value || "尚未加入逐球符號"}</Text>{pitchPreview ? <Text style={styles.recordCorrectionSafetyText}>球數：{pitchPreview.balls} 壞／{pitchPreview.strikes} 好{pitchPreview.error ? `；${pitchPreview.error}` : ""}</Text> : null}</View><Text style={styles.recordCorrectionStepHint}>特殊情境示範只會填入此視窗草稿，須經預覽確認才會建立正式資料。</Text><View style={styles.recordCorrectionFooter}><Button label="觸擊示範" onPress={() => loadSpecialDemo("bunt")} variant="secondary" fluid /><Button label="雙殺示範" onPress={() => loadSpecialDemo("double-play")} variant="secondary" fluid /><Button label="三殺示範" onPress={() => loadSpecialDemo("triple-play")} variant="secondary" fluid /></View><View style={styles.recordCorrectionChoiceGrid}>{PITCH_CORRECTION_OPTIONS.map((option) => <Pressable key={option.outcome} onPress={() => recordPitchOutcome(option.outcome)} style={styles.recordCorrectionChoice}><Text style={styles.recordCorrectionSymbolMark}>{option.mark}</Text><Text style={styles.recordCorrectionChoiceTitle}>{option.title}</Text></Pressable>)}</View><View style={styles.recordCorrectionFooter}><Button label="刪除最後一顆" onPress={() => setPitchDraft((current) => current.slice(0, -1))} variant="secondary" fluid /><Button label="清空逐球" onPress={() => setPitchDraft([])} variant="secondary" fluid /></View><Button label="觸身球：直接選結果" onPress={() => { setPitchDraft([]); setTrajectory(""); setDirection(""); setResult("HBP"); transitionTo("result"); }} variant="secondary" fluid /></> : null}
    {step === "trajectory" ? <><Text style={styles.recordCorrectionStepHint}>擊出球球性：此步與現場紀錄相同。若本打席是 BB、K 或 HBP，請選擇「非擊出事件」。</Text><View style={styles.recordCorrectionChoiceGrid}>{RECORD_TRAJECTORIES.map((item) => <Pressable key={item.id} onPress={() => { setTrajectory(item.id); transitionTo("direction"); }} style={[styles.recordCorrectionChoice, trajectory === item.id && styles.modalChoiceActive]}><Text style={styles.recordCorrectionSymbolMark}>{item.mark}</Text><Text style={styles.recordCorrectionChoiceTitle}>{item.label}</Text></Pressable>)}<Pressable onPress={() => { setTrajectory(""); setDirection(""); setFieldingSequence(""); transitionTo("result"); }} style={[styles.recordCorrectionChoice, !trajectory && styles.modalChoiceActive]}><Text style={styles.recordCorrectionSymbolMark}>—</Text><Text style={styles.recordCorrectionChoiceTitle}>非擊出事件</Text></Pressable></View></> : null}
    {step === "direction" ? <><Text style={styles.recordCorrectionStepHint}>擊球方向／位置：先點選守備代號，再確認結果。</Text><View style={styles.fieldingSymbolNumberRow}>{FIELD_POSITIONS.map((position) => <Pressable key={position.number} onPress={() => { setDirection(`${position.number} ${position.label}`); transitionTo("result"); }} style={[styles.fieldingSymbolButton, direction.startsWith(position.number) && styles.modalChoiceActive]}><Text style={styles.fieldingSymbolCode}>{position.number}</Text><Text style={styles.fieldingSymbolLabel}>{position.label}</Text></Pressable>)}</View><TextInput value={direction} onChangeText={setDirection} placeholder="例如：7 左外野、6 游擊方向" placeholderTextColor={BRAND.muted} style={styles.formInput} /><Button label="下一步：選結果" onPress={() => direction.trim() ? transitionTo("result") : Alert.alert("請選擇方向", "請先點選或填寫方向／位置。 ")} fluid /></> : null}
    {step === "result" ? <><Text style={styles.recordCorrectionStepHint}>選擇打席結果：結果會與逐球最後一球核對；擊出球完成後再進入右下傳接球事件。</Text><View style={styles.modalChoiceRow}>{resultCards.map((card) => <Pressable key={card.value} onPress={() => { setResult(card.value); setDroppedThirdStrike(false); }} style={[styles.modalChoice, result === card.value && !droppedThirdStrike && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, result === card.value && !droppedThirdStrike && styles.modalChoiceTextActive]}>{card.label}</Text></Pressable>)}<Pressable disabled={!droppedThirdStrikeEligibility.allowed} onPress={() => { setResult("K"); setDroppedThirdStrike(true); }} style={[styles.modalChoice, result === "K" && droppedThirdStrike && styles.modalChoiceActive, !droppedThirdStrikeEligibility.allowed && { opacity: 0.45 }]}><Text style={[styles.modalChoiceText, result === "K" && droppedThirdStrike && styles.modalChoiceTextActive]}>K+</Text></Pressable></View>{!droppedThirdStrikeEligibility.allowed ? <Text style={styles.recordCorrectionSafetyText}>K+ 不可用：{droppedThirdStrikeEligibility.reason ?? "一壘有人且未滿兩出局時，第三好球漏接仍為一般三振出局。"}</Text> : <Text style={styles.recordCorrectionSafetyText}>K+ 僅用於第三好球未接捕且可合法上一壘；會保留 K 統計與打者上一壘資料。</Text>}<Button label={isBattedBall ? "下一步：傳接球事件" : "預覽正式補登"} onPress={goToResult} fluid /></> : null}
    {step === "fielding" ? <><Text style={styles.recordCorrectionStepHint}>傳接球事件固定記在打席格右下角，不與球性、方向、結果或內圈混用。可輸入一般傳接、DP、TP、FC 或失誤序列。</Text><View style={styles.fieldingSymbolNumberRow}>{FIELD_POSITIONS.map((position) => <Pressable key={position.number} onPress={() => setFieldingSequence((current) => `${current}${position.number}`)} style={styles.fieldingSymbolButton}><Text style={styles.fieldingSymbolCode}>{position.number}</Text><Text style={styles.fieldingSymbolLabel}>{position.label}</Text></Pressable>)}</View><View style={styles.fieldingSymbolActionRow}>{[["ー", "傳球"], ["A", "自踩一壘"], ["E", "失誤"], [" DP", "雙殺"], [" TP", "三殺"], [" FC", "野選"]].map(([mark, label]) => <Pressable key={label} onPress={() => setFieldingSequence((current) => `${current}${mark}`)} style={styles.fieldingSymbolAction}><Text style={styles.fieldingSymbolActionCode}>{mark}</Text><Text style={styles.fieldingSymbolActionLabel}>{label}</Text></Pressable>)}</View><TextInput value={fieldingSequence} onChangeText={setFieldingSequence} placeholder="例如：6ー3、4ー6ー3 DP、3A、5E3" placeholderTextColor={BRAND.muted} style={styles.formInput} /><Text style={styles.substitutionContext}>即時預覽：{[trajectory, direction, resultCode, fieldingSequence].filter(Boolean).join(" · ")}</Text><Button label="預覽正式補登" onPress={() => transitionTo("preview")} fluid /></> : null}
    {step === "preview" ? <><View style={styles.confirmationSummary}><Text style={styles.confirmationSummaryTitle}>{isReplacement ? "正式重建預覽" : "正式補登預覽"}</Text><Text style={styles.confirmationSummaryText}>逐球：{pitchPreview?.value || (result === "HBP" ? "觸身球（無逐球符號）" : "—")}</Text><Text style={styles.confirmationSummaryText}>外圈／右下：{[trajectory, direction, displayResultCode, fieldingSequence].filter(Boolean).join(" · ") || displayResultCode}</Text><Text style={styles.confirmationSummaryText}>{isReplacement ? "確認後只會重建此單一打席；其他打席不變，並保留原始與重建內容的更正歷程。" : "確認後會建立正式打席、更正歷程，並重播比分、出局、跑壘與投打統計；返回調整不會寫入資料。"}</Text></View><Text style={styles.inputLabel}>更正備註（選填）</Text><TextInput value={note} onChangeText={setNote} style={[styles.formInput, { minHeight: 64, textAlignVertical: "top" }]} multiline placeholder="例如：依紙本紀錄核對" placeholderTextColor={BRAND.muted} /></> : null}
    </Animated.View>
    <View style={styles.confirmationActionRow}><View style={styles.confirmationActionFlex}>{step === "players" ? <Button label="取消" onPress={onClose} variant="secondary" touch fluid /> : <Button label="上一步" onPress={back} variant="secondary" touch fluid />}</View><View style={styles.confirmationActionFlex}>{step === "players" ? <Button label="開始逐球輸入" onPress={() => { if (!batterId || !pitcherId) Alert.alert("請選擇打者與投手", "正式補登需指定本打席的打者與投手。 "); else transitionTo("pitches"); }} touch fluid /> : step === "preview" ? <Button label={isReplacement ? "確認正式重建" : "確認正式補登"} onPress={() => { if (isReplacement && replacementTarget && onReplace) onReplace(replacementTarget, previewEvent, note); else onSubmit(slot, previewEvent, note); }} touch fluid /> : null}</View></View>
  </ScrollView></View></View></Modal>;
}

function SpecialEventModal({ visible, game, teams, onClose, onSubmit }: { visible: boolean; game: Game; teams: Team[]; onClose: () => void; onSubmit: (draft: SpecialDraft) => void }) {
  const [type, setType] = useState<SpecialEventType>("SB");
  const [fromBase, setFromBase] = useState<1 | 2 | 3>(1);
  const [toBase, setToBase] = useState<2 | 3 | 4>(2);
  const [reason, setReason] = useState("");
  const battingTeam = teams.find((team) => team.id === (game.half === "away" ? game.awayTeamId : game.homeTeamId));
  const pitcherTeam = teams.find((team) => team.id === (game.half === "away" ? game.homeTeamId : game.awayTeamId));
  const activeRunner = fromBase === 1 ? game.runners.first : fromBase === 2 ? game.runners.second : game.runners.third;
  const runnerName = battingTeam?.players.find((player) => player.id === activeRunner)?.name ?? "目前沒有跑者";
  const options: Array<{ type: SpecialEventType; mark: string; title: string; text: string }> = [
    { type: "SB", mark: "SB", title: "盜壘成功", text: "跑者安全前進一個壘包，記錄 SB。" },
    { type: "CS", mark: "CS", title: "盜壘刺", text: "跑者被觸殺或封殺，計一個出局，記錄 CS。" },
    { type: "WP", mark: "WP", title: "暴投", text: "投球無法由捕手正常處理，跑者依規則前進。" },
    { type: "PB", mark: "PB", title: "捕逸", text: "捕手可合理接住但未能處理，跑者依規則前進。" },
    { type: "BK", mark: "BK", title: "投手犯規", text: "投手犯規使壘上跑者前進，記錄 BK。" },
    { type: "OFFENSIVE_TIMEOUT", mark: "O.C", title: "攻方暫停", text: "早稻田註記；僅保留攻方暫停時間線，不改變比分、出局、跑者或投打統計。" },
    { type: "DEFENSIVE_TIMEOUT", mark: "T", title: "守方暫停", text: "早稻田註記；僅保留守方暫停時間線，不改變比分、出局、跑者或投打統計。" },
  ];
  useEffect(() => {
    if (visible) setReason("");
  }, [visible]);
  useEffect(() => {
    if (type === "CS") setToBase(fromBase === 1 ? 2 : fromBase === 2 ? 3 : 4);
    if (type === "SB" && toBase <= fromBase) setToBase(fromBase === 1 ? 2 : fromBase === 2 ? 3 : 4);
  }, [fromBase, toBase, type]);
  const isNeutralAnnotation = isStatNeutralSpecialEvent(type);
  const isTimeout = type === "OFFENSIVE_TIMEOUT" || type === "DEFENSIVE_TIMEOUT";
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><Text style={styles.modalTitle}>特殊事件紀錄</Text><Pressable onPress={onClose}><Text style={styles.modalClose}>關閉</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}><Text style={styles.substitutionContext}>目前：{game.inning}局{game.half === "away" ? "上" : "下"} · {isNeutralAnnotation ? "純註記，不影響統計" : `投手 ${pitcherTeam?.name ?? "未知"} · 跑者 ${runnerName}`}</Text>{options.map((option) => <Pressable key={option.type} onPress={() => setType(option.type)} style={[styles.specialEventOption, type === option.type && styles.specialEventOptionActive]}><Text style={styles.specialEventOptionTitle}>{option.mark} · {option.title}</Text><Text style={styles.specialEventOptionText}>{option.text}</Text></Pressable>)}{isTimeout ? <View style={styles.specialEventReasonCard}><Text style={styles.inputLabel}>暫停原因（選填）</Text><TextInput value={reason} onChangeText={setReason} maxLength={120} multiline placeholder={type === "OFFENSIVE_TIMEOUT" ? "例如：教練確認跑壘戰術、選手裝備調整" : "例如：捕手與投手溝通、守備站位調整"} placeholderTextColor={BRAND.muted} style={[styles.formInput, styles.specialEventReasonInput]} /><Text style={styles.specialEventReasonHint}>此欄只會顯示在本局歷程、完整預覽與匯出紀錄；不計入任何統計。</Text></View> : null}{(type === "SB" || type === "CS" || type === "BK") ? <><Text style={styles.inputLabel}>跑者所在壘包</Text><View style={styles.modalChoiceRow}>{([1, 2, 3] as const).map((base) => <Pressable key={base} onPress={() => setFromBase(base)} style={[styles.modalChoice, fromBase === base && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, fromBase === base && styles.modalChoiceTextActive]}>{base} 壘</Text></Pressable>)}</View></> : null}{(type === "SB" || type === "BK") ? <><Text style={styles.inputLabel}>前進至</Text><View style={styles.modalChoiceRow}>{([2, 3, 4] as const).map((base) => <Pressable key={base} onPress={() => setToBase(base)} style={[styles.modalChoice, toBase === base && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, toBase === base && styles.modalChoiceTextActive]}>{base === 4 ? "本壘" : `${base} 壘`}</Text></Pressable>)}</View></> : null}<Text style={styles.specialEventPreview}>預覽符號：{getSpecialEventNotation(type, fromBase, toBase)}{isTimeout && reason.trim() ? ` · ${reason.trim()}` : ""}</Text><View style={styles.tutorialActions}><View style={styles.tutorialActionFlex}><Button label="回到選項" variant="secondary" onPress={() => { setType("SB"); setReason(""); }} /></View><View style={styles.tutorialActionFlex}><Button label={isNeutralAnnotation ? "儲存純註記" : "儲存特殊事件"} onPress={() => onSubmit({ type, fromBase, toBase, reason: isTimeout ? reason.trim() || undefined : undefined })} /></View></View></ScrollView></View></View></Modal>;
}

function getRosterCompleteness(players: PrimaryTeamWizardPlayer[]) {
  const configuredPlayers = players.filter((player) => player.name.trim());
  const numberCounts = configuredPlayers.reduce<Record<string, number>>((counts, player) => {
    const number = player.number.trim();
    counts[number] = (counts[number] ?? 0) + 1;
    return counts;
  }, {});
  const duplicateNumbers = Object.entries(numberCounts).filter(([number, count]) => /^\d{1,2}$/.test(number) && count > 1).map(([number]) => number);
  const validNumbers = configuredPlayers.filter((player) => {
    const number = player.number.trim();
    const parsed = Number(number);
    return /^\d{1,2}$/.test(number) && parsed >= 1 && parsed <= 99 && numberCounts[number] === 1;
  }).length;
  const handedness = configuredPlayers.filter((player) => Boolean(player.throwingHand && player.battingHand)).length;
  const preferredPositions = configuredPlayers.filter((player) => player.preferredPositions.length > 0).length;
  const warnings = [
    ...(duplicateNumbers.length ? [`重複背號：${duplicateNumbers.join("、")}號`] : []),
    ...(handedness < configuredPlayers.length ? [`${configuredPlayers.length - handedness} 位隊員尚未設定投打`] : []),
    ...(preferredPositions < configuredPlayers.length ? [`${configuredPlayers.length - preferredPositions} 位隊員尚未設定慣用守位`] : []),
  ];
  return { total: configuredPlayers.length, validNumbers, handedness, preferredPositions, warnings };
}

function PrimaryTeamWizard({ visible, teams, onClose, onSubmit }: { visible: boolean; teams: Team[]; onClose: () => void; onSubmit: (input: PrimaryTeamWizardInput) => Team | null }) {
  const createPlayer = (index: number): PrimaryTeamWizardPlayer => ({ id: `wizard-player-${Date.now()}-${index}`, name: "", number: String(index), throwingHand: "R", battingHand: "R", preferredPositions: [] });
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<AgeGroup>("U12");
  const [logoUri, setLogoUri] = useState<string | undefined>();
  const [players, setPlayers] = useState<PrimaryTeamWizardPlayer[]>([createPlayer(1)]);
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const activePlayer = players.find((player) => player.id === activePlayerId) ?? players[0];
  const configuredPlayers = players.filter((player) => player.name.trim());
  const rosterSummary = getRosterCompleteness(players);

  useEffect(() => {
    if (visible) return;
    setStep(1);
    setName("");
    setLevel("U12");
    setLogoUri(undefined);
    setPlayers([createPlayer(1)]);
    setActivePlayerId(null);
    setCreated(false);
  }, [visible]);

  const updatePlayer = (id: string, patch: Partial<PrimaryTeamWizardPlayer>) => setPlayers((current) => current.map((player) => player.id === id ? { ...player, ...patch } : player));
  const chooseLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.9, base64: Platform.OS === "web" });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const sourceUri = Platform.OS === "web" && asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      const cropSize = Math.min(asset.width || 512, asset.height || 512);
      const prepared = await ImageManipulator.manipulateAsync(sourceUri, [{ crop: { originX: Math.max(0, Math.round(((asset.width || cropSize) - cropSize) / 2)), originY: Math.max(0, Math.round(((asset.height || cropSize) - cropSize) / 2)), width: cropSize, height: cropSize } }, { resize: { width: 512, height: 512 } }], { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG, base64: true });
      setLogoUri(prepared.base64 ? `data:image/jpeg;base64,${prepared.base64}` : prepared.uri);
    } catch {
      Alert.alert("無法設定隊徽", "請確認相簿權限後再試一次。");
    }
  };
  const togglePosition = (position: string) => {
    if (!activePlayer) return;
    const selected = activePlayer.preferredPositions;
    if (selected.includes(position)) {
      updatePlayer(activePlayer.id, { preferredPositions: selected.filter((item) => item !== position) });
      return;
    }
    if (selected.length >= 4) {
      Alert.alert("最多四個慣用守位", "請先取消一個已選位置，再選擇新的守備位置。");
      return;
    }
    updatePlayer(activePlayer.id, { preferredPositions: [...selected, position] });
  };
  const hasDuplicateTeamName = (value: string) => {
    const normalizedName = value.trim().toLocaleLowerCase("zh-Hant");
    return Boolean(normalizedName) && teams.some((team) => team.name.trim().toLocaleLowerCase("zh-Hant") === normalizedName);
  };
  const next = () => {
    if (step === 1 && !name.trim()) {
      Alert.alert("請輸入隊伍名稱", "建立所屬球隊前，請先填寫隊伍名稱。");
      return;
    }
    if (step === 1 && hasDuplicateTeamName(name)) {
      Alert.alert("此隊名已存在", "請使用不同名稱後再繼續建立球隊。");
      return;
    }
    if (step === 2) {
      const configured = players.filter((player) => player.name.trim());
      const numbers = configured.map((player) => player.number.trim());
      if (!configured.length || configured.some((player) => !/^\d{1,2}$/.test(player.number.trim())) || new Set(numbers).size !== numbers.length) {
        Alert.alert("隊員資料尚未完成", "請至少建立一位隊員，背號需為 1–99 且不可重複。");
        return;
      }
    }
    setStep((current) => Math.min(3, current + 1));
  };
  const submit = () => {
    if (hasDuplicateTeamName(name)) {
      Alert.alert("此隊名已存在", "請使用不同名稱後再確認建立。");
      setStep(1);
      return;
    }
    const result = onSubmit({ name, logoUri, level, players: configuredPlayers }) as Team | null | false;
    if (result !== false && result) {
      setCreated(true);
      if (rosterSummary.warnings.length) {
        Alert.alert("已建立名單完整度摘要", `建立完成，已設為所屬球隊。\n${rosterSummary.warnings.join("\n")}`);
      }
    }
  };
  const body = created ? <View style={styles.wizardStepPanel}><Text style={styles.registrationTitle}>所屬球隊已建立</Text><Text style={styles.registrationHint}>{name} 已設為所屬球隊；以下摘要可協助您快速檢查名單資料。</Text><View style={styles.teamBrandingCard}>{logoUri ? <Image source={{ uri: logoUri }} style={styles.teamLogoPreview} /> : <View style={styles.teamLogoFallback}><Text style={styles.teamLogoFallbackText}>完成</Text></View>}<View style={styles.teamBrandingCopy}><Text style={styles.teamBrandingTitle}>{name}</Text><Text style={styles.teamBrandingHint}>{level} · {rosterSummary.total} 位隊員</Text></View></View><View style={styles.registrationPanel}><Text style={styles.inputLabel}>名單完整度摘要</Text><View style={styles.modalChoiceRow}><View style={styles.modalChoice}><Text style={styles.modalChoiceText}>隊員 {rosterSummary.total} 位</Text></View><View style={styles.modalChoice}><Text style={styles.modalChoiceText}>背號 {rosterSummary.validNumbers}/{rosterSummary.total}</Text></View><View style={styles.modalChoice}><Text style={styles.modalChoiceText}>投打 {rosterSummary.handedness}/{rosterSummary.total}</Text></View><View style={styles.modalChoice}><Text style={styles.modalChoiceText}>守位 {rosterSummary.preferredPositions}/{rosterSummary.total}</Text></View></View><Text style={styles.teamBrandingHint}>{rosterSummary.preferredPositions < rosterSummary.total ? `尚有 ${rosterSummary.total - rosterSummary.preferredPositions} 位隊員未設定慣用守位；不影響球隊建立，可於球隊設定補齊。` : "隊員的背號、投打資料與慣用守位皆已完成設定。"}</Text></View></View> : step === 1 ? <View style={styles.wizardStepPanel}><Text style={styles.inputLabel}>隊伍名稱</Text><TextInput value={name} onChangeText={setName} placeholder="例如：復興少棒67" placeholderTextColor={BRAND.muted} maxLength={28} style={styles.formInput} /><Text style={styles.inputLabel}>球隊層級</Text><View style={styles.modalChoiceRow}>{AGE_GROUP_OPTIONS.map((option) => <Pressable key={option} onPress={() => setLevel(option)} style={[styles.inningsChoice, level === option && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, level === option && styles.modalChoiceTextActive]}>{option}</Text></Pressable>)}</View><Text style={styles.inputLabel}>隊徽（可選）</Text><View style={styles.teamBrandingCard}>{logoUri ? <Image source={{ uri: logoUri }} style={styles.teamLogoPreview} /> : <View style={styles.teamLogoFallback}><Text style={styles.teamLogoFallbackText}>隊徽</Text></View>}<View style={styles.teamBrandingCopy}><Text style={styles.teamBrandingTitle}>{logoUri ? "已準備 1:1 隊徽" : "尚未設定隊徽"}</Text><Text style={styles.teamBrandingHint}>選取後會自動裁切為 1:1 並壓縮為 512px。</Text><Button label={logoUri ? "更換隊徽" : "選擇隊徽"} compact variant="secondary" onPress={() => { void chooseLogo(); }} /></View></View></View> : step === 2 ? <View style={styles.wizardStepPanel}><View style={styles.registrationHeader}><View><Text style={styles.registrationTitle}>隊員名單</Text><Text style={styles.registrationHint}>逐位設定姓名、背號、投打慣用手與最多四個慣用守位。</Text></View><Text style={styles.registrationCount}>{players.filter((player) => player.name.trim()).length}/{Math.min(players.length, 25)} 人</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.registrationList}>{players.map((player, index) => <Pressable key={player.id} onPress={() => setActivePlayerId(player.id)} style={[styles.registrationChip, activePlayer?.id === player.id && styles.registrationChipActive]}><Text style={[styles.registrationChipNumber, activePlayer?.id === player.id && styles.registrationChipTextActive]}>#{player.number || index + 1}</Text><Text numberOfLines={1} style={[styles.registrationChipText, activePlayer?.id === player.id && styles.registrationChipTextActive]}>{player.name || `隊員 ${index + 1}`} {player.throwingHand}{player.battingHand}</Text></Pressable>)}</ScrollView>{activePlayer ? <View style={styles.registrationPanel}><Text style={styles.inputLabel}>目前編輯：隊員 {players.findIndex((player) => player.id === activePlayer.id) + 1}</Text><View style={styles.exportInputRow}><TextInput value={activePlayer.name} onChangeText={(value) => updatePlayer(activePlayer.id, { name: value })} placeholder="隊員姓名" placeholderTextColor={BRAND.muted} maxLength={18} style={[styles.formInput, styles.wizardCreateTeamInput]} /><TextInput value={activePlayer.number} onChangeText={(value) => updatePlayer(activePlayer.id, { number: value.replace(/[^0-9]/g, "").slice(0, 2) })} placeholder="背號" placeholderTextColor={BRAND.muted} keyboardType="number-pad" maxLength={2} style={[styles.formInput, styles.exportNumberInput]} /></View><Text style={styles.inputLabel}>投／打慣用手</Text><View style={styles.modalChoiceRow}>{(["R", "L"] as const).map((hand) => <Pressable key={`throw-${hand}`} onPress={() => updatePlayer(activePlayer.id, { throwingHand: hand })} style={[styles.modalChoice, activePlayer.throwingHand === hand && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, activePlayer.throwingHand === hand && styles.modalChoiceTextActive]}>{hand === "R" ? "右投" : "左投"}</Text></Pressable>)}{(["R", "L"] as const).map((hand) => <Pressable key={`bat-${hand}`} onPress={() => updatePlayer(activePlayer.id, { battingHand: hand })} style={[styles.modalChoice, activePlayer.battingHand === hand && styles.modalChoiceActive]}><Text style={[styles.modalChoiceText, activePlayer.battingHand === hand && styles.modalChoiceTextActive]}>{hand === "R" ? "右打" : "左打"}</Text></Pressable>)}</View><Text style={styles.inputLabel}>慣用守備位置（{activePlayer.preferredPositions.length}/4）</Text><PreferredPositionFieldPicker selectedPositions={activePlayer.preferredPositions} onToggle={togglePosition} /><View style={styles.defensivePositionRow}>{FIELD_POSITIONS.map((position) => <Pressable key={position.number} onPress={() => togglePosition(position.number)} style={[styles.defensivePositionChip, activePlayer.preferredPositions.includes(position.number) && styles.defensivePositionChipActive]}><Text style={[styles.defensivePositionNumber, activePlayer.preferredPositions.includes(position.number) && styles.defensivePositionTextActive]}>{position.number}</Text><Text style={[styles.defensivePositionLabel, activePlayer.preferredPositions.includes(position.number) && styles.defensivePositionTextActive]}>{position.label}</Text></Pressable>)}</View></View> : null}<View style={styles.exportPresetRow}><Button label="＋ 新增隊員" compact variant="secondary" disabled={players.length >= 25} onPress={() => { const nextPlayer = createPlayer(players.length + 1); setPlayers((current) => [...current, nextPlayer]); setActivePlayerId(nextPlayer.id); }} /><Button label="移除此隊員" compact variant="secondary" disabled={players.length <= 1 || !activePlayer} onPress={() => { if (!activePlayer) return; setPlayers((current) => current.filter((player) => player.id !== activePlayer.id)); setActivePlayerId(null); }} /></View></View> : <View style={styles.wizardStepPanel}><Text style={styles.registrationTitle}>確認所屬球隊</Text><Text style={styles.registrationHint}>建立後會立刻設為「所屬球隊」，可再由球隊設定調整隊徽、底色與完整名單。</Text><View style={styles.teamBrandingCard}>{logoUri ? <Image source={{ uri: logoUri }} style={styles.teamLogoPreview} /> : <View style={styles.teamLogoFallback}><Text style={styles.teamLogoFallbackText}>隊徽</Text></View>}<View style={styles.teamBrandingCopy}><Text style={styles.teamBrandingTitle}>{name}</Text><Text style={styles.teamBrandingHint}>{level} · {players.filter((player) => player.name.trim()).length} 位隊員</Text></View></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.registrationList}>{players.filter((player) => player.name.trim()).map((player) => <View key={`confirm-${player.id}`} style={styles.registrationChip}><Text style={styles.registrationChipNumber}>#{player.number}</Text><Text numberOfLines={1} style={styles.registrationChipText}>{player.name} {player.throwingHand}{player.battingHand}</Text><Text numberOfLines={1} style={styles.registrationChipPosition}>{player.preferredPositions.map((position) => FIELD_POSITIONS.find((item) => item.number === position)?.label ?? position).join("／") || "未設定守位"}</Text></View>)}</ScrollView></View>;
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={[styles.modalSheet, styles.wizardModalSheet]}><View style={styles.modalHandle} /><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>建立所屬球隊</Text><Text style={styles.modalSubtitle}>建立流程 {created ? "完成 · 名單完整度摘要" : `${step}/3 · ${step === 1 ? "隊伍資料" : step === 2 ? "隊員名單" : "確認建立"}`}</Text></View><Pressable onPress={onClose}><Text style={styles.modalClose}>關閉</Text></Pressable></View><View style={styles.wizardProgressTrack}><View style={[styles.wizardProgressValue, { width: `${(step / 3) * 100}%` }]} /></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.wizardScrollContent}>{body}</ScrollView><View style={styles.wizardNavigation}><Button label="← 上一步" compact variant="secondary" disabled={step === 1 || created} onPress={() => setStep((current) => Math.max(1, current - 1))} /><Button label={created ? "完成" : step === 3 ? "確認建立所屬球隊" : "下一步 →"} compact onPress={created ? onClose : step === 3 ? submit : next} /></View></View></View></Modal>;
}

function SchoolManagerModal({ visible, schools, onClose, onAdd, onUpdate, onDuplicate, onDelete }: { visible: boolean; schools: School[]; onClose: () => void; onAdd: (name: string) => void; onUpdate: (schoolId: string, name: string) => void; onDuplicate: (schoolId: string) => void; onDelete: (schoolId: string) => void }) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  useEffect(() => { if (!visible) { setNewName(""); setEditingId(null); setEditingName(""); } }, [visible]);
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalSheet}><View style={styles.modalHandle} /><View style={styles.modalHeader}><Text style={styles.modalTitle}>學校與球員名單</Text><Pressable onPress={onClose}><Text style={styles.modalClose}>完成</Text></Pressable></View><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScrollContent}><Text style={styles.substitutionContext}>每間學校各自保存 1–18 號球員、棒次與守備位置；新增賽事時可直接選用。</Text><View style={styles.schoolAddRow}><TextInput value={newName} onChangeText={setNewName} style={[styles.formInput, styles.schoolAddInput]} placeholder="例如：東湖國小" placeholderTextColor={BRAND.muted} /><Button label="新增" compact onPress={() => { if (!newName.trim()) return; onAdd(newName); setNewName(""); }} /></View>{schools.map((school) => <View key={school.id} style={styles.schoolManagerCard}><View style={styles.schoolManagerHeader}><View style={styles.schoolManagerCopy}><Text style={styles.schoolManagerName}>{school.name}</Text><Text style={styles.schoolManagerMeta}>{school.players.length} 名球員 · 最後更新 {school.updatedAt.slice(0, 10)}</Text></View><Pressable onPress={() => { setEditingId(school.id); setEditingName(school.name); }} style={styles.iconButton}><Text style={styles.schoolActionText}>編</Text></Pressable></View>{editingId === school.id ? <View style={styles.schoolEditRow}><TextInput value={editingName} onChangeText={setEditingName} style={[styles.formInput, styles.schoolEditInput]} placeholder="學校名稱" placeholderTextColor={BRAND.muted} /><Button label="儲存" compact onPress={() => { onUpdate(school.id, editingName); setEditingId(null); }} /></View> : null}<View style={styles.schoolActionRow}><Button label="複製名單" variant="secondary" compact onPress={() => onDuplicate(school.id)} /><Button label="刪除" variant="danger" compact onPress={() => onDelete(school.id)} /></View></View>)}</ScrollView></View></View></Modal>;
}

const styles = StyleSheet.create({
  appShell: { flex: 1, backgroundColor: BRAND.paper },

  /* 任務一：右側欄與主客場打線名單樣式 */
  rightRailColumn: { width: 252, minWidth: 214, gap: 8, alignSelf: "stretch" },
  liveLineupContainer: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, padding: 8, gap: 6 },
  liveLineupTitle: { color: BRAND.navy, fontSize: 11, fontWeight: "900", borderBottomWidth: 1, borderBottomColor: BRAND.line, paddingBottom: 4 },
  liveLineupSubRow: { flexDirection: "row", gap: 8 },
  liveLineupTeamCol: { flex: 1, minWidth: 0, gap: 4 },
  liveLineupTeamHeader: { fontSize: 10, fontWeight: "900" },
  lineupListWrap: { gap: 2 },
  lineupRowItem: { flexDirection: "row", alignItems: "center", gap: 3, paddingVertical: 1, paddingHorizontal: 3, borderRadius: 4 },
  lineupRowItemActive: { backgroundColor: "#EFF6FF", borderWidth: 0.5, borderColor: "#BFDBFE" },
  lineupOrderText: { color: BRAND.muted, fontSize: 8, fontWeight: "900", width: 10 },
  lineupOrderTextActive: { color: BRAND.blue },
  lineupNumberText: { color: BRAND.muted, fontSize: 8, width: 14, fontWeight: "700" },
  lineupNumberTextActive: { color: BRAND.blue, fontWeight: "900" },
  lineupNameText: { color: BRAND.ink, fontSize: 9, flex: 1, fontWeight: "700" },
  lineupNameTextActive: { color: BRAND.blue, fontWeight: "900" },
  lineupPosText: { color: BRAND.muted, fontSize: 7, fontWeight: "900" },
  lineupPosTextActive: { color: BRAND.blue },

  /* 任務二：投手區塊與打者區塊樣式 */
  middlePitcherPanel: { backgroundColor: BRAND.white, borderColor: BRAND.line, padding: 10 },
  pitcherSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pitcherTitleGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
  pitcherHeaderLabel: { backgroundColor: BRAND.navy, color: BRAND.white, fontSize: 13, fontWeight: "900", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  pitcherMetaGroup: { gap: 2 },
  pitcherTeamName: { color: BRAND.muted, fontSize: 10, fontWeight: "700" },
  pitcherNameText: { color: BRAND.ink, fontSize: 14, fontWeight: "900" },
  pitcherLimitBox: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignItems: "flex-end" },
  pitcherLimitPitches: { fontSize: 13, fontWeight: "900" },
  pitcherLimitDesc: { fontSize: 10, fontWeight: "700", marginTop: 1 },
  pitcherHistoriesRow: { flexDirection: "row", gap: 8, borderTopWidth: 0.5, borderTopColor: BRAND.line, paddingTop: 6, marginTop: 4, flexWrap: "wrap" },
  pitcherHistoryChipText: { fontSize: 9, color: BRAND.muted, fontWeight: "700" },
  pitcherHistoryChipTextActive: { color: BRAND.navy, fontWeight: "900" },

  middleBatterPanel: { borderWidth: 1.5, padding: 10 },
  batterSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  batterTitleGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
  batterHeaderLabel: { backgroundColor: BRAND.white, borderWidth: 1.5, fontSize: 13, fontWeight: "900", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  batterMetaGroup: { gap: 2 },
  batterTeamName: { color: BRAND.muted, fontSize: 10, fontWeight: "700" },
  batterNameText: { color: BRAND.ink, fontSize: 14, fontWeight: "900" },
  batterCountsGroup: { flexDirection: "row", gap: 6 },
  compactCountPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  compactCountLabel: { fontSize: 9, fontWeight: "700", color: BRAND.muted },
  compactCountValue: { fontSize: 11, fontWeight: "900", color: BRAND.navy },
  strikeLabelColor: { color: "#C2410C" },
  strikeValueColor: { color: "#EA580C" },
  outLabelColor: { color: BRAND.red },
  outValueColor: { color: BRAND.red },

  /* 任務三：場地與跑壘狀況 100% 絕對定位樣式 */
  liveRunnerCrossContainer: { flex: 1, minWidth: 0, minHeight: 280, aspectRatio: 612 / 535, position: "relative", overflow: "hidden", borderRadius: 9, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line },
  liveRunnerCrossBackgroundImage: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, width: "100%", height: "100%", opacity: 0.88 },
  liveRunnerAbsoluteSlot: { position: "absolute", alignItems: "center", gap: 3 },
  teamPill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  awayPill: { backgroundColor: BRAND.sky },
  homePill: { backgroundColor: "#FCEBEC" },
  teamPillLabel: { color: BRAND.muted, fontSize: 9, fontWeight: "800" },
  teamPillName: { color: BRAND.ink, fontSize: 12, fontWeight: "900", marginTop: 2 },
  content: { paddingHorizontal: 9, paddingTop: 6, paddingBottom: 8 },
  pageGap: { gap: 8 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { color: BRAND.muted, fontSize: 16 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, backgroundColor: BRAND.white, borderBottomWidth: 1, borderBottomColor: BRAND.line },
  brandMark: { width: 30, height: 30, borderRadius: 9, overflow: "hidden", backgroundColor: BRAND.white },
  brandMarkDark: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.96)", shadowColor: "#FFFFFF", shadowOpacity: 0.58, shadowRadius: 6, shadowOffset: { width: 0, height: 0 }, elevation: 5 },
  brandMarkImage: { width: "100%", height: "100%" },
  brandCopy: { marginLeft: 7, flex: 1 },
  brandName: { color: BRAND.ink, fontSize: 13, fontWeight: "800" },
  brandSub: { color: BRAND.muted, fontSize: 9, marginTop: 0 },
  syncPill: { flexDirection: "row", alignItems: "center", backgroundColor: BRAND.sky, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 999 },
  orientationDiagnosticPill: { flexDirection: "row", alignItems: "center", marginLeft: 6, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  orientationDiagnosticHealthy: { backgroundColor: "#EAF8EF", borderColor: "#B9E7C9" },
  orientationDiagnosticPending: { backgroundColor: "#FFF8E6", borderColor: "#F1D58B" },
  orientationDiagnosticDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  orientationDiagnosticDotHealthy: { backgroundColor: BRAND.green },
  orientationDiagnosticDotPending: { backgroundColor: BRAND.yellow },
  orientationDiagnosticText: { color: BRAND.navy, fontSize: 8, fontWeight: "800" },
  orientationRelockPill: { marginLeft: 4, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.55)", backgroundColor: "rgba(8,51,88,0.18)" },
  orientationRelockText: { color: "#FFFFFF", fontSize: 8, fontWeight: "800" },
  settingsPill: { flexDirection: "row", alignItems: "center", marginLeft: 6, backgroundColor: "#EEF3F9", borderWidth: 1, borderColor: BRAND.line, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 999 },
  settingsPillIcon: { color: BRAND.navy, fontSize: 13, marginRight: 3 },
  settingsPillText: { color: BRAND.navy, fontSize: 9, fontWeight: "800" },
  syncDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  syncOnline: { backgroundColor: BRAND.green },
  syncLocal: { backgroundColor: BRAND.yellow },
  syncText: { color: BRAND.navy, fontSize: 9, fontWeight: "700" },
  welcomeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  welcomeEyebrow: { color: BRAND.muted, fontSize: 10, fontWeight: "600" },
  welcomeTitle: { color: BRAND.ink, fontSize: 17, fontWeight: "800", lineHeight: 21, maxWidth: 285, marginTop: 2 },
  localStorageStatusCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#B9E7C9", backgroundColor: "#F0FAF4", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  localStorageStatusCopy: { flex: 1, marginRight: 8 },
  localStorageStatusTitle: { color: BRAND.green, fontSize: 10, fontWeight: "900" },
  localStorageStatusMeta: { color: BRAND.muted, fontSize: 9, marginTop: 1 },
  localStorageSizePill: { alignItems: "flex-end", borderLeftWidth: 1, borderLeftColor: "#CFE8D8", paddingLeft: 8 },
  localStorageSizeLabel: { color: BRAND.muted, fontSize: 8, fontWeight: "700" },
  localStorageSizeValue: { color: BRAND.navy, fontSize: 13, fontWeight: "900", marginTop: 1 },
  miniAvatar: { width: 34, height: 34, borderRadius: 17, overflow: "hidden", backgroundColor: BRAND.white },
  miniAvatarDark: { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.96)", shadowColor: "#FFFFFF", shadowOpacity: 0.58, shadowRadius: 7, shadowOffset: { width: 0, height: 0 }, elevation: 5 },
  miniAvatarImage: { width: "100%", height: "100%" },
  homeLandscapeWorkspace: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  homeMainColumn: { flex: 1, minWidth: 300, gap: 6 },
  homeSetupColumn: { flex: 1.08, minWidth: 320, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, padding: 6, gap: 5 },
  heroCard: { backgroundColor: BRAND.navy, borderRadius: 12, padding: 8, overflow: "hidden" },
  heroAccent: { position: "absolute", right: -30, top: -42, width: 160, height: 160, borderRadius: 80, borderWidth: 22, borderColor: "rgba(255,255,255,0.08)" },
  heroTop: { flexDirection: "row", justifyContent: "space-between" },
  heroEyebrow: { color: "#AFC8E2", fontSize: 9, fontWeight: "700", letterSpacing: 0.7 },
  heroTitle: { color: BRAND.white, fontSize: 15, fontWeight: "800", marginTop: 2, maxWidth: 240 },
  heroMeta: { color: "#BBD0E5", fontSize: 10, marginTop: 2 },
  heroBaseball: { fontSize: 27, opacity: 0.9 },
  heroScoreRow: { flexDirection: "row", alignItems: "center", marginTop: 8, paddingBottom: 7, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.15)" },
  heroTeam: { color: "#C9DCEC", fontSize: 12, fontWeight: "700" },
  heroTeamRight: { alignItems: "flex-end", flex: 1 },
  heroScore: { color: BRAND.white, fontSize: 31, lineHeight: 35, fontWeight: "900", marginTop: 0 },
  heroVs: { color: "#8FAECD", fontSize: 10, fontWeight: "800", marginHorizontal: 12, paddingTop: 7 },
  heroFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 7 },
  heroFooterLabel: { color: BRAND.white, fontSize: 10, fontWeight: "800" },
  heroFooterValue: { color: "#AFC8E2", fontSize: 9, marginTop: 1 },
  sectionTitleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionTitleCopy: { flex: 1 },
  eyebrow: { color: BRAND.blue, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  sectionTitle: { color: BRAND.ink, fontSize: 16, fontWeight: "900", marginTop: 1 },
  smallMuted: { color: BRAND.muted, fontSize: 10 },
  mutedText: { color: BRAND.muted, fontSize: 10, marginTop: 2 },
  button: { backgroundColor: BRAND.blue, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, alignItems: "center", justifyContent: "center", minHeight: 36 },
  buttonCompact: { paddingHorizontal: 9, paddingVertical: 6, minHeight: 32 },
  buttonTouch: { minHeight: 40, paddingHorizontal: 10, paddingVertical: 8 },
  buttonFluid: { flex: 1, minWidth: 0 },
  buttonSecondary: { backgroundColor: BRAND.sky, borderWidth: 1, borderColor: "#C7DCEE" },
  buttonDanger: { backgroundColor: BRAND.red },
  buttonGhost: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line },
  buttonText: { color: BRAND.white, fontSize: 11, fontWeight: "800" },
  buttonTextTouch: { fontSize: 12 },
  buttonSecondaryText: { color: BRAND.navy },
  buttonGhostText: { color: BRAND.navy },
  buttonDisabled: { opacity: 0.45 },
  buttonDisabledText: { color: BRAND.muted },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  gameList: { gap: 5 },
  recentSearchRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap", marginTop: -2 },
  recentDateInput: { width: 116, height: 30, borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, backgroundColor: BRAND.white, color: BRAND.ink, fontSize: 10, paddingHorizontal: 7 },
  recentSearchSeparator: { color: BRAND.muted, fontSize: 10, fontWeight: "800" },
  recentCompetitionInput: { flex: 1, minWidth: 116, height: 30, borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, backgroundColor: BRAND.white, color: BRAND.ink, fontSize: 10, paddingHorizontal: 7 },
  recentUndoBar: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF8E6", borderWidth: 1, borderColor: "#F0D486", borderRadius: 9, paddingLeft: 8, paddingRight: 4, marginTop: 1 },
  recentUndoText: { flex: 1, color: BRAND.ink, fontSize: 10, fontWeight: "700" },
  operationFeedbackToast: { position: "absolute", zIndex: 30, top: 5, alignSelf: "center", maxWidth: "72%", minHeight: 42, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 11, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, shadowColor: "#10243E", shadowOpacity: 0.18, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  operationFeedbackSuccess: { backgroundColor: "#EDFFF5", borderColor: "#92D9B2" },
  operationFeedbackRestore: { backgroundColor: "#FFF8E6", borderColor: "#F0D486" },
  operationFeedbackIcon: { width: 18, height: 18, borderRadius: 9, overflow: "hidden", textAlign: "center", color: BRAND.white, backgroundColor: BRAND.green, fontSize: 13, lineHeight: 18, fontWeight: "900" },
  operationFeedbackRestoreIcon: { backgroundColor: BRAND.yellow },
  operationFeedbackCopy: { flex: 1, minWidth: 0 },
  operationFeedbackTitle: { color: BRAND.ink, fontSize: 11, lineHeight: 14, fontWeight: "900" },
  operationFeedbackDetail: { color: BRAND.muted, fontSize: 9, lineHeight: 12, fontWeight: "700", marginTop: 1 },
  gameListItem: { backgroundColor: BRAND.white, borderRadius: 11, padding: 5, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: BRAND.line },
  gameListOpen: { flex: 1, flexDirection: "row", alignItems: "center", minWidth: 0 },
  gameDate: { width: 34, height: 34, borderRadius: 9, backgroundColor: BRAND.sky, alignItems: "center", justifyContent: "center" },
  gameDateDay: { color: BRAND.navy, fontSize: 14, fontWeight: "900" },
  gameDateMonth: { color: BRAND.blue, fontSize: 9, fontWeight: "700" },
  gameListCopy: { flex: 1, marginLeft: 7 },
  gameListTitle: { color: BRAND.ink, fontSize: 12, fontWeight: "800" },
  gameListMeta: { color: BRAND.muted, fontSize: 9, marginTop: 1 },
  gameListResult: { alignItems: "flex-end", gap: 3 },
  gameListStatus: { color: BRAND.green, fontSize: 10, fontWeight: "800" },
  gameListArrow: { color: BRAND.muted, fontSize: 22, lineHeight: 20 },
  deleteGameButton: { minHeight: 30, minWidth: 38, borderRadius: 7, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1F1", borderWidth: 1, borderColor: "#F4C4C7", marginLeft: 5 },
  deleteGameButtonText: { color: BRAND.red, fontSize: 10, fontWeight: "900" },
  recentEmpty: { alignItems: "center", justifyContent: "center", minHeight: 52, borderRadius: 10, borderWidth: 1, borderColor: BRAND.line, borderStyle: "dashed", backgroundColor: "#FBFDFF", padding: 8 },
  recentEmptyText: { color: BRAND.muted, fontSize: 11, fontWeight: "700" },
  infoStrip: { flexDirection: "row", backgroundColor: "#FFF9E9", borderWidth: 1, borderColor: "#F2DF9E", borderRadius: 10, padding: 8 },
  infoIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: BRAND.yellow, color: BRAND.white, textAlign: "center", lineHeight: 20, fontWeight: "900", marginRight: 10 },
  infoCopy: { flex: 1 },
  infoTitle: { color: BRAND.ink, fontSize: 13, fontWeight: "800" },
  infoText: { color: BRAND.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  wbcImportCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, backgroundColor: "#EEF5FF", borderWidth: 1, borderColor: "#BFD6F2", borderRadius: 10, padding: 8 },
  wbcImportCopy: { flex: 1 },
  wbcImportEyebrow: { color: BRAND.blue, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  wbcImportTitle: { color: BRAND.ink, fontSize: 15, fontWeight: "900", marginTop: 3 },
  wbcImportText: { color: BRAND.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  scoreCard: { backgroundColor: BRAND.white, borderRadius: 12, borderWidth: 1, borderColor: BRAND.line, padding: 8 },
  photoScoreboard: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, overflow: "hidden" },
  photoScoreboardCaption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 7, paddingVertical: 5, backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: BRAND.line },
  photoScoreboardTitle: { color: BRAND.navy, fontSize: 12, fontWeight: "900" },
  photoScoreboardMeta: { color: BRAND.muted, fontSize: 9, fontWeight: "700" },
  photoScoreboardScroll: { minWidth: "100%" },
  photoScoreboardHeaderRow: { flexDirection: "row", backgroundColor: BRAND.navy },
  photoScoreboardHeaderText: { color: BRAND.white, fontSize: 9, fontWeight: "900", textAlign: "center", paddingVertical: 5 },
  photoScoreboardTeamHeader: { width: 112, paddingHorizontal: 6, textAlign: "left" },
  photoScoreboardInningHeader: { width: 27, borderLeftWidth: 1, borderLeftColor: "#315A88" },
  photoScoreboardTotalHeader: { width: 28, borderLeftWidth: 1, borderLeftColor: "#315A88" },
  photoScoreboardTeamRow: { flexDirection: "row", backgroundColor: "#F8FBFF", borderTopWidth: 1, borderTopColor: "#E2EAF2" },
  photoScoreboardHomeRow: { backgroundColor: "#F1FAF5" },
  photoScoreboardTeamCell: { width: 112, minHeight: 27, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6 },
  photoScoreboardSide: { color: BRAND.blue, fontSize: 10, fontWeight: "900" },
  photoScoreboardTeamName: { flex: 1, color: BRAND.ink, fontSize: 11, fontWeight: "800" },
  photoScoreboardInningCell: { width: 27, minHeight: 27, textAlign: "center", textAlignVertical: "center", color: BRAND.ink, fontSize: 10, fontWeight: "800", borderLeftWidth: 1, borderLeftColor: "#E2EAF2", paddingTop: 7 },
  photoScoreboardTotalCell: { width: 28, minHeight: 27, textAlign: "center", textAlignVertical: "center", color: BRAND.navy, backgroundColor: "#E7F0FA", fontSize: 10, fontWeight: "900", borderLeftWidth: 1, borderLeftColor: "#BFD2E7", paddingTop: 7 },
  photoScoreboardActiveHeader: { backgroundColor: BRAND.blue },
  photoScoreboardActiveCell: { backgroundColor: "#FFF5D6", color: BRAND.navy },
  scoreCardTop: { flexDirection: "row", justifyContent: "space-between" },
  scoreEyebrow: { color: BRAND.blue, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  scoreTitle: { color: BRAND.ink, fontSize: 16, fontWeight: "800", marginTop: 4 },
  scoreVenue: { color: BRAND.muted, fontSize: 11, marginTop: 3 },
  liveBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "#EAF8F1", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: BRAND.green, marginRight: 4 },
  liveBadgeText: { color: BRAND.green, fontSize: 9, fontWeight: "900" },
  scoreMain: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14 },
  scoreTeamBlock: { flex: 1, alignItems: "center" },
  scoreTeamLabel: { color: BRAND.blue, fontSize: 11, fontWeight: "900" },
  homeScoreLabel: { color: BRAND.red },
  scoreTeamName: { color: BRAND.ink, fontSize: 12, fontWeight: "700", marginTop: 3 },
  scoreNumber: { color: BRAND.navy, fontSize: 34, fontWeight: "900", marginTop: 2 },
  scoreDash: { color: BRAND.muted, fontSize: 18 },
  inningTable: { paddingTop: 8, minWidth: 260 },
  inningRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#EDF2F7" },
  inningCell: { width: 30, textAlign: "center", paddingVertical: 5, color: BRAND.muted, fontSize: 10, fontWeight: "700" },
  inningHeaderCell: { color: BRAND.navy, fontWeight: "900" },
  teamRowLabel: { color: BRAND.navy, fontWeight: "900" },
  activeInningCell: { color: BRAND.blue, backgroundColor: BRAND.sky },
  recordHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: BRAND.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BRAND.line },
  iconButtonText: { color: BRAND.navy, fontSize: 24, fontWeight: "800", marginTop: -8 },
  setupCard: { backgroundColor: "#EEF8F3", borderWidth: 1, borderColor: "#C7E8D7", borderRadius: 11, padding: 8, gap: 5 },
  setupTitle: { color: BRAND.green, fontSize: 12, fontWeight: "800" },
  setupText: { color: BRAND.muted, fontSize: 10, lineHeight: 13 },
  atBatCard: { backgroundColor: BRAND.white, borderRadius: 12, borderWidth: 1, borderColor: BRAND.line, padding: 8, gap: 6 },
  atBatTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  atBatTitle: { color: BRAND.ink, fontSize: 15, fontWeight: "900", marginTop: 1 },
  orderBadge: { color: BRAND.blue, backgroundColor: BRAND.sky, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 4, fontSize: 9, fontWeight: "800" },
  matchup: { flexDirection: "row", alignItems: "center", gap: 5 },
  playerCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: BRAND.sky, alignItems: "center", justifyContent: "center" },
  pitcherCircle: { backgroundColor: "#FCEBEC" },
  playerCircleNumber: { color: BRAND.navy, fontSize: 12, fontWeight: "900" },
  matchupCopy: { flex: 1 },
  matchupLabel: { color: BRAND.muted, fontSize: 10 },
  matchupName: { color: BRAND.ink, fontSize: 11, fontWeight: "800", marginTop: 0 },
  matchupMeta: { color: BRAND.muted, fontSize: 9, marginTop: 0 },
  matchupArrow: { color: BRAND.muted, fontSize: 11, fontWeight: "800" },
  countRow: { flexDirection: "row", gap: 4 },
  countBox: { flex: 1, backgroundColor: BRAND.paper, borderRadius: 8, alignItems: "center", paddingVertical: 5 },
  countValue: { color: BRAND.blue, fontSize: 16, fontWeight: "900" },
  strikeValue: { color: BRAND.green },
  outValue: { color: BRAND.red },
  pitchValue: { color: BRAND.navy },
  countLabel: { color: BRAND.muted, fontSize: 9, marginTop: 2 },
  diamondWrap: { alignItems: "center", paddingVertical: 3 },
  diamond: { width: 90, height: 90, position: "relative", transform: [{ rotate: "45deg" }] },
  base: { width: 20, height: 20, borderWidth: 2, borderColor: BRAND.navy, backgroundColor: BRAND.white, position: "absolute", alignItems: "center", justifyContent: "center" },
  secondBase: { top: 0, left: 35 },
  thirdBase: { top: 35, left: 0 },
  firstBase: { top: 35, right: 0 },
  occupiedBase: { backgroundColor: BRAND.yellow, borderColor: BRAND.yellow },
  baseText: { transform: [{ rotate: "-45deg" }], color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  homePlate: { width: 22, height: 22, borderWidth: 2, borderColor: BRAND.navy, backgroundColor: BRAND.sky, position: "absolute", bottom: 0, left: 34, alignItems: "center", justifyContent: "center" },
  homePlateText: { transform: [{ rotate: "-45deg" }], color: BRAND.navy, fontSize: 9, fontWeight: "900" },
  diamondCaption: { color: BRAND.muted, fontSize: 10, marginTop: -3 },
  inputLabel: { color: BRAND.navy, fontSize: 12, fontWeight: "900", marginTop: 2 },
  pitchRow: { flexDirection: "row", gap: 5 },
  pitchButton: { minHeight: 44 },
  pitchRowButton: { flex: 1 },
  positionRow: { gap: 7 },
  positionChip: { minWidth: 40, height: 40, borderWidth: 1, borderColor: BRAND.line, backgroundColor: BRAND.white, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  positionChipActive: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  positionChipNumber: { color: BRAND.navy, fontSize: 13, fontWeight: "900" },
  positionChipNumberActive: { color: BRAND.white },
  positionChipLabel: { color: BRAND.muted, fontSize: 9, marginTop: 2 },
  positionChipLabelActive: { color: "#C9DCEC" },
  resultGrid: { flexDirection: "row", flexWrap: "wrap", gap: 3, justifyContent: "space-between" },
  resultButton: { width: "14.1%", minHeight: 39, borderRadius: 8, borderWidth: 1, borderColor: BRAND.line, backgroundColor: BRAND.paper, alignItems: "center", justifyContent: "center", paddingVertical: 3 },
  hitResultButton: { backgroundColor: "#EEF7FF", borderColor: "#C9DDF2" },
  outResultButton: { backgroundColor: "#FFF1F1", borderColor: "#F2C9CB" },
  resultButtonCode: { color: BRAND.navy, fontSize: 15, lineHeight: 18, fontWeight: "900" },
  resultButtonLabel: { color: BRAND.muted, fontSize: 8, lineHeight: 10, marginTop: 1 },
  notationHint: { color: BRAND.muted, fontSize: 11, textAlign: "center" },
  notationValue: { color: BRAND.blue, fontWeight: "900" },
  specialEventButton: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFF8E6", borderWidth: 1, borderColor: "#F0D58A", borderRadius: 9, padding: 7, minHeight: 42 },
  specialEventButtonIcon: { width: 25, height: 25, borderRadius: 7, backgroundColor: BRAND.yellow, color: BRAND.navy, textAlign: "center", lineHeight: 25, fontSize: 15, fontWeight: "900" },
  specialEventButtonTitle: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  specialEventButtonText: { color: BRAND.muted, fontSize: 10, marginTop: 3 },
  specialEventButtonArrow: { marginLeft: "auto", color: BRAND.navy, fontSize: 24, fontWeight: "900" },
  gestureHint: { color: BRAND.muted, fontSize: 10, textAlign: "center", marginTop: 8 },
  recentCard: { backgroundColor: BRAND.white, borderRadius: 11, borderWidth: 1, borderColor: BRAND.line, padding: 8, gap: 5 },
  eventCount: { color: BRAND.blue, fontSize: 11, fontWeight: "800" },
  emptyText: { color: BRAND.muted, fontSize: 12, lineHeight: 18 },
  eventRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#EDF2F7" },
  eventInning: { width: 30, alignItems: "center" },
  eventInningNumber: { color: BRAND.navy, fontSize: 14, fontWeight: "900" },
  eventInningHalf: { color: BRAND.muted, fontSize: 9 },
  eventMain: { flex: 1, marginLeft: 8 },
  eventBatter: { color: BRAND.ink, fontSize: 13, fontWeight: "800" },
  eventMeta: { color: BRAND.muted, fontSize: 10, marginTop: 3 },
  eventNotation: { color: BRAND.blue, fontSize: 17, fontWeight: "900" },
  specialEventInning: { backgroundColor: "#FFF8E6", borderRadius: 8, paddingVertical: 3 },
  recordFooter: { flexDirection: "row", gap: 9 },
  schoolSelector: { gap: 8, paddingVertical: 1 },
  schoolSelectorItem: { minWidth: 112, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 12 },
  schoolSelectorItemActive: { backgroundColor: BRAND.blue, borderColor: BRAND.blue },
  schoolSelectorName: { color: BRAND.ink, fontSize: 12, fontWeight: "900" },
  schoolSelectorNameActive: { color: BRAND.white },
  schoolSelectorMeta: { color: BRAND.muted, fontSize: 10, marginTop: 3 },
  teamSelectorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  teamSelectorTitle: { flex: 1, color: BRAND.navy, fontSize: 12, fontWeight: "900" },
  teamSelector: { gap: 9 },
  teamSelectorItem: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 13, minWidth: 140 },
  teamSelectorItemActive: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  teamSelectorNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  teamSelectorName: { color: BRAND.ink, fontSize: 13, fontWeight: "800" },
  teamSelectorNameActive: { color: BRAND.white },
  teamSelectorOwnedBadge: { color: BRAND.blue, fontSize: 9, fontWeight: "900", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, backgroundColor: "#E6F4FE", overflow: "hidden" },
  teamSelectorOwnedBadgeActive: { color: BRAND.navy, backgroundColor: "#C9DCEC" },
  teamSelectorMeta: { color: BRAND.muted, fontSize: 10, marginTop: 4 },
  teamSelectorMetaActive: { color: "#C9DCEC" },
  fieldCard: { backgroundColor: BRAND.white, borderRadius: 11, borderWidth: 1, borderColor: BRAND.line, padding: 8, gap: 5 },
  fieldPlayerInfoOverlay: { flex: 1, backgroundColor: "rgba(16,36,62,0.42)", justifyContent: "center", alignItems: "center", padding: 18 },
  fieldPlayerInfoModal: { width: "100%", maxWidth: 420, backgroundColor: BRAND.white, borderRadius: 14, borderWidth: 1, borderColor: BRAND.line, padding: 13, gap: 10, shadowColor: BRAND.ink, shadowOpacity: 0.18, shadowRadius: 12, elevation: 7 },
  fieldPlayerInfoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  fieldPlayerInfoEyebrow: { color: BRAND.blue, fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  fieldPlayerInfoName: { color: BRAND.ink, fontSize: 20, lineHeight: 26, fontWeight: "900" },
  fieldPlayerInfoClose: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.paper },
  fieldPlayerInfoCloseText: { color: BRAND.muted, fontSize: 22, lineHeight: 24, fontWeight: "700" },
  fieldPlayerInfoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  fieldPlayerInfoItem: { minWidth: 100, flexGrow: 1, backgroundColor: BRAND.paper, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  fieldPlayerInfoLabel: { color: BRAND.muted, fontSize: 10, fontWeight: "700" },
  fieldPlayerInfoValue: { color: BRAND.ink, fontSize: 13, lineHeight: 19, fontWeight: "800" },
  fieldPlayerInfoActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 7 },
  fieldHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7 },
  fieldHeaderActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, flexShrink: 1 },
  fieldTitle: { color: BRAND.ink, fontSize: 15, fontWeight: "900" },
  fieldHint: { color: BRAND.muted, fontSize: 10, marginTop: 3 },
  fieldSelected: { color: BRAND.blue, fontSize: 11, fontWeight: "900", maxWidth: 90, textAlign: "right" },
  fieldRosterStrip: { flexDirection: "row", gap: 6 },
  fieldPlayerChip: { width: 38, alignItems: "center", paddingVertical: 5, borderRadius: 9, backgroundColor: BRAND.paper },
  fieldPlayerChipActive: { backgroundColor: BRAND.navy },
  fieldPlayerNumber: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  fieldPlayerNumberActive: { color: BRAND.white },
  fieldPlayerName: { color: BRAND.muted, fontSize: 7, maxWidth: 34, marginTop: 2 },
  fieldPlayerNameActive: { color: "#D5E4F2" },
  fieldCanvas: { height: 184, borderRadius: 10, overflow: "hidden", position: "relative", backgroundColor: "#DCEEDB" },
  fieldGrass: { position: "absolute", left: 22, right: 22, top: 20, bottom: 20, borderRadius: 150, backgroundColor: "#A9D49E", borderWidth: 1, borderColor: "#8BC17E" },
  fieldDiamond: { position: "absolute", width: 90, height: 90, left: "50%", top: 48, marginLeft: -45, transform: [{ rotate: "45deg" }], backgroundColor: "#CFAE7C", borderWidth: 1, borderColor: "#B68C58" },
  fieldNode: { position: "absolute", width: 58, minHeight: 36, borderRadius: 10, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  fieldNodeNumber: { color: BRAND.navy, fontSize: 12, fontWeight: "900" },
  fieldNodeLabel: { color: BRAND.muted, fontSize: 8, marginTop: 1, maxWidth: 52, textAlign: "center" },
  fieldCenter: { top: 29, left: "50%", marginLeft: -29 },
  fieldLeft: { top: 56, left: 22 },
  fieldRight: { top: 56, right: 22 },
  // 內野實際視角：游擊在三壘與二壘之間的左側，二壘手在右側；三壘與一壘位於下方兩側。
  fieldShort: { top: 105, left: "24%" },
  fieldSecond: { top: 105, right: "24%" },
  fieldThird: { top: 158, left: "14%" },
  fieldFirst: { top: 158, right: "14%" },
  fieldCatcher: { bottom: 29, left: "50%", marginLeft: -29 },
  fieldPitcher: { top: 117, left: "50%", marginLeft: -29, backgroundColor: "#FFF8E6" },
  pageIntro: { color: BRAND.muted, fontSize: 10, lineHeight: 13 },
  rosterCard: { backgroundColor: BRAND.white, borderRadius: 11, borderWidth: 1, borderColor: BRAND.line, padding: 8 },
  rosterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: BRAND.line, marginBottom: 2 },
  rosterTitle: { color: BRAND.ink, fontSize: 14, fontWeight: "900" },
  rosterMeta: { color: BRAND.muted, fontSize: 11, marginTop: 3 },
  rosterBadge: { backgroundColor: "#EAF8F1", color: BRAND.green, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, fontSize: 10, fontWeight: "800" },
  rosterOptionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  rosterOption: { width: "15.2%", minHeight: 50, borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 5, backgroundColor: BRAND.paper, justifyContent: "space-between" },
  rosterOptionActive: { borderColor: BRAND.blue, backgroundColor: BRAND.sky },
  rosterOptionNumber: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  rosterOptionName: { color: BRAND.ink, fontSize: 10, fontWeight: "800", marginTop: 2 },
  rosterOptionMeta: { color: BRAND.muted, fontSize: 9, marginTop: 1 },
  rosterOptionTextActive: { color: BRAND.blue },
  rosterSelectedEditor: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: BRAND.line, marginTop: 7, paddingTop: 7 },
  playerEditRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4, gap: 5, borderBottomWidth: 1, borderBottomColor: "#F0F3F6" },
  orderControls: { width: 35, alignItems: "center", gap: 1 },
  orderNumber: { color: BRAND.blue, fontSize: 10, fontWeight: "900" },
  orderButton: { width: 18, height: 15, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.paper, borderRadius: 4 },
  orderButtonText: { color: BRAND.navy, fontSize: 10, fontWeight: "900", lineHeight: 12 },
  numberBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor: BRAND.sky, alignItems: "center", justifyContent: "center" },
  numberBadgeText: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  playerNameInput: { flex: 1, minWidth: 118, color: BRAND.ink, fontSize: 12, borderBottomWidth: 1, borderBottomColor: BRAND.line, paddingVertical: 5 },
  playerPreferredPositionsReadout: { flexBasis: 216, flexGrow: 1, minHeight: 42, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: BRAND.line, paddingHorizontal: 5, paddingVertical: 4 },
  playerPreferredPositionsText: { color: BRAND.muted, fontSize: 10, fontWeight: "800", lineHeight: 14 },
  batsBadge: { color: BRAND.blue, fontSize: 11, fontWeight: "900", width: 18, textAlign: "center" },
  battingOrderCard: { backgroundColor: BRAND.white, borderRadius: 11, borderWidth: 1, borderColor: BRAND.line, padding: 8 },
  battingOrderGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  battingOrderSlot: { width: "15.2%", minHeight: 44, backgroundColor: BRAND.paper, borderRadius: 8, borderWidth: 1, borderColor: BRAND.line, paddingHorizontal: 5, paddingVertical: 4, justifyContent: "center" },
  battingOrderSlotActive: { backgroundColor: BRAND.sky, borderColor: BRAND.blue },
  battingOrderSlotLabel: { color: BRAND.muted, fontSize: 9, fontWeight: "900" },
  battingOrderSlotValue: { color: BRAND.ink, fontSize: 10, fontWeight: "800", marginTop: 2 },
  battingOrderSlotTextActive: { color: BRAND.blue },
  battingOrderInstruction: { color: BRAND.muted, fontSize: 10, marginTop: 6 },
  battingNumberOptions: { gap: 5, paddingTop: 6, paddingBottom: 1 },
  battingNumberOption: { minWidth: 112, maxWidth: 144, height: 34, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.paper, borderWidth: 1, borderColor: BRAND.line, paddingHorizontal: 8 },
  battingNumberOptionActive: { backgroundColor: BRAND.sky, borderColor: BRAND.blue },
  battingNumberOptionText: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  battingNumberOptionTextActive: { color: BRAND.blue },
  battingOrderClear: { height: 32, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF0EF", paddingHorizontal: 9 },
  battingOrderClearText: { color: BRAND.red, fontSize: 10, fontWeight: "900" },
  positionGuide: { backgroundColor: BRAND.sky, padding: 8, borderRadius: 10 },
  positionGuideTitle: { color: BRAND.navy, fontSize: 12, fontWeight: "900" },
  positionGuideText: { color: BRAND.muted, fontSize: 10, lineHeight: 17, marginTop: 5 },
  summaryStrip: { flexDirection: "row", gap: 4 },
  statChip: { flex: 1, minHeight: 36, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 7, paddingVertical: 3, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 13, fontWeight: "900" },
  statLabel: { color: BRAND.muted, fontSize: 9, marginTop: 3 },
  statsTabs: { flexDirection: "row", backgroundColor: "#E9F0F6", borderRadius: 8, padding: 2 },
  statsTab: { flex: 1, paddingVertical: 6, alignItems: "center", borderRadius: 6 },
  statsTabActive: { backgroundColor: BRAND.white },
  statsTabText: { color: BRAND.muted, fontSize: 11, fontWeight: "700" },
  statsTabTextActive: { color: BRAND.navy, fontWeight: "900" },
  statsSection: { gap: 4 },
  tableCard: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 9, padding: 5 },
  seasonCard: { backgroundColor: "#F1F7FC", borderWidth: 1, borderColor: "#C8DDED", borderRadius: 9, padding: 5, gap: 4 },
  seasonTitle: { color: BRAND.navy, fontSize: 15, fontWeight: "900" },
  seasonHint: { color: BRAND.muted, fontSize: 10, marginTop: -5 },
  tableTitle: { color: BRAND.ink, fontSize: 12, fontWeight: "900", marginBottom: 5 },
  statGlossary: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: -2, marginBottom: 5 },
  statGlossaryItem: { width: "48%", minWidth: 148, backgroundColor: "#F7FAFD", borderWidth: 1, borderColor: "#E1EBF3", borderRadius: 7, paddingHorizontal: 6, paddingVertical: 4 },
  statGlossaryTerm: { color: BRAND.blue, fontSize: 10, fontWeight: "900" },
  statGlossaryDescription: { color: BRAND.muted, fontSize: 9, lineHeight: 13, marginTop: 2 },
  tableRow: { flexDirection: "row", minHeight: 25, alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#EDF2F7" },
  tableCell: { width: 34, color: BRAND.muted, fontSize: 9, textAlign: "center" },
  playerCell: { width: 108, textAlign: "left" },
  tablePlayer: { color: BRAND.ink, fontWeight: "800" },
  playerNameButton: { width: 108, justifyContent: "center" },
  pitcherNameButton: { flexShrink: 1, minWidth: 112 },
  playerNameButtonText: { color: BRAND.blue, textDecorationLine: "underline" },
  opsCell: { color: BRAND.blue, fontWeight: "900" },
  pitcherLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#EDF2F7", paddingVertical: 6 },
  pitcherStats: { flexDirection: "row", gap: 8 },
  pitcherStatText: { color: BRAND.navy, fontSize: 11, fontWeight: "800" },
  previewStack: { gap: 6 },
  exportRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  previewCard: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, padding: 7 },
  previewTitle: { color: BRAND.ink, fontSize: 15, fontWeight: "900" },
  previewMeta: { color: BRAND.muted, fontSize: 11, marginTop: 3, marginBottom: 4 },
  rangeRow: { flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#EDF2F7" },
  rangeLabel: { width: 55, color: BRAND.blue, fontSize: 11, fontWeight: "900" },
  rangeValue: { flex: 1, color: BRAND.ink, fontSize: 11 },
  symbolRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#EDF2F7" },
  symbolInning: { width: 36, color: BRAND.muted, fontSize: 10, fontWeight: "800" },
  symbolText: { flex: 1, color: BRAND.navy, fontSize: 18, fontWeight: "900" },
  symbolResult: { color: BRAND.muted, fontSize: 10, fontWeight: "800" },
  syncConflictBanner: { marginHorizontal: 8, marginTop: 6, backgroundColor: "#FFF1F1", borderWidth: 1, borderColor: "#F1C4C7", borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6 },
  syncConflictTitle: { color: BRAND.red, fontSize: 12, fontWeight: "900" },
  syncConflictText: { color: BRAND.muted, fontSize: 10, marginTop: 3 },
  syncQueuedBanner: { marginHorizontal: 8, marginTop: 6, backgroundColor: "#FFF8E6", borderWidth: 1, borderColor: "#F0D58A", borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6 },
  syncQueuedText: { color: BRAND.navy, fontSize: 10, fontWeight: "800" },
  bottomNav: { flexDirection: "row", backgroundColor: BRAND.white, borderTopWidth: 1, borderTopColor: BRAND.line, paddingTop: 7, paddingBottom: Platform.OS === "web" ? 8 : 11 },
  navButton: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, minHeight: 48 },
  navButtonEmphasis: { marginTop: -12 },
  navIcon: { color: BRAND.muted, fontSize: 18, fontWeight: "700" },
  navLabel: { color: BRAND.muted, fontSize: 9, fontWeight: "700" },
  navActiveText: { color: BRAND.blue },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(8,25,45,0.45)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: BRAND.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28, maxHeight: "92%" },
  settingsModalSheet: { maxHeight: "94%", paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  settingsLandscape: { gap: 10, paddingBottom: 4 },
  settingsSection: { width: 246, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 15, padding: 12 },
  settingsAccountSection: { width: 294 },
  localBackupActions: { flexDirection: "row", gap: 6, marginTop: 7 },
  settingsThemeSection: { width: 320 },
  settingsResetSection: { width: 272, borderColor: "#F0C6C9", backgroundColor: "#FFF8F8" },
  settingsSectionTitle: { color: BRAND.navy, fontSize: 13, fontWeight: "900", marginBottom: 5 },
  settingsAccountName: { color: BRAND.ink, fontSize: 14, fontWeight: "800", marginBottom: 4 },
  accountIdentityRow: { flexDirection: "row", alignItems: "center", marginBottom: 9 },
  accountIdentityAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginRight: 8 },
  accountIdentityAvatarText: { color: BRAND.white, fontSize: 14, fontWeight: "900" },
  accountIdentityCopy: { flex: 1 },
  cloudSyncStatusCard: { borderWidth: 1, borderRadius: 10, backgroundColor: "#F8FBFE", paddingHorizontal: 8, paddingVertical: 7, marginBottom: 8 },
  cloudSyncStatusLabel: { fontSize: 10, fontWeight: "900", marginBottom: 2 },
  cloudSyncStatusHint: { color: BRAND.muted, fontSize: 9, lineHeight: 13 },
  cloudSyncProgressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  cloudSyncProgressTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: "#E4ECF4", overflow: "hidden" },
  cloudSyncProgressFill: { height: "100%", borderRadius: 3 },
  cloudSyncProgressValue: { width: 31, textAlign: "right", fontSize: 9, fontWeight: "900" },
  cloudSyncTime: { color: BRAND.muted, fontSize: 8, marginTop: 5 },
  settingsHint: { color: BRAND.muted, fontSize: 10, lineHeight: 15, marginBottom: 10 },
  settingsVersion: { color: BRAND.muted, fontSize: 9, marginTop: 9 },
  settingsBuildMeta: { color: BRAND.ink, fontSize: 10, fontWeight: "700", marginTop: 3 },
  settingsApkBuildSection: { width: 310 },
  apkBuildStatusCard: { borderWidth: 1, borderColor: "#C7D9EA", borderRadius: 10, backgroundColor: "#F7FBFF", padding: 9, marginBottom: 8 },
  apkBuildStatusCardChecking: { borderColor: "#91C4ED", backgroundColor: "#EDF7FF" },
  apkBuildStatusCardReady: { borderColor: "#9ACCB3", backgroundColor: "#F2FBF6" },
  apkBuildStatusHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  apkBuildStageMark: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.blue },
  apkBuildStageMarkReady: { backgroundColor: "#238A54" },
  apkBuildStageMarkText: { color: BRAND.white, fontSize: 10, fontWeight: "900" },
  apkBuildStatusCopy: { flex: 1, minWidth: 0 },
  apkBuildStatusTitle: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  apkBuildStatusHint: { color: BRAND.muted, fontSize: 9, lineHeight: 13, marginTop: 2 },
  apkBuildSteps: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4, marginTop: 8 },
  apkBuildStep: { color: BRAND.muted, fontSize: 9, fontWeight: "800", backgroundColor: "#EAF0F5", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 3 },
  apkBuildStepActive: { color: BRAND.blue, backgroundColor: "#DDEEFE" },
  apkBuildStepReady: { color: "#237448", backgroundColor: "#DDF4E6" },
  apkBuildStepArrow: { color: BRAND.muted, fontSize: 10, fontWeight: "800" },
  apkBuildGuideAction: { minHeight: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.blue, paddingHorizontal: 9 },
  apkBuildGuideActionDisabled: { backgroundColor: "#91C4ED" },
  apkBuildGuideActionText: { color: BRAND.white, fontSize: 10, fontWeight: "900" },
  apkBuildGuideNote: { color: BRAND.muted, fontSize: 8, lineHeight: 12, marginTop: 6 },
  settingsButtonGap: { height: 7 },
  interfacePaletteGrid: { gap: 5, marginBottom: 9 },
  interfacePaletteOption: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: BRAND.line, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 5 },
  interfacePaletteOptionActive: { borderColor: BRAND.blue, backgroundColor: "#EDF5FE" },
  interfacePalettePreview: { width: 48, height: 33, borderRadius: 6, borderWidth: 1, marginRight: 8, overflow: "hidden" },
  interfacePalettePreviewTop: { height: 8, paddingHorizontal: 6, justifyContent: "center" },
  interfacePalettePreviewTitle: { width: 15, height: 2, borderRadius: 2, opacity: 0.9 },
  interfacePalettePreviewCard: { flex: 1, marginHorizontal: 4, marginTop: 3, marginBottom: 3, borderWidth: 1, borderRadius: 3, paddingHorizontal: 4, paddingTop: 3 },
  interfacePalettePreviewLine: { width: "78%", height: 2, borderRadius: 2, opacity: 0.82 },
  interfacePalettePreviewLineShort: { width: "50%", height: 2, borderRadius: 2, marginTop: 3, opacity: 0.7 },
  interfacePalettePreviewStatusRow: { flexDirection: "row", gap: 2, marginTop: 3 },
  interfacePalettePreviewStatus: { width: 5, height: 3, borderRadius: 2 },
  interfacePaletteDot: { width: 42, height: 25, borderRadius: 6, marginRight: 8, borderWidth: 1, borderTopWidth: 6, borderTopColor: "rgba(255,255,255,0.7)", borderColor: "rgba(0,0,0,0.12)", shadowColor: "#0F172A", shadowOpacity: 0.12, shadowRadius: 2, elevation: 1 },
  interfacePaletteCopy: { flex: 1 },
  interfacePaletteLabel: { color: BRAND.ink, fontSize: 10, fontWeight: "800" },
  interfacePaletteLabelActive: { color: BRAND.blue },
  interfacePaletteHint: { color: BRAND.muted, fontSize: 8, marginTop: 1 },
  customThemeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  customThemeInput: { flex: 1, minHeight: 33, borderRadius: 8, borderWidth: 1, borderColor: BRAND.line, backgroundColor: BRAND.paper, paddingHorizontal: 8, color: BRAND.ink, fontSize: 11, fontWeight: "700" },
  resetWarning: { color: BRAND.red, fontSize: 10, fontWeight: "700", lineHeight: 15, marginBottom: 9 },
  safeResetButton: { marginTop: 8, minHeight: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.red },
  safeResetButtonDisabled: { backgroundColor: "#E8B7BA" },
  safeResetButtonText: { color: BRAND.white, fontSize: 10, fontWeight: "900" },
  resetCancelText: { color: BRAND.muted, fontSize: 10, fontWeight: "800", textAlign: "center", marginTop: 10 },
  modalHandle: { width: 44, height: 4, borderRadius: 3, backgroundColor: "#C7D4E0", alignSelf: "center", marginBottom: 13 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 13 },
  modalTitle: { color: BRAND.ink, fontSize: 20, fontWeight: "900" },
  modalClose: { color: BRAND.blue, fontSize: 12, fontWeight: "800" },
  modalSubtitle: { color: BRAND.muted, fontSize: 10, marginTop: 3, lineHeight: 15 },
  playerStatsSheet: { maxHeight: "92%", paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 },
  playerStatsSubtitle: { color: BRAND.muted, fontSize: 10, marginTop: 2 },
  playerStatsLandscape: { flexDirection: "row", gap: 9, paddingBottom: 2 },
  playerStatsControlPanel: { width: 160, backgroundColor: "#F7FAFC", borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 9 },
  playerStatsAnalysisColumn: { width: 255, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 9 },
  playerStatsSectionTitle: { color: BRAND.navy, fontSize: 12, fontWeight: "900", marginBottom: 5 },
  playerStatsControlHint: { color: BRAND.muted, fontSize: 9, lineHeight: 13, marginBottom: 9 },
  playerStatsControlLabel: { color: BRAND.ink, fontSize: 10, fontWeight: "800", marginTop: 5, marginBottom: 4 },
  handChoiceRow: { flexDirection: "row", gap: 6 },
  handChoice: { flex: 1, minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: BRAND.line, backgroundColor: BRAND.white },
  handChoiceActive: { backgroundColor: BRAND.blue, borderColor: BRAND.blue },
  handChoiceText: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  handChoiceTextActive: { color: BRAND.white },
  playerStatsRateRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 7 },
  playerStatsRate: { color: BRAND.navy, fontSize: 9, fontWeight: "800", backgroundColor: "#EEF5FA", paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5 },
  wizardModalSheet: { height: "96%", width: "100%", alignSelf: "stretch", flexShrink: 1, minHeight: 0, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12 },
  wizardKeyboardAvoiding: { flex: 1, minHeight: 0, flexShrink: 1 },
  wizardProgressTrack: { height: 5, backgroundColor: "#DCE6EF", borderRadius: 99, overflow: "hidden", marginBottom: 7 },
  wizardProgressValue: { height: "100%", borderRadius: 99, backgroundColor: BRAND.blue },
  wizardScrollContent: { flexGrow: 1, paddingBottom: 18 },
  wizardScrollContentWithPitchLimit: { paddingBottom: 40 },
  wizardStepTitle: { color: BRAND.navy, fontSize: 15, fontWeight: "900" },
  wizardStepHint: { color: BRAND.muted, fontSize: 10, lineHeight: 14, marginTop: 2, marginBottom: 8 },
  wizardStepPanel: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 10 },
  wizardNavigation: { flexShrink: 0, flexDirection: "row", gap: 7, borderTopWidth: 1, borderTopColor: BRAND.line, paddingTop: 8, paddingBottom: 2 },
  wizardMinorLabel: { color: BRAND.muted, fontSize: 10, fontWeight: "800", marginTop: 2, marginBottom: 4 },
  wizardCreateTeamRow: { flexDirection: "row", gap: 7, alignItems: "flex-start" },
  wizardPitchLimitPanel: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: BRAND.line },
  wizardPitchLimitHint: { color: BRAND.muted, fontSize: 11, marginBottom: 8 },
  wizardPitchLimitRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  wizardPitchLimitRowCompact: { gap: 7 },
  wizardPitchLimitField: { flexGrow: 1, flexBasis: 118, minWidth: 106, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: BRAND.paper, borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  wizardPitchLimitFieldCompact: { flexBasis: "46%" },
  wizardPitchLimitFieldFocused: { borderColor: BRAND.blue, backgroundColor: "#F1F8FF", shadowColor: BRAND.blue, shadowOpacity: 0.17, shadowRadius: 4, elevation: 2 },
  wizardPitchLimitLabel: { color: BRAND.ink, fontSize: 12, fontWeight: "800" },
  wizardPitchLimitInput: { flex: 1, minWidth: 32, color: BRAND.ink, fontSize: 15, fontWeight: "800", textAlign: "center", paddingVertical: 3 },
  wizardPitchLimitInputCompact: { minHeight: 28, fontSize: 16 },
  wizardPitchLimitUnit: { color: BRAND.muted, fontSize: 11 },
  wizardCreateTeamInput: { flex: 1, minWidth: 0, marginBottom: 0, paddingVertical: 9 },
  wizardOrderRow: { flexDirection: "row", gap: 5, marginTop: 2, marginBottom: 8 },
  wizardOrderDragTarget: { flex: 1, minWidth: 0 },
  lineupDraggingCard: { opacity: 0.64, transform: [{ scale: 0.97 }], borderColor: BRAND.yellow, borderWidth: 1, borderRadius: 8 },
  wizardOrderChip: { flex: 1, minWidth: 0, minHeight: 50, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, paddingHorizontal: 3, paddingVertical: 3 },
  wizardOrderChipActive: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  wizardOrderLabel: { color: BRAND.muted, fontSize: 9, fontWeight: "900" },
  wizardOrderValue: { color: BRAND.blue, fontSize: 8, fontWeight: "900", marginTop: 1, textAlign: "center", width: "100%" },
  wizardOrderPosition: { color: BRAND.muted, fontSize: 7, fontWeight: "800", textAlign: "center", width: "100%" },
  wizardOrderTextActive: { color: BRAND.white },
  wizardConfirmationPanel: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 12, padding: 9, gap: 8 },
  wizardConfirmationTitle: { color: BRAND.navy, fontSize: 13, fontWeight: "900" },
  wizardConfirmationHint: { color: BRAND.muted, fontSize: 10, lineHeight: 14 },
  wizardConfirmationTeams: { flexDirection: "row", alignItems: "stretch", gap: 7 },
  wizardConfirmationTeam: { flex: 1, minWidth: 0, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, padding: 6, gap: 4 },
  wizardConfirmationTeamTitle: { color: BRAND.blue, fontSize: 12, fontWeight: "900" },
  wizardConfirmationColumns: { flexDirection: "row", gap: 4, alignItems: "stretch" },
  wizardConfirmationRoster: { flex: 1, minWidth: 0, gap: 1 },
  wizardConfirmationPlayer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 3, minHeight: 17, borderBottomWidth: 1, borderBottomColor: "#EAF0F6" },
  wizardConfirmationPlayerText: { flex: 1, color: BRAND.ink, fontSize: 7, fontWeight: "800" },
  wizardConfirmationPosition: { color: BRAND.blue, fontSize: 7, fontWeight: "900" },
  wizardConfirmationPlayerConflict: { backgroundColor: "#FFF0F1", borderBottomColor: "#F0A4AA", borderRadius: 4, paddingHorizontal: 4 },
  wizardConfirmationPlayerTextConflict: { color: BRAND.red },
  wizardConfirmationPositionConflict: { color: BRAND.red },
  wizardConfirmationField: { width: 118, minWidth: 118, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  exportPresetRow: { flexDirection: "row", gap: 8, marginBottom: 7 },
  exportInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  exportNumberInput: { flex: 1, textAlign: "center", marginBottom: 12 },
  exportRangeDash: { color: BRAND.muted, fontSize: 12, fontWeight: "800" },
  exportRangeUnit: { color: BRAND.muted, fontSize: 11, fontWeight: "800", marginRight: 3 },
  exportRangeHint: { color: BRAND.muted, fontSize: 10, lineHeight: 15, marginBottom: 13 },
  exportVerifiedCsvHint: { color: BRAND.green, fontSize: 10, fontWeight: "800", lineHeight: 15, marginBottom: 9 },
  exportVerifiedCsvUnavailable: { color: BRAND.muted, fontSize: 10, lineHeight: 15, marginBottom: 9 },
  exportChoiceButtons: { flexDirection: "row", gap: 8, marginTop: 4 },
  detailModalSheet: { backgroundColor: BRAND.paper, borderRadius: 22, padding: 18, width: "92%", maxWidth: 480, alignSelf: "center" },
  detailPlayer: { color: BRAND.ink, fontSize: 17, fontWeight: "900", marginTop: 4 },
  detailNotation: { color: BRAND.navy, fontSize: 27, fontWeight: "900", lineHeight: 34, marginTop: 10 },
  detailResult: { color: BRAND.blue, fontSize: 12, fontWeight: "800", marginTop: 5, lineHeight: 18 },
  detailLineList: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 11, marginVertical: 16, gap: 6 },
  detailLine: { color: BRAND.muted, fontSize: 11, lineHeight: 17 },
  symbolHelpBackdrop: { flex: 1, backgroundColor: "rgba(8,25,45,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  symbolHelpSheet: { width: "100%", maxWidth: 520, backgroundColor: BRAND.paper, borderRadius: 20, borderWidth: 1, borderColor: BRAND.line, padding: 18 },
  symbolHelpHero: { flexDirection: "row", alignItems: "center", gap: 13, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 15, padding: 12 },
  symbolHelpMark: { width: 62, height: 62, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  symbolHelpMarkRed: { backgroundColor: "#FFF0F1" },
  symbolHelpMarkBlue: { backgroundColor: "#EAF3FB" },
  symbolHelpMarkNavy: { backgroundColor: "#E8EDF4" },
  symbolHelpMarkText: { color: BRAND.navy, fontSize: 26, fontWeight: "900" },
  symbolHelpTitleCopy: { flex: 1 },
  symbolHelpName: { color: BRAND.ink, fontSize: 18, fontWeight: "900" },
  symbolHelpArea: { color: BRAND.blue, fontSize: 11, fontWeight: "800", marginTop: 4 },
  symbolHelpContent: { backgroundColor: "#F8FAFC", borderRadius: 14, padding: 12, gap: 5, marginVertical: 13 },
  symbolHelpLabel: { color: BRAND.blue, fontSize: 10, fontWeight: "900", marginTop: 3 },
  symbolHelpBody: { color: BRAND.ink, fontSize: 12, lineHeight: 18 },
  symbolHelpExample: { color: BRAND.navy, fontSize: 13, fontWeight: "900", lineHeight: 19 },
  headerSymbolReferenceButton: { minHeight: 34, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: BRAND.blue, backgroundColor: "#EAF3FB", paddingHorizontal: 9 },
  headerSymbolReferenceText: { color: BRAND.blue, fontSize: 10, fontWeight: "900" },
  symbolReferenceBackdrop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 10 },
  symbolReferenceSheet: { width: "98%", maxWidth: 1320, height: "94%", minHeight: 0, alignSelf: "center", borderRadius: 18, borderWidth: 1, padding: 12, gap: 8 },
  symbolReferenceEyebrow: { fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 1.1 },
  symbolReferenceCountBadge: { minWidth: 70, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, alignItems: "center" },
  symbolReferenceCountText: { fontSize: 10, lineHeight: 13, fontWeight: "900" },
  symbolReferenceHero: { minHeight: 54, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 9 },
  symbolReferenceHeroMark: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  symbolReferenceHeroMarkText: { fontSize: 20, lineHeight: 23, fontWeight: "900" },
  symbolReferenceHeroTitle: { color: "#FFFFFF", fontSize: 12, lineHeight: 16, fontWeight: "900" },
  symbolReferenceHeroText: { color: "rgba(255,255,255,0.86)", fontSize: 8.5, lineHeight: 12, marginTop: 1 },
  symbolReferenceSearch: { height: 34, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, fontSize: 10, lineHeight: 14 },
  symbolReferenceFilterRow: { gap: 6, paddingRight: 8 },
  symbolReferenceFilterPill: { minHeight: 29, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, alignItems: "center", justifyContent: "center" },
  symbolReferenceFilterText: { fontSize: 9, lineHeight: 12, fontWeight: "900" },
  symbolReferenceControls: { minHeight: 28, borderTopWidth: 1, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 3 },
  symbolReferenceGestureHint: { flex: 1, minWidth: 0, fontSize: 8.5, fontWeight: "800" },
  symbolReferenceControlButtons: { flexDirection: "row", alignItems: "center", gap: 5 },
  symbolReferenceControlButton: { width: 28, height: 26, borderWidth: 1, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  symbolReferenceControlText: { fontSize: 18, lineHeight: 21, fontWeight: "900" },
  symbolReferenceResetButton: { minHeight: 26, borderWidth: 1, borderRadius: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  symbolReferenceResetText: { fontSize: 9, fontWeight: "900" },
  symbolReferenceViewport: { flex: 1, minHeight: 126, borderWidth: 1, borderRadius: 12 },
  symbolReferenceViewportContent: { padding: 7 },
  symbolReferenceGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: 7 },
  symbolReferenceCard: { width: "49.5%", minHeight: 78, flexDirection: "row", alignItems: "flex-start", gap: 7, borderWidth: 1, borderRadius: 10, padding: 7 },
  symbolReferenceMarkBox: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  symbolReferenceMark: { maxWidth: 52, fontSize: 12, lineHeight: 15, fontWeight: "900", textAlign: "center" },
  symbolReferenceCopy: { flex: 1, minWidth: 0, gap: 1 },
  symbolReferenceTitleRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  symbolReferenceTitle: { flexShrink: 1, fontSize: 10, lineHeight: 13, fontWeight: "900" },
  symbolReferenceCategoryTag: { flexShrink: 0, fontSize: 7.5, lineHeight: 10, fontWeight: "800" },
  symbolReferenceDescription: { fontSize: 8, lineHeight: 10.5 },
  symbolReferencePlacement: { fontSize: 7.5, lineHeight: 10, fontWeight: "700" },
  symbolReferenceExample: { fontSize: 8, lineHeight: 10, fontWeight: "900" },
  symbolReferenceEmpty: { minHeight: 92, borderWidth: 1, borderRadius: 10, justifyContent: "center", padding: 12 },
  symbolReferenceEmptyText: { fontSize: 10, lineHeight: 14, textAlign: "center" },
  symbolReferenceFootnote: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  symbolReferenceFootnoteText: { fontSize: 8, lineHeight: 11, textAlign: "center" },
  learningCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F1F7FC", borderWidth: 1, borderColor: "#C8DDED", borderRadius: 15, padding: 12, marginTop: 10 },
  learningCopy: { flex: 1, minWidth: 0 },
  learningEyebrow: { color: BRAND.blue, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  learningTitle: { color: BRAND.navy, fontSize: 14, fontWeight: "900", marginTop: 2 },
  learningText: { color: BRAND.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  learningActions: { width: 186, gap: 7 },
  tutorialBackdrop: { flex: 1, backgroundColor: "rgba(8,25,45,0.52)", alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  tutorialSheet: { width: "100%", maxWidth: 640, backgroundColor: BRAND.paper, borderRadius: 20, borderWidth: 1, borderColor: BRAND.line, padding: 18 },
  tutorialHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  tutorialEyebrow: { color: BRAND.blue, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  tutorialHeaderTitle: { color: BRAND.ink, fontSize: 20, fontWeight: "900", marginTop: 3 },
  tutorialSkip: { color: BRAND.muted, fontSize: 11, fontWeight: "900", paddingTop: 3 },
  tutorialProgress: { flexDirection: "row", gap: 6, marginTop: 14 },
  tutorialProgressDot: { flex: 1, height: 4, borderRadius: 99, backgroundColor: BRAND.line },
  tutorialProgressDotActive: { backgroundColor: BRAND.blue },
  tutorialBody: { flexDirection: "row", alignItems: "center", gap: 15, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 15, padding: 14, marginTop: 14 },
  tutorialMark: { width: 64, height: 64, borderRadius: 18, backgroundColor: BRAND.sky, alignItems: "center", justifyContent: "center" },
  tutorialMarkText: { color: BRAND.blue, fontSize: 27, fontWeight: "900" },
  tutorialCopy: { flex: 1, minWidth: 0 },
  tutorialStep: { color: BRAND.blue, fontSize: 10, fontWeight: "900" },
  tutorialTitle: { color: BRAND.ink, fontSize: 17, fontWeight: "900", marginTop: 2 },
  tutorialText: { color: BRAND.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  tutorialNote: { alignSelf: "flex-start", backgroundColor: "#FFF8E6", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginTop: 8 },
  tutorialNoteText: { color: BRAND.navy, fontSize: 10, fontWeight: "800" },
  tutorialActions: { flexDirection: "row", gap: 9, marginTop: 15 },
  tutorialActionFlex: { flex: 1 },
  tutorialFinishLink: { alignSelf: "center", paddingTop: 11, paddingHorizontal: 10 },
  tutorialFinishText: { color: BRAND.blue, fontSize: 11, fontWeight: "900" },
  formInput: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, color: BRAND.ink, fontSize: 13, marginBottom: 12 },
  notesInput: { height: 105 },
  modalChoiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  modalDateTimeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modalDateTimeCol: { flex: 1, minWidth: 0 },
  modalChipRow: { flexDirection: "row", gap: 8, paddingBottom: 12 },
  modalPlayerChip: { minWidth: 58, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 8, alignItems: "center" },
  modalPlayerChipDisabled: { opacity: 0.42, backgroundColor: "#E5E7EB" },
  modalPlayerChipNumber: { color: BRAND.navy, fontSize: 13, fontWeight: "900" },
  modalPlayerChipName: { color: BRAND.muted, fontSize: 9, marginTop: 2, maxWidth: 54 },
  modalChoice: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 10 },
  inningsChoice: { flex: 1, minWidth: 60, alignItems: "center" },
  modalChoiceActive: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  modalChoiceText: { color: BRAND.muted, fontSize: 11, fontWeight: "800" },
  modalChoiceTextActive: { color: BRAND.white },
  weatherChoiceRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  weatherChoice: { flex: 1, minWidth: 74, minHeight: 64, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingVertical: 7 },
  weatherChoiceActive: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  weatherIcon: { fontSize: 23, marginBottom: 2 },
  weatherChoiceText: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  registrationPanel: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 10, gap: 7, marginBottom: 12 },
  registrationHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  wizardDefenseHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 120 },
  wizardDefenseWorkspace: { gap: 6 },
  wizardDefenseActionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 36, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  wizardDefenseActionCopy: { flex: 1, minWidth: 0 },
  wizardDefenseActionTitle: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  wizardDefenseActionHint: { color: BRAND.muted, fontSize: 8, lineHeight: 11, marginTop: 1 },
  wizardDefenseSwapControls: { flexDirection: "row", alignItems: "center", gap: 4 },
  wizardDefenseSwapAction: { minHeight: 29, backgroundColor: BRAND.blue, borderRadius: 7, justifyContent: "center", paddingHorizontal: 9 },
  wizardDefensePartialSwapAction: { backgroundColor: BRAND.navy },
  wizardDefenseSelectionAction: { backgroundColor: "#EAF3FB", borderWidth: 1, borderColor: "#8CB9DF" },
  wizardDefenseClearAction: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: "#8CB9DF" },
  wizardDefenseSelectionActionText: { color: BRAND.navy, fontSize: 9, fontWeight: "900" },
  wizardDefenseClearActionText: { color: BRAND.blue, fontSize: 9, fontWeight: "900" },
  wizardDefenseRestoreAction: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.blue },
  wizardDefenseSwapActionDisabled: { backgroundColor: "#DCE5EE", borderColor: "#DCE5EE", opacity: 0.7 },
  wizardDefenseSwapActionText: { color: BRAND.white, fontSize: 9, fontWeight: "900" },
  wizardDefenseRestoreActionText: { color: BRAND.blue },
  wizardDefensePositionChoices: { flexDirection: "row", gap: 4, paddingRight: 4 },
  wizardDefensePositionChoice: { minWidth: 32, minHeight: 25, paddingHorizontal: 5, borderWidth: 1, borderColor: "#BBD4EC", borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.white },
  wizardDefensePositionChoiceActive: { backgroundColor: "#FFF1C7", borderColor: BRAND.yellow },
  wizardDefensePositionChoiceChanged: { backgroundColor: "#FFF4B8", borderColor: "#D89B11", borderWidth: 2 },
  wizardDefensePositionChoiceText: { color: BRAND.navy, fontSize: 8, fontWeight: "900" },
  wizardDefensePositionChoiceTextActive: { color: "#895D0A" },
  wizardDefensePositionChoiceTextChanged: { color: "#75520A" },
  wizardParallelDefense: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  wizardDefensePanel: { flex: 1, minWidth: 0, marginBottom: 0, padding: 7, gap: 5 },
  wizardDefenseAwayPanel: { backgroundColor: "#EFF8FF", borderColor: "#B9DCF5" },
  wizardDefenseHomePanel: { backgroundColor: "#FFF7ED", borderColor: "#F7D7A7" },
  wizardDefenseCopy: { flex: 1, minWidth: 0 },
  registrationTitle: { color: BRAND.navy, fontSize: 12, fontWeight: "900" },
  registrationCount: { color: BRAND.blue, fontSize: 12, fontWeight: "900" },
  registrationHint: { color: BRAND.muted, fontSize: 10 },
  lineupQuickRow: { flexDirection: "row", gap: 6 },
  lineupQuickAction: { flex: 1, minHeight: 32, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.blue, borderRadius: 8, paddingHorizontal: 7 },
  lineupQuickActionSecondary: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.blue },
  lineupQuickActionText: { color: BRAND.white, fontSize: 10, fontWeight: "900" },
  lineupQuickActionSecondaryText: { color: BRAND.blue },
  lineupReadiness: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  lineupReadinessComplete: { backgroundColor: "#EAF8F1", borderWidth: 1, borderColor: "#BFE8D1" },
  lineupReadinessPending: { backgroundColor: "#FFF8E6", borderWidth: 1, borderColor: "#F0D58A" },
  lineupReadinessTitle: { fontSize: 10, fontWeight: "900" },
  lineupReadinessTextComplete: { color: BRAND.green },
  lineupReadinessTextPending: { color: "#9B6518" },
  lineupReadinessHint: { color: BRAND.muted, fontSize: 9, lineHeight: 12, marginTop: 2 },
  newGameLineupFlow: { backgroundColor: "#EAF3FF", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  newGameLineupFlowTitle: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  newGameLineupFlowText: { color: BRAND.muted, fontSize: 8, lineHeight: 11, marginTop: 2 },
  lineupPreviewRow: { gap: 5, paddingRight: 4 },
  lineupPreviewChip: { width: 46, minHeight: 42, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 3, paddingVertical: 3 },
  lineupPreviewOrder: { color: BRAND.muted, fontSize: 8, fontWeight: "900" },
  lineupPreviewPlayer: { color: BRAND.navy, fontSize: 10, fontWeight: "900", marginTop: 1 },
  lineupPreviewPosition: { color: BRAND.blue, fontSize: 8, fontWeight: "800", marginTop: 1 },
  lineupFieldWorkspace: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  lineupAssignmentPane: { flex: 1.18, minWidth: 0, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 9, padding: 7, gap: 5 },
  lineupFieldPreview: { flex: 0.82, minWidth: 176, backgroundColor: "#EEF7F0", borderWidth: 1, borderColor: "#B8D9C0", borderRadius: 9, padding: 7, alignItems: "center" },
  lineupBuilderTitle: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  lineupBuilderHint: { color: BRAND.muted, fontSize: 8, lineHeight: 11 },
  lineupPreviewChipActive: { backgroundColor: "#DCEEFF", borderColor: BRAND.blue, borderWidth: 2 },
  lineupPreviewChipConflict: { backgroundColor: "#FFF0F1", borderColor: BRAND.red, borderWidth: 2 },
  lineupPreviewChipSwapSelected: { backgroundColor: "#FFF8E6", borderColor: BRAND.yellow, borderWidth: 2 },
  lineupPreviewPositionConflict: { color: BRAND.red },
  lineupBuilderHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
  swapModeButton: { borderWidth: 1, borderColor: BRAND.blue, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: BRAND.white },
  swapModeButtonActive: { backgroundColor: BRAND.yellow, borderColor: BRAND.yellow },
  swapModeButtonText: { color: BRAND.blue, fontSize: 8, fontWeight: "900" },
  swapModeButtonTextActive: { color: BRAND.navy },
  lineupConflictNotice: { backgroundColor: "#FFF0F1", borderWidth: 1, borderColor: "#F0A4AA", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginTop: 4 },
  lineupConflictNoticeText: { color: BRAND.red, fontSize: 9, fontWeight: "900", lineHeight: 12 },
  conflictFixPanel: { backgroundColor: "#FFF8E6", borderWidth: 1, borderColor: "#F0D58A", borderRadius: 8, padding: 7, gap: 6, marginTop: 2 },
  conflictFixPanelConfirmation: { marginTop: 0 },
  conflictFixHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 7 },
  conflictFixTitle: { color: "#9B6518", fontSize: 10, fontWeight: "900" },
  conflictFixSubtitle: { flex: 1, color: BRAND.muted, fontSize: 8, textAlign: "right" },
  conflictFixGroup: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: "#F3DFAD", borderRadius: 7, padding: 6, gap: 5 },
  conflictFixGroupTitle: { color: BRAND.ink, fontSize: 9, fontWeight: "900", lineHeight: 13 },
  conflictFixActionRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  conflictFixAction: { backgroundColor: BRAND.blue, borderRadius: 6, minHeight: 28, paddingHorizontal: 7, justifyContent: "center" },
  conflictFixActionText: { color: BRAND.white, fontSize: 8, fontWeight: "900" },
  conflictFixNoVacancy: { color: BRAND.red, fontSize: 8, fontWeight: "800" },
  conflictFixSwapRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  conflictFixSwapHint: { color: BRAND.muted, fontSize: 8, fontWeight: "800" },
  conflictFixSwapAction: { backgroundColor: "#EAF3FB", borderWidth: 1, borderColor: "#BBD4EC", borderRadius: 6, minHeight: 26, paddingHorizontal: 6, justifyContent: "center" },
  conflictFixSwapActionText: { color: BRAND.navy, fontSize: 8, fontWeight: "900" },
  defensivePicker: { backgroundColor: "#F7FAFD", borderRadius: 7, borderWidth: 1, borderColor: BRAND.line, padding: 5, gap: 4 },
  defensivePickerLabel: { color: BRAND.navy, fontSize: 9, fontWeight: "800" },
  defensivePositionRow: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  defensivePositionChip: { width: 33, minHeight: 29, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 6, alignItems: "center", justifyContent: "center", paddingVertical: 2 },
  defensivePositionChipActive: { backgroundColor: BRAND.blue, borderColor: BRAND.blue },
  defensivePositionChipConflict: { backgroundColor: BRAND.red, borderColor: BRAND.red },
  defensivePositionChipOccupied: { backgroundColor: "#EEF2F6", borderColor: "#C9D2DC", opacity: 0.62 },
  defensivePositionNumber: { color: BRAND.blue, fontSize: 10, fontWeight: "900" },
  defensivePositionLabel: { color: BRAND.muted, fontSize: 7, fontWeight: "800" },
  defensivePositionTextActive: { color: BRAND.white },
  clearDefensivePosition: { alignSelf: "flex-start", paddingVertical: 2, paddingHorizontal: 4 },
  clearDefensivePositionText: { color: BRAND.red, fontSize: 8, fontWeight: "900" },
  preferredPositionFieldPanel: { backgroundColor: "#F7FAFD", borderWidth: 1, borderColor: "#C7D8E8", borderRadius: 8, padding: 6, gap: 4, alignItems: "center" },
  preferredPositionFieldHeader: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  preferredPositionFieldTitle: { color: BRAND.navy, fontSize: 9, fontWeight: "900" },
  preferredPositionFieldHint: { color: BRAND.blue, fontSize: 8, fontWeight: "900" },
  preferredPositionField: { width: 168, aspectRatio: 612 / 535, backgroundColor: BRAND.white, borderRadius: 12, borderWidth: 2, borderColor: BRAND.line, overflow: "hidden", position: "relative" },
  preferredPositionFieldImage: { borderRadius: 10, backgroundColor: "transparent" },
  preferredPositionFieldMarker: { position: "absolute", width: 28, minHeight: 24, marginTop: -12, marginLeft: -14, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingVertical: 1, paddingHorizontal: 1, borderWidth: 1 },
  preferredPositionFieldMarkerIdle: { backgroundColor: "rgba(255,255,255,0.92)", borderColor: "#7C8FA2" },
  preferredPositionFieldMarkerActive: { backgroundColor: BRAND.blue, borderColor: BRAND.white, borderWidth: 2 },
  preferredPositionFieldMarkerNumber: { color: BRAND.navy, fontSize: 9, fontWeight: "900", lineHeight: 10 },
  preferredPositionFieldMarkerLabel: { color: BRAND.muted, fontSize: 6, fontWeight: "800", lineHeight: 7 },
  preferredPositionFieldMarkerTextActive: { color: BRAND.white },
  preferredPositionFieldNote: { alignSelf: "stretch", color: BRAND.muted, fontSize: 7, lineHeight: 10, textAlign: "center" },
  topDownField: { width: 132, aspectRatio: 612 / 535, marginTop: 2, overflow: "hidden", backgroundColor: BRAND.white, borderRadius: 10, borderWidth: 2, borderColor: "#2B6E46", position: "relative" },
  topDownFieldImage: { borderRadius: 8, opacity: 1 },
  topDownFieldWarningTrack: { position: "absolute", width: 206, height: 174, left: -19, top: -23, backgroundColor: "#D7B078", borderBottomLeftRadius: 103, borderBottomRightRadius: 103 },
  topDownFieldDirt: { position: "absolute", width: 77, height: 77, left: 46, top: 49, backgroundColor: "#C99561", transform: [{ rotate: "45deg" }] },
  topDownFieldMound: { position: "absolute", width: 18, height: 18, left: 77, top: 69, borderRadius: 9, backgroundColor: "#E7C188", borderWidth: 1, borderColor: "#AD7543" },
  topDownFieldBase: { position: "absolute", width: 8, height: 8, backgroundColor: BRAND.white, transform: [{ rotate: "45deg" }], borderWidth: 1, borderColor: "#A8B2BF" },
  topDownFieldBaseFirst: { left: 119, top: 88 },
  topDownFieldBaseSecond: { left: 82, top: 51 },
  topDownFieldBaseThird: { left: 45, top: 88 },
  topDownFieldBaseHome: { left: 82, top: 118 },
  topDownFieldMarker: { position: "absolute", width: 27, minHeight: 22, marginTop: -11, marginLeft: -14, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 1, paddingVertical: 1 },
  topDownFieldMarkerFilled: { backgroundColor: BRAND.navy, borderWidth: 1, borderColor: BRAND.white },
  topDownFieldMarkerConflict: { backgroundColor: BRAND.red, borderColor: "#FFF0F1", borderWidth: 2 },
  topDownFieldMarkerChanged: { backgroundColor: "#D89B11", borderColor: "#FFF7D1", borderWidth: 2 },
  topDownFieldMarkerEmpty: { backgroundColor: "rgba(255,255,255,0.82)", borderWidth: 1, borderColor: "#7C8FA2" },
  topDownFieldMarkerText: { color: BRAND.white, fontSize: 6, fontWeight: "900" },
  topDownFieldMarkerTextEmpty: { color: BRAND.navy },
  topDownFieldMarkerLabel: { color: BRAND.white, fontSize: 5, fontWeight: "800" },
  topDownFieldMarkerLabelConflict: { color: BRAND.white },
  registrationList: { gap: 7, paddingRight: 4 },
  registrationChip: { minWidth: 69, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 8, alignItems: "center" },
  registrationPlayerChip: { minWidth: 82, paddingVertical: 6 },
  registrationChipConflict: { backgroundColor: "#FFF0F1", borderColor: BRAND.red, borderWidth: 2 },
  registrationChipActive: { backgroundColor: "#DBEAFE", borderColor: BRAND.blue },
  registrationChipIneligible: { backgroundColor: "#FFF0F1", borderColor: "#FCA5A5", opacity: 0.88 },
  registrationChipNumber: { color: BRAND.blue, fontSize: 11, fontWeight: "900" },
  registrationChipText: { color: BRAND.navy, fontSize: 10, marginTop: 2, fontWeight: "800", maxWidth: 78 },
  registrationChipPosition: { color: BRAND.muted, fontSize: 8, marginTop: 1, fontWeight: "800", maxWidth: 78 },
  registrationChipIneligibleText: { color: BRAND.red },
  registrationChipTextActive: { color: BRAND.navy },
  substitutionContext: { color: BRAND.muted, fontSize: 11, lineHeight: 17, backgroundColor: BRAND.sky, borderRadius: 10, padding: 10, marginBottom: 12 },
  substitutionWizardStage: { color: BRAND.blue, fontSize: 12, fontWeight: "900", marginBottom: 4 },
  wizardStepRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginBottom: 10 },
  wizardStepChip: { flex: 1, minHeight: 42, borderWidth: 1, borderColor: BRAND.line, borderRadius: 9, paddingHorizontal: 5, paddingVertical: 5, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.paper },
  wizardStepChipActive: { borderColor: BRAND.blue, backgroundColor: BRAND.sky },
  wizardStepChipDone: { borderColor: BRAND.green, backgroundColor: "#EFFAF3" },
  wizardStepIndex: { color: BRAND.muted, fontSize: 11, fontWeight: "900" },
  wizardStepIndexActive: { color: BRAND.blue },
  wizardStepText: { color: BRAND.muted, fontSize: 10, fontWeight: "800", marginTop: 1 },
  wizardStepTextActive: { color: BRAND.navy },
  specialEventOption: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 12, marginBottom: 8 },
  specialEventOptionActive: { backgroundColor: "#FFF8E6", borderColor: BRAND.yellow },
  specialEventOptionTitle: { color: BRAND.navy, fontSize: 13, fontWeight: "900" },
  specialEventOptionText: { color: BRAND.muted, fontSize: 10, marginTop: 4, lineHeight: 15 },
  specialEventReasonCard: { backgroundColor: BRAND.sky, borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, padding: 9, gap: 5 },
  specialEventReasonInput: { minHeight: 52, paddingTop: 8, textAlignVertical: "top" },
  specialEventReasonHint: { color: BRAND.muted, fontSize: 10, lineHeight: 14 },
  specialEventPreview: { color: BRAND.blue, fontSize: 16, fontWeight: "900", textAlign: "center", paddingVertical: 13 },
  confirmationSummary: { backgroundColor: BRAND.sky, borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 12, gap: 5, marginBottom: 12 },
  confirmationSummaryTitle: { color: BRAND.navy, fontSize: 13, fontWeight: "900" },
  confirmationSummaryText: { color: BRAND.ink, fontSize: 11, lineHeight: 16 },
  fcConfirmationRow: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderTopWidth: 1, borderTopColor: "rgba(29,95,167,0.10)", paddingTop: 5 },
  fcConfirmationRole: { color: BRAND.blue, fontSize: 10, fontWeight: "900" },
  fcConfirmationBase: { minWidth: 72, alignItems: "center", borderRadius: 9, backgroundColor: BRAND.white, borderWidth: 1, borderColor: "#A9C7E5", paddingHorizontal: 8, paddingVertical: 5 },
  fcConfirmationBaseText: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  confirmationNotation: { color: BRAND.blue, fontSize: 11, fontWeight: "900", marginTop: 3 },
  confirmationActionRow: { flexDirection: "row", gap: 8 },
  confirmationActionFlex: { flex: 1 },
  conflictCard: { backgroundColor: BRAND.white, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: BRAND.line, gap: 10 },
  conflictTitle: { color: BRAND.ink, fontSize: 17, fontWeight: "900" },
  conflictText: { color: BRAND.muted, fontSize: 11, lineHeight: 17 },
  conflictChoice: { backgroundColor: BRAND.paper, borderRadius: 11, padding: 12, borderWidth: 1, borderColor: BRAND.line },
  conflictChoiceTitle: { color: BRAND.navy, fontSize: 12, fontWeight: "900" },
  conflictChoiceText: { color: BRAND.muted, fontSize: 10, marginTop: 3 },
  modalScrollContent: { paddingBottom: 24 },
  schoolAddRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  schoolAddInput: { flex: 1, marginBottom: 0 },
  schoolManagerCard: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 15, padding: 13, marginBottom: 10 },
  schoolManagerHeader: { flexDirection: "row", alignItems: "center" },
  schoolManagerCopy: { flex: 1 },
  schoolManagerName: { color: BRAND.navy, fontSize: 14, fontWeight: "900" },
  schoolManagerMeta: { color: BRAND.muted, fontSize: 10, marginTop: 4 },
  schoolActionText: { color: BRAND.navy, fontSize: 12, fontWeight: "900" },
  schoolEditRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  schoolEditInput: { flex: 1, marginBottom: 0 },
  schoolActionRow: { flexDirection: "row", gap: 8, marginTop: 11 },
  liveTeamsCard: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 17, padding: 13, gap: 10 },
  liveTeamsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  liveTeamsTitle: { color: BRAND.navy, fontSize: 15, fontWeight: "900", marginTop: 3 },
  liveTeamsMeta: { color: BRAND.blue, fontSize: 10, fontWeight: "900", textAlign: "right", maxWidth: 100 },
  liveTeamsRow: { flexDirection: "row", gap: 9 },
  liveTeamPanel: { flex: 1, minHeight: 82, backgroundColor: BRAND.paper, borderWidth: 1, borderColor: BRAND.line, borderRadius: 13, padding: 10, gap: 5 },
  liveTeamPanelOwned: { backgroundColor: BRAND.sky, borderColor: BRAND.blue },
  liveTeamPanelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 5 },
  liveTeamSide: { color: BRAND.muted, fontSize: 10, fontWeight: "900" },
  liveTeamOwned: { color: BRAND.blue, fontSize: 9, fontWeight: "900" },
  liveTeamName: { color: BRAND.ink, fontSize: 13, fontWeight: "900" },
  liveTeamNotation: { color: BRAND.muted, fontSize: 10, lineHeight: 15 },
  liveTeamsHint: { color: BRAND.muted, fontSize: 10, lineHeight: 15 },
  teamPerspectiveCard: { backgroundColor: "#F1F7FC", borderWidth: 1, borderColor: "#C8DDED", borderRadius: 16, padding: 13, gap: 8, marginTop: 10 },
  teamPerspectiveEyebrow: { color: BRAND.blue, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  teamPerspectiveTitle: { color: BRAND.navy, fontSize: 15, fontWeight: "900", marginTop: 3 },
  teamPerspectiveStats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  teamPerspectiveStat: { color: BRAND.ink, fontSize: 11, fontWeight: "900", backgroundColor: BRAND.white, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 },
  teamPerspectiveHint: { color: BRAND.muted, fontSize: 10, lineHeight: 15 },
  statsOwnerCard: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 17, padding: 13, gap: 10 },
  statsOwnerEyebrow: { color: BRAND.blue, fontSize: 9, fontWeight: "900", letterSpacing: 0.7 },
  statsOwnerTitle: { color: BRAND.navy, fontSize: 18, fontWeight: "900", marginTop: 3 },
  statsOwnerMeta: { color: BRAND.muted, fontSize: 10, marginTop: 3 },
  statsOwnerChoices: { gap: 8 },
  statsOwnerChoice: { minWidth: 108, backgroundColor: BRAND.paper, borderWidth: 1, borderColor: BRAND.line, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 9 },
  statsOwnerChoiceActive: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  statsOwnerChoiceText: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  statsOwnerChoiceTextActive: { color: BRAND.white },
  statsOwnerChoiceMeta: { color: BRAND.muted, fontSize: 9, marginTop: 3 },
  teamStatSummary: { backgroundColor: "#F7FAFD", borderWidth: 1, borderColor: BRAND.line, borderRadius: 15, padding: 13, gap: 9 },
  teamStatSummaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  teamStatSummaryValue: { color: BRAND.navy, fontSize: 12, fontWeight: "900" },
  occupiedBaseText: { color: BRAND.white },
  fieldCanvasLarge: { width: 366, maxWidth: "100%", height: 320, alignSelf: "center", backgroundColor: BRAND.white, borderRadius: 18, position: "relative", overflow: "hidden", marginTop: 10, borderWidth: 2, borderColor: BRAND.line },
  fieldCanvasLargeImage: { borderRadius: 16, backgroundColor: BRAND.white },
  fieldNodeLarge: { position: "absolute", width: 66, height: 46, backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 10, justifyContent: "center", alignItems: "center", paddingHorizontal: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 4 },
  fieldNodeNumberLarge: { fontSize: 11, fontWeight: "900", color: BRAND.navy },
  fieldNodeLabelLarge: { fontSize: 10, fontWeight: "800", color: BRAND.muted },
  fieldPlayerPosBadge: { fontSize: 10, fontWeight: "800", color: BRAND.blue, marginTop: 2 },
  wasedaSheet: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 16, padding: 12, marginBottom: 16, gap: 10 },
  wasedaSheetTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: BRAND.line },
  wasedaAwayTitle: { borderLeftWidth: 4, borderLeftColor: BRAND.blue, paddingLeft: 8 },
  wasedaHomeTitle: { borderLeftWidth: 4, borderLeftColor: BRAND.navy, paddingLeft: 8 },
  wasedaTeamCaption: { color: BRAND.muted, fontSize: 9, fontWeight: "900" },
  wasedaTeamTitle: { color: BRAND.navy, fontSize: 15, fontWeight: "900", marginTop: 2 },
  wasedaTeamScore: { color: BRAND.navy, fontSize: 18, fontWeight: "900" },
  wasedaScrollContent: { paddingVertical: 4 },
  wasedaHeaderRow: { flexDirection: "row", backgroundColor: BRAND.paper, borderBottomWidth: 1, borderBottomColor: BRAND.line, alignItems: "center" },
  wasedaHeaderText: { color: BRAND.navy, fontSize: 11, fontWeight: "900", textAlign: "center" },
  wasedaPositionCell: { width: 76, paddingVertical: 8, textAlign: "center", borderRightWidth: 1, borderRightColor: BRAND.line, fontSize: 11, fontWeight: "900", color: BRAND.navy },
  wasedaPositionSummary: { justifyContent: "center", alignItems: "center", paddingHorizontal: 4 },
  wasedaPositionStarter: { color: BRAND.navy, fontSize: 11, fontWeight: "900", textAlign: "center" },
  wasedaPositionTimeline: { color: BRAND.muted, fontSize: 8, fontWeight: "700", lineHeight: 11, marginTop: 3, textAlign: "center" },
  wasedaPlayerCell: { width: 115, paddingVertical: 8, paddingHorizontal: 6, borderRightWidth: 1, borderRightColor: BRAND.line, fontSize: 11, fontWeight: "900", color: BRAND.ink },
  wasedaPlayerCellWrap: { width: 115, paddingVertical: 6, paddingHorizontal: 6, borderRightWidth: 1, borderRightColor: BRAND.line, justifyContent: "center" },
  wasedaPlayerText: { fontSize: 11, fontWeight: "900", color: BRAND.ink },
  wasedaPlayerSub: { fontSize: 9, color: BRAND.muted, marginTop: 1 },
  wasedaNumberCell: { width: 36, paddingVertical: 8, textAlign: "center", borderRightWidth: 1, borderRightColor: BRAND.line, fontSize: 10, fontWeight: "800", color: BRAND.muted },
  wasedaInningHeader: { width: 86, paddingVertical: 6, alignItems: "center", borderRightWidth: 1, borderRightColor: BRAND.line },
  wasedaInningNumber: { fontSize: 11, fontWeight: "900", color: BRAND.navy },
  wasedaInningSub: { fontSize: 8, color: BRAND.muted },
  wasedaTotalCell: { width: 72, paddingVertical: 8, textAlign: "center", fontSize: 11, fontWeight: "900", color: BRAND.navy },
  wasedaDataRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BRAND.line, alignItems: "center", minHeight: 86 },
  wasedaInningCell: { width: 86, height: 86, borderRightWidth: 1, borderRightColor: BRAND.line, justifyContent: "center", alignItems: "center", backgroundColor: BRAND.paper, padding: 2 },
  wasedaCellThreeZone: { width: 52, height: 42, flexDirection: "row", alignItems: "center", paddingHorizontal: 1 },
  wasedaPitchColumn: { width: 11, color: BRAND.blue, fontSize: 8, fontWeight: "900", textAlign: "center", lineHeight: 9 },
  wasedaDiamond: { width: 44, height: 36, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 4, justifyContent: "center", alignItems: "center", padding: 1, backgroundColor: BRAND.white },
  wasedaCellNotation: { fontSize: 9, fontWeight: "900", color: BRAND.navy, textAlign: "center" },
  wasedaInnerResult: { borderWidth: 1, borderColor: BRAND.blue, backgroundColor: "#EFF6FF", minWidth: 20, paddingHorizontal: 2, borderRadius: 8, marginTop: 1 },
  wasedaCellResult: { fontSize: 8, fontWeight: "800", color: BRAND.blue, textAlign: "center", marginTop: 1 },
  wasedaCellEmpty: { fontSize: 9, color: "#94A3B8" },
  wasedaTotalsRow: { flexDirection: "row", backgroundColor: "#F8FAFC", borderTopWidth: 1, borderTopColor: BRAND.line, alignItems: "center", paddingVertical: 6 },
  wasedaTotalsLabel: { fontSize: 11, fontWeight: "900", color: BRAND.navy, textAlign: "center" },
  wasedaInningTotal: { width: 86, textAlign: "center", fontSize: 11, fontWeight: "900", color: BRAND.navy, borderRightWidth: 1, borderRightColor: BRAND.line },
  wasedaLegendStrip: { backgroundColor: "#F1F5F9", borderRadius: 8, padding: 8, marginTop: 6 },
  wasedaLegendTitle: { fontSize: 10, fontWeight: "900", color: BRAND.navy, marginBottom: 2 },
  wasedaLegendText: { fontSize: 9, color: BRAND.muted, lineHeight: 14 },
  wasedaSummaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  wasedaSummaryCard: { flex: 1, minWidth: 260, backgroundColor: BRAND.paper, borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 10, gap: 6 },
  wasedaSummaryTitle: { fontSize: 12, fontWeight: "900", color: BRAND.navy },
  wasedaStatHeader: { flexDirection: "row", backgroundColor: BRAND.white, borderBottomWidth: 1, borderBottomColor: BRAND.line, paddingVertical: 4 },
  wasedaStatPlayer: { width: 100, fontSize: 10, fontWeight: "900", color: BRAND.ink, paddingLeft: 4 },
  wasedaStatCell: { width: 42, fontSize: 10, fontWeight: "900", color: BRAND.navy, textAlign: "center" },
  wasedaStatSacCell: { width: 48, fontSize: 9, lineHeight: 10, fontWeight: "900", color: BRAND.navy, textAlign: "center" },
  wasedaStatRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: BRAND.line, paddingVertical: 5, alignItems: "center" },
  wasedaPitcherRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: BRAND.line },
  wasedaPitcherStats: { fontSize: 10, fontWeight: "800", color: BRAND.navy },
  wasedaLegendPanel: { backgroundColor: BRAND.paper, borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 12, gap: 6, marginTop: 12 },
  gameRecordHeaderCard: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 16, padding: 14, gap: 6, marginBottom: 12 },
  gameRecordEyebrow: { color: BRAND.blue, fontSize: 9, fontWeight: "900", letterSpacing: 0.8 },
  gameRecordTitle: { color: BRAND.navy, fontSize: 18, fontWeight: "900", marginTop: 2 },
  gameRecordIntro: { color: BRAND.muted, fontSize: 11, lineHeight: 16 },
  gameRecordReadOnlyBanner: { color: "#92400E", backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FCD34D", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 10, lineHeight: 14, fontWeight: "800" },
  gameRecordMetricRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  gameLogThreePane: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  gameLogLeftColumn: { flex: 1, minWidth: 300, gap: 12 },
  gameLogTeamsPane: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 16, padding: 12, gap: 10 },
  gameLogTeamPair: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  gameLogAwayTeam: { flex: 1, minWidth: 0, backgroundColor: "#EFF6FF", borderRadius: 10, padding: 9, gap: 2, borderWidth: 1 },
  gameLogHomeTeam: { flex: 1, minWidth: 0, backgroundColor: "#ECFDF5", borderRadius: 10, padding: 9, gap: 2, alignItems: "flex-end", borderWidth: 1 },
  gameLogTeamSelected: { borderWidth: 2, borderColor: BRAND.blue, shadowColor: BRAND.blue, shadowOpacity: 0.14, shadowRadius: 5, elevation: 2 },
  gameLogTeamSide: { color: BRAND.muted, fontSize: 9, fontWeight: "900" },
  gameLogTeamName: { color: BRAND.navy, fontSize: 13, fontWeight: "900" },
  gameLogTeamScore: { color: BRAND.blue, fontSize: 24, fontWeight: "900", lineHeight: 28 },
  gameLogVersus: { color: BRAND.muted, fontSize: 10, fontWeight: "900", alignSelf: "center" },
  gameLogControlPane: { width: 270, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 16, padding: 12, gap: 9 },
  gameLogControlHint: { color: BRAND.muted, fontSize: 9, lineHeight: 13 },
  gameLogNotationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  gameLogNotationButton: { width: 58, minHeight: 50, alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, backgroundColor: "#F8FAFC", padding: 4 },
  gameLogNotationButtonDisabled: { opacity: 0.5 },
  gameLogNotationMark: { color: BRAND.navy, fontSize: 16, fontWeight: "900", lineHeight: 18 },
  gameLogNotationLabel: { color: BRAND.muted, fontSize: 8, fontWeight: "800", textAlign: "center" },
  gameLogControlSubtitle: { color: BRAND.navy, fontSize: 10, fontWeight: "900", marginTop: 3 },
  gameLogOnDeckCard: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 9, padding: 8, gap: 2 },
  gameLogOnDeckName: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  gameLogOnDeckNotation: { color: BRAND.blue, fontSize: 13, fontWeight: "900" },
  gameLogOnDeckHint: { color: BRAND.muted, fontSize: 8, lineHeight: 11 },
  gameRecordStatusCard: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  gameRecordStatusCopy: { flex: 1, gap: 4 },
  gameRecordStatusText: { color: BRAND.muted, fontSize: 11, lineHeight: 16 },
  gameRecordSheet: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 18, padding: 14, gap: 10 },
  gameRecordSheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  gameRecordSheetHint: { color: BRAND.muted, fontSize: 10, marginTop: 2 },
  gameRecordSheetCount: { backgroundColor: BRAND.paper, color: BRAND.navy, fontSize: 11, fontWeight: "900", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  gameRecordActionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  gameRecordSyncRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: BRAND.paper, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  gameRecordSyncBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  gameRecordSyncBadgeSynced: { backgroundColor: "#DCFCE7" },
  gameRecordSyncBadgeRefreshing: { backgroundColor: "#E0F2FE" },
  gameRecordSyncBadgePending: { backgroundColor: "#FEF9C3" },
  gameRecordSyncDot: { width: 6, height: 6, borderRadius: 3 },
  gameRecordSyncDotSynced: { backgroundColor: "#16A34A" },
  gameRecordSyncDotRefreshing: { backgroundColor: "#0284C7" },
  gameRecordSyncDotPending: { backgroundColor: "#CA8A04" },
  gameRecordSyncText: { fontSize: 10, fontWeight: "900", color: BRAND.navy },
  gameRecordSyncHint: { fontSize: 10, color: BRAND.muted, flex: 1 },
  gameRecordRefreshMeta: { fontSize: 10, color: BRAND.muted, fontStyle: "italic" },
  gameRecordInteractionHint: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, alignItems: "center" },
  pitchTrackingCard: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 8, gap: 6 },
  pitchTrackingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  pitchTrackingTitle: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  pitchTrackingHint: { color: BRAND.muted, fontSize: 8, marginTop: 1, lineHeight: 11, maxWidth: 260 },
  pitchTrackingState: { color: BRAND.white, backgroundColor: BRAND.navy, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, fontSize: 9, fontWeight: "900" },
  pitchWorkflowSteps: { flexDirection: "row", gap: 4 },
  pitchWorkflowStep: { flex: 1, minHeight: 27, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 7, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: BRAND.white },
  pitchWorkflowStepActive: { backgroundColor: "#DBEAFE", borderColor: BRAND.blue },
  pitchWorkflowStepDone: { backgroundColor: "#ECFDF5", borderColor: "#86EFAC" },
  pitchWorkflowStepNumber: { color: BRAND.muted, fontSize: 9, fontWeight: "900" },
  pitchWorkflowStepText: { color: BRAND.muted, fontSize: 9, fontWeight: "900" },
  pitchWorkflowStepTextActive: { color: BRAND.navy },
  pitchWorkflowInstruction: { flex: 1, color: BRAND.navy, fontSize: 9, lineHeight: 12, fontWeight: "800" },
  pitchWorkflowMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  pitchWorkflowBack: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 6, backgroundColor: BRAND.white, paddingHorizontal: 7, paddingVertical: 4 },
  pitchWorkflowBackText: { color: BRAND.blue, fontSize: 8, fontWeight: "900" },
  pitchTypeSelector: { flexDirection: "row", gap: 5 },
  pitchTypeButton: { flex: 1, minHeight: 28, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, backgroundColor: BRAND.white },
  pitchTypeButtonActive: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  pitchTypeButtonText: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  pitchTypeButtonTextActive: { color: BRAND.white },
  zonePickerRow: { flexDirection: "row", gap: 10 },
  zonePickerPanel: { flex: 1, minWidth: 136, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 8 },
  zonePickerPanelWide: { flex: 1, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, padding: 5 },
  zonePickerTitle: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  zonePickerHint: { color: BRAND.muted, fontSize: 8, marginTop: 1, marginBottom: 3 },
  zonePickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  zonePickerGridFive: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  zonePickerCell: { width: "18.7%", aspectRatio: 1, borderRadius: 5, borderWidth: 1, borderColor: "#CBD5E1", justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC", position: "relative", padding: 1 },
  zonePickerCellPitchActive: { backgroundColor: "#DBEAFE", borderColor: BRAND.blue },
  zonePickerCellOutside: { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" },
  zonePickerCellOutsideText: { color: "#C2410C" },
  zonePickerCellHitActive: { backgroundColor: "#FEE2E2", borderColor: "#DC2626" },
  zonePickerCellRecorded: { backgroundColor: "#EFF6FF", borderColor: "#93C5FD" },
  zonePickerCellText: { color: BRAND.muted, fontSize: 9, fontWeight: "900" },
  zonePickerCellTextActive: { color: BRAND.navy },
  zonePickerZoneNumber: { position: "absolute", top: 1, left: 3, color: BRAND.muted, fontSize: 6, fontWeight: "900" },
  zonePickerPitchSequence: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 1, maxWidth: "84%" },
  zonePickerPitchDot: { minWidth: 13, height: 13, borderRadius: 7, paddingHorizontal: 2, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.blue },
  zonePickerPitchDotBreaking: { backgroundColor: BRAND.red },
  zonePickerPitchDotText: { color: BRAND.white, fontSize: 7, fontWeight: "900", lineHeight: 9 },
  liveWasedaCard: { backgroundColor: "#F8FAFC", borderRadius: 14, borderWidth: 1, borderColor: BRAND.line, padding: 12, gap: 9 },
  liveWasedaHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  liveWasedaTitle: { color: BRAND.navy, fontSize: 13, fontWeight: "900" },
  liveWasedaHint: { color: BRAND.muted, fontSize: 10, lineHeight: 14, marginTop: 3, maxWidth: 420 },
  liveWasedaBatter: { color: BRAND.blue, fontSize: 11, fontWeight: "900", textAlign: "right" },
  liveWasedaQuadrantGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 8, backgroundColor: "#ECFDF5", borderRadius: 12, borderWidth: 1, borderColor: "#BBF7D0" },
  liveWasedaQuadrant: { width: "calc(50% - 4px)" as unknown as number, minHeight: 112, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, padding: 7, gap: 5 },
  liveWasedaQuadrantHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  liveWasedaBaseLabel: { color: BRAND.navy, fontWeight: "900", fontSize: 11 },
  liveWasedaQuadrantNote: { color: BRAND.muted, fontSize: 8, fontWeight: "700", flex: 1, textAlign: "right" },
  liveWasedaCellContent: { flexDirection: "row", flex: 1, alignItems: "center" },
  liveWasedaPitchWrap: { width: 34, height: "100%", alignItems: "center", justifyContent: "center", borderRightWidth: 1, borderColor: "#CBD5E1", paddingRight: 4, gap: 2 },
  liveWasedaPitchCaption: { color: BRAND.muted, fontSize: 7, fontWeight: "900" },
  liveWasedaPitchColumn: { color: BRAND.blue, fontWeight: "900", fontSize: 10, textAlign: "center", letterSpacing: 1 },
  liveWasedaOuter: { flex: 1, minHeight: 70, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 6, justifyContent: "center", alignItems: "center", padding: 4, gap: 3 },
  liveWasedaZoneLabel: { color: BRAND.muted, fontSize: 7, fontWeight: "900" },
  liveWasedaOuterText: { color: BRAND.navy, fontSize: 10, fontWeight: "900", textAlign: "center" },
  liveWasedaInner: { borderWidth: 1, borderColor: BRAND.blue, backgroundColor: "#EFF6FF", borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, marginTop: 1, alignItems: "center" },
  liveWasedaInnerText: { color: BRAND.blue, fontSize: 9, fontWeight: "900" },
  liveWasedaLegend: { flexDirection: "row", flexWrap: "wrap", gap: 8, backgroundColor: BRAND.white, borderRadius: 8, padding: 8 },
  liveWasedaLegendItem: { color: BRAND.muted, fontSize: 9, fontWeight: "700" },
  liveWorkspace: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  fiveGridWorkspace: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  fiveGridColumn: { flex: 1, minWidth: 0, gap: 8, alignSelf: "stretch" },
  middleLiveStack: { flex: 1.15 },
  inningRailPanel: { width: 252, minWidth: 214, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, padding: 6, gap: 4 },
  liveQuadrant: { minWidth: 0, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 8, gap: 6 },
  middleAtBatPanel: { minWidth: 0 },
  middleControlsPanel: { minWidth: 0 },
  livePanelTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  livePanelNumber: { width: 20, height: 20, borderRadius: 10, backgroundColor: BRAND.navy, color: BRAND.white, textAlign: "center", lineHeight: 20, fontSize: 10, fontWeight: "900" },
  livePanelCopy: { flex: 1 },
  livePanelTitle: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  livePanelSubtitle: { color: BRAND.muted, fontSize: 8, lineHeight: 11, marginTop: 1 },
  liveInfieldGrid: { backgroundColor: "#10251A", borderRadius: 11, borderWidth: 1, borderColor: "#1E4930", padding: 7, gap: 5 },
  liveRunnerDefenseRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, borderBottomWidth: 1, borderBottomColor: "#1E4930", paddingBottom: 4 },
  liveRunnerDefenseCopy: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 4 },
  liveRunnerDefenseDot: { color: "#6EE7B7", fontSize: 12, fontWeight: "900" },
  liveRunnerDefenseText: { color: BRAND.white, fontSize: 9, fontWeight: "900" },
  liveRunnerZoomButton: { minHeight: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2, borderRadius: 5, borderWidth: 1, borderColor: "#6EE7B7", backgroundColor: "#123A2A", paddingHorizontal: 5, paddingVertical: 1 },
  liveRunnerZoomIcon: { color: "#A7F3D0", fontSize: 11, fontWeight: "900", lineHeight: 13 },
  liveRunnerZoomText: { color: "#D1FAE5", fontSize: 7, fontWeight: "900", lineHeight: 10 },
  liveInfieldWorkRow: { flexDirection: "row", alignItems: "stretch", gap: 7 },
  liveRunnerCross: { flex: 1, minWidth: 0, minHeight: 280, aspectRatio: 612 / 535, justifyContent: "space-between", padding: 10, overflow: "hidden", borderRadius: 9, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line },
  liveRunnerCrossBackground: { opacity: 0.88, borderRadius: 9, backgroundColor: BRAND.white },
  liveRunnerTopSlot: { alignItems: "center", justifyContent: "center", gap: 3 },
  liveRunnerMiddleSlot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
  liveRunnerBottomSlot: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  liveRunnerSideSlot: { width: "31.5%", alignItems: "center", gap: 3 },
  liveRunnerScoreCell: { width: 92, height: 70, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: BRAND.white, overflow: "hidden", justifyContent: "center", alignSelf: "center" },
  liveRunnerScoreCellOccupied: { borderColor: "#60A5FA", borderWidth: 2 },
  liveRunnerPlayerTag: { maxWidth: 104, minHeight: 20, borderRadius: 7, borderWidth: 1, borderColor: "#D6A64B", backgroundColor: "#111827", justifyContent: "center", paddingHorizontal: 5 },
  liveRunnerPlayerTagOccupied: { borderColor: "#FBBF24", backgroundColor: "#1C1917" },
  liveRunnerPlayerTagText: { color: "#FEF3C7", fontSize: 8.5, lineHeight: 11, textAlign: "center", fontWeight: "900" },
  liveRunnerMound: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#8B4A3B", borderWidth: 2, borderColor: "#C98268", alignItems: "center", justifyContent: "center", gap: 1 },
  liveRunnerMoundText: { maxWidth: 60, color: "#A7F3D0", fontSize: 9, fontWeight: "900", textAlign: "center" },
  liveRunnerMoundMeta: { color: "#D1FAE5", fontSize: 7, fontWeight: "800" },
  liveRunnerOutRow: { flexDirection: "row", alignItems: "center", gap: 4, borderTopWidth: 1, borderTopColor: "#1E4930", paddingTop: 4 },
  liveRunnerOutIcon: { color: "#FCD34D", fontSize: 15, fontWeight: "900" },
  liveRunnerOutText: { color: "#FDE68A", fontSize: 10, fontWeight: "900" },
  baseZoomBackdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.72)", alignItems: "center", justifyContent: "center", padding: 12 },
  baseZoomSheet: { width: "100%", maxWidth: 760, maxHeight: "94%", backgroundColor: BRAND.paper, borderRadius: 18, borderWidth: 1, borderColor: BRAND.line, padding: 12, gap: 8 },
  baseZoomGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  baseZoomCell: { width: "48.9%", minWidth: 0, flexGrow: 1, alignItems: "center", gap: 3, backgroundColor: BRAND.white, borderRadius: 10, borderWidth: 1, borderColor: BRAND.line, padding: 5 },
  baseZoomCellLabel: { color: BRAND.navy, fontSize: 11, lineHeight: 14, fontWeight: "900" },
  baseZoomHint: { color: BRAND.muted, fontSize: 9, lineHeight: 13, textAlign: "center", fontWeight: "700" },
  runnerActionRail: { width: 78, minWidth: 78, alignItems: "stretch", gap: 2, paddingLeft: 6, borderLeftWidth: 1, borderLeftColor: "#1E4930" },
  runnerActionRailTitle: { color: "#FDE68A", fontSize: 8, fontWeight: "900", textAlign: "center" },
  runnerActionRailHint: { color: "#86A99A", fontSize: 6, fontWeight: "800", textAlign: "center", marginTop: -2, marginBottom: 1 },
  runnerActionButton: { minWidth: 70, flexGrow: 1, minHeight: 34, flexBasis: "22%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 7, borderWidth: 1, borderColor: "#BFDBFE", backgroundColor: "#EFF6FF", paddingHorizontal: 4 },
  runnerActionButtonVertical: { minWidth: 0, minHeight: 23, flexGrow: 0, flexBasis: "auto", flexDirection: "row", gap: 2, paddingHorizontal: 3, paddingVertical: 2 },
  runnerActionButtonEmphasis: { backgroundColor: "#FFF7ED", borderColor: "#FDBA74" },
  runnerActionMark: { color: BRAND.blue, fontSize: 11, fontWeight: "900" },
  runnerActionMarkVertical: { fontSize: 9 },
  runnerActionText: { color: BRAND.navy, fontSize: 8, fontWeight: "900" },
  runnerActionTextVertical: { fontSize: 7, flexShrink: 1 },
  actionButtonDisabled: { opacity: 0.4 },
  liveMatchupRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#F8FAFC", borderRadius: 8, padding: 5 },
  liveMatchupPlayer: { color: BRAND.navy, fontSize: 10, fontWeight: "900", flex: 1, textAlign: "right" },
  liveMatchupVs: { color: BRAND.muted, fontSize: 8, fontWeight: "900" },
  liveMatchupPitcher: { color: BRAND.red, fontSize: 10, fontWeight: "900", flex: 1 },
  currentAtBatWorkRow: { flexDirection: "row", alignItems: "stretch", gap: 6, minWidth: 0 },
  atBatSummaryPanel: { width: "34%", minWidth: 132, justifyContent: "center", gap: 7, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 9, backgroundColor: "#F8FAFC", padding: 7 },
  summaryModeToggle: { flexDirection: "row", gap: 4, backgroundColor: "#E8EEF5", borderRadius: 9, padding: 3 },
  summaryModeButton: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: 7 },
  summaryModeButtonActive: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: "#B9CBE0" },
  summaryModeButtonText: { color: BRAND.muted, fontSize: 11, fontWeight: "800" },
  summaryModeButtonTextActive: { color: BRAND.navy },
  summaryCompactCount: { borderRadius: 8, backgroundColor: BRAND.paper, paddingHorizontal: 8, paddingVertical: 8, gap: 2 },
  summaryCompactValue: { color: BRAND.navy, fontSize: 13, lineHeight: 17, fontWeight: "900" },
  summaryCompactMeta: { color: BRAND.muted, fontSize: 10, lineHeight: 13, fontWeight: "700" },
  summaryDetailMeta: { color: BRAND.muted, fontSize: 10, lineHeight: 13, fontWeight: "700", textAlign: "center" },
  atBatRecordPanel: { flex: 1, minWidth: 0 },
  currentAtBatPanel: { borderWidth: 1, borderColor: "#93C5FD", backgroundColor: "#F8FBFF", borderRadius: 10, padding: 6, gap: 4 },
  currentAtBatHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  currentAtBatName: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  currentAtBatSync: { color: BRAND.blue, fontSize: 9, fontWeight: "900", backgroundColor: "#DBEAFE", paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  currentAtBatCell: { flexDirection: "row", minHeight: 114, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, overflow: "hidden", backgroundColor: BRAND.white },
  currentAtBatPitches: { width: 82, alignItems: "center", justifyContent: "center", gap: 6, borderRightWidth: 1, borderColor: "#CBD5E1", padding: 7 },
  currentAtBatPitchMarks: { color: BRAND.blue, fontSize: 18, fontWeight: "900", letterSpacing: 2, textAlign: "center" },
  currentAtBatOuter: { flex: 1, margin: 7, borderWidth: 1, borderColor: "#94A3B8", borderRadius: 7, justifyContent: "center", alignItems: "center", padding: 6, gap: 4 },
  currentAtBatOuterText: { color: BRAND.navy, fontSize: 16, fontWeight: "900", textAlign: "center" },
  currentAtBatInner: { minWidth: 70, borderWidth: 1, borderColor: BRAND.blue, backgroundColor: "#EFF6FF", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, alignItems: "center" },
  currentAtBatInnerText: { color: BRAND.blue, fontSize: 15, fontWeight: "900" },
  recordColumnCard: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 10, padding: 8, gap: 7 },
  recordColumnTitleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  recordColumnTitle: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  recordColumnHint: { color: BRAND.muted, fontSize: 8, lineHeight: 11, maxWidth: 360 },
  recordColumnPreview: { color: BRAND.green, fontSize: 13, fontWeight: "900", textAlign: "right", flexShrink: 1 },
  recordColumnChoices: { gap: 6, paddingRight: 4 },
  recordColumnChoice: { minWidth: 58, minHeight: 40, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.white, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, gap: 1 },
  recordColumnChoiceActive: { backgroundColor: "#D1FAE5", borderColor: BRAND.green },
  recordColumnChoiceMark: { color: BRAND.navy, fontSize: 17, fontWeight: "900" },
  recordColumnChoiceMarkActive: { color: BRAND.green },
  recordColumnChoiceText: { color: BRAND.muted, fontSize: 9, fontWeight: "800" },
  recordColumnChoiceTextActive: { color: BRAND.green },
  recordColumnDetailRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  recordColumnSequenceWrap: { flex: 1, gap: 3 },
  recordColumnRbiWrap: { width: 160, gap: 3 },
  recordColumnFieldLabel: { color: BRAND.muted, fontSize: 8, fontWeight: "900" },
  recordColumnFieldHint: { color: BRAND.muted, fontSize: 8, lineHeight: 10, fontWeight: "700" },
  recordColumnSequenceInput: { display: "none" },
  fieldingExampleRow: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 7, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", paddingHorizontal: 7, paddingVertical: 5 },
  fieldingExampleLabel: { color: BRAND.blue, fontSize: 8, fontWeight: "900" },
  fieldingExampleValue: { color: BRAND.navy, fontSize: 12, fontWeight: "900" },
  fieldingExampleHint: { color: BRAND.muted, flex: 1, fontSize: 8, fontWeight: "700", textAlign: "right" },
  fieldingPlayEditor: { gap: 5, padding: 6, borderRadius: 8, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#CBD5E1" },
  fieldingPlayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  fieldingPlayPreview: { color: BRAND.green, fontSize: 10, fontWeight: "900" },
  fieldingSymbolEditor: { gap: 5, padding: 7, borderRadius: 8, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#93C5FD" },
  fieldingSymbolHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  fieldingSymbolTitle: { color: BRAND.blue, fontSize: 9, fontWeight: "900" },
  fieldingSymbolPreview: { flex: 1, color: BRAND.navy, fontSize: 10, fontWeight: "900", textAlign: "right" },
  fieldingPresetRow: { flexDirection: "row", alignItems: "stretch", gap: 4 },
  fieldingPresetCaption: { width: 52, alignSelf: "center", gap: 1 },
  fieldingPresetLabel: { color: BRAND.blue, fontSize: 8, fontWeight: "900" },
  fieldingDirectionHint: { color: BRAND.muted, fontSize: 7, fontWeight: "800", lineHeight: 9 },
  fieldingPresetButton: { flex: 1, minHeight: 30, alignItems: "center", justifyContent: "center", gap: 1, paddingHorizontal: 3, borderRadius: 6, borderWidth: 1, borderColor: "#93C5FD", backgroundColor: BRAND.white },
  fieldingPresetCode: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  fieldingPresetDetail: { width: "100%", color: BRAND.muted, fontSize: 6.5, fontWeight: "800", textAlign: "center" },
  fieldingSymbolNumberRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  fieldingSymbolButton: { width: 36, minHeight: 33, alignItems: "center", justifyContent: "center", gap: 1, backgroundColor: BRAND.white, borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 6 },
  fieldingSymbolCode: { color: BRAND.navy, fontSize: 12, fontWeight: "900" },
  fieldingSymbolLabel: { color: BRAND.muted, fontSize: 7, fontWeight: "800" },
  fieldingSymbolActionRow: { flexDirection: "row", gap: 4 },
  fieldingSymbolAction: { flex: 1, minHeight: 32, alignItems: "center", justifyContent: "center", gap: 1, backgroundColor: BRAND.white, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 6 },
  fieldingSymbolBaseTouchAction: { backgroundColor: "#FFF7E8", borderColor: "#F59E0B" },
  fieldingSymbolErrorAction: { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" },
  fieldingSymbolActionDisabled: { opacity: 0.4 },
  fieldingSymbolActionCode: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  fieldingSymbolActionLabel: { color: BRAND.muted, fontSize: 7, fontWeight: "800" },
  fieldingPlayChoices: { flexDirection: "row", gap: 5 },
  fieldingPlayChoice: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", gap: 1, borderRadius: 6, backgroundColor: BRAND.white, borderWidth: 1, borderColor: "#CBD5E1" },
  fieldingPlayChoiceActive: { backgroundColor: "#D1FAE5", borderColor: BRAND.green },
  fieldingPlayChoiceCode: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  fieldingPlayChoiceCodeActive: { color: BRAND.green },
  fieldingPlayChoiceDetail: { color: BRAND.muted, fontSize: 7, fontWeight: "800" },
  fieldingPlayChoiceDetailActive: { color: BRAND.green },
  recordColumnRbiRow: { flexDirection: "row", gap: 4 },
  recordColumnRbiButton: { flex: 1, height: 30, alignItems: "center", justifyContent: "center", backgroundColor: BRAND.white, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 6 },
  recordColumnRbiButtonActive: { backgroundColor: "#FEF3C7", borderColor: BRAND.yellow },
  recordColumnRbiText: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  recordColumnRbiTextActive: { color: "#92400E" },
  recordColumnModifier: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5 },
  recordColumnModifierActive: { backgroundColor: "#FEE2E2", borderColor: BRAND.red },
  recordColumnModifierText: { color: BRAND.navy, fontSize: 9, fontWeight: "900" },
  recordColumnModifierTextActive: { color: BRAND.red },
  battedBallWaitingCard: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 10, padding: 8, gap: 6 },
  battedBallWaitingTitle: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  battedBallWaitingHint: { color: BRAND.muted, fontSize: 9, lineHeight: 13, fontWeight: "700" },
  battedBallExceptionalButton: { alignSelf: "flex-start", minHeight: 34, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#93C5FD", borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
  battedBallExceptionalCode: { color: BRAND.blue, fontSize: 13, fontWeight: "900" },
  battedBallExceptionalLabel: { color: BRAND.navy, fontSize: 9, fontWeight: "900" },
  battedBallPitchLock: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF7ED", borderWidth: 1, borderColor: "#FDBA74", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
  battedBallPitchLockTitle: { color: "#9A3412", fontSize: 9, fontWeight: "900" },
  battedBallPitchLockHint: { color: BRAND.muted, flex: 1, fontSize: 8, lineHeight: 11, fontWeight: "700" },
  battedBallWorkflowCard: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#93C5FD", borderRadius: 10, padding: 8, gap: 7 },
  battedBallWorkflowHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  battedBallWorkflowTitle: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  battedBallWorkflowHint: { color: BRAND.muted, maxWidth: 360, fontSize: 8, lineHeight: 11, fontWeight: "700" },
  battedBallWorkflowPreview: { color: BRAND.green, maxWidth: 160, fontSize: 12, fontWeight: "900", textAlign: "right" },
  battedBallStepRow: { flexDirection: "row", gap: 4 },
  battedBallStepChip: { flex: 1, minWidth: 0, minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: BRAND.white, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 6, paddingHorizontal: 3, paddingVertical: 4 },
  battedBallStepChipActive: { backgroundColor: "#DBEAFE", borderColor: BRAND.blue },
  battedBallStepChipDone: { backgroundColor: "#D1FAE5", borderColor: BRAND.green },
  battedBallStepIndex: { color: BRAND.muted, fontSize: 9, fontWeight: "900" },
  battedBallStepIndexActive: { color: BRAND.navy },
  battedBallStepText: { color: BRAND.muted, fontSize: 8, fontWeight: "900", flexShrink: 1 },
  battedBallStepTextActive: { color: BRAND.navy },
  battedBallStage: { gap: 6 },
  battedBallStageTitle: { color: BRAND.blue, fontSize: 10, fontWeight: "900" },
  battedBallStageHint: { color: BRAND.muted, fontSize: 8, lineHeight: 11, fontWeight: "700" },
  sacrificeButtonRow: { flexDirection: "row", gap: 6 },
  sacrificeBuntButton: { minHeight: 38, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 7, borderWidth: 1, borderColor: "#F59E0B", backgroundColor: "#FFFBEB", paddingHorizontal: 9, paddingVertical: 5 },
  sacrificeBuntButtonActive: { borderColor: "#B45309", backgroundColor: "#FEF3C7", borderWidth: 2 },
  sacrificeBuntCode: { color: "#B45309", fontSize: 12, fontWeight: "900" },
  sacrificeBuntCodeActive: { color: "#92400E" },
  sacrificeBuntLabel: { color: BRAND.navy, fontSize: 9, fontWeight: "900" },
  sacrificeBuntLabelActive: { color: "#92400E" },
  sacrificeBuntHint: { color: "#B45309", flexShrink: 1, fontSize: 8, fontWeight: "800", textAlign: "right" },
  sacrificeBuntHintActive: { color: "#92400E" },
  sacrificeBuntPreview: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 7, borderWidth: 1, borderColor: "#FCD34D", backgroundColor: "#FFFBEB", paddingHorizontal: 7, paddingVertical: 5 },
  sacrificeBuntPreviewTitle: { color: "#92400E", fontSize: 8, fontWeight: "900" },
  sacrificeBuntPreviewText: { color: "#92400E", flex: 1, fontSize: 8, lineHeight: 11, fontWeight: "700" },
  sacrificeFlyWarningBanner: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 7, borderWidth: 1, borderColor: "#F59E0B", backgroundColor: "#FFF7ED", paddingHorizontal: 7, paddingVertical: 6 },
  sacrificeFlyWarningCopy: { flex: 1, minWidth: 0, gap: 1 },
  sacrificeFlyWarningTitle: { color: "#9A3412", fontSize: 9, fontWeight: "900" },
  sacrificeFlyWarningText: { color: "#9A3412", fontSize: 8, lineHeight: 11, fontWeight: "700" },
  sacrificeFlyWarningActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  sacrificeFlyFieldingPanel: { gap: 5, borderRadius: 7, borderWidth: 1, borderColor: "#93C5FD", backgroundColor: "#EFF6FF", paddingHorizontal: 7, paddingVertical: 6 },
  sacrificeFlyFieldingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  sacrificeFlyFieldingTitle: { color: "#1D4ED8", fontSize: 9, fontWeight: "900" },
  sacrificeFlyFieldingHint: { color: "#1E40AF", flex: 1, fontSize: 8, lineHeight: 11, fontWeight: "700", textAlign: "right" },
  sacrificeFlyOutfieldRow: { flexDirection: "row", gap: 5 },
  sacrificeFlyOutfieldButton: { alignItems: "center", justifyContent: "center", minWidth: 48, borderRadius: 6, borderWidth: 1, borderColor: "#BFDBFE", backgroundColor: BRAND.paper, paddingHorizontal: 8, paddingVertical: 4 },
  sacrificeFlyOutfieldButtonActive: { borderColor: "#2563EB", backgroundColor: "#2563EB" },
  sacrificeFlyOutfieldCode: { color: "#1D4ED8", fontSize: 12, fontWeight: "900" },
  sacrificeFlyOutfieldCodeActive: { color: BRAND.paper },
  sacrificeFlyOutfieldLabel: { color: "#1E40AF", fontSize: 8, fontWeight: "800" },
  sacrificeFlyOutfieldLabelActive: { color: "#DBEAFE" },
  sacrificeFlyReasonPanel: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 7, borderWidth: 1, borderColor: "#FED7AA", backgroundColor: "#FFF7ED", paddingHorizontal: 7, paddingVertical: 5 },
  sacrificeFlyReasonTitle: { color: "#9A3412", fontSize: 8, fontWeight: "900" },
  sacrificeFlyReasonRow: { gap: 4, paddingRight: 2 },
  sacrificeFlyReasonButton: { minHeight: 26, justifyContent: "center", borderRadius: 6, borderWidth: 1, borderColor: "#FDBA74", backgroundColor: BRAND.white, paddingHorizontal: 7, paddingVertical: 3 },
  sacrificeFlyReasonButtonActive: { borderColor: "#C2410C", backgroundColor: "#F97316" },
  sacrificeFlyReasonText: { color: "#9A3412", fontSize: 8, fontWeight: "800" },
  sacrificeFlyReasonTextActive: { color: BRAND.white },
  battedBallFieldingChoices: { gap: 5, paddingRight: 4 },
  battedBallFieldingChoice: { minWidth: 82, minHeight: 38, alignItems: "center", justifyContent: "center", gap: 1, backgroundColor: BRAND.white, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5 },
  battedBallFieldingChoiceActive: { backgroundColor: "#D1FAE5", borderColor: BRAND.green },
  battedBallFieldingChoiceCode: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  battedBallFieldingChoiceCodeActive: { color: BRAND.green },
  battedBallFieldingChoiceDetail: { color: BRAND.muted, fontSize: 7, fontWeight: "800" },
  battedBallFieldingChoiceDetailActive: { color: BRAND.green },
  battedBallCompletionRow: { flexDirection: "row", justifyContent: "flex-end", gap: 7 },
  pitchActionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 3, justifyContent: "space-between" },
  pitchActionButton: { minHeight: 35, flexBasis: "15.8%", minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, borderRadius: 7, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", paddingHorizontal: 3, paddingVertical: 2 },
  pitchActionButtonEmphasis: { backgroundColor: "#FFF7ED", borderColor: "#FDBA74" },
  pitchActionButtonSelected: { backgroundColor: "#DBEAFE", borderColor: BRAND.blue, borderWidth: 2 },
  pitchActionMark: { color: BRAND.red, fontSize: 14, lineHeight: 16, fontWeight: "900" },
  pitchActionText: { color: BRAND.navy, fontSize: 8, lineHeight: 10, fontWeight: "900", flexShrink: 1 },
  liveMicroHint: { color: BRAND.muted, backgroundColor: "#F8FAFC", borderRadius: 7, padding: 7, fontSize: 9, lineHeight: 13 },
  resultButtonSelected: { backgroundColor: "#DBEAFE", borderColor: BRAND.blue, borderWidth: 2 },
  resultPreview: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F8FAFC", borderRadius: 10, padding: 8 },
  resultPreviewLabel: { color: BRAND.muted, fontSize: 9, fontWeight: "900" },
  resultPreviewValue: { color: BRAND.navy, flex: 1, fontSize: 18, fontWeight: "900" },
  quadrantUtilityRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  substitutionQuickRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  batterQueueSection: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, padding: 5, gap: 4 },
  batterQueueTitle: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  batterQueueRow: { flexDirection: "row", gap: 4 },
  batterQueueCard: { flex: 1, minWidth: 0, minHeight: 78, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: BRAND.white, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 7, padding: 4, gap: 4 },
  batterQueueIdentity: { flex: 1, minWidth: 0, gap: 2 },
  batterQueueOrder: { color: BRAND.blue, fontSize: 8, fontWeight: "900" },
  batterQueueName: { color: BRAND.navy, fontSize: 9, fontWeight: "900" },
  batterQueueCell: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 6, padding: 5, alignItems: "center", gap: 2 },
  batterQueueCellLabel: { color: BRAND.muted, fontSize: 7, fontWeight: "900" },
  batterQueueNotation: { color: BRAND.navy, fontSize: 12, fontWeight: "900" },
  batterQueueResult: { color: BRAND.blue, fontSize: 9, fontWeight: "900" },
  inningRailEmpty: { flex: 1, minHeight: 220, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 10, borderWidth: 1, borderColor: BRAND.line, padding: 14, gap: 5 },
  inningRailEmptyTitle: { color: BRAND.navy, fontSize: 12, fontWeight: "900", textAlign: "center" },
  inningRailEmptyText: { color: BRAND.muted, fontSize: 10, lineHeight: 14, textAlign: "center" },
  inningRailList: { gap: 4 },
  inningRailItem: { flexDirection: "row", gap: 4, alignItems: "stretch" },
  inningRailIndex: { width: 18, justifyContent: "center", alignItems: "center", backgroundColor: BRAND.navy, borderRadius: 9 },
  inningRailIndexText: { color: BRAND.white, fontSize: 9, fontWeight: "900" },
  inningRailCell: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 7, backgroundColor: "#F8FBFF", padding: 4, gap: 2 },
  inningRailPlayer: { color: BRAND.navy, fontSize: 9, fontWeight: "900" },
  inningRailScoreCell: { flexDirection: "row", minHeight: 75 },
  inningRailPitchColumn: { width: 45, justifyContent: "center", alignItems: "center", borderRightWidth: 1, borderColor: "#CBD5E1", paddingRight: 4, gap: 3 },
  inningRailPitchMarks: { color: BRAND.blue, fontSize: 9, fontWeight: "900", textAlign: "center" },
  inningRailOuter: { flex: 1, marginLeft: 6, borderWidth: 1, borderColor: "#94A3B8", borderRadius: 6, padding: 4, justifyContent: "center", alignItems: "center", gap: 3 },
  inningRailNotation: { color: BRAND.navy, fontSize: 12, fontWeight: "900" },
  inningRailInner: { borderWidth: 1, borderColor: BRAND.blue, backgroundColor: "#EFF6FF", borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, alignItems: "center" },
  inningRailResult: { color: BRAND.blue, fontSize: 10, fontWeight: "900" },
  heatmapCard: { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 16, padding: 13, gap: 10 },
  heatmapHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  heatmapTitle: { color: BRAND.navy, fontSize: 14, fontWeight: "900" },
  heatmapHint: { color: BRAND.muted, fontSize: 10, marginTop: 3, lineHeight: 14, maxWidth: 255 },
  heatmapBadge: { backgroundColor: BRAND.navy, color: BRAND.white, fontSize: 10, fontWeight: "900", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  heatmapFilterRow: { flexDirection: "row", gap: 7 },
  heatmapFilterButton: { flex: 1, minHeight: 40, justifyContent: "center", alignItems: "center", borderRadius: 9, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: BRAND.line },
  heatmapFilterButtonActive: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  heatmapFilterText: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  heatmapFilterTextActive: { color: BRAND.white },
  advancedHeatmapFilters: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, padding: 9, gap: 6 },
  advancedHeatmapLabel: { color: BRAND.navy, fontSize: 10, fontWeight: "900", marginTop: 1 },
  advancedHeatmapChoiceRow: { flexDirection: "row", gap: 7, paddingRight: 8 },
  advancedHeatmapChoice: { minHeight: 34, justifyContent: "center", alignItems: "center", backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, paddingHorizontal: 10 },
  advancedHeatmapChoiceActive: { backgroundColor: "#DBEAFE", borderColor: BRAND.blue },
  advancedHeatmapChoiceText: { color: BRAND.muted, fontSize: 10, fontWeight: "800" },
  advancedHeatmapChoiceTextActive: { color: BRAND.navy },
  statsScopeCard: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 10, gap: 7 },
  statsScopeLabel: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  statsScopeChoices: { flexDirection: "row", gap: 8 },
  statsScopeChoice: { flex: 1, minHeight: 38, backgroundColor: BRAND.white, borderRadius: 9, borderWidth: 1, borderColor: BRAND.line, justifyContent: "center", alignItems: "center" },
  statsScopeChoiceActive: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  statsScopeChoiceText: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  statsScopeChoiceTextActive: { color: BRAND.white },
  statsScopeHint: { color: BRAND.muted, fontSize: 10, lineHeight: 14 },
  periodCard: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 10, gap: 7 },
  periodTitle: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  periodHint: { color: BRAND.muted, fontSize: 10, lineHeight: 14 },
  periodChoices: { flexDirection: "row", gap: 7, paddingRight: 8 },
  periodChoice: { minHeight: 34, justifyContent: "center", alignItems: "center", backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, paddingHorizontal: 10 },
  periodChoiceActive: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  periodChoiceText: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  periodChoiceTextActive: { color: BRAND.white },
  periodDateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  periodDateInput: { flex: 1, minWidth: 110, color: BRAND.navy, fontSize: 10, fontWeight: "800", backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 7 },
  periodDateDivider: { color: BRAND.muted, fontSize: 10, fontWeight: "900" },
  periodResult: { color: BRAND.blue, fontSize: 10, fontWeight: "900", backgroundColor: "#EFF6FF", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6 },
  heatmapSummary: { color: BRAND.muted, fontSize: 10, backgroundColor: "#F8FAFC", padding: 8, borderRadius: 8 },
  heatmapPanels: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  heatmapPanel: { flexGrow: 1, flexBasis: 210, minWidth: 150, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 9, borderWidth: 1, borderColor: BRAND.line },
  heatmapPanelTitle: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  heatmapPanelHint: { color: BRAND.muted, fontSize: 9, marginTop: 2, marginBottom: 7 },
  heatmapMatrix: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  heatmapCell: { width: "30.4%", aspectRatio: 1, borderRadius: 6, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  heatmapEmpty: { backgroundColor: BRAND.white, borderColor: "#E2E8F0" },
  heatmapPitchLow: { backgroundColor: "#DBEAFE", borderColor: "#93C5FD" },
  heatmapPitchMedium: { backgroundColor: "#93C5FD", borderColor: "#3B82F6" },
  heatmapPitchHigh: { backgroundColor: "#2563EB", borderColor: "#1D4ED8" },
  heatmapHitLow: { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
  heatmapHitMedium: { backgroundColor: "#FCA5A5", borderColor: "#EF4444" },
  heatmapHitHigh: { backgroundColor: "#DC2626", borderColor: "#B91C1C" },
  heatmapZoneNumber: { color: BRAND.navy, fontSize: 9, fontWeight: "900" },
  heatmapZoneCount: { color: BRAND.ink, fontSize: 14, fontWeight: "900", marginTop: 1 },
  heatmapPanelTotal: { color: BRAND.muted, fontSize: 9, marginTop: 7, textAlign: "right" },
  statsLandscapeControls: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch", gap: 10 },
  statsModePanel: { flexGrow: 1, flexBasis: 230, minWidth: 210, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 10, gap: 8 },
  statsParameterPanel: { flexGrow: 2, flexBasis: 380, minWidth: 300, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 10, gap: 8 },
  statsScopePanel: { flexGrow: 1, flexBasis: 190, minWidth: 180, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 10, gap: 8 },
  statsControlLabel: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  statsModeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  statsModeChoice: { minWidth: 88, flexGrow: 1, minHeight: 36, justifyContent: "center", alignItems: "center", backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, paddingHorizontal: 9 },
  statsModeChoiceActive: { backgroundColor: BRAND.navy, borderColor: BRAND.navy },
  statsModeChoiceText: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  statsModeChoiceTextActive: { color: BRAND.white },
  statsModeHint: { color: BRAND.muted, fontSize: 10, lineHeight: 14 },
  statsCompactChoices: { flexDirection: "row", gap: 7, paddingRight: 8 },
  statsCompactChoice: { maxWidth: 190, minHeight: 36, justifyContent: "center", backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, paddingHorizontal: 10 },
  statsCompactChoiceActive: { backgroundColor: "#DBEAFE", borderColor: BRAND.blue },
  statsCompactChoiceText: { color: BRAND.navy, fontSize: 10, fontWeight: "900" },
  statsCompactChoiceTextActive: { color: BRAND.navy },
  statsInputRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statsRangeInput: { flex: 1, minWidth: 120, color: BRAND.navy, fontSize: 11, fontWeight: "800", backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: BRAND.line, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 8 },
  statsRangeDivider: { color: BRAND.muted, fontSize: 11, fontWeight: "900" },
  statsResultBadge: { alignSelf: "flex-start", color: BRAND.blue, fontSize: 10, fontWeight: "900", backgroundColor: "#EFF6FF", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 6 },
  statsEmptyHint: { color: BRAND.muted, fontSize: 10, lineHeight: 14 },
  statsPreviewHint: { color: BRAND.muted, fontSize: 10, lineHeight: 14, backgroundColor: "#F8FAFC", borderRadius: 8, padding: 9 },
  importedSummaryCard: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 14, padding: 12, gap: 10 },
  importedSummaryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  importedSummaryEyebrow: { color: BRAND.blue, fontSize: 9, letterSpacing: 0.8, fontWeight: "900" },
  importedSummaryTitle: { color: BRAND.navy, fontSize: 15, fontWeight: "900", marginTop: 2 },
  importedSummaryBadge: { color: BRAND.white, backgroundColor: BRAND.blue, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: "900" },
  importedSummaryHint: { color: BRAND.muted, fontSize: 10, lineHeight: 14 },
  importedSummaryStrip: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  importedSummaryColumns: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  importedSummaryColumn: { flexGrow: 1, flexBasis: 360, minWidth: 300, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 10, padding: 9, gap: 8 },
  importedSummaryColumnTitle: { color: BRAND.navy, fontSize: 12, fontWeight: "900" },
  importedTableRow: { flexDirection: "row", minHeight: 29, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", alignItems: "center" },
  importedTableCell: { width: 60, color: BRAND.ink, fontSize: 10, textAlign: "center", paddingHorizontal: 4 },
  importedPlayerCell: { width: 104, textAlign: "left", fontWeight: "800" },
  importedPitcherRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 35, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  importedPitcherName: { flexShrink: 1, color: BRAND.ink, fontSize: 11, fontWeight: "900" },
  importedPitcherStats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 7 },
  importedPitcherStat: { color: BRAND.navy, fontSize: 10, fontWeight: "800" },
  importedPitcherNote: { color: BRAND.muted, fontSize: 9, lineHeight: 13, marginTop: 2 },
  pitchLimitStrip: { minHeight: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 4, marginTop: 1 },
  pitchLimitCalm: { backgroundColor: "#EAF3FB", borderWidth: 1, borderColor: "#BFDBFE" },
  pitchLimitYellow: { backgroundColor: "#FEF3C7", borderWidth: 1, borderColor: "#FBBF24" },
  pitchLimitOrange: { backgroundColor: "#FFEDD5", borderWidth: 1, borderColor: "#FB923C" },
  pitchLimitRed: { backgroundColor: BRAND.red, borderWidth: 1, borderColor: "#9F2430" },
  pitchLimitPulse: { opacity: 0.62 },
  pitchLimitText: { flexShrink: 1, color: BRAND.navy, fontSize: 9, fontWeight: "900" },
  pitchLimitTextOnRed: { flexShrink: 1, color: BRAND.white, fontSize: 9, fontWeight: "900" },
  pitcherHistoryStrip: { flexDirection: "row", gap: 4, marginTop: 2, overflow: "hidden" },
  pitcherHistoryChip: { flexShrink: 1, color: BRAND.muted, fontSize: 8, fontWeight: "800", backgroundColor: "#F1F5F9", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 3 },
  pitcherHistoryChipCurrent: { color: BRAND.navy, backgroundColor: "#DBEAFE" },
  teamLogoNameRow: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
  teamLogoNameRowRight: { flexDirection: "row-reverse", justifyContent: "flex-start" },
  teamLogoNameText: { flexShrink: 1 },
  teamLogoFallback: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  teamLogoFallbackText: { color: BRAND.navy, fontWeight: "900" },
  recordCorrectionSheet: { maxWidth: 680, maxHeight: "88%", borderWidth: 1 },
  recordCorrectionHeaderCopy: { flex: 1, minWidth: 0 },
  recordCorrectionHeaderButton: { minHeight: 34, justifyContent: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 10 },
  recordCorrectionHeaderButtonText: { fontSize: 11, fontWeight: "900" },
  recordCorrectionScrollContent: { gap: 10, paddingBottom: 4 },
  recordCorrectionSafetyNote: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  recordCorrectionLockNote: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 4 },
  recordCorrectionSafetyTitle: { fontSize: 11, fontWeight: "900" },
  recordCorrectionSafetyText: { fontSize: 10, lineHeight: 15 },
  recordCorrectionFooter: { gap: 8 },
  recordCorrectionStepHint: { fontSize: 11, lineHeight: 16 },
  recordCorrectionChoiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  recordCorrectionChoice: { flexGrow: 1, flexBasis: 160, minWidth: 146, minHeight: 74, borderWidth: 1, borderRadius: 10, padding: 9, gap: 3 },
  recordCorrectionChoiceTitle: { fontSize: 12, fontWeight: "900" },
  recordCorrectionChoiceHint: { fontSize: 9, lineHeight: 13 },
  recordCorrectionCurrentValue: { fontSize: 10, fontWeight: "900", marginTop: 2 },
  recordCorrectionSymbolMark: { fontSize: 18, fontWeight: "900" },
  recordCorrectionInput: { minHeight: 42 },
  teamBrandingCard: { backgroundColor: BRAND.paper, borderWidth: 1, borderColor: BRAND.line, borderRadius: 12, padding: 9, gap: 7 },
  teamBrandingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  teamBrandingCopy: { flex: 1, minWidth: 0, gap: 2 },
  teamBrandingTitle: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
  teamBrandingHint: { color: BRAND.muted, fontSize: 8, lineHeight: 11, maxWidth: 255, marginTop: 1 },
  teamBrandingPreview: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BRAND.line },
  teamLogoPreview: { width: 52, height: 52, borderRadius: 11, borderWidth: 1, borderColor: BRAND.line },
  teamBrandingPreviewText: { color: BRAND.navy, fontSize: 15, fontWeight: "900" },
  teamBrandingControls: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  teamColorRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
  teamPaletteHintRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  teamPaletteHint: { color: BRAND.navy, fontSize: 9, fontWeight: "900" },
  teamPaletteContrast: { color: BRAND.muted, fontSize: 8, fontWeight: "800" },
  teamPaletteOption: { minHeight: 25, flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 7, paddingHorizontal: 5, backgroundColor: BRAND.white },
  teamPaletteOptionActive: { borderWidth: 2, shadowColor: BRAND.navy, shadowOpacity: 0.12, shadowRadius: 3, elevation: 1 },
  teamPaletteOptionText: { color: BRAND.navy, fontSize: 8, fontWeight: "900" },
  teamColorSwatch: { width: 21, height: 21, borderRadius: 6, borderWidth: 1, borderColor: "rgba(16,36,62,0.18)" },
  teamColorSwatchActive: { borderWidth: 3, borderColor: BRAND.navy },
  teamColorInput: { width: 76, height: 25, borderWidth: 1, borderColor: BRAND.line, borderRadius: 6, paddingHorizontal: 6, color: BRAND.navy, fontSize: 10, fontWeight: "800", backgroundColor: BRAND.white },
  teamColorReset: { paddingHorizontal: 7, paddingVertical: 5, backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.line, borderRadius: 6 },
  teamColorResetText: { color: BRAND.muted, fontSize: 9, fontWeight: "900" },
  liveTeamIdentityRow: { flexDirection: "row", gap: 7, marginBottom: 6 },
  liveTeamIdentityCard: { flex: 1, minWidth: 0, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5, gap: 2 },
  liveTeamIdentityCardHome: { alignItems: "flex-end" },
  liveTeamIdentitySide: { color: BRAND.muted, fontSize: 8, fontWeight: "900" },
  liveTeamIdentityName: { color: BRAND.navy, fontSize: 11, fontWeight: "900" },
});

export default App;
