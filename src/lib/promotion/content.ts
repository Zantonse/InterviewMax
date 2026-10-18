import { LEVELS, isLevel, levelLabel, type LevelId } from "@/lib/jobs/content";
import { QUESTION_THEMES, getTheme, type QuestionThemeId } from "@/lib/questions/themes";
import { LEVEL_NEEDS, type BankRole } from "@/lib/stories/bank";
import { gradeIsCurrent, hasDraft, type StoryContent } from "@/lib/stories/content";
import { BANK_ROLES } from "@/lib/stories/grading";
import { getStoryType, type StoryTypeId } from "@/lib/stories/story-types";

// PromotionMax (PRD v0.4): a mode of InterviewMax for building the case for the next level where
// the user already works. Stories stay shared between the modes; this file holds what is new: the
// target level, the dimensions the promotion is judged on (generic, or read from a pasted career
// ladder), the evidence gap map, and the names to redact before anything reaches a model.
// Kept on profiles.promotion (jsonb). Code only, no model call.

export type AppMode = "interview" | "promotion";

export type Dimension = {
  id: string;
  label: string;
  // What the target level expects on this dimension: the ladder's own words when one was pasted.
  expects: string;
  themes: QuestionThemeId[];
};

export type Ladder = {
  text: string;
  dimensions: Dimension[];
  model: string;
  readAt: string;
};

// A name the user doesn't want sent to a model (a customer, an internal project), and the neutral
// words that stand in for it, e.g. "Acme Bank" → "a large bank".
export type Redaction = { name: string; placeholder: string };

export type PacketItem = { text: string; storyIds: string[] };

export type PromotionPacket = {
  selfReview: (PacketItem & { dimension: string })[];
  managerSummary: string;
  talkingPoints: PacketItem[];
  // Each story the packet was built from, with the draft it read, to tell when stories changed.
  stories: Record<string, string>;
  // Lines dropped because a figure in them couldn't be traced to the cited stories.
  leftOut: number;
  model: string;
  generatedAt: string;
};

export type PromotionPlan = {
  currentLevel?: LevelId;
  targetLevel?: LevelId;
  ladder?: Ladder;
  redactions: Redaction[];
  packet?: PromotionPacket;
};

export const MAX_LADDER_LENGTH = 15000;
export const MIN_LADDER_LENGTH = 80;
export const MAX_DIMENSIONS = 8;
export const MAX_REDACTIONS = 30;
export const MAX_NAME_LENGTH = 80;
export const DEFAULT_PLACEHOLDER = "a customer";

// Used until a ladder is pasted: what promotion committees usually weigh, each tied to the question
// themes whose stories prove it. "About you" is left out: it isn't evidence of a level.
export const DEFAULT_DIMENSIONS: Dimension[] = [
  {
    id: "scope",
    label: "Scope and impact",
    expects: "Results that matter beyond your own work, with the numbers to show it.",
    themes: ["impact", "success"],
  },
  {
    id: "ownership",
    label: "Ownership and judgment",
    expects: "You decide what matters, own it end to end and make the call when it's unclear.",
    themes: ["ownership", "prioritization", "ambiguity"],
  },
  {
    id: "influence",
    label: "Influence and leadership",
    expects: "You move people you don't manage and resolve disagreement.",
    themes: ["influence", "conflict"],
  },
  {
    id: "collaboration",
    label: "Working across teams",
    expects: "You lead work that spans teams, not just your own.",
    themes: ["collaboration"],
  },
  {
    id: "growth",
    label: "Learning and growth",
    expects: "You learn from what went wrong and change how the team works.",
    themes: ["failure"],
  },
];

export const PROOF_THEMES = QUESTION_THEMES.filter((t) => t.id !== "about_you");

export function emptyPlan(): PromotionPlan {
  return { redactions: [] };
}

export function dimensionsFor(plan: PromotionPlan): Dimension[] {
  return plan.ladder?.dimensions.length ? plan.ladder.dimensions : DEFAULT_DIMENSIONS;
}

// The level after this one, for the target level's default.
export function nextLevel(level: LevelId): LevelId {
  const i = LEVELS.findIndex((l) => l.id === level);
  return LEVELS[Math.min(i + 1, LEVELS.length - 1)].id;
}

// "Senior → Principal or above".
export function levelStep(plan: PromotionPlan): string | undefined {
  if (!plan.targetLevel) return undefined;
  const target = levelLabel(plan.targetLevel);
  return plan.currentLevel ? `${levelLabel(plan.currentLevel)} → ${target}` : target;
}

