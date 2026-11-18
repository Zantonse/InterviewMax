import { isCaseQuestion } from "@/lib/cases/content";
import type { Citation, NextStep } from "@/lib/profile/assess";
import { QUESTION_THEMES, getTheme, type QuestionThemeId } from "@/lib/questions/themes";
import type { AnswerGapId, AskedQuestion, TranscriptAnalysis } from "./content";
import { surenessFor } from "./sure";

// The user's interview profile: one picture of how they interview, built from every past interview
// they've uploaded and grown with each new one (Craig, Nov 18: "as they upload transcripts it builds
// a profile of strengths, weaknesses and areas to work on, like instant feedback analytics").
// Counted in code from the saved reviews; every strength and weakness quotes the interview behind
// it, so nothing here is invented. No model call.

export type ProfileTranscript = {
  id: string;
  title: string;
  company?: string | null;
  targetJobId: string | null;
  analysis: TranscriptAnalysis | null;
  // The saved text and whose words are the user's: needed for hedge counts only.
  transcript?: string;
  speaker?: string;
  createdAt?: string;
};

// One reviewed interview, scored the same way as the whole profile.
export type InterviewScore = {
  id: string;
  title: string;
  href: string;
  createdAt: string;
  // Answers the review judged (story, case and skills questions; logistics left out).
  judged: number;
  strong: number;
  mixed: number;
  weak: number;
  // Share of judged answers that landed well, 0 to 100. Null with no judged answers.
  landed: number | null;
  // Hedges per 100 words of the user's answers. Null without labelled answers.
  hedges: number | null;
  // What this interview's answers missed, most often first.
  gaps: { gap: AnswerGapId; count: number }[];
};

export type ProfilePoint = {
  id: string;
  title: string;
  detail: string;
  // The review's one-line reason, in its own words (not a quote from the transcript).
  note?: string;
  // Where it shows; its quote is always the transcript's words.
  citation?: Citation;
  next?: NextStep;
  // Ranks points: bigger is more telling.
  weight: number;
};

export type WorkItem = { id: string; title: string; why: string; next: NextStep };

export type InterviewProfile = {
  // Reviewed interviews and judged answers behind the profile.
  interviews: number;
  answers: number;
  landed: number | null;
  hedges: number | null;
  // Oldest first, for the trend strip.
  scores: InterviewScore[];
  strengths: ProfilePoint[];
  weaknesses: ProfilePoint[];
  workOn: WorkItem[];
};

// Fewer judged answers than this and a share says too little to call a strength or weakness.
const MIN_ANSWERS = 3;
// Hedges per 100 words: under SURE sounds sure; from UNSURE on sounds unsure (as in tendencies.ts).
const SURE_BELOW = 0.5;
const UNSURE_FROM = 1;
const SHOW = 3;

// What each missing piece means as a weakness, and where to fix it.
const GAP_WEAKNESS: Partial<Record<AnswerGapId, { title: string; next: NextStep }>> = {
  result: { title: "Answers stop before the result", next: { label: "Fill in your numbers", href: "/numbers" } },
  numbers: { title: "Few numbers in your answers", next: { label: "Fill in your numbers", href: "/numbers" } },
  example: {
    title: "Says what you would do, not what you did",
    next: { label: "Find your stories", href: "/stories/new" },
  },
  ownership: {
    title: "Your own part gets lost in the team's",
    next: { label: "Build a story", href: "/stories/new" },
  },
  actions: { title: "Light on the steps you took", next: { label: "Build a story", href: "/stories/new" } },
  decision: { title: "Doesn't say why you chose", next: { label: "Build a story", href: "/stories/new" } },
  situation: { title: "The stakes aren't clear", next: { label: "Build a story", href: "/stories/new" } },
  reflection: { title: "No lesson at the end", next: { label: "Build a story", href: "/stories/new" } },
  concise: { title: "Takes a while to get to the point", next: { label: "Practice out loud", href: "/practice" } },
  relevance: { title: "Drifts from the question asked", next: { label: "Practice out loud", href: "/practice" } },
};

// Missing pieces that, when almost never missing, are worth calling a strength. Only the two the
// review reliably flags: a rarely flagged gap (numbers, concise) being absent proves little.
const GAP_STRENGTH: Partial<Record<AnswerGapId, string>> = {
  result: "Gets to the result",
  example: "Gives real examples",
};

type Answer = { t: ProfileTranscript; q: AskedQuestion };

const href = (t: { id: string }) => `/transcripts/${t.id}`;

function pct(part: number, whole: number): number {
  return Math.round((part / whole) * 100);
}

