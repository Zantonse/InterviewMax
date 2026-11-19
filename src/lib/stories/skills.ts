// Story skills map (Craig, 2026-11-14, from Jane Street's "teach me" tutor): story levels belong
// to one story; skills belong to the person. Each storytelling skill gets a level from 0 to 5 across
// all their behavioral stories, and a skill only counts as learned once it shows in two stories,
// one of them without a follow-up question pointing them to it. So the level measures what the
// person learned, not what a rewrite put in. Code only, from saved grades and follow-ups.

import { gradeIsCurrent, type FollowUp, type StoryContent } from "./content";
import type { StoryGrade } from "./grading";
import type { LevelGap } from "./levels";
import { getStoryType } from "./story-types";

export type SkillId = "stakes" | "ownership" | "decisions" | "result" | "thinking" | "lesson";

export type Skill = {
  id: SkillId;
  label: string;
  // What it is, in a line.
  what: string;
  // The story part to reread when looking for it, and the question to ask of it (the hint).
  part: string;
  partLabel: string;
  hint: string;
};

export const SKILLS: readonly Skill[] = [
  {
    id: "stakes",
    label: "The stakes",
    what: "Where you were, your role, and what was at risk.",
    part: "situation",
    partLabel: "Situation",
    hint: "Could a stranger tell what was at risk, and for whom?",
  },
  {
    id: "ownership",
    label: "What you did yourself",
    what: "“I” for your part, kept apart from what the team did.",
    part: "role",
    partLabel: "Your role",
    hint: "Which sentences say what you did, not what “we” did?",
  },
  {
    id: "decisions",
    label: "Concrete actions",
    what: "Real steps, with a choice between options.",
    part: "actions",
    partLabel: "What you did",
    hint: "Could someone picture each step, and where you chose one way over another?",
  },
  {
    id: "result",
    label: "A result with a number",
    what: "What changed, with a number from your own answers.",
    part: "result",
    partLabel: "Result",
    hint: "Is there a number that shows what changed, and why it mattered?",
  },
  {
    id: "thinking",
    label: "Your thinking",
    what: "What you noticed, the options you weighed, and why you chose.",
    part: "actions",
    partLabel: "What you did",
    hint: "Can the listener hear why you picked your path over another one?",
  },
  {
    id: "lesson",
    label: "The lesson",
    what: "Something specific you'd carry forward or do differently.",
    part: "reflection",
    partLabel: "What you learned",
    hint: "Does it end on something you'd do differently next time?",
  },
];

export function skillInfo(id: SkillId): Skill {
  return SKILLS.find((s) => s.id === id)!;
}

// Grade criterion -> skill.
const CRITERION_SKILL: Record<string, SkillId> = {
  context: "stakes",
  ownership: "ownership",
  actions: "decisions",
  result: "result",
  reflection: "lesson",
};

// Follow-up gap (see GAPS in prompts.ts) -> the skill a question about it hands the user.
const GAP_SKILL: Record<string, SkillId> = {
  situation: "stakes",
  ownership: "ownership",
  actions: "decisions",
  obstacle: "decisions",
  decision: "thinking",
  result: "result",
  reflection: "lesson",
};

// A level-up gap (levels.ts) -> the skill it's about; undefined for ones only a rewrite fixes.
const LEVEL_GAP_SKILL: Record<string, SkillId> = {
  number: "result",
  traced: "result",
  hedged: "result",
  i_we: "ownership",
  context: "stakes",
  ownership: "ownership",
  actions: "decisions",
  scope: "decisions",
  result: "result",
  reflection: "lesson",
  thinking: "thinking",
};

export function skillForLevelGap(gap: LevelGap): SkillId | undefined {
  return LEVEL_GAP_SKILL[gap.id];
}

export const SKILL_LEVELS = [
  { level: 0, name: "Not tried yet" },
  { level: 1, name: "Trying" },
  { level: 2, name: "Shown once" },
  { level: 3, name: "Learned" },
  { level: 4, name: "Strong" },
  { level: 5, name: "Second nature" },
] as const;

export type SkillLevel = 0 | 1 | 2 | 3 | 4 | 5;

// Where Learned starts: shown in two stories, one of them unaided.
export const LEARNED: SkillLevel = 3;

// How one graded story did on a skill.
export type SkillEvidence = {
  storyId: string;
  // 1 to 4, as the grader scores it. "Show your thinking": shown 4, partly 2, missing 1.
  score: number;
  // No follow-up in the story asked about it, so the user put it in themselves.
  unaided: boolean;
};

type StoryLike = { id: string; storyType: string | null; content: StoryContent };

export function storySkillScores(grade: StoryGrade): Partial<Record<SkillId, number>> {
  const scores: Partial<Record<SkillId, number>> = {};
  for (const c of grade.criteria) {
    const skill = CRITERION_SKILL[c.id];
    if (skill) scores[skill] = c.score;
  }
  if (grade.thinking) {
    scores.thinking = { shown: 4, partly: 2, missing: 1 }[grade.thinking.level];
  }
  return scores;
}

// The skills a story's follow-ups asked about (answered ones only: a skipped question handed
// nothing over).
export function aidedSkills(followUps: FollowUp[] = []): Set<SkillId> {
  const aided = new Set<SkillId>();
  for (const f of followUps) {
    if (!f.answer?.trim()) continue;
    const skill = GAP_SKILL[f.gap];
    if (skill) aided.add(skill);
  }
  return aided;
}

