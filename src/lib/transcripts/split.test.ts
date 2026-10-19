import { describe, expect, it } from "vitest";
import { leftOutNote, partTitle, splitInterviews } from "./split";
import { surenessFor, sureness, userWords } from "./sure";
import { toughForAsked } from "@/lib/tough/questions";
import { ANSWER_GAPS } from "./content";
import { TRANSCRIPT_READ_SYSTEM } from "./prompts";

// Long enough to count as a transcript (MIN_TRANSCRIPT_LENGTH).
const talk = (who: string) =>
  `Thanks for joining, ${who}. Tell me about a time you had to win over a skeptical stakeholder. `.repeat(5);

describe("splitting a file into interviews", () => {
  it("keeps a file with no headings as one interview", () => {
    const { interviews, leftOut } = splitInterviews(talk("Kevin"));
    expect(interviews).toHaveLength(1);
    expect(interviews[0].label).toBe("Interview 1");
    expect(leftOut).toEqual([]);
  });

  it("splits at interview headings on their own line", () => {
    const text = `Interview 1\n\n${talk("A")}\n\nInterview 2\n\n${talk("B")}`;
    const { interviews } = splitInterviews(text);
    expect(interviews.map((p) => p.label)).toEqual(["Interview 1", "Interview 2"]);
    expect(interviews[1].text).toContain("Thanks for joining, B.");
    expect(interviews[0].text).not.toContain("Interview 2");
  });

  it("finds headings that lost their line break in a Word file", () => {
    const text = `Interview 1 . ${talk("A")}Bye.Interview 2\n\n${talk("B")}`;
    const { interviews } = splitInterviews(text);
    expect(interviews.map((p) => p.label)).toEqual(["Interview 1", "Interview 2"]);
    expect(interviews[0].text.startsWith("Thanks for joining, A.")).toBe(true);
    expect(interviews[0].text.endsWith("Bye.")).toBe(true);
  });

  it("names an unheaded first interview by its place", () => {
    const { interviews } = splitInterviews(`${talk("A")}\n\nInterview 2\n\n${talk("B")}`);
    expect(interviews.map((p) => p.label)).toEqual(["Interview 1", "Interview 2"]);
  });

  it("leaves out a job description and another tool's feedback", () => {
    const text = [
      "Recruiter",
      talk("A"),
      "Job",
      "Data Enablement Analyst. Responsibilities: catalog data. Requirements: SQL.",
      "Interview 2",
      talk("B"),
      "TL;DR (3–7 bullets)",
      "Your biggest issue: answers drift. Polished answer: I owned the KPI dashboard and cut errors by 40%.",
    ].join("\n\n");
    const { interviews, leftOut } = splitInterviews(text);
    expect(interviews.map((p) => p.label)).toEqual(["Recruiter", "Interview 2"]);
    expect(interviews.map((p) => p.text).join(" ")).not.toMatch(/Responsibilities|Polished answer/);
    expect(leftOut).toEqual(["job", "notes"]);
  });

  it("leaves out a posting whose heading is glued to it", () => {
    const text = `${talk("A")}\n\nJob Business Intelligence Specialist. Duties And Responsibilities: ... Education & Experience Requirements: Bachelor's degree.\n\nInterview 2\n\n${talk("B")}`;
    const { interviews, leftOut } = splitInterviews(text);
    expect(interviews).toHaveLength(2);
    expect(leftOut).toEqual(["job"]);
  });

  it("doesn't split on a mention of an interview inside notes or conversation", () => {
    const text = `${talk("A")}\n\nInterview 2: they pushed on outcomes and SQL.\n\nIn interview 2 I'd say more.`;
    expect(splitInterviews(text).interviews).toHaveLength(1);
  });

  it("titles parts only when the label says something", () => {
    expect(partTitle("AutoZone", { label: "Interview 1", text: "" }, 1)).toBe("AutoZone");
    expect(partTitle("AutoZone", { label: "Interview 2", text: "" }, 2)).toBe("AutoZone · Interview 2");
    expect(partTitle("Collibra", { label: "Recruiter", text: "" }, 1)).toBe("Collibra · Recruiter");
  });

  it("says what was left out", () => {
    expect(leftOutNote([])).toBe("");
    expect(leftOutNote(["notes", "job"])).toContain("a job description and feedback notes");
    expect(leftOutNote(["bogus"])).toBe("");
  });
});

describe("how sure you sounded", () => {
  const answer =
    "I think I kind of led the rollout. I believe we onboarded the HR systems, and maybe it went well. What kind of data? Sorry, could you repeat the question? I just blanked out. ";
  const labelled = Array.from({ length: 12 }, () => `Interviewer: Tell me more.\n\nMe: ${answer}`).join("\n\n");

  it("counts hedges in the user's turns only", () => {
    const words = userWords(`Interviewer: I think you kind of said that.\n\nMe: ${answer}`, "Me");
    expect(words).not.toContain("you kind of said");
    const sure = surenessFor({ transcript: labelled, speaker: "Me" });
    expect(sure).not.toBeNull();
    const counts = Object.fromEntries(sure!.hedges.map((h) => [h.phrase, h.count]));
    // "What kind of data?" is an ordinary use, not a hedge.
    expect(counts).toEqual({ "I think": 12, "kind of": 12, "I believe": 12, maybe: 12 });
    expect(sure!.lostCount).toBe(24);
    expect(sure!.many).toBe(true);
  });

  it("reads lines under the speaker name the user gave", () => {
    const text = Array.from({ length: 12 }, () => `Sam: Why this role?\nKevin: ${answer}`).join("\n");
    expect(surenessFor({ transcript: text, speaker: "Kevin" })?.hedgeCount).toBe(48);
  });

  it("says nothing without enough of the user's words, or without knowing which are theirs", () => {
    expect(sureness("I think so.")).toBeNull();
    expect(surenessFor({ transcript: labelled, speaker: "" })).toBeNull();
  });
});

describe("screening questions in past interviews", () => {
  it("links recruiter questions to the tough-questions coach", () => {
    expect(toughForAsked("Do you have a certain number you're trying to target on your next move?")).toBe("salary");
    expect(toughForAsked("Did you see the comp band on the job description?")).toBe("salary");
    expect(toughForAsked("When are you looking to make a move? Like, why are you looking?")).toBe("why_leaving");
    expect(toughForAsked("So I see you were laid off. What happened?")).toBe("let_go");
    expect(toughForAsked("How would you design a test for a premium battery line?")).toBeUndefined();
  });

  it("asks the review to keep screening questions and flag missing examples", () => {
    expect(TRANSCRIPT_READ_SYSTEM).toContain("salary expectations");
    expect(TRANSCRIPT_READ_SYSTEM).toContain("never quote it");
    expect(ANSWER_GAPS.some((g) => g.id === "example")).toBe(true);
    expect(TRANSCRIPT_READ_SYSTEM).toContain('Use "example"');
  });
});
