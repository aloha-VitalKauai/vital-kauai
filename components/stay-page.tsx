"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchPublicCohorts, formatCohortRange, spotsLeftLabel } from "@/lib/cohorts";

export function StayPage() {
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    fetchPublicCohorts(supabase).then((cohorts) => {
      if (cancelled) return;
      for (let i = 0; i < 3; i++) {
        const el = document.getElementById(`upcoming-ceremony-card-${i}`);
        if (!el) continue;
        const c = cohorts[i];
        if (!c) {
          el.innerHTML = [
            '<p style="font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:rgba(200,169,110,0.35);margin-bottom:10px;">Upcoming</p>',
            '<p style="font-family:\'Cormorant Garamond\',serif;font-size:24px;font-weight:300;color:rgba(245,240,232,0.35);margin-bottom:4px;">TBA</p>',
            '<p style="font-size:11px;color:rgba(245,240,232,0.2);letter-spacing:0.08em;">Hanalei, Kauaʻi</p>',
            '<p style="font-size:10px;color:rgba(245,240,232,0.2);margin-top:12px;">Dates Coming</p>',
          ].join("");
          el.style.background = "rgba(28,43,30,0.5)";
          continue;
        }
        const isNext = i === 0;
        const year = new Date(c.start_at).getUTCFullYear();
        const dateText = formatCohortRange(c.start_at, c.end_at).replace(`, ${year}`, "");
        const titleIsGeneric = /^[A-Za-z]+\s+\d+.*Ceremony$/.test(c.title);
        const mainLine = titleIsGeneric ? dateText : c.title;
        const subLine = titleIsGeneric
          ? `${year} · Hanalei, Kauaʻi`
          : `${dateText}, ${year} · Hanalei, Kauaʻi`;
        const spots = spotsLeftLabel(c);
        const statusText = spots ?? (isNext ? "Filling Now" : "Open");
        const statusColor = isNext || spots ? "var(--terra-light)" : "rgba(245,240,232,0.55)";
        el.innerHTML = [
          `<p style="font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:${isNext ? "var(--terra)" : "rgba(200,169,110,0.7)"};margin-bottom:10px;">${isNext ? "Next Ceremony" : "Upcoming"}</p>`,
          `<p style="font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:300;color:var(--cream);margin-bottom:4px;">${mainLine}</p>`,
          `<p style="font-size:11px;color:rgba(245,240,232,0.4);letter-spacing:0.08em;">${subLine}</p>`,
          `<p style="font-size:10px;color:${statusColor};margin-top:12px;letter-spacing:0.05em;">${statusText}</p>`,
        ].join("");
        el.style.background = isNext ? "rgba(28,43,30,0.8)" : "rgba(28,43,30,0.65)";
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Scroll-based nav
    const nav = document.getElementById("nav");
    function onScroll() {
      if (nav) nav.classList.toggle("scrolled", window.scrollY > 80);
    }
    window.addEventListener("scroll", onScroll);
    onScroll();

    // Reveal on scroll
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove("hidden");
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach((el) => {
      el.classList.add("hidden");
      observer.observe(el);
    });

    // Mobile nav
    function handleMobileNav(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest(".hamburger")) {
        document.getElementById("mobile-nav")?.classList.add("nav-mobile-open");
      }
      if (target.closest(".nav-mobile-close")) {
        document.getElementById("mobile-nav")?.classList.remove("nav-mobile-open");
      }
      if (target.closest("#mobile-nav a")) {
        document.getElementById("mobile-nav")?.classList.remove("nav-mobile-open");
      }
    }
    document.addEventListener("click", handleMobileNav);

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      document.removeEventListener("click", handleMobileNav);
    };
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS_CONTENT }} />
      <div dangerouslySetInnerHTML={{ __html: BODY_CONTENT }} />
    </>
  );
}

