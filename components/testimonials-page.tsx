"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./church-information-page.module.css";

type VideoTestimonial = {
  // Set `embedUrl` to a YouTube/Vimeo embed URL when ready (e.g.
  // "https://www.youtube.com/embed/XXXX" or "https://player.vimeo.com/video/XXXX").
  // Leave as null to render the placeholder card.
  embedUrl: string | null;
  name: string;
  location?: string;
  role?: string;
  quote?: string;
};

type WrittenTestimonial = {
  quote: string;
  name: string;
  location?: string;
};

const VIDEO_TESTIMONIALS: VideoTestimonial[] = [
  {
    embedUrl: null,
    name: "Featured Story",
    location: "Hanalei, Kauaʻi",
    quote: "Video reflection coming soon.",
  },
  {
    embedUrl: null,
    name: "Featured Story",
    location: "Kauaʻi",
    quote: "Video reflection coming soon.",
  },
  {
    embedUrl: null,
    name: "Featured Story",
    quote: "Video reflection coming soon.",
  },
];

const WRITTEN_TESTIMONIALS: WrittenTestimonial[] = [
  {
    quote:
      "Working with Josh was life-changing. This level of mastery is rare, and I do not say that lightly. Josh is truly a master of his craft, and I cannot recommend his work highly enough.",
    name: "Simona Kay",
  },
  {
    quote:
      "I carried an ancestral wound for decades, never quite finding the courage to face it. It was in the space you facilitated that something finally shifted. I was able to free myself! I am forever grateful for all the teachings you shared. Rachel, you have a magic that unlocked something deep in me.",
    name: "Jacque Shockley",
    location: "Hanalei, Kauaʻi",
  },
];

