// The stage a finished job's interviews ended at (job map, Nov 20). The outcome's round number
// (1 to 10) says how far the user got, but every company counts rounds differently; the job map
// and ceiling detection need a named stage instead. Set by the user in one tap; until then the app
// offers a guess from the job's transcripts or the round's name, never saving it silently.

export const STAGES_REACHED = [
  { id: "applied", label: "Applied, no interview", short: "Applied" },
  { id: "recruiter", label: "Recruiter screen", short: "Recruiter" },
  { id: "hiring_manager", label: "Hiring manager", short: "Hiring manager" },
  { id: "panel", label: "Panel or loop", short: "Panel" },
  { id: "final", label: "Final round", short: "Final" },
] as const;

export type StageReachedId = (typeof STAGES_REACHED)[number]["id"];

export function isStageReached(id: unknown): id is StageReachedId {
  return STAGES_REACHED.some((s) => s.id === id);
}

export function stageReachedLabel(id: string | null | undefined): string | undefined {
  return STAGES_REACHED.find((s) => s.id === id)?.label;
}

// Where each stage sits in the pipeline, earliest first.
export function stageRank(id: StageReachedId): number {
  return STAGES_REACHED.findIndex((s) => s.id === id);
}

// Finished jobs that still need their stage: everything but offers (an offer got past every
// stage), with no stage set. Oldest first, as the job list shows them.
export function jobsMissingStage<
  J extends { outcome: string | null; stageReached: StageReachedId | null },
>(jobs: J[]): J[] {
  return jobs.filter((j) => j.outcome && j.outcome !== "offer" && !j.stageReached);
}
