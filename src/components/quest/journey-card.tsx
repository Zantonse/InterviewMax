import Link from "next/link";
import { startBossRound } from "@/app/practice/actions";
import { LevelMeter } from "@/components/level-meter";
import type { Journey } from "@/lib/quest/journeys";

// One journey: its steps as rows, what each is worth, and the one next step. No card: a heading
// over a rule, like every other section (design review 2026-11-23). `main` marks the journey the
// page leads with; only it gets the page's btn-next. `spoken` sets step labels in the serif, for
// steps that are interview questions.
export function JourneyCard({
  journey,
  main = false,
  spoken = false,
}: {
  journey: Journey;
  main?: boolean;
  spoken?: boolean;
}) {
  return (
    <section
      aria-label={`Journey: ${journey.title}`}
      data-testid={`journey-${journey.id}`}
      data-done={journey.done || undefined}
    >
      <div className="border-b border-ink-200 pb-3">
        <p className="text-sm text-slate-600">{journey.done ? "Journey done" : "Journey"}</p>
        <h2 className={`mt-0.5 font-semibold text-slate-900 ${main ? "text-xl" : "text-lg"}`}>
          {journey.title}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{journey.blurb}</p>
      </div>
      <ol className="divide-y divide-ink-100">
        {journey.steps.map((step) => {
          const level = step.tag?.match(/^Level (\d)$/)?.[1];
          return (
            <li
              key={step.id}
              className="flex items-baseline gap-3 py-2.5"
              data-state={step.state}
            >
              <span
                aria-hidden
                className={`relative top-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[0.625rem] font-bold ${
                  step.state === "done"
                    ? "bg-emerald-700 text-white"
                    : step.state === "now"
                      ? "ring-2 ring-accent-500 ring-offset-1"
                      : "ring-1 ring-ink-300"
                }`}
              >
                {step.state === "done" ? "✓" : ""}
              </span>
              <span
                className={`min-w-0 flex-1 ${spoken && step.id !== "boss" ? "font-words text-[1.0625rem] leading-snug" : "text-[0.9375rem]"} ${
                  step.state === "locked" ? "text-slate-500" : "text-slate-900"
                } ${step.state === "now" ? "font-medium" : ""}`}
              >
                {step.label}
                <span className="sr-only">
                  {step.state === "done" ? " (done)" : step.state === "now" ? " (next)" : ""}
                </span>
              </span>
              {step.tag && (
                <span className="flex shrink-0 items-center gap-1.5 text-sm text-slate-600">
                  {level && <LevelMeter level={Math.min(3, Number(level))} />}
                  {step.tag}
                </span>
              )}
              {step.xp > 0 && (
                <span
                  className={`w-12 shrink-0 text-right font-mono text-sm tabular-nums ${step.state === "done" ? "text-slate-900" : "text-slate-500"}`}
                >
                  +{step.xp}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {journey.boss && (
        <form action={startBossRound} className="mt-4">
          <input type="hidden" name="jobId" value={journey.boss.jobId} />
          <button
            type="submit"
            className={main ? "btn-next" : "btn-primary"}
            data-testid={`journey-${journey.id}-start`}
          >
            Start the boss round
          </button>
        </form>
      )}
      {journey.next &&
        (main ? (
          <Link href={journey.next.href} className="btn-next mt-4" data-testid={`journey-${journey.id}-next`}>
            {journey.next.label}
          </Link>
        ) : (
          <p className="mt-3 text-sm">
            <Link href={journey.next.href} className="link" data-testid={`journey-${journey.id}-next`}>
              {journey.next.label}
            </Link>
          </p>
        ))}
    </section>
  );
}
