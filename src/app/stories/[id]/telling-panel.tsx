"use client";

import { useState } from "react";
import { AiNotice } from "@/components/ai-notice";
import { AnswerComposer } from "@/components/practice/answer-composer";
import { gradeIsCurrent, type StoryContent } from "@/lib/stories/content";
import {
  CHECK_LABELS,
  VERSIONS,
  beatLabel,
  canTell,
  emphasizeBeat,
  pauseBefore,
  speakingSeconds,
  tellingIsCurrent,
  versionChecks,
  versionText,
  withEmphasis,
  type StoryTelling,
  type TellingCheck,
  type VersionId,
} from "@/lib/telling/content";
import type { StoryType } from "@/lib/stories/story-types";

// "How to tell it" (PRD v0.3, P1), under the written story on the Story & score view: pick an
// opening line, then say the 30-second or 2-minute version with its pause and emphasis cues. It
// changes how the story is told, never its facts or its score.
export function TellingPanel({
  content,
  storyType,
  coaching,
  disabled,
  onCoach,
  onPickHook,
  onAddDetail,
}: {
  content: StoryContent;
  storyType: StoryType | undefined;
  coaching: boolean;
  disabled: boolean;
  onCoach: () => void;
  onPickHook: (index: number) => void;
  onAddDetail: (answer: string) => void;
}) {
  if (!content.draft || !canTell(storyType)) return null;
  const telling = content.telling;
  const current = tellingIsCurrent(telling, content.draft.writtenAt);

  return (
    <section
      className={`rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition sm:p-6 ${
        coaching ? "opacity-60" : ""
      }`}
      aria-label="How to tell it"
      data-testid="how-to-tell-it"
    >
      <p className="text-sm font-bold uppercase tracking-wide text-ink-800">How to tell it</p>
      {current ? (
        <Coached
          telling={telling}
          content={content}
          disabled={disabled}
          coaching={coaching}
          onCoach={onCoach}
          onPickHook={onPickHook}
          onAddDetail={onAddDetail}
        />
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-slate-700">
            {telling
              ? "You've rewritten the story since I coached it. I'll coach the new version."
              : "A strong story can still fall flat out loud. I'll help you tell this one, not read it: an opening line that grabs, the moment it could have gone wrong, one vivid detail, and a clear landing. You get a 30-second and a 2-minute version."}
          </p>
          <div>
            <button
              type="button"
              onClick={onCoach}
              disabled={disabled}
              className="rounded-xl bg-ink-800 px-4 py-2 font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
              data-testid="coach-telling"
            >
              {coaching ? "Coaching…" : telling ? "Coach the new version" : "Coach me to tell it"}
            </button>
          </div>
          <AiNotice purpose="coach how you tell your story" />
        </div>
      )}
    </section>
  );
}

