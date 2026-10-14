import "server-only";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type Assessment, parseAssessment } from "./journey";

// The one place app code reads and writes the intake assessment, kept on the user's profile row.
// Row-level security limits every query to the signed-in user's own rows.

export async function getAssessment(): Promise<Assessment | null> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("intake_assessment").maybeSingle();
  if (error) throw new Error(`Couldn't load your assessment: ${error.message}`);
  return parseAssessment(data?.intake_assessment);
}

// The assessment is background outside its own page, so a failure to load it (say, before the
// column exists) never blocks anything. Read once per request; home asks twice.
export const getAssessmentSafely = cache(async (): Promise<Assessment | null | undefined> => {
  try {
    return await getAssessment();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Assessment: loading failed", err);
    return undefined;
  }
});

export async function saveAssessment(assessment: Assessment): Promise<void> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email, intake_assessment: assessment });
  if (error) throw new Error(`Couldn't save your assessment: ${error.message}`);
}

// A brand-new user (no jobs, no stories) who hasn't taken or skipped the assessment starts there.
// Anyone who already has prep in the app, or whose assessment can't be read, goes straight home.
export async function shouldStartWithAssessment(): Promise<boolean> {
  const assessment = await getAssessmentSafely();
  if (assessment !== null) return false;
  try {
    const supabase = await createClient();
    const [jobs, stories] = await Promise.all([
      supabase.from("target_jobs").select("id", { count: "exact", head: true }),
      supabase.from("stories").select("id", { count: "exact", head: true }),
    ]);
    if (jobs.error || stories.error) return false;
    return jobs.count === 0 && stories.count === 0;
  } catch (err) {
    unstable_rethrow(err);
    console.error("Assessment: checking for a new user failed", err);
    return false;
  }
}
