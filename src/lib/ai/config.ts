import type { Effort, ProviderId } from "./types";

// Which provider and model each step of the app uses.
// Switching a step to another model is a change here, not in code.
// For now every step runs through OpenRouter (decided Oct 13), so only OPENROUTER_API_KEY is needed.
// To move a step to the direct Claude or OpenAI API, change its provider to "anthropic" or "openai"
// and use that API's model id (e.g. "claude-opus-5-5"). OpenRouter slugs look like "vendor/model".
// These are starting points: the grader's eval harness will settle the final picks.

export type StepModel = {
  provider: ProviderId;
  model: string;
  effort?: Effort;
  maxTokens?: number;
};

export const STEP_MODELS = {
  // Story builder, call one: assess the user's answers and ask 2–3 follow-ups.
  storyProbe: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Story builder, "Tell me about yourself": fill in the answers a LinkedIn profile already covers.
  storyPrefill: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Story builder, call two: write the story from the user's own answers.
  storyWrite: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "medium" },
  // Model grade (Context, Ownership, Reflection, level). A different vendor from the writer.
  storyGrade: { provider: "openrouter", model: "openai/gpt-5.5", effort: "medium" },
  // Target jobs: read the resume and every job posting together (what they share, how each differs).
  jobsRead: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Likely questions: predict one target job's behavioral questions from the themes, its posting
  // and any interview reports the user pasted.
  likelyQuestions: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
} as const satisfies Record<string, StepModel>;

export type Step = keyof typeof STEP_MODELS;

// Model used for each provider's one-call connectivity check (npm run ai:smoke).
export const SMOKE_TEST_MODELS: Record<ProviderId, string> = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-5.5",
  openrouter: "openrouter/auto",
};
