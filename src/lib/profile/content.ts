import { createHash } from "node:crypto";
import {
  CRITERIA,
  READINESS_LABELS,
  STATUS_LABELS,
  type CriterionId,
  type ProfileResult,
  type ReadinessLabel,
  type Status,
} from "./assess";

// What the interviewee profile keeps on profiles.interviewee_profile (jsonb): the summary the model
// last wrote and the inputs it was written from, and the two latest snapshots of the scores, so
// the page can say how the profile moved since the user last looked. Everything else is worked out
// fresh from their data on every visit (assess.ts).

export type Snapshot = {
  at: string;
  criteria: Partial<Record<CriterionId, { status: Status; score: number | null }>>;
  jobs: Record<string, { title: string; label: ReadinessLabel }>;
};

export type ProfileSummary = {
  text: string;
  // A hash of the results the summary was written from; a new hash means it's out of date.
  basis: string;
  model: string;
  writtenAt: string;
};

export type StoredProfile = {
  summary?: ProfileSummary;
  latest?: Snapshot;
  previous?: Snapshot;
};

export function snapshotOf(result: ProfileResult, at: string): Snapshot {
  return {
    at,
    criteria: Object.fromEntries(result.criteria.map((c) => [c.id, { status: c.status, score: c.score }])),
    jobs: Object.fromEntries(result.jobs.map((j) => [j.jobId, { title: j.title, label: j.label }])),
  };
}

function sameSnapshot(a: Snapshot | undefined, b: Snapshot): boolean {
  if (!a) return false;
  return (
    JSON.stringify({ c: a.criteria, j: a.jobs }) === JSON.stringify({ c: b.criteria, j: b.jobs })
  );
}

// The stored profile after a visit: when the scores moved since the latest snapshot, that one
// becomes the baseline the page compares against. Unchanged scores keep the old baseline, so
// reloading the page doesn't wipe out what changed.
export function recordVisit(stored: StoredProfile, current: Snapshot): { stored: StoredProfile; changed: boolean } {
  if (sameSnapshot(stored.latest, current)) return { stored, changed: false };
  return {
    stored: { ...stored, previous: stored.latest, latest: current },
    changed: true,
  };
}

export type Change = { text: string; direction: "up" | "down" | "new" };

const STATUS_RANK: Record<Status, number> = { no_data: 0, weak: 1, developing: 2, strong: 3 };
const READINESS_RANK: Record<ReadinessLabel, number> = { not_ready: 0, getting_there: 1, ready: 2 };

// What moved between two snapshots: a criterion's status, a score by 5 points or more, a job's
// readiness, or a job added.
export function changesSince(previous: Snapshot | undefined, current: Snapshot): Change[] {
  if (!previous) return [];
  const changes: Change[] = [];
  for (const { id, label } of CRITERIA) {
    const before = previous.criteria[id];
    const now = current.criteria[id];
    if (!before || !now) continue;
    if (before.status !== now.status) {
      const up = STATUS_RANK[now.status] > STATUS_RANK[before.status];
      changes.push({
        text:
          before.status === "no_data"
            ? `${label}: now ${STATUS_LABELS[now.status].toLowerCase()}`
            : `${label}: ${STATUS_LABELS[before.status].toLowerCase()} → ${STATUS_LABELS[now.status].toLowerCase()}`,
        direction: before.status === "no_data" ? "new" : up ? "up" : "down",
      });
    } else if (before.score !== null && now.score !== null && Math.abs(now.score - before.score) >= 5) {
      changes.push({
        text: `${label}: ${now.score > before.score ? "up" : "down"} ${Math.abs(now.score - before.score)} points`,
        direction: now.score > before.score ? "up" : "down",
      });
    }
  }
  for (const [jobId, now] of Object.entries(current.jobs)) {
    const before = previous.jobs[jobId];
    if (!before) {
      changes.push({ text: `${now.title}: added, ${READINESS_LABELS[now.label].toLowerCase()}`, direction: "new" });
    } else if (before.label !== now.label) {
      changes.push({
        text: `${now.title}: ${READINESS_LABELS[before.label].toLowerCase()} → ${READINESS_LABELS[now.label].toLowerCase()}`,
        direction: READINESS_RANK[now.label] > READINESS_RANK[before.label] ? "up" : "down",
      });
    }
  }
  return changes;
}

// The results the summary is written from, as plain text. Also what its numbers are checked
// against, and (hashed) what tells a stored summary is out of date.
export function summaryFacts(result: ProfileResult): string {
  const lines: string[] = [];
  for (const c of result.criteria) {
    lines.push(`${c.label}: ${STATUS_LABELS[c.status]}. ${c.headline}`);
    for (const d of c.details) lines.push(`  - ${d}`);
  }
  if (result.jobs.length) {
    lines.push("Readiness per target job:");
    for (const j of result.jobs) {
      lines.push(`  - ${j.title}${j.company ? ` at ${j.company}` : ""}: ${READINESS_LABELS[j.label]} (${j.reasons.join("; ")})`);
    }
  }
  if (result.strengths.length) {
    lines.push("Top strengths:");
    for (const p of result.strengths) lines.push(`  - ${p.text}`);
  }
  if (result.weaknesses.length) {
    lines.push("Top weaknesses:");
    for (const p of result.weaknesses) lines.push(`  - ${p.text}${p.next ? ` (next step: ${p.next.label})` : ""}`);
  }
  return lines.join("\n");
}

export function factsBasis(facts: string): string {
  return createHash("sha256").update(facts).digest("hex").slice(0, 32);
}

// ---- Reading the stored profile (jsonb) ----

export function parseStoredProfile(raw: unknown): StoredProfile {
  if (!isRecord(raw)) return {};
  const stored: StoredProfile = {};
  const s = raw.summary;
  if (isRecord(s) && typeof s.text === "string" && typeof s.basis === "string") {
    stored.summary = {
      text: s.text,
      basis: s.basis,
      model: typeof s.model === "string" ? s.model : "",
      writtenAt: typeof s.writtenAt === "string" ? s.writtenAt : "",
    };
  }
  const latest = parseSnapshot(raw.latest);
  if (latest) stored.latest = latest;
  const previous = parseSnapshot(raw.previous);
  if (previous) stored.previous = previous;
  return stored;
}

const STATUSES: readonly Status[] = ["strong", "developing", "weak", "no_data"];
const READINESS: readonly ReadinessLabel[] = ["not_ready", "getting_there", "ready"];

function parseSnapshot(raw: unknown): Snapshot | undefined {
  if (!isRecord(raw) || typeof raw.at !== "string") return undefined;
  const criteria: Snapshot["criteria"] = {};
  if (isRecord(raw.criteria)) {
    for (const { id } of CRITERIA) {
      const c = raw.criteria[id];
      if (!isRecord(c)) continue;
      const status = STATUSES.find((x) => x === c.status);
      if (!status) continue;
      criteria[id] = { status, score: typeof c.score === "number" ? c.score : null };
    }
  }
  const jobs: Snapshot["jobs"] = {};
  if (isRecord(raw.jobs)) {
    for (const [id, j] of Object.entries(raw.jobs)) {
      if (!isRecord(j) || typeof j.title !== "string") continue;
      const label = READINESS.find((x) => x === j.label);
      if (label) jobs[id] = { title: j.title, label };
    }
  }
  return { at: raw.at, criteria, jobs };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
