import type { ChatMessage } from "@/lib/ai/types";
import { isRecord } from "@/lib/jobs/content";
import { extractJson } from "@/lib/stories/prompts";
import { getStoryType } from "@/lib/stories/story-types";
import {
  FINDER_THEMES,
  MAX_MOMENTS,
  MIN_MOMENTS,
  checkMoments,
  type FinderSource,
  type StoryMoment,
} from "./content";

// The model call in the story finder ("storyFind"): point at moments in the user's own documents
// that could become interview stories. It suggests; it never adds facts. Every quote and number it
// returns is checked in code (content.ts checkMoments).

const SOURCE_HEADINGS: Record<FinderSource["id"], string> = {
  resume: "My resume",
  linkedin: "My LinkedIn profile",
  role_map: "My answers about my role",
  answers: "My answers about my recent work",
};

export const FINDER_SYSTEM = `You are an interview coach helping an experienced professional who says "I don't have any good stories". Read what they've written about their work and point out moments in it that could become behavioral interview stories.

The themes, and the story types that answer each one:
${FINDER_THEMES.map(
  (t) =>
    `- ${t.id} (${t.label}): story types ${t.storyTypes.join(", ")}. Asked as: ${t.templates[0]}`,
).join("\n")}

Rules:
- Return ${MIN_MOMENTS} to ${MAX_MOMENTS} moments, spread across as many themes as the material supports. Themes listed as "not covered yet" come first.
- Every moment must point at something actually in their text: a project, a launch, a migration, a customer, a team change, a target, a reorg. Copy the line it comes from into "quote", word for word, as one continuous piece of their text (at least four words). Don't paraphrase, fix or join lines in the quote.
- Never invent achievements, outcomes, numbers, names or details. Only use a number if it appears in the quoted line. Don't claim it went well or badly unless the text says so; ask instead.
- "moment" names the moment in a few words, from their text, e.g. "The billing migration at Acme".
- "question" is a short prompt for what it could show, starting with "a time you", ending with "?", e.g. "a time you led through ambiguity?". Something that might have gone wrong is a question, not a claim: "a time something didn't go to plan?".
- One moment can fit several themes; pick the one it fits best and don't repeat it.
- Prefer recent, substantial work over small tasks.
- "storyType" is one of the story types listed for the theme.
- "source" says which part of their text the quote is from: resume, linkedin, role_map or answers.

Reply with JSON only, no other text:
{"moments": [{"theme": "one of ${FINDER_THEMES.map((t) => t.id).join(", ")}", "storyType": "…", "moment": "…", "question": "a time you …?", "quote": "…", "source": "resume|linkedin|role_map|answers"}]}`;

export function finderMessages(input: {
  sources: FinderSource[];
  // Themes with no story yet.
  emptyThemes: string[];
  // Story types they've already built, so suggestions favour what's missing.
  builtTypes: string[];
}): ChatMessage[] {
  const lines = input.sources.map((s) => `## ${SOURCE_HEADINGS[s.id]}\n${s.text.trim()}`);
  const empty = FINDER_THEMES.filter((t) => input.emptyThemes.includes(t.id));
  lines.push(
    "",
    empty.length > 0
      ? `## Themes not covered yet\n${empty.map((t) => `- ${t.id} (${t.label})`).join("\n")}`
      : "Every theme has at least one story; suggest the strongest moments for any theme.",
  );
  const built = input.builtTypes.flatMap((id) => getStoryType(id)?.label ?? []);
  if (built.length > 0) {
    lines.push("", `## Stories I've already started\n${built.map((b) => `- ${b}`).join("\n")}`);
  }
  return [
    {
      role: "user",
      content: `Find moments in my work that could become interview stories.\n\n${lines.join("\n")}`,
    },
  ];
}

export function parseFinderReply(text: string, sources: FinderSource[]): StoryMoment[] {
  const json = extractJson(text);
  if (!isRecord(json)) throw new Error("The suggestions came back in an unexpected format.");
  return checkMoments(json.moments, sources);
}
