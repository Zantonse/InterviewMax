import Link from "next/link";
import type { Journey } from "@/lib/quest/journeys";

// One journey: its steps with what each is worth, and the one next step. `main` marks the journey
// the page leads with; it gets the page's one periwinkle button.
export function JourneyCard({ journey, main = false }: { journey: Journey; main?: boolean }) {
  return (
    <section
      className={`rounded-3xl bg-white p-5 shadow-sm ring-1 sm:p-6 ${main ? "ring-accent-300" : "ring-black/5"}`}
      aria-label={`Journey: ${journey.title}`}
      data-testid={`journey-${journey.id}`}
      data-done={journey.done || undefined}
    >
      <p className="font-mono text-xs tracking-wider text-accent-700 uppercase">
        {journey.done ? "Journey done" : "Journey"}
      </p>
      <h2 className="mt-1 text-lg font-bold text-slate-900">{journey.title}</h2>
      <p className="mt-1 text-sm text-slate-600">{journey.blurb}</p>
      <ol className="mt-4 flex flex-col gap-2">
        {journey.steps.map((step) => (
          <li
            key={step.id}
            className={`flex items-center gap-3 text-sm ${
              step.state === "now"
                ? "font-semibold text-slate-900"
                : step.state === "locked"
                  ? "text-slate-500"
                  : "text-slate-700"
            }`}
            data-state={step.state}
          >
            <span
              aria-hidden
              className={`grid size-5 shrink-0 place-items-center rounded-full text-[0.65rem] font-bold ${
                step.state === "done"
                  ? "bg-emerald-600 text-white"
                  : step.state === "now"
                    ? "ring-2 ring-accent-500 ring-offset-2"
                    : "ring-2 ring-slate-200"
              }`}
            >
              {step.state === "done" ? "✓" : ""}
            </span>
            <span className="min-w-0 flex-1">
              {step.label}
              <span className="sr-only">
                {step.state === "done" ? " (done)" : step.state === "now" ? " (next)" : ""}
              </span>
            </span>
            {step.xp > 0 && (
              <span
                className={`font-mono text-xs tabular-nums ${step.state === "done" ? "text-emerald-700" : "text-slate-500"}`}
              >
                +{step.xp}
              </span>
            )}
          </li>
        ))}
      </ol>
      {journey.next && (
        <Link
          href={journey.next.href}
          className={`mt-4 ${main ? "btn-next" : "btn-secondary"}`}
          data-testid={`journey-${journey.id}-next`}
        >
          {journey.next.label}
        </Link>
      )}
    </section>
  );
}
