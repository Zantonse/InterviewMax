import Link from "next/link";
import { Fragment } from "react";
import { startStory } from "@/app/stories/new/actions";
import { levelLabel } from "@/lib/jobs/content";
import type { TargetJob } from "@/lib/jobs/data";
import { readyLevelOf } from "@/lib/jobs/readiness";
import { buildRecap } from "@/lib/recap/recap";
import {
  isCovered,
  levelMix,
  needLabel,
  targetLevel,
  themeCounts,
  themeCoverage,
  type ThemeCount,
  type ThemeCoverage,
  type ThemeStatus,
} from "@/lib/stories/bank";
import { hasDraft } from "@/lib/stories/content";
import { keyFigure, storyThemes, themeShortLabel } from "@/lib/stories/cue-card";
import type { StoryRecord } from "@/lib/stories/data";
import { clock, storySeconds } from "@/lib/stories/spoken";
import { getStoryType } from "@/lib/stories/story-types";
import { isToughType, storyHref } from "@/lib/tough/questions";
import { BankViews } from "./bank-views";
import { LevelMeter } from "./level-meter";

// The story bank on home (design review 2026-11-23, fix 6): each story as a cue card you could
// glance at before walking in (its title, the one figure to remember, the themes it answers, its
// level and how long it takes to say), then the themes with no story yet in one line. "By theme"
// shows the same bank counted per theme. Replaces the dark panel of theme tiles.
export function StoryBank({ stories, jobs }: { stories: StoryRecord[]; jobs: TargetJob[] }) {
  const bank = stories.filter((s) => !isToughType(s.storyType));
  const themes = themeCoverage(bank);
  const covered = themes.filter((t) => isCovered(t.status)).length;
  const written = bank.filter((s) => hasDraft(s.content)).length;
  const missing = themes.filter((t) => t.status === "empty" && t.build);
  const level = targetLevel(jobs);

  return (
    <section className="mt-12" aria-labelledby="bank-heading" data-testid="coverage-grid">
      <BankViews
        headingId="bank-heading"
        note={
          <span data-testid="coverage-count">
            {written === 1 ? "1 story covers" : `${written} stories cover`} {covered} of the{" "}
            {themes.length} question themes
          </span>
        }
        extra={
          buildRecap(bank, []) && (
            <Link href="/recap" className="link" data-testid="recap-link">
              Recap
            </Link>
          )
        }
        cards={
          <>
            <CueCards stories={bank} />
            {missing.length > 0 && <MissingThemes missing={missing} />}
          </>
        }
        counts={<ThemeCountList counts={themeCounts(bank)} />}
      />
      <LevelMixLine mix={levelMix(bank, level)} level={level} />
    </section>
  );
}

function CueCards({ stories }: { stories: StoryRecord[] }) {
  if (stories.length === 0) {
    return (
      <p className="mt-4 text-slate-600">
        No stories yet.{" "}
        <Link href="/stories/new" className="link">
          Build your first one
        </Link>
      </p>
    );
  }
  return (
    // Each card spans two rows of the list's grid (title, then the rest), so the red lines of the
    // cards side by side sit at the same height whatever the length of the titles.
    <ul
      className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
      data-testid="cue-cards"
    >
      {stories.map((story) => (
        <li key={story.id} className="row-span-2 grid grid-rows-subgrid">
          <CueCard story={story} />
        </li>
      ))}
    </ul>
  );
}

// An index card: the title over the red line, then what to remember.
function CueCard({ story }: { story: StoryRecord }) {
  const storyType = getStoryType(story.storyType);
  const draft = story.content.draft;
  const level = readyLevelOf(story);
  const figure = keyFigure(draft?.parts);
  const themes = storyThemes(story.storyType);
  return (
    <Link
      href={storyHref(story)}
      className="row-span-2 grid grid-rows-subgrid rounded-[10px] border border-ink-200 bg-white transition-colors hover:border-ink-400"
      data-testid="cue-card"
    >
      <span className="block border-b border-rose-200 px-4 pt-3.5 pb-3">
        <span className="line-clamp-4 font-words sm:line-clamp-3 text-[1.0625rem] font-semibold leading-snug text-slate-900">
          {story.title || "Untitled story"}
        </span>
      </span>
      <span className="flex flex-col px-4 pb-3.5">
        {figure && (
          <span
            className="font-mono text-[0.9375rem] font-medium text-slate-900"
            data-testid="cue-figure"
          >
            {figure}
          </span>
        )}
        {themes.length > 0 && (
          <span className="mt-1 text-xs leading-snug text-slate-600">
            {themes
              .map((t, i) => (i === 0 || /^[A-Z]{2}/.test(t) ? t : t[0].toLowerCase() + t.slice(1)))
              .join(", ")}
          </span>
        )}
        <span className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-slate-600">
          {draft ? (
            <>
              <span className="flex items-center gap-1.5">
                <LevelMeter level={level} />
                Level {level}
              </span>
              <span className="font-mono tabular-nums">
                {clock(storySeconds(draft.parts, storyType))}
              </span>
            </>
          ) : (
            <span>Not written yet</span>
          )}
        </span>
      </span>
    </Link>
  );
}

