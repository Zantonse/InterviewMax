import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseQuestionsToAsk, type QuestionsToAsk } from "@/lib/ask/content";
import { parseLikelyQuestions, type LikelyQuestions } from "@/lib/questions/content";
import {
  parseOverview,
  parseResume,
  type JobsOverview,
  type LevelId,
  type Resume,
} from "./content";

// The one place app code reads and writes target jobs and the resume. Row-level security limits
// every query to the signed-in user's own rows; each function also checks there is a signed-in user.

export type TargetJob = {
  id: string;
  title: string;
  company: string | null;
  level: string | null;
  levelConfirmed: boolean;
  description: string;
  likelyQuestions: LikelyQuestions | null;
  interviewReports: string;
  // Questions to ask the interviewer: suggestions, the user's own, and which are saved.
  questionsToAsk: QuestionsToAsk | null;
  // The next interview for this job, as YYYY-MM-DD, when the user has set one.
  interviewDate: string | null;
  createdAt: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  title: string;
  company: string | null;
  level: string | null;
  level_confirmed: boolean;
  job_description: string | null;
  likely_questions: unknown;
  interview_reports: string | null;
  questions_to_ask: unknown;
  interview_date: string | null;
  created_at: string;
};

const COLUMNS =
  "id, title, company, level, level_confirmed, job_description, likely_questions, interview_reports, questions_to_ask, interview_date, created_at";

function toJob(row: Row): TargetJob {
  return {
    id: row.id,
    title: row.title,
    company: row.company,
    level: row.level,
    levelConfirmed: row.level_confirmed,
    description: row.job_description ?? "",
    likelyQuestions: parseLikelyQuestions(row.likely_questions),
    interviewReports: row.interview_reports ?? "",
    questionsToAsk: parseQuestionsToAsk(row.questions_to_ask),
    interviewDate: row.interview_date,
    createdAt: row.created_at,
  };
}

export async function listJobs(): Promise<TargetJob[]> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("target_jobs")
    .select(COLUMNS)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Couldn't load your target jobs: ${error.message}`);
  return (data as Row[]).map(toJob);
}

export async function getJob(id: string): Promise<TargetJob | null> {
  if (!UUID_RE.test(id)) return null;
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("target_jobs")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the job: ${error.message}`);
  return data ? toJob(data as Row) : null;
}

export async function insertJob(input: {
  title: string;
  company: string | null;
  level: LevelId;
  description: string;
}): Promise<string> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("target_jobs")
    .insert({
      title: input.title,
      company: input.company,
      level: input.level,
      job_description: input.description,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Couldn't add the job: ${error?.message ?? "no row"}`);
  return data.id as string;
}

export async function deleteJob(id: string): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Job not found.");
  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("target_jobs").delete().eq("id", id);
  if (error) throw new Error(`Couldn't remove the job: ${error.message}`);
}

export async function setJobLevel(id: string, level: LevelId): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Job not found.");
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("target_jobs")
    .update({ level, level_confirmed: true })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`Couldn't save the level: ${error.message}`);
  if (!data?.length) throw new Error("Job not found.");
}

// Sets or clears (null) the date of the next interview for a job. The date is YYYY-MM-DD.
export async function setInterviewDate(id: string, date: string | null): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Job not found.");
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("target_jobs")
    .update({ interview_date: date })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`Couldn't save the interview date: ${error.message}`);
  if (!data?.length) throw new Error("Job not found.");
}

export async function saveJobQuestions(
  id: string,
  patch: { likelyQuestions?: LikelyQuestions | null; interviewReports?: string },
): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Job not found.");
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("target_jobs")
    .update({
      ...("likelyQuestions" in patch ? { likely_questions: patch.likelyQuestions } : {}),
      ...("interviewReports" in patch ? { interview_reports: patch.interviewReports } : {}),
    })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`Couldn't save the questions: ${error.message}`);
  if (!data?.length) throw new Error("Job not found.");
}

// Saves (or clears, with null) the questions the user will ask at the end of interviews for a job.
export async function saveQuestionsToAsk(id: string, value: QuestionsToAsk | null): Promise<void> {
  if (!UUID_RE.test(id)) throw new Error("Job not found.");
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("target_jobs")
    .update({ questions_to_ask: value })
    .eq("id", id)
    .select("id");
  if (error) throw new Error(`Couldn't save your questions: ${error.message}`);
  if (!data?.length) throw new Error("Job not found.");
}

// The resume and the read of the user's target jobs, kept on their profile row.
export async function getJobsPrep(): Promise<{
  resume: Resume | null;
  overview: JobsOverview | null;
}> {
  await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("resume, jobs_overview")
    .maybeSingle();
  if (error) throw new Error(`Couldn't load your resume: ${error.message}`);
  return {
    resume: parseResume(data?.resume),
    overview: parseOverview(data?.jobs_overview),
  };
}

export async function saveJobsPrep(patch: {
  resume?: Resume | null;
  overview?: JobsOverview | null;
}): Promise<void> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email,
    ...("resume" in patch ? { resume: patch.resume } : {}),
    ...("overview" in patch ? { jobs_overview: patch.overview } : {}),
  });
  if (error) throw new Error(`Couldn't save to your profile: ${error.message}`);
}