function one(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

function clip(text: string, max = 90): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

// Answers worth judging: behavioral ones and case or skills questions. Logistics ("is 30% travel
// OK?") say nothing about how the user interviews.
function judgedAnswers(t: ProfileTranscript): AskedQuestion[] {
  return (t.analysis?.asked ?? []).filter(
    (q) => q.landed !== "unclear" && (q.theme !== null || isCaseQuestion(q.question)),
  );
}

function hedgesFor(t: ProfileTranscript): { words: number; hedges: number; lost: number } | null {
  if (!t.transcript || !t.speaker) return null;
  const s = surenessFor({ transcript: t.transcript, speaker: t.speaker });
  return s ? { words: s.words, hedges: s.hedgeCount, lost: s.lostCount } : null;
}

export function scoreInterview(t: ProfileTranscript): InterviewScore {
  const judged = judgedAnswers(t);
  const strong = judged.filter((q) => q.landed === "strong").length;
  const mixed = judged.filter((q) => q.landed === "mixed").length;
  const weak = judged.filter((q) => q.landed === "weak").length;
  const counts = new Map<AnswerGapId, number>();
  for (const q of judged) for (const g of q.gaps) counts.set(g, (counts.get(g) ?? 0) + 1);
  const h = hedgesFor(t);
  return {
    id: t.id,
    title: t.title,
    href: href(t),
    createdAt: t.createdAt ?? "",
    judged: judged.length,
    strong,
    mixed,
    weak,
    landed: judged.length ? pct(strong, judged.length) : null,
    hedges: h && h.words > 0 ? Math.round((h.hedges / h.words) * 1000) / 10 : null,
    gaps: [...counts.entries()].map(([gap, count]) => ({ gap, count })).sort((a, b) => b.count - a.count),
  };
}

function byDate(a: ProfileTranscript, b: ProfileTranscript): number {
  return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
}

export function buildInterviewProfile(transcripts: ProfileTranscript[]): InterviewProfile {
  const reviewed = transcripts.filter((t) => t.analysis).sort(byDate);
  const answers: Answer[] = reviewed.flatMap((t) => judgedAnswers(t).map((q) => ({ t, q })));
  const strongCount = answers.filter((a) => a.q.landed === "strong").length;
  const sure = reviewed.flatMap((t) => {
    const h = hedgesFor(t);
    return h ? [{ t, ...h }] : [];
  });
  const words = sure.reduce((n, s) => n + s.words, 0);
  const hedges = words > 0 ? Math.round((sure.reduce((n, s) => n + s.hedges, 0) / words) * 1000) / 10 : null;

  const strengths = [
    ...gapStrengths(answers),
    ...themeStrengths(answers),
    ...caseStrength(answers),
    ...(hedges !== null && hedges < SURE_BELOW && words >= 300
      ? [
          {
            id: "sure",
            title: "Sounds sure of yourself",
            detail: `${one(hedges)} hedges per 100 words across ${plural(sure.length, "interview")}.`,
            weight: 0.7,
          },
        ]
      : []),
  ]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, SHOW);

  const lost = sure.reduce((n, s) => n + s.lost, 0);
  const weaknesses = [
    ...gapWeaknesses(answers),
    ...themeWeaknesses(answers),
    ...caseWeakness(answers),
    ...(hedges !== null && hedges >= UNSURE_FROM
      ? [hedgeWeakness(hedges, sure, lost)]
      : []),
  ]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, SHOW);

  return {
    interviews: reviewed.length,
    answers: answers.length,
    landed: answers.length ? pct(strongCount, answers.length) : null,
    hedges,
    scores: reviewed.map(scoreInterview),
    strengths,
    weaknesses,
    workOn: workOn(weaknesses, answers),
  };
}

// ---- Strengths ----

function gapStrengths(answers: Answer[]): ProfilePoint[] {
  const story = answers.filter((a) => a.q.theme);
  if (story.length < MIN_ANSWERS) return [];
  return (Object.entries(GAP_STRENGTH) as [AnswerGapId, string][]).flatMap(([gap, title]) => {
    const missed = story.filter((a) => a.q.gaps.includes(gap)).length;
    if (missed / story.length > 0.1) return [];
    const best = story.find((a) => a.q.landed === "strong" && a.q.evidence);
    return [
      {
        id: `gap-${gap}`,
        title,
        detail: `${story.length - missed} of ${plural(story.length, "story answer")} had it.`,
        ...(best ? { citation: cite(best, best.q.evidence) } : {}),
        // Rare gaps are weak evidence of a strength: result and example matter most.
        weight: 0.9 * Math.min(1, story.length / 6),
      },
    ];
  });
}

