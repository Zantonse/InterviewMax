"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { saveAssessment } from "@/lib/assessment/data";
import { type Answers, parseAnswers } from "@/lib/assessment/journey";
import { saveCoachingStyle } from "@/lib/coaching/data";
import { COACHING_STYLES, type CoachingStyle } from "@/lib/coaching/style";
import { getUserFieldSafely, saveUserField } from "@/lib/field/data";
import { parseFieldId } from "@/lib/field/fields";
import { trackEvent } from "@/lib/usage/track";

export type SubmitResult =
  | { ok: true; saved: boolean; answers: Answers }
  | { ok: false; error: string };

// Saves the quiz answers, plus the field and coaching style picked in it (to the same settings as
// the Settings page). Where to start is worked out from the answers in code, so even when saving
// fails the user still sees it; they'd just be asked again next time.
export async function submitAssessment(raw: unknown): Promise<SubmitResult> {
  const answers = parseAnswers(raw);
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const field = parseFieldId(source.field);
  const style = (COACHING_STYLES as readonly unknown[]).includes(source.coachingStyle)
    ? (source.coachingStyle as CoachingStyle)
    : null;
  if (!answers || !field || !style) return { ok: false, error: "Answer every question first." };

  await Promise.all([saveFieldIfChanged(field), saveStyle(style)]);
  try {
    await saveAssessment({ answers, completedAt: new Date().toISOString() });
    await trackEvent("assessment_done");
    return { ok: true, saved: true, answers };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Assessment: saving failed", err);
    return { ok: true, saved: false, answers };
  }
}

// Picking the field they already saved keeps the name they typed for "Something else".
async function saveFieldIfChanged(field: NonNullable<ReturnType<typeof parseFieldId>>) {
  try {
    const current = await getUserFieldSafely();
    if (!current.guessed && current.id === field) return;
    await saveUserField(field, null);
  } catch (err) {
    unstable_rethrow(err);
    console.error("Assessment: saving the field failed", err);
  }
}

async function saveStyle(style: CoachingStyle) {
  try {
    await saveCoachingStyle(style);
  } catch (err) {
    unstable_rethrow(err);
    console.error("Assessment: saving the coaching style failed", err);
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
