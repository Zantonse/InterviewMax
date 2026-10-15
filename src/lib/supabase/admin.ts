import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

// A Supabase client with the secret key, which skips row-level security. Only usage tracking and
// the admin panel use it: tracking writes events the browser can't forge, and the admin panel
// reads activity across users after checking the viewer is an admin. Never import it anywhere
// else. Returns null when SUPABASE_SECRET_KEY isn't set, so tracking quietly does nothing.
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return null;
  const { url } = supabaseEnv();
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
