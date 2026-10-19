"use server";

import { unstable_rethrow } from "next/navigation";
import { ModelError } from "@/lib/ai";
import {
  MAX_CASE_ANSWER_LENGTH,
  MAX_CASE_QUESTION_LENGTH,
  caseKind,
  type CaseFeedback,
} from "@/lib/cases/content";
import { caseFeedback } from "@/lib/cases/practice";
import { getJob } from "@/lib/jobs/data";

export type CaseResult = { ok: true; feedback: CaseFeedback } | { ok: false; error: string };

// Feedback on one practice answer to a case or skills question (a model call). Nothing is saved.
export async function practiceCase(jobId: string, question: string, answer: string): Promise<CaseResult> {
  try {
    const q = String(question ?? "").trim().slice(0, MAX_CASE_QUESTION_LENGTH);
    const a = String(answer ?? "").trim().slice(0, MAX_CASE_ANSWER_LENGTH);
    if (!q) return { ok: false, error: "Add the question first." };
    if (a.split(/\s+/).length < 15) return { ok: false, error: "Say a bit more first: a few sentences at least." };
    const job = await getJob(String(jobId));
    if (!job) return { ok: false, error: "We couldn't find that job." };
    const feedback = await caseFeedback({
      question: q,
      kind: caseKind(q),
      answer: a,
      job: { title: job.title, company: job.company },
    });
    return { ok: true, feedback };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Case practice: feedback failed", err);
    return {
      ok: false,
      error:
        err instanceof ModelError
          ? "The assistant didn't respond. Try again in a moment."
          : err instanceof Error
            ? err.message
            : "Something went wrong. Try again.",
    };
  }
}
