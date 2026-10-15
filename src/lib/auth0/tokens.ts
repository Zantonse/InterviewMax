// When a JWT expires, in Unix seconds, from its payload. The signature isn't checked: this only
// decides when to refresh our own session's token, never whether to trust one.
export function jwtExpiresAt(token: string | undefined): number | undefined {
  const payload = token?.split(".")[1];
  if (!payload) return undefined;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof exp === "number" ? exp : undefined;
  } catch {
    return undefined;
  }
}

// Supabase reads the Auth0 ID token, which can expire before the access token the SDK refreshes
// on its own (10 hours against 24 by default), so refresh when either is close to running out.
export const REFRESH_WITHIN_SECONDS = 5 * 60;

export function needsRefresh(
  tokenSet: { idToken?: string; expiresAt?: number },
  nowSeconds = Date.now() / 1000,
): boolean {
  const expiries = [tokenSet.expiresAt, jwtExpiresAt(tokenSet.idToken)].filter(
    (t): t is number => typeof t === "number",
  );
  if (expiries.length === 0) return false;
  return Math.min(...expiries) - nowSeconds < REFRESH_WITHIN_SECONDS;
}

// Where to send someone after Auth0 sign-in: a path on this site, never another site.
export function safeReturnTo(returnTo: string | undefined, base: string): URL {
  const home = new URL("/", base);
  if (!returnTo) return home;
  try {
    const url = new URL(returnTo, base);
    return url.origin === home.origin ? url : home;
  } catch {
    return home;
  }
}
