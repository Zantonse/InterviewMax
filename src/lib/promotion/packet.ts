import type { ChatMessage } from "@/lib/ai/types";
import { levelLabel, type LevelId } from "@/lib/jobs/content";
import type { FinishedStory } from "@/lib/resume/content";
import { countWords } from "@/lib/stories/grading";
import { untracedNumbers } from "@/lib/stories/numbers";
import { extractJson } from "@/lib/stories/prompts";
import type { DimensionEvidence, PacketItem } from "./content";

// The one model call behind the promotion packet (promotionPacket): a self-review draft by
// dimension, a short summary for the manager and talking points for the promotion conversation,
// all from the user's finished stories. Every line names the stories it draws on, and code checks
// each figure against those stories' own answers and the numbers checklist: a line with a figure
// that can't be traced is left out, never shown.

export const MAX_STORIES = 12;
export const MAX_REVIEW_WORDS = 120;
export const MAX_SUMMARY_WORDS = 120;
export const MAX_POINT_WORDS = 35;
export const MAX_POINTS = 6;
const MAX_ANSWERS_PER_STORY = 4000;
const MAX_ITEM_LENGTH = 1200;

export const PACKET_SYSTEM = `You help an experienced professional write the case for their promotion at the company they already work for, from interview-style stories they built from their own answers. The readers are their manager and a promotion committee, who want evidence that they already work at the next level: scope, impact and influence, shown by what they did and what came of it.

The hard rule: use only facts and figures the user gave. Copy every figure exactly as written in that story's answers or their numbers; never add, round, inflate, convert, total or combine numbers, and never borrow a figure from one story for another. Never invent a result, a scope, a team size, a title or praise from others. If a story has no number, write it without one: a plain, true line beats an invented metric. Some names may already be replaced with neutral words such as "a large bank"; keep those words as they are.

Write three things:
1. selfReview: one paragraph per dimension of the target level that the stories give evidence for, in the first person ("I"), under ${MAX_REVIEW_WORDS} words each. Lead with the strongest evidence at the target level's scope; say what they did and what came of it. Skip a dimension no story speaks to.
2. managerSummary: a short note the user could hand their manager, first person, under ${MAX_SUMMARY_WORDS} words: the level they are going for, the two or three strongest pieces of evidence, and what is still thin (from the gaps given), said plainly.
3. talkingPoints: up to ${MAX_POINTS} short points for the promotion conversation, each under ${MAX_POINT_WORDS} words: a claim and its proof.

Every item lists the ids of the stories it draws on ("s1", "s2"…); an item must draw on at least one. Plain words, no buzzwords, no adjectives about themselves.

Reply with JSON only, no other text:
{"selfReview": [{"dimension": "…", "text": "…", "stories": ["s1"]}], "managerSummary": {"text": "…", "stories": ["s1"]}, "talkingPoints": [{"text": "…", "stories": ["s1"]}]}`;

export type PacketRetry = { previous: string; problems: string[] };

export function packetMessages(input: {
  currentLevel?: LevelId;
  targetLevel: LevelId;
  evidence: DimensionEvidence[];
  stories: FinishedStory[];
  numbers: string[];
  retry?: PacketRetry;
}): ChatMessage[] {
  const ids = new Map(input.stories.map((s, i) => [s.id, `s${i + 1}`]));
  const lines = [
    `## Promotion: ${input.currentLevel ? `${levelLabel(input.currentLevel)} to ` : ""}${levelLabel(input.targetLevel)}`,
    "",
    "## Dimensions of the target level, and the evidence so far",
    ...input.evidence.map((e) => {
      const refs = e.stories.flatMap((s) => (ids.has(s.id) ? [ids.get(s.id)] : []));
      const gap =
        e.status === "at_target"
          ? "has a story at the target level"
          : e.status === "current_only"
            ? "stories only at the current level"
            : e.status === "empty"
              ? "no story yet"
              : "story not graded yet";
      return `- ${e.dimension.label}${e.dimension.expects ? `: "${e.dimension.expects}"` : ""} (${gap}${refs.length ? `; stories ${refs.join(", ")}` : ""})`;
    }),
  ];
  if (input.numbers.length)
    lines.push("", "## Their numbers", ...input.numbers.map((n) => `- ${n}`));
  lines.push("", "## Their stories");
  input.stories.forEach((s, i) => {
    lines.push(
      "",
      `### s${i + 1}: ${s.title} (${s.typeLabel})`,
      "The written story:",
      s.story,
      "",
      "The answers it was written from:",
      s.answers.slice(0, MAX_ANSWERS_PER_STORY),
    );
  });
  const messages: ChatMessage[] = [{ role: "user", content: lines.join("\n") }];
  if (input.retry) {
    messages.push(
      { role: "assistant", content: input.retry.previous },
      {
        role: "user",
        content: `Fix these and reply with the whole JSON again:\n${input.retry.problems.map((p) => `- ${p}`).join("\n")}`,
      },
    );
  }
  return messages;
}

