"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLevel } from "@/lib/jobs/content";
import { buildPacket, readLadder } from "@/lib/promotion/build";
import { MIN_LADDER_LENGTH, nextLevel, parseRedactionLines } from "@/lib/promotion/content";
import { getPromotionPlan, saveAppMode, savePromotionPlan } from "@/lib/promotion/data";
import { setCoachSharing } from "@/lib/stories/data";

export type FormState = { error?: string; saved?: boolean } | null;

// The Interview / Promotion switch in the sidebar. Each mode opens on its own home.
export async function switchMode(formData: FormData) {
  const mode = formData.get("mode") === "promotion" ? "promotion" : "interview";
  await saveAppMode(mode);
  revalidatePath("/", "layout");
  redirect(mode === "promotion" ? "/promotion" : "/");
}

export async function saveLevels(_prev: FormState, formData: FormData): Promise<FormState> {
  const current = formData.get("currentLevel");
  const target = formData.get("targetLevel");
  if (!isLevel(current)) return { error: "Pick your current level." };
  const targetLevel = isLevel(target) ? target : nextLevel(current);
  try {
    const plan = await getPromotionPlan();
    await savePromotionPlan({ ...plan, currentLevel: current, targetLevel });
  } catch (err) {
    console.error("Promotion: saving levels failed", err);
    return { error: "That didn't save. Try again." };
  }
  revalidatePath("/promotion");
  return { saved: true };
}

export async function saveLadder(_prev: FormState, formData: FormData): Promise<FormState> {
  const text = String(formData.get("ladder") ?? "").trim();
  if (text.length < MIN_LADDER_LENGTH) {
    return { error: "Paste a bit more of the ladder: what each level is expected to do." };
  }
  try {
    const plan = await getPromotionPlan();
    if (!plan.targetLevel) return { error: "Pick the level you're going for first." };
    await readLadder(text, plan.targetLevel);
  } catch (err) {
    console.error("Promotion: reading the ladder failed", err);
    return {
      error: err instanceof Error ? err.message : "Reading the ladder didn't work. Try again.",
    };
  }
  revalidatePath("/promotion");
  return { saved: true };
}

export async function clearLadder() {
  const plan = await getPromotionPlan();
  await savePromotionPlan({ ...plan, ladder: undefined });
  revalidatePath("/promotion");
}

export async function saveRedactions(_prev: FormState, formData: FormData): Promise<FormState> {
  const redactions = parseRedactionLines(String(formData.get("redactions") ?? ""));
  try {
    const plan = await getPromotionPlan();
    await savePromotionPlan({ ...plan, redactions });
  } catch (err) {
    console.error("Promotion: saving redactions failed", err);
    return { error: "That didn't save. Try again." };
  }
  revalidatePath("/promotion");
  return { saved: true };
}

export async function writePacket(): Promise<FormState> {
  try {
    await buildPacket();
  } catch (err) {
    console.error("Promotion: writing the packet failed", err);
    return {
      error: err instanceof Error ? err.message : "Writing the packet didn't work. Try again.",
    };
  }
  revalidatePath("/promotion/packet");
  return { saved: true };
}

export async function shareWithCoach(formData: FormData) {
  const id = String(formData.get("storyId") ?? "");
  await setCoachSharing(id, formData.get("shared") === "true");
  revalidatePath(`/stories/${id}`);
}
