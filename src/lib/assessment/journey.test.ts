import { describe, expect, it } from "vitest";
import {
  type Answers,
  QUESTIONS,
  gradeJourney,
  parseAnswers,
  parseAssessment,
} from "./journey";

const NEW_SEARCH: Answers = {
  stage: "applying",
  nextInterview: "none",
  targetJob: "posting",
  stories: "none",
  aboutMe: "no",
};

const READY: Answers = {
  stage: "finals",
  nextInterview: "soon",
  targetJob: "posting",
  stories: "many",
  aboutMe: "yes",
};

describe("parseAnswers", () => {
  it("accepts one known option per question", () => {
    expect(parseAnswers(NEW_SEARCH)).toEqual(NEW_SEARCH);
  });

  it("rejects a missing or unknown answer", () => {
    expect(parseAnswers({ ...NEW_SEARCH, aboutMe: undefined })).toBeNull();
    expect(parseAnswers({ ...NEW_SEARCH, stories: "dozens" })).toBeNull();
    expect(parseAnswers(null)).toBeNull();
    expect(parseAnswers("stage=applying")).toBeNull();
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

describe("gradeJourney", () => {
  it("scores readiness from 0 to 100", () => {
    const low = gradeJourney({ ...NEW_SEARCH, targetJob: "unsure" });
    expect(low.score).toBe(0);
    expect(gradeJourney(READY).score).toBe(100);
    expect(gradeJourney(READY, { hasJob: true }).score).toBe(100);
  });

  it("names a level from the score", () => {
    expect(gradeJourney({ ...NEW_SEARCH, targetJob: "unsure" }).level).toBe("Getting started");
    expect(gradeJourney(READY).level).toBe("Interview-ready");
  });

  it("sends someone with a posting and time to spare to their likely questions first", () => {
    const grade = gradeJourney(NEW_SEARCH);
    expect(grade.gaps.map((g) => g.id)).toEqual(["job", "aboutMe", "numbers"]);
    expect(grade.next.id).toBe("job");
  });

  it("puts About me first when an interview is days away", () => {
    const grade = gradeJourney({ ...NEW_SEARCH, stage: "screens", nextInterview: "days" });
    expect(grade.next.id).toBe("aboutMe");
    expect(grade.urgent).toBe(true);
  });

  it("sends someone with no job in mind to About me, the free step that needs no posting", () => {
    const grade = gradeJourney({ ...NEW_SEARCH, targetJob: "unsure" });
    expect(grade.next.id).toBe("aboutMe");
    expect(grade.gaps.map((g) => g.id)).toContain("job");
  });

  it("drops the job gap once a job is saved", () => {
    const grade = gradeJourney({ ...NEW_SEARCH, targetJob: "unsure" }, { hasJob: true });
    expect(grade.gaps.map((g) => g.id)).not.toContain("job");
    expect(grade.score).toBe(20);
  });

  it("still asks a ready user without a saved job to add it", () => {
    expect(gradeJourney(READY).next.id).toBe("job");
  });

  it("asks for numbers before more stories", () => {
    const grade = gradeJourney({ ...READY, stories: "noNumbers" }, { hasJob: true });
    expect(grade.next.id).toBe("numbers");
    expect(gradeJourney({ ...READY, stories: "some" }, { hasJob: true }).next.id).toBe("stories");
  });

  it("without a posting to paste, starts with About me rather than asking for one", () => {
    // Andrew's answers: a kind of role in mind, no posting yet.
    const grade = gradeJourney({ ...NEW_SEARCH, targetJob: "role", aboutMe: "rough" });
    expect(grade.next.id).toBe("aboutMe");
    expect(grade.gaps.map((g) => g.id)).toEqual(["aboutMe", "numbers", "job"]);
  });

  it("shows at most three gaps", () => {
    const grade = gradeJourney({ ...NEW_SEARCH, targetJob: "role", aboutMe: "rough" });
    expect(grade.gaps.length).toBeLessThanOrEqual(3);
  });

  it("with no gaps left, points to the likely questions to practise", () => {
    const grade = gradeJourney(READY, { hasJob: true });
    expect(grade.gaps).toEqual([]);
    expect(grade.next.id).toBe("practice");
  });
});
