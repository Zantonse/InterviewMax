"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { saveAssessment } from "@/lib/assessment/data";
import { parseAnswers } from "@/lib/assessment/journey";
import { trackEvent } from "@/lib/usage/track";

export type SubmitResult = { ok: true; saved: boolean } | { ok: false; error: string };

// Saves the quiz answers. The grade is worked out from them in code, so even when saving fails the
// user still sees their grade and next step; they'd just be asked again next time.
export async function submitAssessment(raw: unknown): Promise<SubmitResult> {
  const answers = parseAnswers(raw);
  if (!answers) return { ok: false, error: "Answer all five questions first." };
  try {
    await saveAssessment({ answers, completedAt: new Date().toISOString() });
    await trackEvent("assessment_done");
    return { ok: true, saved: true };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Assessment: saving failed", err);
    return { ok: true, saved: false };
  }
}

// "Skip for now": remembered so a new user isn't sent back to the quiz, and they land on the
// value-first home page (paste a job, see likely questions).
export async function skipAssessment() {
  try {
    await saveAssessment({ skippedAt: new Date().toISOString() });
  } catch (err) {
    unstable_rethrow(err);
    console.error("Assessment: saving the skip failed", err);
  }
  redirect("/");
}
