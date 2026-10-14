"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { type Answers, QUESTIONS } from "@/lib/assessment/journey";
import { skipAssessment, submitAssessment } from "./actions";
import { JourneyResult } from "./result";

// One question at a time; a tap answers it and moves on. The last tap saves the answers and shows
// the grade in place.
export function Quiz({
  hasJob,
  questionsJobId,
  retake = false,
}: {
  hasJob: boolean;
  questionsJobId?: string;
  // Retaking keeps the last result if they back out, so there's nothing to skip.
  retake?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [done, setDone] = useState<{ answers: Answers; saved: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  if (done) {
    return (
      <JourneyResult
        answers={done.answers}
        hasJob={hasJob}
        questionsJobId={questionsJobId}
        notSaved={!done.saved}
      />
    );
  }

  const question = QUESTIONS[step];
  const chosen = answers[question.id];

  function choose(optionId: string) {
    const next = { ...answers, [question.id]: optionId };
    setAnswers(next);
    setError(null);
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
      return;
    }
    startSaving(async () => {
      const result = await submitAssessment(next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone({ answers: next as Answers, saved: result.saved });
    });
  }

  return (
    <section
      className="mt-6 max-w-2xl rounded-3xl bg-white p-6 shadow-sm ring-2 ring-navy-700/40 sm:p-8"
      data-testid="assessment-quiz"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-navy-700">
          {step + 1} of {QUESTIONS.length}
          <span className="flex gap-1" aria-hidden>
            {QUESTIONS.map((q, i) => (
              <span
                key={q.id}
                className={`size-2 rounded-full ${
                  i < step ? "bg-navy-800" : i === step ? "bg-amber-400" : "bg-navy-100"
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
            className="text-sm font-semibold text-navy-800 hover:underline disabled:opacity-60"
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
                  ? "bg-navy-800 text-white ring-navy-800"
                  : "bg-white text-slate-900 ring-slate-300 hover:bg-navy-50 hover:ring-navy-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {saving && (
        <p className="mt-4 text-sm text-slate-600" role="status">
          Working out your grade…
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
          className="mt-6 inline-block text-sm text-slate-500 hover:text-navy-800 hover:underline"
        >
          Keep my last result
        </Link>
      ) : (
        <form action={skipAssessment} className="mt-6">
          <button
            type="submit"
            className="text-sm text-slate-500 hover:text-navy-800 hover:underline"
          >
            Skip for now
          </button>
        </form>
      )}
    </section>
  );
}
