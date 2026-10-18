import { questionKey } from "@/lib/questions/library";
import { getTheme, type QuestionThemeId } from "@/lib/questions/themes";
import { findNumbers } from "@/lib/stories/numbers";

// The shared question bank (PRD v0.3, P1): with the user's opt-in, the behavioral questions from a
// past interview are shared (never the answers), tagged by company, role, level, round and month.
// Before anything is shared, code removes the speakers' names and flags anything that still looks
// like a name or a number for Craig, who approves each question in the admin panel. Approved
// questions show other users with a job at that company as "asked recently".

export const ROUNDS = [
  { id: "recruiter", label: "Recruiter screen" },
  { id: "hiring_manager", label: "Hiring manager" },
  { id: "panel", label: "Panel or loop" },
  { id: "final", label: "Final round" },
  { id: "other", label: "Another round" },
] as const;

export type RoundId = (typeof ROUNDS)[number]["id"];

export function roundLabel(id: string | null | undefined): string | undefined {
  return ROUNDS.find((r) => r.id === id)?.label;
}

export function isRound(id: unknown): id is RoundId {
  return ROUNDS.some((r) => r.id === id);
}

export const MAX_SHARED_LENGTH = 300;
// How far back "asked recently" reaches.
export const RECENT_MONTHS = 6;

// ---- Names ----

// Speaker labels that aren't anyone's name.
const GENERIC_SPEAKERS = /^(interviewer|me|you|candidate|speaker\s*\d*|host|guest|unknown|recruiter|hiring manager)$/i;

// The people named as speakers in a transcript ("Dana Smith: So tell me…"), plus the user's own
// label, word by word, so a question that says "Dana" alone is still caught.
export function speakerNames(transcript: string, ownLabel = ""): string[] {
  const labels = new Set<string>();
  for (const line of transcript.split("\n")) {
    const m = line.match(/^\s*([^:\n]{1,40}):\s/);
    if (m) labels.add(m[1].trim());
  }
  if (ownLabel.trim()) labels.add(ownLabel.trim());
  const names = new Set<string>();
  for (const label of labels) {
    if (GENERIC_SPEAKERS.test(label)) continue;
    for (const word of label.split(/[\s.,()]+/)) {
      if (/^\p{Lu}[\p{L}'-]+$/u.test(word) && word.length >= 2 && !GENERIC_SPEAKERS.test(word)) {
        names.add(word);
      }
    }
  }
  return [...names];
}

const LEADING_FILLER =
  /^(?:(?:so|okay|ok|alright|all right|great|cool|thanks|thank you|right|well|and|now|perfect)\b[,.!]?\s*)+/i;

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The question with the speakers' names taken out and the chat around it trimmed ("So, Dana,
// tell me about…" → "Tell me about…").
export function redactQuestion(question: string, names: string[]): string {
  let text = question.replace(/\s+/g, " ").trim();
  for (const name of names) {
    // "Dana's team" in a question to the candidate is their own: "your team".
    text = text
      .replace(new RegExp(`(?<![\\p{L}])${escape(name)}['’]s(?![\\p{L}])`, "giu"), "your")
      .replace(new RegExp(`(?<![\\p{L}])${escape(name)}(?![\\p{L}])`, "giu"), "");
  }
  text = text
    .replace(/\s+([,.?!])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .replace(/^[,.;:\s]+/, "");
  // Repeat: names often sit between fillers ("Okay, Dana, so…").
  for (let i = 0; i < 3; i++) text = text.replace(LEADING_FILLER, "").replace(/^[,.;:\s]+/, "");
  text = text.slice(0, MAX_SHARED_LENGTH).trim();
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

// Capitalised words that are fine mid-sentence: not names of people or customers.
const ALLOWED_CAPS = new Set(
  [
    "I", "I'm", "I've", "I'd", "I'll", "AI", "ML", "API", "APIs", "CEO", "CTO", "CFO", "COO", "VP",
    "PM", "PMs", "SaaS", "B2B", "B2C", "KPI", "KPIs", "OKR", "OKRs", "ROI", "SQL", "QA", "UX", "UI",
    "HR", "IT", "US", "UK", "EU", "STAR", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
    "January", "February", "March", "April", "May", "June", "July", "August", "September",
    "October", "November", "December", "Q1", "Q2", "Q3", "Q4",
  ],
);

export type CheckFlag = string;

// What a reviewer should look at before a question is shared: any number, anything that still
// looks like a person's or a customer's name, and email addresses or links. The company the
// interview was at is a tag anyway, so its name is fine.
export function checkQuestion(question: string, company: string | null): CheckFlag[] {
  const flags: CheckFlag[] = [];
  const numbers = findNumbers(question, { includeCommonWords: false }).map((n) => n.raw);
  if (numbers.length) flags.push(`Has a number: ${[...new Set(numbers)].join(", ")}`);
  if (/\S+@\S+\.\S+/.test(question)) flags.push("Has an email address");
  if (/https?:\/\/|www\./i.test(question)) flags.push("Has a link");
  const companyWords = new Set(
    (company ?? "").split(/\s+/).map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean),
  );
  const caps = new Set<string>();
  const sentences = question.split(/(?<=[.?!])\s+/);
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/);
    words.forEach((raw, i) => {
      const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}']+$/gu, "");
      if (i === 0 || !word || !/^\p{Lu}/u.test(word)) return;
      if (ALLOWED_CAPS.has(word) || companyWords.has(word.toLowerCase())) return;
      caps.add(word);
    });
  }
  if (caps.size) flags.push(`May name a person, customer or product: ${[...caps].join(", ")}`);
  return flags;
}

