"use server";

import { unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import { getJob, saveResumeBullets } from "@/lib/jobs/data";
import { numbersForStory } from "@/lib/numbers/checklist";
import { getNumbersChecklistSafely } from "@/lib/numbers/data";
import { buildResumeSet } from "@/lib/resume/build";
import { parseBullets, type ResumeBullet, type ResumeSet } from "@/lib/resume/content";
import { allAnswerText } from "@/lib/stories/content";
import { listStories } from "@/lib/stories/data";
import { untracedNumbers } from "@/lib/stories/numbers";
import { trackEvent } from "@/lib/usage/track";

export type ResumeResult = { ok: true; value: ResumeSet } | { ok: false; error: string };

// Writes the resume bullets for one job from the user's finished stories (a model call).
export async function buildResume(jobId: string): Promise<ResumeResult> {
  try {
    const value = await buildResumeSet(String(jobId));
    await trackEvent("resume_bullets_made");
    return { ok: true, value };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Resume enhancer: writing failed", err);
    if (err instanceof ModelError) {
      return { ok: false, error: "The assistant didn't respond. Try again in a moment." };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong. Try again.",
    };
  }
}

// Saves the bullets as the user left them: picked or not, edited, in their order. An edited
// bullet's figures are checked against its story again, so a typo'd number gets flagged.
export async function saveResume(jobId: string, bullets: unknown): Promise<ResumeResult> {
  try {
    const job = await getJob(String(jobId));
    if (!job?.resumeBullets) return { ok: false, error: "We couldn't find those bullets." };
    // Only the bullets written for this set, with their story, fit and reason as written: the
    // browser can reorder, pick and edit the text, nothing else.
    const before = new Map(job.resumeBullets.bullets.map((b) => [b.id, b]));
    const list = parseBullets(bullets).flatMap((b): ResumeBullet[] => {
      const was = before.get(b.id);
      if (!was) return [];
      return [
        {
          id: was.id,
          storyId: was.storyId,
          storyTitle: was.storyTitle,
          role: b.role,
          text: b.text,
          fit: was.fit,
          why: was.why,
          picked: b.picked,
          untracedNumbers: was.untracedNumbers,
          ...(was.edited ? { edited: true } : {}),
        },
      ];
    });
    if (list.length === 0) return { ok: false, error: "Keep at least one bullet." };

    const edited = list.filter((b) => before.get(b.id)!.text !== b.text);
    if (edited.length > 0) {
      const [stories, checklist] = await Promise.all([listStories(), getNumbersChecklistSafely()]);
      for (const b of edited) {
        const story = stories.find((s) => s.id === b.storyId);
        const values = numbersForStory(checklist, story?.storyType).flatMap((n) =>
          n.value ? [n.value] : [],
        );
        const source = [story ? allAnswerText(story.content) : "", ...values].join("\n");
        b.untracedNumbers = untracedNumbers(b.text, source);
        b.edited = true;
      }
    }
    const value: ResumeSet = { ...job.resumeBullets, bullets: list };
    await saveResumeBullets(job.id, value);
    return { ok: true, value };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Resume enhancer: saving failed", err);
    return { ok: false, error: "Your change couldn't be saved. Try again." };
  }
}
