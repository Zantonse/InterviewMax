import { isRecord } from "@/lib/jobs/content";

// Job curriculum (beta, Oct 18): the basics a candidate should know going into the interviews for
// one target job, so no topic catches them out. One model call reads the posting and lists the
// topics by area, each with the few things to know, how it tends to come up and a question to
// check themselves with. A topic that quotes the posting is checked word for word in code; the
// rest are marked as usual for the role, not as something this job asked for. The user marks how
// well they know each one. Kept on target_jobs.curriculum.

export const AREAS = [
  {
    id: "role",
    label: "The role",
    hint: "What the job is for and what the work looks like",
  },
  {
    id: "skills",
    label: "Skills and methods",
    hint: "How the work gets done well",
  },
  {
    id: "tools",
    label: "Tools and tech",
    hint: "What you'd be expected to use or talk about",
  },
  {
    id: "domain",
    label: "Business and industry",
    hint: "The market, customers and terms",
  },
] as const;

export type AreaId = (typeof AREAS)[number]["id"];

export const CONFIDENCE = [
  { id: "know", label: "I know this" },
  { id: "brush_up", label: "Brush up" },
  { id: "new", label: "New to me" },
] as const;

export type ConfidenceId = (typeof CONFIDENCE)[number]["id"];

export const MIN_TOPICS = 8;
export const MAX_TOPICS = 16;
export const MAX_BASICS = 4;
const MAX_NAME = 80;
const MAX_LINE = 300;

export type CurriculumTopic = {
  id: string;
  area: AreaId;
  name: string;
  // The posting line it comes from, found word for word in the posting. Empty when the topic is
  // usual for the role rather than something the posting names.
  quote: string;
  // The few things to know, in plain words.
  basics: string[];
  // How it tends to come up in the interview.
  askedAs: string;
  // A question to check yourself with.
  check: string;
  confidence?: ConfidenceId;
};

export type Curriculum = {
  // Two or three sentences: what the job is, as the posting describes it.
  summary: string;
  topics: CurriculumTopic[];
  model: string;
  generatedAt: string;
};

export function isArea(id: unknown): id is AreaId {
  return AREAS.some((a) => a.id === id);
}

export function isConfidence(id: unknown): id is ConfidenceId {
  return CONFIDENCE.some((c) => c.id === id);
}

function line(raw: unknown, max = MAX_LINE): string {
  return typeof raw === "string" ? raw.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function topicKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function newTopicId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// Validates topics from the model, the browser or jsonb: known areas, trimmed text, no repeated
// names, at most MAX_TOPICS. Missing ids get new ones.
export function parseTopics(raw: unknown): CurriculumTopic[] {
  if (!Array.isArray(raw)) return [];
  const names = new Set<string>();
  const ids = new Set<string>();
  const topics: CurriculumTopic[] = [];
  for (const t of raw) {
    if (topics.length >= MAX_TOPICS) break;
    if (!isRecord(t) || !isArea(t.area)) continue;
    const name = line(t.name, MAX_NAME);
    const key = topicKey(name);
    const basics = Array.isArray(t.basics)
      ? t.basics
          .map((b) => line(b))
          .filter(Boolean)
          .slice(0, MAX_BASICS)
      : [];
    if (!key || names.has(key) || basics.length === 0) continue;
    let id = typeof t.id === "string" && /^[a-z0-9]{4,24}$/.test(t.id) ? t.id : newTopicId();
    while (ids.has(id)) id = newTopicId();
    names.add(key);
    ids.add(id);
    topics.push({
      id,
      area: t.area,
      name,
      quote: line(t.quote),
      basics,
      askedAs: line(t.askedAs),
      check: line(t.check),
      ...(isConfidence(t.confidence) ? { confidence: t.confidence } : {}),
    });
  }
  return topics;
}

export function parseCurriculum(raw: unknown): Curriculum | null {
  if (!isRecord(raw)) return null;
  const topics = parseTopics(raw.topics);
  if (topics.length === 0) return null;
  return {
    summary: line(raw.summary, 600),
    topics,
    model: typeof raw.model === "string" ? raw.model : "",
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : "",
  };
}

// The topic with a new mark, or with none.
export function withConfidence(
  topic: CurriculumTopic,
  confidence: ConfidenceId | undefined,
): CurriculumTopic {
  const next = { ...topic };
  if (confidence) next.confidence = confidence;
  else delete next.confidence;
  return next;
}

// A new curriculum keeps the user's marks on topics it lists again under the same name.
export function carryConfidence(
  previous: CurriculumTopic[],
  fresh: CurriculumTopic[],
): CurriculumTopic[] {
  const marks = new Map(
    previous.flatMap((t) => (t.confidence ? [[topicKey(t.name), t.confidence] as const] : [])),
  );
  return fresh.map((t) => {
    const mark = marks.get(topicKey(t.name));
    return mark ? { ...t, confidence: mark } : t;
  });
}

// Topics by area, in AREAS order, empty areas left out.
export function byArea(
  topics: CurriculumTopic[],
): { id: AreaId; label: string; hint: string; topics: CurriculumTopic[] }[] {
  return AREAS.flatMap((a) => {
    const list = topics.filter((t) => t.area === a.id);
    return list.length ? [{ ...a, topics: list }] : [];
  });
}

// How far along the user is: topics marked known, and those still to study (brush up, new or
// not marked yet).
export function progress(topics: CurriculumTopic[]): {
  known: number;
  toStudy: number;
} {
  const known = topics.filter((t) => t.confidence === "know").length;
  return { known, toStudy: topics.length - known };
}
