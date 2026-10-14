import "server-only";
import { generateForStep } from "@/lib/ai";
import type { NumberItem } from "./families";
import { NUMBERS_SYSTEM, numbersMessages, parseNumbersDraft } from "./prompts";

// For a role with no hand-written list: one model call drafts the numbers to gather.
export async function draftNumbers(
  roleName: string,
  context = "",
): Promise<{ role: string; items: NumberItem[]; model: string }> {
  const result = await generateForStep("numbersChecklist", {
    system: NUMBERS_SYSTEM,
    messages: numbersMessages(roleName, context),
  });
  if (result.stopReason === "refusal") {
    throw new Error("The model declined to answer. Try describing your role differently.");
  }
  const { role, items } = parseNumbersDraft(result.text);
  return { role, items, model: result.model };
}
