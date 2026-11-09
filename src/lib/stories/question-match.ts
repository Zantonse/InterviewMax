import type { StoryTypeId } from "./story-types";

// The story type that best answers an interview question the user typed in their own words.
// Simulated users with a specific question ("spotting a problem nobody asked you to look for")
// couldn't find a story type for it and gave up (2026-11-08), so any question can start a story:
// it's matched here in code (no model call, so it's instant), and anything that matches nothing
// becomes a major project story, the plain STAR shape that fits most questions.
//
// Checked in order; the first rule with a match wins, so the narrower rules come first.
const RULES: { type: StoryTypeId; re: RegExp }[] = [
  { type: "ai_use", re: /\b(ai|a\.i\.|chatgpt|gpt|llms?|copilot|gen ?ai|machine learning|automation tools?)\b/i },
  {
    type: "about_me",
    re: /\b(about yourself|walk me through your (resume|background|career)|why (this|our) (role|company|team)|why (are you|do you want)|introduce yourself)\b/i,
  },
  {
    type: "defining_success",
    re: /\b(measure success|define success|success (look like|in (your|this) role)|first (30|60|90) days|what does good look like)\b/i,
  },
  {
    // Initiative: a problem nobody asked about is a project story, not a failure story.
    type: "major_project",
    re: /\b(nobody|no one|before anyone|without being asked|outside (your|the) (job|role|scope)|took the initiative|on your own|proud(est)?|biggest (accomplishment|achievement|impact))\b/i,
  },
  {
    type: "went_wrong",
    re: /\b(fail(ed|ure)?|mistake|went wrong|go wrong|setback|miss(ed)?|mess|crisis|incident|outage|escalation|under pressure|audit|recover(ed)?|broke|bug)\b/i,
  },
  {
    type: "difficult_stakeholder",
    re: /\b(disagree(d|ment)?|conflict|push(ed)? back|difficult|tough (customer|client|person)|persuade|convince|change (their|someone'?s) mind|buy-in|upset|angry|said no|stakeholder)\b/i,
  },
  {
    type: "cross_team",
    re: /\b(other teams?|another team|cross[- ]functional|across teams|several teams|align(ed|ing)?|collaborat\w*|partner(ed)?|product and engineering|engineering and product)\b/i,
  },
  {
    type: "prioritization",
    re: /\b(priorit\w*|too much|competing|trade-?offs?|deadlines?|incomplete information|ambigu\w*|plan changed|no clear direction|unclear|suddenly|tough (call|decision)|decide|decision)\b/i,
  },
];

export const FALLBACK_TYPE: StoryTypeId = "major_project";

export function storyTypeForQuestion(question: string): StoryTypeId {
  const text = question.replace(/\s+/g, " ").trim();
  return RULES.find((r) => r.re.test(text))?.type ?? FALLBACK_TYPE;
}
