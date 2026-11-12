import { NextResponse, type NextRequest } from "next/server";
import { authProvider } from "@/lib/auth0/provider";
import { FIELD_IDS, type FieldId } from "@/lib/field/fields";
import { isPersonaId, secretMatches, simEmail, simsEnabled } from "@/lib/sims/access";
import {
  SimSetupError,
  personaTokens,
  resetPersonaAccount,
  savePersonaSession,
} from "@/lib/sims/session";

// Preview only: signs a persona in for a simulated-user run (scripts/sims). Answers 404 in
// production, without SIM_USERS_SECRET, or to anyone without it, so it looks like it isn't there.
export async function POST(request: NextRequest) {
  if (!simsEnabled() || !secretMatches(request.headers.get("x-sim-secret"))) {
    return new NextResponse(null, { status: 404 });
  }
  if (authProvider() !== "auth0") {
    return NextResponse.json({ error: "Persona runs need AUTH_PROVIDER=auth0 on previews." }, { status: 501 });
  }

  const body = (await request.json().catch(() => ({}))) as { persona?: unknown; field?: unknown };
  if (!isPersonaId(body.persona)) {
    return NextResponse.json({ error: "Unknown persona." }, { status: 400 });
  }
  const field: FieldId = FIELD_IDS.includes(body.field as FieldId) ? (body.field as FieldId) : "generic";
  const email = simEmail(body.persona);

  try {
    const tokens = await personaTokens(email);
    const sub = String(tokens.claims.sub ?? "");
    if (!sub) throw new SimSetupError("Auth0's ID token has no subject.");
    const profileId = await resetPersonaAccount({ sub, email, field });
    const response = NextResponse.json({ profileId, email });
    await savePersonaSession(request, response, tokens);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Persona sign-in failed:", message);
    return NextResponse.json({ error: message }, { status: error instanceof SimSetupError ? 409 : 500 });
  }
}
