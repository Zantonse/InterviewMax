import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  ModelError,
  type GenerateRequest,
  type GenerateResult,
  type ModelProvider,
  type ProviderId,
} from "../types";

type OpenAILike = { chat: Pick<OpenAI["chat"], "completions"> };

const DEFAULT_MAX_TOKENS = 16000;

// The OpenAI API and OpenRouter share the Chat Completions format,
// so one adapter serves both. OpenRouter is just a different base URL and key.
export function createOpenAICompatibleProvider(
  id: Extract<ProviderId, "openai" | "openrouter">,
  client: OpenAILike,
): ModelProvider {
  return {
    id,
    async generate(req: GenerateRequest): Promise<GenerateResult> {
      const messages: ChatCompletionMessageParam[] = [
        ...(req.system ? [{ role: "system" as const, content: req.system }] : []),
        ...req.messages,
      ];

      let response: OpenAI.Chat.Completions.ChatCompletion;
      try {
        response = await client.chat.completions.create({
          model: req.model,
          messages,
          max_completion_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
          ...(req.effort ? { reasoning_effort: req.effort } : {}),
        });
      } catch (err) {
        throw new ModelError(describe(id, err), id, err);
      }

      const choice = response.choices[0];
      if (!choice) {
        throw new ModelError(`${label(id)} returned no choices`, id);
      }

      return {
        text: choice.message.content ?? "",
        provider: id,
        model: response.model,
        stopReason:
          choice.finish_reason === "stop"
            ? "end"
            : choice.finish_reason === "length"
              ? "max_tokens"
              : choice.finish_reason === "content_filter" || choice.message.refusal
                ? "refusal"
                : "other",
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
      };
    },
  };
}

function label(id: ProviderId) {
  return id === "openrouter" ? "OpenRouter" : "OpenAI API";
}

function describe(id: ProviderId, err: unknown) {
  if (err instanceof OpenAI.APIError) {
    return `${label(id)} error${err.status ? ` ${err.status}` : ""}: ${err.message}`;
  }
  return `${label(id)} request failed: ${err instanceof Error ? err.message : String(err)}`;
}
