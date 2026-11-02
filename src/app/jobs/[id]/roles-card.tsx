import Link from "next/link";
import type { TargetJob } from "@/lib/jobs/data";
import { levelLabel } from "@/lib/jobs/content";
import { MAX_OTHER_ROLES, roleDifference } from "@/lib/jobs/roles";
import { makeMainRole, removeJobRole } from "../actions";
import { PendingButton } from "../forms";

// The roles in a job that holds several at one company: the main role the prep aims at, the
// others, and how each other posting differs from the main one (the changed lines, with the
// changed words marked). Plain code, no model call.
export function RolesCard({ job }: { job: TargetJob }) {
  const company = job.company || "this company";
  return (
    <section
      id="roles"
      className="scroll-mt-20 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
      data-testid="job-roles"
    >
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-800">
        Your roles at {company}
      </h2>
      <p className="mb-4 text-sm text-slate-600">
        One interview process, one prep. Your questions and stories aim at the main role, so
        you&apos;re ready for its bar and the others&apos; too.
      </p>
      <ul className="space-y-2">
        <li className="flex flex-wrap items-center gap-2 rounded-2xl bg-ink-50 px-4 py-3 ring-1 ring-ink-800/10">
          <span className="font-semibold text-slate-900">{job.title}</span>
          <span className="rounded-full bg-ink-800 px-2.5 py-0.5 text-xs font-semibold text-white">
            Main role
          </span>
          {levelLabel(job.level) && (
            <span className="text-sm text-slate-600">{levelLabel(job.level)}</span>
          )}
        </li>
        {job.otherRoles.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-black/5"
          >
            <span className="font-semibold text-slate-900">{r.title}</span>
            {levelLabel(r.level) && (
              <span className="text-sm text-slate-600">{levelLabel(r.level)}</span>
            )}
            <span className="ml-auto flex flex-wrap items-center gap-3">
              <form action={makeMainRole}>
                <input type="hidden" name="jobId" value={job.id} />
                <input type="hidden" name="roleId" value={r.id} />
                <PendingButton
                  pendingText="Switching and predicting again…"
                  className="text-sm font-semibold text-ink-800 hover:underline disabled:opacity-60"
                >
                  Make main
                </PendingButton>
              </form>
              <form action={removeJobRole}>
                <input type="hidden" name="jobId" value={job.id} />
                <input type="hidden" name="roleId" value={r.id} />
                <PendingButton
                  pendingText="Removing…"
                  className="text-sm font-medium text-slate-500 hover:text-red-700"
                >
                  Remove
                </PendingButton>
              </form>
            </span>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 text-sm font-bold text-slate-900">How the roles differ</h3>
      <div className="mt-2 space-y-4">
        {job.otherRoles.map((r) => {
          const diff = roleDifference(r.description, job.description);
          return (
            <div key={r.id} data-testid="role-difference">
              <p className="text-sm font-semibold text-slate-700">
                {r.title} <span className="font-normal text-slate-500">compared with the main role</span>
              </p>
              {diff.lines.length === 0 ? (
                <p className="mt-1 text-sm text-slate-600">The posting is the same.</p>
              ) : (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {diff.lines.map((segments, i) => (
                    <li key={i}>
                      {segments.map((s, j) =>
                        s.changed ? (
                          <mark key={j} className="rounded bg-amber-100 px-0.5 text-slate-900">
                            {s.text}
                          </mark>
                        ) : (
                          <span key={j}>{s.text}</span>
                        ),
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {(diff.same > 0 || diff.more) && (
                <p className="mt-1 text-xs text-slate-500">
                  {diff.more ? "More lines differ; open the posting for all of them. " : ""}
                  {diff.same > 0 &&
                    `${diff.same} other ${diff.same === 1 ? "line is" : "lines are"} word for word the same.`}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {job.otherRoles.length < MAX_OTHER_ROLES && !job.outcome && (
        <Link
          href={`/jobs/new?to=${job.id}`}
          className="mt-5 inline-block text-sm font-semibold text-ink-800 hover:underline"
        >
          + Add another role
        </Link>
      )}
    </section>
  );
}
