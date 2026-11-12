"use client";

import { gradeIsCurrent, pendingFollowUps, type StoryContent } from "@/lib/stories/content";
import {
  LEVELS,
  TOP_LEVEL,
  levelForGrade,
  levelGaps,
  levelInfo,
  needsAnswers,
  usesLevels,
  type LevelUp,
  type StoryLevel,
} from "@/lib/stories/levels";
import { storyParts, type StoryType } from "@/lib/stories/story-types";
import { wordDiff } from "@/lib/stories/word-diff";

// Story levels on the written story, as a picture first: the story on a staircase of levels, what
// the next step is missing as chips, and one button. The explanations open from small "i" lines.
// After a level-up, how far it climbed, with the rewrite shown as changes on the story.
export function LevelCard({
  content,
  storyType,
  busy,
  disabled,
  onLevelUp,
  onDismiss,
  onShowQuestions,
}: {
  content: StoryContent;
  storyType: StoryType | undefined;
  // "asking" while the level-up questions are found, "writing" while it's rewritten.
  busy: "asking" | "writing" | null;
  disabled: boolean;
  onLevelUp: () => void;
  onDismiss: () => void;
  onShowQuestions: () => void;
}) {
  if (!usesLevels(storyType, content) || !content.draft) return null;
  const grade = gradeIsCurrent(content) ? content.grade : undefined;
  const levelUp = content.levelUp;
  const waiting = levelUp && levelUp.reached === undefined && pendingFollowUps(content) > 0;
  // The level-up questions are open: answering them is the next step.
  if (waiting) {
    const info = levelInfo(levelUp.target);
    const open = pendingFollowUps(content);
    return (
      <Shell testId="level-card">
        <Staircase level={levelUp.from} climbingTo={levelUp.target} />
        <p className="mt-4 text-sm text-slate-700">
          On your way to <strong>Level {info.level}</strong>. Answer{" "}
          {open === 1 ? "1 question" : `${open} questions`}, then I rewrite it.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={onShowQuestions} disabled={disabled}>
            Answer the questions
          </PrimaryButton>
          <button
            type="button"
            onClick={onDismiss}
            disabled={disabled}
            className="text-sm font-medium text-slate-500 hover:underline disabled:opacity-50"
          >
            Not now
          </button>
        </div>
      </Shell>
    );
  }
  if (!grade) return null;

  const level = levelForGrade(grade);
  const info = levelInfo(level);
  const next = level < TOP_LEVEL ? levelInfo((level + 1) as StoryLevel) : undefined;
  const gaps = next ? levelGaps(grade) : [];
  const ask = needsAnswers(gaps);
  const result = levelUp?.reached !== undefined ? levelUp : undefined;

  return (
    <Shell testId="level-card">
      {result && (
        <LevelUpResult
          levelUp={result}
          content={content}
          storyType={storyType}
          onDismiss={onDismiss}
          disabled={disabled}
        />
      )}
      <Staircase level={level} missing={gaps[0]?.label} />
      <Info label={`What Level ${level} means`} testId="level-hears">
        An interviewer hears {lowerFirst(info.hears)}
      </Info>
      {next ? (
        <div className="mt-4" data-testid="level-next">
          {gaps.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" data-testid="level-gaps" aria-label="What your story needs">
              {gaps.map((g) => (
                <li
                  key={g.id}
                  className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200"
                >
                  + {g.label}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <PrimaryButton onClick={onLevelUp} disabled={disabled} busy={busy !== null} accent>
              {busy === "asking"
                ? "Finding the right questions…"
                : busy === "writing"
                  ? "Rewriting…"
                  : ask
                    ? `Climb to Level ${next.level}`
                    : `Rewrite it for Level ${next.level}`}
            </PrimaryButton>
            <span className="text-xs text-slate-500">
              {ask ? "A few questions, then a rewrite" : "A rewrite, nothing to answer"}
            </span>
          </div>
          <Info label={`How to reach Level ${next.level}`}>
            <span className="block">{next.lesson}</span>
            {gaps.map((g) => (
              <span key={g.id} className="mt-1 block">
                <span className="font-medium text-slate-900">{g.label}.</span> {g.detail}
              </span>
            ))}
          </Info>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-700" data-testid="level-top">
          Top level for a written story. Next, say it out loud with How to tell it below.
        </p>
      )}
    </Shell>
  );
}

function Shell({ testId, children }: { testId: string; children: React.ReactNode }) {
  return (
    <section
      className="animate-enter rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
      aria-label="Story level"
      data-testid={testId}
    >
      {children}
    </section>
  );
}

// Level 1 → Level 2 → Level 3 as steps that climb, with the story marked on the one it's reached.
// The next step says what's missing for it; while a level-up is open, it's the one being climbed.
export function Staircase({
  level,
  missing,
  climbingTo,
}: {
  level: StoryLevel;
  missing?: string;
  climbingTo?: StoryLevel;
}) {
  const heights = ["h-16", "h-20", "h-24"];
  return (
    <ol
      className="grid grid-cols-3 items-end gap-2 pt-9"
      aria-label="Story level"
      data-testid="level-ladder"
    >
      {LEVELS.map((l, i) => {
        const done = l.level <= level;
        const current = l.level === level;
        const next = l.level === level + 1;
        return (
          <li
            key={l.level}
            aria-current={current ? "step" : undefined}
            className={`relative flex flex-col justify-start rounded-t-2xl rounded-b-md p-2.5 transition-colors duration-300 sm:p-3 ${heights[i]} ${
              done
                ? current
                  ? "bg-ink-800 text-white"
                  : "bg-ink-600 text-white"
                : next
                  ? `border-2 border-dashed bg-white ${climbingTo === l.level ? "border-accent-500" : "border-accent-300"}`
                  : "border-2 border-dashed border-slate-200 bg-white"
            }`}
          >
            {current && (
              <span className="animate-pop absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-400 px-2.5 py-1 text-xs font-bold text-ink-950 shadow-sm after:absolute after:left-1/2 after:top-full after:-ml-1 after:border-4 after:border-transparent after:border-t-accent-400">
                Your story
              </span>
            )}
            <span
              className={`text-[11px] font-bold uppercase tracking-wide ${done ? "text-white/70" : "text-slate-400"}`}
            >
              Level {l.level}
            </span>
            <span
              className={`text-sm font-semibold leading-tight ${done ? "text-white" : next ? "text-slate-700" : "text-slate-400"}`}
            >
              {l.name}
            </span>
            {next && (climbingTo === l.level || missing) && (
              <span className="mt-1 hidden text-xs leading-tight text-slate-500 sm:block">
                {climbingTo === l.level ? "Climbing now" : `Missing: ${lowerFirst(missing ?? "")}`}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// A short line that opens to the longer explanation, so the card leads with the picture.
function Info({
  label,
  testId,
  children,
}: {
  label: string;
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group mt-3 text-sm" data-testid={testId}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-ink-800 [&::-webkit-details-marker]:hidden">
        <span
          aria-hidden="true"
          className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold"
        >
          i
        </span>
        {label}
      </summary>
      <p className="animate-fade mt-1.5 text-slate-600">{children}</p>
    </details>
  );
}

function LevelUpResult({
  levelUp,
  content,
  storyType,
  disabled,
  onDismiss,
}: {
  levelUp: LevelUp;
  content: StoryContent;
  storyType: StoryType | undefined;
  disabled: boolean;
  onDismiss: () => void;
}) {
  const reached = levelUp.reached ?? levelUp.from;
  const climbed = reached > levelUp.from;
  const info = levelInfo(reached);
  const parts = storyParts(storyType);
  return (
    <div
      className={`mb-4 rounded-2xl p-4 ${climbed ? "bg-emerald-50 ring-1 ring-emerald-200" : "bg-amber-50 ring-1 ring-amber-200"}`}
      data-testid="level-up-result"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`font-bold ${climbed ? "text-emerald-900" : "text-amber-900"}`}>
          {climbed
            ? `You reached Level ${reached}: ${info.name}`
            : `Still Level ${reached}, but closer`}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          disabled={disabled}
          className="shrink-0 text-sm font-medium text-slate-500 hover:underline disabled:opacity-50"
        >
          Close
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-700">
        {climbed
          ? reached >= TOP_LEVEL
            ? "Your story now shows how you think, not just what happened."
            : "Your story now proves something. It's ready to use, and there's one more level."
          : "The rewrite used your answers, but a few things still hold it back."}
      </p>
      <BeforeAfter
        before={levelUp.before}
        after={content.draft?.parts ?? {}}
        parts={parts}
        from={levelUp.from}
        reached={reached}
      />
    </div>
  );
}

// The rewrite as changes on the story itself: added words underlined in green, cut words struck
// through, part by part, with each changed part named. Unchanged parts fold into one line.
function BeforeAfter({
  before,
  after,
  parts,
  from,
  reached,
}: {
  before: Record<string, string>;
  after: Record<string, string>;
  parts: readonly { id: string; label: string }[];
  from: StoryLevel;
  reached: StoryLevel;
}) {
  const rows = parts
    .map((p) => ({ part: p, pieces: wordDiff(before[p.id] ?? "", after[p.id] ?? "") }))
    .filter((r) => r.pieces.length > 0);
  const changed = rows.filter((r) => r.pieces.some((x) => x.kind !== "same"));
  const unchanged = rows.length - changed.length;
  return (
    <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-black/5" data-testid="before-after">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          What changed, Level {from} to {reached}
        </p>
        <p className="flex gap-2 text-xs text-slate-500" aria-hidden="true">
          <span className="border-b-2 border-emerald-500 bg-emerald-50 px-1">added</span>
          <span className="text-slate-400 line-through">cut</span>
        </p>
      </div>
      {changed.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">The words stayed the same.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-3 text-sm leading-relaxed" data-stagger>
          {changed.map(({ part, pieces }) => (
            <div key={part.id}>
              <span className="mb-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200">
                {part.label}
              </span>
              <p className="text-slate-700">
                {pieces.map((x, i) =>
                  x.kind === "added" ? (
                    <ins
                      key={i}
                      className="rounded-sm border-b-2 border-emerald-500 bg-emerald-50 px-0.5 text-slate-900 no-underline"
                    >
                      {x.text}
                    </ins>
                  ) : x.kind === "cut" ? (
                    <del key={i} className="text-slate-400">
                      {x.text}
                    </del>
                  ) : (
                    <span key={i}>{x.text}</span>
                  ),
                ).reduce<React.ReactNode[]>(
                  (acc, node, i) => (i === 0 ? [node] : [...acc, " ", node]),
                  [],
                )}
              </p>
            </div>
          ))}
        </div>
      )}
      {unchanged > 0 && changed.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {unchanged === 1 ? "1 part" : `${unchanged} parts`} unchanged.
        </p>
      )}
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  busy,
  accent = false,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  busy?: boolean;
  // The level's main call to action: periwinkle, like the app's other main buttons.
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      className={`rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
        accent
          ? "bg-accent-400 text-ink-950 hover:bg-accent-300"
          : "bg-ink-800 text-white hover:bg-ink-900"
      }`}
    >
      {children}
    </button>
  );
}

function lowerFirst(text: string): string {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}
