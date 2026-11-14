"use client";

import { WhatYouGet } from "@/components/what-you-get";
import { useState, useTransition } from "react";
import { AiNotice } from "@/components/ai-notice";
import { CopyButton } from "@/components/copy-button";
import {
  RECRUITER_CHECK_LABELS,
  canRecruiter,
  recruiterChecks,
  recruiterIsCurrent,
  recruiterSeconds,
  recruiterText,
  type RecruiterVersion,
} from "@/lib/recruiter/content";
import type { StoryContent } from "@/lib/stories/content";
import { draftText } from "@/lib/stories/grading";
import type { StoryType } from "@/lib/stories/story-types";
import { withEmphasis } from "@/lib/telling/content";
import { makeRecruiter } from "./recruiter-actions";

// "Recruiter version" on the Story & score view: the same story for a recruiter screen, under a
// minute, plain words, result first, and the details to save for the hiring manager. Shown when a
// job's next stage is a recruiter screen, or once one has been made. Never changes the story.
export function RecruiterPanel({
  storyId,
  content,
  storyType,
  disabled,
  onContent,
}: {
  // Read when it runs: a new story gets its id with its first answer.
  storyId: () => string;
  content: StoryContent;
  storyType: StoryType | undefined;
  disabled: boolean;
  onContent: (content: StoryContent) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!content.draft || !canRecruiter(storyType)) return null;
  const version = content.recruiter;
  const current = recruiterIsCurrent(version, content.draft.writtenAt);

  function make() {
    setError(null);
    startTransition(async () => {
      const result = await makeRecruiter(storyId());
      if (result.ok) onContent(result.content);
      else setError(result.error);
    });
  }

  return (
    <section
      className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition sm:p-6 ${
        pending ? "opacity-60" : ""
      }`}
      aria-label="Recruiter version"
      data-testid="recruiter-version"
    >
      <p className="text-sm font-bold uppercase tracking-wide text-ink-800">Recruiter version</p>
      {current ? (
        <Made
          version={version}
          content={content}
          storyType={storyType}
          disabled={disabled || pending}
          pending={pending}
          onMake={make}
        />
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          {version ? (
            <p className="text-slate-700">
              You&apos;ve changed the story since I made this. I&apos;ll make one from the new
              version.
            </p>
          ) : (
            <>
              <p className="text-slate-700">Recruiters check fit, not depth.</p>
              <WhatYouGet
                items={["Under a minute", "Result first", "Plain words", "What to save for later"]}
              />
            </>
          )}
          <div>
            <button
              type="button"
              onClick={make}
              disabled={disabled || pending}
              className="rounded-xl bg-ink-800 px-4 py-2 font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
              data-testid="recruiter-make"
            >
              {pending
                ? "Making the recruiter version…"
                : version
                  ? "Make it again"
                  : "Make the recruiter version"}
            </button>
          </div>
          <AiNotice purpose="make the recruiter version of your story" />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </section>
  );
}

const LINES = [
  { key: "headline", label: "The headline", emphasize: true },
  { key: "context", label: "The situation", emphasize: false },
  { key: "part", label: "What I did", emphasize: false },
] as const;

function Made({
  version,
  content,
  storyType,
  disabled,
  pending,
  onMake,
}: {
  version: RecruiterVersion;
  content: StoryContent;
  storyType: StoryType | undefined;
  disabled: boolean;
  pending: boolean;
  onMake: () => void;
}) {
  const story = content.draft ? draftText(content.draft.parts, storyType) : "";
  const text = recruiterText(version);
  const checks = recruiterChecks(version, { story, answers: "", untraced: version.untracedNumbers });

  return (
    <div className="mt-2 flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <span data-testid="recruiter-length">
            About {recruiterSeconds(text)} seconds spoken · {Math.round(version.ownWords * 100)}% in
            your words
          </span>
          <CopyButton
            text={text}
            className="rounded-full px-3 py-1 font-medium text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50"
          />
        </div>
        <ol className="mt-3 flex flex-col gap-3" data-testid="recruiter-lines" data-stagger>
          {LINES.map((line, i) =>
            version[line.key] ? (
              <li key={line.key} className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {i + 1}. {line.label}
                </span>
                <p
                  className={
                    i === 0
                      ? "text-lg font-semibold leading-relaxed text-slate-900"
                      : "text-lg leading-relaxed text-slate-800"
                  }
                >
                  {withEmphasis(version[line.key], line.emphasize).map((piece, j) =>
                    piece.emphasis ? (
                      <strong key={j} className="font-bold text-slate-950">
                        {piece.text}
                      </strong>
                    ) : (
                      <span key={j}>{piece.text}</span>
                    ),
                  )}
                </p>
              </li>
            ) : null,
          )}
        </ol>
        {version.untracedNumbers.length > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            These figures aren&apos;t in your answers:{" "}
            <strong>{version.untracedNumbers.join(", ")}</strong>. Don&apos;t say them unless
            they&apos;re real; make it again to drop them.
          </p>
        )}
      </div>

      <ul
        className="grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2"
        data-testid="recruiter-checks"
      >
        {checks.map((c) => (
          <li key={c.id} className="flex flex-col">
            <span className="flex items-center gap-2 font-semibold text-slate-800">
              <span className={c.passed ? "text-emerald-700" : "text-amber-700"}>
                {c.passed ? "✓" : "!"}
              </span>
              {RECRUITER_CHECK_LABELS[c.id]}
            </span>
            <span className="pl-5 text-slate-600">{c.note}</span>
          </li>
        ))}
      </ul>

      {version.saveFor.length > 0 && (
        <div>
          <h3 className="font-bold text-slate-900">Save for the hiring manager</h3>
          <p className="mt-1 text-sm text-slate-600">
            End with &ldquo;happy to go deeper on that&rdquo;. These are for the next round.
          </p>
          <ul className="mt-2 flex flex-wrap gap-2" data-testid="recruiter-save-for">
            {version.saveFor.map((s) => (
              <li
                key={s}
                className="rounded-full bg-slate-50 px-3 py-1 text-sm text-slate-700 ring-1 ring-black/5"
              >
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onMake}
          disabled={disabled}
          className="rounded-xl px-4 py-2 font-semibold text-ink-800 ring-1 ring-ink-800/30 hover:bg-ink-50 disabled:opacity-50"
          data-testid="recruiter-again"
        >
          {pending ? "Making it again…" : "Make it again"}
        </button>
      </div>
    </div>
  );
}
