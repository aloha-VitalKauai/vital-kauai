import { LoginForm } from "@/app/login/login-form";
import { HeroVideo } from "./hero-video";
import styles from "./public-landing.module.css";
import loginStyles from "@/app/login/login-form.module.css";

// The public front door at "/". This is the only marketing-facing surface that
// renders without a session — it carries the organization's identity (needed
// for the Apple Developer org-verification website check) and the member
// sign-in. All member content stays behind the login wall (see middleware).
export function PublicLanding() {
  return (
    <>
      <section className={styles.hero} aria-label="Vital Kauaʻi">
        <HeroVideo className={styles.heroVideo} />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>A Living Sanctuary</p>
          <h1 className={styles.title}>
            Vital
            <br />
            <em>Kauaʻi</em>
          </h1>
          <p className={styles.heroSub}>
            We are a member-based spiritual community offering preparation,
            ceremony, and integration in service of whole-being
            transformation.
          </p>
        </div>
      </section>

      <section className={styles.identity}>
        <h2 className={styles.identityName}>Vital Kauaʻi Church</h2>
        <p className={styles.identityKicker}>A religious nonprofit</p>
        <div className={styles.rule} />
        <p className={styles.identityBody}>
          Membership is by application. To learn more or begin, reach out. We
          would be honored to hear from you.
        </p>
        <div className={styles.discoveryWrap}>
          <div className={loginStyles.notice}>
            <p className={loginStyles.noticeLead}>
              New to Vital Kauaʻi? Begin with a discovery call, a conversation
              to explore whether this path is right for you.
            </p>
            <a
              className={`${loginStyles.button} ${loginStyles.buttonPrimary} ${loginStyles.noticeCta}`}
              href="https://calendly.com/aloha-vitalkauai/30min"
              target="_blank"
              rel="noopener noreferrer"
            >
              Book a Discovery Call
            </a>
          </div>
        </div>
      </section>

      <LoginForm hideReturnHome hideDiscoveryNote />

      <footer className={styles.footer}>
        Vital Kauaʻi Church · Hanalei, Hawaiʻi · A Hawaiʻi nonprofit corporation
        <br />
        <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a> · © 2026
      </footer>
    </>
  );
}
