import { describe, expect, it } from "vitest";
import { STEP_MODELS } from "@/lib/ai/config";
import { FIELD_STEPS } from "@/lib/field/fields";
import { AI_STEP_USES } from "@/lib/privacy/ai-steps";
import { emptyContent, parseContent } from "@/lib/stories/content";
import {
  findJargon,
  parseRecruiterVersion,
  recruiterChecks,
  recruiterIsCurrent,
  recruiterProblems,
  recruiterSeconds,
  recruiterText,
  type RecruiterVersion,
} from "./content";
import { RECRUITER_SYSTEM, parseRecruiterReply, recruiterMessages } from "./prompts";

const story =
  "Our nightly ETL kept failing and the sales dashboards were stale every Monday. I rebuilt the load so it retried each step. Failures dropped from 12 a month to 1 and sales trusted the numbers again.";
const answers =
  "our nightly job that loads sales data kept failing and the sales dashboards were stale every Monday. I rebuilt the load so it retried each step. failures dropped from 12 a month to 1 and sales trusted the numbers again.";

const good = {
  headline: "Failures dropped from 12 a month to 1 and sales trusted the numbers again.",
  context: "Our nightly job that loads sales data kept failing, so the dashboards were stale every Monday.",
  part: "I rebuilt the load so it retried each step.",
  saveFor: ["How the retries work", "Winning over the sales team"],
};

const saved: RecruiterVersion = {
  ...good,
  untracedNumbers: [],
  ownWords: 0.9,
  model: "deepseek/deepseek-v4.1-flash",
  draftWrittenAt: "2026-11-14T00:00:00Z",
  madeAt: "2026-11-14T00:01:00Z",
};

describe("recruiter version checks", () => {
  it("passes a short, plain, result-first version", () => {
    expect(recruiterProblems(good, { story, answers, ownWords: 0.9 })).toEqual([]);
    expect(recruiterChecks(good, { story, answers }).every((c) => c.passed)).toBe(true);
  });

  it("sends back jargon, a buried result, an invented figure and a long version", () => {
    const bad = {
      ...good,
      headline: "Our ETL kept failing, so I fixed the DAG.",
      part: "I rebuilt the load and cut costs 40%. ".repeat(12),
    };
    const problems = recruiterProblems(bad, { story, answers, ownWords: 0.1 }).join("\n");
    expect(problems).toMatch(/ETL, DAG/);
    expect(problems).toMatch(/result with its number/);
    expect(problems).toMatch(/40%/);
    expect(problems).toMatch(/under 120/);
    expect(problems).toMatch(/own words/);
  });

  it("lets everyday acronyms through", () => {
    expect(findJargon("The CEO asked HR and the VP for an AI plan in Q3 at our SLAs team.")).toEqual([
      "SLA",
    ]);
  });

  it("times the three lines at about 150 words a minute", () => {
    expect(recruiterSeconds(recruiterText(good))).toBeLessThanOrEqual(60);
  });
});

describe("recruiter version storage", () => {
  it("round-trips through story content and goes stale with the draft", () => {
    const content = parseContent({ ...emptyContent(), recruiter: saved });
    expect(content.recruiter).toEqual(saved);
    expect(recruiterIsCurrent(content.recruiter, "2026-11-14T00:00:00Z")).toBe(true);
    expect(recruiterIsCurrent(content.recruiter, "2026-11-15T00:00:00Z")).toBe(false);
    expect(parseRecruiterVersion({ context: "no headline" })).toBeUndefined();
  });
});

describe("recruiter version prompt", () => {
  it("parses the reply and caps what to save at three", () => {
    const reply = parseRecruiterReply(
      `Sure: ${JSON.stringify({ ...good, saveFor: ["a", "", "b", "c", "d"] })}`,
    );
    expect(reply.headline).toBe(good.headline);
    expect(reply.saveFor).toEqual(["a", "b", "c"]);
    expect(() => parseRecruiterReply("{}")).toThrow();
  });

  it("asks for plain words and the result first, and names the retry problems", () => {
    expect(RECRUITER_SYSTEM).toMatch(/recruiter screen/);
    expect(RECRUITER_SYSTEM).toMatch(/Plain words/);
    expect(RECRUITER_SYSTEM).toMatch(/hiring manager/);
    const messages = recruiterMessages({
      title: "Nightly load",
      story,
      answers,
      retry: { previous: "{}", problems: ["Say what ETL is."] },
    });
    expect(messages).toHaveLength(3);
    expect(messages[2].content).toContain("Say what ETL is.");
  });

  it("is a listed, field-aware model step", () => {
    expect(STEP_MODELS.storyRecruiter.model).toBe("deepseek/deepseek-v4.1-flash");
    expect(AI_STEP_USES.storyRecruiter.feature).toMatch(/Recruiter version/);
    expect(FIELD_STEPS).toContain("storyRecruiter");
  });
});
