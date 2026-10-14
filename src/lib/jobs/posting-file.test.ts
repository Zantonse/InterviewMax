import { describe, expect, it } from "vitest";
import {
  POSTING_EXTRACT_SYSTEM,
  POSTING_SCREENSHOT_SYSTEM,
  parsePostingExtract,
  parsePostingScreenshot,
  postingExtractMessages,
  postingFileKind,
  postingScreenshotMessages,
  savedPageHtml,
  slimHtml,
} from "./posting-file";

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
    const reply = JSON.stringify({
      title: "Principal SE",
      company: "Globex",
      lines: ["Requirements"],
    });
    expect(parsePostingExtract(reply, PDF)).toMatchObject({
      title: "",
      company: "",
    });
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

describe("postingFileKind", () => {
  it("sorts files by extension", () => {
    expect(postingFileKind("Job.PDF")).toBe("pdf");
    expect(postingFileKind("job.html")).toBe("page");
    expect(postingFileKind("job.mhtml")).toBe("page");
    expect(postingFileKind("Screenshot 2026-10-14.png")).toBe("image");
    expect(postingFileKind("shot.jpeg")).toBe("image");
    expect(postingFileKind("resume.docx")).toBeNull();
  });
});

describe("savedPageHtml", () => {
  it("unwraps the HTML part of an .mhtml file", () => {
    const mhtml = [
      "From: <Saved by Blink>",
      "MIME-Version: 1.0",
      'Content-Type: multipart/related; type="text/html"; boundary="----MultipartBoundary--abc"',
      "",
      "------MultipartBoundary--abc",
      "Content-Type: text/html",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      '<html><body><h1 class=3D"t">Senior Solutions Engineer</h1><p>Caf=C3=A9 =',
      "perks</p></body></html>",
      "------MultipartBoundary--abc",
      "Content-Type: text/css",
      "",
      "body{}",
      "------MultipartBoundary--abc--",
    ].join("\r\n");
    const html = savedPageHtml("job.mhtml", mhtml);
    expect(html).toContain('<h1 class="t">Senior Solutions Engineer</h1>');
    expect(html).toContain("Café perks");
    expect(html).not.toContain("body{}");
  });

  it("leaves an .html file as it is", () => {
    expect(savedPageHtml("job.html", "<p>x</p>")).toBe("<p>x</p>");
  });
});

describe("slimHtml", () => {
  it("drops scripts, styles and attributes but keeps the posting data", () => {
    const html = `<head><style>.a{}</style><script>track()</script>
<script type="application/ld+json">{"@type":"JobPosting","title":"SE"}</script>
<meta property="og:title" content="SE at Acme"></head>
<body><div class="x" data-id="1" style="color:red"><img src="a.png"><p>Run demos</p></div><svg><path d="M0"/></svg></body>`;
    const slim = slimHtml(html);
    expect(slim).not.toContain("track()");
    expect(slim).not.toContain(".a{}");
    expect(slim).not.toContain("class=");
    expect(slim).not.toContain("<img");
    expect(slim).not.toContain("<svg");
    expect(slim).toContain('"@type":"JobPosting"');
    expect(slim).toContain('content="SE at Acme"');
    expect(slim).toContain("<div><p>Run demos</p></div>");
  });
});

describe("parsePostingScreenshot", () => {
  it("keeps the copied lines and drops a line repeated across overlapping shots", () => {
    const reply = JSON.stringify({
      title: "Senior Solutions Engineer",
      company: "Acme",
      lines: ["About the job", "Run demos", "Run  demos", "", "Requirements"],
    });
    expect(parsePostingScreenshot(reply)).toEqual({
      title: "Senior Solutions Engineer",
      company: "Acme",
      description: "About the job\nRun demos\nRequirements",
    });
  });

  it("returns null when nothing usable comes back", () => {
    expect(parsePostingScreenshot("no json")).toBeNull();
    expect(parsePostingScreenshot(JSON.stringify({ title: "x", lines: [] }))).toBeNull();
  });

  it("sends the images before the request and asks for visible text only", () => {
    const [message] = postingScreenshotMessages([
      { mediaType: "image/jpeg", data: "QQ==" },
      { mediaType: "image/jpeg", data: "Qg==" },
    ]);
    expect(Array.isArray(message.content) && message.content.map((p) => p.type)).toEqual([
      "image",
      "image",
      "text",
    ]);
    expect(POSTING_SCREENSHOT_SYSTEM).toContain("copy only text you can actually see");
  });
});
