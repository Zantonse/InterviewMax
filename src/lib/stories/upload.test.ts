import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { normalize, readLinkedInPdf, readUploadedAnswer } = await import("./upload");

function file(name: string, body: BlobPart) {
  return new File([body], name);
}

describe("readUploadedAnswer", () => {
  it("reads the text of a Word file", async () => {
    const docx = await readFile(new URL("./fixtures/prepared.docx", import.meta.url));
    const text = await readUploadedAnswer(file("Intro.DOCX", new Uint8Array(docx)));
    expect(text).toBe(
      "I lead solutions engineering for the west region.\n\nLast year I helped close $2.4M in new business.",
    );
  });

  it("reads a text file", async () => {
    expect(await readUploadedAnswer(file("intro.txt", "Hi there.\r\n\r\n\r\nI sell.  "))).toBe(
      "Hi there.\n\nI sell.",
    );
  });

  it("refuses files it can't use", async () => {
    await expect(readUploadedAnswer(file("intro.doc", "x"))).rejects.toThrow(".docx or .txt");
    await expect(readUploadedAnswer(file("intro.pdf", "x"))).rejects.toThrow("Upload a Word");
    await expect(readUploadedAnswer(file("intro.txt", "  \n "))).rejects.toThrow("no text");
    await expect(readUploadedAnswer(file("intro.docx", "not a zip"))).rejects.toThrow(
      "couldn't be read",
    );
    await expect(readUploadedAnswer(file("intro.txt", "a".repeat(12001)))).rejects.toThrow(
      "more than 12,000",
    );
  });
});

describe("readLinkedInPdf", () => {
  it("reads the text of a profile PDF", async () => {
    const pdf = await readFile(new URL("./fixtures/linkedin.pdf", import.meta.url));
    const text = await readLinkedInPdf(file("Profile.pdf", new Uint8Array(pdf)));
    expect(text).toContain("Solutions Engineering Manager at Acme");
    expect(text).toContain("Grew pipeline 35% in 2025.");
  });

  it("refuses files it can't use", async () => {
    await expect(readLinkedInPdf(file("profile.docx", "x"))).rejects.toThrow("Save to PDF");
    await expect(readLinkedInPdf(file("profile.pdf", "not a pdf"))).rejects.toThrow(
      "couldn't be read",
    );
  });
});

describe("normalize", () => {
  it("collapses blank lines and trailing spaces", () => {
    expect(normalize("a  \n\n\n\nb\n")).toBe("a\n\nb");
  });
});
