import "server-only";
import { getCoachingStyleSafely } from "@/lib/coaching/data";
import { COACHING_TONE_STEPS, withCoachingTone } from "@/lib/coaching/style";
import { redact, type Redaction } from "@/lib/promotion/content";
import { getRedactionsSafely } from "@/lib/promotion/data";
import { STEP_MODELS, type Step, type StepModel } from "./config";
import { getProvider } from "./registry";
import { ModelError, type ChatMessage, type GenerateResult } from "./types";

export type { ChatMessage, GenerateResult, ProviderId } from "./types";
export { ModelError } from "./types";
export { STEP_MODELS, type Step } from "./config";

// Runs one model call for an app step, using the provider and model named in config.ts. Coaching
// steps get the user's coaching style as one tone line at the end of the system prompt. Names the
// user asked to redact (PromotionMax) are swapped for their placeholders in everything sent.
export async function generateForStep(
  step: Step,
  input: { system?: string; messages: ChatMessage[]; maxTokens?: number },
): Promise<GenerateResult> {
  const cfg: StepModel = STEP_MODELS[step];
  const [style, redactions] = await Promise.all([
    COACHING_TONE_STEPS.includes(step) ? getCoachingStyleSafely() : ("balanced" as const),
    getRedactionsSafely(),
  ]);
  const system = withCoachingTone(step, input.system, style);
  return getProvider(cfg.provider).generate({
    model: cfg.model,
    effort: cfg.effort,
    system: system && redact(system, redactions),
    messages: redactions.length
      ? input.messages.map((m) => redactMessage(m, redactions))
      : input.messages,
    maxTokens: input.maxTokens ?? cfg.maxTokens,
  });
}

function redactMessage(message: ChatMessage, redactions: Redaction[]): ChatMessage {
  if (typeof message.content === "string") {
    return { ...message, content: redact(message.content, redactions) };
  }
  return {
    ...message,
    content: message.content.map((part) =>
      part.type === "text" ? { ...part, text: redact(part.text, redactions) } : part,
    ),
  };
}

// Writes down speech for an app step (mic mode), using the speech-to-text model named in config.ts.
export async function transcribeForStep(step: Step, audio: Uint8Array): Promise<string> {
  const cfg: StepModel = STEP_MODELS[step];
  const provider = getProvider(cfg.provider);
  if (!provider.transcribe) {
    throw new ModelError(
      `${cfg.provider} can't transcribe audio; use openrouter or openai.`,
      cfg.provider,
    );
  }
  return provider.transcribe({ model: cfg.model, audio, format: "wav" });
}
