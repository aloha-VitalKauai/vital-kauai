import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "./portal-page.module.css";

export default async function PortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/portal");
  }

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>Member Portal</p>
        <h1 className={styles.title}>Welcome Home</h1>
        <p className={styles.subtitle}>
          Your authenticated portal is active. We can now wire intake forms, agreements, and resources
          directly to member accounts.
        </p>

        <section className={styles.card}>
          <p className={styles.label}>Signed In As</p>
          <p className={styles.value}>{user.email ?? "Authenticated Member"}</p>
          <div className={styles.actions}>
            <Link href="/intake-form" className={`${styles.action} ${styles.actionPrimary}`}>
              Open Intake Form
            </Link>
            <form action="/auth/logout" method="post">
              <button className={`${styles.action} ${styles.actionSecondary}`} type="submit">
                Sign Out
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
