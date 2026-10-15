import type { NextRequest } from "next/server";
import { auth0Session } from "@/lib/auth0/proxy";
import { authProvider } from "@/lib/auth0/provider";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return authProvider() === "auth0" ? auth0Session(request) : updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static files and images.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
