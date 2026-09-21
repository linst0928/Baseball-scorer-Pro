import type { RunnerState } from "./types";

export type OutType =
  | "FORCE_OUT"
  | "TAG_OUT"
  | "STRIKEOUT"
  | "FLY_OUT"
  | "LINE_OUT"
  | "GROUND_OUT"
  | "INTERFERENCE_OUT"
  | "OTHER";

export type RunnerForceStatus = {
  runnerId: string;
  currentBase: 1 | 2 | 3;
  isForced: boolean;
  forceTargetBase: 2 | 3 | 4 | null; // 2=2B, 3=3B, 4=HOME
  forceSource: "batter" | "runner_behind" | null;
};

export type ForceChainItem = {
  runnerId: string;
  fromBase: 0 | 1 | 2 | 3; // 0 表示 打者 Batter
  toBase: 1 | 2 | 3 | 4;   // 1=1B, 2=2B, 3=3B, 4=HOME
};

export type ForceState = {
  batterBecomesRunner: boolean;
  batterRunnerForced: boolean; // 打者往一壘
  runners: {
    first: RunnerForceStatus | null;
    second: RunnerForceStatus | null;
    third: RunnerForceStatus | null;
  };
  forceChain: ForceChainItem[];
};

/**
  * 計算當前壘包狀況下的強制進壘 (Force Play) 狀態。
  * 
  * 最高原則：
  * 「強迫進壘的根源是打者成為跑者」。
  * 只有當 batterBecomesRunner 為 true 時，才由 1B 跑者開始建立 Force Chain。
  */
export function calculateForceState(
  runners: RunnerState,
  batterBecomesRunner: boolean,
  batterId: string = "batter"
): ForceState {
  const defaultStatus = (
    runnerId: string | null,
    currentBase: 1 | 2 | 3
  ): RunnerForceStatus | null => {
    if (!runnerId) return null;
    return {
      runnerId,
      currentBase,
      isForced: false,
      forceTargetBase: null,
      forceSource: null,
    };
  };

  const firstStatus = defaultStatus(runners.first, 1);
  const secondStatus = defaultStatus(runners.second, 2);
  const thirdStatus = defaultStatus(runners.third, 3);

  const forceChain: ForceChainItem[] = [];

  if (!batterBecomesRunner) {
    // 若打者沒有成為跑者 (例如：盜壘、牽制、暴投、捕逸、Balk、單純球數記錄)
    // 則任何跑者都不存在 Force 狀態！
    return {
      batterBecomesRunner: false,
      batterRunnerForced: false,
      runners: {
        first: firstStatus,
        second: secondStatus,
        third: thirdStatus,
      },
      forceChain: [],
    };
  }

  // 打者成為跑者 -> 必定強迫前往一壘
  forceChain.push({
    runnerId: batterId,
    fromBase: 0,
    toBase: 1,
  });

  // 1. 檢查一壘：一壘有跑者 (R1) -> R1 強迫進二壘
  if (firstStatus) {
    firstStatus.isForced = true;
    firstStatus.forceTargetBase = 2;
    firstStatus.forceSource = "batter";
    forceChain.push({
      runnerId: firstStatus.runnerId,
      fromBase: 1,
      toBase: 2,
    });

    // 2. 檢查二壘：在一壘有跑者的前提下，二壘有跑者 (R2) -> R2 強迫進三壘
    if (secondStatus) {
      secondStatus.isForced = true;
      secondStatus.forceTargetBase = 3;
      secondStatus.forceSource = "runner_behind";
      forceChain.push({
        runnerId: secondStatus.runnerId,
        fromBase: 2,
        toBase: 3,
      });

      // 3. 檢查三壘：在一二壘均有跑者 (滿壘) 的前提下，三壘有跑者 (R3) -> R3 強迫進本壘
      if (thirdStatus) {
        thirdStatus.isForced = true;
        thirdStatus.forceTargetBase = 4;
        thirdStatus.forceSource = "runner_behind";
        forceChain.push({
          runnerId: thirdStatus.runnerId,
          fromBase: 3,
          toBase: 4,
        });
      }
    }
  }

  return {
    batterBecomesRunner: true,
    batterRunnerForced: true,
    runners: {
      first: firstStatus,
      second: secondStatus,
      third: thirdStatus,
    },
    forceChain,
  };
}

/**
  * 判斷跑者在某壘包出局時，屬於 FORCE_OUT 還是 TAG_OUT。
  * 
  * @param runnerId 出局跑者 ID
  * @param baseOfOut 出局發生的壘包 (1, 2, 3, 4)
  * @param forceState 出局發生前的 Force 狀態
  * @param isPlayOnBatter 是否針對打者（打者在一壘出局為 Force Out）
  */
