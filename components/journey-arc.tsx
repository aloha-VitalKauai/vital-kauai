"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./journey-arc.module.css";

type PhaseKey = "prep" | "ceremony" | "integration";

type Phase = {
  key: PhaseKey;
  number: string;
  title: string;
  week: string;
  essence: string;
  items: string[];
};

const PHASES: Phase[] = [
  {
    key: "prep",
    number: "01",
    title: "Preparation",
    week: "6+ Weeks",
    essence: "Your commitment before you sit with the medicine.",
    items: [
      "Two 1:1 calls with your personal integration guide (Weeks 2 and 4)",
      "Two 1:1 preparation and check-in calls with Rachel & Josh",
      "Weekly journal prompts and reflections in your member portal",
      "The PsychoNeuroEnergetics (PNE) Guide — week-by-week teachings, reflections, and practices to expand your nervous-system capacity",
      "Medical screening, labs, and EKG with your physician",
      "Diet preparation and gathering your home support team",
      "Crafting your questions for the medicine",
    ],
  },
  {
    key: "ceremony",
    number: "02",
    title: "Ceremony",
    week: "1 Week · Hanalei, Kauaʻi",
    essence: "A deeply held arc, rooted in evidence and lineage.",
    items: [
      "A small cohort of up to six members over seven days",
      "Daily meditation, breathwork, movement, and/or yoga",
      "Three therapeutic bodywork or energy work sessions",
      "Ceremonial walk along the Nā Pali coast and water ritual",
      "Fire ritual and whole-plant Iboga ceremony",
      "Sound healing ceremony",
      "Hoʻoponopono ceremony",
      "Nourishment sourced from the ʻāina",
      "Group support and 1:1 integration with your integration guide",
      "Held by experienced facilitators from arrival through closing",
    ],
  },
  {
    key: "integration",
    number: "03",
    title: "Integration",
    week: "6+ Weeks & Beyond",
    essence: "Where the work takes root.",
    items: [
      "Weekly 1:1 calls with your integration guide",
      "Continued member-portal support to anchor what arose into new patterns",
      "The PsychoNeuroEnergetics (PNE) Guide — week-by-week teachings, reflections, and practices to integrate your journey",
      "Lifetime invitation into the Vital Kauaʻi community of those who’ve walked this path",
    ],
  },
];

const ARC_BANDS: Array<{ key: PhaseKey; r: number; color: string; activeColor: string }> = [
  { key: "prep",        r: 280, color: "#a8c5ac", activeColor: "#7a9e7e" }, // sage
  { key: "ceremony",    r: 220, color: "#e2cfa0", activeColor: "#c8a96e" }, // gold
  { key: "integration", r: 160, color: "#d4917a", activeColor: "#b8694a" }, // terra
];

const CENTER_X = 400;
const CENTER_Y = 320;

function arcPath(r: number) {
  const startX = CENTER_X - r;
  const endX = CENTER_X + r;
  return `M ${startX} ${CENTER_Y} A ${r} ${r} 0 0 1 ${endX} ${CENTER_Y}`;
}

export function JourneyArc() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = PHASES[activeIdx];

  return (
    <section className={styles.section} id="protocol">
      <div className={styles.head}>
        <span className={styles.eyebrow}>The Journey Structure</span>
        <h2 className={styles.title}>
          Months of <em>Transformation</em>
        </h2>
        <p className={styles.lead}>
          The Iboga Journey is a held arc of preparation, ceremony, and integration that unfolds
          over months. Every phase is guided, every step supported.
        </p>
      </div>

      <div className={styles.arcStage}>
        <svg
          viewBox="0 0 800 360"
          preserveAspectRatio="xMidYMax meet"
          className={styles.arc}
          aria-hidden
        >
          {ARC_BANDS.map((band, i) => {
            const isActive = active.key === band.key;
            return (
              <path
                key={band.key}
                d={arcPath(band.r)}
                fill="none"
                stroke={isActive ? band.activeColor : band.color}
                strokeWidth={isActive ? 38 : 30}
                strokeLinecap="round"
                opacity={isActive ? 1 : 0.85}
                style={{ cursor: "pointer", transition: "stroke 0.4s, stroke-width 0.4s, opacity 0.4s" }}
                onClick={() => setActiveIdx(i)}
              />
            );
          })}
          {/* Faint center mark */}
          <circle cx={CENTER_X} cy={CENTER_Y} r={4} fill="#c8a96e" opacity={0.35} />
        </svg>

        <ul className={styles.pills} role="tablist">
          {PHASES.map((phase, i) => {
            const isActive = i === activeIdx;
            return (
              <li key={phase.key}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`journey-panel-${phase.key}`}
                  className={`${styles.pill} ${styles[`pill_${phase.key}`]} ${isActive ? styles.pillActive : ""}`}
                  onClick={() => setActiveIdx(i)}
                >
                  <span className={styles.pillNumber}>{phase.number}</span>
                  <span className={styles.pillTitle}>{phase.title}</span>
                  <span className={styles.pillWeek}>{phase.week}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        className={styles.panel}
        id={`journey-panel-${active.key}`}
        role="tabpanel"
        aria-labelledby={`journey-tab-${active.key}`}
        key={active.key}
      >
        <p className={styles.essence}>{active.essence}</p>
        <ul className={styles.list}>
          {active.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </div>

      <p className={styles.cta}>
        For a fuller view of the work week-by-week,{" "}
        <Link href="/begin-your-journey">book a discovery call</Link>.
      </p>
    </section>
  );
}
