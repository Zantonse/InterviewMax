"use server";

import { unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";
import { canUseCurriculum } from "@/lib/curriculum/access";
import { buildCurriculum } from "@/lib/curriculum/build";
import { isConfidence, withConfidence, type Curriculum } from "@/lib/curriculum/content";
import { getJob, saveCurriculum } from "@/lib/jobs/data";
import { trackEvent } from "@/lib/usage/track";

export type CurriculumResult = { ok: true; value: Curriculum } | { ok: false; error: string };

async function allowed(): Promise<boolean> {
  const user = await getCurrentUser();
  return canUseCurriculum(user.email);
}

// Writes (or rewrites) the curriculum for one job (a model call). The user's marks carry over.
export async function makeCurriculum(jobId: string): Promise<CurriculumResult> {
  try {
    if (!(await allowed())) return { ok: false, error: "The curriculum is in beta." };
    const value = await buildCurriculum(String(jobId));
    await trackEvent("curriculum_made");
    return { ok: true, value };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Curriculum: writing failed", err);
    if (err instanceof ModelError) {
      return {
        ok: false,
        error: "The assistant didn't respond. Try again in a moment.",
      };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong. Try again.",
    };
  }
}

// Saves how well the user knows one topic (or clears the mark, with null).
export async function markTopic(
  jobId: string,
  topicId: string,
  confidence: unknown,
): Promise<CurriculumResult> {
  try {
    if (!(await allowed())) return { ok: false, error: "The curriculum is in beta." };
    const job = await getJob(String(jobId));
    if (!job?.curriculum) return { ok: false, error: "We couldn't find that curriculum." };
    const value: Curriculum = {
      ...job.curriculum,
      topics: job.curriculum.topics.map((t) =>
        t.id === topicId ? withConfidence(t, isConfidence(confidence) ? confidence : undefined) : t,
      ),
    };
    await saveCurriculum(job.id, value);
    return { ok: true, value };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Curriculum: saving a mark failed", err);
    return { ok: false, error: "Your change couldn't be saved. Try again." };
  }
}
