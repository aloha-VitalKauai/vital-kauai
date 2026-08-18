import { LoginForm } from "@/app/login/login-form";
import { HeroVideo } from "@/components/hero-video";
import styles from "./login-landing.module.css";
import loginStyles from "@/app/login/login-form.module.css";

type LoginLandingProps = {
  nextPathParam?: string;
  errorMessageParam?: string;
};

// The gated front door at /login. The entire site sits behind this screen;
// signing in here leads into all member material (unchanged). This adds the
// church's public identity — whale-video hero, name, "religious nonprofit",
// contact — above the existing sign-in form, so the gate also reads as a real
// public homepage. "/" and the site's gating are intentionally untouched.
export function LoginLanding({ nextPathParam, errorMessageParam }: LoginLandingProps) {
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
            We are a member-based spiritual community offering a program of
            preparation, ceremony, and integration in service of whole-being
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

      <LoginForm
        nextPathParam={nextPathParam}
        errorMessageParam={errorMessageParam}
        hideReturnHome
        hideDiscoveryNote
      />

      <footer className={styles.footer}>
        Vital Kauaʻi Church · Hanalei, Hawaiʻi · A Hawaiʻi nonprofit corporation
        <br />
        <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a> · © 2026
      </footer>
    </>
  );
}
