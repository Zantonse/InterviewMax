import { describe, expect, it } from "vitest";
import type { FinishedStory } from "@/lib/resume/content";
import { emptyContent, type StoryContent } from "@/lib/stories/content";
import type { StoryGrade } from "@/lib/stories/grading";
import {
  DEFAULT_DIMENSIONS,
  DEFAULT_PLACEHOLDER,
  barRole,
  cleanRedactions,
  gapMap,
  nextLevel,
  packetIsStale,
  parsePlan,
  parseRedactionLines,
  redact,
} from "./content";
import { dimensionsFromReply } from "./ladder";
import { checkedPacket, packetProblems, parsePacketReply } from "./packet";

const WRITTEN = "2026-10-18T00:00:00Z";

function drafted(role?: string): StoryContent {
  return {
    ...emptyContent(),
    followUps: [],
    draft: { parts: {}, untracedNumbers: [], model: "test", writtenAt: WRITTEN },
    ...(role
      ? {
          grade: {
            tier: "good_enough",
            fixes: [],
            strengths: [],
            criteria: [],
            checks: [],
            flags: [],
            model: "test",
            draftWrittenAt: WRITTEN,
            gradedAt: WRITTEN,
            bankRole: { role, note: "" },
          } as unknown as StoryGrade,
        }
      : {}),
  } as StoryContent;
}

const story = (id: string, storyType: string, content = emptyContent()) => ({
  id,
  title: id,
  storyType,
  content,
});

describe("levels", () => {
  it("steps up one level and holds the top", () => {
    expect(nextLevel("mid")).toBe("senior");
    expect(nextLevel("senior")).toBe("principal");
    expect(nextLevel("principal")).toBe("principal");
  });

  it("sets the bar at the widest scope the level mix asks for", () => {
    expect(barRole("mid")).toBe("team-level impact");
    expect(barRole("senior")).toBe("organization-level impact");
    expect(barRole("principal")).toBe("organization-level impact");
  });
});

describe("gapMap", () => {
  it("uses the generic dimensions with no ladder and marks them all empty with no stories", () => {
    const map = gapMap([], { redactions: [], targetLevel: "principal" });
    expect(map.map((e) => e.dimension.id)).toEqual(DEFAULT_DIMENSIONS.map((d) => d.id));
    expect(map.every((e) => e.status === "empty")).toBe(true);
    expect(map[0].build).toBe("major_project");
  });

  it("tells a story at the target level from one at the current level only", () => {
    const map = gapMap(
      [
        story("big", "major_project", drafted("organization-level impact")),
        story("team", "cross_team", drafted("team-level impact")),
        story("fresh", "difficult_stakeholder", drafted()),
        story("started", "went_wrong"),
      ],
      { redactions: [], targetLevel: "principal" },
    );
    const by = Object.fromEntries(map.map((e) => [e.dimension.id, e.status]));
    expect(by.scope).toBe("at_target");
    expect(by.collaboration).toBe("current_only");
    // Influence draws on stakeholder and cross-team stories: the best one sets its status.
    expect(by.influence).toBe("current_only");
    expect(map.find((e) => e.dimension.id === "influence")?.stories.map((s) => s.status)).toEqual([
      "current_only",
      "not_graded",
    ]);
    expect(by.growth).toBe("in_progress");
  });

  it("leaves About me and tough answers out of the evidence", () => {
    const map = gapMap([story("me", "about_me", drafted("organization-level impact"))], {
      redactions: [],
      targetLevel: "senior",
    });
    expect(map.every((e) => e.stories.length === 0)).toBe(true);
  });

  it("uses a pasted ladder's dimensions", () => {
    const plan = parsePlan({
      targetLevel: "senior",
      ladder: {
        text: "…",
        dimensions: [
          { id: "craft", label: "Technical craft", expects: "x", themes: ["ownership"] },
        ],
      },
    });
    expect(gapMap([], plan).map((e) => e.dimension.label)).toEqual(["Technical craft"]);
  });
});

