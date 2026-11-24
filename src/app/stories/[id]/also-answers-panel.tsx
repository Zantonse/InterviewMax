"use client";

import { useState, useTransition } from "react";
import { AiNotice } from "@/components/ai-notice";
import { getTheme } from "@/lib/questions/themes";
import { alsoAnswersAreCurrent, fitOf, sourceLabels, type AlsoAnswer } from "@/lib/reuse/content";
import type { StoryContent } from "@/lib/stories/content";
import type { StoryType } from "@/lib/stories/story-types";
import { findOtherQuestions } from "./also-actions";

// "Also answers", under the written story on the Story & score view: the other interview
// questions this one story can answer, each with what to lead with. One story, many questions, so
// the user stops thinking every question needs its own story.
export function AlsoAnswersPanel({
  storyId,
  content,
  storyType,
  disabled,
  onContent,
}: {
  // Read when the check runs: a new story gets its id with its first answer.
  storyId: () => string;
  content: StoryContent;
  storyType: StoryType | undefined;
  disabled: boolean;
  onContent: (content: StoryContent) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // "Tell me about yourself" is its own kind of answer.
  if (!content.draft || storyType?.format === "intro") return null;
  const also = content.alsoAnswers;
  const current = alsoAnswersAreCurrent(also, content.draft.writtenAt);

  function find() {
    setError(null);
    startTransition(async () => {
      const result = await findOtherQuestions(storyId());
      if (result.ok) onContent(result.content);
      else setError(result.error);
    });
  }

  const button = (label: string, primary: boolean) => (
    <button
      type="button"
      onClick={find}
      disabled={disabled || pending}
      className={
        primary
          ? "btn-primary"
          : "text-sm link disabled:opacity-50"
      }
      data-testid="also-answers-find"
    >
      {pending ? "Checking your questions…" : label}
    </button>
  );

  return (
    <section
      className={`transition ${pending ? "opacity-60" : ""}`}
      aria-label="Other questions this story answers"
      data-testid="also-answers"
    >
      {current ? (
        <>
          {content.asked && (
            <p className="mt-2 text-sm text-slate-600">
              You wrote it for &ldquo;{content.asked.replace(/[.?!]+$/, "")}&rdquo;.{" "}
              {also.questions.length > 0
                ? `It also answers ${also.questions.length === 1 ? "this one" : `these ${also.questions.length}`}.`
                : ""}
            </p>
          )}
          {also.questions.length === 0 ? (
            <p className="mt-2 text-slate-700">
              No other question fits it well as written. It&apos;s focused, and that&apos;s fine.
            </p>
          ) : (
            <ul
              className="mt-3 divide-y divide-ink-100 border-y border-ink-100"
              data-testid="also-answers-list"
              data-stagger
            >
              {also.questions.map((q) => (
                <Pick key={q.question} pick={q} />
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-xs text-slate-600">
              Checked against your likely questions, past interviews and common interview questions.
            </p>
            {button("Check again", false)}
          </div>
        </>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          {also && (
            <p className="text-slate-700">Checked against an earlier version of the story.</p>
          )}
          <div>{button("Find other questions it answers", true)}</div>
          <AiNotice purpose="find the other questions your story answers" />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </section>
  );
}

function Pick({ pick }: { pick: AlsoAnswer }) {
  const fit = fitOf(pick.fit);
  const theme = pick.theme ? getTheme(pick.theme)?.label : undefined;
  return (
    <li className="py-3">
      <p className="font-words text-[1.0625rem] leading-snug text-slate-900">{pick.question}</p>
      <p className="mt-1 text-xs text-slate-500">
        <span className={`font-medium ${pick.fit === "strong" ? "text-emerald-700" : "text-amber-800"}`}>
          {fit.label}
        </span>
        {[...sourceLabels(pick.sources), ...(theme ? [theme] : [])].map((label) => (
          <span key={label}> · {label}</span>
        ))}
      </p>
      <p className="mt-2 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Lead with: </span>
        {pick.emphasize}
      </p>
    </li>
  );
}
