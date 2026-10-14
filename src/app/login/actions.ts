"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string; codeError?: string }
  | { status: "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    return { status: "error", message: "We couldn't send the link. Try again in a minute." };
  }
  return { status: "sent", email };
}

// Signs in with the code printed in the email. Nothing in the email has to be
// clicked, so it works when a work mail scanner has already opened the link,
// and on a different device from the one reading the email.
export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!EMAIL_RE.test(email)) {
    return { status: "error", message: "Enter a valid email address." };
  }
  if (!/^\d{6,10}$/.test(token)) {
    return { status: "sent", email, codeError: "Enter the code from the email, digits only." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return {
      status: "sent",
      email,
      codeError: "That code didn't work or has expired. Check the newest email, or request a new one.",
    };
  }
  redirect("/");
}
