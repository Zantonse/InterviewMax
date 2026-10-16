import { MAX_PATH_LENGTH, MAX_TARGET_LENGTH } from "./kinds";

// Pure helpers for the click tracker in src/instrumentation-client.ts, kept apart so they can be
// tested. Nothing here reads text off the page: an element is described by its tag and the labels
// the app itself gives it (test id, id, field name, link path), never by what it shows.

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

// The path without its query or hash, which could carry more than we want to keep.
export function cleanPath(url: string): string {
  let path = url;
  try {
    path = new URL(url, "http://x").pathname;
  } catch {
    path = url.split(/[?#]/)[0];
  }
  if (!path.startsWith("/")) path = `/${path}`;
  return path.slice(0, MAX_PATH_LENGTH);
}

// Pages not worth tracking: the pages open to signed-out visitors (there's often no one to file
// them under; see PUBLIC_PATHS in src/lib/supabase/proxy.ts) and the admin panel.
export function isTrackedPath(path: string): boolean {
  return !/^\/(login|auth|privacy|ai-usage|account-deleted|admin|api)(\/|$)/.test(path);
}

export type ElementInfo = {
  tag: string;
  testId?: string | null;
  id?: string | null;
  name?: string | null;
  href?: string | null;
  type?: string | null;
  // The test id of the nearest labelled ancestor, when the element has none of its own.
  within?: string | null;
};

const SAFE = /[^\w\-./:[\]]/g;

function safe(value: string): string {
  return value.replace(SAFE, "").slice(0, 60);
}

// A short label for an element, e.g. `button#story-next` or `a /jobs/[id]`. Ids in link paths are
// replaced so the label groups the same link across users.
export function describeElement(el: ElementInfo): string {
  const parts = [el.tag.toLowerCase()];
  if (el.testId) parts.push(`[${safe(el.testId)}]`);
  else if (el.id && !/^[:«]|^radix-|^react-/.test(el.id)) parts.push(`#${safe(el.id)}`);
  if (el.name) parts.push(`name=${safe(el.name)}`);
  if (el.type && el.tag.toLowerCase() === "input") parts.push(`type=${safe(el.type)}`);
  if (el.href) {
    const path = cleanPath(el.href).replace(UUID_RE, "[id]");
    parts.push(safe(path));
  }
  if (el.within && !el.testId) parts.push(`in [${safe(el.within)}]`);
  return parts.join(" ").slice(0, MAX_TARGET_LENGTH);
}

// A page error's message, kept short and stripped to plain characters. Messages come from code,
// not from what the user typed.
export function errorLabel(message: unknown): string {
  const text = typeof message === "string" ? message : String(message ?? "");
  return text.replace(/[^\w .,:'()-]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
}

export type Click = { x: number; y: number; at: number };

export const RAGE_CLICKS = 3;
export const RAGE_WINDOW_MS = 1000;
export const RAGE_RADIUS_PX = 30;

// Remembers recent clicks and says when the latest one completes a rage click: three or more
// within a second, close together. A burst is reported once, however long it goes on.
export class RageDetector {
  private clicks: Click[] = [];
  private reported = false;

  add(click: Click): boolean {
    this.clicks = this.clicks.filter(
      (c) =>
        click.at - c.at <= RAGE_WINDOW_MS &&
        Math.hypot(c.x - click.x, c.y - click.y) <= RAGE_RADIUS_PX,
    );
    if (this.clicks.length === 0) this.reported = false;
    this.clicks.push(click);
    if (this.clicks.length >= RAGE_CLICKS && !this.reported) {
      this.reported = true;
      return true;
    }
    return false;
  }
}
