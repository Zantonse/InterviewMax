import Link from "next/link";
import { startStory } from "@/app/stories/new/actions";
import { levelLabel } from "@/lib/jobs/content";
import type { TargetJob } from "@/lib/jobs/data";
import {
  isCovered,
  levelMix,
  needLabel,
  targetLevel,
  themeCoverage,
  type ThemeStatus,
} from "@/lib/stories/bank";
import type { StoryRecord } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";
import { GapButton } from "./gap-button";

// Three looks: a written story is a solid tile with a check and its grade as words, a started one
// an outlined tile, and an empty theme a dashed "+ Build" (GapButton).
const STATUS: Record<Exclude<ThemeStatus, "empty">, string> = {
  strong: "Strong",
  good_enough: "Good enough",
  not_yet: "Not yet strong",
  written: "Not graded yet",
  in_progress: "In progress",
};

// The story bank against the ten question themes, on the home page's story bank card. Covered
// themes open their best story; empty ones start the missing story. Under it, the level mix
// against the highest level among the target jobs.
export function CoverageGrid({ stories, jobs }: { stories: StoryRecord[]; jobs: TargetJob[] }) {
  const themes = themeCoverage(stories);
  const covered = themes.filter((t) => isCovered(t.status)).length;
  const level = targetLevel(jobs);
  const mix = levelMix(stories, level);

  return (
    <section aria-labelledby="coverage-heading" data-testid="coverage-grid">
      <p id="coverage-heading" className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-4xl font-extrabold" data-testid="coverage-count">
          {covered} of {themes.length}
        </span>
        <span className="text-ink-100">question themes covered</span>
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"
        role="progressbar"
        aria-label="Themes covered"
        aria-valuemin={0}
        aria-valuemax={themes.length}
        aria-valuenow={covered}
      >
        <div className="h-full bg-white" style={{ width: `${(covered / themes.length) * 100}%` }} />
      </div>
      {stories.length > 0 && (
        <p className="mt-2 text-sm text-ink-100" data-testid="story-count">
          From {stories.length} {stories.length === 1 ? "story" : "stories"}.
        </p>
      )}

      <form action={startStory}>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {themes.map((theme) => (
            <li key={theme.id} data-testid={`theme-${theme.id}`} data-status={theme.status}>
              {theme.status === "empty" || !theme.story ? (
                <GapButton
                  themeLabel={theme.label}
                  storyType={theme.build ?? ""}
                  storyLabel={getStoryType(theme.build)?.label ?? "a story"}
                />
              ) : theme.status === "in_progress" ? (
                <Link
                  href={`/stories/${theme.story.id}`}
                  title={theme.story.title}
                  className="flex h-full flex-col items-start rounded-xl px-3 py-2 ring-1 ring-white/50 ring-inset transition hover:bg-white/10"
                >
                  <span className="text-sm font-semibold">{theme.label}</span>
                  <span className="mt-0.5 text-xs text-ink-100">{STATUS.in_progress}</span>
                </Link>
              ) : (
                <Link
                  href={`/stories/${theme.story.id}`}
                  title={theme.story.title}
                  className="flex h-full flex-col items-start rounded-xl bg-white px-3 py-2 text-ink-900 transition hover:bg-ink-50"
                >
                  <span className="flex w-full items-start justify-between gap-1 text-sm font-semibold">
                    {theme.label}
                    <span aria-label="Written" className="text-ink-700">
                      ✓
                    </span>
                  </span>
                  <span className="mt-0.5 text-xs text-ink-700">{STATUS[theme.status]}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </form>
      {covered < themes.length && (
        <Link
          href="/stories/find"
          className="mt-3 inline-block text-sm font-semibold text-accent-200 hover:underline"
          data-testid="find-stories"
        >
          Not sure what to tell? Find stories in your resume →
        </Link>
      )}

      <LevelMixLine mix={mix} level={level} />
    </section>
  );
}

// Only what's still missing for the highest target level.
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
    <div className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-sm" data-testid="level-mix">
      <p className="font-semibold">For {levelLabel(level)} roles</p>
      <ul className="mt-1 space-y-0.5">
        {missing.map((need) => (
          <li key={need.role} className="flex items-start gap-2">
            <span className="text-amber-300" aria-hidden>
              ●
            </span>
            <span>{needLabel(need)[0].toUpperCase() + needLabel(need).slice(1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
