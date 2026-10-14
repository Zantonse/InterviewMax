// Mic mode: the audio side, shared by the browser recorder and the server check.
// Speech is recorded as plain 16 kHz mono WAV because every browser can make it (phone Safari
// included) and the transcription models all read it. 16 kHz is what speech models use anyway.

export const SAMPLE_RATE = 16000;

// One recording is sent in pieces so text appears while the user is still talking and each
// request stays well under Vercel's 4.5 MB limit (16 kHz 16-bit mono is 32 KB a second).
// A piece is cut at the first pause after MIN_CHUNK_SECONDS, or at MAX_CHUNK_SECONDS regardless.
export const MIN_CHUNK_SECONDS = 25;
export const MAX_CHUNK_SECONDS = 45;
// A long answer is about four minutes of talking; the answer boxes hold 4,000 characters.
export const MAX_RECORDING_SECONDS = 5 * 60;

const WAV_HEADER_BYTES = 44;
export const MAX_CHUNK_BYTES = WAV_HEADER_BYTES + MAX_CHUNK_SECONDS * SAMPLE_RATE * 2 + 64 * 1024;

// Below this level (root mean square of samples in -1..1) a stretch counts as quiet.
export const PAUSE_LEVEL = 0.01;
// A piece whose loudest stretch never gets above this is silence; it isn't sent, because
// transcription models tend to invent words for silence.
export const SPEECH_LEVEL = 0.02;

// Averages the input down to 16 kHz. Browsers record at 44.1 or 48 kHz and phone Safari
// ignores a requested sample rate, so this runs on every buffer.
export function downsample(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === SAMPLE_RATE) return input.slice();
  const ratio = inputRate / SAMPLE_RATE;
  const length = Math.floor(input.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

export function level(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

export function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// 16-bit PCM WAV, mono, at SAMPLE_RATE.
export function encodeWav(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + samples.length * 2);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per sample frame
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(WAV_HEADER_BYTES + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

// True when the bytes start like the WAV encodeWav makes. The server checks this before
// sending anything on to a model.
export function isWav(bytes: Uint8Array): boolean {
  if (bytes.length <= WAV_HEADER_BYTES) return false;
  const tag = (offset: number) => String.fromCharCode(...bytes.slice(offset, offset + 4));
  return tag(0) === "RIFF" && tag(8) === "WAVE" && tag(12) === "fmt ";
}
