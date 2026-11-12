import Link from "next/link";
import { startStory } from "@/app/stories/new/actions";
import { READY_LEVEL, type QuestionReadiness, type ReadyLevel } from "@/lib/jobs/readiness";

// How ready a target job is, as a picture: a ring that fills as questions get a Level 2+ story,
// with the days to the interview in the middle, and each likely question with its story's level.

export function ReadinessCard({
  rows,
  ready,
  total,
  days,
}: {
  rows: QuestionReadiness[];
  ready: number;
  total: number;
  // Days to the interview: null with no date set or once it's past.
  days: number | null;
}) {
  if (total === 0) return null;
  // The next thing to do: the first question with no story, else the first below Level 2.
  const next =
    rows.find((r) => r.kind === "build") ??
    rows.find((r) => r.kind === "story" && r.level < READY_LEVEL);
  return (
    <section
      className="animate-enter rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
      aria-label="How ready you are"
      data-testid="readiness"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex shrink-0 items-center gap-4 sm:w-40 sm:flex-col sm:text-center">
          <ReadinessRing ready={ready} total={total} days={days} />
          <div>
            <p className="font-bold text-slate-900">
              {ready} of {total} ready
            </p>
            <p className="text-xs text-slate-500">Ready = a Level {READY_LEVEL}+ story</p>
            {next && <NextButton row={next} />}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
            <span>Likely questions</span>
            <span>Best story</span>
          </div>
          <ReadinessRows rows={rows} />
        </div>
      </div>
    </section>
  );
}

export function ReadinessRing({
  ready,
  total,
  days,
  size = "lg",
}: {
  ready: number;
  total: number;
  days: number | null;
  size?: "lg" | "sm";
}) {
  const share = total ? Math.round((ready / total) * 100) : 0;
  const outer = size === "lg" ? "h-28 w-28" : "h-16 w-16";
  const inner = size === "lg" ? "h-[5.5rem] w-[5.5rem]" : "h-12 w-12";
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full ${outer}`}
      style={{ background: `conic-gradient(#8392f7 0 ${share}%, #e6e8ef ${share}% 100%)` }}
      role="img"
      aria-label={`${ready} of ${total} questions ready${days !== null ? `, ${days} days to go` : ""}`}
      data-testid="readiness-ring"
    >
      <div className={`grid place-items-center rounded-full bg-white text-center ${inner}`}>
        {days !== null ? (
          <div className="leading-none">
            <span className={`block font-extrabold text-slate-900 ${size === "lg" ? "text-3xl" : "text-lg"}`}>
              {days}
            </span>
            <span className={`block text-slate-500 ${size === "lg" ? "mt-1 text-xs" : "text-[10px]"}`}>
              {days === 1 ? "day" : "days"}
            </span>
          </div>
        ) : (
          <span className={`font-extrabold text-slate-900 ${size === "lg" ? "text-2xl" : "text-sm"}`}>
            {share}%
          </span>
        )}
      </div>
    </div>
  );
}

export function ReadinessRows({ rows }: { rows: QuestionReadiness[] }) {
  return (
    <ul className="mt-1 divide-y divide-slate-100" data-stagger data-testid="readiness-rows">
      {rows.map((r) => (
        <li key={r.question} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          {r.kind === "story" ? (
            <Link
              href={`/stories/${r.storyId}`}
              className="min-w-0 flex-1 text-slate-900 hover:text-ink-800 hover:underline"
              title={`Answer with: ${r.title}`}
            >
              {r.question}
            </Link>
          ) : (
            <span className="min-w-0 flex-1 text-slate-500">{r.question}</span>
          )}
          {r.kind === "story" ? (
            <LevelBars level={r.level} />
          ) : (
            <form action={startStory} className="shrink-0">
              <input type="hidden" name="asked" value={r.question} />
              <button
                type="submit"
                name="storyType"
                value={r.storyType}
                className="flex items-center gap-2 font-semibold text-accent-700 hover:underline"
              >
                <LevelDots level={0} />
                <span className="w-16 text-right">+ Build</span>
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

function LevelBars({ level }: { level: ReadyLevel }) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      <LevelDots level={level} />
      <span className="w-16 text-right text-xs text-slate-500">
        {level === 0 ? "Not written" : `Level ${level}`}
      </span>
    </span>
  );
}

function LevelDots({ level }: { level: ReadyLevel }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-2 w-5 rounded-full sm:w-7 ${
            n > level ? "bg-slate-200" : level === 3 ? "bg-emerald-600" : "bg-ink-800"
          }`}
        />
      ))}
    </span>
  );
}

function NextButton({ row }: { row: QuestionReadiness }) {
  const className =
    "mt-3 inline-block rounded-xl bg-accent-400 px-3.5 py-2 text-sm font-semibold text-ink-950 hover:bg-accent-300";
  if (row.kind === "build") {
    return (
      <form action={startStory}>
        <input type="hidden" name="asked" value={row.question} />
        <button type="submit" name="storyType" value={row.storyType} className={className}>
          Build the next one
        </button>
      </form>
    );
  }
  return (
    <Link href={`/stories/${row.storyId}`} className={className}>
      {row.level === 0 ? "Finish the next one" : "Level up the next one"}
    </Link>
  );
}
