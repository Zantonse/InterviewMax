"use client";

import { AiNotice } from "@/components/ai-notice";
import {
  analysisIsCurrent,
  strengthOf,
  writtenParts,
  type PartNote,
} from "@/lib/analysis/content";
import type { StoryContent } from "@/lib/stories/content";
import type { StoryType } from "@/lib/stories/story-types";

// "Why it works", shown in place of the script when the toggle is on: each paragraph of the story
// with a note on what it gives the interviewer, the words that carry it, and how to sharpen it
// when it doesn't fully land.
export function AnalysisView({
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
  const paragraphs = writtenParts(draft.parts, storyType);
  const analysis = content.analysis;
  const current = analysisIsCurrent(analysis, draft.writtenAt);
  const notes = current ? analysis.parts : [];

  return (
    <div className="mt-5 flex flex-col gap-5" data-testid="story-analysis">
      {current ? (
        analysis.summary && (
          <p
            className="rounded-2xl bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-900"
            data-testid="analysis-summary"
          >
            <span className="font-semibold">What the interviewer takes away: </span>
            {analysis.summary}
          </p>
        )
      ) : analyzing ? (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-ink-600" />
          Reading your story the way an interviewer would…
        </p>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl bg-ink-50 px-4 py-3">
          <p className="text-sm text-slate-700">
            {analysis
              ? "Your story changed since this was written. Update it to see what each part gives the interviewer now."
              : "See what each part of your story gives the interviewer, and where it could give more."}
          </p>
          <div>
            <button
              type="button"
              onClick={onAnalyze}
              disabled={disabled}
              className="rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
            >
              {analysis ? "Update" : "Show why it works"}
            </button>
          </div>
          <AiNotice purpose="explain what each part of your story shows" />
        </div>
      )}

      {paragraphs.map((p) => {
        const note = notes.find((n) => n.part === p.id);
        return (
          <div key={p.id} data-testid={`analysis-${p.id}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{p.label}</p>
            <p className="mt-1 text-lg leading-relaxed text-slate-800">
              <QuoteMarked text={p.text} quote={note?.quote} />
            </p>
            {note && <Note note={note} />}
          </div>
        );
      })}
    </div>
  );
}

function Note({ note }: { note: PartNote }) {
  const strength = strengthOf(note.strength);
  return (
    <div
      className="mt-2 flex flex-col gap-2 rounded-2xl border-l-4 border-ink-300 bg-slate-50 px-4 py-3"
      data-testid="analysis-note"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${strength.style}`}
        >
          {strength.label}
        </span>
        {note.signals.map((s) => (
          <span
            key={s}
            className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-ink-800 ring-1 ring-ink-200"
          >
            {s}
          </span>
        ))}
      </div>
      <p className="text-sm leading-relaxed text-slate-700">{note.value}</p>
      {note.sharpen && (
        <p className="text-sm leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-900">To make it land: </span>
          {note.sharpen}
        </p>
      )}
    </div>
  );
}

// The paragraph with the words that carry its signal underlined.
function QuoteMarked({ text, quote }: { text: string; quote?: string }) {
  const at = quote ? text.indexOf(quote) : -1;
  if (!quote || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-ink-100 px-0.5 text-ink-900 decoration-ink-400 underline decoration-2 underline-offset-4">
        {quote}
      </mark>
      {text.slice(at + quote.length)}
    </>
  );
}
