"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import styles from "./church-information-page.module.css";

const tenets = [
  {
    numeral: "I",
    title: "The Sacred Nature of Healing",
    body: "We believe that healing — of body, mind, and spirit — is a sacred act. The restoration of wholeness in a human being is among the most holy endeavors a community can undertake together.",
  },
  {
    numeral: "II",
    title: "Direct Spiritual Experience",
    body: "We believe that direct, personal encounter with the divine is the birthright of every human being. Ceremony, intention, and sacred plant sacraments are vessels through which such encounter becomes possible.",
  },
  {
    numeral: "III",
    title: "The Sanctity of Consciousness",
    body: "We hold that consciousness itself is sacred. The exploration and expansion of consciousness through sincere spiritual practice is a protected and deeply meaningful human activity.",
  },
  {
    numeral: "IV",
    title: "Community as Practice",
    body: "We believe that genuine spiritual community — people in covenant with one another, committed to mutual growth and accountability — is itself a form of worship and a source of healing.",
  },
  {
    numeral: "V",
    title: "Sovereignty of the Individual",
    body: "We hold that each person carries an innate wisdom and an inviolable right to seek their own healing and spiritual truth. Our role is to create conditions for that sovereignty to be fully expressed.",
  },
  {
    numeral: "VI",
    title: "The Earth as Sacred Ground",
    body: "We believe the natural world is not a backdrop to spiritual life but an active participant in it. Kauaʻi's land, waters, and living systems are part of our congregation.",
  },
];

