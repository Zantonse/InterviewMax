import { ROUNDS, roundLabel, type RoundId } from "@/lib/bank/content";
import { getTheme } from "@/lib/questions/themes";
import type { AskedQuestion, TranscriptAnalysis } from "./content";

// The interview timeline on a target job's page: the user's past interviews for that job (or at the
// same company), one step per round in order, with who they met, what was asked and how it landed,
// then what to prepare for the next round. Worked out in code from what the transcripts already
// hold; no model call.

export type TimelineTranscript = {
  id: string;
  targetJobId: string | null;
  title: string;
  company: string | null;
  // The user's own speaker label.
  speaker: string;
  transcript: string;
  analysis: TranscriptAnalysis | null;
  round: string | null;
  createdAt: string;
};

export type TimelineStep = {
  transcriptId: string;
  title: string;
  // The round the user set, else the one the title or summary suggests, else null.
  round: RoundId | null;
  // True when the round is a guess from the title or summary, not one the user picked.
  guessed: boolean;
  roundLabel: string;
  // The interviewers named in the transcript, as their speaker labels.
  interviewers: string[];
  summary: string | null;
  asked: Pick<AskedQuestion, "question" | "theme" | "landed">[];
  // Questions whose answer landed weak or partly.
  toFix: number;
  reviewed: boolean;
};

export type NextRound = {
  // The round that usually comes next, or null when the last one was the final round or no round
  // is known.
  label: string | null;
  // Answers that didn't land, worst first: worth preparing before the next round.
  prepare: { question: string; landed: "weak" | "mixed"; theme: string | null }[];
  // Themes asked in more than one round: they'll likely come up again.
  repeated: string[];
};

export type Timeline = { steps: TimelineStep[]; next: NextRound };

export const MAX_TIMELINE_QUESTIONS = 6;
export const MAX_INTERVIEWERS = 4;
const MAX_PREPARE = 3;

// Where each round sits in a typical process. "Another round" has no fixed place.
const ORDER: Partial<Record<RoundId, number>> = {
  recruiter: 0,
  hiring_manager: 1,
  panel: 2,
  final: 3,
};

// Words in an interview's title or summary that say which round it was. Most specific first.
const ROUND_HINTS: [RoundId, RegExp][] = [
  ["final", /\bfinal\b/i],
  ["panel", /\b(panel|on-?site|loop|super ?day)\b/i],
  ["hiring_manager", /\b([Hh]iring [Mm]anager|HM)\b/],
  [
    "recruiter",
    /\b(recruit\w*|phone screen|screening call|talent acquisition|HR screen|intro call)\b/i,
  ],
];

export function guessRound(text: string): RoundId | null {
  for (const [id, re] of ROUND_HINTS) if (re.test(text)) return id;
  return null;
}

// Speaker labels that are a role, not a person.
const NOT_A_NAME = /^(interviewer|me|you|candidate|speaker\s*\d*|host|guest|unknown)$/i;

// The interviewers as the transcript names them ("Dana Smith: …"), in the order they first speak.
export function interviewersIn(transcript: string, ownLabel: string): string[] {
  const own = ownLabel.trim().toLowerCase();
  const seen: string[] = [];
  for (const line of transcript.split("\n")) {
    const m = line.match(/^\s*([^:\n]{1,40}):\s/);
    if (!m) continue;
    const label = m[1].trim();
    if (!label || label.toLowerCase() === own || NOT_A_NAME.test(label)) continue;
    // A label is a name when it's one to four words that start with a capital.
    if (!/^\p{Lu}[\p{L}'.-]*(?:\s+\p{Lu}[\p{L}'.-]*){0,3}$/u.test(label)) continue;
    if (!seen.includes(label)) seen.push(label);
    if (seen.length >= MAX_INTERVIEWERS) break;
  }
  return seen;
}

function sameCompany(a: string | null, b: string | null): boolean {
  const x = a?.trim().toLowerCase();
  return Boolean(x) && x === b?.trim().toLowerCase();
}

export function buildTimeline(
  job: { id: string; company: string | null },
  transcripts: TimelineTranscript[],
): Timeline {
  const mine = transcripts
    .filter(
      (t) => t.targetJobId === job.id || (!t.targetJobId && sameCompany(t.company, job.company)),
    )
    // Upload order, oldest first, is the fallback order.
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const steps: TimelineStep[] = mine.map((t) => {
    const set = ROUNDS.some((r) => r.id === t.round) ? (t.round as RoundId) : null;
    const guess = set ? null : guessRound(`${t.title}\n${t.analysis?.summary ?? ""}`);
    const round = set ?? guess;
    const asked = t.analysis?.asked ?? [];
    return {
      transcriptId: t.id,
      title: t.title,
      round,
      guessed: !set && Boolean(guess),
      roundLabel: roundLabel(round) ?? "Round not set",
      interviewers: interviewersIn(t.transcript, t.speaker),
      summary: t.analysis?.summary || null,
      asked: asked
        .slice(0, MAX_TIMELINE_QUESTIONS)
        .map(({ question, theme, landed }) => ({ question, theme, landed })),
      toFix: asked.filter((q) => q.landed === "weak" || q.landed === "mixed").length,
      reviewed: Boolean(t.analysis),
    };
  });

  // Rounds with a known place go in that order. The rest keep their upload order, each placed
  // right after the step uploaded before it, so an unlabelled interview doesn't jump to the end.
  const rank: number[] = [];
  steps.forEach((s, i) => {
    const known = s.round ? ORDER[s.round] : undefined;
    rank.push(known ?? (i > 0 ? rank[i - 1] : -1));
  });
  const ordered = steps
    .map((s, i) => ({ s, r: rank[i], i }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.s);

  return { steps: ordered, next: nextRound(ordered, mine) };
}

function nextRound(steps: TimelineStep[], transcripts: TimelineTranscript[]): NextRound {
  const ranks = steps.flatMap((s) =>
    s.round && ORDER[s.round] !== undefined ? [ORDER[s.round]!] : [],
  );
  const furthest = ranks.length ? Math.max(...ranks) : null;
  const nextId =
    furthest === null
      ? null
      : (Object.entries(ORDER).find(([, n]) => n === furthest + 1)?.[0] as RoundId | undefined);

  // Weak answers before partly landed ones; later rounds first, since they're the freshest.
  const prepare: NextRound["prepare"] = [];
  for (const landed of ["weak", "mixed"] as const) {
    for (const s of [...steps].reverse()) {
      const t = transcripts.find((x) => x.id === s.transcriptId);
      for (const q of t?.analysis?.asked ?? []) {
        if (q.landed !== landed || prepare.some((p) => p.question === q.question)) continue;
        prepare.push({ question: q.question, landed, theme: getTheme(q.theme)?.label ?? null });
      }
    }
  }

  const roundsPerTheme = new Map<string, number>();
  for (const t of transcripts) {
    const themes = new Set((t.analysis?.asked ?? []).flatMap((q) => (q.theme ? [q.theme] : [])));
    for (const th of themes) roundsPerTheme.set(th, (roundsPerTheme.get(th) ?? 0) + 1);
  }
  const repeated = [...roundsPerTheme.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .flatMap(([id]) => {
      const label = getTheme(id)?.label;
      return label ? [label] : [];
    });

  return {
    label: nextId ? (roundLabel(nextId) ?? null) : null,
    prepare: prepare.slice(0, MAX_PREPARE),
    repeated,
  };
}
