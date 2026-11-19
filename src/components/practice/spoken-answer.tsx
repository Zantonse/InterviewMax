"use client";

import { useEffect, useState } from "react";
import { fillerSpans } from "@/lib/practice/delivery";

// A practice answer as the user gave it. Said with Talk, its filler words are tinted where they
// came, and while the page is open the recording plays back (design comparison 2026-11-17,
// pattern 2: Yoodli and Speak let you hear yourself). The audio lives only in this tab.
export function SpokenAnswer({
  text,
  spoken,
  audio,
}: {
  text: string;
  // Given with Talk: only then are filler words worth marking.
  spoken: boolean;
  audio?: Blob;
}) {
  const url = useObjectUrl(audio);
  const spans = spoken ? fillerSpans(text) : [{ text, filler: false }];
  const fillers = spans.filter((s) => s.filler).length;
  return (
    <>
      {spans.map((s, i) =>
        s.filler ? (
          <mark
            key={i}
            className="rounded bg-amber-100 px-0.5 text-amber-900"
            title="Filler word"
            data-testid="filler"
          >
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
      {(url || fillers > 0) && (
        <span className="mt-2 flex flex-col gap-1.5" data-testid="hear-yourself">
          {url && (
            <span className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-ink-800">Hear yourself</span>
              <audio controls preload="metadata" src={url} className="h-9 w-full max-w-xs">
                Your browser can&apos;t play this recording.
              </audio>
            </span>
          )}
          <span className="text-xs text-slate-600">
            {fillers > 0
              ? `${fillers} filler ${fillers === 1 ? "word" : "words"} tinted. `
              : ""}
            {url ? "Only kept in this tab; gone when you leave." : ""}
          </span>
        </span>
      )}
    </>
  );
}

function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL must be made and revoked with the blob
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
      setUrl(undefined);
    };
  }, [blob]);
  return url;
}
