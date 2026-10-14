"use client";

import { useState, useTransition } from "react";
import { removeStory } from "@/app/stories/actions";

// Deletes a story after one confirm step. "full" sits in the story page's ⋯ menu; "compact" fits
// a row of the story bank on the home page.
export function DeleteStoryButton({
  storyId,
  title,
  variant = "full",
}: {
  storyId: string;
  title: string;
  variant?: "full" | "compact";
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await removeStory(storyId);
      if (result?.error) setError(result.error);
    });
  }

  if (variant === "compact") {
    return confirming ? (
      <span className="flex shrink-0 items-center gap-1.5" data-testid="delete-confirm">
        <span className="text-xs text-navy-50">{error ?? "Delete?"}</span>
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {pending ? "Deleting…" : "Yes"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-navy-50 hover:bg-white/10"
        >
          No
        </button>
      </span>
    ) : (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${title}`}
        title="Delete story"
        className="shrink-0 rounded-lg p-2 text-navy-100 hover:bg-white/10 hover:text-white"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
        </svg>
      </button>
    );
  }

  return (
    <div>
      <h2 className="font-semibold text-slate-900">Start this story from scratch</h2>
      <p className="mt-1 text-sm text-slate-600">
        Deleting removes every answer, follow-up and draft for this story.
      </p>
      {confirming ? (
        <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="delete-confirm">
          <p className="text-sm font-medium text-slate-900">
            Delete &ldquo;{title}&rdquo; for good? This can&apos;t be undone.
          </p>
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Yes, delete it"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
          >
            Keep it
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 rounded-xl px-4 py-2 text-sm font-semibold text-red-700 ring-1 ring-red-300 hover:bg-red-50"
        >
          Delete story
        </button>
      )}
      {error && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
