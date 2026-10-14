import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Lands here from the magic-link email. Handles both link styles:
// ?token_hash=…&type=email (works across browsers) and ?code=… (PKCE, same browser).
//
// A token_hash link is never spent on GET. Work email security scanners
// (Outlook Safe Links, Proofpoint, Mimecast…) open every link in a message
// before the person does, and a one-time token spent by the scanner leaves the
// real click with "expired". So GET only shows a Continue button
// (/auth/continue), and the token is verified when that button POSTs back here.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  if (tokenHash && type) {
    const target = request.nextUrl.clone();
    target.pathname = "/auth/continue";
    target.search = "";
    target.searchParams.set("token_hash", tokenHash);
    target.searchParams.set("type", type);
    return NextResponse.redirect(target);
  }

  let ok = false;
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  return finish(request, ok);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "") as EmailOtpType;

  let ok = false;
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  }
  return finish(request, ok);
}

function finish(request: NextRequest, ok: boolean) {
  const target = request.nextUrl.clone();
  target.search = "";
  target.pathname = ok ? "/" : "/login";
  if (!ok) target.searchParams.set("error", "link");
  // 303 so the browser follows a POST with a GET.
  return NextResponse.redirect(target, 303);
}