type RawItem = { text: string; stories: number[]; dimension?: string };
export type PacketReply = {
  selfReview: RawItem[];
  managerSummary: RawItem;
  talkingPoints: RawItem[];
};

function rawItem(raw: unknown, storyCount: number): RawItem | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const text =
    typeof r.text === "string" ? r.text.replace(/\s+/g, " ").trim().slice(0, MAX_ITEM_LENGTH) : "";
  const stories = Array.isArray(r.stories)
    ? [
        ...new Set(
          r.stories.flatMap((s) => {
            const n = typeof s === "string" ? Number(s.replace(/^s/i, "")) - 1 : NaN;
            return Number.isInteger(n) && n >= 0 && n < storyCount ? [n] : [];
          }),
        ),
      ]
    : [];
  if (!text) return undefined;
  return {
    text,
    stories,
    ...(typeof r.dimension === "string" ? { dimension: r.dimension.trim().slice(0, 80) } : {}),
  };
}

export function parsePacketReply(text: string, storyCount: number): PacketReply {
  const json = extractJson(text) as Record<string, unknown> | undefined;
  const list = (v: unknown) =>
    Array.isArray(v) ? v.flatMap((i) => rawItem(i, storyCount) ?? []) : [];
  return {
    selfReview: list(json?.selfReview),
    managerSummary: rawItem(json?.managerSummary, storyCount) ?? { text: "", stories: [] },
    talkingPoints: list(json?.talkingPoints).slice(0, MAX_POINTS),
  };
}

function itemProblems(item: RawItem, stories: FinishedStory[], maxWords: number): string[] {
  if (item.stories.length === 0) return ["doesn't name a story it draws on"];
  const problems: string[] = [];
  const source = item.stories.map((i) => stories[i].source).join("\n");
  const untraced = untracedNumbers(item.text, source);
  if (untraced.length) {
    problems.push(
      `uses ${untraced.map((n) => `"${n}"`).join(", ")}, which isn't in the answers of the stories it cites or the numbers checklist`,
    );
  }
  if (countWords(item.text) > maxWords) problems.push(`is over ${maxWords} words`);
  return problems;
}

// Problems with one reply, in words the writer can fix on a retry.
export function packetProblems(reply: PacketReply, stories: FinishedStory[]): string[] {
  const named = (label: string, item: RawItem, max: number) =>
    itemProblems(item, stories, max).map((p) => `${label} ("${item.text.slice(0, 80)}…") ${p}`);
  const problems = [
    ...reply.selfReview.flatMap((i) =>
      named(`The self-review paragraph for ${i.dimension || "a dimension"}`, i, MAX_REVIEW_WORDS),
    ),
    ...(reply.managerSummary.text
      ? named("The manager summary", reply.managerSummary, MAX_SUMMARY_WORDS)
      : ["Write the manager summary"]),
    ...reply.talkingPoints.flatMap((i) => named("A talking point", i, MAX_POINT_WORDS)),
  ];
  if (reply.selfReview.length === 0) problems.push("Write at least one self-review paragraph");
  return problems;
}

// Whatever still fails the figure check, or cites no story, is left out.
export function checkedPacket(
  reply: PacketReply,
  stories: FinishedStory[],
): {
  selfReview: (PacketItem & { dimension: string })[];
  managerSummary: string;
  talkingPoints: PacketItem[];
  leftOut: number;
} {
  let leftOut = 0;
  const keep = (item: RawItem): PacketItem | undefined => {
    const source = item.stories.map((i) => stories[i].source).join("\n");
    if (item.stories.length === 0 || untracedNumbers(item.text, source).length > 0) {
      leftOut++;
      return undefined;
    }
    return { text: item.text, storyIds: item.stories.map((i) => stories[i].id) };
  };
  const selfReview = reply.selfReview.flatMap((i) => {
    const kept = keep(i);
    return kept ? [{ ...kept, dimension: i.dimension ?? "" }] : [];
  });
  const summary = reply.managerSummary.text ? keep(reply.managerSummary) : undefined;
  const talkingPoints = reply.talkingPoints.flatMap((i) => keep(i) ?? []);
  return { selfReview, managerSummary: summary?.text ?? "", talkingPoints, leftOut };
}
