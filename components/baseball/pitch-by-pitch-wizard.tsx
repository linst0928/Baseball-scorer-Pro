import React, { useState, useMemo } from "react";
import { StyleSheet, Text, View, Pressable, ScrollView } from "react-native";
import type { Game, PitchState, RecordColumn, AtBatResult, PitchOutcome, Player } from "@/lib/baseball/types";
import { useScoringHistory, type GameSnapshot } from "@/lib/baseball/scoring-history-reducer";
import { buildStrictRunnerQueue, resolveForcedAdvances, checkTimePlayCondition } from "@/lib/baseball/runner-engine";

export type PitchByPitchWizardProps = {
  initialSnapshot: GameSnapshot;
  battingPlayers: Player[];
  onFinishAtBat: (finalSnapshot: GameSnapshot) => void;
  onCancel: () => void;
};

export function PitchByPitchWizard({
  initialSnapshot,
  battingPlayers,
  onFinishAtBat,
  onCancel,
}: PitchByPitchWizardProps) {
  // 1. 綁定強固的快照 Undo/Redo 歷史管理器
  const {
    present,
    pushSnapshot,
    undo,
    canUndo,
  } = useScoringHistory(initialSnapshot);

  // 2. 本地狀態管理 (Step-by-Step 暫存器)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [currentPitchOutcome, setCurrentPitchOutcome] = useState<PitchOutcome | null>(null);
  const [battedBallType, setBattedBallType] = useState<"fly" | "ground" | "line" | "bunt" | "">("");
  const [battedBallPosition, setBattedBallPosition] = useState<number | null>(null); // 1-9
  const [atBatResult, setAtBatResult] = useState<AtBatResult | null>(null);

  // 跑者佇列處理暫存
  const [runnerQueue, setRunnerQueue] = useState<Array<{ base: 3 | 2 | 1; runnerId: string }>>([]);
  const [runnerQueueIndex, setRunnerQueueIndex] = useState<number>(0);
  const [tempRunners, setTempRunners] = useState<Game["runners"]>({ ...present.game.runners });
  const [tempOuts, setTempOuts] = useState<number>(present.game.outs);
  const [requireTimePlay, setRequireTimePlay] = useState<boolean>(false);

  // 當前正在清算的跑者
  const currentResolvingRunner = useMemo(() => {
    return runnerQueue[runnerQueueIndex] || null;
  }, [runnerQueue, runnerQueueIndex]);

  // 取得當前打者名稱
  const currentBatterName = useMemo(() => {
    const batterId = present.game.half === "away"
      ? present.game.homeRegisteredPlayerIds?.[present.game.awayBatterIndex]
      : present.game.awayRegisteredPlayerIds?.[present.game.homeBatterIndex];
    const player = battingPlayers.find((p) => p.id === batterId);
    return player ? `#${player.number} ${player.name}` : "未知打者";
  }, [present, battingPlayers]);

  // --- Step 1 處理方法 ---
  const handlePitchOutcome = (outcome: PitchOutcome) => {
    setCurrentPitchOutcome(outcome);

    if (outcome === "inPlay" || outcome === "bunt") {
      // 進入 Step 2 擊球判定
      setStep(2);
    } else {
      // 純投球紀錄 (好球、壞球、界外等)
      // 若達 3 好球 (K) 或 4 壞球 (BB) -> 觸發結果並進入清算階段
      const newStrikes = outcome === "strike" || outcome === "swingingStrike" ? present.pitchDraft.strikes + 1 : present.pitchDraft.strikes;
      const newBalls = outcome === "ball" ? present.pitchDraft.balls + 1 : present.pitchDraft.balls;

      if (newBalls >= 4) {
        setAtBatResult("BB");
        startRunnerClearing("BB");
      } else if (newStrikes >= 3) {
        setAtBatResult("K");
        setTempOuts((o) => o + 1);
        startRunnerClearing("K");
      } else {
        // 純球數累積，單球快照寫入
        const updatedPitchDraft: PitchState = {
          ...present.pitchDraft,
          balls: newBalls,
          strikes: newStrikes,
          total: present.pitchDraft.total + 1,
          locations: [
            ...(present.pitchDraft.locations || []),
            { zone: 5, type: "fastball", outcome },
          ],
        };
        const nextSnapshot: GameSnapshot = {
          ...present,
          pitchDraft: updatedPitchDraft,
          timestamp: new Date().toISOString(),
        };
        pushSnapshot(nextSnapshot);
        // 重置選取的投球並維持在 Step 1
        setCurrentPitchOutcome(null);
      }
    }
  };

  // --- Step 2 處理方法 ---
  const handleBattedBallCommit = (result: AtBatResult) => {
    setAtBatResult(result);
    if (result === "E" || result === "G") {
      setTempOuts((o) => o + 1);
    }
    startRunnerClearing(result);
  };

  // --- Step 3 跑者清算啟動器 (整合階段三引擎) ---
  const startRunnerClearing = (result: AtBatResult) => {
    const isWalk = result === "BB" || result === "HBP";
    const batterId = present.game.half === "away"
      ? present.game.awayRegisteredPlayerIds?.[present.game.awayBatterIndex]
      : present.game.homeRegisteredPlayerIds?.[present.game.homeBatterIndex];
    
    if (isWalk && batterId) {
      // Poka-yoke: 僅四壞/觸身保送自動推進判定，安打絕不自動推進原壘上跑者
      const { runners: resolvedRunners } = resolveForcedAdvances(present.game.runners, batterId);
      setTempRunners(resolvedRunners);
      // 保送不增加出局數，直接前進至 Step 4 預覽確認
      setStep(4);
    } else {
      // 壘上有人非自動推進 -> 建構 3B -> 2B -> 1B 嚴格清算佇列
      const queue = buildStrictRunnerQueue(present.game.runners);
      if (queue.length > 0) {
        setRunnerQueue(queue);
        setRunnerQueueIndex(0);
        setTempRunners({ ...present.game.runners });
        setStep(3);
      } else {
        // 壘上無人直接進入 Step 4
        setStep(4);
      }
    }
  };

  // --- Step 3 跑者抉擇卡片事件 ---
  const resolveRunnerAction = (action: "ADVANCE" | "SCORE" | "OUT" | "HOLD", targetBase?: 2 | 3 | 4) => {
    if (!currentResolvingRunner) return;

    let nextOuts = tempOuts;
    const currentBase = currentResolvingRunner.base;
    const runnerId = currentResolvingRunner.runnerId;

    const newRunners = { ...tempRunners };

    if (action === "HOLD") {
      // 嚴格確保跑者停留在原壘 (toBase 等於 fromBase)，絕不自動 +1 進壘
      newRunners[getBaseKey(currentBase)] = runnerId;
    } else if (action === "OUT") {
      // 跑者出局
      nextOuts += 1;
      setTempOuts(nextOuts);
      newRunners[getBaseKey(currentBase)] = null;

      // 階段三防呆：第 3 出局與 Time Play 判定
      const timePlayCheck = checkTimePlayCondition({
        result: atBatResult || "SPECIAL_OUT",
        baseOfOut: (targetBase || currentBase) as 1 | 2 | 3 | 4,
        runnersBefore: present.game.runners,
        outsBefore: tempOuts,
      });

      if (nextOuts >= 3) {
        if (timePlayCheck.requireTimePlayConfirmation) {
          setRequireTimePlay(true);
        }
        // Poka-yoke: 一旦 3 出局，立即硬截斷後續跑者清算，直接進入結算
        setStep(4);
        return;
      }
    } else if (action === "SCORE") {
      // 得分
      newRunners[getBaseKey(currentBase)] = null;
    } else if (action === "ADVANCE" && targetBase) {
      // 推進
      newRunners[getBaseKey(currentBase)] = null;
      newRunners[getBaseKey(targetBase as 1 | 2 | 3)] = runnerId;
    }

    setTempRunners(newRunners);

    // 前進下一個跑者
    if (runnerQueueIndex + 1 < runnerQueue.length && nextOuts < 3) {
      setRunnerQueueIndex((prev) => prev + 1);
    } else {
      // 全員清算完畢或已滿 3 出局
      setStep(4);
    }
  };

  const getBaseKey = (base: 1 | 2 | 3): "first" | "second" | "third" => {
    return base === 1 ? "first" : base === 2 ? "second" : "third";
  };

  // --- Step 4 最終寫入 ---
  const handleFinalCommit = () => {
    const finalRecordColumn: RecordColumn = {
      ...present.recordColumnDraft,
      trajectory: (battedBallType && battedBallType !== "bunt") ? (battedBallType as RecordColumn["trajectory"]) : undefined,
      battedBallPosition: battedBallPosition ? String(battedBallPosition) : undefined,
      rbi: atBatResult === "BB" && present.game.runners.first && present.game.runners.second && present.game.runners.third ? 1 : 0,
    };

    const batterId = present.game.half === "away"
      ? present.game.awayRegisteredPlayerIds?.[present.game.awayBatterIndex]
      : present.game.homeRegisteredPlayerIds?.[present.game.homeBatterIndex];

    const nextRunnersWithBatter = { ...tempRunners };
    // 安打、失誤、保送與特殊上壘決定打者到達哪一壘，原壘上跑者已在 Step 3 循序處理
    if (tempOuts < 3 && batterId) {
      const isFielderChoice = atBatResult === "G" && (battedBallType === "ground" || finalRecordColumn.fieldingPlay === "FC");
      const isDroppedThirdStrike = atBatResult === "K" && Boolean(finalRecordColumn.modifiers?.includes("K+"));
      
      if (atBatResult === "1B" || atBatResult === "E" || atBatResult === "BB" || atBatResult === "HBP" || isFielderChoice || isDroppedThirdStrike) {
        nextRunnersWithBatter.first = batterId;
      } else if (atBatResult === "2B") {
        nextRunnersWithBatter.second = batterId;
      } else if (atBatResult === "3B") {
        nextRunnersWithBatter.third = batterId;
      }
    }

    const finalGame: Game = {
      ...present.game,
      runners: tempOuts >= 3 ? { first: null, second: null, third: null } : nextRunnersWithBatter,
      outs: tempOuts >= 3 ? 0 : tempOuts,
      inning: tempOuts >= 3 ? present.game.inning + (present.game.half === "home" ? 1 : 0) : present.game.inning,
      half: tempOuts >= 3 ? (present.game.half === "away" ? "home" : "away") : present.game.half,
    };

    const finalSnapshot: GameSnapshot = {
      game: finalGame,
      pitchDraft: { balls: 0, strikes: 0, total: 0, locations: [] },
      selectedResult: atBatResult,
      fieldingPosition: String(battedBallPosition || 1),
      recordColumnDraft: finalRecordColumn,
      timestamp: new Date().toISOString(),
    };

    onFinishAtBat(finalSnapshot);
  };

  return (
    <View style={styles.container}>
      {/* 頂部全域功能區 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>逐球現場紀錄流程精靈</Text>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="回復上一球"
            disabled={!canUndo}
            onPress={undo}
            style={[styles.undoButton, !canUndo && styles.disabledButton]}
          >
            <Text style={styles.undoText}>↺ 回復上一球 (Undo)</Text>
          </Pressable>
          <Pressable onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>離開</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.wizardCard}>
        {/* 打席 Matchup 快照 */}
        <View style={styles.matchupRow}>
          <Text style={styles.matchupText}>
            當前對決：{currentBatterName} (第 {present.game.inning} 局 {present.game.half === "away" ? "上" : "下"} · {tempOuts} 出局)
          </Text>
          <Text style={styles.countText}>
            球數：{present.pitchDraft.balls}B - {present.pitchDraft.strikes}S (本打席第 {present.pitchDraft.total + 1} 球)
          </Text>
        </View>

        {/* Step 1: 投球與前置過濾卡片 */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>【第一階段：投球結果與前置過濾】</Text>
            <Text style={styles.cardHint}>請依據主審改判與實際投球結果進行點選：</Text>
            <View style={styles.buttonGrid}>
              <Pressable onPress={() => handlePitchOutcome("strike")} style={styles.gridButton}>
                <Text style={styles.buttonText}>好球 (Strike)</Text>
              </Pressable>
              <Pressable onPress={() => handlePitchOutcome("ball")} style={styles.gridButton}>
                <Text style={styles.buttonText}>壞球 (Ball)</Text>
              </Pressable>
              <Pressable onPress={() => handlePitchOutcome("foul")} style={styles.gridButton}>
                <Text style={styles.buttonText}>界外球 (Foul)</Text>
              </Pressable>
              <Pressable
                onPress={() => handlePitchOutcome("inPlay")}
                style={[styles.gridButton, styles.primaryButton]}
              >
                <Text style={styles.primaryButtonText}>打擊出去 (In-Play) •</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Step 2: 擊球結果判定卡片 */}
        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>【第二階段：擊球球性與方向落點】</Text>
            
            <Text style={styles.subLabel}>1. 選擇擊球球性：</Text>
            <View style={styles.rowGrid}>
              {(["fly", "ground", "line", "bunt"] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setBattedBallType(t)}
                  style={[styles.optionButton, battedBallType === t && styles.optionButtonActive]}
                >
                  <Text style={battedBallType === t ? styles.optionTextActive : styles.optionText}>
                    {t === "fly" ? "飛球" : t === "ground" ? "滾地" : t === "line" ? "平飛" : "觸擊"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.subLabel}>2. 選擇落點守備代號 (1-9)：</Text>
            <View style={styles.numberGrid}>
              {Array.from({ length: 9 }, (_, i) => i + 1).map((num) => (
                <Pressable
                  key={num}
                  onPress={() => setBattedBallPosition(num)}
                  style={[styles.numberButton, battedBallPosition === num && styles.numberButtonActive]}
                >
                  <Text style={battedBallPosition === num ? styles.numberTextActive : styles.numberText}>
                    {num} ({["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"][num - 1]})
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.subLabel}>3. 選擇擊球最終結果：</Text>
            <View style={styles.buttonGrid}>
              <Pressable onPress={() => handleBattedBallCommit("1B")} style={styles.gridButton}>
                <Text style={styles.buttonText}>安打 (Hit)</Text>
              </Pressable>
              <Pressable onPress={() => handleBattedBallCommit("G")} style={styles.gridButton}>
                <Text style={styles.buttonText}>刺殺出局 (GO)</Text>
              </Pressable>
              <Pressable onPress={() => handleBattedBallCommit("E")} style={styles.gridButton}>
                <Text style={styles.buttonText}>守備失誤 (Error)</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Step 3: 壘上跑者強制循序清算卡片 */}
        {step === 3 && currentResolvingRunner && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>【第三階段：壘上跑者強制進退壘清算】</Text>
            <View style={styles.runnerFocusCard}>
              <Text style={styles.runnerFocusTitle}>正在清算：{currentResolvingRunner.base} 壘跑者</Text>
              <Text style={styles.runnerFocusHint}>
                (依據 3壘 ➔ 2壘 ➔ 1壘 單向防呆佇列，當前為第 {runnerQueueIndex + 1}/{runnerQueue.length} 位跑者)
              </Text>

              <View style={styles.runnerActionRow}>
                <Pressable
                  onPress={() => resolveRunnerAction("HOLD")}
                  style={[styles.gridButton, styles.neutralButton]}
                >
                  <Text style={styles.neutralButtonText}>留在原壘包</Text>
                </Pressable>
                <Pressable
                  onPress={() => resolveRunnerAction("SCORE")}
                  style={[styles.gridButton, styles.successButton]}
                >
                  <Text style={styles.successButtonText}>推進回本壘得分</Text>
                </Pressable>
                <Pressable
                  onPress={() => resolveRunnerAction("OUT")}
                  style={[styles.gridButton, styles.dangerButton]}
                >
                  <Text style={styles.dangerButtonText}>出局 (Out)</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Step 4: 預覽確認與結算卡片 */}
        {step === 4 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>【第四階段：打席與半局結算預覽】</Text>
            
            {requireTimePlay && (
              <View style={styles.timePlayAlert}>
                <Text style={styles.timePlayAlertTitle}>⚠️ Time Play 得分確認需求</Text>
                <Text style={styles.timePlayAlertText}>
                  第三出局非封殺狀態下發生，請判定領先跑者回本壘是否早於該出局發生？
                </Text>
                <View style={styles.rowGrid}>
                  <Pressable onPress={() => setRequireTimePlay(false)} style={styles.timePlayConfirmBtn}>
                    <Text style={styles.timePlayConfirmText}>是，得分算數</Text>
                  </Pressable>
                  <Pressable onPress={() => setRequireTimePlay(false)} style={styles.timePlayDenyBtn}>
                    <Text style={styles.timePlayConfirmText}>否，得分不算</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <View style={styles.previewSummary}>
              <Text style={styles.previewTitle}>寫入狀態預覽：</Text>
              <Text style={styles.previewText}>· 擊球結果：{atBatResult || "純球數累積"}</Text>
              <Text style={styles.previewText}>· 累計出局：{tempOuts >= 3 ? "3 出局 (攻守交換)" : `${tempOuts} 出局`}</Text>
              <Text style={styles.previewText}>· 壘包狀態：{tempOuts >= 3 ? "空壘" : `一壘: ${tempRunners.first ? "有人" : "空"}, 二壘: ${tempRunners.second ? "有人" : "空"}, 三壘: ${tempRunners.third ? "有人" : "空"}`}</Text>
            </View>

            <Pressable onPress={handleFinalCommit} style={[styles.gridButton, styles.commitButton]}>
              <Text style={styles.commitButtonText}>確認並完成打席紀錄 ✓</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", padding: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", paddingBottom: 8, marginBottom: 12 },
  headerTitle: { fontSize: 16, fontWeight: "900", color: "#0F172A" },
  headerActions: { flexDirection: "row", gap: 8 },
  undoButton: { backgroundColor: "#FEF3C7", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: "#FBBF24" },
  disabledButton: { opacity: 0.5 },
  undoText: { color: "#92400E", fontSize: 11, fontWeight: "bold" },
  cancelButton: { backgroundColor: "#EF4444", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  cancelText: { color: "#FFF", fontSize: 11, fontWeight: "bold" },
  wizardCard: { flexGrow: 1, gap: 12 },
  matchupRow: { backgroundColor: "#EFF6FF", borderWidth: 1, borderColor: "#BFDBFE", borderRadius: 8, padding: 10 },
  matchupText: { fontSize: 12, fontWeight: "700", color: "#1E40AF" },
  countText: { fontSize: 11, color: "#1D4ED8", marginTop: 2 },
  card: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 14, gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: "900", color: "#0F172A", marginBottom: 4 },
  cardHint: { fontSize: 11, color: "#64748B", marginBottom: 6 },
  buttonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  gridButton: { flexGrow: 1, flexBasis: "46%", minHeight: 44, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, justifyContent: "center", alignItems: "center", paddingHorizontal: 10 },
  buttonText: { fontSize: 12, color: "#334155", fontWeight: "700" },
  primaryButton: { backgroundColor: "#DBEAFE", borderColor: "#3B82F6" },
  primaryButtonText: { fontSize: 12, color: "#1D4ED8", fontWeight: "900" },
  subLabel: { fontSize: 12, fontWeight: "bold", color: "#334155", marginTop: 8 },
  rowGrid: { flexDirection: "row", gap: 6, marginTop: 4 },
  optionButton: { flex: 1, minHeight: 36, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 6, justifyContent: "center", alignItems: "center" },
  optionButtonActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  optionText: { fontSize: 11, color: "#475569" },
  optionTextActive: { fontSize: 11, color: "#FFF", fontWeight: "bold" },
  numberGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 4 },
  numberButton: { flexBasis: "31%", minHeight: 32, backgroundColor: "#F1F5F9", borderRadius: 6, justifyContent: "center", alignItems: "center" },
  numberButtonActive: { backgroundColor: "#1E3A8A" },
  numberText: { fontSize: 10, color: "#475569" },
  numberTextActive: { fontSize: 10, color: "#FFF", fontWeight: "bold" },
  runnerFocusCard: { backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FEF3C7", borderRadius: 8, padding: 12, gap: 8 },
  runnerFocusTitle: { fontSize: 13, fontWeight: "900", color: "#92400E" },
  runnerFocusHint: { fontSize: 10, color: "#B45309" },
  runnerActionRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  neutralButton: { backgroundColor: "#F8FAFC" },
  neutralButtonText: { color: "#475569", fontSize: 11, fontWeight: "bold" },
  successButton: { backgroundColor: "#DCFCE7", borderColor: "#86EFAC" },
  successButtonText: { color: "#166534", fontSize: 11, fontWeight: "bold" },
  dangerButton: { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" },
  dangerButtonText: { color: "#991B1B", fontSize: 11, fontWeight: "bold" },
  previewSummary: { backgroundColor: "#F8FAFC", borderRadius: 8, padding: 10, gap: 4 },
  previewTitle: { fontSize: 12, fontWeight: "bold", color: "#1E293B" },
  previewText: { fontSize: 11, color: "#475569" },
  commitButton: { backgroundColor: "#10B981", borderColor: "#10B981", minHeight: 48 },
  commitButtonText: { color: "#FFF", fontSize: 13, fontWeight: "900" },
  timePlayAlert: { backgroundColor: "#FFF5F5", borderWidth: 1, borderColor: "#FEB2B2", borderRadius: 8, padding: 10, gap: 6 },
  timePlayAlertTitle: { fontSize: 12, fontWeight: "900", color: "#C53030" },
  timePlayAlertText: { fontSize: 11, color: "#9B2C2C", lineHeight: 15 },
  timePlayConfirmBtn: { flex: 1, minHeight: 34, backgroundColor: "#E53E3E", borderRadius: 6, justifyContent: "center", alignItems: "center" },
  timePlayDenyBtn: { flex: 1, minHeight: 34, backgroundColor: "#718096", borderRadius: 6, justifyContent: "center", alignItems: "center" },
  timePlayConfirmText: { color: "#FFF", fontSize: 11, fontWeight: "bold" },
});
