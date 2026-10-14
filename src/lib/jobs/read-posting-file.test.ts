import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const generateForStep = vi.fn();
vi.mock("@/lib/ai", () => ({ generateForStep: (...args: unknown[]) => generateForStep(...args) }));

const { readPostingPage, readPostingScreenshots } = await import("./read-posting-file");

const DUTIES = "You will run technical discovery and demos for enterprise customers. ".repeat(3);

beforeEach(() => generateForStep.mockReset());

describe("readPostingPage", () => {
  it("uses the page's own JobPosting data without a model call", async () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "JobPosting",
      title: "Senior Solutions Engineer",
      hiringOrganization: { name: "Acme" },
      description: `<p>${DUTIES}</p>`,
    })}</script><body>menus</body>`;
    const posting = await readPostingPage(html);
    expect(posting).toMatchObject({ title: "Senior Solutions Engineer", company: "Acme" });
    expect(posting.description).toContain("technical discovery");
    expect(generateForStep).not.toHaveBeenCalled();
  });

  it("keeps only the lines the model copied from the page", async () => {
    generateForStep.mockResolvedValue({
      text: JSON.stringify({
        title: "Senior Solutions Engineer",
        company: "Acme",
        lines: [DUTIES.trim(), "10+ years leading teams"],
      }),
    });
    const posting = await readPostingPage(
      `<body><h1>Senior Solutions Engineer</h1><p>${DUTIES}</p><p>People also viewed</p></body>`,
    );
    expect(generateForStep.mock.calls[0][0]).toBe("postingExtract");
    expect(posting.description).toBe(DUTIES.trim());
  });
});

describe("readPostingScreenshots", () => {
  const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], "shot.png");

  it("sends the images to the screenshot step", async () => {
    generateForStep.mockResolvedValue({
      text: JSON.stringify({ title: "SE", company: "Acme", lines: [DUTIES.trim()] }),
    });
    const posting = await readPostingScreenshots([png]);
    expect(posting.title).toBe("SE");
    const [step, request] = generateForStep.mock.calls[0];
    expect(step).toBe("postingScreenshot");
    expect(request.messages[0].content[0]).toMatchObject({ type: "image", mediaType: "image/png" });
  });

  it("refuses a file that isn't an image", async () => {
    const fake = new File(["<html>"], "shot.png");
    await expect(readPostingScreenshots([fake])).rejects.toThrow("PNG, JPEG or WebP");
  });
});
