"use client";

import { useActionState, useState } from "react";
import { saveExecModeSetting, type ExecModeState } from "./actions";
import { SaveStatus } from "./save-status";

// Exec mode on or off. Saves as soon as it changes (design review 2026-11-16, fix 9).
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
          onChange={(e) => {
            setOn(e.target.checked);
            e.currentTarget.form?.requestSubmit();
          }}
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
      <SaveStatus
        pending={pending}
        error={state?.error}
        saved={Boolean(state && state.saved !== undefined) && on === saved}
      />
    </form>
  );
}
