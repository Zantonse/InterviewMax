import { describe, expect, it } from "vitest";
import {
  type Answers,
  QUESTIONS,
  gradeJourney,
  knownProgress,
  parseAnswers,
  parseAssessment,
} from "./journey";

const NEW_SEARCH: Answers = {
  stage: "applying",
  nextInterview: "none",
  targetJob: "posting",
  stories: "none",
  focus: "unsure",
};

const READY: Answers = {
  stage: "finals",
  nextInterview: "soon",
  targetJob: "posting",
  stories: "many",
  focus: "unsure",
};

const ALL_KNOWN = { hasJob: true, hasAboutMe: true };
const ids = (a: Answers, known = {}) => gradeJourney(a, known).gaps.map((g) => g.id);

describe("parseAnswers", () => {
  it("accepts one known option per question", () => {
    expect(parseAnswers(NEW_SEARCH)).toEqual(NEW_SEARCH);
  });

  it("rejects a missing or unknown answer", () => {
    expect(parseAnswers({ ...NEW_SEARCH, stage: undefined })).toBeNull();
    expect(parseAnswers({ ...NEW_SEARCH, stories: "dozens" })).toBeNull();
    expect(parseAnswers({ ...NEW_SEARCH, focus: "everything" })).toBeNull();
    expect(parseAnswers(null)).toBeNull();
    expect(parseAnswers("stage=applying")).toBeNull();
  });

  it("reads answers saved before the hardest-part question, dropping the old About me answer", () => {
    const legacy: Record<string, string> = { ...NEW_SEARCH, aboutMe: "yes" };
    delete legacy.focus;
    expect(parseAnswers(legacy)).toEqual(NEW_SEARCH);
  });

  it("drops extra keys", () => {
    expect(parseAnswers({ ...NEW_SEARCH, admin: true })).toEqual(NEW_SEARCH);
  });

  it("keeps the quiz short", () => {
    expect(QUESTIONS.length).toBeLessThanOrEqual(5);
    for (const q of QUESTIONS) expect(q.options.length).toBeLessThanOrEqual(5);
  });
});

describe("parseAssessment", () => {
  it("reads a taken or skipped assessment, and nothing else", () => {
    expect(parseAssessment({ answers: NEW_SEARCH, completedAt: "2026-10-14T00:00:00Z" })).toEqual({
      answers: NEW_SEARCH,
      completedAt: "2026-10-14T00:00:00Z",
    });
    expect(parseAssessment({ skippedAt: "2026-10-14T00:00:00Z" })).toEqual({
      skippedAt: "2026-10-14T00:00:00Z",
    });
    expect(parseAssessment(null)).toBeNull();
    expect(parseAssessment({ answers: { stage: "x" }, completedAt: "now" })).toBeNull();
  });
});

describe("knownProgress", () => {
  it("counts a written About me and written stories, not empty ones", () => {
    const known = knownProgress(
      [
        { storyType: "about_me", content: { draft: "Hi" } },
        { storyType: "major_project", content: { draft: "A" } },
        { storyType: "went_wrong", content: {} },
      ],
      false,
    );
    expect(known).toEqual({ hasJob: false, hasAboutMe: true, storiesWritten: 1 });
  });
});

