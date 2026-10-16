import { countWords } from "@/lib/stories/grading";
import { formatDuration } from "./content";

// Delivery feedback (PRD P1, a practice mode add-on): how the user actually spoke, not what they
// said. Pace, filler words and long pauses, all worked out in code from the recording's timing
// and the transcript; no model call. Only answers given with Talk get it: a typed answer has no
// pace.

// What the mic heard during one answer, beyond its length. Measured in the browser from the audio
// level, so it doesn't depend on the speech-to-text model.
export type VoiceStats = {
  // Seconds from the first word to the last, less the long pauses: the time spent talking.
  talkSeconds: number;
  // Silences of LONG_PAUSE_SECONDS or more between words.
  longPauses: number;
};

// A gap this long between words reads as lost, unless it's a planned pause before the result.
export const LONG_PAUSE_SECONDS = 3;

// Conversational interview pace. Under this sounds hesitant; over it, rushed.
export const PACE_RANGE = { min: 120, max: 170 } as const;
// Pace needs a little speech to mean anything.
const MIN_PACE_SECONDS = 15;
const MIN_PACE_WORDS = 30;

export type Pace = "slow" | "ok" | "fast";
export type FillerLevel = "few" | "some" | "many";

export type Delivery = {
  // Spoken answers only (the first answer and any follow-up answers given with Talk).
  words: number;
  talkSeconds: number;
  // Words a minute, or null when there was too little speech to tell.
  wpm: number | null;
  fillers: { word: string; count: number }[];
  fillerCount: number;
  longPauses: number;
};

