// Story Quest boss round: a job's top likely questions asked out loud in one practice round, with
// the interviewer's follow-ups. It stays locked until every one of those questions has a story
// ready to use (Level 2, the app's "ready" everywhere else), so the game sends people back into the
// builder first. Plain logic.

import type { LikelyQuestion } from "@/lib/questions/content";
import { itemDone, type PracticeItem } from "@/lib/practice/content";
import { questionReadiness, READY_LEVEL, type QuestionReadiness } from "@/lib/jobs/readiness";
import { BOSS_XP } from "./xp";
import type { Cta, Journey, JourneyStep } from "./journeys";
import type { QuestSession, QuestStory } from "./xp";

export const BOSS_QUESTIONS = 5;

// The questions a boss round asks: the job's top likely questions, in the order they're ranked.
export function bossQuestions(questions: readonly LikelyQuestion[] | undefined): LikelyQuestion[] {
  return (questions ?? []).slice(0, BOSS_QUESTIONS);
}

export function isBossRound(items: readonly PracticeItem[]): boolean {
  return items.length > 0 && items.every((i) => i.boss);
}

// Run to the end: every question answered or skipped, at least one with feedback.
export function bossRoundDone(items: readonly PracticeItem[]): boolean {
  return isBossRound(items) && items.every(itemDone) && items.some((i) => i.feedback);
}

// The jobs whose boss round has been run to the end, once each.
export function bossJobsDone(sessions: readonly QuestSession[]): Set<string> {
  return new Set(sessions.filter((s) => bossRoundDone(s.items)).map((s) => s.targetJobId));
}

export type BossJob = {
  id: string;
  title: string;
  company: string | null;
  likelyQuestions?: { questions: LikelyQuestion[] } | null;
};

export type BossState = {
  rows: QuestionReadiness[];
  unlocked: boolean;
  done: boolean;
  // A boss round started and not finished, to continue.
  inProgressId?: string;
};

export function bossState(
  job: BossJob,
  stories: readonly QuestStory[],
  sessions: readonly QuestSession[],
): BossState {
  const { rows } = questionReadiness(bossQuestions(job.likelyQuestions?.questions), [...stories]);
  const unlocked = rows.length > 0 && rows.every((r) => r.kind === "story" && r.level >= READY_LEVEL);
  const mine = sessions.filter((s) => s.targetJobId === job.id && isBossRound(s.items));
  const done = mine.some((s) => bossRoundDone(s.items));
  const open = mine.find((s) => !bossRoundDone(s.items) && !s.finishedAt);
  return { rows, unlocked, done, ...(open?.id ? { inProgressId: open.id } : {}) };
}

// The "Get ready for a job" journey: a story ready to use for each top question, then the boss
// round. `next` is a link, or `boss` when the round can start (the page renders a start button).
export function jobJourney(job: BossJob, state: BossState): Journey {
  const name = job.company || job.title;
  const steps: JourneyStep[] = state.rows.map((r, i) => {
    const ready = r.kind === "story" && r.level >= READY_LEVEL;
    return {
      id: `q${i + 1}`,
      label: `${r.question} · ${r.kind === "build" ? "no story yet" : r.level === 0 ? "not written yet" : `Level ${r.level}`}`,
      xp: 0,
      state: ready ? "done" : "now",
    };
  });
  // Only the first question that isn't ready is "now"; the rest wait.
  let seenNow = false;
  for (const s of steps) {
    if (s.state !== "now") continue;
    if (seenNow) s.state = "locked";
    seenNow = true;
  }
  steps.push({
    id: "boss",
    label: "Boss round: all of them out loud, with follow-ups",
    xp: BOSS_XP,
    state: state.done ? "done" : state.unlocked ? "now" : "locked",
  });
  const firstGap = state.rows.find((r) => !(r.kind === "story" && r.level >= READY_LEVEL));
  const next: Cta | undefined = state.done
    ? undefined
    : state.inProgressId
      ? { href: `/practice/${state.inProgressId}`, label: "Continue the boss round" }
      : state.unlocked
        ? undefined
        : firstGap
          ? firstGap.kind === "build"
            ? { href: `/stories/new/${firstGap.storyType}`, label: "Build a story for it" }
            : {
                href: `/stories/${firstGap.storyId}`,
                label: firstGap.level === 0 ? "Finish its story" : "Take its story to Level 2",
              }
          : { href: `/jobs/${job.id}`, label: "Predict this job's likely questions" };
  const ready = state.rows.filter((r) => r.kind === "story" && r.level >= READY_LEVEL).length;
  return {
    id: "boss",
    title: `Get ready for ${name}`,
    blurb: state.done
      ? "Boss round done. Run it again any time from practice."
      : state.rows.length === 0
        ? "Predict this job's likely questions to see what the boss round will ask."
        : state.unlocked
          ? "Every top question has a story ready. The boss round is open."
          : `${ready} of ${state.rows.length} top questions have a story ready. The boss round opens when all of them do.`,
    steps,
    done: state.done,
    ...(next ? { next } : {}),
    ...(state.unlocked && !state.done && !state.inProgressId ? { boss: { jobId: job.id } } : {}),
  };
}
