import Link from "next/link";
import styles from "@/components/shell-page.module.css";

export default function NotFound() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Vital Kauaʻi</p>
        <h1 className={styles.title}>Page Not Found</h1>
        <p className={styles.description}>
          The page you are looking for is not available right now. You can return to the home page
          or begin your journey from there.
        </p>
        <div className={styles.actions}>
          <Link href="/" className={styles.action}>
            Return Home
          </Link>
          <Link href="/#contact" className={`${styles.action} ${styles.actionSecondary}`}>
            Contact Us
          </Link>
        </div>
      </section>
    </main>
  );
}
