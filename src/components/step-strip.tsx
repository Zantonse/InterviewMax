import type { GuideStep } from "@/lib/guide/journey";

// A row of numbered steps: done ones ticked, the next one highlighted, each linking to where it's
// done. On phones only the next step's detail shows, so the row stays short.
export function StepStrip({ label, steps }: { label: string; steps: GuideStep[] }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <nav
      aria-label={label}
      className="mt-5 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-ink-700/30"
      data-testid="step-strip"
    >
      <ol
        className={`grid grid-cols-1 gap-1 sm:grid-cols-2 ${steps.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}
      >
        {steps.map((step, i) => {
          const isCurrent = i === current;
          return (
            <li key={step.id}>
              <a
                href={step.href}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex items-start gap-3 rounded-xl px-3 py-2 transition ${
                  isCurrent ? "bg-accent-50 ring-1 ring-accent-300" : "hover:bg-slate-50"
                } ${!isCurrent && current >= 0 ? "max-sm:py-1" : ""}`}
                data-testid={`step-${step.id}`}
                data-done={step.done || undefined}
              >
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    step.done
                      ? "bg-ink-800 text-white"
                      : isCurrent
                        ? "bg-accent-400 text-ink-950"
                        : "bg-slate-100 text-slate-500 ring-1 ring-slate-300"
                  }`}
                  aria-hidden
                >
                  {step.done ? "✓" : i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-semibold ${
                      step.done ? "text-slate-500" : "text-slate-900"
                    }`}
                  >
                    {step.label}
                    {step.done && <span className="sr-only"> (done)</span>}
                  </span>
                  <span
                    className={`block text-xs text-slate-500 ${isCurrent ? "" : "max-sm:hidden"}`}
                  >
                    {isCurrent ? `Next · ${step.detail}` : step.detail}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// The same steps as one row of dots with only the next step named, for pages that lead with a
// picture of their own (the target job page's readiness ring).
export function StepDots({ label, steps }: { label: string; steps: GuideStep[] }) {
  const current = steps.findIndex((s) => !s.done);
  const next = current >= 0 ? steps[current] : undefined;
  return (
    <nav
      aria-label={label}
      className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
      data-testid="step-strip"
    >
      <ol className="flex items-center gap-1.5">
        {steps.map((step, i) => (
          <li key={step.id}>
            <a
              href={step.href}
              title={step.label}
              aria-current={i === current ? "step" : undefined}
              data-testid={`step-${step.id}`}
              data-done={step.done || undefined}
              className={`block h-2.5 rounded-full transition-all duration-300 ${
                step.done
                  ? "w-2.5 bg-ink-800"
                  : i === current
                    ? "w-6 bg-accent-500"
                    : "w-2.5 bg-slate-300"
              }`}
            >
              <span className="sr-only">
                {step.label}
                {step.done ? " (done)" : ""}
              </span>
            </a>
          </li>
        ))}
      </ol>
      <span className="text-slate-500">
        {steps.filter((s) => s.done).length} of {steps.length} steps
      </span>
      {next && (
        <a href={next.href} className="font-semibold text-ink-800 hover:underline">
          Next: {next.label} →
        </a>
      )}
    </nav>
  );
}
