import { describe, expect, it } from "vitest";
import { bulletsFromReply, checkedSummary, replyProblems } from "./checks";
import {
  UNNAMED_ROLE,
  bulletProblems,
  changedStories,
  checkedRole,
  cleanBullet,
  groupByRole,
  hasFigure,
  isFinishedStory,
  parseResumeSet,
  resumeText,
  type FinishedStory,
  type ResumeBullet,
} from "./content";
import { parseResumeReply, resumeMessages } from "./prompts";

const story = (id: string, source: string, extra: Partial<FinishedStory> = {}): FinishedStory => ({
  id,
  title: `Story ${id}`,
  typeLabel: "A major project or customer",
  story: "Written story.",
  answers: source,
  source,
  draftWrittenAt: "2026-10-15T00:00:00Z",
  ...extra,
});

const bullet = (id: string, extra: Partial<ResumeBullet> = {}): ResumeBullet => ({
  id,
  storyId: "s1",
  storyTitle: "Story",
  role: "Senior AE, Acme",
  text: `Bullet ${id}`,
  fit: "strong",
  why: "",
  picked: true,
  untracedNumbers: [],
  ...extra,
});

describe("cleanBullet", () => {
  it("drops markers, trailing periods and extra spaces", () => {
    expect(cleanBullet("•  Cut churn  by 12%.")).toBe("Cut churn by 12%");
    expect(cleanBullet("1) Led the launch")).toBe("Led the launch");
  });
});

