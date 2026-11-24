"use client";

import { xpForClimb } from "@/lib/quest/xp";
import Link from "next/link";
import { useEffect, useState } from "react";
import { gradeIsCurrent, pendingFollowUps, type StoryContent } from "@/lib/stories/content";
import {
  TOP_LEVEL,
  levelForGrade,
  levelGaps,
  levelInfo,
  needsAnswers,
  readyToMoveOn,
  usesLevels,
  withoutAsked,
  type LevelGap,
  type StoryLevel,
} from "@/lib/stories/levels";
import type { StoryType } from "@/lib/stories/story-types";
import {
  skillInfo,
  spotChoices,
  spotHint,
  spotOutcome,
  spotTargets,
  type SkillId,
} from "@/lib/stories/skills";

// Story levels on the written story, in the margin beside it (design review 2026-11-23, fixes 3
// and 10): where the story stands and the one next step, in a few lines. The staircase picture is
// gone; the level is the small meter under the title, and what the next level needs is marked on
// the story itself, numbered, beside the paragraph each thing belongs to.

// Where each gap goes on the story: the part it adds to.
const GAP_PART: Record<string, string> = {
  situation: "situation",
  ownership: "actions",
  actions: "actions",
  obstacle: "actions",
  decision: "actions",
  result: "result",
  reflection: "reflection",
};
// Gaps only a rewrite can fix, by their own id.
const ID_PART: Record<string, string> = {
  context: "situation",
  ownership: "actions",
  actions: "actions",
  thinking: "actions",
  scope: "actions",
  result: "result",
  number: "result",
  traced: "result",
  hedged: "result",
  i_we: "actions",
  reflection: "reflection",
};

export function gapPart(gap: LevelGap, draftParts: Record<string, string>): string {
  const part = (gap.gap && GAP_PART[gap.gap]) || ID_PART[gap.id];
  return part && draftParts[part]?.trim() ? part : "end";
}

// What the story needs for the next level, worked out from its grade. Empty at the top level, for
// stories that don't use levels, and before there's a current grade.
export function nextLevelGaps(content: StoryContent, storyType: StoryType | undefined) {
  if (!usesLevels(storyType, content) || !content.draft) return undefined;
  const grade = gradeIsCurrent(content) ? content.grade : undefined;
  if (!grade) return undefined;
  const level = levelForGrade(grade);
  if (level >= TOP_LEVEL) return { level, next: undefined, gaps: [] as LevelGap[] };
  const next = (level + 1) as StoryLevel;
  // What they've already answered a level-up question about isn't asked again.
  return { level, next, gaps: withoutAsked(levelGaps(grade), content.followUps) };
}

// "Spot it yourself" (#109): before the story shows what's missing for the next level, the user
// picks what they think an interviewer can't tell yet. A miss gets a narrower hint, not the answer;
// a second miss shows it. Remembered for this version of the story in the browser, so a reload
// doesn't ask again. The state lives with the story page, because the marks on the story wait for it.
export type Spot = {
  targets: SkillId[];
  tries: SkillId[];
  done?: "found" | "revealed" | "skipped";
  // Whether what's missing can be shown yet.
  revealed: boolean;
  pick: (id: SkillId) => void;
  finish: (done: "found" | "revealed" | "skipped") => void;
};

export function useSpot(storyKey: string | undefined, gaps: LevelGap[]): Spot {
  const memoryKey = `spot:${storyKey ?? ""}`;
  const targets = spotTargets(gaps);
  const [state, setState] = useState<{ key: string; tries: SkillId[]; done?: Spot["done"] }>({
    key: memoryKey,
    tries: [],
  });
  // A new version of the story starts over.
  const current = state.key === memoryKey ? state : { key: memoryKey, tries: [] as SkillId[] };
  // Restored once per story version: storage isn't readable during render without a hydration
  // mismatch.
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(memoryKey);
      if (saved === "found" || saved === "revealed" || saved === "skipped") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restored once on mount
        setState({ key: memoryKey, tries: [], done: saved });
      }
    } catch {
      // Storage can be blocked; then it just asks again.
    }
  }, [memoryKey]);

  function finish(done: "found" | "revealed" | "skipped", tries = current.tries) {
    setState({ key: memoryKey, tries, done });
    try {
      window.sessionStorage.setItem(memoryKey, done);
    } catch {
      // Not remembered; fine.
    }
  }

  return {
    targets,
    tries: current.tries,
    done: current.done,
    revealed: targets.length === 0 || current.done !== undefined,
    pick(id) {
      const outcome = spotOutcome(id, targets, current.tries.length);
      const tries = [...current.tries, id];
      if (outcome === "hint") setState({ key: memoryKey, tries });
      else finish(outcome, tries);
    },
    finish: (done) => finish(done),
  };
}

