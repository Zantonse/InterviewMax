"use client";

import type { ReactNode } from "react";
import { AiNotice } from "@/components/ai-notice";
import { analysisIsCurrent, strengthOf, writtenParts, type PartNote } from "@/lib/analysis/content";
import {
  formatGuide,
  partLength,
  totalLength,
  type LengthCheck,
  type PartGuide,
} from "@/lib/analysis/structure";
import { countWords } from "@/lib/stories/grading";
import type { StoryContent } from "@/lib/stories/content";
import type { StoryType } from "@/lib/stories/story-types";

// "Why it works", on the same talk track as the story (design review 2026-11-23): the lead in the
// margin says how an answer like this is built and how long it should run, which is code and shows
// straight away. Beside each paragraph: why the part is there and why it's about that long, then
// the note on this story (a model call): what the paragraph gives the interviewer, with the words
// that carry it marked on the story itself.

export function WhyLead({
  content,
  storyType,
  analyzing,
  disabled,
  onAnalyze,
}: {
  content: StoryContent;
  storyType: StoryType | undefined;
  analyzing: boolean;
  disabled: boolean;
  onAnalyze: () => void;
}) {
  const draft = content.draft;
  if (!draft) return null;
  const guide = formatGuide(storyType);
  const total = totalLength(wordsIn(draft.parts, storyType), guide);
  const analysis = content.analysis;
  const current = analysisIsCurrent(analysis, draft.writtenAt);

  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-slate-700" data-testid="story-analysis">
      <h2 className="font-semibold text-slate-900">How this answer is built</h2>
      <p>{guide.overview}</p>
      <p data-testid="analysis-total">
        <LengthMark verdict={total.verdict} /> {total.note}
      </p>
      {current ? (
        analysis.summary && (
          <p data-testid="analysis-summary">
            <span className="font-semibold text-slate-900">What it tells them about you: </span>
            {analysis.summary}
          </p>
        )
      ) : analyzing ? (
        <p role="status" aria-busy="true" className="flex items-center gap-2 text-slate-600">
          <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-accent-700" />
          Reading the story the way an interviewer would…
        </p>
      ) : (
        <div className="flex flex-col items-start gap-2.5">
          <p>
            {analysis
              ? "The story changed since the notes on it were written."
              : "Want a note on how each of your paragraphs does its job?"}
          </p>
          <button type="button" onClick={onAnalyze} disabled={disabled} className="btn-secondary">
            {analysis ? "Update the notes" : "Read my story"}
          </button>
          <AiNotice purpose="explain what each part of your story shows" />
        </div>
      )}
    </div>
  );
}

// The margin notes beside each paragraph, and the words each note marks on the story.
export function whyNotes(
  content: StoryContent,
  storyType: StoryType | undefined,
): { notes: Record<string, ReactNode>; quotes: Record<string, string> } {
  const draft = content.draft;
  if (!draft) return { notes: {}, quotes: {} };
  const totalWords = wordsIn(draft.parts, storyType);
  const guide = formatGuide(storyType);
  const analysis = content.analysis;
  const current = analysisIsCurrent(analysis, draft.writtenAt) ? analysis : undefined;
  const notes: Record<string, ReactNode> = {};
  const quotes: Record<string, string> = {};
  for (const p of writtenParts(draft.parts, storyType)) {
    const note = current?.parts.find((n) => n.part === p.id);
    const partGuide = guide.parts[p.id];
    if (note?.quote) quotes[p.id] = note.quote;
    notes[p.id] = (
      <div
        className="flex flex-col gap-2.5 text-sm leading-relaxed text-slate-700"
        data-testid={`analysis-${p.id}`}
      >
        {partGuide && (
          <PartStructure guide={partGuide} length={partLength(p.text, totalWords, partGuide)} />
        )}
        {note && <Note note={note} />}
      </div>
    );
  }
  return { notes, quotes };
}

function wordsIn(parts: Record<string, string>, storyType: StoryType | undefined): number {
  return countWords(
    writtenParts(parts, storyType)
      .map((p) => p.text)
      .join(" "),
  );
}

function PartStructure({ guide, length }: { guide: PartGuide; length: LengthCheck }) {
  return (
    <>
      <p data-testid="part-why">
        <span className="font-semibold text-slate-900">Why it&apos;s here: </span>
        {guide.why}
      </p>
      <p data-testid="part-length">
        <span className="font-semibold text-slate-900">Why this length: </span>
        {guide.lengthWhy}{" "}
        <span className="whitespace-nowrap">
          <LengthMark verdict={length.verdict} />
        </span>{" "}
        <span className={length.verdict === "fits" ? "text-slate-600" : "text-amber-800"}>
          {length.note}
        </span>
      </p>
    </>
  );
}

function LengthMark({ verdict }: { verdict: LengthCheck["verdict"] }) {
  return verdict === "fits" ? (
    <span className="text-emerald-700" aria-label="Good length">
      ✓
    </span>
  ) : (
    <span className="text-amber-700" aria-label={verdict === "long" ? "Long" : "Short"}>
      {verdict === "long" ? "▲" : "▼"}
    </span>
  );
}

// How the paragraph lands, as a word in its colour: green works, amber needs work.
const STRENGTH_TEXT: Record<PartNote["strength"], string> = {
  strong: "text-emerald-700",
  some: "text-amber-800",
  thin: "text-amber-800",
};

// The note on this story's paragraph.
function Note({ note }: { note: PartNote }) {
  const strength = strengthOf(note.strength);
  return (
    <div className="flex flex-col gap-1.5 border-t border-ink-100 pt-2.5" data-testid="analysis-note">
      <p>
        <span className="font-semibold text-slate-900">In your story: </span>
        <span className={`font-medium ${STRENGTH_TEXT[note.strength] ?? "text-slate-700"}`}>
          {strength.label}
        </span>
        {note.signals.length > 0 && (
          <span className="text-slate-500"> · {note.signals.join(", ")}</span>
        )}
      </p>
      <p>{note.value}</p>
      {note.sharpen && (
        <p>
          <span className="font-semibold text-slate-900">To make it land: </span>
          {note.sharpen}
        </p>
      )}
    </div>
  );
}
