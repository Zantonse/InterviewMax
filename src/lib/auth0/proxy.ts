import { NextResponse, type NextRequest } from "next/server";
import { isPublicPath } from "@/lib/supabase/proxy";
import { auth0 } from "./client";
import { needsRefresh } from "./tokens";

// The proxy when Auth0 signs people in: mounts Auth0's /auth/* routes, keeps the ID token that
// Supabase reads fresh, and sends signed-out visitors to /login.
export async function auth0Session(request: NextRequest) {
  const client = auth0();
  // Always return this response (or one built on it): it carries Auth0's session cookies.
  const authRes = await client.middleware(request);
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/auth/")) return authRes;

  const session = await client.getSession(request);
  if (!session) {
    // A server action can't follow a redirect from here; it calls getCurrentUser, which redirects.
    if (isPublicPath(pathname) || request.headers.has("next-action")) return authRes;
    return redirect(request, "/login");
  }

  // ?error= keeps a signed-in person on /login to read why their account couldn't open.
  if (pathname === "/login" && !request.nextUrl.searchParams.has("error")) {
    return redirect(request, "/");
  }

  if (needsRefresh(session.tokenSet)) {
    try {
      await client.getAccessToken(request, authRes, { refresh: true });
    } catch {
      return redirect(request, "/auth/logout");
    }
  }
  return authRes;
}

function redirect(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}
