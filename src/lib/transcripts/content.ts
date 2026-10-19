import { isRecord } from "@/lib/jobs/content";
import { QUESTION_THEMES, getTheme, type QuestionThemeId } from "@/lib/questions/themes";
import type { StoryTypeId } from "@/lib/stories/story-types";

// Past interview transcripts: the user uploads or pastes a transcript of a real interview, and one
// model call ("transcriptRead") pulls out what the interviewer asked and probed for and how each
// answer landed. Every question, probe and judgment carries a quote, and code drops any quote that
// isn't in the transcript, so nothing shown is invented. Insights across transcripts are worked
// out in code (see summarizeTranscripts).

export const MAX_TRANSCRIPTS = 20;
// About two hours of conversation.
export const MAX_TRANSCRIPT_LENGTH = 80000;
// One file can hold several interviews (see split.ts); each must fit MAX_TRANSCRIPT_LENGTH.
export const MAX_FILE_TEXT_LENGTH = MAX_TRANSCRIPT_LENGTH * 3;
// Shorter than this is a note, not a transcript.
export const MIN_TRANSCRIPT_LENGTH = 300;
export const MAX_TITLE_LENGTH = 200;
export const MAX_SPEAKER_LENGTH = 80;
export const TRANSCRIPT_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".vtt", ".srt"] as const;

export const MAX_ASKED = 15;
export const MAX_PROBES = 4;
export const MAX_LOOKING_FOR = 6;
// A quote longer than this is no longer a quote.
const MAX_QUOTE_LENGTH = 400;

// What an answer was missing. The first six match the story builder's checklist.
export const ANSWER_GAPS = [
  { id: "situation", label: "Context and stakes" },
  { id: "ownership", label: "What you did yourself" },
  { id: "actions", label: "Concrete steps" },
  { id: "decision", label: "Why you chose" },
  { id: "result", label: "A clear result" },
  { id: "numbers", label: "Numbers" },
  { id: "reflection", label: "What you learned" },
  // Asked for a time they did something, answered in general or with what they would do.
  { id: "example", label: "A real example" },
  { id: "concise", label: "Getting to the point" },
  { id: "relevance", label: "Answering the question asked" },
] as const;

export type AnswerGapId = (typeof ANSWER_GAPS)[number]["id"];

export function gapLabel(id: string): string {
  return ANSWER_GAPS.find((g) => g.id === id)?.label ?? id;
}

// How an answer landed, judged from the transcript. "unclear" when there's no quote to back it.
export const LANDED = ["strong", "mixed", "weak", "unclear"] as const;
export type Landed = (typeof LANDED)[number];

export type AskedQuestion = {
  // The interviewer's question, quoted from the transcript.
  question: string;
  // Null for a question outside the ten behavioral themes (technical, case, logistics).
  theme: QuestionThemeId | null;
  // The interviewer's follow-ups on this answer, quoted.
  probes: string[];
  landed: Landed;
  // One sentence on why it landed that way.
  note: string;
  // The part of the user's answer the judgment rests on, quoted.
  evidence: string;
  gaps: AnswerGapId[];
};

export type LookingFor = {
  // What the interviewer seemed to care about, in a few words.
  point: string;
  // The interviewer's words that show it.
  quote: string;
};

export type TranscriptAnalysis = {
  // One sentence on what the interview focused on.
  summary: string;
  lookingFor: LookingFor[];
  asked: AskedQuestion[];
  // How many quotes were dropped because they weren't in the transcript.
  dropped: number;
  model: string;
  analyzedAt: string;
};

// ---- Reading the transcript ----

const TIMESTAMP_LINE = /^\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\s*-->\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?.*$/;

// Zoom, Teams and Meet export captions as WebVTT or SRT: drop the header, cue numbers and
// timestamps, and join a speaker's consecutive lines.
export function captionsToText(raw: string): string {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let lastSpeaker = "";
  for (const line of lines) {
    const t = line.trim();
    if (!t || t === "WEBVTT" || /^(NOTE|STYLE|REGION)\b/.test(t) || /^\d+$/.test(t)) continue;
    if (TIMESTAMP_LINE.test(t)) continue;
    // <v Speaker Name>text</v> is WebVTT's speaker tag.
    const voice = t.match(/^<v(?:\.[^ >]+)?\s+([^>]+)>(.*?)(?:<\/v>)?$/);
    const text = (voice ? voice[2] : t).replace(/<[^>]+>/g, "").trim();
    if (!text) continue;
    const speaker = voice?.[1].trim() ?? text.match(/^([^:]{1,40}):\s/)?.[1] ?? "";
    const body = voice ? text : speaker ? text.slice(speaker.length + 1).trim() : text;
    if (speaker && speaker === lastSpeaker && out.length > 0) {
      out[out.length - 1] += ` ${body}`;
    } else if (speaker) {
      out.push(`${speaker}: ${body}`);
      lastSpeaker = speaker;
    } else if (lastSpeaker) {
      // An unlabelled line after a labelled one is the same speaker's cue running on.
      out[out.length - 1] += ` ${body}`;
    } else {
      out.push(body);
    }
  }
  return out.join("\n");
}

