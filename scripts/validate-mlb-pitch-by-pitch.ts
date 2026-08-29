import { getWasedaPitchMark, type PitchOutcome } from "../lib/baseball/types";

const GAME_PK = 775296;
const SOURCE_URL = `https://statsapi.mlb.com/api/v1.1/game/${GAME_PK}/feed/live`;
const OUTER_CIRCLE_PITCH_DESCRIPTIONS = new Set(["Hit By Pitch"]);

type MlbPitch = {
  isPitch?: boolean;
  details?: { description?: string; code?: string };
};

type MlbPlay = {
  result?: { eventType?: string; event?: string };
  playEvents?: MlbPitch[];
};

function toPitchOutcome(pitch: MlbPitch): PitchOutcome | null {
  const description = pitch.details?.description ?? "";
  if (/foul tip/i.test(description)) return "foulTip";
  if (/bunt foul/i.test(description)) return "buntFoul";
  if (/missed bunt|bunt missed/i.test(description)) return "missedBunt";
  if (/bunt/i.test(description)) return "bunt";
  if (/foul/i.test(description)) return "foul";
  if (/swinging strike/i.test(description)) return "swingingStrike";
  if (/in play/i.test(description)) return "inPlay";
  if (/ball/i.test(description)) return "ball";
  if (/strike/i.test(description)) return "strike";
  return null;
}

function toAtBatCategory(play: MlbPlay): string | null {
  const eventType = play.result?.eventType ?? "";
  if (eventType === "single") return "1B";
  if (eventType === "double") return "2B";
  if (eventType === "triple") return "3B";
  if (eventType === "home_run") return "HR";
  if (eventType === "walk" || eventType === "intent_walk") return "BB";
  if (eventType === "hit_by_pitch") return "HBP";
  if (eventType === "strikeout") return "K";
  if (eventType === "field_error") return "E";
  if (/flyout|lineout|pop_out|sac_fly/.test(eventType)) return "F";
  if (/groundout|force_out|double_play|triple_play|sac_bunt|field_out/.test(eventType)) return "G";
  return null;
}

async function main() {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`MLB 官方逐球資料讀取失敗：${response.status}`);

  const payload = await response.json() as {
    gameData: { game: { gameType?: string }; teams: { away: { name: string }; home: { name: string } } };
    liveData: { linescore: { currentInning?: number; teams: { away: { runs: number }; home: { runs: number } } }; plays: { allPlays: MlbPlay[] } };
  };

  const plays = payload.liveData.plays.allPlays;
  const pitches = plays.flatMap((play) => play.playEvents ?? []).filter((event) => event.isPitch);
  const pitchOutcomes = pitches.map(toPitchOutcome);
  const unresolvedPitchDescriptions = pitches
    .filter((pitch, index) => !pitchOutcomes[index] && !OUTER_CIRCLE_PITCH_DESCRIPTIONS.has(pitch.details?.description ?? ""))
    .map((pitch) => pitch.details?.description ?? "(空白)");
  const pitchSummary = pitchOutcomes.filter((outcome): outcome is PitchOutcome => Boolean(outcome)).reduce<Record<string, number>>((summary, outcome) => {
    const symbol = getWasedaPitchMark(outcome);
    summary[`${outcome} (${symbol})`] = (summary[`${outcome} (${symbol})`] ?? 0) + 1;
    return summary;
  }, {});
  const atBatSummary = plays.map(toAtBatCategory).filter((category): category is string => Boolean(category)).reduce<Record<string, number>>((summary, category) => {
    summary[category] = (summary[category] ?? 0) + 1;
    return summary;
  }, {});

  const result = {
    source: SOURCE_URL,
    gamePk: GAME_PK,
    teams: payload.gameData.teams,
    finalScore: payload.liveData.linescore.teams,
    completedInnings: payload.liveData.linescore.currentInning,
    totalAtBats: plays.length,
    totalPitches: pitches.length,
    pitchSummary,
    atBatSummary,
    outerCircleOnlyEvents: pitches
      .filter((pitch, index) => !pitchOutcomes[index] && OUTER_CIRCLE_PITCH_DESCRIPTIONS.has(pitch.details?.description ?? ""))
      .map((pitch) => `${pitch.details?.description} → HBP`),
    unresolvedPitchDescriptions: [...new Set(unresolvedPitchDescriptions)],
    passed: payload.liveData.linescore.teams.away.runs === 7
      && payload.liveData.linescore.teams.home.runs === 6
      && payload.liveData.linescore.currentInning === 9
      && unresolvedPitchDescriptions.length === 0,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
