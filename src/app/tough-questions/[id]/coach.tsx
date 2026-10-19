"use client";

import { useState, useTransition } from "react";
import { MicButton } from "@/components/mic-button";
import type { StoryContent } from "@/lib/stories/content";
import {
  MAX_EDITED_ANSWER_LENGTH,
  MAX_TOUGH_ANSWER_LENGTH,
  TOUGH_QUESTIONS,
  missingPrompts,
  speakingSeconds,
  wordCount,
} from "@/lib/tough/questions";
import { appendSpoken } from "@/lib/voice/text";
import { saveToughAnswers, saveToughEdit, writeTough, type ToughResult } from "./actions";
import { ToughDrill } from "./drill";

// The coach for one tough question: the user's situation on the left, the answer to say on the
// right once it's written.
export function ToughCoach({
  storyId,
  questionId,
  initialContent,
  jobs,
}: {
  storyId: string;
  questionId: string;
  initialContent: StoryContent;
  jobs: { id: string; label: string }[];
}) {
  const question = TOUGH_QUESTIONS.find((q) => q.id === questionId)!;
  const [content, setContent] = useState(initialContent);
  const [answers, setAnswers] = useState<Record<string, string>>(initialContent.answers);
  const [jobId, setJobId] = useState<string>(
    initialContent.tough?.jobId && jobs.some((j) => j.id === initialContent.tough?.jobId)
      ? initialContent.tough.jobId
      : "",
  );
  const [edit, setEdit] = useState(initialContent.draft?.parts.answer ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [talking, setTalking] = useState(false);
  const [action, setAction] = useState<"write" | "save" | "edit" | null>(null);
  const [pending, startTransition] = useTransition();

  const draft = content.draft?.parts.answer ?? "";
  const missing = missingPrompts(question, answers);
  const busy = pending || talking;

  function run(kind: "write" | "save" | "edit", call: () => Promise<ToughResult>) {
    setError(null);
    setSaved(null);
    setAction(kind);
    startTransition(async () => {
      const result = await call();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setContent(result.content);
      if (kind === "write") setEdit(result.content.draft?.parts.answer ?? "");
      setSaved(kind === "write" ? null : "Saved");
    });
  }

  return (
    <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section
        className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
        data-testid="tough-situation"
      >
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{question.label}</h1>
        <p className="mt-1 text-slate-600">{question.approach}</p>
        <p className="mt-3 rounded-xl bg-ink-50 p-3 text-sm text-ink-900">
          Tell me what really happened. I&apos;ll never suggest hiding or bending a fact, and only
          what you write here goes into your answer.
        </p>

        <div className="mt-5 space-y-5">
          {question.prompts.map((p, i) => {
            const optional = "optional" in p && p.optional;
            return (
              <div key={p.id}>
                <label htmlFor={`prompt-${p.id}`} className="block font-semibold text-slate-900">
                  {i + 1}. {p.text}
                  {optional && (
                    <span className="ml-2 text-xs font-normal text-slate-500">Optional</span>
                  )}
                </label>
                {"hint" in p && p.hint && <p className="mt-0.5 text-sm text-slate-500">{p.hint}</p>}
                <textarea
                  id={`prompt-${p.id}`}
                  value={answers[p.id] ?? ""}
                  onChange={(e) =>
                    setAnswers((a) => ({
                      ...a,
                      [p.id]: e.target.value.slice(0, MAX_TOUGH_ANSWER_LENGTH),
                    }))
                  }
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-ink-700 focus:outline-none focus:ring-2 focus:ring-ink-700/30"
                  data-testid={`prompt-${p.id}`}
                />
                <div className="mt-1">
                  <MicButton
                    disabled={pending}
                    onActiveChange={setTalking}
                    onText={(spoken) =>
                      setAnswers((a) => ({
                        ...a,
                        [p.id]: appendSpoken(a[p.id] ?? "", spoken, MAX_TOUGH_ANSWER_LENGTH),
                      }))
                    }
                  />
                </div>
              </div>
            );
          })}

          {jobs.length > 0 && (
            <div>
              <label htmlFor="tough-job" className="block font-semibold text-slate-900">
                Which job is this answer for?
              </label>
              <p className="mt-0.5 text-sm text-slate-500">
                The answer ends by turning toward that role.
              </p>
              <select
                id="tough-job"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
              >
                <option value="">Any role (general answer)</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => run("write", () => writeTough(storyId, answers, jobId || null))}
            disabled={busy || missing.length > 0}
            className="rounded-xl bg-accent-400 px-4 py-2.5 font-semibold text-ink-950 transition hover:bg-accent-300 disabled:opacity-60"
            data-testid="write-tough"
          >
            {pending && action === "write"
              ? "Writing your answer…"
              : draft
                ? "Write it again"
                : "Write my answer"}
          </button>
          <button
            type="button"
            onClick={() => run("save", () => saveToughAnswers(storyId, answers, jobId || null))}
            disabled={busy}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50 disabled:opacity-60"
          >
            {pending && action === "save" ? "Saving…" : "Save for later"}
          </button>
          {saved && action === "save" && <span className="text-sm text-slate-500">{saved}</span>}
        </div>
        {missing.length > 0 && (
          <p className="mt-2 text-sm text-slate-500">
            Answer the questions not marked optional to write your answer.
          </p>
        )}
        {draft && content.tough?.edited && (
          <p className="mt-2 text-sm text-slate-500">
            Writing it again replaces the edits you made to your answer.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
      </section>

      <section
        className="h-fit rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6 lg:sticky lg:top-6"
        data-testid="tough-answer"
      >
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-800">Your answer</h2>
        {!draft ? (
          <p className="mt-2 text-slate-600">
            Once you&apos;ve answered the questions, your 20 to 40 second answer appears here, ready
            to edit and say out loud.
          </p>
        ) : (
          <>
            <textarea
              value={edit}
              onChange={(e) => setEdit(e.target.value.slice(0, MAX_EDITED_ANSWER_LENGTH))}
              rows={8}
              aria-label="Your answer"
              className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-lg leading-relaxed text-slate-900 focus:border-ink-700 focus:outline-none focus:ring-2 focus:ring-ink-700/30"
              data-testid="tough-answer-text"
            />
            <p className="mt-1 text-sm text-slate-500">
              {wordCount(edit)} words · about {speakingSeconds(edit)} seconds out loud
            </p>
            {(content.draft?.untracedNumbers.length ?? 0) > 0 && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                Check these numbers: {content.draft!.untracedNumbers.join(", ")}. They aren&apos;t in
                what you told me, so change or remove them before you use this.
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => run("edit", () => saveToughEdit(storyId, edit))}
                disabled={busy || edit.trim() === draft.trim()}
                className="rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-60"
              >
                {pending && action === "edit" ? "Saving…" : "Save my edits"}
              </button>
              {saved && action === "edit" && <span className="text-sm text-slate-500">{saved}</span>}
            </div>
            {content.tough?.note && (
              <div className="mt-4 rounded-xl bg-ink-50 p-3 text-sm text-ink-900">
                <p className="font-semibold">Coach&apos;s note</p>
                <p className="mt-1">{content.tough.note}</p>
              </div>
            )}
            <p className="mt-4 text-sm text-slate-600">
              Say it out loud a few times until you can do it without reading. Then stop talking:
              a short, calm answer tells them the topic is closed.
            </p>
            <ToughDrill
              storyId={storyId}
              content={content}
              onContent={setContent}
              disabled={busy}
            />
          </>
        )}
      </section>
    </div>
  );
}
