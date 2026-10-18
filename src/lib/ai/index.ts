import "server-only";
import { getCoachingStyleSafely } from "@/lib/coaching/data";
import { COACHING_TONE_STEPS, withCoachingTone } from "@/lib/coaching/style";
import { STEP_MODELS, type Step, type StepModel } from "./config";
import { getProvider } from "./registry";
import { ModelError, type ChatMessage, type GenerateResult } from "./types";

export type { ChatMessage, GenerateResult, ProviderId } from "./types";
export { ModelError } from "./types";
export { STEP_MODELS, type Step } from "./config";

// Runs one model call for an app step, using the provider and model named in config.ts. Coaching
// steps get the user's coaching style as one tone line at the end of the system prompt.
export async function generateForStep(
  step: Step,
  input: { system?: string; messages: ChatMessage[]; maxTokens?: number },
): Promise<GenerateResult> {
  const cfg: StepModel = STEP_MODELS[step];
  const style = COACHING_TONE_STEPS.includes(step) ? await getCoachingStyleSafely() : "balanced";
  return getProvider(cfg.provider).generate({
    model: cfg.model,
    effort: cfg.effort,
    system: withCoachingTone(step, input.system, style),
    messages: input.messages,
    maxTokens: input.maxTokens ?? cfg.maxTokens,
  });
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
