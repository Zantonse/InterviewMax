"use client";

import { WhatYouGet } from "@/components/what-you-get";
import { useState, useTransition } from "react";
import { AiNotice } from "@/components/ai-notice";
import { CopyButton } from "@/components/copy-button";
import {
  EXEC_CHECK_LABELS,
  canExec,
  execChecks,
  execIsCurrent,
  execSeconds,
  execText,
  findHedges,
  hedgeLabel,
  type ExecVersion,
} from "@/lib/exec/content";
import type { StoryContent } from "@/lib/stories/content";
import { draftText } from "@/lib/stories/grading";
import type { StoryType } from "@/lib/stories/story-types";
import { withEmphasis } from "@/lib/telling/content";
import { makeExec } from "./exec-actions";

// "Exec version", under "How to tell it" on the Story & score view: the same story told answer
// first, for a director-or-above interviewer or "give me the short version". Three lines, then the
// questions they'd likely ask next. It never changes the story or its score.
export function ExecPanel({
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
  if (!content.draft || !canExec(storyType)) return null;
  const exec = content.exec;
  const current = execIsCurrent(exec, content.draft.writtenAt);

  function make() {
    setError(null);
    startTransition(async () => {
      const result = await makeExec(storyId());
      if (result.ok) onContent(result.content);
      else setError(result.error);
    });
  }

  return (
    <section
      className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition sm:p-6 ${
        pending ? "opacity-60" : ""
      }`}
      aria-label="Exec version"
      data-testid="exec-version"
    >
      <p className="text-sm font-bold uppercase tracking-wide text-ink-800">Exec version</p>
      {current ? (
        <Made
          exec={exec}
          content={content}
          storyType={storyType}
          disabled={disabled || pending}
          pending={pending}
          onMake={make}
        />
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          {exec ? (
            <p className="text-slate-700">
              You&apos;ve changed the story since I made this. I&apos;ll make one from the new
              version.
            </p>
          ) : (
            <>
              <p className="text-slate-700">Executives want the answer first.</p>
              <WhatYouGet
                items={["30 seconds", "Result and its number", "Why it mattered", "The key decision"]}
              />
            </>
          )}
          <div>
            <button
              type="button"
              onClick={make}
              disabled={disabled || pending}
              className="rounded-xl bg-ink-800 px-4 py-2 font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
              data-testid="exec-make"
            >
              {pending ? "Making the exec version…" : exec ? "Make it again" : "Make the exec version"}
            </button>
          </div>
          <AiNotice purpose="make the exec version of your story" />
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
  { key: "bottomLine", label: "The bottom line", emphasize: true },
  { key: "why", label: "Why it mattered", emphasize: false },
  { key: "how", label: "How I did it", emphasize: false },
] as const;

function Made({
  exec,
  content,
  storyType,
  disabled,
  pending,
  onMake,
}: {
  exec: ExecVersion;
  content: StoryContent;
  storyType: StoryType | undefined;
  disabled: boolean;
  pending: boolean;
  onMake: () => void;
}) {
  const story = content.draft ? draftText(content.draft.parts, storyType) : "";
  const text = execText(exec);
  const checks = execChecks(exec, { story, answers: "", untraced: exec.untracedNumbers });
  const habits = findHedges(story);

  return (
    <div className="mt-2 flex flex-col gap-5">
      <p className="text-sm text-slate-600">
        Say the bottom line, then stop and let them pull the rest.
      </p>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <span data-testid="exec-length">
            About {execSeconds(text)} seconds spoken · {Math.round(exec.ownWords * 100)}% in your
            words
          </span>
          <CopyButton
            text={text}
            className="rounded-full px-3 py-1 font-medium text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50"
          />
        </div>
        <ol className="mt-3 flex flex-col gap-3" data-testid="exec-lines" data-stagger>
          {LINES.map((line, i) =>
            exec[line.key] ? (
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
                  {withEmphasis(exec[line.key], line.emphasize).map((piece, j) =>
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
        {exec.untracedNumbers.length > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            These figures aren&apos;t in your answers:{" "}
            <strong>{exec.untracedNumbers.join(", ")}</strong>. Don&apos;t say them unless
            they&apos;re real; make it again to drop them.
          </p>
        )}
      </div>

      <ul className="grid gap-2 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2" data-testid="exec-checks">
        {checks.map((c) => (
          <li key={c.id} className="flex flex-col">
            <span className="flex items-center gap-2 font-semibold text-slate-800">
              <span className={c.passed ? "text-emerald-700" : "text-amber-700"}>
                {c.passed ? "✓" : "!"}
              </span>
              {EXEC_CHECK_LABELS[c.id]}
            </span>
            <span className="pl-5 text-slate-600">{c.note}</span>
          </li>
        ))}
      </ul>

      {exec.ifAsked.length > 0 && (
        <div>
          <h3 className="font-bold text-slate-900">If they ask for more</h3>
          <p className="mt-1 text-sm text-slate-600">
            Hold these back. Execs ask for the detail they care about; have it ready in a sentence.
          </p>
          <ul className="mt-3 flex flex-col gap-2" data-testid="exec-asks">
            {exec.ifAsked.map((a) => (
              <li key={a.question} className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5">
                <p className="font-semibold text-slate-900">&ldquo;{a.question}&rdquo;</p>
                {a.answer ? (
                  <p className="mt-1 text-sm text-slate-700">{a.answer}</p>
                ) : (
                  <p className="mt-1 text-sm text-amber-900">
                    Your story doesn&apos;t say. Have a one-sentence answer ready.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {habits.length > 0 && (
        <div className="rounded-2xl bg-amber-50 p-4" data-testid="exec-habits">
          <h3 className="text-sm font-bold text-amber-950">Habits to drop out loud</h3>
          <p className="mt-1 text-sm text-amber-900">
            Your written story says{" "}
            {habits.map((h, i) => (
              <span key={h.hedge}>
                {i > 0 && (i === habits.length - 1 ? " and " : ", ")}
                <strong>&ldquo;{hedgeLabel(h.hedge)}&rdquo;</strong>
                {h.count > 1 ? ` ${h.count} times` : ""}
              </span>
            ))}
            . To an executive these sound like doubt. Say it flat.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onMake}
          disabled={disabled}
          className="rounded-xl px-4 py-2 font-semibold text-ink-800 ring-1 ring-ink-800/30 hover:bg-ink-50 disabled:opacity-50"
          data-testid="exec-again"
        >
          {pending ? "Making it again…" : "Make it again"}
        </button>
      </div>
    </div>
  );
}
