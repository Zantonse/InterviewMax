import "server-only";
import { after } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UsageEvent } from "./events";

// Records that the signed-in user did something. The event is written after the response is sent,
// so it never slows the user down, and a failure only logs: tracking must never break the app.
// Stores the user id, the event name and the time, nothing else.
export async function trackEvent(event: UsageEvent): Promise<void> {
  let userId: string;
  try {
    userId = (await getCurrentUser()).id;
  } catch (err) {
    unstable_rethrow(err);
    return;
  }
  after(async () => {
    const supabase = createAdminClient();
    if (!supabase) return;
    const { error } = await supabase.from("usage_events").insert({ user_id: userId, event });
    if (error) console.error(`Usage tracking: recording ${event} failed`, error.message);
  });
}
