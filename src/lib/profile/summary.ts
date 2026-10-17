import "server-only";
import { generateForStep } from "@/lib/ai";
import type { ProfileResult } from "./assess";
import { factsBasis, summaryFacts, type ProfileSummary } from "./content";
import {
  PROFILE_SUMMARY_SYSTEM,
  checkSummary,
  parseProfileSummary,
  profileSummaryMessages,
} from "./prompts";

// Writes the profile's overall summary from the results in code. Returns null when the model's
// summary fails its check (a figure not in the results, empty, far too long), so the page keeps
// the summary written in code.
export async function writeProfileSummary(result: ProfileResult): Promise<ProfileSummary | null> {
  const facts = summaryFacts(result);
  const reply = await generateForStep("profileSummary", {
    system: PROFILE_SUMMARY_SYSTEM,
    messages: profileSummaryMessages(facts),
  });
  if (reply.stopReason === "refusal") return null;
  const text = parseProfileSummary(reply.text);
  if (!checkSummary(text, facts)) return null;
  return { text, basis: factsBasis(facts), model: reply.model, writtenAt: new Date().toISOString() };
}
