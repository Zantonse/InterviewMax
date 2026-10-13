import "server-only";
import { generateForStep, type Step } from "@/lib/ai";
import {
  allAnswerText,
  type FollowUp,
  type StoryContent,
  type StoryDraft,
  type TailoredDraft,
} from "./content";
import {
  combineGrade,
  countWords,
  gradeMessages,
  gradeSystem,
  parseGrade,
  lengthRange,
  quickChecks,
  type CheckResult,
  type StoryGrade,
} from "./grading";
import { untracedNumbers } from "./numbers";
import {
  PATH_SYSTEM,
  PREFILL_SYSTEM,
  TAILOR_SYSTEM,
  parsePath,
  parsePrefill,
  parseTailor,
  pathMessages,
  tailorMessages,
  type TailorJob,
  type WriteRetry,
  parseProbe,
  prefillMessages,
  parseWrite,
  probeMessages,
  probeSystem,
  writeMessages,
  writeSystem,
} from "./prompts";
import { INTRO_LENGTH, storyParts, type StoryType } from "./story-types";
import { tailoredChecks, tailoredText } from "./tailored";
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
  resume?: string,
): Promise<FollowUp[]> {
  const { text } = await call(
    "storyProbe",
    probeSystem(storyType, round),
    probeMessages(content, storyType, past, resume),
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

// "Tell me about yourself": read the career path from a resume or LinkedIn profile, to show back for
// the user to confirm. Lines with a number that isn't in the document are dropped.
export async function inferCareerPath(source: string): Promise<string> {
  const { text } = await call("careerPath", PATH_SYSTEM, pathMessages(source));
  return parsePath(text)
    .split("\n")
    .filter((line) => untracedNumbers(line, source).length === 0)
    .join("\n")
    .trim();
}

// Call two: write the story from the user's answers. Every number in the draft is checked
// against the answers in code, and its length against the hard limit; if either fails, the model
// gets up to two chances to fix it. Whatever still doesn't trace is saved on the draft so the
// builder can flag it.
export async function writeStory(
  content: StoryContent,
  storyType: StoryType | undefined,
): Promise<{ title: string; draft: StoryDraft }> {
  const answers = allAnswerText(content);
  const system = writeSystem(storyType);

  const { result, value: story, untraced } = await writeChecked({
    write: (retry) => call("storyWrite", system, writeMessages(content, storyType, retry)),
    parse: (text) => parseWrite(text, storyType),
    script: (story) => draftText(story.parts, storyType),
    answers,
    maxWords: lengthRange(storyType).max,
  });

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

// "Tell me about yourself" for one target job, written company first from the user's answers, why
// they want this company, and the posting. Checked like any story: every number must trace to the
// user's own words (not the posting), and it must fit in 90 seconds.
export async function tailorIntro(
  content: StoryContent,
  storyType: StoryType | undefined,
  job: TailorJob,
  whyCompany: string,
): Promise<{ draft: TailoredDraft; checks: CheckResult[] }> {
  const answers = `${allAnswerText(content)}\n${whyCompany}`;
  const { result, value, untraced } = await writeChecked({
    write: (retry) =>
      call("storyTailor", TAILOR_SYSTEM, tailorMessages(content, storyType, job, whyCompany, retry)),
    parse: parseTailor,
    script: (t) => tailoredText(t.parts),
    answers,
    maxWords: INTRO_LENGTH.max,
  });
  const draft: TailoredDraft = {
    parts: value.parts,
    angle: value.angle,
    untracedNumbers: untraced,
    model: result.model,
    writtenAt: new Date().toISOString(),
  };
  return { draft, checks: tailoredChecks(draft) };
}

// Writes, then checks the numbers and the length in code. Up to two retries: the first fixes
// whatever failed; the second runs only if it still fails.
async function writeChecked<T>(input: {
  write: (retry?: WriteRetry) => Promise<{ text: string; model: string }>;
  parse: (text: string) => T;
  script: (value: T) => string;
  answers: string;
  maxWords: number;
}) {
  let result = await input.write();
  let value = input.parse(result.text);
  for (let attempt = 0; ; attempt++) {
    const script = input.script(value);
    const untraced = untracedNumbers(script, input.answers);
    const count = countWords(script);
    const over = count > input.maxWords;
    if ((untraced.length === 0 && !over) || attempt >= 2) return { result, value, untraced };
    result = await input.write({
      previous: result.text,
      untraced,
      ...(over ? { words: { count, max: input.maxWords } } : {}),
    });
    value = input.parse(result.text);
  }
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
