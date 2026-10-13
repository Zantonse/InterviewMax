import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isPrivateAddress, jobBoardName } from "./fetch-posting";
import {
  decodeEntities,
  fromAshby,
  fromGreenhouse,
  fromLever,
  fromPage,
  fromWorkday,
  htmlToText,
  parsePostingUrl,
} from "./posting-sources";

const LONG = "Own technical discovery and demos for enterprise customers. ".repeat(5);

describe("parsePostingUrl", () => {
  it("maps Greenhouse links to the job board API", () => {
    for (const url of [
      "https://boards.greenhouse.io/acme/jobs/4012345",
      "https://job-boards.greenhouse.io/acme/jobs/4012345?gh_src=x",
      "https://boards.greenhouse.io/embed/job_app?for=acme&token=4012345",
    ]) {
      expect(parsePostingUrl(url)).toEqual({
        kind: "greenhouse",
        board: "acme",
        apiUrl: "https://boards-api.greenhouse.io/v1/boards/acme/jobs/4012345",
      });
    }
  });

  it("maps Lever, including EU and apply links", () => {
    expect(parsePostingUrl("https://jobs.lever.co/acme/1a2b-3c/apply")).toMatchObject({
      kind: "lever",
      apiUrl: "https://api.lever.co/v0/postings/acme/1a2b-3c",
    });
    expect(parsePostingUrl("https://jobs.eu.lever.co/acme/1a2b")).toMatchObject({
      apiUrl: "https://api.eu.lever.co/v0/postings/acme/1a2b",
    });
  });

  it("maps Ashby to its job board API", () => {
    expect(parsePostingUrl("https://jobs.ashbyhq.com/acme/abc-123/application")).toEqual({
      kind: "ashby",
      org: "acme",
      jobId: "abc-123",
      apiUrl: "https://api.ashbyhq.com/posting-api/job-board/acme",
    });
  });

  it("maps Workday with or without a locale", () => {
    const api =
      "https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/External/job/Remote-USA/Senior-SE_R123";
    expect(
      parsePostingUrl("https://acme.wd5.myworkdayjobs.com/en-US/External/job/Remote-USA/Senior-SE_R123"),
    ).toEqual({ kind: "workday", tenant: "acme", apiUrl: api });
    expect(
      parsePostingUrl("https://acme.wd5.myworkdayjobs.com/External/job/Remote-USA/Senior-SE_R123"),
    ).toMatchObject({ apiUrl: api });
  });

  it("recognises LinkedIn, reads anything else as a page, and rejects non-links", () => {
    expect(parsePostingUrl("https://www.linkedin.com/jobs/view/123")?.kind).toBe("linkedin");
    expect(parsePostingUrl("https://careers.acme.com/jobs/42")?.kind).toBe("page");
    expect(parsePostingUrl("not a link")).toBeNull();
    expect(parsePostingUrl("file:///etc/passwd")).toBeNull();
    expect(parsePostingUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("reading each source", () => {
  it("Greenhouse: decodes the entity-encoded HTML", () => {
    const posting = fromGreenhouse(
      {
        title: "Solutions Engineer",
        location: { name: "Remote" },
        content: "&lt;p&gt;You will &lt;strong&gt;run demos&lt;/strong&gt;.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Discovery&lt;/li&gt;&lt;/ul&gt;",
      },
      "acme-corp",
    );
    expect(posting).toEqual({
      title: "Solutions Engineer",
      company: "Acme Corp",
      description: "Location: Remote\n\nYou will run demos.\n\n- Discovery",
    });
  });

  it("Lever: joins the description, lists and closing text", () => {
    const posting = fromLever(
      {
        text: "Senior SE",
        categories: { location: "NYC" },
        descriptionPlain: "About the role.",
        lists: [{ text: "What you'll do", content: "<li>Demos</li><li>POCs</li>" }],
        additionalPlain: "Benefits.",
      },
      "acme",
    );
    expect(posting?.description).toBe(
      "Location: NYC\n\nAbout the role.\n\nWhat you'll do\n- Demos\n- POCs\n\nBenefits.",
    );
    expect(posting?.company).toBe("Acme");
  });

  it("Ashby: finds the job by id on the board", () => {
    const json = {
      jobs: [
        { id: "x", title: "Other", descriptionPlain: "no" },
        { id: "abc", title: "Data Steward", location: "Remote", descriptionPlain: "Govern data." },
      ],
    };
    expect(fromAshby(json, "acme", "abc")?.title).toBe("Data Steward");
    expect(fromAshby(json, "acme", "missing")).toBeNull();
  });

  it("Workday: reads the posting info and hiring organization", () => {
    const posting = fromWorkday(
      {
        jobPostingInfo: { title: "Finance Manager", location: "Austin", jobDescription: "<p>Own the forecast.</p>" },
        hiringOrganization: { name: "Acme Inc." },
      },
      "acme",
    );
    expect(posting).toEqual({
      title: "Finance Manager",
      company: "Acme Inc.",
      description: "Location: Austin\n\nOwn the forecast.",
    });
  });

  it("any page: prefers schema.org JobPosting", () => {
    const html = `<html><head><title>Careers</title>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":"JobPosting","title":"Staff Engineer","hiringOrganization":{"name":"Acme"},"description":"&lt;p&gt;${LONG}&lt;/p&gt;"}]}</script>
      </head><body><nav>Menu</nav><main>Other text</main></body></html>`;
    const posting = fromPage(html);
    expect(posting?.title).toBe("Staff Engineer");
    expect(posting?.company).toBe("Acme");
    expect(posting?.description).toBe(LONG.trim());
  });

  it("any page: falls back to the main text, without nav or scripts", () => {
    const html = `<html><head><meta property="og:title" content="SE &amp; Architect"><meta property="og:site_name" content="Acme"></head>
      <body><nav>Menu</nav><main><h1>SE</h1><script>x()</script><p>${LONG}</p></main></body></html>`;
    const posting = fromPage(html);
    expect(posting?.title).toBe("SE & Architect");
    expect(posting?.company).toBe("Acme");
    expect(posting?.description).toBe(`SE\n\n${LONG.trim()}`);
  });
});

describe("text helpers", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("A &amp; B &#8217; &#x2014; &rsquo; &unknown;")).toBe("A & B ’ — ’ &unknown;");
  });

  it("turns HTML into readable lines", () => {
    expect(htmlToText("<h2>Role</h2><p>One<br>Two</p><ul><li>A</li><li>B</li></ul>")).toBe(
      "Role\n\nOne\nTwo\n\n- A\n- B",
    );
  });
});

describe("isPrivateAddress", () => {
  it.each([
    ["127.0.0.1", true],
    ["10.1.2.3", true],
    ["172.20.0.1", true],
    ["192.168.1.1", true],
    ["169.254.169.254", true],
    ["100.64.0.1", true],
    ["::1", true],
    ["fd00::1", true],
    ["::ffff:10.0.0.1", true],
    ["104.18.1.1", false],
    ["2606:4700::1", false],
  ])("%s → %s", (address, expected) => {
    expect(isPrivateAddress(address)).toBe(expected);
  });
});

describe("jobBoardName", () => {
  it("names the job boards that block reading", () => {
    expect(jobBoardName("https://www.indeed.com/viewjob?jk=abc")).toBe("Indeed");
    expect(jobBoardName("https://uk.indeed.co.uk/viewjob?jk=abc")).toBe("Indeed");
    expect(jobBoardName("https://www.glassdoor.com/job-listing/x")).toBe("Glassdoor");
    expect(jobBoardName("https://careers.acme.com/jobs/1")).toBeUndefined();
  });
});
