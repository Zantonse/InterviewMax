import { MAX_BATCH, MAX_PATH_LENGTH, MAX_TARGET_LENGTH, isSignalKind, type Signal } from "./kinds";

// How far back a signal's own time is trusted; older or future times become the time it arrived.
const MAX_AGE_MS = 15 * 60 * 1000;

// Reads a batch the browser sent to /api/signals, dropping anything malformed. Paths must be app
// paths and labels are cut to length; the database checks the same limits.
export function parseSignals(body: unknown, now = Date.now()): Signal[] {
  const list = (body as { signals?: unknown } | null)?.signals;
  if (!Array.isArray(list)) return [];
  return list.slice(0, MAX_BATCH).flatMap((item): Signal[] => {
    const raw = item as Partial<Record<keyof Signal, unknown>> | null;
    if (!raw || !isSignalKind(raw.kind)) return [];
    if (typeof raw.path !== "string" || !raw.path.startsWith("/")) return [];
    const target = typeof raw.target === "string" ? raw.target : "";
    const at =
      typeof raw.at === "number" && raw.at <= now && now - raw.at <= MAX_AGE_MS ? raw.at : now;
    return [
      {
        kind: raw.kind,
        path: raw.path.slice(0, MAX_PATH_LENGTH),
        target: target.slice(0, MAX_TARGET_LENGTH),
        at,
      },
    ];
  });
}
