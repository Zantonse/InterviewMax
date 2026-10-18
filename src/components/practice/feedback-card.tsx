"use client";

import Link from "next/link";
import {
  CLOSENESS_LABELS,
  LAYER_LABELS,
  type PracticeFeedback,
  type PracticeTurn,
  SCREEN_RESULT_LABELS,
  formatDuration,
  timingNote,
  timingVerdict,
} from "@/lib/practice/content";
import {
  type Delivery,
  fillerLevel,
  fillerNote,
  paceNote,
  paceVerdict,
  pauseNote,
} from "@/lib/practice/delivery";

// Feedback on one practice answer: how it landed, how close it stayed to the saved story, what was
// missing, how each follow-up answer held up, the time spoken against the target (and, in an AI
// screen round, against its time limit), and how it was said (pace, filler words, long pauses)
// when it was said with Talk. New details the user said can be added to the
// story, one tap each, once they've read them. No score: practice is for rehearsal, not grading.
export function FeedbackCard({
  feedback,
  turns = [],
  storyHref,
  keeping,
  onKeep,
}: {
  feedback: PracticeFeedback;
  // The exchange, so each follow-up's verdict can name the follow-up it's about.
  turns?: PracticeTurn[];
  // The saved story, when there is one.
  storyHref?: string;
  // The index of the new fact being added, while it's saving.
  keeping?: number | null;
  onKeep?: (factIndex: number) => void;
}) {
  const verdict = timingVerdict(feedback.timing);
  const kept = feedback.newFacts.some((f) => f.kept);
  return (
    <section
      className="rounded-2xl bg-white p-5 ring-1 ring-ink-800/15"
      data-testid="practice-feedback"
    >
      <h3 className="text-xs font-bold uppercase tracking-wide text-ink-800">Feedback</h3>
      <p className="mt-2 font-semibold text-slate-900">{feedback.summary}</p>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="font-semibold text-slate-900">Time</dt>
          <dd
            className={`mt-1 ${verdict === "ok" ? "text-slate-700" : "text-amber-800"}`}
            data-testid="practice-timing"
            data-verdict={verdict}
          >
            {timingNote(feedback.timing)}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="font-semibold text-slate-900">
            {CLOSENESS_LABELS[feedback.closeness]}
          </dt>
          <dd className="mt-1 text-slate-700">
            {feedback.closenessNote ||
              (feedback.closeness === "no_story"
                ? "Build a story for this question, then practice it again."
                : "")}
          </dd>
        </div>
      </dl>

      {feedback.screen && (
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2" data-testid="practice-screen">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="font-semibold text-slate-900">Time limit</dt>
            <dd className={`mt-1 ${feedback.screen.withinTime ? "text-slate-700" : "text-amber-800"}`}>
              {feedback.screen.withinTime
                ? `Within the ${formatDuration(feedback.screen.limitSeconds)} limit.`
                : `Over the ${formatDuration(feedback.screen.limitSeconds)} limit: a real screen would have cut you off before the end.`}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt
              className={`font-semibold ${feedback.screen.result === "reached" ? "text-slate-900" : "text-amber-900"}`}
            >
              {SCREEN_RESULT_LABELS[feedback.screen.result]}
            </dt>
            <dd className="mt-1 text-slate-700">{feedback.screen.note}</dd>
          </div>
        </dl>
      )}

      {feedback.delivery ? (
        <DeliveryNotes delivery={feedback.delivery} />
      ) : (
        feedback.timing.measured === false && (
          <p className="mt-3 text-xs text-slate-500">
            Answer with Talk to get feedback on your pace and filler words.
          </p>
        )
      )}

      {feedback.landed.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-slate-900">What landed</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {feedback.landed.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      {(feedback.missing.length > 0 || feedback.numbersLeftOut.length > 0) && (
        <div className="mt-4 rounded-xl bg-amber-50 p-3">
          <h4 className="text-sm font-semibold text-amber-900">What was missing</h4>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-amber-950">
            {feedback.missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
            {feedback.numbersLeftOut.length > 0 && (
              <li>
                Figures in your story you didn&apos;t say: {feedback.numbersLeftOut.join(", ")}.
              </li>
            )}
          </ul>
        </div>
      )}

      {feedback.followUpsNote && (
        <p className="mt-4 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Follow-ups: </span>
          {feedback.followUpsNote}
        </p>
      )}

      {feedback.layers && feedback.layers.length > 0 && (
        <div className="mt-3" data-testid="practice-layers">
          <h4 className="text-sm font-semibold text-slate-900">Under the follow-ups</h4>
          <ol className="mt-2 space-y-2">
            {feedback.layers.map((l, i) => (
              <li
                key={i}
                className={`rounded-xl p-3 text-sm ${l.hold === "held" ? "bg-slate-50" : "bg-amber-50"}`}
                data-hold={l.hold}
              >
                <p
                  className={`font-semibold ${l.hold === "held" ? "text-slate-900" : "text-amber-900"}`}
                >
                  Follow-up {i + 1}: {LAYER_LABELS[l.hold]}
                </p>
                {turns[i + 1]?.question && (
                  <p className="mt-0.5 text-xs text-slate-500">&ldquo;{turns[i + 1].question}&rdquo;</p>
                )}
                {l.note && <p className="mt-1 text-slate-700">{l.note}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {feedback.newFacts.length > 0 && (
        <div className="mt-4 rounded-xl bg-ink-50 p-3" data-testid="practice-new-facts">
          <h4 className="text-sm font-semibold text-ink-900">New in this answer</h4>
          <p className="mt-0.5 text-xs text-slate-600">
            Details you said that aren&apos;t in your story yet. Add the ones that are true.
          </p>
          <ul className="mt-2 space-y-2">
            {feedback.newFacts.map((f, i) => (
              <li key={i} className="rounded-lg bg-white p-3 text-sm ring-1 ring-black/5">
                <p className="text-slate-900">{f.fact}</p>
                <p className="mt-1 text-xs text-slate-500">You said: &ldquo;{f.quote}&rdquo;</p>
                <div className="mt-2">
                  {f.kept ? (
                    <span className="text-xs font-semibold text-emerald-700">
                      ✓ Added to your story
                    </span>
                  ) : onKeep ? (
                    <button
                      type="button"
                      onClick={() => onKeep(i)}
                      disabled={keeping !== null && keeping !== undefined}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ink-800 ring-1 ring-ink-800/25 hover:bg-ink-50 disabled:opacity-50"
                    >
                      {keeping === i ? "Adding…" : "It's true, add it to my story"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {kept && storyHref && (
            <Link
              href={storyHref}
              className="mt-3 inline-block text-sm font-semibold text-ink-800 hover:underline"
            >
              Rewrite the story to use it →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

// How the answer was said: pace, filler words and long pauses. Worked out in code from the
// recording and the transcript; no score.
function DeliveryNotes({ delivery }: { delivery: Delivery }) {
  const paceOk = delivery.wpm === null || paceVerdict(delivery.wpm) === "ok";
  const fillersOk = fillerLevel(delivery) === "few";
  const pauses = pauseNote(delivery);
  return (
    <div className="mt-4" data-testid="practice-delivery">
      <h4 className="text-sm font-semibold text-slate-900">How you said it</h4>
      <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="font-semibold text-slate-900">Pace</dt>
          <dd
            className={`mt-1 ${paceOk ? "text-slate-700" : "text-amber-800"}`}
            data-testid="practice-pace"
          >
            {paceNote(delivery)}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="font-semibold text-slate-900">Filler words</dt>
          <dd
            className={`mt-1 ${fillersOk ? "text-slate-700" : "text-amber-800"}`}
            data-testid="practice-fillers"
          >
            {fillerNote(delivery)}
          </dd>
        </div>
      </dl>
      {pauses && <p className="mt-2 text-sm text-slate-700">{pauses}</p>}
      <p className="mt-2 text-xs text-slate-500">
        From your recording and its transcript. Speech-to-text often drops “um” and “uh”, so
        those can be undercounted.
      </p>
    </div>
  );
}
