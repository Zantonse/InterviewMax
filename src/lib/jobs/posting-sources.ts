import { isRecord } from "./content";

// Turns a job posting link into the posting's title, company and text. Plain code, no model call.
// The big applicant-tracking systems have public JSON for each posting, which is far more reliable
// than reading their pages; any other site is read for the schema.org JobPosting data most job
// pages carry for search engines, then for the page's main text.

export type FetchedPosting = {
  title: string;
  company: string;
  description: string;
};

// Where to get a posting from, worked out from its link.
export type PostingSource =
  | { kind: "greenhouse"; apiUrl: string; board: string }
  | { kind: "lever"; apiUrl: string; site: string }
  | { kind: "ashby"; apiUrl: string; org: string; jobId: string }
  | { kind: "workday"; apiUrl: string; tenant: string }
  | { kind: "linkedin"; pageUrl: string }
  | { kind: "page"; pageUrl: string };

// Sites listed on the form as known to work.
export const SUPPORTED_SITES = ["Greenhouse", "Lever", "Ashby", "Workday"] as const;

export function parsePostingUrl(input: string): PostingSource | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.protocol = "https:";
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);

  // boards.greenhouse.io/{board}/jobs/{id}, job-boards.greenhouse.io/{board}/jobs/{id},
  // and the embed form boards.greenhouse.io/embed/job_app?for={board}&token={id}
  if (host.endsWith("greenhouse.io")) {
    let board: string | undefined;
    let id: string | undefined;
    if (parts[0] === "embed") {
      board = url.searchParams.get("for") ?? undefined;
      id = url.searchParams.get("token") ?? undefined;
    } else if (parts[1] === "jobs") {
      [board, , id] = parts;
    }
    if (board && id && /^\d+$/.test(id)) {
      return {
        kind: "greenhouse",
        board,
        apiUrl: `https://boards-api.greenhouse.io/v1/boards/${enc(board)}/jobs/${id}`,
      };
    }
  }

  // jobs.lever.co/{site}/{id}[/apply], or jobs.eu.lever.co for EU accounts
  if ((host === "jobs.lever.co" || host === "jobs.eu.lever.co") && parts.length >= 2) {
    const api = host === "jobs.eu.lever.co" ? "api.eu.lever.co" : "api.lever.co";
    return {
      kind: "lever",
      site: parts[0],
      apiUrl: `https://${api}/v0/postings/${enc(parts[0])}/${enc(parts[1])}`,
    };
  }

  // jobs.ashbyhq.com/{org}/{id}[/application]
  if (host === "jobs.ashbyhq.com" && parts.length >= 2) {
    return {
      kind: "ashby",
      org: parts[0],
      jobId: parts[1],
      apiUrl: `https://api.ashbyhq.com/posting-api/job-board/${enc(parts[0])}`,
    };
  }

  // {tenant}.wd{n}.myworkdayjobs.com/[{locale}/]{site}/job/{location}/{slug}
  const workday = host.match(/^([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com$/);
  if (workday) {
    const rest = /^[a-z]{2}-[A-Z]{2}$/.test(parts[0] ?? "") ? parts.slice(1) : parts;
    const jobAt = rest.indexOf("job");
    if (jobAt === 1 && rest.length > 2) {
      const [site] = rest;
      return {
        kind: "workday",
        tenant: workday[1],
        apiUrl: `https://${host}/wday/cxs/${workday[1]}/${site}/${rest.slice(1).join("/")}`,
      };
    }
  }

  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
    return { kind: "linkedin", pageUrl: url.toString() };
  }

  return { kind: "page", pageUrl: url.toString() };
}

export function fromGreenhouse(json: unknown, board: string): FetchedPosting | null {
  if (!isRecord(json) || typeof json.title !== "string") return null;
  // The API returns the posting's HTML with its tags entity-encoded.
  const html = typeof json.content === "string" ? decodeEntities(json.content) : "";
  const location = isRecord(json.location) ? str(json.location.name) : "";
  return posting(
    json.title,
    str(json.company_name) || titleCase(board),
    [location && `Location: ${location}`, htmlToText(html)],
  );
}

