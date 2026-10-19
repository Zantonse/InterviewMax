import "server-only";
import { notFound, unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canUsePromotion } from "./access";
import { parsePlan, type AppMode, type PromotionPlan, type Redaction } from "./content";

// The one place app code reads and writes PromotionMax state, kept on the user's profile row
// (profiles.app_mode and profiles.promotion). Row-level security limits every query to the
// signed-in user's own row. While it's in beta, only admins get promotion mode; for everyone else
// the app reads as InterviewMax whatever the row says.

// 404s anyone who can't use PromotionMax yet, so the pages' existence isn't revealed.
export async function requirePromotion(): Promise<void> {
  const user = await getCurrentUser();
  if (!canUsePromotion(user.email)) notFound();
}

export const getAppMode = cache(async (): Promise<AppMode> => {
  const user = await getCurrentUser();
  if (!canUsePromotion(user.email)) return "interview";
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("profiles").select("app_mode").maybeSingle();
    if (error) throw new Error(error.message);
    return data?.app_mode === "promotion" ? "promotion" : "interview";
  } catch (err) {
    unstable_rethrow(err);
    // Before the column exists, or if it can't be read, the app stays InterviewMax.
    console.error("App mode: loading failed", err);
    return "interview";
  }
});

export async function saveAppMode(mode: AppMode): Promise<void> {
  const user = await getCurrentUser();
  if (!canUsePromotion(user.email)) throw new Error("PromotionMax isn't open yet.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email, app_mode: mode === "promotion" ? mode : null });
  if (error) throw new Error(`Couldn't switch modes: ${error.message}`);
}

export async function getPromotionPlan(): Promise<PromotionPlan> {
  await requirePromotion();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("promotion").maybeSingle();
  if (error) throw new Error(`Couldn't load your promotion plan: ${error.message}`);
  return parsePlan(data?.promotion);
}

export async function savePromotionPlan(plan: PromotionPlan): Promise<void> {
  await requirePromotion();
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email, promotion: plan });
  if (error) throw new Error(`Couldn't save your promotion plan: ${error.message}`);
}

// The names every model step redacts before sending. Never worth failing a step over: with no
// access, no column or no list, nothing is redacted. Read once per request.
export const getRedactionsSafely = cache(async (): Promise<Redaction[]> => {
  try {
    const user = await getCurrentUser();
    if (!canUsePromotion(user.email)) return [];
    const supabase = await createClient();
    const { data, error } = await supabase.from("profiles").select("promotion").maybeSingle();
    if (error) throw new Error(error.message);
    return parsePlan(data?.promotion).redactions;
  } catch (err) {
    unstable_rethrow(err);
    console.error("Redactions: loading failed", err);
    return [];
  }
});
