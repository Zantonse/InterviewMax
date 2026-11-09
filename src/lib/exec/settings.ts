import "server-only";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// "Exec mode" (Settings): whether the user sees the Exec version card on their written stories.
// Off by default. Kept on the user's profile row (profiles.exec_mode); row-level security limits
// every query to their own row.

async function getExecMode(): Promise<boolean> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("exec_mode").maybeSingle();
  if (error) throw new Error(`Couldn't load exec mode: ${error.message}`);
  return data?.exec_mode === true;
}

// Off when it can't be read (say, before the column exists). Read once per request.
export const getExecModeSafely = cache(async (): Promise<boolean> => {
  try {
    return await getExecMode();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Exec mode: loading failed", err);
    return false;
  }
});

export async function saveExecMode(on: boolean): Promise<void> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email, exec_mode: on });
  if (error) throw new Error(`Couldn't save exec mode: ${error.message}`);
}
