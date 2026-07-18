"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./login-form.module.css";

type Status = {
  type: "idle" | "error" | "success";
  message: string;
};

type Mode = "signin" | "forgot";

function sanitizeNextPath(input: string | null) {
  if (!input) return "/portal";
  if (!input.startsWith("/")) return "/portal";
  if (input.startsWith("//")) return "/portal";
  return input;
}

type LoginFormProps = {
  nextPathParam?: string;
  errorMessageParam?: string;
  // Hide the "Return Home" button when the form is embedded on the homepage
  // itself (there is nowhere to return to). Defaults to showing it on /login.
  hideReturnHome?: boolean;
  // Hide the "Access is invitation-only…" fine print. Used on the public
  // landing, where it's redundant beside the discovery-call invitation.
  hideInviteNote?: boolean;
};

export function LoginForm({ nextPathParam, errorMessageParam, hideReturnHome, hideInviteNote }: LoginFormProps) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const router = useRouter();

  const nextPath = sanitizeNextPath(nextPathParam ?? null);
  const errorMessage = errorMessageParam ?? null;

  // Detect recovery tokens in URL hash — redirect to set-password page
  // This handles the case where Supabase redirects here with tokens
  // instead of directly to /setup-account
  useEffect(() => {
    const hash = window.location.hash.substring(1)
    if (!hash) return
    const params = new URLSearchParams(hash)
    if (params.get('type') === 'recovery' && params.get('access_token')) {
      window.location.href = `/setup-account#${hash}`
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      // Front-end-only access runs on the server first. If the typed
      // credentials match the shared front-end login, the server sets a signed,
      // HTTP-only cookie and we send the visitor to the public homepage — the
      // password never reaches Supabase and no member session is created. The
      // special credentials are never present in this bundle; we only forward
      // what was typed and act on the server's yes/no. Any error falls through
      // to the standard member sign-in below.
      try {
        const frontendRes = await fetch("/api/frontend-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const frontendData = await frontendRes.json().catch(() => ({}));
        if (frontendData?.ok === true) {
          window.location.href = "/";
          return;
        }
      } catch {
        // Ignore and continue to the standard member sign-in.
      }

      const supabase = createClient();

      const { data: { user, session }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !user || !session) {
        setStatus({ type: "error", message: error?.message ?? "Unable to sign in." });
        return;
      }

      // Founder IDs — hardcoded for reliability
      const FOUNDER_IDS = [
        "d6e824e3-69ab-447c-b046-afecfe4b7028", // aloha@vitalkauai.com
        "268f721a-9c7c-4bb2-82b7-3c29178281b1", // joshuaperdue2@gmail.com
      ];

      let destination = nextPath;
      if (FOUNDER_IDS.includes(user.id)) {
        destination = "/dashboard";
      } else {
        // Nurses land on the care-team portal, not the member portal.
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        if (roleRow?.role === "nurse") destination = "/nurse";
      }
      window.location.href = destination;
    } catch {
      setStatus({
        type: "error",
        message: "Unable to sign in right now. Please try again in a moment.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStatus({
          type: "error",
          message: data?.error ?? "Couldn't send the reset link. Please try again.",
        });
        return;
      }

      setResetSent(true);
      setStatus({
        type: "success",
        message:
          data?.message ??
          "If an approved member account exists for that email, a password reset link is on its way.",
      });
    } catch {
      setStatus({
        type: "error",
        message: "Couldn't send the reset link right now. Please try again in a moment.",
      });
    } finally {
      setLoading(false);
    }
  }

  function switchToForgot() {
    setMode("forgot");
    setStatus({ type: "idle", message: "" });
    setResetSent(false);
    setPassword("");
  }

  function switchToSignin() {
    setMode("signin");
    setStatus({ type: "idle", message: "" });
    setResetSent(false);
  }

  const isForgot = mode === "forgot";
  const heading = isForgot ? "Reset Password" : "Sign In";
  const description = isForgot
    ? "Enter the email on file and we'll send a link to choose a new password."
    : "Enter your email and the password you created when you set up your account. Just joined? Open your Welcome email and tap “Set Up My Account” to choose your password.";

  return (
    <main className={styles.wrapper}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Member Portal</p>
        <h1 className={styles.title}>{heading}</h1>
        <p className={styles.description}>{description}</p>

        {errorMessage ? (
          <p className={`${styles.status} ${styles.statusError}`}>{decodeURIComponent(errorMessage)}</p>
        ) : null}

        {status.type !== "idle" ? (
          <p
            className={`${styles.status} ${
              status.type === "error" ? styles.statusError : styles.statusSuccess
            }`}
          >
            {status.message}
          </p>
        ) : null}

        {isForgot ? (
          <form onSubmit={handleForgotSubmit}>
            <label className={styles.fieldLabel} htmlFor="reset-email">
              Email
            </label>
            <input
              className={styles.input}
              id="reset-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              disabled={resetSent}
            />
            <div className={styles.actions}>
              <button
                className={`${styles.button} ${styles.buttonPrimary}`}
                type="submit"
                disabled={loading || resetSent}
              >
                {loading ? "Sending..." : resetSent ? "Sent" : "Send Reset Link"}
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.buttonSecondary}`}
                onClick={switchToSignin}
              >
                Back to Sign In
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmit}>
            <label className={styles.fieldLabel} htmlFor="email">
              Email
            </label>
            <input
              className={styles.input}
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <label className={styles.fieldLabel} htmlFor="password">
              Password
            </label>
            <input
              className={styles.input}
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
            />
            <div className={styles.forgotRow}>
              <button type="button" className={styles.linkButton} onClick={switchToForgot}>
                Forgot password?
              </button>
            </div>
            <div className={styles.actions}>
              <button className={`${styles.button} ${styles.buttonPrimary}`} type="submit" disabled={loading}>
                {loading ? "Signing In..." : "Sign In"}
              </button>
              {hideReturnHome ? null : (
                <Link href="/" className={`${styles.button} ${styles.buttonSecondary}`}>
                  Return Home
                </Link>
              )}
            </div>
          </form>
        )}

        <div className={styles.notice}>
          <p className={styles.noticeLead}>
            New to Vital Kaua&#699;i? Begin with a discovery call &mdash; a
            conversation to explore whether this path is right for you.
          </p>
          <a
            className={`${styles.button} ${styles.buttonPrimary} ${styles.noticeCta}`}
            href="https://calendly.com/aloha-vitalkauai/30min"
            target="_blank"
            rel="noopener noreferrer"
          >
            Book a Discovery Call
          </a>
          {hideInviteNote ? null : (
            <p className={styles.noticeFine}>
              Access is invitation-only. After your discovery call, you&apos;ll
              receive a Welcome email from the Vital Kaua&#699;i team with a link
              to set up your account and choose your own password.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
