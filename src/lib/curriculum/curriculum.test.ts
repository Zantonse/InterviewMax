import { describe, expect, it } from "vitest";
import { canUseCurriculum } from "./access";
import {
  MAX_TOPICS,
  byArea,
  carryConfidence,
  parseCurriculum,
  parseTopics,
  progress,
  withConfidence,
  type CurriculumTopic,
} from "./content";
import { curriculumMessages, parseCurriculumReply } from "./prompts";

const topic = (name: string, extra: Partial<CurriculumTopic> = {}): CurriculumTopic => ({
  id:
    name
      .toLowerCase()
      .replace(/[^a-z]/g, "")
      .slice(0, 10) || "topic",
  area: "skills",
  name,
  quote: "",
  basics: ["A point"],
  askedAs: "",
  check: "",
  ...extra,
});

const POSTING = `Senior Product Manager, Payments
You will own the roadmap for partner onboarding and lead pricing experiments across regions.
Experience with SQL and A/B testing is a plus.`;

describe("parseTopics", () => {
  it("keeps valid topics, drops unknown areas, blanks and repeats", () => {
    const list = parseTopics([
      {
        area: "skills",
        name: "  Pricing   experiments ",
        basics: ["What they are", ""],
        confidence: "know",
      },
      { area: "skills", name: "pricing experiments!", basics: ["again"] },
      { area: "nowhere", name: "Lost", basics: ["x"] },
      { area: "tools", name: "SQL", basics: [] },
      { area: "tools", name: "SQL", basics: ["Joins and window functions"], confidence: "maybe" },
    ]);
    expect(list.map((t) => t.name)).toEqual(["Pricing experiments", "SQL"]);
    expect(list[0]).toMatchObject({ basics: ["What they are"], confidence: "know" });
    expect(list[1].confidence).toBeUndefined();
    expect(list[0].id).not.toBe(list[1].id);
  });

  it("caps the list", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      area: "domain",
      name: `Topic ${i}`,
      basics: ["x"],
    }));
    expect(parseTopics(many)).toHaveLength(MAX_TOPICS);
  });

  it("reads nothing from an empty or broken value", () => {
    expect(parseCurriculum(null)).toBeNull();
    expect(parseCurriculum({ topics: [] })).toBeNull();
  });
});

describe("marks", () => {
  it("carries marks onto topics listed again under the same name", () => {
    const next = carryConfidence(
      [topic("Pricing experiments", { confidence: "know" }), topic("SQL", { confidence: "new" })],
      [topic("pricing experiments"), topic("Partner onboarding")],
    );
    expect(next.map((t) => t.confidence)).toEqual(["know", undefined]);
  });

  it("sets and clears a mark", () => {
    const marked = withConfidence(topic("SQL"), "brush_up");
    expect(marked.confidence).toBe("brush_up");
    expect("confidence" in withConfidence(marked, undefined)).toBe(false);
  });

  it("counts what's known and what's left, and groups by area in order", () => {
    const topics = [
      topic("SQL", { area: "tools", confidence: "know" }),
      topic("What the job is for", { area: "role" }),
      topic("Payments", { area: "domain", confidence: "brush_up" }),
    ];
    expect(progress(topics)).toEqual({ known: 1, toStudy: 2 });
    expect(byArea(topics).map((a) => a.id)).toEqual(["role", "tools", "domain"]);
  });
});

describe("the jobCurriculum model step", () => {
  it("keeps quotes found in the posting and drops the rest", () => {
    const reply = JSON.stringify({
      summary: "  Owns payments   partner onboarding. ",
      topics: [
        {
          area: "skills",
          name: "Pricing experiments",
          quote: "lead pricing experiments across regions",
          basics: ["Test one price change at a time"],
          askedAs: "Tell me about an experiment that failed.",
          check: "How would you size a pricing test?",
          confidence: "know",
        },
        {
          area: "domain",
          name: "Interchange fees",
          quote: "understand interchange fees deeply",
          basics: ["What card networks charge"],
        },
      ],
    });
    const { summary, topics } = parseCurriculumReply(`Here:\n${reply}`, POSTING);
    expect(summary).toBe("Owns payments partner onboarding.");
    expect(topics[0].quote).toBe("lead pricing experiments across regions");
    expect(topics[0].confidence).toBeUndefined();
    expect(topics[1].quote).toBe("");
  });

  it("fails when nothing usable comes back", () => {
    expect(() => parseCurriculumReply("no json", POSTING)).toThrow();
    expect(() => parseCurriculumReply(JSON.stringify({ topics: [] }), POSTING)).toThrow(
      "No topics came back.",
    );
  });

  it("sends the posting, level, focus and reports", () => {
    const [msg] = curriculumMessages({
      job: { title: "Senior PM", company: "Acme", level: "senior", description: POSTING },
      focus: ["Partner launches"],
      reports: "Asked a pricing case.",
    });
    const text = msg.content as string;
    expect(text).toContain("Senior PM at Acme (Senior)");
    expect(text).toContain("partner onboarding");
    expect(text).toContain("- Partner launches");
    expect(text).toContain("Asked a pricing case.");
  });
});

describe("access", () => {
  it("is admin-only while in beta", () => {
    process.env.ADMIN_EMAILS = "coach@example.com";
    expect(canUseCurriculum("Coach@example.com")).toBe(true);
    expect(canUseCurriculum("tester@example.com")).toBe(false);
    expect(canUseCurriculum(null)).toBe(false);
  });
});
