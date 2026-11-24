import Link from "next/link";
import { startStory } from "@/app/stories/new/actions";
import { LevelMeter } from "@/components/level-meter";
import { READY_LEVEL, type QuestionReadiness } from "@/lib/jobs/readiness";
import type { StoryRecord } from "@/lib/stories/data";
import { clock, storySeconds } from "@/lib/stories/spoken";
import { getStoryType } from "@/lib/stories/story-types";

// A job's likely questions as a table (design review 2026-11-23, fix 6), on home and the job page:
// the question as it'd be asked, the story that answers it, its level and spoken time, and the one
// thing to do. On the job page's narrower column the story goes under the question.

// The one to work on next: the first question with no story, else the first below Level 2. It's
// listed first.
export function nextFirst(rows: QuestionReadiness[]): QuestionReadiness[] {
  const next =
    rows.find((r) => r.kind === "build") ??
    rows.find((r) => r.kind === "story" && r.level < READY_LEVEL);
  return next ? [next, ...rows.filter((r) => r !== next)] : rows;
}

export function QuestionTable({
  rows,
  stories,
  narrow = false,
  testId,
}: {
  rows: QuestionReadiness[];
  stories: StoryRecord[];
  narrow?: boolean;
  testId?: string;
}) {
  const byId = new Map(stories.map((s) => [s.id, s]));
  return (
    <ul className="divide-y divide-ink-100" data-testid={testId}>
      {rows.map((row) => (
        <QuestionRow
          key={row.question}
          row={row}
          story={row.kind === "story" ? byId.get(row.storyId) : undefined}
          narrow={narrow}
        />
      ))}
    </ul>
  );
}

function QuestionRow({
  row,
  story,
  narrow,
}: {
  row: QuestionReadiness;
  story: StoryRecord | undefined;
  narrow: boolean;
}) {
  const draft = story?.content.draft;
  const seconds = draft ? storySeconds(draft.parts, getStoryType(story?.storyType)) : null;
  const answeredBy =
    row.kind === "story" ? (
      <Link
        href={`/stories/${row.storyId}`}
        className="text-sm text-slate-800 underline decoration-ink-200 underline-offset-2 hover:decoration-current"
      >
        {row.title}
      </Link>
    ) : (
      <span className="text-sm text-slate-500">No story yet</span>
    );
  return (
    <li
      className={`grid gap-x-6 gap-y-1.5 py-3.5 ${
        narrow
          ? "sm:grid-cols-[minmax(0,1fr)_6.5rem_3rem_7rem] sm:items-baseline"
          : "md:grid-cols-[minmax(0,1fr)_15rem_6.5rem_3rem_7rem] md:items-baseline"
      }`}
    >
      <div className="min-w-0">
        <p className="font-words text-[1.0625rem] leading-snug text-slate-900">{row.question}</p>
        {narrow && <p className="mt-1">{answeredBy}</p>}
      </div>
      {!narrow && answeredBy}
      {/* One line on a phone; three columns on a wider screen. */}
      <span
        className={`flex flex-wrap items-center gap-x-5 gap-y-1 ${narrow ? "sm:contents" : "md:contents"}`}
      >
        {/* Empty cells drop out of the phone line but keep their column on a wider screen. */}
        <span
          className={`flex items-center gap-1.5 text-sm text-slate-600 empty:hidden ${narrow ? "sm:empty:flex" : "md:empty:flex"}`}
        >
          {row.kind === "story" &&
            (row.level > 0 ? (
              <>
                <LevelMeter level={row.level} />
                Level {row.level}
              </>
            ) : (
              "Not written"
            ))}
        </span>
        <span
          className={`font-mono text-sm text-slate-600 tabular-nums empty:hidden ${narrow ? "sm:text-right sm:empty:block" : "md:text-right md:empty:block"}`}
        >
          {seconds ? clock(seconds) : null}
        </span>
        {row.kind === "story" ? (
          <span className={`text-sm ${narrow ? "sm:text-right" : "md:text-right"}`}>
            {row.level < READY_LEVEL && (
              <Link href={`/stories/${row.storyId}`} className="link">
                {row.level === 0 ? "Finish it" : `To Level ${READY_LEVEL}`}
              </Link>
            )}
          </span>
        ) : (
          <form
            action={startStory}
            className={`text-sm ${narrow ? "sm:text-right" : "md:text-right"}`}
          >
            <input type="hidden" name="asked" value={row.question} />
            <button type="submit" name="storyType" value={row.storyType} className="link">
              Build a story
            </button>
          </form>
        )}
      </span>
    </li>
  );
}
