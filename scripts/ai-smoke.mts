// One test call through each model provider, to check keys and wiring.
// Usage: npm run ai:smoke            (all providers with a key set)
//        npm run ai:smoke -- openai  (just one)
// Reads keys from .env.local. Costs a fraction of a cent per provider.
import { existsSync } from "node:fs";
import { SMOKE_TEST_MODELS } from "../src/lib/ai/config";
import { buildProvider, isProviderConfigured } from "../src/lib/ai/registry";
import type { ProviderId } from "../src/lib/ai/types";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const all: ProviderId[] = ["anthropic", "openai", "openrouter"];
const requested = process.argv.slice(2) as ProviderId[];
const providers = requested.length ? requested : all;

let failed = false;
for (const id of providers) {
  if (!all.includes(id)) {
    console.error(`✗ ${id}: unknown provider (use ${all.join(", ")})`);
    failed = true;
    continue;
  }
  if (!isProviderConfigured(id)) {
    console.log(`– ${id}: skipped, no key set`);
    if (requested.length) failed = true;
    continue;
  }
  const started = Date.now();
  try {
    const result = await buildProvider(id).generate({
      model: SMOKE_TEST_MODELS[id],
      effort: id === "openrouter" ? undefined : "low",
      maxTokens: 2000,
      messages: [{ role: "user", content: "Reply with exactly: InterviewMax ok" }],
    });
    console.log(
      `✓ ${id} (${result.model}, ${Date.now() - started} ms, ${result.usage.inputTokens}+${result.usage.outputTokens} tokens): ${result.text.trim()}`,
    );
  } catch (err) {
    failed = true;
    console.error(`✗ ${id}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

process.exit(failed ? 1 : 0);
