// The six core story types that seed the bank (PRD, step 4), and the scripted
// questions the builder asks for every story. No model call is involved here.

export const STORY_TYPES = [
  {
    id: "major_project",
    label: "A major project or customer",
    blurb: "The work you'd most want an interviewer to hear about.",
    themes: ["impact", "ownership", "execution"],
    opening:
      "Think of a major project or customer you're proud of. Where were you working, what was your role, and what was the situation when it started?",
  },
  {
    id: "difficult_stakeholder",
    label: "A difficult stakeholder",
    blurb: "Someone who pushed back, and how you moved them.",
    themes: ["influence", "conflict", "communication"],
    opening:
      "Think of a stakeholder who was hard to work with. Who were they, what was your role, and what was going on when things got difficult?",
  },
  {
    id: "went_wrong",
    label: "Something that went wrong",
    blurb: "A miss or a failure, and what you did about it.",
    themes: ["failure", "resilience", "learning"],
    opening:
      "Think of a time something went wrong on your watch. What was your role, and what was the situation before it went wrong?",
  },
  {
    id: "prioritization",
    label: "How you prioritize",
    blurb: "Too much to do, and how you chose what came first.",
    themes: ["prioritization", "judgment", "time management"],
    opening:
      "Think of a time you had more work than time. What was your role, and what was competing for your attention?",
  },
  {
    id: "cross_team",
    label: "Cross-team work",
    blurb: "Getting something done with people outside your team.",
    themes: ["collaboration", "influence", "cross-functional"],
    opening:
      "Think of a time you had to get something done with another team. Which teams were involved, what was your role, and what was the situation at the start?",
  },
  {
    id: "defining_success",
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

// The parts of a finished story, in the order it is told.
export const STORY_PARTS = [
  { id: "situation", label: "Situation" },
  { id: "role", label: "Your role" },
  { id: "actions", label: "What you did" },
  { id: "result", label: "Result" },
  { id: "reflection", label: "What you learned" },
] as const;

export type StoryPartId = (typeof STORY_PARTS)[number]["id"];

// The same core questions for every story. `part` is where the answer lands in the story panel.
export const CORE_QUESTIONS = [
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
] as const satisfies readonly { id: string; part: StoryPartId; text: string }[];

export type CoreQuestionId = (typeof CORE_QUESTIONS)[number]["id"];

export function coreQuestionText(questionId: CoreQuestionId, storyType: StoryType | undefined) {
  if (questionId === "start") {
    return storyType?.opening ?? "What was the situation at the start, and what was your role?";
  }
  return CORE_QUESTIONS.find((q) => q.id === questionId)!.text;
}

export const MAX_ANSWER_LENGTH = 4000;
