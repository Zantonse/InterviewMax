import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { INVITE_COOKIE, newInviteCode } from "./invite-code";
import { rememberInvite, resumeInvite } from "./invite-cookie";

const toLogin = () => NextResponse.redirect("https://app.test/login");

describe("coaching invite through sign-in", () => {
  it("remembers the invite on the way to sign in", () => {
    const code = newInviteCode();
    const res = rememberInvite(new NextRequest(`https://app.test/coach/${code}`), toLogin);
    expect(res?.headers.get("location")).toBe("https://app.test/login");
    expect(res?.cookies.get(INVITE_COOKIE)?.value).toBe(code);
    expect(res?.cookies.get(INVITE_COOKIE)?.httpOnly).toBe(true);
  });

  it("leaves other paths and bad codes alone", () => {
    expect(rememberInvite(new NextRequest("https://app.test/stories"), toLogin)).toBeNull();
    expect(rememberInvite(new NextRequest("https://app.test/coach/short"), toLogin)).toBeNull();
  });

  it("sends a signed-in visit to / back to the consent screen once", () => {
    const code = newInviteCode();
    const req = new NextRequest("https://app.test/");
    req.cookies.set(INVITE_COOKIE, code);
    const res = resumeInvite(req);
    expect(res?.headers.get("location")).toBe(`https://app.test/coach/${code}`);
    expect(res?.cookies.get(INVITE_COOKIE)?.value).toBe("");
    expect(resumeInvite(new NextRequest("https://app.test/"))).toBeNull();
    const elsewhere = new NextRequest("https://app.test/jobs");
    elsewhere.cookies.set(INVITE_COOKIE, code);
    expect(resumeInvite(elsewhere)).toBeNull();
  });
});
