import type { StoryTypeId } from "@/lib/stories/story-types";

// The behavioral question themes and their question templates (PRD, step 2). Scripted: the
// model ranks and tailors questions per job, but every question it returns belongs to one of these
// themes, and each theme names the story types that answer it.

export const QUESTION_THEMES = [
  {
    id: "about_you",
    label: "About you",
    storyTypes: ["about_me"],
    templates: [
      "Tell me about yourself.",
      "Why are you interested in this role, and why now?",
      "Walk me through your resume.",
    ],
  },
  {
    id: "impact",
    label: "Impact and results",
    storyTypes: ["major_project", "defining_success"],
    templates: [
      "Tell me about the accomplishment you're most proud of.",
      "Tell me about a time you exceeded a goal or target.",
    ],
  },
  {
    id: "ownership",
    label: "Ownership and initiative",
    storyTypes: ["major_project", "went_wrong"],
    templates: [
      "Tell me about a time you took on something outside your job description.",
      "Tell me about a problem you spotted and fixed before anyone asked.",
    ],
  },
  {
    id: "conflict",
    label: "Conflict and difficult people",
    storyTypes: ["difficult_stakeholder"],
    templates: [
      "Tell me about a time you disagreed with a manager or a peer.",
      "Tell me about a difficult customer or stakeholder and how you handled them.",
    ],
  },
  {
    id: "influence",
    label: "Influence without authority",
    storyTypes: ["difficult_stakeholder", "cross_team"],
    templates: [
      "Tell me about a time you persuaded someone to change their mind.",
      "Tell me about a time you got buy-in for an idea without having authority.",
    ],
  },
  {
    id: "failure",
    label: "Failure and learning",
    storyTypes: ["went_wrong"],
    templates: [
      "Tell me about a time you failed.",
      "Tell me about a mistake you made and what you did about it.",
    ],
  },
  {
    id: "prioritization",
    label: "Prioritization and judgment",
    storyTypes: ["prioritization"],
    templates: [
      "Tell me about a time you had too much to do. How did you decide what came first?",
      "Tell me about a decision you made with incomplete information.",
    ],
  },
  {
    id: "collaboration",
    label: "Cross-team collaboration",
    storyTypes: ["cross_team"],
    templates: [
      "Tell me about a project where you worked closely with another team.",
      "Tell me about a time you had to align several teams on one goal.",
    ],
  },
  {
    id: "ambiguity",
    label: "Ambiguity and change",
    storyTypes: ["prioritization", "went_wrong"],
    templates: [
      "Tell me about a time the plan changed suddenly. What did you do?",
      "Tell me about a time you worked on something with no clear direction.",
    ],
  },
  {
    id: "success",
    label: "Success in the role",
    storyTypes: ["defining_success", "major_project"],
    templates: [
      "How do you measure success in your role?",
      "What would you focus on in your first 90 days here?",
    ],
  },
  {
    // PRD, interview trends 2026: now asked for most roles, so it's a default likely question.
    id: "ai_use",
    label: "Using AI at work",
    storyTypes: ["ai_use"],
    templates: [
      "Tell me about a time you used AI at work.",
      "How do you check work that AI helped you produce?",
    ],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  storyTypes: readonly StoryTypeId[];
  templates: readonly string[];
}[];

export type QuestionTheme = (typeof QUESTION_THEMES)[number];
export type QuestionThemeId = QuestionTheme["id"];

// The question every job's likely questions include, for the theme every job now asks about.
export const AI_USE_QUESTION = {
  question: "Tell me about a time you used AI at work.",
  theme: "ai_use",
  why: "now asked in most interviews",
} as const;

export function getTheme(id: string | null | undefined): QuestionTheme | undefined {
  return QUESTION_THEMES.find((t) => t.id === id);
}
