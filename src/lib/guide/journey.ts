// The guided steps shown on a target job's page and after a story is written. Pure functions over
// what the pages already load, so the guidance never costs a model call or a query of its own.
import type { StoryPriority } from "@/lib/jobs/content";
import { coverageFor } from "@/lib/questions/coverage";
import type { LikelyQuestion } from "@/lib/questions/content";
import { type StoryContent, hasDraft } from "@/lib/stories/content";
import { REQUIRED_STORY_TYPE_ID, type StoryTypeId, getStoryType } from "@/lib/stories/story-types";

type StoryLike = { id: string; title: string; storyType: string | null; content: StoryContent };

export type GuideStep = { id: string; label: string; detail: string; href: string; done: boolean };

// How many of a job's likely questions the stories step asks to cover: the top of the list is what
// most interviews reach.
export const TOP_QUESTIONS = 5;

// The four things to do for one target job, in order: see the questions, confirm the level, shape
// "Tell me about yourself" for this company, then have a written story for each top question.
export function jobSteps({
  job,
  company,
  intro,
  stories,
}: {
  job: { id: string; likelyQuestions: { questions: LikelyQuestion[] } | null; levelConfirmed: boolean };
  company: string;
  // The user's "Tell me about yourself", and whether its questions are answered enough to tailor.
  intro: { content: StoryContent; ready: boolean } | undefined;
  stories: StoryLike[];
}): GuideStep[] {
  const questions = job.likelyQuestions?.questions.slice(0, TOP_QUESTIONS) ?? [];
  const covered = questions.filter((q) => {
    const c = coverageFor(q.theme, stories);
    return c?.kind === "story" && c.drafted;
  }).length;
  const tailored = Boolean(intro?.content.tailored?.[job.id]?.draft);

  return [
    {
      id: "questions",
      label: "See the likely questions",
      detail: job.likelyQuestions ? `${job.likelyQuestions.questions.length} predicted` : "Not predicted yet",
      href: "#questions",
      done: Boolean(job.likelyQuestions),
    },
    {
      id: "level",
      label: "Confirm the level",
      detail: job.levelConfirmed ? "Confirmed" : "Sets how senior to sound",
      href: "#level",
      done: job.levelConfirmed,
    },
    {
      id: "about-me",
      label: `Tell me about yourself, for ${company}`,
      detail: tailored ? "Written" : intro?.ready ? "Ready to write" : "Answer a few questions first",
      href: "#about-me",
      done: tailored,
    },
    {
      id: "stories",
      label: "A story for each top question",
      detail: questions.length > 0 ? `${covered} of ${questions.length} ready` : "After the questions",
      href: "#questions",
      done: questions.length > 0 && covered === questions.length,
    },
  ];
}

// The first step not done yet, or undefined when every step is.
export function currentStep(steps: GuideStep[]): GuideStep | undefined {
  return steps.find((s) => !s.done);
}

export type NextStory = {
  storyType: StoryTypeId;
  label: string;
  why: string;
  // The user's unfinished story of this type, to continue rather than start over.
  storyId?: string;
};

// After a story is written: the next one the user's jobs need, most needed first, skipping types
// already written and the one just finished. "Tell me about yourself" has its own path per job.
export function nextStoryToBuild(
  order: StoryPriority[],
  stories: StoryLike[],
  currentType: string | null,
): NextStory | undefined {
  for (const p of order) {
    if (p.storyType === REQUIRED_STORY_TYPE_ID || p.storyType === currentType) continue;
    const type = getStoryType(p.storyType);
    if (!type) continue;
    const mine = stories.filter((s) => s.storyType === type.id);
    if (mine.some((s) => hasDraft(s.content))) continue;
    return { storyType: type.id, label: type.label, why: p.why, storyId: mine[0]?.id };
  }
  return undefined;
}
