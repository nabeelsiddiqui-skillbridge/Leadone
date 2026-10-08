"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { rateLimitOrMessage } from "@/lib/rate-limit";

export interface AuthActionState {
  error?: string;
  message?: string;
}

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const rateLimitError = await rateLimitOrMessage("sign-up", 10, 60 * 60);
  if (rateLimitError) return { error: rateLimitError };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();

  if (!email || !password) {
    return { error: "Email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, company_name: companyName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect("/onboarding");
}

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  // Generous-but-real limit: stops a credential-stuffing loop against a
  // single IP without locking out someone who just mistyped their password
  // a few times.
  const rateLimitError = await rateLimitOrMessage("sign-in", 20, 5 * 60);
  if (rateLimitError) return { error: rateLimitError };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const rateLimitError = await rateLimitOrMessage("forgot-password", 5, 15 * 60);
  if (rateLimitError) return { error: rateLimitError };

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Email is required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  // The confirmation email carries a 6-digit code (not a clickable link) -
  // email security scanners that prefetch links were silently consuming the
  // one-time token before the user could click it, so verification happens
  // here via the code instead. See resetPasswordAction.
  redirect(`/reset-password?email=${encodeURIComponent(email)}`);
}

export async function resetPasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!email) return { error: "Email is required." };
  if (!/^\d{6}$/.test(code)) {
    return { error: "Enter the 6-digit code from your email." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (verifyError) {
    return { error: verifyError.message };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    return { error: updateError.message };
  }

  redirect("/dashboard");
}
