import { describe, expect, it } from "vitest";
import { RageDetector, cleanPath, describeElement, errorLabel, isTrackedPath } from "./detect";
import { parseSignals } from "./parse";
import { groupVisits, type StoredSignal } from "./visits";

describe("cleanPath", () => {
  it("drops the query and hash", () => {
    expect(cleanPath("https://app.test/jobs/new?link=x#top")).toBe("/jobs/new");
    expect(cleanPath("/assessment?retake=1")).toBe("/assessment");
  });
});

describe("isTrackedPath", () => {
  it("skips pages open to signed-out visitors, the admin panel and the API", () => {
    expect(isTrackedPath("/stories/abc")).toBe(true);
    expect(isTrackedPath("/")).toBe(true);
    expect(isTrackedPath("/login")).toBe(false);
    expect(isTrackedPath("/auth/continue")).toBe(false);
    expect(isTrackedPath("/privacy")).toBe(false);
    expect(isTrackedPath("/admin/users/1")).toBe(false);
    expect(isTrackedPath("/administer")).toBe(true);
  });
});

describe("describeElement", () => {
  it("uses the app's own labels, never page text", () => {
    expect(describeElement({ tag: "BUTTON", testId: "story-next" })).toBe("button [story-next]");
    expect(describeElement({ tag: "TEXTAREA", name: "answer", within: "composer" })).toBe(
      "textarea name=answer in [composer]",
    );
    expect(describeElement({ tag: "INPUT", name: "date", type: "date" })).toBe(
      "input name=date type=date",
    );
  });

  it("replaces ids in link paths and skips React's generated ids", () => {
    expect(
      describeElement({ tag: "A", href: "/stories/123e4567-e89b-12d3-a456-426614174000?x=1" }),
    ).toBe("a /stories/[id]");
    expect(describeElement({ tag: "DIV", id: "«r3»" })).toBe("div");
  });

  it("strips characters that could carry anything else", () => {
    expect(describeElement({ tag: "DIV", testId: 'a"><script>' })).toBe("div [ascript]");
  });
});

describe("errorLabel", () => {
  it("keeps short plain messages", () => {
    expect(errorLabel("TypeError: x is <undefined>")).toBe("TypeError: x is undefined");
    expect(errorLabel("a".repeat(300))).toHaveLength(120);
  });
});

describe("RageDetector", () => {
  it("reports three quick clicks in one spot, once per burst", () => {
    const rage = new RageDetector();
    expect(rage.add({ x: 10, y: 10, at: 0 })).toBe(false);
    expect(rage.add({ x: 12, y: 11, at: 200 })).toBe(false);
    expect(rage.add({ x: 11, y: 9, at: 400 })).toBe(true);
    expect(rage.add({ x: 10, y: 10, at: 600 })).toBe(false);
  });

  it("ignores slow or spread-out clicks", () => {
    const rage = new RageDetector();
    rage.add({ x: 0, y: 0, at: 0 });
    rage.add({ x: 0, y: 0, at: 900 });
    expect(rage.add({ x: 0, y: 0, at: 2000 })).toBe(false);
    const spread = new RageDetector();
    spread.add({ x: 0, y: 0, at: 0 });
    spread.add({ x: 100, y: 0, at: 100 });
    expect(spread.add({ x: 200, y: 0, at: 200 })).toBe(false);
  });

  it("can report again after the burst ends", () => {
    const rage = new RageDetector();
    [0, 100, 200].forEach((at) => rage.add({ x: 0, y: 0, at }));
    rage.add({ x: 0, y: 0, at: 5000 });
    rage.add({ x: 0, y: 0, at: 5100 });
    expect(rage.add({ x: 0, y: 0, at: 5200 })).toBe(true);
  });
});

describe("parseSignals", () => {
  const now = 1_000_000_000;

  it("keeps well-formed signals and drops the rest", () => {
    const parsed = parseSignals(
      {
        signals: [
          { kind: "rage_click", path: "/jobs", target: "button", at: now - 1000 },
          { kind: "nope", path: "/jobs" },
          { kind: "page_view", path: "https://evil.test/" },
          { kind: "page_view", path: "/", at: now + 60_000 },
        ],
      },
      now,
    );
    expect(parsed).toEqual([
      { kind: "rage_click", path: "/jobs", target: "button", at: now - 1000 },
      { kind: "page_view", path: "/", target: "", at: now },
    ]);
  });

  it("caps the batch and the lengths", () => {
    const many = Array.from({ length: 80 }, () => ({ kind: "page_view", path: `/${"x".repeat(400)}` }));
    const parsed = parseSignals({ signals: many }, now);
    expect(parsed).toHaveLength(50);
    expect(parsed[0].path).toHaveLength(200);
    expect(parseSignals(null)).toEqual([]);
    expect(parseSignals({ signals: "x" })).toEqual([]);
  });
});

describe("groupVisits", () => {
  const at = (minutes: number) => new Date(Date.UTC(2026, 9, 16, 9, 0) + minutes * 60_000).toISOString();
  const s = (kind: StoredSignal["kind"], minutes: number, path = "/"): StoredSignal => ({
    kind,
    path,
    target: "",
    at: at(minutes),
  });

  it("splits on a half-hour gap, newest visit first, and counts trouble", () => {
    const visits = groupVisits([
      s("page_view", 0, "/"),
      s("page_view", 2, "/jobs/new"),
      s("form_abandoned", 3, "/jobs/new"),
      s("left", 3, "/jobs/new"),
      s("page_view", 120, "/"),
      s("rage_click", 121, "/"),
    ]);
    expect(visits).toHaveLength(2);
    expect(visits[0]).toMatchObject({ start: at(120), pages: 1, friction: 1 });
    expect(visits[1]).toMatchObject({ start: at(0), end: at(3), pages: 2, friction: 1 });
    expect(visits[1].signals.map((x) => x.kind)).toEqual([
      "page_view",
      "page_view",
      "form_abandoned",
      "left",
    ]);
  });
});
