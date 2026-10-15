import "server-only";
import { generateForStep } from "@/lib/ai";
import { allAnswerText, type StoryContent } from "@/lib/stories/content";
import { draftText } from "@/lib/stories/grading";
import { untracedNumbers } from "@/lib/stories/numbers";
import { answersTranscript } from "@/lib/stories/prompts";
import type { StoryType } from "@/lib/stories/story-types";
import { type BuilderTargets, hasTargets, targetsTranscript } from "@/lib/stories/targets";
import { checkedDetail, replyText, tellingProblems } from "./checks";
import { draftChecks, roleWordsFrom, type StoryTelling } from "./content";
import { TELL_SYSTEM, parseTellReply, tellMessages, type TellReply } from "./prompts";

// Coaches one written story (see content.ts). The reply is checked in code: every figure must trace
// to the user's answers, each version must fit its length, the vivid detail must be quoted from
// their answers, and each version must pass the setup, buried-result and ending checks. One retry
// with the problems named; whatever is still off is kept, with untraced figures listed for the user.
export async function coachTelling(input: {
  title: string;
  content: StoryContent;
  storyType: StoryType | undefined;
  targets: BuilderTargets | undefined;
  // Values from the numbers checklist; they count as the user's own words.
  extraAnswers?: string;
}): Promise<StoryTelling> {
  const { content, storyType } = input;
  const draft = content.draft;
  if (!draft) throw new Error("Write the story first.");
  const answers = `${allAnswerText(content)}\n${input.extraAnswers ?? ""}`;
  const base = {
    title: input.title,
    story: draftText(draft.parts, storyType),
    answers: answersTranscript(content, storyType),
    thinking: content.grade?.thinking,
    targets: hasTargets(input.targets) ? targetsTranscript(input.targets) : "",
  };

  let best: { reply: TellReply; model: string; problems: string[] } | undefined;
  let retry: { previous: string; problems: string[] } | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generateForStep("storyTell", {
      system: TELL_SYSTEM,
      messages: tellMessages({ ...base, retry }),
    });
    if (result.stopReason === "refusal") throw new Error("The model declined to coach this story.");
    const reply = parseTellReply(result.text);
    const problems = tellingProblems(reply, answers);
    if (!best || problems.length < best.problems.length) {
      best = { reply, model: result.model, problems };
    }
    if (problems.length === 0) break;
    retry = { previous: result.text, problems };
  }

  const { reply, model } = best!;
  const roleWords = roleWordsFrom(input.targets?.jobs ?? []);
  return {
    hooks: reply.hooks,
    hookIndex: 0,
    detail: checkedDetail(reply.detail, answers),
    versions: reply.versions,
    draftChecks: draftChecks(draft.parts, storyType, roleWords),
    untracedNumbers: untracedNumbers(replyText(reply), answers),
    model,
    draftWrittenAt: draft.writtenAt,
    coachedAt: new Date().toISOString(),
  };
}
