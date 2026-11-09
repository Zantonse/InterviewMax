import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { filterDefaultIdTokenClaims } from "@auth0/nextjs-auth0/server";
import { auth0 } from "@/lib/auth0/client";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FieldId } from "@/lib/field/fields";

// Signs a persona in on a preview. Real people sign in with an Auth0 email code, which a robot
// can't read, so each persona is an Auth0 user with a password in its own database connection,
// enabled only for a separate "InterviewMax Sims" Auth0 application. That connection never shows
// on the sign-in page. The token comes from Auth0 itself, so Supabase trusts it exactly as it
// trusts a real user's, and the rest of the app runs unchanged.

type TokenResponse = {
  id_token?: string;
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export type SimTokens = {
  idToken: string;
  accessToken: string;
  expiresIn: number;
  scope?: string;
  tokenType?: string;
  claims: Record<string, unknown>;
};

export class SimSetupError extends Error {}

function decodeClaims(jwt: string): Record<string, unknown> {
  const payload = jwt.split(".")[1];
  if (!payload) throw new SimSetupError("Auth0 sent a malformed ID token.");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

// Auth0's password-realm grant: the persona's email and the shared persona password, checked
// against the persona connection only.
export async function personaTokens(email: string): Promise<SimTokens> {
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.SIM_AUTH0_CLIENT_ID;
  const clientSecret = process.env.SIM_AUTH0_CLIENT_SECRET;
  const password = process.env.SIM_USERS_PASSWORD;
  const realm = process.env.SIM_AUTH0_CONNECTION || "interviewmax-sims";
  if (!domain || !clientId || !clientSecret || !password) {
    throw new SimSetupError(
      "Persona sign-in needs AUTH0_DOMAIN, SIM_AUTH0_CLIENT_ID, SIM_AUTH0_CLIENT_SECRET and SIM_USERS_PASSWORD in Vercel Preview.",
    );
  }
  const res = await fetch(`https://${domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "http://auth0.com/oauth/grant-type/password-realm",
      realm,
      username: email,
      password,
      client_id: clientId,
      client_secret: clientSecret,
      scope: "openid profile email",
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok || !body.id_token || !body.access_token) {
    throw new SimSetupError(
      `Auth0 refused the persona sign-in (${body.error ?? res.status}: ${body.error_description ?? "no detail"}).`,
    );
  }
  const claims = decodeClaims(body.id_token);
  if (String(claims.email ?? "").toLowerCase() !== email) {
    throw new SimSetupError("Auth0 signed in a different user than the persona asked for.");
  }
  if (claims.role !== "authenticated") {
    throw new SimSetupError(
      "The ID token has no role claim, so Supabase would refuse it. Add the Sims app's client ID to the post-login Action.",
    );
  }
  return {
    idToken: body.id_token,
    accessToken: body.access_token,
    expiresIn: Number(body.expires_in ?? 3600),
    scope: body.scope,
    tokenType: body.token_type,
    claims,
  };
}

const UNDEFINED_COLUMN = "42703";

// Starts the persona from a clean, brand-new account: deletes its old profile (which deletes
// everything it made) and makes a fresh one flagged is_simulated, so /admin leaves it out, with
// "Your field" set. Linking the Auth0 identity here means claim_profile() finds it straight away.
export async function resetPersonaAccount(input: {
  sub: string;
  email: string;
  field: FieldId;
}): Promise<string> {
  const supabase = createAdminClient();
  if (!supabase) throw new SimSetupError("SUPABASE_SECRET_KEY isn't set in Vercel Preview.");

  // Fail before touching anything if the flag column is missing: an unflagged persona would
  // count in Craig's funnel.
  const probe = await supabase.from("profiles").select("id").eq("is_simulated", true).limit(1);
  if (probe.error?.code === UNDEFINED_COLUMN) {
    throw new SimSetupError("Run supabase/migrations/20261107000000_simulated_users.sql first.");
  }
  if (probe.error) throw new Error(`Checking profiles failed: ${probe.error.message}`);

  await deletePersonaAccount(input.sub, input.email);

  const { data, error } = await supabase
    .from("profiles")
    .insert({ email: input.email, role_field: input.field, is_simulated: true })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Making the persona profile failed: ${error?.message}`);
  const id = (data as { id: string }).id;

  const link = await supabase
    .from("auth_identities")
    .insert({ sub: input.sub, profile_id: id, email: input.email });
  if (link.error) throw new Error(`Linking the persona identity failed: ${link.error.message}`);
  return id;
}

// Deletes the persona's profile and identity link. Only ever called with a sim email (the
// routes check), and only deletes profiles flagged is_simulated or holding that exact email.
export async function deletePersonaAccount(sub: string | null, email: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) throw new SimSetupError("SUPABASE_SECRET_KEY isn't set in Vercel Preview.");
  const ids = new Set<string>();
  if (sub) {
    const { data } = await supabase.from("auth_identities").select("profile_id").eq("sub", sub);
    (data as { profile_id: string }[] | null)?.forEach((r) => ids.add(r.profile_id));
  }
  const { data: byEmail } = await supabase.from("profiles").select("id").eq("email", email);
  (byEmail as { id: string }[] | null)?.forEach((r) => ids.add(r.id));
  if (ids.size > 0) {
    const { error } = await supabase
      .from("profiles")
      .delete()
      .in("id", [...ids])
      .or(`is_simulated.is.true,email.eq.${email}`);
    if (error) throw new Error(`Clearing the old persona account failed: ${error.message}`);
  }
  if (sub) await supabase.from("auth_identities").delete().eq("sub", sub);
}

type SessionWriter = {
  sessionStore?: {
    set(reqCookies: unknown, resCookies: unknown, session: unknown, isNew?: boolean): Promise<void>;
  };
};

// Saves an Auth0 session cookie for the persona, built the same way the SDK builds one after a
// passwordless sign-in. The SDK has no public call for this, so it uses the client's session
// store; if an SDK upgrade moves it, this fails loudly instead of signing anyone in wrongly.
export async function savePersonaSession(
  request: NextRequest,
  response: NextResponse,
  tokens: SimTokens,
): Promise<void> {
  const store = (auth0() as unknown as SessionWriter).sessionStore;
  if (!store || typeof store.set !== "function") {
    throw new SimSetupError("The Auth0 SDK no longer exposes its session store; update src/lib/sims/session.ts.");
  }
  const now = Math.floor(Date.now() / 1000);
  await store.set(
    request.cookies,
    response.cookies,
    {
      user: filterDefaultIdTokenClaims(tokens.claims),
      tokenSet: {
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        scope: tokens.scope,
        expiresAt: now + tokens.expiresIn,
        token_type: tokens.tokenType,
      },
      internal: { sid: typeof tokens.claims.sid === "string" ? tokens.claims.sid : "", createdAt: now },
    },
    true,
  );
}
