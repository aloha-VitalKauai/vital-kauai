"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import styles from "./healing-circle.module.css";
import { categoryLabels, filterTabs, members } from "./healing-circle-data";

type FilterValue = (typeof filterTabs)[number]["value"];

function getColumns(width: number) {
  if (width >= 900) {
    return 5;
  }
  if (width >= 680) {
    return 4;
  }
  if (width >= 480) {
    return 3;
  }
  return 2;
}

export function HealingCirclePage() {
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [columns, setColumns] = useState(5);
  const revealRefs = useRef<HTMLElement[]>([]);

  const visibleMembers = useMemo(
    () =>
      members.filter((member) => {
        if (member.cat === "hidden") {
          return false;
        }

        if (activeFilter === "all") {
          return true;
        }

        return member.cat === activeFilter;
      }),
    [activeFilter],
  );

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 60);
    const onResize = () => setColumns(getColumns(window.innerWidth));

    onScroll();
    onResize();

    window.addEventListener("scroll", onScroll);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const nodes = revealRefs.current.filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.revealVisible);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );

    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  const activeMember = visibleMembers.find((member) => member.id === activeId) ?? null;
  const activeCategoryLabel = activeMember && activeMember.cat !== "hidden" ? categoryLabels[activeMember.cat] : "";

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
        <Link href="/begin-your-journey" onClick={() => setIsMobileNavOpen(false)} className={styles.mobileAccentLink}>
          Begin Your Journey
        </Link>
      </div>

      <section className={styles.hero}>
        <Image
          className={styles.heroImg}
          src="https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1800&q=85"
          alt="Healing Circle — Vital Kauaʻi"
          fill
          priority
          sizes="100vw"
        />
        <div className={styles.heroOverlay} />
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>Practitioners & Wisdom Keepers</p>
          <h1 className={styles.heroTitle}>
            The Healing
            <br />
            <em>Circle</em>
          </h1>
          <p className={styles.heroSub}>
            Every practitioner in our circle is a devoted healer in their own right — drawn here by
            devotion, shaped by the land, and honored to walk this path with you.
          </p>
        </div>
      </section>

      <section className={styles.intro}>
        <p
          ref={(node) => {
            if (node) {
              revealRefs.current[0] = node;
            }
          }}
          className={`${styles.introText} ${styles.reveal}`}
        >
          &quot;Behind every journey at Vital Kauaʻi stands a circle of extraordinary human beings —
          healers, teachers, and wisdom keepers who bring their full life&apos;s work to every container
          we hold.&quot;
        </p>
        <div
          ref={(node) => {
            if (node) {
              revealRefs.current[1] = node;
            }
          }}
          className={`${styles.introRule} ${styles.reveal} ${styles.revealDelay1}`}
        />
      </section>

      <section className={styles.circle}>
        <div className={styles.filterTabs}>
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`${styles.filterTab} ${activeFilter === tab.value ? styles.filterTabActive : ""}`}
              onClick={() => {
                setActiveFilter(tab.value);
                setActiveId(null);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.constellation}>
          {visibleMembers.map((member, index) => {
            const showBioRow =
              activeMember && member.id === visibleMembers[Math.min(Math.ceil((index + 1) / columns) * columns, visibleMembers.length) - 1]?.id;

            return (
              <Fragment key={member.id}>
                <button
                  type="button"
                  className={`${styles.card} ${activeId === member.id ? styles.cardActive : ""}`}
                  onClick={() => {
                    setActiveId((current) => (current === member.id ? null : member.id));
                  }}
                >
                  <div className={styles.photoRing}>
                    <Image src={member.photo} alt={member.name} width={110} height={110} loading="lazy" />
                  </div>
                  <p className={styles.cardName}>{member.name}</p>
                  <p className={styles.cardRole}>{member.role}</p>
                </button>

                {showBioRow && activeMember ? (
                  <div className={styles.bioRow}>
                    <div className={styles.bioRowInner}>
                      <button
                        type="button"
                        className={styles.bioCloseBtn}
                        aria-label="Close"
                        onClick={() => setActiveId(null)}
                      >
                        ✕
                      </button>
                      <div className={styles.bioRowPhoto}>
                        <Image src={activeMember.photo} alt={activeMember.name} width={130} height={130} />
                      </div>
                      <div>
                        <span className={styles.bioRowCat}>{activeCategoryLabel}</span>
                        <h3 className={styles.bioRowName}>{activeMember.name}</h3>
                        <span className={styles.bioRowRole}>{activeMember.role}</span>
                        <p className={styles.bioRowBody}>{activeMember.bio}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      </section>

      <section className={styles.cta}>
        <div className={styles.ctaInner}>
          <span
            ref={(node) => {
              if (node) {
                revealRefs.current[2] = node;
              }
            }}
            className={`${styles.ctaLabel} ${styles.reveal}`}
          >
            Ready to Begin?
          </span>
          <h2
            ref={(node) => {
              if (node) {
                revealRefs.current[3] = node;
              }
            }}
            className={`${styles.ctaTitle} ${styles.reveal}`}
          >
            Every Journey
            <br />
            <em>Is Held</em>
          </h2>
          <p
            ref={(node) => {
              if (node) {
                revealRefs.current[4] = node;
              }
            }}
            className={`${styles.ctaBody} ${styles.reveal}`}
          >
            When you arrive at Vital Kauaʻi, you are held by an entire lineage of healing
            intelligence — woven together with care, and activated by the land herself.
          </p>
          <Link href="/#contact" className={`${styles.btnPrimary} ${styles.reveal} ${styles.revealDelay1}`}>
            Begin Your Journey
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <div>
          <p className={styles.footerBrand}>Vital Kauaʻi</p>
          <p className={styles.footerTagline}>
            A living sanctuary of transformation and awakening on Kauaʻi&apos;s North Shore.
          </p>
          <p className={styles.footerAddress}>PO Box 932, Hanalei, HI 96714{"\n"}aloha@vitalkauai.com</p>
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