// ---- Tracing quotes ----

// Lowercase words only, so a quote matches regardless of punctuation, curly quotes or line breaks.
function words(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .trim()} `;
}

// True when every piece of the quote (split at "…" or "...") appears in the transcript, in order.
export function quoteAppears(quote: string, transcript: string): boolean {
  const pieces = quote
    .split(/…|\.\.\./)
    .map((p) => words(p).trim())
    .filter(Boolean);
  if (pieces.length === 0) return false;
  const haystack = words(transcript);
  let from = 0;
  for (const piece of pieces) {
    const at = haystack.indexOf(` ${piece} `, from);
    if (at < 0) return false;
    from = at + piece.length;
  }
  return true;
}

// ---- Reading saved analyses (jsonb) ----

export function parseAnalysis(raw: unknown): TranscriptAnalysis | null {
  if (!isRecord(raw) || !Array.isArray(raw.asked)) return null;
  return {
    summary: str(raw.summary),
    lookingFor: (Array.isArray(raw.lookingFor) ? raw.lookingFor : []).flatMap((l) =>
      isRecord(l) && str(l.point) ? [{ point: str(l.point), quote: str(l.quote) }] : [],
    ),
    asked: raw.asked.flatMap((q) => {
      if (!isRecord(q) || !str(q.question)) return [];
      return [
        {
          question: str(q.question),
          theme: getTheme(str(q.theme))?.id ?? null,
          probes: strings(q.probes),
          landed: LANDED.find((l) => l === q.landed) ?? "unclear",
          note: str(q.note),
          evidence: str(q.evidence),
          gaps: gapList(q.gaps),
        },
      ];
    }),
    dropped: typeof raw.dropped === "number" ? raw.dropped : 0,
    model: str(raw.model),
    analyzedAt: str(raw.analyzedAt),
  };
}

export function gapList(raw: unknown): AnswerGapId[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.flatMap((g) => {
    const id = ANSWER_GAPS.find((x) => x.id === (typeof g === "string" ? g.trim().toLowerCase() : ""))?.id;
    return id ? [id] : [];
  });
  return [...new Set(ids)];
}

export function trimQuote(text: string): string {
  return text.trim().replace(/^["“”']+|["“”']+$/g, "").trim().slice(0, MAX_QUOTE_LENGTH);
}

// ---- Insights across transcripts (code, no model call) ----

export type TranscriptLike = {
  id: string;
  title: string;
  analysis: TranscriptAnalysis | null;
};

export type ThemeInsight = {
  theme: QuestionThemeId;
  // How many times interviewers asked about it, across transcripts.
  asked: number;
  // How many of those answers landed weak or mixed.
  weak: number;
  // The interviewers' follow-ups on this theme, quoted.
  probes: string[];
};

export type GapInsight = {
  gap: AnswerGapId;
  // How many answers were missing it.
  count: number;
  // How many transcripts it showed up in.
  transcripts: number;
};

export type StoryFocus = {
  storyType: StoryTypeId;
  theme: QuestionThemeId;
  why: string;
};

export type TranscriptInsights = {
  analyzed: number;
  themes: ThemeInsight[];
  // Gaps seen in at least two answers, most frequent first.
  recurringGaps: GapInsight[];
  // What interviewers looked for, most repeated first.
  lookingFor: string[];
  storyFocus: StoryFocus[];
};

export function summarizeTranscripts(transcripts: TranscriptLike[]): TranscriptInsights {
  const analyses = transcripts.flatMap((t) => (t.analysis ? [t.analysis] : []));
  const themes = new Map<QuestionThemeId, ThemeInsight>();
  const gaps = new Map<AnswerGapId, { count: number; transcripts: number }>();
  const looking = new Map<string, { point: string; count: number }>();

  for (const analysis of analyses) {
    const gapsHere = new Set<AnswerGapId>();
    for (const q of analysis.asked) {
      if (q.theme) {
        const t = themes.get(q.theme) ?? { theme: q.theme, asked: 0, weak: 0, probes: [] };
        t.asked += 1;
        if (q.landed === "weak" || q.landed === "mixed") t.weak += 1;
        for (const p of q.probes) if (!t.probes.includes(p)) t.probes.push(p);
        themes.set(q.theme, t);
      }
      for (const g of q.gaps) {
        const entry = gaps.get(g) ?? { count: 0, transcripts: 0 };
        entry.count += 1;
        if (!gapsHere.has(g)) entry.transcripts += 1;
        gapsHere.add(g);
        gaps.set(g, entry);
      }
    }
    for (const l of analysis.lookingFor) {
      const key = l.point.toLowerCase();
      const entry = looking.get(key) ?? { point: l.point, count: 0 };
      entry.count += 1;
      looking.set(key, entry);
    }
  }

  const themeList = [...themes.values()].sort((a, b) => b.weak - a.weak || b.asked - a.asked);
  const recurringGaps = [...gaps.entries()]
    .map(([gap, e]) => ({ gap, ...e }))
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.count - a.count || b.transcripts - a.transcripts);

  // A theme earns a story when an answer on it landed weak or mixed, or interviewers asked about it
  // more than once. Each story type is named once, for its most pressing theme.
  const storyFocus: StoryFocus[] = [];
  for (const t of themeList) {
    if (t.weak === 0 && t.asked < 2) continue;
    const storyType = QUESTION_THEMES.find((x) => x.id === t.theme)?.storyTypes[0];
    if (!storyType || storyFocus.some((f) => f.storyType === storyType)) continue;
    storyFocus.push({ storyType, theme: t.theme, why: focusWhy(t) });
  }

  return {
    analyzed: analyses.length,
    themes: themeList,
    recurringGaps,
    lookingFor: [...looking.values()].sort((a, b) => b.count - a.count).map((l) => l.point),
    storyFocus,
  };
}

function focusWhy(t: ThemeInsight): string {
  const asked = `Asked ${t.asked === 1 ? "once" : `${t.asked} times`}`;
  if (t.weak === 0) return `${asked} in your interviews.`;
  if (t.weak === t.asked) return `${asked}; your ${t.asked === 1 ? "answer" : "answers"} didn't land.`;
  return `${asked}; ${t.weak} of your answers didn't land.`;
}

