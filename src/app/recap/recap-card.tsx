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
    <div className="flex flex-col items-center gap-4">
      <article
        className="w-full max-w-sm animate-enter overflow-hidden rounded-[2rem] bg-gradient-to-b from-accent-100 via-white to-ink-50 p-7 shadow-lg ring-1 ring-black/5"
        data-testid="recap-card"
      >
        <p className="text-center text-sm font-bold tracking-tight text-ink-800">InterviewMax</p>
        <p className="mt-1 text-center text-xs text-slate-500">My prep so far</p>
        <div className="mt-6 flex items-center gap-4">
          <span
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-ink-800 text-2xl font-extrabold text-white"
            aria-hidden="true"
          >
            {recap.name[0]}
          </span>
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900" data-testid="recap-name">
            {recap.name}
          </h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">{recap.line}</p>
        <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
          {recap.stats.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-4xl font-extrabold text-slate-900">{s.value}</dd>
              <dd className="mt-0.5 text-xs leading-tight text-slate-500" aria-hidden="true">
                {s.label}
              </dd>
            </div>
          ))}
        </dl>
        {recap.best && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Best story</p>
            <p className="mt-1 flex items-center justify-between gap-3">
              <span className="truncate font-semibold text-slate-900">{recap.best.title}</span>
              <span className="flex shrink-0 items-center gap-1.5 text-sm text-slate-600">
                <span className="flex gap-0.5" aria-hidden="true">
                  {[1, 2, 3].map((n) => (
                    <span
                      key={n}
                      className={`h-1.5 w-4 rounded-full ${
                        n > recap.best!.level
                          ? "bg-slate-200"
                          : recap.best!.level === 3
                            ? "bg-emerald-600"
                            : "bg-ink-800"
                      }`}
                    />
                  ))}
                </span>
                Level {recap.best.level}
              </span>
            </p>
          </div>
        )}
      </article>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={saveImage}
          className="rounded-xl bg-ink-800 px-5 py-2.5 font-semibold text-white hover:bg-ink-900"
          data-testid="recap-save"
        >
          Save as image
        </button>
        <button
          type="button"
          onClick={copyText}
          className="rounded-xl px-5 py-2.5 font-semibold text-ink-800 ring-1 ring-ink-800/20 hover:bg-ink-50"
        >
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

// The card drawn on a 1080 x 1350 canvas (a portrait post), in the app's colours.
async function drawRecap(recap: Recap): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#e8eaff");
  bg.addColorStop(0.5, "#ffffff");
  bg.addColorStop(1, "#f4f5f8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#2b3044";
  ctx.font = `800 44px ${font}`;
  ctx.fillText("InterviewMax", W / 2, 130);
  ctx.fillStyle = "#64748b";
  ctx.font = `400 32px ${font}`;
  ctx.fillText("My prep so far", W / 2, 180);

  // Initial in a circle, then the name.
  ctx.fillStyle = "#2b3044";
  ctx.beginPath();
  ctx.arc(W / 2, 340, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 96px ${font}`;
  ctx.textBaseline = "middle";
  ctx.fillText(recap.name[0], W / 2, 346);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#0f172a";
  ctx.font = `800 96px ${font}`;
  ctx.fillText(recap.name, W / 2, 550, W - 120);
  ctx.fillStyle = "#475569";
  ctx.font = `400 36px ${font}`;
  ctx.fillText(recap.line, W / 2, 615, W - 140);

  recap.stats.forEach((s, i) => {
    const x = (W / 6) * (i * 2 + 1);
    ctx.fillStyle = "#0f172a";
    ctx.font = `800 120px ${font}`;
    ctx.fillText(String(s.value), x, 830);
    ctx.fillStyle = "#64748b";
    ctx.font = `400 30px ${font}`;
    ctx.fillText(s.label, x, 885, W / 3 - 30);
  });

  if (recap.best) {
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(90, 990);
    ctx.lineTo(W - 90, 990);
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#64748b";
    ctx.font = `700 28px ${font}`;
    ctx.fillText("BEST STORY", 90, 1050);
    ctx.fillStyle = "#0f172a";
    ctx.font = `700 40px ${font}`;
    ctx.fillText(recap.best.title, 90, 1110, W - 420);
    ctx.textAlign = "right";
    ctx.fillStyle = "#475569";
    ctx.font = `400 34px ${font}`;
    ctx.fillText(`Level ${recap.best.level}`, W - 90, 1110);
    for (let n = 1; n <= 3; n++) {
      ctx.fillStyle =
        n > recap.best.level ? "#e2e8f0" : recap.best.level === 3 ? "#059669" : "#2b3044";
      ctx.beginPath();
      ctx.roundRect(W - 90 - 150 - 170 + n * 46, 1092, 38, 12, 6);
      ctx.fill();
    }
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#94a3b8";
  ctx.font = `400 28px ${font}`;
  ctx.fillText("Made with InterviewMax", W / 2, H - 70);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No image"))), "image/png"),
  );
}
