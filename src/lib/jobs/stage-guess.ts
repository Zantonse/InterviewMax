import { buildTimeline, guessRound, type TimelineTranscript } from "@/lib/transcripts/timeline";
import { STAGES_REACHED, isStageReached, stageRank, type StageReachedId } from "./stage-reached";

export type StageGuess = { stage: StageReachedId; from: "transcripts" | "round name" };

// A guess at where a finished job ended: the furthest stage among its interviews (rounds the user
// set on a transcript, else guessed from its title or summary), else the outcome's round name.
// Null when nothing says.
export function guessStageReached(
  job: { id: string; company: string | null; roundName: string },
  transcripts: TimelineTranscript[],
): StageGuess | null {
  const ranks = buildTimeline(job, transcripts).steps.flatMap((s) =>
    s.round && isStageReached(s.round) ? [stageRank(s.round)] : [],
  );
  if (ranks.length) return { stage: STAGES_REACHED[Math.max(...ranks)].id, from: "transcripts" };
  const named = job.roundName.trim() ? guessRound(job.roundName) : null;
  if (named && isStageReached(named)) return { stage: named, from: "round name" };
  return null;
}

