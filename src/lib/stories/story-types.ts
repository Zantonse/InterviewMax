// The story types that seed the bank (PRD, step 4), and the scripted questions the builder asks.
// No model call is involved here. "Tell me about yourself" is a career introduction, so it has its
// own questions and parts; the six behavioral types share the STAR-style ones.

export const STORY_TYPES = [
  {
    id: "about_me",
    format: "intro",
    label: "Tell me about yourself",
    blurb: "The opener in almost every interview: your career in about a minute.",
    themes: ["introduction", "career story", "motivation"],
    opening: "",
  },
  {
    id: "major_project",
    format: "star",
    label: "A major project or customer",
    blurb: "The work you'd most want an interviewer to hear about.",
    themes: ["impact", "ownership", "execution"],
    opening:
      "Think of a major project or customer you're proud of. Where were you working, what was your role, and what was the situation when it started?",
  },
  {
    id: "difficult_stakeholder",
    format: "star",
    label: "A difficult stakeholder",
    blurb: "Someone who pushed back, and how you moved them.",
    themes: ["influence", "conflict", "communication"],
    opening:
      "Think of a stakeholder who was hard to work with. Who were they, what was your role, and what was going on when things got difficult?",
  },
  {
    id: "went_wrong",
    format: "star",
    label: "Something that went wrong",
    blurb: "A miss or a failure, and what you did about it.",
    themes: ["failure", "resilience", "learning"],
    opening:
      "Think of a time something went wrong on your watch. What was your role, and what was the situation before it went wrong?",
  },
  {
    id: "prioritization",
    format: "star",
    label: "How you prioritize",
    blurb: "Too much to do, and how you chose what came first.",
    themes: ["prioritization", "judgment", "time management"],
    opening:
      "Think of a time you had more work than time. What was your role, and what was competing for your attention?",
  },
  {
    id: "cross_team",
    format: "star",
    label: "Cross-team work",
    blurb: "Getting something done with people outside your team.",
    themes: ["collaboration", "influence", "cross-functional"],
    opening:
      "Think of a time you had to get something done with another team. Which teams were involved, what was your role, and what was the situation at the start?",
  },
  {
    id: "defining_success",
    format: "star",
    label: "How you define success in your role",
    blurb: "What good looks like in your job, shown through one example.",
    themes: ["impact", "metrics", "role fit"],
    opening:
      "Think of a stretch of work that shows what success looks like in your role. What was your role, and what did success need to look like at the start?",
  },
] as const;

export type StoryTypeId = (typeof STORY_TYPES)[number]["id"];
export type StoryType = (typeof STORY_TYPES)[number];

export function getStoryType(id: string | null | undefined): StoryType | undefined {
  return STORY_TYPES.find((t) => t.id === id);
}

export type StoryFormat = StoryType["format"];

export type StoryPart = { id: string; label: string };
// `part` is where the answer lands in the story panel.
export type CoreQuestion = { id: string; part: string; text: string };

// The parts of a behavioral story, in the order it is told.
export const STAR_PARTS = [
  { id: "situation", label: "Situation" },
  { id: "role", label: "Your role" },
  { id: "actions", label: "What you did" },
  { id: "result", label: "Result" },
  { id: "reflection", label: "What you learned" },
] as const satisfies readonly StoryPart[];

// The same core questions for every behavioral story.
export const STAR_QUESTIONS = [
  { id: "start", part: "situation", text: "" }, // replaced by the story type's opening question
  {
    id: "stakes",
    part: "situation",
    text: "What was at stake? What would have happened if this had gone badly: for a customer, revenue, a deadline or your team?",
  },
  {
    id: "resources",
    part: "role",
    text: "What did you have to work with (people, budget, time, tools), and what was missing?",
  },
  {
    id: "ownership",
    part: "role",
    text: "What was your part specifically? What did you own yourself, as opposed to the wider team?",
  },
  {
    id: "steps",
    part: "actions",
    text: "Walk me through what you did, step by step.",
  },
  {
    id: "choice",
    part: "actions",
    text: "Where did you have to choose between options? What were they, and why did you pick the one you did?",
  },
  {
    id: "result",
    part: "result",
    text: "What was the result in real terms? Give a number if you have one: revenue, time saved, a percentage, a count. If it's an estimate, say so.",
  },
  {
    id: "lesson",
    part: "reflection",
    text: "What did you learn, and what would you do differently next time?",
  },
] as const satisfies readonly CoreQuestion[];

// The parts of a "Tell me about yourself" answer: present, past, proof, then future.
export const INTRO_PARTS = [
  { id: "present", label: "Where you are now" },
  { id: "path", label: "How you got here" },
  { id: "highlight", label: "A result you're proud of" },
  { id: "strengths", label: "What you're known for" },
  { id: "next", label: "Why this next role" },
] as const satisfies readonly StoryPart[];

export const INTRO_QUESTIONS = [
  {
    id: "now",
    part: "present",
    text: "Let's start with today. What's your current role, where do you work, and what are you responsible for? Include the size of your team, territory or budget if that's relevant.",
  },
  {
    id: "path",
    part: "path",
    text: "How did you get here? Walk me through the two or three career moves that matter most, and why you made each one.",
  },
  {
    id: "highlight",
    part: "highlight",
    text: "What's one result from your career you're most proud of? What did you do, and what was the outcome in real terms? Give a number if you have one. If it's an estimate, say so.",
  },
  {
    id: "known_for",
    part: "strengths",
    text: "What are you known for? What do colleagues, customers or managers come to you for?",
  },
  {
    id: "next",
    part: "next",
    text: "What are you looking for next, and why? What kind of role or company, and what draws you to it?",
  },
] as const satisfies readonly CoreQuestion[];

export function storyParts(storyType: StoryType | undefined): readonly StoryPart[] {
  return storyType?.format === "intro" ? INTRO_PARTS : STAR_PARTS;
}

export function coreQuestions(storyType: StoryType | undefined): readonly CoreQuestion[] {
  return storyType?.format === "intro" ? INTRO_QUESTIONS : STAR_QUESTIONS;
}

export function coreQuestionText(questionId: string, storyType: StoryType | undefined) {
  if (questionId === "start" && storyType?.format !== "intro") {
    return storyType?.opening || "What was the situation at the start, and what was your role?";
  }
  return coreQuestions(storyType).find((q) => q.id === questionId)?.text ?? "";
}

export const MAX_ANSWER_LENGTH = 4000;

// Each user keeps one "Tell me about yourself"; it's suggested first but doesn't gate the others.
export const REQUIRED_STORY_TYPE_ID = "about_me";

// A prepared "Tell me about yourself" answer can be uploaded instead of answering the questions.
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const MAX_IMPORTED_LENGTH = 12000;
export const UPLOAD_EXTENSIONS = [".docx", ".txt", ".md"] as const;

// A LinkedIn profile saved as PDF (Profile > More > Save to PDF) can fill in the answers it covers.
export const MAX_PROFILE_LENGTH = 30000;
