import Link from "next/link";
import { isAdminEmail } from "@/lib/admin/access";
import {
  RANGES,
  cohort,
  dailySeries,
  dayKey,
  daysBetween,
  featureUsage,
  headline,
  medianDayLengthMs,
  rangeStart,
  troublePages,
  type EventRow,
  type RangeKey,
  type SignalRow,
} from "@/lib/admin/analytics";
import {
  formatDuration,
  percent,
  type EventFirst,
  type TimeToValue,
  type UserProgress,
} from "@/lib/admin/metrics";
import { SIGNAL_LABELS } from "@/lib/signals/kinds";
import { EVENT_LABELS } from "@/lib/usage/events";
import { Card, Stat } from "../ui";
import { DailyBars } from "./charts";
import { SERIES_COLORS } from "./colors";

// The analytics page body, from data already loaded. Kept apart from the loading so it can be
// rendered with sample data.
export function AnalyticsView({
  range,
  withAdmins,
  now,
  allUsers,
  allFirsts,
  events: eventsResult,
  signals: signalsResult,
}: {
  range: RangeKey;
  withAdmins: boolean;
  now: Date;
  allUsers: UserProgress[];
  allFirsts: EventFirst[];
  events: { rows: EventRow[]; truncated: boolean };
  signals: { rows: SignalRow[]; truncated: boolean };
}) {
  const start = rangeStart(range, now);
  // Craig's own testing would swamp a handful of testers, so admin accounts are left out unless
  // asked for.
  const users = withAdmins ? allUsers : allUsers.filter((u) => !isAdminEmail(u.email));
  const ids = new Set(users.map((u) => u.id));
  const firsts = allFirsts.filter((f) => ids.has(f.userId));
  const events = eventsResult.rows.filter((e) => ids.has(e.userId));
  const signals = signalsResult.rows.filter((s) => ids.has(s.userId));
  const hiddenAdmins = allUsers.length - users.length;

  // All time starts at the earliest sign-up or event.
  const firstDay =
    start ??
    new Date(
      [...users.map((u) => u.signedUpAt), ...events.map((e) => e.at)].reduce((min, at) => {
        const t = Date.parse(at);
        return Number.isNaN(t) ? min : Math.min(min, t);
      }, now.getTime()),
    );
  const days = daysBetween(firstDay, now);
  const daily = dailySeries(days, users, events, signals);
  const top = headline(users, events, signals, start);
  const features = featureUsage(events, start);
  const joined = cohort(users, firsts, start);
  const pages = troublePages(signals, start);
  const dayLength = medianDayLengthMs(events, signals, start);
  const rangeLabel = RANGES.find((r) => r.key === range)!.label.toLowerCase();
  const anyEstimated = events.some((e) => e.estimated);
  const maxFeatureUsers = Math.max(1, ...features.map((f) => f.users));

  return (
    <div className="mt-6 space-y-6">
      <Filters range={range} withAdmins={withAdmins} hiddenAdmins={hiddenAdmins} />

      {(eventsResult.truncated || signalsResult.truncated) && (
        <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          There is more activity in this range than the page reads at once, so the numbers below
          are partial. Pick a shorter range.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Active users"
          value={String(top.activeUsers)}
          detail={
            top.returningShare === null
              ? `nobody, ${rangeLabel}`
              : `${top.returningUsers} came back on another day (${percent(top.returningShare)})`
          }
        />
        <Stat label="New sign-ups" value={String(top.signUps)} detail={rangeLabel} />
        <Stat
          label="Stories finished"
          value={String(top.storiesFinished)}
          detail={`${top.storiesStarted} started, ${rangeLabel}`}
        />
        <Stat
          label="Time in the app per visit day"
          value={dayLength === null ? "–" : formatDuration(dayLength)}
          detail="median, first to last activity that day"
        />
      </div>

      <Card
        title="Active users and sign-ups"
        note="Per day (UTC). Active means they did anything recorded: a milestone, a page opened or a click signal."
      >
        <DailyBars
          label="Active users and sign-ups per day"
          days={days}
          series={[
            { name: "Active users", values: daily.map((d) => d.activeUsers) },
            { name: "Sign-ups", values: daily.map((d) => d.signUps) },
          ]}
        />
      </Card>

      <Card
        title="Stories started and finished"
        note={
          anyEstimated
            ? "Per day. Some days include activity from before tracking started, dated from when it was saved."
            : "Per day."
        }
      >
        <DailyBars
          label="Stories started and finished per day"
          days={days}
          series={[
            { name: "Started", values: daily.map((d) => d.storiesStarted) },
            { name: "Finished", values: daily.map((d) => d.storiesFinished) },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="How far new people get"
          note={`The ${joined.users} ${joined.users === 1 ? "person" : "people"} who signed up ${rangeLabel}, and how far each has got since.`}
        >
          {joined.users === 0 ? (
            <p className="text-sm text-slate-600">Nobody signed up in this range.</p>
          ) : (
            <>
              <ol className="space-y-2.5">
                {joined.funnel.map((step, i) => (
                  <li key={step.event}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-slate-800">{EVENT_LABELS[step.event]}</span>
                      <span className="whitespace-nowrap tabular-nums text-slate-700">
                        {step.users}
                        {i > 0 && (
                          <span className="ml-2 text-xs text-slate-500">
                            {percent(step.ofPrevious)} of step before
                          </span>
                        )}
                      </span>
                    </div>
                    <Bar share={step.ofAll} />
                  </li>
                ))}
              </ol>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <TimeTo label="Sign-up to first likely questions" result={joined.toQuestions} />
                <TimeTo label="Sign-up to first finished story" result={joined.toStory} />
              </div>
            </>
          )}
        </Card>

        <Card title="Features used" note={`People who used each feature ${rangeLabel}, and how many times.`}>
          {features.length === 0 ? (
            <p className="text-sm text-slate-600">No activity in this range.</p>
          ) : (
            <ul className="space-y-2.5">
              {features.map((f) => (
                <li key={f.event}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-slate-800">{EVENT_LABELS[f.event]}</span>
                    <span className="whitespace-nowrap tabular-nums text-slate-700">
                      {f.users} {f.users === 1 ? "person" : "people"}
                      <span className="ml-1 text-xs text-slate-500">· {f.times}×</span>
                    </span>
                  </div>
                  <Bar share={f.users / maxFeatureUsers} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="Signs of trouble"
        note="Rage clicks, clicks that did nothing, clicks on disabled buttons, errors shown, page errors and forms left unsent, per day. Recording started Oct 16."
      >
        <DailyBars
          label="Signs of trouble per day"
          days={days}
          series={[{ name: "Signs of trouble", values: daily.map((d) => d.troubleSignals) }]}
        />
        <h3 className="mt-6 text-sm font-semibold text-slate-800">Pages with the most trouble</h3>
        {pages.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">None recorded in this range.</p>
        ) : (
          <div className="-mx-6 mt-2 overflow-x-auto px-6">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-4 font-semibold">Page</th>
                  <th className="py-2 pr-4 text-right font-semibold">Signs</th>
                  <th className="py-2 pr-4 text-right font-semibold">People</th>
                  <th className="py-2 pr-4 text-right font-semibold">Opened</th>
                  <th className="py-2 font-semibold">Most common</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {pages.map((p) => (
                  <tr key={p.path}>
                    <td className="py-2 pr-4 font-mono text-xs">{p.path}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p.trouble}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p.users}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{p.views}</td>
                    <td className="py-2 text-slate-600">{p.topKind ? SIGNAL_LABELS[p.topKind] : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-slate-500">
        Days are UTC. Updated {dayKey(now)} at {now.toISOString().slice(11, 16)} UTC.
      </p>
    </div>
  );
}

function Filters({
  range,
  withAdmins,
  hiddenAdmins,
}: {
  range: RangeKey;
  withAdmins: boolean;
  hiddenAdmins: number;
}) {
  const href = (r: RangeKey, admins: boolean) =>
    `/admin/analytics?range=${r}${admins ? "&admins=1" : ""}`;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <nav aria-label="Date range" className="flex flex-wrap gap-1 rounded-full bg-white p-1 ring-1 ring-black/5">
        {RANGES.map((r) => (
          <Link
            key={r.key}
            href={href(r.key, withAdmins)}
            aria-current={r.key === range ? "true" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              r.key === range ? "bg-ink-900 text-white" : "text-slate-700 hover:bg-ink-50"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </nav>
      <Link
        href={href(range, !withAdmins)}
        className="text-sm font-medium text-ink-800 hover:underline"
      >
        {withAdmins
          ? "Leave out admin accounts"
          : `Include admin accounts${hiddenAdmins > 0 ? ` (${hiddenAdmins} left out)` : ""}`}
      </Link>
    </div>
  );
}

function Bar({ share }: { share: number }) {
  return (
    <span className="mt-1 block h-2 overflow-hidden rounded-full bg-ink-50">
      <span
        className="block h-full rounded-full"
        style={{ width: `${Math.round(share * 100)}%`, backgroundColor: SERIES_COLORS[0] }}
      />
    </span>
  );
}

function TimeTo({ label, result }: { label: string; result: TimeToValue }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-slate-900">
        {result.medianMs === null ? "–" : formatDuration(result.medianMs)}
      </p>
      <p className="text-xs text-slate-500">
        median, {result.reached} of {result.total} got there
        {result.estimated ? " (some times estimated)" : ""}
      </p>
    </div>
  );
}
