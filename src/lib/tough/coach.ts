import "server-only";
import { generateForStep } from "@/lib/ai";
import { untracedNumbers } from "@/lib/stories/numbers";
import { type ToughJob, TOUGH_SYSTEM, parseToughReply, toughMessages } from "./prompts";
import { type ToughQuestion, checkAnswer } from "./questions";

export type ToughAnswer = {
  answer: string;
  note: string;
  // Numbers in the answer that aren't in the user's own answers. Should be empty.
  untracedNumbers: string[];
  model: string;
};

// Writes the answer, then checks it in code: every number must come from the user's answers, and
// it must be short enough to say in about 40 seconds. One retry with the problem named; if it's
// still off, the answer is kept with its untraced numbers listed for the user to check.
export async function writeToughAnswer(
  question: ToughQuestion,
  answers: Record<string, string>,
  job: ToughJob | null,
): Promise<ToughAnswer> {
  const source = Object.values(answers).join("\n");
  let fix: string | undefined;
  let best: { written: ToughAnswer; problems: number } | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await generateForStep("toughAnswer", {
      system: TOUGH_SYSTEM,
      messages: toughMessages({ question, answers, job, fix }),
    });
    if (result.stopReason === "refusal") throw new Error("The model declined to write this answer.");
    const reply = parseToughReply(result.text);
    const written: ToughAnswer = {
      ...reply,
      untracedNumbers: untracedNumbers(reply.answer, source),
      model: result.model,
    };
    const problems = checkAnswer(written);
    if (!best || problems.length < best.problems) best = { written, problems: problems.length };
    if (problems.length === 0) break;
    fix = problems.join(" ");
  }
  return best!.written;
}
