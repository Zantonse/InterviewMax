"use server";

import { unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { getJob, getJobsPrep } from "@/lib/jobs/data";
import { numbersForStory } from "@/lib/numbers/checklist";
import { getNumbersChecklistSafely } from "@/lib/numbers/data";
import { tailorIntro } from "@/lib/stories/builder";
import { builderStage, type TailoredIntro } from "@/lib/stories/content";
import { getStory, updateStory } from "@/lib/stories/data";
import { requiredStoryStatus } from "@/lib/stories/required";
import { REQUIRED_STORY_TYPE_ID, getStoryType } from "@/lib/stories/story-types";
import { MAX_WHY_COMPANY_LENGTH } from "@/lib/stories/tailored";
import { trackEvent } from "@/lib/usage/track";

export type TailorResult = { ok: true; tailored: TailoredIntro } | { ok: false; error: string };

// Writes "Tell me about yourself" for one target job, company first. The user's reason for wanting
// the company is saved before the model call, so it isn't lost if the call fails.
export async function writeTailoredIntro(jobId: string, whyCompany: string): Promise<TailorResult> {
  const why = typeof whyCompany === "string" ? whyCompany.trim() : "";
  if (!why) return fail("Say why you want to work there first.");
  if (why.length > MAX_WHY_COMPANY_LENGTH) {
    return fail(`Keep it under ${MAX_WHY_COMPANY_LENGTH.toLocaleString("en-US")} characters.`);
  }

  try {
    const job = await getJob(String(jobId));
    if (!job) return fail("We couldn't find that job.");
    const { storyId } = await requiredStoryStatus();
    const story = storyId ? await getStory(storyId) : null;
    const storyType = getStoryType(REQUIRED_STORY_TYPE_ID);
    if (!story) return fail("Start Tell me about yourself first.");
    if (builderStage(story.content, storyType) === "core") {
      return fail("Answer the Tell me about yourself questions first, then come back.");
    }

    await saveTailored(story.id, job.id, {
      whyCompany: why,
      draft: story.content.tailored?.[job.id]?.draft,
    });

    const [{ overview }, checklist] = await Promise.all([
      getJobsPrep(),
      getNumbersChecklistSafely(),
    ]);
    const { draft } = await tailorIntro(
      story.content,
      storyType,
      {
        title: job.title,
        company: job.company,
        description: job.description,
        focus: overview?.jobs[job.id]?.focus ?? [],
      },
      why,
      numbersForStory(checklist, REQUIRED_STORY_TYPE_ID),
    );
    const tailored = { whyCompany: why, draft };
    await saveTailored(story.id, job.id, tailored);
    await trackEvent("about_me_tailored");
    return { ok: true, tailored };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Tailored About me: writing failed", err);
    if (err instanceof ModelError) {
      return fail("The writing assistant didn't respond. Try again in a moment.");
    }
    return fail(err instanceof Error ? err.message : "Something went wrong. Try again.");
  }
}

// The closing line: the safe one about the role, or the bolder one about the company. The picked
// one goes in parts.why_here, so practice, the brief and the resume read it like any other script.
export async function pickTailoredClosing(
  jobId: string,
  picked: "role" | "company",
): Promise<TailorResult> {
  if (picked !== "role" && picked !== "company") return fail("Pick a closing line.");
  try {
    const { storyId } = await requiredStoryStatus();
    const story = storyId ? await getStory(storyId) : null;
    const tailored = story?.content.tailored?.[String(jobId)];
    const draft = tailored?.draft;
    if (!story || !tailored || !draft?.closings) return fail("Write it for this job first.");
    const closings = { ...draft.closings, picked };
    const next: TailoredIntro = {
      ...tailored,
      draft: {
        ...draft,
        closings,
        parts: { ...draft.parts, why_here: closings[picked] },
      },
    };
    await saveTailored(story.id, String(jobId), next);
    return { ok: true, tailored: next };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Tailored About me: picking the closing failed", err);
    return fail("Something went wrong. Try again.");
  }
}

// Reads the story again just before saving, so answers changed meanwhile aren't overwritten.
async function saveTailored(storyId: string, jobId: string, tailored: TailoredIntro) {
  const story = await getStory(storyId);
  if (!story) throw new Error("We couldn't find your Tell me about yourself story.");
  const content = {
    ...story.content,
    tailored: { ...story.content.tailored, [jobId]: tailored },
  };
  await updateStory(storyId, { content });
}

function fail(error: string): TailorResult {
  return { ok: false, error };
}
