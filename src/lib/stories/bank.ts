import type { LevelId } from "@/lib/jobs/content";
import { QUESTION_THEMES, type QuestionThemeId } from "@/lib/questions/themes";
import { builderStage, gradeIsCurrent, type StoryContent } from "./content";
import { BANK_ROLES } from "./grading";
import { getStoryType, type StoryTypeId } from "./story-types";

// The story bank at a glance (PRD, step 6): which of the ten question themes the user's stories
// cover, and whether the level of their stories fits the target role. Code only, from the stories
// and their saved grades; no model call.

type StoryLike = {
  id: string;
  title: string;
  storyType: string | null;
  content: StoryContent;
};

// How well a theme is covered, from best to worst: the tier of its best graded story, "written" for
// a draft without a current grade, then "in_progress". "empty" means no story of its types yet.
export type ThemeStatus = "strong" | "good_enough" | "not_yet" | "written" | "in_progress" | "empty";

export type ThemeCoverage = {
  id: QuestionThemeId;
  label: string;
  status: ThemeStatus;
  // The best story covering the theme.
  story?: { id: string; title: string };
  // With no story yet: the story type to start for it.
  build?: StoryTypeId;
};

const STATUS_RANK: Record<ThemeStatus, number> = {
  strong: 5,
  good_enough: 4,
  not_yet: 3,
  written: 2,
  in_progress: 1,
  empty: 0,
};

function storyStatus(story: StoryLike): ThemeStatus {
  if (builderStage(story.content, getStoryType(story.storyType)) !== "drafted") return "in_progress";
  const grade = story.content.grade;
  return grade && gradeIsCurrent(story.content) ? grade.tier : "written";
}

export function themeCoverage(stories: StoryLike[]): ThemeCoverage[] {
  return QUESTION_THEMES.map((theme) => {
    const types: readonly string[] = theme.storyTypes;
    let best: { story: StoryLike; status: ThemeStatus } | undefined;
    for (const story of stories) {
      if (!story.storyType || !types.includes(story.storyType)) continue;
      const status = storyStatus(story);
      if (!best || STATUS_RANK[status] > STATUS_RANK[best.status]) best = { story, status };
    }
    if (!best) {
      return { id: theme.id, label: theme.label, status: "empty", build: theme.storyTypes[0] };
    }
    return {
      id: theme.id,
      label: theme.label,
      status: best.status,
      story: { id: best.story.id, title: best.story.title },
    };
  });
}

// A theme counts as covered once a story for it is written.
export function isCovered(status: ThemeStatus): boolean {
  return STATUS_RANK[status] >= STATUS_RANK.written;
}

// The level mix (PRD: "level judged across the story bank"). Each graded behavioral story does one
// job in the bank (grading.ts BANK_ROLES). A role level needs a few stories at or above a scope, for
// example a principal role needs two organization-level stories. Hands-on stories are never counted
// as short: they're useful proof at any level.
export type BankRole = (typeof BANK_ROLES)[number];

export type LevelNeed = {
  // The scope the stories need to reach; stories above it count too.
  role: BankRole;
  needed: number;
  have: number;
};

export type LevelMix = {
  counts: Record<BankRole, number>;
  // Written behavioral stories without a current grade, so their level isn't known yet.
  ungraded: number;
  needs: LevelNeed[];
};

// What each target level needs from the bank, scope by scope.
export const LEVEL_NEEDS: Record<LevelId, { role: BankRole; needed: number }[]> = {
  mid: [{ role: "team-level impact", needed: 1 }],
  senior: [
    { role: "organization-level impact", needed: 1 },
    { role: "team-level impact", needed: 2 },
  ],
  principal: [
    { role: "organization-level impact", needed: 2 },
    { role: "team-level impact", needed: 3 },
  ],
};

const ROLE_RANK = (role: BankRole) => BANK_ROLES.indexOf(role);

function isBankRole(role: string): role is BankRole {
  return (BANK_ROLES as readonly string[]).includes(role);
}

export function levelMix(stories: StoryLike[], level: LevelId | undefined): LevelMix {
  const counts = Object.fromEntries(BANK_ROLES.map((r) => [r, 0])) as Record<BankRole, number>;
  let ungraded = 0;
  for (const story of stories) {
    const type = getStoryType(story.storyType);
    if (!type || type.format === "intro") continue;
    if (builderStage(story.content, type) !== "drafted") continue;
    const role = gradeIsCurrent(story.content) ? story.content.grade?.bankRole?.role : undefined;
    if (role && isBankRole(role)) counts[role] += 1;
    else ungraded += 1;
  }
  const needs = (level ? LEVEL_NEEDS[level] : []).map(({ role, needed }) => ({
    role,
    needed,
    have: BANK_ROLES.filter((r) => ROLE_RANK(r) >= ROLE_RANK(role)).reduce(
      (sum, r) => sum + counts[r],
      0,
    ),
  }));
  return { counts, ungraded, needs };
}

// The highest level among the user's target jobs: the bank should hold up for the hardest one.
export function targetLevel(jobs: { level: string | null }[]): LevelId | undefined {
  const order: LevelId[] = ["principal", "senior", "mid"];
  return order.find((l) => jobs.some((j) => j.level === l));
}

// "one organization-level story, two needed" (or "or above" for the lower scopes).
export function needLabel(need: LevelNeed): string {
  const scope = need.role.replace(" impact", "");
  const top = need.role === BANK_ROLES[BANK_ROLES.length - 1];
  const noun = need.have === 1 ? "story" : "stories";
  return `${countWord(need.have)} ${scope}${top ? "" : " or above"} ${noun}, ${countWord(need.needed)} needed`;
}

function countWord(n: number): string {
  return ["no", "one", "two", "three", "four", "five"][n] ?? String(n);
}
