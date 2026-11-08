// Simulated users: AI personas build a story end to end on a Vercel preview, then a cheap model
// reads every transcript and writes an insights report. See scripts/sims/README.md.
//
// Usage: npm run sims -- https://<preview-url>
// Env:   SIM_USERS_SECRET, OPENROUTER_API_KEY (required)
//        VERCEL_AUTOMATION_BYPASS_SECRET (when previews are behind Vercel Authentication)
//        SIM_PERSONAS=sales-engineer,product-designer   SIM_MODELS=vendor/model,...
//        SIM_MAX_STEPS=80   SIM_RUN_NUMBER=7   SIM_OUT=sims-out   SIM_KEEP_ACCOUNTS=1
import { existsSync } from "node:fs";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import {
  isBlockedControl,
  newText,
  parseTurn,
  typedNote,
  filledBoxes,
  personaSystemPrompt,
  personaTurnPrompt,
  summarizeTurn,
  type Action,
  type Control,
  type Observation,
  type Turn,
} from "../../src/lib/sims/agent";
import { ANALYST_MODELS, PERSONA_MODELS, assignModels, availableModels } from "../../src/lib/sims/models";
import { COMPARE_GRADERS, appGrade, gradableStory, graderMessages, graderResult } from "../../src/lib/sims/graders";
import { PERSONAS, type Persona } from "../../src/lib/sims/personas";
import { ANALYST_SYSTEM, analystPrompt, reportMarkdown, transcriptForAnalyst, type PersonaRun } from "../../src/lib/sims/report";
import { JUDGE_MODEL, JUDGE_SYSTEM, judgePrompt, parseJudge, parseSurvey, surveyPrompt } from "../../src/lib/sims/rubric";
import { scoreRun, type ResultPayload, type StepRecord } from "../../src/lib/sims/score";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const OPENROUTER = "https://openrouter.ai/api/v1";
const baseUrl = (process.argv[2] ?? process.env.SIM_BASE_URL ?? "").replace(/\/$/, "");
const secret = process.env.SIM_USERS_SECRET ?? "";
const apiKey = process.env.OPENROUTER_API_KEY ?? "";
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";
const maxSteps = Number(process.env.SIM_MAX_STEPS ?? 80);
// Comparison graders for each written story; SIM_GRADERS=none turns it off.
const graderModels =
  process.env.SIM_GRADERS === "none"
    ? []
    : (process.env.SIM_GRADERS ?? COMPARE_GRADERS.join(",")).split(",").map((m) => m.trim()).filter(Boolean);
const runNumber = Number(process.env.SIM_RUN_NUMBER ?? process.env.GITHUB_RUN_NUMBER ?? Date.now() / 86_400_000);
const outDir = process.env.SIM_OUT ?? "sims-out";
const commit = process.env.SIM_COMMIT;
const SETTLE_TIMEOUT_MS = 150_000;
// Phrases the app shows while a model step runs; the runner keeps waiting while one is on screen.
const WORKING_RE = /\b(writing|thinking|reading|grading|working|checking|predicting|generating|looking)\b[^\n.]{0,60}(…|\.\.\.)/i;

if (!baseUrl || !secret || !apiKey) {
  console.error("Needs a preview URL (argument or SIM_BASE_URL), SIM_USERS_SECRET and OPENROUTER_API_KEY.");
  process.exit(2);
}

let costUsd = 0;
const notes: string[] = [];

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function chat(
  model: string,
  messages: ChatMessage[],
  opts: { maxTokens: number; temperature: number; effort?: "low" | "medium" },
) {
  const res = await fetch(`${OPENROUTER}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "x-title": "InterviewMax simulated users",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      usage: { include: true },
      // Thinking models (e.g. Qwen 3) can spend the whole token budget reasoning and return an
      // empty reply; keep it short and out of the answer.
      reasoning: { effort: opts.effort ?? "low", exclude: true },
      // Same rule as the app: providers that train on prompts are never used.
      provider: { data_collection: "deny" },
    }),
    signal: AbortSignal.timeout(120_000),
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

async function catalog(): Promise<Set<string> | null> {
  try {
    const res = await fetch(`${OPENROUTER}/models`, { signal: AbortSignal.timeout(30_000) });
    const body = (await res.json()) as { data?: { id: string }[] };
    return new Set((body.data ?? []).map((m) => m.id));
  } catch (err) {
    notes.push(`Couldn't list OpenRouter models (${String(err)}); used the configured list as is.`);
    return null;
  }
}

function simHeaders(): Record<string, string> {
  return { "x-sim-secret": secret, "content-type": "application/json" };
}

