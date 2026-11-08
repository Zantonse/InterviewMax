// Grader calibration (src/lib/sims/calibrate.ts): grades every reference answer in
// scripts/sims/reference/stories.json with each grader and prints the report. No browser or
// preview needed. Run: OPENROUTER_API_KEY=... npm run sims:calibrate
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { calibrationReport, referenceGradable, type CalibrationRow, type ReferenceStory } from "../../src/lib/sims/calibrate";
import { quickChecks } from "../../src/lib/stories/grading";
import { COMPARE_GRADERS, graderMessages, graderResult } from "../../src/lib/sims/graders";

const apiKey = process.env.OPENROUTER_API_KEY ?? "";
if (!apiKey) {
  console.error("OPENROUTER_API_KEY is required.");
  process.exit(2);
}
const models = (process.env.SIM_GRADERS || COMPARE_GRADERS.join(","))
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const outDir = process.env.SIM_OUT ?? "sims-out";
let costUsd = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Credit left on the key, so a run that hits the limit says so (OpenRouter reserves credit per
// in-flight request, which is why the calls below run a few at a time).
async function creditLeft(): Promise<string> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/key", { headers: { authorization: `Bearer ${apiKey}` } });
    const { data } = (await res.json()) as { data?: { limit_remaining?: number | null } };
    if (!data) return "unknown";
    return data.limit_remaining == null ? "no limit set" : `$${data.limit_remaining.toFixed(2)}`;
  } catch {
    return "unknown";
  }
}

async function chat(model: string, messages: { role: string; content: string }[], attempt = 0): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "x-title": "InterviewMax grader calibration",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4000,
      temperature: 0.2,
      usage: { include: true },
      reasoning: { effort: "medium", exclude: true },
      // Same rule as the app: providers that train on prompts are never used.
      provider: { data_collection: "deny" },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const body = (await res.json().catch(() => ({}))) as {
    choices?: { message?: { content?: string } }[];
    usage?: { cost?: number };
    error?: { message?: string };
  };
  if (!res.ok) {
    const message = body.error?.message ?? String(res.status);
    if (attempt < 3 && /credits|rate|429|timeout/i.test(`${message} ${res.status}`)) {
      await sleep(5_000 * (attempt + 1));
      return chat(model, messages, attempt + 1);
    }
    throw new Error(`${model}: ${message}`);
  }
  costUsd += body.usage?.cost ?? 0;
  return body.choices?.[0]?.message?.content ?? "";
}

const file = path.join(path.dirname(new URL(import.meta.url).pathname), "reference", "stories.json");
const { stories } = JSON.parse(await readFile(file, "utf8")) as { stories: ReferenceStory[] };
// A few calls at a time: dozens in flight at once ran the key out of reserved credit (run 23).
async function pool<T>(jobs: (() => Promise<T>)[], size: number): Promise<T[]> {
  const out: T[] = new Array(jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++;
        out[i] = await jobs[i]();
      }
    }),
  );
  return out;
}

const before = await creditLeft();
const jobs = stories.flatMap((ref) =>
  models.map((m) => async () => {
    const story = referenceGradable(ref);
    try {
      const text = await chat(m, graderMessages(story));
      const result = graderResult(m, text, story);
      if (result.error) result.error += ` Reply began: ${JSON.stringify(text.slice(0, 160))}`;
      return { ref, result };
    } catch (err) {
      return { ref, result: { model: m, criteria: {}, error: String(err).slice(0, 200) } };
    }
  }),
);
const graded = await pool(jobs, Number(process.env.SIM_CONCURRENCY || 4));
const rows: CalibrationRow[] = stories.map((ref) => {
  const story = referenceGradable(ref);
  return {
    ref,
    results: graded.filter((g) => g.ref === ref).map((g) => g.result),
    failedChecks: quickChecks(story.draft, story.storyType).filter((c) => !c.pass).map((c) => c.id),
  };
});
const report = `${calibrationReport(rows)}\n_Grader calls cost $${costUsd.toFixed(3)}. Credit left on the key: ${before} before, ${await creditLeft()} after._\n`;
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "calibration.md"), report);
await writeFile(path.join(outDir, "calibration.json"), JSON.stringify(rows, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report);
console.log(`\n${report}`);
const errors = rows.flatMap((r) => r.results.filter((g) => g.error).map((g) => `${r.ref.id} ${g.model}: ${g.error}`));
if (errors.length) console.log(`Errors:\n${errors.join("\n")}`);
