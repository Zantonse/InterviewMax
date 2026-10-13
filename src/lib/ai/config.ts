import type { Effort, ProviderId } from "./types";

// Which provider and model each step of the app uses.
// Switching a step to another model is a change here, not in code.
// Claude and OpenAI are the defaults while the direct-API credits last;
// any OpenRouter model can be named with provider "openrouter" and its slug (e.g. "google/…").
// These are starting points: the grader's eval harness will settle the final picks.

export type StepModel = {
  provider: ProviderId;
  model: string;
  effort?: Effort;
  maxTokens?: number;
};

export const STEP_MODELS = {
  // Story builder, call one: assess the user's answers and ask 2–3 follow-ups.
  storyProbe: { provider: "anthropic", model: "claude-opus-5-5", effort: "medium" },
  // Story builder, call two: write the story from the user's own answers.
  storyWrite: { provider: "anthropic", model: "claude-opus-5-5", effort: "medium" },
  // Model grade (Context, Ownership, Reflection, level). A different vendor from the writer.
  storyGrade: { provider: "openai", model: "gpt-5.5", effort: "medium" },
} as const satisfies Record<string, StepModel>;

export type Step = keyof typeof STEP_MODELS;

// Model used for each provider's one-call connectivity check (npm run ai:smoke).
export const SMOKE_TEST_MODELS: Record<ProviderId, string> = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-5.5",
  openrouter: "openrouter/auto",
};
