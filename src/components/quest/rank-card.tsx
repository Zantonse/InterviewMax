import Link from "next/link";
import { rankFor, RANKS, type XpSummary } from "@/lib/quest/xp";

// The player card: rank, XP, and how far to the next rank. On /quest it also lists where the XP
// came from; on home (`compact`) it's one line that links to Story Quest.
export function RankCard({ xp, compact = false }: { xp: XpSummary; compact?: boolean }) {
  const rank = rankFor(xp.total);
  const toNext = rank.nextAt === null ? null : rank.nextAt - xp.total;
  const bar = (
    <div
      className="h-2 overflow-hidden rounded-full bg-white/15"
      role="progressbar"
      aria-label={rank.nextName ? `Progress to ${rank.nextName}` : "Top rank"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(rank.progress * 100)}
    >
      <div
        className="h-full rounded-full bg-accent-400 transition-[width] duration-500"
        style={{ width: `${Math.max(rank.progress * 100, xp.total > 0 ? 3 : 0)}%` }}
      />
    </div>
  );
  if (compact) {
    return (
      <Link
        href="/quest"
        className="block rounded-3xl bg-ink-900 px-5 py-4 text-white shadow-sm ring-1 ring-black/5 hover:bg-ink-800"
        data-testid="quest-home-card"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-bold">
            Story Quest <span className="font-normal text-ink-200">· {rank.name}</span>
          </p>
          <p className="text-sm tabular-nums text-ink-200">
            {xp.total.toLocaleString("en-US")} XP →
          </p>
        </div>
        <div className="mt-2">{bar}</div>
      </Link>
    );
  }
  return (
    <section
      className="rounded-3xl bg-ink-900 p-5 text-white shadow-sm sm:p-6"
      aria-label="Your rank"
      data-testid="quest-rank"
      data-xp={xp.total}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-xl font-extrabold">{rank.name}</h2>
        <span className="font-mono text-xs tracking-wider text-accent-300 uppercase">
          Rank {rank.number} of {RANKS.length}
        </span>
      </div>
      <div className="mt-3">{bar}</div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 text-sm text-ink-200 tabular-nums">
        <span data-testid="quest-xp">{xp.total.toLocaleString("en-US")} XP</span>
        <span>
          {toNext === null
            ? "Top rank"
            : `${toNext.toLocaleString("en-US")} XP to ${rank.nextName}`}
        </span>
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium text-ink-100 hover:text-white">
          Where your XP comes from
        </summary>
        <ul className="mt-2 divide-y divide-white/10" data-testid="quest-xp-lines">
          {xp.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3 py-1.5 tabular-nums">
              <span className="text-ink-100">
                {l.label}
                {l.count > 0 ? ` · ${l.count}` : ""}
              </span>
              <span className={l.xp > 0 ? "text-accent-300" : "text-ink-300"}>
                {l.xp > 0 ? `+${l.xp.toLocaleString("en-US")}` : "0"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-ink-300">
          Logging in, streaks and time spent earn nothing. XP only comes from making your stories
          better.
        </p>
      </details>
    </section>
  );
}
