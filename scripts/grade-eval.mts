// Grader eval harness: reruns the storyGrade step on the hand-graded stories and reports where the
// grader disagrees with the hand grades. Run it after every change to the grading prompt or model.
//
// Usage: npm run eval:grade -- <set folder> [--runs 3] [--model vendor/model] [--min 0.7]
//   <set folder>  holds stories.json and grades.csv (see src/lib/stories/eval.ts); defaults to
//                 ./eval-set, which git ignores. Stories are user data: keep them out of the repo.
//   --runs        grader calls per story, to see how stable it is (default 1)
//   --model       try another model for the storyGrade step without editing config.ts
//   --min         exit 1 when exact agreement is below this share (for use in a script)
// Reads OPENROUTER_API_KEY (or the key for the step's provider) from .env.local. Writes the report
// to <set folder>/results/. Costs about a cent per story per run.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { STEP_MODELS } from "../src/lib/ai/config";
import { buildProvider } from "../src/lib/ai/registry";
import {
  compareRuns,
  formatReport,
  parseEvalSet,
  parseGradesCsv,
  type GraderRun,
} from "../src/lib/stories/eval";
import {
  gradeMessages,
  gradeSystem,
  parseGrade,
  quickChecks,
  tierFor,
} from "../src/lib/stories/grading";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    runs: { type: "string", default: "1" },
    model: { type: "string" },
    min: { type: "string" },
  },
});

const dir = positionals[0] ?? "eval-set";
const runs = Math.max(1, Number(values.runs) || 1);
const step = STEP_MODELS.storyGrade;
const model = values.model ?? step.model;

const stories = parseEvalSet(JSON.parse(readFileSync(join(dir, "stories.json"), "utf8")));
const rows = parseGradesCsv(readFileSync(join(dir, "grades.csv"), "utf8"));
const provider = buildProvider(step.provider);

console.log(`Grading ${stories.length} stories × ${runs} with ${step.provider} ${model}…`);

const graderRuns: GraderRun[] = [];
const raw: unknown[] = [];
let failures = 0;
for (const story of stories) {
  const draft = {
    parts: story.parts,
    untracedNumbers: story.untracedNumbers,
    model: "",
    writtenAt: "",
  };
  const checks = quickChecks(draft, story.storyType);
  const results = await Promise.allSettled(
    Array.from({ length: runs }, () =>
      provider.generate({
        model,
        effort: step.effort,
        system: gradeSystem(story.storyType),
        messages: gradeMessages(story.title, draft, story.storyType),
      }),
    ),
  );
  results.forEach((r, i) => {
    try {
      if (r.status === "rejected") throw r.reason;
      const graded = parseGrade(r.value.text, story.storyType);
      const scores = Object.fromEntries(graded.criteria.map((c) => [c.id, c.score]));
      const tier = tierFor(graded.criteria, checks);
      graderRuns.push({ story: story.id, run: i + 1, scores, tier });
      raw.push({ story: story.id, run: i + 1, tier, ...graded, checks });
      // "Show your thinking" is feedback only for now; it's logged and saved so its effect on
      // grades can be checked here before it becomes a scored check.
      const thinking = graded.thinking ? ` thinking: ${graded.thinking.level}` : "";
      console.log(`  ✓ ${story.id} run ${i + 1}: ${tier} ${JSON.stringify(scores)}${thinking}`);
    } catch (err) {
      failures++;
      console.error(`  ✗ ${story.id} run ${i + 1}: ${err instanceof Error ? err.message : err}`);
    }
  });
}

if (!graderRuns.length) {
  console.error("Every grader call failed, so there's nothing to compare.");
  process.exit(1);
}

const result = compareRuns(rows, graderRuns);
const date = new Date().toISOString();
const report = formatReport({
  result,
  model,
  runsPerStory: runs,
  stories: stories.length,
  confirmed: rows.filter((r) => r.confirmed).length,
  total: rows.length,
  date,
});

const out = join(dir, "results");
mkdirSync(out, { recursive: true });
const stamp = date.replace(/[:.]/g, "-");
writeFileSync(join(out, `${stamp}.md`), report);
writeFileSync(join(out, `${stamp}.json`), JSON.stringify({ model, runs, result, raw }, null, 2));

console.log(`\n${report}`);
console.log(`Saved to ${join(out, `${stamp}.md`)}${failures ? ` (${failures} calls failed)` : ""}`);

const min = values.min === undefined ? undefined : Number(values.min);
process.exit(failures || (min !== undefined && result.exact / result.scored < min) ? 1 : 0);
