"use client";

import { useState } from "react";
import { CONFIDENCE_LABELS, type Confidence } from "@/lib/practice/content";

const STEPS: Confidence[] = [1, 2, 3, 4, 5];

// The colour a rating fills with: amber while it's shaky, ink in the middle, green once confident.
export function confidenceColour(value: Confidence): string {
  return value <= 2 ? "bg-amber-400" : value >= 4 ? "bg-emerald-600" : "bg-ink-700";
}

// "How did that feel?": five segments from Shaky to Confident, tapped after an answer's feedback.
// The user's own read, kept on the question; the next round brings shaky ones back first.
export function ConfidenceBar({
  value,
  disabled,
  onRate,
}: {
  value?: Confidence;
  disabled: boolean;
  onRate: (value: Confidence) => void;
}) {
  // The tap shows at once; the saved value replaces it when it comes back.
  const [picked, setPicked] = useState<Confidence | undefined>(undefined);
  const shown = picked ?? value;
  return (
    <section
      className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
      data-testid="confidence-bar"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-800">How did that feel?</h2>
        <span className="text-sm font-semibold text-slate-900" aria-live="polite">
          {shown ? CONFIDENCE_LABELS[shown] : ""}
        </span>
      </div>
      <div
        role="radiogroup"
        aria-label="How confident that answer felt"
        className="mt-3 grid grid-cols-5 gap-1.5"
      >
        {STEPS.map((step) => {
          const on = shown !== undefined && step <= shown;
          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={shown === step}
              aria-label={CONFIDENCE_LABELS[step]}
              disabled={disabled}
              onClick={() => {
                setPicked(step);
                onRate(step);
              }}
              className={`h-8 rounded-full ring-1 ring-inset transition-colors disabled:opacity-60 ${
                on && shown
                  ? `${confidenceColour(shown)} ring-transparent`
                  : "bg-slate-50 ring-slate-300 hover:bg-ink-50"
              }`}
              data-testid={`confidence-${step}`}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-slate-500">
        <span>Shaky</span>
        <span>Confident</span>
      </div>
    </section>
  );
}

// The same bar, small and read-only: a rating in a list.
export function ConfidencePips({ value }: { value: Confidence }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`Felt ${CONFIDENCE_LABELS[value].toLowerCase()}`}
      data-testid="confidence-pips"
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {STEPS.map((step) => (
          <span
            key={step}
            className={`h-1.5 w-3 rounded-full ${step <= value ? confidenceColour(value) : "bg-slate-200"}`}
          />
        ))}
      </span>
      <span>{CONFIDENCE_LABELS[value]}</span>
    </span>
  );
}