describe("bulletProblems", () => {
  it("flags figures that aren't in the story's answers", () => {
    const problems = bulletProblems(
      "Cut churn by 15% across 40 accounts",
      "We cut churn 12% over 40 accounts",
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"15%"');
  });

  it("matches figures by value, so $2.4M traces to 2.4 million", () => {
    expect(bulletProblems("Closed a $2.4M renewal", "it was worth 2.4 million")).toEqual([]);
  });

  it("flags first person, 'responsible for' and length", () => {
    expect(bulletProblems("I led the launch", "")).toHaveLength(1);
    expect(bulletProblems("Responsible for the launch", "")).toHaveLength(1);
    expect(bulletProblems("Was responsible for the launch", "")).toHaveLength(1);
    expect(bulletProblems(Array(40).fill("word").join(" "), "")).toHaveLength(1);
  });
});

describe("checkedRole", () => {
  it("keeps only the title and employer the user wrote", () => {
    const source = "I was a Senior Account Executive at Acme Corp in 2023.";
    expect(checkedRole("Senior Account Executive", "Acme Corp", source)).toBe(
      "Senior Account Executive, Acme Corp",
    );
    expect(checkedRole("VP of Sales", "Acme Corp", source)).toBe("Acme Corp");
    expect(checkedRole("", "Globex", source)).toBe("");
  });
});

describe("parseResumeReply", () => {
  it("keeps bullets for known stories, at most two each", () => {
    const reply = parseResumeReply(
      JSON.stringify({
        summary: " Seller who  closes. ",
        bullets: [
          { story: "s1", text: "Led A", fit: "strong", why: "x" },
          { story: "s1", text: "Led B", fit: "some" },
          { story: "s1", text: "Led C", fit: "some" },
          { story: "s3", text: "Unknown story" },
          { story: "s2", text: "Led D", fit: "odd" },
          { story: "s2", text: "" },
        ],
      }),
      2,
    );
    expect(reply.summary).toBe("Seller who closes.");
    expect(reply.bullets.map((b) => [b.story, b.text, b.fit])).toEqual([
      [0, "Led A", "strong"],
      [0, "Led B", "some"],
      [1, "Led D", "some"],
    ]);
  });

  it("throws when nothing usable comes back", () => {
    expect(() => parseResumeReply('{"bullets": []}', 2)).toThrow();
  });
});

describe("replyProblems and bulletsFromReply", () => {
  const stories = [
    story("a", "We cut churn 12% at Acme Corp. I was a Senior AE."),
    story("b", "I rebuilt onboarding at Globex for 30 customers."),
  ];

  it("names untraced figures, missing stories and summary figures", () => {
    const problems = replyProblems(
      {
        summary: "Seller with 10 years of experience",
        bullets: [
          { story: 0, title: "", company: "", text: "Cut churn 20%", fit: "strong", why: "" },
        ],
      },
      stories,
      "I've sold for 8 years",
    );
    expect(problems.join("\n")).toContain('"20%"');
    expect(problems.join("\n")).toContain("s2");
    expect(problems.join("\n")).toContain('"10"');
  });

  it("never borrows a figure from another story", () => {
    const problems = replyProblems(
      {
        summary: "",
        bullets: [
          {
            story: 0,
            title: "",
            company: "",
            text: "Cut churn 12% for 30 customers",
            fit: "strong",
            why: "",
          },
          { story: 1, title: "", company: "", text: "Rebuilt onboarding", fit: "some", why: "" },
        ],
      },
      stories,
      "",
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('"30"');
  });

  it("leaves out bullets with untraced figures, orders by fit and checks roles", () => {
    const { bullets, leftOut } = bulletsFromReply(
      {
        bullets: [
          {
            story: 1,
            title: "",
            company: "Globex",
            text: "Rebuilt onboarding for 30 customers",
            fit: "some",
            why: "onboarding",
          },
          {
            story: 0,
            title: "Senior AE",
            company: "Acme Corp",
            text: "Cut churn 12%.",
            fit: "strong",
            why: "renewals",
          },
          { story: 0, title: "", company: "", text: "Grew pipeline 3x", fit: "strong", why: "" },
          {
            story: 1,
            title: "CEO",
            company: "Initech",
            text: "Ran the offsite",
            fit: "none",
            why: "nope",
          },
        ],
      },
      stories,
      "",
    );
    expect(leftOut).toBe(1);
    expect(bullets.map((b) => b.text)).toEqual([
      "Cut churn 12%",
      "Rebuilt onboarding for 30 customers",
      "Ran the offsite",
    ]);
    expect(bullets.map((b) => b.role)).toEqual(["Senior AE, Acme Corp", "Globex", ""]);
    expect(bullets.map((b) => b.picked)).toEqual([true, true, false]);
    expect(bullets[2].why).toBe("");
    expect(bullets[0].storyId).toBe("a");
  });

  it("drops a summary whose figures can't be traced", () => {
    expect(checkedSummary("Seller with 8 years", "8 years selling")).toBe("Seller with 8 years");
    expect(checkedSummary("Seller with 9 years", "8 years selling")).toBe("");
  });
});

describe("groupByRole and resumeText", () => {
  it("groups picked bullets by role, unnamed last, ready to paste", () => {
    const bullets = [
      bullet("1", { role: "" }),
      bullet("2"),
      bullet("3", { role: "PM, Globex" }),
      bullet("4"),
      bullet("5", { picked: false }),
    ];
    const groups = groupByRole(bullets);
    expect(groups.map((g) => [g.role, g.bullets.map((b) => b.id)])).toEqual([
      ["Senior AE, Acme", ["2", "4"]],
      ["PM, Globex", ["3"]],
      [UNNAMED_ROLE, ["1"]],
    ]);
    expect(
      resumeText({
        summary: "Seller who closes.",
        bullets: [bullet("2"), bullet("3", { role: "PM, Globex" })],
      }),
    ).toBe("Seller who closes.\n\nSenior AE, Acme\n• Bullet 2\n\nPM, Globex\n• Bullet 3");
  });
});

describe("changedStories", () => {
  it("counts new, rewritten and removed stories", () => {
    const set = { stories: { a: "t1", b: "t1", c: "t1" } };
    expect(
      changedStories(set, [
        { id: "a", draftWrittenAt: "t1" },
        { id: "b", draftWrittenAt: "t2" },
        { id: "d", draftWrittenAt: "t1" },
      ]),
    ).toBe(3);
  });
});

describe("isFinishedStory", () => {
  const draft = { parts: {}, untracedNumbers: [], model: "", writtenAt: "t" };
  it("reads behavioral stories with a draft only", () => {
    expect(
      isFinishedStory({ storyType: "major_project", content: { version: 1, answers: {}, draft } }),
    ).toBe(true);
    expect(
      isFinishedStory({ storyType: "major_project", content: { version: 1, answers: {} } }),
    ).toBe(false);
    expect(
      isFinishedStory({ storyType: "about_me", content: { version: 1, answers: {}, draft } }),
    ).toBe(false);
    expect(
      isFinishedStory({ storyType: "tough_gap", content: { version: 1, answers: {}, draft } }),
    ).toBe(false);
  });
});

describe("hasFigure", () => {
  it("ignores common words like 'one'", () => {
    expect(hasFigure("Led one of the launches")).toBe(false);
    expect(hasFigure("Cut costs 12%")).toBe(true);
  });
});

describe("parseResumeSet", () => {
  it("reads a stored set defensively", () => {
    const set = parseResumeSet({
      summary: "Seller.",
      summarySource: "tailored",
      bullets: [
        { id: "abc", storyId: "s1", text: "Led A", fit: "none" },
        { storyId: "s2", text: "Led B", fit: "strong", picked: false, edited: true },
        { text: "No story" },
      ],
      stories: { s1: "t", s2: 3 },
      leftOut: 2,
    });
    expect(set?.bullets.map((b) => [b.text, b.fit, b.picked])).toEqual([
      ["Led A", "none", false],
      ["Led B", "strong", false],
    ]);
    expect(set?.bullets[1].edited).toBe(true);
    expect(set?.stories).toEqual({ s1: "t" });
    expect(set?.leftOut).toBe(2);
    expect(parseResumeSet({ bullets: [] })).toBeNull();
  });
});

describe("resumeMessages", () => {
  it("includes the job, each story, numbers, About me and the retry", () => {
    const messages = resumeMessages({
      job: {
        title: "Account Executive",
        company: "Initech",
        level: "senior",
        description: "Own enterprise renewals.",
        focus: ["Enterprise renewals"],
        questions: ["Tell me about a deal you saved"],
      },
      stories: [story("a", "answers a")],
      aboutMe: "",
      numbers: ["Quota: $1.2M"],
      resume: "Senior AE, Acme Corp",
      retry: { previous: "{}", problems: ["fix this"] },
    });
    const text = messages[0].content as string;
    expect(text).toContain("Account Executive at Initech (Senior)");
    expect(text).toContain("### s1");
    expect(text).toContain("Quota: $1.2M");
    expect(text).toContain("Return an empty summary");
    expect(messages).toHaveLength(3);
    expect(messages[2].content).toContain("fix this");
  });
});
