import "server-only";
import { generateForStep, type Step } from "@/lib/ai";
import {
  allAnswerText,
  type FollowUp,
  type StoryContent,
  type StoryDraft,
  type TailoredDraft,
} from "./content";
import { FIT_SYSTEM, fitMessages, parseFit, type ContentCheck, type FitJob } from "./fit";
import {
  combineGrade,
  countWords,
  draftText as gradedText,
  gradeMessages,
  gradeSystem,
  introFigures,
  parseGrade,
  lengthRange,
  quickChecks,
  type CheckResult,
  type StoryGrade,
} from "./grading";
import { keepTracedSentences, untracedNumbers } from "./numbers";
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
import { INTRO_LENGTH, INTRO_MAX_FIGURES, storyParts, type StoryType } from "./story-types";
import { tailoredChecks, tailoredText } from "./tailored";
import type { BuilderTargets } from "./targets";
import type { ChatMessage } from "@/lib/ai/types";
import type { StoryNumber } from "@/lib/numbers/checklist";
import type { PastInterviewNotes } from "@/lib/transcripts/content";

// Call one: assess the answers so far and return follow-up questions aimed at the gaps. Round 1
// returns 3–5; round 2 returns up to 3, or none when the answers are already strong.
// Notes from the user's past interview transcripts, when there are any, steer the questions toward
// what real interviewers probed for and what the user's answers kept missing. Their target jobs and
// the role they want next aim the questions at what those jobs' interviewers will look for.
export async function probeStory(
  content: StoryContent,
  storyType: StoryType | undefined,
  round: number,
  past?: PastInterviewNotes,
  resume?: string,
  numbers: StoryNumber[] = [],
  targets?: BuilderTargets,
): Promise<FollowUp[]> {
  const { text } = await call(
    "storyProbe",
    probeSystem(storyType, round, targets),
    probeMessages(content, storyType, past, resume, numbers, targets),
  );
  return parseProbe(text, round);
}

// "Tell me about yourself": answer the scripted questions a LinkedIn profile covers. Sentences with
// a number that isn't in the profile are dropped (not the whole answer: a tenure the model added up
// shouldn't cost the rest), and a question left with nothing is asked as usual.
export async function prefillFromProfile(
  profileText: string,
  source: "linkedin" | "resume" = "linkedin",
): Promise<Record<string, string>> {
  const { text } = await call("storyPrefill", PREFILL_SYSTEM, prefillMessages(profileText, source));
  const answers = parsePrefill(text);
  return Object.fromEntries(
    Object.entries(answers).flatMap(([id, answer]) => {
      const kept = keepTracedSentences(answer, profileText);
      return kept ? [[id, kept]] : [];
    }),
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
// builder can flag it. Values from the user's numbers checklist count as their answers.
export async function writeStory(
  content: StoryContent,
  storyType: StoryType | undefined,
  numbers: StoryNumber[] = [],
): Promise<{ title: string; draft: StoryDraft }> {
  const answers = `${allAnswerText(content)}\n${filledValues(numbers)}`;
  const system = writeSystem(storyType);

  const { result, value: story, untraced } = await writeChecked({
    write: (retry) =>
      call("storyWrite", system, writeMessages(content, storyType, retry, numbers)),
    parse: (text) => parseWrite(text, storyType),
    script: (story) => draftText(story.parts, storyType),
    answers,
    maxWords: lengthRange(storyType).max,
    ...(storyType?.format === "intro" ? { maxFigures: INTRO_MAX_FIGURES } : {}),
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
//
// With target jobs, a second call runs alongside it: the content check (fit.ts), which reads the
// story against the jobs and the user's answers. If only that call fails, the grade still saves.
export async function gradeStory(
  title: string,
  draft: StoryDraft,
  storyType: StoryType | undefined,
  fit?: { answers: string; jobs: FitJob[] },
): Promise<StoryGrade> {
  const checks = quickChecks(draft, storyType);
  const [result, content] = await Promise.all([
    call("storyGrade", gradeSystem(storyType), gradeMessages(title, draft, storyType)),
    fit?.jobs.length ? checkContent(draft, storyType, fit) : undefined,
  ]);
  const graded = parseGrade(result.text, storyType);
  return combineGrade({
    criteria: graded.criteria,
    checks,
    modelFixes: graded.fixes,
    summary: graded.summary,
    strengths: graded.strengths,
    bankRole: graded.bankRole,
    thinking: graded.thinking,
    content,
    storyType,
    model: result.model,
    draftWrittenAt: draft.writtenAt,
  });
}

async function checkContent(
  draft: StoryDraft,
  storyType: StoryType | undefined,
  fit: { answers: string; jobs: FitJob[] },
): Promise<ContentCheck | undefined> {
  try {
    const result = await call(
      "storyGrade",
      FIT_SYSTEM,
      fitMessages({
        storyText: gradedText(draft.parts, storyType),
        answers: fit.answers,
        jobs: fit.jobs,
        storyType,
      }),
    );
    return parseFit(result.text, fit.jobs, result.model);
  } catch (err) {
    console.error("Content check failed", err);
    return undefined;
  }
}

// "Tell me about yourself" for one target job, written company first from the user's answers, why
// they want this company, and the posting. Checked like any story: every number must trace to the
// user's own words (not the posting), and it must fit in 90 seconds.
export async function tailorIntro(
  content: StoryContent,
  storyType: StoryType | undefined,
  job: TailorJob,
  whyCompany: string,
  numbers: StoryNumber[] = [],
): Promise<{ draft: TailoredDraft; checks: CheckResult[] }> {
  const answers = `${allAnswerText(content)}\n${whyCompany}\n${filledValues(numbers)}`;
  const { result, value, untraced } = await writeChecked({
    write: (retry) =>
      call(
        "storyTailor",
        TAILOR_SYSTEM,
        tailorMessages(content, storyType, job, whyCompany, retry, numbers),
      ),
    parse: parseTailor,
    script: (t) => tailoredText(t.parts),
    answers,
    maxWords: INTRO_LENGTH.max,
    maxFigures: INTRO_MAX_FIGURES,
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
  // "Tell me about yourself": more figures than this are sent back to cut.
  maxFigures?: number;
}) {
  let result = await input.write();
  let value = input.parse(result.text);
  for (let attempt = 0; ; attempt++) {
    const script = input.script(value);
    const untraced = untracedNumbers(script, input.answers);
    const count = countWords(script);
    const over = count > input.maxWords;
    const max = input.maxFigures;
    const figures = max === undefined ? [] : introFigures(script);
    const tooMany = max !== undefined && figures.length > max;
    if ((untraced.length === 0 && !over && !tooMany) || attempt >= 2) {
      return { result, value, untraced };
    }
    result = await input.write({
      previous: result.text,
      untraced,
      ...(over ? { words: { count, max: input.maxWords } } : {}),
      ...(tooMany ? { figures: { found: figures, max } } : {}),
    });
    value = input.parse(result.text);
  }
}

// The checklist values the writer was given; they are the user's own words.
function filledValues(numbers: StoryNumber[]): string {
  return numbers.flatMap((n) => (n.value ? [n.value] : [])).join("\n");
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
