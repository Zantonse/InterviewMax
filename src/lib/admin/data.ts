import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSignalKind } from "@/lib/signals/kinds";
import type { StoredSignal } from "@/lib/signals/visits";
import { parseContent, type StoryContent } from "@/lib/stories/content";
import { isUsageEvent, type UsageEvent } from "@/lib/usage/events";
import { isAdminEmail } from "./access";
import type { EventRow, SignalRow } from "./analytics";
import type { EventFirst, UserProgress } from "./metrics";

// The admin panel's only door to the database. Every function here starts with requireAdmin(),
// and every page view is logged before any data is read. Reads activity and counts, plus a
// user's stories for coaching (Craig's call, 2026-10-16; the privacy policy says so). Never
// uploads (resumes, LinkedIn PDFs, transcripts).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIMELINE_LIMIT = 500;
const SIGNALS_LIMIT = 1000;
const RECENT_VIEWS = 20;
// Analytics read rows a page at a time (the API returns at most 1000 per request), up to a cap.
const PAGE_SIZE = 1000;
const ANALYTICS_ROW_CAP = 50_000;

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
export type Admin = { email: string; supabase: AdminClient };

export class AdminSetupError extends Error {}

// Lets an admin through and 404s everyone else, so the panel's existence isn't revealed. Both the
// signed-in email and the email on the user's profile must be on the allowlist: the profile email
// was verified when the account was made, whichever service signed the person in.
export async function requireAdmin(): Promise<Admin> {
  const user = await getCurrentUser();
  if (!isAdminEmail(user.email)) notFound();
  const supabase = createAdminClient();
  if (!supabase) {
    throw new AdminSetupError("Set SUPABASE_SECRET_KEY on the server to open the admin panel.");
  }
  const { data, error } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`Couldn't check admin access: ${error.message}`);
  if (!isAdminEmail(data?.email)) notFound();
  return { email: user.email.trim().toLowerCase(), supabase };
}

// Records an admin page view. Fails closed: if the view can't be logged, nothing is shown.
export async function logAdminView(
  admin: Admin,
  // "story:<id>" records which story was opened.
  view: "overview" | "analytics" | "review" | "guidelines" | "user" | `story:${string}`,
  subjectUserId?: string,
): Promise<void> {
  const { error } = await admin.supabase.from("admin_views").insert({
    admin_email: admin.email,
    view,
    subject_user_id: subjectUserId ?? null,
  });
  if (error) throw new Error(`Couldn't log this admin view, so it isn't shown: ${error.message}`);
}

type ProgressRow = {
  user_id: string;
  email: string | null;
  signed_up_at: string;
  last_active_at: string | null;
  jobs: number;
  jobs_with_questions: number;
  interview_dates: number;
  stories_started: number;
  stories_finished: number;
  stories_graded: number;
  about_me_done: boolean;
  assessment_done: boolean;
  finder_used: boolean;
  transcripts: number;
};

function toProgress(row: ProgressRow): UserProgress {
  return {
    id: row.user_id,
    email: row.email ?? "",
    signedUpAt: row.signed_up_at,
    lastActiveAt: row.last_active_at ?? row.signed_up_at,
    jobs: row.jobs,
    jobsWithQuestions: row.jobs_with_questions,
    interviewDates: row.interview_dates,
    storiesStarted: row.stories_started,
    storiesFinished: row.stories_finished,
    storiesGraded: row.stories_graded,
    aboutMeDone: row.about_me_done,
    assessmentDone: row.assessment_done,
    finderUsed: row.finder_used,
    transcripts: row.transcripts,
  };
}

export async function listUserProgress(admin: Admin): Promise<UserProgress[]> {
  const { data, error } = await admin.supabase.rpc("admin_user_progress");
  if (error) throw new Error(`Couldn't load users: ${error.message}`);
  return (data as ProgressRow[]).map(toProgress);
}

type FirstRow = {
  user_id: string;
  event: string;
  first_at: string;
  times: number;
  estimated: boolean;
};

export async function listEventFirsts(admin: Admin): Promise<EventFirst[]> {
  const { data, error } = await admin.supabase.rpc("admin_event_firsts");
  if (error) throw new Error(`Couldn't load activity: ${error.message}`);
  return (data as FirstRow[]).flatMap((row) =>
    isUsageEvent(row.event)
      ? [
          {
            userId: row.user_id,
            event: row.event,
            firstAt: row.first_at,
            times: row.times,
            estimated: row.estimated,
          },
        ]
      : [],
  );
}

export type TimelineEntry = { event: UsageEvent; at: string; estimated: boolean };

export async function userTimeline(admin: Admin, userId: string): Promise<TimelineEntry[]> {
  if (!UUID_RE.test(userId)) return [];
  const { data, error } = await admin.supabase
    .from("usage_events")
    .select("event, created_at, estimated")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(TIMELINE_LIMIT);
  if (error) throw new Error(`Couldn't load this user's timeline: ${error.message}`);
  return (data as { event: string; created_at: string; estimated: boolean }[]).flatMap((row) =>
    isUsageEvent(row.event) ? [{ event: row.event, at: row.created_at, estimated: row.estimated }] : [],
  );
}

