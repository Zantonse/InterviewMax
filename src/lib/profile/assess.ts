import { gradeJourney, type Assessment } from "@/lib/assessment/journey";
import { isLevel, levelLabel } from "@/lib/jobs/content";
import { checklistItems, filledCount, type NumbersChecklist } from "@/lib/numbers/checklist";
import type { PracticeItem } from "@/lib/practice/content";
import { timingNote, timingVerdict } from "@/lib/practice/content";
import type { LikelyQuestion } from "@/lib/questions/content";
import { coverageFor } from "@/lib/questions/coverage";
import { getTheme } from "@/lib/questions/themes";
import {
  isCovered,
  levelMix,
  needLabel,
  targetLevel,
  themeCoverage,
} from "@/lib/stories/bank";
import { gradeIsCurrent, hasDraft, type StoryContent } from "@/lib/stories/content";
import { STAR_CRITERIA } from "@/lib/stories/grading";
import { findNumbers } from "@/lib/stories/numbers";
import { getStoryType, type StoryTypeId } from "@/lib/stories/story-types";
import {
  gapLabel,
  summarizeTranscripts,
  type AnswerGapId,
  type TranscriptAnalysis,
} from "@/lib/transcripts/content";

// The interviewee profile (PRD v0.3, P0): the user as a candidate, from everything the app already
// knows. Every criterion, readiness label, strength and weakness is worked out here in code, and
// each claim carries the story, grade or transcript quote behind it. The one model call
// (summary.ts) only writes the overall summary from these results.

export const CRITERIA = [
  { id: "craft", label: "Story craft" },
  { id: "evidence", label: "Evidence" },
  { id: "level", label: "Level signal" },
  { id: "coverage", label: "Theme coverage" },
  { id: "fit", label: "Job fit" },
  { id: "patterns", label: "Real interview patterns" },
  { id: "delivery", label: "Delivery" },
  { id: "readiness", label: "Readiness" },
] as const;

export type CriterionId = (typeof CRITERIA)[number]["id"];

export type Status = "strong" | "developing" | "weak" | "no_data";

export const STATUS_LABELS: Record<Status, string> = {
  strong: "Strong",
  developing: "Developing",
  weak: "Needs work",
  no_data: "Not enough yet",
};

// What a claim rests on: a story, a grade, a transcript quote, a practice answer or a page.
export type Citation = {
  label: string;
  href?: string;
  // Quoted words: from a grade's note, a story, a transcript or the user's numbers.
  quote?: string;
};

// The button beside a weakness. A story type starts that story; otherwise it's a link.
export type NextStep = { label: string; href?: string; storyType?: StoryTypeId };

export type CriterionResult = {
  id: CriterionId;
  label: string;
  status: Status;
  // 0 to 100, for change over time. Null with no data.
  score: number | null;
  headline: string;
  details: string[];
  citations: Citation[];
  // With no data: how to get some.
  next?: NextStep;
};

export type Point = {
  criterion: CriterionId;
  text: string;
  citation: Citation;
  next?: NextStep;
  // How much it matters, to pick the top few.
  weight: number;
};

export type ReadinessLabel = "not_ready" | "getting_there" | "ready";

export const READINESS_LABELS: Record<ReadinessLabel, string> = {
  not_ready: "Not ready",
  getting_there: "Getting there",
  ready: "Ready",
};

export type JobReadiness = {
  jobId: string;
  title: string;
  company: string | null;
  label: ReadinessLabel;
  reasons: string[];
};

export type ProfileResult = {
  criteria: CriterionResult[];
  jobs: JobReadiness[];
  strengths: Point[];
  weaknesses: Point[];
  // Nothing to assess yet: no written story, no transcript, no practice.
  empty: boolean;
};

// ---- Inputs ----

type StoryLike = {
  id: string;
  title: string;
  storyType: string | null;
  content: StoryContent;
};

type JobLike = {
  id: string;
  title: string;
  company: string | null;
  level: string | null;
  likelyQuestions: { questions: LikelyQuestion[] } | null;
};

type TranscriptLike = {
  id: string;
  title: string;
  targetJobId: string | null;
  analysis: TranscriptAnalysis | null;
};

type PracticeLike = { id: string; targetJobId: string; items: PracticeItem[] };

