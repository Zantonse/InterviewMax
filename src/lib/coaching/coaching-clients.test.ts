import { describe, expect, it } from "vitest";
import type { StoryContent } from "@/lib/stories/content";
import type { StoryGrade } from "@/lib/stories/grading";
import {
  daysUntil,
  interviewLabel,
  levelCounts,
  nextInterview,
  storiesByLevel,
  whenLabel,
  type ViewStory,
} from "./client-view";
import {
  cleanLabel,
  inviteCodeFromPath,
  invitePath,
  isInviteCode,
  newInviteCode,
  parseInviteStatus,
} from "./invite-code";

function grade(over: Partial<StoryGrade>): StoryGrade {
  return {
    tier: "good_enough",
    fixes: [],
    strengths: [],
    criteria: [],
    checks: [],
    flags: [],
    model: "test",
    draftWrittenAt: "w1",
    gradedAt: "g1",
    ...over,
  };
}

const draft = { parts: {}, untracedNumbers: [], model: "", writtenAt: "w1" };

function story(id: string, storyType: string, content: Partial<StoryContent>): ViewStory {
  return {
    id,
    title: id,
    storyType,
    content: { version: 1, answers: { situation: "Something happened" }, ...content },
    updatedAt: "2026-11-18T00:00:00Z",
  };
}

describe("invite codes", () => {
  it("makes 32-character codes the database accepts, different each time", () => {
    const a = newInviteCode();
    const b = newInviteCode();
    expect(a).toHaveLength(32);
    expect(isInviteCode(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("reads the code from the invite path and nothing else", () => {
    const code = newInviteCode();
    expect(inviteCodeFromPath(invitePath(code))).toBe(code);
    expect(inviteCodeFromPath(`${invitePath(code)}/`)).toBe(code);
    expect(inviteCodeFromPath("/coach/short")).toBeNull();
    expect(inviteCodeFromPath("/coach/a.b'c;drop-table-xxxxxxxx")).toBeNull();
    expect(inviteCodeFromPath(`/settings/${code}`)).toBeNull();
  });

  it("treats anything unexpected from the database as an invalid link", () => {
    expect(parseInviteStatus("ok")).toBe("ok");
    expect(parseInviteStatus("expired")).toBe("expired");
    expect(parseInviteStatus("weird")).toBe("invalid");
    expect(parseInviteStatus(null)).toBe("invalid");
  });

  it("tidies the coach's label for an invite", () => {
    expect(cleanLabel("  Kevin \n K ")).toBe("Kevin K");
    expect(cleanLabel(undefined)).toBe("");
    expect(cleanLabel("x".repeat(200))).toHaveLength(80);
  });
});

describe("client page", () => {
  const stories = [
    story("strong", "major_project", {
      draft,
      grade: grade({ tier: "strong", thinking: { level: "shown", note: "" } }),
    }),
    story("good", "went_wrong", { draft, grade: grade({}) }),
    story("rough", "prioritization", { draft }),
    story("answers-only", "cross_team", {}),
    story("intro", "about_me", { draft, grade: grade({ tier: "not_yet" }) }),
    { ...story("empty", "cross_team", {}), content: { version: 1, answers: {} } as StoryContent },
  ];

  it("groups stories by level, highest first, then unwritten, then About me", () => {
    const groups = storiesByLevel(stories);
    expect(groups.map((g) => [g.id, g.stories.map((s) => s.id)])).toEqual([
      ["level-3", ["strong"]],
      ["level-2", ["good"]],
      ["level-1", ["rough"]],
      ["not-told", ["answers-only"]],
      ["other", ["intro"]],
    ]);
    expect(groups.at(-1)?.stories[0].level).toBe(1);
  });

  it("counts behavioral stories at each level", () => {
    expect(levelCounts(stories)).toEqual({ 1: 1, 2: 1, 3: 1 });
  });

  it("finds the next interview among jobs still in progress", () => {
    const jobs = [
      { id: "a", title: "A", company: null, interviewDate: "2026-11-30", outcome: null },
      { id: "b", title: "B", company: null, interviewDate: "2026-11-21", outcome: "rejected" },
      { id: "c", title: "C", company: null, interviewDate: "2026-11-10", outcome: null },
      { id: "d", title: "D", company: null, interviewDate: "2026-11-25", outcome: null },
    ];
    expect(nextInterview(jobs, "2026-11-19")).toBe("2026-11-25");
    expect(nextInterview([], "2026-11-19")).toBeNull();
  });

  it("says when an interview is", () => {
    expect(daysUntil("2026-11-25", "2026-11-19")).toBe(6);
    expect(whenLabel("2026-11-19", "2026-11-19")).toBe("Today");
    expect(whenLabel("2026-11-20", "2026-11-19")).toBe("Tomorrow");
    expect(whenLabel("2026-11-25", "2026-11-19")).toBe("In 6 days");
    expect(whenLabel("2026-12-30", "2026-11-19")).toBe("Dec 30");
    expect(interviewLabel("2026-11-25", "2026-11-19")).toBe("Interview in 6 days");
    expect(interviewLabel("2026-12-30", "2026-11-19")).toBe("Interview on Dec 30");
  });
});
