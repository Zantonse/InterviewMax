"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/admin/data";
import { approveQuestion, rejectQuestion } from "@/lib/bank/admin";

export type ReviewState = { error?: string } | null;

// Approve (with any edits) or reject one shared question. requireAdmin() 404s anyone else.
export async function reviewQuestion(_prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  try {
    if (formData.get("decision") === "reject") await rejectQuestion(admin, id);
    else await approveQuestion(admin, id, String(formData.get("question") ?? ""));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "That didn't save. Try again." };
  }
  refresh();
  return null;
}
