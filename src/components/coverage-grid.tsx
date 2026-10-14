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

const STATUS: Record<Exclude<ThemeStatus, "empty">, { label: string; dot: string }> = {
  strong: { label: "Strong", dot: "bg-green-400" },
  good_enough: { label: "Good enough", dot: "bg-white" },
  not_yet: { label: "Not yet", dot: "bg-amber-300" },
  written: { label: "Not graded", dot: "bg-navy-300" },
  in_progress: { label: "In progress", dot: "bg-navy-500" },
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
    <section className="mt-6" aria-labelledby="coverage-heading" data-testid="coverage-grid">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id="coverage-heading" className="font-semibold">
          Question themes covered
        </h3>
        <p className="text-sm text-navy-100" data-testid="coverage-count">
          {covered} of {themes.length}
        </p>
      </div>
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
              ) : (
                <Link
                  href={`/stories/${theme.story.id}`}
                  title={theme.story.title}
                  className="flex h-full flex-col items-start rounded-xl bg-white/10 px-3 py-2 transition hover:bg-white/20"
                >
                  <span className="text-sm font-semibold">{theme.label}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-navy-100">
                    <span className={`size-2 rounded-full ${STATUS[theme.status].dot}`} aria-hidden />
                    {STATUS[theme.status].label}
                  </span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      </form>

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