// The scope a story has to reach to count as evidence at the target level: the widest scope the
// level mix asks of it (Senior and Principal: organization-level; Mid: team-level).
export function barRole(level: LevelId): BankRole {
  const needs = LEVEL_NEEDS[level];
  return needs.reduce(
    (top, n) => (BANK_ROLES.indexOf(n.role) > BANK_ROLES.indexOf(top) ? n.role : top),
    needs[0].role,
  );
}

type StoryLike = { id: string; title: string; storyType: string | null; content: StoryContent };

// Evidence for one dimension, best first:
//  at_target:    a graded story at the target level's scope or wider
//  current_only: graded, but below that scope ("story at current level only")
//  not_graded:   written, not graded yet, so its level isn't known
//  in_progress:  started, no draft yet
//  empty:        no story yet
export type EvidenceStatus = "at_target" | "current_only" | "not_graded" | "in_progress" | "empty";

const EVIDENCE_RANK: Record<EvidenceStatus, number> = {
  at_target: 4,
  current_only: 3,
  not_graded: 2,
  in_progress: 1,
  empty: 0,
};

export type DimensionEvidence = {
  dimension: Dimension;
  status: EvidenceStatus;
  // Every story that speaks to it, best first.
  stories: { id: string; title: string; status: EvidenceStatus }[];
  // The story type to start when the dimension needs a story at the target level.
  build: StoryTypeId;
};

function evidenceStatus(story: StoryLike, bar: BankRole | undefined): EvidenceStatus {
  if (!hasDraft(story.content)) return "in_progress";
  const role = gradeIsCurrent(story.content) ? story.content.grade?.bankRole?.role : undefined;
  if (!role || !(BANK_ROLES as readonly string[]).includes(role)) return "not_graded";
  if (!bar) return "at_target";
  return BANK_ROLES.indexOf(role as BankRole) >= BANK_ROLES.indexOf(bar)
    ? "at_target"
    : "current_only";
}

export function gapMap(stories: StoryLike[], plan: PromotionPlan): DimensionEvidence[] {
  const bar = plan.targetLevel ? barRole(plan.targetLevel) : undefined;
  const behavioral = stories.filter((s) => getStoryType(s.storyType)?.format === "star");
  return dimensionsFor(plan).map((dimension) => {
    const types = new Set<string>(dimension.themes.flatMap((t) => getTheme(t)?.storyTypes ?? []));
    const matched = behavioral
      .filter((s) => s.storyType && types.has(s.storyType))
      .map((s) => ({ id: s.id, title: s.title, status: evidenceStatus(s, bar) }))
      .sort((a, b) => EVIDENCE_RANK[b.status] - EVIDENCE_RANK[a.status]);
    const firstTheme = getTheme(dimension.themes[0]);
    return {
      dimension,
      status: matched[0]?.status ?? "empty",
      stories: matched,
      build: (firstTheme?.storyTypes[0] ?? "major_project") as StoryTypeId,
    };
  });
}

// A dimension is a gap until a story at the target level backs it.
export function isGap(evidence: DimensionEvidence): boolean {
  return evidence.status !== "at_target";
}

