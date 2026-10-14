import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { type NumbersChecklist, parseChecklist } from "./checklist";

// The one place app code reads and writes the numbers checklist, kept on the user's profile row.
// Row-level security limits both queries to the signed-in user's own row.

export async function getNumbersChecklist(): Promise<NumbersChecklist | null> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("numbers_checklist").maybeSingle();
  if (error) throw new Error(`Couldn't load your numbers: ${error.message}`);
  return parseChecklist(data?.numbers_checklist);
}

// For the story builder and the home page: the checklist is background there, so a failure to load
// it (say, before the column exists) never blocks them.
export async function getNumbersChecklistSafely(): Promise<NumbersChecklist | null> {
  try {
    return await getNumbersChecklist();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Numbers checklist: loading failed", err);
    return null;
  }
}

export async function saveNumbersChecklist(checklist: NumbersChecklist): Promise<void> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, email: user.email, numbers_checklist: checklist });
  if (error) throw new Error(`Couldn't save your numbers: ${error.message}`);
}
