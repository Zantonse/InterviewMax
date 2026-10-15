// Deletes people from Auth0 when they delete their InterviewMax account (PRD v0.3: deleting an
// account removes it from both Auth0 and Supabase). Uses the Auth0 Management API with a
// machine-to-machine app that has only the delete:users permission:
//   AUTH0_DOMAIN                 the tenant domain, without https:// (shared with sign-in)
//   AUTH0_MGMT_CLIENT_ID         the machine-to-machine app's client id
//   AUTH0_MGMT_CLIENT_SECRET     and its secret
// Server-side only.

type Env = Record<string, string | undefined>;
type Fetch = typeof fetch;

export class Auth0DeleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Auth0DeleteError";
  }
}

export function auth0ManagementConfigured(env: Env = process.env) {
  return Boolean(env.AUTH0_DOMAIN && env.AUTH0_MGMT_CLIENT_ID && env.AUTH0_MGMT_CLIENT_SECRET);
}

function tenant(env: Env) {
  return (env.AUTH0_DOMAIN ?? "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

// Deletes each Auth0 user id (the token's "sub", like "google-oauth2|123"). A user Auth0 no longer
// has counts as deleted. Throws if Auth0 isn't set up or refuses, so the caller can stop before
// deleting anything else and the person can try again.
export async function deleteAuth0Users(
  ids: string[],
  env: Env = process.env,
  fetchFn: Fetch = fetch,
): Promise<void> {
  if (ids.length === 0) return;
  if (!auth0ManagementConfigured(env)) {
    throw new Auth0DeleteError(
      "AUTH0_MGMT_CLIENT_ID and AUTH0_MGMT_CLIENT_SECRET aren't set, so the Auth0 sign-in can't be deleted.",
    );
  }
  const domain = tenant(env);

  const tokenRes = await fetchFn(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: env.AUTH0_MGMT_CLIENT_ID,
      client_secret: env.AUTH0_MGMT_CLIENT_SECRET,
      audience: `https://${domain}/api/v2/`,
    }),
  });
  if (!tokenRes.ok) {
    throw new Auth0DeleteError(`Auth0 refused the Management API token (${tokenRes.status}).`);
  }
  const { access_token: token } = (await tokenRes.json()) as { access_token?: string };
  if (!token) throw new Auth0DeleteError("Auth0 sent no Management API token.");

  for (const id of ids) {
    const res = await fetchFn(`https://${domain}/api/v2/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
      throw new Auth0DeleteError(`Auth0 refused to delete a sign-in (${res.status}).`);
    }
  }
}