// What the story builder's follow-ups should know from past interviews, for one story type.
export type PastInterviewNotes = {
  // Follow-ups real interviewers asked on the themes this story answers.
  probes: string[];
  // What the user's answers kept missing.
  gaps: { label: string; count: number }[];
};

export function notesForStoryType(
  insights: TranscriptInsights,
  storyType: StoryTypeId,
): PastInterviewNotes | undefined {
  const themeIds = new Set<string>(
    QUESTION_THEMES.filter((t) => (t.storyTypes as readonly string[]).includes(storyType)).map((t) => t.id),
  );
  const probes = insights.themes
    .filter((t) => themeIds.has(t.theme))
    .flatMap((t) => t.probes)
    .slice(0, 8);
  const gaps = insights.recurringGaps.map((g) => ({ label: gapLabel(g.gap), count: g.count }));
  if (probes.length === 0 && gaps.length === 0) return undefined;
  return { probes, gaps };
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.flatMap((v) => (typeof v === "string" && v.trim() ? [v.trim()] : [])) : [];
}

// The questions from the user's past interviews that bear on one target job: those from interviews
// for that job or at the same company, and (fewer) from interviews elsewhere.
export function pastQuestionsFor(
  job: { id: string; company: string | null },
  transcripts: (TranscriptLike & { targetJobId: string | null; company: string | null })[],
  { maxThisJob = 20, maxElsewhere = 15 } = {},
): { thisJob: string[]; elsewhere: string[]; transcripts: number } {
  const company = job.company?.trim().toLowerCase();
  const thisJob: string[] = [];
  const elsewhere: string[] = [];
  let used = 0;
  for (const t of transcripts) {
    if (!t.analysis) continue;
    used += 1;
    const same = t.targetJobId === job.id || (Boolean(company) && t.company?.trim().toLowerCase() === company);
    const list = same ? thisJob : elsewhere;
    for (const q of t.analysis.asked) {
      // Only behavioral questions belong in likely questions.
      if (q.theme && !list.includes(q.question)) list.push(q.question);
    }
  }
  return {
    thisJob: thisJob.slice(0, maxThisJob),
    elsewhere: elsewhere.slice(0, maxElsewhere),
    transcripts: used,
  };
}
