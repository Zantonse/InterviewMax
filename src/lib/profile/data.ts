import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseStoredProfile, type StoredProfile } from "./content";

// The one place app code reads and writes the interviewee profile's stored part, kept on the
// user's own profile row (profiles.interviewee_profile). Row-level security limits both queries to
// the signed-in user's own row. Private to the user: the admin panel never reads this column.

export async function getStoredProfile(): Promise<StoredProfile> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("interviewee_profile").maybeSingle();
  if (error) throw new Error(`Couldn't load your profile: ${error.message}`);
  return parseStoredProfile(data?.interviewee_profile);
}

export async function saveStoredProfile(stored: StoredProfile): Promise<void> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email, interviewee_profile: stored });
  if (error) throw new Error(`Couldn't save your profile: ${error.message}`);
}
