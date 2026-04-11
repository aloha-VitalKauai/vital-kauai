"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import styles from "./privacy-policy-page.module.css";

export function MedicalDisclaimerPage() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className={styles.page}>
      <nav className={`${styles.nav} ${isScrolled ? styles.navScrolled : ""}`}>
        <button
          className={styles.hamburger}
          type="button"
          aria-label="Menu"
          onClick={() => setIsMobileNavOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
        <Link href="/" className={styles.navLogo}>
          Vital Kauaʻi
        </Link>
        <ul className={styles.navLinks}>
          <li>
            <Link href="/iboga-journey">The Iboga Journey</Link>
          </li>
          <li>
            <Link href="/stay">Stay With Us</Link>
          </li>
          <li className={styles.navDropdown}>
            <span className={styles.navDropdownLabel}>About</span>
            <ul className={styles.navDropdownMenu}>
              <li>
                <Link href="/about">About the Founders</Link>
              </li>
              <li>
                <Link href="/church-information">About Vital Kauaʻi Church</Link>
              </li>
            </ul>
          </li>
          <li>
            <Link href="/#contact">Contact</Link>
          </li>
        </ul>
        <Link href="/begin-your-journey" className={styles.navCta}>
          Begin Your Journey
        </Link>
      </nav>

      <div className={`${styles.navMobile} ${isMobileNavOpen ? styles.navMobileOpen : ""}`}>
        <button
          className={styles.navMobileClose}
          type="button"
          aria-label="Close menu"
          onClick={() => setIsMobileNavOpen(false)}
        >
          ✕
        </button>
        <Link href="/iboga-journey" onClick={() => setIsMobileNavOpen(false)}>
          The Iboga Journey
        </Link>
        <Link href="/stay" onClick={() => setIsMobileNavOpen(false)}>
          Stay With Us
        </Link>
        <Link href="/about" onClick={() => setIsMobileNavOpen(false)}>
          About the Founders
        </Link>
        <Link href="/church-information" onClick={() => setIsMobileNavOpen(false)}>
          About Vital Kauaʻi Church
        </Link>
        <Link href="/healing-circle" onClick={() => setIsMobileNavOpen(false)}>
          Our Healing Circle
        </Link>
        <Link href="/#portal" onClick={() => setIsMobileNavOpen(false)}>
          Member Portal
        </Link>
        <Link href="/begin-your-journey" onClick={() => setIsMobileNavOpen(false)} className={styles.mobileAccentLink}>
          Begin Your Journey
        </Link>
      </div>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>Sacred Policies</span>
          <h1 className={styles.pageTitle}>
            Medical <em>Disclaimer</em>
          </h1>
          <div className={styles.heroRule} />
          <p className={styles.heroSub}>
            Safety and transparency are sacred values here. Please read this before engaging with our
            work.
          </p>
        </div>
      </section>

      <div className={styles.breadcrumb}>
        <Link href="/">Home</Link>
        <span className={styles.sep}>›</span>
        <Link href="/church-information">Sacred Policies</Link>
        <span className={styles.sep}>›</span>
        <span className={styles.current}>Medical Disclaimer</span>
      </div>

      <div className={styles.contentWrap}>
        <span className={styles.lastUpdated}>Last Updated: March 7, 2026</span>

        <p>
          Vital Kauai Church is a private, unincorporated religious organization operating as a
          Private Membership Association under the protection of the First Amendment to the U.S.
          Constitution, the Religious Freedom Restoration Act (RFRA), and the Universal Declaration
          of Human Rights. All ceremonies, practices, and sacramental work conducted within Vital
          Kauai Church take place within an ecclesiastical context, among consenting adult members of
          a sincerely held religious community.
        </p>

        <p>
          This page describes the nature of our sacramental work and the responsibility each member
          carries in relation to their own health and sovereign participation.
        </p>

        <hr className={styles.sectionRule} />

        <h2>
          <em>Nature</em> of Our Work
        </h2>
        <p>
          Nothing offered by Vital Kauai Church — on this website, in written materials, or in direct
          communication with our Stewards or practitioners — constitutes medical advice, psychiatric
          treatment, clinical diagnosis, or therapeutic intervention as defined by state or federal
          law. Vital Kauai Church does not practice medicine. Our Stewards and practitioners offer
          ceremony, sacred presence, somatic guidance, and spiritual support within a religious
          context. They are not all licensed medical professionals, and they do not hold themselves
          out as such.
        </p>

        <div className={styles.highlightBox}>
          <p>
            All practices within Vital Kauai Church are sacramental and ecclesiastical in nature.
            They are expressions of sincere religious belief — not medical treatments, clinical
            therapies, or health interventions. Membership in this Church is a voluntary spiritual
            commitment, entered freely by consenting adults.
          </p>
        </div>

        <hr className={styles.sectionRule} />

        <h2>
          <em>Sacramental</em> Practice & Inherent Risk
        </h2>
        <p>
          Participation in sacred ceremony, sacramental practice, somatic inquiry, and
          psycho-spiritual processes involves inherent risks. As a member of Vital Kauai Church, you
          acknowledge and accept that these risks may include:
        </p>
        <ul>
          <li>Physical discomfort, dizziness, nausea, or temporary fatigue</li>
          <li>Physiological distress, emotional activation, or psychological intensity</li>
          <li>Changes in perception, mood, or sense of identity</li>
          <li>Temporary disorientation or heightened vulnerability</li>
          <li>The surfacing of past experiences, memories, or unresolved material</li>
          <li>
            Cardiovascular or other physiological effects in connection with sacramental plant
            ceremonies
          </li>
          <li>In rare circumstances, serious physiological risk including death</li>
        </ul>
        <p>
          These risks vary significantly by individual and are influenced by personal health history,
          current medications, mental health status, and life circumstances. Full and truthful health
          disclosure to the Church is essential to your safety and is required of all members prior to
          ceremony.
        </p>

        <hr className={styles.sectionRule} />

        <h2>
          Member <em>Responsibility</em>
        </h2>
        <p>
          Every member of Vital Kauai Church enters sacramental work as a sovereign adult, fully
          responsible for their own health decisions and for the accuracy of the information they
          provide to the Church. This responsibility includes:
        </p>
        <ul>
          <li>
            Disclosing all relevant medical conditions, psychiatric history, and current medications
            truthfully and completely in your intake and health screening
          </li>
          <li>
            Consulting with a licensed healthcare provider before participation, particularly if you
            have a cardiovascular condition, liver condition, are taking prescribed medications, or
            have a history of psychosis or serious mental illness
          </li>
          <li>
            Following all preparation protocols provided by the Church, including dietary guidelines
            and any medication guidance, in advance of ceremony
          </li>
          <li>
            Communicating any changes in your health status to the Church care team promptly and
            before ceremony
          </li>
          <li>
            Continuing to work with your own medical and mental health providers as appropriate
            before, during, and after your participation
          </li>
        </ul>

        <hr className={styles.sectionRule} />

        <h2>
          The Iboga <em>Sacrament</em>
        </h2>
        <p>
          The Iboga Journey at Vital Kauai Church is a sacramental ceremony rooted in sincere
          religious practice. Iboga — the root bark of <em>Tabernanthe iboga</em> — is a sacred plant
          sacrament used within our church as an act of worship, in accordance with our Statement of
          Belief and under the protections afforded to religious organizations by the First Amendment
          and the Religious Freedom Restoration Act.
        </p>

        <div className={styles.highlightBox}>
          <p>
            The Iboga sacrament is not offered as a treatment for any medical or psychiatric
            condition. It is a sacred ceremony held within a private religious community among
            consenting adult members. Participation is an act of sincere spiritual practice, not a
            clinical or therapeutic intervention.
          </p>
        </div>

        <p>
          Vital Kauai Church takes the physiological seriousness of Iboga ceremony with the utmost
          gravity. The Iboga sacrament carries meaningful physical risk, particularly for individuals
          with cardiac conditions, liver conditions, or certain medication interactions — including
          but not limited to SSRIs, MAOIs, opioids, stimulants, and QT-prolonging medications. For
          this reason, Vital Kauai Church requires all members participating in the Iboga Journey to
          complete thorough medical screening prior to ceremony, including ECG/cardiac evaluation and
          comprehensive bloodwork. The Church care team reviews all health disclosures and screening
          results with care, and reserves the right to decline or postpone ceremony when member
          safety cannot be responsibly assured.
        </p>

        <p>
          Members are solely responsible for accurate disclosure of all health conditions and
          medications. The Church&apos;s preparation protocols, dietary guidelines, and medication
          guidance exist in service of member safety and must be followed completely.
        </p>

        <hr className={styles.sectionRule} />

        <h2>
          Our <em>Ecclesiastical</em> Commitment to Safety
        </h2>
        <p>
          Vital Kauai Church holds safety as a sacred value. Within our ecclesiastical framework we
          maintain thorough member intake and screening, require appropriate health clearance prior to
          sacramental ceremony, establish and follow emergency response protocols, and ensure that
          experienced Stewards and practitioners hold all ceremonial space with care and presence.
        </p>

        <p>
          We are a private religious community — not a medical facility, retreat center, or clinical
          program. We are transparent about what we are and what we are not. We invite every member to
          enter sacramental work with full awareness, honest self-disclosure, clear consent, and the
          ongoing support of their own healthcare providers.
        </p>

        <hr className={styles.sectionRule} />

        <h2>
          <em>Questions</em>
        </h2>
        <p>
          If you have questions about safety, health screening requirements, preparation protocols, or
          the sacramental nature of our work, please reach out before applying for membership.
        </p>
        <p>
          Vital Kauai Church
          <br />
          PO Box 932
          <br />
          Hanalei, HI 96714
          <br />
          <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a>
        </p>

        <hr className={styles.sectionRule} />

        <h2>
          Acknowledgment <em>& Signature</em>
        </h2>
        <p>
          By signing below, I confirm that I have read and understood this Medical Disclaimer in
          full. I acknowledge the sacramental nature of the work offered by Vital Kauai Church,
          accept personal responsibility for my health disclosures and sovereign participation, and
          enter this community as a consenting adult member of my own free will.
        </p>

        <p style={{ textAlign: "center", fontStyle: "italic", color: "var(--stone)", fontSize: "13px", marginTop: "48px", letterSpacing: "0.05em" }}>
          ~ and so it is ~
        </p>
      </div>

      <div className={styles.policiesBar}>
        <div className={styles.policiesBarInner}>
          <div>
            <h4>Sacred Policies</h4>
            <ul className={styles.policyLinks}>
              <li>
                <Link href="/privacy-policy">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms-of-use">Terms of Use</Link>
              </li>
              <li>
                <Link href="/medical-disclaimer" className={styles.policyLinkActive}>
                  Medical Disclaimer
                </Link>
              </li>
              <li>
                <Link href="/church-information">Church Information</Link>
              </li>
            </ul>
          </div>
          <p className={styles.policyNote}>
            Questions about any of our policies? Write to us at{" "}
            <Link href="/#contact">our contact form</Link> — we are happy to clarify anything.
          </p>
        </div>
      </div>

      <footer className={styles.footer}>
        <div>
          <p className={styles.footerBrand}>Vital Kauaʻi</p>
          <p className={styles.footerTagline}>
            A living sanctuary of transformation and awakening on Kaua&apos;i&apos;s North Shore.
          </p>
          <p className={styles.footerAddress}>
            PO Box 932, Hanalei, HI 96714{"\n"}aloha@vitalkauai.com
          </p>
        </div>
        <div className={styles.footerCol}>
          <h4>Explore</h4>
          <ul className={styles.footerLinks}>
            <li>
              <Link href="/iboga-journey">The Iboga Journey</Link>
            </li>
            <li>
              <Link href="/about">Josh & Rachel</Link>
            </li>
            <li>
              <Link href="/healing-circle">Our Healing Circle</Link>
            </li>
            <li>
              <Link href="/stay">Stay With Us</Link>
            </li>
          </ul>
        </div>
        <div className={styles.footerCol}>
          <h4>Connect</h4>
          <ul className={styles.footerLinks}>
            <li>
              <Link href="/begin-your-journey">Begin Your Journey</Link>
            </li>
            <li>
              <Link href="/#portal">Member Portal</Link>
            </li>
          </ul>
        </div>
        <div className={styles.footerCol}>
          <h4>Our Policies</h4>
          <ul className={styles.footerLinks}>
            <li>
              <Link href="/privacy-policy">Privacy Policy</Link>
            </li>
            <li>
              <Link href="/terms-of-use">Terms of Use</Link>
            </li>
            <li>
              <Link href="/medical-disclaimer">Medical Disclaimer</Link>
            </li>
            <li>
              <Link href="/church-information">Church Information</Link>
            </li>
          </ul>
        </div>
      </footer>

      <div className={styles.footerBottom}>
        <p>
          © 2026 Vital Kauai Church · All original content on this site is protected by U.S.
          copyright law. Reproduction without written permission prohibited.
        </p>
      </div>
    </main>
  );
}
