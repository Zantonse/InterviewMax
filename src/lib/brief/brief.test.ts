import { describe, expect, it } from "vitest";
import type { NumbersChecklist } from "@/lib/numbers/checklist";
import type { LikelyQuestion } from "@/lib/questions/content";
import type { StoryContent } from "@/lib/stories/content";
import { buildBrief, firstSentence, storyReminder, warmUpCards } from "./brief";

const content = (extra: Partial<StoryContent> = {}) =>
  ({ version: 1, answers: {}, ...extra }) as StoryContent;
const draft = (parts: Record<string, string>) => ({
  parts,
  untracedNumbers: [],
  model: "m",
  writtenAt: "2026-10-15T00:00:00Z",
});
const q = (question: string, theme: string): LikelyQuestion => ({
  question,
  theme: theme as LikelyQuestion["theme"],
  why: "",
  source: "common",
  specific: false,
});

const JOB = {
  id: "job-1",
  title: "Senior PM",
  company: "Acme",
  likelyQuestions: {
    questions: [
      q("Tell me about yourself.", "about_you"),
      q("Tell me about your biggest impact.", "impact"),
      q("Tell me about a conflict.", "conflict"),
      q("Tell me about a failure.", "failure"),
    ],
  },
};

const INTRO = {
  id: "s-intro",
  title: "Tell me about yourself",
  storyType: "about_me",
  content: content({
    draft: draft({ present: "I lead product at Beta.", highlight: "I grew revenue 40%." }),
    tailored: {
      "job-1": {
        whyCompany: "Acme is rebuilding its billing.",
        draft: {
          ...draft({
            who: "I'm a PM who fixes billing.",
            proof: "At Beta I cut churn 12%. It took a year.",
            why_here: "Acme's rebuild is that work.",
          }),
          angle: "",
        },
      },
    },
  }),
};

const PROJECT = {
  id: "s-project",
  title: "The billing migration",
  storyType: "major_project",
  content: content({
    draft: draft({
      situation: "Billing was failing.",
      result: "We moved 3.2M accounts with zero downtime. Everyone was happy.",
    }),
  }),
};

const CONFLICT_STARTED = {
  id: "s-conflict",
  title: "The VP who said no",
  storyType: "difficult_stakeholder",
  content: content({ answers: { start: "A VP blocked it." } }),
};

const TOUGH = {
  id: "s-tough",
  title: "Why I'm leaving",
  storyType: "tough_why_leaving",
  content: content({ draft: draft({ answer: "I want to own a product end to end." }) }),
};

const NUMBERS: NumbersChecklist = {
  familyId: null,
  roleName: "Product",
  items: [
    { id: "a", label: "Team size", why: "", where: "", storyTypes: ["cross_team"] },
    { id: "b", label: "Accounts migrated", why: "", where: "", storyTypes: ["major_project"] },
    { id: "c", label: "Budget", why: "", where: "", storyTypes: [] },
    { id: "d", label: "Empty", why: "", where: "", storyTypes: [] },
  ],
  values: { a: "8 engineers", b: "3.2M", c: "$1M" },
  updatedAt: "",
};

const stories = [INTRO, PROJECT, CONFLICT_STARTED, TOUGH];

