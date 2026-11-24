// Story Quest's skill tree: the six storytelling skills from the skills map (skills.ts), each with
// its five steps, plus a seventh branch for saying it out loud, from practice rounds. Plain logic.

import { LEARNED, SKILL_LEVELS, type SkillLevel, type SkillStatus } from "@/lib/stories/skills";
import { heldUpInPractice, type QuestSession } from "./xp";

export type BranchId = SkillStatus["skill"]["id"] | "aloud";

export type Branch = {
  id: BranchId;
  label: string;
  what: string;
  level: SkillLevel;
  // What earns each step, 1 to 5.
  steps: string[];
  // What gets it to its next step, addressed to the user; missing at the top.
  next?: string;
};

const SKILL_STEPS = [
  "Shows up in a graded story.",
  "Solid in one story.",
  "Solid in two stories, one of them before a follow-up asked for it.",
  "Strong in two stories, one of them on your own.",
  "Strong in three stories, two of them on your own.",
];

export const ALOUD_STEPS = [
  "Practice an answer out loud and get feedback.",
  "One Level 3 story holds up in practice, follow-up and all (Level 4).",
  "Two stories at Level 4.",
  "Two stories at Level 4, and a job's boss round run to the end.",
  "Six stories at Level 4, and a boss round run.",
];

// The speaking branch, from practice: answers given feedback, stories at Level 4, boss rounds run.
export function aloudLevel({
  practicedAny,
  storiesAtFour,
  bossRounds,
}: {
  practicedAny: boolean;
  storiesAtFour: number;
  bossRounds: number;
}): SkillLevel {
  if (storiesAtFour >= 6 && bossRounds > 0) return 5;
  if (storiesAtFour >= 2 && bossRounds > 0) return 4;
  if (storiesAtFour >= 2) return 3;
  if (storiesAtFour >= 1) return 2;
  return practicedAny ? 1 : 0;
}

export function skillTree({
  map,
  sessions,
  storiesAtFour,
  bossRounds = 0,
}: {
  map: SkillStatus[];
  sessions: readonly QuestSession[];
  storiesAtFour: number;
  bossRounds?: number;
}): Branch[] {
  const practicedAny = sessions.some((s) => s.items.some((i) => i.feedback && !i.skipped));
  const aloud = aloudLevel({ practicedAny, storiesAtFour, bossRounds });
  const branches: Branch[] = map.map((s) => ({
    id: s.skill.id,
    label: s.skill.label,
    what: s.skill.what,
    level: s.level,
    steps: SKILL_STEPS,
    ...(s.next ? { next: s.next } : {}),
  }));
  // Practice before Level 4 counts as trying, but the next step is still a Level 3 story said out
  // loud; held-up answers on lower-level stories don't count toward it.
  const heldUp = sessions.some((s) => s.items.some(heldUpInPractice));
  branches.push({
    id: "aloud",
    label: "Saying it out loud",
    what: "Told from memory in practice, with the interviewer's follow-ups handled.",
    level: aloud,
    steps: ALOUD_STEPS,
    ...(aloud < 5
      ? {
          next:
            aloud === 1 && heldUp
              ? "Take a story you practiced to Level 3, then practice it again."
              : ALOUD_STEPS[aloud],
        }
      : {}),
  });
  return branches;
}

export function stepName(level: number): string {
  return SKILL_LEVELS[level]?.name ?? "";
}

// The top of the tree: every branch at Learned.
export function interviewReady(branches: Branch[]): boolean {
  return branches.every((b) => b.level >= LEARNED);
}
