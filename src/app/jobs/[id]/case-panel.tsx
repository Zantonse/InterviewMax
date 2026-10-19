"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AiNotice } from "@/components/ai-notice";
import { MicButton } from "@/components/mic-button";
import {
  CASE_FRAMES,
  MAX_CASE_ANSWER_LENGTH,
  MAX_CASE_QUESTION_LENGTH,
  caseKind,
  type CaseFeedback,
  type CaseQuestion,
} from "@/lib/cases/content";
import { appendSpoken } from "@/lib/voice/text";
import { practiceCase } from "./case-actions";

const LANDED_LABELS: Record<string, string> = {
  strong: "Landed well",
  mixed: "Partly landed",
  weak: "Didn't land",
};

// Case and technical questions for one job: the ones real interviewers asked (from past
// interviews) plus any the user adds, each with its answer frame and a practice box.
export function CasePanel({ jobId, questions }: { jobId: string; questions: CaseQuestion[] }) {
  const [own, setOwn] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const all = [
    ...questions,
    ...own.map((q): CaseQuestion => ({ question: q, kind: caseKind(q), here: true })),
  ];
  return (
    <div className="space-y-3">
      {all.length > 0 ? (
        <ol className="space-y-3" data-testid="case-list">
          {all.map((q) => (
            <CaseItem key={q.question} jobId={jobId} q={q} />
          ))}
        </ol>
      ) : (
        <p className="text-slate-600">
          None from your past interviews yet. Add one you expect, or upload a past interview and the
          case and technical questions they asked show up here.
        </p>
      )}
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          const q = draft.trim();
          if (q && !all.some((x) => x.question.toLowerCase() === q.toLowerCase())) setOwn((o) => [...o, q]);
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={MAX_CASE_QUESTION_LENGTH}
          placeholder="Add one, e.g. How would you decide whether to launch a new product line?"
          className="min-w-0 flex-1 rounded-xl border-0 bg-white px-3 py-2.5 text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-ink-700 focus:outline-none"
          aria-label="Add a case or technical question"
        />
        <button
          type="submit"
          className="rounded-xl px-4 py-2.5 font-semibold text-ink-800 ring-1 ring-ink-800/20 transition hover:bg-ink-50"
        >
          Add
        </button>
      </form>
    </div>
  );
}

function CaseItem({ jobId, q }: { jobId: string; q: CaseQuestion }) {
  const frame = CASE_FRAMES[q.kind];
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [talking, setTalking] = useState(false);
  const [feedback, setFeedback] = useState<CaseFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const stepLabel = (id: string) => frame.steps.find((s) => s.id === id)?.label ?? id;

  return (
    <li className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5" data-testid="case-item">
      <p className="font-semibold text-slate-900">{q.question}</p>
      <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
        <span className="rounded-full bg-ink-50 px-2 py-0.5 font-semibold text-ink-900">{frame.label}</span>
        {q.transcriptId && (
          <Link
            href={`/transcripts/${q.transcriptId}`}
            className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-700 ring-1 ring-slate-200 hover:underline"
          >
            {q.here ? "Asked you here" : "Asked you elsewhere"}: {q.transcriptTitle}
          </Link>
        )}
        {q.landed && LANDED_LABELS[q.landed] && (
          <span className="rounded-full bg-white px-2 py-0.5 font-semibold text-slate-700 ring-1 ring-slate-200">
            Last time: {LANDED_LABELS[q.landed]}
          </span>
        )}
      </p>
      {q.note && <p className="mt-2 text-sm text-slate-600">{q.note}</p>}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 text-sm font-semibold text-ink-800 hover:underline"
        >
          Practice this one →
        </button>
      ) : (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{frame.blurb}</p>
            <ol className="mt-1 space-y-0.5 text-sm text-slate-700">
              {frame.steps.map((s, i) => (
                <li key={s.id}>
                  <span className="font-semibold text-slate-900">
                    {i + 1}. {s.label}.
                  </span>{" "}
                  {s.hint}
                  {feedback?.covered.includes(s.id) && (
                    <span className="ml-1 font-semibold text-ink-800">✓</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={5}
            maxLength={MAX_CASE_ANSWER_LENGTH}
            placeholder="Answer as you would in the room. Tap Talk to say it out loud."
            className="w-full rounded-xl border-0 bg-white px-3 py-2.5 text-slate-900 ring-1 ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-ink-700 focus:outline-none"
            aria-label={`Your answer to: ${q.question}`}
          />
          <div className="flex flex-wrap items-center gap-3">
            <MicButton
              disabled={pending}
              onActiveChange={setTalking}
              onText={(spoken) => setAnswer((a) => appendSpoken(a, spoken, MAX_CASE_ANSWER_LENGTH))}
            />
            <button
              type="button"
              disabled={pending || talking || !answer.trim()}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const res = await practiceCase(jobId, q.question, answer);
                  if (res.ok) setFeedback(res.feedback);
                  else setError(res.error);
                })
              }
              className="rounded-xl bg-ink-800 px-4 py-2.5 font-semibold text-white transition hover:bg-ink-900 disabled:opacity-60"
            >
              {pending ? "Reading your answer…" : feedback ? "Get feedback again" : "Get feedback"}
            </button>
          </div>
          <AiNotice purpose="give feedback on your practice answer" />
          {error && <p className="text-sm text-red-700">{error}</p>}
          {feedback && (
            <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5" data-testid="case-feedback">
              {feedback.summary && <p className="text-slate-800">{feedback.summary}</p>}
              {feedback.missing.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {feedback.missing.map((m) => (
                    <li key={m.tip}>
                      <span className="font-semibold text-slate-900">{stepLabel(m.step)}:</span> {m.tip}
                    </li>
                  ))}
                </ul>
              )}
              {feedback.followUp && (
                <p className="mt-3 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">Expect them to push with: </span>
                  &ldquo;{feedback.followUp}&rdquo;
                </p>
              )}
              <p className="mt-3 text-xs text-slate-500">Practice answers aren&apos;t saved. Edit and try again.</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}
