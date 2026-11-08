import type { PersonaRun } from "./report";

// The standard evaluation rubric every simulated-user run goes through (Craig approved it
// 2026-11-08): an exit survey each persona answers in character, a judge scorecard from a model
// of a third vendor (not the writer's or the grader's), and pass bars for the round. Pure, so
// it's tested without a model; scripts/sims/run.mts makes the calls.

// A third vendor: the story writer is DeepSeek and the grader OpenAI.
export const JUDGE_MODEL = "google/gemini-2.5-flash";

export const SURVEY = [
  { id: "q1", text: "Did you always know what to do next?", low: "Lost more than once", mid: "Hesitated once or twice", high: "Never wondered" },
  { id: "q2", text: "How much effort did the story take?", low: "Felt like a chore, nearly quit", mid: "Fair for the result", high: "Easier than expected" },
  { id: "q3", text: "Did the questions feel like they were about your work?", low: "Generic, could be anyone", mid: "Some fit my role", high: "Clearly about my job and level" },
  { id: "q4", text: "Does the draft sound like you and get the facts right?", low: "Wrong facts or not my voice", mid: "Mostly me, a few slips", high: "I'd say it this way" },
  { id: "q5", text: "Do you trust the grade and know how to raise it?", low: "Felt arbitrary", mid: "Fair, fixes vague", high: "Fair and I know what to fix" },
  { id: "q6", text: "Would you come back to build the next story?", low: "No", mid: "Maybe", high: "Yes, today" },
] as const;
export type SurveyId = (typeof SURVEY)[number]["id"];
// Personas who gave up or never got a draft answer only these, plus what made them stop.
const SHORT_SURVEY: SurveyId[] = ["q1", "q2", "q6"];

export type Survey = { answers: Partial<Record<SurveyId, { score: number; why: string }>>; stopped?: string };

export const JUDGE_DIMENSIONS = [
  { id: "completion", label: "Completion", anchors: ["No story started", "Draft, not graded", "Graded story", "Graded, and used a fix to improve it"] },
  { id: "friction", label: "Friction", anchors: ["Quit or stuck 5+ steps in a row", "Stuck 3-4 steps or a blocking error", "One hesitation, recovered alone", "No stuck steps, no errors"] },
  { id: "fidelity", label: "Fact fidelity", anchors: ["Draft states a number, tool or result the persona never gave", "One invented or changed detail", "Facts right, one detail blurred", "Every fact traces to an answer"] },
  { id: "quality", label: "Story quality at level", anchors: ['Vague, team-only "we", no result', "Clear actions, no result or scope below the target level", "Specific actions and result at the target level", "Plus the hardest part and a decision with its reasoning"] },
  { id: "voice", label: "Own voice", anchors: ["Under 25% own words or reads generic", "25-40% own words", "40-60% and sounds like the persona", "Over 60% and keeps their phrasing"] },
  { id: "grader", label: "Grader accuracy", anchors: ["Tier off by 2 or praises what isn't there", "Tier off by 1", "Tier right, fixes generic", "Tier right, fixes specific and doable"] },
  { id: "calibration", label: "Level calibration", anchors: ["Same bar for junior and principal", "Mentions level but doesn't change the score", "Score reflects target-level scope", "Fixes say what a story at this level needs"] },
] as const;
export type DimensionId = (typeof JUDGE_DIMENSIONS)[number]["id"];
export type Judge = Partial<Record<DimensionId, { score: number; evidence: string }>>;

const answeredFully = (run: PersonaRun) => !!run.metrics.story?.draftText && run.metrics.outcome !== "gave_up";