// Every graded behavioral story's evidence, per skill.
export function skillEvidence(stories: StoryLike[]): Record<SkillId, SkillEvidence[]> {
  const out = Object.fromEntries(SKILLS.map((s) => [s.id, [] as SkillEvidence[]])) as Record<
    SkillId,
    SkillEvidence[]
  >;
  for (const story of stories) {
    const type = getStoryType(story.storyType);
    if (type?.format !== "star" || story.content.tough) continue;
    if (!gradeIsCurrent(story.content) || !story.content.grade) continue;
    const scores = storySkillScores(story.content.grade);
    const aided = aidedSkills(story.content.followUps);
    for (const skill of SKILLS) {
      const score = scores[skill.id];
      if (score === undefined) continue;
      out[skill.id].push({ storyId: story.id, score, unaided: !aided.has(skill.id) });
    }
  }
  return out;
}

// The level from a skill's evidence.
//   0 not tried yet:  no graded story
//   1 trying:         graded, never Solid
//   2 shown once:     Solid or better in a story (or in more, but never unaided)
//   3 learned:        Solid or better in two stories, one of them unaided
//   4 strong:         Strong in two stories, one of them unaided
//   5 second nature:  Strong in three stories, two of them unaided
export function skillLevel(evidence: SkillEvidence[]): SkillLevel {
  if (evidence.length === 0) return 0;
  const solid = evidence.filter((e) => e.score >= 3);
  const strong = evidence.filter((e) => e.score >= 4);
  const unaided = (list: SkillEvidence[]) => list.filter((e) => e.unaided).length;
  if (strong.length >= 3 && unaided(strong) >= 2) return 5;
  if (strong.length >= 2 && unaided(strong) >= 1) return 4;
  if (solid.length >= 2 && unaided(solid) >= 1) return 3;
  if (solid.length >= 1) return 2;
  return 1;
}

// What gets the skill to its next level, addressed to the user.
export function nextStep(level: SkillLevel, evidence: SkillEvidence[]): string | undefined {
  const solid = evidence.filter((e) => e.score >= 3);
  const strong = evidence.filter((e) => e.score >= 4);
  switch (level) {
    case 0:
      return "Shows up once you get a story graded.";
    case 1:
      return "Get it to Solid in one story.";
    case 2:
      return solid.length >= 2
        ? "Show it in your next story before I ask about it."
        : "Show it in one more story, ideally before I ask about it.";
    case 3:
      return strong.length >= 1
        ? "Get it to Strong in one more story."
        : "Get it to Strong in two stories.";
    case 4:
      return "Get it to Strong in a third story, on your own.";
    default:
      return undefined;
  }
}

export type SkillStatus = {
  skill: Skill;
  level: SkillLevel;
  stories: number;
  next?: string;
};

export function skillsMap(stories: StoryLike[]): SkillStatus[] {
  const evidence = skillEvidence(stories);
  return SKILLS.map((skill) => {
    const level = skillLevel(evidence[skill.id]);
    return {
      skill,
      level,
      stories: evidence[skill.id].length,
      next: nextStep(level, evidence[skill.id]),
    };
  });
}

// Whether there's anything to map yet: at least one graded behavioral story.
export function hasSkillData(map: SkillStatus[]): boolean {
  return map.some((s) => s.level > 0);
}

// The skills a new story's questions should look at first: not yet Learned, weakest first, at
// most two. Only once there's a graded story to go on.
export function weakestSkills(map: SkillStatus[], max = 2): Skill[] {
  if (!hasSkillData(map)) return [];
  return map
    .filter((s) => s.level > 0 && s.level < LEARNED)
    .sort((a, b) => a.level - b.level)
    .slice(0, max)
    .map((s) => s.skill);
}

// For the follow-up prompt: what this person is still learning across their stories.
export function weakSkillsInstructions(skills: Skill[]): string {
  if (skills.length === 0) return "";
  const lines = skills.map((s) => `- ${s.label}: ${s.what}`);
  return `Across their earlier stories, this person is still learning:
${lines.join("\n")}
If this telling is thin on one of these, ask about it among your first questions, so they practice it. Don't ask about one their telling already covers well.`;
}

// "Spot it yourself" (from the same tutor): before the level-up shows what a story is missing, the
// user picks what they think an interviewer can't tell yet. A miss gets a narrower hint, not the
// answer; a second miss shows it. "Just fix it" skips straight to the level-up.

export const MAX_SPOT_TRIES = 2;

// The skills the gaps to the next level are about, most important first.
export function spotTargets(gaps: LevelGap[]): SkillId[] {
  const out: SkillId[] = [];
  for (const g of gaps) {
    const skill = skillForLevelGap(g);
    if (skill && !out.includes(skill)) out.push(skill);
  }
  return out;
}

// The choices offered: Level 2 is about the core of the story, Level 3 adds thinking and the lesson.
export function spotChoices(target: number): Skill[] {
  return target >= 3 ? [...SKILLS] : SKILLS.filter((s) => s.id !== "thinking" && s.id !== "lesson");
}

export type SpotOutcome = "found" | "hint" | "revealed";

// What a pick leads to: right (any of the targets), or a hint on the first miss, then the answer.
export function spotOutcome(pick: SkillId, targets: SkillId[], tries: number): SpotOutcome {
  if (targets.includes(pick)) return "found";
  return tries + 1 >= MAX_SPOT_TRIES ? "revealed" : "hint";
}

// The narrower question after a miss: which part to reread, and what to ask of it.
export function spotHint(targets: SkillId[]): string {
  const skill = skillInfo(targets[0]);
  return `Reread your “${skill.partLabel}” part and ask yourself: ${skill.hint}`;
}
