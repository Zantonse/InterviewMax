export type ProviderId = "anthropic" | "openai" | "openrouter";

export type Effort = "low" | "medium" | "high";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GenerateRequest = {
  model: string;
  system?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  // How hard the model should think. Ignored by providers that don't support it.
  effort?: Effort;
};

export type GenerateResult = {
  text: string;
  provider: ProviderId;
  model: string;
  // Normalized across providers: "end", "max_tokens", "refusal" or "other".
  stopReason: "end" | "max_tokens" | "refusal" | "other";
  usage: { inputTokens: number; outputTokens: number };
};

export interface ModelProvider {
  id: ProviderId;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

export class ModelError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderId,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ModelError";
  }
}
