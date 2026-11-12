"use client";

import { useState } from "react";
import { formatGuide, partLength } from "@/lib/analysis/structure";
import type { StoryDraft } from "@/lib/stories/content";
import { storyParts, type StoryType } from "@/lib/stories/story-types";

// The written story as a picture: each part in its own colour, so what's there, what's missing
// and where the time goes show at a glance instead of in sentences. Plain code, no model call.

// One colour per part, in story order (STAR: situation, role, actions, result, reflection; About
// me: present, path, highlight, strengths, next). Amber is kept for "what to fix", so it isn't one.
const PART_COLOURS = [
  { tint: "bg-sky-50", bar: "bg-sky-200", dot: "bg-sky-400", edge: "border-sky-300" },
  { tint: "bg-violet-50", bar: "bg-violet-200", dot: "bg-violet-400", edge: "border-violet-300" },
  { tint: "bg-accent-50", bar: "bg-accent-200", dot: "bg-accent-500", edge: "border-accent-400" },
  { tint: "bg-emerald-50", bar: "bg-emerald-200", dot: "bg-emerald-500", edge: "border-emerald-400" },
  { tint: "bg-rose-50", bar: "bg-rose-200", dot: "bg-rose-400", edge: "border-rose-300" },
] as const;

// At an interview pace of about 150 words a minute.
const WORDS_PER_MINUTE = 150;

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function colourAt(i: number) {
  return PART_COLOURS[i % PART_COLOURS.length];
}

function spokenSeconds(words: number): number {
  return Math.round(((words / WORDS_PER_MINUTE) * 60) / 5) * 5;
}

export function formatSpoken(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}:${String(s).padStart(2, "0")}` : `${m} min`;
}

// How long the story takes to say, as one bar split by part. A part that runs long or short for
// its job is marked, with the usual share one tap away.
export function SpokenBar({
  draft,
  storyType,
}: {
  draft: StoryDraft;
  storyType: StoryType | undefined;
}) {
  const guide = formatGuide(storyType);
  const parts = storyParts(storyType).map((p, i) => {
    const text = draft.parts[p.id]?.trim() ?? "";
    return { ...p, i, text, words: countWords(text) };
  });
  const total = parts.reduce((n, p) => n + p.words, 0);
  if (total === 0) return null;
  const seconds = spokenSeconds(total);
  const verdict =
    total > guide.words.max ? "a bit long" : total < guide.words.min ? "on the short side" : "";
  const off = parts.flatMap((p) => {
    const g = guide.parts[p.id];
    if (!g || !p.words) return [];
    const check = partLength(p.text, total, g);
    return check.verdict === "fits" ? [] : [{ label: p.label, verdict: check.verdict }];
  });
  return (
    <div className="mt-3" data-testid="spoken-bar">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-semibold text-slate-800" data-testid="script-length">
          About {formatSpoken(seconds)} spoken
          <span className="font-normal text-slate-500">
            {" "}
            · {total} words{verdict && `, ${verdict}`}
          </span>
        </span>
        <span className="text-xs text-slate-500">aim for {guide.spoken}</span>
      </div>
      <div
        className="mt-1.5 flex h-6 gap-0.5 overflow-hidden rounded-lg"
        role="img"
        aria-label={parts
          .filter((p) => p.words)
          .map((p) => `${p.label} ${spokenSeconds(p.words)} seconds`)
          .join(", ")}
      >
        {parts
          .filter((p) => p.words)
          .map((p) => {
            const share = p.words / total;
            return (
              <div
                key={p.id}
                className={`flex min-w-0 items-center px-1.5 text-[11px] font-semibold text-slate-800 transition-[flex-grow] duration-500 ${colourAt(p.i).bar}`}
                style={{ flexGrow: share, flexBasis: 0 }}
                title={`${p.label}: about ${spokenSeconds(p.words)} seconds`}
              >
                {share >= 0.14 && <span className="truncate">{p.label}</span>}
              </div>
            );
          })}
      </div>
      {off.length > 0 && (
        <p className="mt-1.5 text-xs text-amber-800" data-testid="spoken-off">
          {off
            .map((o) => `${o.label} runs ${o.verdict === "long" ? "long" : "short"}`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

// The script with each part tinted in its colour. Tap a part in the key to see only that part; a
// part the story doesn't have yet shows in the key as a dashed gap. Numbers stand out, and any
// figure that isn't in the user's answers keeps its amber mark.
export function ColouredScript({
  draft,
  storyType,
}: {
  draft: StoryDraft;
  storyType: StoryType | undefined;
}) {
  const [focus, setFocus] = useState<string | null>(null);
  const parts = storyParts(storyType).map((p, i) => ({
    ...p,
    i,
    text: draft.parts[p.id]?.trim() ?? "",
  }));
  return (
    <div className="mt-5" data-testid="story-colours">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Story parts">
        {parts.map((p) => {
          const c = colourAt(p.i);
          const on = focus === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={!p.text}
              aria-pressed={on}
              onClick={() => setFocus(on ? null : p.id)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-colors ${
                !p.text
                  ? "border border-dashed border-slate-300 text-slate-400 ring-transparent"
                  : on
                    ? "bg-ink-800 text-white ring-ink-800"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 rounded-sm ${p.text ? c.dot : "bg-slate-200"}`}
              />
              {p.label}
              {!p.text && <span className="font-normal"> · missing</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-col gap-2 text-lg leading-relaxed text-slate-800">
        {parts
          .filter((p) => p.text)
          .map((p) => {
            const c = colourAt(p.i);
            const dim = focus !== null && focus !== p.id;
            return (
              <p
                key={p.id}
                className={`rounded-r-xl border-l-4 py-1.5 pl-3 pr-2 transition-opacity duration-200 ${c.tint} ${c.edge} ${dim ? "opacity-25" : ""}`}
                data-testid={`coloured-${p.id}`}
              >
                <span className="sr-only">{p.label}: </span>
                <Numbers text={p.text} untraced={draft.untracedNumbers} />
              </p>
            );
          })}
      </div>
    </div>
  );
}

// Figures in the text: numbers from the user's answers are bolded, ones that aren't keep the amber
// mark the number check explains.
const NUMBER = /(\$?\d+(?:[.,]\d+)*\s?(?:%|percent\b|[kKmMbB]\b|x\b)?)/;

function Numbers({ text, untraced }: { text: string; untraced: string[] }) {
  const pieces = text.split(new RegExp(NUMBER.source, "g"));
  return (
    <>
      {pieces.map((piece, i) =>
        i % 2 === 1 ? (
          untraced.some((u) => piece.includes(u)) ? (
            <mark key={i} className="rounded bg-amber-100 px-0.5 text-amber-900">
              {piece}
            </mark>
          ) : (
            <strong key={i} className="font-semibold text-emerald-800">
              {piece}
            </strong>
          )
        ) : (
          piece
        ),
      )}
    </>
  );
}