function themeStrengths(answers: Answer[]): ProfilePoint[] {
  return themeGroups(answers).flatMap(({ theme, list }) => {
    const strong = list.filter((a) => a.q.landed === "strong");
    const weak = list.filter((a) => a.q.landed === "weak");
    if (strong.length === 0 || strong.length <= weak.length || strong.length < list.length / 2) return [];
    const best = strong.find((a) => a.q.evidence) ?? strong[0];
    return [
      {
        id: `theme-${theme}`,
        title: `Strong on ${getTheme(theme)?.label.toLowerCase() ?? theme}`,
        detail: `${strong.length} of ${plural(list.length, "answer")} on this landed well.`,
        ...point(best),
        weight: 0.5 + 0.15 * strong.length,
      },
    ];
  });
}

function caseStrength(answers: Answer[]): ProfilePoint[] {
  const cases = answers.filter((a) => !a.q.theme);
  const strong = cases.filter((a) => a.q.landed === "strong");
  if (cases.length < 2 || strong.length / cases.length < 0.65) return [];
  return [
    {
      id: "cases",
      title: "Handles case and skills questions",
      detail: `${strong.length} of ${plural(cases.length, "case or skills question")} landed well.`,
      ...point(strong.find((a) => a.q.evidence) ?? strong[0]),
      weight: 0.4 + 0.1 * strong.length,
    },
  ];
}

// ---- Weaknesses ----

function gapWeaknesses(answers: Answer[]): ProfilePoint[] {
  const story = answers.filter((a) => a.q.theme);
  if (story.length < 2) return [];
  return (Object.keys(GAP_WEAKNESS) as AnswerGapId[]).flatMap((gap) => {
    const missed = story.filter((a) => a.q.gaps.includes(gap));
    if (missed.length < 2) return [];
    const where = new Set(missed.map((a) => a.t.id)).size;
    // A probe asking for the missing piece is the clearest evidence; else the answer itself.
    const quoted = missed.find((a) => a.q.evidence) ?? missed[0];
    const share = missed.length / story.length;
    return [
      {
        id: `gap-${gap}`,
        title: GAP_WEAKNESS[gap]!.title,
        detail: `${missed.length} of ${plural(story.length, "story answer")}${where > 1 ? `, in ${where} interviews` : ""}.`,
        ...point(quoted),
        next: GAP_WEAKNESS[gap]!.next,
        // Spread across interviews makes it a habit, not a one-off.
        weight: share + 0.1 * Math.min(where, 4),
      },
    ];
  });
}

function themeWeaknesses(answers: Answer[]): ProfilePoint[] {
  return themeGroups(answers).flatMap(({ theme, list }) => {
    const off = list.filter((a) => a.q.landed === "weak" || a.q.landed === "mixed");
    const strong = list.filter((a) => a.q.landed === "strong");
    if (off.length < 2 || strong.length >= off.length) return [];
    const worst = off.find((a) => a.q.landed === "weak") ?? off[0];
    const storyType = QUESTION_THEMES.find((x) => x.id === theme)?.storyTypes[0];
    return [
      {
        id: `theme-${theme}`,
        title: `Answers on ${getTheme(theme)?.label.toLowerCase() ?? theme} don't land`,
        detail: `${off.length} of ${plural(list.length, "answer")} landed partly or not at all.`,
        ...point(worst),
        next: storyType ? { label: "Build a story for it", storyType } : { label: "Build a story", href: "/stories/new" },
        // A theme that misses is often the same habit as a missing piece: rank it below that habit.
        weight: 0.6 * (off.length / list.length) + 0.05 * Math.min(off.length, 4),
      },
    ];
  });
}

function caseWeakness(answers: Answer[]): ProfilePoint[] {
  const cases = answers.filter((a) => !a.q.theme);
  const off = cases.filter((a) => a.q.landed !== "strong");
  if (cases.length < 2 || off.length / cases.length < 0.65) return [];
  const worst = off.find((a) => a.q.landed === "weak") ?? off[0];
  const jobId = worst.t.targetJobId;
  return [
    {
      id: "cases",
      title: "Case and skills questions trip you up",
      detail: `${off.length} of ${plural(cases.length, "case or skills question")} didn't fully land.`,
      ...point(worst),
      next: { label: "Practice case questions", href: jobId ? `/jobs/${jobId}#cases` : "/jobs" },
      weight: 0.6 * (off.length / cases.length) + 0.05 * Math.min(off.length, 4),
    },
  ];
}

function hedgeWeakness(
  hedges: number,
  sure: { t: ProfileTranscript; words: number; hedges: number }[],
  lost: number,
): ProfilePoint {
  const worst = [...sure].sort((a, b) => b.hedges / b.words - a.hedges / a.words)[0];
  return {
    id: "hedging",
    title: "Hedging undercuts your answers",
    detail: `${one(hedges)} hedges per 100 words (“I think”, “kind of”)${lost > 0 ? `; lost your place ${plural(lost, "time")}` : ""}.`,
    citation: { label: `Most in ${worst.t.title}`, href: href(worst.t) },
    next: { label: "Practice out loud", href: "/practice" },
    weight: Math.min(1.2, hedges / 2 + 0.3),
  };
}

