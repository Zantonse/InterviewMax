"use client";

import { useActionState, useId } from "react";
import { useFormStatus } from "react-dom";
import {
  LEVELS,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
  RESUME_EXTENSIONS,
} from "@/lib/jobs/content";
import { addJob, confirmLevel, rereadJobs, saveResume, type FormState } from "./actions";

const INPUT =
  "mt-1 w-full rounded-xl border-0 bg-white px-3 py-2.5 text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-700 focus:outline-none";
const PRIMARY =
  "rounded-xl bg-teal-800 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-900 disabled:opacity-60";
const SECONDARY =
  "rounded-xl px-4 py-2.5 font-semibold text-teal-800 ring-1 ring-teal-800/20 transition hover:bg-teal-50 disabled:opacity-60";

export function AddJobForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(addJob, null);
  const id = useId();
  return (
    <form action={action} className="space-y-4" data-testid="add-job-form">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-title`}>
          Job title
          <input
            id={`${id}-title`}
            name="title"
            required
            maxLength={MAX_TITLE_LENGTH}
            placeholder="e.g. Senior Solutions Engineer"
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
      </div>
      <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-description`}>
        The job posting
        <textarea
          id={`${id}-description`}
          name="description"
          required
          rows={10}
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder="Paste the whole posting: the responsibilities and requirements are what I read."
          className={INPUT}
        />
      </label>
      {state?.error && <ErrorLine>{state.error}</ErrorLine>}
      <button type="submit" disabled={pending} className={PRIMARY}>
        {pending ? "Reading the posting…" : "Add this job"}
      </button>
    </form>
  );
}

export function ResumeForm({ hasResume }: { hasResume: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveResume, null);
  const id = useId();
  return (
    <form action={action} className="space-y-3" data-testid="resume-form">
      <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-file`}>
        {hasResume ? "Replace it with a file" : "Upload your resume"}
        <input
          id={`${id}-file`}
          type="file"
          name="file"
          accept={RESUME_EXTENSIONS.join(",")}
          className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:font-semibold file:text-teal-900"
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-text`}>
        Or paste it
        <textarea id={`${id}-text`} name="text" rows={4} className={INPUT} />
      </label>
      {state?.error && <ErrorLine>{state.error}</ErrorLine>}
      <button type="submit" disabled={pending} className={SECONDARY}>
        {pending ? "Reading your resume…" : "Save resume"}
      </button>
    </form>
  );
}

export function RereadButton() {
  const [state, action, pending] = useActionState<FormState>(rereadJobs, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button type="submit" disabled={pending} className={PRIMARY}>
        {pending ? "Reading your jobs…" : "Read my jobs again"}
      </button>
      {state?.error && <ErrorLine>{state.error}</ErrorLine>}
    </form>
  );
}

export function LevelForm({
  jobId,
  level,
  confirmed,
}: {
  jobId: string;
  level: string | null;
  confirmed: boolean;
}) {
  const id = useId();
  return (
    <form action={confirmLevel} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="jobId" value={jobId} />
      <label className="block text-sm font-semibold text-slate-700" htmlFor={id}>
        {confirmed ? "Level" : "Level (suggested from the title)"}
        <select id={id} name="level" defaultValue={level ?? "mid"} className={INPUT}>
          {LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <LevelButton confirmed={confirmed} />
    </form>
  );
}

function LevelButton({ confirmed }: { confirmed: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={SECONDARY}>
      {pending ? "Saving…" : confirmed ? "Change" : "That's right"}
    </button>
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
