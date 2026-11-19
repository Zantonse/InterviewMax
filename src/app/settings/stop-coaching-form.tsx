"use client";

import { useActionState, useState } from "react";
import { stopCoachingNow, type StopCoachingState } from "./actions";

// Stops 1:1 coaching after one confirm, so a stray tap doesn't end it.
export function StopCoachingForm() {
  const [state, action, pending] = useActionState<StopCoachingState, FormData>(stopCoachingNow, null);
  const [open, setOpen] = useState(false);

  if (state?.stopped) {
    return (
      <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700" role="status">
        Coaching stopped. Your coach can no longer open your page. Everything you made is still
        here.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
        data-testid="stop-coaching"
      >
        Stop coaching
      </button>
    );
  }

  return (
    <form action={action} className="mt-4 space-y-3" data-testid="stop-coaching-form">
      <p className="text-sm text-slate-700">
        Your coach&apos;s page for you closes straight away. Nothing you&apos;ve made is deleted, and a
        new invite from your coach can start it again.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
          data-testid="stop-coaching-confirm"
        >
          {pending ? "Stopping…" : "Yes, stop coaching"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Keep coaching
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