export function determineOutType(
  runnerId: string,
  baseOfOut: 1 | 2 | 3 | 4,
  forceState: ForceState,
  isPlayOnBatter: boolean = false
): OutType {
  // 打者擊出滾地球等在 1 壘前出局 -> FORCE_OUT
  if (isPlayOnBatter && baseOfOut === 1) {
    return "FORCE_OUT";
  }

  if (!forceState.batterBecomesRunner) {
    return "TAG_OUT";
  }

  // 對應一、二、三壘跑者的狀態
  let runnerStatus: RunnerForceStatus | null = null;
  if (forceState.runners.first?.runnerId === runnerId) {
    runnerStatus = forceState.runners.first;
  } else if (forceState.runners.second?.runnerId === runnerId) {
    runnerStatus = forceState.runners.second;
  } else if (forceState.runners.third?.runnerId === runnerId) {
    runnerStatus = forceState.runners.third;
  }

  // 若跑者處於 isForced 狀態，且出局發生在其 forceTargetBase 上 -> FORCE_OUT
  if (
    runnerStatus &&
    runnerStatus.isForced &&
    runnerStatus.forceTargetBase === baseOfOut
  ) {
    return "FORCE_OUT";
  }

  return "TAG_OUT";
}

/**
  * 當一個 Play 中有跑者出局（例如雙殺的第一位跑者被封殺）後，
  * 必須立即更新與解除後續 Force Chain。
  */
export function updateForceChainAfterOut(
  runners: RunnerState,
  outRunnerId: string,
  forceState: ForceState
): { nextRunners: RunnerState; nextForceState: ForceState } {
  const nextRunners: RunnerState = { ...runners };

  if (nextRunners.first === outRunnerId) {
    nextRunners.first = null;
  }
  if (nextRunners.second === outRunnerId) {
    nextRunners.second = null;
  }
  if (nextRunners.third === outRunnerId) {
    nextRunners.third = null;
  }

  // 出局後，根據「剩餘壘包狀態」與「打者是否仍為跑者」重新動態計算最新 Force 狀態
  // 注意：若原一壘跑者出局，但打者安全上一壘或打者也已出局，Force Chain 需根據最新情況重算
  const nextForceState = calculateForceState(
    nextRunners,
    forceState.batterBecomesRunner
  );

  return { nextRunners, nextForceState };
}

/**
  * 得分與第三出局綜合結算 (Score & 3rd Out Settlement)
  * 
  * 棒球規則 5.08(a):
  * 第三個出局若屬於下列三者之一，任何跑者縱使在第三出局完成前踏觸本壘，得分均不成立：
  * 1. 打者跑者到達一壘前出局 (Force Out at 1B)
  * 2. 任何跑者被封殺出局 (Force Out at any base)
  * 3. 前位跑者未踏觸壘包即被刺殺或封殺 (Flyball Appeal / Force Out)
  * 
  * 若第三出局為非封殺出局 (Tag Out) 且跑者在大於/小於該刺殺時間點前觸及本壘（Timing Play），
  * 則由傳入的時間比對決定得分是否算進。
  */
export type SettlementResult = {
  runsAllowed: boolean;
  isForcePlayThirdOut: boolean;
  reason: string;
};

export function evaluateThirdOutRunSettlement(
  thirdOutType: OutType,
  thirdOutBase: 1 | 2 | 3 | 4,
  runnerCrossedHomeBeforeThirdOut: boolean
): SettlementResult {
  // 若第三出局為 FORCE_OUT
  if (thirdOutType === "FORCE_OUT") {
    return {
      runsAllowed: false,
      isForcePlayThirdOut: true,
      reason: "第三出局為強迫出局 (Force Out)，依棒球規則得分不成立。",
    };
  }

  // 若第三出局為 TAG_OUT
  if (thirdOutType === "TAG_OUT") {
    if (runnerCrossedHomeBeforeThirdOut) {
      return {
        runsAllowed: true,
        isForcePlayThirdOut: false,
        reason: "第三出局為觸殺 (Tag Out)，跑者於出局完成前踏觸本壘，得分成立。",
      };
    } else {
      return {
        runsAllowed: false,
        isForcePlayThirdOut: false,
        reason: "第三出局為觸殺 (Tag Out)，跑者未於出局完成前踏觸本壘，得分不成立。",
      };
    }
  }

  // 接殺 (FLY_OUT / LINE_OUT) 或三振 (STRIKEOUT)
  return {
    runsAllowed: false,
    isForcePlayThirdOut: false,
    reason: "第三出局為飛球接殺或三振，得分不成立。",
  };
}
