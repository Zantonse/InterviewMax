import { caseKind, isCaseQuestion } from "@/lib/cases/content";
import { getTheme } from "@/lib/questions/themes";
import type { AskedQuestion, TranscriptAnalysis } from "@/lib/transcripts/content";
import { surenessFor, type Sureness } from "@/lib/transcripts/sure";
import type { Citation, NextStep, Status } from "./assess";

// How the user tends to interview, from their real past interviews (tester material, Oct 17):
// how sure they sound, whether answers reach a result, whether they give a real example or say
// what they "would" do, which skills interviewers test, and which stories landed in the room.
// All counted in code from the transcripts and their reviews, each with the quote behind it.

export const TENDENCIES = [
  { id: "sure", label: "How sure you sound" },
  { id: "result", label: "Gets to the result" },
  { id: "example", label: "Real examples" },
  { id: "tested", label: "Skills they test" },
  { id: "landed", label: "Stories that landed" },
] as const;

export type TendencyId = (typeof TENDENCIES)[number]["id"];

export type Tendency = {
  id: TendencyId;
  label: string;
  status: Status;
  headline: string;
  details: string[];
  citations: Citation[];
  // Where to go to improve this.
  next?: NextStep;
  // "Skills they test" only: each named tool, its detail line and where to practice it.
  skills?: SkillLink[];
};

export type SkillLink = {
  name: string;
  // The line in details this skill shows as.
  detail: string;
  // The target job of the most recent interview it came up in, if that interview has one.
  jobId: string | null;
  // That job's case & skills questions, or the jobs list without a job.
  href: string;
};

export type TendencyTranscript = {
  id: string;
  title: string;
  targetJobId: string | null;
  analysis: TranscriptAnalysis | null;
  // The saved text and whose words are the user's: needed for "How sure you sound" only.
  transcript?: string;
  speaker?: string;
  createdAt?: string;
};

// Follow-ups that ask for the outcome: "what actually changed?", "what was the impact?".
const RESULT_PROBE =
  /\b(?:what (?:actually )?changed|what (?:was|were) the (?:result|outcome|impact)s?|what happened (?:after|next|as a result)|(?:the |any )?(?:result|outcome|impact)s?\b.*\?|how did (?:it|that) (?:turn out|go|end)|did (?:it|that) work)/i;

// Tools interviewers name in skills questions. "R" alone is left out: too easy to misread.
const SKILLS: { name: string; pattern: RegExp }[] = [
  { name: "SQL", pattern: /\b(?:sql|sequel)\b/i },
  { name: "Python", pattern: /\bpython\b/i },
  { name: "Tableau", pattern: /\btableau\b/i },
  { name: "Power BI", pattern: /\bpower ?bi\b/i },
  { name: "Excel", pattern: /\bexcel\b/i },
];

// Hedges per 100 words of the user's answers: below this sounds sure, at or above many (the
// same line as the "How sure you sounded" card) sounds unsure.
const SURE_BELOW = 0.5;
const UNSURE_FROM = 1;

// Fewer judged answers than this and a share says too little to show.
const MIN_ANSWERS = 3;

type Answer = { t: TendencyTranscript; q: AskedQuestion };

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