export function ChurchInformationPage() {
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
        <Link href="/#contact" className={styles.navCta}>
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
        <Link href="/#contact" onClick={() => setIsMobileNavOpen(false)} className={styles.mobileAccentLink}>
          Begin Your Journey
        </Link>
      </div>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>Vital Kauai Church</p>
          <h1 className={styles.heroTitle}>
            A Sacred <em>Community</em>
            <br />
            of Practice
          </h1>
          <div className={styles.heroRule} />
          <p className={styles.heroSub}>
            Vital Kaua&#699;i operates as a sincerely held religious organization, grounded in the
            understanding that healing, transformation, and direct spiritual experience are sacred
            rights of every human being.
          </p>
        </div>
      </section>

      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href="/">Home</Link>
        <span className={styles.sep}>›</span>
        <span className={styles.current}>Church Information</span>
      </div>

      {/* Who We Are */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.eyebrow}>Our Foundation</span>
          <h2 className={styles.sectionTitle}>
            Why Vital Kaua&#699;i
            <br />
            <em>is a Church</em>
          </h2>
          <p className={styles.bodyText}>
            Vital Kauai Church is a sincerely held unincorporated private religious organization
            operating as a Private Membership Association. Our work rests on a foundational belief:
            that the direct encounter with the sacred — through ceremony, sacramental practice, and
            intentional spiritual work — is among the most ancient and protected forms of human
            worship.
          </p>
          <p className={styles.bodyText}>
            We are a church in the truest sense. Our members enter into a covenant of shared
            spiritual values, a commitment to their own healing and evolution, and a recognition that
            the ceremonies held at Vital Kaua&#699;i are acts of sincere religious practice, guided
            by experienced practitioners and held within a framework of deep care.
          </p>
          <p className={styles.bodyText}>
            Operating as a church allows us to hold this work within the legal and spiritual
            protections afforded to religious organizations — and, more importantly, it affirms the
            sacred nature of what takes place here. This is not a workaround. It is an accurate
            description of what we are and what we do.
          </p>

          <div className={styles.ornamentalDivider}>
            <span>✦</span>
          </div>

          <p className={styles.bodyText}>
            Participation in sacramental ceremonies at Vital Kaua&#699;i requires membership in
            Vital Kauai Church. Membership is open to adults who share our values, affirm our
            Statement of Belief, and complete the membership process. Church membership is a
            meaningful step — an acknowledgment that you are entering sacred space as a member of a
            spiritual community, not a consumer of a service.
          </p>
        </div>
      </section>

      {/* Mission Statement */}
      <section className={`${styles.section} ${styles.sectionCream}`}>
        <div className={styles.sectionInner}>
          <div className={styles.missionQuote}>
            <span className={styles.eyebrow}>Our Mission</span>
            <p className={styles.missionText}>
              Vital Kauai Church is a living sanctuary of transformation. We support the remembrance
              of our interconnectedness through vitality, intimacy, and nature medicine. We offer
              somatic, psycho-spiritual, and nature-led experiences where people are supported to
              live with greater aliveness, interconnectedness, and truth.
            </p>
          </div>
          <p className={styles.bodyText}>
            We exist to steward experiences that help human beings return to their essential nature
            and embodied wisdom so they can live fully present, creative, and free.
          </p>
          <p className={styles.bodyText}>
            The highest intention of Vital Kauai Church is to create a world where people are
            profoundly connected — to themselves, to each other, and to nature. Through our work,
            people emerge remembering their power to create any reality they choose, and engage with
            the world through greater love, offering creative solutions for a more peaceful,
            sustainable, and thriving global community.
          </p>
          <p className={styles.bodyText}>
            Vital Kauai Church is a living organism — revealed through practice, presence, and
            relationship. We intend to stand as a place of refuge and renewal, where people reconnect
            with what matters most, where community is strengthened, and where the intelligence of
            Life is trusted to lead.
          </p>
        </div>
      </section>

      {/* Tenets */}
      <section className={styles.darkBand}>
        <div className={styles.sectionInnerWide}>
          <div style={{ textAlign: "center", marginBottom: "16px" }}>
            <span className={styles.eyebrow}>Our Beliefs</span>
            <h2 className={styles.sectionTitle} style={{ color: "var(--cream)" }}>
              The Principles That
              <br />
              <em>Guide Our Practice</em>
            </h2>
            <p className={styles.bodyText} style={{ maxWidth: "600px", margin: "0 auto" }}>
              Vital Kauai Church is anchored in these foundational convictions, held collectively by
              our members and expressed through all aspects of our ceremonial and healing work.
            </p>
          </div>

          <div className={styles.tenetsGrid}>
            {tenets.map((tenet) => (
              <div key={tenet.numeral} className={styles.tenet}>
                <div className={styles.tenetNumber}>{tenet.numeral}</div>
                <div className={styles.tenetTitle}>{tenet.title}</div>
                <div className={styles.tenetBody}>{tenet.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Membership CTA */}
      <section className={styles.membershipBand}>
        <span className={styles.membershipEyebrow}>Membership</span>
        <h2 className={styles.sectionTitle} style={{ color: "var(--cream)", marginBottom: "20px" }}>
          Become a Member of
          <br />
          <em>Vital Kauai Church</em>
        </h2>
        <p className={styles.membershipBody}>
          Membership in Vital Kauai Church is the threshold through which all sacramental ceremony
          takes place. It is a meaningful commitment — to yourself, to your healing, and to this
          community. The membership process is woven into your journey preparation, and our team
          guides you through each step with care.
        </p>
        <Link href="/#contact" className={styles.btnPrimary}>
          Begin Your Journey
        </Link>
        <a href="mailto:aloha@vitalkauai.com" className={styles.btnGhost}>
          Ask a Question
        </a>
      </section>

      {/* Policies Bar */}
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
                <Link href="/medical-disclaimer">Medical Disclaimer</Link>
              </li>
              <li>
                <Link href="/church-information" className={styles.policyLinkActive}>
                  Church Information
                </Link>
              </li>
            </ul>
          </div>
          <p className={styles.policyNote}>
            Questions about any of our policies? Write to us at{" "}
            <Link href="/#contact">our contact form</Link> — we are happy to clarify anything.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <div>
          <p className={styles.footerBrand}>Vital Kaua&#699;i</p>
          <p className={styles.footerTagline}>
            A living sanctuary of transformation and awakening on Kaua&#699;i&apos;s North Shore.
          </p>
          <p className={styles.footerAddress}>
            PO Box 932, Hanalei, HI 96714{"\n"}aloha@vitalkauai.com
          </p>
        </div>
        <div className={styles.footerCol}>
          <h4>Explore</h4>
          <ul className={styles.footerLinks}>
            <li><Link href="/iboga-journey">The Iboga Journey</Link></li>
            <li><Link href="/about">Josh & Rachel</Link></li>
            <li><Link href="/healing-circle">Our Healing Circle</Link></li>
            <li><Link href="/stay">Stay With Us</Link></li>
          </ul>
        </div>
        <div className={styles.footerCol}>
          <h4>Connect</h4>
          <ul className={styles.footerLinks}>
            <li><Link href="/#contact">Begin Your Journey</Link></li>
            <li><Link href="/#portal">Member Portal</Link></li>
          </ul>
        </div>
        <div className={styles.footerCol}>
          <h4>Our Policies</h4>
          <ul className={styles.footerLinks}>
            <li><Link href="/privacy-policy">Privacy Policy</Link></li>
            <li><Link href="/terms-of-use">Terms of Use</Link></li>
            <li><Link href="/medical-disclaimer">Medical Disclaimer</Link></li>
            <li><Link href="/church-information">Church Information</Link></li>
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
