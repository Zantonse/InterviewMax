"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { formatGuide } from "@/lib/analysis/structure";
import type { StoryDraft } from "@/lib/stories/content";
import { storyParts, type StoryPart, type StoryType } from "@/lib/stories/story-types";
import type { DiffPiece } from "@/lib/stories/word-diff";

// The story as a script on a talk track (design review 2026-11-23, fixes 3 and 4): down the left,
// the spoken time at which each paragraph starts and the part it plays, on one line from the first
// word to the end. It replaces the paragraph tints, the coloured length bar and its legend, so the
// story is set in plain type and the time it takes to say is still a picture. Plain code, no model.

// At an interview pace of about 150 words a minute.
const WORDS_PER_MINUTE = 150;

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// Rounded to 5 seconds: nobody times an answer closer than that.
export function spokenSeconds(words: number): number {
  return Math.round(((words / WORDS_PER_MINUTE) * 60) / 5) * 5;
}

// 0:00, 1:05, 12:30.
export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Part names on the track, short enough for its narrow column: the principle's own label ("How I
// think about it") and the "Tell me about yourself" parts are too long for it.
const TRACK_LABELS: Record<string, string> = {
  principle: "Principle",
  present: "Now",
  path: "The path",
  highlight: "Proof",
  strengths: "Known for",
  next: "Next role",
  proof: "Proof",
};

export function trackLabel(part: StoryPart): string {
  return TRACK_LABELS[part.id] ?? part.label;
}

type Row = StoryPart & { text: string; words: number; start: number };

// Each part with its text and the second it starts at, and the total spoken time.
export function trackRows(
  parts: Record<string, string> | undefined,
  storyType: StoryType | undefined,
): { rows: Row[]; seconds: number; words: number } {
  let words = 0;
  const rows = storyParts(storyType).map((p) => {
    const text = parts?.[p.id]?.trim() ?? "";
    const n = countWords(text);
    const row = { ...p, text, words: n, start: spokenSeconds(words) };
    words += n;
    return row;
  });
  return { rows, seconds: spokenSeconds(words), words };
}

// Figures in the story: the coach's pen underlines the ones from the user's answers; any that
// aren't in them keep the amber mark the number check explains.
const NUMBER = /(\$?\d+(?:[.,]\d+)*\s?(?:%|percent\b|[kKmMbB]\b|x\b)?)/;

export function Figures({ text, untraced }: { text: string; untraced: string[] }) {
  const pieces = text.split(new RegExp(NUMBER.source, "g"));
  return (
    <>
      {pieces.map((piece, i) =>
        i % 2 === 1 ? (
          untraced.some((u) => piece.includes(u)) ? (
            <mark key={i} className="rounded-sm bg-amber-100 px-0.5 text-amber-900">
              {piece}
            </mark>
          ) : (
            <span key={i} className="pen-figure">
              {piece}
            </span>
          )
        ) : (
          piece
        ),
      )}
    </>
  );
}

// A paragraph with the words a note is about marked in the coach's pen.
function Quoted({ text, quote, untraced }: { text: string; quote?: string; untraced: string[] }) {
  const at = quote ? text.indexOf(quote) : -1;
  if (!quote || at < 0) return <Figures text={text} untraced={untraced} />;
  return (
    <>
      <Figures text={text.slice(0, at)} untraced={untraced} />
      <mark className="pen-mark text-inherit" data-testid="quote-mark">
        <Figures text={quote} untraced={untraced} />
      </mark>
      <Figures text={text.slice(at + quote.length)} untraced={untraced} />
    </>
  );
}

// A rewrite shown on the story itself: added words underlined in green, cut words struck through.
function Changes({ pieces }: { pieces: DiffPiece[] }) {
  return (
    <>
      {pieces
        .map((x, i) =>
          x.kind === "added" ? (
            <ins
              key={i}
              className="rounded-sm bg-emerald-50 text-slate-900 no-underline shadow-[inset_0_-2px_0_var(--color-emerald-500)]"
            >
              {x.text}
            </ins>
          ) : x.kind === "cut" ? (
            <del key={i} className="text-slate-500">
              {x.text}
            </del>
          ) : (
            <span key={i}>{x.text}</span>
          ),
        )
        .reduce<ReactNode[]>((acc, node, i) => (i === 0 ? [node] : [...acc, " ", node]), [])}
    </>
  );
}