// The themes with no story yet, under the cards, each one a button that starts that story. The
// "By theme" list has its own Build buttons, so this line only shows with the cards.
function MissingThemes({ missing }: { missing: ThemeCoverage[] }) {
  return (
    <form action={startStory} className="mt-4 text-sm text-slate-600" data-testid="bank-gaps">
      No story yet for{" "}
      {missing.map((t, i) => (
        <Fragment key={t.id}>
          {i > 0 && (i === missing.length - 1 ? " or " : ", ")}
          <button
            type="submit"
            name="storyType"
            value={t.build}
            className="link"
            title={`Build: ${getStoryType(t.build)?.label ?? "a story"}`}
            data-testid={`gap-${t.build}`}
          >
            {themeShortLabel(t)}
          </button>
        </Fragment>
      ))}
      . Tap one to start it, or{" "}
      <Link href="/stories/find" className="link" data-testid="find-stories">
        find one in your resume
      </Link>
      .
    </form>
  );
}

// Only what's still missing for the highest target level, in one line.
function LevelMixLine({
  mix,
  level,
}: {
  mix: ReturnType<typeof levelMix>;
  level: ReturnType<typeof targetLevel>;
}) {
  const missing = mix.needs.filter((need) => need.have < need.needed);
  if (!level || missing.length === 0) return null;
  return (
    <p className="mt-3 text-sm text-slate-600" data-testid="level-mix">
      For {(levelLabel(level) ?? level).toLowerCase()} roles:{" "}
      {missing.map((need) => needLabel(need)).join("; ")}.
    </p>
  );
}

// The level of a theme's best story; none while it's only started or missing.
const LEVEL: Partial<Record<ThemeStatus, 1 | 2 | 3>> = {
  strong: 3,
  good_enough: 2,
  not_yet: 1,
  written: 1,
};

// The same bank, counted by theme: how many stories answer each, most first, gaps last.
function ThemeCountList({ counts }: { counts: ThemeCount[] }) {
  return (
    <form action={startStory}>
      <ul className="mt-2 divide-y divide-ink-100" data-testid="theme-counts">
        {counts.map((c) => {
          const level = LEVEL[c.status];
          return (
            <li
              key={c.id}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-6 py-2.5 sm:grid-cols-[16rem_6rem_minmax(0,1fr)_auto]"
              data-testid={`count-${c.id}`}
              data-written={c.written}
            >
              <span className="text-sm font-medium text-slate-900">
                {c.story ? (
                  <Link
                    href={`/stories/${c.story.id}`}
                    className="hover:underline"
                    title={c.story.title}
                  >
                    {c.label}
                  </Link>
                ) : (
                  c.label
                )}
              </span>
              <span className="text-sm text-slate-600">
                {c.written > 0
                  ? `${c.written} ${c.written === 1 ? "story" : "stories"}`
                  : c.started > 0
                    ? `${c.started} started`
                    : ""}
              </span>
              <span className="hidden items-center gap-1.5 text-xs text-slate-600 sm:flex">
                {level && (
                  <>
                    <LevelMeter level={level} />
                    Best at Level {level}
                  </>
                )}
              </span>
              <span className="text-right text-sm">
                {c.written === 0 && c.started === 0 && (
                  <button
                    type="submit"
                    name="storyType"
                    value={c.build ?? ""}
                    className="link"
                    data-testid={`count-build-${c.id}`}
                  >
                    Build a story
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </form>
  );
}
