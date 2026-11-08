import type { Persona } from "./personas";

// The persona's turn in a simulated-user run: what it sees (an Observation of the page), what it
// may do (an Action), and the prompt that makes a model act as the person rather than a tester.
// Pure, so it's tested without a browser or a model.

export type Control = {
  id: number;
  kind: "button" | "link" | "textbox" | "select" | "checkbox" | "other";
  label: string;
  // Text boxes: what's typed now and the placeholder. Selects: the options.
  value?: string;
  placeholder?: string;
  options?: string[];
};

export type Observation = {
  path: string;
  title: string;
  text: string;
  controls: Control[];
};

export type Action =
  | { type: "click"; id: number }
  | { type: "type"; id: number; text: string }
  | { type: "select"; id: number; option: string }
  | { type: "goto"; path: string }
  | { type: "wait" }
  | { type: "done"; reason: string }
  | { type: "give_up"; reason: string };

export type Turn = { thought: string; feeling?: string; action: Action };

// Controls the persona may not touch: they'd end the run, delete things or need a real file or
// microphone. Matched on the visible label.
const BLOCKED_LABEL_RE =
  /\b(sign ?out|log ?out|delete|remove|discard|upload|microphone|record|mic mode|import from linkedin|privacy|ai usage)\b|^(talk|stop talking)$/i;

export function isBlockedControl(label: string): boolean {
  return BLOCKED_LABEL_RE.test(label);
}

export const MAX_TEXT_CHARS = 6000;

// Long pages keep their start (headings, the question being asked near the top) and their end
// (the newest chat messages), which is what a person looks at.
export function clipText(text: string, max = MAX_TEXT_CHARS): string {
  const clean = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= max) return clean;
  const head = Math.floor(max * 0.3);
  return `${clean.slice(0, head)}\n…\n${clean.slice(clean.length - (max - head))}`;
}

export function describeControls(controls: Control[]): string {
  return controls
    .map((c) => {
      const parts = [`[${c.id}] ${c.kind}: ${c.label || "(no label)"}`];
      if (c.placeholder) parts.push(`placeholder "${c.placeholder}"`);
      if (c.value) parts.push(`currently "${c.value.slice(0, 80)}"`);
      if (c.options?.length) parts.push(`options: ${c.options.slice(0, 12).join(" | ")}`);
      return parts.join(" · ");
    })
    .join("\n");
}

const SEND_LABEL_RE = /^(next|send|save|continue|submit|done|add|finish|build|write)\b/i;

// After the persona types, remind it the text isn't sent yet and name the button that sends it.
// Without this, some models keep rewording the same answer and never send it. `typedInARow` counts
// consecutive type actions into the same box, including this one.
export function typedNote(controls: Control[], typedInARow: number): string {
  const send = controls.find((c) => c.kind === "button" && SEND_LABEL_RE.test(c.label));
  const how = send ? `click [${send.id}] "${send.label}"` : "click the button that sends it";
  if (typedInARow >= 2) {
    return `You've now typed into that box ${typedInARow} times in a row and still haven't sent it. Nothing reaches the app until you ${how}. Send what you have; you can add more after.`;
  }
  return `Your text is in the box but not sent yet. To send it, ${how}.`;
}

// Text boxes whose content changed without the persona typing, e.g. after tapping a suggestion
// chip that inserts text. The page text doesn't show box contents, so without this the click looks
// like it did nothing and the persona taps it again.
export function filledBoxes(before: Control[], after: Control[]): Control[] {
  return after.filter((a) => {
    if (a.kind !== "textbox") return false;
    const b = before.find((c) => c.kind === "textbox" && c.label === a.label);
    return (a.value ?? "") !== (b?.value ?? "") && (a.value ?? "").length > (b?.value ?? "").length;
  });
}

