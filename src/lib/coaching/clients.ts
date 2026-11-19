import "server-only";
import { createHash } from "node:crypto";
import { isUserId, type Admin } from "@/lib/admin/data";
import { parseItems, type PracticeItem } from "@/lib/practice/content";
import { parseAnalysis } from "@/lib/transcripts/content";
import type { ProfileTranscript } from "@/lib/transcripts/profile";
import type { ViewJob } from "./client-view";
import { INVITE_DAYS, newInviteCode } from "./invite-code";

// The coach's side of 1:1 coaching (2026-11-19): invites, the client list and what the client page
// reads. Every function takes the Admin that requireAdmin() returned; callers log the view first.
// A client's data is only read while they have said yes and not stopped (isActiveClient). Never
// uploads: transcripts are read for their saved review only, not their text.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNDEFINED_TABLE = "42P01";

export class CoachingSetupError extends Error {}

function setupCheck(error: { code?: string; message: string } | null, what: string) {
  if (!error) return;
  if (error.code === UNDEFINED_TABLE || /coach_invites|coaching_clients/.test(error.message)) {
    throw new CoachingSetupError(
      "Run coaching-clients/run-in-supabase.sql in the Supabase SQL editor to turn on 1:1 coaching.",
    );
  }
  throw new Error(`Couldn't load ${what}: ${error.message}`);
}

export function hashInviteCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

// Makes a one-time invite and returns its code. Only the hash is stored, so the link is shown once.
export async function createInvite(admin: Admin, label: string): Promise<string> {
  const code = newInviteCode();
  const { error } = await admin.supabase.from("coach_invites").insert({
    code_hash: hashInviteCode(code),
    label,
    created_by: admin.email,
    expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
  });
  setupCheck(error, "invites");
  return code;
}

export type PendingInvite = { id: string; label: string; createdAt: string; expiresAt: string };

// Invites nobody has used yet that still work.
export async function listPendingInvites(admin: Admin): Promise<PendingInvite[]> {
  const { data, error } = await admin.supabase
    .from("coach_invites")
    .select("id, label, created_at, expires_at")
    .is("used_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  setupCheck(error, "invites");
  return (data as { id: string; label: string; created_at: string; expires_at: string }[]).map(
    (row) => ({ id: row.id, label: row.label, createdAt: row.created_at, expiresAt: row.expires_at }),
  );
}

export async function revokeInvite(admin: Admin, id: string): Promise<void> {
  if (!UUID_RE.test(id)) return;
  const { error } = await admin.supabase
    .from("coach_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("used_at", null);
  setupCheck(error, "invites");
}

export type Client = {
  userId: string;
  email: string;
  label: string;
  startedAt: string;
  stoppedAt: string | null;
};

type ClientRow = {
  user_id: string;
  started_at: string;
  stopped_at: string | null;
  profiles: { email: string | null } | null;
  coach_invites: { label: string | null } | null;
};

function toClient(row: ClientRow): Client {
  return {
    userId: row.user_id,
    email: row.profiles?.email ?? "",
    label: row.coach_invites?.label ?? "",
    startedAt: row.started_at,
    stoppedAt: row.stopped_at,
  };
}

const CLIENT_COLUMNS = "user_id, started_at, stopped_at, profiles(email), coach_invites(label)";

// Everyone who said yes, most recent first; stopped clients included, marked by stoppedAt.
export async function listClients(admin: Admin): Promise<Client[]> {
  const { data, error } = await admin.supabase
    .from("coaching_clients")
    .select(CLIENT_COLUMNS)
    .order("started_at", { ascending: false });
  setupCheck(error, "clients");
  return (data as unknown as ClientRow[]).map(toClient);
}

// The client, only while coaching is on. Null for anyone else, so their page stays closed.
export async function getActiveClient(admin: Admin, userId: string): Promise<Client | null> {
  if (!isUserId(userId)) return null;
  const { data, error } = await admin.supabase
    .from("coaching_clients")
    .select(CLIENT_COLUMNS)
    .eq("user_id", userId)
    .is("stopped_at", null)
    .maybeSingle();
  setupCheck(error, "the client");
  return data ? toClient(data as unknown as ClientRow) : null;
}

export type ClientJob = ViewJob & {
  level: string | null;
  nextStage: string | null;
  finishedOn: string | null;
};

// Target jobs for clients, keyed by user. Titles, companies, levels and dates only.
export async function clientJobs(admin: Admin, userIds: string[]): Promise<Map<string, ClientJob[]>> {
  const out = new Map<string, ClientJob[]>(userIds.map((id) => [id, []]));
  const ids = userIds.filter(isUserId);
  if (ids.length === 0) return out;
  const { data, error } = await admin.supabase
    .from("target_jobs")
    .select("id, user_id, title, company, level, interview_date, next_stage, outcome, finished_on")
    .in("user_id", ids)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Couldn't load the client's jobs: ${error.message}`);
  for (const row of data as {
    id: string;
    user_id: string;
    title: string;
    company: string | null;
    level: string | null;
    interview_date: string | null;
    next_stage: string | null;
    outcome: string | null;
    finished_on: string | null;
  }[]) {
    out.get(row.user_id)?.push({
      id: row.id,
      title: row.title,
      company: row.company,
      level: row.level,
      interviewDate: row.interview_date,
      nextStage: row.next_stage,
      outcome: row.outcome,
      finishedOn: row.finished_on,
    });
  }
  return out;
}

export type ClientPractice = {
  id: string;
  targetJobId: string;
  items: PracticeItem[];
  finishedAt: string | null;
  createdAt: string;
};

const PRACTICE_SHOWN = 10;

// The client's latest practice rounds, newest first.
export async function clientPractice(admin: Admin, userId: string): Promise<ClientPractice[]> {
  if (!isUserId(userId)) return [];
  const { data, error } = await admin.supabase
    .from("practice_sessions")
    .select("id, target_job_id, items, finished_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(PRACTICE_SHOWN);
  if (error) throw new Error(`Couldn't load the client's practice: ${error.message}`);
  return (
    data as {
      id: string;
      target_job_id: string;
      items: unknown;
      finished_at: string | null;
      created_at: string;
    }[]
  ).map((row) => ({
    id: row.id,
    targetJobId: row.target_job_id,
    items: parseItems(row.items),
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  }));
}

// What the interview profile is built from: each past interview's saved review, never the
// transcript itself (so hedge counts are left out).
export async function clientProfileInput(admin: Admin, userId: string): Promise<ProfileTranscript[]> {
  if (!isUserId(userId)) return [];
  const { data, error } = await admin.supabase
    .from("interview_transcripts")
    .select("id, title, company, target_job_id, analysis, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Couldn't load the client's interview profile: ${error.message}`);
  return (
    data as {
      id: string;
      title: string;
      company: string | null;
      target_job_id: string | null;
      analysis: unknown;
      created_at: string;
    }[]
  ).map((row) => ({
    id: row.id,
    title: row.title,
    company: row.company,
    targetJobId: row.target_job_id,
    analysis: parseAnalysis(row.analysis),
    createdAt: row.created_at,
  }));
}
