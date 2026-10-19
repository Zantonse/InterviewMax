"use client";

import { useState, useTransition } from "react";
import { AnswerComposer } from "@/components/practice/answer-composer";
import { FeedbackCard } from "@/components/practice/feedback-card";
import { MAX_FOLLOW_UPS, followUpCount, itemStep } from "@/lib/practice/content";
import type { StoryContent } from "@/lib/stories/content";
import { toughDrill } from "@/lib/tough/drill";
import {
  type ToughResult,
  answerToughDrill,
  continueToughDrill,
  startToughDrill,
} from "./actions";

// "Drill it": say the written answer out loud, then take two or three follow-ups the way a
// skeptical interviewer pushes on an awkward answer. Feedback says where it held up and where it
// got thinner.
export function ToughDrill({
  storyId,
  content,
  onContent,
  disabled,
}: {
  storyId: string;
  content: StoryContent;
  onContent: (content: StoryContent) => void;
  disabled: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const drill = toughDrill(content);
  const step = drill ? itemStep(drill) : null;

  function run(call: () => Promise<ToughResult>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await call();
        if (result.ok) onContent(result.content);
        else setError(result.error);
      } catch {
        setError("Couldn't reach InterviewMax. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="mt-5 border-t border-slate-200 pt-4" data-testid="tough-drill">
      <h3 className="text-sm font-bold uppercase tracking-wide text-ink-800">Drill the follow-ups</h3>
      {!drill ? (
        <>
          <p className="mt-1 text-sm text-slate-600">
            Interviewers often push on an answer like this to see if it holds. Say it out loud, then
            take two or three follow-ups.
          </p>
          <button
            type="button"
            onClick={() => run(() => startToughDrill(storyId))}
            disabled={disabled || pending}
            className="mt-3 rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-60"
            data-testid="start-tough-drill"
          >
            {pending ? "Starting…" : "Drill it"}
          </button>
        </>
      ) : (
        <>
          <ol className="mt-3 space-y-3" aria-live="polite">
            {drill.turns.map((t, i) => (
              <li key={i} className="space-y-2">
                <p className="max-w-[90%] rounded-2xl rounded-tl-sm bg-ink-50 px-4 py-3 font-medium text-slate-900">
                  {i > 0 && (
                    <span className="block text-xs font-bold uppercase tracking-wide text-ink-700">
                      Follow-up {i}
                    </span>
                  )}
                  {t.question}
                </p>
                {t.answer && (
                  <p className="ml-auto max-w-[90%] whitespace-pre-line rounded-2xl rounded-tr-sm bg-slate-100 px-4 py-3 text-slate-800">
                    {t.answer}
                  </p>
                )}
              </li>
            ))}
            {pending && step !== "done" && (
              <li role="status" className="flex items-center gap-2 text-sm text-slate-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-ink-600" />
                {!drill.probeDone && followUpCount(drill) < MAX_FOLLOW_UPS
                  ? "The interviewer is thinking…"
                  : "Writing your feedback…"}
              </li>
            )}
          </ol>

          {step === "answer" && !pending && (
            <div className="mt-3">
              <AnswerComposer
                key={drill.turns.length}
                disabled={disabled || pending}
                onSubmit={(answer, seconds, voice) =>
                  run(() => answerToughDrill(storyId, answer, seconds, voice))
                }
              />
            </div>
          )}

          {(step === "probe" || step === "feedback") && !pending && (
            <button
              type="button"
              onClick={() => run(() => continueToughDrill(storyId))}
              className="mt-3 rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-900"
            >
              {step === "probe" ? "Continue" : "Get my feedback"}
            </button>
          )}

          {drill.feedback && (
            <div className="mt-4 space-y-3">
              <FeedbackCard feedback={drill.feedback} turns={drill.turns} />
              <button
                type="button"
                onClick={() => run(() => startToughDrill(storyId))}
                disabled={disabled || pending}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50 disabled:opacity-60"
              >
                Drill it again
              </button>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