export function personaSystemPrompt(persona: Persona): string {
  return `You are ${persona.name}, a real person using InterviewMax, a web app that helps people prepare for job interviews. You are NOT a tester and you don't know how the app works inside. Act exactly as this person would.

Who you are: ${persona.headline}.
How you write and behave: ${persona.voice}
Your patience: ${persona.patience}

Your real work history. These are the only facts you have. Never invent achievements, employers or numbers beyond them. If asked for a detail that isn't here, answer the way this person would (a rough guess they'd admit is a guess, "I don't remember", or a plausible small detail consistent with the history):
${persona.history}

You're interviewing for: ${persona.job.title} at ${persona.job.company}. If the app asks for the job posting, this is it (paste it as is):
${persona.job.posting}

Your goal today: build one strong behavioral interview story (a real example from your work, not "Tell me about yourself") for this job, until the app has written a draft of it and given you feedback or a grade on it. If the app asks you to add your target job first, do it. Answer the app's questions in your own voice and at your own usual length, as if typing into the app. You can use the app's help buttons, examples or skip options if that's what you'd do. If the app is confusing, slow or annoying in a way this person wouldn't put up with, you may give up, as real people do.

Each turn you see the page as text and a numbered list of things you can click or type in. Reply with ONLY one JSON object, no other text:
{"thought": "<one or two sentences: what you, as this person, notice and think right now>", "feeling": "<one or two words>", "action": <one action>}

Actions:
{"type": "click", "id": <number>}
{"type": "type", "id": <number>, "text": "<what you type; replaces what's in the box>"}  (typing doesn't send; click the send/next button after)
{"type": "select", "id": <number>, "option": "<option text>"}
{"type": "goto", "path": "/some/path"}  (only to go back to a page you've seen)
{"type": "wait"}  (if the app is still working)
{"type": "done", "reason": "<why you're finished>"}  (only once the app has written your story and given feedback)
{"type": "give_up", "reason": "<what made you quit, in your words>"}`;
}

export function personaTurnPrompt(input: {
  step: number;
  maxSteps: number;
  observation: Observation;
  recent: { step: number; summary: string }[];
  note?: string;
}): string {
  const { observation: o } = input;
  const history = input.recent.length
    ? input.recent.map((r) => `${r.step}. ${r.summary}`).join("\n")
    : "(nothing yet: you just opened the app)";
  return `Step ${input.step} of at most ${input.maxSteps}.
What you've done so far:
${history}
${input.note ? `\nNote: ${input.note}\n` : ""}
You're on ${o.path} (${o.title}).

The page says:
"""
${clipText(o.text)}
"""

What you can use:
${describeControls(o.controls) || "(nothing clickable: the page may still be loading)"}

Your next move, as JSON:`;
}

function asNumber(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) ? n : undefined;
}

// Pulls the first JSON object out of a model reply (models wrap it in prose or ``` fences) and
// checks it's a valid action. Returns null when it isn't, so the runner can ask again.
export function parseTurn(raw: string): Turn | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const a = (obj.action ?? obj) as Record<string, unknown>;
  if (!a || typeof a !== "object") return null;
  const thought = typeof obj.thought === "string" ? obj.thought.slice(0, 500) : "";
  const feeling = typeof obj.feeling === "string" ? obj.feeling.slice(0, 40) : undefined;
  const id = asNumber(a.id);
  const text = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");
  let action: Action | null = null;
  switch (a.type) {
    case "click":
      if (id !== undefined) action = { type: "click", id };
      break;
    case "type":
      if (id !== undefined && text("text").trim()) action = { type: "type", id, text: text("text").slice(0, 6000) };
      break;
    case "select":
      if (id !== undefined && text("option")) action = { type: "select", id, option: text("option") };
      break;
    case "goto":
      if (/^\/[^/]/.test(text("path")) || text("path") === "/") action = { type: "goto", path: text("path") };
      break;
    case "wait":
      action = { type: "wait" };
      break;
    case "done":
    case "give_up":
      action = { type: a.type, reason: text("reason").slice(0, 500) || "(no reason given)" };
      break;
  }
  return action ? { thought, feeling, action } : null;
}

// One line for the history the persona sees next turn, and for the transcript.
export function summarizeTurn(turn: Turn, controls: Control[]): string {
  const label = (id: number) => controls.find((c) => c.id === id)?.label ?? `#${id}`;
  const a = turn.action;
  switch (a.type) {
    case "click":
      return `Clicked "${label(a.id)}"`;
    case "type":
      return `Typed into "${label(a.id)}": "${a.text.length > 160 ? `${a.text.slice(0, 160)}…` : a.text}"`;
    case "select":
      return `Picked "${a.option}" in "${label(a.id)}"`;
    case "goto":
      return `Went to ${a.path}`;
    case "wait":
      return "Waited";
    case "done":
      return `Finished: ${a.reason}`;
    case "give_up":
      return `Gave up: ${a.reason}`;
  }
}

// Lines of text that appeared after an action: the app's reply, as the persona saw it.
export function newText(before: string, after: string, max = 800): string {
  const seen = new Set(before.split("\n").map((l) => l.trim()));
  const added = after
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !seen.has(l));
  const joined = added.join("\n");
  return joined.length > max ? `${joined.slice(0, max)}…` : joined;
}
