import "server-only";
import { generateForStep } from "@/lib/ai";
import type { CaseFeedback, CaseKind } from "./content";
import { CASE_PRACTICE_SYSTEM, casePracticeMessages, parseCasePracticeReply } from "./prompts";

export async function caseFeedback(input: {
  question: string;
  kind: CaseKind;
  answer: string;
  job: { title: string; company: string | null } | null;
}): Promise<CaseFeedback> {
  const result = await generateForStep("casePractice", {
    system: CASE_PRACTICE_SYSTEM,
    messages: casePracticeMessages(input),
  });
  if (result.stopReason === "refusal") throw new Error("The model declined to give feedback on that.");
  return parseCasePracticeReply(result.text, input);
}
