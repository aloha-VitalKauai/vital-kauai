"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchPublicCohorts,
  formatCohortRange,
  groupCohortsByDate,
  isCohortFull,
  spotsLeftLabel,
  type PublicCohort,
} from "@/lib/cohorts";
import styles from "./iboga-journey-page.module.css";

const GALLERY: { src: string; alt: string; caption: string }[] = [
  { src: "/images/ibogaroot.jpeg", alt: "Iboga root bark", caption: "Iboga root, the heart of the medicine." },
  { src: "/images/ibogafruit.jpg", alt: "Iboga fruit", caption: "The fruit of the Tabernanthe iboga shrub." },
  { src: "/images/hanalei3.jpg", alt: "Hanalei Bay, Kauaʻi", caption: "Hanalei Bay, where ceremonies are held." },
  { src: "/images/napali.jpeg", alt: "Nā Pali Coast, Kauaʻi", caption: "Nā Pali Coast, the island that holds the work." },
  { src: "/images/kauaiwaterfall.jpeg", alt: "Kauaʻi waterfall", caption: "Kauaʻi's waters, alive in the integration." },
];

export function UpcomingCeremoniesPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [publicCohorts, setPublicCohorts] = useState<PublicCohort[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    fetchPublicCohorts(supabase)
      .then(setPublicCohorts)
      .catch(() => setPublicCohorts([]))
      .finally(() => setLoaded(true));
  }, []);

  const grouped = groupCohortsByDate(publicCohorts);
  const nextIdx = grouped.findIndex((c) => !isCohortFull(c));

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
            <span className="nav-dropdown-wrap">
              <Link href="/iboga-journey">The Iboga Journey</Link>
              <span className="nav-dropdown">
                <Link href="/upcoming-ceremonies">Upcoming Ceremonies</Link>
              </span>
            </span>
          </li>
          <li>
            <span className="nav-dropdown-wrap">
              <Link href="/stay">Stay With Us</Link>
              <span className="nav-dropdown">
                <Link href="/island-residents">Island Residents</Link>
              </span>
            </span>
          </li>
          <li className={styles.navDropdown}>
            <Link href="/church-information" className={styles.navDropdownLabel}>About</Link>
            <ul className={styles.navDropdownMenu}>
              <li><Link href="/about">About the Founders</Link></li>
              <li><Link href="/church-information">About Vital Kaua&#699;i Church</Link></li>
              <li><Link href="/healing-circle">Our Healing Circle</Link></li>
              <li><Link href="/faq">FAQ</Link></li>
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
        <Link href="/iboga-journey" onClick={() => setIsMobileNavOpen(false)}>The Iboga Journey</Link>
        <Link href="/upcoming-ceremonies" onClick={() => setIsMobileNavOpen(false)}>Upcoming Ceremonies</Link>
        <Link href="/stay" onClick={() => setIsMobileNavOpen(false)}>Stay With Us</Link>
        <Link href="/island-residents" onClick={() => setIsMobileNavOpen(false)}>Island Residents</Link>
        <Link href="/about" onClick={() => setIsMobileNavOpen(false)}>About the Founders</Link>
        <Link href="/church-information" onClick={() => setIsMobileNavOpen(false)}>About Vital Kaua&#699;i Church</Link>
        <Link href="/healing-circle" onClick={() => setIsMobileNavOpen(false)}>Our Healing Circle</Link>
        <Link href="/faq" onClick={() => setIsMobileNavOpen(false)}>FAQ</Link>
        <Link href="/portal" onClick={() => setIsMobileNavOpen(false)}>Member Portal</Link>
      </div>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <Image
          className={styles.heroBgImg}
          src="/images/hanalei2.jpg"
          alt="Hanalei Bay, Kauaʻi"
          fill
          priority
          sizes="100vw"
        />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>Come As You Are</p>
          <h1 className={styles.heroTitle}>
            Upcoming <em>Ceremonies</em>
          </h1>
          <p className={styles.heroSubtitle}>
            Small, held gatherings on the north shore of Kaua&#699;i. Up to six members, seven days,
            woven into months of preparation and integration.
          </p>
        </div>
      </section>

      {/* ── Ceremonies List ── */}
      <section style={{ padding: "112px 32px 96px", background: "var(--cream, #F5F0E8)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ width: 36, height: 1, background: "var(--gold, #C8A96E)", margin: "0 auto 20px", opacity: 0.6 }} />
          <p style={{ display: "block", textAlign: "center", marginBottom: 14, color: "var(--gold, #C8A96E)", fontSize: 13, fontWeight: 500, letterSpacing: "0.32em" }}>
            All Upcoming Ceremonies
          </p>
          <h2 style={{ textAlign: "center", fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 300, color: "var(--ink, #1A1A18)", lineHeight: 1.1, marginBottom: 16 }}>
            The <em style={{ fontStyle: "italic", color: "var(--sage, #7A9E7E)" }}>year ahead</em>
          </h2>
          <p style={{ textAlign: "center", fontSize: 16, color: "var(--ink-soft, #6B6B67)", lineHeight: 1.7, maxWidth: 580, margin: "0 auto 56px", fontStyle: "italic", fontFamily: "'Cormorant Garamond', serif" }}>
            Each ceremony is a small, held gathering. Book a discovery call to learn which date is right for you.
          </p>

          {!loaded ? (
            <p style={{ textAlign: "center", color: "rgba(0,0,0,0.5)", fontSize: 14 }}>Loading ceremonies&hellip;</p>
          ) : grouped.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", maxWidth: 520, margin: "0 auto", background: "var(--warm-white, #FDFBF7)", border: "1px dashed rgba(28,43,30,0.18)", borderRadius: 4 }}>
              <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 24, color: "rgba(0,0,0,0.5)", marginBottom: 10 }}>Dates coming soon</p>
              <p style={{ fontSize: 14, color: "rgba(0,0,0,0.55)", lineHeight: 1.7 }}>
                The next round of ceremonies is being scheduled. Reach out for early access.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24, marginBottom: 56 }}>
              {grouped.map((c, i) => {
                const isNext = i === nextIdx;
                const year = new Date(c.start_at).getUTCFullYear();
                const dateText = formatCohortRange(c.start_at, c.end_at).replace(`, ${year}`, "");
                const titleIsGeneric = /^[A-Za-z]+\s+\d+.*Ceremony$/.test(c.title);
                const spots = spotsLeftLabel(c);
                const statusText = spots ?? (isNext ? "Filling Now" : "Open");
                const isFull = !isNext && /full/i.test(statusText);
                const statusColor = isNext || spots
                  ? "var(--gold, #C8A96E)"
                  : isFull
                    ? "var(--sage, #7A9E7E)"
                    : "rgba(0,0,0,0.55)";
                const cardBase: React.CSSProperties = {
                  background: "var(--warm-white, #FDFBF7)",
                  border: "1px solid rgba(28,43,30,0.08)",
                  borderRadius: 4,
                  padding: "44px 28px 32px",
                  textAlign: "center",
                  position: "relative",
                  boxShadow: "0 8px 24px rgba(14,26,16,0.06)",
                };
                return (
                  <div
                    key={c.id}
                    style={{
                      ...cardBase,
                      borderTop: isNext ? "3px solid var(--gold, #C8A96E)" : cardBase.border,
                      boxShadow: isNext ? "0 18px 44px rgba(14,26,16,0.16)" : cardBase.boxShadow,
                      transform: isNext ? "translateY(-4px)" : undefined,
                    }}
                  >
                    <p style={{ fontSize: 9, letterSpacing: "0.32em", textTransform: "uppercase", color: isNext ? "var(--gold, #C8A96E)" : "rgba(0,0,0,0.5)", marginBottom: 18, fontWeight: 500 }}>
                      {isNext ? "Next Ceremony" : "Upcoming"}
                    </p>
                    <p style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: "clamp(28px, 3.4vw, 36px)", fontWeight: 300, color: "var(--ink, #1A1A18)", lineHeight: 1.1, marginBottom: 10 }}>
                      {titleIsGeneric ? dateText : c.title}
                    </p>
                    <p style={{ fontSize: 11, color: "rgba(0,0,0,0.55)", letterSpacing: "0.08em", marginBottom: 18 }}>
                      {titleIsGeneric ? `${year} · Hanalei, Kauaʻi` : `${dateText}, ${year} · Hanalei, Kauaʻi`}
                    </p>
                    <div style={{ width: 28, height: 1, background: "rgba(28,43,30,0.18)", margin: "0 auto 14px" }} />
                    <p style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: statusColor, fontWeight: 500 }}>
                      {statusText}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ textAlign: "center" }}>
            <a
              href="/begin-your-journey"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "16px 36px",
                background: "var(--gold, #C8A96E)",
                color: "var(--ink, #1A1A18)",
                textDecoration: "none",
                fontSize: 12,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                fontWeight: 500,
                borderRadius: 2,
              }}
            >
              Book a Discovery Call
            </a>
          </div>
        </div>
      </section>

      {/* ── Gallery: Iboga & Kauaʻi ── */}
      <section style={{ padding: "112px 32px", background: "var(--warm-white, #FDFBF7)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ width: 36, height: 1, background: "var(--gold, #C8A96E)", margin: "0 auto 20px", opacity: 0.6 }} />
          <p style={{ display: "block", textAlign: "center", marginBottom: 14, color: "var(--gold, #C8A96E)", fontSize: 13, fontWeight: 500, letterSpacing: "0.32em" }}>
            The Medicine and the Land
          </p>
          <h2 style={{ textAlign: "center", fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 300, color: "var(--ink, #1A1A18)", lineHeight: 1.1, marginBottom: 56 }}>
            Iboga, <em style={{ fontStyle: "italic", color: "var(--sage, #7A9E7E)" }}>and Kaua&#699;i</em>
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            {GALLERY.map((g) => (
              <figure key={g.src} style={{ margin: 0 }}>
                <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", borderRadius: 4, overflow: "hidden", boxShadow: "0 12px 32px rgba(14,26,16,0.12)" }}>
                  <Image
                    src={g.src}
                    alt={g.alt}
                    fill
                    sizes="(max-width: 700px) 100vw, (max-width: 1180px) 50vw, 380px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <figcaption style={{ marginTop: 14, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 16, color: "var(--ink-soft, #6B6B67)", textAlign: "center", lineHeight: 1.5 }}>
                  {g.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
