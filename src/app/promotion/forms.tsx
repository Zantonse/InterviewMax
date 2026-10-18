"use client";

import { useActionState, useState } from "react";
import { LEVELS, type LevelId } from "@/lib/jobs/content";
import { saveLadder, saveLevels, saveRedactions, writePacket, type FormState } from "./actions";

const BUTTON =
  "rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-50";
const FIELD =
  "w-full rounded-xl px-3 py-2 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-ink-700 focus:outline-none";

function Status({ state, pending }: { state: FormState; pending: boolean }) {
  if (pending) return null;
  if (state?.error) return <span className="text-sm text-red-700">{state.error}</span>;
  if (state?.saved) return <span className="text-sm text-slate-600">Saved.</span>;
  return null;
}

export function LevelsForm({ current, target }: { current?: LevelId; target?: LevelId }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLevels, null);
  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3" data-testid="levels-form">
      <label className="text-sm font-medium text-slate-700">
        Your level now
        <select name="currentLevel" defaultValue={current ?? ""} className={`mt-1 block ${FIELD}`}>
          <option value="" disabled>
            Pick one
          </option>
          {LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Going for
        <select name="targetLevel" defaultValue={target ?? ""} className={`mt-1 block ${FIELD}`}>
          <option value="">The next level up</option>
          {LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Saving…" : "Save"}
      </button>
      <Status state={state} pending={pending} />
    </form>
  );
}

export function LadderForm({ initial, maxLength }: { initial: string; maxLength: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLadder, null);
  return (
    <form action={action} className="mt-3 space-y-3" data-testid="ladder-form">
      <textarea
        name="ladder"
        defaultValue={initial}
        rows={6}
        maxLength={maxLength}
        placeholder="Paste your company's expectations for your level and the next one (scope, impact, influence…)"
        className={FIELD}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={BUTTON}>
          {pending ? "Reading the ladder…" : initial ? "Read it again" : "Read my ladder"}
        </button>
        <Status state={state} pending={pending} />
      </div>
    </form>
  );
}

export function RedactionsForm({ initial }: { initial: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRedactions, null);
  const [text, setText] = useState(initial);
  return (
    <form action={action} className="mt-3 space-y-3" data-testid="redactions-form">
      <textarea
        name="redactions"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={"Acme Bank = a large bank\nProject Falcon = an internal platform project"}
        className={`${FIELD} font-mono`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending || text === initial} className={BUTTON}>
          {pending ? "Saving…" : "Save names"}
        </button>
        <Status state={state} pending={pending} />
      </div>
    </form>
  );
}

export function PacketButton({ again }: { again: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(writePacket, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3" data-testid="packet-form">
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Writing your packet…" : again ? "Write it again" : "Write my promotion packet"}
      </button>
      {pending && (
        <span className="text-sm text-slate-600">
          This reads every written story; it can take a minute.
        </span>
      )}
      {!pending && state?.error && <span className="text-sm text-red-700">{state.error}</span>}
    </form>
  );
}
