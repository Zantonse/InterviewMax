import { rankFor, RANKS, type XpSummary } from "@/lib/quest/xp";

// Your rank: its name, the XP, a plain bar to the next rank, and where the XP came from as a short
// table. Set on the page with space and rules, not a card (design review 2026-11-23).
export function RankCard({ xp }: { xp: XpSummary }) {
  const rank = rankFor(xp.total);
  const toNext = rank.nextAt === null ? null : rank.nextAt - xp.total;
  const earned = xp.lines.filter((l) => l.xp > 0);
  return (
    <section aria-label="Your rank" data-testid="quest-rank" data-xp={xp.total}>
      <p className="text-sm text-slate-600">
        Rank {rank.number} of {RANKS.length}
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
        <span className="text-2xl font-semibold tracking-tight text-slate-900">{rank.name}</span>
        <span className="font-mono text-slate-600 tabular-nums" data-testid="quest-xp">
          {xp.total.toLocaleString("en-US")} XP
        </span>
      </p>
      <div
        className="mt-3 h-1.5 max-w-md overflow-hidden rounded-full bg-ink-100"
        role="progressbar"
        aria-label={rank.nextName ? `Progress to ${rank.nextName}` : "Top rank"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(rank.progress * 100)}
      >
        <div
          className="h-full rounded-full bg-ink-900 transition-[width] duration-500"
          style={{ width: `${rank.progress * 100}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-slate-600 tabular-nums">
        {toNext === null
          ? "Top rank."
          : `${toNext.toLocaleString("en-US")} XP to ${rank.nextName}.`}
      </p>
      <table className="mt-6 w-full max-w-md text-sm" data-testid="quest-xp-lines">
        <caption className="pb-2 text-left font-semibold text-slate-900">Where your XP comes from</caption>
        <tbody className="divide-y divide-ink-100 border-y border-ink-100">
          {(earned.length > 0 ? earned : xp.lines.slice(0, 4)).map((l) => (
            <tr key={l.id}>
              <td className="py-1.5 pr-4 text-slate-700">{l.label}</td>
              <td className="py-1.5 pr-4 text-right text-slate-600 tabular-nums">{l.count}</td>
              <td className="py-1.5 text-right font-mono text-slate-900 tabular-nums">
                {l.xp > 0 ? `+${l.xp.toLocaleString("en-US")}` : "0"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 max-w-md text-sm text-slate-600">
        XP only comes from making your stories better. Logging in and time spent earn nothing.
      </p>
    </section>
  );
}
