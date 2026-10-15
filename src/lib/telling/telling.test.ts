import { describe, expect, it } from "vitest";
import { parseContent } from "@/lib/stories/content";
import { getStoryType } from "@/lib/stories/story-types";
import { tellingProblems } from "./checks";
import {
  canTell,
  draftChecks,
  parseTelling,
  pauseBefore,
  roleWordsFrom,
  speakingSeconds,
  tellingIsCurrent,
  versionChecks,
  versionText,
  withEmphasis,
  type Beat,
  type StoryTelling,
} from "./content";
import { TELL_SYSTEM, parseTellReply, tellMessages } from "./prompts";

const conflict = getStoryType("conflict");
const aboutMe = getStoryType("about_me");

const ANSWERS = `We were two weeks from launch and the vendor API kept timing out.
I saw two paths: delay the launch or cut scope. I cut scope because the customer cared about the date.
I remember the CTO saying "we ship Friday or we lose them" in the hallway.
We launched on time and renewed the $2.4M contract, 20% above plan.`;

const words = (n: number, w = "word") => Array.from({ length: n }, () => w).join(" ");

const shortBeats: Beat[] = [
  { beat: "stakes", text: "Two weeks out, the vendor API kept timing out and the customer was watching." },
  { beat: "turn", text: "I saw two paths: delay or cut scope. I cut scope because the customer cared about the date." },
  { beat: "landing", text: "We launched on time and renewed the $2.4M contract, 20% above plan." },
  { beat: "link", text: "That's the call your platform team makes every quarter." },
];

const longBeats: Beat[] = [
  shortBeats[0],
  shortBeats[1],
  { beat: "detail", text: "The CTO told me in the hallway: we ship Friday or we lose them." },
  { beat: "actions", text: `Three things I did. ${words(150)}.` },
  shortBeats[2],
  shortBeats[3],
];

function telling(over: Partial<StoryTelling> = {}): StoryTelling {
  return {
    hooks: ["I saved a $2.4M renewal by cutting scope two weeks before launch.", "We were about to lose our biggest customer."],
    hookIndex: 0,
    detail: { quote: "we ship Friday or we lose them" },
    versions: { short: shortBeats, long: longBeats },
    draftChecks: [],
    untracedNumbers: [],
    model: "m",
    draftWrittenAt: "2026-10-15T10:00:00Z",
    coachedAt: "2026-10-15T10:05:00Z",
    ...over,
  };
}

describe("how to tell it: checks in code", () => {
  it("flags a long setup, a buried result and an ending that trails off in a written story", () => {
    const checks = draftChecks(
      {
        situation: words(60, "setup"),
        role: words(30, "role"),
        actions: words(60, "did"),
        result: "We renewed the $2.4M contract, 20% above plan.",
        reflection: "I learned to cut scope early and say so plainly.",
      },
      conflict,
      [],
    );
    expect(Object.fromEntries(checks.map((c) => [c.id, c.passed]))).toEqual({
      setup: false,
      buried: false,
      ending: false,
    });
  });

  it("passes a story that opens on its result and ends on the role", () => {
    const checks = draftChecks(
      {
        situation: "We renewed the $2.4M contract after a hard launch.",
        role: "I owned the launch.",
        actions: words(80, "did"),
        result: "We renewed the $2.4M contract, 20% above plan.",
        reflection: "It's the same call a Staff PM at Acme makes.",
      },
      conflict,
      roleWordsFrom([{ title: "Staff PM", company: "Acme" }]),
    );
    expect(checks.every((c) => c.passed)).toBe(true);
  });

  it("passes a told version that ends on a link to the role", () => {
    const checks = versionChecks(telling().hooks[0], longBeats);
    expect(checks.every((c) => c.passed)).toBe(true);
    // Without the link, an ending with no number trails off.
    const noLink = versionChecks("Hook.", [shortBeats[0], shortBeats[1], { beat: "landing", text: "It went well." }]);
    expect(noLink.find((c) => c.id === "ending")?.passed).toBe(false);
  });

  it("names the problems for a retry: invented figures, length, an unquoted detail", () => {
    const reply = {
      hooks: ["I saved a $3M renewal.", "We were about to lose them."],
      detail: { quote: "the room went silent" },
      versions: { short: [...shortBeats, { beat: "actions" as const, text: words(100) }], long: longBeats },
    };
    const problems = tellingProblems(reply, ANSWERS);
    expect(problems.some((p) => p.includes("$3M"))).toBe(true);
    expect(problems.some((p) => p.includes('"short" version is'))).toBe(true);
    expect(problems.some((p) => p.includes("word for word"))).toBe(true);
    expect(
      tellingProblems({ hooks: telling().hooks, detail: telling().detail, versions: telling().versions }, ANSWERS),
    ).toEqual([]);
  });
});