describe("redaction", () => {
  const redactions = cleanRedactions([
    { name: "Acme Bank", placeholder: "a large bank" },
    { name: "Acme Bank Europe", placeholder: "a European bank" },
    { name: "Falcon", placeholder: "" },
  ]);

  it("swaps whole names, longest first, ignoring case", () => {
    expect(redact("We won acme bank europe, then Acme Bank. Falconry stays.", redactions)).toBe(
      "We won a European bank, then a large bank. Falconry stays.",
    );
    expect(redact("Project Falcon shipped", redactions)).toBe(
      `Project ${DEFAULT_PLACEHOLDER} shipped`,
    );
  });

  it("never lets a stand-in hold a number or the name itself", () => {
    const [a, b] = cleanRedactions([
      { name: "Globex", placeholder: "a Fortune 500 customer" },
      { name: "Initech", placeholder: "Initech Corp" },
    ]);
    expect(a.placeholder).toBe(DEFAULT_PLACEHOLDER);
    expect(b.placeholder).toBe(DEFAULT_PLACEHOLDER);
  });

  it("reads one Name = stand-in per line and drops repeats", () => {
    expect(parseRedactionLines("Acme = a bank\n\nacme = other\nBeta Co")).toEqual([
      { name: "Acme", placeholder: "a bank" },
      { name: "Beta Co", placeholder: DEFAULT_PLACEHOLDER },
    ]);
  });
});

describe("ladder reading", () => {
  const ladder = `Senior: Leads projects within the team.
Principal: Sets technical direction across several teams and is accountable for org-wide outcomes.`;

  it("keeps expectations only when quoted from the ladder and drops unknown themes", () => {
    const dims = dimensionsFromReply(
      JSON.stringify({
        dimensions: [
          {
            id: "direction",
            label: "Technical direction",
            expects: "Sets technical direction across several teams",
            themes: ["influence", "made_up"],
          },
          { id: "x", label: "Made up", expects: "Writes poetry", themes: ["impact"] },
          { id: "y", label: "No themes", expects: "", themes: ["about_you"] },
        ],
      }),
      ladder,
    );
    expect(dims).toEqual([
      {
        id: "direction",
        label: "Technical direction",
        expects: "Sets technical direction across several teams",
        themes: ["influence"],
      },
      { id: "x", label: "Made up", expects: "", themes: ["impact"] },
    ]);
  });
});

describe("packet checks", () => {
  const stories: FinishedStory[] = [
    {
      id: "a",
      title: "Pricing",
      typeLabel: "Major project",
      story: "",
      answers: "",
      source: "Cut churn by 12% across 3 teams",
      draftWrittenAt: WRITTEN,
    },
    {
      id: "b",
      title: "Outage",
      typeLabel: "Went wrong",
      story: "",
      answers: "",
      source: "Saved $40K",
      draftWrittenAt: WRITTEN,
    },
  ];

  const reply = parsePacketReply(
    JSON.stringify({
      selfReview: [
        { dimension: "Scope", text: "I cut churn by 12% across 3 teams.", stories: ["s1"] },
        { dimension: "Impact", text: "I saved $40K and cut churn 12%.", stories: ["s2"] },
      ],
      managerSummary: { text: "I'm going for Principal.", stories: ["s1", "s9"] },
      talkingPoints: [{ text: "Led 3 teams", stories: [] }],
    }),
    stories.length,
  );

  it("names a figure borrowed from another story and an item with no story", () => {
    const problems = packetProblems(reply, stories);
    expect(problems.some((p) => p.includes('"12%"'))).toBe(true);
    expect(problems.some((p) => p.includes("doesn't name a story"))).toBe(true);
  });

  it("leaves those lines out and keeps the rest with their story ids", () => {
    const packet = checkedPacket(reply, stories);
    expect(packet.selfReview.map((i) => i.dimension)).toEqual(["Scope"]);
    expect(packet.selfReview[0].storyIds).toEqual(["a"]);
    expect(packet.managerSummary).toBe("I'm going for Principal.");
    expect(packet.talkingPoints).toEqual([]);
    expect(packet.leftOut).toBe(2);
  });

  it("goes stale when a story it read is rewritten or deleted", () => {
    const packet = {
      ...checkedPacket(reply, stories),
      stories: { a: WRITTEN },
      model: "m",
      generatedAt: WRITTEN,
    };
    expect(packetIsStale(packet, [{ id: "a", content: drafted() }])).toBe(false);
    expect(packetIsStale(packet, [])).toBe(true);
  });
});