describe("gradeJourney", () => {
  it("scores readiness from 0 to 100 from the job, About me and stories", () => {
    expect(gradeJourney({ ...NEW_SEARCH, targetJob: "unsure" }).score).toBe(0);
    expect(gradeJourney(READY, ALL_KNOWN).score).toBe(100);
    expect(gradeJourney(READY).score).toBe(65);
  });

  it("names a level from the score", () => {
    expect(gradeJourney({ ...NEW_SEARCH, targetJob: "unsure" }).level).toBe("Getting started");
    expect(gradeJourney(READY, ALL_KNOWN).level).toBe("Interview-ready");
  });

  it("counts stories written in the app even if they answered fewer", () => {
    const grade = gradeJourney(NEW_SEARCH, { hasJob: true, storiesWritten: 5 });
    expect(grade.score).toBe(65);
    expect(grade.gaps.map((g) => g.id)).not.toContain("numbers");
  });

  it("closes About me once they've written one", () => {
    expect(ids({ ...NEW_SEARCH, targetJob: "role" }, { hasAboutMe: true })).not.toContain("aboutMe");
  });

  it("with a posting and time to spare, starts with the likely questions", () => {
    const grade = gradeJourney(NEW_SEARCH);
    expect(grade.gaps.map((g) => g.id)).toEqual(["job", "aboutMe", "numbers"]);
    expect(grade.reason).toBe("posting");
  });

  describe("by where they are in the search", () => {
    it("before interviews, without a posting: About me, then stories", () => {
      const grade = gradeJourney({ ...NEW_SEARCH, targetJob: "role" });
      expect(grade.gaps.map((g) => g.id)).toEqual(["aboutMe", "numbers", "job"]);
      expect(grade.reason).toBe("stage");
      expect(grade.why).toMatch(/every interview needs/);
    });

    it("recruiter screens: About me first", () => {
      const grade = gradeJourney({ ...NEW_SEARCH, stage: "screens", targetJob: "role" });
      expect(grade.gaps.map((g) => g.id)).toEqual(["aboutMe", "job", "numbers"]);
      expect(grade.why).toMatch(/Tell me about yourself/);
    });

    it("panel and final rounds: the job, then stories", () => {
      expect(ids({ ...NEW_SEARCH, stage: "panels", targetJob: "role" })).toEqual([
        "job",
        "numbers",
        "aboutMe",
      ]);
      const grade = gradeJourney({ ...NEW_SEARCH, stage: "finals" }, { hasJob: true });
      expect(grade.gaps.map((g) => g.id)).toEqual(["numbers", "aboutMe", "practice"]);
      expect(grade.why).toMatch(/stories matter most/);
    });
  });

  it("puts About me first when a screen is days away", () => {
    const grade = gradeJourney({ ...NEW_SEARCH, stage: "screens", nextInterview: "days" });
    expect(grade.next.id).toBe("aboutMe");
    expect(grade.urgent).toBe(true);
    expect(grade.reason).toBe("urgent");
  });

  it("keeps the job first when a panel round is days away", () => {
    const grade = gradeJourney({ ...NEW_SEARCH, stage: "panels", nextInterview: "days" });
    expect(grade.next.id).toBe("job");
    expect(grade.reason).toBe("urgent");
  });

  describe("what feels hardest goes first", () => {
    it("introducing myself", () => {
      const grade = gradeJourney({ ...NEW_SEARCH, stage: "finals", focus: "aboutMe" });
      expect(grade.next.id).toBe("aboutMe");
      expect(grade.reason).toBe("focus");
      expect(grade.why).toMatch(/introducing yourself feels hardest/);
    });

    it("coming up with stories", () => {
      expect(gradeJourney({ ...NEW_SEARCH, focus: "stories" }).next.id).toBe("numbers");
      expect(gradeJourney({ ...READY, stories: "some", focus: "stories" }).next.id).toBe("stories");
    });

    it("not knowing what they'll ask: the job, or its questions once added", () => {
      expect(gradeJourney({ ...NEW_SEARCH, targetJob: "role", focus: "questions" }).next.id).toBe("job");
      expect(gradeJourney({ ...NEW_SEARCH, focus: "questions" }, { hasJob: true }).next.id).toBe(
        "practice",
      );
    });

    it("saying it out loud: practice, with the job just before it if there isn't one", () => {
      expect(ids({ ...NEW_SEARCH, targetJob: "role", focus: "outLoud" })).toEqual([
        "job",
        "practice",
        "aboutMe",
      ]);
      expect(gradeJourney({ ...NEW_SEARCH, focus: "outLoud" }, { hasJob: true }).next.id).toBe(
        "practice",
      );
    });

    it("is ignored once that part is done", () => {
      const grade = gradeJourney({ ...NEW_SEARCH, focus: "aboutMe" }, { hasAboutMe: true });
      expect(grade.next.id).toBe("job");
      expect(grade.reason).toBe("posting");
    });
  });

  it("asks for numbers before more stories", () => {
    expect(gradeJourney({ ...READY, stories: "noNumbers" }, ALL_KNOWN).next.id).toBe("numbers");
    expect(gradeJourney({ ...READY, stories: "some" }, ALL_KNOWN).next.id).toBe("stories");
  });

  it("shows at most three steps, ending in practice when there's room", () => {
    for (const a of [NEW_SEARCH, READY, { ...NEW_SEARCH, targetJob: "role" as const }]) {
      expect(gradeJourney(a).gaps.length).toBeLessThanOrEqual(3);
    }
    expect(ids(READY, { hasJob: true })).toEqual(["aboutMe", "practice"]);
  });

  it("with nothing left, points to practice", () => {
    const grade = gradeJourney(READY, ALL_KNOWN);
    expect(grade.gaps.map((g) => g.id)).toEqual(["practice"]);
    expect(grade.next.id).toBe("practice");
    expect(grade.reason).toBe("ready");
  });
});
