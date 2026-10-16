import { describe, expect, it } from "vitest";
import {
  MAX_ASK_QUESTIONS,
  isOfferStageQuestion,
  mergeSuggestions,
  parseAskList,
  parseQuestionsToAsk,
  savedByAudience,
  type AskQuestion,
} from "./content";
import { askQuestionsMessages, parseAskQuestionsReply } from "./prompts";

const q = (id: string, question: string, extra: Partial<AskQuestion> = {}): AskQuestion => ({
  id,
  question,
  audience: "hiring_manager",
  why: "",
  saved: false,
  ...extra,
});

describe("parseAskList", () => {
  it("keeps valid questions, drops blanks and repeats, defaults the audience", () => {
    const list = parseAskList([
      {
        id: "a1b2c3",
        question: "  What does success look like  in 90 days? ",
        audience: "peer",
        saved: true,
      },
      { question: "what does success look like in 90 days" },
      { question: "" },
      { question: 42 },
      { question: "How is the team organised?", audience: "nobody" },
    ]);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      id: "a1b2c3",
      question: "What does success look like in 90 days?",
      audience: "peer",
      saved: true,
    });
    expect(list[1]).toMatchObject({ audience: "hiring_manager", saved: false });
    expect(list[1].id).toMatch(/^[a-z0-9]+$/);
  });

  it("caps the list and gives duplicate ids new ones", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      id: "same-id",
      question: `Question ${i}?`,
    }));
    const list = parseAskList(many);
    expect(list).toHaveLength(MAX_ASK_QUESTIONS);
    expect(new Set(list.map((x) => x.id)).size).toBe(MAX_ASK_QUESTIONS);
  });

  it("reads nothing from an empty or broken value", () => {
    expect(parseQuestionsToAsk(null)).toBeNull();
    expect(parseQuestionsToAsk({ questions: [] })).toBeNull();
  });
});

describe("mergeSuggestions", () => {
  it("keeps saved and own questions, replaces unsaved suggestions, skips repeats", () => {
    const kept = [
      q("s1", "How will you measure the partner launch?", { saved: true }),
      q("u1", "Old unsaved suggestion?"),
      q("m1", "Who would I work with most?", { mine: true }),
    ];
    const fresh = [
      q("n1", "How will you measure the partner launch?"),
      q("n2", "What changed when the team moved to quarterly planning?", {
        audience: "peer",
      }),
    ];
    const merged = mergeSuggestions(kept, fresh);
    expect(merged.map((x) => x.id)).toEqual(["s1", "m1", "n2"]);
    expect(merged[2].saved).toBe(false);
  });
});

describe("savedByAudience", () => {
  it("groups saved questions in audience order", () => {
    const groups = savedByAudience([
      q("a", "Peer question?", { audience: "peer", saved: true }),
      q("b", "Recruiter question?", { audience: "recruiter", saved: true }),
      q("c", "Not saved?", { audience: "executive" }),
    ]);
    expect(groups.map((g) => g.label)).toEqual(["Recruiter", "Future teammate"]);
  });
});

describe("the askQuestions model step", () => {
  it("drops pay and benefits questions and marks the rest unsaved", () => {
    const reply = JSON.stringify({
      questions: [
        {
          question: "What's the salary range?",
          audience: "recruiter",
          why: "",
        },
        {
          question: "How does the team pick which partner launches to back?",
          audience: "hiring_manager",
          why: "posting leads with partner launches",
        },
        {
          question: "What does a normal week look like?",
          audience: "peer",
          why: "",
          saved: true,
        },
      ],
    });
    const list = parseAskQuestionsReply(`Here you go:\n${reply}`);
    expect(list.map((x) => x.question)).toEqual([
      "How does the team pick which partner launches to back?",
      "What does a normal week look like?",
    ]);
    expect(list.every((x) => !x.saved && !x.mine)).toBe(true);
  });

  it("fails when nothing usable comes back", () => {
    expect(() => parseAskQuestionsReply("no json")).toThrow();
    expect(() =>
      parseAskQuestionsReply(
        JSON.stringify({ questions: [{ question: "What are the benefits?" }] }),
      ),
    ).toThrow("No questions came back.");
  });

  it("spots offer-stage questions without catching ordinary words", () => {
    expect(isOfferStageQuestion("Is there a bonus?")).toBe(true);
    expect(isOfferStageQuestion("How much paid time off is there?")).toBe(true);
    expect(isOfferStageQuestion("How does the payments team work with risk?")).toBe(false);
  });

  it("sends the posting, focus, reports and existing questions", () => {
    const [msg] = askQuestionsMessages({
      job: {
        title: "Senior PM",
        company: "Acme",
        level: null,
        description: "Lead partner launches.",
      },
      focus: ["Partner launches"],
      reports: "Asked about prioritisation.",
      existing: ["Who would I work with most?"],
    });
    const text = msg.content as string;
    expect(text).toContain("Senior PM at Acme");
    expect(text).toContain("Lead partner launches.");
    expect(text).toContain("- Partner launches");
    expect(text).toContain("Asked about prioritisation.");
    expect(text).toContain("- Who would I work with most?");
  });
});
