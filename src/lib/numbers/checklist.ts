import { type NumberItem, getNumbersFamily } from "./families";

// What the numbers checklist keeps on the user's profile (profiles.numbers_checklist).
export type NumbersChecklist = {
  // A hand-written family id, or null when the list was drafted for their own role.
  familyId: string | null;
  // The role's name when there's no hand-written family, e.g. "Revenue operations".
  roleName?: string;
  // The drafted list. Hand-written families are read from code so edits reach everyone.
  items?: NumberItem[];
  // The user's values, keyed by item id, as they typed them.
  values: Record<string, string>;
  model?: string;
  updatedAt: string;
};

// A value is a short phrase like "6 AEs" or "about $85K", not an answer.
export const MAX_VALUE_LENGTH = 200;
export const MAX_ROLE_NAME_LENGTH = 80;
// The role picker's choice for a role with no hand-written list.
export const OTHER_ROLE = "other";

export function checklistItems(checklist: NumbersChecklist): NumberItem[] {
  return getNumbersFamily(checklist.familyId)?.items ?? checklist.items ?? [];
}

export function checklistRole(checklist: NumbersChecklist): string {
  return getNumbersFamily(checklist.familyId)?.label ?? (checklist.roleName || "Your role");
}

export function filledCount(checklist: NumbersChecklist): number {
  return checklistItems(checklist).filter((i) => checklist.values[i.id]?.trim()).length;
}

// The checklist counts as gathered once a few numbers are in, or all of them for a short list.
export const ENOUGH_FILLED = 3;
export function hasEnoughNumbers(checklist: NumbersChecklist | null): boolean {
  if (!checklist) return false;
  const total = checklistItems(checklist).length;
  return total > 0 && filledCount(checklist) >= Math.min(ENOUGH_FILLED, total);
}

export type StoryNumber = NumberItem & { value?: string };

// The checklist numbers that fit one story type, filled ones first. With no story type, all of them.
export function numbersForStory(
  checklist: NumbersChecklist | null,
  storyTypeId: string | null | undefined,
): StoryNumber[] {
  if (!checklist) return [];
  const items = checklistItems(checklist)
    .filter((i) => !storyTypeId || i.storyTypes.length === 0 || i.storyTypes.includes(storyTypeId))
    .map((i): StoryNumber => {
      const value = checklist.values[i.id]?.trim();
      return value ? { ...i, value } : { ...i };
    });
  return [...items.filter((i) => i.value), ...items.filter((i) => !i.value)];
}

// The checklist as context for the story builder's model calls. `ask` adds the numbers not filled
// in yet, so the follow-up questions can ask for them; the writer only gets the filled ones.
export function numbersTranscript(numbers: StoryNumber[], { ask }: { ask: boolean }): string {
  const filled = numbers.filter((n) => n.value);
  const missing = ask ? numbers.filter((n) => !n.value) : [];
  if (filled.length === 0 && missing.length === 0) return "";
  const lines = ["## My numbers checklist"];
  if (filled.length) {
    lines.push(
      "Numbers I filled in about my role (these are mine; use one only where it's about the same work as this story):",
      ...filled.map((n) => `- ${n.label}: ${n.value}`),
    );
  }
  if (missing.length) {
    lines.push(
      "Numbers that would suit this kind of story that I haven't filled in yet:",
      ...missing.map((n) => `- ${n.label} (where to find it: ${n.where})`),
      "If my answers don't yet have a number for the result or the scale and one of these fits this story, make one of your questions a light ask for it, and say where I could look it up. Never ask for a number I already filled in.",
    );
  }
  return lines.join("\n");
}

// Reads the checklist off the profile row defensively: it is jsonb.
export function parseChecklist(raw: unknown): NumbersChecklist | null {
  if (!isRecord(raw)) return null;
  const familyId = typeof raw.familyId === "string" ? raw.familyId : null;
  const items = Array.isArray(raw.items) ? raw.items.flatMap(parseItem) : undefined;
  if (!getNumbersFamily(familyId) && !items?.length) return null;
  const values: Record<string, string> = {};
  if (isRecord(raw.values)) {
    for (const [id, value] of Object.entries(raw.values)) {
      if (typeof value === "string" && value.trim()) {
        values[id] = value.trim().slice(0, MAX_VALUE_LENGTH);
      }
    }
  }
  return {
    familyId: getNumbersFamily(familyId) ? familyId : null,
    ...(typeof raw.roleName === "string" && raw.roleName ? { roleName: raw.roleName } : {}),
    ...(items?.length && !getNumbersFamily(familyId) ? { items } : {}),
    values,
    ...(typeof raw.model === "string" ? { model: raw.model } : {}),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
  };
}

function parseItem(raw: unknown): NumberItem[] {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.label !== "string") return [];
  return [
    {
      id: raw.id,
      label: raw.label,
      why: typeof raw.why === "string" ? raw.why : "",
      where: typeof raw.where === "string" ? raw.where : "",
      storyTypes: Array.isArray(raw.storyTypes)
        ? raw.storyTypes.filter((t): t is string => typeof t === "string")
        : [],
    },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
