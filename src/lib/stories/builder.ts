import "server-only";
import { generateForStep, type Step } from "@/lib/ai";
import { allAnswerText, type FollowUp, type StoryContent, type StoryDraft } from "./content";
import {
  combineGrade,
  gradeMessages,
  gradeSystem,
  parseGrade,
  quickChecks,
  type StoryGrade,
} from "./grading";
import { keepTracedSentences, untracedNumbers } from "./numbers";
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
import type { PastInterviewNotes } from "@/lib/transcripts/content";

// Call one: assess the answers so far and return follow-up questions aimed at the gaps. Round 1
// returns 3–5; round 2 returns up to 3, or none when the answers are already strong.
// Notes from the user's past interview transcripts, when there are any, steer the questions toward
// what real interviewers probed for and what the user's answers kept missing.
export async function probeStory(
  content: StoryContent,
  storyType: StoryType | undefined,
  round: number,
  past?: PastInterviewNotes,
): Promise<FollowUp[]> {
  const { text } = await call(
    "storyProbe",
    probeSystem(storyType, round),
    probeMessages(content, storyType, past),
  );
  return parseProbe(text, round);
}

// "Tell me about yourself": answer the scripted questions a LinkedIn profile covers. Sentences with
// a number that isn't in the profile are dropped (not the whole answer: a tenure the model added up
// shouldn't cost the rest), and a question left with nothing is asked as usual.
export async function prefillFromProfile(profileText: string): Promise<Record<string, string>> {
  const { text } = await call("storyPrefill", PREFILL_SYSTEM, prefillMessages(profileText));
  const answers = parsePrefill(text);
  return Object.fromEntries(
    Object.entries(answers).flatMap(([id, answer]) => {
      const kept = keepTracedSentences(answer, profileText);
      return kept ? [[id, kept]] : [];
    }),
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

// Grading: the quick checks in code, plus a separate model call (a different vendor from the
// writer) that scores each criterion. The tier is worked out in code from both.
export async function gradeStory(
  title: string,
  draft: StoryDraft,
  storyType: StoryType | undefined,
): Promise<StoryGrade> {
  const checks = quickChecks(draft, storyType);
  const result = await call(
    "storyGrade",
    gradeSystem(storyType),
    gradeMessages(title, draft, storyType),
  );
  const graded = parseGrade(result.text, storyType);
  return combineGrade({
    criteria: graded.criteria,
    checks,
    modelFixes: graded.fixes,
    bankRole: graded.bankRole,
    storyType,
    model: result.model,
    draftWrittenAt: draft.writtenAt,
  });
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
