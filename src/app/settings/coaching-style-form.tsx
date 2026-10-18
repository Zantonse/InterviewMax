"use client";

import { useActionState, useState } from "react";
import { COACHING_STYLES, STYLE_OPTIONS, type CoachingStyle } from "@/lib/coaching/style";
import { saveStyle, type StyleState } from "./actions";

// Pick how the coach talks to you. Saves on submit; the choice shows as saved until it changes.
export function CoachingStyleForm({ initial }: { initial: CoachingStyle }) {
  const [state, action, pending] = useActionState<StyleState, FormData>(saveStyle, null);
  const [style, setStyle] = useState<CoachingStyle>(initial);
  const saved = state?.saved ?? initial;

  return (
    <form action={action} className="mt-4 space-y-3" data-testid="coaching-style-form">
      <fieldset>
        <legend className="sr-only">Coaching style</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {COACHING_STYLES.map((s) => (
            <label
              key={s}
              className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 ring-1 ${
                style === s ? "bg-ink-50 ring-ink-700" : "bg-white ring-slate-300"
              }`}
            >
              <input
                type="radio"
                name="style"
                value={s}
                checked={style === s}
                onChange={() => setStyle(s)}
                className="mt-1 accent-ink-800"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-900">
                  {STYLE_OPTIONS[s].label}
                </span>
                <span className="block text-sm text-slate-600">{STYLE_OPTIONS[s].description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || style === saved}
          className="rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save coaching style"}
        </button>
        {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
        {!state?.error && state?.saved && style === saved && (
          <span className="text-sm text-slate-600">Saved.</span>
        )}
      </div>
    </form>
  );
}
