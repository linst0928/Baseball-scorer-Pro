import type { Game, RunnerState, AtBatResult } from "./types";

export type ForcedAdvanceResult = {
  /** 壘包更新後的狀態快照 */
  runners: RunnerState;
  /** 進壘歷史紀錄清單，便於日後儲存並關聯到擊球打席與統計系統 */
  advances: Array<{
    runnerId: string;
    fromBase: 1 | 2 | 3;
    toBase: 2 | 3 | 4;
    isScore: boolean;
  }>;
};

export type RunnerQueueItem = {
  base: 3 | 2 | 1;
  runnerId: string;
};

/**
 * 1. 四壞球/觸身球強制進壘自動判定器 (Forced Advance Auto-resolver)
 */
export function resolveForcedAdvances(runners: RunnerState, batterId: string): ForcedAdvanceResult {
  const nextRunners: RunnerState = { ...runners };
  const advances: ForcedAdvanceResult["advances"] = [];

  // 若一壘無人，保送打者直接上一壘，現有壘上跑者無須強制推進
  if (!runners.first) {
    nextRunners.first = batterId;
    return { runners: nextRunners, advances };
  }

  const firstId = runners.first;
  const secondId = runners.second;
  const thirdId = runners.third;

  // 打者佔據一壘
  nextRunners.first = batterId;

  // 一壘跑者強制推二壘
  nextRunners.second = firstId;
  advances.push({ runnerId: firstId, fromBase: 1, toBase: 2, isScore: false });

  // 若原本二壘有人 -> 二壘強迫推三壘
  if (secondId) {
    nextRunners.third = secondId;
    advances.push({ runnerId: secondId, fromBase: 2, toBase: 3, isScore: false });

    // 若原本三壘有人 (滿壘) -> 三壘強迫推本壘得分 (保送擠回一分)
    if (thirdId) {
      nextRunners.third = secondId; // 佔三壘的是原二壘跑者
      advances.push({ runnerId: thirdId, fromBase: 3, toBase: 4, isScore: true });
    }
  }

  return { runners: nextRunners, advances };
}

/**
 * 2. 嚴格單向跑者清算佇列 (Strict Resolution Queue)
 * 壘上有人時，強制自離本壘最近的跑者 (三壘 -> 二壘 -> 一壘) 開始，杜絕逆向超越
 */
export function buildStrictRunnerQueue(runners: RunnerState): RunnerQueueItem[] {
  const queue: RunnerQueueItem[] = [];

  if (runners.third) {
    queue.push({ base: 3, runnerId: runners.third });
  }
  if (runners.second) {
    queue.push({ base: 2, runnerId: runners.second });
  }
  if (runners.first) {
    queue.push({ base: 1, runnerId: runners.first });
  }

  return queue;
}

/**
 * 3. 第 3 出局與 Time Play 判定器 (3rd Out & Time Play Blocker)
 */
export type TimePlayCheckResult = {
  /** 是否觸發 Time Play 確認旗標 (需 UI 跳出確認卡片) */
  requireTimePlayConfirmation: boolean;
  /** 是否封殺 (如果是封殺出局，則得分一律不算，無須確認) */
  isForcePlayOut: boolean;
};

export function checkTimePlayCondition({
  result,
  baseOfOut,
  runnersBefore,
  outsBefore,
}: {
  result: AtBatResult | "SPECIAL_OUT";
  /** 該名跑者出局的壘包或打者出局位置 */
  baseOfOut: 1 | 2 | 3 | 4;
  runnersBefore: RunnerState;
  outsBefore: number;
}): TimePlayCheckResult {
  // 只有在本次出局為第 3 出局時，才有 Time Play 判定需求
  if (outsBefore !== 2) {
    return { requireTimePlayConfirmation: false, isForcePlayOut: false };
  }

  // 判定是否為「封殺出局」：
  // 打者在一壘出局，或被迫進壘的跑者在被迫前進的目標壘包出局
  let isForcePlayOut = false;

  if (result === "G" || result === "E") {
    if (baseOfOut === 1) {
      isForcePlayOut = true;
    }
  }

  // 若跑者在強制推進狀態下出局：
  // 1. 一壘跑者在二壘出局且強迫推進中
  if (baseOfOut === 2 && runnersBefore.first) {
    isForcePlayOut = true;
  }
  // 2. 二壘跑者在三壘出局且一二壘均有人強迫推進中
  if (baseOfOut === 3 && runnersBefore.first && runnersBefore.second) {
    isForcePlayOut = true;
  }
  // 3. 三壘跑者在本壘出局且滿壘強迫推進中
  if (baseOfOut === 4 && runnersBefore.first && runnersBefore.second && runnersBefore.third) {
    isForcePlayOut = true;
  }

  // 規則：如果第 3 出局是封殺，得分一律不算，無須 Time Play 彈窗詢問
  // 反之，若為「非封殺出局」(例如：外野飛球被接殺後跑者闖本壘被觸殺、或者非強迫狀態下盜壘出局)，則需要確認 Time Play
  const requireTimePlayConfirmation = !isForcePlayOut;

  return {
    requireTimePlayConfirmation,
    isForcePlayOut,
  };
}
