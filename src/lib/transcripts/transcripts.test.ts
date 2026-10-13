import { describe, expect, it } from "vitest";
import { parseLikelyQuestionsReply, likelyQuestionsMessages } from "@/lib/questions/prompts";
import { emptyContent } from "@/lib/stories/content";
import { probeMessages } from "@/lib/stories/prompts";
import { getStoryType } from "@/lib/stories/story-types";
import {
  captionsToText,
  notesForStoryType,
  pastQuestionsFor,
  quoteAppears,
  summarizeTranscripts,
  type TranscriptAnalysis,
} from "./content";
import { TRANSCRIPT_READ_SYSTEM, parseTranscriptReply, transcriptReadMessages } from "./prompts";

const TRANSCRIPT = `Interviewer: Thanks for joining. Tell me about a time you disagreed with your manager.
Me: Sure. At Acme my manager wanted to cut the onboarding program, and I thought it was a mistake. So I pulled the data and we kept it.
Interviewer: What did the data show, exactly? How many customers were affected?
Me: Um, a lot of them. I don't remember the number.
Interviewer: Okay. How do you decide what to work on first when everything is urgent?
Me: I rank by revenue impact. Last quarter that meant I moved 12 renewals ahead of new deals and we closed all 12 on time.
Interviewer: Great, that's really helpful.`;

function reply(body: unknown) {
  return `Here it is:\n\`\`\`json\n${JSON.stringify(body)}\n\`\`\``;
}