// The survey, asked as a follow-up turn in the persona's own conversation (after its system prompt).
export function surveyPrompt(run: PersonaRun): string {
  const s = run.metrics.story;
  const ids = answeredFully(run) ? SURVEY.map((q) => q.id) : SHORT_SURVEY;
  const questions = SURVEY.filter((q) => ids.includes(q.id))
    .map((q) => `${q.id}. ${q.text} (1 = ${q.low}; 3 = ${q.mid}; 5 = ${q.high})`)
    .join("\n");
  const recap = [
    `You've just finished your session in InterviewMax (${run.metrics.steps} steps, about ${run.metrics.minutes} minutes).`,
    run.metrics.gaveUp ? `You stopped: "${run.metrics.gaveUp}".` : "",
    s?.draftText ? `The app wrote this story from your answers:\n${s.draftText}` : "The app never wrote a story for you.",
    s?.graded ? `It graded it ${s.tier?.replace("_", " ")}${s.score !== undefined ? `, ${s.score}/100` : ""}. Fixes it suggested: ${s.fixes.join(" / ") || "none"}.` : "",
    `Your last thoughts in the app: ${run.steps.slice(-5).map((st) => st.thought).filter(Boolean).join(" / ") || "(none)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const stopped = answeredFully(run) ? "" : ', "stopped": "<what made you stop, in your own words>"';
  return `${recap}

Now answer a short survey about it, honestly and in character, as this person really felt. Score 1 to 5 using the anchors. Don't be polite: a 3 is fine and a 1 is fine if that's how it felt.
${questions}

Reply with ONLY a JSON object: {${ids.map((id) => `"${id}": {"score": <1-5>, "why": "<one sentence>"}`).join(", ")}${stopped}}`;
}

function firstJson(text: string): Record<string, unknown> | undefined {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function scored(value: unknown, max: number): { score: number; why: string } | undefined {
  const v = value as { score?: unknown; why?: unknown; evidence?: unknown } | undefined;
  const score = Number(v?.score);
  if (!Number.isInteger(score) || score < 1 || score > max) return undefined;
  return { score, why: String(v?.why ?? v?.evidence ?? "").slice(0, 400) };
}

export function parseSurvey(text: string): Survey | undefined {
  const json = firstJson(text);
  if (!json) return undefined;
  const answers: Survey["answers"] = {};
  for (const q of SURVEY) {
    const a = scored(json[q.id], 5);
    if (a) answers[q.id] = a;
  }
  if (!Object.keys(answers).length) return undefined;
  return { answers, stopped: typeof json.stopped === "string" ? json.stopped.slice(0, 400) : undefined };
}

export const JUDGE_SYSTEM = `You are the judge for simulated-user runs of InterviewMax, an interview prep app whose story builder asks a user about a work example, writes a behavioral interview story from their answers, then grades it. An AI persona with a known, made-up work history just used it. You see the persona's real history (the app never saw it), the steps they took, the story the app wrote and the app's grade.

Score each dimension 1 to 4 using its anchors exactly. There is no middle: lean one way. Every score needs evidence: a step number or a quoted line from the draft. For fact fidelity, compare every number, tool, name and result in the draft with the history and the persona's answers; an invented or inflated detail is a 1 or 2 even if the story reads well. For grader accuracy, decide the tier you'd give at the target job's level (strong, almost, not yet) and compare. For level calibration, judge whether the grade and fixes held the story to the bar of the target job's level.

Dimensions:
${JUDGE_DIMENSIONS.map((d) => `- ${d.id} (${d.label}): ${d.anchors.map((a, i) => `${i + 1} = ${a}`).join("; ")}`).join("\n")}

Reply with ONLY a JSON object: {${JUDGE_DIMENSIONS.map((d) => `"${d.id}": {"score": <1-4>, "evidence": "<one sentence>"}`).join(", ")}}`;

export function judgePrompt(run: PersonaRun, transcript: string): string {
  const { persona } = run;
  return `Persona: ${persona.name}, ${persona.level} level. Target job: ${persona.job.title} at ${persona.job.company} (job level "${persona.job.level}"). Question they set out to answer: "${persona.question}".

Their real work history (the only true facts):
${persona.history}

${transcript}`;
}

export function parseJudge(text: string): Judge | undefined {
  const json = firstJson(text);
  if (!json) return undefined;
  const out: Judge = {};
  for (const d of JUDGE_DIMENSIONS) {
    const s = scored(json[d.id], 4);
    if (s) out[d.id] = { score: s.score, evidence: s.why };
  }
  return Object.keys(out).length ? out : undefined;
}

const avg = (ns: number[]) => (ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : undefined);
const fmt = (n: number | undefined, digits = 1) => (n === undefined ? "–" : n.toFixed(digits));

export function surveyAverage(s: Survey | undefined): number | undefined {
  return avg(Object.values(s?.answers ?? {}).map((a) => a!.score));
}
export function judgeAverage(j: Judge | undefined): number | undefined {
  return avg(Object.values(j ?? {}).map((d) => d!.score));
}

export type Bar = { bar: string; pass: boolean | undefined; detail: string };

// The round's pass bars. undefined = couldn't be judged this round (e.g. one level ran).
export function passBars(runs: PersonaRun[]): Bar[] {
  const ran = runs.filter((r) => !r.crashed);
  const graded = ran.filter((r) => r.metrics.story?.graded);
  const need = Math.ceil((ran.length * 5) / 7);
  const blockers = ran.filter((r) => r.judge?.friction?.score === 1 || r.judge?.fidelity?.score === 1);
  const judged = ran.map((r) => judgeAverage(r.judge)).filter((n): n is number => n !== undefined);
  const quality = avg(judged);
  const appScore = (level: string) =>
    avg(graded.filter((r) => r.persona.level === level).map((r) => r.metrics.story!.score).filter((n): n is number => n !== undefined));
  const junior = appScore("Junior");
  const principal = appScore("Principal");
  const calibration = avg(ran.map((r) => r.judge?.calibration?.score).filter((n): n is number => n !== undefined));
  const surveys = ran.map((r) => surveyAverage(r.survey)).filter((n): n is number => n !== undefined);
  const feel = avg(surveys);
  const neverBack = ran.filter((r) => r.survey?.answers.q6?.score === 1);
  return [
    {
      bar: "Completion",
      pass: ran.length ? graded.length >= need : undefined,
      detail: `${graded.length} of ${ran.length} finished a graded story (need ${need})`,
    },
    {
      bar: "No blockers",
      pass: judged.length ? blockers.length === 0 : undefined,
      detail: blockers.length ? `Friction or fact fidelity of 1: ${blockers.map((r) => r.persona.name).join(", ")}` : "No 1 on friction or fact fidelity",
    },
    { bar: "Quality", pass: quality === undefined ? undefined : quality >= 3, detail: `Average judge score ${fmt(quality)} (need 3.0)` },
    {
      bar: "Calibration",
      pass: calibration === undefined ? undefined : calibration >= 3,
      detail: `Judge level calibration ${fmt(calibration)} (need 3.0); app score principal ${fmt(principal, 0)} vs junior ${fmt(junior, 0)}`,
    },
    {
      bar: "Feel",
      pass: feel === undefined ? undefined : feel >= 3.5 && neverBack.length === 0,
      detail: `Average survey ${fmt(feel)} (need 3.5)${neverBack.length ? `; wouldn't come back: ${neverBack.map((r) => r.persona.name).join(", ")}` : ""}`,
    },
  ];
}

const mark = (pass: boolean | undefined) => (pass === undefined ? "–" : pass ? "Pass" : "Fail");

export function scorecardSection(runs: PersonaRun[]): string[] {
  const ran = runs.filter((r) => !r.crashed);
  if (!ran.some((r) => r.judge || r.survey)) return [];
  const bars = passBars(runs);
  const head = `| Persona | Level | ${JUDGE_DIMENSIONS.map((d) => d.label).join(" | ")} | Judge avg | Survey avg |\n|---|---|${JUDGE_DIMENSIONS.map(() => "---|").join("")}---|---|`;
  const rows = ran.map((r) => {
    const dims = JUDGE_DIMENSIONS.map((d) => r.judge?.[d.id]?.score ?? "–").join(" | ");
    return `| ${r.persona.name} | ${r.persona.level} | ${dims} | ${fmt(judgeAverage(r.judge))} | ${fmt(surveyAverage(r.survey))} |`;
  });
  const verdict = bars.every((b) => b.pass !== false) ? "passes" : "fails";
  return [
    "## Scorecard",
    "",
    `This round ${verdict} the rubric's pass bars.`,
    "",
    "| Bar | Result | Detail |\n|---|---|---|",
    ...bars.map((b) => `| ${b.bar} | ${mark(b.pass)} | ${b.detail} |`),
    "",
    `Judge scores are 1 to 4 (${JUDGE_MODEL}); the survey is 1 to 5, answered by each persona in character.`,
    "",
    head,
    ...rows,
    "",
  ];
}

