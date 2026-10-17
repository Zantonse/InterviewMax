import { describe, expect, it } from "vitest";
import {
  askedLabel,
  checkQuestion,
  forJob,
  monthOf,
  parseBankRows,
  redactQuestion,
  shareableQuestions,
  speakerNames,
  type BankQuestion,
} from "./content";

const TRANSCRIPT = `Dana Smith: Hi Craig, thanks for joining.
Craig: Thanks Dana.
Dana Smith: So, Craig, tell me about a time you disagreed with your manager.
Craig: Sure...
Speaker 3: Can you write a function to reverse a list?`;

describe("names", () => {
  it("collects speaker names word by word, skipping generic labels", () => {
    expect(speakerNames(TRANSCRIPT, "Craig").sort()).toEqual(["Craig", "Dana", "Smith"]);
    expect(speakerNames("Interviewer: Hi\nMe: Hello", "Me")).toEqual([]);
  });

  it("takes names and chat out of a question", () => {
    expect(redactQuestion("So, Craig, tell me about a time you disagreed with your manager.", ["Craig"])).toBe(
      "Tell me about a time you disagreed with your manager.",
    );
    expect(redactQuestion("Okay Dana, what was Craig's biggest win?", ["Dana", "Craig"])).toBe(
      "What was your biggest win?",
    );
  });
});

describe("checkQuestion", () => {
  it("flags numbers, possible names, emails and links, but not the company or common words", () => {
    expect(checkQuestion("Why do you want to work at Acme Corp?", "Acme Corp")).toEqual([]);
    expect(checkQuestion("How would you grow AI revenue in Q3?", null)).toEqual([]);
    expect(checkQuestion("Tell me about the 2 years you spent with Globex and Priya.", "Acme")).toEqual([
      "Has a number: 2",
      "May name a person, customer or product: Globex, Priya",
    ]);
    expect(checkQuestion("Did you email bob@x.com or see www.x.com?", null)).toEqual([
      "Has an email address",
      "Has a link",
    ]);
  });
});

describe("shareableQuestions", () => {
  it("keeps behavioral questions only, redacted, once each, minus the ones left out", () => {
    const asked = [
      { question: "So, Craig, tell me about a time you disagreed with your manager.", theme: "conflict" as const },
      { question: "Can you write a function to reverse a list?", theme: null },
      { question: "Tell me about a time you failed.", theme: "failure" as const },
      { question: "Tell me about a time you failed.", theme: "failure" as const },
      { question: "Why Acme?", theme: "about_you" as const },
    ];
    const result = shareableQuestions({ asked, transcript: TRANSCRIPT, speaker: "Craig", company: "Acme", excluded: [] });
    expect(result.map((q) => q.question)).toEqual([
      "Tell me about a time you disagreed with your manager.",
      "Tell me about a time you failed.",
    ]);
    const left = shareableQuestions({
      asked,
      transcript: TRANSCRIPT,
      speaker: "Craig",
      company: "Acme",
      excluded: [result[1].sourceKey],
    });
    expect(left).toHaveLength(1);
  });
});

describe("showing the bank", () => {
  const q = (role: string | null, month: string, question = `Q ${role} ${month}`): BankQuestion => ({
    question,
    theme: "impact",
    company: "Acme",
    role,
    level: null,
    round: "hiring_manager",
    askedMonth: month,
  });

  it("labels when and where a question was asked", () => {
    expect(askedLabel(q("Senior PM", "2026-09-01"))).toBe("Asked at Acme for Senior PM, hiring manager, Sep 2026");
    expect(monthOf("2026-10-17T01:00:00Z")).toBe("2026-10-01");
  });

  it("puts the same role first, then newest, once per question", () => {
    const list = forJob(
      [q("Data analyst", "2026-10-01"), q("Senior product manager", "2026-08-01"), q("PM", "2026-09-01", "Q Data analyst 2026-10-01")],
      "Product manager",
    );
    expect(list.map((x) => x.role)).toEqual(["Senior product manager", "Data analyst"]);
  });

  it("reads rows defensively", () => {
    expect(parseBankRows([{ question: "Q?", asked_month: "2026-10-01", theme: "nope" }, { bad: 1 }])).toEqual([
      { question: "Q?", theme: null, company: null, role: null, level: null, round: null, askedMonth: "2026-10-01" },
    ]);
  });
});
