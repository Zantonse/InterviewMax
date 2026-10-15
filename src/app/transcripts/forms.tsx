"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import {
  MAX_SPEAKER_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_TRANSCRIPT_LENGTH,
  TRANSCRIPT_EXTENSIONS,
} from "@/lib/transcripts/content";
import { addTranscript, reviewAgain, type FormState } from "./actions";

const INPUT =
  "mt-1 w-full rounded-xl border-0 bg-white px-3 py-2.5 text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-ink-700 focus:outline-none";
const PRIMARY =
  "rounded-xl bg-ink-800 px-4 py-2.5 font-semibold text-white transition hover:bg-ink-900 disabled:opacity-60";
const SECONDARY =
  "rounded-xl px-4 py-2.5 font-semibold text-ink-800 ring-1 ring-ink-800/20 transition hover:bg-ink-50 disabled:opacity-60";

export function AddTranscriptForm({
  jobs,
}: {
  jobs: { id: string; title: string; company: string | null }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(addTranscript, null);
  const id = useId();
  return (
    <form action={action} className="space-y-4" data-testid="add-transcript-form">
      <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-file`}>
        Upload a transcript
        <input
          id={`${id}-file`}
          type="file"
          name="file"
          accept={TRANSCRIPT_EXTENSIONS.join(",")}
          className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-50 file:px-3 file:py-2 file:font-semibold file:text-ink-900"
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">
          PDF, Word, text, or the .vtt captions file Zoom, Teams and Meet export.
        </span>
      </label>
      <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-text`}>
        Or paste it
        <textarea
          id={`${id}-text`}
          name="text"
          rows={6}
          maxLength={MAX_TRANSCRIPT_LENGTH}
          placeholder="Both sides of the conversation, with who said what if you have it."
          className={INPUT}
        />
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-title`}>
          Which interview <span className="font-normal text-slate-500">(optional)</span>
          <input
            id={`${id}-title`}
            name="title"
            maxLength={MAX_TITLE_LENGTH}
            placeholder="e.g. Hiring manager round"
            className={INPUT}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-company`}>
          Company <span className="font-normal text-slate-500">(optional)</span>
          <input
            id={`${id}-company`}
            name="company"
            maxLength={MAX_TITLE_LENGTH}
            placeholder="e.g. Acme"
            className={INPUT}
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-speaker`}>
          You&apos;re labelled as <span className="font-normal text-slate-500">(optional)</span>
          <input
            id={`${id}-speaker`}
            name="speaker"
            maxLength={MAX_SPEAKER_LENGTH}
            placeholder='e.g. "Speaker 2" or your name'
            className={INPUT}
          />
        </label>
        {jobs.length > 0 && (
          <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-job`}>
            For one of your target jobs?
            <select id={`${id}-job`} name="jobId" defaultValue="" className={INPUT}>
              <option value="">No, a different job</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                  {j.company ? ` at ${j.company}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {state?.error && <ErrorLine>{state.error}</ErrorLine>}
      <button type="submit" disabled={pending} className={PRIMARY}>
        {pending ? "Reading the interview…" : "Review this interview"}
      </button>
    </form>
  );
}

export function ReviewAgainButton({
  transcriptId,
  reviewed,
}: {
  transcriptId: string;
  reviewed: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(reviewAgain, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="transcriptId" value={transcriptId} />
      <button type="submit" disabled={pending} className={reviewed ? SECONDARY : PRIMARY}>
        {pending ? "Reading the interview…" : reviewed ? "Review again" : "Review this interview"}
      </button>
      {state?.error && <ErrorLine>{state.error}</ErrorLine>}
    </form>
  );
}

export function PendingButton({
  children,
  pendingText,
  className = SECONDARY,
}: {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-medium text-red-700" role="alert">
      {children}
    </p>
  );
}
