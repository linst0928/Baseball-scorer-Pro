import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Animated,
} from "react-native";

import {
  type Game,
  type Team,
  type ScorebookBlankSlot,
  type AtBatEvent,
  type AtBatResult,
  type RecordTrajectory,
} from "@/lib/baseball/types";
import { type RunnerAdvanceContext } from "@/lib/baseball/waseda-visuals";
import { WasedaPersonalRecordCell } from "./waseda-personal-record-cell";
import { getRecordTrajectoryMark } from "@/lib/baseball/record-column-notation";

const BRAND = {
  primary: "#2563EB",
  secondary: "#64748B",
  muted: "#94A3B8",
};

function WizardButton({
  label,
  onPress,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        btnStyles.btn,
        variant === "secondary" ? btnStyles.btnSecondary : btnStyles.btnPrimary,
        pressed && btnStyles.btnPressed,
      ]}
    >
      <Text
        style={[
          btnStyles.btnText,
          variant === "secondary" ? btnStyles.btnTextSecondary : btnStyles.btnTextPrimary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const btnStyles = StyleSheet.create({
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: {
    backgroundColor: "#2563EB",
  },
  btnSecondary: {
    backgroundColor: "#E2E8F0",
  },
  btnPressed: {
    opacity: 0.8,
  },
  btnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  btnTextPrimary: {
    color: "#FFFFFF",
  },
  btnTextSecondary: {
    color: "#334155",
  },
});

const FIELD_POSITIONS = [
  { number: "1", label: "投手 (P)" },
  { number: "2", label: "捕手 (C)" },
  { number: "3", label: "一壘手 (1B)" },
  { number: "4", label: "二壘手 (2B)" },
  { number: "5", label: "三壘手 (3B)" },
  { number: "6", label: "游擊手 (SS)" },
  { number: "7", label: "左外野 (LF)" },
  { number: "8", label: "中外野 (CF)" },
  { number: "9", label: "右外野 (RF)" },
];

const RECORD_TRAJECTORIES: Array<{ id: RecordTrajectory; mark: string; label: string }> = [
  { id: "fly", mark: "︵", label: "飛球 (Fly)" },
  { id: "ground", mark: "︶", label: "滾地球 (Ground)" },
  { id: "line", mark: "＝", label: "平飛球 (Line)" },
  { id: "bounce", mark: "∿", label: "彈跳球 (Bounce)" },
];

export type WasedaCorrectionWizardModalProps = {
  visible: boolean;
  game: Game;
  away: Team;
  home: Team;
  slot: ScorebookBlankSlot | null;
  replacementTarget?: AtBatEvent | null;
  onClose: () => void;
  onSubmit: (slot: ScorebookBlankSlot, event: AtBatEvent, note?: string) => void;
  onReplace?: (target: AtBatEvent, event: AtBatEvent, note?: string) => void;
};

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export function WasedaCorrectionWizardModal({
  visible,
  game,
  away,
  home,
  slot,
  replacementTarget,
  onClose,
  onSubmit,
  onReplace,
}: WasedaCorrectionWizardModalProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // 人員選擇 state
  const [batterId, setBatterId] = useState("");
  const [pitcherId, setPitcherId] = useState("");

  // 步驟 1: 打擊事件 state
  const [trajectory, setTrajectory] = useState<RecordTrajectory | "">("");
  const [direction, setDirection] = useState("");
  const [result, setResult] = useState<AtBatResult>("1B");
  const [droppedThirdStrike, setDroppedThirdStrike] = useState(false);
  const [fieldingSequence, setFieldingSequence] = useState("");

  // 步驟 2: 跑壘事件 state
  const [runnerEventType, setRunnerEventType] = useState<
    "" | "SB" | "CS" | "ADVANCE" | "WP" | "PB" | "BK" | "PO"
  >("");
  const [runnerBaseFrom, setRunnerBaseFrom] = useState<1 | 2 | 3>(1);
  const [runnerBaseTo, setRunnerBaseTo] = useState<2 | 3 | 4>(2);

  // 步驟 3: 得分設定 state
  const [runsScored, setRunsScored] = useState<number>(0);
  const [isUnearned, setIsUnearned] = useState<boolean>(false);
  const [rbi, setRbi] = useState<number>(0);

  // 步驟 4: 殘壘 / 出局結算 state
  const [outMark, setOutMark] = useState<"" | "Ⅰ" | "Ⅱ" | "Ⅲ">("");
  const [isLOB, setIsLOB] = useState<boolean>(false);

  // 步驟 5: 備註
  const [note, setNote] = useState("");

  const [stepFade] = useState(() => new Animated.Value(1));

  const battingTeam = slot?.side === "away" ? away : home;
  const pitchingTeam = slot?.side === "away" ? home : away;
  const isReplacement = Boolean(replacementTarget);

  // 1. 人員對象主動建議：開啟精靈時自動帶入
  useEffect(() => {
    if (!visible || !slot) return;
    setCurrentStep(1);

    // 打者自動帶入
    let suggestedBatter = "";
    if (replacementTarget?.batterId) {
      suggestedBatter = replacementTarget.batterId;
    } else if (slot.playerId) {
      suggestedBatter = slot.playerId;
    } else {
      const lineup = slot.side === "away" ? game.awayLineup : game.homeLineup;
      const orderBatter = lineup?.battingOrderIds[slot.battingOrder - 1];
      suggestedBatter = orderBatter || battingTeam.players[0]?.id || "";
    }
    setBatterId(suggestedBatter);

    // 投手自動帶入
    let suggestedPitcher = "";
    if (replacementTarget?.pitcherId) {
      suggestedPitcher = replacementTarget.pitcherId;
    } else {
      // 尋找當時局數與半局的對陣投手
      const sameInningEvent = game.events.find(
        (e) => e.inning === slot.inning && e.half === slot.side && e.pitcherId
      );
      if (sameInningEvent) {
        suggestedPitcher = sameInningEvent.pitcherId;
      } else {
        const oppLineup = slot.side === "away" ? game.homeLineup : game.awayLineup;
        suggestedPitcher = oppLineup?.currentPitcherId || pitchingTeam.players[0]?.id || "";
      }
    }
    setPitcherId(suggestedPitcher);

    // 重置或載入原資料
    if (replacementTarget) {
      setResult(replacementTarget.result);
      setTrajectory((replacementTarget.recordColumn?.trajectory as RecordTrajectory) || "");
      setDirection(replacementTarget.recordColumn?.battedBallPosition || "");
      setFieldingSequence(replacementTarget.recordColumn?.fieldingSequence || "");
      setRbi(replacementTarget.recordColumn?.rbi || 0);
      setRunsScored(replacementTarget.runsScored || 0);
      setIsUnearned((replacementTarget.unearnedRunsDuringAtBat || 0) > 0);
      setDroppedThirdStrike(Boolean(replacementTarget.droppedThirdStrike));

      const inner = replacementTarget.recordCorrection?.innerMark;
      if (inner === "Ⅰ" || inner === "Ⅱ" || inner === "Ⅲ") {
        setOutMark(inner);
        setIsLOB(false);
      } else if (inner === "ℓ") {
        setOutMark("");
        setIsLOB(true);
      } else {
        setOutMark("");
        setIsLOB(false);
      }
    } else {
      setResult("1B");
      setTrajectory("");
      setDirection("");
      setFieldingSequence("");
      setRunnerEventType("");
      setRunsScored(0);
      setIsUnearned(false);
      setRbi(0);
      setOutMark("");
      setIsLOB(false);
      setDroppedThirdStrike(false);
    }
    setNote("");
    stepFade.setValue(1);
  }, [visible, slot, replacementTarget, game, battingTeam, pitchingTeam, stepFade]);

  const transitionToStep = useCallback(
    (nextStep: WizardStep) => {
      stepFade.setValue(0.7);
      setCurrentStep(nextStep);
      Animated.timing(stepFade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    },
    [stepFade]
  );

  if (!slot || !visible) return null;

  // 2. 組裝即時預覽事件 (Preview AtBatEvent)
  const resultCode = result === "F" ? "FO" : result === "G" ? "GO" : result;
  const displayResultCode = result === "K" && droppedThirdStrike ? "K+" : resultCode;
  const generatedNotation = [
    displayResultCode,
    trajectory
      ? `${getRecordTrajectoryMark(trajectory)}${direction ? `・${direction}` : ""}`
      : "",
    fieldingSequence,
  ]
    .filter(Boolean)
    .join(" ");

  // 內圈符號計算
  let computedInnerMark: string | undefined = undefined;
  if (runsScored > 0) {
    computedInnerMark = isUnearned ? "○" : "●";
  } else if (isLOB) {
    computedInnerMark = "ℓ";
  } else if (outMark) {
    computedInnerMark = outMark;
  }

  // 跑壘 Context
  const runnerAdvanceData: RunnerAdvanceContext | undefined = runnerEventType
    ? {
        type: runnerEventType === "ADVANCE" ? "ADVANCE" : (runnerEventType as any),
        fromBase: runnerBaseFrom,
        toBase: runnerBaseTo,
        notation: runnerEventType,
      }
    : undefined;

  const previewEvent: AtBatEvent = {
    id: `wizard-live-preview-${slot.inning}-${slot.slotIndex}`,
    inning: slot.inning,
    half: slot.side,
    batterId,
    pitcherId,
    result,
    notation: generatedNotation || displayResultCode,
    pitches: { balls: 0, strikes: 0, total: 0 },
    outsBefore: replacementTarget?.outsBefore ?? 0,
    runsScored: runsScored,
    unearnedRunsDuringAtBat: isUnearned ? runsScored : 0,
    recordColumn: {
      trajectory: trajectory || undefined,
      battedBallPosition: direction.trim() || undefined,
      fieldingSequence: fieldingSequence.trim() || undefined,
      modifiers: [],
      rbi,
    },
    recordCorrection: {
      innerMark: computedInnerMark,
      otherMark: runnerEventType ? `${runnerEventType}` : undefined,
    },
    runnerAdvance: runnerAdvanceData,
    droppedThirdStrike: result === "K" && droppedThirdStrike,
    source: "manual",
    timestamp: new Date().toISOString(),
  };

  const isBattedBall = ["1B", "2B", "3B", "HR", "F", "G", "E"].includes(result);

  const resultCards: Array<{ value: AtBatResult; label: string }> = [
    { value: "1B", label: "1B" },
    { value: "2B", label: "2B" },
    { value: "3B", label: "3B" },
    { value: "HR", label: "HR" },
    { value: "BB", label: "BB" },
    { value: "HBP", label: "HBP" },
    { value: "K", label: "K" },
    { value: "F", label: "FO" },
    { value: "G", label: "GO" },
    { value: "E", label: "E" },
    { value: "FC", label: "FC" },
  ];

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!batterId || !pitcherId) {
        Alert.alert("人員未選擇", "請先選擇打者與投手。");
        return;
      }
      transitionToStep(2);
    } else if (currentStep === 2) {
      transitionToStep(3);
    } else if (currentStep === 3) {
      transitionToStep(4);
    } else if (currentStep === 4) {
      transitionToStep(5);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      transitionToStep((currentStep - 1) as WizardStep);
    }
  };

  const handleSave = () => {
    if (isReplacement && replacementTarget && onReplace) {
      onReplace(replacementTarget, previewEvent, note);
    } else {
      onSubmit(slot, previewEvent, note);
    }
  };

  const activeBatterPlayer = battingTeam.players.find((p) => p.id === batterId);
  const activePitcherPlayer = pitchingTeam.players.find((p) => p.id === pitcherId);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />

          {/* 頂部區域：包含標題、說明與【右上角實時同步預覽圖式】 */}
          <View style={styles.modalHeaderRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.modalTitle}>
                {isReplacement ? "【筆誤錯登】正式重建精靈" : "【筆誤錯登】正式補登精靈"}
              </Text>
              <Text style={styles.modalSubtitle}>
                第 {slot.inning} 局{slot.side === "away" ? "上" : "下"} · 第 {slot.battingOrder} 棒
              </Text>
              <Text style={styles.playerInfoBadge}>
                打者：{activeBatterPlayer ? `#${activeBatterPlayer.number} ${activeBatterPlayer.name}` : "未指定"} · 投手：{activePitcherPlayer ? `#${activePitcherPlayer.number} ${activePitcherPlayer.name}` : "未指定"}
              </Text>
            </View>

            {/* 右上角實時同步預覽圖式 */}
            <View style={styles.previewCellWrapper}>
              <Text style={styles.previewLabel}>實時預覽</Text>
              <WasedaPersonalRecordCell
                event={previewEvent}
                result={result}
                recordColumn={previewEvent.recordColumn}
                innerMark={computedInnerMark}
                runsScored={runsScored}
                unearnedRunsDuringAtBat={isUnearned ? runsScored : 0}
                outsBefore={previewEvent.outsBefore}
                size="regular"
              />
            </View>
          </View>

          {/* 步驟指示器 */}
          <View style={styles.wizardStepRow}>
            {[
              { step: 1, label: "1.打擊事件" },
              { step: 2, label: "2.跑壘事件" },
              { step: 3, label: "3.得分設定" },
              { step: 4, label: "4.出局/殘壘" },
              { step: 5, label: "5.預覽儲存" },
            ].map((item) => (
              <Pressable
                key={item.step}
                onPress={() => transitionToStep(item.step as WizardStep)}
                style={[
                  styles.wizardStepChip,
                  currentStep === item.step && styles.wizardStepChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.wizardStepText,
                    currentStep === item.step && styles.wizardStepTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View style={{ opacity: stepFade }}>
              {/* 人員對象主動建議 & 選擇區 (隨時可在步驟 1 或任何步驟微調) */}
              {currentStep === 1 && (
                <View style={styles.stepSection}>
                  <Text style={styles.sectionTitle}>人員對象主動建議 (自動帶入)</Text>
                  
                  <Text style={styles.inputLabel}>打者｜{battingTeam.name}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {battingTeam.players.map((player) => (
                      <Pressable
                        key={player.id}
                        disabled={isReplacement && player.id !== batterId}
                        onPress={() => setBatterId(player.id)}
                        style={[
                          styles.playerChip,
                          batterId === player.id && styles.playerChipActive,
                          isReplacement && player.id !== batterId && { opacity: 0.4 },
                        ]}
                      >
                        <Text style={[styles.playerChipText, batterId === player.id && styles.playerChipTextActive]}>
                          #{player.number} {player.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.inputLabel}>投手｜{pitchingTeam.name}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {pitchingTeam.players.map((player) => (
                      <Pressable
                        key={player.id}
                        onPress={() => setPitcherId(player.id)}
                        style={[
                          styles.playerChip,
                          pitcherId === player.id && styles.playerChipActive,
                        ]}
                      >
                        <Text style={[styles.playerChipText, pitcherId === player.id && styles.playerChipTextActive]}>
                          #{player.number} {player.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Text style={styles.sectionTitle}>步驟 1 - 打擊事件選擇</Text>

                  {/* 1-1: 球性 */}
                  <Text style={styles.subInputLabel}>【球性】</Text>
                  <View style={styles.choiceGrid}>
                    {RECORD_TRAJECTORIES.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => setTrajectory(item.id)}
                        style={[
                          styles.choiceButton,
                          trajectory === item.id && styles.choiceButtonActive,
                        ]}
                      >
                        <Text style={[styles.choiceSymbol, trajectory === item.id && styles.choiceTextActive]}>
                          {item.mark}
                        </Text>
                        <Text style={[styles.choiceLabel, trajectory === item.id && styles.choiceTextActive]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      onPress={() => { setTrajectory(""); setDirection(""); }}
                      style={[
                        styles.choiceButton,
                        !trajectory && styles.choiceButtonActive,
                      ]}
                    >
                      <Text style={[styles.choiceSymbol, !trajectory && styles.choiceTextActive]}>—</Text>
                      <Text style={[styles.choiceLabel, !trajectory && styles.choiceTextActive]}>非擊出事件</Text>
                    </Pressable>
                  </View>

                  {/* 1-2: 方向 */}
                  <Text style={styles.subInputLabel}>【守備方向】</Text>
                  <View style={styles.positionGrid}>
                    {FIELD_POSITIONS.map((pos) => (
                      <Pressable
                        key={pos.number}
                        onPress={() => setDirection(`${pos.number} ${pos.label}`)}
                        style={[
                          styles.positionButton,
                          direction.startsWith(pos.number) && styles.choiceButtonActive,
                        ]}
                      >
                        <Text style={[styles.positionCode, direction.startsWith(pos.number) && styles.choiceTextActive]}>
                          {pos.number}
                        </Text>
                        <Text style={[styles.positionLabel, direction.startsWith(pos.number) && styles.choiceTextActive]}>
                          {pos.label.split(" ")[0]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={direction}
                    onChangeText={setDirection}
                    placeholder="或手動輸入守備方向 (如：6 游擊方向)"
                    placeholderTextColor={BRAND.muted}
                    style={styles.formInput}
                  />

                  {/* 1-3: 結果 */}
                  <Text style={styles.subInputLabel}>【打席結果】</Text>
                  <View style={styles.choiceGrid}>
                    {resultCards.map((card) => (
                      <Pressable
                        key={card.value}
                        onPress={() => { setResult(card.value); setDroppedThirdStrike(false); }}
                        style={[
                          styles.choiceCard,
                          result === card.value && !droppedThirdStrike && styles.choiceButtonActive,
                        ]}
                      >
                        <Text style={[styles.choiceCardText, result === card.value && !droppedThirdStrike && styles.choiceTextActive]}>
                          {card.label}
                        </Text>
                      </Pressable>
                    ))}
                    <Pressable
                      onPress={() => { setResult("K"); setDroppedThirdStrike(true); }}
                      style={[
                        styles.choiceCard,
                        result === "K" && droppedThirdStrike && styles.choiceButtonActive,
                      ]}
                    >
                      <Text style={[styles.choiceCardText, result === "K" && droppedThirdStrike && styles.choiceTextActive]}>
                        K+ (不死三振)
                      </Text>
                    </Pressable>
                  </View>

                  {/* 1-4: 傳球軌跡 */}
                  {isBattedBall && (
                    <>
                      <Text style={styles.subInputLabel}>【傳球軌跡 / 守備序列】</Text>
                      <View style={styles.positionGrid}>
                        {FIELD_POSITIONS.map((pos) => (
                          <Pressable
                            key={pos.number}
                            onPress={() => setFieldingSequence((curr) => `${curr}${pos.number}`)}
                            style={styles.positionButton}
                          >
                            <Text style={styles.positionCode}>{pos.number}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <View style={styles.actionSymbolRow}>
                        {[
                          ["ー", "傳球"],
                          ["A", "自踩一壘"],
                          ["E", "失誤"],
                          [" DP", "雙殺"],
                          [" TP", "三殺"],
                          [" FC", "野選"],
                        ].map(([mark, label]) => (
                          <Pressable
                            key={label}
                            onPress={() => setFieldingSequence((curr) => `${curr}${mark}`)}
                            style={styles.actionSymbolChip}
                          >
                            <Text style={styles.actionSymbolCode}>{mark}</Text>
                            <Text style={styles.actionSymbolLabel}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>
                      <TextInput
                        value={fieldingSequence}
                        onChangeText={setFieldingSequence}
                        placeholder="例如：6ー3, 4ー6ー3 DP, 3A, 5E3"
                        placeholderTextColor={BRAND.muted}
                        style={styles.formInput}
                      />
                    </>
                  )}
                </View>
              )}

              {/* 步驟 2: 跑壘事件 */}
              {currentStep === 2 && (
                <View style={styles.stepSection}>
                  <Text style={styles.sectionTitle}>步驟 2 - 跑壘事件設定</Text>
                  <Text style={styles.sectionDesc}>
                    選擇本打席期間發生的跑壘狀況 (如盜壘、暴投、牽制等)：
                  </Text>

                  <View style={styles.choiceGrid}>
                    {[
                      { type: "", title: "無跑壘事件", text: "一般打擊/推進" },
                      { type: "SB", title: "SB (盜壘)", text: "盜壘成功進壘" },
                      { type: "CS", title: "CS (盜壘刺)", text: "盜壘失敗出局" },
                      { type: "ADVANCE", title: "進壘", text: "團隊推進/戰術進壘" },
                      { type: "WP", title: "WP (暴投)", text: "投手暴投進壘" },
                      { type: "PB", title: "PB (捕逸)", text: "捕手捕逸進壘" },
                      { type: "BK", title: "BK (投手犯規)", text: "投手犯規進壘" },
                      { type: "PO", title: "PO (牽制)", text: "牽制出局/出局" },
                    ].map((item) => (
                      <Pressable
                        key={item.title}
                        onPress={() => setRunnerEventType(item.type as any)}
                        style={[
                          styles.runnerChoiceCard,
                          runnerEventType === item.type && styles.choiceButtonActive,
                        ]}
                      >
                        <Text style={[styles.runnerChoiceTitle, runnerEventType === item.type && styles.choiceTextActive]}>
                          {item.title}
                        </Text>
                        <Text style={[styles.runnerChoiceDesc, runnerEventType === item.type && styles.choiceTextActive]}>
                          {item.text}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {runnerEventType !== "" && (
                    <View style={styles.baseSelectBox}>
                      <Text style={styles.subInputLabel}>起止壘包範圍</Text>
                      <View style={styles.baseRow}>
                        <Text style={styles.baseLabel}>從：</Text>
                        {[1, 2, 3].map((b) => (
                          <Pressable
                            key={b}
                            onPress={() => setRunnerBaseFrom(b as any)}
                            style={[styles.baseChip, runnerBaseFrom === b && styles.baseChipActive]}
                          >
                            <Text style={[styles.baseChipText, runnerBaseFrom === b && styles.baseChipTextActive]}>
                              {b} 壘
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <View style={styles.baseRow}>
                        <Text style={styles.baseLabel}>至：</Text>
                        {[2, 3, 4].map((b) => (
                          <Pressable
                            key={b}
                            onPress={() => setRunnerBaseTo(b as any)}
                            style={[styles.baseChip, runnerBaseTo === b && styles.baseChipActive]}
                          >
                            <Text style={[styles.baseChipText, runnerBaseTo === b && styles.baseChipTextActive]}>
                              {b === 4 ? "本壘" : `${b} 壘`}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* 步驟 3: 得分設定 */}
              {currentStep === 3 && (
                <View style={styles.stepSection}>
                  <Text style={styles.sectionTitle}>步驟 3 - 得分設定與打點</Text>

                  <Text style={styles.subInputLabel}>【得分狀態】</Text>
                  <View style={styles.choiceGrid}>
                    <Pressable
                      onPress={() => { setRunsScored(0); setIsUnearned(false); }}
                      style={[styles.choiceCard, runsScored === 0 && styles.choiceButtonActive]}
                    >
                      <Text style={[styles.choiceCardText, runsScored === 0 && styles.choiceTextActive]}>
                        未得分 (0 分)
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => { setRunsScored(1); setIsUnearned(false); }}
                      style={[
                        styles.choiceCard,
                        runsScored === 1 && !isUnearned && styles.choiceButtonActive,
                      ]}
                    >
                      <Text style={[styles.choiceCardText, runsScored === 1 && !isUnearned && styles.choiceTextActive]}>
                        ● 得分 (自責分 ER)
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => { setRunsScored(1); setIsUnearned(true); }}
                      style={[
                        styles.choiceCard,
                        runsScored === 1 && isUnearned && styles.choiceButtonActive,
                      ]}
                    >
                      <Text style={[styles.choiceCardText, runsScored === 1 && isUnearned && styles.choiceTextActive]}>
                        ○ 得分 (非自責分 UER)
                      </Text>
                    </Pressable>
                  </View>

                  <Text style={styles.subInputLabel}>【打點 (RBI)】</Text>
                  <View style={styles.choiceGrid}>
                    {[0, 1, 2, 3, 4].map((val) => (
                      <Pressable
                        key={val}
                        onPress={() => setRbi(val)}
                        style={[styles.rbiChip, rbi === val && styles.choiceButtonActive]}
                      >
                        <Text style={[styles.rbiChipText, rbi === val && styles.choiceTextActive]}>
                          {val} 打點
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* 步驟 4: 殘壘 / 出局結算 */}
              {currentStep === 4 && (
                <View style={styles.stepSection}>
                  <Text style={styles.sectionTitle}>步驟 4 - 殘壘與出局結算標示</Text>
                  <Text style={styles.sectionDesc}>
                    若此打者未得分，請設定該打者的最終結算記號：
                  </Text>

                  <Text style={styles.subInputLabel}>【出局標示】</Text>
                  <View style={styles.choiceGrid}>
                    {[
                      { value: "Ⅰ", label: "Ⅰ (一出局)" },
                      { value: "Ⅱ", label: "Ⅱ (二出局)" },
                      { value: "Ⅲ", label: "Ⅲ (三出局)" },
                    ].map((item) => (
                      <Pressable
                        key={item.value}
                        onPress={() => {
                          setOutMark(item.value as any);
                          setIsLOB(false);
                        }}
                        style={[
                          styles.choiceCard,
                          outMark === item.value && !isLOB && styles.choiceButtonActive,
                        ]}
                      >
                        <Text style={[styles.choiceCardText, outMark === item.value && !isLOB && styles.choiceTextActive]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.subInputLabel}>【殘壘標示】</Text>
                  <View style={styles.choiceGrid}>
                    <Pressable
                      onPress={() => {
                        setIsLOB(true);
                        setOutMark("");
                      }}
                      style={[styles.choiceCard, isLOB && styles.choiceButtonActive]}
                    >
                      <Text style={[styles.choiceCardText, isLOB && styles.choiceTextActive]}>
                        ℓ (殘壘 Left on Base)
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setIsLOB(false);
                        setOutMark("");
                      }}
                      style={[styles.choiceCard, !isLOB && !outMark && styles.choiceButtonActive]}
                    >
                      <Text style={[styles.choiceCardText, !isLOB && !outMark && styles.choiceTextActive]}>
                        無標示 / 進壘上壘
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* 步驟 5: 最終預覽與儲存 */}
              {currentStep === 5 && (
                <View style={styles.stepSection}>
                  <Text style={styles.sectionTitle}>步驟 5 - 最終預覽與儲存</Text>

                  <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>更正內容核對清單</Text>
                    <Text style={styles.summaryLine}>• 打者：{activeBatterPlayer ? `#${activeBatterPlayer.number} ${activeBatterPlayer.name}` : "未指定"}</Text>
                    <Text style={styles.summaryLine}>• 投手：{activePitcherPlayer ? `#${activePitcherPlayer.number} ${activePitcherPlayer.name}` : "未指定"}</Text>
                    <Text style={styles.summaryLine}>• 打擊事件：{[trajectory ? getRecordTrajectoryMark(trajectory) : "", direction, displayResultCode, fieldingSequence].filter(Boolean).join(" · ") || displayResultCode}</Text>
                    <Text style={styles.summaryLine}>• 跑壘事件：{runnerEventType ? `${runnerEventType} (${runnerBaseFrom}壘 -> ${runnerBaseTo === 4 ? "本壘" : `${runnerBaseTo}壘`})` : "無"}</Text>
                    <Text style={styles.summaryLine}>• 得分狀態：{runsScored > 0 ? (isUnearned ? "得分 (非自責分 UER)" : "得分 (自責分 ER)") : "未得分"} / {rbi} 打點</Text>
                    <Text style={styles.summaryLine}>• 結算標示：{computedInnerMark || "無"}</Text>
                  </View>

                  <Text style={styles.inputLabel}>筆誤錯登更正備註 (選填)</Text>
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    style={[styles.formInput, { minHeight: 60, textAlignVertical: "top" }]}
                    multiline
                    placeholder="例如：紙本紀錄核對修正、球性錯登更正"
                    placeholderTextColor={BRAND.muted}
                  />
                </View>
              )}
            </Animated.View>

            {/* 底部按鈕控制區 */}
            <View style={styles.footerActionRow}>
              <View style={styles.flex1}>
                {currentStep === 1 ? (
                  <WizardButton label="取消" onPress={onClose} variant="secondary" />
                ) : (
                  <WizardButton label="上一步" onPress={handlePrevStep} variant="secondary" />
                )}
              </View>

              <View style={styles.flex1}>
                {currentStep < 5 ? (
                  <WizardButton label="下一步" onPress={handleNextStep} />
                ) : (
                  <WizardButton
                    label={isReplacement ? "確認正式重建" : "確認筆誤更正"}
                    onPress={handleSave}
                  />
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 20, 30, 0.65)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: "92%",
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 8,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingBottom: 10,
    marginBottom: 10,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  playerInfoBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E3A8A",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  previewCellWrapper: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    padding: 4,
  },
  previewLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 2,
  },
  wizardStepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  wizardStepChip: {
    flex: 1,
    paddingVertical: 6,
    marginHorizontal: 2,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  wizardStepChipActive: {
    backgroundColor: "#2563EB",
  },
  wizardStepText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  wizardStepTextActive: {
    color: "#FFFFFF",
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  stepSection: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: "#64748B",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginTop: 6,
  },
  subInputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E3A8A",
    marginTop: 8,
  },
  chipScroll: {
    flexDirection: "row",
    marginVertical: 4,
  },
  playerChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    marginRight: 6,
  },
  playerChipActive: {
    backgroundColor: "#1E40AF",
    borderColor: "#1E40AF",
  },
  playerChipText: {
    fontSize: 12,
    color: "#334155",
    fontWeight: "600",
  },
  playerChipTextActive: {
    color: "#FFFFFF",
  },
  choiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  choiceButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    gap: 4,
  },
  choiceButtonActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  choiceSymbol: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
  },
  choiceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  choiceTextActive: {
    color: "#FFFFFF",
  },
  choiceCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  choiceCardText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  positionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  positionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
  },
  positionCode: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  positionLabel: {
    fontSize: 10,
    color: "#64748B",
  },
  actionSymbolRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginVertical: 4,
  },
  actionSymbolChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    alignItems: "center",
  },
  actionSymbolCode: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0F172A",
  },
  actionSymbolLabel: {
    fontSize: 9,
    color: "#475569",
  },
  formInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
    marginTop: 4,
  },
  runnerChoiceCard: {
    width: "48%",
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  runnerChoiceTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  runnerChoiceDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  baseSelectBox: {
    backgroundColor: "#F1F5F9",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  baseRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  baseLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    width: 32,
  },
  baseChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  baseChipActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  baseChipText: {
    fontSize: 12,
    color: "#334155",
  },
  baseChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  rbiChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  rbiChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  summaryCard: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E40AF",
    marginBottom: 4,
  },
  summaryLine: {
    fontSize: 13,
    color: "#1E3A8A",
  },
  footerActionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  flex1: {
    flex: 1,
  },
});
