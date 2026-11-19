import { NextResponse, type NextRequest } from "next/server";
import { INVITE_COOKIE, INVITE_DAYS, inviteCodeFromPath, invitePath, isInviteCode } from "./invite-code";

// Keeps a coaching invite through sign-in, for both sign-in services' proxies: a signed-out visit to
// /coach/<code> remembers the code in a cookie on its way to /login, and the first signed-in visit
// to / goes back to the consent screen (and forgets the code).

// Signed out on an invite link: the response that sends them to sign in, carrying the code.
export function rememberInvite(request: NextRequest, toLogin: () => NextResponse): NextResponse | null {
  const code = inviteCodeFromPath(request.nextUrl.pathname);
  if (!code) return null;
  const response = toLogin();
  response.cookies.set(INVITE_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: INVITE_DAYS * 86_400,
  });
  return response;
}

// Signed in, on /, with an invite waiting: back to the consent screen.
export function resumeInvite(request: NextRequest): NextResponse | null {
  if (request.nextUrl.pathname !== "/") return null;
  const code = request.cookies.get(INVITE_COOKIE)?.value;
  if (!code) return null;
  const url = request.nextUrl.clone();
  url.search = "";
  url.pathname = isInviteCode(code) ? invitePath(code) : "/";
  const response = NextResponse.redirect(url);
  response.cookies.delete(INVITE_COOKIE);
  return response;
}
