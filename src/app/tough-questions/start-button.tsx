"use client";

import { useFormStatus } from "react-dom";

// One tough question. Sits inside a form whose action is startTough, which opens the answer
// already started for it or starts one.
export function StartToughButton({
  id,
  label,
  blurb,
  status,
}: {
  id: string;
  label: string;
  blurb: string;
  status: "new" | "started" | "written";
}) {
  const { pending, data } = useFormStatus();
  const opening = pending && data?.get("question") === id;
  return (
    <button
      type="submit"
      name="question"
      value={id}
      disabled={pending}
      className="group flex h-full w-full flex-col rounded-3xl bg-white p-5 text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:ring-ink-700/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-700 disabled:translate-y-0 disabled:opacity-70"
      data-testid={`tough-${id}`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="font-bold text-slate-900 group-hover:text-ink-900">{label}</span>
        {status !== "new" && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              status === "written" ? "bg-ink-800 text-white" : "bg-ink-50 text-ink-800"
            }`}
          >
            {status === "written" ? "Answer ready" : "Started"}
          </span>
        )}
      </span>
      <span className="mt-1 text-sm text-slate-600">{blurb}</span>
      <span className="mt-3 text-sm font-semibold text-ink-800">
        {opening ? "Opening…" : status === "new" ? "Prepare this one →" : "Open it →"}
      </span>
    </button>
  );
}
