import { NextResponse } from "next/server";
import { Auth0Client } from "@auth0/nextjs-auth0/server";
import { safeReturnTo } from "./tokens";

let client: Auth0Client | undefined;

// The Auth0 client, made on first use so Supabase-only deployments never need Auth0 settings.
// It reads AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET and AUTH0_SECRET from the
// environment, and APP_BASE_URL when set (left unset, it uses the request's host, which keeps
// Vercel preview links working). It mounts /auth/login, /auth/callback and /auth/logout.
export function auth0(): Auth0Client {
  client ??= new Auth0Client({
    // email gives Supabase the verified address that matches existing testers to their stories;
    // offline_access gives a refresh token so the ID token can be renewed (see tokens.ts).
    authorizationParameters: { scope: "openid profile email offline_access" },
    async onCallback(error, ctx) {
      const base = ctx.appBaseUrl ?? process.env.APP_BASE_URL ?? "http://localhost:3000";
      if (error) {
        return NextResponse.redirect(new URL("/login?error=auth0", base));
      }
      return NextResponse.redirect(safeReturnTo(ctx.returnTo, base));
    },
  });
  return client;
}
