// Which service signs people in. Supabase magic links stay the default until Auth0 is verified
// on a preview; set AUTH_PROVIDER=auth0 in Vercel to switch. Data stays in Supabase either way.
export type AuthProvider = "supabase" | "auth0";

export function authProvider(): AuthProvider {
  return process.env.AUTH_PROVIDER === "auth0" ? "auth0" : "supabase";
}
