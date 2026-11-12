// The finish line (Craig, 2026-11-12, from the competitor and learning-methods review). A job
// search with no end in sight is what makes story prep feel like dread; Koaches sells the opposite
// ("8 core stories"). So the app names one: CORE_STORY_GOAL behavioral stories cover most of what
// an interviewer asks, one a day, in short sessions. With an interview date it sets the pace that
// finishes in time, and each day's story ends with a clear stop ("that's today's").
//
// Rules in code, no model call. Plain logic, safe to import in client components.

import { isWrittenBehavioral } from "@/lib/stories/help-fade";
import type { StoryContent } from "@/lib/stories/content";
import { daysUntil, todayIn } from "./plan";

export const CORE_STORY_GOAL = 6;

// What one story takes, for the promise on screen.
export const MINUTES_PER_STORY = "10 to 15 minutes";

type StoryLike = { id: string; storyType: string | null; content: StoryContent };

export type FinishLine = {
  goal: number;
  written: number;
  // Whether a behavioral story was written today (the user's today): the day's session is done.
  doneToday: boolean;
  // Stories a day it takes to finish before the interview; 1 without a date.
  perDay: number;
  // Days until the interview, when there is one ahead.
  days: number | null;
  // The day the last story gets written at this pace, YYYY-MM-DD; null once the goal is met.
  finishBy: string | null;
  // Days left to practise between the last story and the interview, when there's a date.
  spareDays: number | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

// The counts the finish line is worked out from. The builder gets them for the user's other stories
// and adds the open one as it's written, so the line moves the moment a story is done.
export type FinishCounts = {
  written: number;
  doneToday: boolean;
  today: string;
  interviewDate?: string | null;
  // Where the user is, to tell whether a story written in the builder counts as today's.
  timeZone?: string | null;
};

// Whether a draft written at `writtenAt` (ISO time) was written on `today` where the user is.
export function writtenOn(writtenAt: string, today: string, timeZone?: string | null): boolean {
  return todayIn(timeZone, new Date(writtenAt)) === today;
}

export function finishCounts({
  stories,
  today,
  timeZone,
  interviewDate,
  exceptId,
}: {
  stories: StoryLike[];
  today: string;
  // The user's time zone, so a story written late last night isn't counted as today's.
  timeZone?: string | null;
  interviewDate?: string | null;
  // Leave this story out (the one open in the builder).
  exceptId?: string | null;
}): FinishCounts {
  const written = stories.filter((s) => s.id !== exceptId && isWrittenBehavioral(s));
  return {
    written: written.length,
    doneToday: written.some(
      (s) => s.content.draft && writtenOn(s.content.draft.writtenAt, today, timeZone),
    ),
    today,
    interviewDate,
    timeZone,
  };
}

export function finishLine({ written, doneToday, today, interviewDate }: FinishCounts): FinishLine {
  const remaining = Math.max(0, CORE_STORY_GOAL - written);
  const ahead = interviewDate ? daysUntil(interviewDate, today) : null;
  const days = ahead !== null && ahead >= 0 ? ahead : null;
  // Build days before the interview; today counts unless today's story is already done. With the
  // interview today or tomorrow there's one build day left (the crunch plan narrows what to build).
  const buildDays = days === null ? null : Math.max(1, days - (doneToday ? 1 : 0));
  const perDay =
    remaining === 0 || buildDays === null ? 1 : Math.max(1, Math.ceil(remaining / buildDays));
  const firstDay = doneToday ? addDays(today, 1) : today;
  const finishBy = remaining === 0 ? null : addDays(firstDay, Math.ceil(remaining / perDay) - 1);
  const spareDays =
    days !== null && finishBy ? Math.max(0, days - daysUntil(finishBy, today) - 1) : null;
  return { goal: CORE_STORY_GOAL, written, doneToday, perDay, days, finishBy, spareDays };
}

// "Tue, Nov 17" for a YYYY-MM-DD date.
export function shortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// The pace line under the progress: when they'll be done, or how many a day it takes.
export function paceLine(line: FinishLine): string {
  if (line.written >= line.goal) {
    return "All your core stories are written. Now practise them out loud.";
  }
  const left = line.goal - line.written;
  if (line.days !== null && line.perDay > 2) {
    return `${left} to go and your interview is close, so start with the stories for your top likely questions.`;
  }
  if (line.days !== null && line.perDay === 2) {
    return `Two a day finishes before your interview, on ${shortDate(line.finishBy!)}.`;
  }
  const by = line.finishBy ? shortDate(line.finishBy) : "";
  const spare =
    line.spareDays && line.spareDays > 0
      ? `, with ${line.spareDays === 1 ? "a day" : `${line.spareDays} days`} to practise before your interview`
      : "";
  return left === 1
    ? `One more and you're done, ${by}${spare}.`
    : `One a day and you're done by ${by}${spare}.`;
}
