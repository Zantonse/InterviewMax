import { describe, expect, it } from "vitest";
import { STEP_MODELS } from "@/lib/ai/config";
import { FIELD_STEPS } from "@/lib/field/fields";
import { AI_STEP_USES } from "@/lib/privacy/ai-steps";
import { emptyContent, parseContent } from "@/lib/stories/content";
import {
  execChecks,
  execIsCurrent,
  execProblems,
  execSeconds,
  execText,
  findHedges,
  parseExecVersion,
  type ExecVersion,
} from "./content";
import { EXEC_SYSTEM, execMessages, parseExecReply } from "./prompts";

const story =
  "Our onboarding took six weeks and new reps were missing their first quarter. I think the handoff was the problem, so I kind of rebuilt it. I moved the product demo into week one. Onboarding dropped to 2 weeks and 14 reps hit quota in their first quarter.";
const answers =
  "onboarding took six weeks and new reps were missing their first quarter. I moved the product demo into week one. onboarding dropped to 2 weeks and 14 reps hit quota in their first quarter. my rule is to fix the handoff before adding people.";

const good = {
  bottomLine: "Onboarding dropped to 2 weeks and 14 reps hit quota in their first quarter.",
  why: "Onboarding took six weeks and new reps were missing their first quarter.",
  how: "My rule is to fix the handoff before adding people, so I moved the product demo into week one.",
  ifAsked: [
    { question: "How did you know it worked?", answer: "14 reps hit quota in their first quarter." },
    { question: "What did it cost?", answer: null },
  ],
};

const saved: ExecVersion = {
  ...good,
  untracedNumbers: [],
  ownWords: 0.9,
  model: "deepseek/deepseek-v4.1-flash",
  draftWrittenAt: "2026-11-07T00:00:00Z",
  madeAt: "2026-11-07T00:01:00Z",
};

describe("exec version checks", () => {
  it("passes a short, answer-first, plain version", () => {
    const ownWords = 0.9;
    expect(execProblems(good, { story, answers, ownWords })).toEqual([]);
    expect(execChecks(good, { story, answers }).every((c) => c.passed)).toBe(true);
  });

  it("sends back a version that buries the result, hedges, invents a figure or runs long", () => {
    const bad = {
      ...good,
      bottomLine: "Our onboarding was slow, so I basically rebuilt it.",
      how: `${"I moved the product demo into week one and saved 30%. ".repeat(6)}`,
    };
    const problems = execProblems(bad, { story, answers, ownWords: 0.1 }).join("\n");
    expect(problems).toMatch(/result with its number/);
    expect(problems).toMatch(/30%/);
    expect(problems).toMatch(/"basically"/);
    expect(problems).toMatch(/under 80/);
    expect(problems).toMatch(/own words/);
  });

  it("doesn't ask for a number when the story has none", () => {
    const plain = "I rebuilt how we hand off new reps. It went much better.";
    const v = { ...good, bottomLine: "I rebuilt how we hand off new reps, and it went much better." };
    const first = execChecks(v, { story: plain, answers: plain }).find((c) => c.id === "first")!;
    expect(first.passed).toBe(true);
    expect(first.note).toMatch(/no number/);
  });

  it("finds hedges in the written story, most used first, as whole words", () => {
    expect(findHedges(story)).toEqual([
      { hedge: "i think", count: 1 },
      { hedge: "kind of", count: 1 },
    ]);
    expect(findHedges("Maybe. I think, maybe not. Kindness of strangers.")).toEqual([
      { hedge: "maybe", count: 2 },
      { hedge: "i think", count: 1 },
    ]);
  });

  it("times the three lines at about 150 words a minute", () => {
    expect(execSeconds(execText(good))).toBeGreaterThanOrEqual(15);
    expect(execSeconds(execText(good))).toBeLessThanOrEqual(30);
  });
});

describe("exec version storage", () => {
  it("round-trips through story content and goes stale with the draft", () => {
    const content = parseContent({ ...emptyContent(), exec: saved });
    expect(content.exec).toEqual(saved);
    expect(execIsCurrent(content.exec, "2026-11-07T00:00:00Z")).toBe(true);
    expect(execIsCurrent(content.exec, "2026-11-08T00:00:00Z")).toBe(false);
    expect(parseExecVersion({ why: "no bottom line" })).toBeUndefined();
  });
});

describe("exec version prompt", () => {
  it("parses the reply, keeping open questions open and capping at three", () => {
    const reply = parseExecReply(
      `Here you go: ${JSON.stringify({
        ...good,
        ifAsked: [...good.ifAsked, { question: "Risk?", answer: "" }, { question: "Fourth?", answer: "x" }],
      })}`,
    );
    expect(reply.bottomLine).toBe(good.bottomLine);
    expect(reply.ifAsked.map((a) => a.answer)).toEqual([good.ifAsked[0].answer, null, null]);
    expect(() => parseExecReply("{}")).toThrow();
  });

  it("puts the answer first, keeps the user's words and names the retry problems", () => {
    expect(EXEC_SYSTEM).toMatch(/answer first/i);
    expect(EXEC_SYSTEM).toMatch(/own phrasing/);
    expect(EXEC_SYSTEM).toMatch(/how the candidate thinks/);
    const messages = execMessages({
      title: "Onboarding",
      story,
      answers,
      asked: "Tell me about a time you improved a process.",
      retry: { previous: "{}", problems: ["Drop the hedging words."] },
    });
    expect(messages).toHaveLength(3);
    expect(messages[0].content).toContain("improved a process");
    expect(messages[2].content).toContain("Drop the hedging words.");
  });

  it("is a listed, field-aware model step", () => {
    expect(STEP_MODELS.storyExec.model).toBe("deepseek/deepseek-v4.1-flash");
    expect(AI_STEP_USES.storyExec.feature).toMatch(/Exec version/);
    expect(FIELD_STEPS).toContain("storyExec");
  });
});
