import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
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
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_profile");
  if (error || typeof data !== "string") {
    console.error("claim_profile failed:", error?.message ?? "no profile id");
    redirect("/login?error=account");
  }
  return { id: data, email: typeof session.user.email === "string" ? session.user.email : "" };
}