// Reads the page the way the persona sees it: visible text plus a numbered list of controls.
async function observe(page: Page): Promise<Observation> {
  const raw = await page.evaluate(() => {
    document.querySelectorAll("[data-sim-id]").forEach((el) => el.removeAttribute("data-sim-id"));
    const selector =
      'a[href], button, textarea, input:not([type="hidden"]):not([type="file"]), select, summary, [role="button"], [role="tab"]';
    const controls: {
      id: number;
      kind: string;
      label: string;
      value?: string;
      placeholder?: string;
      options?: string[];
    }[] = [];
    let id = 1;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (rect.width === 0 || rect.height === 0 || style.visibility === "hidden" || style.display === "none") continue;
      if ((el as HTMLButtonElement).disabled) continue;
      if (el instanceof HTMLAnchorElement && el.origin !== location.origin) continue;
      const tag = el.tagName.toLowerCase();
      const type = (el.getAttribute("type") ?? "").toLowerCase();
      const kind =
        tag === "a"
          ? "link"
          : tag === "textarea" || (tag === "input" && !["checkbox", "radio", "submit", "button"].includes(type))
            ? "textbox"
            : tag === "select"
              ? "select"
              : type === "checkbox" || type === "radio"
                ? "checkbox"
                : "button";
      const labelled = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent : "";
      const label = (
        el.getAttribute("aria-label") ||
        labelled ||
        (kind === "textbox" ? "" : el.innerText) ||
        el.getAttribute("title") ||
        el.getAttribute("name") ||
        ""
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 100);
      el.setAttribute("data-sim-id", String(id));
      controls.push({
        id: id++,
        kind,
        label,
        // Long values keep their end too, so text a chip appends still shows as a change.
        value:
          kind === "textbox"
            ? ((v: string) => (v.length > 200 ? `${v.slice(0, 120)} … ${v.slice(-80)} (${v.length} chars)` : v))(
                (el as HTMLInputElement).value,
              )
            : undefined,
        placeholder: el.getAttribute("placeholder") ?? undefined,
        options:
          el instanceof HTMLSelectElement ? Array.from(el.options).map((o) => o.text.trim()) : undefined,
      });
      if (controls.length >= 120) break;
    }
    const root = document.querySelector("main") ?? document.body;
    return { path: location.pathname + location.search, title: document.title, text: root.innerText, controls };
  });
  const controls = (raw.controls as Control[]).filter((c) => !isBlockedControl(c.label));
  return { ...raw, controls };
}

// Waits until the page stops changing and no "Writing…"-style message is showing.
async function settle(page: Page): Promise<void> {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  let last = "";
  let stable = 0;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1000);
    const snap = await page
      .evaluate(() => {
        const root = document.querySelector("main") ?? document.body;
        return {
          text: root.innerText,
          busy: document.querySelectorAll('[aria-busy="true"]').length,
        };
      })
      .catch(() => ({ text: "", busy: 1 }));
    const working = snap.busy > 0 || WORKING_RE.test(snap.text.slice(-3000));
    stable = snap.text === last && !working ? stable + 1 : 0;
    last = snap.text;
    if (stable >= 2) return;
  }
}

async function act(page: Page, action: Action): Promise<string | null> {
  const target = (id: number) => page.locator(`[data-sim-id="${id}"]`).first();
  try {
    switch (action.type) {
      case "click":
        await target(action.id).click({ timeout: 10_000 });
        return null;
      case "type":
        await target(action.id).fill(action.text, { timeout: 10_000 });
        return null;
      case "select": {
        // Models sometimes "select" on a button group; treat that as clicking the control.
        const el = target(action.id);
        const isSelect = await el.evaluate((n) => n.tagName === "SELECT").catch(() => false);
        if (isSelect) await el.selectOption({ label: action.option }, { timeout: 10_000 });
        else await el.click({ timeout: 10_000 });
        return null;
      }
      case "goto":
        await page.goto(new URL(action.path, baseUrl).toString(), { timeout: 60_000 });
        return null;
      case "wait":
        await page.waitForTimeout(5000);
        return null;
      default:
        return null;
    }
  } catch (err) {
    return `Couldn't ${action.type}: ${String(err).split("\n")[0]}`;
  }
}

async function nextTurn(model: string, system: string, prompt: string): Promise<Turn> {
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ];
  let raw = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    raw = await chat(model, messages, { maxTokens: 1500, temperature: 0.9 });
    const turn = parseTurn(raw);
    if (turn) return turn;
    messages.push(
      { role: "assistant", content: raw.slice(0, 2000) },
      { role: "user", content: "That wasn't a valid action. Reply with only the JSON object, using an id from the list." },
    );
  }
  return { thought: "(the model never gave a valid action)", action: { type: "give_up", reason: `persona model gave no valid action (last reply: ${JSON.stringify(raw.slice(0, 300))})` } };
}

