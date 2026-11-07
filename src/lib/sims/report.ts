import type { Persona } from "./personas";
import type { RunMetrics, StepRecord } from "./score";

// The simulated-user report: a table of each persona's numbers (code), then insights a cheap
// analyst model writes after reading every transcript. Pure, so it's tested without a model.

export type PersonaRun = {
  persona: Persona;
  model: string;
  metrics: RunMetrics;
  steps: StepRecord[];
  crashed?: string;
};

const OUTCOME_LABELS: Record<RunMetrics["outcome"], string> = {
  graded: "Finished and graded",
  drafted: "Drafted, not graded",
  started: "Started, no draft",
  nothing: "Never started a story",
  gave_up: "Gave up",
  error: "Run failed",
};

const pct = (n: number | undefined) => (n === undefined ? "–" : `${Math.round(n * 100)}%`);
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function metricsTable(runs: PersonaRun[]): string {
  const head =
    "| Persona | Played by | Outcome | Steps | Minutes | Stuck (longest) | Errors | Follow-ups answered / skipped | In own words | Grade |\n" +
    "|---|---|---|---|---|---|---|---|---|---|";
  const rows = runs.map(({ persona, model, metrics: m }) => {
    const s = m.story;
    const grade = s?.graded ? `${s.tier?.replace("_", " ")}${s.score !== undefined ? `, ${s.score}/100` : ""}` : "–";
    return `| ${cell(persona.name)} (${persona.id}) | ${cell(model)} | ${OUTCOME_LABELS[m.outcome]} | ${m.steps} | ${m.minutes} | ${m.noChangeSteps} (${m.longestStuck}) | ${m.errors} | ${s ? `${s.followUpsAnswered} / ${s.followUpsSkipped}` : "–"} | ${pct(s?.ownWords)} | ${grade} |`;
  });
  return [head, ...rows].join("\n");
}