export type ProfileInput = {
  stories: StoryLike[];
  jobs: JobLike[];
  numbers: NumbersChecklist | null;
  transcripts: TranscriptLike[];
  practice: PracticeLike[];
  assessment: Assessment | null | undefined;
};

// ---- Helpers ----

const storyHref = (s: { id: string }) => `/stories/${s.id}`;

function behavioral(stories: StoryLike[]): StoryLike[] {
  return stories.filter((s) => getStoryType(s.storyType)?.format === "star" && hasDraft(s.content));
}

function graded(stories: StoryLike[]): StoryLike[] {
  return behavioral(stories).filter((s) => gradeIsCurrent(s.content) && s.content.grade);
}

function avg(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function statusFor(score: number, strong: number, developing: number): Status {
  return score >= strong ? "strong" : score >= developing ? "developing" : "weak";
}

function one(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n} ${n === 1 ? word : many}`;
}

function firstSentence(text: string, max = 200): string {
  const s = text.trim().split(/(?<=[.!?])\s+/)[0] ?? "";
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

// The traced figure a behavioral story's result lands on, if any.
export function resultFigure(story: StoryLike): string | undefined {
  const draft = story.content.draft;
  if (!draft || draft.untracedNumbers.length > 0) return undefined;
  return findNumbers(draft.parts.result ?? "", { includeCommonWords: false }).find(
    (n) => !/^(19|20)\d\d$/.test(n.raw),
  )?.raw;
}

// ---- Criteria ----

function craft(stories: StoryLike[], points: Points): CriterionResult {
  const base = { id: "craft" as const, label: "Story craft" };
  const list = graded(stories);
  if (list.length === 0) {
    return {
      ...base,
      status: "no_data",
      score: null,
      headline: "No graded stories yet.",
      details: [],
      citations: [],
      next: { label: "Build a story", href: "/stories/new" },
    };
  }
  const per = STAR_CRITERIA.map((c) => {
    const scores = list.flatMap((s) => {
      const sc = s.content.grade!.criteria.find((x) => x.id === c.id);
      return sc ? [{ story: s, score: sc.score, note: sc.note, improve: sc.improve }] : [];
    });
    return { criterion: c, scores, average: avg(scores.map((x) => x.score)) };
  }).filter((p) => p.scores.length > 0);
  if (per.length === 0) {
    return { ...base, status: "no_data", score: null, headline: "No graded stories yet.", details: [], citations: [] };
  }
  const overall = avg(per.map((p) => p.average));
  const sorted = [...per].sort((a, b) => b.average - a.average);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const lowest = [...worst.scores].sort((a, b) => a.score - b.score)[0];
  const highest = [...best.scores].sort((a, b) => b.score - a.score)[0];

  if (best.average >= 3) {
    points.strength({
      criterion: "craft",
      text: `Your stories are strongest on ${best.criterion.label.toLowerCase()} (${one(best.average)} of 4 across ${plural(best.scores.length, "story", "stories")}).`,
      citation: {
        label: `“${highest.story.title}”: ${best.criterion.label} ${highest.score} of 4`,
        href: storyHref(highest.story),
        quote: firstSentence(highest.note),
      },
      weight: best.average,
    });
  }
  if (worst.average < 3 && worst !== best) {
    points.weakness({
      criterion: "craft",
      text: `${worst.criterion.label} is the weakest part of your stories (${one(worst.average)} of 4).`,
      citation: {
        label: `“${lowest.story.title}”: ${worst.criterion.label} ${lowest.score} of 4`,
        href: storyHref(lowest.story),
        quote: firstSentence(lowest.improve || lowest.note),
      },
      next: { label: `Strengthen “${lowest.story.title}”`, href: storyHref(lowest.story) },
      weight: 4 - worst.average,
    });
  }
  return {
    ...base,
    status: statusFor(overall, 3.25, 2.5),
    score: Math.round(((overall - 1) / 3) * 100),
    headline:
      best === worst
        ? `${best.criterion.label} averages ${one(best.average)} of 4.`
        : `Strongest on ${best.criterion.label.toLowerCase()} (${one(best.average)} of 4), weakest on ${worst.criterion.label.toLowerCase()} (${one(worst.average)} of 4).`,
    details: per.map((p) => `${p.criterion.label}: ${one(p.average)} of 4`),
    citations: [
      {
        label: `“${lowest.story.title}”: ${worst.criterion.label} ${lowest.score} of 4`,
        href: storyHref(lowest.story),
        quote: firstSentence(lowest.note),
      },
    ],
  };
}

function evidence(
  stories: StoryLike[],
  numbers: NumbersChecklist | null,
  points: Points,
): CriterionResult {
  const base = { id: "evidence" as const, label: "Evidence" };
  const list = behavioral(stories);
  const total = numbers ? checklistItems(numbers).length : 0;
  const filled = numbers ? filledCount(numbers) : 0;
  if (list.length === 0 && total === 0) {
    return {
      ...base,
      status: "no_data",
      score: null,
      headline: "No written stories or numbers yet.",
      details: [],
      citations: [],
      next: { label: "Fill in your numbers", href: "/numbers" },
    };
  }
  const withFigure = list.map((s) => ({ story: s, figure: resultFigure(s) }));
  const landed = withFigure.filter((x) => x.figure);
  const missing = withFigure.filter((x) => !x.figure);
  const share = list.length ? landed.length / list.length : 0;
  const checklistShare = total ? filled / total : 0;
  const score = Math.round(
    list.length && total ? share * 70 + checklistShare * 30 : list.length ? share * 100 : checklistShare * 100,
  );
  const details = [
    ...(list.length ? [`${landed.length} of ${plural(list.length, "written story", "written stories")} end on a traced number`] : []),
    total ? `${filled} of ${total} numbers filled in on Your numbers` : "Your numbers isn't set up yet",
  ];
  if (landed.length > 0 && share >= 0.75) {
    points.strength({
      criterion: "evidence",
      text: `${landed.length} of ${plural(list.length, "story", "stories")} land on a real, traced number.`,
      citation: {
        label: `“${landed[0].story.title}”`,
        href: storyHref(landed[0].story),
        quote: landed[0].figure,
      },
      weight: 3 + share,
    });
  }
  if (missing.length > 0) {
    const s = missing[0].story;
    points.weakness({
      criterion: "evidence",
      text: `${plural(missing.length, "story", "stories")} ${missing.length === 1 ? "has" : "have"} no traced number in the result.`,
      citation: { label: `“${s.title}”: no number in the result`, href: storyHref(s) },
      next: { label: "Add a number", href: storyHref(s) },
      weight: 1 + (1 - share) * 2.5,
    });
  } else if (total > 0 && checklistShare < 0.5) {
    points.weakness({
      criterion: "evidence",
      text: `Only ${filled} of ${total} of your role's key numbers are filled in.`,
      citation: { label: "Your numbers", href: "/numbers" },
      next: { label: "Fill in your numbers", href: "/numbers" },
      weight: 1 + (1 - checklistShare),
    });
  }
  return {
    ...base,
    status: statusFor(score, 75, 45),
    score,
    headline: list.length
      ? `${landed.length} of ${plural(list.length, "story", "stories")} end on a traced number.`
      : `${filled} of ${total} numbers filled in.`,
    details,
    citations: missing
      .slice(0, 3)
      .map((x) => ({ label: `“${x.story.title}”: no number in the result`, href: storyHref(x.story) })),
  };
}