// Notes in the right margin sit beside the paragraph they're about (data-anchor = its row), and
// stack below the one before when two would overlap, like comments in a document. Measured after
// layout, on wide screens only; on a phone they stay in the flow under their paragraph.
function useMarginNotes() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const wide = window.matchMedia("(min-width: 64rem)");
    let frame = 0;
    const place = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const notes = Array.from(root.querySelectorAll<HTMLElement>(":scope [data-note]"));
        if (!wide.matches) {
          for (const n of notes) n.style.top = "";
          root.style.minHeight = "";
          return;
        }
        let y = 0;
        for (const n of notes) {
          const row = root.querySelector<HTMLElement>(`[data-row="${n.dataset.note}"]`);
          const top = Math.max(row ? row.offsetTop : y, y);
          n.style.top = `${top}px`;
          y = top + n.offsetHeight + 24;
        }
        root.style.minHeight = `${y}px`;
      });
    };
    place();
    const watch = new ResizeObserver(place);
    watch.observe(root);
    for (const n of root.querySelectorAll(":scope [data-note]")) watch.observe(n);
    wide.addEventListener("change", place);
    document.fonts?.ready.then(place).catch(() => {});
    return () => {
      watch.disconnect();
      wide.removeEventListener("change", place);
      cancelAnimationFrame(frame);
    };
  });
  return ref;
}

const NOTE = "mt-5 lg:absolute lg:right-0 lg:mt-0 lg:w-[17.5rem]";

