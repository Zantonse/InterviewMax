"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  MAX_SPEAKER_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_TRANSCRIPT_LENGTH,
  TRANSCRIPT_EXTENSIONS,
} from "@/lib/transcripts/content";
import { SPEAKER_LABELS, type SpeakerRole, type SpeakerTurn } from "@/lib/transcripts/speakers";
import { ROUNDS } from "@/lib/bank/content";
import {
  addTranscript,
  relabelTranscript,
  reviewAgain,
  shareQuestions,
  type FormState,
} from "./actions";
import { AiNotice } from "@/components/ai-notice";

const INPUT =
  "mt-1 w-full rounded-xl border-0 bg-white px-3 py-2.5 text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-ink-700 focus:outline-none";
const PRIMARY =
  "rounded-xl bg-ink-800 px-4 py-2.5 font-semibold text-white transition hover:bg-ink-900 disabled:opacity-60";
const SECONDARY =
  "rounded-xl px-4 py-2.5 font-semibold text-ink-800 ring-1 ring-ink-800/20 transition hover:bg-ink-50 disabled:opacity-60";

export function AddTranscriptForm({
  jobs,
  jobId = "",
}: {
  jobs: { id: string; title: string; company: string | null }[];
  // Picked up front when adding from a job's page.
  jobId?: string;
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
        <AiNotice purpose="find what the interviewers asked and probed" className="mt-1" />
      </label>
      <label className="block text-sm font-semibold text-slate-700" htmlFor={`${id}-text`}>
        Or paste it
        <textarea
          id={`${id}-text`}
          name="text"
          rows={6}
          maxLength={MAX_TRANSCRIPT_LENGTH}
          placeholder="Both sides of the conversation. No speaker names? That's fine, I'll mark who said what."
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
            <select
              id={`${id}-job`}
              name="jobId"
              defaultValue={jobs.some((j) => j.id === jobId) ? jobId : ""}
              className={INPUT}
            >
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
      <ShareFields />
      {state?.error && <ErrorLine>{state.error}</ErrorLine>}
      <button type="submit" disabled={pending} className={PRIMARY}>
        {pending ? "Reading the interview…" : "Review this interview"}
      </button>
    </form>
  );
}

// Shared question bank opt-in: off by default. The round only matters when sharing.
function ShareFields() {
  const [share, setShare] = useState(false);
  const id = useId();
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5">
      <label className="flex items-start gap-2 text-sm text-slate-800" htmlFor={`${id}-share`}>
        <input
          id={`${id}-share`}
          type="checkbox"
          name="share"
          checked={share}
          onChange={(e) => setShare(e.target.checked)}
          className="mt-0.5 size-4 rounded border-slate-300"
          data-testid="share-questions"
        />
        <span>
          <span className="font-semibold">
            Share the questions I was asked (no answers, no names)
          </span>
          <span className="block text-slate-600">
            Helps other people preparing for the same company. Only the questions are shared,
            with names removed and tagged with the company, role, round and month. Each one is
            checked by hand first, and you can see, leave out or withdraw them on the interview&apos;s
            page.
          </span>
        </span>
      </label>
      {share && <RoundSelect />}
    </div>
  );
}

function RoundSelect({ defaultValue = "" }: { defaultValue?: string }) {
  const id = useId();
  return (
    <label className="mt-3 block text-sm font-semibold text-slate-700" htmlFor={`${id}-round`}>
      Which round was it? <span className="font-normal text-slate-500">(optional)</span>
      <select id={`${id}-round`} name="round" defaultValue={defaultValue} className={INPUT}>
        <option value="">Not sure</option>
        {ROUNDS.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// For an interview already added: turns sharing on.
export function ShareQuestionsForm({ transcriptId }: { transcriptId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(shareQuestions, null);
  return (
    <form action={action} className="space-y-3" data-testid="share-form">
      <input type="hidden" name="transcriptId" value={transcriptId} />
      <RoundSelect />
      {state?.error && <ErrorLine>{state.error}</ErrorLine>}
      <button type="submit" disabled={pending} className={SECONDARY}>
        {pending ? "Sharing…" : "Share the questions (no answers, no names)"}
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

// Who said what, for a transcript labelled automatically. Tap a turn's label to flip it; saving
// runs the review again on the corrected transcript.
export function SpeakerTurnsEditor({
  transcriptId,
  turns,
}: {
  transcriptId: string;
  turns: SpeakerTurn[];
}) {
  const initial = turns.map((t) => t.speaker);
  const [speakers, setSpeakers] = useState<SpeakerRole[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const changed = speakers.some((s, i) => s !== initial[i]);

  function flip(i: number) {
    setSpeakers((list) => list.map((s, j) => (j === i ? (s === "me" ? "interviewer" : "me") : s)));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await relabelTranscript(transcriptId, speakers);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="mt-4 space-y-3" data-testid="speaker-turns">
      <ol className="space-y-2">
        {turns.map((t, i) => {
          const me = speakers[i] === "me";
          return (
            <li key={i} className={`flex gap-3 ${me ? "flex-row-reverse text-right" : ""}`}>
              <button
                type="button"
                onClick={() => flip(i)}
                disabled={pending}
                title="Tap to switch who said this"
                className={`h-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition disabled:opacity-60 ${
                  me
                    ? "bg-ink-800 text-white ring-ink-800"
                    : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {me ? "You" : SPEAKER_LABELS.interviewer} ⇄
              </button>
              <p
                className={`min-w-0 whitespace-pre-line rounded-2xl px-3 py-2 text-sm ${
                  me ? "bg-ink-50 text-slate-800" : "bg-slate-50 text-slate-700"
                }`}
              >
                {preview(t.text)}
              </p>
            </li>
          );
        })}
      </ol>
      <div className="sticky bottom-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!changed || pending}
          className={PRIMARY}
        >
          {pending ? "Saving and reviewing…" : "Save and review again"}
        </button>
        {!changed && !pending && (
          <span className="text-sm text-slate-500">Looks right? Nothing to do.</span>
        )}
        {error && <ErrorLine>{error}</ErrorLine>}
      </div>
    </div>
  );
}

// Long answers are shortened in the list: enough to tell who's talking.
function preview(text: string): string {
  const t = text.trim();
  return t.length > 280 ? `${t.slice(0, 280).trimEnd()}…` : t;
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
