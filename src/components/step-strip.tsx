import type { GuideStep } from "@/lib/guide/journey";

// A guide's steps as one row of dots, done ones filled and the next one wide, with only the next
// step named and linked. Each dot links to where its step is done.
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
