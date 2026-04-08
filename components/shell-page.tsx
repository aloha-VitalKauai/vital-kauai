import Link from "next/link";
import styles from "./shell-page.module.css";

type ShellPageProps = {
  title: string;
  description: string;
};

export function ShellPage({ title, description }: ShellPageProps) {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Vital Kauai</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        <div className={styles.actions}>
          <Link href="/#contact" className={styles.action}>
            Begin Your Journey
          </Link>
          <Link href="/" className={`${styles.action} ${styles.actionSecondary}`}>
            Return Home
          </Link>
        </div>
      </section>
    </main>
  );
}
