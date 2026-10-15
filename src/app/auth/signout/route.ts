import { NextResponse, type NextRequest } from "next/server";
import { authProvider } from "@/lib/auth0/provider";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const target = request.nextUrl.clone();
  target.search = "";

  if (authProvider() === "auth0") {
    // Auth0's logout route clears the session and ends the Auth0 sign-in too.
    target.pathname = "/auth/logout";
    return NextResponse.redirect(target, { status: 303 });
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  target.pathname = "/login";
  return NextResponse.redirect(target, { status: 303 });
}
