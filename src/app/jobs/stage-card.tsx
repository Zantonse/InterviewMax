import { outcomeLabel } from "@/lib/jobs/outcome";
import { STAGES_REACHED, type StageReachedId } from "@/lib/jobs/stage-reached";
import type { StageGuess } from "@/lib/jobs/stage-guess";
import { saveStageReached } from "./actions";

export type MissingStageJob = {
  id: string;
  title: string;
  company: string | null;
  outcome: string | null;
  guess: StageGuess | null;
};

// "Where did these end?": each finished job with no stage yet, with one tap per job to say where
// its interviews stopped. The app's guess (from the job's interviews or the round's name) is marked
// but never saved until the user taps it. The job map and ceiling check need these stages.
export function WhereDidTheseEnd({ jobs }: { jobs: MissingStageJob[] }) {
  if (jobs.length === 0) return null;
  return (
    <section
      className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5"
      data-testid="stage-card"
    >
      <h2 className="text-lg font-bold text-slate-900">Where did these end? One tap each</h2>
      <p className="mt-1 text-slate-600">
        Tap the last stage you had at each job. Once two or more have a stage, I can tell you where
        your interviews tend to stop and what to work on.
        {jobs.some((j) => j.guess) &&
          " “My guess” comes from your interviews or the round's name; nothing is saved until you tap."}
      </p>
      <ul className="mt-4 divide-y divide-slate-100" data-testid="stage-card-jobs">
        {jobs.slice(0, SHOWN).map((job) => (
          <StageRow key={job.id} job={job} />
        ))}
      </ul>
      {jobs.length > SHOWN && (
        <details className="group mt-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-ink-800 hover:underline [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Show {jobs.length - SHOWN} more</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul className="mt-3 divide-y divide-slate-100">
            {jobs.slice(SHOWN).map((job) => (
              <StageRow key={job.id} job={job} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

// Jobs shown before "Show more", so the card doesn't push the open jobs off the screen.
const SHOWN = 4;

function StageRow({ job }: { job: MissingStageJob }) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <p className="font-semibold text-slate-900">
        {job.title}
        {job.company && <span className="font-normal text-slate-600"> at {job.company}</span>}
        <span className="ml-2 text-xs font-medium text-slate-500">{outcomeLabel(job.outcome)}</span>
      </p>
      <form action={saveStageReached} className="mt-2 flex flex-wrap gap-2">
        <input type="hidden" name="jobId" value={job.id} />
        {STAGES_REACHED.map((st) => (
          <StageChip key={st.id} stage={st} guess={job.guess?.stage === st.id} />
        ))}
      </form>
    </li>
  );
}

function StageChip({
  stage,
  guess,
}: {
  stage: { id: StageReachedId; label: string; short: string };
  guess: boolean;
}) {
  return (
    <button
      type="submit"
      name="stageReached"
      value={stage.id}
      className={`rounded-full px-3 py-1.5 text-sm font-medium transition hover:bg-ink-50 hover:ring-ink-700 ${
        guess
          ? "bg-ink-50 text-ink-900 ring-2 ring-ink-700/50"
          : "text-slate-800 ring-1 ring-slate-300"
      }`}
      data-testid={guess ? "stage-chip-guess" : "stage-chip"}
    >
      <span className="sm:hidden">{stage.short}</span>
      <span className="hidden sm:inline">{stage.label}</span>
      {guess && <span className="ml-1 text-xs font-semibold text-ink-800">· my guess</span>}
    </button>
  );
}
