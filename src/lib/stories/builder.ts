import "server-only";
import { generateForStep, type Step } from "@/lib/ai";
import { allAnswerText, type FollowUp, type StoryContent, type StoryDraft } from "./content";
import { untracedNumbers } from "./numbers";
import {
  PREFILL_SYSTEM,
  parsePrefill,
  parseProbe,
  prefillMessages,
  parseWrite,
  probeMessages,
  probeSystem,
  writeMessages,
  writeSystem,
} from "./prompts";
import { storyParts, type StoryType } from "./story-types";
import type { ChatMessage } from "@/lib/ai/types";

// Call one: assess the answers so far and return follow-up questions aimed at the gaps. Round 1
// returns 3–5; round 2 returns up to 3, or none when the answers are already strong.
export async function probeStory(
  content: StoryContent,
  storyType: StoryType | undefined,
  round: number,
): Promise<FollowUp[]> {
  const { text } = await call(
    "storyProbe",
    probeSystem(storyType, round),
    probeMessages(content, storyType),
  );
  return parseProbe(text, round);
}

// "Tell me about yourself": answer the scripted questions a LinkedIn profile covers. Answers with a
// number that isn't in the profile are dropped, so the user is asked those questions themselves.
export async function prefillFromProfile(profileText: string): Promise<Record<string, string>> {
  const { text } = await call("storyPrefill", PREFILL_SYSTEM, prefillMessages(profileText));
  const answers = parsePrefill(text);
  return Object.fromEntries(
    Object.entries(answers).filter(([, answer]) => untracedNumbers(answer, profileText).length === 0),
  );
}

// Call two: write the story from the user's answers. Every number in the draft is checked
// against the answers in code; if any don't trace, the model gets one chance to fix them.
// Whatever still doesn't trace is saved on the draft so the builder can flag it.
export async function writeStory(
  content: StoryContent,
  storyType: StoryType | undefined,
): Promise<{ title: string; draft: StoryDraft }> {
  const answers = allAnswerText(content);
  const system = writeSystem(storyType);

  let result = await call("storyWrite", system, writeMessages(content, storyType));
  let story = parseWrite(result.text, storyType);
  let untraced = untracedNumbers(draftText(story.parts, storyType), answers);

  if (untraced.length > 0) {
    result = await call(
      "storyWrite",
      system,
      writeMessages(content, storyType, { previous: result.text, untraced }),
    );
    story = parseWrite(result.text, storyType);
    untraced = untracedNumbers(draftText(story.parts, storyType), answers);
  }

  return {
    title: story.title,
    draft: {
      parts: story.parts,
      untracedNumbers: untraced,
      model: result.model,
      writtenAt: new Date().toISOString(),
    },
  };
}

function draftText(parts: StoryDraft["parts"], storyType: StoryType | undefined) {
  return storyParts(storyType)
    .map((p) => parts[p.id] ?? "")
    .join("\n");
}

async function call(step: Step, system: string, messages: ChatMessage[]) {
  const result = await generateForStep(step, { system, messages });
  if (result.stopReason === "refusal") {
    throw new Error("The model declined to answer. Try rewording your answers.");
  }
  if (result.stopReason === "max_tokens" && !result.text.includes("}")) {
    throw new Error("The model ran out of room before finishing. Try again.");
  }
  return { text: result.text, model: result.model };
}
