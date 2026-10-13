"use client";

import { useId, useState } from "react";
import { gradeIsCurrent, type StoryContent } from "@/lib/stories/content";
import {
  CHECKS,
  SCORE_LABELS,
  TIERS,
  gradingCriteria,
  type StoryGrade,
  type Tier,
} from "@/lib/stories/grading";
import type { StoryType } from "@/lib/stories/story-types";

const TIER_STYLES: Record<Tier, string> = {
  not_yet: "bg-amber-100 text-amber-900",
  good_enough: "bg-teal-100 text-teal-900",
  strong: "bg-teal-800 text-white",
};

// The story's grade, in coaching order: the tier and the next fix first, then the score on each
// criterion and the quick checks, which fold away.
export function EvaluationPanel({
  content,
  storyType,
  grading,
  disabled,
  onGrade,
}: {
  content: StoryContent;
  storyType: StoryType | undefined;
  grading: boolean;
  disabled: boolean;
  onGrade: () => void;
}) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const criteria = gradingCriteria(storyType);
  const grade = gradeIsCurrent(content) ? content.grade : undefined;
  const stale = Boolean(content.draft && content.grade && !grade);

  return (
    <section
      className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
      aria-label="Evaluation criteria"
      data-testid="evaluation"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Evaluation criteria
          </span>
          {grade && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${TIER_STYLES[grade.tier]}`}
              data-testid="tier"
            >
              {TIERS.find((t) => t.id === grade.tier)?.label}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-teal-800">
          {open ? "Hide" : "Show"}
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {/* Always shown: where the story stands and what to do next. */}
      <div className="mt-3">
        {grading ? (
          <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-teal-600" />
            Grading your story against each criterion…
          </p>
        ) : !content.draft ? (
          <p className="text-sm text-slate-500">
            Once your story is written, I&apos;ll grade it on each of these criteria and tell you
            what to fix first.
          </p>
        ) : !grade ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {stale
                ? "The story changed since it was graded."
                : "This story hasn't been graded yet."}
            </p>
            <button
              type="button"
              onClick={onGrade}
              disabled={disabled}
              className="rounded-xl bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-50"
            >
              {stale ? "Grade it again" : "Grade my story"}
            </button>
          </div>
        ) : (
          <Summary grade={grade} />
        )}
      </div>

      <div id={bodyId} hidden={!open} className="mt-5 flex flex-col gap-6">
        <div>
          <h3 className="text-sm font-bold text-slate-700">How it scores</h3>
          <ul className="mt-2 flex flex-col gap-3" data-testid="criteria">
            {criteria.map((c) => {
              const scored = grade?.criteria.find((s) => s.id === c.id);
              return (
                <li key={c.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-800">{c.label}</span>
                    {scored && <ScoreBar score={scored.score} />}
                  </div>
                  <p className="text-sm text-slate-500">{c.question}</p>
                  {scored?.note && <p className="text-sm text-slate-700">{scored.note}</p>}
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-bold text-slate-700">Quick checks</h3>
          <ul className="mt-2 flex flex-col gap-2" data-testid="quick-checks">
            {CHECKS.map((k) => {
              const result = grade?.checks.find((c) => c.id === k.id);
              return (
                <li key={k.id} className="flex gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      !result
                        ? "bg-slate-100 text-slate-400"
                        : result.pass
                          ? "bg-teal-100 text-teal-800"
                          : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {!result ? "·" : result.pass ? "✓" : "!"}
                  </span>
                  <span>
                    <span className="font-medium text-slate-800">{k.label}</span>
                    {result && (
                      <>
                        <span className="sr-only">
                          {result.pass ? " (passes)" : " (needs work)"}
                        </span>
                        <span className="text-slate-500"> {result.detail}</span>
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {grade?.bankRole && (
          <div>
            <h3 className="text-sm font-bold text-slate-700">Its job in your story bank</h3>
            <p className="mt-1 text-sm text-slate-700">
              <span className="font-semibold">
                {grade.bankRole.role[0]?.toUpperCase()}
                {grade.bankRole.role.slice(1)}
              </span>
              {grade.bankRole.note && (
                <span className="text-slate-500">. {grade.bankRole.note}</span>
              )}
            </p>
          </div>
        )}

        {grade && grade.flags.length > 0 && (
          <div
            className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600"
            data-testid="grade-flags"
          >
            <p className="font-semibold text-slate-700">The quick checks and the grader disagree</p>
            <ul className="mt-1 list-disc pl-5">
              {grade.flags.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {grade && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>Strong needs every criterion solid or better and every quick check passing.</span>
            <button
              type="button"
              onClick={onGrade}
              disabled={disabled}
              className="font-medium text-teal-800 hover:underline disabled:opacity-50"
            >
              Grade again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Summary({ grade }: { grade: StoryGrade }) {
  const current = TIERS.findIndex((t) => t.id === grade.tier);
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-wrap items-center gap-1 text-sm" aria-label="Tier">
        {TIERS.map((t, i) => (
          <li key={t.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-300">→</span>}
            <span
              aria-current={i === current ? "step" : undefined}
              className={
                i === current
                  ? "font-semibold text-slate-900"
                  : i < current
                    ? "text-teal-700"
                    : "text-slate-400"
              }
            >
              {t.label}
            </span>
          </li>
        ))}
      </ol>
      {grade.fixes.length > 0 ? (
        <div data-testid="fixes">
          <p className="text-sm font-semibold text-slate-700">
            {grade.tier === "strong" ? "To polish it further:" : "What to fix next:"}
          </p>
          <ol className="mt-1 flex list-decimal flex-col gap-1 pl-5 text-slate-800">
            {grade.fixes.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="text-sm text-slate-700">Nothing pressing to fix.</p>
      )}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  return (
    <span className="flex shrink-0 items-center gap-2" data-testid="score">
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <span
            key={n}
            className={`h-2 w-5 rounded-full ${
              n <= score
                ? score <= 1
                  ? "bg-amber-400"
                  : score === 2
                    ? "bg-teal-300"
                    : "bg-teal-700"
                : "bg-slate-200"
            }`}
          />
        ))}
      </span>
      <span className="w-14 text-right text-sm text-slate-600">
        {SCORE_LABELS[score] ?? score}
        <span className="sr-only">, {score} out of 4</span>
      </span>
    </span>
  );
}
