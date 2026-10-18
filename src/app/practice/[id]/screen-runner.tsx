"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnswerComposer } from "@/components/practice/answer-composer";
import { FeedbackCard } from "@/components/practice/feedback-card";
import {
  type PracticeItem,
  SCREEN_THINK_SECONDS,
  formatDuration,
  itemStep,
  nextToAnswer,
  screenLimitSeconds,
} from "@/lib/practice/content";
import type { VoiceStats } from "@/lib/practice/delivery";
import { type PracticeResult, answerPractice, continuePractice, skipPractice } from "../actions";
import { StartPracticeForm } from "../start-form";

// An AI screen round (PRD, interview trends 2026): many first rounds are now a one-way interview
// with a bot. Each question shows with a fixed thinking time, then a time limit to answer; nobody
// reacts and nobody follows up. Feedback comes once every question is answered: whether each
// answer fit the limit and got to its result without anyone asking for it.
export function ScreenRunner({
  sessionId,
  jobId,
  initialItems,
}: {
  sessionId: string;
  jobId: string;
  initialItems: PracticeItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const view = nextToAnswer(items);

  async function run(work: () => Promise<PracticeResult>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const result = await work();
      if (result.items) setItems(result.items);
      if (!result.ok) setError(result.error);
      return result.ok;
    } catch {
      setError("Couldn't reach InterviewMax. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (view < 0) {
    return <ScreenSummary sessionId={sessionId} jobId={jobId} items={items} setItems={setItems} />;
  }

  const item = items[view];
  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm font-semibold text-slate-600" aria-live="polite">
        Question {view + 1} of {items.length}
      </p>
      <ScreenQuestion
        key={view}
        item={item}
        busy={busy}
        onAnswer={(answer, seconds, voice) =>
          run(() => answerPractice(sessionId, view, answer, seconds, voice))
        }
        onSkip={() => run(() => skipPractice(sessionId, view))}
      />
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

// Seconds since a moment, ticking while the question is on screen.
function useElapsed(since: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [since]);
  return Math.max(0, (now - since) / 1000);
}

function ScreenQuestion({
  item,
  busy,
  onAnswer,
  onSkip,
}: {
  item: PracticeItem;
  busy: boolean;
  onAnswer: (answer: string, seconds: number | null, voice: VoiceStats | null) => void;
  onSkip: () => void;
}) {
  const [shownAt] = useState(() => Date.now());
  // When the user chose to start before the thinking time ran out; otherwise it starts on its
  // own when the thinking time is up, as it does on a real screen.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const elapsed = useElapsed(shownAt);
  const answerStart = startedAt !== null ? (startedAt - shownAt) / 1000 : SCREEN_THINK_SECONDS;
  const answering = elapsed >= answerStart;
  const limit = screenLimitSeconds(item.theme);
  const thinkLeft = Math.ceil(SCREEN_THINK_SECONDS - elapsed);
  const answerLeft = Math.ceil(limit - (elapsed - answerStart));
  return (
    <section
      className="rounded-3xl bg-slate-900 p-5 text-white shadow-sm sm:p-6"
      data-testid="screen-question"
    >
      <p className="text-xl font-semibold sm:text-2xl">{item.question}</p>
      {!answering ? (
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <p className="tabular-nums text-slate-300" data-testid="screen-think">
            Thinking time: <span className="font-bold text-white">{Math.max(0, thinkLeft)} sec</span>
          </p>
          <button
            type="button"
            onClick={() => setStartedAt(Date.now())}
            className="rounded-xl bg-accent-400 px-4 py-2.5 font-semibold text-ink-950 hover:bg-accent-300"
          >
            Start answering
          </button>
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="text-sm font-medium text-slate-400 hover:text-white"
          >
            Skip this question
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p
            className={`tabular-nums ${answerLeft > 0 ? "text-slate-300" : "font-semibold text-amber-300"}`}
            data-testid="screen-clock"
          >
            {answerLeft > 0 ? (
              <>
                Time left: <span className="font-bold text-white">{formatDuration(answerLeft)}</span>{" "}
                of {formatDuration(limit)}
              </>
            ) : (
              "Time's up. A real screen would stop recording here, so send what you have."
            )}
          </p>
          <div className="rounded-2xl bg-white p-4 text-slate-900">
            <AnswerComposer
              disabled={busy}
              submitLabel="Send and go on"
              placeholder="Tap Talk and answer out loud. Nobody will react or follow up, so get to the result on your own."
              onSubmit={onAnswer}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function ScreenSummary({
  sessionId,
  jobId,
  items,
  setItems,
}: {
  sessionId: string;
  jobId: string;
  items: PracticeItem[];
  setItems: (items: PracticeItem[]) => void;
}) {
  const [working, setWorking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const waiting = items.flatMap((it, i) => (itemStep(it) === "feedback" ? [i] : []));

  // One question at a time, so each stays within one request and a failure keeps the rest.
  async function getFeedback() {
    setError(null);
    for (const i of waiting) {
      setWorking(i);
      try {
        const result = await continuePractice(sessionId, i);
        if (result.items) setItems(result.items);
        if (!result.ok) {
          setError(result.error);
          break;
        }
      } catch {
        setError("Couldn't reach InterviewMax. Check your connection and try again.");
        break;
      }
    }
    setWorking(null);
  }

  return (
    <section
      className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
      data-testid="screen-summary"
    >
      <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Screen done</h2>
      {waiting.length > 0 ? (
        <>
          <p className="mt-1 text-sm text-slate-600">
            Like a real screen, nothing was said back while you answered. Now see how each answer
            came across.
          </p>
          <button
            type="button"
            onClick={getFeedback}
            disabled={working !== null}
            className="mt-4 rounded-xl bg-accent-400 px-5 py-3 font-semibold text-ink-950 transition hover:bg-accent-300 disabled:opacity-60"
            data-testid="screen-get-feedback"
          >
            {working !== null
              ? `Writing feedback ${waiting.indexOf(working) + 1} of ${waiting.length}…`
              : "Get my feedback"}
          </button>
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-600">
          Open a question to read its feedback. Answers that ran over or never got to a result are
          the ones to tighten: lead with what happened, then how.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <ol className="mt-4 space-y-2">
        {items.map((it, i) => (
          <li key={i}>
            <details className="rounded-2xl bg-slate-50 ring-1 ring-black/5">
              <summary className="cursor-pointer px-4 py-3">
                <span className="font-semibold text-slate-900">
                  {i + 1}. {it.question}
                </span>
                <span className="mt-1 block text-sm text-slate-600">
                  {it.feedback
                    ? `${it.feedback.summary} · ${formatDuration(it.feedback.timing.seconds)}`
                    : it.skipped
                      ? "Skipped"
                      : "Feedback not written yet"}
                </span>
              </summary>
              <div className="space-y-3 px-4 pb-4">
                {it.turns[0]?.answer && (
                  <p className="whitespace-pre-line rounded-xl bg-white p-3 text-sm text-slate-700">
                    {it.turns[0].answer}
                  </p>
                )}
                {it.feedback && (
                  <FeedbackCard
                    feedback={it.feedback}
                    turns={it.turns}
                    storyHref={it.storyId ? `/stories/${it.storyId}` : undefined}
                  />
                )}
              </div>
            </details>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap items-start gap-3">
        <StartPracticeForm jobId={jobId} mode="screen" label="Run another screen" />
        <Link
          href={`/jobs/${jobId}/practice`}
          className="rounded-xl px-4 py-3 font-semibold text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50"
        >
          Back to practice
        </Link>
      </div>
    </section>
  );
}
