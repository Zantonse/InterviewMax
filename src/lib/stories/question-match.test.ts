import { describe, expect, it } from "vitest";
import { storyTypeForQuestion } from "./question-match";
import { QUESTION_THEMES } from "@/lib/questions/themes";

describe("storyTypeForQuestion", () => {
  it.each([
    ["Tell me about a time you spotted a problem nobody asked you to look for.", "major_project"],
    ["Tell me about fixing a serious data quality problem under audit pressure.", "went_wrong"],
    ["Tell me about a time you disagreed with your manager.", "difficult_stakeholder"],
    [
      "Tell me about a time you had to align Product and Engineering with what you heard from the field.",
      "cross_team",
    ],
    ["How did you decide what to work on with three competing deadlines?", "prioritization"],
    ["How do you use ChatGPT in your work?", "ai_use"],
    ["How do you measure success in your role?", "defining_success"],
    ["Tell me about yourself.", "about_me"],
    ["Describe your favorite piece of work.", "major_project"],
  ])("%s -> %s", (question, type) => {
    expect(storyTypeForQuestion(question)).toBe(type);
  });

  it("puts every library template on one of its theme's story types", () => {
    for (const theme of QUESTION_THEMES) {
      for (const q of theme.templates) {
        expect(theme.storyTypes as readonly string[], q).toContain(storyTypeForQuestion(q));
      }
    }
  });
});

describe("looksLikeQuestion", () => {
  it("spots an interview question typed as the opening answer", async () => {
    const { looksLikeQuestion } = await import("./question-match");
    expect(looksLikeQuestion("Tell me about a time you had to fix a serious data quality problem under audit or regulatory pressure.")).toBe(true);
    expect(looksLikeQuestion("Describe a situation where you influenced another team without authority?")).toBe(true);
    expect(looksLikeQuestion("What was the hardest stakeholder conflict you've handled?")).toBe(true);
  });

  it("leaves real story openings alone", async () => {
    const { looksLikeQuestion } = await import("./question-match");
    expect(looksLikeQuestion("Audit finding: member address mismatches across three systems, 212,000 records.")).toBe(false);
    expect(looksLikeQuestion("I redesigned the onboarding flow for linking a bank account.")).toBe(false);
    expect(looksLikeQuestion("How did we lose Brightwater? I promised a connector we couldn't build in time.")).toBe(false);
    expect(looksLikeQuestion("ok")).toBe(false);
  });
});
