import { describe, expect, it, vi } from "vitest";
import { createAnthropicProvider } from "./providers/anthropic";
import { createOpenAICompatibleProvider } from "./providers/openai-compatible";
import { buildProvider, isProviderConfigured } from "./registry";
import { STEP_MODELS } from "./config";
import { ModelError } from "./types";

describe("Anthropic provider", () => {
  it("sends system, messages and effort, and joins text blocks", async () => {
    const create = vi.fn().mockResolvedValue({
      model: "claude-opus-5-5",
      stop_reason: "end_turn",
      content: [
        { type: "thinking", thinking: "" },
        { type: "text", text: "Hello " },
        { type: "text", text: "there" },
      ],
      usage: { input_tokens: 12, output_tokens: 3 },
    });
    const provider = createAnthropicProvider({ messages: { create } } as never);

    const result = await provider.generate({
      model: "claude-opus-5-5",
      system: "Be brief.",
      effort: "low",
      maxTokens: 100,
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(create).toHaveBeenCalledWith({
      model: "claude-opus-5-5",
      max_tokens: 100,
      system: "Be brief.",
      messages: [{ role: "user", content: "Hi" }],
      output_config: { effort: "low" },
    });
    expect(result).toEqual({
      text: "Hello there",
      provider: "anthropic",
      model: "claude-opus-5-5",
      stopReason: "end",
      usage: { inputTokens: 12, outputTokens: 3 },
    });
  });

  it("maps refusals and wraps errors", async () => {
    const refusing = createAnthropicProvider({
      messages: {
        create: vi.fn().mockResolvedValue({
          model: "m",
          stop_reason: "refusal",
          content: [],
          usage: { input_tokens: 1, output_tokens: 0 },
        }),
      },
    } as never);
    expect((await refusing.generate({ model: "m", messages: [] })).stopReason).toBe("refusal");

    const failing = createAnthropicProvider({
      messages: { create: vi.fn().mockRejectedValue(new Error("boom")) },
    } as never);
    await expect(failing.generate({ model: "m", messages: [] })).rejects.toBeInstanceOf(ModelError);
  });
});

describe("OpenAI-compatible provider", () => {
  it("puts the system prompt first and maps the response", async () => {
    const create = vi.fn().mockResolvedValue({
      model: "gpt-5.5",
      choices: [{ finish_reason: "length", message: { content: "partial", refusal: null } }],
      usage: { prompt_tokens: 9, completion_tokens: 4 },
    });
    const provider = createOpenAICompatibleProvider("openai", {
      chat: { completions: { create } },
    } as never);

    const result = await provider.generate({
      model: "gpt-5.5",
      system: "Be brief.",
      effort: "medium",
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(create).toHaveBeenCalledWith({
      model: "gpt-5.5",
      messages: [
        { role: "system", content: "Be brief." },
        { role: "user", content: "Hi" },
      ],
      max_completion_tokens: 16000,
      reasoning_effort: "medium",
    });
    expect(result.stopReason).toBe("max_tokens");
    expect(result.text).toBe("partial");
    expect(result.usage).toEqual({ inputTokens: 9, outputTokens: 4 });
  });

  it("labels OpenRouter errors with the provider id", async () => {
    const provider = createOpenAICompatibleProvider("openrouter", {
      chat: { completions: { create: vi.fn().mockRejectedValue(new Error("nope")) } },
    } as never);
    const err = await provider.generate({ model: "x", messages: [] }).catch((e) => e);
    expect(err).toBeInstanceOf(ModelError);
    expect(err.provider).toBe("openrouter");
    expect(err.message).toContain("OpenRouter");
  });
});

describe("registry", () => {
  it("refuses to build a provider without its key", () => {
    expect(isProviderConfigured("openai", {})).toBe(false);
    expect(() => buildProvider("openai", {})).toThrow(/OPENAI_API_KEY is not set/);
  });

  it("builds every provider when keys are present", () => {
    const env = { ANTHROPIC_API_KEY: "a", OPENAI_API_KEY: "b", OPENROUTER_API_KEY: "c" };
    expect(buildProvider("anthropic", env).id).toBe("anthropic");
    expect(buildProvider("openai", env).id).toBe("openai");
    expect(buildProvider("openrouter", env).id).toBe("openrouter");
  });
});

describe("step config", () => {
  it("names a known provider and a model for every step", () => {
    for (const cfg of Object.values(STEP_MODELS)) {
      expect(["anthropic", "openai", "openrouter"]).toContain(cfg.provider);
      expect(cfg.model).not.toBe("");
    }
  });
});
