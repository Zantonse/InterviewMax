import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getJob } from "@/lib/jobs/data";
import { createClient } from "@/lib/supabase/server";
import { getTranscript, saveSharing } from "@/lib/transcripts/data";
import {
  monthOf,
  parseBankRows,
  shareableQuestions,
  type BankQuestion,
} from "./content";

// The one place app code reads and writes the user's own shared questions, and reads the approved
// questions others shared. Row-level security limits the table to the user's own rows; other
// people's approved questions come only through recent_shared_questions(), which returns no ids.

export type MySharedQuestion = {
  id: string;
  question: string;
  sourceKey: string;
  status: "pending" | "approved" | "rejected";
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function listMySharedQuestions(transcriptId: string): Promise<MySharedQuestion[]> {
  if (!UUID_RE.test(transcriptId)) return [];
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shared_questions")
    .select("id, question, source_key, status")
    .eq("transcript_id", transcriptId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Couldn't load your shared questions: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    question: r.question as string,
    sourceKey: r.source_key as string,
    status: r.status as MySharedQuestion["status"],
  }));
}

// Brings one transcript's shared questions in line with its review: with sharing on, questions
// that are new since the last review wait for approval, and pending ones that the review no longer
// has are dropped. Approved and rejected ones stay as they were. With sharing off, nothing.
export async function syncSharedQuestions(transcriptId: string): Promise<number> {
  const transcript = await getTranscript(transcriptId);
  // Without a company there's no one to show them to.
  if (!transcript?.shareQuestions || !transcript.analysis || !transcript.company) return 0;
  const job = transcript.targetJobId ? await getJob(transcript.targetJobId) : null;
  const wanted = shareableQuestions({
    asked: transcript.analysis.asked,
    transcript: transcript.transcript,
    speaker: transcript.speaker,
    company: transcript.company,
    excluded: transcript.shareExcluded,
  });
  const existing = await listMySharedQuestions(transcript.id);
  const wantedKeys = new Set(wanted.map((w) => w.sourceKey));
  const supabase = await createClient();

  const stale = existing.filter((e) => e.status === "pending" && !wantedKeys.has(e.sourceKey));
  if (stale.length) {
    const { error } = await supabase
      .from("shared_questions")
      .delete()
      .in("id", stale.map((e) => e.id));
    if (error) throw new Error(`Couldn't update your shared questions: ${error.message}`);
  }

  const have = new Set(existing.map((e) => e.sourceKey));
  const fresh = wanted.filter((w) => !have.has(w.sourceKey));
  if (fresh.length) {
    const { error } = await supabase.from("shared_questions").insert(
      fresh.map((w) => ({
        transcript_id: transcript.id,
        question: w.question,
        source_key: w.sourceKey,
        theme: w.theme,
        company: transcript.company,
        role: job?.title ?? null,
        level: job?.level ?? null,
        round: transcript.round,
        asked_month: monthOf(transcript.createdAt),
        flags: w.flags,
      })),
    );
    if (error) throw new Error(`Couldn't share the questions: ${error.message}`);
  }
  return fresh.length;
}

// For the transcript flows: sharing only adds to them, so a failure logs and carries on.
export async function syncSharedQuestionsSafely(transcriptId: string): Promise<void> {
  try {
    await syncSharedQuestions(transcriptId);
  } catch (err) {
    unstable_rethrow(err);
    console.error("Question bank: syncing shared questions failed", err);
  }
}

// Stops sharing this interview's questions and deletes every one already shared, approved or not.
export async function withdrawSharedQuestions(transcriptId: string): Promise<void> {
  await saveSharing(transcriptId, { shareQuestions: false });
  const supabase = await createClient();
  const { error } = await supabase.from("shared_questions").delete().eq("transcript_id", transcriptId);
  if (error) throw new Error(`Couldn't withdraw your questions: ${error.message}`);
}

// Leaves one question out for good: deleted from the bank, and not shared again after a new review.
export async function leaveOutSharedQuestion(transcriptId: string, id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Question not found.");
  const transcript = await getTranscript(transcriptId);
  if (!transcript) throw new Error("Transcript not found.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shared_questions")
    .delete()
    .eq("id", id)
    .eq("transcript_id", transcript.id)
    .select("source_key");
  if (error) throw new Error(`Couldn't remove that question: ${error.message}`);
  const key = data?.[0]?.source_key as string | undefined;
  if (key && !transcript.shareExcluded.includes(key)) {
    await saveSharing(transcript.id, { shareExcluded: [...transcript.shareExcluded, key] });
  }
}

// Approved questions other people were asked at this company in the last six months. Background
// for the job page and the library: a failure (say, before the bank exists) shows nothing.
export async function recentSharedQuestions(company: string | null): Promise<BankQuestion[]> {
  if (!company?.trim()) return [];
  try {
    await getCurrentUser();
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("recent_shared_questions", { p_company: company.trim() });
    if (error) throw new Error(error.message);
    return parseBankRows(data);
  } catch (err) {
    unstable_rethrow(err);
    console.error("Question bank: reading shared questions failed", err);
    return [];
  }
}
