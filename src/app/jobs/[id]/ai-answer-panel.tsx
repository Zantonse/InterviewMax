"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CopyButton } from "@/components/copy-button";
import type { StoryContent } from "@/lib/stories/content";
import { MAX_EDITED_ANSWER_LENGTH, speakingSeconds, wordCount } from "@/lib/tough/questions";
import { saveToughJobEdit, writeToughForJob } from "../../tough-questions/[id]/actions";

// "How do you use AI in your work?" for this job: the user's answer about how they really use AI
// (built on the tough-questions page), shaped around this posting. Shown once those questions are
// answered; the page says where to answer them before that.
export function AiAnswerPanel({
  jobId,
  company,
  storyId,
  initialContent,
}: {
  jobId: string;
  company: string;
  storyId: string;
  initialContent: StoryContent;
}) {
  const [content, setContent] = useState(initialContent);
  const forJob = content.tough?.forJobs?.[jobId];
  const [edit, setEdit] = useState(forJob?.answer ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [action, setAction] = useState<"write" | "edit" | null>(null);
  const [pending, startTransition] = useTransition();

  const general = content.draft?.parts.answer?.trim() ?? "";
  // Written before the general answer was last written, so it may miss what changed since.
  const stale = Boolean(
    forJob && content.draft?.writtenAt && forJob.writtenAt < content.draft.writtenAt,
  );

  function write() {
    setError(null);
    setSaved(false);
    setAction("write");
    startTransition(async () => {
      const result = await writeToughForJob(storyId, jobId);
      if (!result.ok) return setError(result.error);
      setContent(result.content);
      setEdit(result.content.tough?.forJobs?.[jobId]?.answer ?? "");
    });
  }

  function saveEdit() {
    setError(null);
    setSaved(false);
    setAction("edit");
    startTransition(async () => {
      const result = await saveToughJobEdit(storyId, jobId, edit);
      if (!result.ok) return setError(result.error);
      setContent(result.content);
      setSaved(true);
    });
  }

  return (
    <div className="flex flex-col gap-3" data-testid="ai-answer-panel">
      {!forJob ? (
        <>
          {general && (
            <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-black/5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Your general answer
              </p>
              <p className="mt-1 whitespace-pre-line text-slate-800">{general}</p>
            </div>
          )}
          <p className="text-sm text-slate-600">
            I&apos;ll lead with the use that fits this role&apos;s work best and close on how
            you&apos;d bring it to {company}, from your own answers and the posting.
          </p>
        </>
      ) : (
        <>
          <textarea
            value={edit}
            onChange={(e) => setEdit(e.target.value.slice(0, MAX_EDITED_ANSWER_LENGTH))}
            rows={7}
            aria-label={`How you use AI, for ${company}`}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-lg leading-relaxed text-slate-900 focus:border-ink-700 focus:outline-none focus:ring-2 focus:ring-ink-700/30"
            data-testid="ai-answer-text"
          />
          <p className="text-sm text-slate-500">
            {wordCount(edit)} words · about {speakingSeconds(edit)} seconds out loud
          </p>
          {forJob.untracedNumbers.length > 0 && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              Check these numbers: {forJob.untracedNumbers.join(", ")}. They aren&apos;t in what you
              told me, so change or remove them before you use this.
            </p>
          )}
          {stale && (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              You&apos;ve rewritten your general answer since this one. Write it again to bring in
              what changed.
            </p>
          )}
          {forJob.note && (
            <div className="rounded-xl bg-ink-50 p-3 text-sm text-ink-900">
              <p className="font-semibold">Coach&apos;s note</p>
              <p className="mt-1">{forJob.note}</p>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={write}
          disabled={pending}
          className={
            forJob
              ? "rounded-xl px-4 py-2 text-sm font-semibold text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50 disabled:opacity-60"
              : "rounded-xl bg-accent-400 px-4 py-2.5 font-semibold text-ink-950 transition hover:bg-accent-300 disabled:opacity-60"
          }
          data-testid="write-ai-answer"
        >
          {pending && action === "write"
            ? "Writing it for this job…"
            : forJob
              ? "Write it again"
              : `Write it for ${company}`}
        </button>
        {forJob && (
          <>
            <button
              type="button"
              onClick={saveEdit}
              disabled={pending || edit.trim() === forJob.answer.trim()}
              className="rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-60"
            >
              {pending && action === "edit" ? "Saving…" : "Save my edits"}
            </button>
            <CopyButton
              text={edit}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50"
            />
            {saved && <span className="text-sm text-slate-500">Saved</span>}
          </>
        )}
      </div>
      {forJob?.edited && (
        <p className="text-sm text-slate-500">Writing it again replaces your edits.</p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <p className="text-sm">
        <Link href={`/tough-questions/${storyId}`} className="font-medium text-ink-800 hover:underline">
          Change your answers or practice it out loud with follow-ups →
        </Link>
      </p>
    </div>
  );
}
