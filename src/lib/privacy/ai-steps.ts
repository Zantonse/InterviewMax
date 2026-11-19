import { STEP_MODELS, type Step, type StepModel } from "@/lib/ai/config";

// What each model step does and what it reads, in the words the AI usage policy shows. Keyed by
// every step in STEP_MODELS, so a new step can't ship without being listed in the policy.
export const AI_STEP_USES: Record<Step, { feature: string; sends: string }> = {
  storyProbe: {
    feature: "Story builder follow-up questions",
    sends: "Your answers for that story, plus the job and numbers it draws on, your coaching style and your field",
  },
  storyPrefill: {
    feature: "Filling in “Tell me about yourself” from LinkedIn",
    sends: "The text of the LinkedIn PDF you upload",
  },
  roleMap: {
    feature: "Map my role (roles without a ready-made map)",
    sends: "Your job title and role family",
  },
  numbersChecklist: {
    feature: "Your numbers (roles without a ready-made list)",
    sends: "Your job title and role family",
  },
  roleProfile: {
    feature: "Map my role profile",
    sends: "Your answers in Map my role",
  },
  storyWrite: {
    feature: "Writing your story",
    sends: "Your answers for that story, plus the numbers it draws on and, for About me, what your target jobs look for, and your field",
  },
  storyTailor: {
    feature: "About me for one job",
    sends: "Your About me answers, that job’s posting and your field",
  },
  careerPath: {
    feature: "Reading your career path",
    sends: "The text of your resume or LinkedIn PDF",
  },
  storyFind: {
    feature: "Story finder",
    sends: "Your resume, LinkedIn text and role map, or your answers to its questions, and your field",
  },
  storyQuestions: {
    feature: "Also answers (other questions a written story can answer)",
    sends: "The written story, the question it was built for, the questions it's checked against (likely questions for your target jobs, questions from your past interviews and ones asked recently at those companies) and your field",
  },
  storyExec: {
    feature: "Exec version (Exec mode in Settings): a 30-second, answer-first version of a written story",
    sends: "The written story, the question it was built for, your answers behind it and your field",
  },
  storyRecruiter: {
    feature: "Recruiter version: an under-a-minute, plain-words version of a written story for a recruiter screen",
    sends: "The written story, the question it was built for, your answers behind it and your field",
  },
  toughAnswer: {
    feature: "Tough questions",
    sends: "Your answers about that question and, if you pick one, that job’s posting, and your field",
  },
  storyTell: {
    feature: "How to tell it (storytelling coach)",
    sends: "The written story, your answers behind it, its thinking feedback, your target jobs and your field",
  },
  storyAnalyze: {
    feature: "Why it works (what each part of a story gives the interviewer)",
    sends: "The written story, the question it answers, your target jobs and your field",
  },
  storyGrade: {
    feature: "Grading a story",
    sends: "The written story, the story type and your target jobs",
  },
  jobsRead: {
    feature: "Reading your target jobs",
    sends: "Your resume and the job postings you added",
  },
  postingExtract: {
    feature: "Adding a job from a PDF or saved web page",
    sends: "The text of the file you upload",
  },
  postingScreenshot: {
    feature: "Adding a job from screenshots",
    sends: "The screenshots you upload",
  },
  likelyQuestions: {
    feature: "Likely questions",
    sends:
      "The job posting (and how the postings of any other roles you added to the job differ from it), any interview reports or team notes you pasted and your field",
  },
  askQuestions: {
    feature: "Questions to ask the interviewer",
    sends:
      "The job posting, what its interviewers look for, any interview reports or team notes you pasted, the questions you already have and your field",
  },
  jobCurriculum: {
    feature: "Curriculum: the topics to know for a job (beta)",
    sends: "The job posting, what its interviewers look for, any interview reports or team notes you pasted and your field",
  },
  resumeBullets: {
    feature: "Resume bullets for a job",
    sends:
      "Your written stories and the answers behind them, your numbers, your About me, your resume and that job’s posting",
  },
  transcriptRead: {
    feature: "Reviewing a past interview",
    sends: "The transcript you upload or paste",
  },
  transcriptSpeakers: {
    feature: "Marking who said what in a past interview",
    sends: "The transcript you upload or paste, when it has no speaker names, and the job’s title",
  },
  practiceProbe: {
    feature: "Follow-up questions in practice mode and the tough-questions drill",
    sends: "The practice question, your spoken answers to it and the job’s title and level, and your field",
  },
  practiceFeedback: {
    feature: "Feedback in practice mode, AI screen practice and the tough-questions drill",
    sends:
      "Your spoken practice answers, the saved story or tough-question answer (and your answers behind it) for that question, the job’s title, your coaching style and your field",
  },
  casePractice: {
    feature: "Case and technical question practice",
    sends: "The question, your practice answer, the job’s title, your coaching style and your field",
  },
  profileSummary: {
    feature: "Your interviewee profile summary",
    sends:
      "The profile’s results worked out from your stories, grades, numbers, practice and past interviews (story titles, scores and findings), your coaching style and your field",
  },
  ladderRead: {
    feature: "PromotionMax: reading your career ladder (beta)",
    sends: "The career ladder text you paste, with the names you chose to redact replaced",
  },
  promotionPacket: {
    feature: "PromotionMax: your promotion packet (beta)",
    sends:
      "Your written stories and the answers behind them, your numbers, your current and target level and your ladder’s dimensions, with the names you chose to redact replaced",
  },
  transcribe: {
    feature: "Mic mode (speech to text)",
    sends: "The recording of what you say while the mic is on",
  },
};

const VENDORS: Record<string, string> = {
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  openai: "OpenAI",
  google: "Google",
  "meta-llama": "Meta",
  mistralai: "Mistral",
};

// The company whose model runs a step, from its model id ("anthropic/claude-…" → Anthropic).
export function stepVendor(step: Step): string {
  const { provider, model } = STEP_MODELS[step] as StepModel;
  if (provider === "anthropic") return "Anthropic";
  if (provider === "openai") return "OpenAI";
  const prefix = model.split("/")[0];
  return VENDORS[prefix] ?? prefix;
}

// Each step with its feature, what it sends and whose model runs it, in the order STEP_MODELS
// lists them.
export function aiStepRows() {
  return (Object.keys(STEP_MODELS) as Step[]).map((step) => ({
    step,
    ...AI_STEP_USES[step],
    vendor: stepVendor(step),
    viaOpenRouter: STEP_MODELS[step].provider === "openrouter",
  }));
}

// The model companies the app uses today, for the policies' list of who sees data.
export function aiVendors(): string[] {
  return [...new Set((Object.keys(STEP_MODELS) as Step[]).map(stepVendor))].sort();
}
