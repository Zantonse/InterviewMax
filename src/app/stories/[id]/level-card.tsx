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

// Story levels on the written story: where it stands, the one idea that gets it to the next level,
// and what's missing for it. After a level-up, how far it climbed, with the story before and after.
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
        <Ladder level={levelUp.from} />
        <p className="mt-3 text-sm text-slate-700">
          On your way to{" "}
          <strong>
            Level {info.level}: {info.name}
          </strong>
          . Answer the {open === 1 ? "question" : `${open} questions`} on the Build tab and
          I&apos;ll rewrite your story with what you add.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
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
      <Ladder level={level} />
      <p className="mt-3 text-sm text-slate-700" data-testid="level-hears">
        <span className="font-semibold text-slate-900">
          Level {level}: {info.name}.
        </span>{" "}
        An interviewer hears {lowerFirst(info.hears)}
      </p>
      {next ? (
        <div
          className="mt-4 rounded-2xl bg-ink-50 p-4 ring-1 ring-ink-800/10"
          data-testid="level-next"
        >
          <p className="text-sm font-bold text-ink-900">
            Next: Level {next.level}, {next.name.toLowerCase()}
          </p>
          <p className="mt-1 text-sm text-slate-700">{next.lesson}</p>
          {gaps.length > 0 && (
            <>
              <p className="mt-3 text-sm font-semibold text-slate-800">What your story needs:</p>
              <ul className="mt-1 flex flex-col gap-1.5" data-testid="level-gaps">
                {gaps.map((g) => (
                  <li key={g.id} className="flex gap-2 text-sm">
                    <span aria-hidden="true" className="mt-0.5 font-bold text-ink-700">
                      →
                    </span>
                    <span>
                      <span className="font-medium text-slate-900">{g.label}.</span>{" "}
                      <span className="text-slate-600">{g.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-3">
            <PrimaryButton onClick={onLevelUp} disabled={disabled} busy={busy !== null}>
              {busy === "asking"
                ? "Finding the right questions…"
                : busy === "writing"
                  ? "Rewriting…"
                  : ask
                    ? `Help me reach Level ${next.level}`
                    : `Rewrite it for Level ${next.level}`}
            </PrimaryButton>
            <p className="mt-2 text-xs text-slate-500">
              {ask
                ? `A few questions about only these, then I'll rewrite it and show you before and after.`
                : `Nothing to ask: I'll rewrite it to fix these and show you before and after.`}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-700" data-testid="level-top">
          That&apos;s the top level for a written story. Next, practice saying it out loud with How
          to tell it below.
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

// Level 1 → Level 2 → Level 3, with the current one marked.
export function Ladder({ level }: { level: StoryLevel }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Story level" data-testid="level-ladder">
      {LEVELS.map((l) => {
        const done = l.level <= level;
        const current = l.level === level;
        return (
          <li
            key={l.level}
            aria-current={current ? "step" : undefined}
            className="flex flex-col gap-1.5"
          >
            <span
              aria-hidden="true"
              className={`h-1.5 rounded-full ${done ? "bg-ink-700" : "bg-slate-200"}`}
            />
            <span
              className={`text-xs font-bold uppercase tracking-wide ${current ? "text-ink-800" : done ? "text-ink-700/70" : "text-slate-400"}`}
            >
              Level {l.level}
            </span>
            <span
              className={`text-sm leading-tight ${current ? "font-semibold text-slate-900" : done ? "text-slate-600" : "text-slate-400"}`}
            >
              {l.name}
            </span>
          </li>
        );
      })}
    </ol>
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
  const text = (p: Record<string, string>) =>
    parts.flatMap((part) => (p[part.id]?.trim() ? [p[part.id].trim()] : []));
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
          : "The rewrite used your answers, but a few things still hold it back. They're listed below."}
      </p>
      <details className="mt-2 text-sm" data-testid="before-after">
        <summary className="cursor-pointer font-medium text-ink-800">See before and after</summary>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white/70 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Before, Level {levelUp.from}
            </p>
            {text(levelUp.before).map((p, i) => (
              <p key={i} className="mt-2 text-slate-600">
                {p}
              </p>
            ))}
          </div>
          <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
            <p className="text-xs font-bold uppercase tracking-wide text-ink-800">
              Now, Level {reached}
            </p>
            {text(content.draft?.parts ?? {}).map((p, i) => (
              <p key={i} className="mt-2 text-slate-800">
                {p}
              </p>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  busy,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      className="rounded-xl bg-ink-800 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-900 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function lowerFirst(text: string): string {
  return text ? text[0].toLowerCase() + text.slice(1) : text;
}
