import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseSignals } from "@/lib/signals/parse";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BODY_BYTES = 64 * 1024;

// Receives batches of confusion signals from src/instrumentation-client.ts and files them under
// the signed-in user. Always answers 204 (or 400/413 for a bad body): tracking must never get in
// the user's way, and signed-out visitors are simply not recorded.
export async function POST(request: NextRequest) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const signals = parseSignals(body);
  if (signals.length === 0) return new NextResponse(null, { status: 204 });

  const userId = await signedInUserId();
  const supabase = createAdminClient();
  if (!userId || !supabase) return new NextResponse(null, { status: 204 });
  const { error } = await supabase.from("ui_signals").insert(
    signals.map((s) => ({
      user_id: userId,
      kind: s.kind,
      path: s.path,
      target: s.target,
      created_at: new Date(s.at).toISOString(),
    })),
  );
  if (error) console.error("Signals: recording failed", error.message);
  return new NextResponse(null, { status: 204 });
}

// getCurrentUser redirects when no one is signed in; here that just means "don't record".
async function signedInUserId(): Promise<string | null> {
  try {
    return (await getCurrentUser()).id;
  } catch {
    return null;
  }
}