function one(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

function shareStatus(missShare: number): Status {
  return missShare <= 0.2 ? "strong" : missShare <= 0.45 ? "developing" : "weak";
}

const href = (t: { id: string }) => `/transcripts/${t.id}`;

function noData(id: TendencyId, headline: string, next?: NextStep): Tendency {
  const label = TENDENCIES.find((x) => x.id === id)!.label;
  return { id, label, status: "no_data", headline, details: [], citations: [], ...(next ? { next } : {}) };
}

const REVIEW_NEXT: NextStep = { label: "Review a past interview", href: "/transcripts" };

function sure(transcripts: TendencyTranscript[]): Tendency {
  const rated = transcripts
    .flatMap((t) => {
      if (!t.transcript || !t.speaker) return [];
      const s = surenessFor({ transcript: t.transcript, speaker: t.speaker });
      return s ? [{ t, s }] : [];
    })
    .sort((a, b) => (a.t.createdAt ?? "").localeCompare(b.t.createdAt ?? ""));
  if (rated.length === 0) {
    return noData("sure", "Add a past interview with your answers labelled to see how sure you sound.", {
      label: "Add a past interview",
      href: "/transcripts",
    });
  }
  const words = rated.reduce((a, r) => a + r.s.words, 0);
  const hedges = rated.reduce((a, r) => a + r.s.hedgeCount, 0);
  const lost = rated.reduce((a, r) => a + r.s.lostCount, 0);
  const per100 = Math.round((hedges / words) * 1000) / 10;
  const status: Status = per100 < SURE_BELOW ? "strong" : per100 < UNSURE_FROM ? "developing" : "weak";

  const details = [
    ...topPhrases(rated.map((r) => r.s)),
    ...(lost > 0 ? [`Lost your place ${plural(lost, "time")} (asked for a repeat, blanked, needed a moment)`] : []),
  ];
  // Change over time only when the interviews were added on different days: a batch uploaded at
  // once has no order worth reading.
  const first = rated[0];
  const last = rated[rated.length - 1];
  if (rated.length >= 2 && first.t.createdAt?.slice(0, 10) !== last.t.createdAt?.slice(0, 10)) {
    const from = first.s.per100;
    const to = last.s.per100;
    if (Math.abs(to - from) >= 0.3) {
      details.unshift(`${to < from ? "Down" : "Up"} from ${one(from)} to ${one(to)} per 100 words since your first one`);
    }
  }
  const worst = [...rated].sort((a, b) => b.s.per100 - a.s.per100)[0];
  return {
    id: "sure",
    label: "How sure you sound",
    status,
    headline: `${one(per100)} hedges per 100 words across ${plural(rated.length, "interview")}.`,
    details,
    citations: [
      {
        label: `Most in ${worst.t.title}: ${one(worst.s.per100)} per 100 words`,
        href: href(worst.t),
      },
    ],
    next: { label: "Practice out loud", href: "/jobs" },
  };
}

function topPhrases(all: Sureness[]): string[] {
  const counts = new Map<string, number>();
  for (const s of all) for (const h of s.hedges) counts.set(h.phrase, (counts.get(h.phrase) ?? 0) + h.count);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return top.length ? [`Most often: ${top.map(([p, n]) => `“${p}” ${n}×`).join(", ")}`] : [];
}

function storyAnswers(transcripts: TendencyTranscript[]): Answer[] {
  return transcripts.flatMap((t) => (t.analysis?.asked ?? []).filter((q) => q.theme).map((q) => ({ t, q })));
}

function result(transcripts: TendencyTranscript[]): Tendency {
  const answers = storyAnswers(transcripts);
  if (answers.length < MIN_ANSWERS) return noData("result", "Review a few past interviews to see this.", REVIEW_NEXT);
  const missed = answers.filter((a) => a.q.gaps.includes("result"));
  const pushed = answers
    .map((a) => ({ ...a, asks: a.q.probes.filter((p) => RESULT_PROBE.test(p)) }))
    .filter((a) => a.asks.length > 0)
    .sort((a, b) => b.asks.length - a.asks.length);
  const asks = pushed.reduce((n, a) => n + a.asks.length, 0);
  const top = pushed[0];
  const cite = top ? { ...top, quote: top.asks[0] } : missed.map((a) => ({ ...a, quote: a.q.evidence })).find((a) => a.quote);
  return {
    id: "result",
    label: "Gets to the result",
    status: shareStatus(missed.length / answers.length),
    headline: `${answers.length - missed.length} of ${plural(answers.length, "story answer")} reached a clear result.`,
    details: asks > 0 ? [`Interviewers asked for the outcome ${plural(asks, "time")} on ${plural(pushed.length, "answer")}`] : [],
    citations: cite
      ? [
          {
            label: `${cite.t.title}: “${clip(cite.q.question)}”`,
            href: href(cite.t),
            quote: cite.quote,
          },
        ]
      : [],
    next: { label: "Fill in your numbers", href: "/numbers" },
  };
}

function example(transcripts: TendencyTranscript[]): Tendency {
  const answers = storyAnswers(transcripts);
  if (answers.length < MIN_ANSWERS) return noData("example", "Review a few past interviews to see this.", REVIEW_NEXT);
  const general = answers.filter((a) => a.q.gaps.includes("example"));
  const cite = general.find((a) => a.q.evidence) ?? general[0];
  return {
    id: "example",
    label: "Real examples",
    status: shareStatus(general.length / answers.length),
    headline: general.length
      ? `${plural(general.length, "story answer")} of ${answers.length} stayed general or said what you would do.`
      : `All ${answers.length} story answers gave a real example.`,
    details: [],
    citations: cite
      ? [{ label: `${cite.t.title}: “${clip(cite.q.question)}”`, href: href(cite.t), quote: cite.q.evidence || undefined }]
      : [],
    next: general.length > 0 ? { label: "Find your stories", href: "/stories/new" } : { label: "Build another story", href: "/stories/new" },
  };
}

function tested(transcripts: TendencyTranscript[]): Tendency {
  const asked = transcripts.flatMap((t) =>
    (t.analysis?.asked ?? []).filter((q) => !q.theme && isCaseQuestion(q.question)).map((q) => ({ t, q })),
  );
  if (asked.length === 0) {
    return noData("tested", "No case or skills questions in your reviewed interviews yet.", REVIEW_NEXT);
  }
  const reviewed = transcripts.filter((t) => t.analysis).length;
  const skills = SKILLS.map((s) => {
    const hits = asked.filter((a) => s.pattern.test(a.q.question));
    const count = new Set(hits.map((a) => a.t.id)).size;
    // The most recent interview with a target job: that job's case questions are the place to practice.
    const withJob = hits
      .filter((a) => a.t.targetJobId)
      .sort((a, b) => (b.t.createdAt ?? "").localeCompare(a.t.createdAt ?? ""))[0];
    const jobId = withJob?.t.targetJobId ?? null;
    return { name: s.name, count, jobId };
  })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((s) => ({
      name: s.name,
      detail: `${s.name} came up in ${s.count} of ${plural(reviewed, "interview")}`,
      jobId: s.jobId,
      href: s.jobId ? `/jobs/${s.jobId}#cases` : "/jobs",
    }));
  const cases = asked.filter((a) => caseKind(a.q.question) === "case").length;
  const judged = asked.filter((a) => a.q.landed !== "unclear");
  const strong = judged.filter((a) => a.q.landed === "strong");
  const weakest = judged.find((a) => a.q.landed === "weak") ?? judged.find((a) => a.q.landed === "mixed");
  const share = judged.length ? strong.length / judged.length : 0;
  return {
    id: "tested",
    label: "Skills they test",
    status: judged.length === 0 ? "no_data" : share >= 0.65 ? "strong" : share >= 0.35 ? "developing" : "weak",
    headline: `${plural(asked.length, "case or skills question")}${judged.length ? `, ${strong.length} landed well` : ""}.`,
    details: [
      ...skills.map((s) => s.detail),
      ...(cases > 0 ? [`${plural(cases, "case question")} to reason through`] : []),
    ],
    citations: weakest
      ? [{ label: `${weakest.t.title}: “${clip(weakest.q.question)}”`, href: href(weakest.t), quote: weakest.q.note || undefined }]
      : [],
    next: {
      label: "Practice case questions",
      href: weakest?.t.targetJobId ? `/jobs/${weakest.t.targetJobId}#cases` : "/jobs",
    },
    ...(skills.length ? { skills } : {}),
  };
}

function landed(transcripts: TendencyTranscript[]): Tendency {
  const answers = storyAnswers(transcripts);
  const judged = answers.filter((a) => a.q.landed !== "unclear");
  if (judged.length === 0) return noData("landed", "Review a past interview to see which stories worked.", REVIEW_NEXT);
  const strong = judged.filter((a) => a.q.landed === "strong");
  return {
    id: "landed",
    label: "Stories that landed",
    status: strong.length >= 2 ? "strong" : strong.length === 1 ? "developing" : judged.length >= MIN_ANSWERS ? "weak" : "no_data",
    headline: strong.length
      ? `${plural(strong.length, "answer")} landed well in the room. Use ${strong.length === 1 ? "it" : "them"} again.`
      : `None of ${plural(judged.length, "story answer")} landed well yet.`,
    details: [],
    citations: strong.slice(0, 3).map((a) => ({
      label: `${a.t.title}: ${getTheme(a.q.theme!)?.label ?? "“" + clip(a.q.question) + "”"}`,
      href: href(a.t),
      quote: a.q.evidence || undefined,
    })),
    next: strong.length
      ? { label: "Practice them out loud", href: "/jobs" }
      : { label: "See past interviews", href: "/transcripts" },
  };
}

function clip(text: string, max = 90): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export function interviewTendencies(transcripts: TendencyTranscript[]): Tendency[] {
  return [sure(transcripts), result(transcripts), example(transcripts), tested(transcripts), landed(transcripts)];
}