// The user's most recent confusion signals (pages, rage and dead clicks, errors, abandoned forms).
export async function userSignals(admin: Admin, userId: string): Promise<StoredSignal[]> {
  if (!UUID_RE.test(userId)) return [];
  const { data, error } = await admin.supabase
    .from("ui_signals")
    .select("kind, path, target, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(SIGNALS_LIMIT);
  if (error) throw new Error(`Couldn't load this user's clicks: ${error.message}`);
  return (data as { kind: string; path: string; target: string; created_at: string }[]).flatMap(
    (row) =>
      isSignalKind(row.kind)
        ? [{ kind: row.kind, path: row.path, target: row.target, at: row.created_at }]
        : [],
  );
}

// Reads every row of a query a page at a time, up to ANALYTICS_ROW_CAP. `truncated` says the cap
// was hit, so the page can say the numbers are partial.
async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  what: string,
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < ANALYTICS_ROW_CAP; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Couldn't load ${what}: ${error.message}`);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

// Usage events since `since` (all time when null), oldest first. Ids, names and times only.
export async function listEventsSince(
  admin: Admin,
  since: Date | null,
): Promise<{ rows: EventRow[]; truncated: boolean }> {
  const { rows, truncated } = await readAll<{
    user_id: string;
    event: string;
    created_at: string;
    estimated: boolean;
  }>((from, to) => {
    let query = admin.supabase.from("usage_events").select("user_id, event, created_at, estimated");
    if (since) query = query.gte("created_at", since.toISOString());
    return query.order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to);
  }, "usage events");
  return {
    truncated,
    rows: rows.flatMap((row) =>
      isUsageEvent(row.event)
        ? [{ userId: row.user_id, event: row.event, at: row.created_at, estimated: row.estimated }]
        : [],
    ),
  };
}

// Click signals since `since` (all time when null), oldest first. Kind and page only, not targets.
export async function listSignalsSince(
  admin: Admin,
  since: Date | null,
): Promise<{ rows: SignalRow[]; truncated: boolean }> {
  const { rows, truncated } = await readAll<{
    user_id: string;
    kind: string;
    path: string;
    created_at: string;
  }>((from, to) => {
    let query = admin.supabase.from("ui_signals").select("user_id, kind, path, created_at");
    if (since) query = query.gte("created_at", since.toISOString());
    return query.order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to);
  }, "click signals");
  return {
    truncated,
    rows: rows.flatMap((row) =>
      isSignalKind(row.kind)
        ? [{ userId: row.user_id, kind: row.kind, path: row.path, at: row.created_at }]
        : [],
    ),
  };
}

export function isUserId(value: string): boolean {
  return UUID_RE.test(value);
}

export type AdminViewEntry = {
  adminEmail: string;
  view: string;
  subjectUserId: string | null;
  at: string;
};

export async function recentAdminViews(admin: Admin): Promise<AdminViewEntry[]> {
  const { data, error } = await admin.supabase
    .from("admin_views")
    .select("admin_email, view, subject_user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(RECENT_VIEWS);
  if (error) throw new Error(`Couldn't load the admin view log: ${error.message}`);
  return (
    data as {
      admin_email: string;
      view: string;
      subject_user_id: string | null;
      created_at: string;
    }[]
  ).map((row) => ({
    adminEmail: row.admin_email,
    view: row.view,
    subjectUserId: row.subject_user_id,
    at: row.created_at,
  }));
}

export type AdminStory = {
  id: string;
  title: string;
  storyType: string | null;
  content: StoryContent;
  createdAt: string;
  updatedAt: string;
};

type StoryRow = {
  id: string;
  title: string;
  story_type: string | null;
  content: unknown;
  created_at: string;
  updated_at: string;
};

function toAdminStory(row: StoryRow): AdminStory {
  return {
    id: row.id,
    title: row.title,
    storyType: row.story_type,
    content: parseContent(row.content),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// One user's stories, newest first, for the coach to read. Callers log the view first.
export async function listUserStories(admin: Admin, userId: string): Promise<AdminStory[]> {
  if (!isUserId(userId)) return [];
  const { data, error } = await admin.supabase
    .from("stories")
    .select("id, title, story_type, content, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Couldn't load this user's stories: ${error.message}`);
  return (data as StoryRow[]).map(toAdminStory);
}

export async function getUserStory(
  admin: Admin,
  userId: string,
  storyId: string,
): Promise<AdminStory | null> {
  if (!isUserId(userId) || !UUID_RE.test(storyId)) return null;
  const { data, error } = await admin.supabase
    .from("stories")
    .select("id, title, story_type, content, created_at, updated_at")
    .eq("user_id", userId)
    .eq("id", storyId)
    .maybeSingle();
  if (error) throw new Error(`Couldn't load the story: ${error.message}`);
  return data ? toAdminStory(data as StoryRow) : null;
}