// The written story on its talk track, with the coach's notes in the margin.
export function TalkTrack({
  draft,
  storyType,
  lead,
  notes,
  marked,
  refs,
  changes,
  quotes,
  notesUnder = false,
  end,
  endNote,
}: {
  draft: StoryDraft;
  storyType: StoryType | undefined;
  // The first note in the margin, beside the opening: the coach's read and the next step.
  lead?: ReactNode;
  // Margin notes by part id.
  notes?: Record<string, ReactNode>;
  // Parts the coach's pen points at (a note to act on): their dot is filled in.
  marked?: Set<string>;
  // Note numbers to set after a part's last word.
  refs?: Record<string, number[]>;
  // A rewrite to show as changes, by part id.
  changes?: Record<string, DiffPiece[]>;
  // Words to mark in the coach's pen, by part id ("Why it works": the words that carry the part).
  quotes?: Record<string, string>;
  // Notes too long for the margin ("Why it works") go under their paragraph instead.
  notesUnder?: boolean;
  // A note beside the end of the story (questions with no paragraph to sit under yet).
  end?: ReactNode;
  // A line at the end, beside the total time.
  endNote?: ReactNode;
}) {
  const ref = useMarginNotes();
  const { rows, seconds } = trackRows(draft.parts, storyType);
  // The optional principle isn't shown missing on a written story; the other parts are.
  const shown = rows.filter((r) => r.text || r.id !== "principle");
  return (
    <div ref={ref} className="relative lg:pr-[20rem]" data-testid="story-script">
      {lead && (
        <div data-note="0" className="mb-10 lg:absolute lg:right-0 lg:mb-0 lg:w-[17.5rem]">
          {lead}
        </div>
      )}
      {shown.map((r, i) => {
        const note = notes?.[r.id];
        const pen = marked?.has(r.id);
        return (
          <div
            key={r.id}
            data-row={i}
            className="grid grid-cols-[4.25rem_0.75rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[5rem_0.75rem_minmax(0,1fr)] sm:gap-x-4"
            data-testid={`script-${r.id}`}
          >
            <p className="pt-1.5 text-right leading-tight">
              <span className="block font-mono text-sm tabular-nums text-ink-700">
                {clock(r.start)}
              </span>
              <span className="mt-1 block text-xs text-ink-500">{trackLabel(r)}</span>
            </p>
            <span aria-hidden="true" className="relative flex justify-center">
              <span
                className={`absolute bottom-0 w-px bg-ink-200 ${i === 0 ? "top-3.5" : "top-0"}`}
              />
              <span
                className={`relative mt-2.5 size-2.5 rounded-full border ${
                  !r.text
                    ? "border-dashed border-ink-300 bg-white"
                    : pen
                      ? "border-accent-700 bg-accent-700"
                      : "border-ink-400 bg-white"
                }`}
              />
            </span>
            <div className="min-w-0 pb-10">
              {r.text ? (
                <p
                  className={`font-words text-xl leading-[1.7] text-slate-900 ${r.id === "principle" ? "italic" : ""}`}
                >
                  <span className="sr-only">{r.label}: </span>
                  {changes?.[r.id] ? (
                    <Changes pieces={changes[r.id]} />
                  ) : (
                    <Quoted text={r.text} quote={quotes?.[r.id]} untraced={draft.untracedNumbers} />
                  )}
                  {refs?.[r.id]?.length ? (
                    <sup className="ml-0.5 font-sans text-xs font-semibold text-accent-700">
                      {refs[r.id].join(",")}
                    </sup>
                  ) : null}
                </p>
              ) : (
                <p className="pt-1 text-slate-500">{r.label} isn&apos;t in the story yet.</p>
              )}
              {note &&
                (notesUnder ? (
                  <div className="mt-4 max-w-2xl border-l-2 border-accent-200 pl-4">{note}</div>
                ) : (
                  <div data-note={i} className={NOTE}>
                    {note}
                  </div>
                ))}
            </div>
          </div>
        );
      })}
      <div
        data-row={shown.length}
        className="grid grid-cols-[4.25rem_0.75rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[5rem_0.75rem_minmax(0,1fr)] sm:gap-x-4"
      >
        <p className="text-right leading-tight">
          <span className="block font-mono text-sm tabular-nums text-ink-700" data-testid="script-length">
            {clock(seconds)}
          </span>
          <span className="mt-1 block text-xs text-ink-500">End</span>
        </p>
        <span aria-hidden="true" className="relative flex justify-center">
          <span className="absolute top-0 h-1.5 w-px bg-ink-200" />
          <span className="relative mt-1.5 size-2.5 rounded-full bg-ink-700" />
        </span>
        <div className="min-w-0 text-sm text-slate-600">
          {endNote}
          {end && (
            <div data-note={shown.length} className={NOTE}>
              {end}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// "Aim for about 1 to 2 minutes."
export function aimFor(storyType: StoryType | undefined): string {
  return `Aim for ${formatGuide(storyType).spoken}.`;
}

// Beside the builder: the rough draft so far on a smaller talk track. The part the question being
// answered fills in is marked; parts not in the story yet are dashed, with the question that will
// fill each one in. Before there's a draft, the empty track shows the shape the story will take.
export function DraftTrack({
  draft,
  storyType,
  answering,
  coming,
  flash = false,
}: {
  draft: StoryDraft | undefined;
  storyType: StoryType | undefined;
  // The part the open question fills in.
  answering?: string;
  // Parts a later question asks for, with the question's number.
  coming?: Map<string, number>;
  flash?: boolean;
}) {
  const { rows, seconds } = trackRows(draft?.parts, storyType);
  return (
    <section className={flash ? "animate-success rounded-md" : ""} data-testid="draft-so-far">
      <h2 className="text-sm font-semibold text-slate-900">The draft so far</h2>
      <p className="mt-0.5 text-sm text-slate-600">
        {draft ? (
          <>
            <span className="font-mono tabular-nums">{clock(seconds)}</span> spoken.{" "}
            {aimFor(storyType)}
          </>
        ) : (
          "Nothing yet. Tell it your way and a rough draft from your words starts here."
        )}
      </p>
      <ol className="mt-5" data-testid="story-shape">
        {rows.map((r, i) => {
          const now = r.id === answering;
          const state = now ? "marked" : r.text ? "done" : "empty";
          const asks = coming?.get(r.id);
          return (
            <li
              key={r.id}
              className="grid min-h-[3.75rem] grid-cols-[3.75rem_0.75rem_minmax(0,1fr)] gap-x-2.5"
              data-testid={`draft-part-${state}`}
            >
              <p className="pt-1 text-right leading-tight">
                {/* Times only once there's a draft to time. */}
                {draft && (
                  <span className="mb-0.5 block font-mono text-xs tabular-nums text-ink-700">
                    {clock(r.start)}
                  </span>
                )}
                <span className="block text-xs text-ink-500">{trackLabel(r)}</span>
              </p>
              <span aria-hidden="true" className="relative flex justify-center">
                <span
                  className={`absolute w-px bg-ink-200 ${i === 0 ? "top-2.5" : "top-0"} ${i === rows.length - 1 ? "h-2.5" : "bottom-0"}`}
                />
                <span
                  className={`relative mt-1.5 size-2.5 rounded-full border transition-colors duration-300 ${
                    now
                      ? "border-accent-700 bg-accent-700"
                      : r.text
                        ? "border-ink-400 bg-white"
                        : "border-dashed border-ink-300 bg-white"
                  }`}
                />
              </span>
              <div className="min-w-0 pb-5">
                <div className={now ? "rounded-md bg-accent-50 px-3 py-2" : ""}>
                  {now && <p className="mb-0.5 text-xs font-semibold text-accent-700">Answering now</p>}
                  {r.text ? (
                    <p
                      key={r.text}
                      className={`animate-fade font-words text-[0.9375rem] leading-relaxed text-slate-800 ${now ? "" : "line-clamp-4"} ${r.id === "principle" ? "italic" : ""}`}
                    >
                      {r.text}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">
                      {now
                        ? "Not in the story yet. This question fills it in."
                        : asks
                          ? `Not in the story yet. Question ${asks} asks for it.`
                          : r.id === "principle"
                            ? "Not in the story yet. Optional."
                            : "Not in the story yet."}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// The level as a small three-step meter, for the line under a story's title.
export function LevelMeter({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-1 w-3.5 rounded-full ${n <= level ? "bg-ink-900" : "bg-ink-200"}`}
        />
      ))}
    </span>
  );
}
