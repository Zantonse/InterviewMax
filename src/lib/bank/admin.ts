import "server-only";
import type { Admin } from "@/lib/admin/data";
import { checkQuestion, MAX_SHARED_LENGTH } from "./content";

// The admin panel's side of the shared question bank: the queue of shared questions waiting for
// approval, and approving (optionally edited) or rejecting them. Every call takes the Admin that
// requireAdmin() returned, so only an admin gets here. Reads the question and its tags, never who
// shared it.

export type PendingQuestion = {
  id: string;
  question: string;
  theme: string | null;
  company: string | null;
  role: string | null;
  level: string | null;
  round: string | null;
  askedMonth: string;
  flags: string[];
  createdAt: string;
};

export type ReviewedCounts = { pending: number; approved: number; rejected: number };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUEUE_LIMIT = 200;

export async function listPendingQuestions(admin: Admin): Promise<PendingQuestion[]> {
  const { data, error } = await admin.supabase
    .from("shared_questions")
    .select("id, question, theme, company, role, level, round, asked_month, flags, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(QUEUE_LIMIT);
  if (error) throw new Error(`Couldn't load the review queue: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    question: r.question as string,
    theme: (r.theme as string | null) ?? null,
    company: (r.company as string | null) ?? null,
    role: (r.role as string | null) ?? null,
    level: (r.level as string | null) ?? null,
    round: (r.round as string | null) ?? null,
    askedMonth: r.asked_month as string,
    flags: (r.flags as string[] | null) ?? [],
    createdAt: r.created_at as string,
  }));
}

export async function sharedQuestionCounts(admin: Admin): Promise<ReviewedCounts> {
  const count = async (status: keyof ReviewedCounts) => {
    const { count: n, error } = await admin.supabase
      .from("shared_questions")
      .select("id", { count: "exact", head: true })
      .eq("status", status);
    if (error) throw new Error(`Couldn't count shared questions: ${error.message}`);
    return n ?? 0;
  };
  const [pending, approved, rejected] = await Promise.all([
    count("pending"),
    count("approved"),
    count("rejected"),
  ]);
  return { pending, approved, rejected };
}

// Approves a pending question, with the admin's edits. The code check runs again on the final
// text, and its flags are kept with the question.
export async function approveQuestion(admin: Admin, id: string, question: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Question not found.");
  const text = question.replace(/\s+/g, " ").trim().slice(0, MAX_SHARED_LENGTH);
  if (!text) throw new Error("The question is empty.");
  const { data: row, error: readError } = await admin.supabase
    .from("shared_questions")
    .select("company")
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();
  if (readError) throw new Error(`Couldn't load the question: ${readError.message}`);
  if (!row) throw new Error("That question was withdrawn or already reviewed.");
  const { error } = await admin.supabase
    .from("shared_questions")
    .update({
      question: text,
      flags: checkQuestion(text, (row.company as string | null) ?? null),
      status: "approved",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw new Error(`Couldn't approve the question: ${error.message}`);
}

export async function rejectQuestion(admin: Admin, id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Question not found.");
  const { error } = await admin.supabase
    .from("shared_questions")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) throw new Error(`Couldn't reject the question: ${error.message}`);
}
