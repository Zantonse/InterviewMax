"use client";

import { useState } from "react";
import { type Recap, recapText } from "@/lib/recap/recap";

// The recap card on screen, and the same card drawn to an image to save or share. Nothing is sent
// anywhere: the image is made in the browser and the user decides where it goes.
export function RecapCard({ recap }: { recap: Recap }) {
  const [note, setNote] = useState<string | null>(null);

  async function saveImage() {
    setNote(null);
    try {
      const blob = await drawRecap(recap);
      const file = new File([blob], "interview-prep-recap.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My interview prep" });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setNote("The image couldn't be made in this browser. Copy the text instead.");
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(recapText(recap));
      setNote("Copied.");
    } catch {
      setNote("Copying isn't allowed here.");
    }
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <article
        className="w-full max-w-md rounded-[10px] border border-ink-200 bg-white p-7"
        data-testid="recap-card"
      >
        <p className="text-xs text-slate-600">InterviewMax · Prep so far</p>
        <p className="mt-5 text-2xl font-semibold leading-snug tracking-tight text-slate-900">
          {recap.line}
        </p>
        <p className="mt-1 text-sm text-slate-600" data-testid="recap-name">
          Story style: {recap.name}
        </p>
        <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-ink-100 pt-5">
          {recap.stats.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="font-mono text-3xl font-medium tabular-nums text-slate-900">{s.value}</dd>
              <dd className="mt-1 text-xs leading-tight text-slate-600" aria-hidden="true">
                {s.label}
              </dd>
            </div>
          ))}
        </dl>
        {recap.best && (
          <div className="mt-6 border-t border-ink-100 pt-5">
            <p className="text-xs text-slate-600">Best story · Level {recap.best.level}</p>
            <p className="mt-1 font-words text-lg leading-snug text-slate-900" data-testid="recap-best">
              {recap.best.title}
            </p>
          </div>
        )}
      </article>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={saveImage} className="btn-primary" data-testid="recap-save">
          Save as image
        </button>
        <button type="button" onClick={copyText} className="btn-secondary">
          Copy as text
        </button>
      </div>
      {note && (
        <p className="text-sm text-slate-600" role="status">
          {note}
        </p>
      )}
    </div>
  );
}

// The card drawn on a 1080 x 1350 canvas (a portrait post): the same plain summary as on screen.
async function drawRecap(recap: Recap): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const M = 96;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  const sans = getComputedStyle(document.body).fontFamily || "sans-serif";
  const best = document.querySelector('[data-testid="recap-best"]');
  const words = (best && getComputedStyle(best).fontFamily) || "Georgia, serif";
  const mono = getComputedStyle(document.documentElement).getPropertyValue("--font-geist-mono") || "monospace";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.fillStyle = "#5b6275";
  ctx.font = `400 30px ${sans}`;
  ctx.fillText("InterviewMax · Prep so far", M, 150);

  ctx.fillStyle = "#14161f";
  ctx.font = `600 64px ${sans}`;
  let y = 290;
  for (const line of wrap(ctx, recap.line, W - 2 * M).slice(0, 3)) {
    ctx.fillText(line, M, y);
    y += 80;
  }
  ctx.fillStyle = "#5b6275";
  ctx.font = `400 34px ${sans}`;
  ctx.fillText(`Story style: ${recap.name}`, M, y + 10);

  rule(ctx, M, 700, W - M);
  recap.stats.forEach((s, i) => {
    const x = M + i * ((W - 2 * M) / 3);
    ctx.fillStyle = "#14161f";
    ctx.font = `500 110px ${mono}`;
    ctx.fillText(String(s.value), x, 840);
    ctx.fillStyle = "#5b6275";
    ctx.font = `400 30px ${sans}`;
    ctx.fillText(s.label, x, 890, (W - 2 * M) / 3 - 24);
  });

  if (recap.best) {
    rule(ctx, M, 990, W - M);
    ctx.fillStyle = "#5b6275";
    ctx.font = `400 30px ${sans}`;
    ctx.fillText(`Best story · Level ${recap.best.level}`, M, 1060);
    ctx.fillStyle = "#14161f";
    ctx.font = `400 46px ${words}`;
    let by = 1125;
    for (const line of wrap(ctx, recap.best.title, W - 2 * M).slice(0, 3)) {
      ctx.fillText(line, M, by);
      by += 60;
    }
  }

  ctx.fillStyle = "#8a90a2";
  ctx.font = `400 26px ${sans}`;
  ctx.fillText("Made with InterviewMax", M, H - 70);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No image"))), "image/png"),
  );
}

function rule(ctx: CanvasRenderingContext2D, x1: number, y: number, x2: number) {
  ctx.strokeStyle = "#e3e5ec";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

// Splits text into lines that fit the width, so a long title is shown in full, not cut off.
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
