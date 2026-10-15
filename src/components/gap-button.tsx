"use client";

import { useFormStatus } from "react-dom";

// An empty theme on the coverage grid: starts the story type that fills it (PRD: gaps are actions).
// Sits inside a form whose action is startStory.
export function GapButton({
  themeLabel,
  storyType,
  storyLabel,
}: {
  themeLabel: string;
  storyType: string;
  storyLabel: string;
}) {
  const { pending, data } = useFormStatus();
  const starting = pending && data?.get("storyType") === storyType;
  return (
    <button
      type="submit"
      name="storyType"
      value={storyType}
      disabled={pending}
      className="flex h-full w-full flex-col items-start rounded-xl border border-dashed border-accent-300/70 px-3 py-2 text-left transition hover:bg-accent-300/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 disabled:opacity-70"
      title={`Build: ${storyLabel}`}
      data-testid={`gap-${storyType}`}
    >
      <span className="text-sm font-semibold">{themeLabel}</span>
      <span className="mt-0.5 text-xs text-accent-200">
        {starting ? "Starting…" : "+ Build"}
      </span>
    </button>
  );
}