// ---- Areas to work on ----

// One step per weakness, in the weaknesses' order, plus the theme interviewers asked most that
// has no strong answer yet. Steps that land in the same place are named once.
function workOn(weaknesses: ProfilePoint[], answers: Answer[]): WorkItem[] {
  const items: WorkItem[] = [];
  const seen = new Set<string>();
  const add = (item: WorkItem) => {
    const key = item.next.storyType ?? item.next.href ?? item.id;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };
  for (const w of weaknesses) {
    if (!w.next) continue;
    add({ id: w.id, title: w.next.label, why: `${w.title}: ${w.detail.replace(/\.$/, "")}.`, next: w.next });
  }
  const asked = themeGroups(answers)
    .filter((g) => !g.list.some((a) => a.q.landed === "strong"))
    .sort((a, b) => b.list.length - a.list.length)[0];
  const storyType = asked && QUESTION_THEMES.find((x) => x.id === asked.theme)?.storyTypes[0];
  if (asked && storyType && asked.list.length >= 2) {
    add({
      id: `asked-${asked.theme}`,
      title: `Build a story for ${getTheme(asked.theme)?.label.toLowerCase()}`,
      why: `Asked ${asked.list.length} times and no answer landed well yet.`,
      next: { label: "Build it", storyType },
    });
  }
  return items.slice(0, SHOW);
}

// ---- What one interview changed ----

export type ProfileMove = {
  text: string;
  direction: "up" | "down" | "same";
};

// How one interview compares with the reviewed interviews added before it: the instant feedback
// after an upload. Empty when it's the first reviewed interview or it has nothing to compare.
export function profileMoves(transcripts: ProfileTranscript[], id: string): ProfileMove[] {
  const all = transcripts.filter((t) => t.analysis).sort(byDate);
  const at = all.findIndex((t) => t.id === id);
  if (at < 1) return [];
  const before = buildInterviewProfile(all.slice(0, at));
  const here = scoreInterview(all[at]);
  if (before.answers === 0 || here.judged === 0) return [];
  const moves: ProfileMove[] = [];

  if (here.landed !== null && before.landed !== null) {
    const diff = here.landed - before.landed;
    moves.push({
      text: `${here.landed}% of answers landed well here, against ${before.landed}% in your earlier interviews.`,
      direction: Math.abs(diff) < 10 ? "same" : diff > 0 ? "up" : "down",
    });
  }
  if (here.hedges !== null && before.hedges !== null && Math.abs(here.hedges - before.hedges) >= 0.3) {
    moves.push({
      text: `${one(here.hedges)} hedges per 100 words, ${here.hedges < before.hedges ? "down" : "up"} from ${one(before.hedges)}.`,
      direction: here.hedges < before.hedges ? "up" : "down",
    });
  }
  // Weaknesses from before that this interview didn't show, and missing pieces it showed for the
  // first time.
  const beforeAnswers = all.slice(0, at).flatMap((t) => judgedAnswers(t));
  const missedBefore = new Set(beforeAnswers.flatMap((q) => q.gaps));
  const missedHere = new Set(here.gaps.map((g) => g.gap));
  for (const w of before.weaknesses) {
    const gap = w.id.startsWith("gap-") ? (w.id.slice(4) as AnswerGapId) : null;
    if (gap && !missedHere.has(gap) && here.judged >= 2) {
      moves.push({ text: `No answer here had your usual problem: ${w.title.toLowerCase()}.`, direction: "up" });
    }
  }
  for (const g of here.gaps) {
    if (!missedBefore.has(g.gap) && GAP_WEAKNESS[g.gap]) {
      moves.push({ text: `New this time: ${GAP_WEAKNESS[g.gap]!.title.toLowerCase()} (${plural(g.count, "answer")}).`, direction: "down" });
    }
  }
  return moves.slice(0, 5);
}

// ---- Helpers ----

function themeGroups(answers: Answer[]): { theme: QuestionThemeId; list: Answer[] }[] {
  const groups = new Map<QuestionThemeId, Answer[]>();
  for (const a of answers) {
    if (!a.q.theme) continue;
    groups.set(a.q.theme, [...(groups.get(a.q.theme) ?? []), a]);
  }
  return [...groups.entries()].map(([theme, list]) => ({ theme, list }));
}

// The interview behind a point: the user's words quoted from the transcript, and the review's note.
function point(a: Answer): { citation: Citation; note?: string } {
  return { citation: cite(a, a.q.evidence), ...(a.q.note ? { note: a.q.note } : {}) };
}

function cite(a: Answer, quote: string): Citation {
  return { label: `${a.t.title}: “${clip(a.q.question)}”`, href: href(a.t), ...(quote ? { quote } : {}) };
}
