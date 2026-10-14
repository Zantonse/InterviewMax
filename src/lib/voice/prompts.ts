// Mic mode (PRD P0): speech is written down and then handled exactly like typed text.
// This is transcription, not a generative step: the model only writes down what was said.

export const TRANSCRIBE_SYSTEM = `You write down speech. The audio is someone answering a job interview prep question out loud.

Write exactly what they say, in the language they speak, as plain text with normal punctuation and sentence capitals.
- Leave out filler sounds ("um", "uh", "er") and words repeated by a stumble; keep every other word as said.
- Write numbers the way people read them: digits for figures ("$2.4 million", "30%", "12 people").
- Do not answer, summarize, fix, translate or comment on what they say.
- If you hear no speech, write nothing at all.

Reply with the transcript only: no heading, no quotes, no notes.`;

export const TRANSCRIBE_INSTRUCTION = "Write down what is said in this recording.";

// Lines a model sometimes writes instead of (or around) a transcript. Silence and noise get one
// of these rather than an empty reply, and none of them is ever what the user said.
const NOT_SPEECH = [
  /^\(?\[?(no speech|silence|inaudible|no audio|blank audio|music|background noise)[^\n]*\]?\)?\.?$/i,
  /^(there is|there's|i hear|i can't hear|i cannot hear) no (speech|audio)[^\n]*$/i,
];
const LABEL = /^(transcript|transcription)\s*:\s*/i;

// Tidies a model's transcript: drops labels, wrapping quotes and not-speech notes.
export function cleanTranscript(raw: string): string {
  let text = raw.replace(/\r\n?/g, "\n").trim();
  text = text.replace(/^```[a-z]*\n?|\n?```$/g, "").trim();
  text = text.replace(LABEL, "").trim();
  if (/^["“][\s\S]*["”]$/.test(text)) text = text.slice(1, -1).trim();
  if (NOT_SPEECH.some((re) => re.test(text))) return "";
  return text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
}

// Adds a newly written-down piece to what's already in an answer box, with one space between.
export function appendSpoken(existing: string, spoken: string, maxLength: number): string {
  const piece = spoken.trim();
  if (!piece) return existing;
  const joined = existing.trim() ? `${existing.replace(/\s+$/, "")} ${piece}` : piece;
  return joined.slice(0, maxLength);
}
