"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import styles from "./privacy-policy-page.module.css";

export function TermsOfUsePage() {
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
            <span className="nav-dropdown-wrap" style={{ position: "relative" }}><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/stay#local">Work With Us</Link></span></span>
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
        <Link href="/portal" onClick={() => setIsMobileNavOpen(false)}>
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
            Terms <em>of Use</em>
          </h1>
          <div className={styles.heroRule} />
          <p className={styles.heroSub}>
            Please read these terms before using our website. They reflect our values as much as our
            legal obligations.
          </p>
        </div>
      </section>

      <div className={styles.breadcrumb}>
        <Link href="/">Home</Link>
        <span className={styles.sep}>›</span>
        <Link href="/church-information">Sacred Policies</Link>
        <span className={styles.sep}>›</span>
        <span className={styles.current}>Terms of Use</span>
      </div>

      <div className={styles.contentWrap}>
        <div className={styles.policyNav}>
          <p>Contents</p>
          <ul>
            <li><a href="#acceptance">Acceptance of Terms</a></li>
            <li><a href="#use">Use of This Website</a></li>
            <li><a href="#content">Content & Intellectual Property</a></li>
            <li><a href="#no-medical">No Medical or Professional Advice</a></li>
            <li><a href="#no-guarantee">No Guarantee of Outcomes</a></li>
            <li><a href="#links">Third-Party Links</a></li>
            <li><a href="#limitation">Limitation of Liability</a></li>
            <li><a href="#governing">Governing Framework</a></li>
            <li><a href="#changes">Changes to These Terms</a></li>
            <li><a href="#terms-contact">Contact</a></li>
          </ul>
        </div>

        <span className={styles.lastUpdated}>Last Updated: March 7, 2026</span>

        <p>
          These Terms of Use govern your access to and use of the Vital Kauai Church website at
          vitalkauai.com (&quot;the Website&quot;). By accessing or using the Website, you agree to
          be bound by these terms. If you do not agree, please do not use the Website.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="acceptance">
          <em>Acceptance</em> of Terms
        </h2>
        <p>
          Your use of this Website constitutes your agreement to these Terms of Use and our Privacy
          Policy. These terms apply to all visitors, regardless of whether you become a member of
          Vital Kauai Church.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="use">
          Use of <em>This Website</em>
        </h2>
        <p>
          You agree to use this Website only for lawful purposes and in a manner that does not
          infringe the rights of others. You agree not to:
        </p>
        <ul>
          <li>Use the Website in any way that violates applicable laws or regulations</li>
          <li>
            Attempt to gain unauthorized access to any part of the Website or its systems
          </li>
          <li>Transmit any harmful, offensive, or disruptive content</li>
          <li>
            Reproduce, distribute, or commercially exploit Website content without our written
            consent
          </li>
          <li>
            Misrepresent your identity or affiliation with any person or organization
          </li>
        </ul>

        <hr className={styles.sectionRule} />

        <h2 id="content">
          Content <em>& Intellectual Property</em>
        </h2>
        <p>
          All content on this Website — including text, images, design, graphics, and the Vital Kauai
          Church name and mark — is the property of Vital Kauai Church and is protected by applicable
          intellectual property laws. You may share links to our Website and quote brief passages for
          non-commercial purposes with proper attribution.
        </p>
        <p>
          Nothing on this Website grants you any license or right to use our name, imagery, or
          content without our explicit written consent.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="no-medical">
          No Medical or <em>Professional Advice</em>
        </h2>
        <p>
          The content on this Website is provided for informational and spiritual purposes only.
          Nothing on this Website constitutes medical, psychiatric, psychological, legal, or financial
          advice. Vital Kauai Church is a spiritual organization — our offerings are ceremonial and
          wellness-oriented in nature.
        </p>
        <div className={styles.highlightBox}>
          <p>
            If you have a medical or psychiatric condition, please consult with a licensed healthcare
            professional before engaging with our programs. Participation in our offerings does not
            replace professional medical or mental health care.
          </p>
        </div>

        <hr className={styles.sectionRule} />

        <h2 id="no-guarantee">
          No Guarantee <em>of Outcomes</em>
        </h2>
        <p>
          Vital Kauai Church makes no representations or warranties regarding the outcomes of
          participation in our programs, ceremonies, or offerings. Transformation is a deeply personal
          process. Results vary by individual and depend on many factors beyond our control. We offer
          presence, care, and a sacred container — not guarantees.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="links">
          <em>Third-Party</em> Links
        </h2>
        <p>
          Our Website may contain links to third-party websites for your convenience. We do not
          endorse, control, or assume responsibility for the content or privacy practices of any
          third-party site. Accessing third-party links is at your own discretion.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="limitation">
          <em>Limitation</em> of Liability
        </h2>
        <p>
          To the fullest extent permitted by law, Vital Kauai Church, its Stewards, practitioners,
          and affiliates shall not be liable for any indirect, incidental, special, or consequential
          damages arising from your use of this Website or its content. Our liability for any claim
          arising from use of this Website is limited to the amount you paid, if any, for the
          specific service in question.
        </p>
        <p>
          These limitations apply regardless of the form of the claim and whether based in contract,
          tort, or any other legal theory.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="governing">
          <em>Governing</em> Framework
        </h2>
        <p>
          Vital Kauai Church operates as a private, unincorporated religious organization. To the
          extent that any legal dispute arises in connection with this Website, the parties agree to
          first attempt resolution through good-faith communication and, if necessary, through the
          dispute resolution procedures established in the Church Charter and Articles of Association.
          Any legal proceedings shall be governed by the laws of the State of Hawai&#699;i.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="changes">
          Changes to <em>These Terms</em>
        </h2>
        <p>
          We reserve the right to update these Terms of Use at any time. Updated terms will be posted
          on this page with a revised date. Your continued use of the Website following any changes
          constitutes your acceptance of the updated terms.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="terms-contact">
          <em>Contact</em>
        </h2>
        <p>
          Vital Kauai Church
          <br />
          PO Box 932
          <br />
          Hanalei, HI 96714
          <br />
          <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a>
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
                <Link href="/terms-of-use" className={styles.policyLinkActive}>
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link href="/medical-disclaimer">Medical Disclaimer</Link>
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
              <span className="nav-dropdown-wrap" style={{ position: "relative" }}><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/stay#local">Work With Us</Link></span></span>
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
              <Link href="/portal">Member Portal</Link>
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
