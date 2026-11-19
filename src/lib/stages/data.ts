import "server-only";
import type { TargetJob } from "@/lib/jobs/data";
import { listTranscriptsForPrep } from "@/lib/transcripts/data";
import { buildTimeline } from "@/lib/transcripts/timeline";
import { stageFor } from "./stages";

// The stage to prep a job for: the one the user set, else the stage the interview timeline expects
// next from their past interviews there (read only when nothing is set).
export async function stageForJob(
  job: Pick<TargetJob, "id" | "company" | "nextStage">,
): Promise<ReturnType<typeof stageFor>> {
  if (job.nextStage) return stageFor(job.nextStage, null);
  const timeline = buildTimeline(job, await listTranscriptsForPrep());
  return stageFor(null, timeline.next.id);
}