describe("how to tell it: cues", () => {
  it("pauses before the turn and the landing, and stresses the figures", () => {
    expect(pauseBefore("turn")).toBe(true);
    expect(pauseBefore("landing")).toBe(true);
    expect(pauseBefore("stakes")).toBe(false);
    expect(withEmphasis("We renewed the $2.4M contract, 20% above plan.", true)).toEqual([
      { text: "We renewed the ", emphasis: false },
      { text: "$2.4M", emphasis: true },
      { text: " contract, ", emphasis: false },
      { text: "20%", emphasis: true },
      { text: " above plan.", emphasis: false },
    ]);
    expect(withEmphasis("No figures.", true)).toEqual([{ text: "No figures.", emphasis: false }]);
  });

  it("says the picked hook first and times each version", () => {
    const t = telling({ hookIndex: 1 });
    expect(versionText(t, "short").startsWith("We were about to lose our biggest customer.")).toBe(true);
    expect(speakingSeconds(words(75))).toBe(30);
    expect(speakingSeconds(words(300))).toBe(120);
  });
});

describe("how to tell it: storage", () => {
  it("round-trips through stories.content and goes stale when the story is rewritten", () => {
    const t = telling();
    const content = parseContent({ version: 1, answers: {}, telling: t });
    expect(content.telling).toEqual(t);
    expect(tellingIsCurrent(content.telling, t.draftWrittenAt)).toBe(true);
    expect(tellingIsCurrent(content.telling, "2026-10-16T00:00:00Z")).toBe(false);
  });

  it("drops a broken shape and fixes a bad hook pick", () => {
    expect(parseTelling({ hooks: [], versions: {} })).toBeUndefined();
    expect(parseTelling({ ...telling(), versions: { short: shortBeats } })).toBeUndefined();
    expect(parseTelling({ ...telling(), hookIndex: 7 })?.hookIndex).toBe(0);
    expect(parseTelling({ ...telling(), detail: null })?.detail).toHaveProperty("ask");
  });

  it("is for behavioral stories, not About me", () => {
    expect(canTell(conflict)).toBe(true);
    expect(canTell(aboutMe)).toBe(false);
  });
});

describe("how to tell it: prompt", () => {
  it("asks for both versions and never for invented facts or cues", () => {
    expect(TELL_SYSTEM).toContain('"short"');
    expect(TELL_SYSTEM).toContain('"long"');
    expect(TELL_SYSTEM).toContain("Never invent");
    expect(TELL_SYSTEM).toContain("the app adds the delivery cues");
  });

  it("passes the thinking note only when the reasoning isn't shown", () => {
    const base = { title: "T", story: "S", answers: "A", targets: "" };
    const missing = tellMessages({ ...base, thinking: { level: "missing", note: "Only steps.", improve: "Say why." } });
    expect(String(missing[0].content)).toContain("Say why.");
    const shown = tellMessages({ ...base, thinking: { level: "shown", note: "Clear." } });
    expect(String(shown[0].content)).not.toContain("Clear.");
  });

  it("parses a reply and rejects an incomplete one", () => {
    const reply = parseTellReply(
      `Here: ${JSON.stringify({ hooks: ["A", "B", "C"], detail: { ask: "?" }, short: shortBeats, long: longBeats })}`,
    );
    expect(reply.hooks).toEqual(["A", "B"]);
    expect(reply.versions.long).toHaveLength(6);
    expect(() => parseTellReply(JSON.stringify({ hooks: ["A"], short: [] }))).toThrow();
  });
});
