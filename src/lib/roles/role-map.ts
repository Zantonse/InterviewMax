import { type RoleFunction, WORK_QUESTIONS, MIN_WORK_ANSWERS, getRoleFamily } from "./families";

// What "Map my role" keeps on the "Tell me about yourself" story (stories.content.roleMap).

export type FunctionMark = "owned" | "contributed" | "not_mine";

export const FUNCTION_MARKS: { id: FunctionMark; label: string }[] = [
  { id: "owned", label: "Owned it" },
  { id: "contributed", label: "Contributed" },
  { id: "not_mine", label: "Not mine" },
];

export type RoleProfile = {
  // First person, in plain words, from their answers.
  scope: string;
  strengths: string[];
  // How their work lines up with the role they're going after; empty if they didn't say.
  fit: string;
  // Story types worth building first, each with a reason from their answers.
  storyIdeas: { storyType: string; why: string }[];
  model: string;
  writtenAt: string;
};

export type RoleMap = {
  // A hand-written family id, or null when the map was built for their own role title.
  familyId: string | null;
  // The function's name when there's no hand-written family, e.g. "Revenue operations".
  roleName?: string;
  // The parts of the function they marked: a copy of the family's, or built for their role.
  functions: RoleFunction[];
  answers: Record<string, string>;
  marks: Record<string, FunctionMark>;
  profile?: RoleProfile;
  // About me answers filled in from the profile.
  seeded?: string[];
};

export type RoleMapStage = "questions" | "mark" | "profile" | "done";

export function answeredCount(answers: Record<string, string>): number {
  return WORK_QUESTIONS.filter((q) => answers[q.id]?.trim()).length;
}

export function hasEnoughAnswers(answers: Record<string, string>): boolean {
  return Boolean(answers.title?.trim()) && answeredCount(answers) >= MIN_WORK_ANSWERS;
}

export function roleMapStage(map: RoleMap | undefined): RoleMapStage {
  if (!map || !hasEnoughAnswers(map.answers) || map.functions.length === 0) return "questions";
  if (map.functions.some((f) => !map.marks[f.id])) return "mark";
  if (!map.profile) return "profile";
  return "done";
}

export function functionsMarked(map: RoleMap, mark: FunctionMark): RoleFunction[] {
  return map.functions.filter((f) => map.marks[f.id] === mark);
}

// The words interviewers use for the parts they owned or contributed to, owned first. These come
// from the function map, so they name work the user described rather than adding new facts.
export function roleVocabulary(map: RoleMap, limit = 12): string[] {
  const terms = [...functionsMarked(map, "owned"), ...functionsMarked(map, "contributed")].flatMap(
    (f) => f.terms,
  );
  return [...new Set(terms)].slice(0, limit);
}

export function roleLabel(map: RoleMap): string {
  return getRoleFamily(map.familyId)?.label ?? (map.roleName || "Your role");
}

// The user's own words about their work, for the number check and the model transcripts.
export function roleAnswerText(map: RoleMap | undefined): string {
  if (!map) return "";
  return WORK_QUESTIONS.map((q) => map.answers[q.id] ?? "")
    .filter((a) => a.trim())
    .join("\n");
}

// The role map as context for the About me calls: their answers, their part of the function and
// the words for it. The profile's own sentences are left out; they are already built from these.
export function roleMapTranscript(map: RoleMap | undefined): string {
  if (!map) return "";
  const lines = ["My role map, from my own answers about my work:"];
  for (const q of WORK_QUESTIONS) {
    const answer = map.answers[q.id]?.trim();
    if (answer) lines.push(`Q: ${q.text}`, `A: ${answer}`);
  }
  const owned = functionsMarked(map, "owned").map((f) => f.label);
  const contributed = functionsMarked(map, "contributed").map((f) => f.label);
  if (owned.length) lines.push(`Parts of the function I owned: ${owned.join(", ")}.`);
  if (contributed.length) lines.push(`Parts I contributed to: ${contributed.join(", ")}.`);
  const words = roleVocabulary(map);
  if (words.length) lines.push(`Words for this work: ${words.join(", ")}.`);
  return lines.join("\n");
}

// Reads a role map out of stories.content defensively.
export function parseRoleMap(raw: unknown): RoleMap | undefined {
  if (!isRecord(raw)) return undefined;
  const functions = Array.isArray(raw.functions)
    ? raw.functions.filter(isRecord).flatMap((f) =>
        typeof f.id === "string" && typeof f.label === "string"
          ? [
              {
                id: f.id,
                label: f.label,
                blurb: typeof f.blurb === "string" ? f.blurb : "",
                terms: Array.isArray(f.terms)
                  ? f.terms.filter((t): t is string => typeof t === "string")
                  : [],
              },
            ]
          : [],
      )
    : [];
  const marks: Record<string, FunctionMark> = {};
  if (isRecord(raw.marks)) {
    for (const [id, mark] of Object.entries(raw.marks)) {
      if (FUNCTION_MARKS.some((m) => m.id === mark)) marks[id] = mark as FunctionMark;
    }
  }
  const map: RoleMap = {
    familyId: typeof raw.familyId === "string" ? raw.familyId : null,
    ...(typeof raw.roleName === "string" && raw.roleName ? { roleName: raw.roleName } : {}),
    functions,
    answers: isRecord(raw.answers) ? stringEntries(raw.answers) : {},
    marks,
  };
  if (isRecord(raw.profile) && typeof raw.profile.scope === "string") {
    const p = raw.profile;
    map.profile = {
      scope: p.scope as string,
      strengths: Array.isArray(p.strengths)
        ? p.strengths.filter((s): s is string => typeof s === "string")
        : [],
      fit: typeof p.fit === "string" ? p.fit : "",
      storyIdeas: Array.isArray(p.storyIdeas)
        ? p.storyIdeas
            .filter(isRecord)
            .flatMap((s) =>
              typeof s.storyType === "string" && typeof s.why === "string"
                ? [{ storyType: s.storyType, why: s.why }]
                : [],
            )
        : [],
      model: typeof p.model === "string" ? p.model : "",
      writtenAt: typeof p.writtenAt === "string" ? p.writtenAt : "",
    };
  }
  if (Array.isArray(raw.seeded)) {
    map.seeded = raw.seeded.filter((s): s is string => typeof s === "string");
  }
  return map;
}

function stringEntries(record: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(record).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// An answer about their current role shorter than this suggests they can't put the job into words.
export const THIN_ROLE_ANSWER_WORDS = 12;

// Map my role is optional, so About me offers it up front only when it would help: they've already
// started a map, or their answer about their current role came back thin.
export function suggestRoleMap(roleAnswer: string | undefined, map: RoleMap | undefined): boolean {
  if (map) return true;
  const answer = roleAnswer?.trim();
  return Boolean(answer) && answer!.split(/\s+/).length < THIN_ROLE_ANSWER_WORDS;
}
