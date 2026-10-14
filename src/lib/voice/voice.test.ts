import { describe, expect, it } from "vitest";
import { appendSpoken, cleanTranscript } from "./text";
import { SAMPLE_RATE, downsample, encodeWav, isWav, level } from "./wav";

describe("encodeWav", () => {
  it("writes a 16 kHz mono 16-bit header and the samples", () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 0.5]));
    const view = new DataView(wav);
    expect(wav.byteLength).toBe(44 + 8);
    expect(view.getUint32(24, true)).toBe(SAMPLE_RATE);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getInt16(46, true)).toBe(0x7fff);
    expect(view.getInt16(48, true)).toBe(-0x8000);
    expect(isWav(new Uint8Array(wav))).toBe(true);
  });

  it("isWav rejects other bytes", () => {
    expect(isWav(new TextEncoder().encode("not a wav file at all, just some text here!!"))).toBe(
      false,
    );
    expect(isWav(new Uint8Array(10))).toBe(false);
  });
});

describe("downsample", () => {
  it("averages 48 kHz down to 16 kHz", () => {
    const out = downsample(new Float32Array([0.3, 0.3, 0.3, -0.6, -0.6, -0.6]), 48000);
    expect(Array.from(out).map((x) => +x.toFixed(3))).toEqual([0.3, -0.6]);
  });

  it("copies 16 kHz input as is", () => {
    expect(Array.from(downsample(new Float32Array([0.1, 0.2]), 16000))).toEqual([
      expect.closeTo(0.1),
      expect.closeTo(0.2),
    ]);
  });
});

describe("level", () => {
  it("is 0 for silence and grows with loudness", () => {
    expect(level(new Float32Array(100))).toBe(0);
    expect(level(new Float32Array([0.5, -0.5]))).toBeCloseTo(0.5);
  });
});

describe("cleanTranscript", () => {
  it("keeps plain speech", () => {
    expect(cleanTranscript("  We cut churn by 30%.  ")).toBe("We cut churn by 30%.");
  });

  it("drops sound notes", () => {
    expect(cleanTranscript("(laughs) I led the rollout [background noise].")).toBe(
      "I led the rollout.",
    );
    expect(cleanTranscript("[silence]")).toBe("");
  });

  it("drops Whisper's silence filler only when it's the whole piece", () => {
    expect(cleanTranscript(" Thank you for watching. ")).toBe("");
    expect(cleanTranscript("you")).toBe("");
    expect(cleanTranscript("Thank you for the question. We grew 30%.")).toBe(
      "Thank you for the question. We grew 30%.",
    );
  });
});

describe("appendSpoken", () => {
  it("adds to what's typed with one space", () => {
    expect(appendSpoken("I owned the demo. ", "Then we closed.", 100)).toBe(
      "I owned the demo. Then we closed.",
    );
    expect(appendSpoken("", " First piece ", 100)).toBe("First piece");
    expect(appendSpoken("Kept", "  ", 100)).toBe("Kept");
  });

  it("stops at the box's limit", () => {
    expect(appendSpoken("abc", "defgh", 6)).toBe("abc de");
  });
});