// The evidence behind each score and each persona's survey answers, for the appendix.
export function scorecardDetail(runs: PersonaRun[]): string[] {
  const out: string[] = [];
  for (const r of runs.filter((x) => x.judge || x.survey)) {
    out.push(`### ${r.persona.name}`, "");
    for (const d of JUDGE_DIMENSIONS) {
      const j = r.judge?.[d.id];
      if (j) out.push(`- **${d.label} ${j.score}/4:** ${j.evidence}`);
    }
    for (const q of SURVEY) {
      const a = r.survey?.answers[q.id];
      if (a) out.push(`- _${q.text}_ ${a.score}/5: ${a.why}`);
    }
    if (r.survey?.stopped) out.push(`- _What made you stop?_ ${r.survey.stopped}`);
    out.push("");
  }
  return out.length ? ["## Scorecard evidence", "", ...out] : [];
}

// One CSV row per persona per round, for /mnt/project-files/sim-users/scorecard.csv.
export const SCORECARD_CSV_HEADER = ["date", "commit", "persona", "level", "model", "outcome", "app_score", ...JUDGE_DIMENSIONS.map((d) => d.id), ...SURVEY.map((q) => q.id)].join(",");
export function scorecardCsv(runs: PersonaRun[], context: { date: string; commit?: string }): string[] {
  return runs
    .filter((r) => !r.crashed)
    .map((r) =>
      [
        context.date,
        (context.commit ?? "").slice(0, 7),
        r.persona.id,
        r.persona.level,
        r.model,
        r.metrics.outcome,
        r.metrics.story?.score ?? "",
        ...JUDGE_DIMENSIONS.map((d) => r.judge?.[d.id]?.score ?? ""),
        ...SURVEY.map((q) => r.survey?.answers[q.id]?.score ?? ""),
      ].join(","),
    );
}
