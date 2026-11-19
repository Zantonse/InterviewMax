import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth0 } from "@/lib/auth0/client";
import { authProvider } from "@/lib/auth0/provider";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  // The profile id every row is keyed by, whichever service signed the person in.
  id: string;
  email: string;
};

// The one place pages read the signed-in user. Redirects to /login if there is none.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  if (authProvider() === "auth0") return getAuth0User();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) {
    redirect("/login");
  }
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});

async function getAuth0User(): Promise<CurrentUser> {
  const session = await auth0().getSession();
  if (!session) {
    redirect("/login");
  }
  // Finds this Auth0 identity's profile, linking it to an existing tester by verified email or
  // making a new one on first sign-in (supabase/migrations/20261014040000_auth0_sign_in.sql).
  // Partial prefetching renders an App Shell for each link ahead of the click, and Next rejects
  // uncached fetches in that render once it finishes. The lookup would then fail, log
  // "claim_profile failed" and redirect inside a render nobody sees. Waiting for the real request
  // keeps the lookup out of the shell; on a page load, action or navigation it resolves at once.
  await connection();
  // claim_profile only links a verified email (it's how a sign-in finds an existing tester's
  // stories). Say so before asking, with the way to fix it, instead of a failed lookup and a
  // general "couldn't open your account".
  if (session.user.email_verified === false) {
    redirect("/login?error=unverified");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_profile");
  if (error || typeof data !== "string") {
    console.error("claim_profile failed:", error?.message ?? "no profile id");
    redirect(
      error?.message?.includes("verified email") ? "/login?error=unverified" : "/login?error=account",
    );
  }
  return { id: data, email: typeof session.user.email === "string" ? session.user.email : "" };
}
