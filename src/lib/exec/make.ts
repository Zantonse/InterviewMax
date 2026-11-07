import "server-only";
import { generateForStep } from "@/lib/ai";
import { allAnswerText, type StoryContent } from "@/lib/stories/content";
import { draftText } from "@/lib/stories/grading";
import { untracedNumbers } from "@/lib/stories/numbers";
import { ownWordsShare } from "@/lib/stories/own-words";
import { answersTranscript } from "@/lib/stories/prompts";
import type { StoryType } from "@/lib/stories/story-types";
import { execProblems, execText, type ExecVersion } from "./content";
import { EXEC_SYSTEM, execMessages, parseExecReply, type ExecReply } from "./prompts";

// Makes the exec version of one written story (see content.ts). The reply is checked in code:
// figures trace to the user's answers, length, the result up front, no hedging and enough of the
// user's own words. One retry with the problems named; whatever is still off is kept, with
// untraced figures listed for the user.
export async function makeExecVersion(input: {
  title: string;
  content: StoryContent;
  storyType: StoryType | undefined;
  // Values from the numbers checklist; they count as the user's own words.
  extraAnswers?: string;
}): Promise<ExecVersion> {
  const { content, storyType } = input;
  const draft = content.draft;
  if (!draft) throw new Error("Write the story first.");
  const story = draftText(draft.parts, storyType);
  if (!story.trim()) throw new Error("Write the story first.");
  const answers = `${allAnswerText(content)}\n${input.extraAnswers ?? ""}`;
  const base = {
    title: input.title,
    storyType: storyType?.label,
    story,
    answers: answersTranscript(content, storyType),
    asked: content.asked,
  };

  let best: { reply: ExecReply; model: string; problems: string[]; ownWords: number } | undefined;
  let retry: { previous: string; problems: string[] } | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generateForStep("storyExec", {
      system: EXEC_SYSTEM,
      messages: execMessages({ ...base, retry }),
    });
    if (result.stopReason === "refusal") throw new Error("The model declined to shorten this story.");
    const reply = parseExecReply(result.text);
    const ownWords = ownWordsShare(execText(reply), answers);
    const problems = execProblems(reply, { story, answers, ownWords });
    if (!best || problems.length < best.problems.length) {
      best = { reply, model: result.model, problems, ownWords };
    }
    if (problems.length === 0) break;
    retry = { previous: result.text, problems };
  }

  const { reply, model, ownWords } = best!;
  const askText = reply.ifAsked.map((a) => a.answer ?? "").join(" ");
  return {
    ...reply,
    untracedNumbers: untracedNumbers(`${execText(reply)} ${askText}`, answers),
    ownWords,
    model,
    draftWrittenAt: draft.writtenAt,
    madeAt: new Date().toISOString(),
  };
}
