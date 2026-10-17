import { describe, expect, it } from "vitest";
import { OWN_WORDS_MIN, ownWordsShare } from "./own-words";

const answers = `I started with firmware engineering at AMI, but then slowly made my way towards sales first by doing implementation consulting.
I wasnt as interested in the more focus work and coding, I actually liked talkign to people more and it was more enjoyable influencing people.
having sold 4.3M and being top of my team in last year and making presidents club. that was 150% of quota`;

describe("ownWordsShare", () => {
  it("scores a draft edited from the user's answers above the bar", () => {
    const edited =
      "I started with firmware engineering at AMI, but I liked talking to people more, so I made my way towards sales by doing implementation consulting. Last year I sold 4.3M, that was 150% of quota, top of my team and making President's Club.";
    expect(ownWordsShare(edited, answers)).toBeGreaterThanOrEqual(OWN_WORDS_MIN);
  });

  it("scores a corporate rewrite of the same facts below the bar", () => {
    const rewritten =
      "My career began in embedded systems, which provided a strong technical foundation before I transitioned into customer-facing roles. In the most recent fiscal year, I achieved 150% quota attainment, generating 4.3M in revenue and earning President's Club recognition.";
    expect(ownWordsShare(rewritten, answers)).toBeLessThan(OWN_WORDS_MIN);
  });

  it("ignores case, punctuation and curly apostrophes", () => {
    expect(ownWordsShare("I’m on the West Coast team.", "i'm on the west coast team")).toBe(1);
  });

  it("keeps figures whole", () => {
    expect(ownWordsShare("I sold 4.3M last year", "I sold 4.3M last year.")).toBe(1);
    expect(ownWordsShare("I sold 4.3M last year", "I sold 4 3M last year")).toBeLessThan(1);
  });

  it("is 0 for an empty draft", () => {
    expect(ownWordsShare("", answers)).toBe(0);
  });
});
