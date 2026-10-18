import "server-only";
import { generateForStep, type Step } from "@/lib/ai";
import type { ChatMessage } from "@/lib/ai/types";
import {
  type PracticeFeedback,
  checkNewFacts,
  followUpCount,
  numbersLeftOut,
  screenLimitSeconds,
  spokenText,
  timingFor,
} from "./content";
import { deliveryFor } from "./delivery";
import {
  type PracticeContext,
  type ProbeResult,
  feedbackMessages,
  feedbackSystem,
  parseFeedback,
  parseProbe,
  probeHints,
  probeMessages,
  probeSystem,
} from "./prompts";

// The interviewer's next follow-up for a practice question, or null when it has none.
export async function askFollowUp(ctx: PracticeContext): Promise<ProbeResult> {
  const text = await call(
    "practiceProbe",
    probeSystem(ctx),
    probeMessages(ctx, probeHints(spokenText(ctx))),
  );
  return parseProbe(text.text);
}

// Feedback on one practice question. Timing, delivery, the figures left out and, in an AI screen
// round, whether the answer fit the time limit are worked out in code; the model reads the
// exchange against the saved story and says how each follow-up answer held up. New facts are kept
// only when their quote is in what the user said and their numbers are in the quote.
export async function giveFeedback(ctx: PracticeContext, theme: string): Promise<PracticeFeedback> {
  const spoken = spokenText(ctx);
  const timing = timingFor(ctx.turns[0], theme);
  const delivery = deliveryFor(ctx.turns);
  const leftOut = ctx.reference ? numbersLeftOut(ctx.reference.script, spoken) : [];
  const screen = ctx.kind === "screen";
  const limitSeconds = screen ? screenLimitSeconds(theme) : undefined;
  const result = await call(
    "practiceFeedback",
    feedbackSystem(ctx),
    feedbackMessages(ctx, { timing, numbersLeftOut: leftOut, limitSeconds }),
  );
  const { layers, result: reached, resultNote, ...parsed } = parseFeedback(
    result.text,
    Boolean(ctx.reference),
    { followUps: followUpCount(ctx), screen },
  );
  return {
    ...parsed,
    ...(layers.length ? { layers } : {}),
    ...(limitSeconds
      ? {
          screen: {
            limitSeconds,
            // A few seconds of grace: a screen cuts off at the limit, not before it.
            withinTime: timing.seconds <= limitSeconds + 5,
            result: reached ?? "missing",
            note: resultNote ?? "",
          },
        }
      : {}),
    newFacts: checkNewFacts(parsed.newFacts, spoken),
    numbersLeftOut: leftOut,
    timing,
    ...(delivery ? { delivery } : {}),
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