function level(stories: StoryLike[], jobs: JobLike[], points: Points): CriterionResult {
  const base = { id: "level" as const, label: "Level signal" };
  const target = targetLevel(jobs);
  if (!target) {
    return {
      ...base,
      status: "no_data",
      score: null,
      headline: jobs.length ? "Your target jobs have no level set." : "Add a target job to check level.",
      details: [],
      citations: [],
      next: { label: jobs.length ? "Set a job's level" : "Add a target job", href: jobs.length ? "/jobs" : "/jobs/new" },
    };
  }
  const mix = levelMix(stories, target);
  const gradedCount = Object.values(mix.counts).reduce((a, b) => a + b, 0);
  if (gradedCount === 0) {
    return {
      ...base,
      status: "no_data",
      score: null,
      headline: "Grade a written story to see the level it signals.",
      details: [],
      citations: [],
      next: { label: "Build a story", href: "/stories/new" },
    };
  }
  const score = Math.round(avg(mix.needs.map((n) => Math.min(1, n.have / n.needed))) * 100);
  const met = mix.needs.every((n) => n.have >= n.needed);
  const top = graded(stories)
    .map((s) => ({ story: s, role: s.content.grade!.bankRole }))
    .filter((x) => x.role)
    .sort((a, b) => roleRank(b.role!.role) - roleRank(a.role!.role));
  const levelName = levelLabel(target) ?? target;
  const short = mix.needs.find((n) => n.have < n.needed);
  if (met && top[0]) {
    points.strength({
      criterion: "level",
      text: `Your stories show the scope a ${levelName.toLowerCase()} role needs.`,
      citation: {
        label: `“${top[0].story.title}”: ${top[0].role!.role}`,
        href: storyHref(top[0].story),
        quote: firstSentence(top[0].role!.note),
      },
      weight: 3.5,
    });
  }
  if (short) {
    points.weakness({
      criterion: "level",
      text: `For ${levelName.toLowerCase()} roles you have ${needLabel(short)}.`,
      citation: top[0]
        ? {
            label: `Your biggest-scope story: “${top[0].story.title}” (${top[0].role!.role})`,
            href: storyHref(top[0].story),
            quote: firstSentence(top[0].role!.note),
          }
        : { label: "Story grades" },
      next: { label: "Build a bigger-scope story", storyType: "major_project" },
      weight: 1.5 + (1 - score / 100) * 2,
    });
  }
  return {
    ...base,
    status: met ? "strong" : score >= 50 ? "developing" : "weak",
    score,
    headline: met
      ? `Enough team- and org-level stories for ${levelName.toLowerCase()} roles.`
      : `Short of what ${levelName.toLowerCase()} roles need.`,
    details: [
      ...mix.needs.map((n) => cap(needLabel(n))),
      ...(mix.ungraded ? [`${plural(mix.ungraded, "written story", "written stories")} not graded yet`] : []),
    ],
    citations: top.slice(0, 3).map((x) => ({
      label: `“${x.story.title}”: ${x.role!.role}`,
      href: storyHref(x.story),
    })),
  };
}

