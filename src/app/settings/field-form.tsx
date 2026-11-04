"use client";

import { useActionState, useId, useState } from "react";
import {
  FIELDS,
  type FieldId,
  MAX_FIELD_NAME_LENGTH,
  type UserField,
  getField,
} from "@/lib/field/fields";
import { saveField, type FieldState } from "./actions";

// "Your field": a dropdown of fields, plus a name box for "Something else". A guess (from target job
// titles) is pre-picked and labelled until they save.
export function FieldForm({ initial }: { initial: UserField }) {
  const [state, action, pending] = useActionState<FieldState, FormData>(saveField, null);
  const [id, setId] = useState<FieldId>(initial.id);
  const [name, setName] = useState(initial.name ?? "");
  const selectId = useId();
  const nameId = useId();
  const saved = state?.saved ?? (initial.guessed ? null : { id: initial.id, name: initial.name });
  const unchanged =
    saved !== null && saved.id === id && (id !== "other" || (saved.name ?? "") === name.trim());

  return (
    <form action={action} className="mt-4 space-y-3" data-testid="field-form">
      <div>
        <label htmlFor={selectId} className="sr-only">
          Your field
        </label>
        <select
          id={selectId}
          name="field"
          value={id}
          onChange={(e) => setId(e.target.value as FieldId)}
          className="w-full rounded-xl border-0 bg-white px-3 py-2.5 text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-ink-700 focus:outline-none sm:max-w-md"
        >
          {FIELDS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-sm text-slate-600">{getField(id)?.blurb}</p>
        {initial.guessed && !state?.saved && initial.id !== "generic" && id === initial.id && (
          <p className="mt-1 text-sm text-slate-500" data-testid="field-guess">
            Guessed from your target jobs. Save it to confirm.
          </p>
        )}
      </div>
      {id === "other" && (
        <div>
          <label htmlFor={nameId} className="block text-sm font-semibold text-slate-900">
            What&apos;s your field?
          </label>
          <input
            id={nameId}
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_FIELD_NAME_LENGTH}
            placeholder="e.g. Revenue operations"
            className="mt-1 w-full rounded-xl border-0 bg-white px-3 py-2.5 text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-ink-700 focus:outline-none sm:max-w-md"
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || unchanged || (id === "other" && !name.trim())}
          className="rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save your field"}
        </button>
        {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
        {!state?.error && state?.saved && unchanged && (
          <span className="text-sm text-slate-600">Saved.</span>
        )}
      </div>
    </form>
  );
}
