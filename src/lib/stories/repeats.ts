import type { FollowUp } from "./content";

// Follow-up questions that ask again what was already asked. The prompt says not to, but simulated
// users still read the follow-ups as repetitive ("the same kind of questions in different boxes",
// 2026-11-08), so near-repeats are dropped in code too: against the questions already asked on the
// story and against each other.

const STOP = new Set(
  "a an and are as at be by did do does for from had has have how i if in into is it its me my of on or so that the their them then there this to was we were what when where which who why will with you your".split(
    " ",
  ),
);

function words(question: string): Set<string> {
  return new Set(
    question
      .toLowerCase()
      .replace(/[^a-z0-9$%\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      // Plurals and -ing forms count as the same word.
      .map((w) => w.replace(/(ing|ed|es|s)$/, "")),
  );
}

// Share of the smaller question's words that the other one also has.
export function overlap(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  const small = Math.min(wa.size, wb.size);
  if (small === 0) return 0;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / small;
}

export const REPEAT_OVERLAP = 0.7;

export function dropRepeats(followUps: FollowUp[], asked: string[]): FollowUp[] {
  const seen = [...asked];
  const kept: FollowUp[] = [];
  for (const f of followUps) {
    if (seen.some((q) => overlap(q, f.question) >= REPEAT_OVERLAP)) continue;
    kept.push(f);
    seen.push(f.question);
  }
  return kept;
}
