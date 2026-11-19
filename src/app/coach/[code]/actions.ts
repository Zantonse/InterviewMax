"use server";

import { redirect } from "next/navigation";
import { acceptInvite } from "@/lib/coaching/relationship";
import { INVITE_PROBLEMS } from "@/lib/coaching/invite-code";

export type AcceptState = { error?: string } | null;

// Says yes to a coaching invite, then opens Settings where coaching shows as on.
export async function accept(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
  const code = String(formData.get("code") ?? "");
  let status;
  try {
    status = await acceptInvite(code);
  } catch (err) {
    console.error("Coaching: accepting an invite failed", err);
    return { error: "That didn't work. Try again." };
  }
  if (status !== "ok") return { error: INVITE_PROBLEMS[status] };
  redirect("/settings?coaching=on#coaching");
}
