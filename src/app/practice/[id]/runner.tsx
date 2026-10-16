"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { AnswerComposer } from "@/components/practice/answer-composer";
import { FeedbackCard } from "@/components/practice/feedback-card";
import {
  MAX_FOLLOW_UPS,
  type PracticeItem,
  REASON_LABELS,
  currentItemIndex,
  followUpCount,
  formatDuration,
  itemStep,
} from "@/lib/practice/content";
import { roundDeliveryNote } from "@/lib/practice/delivery";
import {
  type PracticeResult,
  answerPractice,
  continuePractice,
  keepPracticeFact,
  skipPractice,
} from "../actions";
import { StartPracticeForm } from "../start-form";

type Busy = "thinking" | "feedback" | "skipping" | null;

// One practice round, a question at a time: the interviewer asks, the user answers out loud, the
// interviewer follows up once or twice, then feedback. Everything is saved as it goes, so leaving
// and coming back picks up where the user was.
export function PracticeRunner({
  sessionId,
  jobId,
  initialItems,
  openers = {},
}: {
  sessionId: string;
  jobId: string;
  initialItems: PracticeItem[];
  // The opening line picked in "How to tell it", keyed by story id, as a cue before answering.
  openers?: Record<string, string>;
}) {
  const [items, setItems] = useState(initialItems);
  // Which question is on screen, or -1 for the summary. Stays on a question after its feedback
  // until the user moves on, so they can read it.
  const [view, setView] = useState(() => currentItemIndex(initialItems));
  const [busy, setBusy] = useState<Busy>(null);
  const [keeping, setKeeping] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(work: () => Promise<PracticeResult>, label: Busy) {
    setBusy(label);
    setError(null);
    try {
      const result = await work();
      if (result.items) setItems(result.items);
      if (!result.ok) setError(result.error);
    } catch {
      setError("Couldn't reach InterviewMax. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  if (view < 0 || view >= items.length) {
    return <Summary items={items} jobId={jobId} onOpen={setView} />;
  }

  const item = items[view];
  const step = itemStep(item);
  // On to the first question still open, or the summary when there's none.
  const next = () => {
    setError(null);
    setView(currentItemIndex(items));
  };
  // After an answer: another follow-up may come, or the feedback.
  const nextBusy: Busy =
    !item.probeDone && followUpCount(item) < MAX_FOLLOW_UPS ? "thinking" : "feedback";

  return (
    <div className="mt-6 space-y-4">
      <Progress items={items} view={view} onOpen={setView} disabled={busy !== null} />

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold uppercase tracking-wide text-ink-800">
            Question {view + 1} of {items.length}
          </span>
          <span className="rounded-full bg-ink-50 px-2 py-0.5 font-semibold text-ink-900">
            {REASON_LABELS[item.reason]}
          </span>
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {item.storyId ? (
            <>
              Answer with your story{" "}
              <span className="font-semibold text-slate-800">{item.storyTitle}</span>, from memory.
            </>
          ) : (
            "No story for this one yet. Answer from memory; the feedback says what a strong answer needs."
          )}
        </p>
        {item.storyId && openers[item.storyId] && !item.turns[0]?.answer && (
          <details className="mt-2 text-sm" data-testid="practice-opener">
            <summary className="cursor-pointer font-medium text-ink-800">Peek at your opener</summary>
            <p className="mt-1 rounded-xl bg-ink-50 px-3 py-2 text-slate-800">
              {openers[item.storyId]}
            </p>
          </details>
        )}

        <ol className="mt-4 space-y-3" aria-live="polite">
          {item.turns.map((t, i) => (
            <li key={i} className="space-y-2">
              <div className="flex items-start gap-2">
                <p
                  className={`max-w-[90%] rounded-2xl rounded-tl-sm px-4 py-3 text-slate-900 ${
                    i === 0 ? "bg-ink-50 text-lg font-semibold" : "bg-ink-50 font-medium"
                  }`}
                >
                  {i > 0 && (
                    <span className="block text-xs font-bold uppercase tracking-wide text-ink-700">
                      Follow-up
                    </span>
                  )}
                  {t.question}
                </p>
                <HearIt text={t.question} />
              </div>
              {t.answer && (
                <div className="flex justify-end">
                  <p className="max-w-[90%] whitespace-pre-line rounded-2xl rounded-tr-sm bg-slate-100 px-4 py-3 text-slate-800">
                    {t.answer}
                    {t.seconds ? (
                      <span className="mt-1 block text-right text-xs text-slate-500">
                        {formatDuration(t.seconds)}
                      </span>
                    ) : null}
                  </p>
                </div>
              )}
            </li>
          ))}
          {busy === "thinking" && <Thinking>The interviewer is thinking…</Thinking>}
          {busy === "feedback" && <Thinking>Writing your feedback…</Thinking>}
        </ol>

        {error && (
          <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
            {(step === "probe" || step === "feedback") && !busy && (
              <button
                type="button"
                onClick={() =>
                  run(
                    () => continuePractice(sessionId, view),
                    step === "probe" ? "thinking" : "feedback",
                  )
                }
                className="ml-2 font-semibold underline"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {step === "answer" && !busy && (
          <div className="mt-4">
            <AnswerComposer
              key={`${view}-${item.turns.length}`}
              disabled={busy !== null}
              onSubmit={(answer, seconds, voice) =>
                run(() => answerPractice(sessionId, view, answer, seconds, voice), nextBusy)
              }
              extra={
                item.turns.length === 1 ? (
                  <button
                    type="button"
                    onClick={() => run(() => skipPractice(sessionId, view), "skipping")}
                    className="text-sm font-medium text-slate-500 hover:text-slate-800"
                  >
                    Skip this question
                  </button>
                ) : null
              }
            />
          </div>
        )}

        {(step === "probe" || step === "feedback") && !busy && !error && (
          <button
            type="button"
            onClick={() =>
              run(
                () => continuePractice(sessionId, view),
                step === "probe" ? "thinking" : "feedback",
              )
            }
            className="mt-4 rounded-xl bg-ink-800 px-5 py-2.5 font-semibold text-white hover:bg-ink-900"
          >
            {step === "probe" ? "Continue" : "Get my feedback"}
          </button>
        )}

        {item.skipped && (
          <p className="mt-4 text-sm text-slate-500">You skipped this question.</p>
        )}
      </section>

      {item.feedback && (
        <FeedbackCard
          feedback={item.feedback}
          storyHref={item.storyId ? `/stories/${item.storyId}` : undefined}
          keeping={keeping}
          onKeep={async (factIndex) => {
            setKeeping(factIndex);
            await run(() => keepPracticeFact(sessionId, view, factIndex), null);
            setKeeping(null);
          }}
        />
      )}

      {step === "done" && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={next}
            className="rounded-xl bg-accent-400 px-5 py-3 font-semibold text-ink-950 transition hover:bg-accent-300"
            data-testid="practice-next"
          >
            {currentItemIndex(items) < 0 ? "See how the round went" : "Next question"}
          </button>
        </div>
      )}
    </div>
  );
}

function Progress({
  items,
  view,
  onOpen,
  disabled,
}: {
  items: PracticeItem[];
  view: number;
  onOpen: (i: number) => void;
  disabled: boolean;
}) {
  const open = currentItemIndex(items);
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Questions in this round">
      {items.map((it, i) => {
        const done = itemStep(it) === "done";
        // Done questions can be reopened; the one in progress is reachable too.
        const reachable = done || i === open;
        return (
          <li key={i}>
            <button
              type="button"
              disabled={disabled || !reachable}
              onClick={() => onOpen(i)}
              aria-current={i === view ? "step" : undefined}
              title={it.question}
              className={`flex size-8 items-center justify-center rounded-full text-sm font-bold transition ${
                i === view
                  ? "bg-accent-400 text-ink-950"
                  : done
                    ? "bg-ink-800 text-white"
                    : "bg-slate-100 text-slate-500 ring-1 ring-slate-300"
              } disabled:cursor-default`}
            >
              {done && i !== view ? "✓" : i + 1}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function Summary({
  items,
  jobId,
  onOpen,
}: {
  items: PracticeItem[];
  jobId: string;
  onOpen: (i: number) => void;
}) {
  const answered = items.filter((i) => i.feedback);
  const delivery = roundDeliveryNote(
    answered.flatMap((i) => (i.feedback?.delivery ? [i.feedback.delivery] : [])),
  );
  return (
    <section
      className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
      data-testid="practice-summary"
    >
      <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
        Round done: {answered.length} of {items.length} answered
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Tap a question to read its feedback again. Fix what was missing in the story, then run
        another round.
      </p>
      {delivery && (
        <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700" data-testid="practice-round-delivery">
          <span className="font-semibold text-slate-900">How you said it: </span>
          {delivery}
        </p>
      )}
      <ol className="mt-4 space-y-2">
        {items.map((it, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onOpen(i)}
              className="w-full rounded-2xl bg-slate-50 px-4 py-3 text-left ring-1 ring-black/5 hover:bg-slate-100"
            >
              <span className="block font-semibold text-slate-900">
                {i + 1}. {it.question}
              </span>
              <span className="mt-1 block text-sm text-slate-600">
                {it.feedback
                  ? `${it.feedback.summary} · ${formatDuration(it.feedback.timing.seconds)}`
                  : it.skipped
                    ? "Skipped"
                    : "Not answered yet"}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap items-start gap-3">
        <StartPracticeForm jobId={jobId} label="Practice another round" />
        <Link
          href={`/jobs/${jobId}`}
          className="rounded-xl px-4 py-3 font-semibold text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50"
        >
          Back to the job
        </Link>
      </div>
    </section>
  );
}

const noSubscribe = () => () => {};
const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

// Reads a question aloud with the browser's own voice, so practice feels like being asked.
function HearIt({ text }: { text: string }) {
  const supported = useSyncExternalStore(noSubscribe, canSpeak, () => false);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={() => {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
      }}
      className="mt-2 shrink-0 rounded-lg p-1.5 text-ink-700 hover:bg-ink-50"
      aria-label="Hear the question"
      title="Hear the question"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 9v6h4l5 4V5L8 9H4zm12.5-1.5a5 5 0 0 1 0 9M19 5a8.5 8.5 0 0 1 0 14" />
      </svg>
    </button>
  );
}

function Thinking({ children }: { children: React.ReactNode }) {
  return (
    <li role="status" className="flex items-center gap-2 text-sm text-slate-600">
      <span className="h-2 w-2 animate-pulse rounded-full bg-ink-600" />
      {children}
    </li>
  );
}
