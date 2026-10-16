"use client";

import { useEffect, useRef, useState } from "react";
import { SERIES_COLORS } from "./colors";

// Small dependency-free charts for the admin analytics page: bars per day with a hover readout,
// a legend for two series, and a table view underneath so no number needs the mouse.

export type Series = { name: string; values: number[] };

// The chart is drawn at the width it's shown at, so text stays readable on a phone.
const DEFAULT_WIDTH = 720;
const HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 24, left: 32 };
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

// A round axis top: 1, 2, 5 or 10 times a power of ten, at least the largest value.
export function niceMax(value: number): number {
  if (value <= 4) return 4;
  const power = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 5, 10]) if (step * power >= value) return step * power;
  return 10 * power;
}

// "Oct 16"
function shortDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

// A bar with 4px rounded top corners, sitting on the baseline.
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  const base = y + h;
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

export function DailyBars({
  days,
  series,
  label,
}: {
  days: string[];
  series: Series[];
  // What the chart shows, for screen readers.
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const PLOT_W = width - PAD.left - PAD.right;
  const top = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const col = PLOT_W / Math.max(1, days.length);
  const gap = Math.min(2, col * 0.2);
  const groupW = Math.max(1, col - gap * 2);
  const barW = Math.max(1, (groupW - gap * (series.length - 1)) / series.length);
  const y = (v: number) => PAD.top + PLOT_H - (v / top) * PLOT_H;
  const ticks = [0, top / 2, top];
  // About one date label per 110px.
  const labelEvery = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(PLOT_W / 110))));

  return (
    <div>
      {series.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {series.map((s, i) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: SERIES_COLORS[i] }}
                aria-hidden
              />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div ref={box} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="block max-w-full"
          role="img"
          aria-label={label}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? "#a6adc4" : "#e6e8ef"}
                strokeWidth={1}
              />
              <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
                {Number.isInteger(t) ? t : t.toFixed(1)}
              </text>
            </g>
          ))}
          {days.map((day, i) => {
            const x0 = PAD.left + i * col;
            return (
              <g key={day}>
                {hover === i && (
                  <rect x={x0} y={PAD.top} width={col} height={PLOT_H} fill="#f4f5f8" />
                )}
                {series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  if (v <= 0) return null;
                  const h = Math.max(1, PLOT_H - (y(v) - PAD.top));
                  return (
                    <path
                      key={s.name}
                      d={barPath(x0 + gap + si * (barW + gap), PAD.top + PLOT_H - h, barW, h)}
                      fill={SERIES_COLORS[si]}
                    />
                  );
                })}
                {(i % labelEvery === 0 || i === days.length - 1) &&
                  (i === days.length - 1 || days.length - 1 - i >= labelEvery / 2) && (
                    <text
                      x={i === days.length - 1 ? Math.min(x0 + col / 2, width - 2) : x0 + col / 2}
                      y={HEIGHT - 6}
                      textAnchor={i === days.length - 1 && days.length > 1 ? "end" : "middle"}
                      className="fill-slate-500 text-[11px]"
                    >
                      {shortDay(day)}
                    </text>
                  )}
                {/* The hit area is the whole day column, not just the bars. */}
                <rect
                  x={x0}
                  y={PAD.top}
                  width={col}
                  height={PLOT_H}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                />
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded-lg bg-white px-3 py-2 text-xs shadow-md ring-1 ring-black/10"
            style={
              (hover + 0.5) / days.length > 0.6
                ? { right: `${100 - ((PAD.left + hover * col) / width) * 100}%` }
                : { left: `${((PAD.left + (hover + 1) * col) / width) * 100}%` }
            }
          >
            <p className="font-medium text-slate-500">{shortDay(days[hover])}</p>
            {series.map((s, si) => (
              <p key={s.name} className="mt-0.5 flex items-center gap-2 whitespace-nowrap">
                <span
                  className="inline-block h-0.5 w-3"
                  style={{ backgroundColor: SERIES_COLORS[si] }}
                  aria-hidden
                />
                <span className="font-bold tabular-nums text-slate-900">{s.values[hover] ?? 0}</span>
                <span className="text-slate-600">{s.name}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-ink-700">Show as a table</summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-1 pr-4 font-semibold">Day (UTC)</th>
                {series.map((s) => (
                  <th key={s.name} className="py-1 pr-4 text-right font-semibold">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {days.map((day, i) => (
                <tr key={day}>
                  <td className="py-1 pr-4">{shortDay(day)}</td>
                  {series.map((s) => (
                    <td key={s.name} className="py-1 pr-4 text-right tabular-nums">
                      {s.values[i] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