const CSS_CONTENT = `
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --forest: #1C2B1E;
  --forest-dark: #141F15;
  --deep: #0E1A10;
  --terra: #B8694A;
  --terra-light: #D4917A;
  --terra-pale: #E8C9BC;
  --sand: #E8D4C0;
  --sand-light: #F2E6D8;
  --gold: #C8A96E;
  --gold-light: #E2CFA0;
  --cream: #F5F0E8;
  --warm-white: #FDFBF7;
  --stone: #5A5248;
  --text-dark: #111110;
  --text-mid: #2C2C28;
}

html { scroll-behavior: smooth; }
body {
  font-family: 'Jost', sans-serif;
  font-weight: 300;
  background: var(--warm-white);
  color: var(--text-dark);
  overflow-x: hidden;
}

/* ── NAV ── */
nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  padding: 28px 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.5s ease;
}
nav.scrolled {
  background: rgba(14, 26, 16, 0.96);
  backdrop-filter: blur(12px);
  padding: 18px 60px;
}
.nav-logo {
  font-family: 'Cormorant Garamond', serif;
  font-size: 22px;
  font-weight: 400;
  letter-spacing: 0.15em;
  color: var(--cream);
  text-decoration: none;
  text-transform: uppercase;
}
.nav-links {
  display: flex;
  gap: 40px;
  list-style: none;
}
.nav-links a {
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--cream);
  text-decoration: none;
  opacity: 0.85;
  transition: opacity 0.3s;
}
.nav-links a:hover { opacity: 1; }
.nav-cta {
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--forest);
  background: var(--gold);
  padding: 12px 28px;
  text-decoration: none;
  transition: background 0.3s;
}
.nav-cta:hover { background: var(--gold-light); }

.hamburger {
  display: none;
  flex-direction: column;
  gap: 5px;
  padding: 4px;
  cursor: pointer;
  background: none;
  border: none;
}
.hamburger span {
  display: block;
  width: 24px;
  height: 1px;
  background: var(--cream);
  opacity: 0.8;
}

.nav-dropdown-label {
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--cream);
  opacity: 0.85;
  cursor: pointer;
  transition: opacity 0.3s;
}
.nav-dropdown-label:hover { opacity: 1; }
.nav-dropdown-menu {
  display: none;
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 16px 0 0;
  margin: 0;
  list-style: none;
}
.nav-dropdown-wrap { position: relative; }
.nav-dropdown-wrap:hover .nav-dropdown-menu { display: block; }
.nav-dropdown-menu::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 16px;
}
.nav-dropdown-menu li {
  background: var(--forest);
  border-bottom: 1px solid rgba(245, 240, 232, 0.08);
}
.nav-dropdown-menu li:first-child {
  border-radius: 4px 4px 0 0;
}
.nav-dropdown-menu li:last-child {
  border-radius: 0 0 4px 4px;
  border-bottom: none;
}
.nav-dropdown-menu a {
  display: block;
  white-space: nowrap;
  padding: 14px 28px;
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--cream);
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.3s;
}
.nav-dropdown-menu a:hover { opacity: 1; }

.nav-mobile {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(14, 26, 16, 0.98);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.4s ease;
}
.nav-mobile.nav-mobile-open {
  opacity: 1;
  pointer-events: auto;
}
.nav-mobile a {
  font-family: 'Cormorant Garamond', serif;
  font-size: 22px;
  font-weight: 300;
  color: var(--cream);
  text-decoration: none;
  opacity: 0.8;
  transition: opacity 0.3s;
}
.nav-mobile a:hover { opacity: 1; }
.nav-mobile .mobile-accent-link {
  font-size: 11px;
  font-family: inherit;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--forest);
  background: var(--gold);
  padding: 14px 36px;
  margin-bottom: 20px;
}
.nav-mobile-close {
  position: absolute;
  top: 28px;
  right: 32px;
  background: none;
  border: none;
  color: var(--cream);
  font-size: 28px;
  cursor: pointer;
  opacity: 0.7;
}

/* ── HERO ── */
#hero {
  position: relative;
  height: 92vh;
  min-height: 600px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: hidden;
  background: var(--deep);
}
.hero-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 55%;
  opacity: 0.6;
  filter: saturate(0.75);
}
.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(10,20,12,0.1) 0%,
    rgba(10,20,12,0.05) 35%,
    rgba(10,20,12,0.65) 72%,
    rgba(10,20,12,0.97) 100%
  );
}
.hero-content {
  position: relative;
  z-index: 2;
  text-align: center;
  padding: 0 40px 88px;
}
.hero-eyebrow {
  font-size: 10px;
  letter-spacing: 0.45em;
  text-transform: uppercase;
  color: var(--terra-pale);
  margin-bottom: 22px;
  opacity: 0;
  animation: fadeUp 1s ease 0.3s forwards;
}
.hero-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(50px, 7vw, 100px);
  font-weight: 300;
  line-height: 1.0;
  color: var(--cream);
  letter-spacing: 0.04em;
  margin-bottom: 26px;
  opacity: 0;
  animation: fadeUp 1s ease 0.6s forwards;
}
.hero-title em { font-style: italic; color: var(--terra-pale); }
.hero-sub {
  font-size: 15px;
  color: rgba(245,240,232,0.72);
  max-width: 560px;
  margin: 0 auto;
  line-height: 1.85;
  opacity: 0;
  animation: fadeUp 1s ease 0.9s forwards;
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(22px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── INTRO STATEMENT ── */
#intro {
  background: var(--forest);
  padding: 100px 60px;
  text-align: center;
}
.intro-quote {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(20px, 2.5vw, 30px);
  font-weight: 300;
  font-style: italic;
  color: var(--cream);
  max-width: 820px;
  margin: 0 auto 40px;
  line-height: 1.72;
}
.intro-rule {
  width: 1px;
  height: 56px;
  background: linear-gradient(to bottom, var(--terra), transparent);
  margin: 0 auto;
}

/* ── SECTION LABELS ── */
.section-label {
  font-size: 10px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: var(--terra);
  margin-bottom: 18px;
  display: block;
}
.section-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(36px, 4vw, 58px);
  font-weight: 300;
  line-height: 1.1;
  margin-bottom: 20px;
}
.section-title em { font-style: italic; color: var(--terra); }

/* ── THE HOMES ── */
#homes {
  background: var(--cream);
  padding: 120px 60px;
}
.homes-grid {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  gap: 100px;
  align-items: start;
}
.homes-images {
  position: relative;
  height: 640px;
}
.homes-img-main {
  position: absolute;
  top: 0; left: 0;
  width: 72%;
  height: 78%;
  object-fit: cover;
}
.homes-img-accent {
  position: absolute;
  bottom: 0; right: 0;
  width: 54%;
  height: 52%;
  object-fit: cover;
  border: 6px solid var(--cream);
}
.homes-text .section-title { color: var(--text-dark); }
.homes-body {
  font-size: 14px;
  color: var(--text-mid);
  line-height: 2.0;
  margin-bottom: 20px;
  font-weight: 300;
}
.homes-body:first-of-type {
  font-family: 'Cormorant Garamond', serif;
  font-size: 19px;
  font-style: italic;
  color: var(--text-dark);
  line-height: 1.8;
}
.homes-pull {
  margin: 32px 0;
  padding: 26px 30px;
  border-left: 2px solid var(--terra);
  background: rgba(184,105,74,0.06);
}
.homes-pull p {
  font-family: 'Cormorant Garamond', serif;
  font-size: 17px;
  font-style: italic;
  color: var(--forest);
  line-height: 1.75;
}

/* ── GALLERY ── */
#gallery {
  background: var(--warm-white);
  padding: 80px 60px 120px;
}
.gallery-header {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px;
  align-items: start;
  margin-bottom: 40px;
}
.gallery-header-left .section-title { color: var(--text-dark); }
.gallery-header-right {
  padding-bottom: 8px;
}
.gallery-header-right p {
  font-size: 14px;
  color: var(--text-mid);
  line-height: 2.0;
  font-weight: 300;
}
.gallery-grid {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr;
  grid-template-rows: 340px 260px;
  gap: 10px;
}
.gallery-item {
  position: relative;
  overflow: hidden;
  background: var(--forest-dark);
}
.gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.88) brightness(0.92);
  transition: transform 8s ease, filter 0.6s ease;
}
.gallery-item:hover img {
  transform: scale(1.04);
  filter: saturate(1.0) brightness(1.0);
}
.gallery-item.tall { grid-row: span 2; }
.gallery-caption {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  padding: 24px 20px 18px;
  background: linear-gradient(to top, rgba(10,20,12,0.75) 0%, transparent 100%);
  opacity: 0;
  transition: opacity 0.4s ease;
}
.gallery-item:hover .gallery-caption { opacity: 1; }
.gallery-caption p {
  font-size: 10px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: rgba(245,240,232,0.8);
}

/* ── WHAT'S INCLUDED ── */
#included {
  background: var(--forest-dark);
  padding: 120px 60px;
}
#included .section-title { color: var(--cream); }
#included .section-label { color: var(--terra); }
.included-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  margin-top: 64px;
}
.included-card {
  background: rgba(28,43,30,0.6);
  padding: 48px 40px;
  border-top: 1px solid rgba(184,105,74,0.15);
  transition: background 0.4s;
}
.included-card:hover {
  background: rgba(28,43,30,0.9);
}
.included-rule {
  width: 32px;
  height: 1px;
  background: var(--terra);
  margin-bottom: 24px;
}
.included-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 22px;
  font-weight: 400;
  color: var(--cream);
  margin-bottom: 16px;
  line-height: 1.2;
}
.included-body {
  font-size: 13px;
  color: rgba(245,240,232,0.6);
  line-height: 1.9;
}

/* ── THE SETTING ── */
#setting {
  background: var(--cream);
  padding: 0;
  overflow: hidden;
}
.setting-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 75vh;
}
.setting-photo {
  position: relative;
  overflow: hidden;
  min-height: 500px;
  background: var(--forest-dark);
}
.setting-photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.85) brightness(0.85);
  transition: transform 9s ease;
}
.setting-photo:hover img { transform: scale(1.04); }
.setting-text {
  padding: 96px 80px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--cream);
}
.setting-text .section-title { color: var(--text-dark); }
.setting-body {
  font-size: 14px;
  color: var(--text-mid);
  line-height: 2.0;
  margin-bottom: 18px;
  font-weight: 300;
}
.setting-features {
  margin-top: 40px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.setting-feature {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}
.setting-feature-line {
  width: 28px;
  height: 1px;
  background: var(--terra);
  margin-top: 10px;
  flex-shrink: 0;
}
.setting-feature-name {
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.1em;
  color: var(--forest);
  margin-bottom: 4px;
  text-transform: uppercase;
}
.setting-feature-desc {
  font-size: 13px;
  color: var(--stone);
  line-height: 1.7;
}

/* ── GUEST EXPERIENCE ── */
#experience {
  background: var(--sand-light);
  padding: 80px 40px;
}
.experience-inner {
  max-width: 1160px;
  margin: 0 auto;
}
.experience-header {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 80px;
  align-items: end;
  margin-bottom: 80px;
}
.experience-header .section-title { color: var(--text-dark); }
.experience-header p {
  font-size: 14px;
  color: var(--text-mid);
  line-height: 2.0;
  font-weight: 300;
  padding-bottom: 8px;
}
.experience-days {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  border-top: 1px solid rgba(184,105,74,0.2);
}
.experience-day {
  padding: 32px 36px 32px 0;
  border-right: 1px solid rgba(184,105,74,0.15);
  padding-right: 36px;
}
.experience-day:last-child { border-right: none; padding-right: 0; padding-left: 36px; }
.experience-day:not(:first-child) { padding-left: 36px; }
.day-number {
  font-family: 'Cormorant Garamond', serif;
  font-size: 48px;
  font-weight: 300;
  color: rgba(184,105,74,0.2);
  line-height: 1;
  margin-bottom: 10px;
}
.day-label {
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--terra);
  margin-bottom: 8px;
  display: block;
}
.day-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 22px;
  font-weight: 400;
  color: var(--text-dark);
  margin-bottom: 10px;
  line-height: 1.25;
}
.day-body {
  font-size: 13px;
  color: var(--text-mid);
  line-height: 1.9;
}

/* ── COMMUNITY THREAD ── */
#community {
  background: var(--forest);
  padding: 120px 60px;
}
.community-inner {
  display: grid;
  grid-template-columns: 1fr;
  gap: 48px;
  max-width: 800px;
}
.community-text .section-title { color: var(--cream); }
.community-text .section-title em { color: var(--terra-pale); }
.community-body {
  font-size: 14px;
  color: rgba(245,240,232,0.68);
  line-height: 2.0;
  margin-bottom: 18px;
  font-weight: 300;
}
.community-body:first-of-type {
  font-family: 'Cormorant Garamond', serif;
  font-size: 18px;
  font-style: italic;
  color: rgba(245,240,232,0.88);
  line-height: 1.8;
}
.community-note {
  margin-top: 32px;
  padding: 24px 28px;
  border-left: 2px solid rgba(184,105,74,0.45);
  background: rgba(184,105,74,0.06);
}
.community-note p {
  font-size: 13px;
  color: rgba(245,240,232,0.6);
  line-height: 1.85;
}
.community-note p strong {
  color: var(--terra-pale);
  font-weight: 400;
}
.black-coral-block {
  background: rgba(14,26,16,0.7);
  border: 1px solid rgba(200,169,110,0.15);
  padding: 48px 44px;
}
.bc-eyebrow {
  font-size: 9px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 16px;
  display: block;
}
.bc-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: 32px;
  font-weight: 300;
  color: var(--cream);
  line-height: 1.1;
  margin-bottom: 6px;
}
.bc-subtitle {
  font-size: 11px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--terra-pale);
  margin-bottom: 24px;
}
.bc-body {
  font-size: 13px;
  color: rgba(245,240,232,0.62);
  line-height: 1.9;
  margin-bottom: 28px;
}
.bc-offerings {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 32px;
}
.bc-offering {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  color: rgba(245,240,232,0.55);
  letter-spacing: 0.05em;
}
.bc-offering::before {
  content: '';
  width: 18px;
  height: 1px;
  background: var(--terra);
  flex-shrink: 0;
}
.bc-link {
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--gold);
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid rgba(200,169,110,0.3);
  padding-bottom: 3px;
  transition: gap 0.3s, border-color 0.3s;
}
.bc-link:hover { gap: 16px; border-color: var(--gold); }

/* ── LOCAL RESIDENTS ── */
#local {
  background: var(--warm-white);
  padding: 120px 60px;
}
.local-inner {
  max-width: 900px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 80px;
  align-items: center;
}
.local-label-col .section-label { color: var(--terra); }
.local-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(40px, 4vw, 60px);
  font-weight: 300;
  color: var(--text-dark);
  line-height: 1.1;
}
.local-title em { font-style: italic; color: var(--terra); }
.local-rule {
  width: 40px;
  height: 1px;
  background: var(--terra);
  margin-top: 32px;
}
.local-body {
  font-size: 14px;
  color: var(--text-mid);
  line-height: 2.0;
  margin-bottom: 20px;
  font-weight: 300;
}
.local-body:first-of-type {
  font-family: 'Cormorant Garamond', serif;
  font-size: 18px;
  font-style: italic;
  color: var(--text-dark);
  line-height: 1.8;
}
.local-cta {
  margin-top: 32px;
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--forest);
  background: transparent;
  border: 1px solid rgba(28,43,30,0.3);
  padding: 16px 32px;
  text-decoration: none;
  display: inline-block;
  transition: all 0.3s;
}
.local-cta:hover {
  background: var(--forest);
  border-color: var(--forest);
  color: var(--cream);
}

/* ── FAQ ── */
#faq {
  background: var(--cream);
  padding: 120px 60px;
}
.faq-inner {
  max-width: 1000px;
  margin: 0 auto;
}
.faq-header {
  display: grid;
  grid-template-columns: 1fr 1.8fr;
  gap: 80px;
  align-items: start;
  margin-bottom: 72px;
}
.faq-header .section-title { color: var(--text-dark); }
.faq-header p {
  font-size: 14px;
  color: var(--text-mid);
  line-height: 2.0;
  font-weight: 300;
  padding-top: 8px;
}
.faq-list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid rgba(184,105,74,0.2);
}
.faq-item {
  border-bottom: 1px solid rgba(184,105,74,0.2);
}
.faq-item summary {
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  padding: 30px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 32px;
  text-align: left;
  list-style: none;
}
.faq-item summary::-webkit-details-marker { display: none; }
.faq-q-text {
  font-family: 'Cormorant Garamond', serif;
  font-size: 20px;
  font-weight: 400;
  color: var(--text-dark);
  line-height: 1.3;
}
.faq-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  position: relative;
}
.faq-icon::before,
.faq-icon::after {
  content: '';
  position: absolute;
  background: var(--terra);
  transition: transform 0.4s ease, opacity 0.4s ease;
}
.faq-icon::before {
  width: 20px; height: 1px;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
}
.faq-icon::after {
  width: 1px; height: 20px;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
}
.faq-item[open] .faq-icon::after {
  transform: translate(-50%, -50%) rotate(90deg);
  opacity: 0;
}
.faq-answer {
  padding: 0 0 30px;
  max-width: 780px;
}
.faq-answer p {
  font-size: 14px;
  color: var(--text-mid);
  line-height: 2.0;
  font-weight: 300;
}
.faq-answer p + p { margin-top: 14px; }

/* ── INTAKE NOTE ── */
#intake {
  background: var(--forest-dark);
  padding: 100px 60px;
  text-align: center;
}
.intake-inner {
  max-width: 720px;
  margin: 0 auto;
}
.intake-inner .section-label { color: var(--terra); }
.intake-title {
  font-family: 'Cormorant Garamond', serif;
  font-size: clamp(32px, 3.5vw, 50px);
  font-weight: 300;
  color: var(--cream);
  line-height: 1.2;
  margin-bottom: 28px;
}
.intake-title em { font-style: italic; color: var(--terra-pale); }
.intake-body {
  font-size: 14px;
  color: rgba(245,240,232,0.62);
  line-height: 1.95;
  margin-bottom: 44px;
}
.intake-features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
  margin-bottom: 56px;
  text-align: left;
}
.intake-feature {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.intake-rule {
  width: 24px;
  height: 1px;
  background: var(--terra);
}
.intake-feature-title {
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.1em;
  color: var(--cream);
  text-transform: uppercase;
}
.intake-feature-desc {
  font-size: 12px;
  color: rgba(245,240,232,0.5);
  line-height: 1.7;
}
.btn-primary {
  display: inline-block;
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--forest);
  background: var(--gold);
  padding: 18px 44px;
  text-decoration: none;
  transition: all 0.3s;
}
.btn-primary:hover {
  background: var(--gold-light);
  transform: translateY(-2px);
}

/* ── FOOTER ── */
footer {
  background: var(--deep);
  border-top: 1px solid rgba(200,169,110,0.1);
  padding: 60px;
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr;
  gap: 60px;
}
.footer-brand {
  font-family: 'Cormorant Garamond', serif;
  font-size: 24px;
  font-weight: 300;
  letter-spacing: 0.15em;
  color: var(--cream);
  text-transform: uppercase;
  margin-bottom: 16px;
}
.footer-tagline {
  font-size: 12px;
  color: rgba(245,240,232,0.4);
  line-height: 1.8;
  max-width: 240px;
}
.footer-col h4 {
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--gold);
  margin-bottom: 24px;
}
.footer-links { list-style: none; display: flex; flex-direction: column; gap: 12px; }
.footer-links a {
  font-size: 13px;
  color: rgba(245,240,232,0.5);
  text-decoration: none;
  transition: color 0.3s;
}
.footer-links a:hover { color: var(--cream); }
.footer-bottom {
  background: var(--deep);
  border-top: 1px solid rgba(255,255,255,0.05);
  padding: 24px 60px;
  display: flex;
  justify-content: space-between;
}
.footer-bottom p { font-size: 11px; color: rgba(245,240,232,0.3); }

/* ── REVEAL ── */
.reveal {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.9s ease, transform 0.9s ease;
}
.reveal.hidden {
  opacity: 0;
  transform: translateY(26px);
}
.reveal.visible { opacity: 1; transform: translateY(0); }
.reveal-delay-1 { transition-delay: 0.15s; }
.reveal-delay-2 { transition-delay: 0.3s; }
.reveal-delay-3 { transition-delay: 0.45s; }

/* ── RESPONSIVE ── */
@media (max-width: 1024px) {
  .homes-grid, .community-inner, .setting-grid,
  .experience-header, .faq-header, .gallery-header { grid-template-columns: 1fr; }
  .homes-images { height: 420px; }
  .setting-photo { min-height: 420px; }
  .setting-text { padding: 72px 48px; }
  .included-grid { grid-template-columns: 1fr 1fr; }
  .experience-days { grid-template-columns: 1fr 1fr; }
  .local-inner { grid-template-columns: 1fr; gap: 40px; }
  .gallery-grid {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto;
  }
  .gallery-item.tall { grid-row: span 1; height: 280px; }
  nav { padding: 24px 32px; }
  .nav-links { display: none; }
  .hamburger { display: flex; }
  .nav-cta { display: none; }
  footer { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 768px) {
  #intro, #homes, #included, #gallery, #experience,
  #setting, #community, #local, #faq, #intake { padding: 80px 28px; }
  .included-grid, .intake-features,
  .experience-days { grid-template-columns: 1fr; }
  .setting-text { padding: 60px 28px; }
  .gallery-grid { grid-template-columns: 1fr; }
  .gallery-item { height: 260px; }
  .gallery-item.tall { height: 260px; }
  footer { grid-template-columns: 1fr; padding: 60px 28px; }
  .footer-bottom { padding: 24px 28px; flex-direction: column; gap: 8px; }
  .experience-day:last-child { padding-left: 0; }
  .experience-day:not(:first-child) { padding-left: 0; }
}
`;

