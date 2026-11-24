"use client";

import { useState } from "react";

// Today's step on home with "See the plan" beside its button: the whole plan opens under the step,
// in the same shaded block, so the one next step stays the first thing you read.
export function PlanToggle({
  step,
  actions,
  plan,
}: {
  step: React.ReactNode;
  actions: React.ReactNode;
  plan?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="min-w-0">{step}</div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3">
          {plan && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="link text-sm"
              data-testid="whole-plan-toggle"
            >
              {open ? "Hide the plan" : "See the plan"}
            </button>
          )}
          {actions}
        </div>
      </div>
      {plan && open && (
        <div className="mt-5 border-t border-ink-200 pt-4" data-testid="whole-plan">
          {plan}
        </div>
      )}
    </>
  );
}
