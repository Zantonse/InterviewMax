"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/admin/data";
import { CoachingSetupError, createInvite, revokeInvite } from "@/lib/coaching/clients";
import { cleanLabel, invitePath } from "@/lib/coaching/invite-code";

export type InviteState = { error?: string; link?: string; label?: string } | null;

// Makes a one-time invite link. The link is returned once and never stored, only its hash.
// requireAdmin() 404s anyone else.
export async function makeInvite(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const admin = await requireAdmin();
  const label = cleanLabel(formData.get("label"));
  if (!label) return { error: "Say who it's for, e.g. Kevin. Only you see this." };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  try {
    const code = await createInvite(admin, label);
    refresh();
    return { link: `${host ? `${proto}://${host}` : ""}${invitePath(code)}`, label };
  } catch (err) {
    if (err instanceof CoachingSetupError) return { error: err.message };
    console.error("Coaching: making an invite failed", err);
    return { error: "That didn't work. Try again." };
  }
}

export async function cancelInvite(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  await revokeInvite(admin, String(formData.get("id") ?? ""));
  refresh();
}
