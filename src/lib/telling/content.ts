import { findNumbers } from "@/lib/stories/numbers";
import { countWords } from "@/lib/stories/grading";
import { storyParts, type StoryType } from "@/lib/stories/story-types";

// "How to tell it" (PRD v0.3, P1): coaching on telling a written story out loud, like a storyteller
// rather than reading a report. One model call (storyTell, see coach.ts) turns the written story
// into two hook options and a 30-second and a 2-minute version made of beats; everything else here
// is plain code: the pause and emphasis cues, the speaking time, and the checks on the setup, a
// buried result and the ending. It changes how the story is told, never its facts or its score.

// The beats a told version is made of. The hook is picked separately and said first.
export const BEATS = [
  { id: "stakes", label: "Stakes" },
  { id: "turn", label: "The turn" },
  { id: "detail", label: "Vivid detail" },
  { id: "actions", label: "What I did" },
  { id: "landing", label: "Land it" },
  { id: "link", label: "Why it matters for this role" },
] as const;

export type BeatId = (typeof BEATS)[number]["id"];

export type Beat = { beat: BeatId; text: string };

export const VERSIONS = [
  { id: "short", label: "30 seconds", note: "For quick screens", words: { min: 45, max: 95 } },
  { id: "long", label: "2 minutes", note: "For deep-dive rounds", words: { min: 180, max: 320 } },
] as const;

export type VersionId = (typeof VERSIONS)[number]["id"];

// A vivid detail from the user's own answers (`quote` is copied from them and checked in code), or,
// when there isn't one, a question asking for one. Never invented.
export type VividDetail = { quote: string } | { ask: string };

export type StoryTelling = {
  // Two opening lines: the result or the stakes first.
  hooks: string[];
  // Which hook the user picked.
  hookIndex: number;
  detail: VividDetail;
  versions: Record<VersionId, Beat[]>;
  // How the written story did on the checks below, when the coaching ran. What the coaching fixes.
  draftChecks: TellingCheck[];
  // Figures in the hooks or versions that aren't in the user's answers. Should be empty.
  untracedNumbers: string[];
  model: string;
  // The draft this coaching was made from. Stale once the story is rewritten.
  draftWrittenAt: string;
  coachedAt: string;
};

// Speaking pace, as for the written script: about 150 words a minute.
const WORDS_PER_MINUTE = 150;
// A setup longer than this share of the words loses the listener before anything happens.
export const MAX_SETUP_SHARE = 0.25;

export function canTell(storyType: StoryType | undefined): boolean {
  // "Tell me about yourself" has its own shape (present, past, proof, future) and per-job versions.
  return storyType?.format !== "intro";
}

// Whether the coaching matches the current draft.
export function tellingIsCurrent(
  telling: StoryTelling | undefined,
  draftWrittenAt: string | undefined,
): telling is StoryTelling {
  return Boolean(telling && draftWrittenAt && telling.draftWrittenAt === draftWrittenAt);
}

export function beatLabel(id: BeatId): string {
  return BEATS.find((b) => b.id === id)?.label ?? id;
}

// One version as it's said: the picked hook, then the beats.
export function versionText(telling: StoryTelling, version: VersionId): string {
  const hook = telling.hooks[telling.hookIndex] ?? telling.hooks[0] ?? "";
  return [hook, ...telling.versions[version].map((b) => b.text)].filter(Boolean).join(" ");
}

export function speakingSeconds(text: string): number {
  return Math.round(((countWords(text) / WORDS_PER_MINUTE) * 60) / 5) * 5;
}

// Delivery cues, worked out in code so they're the same every time: a pause before the turn and
// before the landing, and emphasis on the figures in the hook and the landing.
export function pauseBefore(beat: BeatId): boolean {
  return beat === "turn" || beat === "landing";
}

export type Piece = { text: string; emphasis: boolean };

