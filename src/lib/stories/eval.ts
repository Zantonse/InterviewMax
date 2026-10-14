import { TIERS, type Tier } from "./grading";
import { getStoryType, type StoryType } from "./story-types";

// The grader eval harness (PRD, evaluation agent): rerun the grader on hand-graded stories after a
// prompt or model change and report where it disagrees with the human grades. Pure code here; the
// model calls live in scripts/grade-eval.mts.
//
// The hand-graded set is two files kept outside the repo (stories are user data):
//   stories.json: {"stories": [{"id", "storyType", "title", "parts", "untracedNumbers"?}]}
//   grades.csv:   story,criterion,pre_grade,your_grade,reason,your_note
//                 one row per story and criterion, plus a "tier" row; your_grade wins when filled.

export type EvalStory = {
  id: string;
  storyType: StoryType;
  title: string;
  parts: Record<string, string>;
  untracedNumbers: string[];
};

export type GradeRow = {
  story: string;
  criterion: string;
  // The grade that counts: your_grade when filled in, otherwise pre_grade.
  grade: string;
  // Whether a person filled in your_grade (a blank means they agreed, or haven't looked yet).
  confirmed: boolean;
  reason: string;
};

export type GraderRun = {
  story: string;
  run: number;
  scores: Record<string, number>;
  tier: Tier;
};

export type Disagreement = {
  story: string;
  criterion: string;
  hand: string;
  // The grader's answer on each run, e.g. "3, 2".
  model: string;
  // Largest distance from the hand grade on any run (tiers count one step per tier).
  gap: number;
};

export type Agreement = { scored: number; exact: number; withinOne: number; meanDiff: number };

export type EvalResult = Agreement & {
  tierScored: number;
  tierExact: number;
  byCriterion: ({ criterion: string } & Agreement)[];
  disagreements: Disagreement[];
  // Criteria where the grader gave different scores on different runs of the same story.
  unstable: { story: string; criterion: string; scores: number[] }[];
};

export function parseEvalSet(json: unknown): EvalStory[] {
  const stories = isRecord(json) && Array.isArray(json.stories) ? json.stories : undefined;
  if (!stories) throw new Error('stories.json needs a "stories" list.');
  return stories.map((s, i) => {
    if (!isRecord(s) || typeof s.id !== "string" || !isRecord(s.parts)) {
      throw new Error(`Story ${i + 1} in stories.json needs an id and parts.`);
    }
    const storyType = typeof s.storyType === "string" ? getStoryType(s.storyType) : undefined;
    if (!storyType) throw new Error(`Story ${s.id} has an unknown storyType: ${String(s.storyType)}.`);
    const parts = Object.fromEntries(
      Object.entries(s.parts).filter((e): e is [string, string] => typeof e[1] === "string"),
    );
    const untraced = Array.isArray(s.untracedNumbers)
      ? s.untracedNumbers.filter((n): n is string => typeof n === "string")
      : [];
    return {
      id: s.id,
      storyType,
      title: typeof s.title === "string" ? s.title : "",
      parts,
      untracedNumbers: untraced,
    };
  });
}

const COLUMNS = ["story", "criterion", "pre_grade", "your_grade"] as const;

export function parseGradesCsv(text: string): GradeRow[] {
  const [header, ...rows] = csvRows(text).filter((r) => r.some((cell) => cell.trim()));
  const col = Object.fromEntries((header ?? []).map((name, i) => [name.trim(), i]));
  const missing = COLUMNS.filter((c) => col[c] === undefined);
  if (missing.length) throw new Error(`grades.csv is missing columns: ${missing.join(", ")}.`);
  const cell = (row: string[], name: string) => (row[col[name]] ?? "").trim();
  return rows.map((row) => {
    const yours = cell(row, "your_grade");
    return {
      story: cell(row, "story"),
      criterion: cell(row, "criterion"),
      grade: yours || cell(row, "pre_grade"),
      confirmed: Boolean(yours),
      reason: col.reason === undefined ? "" : cell(row, "reason"),
    };
  });
}

// One story's hand grades: criterion scores and the tier.
export function handGradesFor(story: string, rows: GradeRow[]) {
  const mine = rows.filter((r) => r.story === story);
  const scores: Record<string, number> = {};
  let tier: Tier | undefined;
  for (const r of mine) {
    if (r.criterion === "tier") {
      tier = TIERS.find((t) => t.id === r.grade)?.id;
      continue;
    }
    const n = Number(r.grade);
    if (Number.isInteger(n) && n >= 1 && n <= 4) scores[r.criterion] = n;
  }
  return { scores, tier, confirmed: mine.filter((r) => r.confirmed).length, total: mine.length };
}

