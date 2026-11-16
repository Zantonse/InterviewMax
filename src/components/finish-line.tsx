import Link from "next/link";
import { MINUTES_PER_STORY, paceLine, type FinishLine } from "@/lib/prep/finish-line";

// The finish line as a bar of story slots: how many core stories are written, the pace that
// finishes them (before the interview, when there's a date), and a clear stop once today's story is
// done. On home it carries the button to today's story; under a story just written it says whether
// that was today's.
export function FinishLineBar({
  line,
  afterStory = false,
  next,
}: {
  line: FinishLine;
  // Shown under a story the user just wrote.
  afterStory?: boolean;
  // Home: where today's story is (continue one in progress, or start the next the jobs need).
  next?: { href: string; label: string };
}) {
  const done = line.written >= line.goal;
  const title = done
    ? `All ${line.goal} core stories written`
    : `${line.written} of ${line.goal} core stories`;
  return (
    <section
      className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:p-6"
      aria-label="Your core stories"
      data-testid="finish-line"
      data-written={line.written}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {!done && <span className="text-sm text-slate-500">{MINUTES_PER_STORY} each</span>}
      </div>
      <ol className="mt-3 flex gap-1.5" aria-hidden>
        {Array.from({ length: line.goal }, (_, i) => (
          <li
            key={i}
            className={`h-2.5 flex-1 rounded-full ${
              i < line.written
                ? "bg-ink-800"
                : i === line.written && !line.doneToday
                  ? "bg-accent-400"
                  : "bg-ink-100"
            }`}
          />
        ))}
      </ol>
      <p className="mt-3 text-sm text-slate-700" data-testid="finish-pace">
        {afterStory && line.doneToday && !done ? (
          <>
            <strong className="text-slate-900">That&apos;s today&apos;s story.</strong> A good place
            to stop. {paceLine(line)}
          </>
        ) : done ? (
          paceLine(line)
        ) : (
          <>
            {line.goal} stories answer most of what interviewers ask. {paceLine(line)}
          </>
        )}
      </p>
      {next && !done && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {line.doneToday && line.perDay <= 1 ? (
            <>
              <p className="text-sm font-semibold text-ink-800">
                Today&apos;s done. Next one tomorrow.
              </p>
              <Link href={next.href} className="text-sm font-medium text-slate-600 hover:underline">
                Or keep going: {next.label}
              </Link>
            </>
          ) : (
            <Link
              href={next.href}
              className="rounded-xl bg-accent-400 px-4 py-2.5 text-sm font-semibold text-ink-950 transition hover:bg-accent-300"
              data-testid="finish-next"
            >
              Build today&apos;s story: {next.label}
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
