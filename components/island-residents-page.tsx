"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./island-residents-page.module.css";

export function IslandResidentsPage() {
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
          <li><Link href="/iboga-journey">The Iboga Journey</Link></li>
          <li>
            <span className="nav-dropdown-wrap"><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/island-residents">Island Residents</Link></span></span>
          </li>
          <li className={styles.navDropdown}>
            <Link href="/church-information" className={styles.navDropdownLabel}>About</Link>
            <ul className={styles.navDropdownMenu}>
              <li><Link href="/about">About the Founders</Link></li>
              <li><Link href="/church-information">About Vital Kauaʻi Church</Link></li>
              <li><Link href="/healing-circle">Our Healing Circle</Link></li>
            </ul>
          </li>
          <li><Link href="/#contact">Contact</Link></li>
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
        <Link href="/iboga-journey" onClick={() => setIsMobileNavOpen(false)}>The Iboga Journey</Link>
        <Link href="/stay" onClick={() => setIsMobileNavOpen(false)}>Stay With Us</Link>
        <Link href="/island-residents" onClick={() => setIsMobileNavOpen(false)}>Island Residents</Link>
        <Link href="/about" onClick={() => setIsMobileNavOpen(false)}>About the Founders</Link>
        <Link href="/church-information" onClick={() => setIsMobileNavOpen(false)}>About Vital Kauaʻi Church</Link>
        <Link href="/healing-circle" onClick={() => setIsMobileNavOpen(false)}>Our Healing Circle</Link>
        <Link href="/portal" onClick={() => setIsMobileNavOpen(false)}>Member Portal</Link>
      </div>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>On-Island Work</p>
          <h1 className={styles.heroTitle}>
            Already
            <br />
            <em>Home</em>
          </h1>
          <div className={styles.heroRule} />
          <p className={styles.heroSub}>
            For those who live on Kauaʻi and feel the pull of this work. Rachel and Josh come
            to you.
          </p>
        </div>
      </section>

      {/* Body */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <p className={styles.lead}>
            Transformation arrives right where you are. If you live on Kauaʻi and feel the
            pull of this work, we walk it with you. Six weeks of preparation, a deeply held
            Iboga ceremony, and six weeks of integration. Somatic practice and guidance,
            breathwork, energy work, and our attuned presence support you throughout.
          </p>
          <p className={styles.bodyText}>
            Rachel and Josh hold a quiet circle of island residents who seek the depth of a
            Vital Kauaʻi journey without leaving home. Sessions happen in your space. The
            container is just as held.
          </p>
          <p className={styles.bodyText}>
            If you are local and something in you is ready, reach out.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/begin-your-journey" className={styles.cta}>
              Reach Out →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div>
          <p className={styles.footerBrand}>Vital Kauaʻi</p>
          <p className={styles.footerTagline}>
            A living sanctuary of transformation and awakening on Kauaʻi&apos;s North Shore.
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
            <li><span className="nav-dropdown-wrap"><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/island-residents">Island Residents</Link></span></span></li>
          </ul>
        </div>
        <div className={styles.footerCol}>
          <h4>Connect</h4>
          <ul className={styles.footerLinks}>
            <li><Link href="/begin-your-journey">Begin the Journey</Link></li>
            <li><Link href="/portal">Member Portal</Link></li>
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
          © 2026 Vital Kauaʻi Church · All original content on this site is protected by U.S.
          copyright law. Reproduction without written permission prohibited.
        </p>
      </div>
    </main>
  );
}
