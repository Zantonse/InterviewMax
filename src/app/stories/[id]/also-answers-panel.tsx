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
          ? "rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
          : "text-sm font-medium text-ink-800 hover:underline disabled:opacity-50"
      }
      data-testid="also-answers-find"
    >
      {pending ? "Checking your questions…" : label}
    </button>
  );

  return (
    <section
      className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition sm:p-6 ${
        pending ? "opacity-60" : ""
      }`}
      aria-label="Other questions this story answers"
      data-testid="also-answers"
    >
      <p className="text-sm font-bold uppercase tracking-wide text-ink-800">
        Other questions this story answers
      </p>
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
              I didn&apos;t find another question this story answers well as written. That&apos;s
              fine: it&apos;s focused. Build another story for your other questions.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2" data-testid="also-answers-list">
              {also.questions.map((q) => (
                <Pick key={q.question} pick={q} />
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-xs text-slate-500">
              Checked against your likely questions, past interviews and common interview questions.
            </p>
            {button("Check again", false)}
          </div>
        </>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-slate-700">
            {also
              ? "You've changed the story since I checked. I'll check the new version."
              : "One good story can answer several questions, worded different ways. I'll check this one against your likely questions, the ones you were asked before and common interview questions, and tell you what to lead with for each."}
          </p>
          <div>{button("Find other questions it answers", true)}</div>
          <AiNotice purpose="find the other questions your story answers" />
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

function Pick({ pick }: { pick: AlsoAnswer }) {
  const fit = fitOf(pick.fit);
  const theme = pick.theme ? getTheme(pick.theme)?.label : undefined;
  return (
    <li className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5">
      <p className="font-semibold text-slate-900">{pick.question}</p>
      <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium ring-1 ${fit.style}`}>{fit.label}</span>
        {sourceLabels(pick.sources).map((label) => (
          <span key={label} className="rounded-full bg-ink-50 px-2 py-0.5 font-medium text-ink-800">
            {label}
          </span>
        ))}
        {theme && (
          <span className="rounded-full bg-white px-2 py-0.5 text-slate-600 ring-1 ring-black/5">
            {theme}
          </span>
        )}
      </p>
      <p className="mt-2 text-sm text-slate-700">
        <span className="font-semibold text-slate-900">Lead with: </span>
        {pick.emphasize}
      </p>
    </li>
  );
}
