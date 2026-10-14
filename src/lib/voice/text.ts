// Mic mode (PRD P0): speech is written down by a speech-to-text model and then handled exactly
// like typed text. No prompt: the transcription model only writes down what was said.

// Bracketed sound notes some speech-to-text models add, such as "(laughs)" or "[background
// noise]". Nobody says brackets out loud, so none of these is the user's words.
const SOUND_NOTE = /\s*(\([^)]*\)|\[[^\]]*\])\s*/g;

// Tidies a transcript: drops sound notes and extra spaces.
export function cleanTranscript(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(SOUND_NOTE, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ ([.,!?;:])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Adds a newly written-down piece to what's already in an answer box, with one space between.
export function appendSpoken(existing: string, spoken: string, maxLength: number): string {
  const piece = spoken.trim();
  if (!piece) return existing;
  const joined = existing.trim() ? `${existing.replace(/\s+$/, "")} ${piece}` : piece;
  return joined.slice(0, maxLength);
}
