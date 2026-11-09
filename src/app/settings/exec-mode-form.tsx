"use client";

import { useActionState, useState } from "react";
import { saveExecModeSetting, type ExecModeState } from "./actions";

// Exec mode on or off. Saves on submit; shows as saved until it changes.
export function ExecModeForm({ initial }: { initial: boolean }) {
  const [state, action, pending] = useActionState<ExecModeState, FormData>(saveExecModeSetting, null);
  const [on, setOn] = useState(initial);
  const saved = state?.saved ?? initial;

  return (
    <form action={action} className="mt-4 space-y-3" data-testid="exec-mode-form">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="on"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="mt-1 size-4 accent-ink-800"
          data-testid="exec-mode-toggle"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-900">Show the exec version</span>
          <span className="block text-sm text-slate-600">
            Each written story gets a 30-second, answer-first version for directors and above, with
            what they&apos;d ask next and the hedging words to drop.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || on === saved}
          className="rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
        {!state?.error && state && state.saved !== undefined && on === saved && (
          <span className="text-sm text-slate-600">Saved.</span>
        )}
      </div>
    </form>
  );
}
