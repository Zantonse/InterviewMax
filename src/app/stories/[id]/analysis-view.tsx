"use client";

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

// "Why it works", shown in place of the script when the toggle is on. First the high-level part,
// which is code and shows straight away: how an interview answer is built, why each part is there
// and why it's about that long. Under each part, the note on this story (a model call): what the
// paragraph gives the interviewer, the words that carry it, and how to sharpen it.
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
  const totalWords = countWords(paragraphs.map((p) => p.text).join(" "));
  const guide = formatGuide(storyType);
  const total = totalLength(totalWords, guide);
  const analysis = content.analysis;
  const current = analysisIsCurrent(analysis, draft.writtenAt);
  const notes = current ? analysis.parts : [];

  return (
    <div className="mt-5 flex flex-col gap-6" data-testid="story-analysis">
      <div className="flex flex-col gap-2 rounded-2xl bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-900">
        <p className="font-semibold">How this answer is built</p>
        <p>{guide.overview}</p>
        <p data-testid="analysis-total">
          <LengthMark verdict={total.verdict} /> {total.note}
        </p>
      </div>

      {current ? (
        analysis.summary && (
          <p className="text-sm leading-relaxed text-slate-700" data-testid="analysis-summary">
            <span className="font-semibold text-slate-900">
              What this story tells them about you:{" "}
            </span>
            {analysis.summary}
          </p>
        )
      ) : analyzing ? (
        <p role="status" className="flex items-center gap-2 text-sm text-slate-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-ink-600" />
          Reading your story the way an interviewer would…
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-700">
            {analysis
              ? "Your story changed since the notes on it were written."
              : "Want notes on how your own paragraphs do each job?"}{" "}
            <button
              type="button"
              onClick={onAnalyze}
              disabled={disabled}
              className="font-semibold text-ink-800 hover:underline disabled:opacity-50"
            >
              {analysis ? "Update the notes" : "Read my story"}
            </button>
          </p>
          <AiNotice purpose="explain what each part of your story shows" />
        </div>
      )}

      {paragraphs.map((p) => {
        const note = notes.find((n) => n.part === p.id);
        const partGuide = guide.parts[p.id];
        return (
          <div key={p.id} data-testid={`analysis-${p.id}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{p.label}</p>
            <p className="mt-1 text-lg leading-relaxed text-slate-800">
              <QuoteMarked text={p.text} quote={note?.quote} />
            </p>
            <div className="mt-2 flex flex-col gap-3 rounded-2xl border-l-4 border-ink-300 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
              {partGuide && (
                <PartStructure
                  guide={partGuide}
                  length={partLength(p.text, totalWords, partGuide)}
                />
              )}
              {note && <Note note={note} />}
            </div>
          </div>
        );
      })}
    </div>
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

// The note on this story's paragraph.
function Note({ note }: { note: PartNote }) {
  const strength = strengthOf(note.strength);
  return (
    <div className="flex flex-col gap-2 border-t border-slate-200 pt-3" data-testid="analysis-note">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-slate-900">In your story:</span>
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

// The paragraph with the words that carry its signal underlined.
function QuoteMarked({ text, quote }: { text: string; quote?: string }) {
  const at = quote ? text.indexOf(quote) : -1;
  if (!quote || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-ink-100 px-0.5 text-ink-900 underline decoration-ink-400 decoration-2 underline-offset-4">
        {quote}
      </mark>
      {text.slice(at + quote.length)}
    </>
  );
}
