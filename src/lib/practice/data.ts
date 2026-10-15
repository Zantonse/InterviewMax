import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MAX_SESSIONS_PER_JOB, type PracticeItem, parseItems } from "./content";

// The one place app code reads and writes practice rounds. Row-level security limits every query to
// the signed-in user's own rows; each function also checks there is a signed-in user.

export type PracticeSession = {
  id: string;
  targetJobId: string;
  items: PracticeItem[];
  finishedAt: string | null;
  createdAt: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  target_job_id: string;
  items: unknown;
  finished_at: string | null;
  created_at: string;
};

const COLUMNS = "id, target_job_id, items, finished_at, created_at";

function toSession(row: Row): PracticeSession {
  return {
    id: row.id,
    targetJobId: row.target_job_id,
    items: parseItems(row.items),
    finishedAt: row.finished_at,
    createdAt: row.created_at,
  };
}

// A job's practice rounds, newest first. With no job, every round.
export async function listPracticeSessions(jobId?: string): Promise<PracticeSession[]> {
  if (jobId !== undefined && !UUID_RE.test(jobId)) return [];
  await getCurrentUser();
  const supabase = await createClient();
  let query = supabase.from("practice_sessions").select(COLUMNS);
  if (jobId) query = query.eq("target_job_id", jobId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw new Error(`Couldn't load your practice rounds: ${error.message}`);
  return (data as Row[]).map(toSession);
}

// For pages that only show practice alongside other things (the prep plan, a job's steps): if the
// rounds can't be read (say, before the table exists), carry on without them.
export async function listPracticeSessionsSafely(jobId?: string): Promise<PracticeSession[]> {
  try {
    return await listPracticeSessions(jobId);
  } catch (err) {
    unstable_rethrow(err);
    console.error("Practice: loading rounds failed", err);
    return [];
  }
}

export async function getPracticeSession(id: string): Promise<PracticeSession | null> {
  if (!UUID_RE.test(id)) return null;
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("practice_sessions")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the practice round: ${error.message}`);
  return data ? toSession(data as Row) : null;
}

// Starts a round for a job. Past the limit per job, the oldest rounds are removed first.
export async function insertPracticeSession(input: {
  targetJobId: string;
  items: PracticeItem[];
}): Promise<string> {
  if (!UUID_RE.test(input.targetJobId)) throw new Error("Job not found.");
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("practice_sessions")
    .insert({ target_job_id: input.targetJobId, items: input.items })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Couldn't start the practice round: ${error?.message ?? "no row"}`);
  }
  const { data: old } = await supabase
    .from("practice_sessions")
    .select("id")
    .eq("target_job_id", input.targetJobId)
    .order("created_at", { ascending: false })
    .range(MAX_SESSIONS_PER_JOB, MAX_SESSIONS_PER_JOB + 50);
  if (old?.length) {
    await supabase
      .from("practice_sessions")
      .delete()
      .in(
        "id",
        old.map((r) => r.id as string),
      );
  }
  return data.id as string;
}

export async function savePracticeItems(
  id: string,
  items: PracticeItem[],
  // When the last question was done; null while the round is still going.
  finishedAt: string | null,
): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Practice round not found.");
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("practice_sessions")
    .update({ items, finished_at: finishedAt })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`Couldn't save your practice: ${error.message}`);
  if (!data?.length) throw new Error("Practice round not found.");
}

export async function deletePracticeSession(id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Practice round not found.");
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("practice_sessions").delete().eq("id", id);
  if (error) throw new Error(`Couldn't remove the practice round: ${error.message}`);
}