// Filler words and phrases, each with a pattern that skips its ordinary uses ("I'd like",
// "what kind of", "you know what I did"). Speech-to-text tends to leave out "um" and "uh", so
// those are counted when it keeps them and the card says the count may be low.
const FILLERS: { word: string; pattern: RegExp }[] = [
  { word: "um", pattern: /\b(um+|erm+|hmm+)\b/gi },
  { word: "uh", pattern: /\b(uh+|er)\b(?!['’-])/gi },
  // "like" as a filler sits next to a comma ("it was, like, huge"; "Like, we had…").
  { word: "like", pattern: /(,\s*like\b|\blike,)/gi },
  // "you know" as a filler is set off by punctuation or ends the sentence.
  { word: "you know", pattern: /\byou know\b(?=\s*[,.!?;]|\s*$)/gim },
  { word: "I mean", pattern: /\bI mean\b(?=\s*,)/g },
  { word: "basically", pattern: /\bbasically\b/gi },
  { word: "literally", pattern: /\bliterally\b/gi },
  {
    word: "kind of",
    pattern:
      /(?<!\b(the|a|an|what|this|that|these|those|any|some|every|one|which|same|my|our|his|her|their|your|its|no|other|different|right|wrong|new)\s)\b(kind|sort) of\b/gi,
  },
  { word: "so yeah", pattern: /\bso,? yeah\b/gi },
  { word: "right?", pattern: /,\s*right\?/gi },
];

export function countFillers(text: string): { word: string; count: number }[] {
  return FILLERS.map(({ word, pattern }) => ({
    word,
    count: text.match(pattern)?.length ?? 0,
  }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);
}

type SpokenTurn = { answer?: string; seconds?: number; talkSeconds?: number; longPauses?: number };

// Delivery over every answer given with Talk, or null when none was.
export function deliveryFor(turns: SpokenTurn[]): Delivery | null {
  const spoken = turns.filter(
    (t) => t.answer?.trim() && typeof t.seconds === "number" && t.seconds > 0,
  );
  if (spoken.length === 0) return null;
  const text = spoken.map((t) => t.answer!.trim()).join("\n");
  const words = countWords(text);
  // Older answers were recorded before talk time was measured; their whole length stands in.
  const talkSeconds = spoken.reduce(
    (sum, t) => sum + (t.talkSeconds && t.talkSeconds > 0 ? t.talkSeconds : t.seconds!),
    0,
  );
  const fillers = countFillers(text);
  return {
    words,
    talkSeconds: Math.round(talkSeconds),
    wpm:
      talkSeconds >= MIN_PACE_SECONDS && words >= MIN_PACE_WORDS
        ? Math.round((words / talkSeconds) * 60)
        : null,
    fillers,
    fillerCount: fillers.reduce((sum, f) => sum + f.count, 0),
    longPauses: spoken.reduce((sum, t) => sum + (t.longPauses ?? 0), 0),
  };
}

export function paceVerdict(wpm: number): Pace {
  if (wpm < PACE_RANGE.min) return "slow";
  if (wpm > PACE_RANGE.max) return "fast";
  return "ok";
}

export function paceNote(d: Delivery): string {
  if (d.wpm === null) return "Too short to tell your pace. Answer with Talk for longer to see it.";
  const said = `${d.wpm} words a minute`;
  switch (paceVerdict(d.wpm)) {
    case "slow":
      return `${said}: on the slow side (aim for ${PACE_RANGE.min} to ${PACE_RANGE.max}). Know your beats so you aren't searching for the next part.`;
    case "fast":
      return `${said}: fast (aim for ${PACE_RANGE.min} to ${PACE_RANGE.max}). Slow down and pause before the result so it lands.`;
    default:
      return `${said}: a good, easy pace (${PACE_RANGE.min} to ${PACE_RANGE.max}).`;
  }
}

// Fillers a minute of talking. A couple a minute nobody notices; past five, listeners do.
export function fillerLevel(d: Delivery): FillerLevel {
  const minutes = Math.max(d.talkSeconds, 30) / 60;
  const rate = d.fillerCount / minutes;
  if (rate <= 2) return "few";
  if (rate <= 5) return "some";
  return "many";
}

export function fillerNote(d: Delivery): string {
  if (d.fillerCount === 0) return "None heard. Clean delivery.";
  const list = d.fillers
    .slice(0, 4)
    .map((f) => `“${f.word}” ×${f.count}`)
    .join(", ");
  switch (fillerLevel(d)) {
    case "few":
      return `${list}. A few is natural; nobody will notice.`;
    case "some":
      return `${list}. Noticeable. Swap them for a short silent pause.`;
    default:
      return `${list}. Enough to distract. Pause instead, and slow down a little; fillers often come from rushing.`;
  }
}

export function pauseNote(d: Delivery): string {
  if (d.longPauses === 0) return "";
  const times = d.longPauses === 1 ? "once" : `${d.longPauses} times`;
  return `You went quiet for ${LONG_PAUSE_SECONDS}+ seconds ${times}. A planned pause before the result is good; if you were searching for the next part, rehearse the story's beats.`;
}

// One line for the round summary, over every answer given with Talk.
export function roundDeliveryNote(deliveries: Delivery[]): string {
  if (deliveries.length === 0) return "";
  const words = deliveries.reduce((s, d) => s + d.words, 0);
  const seconds = deliveries.reduce((s, d) => s + d.talkSeconds, 0);
  const fillers = deliveries.reduce((s, d) => s + d.fillerCount, 0);
  const parts = [`${formatDuration(seconds)} of talking`];
  if (seconds >= MIN_PACE_SECONDS && words >= MIN_PACE_WORDS) {
    parts.push(`${Math.round((words / seconds) * 60)} words a minute`);
  }
  parts.push(
    fillers === 0
      ? "no filler words"
      : `${fillers} filler word${fillers === 1 ? "" : "s"} (${(fillers / (Math.max(seconds, 30) / 60)).toFixed(1)} a minute)`,
  );
  return parts.join(" · ");
}

// Reads a stored delivery defensively (practice_sessions.items is jsonb).
export function parseDelivery(raw: unknown): Delivery | undefined {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    words: n(r.words),
    talkSeconds: n(r.talkSeconds),
    wpm: typeof r.wpm === "number" && Number.isFinite(r.wpm) ? r.wpm : null,
    fillers: Array.isArray(r.fillers)
      ? r.fillers.flatMap((f) =>
          typeof f === "object" &&
          f !== null &&
          typeof (f as { word?: unknown }).word === "string" &&
          typeof (f as { count?: unknown }).count === "number"
            ? [{ word: (f as { word: string }).word, count: (f as { count: number }).count }]
            : [],
        )
      : [],
    fillerCount: n(r.fillerCount),
    longPauses: n(r.longPauses),
  };
}
