import "server-only";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type CoachingStyle, parseCoachingStyle } from "./style";

// The one place app code reads and writes the coaching style, kept on the user's profile row.
// Row-level security limits every query to the signed-in user's own row.

export async function getCoachingStyle(): Promise<CoachingStyle> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("coaching_style").maybeSingle();
  if (error) throw new Error(`Couldn't load your coaching style: ${error.message}`);
  return parseCoachingStyle(data?.coaching_style);
}

// Tone is never worth failing a model step over (say, before the column exists): fall back to the
// default. Read once per request.
export const getCoachingStyleSafely = cache(async (): Promise<CoachingStyle> => {
  try {
    return await getCoachingStyle();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Coaching style: loading failed", err);
    return "balanced";
  }
});

export async function saveCoachingStyle(style: CoachingStyle): Promise<void> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email,
    coaching_style: style === "balanced" ? null : style,
  });
  if (error) throw new Error(`Couldn't save your coaching style: ${error.message}`);
}
