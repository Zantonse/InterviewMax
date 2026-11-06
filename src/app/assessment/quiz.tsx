"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { type Answers, type KnownProgress, QUESTIONS } from "@/lib/assessment/journey";
import { COACHING_STYLES, type CoachingStyle, STYLE_OPTIONS } from "@/lib/coaching/style";
import { FIELDS, type FieldId } from "@/lib/field/fields";
import { skipAssessment, submitAssessment } from "./actions";
import { JourneyResult } from "./result";

type Choice = { id: string; label: string; hint?: string };
type QuizStep = { id: string; question: string; options: readonly Choice[] };

// Your field opens the quiz (it's the easiest tap and tailors examples from the first story), the
// journey questions follow, and coaching style closes it. Field and style are saved to Settings,
// where they can be changed any time.
const STEPS: QuizStep[] = [
  {
    id: "field",
    question: "What kind of work do you do?",
    // The named fields first; "not sure" and "something else" close the list.
    options: [
      ...FIELDS.filter((f) => f.id !== "generic" && f.id !== "other"),
      ...FIELDS.filter((f) => f.id === "other" || f.id === "generic"),
    ].map((f) => ({
      id: f.id,
      label: f.id === "other" ? "Something else" : f.id === "generic" ? "Not sure / a mix" : f.label,
    })),
  },
  ...QUESTIONS,
  {
    id: "coachingStyle",
    question: "How do you want me to coach you?",
    options: COACHING_STYLES.map((id) => ({
      id,
      label: STYLE_OPTIONS[id].label,
      hint: STYLE_OPTIONS[id].description,
    })),
  },
];

export const STEP_COUNT = STEPS.length;

export type Picks = Partial<Answers> & { field?: FieldId; coachingStyle?: CoachingStyle };

// One question at a time; a tap answers it and moves on. The last tap saves the answers and shows
// where to start, in place.
export function Quiz({
  known,
  questionsJobId,
  retake = false,
  initial = {},
}: {
  known: KnownProgress;
  questionsJobId?: string;
  // Retaking keeps the last result if they back out, so there's nothing to skip.
  retake?: boolean;
  // Last answers and saved settings, shown as already picked.
  initial?: Picks;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Picks>(initial);
  const [done, setDone] = useState<{ answers: Answers; saved: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  if (done) {
    return (
      <JourneyResult
        answers={done.answers}
        known={known}
        questionsJobId={questionsJobId}
        notSaved={!done.saved}
      />
    );
  }

  const question = STEPS[step];
  const chosen = (answers as Record<string, string | undefined>)[question.id];

  function choose(optionId: string) {
    const next = { ...answers, [question.id]: optionId };
    setAnswers(next);
    setError(null);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    startSaving(async () => {
      const result = await submitAssessment(next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone({ answers: result.answers, saved: result.saved });
    });
  }

  return (
    <section
      className="mt-6 max-w-2xl rounded-3xl bg-white p-6 shadow-sm ring-2 ring-ink-700/40 sm:p-8"
      data-testid="assessment-quiz"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-700">
          {step + 1} of {STEPS.length}
          <span className="flex gap-1" aria-hidden>
            {STEPS.map((q, i) => (
              <span
                key={q.id}
                className={`size-2 rounded-full ${
                  i < step ? "bg-ink-800" : i === step ? "bg-accent-400" : "bg-ink-100"
                }`}
              />
            ))}
          </span>
        </p>
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            disabled={saving}
            className="text-sm font-semibold text-ink-800 hover:underline disabled:opacity-60"
          >
            ← Back
          </button>
        )}
      </div>

      <fieldset className="mt-4" disabled={saving}>
        <legend className="text-xl font-bold text-slate-900">{question.question}</legend>
        <div className="mt-5 grid gap-2">
          {question.options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => choose(option.id)}
              aria-pressed={chosen === option.id}
              className={`rounded-xl px-4 py-3 text-left font-semibold ring-1 transition disabled:opacity-60 ${
                chosen === option.id
                  ? "bg-ink-800 text-white ring-ink-800"
                  : "bg-white text-slate-900 ring-slate-300 hover:bg-ink-50 hover:ring-ink-700"
              }`}
            >
              {option.label}
              {option.hint && (
                <span
                  className={`mt-0.5 block text-sm font-normal ${
                    chosen === option.id ? "text-ink-100" : "text-slate-600"
                  }`}
                >
                  {option.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      </fieldset>

      {saving && (
        <p className="mt-4 text-sm text-slate-600" role="status">
          Working out where to start…
        </p>
      )}
      {error && (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {retake ? (
        <Link
          href="/assessment"
          className="mt-6 inline-block text-sm text-slate-500 hover:text-ink-800 hover:underline"
        >
          Keep my last result
        </Link>
      ) : (
        <form action={skipAssessment} className="mt-6">
          <button
            type="submit"
            className="text-sm text-slate-500 hover:text-ink-800 hover:underline"
          >
            Skip for now
          </button>
        </form>
      )}
    </section>
  );
}
