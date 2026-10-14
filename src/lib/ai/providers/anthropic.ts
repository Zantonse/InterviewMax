import Anthropic from "@anthropic-ai/sdk";
import {
  ModelError,
  type ChatMessage,
  type GenerateRequest,
  type GenerateResult,
  type ModelProvider,
} from "../types";

type AnthropicLike = Pick<Anthropic, "messages">;

const DEFAULT_MAX_TOKENS = 16000;

export function createAnthropicProvider(client: AnthropicLike): ModelProvider {
  return {
    id: "anthropic",
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      let response: Anthropic.Message;
      try {
        response = await client.messages.create({
          model: req.model,
          max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
          ...(req.system ? { system: req.system } : {}),
          messages: req.messages.map(toMessage),
          ...(req.effort ? { output_config: { effort: req.effort } } : {}),
        });
      } catch (err) {
        throw new ModelError(describe(err), "anthropic", err);
      }

      const text = response.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");

      return {
        text,
        provider: "anthropic",
        model: response.model,
        stopReason:
          response.stop_reason === "end_turn" || response.stop_reason === "stop_sequence"
            ? "end"
            : response.stop_reason === "max_tokens"
              ? "max_tokens"
              : response.stop_reason === "refusal"
                ? "refusal"
                : "other",
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    },
  };
}

function toMessage(m: ChatMessage): Anthropic.MessageParam {
  if (typeof m.content === "string") return { role: m.role, content: m.content };
  return {
    role: m.role,
    content: m.content.map((p) =>
      p.type === "text"
        ? { type: "text" as const, text: p.text }
        : {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: p.mediaType,
              data: p.data,
            },
          },
    ),
  };
}

function describe(err: unknown) {
  if (err instanceof Anthropic.APIError) {
    return `Claude API error${err.status ? ` ${err.status}` : ""}: ${err.message}`;
  }
  return `Claude API request failed: ${err instanceof Error ? err.message : String(err)}`;
}
