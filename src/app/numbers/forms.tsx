"use client";

import { useActionState, useId, useState } from "react";
import { MAX_ROLE_NAME_LENGTH, MAX_VALUE_LENGTH, OTHER_ROLE } from "@/lib/numbers/checklist";
import type { NumberItem } from "@/lib/numbers/families";
import { chooseRole, saveNumbers, type FormState } from "./actions";

const INPUT =
  "w-full rounded-xl border-0 bg-white px-3 py-2.5 text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-ink-700 focus:outline-none";
const PRIMARY =
  "rounded-xl bg-ink-800 px-4 py-2.5 font-semibold text-white transition hover:bg-ink-900 disabled:opacity-60";
const SECONDARY =
  "rounded-xl px-4 py-2.5 font-semibold text-ink-800 ring-1 ring-ink-800/30 transition hover:bg-ink-50";

export function RoleForm({
  families,
  initialFamilyId,
  initialRoleName,
  submitLabel,
}: {
  families: { id: string; label: string }[];
  initialFamilyId: string;
  initialRoleName: string;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(chooseRole, null);
  const [familyId, setFamilyId] = useState(initialFamilyId);
  const id = useId();
  return (
    <form action={action} className="space-y-4" data-testid="numbers-role-form">
      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">Which role are you in?</legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[...families, { id: OTHER_ROLE, label: "Something else" }].map((f) => (
            <label
              key={f.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ${
                familyId === f.id ? "bg-ink-50 ring-ink-700" : "bg-white ring-slate-300"
              }`}
            >
              <input
                type="radio"
                name="familyId"
                value={f.id}
                checked={familyId === f.id}
                onChange={() => setFamilyId(f.id)}
                className="accent-ink-800"
              />
              <span className="text-sm font-medium text-slate-900">{f.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {familyId === OTHER_ROLE && (
        <div>
          <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-role`}>
            Your role
          </label>
          <input
            id={`${id}-role`}
            name="roleName"
            defaultValue={initialRoleName}
            maxLength={MAX_ROLE_NAME_LENGTH}
            placeholder="e.g. Revenue operations manager"
            className={`mt-1 ${INPUT}`}
          />
          <p className="mt-1 text-xs text-slate-500">
            I&apos;ll draft the numbers interviewers expect for this role. You can change it later.
          </p>
        </div>
      )}
      {state?.error && <ErrorLine>{state.error}</ErrorLine>}
      <button type="submit" disabled={pending} className={PRIMARY}>
        {pending ? (familyId === OTHER_ROLE ? "Drafting your list…" : "Saving…") : submitLabel}
      </button>
    </form>
  );
}

// The numbers to fill in. Someone starting fresh gets them one at a time, with where to find each,
// so a long list never looks like homework; anyone can switch to the whole list. Every input stays
// in the form either way, so one save keeps them all.
export function NumbersForm({
  items,
  values,
}: {
  items: NumberItem[];
  values: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveNumbers, null);
  const [guided, setGuided] = useState(() => !items.some((item) => values[item.id]?.trim()));
  const [step, setStep] = useState(0);
  const id = useId();
  const last = step === items.length - 1;

  function go(to: number) {
    setStep(to);
    // Keeps typing flowing: the next box takes the cursor.
    requestAnimationFrame(() => document.getElementById(`${id}-${items[to]?.id}`)?.focus());
  }

  return (
    <form action={action} data-testid="numbers-form">
      {guided && (
        <div className="mb-4" data-testid="numbers-wizard">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-ink-800" data-testid="numbers-step">
              Number {step + 1} of {items.length}
            </span>
            <button
              type="button"
              onClick={() => setGuided(false)}
              className="font-medium text-slate-500 hover:text-ink-800"
            >
              Show all at once
            </button>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <div
              className="h-full rounded-full bg-accent-400 transition-all"
              style={{ width: `${((step + 1) / items.length) * 100}%` }}
            />
          </div>
        </div>
      )}
      <ol className="flex flex-col divide-y divide-slate-100">
        {items.map((item, i) => (
          <li
            key={item.id}
            className={guided ? (i === step ? "pb-2" : "hidden") : "py-4 first:pt-0"}
            data-testid="number-item"
          >
            <label
              className={`block font-semibold text-slate-900 ${guided ? "text-lg" : ""}`}
              htmlFor={`${id}-${item.id}`}
            >
              {item.label}
            </label>
            <p className="mt-0.5 text-sm text-slate-600">{item.why}</p>
            <p className="mt-0.5 text-sm text-slate-500">
              <span className="font-medium text-slate-700">Where to find it:</span> {item.where}
            </p>
            <input
              id={`${id}-${item.id}`}
              name={`value:${item.id}`}
              defaultValue={values[item.id] ?? ""}
              maxLength={MAX_VALUE_LENGTH}
              placeholder="As you'd say it. Add “about” if it's an estimate."
              onKeyDown={(e) => {
                // In the one-at-a-time view, Enter moves on rather than saving.
                if (guided && e.key === "Enter" && !last) {
                  e.preventDefault();
                  go(step + 1);
                }
              }}
              className={`mt-2 ${INPUT}`}
            />
          </li>
        ))}
      </ol>
      <div className="sticky bottom-0 -mx-5 mt-2 flex flex-wrap items-center gap-3 bg-white/95 px-5 py-3 sm:-mx-6 sm:px-6">
        {guided && !last ? (
          <>
            <button type="button" onClick={() => go(step + 1)} className={PRIMARY}>
              Next
            </button>
            {step > 0 && (
              <button type="button" onClick={() => go(step - 1)} className={SECONDARY}>
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={pending}
              className="text-sm font-medium text-slate-500 hover:text-ink-800 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save and finish later"}
            </button>
          </>
        ) : (
          <>
            <button type="submit" disabled={pending} className={PRIMARY}>
              {pending ? "Saving…" : "Save my numbers"}
            </button>
            {guided && step > 0 && (
              <button type="button" onClick={() => go(step - 1)} className={SECONDARY}>
                Back
              </button>
            )}
          </>
        )}
        {state?.error && <ErrorLine>{state.error}</ErrorLine>}
        {state?.notice && !pending && (
          <p className="text-sm font-medium text-emerald-800" role="status">
            {state.notice}
          </p>
        )}
      </div>
    </form>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium text-red-700" role="alert">
      {children}
    </p>
  );
}
