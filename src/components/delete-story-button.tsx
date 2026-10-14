"use client";

import { useState, useTransition } from "react";
import { removeStory } from "@/app/stories/actions";

// Deletes a story after one confirm step. Sits in the story page's ⋯ menu.
export function DeleteStoryButton({ storyId, title }: { storyId: string; title: string }) {
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
