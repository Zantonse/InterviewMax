import { NextResponse, type NextRequest } from "next/server";
import { isPersonaId, secretMatches, simEmail, simsEnabled } from "@/lib/sims/access";
import { deletePersonaAccount } from "@/lib/sims/session";
import { createAdminClient } from "@/lib/supabase/admin";

// Preview only: what a persona made during a simulated-user run (its stories, jobs, usage events
// and click signals), so the runner can score the run without scraping the page. With
// {"delete": true} it then deletes the persona's account. Same guards as ../session.
export async function POST(request: NextRequest) {
  if (!simsEnabled() || !secretMatches(request.headers.get("x-sim-secret"))) {
    return new NextResponse(null, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { persona?: unknown; delete?: unknown };
  if (!isPersonaId(body.persona)) {
    return NextResponse.json({ error: "Unknown persona." }, { status: 400 });
  }
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_SECRET_KEY isn't set." }, { status: 409 });
  const email = simEmail(body.persona);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, is_simulated, role_field")
    .eq("email", email)
    .eq("is_simulated", true)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!profile) return NextResponse.json({ profile: null, stories: [], jobs: [], events: [], signals: [] });
  const id = (profile as { id: string }).id;

  const [stories, jobs, events, signals] = await Promise.all([
    supabase
      .from("stories")
      .select("id, title, story_type, content, tier, created_at, updated_at")
      .eq("user_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("target_jobs")
      .select("id, title, company, level, likely_questions, created_at")
      .eq("user_id", id),
    supabase
      .from("usage_events")
      .select("event, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("ui_signals")
      .select("kind, path, target, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: true }),
  ]);
  const failed = [stories, jobs, events, signals].find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });

  const result = {
    profile,
    stories: stories.data ?? [],
    jobs: (jobs.data ?? []).map((j) => {
      const { likely_questions, ...rest } = j as Record<string, unknown>;
      return { ...rest, hasLikelyQuestions: likely_questions != null };
    }),
    events: events.data ?? [],
    signals: signals.data ?? [],
  };

  if (body.delete === true) {
    try {
      await deletePersonaAccount(null, email);
    } catch (err) {
      console.error("Deleting the persona account failed:", err);
    }
  }
  return NextResponse.json(result);
}
