import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH, MIN_DESCRIPTION_LENGTH } from "./content";
import {
  SUPPORTED_SITES,
  fromAshby,
  fromGreenhouse,
  fromLever,
  fromPage,
  fromWorkday,
  parsePostingUrl,
  type FetchedPosting,
} from "./posting-sources";

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;

const PASTE_INSTEAD =
  "Open the posting and save it as a PDF (Print, then Save as PDF) to upload below, or paste its text instead.";

// Fetches the posting a link points to. Throws an Error whose message can be shown to the user.
export async function fetchPosting(link: string): Promise<FetchedPosting> {
  const source = parsePostingUrl(link);
  if (!source) throw new Error("That doesn't look like a link. Copy the posting's address and try again.");
  if (source.kind === "linkedin") {
    throw new Error(`LinkedIn doesn't let other sites read its job pages. ${PASTE_INSTEAD}`);
  }

  // Job boards that list other companies' postings usually block servers from reading them. The
  // company's own posting (often Greenhouse, Lever, Ashby or Workday) is one click away.
  const board = source.kind === "page" ? jobBoardName(source.pageUrl) : undefined;
  const instead = board
    ? `${board} usually blocks other sites from reading its pages. On ${board}, use "Apply on company site" and paste that link, or ${PASTE_INSTEAD.charAt(0).toLowerCase()}${PASTE_INSTEAD.slice(1)}`
    : PASTE_INSTEAD;

  let found: FetchedPosting | null;
  try {
    switch (source.kind) {
      case "greenhouse":
        found = fromGreenhouse(await getJson(source.apiUrl), source.board);
        break;
      case "lever":
        found = fromLever(await getJson(source.apiUrl), source.site);
        break;
      case "ashby":
        found = fromAshby(await getJson(source.apiUrl), source.org, source.jobId);
        break;
      case "workday":
        found = fromWorkday(await getJson(source.apiUrl), source.tenant);
        break;
      case "page":
        found = fromPage(await getText(source.pageUrl, "text/html"));
        break;
    }
  } catch (err) {
    if (err instanceof FetchError) throw new Error(`${err.message} ${instead}`);
    throw err;
  }

  if (!found || found.description.length < MIN_DESCRIPTION_LENGTH) {
    throw new Error(
      board
        ? `I couldn't read the posting. ${instead}`
        : source.kind === "page"
        ? `I couldn't find the posting on that page; some sites only show it after loading in a browser. ${PASTE_INSTEAD} (Links from ${SUPPORTED_SITES.join(", ")} work best.)`
        : `I couldn't find that posting. It may have closed. ${PASTE_INSTEAD}`,
    );
  }
  return {
    title: found.title.slice(0, MAX_TITLE_LENGTH),
    company: found.company.slice(0, MAX_TITLE_LENGTH),
    description: found.description.slice(0, MAX_DESCRIPTION_LENGTH),
  };
}

const JOB_BOARDS: [RegExp, string][] = [
  [/(^|\.)indeed\.[a-z.]+$/, "Indeed"],
  [/(^|\.)glassdoor\.[a-z.]+$/, "Glassdoor"],
  [/(^|\.)ziprecruiter\.com$/, "ZipRecruiter"],
  [/(^|\.)monster\.[a-z.]+$/, "Monster"],
];

export function jobBoardName(pageUrl: string): string | undefined {
  const host = new URL(pageUrl).hostname.toLowerCase();
  return JOB_BOARDS.find(([re]) => re.test(host))?.[1];
}

class FetchError extends Error {}

async function getJson(url: string): Promise<unknown> {
  const text = await getText(url, "application/json");
  try {
    return JSON.parse(text);
  } catch {
    throw new FetchError("That site sent back something I couldn't read.");
  }
}

// Fetches a public page, following a few redirects and checking each hop isn't a private address.
async function getText(url: string, accept: string): Promise<string> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublic(current);
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          accept,
          "user-agent": "Mozilla/5.0 (compatible; InterviewMax/1.0; job posting import)",
        },
      });
    } catch {
      throw new FetchError("That site didn't respond.");
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) break;
      current = new URL(location, current).toString();
      continue;
    }
    if (res.status === 404 || res.status === 410) {
      throw new FetchError("That posting wasn't found; it may have closed.");
    }
    if (!res.ok) throw new FetchError("That site wouldn't share the posting.");
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) {
      throw new FetchError("That page is too large to read.");
    }
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new FetchError("That page is too large to read.");
    return text;
  }
  throw new FetchError("That link redirected too many times.");
}

// Refuses links that resolve to this server's own network.
async function assertPublic(url: string): Promise<void> {
  const { protocol, hostname } = new URL(url);
  if (protocol !== "https:" && protocol !== "http:") throw new FetchError("That link can't be read.");
  const host = hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  } catch {
    throw new FetchError("I couldn't find that site.");
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new FetchError("That link can't be read.");
  }
}

export function isPrivateAddress(address: string): boolean {
  const v4 = address.replace(/^::ffff:/i, "");
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = address.toLowerCase();
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}
