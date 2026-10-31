import Link from "next/link";
import { RoundPicker } from "@/app/transcripts/forms";
import { getTheme } from "@/lib/questions/themes";
import type { Landed } from "@/lib/transcripts/content";
import type { Timeline } from "@/lib/transcripts/timeline";

const LANDED: Record<Landed, { label: string; className: string }> = {
  strong: { label: "Landed well", className: "bg-ink-800 text-white" },
  mixed: { label: "Partly landed", className: "bg-amber-100 text-amber-900" },
  weak: { label: "Didn't land", className: "bg-red-100 text-red-900" },
  unclear: { label: "Not judged", className: "bg-slate-100 text-slate-600" },
};

// The interview timeline on a target job's page: each past interview as a step, in round order,
// then what to prepare for the next one (or how it ended).
export function InterviewTimeline({
  jobId,
  timeline,
  finished,
}: {
  jobId: string;
  timeline: Timeline;
  // "Offer · reached round 3" once the job is marked finished, else null.
  finished: string | null;
}) {
  const { steps, next } = timeline;
  return (
    <section
      id="timeline"
      className="scroll-mt-20 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
      data-testid="job-timeline"
    >
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">
        Interview timeline
      </h2>
      {steps.length === 0 ? (
        <>
          <p className="mb-4 text-slate-600">
            Add the transcripts of your rounds here and I&apos;ll lay them out in order: who you
            met, what they asked, how each answer landed and what to prepare for the next round.
          </p>
          <Link
            href={`/transcripts?job=${jobId}`}
            className="text-sm font-semibold text-ink-800 hover:underline"
          >
            Add an interview for this job →
          </Link>
        </>
      ) : (
        <>
          <p className="mb-5 text-sm text-slate-600">
            Your rounds so far, in order, from your past interviews.
          </p>
          <ol className="relative space-y-6 border-l-2 border-ink-800/15 pl-6">
            {steps.map((s, i) => (
              <li key={s.transcriptId} className="relative" data-testid="timeline-step">
                <span
                  aria-hidden
                  className="absolute -left-[35px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-xs font-bold text-white"
                >
                  {i + 1}
                </span>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {s.roundLabel}
                  {s.guessed && <span className="font-normal normal-case"> (guessed)</span>}
                </p>
                <Link
                  href={`/transcripts/${s.transcriptId}`}
                  className="font-semibold text-ink-800 hover:underline"
                >
                  {s.title}
                </Link>
                {s.interviewers.length > 0 && (
                  <p className="text-sm text-slate-600">With {joinNames(s.interviewers)}</p>
                )}
                {s.summary && <p className="mt-1 text-sm text-slate-700">{s.summary}</p>}
                {s.asked.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {s.asked.map((q) => (
                      <li key={q.question} className="flex flex-wrap items-baseline gap-2">
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${LANDED[q.landed].className}`}
                        >
                          {LANDED[q.landed].label}
                        </span>
                        <span className="min-w-0 flex-1 text-slate-700">
                          &ldquo;{q.question}&rdquo;
                          {getTheme(q.theme) && (
                            <span className="text-slate-500"> · {getTheme(q.theme)!.label}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {!s.reviewed && (
                  <p className="mt-1 text-sm text-slate-500">
                    Not reviewed yet. Open it to see what they asked.
                  </p>
                )}
                <div className="mt-2">
                  <RoundPicker transcriptId={s.transcriptId} round={s.round} guessed={s.guessed} />
                </div>
              </li>
            ))}
            <li className="relative" data-testid="timeline-next">
              <span
                aria-hidden
                className={`absolute -left-[35px] top-0 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  finished
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-ink-800 ring-2 ring-ink-800/30"
                }`}
              >
                {finished ? "✓" : steps.length + 1}
              </span>
              {finished ? (
                <p className="font-semibold text-slate-900">Finished: {finished}</p>
              ) : (
                <>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Next{next.label ? `: likely the ${next.label.toLowerCase()}` : ""}
                  </p>
                  {next.prepare.length > 0 ? (
                    <>
                      <p className="mt-1 text-sm text-slate-700">
                        Before it, fix the answers that didn&apos;t land:
                      </p>
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
                        {next.prepare.map((p) => (
                          <li key={p.question}>
                            &ldquo;{p.question}&rdquo;
                            {p.theme && <span className="text-slate-500"> · {p.theme}</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-slate-700">
                      Nothing from your rounds so far needs fixing. Keep your stories warm.
                    </p>
                  )}
                  {next.repeated.length > 0 && (
                    <p className="mt-2 text-sm text-slate-700">
                      Asked in more than one round, so expect it again:{" "}
                      <span className="font-semibold">{next.repeated.join(", ")}</span>.
                    </p>
                  )}
                </>
              )}
            </li>
          </ol>
        </>
      )}
    </section>
  );
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
