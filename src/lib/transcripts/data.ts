import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseAnalysis, type TranscriptAnalysis } from "./content";

// The one place app code reads and writes interview transcripts. Row-level security limits every
// query to the signed-in user's own rows; each function also checks there is a signed-in user.

export type Transcript = {
  id: string;
  targetJobId: string | null;
  title: string;
  company: string | null;
  speaker: string;
  fileName: string;
  transcript: string;
  analysis: TranscriptAnalysis | null;
  createdAt: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  target_job_id: string | null;
  title: string;
  company: string | null;
  speaker: string | null;
  file_name: string | null;
  transcript: string;
  analysis: unknown;
  created_at: string;
};

const COLUMNS =
  "id, target_job_id, title, company, speaker, file_name, transcript, analysis, created_at";

function toTranscript(row: Row): Transcript {
  return {
    id: row.id,
    targetJobId: row.target_job_id,
    title: row.title,
    company: row.company,
    speaker: row.speaker ?? "",
    fileName: row.file_name ?? "",
    transcript: row.transcript,
    analysis: parseAnalysis(row.analysis),
    createdAt: row.created_at,
  };
}

export async function listTranscripts(): Promise<Transcript[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interview_transcripts")
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Couldn't load your interview transcripts: ${error.message}`);
  return (data as Row[]).map(toTranscript);
}

// For features that only get better with transcripts (likely questions, follow-ups): if they can't
// be read, carry on without them rather than failing.
export async function listTranscriptsForPrep(): Promise<Transcript[]> {
  try {
    return await listTranscripts();
  } catch (err) {
    unstable_rethrow(err);
    console.error("Transcripts: loading for prep failed", err);
    return [];
  }
}

export async function getTranscript(id: string): Promise<Transcript | null> {
  if (!UUID_RE.test(id)) return null;
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interview_transcripts")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the transcript: ${error.message}`);
  return data ? toTranscript(data as Row) : null;
}

export async function insertTranscript(input: {
  targetJobId: string | null;
  title: string;
  company: string | null;
  speaker: string;
  fileName: string;
  transcript: string;
}): Promise<string> {
  if (input.targetJobId && !UUID_RE.test(input.targetJobId)) throw new Error("Job not found.");
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interview_transcripts")
    .insert({
      target_job_id: input.targetJobId,
      title: input.title,
      company: input.company,
      speaker: input.speaker || null,
      file_name: input.fileName || null,
      transcript: input.transcript,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Couldn't save the transcript: ${error?.message ?? "no row"}`);
  }
  return data.id as string;
}

export async function saveAnalysis(id: string, analysis: TranscriptAnalysis): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Transcript not found.");
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interview_transcripts")
    .update({ analysis })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`Couldn't save the review: ${error.message}`);
  if (!data?.length) throw new Error("Transcript not found.");
}

export async function deleteTranscript(id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Transcript not found.");
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("interview_transcripts").delete().eq("id", id);
  if (error) throw new Error(`Couldn't remove the transcript: ${error.message}`);
}
