import "server-only";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  type FieldId,
  MAX_FIELD_NAME_LENGTH,
  type UserField,
  guessField,
  parseFieldId,
} from "./fields";

// The one place app code reads and writes the user's field, kept on their profile row
// (profiles.role_field, plus role_field_name for "other"). Row-level security limits every query
// to the signed-in user's own row. Without a saved field, a guess from their target job titles
// stands in, marked as guessed.

async function savedField(): Promise<{ id: FieldId | null; name: string | null }> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("role_field, role_field_name")
    .maybeSingle();
  if (error) throw new Error(`Couldn't load your field: ${error.message}`);
  return {
    id: parseFieldId(data?.role_field),
    name: typeof data?.role_field_name === "string" ? data.role_field_name : null,
  };
}

async function guessFromJobs(): Promise<FieldId | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("target_jobs")
    .select("title")
    .order("created_at", { ascending: false })
    .limit(20);
  return guessField((data ?? []).map((row) => (row as { title?: string | null }).title));
}

export async function getUserField(): Promise<UserField> {
  const saved = await savedField();
  if (saved.id) return { id: saved.id, name: saved.name, guessed: false };
  const guess = await guessFromJobs();
  return { id: guess ?? "generic", name: null, guessed: true };
}

// The field is never worth failing a page or a model step over (say, before the column exists):
// fall back to general. Read once per request.
export const getUserFieldSafely = cache(async (): Promise<UserField> => {
  try {
    return await getUserField();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Field: loading failed", err);
    return { id: "generic", name: null, guessed: true };
  }
});

export async function saveUserField(id: FieldId, name: string | null): Promise<void> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const cleaned = id === "other" ? (name ?? "").trim().slice(0, MAX_FIELD_NAME_LENGTH) : "";
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email,
    role_field: id,
    role_field_name: cleaned || null,
  });
  if (error) throw new Error(`Couldn't save your field: ${error.message}`);
}
