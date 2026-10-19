"use client";

import { useActionState, useEffect, useId, useState } from "react";
import {
  type Guideline,
  MAX_BODY_LENGTH,
  MAX_TITLE_LENGTH,
  guidelineBlocks,
} from "@/lib/coaching/guidelines";
import { saveGuideline, type GuidelineState } from "./actions";

const INPUT =
  "w-full rounded-xl border-0 bg-white px-3 py-2 text-slate-900 ring-1 ring-slate-300 focus:ring-2 focus:ring-ink-700 focus:outline-none";
const PRIMARY =
  "rounded-xl bg-ink-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-60";
const SECONDARY =
  "rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-60";

// One section of the guidelines: read it, or edit its title and text in place.
export function GuidelineSection({ guideline }: { guideline: Guideline }) {
  const [editing, setEditing] = useState(false);
  if (editing) return <GuidelineEditor guideline={guideline} onDone={() => setEditing(false)} />;
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-900">{guideline.title}</h2>
        <button type="button" onClick={() => setEditing(true)} className={SECONDARY}>
          Edit
        </button>
      </div>
      <GuidelineBody body={guideline.body} />
    </section>
  );
}

// Adds a new section at the end.
export function NewGuideline() {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={SECONDARY}>
        + Add a section
      </button>
    );
  }
  return <GuidelineEditor onDone={() => setOpen(false)} />;
}

function GuidelineEditor({ guideline, onDone }: { guideline?: Guideline; onDone: () => void }) {
  const [state, action, pending] = useActionState<GuidelineState, FormData>(saveGuideline, null);
  const id = useId();
  useEffect(() => {
    if (state?.saved) onDone();
  }, [state, onDone]);

  return (
    <form
      action={action}
      className="space-y-3 rounded-3xl bg-white p-6 shadow-sm ring-2 ring-ink-700"
      data-testid="guideline-editor"
    >
      <input type="hidden" name="id" value={guideline?.id ?? ""} />
      <div>
        <label htmlFor={`${id}-title`} className="block text-sm font-semibold text-slate-700">
          Title
        </label>
        <input
          id={`${id}-title`}
          name="title"
          defaultValue={guideline?.title ?? ""}
          maxLength={MAX_TITLE_LENGTH}
          required
          autoFocus={!guideline}
          className={`mt-1 ${INPUT}`}
        />
      </div>
      <div>
        <label htmlFor={`${id}-body`} className="block text-sm font-semibold text-slate-700">
          Text
        </label>
        <textarea
          id={`${id}-body`}
          name="body"
          defaultValue={guideline?.body ?? ""}
          rows={12}
          maxLength={MAX_BODY_LENGTH}
          className={`mt-1 font-mono text-sm ${INPUT}`}
        />
        <p className="mt-1 text-xs text-slate-500">
          Start a line with &ldquo;- &rdquo; for a bullet or &ldquo;- [ ] &rdquo; for a checklist
          item. A blank line starts a new paragraph.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" name="intent" value="save" disabled={pending} className={PRIMARY}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onDone} disabled={pending} className={SECONDARY}>
          Cancel
        </button>
        {guideline && (
          <button
            type="submit"
            name="intent"
            value="delete"
            disabled={pending}
            onClick={(e) => {
              if (!window.confirm(`Delete “${guideline.title}”?`)) e.preventDefault();
            }}
            className="ml-auto rounded-xl px-3 py-1.5 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50 disabled:opacity-60"
          >
            Delete section
          </button>
        )}
        {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}

function GuidelineBody({ body }: { body: string }) {
  const blocks = guidelineBlocks(body);
  if (blocks.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">Nothing written yet.</p>;
  }
  return (
    <div className="mt-3 space-y-3 text-slate-700">
      {blocks.map((b, i) =>
        b.kind === "paragraph" ? (
          <p key={i}>{b.text}</p>
        ) : b.kind === "bullets" ? (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {b.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <ul key={i} className="space-y-1.5">
            {b.items.map((item, j) => (
              <li key={j} className="flex items-start gap-2">
                <span
                  aria-hidden
                  className="mt-1 inline-block h-4 w-4 shrink-0 rounded border border-ink-700"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
