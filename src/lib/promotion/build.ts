import "server-only";
import { generateForStep } from "@/lib/ai";
import type { LevelId } from "@/lib/jobs/content";
import { numbersForStory } from "@/lib/numbers/checklist";
import { getNumbersChecklistSafely } from "@/lib/numbers/data";
import { isFinishedStory, type FinishedStory } from "@/lib/resume/content";
import { allAnswerText } from "@/lib/stories/content";
import { listStories } from "@/lib/stories/data";
import { draftText } from "@/lib/stories/grading";
import { answersTranscript } from "@/lib/stories/prompts";
import { getStoryType } from "@/lib/stories/story-types";
import { MAX_LADDER_LENGTH, gapMap, type Ladder, type PromotionPacket } from "./content";
import { getPromotionPlan, savePromotionPlan } from "./data";
import { LADDER_SYSTEM, dimensionsFromReply, ladderMessages } from "./ladder";
import {
  MAX_STORIES,
  PACKET_SYSTEM,
  checkedPacket,
  packetMessages,
  packetProblems,
  parsePacketReply,
  type PacketRetry,
} from "./packet";

// Reads a pasted ladder into dimensions and saves it on the plan. One call; a ladder the model
// can't find any story-provable dimension in is refused, and the generic dimensions stay.
export async function readLadder(text: string, targetLevel: LevelId): Promise<Ladder> {
  const plan = await getPromotionPlan();
  const ladder = text.trim().slice(0, MAX_LADDER_LENGTH);
  const result = await generateForStep("ladderRead", {
    system: LADDER_SYSTEM,
    messages: ladderMessages({ ladder, currentLevel: plan.currentLevel, targetLevel }),
  });
  if (result.stopReason === "refusal") throw new Error("The model declined to read the ladder.");
  const dimensions = dimensionsFromReply(result.text, ladder);
  if (dimensions.length === 0) {
    throw new Error(
      "No dimensions came out of that ladder. Paste the part that describes each level.",
    );
  }
  const value: Ladder = {
    text: ladder,
    dimensions,
    model: result.model,
    readAt: new Date().toISOString(),
  };
  await savePromotionPlan({ ...plan, targetLevel, ladder: value });
  return value;
}

// Writes the promotion packet from the user's finished stories and saves it on the plan. One call,
// one retry with the problems named; lines still off are left out.
export async function buildPacket(): Promise<PromotionPacket> {
  const [plan, stories, checklist] = await Promise.all([
    getPromotionPlan(),
    listStories(),
    getNumbersChecklistSafely(),
  ]);
  if (!plan.targetLevel) throw new Error("Pick the level you're going for first.");

  const finished: FinishedStory[] = stories
    .filter(isFinishedStory)
    .slice(0, MAX_STORIES)
    .map((s) => {
      const type = getStoryType(s.storyType);
      const values = numbersForStory(checklist, s.storyType).flatMap((n) =>
        n.value ? [n.value] : [],
      );
      return {
        id: s.id,
        title: s.title,
        typeLabel: type?.label ?? "Story",
        story: draftText(s.content.draft!.parts, type),
        answers: answersTranscript(s.content, type),
        source: [allAnswerText(s.content), ...values].join("\n"),
        draftWrittenAt: s.content.draft!.writtenAt,
      };
    });
  if (finished.length === 0) {
    throw new Error("Finish writing a story first: the packet is built from your written stories.");
  }
  const numbers = numbersForStory(checklist, null).flatMap((n) =>
    n.value ? [`${n.label}: ${n.value}`] : [],
  );
  const base = {
    currentLevel: plan.currentLevel,
    targetLevel: plan.targetLevel,
    evidence: gapMap(stories, plan),
    stories: finished,
    numbers,
  };

  let best:
    | { reply: ReturnType<typeof parsePacketReply>; model: string; problems: string[] }
    | undefined;
  let retry: PacketRetry | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generateForStep("promotionPacket", {
      system: PACKET_SYSTEM,
      messages: packetMessages({ ...base, retry }),
    });
    if (result.stopReason === "refusal") throw new Error("The model declined to write the packet.");
    const reply = parsePacketReply(result.text, finished.length);
    const problems = packetProblems(reply, finished);
    if (!best || problems.length < best.problems.length)
      best = { reply, model: result.model, problems };
    if (problems.length === 0) break;
    retry = { previous: result.text, problems };
  }

  const checked = checkedPacket(best!.reply, finished);
  if (checked.selfReview.length === 0 && !checked.managerSummary) {
    throw new Error("Nothing in the packet passed the number check. Try again.");
  }
  const packet: PromotionPacket = {
    ...checked,
    stories: Object.fromEntries(finished.map((s) => [s.id, s.draftWrittenAt])),
    model: best!.model,
    generatedAt: new Date().toISOString(),
  };
  await savePromotionPlan({ ...plan, packet });
  return packet;
}