describe("buildBrief", () => {
  const brief = buildBrief({ job: JOB, stories, numbers: NUMBERS });

  it("uses this job's About me, with the user's why-this-company", () => {
    expect(brief.intro).toMatchObject({
      kind: "tailored",
      whyCompany: "Acme is rebuilding its billing.",
      paragraphs: [
        "I'm a PM who fixes billing.",
        "At Beta I cut churn 12%. It took a year.",
        "Acme's rebuild is that work.",
      ],
    });
  });

  it("falls back to the general About me for a job without its own", () => {
    const other = buildBrief({ job: { ...JOB, id: "job-2" }, stories, numbers: null });
    expect(other.intro?.kind).toBe("general");
    expect(other.intro?.paragraphs).toEqual(["I lead product at Beta.", "I grew revenue 40%."]);
  });

  it("pairs each question with its story and a one-line reminder", () => {
    expect(brief.questions[1].story).toMatchObject({
      title: "The billing migration",
      drafted: true,
      reminder: "We moved 3.2M accounts with zero downtime.",
    });
    expect(brief.questions[0].story?.reminder).toBe("At Beta I cut churn 12%.");
    expect(brief.questions[0].story?.href).toBe("/jobs/job-1#about-me");
  });

  it("lists questions without a written story as gaps", () => {
    expect(brief.gaps.map((g) => g.question)).toEqual([
      "Tell me about a conflict.",
      "Tell me about a failure.",
    ]);
    expect(brief.questions[2].story?.drafted).toBe(false);
    expect(brief.questions[3].buildType).toBe("went_wrong");
  });

  it("shows filled numbers only, those that suit the brief's stories first", () => {
    expect(brief.numbers.map((n) => n.id)).toEqual(["b", "c", "a"]);
  });

  it("includes written tough answers", () => {
    expect(brief.tough).toEqual([
      {
        id: "s-tough",
        question: "Why are you leaving?",
        answer: "I want to own a product end to end.",
        href: "/tough-questions/s-tough",
      },
    ]);
  });

  it("works with nothing but the job", () => {
    const empty = buildBrief({
      job: { ...JOB, likelyQuestions: null },
      stories: [],
      numbers: null,
    });
    expect(empty).toMatchObject({ intro: null, questions: [], gaps: [], numbers: [], tough: [] });
  });
});

describe("warmUpCards", () => {
  it("About me, three numbers, then the top three questions after About me", () => {
    const cards = warmUpCards(buildBrief({ job: JOB, stories, numbers: NUMBERS }));
    expect(cards.map((c) => c.kind)).toEqual([
      "intro",
      "numbers",
      "question",
      "question",
      "question",
    ]);
    const numbers = cards[1];
    expect(numbers.kind === "numbers" && numbers.numbers).toHaveLength(3);
    expect(cards.flatMap((c) => (c.kind === "question" ? [c.question.question] : []))).toEqual([
      "Tell me about your biggest impact.",
      "Tell me about a conflict.",
      "Tell me about a failure.",
    ]);
  });

  it("keeps the About me question when there's no About me to show", () => {
    const cards = warmUpCards(buildBrief({ job: JOB, stories: [PROJECT], numbers: null }));
    expect(cards[0]).toMatchObject({ kind: "question", question: { theme: "about_you" } });
  });
});

describe("storyReminder and firstSentence", () => {
  it("keeps figures with decimals whole", () => {
    expect(firstSentence("Revenue grew to $2.4M in Q3. Then more.")).toBe(
      "Revenue grew to $2.4M in Q3.",
    );
  });

  it("cuts a long sentence to one line", () => {
    const long = `${"word ".repeat(60)}end.`;
    const line = firstSentence(long);
    expect(line.length).toBeLessThanOrEqual(161);
    expect(line.endsWith("…")).toBe(true);
  });

  it("is empty for an unwritten story", () => {
    expect(storyReminder(CONFLICT_STARTED)).toBe("");
  });
});

describe("questions to ask in the brief", () => {
  const ask = (id: string, question: string, audience: string, saved: boolean) => ({
    id,
    question,
    audience: audience as "peer",
    why: "",
    saved,
  });

  it("shows saved questions grouped by audience and counts the unsaved ones", () => {
    const brief = buildBrief({
      job: {
        ...JOB,
        questionsToAsk: {
          model: "m",
          generatedAt: "",
          questions: [
            ask("a1", "How do launches get picked?", "hiring_manager", true),
            ask("a2", "What's next in the process?", "recruiter", true),
            ask("a3", "Unsaved one?", "peer", false),
          ],
        },
      },
      stories: [],
      numbers: null,
    });
    expect(brief.ask.groups).toEqual([
      { audience: "recruiter", label: "Recruiter", questions: ["What's next in the process?"] },
      {
        audience: "hiring_manager",
        label: "Hiring manager",
        questions: ["How do launches get picked?"],
      },
    ]);
    expect(brief.ask.unsaved).toBe(1);
  });

  it("is empty for a job with none", () => {
    const brief = buildBrief({ job: JOB, stories: [], numbers: null });
    expect(brief.ask).toEqual({ groups: [], unsaved: 0 });
  });
});
