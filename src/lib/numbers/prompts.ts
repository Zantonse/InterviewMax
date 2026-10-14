import type { ChatMessage } from "@/lib/ai/types";
import { extractJson } from "@/lib/stories/prompts";
import { STORY_TYPES } from "@/lib/stories/story-types";
import type { NumberItem } from "./families";

// The one model call in the numbers checklist: for a role with no hand-written list, draft the
// numbers a strong interview story in that role needs and where to find each. It names numbers
// only; it never suggests a value.

export const NUMBERS_SYSTEM = `You are an interview coach helping an experienced professional gather the numbers their behavioral interview stories need. Given their role, list the numbers interviewers for that role expect to hear, and where someone in the role would look each one up.

Rules:
- List 6 to 9 numbers. Cover scale (how big their scope was), results (what changed because of them, ideally before and after) and reach (how many people or teams relied on their work).
- label: what to fill in, in plain words, addressed to them ("Accounts you managed"). No example values.
- why: one short line on what the number shows an interviewer.
- where: one short line on where to find it: the system, report or person that has it. Never give a figure, a benchmark or a typical range.
- storyTypes: 1 to 4 story type ids it usually fits, from this list:
${STORY_TYPES.map((t) => `  - ${t.id}: ${t.label}`).join("\n")}

Reply with JSON only, no other text:
{"role": "the role's name", "numbers": [{"id": "snake_case_id", "label": "…", "why": "…", "where": "…", "storyTypes": ["…"]}]}`;

export function numbersMessages(roleName: string, context: string): ChatMessage[] {
  const background = context.trim() ? `\n\nWhat I've said about my work:\n${context.trim()}` : "";
  return [{ role: "user", content: `My role: ${roleName}${background}` }];
}

export const MIN_DRAFTED = 4;
const MAX_DRAFTED = 10;

export function parseNumbersDraft(text: string): { role: string; items: NumberItem[] } {
  const json = extractJson(text);
  const list = isRecord(json) && Array.isArray(json.numbers) ? json.numbers : null;
  if (!list) throw new Error("The numbers checklist came back in an unexpected format.");
  const storyTypeIds = new Set<string>(STORY_TYPES.map((t) => t.id));
  const seen = new Set<string>();
  const items = list.filter(isRecord).flatMap((n): NumberItem[] => {
    const label = text_(n.label, 100);
    const id = slug(typeof n.id === "string" && n.id ? n.id : label);
    const why = text_(n.why, 200);
    const where = text_(n.where, 200);
    // A figure in the help text would read as a suggested value; drop the line rather than risk it.
    if (!label || !id || seen.has(id) || /\d/.test(why) || /\d/.test(where)) return [];
    seen.add(id);
    return [
      {
        id,
        label,
        why,
        where,
        storyTypes: Array.isArray(n.storyTypes)
          ? n.storyTypes.filter((t): t is string => typeof t === "string" && storyTypeIds.has(t))
          : [],
      },
    ];
  });
  if (items.length < MIN_DRAFTED) {
    throw new Error("The numbers checklist came back too short. Try again.");
  }
  const role = isRecord(json) ? text_(json.role, 80) : "";
  return { role, items: items.slice(0, MAX_DRAFTED) };
}

function text_(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
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
