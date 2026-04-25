"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import styles from "./privacy-policy-page.module.css";

export function PrivacyPolicyPage() {
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
            <span className="nav-dropdown-wrap"><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/stay#local">Work With Us</Link></span></span>
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
              <li>
                <Link href="/healing-circle">Our Healing Circle</Link>
              </li>
            </ul>
          </li>
          <li>
            <Link href="/#contact">Contact</Link>
          </li>
        </ul>
        <Link href="/begin-your-journey" className={styles.navCta}>
          Begin the Journey
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
        <Link href="/begin-your-journey" onClick={() => setIsMobileNavOpen(false)} className={styles.mobileAccentLink}>
          Begin the Journey
        </Link>
        <Link href="/iboga-journey" onClick={() => setIsMobileNavOpen(false)}>
          The Iboga Journey
        </Link>
        <Link href="/stay" onClick={() => setIsMobileNavOpen(false)}>
          Stay With Us
        </Link>
        <Link href="/stay#local" onClick={() => setIsMobileNavOpen(false)}>
          Work With Us
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
        
      </div>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <span className={styles.eyebrow}>Sacred Policies</span>
          <h1 className={styles.pageTitle}>
            Privacy <em>Policy</em>
          </h1>
          <div className={styles.heroRule} />
          <p className={styles.heroSub}>
            Your information is held as sacred, with care, discretion, and the full weight of our
            commitment to your trust.
          </p>
        </div>
      </section>

      <div className={styles.breadcrumb}>
        <Link href="/">Home</Link>
        <span className={styles.sep}>›</span>
        <Link href="/church-information">Sacred Policies</Link>
        <span className={styles.sep}>›</span>
        <span className={styles.current}>Privacy Policy</span>
      </div>

      <div className={styles.contentWrap}>
        <div className={styles.policyNav}>
          <p>Contents</p>
          <ul>
            <li><a href="#what-we-collect">Information We Collect</a></li>
            <li><a href="#how-we-use">How We Use Your Information</a></li>
            <li><a href="#how-we-protect">How We Protect Your Information</a></li>
            <li><a href="#sharing">Sharing & Disclosure</a></li>
            <li><a href="#ecclesiastical">Ecclesiastical Privilege</a></li>
            <li><a href="#cookies">Cookies & Website Data</a></li>
            <li><a href="#your-rights">Member Rights</a></li>
            <li><a href="#retention">Data Retention</a></li>
            <li><a href="#children">Adult Membership Only</a></li>
            <li><a href="#policy-contact">Contact</a></li>
          </ul>
        </div>

        <span className={styles.lastUpdated}>Last Updated: March 7, 2026</span>

        <p>
          Vital Kauai Church is a private, unincorporated religious organization operating as a
          Private Membership Association. We are protected under the First Amendment to the U.S.
          Constitution, the Religious Freedom Restoration Act (RFRA), and the Universal Declaration
          of Human Rights. All activities, ceremonies, and communications within Vital Kauai Church
          take place within a private ecclesiastical domain among consenting adult members.
        </p>

        <p>
          Privacy is not merely a legal obligation for us, it is a sacred value, rooted in our
          Covenant of Silence and our deepest commitment to the dignity of every member. The
          information you share with us is held as confidential, used with care, and never exploited.
          This Privacy Policy describes how Vital Kauai Church (&quot;we,&quot; &quot;us,&quot;
          &quot;our,&quot; or &quot;the Church&quot;) collects, uses, and protects information when
          you visit our website at vitalkauai.com, complete our membership or intake forms, or
          participate in our sacramental ceremonies and church activities.
        </p>

        <div className={styles.highlightBox}>
          <p>
            By becoming a member of Vital Kauai Church, all information you share with the Church
            enters the private domain of a religious organization. It is protected by the
            Church&apos;s Covenant of Silence, our ecclesiastical obligations, and applicable
            religious freedom law, not merely by standard data protection frameworks.
          </p>
        </div>

        <hr className={styles.sectionRule} />

        <h2 id="what-we-collect">
          <em>Information</em> We Collect
        </h2>
        <p>
          We collect information you provide directly to us as part of the membership and sacramental
          preparation process, including:
        </p>
        <ul>
          <li>
            Full legal name, contact information, and location provided through membership
            applications and inquiry forms
          </li>
          <li>
            Health history, medical information, current medications, and psycho-spiritual background
            shared through our member intake process
          </li>
          <li>
            Church membership applications, signed agreements, and ecclesiastical documents
          </li>
          <li>
            Signed documents including the Medical Disclaimer and Risk Acknowledgment & Sovereignty
            Agreement
          </li>
          <li>
            Payment information processed securely through third-party payment processors
          </li>
          <li>Communications you send to the Church via email or through our website</li>
        </ul>
        <p>
          We also collect limited technical information automatically when you visit our website,
          including IP address, browser type, and pages visited. This information is used solely for
          website security and functionality.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="how-we-use">
          <em>How We Use</em> Your Information
        </h2>
        <p>
          All information collected by Vital Kauai Church is used exclusively within the private
          ecclesiastical domain of the Church. We use member information solely to:
        </p>
        <ul>
          <li>
            Assess membership eligibility and prepare for your sacramental participation
          </li>
          <li>
            Communicate with you about your journey, preparation, ceremony, and integration
          </li>
          <li>
            Maintain Church membership records as required by our Articles of Association and Bylaws
          </li>
          <li>
            Process offerings and maintain financial records as required by our governing documents
          </li>
          <li>
            Ensure the safety and wellbeing of all members participating in sacramental ceremony
          </li>
          <li>
            Fulfill our ecclesiastical obligations and, where unavoidable, comply with legal
            requirements
          </li>
        </ul>
        <p>
          We never use member information for marketing to third parties, advertising, sale of data,
          or any commercial purpose unrelated to your direct participation in the life of the Church.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="how-we-protect">
          <em>How We Protect</em> Your Information
        </h2>
        <p>
          Member information, particularly health disclosures, personal history, and sacramental
          communications, is treated as confidential, sacred, and protected by multiple overlapping
          frameworks.
        </p>
        <div className={styles.highlightBox}>
          <p>
            Information shared with Vital Kauai Church in the context of sacramental preparation,
            religious counsel, or church membership is protected by the Covenant of Silence
            established in our Church Charter. This is a binding ecclesiastical obligation on all
            Stewards, practitioners, and staff, not merely an internal policy. Health and personal
            disclosures made in the context of religious practice may additionally carry
            ecclesiastical privilege protections under applicable law.
          </p>
        </div>
        <p>
          Health and personal information shared through our intake and membership process is
          accessible only to the Stewards and practitioners directly involved in your care and
          ceremony. It is never shared with other members, staff unrelated to your program, or any
          third parties except as described below.
        </p>
        <p>
          We implement appropriate technical and organizational measures to protect all member data
          against unauthorized access, alteration, disclosure, or destruction.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="sharing">
          Sharing <em>& Disclosure</em>
        </h2>
        <p>
          Vital Kauai Church does not sell, rent, trade, or otherwise disclose member information to
          outside parties. The Church&apos;s position, consistent with our ecclesiastical framework,
          is that all member information exists within the private domain of a religious organization
          and is not subject to public disclosure. We share member information only in the following
          strictly limited circumstances:
        </p>
        <ul>
          <li>
            <strong>With your explicit consent</strong>, when you directly authorize specific
            disclosure in writing
          </li>
          <li>
            <strong>With your care providers</strong>, when coordination with a licensed medical
            professional is necessary to protect your safety, and only with your knowledge
          </li>
          <li>
            <strong>With bound service providers</strong>, limited technical vendors such as payment
            processors and scheduling tools, all of whom are contractually bound to confidentiality
            obligations consistent with our ecclesiastical standards
          </li>
          <li>
            <strong>When legally compelled</strong>, only when disclosure is required by a court of
            competent jurisdiction and after the Church has exhausted all available ecclesiastical and
            legal protections against compelled disclosure. The Church will notify affected members of
            any such compelled disclosure to the extent legally permitted
          </li>
        </ul>

        <hr className={styles.sectionRule} />

        <h2 id="ecclesiastical">
          Ecclesiastical <em>Privilege</em>
        </h2>
        <p>
          Vital Kauai Church operates as a sincerely held private religious organization.
          Communications between members and Stewards in the context of spiritual counsel, sacramental
          preparation, and church membership may be protected by ecclesiastical privilege under
          applicable state and federal law. The Church asserts this privilege on behalf of its members
          and will resist compelled disclosure of ecclesiastically privileged communications to the
          fullest extent permitted by law.
        </p>
        <p>
          All Stewards and practitioners of Vital Kauai Church are bound by the Covenant of Silence
          established in our Church Charter, a sacred and contractual obligation of confidentiality
          that exists independently of, and in addition to, any legal protections.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="cookies">
          Cookies <em>& Website Data</em>
        </h2>
        <p>
          Our website uses minimal cookies for basic functionality only. We do not use tracking
          cookies, behavioral advertising, or third-party analytics services that share your data with
          external parties. You may disable cookies in your browser settings; this will not affect
          your ability to access our content.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="your-rights">
          Member <em>Rights</em>
        </h2>
        <p>As a member of Vital Kauai Church, you have the right to:</p>
        <ul>
          <li>Request access to the personal information the Church holds about you</li>
          <li>Request correction of any inaccurate information in your membership record</li>
          <li>
            Request deletion of your information, subject to the Church&apos;s ecclesiastical
            record-keeping obligations and member safety requirements
          </li>
          <li>
            Withdraw consent for future communications at any time by notifying the Church in writing
          </li>
          <li>Know the basis on which any of your information has been shared outside the Church</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{" "}
          <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a>.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="retention">
          Data <em>Retention</em>
        </h2>
        <p>
          Vital Kauai Church retains member information for as long as necessary to fulfill the
          purposes described in this policy and to comply with our ecclesiastical and legal
          obligations. Health information, membership records, and signed ecclesiastical documents are
          retained for a minimum of seven years following the conclusion of a member&apos;s
          participation. You may request deletion of your information at any time; we will honor such
          requests to the extent permitted by our ecclesiastical obligations and member safety
          requirements.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="children">
          Adult <em>Membership Only</em>
        </h2>
        <p>
          All sacramental participation within Vital Kauai Church is limited to adults 18 years of
          age and older. The Church does not knowingly collect personal information from individuals
          under the age of 18. If you believe the Church has inadvertently collected information from
          a minor, please contact us immediately at{" "}
          <a href="mailto:aloha@vitalkauai.com">aloha@vitalkauai.com</a>.
        </p>

        <hr className={styles.sectionRule} />

        <h2 id="policy-contact">
          <em>Contact</em>
        </h2>
        <p>
          Questions about this Privacy Policy, your membership information, or how the Church
          stewards your data are always welcome.
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
      </div>

      <div className={styles.policiesBar}>
        <div className={styles.policiesBarInner}>
          <div>
            <h4>Sacred Policies</h4>
            <ul className={styles.policyLinks}>
              <li>
                <Link href="/privacy-policy" className={styles.policyLinkActive}>
                  Privacy Policy
                </Link>
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
          <p className={styles.policyNote}>
            Questions about any of our policies? Write to us at{" "}
            <Link href="/#contact">our contact form</Link>, we are happy to clarify anything.
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
              <span className="nav-dropdown-wrap"><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/stay#local">Work With Us</Link></span></span>
            </li>
          </ul>
        </div>
        <div className={styles.footerCol}>
          <h4>Connect</h4>
          <ul className={styles.footerLinks}>
            <li>
              <Link href="/begin-your-journey">Begin the Journey</Link>
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
