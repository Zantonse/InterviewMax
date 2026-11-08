import type { StoryDraft } from "@/lib/stories/content";
import type { Tier } from "@/lib/stories/grading";
import { getStoryType } from "@/lib/stories/story-types";
import type { GraderResult } from "./graders";

// Grader calibration: answers with a known expected tier (published strong examples and weakened
// copies with one planted flaw, scripts/sims/reference/stories.json) graded by each grader with
// the app's prompt and tier rules, to see whether the grader rewards what's strong and catches
// each flaw. Pure, so it's tested without a model; scripts/sims/calibrate.mts makes the calls.

export type ReferenceStory = {
  id: string;
  kind: "published" | "planted";
  source?: string;
  basedOn?: string;
  flaw?: string;
  role: string;
  question: string;
  expect: Tier;
  parts: Record<string, string>;
};

// Behavioral STAR parts, as the app stores them.
export const REFERENCE_STORY_TYPE = "major_project";

export function referenceGradable(ref: ReferenceStory) {
  const draft: StoryDraft = {
    parts: ref.parts,
    untracedNumbers: [],
    model: "reference",
    writtenAt: "2026-11-08T00:00:00Z",
  };
  return { title: ref.question, draft, storyType: getStoryType(REFERENCE_STORY_TYPE) };
}

const RANK: Record<Tier, number> = { not_yet: 0, good_enough: 1, strong: 2 };

// "hit": the tier expected; "near": one tier off; "miss": two off, or a flaw graded above Not yet.
export function verdict(expect: Tier, got: Tier | undefined): "hit" | "near" | "miss" | "error" {
  if (!got) return "error";
  if (expect === "not_yet" && got !== "not_yet") return "miss";
  const gap = Math.abs(RANK[expect] - RANK[got]);
  return gap === 0 ? "hit" : gap === 1 ? "near" : "miss";
}

const short = (m: string) => m.split("/").pop()!;
const tierLabel = (t?: Tier) => (t ? t.replace("_", " ") : "–");

export function calibrationReport(rows: { ref: ReferenceStory; results: GraderResult[] }[]): string {
  const models = [...new Set(rows.flatMap((r) => r.results.map((g) => g.model)))];
  const head = `| Answer | Kind | Expected | ${models.map(short).join(" | ")} |\n|---|---|---|${models.map(() => "---|").join("")}`;
  const lines = rows.map(({ ref, results }) => {
    const cells = models.map((m) => {
      const g = results.find((r) => r.model === m);
      if (!g || g.error) return "error";
      const v = verdict(ref.expect, g.tier);
      return `${tierLabel(g.tier)}, ${g.score ?? "–"}${v === "hit" ? "" : v === "near" ? " (≈)" : " ✗"}`;
    });
    return `| ${ref.id}${ref.flaw ? ` (${ref.flaw})` : ""} | ${ref.kind} | ${tierLabel(ref.expect)} | ${cells.join(" | ")} |`;
  });
  const planted = rows.filter((r) => r.ref.kind === "planted");
  const totals = models.map((m) => {
    const vs = rows.map(({ ref, results }) => verdict(ref.expect, results.find((r) => r.model === m)?.tier));
    const caught = planted.filter((r) => r.results.find((g) => g.model === m)?.tier === "not_yet").length;
    return `- ${m}: ${vs.filter((v) => v === "hit").length}/${rows.length} on the expected tier, caught ${caught}/${planted.length} planted flaws, ${vs.filter((v) => v === "miss").length} misses, ${vs.filter((v) => v === "error").length} errors`;
  });
  const low: Record<string, number> = {};
  for (const { ref, results } of rows) {
    if (ref.kind !== "published") continue;
    for (const g of results) {
      for (const [c, s] of Object.entries(g.criteria)) if (s <= 2) low[c] = (low[c] ?? 0) + 1;
    }
  }
  const counts = Object.entries(low)
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c} (${n})`)
    .join(", ");
  return [
    "# Grader calibration",
    "",
    "Published answers that prep sites present as strong, and weakened copies with one planted flaw, graded with the app's grading prompt and tier rules. ✗ = two tiers off, or a planted flaw graded above Not yet; (≈) = one tier off.",
    "",
    head,
    ...lines,
    "",
    "## Per grader",
    ...totals,
    "",
    `Criteria scored 1-2 on the published strong answers (all graders): ${counts || "none"}.`,
    "",
  ].join("\n");
}
