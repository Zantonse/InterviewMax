"use client";

import { useState } from "react";
import type { FieldId } from "@/lib/field/fields";
import { LEVEL_CHANGE, exampleStoryFor, type ExampleSentence } from "@/lib/stories/example-ladder";
import type { StoryLevel } from "@/lib/stories/levels";

const LEVEL_NAMES: Record<StoryLevel, string> = {
  1: "It happened",
  2: "It proves something",
  3: "It shows how you think",
};

// One made-up story in the user's field, shown at Level 1, 2 or 3: tap a step to see the same story
// climb. What each level adds is marked in the text, so the change is seen, not explained.
export function ExampleLadder({
  field,
  startAt = 1,
  testId = "example-ladder",
}: {
  field: FieldId | null;
  startAt?: StoryLevel;
  testId?: string;
}) {
  const story = exampleStoryFor(field);
  const [level, setLevel] = useState<StoryLevel>(startAt);
  const sentences = story.levels[level - 1];
  return (
    <div className="flex flex-col gap-3" data-testid={testId}>
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-slate-900">&ldquo;{story.question}&rdquo;</span> An
        example, not your facts.
      </p>
      <div role="tablist" aria-label="Example story level" className="flex items-end gap-1.5">
        {([1, 2, 3] as const).map((l) => {
          const on = l === level;
          return (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setLevel(l)}
              className={`flex min-w-0 flex-1 flex-col items-start rounded-xl px-2.5 text-left text-xs transition-colors ${
                l === 1 ? "pt-1.5" : l === 2 ? "pt-3" : "pt-[1.125rem]"
              } pb-1.5 ${
                on
                  ? "bg-ink-800 text-white"
                  : "bg-ink-50 text-ink-800 ring-1 ring-ink-800/15 hover:bg-ink-100"
              }`}
              data-testid={`example-level-${l}`}
            >
              <span className="font-bold">Level {l}</span>
              <span className={`hidden max-w-full truncate sm:block ${on ? "text-ink-50" : "text-slate-600"}`}>
                {LEVEL_NAMES[l]}
              </span>
            </button>
          );
        })}
      </div>
      <p className="rounded-2xl bg-white p-4 text-[0.95rem] leading-relaxed text-slate-800 ring-1 ring-slate-200">
        {sentences.map((s, i) => (
          <Sentence key={`${level}-${i}`} sentence={s} />
        ))}
      </p>
      <p className="text-sm text-slate-600" data-testid="example-change">
        <span className="font-semibold text-slate-900">Level {level}: </span>
        {LEVEL_CHANGE[level].replace(/^[^:]+: /, "")}
      </p>
      {level < 3 && (
        <button
          type="button"
          onClick={() => setLevel((level + 1) as StoryLevel)}
          className="self-start text-sm font-semibold text-ink-800 hover:underline"
          data-testid="example-next"
        >
          See it at Level {level + 1} →
        </button>
      )}
    </div>
  );
}

function Sentence({ sentence }: { sentence: ExampleSentence }) {
  if (!sentence.adds) return <>{sentence.text} </>;
  return (
    <>
      <mark
        className="animate-enter rounded bg-accent-100 px-0.5 text-slate-900 [box-decoration-break:clone]"
        data-adds={sentence.adds}
      >
        <span className="mr-1 inline-block rounded-full bg-accent-400 px-1.5 text-[0.7rem] font-bold uppercase tracking-wide text-ink-950 align-[0.1em]">
          + {sentence.adds}
        </span>
        {sentence.text}
      </mark>{" "}
    </>
  );
}
