import Link from "next/link";
import { startStory } from "@/app/stories/new/actions";
import { coverageFor } from "@/lib/questions/coverage";
import { askedLabel, type BankQuestion } from "@/lib/bank/content";
import type { LikelyQuestion } from "@/lib/questions/content";
import { getTheme } from "@/lib/questions/themes";
import type { StoryRecord } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";

// A target job's likely questions, most likely first, each with the story in the bank that answers
// it or the story to build for it.
export function QuestionList({
  questions,
  stories,
  limit,
  compact = false,
}: {
  questions: LikelyQuestion[];
  stories: StoryRecord[];
  limit?: number;
  compact?: boolean;
}) {
  return (
    <ol className="space-y-2" data-testid="question-list">
      {questions.slice(0, limit).map((q, i) => {
        const coverage = coverageFor(q.theme, stories);
        return (
          <li key={q.question} className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5">
            <p className="font-semibold text-slate-900">
              <span className="mr-2 text-ink-800">{i + 1}.</span>
              {q.question}
            </p>
            {!compact && (
              <>
                <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                  <Tag>{getTheme(q.theme)?.label}</Tag>
                  {q.specific && <Tag tone="accent">Only this job</Tag>}
                  {q.source === "report" && <Tag tone="accent">From an interview report</Tag>}
                  {q.source === "transcript" && <Tag tone="accent">Asked you before</Tag>}
                </p>
                {q.why && <p className="mt-1 text-sm text-slate-600">{q.why}</p>}
                <div className="mt-2 text-sm">
                  {coverage?.kind === "story" ? (
                    <Link
                      href={`/stories/${coverage.storyId}`}
                      className="font-medium text-ink-800 hover:underline"
                    >
                      {coverage.drafted ? "Answer with" : "In progress"}: {coverage.title} →
                    </Link>
                  ) : coverage?.kind === "build" ? (
                    <form action={startStory} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="asked" value={q.question} />
                      <span className="text-slate-500">No story for this yet.</span>
                      <button
                        type="submit"
                        name="storyType"
                        value={coverage.storyType}
                        className="font-medium text-ink-800 hover:underline"
                      >
                        Build &ldquo;{getStoryType(coverage.storyType)?.label}&rdquo; →
                      </button>
                    </form>
                  ) : null}
                </div>
              </>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Shared question bank: questions other people were asked at this company in the last six
// months, each with when and for what role, and the story that would answer it.
export function AskedRecently({
  questions,
  company,
  stories,
}: {
  questions: BankQuestion[];
  company: string;
  stories: StoryRecord[];
}) {
  return (
    <div className="mt-6" data-testid="asked-recently">
      <h3 className="font-semibold text-slate-900">Asked recently at {company}</h3>
      <p className="mb-3 text-sm text-slate-600">
        Questions other InterviewMax users were asked there in the last six months, shared without
        answers or names.
      </p>
      <ul className="space-y-2">
        {questions.map((q) => {
          const coverage = q.theme ? coverageFor(q.theme, stories) : undefined;
          return (
            <li key={q.question} className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5">
              <p className="font-semibold text-slate-900">{q.question}</p>
              <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                {q.theme && <Tag>{getTheme(q.theme)?.label}</Tag>}
                <Tag tone="accent">{askedLabel(q)}</Tag>
              </p>
              {coverage?.kind === "story" ? (
                <Link
                  href={`/stories/${coverage.storyId}`}
                  className="mt-2 inline-block text-sm font-medium text-ink-800 hover:underline"
                >
                  {coverage.drafted ? "Answer with" : "In progress"}: {coverage.title} →
                </Link>
              ) : coverage?.kind === "build" ? (
                <form action={startStory} className="mt-2 text-sm">
                  <input type="hidden" name="asked" value={q.question} />
                  <button
                    type="submit"
                    name="storyType"
                    value={coverage.storyType}
                    className="font-medium text-ink-800 hover:underline"
                  >
                    Build &ldquo;{getStoryType(coverage.storyType)?.label}&rdquo; →
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Tag({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "accent" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-semibold ${
        tone === "accent" ? "bg-accent-100 text-accent-900" : "bg-ink-50 text-ink-900"
      }`}
    >
      {children}
    </span>
  );
}
