import { describe, expect, it } from "vitest";
import {
  clipText,
  describeControls,
  isBlockedControl,
  typedNote,
  filledBoxes,
  newText,
  parseTurn,
  personaSystemPrompt,
  personaTurnPrompt,
  summarizeTurn,
} from "./agent";
import { PERSONAS } from "./personas";

describe("parseTurn", () => {
  it("reads a plain JSON reply", () => {
    const turn = parseTurn('{"thought":"ok","feeling":"calm","action":{"type":"click","id":4}}');
    expect(turn).toEqual({ thought: "ok", feeling: "calm", action: { type: "click", id: 4 } });
  });

  it("finds the JSON inside prose and code fences", () => {
    const turn = parseTurn('Sure!\n```json\n{"thought":"hm","action":{"type":"type","id":"2","text":"hello"}}\n```');
    expect(turn?.action).toEqual({ type: "type", id: 2, text: "hello" });
  });

  it("accepts an action at the top level", () => {
    expect(parseTurn('{"type":"give_up","reason":"too long"}')?.action).toEqual({
      type: "give_up",
      reason: "too long",
    });
  });

  it("rejects bad actions", () => {
    expect(parseTurn("no json here")).toBeNull();
    expect(parseTurn('{"action":{"type":"click"}}')).toBeNull();
    expect(parseTurn('{"action":{"type":"type","id":1,"text":"  "}}')).toBeNull();
    expect(parseTurn('{"action":{"type":"goto","path":"https://evil.example"}}')).toBeNull();
    expect(parseTurn('{"action":{"type":"goto","path":"//evil.example"}}')).toBeNull();
    expect(parseTurn('{"action":{"type":"fly"}}')).toBeNull();
  });

  it("keeps a same-site path", () => {
    expect(parseTurn('{"action":{"type":"goto","path":"/stories/new"}}')?.action).toEqual({
      type: "goto",
      path: "/stories/new",
    });
  });
});

describe("controls", () => {
  it("blocks controls that would end or wreck the run", () => {
    expect(isBlockedControl("Sign out")).toBe(true);
    expect(isBlockedControl("Delete this story")).toBe(true);
    expect(isBlockedControl("Upload a file")).toBe(true);
    expect(isBlockedControl("Send")).toBe(false);
    expect(isBlockedControl("I don't know")).toBe(false);
  });

  it("lists controls with their details", () => {
    const text = describeControls([
      { id: 1, kind: "textbox", label: "Your answer", placeholder: "Type here", value: "" },
      { id: 2, kind: "select", label: "Level", options: ["Mid", "Senior"] },
    ]);
    expect(text).toContain('[1] textbox: Your answer · placeholder "Type here"');
    expect(text).toContain("[2] select: Level · options: Mid | Senior");
  });

  it("summarizes a turn with the control's label", () => {
    const summary = summarizeTurn({ thought: "", action: { type: "click", id: 3 } }, [
      { id: 3, kind: "button", label: "Write my draft" },
    ]);
    expect(summary).toBe('Clicked "Write my draft"');
  });
});

describe("page text", () => {
  it("keeps the start and end of long pages", () => {
    const text = `START ${"x".repeat(10000)} END`;
    const clipped = clipText(text, 1000);
    expect(clipped.length).toBeLessThan(1010);
    expect(clipped.startsWith("START")).toBe(true);
    expect(clipped.endsWith("END")).toBe(true);
  });

  it("finds the lines that appeared", () => {
    expect(newText("Question 1\nYour answer", "Question 1\nYour answer\nNice. What was hard?")).toBe(
      "Nice. What was hard?",
    );
  });
});

describe("prompts", () => {
  it("puts the persona's facts and the action format in the system prompt", () => {
    const p = PERSONAS[0];
    const prompt = personaSystemPrompt(p);
    expect(prompt).toContain(p.name);
    expect(prompt).toContain(p.job.company);
    expect(prompt).toContain('"type": "give_up"');
  });

  it("shows the page and recent steps each turn", () => {
    const prompt = personaTurnPrompt({
      step: 3,
      maxSteps: 40,
      observation: { path: "/stories/new", title: "Build a story", text: "Which story?", controls: [] },
      recent: [{ step: 2, summary: 'Clicked "Build a story"' }],
      note: "Your last action didn't change anything on the page.",
    });
    expect(prompt).toContain("Step 3 of at most 40");
    expect(prompt).toContain('2. Clicked "Build a story"');
    expect(prompt).toContain("didn't change anything");
  });
});

describe("personas", () => {
  it("have unique valid ids and the fields Craig asked for", () => {
    const ids = PERSONAS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[a-z][a-z0-9-]{1,29}$/));
    expect(PERSONAS.map((p) => p.field).sort()).toEqual(
      ["data_governance", "product_design", "sales_engineering"].sort(),
    );
  });
});

describe("typedNote", () => {
  const controls = [
    { id: 3, kind: "textbox", label: "Your answer" },
    { id: 4, kind: "button", label: "Next" },
  ] as Parameters<typeof typedNote>[0];

  it("names the button that sends the text", () => {
    expect(typedNote(controls, 1)).toContain('[4] "Next"');
  });

  it("pushes harder after typing into the same box again", () => {
    expect(typedNote(controls, 3)).toMatch(/3 times in a row/);
  });

  it("falls back when no send button is visible", () => {
    expect(typedNote([controls[0]], 1)).toContain("the button that sends it");
  });
});

describe("Talk button", () => {
  it("is hidden from personas", () => {
    expect(isBlockedControl("Talk")).toBe(true);
    expect(isBlockedControl("Talking points")).toBe(false);
  });
});

describe("filledBoxes", () => {
  it("finds a box a click filled in", () => {
    const before = [{ id: 1, kind: "textbox", label: "Your answer", value: "" }] as Parameters<typeof filledBoxes>[0];
    const after = [{ id: 1, kind: "textbox", label: "Your answer", value: "The timeline was brutal" }] as typeof before;
    expect(filledBoxes(before, after).map((c) => c.label)).toEqual(["Your answer"]);
    expect(filledBoxes(after, after)).toEqual([]);
  });
});
