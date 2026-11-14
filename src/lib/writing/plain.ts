import type { Step } from "@/lib/ai/config";

// Plain wording for every step that writes words the user will say. Tester feedback (Kevin, Nov 13):
// the writer's output sounded "AI punchy": em dashes, "The hard part wasn't X, it was Y", "what
// they actually needed", and stacked dramatic beats. Three layers: rules in the system prompt
// (withPlainWording), dashes swapped out in code (plainPunctuation), and the story and intro
// writers sent back once when a tell is still there (aiTells, used in stories/builder.ts).

export const PLAIN_STEPS: readonly Step[] = [
  "storyWrite",
  "storyTailor",
  "storyExec",
  "storyTell",
  "toughAnswer",
];

export function isPlainStep(step: Step): boolean {
  return PLAIN_STEPS.includes(step);
}

export const PLAIN_WORDING_RULES = `Plain wording. It should sound like this person talking across a table, not like copy written by AI:
- No dashes as punctuation (— or –). Use a comma, a full stop or "and" instead.
- No contrast set-ups: not "The hard part wasn't X, it was Y", "It wasn't about X, it was about Y" or "not just X, but Y". Say the point straight: "Getting approval to open it was the hard part."
- No set-up-and-reveal: no "Here's the thing", "The result?", "The catch:", "Turns out", "That's when everything changed", "Spoiler".
- No stock phrases: "what they actually needed", "at the end of the day", "game changer", "move the needle", "unlock", "seamless", "robust", "pivotal", "deep dive", "north star", "double down", "the real win", "make no mistake".
- Don't stack short punchy sentences for drama or end a paragraph on a one-liner zinger. Let sentences run on the way people talk, joined with "and", "so" or "because".
- Use the plain verb for what happened: "I set up", "I asked", "we used", not "I architected", "I championed", "I unlocked".
- "Actually", "really" and "truly" only where the user said them.
If the user said one of these phrases themselves, keep it: their words win.`;

// Adds the plain-wording rules to a writing step's system prompt.
export function withPlainWording(step: Step, system: string | undefined): string | undefined {
  if (!isPlainStep(step)) return system;
  return system ? `${system}\n\n${PLAIN_WORDING_RULES}` : PLAIN_WORDING_RULES;
}

// Swaps dashes used as punctuation for commas. Runs on the model's raw reply (JSON), where dashes
// only appear inside strings. A dash right before other punctuation or a closing quote is dropped;
// ranges between numbers ("10–20") and hyphens in words are left alone.
export function plainPunctuation(text: string): string {
  return text
    .replace(/\\u201[34]/gi, (m) => (m.toLowerCase().endsWith("4") ? "—" : "–"))
    .replace(/\s*(?:[—―]|\s–\s|\s--\s)\s*(?=[.!?,;:"”)\]]|$)/gm, "")
    .replace(/\s*[—―]\s*/g, ", ")
    .replace(/\s+(?:–|--)\s+/g, ", ")
    .replace(/,\s*,/g, ",");
}

type Tell = { pattern: RegExp };

const STOCK = [
  "here's the thing",
  "here is the thing",
  "the truth is",
  "at the end of the day",
  "game changer",
  "game-changer",
  "move the needle",
  "moved the needle",
  "moving the needle",
  "make no mistake",
  "turns out",
  "turned out to be the key",
  "spoiler",
  "the real win",
  "the real problem",
  "the real challenge",
  "the real issue",
  "north star",
  "double down",
  "doubled down",
  "deep dive",
  "seamless",
  "seamlessly",
  "pivotal",
  "unlocked",
  "unlock",
  "that's when everything changed",
  "that was the turning point",
  "little did",
];

const TELLS: Tell[] = [
  // "The hard part wasn't the connection itself, it was approval to open it."
  {
    pattern:
      /\b(?:wasn't|was not|isn't|is not|weren't|were not|aren't)\b[^.!?;\n]{1,60}?[,;:—–]\s*(?:it|this|that|they|the [a-z]+)\s+(?:was|is|were|are)\b/gi,
  },
  // "not just X, but Y"
  { pattern: /\bnot (?:just|only|simply|merely)\b[^.!?;\n]{1,60}?\b(?:but|it was|it's)\b/gi },
  // "what they actually needed"
  {
    pattern:
      /\bwhat (?:they|he|she|we|i|you|the [a-z]+) (?:actually|really|truly) (?:needed|wanted|cared about|meant)\b/gi,
  },
  // "The result? 40% fewer tickets."
  {
    pattern:
      /\b(?:the (?:result|answer|fix|catch|problem|kicker|outcome|twist|lesson)|why|how)\?(?=\s+\S)/gi,
  },
  { pattern: new RegExp(`\\b(?:${STOCK.map(escape).join("|")})\\b`, "gi") },
];

// The AI tells in a draft, as the words found, leaving out any the user said themselves.
export function aiTells(draft: string, answers: string): string[] {
  const said = squash(answers);
  const found: string[] = [];
  for (const { pattern } of TELLS) {
    for (const match of draft.matchAll(pattern)) {
      const text = match[0].trim();
      if (said.includes(squash(text))) continue;
      if (!found.some((f) => f.toLowerCase() === text.toLowerCase())) found.push(text);
    }
  }
  return found;
}

function squash(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[—–,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// One retry problem naming the AI tells found, or nothing when there are none.
export function tellsProblem(draft: string, answers: string): string[] {
  const tells = aiTells(draft, answers);
  return tells.length === 0 ? [] : [tellsAsk(tells)];
}

export function tellsAsk(tells: string[]): string {
  return `These bits sound written by AI, not said by me: ${tells.map((t) => `"${t}"`).join(", ")}. Say each point plainly, the way I'd say it across a table: no "it wasn't X, it was Y" contrasts, no set-up-and-reveal, no stock phrases. Keep my words.`;
}
