import { countWords } from "@/lib/stories/grading";
import { SPEAKER_LABELS, turnsFromLabelled } from "./speakers";

// How sure the user sounded in a real interview: hedges ("I think", "kind of") and moments they
// lost their place ("sorry, let me gather my thoughts", "could you repeat the question"), counted
// in code in their own turns only. No model call. Tester feedback, Oct 17: interviewers read a
// steady stream of hedges as "supported it" rather than "led it", even when the work was theirs.

const HEDGES: { phrase: string; pattern: RegExp }[] = [
  { phrase: "I think", pattern: /\bI think\b/gi },
  { phrase: "I believe", pattern: /\bI believe\b/gi },
  { phrase: "I guess", pattern: /\bI guess\b/gi },
  { phrase: "I would say", pattern: /\bI(?: would|'d|’d) say\b/gi },
  { phrase: "I feel like", pattern: /\bI feel like\b/gi },
  // Not "what kind of" or "this sort of": those are ordinary uses.
  {
    phrase: "kind of",
    pattern:
      /(?<!\b(?:the|a|an|what|this|that|these|those|any|some|every|one|which|same|my|our|his|her|their|your|its|no|other|different|right|wrong|new)\s)\b(?:kind|sort) of\b/gi,
  },
  { phrase: "maybe", pattern: /\bmaybe\b/gi },
  { phrase: "probably", pattern: /\bprobably\b/gi },
];

const LOST: RegExp[] = [
  /\b(?:could|can|would) you (?:please )?(?:mind )?repeat(?:ing)?\b/gi,
  /\bgather my thoughts\b/gi,
  /\bI (?:just )?(?:blanked|blanking)(?: out)?\b/gi,
  /\bI'?m (?:not sure|trying to recall)\b/gi,
];

// Below this many words of the user's own answers, the counts mean too little to show.
const MIN_WORDS = 300;
// Hedges per 100 words of the user's answers above which it's worth saying.
const MANY_PER_100 = 1;

export type Sureness = {
  words: number;
  hedges: { phrase: string; count: number }[];
  hedgeCount: number;
  // Hedges per 100 words, rounded to one decimal.
  per100: number;
  lostCount: number;
  many: boolean;
};

// The user's own words from a saved transcript: the "Me" turns of one the app labelled, or the
// lines under the speaker name they gave. Null when it can't tell which words are theirs.
export function userWords(transcript: string, speaker: string): string | null {
  if (!speaker.trim()) return null;
  if (speaker === SPEAKER_LABELS.me) {
    const turns = turnsFromLabelled(transcript);
    if (turns.length > 0) {
      return turns.filter((t) => t.speaker === "me").map((t) => t.text).join("\n");
    }
  }
  const name = speaker.trim().toLowerCase();
  const out: string[] = [];
  let mine = false;
  for (const line of transcript.split("\n")) {
    const m = /^\s*(?:\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*)?([^:\n]{1,40}):\s*(.*)$/.exec(line);
    if (m) {
      mine = m[1].trim().toLowerCase() === name;
      if (mine) out.push(m[2]);
    } else if (mine) {
      out.push(line);
    }
  }
  return out.length > 0 ? out.join("\n") : null;
}

export function sureness(text: string): Sureness | null {
  const words = countWords(text);
  if (words < MIN_WORDS) return null;
  const hedges = HEDGES.map(({ phrase, pattern }) => ({ phrase, count: text.match(pattern)?.length ?? 0 }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count);
  const hedgeCount = hedges.reduce((sum, h) => sum + h.count, 0);
  const per100 = Math.round((hedgeCount / words) * 1000) / 10;
  return {
    words,
    hedges,
    hedgeCount,
    per100,
    lostCount: LOST.reduce((sum, re) => sum + (text.match(re)?.length ?? 0), 0),
    many: per100 >= MANY_PER_100,
  };
}

export function surenessFor(transcript: { transcript: string; speaker: string }): Sureness | null {
  const text = userWords(transcript.transcript, transcript.speaker);
  return text ? sureness(text) : null;
}
