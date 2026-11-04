"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { deleteAuth0Users } from "@/lib/auth0/management";
import { authProvider } from "@/lib/auth0/provider";
import { saveCoachingStyle } from "@/lib/coaching/data";
import { type CoachingStyle, parseCoachingStyle } from "@/lib/coaching/style";
import { saveUserField } from "@/lib/field/data";
import { type FieldId, parseFieldId } from "@/lib/field/fields";
import { DELETE_CONFIRM_WORD as CONFIRM_WORD } from "@/lib/privacy/contact";
import { createClient } from "@/lib/supabase/server";

export type DeleteState = { error?: string } | null;
export type StyleState = { error?: string; saved?: CoachingStyle } | null;
export type FieldState = { error?: string; saved?: { id: FieldId; name: string | null } } | null;

// Saves how the coach talks to the user (tone only; see src/lib/coaching/style.ts).
export async function saveStyle(_prev: StyleState, formData: FormData): Promise<StyleState> {
  const style = parseCoachingStyle(formData.get("style"));
  try {
    await saveCoachingStyle(style);
  } catch (err) {
    console.error("Coaching style: saving failed", err);
    return { error: "That didn't save. Try again." };
  }
  return { saved: style };
}

// Saves the user's field (see src/lib/field/fields.ts).
export async function saveField(_prev: FieldState, formData: FormData): Promise<FieldState> {
  const id = parseFieldId(formData.get("field"));
  if (!id) return { error: "Pick your field first." };
  const name = id === "other" ? String(formData.get("name") ?? "").trim() : "";
  if (id === "other" && !name) return { error: "Type your field, e.g. Revenue operations." };
  try {
    await saveUserField(id, name || null);
  } catch (err) {
    console.error("Field: saving failed", err);
    return { error: "That didn't save. Try again." };
  }
  return { saved: { id, name: name || null } };
}

// Deletes the signed-in person's account and everything tied to it (PRD v0.3, "Delete account
// and data"). Auth0 sign-ins go first: if Auth0 refuses, nothing is deleted and they can try
// again. Then one database call deletes every row (supabase/migrations/20261015000000_delete_account.sql),
// and they're signed out.
export async function deleteAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== CONFIRM_WORD) {
    return { error: `Type “${CONFIRM_WORD}” to confirm.` };
  }
  await getCurrentUser();
  const supabase = await createClient();

  const { data: signInIds, error: idsError } = await supabase.rpc("my_sign_in_ids");
  if (idsError) {
    console.error("Delete account: reading sign-ins failed:", idsError.message);
    return { error: "We couldn't delete your account. Nothing was deleted; please try again." };
  }
  try {
    await deleteAuth0Users(Array.isArray(signInIds) ? signInIds.map(String) : []);
  } catch (err) {
    console.error("Delete account: Auth0 failed:", err instanceof Error ? err.message : err);
    return { error: "We couldn't delete your account. Nothing was deleted; please try again." };
  }

  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    console.error("Delete account: database delete failed:", error.message);
    return {
      error:
        "Your sign-in was removed, but deleting your data didn't finish. Please try again now, before leaving this page.",
    };
  }

  if (authProvider() === "auth0") {
    // Auth0's logout route clears the session cookie and ends the Auth0 sign-in.
    redirect("/auth/logout");
  }
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // The account is already gone; clearing the cookie is all that's left, and signOut did that.
  }
  redirect("/account-deleted");
}