// Grades the persona's written story again with each comparison grader (src/lib/sims/graders.ts).
async function compareGraders(result: ResultPayload | null, title: string | undefined) {
  const row = result?.stories.find((r) => r.title === title && gradableStory(r));
  const story = row ? gradableStory(row) : null;
  if (!row || !story || graderModels.length === 0) return undefined;
  const own = appGrade(row);
  const others = await Promise.all(
    graderModels.map(async (m) => {
      try {
        const text = await chat(m, graderMessages(story), { maxTokens: 4000, temperature: 0.2, effort: "medium" });
        return graderResult(m, text, story);
      } catch (err) {
        return { model: m, criteria: {}, error: String(err).slice(0, 200) };
      }
    }),
  );
  return [...(own ? [own] : []), ...others];
}

// The rubric (src/lib/sims/rubric.ts): the persona answers an exit survey in character, then a
// judge from a third vendor scores the run against the persona's real history.
const judgeModel = process.env.SIM_JUDGE || JUDGE_MODEL;
async function rubric(run: PersonaRun) {
  if (run.crashed || process.env.SIM_RUBRIC === "none") return;
  try {
    const text = await chat(
      run.model,
      [
        { role: "system", content: personaSystemPrompt(run.persona) },
        { role: "user", content: surveyPrompt(run) },
      ],
      { maxTokens: 1500, temperature: 0.7 },
    );
    run.survey = parseSurvey(text);
    if (!run.survey) notes.push(`${run.persona.id}: the exit survey answer couldn't be read.`);
  } catch (err) {
    notes.push(`${run.persona.id}: the exit survey failed (${String(err).slice(0, 200)}).`);
  }
  try {
    const text = await chat(
      judgeModel,
      [
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: judgePrompt(run, transcriptForAnalyst(run)) },
      ],
      { maxTokens: 3000, temperature: 0.2, effort: "medium" },
    );
    run.judge = parseJudge(text);
    if (!run.judge) notes.push(`${run.persona.id}: the judge's scorecard couldn't be read.`);
  } catch (err) {
    notes.push(`${run.persona.id}: the judge failed (${String(err).slice(0, 200)}).`);
  }
}

