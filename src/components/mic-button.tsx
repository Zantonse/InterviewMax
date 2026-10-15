"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { transcribeAudio } from "@/app/voice/actions";
import {
  MAX_CHUNK_SECONDS,
  MAX_RECORDING_SECONDS,
  MIN_CHUNK_SECONDS,
  PAUSE_LEVEL,
  SAMPLE_RATE,
  SPEECH_LEVEL,
  concat,
  downsample,
  encodeWav,
  level,
} from "@/lib/voice/wav";

// Mic mode (PRD P0): talk instead of typing wherever the user answers. The browser records plain
// audio and sends it in pieces of up to 45 seconds; each piece is written down on the server and
// added to the answer box, so the user sees text appear while they talk and can edit it before
// sending. Recording plain audio (rather than the browser's own speech recognition) works the same
// in phone Safari, Chrome and Firefox, and the audio never leaves our server except to the model.

type Phase = "idle" | "starting" | "recording" | "finishing";

// Collects about 85 ms of audio before handing it to the page, instead of every 3 ms.
const WORKLET = `
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(4096); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) { this.port.postMessage(this.buf); this.buf = new Float32Array(4096); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor("imx-capture", Capture);
`;

type Session = {
  ctx: AudioContext;
  stream: MediaStream;
  node: AudioWorkletNode;
  piece: Float32Array[];
  pieceSamples: number;
  pieceLoudest: number;
  totalSamples: number;
};

function canRecord() {
  return (
    typeof window !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof AudioWorkletNode !== "undefined"
  );
}

const noSubscribe = () => () => {};
// Before the page is running in the browser we can't tell, so nothing is shown yet.
const unknownOnServer = () => null;

