"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./begin-your-journey-page.module.css";

export function BeginYourJourneyPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className={styles.page}>
      {/* ── Nav ── */}
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
          Vital Kaua&#699;i
        </Link>
        <ul className={styles.navLinks}>
          <li>
            <Link href="/iboga-journey">The Iboga Journey</Link>
          </li>
          <li>
            <span className="nav-dropdown-wrap"><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/stay#local">Work With Us</Link></span></span>
          </li>
          <li className={styles.navDropdown}>
            <Link href="/church-information" className={styles.navDropdownLabel}>About</Link>
            <ul className={styles.navDropdownMenu}>
              <li>
                <Link href="/about">About the Founders</Link>
              </li>
              <li>
                <Link href="/church-information">About Vital Kaua&#699;i Church</Link>
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

      {/* ── Mobile Nav ── */}
      <div className={`${styles.navMobile} ${isMobileNavOpen ? styles.navMobileOpen : ""}`}>
        <button
          className={styles.navMobileClose}
          type="button"
          aria-label="Close menu"
          onClick={() => setIsMobileNavOpen(false)}
        >
          &#10005;
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
          About Vital Kaua&#699;i Church
        </Link>
        <Link href="/healing-circle" onClick={() => setIsMobileNavOpen(false)}>
          Our Healing Circle
        </Link>
        <Link href="/portal" onClick={() => setIsMobileNavOpen(false)}>
          Member Portal
        </Link>
      </div>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <span className={styles.heroEyebrow}>Begin the Journey</span>
        <h1 className={styles.heroTitle}>
          The Medicine Shows You the Door.
          <em>We Walk Through It With You.</em>
        </h1>
      </section>

      {/* ── Main Grid: Video + Calendly ── */}
      <div className={styles.mainGrid}>
        {/* Video Side */}
        <div className={styles.videoSide}>
          <span className={styles.sideLabel}>A Personal Welcome &middot; Rachel &amp; Josh</span>

          {/* Replace with your video embed */}
          <div className={styles.videoContainer}>
            <div className={styles.videoPlayBtn}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M8 5L18 11L8 17V5Z" fill="#C8A96E" />
              </svg>
            </div>
            <p>Coming Soon</p>
          </div>

          <p className={styles.videoCaption}>
            The discovery call is a conversation where we get to meet you, hear what is calling
            you, and answer whatever questions are alive in you.
          </p>
        </div>

        {/* Calendly Side */}
        <div className={styles.calendlySide}>
          <div className={styles.calendlyHeader}>
            <span className={styles.calendlyHeaderLabel}>Book a Discovery Call</span>
            <h3>30 min &middot; Vital Kaua&#699;i</h3>
            <p>No pressure. Just a genuine conversation.</p>
          </div>
          <div className={styles.calendlyEmbed}>
            <iframe
              src="https://calendly.com/aloha-vitalkauai/30min?hide_gdpr_banner=1&background_color=ffffff&text_color=1a1a18&primary_color=7a9e7e&embed_type=Inline"
              title="Schedule a Discovery Call"
            />
          </div>
        </div>
      </div>

      {/* ── Lead Capture Strip ── */}
      <div className={styles.leadStrip}>
        <div className={styles.leadStripCopy}>
          <h3>Stay connected.</h3>
          <p>Leave your name and email and we&apos;ll send you a personal note.</p>
        </div>
        <LeadForm />
      </div>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div>
          <p className={styles.footerBrand}>VITAL KAUA&lsquo;I</p>
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
            <li>
              <Link href="/iboga-journey">The Iboga Journey</Link>
            </li>
            <li>
              <Link href="/about">Josh &amp; Rachel</Link>
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
          &copy; 2026 Vital Kauaʻi Church &middot; All original content on this site is protected by
          U.S. copyright law. Reproduction without written permission prohibited.
        </p>
      </div>
    </main>
  );
}

function LeadForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const form = e.currentTarget;
    const firstName = (form.elements.namedItem("first-name") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();

    try {
      await fetch("/.netlify/functions/lead-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: firstName,
          email,
          source: "Begin the Journey",
          submittedAt: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error("Lead capture error:", err);
    }

    setSubmitted(true);
  }

  if (submitted) {
    return <p className={styles.leadSuccess}>&#10003; We&apos;ll be in touch, check your inbox.</p>;
  }

  return (
    <form className={styles.leadStripForm} onSubmit={handleSubmit}>
      <input
        className={styles.leadInput}
        type="text"
        name="first-name"
        placeholder="First name"
        required
      />
      <input
        className={styles.leadInput}
        type="email"
        name="email"
        placeholder="Your email"
        required
      />
      <button className={styles.leadBtn} type="submit" disabled={loading}>
        {loading ? "..." : "Send"}
      </button>
    </form>
  );
}