export function compareRuns(rows: GradeRow[], runs: GraderRun[]): EvalResult {
  const diffs: { criterion: string; diff: number }[] = [];
  const disagreements: Disagreement[] = [];
  const unstable: EvalResult["unstable"] = [];
  let tierScored = 0;
  let tierExact = 0;

  for (const story of [...new Set(runs.map((r) => r.story))]) {
    const hand = handGradesFor(story, rows);
    const storyRuns = runs.filter((r) => r.story === story);

    for (const [criterion, handScore] of Object.entries(hand.scores)) {
      const scores = storyRuns.flatMap((r) =>
        r.scores[criterion] === undefined ? [] : [r.scores[criterion]],
      );
      if (!scores.length) continue;
      for (const s of scores) diffs.push({ criterion, diff: s - handScore });
      const gap = Math.max(...scores.map((s) => Math.abs(s - handScore)));
      if (gap > 0) {
        disagreements.push({ story, criterion, hand: String(handScore), model: scores.join(", "), gap });
      }
      if (new Set(scores).size > 1) unstable.push({ story, criterion, scores });
    }

    if (hand.tier) {
      const rank = (t: Tier) => TIERS.findIndex((x) => x.id === t);
      tierScored += storyRuns.length;
      tierExact += storyRuns.filter((r) => r.tier === hand.tier).length;
      const gap = Math.max(...storyRuns.map((r) => Math.abs(rank(r.tier) - rank(hand.tier!))));
      if (gap > 0) {
        disagreements.push({
          story,
          criterion: "tier",
          hand: hand.tier,
          model: storyRuns.map((r) => r.tier).join(", "),
          gap,
        });
      }
    }
  }

  const criteria = [...new Set(diffs.map((d) => d.criterion))];
  disagreements.sort(
    (a, b) => b.gap - a.gap || Number(b.criterion === "tier") - Number(a.criterion === "tier"),
  );
  return {
    ...agreement(diffs.map((d) => d.diff)),
    tierScored,
    tierExact,
    byCriterion: criteria.map((criterion) => ({
      criterion,
      ...agreement(diffs.filter((d) => d.criterion === criterion).map((d) => d.diff)),
    })),
    disagreements,
    unstable,
  };
}

function agreement(diffs: number[]): Agreement {
  return {
    scored: diffs.length,
    exact: diffs.filter((d) => d === 0).length,
    withinOne: diffs.filter((d) => Math.abs(d) <= 1).length,
    meanDiff: diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0,
  };
}

export function formatReport(input: {
  result: EvalResult;
  model: string;
  runsPerStory: number;
  stories: number;
  confirmed: number;
  total: number;
  date: string;
}): string {
  const { result: r } = input;
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : "n/a");
  const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(2)}`;
  const lines = [
    `# Grader eval, ${input.date}`,
    "",
    `Model: ${input.model}. ${input.stories} stories, ${input.runsPerStory} run${input.runsPerStory === 1 ? "" : "s"} each. ${input.confirmed} of ${input.total} hand grades confirmed by a person (the rest are pre-grades).`,
    "",
    `- Exact agreement: ${pct(r.exact, r.scored)} (${r.exact} of ${r.scored} scores)`,
    `- Within one point: ${pct(r.withinOne, r.scored)}`,
    `- Grader bias: ${signed(r.meanDiff)} points on average (positive means the grader is more generous than the hand grades)`,
    `- Tier agreement: ${pct(r.tierExact, r.tierScored)} (${r.tierExact} of ${r.tierScored})`,
    "",
    "## By criterion",
    "",
    "| Criterion | Exact | Within one | Bias |",
    "| --- | --- | --- | --- |",
    ...r.byCriterion.map(
      (c) =>
        `| ${c.criterion} | ${pct(c.exact, c.scored)} | ${pct(c.withinOne, c.scored)} | ${signed(c.meanDiff)} |`,
    ),
    "",
    "## Disagreements",
    "",
  ];
  if (r.disagreements.length) {
    lines.push(
      "| Story | Criterion | Hand | Grader | Gap |",
      "| --- | --- | --- | --- | --- |",
      ...r.disagreements.map(
        (d) => `| ${d.story} | ${d.criterion} | ${d.hand} | ${d.model} | ${d.gap} |`,
      ),
    );
  } else {
    lines.push("None: the grader matched every hand grade.");
  }
  if (r.unstable.length) {
    lines.push(
      "",
      "## Unstable across runs",
      "",
      ...r.unstable.map((u) => `- ${u.story} / ${u.criterion}: ${u.scores.join(", ")}`),
    );
  }
  return `${lines.join("\n")}\n`;
}

// RFC 4180 rows: quoted fields may hold commas, newlines and doubled quotes.
function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
