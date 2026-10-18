import { levelLabel, type LevelId } from "@/lib/jobs/content";
import type { ChatMessage } from "@/lib/ai/types";
import { extractJson } from "@/lib/stories/prompts";
import { MAX_DIMENSIONS, PROOF_THEMES, cleanDimensions, type Dimension } from "./content";

// The one model call that reads a pasted career ladder (ladderRead): the dimensions the target
// level is judged on, each with the ladder's own words for what that level expects and the question
// themes whose stories prove it. Code keeps a dimension's "expects" only when it is quoted from the
// ladder, and drops themes it doesn't know.

export const LADDER_SYSTEM = `You read a company's career ladder (the written expectations for each level) for someone building their case for promotion. Pick out the dimensions the ladder judges people on (for example scope, impact, influence, technical depth, leadership), at most ${MAX_DIMENSIONS}, in the ladder's own names.

For each dimension:
- label: the ladder's name for it, short.
- expects: what the ladder says the TARGET level is expected to do on it, copied word for word from the ladder: one sentence or line, never paraphrased. If the ladder doesn't separate levels, copy the line that describes the dimension. Empty string if nothing fits.
- themes: which of these interview story themes give evidence for it, one or more ids: ${PROOF_THEMES.map((t) => `"${t.id}" (${t.label})`).join(", ")}.

Leave out dimensions no story could show (for example "attendance" or "completes training"). Reply with JSON only, no other text:
{"dimensions": [{"id": "short_snake_case", "label": "…", "expects": "…", "themes": ["…"]}]}`;

export function ladderMessages(input: {
  ladder: string;
  currentLevel?: LevelId;
  targetLevel: LevelId;
}): ChatMessage[] {
  const levels = [
    input.currentLevel ? `Current level: ${levelLabel(input.currentLevel)}` : "",
    `Target level: ${levelLabel(input.targetLevel)}`,
  ].filter(Boolean);
  return [
    {
      role: "user",
      content: `${levels.join("\n")}\n\n## The career ladder\n${input.ladder.trim()}`,
    },
  ];
}

// "expects" survives only as a copy of the ladder (spacing, case and quotes aside).
export function dimensionsFromReply(text: string, ladder: string): Dimension[] {
  const json = extractJson(text);
  const raw =
    typeof json === "object" && json !== null && "dimensions" in json
      ? (json as { dimensions: unknown }).dimensions
      : undefined;
  const source = normalize(ladder);
  return cleanDimensions(raw).map((d) => ({
    ...d,
    expects: d.expects && source.includes(normalize(d.expects)) ? d.expects : "",
  }));
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}'"%$]+/gu, " ")
    .trim();
}
