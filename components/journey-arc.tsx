"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useRef, useState } from "react";
import styles from "./journey-arc.module.css";

type PhaseKey = "prep" | "ceremony" | "integration";

type Phase = {
  key: PhaseKey;
  numeral: string;
  numberLabel: string;
  title: string;
  week: string;
  essence: string;
  items: string[];
  image: string;
  imageAlt: string;
  imagePosition?: string;
  accent: string;
  accentDeep: string;
};

const PHASES: Phase[] = [
  {
    key: "prep",
    numeral: "I",
    numberLabel: "01",
    title: "Preparation",
    week: "6+ Weeks",
    essence: "Your commitment before you sit with the root.",
    items: [
      "Three or four 1:1 PNE Practitioner calls up front (six total across your journey)",
      "Four coaching calls with Rachel & Josh—an onboarding call, two one-on-one, and one with your support circle",
      "Weekly journal prompts and reflections in your member portal",
      "The PsychoNeuroEnergetics (PNE) Guide—week-by-week teachings, reflections, and practices to expand your nervous-system capacity",
      "Medical screening, labs, and EKG with your physician",
      "Diet preparation and gathering your home support team",
      "Crafting your questions for the root",
    ],
    image: "/images/kauaiwaterfall.jpeg",
    imageAlt: "Kauaʻi waterfall",
    imagePosition: "center 40%",
    accent: "#3a6b48",
    accentDeep: "#1f3d27",
  },
  {
    key: "ceremony",
    numeral: "II",
    numberLabel: "02",
    title: "Ceremony",
    week: "1 Week · Hanalei, Kauaʻi",
    essence: "A deeply held week, rooted in support.",
    items: [
      "A small cohort of up to three members",
      "Daily meditation, breathwork, movement, and/or yoga",
      "Three therapeutic bodywork or energy work sessions",
      "Ceremonial walk along the Nā Pali coast and water ritual",
      "Fire ritual and two overnight whole-plant Iboga ceremonies",
      "Sound healing ceremony",
      "Hoʻoponopono ceremony",
      "Nourishment sourced from the ʻāina",
      "Group support",
      "Held by experienced facilitators from arrival through closing",
    ],
    image: "/images/ibogabark.jpeg",
    imageAlt: "Iboga root bark",
    imagePosition: "center center",
    accent: "#9c4423",
    accentDeep: "#5e2410",
  },
  {
    key: "integration",
    numeral: "III",
    numberLabel: "03",
    title: "Integration",
    week: "6+ Weeks & Beyond",
    essence: "Where the work takes root.",
    items: [
      "Six weekly 1:1 integration coaching calls with Rachel & Josh",
      "Two to three 1:1 follow-up calls with your PNE Practitioner, in any weeks you choose",
      "Continued member-portal support to anchor what arose into new patterns",
      "The PsychoNeuroEnergetics (PNE) Guide—week-by-week teachings, reflections, and practices to integrate your journey",
      "Lifetime invitation into the Vital Kauaʻi community of those who’ve walked this path",
      "Monthly group calls and optional ongoing one-on-one support",
    ],
    image: "/images/napali.jpeg",
    imageAlt: "Nā Pali coast at golden hour",
    imagePosition: "center 60%",
    accent: "#1f4d73",
    accentDeep: "#0f2c45",
  },
];

function PhasePanel({ phase }: { phase: Phase }) {
  return (
    <div
      className={styles.panel}
      id={`journey-panel-${phase.key}`}
      role="tabpanel"
      style={{ borderTopColor: phase.accent }}
    >
      <span className={styles.panelEyebrow} style={{ color: phase.accentDeep }}>
        {phase.numberLabel} · {phase.week}
      </span>
      <h3 className={styles.panelTitle}>{phase.title}</h3>
      <p className={styles.panelEssence} style={{ color: phase.accentDeep }}>
        {phase.essence}
      </p>
      <ul className={styles.list}>
        {phase.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function JourneyArc() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = PHASES[activeIdx];
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Keep the tapped card stable in the viewport on mobile.
  const handleSelect = (i: number) => {
    if (activeIdx === i) return;
    setActiveIdx(i);
    if (typeof window !== "undefined" && window.innerWidth <= 700) {
      requestAnimationFrame(() => {
        const el = cardRefs.current[i];
        if (!el) return;
        const navOffset = 96;
        const top = el.getBoundingClientRect().top + window.scrollY - navOffset;
        window.scrollTo({ top, behavior: "smooth" });
      });
    }
  };

  return (
    <section className={styles.section} id="protocol">
      <div className={styles.head}>
        <span className={styles.eyebrow}>The Journey Structure</span>
        <h2 className={styles.title}>
          Months of <em>Transformation</em>
        </h2>
        <p className={styles.lead}>
          The Iboga Journey is a held offering of preparation, ceremony, and integration that
          unfolds over months. Every phase is guided, every step supported, with 16 personal calls
          across your journey—ten with Rachel &amp; Josh and six with your PNE Practitioner.
        </p>
      </div>

      {/* ── Three image-led chapter cards ── */}
      <ul className={styles.chapters} role="tablist">
        {PHASES.map((phase, i) => {
          const isActive = i === activeIdx;
          return (
            <Fragment key={phase.key}>
              <li className={styles.chapterItem}>
                <button
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`journey-panel-${phase.key}`}
                  className={`${styles.chapter} ${isActive ? styles.chapterActive : ""}`}
                  onClick={() => handleSelect(i)}
                >
                  <div className={styles.chapterImgWrap}>
                    <Image
                      src={phase.image}
                      alt={phase.imageAlt}
                      fill
                      sizes="(max-width: 900px) 100vw, 33vw"
                      className={styles.chapterImg}
                      style={{ objectPosition: phase.imagePosition ?? "center" }}
                    />
                    <div className={styles.chapterOverlay} />
                    <span className={styles.chapterNumeral}>{phase.numeral}</span>
                    <div className={styles.chapterCaption}>
                      <span className={styles.chapterWeek}>{phase.week}</span>
                      <h3 className={styles.chapterTitle}>{phase.title}</h3>
                      <p className={styles.chapterEssence}>{phase.essence}</p>
                    </div>
                  </div>
                </button>
              </li>
              {/* Mobile inline panel—appears immediately under the active card */}
              {isActive && (
                <li className={styles.mobilePanelWrap} aria-hidden={false}>
                  <PhasePanel phase={phase} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ul>

      {/* Desktop / tablet panel sits below all three cards */}
      <div className={styles.desktopPanelWrap}>
        <div className={styles.desktopConnector} aria-hidden style={{ background: active.accent }} />
        <div key={active.key} className={styles.desktopPanel}>
          <PhasePanel phase={active} />
        </div>
      </div>

      <p className={styles.cta}>
        For a fuller view of the work week-by-week,{" "}
        <Link href="/begin-your-journey">book a discovery call</Link>.
      </p>
    </section>
  );
}