export function fromLever(json: unknown, site: string): FetchedPosting | null {
  if (!isRecord(json) || typeof json.text !== "string") return null;
  const lists = Array.isArray(json.lists)
    ? json.lists.filter(isRecord).map((l) => `${str(l.text)}\n${htmlToText(str(l.content))}`)
    : [];
  const location = isRecord(json.categories) ? str(json.categories.location) : "";
  return posting(json.text, titleCase(site), [
    location && `Location: ${location}`,
    str(json.descriptionPlain) || htmlToText(str(json.description)),
    ...lists,
    str(json.additionalPlain) || htmlToText(str(json.additional)),
  ]);
}

export function fromAshby(json: unknown, org: string, jobId: string): FetchedPosting | null {
  if (!isRecord(json) || !Array.isArray(json.jobs)) return null;
  const job = json.jobs.filter(isRecord).find((j) => j.id === jobId);
  if (!job || typeof job.title !== "string") return null;
  return posting(job.title, titleCase(org), [
    str(job.location) && `Location: ${str(job.location)}`,
    str(job.descriptionPlain) || htmlToText(str(job.descriptionHtml)),
  ]);
}

export function fromWorkday(json: unknown, tenant: string): FetchedPosting | null {
  if (!isRecord(json) || !isRecord(json.jobPostingInfo)) return null;
  const info = json.jobPostingInfo;
  if (typeof info.title !== "string") return null;
  const company = isRecord(json.hiringOrganization) ? str(json.hiringOrganization.name) : "";
  return posting(info.title, company || titleCase(tenant), [
    str(info.location) && `Location: ${str(info.location)}`,
    htmlToText(str(info.jobDescription)),
  ]);
}

// Any other job page: the schema.org JobPosting most job pages carry, else the page's main text.
export function fromPage(html: string): FetchedPosting | null {
  const ld = jobPostingLd(html);
  if (ld) return ld;
  const title = decodeEntities(
    (html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i)?.[1] ??
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ??
      "").trim(),
  );
  const company = decodeEntities(
    html.match(/<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']*)["']/i)?.[1] ?? "",
  ).trim();
  const main =
    html.match(/<main[\s>][\s\S]*?<\/main>/i)?.[0] ??
    html.match(/<article[\s>][\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<body[\s>][\s\S]*?<\/body>/i)?.[0] ??
    html;
  return posting(title, company, [htmlToText(main)]);
}

function jobPostingLd(html: string): FetchedPosting | null {
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  for (const [, body] of scripts) {
    let json: unknown;
    try {
      json = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const candidates = Array.isArray(json)
      ? json
      : isRecord(json) && Array.isArray(json["@graph"])
        ? json["@graph"]
        : [json];
    for (const item of candidates) {
      if (!isRecord(item) || item["@type"] !== "JobPosting" || typeof item.title !== "string") {
        continue;
      }
      const org = isRecord(item.hiringOrganization) ? str(item.hiringOrganization.name) : "";
      const found = posting(item.title, org, [htmlToText(decodeEntities(str(item.description)))]);
      if (found) return found;
    }
  }
  return null;
}

function posting(title: string, company: string, sections: (string | false)[]): FetchedPosting | null {
  const description = sections
    .filter((s): s is string => Boolean(s && s.trim()))
    .map((s) => s.trim())
    .join("\n\n");
  if (!description) return null;
  return { title: decodeEntities(title).trim(), company: company.trim(), description };
}

// Readable text from HTML: block elements become line breaks, list items become "- " lines.
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|nav|header|footer|form|button)[\s>][\s\S]*?<\/\1>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div|section|h[1-6]|ul|ol|tr|table)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  bull: "•",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function enc(segment: string): string {
  return encodeURIComponent(segment);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