export function withEmphasis(text: string, emphasize: boolean): Piece[] {
  if (!emphasize) return [{ text, emphasis: false }];
  const raws = [...new Set(findNumbers(text, { includeCommonWords: false }).map((n) => n.raw))];
  if (raws.length === 0) return [{ text, emphasis: false }];
  const escaped = raws
    .sort((a, b) => b.length - a.length)
    .map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return text
    .split(new RegExp(`(${escaped.join("|")})`, "g"))
    .filter(Boolean)
    .map((piece) => ({ text: piece, emphasis: raws.includes(piece) }));
}

export function emphasizeBeat(beat: BeatId): boolean {
  return beat === "landing";
}

// The checks from the PRD: a setup over about a quarter of the words, a result buried in the
// middle, and an ending with no number or link to the role. They run on the written story (to show
// what the coaching fixes) and on each told version (which should pass; see coach.ts).
export type TellingCheckId = "setup" | "buried" | "ending";

export type TellingCheck = { id: TellingCheckId; passed: boolean; note: string };

export const CHECK_LABELS: Record<TellingCheckId, string> = {
  setup: "Gets to the point",
  buried: "Result up front or at the end",
  ending: "Ends on a number or the role",
};

// A story as a list of segments in the order they're said, with which ones are setup, which one
// carries the result, and whether the last one links to the role.
type Segments = {
  segments: { text: string; setup: boolean; result: boolean }[];
  // Whether the ending ties the story to the role they want.
  endsOnRole: boolean;
};

export function runChecks({ segments, endsOnRole }: Segments): TellingCheck[] {
  const total = segments.reduce((n, s) => n + countWords(s.text), 0) || 1;
  const setupWords = segments.filter((s) => s.setup).reduce((n, s) => n + countWords(s.text), 0);
  const share = setupWords / total;

  const resultIndex = segments.findIndex((s) => s.result);
  const resultFigures = resultIndex >= 0 ? figures(segments[resultIndex].text) : [];
  const openingFigures = segments.length ? figures(firstSentence(segments[0].text)) : [];
  const buried =
    resultIndex > 0 &&
    resultIndex < segments.length - 1 &&
    !resultFigures.some((f) => openingFigures.includes(f)) &&
    // A result said again at the end isn't buried.
    !resultFigures.some((f) => figures(segments[segments.length - 1].text).includes(f));

  const last = segments[segments.length - 1]?.text ?? "";
  const endsOnNumber = figures(lastSentences(last)).length > 0;

  return [
    {
      id: "setup",
      passed: share <= MAX_SETUP_SHARE,
      note:
        share <= MAX_SETUP_SHARE
          ? `The setup is ${pct(share)} of the story, so the listener reaches the action fast.`
          : `The setup takes ${pct(share)} of the words. Keep it to about a quarter so the listener reaches the action before drifting.`,
    },
    {
      id: "buried",
      passed: !buried,
      note: buried
        ? "The result sits in the middle, where it's easy to miss. Say it first as a headline or land on it at the end."
        : "The result is where the listener will remember it.",
    },
    {
      id: "ending",
      passed: endsOnNumber || endsOnRole,
      note:
        endsOnNumber || endsOnRole
          ? "It ends on something concrete."
          : "It trails off at the end. Finish on the result's number, then one line on why it matters for the role.",
    },
  ];
}

// The written story as segments: its parts in order, Situation and Your role as setup.
export function draftChecks(
  parts: Record<string, string>,
  storyType: StoryType | undefined,
  roleWords: string[],
): TellingCheck[] {
  const segments = storyParts(storyType)
    .map((p) => ({
      text: parts[p.id] ?? "",
      setup: p.id === "situation" || p.id === "role",
      result: p.id === "result",
    }))
    .filter((s) => s.text.trim());
  const last = segments[segments.length - 1]?.text ?? "";
  return runChecks({ segments, endsOnRole: mentionsRole(lastSentences(last), roleWords) });
}