// Redaction: each name, matched whole-word and ignoring case, becomes its placeholder. Longer names
// go first so "Acme Bank Europe" isn't half-replaced by "Acme Bank".
export function redact(text: string, redactions: readonly Redaction[]): string {
  if (!text || redactions.length === 0) return text;
  let out = text;
  for (const r of [...redactions].sort((a, b) => b.name.length - a.name.length)) {
    const pattern = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(r.name)}(?![\\p{L}\\p{N}])`,
      "giu",
    );
    out = out.replace(pattern, () => r.placeholder);
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Cleans what the user typed. A placeholder may not hold a figure: drafts are checked so that every
// number traces to the user's answers, and a placeholder's number never would.
export function cleanRedactions(raw: unknown): Redaction[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Redaction[] = [];
  for (const r of raw) {
    if (!isRecord(r)) continue;
    const name = typeof r.name === "string" ? r.name.replace(/\s+/g, " ").trim() : "";
    if (name.length < 2 || name.length > MAX_NAME_LENGTH) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    let placeholder =
      typeof r.placeholder === "string" ? r.placeholder.replace(/\s+/g, " ").trim() : "";
    if (!placeholder || /\d/.test(placeholder) || placeholder.length > MAX_NAME_LENGTH) {
      placeholder = DEFAULT_PLACEHOLDER;
    }
    if (placeholder.toLowerCase().includes(key)) placeholder = DEFAULT_PLACEHOLDER;
    seen.add(key);
    out.push({ name, placeholder });
    if (out.length >= MAX_REDACTIONS) break;
  }
  return out;
}

// One "Name = placeholder" per line, as the form takes them.
export function parseRedactionLines(text: string): Redaction[] {
  return cleanRedactions(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, ...rest] = line.split("=");
        return { name, placeholder: rest.join("=") };
      }),
  );
}

export function redactionLines(redactions: readonly Redaction[]): string {
  return redactions.map((r) => `${r.name} = ${r.placeholder}`).join("\n");
}

export function cleanDimensions(raw: unknown): Dimension[] {
  if (!Array.isArray(raw)) return [];
  const themeIds = new Set<string>(PROOF_THEMES.map((t) => t.id));
  const seen = new Set<string>();
  const out: Dimension[] = [];
  for (const d of raw) {
    if (!isRecord(d)) continue;
    const label =
      typeof d.label === "string" ? d.label.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    const themes = Array.isArray(d.themes)
      ? [
          ...new Set(
            d.themes.filter((t): t is QuestionThemeId => typeof t === "string" && themeIds.has(t)),
          ),
        ]
      : [];
    if (!label || themes.length === 0 || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    const id =
      typeof d.id === "string" && /^[a-z0-9_-]{1,40}$/.test(d.id) && !out.some((o) => o.id === d.id)
        ? d.id
        : `d${out.length + 1}`;
    out.push({
      id,
      label,
      expects:
        typeof d.expects === "string" ? d.expects.replace(/\s+/g, " ").trim().slice(0, 400) : "",
      themes,
    });
    if (out.length >= MAX_DIMENSIONS) break;
  }
  return out;
}

function cleanItems(raw: unknown): PacketItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).flatMap((i) =>
    typeof i.text === "string" && i.text.trim()
      ? [
          {
            text: i.text.trim(),
            storyIds: Array.isArray(i.storyIds)
              ? i.storyIds.filter((s): s is string => typeof s === "string")
              : [],
            ...(typeof i.dimension === "string" ? { dimension: i.dimension } : {}),
          },
        ]
      : [],
  );
}

function parsePacket(raw: unknown): PromotionPacket | undefined {
  if (!isRecord(raw) || typeof raw.generatedAt !== "string") return undefined;
  return {
    selfReview: cleanItems(raw.selfReview).map((i) => ({
      ...i,
      dimension: (i as { dimension?: string }).dimension ?? "",
    })),
    managerSummary: typeof raw.managerSummary === "string" ? raw.managerSummary : "",
    talkingPoints: cleanItems(raw.talkingPoints).map(({ text, storyIds }) => ({ text, storyIds })),
    stories: isRecord(raw.stories)
      ? Object.fromEntries(
          Object.entries(raw.stories).filter(
            (e): e is [string, string] => typeof e[1] === "string",
          ),
        )
      : {},
    leftOut: typeof raw.leftOut === "number" ? raw.leftOut : 0,
    model: typeof raw.model === "string" ? raw.model : "",
    generatedAt: raw.generatedAt,
  };
}

// Reads profiles.promotion defensively: it is jsonb.
export function parsePlan(raw: unknown): PromotionPlan {
  const plan = emptyPlan();
  if (!isRecord(raw)) return plan;
  if (isLevel(raw.currentLevel)) plan.currentLevel = raw.currentLevel;
  if (isLevel(raw.targetLevel)) plan.targetLevel = raw.targetLevel;
  if (isRecord(raw.ladder) && typeof raw.ladder.text === "string") {
    const dimensions = cleanDimensions(raw.ladder.dimensions);
    if (dimensions.length) {
      plan.ladder = {
        text: raw.ladder.text,
        dimensions,
        model: typeof raw.ladder.model === "string" ? raw.ladder.model : "",
        readAt: typeof raw.ladder.readAt === "string" ? raw.ladder.readAt : "",
      };
    }
  }
  plan.redactions = cleanRedactions(raw.redactions);
  const packet = parsePacket(raw.packet);
  if (packet) plan.packet = packet;
  return plan;
}

// Stories the packet read whose draft has changed since, or that are gone.
export function packetIsStale(
  packet: PromotionPacket,
  stories: { id: string; content: StoryContent }[],
): boolean {
  return Object.entries(packet.stories).some(([id, writtenAt]) => {
    const story = stories.find((s) => s.id === id);
    return !story || story.content.draft?.writtenAt !== writtenAt;
  });
}

export function packetText(packet: PromotionPacket): string {
  return [
    "Self-review",
    ...packet.selfReview.map((i) => `${i.dimension ? `${i.dimension}: ` : ""}${i.text}`),
    "",
    "Summary for my manager",
    packet.managerSummary,
    "",
    "Talking points",
    ...packet.talkingPoints.map((i) => `- ${i.text}`),
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
