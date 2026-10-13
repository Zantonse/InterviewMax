import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createAnthropicProvider } from "./providers/anthropic";
import { createOpenAICompatibleProvider } from "./providers/openai-compatible";
import { ModelError, type ModelProvider, type ProviderId } from "./types";

const ENV_KEYS: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

type Env = Record<string, string | undefined>;

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function requireKey(provider: ProviderId, env: Env): string {
  const name = ENV_KEYS[provider];
  const key = env[name];
  if (!key) {
    throw new ModelError(`${name} is not set, so ${provider} can't be called.`, provider);
  }
  return key;
}

export function isProviderConfigured(provider: ProviderId, env: Env = process.env) {
  return Boolean(env[ENV_KEYS[provider]]);
}

// Builds a provider from server-side environment variables. Keys never leave the server.
export function buildProvider(provider: ProviderId, env: Env = process.env): ModelProvider {
  const apiKey = requireKey(provider, env);
  switch (provider) {
    case "anthropic":
      return createAnthropicProvider(new Anthropic({ apiKey }));
    case "openai":
      return createOpenAICompatibleProvider("openai", new OpenAI({ apiKey }));
    case "openrouter":
      return createOpenAICompatibleProvider(
        "openrouter",
        new OpenAI({
          apiKey,
          baseURL: OPENROUTER_BASE_URL,
          defaultHeaders: {
            ...(env.NEXT_PUBLIC_SITE_URL ? { "HTTP-Referer": env.NEXT_PUBLIC_SITE_URL } : {}),
            "X-Title": "InterviewMax",
          },
        }),
      );
  }
}

const cache = new Map<ProviderId, ModelProvider>();

export function getProvider(provider: ProviderId): ModelProvider {
  let instance = cache.get(provider);
  if (!instance) {
    instance = buildProvider(provider);
    cache.set(provider, instance);
  }
  return instance;
}