// A run as the analyst reads it: every step with the persona's thought and what the app said
// back, then the story it ended with. Clipped so a long run can't crowd out the others.
export function transcriptForAnalyst(run: PersonaRun, maxChars = 30000): string {
  const { persona, model, metrics: m } = run;
  const lines = [
    `## ${persona.name} (${persona.id}), played by ${model}`,
    `Who: ${persona.headline}. Voice: ${persona.voice}`,
    `Target job: ${persona.job.title} at ${persona.job.company}.`,
    `Outcome: ${OUTCOME_LABELS[m.outcome]}${m.gaveUp ? ` ("${m.gaveUp}")` : ""}${run.crashed ? ` (runner error: ${run.crashed})` : ""}. ${m.steps} steps, ${m.minutes} min, ${m.slowSteps} slow steps (30s+), ${m.noChangeSteps} steps where nothing changed, ${m.errors} errors.`,
    `Job added: ${m.jobAdded ? "yes" : "no"}; likely questions shown: ${m.likelyQuestions ? "yes" : "no"}.`,
    `Usage events: ${JSON.stringify(m.events)}. Click signals: ${JSON.stringify(m.signals)}.`,
    "",
    "### Steps",
  ];
  for (const s of run.steps) {
    lines.push(
      `${s.step}. [${s.path}] ${s.summary}${s.feeling ? ` (feeling: ${s.feeling})` : ""}${s.noChange ? " — nothing changed" : ""}${s.seconds >= 30 ? ` — took ${Math.round(s.seconds)}s` : ""}${s.errors.length ? ` — errors: ${s.errors.join("; ")}` : ""}`,
    );
    if (s.thought) lines.push(`   Thinks: ${s.thought}`);
    if (s.appText) lines.push(`   App showed: ${s.appText.replace(/\n/g, " / ")}`);
  }
  const story = m.story;
  if (story) {
    lines.push(
      "",
      "### Story they ended with",
      `Type: ${story.storyType}; question: ${story.asked ?? "(none)"}; answers: ${story.answers}; follow-ups asked ${story.followUpsAsked}, answered ${story.followUpsAnswered}, skipped ${story.followUpsSkipped}.`,
      `Draft in their own words: ${pct(story.ownWords)}.`,
      story.graded
        ? `Grade: ${story.tier}${story.score !== undefined ? `, ${story.score}/100` : ""}. Summary: ${story.summary ?? ""}. Fixes: ${story.fixes.join(" / ")}`
        : "Not graded.",
      story.draftText ? `Draft:\n${story.draftText}` : "No draft.",
    );
  }
  const text = lines.join("\n");
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…(clipped)` : text;
}

export const ANALYST_SYSTEM = `You analyse simulated-user runs of InterviewMax, an interview prep web app whose main product is a story builder: it asks a user questions about a work example, writes a behavioral interview story (STAR) from their answers, then grades it. AI personas with made-up work histories just used the app. Each was played by a different AI model with a set personality.

Your reader is the app's founder. Write plain, specific English for a busy person. Every claim must point to evidence from the transcripts (persona and step number). Remember the limits: AI personas don't feel dread or fatigue like real people, and AI judging AI is biased, so flag findings that need a real tester to confirm.

Write Markdown with exactly these sections:
## What happened
One short paragraph per persona: how far they got, the path they took, and the moment that decided the outcome.
## How well they used the platform
Which steps and features each used, skipped or missed; where they hesitated, repeated themselves, got stuck or saw errors; anything the app made needlessly hard.
## Story quality
Did the builder pull out specifics (actions, numbers, what the person did themselves, the hardest part) or settle for vague answers? Is the draft in the person's own voice? Did the grade match what the transcript supports?
## Patterns across personas and models
What changed with personality and model (terse vs chatty, nervous vs confident). Note anything that looks like a model artefact rather than a product issue.
## Suggested fixes
A ranked list of at most 5 product changes, most valuable first. For each: the problem, the evidence (persona + step), and the change.
## Needs a real tester
One to three things only a human session can confirm.`;

export function analystPrompt(runs: PersonaRun[], context: { url: string; commit?: string }): string {
  return `Run against ${context.url}${context.commit ? ` (commit ${context.commit})` : ""}.

Numbers per persona:
${metricsTable(runs)}

Transcripts:

${runs.map((r) => transcriptForAnalyst(r)).join("\n\n---\n\n")}`;
}

export function reportMarkdown(input: {
  runs: PersonaRun[];
  insights: string;
  url: string;
  commit?: string;
  analystModel?: string;
  runnerCostUsd?: number;
  notes: string[];
}): string {
  const date = new Date().toISOString().slice(0, 16).replace("T", " ");
  return [
    `# Simulated users: story builder run, ${date} UTC`,
    "",
    `Preview: ${input.url}${input.commit ? ` · commit \`${input.commit.slice(0, 7)}\`` : ""}`,
    "",
    metricsTable(input.runs),
    "",
    "Steps: actions the persona took. Stuck: steps where nothing on the page changed (longest run in brackets). In own words: share of the draft in the persona's phrasing (the builder asks for a rewrite under 25%).",
    "",
    ...(input.notes.length ? ["**Notes:**", ...input.notes.map((n) => `- ${n}`), ""] : []),
    `## Insights${input.analystModel ? ` (written by ${input.analystModel})` : ""}`,
    "",
    input.insights.trim() || "_The analyst model didn't answer, so there are no insights this run. The transcripts are in the run's files._",
    "",
    "---",
    `_AI personas can't feel dread or tiredness, and AI judging AI is biased: use this to catch breakage and friction, and real testers to confirm what matters.${input.runnerCostUsd !== undefined ? ` Persona and analyst calls cost $${input.runnerCostUsd.toFixed(3)}; the app's own builder and grader calls are on the app's OpenRouter key._` : "_"}`,
  ].join("\n");
}