// A told version as segments: the hook first, stakes as setup, the landing as the result.
export function versionChecks(hook: string, beats: Beat[]): TellingCheck[] {
  const segments = [
    { text: hook, setup: false, result: false },
    ...beats.map((b) => ({ text: b.text, setup: b.beat === "stakes", result: b.beat === "landing" })),
  ].filter((s) => s.text.trim());
  const link = beats[beats.length - 1];
  return runChecks({ segments, endsOnRole: link?.beat === "link" && Boolean(link.text.trim()) });
}

// Words that name the role they want: their target job titles and companies. "Role" and "team"
// alone are too common to count.
export function roleWordsFrom(jobs: { title: string; company: string | null }[]): string[] {
  const words = jobs.flatMap((j) => [j.title, j.company ?? ""]).map((w) => w.trim().toLowerCase());
  return [...new Set(words.filter((w) => w.length > 2))];
}

function mentionsRole(text: string, roleWords: string[]): boolean {
  const lower = text.toLowerCase();
  return roleWords.some((w) => lower.includes(w)) || /\b(this|the) (role|job|position)\b/i.test(text);
}

function figures(text: string): number[] {
  return findNumbers(text, { includeCommonWords: false }).map((n) => n.value);
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
}

function firstSentence(text: string): string {
  return sentences(text)[0] ?? "";
}

// The last two sentences: where a story lands.
function lastSentences(text: string): string {
  return sentences(text).slice(-2).join(" ");
}

function pct(share: number) {
  return `${Math.round(share * 100)}%`;
}

// Reads stories.content.telling defensively: it is jsonb, so its shape isn't guaranteed.
export function parseTelling(raw: unknown): StoryTelling | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.hooks) || !isRecord(raw.versions)) return undefined;
  const hooks = raw.hooks.filter((h): h is string => typeof h === "string" && Boolean(h.trim()));
  if (hooks.length === 0) return undefined;
  const versions = {} as Record<VersionId, Beat[]>;
  for (const v of VERSIONS) {
    const beats = parseBeats(raw.versions[v.id]);
    if (beats.length === 0) return undefined;
    versions[v.id] = beats;
  }
  const hookIndex =
    typeof raw.hookIndex === "number" && raw.hookIndex >= 0 && raw.hookIndex < hooks.length
      ? Math.floor(raw.hookIndex)
      : 0;
  return {
    hooks,
    hookIndex,
    detail: parseDetail(raw.detail),
    versions,
    draftChecks: Array.isArray(raw.draftChecks) ? raw.draftChecks.flatMap(parseCheck) : [],
    untracedNumbers: Array.isArray(raw.untracedNumbers)
      ? raw.untracedNumbers.filter((n): n is string => typeof n === "string")
      : [],
    model: typeof raw.model === "string" ? raw.model : "",
    draftWrittenAt: typeof raw.draftWrittenAt === "string" ? raw.draftWrittenAt : "",
    coachedAt: typeof raw.coachedAt === "string" ? raw.coachedAt : "",
  };
}

const BEAT_IDS = new Set<string>(BEATS.map((b) => b.id));

export function parseBeats(raw: unknown): Beat[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).flatMap((b) =>
    typeof b.beat === "string" && BEAT_IDS.has(b.beat) && typeof b.text === "string" && b.text.trim()
      ? [{ beat: b.beat as BeatId, text: b.text.trim() }]
      : [],
  );
}

export function parseDetail(raw: unknown): VividDetail {
  if (isRecord(raw) && typeof raw.quote === "string" && raw.quote.trim()) {
    return { quote: raw.quote.trim() };
  }
  if (isRecord(raw) && typeof raw.ask === "string" && raw.ask.trim()) return { ask: raw.ask.trim() };
  return { ask: "What's one specific moment from this you still remember: something someone said, what you saw, or the number on the screen?" };
}

const CHECK_IDS = new Set<string>(["setup", "buried", "ending"]);

function parseCheck(raw: unknown): TellingCheck[] {
  return isRecord(raw) &&
    typeof raw.id === "string" &&
    CHECK_IDS.has(raw.id) &&
    typeof raw.passed === "boolean" &&
    typeof raw.note === "string"
    ? [{ id: raw.id as TellingCheckId, passed: raw.passed, note: raw.note }]
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