// The margin's level step. Says where the story stands and offers the one next step.
export function LevelStep({
  content,
  storyType,
  spot,
  busy,
  disabled,
  showingChanges,
  exampleOpen,
  onLevelUp,
  onDismiss,
  onShowQuestions,
  onToggleChanges,
  onToggleExample,
}: {
  content: StoryContent;
  storyType: StoryType | undefined;
  spot: Spot;
  // "asking" while the level-up questions are found, "writing" while it's rewritten.
  busy: "asking" | "writing" | null;
  disabled: boolean;
  showingChanges: boolean;
  exampleOpen: boolean;
  onLevelUp: () => void;
  onDismiss: () => void;
  onShowQuestions: () => void;
  onToggleChanges: () => void;
  onToggleExample: () => void;
}) {
  if (!usesLevels(storyType, content) || !content.draft) return null;
  const levelUp = content.levelUp;
  // The level-up questions are open: answering them, beside the story, is the next step.
  if (levelUp && levelUp.reached === undefined && pendingFollowUps(content) > 0) {
    const open = pendingFollowUps(content);
    return (
      <div className="border-t border-ink-100 pt-4" data-testid="level-card">
        <p className="text-sm text-slate-800">
          On the way to <strong className="font-semibold">Level {levelUp.target}</strong>.{" "}
          {open === 1 ? "One question is" : `${open} questions are`} marked on the story. Answer{" "}
          {open === 1 ? "it" : "them"} and the story is rewritten.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <button
            type="button"
            onClick={onShowQuestions}
            disabled={disabled}
            className="font-medium text-ink-700 hover:text-ink-900 hover:underline disabled:opacity-50"
          >
            Answer in the builder
          </button>
          <button
            type="button"
            onClick={onDismiss}
            disabled={disabled}
            className="font-medium text-slate-500 hover:underline disabled:opacity-50"
          >
            Not now
          </button>
        </p>
      </div>
    );
  }
  const where = nextLevelGaps(content, storyType);
  if (!where) return null;
  const { level, next, gaps } = where;
  const result = levelUp?.reached !== undefined ? levelUp : undefined;

  return (
    <div className="flex flex-col gap-4 border-t border-ink-100 pt-4" data-testid="level-card">
      {result && (
        <Result
          from={result.from}
          reached={result.reached ?? result.from}
          showingChanges={showingChanges}
          disabled={disabled}
          onToggleChanges={onToggleChanges}
          onDismiss={onDismiss}
        />
      )}
      {!next ? (
        <p className="text-sm text-slate-800" data-testid="level-top">
          Level 3 is the top level for a written story. Next, practise saying it out loud.
        </p>
      ) : readyToMoveOn(level, gaps) ? (
        <MoveOn busy={busy} disabled={disabled} onRewrite={onLevelUp} />
      ) : !spot.revealed ? (
        <SpotIt spot={spot} target={next} disabled={disabled} onJustFix={onLevelUp} />
      ) : (
        <div data-testid="level-next">
          {spot.done === "found" || spot.done === "revealed" ? (
            <p className="mb-3 text-sm text-slate-700" role="status" data-testid="spot-result">
              {spot.done === "found" && spot.tries.length > 0
                ? `Yes, you spotted it: ${skillInfo(spot.tries[spot.tries.length - 1]).label.toLowerCase()}.`
                : `It's ${skillInfo(spot.targets[0]).label.toLowerCase()}. ${skillInfo(spot.targets[0]).what}`}
            </p>
          ) : null}
          <p className="text-sm text-slate-800">
            <strong className="font-semibold">Level {next}</strong>, {levelInfo(next).name.toLowerCase()}
            : {gaps.length === 1 ? "one thing" : `${gaps.length} things`} to add, numbered on the
            story.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              type="button"
              onClick={onLevelUp}
              disabled={disabled}
              aria-busy={busy !== null}
              className="btn-next"
            >
              {busy === "asking"
                ? "Finding the right questions…"
                : busy === "writing"
                  ? "Rewriting…"
                  : needsAnswers(gaps)
                    ? `Climb to Level ${next}`
                    : `Rewrite it for Level ${next}`}
            </button>
            <span className="text-xs text-slate-600">
              {needsAnswers(gaps) ? "A few questions, then a rewrite" : "A rewrite, nothing to answer"}
            </span>
          </div>
          <button
            type="button"
            onClick={onToggleExample}
            aria-expanded={exampleOpen}
            className="mt-3 text-sm font-medium text-ink-700 hover:text-ink-900 hover:underline"
            data-testid="level-example"
          >
            {exampleOpen ? "Hide the example" : `See an example at Level ${next}`}
          </button>
        </div>
      )}
    </div>
  );
}