export function TestimonialsPage() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className={styles.page}>
      <style>{`
        .testimonials-section + .testimonials-section { margin-top: 88px; }
        .testimonials-section-eyebrow { display:block;font-size:13px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold,#C8A96E);margin-bottom:14px;text-align:center; }
        .testimonials-section-title { font-family: var(--font-display, 'Cormorant Garamond'), serif; font-size: clamp(28px, 3.4vw, 40px); font-weight: 300; line-height: 1.15; color: var(--cream, #F5F0E8); text-align: center; margin: 0 0 12px; }
        .testimonials-section-title em { font-style: italic; color: var(--sage, #A8C5AC); }
        .testimonials-section-sub { max-width: 620px; margin: 0 auto 48px; text-align:center; font-size: 14px; line-height: 1.8; color: rgb(245 240 232 / 0.62); }

        .video-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap: 28px; }
        .video-card { display:flex; flex-direction:column; }
        .video-frame { position: relative; width: 100%; padding-top: 56.25%; background: rgb(15 30 25 / 0.6); border: 1px solid rgb(200 169 110 / 0.18); border-radius: 4px; overflow: hidden; }
        .video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
        .video-placeholder { position: absolute; inset: 0; display:flex; align-items:center; justify-content:center; flex-direction:column; gap: 10px; color: rgb(200 169 110 / 0.6); font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; }
        .video-placeholder svg { width: 38px; height: 38px; opacity: 0.4; }
        .video-meta { padding: 18px 4px 0; }
        .video-name { font-family: var(--font-display, 'Cormorant Garamond'), serif; font-size: 19px; font-weight: 400; color: var(--cream, #F5F0E8); }
        .video-loc { display:block; font-size: 12px; letter-spacing: 0.24em; text-transform: uppercase; color: var(--gold, #C8A96E); margin-top: 6px; }
        .video-quote { margin-top: 12px; font-size: 13px; line-height: 1.7; color: rgb(245 240 232 / 0.6); font-style: italic; }

        .written-list { max-width: 760px; margin: 0 auto; display:flex; flex-direction: column; gap: 56px; }
        .written-item { padding: 0 0 56px; border-bottom: 1px solid rgb(200 169 110 / 0.18); }
        .written-item:last-child { border-bottom: 0; padding-bottom: 0; }
        .written-mark { display:block; font-family: var(--font-display, 'Cormorant Garamond'), serif; font-size: 56px; line-height: 1; color: var(--gold, #C8A96E); opacity: 0.5; margin-bottom: 8px; }
        .written-quote { font-family: var(--font-display, 'Cormorant Garamond'), serif; font-size: clamp(19px, 2.1vw, 23px); font-weight: 300; line-height: 1.55; color: var(--cream, #F5F0E8); font-style: italic; }
        .written-attrib { display:block; margin-top: 22px; font-size: 13px; letter-spacing: 0.28em; text-transform: uppercase; color: var(--gold, #C8A96E); }
        .written-attrib em { font-style: normal; color: rgb(245 240 232 / 0.55); margin-left: 10px; }

        @media (max-width: 900px) {
          .video-grid { grid-template-columns: 1fr; gap: 36px; }
          .testimonials-section + .testimonials-section { margin-top: 64px; }
        }
      `}</style>

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
            <span className="nav-dropdown-wrap"><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/island-residents">Island Residents</Link></span></span>
          </li>
          <li className={styles.navDropdown}>
            <Link href="/church-information" className={styles.navDropdownLabel}>About</Link>
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
              <li>
                <Link href="/testimonials">Testimonials</Link>
              </li>
              <li>
                <Link href="/faq">FAQ</Link>
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
        <Link href="/island-residents" onClick={() => setIsMobileNavOpen(false)}>
          Island Residents
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
        <Link href="/testimonials" onClick={() => setIsMobileNavOpen(false)}>
          Testimonials
        </Link>
        <Link href="/faq" onClick={() => setIsMobileNavOpen(false)}>
          FAQ
        </Link>
        <Link href="/portal" onClick={() => setIsMobileNavOpen(false)}>
          Member Portal
        </Link>
      </div>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBg} />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>Voices From the Journey</p>
          <h1 className={styles.heroTitle}>
            Testimonials &amp; <em>Reflections</em>
          </h1>
          <div className={styles.heroRule} />
          <p className={styles.heroSub}>
            Stories from members who have walked this path.
          </p>
        </div>
      </section>

      {/* Video Testimonials */}
      <section className={styles.darkBand}>
        <div className={styles.sectionInnerWide}>
          <div className="testimonials-section">
            <span className="testimonials-section-eyebrow">Watch &amp; Listen</span>
            <h2 className="testimonials-section-title">
              Video <em>Testimonials</em>
            </h2>
            <p className="testimonials-section-sub">
              Members share their journeys&mdash;what shifted within them, and how they were held
              at Vital Kaua&#699;i.
            </p>

            <div className="video-grid">
              {VIDEO_TESTIMONIALS.map((video, idx) => (
                <article key={idx} className="video-card">
                  <div className="video-frame">
                    {video.embedUrl ? (
                      <iframe
                        src={video.embedUrl}
                        title={`Testimonial from ${video.name}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="video-placeholder">
                        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        <span>Coming Soon</span>
                      </div>
                    )}
                  </div>
                  <div className="video-meta">
                    <p className="video-name">{video.name}</p>
                    {video.location ? <span className="video-loc">{video.location}</span> : null}
                    {video.quote ? <p className="video-quote">{video.quote}</p> : null}
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Written Testimonials */}
          <div className="testimonials-section">
            <span className="testimonials-section-eyebrow">In Their Own Words</span>
            <h2 className="testimonials-section-title">
              Written <em>Reflections</em>
            </h2>
            <p className="testimonials-section-sub">
              Letters and reflections from those who have journeyed with us.
            </p>

            <div className="written-list">
              {WRITTEN_TESTIMONIALS.map((item, idx) => (
                <figure key={idx} className="written-item">
                  <span className="written-mark" aria-hidden>“</span>
                  <blockquote className="written-quote">{item.quote}</blockquote>
                  <figcaption className="written-attrib">
                    {item.name}
                    {item.location ? <em>{item.location}</em> : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.membershipBand}>
        <span className={styles.membershipEyebrow}>Your Story</span>
        <h2 className={styles.sectionTitle} style={{ color: "var(--cream)", marginBottom: "20px" }}>
          When You Are Ready
          <br />
          <em>to Walk Your Own</em>
        </h2>
        <p className={styles.membershipBody}>
          Every testimonial here began with a single conversation. If something in these stories
          calls to you, the discovery call is where yours can begin.
        </p>
        <Link href="/begin-your-journey" className={styles.btnPrimary}>
          Begin the Journey
        </Link>
        <a href="mailto:aloha@vitalkauai.com" className={styles.btnGhost}>
          Share Your Story
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
            <li><Link href="/about">Josh &amp; Rachel</Link></li>
            <li><Link href="/healing-circle">Our Healing Circle</Link></li>
            <li><span className="nav-dropdown-wrap"><Link href="/stay">Stay With Us</Link><span className="nav-dropdown"><Link href="/island-residents">Island Residents</Link></span></span></li>
            <li><Link href="/testimonials">Testimonials</Link></li>
            <li><Link href="/faq">FAQ</Link></li>
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
