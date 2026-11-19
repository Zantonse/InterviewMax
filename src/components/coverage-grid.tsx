import Link from "next/link";
import { startStory } from "@/app/stories/new/actions";
import { levelLabel } from "@/lib/jobs/content";
import type { TargetJob } from "@/lib/jobs/data";
import {
  isCovered,
  levelMix,
  needLabel,
  targetLevel,
  themeCounts,
  themeCoverage,
  type ThemeCount,
  type ThemeStatus,
} from "@/lib/stories/bank";
import type { StoryRecord } from "@/lib/stories/data";
import { getStoryType } from "@/lib/stories/story-types";
import { buildRecap } from "@/lib/recap/recap";
import { BankViews } from "./bank-views";
import { GapButton } from "./gap-button";

// Three looks: a written story is a solid tile with its level as three bars (the story levels:
// Not yet and ungraded are Level 1, Good enough 2, Strong 3), a started one an outlined tile, and
// an empty theme a dashed "+ Build" (GapButton).
const LEVEL: Record<Exclude<ThemeStatus, "empty" | "in_progress">, 1 | 2 | 3> = {
  strong: 3,
  good_enough: 2,
  not_yet: 1,
  written: 1,
};

// The story bank against the question themes, on the home page's story bank card. Covered
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

      <BankViews
        tiles={
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
                      <span className="mt-0.5 text-xs text-ink-100">In progress</span>
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
                      <span className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-700">
                        <span className="flex gap-0.5" aria-hidden="true">
                          {[1, 2, 3].map((n) => (
                            <span
                              key={n}
                              className={`h-1.5 w-4 rounded-full ${
                                n > LEVEL[theme.status as keyof typeof LEVEL]
                                  ? "bg-ink-100"
                                  : LEVEL[theme.status as keyof typeof LEVEL] === 3
                                    ? "bg-emerald-600"
                                    : "bg-ink-800"
                              }`}
                            />
                          ))}
                        </span>
                        Level {LEVEL[theme.status as keyof typeof LEVEL]}
                      </span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </form>
        }
        counts={<ThemeCountList counts={themeCounts(stories)} />}
      />
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

      {buildRecap(stories, []) && (
        <Link
          href="/recap"
          className="mt-2 block text-sm font-semibold text-accent-200 hover:underline"
          data-testid="recap-link"
        >
          See your prep recap →
        </Link>
      )}
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

// The dot beside a theme in the counted list: the level of its best story, a ring while one is
// only started, a dashed ring when there's none.
function LevelDot({ status }: { status: ThemeStatus }) {
  const base = "h-3 w-3 shrink-0 rounded-full";
  if (status === "empty") return <span className={`${base} border border-dashed border-accent-300`} />;
  if (status === "in_progress") return <span className={`${base} ring-2 ring-inset ring-white/60`} />;
  const level = LEVEL[status as keyof typeof LEVEL];
  const colour = level === 3 ? "bg-emerald-400" : level === 2 ? "bg-accent-300" : "bg-ink-300";
  return <span className={`${base} ${colour}`} />;
}

// The story bank as counts, like "Leadership: 4 stories": a bar per theme against the busiest one,
// most first, so thin spots and gaps show at a glance.
function ThemeCountList({ counts }: { counts: ThemeCount[] }) {
  const most = Math.max(1, ...counts.map((c) => c.written));
  return (
    <form action={startStory}>
      <ul className="mt-3 divide-y divide-white/10" data-testid="theme-counts">
        {counts.map((c) => {
          const level = c.status in LEVEL ? LEVEL[c.status as keyof typeof LEVEL] : null;
          return (
            <li
              key={c.id}
              className="flex items-center gap-3 py-2"
              data-testid={`count-${c.id}`}
              data-written={c.written}
            >
              <LevelDot status={c.status} />
              <span className="w-40 shrink-0 truncate text-sm font-semibold sm:w-52">
                {c.story ? (
                  <Link href={`/stories/${c.story.id}`} className="hover:underline" title={c.story.title}>
                    {c.label}
                  </Link>
                ) : (
                  c.label
                )}
              </span>
              <span className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-white/10 sm:block" aria-hidden="true">
                <span
                  className="block h-full rounded-full bg-white/70"
                  style={{ width: `${(c.written / most) * 100}%` }}
                />
              </span>
              <span className="ml-auto shrink-0 text-right text-sm text-ink-100 sm:ml-0 sm:w-28">
                {c.written > 0 ? (
                  <>
                    <span className="font-bold text-white">{c.written}</span>{" "}
                    {c.written === 1 ? "story" : "stories"}
                    {level && <span className="sr-only">, best at Level {level}</span>}
                  </>
                ) : c.started > 0 ? (
                  `${c.started} started`
                ) : (
                  <button
                    type="submit"
                    name="storyType"
                    value={c.build ?? ""}
                    className="font-semibold text-accent-200 hover:underline"
                    data-testid={`count-build-${c.id}`}
                  >
                    + Build
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-100" aria-hidden="true">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400" />Level 3</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent-300" />Level 2</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-ink-300" />Level 1</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full border border-dashed border-accent-300" />None yet</span>
      </p>
    </form>
  );
}
