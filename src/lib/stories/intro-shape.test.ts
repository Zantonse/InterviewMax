import { describe, expect, it } from "vitest";
import { directionPhrase, introShapeProblems, pathStops } from "./intro-shape";

// Craig's About me draft, Nov 22.
const CRAIG = {
  present: "I'm a senior sales engineer at Okta, working the enterprise segment on the West Coast as an IC.",
  path: "I started in firmware and BIOS engineering, and being in the back end wasn't as exciting, so I moved into a consulting role at AirWatch, which was VMware, then implementation consulting, then sales engineering at OneLogin where I learned identity and access management, and a year at SailPoint on identity governance.",
  highlight:
    "What I'm proudest of is a Cloud Code harness I built internally that gives each SE a team of agents, and I rolled it out to the whole global SE team, 300 or 80% of them.",
  strengths: "People come to me for how to use AI well.",
  next: "So next I'm looking for an AI native company.",
};
const CRAIG_PATH_ANSWER =
  "Actually, I started off my career as a firmware engineer doing BIOS engineering, then started moving more customer facing, with a implementation consultant role before moving to sales engineering at one login";

describe("introShapeProblems", () => {
  it("catches everything that was flat about Craig's draft", () => {
    const problems = introShapeProblems(CRAIG, { path: CRAIG_PATH_ANSWER });
    expect(problems).toHaveLength(4);
    expect(problems[0]).toContain("list of jobs");
    expect(problems[1]).toContain('"moving more customer facing"');
    expect(problems[2]).toContain('"as an IC"');
    expect(problems[3]).toContain('"300 or 80%"');
  });

  it("passes a path built on one move that keeps the user's thread", () => {
    const parts = {
      ...CRAIG,
      present:
        "I'm a senior sales engineer at Okta on the West Coast enterprise team, supporting three reps and about 15 accounts per rep.",
      path: "I started as a firmware engineer doing BIOS work and kept moving more customer facing: consulting at AirWatch, then sales engineering at OneLogin.",
      highlight: "I built a Claude Code harness, now rolled out to 300 SEs, 80% of our global team.",
    };
    expect(introShapeProblems(parts, { path: CRAIG_PATH_ANSWER })).toEqual([]);
  });

  it("doesn't ask for a thread the user never stated", () => {
    expect(
      introShapeProblems({ path: "I moved to sales engineering at OneLogin because I liked customers." }, {
        path: "I moved to sales engineering at OneLogin.",
      }),
    ).toEqual([]);
  });
});

describe("pathStops", () => {
  it("counts named companies, not acronyms or the first word", () => {
    expect(pathStops("Before Okta I was at AirWatch, then OneLogin doing BIOS and SE work.")).toEqual([
      "Okta",
      "AirWatch",
      "OneLogin",
    ]);
  });
});

describe("directionPhrase", () => {
  it("finds the direction and stops before filler", () => {
    expect(directionPhrase(CRAIG_PATH_ANSWER)).toEqual({
      phrase: "moving more customer facing",
      key: "customer facing",
    });
    expect(directionPhrase("I kept getting closer to the customer, so I switched.")).toEqual({
      phrase: "getting closer to the customer",
      key: "customer",
    });
    expect(directionPhrase("I moved to Austin.")).toBeUndefined();
  });
});
