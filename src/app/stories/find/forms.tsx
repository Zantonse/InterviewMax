"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { QUICK_QUESTIONS, MAX_QUICK_ANSWER_LENGTH } from "@/lib/finder/content";
import { findStoryMoments, saveQuickAnswers } from "./actions";

// A suggested moment. Sits inside a form whose action is startFromMoment.
export function MomentButton({
  id,
  moment,
  question,
  quote,
  sourceLabel,
}: {
  id: string;
  moment: string;
  question: string;
  quote: string;
  sourceLabel: string;
}) {
  const { pending, data } = useFormStatus();
  const starting = pending && data?.get("moment") === id;
  return (
    <button
      type="submit"
      name="moment"
      value={id}
      disabled={pending}
      className="group flex h-full w-full flex-col rounded-3xl bg-white p-5 text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-navy-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-700 disabled:translate-y-0 disabled:opacity-70"
      data-testid={`moment-${id}`}
    >
      <span className="font-bold text-slate-900 group-hover:text-navy-900">{moment}</span>
      {question && <span className="mt-0.5 text-slate-700">{capitalize(question)}</span>}
      <span className="mt-2 line-clamp-2 text-sm text-slate-500">
        From {sourceLabel}: &ldquo;{quote}&rdquo;
      </span>
      <span className="mt-3 text-sm font-semibold text-navy-800">
        {starting ? "Starting…" : "Build this story →"}
      </span>
    </button>
  );
}

function capitalize(text: string) {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

// The first visit: read the sources straight away, then show what was found.
export function AutoFind({ reading }: { reading: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const started = useRef(false);

  function find() {
    setError(null);
    startTransition(async () => {
      const result = await findStoryMoments();
      if (!result.ok) setError(result.error);
    });
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    find();
  }, []);

  return (
    <section className="mt-8 max-w-2xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      {error ? (
        <>
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
          <button
            type="button"
            onClick={find}
            disabled={pending}
            className="mt-4 rounded-xl bg-navy-800 px-4 py-2.5 font-semibold text-white hover:bg-navy-900 disabled:opacity-70"
          >
            Try again
          </button>
        </>
      ) : (
        <p className="animate-pulse text-slate-600" data-testid="finding">
          Reading {reading} for story moments…
        </p>
      )}
    </section>
  );
}

export function FindAgainButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await findStoryMoments();
            if (!result.ok) setError(result.error);
          })
        }
        className="rounded-xl px-3 py-2 text-sm font-semibold text-navy-800 ring-1 ring-navy-800/20 hover:bg-navy-50 disabled:opacity-70"
        data-testid="find-again"
      >
        {pending ? "Finding…" : "Find new suggestions"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function QuickQuestions({ initial }: { initial: Record<string, string> }) {
  const [state, action, pending] = useActionState(saveQuickAnswers, null);
  return (
    <form action={action} className="mt-5 space-y-4" data-testid="quick-questions">
      {QUICK_QUESTIONS.map((q, i) => (
        <label key={q.id} className="block">
          <span className="font-medium text-slate-800">
            {i + 1}. {q.text}
          </span>
          <textarea
            name={q.id}
            defaultValue={initial[q.id] ?? ""}
            rows={3}
            maxLength={MAX_QUICK_ANSWER_LENGTH}
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 focus:border-navy-700 focus:outline-none focus:ring-1 focus:ring-navy-700"
          />
        </label>
      ))}
      {state && !state.ok && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-navy-800 px-4 py-2.5 font-semibold text-white hover:bg-navy-900 disabled:opacity-70"
      >
        {pending ? "Finding your stories…" : "Find my stories"}
      </button>
    </form>
  );
}
