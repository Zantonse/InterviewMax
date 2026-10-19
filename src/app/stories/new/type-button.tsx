"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

const CARD =
  "group rounded-3xl bg-white p-6 text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-ink-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-700 disabled:translate-y-0 disabled:opacity-70";

export function TypeButton({
  id,
  label,
  blurb,
  badge,
  href,
}: {
  id: string;
  label: string;
  blurb: string;
  badge?: string;
  // Opens an existing story instead of starting a new one.
  href?: string;
}) {
  const { pending, data } = useFormStatus();
  const starting = pending && data?.get("storyType") === id;

  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="block text-lg font-bold text-slate-900 group-hover:text-ink-900">
          {label}
        </span>
        {badge && (
          <span className="shrink-0 rounded-full bg-ink-800 px-2.5 py-1 text-xs font-semibold text-white">
            {badge}
          </span>
        )}
      </span>
      <span className="mt-2 block text-slate-600">{starting ? "Starting…" : blurb}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={CARD} data-testid={`type-${id}`}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type="submit"
      name="storyType"
      value={id}
      disabled={pending}
      className={CARD}
      data-testid={`type-${id}`}
    >
      {body}
    </button>
  );
}

// A likely interview question with no story yet: starts the story that answers it.
export function QuestionButton({
  storyType,
  question,
  note,
}: {
  storyType: string;
  question: string;
  note: string;
}) {
  const { pending, data } = useFormStatus();
  const starting = pending && data?.get("asked") === question;
  return (
    <button
      type="submit"
      name="storyType"
      value={storyType}
      disabled={pending}
      className="group flex h-full w-full items-start justify-between gap-4 rounded-2xl bg-white px-5 py-4 text-left shadow-sm ring-1 ring-black/5 transition hover:ring-ink-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-700 disabled:opacity-70"
      data-testid="question-start"
    >
      <span className="min-w-0">
        <span className="block font-semibold text-slate-900">{question}</span>
        <span className="mt-1 block text-sm text-slate-500">{starting ? "Opening…" : note}</span>
      </span>
      <span className="shrink-0 pt-0.5 text-sm font-semibold text-ink-800 group-hover:underline">
        Answer it →
      </span>
    </button>
  );
}