export function MicButton({
  onText,
  disabled,
  onActiveChange,
  onRecorded,
}: {
  // Called with each written-down piece, in the order it was said.
  onText: (text: string) => void;
  disabled?: boolean;
  // Told when recording starts and when the last piece is back, so a form can hold Send until then.
  onActiveChange?: (active: boolean) => void;
  // Told how many seconds were recorded, each time the user stops (practice mode times answers).
  onRecorded?: (seconds: number) => void;
}) {
  const supported = useSyncExternalStore<boolean | null>(noSubscribe, canRecord, unknownOnServer);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [loud, setLoud] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const session = useRef<Session | null>(null);
  const onTextRef = useRef(onText);
  const onRecordedRef = useRef(onRecorded);
  const next = useRef(0); // sequence number for the next piece sent
  const done = useRef<Map<number, string>>(new Map()); // pieces back, waiting for earlier ones
  const flushed = useRef(0); // sequence number of the next piece to hand to onText
  const pending = useRef(0);
  const stopping = useRef(false);

  useEffect(() => {
    onTextRef.current = onText;
    onRecordedRef.current = onRecorded;
  }, [onText, onRecorded]);

  const active = phase !== "idle";
  useEffect(() => {
    onActiveChange?.(active);
  }, [active, onActiveChange]);

  // Hands over every piece that's back and has no earlier piece still out, as one call.
  const flush = useCallback(() => {
    const ready: string[] = [];
    while (done.current.has(flushed.current)) {
      const text = done.current.get(flushed.current) ?? "";
      done.current.delete(flushed.current);
      flushed.current += 1;
      if (text) ready.push(text);
    }
    if (ready.length) onTextRef.current(ready.join(" "));
    if (stopping.current && pending.current === 0) {
      stopping.current = false;
      setPhase("idle");
    }
  }, []);

  const send = useCallback(
    (samples: Float32Array, loudest: number) => {
      // Silence isn't sent: models tend to invent words for it.
      if (samples.length < SAMPLE_RATE / 2 || loudest < SPEECH_LEVEL) return;
      const seq = next.current++;
      pending.current += 1;
      const form = new FormData();
      form.append("audio", new Blob([encodeWav(samples)], { type: "audio/wav" }), "speech.wav");
      transcribeAudio(form)
        .then((result) => {
          if (result.ok) done.current.set(seq, result.text);
          else {
            done.current.set(seq, "");
            setError(result.error);
          }
        })
        .catch(() => {
          done.current.set(seq, "");
          setError("Couldn't send the recording. Check your connection and try again.");
        })
        .finally(() => {
          pending.current -= 1;
          flush();
        });
    },
    [flush],
  );

  const cutPiece = useCallback(() => {
    const s = session.current;
    if (!s) return;
    const samples = concat(s.piece);
    const loudest = s.pieceLoudest;
    s.piece = [];
    s.pieceSamples = 0;
    s.pieceLoudest = 0;
    send(samples, loudest);
  }, [send]);

  const release = useCallback(() => {
    const s = session.current;
    session.current = null;
    if (!s) return;
    s.node.port.onmessage = null;
    s.node.disconnect();
    s.stream.getTracks().forEach((t) => t.stop());
    void s.ctx.close().catch(() => {});
  }, []);

  const stop = useCallback(() => {
    if (!session.current) return;
    onRecordedRef.current?.(session.current.totalSamples / SAMPLE_RATE);
    cutPiece();
    release();
    setLoud(0);
    if (pending.current === 0) setPhase("idle");
    else {
      stopping.current = true;
      setPhase("finishing");
    }
  }, [cutPiece, release]);

  const start = useCallback(async () => {
    setError(null);
    setSeconds(0);
    setPhase("starting");
    // Phone Safari only lets audio start inside the tap itself, so the context is made first.
    const Ctx: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    void ctx.resume().catch(() => {});
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (err) {
      void ctx.close().catch(() => {});
      setPhase("idle");
      const name = err instanceof DOMException ? err.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "The microphone is blocked. Allow it for this site in your browser settings, then tap Talk again."
          : name === "NotFoundError"
            ? "No microphone found. Plug one in, or type your answer."
            : "Couldn't start the microphone. Try again, or type your answer.",
      );
      return;
    }

    try {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
      try {
        await ctx.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "imx-capture");
      // Some browsers only run a node that leads to the speakers; a silent gain keeps it quiet.
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(node).connect(mute).connect(ctx.destination);

      const s: Session = {
        ctx,
        stream,
        node,
        piece: [],
        pieceSamples: 0,
        pieceLoudest: 0,
        totalSamples: 0,
      };
      session.current = s;
      next.current = 0;
      flushed.current = 0;
      done.current.clear();

      node.port.onmessage = (e: MessageEvent<Float32Array>) => {
        if (session.current !== s) return;
        const samples = downsample(e.data, ctx.sampleRate);
        const now = level(samples);
        s.piece.push(samples);
        s.pieceSamples += samples.length;
        s.totalSamples += samples.length;
        s.pieceLoudest = Math.max(s.pieceLoudest, now);
        setLoud(now);
        setSeconds(Math.floor(s.totalSamples / SAMPLE_RATE));

        const pieceSeconds = s.pieceSamples / SAMPLE_RATE;
        if (s.totalSamples / SAMPLE_RATE >= MAX_RECORDING_SECONDS) {
          stop();
        } else if (
          pieceSeconds >= MAX_CHUNK_SECONDS ||
          (pieceSeconds >= MIN_CHUNK_SECONDS && now < PAUSE_LEVEL)
        ) {
          cutPiece();
        }
      };
      setPhase("recording");
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => {});
      setPhase("idle");
      setError("Couldn't start the microphone. Try again, or type your answer.");
    }
  }, [cutPiece, stop]);

  // Leaving the page mid-recording turns the microphone off without sending anything.
  useEffect(() => release, [release]);

  if (supported === null) return null;
  // Some in-app browsers (opened from an email or LinkedIn link) can't record. Say so, rather than
  // leaving the user wondering where the microphone went.
  if (!supported)
    return (
      <span className="text-xs text-slate-500" data-testid="mic-unsupported">
        <MicIcon /> To talk instead of typing, open this page in Safari or Chrome.
      </span>
    );

  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="mic-button">
      {phase === "recording" ? (
        <button
          type="button"
          onClick={stop}
          className="inline-flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-100"
          aria-label={`Stop talking (${clock})`}
        >
          <span className="relative flex h-3 w-3" aria-hidden>
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 transition-transform"
              style={{ transform: `scale(${1 + Math.min(1.2, loud * 12)})` }}
            />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
          </span>
          <span className="tabular-nums">{clock}</span>
          Stop
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={disabled || phase !== "idle"}
          title="Talk instead of typing. An AI model writes down what you say; the recording isn't kept."
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent-100 px-3 py-2 font-semibold text-accent-900 ring-1 ring-accent-300 hover:bg-accent-200 disabled:opacity-50"
        >
          <MicIcon />
          {phase === "starting" ? "Starting…" : phase === "finishing" ? "Writing it down…" : "Talk"}
        </button>
      )}
      {phase === "recording" && (
        <span className="text-xs text-slate-500" role="status">
          Listening. Your words appear as you go; edit them before you send. Speech is written
          down by an AI model and the recording isn&apos;t kept.
        </span>
      )}
      {error && phase !== "recording" && (
        <span role="alert" className="text-sm font-medium text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="inline shrink-0 align-[-4px]"
    >
      <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
