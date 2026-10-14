import "server-only";
import { STEP_MODELS, type Step, type StepModel } from "./config";
import { getProvider } from "./registry";
import { ModelError, type ChatMessage, type GenerateResult } from "./types";

export type { ChatMessage, GenerateResult, ProviderId } from "./types";
export { ModelError } from "./types";
export { STEP_MODELS, type Step } from "./config";

// Runs one model call for an app step, using the provider and model named in config.ts.
export async function generateForStep(
  step: Step,
  input: { system?: string; messages: ChatMessage[]; maxTokens?: number },
): Promise<GenerateResult> {
  const cfg: StepModel = STEP_MODELS[step];
  return getProvider(cfg.provider).generate({
    model: cfg.model,
    effort: cfg.effort,
    system: input.system,
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
