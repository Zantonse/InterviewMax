import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isInviteCode, parseInviteStatus, type InviteStatus } from "./invite-code";

// The signed-in person's side of 1:1 coaching: whether a coach is on, saying yes to an invite and
// stopping. Row-level security lets a person read only their own coaching row; starting and
// stopping go through accept_coach_invite() and stop_coaching()
// (supabase/migrations/20261119000000_coaching_clients.sql), which also record the usage events.

export type MyCoaching = { coachEmail: string; startedAt: string };

export async function getMyCoaching(): Promise<MyCoaching | null> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("coaching_clients")
    .select("coach_email, started_at, stopped_at")
    .maybeSingle();
  if (error) throw new Error(`Couldn't check your coaching: ${error.message}`);
  if (!data || data.stopped_at) return null;
  return { coachEmail: data.coach_email as string, startedAt: data.started_at as string };
}

// For Settings: before the tables exist (SQL not run yet), nobody is being coached.
export async function getMyCoachingSafely(): Promise<MyCoaching | null> {
  try {
    return await getMyCoaching();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Coaching: loading failed", err);
    return null;
  }
}

export async function inviteStatus(code: string): Promise<InviteStatus> {
  if (!isInviteCode(code)) return "invalid";
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("coach_invite_status", { p_code: code });
  if (error) throw new Error(`Couldn't check the invite: ${error.message}`);
  return parseInviteStatus(data);
}

export async function acceptInvite(code: string): Promise<InviteStatus> {
  if (!isInviteCode(code)) return "invalid";
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_coach_invite", { p_code: code });
  if (error) throw new Error(`Couldn't accept the invite: ${error.message}`);
  return parseInviteStatus(data);
}

export async function stopCoaching(): Promise<void> {
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("stop_coaching");
  if (error) throw new Error(`Couldn't stop coaching: ${error.message}`);
}
