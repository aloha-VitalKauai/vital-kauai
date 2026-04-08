"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./login-form.module.css";

type Status = {
  type: "idle" | "error" | "success";
  message: string;
};

function sanitizeNextPath(input: string | null) {
  if (!input) return "/portal";
  if (!input.startsWith("/")) return "/portal";
  if (input.startsWith("//")) return "/portal";
  return input;
}

type LoginFormProps = {
  nextPathParam?: string;
  errorMessageParam?: string;
};

export function LoginForm({ nextPathParam, errorMessageParam }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);

  const nextPath = sanitizeNextPath(nextPathParam ?? null);
  const errorMessage = errorMessageParam ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const supabase = createClient();
      const origin =
        typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (error) {
        setStatus({ type: "error", message: error.message });
        return;
      }

      setStatus({
        type: "success",
        message: "Check your email for the magic link to access your member portal.",
      });
      setEmail("");
    } catch {
      setStatus({
        type: "error",
        message: "Unable to start sign in right now. Please try again in a moment.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.wrapper}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Member Portal</p>
        <h1 className={styles.title}>Sign In</h1>
        <p className={styles.description}>
          Enter your email and we will send a secure magic link to continue to your portal.
        </p>

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
          <div className={styles.actions}>
            <button className={`${styles.button} ${styles.buttonPrimary}`} type="submit" disabled={loading}>
              {loading ? "Sending Link..." : "Send Magic Link"}
            </button>
            <Link href="/" className={`${styles.button} ${styles.buttonSecondary}`}>
              Return Home
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
