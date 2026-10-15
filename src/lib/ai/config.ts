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
  // Story finder: point at moments in the resume, LinkedIn profile and role map that could become
  // stories, each quoting the line it comes from (quotes and numbers checked in code).
  storyFind: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Tough-questions coach: a short, honest answer to one awkward question (why leaving, a gap,
  // salary…) from the user's answers about their situation. Numbers checked in code.
  toughAnswer: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "medium" },
  // Model grade (Context, Ownership, Reflection, level). A different vendor from the writer.
  storyGrade: { provider: "openrouter", model: "openai/gpt-5.5", effort: "medium" },
  // Target jobs: read the resume and every job posting together (what they share, how each differs).
  jobsRead: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Target jobs: pick the posting out of a job page saved as PDF or web page (copied lines only,
  // checked in code).
  postingExtract: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Target jobs: copy a posting's text out of screenshots. Needs a model that can see images.
  postingScreenshot: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Likely questions: predict one target job's behavioral questions from the themes, its posting
  // and any interview reports the user pasted.
  likelyQuestions: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Past interviews: read one real interview transcript for what was asked and probed, and how
  // each answer landed. Every finding is quoted from the transcript and checked in code.
  transcriptRead: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Practice mode: a skeptical interviewer asks one follow-up at a time, aimed at the weakest part
  // of a spoken answer. Kept light: the user is waiting between answers.
  practiceProbe: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Practice mode: feedback on one answer and its follow-ups against the saved story, and the new
  // details worth adding to it (each quoted from what the user said and checked in code).
  practiceFeedback: { provider: "openrouter", model: "anthropic/claude-opus-5.5", effort: "low" },
  // Mic mode: write down what the user said. A speech-to-text model, not a chat model, called
  // through OpenRouter's /audio/transcriptions (the Claude API has no speech to text). Whisper
  // Large V3: about 3 cents an hour of talking, good with noisy audio (picked Oct 14).
  transcribe: { provider: "openrouter", model: "openai/whisper-large-v3" },
} as const satisfies Record<string, StepModel>;

export type Step = keyof typeof STEP_MODELS;

// Model used for each provider's one-call connectivity check (npm run ai:smoke).
export const SMOKE_TEST_MODELS: Record<ProviderId, string> = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-5.5",
  openrouter: "openrouter/auto",
};
