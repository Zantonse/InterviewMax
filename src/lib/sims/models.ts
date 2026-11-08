// Which OpenRouter models play the personas and write the insights report in simulated-user runs
// (scripts/sims). Only the runner uses these: the app's own steps (builder, grader) keep the
// models in src/lib/ai/config.ts, so the runs test what real users get.
//
// Persona models come from different vendors on purpose: each writes differently (chatty, terse,
// vague, polished), which is the point. Edit this list to swap them. A slug OpenRouter doesn't
// list on the day is skipped with a note in the report. Mistral Small and Qwen were dropped
// 2026-11-08: over three rounds they often gave no valid action, which read as the app failing.

export const PERSONA_MODELS: readonly string[] = [
  "google/gemini-2.5-flash",
  "meta-llama/llama-3.3-70b-instruct",
  "openai/gpt-oss-120b",
  "anthropic/claude-haiku-5.5",
];

// Reads every transcript and writes the report: cheap, with a long context (Craig, Nov 7:
// "cheap report"). The first one OpenRouter lists is used.
export const ANALYST_MODELS: readonly string[] = [
  "google/gemini-2.5-flash",
  "openai/gpt-oss-120b",
  "deepseek/deepseek-v4.1-flash",
];

// Pairs each persona with a model, rotating with the run number so that, over a few runs, every
// persona is played by every model. Unavailable models are skipped.
export function assignModels(
  personaIds: readonly string[],
  runNumber: number,
  models: readonly string[] = PERSONA_MODELS,
): Record<string, string> {
  if (models.length === 0) throw new Error("No persona models are available.");
  const start = ((Math.floor(runNumber) % models.length) + models.length) % models.length;
  return Object.fromEntries(personaIds.map((id, i) => [id, models[(start + i) % models.length]]));
}

// Keeps the configured order, dropping slugs the catalog doesn't have. With no catalog (the
// listing failed), keeps everything and lets the calls fail loudly.
export function availableModels(
  wanted: readonly string[],
  catalog: ReadonlySet<string> | null,
): { ok: string[]; missing: string[] } {
  if (!catalog) return { ok: [...wanted], missing: [] };
  return {
    ok: wanted.filter((m) => catalog.has(m)),
    missing: wanted.filter((m) => !catalog.has(m)),
  };
}
