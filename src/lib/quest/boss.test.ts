import { describe, expect, it } from "vitest";
import type { LikelyQuestion } from "@/lib/questions/content";
import { bossJobsDone, bossQuestions, bossRoundDone, bossState, jobJourney } from "./boss";
import { practiced, story } from "./test-fixtures";
import { xpSummary } from "./xp";

const q = (question: string, theme: string): LikelyQuestion =>
  ({ question, theme, why: "", source: "general", specific: false }) as unknown as LikelyQuestion;

const job = {
  id: "j1",
  title: "Designer",
  company: "Acme",
  likelyQuestions: {
    questions: [
      q("A difficult stakeholder?", "conflict"),
      q("Something that went wrong?", "failure"),
      q("How do you prioritize?", "prioritization"),
    ],
  },
};

const boss = (opts: Parameters<typeof practiced>[1] = {}) => ({ ...practiced("a", opts), boss: true });

describe("boss round", () => {
  it("asks the top five likely questions", () => {
    const many = Array.from({ length: 8 }, (_, i) => q(`Q${i}`, "conflict"));
    expect(bossQuestions(many).map((x) => x.question)).toEqual(["Q0", "Q1", "Q2", "Q3", "Q4"]);
  });

  it("stays locked until every top question has a story at Level 2", () => {
    const some = [
      story("a", 2, { type: "difficult_stakeholder" }),
      story("b", 1, { type: "went_wrong" }),
    ];
    const locked = bossState(job, some, []);
    expect(locked.unlocked).toBe(false);
    const j = jobJourney(job, locked);
    expect(j.title).toBe("Get ready for Acme");
    expect(j.steps.map((s) => s.state)).toEqual(["done", "now", "locked", "locked"]);
    expect(j.next).toEqual({ href: "/stories/b", label: "Take its story to Level 2" });
    expect(j.boss).toBeUndefined();

    const all = [...some.slice(0, 1), story("b", 2, { type: "went_wrong" }), story("c", 3, { type: "prioritization" })];
    const open = bossState(job, all, []);
    expect(open.unlocked).toBe(true);
    const oj = jobJourney(job, open);
    expect(oj.boss).toEqual({ jobId: "j1" });
    expect(oj.steps.at(-1)).toMatchObject({ id: "boss", state: "now", xp: 300 });
  });

  it("asks to build a story for an uncovered question", () => {
    const j = jobJourney(job, bossState(job, [], []));
    expect(j.next).toEqual({ href: "/stories/new/difficult_stakeholder", label: "Build a story for it" });
  });

  it("counts a round run to the end once per job, and continues an open one", () => {
    const finished = [boss(), boss({ skipped: true })];
    expect(bossRoundDone(finished)).toBe(true);
    expect(bossRoundDone([boss(), { ...practiced("a", { feedback: false }), boss: true }])).toBe(false);
    expect(bossRoundDone([practiced("a")])).toBe(false);
    const sessions = [
      { targetJobId: "j1", items: finished },
      { targetJobId: "j1", items: finished },
      { id: "s3", targetJobId: "j2", items: [{ ...practiced("a", { feedback: false }), boss: true }] },
    ];
    expect(bossJobsDone(sessions).size).toBe(1);
    expect(xpSummary({ stories: [], sessions, bossRounds: bossJobsDone(sessions).size }).total).toBe(300);
    const other = { ...job, id: "j2" };
    const j = jobJourney(other, bossState(other, [], sessions));
    expect(j.next).toEqual({ href: "/practice/s3", label: "Continue the boss round" });
  });
});
