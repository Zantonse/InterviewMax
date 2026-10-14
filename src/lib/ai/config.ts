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
  // Map my role: list the usual parts of a job function that has no hand-written map.
  roleMap: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Numbers checklist: list the numbers a story needs for a role with no hand-written list.
  numbersChecklist: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Map my role: write the one-page role profile from the user's answers.
  roleProfile: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "medium" },
  // Story builder, call two: write the story from the user's own answers.
  storyWrite: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "medium" },
  // "Tell me about yourself" for one target job: company first, three beats, under 90 seconds.
  storyTailor: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "medium" },
  // "Tell me about yourself": read the career path from a resume or LinkedIn profile to confirm.
  careerPath: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Model grade (Context, Ownership, Reflection, level). A different vendor from the writer.
  storyGrade: { provider: "openrouter", model: "openai/gpt-5.5", effort: "medium" },
  // Target jobs: read the resume and every job posting together (what they share, how each differs).
  jobsRead: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Likely questions: predict one target job's behavioral questions from the themes, its posting
  // and any interview reports the user pasted.
  likelyQuestions: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Past interviews: read one real interview transcript for what was asked and probed, and how
  // each answer landed. Every finding is quoted from the transcript and checked in code.
  transcriptRead: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
} as const satisfies Record<string, StepModel>;

export type Step = keyof typeof STEP_MODELS;

// Model used for each provider's one-call connectivity check (npm run ai:smoke).
export const SMOKE_TEST_MODELS: Record<ProviderId, string> = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-5.5",
  openrouter: "openrouter/auto",
};