describe("reading caption files", () => {
  it("turns WebVTT with speaker tags into speaker lines", () => {
    const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
<v Jordan Lee>Tell me about yourself.</v>

2
00:00:04.500 --> 00:00:06.000
<v Jordan Lee>Take your time.</v>

3
00:00:06.500 --> 00:00:09.000
<v Sam>I lead solutions engineering
for the west region.</v>`;
    expect(captionsToText(vtt)).toBe(
      "Jordan Lee: Tell me about yourself. Take your time.\nSam: I lead solutions engineering for the west region.",
    );
  });

  it("reads SRT with Name: labels", () => {
    const srt = `1
00:00:01,000 --> 00:00:03,000
Interviewer: Why this role?

2
00:00:03,500 --> 00:00:06,000
Candidate: Because I want to own the whole cycle.`;
    expect(captionsToText(srt)).toBe(
      "Interviewer: Why this role?\nCandidate: Because I want to own the whole cycle.",
    );
  });
});

describe("tracing quotes", () => {
  it("matches regardless of case, punctuation and line breaks", () => {
    expect(quoteAppears("what did the data show exactly", TRANSCRIPT)).toBe(true);
    expect(quoteAppears("“I don’t remember the number.”", TRANSCRIPT)).toBe(true);
  });

  it("follows an ellipsis in order", () => {
    expect(quoteAppears("I pulled the data … we kept it", TRANSCRIPT)).toBe(true);
    expect(quoteAppears("we kept it … I pulled the data", TRANSCRIPT)).toBe(false);
  });

  it("rejects words that aren't there, including partial words", () => {
    expect(quoteAppears("I doubled the onboarding program", TRANSCRIPT)).toBe(false);
    expect(quoteAppears("manage", TRANSCRIPT)).toBe(false);
    expect(quoteAppears("", TRANSCRIPT)).toBe(false);
  });
});

describe("the transcript review prompt", () => {
  it("lists the themes and asks for quotes", () => {
    expect(TRANSCRIPT_READ_SYSTEM).toContain("conflict");
    expect(TRANSCRIPT_READ_SYSTEM).toContain("copied exactly");
  });

  it("tells the model which speaker the user is", () => {
    const [message] = transcriptReadMessages({
      transcript: TRANSCRIPT,
      title: "Hiring manager round",
      company: "Initech",
      speaker: "Me",
      job: null,
    });
    expect(message.content).toContain('labelled "Me"');
    expect(message.content).toContain("Hiring manager round at Initech");
    expect(message.content).toContain(TRANSCRIPT);
  });
});

describe("parsing the review", () => {
  const good = {
    summary: "Focused on conflict and prioritization.",
    lookingFor: [
      { point: "Hard evidence behind claims", quote: "What did the data show, exactly?" },
      { point: "Made-up focus", quote: "Tell me about your leadership philosophy" },
    ],
    asked: [
      {
        question: "Tell me about a time you disagreed with your manager.",
        theme: "conflict",
        probes: ["How many customers were affected?", "Who else was in the room?"],
        landed: "weak",
        evidence: "I don't remember the number.",
        note: "No number behind the claim, so the interviewer had to dig.",
        gaps: ["numbers", "result", "nonsense"],
      },
      {
        question: "How do you decide what to work on first when everything is urgent?",
        theme: "prioritization",
        probes: [],
        landed: "strong",
        evidence: "I moved 12 renewals ahead of new deals",
        note: "A clear rule backed by 12 renewals closed on time.",
        gaps: ["numbers"],
      },
      {
        question: "Walk me through your biggest deal.",
        theme: "impact",
        landed: "mixed",
        evidence: "x",
        note: "",
        gaps: [],
      },
    ],
  };

  it("keeps traced findings and drops the rest", () => {
    const parsed = parseTranscriptReply(reply(good), TRANSCRIPT);
    expect(parsed.asked.map((q) => q.question)).toEqual([
      "Tell me about a time you disagreed with your manager.",
      "How do you decide what to work on first when everything is urgent?",
    ]);
    const [first, second] = parsed.asked;
    expect(first.probes).toEqual(["How many customers were affected?"]);
    expect(first.gaps).toEqual(["numbers", "result"]);
    expect(first.landed).toBe("weak");
    // A strong answer has no gaps.
    expect(second.gaps).toEqual([]);
    expect(second.note).toContain("12 renewals");
    expect(parsed.lookingFor).toEqual([
      { point: "Hard evidence behind claims", quote: "What did the data show, exactly?" },
    ]);
    // The made-up question (its evidence isn't checked), the made-up probe and the made-up quote.
    expect(parsed.dropped).toBe(3);
  });

  it("marks a judgment unclear when its evidence isn't in the transcript", () => {
    const parsed = parseTranscriptReply(
      reply({
        asked: [
          {
            question: "Tell me about a time you disagreed with your manager.",
            theme: "conflict",
            landed: "weak",
            evidence: "I never pulled any data",
            note: "Weak.",
            gaps: ["numbers"],
          },
        ],
      }),
      TRANSCRIPT,
    );
    expect(parsed.asked[0]).toMatchObject({ landed: "unclear", note: "", evidence: "", gaps: [] });
  });

  it("drops a note with a number that isn't in the transcript, and maps other themes to null", () => {
    const parsed = parseTranscriptReply(
      reply({
        asked: [
          {
            question: "How do you decide what to work on first",
            theme: "other",
            landed: "mixed",
            evidence: "I rank by revenue impact.",
            note: "Say it saved 40% of the team's time.",
            gaps: ["result"],
          },
        ],
      }),
      TRANSCRIPT,
    );
    expect(parsed.asked[0].theme).toBeNull();
    expect(parsed.asked[0].note).toBe("");
    expect(parsed.asked[0].landed).toBe("mixed");
  });

  it("fails when no question traces", () => {
    expect(() =>
      parseTranscriptReply(reply({ asked: [{ question: "Why Initech?" }] }), TRANSCRIPT),
    ).toThrow(/couldn't find the interviewer's questions/);
    expect(() => parseTranscriptReply("no json", TRANSCRIPT)).toThrow(/unexpected format/);
  });
});

function analysis(asked: Partial<TranscriptAnalysis["asked"][number]>[], lookingFor: string[] = []): TranscriptAnalysis {
  return {
    summary: "",
    lookingFor: lookingFor.map((point) => ({ point, quote: "q" })),
    asked: asked.map((q, i) => ({
      question: `Question ${i}`,
      theme: null,
      probes: [],
      landed: "strong",
      note: "",
      evidence: "",
      gaps: [],
      ...q,
    })),
    dropped: 0,
    model: "m",
    analyzedAt: "",
  };
}

describe("insights across transcripts", () => {
  const transcripts = [
    {
      id: "a",
      title: "Round 1",
      targetJobId: "job-1",
      company: "Initech",
      analysis: analysis(
        [
          { question: "Tell me about a conflict.", theme: "conflict", landed: "weak", gaps: ["numbers", "result"], probes: ["How many customers?"] },
          { question: "How do you prioritize?", theme: "prioritization", landed: "strong" },
          { question: "Explain a SQL join.", theme: null, landed: "mixed", gaps: ["concise"] },
        ],
        ["Hard evidence"],
      ),
    },
    {
      id: "b",
      title: "Other company",
      targetJobId: null,
      company: "Globex",
      analysis: analysis(
        [
          { question: "Tell me about a disagreement.", theme: "conflict", landed: "mixed", gaps: ["numbers"], probes: ["What changed after?"] },
          { question: "Tell me about yourself.", theme: "about_you", landed: "strong" },
        ],
        ["hard evidence", "Executive presence"],
      ),
    },
    { id: "c", title: "Not reviewed", targetJobId: null, company: null, analysis: null },
  ];

  it("counts themes, recurring gaps and what interviewers looked for", () => {
    const insights = summarizeTranscripts(transcripts);
    expect(insights.analyzed).toBe(2);
    expect(insights.themes[0]).toMatchObject({ theme: "conflict", asked: 2, weak: 2 });
    expect(insights.themes[0].probes).toEqual(["How many customers?", "What changed after?"]);
    // Only gaps in two or more answers recur.
    expect(insights.recurringGaps).toEqual([{ gap: "numbers", count: 2, transcripts: 2 }]);
    expect(insights.lookingFor[0]).toBe("Hard evidence");
  });

  it("names a story for themes that didn't land or keep coming up", () => {
    const { storyFocus } = summarizeTranscripts(transcripts);
    expect(storyFocus).toEqual([
      {
        storyType: "difficult_stakeholder",
        theme: "conflict",
        why: "Asked 2 times; your answers didn't land.",
      },
    ]);
  });

  it("splits past questions into this job or company, and elsewhere, behavioral only", () => {
    const byJob = pastQuestionsFor({ id: "job-1", company: null }, transcripts);
    expect(byJob.thisJob).toEqual(["Tell me about a conflict.", "How do you prioritize?"]);
    expect(byJob.elsewhere).toEqual(["Tell me about a disagreement.", "Tell me about yourself."]);
    expect(byJob.transcripts).toBe(2);
    const byCompany = pastQuestionsFor({ id: "job-9", company: " globex " }, transcripts);
    expect(byCompany.thisJob).toEqual(["Tell me about a disagreement.", "Tell me about yourself."]);
  });

  it("gives the story builder the probes and gaps for a story type", () => {
    const insights = summarizeTranscripts(transcripts);
    const notes = notesForStoryType(insights, "difficult_stakeholder");
    expect(notes).toEqual({
      probes: ["How many customers?", "What changed after?"],
      gaps: [{ label: "Numbers", count: 2 }],
    });
    expect(notesForStoryType(summarizeTranscripts([]), "went_wrong")).toBeUndefined();

    const [message] = probeMessages(emptyContent(), getStoryType("difficult_stakeholder"), notes);
    expect(message.content).toContain("From transcripts of my real interviews");
    expect(message.content).toContain("- How many customers?");
    expect(message.content).toContain("- Numbers (2 answers)");
    const [plain] = probeMessages(emptyContent(), getStoryType("difficult_stakeholder"));
    expect(plain.content).not.toContain("real interviews");
  });
});

describe("likely questions from past interviews", () => {
  const job = { title: "SE", company: "Initech", level: "senior", description: "Posting." };

  it("puts past questions in the prompt", () => {
    const [message] = likelyQuestionsMessages({
      job,
      otherJobs: [],
      shared: [],
      reports: "",
      past: { thisJob: ["Tell me about a conflict."], elsewhere: ["Why sales?"] },
    });
    expect(message.content).toContain("earlier interviews for this job or company\n- Tell me about a conflict.");
    expect(message.content).toContain("other companies\n- Why sales?");
  });

  it("only keeps the transcript source when there were transcripts for this job", () => {
    const text = JSON.stringify({
      questions: [{ question: "Tell me about a conflict.", theme: "conflict", why: "asked before", source: "transcript" }],
    });
    const flags = { hasOtherJobs: false, hasReports: false };
    expect(parseLikelyQuestionsReply(text, { ...flags, hasPastForJob: true })[0].source).toBe("transcript");
    expect(parseLikelyQuestionsReply(text, flags)[0].source).toBe("common");
  });
});
