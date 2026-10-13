import type { ChatMessage } from "@/lib/ai/types";
import { extractJson } from "@/lib/stories/prompts";
import { STORY_TYPES, REQUIRED_STORY_TYPE_ID } from "@/lib/stories/story-types";
import { type RoleFunction, WORK_QUESTIONS } from "./families";
import { FUNCTION_MARKS, type RoleMap, functionsMarked, roleVocabulary } from "./role-map";

// The two model calls in "Map my role":
//   roleMap:     for a role with no hand-written map, list the usual parts of that function
//   roleProfile: write the one-page role profile from the user's answers and marks

export const FUNCTION_MAP_SYSTEM = `You are a career coach helping someone who did one slice of a job function and doesn't yet have words for it. From their job title and answers about their work, identify the job function and list its usual parts, as the profession itself would describe them: the whole function, not only what they did. They will mark each part as owned, contributed to, or not theirs.

Rules:
- List 6 to 9 parts. Each is a distinct area of work people in this function are hired for.
- Use the plain names job posts and interviewers use.
- blurb: one short line describing the work so they can recognise it. Don't refer to them or their answers.
- terms: 2 to 4 words or phrases interviewers and job posts use for that part.

Reply with JSON only, no other text:
{"function": "the function's name", "parts": [{"id": "snake_case_id", "label": "…", "blurb": "…", "terms": ["…"]}]}`;

export const ROLE_PROFILE_SYSTEM = `You are a career coach writing a one-page role profile for someone who struggles to describe their own work. It will help them answer "Tell me about yourself" and choose which interview stories to prepare.

The hard rule: every statement must come from their own answers or the parts of the function they marked. Never add responsibilities, tools, results, employers or numbers they didn't give. Copy every number exactly as they wrote it, keeping words like "about" or "estimated". If something is missing, leave it out. You may use the function's vocabulary they were given to name work they described; that is giving words to what they did, not adding facts.

Treat a slice of a function as a specialty, not a gap: describe what they owned with confidence and precision.

Write:
- scope: 2 to 3 sentences in the first person, in plain spoken words, on what their role was: the team, what they owned, who relied on them, and any sizes they gave.
- strengths: 3 to 5 short first-person lines, each a specific strength shown by something in their answers ("I'm the person teams come to for …").
- fit: 1 to 2 first-person sentences on how this work lines up with the role they're going after. If they didn't say what they're going after, return an empty string.
- storyIdeas: 2 or 3 interview stories worth building first, each a story type id from this list and a one-line reason that points to something specific in their answers:
${STORY_TYPES.filter((t) => t.id !== REQUIRED_STORY_TYPE_ID)
  .map((t) => `  - ${t.id}: ${t.label}`)
  .join("\n")}

Reply with JSON only, no other text:
{"scope": "…", "strengths": ["…"], "fit": "…", "storyIdeas": [{"storyType": "…", "why": "…"}]}`;

export function functionMapMessages(answers: Record<string, string>): ChatMessage[] {
  return [{ role: "user", content: `Here is what I did.\n\n${workTranscript(answers)}` }];
}

export function profileMessages(map: RoleMap, roleName: string): ChatMessage[] {
  const lines = [workTranscript(map.answers), "", `Job function: ${roleName}`];
  for (const mark of FUNCTION_MARKS) {
    const parts = functionsMarked(map, mark.id);
    if (parts.length) lines.push(`${mark.label}: ${parts.map((f) => f.label).join(", ")}`);
  }
  const words = roleVocabulary(map);
  if (words.length)
    lines.push(`Words for the parts I owned or contributed to: ${words.join(", ")}`);
  return [{ role: "user", content: `Write my role profile from this.\n\n${lines.join("\n")}` }];
}

function workTranscript(answers: Record<string, string>): string {
  return WORK_QUESTIONS.flatMap((q) => {
    const answer = answers[q.id]?.trim();
    return answer ? [`Q: ${q.text}`, `A: ${answer}`, ""] : [];
  })
    .join("\n")
    .trim();
}

export function parseFunctionMap(text: string): { name: string; functions: RoleFunction[] } {
  const json = extractJson(text);
  const list = isRecord(json) && Array.isArray(json.parts) ? json.parts : null;
  if (!list) throw new Error("The role map came back in an unexpected format.");
  const seen = new Set<string>();
  const functions = list.filter(isRecord).flatMap((p) => {
    const label = typeof p.label === "string" ? p.label.trim() : "";
    const id = slug(typeof p.id === "string" && p.id ? p.id : label);
    if (!label || !id || seen.has(id)) return [];
    seen.add(id);
    return [
      {
        id,
        label: label.slice(0, 80),
        blurb: typeof p.blurb === "string" ? p.blurb.trim().slice(0, 200) : "",
        terms: Array.isArray(p.terms)
          ? p.terms
              .filter((t): t is string => typeof t === "string" && Boolean(t.trim()))
              .map((t) => t.trim().slice(0, 60))
              .slice(0, 4)
          : [],
      },
    ];
  });
  if (functions.length < 3) throw new Error("The role map came back too short. Try again.");
  const name = isRecord(json) && typeof json.function === "string" ? json.function.trim() : "";
  return { name: name.slice(0, 80), functions: functions.slice(0, 10) };
}

export function parseProfile(
  text: string,
): Omit<RoleMap["profile"] & object, "model" | "writtenAt"> {
  const json = extractJson(text);
  if (!isRecord(json) || typeof json.scope !== "string") {
    throw new Error("The role profile came back in an unexpected format.");
  }
  const storyTypeIds = new Set<string>(STORY_TYPES.map((t) => t.id));
  return {
    scope: json.scope.trim(),
    strengths: Array.isArray(json.strengths)
      ? json.strengths
          .filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
          .map((s) => s.trim())
          .slice(0, 5)
      : [],
    fit: typeof json.fit === "string" ? json.fit.trim() : "",
    storyIdeas: Array.isArray(json.storyIdeas)
      ? json.storyIdeas
          .filter(isRecord)
          .flatMap((s) =>
            typeof s.storyType === "string" &&
            storyTypeIds.has(s.storyType) &&
            s.storyType !== REQUIRED_STORY_TYPE_ID &&
            typeof s.why === "string"
              ? [{ storyType: s.storyType, why: s.why.trim() }]
              : [],
          )
          .slice(0, 3)
      : [],
  };
}

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
