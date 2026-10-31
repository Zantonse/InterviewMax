// How a target job's interview process ended: the outcome and the round the user reached. A job
// with no outcome is still in progress. Finished jobs stay on the list but don't count toward
// MAX_JOBS and aren't picked for the prep plan.

export const OUTCOMES = [
  { id: "offer", label: "Got an offer", short: "Offer" },
  { id: "rejected", label: "Didn't get it", short: "Not selected" },
  { id: "withdrew", label: "I withdrew", short: "Withdrew" },
] as const;

export type OutcomeId = (typeof OUTCOMES)[number]["id"];

// Rounds are numbered, since every company names them differently. The optional name says what
// that round was ("Onsite loop", "Hiring manager").
export const MAX_ROUND = 10;
export const MAX_ROUND_NAME_LENGTH = 80;

export type JobOutcome = {
  outcome: OutcomeId;
  roundReached: number | null;
  roundName: string;
  // YYYY-MM-DD, the day the process finished.
  finishedOn: string | null;
};

export function isOutcome(id: unknown): id is OutcomeId {
  return OUTCOMES.some((o) => o.id === id);
}

export function outcomeLabel(id: string | null | undefined): string | undefined {
  return OUTCOMES.find((o) => o.id === id)?.label;
}

// Reads a round from a form value: a whole number from 1 to MAX_ROUND, else null.
export function parseRound(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= MAX_ROUND ? n : null;
}

// "Offer · reached round 4 (Onsite loop)" for the job list and the job page.
export function outcomeSummary(o: {
  outcome: string | null;
  roundReached: number | null;
  roundName: string;
}): string {
  const short = OUTCOMES.find((x) => x.id === o.outcome)?.short ?? "Finished";
  const name = o.roundName.trim();
  if (o.roundReached) return `${short} · reached round ${o.roundReached}${name ? ` (${name})` : ""}`;
  return name ? `${short} · reached ${name}` : short;
}

export function isFinished(job: { outcome?: string | null }): boolean {
  return Boolean(job.outcome);
}

// Jobs still in progress, for the job limit and the prep plan.
export function openJobs<J extends { outcome?: string | null }>(jobs: J[]): J[] {
  return jobs.filter((j) => !isFinished(j));
}