const ROLE_ORDER = ["hands-on proof", "team-level impact", "organization-level impact"];
function roleRank(role: string): number {
  return ROLE_ORDER.indexOf(role);
}

function cap(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function coverage(stories: StoryLike[], jobs: JobLike[], points: Points): CriterionResult {
  const base = { id: "coverage" as const, label: "Theme coverage" };
  const themes = themeCoverage(stories);
  const covered = themes.filter((t) => isCovered(t.status));
  const strongThemes = themes.filter((t) => t.status === "strong" || t.status === "good_enough");
  const thin = themes.filter((t) => t.status === "not_yet" || t.status === "in_progress");
  const missing = themes.filter((t) => t.status === "empty");
  const score = Math.round(((covered.length * 0.6 + strongThemes.length * 0.4) / themes.length) * 100);

  // One story answering many themes: fine on paper, thin in a loop that asks two of them.
  const byStory = new Map<string, { title: string; themes: string[] }>();
  for (const t of covered) {
    if (!t.story) continue;
    const entry = byStory.get(t.story.id) ?? { title: t.story.title, themes: [] };
    entry.themes.push(t.label);
    byStory.set(t.story.id, entry);
  }
  const heavy = [...byStory.entries()].sort((a, b) => b[1].themes.length - a[1].themes.length)[0];

  // The missing theme that matters most: the one the most likely questions ask about.
  const asked = (themeId: string) =>
    jobs.flatMap((j) => (j.likelyQuestions?.questions ?? []).filter((q) => q.theme === themeId).map((q) => ({ job: j, q })));
  const gaps = missing
    .map((t) => ({ theme: t, asked: asked(t.id) }))
    .sort((a, b) => b.asked.length - a.asked.length);

  if (gaps[0]) {
    const g = gaps[0];
    const storyType = g.theme.build;
    points.weakness({
      criterion: "coverage",
      text: `No story yet for ${g.theme.label.toLowerCase()}${g.asked.length ? `, which ${plural(g.asked.length, "likely question")} ${g.asked.length === 1 ? "asks" : "ask"} about` : ""}.`,
      citation: g.asked[0]
        ? { label: `Likely for ${g.asked[0].job.title}`, href: `/jobs/${g.asked[0].job.id}`, quote: g.asked[0].q.question }
        : { label: `${g.theme.label}: no story yet` },
      next: storyType
        ? { label: `Build “${getStoryType(storyType)?.label ?? "the story"}”`, storyType }
        : { label: "Build a story", href: "/stories/new" },
      weight: 2 + gaps[0].asked.length * 0.5 + (missing.length / themes.length) * 2,
    });
  } else if (heavy && heavy[1].themes.length >= 3) {
    points.weakness({
      criterion: "coverage",
      text: `One story, “${heavy[1].title}”, is your answer for ${heavy[1].themes.length} themes; a second story gives you options.`,
      citation: { label: `“${heavy[1].title}”: ${heavy[1].themes.join(", ")}`, href: `/stories/${heavy[0]}` },
      next: { label: "Find another story", href: "/stories/find" },
      weight: 1.2,
    });
  }
  if (covered.length >= 6) {
    points.strength({
      criterion: "coverage",
      text: `Your stories cover ${covered.length} of the ${themes.length} question themes.`,
      citation: { label: "Coverage grid on Your prep", href: "/" },
      weight: 2 + covered.length / themes.length,
    });
  }
  return {
    ...base,
    status: stories.length === 0 ? "weak" : statusFor(covered.length, 8, 5),
    score,
    headline: `${covered.length} of ${themes.length} themes covered, ${strongThemes.length} with a strong or good-enough story.`,
    details: [
      ...(missing.length ? [`Missing: ${missing.map((t) => t.label).join(", ")}`] : []),
      ...(thin.length ? [`Thin: ${thin.map((t) => t.label).join(", ")}`] : []),
      ...(heavy && heavy[1].themes.length >= 3
        ? [`“${heavy[1].title}” answers ${heavy[1].themes.length} themes on its own`]
        : []),
    ],
    citations: [],
  };
}

function fit(stories: StoryLike[], jobs: JobLike[], points: Points): CriterionResult {
  const base = { id: "fit" as const, label: "Job fit" };
  if (jobs.length === 0) {
    return {
      ...base,
      status: "no_data",
      score: null,
      headline: "Add a target job to see how your stories fit it.",
      details: [],
      citations: [],
      next: { label: "Add a target job", href: "/jobs/new" },
    };
  }
  const checked = graded(stories).filter((s) => s.content.grade!.content);
  if (checked.length === 0) {
    return {
      ...base,
      status: "no_data",
      score: null,
      headline: "Grade a written story to see how it fits your jobs.",
      details: [],
      citations: [],
      next: { label: "Build a story", href: "/stories/new" },
    };
  }
  const perJob = jobs.map((job) => {
    const fits = checked.flatMap((s) => {
      const f = s.content.grade!.content!.jobs.find((j) => j.jobId === job.id);
      return f ? [{ story: s, fit: f }] : [];
    });
    const strong = fits.filter((f) => f.fit.fit === "strong");
    const partial = fits.filter((f) => f.fit.fit === "partial");
    const score = Math.min(1, (strong.length + partial.length * 0.5) / 3);
    return { job, fits, strong, partial, score };
  });
  const withFits = perJob.filter((p) => p.fits.length > 0);
  if (withFits.length === 0) {
    return {
      ...base,
      status: "no_data",
      score: null,
      headline: "Regrade a story to check it against your current jobs.",
      details: [],
      citations: [],
    };
  }
  const sorted = [...withFits].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const score = Math.round(avg(withFits.map((p) => p.score)) * 100);
  if (best.strong[0]) {
    const f = best.strong[0];
    points.strength({
      criterion: "fit",
      text: `“${f.story.title}” is a strong fit for ${best.job.title}${best.job.company ? ` at ${best.job.company}` : ""}.`,
      citation: { label: `Content check of “${f.story.title}”`, href: storyHref(f.story), quote: f.fit.proves[0] },
      weight: 3 + best.score,
    });
  }
  const missFor = worst.fits.find((f) => f.fit.misses.length > 0);
  if (missFor && worst.score < 0.67) {
    points.weakness({
      criterion: "fit",
      text: `${worst.job.title}${worst.job.company ? ` at ${worst.job.company}` : ""} is your weakest fit: no story yet proves what it needs most.`,
      citation: {
        label: `Content check of “${missFor.story.title}”`,
        href: storyHref(missFor.story),
        quote: missFor.fit.misses[0],
      },
      next: { label: "See this job's questions", href: `/jobs/${worst.job.id}` },
      weight: 1.5 + (1 - worst.score) * 2,
    });
  }
  return {
    ...base,
    status: statusFor(score, 70, 35),
    score,
    headline:
      best === worst
        ? `${best.job.title}: ${plural(best.strong.length, "strong-fit story", "strong-fit stories")}.`
        : `Best fit: ${best.job.title}. Weakest: ${worst.job.title}.`,
    details: perJob.map(
      (p) =>
        `${p.job.title}${p.job.company ? ` at ${p.job.company}` : ""}: ${p.strong.length} strong, ${p.partial.length} partial fit`,
    ),
    citations: best.strong.slice(0, 2).map((f) => ({
      label: `“${f.story.title}” for ${best.job.title}`,
      href: storyHref(f.story),
      quote: f.fit.proves[0],
    })),
  };
}

function patterns(transcripts: TranscriptLike[], stories: StoryLike[], points: Points): CriterionResult {
  const base = { id: "patterns" as const, label: "Real interview patterns" };
  const analyzed = transcripts.filter((t) => t.analysis);
  if (analyzed.length === 0) {
    return {
      ...base,
      status: "no_data",
      score: null,
      headline: "Add a past interview to see what interviewers probe.",
      details: [],
      citations: [],
      next: { label: "Add a past interview", href: "/transcripts" },
    };
  }
  const insights = summarizeTranscripts(analyzed);
  const answers = analyzed.flatMap((t) => t.analysis!.asked.map((q) => ({ t, q })));
  const judged = answers.filter((a) => a.q.landed !== "unclear");
  const strong = judged.filter((a) => a.q.landed === "strong");
  const score = judged.length ? Math.round((strong.length / judged.length) * 100) : null;

  const gapQuote = (gap: AnswerGapId) =>
    answers.find((a) => a.q.gaps.includes(gap) && (a.q.evidence || a.q.probes[0]));
  const topGap = insights.recurringGaps[0];
  if (topGap) {
    const example = gapQuote(topGap.gap);
    const theme = example?.q.theme ? getTheme(example.q.theme) : undefined;
    const cover = theme ? coverageFor(theme.id, stories) : undefined;
    points.weakness({
      criterion: "patterns",
      text: `In real interviews, ${plural(topGap.count, "answer")} missed ${gapLabel(topGap.gap).toLowerCase()}.`,
      citation: example
        ? {
            label: example.t.title,
            href: `/transcripts/${example.t.id}`,
            quote: example.q.evidence || example.q.probes[0],
          }
        : { label: "Past interviews", href: "/transcripts" },
      next:
        topGap.gap === "numbers"
          ? { label: "Fill in your numbers", href: "/numbers" }
          : cover?.kind === "story"
            ? { label: `Work on “${cover.title}”`, href: `/stories/${cover.storyId}` }
            : cover?.kind === "build"
              ? { label: `Build “${getStoryType(cover.storyType)?.label ?? "the story"}”`, storyType: cover.storyType }
              : { label: "See past interviews", href: "/transcripts" },
      weight: 2 + topGap.count * 0.5,
    });
  }
  if (strong[0]) {
    points.strength({
      criterion: "patterns",
      text: `Your answer to “${firstSentence(strong[0].q.question, 120)}” landed well in a real interview.`,
      citation: {
        label: strong[0].t.title,
        href: `/transcripts/${strong[0].t.id}`,
        quote: strong[0].q.evidence || undefined,
      },
      weight: 2.5 + strong.length / Math.max(1, judged.length),
    });
  }
  const probed = insights.themes.filter((t) => t.probes.length > 0).slice(0, 3);
  return {
    ...base,
    status: score === null ? "no_data" : statusFor(score, 65, 40),
    score,
    headline: judged.length
      ? `${strong.length} of ${plural(judged.length, "answer")} landed well across ${plural(analyzed.length, "interview")}.`
      : `${plural(analyzed.length, "interview")} reviewed.`,
    details: [
      ...insights.recurringGaps.slice(0, 3).map((g) => `Missed ${gapLabel(g.gap).toLowerCase()} ${plural(g.count, "time")}`),
      ...probed.map((t) => `Probed on ${getTheme(t.theme)?.label.toLowerCase() ?? t.theme}`),
    ],
    citations: probed.flatMap((t) => {
      const a = answers.find((x) => x.q.theme === t.theme && x.q.probes.length > 0);
      return a ? [{ label: `Follow-up in ${a.t.title}`, href: `/transcripts/${a.t.id}`, quote: a.q.probes[0] }] : [];
    }),
  };
}

function delivery(practice: PracticeLike[], transcripts: TranscriptLike[], points: Points): CriterionResult {
  const base = { id: "delivery" as const, label: "Delivery" };
  const items = practice.flatMap((p) => p.items.filter((i) => i.feedback).map((i) => ({ session: p, item: i })));
  const answers = transcripts.flatMap((t) => (t.analysis?.asked ?? []).map((q) => ({ t, q })));
  if (items.length === 0 && answers.length === 0) {
    return {
      ...base,
      status: "no_data",
      score: null,
      headline: "Practice out loud to see how you come across.",
      details: [],
      citations: [],
      next: { label: "Practice a target job", href: "/jobs" },
    };
  }
  const parts: { share: number; weight: number }[] = [];
  const onTime = items.filter((x) => timingVerdict(x.item.feedback!.timing) === "ok");
  const long = items.filter((x) => timingVerdict(x.item.feedback!.timing) === "long");
  const stayed = items.filter((x) => ["close", "partly"].includes(x.item.feedback!.closeness));
  const compared = items.filter((x) => x.item.feedback!.closeness !== "no_story");
  if (items.length) parts.push({ share: onTime.length / items.length, weight: 50 });
  if (compared.length) parts.push({ share: stayed.length / compared.length, weight: 30 });
  const offPoint = answers.filter((a) => a.q.gaps.includes("concise") || a.q.gaps.includes("relevance"));
  if (answers.length) parts.push({ share: 1 - offPoint.length / answers.length, weight: 20 });
  const totalWeight = parts.reduce((a, p) => a + p.weight, 0);
  const score = Math.round((parts.reduce((a, p) => a + p.share * p.weight, 0) / totalWeight) * 100);

  if (long.length > 0 && long.length >= items.length / 3) {
    const x = long[0];
    points.weakness({
      criterion: "delivery",
      text: `${long.length} of ${plural(items.length, "practice answer")} ran long.`,
      citation: { label: `Practice: “${firstSentence(x.item.question, 100)}”`, href: `/jobs/${x.session.targetJobId}/practice`, quote: timingNote(x.item.feedback!.timing) },
      next: { label: "Practice that question", href: `/jobs/${x.session.targetJobId}/practice` },
      weight: 1.5 + long.length / items.length,
    });
  } else if (offPoint.length >= 2) {
    const a = offPoint[0];
    points.weakness({
      criterion: "delivery",
      text: `In real interviews, ${plural(offPoint.length, "answer")} wandered from the question or took too long to land.`,
      citation: { label: a.t.title, href: `/transcripts/${a.t.id}`, quote: a.q.evidence || undefined },
      next: { label: "Practice a target job", href: "/jobs" },
      weight: 1.5 + offPoint.length / answers.length,
    });
  }
  if (items.length >= 3 && onTime.length / items.length >= 0.7) {
    const x = onTime[0];
    points.strength({
      criterion: "delivery",
      text: `${onTime.length} of ${plural(items.length, "practice answer")} came in at the right length.`,
      citation: { label: `Practice: “${firstSentence(x.item.question, 100)}”`, href: `/jobs/${x.session.targetJobId}/practice`, quote: timingNote(x.item.feedback!.timing) },
      weight: 2 + onTime.length / items.length,
    });
  }
  return {
    ...base,
    status: statusFor(score, 70, 45),
    score,
    headline: items.length
      ? `${onTime.length} of ${plural(items.length, "practice answer")} at the right length.`
      : `${answers.length - offPoint.length} of ${plural(answers.length, "real answer")} on point.`,
    details: [
      ...(items.length ? [`${long.length} ran long, ${items.length - onTime.length - long.length} ran short`] : []),
      ...(compared.length ? [`${stayed.length} of ${compared.length} stayed close to the saved story`] : []),
      ...(answers.length ? [`${offPoint.length} of ${answers.length} real answers off the point or slow to land`] : []),
    ],
    citations: items
      .filter((x) => x.item.feedback!.followUpsNote)
      .slice(0, 2)
      .map((x) => ({
        label: `Follow-ups on “${firstSentence(x.item.question, 100)}”`,
        href: `/jobs/${x.session.targetJobId}/practice`,
        quote: firstSentence(x.item.feedback!.followUpsNote),
      })),
  };
}

function readiness(assessment: Assessment | null | undefined, jobs: JobLike[]): CriterionResult {
  const base = { id: "readiness" as const, label: "Readiness" };
  if (!assessment || !("answers" in assessment)) {
    return {
      ...base,
      status: "no_data",
      score: null,
      headline: "Take the 1-minute journey check.",
      details: [],
      citations: [],
      next: { label: "Take the journey check", href: "/assessment" },
    };
  }
  const grade = gradeJourney(assessment.answers, { hasJob: jobs.length > 0 });
  return {
    ...base,
    status: statusFor(grade.score, 65, 35),
    score: grade.score,
    headline: `Journey grade ${grade.score} of 100: ${grade.level}.`,
    details: grade.gaps.map((g) => g.title),
    citations: [{ label: "Your journey check", href: "/assessment" }],
  };
}

// ---- Readiness per job ----

export function jobReadiness(job: JobLike, stories: StoryLike[]): JobReadiness {
  const base = { jobId: job.id, title: job.title, company: job.company };
  const questions = job.likelyQuestions?.questions ?? [];
  if (questions.length === 0) {
    return { ...base, label: "not_ready", reasons: ["Its likely questions aren't predicted yet"] };
  }
  let written = 0;
  let solid = 0;
  for (const q of questions) {
    const c = coverageFor(q.theme, stories);
    if (c?.kind !== "story" || !c.drafted) continue;
    written += 1;
    const story = stories.find((s) => s.id === c.storyId);
    const tier = story && gradeIsCurrent(story.content) ? story.content.grade?.tier : undefined;
    if (tier === "strong" || tier === "good_enough") solid += 1;
  }
  const lvl = isLevel(job.level) ? levelMix(stories, job.level) : undefined;
  const levelShort = lvl?.needs.filter((n) => n.have < n.needed) ?? [];
  const writtenShare = written / questions.length;
  const label: ReadinessLabel =
    writtenShare >= 0.8 && solid / questions.length >= 0.6 && levelShort.length === 0
      ? "ready"
      : writtenShare >= 0.4
        ? "getting_there"
        : "not_ready";
  return {
    ...base,
    label,
    reasons: [
      `${written} of ${plural(questions.length, "likely question")} ${written === 1 ? "has" : "have"} a written story`,
      `${solid} graded good enough or strong`,
      ...levelShort.map((n) => `${cap(needLabel(n))} for ${levelLabel(job.level)?.toLowerCase()} roles`),
    ],
  };
}

// ---- Putting it together ----

class Points {
  strengths: Point[] = [];
  weaknesses: Point[] = [];
  strength(p: Point) {
    this.strengths.push(p);
  }
  weakness(p: Point) {
    this.weaknesses.push(p);
  }
}

const MAX_POINTS = 3;

function top(list: Point[]): Point[] {
  return [...list].sort((a, b) => b.weight - a.weight).slice(0, MAX_POINTS);
}

export function assessProfile(input: ProfileInput): ProfileResult {
  const { stories, jobs, numbers, transcripts, practice, assessment } = input;
  const points = new Points();
  const criteria = [
    craft(stories, points),
    evidence(stories, numbers, points),
    level(stories, jobs, points),
    coverage(stories, jobs, points),
    fit(stories, jobs, points),
    patterns(transcripts, stories, points),
    delivery(practice, transcripts, points),
    readiness(assessment, jobs),
  ];
  const empty =
    behavioral(stories).length === 0 &&
    !stories.some((s) => hasDraft(s.content)) &&
    !transcripts.some((t) => t.analysis) &&
    !practice.some((p) => p.items.some((i) => i.feedback));
  return {
    criteria,
    jobs: jobs.map((j) => jobReadiness(j, stories)),
    strengths: top(points.strengths),
    weaknesses: top(points.weaknesses),
    empty,
  };
}
