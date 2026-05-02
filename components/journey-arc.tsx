"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import styles from "./journey-arc.module.css";

type PhaseKey = "prep" | "ceremony" | "integration";

type Phase = {
  key: PhaseKey;
  number: string;
  title: string;
  week: string;
  essence: string;
  items: string[];
  color: string;
  colorDeep: string;
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
    color: "#7a2417",
    colorDeep: "#3d100a",
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
    color: "#1c4a2e",
    colorDeep: "#0c2917",
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
    color: "#143046",
    colorDeep: "#08182a",
  },
];

// Real-rainbow geometry: bands touch each other (radii spaced exactly by stroke width).
const STROKE = 40;
const ARC_BANDS: Array<{ key: PhaseKey; r: number }> = [
  { key: "prep", r: 280 },
  { key: "ceremony", r: 240 },
  { key: "integration", r: 200 },
];

const CENTER_X = 400;
const CENTER_Y = 320;
const VIEWBOX_W = 800;
const VIEWBOX_H = 360;

function arcPath(r: number) {
  const startX = CENTER_X - r;
  const endX = CENTER_X + r;
  return `M ${startX} ${CENTER_Y} A ${r} ${r} 0 0 1 ${endX} ${CENTER_Y}`;
}

function PhasePanel({ phase }: { phase: Phase }) {
  return (
    <div
      className={styles.panel}
      id={`journey-panel-${phase.key}`}
      role="tabpanel"
      style={{ borderTopColor: phase.color }}
    >
      <span className={styles.panelEyebrow} style={{ color: phase.colorDeep }}>
        {phase.number} · {phase.week}
      </span>
      <h3 className={styles.panelTitle}>{phase.title}</h3>
      <p className={styles.panelEssence} style={{ color: phase.colorDeep }}>
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

      {/* ── Desktop / tablet: arc + panel below ── */}
      <div className={styles.desktopWrap}>
        <svg
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          preserveAspectRatio="xMidYMax meet"
          className={styles.arc}
          role="img"
          aria-label="Journey arc — Preparation, Ceremony, Integration"
        >
          <defs>
            {ARC_BANDS.map((band) => (
              <path
                key={band.key}
                id={`arc-path-${band.key}`}
                d={arcPath(band.r)}
                fill="none"
              />
            ))}
            {PHASES.map((phase) => (
              <linearGradient
                key={phase.key}
                id={`grad-${phase.key}`}
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor={phase.color} />
                <stop offset="100%" stopColor={phase.colorDeep} />
              </linearGradient>
            ))}
            <filter id="arc-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="8" />
              <feOffset dy="10" result="off" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.28" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Bands ── jewel-tone gradients, touching */}
          <g filter="url(#arc-shadow)">
            {ARC_BANDS.map((band) => {
              const phase = PHASES.find((p) => p.key === band.key)!;
              const isActive = active.key === band.key;
              return (
                <g
                  key={band.key}
                  className={styles.bandGroup}
                  onClick={() => setActiveIdx(PHASES.findIndex((p) => p.key === band.key))}
                  style={{ cursor: "pointer" }}
                >
                  <path
                    d={arcPath(band.r)}
                    fill="none"
                    stroke={`url(#grad-${phase.key})`}
                    strokeWidth={STROKE}
                    strokeLinecap="butt"
                    opacity={isActive ? 1 : 0.55}
                    style={{ transition: "opacity 0.45s ease" }}
                  />
                </g>
              );
            })}
          </g>

          {/* Brass hairlines along every band's outer edge */}
          {ARC_BANDS.map((band) => {
            const phase = PHASES.find((p) => p.key === band.key)!;
            const isActive = active.key === band.key;
            return (
              <path
                key={band.key}
                d={arcPath(band.r + STROKE / 2 - 0.5)}
                fill="none"
                stroke="#d6b878"
                strokeWidth={isActive ? 1.6 : 0.9}
                strokeOpacity={isActive ? 0.95 : 0.45}
                style={{ transition: "stroke-width 0.4s ease, stroke-opacity 0.4s ease" }}
                onClick={() => setActiveIdx(PHASES.findIndex((p) => p.key === phase.key))}
              />
            );
          })}

          {/* Curved labels — cream over each band */}
          {ARC_BANDS.map((band) => {
            const phase = PHASES.find((p) => p.key === band.key)!;
            const isActive = active.key === band.key;
            return (
              <text
                key={band.key}
                className={styles.bandLabel}
                fill="#f5f0e8"
                opacity={isActive ? 1 : 0.78}
                style={{ transition: "opacity 0.35s ease", cursor: "pointer" }}
                onClick={() => setActiveIdx(PHASES.findIndex((p) => p.key === band.key))}
              >
                <textPath
                  href={`#arc-path-${band.key}`}
                  startOffset="50%"
                  textAnchor="middle"
                >
                  {phase.title}
                </textPath>
              </text>
            );
          })}
        </svg>

        {/* Connector + panel anchored directly below the active arc */}
        <div className={styles.connector} aria-hidden style={{ background: active.color }} />
        <div key={active.key} className={styles.panelWrap}>
          <PhasePanel phase={active} />
        </div>
      </div>

      {/* ── Mobile: stacked rectangles, inline panel under the active one ── */}
      <ul className={styles.mobileStack} role="tablist">
        {PHASES.map((phase, i) => {
          const isActive = i === activeIdx;
          return (
            <Fragment key={phase.key}>
              <li>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`${styles.mobilePill} ${isActive ? styles.mobilePillActive : ""}`}
                  style={{ background: phase.color }}
                  onClick={() => setActiveIdx(i)}
                >
                  <span className={styles.mobilePillNumber}>{phase.number}</span>
                  <span className={styles.mobilePillTitle}>{phase.title}</span>
                  <span className={styles.mobilePillWeek}>{phase.week}</span>
                </button>
              </li>
              {isActive && (
                <li className={styles.mobilePanelWrap} key={`panel-${phase.key}`}>
                  <PhasePanel phase={phase} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ul>

      <p className={styles.cta}>
        For a fuller view of the work week-by-week,{" "}
        <Link href="/begin-your-journey">book a discovery call</Link>.
      </p>
    </section>
  );
}
