import { describe, expect, it } from "vitest";
import { POSTING_EXTRACT_SYSTEM, parsePostingExtract, postingExtractMessages } from "./posting-pdf";

const PDF = `LinkedIn
Home My Network Jobs
Senior Solutions Engineer
Acme · Austin, TX (Remote) · 2 days ago · Over 100 applicants
Apply Save
About the job
You will run   technical discovery and demos
for enterprise customers.
Requirements
- 5+ years in pre-sales
People also viewed
Account Executive at Other Co`;

describe("parsePostingExtract", () => {
  it("keeps only lines that appear in the PDF", () => {
    const reply = JSON.stringify({
      title: "Senior Solutions Engineer",
      company: "Acme",
      lines: [
        "About the job",
        "You will run technical discovery and demos",
        "Requirements",
        "- 5+ years in pre-sales",
        "- 10+ years leading teams",
      ],
    });
    expect(parsePostingExtract(reply, PDF)).toEqual({
      title: "Senior Solutions Engineer",
      company: "Acme",
      description:
        "About the job\nYou will run technical discovery and demos\nRequirements\n- 5+ years in pre-sales",
    });
  });

  it("drops a title or company that isn't in the PDF", () => {
    const reply = JSON.stringify({ title: "Principal SE", company: "Globex", lines: ["Requirements"] });
    expect(parsePostingExtract(reply, PDF)).toMatchObject({ title: "", company: "" });
  });

  it("returns null when nothing usable comes back", () => {
    expect(parsePostingExtract("no json", PDF)).toBeNull();
    expect(parsePostingExtract(JSON.stringify({ lines: ["Made up line"] }), PDF)).toBeNull();
  });

  it("sends the PDF text and asks for copied lines only", () => {
    expect(postingExtractMessages("abc")[0].content).toContain("abc");
    expect(POSTING_EXTRACT_SYSTEM).toContain("copy the posting's lines exactly");
  });
});
