import { storyParts, type StoryType } from "@/lib/stories/story-types";

// "Why it works": a toggle on the written story that shows, beside each paragraph, what that
// paragraph gives the interviewer: the signal it sends, the competencies it proves, the words that
// carry it, and, when it gives less than it could, one way to make it give more. One model call
// (storyAnalyze, see analyze.ts) per version of the story. The quotes are checked in code against
// the paragraph they explain. It explains the story; it never changes it or its score.

// How much a paragraph gives the interviewer.
export const STRENGTHS = [
  { id: "strong", label: "Lands", style: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  { id: "some", label: "Partly lands", style: "bg-amber-50 text-amber-800 ring-amber-200" },
  { id: "thin", label: "Thin", style: "bg-red-50 text-red-800 ring-red-200" },
] as const;

export type StrengthId = (typeof STRENGTHS)[number]["id"];

export type PartNote = {
  // The story part (paragraph) this note explains, by its id in storyParts.
  part: string;
  // What this paragraph gives the interviewer, in a sentence or two.
  value: string;
  // The competencies or signals it proves, as short labels ("Ownership", "Judgment under pressure").
  signals: string[];
  // The words in the paragraph that carry the signal, copied exactly from it (checked in code).
  quote?: string;
  strength: StrengthId;
  // When it doesn't fully land: one concrete way to make it give more. Never a made-up fact.
  sharpen?: string;
};

export type StoryAnalysis = {
  // One line on what the story as a whole tells the interviewer about the person.
  summary: string;
  parts: PartNote[];
  model: string;
  // The draft this was made from. Stale once the story is rewritten or edited.
  draftWrittenAt: string;
  analyzedAt: string;
};

export const MAX_SIGNALS = 3;

// Whether the analysis matches the current draft.
export function analysisIsCurrent(
  analysis: StoryAnalysis | undefined,
  draftWrittenAt: string | undefined,
): analysis is StoryAnalysis {
  return Boolean(analysis && draftWrittenAt && analysis.draftWrittenAt === draftWrittenAt);
}

export function strengthOf(id: StrengthId) {
  return STRENGTHS.find((s) => s.id === id) ?? STRENGTHS[1];
}

// The written paragraphs, in story order, with their part labels.
export function writtenParts(
  parts: Record<string, string>,
  storyType: StoryType | undefined,
): { id: string; label: string; text: string }[] {
  return storyParts(storyType)
    .filter((p) => parts[p.id]?.trim())
    .map((p) => ({ id: p.id, label: p.label, text: parts[p.id] }));
}

// Finds `quote` in `text` ignoring case and curly quotes, and returns it as written in `text`, so
// it can be highlighted there. Undefined when the model's words aren't in the paragraph.
export function findQuote(text: string, quote: string | undefined): string | undefined {
  const q = normalize(quote?.trim().replace(/^["“']+|["”']+$/g, "") ?? "");
  if (q.length < 3) return undefined;
  const at = normalize(text).indexOf(q);
  return at >= 0 ? text.slice(at, at + q.length) : undefined;
}

// Same length as the input, so positions carry over to the original text.
function normalize(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").toLowerCase();
}

const STRENGTH_IDS = new Set<string>(STRENGTHS.map((s) => s.id));

// One note from the model or from storage. Drops a quote that isn't in the paragraph.
export function parsePartNote(raw: unknown, paragraphs: Record<string, string>): PartNote[] {
  if (!isRecord(raw) || typeof raw.part !== "string" || typeof raw.value !== "string") return [];
  const text = paragraphs[raw.part];
  const value = raw.value.trim();
  if (!text || !value) return [];
  const signals = Array.isArray(raw.signals)
    ? raw.signals
        .filter((s): s is string => typeof s === "string" && Boolean(s.trim()))
        .map((s) => s.trim())
        .slice(0, MAX_SIGNALS)
    : [];
  const strength =
    typeof raw.strength === "string" && STRENGTH_IDS.has(raw.strength)
      ? (raw.strength as StrengthId)
      : "some";
  const quote = typeof raw.quote === "string" ? findQuote(text, raw.quote) : undefined;
  const sharpen =
    strength !== "strong" && typeof raw.sharpen === "string" && raw.sharpen.trim()
      ? raw.sharpen.trim()
      : undefined;
  return [
    {
      part: raw.part,
      value,
      signals,
      ...(quote ? { quote } : {}),
      strength,
      ...(sharpen ? { sharpen } : {}),
    },
  ];
}

// The notes in story order, one per written paragraph at most.
export function orderNotes(notes: PartNote[], order: string[]): PartNote[] {
  return order.flatMap((id) => notes.find((n) => n.part === id) ?? []);
}

// Reads a stored analysis against the draft's paragraphs (quotes are checked again).
export function parseAnalysis(
  raw: unknown,
  paragraphs: Record<string, string>,
): StoryAnalysis | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.parts)) return undefined;
  const parts = raw.parts.flatMap((p) => parsePartNote(p, paragraphs));
  if (parts.length === 0) return undefined;
  return {
    summary: typeof raw.summary === "string" ? raw.summary : "",
    parts,
    model: typeof raw.model === "string" ? raw.model : "",
    draftWrittenAt: typeof raw.draftWrittenAt === "string" ? raw.draftWrittenAt : "",
    analyzedAt: typeof raw.analyzedAt === "string" ? raw.analyzedAt : "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
