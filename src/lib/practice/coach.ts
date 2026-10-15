import "server-only";
import { generateForStep, type Step } from "@/lib/ai";
import type { ChatMessage } from "@/lib/ai/types";
import {
  type PracticeFeedback,
  checkNewFacts,
  numbersLeftOut,
  spokenText,
  timingFor,
} from "./content";
import {
  PRACTICE_FEEDBACK_SYSTEM,
  PRACTICE_PROBE_SYSTEM,
  type PracticeContext,
  type ProbeResult,
  feedbackMessages,
  parseFeedback,
  parseProbe,
  probeHints,
  probeMessages,
} from "./prompts";

// The interviewer's next follow-up for a practice question, or null when it has none.
export async function askFollowUp(ctx: PracticeContext): Promise<ProbeResult> {
  const text = await call(
    "practiceProbe",
    PRACTICE_PROBE_SYSTEM,
    probeMessages(ctx, probeHints(spokenText(ctx))),
  );
  return parseProbe(text.text);
}

// Feedback on one practice question. Timing and the figures left out are worked out in code; the
// model reads the exchange against the saved story. New facts are kept only when their quote is in
// what the user said and their numbers are in the quote.
export async function giveFeedback(ctx: PracticeContext, theme: string): Promise<PracticeFeedback> {
  const spoken = spokenText(ctx);
  const timing = timingFor(ctx.turns[0], theme);
  const leftOut = ctx.reference ? numbersLeftOut(ctx.reference.script, spoken) : [];
  const result = await call(
    "practiceFeedback",
    PRACTICE_FEEDBACK_SYSTEM,
    feedbackMessages(ctx, { timing, numbersLeftOut: leftOut }),
  );
  const parsed = parseFeedback(result.text, Boolean(ctx.reference));
  return {
    ...parsed,
    newFacts: checkNewFacts(parsed.newFacts, spoken),
    numbersLeftOut: leftOut,
    timing,
    model: result.model,
    givenAt: new Date().toISOString(),
  };
}

async function call(step: Step, system: string, messages: ChatMessage[]) {
  const result = await generateForStep(step, { system, messages });
  if (result.stopReason === "refusal") {
    throw new Error("The model declined to answer. Try rewording your answer.");
  }
  if (result.stopReason === "max_tokens" && !result.text.includes("}")) {
    throw new Error("The model ran out of room before finishing. Try again.");
  }
  return { text: result.text, model: result.model };
}