const BODY_CONTENT = `

<!-- NAV -->
<nav id="nav">
  <button class="hamburger" aria-label="Menu" onclick="document.getElementById('mobile-nav').classList.add('nav-mobile-open')">
    <span></span><span></span><span></span>
  </button>
  <a href="/" class="nav-logo">Vital Kauaʻi</a>
  <ul class="nav-links">
    <li><a href="/iboga-journey">The Iboga Journey</a></li>
    <li class="nav-dropdown-wrap"><a href="/stay" style="opacity:1;">Stay With Us</a><span class="nav-dropdown"><a href="#local">Work With Us</a></span></li>
    <li class="nav-dropdown-wrap"><span class="nav-dropdown-label">About</span><ul class="nav-dropdown-menu"><li><a href="/about">About the Founders</a></li><li><a href="/church-information">About Vital Kauaʻi Church</a></li><li><a href="/healing-circle">Our Healing Circle</a></li></ul></li>
    <li><a href="/#contact">Contact</a></li>
  </ul>
  <a href="/begin-your-journey" class="nav-cta">Begin the Journey</a>
</nav>

<!-- MOBILE NAV -->
<div id="mobile-nav" class="nav-mobile">
  <button class="nav-mobile-close" onclick="document.getElementById('mobile-nav').classList.remove('nav-mobile-open')">✕</button>
  <a href="/begin-your-journey" class="mobile-accent-link">Begin the Journey</a>
  <a href="/iboga-journey">The Iboga Journey</a>
  <a href="/stay">Stay With Us</a>
  <a href="/stay#local">Work With Us</a>
  <a href="/about">About the Founders</a>
  <a href="/church-information">About Vital Kauaʻi Church</a>
  <a href="/healing-circle">Our Healing Circle</a>
  <a href="/portal">Member Portal</a>
</div>

<!-- HERO -->
<section id="hero">
  <img class="hero-img"
    src="https://images.unsplash.com/photo-1598135753163-6167c1a1ad65?w=1800&q=85"
    alt="Hanalei Bay, Kauaʻi North Shore">
  <div class="hero-overlay"></div>
  <div class="hero-content">
    <p class="hero-eyebrow">Hanalei, Kauaʻi's North Shore</p>
    <h1 class="hero-title">Come,<br><em>Stay & Transform</em></h1>
    <p class="hero-sub">Iboga ceremony in service of whole-being transformation — held in a private home on Kauaʻi's North Shore, by the land itself.</p>
  </div>
</section>

<!-- CEREMONY CALL TO ACTION -->
<div style="background:var(--forest);padding:64px 60px;text-align:center;border-top:1px solid rgba(200,169,110,0.12);border-bottom:1px solid rgba(200,169,110,0.08);">
  <p style="font-size:10px;letter-spacing:0.45em;text-transform:uppercase;color:var(--terra-pale);margin-bottom:18px;">A Sacred Gathering</p>
  <p style="font-family:'Cormorant Garamond',serif;font-size:clamp(22px,3vw,36px);font-weight:300;font-style:italic;color:var(--cream);line-height:1.5;max-width:680px;margin:0 auto 10px;">There are those who feel the call before they understand it.</p>
  <p style="font-size:16px;color:rgba(245,240,232,0.7);letter-spacing:0.08em;margin-bottom:36px;">Next Group Ceremony · September 6 – 13, 2026 · Hanalei, Kauaʻi</p>
  <a href="/begin-your-journey" target="_blank" style="display:inline-block;font-size:10px;font-weight:400;letter-spacing:0.3em;text-transform:uppercase;color:var(--forest);background:var(--gold);padding:18px 44px;text-decoration:none;transition:background 0.3s;">Join Our Next Group Ceremony</a>
  <div style="margin-top:48px;padding-top:40px;border-top:1px solid rgba(200,169,110,0.1);max-width:820px;margin-left:auto;margin-right:auto;">
    <p style="font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:300;font-style:italic;color:rgba(245,240,232,0.75);line-height:1.9;">We come together as a church — a small circle, deep transformation, a sacred plant, and this land. People arrive carrying something. They leave lighter. That is the work. You are welcome here.</p>
  </div>
</div>

<!-- INTRO -->
<section id="intro">
  <p class="intro-quote reveal">"When you arrive, you are stepping into something that has been prepared for you — a private home in Hanalei, a circle of fellow church members, and a land that has been holding people through transformation for a very long time."</p>
  <div class="intro-rule reveal reveal-delay-1"></div>
</section>

<!-- THE HOME -->
<section id="homes">
  <div class="homes-grid">
    <div class="reveal" style="display:flex;flex-direction:column;gap:10px;position:relative;">
      <div style="height:320px;overflow:hidden;background:var(--forest-dark);">
        <img src="/images/bedroom.jpg" alt="Private bedroom with mountain views" style="width:100%;height:100%;object-fit:cover;object-position:center 40%;">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div style="height:200px;overflow:hidden;background:var(--forest-dark);">
          <img src="/images/kitchen.jpg" alt="Open kitchen and living space" style="width:100%;height:100%;object-fit:cover;object-position:center 30%;">
        </div>
        <div style="height:200px;overflow:hidden;background:var(--forest-dark);">
          <img src="/images/bathroom.jpg" alt="Bathroom" style="width:100%;height:100%;object-fit:cover;object-position:center 20%;">
        </div>
      </div>
      <p style="font-size:10px;color:rgba(26,26,24,0.32);letter-spacing:0.05em;font-style:italic;text-align:center;margin-top:6px;">One of our ceremony homes. Photos of your private sanctuary shared personally after your discovery call.</p>
    </div>
    <div class="homes-text">
      <span class="section-label reveal">Where You Will Stay</span>
      <h2 class="section-title reveal">A Private Home<br><em>in Hanalei</em></h2>
      <p class="homes-body reveal">You will be staying in a private home in Hanalei — carefully selected for comfort, space, and proximity to the land and the bay. Each home sits within walking distance of the water, cradled by the mountains, and prepared with intention for the people who will move through it.</p>
      <p class="homes-body reveal reveal-delay-1">The specific home for your ceremony date will be shared with you personally after our discovery call.</p>
      <div class="homes-pull reveal reveal-delay-2">
        <p>"The home is the first layer of the medicine — arriving somewhere clean, quiet, and prepared for you, in a deeply healing place."</p>
      </div>
      <p class="homes-body reveal">Members share a spacious, welcoming home — a private, intimate container of up to six members at a time, so the space and the care remain deeply personal.</p>
    </div>
  </div>
</section>

<!-- HANALEI BAY PHOTO STRIP -->
<div style="height:55vh;min-height:380px;overflow:hidden;position:relative;">
  <img src="/images/hanalei2.jpg?v=2"
    alt="Hanalei Bay, Kauaʻi"
    style="width:100%;height:100%;object-fit:cover;object-position:center 60%;filter:saturate(0.9) brightness(0.88);">
  <div style="position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,20,12,0.15) 0%,rgba(10,20,12,0.0) 40%,rgba(10,20,12,0.45) 100%);"></div>
  <div style="position:absolute;bottom:40px;left:60px;">
    <p style="font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:var(--terra-pale);margin-bottom:8px;">Hanalei Bay · North Shore, Kauaʻi</p>
    <p style="font-family:'Cormorant Garamond',serif;font-size:clamp(22px,3vw,36px);font-weight:300;font-style:italic;color:var(--cream);line-height:1.3;">Steps from where you'll wake up.</p>
  </div>
</div>

<!-- GALLERY -->
<section id="gallery">
  <div style="margin-bottom:48px;">
    <span class="section-label reveal">The Setting</span>
    <h2 class="section-title reveal" style="color:var(--text-dark);">Hanalei —<br><em>Your Backyard</em></h2>
    <p class="reveal" style="font-size:14px;color:var(--text-mid);line-height:2.0;font-weight:300;max-width:640px;margin-top:16px;">This is where you will wake up. The bay, the mountains, the rivers — all of it within walking distance, woven into every day of your stay.</p>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
    <div class="gallery-item" style="height:360px;grid-row:span 2;" >
      <img src="/images/hanalei1.jpg" alt="Hanalei Bay" style="width:100%;height:100%;object-fit:cover;filter:saturate(0.88) brightness(0.92);">
      <div class="gallery-caption"><p>Hanalei Bay · Steps Away</p></div>
    </div>
    <div class="gallery-item" style="height:240px;">
      <img src="/images/hanalei2.jpg" alt="Hanalei mountains" style="width:100%;height:100%;object-fit:cover;object-position:center 40%;filter:saturate(0.88) brightness(0.92);">
      <div class="gallery-caption"><p>The Mountains · Behind Every Ceremony</p></div>
    </div>
    <div class="gallery-item" style="height:240px;">
      <img src="/images/hanalei3.jpg" alt="Hanalei Valley" style="width:100%;height:100%;object-fit:cover;filter:saturate(0.88) brightness(0.92);">
      <div class="gallery-caption"><p>Hanalei Valley · Living ʻĀina</p></div>
    </div>
    <div class="gallery-item" style="height:240px;">
      <img src="/images/hanaleipier2.jpg" alt="Hanalei Pier" style="width:100%;height:100%;object-fit:cover;filter:saturate(0.88) brightness(0.92);">
      <div class="gallery-caption"><p>Hanalei Pier · The Heart of Town</p></div>
    </div>
    <div class="gallery-item" style="height:240px;">
      <img src="/images/hanaleitown2.jpg" alt="Hanalei Town" style="width:100%;height:100%;object-fit:cover;object-position:center 30%;filter:saturate(0.88) brightness(0.92);">
      <div class="gallery-caption"><p>Hanalei Town · Island Life</p></div>
    </div>
  </div>
  <p style="margin-top:20px;font-size:11px;color:rgba(26,26,24,0.35);letter-spacing:0.05em;font-style:italic;text-align:center;">Accommodation photos and home details are shared personally after your discovery call.</p>
</section>

<!-- WHAT'S INCLUDED -->
<section id="included">
  <span class="section-label reveal">Everything Is Held</span>
  <h2 class="section-title reveal" style="color:var(--cream);">What's<br><em style="color:var(--terra-pale);">Included</em></h2>
  <div class="included-grid">
    <div class="included-card reveal">
      <div class="included-rule"></div>
      <h3 class="included-title">Private Sessions & Ceremonies</h3>
      <p class="included-body">Your ceremony stay is a fully held and coordinated arc — each day intentionally designed. Iboga ceremony, yoga, breathwork, massage, nervous system support session (acupuncture, biogeometry, bodytalk, and more), sound healing ceremony, and integration work — held in our dedicated space or in nature itself.</p>
    </div>
    <div class="included-card reveal reveal-delay-1">
      <div class="included-rule"></div>
      <h3 class="included-title">Your Private Sanctuary</h3>
      <p class="included-body">A private room within a carefully selected home in Hanalei — clean, nature-integrated, and prepared with care. Your own space to rest, reflect, and integrate between sessions.</p>
    </div>
    <div class="included-card reveal reveal-delay-2">
      <div class="included-rule"></div>
      <h3 class="included-title">ʻĀina Nourishment</h3>
      <p class="included-body">Farm-to-table meals sourced from Kauaʻi's living land. High-vibration, deeply nourishing, and aligned with your protocol.</p>
    </div>
    <div class="included-card reveal">
      <div class="included-rule"></div>
      <h3 class="included-title">Nature Immersion Daily</h3>
      <p class="included-body">Ocean swims, river floats, grounding practices — woven into your days with intention. A guided walk along the Nā Pali Coast to release and receive, in communion with the elements before ceremony.</p>
    </div>
    <div class="included-card reveal reveal-delay-1">
      <div class="included-rule"></div>
      <h3 class="included-title">Full-Spectrum Support</h3>
      <p class="included-body">Our team is with you across the arc of your journey. Text support, check-ins, and the quiet reassurance of knowing someone who genuinely cares is always close.</p>
    </div>
    <div class="included-card reveal reveal-delay-2">
      <div class="included-rule"></div>
      <h3 class="included-title">Arrival & Departure</h3>
      <p class="included-body">Arrival pickup and departure drop-off are available through us — simply let us know and we will have everything coordinated. Members are also welcome to arrange their own transportation.</p>
    </div>
  </div>

</section>
<section id="setting">
  <div class="setting-grid">
    <div class="setting-photo">
      <img src="/images/hanalei1.jpg" alt="Hanalei Bay, Kauai">
    </div>
    <div class="setting-text">
      <span class="section-label reveal">The Land</span>
      <h2 class="section-title reveal">Hanalei —<br><em>Where the World Slows</em></h2>

      <div class="setting-features reveal reveal-delay-2">
        <div class="setting-feature">
          <div class="setting-feature-line"></div>
          <div class="setting-feature-text">
            <p class="setting-feature-name">Hanalei Bay</p>
            <p class="setting-feature-desc">Steps from one of the most beautiful bays in all of Hawaiʻi — warm, clear, and deeply restorative</p>
          </div>
        </div>
        <div class="setting-feature">
          <div class="setting-feature-line"></div>
          <div class="setting-feature-text">
            <p class="setting-feature-name">Mountain Views</p>
            <p class="setting-feature-desc">Ancient volcanic peaks hold you in every ceremony</p>
          </div>
        </div>
        <div class="setting-feature">
          <div class="setting-feature-line"></div>
          <div class="setting-feature-text">
            <p class="setting-feature-name">Living Rivers & Waterfalls</p>
            <p class="setting-feature-desc">Cold plunges, quiet floats, elemental baptisms</p>
          </div>
        </div>
      </details>
    </div>
  </div>
</section>

<!-- GUEST EXPERIENCE -->
<section id="experience" style="background:var(--sand-light);padding:100px 60px;">
  <div style="max-width:900px;margin:0 auto;">
    <div style="margin-bottom:64px;">
      <span class="section-label reveal">What to Expect</span>
      <h2 class="section-title reveal" style="color:var(--text-dark);">Seven Days.<br><em>One Arc.</em></h2>
      <p class="reveal" style="font-size:14px;color:var(--text-mid);line-height:2.0;font-weight:300;max-width:560px;margin-top:16px;">Two days of preparation, one day of ceremony, three days of integration, and a closing. Each phase has its own rhythm.</p>
    </div>

    <div style="display:flex;flex-direction:column;position:relative;">

      <!-- Vertical line -->
      <div style="position:absolute;left:38px;top:0;bottom:0;width:1px;background:linear-gradient(to bottom,rgba(184,105,74,0.3),rgba(184,105,74,0.05));"></div>

      <!-- Day 01 -->
      <div class="reveal" style="display:grid;grid-template-columns:80px 1fr;gap:32px;align-items:start;margin-bottom:36px;">
        <div style="display:flex;flex-direction:column;align-items:center;padding-top:4px;">
          <div style="width:16px;height:16px;border-radius:50%;background:rgba(184,105,74,0.25);border:1px solid rgba(184,105,74,0.4);position:relative;z-index:1;flex-shrink:0;"></div>
        </div>
        <div style="padding-bottom:36px;border-bottom:1px solid rgba(184,105,74,0.1);">
          <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:6px;">
            <span style="font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:300;color:rgba(184,105,74,0.5);letter-spacing:0.1em;">01</span>
            <span style="font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:var(--terra);">Arrival</span>
          </div>
          <h3 style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:var(--text-dark);margin-bottom:8px;">Arriving & Settling In</h3>
          <p style="font-size:13px;color:var(--text-mid);line-height:1.85;">Your home is ready. A nourishing meal, an orientation, and the chance to feel what it is like to be here.</p>
        </div>
      </div>

      <!-- Day 02 -->
      <div class="reveal" style="display:grid;grid-template-columns:80px 1fr;gap:32px;align-items:start;margin-bottom:36px;">
        <div style="display:flex;flex-direction:column;align-items:center;padding-top:4px;">
          <div style="width:16px;height:16px;border-radius:50%;background:rgba(184,105,74,0.25);border:1px solid rgba(184,105,74,0.4);position:relative;z-index:1;flex-shrink:0;"></div>
        </div>
        <div style="padding-bottom:36px;border-bottom:1px solid rgba(184,105,74,0.1);">
          <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:6px;">
            <span style="font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:300;color:rgba(184,105,74,0.5);letter-spacing:0.1em;">02</span>
            <span style="font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:var(--terra);">Preparation</span>
          </div>
          <h3 style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:var(--text-dark);margin-bottom:8px;">Time on the Land & in the Water</h3>
          <p style="font-size:13px;color:var(--text-mid);line-height:1.85;">Time in nature, on the bay, in the rivers, a guided walk along the Nā Pali Coast. Body and spirit readied for what follows.</p>
        </div>
      </div>

      <!-- Day 03 — CEREMONY (highlighted) -->
      <div class="reveal" style="display:grid;grid-template-columns:80px 1fr;gap:32px;align-items:start;margin-bottom:36px;">
        <div style="display:flex;flex-direction:column;align-items:center;padding-top:4px;">
          <div style="width:22px;height:22px;border-radius:50%;background:var(--terra);border:2px solid var(--terra-light);position:relative;z-index:1;flex-shrink:0;margin-left:-3px;"></div>
        </div>
        <div style="padding:24px 28px;background:rgba(184,105,74,0.07);border-left:2px solid var(--terra);margin-bottom:36px;">
          <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:6px;">
            <span style="font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:300;color:var(--terra);letter-spacing:0.1em;">03</span>
            <span style="font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:var(--terra);">Ceremony</span>
          </div>
          <h3 style="font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:400;color:var(--text-dark);margin-bottom:8px;">The Iboga Ceremony</h3>
          <p style="font-size:13px;color:var(--text-mid);line-height:1.85;">The heart of the journey. You enter with intention. You leave having been met by the medicine — changed at the root.</p>
        </div>
      </div>

      <!-- Day 04 -->
      <div class="reveal" style="display:grid;grid-template-columns:80px 1fr;gap:32px;align-items:start;margin-bottom:36px;">
        <div style="display:flex;flex-direction:column;align-items:center;padding-top:4px;">
          <div style="width:16px;height:16px;border-radius:50%;background:rgba(184,105,74,0.25);border:1px solid rgba(184,105,74,0.4);position:relative;z-index:1;flex-shrink:0;"></div>
        </div>
        <div style="padding-bottom:36px;border-bottom:1px solid rgba(184,105,74,0.1);">
          <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:6px;">
            <span style="font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:300;color:rgba(184,105,74,0.5);letter-spacing:0.1em;">04</span>
            <span style="font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:var(--terra);">Integration</span>
          </div>
          <h3 style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:var(--text-dark);margin-bottom:8px;">Rest & Receiving</h3>
          <p style="font-size:13px;color:var(--text-mid);line-height:1.85;">The day after ceremony is for rest. The medicine is still moving. We hold you close.</p>
        </div>
      </div>

      <!-- Day 05 -->
      <div class="reveal" style="display:grid;grid-template-columns:80px 1fr;gap:32px;align-items:start;margin-bottom:36px;">
        <div style="display:flex;flex-direction:column;align-items:center;padding-top:4px;">
          <div style="width:16px;height:16px;border-radius:50%;background:rgba(184,105,74,0.25);border:1px solid rgba(184,105,74,0.4);position:relative;z-index:1;flex-shrink:0;"></div>
        </div>
        <div style="padding-bottom:36px;border-bottom:1px solid rgba(184,105,74,0.1);">
          <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:6px;">
            <span style="font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:300;color:rgba(184,105,74,0.5);letter-spacing:0.1em;">05</span>
            <span style="font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:var(--terra);">Integration</span>
          </div>
          <h3 style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:var(--text-dark);margin-bottom:8px;">Land & Reflection</h3>
          <p style="font-size:13px;color:var(--text-mid);line-height:1.85;">Nature, somatic integration sessions with your guide, and the quiet where the deeper layers begin to settle and clarify.</p>
        </div>
      </div>

      <!-- Day 06 -->
      <div class="reveal" style="display:grid;grid-template-columns:80px 1fr;gap:32px;align-items:start;margin-bottom:36px;">
        <div style="display:flex;flex-direction:column;align-items:center;padding-top:4px;">
          <div style="width:16px;height:16px;border-radius:50%;background:rgba(184,105,74,0.25);border:1px solid rgba(184,105,74,0.4);position:relative;z-index:1;flex-shrink:0;"></div>
        </div>
        <div style="padding-bottom:36px;border-bottom:1px solid rgba(184,105,74,0.1);">
          <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:6px;">
            <span style="font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:300;color:rgba(184,105,74,0.5);letter-spacing:0.1em;">06</span>
            <span style="font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:var(--terra);">Integration</span>
          </div>
          <h3 style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:var(--text-dark);margin-bottom:8px;">Embodying the Shift</h3>
          <p style="font-size:13px;color:var(--text-mid);line-height:1.85;">Movement, community, and mapping the path forward into the life waiting for you.</p>
        </div>
      </div>

      <!-- Day 07 -->
      <div class="reveal" style="display:grid;grid-template-columns:80px 1fr;gap:32px;align-items:start;">
        <div style="display:flex;flex-direction:column;align-items:center;padding-top:4px;">
          <div style="width:16px;height:16px;border-radius:50%;background:rgba(184,105,74,0.25);border:1px solid rgba(184,105,74,0.4);position:relative;z-index:1;flex-shrink:0;"></div>
        </div>
        <div>
          <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:6px;">
            <span style="font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:300;color:rgba(184,105,74,0.5);letter-spacing:0.1em;">07</span>
            <span style="font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:var(--terra);">Return</span>
          </div>
          <h3 style="font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;color:var(--text-dark);margin-bottom:8px;">Closing & Going Home</h3>
          <p style="font-size:13px;color:var(--text-mid);line-height:1.85;">A closing ceremony and a gentle transition — carried by what Iboga opened in you and what Kauaʻi gave you.</p>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- LOCAL RESIDENTS -->
<section id="local">
  <div class="local-inner">
    <div class="local-label-col">
      <span class="section-label reveal">On-Island Work</span>
      <h2 class="local-title reveal">Already<br><em>Home</em></h2>
      <div class="local-rule reveal"></div>
    </div>
    <div>
      <p class="local-body reveal">Transformation arrives right where you are. If you live on Kauaʻi and feel the pull of this work — the medicine, somatic healing, energy work, or simply a reset — we are here, and we come to you.</p>
      <p class="local-body reveal reveal-delay-1">Rachel and Josh work with a quiet circle of island residents who seek the depth of a Vital Kauaʻi journey without leaving home. Sessions happen in your space. The container is just as held.</p>
      <p class="local-body reveal reveal-delay-2">If you are local and something in you is ready, reach out. The conversation is always the beginning.</p>
      <a href="/begin-your-journey" class="local-cta reveal reveal-delay-3">Reach Out →</a>
    </div>
  </div>
</section>

<!-- EXPLORE THE LAND -->
<section id="explore-land" style="background:var(--cream);padding:60px 40px;overflow:hidden;">
  <div style="max-width:1100px;margin:0 auto;">

    <div style="margin-bottom:32px;padding-bottom:24px;border-bottom:1px solid rgba(184,105,74,0.15);">
      <span class="section-label reveal" style="margin-bottom:6px;">Regenerative Visitorship</span>
      <h2 style="font-family:'Cormorant Garamond',serif;font-size:clamp(22px,2.5vw,34px);font-weight:300;color:var(--text-dark);line-height:1.15;margin-bottom:14px;" class="reveal">The Living <em style="font-style:italic;color:var(--terra);">ʻĀina</em></h2>
      <p class="reveal" style="font-size:13px;color:var(--stone);line-height:1.85;max-width:680px;font-weight:300;">For those who feel called, there is an option to visit or volunteer at one of these places and give back to the land that holds you. These organizations welcome hands and open hearts.</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(184,105,74,0.1);overflow:hidden;" class="reveal">

      <div style="padding:20px;background:var(--cream);">
        <div style="height:120px;overflow:hidden;margin-bottom:14px;background:var(--forest-dark);">
          <img src="/images/waipa.jpg" alt="Waipā Foundation" style="width:100%;height:100%;object-fit:cover;filter:saturate(0.85) brightness(0.88);">
        </div>
        <h3 style="font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:400;color:var(--text-dark);margin-bottom:3px;">Waipā Foundation</h3>
        <p style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--terra);margin-bottom:8px;">Hanalei Bay</p>
        <p style="font-size:12px;color:var(--stone);line-height:1.7;">Living ahupuaʻa — taro fields, canoes, and weekly poi day.</p>
        <a href="https://waipafoundation.org" target="_blank" style="display:inline-block;margin-top:10px;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:var(--terra);text-decoration:none;border-bottom:1px solid rgba(184,105,74,0.3);padding-bottom:2px;">Visit →</a>
      </div>

      <div style="padding:20px;background:var(--cream);">
        <div style="height:120px;overflow:hidden;margin-bottom:14px;background:var(--forest-dark);">
          <img src="https://images.unsplash.com/photo-1598135753163-6167c1a1ad65?w=600&q=80" alt="Limahuli Garden" style="width:100%;height:100%;object-fit:cover;filter:saturate(0.85) brightness(0.88);">
        </div>
        <h3 style="font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:400;color:var(--text-dark);margin-bottom:3px;">Limahuli Garden</h3>
        <p style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--terra);margin-bottom:8px;">Hāʻena</p>
        <p style="font-size:12px;color:var(--stone);line-height:1.7;">Ancient taro terraces and native forest. A puʻuhonua — place of refuge.</p>
        <a href="https://ntbg.org/gardens/limahuli" target="_blank" style="display:inline-block;margin-top:10px;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:var(--terra);text-decoration:none;border-bottom:1px solid rgba(184,105,74,0.3);padding-bottom:2px;">Visit →</a>
      </div>

      <div style="padding:20px;background:var(--cream);">
        <div style="height:120px;overflow:hidden;margin-bottom:14px;background:var(--forest-dark);">
          <img src="/images/kee.jpeg" alt="Hui Makaainana o Makana" style="width:100%;height:100%;object-fit:cover;object-position:center 40%;filter:saturate(0.85) brightness(0.88);">
        </div>
        <h3 style="font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:400;color:var(--text-dark);margin-bottom:3px;">Hui Makaʻāinana o Makana</h3>
        <p style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--terra);margin-bottom:8px;">Hāʻena</p>
        <p style="font-size:12px;color:var(--stone);line-height:1.7;">Community stewards of the reef, watershed, and cultural memory.</p>
        <a href="https://www.huimakaainanaomakana.org" target="_blank" style="display:inline-block;margin-top:10px;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:var(--terra);text-decoration:none;border-bottom:1px solid rgba(184,105,74,0.3);padding-bottom:2px;">Visit →</a>
      </div>

      <div style="padding:20px;background:var(--cream);">
        <div style="height:120px;overflow:hidden;margin-bottom:14px;background:var(--forest-dark);">
          <img src="/images/haenastatepark.jpeg" alt="Haena State Park" style="width:100%;height:100%;object-fit:cover;object-position:center 60%;filter:saturate(0.85) brightness(0.88);">
        </div>
        <h3 style="font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:400;color:var(--text-dark);margin-bottom:3px;">Hāʻena State Park</h3>
        <p style="font-size:9px;letter-spacing:0.15em;text-transform:uppercase;color:var(--terra);margin-bottom:8px;">Kēʻē Beach · Kalalau Trail</p>
        <p style="font-size:12px;color:var(--stone);line-height:1.7;">Ancient sea caves, sacred sites, and the Nā Pali Coast.</p>
        <a href="https://gohaena.com" target="_blank" style="display:inline-block;margin-top:10px;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:var(--terra);text-decoration:none;border-bottom:1px solid rgba(184,105,74,0.3);padding-bottom:2px;">Visit →</a>
      </div>

    </div>
  </div>
</section>

<!-- UPCOMING DATES -->
<section style="background:var(--forest-dark);padding:80px 60px;text-align:center;">
  <div style="max-width:860px;margin:0 auto;">
    <span class="section-label reveal" style="color:var(--terra);">Come As You Are</span>
    <h2 style="font-family:'Cormorant Garamond',serif;font-size:clamp(32px,4vw,52px);font-weight:300;color:var(--cream);line-height:1.1;margin-bottom:16px;" class="reveal">Upcoming<br><em style="font-style:italic;color:var(--terra-pale);">Ceremonies</em></h2>
    <p class="reveal" style="font-size:14px;color:rgba(245,240,232,0.6);line-height:1.95;margin-bottom:48px;max-width:600px;margin-left:auto;margin-right:auto;">Each ceremony is a small, held gathering — six members, seven days, one sacred arc. Book a discovery call to learn about the next available date.</p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin-bottom:44px;" class="reveal">
      <div id="upcoming-ceremony-card-0" style="background:rgba(28,43,30,0.5);padding:28px 20px;">
        <p style="font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:rgba(200,169,110,0.35);margin-bottom:10px;">Upcoming</p>
        <p style="font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:300;color:rgba(245,240,232,0.35);margin-bottom:4px;">TBA</p>
        <p style="font-size:11px;color:rgba(245,240,232,0.2);letter-spacing:0.08em;">Hanalei, Kauaʻi</p>
        <p style="font-size:10px;color:rgba(245,240,232,0.2);margin-top:12px;">Dates Coming</p>
      </div>
      <div id="upcoming-ceremony-card-1" style="background:rgba(28,43,30,0.5);padding:28px 20px;">
        <p style="font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:rgba(200,169,110,0.35);margin-bottom:10px;">Upcoming</p>
        <p style="font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:300;color:rgba(245,240,232,0.35);margin-bottom:4px;">TBA</p>
        <p style="font-size:11px;color:rgba(245,240,232,0.2);letter-spacing:0.08em;">Hanalei, Kauaʻi</p>
        <p style="font-size:10px;color:rgba(245,240,232,0.2);margin-top:12px;">Dates Coming</p>
      </div>
      <div id="upcoming-ceremony-card-2" style="background:rgba(28,43,30,0.5);padding:28px 20px;">
        <p style="font-size:9px;letter-spacing:0.4em;text-transform:uppercase;color:rgba(200,169,110,0.35);margin-bottom:10px;">Upcoming</p>
        <p style="font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:300;color:rgba(245,240,232,0.35);margin-bottom:4px;">TBA</p>
        <p style="font-size:11px;color:rgba(245,240,232,0.2);letter-spacing:0.08em;">Hanalei, Kauaʻi</p>
        <p style="font-size:10px;color:rgba(245,240,232,0.2);margin-top:12px;">Dates Coming</p>
      </div>
    </div>
    <a href="/begin-your-journey" target="_blank" style="display:inline-block;font-size:10px;font-weight:400;letter-spacing:0.3em;text-transform:uppercase;color:var(--forest);background:var(--gold);padding:18px 44px;text-decoration:none;">Join Our Next Group Ceremony</a>
  </div>
</section>

<!-- FAQ -->
<section id="faq">
  <div class="faq-inner">
    <div class="faq-header">
      <div>
        <span class="section-label reveal">Before You Ask</span>
        <h2 class="section-title reveal">Common<br><em>Questions</em></h2>
      </div>
      <p class="reveal">Your questions are important and we are here to answer them. Reach out — we are always happy to connect.</p>
    </div>
    <div class="faq-list reveal">

      <details class="faq-item">
        <summary>
          <span class="faq-q-text">How long is a typical stay?</span>
          <span class="faq-icon" aria-hidden="true"></span>
        </summary>
        <div class="faq-answer">
          <p>Our group ceremony is a seven-day arc — arriving on Day 1, two days of preparation, ceremony on Day 3, three days of integration, and a closing on Day 7. We discuss your specific journey and any additional support you may need on your discovery call.</p>
        </div>
      </details>

      <details class="faq-item">
        <summary>
          <span class="faq-q-text">What does the discovery call look like?</span>
          <span class="faq-icon" aria-hidden="true"></span>
        </summary>
        <div class="faq-answer">
          <p>The first step is a discovery call — a real conversation with Rachel and/or Josh, bookable directly through our Calendly. We want to understand what brings you here, what you are carrying, your health history, and what support will serve you best. This is how we begin to know you, so that the container we hold for you is built for who you actually are.</p>
        </div>
      </details>

      <details class="faq-item">
        <summary>
          <span class="faq-q-text">Can I bring a partner or travel companion?</span>
          <span class="faq-icon" aria-hidden="true"></span>
        </summary>
        <div class="faq-answer">
          <p>Yes. We work with couples and close companions who wish to move through a journey together. Co-journeying can be deeply powerful — and it does require its own kind of preparation and intentionality. Let us know on your discovery call that you are coming with someone, and we will discuss what serves you both best. We also welcome groups — intimate gatherings of friends, family, or community who feel called to transform together.</p>
        </div>
      </details>

      <details class="faq-item">
        <summary>
          <span class="faq-q-text">What should I pack?</span>
          <span class="faq-icon" aria-hidden="true"></span>
        </summary>
        <div class="faq-answer">
          <p>Light, natural fabrics that can get wet and get dirty. Layers for cool mornings and evenings. Good walking shoes and flip flops. A journal. Anything that helps you feel at home in your body. Your full packing and preparation guide is available in your member portal once your journey is confirmed.</p>
        </div>
      </details>

      <details class="faq-item">
        <summary>
          <span class="faq-q-text">How is the food handled?</span>
          <span class="faq-icon" aria-hidden="true"></span>
        </summary>
        <div class="faq-answer">
          <p>Meals are prepared with the same intentionality as everything else at Vital Kauaʻi. We source locally and seasonally — farms, farmers' markets, and the ocean. All dietary needs, allergies, and protocol-specific requirements are gathered on your discovery call and honored throughout your stay. Your nutrition is held with care across all seven days.</p>
        </div>
      </details>

      <details class="faq-item">
        <summary>
          <span class="faq-q-text">How far is the airport from Hanalei?</span>
          <span class="faq-icon" aria-hidden="true"></span>
        </summary>
        <div class="faq-answer">
          <p>Līhuʻe Airport (LIH) is approximately one hour from Hanalei along Kauaʻi's scenic North Shore highway. Ground transportation can be arranged through us — simply let us know on your discovery call and we will have everything coordinated. Members are also welcome to arrange their own transportation and make their own way north.</p>
        </div>
      </details>

      <details class="faq-item">
        <summary>
          <span class="faq-q-text">Is there WiFi? What is the connectivity like?</span>
          <span class="faq-icon" aria-hidden="true"></span>
        </summary>
        <div class="faq-answer">
          <p>Yes, WiFi is available in the homes. Many members find that their relationship with devices naturally shifts once they are here — Hanalei has a way of drawing you fully into the present. Your relationship with devices is yours to navigate, and we fully support a digital reset if that is something you want to explore as part of your journey.</p>
        </div>
      </details>

      <details class="faq-item">
        <summary>
          <span class="faq-q-text">What is your cancellation policy?</span>
          <span class="faq-icon" aria-hidden="true"></span>
        </summary>
        <div class="faq-answer">
          <p>We understand that life moves and plans shift. Our cancellation terms are shared in full at the time of booking. Cancellations made within 30 days of arrival are eligible for a full transfer. Reach out to us directly and we will find a path forward together.</p>
        </div>
      </div>

    </div>
  </div>
</section>

<!-- INTAKE NOTE -->
<section id="intake">
  <div class="intake-inner">
    <span class="section-label reveal">Before You Arrive</span>
    <h2 class="intake-title reveal">Your Needs<br><em>Are Heard</em></h2>
    <p class="intake-body reveal">Every member who joins us completes a discovery call before arrival. This is where we listen — to what you need, what supports you, and what will make this container feel most like home. Your accommodations are matched with care and intention.</p>
    <div class="intake-features reveal">
      <div class="intake-feature">
        <div class="intake-rule"></div>
        <p class="intake-feature-title">Space Needs</p>
        <p class="intake-feature-desc">Private room, accessibility requirements, sleep preferences, sensitivities or allergies</p>
      </div>
      <div class="intake-feature">
        <div class="intake-rule"></div>
        <p class="intake-feature-title">Dietary Needs</p>
        <p class="intake-feature-desc">Allergies, protocol-based nutrition, fasting support, cultural considerations</p>
      </div>
      <div class="intake-feature">
        <div class="intake-rule"></div>
        <p class="intake-feature-title">Anything Else</p>
        <p class="intake-feature-desc">Sensitivities, co-journeying with a partner, children, timing — we listen to all of it</p>
      </div>
    </div>
    <a href="/begin-your-journey" class="btn-primary reveal">Begin Your Inquiry</a>
  </div>
</section>

<!-- FOOTER -->
<footer>
  <div>
    <p class="footer-brand">Vital Kauaʻi</p>
    <p class="footer-tagline">A living sanctuary of transformation and awakening on Kauaʻi's sacred North Shore.</p>
  </div>
  <div class="footer-col">
    <h4>Explore</h4>
    <ul class="footer-links">
      <li><a href="/">Home</a></li>
      <li><a href="iboga-journey.html">Iboga Journey</a></li>
      <li><a href="/stay">Stay With Us</a></li>
      <li><a href="/healing-circle">Our Circle</a></li>
    </ul>
  </div>
  <div class="footer-col">
    <h4>Connect</h4>
    <ul class="footer-links">
      <li><a href="/about">About Rachel & Josh</a></li>
      <li><a href="/begin-your-journey">Contact</a></li>
      <li><a href="portal.html">Member Portal</a></li>
    </ul>
  </div>
  <div class="footer-col">
    <h4>Sacred Policies</h4>
    <ul class="footer-links">
      <li><a href="privacy.html">Privacy</a></li>
      <li><a href="terms.html">Terms</a></li>
      <li><a href="medical-disclaimer.html">Medical Disclaimer</a></li>
      <li><a href="church-information.html">Church Information</a></li>
    </ul>
  </div>
</footer>
<div class="footer-bottom">
  <p>© 2026 Vital Kauai Church · PO Box 932, Hanalei, HI 96714 · aloha@vitalkauai.com</p>
  <p>All original content on this site is protected by U.S. copyright law. Reproduction without written permission prohibited.</p>
</div>

<script>
// Nav scroll
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
});

// Scroll reveal
const reveals = document.querySelectorAll('.reveal');
reveals.forEach(el => el.classList.add('hidden'));
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.remove('hidden');
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
reveals.forEach(el => observer.observe(el));

// FAQ accordion
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i => {
      i.classList.remove('open');
      i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      item.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  });
});
</script>
`;

