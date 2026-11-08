import { parseContent, type StoryDraft } from "@/lib/stories/content";
import {
  gradeMessages,
  gradeSystem,
  parseGrade,
  quickChecks,
  scoreOutOf100,
  tierFor,
  type Tier,
} from "@/lib/stories/grading";
import { getStoryType } from "@/lib/stories/story-types";
import type { ResultPayload } from "./score";

// Grader comparison: each persona's written story is graded again by several models with the
// app's own grading prompt, quick checks and tier rules, so a cheaper grader can be compared with
// the app's before switching. The app's own grade stays the reference.

export const COMPARE_GRADERS = [
  "openai/gpt-5.5",
  "deepseek/deepseek-v4.1-flash",
  "google/gemini-2.5-flash",
] as const;

export type GraderResult = {
  model: string;
  tier?: Tier;
  score?: number;
  // Criterion id -> 1..4.
  criteria: Record<string, number>;
  costUsd?: number;
  error?: string;
};

type StoryRow = ResultPayload["stories"][number];

export function gradableStory(
  row: StoryRow,
): { title: string; draft: StoryDraft; storyType: ReturnType<typeof getStoryType> } | null {
  const content = parseContent(row.content);
  if (!content.draft) return null;
  return { title: row.title, draft: content.draft, storyType: getStoryType(row.story_type) };
}

type Message = { role: "system" | "user" | "assistant"; content: string };

export function graderMessages(story: NonNullable<ReturnType<typeof gradableStory>>): Message[] {
  return [
    { role: "system", content: gradeSystem(story.storyType) },
    ...gradeMessages(story.title, story.draft, story.storyType).map((m) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : "",
    })),
  ];
}

export function graderResult(
  model: string,
  text: string,
  story: NonNullable<ReturnType<typeof gradableStory>>,
): GraderResult {
  try {
    const graded = parseGrade(text, story.storyType);
    const checks = quickChecks(story.draft, story.storyType);
    return {
      model,
      tier: tierFor(graded.criteria, checks),
      score: scoreOutOf100(graded.criteria),
      criteria: Object.fromEntries(graded.criteria.map((c) => [c.id, c.score])),
    };
  } catch (err) {
    return { model, criteria: {}, error: err instanceof Error ? err.message : String(err) };
  }
}

// The app's own grade of the same story, as a GraderResult, for the comparison table.
export function appGrade(row: StoryRow): GraderResult | null {
  const grade = parseContent(row.content).grade;
  if (!grade) return null;
  return {
    model: `${grade.model} (in the app)`,
    tier: grade.tier,
    score: scoreOutOf100(grade.criteria),
    criteria: Object.fromEntries(grade.criteria.map((c) => [c.id, c.score])),
  };
}

const short = (model: string) => model.replace(/^[^/]+\//, "");

// One table per run: a row per persona story, a column per grader (tier and score out of 100).
export function graderTable(rows: { persona: string; level: string; results: GraderResult[] }[]): string {
  const models = [...new Set(rows.flatMap((r) => r.results.map((g) => g.model)))];
  if (!models.length) return "";
  const head = `| Persona | Level | ${models.map(short).join(" | ")} |\n|---|---|${models.map(() => "---|").join("")}`;
  const lines = rows.map((r) => {
    const cells = models.map((m) => {
      const g = r.results.find((x) => x.model === m);
      if (!g) return "–";
      if (g.error) return "failed";
      return `${g.tier?.replace("_", " ") ?? "?"}, ${g.score ?? "?"}`;
    });
    return `| ${r.persona} | ${r.level} | ${cells.join(" | ")} |`;
  });
  return [head, ...lines].join("\n");
}
