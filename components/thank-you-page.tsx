import Link from "next/link";
import styles from "./thank-you-page.module.css";

export function ThankYouPage() {
  return (
    <main className={styles.page}>
      <div className={styles.topBar}>
        <Link href="/" className={styles.brand}>
          Vital Kaua&#699;i
        </Link>
      </div>

      <section className={styles.wrap}>
        <p className={styles.eyebrow}>Gift Received</p>
        <h1 className={styles.title}>
          Mahalo for Your <em>Offering</em>
        </h1>
        <p className={styles.subhead}>Your gift has been received.</p>

        <div className={styles.body}>
          <p>
            Your generosity helps make this community possible &mdash; the gatherings, the
            teachings, the space we hold together for one another and for Nature.
          </p>
          <p>
            A receipt is on its way to your inbox. If you don&rsquo;t see it within a few
            minutes, please check your spam folder.
          </p>
          <p>We&rsquo;re grateful you&rsquo;re here. See you at the next gathering.</p>
        </div>

        <div className={styles.actions}>
          <Link href="/portal" className={styles.btnPrimary}>
            Return to Member Portal
          </Link>
          <Link href="/portal/community" className={styles.btnSecondary}>
            View Upcoming Gatherings
          </Link>
        </div>

        <p className={styles.disclaimer}>
          <em>
            Vital Kaua&#699;i Church is currently in the process of obtaining 501(c)(3) status.
            Until that is finalized, love offerings are gratefully received but are not yet
            tax-deductible.
          </em>
        </p>
      </section>
    </main>
  );
}
