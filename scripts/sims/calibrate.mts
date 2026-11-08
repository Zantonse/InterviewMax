// Grader calibration (src/lib/sims/calibrate.ts): grades every reference answer in
// scripts/sims/reference/stories.json with each grader and prints the report. No browser or
// preview needed. Run: OPENROUTER_API_KEY=... npm run sims:calibrate
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { calibrationReport, referenceGradable, type ReferenceStory } from "../../src/lib/sims/calibrate";
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

async function chat(model: string, messages: { role: string; content: string }[]): Promise<string> {
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
  if (!res.ok) throw new Error(`${model}: ${body.error?.message ?? res.status}`);
  costUsd += body.usage?.cost ?? 0;
  return body.choices?.[0]?.message?.content ?? "";
}

const file = path.join(path.dirname(new URL(import.meta.url).pathname), "reference", "stories.json");
const { stories } = JSON.parse(await readFile(file, "utf8")) as { stories: ReferenceStory[] };
const rows = await Promise.all(
  stories.map(async (ref) => {
    const story = referenceGradable(ref);
    const results = await Promise.all(
      models.map(async (m) => {
        try {
          return graderResult(m, await chat(m, graderMessages(story)), story);
        } catch (err) {
          return { model: m, criteria: {}, error: String(err).slice(0, 200) };
        }
      }),
    );
    return { ref, results };
  }),
);
const report = `${calibrationReport(rows)}\n_Grader calls cost $${costUsd.toFixed(3)}._\n`;
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "calibration.md"), report);
await writeFile(path.join(outDir, "calibration.json"), JSON.stringify(rows, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report);
console.log(`\n${report}`);
const errors = rows.flatMap((r) => r.results.filter((g) => g.error).map((g) => `${r.ref.id} ${g.model}: ${g.error}`));
if (errors.length) console.log(`Errors:\n${errors.join("\n")}`);
