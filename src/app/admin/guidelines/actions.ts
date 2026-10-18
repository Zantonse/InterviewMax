"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/admin/data";
import { addGuideline, deleteGuideline, updateGuideline } from "@/lib/coaching/admin";
import { checkGuideline } from "@/lib/coaching/guidelines";

export type GuidelineState = { error?: string; saved?: boolean } | null;

// Save, add or delete one section of the coaching guidelines. requireAdmin() 404s anyone else.
export async function saveGuideline(
  _prev: GuidelineState,
  formData: FormData,
): Promise<GuidelineState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  try {
    if (formData.get("intent") === "delete") {
      await deleteGuideline(admin, id);
    } else {
      const checked = checkGuideline({
        title: formData.get("title"),
        body: formData.get("body"),
      });
      if ("error" in checked) return { error: checked.error };
      if (id) await updateGuideline(admin, id, checked);
      else await addGuideline(admin, checked);
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "That didn't save. Try again.",
    };
  }
  refresh();
  return { saved: true };
}
