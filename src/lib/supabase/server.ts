import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createTokenClient } from "@supabase/supabase-js";
import { auth0 } from "@/lib/auth0/client";
import { authProvider } from "@/lib/auth0/provider";
import { supabaseEnv } from "./env";

// Create a new client per request; never share one across requests.
export async function createClient() {
  const { url, key } = supabaseEnv();

  if (authProvider() === "auth0") {
    // Supabase trusts Auth0's ID token through third-party auth, and row-level security finds the
    // user's profile from it (public.current_user_id()). The proxy keeps the token fresh.
    // supabase.auth.* isn't available on this client; sign-in lives in Auth0.
    return createTokenClient(url, key, {
      accessToken: async () => (await auth0().getSession())?.tokenSet.idToken ?? null,
    });
  }

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