function Coached({
  telling,
  content,
  disabled,
  coaching,
  onCoach,
  onPickHook,
  onAddDetail,
}: {
  telling: StoryTelling;
  content: StoryContent;
  disabled: boolean;
  coaching: boolean;
  onCoach: () => void;
  onPickHook: (index: number) => void;
  onAddDetail: (answer: string) => void;
}) {
  const [version, setVersion] = useState<VersionId>("short");
  const [copied, setCopied] = useState(false);
  const beats = telling.versions[version];
  const hook = telling.hooks[telling.hookIndex] ?? telling.hooks[0];
  const text = versionText(telling, version);
  const seconds = speakingSeconds(text);
  const toldChecks = versionChecks(hook, beats);
  // "Show your thinking" (#51) belongs at the turn: when the grade says it's thin, say so there.
  const thinking =
    gradeIsCurrent(content) && content.grade?.thinking?.level !== "shown"
      ? content.grade?.thinking
      : undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the text is still on screen to select.
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-6">
      <Checks draft={telling.draftChecks} told={toldChecks} />

      <div>
        <h3 className="font-bold text-slate-900">1. Pick your opening line</h3>
        <p className="mt-1 text-sm text-slate-600">
          Lead with the result or the stakes, so they know why to listen.
        </p>
        <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="Opening line">
          {telling.hooks.map((h, i) => {
            const picked = i === telling.hookIndex;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={picked}
                disabled={disabled}
                onClick={() => !picked && onPickHook(i)}
                className={`rounded-2xl px-4 py-3 text-left transition disabled:opacity-60 ${
                  picked
                    ? "bg-ink-50 text-slate-900 ring-2 ring-ink-600"
                    : "text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
                data-testid={`hook-${i}`}
              >
                <span className="mr-2 text-xs font-bold uppercase tracking-wide text-ink-700">
                  {picked ? "✓ Your opener" : `Option ${i + 1}`}
                </span>
                <span className="block font-medium">{h}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-bold text-slate-900">2. Say it out loud</h3>
          <div
            role="tablist"
            aria-label="Length"
            className="flex rounded-full bg-slate-200/70 p-1 text-sm font-semibold"
          >
            {VERSIONS.map((v) => (
              <button
                key={v.id}
                type="button"
                role="tab"
                aria-selected={version === v.id}
                onClick={() => setVersion(v.id)}
                className={`rounded-full px-3 py-1 transition ${
                  version === v.id
                    ? "bg-white text-ink-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                data-testid={`version-${v.id}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500">
          <span data-testid="telling-length">
            {VERSIONS.find((v) => v.id === version)?.note}. About{" "}
            {seconds < 60 ? `${seconds} seconds` : formatMinutes(seconds)} spoken.
          </span>
          <button
            type="button"
            onClick={copy}
            className="rounded-full px-3 py-1 font-medium text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          <PauseMark /> pause for a beat · <strong className="text-slate-900">bold</strong> stress
          this
        </p>

        <ol className="mt-4 flex flex-col gap-3" data-testid="telling-script">
          <Line label="Hook" text={hook} emphasize />
          {beats.map((b, i) => (
            <Line
              key={`${version}-${i}`}
              label={beatLabel(b.beat)}
              text={b.text}
              pause={pauseBefore(b.beat)}
              emphasize={emphasizeBeat(b.beat)}
              note={
                b.beat === "turn" && thinking
                  ? `Show your thinking: ${thinking.improve || thinking.note}`
                  : undefined
              }
            />
          ))}
        </ol>
        {telling.untracedNumbers.length > 0 && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            These figures aren&apos;t in your answers:{" "}
            <strong>{telling.untracedNumbers.join(", ")}</strong>. Don&apos;t say them unless
            they&apos;re real; coach it again to drop them.
          </p>
        )}
      </div>

      <Detail telling={telling} disabled={disabled} onAddDetail={onAddDetail} />

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={onCoach}
          disabled={disabled}
          className="rounded-xl px-4 py-2 font-semibold text-ink-800 ring-1 ring-ink-800/30 hover:bg-ink-50 disabled:opacity-50"
        >
          {coaching ? "Coaching…" : "Coach it again"}
        </button>
        <p className="text-sm text-slate-600">
          Practice mode shows your opener as a cue when this story comes up.
        </p>
      </div>
    </div>
  );
}

function Line({
  label,
  text,
  pause = false,
  emphasize = false,
  note,
}: {
  label: string;
  text: string;
  pause?: boolean;
  emphasize?: boolean;
  note?: string;
}) {
  return (
    <li className="flex flex-col gap-1">
      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        {pause && <PauseMark />}
        {label}
      </span>
      <p className="text-lg leading-relaxed text-slate-800">
        {withEmphasis(text, emphasize).map((piece, i) =>
          piece.emphasis ? (
            <strong key={i} className="font-bold text-slate-950">
              {piece.text}
            </strong>
          ) : (
            <span key={i}>{piece.text}</span>
          ),
        )}
      </p>
      {note && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" data-testid="turn-thinking">
          {note}
        </p>
      )}
    </li>
  );
}

function PauseMark() {
  return (
    <span
      aria-label="pause"
      className="inline-flex items-center rounded-md bg-ink-100 px-1.5 py-0.5 text-xs font-bold text-ink-800"
      data-testid="pause-mark"
    >
      ‖
    </span>
  );
}

// The checks on the written story beside the same checks on the told version.
function Checks({ draft, told }: { draft: TellingCheck[]; told: TellingCheck[] }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4" data-testid="telling-checks">
      <h3 className="text-sm font-bold text-slate-900">Written to be read vs. told out loud</h3>
      <ul className="mt-2 flex flex-col gap-2 text-sm">
        {told.map((t) => {
          const before = draft.find((d) => d.id === t.id);
          const fixed = before && !before.passed && t.passed;
          return (
            <li key={t.id} className="flex flex-col">
              <span className="flex items-center gap-2 font-semibold text-slate-800">
                <span className={t.passed ? "text-emerald-700" : "text-amber-700"}>
                  {t.passed ? "✓" : "!"}
                </span>
                {CHECK_LABELS[t.id]}
                {fixed && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">
                    Fixed
                  </span>
                )}
              </span>
              <span className="pl-5 text-slate-600">
                {fixed ? `Written version: ${before.note}` : t.note}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Detail({
  telling,
  disabled,
  onAddDetail,
}: {
  telling: StoryTelling;
  disabled: boolean;
  onAddDetail: (answer: string) => void;
}) {
  const detail = telling.detail;
  // The answer box opens on request: it scrolls itself into view, which shouldn't happen on load.
  const [answering, setAnswering] = useState(false);
  if ("quote" in detail) {
    return (
      <div className="rounded-2xl bg-ink-50 p-4" data-testid="vivid-detail">
        <h3 className="text-sm font-bold text-slate-900">The detail that makes it stick</h3>
        <p className="mt-1 text-slate-800">&ldquo;{detail.quote}&rdquo;</p>
        <p className="mt-1 text-sm text-slate-600">From your answers. Slow down when you get here.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-amber-50 p-4" data-testid="vivid-detail">
      <h3 className="text-sm font-bold text-amber-950">One vivid detail would make this stick</h3>
      <p className="mt-1 text-amber-950">{detail.ask}</p>
      <p className="mb-3 mt-1 text-sm text-amber-900">
        I won&apos;t make one up. Tell me and I&apos;ll work it in.
      </p>
      {answering ? (
        <AnswerComposer
          disabled={disabled}
          submitLabel="Add it and coach again"
          placeholder="Tap Talk and say it, or type it."
          onSubmit={(answer) => onAddDetail(answer)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAnswering(true)}
          disabled={disabled}
          className="rounded-xl bg-ink-800 px-4 py-2 font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
          data-testid="add-detail"
        >
          Add a detail
        </button>
      )}
    </div>
  );
}

function formatMinutes(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} sec` : `${m} min`;
}