// ---- From a reviewed transcript to shareable questions ----

export type ShareableQuestion = {
  question: string;
  // The key of the question as the transcript has it, so the user can leave one out for good.
  sourceKey: string;
  theme: QuestionThemeId;
  flags: CheckFlag[];
};

// The behavioral questions in a review, redacted and checked, once each, leaving out the ones the
// user chose not to share. Questions outside the themes (technical, logistics) aren't shared.
export function shareableQuestions(input: {
  asked: { question: string; theme: QuestionThemeId | null }[];
  transcript: string;
  speaker: string;
  company: string | null;
  excluded: string[];
}): ShareableQuestion[] {
  const names = speakerNames(input.transcript, input.speaker);
  const excluded = new Set(input.excluded);
  const seen = new Set<string>();
  const result: ShareableQuestion[] = [];
  for (const q of input.asked) {
    const theme = getTheme(q.theme)?.id;
    if (!theme) continue;
    const sourceKey = questionKey(q.question);
    if (!sourceKey || excluded.has(sourceKey) || seen.has(sourceKey)) continue;
    seen.add(sourceKey);
    const question = redactQuestion(q.question, names);
    if (question.split(/\s+/).length < 4) continue;
    result.push({ question, sourceKey, theme, flags: checkQuestion(question, input.company) });
  }
  return result;
}

// The first of the month, as a date: the bank keeps the month, never the day.
export function monthOf(iso: string): string {
  const d = new Date(iso);
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

// ---- Showing approved questions ----

export type BankQuestion = {
  question: string;
  theme: QuestionThemeId | null;
  company: string | null;
  role: string | null;
  level: string | null;
  round: string | null;
  // YYYY-MM-01.
  askedMonth: string;
};

export function parseBankRows(rows: unknown): BankQuestion[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((r) => {
    if (!r || typeof r !== "object") return [];
    const row = r as Record<string, unknown>;
    if (typeof row.question !== "string" || typeof row.asked_month !== "string") return [];
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    return [
      {
        question: row.question,
        theme: getTheme(str(row.theme))?.id ?? null,
        company: str(row.company),
        role: str(row.role),
        level: str(row.level),
        round: str(row.round),
        askedMonth: row.asked_month,
      },
    ];
  });
}

// "Asked at Acme for Senior PM, hiring manager round, Sep 2026".
export function askedLabel(q: BankQuestion): string {
  const month = new Date(`${q.askedMonth.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const round = roundLabel(q.round);
  return [
    `Asked${q.company ? ` at ${q.company}` : ""}${q.role ? ` for ${q.role}` : ""}`,
    round && round.toLowerCase(),
    month,
  ]
    .filter(Boolean)
    .join(", ");
}

// Questions for the same role first (by shared words in the title), then the rest, newest first;
// one entry per question.
export function forJob(questions: BankQuestion[], jobTitle: string): BankQuestion[] {
  const words = (t: string | null) =>
    new Set((t ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2));
  const mine = words(jobTitle);
  const overlap = (q: BankQuestion) => [...words(q.role)].filter((w) => mine.has(w)).length;
  const seen = new Set<string>();
  return [...questions]
    .sort((a, b) => overlap(b) - overlap(a) || b.askedMonth.localeCompare(a.askedMonth))
    .filter((q) => {
      const key = questionKey(q.question);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
