"use client";

import { useActionState } from "react";
import { startPractice, type StartState } from "./actions";

// Starts a new practice round for a job.
export function StartPracticeForm({
  jobId,
  label = "Start practice",
  secondary = false,
}: {
  jobId: string;
  label?: string;
  secondary?: boolean;
}) {
  const [state, action, pending] = useActionState<StartState, FormData>(startPractice, null);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="jobId" value={jobId} />
      <button
        type="submit"
        disabled={pending}
        className={
          secondary
            ? "rounded-xl px-4 py-2.5 font-semibold text-ink-800 ring-1 ring-ink-800/20 transition hover:bg-ink-50 disabled:opacity-60"
            : "rounded-xl bg-accent-400 px-5 py-3 font-semibold text-ink-950 transition hover:bg-accent-300 disabled:opacity-60"
        }
        data-testid="start-practice"
      >
        {pending ? "Starting…" : label}
      </button>
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
