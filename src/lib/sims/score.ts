import { parseContent } from "@/lib/stories/content";
import { scoreOutOf100, type Tier } from "@/lib/stories/grading";
import { ownWordsShare } from "@/lib/stories/own-words";
import { REQUIRED_STORY_TYPE_ID } from "@/lib/stories/story-types";
import type { Action } from "./agent";

// Scores one persona's run from what it did (the steps) and what it made (the result route's
// rows). Pure, so it's tested without a browser.

export type StepRecord = {
  step: number;
  path: string;
  thought: string;
  feeling?: string;
  action: Action;
  summary: string;
  // What appeared on the page after the action.
  appText: string;
  // Seconds from the action until the page settled.
  seconds: number;
  // The page looked the same after the action.
  noChange: boolean;
  errors: string[];
  screenshot?: string;
};

export type ResultPayload = {
  stories: {
    id: string;
    title: string;
    story_type: string | null;
    content: unknown;
    tier: string | null;
    created_at: string;
    updated_at: string;
  }[];
  jobs: { title: string; company: string | null; hasLikelyQuestions: boolean }[];
  events: { event: string; created_at: string }[];
  signals: { kind: string; path: string; target: string; created_at: string }[];
};

export type StoryOutcome = {
  title: string;
  storyType: string | null;
  asked?: string;
  answers: number;
  followUpsAsked: number;
  followUpsAnswered: number;
  followUpsSkipped: number;
  drafted: boolean;
  ownWords?: number;
  graded: boolean;
  tier?: Tier;
  score?: number;
  fixes: string[];
  summary?: string;
  draftText?: string;
};

export type RunMetrics = {
  outcome: "graded" | "drafted" | "started" | "nothing" | "gave_up" | "error";
  steps: number;
  minutes: number;
  slowSteps: number;
  noChangeSteps: number;
  longestStuck: number;
  errors: number;
  gaveUp?: string;
  jobAdded: boolean;
  likelyQuestions: boolean;
  story?: StoryOutcome;
  events: Record<string, number>;
  signals: Record<string, number>;
};

export const SLOW_STEP_SECONDS = 30;

function count<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1;
  return out;
}

export function storyOutcome(row: ResultPayload["stories"][number]): StoryOutcome {
  const content = parseContent(row.content);
  const followUps = content.followUps ?? [];
  const draftText = content.draft ? Object.values(content.draft.parts).join("\n\n") : undefined;
  const answers = [
    ...Object.values(content.answers),
    ...followUps.map((f) => f.answer ?? ""),
  ].join("\n");
  const grade = content.grade;
  return {
    title: row.title,
    storyType: row.story_type,
    asked: content.asked,
    answers: Object.values(content.answers).filter((a) => a.trim()).length,
    followUpsAsked: followUps.length,
    followUpsAnswered: followUps.filter((f) => f.answer?.trim()).length,
    followUpsSkipped: followUps.filter((f) => f.skipped).length,
    drafted: Boolean(content.draft),
    ownWords: content.draft
      ? (content.draft.ownWords ?? ownWordsShare(draftText ?? "", answers))
      : undefined,
    graded: Boolean(grade),
    tier: grade?.tier,
    score: grade ? scoreOutOf100(grade.criteria) : undefined,
    fixes: grade?.fixes ?? [],
    summary: grade?.summary,
    draftText,
  };
}

// The story that counts: the furthest-along behavioral story (graded, then drafted, then most
// answers). About me stories are left out, since the goal is a behavioral story.
export function bestStory(stories: ResultPayload["stories"]): StoryOutcome | undefined {
  const outcomes = stories
    .filter((s) => s.story_type !== REQUIRED_STORY_TYPE_ID)
    .map(storyOutcome);
  const rank = (o: StoryOutcome) => (o.graded ? 2 : o.drafted ? 1 : 0) * 1000 + o.answers + o.followUpsAnswered;
  return outcomes.sort((a, b) => rank(b) - rank(a))[0];
}

export function scoreRun(input: {
  steps: StepRecord[];
  result: ResultPayload | null;
  startedAt: number;
  endedAt: number;
  crashed?: string;
}): RunMetrics {
  const { steps, result } = input;
  let longestStuck = 0;
  let run = 0;
  for (const s of steps) {
    run = s.noChange ? run + 1 : 0;
    longestStuck = Math.max(longestStuck, run);
  }
  const last = steps.at(-1)?.action;
  const story = result ? bestStory(result.stories) : undefined;
  const outcome: RunMetrics["outcome"] = input.crashed
    ? "error"
    : story?.graded
      ? "graded"
      : story?.drafted
        ? "drafted"
        : last?.type === "give_up"
          ? "gave_up"
          : story
            ? "started"
            : "nothing";
  return {
    outcome,
    steps: steps.length,
    minutes: Math.round(((input.endedAt - input.startedAt) / 60000) * 10) / 10,
    slowSteps: steps.filter((s) => s.seconds >= SLOW_STEP_SECONDS).length,
    noChangeSteps: steps.filter((s) => s.noChange).length,
    longestStuck,
    errors: steps.reduce((n, s) => n + s.errors.length, 0) + (input.crashed ? 1 : 0),
    gaveUp: last?.type === "give_up" ? last.reason : undefined,
    jobAdded: (result?.jobs.length ?? 0) > 0,
    likelyQuestions: result?.jobs.some((j) => j.hasLikelyQuestions) ?? false,
    story,
    events: count(result?.events ?? [], (e) => e.event),
    signals: count(result?.signals ?? [], (s) => s.kind),
  };
}
