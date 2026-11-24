import { READY_LEVEL, type QuestionReadiness } from "@/lib/jobs/readiness";
import { whenLabel } from "@/lib/prep/plan";
import type { StoryRecord } from "@/lib/stories/data";
import { nextFirst, QuestionTable } from "./question-table";
import { SectionHead } from "./section-head";

// How ready a target job is, on its page: how many of its likely questions have a Level 2+ story
// and how long until the interview, as a plain count (design review 2026-11-23: it replaces the
// ring), then each question with the story that answers it, the next one to work on first.
export function ReadinessCard({
  rows,
  ready,
  total,
  days,
  stories,
}: {
  rows: QuestionReadiness[];
  ready: number;
  total: number;
  // Days to the interview: null with no date set or once it's past.
  days: number | null;
  stories: StoryRecord[];
}) {
  if (total === 0) return null;
  return (
    <section className="animate-enter" aria-labelledby="readiness-heading" data-testid="readiness">
      <SectionHead
        id="readiness-heading"
        title="Likely questions"
        note={
          <span data-testid="readiness-count">
            {ready} of {total} have a story at Level {READY_LEVEL} or above
            {days !== null && ` · interview ${whenLabel(days)}`}
          </span>
        }
      />
      <QuestionTable rows={nextFirst(rows)} stories={stories} narrow testId="readiness-rows" />
    </section>
  );
}