// After a level-up: how far the story climbed. The rewrite itself shows on the story as changes.
function Result({
  from,
  reached,
  showingChanges,
  disabled,
  onToggleChanges,
  onDismiss,
}: {
  from: StoryLevel;
  reached: StoryLevel;
  showingChanges: boolean;
  disabled: boolean;
  onToggleChanges: () => void;
  onDismiss: () => void;
}) {
  const climbed = reached > from;
  return (
    <div role="status" data-testid="level-up-result">
      <p className={`text-sm font-semibold ${climbed ? "text-emerald-800" : "text-slate-900"}`}>
        {climbed
          ? `Up to Level ${reached}: ${levelInfo(reached).name.toLowerCase()}`
          : reached >= 2
            ? `Still Level ${reached}, and ready to use`
            : `Still Level ${reached}, but closer`}
      </p>
      <p className="mt-1 text-sm text-slate-700">
        {climbed
          ? reached >= TOP_LEVEL
            ? "It now shows how you think, not just what happened."
            : "It now proves something, so it's ready to use. There's one more level."
          : reached >= 2
            ? "The rewrite used your answers. A second story will help you more than another pass on this one."
            : "The rewrite used your answers, but a few things still hold it back."}
      </p>
      {climbed && (
        <p className="mt-1 text-sm text-slate-700" data-testid="level-up-xp">
          <span className="font-mono font-medium text-slate-900 tabular-nums">
            +{xpForClimb(from, reached)} XP
          </span>{" "}
          in{" "}
          <Link href="/quest" className="link">
            Story Quest
          </Link>
        </p>
      )}
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <button
          type="button"
          onClick={onToggleChanges}
          aria-pressed={showingChanges}
          className="font-medium text-ink-700 hover:text-ink-900 hover:underline"
          data-testid="before-after"
        >
          {showingChanges ? "Hide the changes" : `See what changed from Level ${from}`}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={disabled}
          className="font-medium text-slate-500 hover:underline disabled:opacity-50"
        >
          Close
        </button>
      </p>
    </div>
  );
}

// Level 2, and the user has answered everything the level-up can ask: the story is ready to use,
// and the next story is worth more than another pass. One more rewrite stays on offer, quietly.
function MoveOn({
  busy,
  disabled,
  onRewrite,
}: {
  busy: "asking" | "writing" | null;
  disabled: boolean;
  onRewrite: () => void;
}) {
  return (
    <div data-testid="level-move-on">
      <p className="text-sm font-semibold text-slate-900">This story is ready to use.</p>
      <p className="mt-1 text-sm text-slate-700">
        Everything there was to ask has been answered. Level 2 holds up in an interview, and your
        next story will help you more than another pass on this one.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link href="/stories/new" className="btn-next">
          Build the next story
        </Link>
        <button
          type="button"
          onClick={onRewrite}
          disabled={disabled}
          aria-busy={busy !== null}
          className="text-sm font-medium text-slate-500 hover:underline disabled:opacity-50"
        >
          {busy === "writing" || busy === "asking" ? "Rewriting…" : "Rewrite it once more"}
        </button>
      </div>
    </div>
  );
}

function SpotIt({
  spot,
  target,
  disabled,
  onJustFix,
}: {
  spot: Spot;
  target: StoryLevel;
  disabled: boolean;
  onJustFix: () => void;
}) {
  const missed = spot.tries.length > 0;
  return (
    <div data-testid="spot-it">
      <p className="text-sm font-semibold text-slate-900">
        {missed ? "Not quite. Try once more." : `What's missing for Level ${target}?`}
      </p>
      <p className="mt-1 text-sm text-slate-700">
        {missed
          ? spotHint(spot.targets)
          : "Read the story as the interviewer would, then pick what they can't tell yet."}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="What's missing">
        {spotChoices(target).map((s) => {
          const tried = spot.tries.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => spot.pick(s.id)}
              disabled={disabled || tried}
              className={`rounded-lg px-2.5 py-1 text-sm ring-1 transition-colors disabled:cursor-default ${
                tried
                  ? "text-slate-500 line-through ring-ink-100"
                  : "text-ink-900 ring-ink-200 hover:bg-ink-50 hover:ring-ink-300"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <button
          type="button"
          onClick={() => spot.finish("revealed")}
          disabled={disabled}
          className="font-medium text-ink-700 hover:text-ink-900 hover:underline disabled:opacity-50"
        >
          Show me
        </button>
        <button
          type="button"
          onClick={() => {
            spot.finish("skipped");
            onJustFix();
          }}
          disabled={disabled}
          className="font-medium text-slate-500 hover:underline disabled:opacity-50"
          data-testid="just-fix-it"
        >
          Just fix it
        </button>
      </p>
    </div>
  );
}
