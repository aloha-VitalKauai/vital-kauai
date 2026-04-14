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
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ type: "idle", message: "" });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const nextPath = sanitizeNextPath(nextPathParam ?? null);
  const errorMessage = errorMessageParam ?? null;

  // Detect recovery tokens in URL hash — redirect to set-password page
  // This handles the case where Supabase redirects here with tokens
  // instead of directly to /portal/set-password
  useEffect(() => {
    const hash = window.location.hash.substring(1)
    if (!hash) return
    const params = new URLSearchParams(hash)
    if (params.get('type') === 'recovery' && params.get('access_token')) {
      window.location.href = `/portal/set-password#${hash}`
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
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

      const destination = FOUNDER_IDS.includes(user.id) ? "/dashboard" : nextPath;
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

  return (
    <main className={styles.wrapper}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Member Portal</p>
        <h1 className={styles.title}>Sign In</h1>
        <p className={styles.description}>
          Enter the email and password sent to you after your discovery call.
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
          <div className={styles.actions}>
            <button className={`${styles.button} ${styles.buttonPrimary}`} type="submit" disabled={loading}>
              {loading ? "Signing In..." : "Sign In"}
            </button>
            <Link href="/" className={`${styles.button} ${styles.buttonSecondary}`}>
              Return Home
            </Link>
          </div>
        </form>

        <p className={styles.notice}>
          Access is invitation-only. After your discovery call, you&apos;ll receive login
          credentials from the Vital Kaua&#699;i team.
        </p>
      </section>
    </main>
  );
}
