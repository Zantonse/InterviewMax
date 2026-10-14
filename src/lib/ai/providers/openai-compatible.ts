import OpenAI, { toFile } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  ModelError,
  type ChatMessage,
  type GenerateRequest,
  type GenerateResult,
  type ModelProvider,
  type ProviderId,
  type TranscribeRequest,
} from "../types";

type OpenAILike = {
  chat: Pick<OpenAI["chat"], "completions">;
  audio?: Pick<OpenAI["audio"], "transcriptions">;
};

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
        ...req.messages.map(toMessage),
      ];

      let response: OpenAI.Chat.Completions.ChatCompletion;
      try {
        response = await client.chat.completions.create({
          model: req.model,
          messages,
          // OpenRouter passes max_tokens to every upstream provider; not all of them accept
          // max_completion_tokens. The OpenAI API itself wants max_completion_tokens.
          ...(id === "openrouter"
            ? { max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS }
            : { max_completion_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS }),
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

    // Both APIs take OpenAI's /audio/transcriptions request; on OpenRouter the model slug picks
    // the speech-to-text vendor (e.g. "elevenlabs/scribe-v2").
    async transcribe(req: TranscribeRequest): Promise<string> {
      if (!client.audio) throw new ModelError(`${label(id)} client has no audio API`, id);
      try {
        const result = await client.audio.transcriptions.create({
          model: req.model,
          file: await toFile(req.audio, `speech.${req.format}`, { type: `audio/${req.format}` }),
        });
        return result.text ?? "";
      } catch (err) {
        throw new ModelError(describe(id, err), id, err);
      }
    },
  };
}

function toMessage(m: ChatMessage): ChatCompletionMessageParam {
  if (typeof m.content === "string") return { role: m.role, content: m.content };
  if (m.role === "assistant") {
    return {
      role: "assistant",
      content: m.content.map((p) => (p.type === "text" ? p.text : "")).join(""),
    };
  }
  return {
    role: "user",
    content: m.content.map((p) =>
      p.type === "text"
        ? { type: "text" as const, text: p.text }
        : {
            type: "image_url" as const,
            image_url: { url: `data:${p.mediaType};base64,${p.data}` },
          },
    ),
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