async function runPersona(context: BrowserContext, persona: Persona, model: string): Promise<PersonaRun> {
  const dir = path.join(outDir, persona.id);
  await mkdir(dir, { recursive: true });
  const steps: StepRecord[] = [];
  const startedAt = Date.now();
  let crashed: string | undefined;
  let result: ResultPayload | null = null;
  const page = await context.newPage();
  let stepErrors: string[] = [];
  page.on("pageerror", (err) => stepErrors.push(`page error: ${err.message.slice(0, 200)}`));
  page.on("response", (res) => {
    if (res.status() >= 500 && res.url().startsWith(baseUrl)) {
      stepErrors.push(`${res.status()} from ${new URL(res.url()).pathname}`);
    }
  });

  try {
    const signIn = await context.request.post(`${baseUrl}/api/sims/session`, {
      headers: simHeaders(),
      data: { persona: persona.id, field: persona.field },
    });
    if (!signIn.ok()) {
      throw new Error(`persona sign-in answered ${signIn.status()}: ${(await signIn.text()).slice(0, 300)}`);
    }
    await page.goto(`${baseUrl}/`, { timeout: 60_000 });
    await settle(page);

    const system = personaSystemPrompt(persona);
    let note: string | undefined;
    let stuck = 0;
    let typedInARow = 0;
    let lastTypedId: number | undefined;
    for (let step = 1; step <= maxSteps; step++) {
      const before = await observe(page);
      const turn = await nextTurn(
        model,
        system,
        personaTurnPrompt({
          step,
          maxSteps,
          observation: before,
          recent: steps.slice(-10).map((s) => ({ step: s.step, summary: s.summary })),
          note,
        }),
      );
      stepErrors = [];
      const t0 = Date.now();
      const failure = await act(page, turn.action);
      if (failure) stepErrors.push(failure);
      if (turn.action.type !== "done" && turn.action.type !== "give_up") await settle(page);
      const after = await observe(page).catch(() => before);
      const noChange =
        turn.action.type !== "done" &&
        turn.action.type !== "give_up" &&
        turn.action.type !== "type" &&
        after.text === before.text &&
        after.path === before.path;
      const shot = `${String(step).padStart(2, "0")}.jpg`;
      await page.screenshot({ path: path.join(dir, shot), type: "jpeg", quality: 55, fullPage: false }).catch(() => {});
      steps.push({
        step,
        path: before.path,
        thought: turn.thought,
        feeling: turn.feeling,
        action: turn.action,
        summary: summarizeTurn(turn, before.controls),
        appText: newText(before.text, after.text),
        seconds: (Date.now() - t0) / 1000,
        noChange,
        errors: [...stepErrors],
        screenshot: shot,
      });
      console.log(`[${persona.id}] ${step}. ${steps.at(-1)!.summary}`);
      if (turn.action.type === "done" || turn.action.type === "give_up") break;
      stuck = noChange ? stuck + 1 : 0;
      if (turn.action.type === "type" && !failure) {
        typedInARow = turn.action.id === lastTypedId ? typedInARow + 1 : 1;
        lastTypedId = turn.action.id;
      } else {
        typedInARow = 0;
        lastTypedId = undefined;
      }
      const filled = filledBoxes(before.controls, after.controls);
      note = failure
        ? `${failure}. Pick an id from the current list.`
        : typedInARow > 0
          ? typedNote(after.controls, typedInARow)
          : filled.length
            ? `That added text to ${filled.map((c) => `"${c.label || "the answer box"}"`).join(", ")} (it's in the box, not sent). ${typedNote(after.controls, 1)}`
          : noChange
            ? `Your last action didn't change anything on the page${stuck >= 3 ? " (several times in a row)" : ""}.`
            : undefined;
    }
  } catch (err) {
    crashed = String(err).split("\n")[0].slice(0, 400);
    console.error(`[${persona.id}] run failed: ${crashed}`);
  }

  try {
    const res = await context.request.post(`${baseUrl}/api/sims/result`, {
      headers: simHeaders(),
      data: { persona: persona.id, delete: process.env.SIM_KEEP_ACCOUNTS !== "1" },
    });
    if (res.ok()) result = (await res.json()) as ResultPayload;
    else notes.push(`${persona.id}: reading the result answered ${res.status()}.`);
  } catch (err) {
    notes.push(`${persona.id}: reading the result failed (${String(err).slice(0, 200)}).`);
  }
  await page.close().catch(() => {});

  const metrics = scoreRun({ steps, result, startedAt, endedAt: Date.now(), crashed });
  const graders = await compareGraders(result, metrics.story?.title);
  const run: PersonaRun = { persona, model, metrics, steps, crashed, graders };
  await rubric(run);
  await writeFile(path.join(dir, "transcript.json"), JSON.stringify({ ...run, result }, null, 2));
  return run;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const ids = (process.env.SIM_PERSONAS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const personas = ids.length ? PERSONAS.filter((p) => ids.includes(p.id)) : PERSONAS;
  if (personas.length === 0) throw new Error(`No persona matches SIM_PERSONAS=${process.env.SIM_PERSONAS}`);

  const known = await catalog();
  const wanted = (process.env.SIM_MODELS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const personaModels = availableModels(wanted.length ? wanted : PERSONA_MODELS, known);
  personaModels.missing.forEach((m) => notes.push(`OpenRouter doesn't list ${m} today; skipped it.`));
  const assigned = assignModels(personas.map((p) => p.id), runNumber, personaModels.ok);
  const analyst = availableModels(ANALYST_MODELS, known).ok[0] ?? ANALYST_MODELS[0];

  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  );
  const runs = await Promise.all(
    personas.map(async (persona) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        extraHTTPHeaders: bypass
          ? { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" }
          : undefined,
      });
      try {
        return await runPersona(context, persona, assigned[persona.id]);
      } finally {
        await context.close().catch(() => {});
      }
    }),
  );
  await browser.close();
  runs.filter((r) => r.crashed).forEach((r) => notes.unshift(`${r.persona.id} couldn't run: ${r.crashed}`));

  let insights = "";
  try {
    insights = await chat(
      analyst,
      [
        { role: "system", content: ANALYST_SYSTEM },
        { role: "user", content: analystPrompt(runs, { url: baseUrl, commit }) },
      ],
      { maxTokens: 6000, temperature: 0.3 },
    );
  } catch (err) {
    notes.push(`The analyst model failed: ${String(err).slice(0, 300)}`);
  }

  const report = reportMarkdown({
    runs,
    insights,
    url: baseUrl,
    commit,
    analystModel: insights ? analyst : undefined,
    runnerCostUsd: costUsd,
    notes,
  });
  await writeFile(path.join(outDir, "report.md"), report);
  await writeFile(
    path.join(outDir, "summary.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        url: baseUrl,
        commit,
        analyst,
        runnerCostUsd: costUsd,
        runs: runs.map((r) => ({ persona: r.persona.id, model: r.model, ...r.metrics, story: { ...r.metrics.story, draftText: undefined }, survey: r.survey, judge: r.judge })),
      },
      null,
      2,
    ),
  );
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  // Also in the log, so the report can be read without downloading the run's files.
  console.log(`\n${report}`);
  console.log(`\nReport: ${path.join(outDir, "report.md")} (persona + analyst calls $${costUsd.toFixed(3)})`);
  // A failing check means the runs couldn't happen at all, not that a persona struggled: that's
  // what the report is for.
  if (runs.every((r) => r.crashed)) process.exit(1);
}

await main();
