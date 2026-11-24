import Link from "next/link";
import { startStory } from "@/app/stories/new/actions";
import type { Citation, NextStep } from "@/lib/profile/assess";
import type { InterviewProfile, InterviewScore, ProfileMove, ProfilePoint } from "@/lib/transcripts/profile";

// The interview profile at the top of Past interviews: a scorecard, how each interview went,
// strengths, weaknesses and the next things to work on. Grows with every reviewed upload.

// Same colours as the landed pills on a past interview's page.
const LANDED_BAR = {
  strong: { className: "bg-ink-800", label: "Landed well" },
  mixed: { className: "bg-amber-400", label: "Partly landed" },
  weak: { className: "bg-red-400", label: "Didn't land" },
} as const;

export function InterviewProfileCard({ profile }: { profile: InterviewProfile }) {
  if (profile.interviews === 0) return null;
  return (
    <section
      className="animate-enter panel"
      id="interview-profile"
      aria-labelledby="interview-profile-title"
      data-testid="interview-profile"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="interview-profile-title" className="text-lg font-semibold text-slate-900">
          Your interview profile
        </h2>
        <p className="text-sm text-slate-600">
          From {profile.interviews} reviewed {profile.interviews === 1 ? "interview" : "interviews"}. Grows with
          each one you add.
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3" data-testid="profile-stats">
        <Stat label="Answers judged" value={String(profile.answers)} />
        <Stat label="Landed well" value={profile.landed === null ? "–" : `${profile.landed}%`} />
        <Stat
          label="Hedges per 100 words"
          value={profile.hedges === null ? "–" : profile.hedges.toFixed(1).replace(/\.0$/, "")}
          hint={profile.hedges === null ? "Label your answers in an interview to see this" : "Under 0.5 sounds sure"}
        />
      </dl>

      {profile.scores.length > 0 && <InterviewStrip scores={profile.scores} />}

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <PointColumn
          title="Strengths"
          points={profile.strengths}
          empty="Strengths show up once a few answers land well."
          testId="interview-strengths"
          tone="good"
        />
        <PointColumn
          title="Weaknesses"
          points={profile.weaknesses}
          empty={
            profile.answers < 3
              ? "Add a few more interviews to see patterns."
              : "No weakness repeats across your answers."
          }
          testId="interview-weaknesses"
          tone="work"
        />
      </div>

      {profile.workOn.length > 0 && (
        <div className="mt-6 rounded-2xl bg-ink-50 p-4" data-testid="interview-work-on">
          <h3 className="text-sm font-semibold text-ink-900">Work on next</h3>
          <ol className="mt-2 space-y-3">
            {profile.workOn.map((w, i) => (
              <li key={w.id} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink-800 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-slate-700">{w.why}</span>
                  <StepLink step={w.next} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <dt className="text-xs font-semibold text-slate-600">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-slate-500">{hint}</dd>}
    </div>
  );
}

// One bar per interview, oldest on the left, split by how its answers landed. Each bar links to
// that interview; its title says the counts, and the list below repeats them as text.
function InterviewStrip({ scores }: { scores: InterviewScore[] }) {
  const max = Math.max(1, ...scores.map((s) => s.judged));
  return (
    <figure className="mt-5" data-testid="interview-strip">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span className="font-semibold">Each interview, in the order you added them</span>
        <span className="flex flex-wrap gap-3">
          {Object.values(LANDED_BAR).map((b) => (
            <span key={b.label} className="flex items-center gap-1">
              <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-sm ${b.className}`} />
              {b.label}
            </span>
          ))}
        </span>
      </figcaption>
      <div className="mt-2 flex h-24 items-end gap-1 overflow-x-auto pb-1" role="list">
        {scores.map((s) => {
          const label = `${s.title}: ${s.strong} landed well, ${s.mixed} partly, ${s.weak} didn't land`;
          return (
            <Link
              key={s.id}
              href={s.href}
              role="listitem"
              aria-label={label}
              title={label}
              className="group flex h-full min-w-3 max-w-10 flex-1 flex-col justify-end rounded-t px-px hover:bg-slate-100"
            >
              {s.judged === 0 ? (
                <span className="block h-1 rounded bg-slate-200" />
              ) : (
                <span
                  className="flex flex-col-reverse gap-0.5 overflow-hidden rounded-t"
                  style={{ height: `${Math.max(8, (s.judged / max) * 100)}%` }}
                >
                  {(["strong", "mixed", "weak"] as const).map((k) =>
                    s[k] > 0 ? (
                      <span key={k} className={LANDED_BAR[k].className} style={{ flexGrow: s[k] }} />
                    ) : null,
                  )}
                </span>
              )}
            </Link>
          );
        })}
      </div>
      <details className="mt-1 text-xs text-slate-600">
        <summary className="cursor-pointer">As a list</summary>
        <ul className="mt-1 space-y-0.5">
          {scores.map((s) => (
            <li key={s.id}>
              <Link href={s.href} className="hover:underline">
                {s.title}
              </Link>
              : {s.judged === 0 ? "no answers judged" : `${s.landed}% landed well (${s.strong} of ${s.judged})`}
              {s.hedges !== null && `, ${s.hedges} hedges per 100 words`}
            </li>
          ))}
        </ul>
      </details>
    </figure>
  );
}

function PointColumn({
  title,
  points,
  empty,
  testId,
  tone,
}: {
  title: string;
  points: ProfilePoint[];
  empty: string;
  testId: string;
  tone: "good" | "work";
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-800">{title}</h3>
      {points.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-4" data-testid={testId}>
          {points.map((p) => (
            <li key={p.id} data-testid={`${testId}-${p.id}`} className="flex gap-2">
              <span aria-hidden className={tone === "good" ? "text-green-600" : "text-amber-600"}>
                {tone === "good" ? "▲" : "▼"}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900">{p.title}</span>
                <span className="block text-sm text-slate-600">{p.detail}</span>
                {p.note && <span className="mt-1 block text-sm text-slate-700">{p.note}</span>}
                {p.citation && <Quote citation={p.citation} />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Quote({ citation }: { citation: Citation }) {
  return (
    <span className="mt-1 block text-sm">
      {citation.quote && <span className="block italic text-slate-700">“{citation.quote}”</span>}
      {citation.href ? (
        <Link href={citation.href} className="text-xs text-slate-500 hover:text-ink-800 hover:underline">
          {citation.label}
        </Link>
      ) : (
        <span className="text-xs text-slate-500">{citation.label}</span>
      )}
    </span>
  );
}

function StepLink({ step }: { step: NextStep }) {
  const className = "mt-0.5 inline-block text-sm font-semibold text-ink-800 hover:underline";
  if (step.storyType) {
    return (
      <form action={startStory}>
        <button type="submit" name="storyType" value={step.storyType} className={className}>
          {step.label} →
        </button>
      </form>
    );
  }
  return (
    <Link href={step.href ?? "/"} className={className}>
      {step.label} →
    </Link>
  );
}

// After a review: how this one interview moved the profile.
export function ProfileMovesCard({ moves }: { moves: ProfileMove[] }) {
  if (moves.length === 0) return null;
  return (
    <section
      className="animate-enter panel"
      data-testid="profile-moves"
    >
      <h2 className="text-sm font-semibold text-ink-800">How this interview moved your profile</h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        {moves.map((m) => (
          <li key={m.text} className="flex items-start gap-2">
            <span
              aria-hidden
              className={m.direction === "down" ? "text-amber-600" : m.direction === "up" ? "text-green-600" : "text-slate-400"}
            >
              {m.direction === "down" ? "▼" : m.direction === "up" ? "▲" : "●"}
            </span>
            <span className="text-slate-700">{m.text}</span>
          </li>
        ))}
      </ul>
      <Link href="/transcripts#interview-profile" className="mt-3 inline-block text-sm font-semibold text-ink-800 hover:underline">
        See your whole interview profile →
      </Link>
    </section>
  );
}
