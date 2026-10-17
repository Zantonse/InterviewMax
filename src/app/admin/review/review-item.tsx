"use client";

import { useActionState } from "react";
import { reviewQuestion, type ReviewState } from "./actions";

// One shared question in the queue: edit it if it needs it, then approve or reject.
export function ReviewItem({
  id,
  question,
  flags,
}: {
  id: string;
  question: string;
  flags: string[];
}) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(reviewQuestion, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <textarea
        name="question"
        defaultValue={question}
        rows={2}
        maxLength={300}
        aria-label="Question"
        className="w-full rounded-xl border-0 bg-white px-3 py-2 text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-ink-700 focus:outline-none"
      />
      {flags.length > 0 && (
        <ul className="space-y-0.5 text-sm text-amber-800">
          {flags.map((f) => (
            <li key={f}>⚠ {f}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          name="decision"
          value="approve"
          disabled={pending}
          className="rounded-xl bg-ink-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-60"
        >
          {flags.length ? "Approve as edited" : "Approve"}
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-60"
        >
          Reject
        </button>
        {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}
